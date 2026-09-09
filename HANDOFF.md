# HANDOFF — Meter (อ่านก่อนเริ่ม session ใหม่)

> อัปเดตล่าสุด **2026-09-09**
>
> ไฟล์นี้เก็บเฉพาะของที่ไฟล์อื่นไม่มี: **สถานะเครื่อง ณ ตอนนี้ · ของค้างกลางมือ ·
> คำถามค้างกับทีม AI · กับดักที่เจอมาแล้ว**
> ⚠️ ห้ามก๊อปเนื้อหาจากไฟล์อื่นมาไว้ที่นี่ — ชี้ทางอย่างเดียว ไม่งั้นจะขัดกันเองเมื่อของจริงเปลี่ยน

## อ่านตามลำดับนี้

1. `CLAUDE.md` — กฎ + โปรเจกต์นี้คืออะไร (โหลดอัตโนมัติทุก turn อยู่แล้ว)
2. `docs/AI-GUIDE.md` — พฤติกรรมที่คาดหวัง (อ่านก่อนงานแรกของ session)
3. ไฟล์นี้ — สถานะล่าสุด
4. `docs/ROADMAP-PACKAGE.md` — ปลายทางที่กำลังเดินไป + สิ่งที่ตัดออกนอกขอบเขตแล้ว
5. `docs/TICKETS.md` — ใบถัดไปที่ต้องทำ
6. เปิดเมื่อเกี่ยวข้อง: `ARCHITECTURE.md` · `DECISIONS.md` · `CHANGELOG.md` · `DEPLOYMENT.md`

> 📖 **อ่านเอกสารทั้งชุดแบบสบายตา (สำหรับคน ไม่ใช่ AI)** — `bun run docs-html` แล้วเปิด
> `docs/DOCS.html` : รวม 13 ไฟล์เป็นหน้าเดียว มีสารบัญ/ค้นหา/ลิงก์ข้ามไฟล์
> ฉบับเผยแพร่ https://claude.ai/code/artifact/cf14c075-0d86-49e8-b48c-f99e6621c118
> ⚠️ `.md` เป็นต้นฉบับเสมอ — HTML สร้างใหม่ได้ตลอด **ห้ามแก้ผลลัพธ์ด้วยมือ**
> (ไฟล์อยู่ใน `.gitignore` เหมือนรายงานอีก 2 ฉบับ)

---

## 🎨 กติกางาน UI — ห้าม AI slop (ผู้ใช้เน้นย้ำ 2026-09-08)

**ใช้กับโปรเจกต์อื่นด้วย** ไม่ใช่แค่ Meter — ธีม/สี/design doc เปลี่ยนได้ (ผู้ใช้จะส่ง `.md`
มาให้เป็นครั้ง ๆ) แต่ **วิธีทำ** ต้องเป็นแบบนี้เสมอ

### สิ่งที่ผู้ใช้เรียกว่า "AI slop" (โดนตีกลับมาแล้ว 3 รอบกว่าจะผ่าน)

1. **แปะ design token ทับโครงเดิม** แล้วบอกว่าเสร็จ — ปัญหาอยู่ที่ **โครงและลำดับความสำคัญ**
   ไม่ใช่ชุดสี ; ถ้าไม่รื้อโครง เปลี่ยนสีกี่รอบก็ยังดูเหมือนเดิม
2. **`text-transform: uppercase` + `letter-spacing` สาดทั่วทุก label** — giveaway ชัดที่สุด
   ของ admin template สำเร็จรูป ; ใช้ได้เฉพาะ **field label** กับ **status badge** เท่านั้น
   ตัวระบุ (id) และชื่อต้องเงียบ เป็น mono/sans ธรรมดา
3. **emoji ใน UI** (⚙ 🎯 📷 ✕) — คุมสี/ขนาด/น้ำหนักไม่ได้ หน้าตาต่างกันทุก OS
   ใช้ **SVG inline ที่ใช้ `currentColor`** เสมอ (ดู `src/web/components/Icons.tsx` เป็นแบบ)
4. **border + shadow + radius + bg fill ซ้อนกันทุกกล่อง** — ของจริงเลือกอย่างเดียวพอ
   ; การ์ดที่ดูสะอาดคือ "บล็อกสี" (แยกด้วยความต่างของสีพื้น) ไม่ใช่ "กล่องมีกรอบ"
