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
  "GAUGE", // หน้าปัดเข็ม — **ชนิดเดียวที่ต้องสอบเทียบ** ด้วยจุดอ้างอิงบนภาพ อย่างน้อย 2 จุด
  "SEVEN_SEGMENT", // จอตัวเลข 7 ส่วน — โมเดลอ่านเอง ไม่มี fixture
  "WATER_METER", // มิเตอร์น้ำ — โมเดลอ่านเอง ไม่มี fixture
]);
export type PointKind = z.infer<typeof pointKindSchema>;

// 🔴 **calibration เหลือ GAUGE ชนิดเดียวถาวร** (T-020, ผู้ใช้ยืนยัน 2026-09-09)
// SEVEN_SEGMENT กับ WATER_METER อ่านค่าด้วย **โมเดล** ไม่ใช่ computer vision จึงไม่มี
// เรขาคณิตในภาพให้สอบเทียบ — ต่างจาก GAUGE ที่ต้องรู้ว่าเข็มชี้ตรงไหนถึงจะแปลงเป็นค่าได้
// `bboxSchema` กับ `sevenSegmentFixtureSchema` จึงถูกตัดออกที่นี่ (ครึ่งของ D-018 ที่ว่าด้วย
// bbox ตกไปด้วย ส่วนครึ่งที่ว่าด้วยจุดอ้างอิงของ GAUGE ยังอยู่)
// ⚠️ `SEVEN_SEGMENT`/`WATER_METER` ยังเป็น **ชนิดหน้าปัดที่ใช้งานอยู่** — ตัดแค่ fixture
// ไม่ได้ตัดชนิด อย่าเผลอลบออกจาก enum ข้างบน

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

// เหลือชนิดเดียวจึงไม่ต้องเป็น discriminatedUnion อีก — `kind: z.literal("GAUGE")` ใน
// gaugeFixtureSchema ทำหน้าที่ตรวจ discriminator ให้อยู่แล้ว ; ถ้าวันหนึ่งมีชนิดที่ต้อง
// สอบเทียบเพิ่มค่อยกลับมาเป็น union ตอนนั้น อย่าเผื่อไว้ล่วงหน้าโดยไม่มีของจริง
export const pointFixtureSchema = gaugeFixtureSchema;
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
