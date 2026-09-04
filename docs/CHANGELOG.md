# Changelog — Meter

<!-- AI อัปเดตหลังจบทุก step (กติกาใน CLAUDE.md ข้อ 7). ใหม่สุดอยู่บน.
     1 step = 1 ก้อน 3-6 บรรทัด: ทำอะไร/ทำไม + verify ยังไง. อ้าง ticket ถ้ามี (T-00N).
     ความเสี่ยง: 🟢 ต่ำ / 🟡 กลาง / 🔴 สูง (แตะ production/hardware/ข้อมูล) -->

---

## ขยายฟอนต์ขั้นต่ำ 18px เพื่อความอ่านง่ายบนจอ kiosk  🟢
- ผู้ใช้ลองยืนดูจอจริงแล้วบอกว่า banner กับ text บางจุดเล็กไปอ่านยาก — ขอขั้นต่ำ 18px
- แบ่งสองกลุ่ม: **เนื้อหาที่ต้องอ่านจากระยะไกล** (banner, badge, ตัวเลข unit, label,
  chip, ชื่อเครื่อง ฯลฯ) → ขยับเป็น 18px ทั้งหมด ; **ตัวอ้างอิงทางเทคนิค** (point_id,
  frame_id hash, แกนกราฟ) → ปล่อยเล็กไว้เหมือนเดิม เพราะไม่ใช่สิ่งที่ต้องอ่านจากไกล
  และบางที่ (แกนกราฟใน chart 150px) ถ้าขยายจะรก
- พบ regression ระหว่างตรวจ: `.dev-name` โต 15px→18px ทำให้ชื่อเครื่องยาว ๆ
  ("ตู้ควบคุมหม้อไอน้ำ") ตัดขึ้นบรรทัดใหม่กลางคำ เพราะ `.devicebar` grid ยังใช้
  `minmax(260px, 1fr)` เดิม (คำนวณไว้สำหรับฟอนต์เก่า) — แก้เป็น `minmax(300px, 1fr)`
- เพิ่ม `flex-wrap: wrap` ให้ `.card-foot` กันเผื่อ badge+age ล้นแถวเดียวกันที่ฟอนต์ใหญ่ขึ้น
- verify: `bun run type-check` ผ่านสะอาด (CSS ล้วน ไม่มีผลต่อ type) ; เปิดเบราว์เซอร์จริง
  เทียบก่อน/หลัง เห็นตัวอ่านง่ายขึ้นชัดเจน ; ตรวจ devicebar ซ้ำหลังแก้ minmax ไม่ตัดคำแล้ว ;
  เปิดแผงรายละเอียดเช็คไม่มี layout พัง

---

## แสดงภาพ evidence ในแผงรายละเอียด (T-011, doing)  🟢
- เพื่อนแก้ quality gate แล้ว **ส่งภาพจริงสำเร็จ** — ยืนยันบน Pi ด้วย magic number
  (`FF D8 FF E0 ... JFIF`) ว่าเป็น JPEG จริง ไม่ใช่ขยะ
- เพิ่ม `GET /api/evidence/:pointId/latest` ([src/server/api/evidence.ts](src/server/api/evidence.ts))
  — เช็ค `device_id` จาก DB ก่อนแตะ filesystem เสมอ (point_id ที่ไม่มีจริงจะ 404 ก่อนเคย
  ต่อ path เลย ไม่ต้อง sanitize เพิ่ม) เลือกไฟล์ล่าสุดตาม mtime ไม่ใช่ชื่อไฟล์
- `PointDetail.tsx` — แทนที่ placeholder เดิมด้วย `<img>` จริง มี fallback ข้อความเมื่อ
  จุดนั้นยังไม่มีภาพ (404) ; ต้อง reset state ตอนสลับจุดเอง เพราะ component ไม่ unmount
  ระหว่างกดการ์ดอื่นขณะแผงเปิดค้างอยู่
- verify: `bun run type-check` ผ่านสะอาด ; ทดสอบ endpoint ตรง ๆ ครบ 3 เคส (มีภาพ/ไม่มีภาพ/
  point_id ปลอม) ; เปิดเบราว์เซอร์จริงเห็นภาพขึ้นถูกทั้งธีมสว่าง/มืด
- ยังไม่ทำ: retention แยกสำหรับภาพ (ตอนนี้เก็บไม่มีวันลบ), `message_size_limit` ใน
  mosquitto.conf, ยังไม่ deploy ขึ้น Pi

---

## รับภาพ evidence จาก MQTT + เซฟลงดิสก์ (T-011, doing)  🟡
- topic จริงจากทีม AI ต่างจากที่เดาไว้ตอน D-013: `meter/<device>/evidence/<frame_id>/
  <point_id>/<kind>` (6 ระดับ) ไม่ใช่ `snapshot/<frame_id>` (4 ระดับ) — พิสูจน์ด้วย
  `mosquitto_pub` มือ ๆ ก่อนเชื่อ ; อัปเดต `src/contract/topics.ts` ตามของจริง
  พร้อม `parseEvidenceTopic()`
