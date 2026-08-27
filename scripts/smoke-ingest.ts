// พิสูจน์พฤติกรรมของ ingest จริง ๆ (done-when ของ T-004)
//
//   bun run smoke-ingest        # ต้องมี broker + postgres รันอยู่
//
// เรียก startIngest() ในตัวเองแล้ว publish เข้าไปตรง ๆ จึงไม่ต้องเปิด HTTP server
// ใช้ id ที่ขึ้นต้นด้วย smoke- ทั้งหมด แล้วลบทิ้งตอนจบ ไม่ปนกับข้อมูล dev

import mqtt from "mqtt";
import { eq, like } from "drizzle-orm";
import { db, sql } from "../src/db/index";
import { devices, points, readings } from "../src/db/schema";
import { meterTopics, type MeterFrameMessage } from "../src/contract";
import { startIngest, ingestStats } from "../src/server/ingest/index";

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const DEVICE = "smoke-edge";
const POINT = "smoke-pt-pressure";
const UNKNOWN_POINT = "smoke-pt-ยังไม่รู้จัก";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed += 1;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const cleanup = async () => {
  await db.delete(readings).where(like(readings.device_id, "smoke-%"));
  await db.delete(points).where(like(points.device_id, "smoke-%"));
  await db.delete(devices).where(like(devices.device_id, "smoke-%"));
};

const frame = (frameId: string, pointId: string, overrides: Partial<MeterFrameMessage> = {}): MeterFrameMessage => ({
  message_type: "meter_frame",
  device_id: DEVICE,
  camera_id: "smoke-cam",
  frame_id: frameId,
  captured_at: new Date().toISOString(),
  readings: [
    {
      point_id: pointId,
      kind: "GAUGE",
      value_num: 1.23,
      value_text: null,
      unit: "bar",
      confidence: 0.95,
      quality: "OK",
    },
  ],
  ...overrides,
});

await cleanup();

const before = ingestStats();
startIngest();
const pub = mqtt.connect(BROKER_URL, { clientId: `smoke-ingest-pub-${process.pid}` });
await new Promise<void>((resolve) => pub.once("connect", () => resolve()));
const send = (topic: string, payload: string) =>
  new Promise<void>((resolve) => pub.publish(topic, payload, { qos: 1 }, () => resolve()));

const topic = meterTopics.frame(DEVICE);
await wait(1_500); // ให้ ingest subscribe ให้เสร็จก่อน

// ---- 1. เฟรมปกติต้องถูกเก็บ + เครื่อง/จุดวัดที่ไม่รู้จักต้องถูกสร้างให้ ----------
await send(topic, JSON.stringify(frame("smoke-f1", POINT)));
await wait(1_500);

const [dev] = await db.select().from(devices).where(eq(devices.device_id, DEVICE));
check("สร้าง device ที่ไม่รู้จักให้อัตโนมัติ", Boolean(dev));

const [pt] = await db.select().from(points).where(eq(points.point_id, POINT));
check("สร้าง point ที่ไม่รู้จักให้อัตโนมัติ", Boolean(pt));
check("point ที่สร้างเองต้อง enabled=false (ยังไม่มีคนยืนยัน)", pt?.enabled === false);
check("point ที่สร้างเองต้อง fixture=null (รอคนมาเติม)", pt?.fixture === null);

let rows = await db.select().from(readings).where(eq(readings.device_id, DEVICE));
check("เก็บ reading ได้ 1 แถว", rows.length === 1, `ได้ ${rows.length}`);

// ---- 2. ส่งเฟรมเดิมซ้ำ ต้องไม่เพิ่มแถว ------------------------------------------
// จำลองทั้งกรณี QoS 1 ส่งซ้ำ และ retained ที่ถูกส่งกลับมาตอน subscribe ใหม่
await send(topic, JSON.stringify(frame("smoke-f1", POINT)));
await send(topic, JSON.stringify(frame("smoke-f1", POINT)));
await wait(1_500);
rows = await db.select().from(readings).where(eq(readings.device_id, DEVICE));
check("ส่งซ้ำแล้วไม่เพิ่มแถว (idempotent)", rows.length === 1, `ได้ ${rows.length}`);

// ---- 3. UNREADABLE ต้องเก็บเป็น null ไม่ใช่ 0 ----------------------------------
await send(
  topic,
  JSON.stringify(
    frame("smoke-f2", POINT, {
      readings: [
        { point_id: POINT, kind: "GAUGE", value_num: null, value_text: null, unit: "bar", confidence: null, quality: "UNREADABLE" },
      ],
    }),
  ),
);
await wait(1_500);
const [unreadable] = await db.select().from(readings).where(eq(readings.quality, "UNREADABLE"));
check("UNREADABLE เก็บ value_num เป็น null ไม่ใช่ 0", unreadable?.value_num === null, `ได้ ${JSON.stringify(unreadable?.value_num)}`);

// ---- 4. จุดวัดที่ไม่เคยเห็นในเฟรมใหม่ ก็ต้องถูกสร้างให้ ------------------------
await send(topic, JSON.stringify(frame("smoke-f3", UNKNOWN_POINT)));
await wait(1_500);
const [newPt] = await db.select().from(points).where(eq(points.point_id, UNKNOWN_POINT));
check("จุดวัดใหม่กลางคันถูกสร้างให้ ไม่ทิ้งข้อมูล", Boolean(newPt));

// ---- 5. ข้อความเสียต้องไม่ทำให้ process ตาย ------------------------------------
// เคสที่เกิดจริงได้ทั้งหมด: JSON พัง / ถูกต้องตาม JSON แต่ผิดสัญญา / device_id ไม่ตรง topic
await send(topic, "{ นี่ไม่ใช่ json");
await send(topic, JSON.stringify({ message_type: "meter_frame", device_id: DEVICE }));
await send(topic, JSON.stringify(frame("smoke-f4", POINT, { device_id: "smoke-คนละเครื่อง" })));
await wait(1_500);

check("process ยังอยู่หลังเจอข้อความเสีย 3 แบบ", true);
const after = ingestStats();
check("นับข้อความเสียไว้ใน stats", after.invalid - before.invalid >= 3, `invalid +${after.invalid - before.invalid}`);
check("นับของซ้ำไว้ใน stats", after.duplicate - before.duplicate >= 2, `duplicate +${after.duplicate - before.duplicate}`);

// ---- 6. ข้อมูลดีที่ตามมาหลังข้อความเสีย ต้องยังเข้าได้ --------------------------
await send(topic, JSON.stringify(frame("smoke-f5", POINT)));
await wait(1_500);
rows = await db.select().from(readings).where(eq(readings.point_id, POINT));
check("ยังรับข้อมูลดีต่อได้หลังเจอของเสีย", rows.length === 3, `ได้ ${rows.length} (f1, f2, f5)`);

await cleanup();
console.log(`\nstats: ${JSON.stringify(after)}`);
console.log(failed === 0 ? "✅ ผ่านครบ" : `❌ ไม่ผ่าน ${failed} ข้อ`);
pub.end(true);
await sql.end();
process.exit(failed === 0 ? 0 : 1);
