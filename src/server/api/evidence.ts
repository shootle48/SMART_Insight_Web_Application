// เสิร์ฟภาพล่าสุดของจุดวัดหนึ่ง ๆ — อ่านจากไฟล์บนดิสก์ตรง ๆ ไม่ผ่าน DB (T-011)
//
// เหตุผลที่ต้องเช็ค device_id จาก DB ก่อนแตะ filesystem: point_id มาจาก URL param
// ซึ่งเป็น input จากคนใช้ในทางทฤษฎี — ถ้า point_id ไม่มีอยู่จริงในระบบ จะ 404 กลับไป
// ทันทีโดยไม่เคยเอาค่าไปต่อ path เลย (query ที่ไม่เจอแถวคือด่านกันเองอยู่แล้ว
// ไม่ต้องเขียน sanitize เพิ่ม)

import { Hono, type Context } from "hono";
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { db } from "../../db/index";
import { EVIDENCE_DIR } from "../ingest/evidence";

export const evidenceApi = new Hono();

/** frame_id ที่รับมาต้องปลอดภัยพอจะเอาไปต่อ path ได้ — กัน `../` และตัวคั่น path ทุกแบบ
 *  (ค่านี้มาจาก query string = input จากผู้ใช้ ต่างจาก point_id ที่เช็คกับ DB ไปแล้ว) */
const SAFE_FRAME_ID = /^[A-Za-z0-9._-]{1,200}$/;

evidenceApi.get("/:pointId/latest", async (c) => {
  const pointId = c.req.param("pointId");
  // `?f=` = เฟรมที่ผู้เรียก "อยากได้" — ต้องเสิร์ฟไฟล์นั้นจริง ๆ ไม่ใช่ไฟล์ใหม่สุดเสมอ
  //
  // 🔴 บั๊กเดิม (2026-09-08): พารามิเตอร์นี้ถูกใช้แค่ล้าง cache ฝั่งเบราว์เซอร์
  // ส่วนเซิร์ฟเวอร์คืนไฟล์ใหม่สุดตาม mtime เสมอ — พอ meter_frame (ค่า) มาถึงก่อนภาพ
  // ของเฟรมเดียวกัน (payload ภาพใหญ่กว่า มาทีหลัง) จอจะจับคู่ "ค่าเฟรมใหม่ + ภาพเฟรมเก่า"
  // ตลอด = ภาพช้ากว่าค่าหนึ่งเฟรมเสมอ ซึ่งทำลายจุดประสงค์ทั้งหมดของภาพ evidence
  // (มีไว้เทียบว่า AI อ่านค่าจากภาพนี้ถูกไหม)
  const wanted = c.req.query("f");

  const rows = await db.execute(sql`SELECT device_id FROM points WHERE point_id = ${pointId}`);
  const point = rows[0] as { device_id: string } | undefined;
  if (!point) return c.json({ error: "ไม่รู้จักจุดนี้" }, 404);

  const dir = join(EVIDENCE_DIR, point.device_id, pointId);

  // ขอเฟรมเจาะจงและมีไฟล์นั้นจริง → เสิร์ฟตัวนั้นเลย ไม่ต้อง readdir ทั้งโฟลเดอร์
  if (wanted && SAFE_FRAME_ID.test(wanted)) {
    const exact = Bun.file(join(dir, `${wanted}.jpg`));
    if (await exact.exists()) return sendImage(c, await exact.arrayBuffer(), wanted);
  }

  // ไม่ได้ระบุเฟรม หรือภาพของเฟรมนั้นยังมาไม่ถึง → คืนภาพล่าสุดที่มีไปก่อน
  // (ดีกว่าโชว์ช่องว่าง ; ฝั่ง client รู้ได้จาก X-Frame-Id ว่าไม่ตรงกับที่ขอ แล้วลองใหม่เอง)
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
  return sendImage(c, bytes, newest.name.replace(/\.jpg$/, ""));
});

function sendImage(c: Context, bytes: ArrayBuffer, frameId: string) {
  c.header("Content-Type", "image/jpeg");
  // no-store ไม่ใช่แค่กัน cache เก่า — URL นี้หน้าตาเดิมตลอดแต่เนื้อไฟล์เปลี่ยนได้ทุกครั้งที่
  // มีภาพใหม่เข้ามา ถ้าเบราว์เซอร์ cache ไว้จะเห็นภาพเก่าค้างไปเรื่อย ๆ โดยไม่รู้ตัว
  c.header("Cache-Control", "no-store");
  // บอกว่าที่ส่งไปจริง ๆ คือเฟรมไหน — client ใช้เทียบว่าตรงกับที่ขอไหม (ถ้าไม่ตรง = ภาพของ
  // เฟรมนั้นยังมาไม่ถึง ให้ลองใหม่อีกที) และแผง calibrate ใช้ตรวจว่าภาพที่เพิ่งสั่ง snap มาถึงแล้ว
  c.header("X-Frame-Id", frameId);
  return c.body(bytes);
}