- `src/server/ingest/evidence.ts` (ใหม่) — `handleEvidence()` เซฟไฟล์ที่
  `~/meter-evidence/<device>/<point>/<frame_id>.jpg` (path ตั้งค่าได้ผ่าน `EVIDENCE_DIR`)
  · กันภาพใหญ่เกิน 2MB (default, ปรับได้) เป็นเกราะชั้นแรกระหว่างรอตั้ง
  `message_size_limit` ที่ตัว broker · `ensureEvidenceDir()` เช็คเขียนไฟล์ได้จริงตอนบูต
- `src/server/ingest/index.ts` — subscribe แยกจาก `meterTopics.all()` เสมอ (คนละจำนวน
  ระดับ) เช็ค `parseEvidenceTopic()` **ก่อน** โค้ด JSON parsing เดิมเพื่อกัน payload
  ไบต์ภาพหลุดไปโดน `JSON.parse()` และกันสถิติภาพปนกับ `stats.received`/`invalid`
  ที่ใช้เฝ้าดูสัญญากับทีม AI (เก็บสถิติแยกใน evidence.ts เอง)
- verify: `bun run type-check` ผ่านสะอาด ; ทดสอบจริงด้วย `mosquitto_pub` ยิงเข้า
  broker dev — ไฟล์ไปโผล่ path/เนื้อหาถูกต้อง ; `ingest.invalid` นิ่ง 0 ตลอดการทดสอบ
- 🔴 เพื่อนทีม AI ยังส่งภาพจริงไม่ได้ — โค้ดฝั่งเขามีเงื่อนไข "ส่งเฉพาะ quality != OK"
  แต่โมเดลส่ง `quality:"OK"` ตายตัวทุกครั้งไม่ว่า confidence จะต่ำแค่ไหน แจ้งให้แก้แล้ว
- ยังไม่ทำ: แสดงผลบนการ์ด/แผงรายละเอียด, retention แยกสำหรับภาพ,
  `message_size_limit` ใน mosquitto.conf, ยังไม่ deploy ขึ้น Pi

---

## เพิ่ม topic MQTT สำหรับ snapshot เข้า source of truth (T-011)  🟢
- `meterTopics.snapshot(deviceId, frameId)` + `snapshotAll()` ใน `src/contract/topics.ts`
  ตาม pattern ที่เคาะไว้แล้วตั้งแต่ D-013 (`meter/<device_id>/snapshot/<frame_id>`, 4 ระดับ,
  ไบต์ดิบ, retain=false) — ก่อนหน้านี้ pattern นี้มีแค่ในเอกสาร `SNAPSHOT-PROPOSAL.md`
  ที่ส่งให้ทีม AI ยังไม่มีอยู่ในโค้ดจริงเป็น source of truth
- แค่เพิ่ม topic helper เท่านั้น **ยังไม่ implement การ subscribe/เก็บไฟล์/แสดงผล**
  (ขอบเขตเต็มของ T-011 ยังค้างอยู่ รอเพื่อนเริ่มส่งภาพจริงก่อน)
- verify: `bun run type-check` ผ่านสะอาด

---

## เพิ่ม WATER_METER เข้าสัญญา + ลบ LAMP ทิ้ง (D-016)  🔴
- เพื่อนทีม AI ทดสอบมิเตอร์น้ำจริง ส่ง `kind: "WATER_METER"` มา validate ไม่ผ่านเพราะ enum
  เดิมมีแค่ `GAUGE`/`SEVEN_SEGMENT`/`LAMP` — เพิ่ม `WATER_METER` เข้า `pointKindSchema`
- แก้ที่ต้นตอแทนที่จะเพิ่ม special-case: กฎ `refine` เดิมผูก "LAMP ใช้ value_text นอกนั้น
  value_num" ตายตัว เปลี่ยนเป็น **"มีค่าใดค่าหนึ่งไม่ null ก็พอ ไม่สนใจ kind"** — comment เดิม
  ในโค้ดเองก็ยอมรับอยู่แล้วว่า SEVEN_SEGMENT บางเคสก็เป็นตัวอักษรได้ การผูก shape ค่ากับ
  kind แบบตายตัวจึงผิดตั้งแต่ก่อนเจอ WATER_METER แล้ว ไม่ใช่แค่ตอนนี้
