// ตัดสินใจว่า reading ที่เข้ามาควรเก็บลง DB ไหม
//
// ที่มา: วัดจากของจริงได้ 26 เฟรม/วินาที = 830 MB/วัน ต่อจุดวัดเดียว
// ต้นตอไม่ใช่ DB ช้า แต่คือเก็บค่าเดิมซ้ำ ๆ 25 ครั้งต่อวินาทีทิ้ง เข็มมิเตอร์ไม่ได้ขยับเร็วขนาดนั้น
//
// ใช้หลัก deadband compression แบบเดียวกับ historian อุตสาหกรรม:
// เก็บเมื่อ "มีอะไรเปลี่ยนจริง" ไม่ใช่เก็บทุกครั้งที่มีคนส่งมา
//
// ⚠️ สิ่งที่ห้ามทิ้งเด็ดขาดคือ **การเปลี่ยนสถานะ** (OK ↔ UNREADABLE)
// เพราะนั่นคือเหตุการณ์ ไม่ใช่ค่าซ้ำ — ถ้ากลืนหายไปคนดูจะไม่รู้ว่าเคยอ่านไม่ออก

import type { PointReading } from "../../contract/messages";

/** ไม่เก็บถี่กว่านี้ ต่อให้ค่าแกว่งแรงแค่ไหน */
const MIN_INTERVAL_MS = Number(process.env.INGEST_MIN_INTERVAL_MS ?? 1_000);

/**
 * เพดานสำหรับ "สถานะเปลี่ยน" — ถี่กว่าค่าปกติแต่ไม่ปล่อยไร้ขีดจำกัด
 *
 * ทำไมต้องมี: ถ้าโมเดลอ่านได้บ้างไม่ได้บ้างสลับกันเฟรมต่อเฟรม (ซึ่งเกิดจริง —
 * ของทีม AI อ่านไม่ออก 70%) กฎ "สถานะเปลี่ยน = เก็บเสมอ" จะทำให้ throttle
 * ไม่ช่วยอะไรเลย วัดได้ 6.3 แถว/วิ/จุด ทั้งที่ตั้งเพดานปกติไว้ 1 ครั้ง/วินาที
 *
 * 200ms ยังละเอียดพอให้เห็นว่า "กระพริบ" แต่จำกัดกรณีแย่สุดไว้ที่ 5 แถว/วิ/จุด
 * แทนที่จะไม่มีเพดานเลย ; การกระพริบถี่กว่านี้เป็นปัญหาที่ต้องแก้ที่ต้นทาง (กล้อง/แสง)
 * ไม่ใช่เรื่องที่ควรแก้ด้วยการเก็บข้อมูลให้เยอะขึ้น
 */
const QUALITY_MIN_INTERVAL_MS = Number(process.env.INGEST_QUALITY_MIN_INTERVAL_MS ?? 200);

/** ค่าต้องขยับเกินกี่ % ของสเกลถึงจะถือว่า "เปลี่ยนจริง" */
const DEADBAND_PCT = Number(process.env.INGEST_DEADBAND_PCT ?? 0.5);

/**
 * บังคับเก็บอย่างน้อยทุกเท่านี้แม้ไม่มีอะไรเปลี่ยน
 *
 * จำเป็นเพราะถ้าไม่มีจุดคั่น กราฟจะแยกไม่ออกระหว่าง "ค่านิ่งมาก" กับ "ไม่มีข้อมูลเข้ามาเลย"
 * ซึ่งสองอย่างนี้ความหมายต่างกันสิ้นเชิงสำหรับคนดูหน้างาน
 */
const MAX_GAP_MS = Number(process.env.INGEST_MAX_GAP_MS ?? 60_000);

type Scale = { min: number | null; max: number | null };

type LastStored = {
  at: number;
  value_num: number | null;
  value_text: string | null;
  quality: string;
};

const lastStored = new Map<string, LastStored>();

export type ThrottleDecision = { store: boolean; reason: string };

