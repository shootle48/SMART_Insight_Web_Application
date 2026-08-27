// สถานะเครื่อง edge ทั้งหมด

import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { db } from "../../db/index";

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
