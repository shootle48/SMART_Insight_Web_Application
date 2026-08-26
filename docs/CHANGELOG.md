# Changelog — Meter

<!-- AI อัปเดตหลังจบทุก step (กติกาใน CLAUDE.md ข้อ 7). ใหม่สุดอยู่บน.
     1 step = 1 ก้อน 3-6 บรรทัด: ทำอะไร/ทำไม + verify ยังไง. อ้าง ticket ถ้ามี (T-00N).
     ความเสี่ยง: 🟢 ต่ำ / 🟡 กลาง / 🔴 สูง (แตะ production/hardware/ข้อมูล) -->

---

## T-001 scaffold Bun + Hono + Vite/React  🟢  (T-001)
- `src/server/index.ts` (entry, prod เสิร์ฟทั้ง API และ static), `src/server/api/index.ts` (`/api/health`),
  `src/web/{index.html,main.tsx,App.tsx}`, `vite.config.ts` (proxy `/api` → :3000 เฉพาะ dev)
- 🔴 **เจอบั๊ก routing**: `/api/nope` คืน HTML 200 แทน 404 — `app.notFound()` ของ Hono เป็น global
  การ mount router ใต้ `/api` ไม่ได้กัน path ใต้ `/api` ที่ไม่ match ออกจากมัน
  ผลคือ client ที่ fetch ผิด path จะพังที่ `JSON.parse` ด้วย `Unexpected token '<'` ซึ่งไม่บอกต้นตอ
  → ดัก `/api` ใน notFound handler ให้คืน JSON 404
- `bun run dev` ใช้ `&` ไม่ได้ (Bun script shell ยังไม่รองรับ background command) → ใช้ `concurrently -k`
  ซึ่ง kill ลูกทั้งพวงให้ด้วย สำคัญบน Windows ที่เชื่อ signal ไม่ได้ (ดู D-005) ; dep นี้ไม่ขึ้น Pi
- verify: `tsc --noEmit` ผ่าน · `bun run build` 186ms → `dist/web` · prod: `/api/health` 200 json,
  `/api/nope` **404 json**, `/` และ `/some/route` 200 html · dev: Vite 5173 proxy `/api/health` ทะลุถึง Hono
  · เปิดเบราว์เซอร์จริงเห็น "ok · uptime 18s" บนหน้า ไม่มี console error

## T-002 สัญญา MQTT + mock edge publisher  🟢  (T-002)
- `src/contract/` 4 ไฟล์: `points.ts` (fixture ยกคำศัพท์จาก `../bench/samples.json` ตรง ๆ),
  `messages.ts` (meter_frame / device_heartbeat / device_status + OPEN-1..7), `topics.ts`, `index.ts`
- `scripts/mock-edge-publisher.ts` — 3 เครื่อง 10 จุดวัด ใช้ช่วงค่า/หน่วยจาก fixture จริง
  ครอบเคสยาก: ช่วงติดลบ (-5..15), ช่วงเล็กมาก (0..0.099), ไม่มีหน่วย, LAMP, UNREADABLE 4%
- `scripts/verify-contract.ts` + `deploy/mosquitto.conf`
- 🔴 **เจอบั๊กระหว่าง verify**: การล้าง retained ใน SIGINT/SIGTERM handler ไม่ทำงาน
  (exit 143, retained ค้างครบ 3) ทดสอบซ้ำแบบรันตรงไม่ผ่าน wrapper ก็ไม่ทำงาน
  → ต้นตอ: Windows ไม่มี POSIX signal จริง **แต่ที่สำคัญกว่าคือแก้ผิดจุด** —
  ไฟดับ/สายหลุด/kill -9 ก็ไม่มีทางรัน handler ได้อยู่ดี → เปลี่ยนเป็น **LWT** (D-005)
  เพิ่ม `device_status` เข้าสัญญา + แยก connection ต่อ device (LWT ผูกกับ connection)
- verify: `tsc --noEmit` ผ่าน · `verify-contract 22` → 27 ข้อความ parse ผ่าน 100% ครบ 3 เครื่อง
  status=ONLINE · **`kill -9` แล้วทั้ง 3 เครื่องพลิกเป็น OFFLINE จริง** โดย log ยืนยันว่า
  handler ไม่ได้รัน = broker ประกาศแทนให้จริง

## เพิ่ม HANDOFF.md สำหรับ session ต่อ  🟢  (2026-08-25)
- `HANDOFF.md` ที่ราก + pointer จาก `CLAUDE.md` ("เริ่ม session ใหม่ → อ่านก่อนเสมอ")
- ตั้งใจเก็บเฉพาะของที่ไฟล์อื่นไม่มี: สถานะเครื่อง · ของค้างกลางมือ · คำถามค้างกับทีม AI · กับดักที่เจอแล้ว
  ไม่ก๊อปสถาปัตยกรรม/backlog มาซ้ำ — HANDOFF ของ Yoshi ยาว 343 บรรทัดเพราะทำแบบนั้นแล้วต้องไล่แก้สองที่
- verify: อ่านทวนแล้วทุกหัวข้อชี้ไปไฟล์อื่นแทนการทำสำเนา · 97 บรรทัด

## ตั้งโปรเจกต์ + design + backlog  🟢  (2026-08-25)
- ก๊อป `_templates/` มาเป็นราก แล้วเติม `CLAUDE.md`, `ARCHITECTURE.md`, `DECISIONS.md` (D-001..D-004),
  `TICKETS.md` (T-001..T-008) — ยังไม่มีโค้ดสักบรรทัด
- เคาะ stack: Bun + Hono + Vite/React + Postgres 17 + Mosquitto 2 — เหตุผลเต็มใน D-001..D-003
  จุดชี้ขาดคือ MQTT subscriber อยู่ process เดียวกับ API ได้ (Next ทำไม่ได้) → systemd unit เดียวบน Pi
- เคยเริ่มงานนี้ผิดที่ใน `Yoshi/YoshiOpspectWebsite` (สัญญา Zod + mock publisher + mosquitto.conf)
  ถอนออกครบแล้ว: ลบ 3 ไฟล์ untracked + `bun remove mqtt` — repo พี่ Sun กลับสภาพเดิม (D-004)
- ตรวจเครื่องเป้าหมายจริง: Pi 5 8GB / Debian 13 aarch64 / **บูตจาก SD 29GB เหลือ 19GB** /
  `graphical.target` / ยังไม่มี docker และ node
- verify: ยังไม่มีโค้ดให้ verify — ขั้นถัดไป T-001 scaffold
