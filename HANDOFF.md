# HANDOFF — Meter (อ่านก่อนเริ่ม session ใหม่)

> อัปเดตล่าสุด **2026-08-28**
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

## สถานะ ณ 2026-09-01

**T-001…T-007 · T-009 · T-012 เสร็จแล้ว** — ระบบรันจริงบน Pi 5 (systemd + kiosk autostart)
รับข้อมูลจริงจาก edge ของทีม AI อยู่

**T-012 + D-014 (ธีมสว่าง+กรอบใหม่) deploy ขึ้น Pi แล้ว** (ผู้ใช้ deploy เอง 2026-09-01)
— ดูจอจริงแล้วเจอว่า **banner สถานะ + confidence bar ไม่ขึ้นเลย** (D-014 แก้แค่สี/เส้นขอบ
ไม่ได้พอร์ต 2 ฟีเจอร์นี้จาก mock เข้า component จริง) แก้แล้วที่ commit `e49fabc`
พร้อมเจอเพิ่มว่า `.card-unreadable` ไม่มีขอบหนาเลยตั้งแต่ D-014 (แก้พร้อมกัน)

**เพิ่มปุ่มสลับธีมมืด/สว่างที่ topbar แล้ว (D-015, commit `b20bc6e`)** — ผู้ใช้ขอหลัง deploy
เพราะอยากเทียบบนจอจริงกับข้อมูลสดตรง ๆ ล้มมติเดิมของ D-014 ที่ตั้งใจไม่ทำ toggle
ธีมมืดที่เอากลับมาไม่ใช่ของเดิมตรง ๆ — แก้ contrast bug เดียวกับที่ audit เจอในธีมสว่างด้วย
(รายละเอียดเต็มดู D-015 ใน `docs/DECISIONS.md`)

🔴 **`e49fabc` และ `b20bc6e` ยังไม่ได้ deploy ขึ้น Pi** — ทดสอบผ่าน `bun run dev:all`
บนเครื่อง dev แล้วเท่านั้น (ครบทั้ง 2 ธีม + ทุก state) จอ Pi ตอนนี้ยังเป็นเวอร์ชันที่ไม่มี
banner/confidence bar/toggle
```bash
git pull && bun install && bun run build && sudo systemctl restart meter && ~/Meter/deploy/kiosk/kiosk-restart.sh
```

**ค้างอยู่**
- **T-010 backup** = `doing` — สคริปต์ + timer + restore-test ทำครบและทดสอบผ่านแล้ว
  เหลือแค่ยังไม่มีปลายทาง `BACKUP_REMOTE` (ผู้ใช้บอก "ยังไม่มี ปล่อยไว้ก่อน")
  → API `/api/health` จะขึ้น `warning` ว่าไม่มีสำเนานอกเครื่อง ซึ่ง**ตั้งใจให้ขึ้น** อย่าไปปิด
- **T-011 snapshot** = บล็อก รอทีม AI ทำฝั่ง publish (เคาะทางแล้ว: MQTT topic แยก · D-013)
- **T-008 auth** = ยังไม่แตะ — broker `allow_anonymous` + wayvnc เปิด `*:5900` ไม่มีรหัส
  จงใจเปิดไว้ตอน dev · 🔴 **ต้องปิดทั้งคู่ก่อนเข้าโรงงานจริง**

### ▶ ของที่รอ "คนอื่น" ตอบ

**1. รอทีม AI** — ดู 🔴 หัวข้อคำถามด้านล่าง (สเกล `pt-gauge-01` ยังบล็อกการวาดเกจอยู่)

### สิ่งที่รู้แล้วจากการทำ mock (อย่าลืมตอนลงมือจริง)

