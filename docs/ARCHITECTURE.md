# ARCHITECTURE — Meter (อ่านค่าหน้าปัดในตู้โรงงาน → dashboard + DB)

<!-- อัปเดตเมื่อโครง "เปลี่ยนจริง" เท่านั้น -->

## ภาพรวม

edge device 3 ตัวของทีม AI ส่องกล้องไปที่หน้าปัดในตู้ไฟ อ่านค่าด้วยโมเดล (7-segment,
เข็ม gauge, ไฟสถานะ) แล้ว **publish เฉพาะตัวเลขที่อ่านได้** ผ่าน MQTT — ไม่ส่งภาพ
Pi 5 หนึ่งเครื่องทำหน้าที่ทั้ง broker, ingest, DB, web server และจอ kiosk

**ยังไม่มีของจริง** — สัญญาใน `src/contract/` เป็นข้อเสนอที่เราเขียนไปให้ทีม AI เคาะ
`scripts/mock-edge-publisher.ts` ยิงตามสัญญานั้นแทน edge จริง

## Data flow หลัก

```
[edge ×3]  YOLO+OCR อ่านหน้าปัด
    │  MQTT publish  meter/<device_id>/meter_frame     QoS 1, retained
    │                meter/<device_id>/device_heartbeat QoS 1
    ▼
[Mosquitto 2]  (Docker บน Pi 5)
    │  subscribe meter/+/+   persistent session (clean:false)
    ▼
┌─ Bun process เดียว ────────────────────────────────┐
│  ingest/   parse → Zod validate → Drizzle → Postgres│
│      │ ค่าใหม่ทุกเฟรม → EventEmitter ในหน่วยความจำ  │
│  api/      Hono  REST (ประวัติ/config) + SSE (ค่าสด)│
│  static    เสิร์ฟ dist/ ที่ Vite build ไว้           │
└────────────────────────────────────────────────────┘
    │  HTTP + SSE (localhost)
    ▼
[Chromium --kiosk]  บน Pi ตัวเดียวกัน
```

**ทำไม ingest กับ api อยู่ process เดียวกัน:** ค่าสดส่งต่อผ่าน EventEmitter ในหน่วยความจำได้เลย
ไม่ต้องพึ่ง Postgres LISTEN/NOTIFY และเหลือ systemd unit เดียวบนเครื่องหน้างาน (D-001)
ยอมแลกกับ web server ล่ม = ingest ล่มด้วย — รับได้เพราะ MQTT QoS 1 + persistent session
ทำให้ข้อความที่ค้างช่วง restart ถูกส่งซ้ำให้ครบ

## โฟลเดอร์ = หน้าที่ (กฎ: ใครห้ามรู้จักใคร)

| path | หน้าที่ | ห้าม |
|---|---|---|
| `src/contract/` | **สัญญากับทีม AI** — Zod schema + topic map | import db/server/web |
| `src/db/` | Drizzle schema, connection, migration | มี business logic |
| `src/server/ingest/` | MQTT client → validate → เขียน DB → emit ค่าสด | รู้จัก React/UI |
| `src/server/api/` | Hono routes + SSE | แตะ MQTT ตรง |
| `src/web/` | React dashboard | แตะ DB/MQTT ตรง — คุยผ่าน API เท่านั้น |
| `scripts/` | mock publisher, งาน one-off | ถูก import โดย src/ |
| `deploy/` | compose, systemd, kiosk autostart | — |

## Integration จุดเสี่ยง

- **retained message ค้าง** — frame ล่าสุด publish แบบ retained เพื่อให้ kiosk ที่เพิ่งบูตเห็นค่าทันที
  ผลข้างเคียงคือ **ค่าเก่าค้างบน broker แม้ edge ตายไปแล้ว** ตัวที่บอกว่าเครื่องตายคือ
  `<prefix>/<device>/device_status` ซึ่ง edge ตั้งเป็น **LWT** ไว้ broker จึงประกาศ OFFLINE
  แทนให้แม้เครื่องดับกะทันหัน (พิสูจน์ด้วย kill -9 แล้ว — D-005)
  UI ต้องอ่าน device_status คู่กับค่าเสมอ ห้ามเชื่อว่ามีค่า = ยังมีชีวิต
  และยังต้องดูอายุ `captured_at` เพื่อจับกรณีเครื่องยังต่ออยู่แต่ AI หยุดอ่าน
- **นาฬิกา edge** — `captured_at` มาจากนาฬิกาของ edge ถ้าไม่ตั้ง NTP กราฟย้อนหลังจะเพี้ยน
  ingest เก็บ `received_at` ของฝั่งเราคู่ไว้เสมอ เทียบกันได้
- **อ่านไม่ออก ≠ ค่าเป็น 0** — `quality: UNREADABLE` ต้องเก็บเป็นแถวที่ value เป็น null
  ห้ามแปลงเป็น 0 และ UI ต้องแสดงต่างจากค่าจริง (บทเรียน: "ตรวจไม่ได้" ≠ "ของเสีย")
- **บูตจาก SD** — Postgres + ไฟดับกะทันหัน = เสี่ยง corrupt ; ดู `docs/DEPLOYMENT.md`

## ข้อจำกัดที่ตั้งใจ (ดูเหตุผลใน DECISIONS.md)

- Postgres ล้วน ไม่มี TimescaleDB — D-002
- ไม่ใช้ Next.js — D-001
- ไม่ส่งภาพผ่าน MQTT ส่งแค่ `frame_id` — ข้อเสนอในสัญญา ยังไม่ได้ยืนยันกับทีม AI
- ยังไม่มี auth/ACL — broker เปิด anonymous บน LAN ; ทำหลัง core เดินได้
