// Hono routes ทั้งหมดรวมที่นี่ แล้วให้ src/server/index.ts เอาไป mount ใต้ /api
//
// แยกจากไฟล์ entry เพื่อให้เทสยิง route ได้โดยไม่ต้องเปิดพอร์ตจริง
// (app.request() ของ Hono เรียกตรงได้เลย)

import { Hono } from "hono";
import { sql as drizzleSql } from "drizzle-orm";
import { db } from "../../db/index";
import { ingestStats } from "../ingest/index";
import { pointsApi } from "./points";
import { devicesApi } from "./devices";
import { streamApi, sseClientCount } from "./stream";
import { retentionStatus, readingsFootprint } from "../retention";
import { backupStatus } from "../backup-status";

const startedAt = Date.now();

export const api = new Hono();

// ใช้เช็คว่าระบบยังทำงานได้จริง — systemd/kiosk/คนดูแลเครื่องเรียกตัวนี้
//
// ⚠️ ต้องตอบ 503 เมื่อ dependency ล่ม ไม่ใช่ 200 เสมอ
// health ที่ตอบ 200 ตลอดคือคำโกหกที่ทำให้ระบบ restart อัตโนมัติไม่ทำงานตอนของจริงพัง
api.get("/health", async (c) => {
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await db.execute(drizzleSql`select 1`);
    dbOk = true;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }

  const ingest = ingestStats();

  // ขนาดที่กินอยู่จริง — ต้องมองเห็นได้จากภายนอก เพราะ SD เต็มคือความเสี่ยงหลักของเครื่องนี้
  let storage: unknown = { error: "อ่านไม่ได้" };
  if (dbOk) {
    try {
      storage = { ...(await readingsFootprint()), retention: retentionStatus() };
    } catch (e) {
      storage = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return c.json(
    {
      status: dbOk ? "ok" : "degraded",
      uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
      checks: {
        postgres: dbOk ? { ok: true } : { ok: false, error: dbError },
        // ingest ไม่มี ok/ไม่ ok ตายตัว — ตัวเลขบอกได้ดีกว่าว่ากำลังรับของอยู่ไหม
        // received ไม่ขยับ = broker เงียบหรือหลุด ; invalid พุ่ง = สัญญาไม่ตรงกับที่ edge ส่ง
        ingest,
        // จอที่ต่อ SSE อยู่ ; ถ้าเลขนี้ไม่ลดหลังปิดจอ = listener รั่ว
        sse_clients: sseClientCount(),
        storage,
        // backup ที่หยุดทำงานเงียบ ๆ จะรู้ตัวตอนสายเกินไป — ต้องเห็นจากที่เดียวกับสุขภาพระบบ
        backup: await backupStatus(),
      },
    },
    dbOk ? 200 : 503,
  );
});

api.route("/points", pointsApi);
api.route("/devices", devicesApi);
api.route("/stream", streamApi);
