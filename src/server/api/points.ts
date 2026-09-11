// ค่าล่าสุดทุกจุด + ประวัติย้อนหลังของจุดเดียว + ตั้งค่าจุด (label/หน่วย/สเกล/fixture)

import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { points, devices } from "../../db/schema";
import { meterTopics, pointFixtureSchema } from "../../contract";
import { publish, invalidatePointConfig } from "../ingest/index";

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
      p.alarm_low, p.alarm_high, p.alarm_state, p.alarm_since,
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
  // สเกล (deadband) / เกณฑ์เตือน เปลี่ยนแล้ว — ให้ ingest เห็นเฟรมถัดไปทันที ไม่รอรอบล้าง 5 นาที
  invalidatePointConfig(pointId);
  return c.json({ point: updated });
});

/**
 * ตั้ง/แก้ fixture (ค่า calibration) ของจุดวัด — คนละเรื่องกับ label/หน่วย/สเกลด้านบน
 * ตั้งใจแยก endpoint เพราะ fixture เปลี่ยนคนละจังหวะกับสเกล (ดู comment ใน contract/points.ts)
 *
 * บันทึกลง DB ก่อนเสมอ แล้วค่อย publish retained ไปให้ edge ผ่าน topic `config/<point_id>`
 * (D-017/D-018) — DB คือ source of truth ; publish ล้มเหลว (edge ยังไม่พร้อม/mqtt ยังไม่ต่อ)
 * ไม่ทำให้การบันทึกล้มตาม แค่แจ้งเตือนกลับไปให้ UI เห็นว่ายังไม่ถึง edge จริง
 */
pointsApi.patch("/:pointId/fixture", async (c) => {
  const pointId = c.req.param("pointId");
  const body = await c.req.json().catch(() => null);
  const parsed = pointFixtureSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return c.json({ error: issue ? `${issue.path.join(".")}: ${issue.message}` : "fixture ไม่ถูกต้อง" }, 400);
  }

  const [updated] = await db
    .update(points)
    .set({ fixture: parsed.data })
    .where(eq(points.point_id, pointId))
    .returning();

  if (!updated) return c.json({ error: `ไม่พบจุดวัด ${pointId}` }, 404);

  const topic = meterTopics.config(updated.device_id, pointId);
  const payload = JSON.stringify({ point_id: pointId, ...parsed.data });
  const published = publish(topic, payload, { retain: true, qos: 1 });

  return c.json({
    point: updated,
    ...(published ? {} : { warning: "บันทึกแล้วแต่ยังส่งให้ edge ไม่ได้ (MQTT ยังไม่พร้อม) — ลอง republish ภายหลัง" }),
  });
});

/**
 * ขอภาพดิบสำหรับ calibrate — publish command แบบ non-retained ไป edge (D-017)
 *
 * ไม่มี DB ให้เขียน (เป็น event ชั่วคราวล้วน ๆ ไม่ใช่ config) — publish ล้มเหลวจึงถือเป็น
 * ความล้มเหลวจริงของ request นี้ (ต่างจาก PATCH fixture ที่ DB เขียนสำเร็จแล้วเสมอ)
 * เพราะไม่มีอะไรให้ republish ทีหลังถ้าตอนนี้ยิงไม่ถึง
 *
 * `request_id` ให้ UI ใช้ตรวจว่าภาพที่ได้ผ่าน evidence topic กลับมาเป็นของ request ไหน
 * (ทีม AI แนะนำให้ใช้ตัวนี้เป็น frame_id ของภาพที่ส่งกลับ — ดู CALIBRATION-PROPOSAL.md)
 */
