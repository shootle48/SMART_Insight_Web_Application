// รับข้อความจาก MQTT → validate ตามสัญญา → เขียน DB → ส่งค่าสดต่อให้ SSE
//
// อยู่ใน process เดียวกับ Hono โดยตั้งใจ (D-001) — เหลือ systemd unit เดียวบนเครื่องหน้างาน
// และส่งค่าสดต่อได้ผ่านหน่วยความจำ ไม่ต้องพึ่ง LISTEN/NOTIFY
//
// หลักที่ยึดทั้งไฟล์: **ข้อความหนึ่งพัง ต้องไม่ทำให้ทั้งระบบหยุดรับข้อมูล**
// ทุก handler จับ error ของตัวเอง log แล้วไปต่อ

import mqtt from "mqtt";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "../../db/index";
import { devices, points, readings } from "../../db/schema";
import {
  inboundMessageSchema,
  meterTopics,
  parseTopic,
  type MeterFrameMessage,
  type DeviceHeartbeatMessage,
  type DeviceStatusMessage,
} from "../../contract";
import { liveEvents, type LiveReading } from "../events";
import { shouldStore, markStored, throttleConfig } from "./throttle";
import { cleanRawText } from "./normalize";

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";

// clientId ต้องคงที่ ไม่ผูกกับ pid — ไม่งั้น clean:false ไร้ความหมาย
// เพราะ broker จะมองว่าเป็น client คนละตัวทุกครั้งที่ restart แล้วทิ้งคิวเดิม
const CLIENT_ID = process.env.MQTT_CLIENT_ID ?? "meter-ingest";

let stats = { received: 0, invalid: 0, inserted: 0, duplicate: 0, throttled: 0 };
export const ingestStats = () => ({ ...stats, ...throttleConfig() });

/** จอต้องเห็นค่าสด แต่ 26 เฟรม/วิ × หลายจุด = Chromium บน Pi รับไม่ไหว
 *  จำกัดอัตราส่งขึ้นจอแยกจากอัตราเก็บ DB — สองเรื่องนี้คนละวัตถุประสงค์ */
const LIVE_EMIT_MIN_MS = Number(process.env.LIVE_EMIT_MIN_MS ?? 250);
const lastEmitAt = new Map<string, number>();

/** สเกลของแต่ละจุด ใช้คำนวณ deadband — cache ไว้ไม่ให้ query ทุกเฟรม */
const scaleCache = new Map<string, { min: number | null; max: number | null }>();

async function getScale(pointId: string) {
  const hit = scaleCache.get(pointId);
  if (hit) return hit;
  const [row] = await db
    .select({ min: points.min_value, max: points.max_value })
    .from(points)
    .where(drizzleSql`${points.point_id} = ${pointId}`);
  const scale = { min: row?.min ?? null, max: row?.max ?? null };
  scaleCache.set(pointId, scale);
  return scale;
}

// สเกลเปลี่ยนได้เมื่อมีคนมาตั้งค่าจุดวัด — ล้าง cache เป็นระยะ
// ไม่ต้องแม่นยำทันที แค่ต้องไม่ค้างตลอดกาล
setInterval(() => scaleCache.clear(), 5 * 60_000);

/** เครื่องที่ยังไม่มีในตาราง — สร้างให้ก่อนเพื่อไม่ให้ FK ปฏิเสธ */
async function ensureDevice(deviceId: string) {
  await db.insert(devices).values({ device_id: deviceId }).onConflictDoNothing();
}

/**
 * จุดวัดที่ไม่รู้จัก — สร้างแถวให้เลย (enabled=false) แล้วค่อยเขียน reading
 *
 * ทางเลือกอื่นคือทิ้งข้อความนั้น ซึ่งแย่กว่ามาก: ค่าที่ AI อ่านมาได้แล้วจะหายไป
 * เพียงเพราะ config ฝั่งเรายังไม่ตรง คนมาเห็นทีหลังก็กู้ไม่ได้
 * enabled=false ทำให้มันไม่ไปโผล่บนจอหลัก แต่ข้อมูลถูกเก็บไว้ครบ
 */
async function ensurePoints(frame: MeterFrameMessage) {
  const rows = frame.readings.map((r) => ({
    point_id: r.point_id,
    device_id: frame.device_id,
    camera_id: frame.camera_id,
    unit: r.unit,
    kind: r.kind,
    enabled: false,
  }));
  await db.insert(points).values(rows).onConflictDoNothing();
}