- ลบ `LAMP` ตามที่ผู้ใช้ยืนยัน (ไม่มี fixture จริงรองรับตั้งแต่แรก เป็นของที่เดาเผื่อไว้
  ตอนออกแบบสัญญา) — กระทบ 8 ไฟล์: `contract/{points,messages}.ts`, `db/dev-inventory.ts`
  (ลบ 2 จุด + field `states`), `scripts/mock-edge-publisher.ts`, `web/apiClient.ts`,
  `web/components/{PointCard,PointDetail}.tsx` (เอาเงื่อนไข `kind !== "LAMP"` ที่ไม่จำเป็น
  ออกด้วย — `hasScale` กันซ้ำอยู่แล้ว), `docs/PUBLISHING-GUIDE.md` (คู่มือที่ส่งให้ทีม AI แล้ว)
- 🔴 เจอบั๊กเดิมที่ไม่เกี่ยวกัน: `smoke-db.ts` ข้อ "ทศนิยมละเอียด" insert ซ้ำ point_id+frame_id
  กับข้อก่อนหน้า ชนกับ unique constraint ที่มาทีหลัง แก้ให้ใช้คนละ frame_id (`FRAME2`)
- verify: `bun run type-check` ผ่านสะอาด (0 error) · `bun run smoke-db` ผ่านครบ 8/8 ·
  `bun run mock-edge` + `bun run verify-contract 15` → parse ไม่ผ่าน 0/18 ข้อความ

---

## เพิ่มปุ่มสลับธีมมืด/สว่าง + แก้ banner/confidence bar ที่ตกหล่นจาก D-014 (D-015)  🟡
- deploy D-014 ขึ้น Pi แล้วเทียบกับ mock พบว่าหน้าตาไม่ตรงกัน — **banner สถานะเต็มหัวการ์ด
  กับ confidence bar ไม่เคยถูกพอร์ตจาก mock เข้า `PointCard.tsx` จริงเลย** (D-014 แก้แค่สี/
  เส้นขอบของโครงเดิม) เพิ่มทั้งสองเข้า component + เพิ่ม CSS ที่ไม่เคยมีอยู่ก่อน
- 🔴 เจอเพิ่มระหว่างแก้: `.card-unreadable` ไม่มีกฎขอบหนาเลยตั้งแต่ D-014 (หลุดตอนเขียน
  styles.css ใหม่ทั้งไฟล์) — อ่านไม่ออกควรเด่นสุดเพราะสำคัญสุด แก้พร้อมกัน
- เพิ่มปุ่มสลับธีมมืด/สว่างที่ topbar (D-015 — ล้มมติเดิมของ D-014 ที่ไม่ทำ toggle)
  จำค่าด้วย `localStorage` + script กันจอกระพริบใน `index.html`
- แปลง `rgba(R,G,B,A)` ที่ hardcode อิงสีธีมสว่าง 13 จุดทั่วไฟล์เป็น `color-mix()`
  อิง CSS variable แทน ไม่งั้นธีมมืดจะสีเพี้ยน (badge, chip, gauge-track, err panel ฯลฯ)
- ธีมมืดที่เอากลับมาไม่ใช่ค่าเดิมก่อน D-014 ตรง ๆ — คำนวณ `--dim`/`--dead`/`--line` ใหม่
  ให้ผ่าน WCAG AA เหมือนกับที่แก้ในธีมสว่าง (ของเดิมมีบั๊ก contrast เดียวกันมาตั้งแต่แรก)
- verify: `bun run dev:all` จริง สลับสองธีมสลับไปมา reload หน้าไม่กระพริบขาว state
  uncertain/unreadable/ok ขึ้นถูกทั้งสองธีม แผงรายละเอียด (T-012) เปิดปกติทั้งคู่

---

## เปลี่ยนธีมเป็นพื้นสว่าง + ขอบหนา + แก้ contrast (D-014)  🟡
- ทีมเทียบ `docs/mock/theme-mock.html` แล้วเอนไปทางสว่าง+กรอบใหม่ → เอาไปตรวจ accessibility
  (WCAG 2.2 AA) เจอ **3 จุดที่ธีมมืดเดิม contrast ไม่ผ่าน และ deploy อยู่จริงบน Pi**:
  ตัวหนังสือรอง `--dim` (3.77-3.99:1), สถานะออฟไลน์/ค่าเก่า `--dead` (3.29-3.47:1),
  ขอบการ์ดปกติ `--line` (1.36:1 vs ต้องการ 3:1 — Critical เพราะการ์ดปกติส่วนใหญ่พึ่งเส้นนี้
  เป็นตัวเดียวที่บอกว่าเป็นการ์ดแยกใบ)
- แก้ทั้งสามพร้อมเปลี่ยนธีม — ทุกคู่ตัวหนังสือ/พื้นคำนวณผ่านสูตร WCAG luminance จริง
  (`--dim` 6.0:1, `--dead` 5.0:1, `--line` 3.07:1 ทั้งหมดผ่าน AA มีระยะเผื่อ)
