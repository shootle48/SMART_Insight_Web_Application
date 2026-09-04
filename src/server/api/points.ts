// ค่าล่าสุดทุกจุด + ประวัติย้อนหลังของจุดเดียว + ตั้งค่าจุด (label/หน่วย/สเกล)

import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { points } from "../../db/schema";

export const pointsApi = new Hono();

/**
 * ค่าล่าสุดของทุกจุดวัด
 *
 * ใช้ LEFT JOIN LATERAL แทนการ join ธรรมดา ด้วยสองเหตุผล:
 *   1. LEFT = จุดที่ยังไม่เคยมีค่าเลยต้องยังโผล่บนจอ (จุดที่ ingest เพิ่งสร้าง หรือกล้องเพิ่งเสีย)
 *      ถ้าหายไปเงียบ ๆ คนดูจะไม่รู้ว่ามีจุดที่ไม่ส่งค่ามา ซึ่งเป็นข้อมูลที่สำคัญที่สุด
 *   2. LATERAL ... ORDER BY captured_at DESC LIMIT 1 วิ่งเข้า index (point_id, captured_at DESC)
 *      ตรง ๆ จึงเร็วคงที่ ไม่ต้องสแกนทั้งตาราง readings ที่โตเรื่อย ๆ
 */
pointsApi.get("/", async (c) => {
  const rows = await db.execute(sql`
    SELECT
      p.point_id, p.device_id, p.camera_id, p.label, p.unit, p.kind, p.enabled,
      p.min_value, p.max_value, p.fixture,
      d.status AS device_status,
      r.value_num, r.value_text, r.confidence, r.quality,
      r.captured_at, r.received_at, r.frame_id
    FROM points p
    JOIN devices d ON d.device_id = p.device_id
    LEFT JOIN LATERAL (
      SELECT value_num, value_text, confidence, quality, captured_at, received_at, frame_id
      FROM readings
      WHERE readings.point_id = p.point_id
      ORDER BY captured_at DESC
      LIMIT 1
    ) r ON true
    ORDER BY p.device_id, p.point_id
  `);

  return c.json({ points: rows });
});

const pointConfigInput = z
  .object({
    label: z.string().trim().min(1, "ต้องใส่ชื่อจุดวัด"),
    unit: z.string().trim().min(1).nullable(),
    min_value: z.number().finite().nullable(),
    max_value: z.number().finite().nullable(),
  })
  // min/max ต้องมาคู่กันเสมอ — สเกลครึ่งเดียว (มี min ไม่มี max) วาดเกจไม่ได้และ
  // เช็ค "เกินสเกล" ก็ทำไม่ได้เช่นกัน (ดู over ใน PointCard.tsx)
  .refine((v) => (v.min_value === null) === (v.max_value === null), {
    message: "ต้องใส่ค่าต่ำสุด/สูงสุดคู่กัน หรือเว้นว่างทั้งคู่ (จุดที่ไม่มีสเกล)",
    path: ["max_value"],
  })
  .refine((v) => v.min_value === null || v.max_value === null || v.max_value > v.min_value, {
    message: "ค่าสูงสุดต้องมากกว่าค่าต่ำสุด",
    path: ["max_value"],
  });

/**
 * ตั้งค่าจุดวัด (label/หน่วย/สเกล) — ใช้ทั้งจุดที่ ingest สร้างอัตโนมัติ (enabled=false,
 * รอคนยืนยัน) และจุดที่เคยตั้งไว้แล้วแต่อยากแก้ค่า
 *
 * บันทึกสำเร็จ = คนยืนยันจุดนี้แล้ว จึงตั้ง enabled=true ให้เสมอ ไม่มีช่องแยกปิดเปิด
 * ในฟอร์มนี้ — "ยังไม่ตั้งค่า" กับ "ตั้งค่าแล้วแต่ปิดใช้งาน" เป็นคนละเรื่องกัน ยังไม่มี UI
 * สำหรับเรื่องหลังในตอนนี้
 */
pointsApi.patch("/:pointId", async (c) => {
  const pointId = c.req.param("pointId");
  const body = await c.req.json().catch(() => null);
  const parsed = pointConfigInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, 400);
  }

  const [updated] = await db
    .update(points)
    .set({ ...parsed.data, enabled: true })
    .where(eq(points.point_id, pointId))
    .returning();

  if (!updated) return c.json({ error: `ไม่พบจุดวัด ${pointId}` }, 404);
  return c.json({ point: updated });
});

/** แปลง "15m" / "6h" / "7d" เป็นวินาที ; คืน null ถ้ารูปแบบผิด */
function parseRange(raw: string): number | null {
  const m = /^(\d+)([mhd])$/.exec(raw);
  if (!m) return null;
  const n = Number(m[1]);
  if (n <= 0) return null;
  const unit = { m: 60, h: 3600, d: 86400 }[m[2] as "m" | "h" | "d"];
  const seconds = n * unit;
  // กันไม่ให้ขอช่วงยาวจนสแกนทั้งตารางบน Pi
  return seconds > 30 * 86400 ? null : seconds;
}

/**
 * ประวัติย้อนหลังของจุดเดียว — รวมเป็น bucket ตามช่วงเวลา
 *
 * ตั้งใจไม่คืนแถวดิบแล้ว cap จำนวน เพราะการ cap จะทำให้กราฟโชว์แค่ช่วงท้ายของ range
 * ที่ขอมา โดยคนดูเข้าใจว่าเห็นครบทั้งช่วง — ผิดแบบที่มองไม่ออก
 *
 * คืน min/max ด้วยไม่ใช่แค่ avg เพราะค่าพุ่งชั่วขณะ (ซึ่งคือสิ่งที่ฝ่ายผลิตต้องเห็น)
 * จะถูก avg กลบหายถ้าเหลือแค่ค่าเฉลี่ย
 */
pointsApi.get("/:pointId/history", async (c) => {
  const pointId = c.req.param("pointId");
  const rangeRaw = c.req.query("range") ?? "1h";
  const rangeSec = parseRange(rangeRaw);
  if (rangeSec === null) {
    return c.json({ error: "range ไม่ถูกต้อง — ใช้รูปแบบ 15m / 6h / 7d และไม่เกิน 30d" }, 400);
  }

  // เล็งไว้ ~240 จุดต่อกราฟ กำลังพอดีกับความกว้างจอ ไม่ละเอียดเกินจนเปลืองแบนด์วิดท์
  const bucketSec = Math.max(1, Math.floor(rangeSec / 240));

  const rows = await db.execute(sql`
    SELECT
      to_timestamp(floor(extract(epoch FROM captured_at) / ${bucketSec}) * ${bucketSec}) AS bucket,
      count(*)::int AS samples,
      count(*) FILTER (WHERE quality = 'UNREADABLE')::int AS unreadable,
      count(*) FILTER (WHERE quality = 'UNCERTAIN')::int AS uncertain,
      avg(value_num) AS avg_value,
      min(value_num) AS min_value,
      max(value_num) AS max_value,
      (array_agg(value_text ORDER BY captured_at DESC) FILTER (WHERE value_text IS NOT NULL))[1] AS last_text
    FROM readings
    WHERE point_id = ${pointId}
      AND captured_at >= now() - make_interval(secs => ${rangeSec})
    GROUP BY 1
    ORDER BY 1
  `);

  return c.json({ point_id: pointId, range: rangeRaw, bucket_seconds: bucketSec, buckets: rows });
});
