// ลบข้อมูลตั้งต้นสำหรับ dev ออกจาก DB ให้เหลือแต่ของจริง
//
//   bun run scripts/purge-dev-seed.ts          # ดูว่าจะลบอะไรบ้าง (ไม่ลบจริง)
//   bun run scripts/purge-dev-seed.ts --yes    # ลบจริง
//
// ทำไมต้องมีสคริปต์แทนที่จะ DELETE ด้วยมือ:
// `edge-01` เป็น device_id ที่ทั้ง seed ของเราและ edge จริงของทีม AI ใช้ตรงกัน
// การ `DELETE FROM devices WHERE device_id='edge-01'` จะ cascade กวาดข้อมูลจริงไปด้วยทั้งหมด
//
// สคริปต์นี้จึงลบตาม **รายชื่อ point_id ของ seed เท่านั้น** ซึ่งเป็นชุดที่รู้แน่ชัด
// แล้วค่อยเก็บกวาด device ที่ไม่เหลือจุดวัดเลย

import { inArray, eq, sql as raw } from "drizzle-orm";
import { db, sql } from "../src/db/index";
import { devices, points, readings } from "../src/db/schema";
import { DEV_DEVICES } from "../src/db/dev-inventory";

const APPLY = process.argv.includes("--yes");

const seedPointIds = DEV_DEVICES.flatMap((d) => d.points.map((p) => p.point_id));
const seedDeviceIds = DEV_DEVICES.map((d) => d.device_id);

const line = (s = "") => console.log(s);

line(`จุดวัดที่มาจาก seed: ${seedPointIds.length} ตัว`);

// ---- สำรวจก่อน ----
const existingSeedPoints = await db.select().from(points).where(inArray(points.point_id, seedPointIds));
const seedReadingRows = await db
  .select({ count: raw<number>`count(*)::int` })
  .from(readings)
  .where(inArray(readings.point_id, seedPointIds));
const seedReadingCount = seedReadingRows[0]?.count ?? 0;

line(`  พบใน DB จริง ${existingSeedPoints.length} ตัว · มี readings ผูกอยู่ ${seedReadingCount} แถว`);

if (existingSeedPoints.length === 0) {
  line("ไม่มีอะไรต้องลบ");
  await sql.end();
  process.exit(0);
}

if (!APPLY) {
  line();
  line("รายการที่จะถูกลบ:");
  for (const p of existingSeedPoints) line(`  - ${p.point_id}  (device ${p.device_id})`);
  line();
  line("ยังไม่ได้ลบอะไร — ใส่ --yes เพื่อลบจริง");
  await sql.end();
  process.exit(0);
}

// ---- ลบ ----
// readings ถูกลบตามด้วย FK cascade อยู่แล้ว ไม่ต้องสั่งเอง
const deleted = await db.delete(points).where(inArray(points.point_id, seedPointIds)).returning({ id: points.point_id });
line(`ลบจุดวัดไป ${deleted.length} ตัว (readings ที่ผูกอยู่ถูกลบตาม cascade)`);

// เก็บกวาด device ของ seed ที่ไม่เหลือจุดวัดแล้ว
// ตัวที่ยังมีจุดวัดเหลือ = มีของจริงอยู่ข้างใน ห้ามแตะ
for (const deviceId of seedDeviceIds) {
  const remaining = await db.select({ id: points.point_id }).from(points).where(eq(points.device_id, deviceId));
  if (remaining.length === 0) {
    await db.delete(devices).where(eq(devices.device_id, deviceId));
    line(`  ลบ device ${deviceId} (ไม่เหลือจุดวัด)`);
  } else {
    // ยังมีของจริงอยู่ — เอาแค่ชื่อปลอมออก ปล่อยให้ตั้งชื่อจริงทีหลัง
    await db.update(devices).set({ label: null }).where(eq(devices.device_id, deviceId));
    line(`  เก็บ device ${deviceId} ไว้ (มีจุดวัดจริง ${remaining.length} ตัว) — ล้างชื่อปลอมออกแล้ว`);
  }
}

// ---- เหลืออะไรบ้าง ----
line();
line("=== ที่เหลืออยู่ใน DB ===");
const restDevices = await db.select().from(devices);
for (const d of restDevices) {
  const pts = await db.select().from(points).where(eq(points.device_id, d.device_id));
  line(`${d.device_id}  status=${d.status}  label=${d.label ?? "(ยังไม่ตั้ง)"}  จุดวัด ${pts.length} ตัว`);
  for (const p of pts) {
    const scale = p.min_value !== null && p.max_value !== null ? `${p.min_value}–${p.max_value}` : "ยังไม่มีสเกล";
    line(`   - ${p.point_id.padEnd(28)} ${p.kind.padEnd(15)} ${String(p.unit ?? "-").padEnd(8)} ${scale}  enabled=${p.enabled}`);
  }
}

const totalRows = await db.select({ count: raw<number>`count(*)::int` }).from(readings);
const total = totalRows[0]?.count ?? 0;
line();
line(`readings ที่เหลือทั้งหมด: ${total} แถว`);

await sql.end();