🔴 **ถ้าเปลี่ยนไปธีมสว่าง จะเปลี่ยนแค่ชุดสีไม่ได้** — ตอนนี้ "ค่าเก่า/ออฟไลน์" สื่อสารด้วย
`opacity: .55` อย่างเดียว ซึ่งได้ผลบนพื้นมืดเพราะการ์ด**จมหายไปในพื้น** แต่บนพื้นขาว
การ์ดยังขาวอยู่ แค่ตัวหนังสือจาง → ตาอ่านว่า "ปกติแต่เบลอ" ไม่ใช่ "เชื่อไม่ได้"
mock แก้ด้วยการเติม**ขอบประ** ซึ่งอ่านออกทั้งสองธีม

🔴 **ภาพในการ์ดหน้ารวมเล็กเกินกว่าจะ "ตรวจสอบ" ได้จริง** — วัดจาก mock: การ์ดในกริด 320px
เหลือที่ให้ภาพ **116×73 px** หน้าปัดกินราว 60% = ~70px ซึ่งมองไม่เห็นเข็ม
→ ภาพในหน้ารวมทำได้แค่บอกว่า "มีภาพ / ฉากดูปกติไหม" **การตรวจว่า AI อ่านถูกไหมต้องทำในแผงรายละเอียด (T-012)**
ที่ให้ภาพได้ 400–600px · ตอนทำ T-011 จริงให้เอาภาพลงแผงรายละเอียดก่อน อย่าเริ่มที่การ์ด
· ยิ่งกว่านั้น หลายจุดที่มาจากกล้องตัวเดียวกันจะได้ภาพคล้ายกันจนหน้ารวมดูซ้ำไปหมด

⚠️ **ต้องถามทีม AI เพิ่ม: สัดส่วนภาพ (aspect ratio) ที่จะส่งมา** — mock ใช้ `object-fit:cover`
ซึ่งบังเอิญครอปแถบบนของภาพ bench ออกพอดี แต่ถ้าของจริงมาสัดส่วนอื่น อาจครอปหน้าปัดขาด

⚠️ **สีสถานะชุดปัจจุบันใช้กับพื้นขาวไม่ได้** — `--uncertain:#ffba20` บนขาวแทบมองไม่เห็น
ต้องมีชุดเข้มแยกต่างหาก (mock ใช้ `#8a5000`) · และ ref เองก็ขัดกันเอง: frontmatter ให้เขียว
`#006e2a` แต่ prose เขียน `#00C853` ซึ่ง contrast บนขาวได้แค่ ~2.2:1 (ต่ำกว่าเกณฑ์ 4.5:1) — **ใช้ตัว frontmatter**

❌ **ที่ตัดทิ้งจาก ref แล้ว อย่าเผลอเอากลับมา** — ปุ่ม **Emergency Stop** (ระบบเราอ่านอย่างเดียว
ไม่มีเส้นทางไปสั่งเครื่องจักร ปุ่มที่ดูคุมได้แต่คุมไม่ได้อันตรายกว่าไม่มีปุ่ม) ·
**Manual Override / Acknowledge / Flag as Error** (สื่อว่ามีการเขียนกลับ ซึ่งยังไม่มีและถ้าจะมี
ต้องมี audit trail) · เมนู sidebar ที่กดแล้วไม่ไปไหน

▶ **ส่ง `docs/PUBLISHING-GUIDE.md` ให้ทีม AI** — คู่มือ publish พร้อมโค้ด Python ใช้ได้เลย
  (ทดสอบคำสั่งในคู่มือกับระบบจริงแล้ว) · ท้าย `src/contract/messages.ts` มี OPEN-1..7 ที่ยังต้องให้เขาเคาะ

