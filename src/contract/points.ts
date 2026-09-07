// จุดวัด (point) = หน้าปัดหนึ่งหน้าที่เราสั่งให้ AI อ่าน
//
// พิกัดทั้งหมดในไฟล์นี้เป็น**เศษส่วน 0–1 ของขนาดภาพเต็ม** ไม่ใช่ pixel ตรง ๆ (D-018,
// เปลี่ยนจากโมเดล cx/cy/r/min_angle/max_angle เดิมตามฟีดแบ็กทีม AI 2026-09-07) —
// px ผูกกับ resolution กล้องเป๊ะ เปลี่ยนกล้อง/ปรับความละเอียดแล้ว fixture เดิมพังทันที
// เศษส่วนไม่ผูกกับ resolution ใด ๆ เลย
//
// ทิศทาง: **เราเป็นคนนิยาม แล้ว push ลงไปที่ edge** ผ่าน topic `config/<point_id>`
// (retained) — ดู `docs/CALIBRATION-PROPOSAL.md`

import { z } from "zod";

export const pointKindSchema = z.enum([
  "GAUGE", // หน้าปัดเข็ม — สอบเทียบด้วยจุดอ้างอิงบนภาพ (ตำแหน่ง+ค่าจริง) อย่างน้อย 2 จุด
  "SEVEN_SEGMENT", // จอตัวเลข 7 ส่วน — สอบเทียบด้วยกรอบสี่เหลี่ยม
  "WATER_METER", // มิเตอร์น้ำ — อ่านออกมาเป็นข้อความ (เช่นเลขนับ) ยังไม่มี fixture schema ของตัวเอง
]);
export type PointKind = z.infer<typeof pointKindSchema>;

/** กรอบสี่เหลี่ยมบนภาพจากกล้อง — x,y,w,h เป็นเศษส่วน 0–1 ของขนาดภาพเต็ม (มุมบนซ้าย+กว้าง/สูง) */
export const bboxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  // ตรวจได้ทันทีตอนนี้เพราะเป็นเศษส่วนแล้ว (ตอนเป็น px ตรวจไม่ได้จนกว่าจะรู้ resolution จริง)
  .refine((v) => v.x + v.w <= 1, { message: "กรอบล้นขอบขวาของภาพ (x + w ต้อง ≤ 1)", path: ["w"] })
  .refine((v) => v.y + v.h <= 1, { message: "กรอบล้นขอบล่างของภาพ (y + h ต้อง ≤ 1)", path: ["h"] });

/** จุดอ้างอิงหนึ่งจุดบนภาพ — ตำแหน่งเป็นเศษส่วน 0–1 + ค่าจริงของหน้าปัด ณ ตำแหน่งนั้น */
export const calibrationPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  value: z.number(),
});

// สอบเทียบหน้าปัดเข็มด้วยจุดอ้างอิง (D-018) — ไม่ผูกกับรูปทรงวงกลม/มุมเชิงเส้นเหมือนเดิม
// โมเดล AI เป็นคนตีความ (interpolate) ตอนอ่านค่าจริง เราแค่เก็บ+relay จุดที่คนกำหนดไว้
export const gaugeFixtureSchema = z.object({
  kind: z.literal("GAUGE"),
  // อย่างน้อย 2 จุดพอสำหรับ fit เส้นตรง ; ใส่ 3+ ได้ถ้าต้องการรองรับสเกลไม่เชิงเส้น
  // (ไม่ validate ว่าจุดที่ให้มา "สมเหตุสมผล" ทางเรขาคณิต — เป็นหน้าที่โมเดล AI ตอนอ่านค่า)
  calibration: z.array(calibrationPointSchema).min(2, "ต้องมีจุดอ้างอิงอย่างน้อย 2 จุด"),
});
// ⚠️ ตั้งใจไม่มี min_value/max_value ในนี้ ต่างจาก record ใน bench/samples.json
// สเกลของหน้าปัด (อ่านได้ถึงเท่าไหร่) กับตำแหน่งเข็มในภาพ เป็นคนละเรื่องที่เปลี่ยนคนละจังหวะ:
// ขยับกล้อง → fixture เปลี่ยน แต่สเกลเท่าเดิม ; เปลี่ยนตัวมิเตอร์ → สเกลเปลี่ยน แต่กล้องเท่าเดิม
// รวมไว้ด้วยกันจะทำให้ตั้งกล้องใหม่ทีต้องกรอกสเกลใหม่ทุกครั้ง

export const sevenSegmentFixtureSchema = z.object({
  kind: z.literal("SEVEN_SEGMENT"),
  bbox: bboxSchema,
  decimals: z.number().int().min(0).max(4), // ตำแหน่งทศนิยมที่คาดหวัง
});

// WATER_METER ยังไม่มี fixture schema ของตัวเอง — ตอนนี้จุดชนิดนี้ยังไม่มีการสอบเทียบ
// กล้อง (fixture) ให้ตั้ง ต้องเป็น null เสมอ เพิ่มทีหลังเมื่อรู้ว่าจะสอบเทียบด้วยอะไร
// (bbox แบบ SEVEN_SEGMENT? หรือแบบอื่น — ยังไม่มีข้อมูลพอตัดสิน)

export const pointFixtureSchema = z.discriminatedUnion("kind", [
  gaugeFixtureSchema,
  sevenSegmentFixtureSchema,
]);
export type PointFixture = z.infer<typeof pointFixtureSchema>;

export const pointConfigSchema = z.object({
  point_id: z.string().min(1),
  device_id: z.string().min(1),
  camera_id: z.string().min(1),
  label: z.string().min(1), // ชื่อที่คนอ่าน เช่น "แรงดันหม้อไอน้ำ"
  // ของจริงใน samples.json ใช้ "-" แทนไม่มีหน่วย — ฝั่งเราใช้ null ให้ชัดกว่า
  unit: z.string().min(1).nullable(),

  // สเกลที่หน้าปัดอ่านได้ — ใช้วาดเกจ/ตรวจ "เกินสเกล" เท่านั้น ไม่เกี่ยวกับ fixture
  // (fixture คือจุดอ้างอิงบนภาพ ดู gaugeFixtureSchema)
  // null ได้สำหรับจุดที่ไม่มีสเกล (เช่น WATER_METER ที่อ่านเป็นข้อความ) หรือจุดที่ยังไม่มีคนตั้งค่า
  min_value: z.number().nullable(),
  max_value: z.number().nullable(),

  fixture: pointFixtureSchema.nullable(),
});
export type PointConfig = z.infer<typeof pointConfigSchema>;

// ⚠️ ตั้งใจไม่ validate ว่าค่าที่อ่านได้ต้องอยู่ใน [min_value, max_value]
// ของจริงใน bench/samples.json มีเคสที่ truth อยู่นอกช่วง (min 0.0 / max 0.099 / truth 0.2)
// เข็มชี้เลยสุดสเกลเป็นเรื่องปกติ และ "ค่าเกินสเกล" คือข้อมูลที่ฝ่ายผลิตอยากเห็นที่สุด
// การ reject ทิ้งเท่ากับกลบสัญญาณผิดปกติ
