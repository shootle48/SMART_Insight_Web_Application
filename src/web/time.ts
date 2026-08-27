// กติกาเรื่อง "ค่าเก่าแค่ไหนถึงเรียกว่าเชื่อไม่ได้"
//
// ⚠️ 30 วินาทีเป็นค่าที่ตั้งเอง เพราะยังไม่รู้อัตราการยิงจริงจากทีม AI
// ถ้าของจริงยิงทุก 60 วินาที ทุกการ์ดจะขึ้น stale ตลอดเวลาทั้งที่ปกติ
// พอรู้อัตราจริงแล้วต้องย้ายค่านี้ไปเป็น config ต่อจุด ไม่ใช่ค่าคงที่ตัวเดียวทั้งระบบ

export const STALE_AFTER_MS = 30_000;

export function isStale(iso: string | null, now: number): boolean {
  if (!iso) return true;
  return now - new Date(iso).getTime() > STALE_AFTER_MS;
}

export function ageLabel(iso: string | null, now: number): string {
  if (!iso) return "ไม่เคยมีค่า";
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec} วินาที`;
  if (sec < 3600) return `${Math.floor(sec / 60)} นาที`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ชั่วโมง`;
  return `${Math.floor(sec / 86400)} วัน`;
}

/** ตัดทศนิยมตามความละเอียดของสเกล — สเกล 0..0.099 ต้องเห็นหลักที่ 3-4 */
export function formatValue(v: number, min: number | null, max: number | null): string {
  if (min === null || max === null) return String(v);
  const span = Math.abs(max - min);
  const decimals = span >= 100 ? 0 : span >= 10 ? 1 : span >= 1 ? 2 : 4;
  return v.toFixed(decimals);
}
