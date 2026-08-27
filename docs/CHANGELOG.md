# Changelog — Meter

<!-- AI อัปเดตหลังจบทุก step (กติกาใน CLAUDE.md ข้อ 7). ใหม่สุดอยู่บน.
     1 step = 1 ก้อน 3-6 บรรทัด: ทำอะไร/ทำไม + verify ยังไง. อ้าง ticket ถ้ามี (T-00N).
     ความเสี่ยง: 🟢 ต่ำ / 🟡 กลาง / 🔴 สูง (แตะ production/hardware/ข้อมูล) -->

---

## คู่มือให้ทีม AI ส่งข้อมูล  🟢  (2026-08-27)
- `docs/PUBLISHING-GUIDE.md` — broker/topic/payload + โค้ด Python (paho-mqtt) พร้อมใช้
  + คำสั่ง `mosquitto_pub` ทดสอบ 30 วินาที + วิธีเช็คว่าข้อมูลเข้าจริงจาก `/api/health`
- เน้น 3 เรื่องที่พลาดแล้วเจ็บ: อ่านไม่ออกต้องส่ง `UNREADABLE` **ห้ามส่ง 0** ·
  `frame_id` ห้ามซ้ำ (เป็นกุญแจกันข้อมูลซ้ำ) · ต้องตั้ง **LWT** ไม่งั้นแยก "ตาย" กับ "ยังไม่ถึงรอบส่ง" ไม่ออก
- verify: รันคำสั่ง `mosquitto_pub` ในคู่มือกับระบบจริง → `invalid` ไม่ขยับ, การ์ด `pt-test` โผล่
  พร้อม `enabled=false` ตามที่เขียนไว้ · ทดสอบ payload ผิดสัญญา → log ที่ server พิมพ์
  ตรงกับตัวอย่างในคู่มือเป๊ะ

## T-006 Dashboard UI  🟢  (T-006)
- หน้าเดียว: แถบสถานะ 3 เครื่อง + การ์ดต่อจุดวัด (เกจ + ตัวเลขใหญ่ + sparkline)
  ธีมเข้มคอนทราสต์สูง เพราะจอไปอยู่บนผนังโรงงานและเปิดค้าง 24 ชม.
- **ไม่ใช้ Recharts** เขียน SVG เอง (D-009) — bundle 191KB → **199KB** (+8KB) ทั้งหน้า
- **แยก min_value/max_value ออกจาก fixture** (D-010) ไม่งั้น UI วาดเกจไม่ได้เลยเพราะ fixture
  เป็น null จนกว่าจะมีคนตั้งกล้องเสร็จ
- กติกาการแสดงผลที่ยึด: `UNREADABLE` **ไม่แสดงตัวเลขใด ๆ** (เขียน 0 หรือ "-" จะทำให้อ่านผิดว่าค่าตก) ·
  sparkline **ขาดเป็นช่วง** ตรงที่อ่านไม่ออก ไม่ลากเส้นผ่าน · ค่าเก่า/เครื่องตาย → หรี่ทั้งใบ
- 🔴 แก้บั๊ก 2 ตัวที่เจอตอนทดสอบจริง (ไม่ใช่ตอนอ่านโค้ด):
  1. จัดลำดับ `unreadable` มาก่อน `stale` → การ์ดที่อ่านไม่ออกเมื่อนาทีที่แล้วแล้วเงียบไป
     ไม่ถูกหรี่ ดูเหมือนเพิ่งเกิด → สลับให้ความเก่าของข้อมูลมาก่อนคุณภาพของค่าเสมอ
  2. `last_frame_at` มาจาก `/api/devices` ที่โหลดครั้งเดียวตอนเปิดหน้า และ SSE `device`
     ไม่ได้ส่งมาด้วย → แถบสถานะขึ้น "ไม่ส่งข้อมูล" ตลอดไปทั้งที่เฟรมไหลปกติ
     (จอ kiosk เปิดค้างเป็นเดือนจะเจอตลอด) → เลื่อน last_frame_at จาก event readings
- verify: mock 3 เครื่อง 10 จุด → 10 การ์ด · SSE "เชื่อมต่ออยู่" · **ค่าขยับเองไม่ต้อง refresh**
  (2.06bar → 2.20bar) · ทศนิยมตามสเกล (0.0521mm 4 ตำแหน่ง / 389psi 0 ตำแหน่ง) ·
  ปิด mock → `card-offline` ครบ · เครื่อง ONLINE แต่ไม่ส่งเฟรม → `dev-quiet` + `card-stale` แยกกันถูกต้อง ·
  ปล่อยรันเกิน 30 วิ หลังแก้บั๊ก → `dev-ok` ทั้ง 3 ไม่ขึ้น stale ผิด ๆ

