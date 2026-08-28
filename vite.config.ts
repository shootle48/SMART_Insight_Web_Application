import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// หน้าเว็บอยู่ใน src/web และ build ออกไปที่ dist/web
// ซึ่งเป็นที่เดียวกับที่ Hono ตั้งเป็น WEB_ROOT ตอน prod
export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // dev เท่านั้น — prod ไม่มี proxy เพราะ Hono เสิร์ฟทั้งสองอย่างเอง
    // เขียน path เดียวกับ prod (/api/...) เพื่อให้โค้ดฝั่ง client ไม่ต้องรู้ว่าอยู่โหมดไหน
    // ⚠️ ต้องเป็น "^/api/" (มี / ปิดท้าย) ไม่ใช่ "/api" เฉย ๆ
    // เพราะ "/api" จะจับไฟล์ต้นทางที่ชื่อขึ้นต้นด้วย api ไปด้วย เช่น /api.ts
    // แล้วส่งไป Hono ซึ่งตอบ 404 -> import พัง -> หน้าขาวโดยไม่มี error ใน terminal
    // (พังเฉพาะโหมด dev ; prod รวมเป็น bundle เดียวจึงไม่เคยขอไฟล์พวกนี้ผ่าน HTTP)
    proxy: {
      "^/api/": "http://localhost:3000",
    },
  },
});