5. **ทุกอย่างน้ำหนักเท่ากันหมด** — ทุกกล่องตะโกนแข่งกันจนไม่มีอะไรเด่น
   ต้องมีของหลัก 1 อย่างต่อหน้าจอ ที่เหลือถอยให้หมด
6. **มนเกินไป** — ผู้ใช้ชอบเหลี่ยม (radius 3-4px) ไม่ใช่ 12px+

### วิธีที่ผ่าน

- **อ่าน design doc + ดูภาพ reference ให้ออกก่อนว่า "อะไรทำให้มันดูดี"** แล้วค่อยลงมือ
  (ของ Evreghen: การ์ดไม่มีขอบ · สีเน้นใช้น้อยมาก · chrome มืดครอบ workspace สว่าง)
- **รื้อโครงจริง** ไม่ใช่ปรับทีละ property
- **ตัดของออก** มากกว่าเพิ่มเข้า (หน้า detail เดิมมี stats grid 2×2 + quality bar + chip
  + ปุ่ม 4 อัน → เหลือ hero + timeline + meta บรรทัดเดียว)
- **อย่าใส่ของปลอม** — reference มี sidebar แต่แอปนี้มีหน้าเดียว การใส่เมนูที่กดไม่ได้
  ยิ่งทำให้ดูเป็น mockup ; เอาเฉพาะสิ่งที่มีของจริงรองรับ
- ยึด **WCAG AA** เสมอ แม้ design doc จะให้สีที่ไม่ผ่าน (สีสถานะสดใสมักตกเกณฑ์เมื่อเป็น
  ตัวหนังสือบนพื้นสว่าง — ใช้เวอร์ชันเข้มแทน แล้วจดเหตุผลไว้)
- **เปิดเบราว์เซอร์ดูจริงทุกครั้ง** ทั้งธีมสว่าง/มืด ก่อนบอกว่าเสร็จ

ดีไซน์ปัจจุบันของ Meter + เหตุผลเต็ม → `docs/DECISIONS.md` D-019 · หัวไฟล์ `src/web/styles.css`

---

## สถานะ ณ 2026-09-09 บ่าย (ล่าสุด — วางแผนล้วน ไม่ได้แตะโค้ดที่รันจริง)

### ▶ ทำอะไรต่อ (เรียงตามที่ควรหยิบ — เกณฑ์อยู่ที่ `docs/WORKFLOW.md` §0)

1. 🔴 **push + deploy T-019 ขึ้น Pi** — หนี้ deploy กลับมาแล้ว (T-019 แตะ `src/`) ; ตอนนี้
   Pi ยังไม่มีฟีเจอร์ตั้งชื่อเครื่อง · **และควรถือโอกาสดูด้วยตาว่าปุ่ม "บันทึก" เป็นสีส้มจริงไหม
   ในธีมมืด** ซึ่งเป็นข้อเดียวที่ T-019 ยังยืนยันไม่ได้ (ดู T-021)
2. **T-015 ซ้อมติดตั้งโรงงานที่ 2 บนเครื่อง dev** — ใบเดียวที่ปลดล็อก T-018 และเป็นงานที่
   ตั้งอยู่บนการเดาล้วน (ยังไม่มีใครเคยเดินเส้นนั้นจริงแม้แต่ครั้งเดียว) ; ทำได้ทั้งที่ไปหน้างานไม่ได้
3. **T-021** ปุ่มหลักไม่เคยเป็นสีส้ม (specificity ชน) — ใบเล็ก แต่กระทบทุกฟอร์มในแอป
4. **T-016 / T-017** — เคาะอย่างเดียว ไม่ต้องเขียนโค้ด
5. **T-020** — ใบเล็กจบในรอบเดียว ไว้แทรกตอนล้าหรือรออะไรอยู่

📌 **T-014 ปลดล็อกฝั่งเราแล้ว** — เงื่อนไขที่เหลือคือ "deploy ขึ้น Pi แล้วทดสอบ calibrate
กับ edge จริง" ซึ่งข้อ deploy ผ่านแล้ว ; **แต่ปิดใบยังไม่ได้จนกว่าทีม AI จะเขียนฝั่ง edge เสร็จ**
(sub `command/snap-for-calibration` แล้วตอบ evidence `kind=CALIBRATION` + apply config)
— อยู่นอกขอบเขตเรา รอเขาอย่างเดียว อย่าเอามานับเป็นงานของเรา