- ค่าเก่า/ออฟไลน์เปลี่ยนจาก **opacity อย่างเดียวเป็นขอบประ** — opacity เพียวใช้กับพื้นขาว
  ไม่ได้ (การ์ดยังขาวอยู่ ตาอ่านว่า "ปกติแต่เบลอ" ไม่ใช่ "เชื่อไม่ได้")
- ตัด text-shadow/drop-shadow เรืองแสงทั้งหมด (ออกแบบมาให้ดูเรืองแสงในที่มืด ไม่มีความหมาย
  บนพื้นขาว) ; ขอบการ์ด 1px→2px (ผิดปกติ 4px) แทนเงานุ่ม
- แก้ไฟล์เดียว `src/web/styles.css` — ตรวจแล้วไม่มีสี hardcode ใน component TSX
- verify: เปิด `bun run dev:all` จริง เจอ state ok/uncertain/over/unreadable ของจริงจาก mock
  ระหว่างเทส ตรวจ CSS rule ที่ declare (ขอบประ + สี var(--dead)) ตรงตามที่เขียน
- ยังไม่ deploy ขึ้น Pi — ยังไม่ได้ยืนดูจอจริงที่หน้างาน (D-014)

## T-012 หน้ารายละเอียดรายจุด (slide-over)  🟡  (T-012)
- กดการ์ด → แผงเลื่อนออกมาขวา **หน้ารวมหดแต่ยังเห็นอยู่** ไม่ใช่เปลี่ยนหน้า
  เพราะคำถามที่ตามมาเสมอคือ "แล้วจุดอื่นล่ะ" · Esc ปิด · คลิกการ์ดอื่นสลับได้ทันที
- **auto-กลับหน้ารวมใน 60 วิ ถ้าไม่มีใครแตะ** พร้อมนับถอยหลังให้เห็น —
  จอผนังไม่มีใครเดินไปกดปิด ถ้าไม่มีอันนี้จะค้างโชว์จุดเดียวตลอดไป
- `HistoryChart` — เส้นค่าเฉลี่ย + **แถบ min–max** (ค่าพุ่งชั่วขณะถูก avg กลบ) +
  **แถบสีตรงช่วงที่อ่านไม่ออก ความเข้มตามสัดส่วน** ไม่ใช่แค่เส้นขาด
  (ที่อัตราอ่านไม่ออก 47% เส้นจะขาดถี่จนดูเหมือนกราฟเสีย)
- สัดส่วนคุณภาพในช่วง · min/max · confidence · ส่วนต่างนาฬิกา edge · frame_id · ที่ว่างรอ T-011
- ⚡ **แก้บั๊ก scaling ที่ซ่อนอยู่**: เดิมยิง `/points/:id/history` **ทีละจุด** ตอนโหลดหน้า
  1 จุดไม่รู้สึก แต่โปรเจกต์นี้ขายเป็น package ต่อโรงงาน บางที่อาจ 30-50 จุด
  = 30-50 requests ทุกครั้งที่เปิดหน้า → ทำ `GET /api/points/history` รวมทีเดียว
  **วัดแล้ว: 1 request แทน 10**
- 🔴 เจอบั๊กระหว่างทดสอบ: `นาฬิกา edge ต่างจากเรา` โชว์ -40 แล้วขยับเป็น -65 วิ
  ตรวจ DB แล้วพบว่า `received_at - captured_at` = **0.0 ทุกแถว** — นาฬิกาไม่ได้เพี้ยน โค้ดเพี้ยน
  ต้นตอ: SSE อัปเดต `captured_at` แต่ไม่ได้ส่ง `received_at` มาด้วย ค่าจึงค้างที่ตอนโหลดหน้า
  **เป็นความผิดพลาดแบบเดียวกับ `last_frame_at` ใน T-006 เป๊ะ** → บันทึกเป็นกติกาใน ARCHITECTURE
- verify: 1 request history · กดการ์ดแล้วแผงตรงจุด · กราฟมีเส้น/แถบ/แถบอ่านไม่ออก 2 ช่วง ·
  เปลี่ยนช่วง 1 ชม.→15 นาที แกนเวลาเปลี่ยนจริง (124 ค่า) · นับถอยหลังแล้วปิดเองจริง ·
  Esc ปิดได้ · drift กลับมาเป็น `+0.0 วิ` ตรงกับ DB

## เคาะทางส่ง snapshot — MQTT topic แยก (D-013)  🟢  (2026-08-28)
- ทดสอบแล้วว่า HTTP ถึงกันได้จริงจาก edge (`curl` ตอบ 200) — **ไม่ต้องเปิดพอร์ตอะไรใหม่**
  แต่ยังเลือกทาง B ด้วยเหตุผลอื่น
