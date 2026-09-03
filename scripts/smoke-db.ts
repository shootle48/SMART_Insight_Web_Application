// พิสูจน์พฤติกรรมของ schema ที่สำคัญจริง ๆ (done-when ของ T-003)
//
//   bun run scripts/smoke-db.ts
//
// ไม่ใช่แค่ "ตารางสร้างได้" — ตรวจข้อที่ถ้าผิดแล้วข้อมูลจะเพี้ยนแบบเงียบ ๆ
// ทุกเคสเขียนแล้วลบทิ้ง ไม่ทิ้งขยะไว้ใน DB

import { eq, and, inArray } from "drizzle-orm";
import { db, sql } from "../src/db/index";
import { devices, points, readings } from "../src/db/schema";
import { DEV_DEVICES, DEV_POINT_COUNT } from "../src/db/dev-inventory";

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const FRAME = "frm-smoke-test";
// เคส 4 (ทศนิยมละเอียด) ต้องคนละ frame_id กับเคส 3 (ค่านอกสเกล) — จุดเดียวกัน
// (pt-c-clearance) ถ้าใช้ frame_id เดียวกันจะชน unique constraint (point_id, frame_id)
// ทันที เพราะรับรู้กันว่าเป็นแถวซ้ำ ทั้งที่ตั้งใจให้เป็นคนละเฟรม
const FRAME2 = "frm-smoke-test-2";

// เก็บกวาดของรอบก่อน เผื่อรอบที่แล้วตายกลางคัน
await db.delete(readings).where(eq(readings.frame_id, FRAME));
await db.delete(readings).where(eq(readings.frame_id, FRAME2));

// ---- 1. seed ลงครบไหม -----------------------------------------------------
const deviceRows = await db.select().from(devices);
const pointRows = await db.select().from(points);
check("seed ใส่เครื่องครบ", deviceRows.length >= DEV_DEVICES.length, `${deviceRows.length}/${DEV_DEVICES.length}`);
check("seed ใส่จุดวัดครบ", pointRows.length >= DEV_POINT_COUNT, `${pointRows.length}/${DEV_POINT_COUNT}`);

// ---- 2. UNREADABLE ต้องเก็บเป็น null ไม่ใช่ 0 ------------------------------
// ข้อนี้สำคัญที่สุดในไฟล์นี้: 0 เป็นค่าที่อ่านได้จริงในเกือบทุกสเกล
// ถ้าที่ไหนแปลง null เป็น 0 กราฟจะโชว์ "ค่าตก" ทั้งที่ความจริงคือ "อ่านไม่ออก"
await db.insert(readings).values({
  point_id: "pt-a-boiler-pressure",
  device_id: "edge-01",
  frame_id: FRAME,
  captured_at: new Date(),
  value_num: null,
  value_text: null,
  unit: "bar",
  confidence: null,
  quality: "UNREADABLE",
});

const [unreadable] = await db
  .select()
  .from(readings)
  .where(and(eq(readings.frame_id, FRAME), eq(readings.quality, "UNREADABLE")));

check("UNREADABLE เก็บ value_num เป็น null", unreadable?.value_num === null, `ได้ ${JSON.stringify(unreadable?.value_num)}`);
check("UNREADABLE เก็บ confidence เป็น null", unreadable?.confidence === null);

// ---- 3. ค่านอกสเกลต้องเก็บได้ ---------------------------------------------
// bench/samples.json มีเคสจริงที่ truth อยู่นอก [min,max] (0..0.099 แต่ truth 0.2)
// เข็มชี้เลยสุดสเกลคือสัญญาณผิดปกติที่ฝ่ายผลิตอยากเห็นที่สุด ห้าม reject ทิ้ง
await db.insert(readings).values({
  point_id: "pt-c-clearance",
  device_id: "edge-03",
  frame_id: FRAME,
  captured_at: new Date(),
  value_num: 0.2, // สเกลจริงคือ 0..0.099
  unit: "mm",
  confidence: 0.91,
  quality: "OK",
});
const [outOfRange] = await db
  .select()
  .from(readings)
  .where(and(eq(readings.frame_id, FRAME), eq(readings.point_id, "pt-c-clearance")));
check("ค่านอกสเกลเก็บได้ ไม่ถูก reject", outOfRange?.value_num === 0.2, `ได้ ${outOfRange?.value_num}`);

// ---- 4. ทศนิยมความละเอียดสูงต้องไม่ถูกปัดทิ้ง -----------------------------
// สเกล 0..0.099 ถ้าคอลัมน์เป็น real แทน double precision ค่าจะเพี้ยนตั้งแต่หลักที่ 7
await db.insert(readings).values({
  point_id: "pt-c-clearance",
  device_id: "edge-03",
  frame_id: FRAME2,
  captured_at: new Date(Date.now() + 1),
  value_num: 0.0987654321,
  unit: "mm",
  quality: "OK",
});
const [precise] = await db
  .select()
  .from(readings)
  .where(and(eq(readings.frame_id, FRAME2), eq(readings.point_id, "pt-c-clearance")));
check("ทศนิยมละเอียดไม่ถูกปัด", precise?.value_num === 0.0987654321, `ได้ ${precise?.value_num}`);

// ---- 5. received_at ต้องเติมเองโดยไม่ต้องส่งมา ----------------------------
// ใช้จับ clock drift ของ edge (OPEN-5) ถ้าลืมเติมจะไม่มีอะไรเทียบ
check("received_at ถูกเติมอัตโนมัติ", unreadable?.received_at instanceof Date);

// ---- 6. point_id ที่ไม่รู้จักต้องถูกปฏิเสธ ---------------------------------
// ไม่ใช่ข้อบกพร่อง แต่เป็นสัญญาที่ ingest ต้องรับมือ: เจอจุดที่ไม่รู้จักให้สร้าง
// แถวใน points ก่อน (enabled=false) แล้วค่อยเขียน reading — ห้ามทิ้งค่าที่อ่านมาได้แล้ว
let rejected = false;
try {
  await db.insert(readings).values({
    point_id: "pt-ไม่มีจริง",
    device_id: "edge-01",
    frame_id: FRAME,
    captured_at: new Date(),
    value_num: 1,
    quality: "OK",
  });
} catch {
  rejected = true;
}
check("point_id ที่ไม่รู้จักถูก FK ปฏิเสธ (ingest ต้องสร้าง point ก่อน)", rejected);

// ---- เก็บกวาด -------------------------------------------------------------
await db.delete(readings).where(eq(readings.frame_id, FRAME));
await db.delete(readings).where(eq(readings.frame_id, FRAME2));
const leftover = await db
  .select()
  .from(readings)
  .where(inArray(readings.frame_id, [FRAME, FRAME2]));
check("ลบข้อมูลทดสอบหมดแล้ว", leftover.length === 0);

console.log(failed === 0 ? "\n✅ ผ่านครบ" : `\n❌ ไม่ผ่าน ${failed} ข้อ`);
await sql.end();
process.exit(failed === 0 ? 0 : 1);