async function handleFrame(frame: MeterFrameMessage) {
  // ทำความสะอาด value_text ดิบก่อนทำอะไรทั้งหมด (ดูเหตุผลใน normalize.ts) — ต้องทำ
  // ก่อน throttle/insert/ส่งขึ้นจอสด เพื่อให้ทุกที่เห็นค่าเดียวกันที่ format นิ่งแล้ว
  frame = {
    ...frame,
    readings: frame.readings.map((r) => (r.value_text !== null ? { ...r, value_text: cleanRawText(r.value_text) } : r)),
  };

  await ensureDevice(frame.device_id);
  await ensurePoints(frame);

  const capturedAt = new Date(frame.captured_at);
  if (Number.isNaN(capturedAt.getTime())) {
    // Zod ตรวจแค่ว่าเป็น string ไม่ว่าง ไม่ได้ตรวจว่าแปลงเป็นวันที่ได้
    // ปล่อยผ่านไปจะได้ Invalid Date ลง DB ซึ่งพังตอน query ทีหลังแบบหาต้นตอยาก
    throw new Error(`captured_at แปลงเป็นวันที่ไม่ได้: ${frame.captured_at}`);
  }

  const now = Date.now();

  // ---- ตัดสินว่าจะเก็บอันไหน (ดูเหตุผลใน throttle.ts) ----
  //
  // ⚠️ ดึงสเกลให้ครบ "ก่อน" เข้าลูปตัดสินใจ เพราะช่วงตัดสินใจต้องไม่มี await คั่น
  //
  // เคยพลาดมาแล้ว: เดิมเรียก `await getScale()` อยู่ในลูป ทำให้เฟรมอื่นแทรกเข้ามา
  // อ่าน lastStored ตัวเดียวกันก่อนที่ใครจะ markStored → ทุกเฟรมตัดสินว่า "เก็บ" พร้อมกัน
  // ผลคือเพดาน 1 ครั้ง/วินาที ไม่ทำงานเลยตอนยิงรัว (วัดได้ 6.3 แถว/วิ/จุด)
  // unit test จับไม่ได้เพราะยิงทีละเฟรมแล้วรอ — เจอตอนวัดกับอัตราจริงเท่านั้น
  const scales = new Map<string, { min: number | null; max: number | null }>();
  for (const r of frame.readings) scales.set(r.point_id, await getScale(r.point_id));

  // ตั้งแต่บรรทัดนี้จนจบลูป ห้ามมี await เด็ดขาด
  const keep = [];
  for (const r of frame.readings) {
    const decision = shouldStore(r, scales.get(r.point_id)!, now);
    if (decision.store) {
      keep.push(r);
      // mark ทันทีตอนตัดสินใจ ไม่รอผล insert — ยอมแลกว่าถ้า insert ล้ม
      // จุดนั้นจะถูกข้ามไปจนกว่าจะพ้น deadband/gap ซึ่งเกิดยากและเสียแค่แถวเดียว
      // แลกกับการที่เพดานอัตราทำงานถูกต้องตลอดเวลา
      markStored(r, now);
    } else {
      stats.throttled += 1;
    }
  }

  if (keep.length > 0) {
    // onConflictDoNothing + returning: แถวที่ถูกกลืนเพราะซ้ำจะไม่กลับมา
    const inserted = await db
      .insert(readings)
      .values(
        keep.map((r) => ({
          point_id: r.point_id,
          device_id: frame.device_id,
          frame_id: frame.frame_id,
          captured_at: capturedAt,
          value_num: r.value_num,
          value_text: r.value_text,
          unit: r.unit,
          confidence: r.confidence,
          quality: r.quality,
        })),
      )
      .onConflictDoNothing()
      .returning({ point_id: readings.point_id });

    stats.inserted += inserted.length;
    stats.duplicate += keep.length - inserted.length;

    if (inserted.length > 0) {
      await db
        .update(devices)
        .set({ last_frame_at: new Date() })
        .where(drizzleSql`${devices.device_id} = ${frame.device_id}`);
    }
  }

  // ---- ส่งขึ้นจอ: แยกจากการเก็บโดยตั้งใจ ----
  // จอต้องเห็น "ค่าล่าสุด" เสมอแม้ค่านั้นจะไม่ถูกเก็บลง DB เพราะอยู่ใน deadband
  // ถ้าผูกสองอย่างนี้เข้าด้วยกัน ตัวเลขบนจอจะค้างนิ่งทั้งที่ของจริงยังไหลอยู่
  const lastEmit = lastEmitAt.get(frame.device_id) ?? 0;
  if (now - lastEmit >= LIVE_EMIT_MIN_MS) {
    lastEmitAt.set(frame.device_id, now);
    const receivedAt = new Date().toISOString();
    const live: LiveReading[] = frame.readings.map((r) => ({
      ...r,
      device_id: frame.device_id,
      frame_id: frame.frame_id,
      captured_at: frame.captured_at,
      received_at: receivedAt,
    }));
    liveEvents.emit("readings", live);
  }
}