- 🔑 เหตุผลหลักที่ผมไม่ได้พูดถึงตอนเสนอครั้งแรก: **endpoint HTTP รับไฟล์ที่ไม่มี auth
  คือช่องให้ใครก็ได้ในวง LAN ยิงจนดิสก์เต็ม** ถ้าใช้ MQTT พอ T-008 ใส่ auth ให้ broker
  ภาพจะได้รับการป้องกันไปด้วยทันที ไม่ต้องทำ auth สองชุด
- ⚠️ **แก้การให้น้ำหนักผิดของตัวเอง**: ข้อเสีย "MQTT เขียน SD 2 เท่า" คิดจากตัวเลข
  ก่อนใส่เพดาน (1.3 GB/วัน) พอจำกัดเหลือ ~36-54 MB/วัน = ~13-20 GB/ปี ซึ่งเทียบกับ
  endurance ของ SD (หลายสิบ TB) แล้วเป็นเศษเสี้ยว — ข้อโต้แย้งนั้นแทบไม่มีน้ำหนักแล้ว
- เก็บกวาดเอกสารให้ไม่ขัดกันเอง (หัวข้อ 3b เคยเขียนเป็นเงื่อนไข, หัวข้อ 4 เคยพูดถึง HTTP error)
- T-011 เปลี่ยนจาก blocked → todo · scope ระบุชัดว่าต้อง subscribe topic แยก
  เพราะ `meter/+/+` จับได้แค่ 3 ระดับ ส่วน topic ภาพมี 4 ระดับ

## ข้อเสนอเรื่อง snapshot ให้ทีม AI  🟢  (2026-08-28)
- ทีม AI วางแผนส่ง snapshot เป็น **base64 ผ่าน MQTT** → `docs/SNAPSHOT-PROPOSAL.md`
- ทำไมไม่รอด: 53KB/เฟรม (base64 บวก 33%) × อัตราปัจจุบัน = **1.3 GB/วัน → SD เต็มใน 14 วัน**
  และที่อัตราเดิม 26 เฟรม/วิ = 119 GB/วัน · **throttle ที่ทำใน T-009 ช่วยไม่ได้** เพราะมันตัดสิน
  ว่าจะ*เก็บ*อะไร แต่ภาพวิ่งผ่าน broker กับสายมาแล้ว
- จุดที่มองไม่เห็น: `mosquitto.conf` เปิด `persistence` (จำเป็นสำหรับ QoS 1) ทุกข้อความจึงถูก
  **เขียนลง SD หนึ่งรอบก่อน** แล้วเราค่อยเขียน Postgres อีกรอบ = ภาพผ่าน MQTT เขียน SD ~2 เท่า
- เสนอ 3 ข้อ: HTTP POST ไบต์ดิบ (ไม่ base64 ประหยัด 33%) · เฉพาะ `quality != OK` ·
  เพดาน 1 ภาพ/นาที/จุด → **~72 MB/วัน**
- เปิด T-011 ไว้เป็น blocked รอเขาตอบ — วิธีส่งเปลี่ยน scope ทั้งใบ จึงยังไม่เริ่มเขียน

## T-010 สำรองข้อมูล — ทำแล้วแต่ยังปิดใบไม่ได้  🟡  (T-010)
- `deploy/backup.sh` — `pg_dump -Fc` ผ่าน docker exec (ไม่ต้อง mount volume) · เก็บ 7 ไฟล์ล่าสุด ·
  เขียนเป็น `.part` ก่อนแล้วค่อยเปลี่ยนชื่อ ไม่งั้นไฟดับกลางคันจะได้ไฟล์ที่ดูเหมือน backup แต่ restore ไม่ได้
- `deploy/restore-test.sh` — **restore เข้า database ชั่วคราวแล้วลบทิ้ง ไม่แตะข้อมูลจริง**
  ต่างจากที่ ticket เขียนไว้ว่า "ลบ DB ทิ้งแล้ว restore" โดยตั้งใจ: วิธีเดิมพิสูจน์ได้จริงแต่ทำได้ครั้งเดียว
  และเสี่ยงเกินไปกับเครื่องที่มีข้อมูลจริง · ตรวจ **index ด้วยไม่ใช่แค่จำนวนแถว** เพราะ restore
  ที่ได้ข้อมูลแต่ไม่มี index จะกลับมาแล้วช้าจนใช้ไม่ได้
- systemd timer ตี 3 · `Persistent=true` (Pi โดนตัดไฟบ่อย ถ้าไม่ตั้งจะข้ามทั้งวันโดยไม่มีใครรู้)
- `/api/health` โชว์ `checks.backup` — อายุไฟล์ล่าสุด + จำนวน + `offsite`
  เพราะ **backup ที่หยุดทำงานเงียบ ๆ จะรู้ตัวตอนที่สายเกินไปแล้ว**