### เปิดปลายทางใหม่ "ขายเป็น package ต่อโรงงาน" → `docs/ROADMAP-PACKAGE.md`
ที่มา: ไปหน้างานจริงเพื่อ validate ไม่ได้ + งานในแล็บเริ่มตัน → กวาดเอกสารทั้งโฟลเดอร์
หาว่าอะไรควรทำต่อ แล้วเคาะปลายทางเป็น **"ติดตั้งโรงงานที่ 2 ได้โดยไม่ต้องแก้โค้ด"**

- 🔴 **ตั้งบนสมมติฐาน ยังไม่มี requirement จริงจากลูกค้า** (ได้ยิน pain point ของโรงงานมาอีกที)
  — อย่าลงแรงหนักกับของที่ต้องเดา 2 ชั้น
- เคาะไปแล้ว 4 ข้อ → **D-020** ; แผนที่ (ปลายทาง · เรื่องที่ยังมองไม่ชัด · สิ่งที่ตัดออก)
  → `docs/ROADMAP-PACKAGE.md` ; ใบงานยังอยู่ `TICKETS.md` ตามเดิม **อย่าเล่าซ้ำที่นี่**
- **ใบที่หยิบได้เลย:** T-015 (ซ้อมติดตั้งโรงงานที่ 2 บนเครื่อง dev — ทำได้ทั้งที่ไปหน้างานไม่ได้)
  · T-016 · T-017 · T-019 · T-020 ; **T-018 บล็อกอยู่รอ T-015**

### 🎉 เส้น adopt จุดวัดทำงานครบอยู่แล้ววันนี้ — ไม่ต้องสร้างระบบ provisioning ใหม่
`ingest` สร้างแถว `enabled=false` → `GET /api/points` ไม่กรองทิ้ง → การ์ดขึ้นจอพร้อมป้าย
"ยังไม่ตั้งค่า" → `PATCH /:pointId` ตั้ง `enabled=true` ให้เอง (= การรับเข้า)
งานที่เหลือจึงเล็กกว่าที่ประเมินไว้ตอนแรกมาก

### ✅ ปิดคำถามค้างกับทีม AI หมดแล้ว
- **ส่งภาพผ่าน MQTT เป็น raw binary** — ตรงกับที่ D-013 เลือกไว้ ไม่ใช่ base64 ที่เคยกลัวว่า SD จะเต็ม
- **SEVEN_SEGMENT กับ WATER_METER อ่านด้วยโมเดล ไม่ใช่ computer vision** → ไม่มีเรขาคณิตในภาพ
  ให้สอบเทียบ ⇒ **calibration เหลือ GAUGE ชนิดเดียวถาวร** ; T-014 เหลืองานเดียวคือรอ deploy
  ขึ้น Pi ทดสอบกับ edge จริง
- ⚠️ `bboxSchema`/`sevenSegmentFixtureSchema` กลายเป็น dead code — ตัดที่ **T-020** ซึ่ง
  **เป็นการแก้สัญญาที่ส่งทีม AI ไปแล้ว** ต้องเช็ค `PUBLISHING-GUIDE.md` กับ
  `CALIBRATION-PROPOSAL.md` ด้วย (เคยพลาดแบบเดียวกันตอน D-016 ตัด `LAMP`)

### เครื่องมือใหม่ `bun run docs-html`
แปลง `.md` ทั้งชุดเป็น `docs/DOCS.html` ไฟล์เดียวไว้ให้คนอ่าน (ดูกล่อง 📖 บนสุดของไฟล์นี้)
⚠️ ถ้าไปแก้ `scripts/docs-html.ts` **อย่าเผลอเปิดกฎ "ย่อหน้า 4 ช่อง = code block" ของ markdown
มาตรฐาน** เพราะ TICKETS/DECISIONS ใช้ย่อหน้าแบบแขวน (`why:` แล้วบรรทัดถัดไปย่อลึก)
เปิดกฎนั้นเมื่อไหร่ ทั้งสองไฟล์จะกลายเป็นกล่องโค้ดทั้งไฟล์ทันที

