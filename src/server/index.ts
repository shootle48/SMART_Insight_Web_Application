// จุดเข้าเดียวของฝั่ง server
//
//   dev  : bun run dev        (ตัวนี้ + Vite แยกกัน Vite proxy /api มาที่นี่)
//   prod : bun run start      (ตัวนี้ตัวเดียว เสิร์ฟทั้ง API และไฟล์ static)
//
// prod เหลือ process เดียวโดยตั้งใจ — เป็นเหตุผลหลักที่เลือก Hono แทน Next (D-001)
// พอถึง T-004 ตัว MQTT ingest จะมาอยู่ในไฟล์นี้ด้วย ไม่แยก worker

import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { api } from "./api";

const PORT = Number(process.env.PORT ?? 3000);
const WEB_ROOT = process.env.WEB_ROOT ?? "./dist/web";
// dev: Vite เป็นคนเสิร์ฟหน้าเว็บ ตัวนี้ทำแค่ API
const SERVE_STATIC = process.env.SERVE_STATIC !== "false";

const app = new Hono();

app.route("/api", api);

if (SERVE_STATIC) {
  app.use("/*", serveStatic({ root: WEB_ROOT }));

  // SPA fallback — เส้นทางที่ไม่ใช่ไฟล์จริงให้คืน index.html ให้ router ฝั่ง client จัดการ
  // ต้องอยู่หลัง /api เสมอ ไม่งั้น API ที่ไม่มีจริงจะได้ HTML แทน 404 ซึ่ง debug ยากมาก
  //
  // serveStatic เป็น middleware (รับ c, next) แต่ notFound handler รับแค่ c
  // จึงต้องห่อ แล้วส่ง next ที่ไม่ทำอะไรเข้าไป
  const indexHtml = serveStatic({ path: `${WEB_ROOT}/index.html` });

  app.notFound((c) => {
    // ⚠️ app.notFound() เป็น global — การ mount router ไว้ใต้ /api ไม่ได้กัน path
    // ใต้ /api ที่ไม่ match ออกจากตัวนี้ ถ้าไม่ดักเอง /api/พิมพ์ผิด จะได้ HTML 200
    // แล้ว JSON.parse ฝั่ง client จะพังด้วย "Unexpected token '<'" ซึ่งไม่บอกต้นตอเลย
    if (c.req.path === "/api" || c.req.path.startsWith("/api/")) {
      return c.json({ error: "not_found", path: c.req.path }, 404);
    }
    return indexHtml(c, async () => {}) as Response | Promise<Response>;
  });
}

console.log(`[server] :${PORT}  static=${SERVE_STATIC ? WEB_ROOT : "ปิด (Vite เสิร์ฟเอง)"}`);

export default { port: PORT, fetch: app.fetch };
export { app };