- 🔴 **ยังปิดใบไม่ได้: `BACKUP_REMOTE` ยังไม่ได้ตั้ง** (เคาะว่ายังไม่มีปลายทาง ปล่อยไว้ก่อน)
  ไฟล์อยู่บน SD ใบเดียวกับ DB = กันได้แค่ "ลบผิด" ไม่ได้กัน "การ์ดพัง" ซึ่งเป็นเหตุผลทั้งหมด
  ที่ D-006 ยอมให้ DB อยู่บน SD → ใส่ `warning` ใน health ไว้ตรง ๆ ไม่ให้ `ok:true` หลอกตา
- verify (เครื่อง dev): `backup.sh` ได้ไฟล์ 872K · `restore-test.sh` ผ่าน —
  devices 3/3 · points 10/10 · readings 57882 · index 4 ตัว

## deploy throttle+redesign ขึ้น Pi · ผลกับข้อมูลจริง  🟡  (2026-08-28)
- ✅ **throttle ได้ผลกับข้อมูลจริง 88.3%** (throttled 1147 / inserted 152) ตรงกับที่วัดด้วย mock (89.5%)
- ✅ heartbeat ของทีม AI เข้ามาจริงแล้ว (`sw=1.0.0 model=hough-polar-v1`) — ก่อนหน้านี้ที่เห็นเป็น
  `0.0.0-mock` คือขยะจาก mock เราที่หลุดเข้าไป ไม่ใช่ว่าเขาไม่ส่ง
- UNREADABLE ลดจาก 70% → **47%** (34040/71913) ยังสูงอยู่ ต้องบอกทีม AI
- ⚠️ **อย่าให้เครดิต throttle ทั้งหมด** — edge ยิงช้าลงเองด้วย จาก 26 เฟรม/วิ เหลือ ~0.29/วิ
  (1551 ข้อความ / 5403 วิ) ผลรวมตอนนี้ ~2,400 แถว/วัน ≈ 0.6 MB/วัน มาจากสองปัจจัย
- 🔴 เจอ bug ในเครื่องมือตัวเอง: `db-peek` hardcode ข้อความ "ยังไม่มี retention" ไว้ตั้งแต่ก่อนทำ T-009
  แล้วลืมแก้ → ขัดกับ `/api/health` ที่บอกว่า retention เปิดอยู่ · แก้ให้อ่าน `retentionStatus()` จริง
- 🔴 ค้าง: `pt-gauge-01` **ยังไม่มีสเกล** (min/max เป็น null) จึงวาดเกจไม่ได้ ขึ้นแต่ตัวเลข `26.37 bar`
  ซึ่งคนดูตีความไม่ได้ว่าสูงหรือต่ำ — ต้องถามทีม AI ว่าหน้าปัดอ่านได้ช่วงไหน

## fix: หน้าขาวตอน dev — ชื่อไฟล์ชนกับ prefix ของ proxy  🟢  (2026-08-27)
- อาการ: `bun run dev:all` ขึ้นครบทุก process ไม่มี error ใน terminal เลย แต่ `localhost:5173` ขาวเปล่า
- ต้นตอ: ไฟล์ `src/web/api.ts` ถูกขอเป็น `/api.ts` ซึ่ง**ตรงกับ prefix `/api`** ที่ Vite proxy
  ส่งต่อไป Hono → ได้ 404 JSON แทนตัวไฟล์ → import พัง → React ไม่ render อะไรเลย
- **พังเฉพาะโหมด dev** ตอน build รวมเป็น bundle เดียวจึงไม่เคยขอไฟล์นี้ผ่าน HTTP
  ทำให้ตอนทดสอบที่ port 3000 (prod build) ผ่านมาตลอด — เป็นเหตุผลว่าทำไมถึงไม่เจอตอน redesign
- แก้สองชั้น: เปลี่ยนชื่อเป็น `apiClient.ts` และรัด proxy จาก `"/api"` เป็น `"^/api/"`
  (ชั้นหลังกันปัญหาทั้งตระกูล เช่น `/api-utils.ts` ในอนาคต)
- verify: โหลด `localhost:5173` ใหม่ → 10 การ์ด · 3 เครื่อง · SSE เชื่อมต่อ · ค่าไหลปกติ

## คำสั่งลัดสำหรับเทสบนเครื่อง dev  🟢  (2026-08-27)
- `stack:up` / `stack:down` / `stack:status` — จัดการ container ผ่าน compose ชุดเดียวกับที่ใช้บน Pi
  (ไม่ให้ dev กับ prod ใช้คนละวิธีขึ้น container)