### ✅ Pi ตามทันแล้ว — ไม่มีโค้ดค้างรอ deploy
ผู้ใช้ยืนยัน 2026-09-09 ว่า deploy แล้วและ **verify ว่าบั๊กภาพช้า 1 เฟรมหายจริงบนเครื่อง**

**Pi อยู่ที่ `f09a58c` เป๊ะ** (ตรวจจาก `git log` บนเครื่องจริง = `origin/main` พอดี ไม่มี local
change ค้างบนนั้น) ซึ่ง**ใหม่กว่า** `104162f` จึงมีครบทั้ง fix ภาพ evidence · redesign UI (D-019)
· polish ฟอนต์ไทย · T-013/T-014 calibrate

🔴 **กลับไปเป็นหนี้ deploy แล้วตั้งแต่ T-019** (2026-09-09 บ่ายแก่ ๆ) — เดิมบรรทัดนี้เขียนว่า
"ค้างแต่ docs/tooling ไม่มีโค้ดที่รันจริง" ซึ่งจริงอยู่พักหนึ่ง แต่ T-019 แตะ `src/` แล้ว
⇒ **Pi ยังไม่มีฟีเจอร์ตั้งชื่อเครื่อง** ; ต้อง push + deploy ตาม `docs/DEPLOYMENT.md:157`
(รอบนี้ต้อง `bun run build` + restart service ด้วย ไม่ใช่แค่ `git pull` เหมือนตอนค้างแต่เอกสาร)

<!-- จงใจไม่ไล่ hash ตรงนี้ — ลิสต์ hash จะเก่าทันทีที่ commit ถัดไป (รวมถึง commit ที่มาแก้
     บรรทัดนี้เอง) ; อยากรู้ของจริงให้รัน: git log --oneline origin/main..HEAD -->
🔴 **ถ้าเห็นว่ามี commit ที่แตะ `src/` ค้างอยู่เมื่อไหร่ = กลับไปเป็นหนี้ deploy ทันที**
เช็คด้วย `git log --oneline origin/main..HEAD -- src/` ถ้าไม่ว่าง ต้อง deploy ก่อนทำอย่างอื่น
(เกณฑ์ข้อ 1 ของ `docs/WORKFLOW.md` §0)

## สถานะ ณ 2026-09-09 เช้า (ย้าย session เพราะ context เต็ม)

### ✅ deploy แล้ว — ปิดเรื่องนี้ไปเมื่อ 2026-09-09 บ่าย (หัวข้อนี้เก็บไว้เป็นประวัติ)
> เดิมเขียนว่า "14 commit ค้าง ยังไม่ deploy ตั้งแต่ `af3ffa6`" — **ไม่จริงแล้ว**
> ผู้ใช้ deploy เองและ**ยืนยันว่าบั๊กภาพช้า 1 เฟรมหายจริงบนเครื่อง** ; รายละเอียดสถานะปัจจุบัน
> ดูหัวข้อ "สถานะ ณ 2026-09-09 บ่าย" ด้านบน — ข้างล่างนี้คือรายการว่า commit ชุดนั้นมีอะไรบ้าง

- **แก้ภาพ evidence ช้ากว่าค่า 1 เฟรมเสมอ** (`7b465c1`) — ผู้ใช้รายงานจากการใช้งานจริง
  **✅ verify บนเครื่องแล้วว่าหายจริง (2026-09-09)**
- **redesign UI ทั้งจอ** (`acb9f73`) — dark shell + warm light, การ์ดเหลี่ยมไม่มีขอบ/เงา
- **T-013/T-014 calibrate จาก UI** (`98ea323`..`59b1975`) — publish MQTT ไป edge จริงได้แล้ว
  ทีม AI **ยืนยันแล้วว่าเครื่องจริง sub ได้ปกติ** ทั้ง `command/snap-for-calibration` และ
  `config/<point_id>` (ดู `docs/INTEGRATION-MQTT-2026-09-09.html` ที่ publish เป็น artifact)
- **polish** (`104162f`) — transition ทั้งจอ, ฟอนต์ไทย self-host ไม่มีหัว (แก้ bug ที่ fallback
  เป็น Leelawadee UI มีหัวเพราะไม่เคยโหลด Noto Sans Thai จริง), ปิดแผง detail แตะนอกได้

