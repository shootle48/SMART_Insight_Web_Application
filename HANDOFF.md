# HANDOFF — Meter (อ่านก่อนเริ่ม session ใหม่)

> อัปเดตล่าสุด **2026-08-25**
>
> ไฟล์นี้เก็บเฉพาะของที่ไฟล์อื่นไม่มี: **สถานะเครื่อง ณ ตอนนี้ · ของค้างกลางมือ ·
> คำถามค้างกับทีม AI · กับดักที่เจอมาแล้ว**
> ⚠️ ห้ามก๊อปเนื้อหาจากไฟล์อื่นมาไว้ที่นี่ — ชี้ทางอย่างเดียว ไม่งั้นจะขัดกันเองเมื่อของจริงเปลี่ยน

## อ่านตามลำดับนี้

1. `CLAUDE.md` — กฎ + โปรเจกต์นี้คืออะไร (โหลดอัตโนมัติทุก turn อยู่แล้ว)
2. `docs/AI-GUIDE.md` — พฤติกรรมที่คาดหวัง (อ่านก่อนงานแรกของ session)
3. ไฟล์นี้ — สถานะล่าสุด
4. `docs/TICKETS.md` — ใบถัดไปที่ต้องทำ
5. เปิดเมื่อเกี่ยวข้อง: `ARCHITECTURE.md` · `DECISIONS.md` · `CHANGELOG.md` · `DEPLOYMENT.md`

---

## สถานะ ณ 2026-08-25

**T-001 + T-002 เสร็จแล้ว** — scaffold รันได้ทั้ง dev/prod และมีสัญญา MQTT + mock + verify ที่ผ่านจริง
· ใบถัดไปคือ **T-003 DB schema + migration** (ต้องสร้าง container postgres ก่อน)

▶ **เอา `src/contract/` ไปให้ทีม AI ดูได้เลย** — ท้าย `messages.ts` มี OPEN-1..7 เป็นรายการที่เราเดาเอง

### เครื่อง dev (Windows, เครื่องที่กำลังนั่งอยู่)
| | |
|---|---|
| Bun | ✅ v1.4.0 อยู่ใน PATH |
| Docker Desktop | ✅ เปิดแล้ว v29.7.2 |
| container `meter-mqtt` | ✅ `eclipse-mosquitto:2` -p 127.0.0.1:1883 mount `deploy/mosquitto.conf` |
| container postgres | ❌ ยังไม่ได้สร้าง (รอ T-003) |
| git ในโฟลเดอร์นี้ | ❌ ยังไม่ `git init` (template README สั่งให้ทำเป็นข้อ 3) |

### Pi 5 (เครื่องเป้าหมายจริง)
| | |
|---|---|
| สเปก | Pi 5 Model B Rev 1.1 · RAM 7.9GB · Debian 13 trixie · aarch64 · `graphical.target` |
| storage | 🔴 **บูตจาก SD 29GB เหลือ 19GB** — ยังไม่ตัดสินใจว่าจะวาง Postgres ไว้ไหน (ดู T-007) |
| docker / node / bun | ❌ **ยังไม่ได้ลงสักตัว** |
| IP | ❓ **ยังไม่รู้** — หาด้วย `hostname -I` บน Pi (ifconfig บน trixie ไม่มีให้ใช้แล้ว) |

### ⚠️ อย่าสับสนสองเครื่อง
`../README.md` ของโฟลเดอร์ OCR พูดถึง **Pi Zero 2 W** (RAM 415MB, รันโมเดล YOLO)
ซึ่งเป็นคนละเครื่องกับ **Pi 5** ที่โปรเจกต์นี้จะไปลง (server + จอ kiosk ไม่รันโมเดล)

---

## ของจริงที่อ้างอิงได้ (อย่าคิดคำศัพท์ขึ้นเอง)

| ไฟล์ | มีอะไร |
|---|---|
| `../bench/samples.json` | **fixture ของ gauge จริง** — `cx, cy, r, min_angle, max_angle, min_value, max_value, unit, truth` ← ตาราง `points` กับสัญญา MQTT ต้องใช้คำศัพท์ชุดนี้ |
| `../gauge_bench.py` | ตัวอ่านเข็ม gauge + สคริปต์วัดความแม่น (527 บรรทัด) |
| `../bench/results_2026-07-31.html` | ผล bench ที่รันไว้แล้ว |
| `../README.md` | คู่มือรันโมเดลบน Pi Zero 2 W + กับดักฮาร์ดแวร์กล้อง CSI |

---

## 🔴 คำถามที่ยังไม่ได้คำตอบจากทีม AI (บล็อก T-003 เป็นต้นไป)

**ตัวเลขที่ต้องรู้ก่อนล็อก schema**
1. จุดวัดกี่จุดต่อ edge 1 ตัว และยิงถี่แค่ไหน → ตัดสินว่าต้องใช้ TimescaleDB ไหม (D-002)
2. ส่งอะไรมา — เลขล้วน หรือมีภาพ crop / confidence ด้วย
3. ชนิดค่าที่อ่าน — ทศนิยมอย่างเดียว หรือมี on/off, ไฟสี, ข้อความ
4. ต้องมี alarm/threshold ไหม → ถ้ามีตั้งแต่แรก schema ต้องเผื่อที่เก็บ