async function handleHeartbeat(msg: DeviceHeartbeatMessage) {
  await ensureDevice(msg.device_id);
  const values = {
    ai_service_status: msg.ai_service_status,
    storage_usage_percent: msg.storage_usage_percent,
    software_version: msg.software_version,
    model_version: msg.model_version,
    last_heartbeat_at: new Date(),
  };
  await db.update(devices).set(values).where(drizzleSql`${devices.device_id} = ${msg.device_id}`);

  liveEvents.emit("device", {
    device_id: msg.device_id,
    ai_service_status: msg.ai_service_status,
    storage_usage_percent: msg.storage_usage_percent,
    last_heartbeat_at: values.last_heartbeat_at.toISOString(),
  });
}

async function handleStatus(msg: DeviceStatusMessage) {
  await ensureDevice(msg.device_id);
  // status_changed_at ใช้เวลาที่ "เรารับรู้" ไม่ใช่เวลาในข้อความ
  // เพราะ payload ของ LWT ถูกกำหนดตั้งแต่ตอน connect จะใส่เวลาไปก็เป็นเวลาที่ต่อติด ไม่ใช่เวลาที่ตาย
  await db
    .update(devices)
    .set({ status: msg.status, status_changed_at: new Date() })
    .where(drizzleSql`${devices.device_id} = ${msg.device_id}`);

  liveEvents.emit("device", { device_id: msg.device_id, status: msg.status });
}

export function startIngest() {
  const client = mqtt.connect(BROKER_URL, {
    clientId: CLIENT_ID,
    // เก็บ session ไว้ฝั่ง broker — ข้อความ QoS 1 ที่ค้างตอนเรา restart จะถูกส่งซ้ำให้ครบ
    clean: false,
    reconnectPeriod: 2_000,
  });

  client.on("connect", () => {
    client.subscribe(meterTopics.all(), { qos: 1 }, (err) => {
      if (err) {
        console.error("[ingest] subscribe ล้มเหลว:", err.message);
        return;
      }
      console.log(`[ingest] ฟัง ${meterTopics.all()} ที่ ${BROKER_URL}`);
    });
  });

  client.on("error", (err) => console.error("[ingest] mqtt error:", err.message));
  client.on("close", () => console.warn("[ingest] หลุดจาก broker — จะลองต่อใหม่"));

  client.on("message", (topic, payload) => {
    // payload ว่าง = คนส่งกำลังล้าง retained ไม่ใช่ข้อความจริง
    if (payload.length === 0) return;
    stats.received += 1;

    void (async () => {
      try {
        const parsedTopic = parseTopic(topic);
        if (!parsedTopic) throw new Error("topic ไม่ตรงผัง");

        const result = inboundMessageSchema.safeParse(JSON.parse(payload.toString()));
        if (!result.success) {
          throw new Error(result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | "));
        }

        const msg = result.data;
        if (msg.device_id !== parsedTopic.deviceId) {
          throw new Error(`device_id ใน payload (${msg.device_id}) ไม่ตรงกับใน topic`);
        }

        if (msg.message_type === "meter_frame") await handleFrame(msg);
        else if (msg.message_type === "device_heartbeat") await handleHeartbeat(msg);
        else await handleStatus(msg);
      } catch (e) {
        // ข้อความเดียวพัง ต้องไม่ลาก process ลงไปด้วย — ไม่งั้น edge ที่ส่งของเสีย
        // ตัวเดียวจะทำให้ทั้งโรงงานหยุดเก็บข้อมูล
        stats.invalid += 1;
        console.error(`[ingest] ทิ้งข้อความจาก ${topic}: ${e instanceof Error ? e.message : e}`);
      }
    })();
  });

  return client;
}