### เครื่อง dev (Windows, เครื่องที่กำลังนั่งอยู่)
| | |
|---|---|
| Bun | ✅ v1.4.0 อยู่ใน PATH |
| Docker Desktop | ✅ เปิดแล้ว v29.7.2 |
| container `meter-mqtt` | ✅ `eclipse-mosquitto:2` -p 127.0.0.1:1883 mount `deploy/mosquitto.conf` |
| container postgres | ✅ สร้างแล้ว — ขึ้นพร้อมกันด้วย `bun run stack:up` (compose `name: meter`) |
| git ในโฟลเดอร์นี้ | ✅ `main` @ 066c256 · remote `origin` = github.com/shootle48/SMART_Insight_Web_Application |
| ⚠️ Docker Desktop | Windows ปิดเองเวลาเครื่อง idle/restart — เปิดก่อนเสมอ ไม่งั้น `stack:up` ล้ม |

### Pi 5 (เครื่องเป้าหมายจริง)
| | |
|---|---|
| สเปก | Pi 5 Model B Rev 1.1 · RAM 7.9GB · Debian 13 trixie · aarch64 · `graphical.target` |
| storage | **บูตจาก SD 29GB** — เคาะแล้วว่า Postgres อยู่บน SD (D-006) + throttle ที่ ingest (D-012) + retention (T-009) ; backup ด้วย `pg_dump` ผ่าน systemd timer |
| service | ✅ `meter.service` (systemd) + kiosk autostart ผ่าน `.desktop` เรียก `/bin/bash kiosk-launch.sh` |
| docker | ✅ 29.7.2 `linux/arm64` · user `pi` อยู่ใน group `docker` แล้ว |
| bun | ✅ 1.4.0 ที่ `~/.bun/bin/bun` |
| node | ❌ ไม่ได้ลง และ**ไม่ต้องลง** — Bun แทนทั้งหมด |
| โปรเจกต์ | ✅ clone ไว้ที่ `~/Meter` · `bun run build` = **178ms** |
| container `meter-mqtt` | ✅ `-p 1883:1883` (เปิดทุก interface ให้ edge ยิงเข้าได้) |
| ชื่อเครื่อง | `smsn-pi-office-01` → ใช้ **`smsn-pi-office-01.local`** แทน IP ได้เลย (mDNS/avahi)
  เว็บอยู่ที่ http://smsn-pi-office-01.local:3000 — ไม่ต้องตามหา IP ที่เปลี่ยนไปมา |

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

**ตอบแล้วจากข้อมูลจริง (2026-08-28)**
- อัตรายิง: เคยวัดได้ 26 เฟรม/วิ ตอนนี้ ~0.29/วิ (เขาน่าจะใส่ throttle เอง) → เราใส่ throttle ฝั่งเราแล้ว (D-012)
- ส่งเลขล้วน ไม่มีภาพ · มี heartbeat จริง (`sw=1.0.0 model=hough-polar-v1`) · ตั้ง LWT ถูก
- `quality` มีแค่ OK/UNREADABLE ไม่มี UNCERTAIN → เขาใช้เกณฑ์ตัดขาด (ตอบ OPEN-2 ไปในตัว)

**ยังต้องถามอยู่** — รวมไว้ใน `docs/SNAPSHOT-PROPOSAL.md` แล้ว ส่งลิงก์ให้เพื่อนอ่านได้เลย
- 🔴 **เพื่อนวางแผนส่ง snapshot เป็น base64 ผ่าน MQTT** — จะทำให้ SD เต็มใน ~14 วัน
  และ broker เขียน SD ซ้ำอีกรอบเพราะเปิด persistence ไว้ → เสนอเปลี่ยนเป็น HTTP POST ไบต์ดิบ
  เฉพาะตอน quality != OK + เพดาน 1 ภาพ/นาที/จุด (~72 MB/วัน) **รอเขาตอบ**
