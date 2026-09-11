// ตัดสินว่าค่าของจุดวัด "ผิดปกติ" หรือไม่ (D-023 / T-024)
//
// กติกาที่สำคัญที่สุด 3 ข้อ — ทุกข้อมีเหตุผลจากของจริงในโปรเจกต์นี้ ไม่ใช่ความรอบคอบลอย ๆ:
//
//   1. **เปลี่ยนสถานะเฉพาะเมื่อเห็นค่านอก/ในเกณฑ์ติดกัน N ครั้ง** (ALARM_CONFIRM_READINGS)
//      โมเดล OCR อ่านพลาดได้ (UNREADABLE ยัง 47%) — ค่าเพี้ยนวูบเดียวเช่น 999 จากการอ่านผิด
//      ไม่ควรปลุกทั้งโรงงาน ; และยังกันค่าที่แกว่งรอบขอบเกณฑ์ (99.9 ↔ 100.1) ไม่ให้เด้งรัว
//
//   2. **นับจากทุก reading ที่เข้ามา ไม่ใช่เฉพาะที่ถูกเก็บลง DB**
//      throttle จะกรองค่าที่นิ่งใน deadband ทิ้ง — ค่าที่ค้างอยู่ที่ 160 (เกิน 150) จะถูกเก็บ
//      แค่ครั้งแรกแล้วเงียบ ถ้านับเฉพาะที่เก็บจะไม่มีวันถึง N
//
//   3. **UNREADABLE ไม่ประเมิน ไม่นับ ไม่รีเซ็ต** — "ตรวจไม่ได้ ≠ ของเสีย" (ARCHITECTURE)
//      สถานะค้างที่ค่าล่าสุดจนกว่าจะอ่านออกอีกครั้ง ; ผลข้างเคียงที่ยอมรับใน D-023 คือถ้าอ่าน
//      ไม่ออกยาว ๆ สถานะอาจไม่ตรงความจริงแล้ว — UI ต้องดู "ค่าเก่า" คู่กันเสมอ
//
// state ในหน่วยความจำนี้ **seed จาก DB ตอนเห็นจุดครั้งแรก** เพื่อให้ restart server แล้ว
// ไม่เด้งซ้ำสำหรับจุดที่ผิดปกติอยู่แล้ว (เหตุผลที่เลือกเก็บสถานะลง DB ตั้งแต่แรก — D-023)

import type { ReadingQuality } from "../../contract";

export type AlarmState = "OK" | "ALARM";

export type AlarmThresholds = {
  low: number | null;
  high: number | null;
  /** สถานะที่ DB จำไว้ — ใช้ seed ครั้งแรกเท่านั้น หลังจากนั้นหน่วยความจำเป็นตัวจริง */
  state: AlarmState | null;
};

export type AlarmTransition = {
  point_id: string;
  from: AlarmState | null;
  to: AlarmState | null;
  /** ค่าที่ทำให้เปลี่ยน (null เมื่อเปลี่ยนเพราะถอนเกณฑ์) */
  value: number | null;
};

const CONFIRM = Math.max(1, Number(process.env.ALARM_CONFIRM_READINGS ?? 3) || 3);
export const alarmConfig = { confirm_readings: CONFIRM };

type Mem = {
  state: AlarmState | null;
  /** สถานะที่กำลังสะสมหลักฐานจะเปลี่ยนไป + นับติดกันได้กี่ครั้งแล้ว */
  pending: AlarmState | null;
  streak: number;
};
const mem = new Map<string, Mem>();

const hasThresholds = (t: AlarmThresholds): t is AlarmThresholds & { low: number; high: number } =>
  t.low !== null && t.high !== null;

/**
 * ประเมินหนึ่ง reading — คืน transition เมื่อสถานะ**เปลี่ยน**เท่านั้น ไม่งั้น null
 *
 * ฟังก์ชันนี้ตั้งใจให้ sync ล้วน ไม่มี await — ถูกเรียกในลูปที่ห้ามมี await คั่น
 * (ดูเหตุผลใน ingest/index.ts เรื่อง throttle ที่เคยพังเพราะ await แทรก)
 */
export function evaluateAlarm(
  pointId: string,
  value: number | null,
  quality: ReadingQuality,
  thresholds: AlarmThresholds,
): AlarmTransition | null {
  let m = mem.get(pointId);
  if (!m) {
    m = { state: thresholds.state, pending: null, streak: 0 };
    mem.set(pointId, m);
  }

  // ถอนเกณฑ์ออก (T-026 อนุญาตให้เว้นว่าง = ไม่เตือน) → เคลียร์สถานะทันที ไม่ต้องรอ N
  if (!hasThresholds(thresholds)) {
    if (m.state === null) return null;
    const from = m.state;
    m.state = null;
    m.pending = null;
    m.streak = 0;
    return { point_id: pointId, from, to: null, value: null };
  }

  // กติกาข้อ 3 — อ่านไม่ออก / ไม่มีตัวเลข: ไม่แตะอะไรทั้งนั้น
  if (quality === "UNREADABLE" || value === null || !Number.isFinite(value)) return null;

  const observed: AlarmState = value < thresholds.low || value > thresholds.high ? "ALARM" : "OK";

  if (observed === m.state) {
    // กลับมาตรงกับสถานะเดิม → หลักฐานที่สะสมไว้เป็นแค่ค่าวูบ ทิ้ง
    m.pending = null;
    m.streak = 0;
    return null;
  }

  if (m.pending === observed) {
    m.streak += 1;
  } else {
    m.pending = observed;
    m.streak = 1;
  }

  if (m.streak < CONFIRM) return null;

  const from = m.state;
  m.state = observed;
  m.pending = null;
  m.streak = 0;
  return { point_id: pointId, from, to: observed, value };
}

/** ใช้ตอนเทส/ล้าง — ไม่ควรมีใครเรียกใน production path */
export function resetAlarmMemory() {
  mem.clear();
}