- `dev:all` — server + หน้าเว็บ + mock พร้อมกันในคำสั่งเดียว
- ที่มา: เปิดเว็บแล้วต่อ MQTT ไม่ได้ เพราะ Docker Desktop ปิดตัวเองตอนเครื่อง idle
  แล้ว container หายไปด้วย — ไม่ใช่บั๊ก แต่การต้องจำ 4 ขั้นทุกครั้งมันพลาดง่าย

## T-009 คุมปริมาณข้อมูล — throttle + retention  🟡  (T-009, D-012)
- **เปลี่ยนวิธีจากที่วางไว้**: D-002 เขียนว่ารออัตราจริงก่อนค่อยคิดเรื่อง Timescale — พอวัดได้
  **26 เฟรม/วิ = 830 MB/วัน ต่อจุดเดียว** (SD เต็มใน ~23 วัน) พบว่าต้นตอไม่ใช่ DB เก็บไม่ไหว
  แต่คือ **เก็บค่าที่ไม่มีความหมาย** → บีบที่ ingest แทนการหา DB ที่ใหญ่ขึ้น (D-012)
- `src/server/ingest/throttle.ts` — deadband 0.5% ของสเกล + เพดาน 1 ครั้ง/วิ/จุด +
  บังคับเก็บทุก 60 วิ (ไม่งั้นกราฟแยกไม่ออกระหว่าง "ค่านิ่ง" กับ "ไม่มีข้อมูล")
- `src/server/retention.ts` — ลบข้อมูลเก่ากว่า 30 วัน ทุก 6 ชม. **ลบเป็นชุดละ 5000 แถว**
  ไม่ใช่ทีเดียว เพราะ DELETE ก้อนใหญ่บน Pi จะล็อกตารางนานจน ingest เขียนไม่ได้
- **แยกการแสดงผลออกจากการเก็บ** — จอต้องเห็นค่าล่าสุดเสมอแม้ค่านั้นอยู่ใน deadband
  (ถ้าผูกเข้าด้วยกัน ตัวเลขบนจอจะค้างทั้งที่ของจริงยังไหล) · จำกัดอัตราส่ง SSE แยกที่ 250ms
  เพราะ 26 เฟรม/วิ × 10 จุด = 260 ข้อความ/วิ ซึ่ง Chromium บน Pi รับไม่ไหว
- `/api/health` โชว์ขนาดตาราง readings + สถานะ retention — SD เต็มคือความเสี่ยงหลักของเครื่องนี้
  ต้องมองเห็นจากภายนอกได้
- 🔴 **เจอ 2 อย่างจากการวัด ไม่ใช่จากการอ่านโค้ด**:
  1. เดิมมี `await getScale()` อยู่ในลูปตัดสินใจ → เฟรมอื่นแทรกอ่าน state เก่าได้
     แก้เป็นดึงสเกลให้ครบก่อน แล้วให้ช่วงตัดสินใจไม่มี await คั่น
     (แก้ถูกในหลักการ แต่ไม่ใช่ต้นตอของตัวเลขที่เห็น — ระบุไว้กันเข้าใจผิด)
  2. **ต้นตอจริงคือกฎ "สถานะเปลี่ยน = เก็บเสมอ"** พอโมเดลกระพริบ OK↔UNREADABLE
     ถี่ ๆ throttle จะไร้ผล (6.3 แถว/วิ/จุด) → ใส่เพดานแยกสำหรับการเปลี่ยนสถานะที่ 200ms
     ยังละเอียดพอเห็นว่ากระพริบ แต่จำกัดกรณีแย่สุดไว้ที่ 5 แถว/วิ/จุด
- verify: `smoke-throttle` 7/7 (รวมข้อสำคัญที่สุด — OK↔UNREADABLE ไม่ถูกกลืน) ·
  `smoke-retention` 4/4 (แถวอายุ 29.5 วันรอด แถว 30.5 วันถูกลบ) ·
  วัดกับ mock ที่ 26Hz: **1878 → 875 แถว/30วิ บีบทิ้ง 89.5%**

## redesign หน้า dashboard ตามแบบ "Liquid Industrial"  🟢  (2026-08-27)
- ถอดจาก `stitch_liquid_glass_redesign.zip` — พาเลตต์ charcoal+มิ้นต์ · การ์ด `rgba(255,255,255,.03)`
  ขอบ `.12` เงา `0 8px 32px` radius 20px · ตัวเลข mono ใหญ่มี glow · แถบสถานะเครื่องมีจุดเรืองแสง
- **เกจเปลี่ยนจาก path โค้งเป็นวงแหวน `stroke-dasharray/dashoffset`** — ไม่ใช่แค่หน้าตา:
  ของเดิม `transition: d` บน path เบราว์เซอร์ส่วนใหญ่ไม่ animate จริง ตัว dashoffset เป็นตัวเลขล้วน
  จึงลื่นได้ทุกที่