## T-005 API + SSE  🟢  (T-005)
- `GET /api/points` — ใช้ **LEFT JOIN LATERAL ... LIMIT 1** ไม่ใช่ join ธรรมดา เพราะจุดที่ยังไม่เคย
  มีค่าเลย (ingest เพิ่งสร้าง / กล้องเพิ่งเสีย) ต้องยังโผล่บนจอ ถ้าหายไปเงียบ ๆ คนดูจะไม่รู้ว่ามีจุด
  ที่ไม่ส่งค่ามา ซึ่งเป็นข้อมูลสำคัญที่สุด · LATERAL วิ่งเข้า index (point_id, captured_at DESC) ตรง ๆ
- `GET /api/points/:id/history?range=15m|6h|7d` — **รวมเป็น bucket** (~240 จุด/กราฟ) คืน
  avg/min/max + จำนวน UNREADABLE/UNCERTAIN ต่อ bucket
  · ไม่คืนแถวดิบแล้ว cap เพราะการ cap จะทำให้กราฟโชว์แค่ช่วงท้ายของ range โดยคนดูนึกว่าเห็นครบ
  · คืน min/max ด้วยไม่ใช่แค่ avg เพราะค่าพุ่งชั่วขณะจะถูกเฉลี่ยกลบ
  · range ผิดรูปแบบหรือเกิน 30d → 400 (กันสแกนทั้งตารางบน Pi)
- `GET /api/devices` — `status` (จาก LWT) คู่กับ `last_frame_at` เพราะสองอันจับคนละอาการ:
  เครื่องตาย vs เครื่องยังต่ออยู่แต่ AI หยุดอ่าน
- `GET /api/stream` — SSE (ไม่ใช่ WebSocket เพราะข้อมูลไหลทางเดียวและ SSE ต่อใหม่เองเมื่อสายหลุด
  ซึ่งสำคัญกับจอ kiosk ที่ไม่มีคนกด refresh) + keepalive 15s + คิวกันลำดับสลับ
- เพิ่ม `sse_clients` ใน `/api/health` — ใช้ดูว่ามีกี่จอต่ออยู่ และเป็นตัวจับ listener รั่ว
- verify: mock 3 เครื่อง 10 จุดยิงจริง → `/api/devices` 3 เครื่อง ONLINE · `/api/points` 10 จุดครบ
  · history range=15m ได้ 9 bucket (bucket_seconds=3) · range=99y และ 60d ได้ 400 ·
  SSE 14 วิ ได้ hello + readings 6 ครั้ง (เห็นค่านอกสเกล 16.6 บนสเกล -5..15 ไหลผ่านด้วย) ·
  **sse_clients 0 → 2 → 0** พิสูจน์ว่า listener ถูกถอดจริง

## T-004 ingest: MQTT → validate → DB  🟡  (T-004)
- `src/server/ingest/index.ts` อยู่ใน process เดียวกับ Hono (D-001) · `src/server/events.ts` ส่งค่าสด
  ต่อให้ SSE ผ่าน EventEmitter (ห่อไว้ เผื่อวันหนึ่งต้องเปลี่ยนเป็น LISTEN/NOTIFY โดยฝั่งเรียกไม่ต้องแก้)
- **ทำให้ idempotent** — เพิ่ม unique (point_id, frame_id) + ON CONFLICT DO NOTHING (D-008)
  เพราะ QoS 1 = at-least-once และ retained frame ถูกส่งกลับมาทุกครั้งที่ subscribe ใหม่
  ถ้าไม่ทำ จำนวนแถวจะเกินจริงเงียบ ๆ และกราฟจะมีจุดซ้อนที่เวลาเดียวกัน
- **จุดวัด/เครื่องที่ไม่รู้จัก → สร้างให้เลย (`enabled=false`, `fixture=null`)** ไม่ทิ้งข้อความ
  ทิ้งไปคือค่าที่ AI อ่านมาได้แล้วหายเพราะ config ฝั่งเรายังไม่ตรง ซึ่งกู้คืนไม่ได้
- `clientId` ของ ingest คงที่ (`meter-ingest`) ไม่ผูกกับ pid — ไม่งั้น `clean:false` ไร้ความหมาย
  เพราะ broker จะเห็นเป็น client คนละตัวทุกครั้งที่ restart แล้วทิ้งคิวเดิม
- `/api/health` ตรวจ Postgres จริงและ **ตอบ 503 เมื่อ DB ล่ม** (เดิม TODO ค้างไว้จาก T-001) +
  โชว์ stats ของ ingest (received/invalid/inserted/duplicate)
- verify: `smoke-ingest` ผ่าน 12/12 — auto-create device/point · ส่งซ้ำไม่เพิ่มแถว ·
  UNREADABLE เป็น null · ข้อความเสีย 3 แบบ (JSON พัง / ผิดสัญญา / device_id ไม่ตรง topic)
  ไม่ทำ process ตาย และข้อมูลดีที่ตามมายังเข้าได้
- 🔴 พบระหว่างทาง: **VS Code Remote-SSH forward พอร์ต 1883 ไป Pi** ทำให้เทสที่คิดว่ารันในเครื่อง
  จริง ๆ ต่อไป broker บน Pi (บันทึกใน HANDOFF) — ผลเทสยังใช้ได้ แต่ dev env ต้องแก้ให้ตรงเอกสาร

