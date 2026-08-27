// พิสูจน์ว่า throttle เก็บเฉพาะที่มีความหมาย และไม่กลืนสิ่งที่ห้ามกลืน
//
//   bun run smoke-throttle        # ต้องมี broker + postgres รันอยู่
//
// ค่า env ถูกตั้งไว้ใน package.json ให้สั้นลงเพื่อไม่ต้องรอนาน
// (ของจริง MIN_INTERVAL=1s / MAX_GAP=60s)

import mqtt from "mqtt";
import { eq, like } from "drizzle-orm";
import { db, sql } from "../src/db/index";
import { devices, points, readings } from "../src/db/schema";
import { meterTopics, type MeterFrameMessage, type PointReading } from "../src/contract";
import { startIngest, ingestStats } from "../src/server/ingest/index";

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const DEVICE = "smoke-thr";
const POINT = "smoke-thr-gauge";
const MIN_INTERVAL = Number(process.env.INGEST_MIN_INTERVAL_MS ?? 1000);

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed += 1;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cleanup = async () => {
  await db.delete(readings).where(like(readings.device_id, "smoke-thr%"));
  await db.delete(points).where(like(points.device_id, "smoke-thr%"));
  await db.delete(devices).where(like(devices.device_id, "smoke-thr%"));
};

const rows = async () => (await db.select().from(readings).where(eq(readings.point_id, POINT))).length;

await cleanup();

// สร้างจุดวัดพร้อมสเกลไว้ก่อน — ต้องมีสเกลตั้งแต่แรก ไม่งั้น deadband เป็น 0
// (สเกล 0–10, deadband 0.5% = 0.05)
await db.insert(devices).values({ device_id: DEVICE }).onConflictDoNothing();
await db
  .insert(points)
  .values({
    point_id: POINT,
    device_id: DEVICE,
    camera_id: "smoke-cam",
    kind: "GAUGE",
    unit: "bar",
    min_value: 0,
    max_value: 10,
    enabled: true,
  })
  .onConflictDoNothing();

startIngest();
const pub = mqtt.connect(BROKER_URL, { clientId: `smoke-thr-pub-${process.pid}` });
await new Promise<void>((r) => pub.once("connect", () => r()));

let seq = 0;
const send = (value: number | null, quality: PointReading["quality"] = "OK") => {
  const msg: MeterFrameMessage = {
    message_type: "meter_frame",
    device_id: DEVICE,
    camera_id: "smoke-cam",
    frame_id: `thr-${++seq}`,
    captured_at: new Date().toISOString(),
    readings: [
      {
        point_id: POINT,
        kind: "GAUGE",
        value_num: value,
        value_text: null,
        unit: "bar",
        confidence: value === null ? null : 0.95,
        quality,
      },
    ],
  };
  return new Promise<void>((r) =>
    pub.publish(meterTopics.frame(DEVICE), JSON.stringify(msg), { qos: 1 }, () => r()),
  );
};

await wait(1_500); // ให้ ingest subscribe เสร็จ

// ---- 1. เฟรมแรกต้องเก็บเสมอ ----
await send(5.0);
await wait(1_200);
check("เฟรมแรกถูกเก็บ", (await rows()) === 1, `ได้ ${await rows()} แถว`);

// ---- 2. ยิงรัวด้วยค่าที่แทบไม่ขยับ → ต้องไม่เพิ่มแถว ----
// จำลองพฤติกรรมจริงของ edge: 26 เฟรม/วิ ที่ค่าเดิม ๆ
const before = ingestStats().throttled;
for (let i = 0; i < 15; i++) await send(5.0 + i * 0.001); // ขยับรวม 0.015 < deadband 0.05
await wait(1_500);
check("ยิงรัว 15 เฟรมที่ค่าแทบไม่ขยับ → ไม่เพิ่มแถว", (await rows()) === 1, `ได้ ${await rows()} แถว`);
check("นับที่ถูกกรองไว้ใน stats", ingestStats().throttled - before >= 14, `+${ingestStats().throttled - before}`);

// ---- 3. ค่าขยับเกิน deadband → ต้องเก็บ ----
await wait(MIN_INTERVAL);
await send(8.0);
await wait(1_200);
check("ค่าขยับเกิน deadband → เก็บ", (await rows()) === 2, `ได้ ${await rows()} แถว`);

// ---- 4. 🔴 สถานะเปลี่ยนต้องเก็บทันที แม้ยังไม่พ้นเพดานเวลา ----
// ข้อนี้สำคัญที่สุดในไฟล์: OK→UNREADABLE คือเหตุการณ์ ไม่ใช่ค่าซ้ำ
// ถ้าถูกกลืนเพราะ "ยิงถี่เกินไป" คนดูจะไม่มีวันรู้ว่าเคยอ่านไม่ออก
await send(null, "UNREADABLE");
await wait(1_200);
check("สถานะเปลี่ยน OK→UNREADABLE เก็บทันทีแม้ยิงติดกัน", (await rows()) === 3, `ได้ ${await rows()} แถว`);

const [unreadable] = await db
  .select()
  .from(readings)
  .where(eq(readings.quality, "UNREADABLE"))
  .limit(1);
check("UNREADABLE ที่เก็บมี value_num เป็น null", unreadable?.value_num === null);

// ---- 5. กลับมาอ่านได้ ก็ต้องเก็บทันทีเช่นกัน ----
await send(8.05, "OK"); // ขยับแค่ 0.05 แต่สถานะเปลี่ยนกลับ
await wait(1_200);
check("สถานะเปลี่ยนกลับ UNREADABLE→OK เก็บทันที", (await rows()) === 4, `ได้ ${await rows()} แถว`);

// ---- สรุปอัตราการบีบ ----
const st = ingestStats();
const total = st.inserted + st.throttled;
const pct = total > 0 ? ((st.throttled / total) * 100).toFixed(1) : "0";
console.log(`\nบีบทิ้งไป ${st.throttled}/${total} = ${pct}%  (config: ${JSON.stringify({ min: st.min_interval_ms, deadband: st.deadband_pct, gap: st.max_gap_ms })})`);

await cleanup();
console.log(failed === 0 ? "✅ ผ่านครบ" : `❌ ไม่ผ่าน ${failed} ข้อ`);
pub.end(true);
await sql.end();
process.exit(failed === 0 ? 0 : 1);
