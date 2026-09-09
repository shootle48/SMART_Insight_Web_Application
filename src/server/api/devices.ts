// สถานะเครื่อง edge ทั้งหมด

import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db/index";
import { devices } from "../../db/schema";

export const devicesApi = new Hono();

/**
 * คืนทุกเครื่องพร้อมจำนวนจุดวัด
 *
 * `status` มาจาก LWT (บอกว่าตายทันทีที่สายหลุด) ส่วน `last_frame_at` จับคนละอาการ:
 * เครื่องยังต่ออยู่ (ONLINE) แต่ AI หยุดอ่านมานานแล้ว — สองอย่างนี้ต้องดูคู่กันเสมอ
 * ถ้าดูแต่ status จะพลาดเคสหลังไปทั้งหมด
 */
devicesApi.get("/", async (c) => {
  const rows = await db.execute(sql`
    SELECT
      d.device_id, d.label, d.status, d.status_changed_at,
      d.ai_service_status, d.storage_usage_percent,
      d.software_version, d.model_version,
      d.last_heartbeat_at, d.last_frame_at,
      count(p.point_id)::int AS point_count,
      count(p.point_id) FILTER (WHERE p.enabled)::int AS enabled_point_count
    FROM devices d
    LEFT JOIN points p ON p.device_id = d.device_id
    GROUP BY d.device_id
    ORDER BY d.device_id
  `);

  return c.json({ devices: rows });
});

const deviceLabelInput = z.object({
  label: z.string().trim().min(1, "ต้องใส่ชื่อเครื่อง").max(80, "ชื่อยาวเกินไป (ไม่เกิน 80 ตัวอักษร)"),
});

/**
 * ตั้งชื่อเครื่อง (T-019) — `ingest` สร้างแถว device ให้อัตโนมัติตอนเจอ `device_id` แปลกหน้า
 * โดยไม่ใส่ `label` ทำให้จอขึ้นแต่ id ดิบที่คนหน้างานไม่รู้ว่าตู้ไหน ; ก่อนหน้านี้ตั้งได้ทางเดียว
 * คือ `db:seed` ซึ่งใช้ที่โรงงานลูกค้าไม่ได้
 *
 * รับแค่ `label` อย่างเดียวโดยตั้งใจ — ฟิลด์อื่นในตาราง (`status`, `last_frame_at`, เวอร์ชัน ฯลฯ)
 * เป็นของที่ edge รายงานเข้ามา ไม่ใช่ของที่คนตั้ง ถ้าเปิดให้แก้จะกลายเป็นข้อมูลปลอมที่
 * ingest จะเขียนทับทีหลังอยู่ดี
 */
devicesApi.patch("/:deviceId", async (c) => {
  const deviceId = c.req.param("deviceId");
  const body = await c.req.json().catch(() => null);
  const parsed = deviceLabelInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" }, 400);
  }

  const [updated] = await db
    .update(devices)
    .set({ label: parsed.data.label })
    .where(eq(devices.device_id, deviceId))
    .returning();

  if (!updated) return c.json({ error: `ไม่พบเครื่อง ${deviceId}` }, 404);
  return c.json({ device: updated });
});
