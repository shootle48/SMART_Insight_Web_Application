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

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";

// clientId ต้องคงที่ ไม่ผูกกับ pid — ไม่งั้น clean:false ไร้ความหมาย
// เพราะ broker จะมองว่าเป็น client คนละตัวทุกครั้งที่ restart แล้วทิ้งคิวเดิม
const CLIENT_ID = process.env.MQTT_CLIENT_ID ?? "meter-ingest";

let stats = { received: 0, invalid: 0, inserted: 0, duplicate: 0 };
export const ingestStats = () => ({ ...stats });

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
  await ensureDevice(frame.device_id);
  await ensurePoints(frame);

  const capturedAt = new Date(frame.captured_at);
  if (Number.isNaN(capturedAt.getTime())) {
    // Zod ตรวจแค่ว่าเป็น string ไม่ว่าง ไม่ได้ตรวจว่าแปลงเป็นวันที่ได้
    // ปล่อยผ่านไปจะได้ Invalid Date ลง DB ซึ่งพังตอน query ทีหลังแบบหาต้นตอยาก
    throw new Error(`captured_at แปลงเป็นวันที่ไม่ได้: ${frame.captured_at}`);
  }

  // onConflictDoNothing + returning: แถวที่ถูกกลืนเพราะซ้ำจะไม่กลับมา
  // จึงใช้ผลลัพธ์นี้แยกได้ว่าอันไหน "ใหม่จริง" ควรส่งขึ้นจอ อันไหนเป็นของซ้ำ
  const inserted = await db
    .insert(readings)
    .values(
      frame.readings.map((r) => ({
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
  stats.duplicate += frame.readings.length - inserted.length;

  if (inserted.length === 0) return; // ของซ้ำล้วน (retained ที่ส่งกลับมาตอน subscribe)

  await db
    .update(devices)
    .set({ last_frame_at: new Date() })
    .where(drizzleSql`${devices.device_id} = ${frame.device_id}`);

  const fresh = new Set(inserted.map((r) => r.point_id));
  const live: LiveReading[] = frame.readings
    .filter((r) => fresh.has(r.point_id))
    .map((r) => ({ ...r, device_id: frame.device_id, frame_id: frame.frame_id, captured_at: frame.captured_at }));

  liveEvents.emit("readings", live);
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