คำสั่ง deploy เดิม (ดู `docs/DEPLOYMENT.md:157`):
```
cd ~/Meter && git pull && bun install && bun run db:migrate && bun run build && sudo systemctl restart meter
```

### git ยังไม่ได้ push 1 commit
`origin/main` อยู่ที่ `f09a58c` ส่วน local คือ `1f06f27` (docs: จดผล integration test MQTT)
— ไม่มีอะไรเสียหายถ้ายังไม่ push แค่ยังไม่ขึ้น remote

### รายงานเทส 2 ฉบับ — publish เป็น artifact ไม่ได้ commit เข้า repo
ทั้งสองไฟล์อยู่ใน `.gitignore` แล้ว (`docs/TEST-EVIDENCE-*.html`, `docs/INTEGRATION-MQTT-*.html`)
เพราะหนัก (~1MB, ฝังภาพเป็น data URI) และ Pi ไม่ต้องใช้ — ตัวไฟล์ยังอยู่บนดิสก์เผื่อรีเจน:
- `docs/TEST-EVIDENCE-2026-09-08.html` — 18 เคสป้องกัน (validation/security/บริการดับ) ครบ
  7 ภาพหน้าจอจริง
- `docs/INTEGRATION-MQTT-2026-09-09.html` — 6 MQTT topic ระหว่าง UI↔edge พร้อม payload จริง
  ที่ดักจาก `mosquitto_sub` ; ทั้งคู่มีปุ่ม export ในตัว (ดาวน์โหลด .html ผ่าน `downloads`
  capability + ปุ่มพิมพ์/PDF) ถ้าจะรีเจน PDF ใหม่ ใช้ playwright-core (`chromium.launch({channel:
  "msedge"})` แล้ว `page.pdf({preferCSSPageSize:true, printBackground:true})` หลัง
  `page.emulateMedia({media:"print"})`) — วิธีนี้ผ่านมาแล้วทั้งสองรอบ

### dev stack ยังรันอยู่ตอนจบ session (ไม่ได้ปิด)
Docker (`meter-mqtt`, `meter-postgres`) + `bun run dev:all` (api :3000, web :5173, mock ยิงทุก 5วิ)
ยังขึ้นอยู่ — เปิด session ใหม่แล้วเจอ "port ถูกใช้อยู่" ให้เช็คว่านี่คือของเดิมที่ยังไม่ปิด
(ไม่ใช่ต้อง kill ก่อนเสมอไป ใช้ต่อได้เลยถ้ายังต้องการ)

⚠️ **ระหว่างทดสอบ integration MQTT มีการ PATCH fixture ของ `pt-a-boiler-pressure` ชั่วคราว
(เหลือ 2 จุด calibration) แล้วคืนค่ากลับเป็น 4 จุดเดิมแล้ว** — เช็คแล้วว่า DB ตรงกับก่อนทดสอบ

### ของค้าง (ไม่เร่ง แต่ยังไม่ได้ทำ)
- Evidence retention policy (T-011) ยังไม่ทำ — นโยบายปัจจุบันคือเก็บไม่มีวันลบ
- `evidenceIngestStats()` ยังไม่ได้ต่อเข้า `/api/health`
- `message_size_limit` ใน `mosquitto.conf` ยังไม่ตั้ง
- `pt-a-run-lamp` ใน `dev-inventory.ts` — ผู้ใช้ยืนยันแล้วว่าไม่ใช่ของจริง แต่ยังไม่ได้ลบออก (T-020)

## สถานะ ณ 2026-09-03

**D-016 เพิ่ม `WATER_METER` + ลบ `LAMP` ออกจากสัญญาแล้ว** (commit ยังไม่ทำ ณ ตอนเขียนนี้ —
ดูรายละเอียดเต็มที่ D-016 ใน `docs/DECISIONS.md`) เหตุจาก **เพื่อนทีม AI เริ่มทดสอบมิเตอร์น้ำจริง**
บน `smsn-pi-office-01` แล้ว ส่ง `kind: "WATER_METER"` มาซึ่ง validate ไม่ผ่านของเดิม
ตอนนี้แก้ครบ 8 ไฟล์ (contract, dev-inventory, mock-edge-publisher, web components,
PUBLISHING-GUIDE) แล้ว — `type-check` ผ่านสะอาด, `smoke-db` 8/8, `verify-contract` parse ไม่ผ่าน 0/18