## T-003 DB schema + migration  🟢  (T-003)
- 3 ตาราง: `devices` (status มาจาก LWT แยกจาก heartbeat) · `points` (fixture เป็น jsonb และ
  **nullable** เพื่อให้ ingest สร้างจุดที่ยังไม่รู้จักได้ ไม่ต้องทิ้งค่าที่อ่านมาแล้ว) · `readings`
- `readings` เก็บ `captured_at` (นาฬิกา edge) คู่กับ `received_at` (นาฬิกาเรา) เสมอ — ถ้าเก็บอันเดียว
  แล้วเวลาเพี้ยนจะไม่มีทางรู้ว่าเพี้ยนที่ใคร (OPEN-5) · index: btree (point_id, captured_at DESC) + BRIN
- **ยังไม่ partition** ต่างจากที่ D-002 วางไว้ — เหตุผลใน D-007 (partition ที่ไม่มีงานสร้างล่วงหน้า
  จะทำให้ INSERT พังตอนขึ้นเดือนใหม่ = ข้อมูลหายบนเครื่องที่ไม่มีคนเฝ้า) → เปิด T-009/T-010 แทน
- ย้ายรายการจุดวัดจาก `scripts/mock-edge-publisher.ts` ไป `src/db/dev-inventory.ts` ให้ seed กับ mock
  ใช้แหล่งเดียวกัน — เดิมจะกลายเป็น parallel structure แล้วเพี้ยนจนดูเหมือนบั๊กของ ingest
- verify: `db:migrate` ผ่านบน Postgres เปล่า · `db:seed` รันซ้ำได้ (devices=3 points=10 ไม่เพิ่ม) ·
  `smoke-db` ผ่าน 9/9 — จุดสำคัญคือ **UNREADABLE เก็บเป็น null ไม่ใช่ 0**, ค่านอกสเกล (0.2 บนสเกล
  0..0.099) เก็บได้ไม่ถูก reject, ทศนิยม 10 หลักไม่ถูกปัด, และ FK ปฏิเสธ point ที่ไม่รู้จัก
  (สัญญาที่ T-004 ต้องรับมือ: สร้าง point ก่อนแล้วค่อยเขียน reading)

## MQTT ครบวงบน Pi 5  🟡  (2026-08-26)
- `verify-contract 25` บน Pi ผ่าน 2 รอบ: 24 ข้อความ · parse ไม่ผ่าน 0 · ครบ 3 เครื่อง · status ONLINE
- ✅ **graceful shutdown (Ctrl+C) ทำงานบน Linux จริง** → OFFLINE ครบ 3 (บน Windows ทดสอบไม่ได้)
- ✅ **LWT (kill -9) ยืนยันบน Pi แล้ว** — เห็น ONLINE → ฆ่าดิบ → พลิกเป็น OFFLINE
  (รอบแรกสรุปไม่ได้เพราะ retained ค้างจากรอบก่อน บทเรียน: เทส retained ต้องเห็นค่า "ก่อน" เสมอ
  ไม่งั้นได้ false positive)
- กับดักที่เจอระหว่างตั้ง broker (บันทึกใน HANDOFF): mosquitto จาก apt จองพอร์ต 1883 อยู่ก่อน ·
  container ที่ `run` ล้มตอน setup network จะไม่มี port mapping แม้ `start` ได้ · `ss` ตรวจพอร์ต Docker ไม่ได้
- verify: ผลจริงข้างบนทั้งหมด — **เรื่อง platform ปิดครบ** (arm64, build, MQTT, LWT ทั้งสองเส้นทาง)

## ขึ้น Pi 5 ครั้งแรก — scaffold รันบนเครื่องจริงได้  🟡  (2026-08-26)
- ลง Docker 29.7.2 (arm64) + Bun 1.4.0 บน Pi · clone repo ไว้ที่ `~/Meter` · รัน `meter-mqtt` container
- ✅ **`bun run build` บน Pi = 178ms** (dev Windows 186ms) → ยืนยัน D-001/D-003 บนฮาร์ดแวร์เป้าหมาย
- เปิด http://smsn-pi-office-01.local:3000 จากเครื่อง Windows เห็นหน้า "ok · uptime 76s" จริง
  → ใช้ mDNS แทน IP ได้ ไม่ต้องตามหา IP ที่เปลี่ยนไปมาอีก
- กับดักที่เจอระหว่างทาง (บันทึกใน HANDOFF): terminal เดสก์ท็อป Pi เป็น non-login shell อ่านแค่ `.bashrc` ·
  `usermod -aG docker` ต้อง login ใหม่ · `apt-listchanges` ของเครื่องพังอยู่ก่อนแล้ว
- verify: หน้าเว็บขึ้นจริงจากเครื่องอื่นในวง LAN · **ยังไม่ได้ทดสอบ MQTT ครบวงบน Pi**

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
