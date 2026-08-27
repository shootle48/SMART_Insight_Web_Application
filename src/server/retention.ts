// ลบข้อมูลเก่าอัตโนมัติ — ตาข่ายกันพลาดไม่ให้ SD เต็ม
//
// ทำไมต้องมีทั้งที่มี throttle แล้ว: throttle ลดอัตราลงได้มาก แต่ไม่ได้หยุดการโต
// ถ้า SD เต็ม Postgres เขียนไม่ได้แล้วเสี่ยง corrupt ซึ่งเป็นความเจ็บที่ D-006 ยอมรับไว้
// อันนี้คือชั้นที่ทำให้ "เต็ม" ไม่เกิดขึ้นตั้งแต่แรก
//
// ตั้งใจใช้ DELETE ธรรมดาไม่ใช่ partition (ดู D-007) — พอ throttle ทำงานแล้ว
// ปริมาณเหลือระดับที่ autovacuum เอาอยู่ ไม่คุ้มกับกับดักของ partition ที่ต้องสร้างล่วงหน้า

import { sql as raw } from "drizzle-orm";
import { db } from "../db/index";

/** เก็บย้อนหลังกี่วัน ; 0 = ปิดการลบ */
const RETENTION_DAYS = Number(process.env.RETENTION_DAYS ?? 30);

/** ลบทีละกี่แถว — ก้อนเล็กเพื่อไม่ให้ล็อกตารางนานจน ingest เขียนไม่ได้ */
const BATCH = Number(process.env.RETENTION_BATCH ?? 5_000);

/** เพดานต่อรอบ กันกรณีข้อมูลค้างเยอะจนวิ่งยาวเกินไป — รอบหน้าค่อยลบต่อ */
const MAX_PER_RUN = Number(process.env.RETENTION_MAX_PER_RUN ?? 500_000);

const EVERY_MS = 6 * 60 * 60_000;

let last: { at: string; deleted: number; days: number } | null = null;
export const retentionStatus = () => ({ enabled: RETENTION_DAYS > 0, days: RETENTION_DAYS, last });

export async function runRetention(): Promise<number> {
  if (RETENTION_DAYS <= 0) return 0;

  let deleted = 0;
  while (deleted < MAX_PER_RUN) {
    // ลบผ่าน ctid ของชุดย่อย — เร็วกว่า DELETE ... WHERE ตรง ๆ บนตารางใหญ่
    // เพราะ planner เลือกแถวจาก index ได้ก่อนแล้วค่อยลบตามตำแหน่งจริง
    const res = (await db.execute(raw`
      DELETE FROM readings
      WHERE ctid IN (
        SELECT ctid FROM readings
        WHERE captured_at < now() - make_interval(days => ${RETENTION_DAYS})
        LIMIT ${BATCH}
      )
    `)) as unknown as { count?: number };

    const n = res?.count ?? 0;
    deleted += n;
    if (n < BATCH) break; // ไม่เหลือแล้ว

    // หายใจให้ ingest ได้เขียนบ้าง ไม่ยึด connection ยาว
    await new Promise((r) => setTimeout(r, 200));
  }

  last = { at: new Date().toISOString(), deleted, days: RETENTION_DAYS };
  if (deleted > 0) console.log(`[retention] ลบข้อมูลเก่ากว่า ${RETENTION_DAYS} วัน ไป ${deleted} แถว`);
  return deleted;
}

export function startRetention(): void {
  if (RETENTION_DAYS <= 0) {
    console.warn("[retention] ปิดอยู่ (RETENTION_DAYS=0) — ตาราง readings จะโตไปเรื่อย ๆ");
    return;
  }
  console.log(`[retention] เก็บย้อนหลัง ${RETENTION_DAYS} วัน · ตรวจทุก 6 ชั่วโมง`);

  // รอให้ระบบตั้งตัวก่อน ไม่ไปแย่งทรัพยากรตอนบูตพร้อม ingest/DB
  setTimeout(() => {
    void runRetention().catch((e) => console.error("[retention] ล้มเหลว:", e));
    setInterval(() => {
      void runRetention().catch((e) => console.error("[retention] ล้มเหลว:", e));
    }, EVERY_MS);
  }, 60_000);
}

/** ขนาดที่ readings กินอยู่จริง — ใช้เฝ้าดูว่าเข้าใกล้เต็มไหม */
export async function readingsFootprint() {
  const rows = (await db.execute(raw`
    SELECT count(*)::int AS rows,
           pg_total_relation_size('readings') AS bytes,
           pg_size_pretty(pg_total_relation_size('readings')) AS pretty
    FROM readings
  `)) as unknown as { rows: number; bytes: string; pretty: string }[];
  const r = rows[0];
  return { rows: r?.rows ?? 0, bytes: Number(r?.bytes ?? 0), pretty: r?.pretty ?? "0 bytes" };
}