🔴 **ยังไม่ได้ deploy ขึ้น Pi** — ต้อง `git pull && bun install && bun run build &&
sudo systemctl restart meter` เหมือนเดิม ก่อน deploy ต้องรู้ว่าสคริปต์ของเพื่อนที่รันอยู่
(`main_proecssor.py` บน `smsn-pi-office-01`) จะเริ่มถูกเก็บลง DB จริงหลัง deploy รอบนี้
(ก่อนหน้านี้ `invalid` ขึ้นเพราะ validate ไม่ผ่าน ข้อมูลมิเตอร์น้ำไม่เคยถูกเก็บเลย)

📌 **ถ้า PUBLISHING-GUIDE.md เคยส่งให้ทีม AI ไปแล้วก่อนหน้านี้ ต้องส่งฉบับใหม่ซ้ำ** —
ตัวอย่าง `LAMP` ในนั้นใช้งานไม่ได้แล้ว เปลี่ยนเป็น `WATER_METER` หมดแล้ว

## สถานะ ณ 2026-09-01 (เก่า — ดูหัวข้อ 2026-09-03 ก่อน)

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

✅ **`e49fabc` และ `b20bc6e` deploy ขึ้น Pi แล้ว** (2026-09-01) — ผู้ใช้ยืนยัน "ได้ปกติเลย"
จอจริงตอนนี้มี banner + confidence bar + ปุ่มสลับธีมมืด/สว่างครบ

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

## 📕 คำถามกับทีม AI — **ปิดหมดแล้ว 2026-09-09 เก็บไว้เป็นประวัติ อย่าถามซ้ำ**

> ทั้งหัวข้อนี้เป็นของเก่า ตอบครบแล้วทุกข้อ (ล่าสุด: ภาพส่งเป็น raw binary · 7SEG/WATER_METER
> ใช้โมเดล) — และ **ฝั่ง edge อยู่นอกขอบเขตงานเราแล้ว** ตาม `docs/ROADMAP-PACKAGE.md`
> อ่านเพื่อเข้าใจที่มาได้ แต่อย่าเอาไปตั้งเป็นงานหรือถามกลับ

**ตอบแล้วจากข้อมูลจริง (2026-08-28)**
- อัตรายิง: เคยวัดได้ 26 เฟรม/วิ ตอนนี้ ~0.29/วิ (เขาน่าจะใส่ throttle เอง) → เราใส่ throttle ฝั่งเราแล้ว (D-012)
- ส่งเลขล้วน ไม่มีภาพ · มี heartbeat จริง (`sw=1.0.0 model=hough-polar-v1`) · ตั้ง LWT ถูก
- `quality` มีแค่ OK/UNREADABLE ไม่มี UNCERTAIN → เขาใช้เกณฑ์ตัดขาด (ตอบ OPEN-2 ไปในตัว)

**✅ ตอบครบแล้ว — ผู้ใช้ยืนยัน 2026-09-09 ว่าไม่มีคำถามค้างกับทีม AI แล้ว**
- **snapshot ส่งเป็น raw binary ผ่าน MQTT** (ไม่ใช่ base64 ไม่ใช่ HTTP) — ตรงกับที่ D-013 เลือกไว้
  ตั้งแต่แรกพอดี ; ของจริงเดินอยู่แล้ว (เห็นไฟล์ JPEG จริงบน Pi ที่ `~/meter-evidence/`)
- **SEVEN_SEGMENT / WATER_METER อ่านด้วยโมเดล** ไม่ใช่ computer vision → ไม่ต้องส่ง config
  calibrate แบบ analog gauge (ทำให้ T-014 เหลือ GAUGE ชนิดเดียว)

**ที่ยังไม่รู้ แต่เป็นเรื่องฝั่ง edge = นอกขอบเขตเรา (อย่าเอามาเป็นงานตัวเอง)**
- `pt-gauge-01` อ่านได้ช่วงไหน (min/max) — ถ้าไม่มีสเกลก็วาดเกจไม่ได้ ขึ้นได้แต่ตัวเลข
- UNREADABLE 47% — น่าจะเป็นเรื่องมุมกล้อง/แสง ไม่ใช่ตัวโมเดล

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
