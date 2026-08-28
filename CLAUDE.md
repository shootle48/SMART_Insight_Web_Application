# กฎการทำงานร่วมกัน (OVERRIDE default — ยึดตลอด session)

1. **อธิบายเป็นภาษาไทยก่อนเสมอ** — ก่อนลงมือแก้โค้ด อธิบายว่าจะทำอะไร เพราะอะไร
2. **ให้เหตุผล + trade-off** — ผู้ใช้อยากเข้าใจ ไม่ใช่แค่ได้โค้ด
3. **ทำทีละขั้น หยุดรอ confirm** ก่อนขั้นถัดไป — ห้ามทำรวดเดียวจบ
4. **ห้ามแตะ `venv/` `.venv/`** เด็ดขาด
5. **ห้ามสร้างไฟล์/โครงสร้างซ้ำซ้อนขนานของเดิม** — แก้ที่ของเดิมเสมอ
6. งานใหม่/แก้ใหญ่ → ทำตาม `docs/WORKFLOW.md` (plan → design → tickets → ทำทีละใบ)
7. จบทุก step → อัปเดต `docs/CHANGELOG.md` (ใหม่สุดอยู่บน) ; เคาะเรื่องใหญ่ → จด `docs/DECISIONS.md`
8. **พฤติกรรมที่คาดหวัง → อ่าน `docs/AI-GUIDE.md` ก่อนเริ่มงานแรก**

# โปรเจกต์นี้

- **คืออะไร:** รับค่าที่ AI อ่านได้จากหน้าปัดในตู้โรงงาน (7-segment, gauge meter, ไฟสถานะ)
  ผ่าน MQTT → เก็บลง DB → แสดงบนจอ kiosk ให้ฝ่ายผลิตดูสด ๆ
- **Target:** Raspberry Pi 5 8GB · Debian 13 (trixie) aarch64 · **บูตจาก SD 29GB** (เหลือ ~19GB)
  ทำหน้าที่ทั้ง server และจอ kiosk ในตัวเดียว
- **ต้นทางข้อมูล:** edge device ของทีม AI — สัญญาใช้งานจริงแล้ว (`invalid`=0) ดู `src/contract/`
  งาน OCR/gauge ต้นทางอยู่ที่ `../` (`gauge_bench.py`, `bench/samples.json`)
- **Stack:** Bun · Hono · Vite + React 19 · TypeScript · Drizzle + Postgres 17 · MQTT.js + Mosquitto 2 · กราฟเขียน SVG เอง (D-009)
- **สถานะ:** รันบน Pi 5 หน้างานแล้ว (systemd + kiosk) · ทีม AI เริ่มส่งข้อมูลจริงเข้ามาแล้ว

## รัน / เทส

```bash
bun install

# --- เทสบนเครื่อง dev: 3 ขั้น ---
# 0) เปิด Docker Desktop ก่อน (Windows ปิดเองเวลาเครื่อง idle/restart)
bun run stack:up       # postgres + mosquitto
bun run dev:all        # server + หน้าเว็บ + mock ยิงข้อมูล พร้อมกันในคำสั่งเดียว
#    → เปิด http://localhost:5173

bun run stack:status   # เช็คว่า container ขึ้นครบไหม
bun run stack:down     # หยุด container (ข้อมูลไม่หาย อยู่ใน volume)

bun run dev            # เฉพาะ server + web (ไม่มี mock)
bun run mock-edge      # เฉพาะ mock — ปฏิเสธ broker ที่ไม่ใช่ localhost เว้นแต่ใส่ --allow-remote
bun run build          # ออก dist/ สำหรับ deploy

bun run db:migrate     # สร้าง/อัปเดตตาราง
bun run db:seed        # ใส่เครื่อง+จุดวัดตั้งต้น (รันซ้ำได้)
bun run db-peek        # ส่องว่าใน DB มีอะไรอยู่ (อ่านอย่างเดียว)
bun run smoke-db       # พิสูจน์พฤติกรรม schema (null/นอกสเกล/FK)
bun run smoke-throttle # พิสูจน์ว่า throttle บีบข้อมูลแต่ไม่กลืนการเปลี่ยนสถานะ
bun run smoke-retention# พิสูจน์ว่า retention ลบเฉพาะของเก่า
bun run verify-contract 25   # พิสูจน์ว่า mock ยิงตรงสัญญา (ต้องรัน mock-edge คู่กัน)
```

## โครงสร้างสำคัญ (ที่เหลือดู docs/ARCHITECTURE.md)

| path | หน้าที่ |
|---|---|
| `src/contract/` | **สัญญากับทีม AI** — Zod + topic map ; จุดเดียวที่นิยาม message ที่รับเข้ามา |
| `src/db/` | Drizzle schema + connection + migration + `dev-inventory.ts` (รายการจุดวัด ใช้ร่วมกับ mock) |
| `src/server/ingest/` | MQTT subscriber → validate → เขียน DB (อยู่ process เดียวกับ API) |
| `src/server/api/` | Hono routes + SSE ส่งค่าสดขึ้นหน้าเว็บ |
| `src/web/` | React dashboard (Vite) |
| `scripts/` | `mock-edge-publisher.ts` — จำลอง edge จนกว่าของจริงจะมี |
| `deploy/` | docker-compose (postgres+mosquitto), systemd unit, kiosk autostart |

## เปิดเมื่อเกี่ยวข้อง (อย่าโหลดถ้าไม่ใช้)

- **ทีม AI จะส่งข้อมูลเข้ามา → ส่ง `docs/PUBLISHING-GUIDE.md` ให้เขาอ่าน**
- **เรื่องส่งภาพ snapshot → `docs/SNAPSHOT-PROPOSAL.md`** (เคาะแล้ว: MQTT topic แยก · D-013)
- **เริ่ม session ใหม่ → `HANDOFF.md` ก่อนเสมอ** (สถานะเครื่อง · ของค้าง · คำถามค้างกับทีม AI · กับดัก)
- ออกแบบ/แก้โครงสร้าง → `docs/ARCHITECTURE.md`
- จะเริ่มงานใหม่/ดู backlog → `docs/TICKETS.md`
- สงสัยว่าทำไมตัดสินใจแบบนี้ → `docs/DECISIONS.md`
- จะเอาขึ้น Pi → `docs/DEPLOYMENT.md`
- ประวัติงานที่ทำแล้ว → `docs/CHANGELOG.md`
