// พิสูจน์ว่า retention ลบเฉพาะข้อมูลเก่าจริง ไม่กวาดของใหม่ไปด้วย
//
//   bun run smoke-retention        # ต้องมี postgres รันอยู่ (ไม่ต้องใช้ broker)
//
// ไม่ผ่าน startRetention() เพราะตัวนั้นหน่วง 60 วินาทีแล้ววนทุก 6 ชั่วโมง
// เรียก runRetention() ตรง ๆ เพื่อทดสอบตรรกะการลบอย่างเดียว

import { and, eq, like } from "drizzle-orm";
import { db, sql } from "../src/db/index";
import { devices, points, readings } from "../src/db/schema";
import { runRetention, retentionStatus, readingsFootprint } from "../src/server/retention";

const DEVICE = "smoke-ret";
const POINT = "smoke-ret-point";
const DAYS = Number(process.env.RETENTION_DAYS ?? 30);

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const cleanup = async () => {
  await db.delete(readings).where(like(readings.device_id, "smoke-ret%"));
  await db.delete(points).where(like(points.device_id, "smoke-ret%"));
  await db.delete(devices).where(like(devices.device_id, "smoke-ret%"));
};

await cleanup();
console.log(`ตั้งค่าเก็บย้อนหลัง ${DAYS} วัน · ${JSON.stringify(retentionStatus())}`);

await db.insert(devices).values({ device_id: DEVICE }).onConflictDoNothing();
await db
  .insert(points)
  .values({ point_id: POINT, device_id: DEVICE, camera_id: "smoke-cam", kind: "GAUGE" })
  .onConflictDoNothing();

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

// เก่าเกินเกณฑ์ 3 แถว / ยังไม่ถึงเกณฑ์ 3 แถว — รวมแถวที่อยู่ "ใกล้เส้น" ทั้งสองฝั่ง
// เพราะบั๊กแบบ off-by-one ของเงื่อนไขเวลาจะโผล่ตรงนี้เท่านั้น
const old = [DAYS + 10, DAYS + 1, DAYS + 0.5];
const fresh = [DAYS - 0.5, DAYS - 1, 0];

let n = 0;
for (const d of [...old, ...fresh]) {
  await db.insert(readings).values({
    point_id: POINT,
    device_id: DEVICE,
    frame_id: `ret-${++n}`,
    captured_at: daysAgo(d),
    value_num: d,
    unit: "bar",
    quality: "OK",
  });
}

const countMine = async () =>
  (await db.select().from(readings).where(eq(readings.device_id, DEVICE))).length;

check("ใส่ข้อมูลทดสอบครบ", (await countMine()) === 6, `ได้ ${await countMine()} แถว`);

const before = await readingsFootprint();
const deleted = await runRetention();
const after = await countMine();

check("ลบแถวที่เก่าเกินเกณฑ์", deleted >= 3, `runRetention คืน ${deleted}`);
check("เหลือเฉพาะแถวที่ยังไม่ถึงเกณฑ์", after === 3, `เหลือ ${after} แถว (คาดว่า 3)`);

// ตรวจให้ชัดว่าแถวที่รอดคือแถวที่ใหม่จริง ไม่ใช่รอดมั่ว
const survivors = await db
  .select({ v: readings.value_num })
  .from(readings)
  .where(and(eq(readings.device_id, DEVICE), eq(readings.quality, "OK")));
const survivorDays = survivors.map((s) => s.v).sort((a, b) => (a ?? 0) - (b ?? 0));
check(
  "แถวที่รอดคือแถวใหม่ทั้งหมด",
  survivorDays.every((d) => (d ?? 0) < DAYS),
  `อายุที่เหลือ (วัน): ${survivorDays.join(", ")}`,
);

console.log(`\nขนาดตาราง readings: ${before.pretty} → ${(await readingsFootprint()).pretty}`);

await cleanup();
console.log(failed === 0 ? "✅ ผ่านครบ" : `❌ ไม่ผ่าน ${failed} ข้อ`);
await sql.end();
process.exit(failed === 0 ? 0 : 1);