- sparkline เพิ่ม gradient fill ใต้เส้น (`useId` กัน id ชนกันข้ามการ์ด)
- ไม่เอา 3 อย่างจาก mockup — Google Fonts, backdrop-filter, sidebar/alert (เหตุผลเต็มใน D-011)
- verify: computed style ตรงสเปกทุกตัว (`backdrop-filter` 0 แห่ง · dasharray 251.33 = 2πr เท่ากับ
  mockup · ฟอนต์ระบบล้วน) · bundle CSS 5.05→7.12KB, JS เท่าเดิม ·
  **กฎสำคัญรอดครบ**: UNREADABLE ไม่มี element ตัวเลขเลย (`hasNumber: false`) เกจไม่วาดวงแหวน
  เส้นกราฟขาดตรงรูโหว่ · ลำดับ offline > stale > unreadable ยังถูก
- 🔴 เจอระหว่างทาง: `.env` บนเครื่อง dev ถูกแก้ให้ `MQTT_URL` ชี้ไป **Pi** ค้างไว้ ทำให้ mock
  ยิงข้อมูลปลอมเข้าเครื่องจริงปนกับข้อมูลทีม AI → แก้ `.env` กลับ และ**ใส่ guard ใน mock**
  ให้ปฏิเสธ broker ที่ไม่ใช่ localhost เว้นแต่พิมพ์ `--allow-remote` เอง

## purge-dev-seed — ล้างข้อมูล dev ให้เหลือแต่ของจริง  🟡  (2026-08-27)
- ทีม AI เริ่ม publish ของจริงเข้า Pi แล้ว (`invalid: 0` — payload ผ่านสัญญาหมด และตั้ง
  `device_status` ถูกด้วย) แต่เขาใช้ `device_id = edge-01` ซึ่ง**ชนกับ seed ของเรา**
  ข้อมูลจริงกับข้อมูลปลอมจึงอยู่ใต้เครื่องเดียวกัน
- `scripts/purge-dev-seed.ts` ลบ **ตามรายชื่อ point_id ของ seed เท่านั้น** ไม่ลบตาม device_id
  เพราะ `DELETE FROM devices WHERE device_id='edge-01'` จะ cascade กวาดข้อมูลจริงไปด้วยทั้งหมด
  · default เป็น dry-run ต้องใส่ `--yes` ถึงลบจริง
- verify: จำลองจุดของเพื่อน (`pt-friend-real` ใต้ edge-01) แล้วรัน `--yes` →
  ลบ seed 10 ตัวพร้อม readings ที่ผูกอยู่ · **`edge-01` ถูกเก็บไว้เพราะยังมีจุดจริง** (ล้างแค่ชื่อปลอม) ·
  edge-02/03 ที่ไม่เหลือจุดวัดถูกลบ · จุดของเพื่อนกับ reading รอดครบ → คืนสภาพ dev ด้วย db:seed

## T-007 ของสำหรับ deploy (ยังไม่ได้ขึ้น Pi จริง)  🟡  (T-007)
- `deploy/docker-compose.yml` (postgres+mosquitto, `name: meter`), `deploy/meter.service`,
  `deploy/kiosk/{kiosk-launch.sh,meter-kiosk.desktop}`, `docs/DEPLOYMENT.md` ครบขั้นตอน
- port แยกเจตนาชัด: mosquitto `0.0.0.0:1883` (edge ต้องยิงเข้าจาก LAN) ·
  postgres `127.0.0.1:5432` (ไม่มีเหตุผลให้เข้าถึงจาก LAN)
- `kiosk-launch.sh` ตรวจสภาพเครื่องเองแทนการ hardcode — หา binary ของ chromium เอง
  (ชื่อต่างกันตามรุ่น Pi OS) · รอ server ตอบก่อนเปิดจอ และ**รับทุก HTTP status ไม่ใช่แค่ 2xx**
  เพราะ health ตอบ 503 ตอน DB ยังไม่ขึ้น ถ้ารอ 2xx จอจะดำค้างทั้งที่หน้าเว็บแสดง degraded ได้แล้ว
  · ล้าง flag crash ของ Chromium ไม่ให้ติดแถบ "Restore pages?" คาจอ
- verify (บนเครื่อง dev): ยกเลิก container ที่สร้างมือ แล้วขึ้นด้วย compose แทน →
  `docker port` ถูกทั้งสองตัว · postgres healthy · migrate/seed/build ผ่าน ·
  health `ok` · points 10/10 มีค่า · devices 3 ONLINE
- ⚠️ **ยังไม่ได้พิสูจน์บน Pi** — ข้อ reboot แล้วจอขึ้นเอง และข้อยิง mock จากเครื่องอื่น
  ต้องรันบนเครื่องจริง (ssh จาก shell ของ AI ไม่ผ่าน jump host)

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