pointsApi.post("/:pointId/request-calibration-snap", async (c) => {
  const pointId = c.req.param("pointId");

  const [point] = await db
    .select({ device_id: points.device_id, kind: points.kind })
    .from(points)
    .where(eq(points.point_id, pointId));
  if (!point) return c.json({ error: `ไม่พบจุดวัด ${pointId}` }, 404);

  const [device] = await db
    .select({ status: devices.status })
    .from(devices)
    .where(eq(devices.device_id, point.device_id));
  if (device?.status !== "ONLINE") {
    return c.json({ error: `เครื่อง ${point.device_id} ออฟไลน์อยู่ ขอภาพไม่ได้ตอนนี้` }, 409);
  }

  const requestId = `req-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const topic = meterTopics.snapForCalibration(point.device_id);
  const payload = JSON.stringify({ point_id: pointId, kind: point.kind, request_id: requestId });
  const published = publish(topic, payload, { retain: false, qos: 1 });

  if (!published) return c.json({ error: "ส่งคำสั่งไม่สำเร็จ (MQTT ยังไม่พร้อม) — ลองใหม่อีกครั้ง" }, 503);
  return c.json({ request_id: requestId });
});

/**
 * Re-publish fixture ที่มีอยู่แล้วใน DB ไปเป็น retained config ใหม่ — กู้กรณี broker
 * ทำ retained store หาย หรือ edge ตัวใหม่เพิ่งต่อเข้ามาแล้วอยากได้ config ทันทีไม่ต้องรอ
 * ใครมาแก้ค่าอะไรก่อน (DB คือ source of truth เสมอ ดู D-017 หัวข้อ trade-off)
 */
pointsApi.post("/:pointId/republish-config", async (c) => {
  const pointId = c.req.param("pointId");

  const [point] = await db
    .select({ device_id: points.device_id, fixture: points.fixture })
    .from(points)
    .where(eq(points.point_id, pointId));
  if (!point) return c.json({ error: `ไม่พบจุดวัด ${pointId}` }, 404);
  if (!point.fixture) return c.json({ error: `จุดวัด ${pointId} ยังไม่มี fixture ให้ republish` }, 400);

  // เผื่อ schema เปลี่ยนหลังจากที่เคยบันทึกไว้ (เช่น D-018) — ของเก่าที่ไม่ตรง schema
  // ปัจจุบันไม่ควรถูก publish ซ้ำออกไปทั้งที่ edge จะ parse ไม่ผ่านอยู่ดี
  const parsed = pointFixtureSchema.safeParse(point.fixture);
  if (!parsed.success) {
    return c.json({ error: "fixture ที่บันทึกไว้ไม่ตรง schema ปัจจุบัน ต้องตั้งค่าใหม่ก่อน" }, 409);
  }

  const topic = meterTopics.config(point.device_id, pointId);
  const payload = JSON.stringify({ point_id: pointId, ...parsed.data });
  const published = publish(topic, payload, { retain: true, qos: 1 });

  if (!published) return c.json({ error: "ส่งไม่สำเร็จ (MQTT ยังไม่พร้อม) — ลองใหม่อีกครั้ง" }, 503);
  return c.json({ published: true, point_id: pointId, device_id: point.device_id });
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

  // 🔴 ค่าที่ edge ส่งมาเป็น **ข้อความ** ต้องถูกนับรวมด้วยถ้าหน้าตาเป็นตัวเลข (T-023)
  // ของจริง: SEVEN_SEGMENT กับ WATER_METER ของทีม AI ส่งเลขนับมาในช่อง `value_text`
  // (ดู D-016) ทำให้ avg/min/max ที่อ่านแต่ `value_num` ได้ null ทุก bucket → กราฟไม่ขึ้นเลย
  // ทั้งที่มีข้อมูลเต็ม ; ต้นตออยู่ที่ edge ส่งผิดช่อง แต่ edge อยู่นอกขอบเขตเรา (D-020)
  // จึงรับมือฝั่งเรา — และทำที่ SQL เพราะ **ข้อมูลเก่าที่เก็บไว้แล้วขึ้นกราฟได้ทันที**
  // ไม่ต้องรอข้อมูลใหม่สะสม
  //
  // ⚠️ regex จงใจไม่ใช้ `\s` / `\.` เพราะ template literal ของ JS จะกลืน backslash
  // ทำให้ pattern เพี้ยนเงียบ ๆ — ใช้ btrim() กับ [.] แทน ปลอดภัยกว่าและอ่านง่ายกว่า
  const rows = await db.execute(sql`
    WITH r AS (
      SELECT
        captured_at,
        quality,
        value_text,
        COALESCE(
          value_num,
          CASE WHEN btrim(value_text) ~ '^-?[0-9]+([.][0-9]+)?$'
               THEN btrim(value_text)::numeric END
        ) AS num
      FROM readings
      WHERE point_id = ${pointId}
        AND captured_at >= now() - make_interval(secs => ${rangeSec})
    )
    SELECT
      to_timestamp(floor(extract(epoch FROM captured_at) / ${bucketSec}) * ${bucketSec}) AS bucket,
      count(*)::int AS samples,
      count(*) FILTER (WHERE quality = 'UNREADABLE')::int AS unreadable,
      count(*) FILTER (WHERE quality = 'UNCERTAIN')::int AS uncertain,
      avg(num) AS avg_value,
      min(num) AS min_value,
      max(num) AS max_value,
      (array_agg(value_text ORDER BY captured_at DESC) FILTER (WHERE value_text IS NOT NULL))[1] AS last_text
    FROM r
    GROUP BY 1
    ORDER BY 1
  `);

  return c.json({ point_id: pointId, range: rangeRaw, bucket_seconds: bucketSec, buckets: rows });
});
