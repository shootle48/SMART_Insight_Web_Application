// Hono routes ทั้งหมดรวมที่นี่ แล้วให้ src/server/index.ts เอาไป mount ใต้ /api
//
// แยกจากไฟล์ entry เพื่อให้เทสยิง route ได้โดยไม่ต้องเปิดพอร์ตจริง
// (app.request() ของ Hono เรียกตรงได้เลย)

import { Hono } from "hono";

const startedAt = Date.now();

export const api = new Hono();

// ใช้เช็คว่า server ยังอยู่ — kiosk/systemd/คนดูแลเครื่องเรียกตัวนี้
//
// ตอนนี้ตอบแค่ว่า process ยังหายใจ ยังไม่ได้ตรวจ DB หรือ MQTT เพราะยังไม่มี
// พอ T-003/T-004 เสร็จต้องกลับมาเติม แล้วให้ตอบ 503 เมื่อ dependency ล่ม
// ไม่งั้น health ที่ตอบ 200 เสมอจะกลายเป็นคำโกหกที่ทำให้ restart อัตโนมัติไม่ทำงาน
api.get("/health", (c) =>
  c.json({
    status: "ok",
    uptime_seconds: Math.floor((Date.now() - startedAt) / 1000),
    checks: {
      // TODO(T-003): postgres
      // TODO(T-004): mqtt
    },
  }),
);
