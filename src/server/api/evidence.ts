// เสิร์ฟภาพล่าสุดของจุดวัดหนึ่ง ๆ — อ่านจากไฟล์บนดิสก์ตรง ๆ ไม่ผ่าน DB (T-011)
//
// เหตุผลที่ต้องเช็ค device_id จาก DB ก่อนแตะ filesystem: point_id มาจาก URL param
// ซึ่งเป็น input จากคนใช้ในทางทฤษฎี — ถ้า point_id ไม่มีอยู่จริงในระบบ จะ 404 กลับไป
// ทันทีโดยไม่เคยเอาค่าไปต่อ path เลย (query ที่ไม่เจอแถวคือด่านกันเองอยู่แล้ว
// ไม่ต้องเขียน sanitize เพิ่ม)

import { Hono } from "hono";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../../db/index";
import { EVIDENCE_DIR } from "../ingest/evidence";

export const evidenceApi = new Hono();

evidenceApi.get("/:pointId/latest", async (c) => {
  const pointId = c.req.param("pointId");

  const rows = await db.execute(sql`SELECT device_id FROM points WHERE point_id = ${pointId}`);
  const point = rows[0] as { device_id: string } | undefined;
  if (!point) return c.json({ error: "ไม่รู้จักจุดนี้" }, 404);

  const dir = join(EVIDENCE_DIR, point.device_id, pointId);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return c.json({ error: "ยังไม่มีภาพของจุดนี้" }, 404);
  }

  const jpgs = files.filter((f) => f.endsWith(".jpg"));
  if (jpgs.length === 0) return c.json({ error: "ยังไม่มีภาพของจุดนี้" }, 404);

  // เรียงตาม mtime ไม่ใช่ชื่อไฟล์ — frame_id ของคนละ device ขึ้นต้นไม่เหมือนกัน
  // เรียงตามชื่อเฉย ๆ จะได้ผลผิดถ้าวันหนึ่งย้ายภาพจากเครื่องอื่นมารวมโฟลเดอร์เดียวกัน
  let newest = { name: "", mtime: 0 };
  for (const f of jpgs) {
    const s = await stat(join(dir, f));
    if (s.mtimeMs > newest.mtime) newest = { name: f, mtime: s.mtimeMs };
  }

  const bytes = await Bun.file(join(dir, newest.name)).arrayBuffer();
  c.header("Content-Type", "image/jpeg");
  // no-store ไม่ใช่แค่กัน cache เก่า — URL นี้หน้าตาเดิมตลอดแต่เนื้อไฟล์เปลี่ยนได้ทุกครั้งที่
  // มีภาพใหม่เข้ามา ถ้าเบราว์เซอร์ cache ไว้จะเห็นภาพเก่าค้างไปเรื่อย ๆ โดยไม่รู้ตัว
  c.header("Cache-Control", "no-store");
  return c.body(bytes);
});