export function shouldStore(r: PointReading, scale: Scale, now: number): ThrottleDecision {
  const prev = lastStored.get(r.point_id);

  if (!prev) return { store: true, reason: "แถวแรกของจุดนี้" };

  const since = now - prev.at;

  // สถานะเปลี่ยน = เหตุการณ์ ไม่ใช่ค่าซ้ำ — สำคัญกว่าตัวเลข จึงใช้เพดานที่ถี่กว่ามาก
  // แต่ยังต้องมีเพดาน ไม่งั้นโมเดลที่กระพริบจะทำให้ throttle ไร้ผล (ดูคอมเมนต์ข้างบน)
  if (prev.quality !== r.quality) {
    return since >= QUALITY_MIN_INTERVAL_MS
      ? { store: true, reason: `คุณภาพเปลี่ยน ${prev.quality}→${r.quality}` }
      : { store: false, reason: "คุณภาพกระพริบถี่เกินเพดาน" };
  }

  if (since >= MAX_GAP_MS) return { store: true, reason: "ครบรอบบังคับเก็บ" };
  if (since < MIN_INTERVAL_MS) return { store: false, reason: "ถี่เกินเพดาน" };

  // ค่าที่เป็นข้อความ (เช่น WATER_METER) — เปลี่ยนเมื่อไหร่คือเปลี่ยนจริง ไม่มี deadband
  if (r.value_text !== null || prev.value_text !== null) {
    return r.value_text !== prev.value_text
      ? { store: true, reason: "ข้อความเปลี่ยน" }
      : { store: false, reason: "ข้อความเท่าเดิม" };
  }

  if (r.value_num === null || prev.value_num === null) {
    return { store: true, reason: "มี null ปนกับตัวเลข" };
  }

  // ไม่มีสเกล → deadband เป็น 0 คือเปลี่ยนนิดเดียวก็เก็บ (ยังติดเพดาน MIN_INTERVAL อยู่)
  // ดีกว่าเดาสเกลเอง เพราะเดาผิดแล้วจะกลืนค่าที่เปลี่ยนจริงหายไป
  const span = scale.min !== null && scale.max !== null ? Math.abs(scale.max - scale.min) : 0;
  const deadband = (span * DEADBAND_PCT) / 100;

  const delta = Math.abs(r.value_num - prev.value_num);
  return delta > deadband
    ? { store: true, reason: `ขยับ ${delta.toFixed(4)} > deadband ${deadband.toFixed(4)}` }
    : { store: false, reason: "อยู่ใน deadband" };
}

/**
 * เรียก "ทันทีที่ตัดสินใจว่าจะเก็บ" ไม่ใช่หลัง insert สำเร็จ
 *
 * เพราะระหว่างรอ insert มี await คั่น เฟรมอื่นแทรกเข้ามาอ่าน state เก่าได้
 * แล้วตัดสินว่าเก็บพร้อมกันหมด ทำให้เพดานอัตราไม่ทำงานตอนยิงรัว
 * ยอมแลกว่าถ้า insert ล้ม จุดนั้นจะถูกข้ามจนพ้น deadband/gap — เกิดยากและเสียแค่แถวเดียว
 */
export function markStored(r: PointReading, now: number): void {
  lastStored.set(r.point_id, {
    at: now,
    value_num: r.value_num,
    value_text: r.value_text,
    quality: r.quality,
  });
}

/** ใช้ตอนลบจุดวัดทิ้ง ไม่งั้นสถานะเก่าค้างในหน่วยความจำไปเรื่อย */
export function forgetPoint(pointId: string): void {
  lastStored.delete(pointId);
}

export const throttleConfig = () => ({
  min_interval_ms: MIN_INTERVAL_MS,
  quality_min_interval_ms: QUALITY_MIN_INTERVAL_MS,
  deadband_pct: DEADBAND_PCT,
  max_gap_ms: MAX_GAP_MS,
  tracked_points: lastStored.size,
});
