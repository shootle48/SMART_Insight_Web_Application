// จุดวัด (point) = หน้าปัดหนึ่งหน้าที่เราสั่งให้ AI อ่าน
//
// คำศัพท์ทั้งหมดในไฟล์นี้ยกมาจากของจริงที่ใช้ทำ bench แล้ว — `../../bench/samples.json`
// (`cx, cy, r, min_angle, max_angle, min_value, max_value, unit`) ไม่ได้คิดขึ้นใหม่
// เพื่อให้ฝั่ง AI ที่เขียน gauge_bench.py อ่านแล้วเข้าใจตรงกันทันที
//
// ทิศทาง: **เราเป็นคนนิยาม แล้ว push ลงไปที่ edge** (ยังไม่ได้ทำ — ดู OPEN-3 ใน messages.ts)

import { z } from "zod";

export const pointKindSchema = z.enum([
  "GAUGE", // หน้าปัดเข็ม — สอบเทียบด้วยจุดศูนย์กลาง+รัศมี+ช่วงมุม
  "SEVEN_SEGMENT", // จอตัวเลข 7 ส่วน — สอบเทียบด้วยกรอบสี่เหลี่ยม
  "LAMP", // ไฟสถานะ — อ่านออกมาเป็นสี/สถานะ ไม่ใช่ตัวเลข
]);
export type PointKind = z.infer<typeof pointKindSchema>;

/** กรอบสี่เหลี่ยมบนภาพจากกล้อง หน่วยเป็น pixel ของภาพเต็ม */
export const bboxSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

// สอบเทียบหน้าปัดเข็ม — โครงเดียวกับ record ใน bench/samples.json เป๊ะ
export const gaugeFixtureSchema = z.object({
  kind: z.literal("GAUGE"),
  cx: z.number(), // จุดศูนย์กลางหน้าปัด (px)
  cy: z.number(),
  r: z.number().positive(), // รัศมี (px)
  min_angle: z.number(), // มุมของขีดต่ำสุด (เรเดียน, atan2 mod 2π)
  max_angle: z.number(), // มุมของขีดสูงสุด
  min_value: z.number(), // ค่าที่ขีดต่ำสุด — ติดลบได้ (ของจริงมี -5.0 และ -1.0)
  max_value: z.number(), // ค่าที่ขีดสูงสุด — เล็กมากได้ (ของจริงมี 0.099)
});

export const sevenSegmentFixtureSchema = z.object({
  kind: z.literal("SEVEN_SEGMENT"),
  bbox: bboxSchema,
  decimals: z.number().int().min(0).max(4), // ตำแหน่งทศนิยมที่คาดหวัง
});

export const lampFixtureSchema = z.object({
  kind: z.literal("LAMP"),
  bbox: bboxSchema,
  states: z.array(z.string().min(1)).min(2), // เช่น ["OFF","GREEN","RED"]
});

export const pointFixtureSchema = z.discriminatedUnion("kind", [
  gaugeFixtureSchema,
  sevenSegmentFixtureSchema,
  lampFixtureSchema,
]);
export type PointFixture = z.infer<typeof pointFixtureSchema>;

export const pointConfigSchema = z.object({
  point_id: z.string().min(1),
  device_id: z.string().min(1),
  camera_id: z.string().min(1),
  label: z.string().min(1), // ชื่อที่คนอ่าน เช่น "แรงดันหม้อไอน้ำ"
  // ของจริงใน samples.json ใช้ "-" แทนไม่มีหน่วย — ฝั่งเราใช้ null ให้ชัดกว่า
  unit: z.string().min(1).nullable(),
  fixture: pointFixtureSchema,
});
export type PointConfig = z.infer<typeof pointConfigSchema>;

// ⚠️ ตั้งใจไม่ validate ว่าค่าที่อ่านได้ต้องอยู่ใน [min_value, max_value]
// ของจริงใน bench/samples.json มีเคสที่ truth อยู่นอกช่วง (min 0.0 / max 0.099 / truth 0.2)
// เข็มชี้เลยสุดสเกลเป็นเรื่องปกติ และ "ค่าเกินสเกล" คือข้อมูลที่ฝ่ายผลิตอยากเห็นที่สุด
// การ reject ทิ้งเท่ากับกลบสัญญาณผิดปกติ