- 🔴 **`pt-gauge-01` อ่านได้ช่วงไหน (min/max)** — ไม่มีสเกลก็วาดเกจไม่ได้ ขึ้นแต่ตัวเลขซึ่งคนดูตีความไม่ได้
- **UNREADABLE 47%** — ยังสูงมาก น่าจะเป็นเรื่องมุมกล้อง/แสง ไม่ใช่ตัวโมเดล

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
- 🔴 **VS Code หน้าต่างที่ต่อ Pi จะ auto-forward พอร์ตของ Pi มาโผล่ที่เครื่อง dev เอง**
  (`Origin: Auto Forwarded`) ทำให้ `localhost:<port>` บนเครื่อง dev อาจเป็นของ Pi โดยไม่มีใครสั่ง
  ถ้าเลขเดิมถูกใช้อยู่แล้ว มันจะหลบไปเลขถัดไปเงียบ ๆ — เคยเจอ Pi:1883→dev:1884, Pi:3000→dev:3001
  · เช็คที่แท็บ **PORTS** ของหน้าต่างที่ต่อ Pi (หน้าต่าง local จะว่างเสมอ อย่าดูผิดหน้าต่าง)
  · ปิดถาวรด้วย `"remote.autoForwardPorts": false`
  · ⚠️ อันตรายเมื่อ Pi ต่อสายการผลิตจริง: รัน mock บน dev แล้วข้อมูลปลอมจะวิ่งเข้าเครื่องจริง
  · **ห้ามใช้ `Stop-Process -Force` กับ PID ที่เจอจาก port** — เคยฆ่า process ของ VS Code มาแล้ว
- 🔴 **Pi เครื่องนี้มี mosquitto จาก apt จองพอร์ต 1883 อยู่ก่อนแล้ว** (`active`+`enabled`, bind แค่
  loopback จึงใช้กับ edge ไม่ได้) → `docker run -p 1883:1883` ล้มด้วย `address already in use`
  แก้แล้วด้วย `sudo systemctl disable --now mosquitto` (คืนสภาพ: `enable --now`)
- 🔴 **`docker run` ที่ล้มตอน setup network จะทิ้ง container ที่ "Up" ได้แต่ไม่มี port mapping**
  `docker start` ซ้ำไม่ช่วย — ต้อง `docker rm -f` แล้ว `run` ใหม่ ; อาการคือ `Connection refused`
  ทั้งที่ container ขึ้นและ log ปกติ
- **อย่าใช้ `ss -lptn` ตรวจพอร์ตของ Docker รุ่นใหม่** — forward ผ่าน netfilter ไม่มี process listen
  บนโฮสต์ `ss` จึงว่างทั้งที่พอร์ตใช้ได้ **ให้ดู `docker port <name>` แทน**
- **terminal บนเดสก์ท็อป Pi เป็น non-login shell** → อ่าน `~/.bashrc` ไม่อ่าน `~/.profile`
  (SSH เป็น login shell อ่านทั้งคู่) ; ลงอะไรที่เติม PATH แล้วยังหาไม่เจอ = หน้าต่างนั้นเปิดค้างมาก่อน
  แก้ด้วย `source ~/.bashrc` หรือเปิดหน้าต่างใหม่ — อย่าไปเติมซ้ำใน `.profile`
- **`usermod -aG docker` ไม่มีผลกับ shell ที่เปิดอยู่แล้ว** — group ติดมากับ login token ต้อง login ใหม่
- **`apt-listchanges` บนเครื่องนี้พังอยู่** (`ModuleNotFoundError`) เด้ง traceback ทุกครั้งที่ apt ทำงาน
  ไม่กระทบการติดตั้ง แก้ด้วย `sudo apt purge apt-listchanges` ถ้ารำคาญ
- **ห้ามก๊อป `node_modules/` ขึ้น Pi** — ของบนเครื่อง dev เป็น Windows x64 ต้อง `bun install`
  ใหม่บน Pi ให้ดึง arm64 มาเอง (`.gitignore` กันไว้แล้ว) ; `dist/` ก็ build ใหม่บน Pi
- **`.gitattributes` ปักหมุด `eol=lf`** — อย่าถอด ไม่งั้น shell script ที่เขียนบน Windows
  จะขึ้น Pi แล้วพังด้วย `bad interpreter: /bin/bash^M`
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
