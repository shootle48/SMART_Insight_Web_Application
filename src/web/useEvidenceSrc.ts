// URL ของภาพ evidence ที่ "ตรงกับค่าที่กำลังโชว์อยู่"
//
// ปัญหาที่ hook นี้แก้ (เจอหน้างาน 2026-09-08): ค่ากับภาพของเฟรมเดียวกันเดินทางมาคนละทาง
// และไม่พร้อมกัน — `meter_frame` (JSON เล็ก) ถึงก่อน ภาพ (JPEG ใหญ่กว่า) ตามมาทีหลัง
// พอ SSE ดันค่าใหม่ขึ้นจอทันที แล้วเบราว์เซอร์ไปขอภาพของเฟรมนั้นเลย ภาพยังไม่ลงดิสก์
// เซิร์ฟเวอร์เลยคืนภาพเฟรมก่อนหน้าให้ = จอโชว์ "ค่าใหม่ + ภาพเก่า" ตลอดไป
//
// วิธีแก้: ขอซ้ำอีกครั้งหลังจากนั้นสั้น ๆ โดยเปลี่ยน query `r` เพื่อบังคับให้เบราว์เซอร์
// ยิงใหม่จริง ๆ (ตัว src ต้องต่างจากเดิม ไม่งั้น <img> ไม่โหลดซ้ำ) — ฝั่งเซิร์ฟเวอร์
// ตอนนี้เสิร์ฟไฟล์ตาม `?f=` ตรง ๆ แล้ว รอบสองจึงได้ภาพที่ตรงกับค่าจริง
//
// ตั้งใจไม่ใช้ fetch+blob แล้วอ่าน header X-Frame-Id เทียบเอง เพราะต้องจัดการ objectURL
// (สร้าง/revoke) เองทุกใบ เสี่ยง memory leak บนจอที่เปิดค้างเป็นเดือน — แลกกับการยิงซ้ำ
// รอบเดียวต่อการเปลี่ยนเฟรม ซึ่งเป็นภาพเล็กและเกิดไม่ถี่

import { useEffect, useState } from "react";

/** หน่วงก่อนขอซ้ำ — ต้องนานพอให้ภาพเดินทางจาก edge ผ่าน broker มาลงดิสก์ทัน
 *  แต่ไม่นานจนคนเห็นภาพเก่าค้างจนสังเกตได้ */
const RETRY_MS = 1_200;

export function useEvidenceSrc(pointId: string, frameId: string | null): string {
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setRetry(0);
    if (!frameId) return;
    const t = setTimeout(() => setRetry(1), RETRY_MS);
    return () => clearTimeout(t);
  }, [pointId, frameId]);

  const base = `/api/evidence/${encodeURIComponent(pointId)}/latest`;
  if (!frameId) return base;
  return `${base}?f=${encodeURIComponent(frameId)}${retry ? `&r=${retry}` : ""}`;
}