**ข้อที่เราเดาไปแล้วในสัญญา (ต้องให้เขาเคาะ — จะเขียน `OPEN:` กำกับใน `src/contract/`)**
- batch ทุกจุดในเฟรมเดียว ใช้ timestamp เดียว vs แยก message ต่อจุด
- `quality` (OK/UNCERTAIN/UNREADABLE) แยกจาก `confidence` — สมมติว่า edge รู้ตัวว่าอ่านไม่ออก
- ใครเป็นเจ้าของ `point_id` — เราตั้งแล้ว push ลงไป (ถ้าเขาอยากตั้งเอง config flow กลับด้าน)
- 🔴 **ไม่ส่งภาพผ่าน MQTT ส่งแค่ `frame_id`** — ถ้าเขาตั้งใจยัด base64 crop มา แผน storage บน SD พังทันที **ถามข้อนี้ก่อนข้ออื่น**
- `captured_at` ใช้นาฬิกา edge → edge ทั้ง 3 ตัวต้องตั้ง NTP
- 🔴 **edge ทุกตัวต้องตั้ง LWT** บน `<prefix>/<device>/device_status` (OPEN-7) — ถ้าเขาทำไม่ได้
  เราจะแยก "เครื่องตาย" กับ "ยังไม่ถึงรอบส่ง" ไม่ออก ต้องถอยไปใช้ heartbeat timeout ที่ช้ากว่า

---

## กับดักที่รู้แล้ว (เสียเวลาไปแล้ว อย่าเจอซ้ำ)

- **mosquitto 2.0** ถ้าไม่เขียน config เอง จะ bind loopback *ในคอนเทนเนอร์* (port mapping ไปไม่ถึง)
  และ `allow_anonymous` default = false → client โดน `not authorised` ทุกตัว **ต้อง mount config เสมอ**
- **retained message ไม่ตายตามคนส่ง** — edge ตายแล้วค่าเก่ายังค้างบน broker ; UI ต้องเช็คอายุ
  `captured_at` เอง และ mock ต้องล้าง retained ตอนปิด ไม่งั้นคนถัดไปเห็นเลขเก่าโดยไม่รู้ตัว
- **`ifconfig` บน Debian 13** ไม่มีติดมาแล้ว ใช้ `hostname -I` หรือ `ip -4 addr` แทน
- **`app.notFound()` ของ Hono เป็น global** — mount router ใต้ `/api` ไม่ได้กัน path ใต้ `/api`
  ที่ไม่ match ออกจากมัน ถ้าไม่ดักเอง จะได้ HTML 200 แทน 404 แล้ว client พังที่ JSON.parse
- **Bun script shell ไม่รองรับ `&`** (background command) — ใช้ `concurrently` แทน
- **Bun บน Windows ไม่ได้รับ SIGINT/SIGTERM เข้า JS handler** — `kill` จาก MSYS กลายเป็น
  TerminateProcess (process ตายด้วย exit 143 โดย handler ไม่ทำงาน) ทดสอบแล้วทั้งผ่าน
  `bun run` และรันสคริปต์ตรง ผลเหมือนกัน → **อย่าออกแบบให้ correctness ขึ้นกับโค้ดตอนปิดตัวเอง**
  ต่อให้บน Linux ทำงาน ไฟดับก็ยังพัง (ที่มาของ D-005)
- **เคยเริ่มงานนี้ผิดที่** ใน `Yoshi/YoshiOpspectWebsite` (repo พี่ Sun) ถอนออกครบแล้ว —
  ถ้าเห็นร่องรอย `lib/meter/`, `mosquitto.conf`, `mqtt` ใน package.json ที่นั่น = ตกค้าง ให้ลบ

---

## คำสั่งที่ใช้บ่อย

เช็ค IP + สเปก Pi (รันบน Pi):
```bash
hostname -I && free -h && df -h / && uname -m
```

ลง docker + bun บน Pi (ยังไม่ได้ทำ):
```bash
curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER && curl -fsSL https://bun.sh/install | bash
```

สตาร์ท broker (สร้างไว้แล้ว ปกติแค่ start พอ):
```bash
docker start meter-mqtt
```

ถ้า container หาย ต้องสร้างใหม่ (**อย่าใส่ `--rm`**):
```bash
MSYS_NO_PATHCONV=1 docker run -d --name meter-mqtt -p 127.0.0.1:1883:1883 -v "C:/Users/thepr/Claude/OCR/Meter/deploy/mosquitto.conf:/mosquitto/config/mosquitto.conf" eclipse-mosquitto:2
```

รัน mock แล้วพิสูจน์ว่าตรงสัญญา (คนละเทอร์มินัล):
```bash
bun run mock-edge
```
```bash
bun run verify-contract 25
```

ดูข้อความดิบ / ล้าง retained ที่ค้าง:
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/#' -v
```

รันเว็บ:
```bash
bun run dev
```
เปิด http://localhost:5173 (Vite proxy `/api` ไป Hono :3000) · prod: `bun run build && bun run start` → :3000
