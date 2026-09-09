# Changelog — Meter

<!-- AI อัปเดตหลังจบทุก step (กติกาใน CLAUDE.md ข้อ 7). ใหม่สุดอยู่บน.
     1 step = 1 ก้อน 3-6 บรรทัด: ทำอะไร/ทำไม + verify ยังไง. อ้าง ticket ถ้ามี (T-00N).
     ความเสี่ยง: 🟢 ต่ำ / 🟡 กลาง / 🔴 สูง (แตะ production/hardware/ข้อมูล) -->

---

## docs: เปิดแผนที่ "ขายเป็น package ต่อโรงงาน" + 6 ใบใหม่ (D-020, T-015…T-020)  🟢
- ที่มา: ไปหน้างานจริงเพื่อ validate ไม่ได้ และงานที่ทำในแล็บเริ่มตัน → กวาดเอกสารทั้ง `docs/`
  กับ `src/` แล้วเคาะปลายทางใหม่ = **ติดตั้งโรงงานที่ 2 ได้โดยไม่ต้องแก้โค้ด**
- **`docs/ROADMAP-PACKAGE.md` (ใหม่)** — เก็บเฉพาะของที่ยังไม่มีบ้าน: ปลายทาง · เรื่องที่รู้ว่ามาแน่
  แต่ยังถามไม่คม · สิ่งที่ตัดออกนอกขอบเขต ; **ไม่ทำ tracker ชุดใหม่** — ใบงานยังลง `TICKETS.md`
  เหตุผลที่เคาะยังลง `DECISIONS.md` เหมือนเดิม (กฎ CLAUDE.md ข้อ 5 ห้ามโครงสร้างซ้อนขนาน)
- **D-020** จด 4 ข้อที่เคาะพร้อมกัน: 1 Pi : 1 โรงงาน · ทีมเราไปติดตั้งเอง · จุดวัดเกิดจากการ
  "รับเข้า" สิ่งที่ edge ยิงมา · ยังไม่ทำ auth (T-008) — พร้อมความเสี่ยงที่ยอมรับไว้ทั้ง 3 ข้อ
- 🎉 **ระหว่างสำรวจพบว่าเส้น adopt ทำงานครบอยู่แล้ววันนี้** — `ingest` สร้างแถว `enabled=false` →
  `GET /api/points` ไม่กรองทิ้ง → การ์ดขึ้นจอพร้อมป้าย "ยังไม่ตั้งค่า" → `PATCH /:pointId`
  ตั้ง `enabled=true` ให้เอง ; งานที่เหลือจึงเล็กกว่าที่ประเมินไว้มาก ไม่ต้องสร้างระบบใหม่
- ใบใหม่: **T-015** ซ้อมติดตั้งโรงงานที่ 2 บนเครื่อง dev (DB เปล่า ไม่ seed) · **T-016** จุดวัดที่
  ไม่เอาแล้วทำยังไง (ลบแล้ว ingest สร้างซ้ำ) · **T-017** ชะตากรรม `dev-inventory.ts` + mock ·
  **T-018** อะไรต่างกันต่อโรงงาน (บล็อกด้วย T-015) · **T-019** ตั้งชื่อเครื่องจาก UI ·
  **T-020** ตัด dead code calibration
- **T-014 scope หด** — ผู้ใช้ยืนยันว่า SEVEN_SEGMENT/WATER_METER อ่านด้วยโมเดล ไม่ใช่ CV จึงไม่มี
  อะไรให้สอบเทียบ ; ใบนี้เหลืองานเดียวคือ deploy ขึ้น Pi ไปทดสอบกับ edge จริง
- ยังไม่แตะโค้ด — รอบนี้เป็นเอกสารล้วน

---

## tooling: หน้า DOCS — สารบัญซ่อนอัตโนมัติ + ไกด์ "อ่านจบแล้วไปไหนต่อ"  🟢
- ผู้ใช้ขอ 3 อย่าง: ขยายพื้นที่อ่านให้โฟกัสไฟล์เดียว · ซ่อน sidebar แล้วเด้งเมื่อเอาเมาส์ไปขอบซ้าย ·
  มีไกด์ว่าอ่าน docs นี้จบไปอ่านอันไหนต่อ
- **ไกด์ไม่ได้แต่งขึ้นใหม่ — ยึด `docs/WORKFLOW.md` §0** ทั้งการจัดกลุ่ม (วนอ่านทุกครั้ง /
  เปิดเมื่อมีคำถาม / อ่านครั้งเดียวก็พอ / เอกสารที่ส่งให้ทีมอื่น) และลำดับเลข 1-2-3 บน
  HANDOFF→ROADMAP→TICKETS ; ถ้า §0 เปลี่ยนต้องแก้ `DOCS_META` ตาม ไม่งั้นเว็บจะสอนคนละอย่าง
  กับเอกสาร (เขียนเตือนไว้ในสคริปต์แล้ว)
- ท้ายทุกไฟล์มีการ์ด **"อ่านต่อ"** (เส้นทางหลัก 1 ใบ) + **"เปิดเมื่อ"** (อ่านเพิ่มตอนสงสัยเรื่องนั้น)
  พร้อมเหตุผลว่าทำไมไฟล์นั้นต่อ ไม่ใช่แค่ลิงก์เปล่า
- sidebar เป็นแผงลอยซ่อนไว้ มีขีดจับที่ขอบซ้ายบอกว่ามีของอยู่ ; ⚠️ **hover อย่างเดียวไม่พอ** —
  gate ด้วย `@media (hover:hover) and (pointer:fine)` เพราะบนจอสัมผัส hover คือการแตะค้าง
  แผงจะเด้งตอนคนตั้งใจ scroll → เครื่องพวกนั้นใช้ปุ่ม "☰ เอกสาร" ในแถบบนแทน + Esc/แตะพื้นหลังปิด
- verify: เปิด server ชั่วคราวดูจริงบนเบราว์เซอร์ — แผงเลื่อนออกตอน hover ขอบซ้าย, กลุ่ม+เลข
  1/2/3 ขึ้นถูก, สลับไฟล์แล้ว aria-current ตาม, การ์ดอ่านต่อของ ARCHITECTURE ชี้ไป DECISIONS
  (อ่านต่อ) + DEPLOYMENT (เปิดเมื่อ) ตรงตาม `DOCS_META` ; ยืนยันตำแหน่งการ์ดด้วย
  `elementFromPoint` เพราะ screenshot ของ pane เรนเดอร์ไม่ทันเป็นบางครั้ง

---

## docs: เขียน "วิธีกลับมาอ่านให้ทัน + เลือกใบถัดไปยังไง" เป็น WORKFLOW §0  🟢
- ผู้ใช้ถามว่า "ตามจากไฟล์ไหนไปไฟล์ไหนดี จะได้เคาะถูกว่าให้ทำอะไรต่อ" — เดิมคำตอบนี้อยู่ในแชท
  อย่างเดียว หายไปทุกครั้งที่ปิด session ; **ไม่สร้างไฟล์ไกด์ใหม่** เพราะจะซ้อนกับ WORKFLOW.md
  ที่เป็นเจ้าของเรื่อง "กติกาการทำงาน" อยู่แล้ว (CLAUDE.md ข้อ 5)
- `docs/WORKFLOW.md` เพิ่ม **§0** — วน 3 ไฟล์ (HANDOFF บนสุด → ROADMAP → TICKETS) ·
  ตารางคำถาม→ไฟล์ · **กฎ "เรื่องเดียวอยู่ที่เดียว"** (HANDOFF=สถานะ · ROADMAP=ทิศทาง ·
  TICKETS=งาน · DECISIONS=เหตุผล · CHANGELOG=หลักฐาน) · เกณฑ์เลือกใบถัดไป 4 ข้อ
  โดยข้อ 1 คือ "หนี้ที่ดอกเบี้ยเดินอยู่" (ของที่แก้แล้วแต่ยังไม่พิสูจน์บนเครื่องจริง)
- `HANDOFF.md` เพิ่มหัวข้อ **▶ ทำอะไรต่อ** เรียงลำดับจริง 4 ข้อ — deploy 14 commit มาก่อน
  T-015 เพราะเป็นหนี้ที่สะสมความเสี่ยงอยู่ แม้จะไม่ได้อยู่บน roadmap
- **ยกกลับเข้า `_templates/` ให้โปรเจกต์อื่นใช้ด้วย** — §0 เดียวกัน + เติม `HANDOFF.md`
  ที่ template ไม่เคยมี (ทั้งที่ทุกโปรเจกต์สร้างเองใหม่ทุกครั้ง) + README/CLAUDE.md ชี้ถึง
- verify: `git diff --stat docs/WORKFLOW.md` = 45 insertions 0 deletions (ไม่ทับของเดิม)
  ; ไฟล์ WORKFLOW ของ Meter กับ `_templates/` ตรงกันเป๊ะตามเจตนาเดิมที่ระบุว่าไฟล์นี้ "คงที่"

---

## tooling: รวมเอกสารทั้งชุดเป็น HTML ไฟล์เดียวไว้อ่านย้อนหลัง  🟢
- ผู้ใช้อ่าน `.md` ดิบ ๆ ไม่สะดวก (TICKETS 31KB · DECISIONS 53KB · CHANGELOG 99KB) อยากได้
  แบบเดียวกับรายงาน TEST-EVIDENCE / INTEGRATION-MQTT → เผยแพร่เป็น artifact:
  https://claude.ai/code/artifact/cf14c075-0d86-49e8-b48c-f99e6621c118
- **เขียนเป็นสคริปต์ ไม่ใช่ไฟล์ตาย** ([scripts/docs-html.ts](scripts/docs-html.ts), `bun run docs-html`)
  — เอกสารเปลี่ยนบ่อย ถ้าแปลงมือครั้งเดียวจะเพี้ยนจากต้นฉบับทันที ; ผลลัพธ์ `docs/DOCS.html`
  อยู่ใน `.gitignore` ด้วยเหตุผลเดียวกับรายงานอีก 2 ฉบับ (สร้างใหม่ได้เสมอ + Pi ไม่ได้ใช้)
- **ไม่ลง dependency** — เขียน markdown renderer เองเท่าที่เอกสารชุดนี้ใช้จริง (เหตุผลเดียวกับ D-009)
  ; ⚠️ จงใจ**ไม่ทำกฎ "ย่อหน้า 4 ช่อง = code block"** เพราะ TICKETS/DECISIONS ใช้ย่อหน้าแบบแขวน
  (`why:` แล้วบรรทัดถัดไปย่อลึก) ถ้าใช้กฎนั้นทั้งสองไฟล์จะกลายเป็นกล่องโค้ดทั้งไฟล์
- ยึด design system ของแอปเอง (D-019): shell มืดคาดบน + workspace สว่าง, การ์ดไม่มีขอบ/เงา,
  radius 3px, **uppercase เฉพาะ field label** ซึ่งตรงกับ `why:/scope:/เลือก:` พอดี ;
  ฟอนต์ไทยไม่มีหัวฝังเป็น data URI (เปิดที่ไหนก็ได้ตัวเดียวกัน ไม่พึ่ง CDN)
- verify: รัน `bun run docs-html` ออก 13 ไฟล์ · ตัด index ค้นหาที่ฝังสำเนาเนื้อหาซ้ำออก
  ทำให้เหลือ 458KB จาก 803KB · ลิงก์ข้ามไฟล์ (`[TICKETS.md](TICKETS.md)`) กระโดดถึงกันได้จริง
  เพราะทุกไฟล์อยู่หน้าเดียวกันแล้ว

---

## docs: แผนที่เส้นทาง "ขายเป็น package ต่อโรงงาน" + T-015…T-020  🟢
- ผู้ใช้ติด blocked เพราะไปหน้างานจริงไม่ได้ และงานในแล็บเริ่มตัน → กวาดเอกสารทั้งโฟลเดอร์
  หาว่าอะไรควรทำต่อ แล้วเคาะปลายทางเป็น **"ติดตั้งโรงงานที่ 2 ได้โดยไม่ต้องแก้โค้ด"**
- เคาะ 4 ข้อลง **D-020**: 1 Pi : 1 โรงงาน (ไม่มี site ใน schema) · ทีมเราไปติดตั้งเอง (ตัด
  SD image/wizard) · จุดวัดเกิดจากการ **adopt** สิ่งที่ edge ยิงมา · ยังไม่ทำ auth (T-008)
- 🎉 **พบว่าเส้น adopt ทำงานครบอยู่แล้ววันนี้** — `ingest` สร้างแถว `enabled=false` →
  `GET /api/points` ไม่ได้กรองทิ้ง → การ์ดขึ้นจอพร้อมป้าย "ยังไม่ตั้งค่า" → `PATCH /:pointId`
  ตั้ง `enabled=true` ให้เอง ; งานที่เหลือจึงเล็กกว่าที่ประเมินไว้มาก ไม่ต้องสร้างระบบ provisioning ใหม่
- เปิด 6 ใบ: T-015 ซ้อมติดตั้งโรงงานที่ 2 บนเครื่อง dev · T-016 จุดวัดที่ไม่เอาแล้วทำยังไง
  (ทาง adopt แถมปัญหา "ลบแล้ว ingest สร้างใหม่") · T-017 ชะตากรรม `dev-inventory.ts`+mock ·
  T-018 อะไรต่างกันต่อโรงงาน (บล็อกด้วย T-015) · T-019 ตั้งชื่อเครื่องจาก UI · T-020 ตัด dead code
- **T-014 scope หดเหลือ GAUGE ถาวร** — ผู้ใช้ยืนยันว่า SEVEN_SEGMENT กับ WATER_METER อ่านด้วย
  โมเดล ไม่ใช่ computer vision จึงไม่มีเรขาคณิตให้สอบเทียบ ; `bboxSchema`/`sevenSegmentFixtureSchema`
  กลายเป็น dead code (เก็บไว้ตัดที่ T-020 เพราะเป็นการแก้สัญญาที่ส่งทีม AI ไปแล้ว)
- แผนที่อยู่ที่ [docs/ROADMAP-PACKAGE.md](docs/ROADMAP-PACKAGE.md) — เก็บเฉพาะปลายทาง/สิ่งที่
  ยังมองไม่ชัด/สิ่งที่ตัดออก ; ใบงานยังอยู่ TICKETS.md เหตุผลยังอยู่ DECISIONS.md ตามเดิม
  (ไม่สร้าง tracker ชุดที่สองขนานของเดิม ตาม CLAUDE.md ข้อ 5)

---

## polish: ทรานซิชันลื่นทั้งจอ + ฟอนต์ไทยไม่มีหัว + ปิดแผง detail ได้จากที่อื่นนอกจากปุ่ม X  🟢
- **ทรานซิชัน** ([styles.css](src/web/styles.css)): เพิ่ม transition สี (bg/color/border) ให้ theme
  switch + การเปลี่ยนสถานะการ์ด (ok→uncertain/over ฯลฯ) ไม่กระโดดวูบ ; แถบ confidence ไหล
  ตามค่าใหม่แทนกระโดด ; แท็บช่วงเวลาในกราฟไหลสีตอนสลับ ; ฟอร์ม config/error banner fade-in ;
  จุดปัก calibrate pop-in ; ทุก keyframe animation ใหม่ respect `prefers-reduced-motion`
  จำกัดเฉพาะ background-color/color/border-color/width เท่านั้น ไม่แตะ transform/backdrop-filter
  หนัก ๆ (Pi 5 รัน effect ต่อเนื่องไม่ไหว ตาม D-011)
- **ฟอนต์ไทยไม่มีหัว**: `--sans` เดิมอ้าง "Noto Sans Thai" อยู่แล้ว (ดีไซน์เริ่มต้นไม่มีหัว)
  แต่ไม่เคยโหลดจริง (ไม่มี `@font-face`) จึง fallback ไปฟอนต์ไทยของ OS แทน (Windows =
  Leelawadee UI ซึ่งมีหัว) — self-host ไฟล์ .woff2 (400/600/700, subset เฉพาะ unicode-range
  ไทยจาก Google เอง ~9KB/น้ำหนัก) ไว้ที่ `src/web/public/fonts/` แทนพึ่ง Google Fonts CDN
  ตอนรัน เพราะจอนี้เป็น kiosk โรงงานที่อาจไม่มี internet ตลอดเวลา
- **ปิดแผง detail จากที่อื่นได้** ([PointDetail.tsx](src/web/components/PointDetail.tsx)):
  เดิมมีแค่ปุ่ม X กับ Escape (คีย์บอร์ดจริง ไม่มีบนจอทัชสกรีนโรงงาน) เพิ่ม pointerdown
  listener ที่ document (capture phase) — แตะนอกตัวแผงและไม่ใช่การ์ดจุดอื่น → ปิด ; แตะ
  การ์ดจุดอื่นยังคงสลับไปดูจุดนั้นตามเดิม ไม่ปิด
- verify: `bun run type-check` ผ่าน ; ทดสอบที่ dev ครบ — สลับ theme/เปลี่ยนแท็บ/เปิดฟอร์ม
  config/ปักจุด calibrate ลื่นไม่กระตุก ; ฟอนต์โหลดครบ 3 น้ำหนัก (`document.fonts` "loaded")
  ตัวอักษรไทยไม่มีหัวทั้งหน้า ; แตะพื้นที่ว่างปิดแผงได้ , แตะการ์ดอื่นสลับจุดไม่ปิด ,
  แตะในฟอร์ม/อินพุตข้างในแผงไม่ปิดพลาด ; ไม่มี console error ใหม่

---

## docs: รายงาน integration test ของ MQTT (UI ↔ edge)  🟢
- ผู้ใช้ต้องการเอกสารสรุป topic/รูปแบบข้อมูลที่ UI กับ edge คุยกันผ่าน MQTT
  → เผยแพร่เป็น artifact: https://claude.ai/code/artifact/dfad4f04-06c6-4c4a-bfce-7567114c40b2
- **ดักข้อความจริงจาก broker** ด้วย `mosquitto_sub -t 'meter/#' -v` ขณะ `mock-edge-publisher`
  ทำงานอยู่ (ไม่ใช่ตัวอย่างที่พิมพ์ขึ้นเอง) ครบทั้ง 6 topic: `meter_frame`/`device_heartbeat`/
  `device_status` (edge→server, 3 ระดับ), `evidence/.../.../` (edge→server, 6 ระดับ, binary),
  `command/snap-for-calibration`/`config/<point_id>` (server→edge, ยิงผ่าน API จริงของหน้าเว็บ)
- พิสูจน์ evidence round-trip ครบวงจร: publish ภาพจริง → broker → ingest → เขียนดิสก์ → เสิร์ฟกลับ
  ผ่าน API แล้วเทียบไบต์ (`cmp`) ตรงกับไฟล์ต้นทาง 100%
- พิสูจน์พฤติกรรม retain ของ `config/<point_id>` โดยตรง — subscribe แล้วได้ค่าเดิมทันที (retained)
  จากนั้น PATCH แล้วเห็นค่าใหม่มาแทนที่ทันที ; ทดสอบเสร็จ **คืนค่า fixture 4 จุดเดิมกลับ**
  ให้ `pt-a-boiler-pressure` ไม่ให้ข้อมูลทดสอบเปื้อนของจริง
- ⚠️ ระบุขอบเขตชัดเจน: ทดสอบกับ mock-edge-publisher ไม่ใช่โค้ด edge จริงของทีม AI — พิสูจน์ได้แค่ว่า
  server publish/subscribe ถูก topic/payload ตามสัญญา ยังไม่ได้พิสูจน์ว่าเครื่องจริงรับ 2 topic
  ฝั่ง server→edge ถูกด้วย ต้องให้ทีม AI ยืนยันเอง
- ไฟล์รายงาน (`docs/INTEGRATION-MQTT-*.html`) ไม่ track เหมือน TEST-EVIDENCE — เหตุผลเดียวกัน

---

## docs: รายงานหลักฐานการทดสอบ (HTML) สำหรับส่งทีม  🟢
- ผู้ใช้ต้องการเอกสารไว้แคปส่งทีมว่าระบบถูกทดสอบให้ทนอะไรไว้บ้าง
  → เผยแพร่เป็น artifact: https://claude.ai/code/artifact/7a686aa6-26da-4f19-afa9-9bdbbaf1897d
- **ตัวไฟล์ไม่ได้ track ใน repo** (`docs/TEST-EVIDENCE-*.html` อยู่ใน .gitignore) — หนัก ~800KB
  เพราะฝังภาพเป็น data URI และ Pi ต้อง pull repo ทุกครั้งที่ deploy โดยไม่ได้ใช้ไฟล์นี้เลย
- **รันเทสจริงทั้ง 18 เคส** กับ stack ที่ทำงานอยู่ ไม่ใช่เขียนจากความจำ — A ตั้งค่าไม่ครบ (6),
  B โจมตีผ่าน URL (3), C เก็บลง DB (2), D บริการดับ/รีบูต (4), E ข้อมูลขยะจาก edge (3)
  ผ่านทั้งหมด ; เคส D1–D3 ดับ broker กับ restart postgres จริงระหว่างระบบกำลังรับข้อมูล
- แคปหน้าจอประกอบ 5 ใบด้วย playwright-core ขับ Edge ที่มีในเครื่อง (ลงไว้ใน scratchpad
  ไม่แตะ package.json) ฝังเป็น data URI ในไฟล์เดียว — CSP ของ artifact บล็อกภาพจาก
  โฮสต์ภายนอก และรายงานต้องส่งต่อเป็นไฟล์เดียวแล้วยังครบ
- ปุ่มส่งออก 2 ทางเพราะ sandbox ของ artifact บล็อกคนละอย่าง: ดาวน์โหลดใช้ `downloads`
  capability (มี blob เป็นทางสำรองนอก viewer), พิมพ์/PDF ใช้ `window.print()` แล้วดัก
  `beforeprint` เช็คว่าถูกบล็อกไหม ถ้าบล็อกให้บอกทางออกแทนที่จะเงียบ ; เขียน `@media print`
  แยก (บังคับสีอ่อน, `break-inside: avoid` รายเคส, โค้ดตัดบรรทัดแทนล้นขอบ)
- จดข้อสังเกตไว้ตามจริง 2 ข้อ: ข้อความ validation เคส A6 ยังเป็นอังกฤษ (default ของ Zod)
  และตัวตรวจ backup รายงานว่าไฟล์สำรองเก่าเกินเกณฑ์บนเครื่อง dev
- ⚠️ ระบุขอบเขตในรายงานชัดเจนว่าทดสอบบน dev (Windows + Docker) **ไม่ใช่บน Pi หน้างาน**
  หมวด D ที่เกี่ยวกับรีบูตจริงต้องรันซ้ำบน Pi ก่อนใช้อ้างเป็นหลักฐานหน้างาน

---

## fix: กราฟย้อนหลังในหน้า detail ไม่เรียลไทม์  🟢
- ผู้ใช้แจ้ง: ต้องกดรีเฟรช/เปลี่ยนช่วงเวลาถึงจะเห็นกราฟขยับ ทั้งที่ค่าบนสุด (SSE) วิ่งปกติ
- ต้นเหตุ: useEffect ที่ดึง `/history` ใน [PointDetail.tsx](src/web/components/PointDetail.tsx)
  ผูก dependency แค่ `[point.point_id, range]` — ไม่รู้เรื่องเลยว่ามีเฟรมใหม่เข้ามาทาง SSE
  (`point.captured_at` เปลี่ยน) กราฟเลยนิ่งค้างจนกว่า effect จะถูกบังคับให้รันใหม่
- แก้: เพิ่ม effect ที่สองผูกกับ `point.captured_at` อย่างเดียว ดึงกราฟซ้ำเงียบ ๆ ทุกครั้งที่
  มีเฟรมใหม่ โดย**ไม่** `setBuckets(null)` ก่อน (ต่างจาก effect เดิม) กันกราฟกระพริบเป็น
  "กำลังโหลด" ทุก 5 วิ ; เช็คฝั่ง server แล้วว่าความละเอียด bucket (`rangeSec/240` —
  เช่น 1 ชม. → 15 วิ/bucket) ละเอียดกว่าอัตราที่มิเตอร์ส่งค่าอยู่แล้ว ดึงซ้ำทุกเฟรมจึงไม่ overkill
- verify: `bun run type-check` ผ่าน ; ทดสอบที่ dev เปิดแผง detail ค้างไว้เฉย ๆ ไม่แตะอะไร
  เห็นกราฟงอกทางขวาเองตามจังหวะ mock (ทุก 5 วิ), แกนเวลาซ้ายเลื่อนตาม ; network log ยืนยัน
  `GET /history` ยิงซ้ำพร้อมทุกเฟรมใหม่จริง ไม่มี error ที่เกี่ยวข้อง

---

## fix: ภาพ evidence ช้ากว่าค่าหนึ่งเฟรมเสมอ  🟡
- ผู้ใช้แจ้งจากหน้างาน: เพื่อน snap ค่า 90 มา แต่ภาพยังเป็นของเก่า (110) ; พอ snap ใหม่
  ค่าเป็น 66 ภาพถึงจะเป็น 90 — คือ **ภาพตามหลังค่าอยู่หนึ่งเฟรมตลอด**
- ต้นเหตุ: `GET /api/evidence/:pointId/latest` **ไม่เคยอ่าน `?f=` เลย** — พารามิเตอร์นั้น
  ถูกใช้แค่ล้าง cache ฝั่งเบราว์เซอร์ ส่วนเซิร์ฟเวอร์คืนไฟล์ใหม่สุดตาม mtime เสมอ
  พอ `meter_frame` (JSON เล็ก) มาถึงก่อนภาพของเฟรมเดียวกัน (JPEG ใหญ่กว่า มาทีหลัง)
  จอจึงจับคู่ "ค่าเฟรมใหม่ + ภาพเฟรมเก่า" ตลอด — ทำลายจุดประสงค์ของภาพ evidence ทั้งหมด
  (มีไว้เทียบว่า AI อ่านค่าจากภาพนี้ถูกไหม)
- แก้ฝั่ง server ([src/server/api/evidence.ts](src/server/api/evidence.ts)): ถ้าระบุ `?f=`
  มาและมีไฟล์นั้นจริง → เสิร์ฟไฟล์นั้นตรง ๆ (ไม่ต้อง readdir ทั้งโฟลเดอร์ด้วย) ;
  ถ้ายังไม่มี → fallback เป็นภาพล่าสุดเหมือนเดิม (ดีกว่าโชว์ช่องว่าง) ; ย้ายการเซ็ต header
  ไป `sendImage()` ให้ทั้งสองทางส่ง `X-Frame-Id` ตรงกับไฟล์ที่ส่งจริง
- แก้ฝั่ง client ([src/web/useEvidenceSrc.ts](src/web/useEvidenceSrc.ts) ใหม่): หลังค่าใหม่มา
  1.2 วิ ให้ขอภาพซ้ำอีกรอบ (`&r=1`) เผื่อภาพเพิ่งลงดิสก์ — ใช้ร่วมทั้ง `PointCard` และ
  `PointDetail` ไม่เขียนซ้ำสองที่
- ตั้งใจไม่ใช้ fetch+blob แล้วอ่าน `X-Frame-Id` เทียบเอง เพราะต้องจัดการ objectURL
  (สร้าง/revoke) เองทุกใบ เสี่ยง memory leak บนจอ kiosk ที่เปิดค้างเป็นเดือน
- เพิ่ม `SAFE_FRAME_ID` regex กัน path traversal — `?f=` มาจาก query string (input ผู้ใช้)
  ต่างจาก `point_id` ที่ผ่านการเช็คกับ DB มาแล้ว
- verify: `bun run type-check` ผ่านสะอาด ; ทดสอบ endpoint ตรง ๆ ครบ 5 เคส — ขอเฟรมเก่า
  เจาะจงได้เฟรมนั้นจริง (ไม่ใช่ใหม่สุด) · เฟรมที่ยังไม่มีภาพ fallback เป็นใหม่สุด ·
  ไม่ระบุเฟรมได้ใหม่สุด · `?f=../../../etc/passwd` ตกไป fallback ไม่หลุดโฟลเดอร์ ·
  point ปลอมยัง 404 ; ดู network log ในเบราว์เซอร์เห็นยิง 2 รอบต่อเฟรมตามที่ออกแบบ

---

## รื้อ UI ทั้งชั้นภาพ: dark shell + warm light workspace  🟡
- ผู้ใช้ส่ง design doc (`Evreghen Command Center`) + ภาพ reference มาให้ แล้วตีกลับ 2 รอบ
  ว่ายัง "AI slop" — รอบแรกแปะ palette อย่างเดียว (เปลี่ยนน้อยไป) รอบสองสาด uppercase
  tracked ทั่วทุก label (ยิ่งดูเป็น admin template) → รอบนี้รื้อโครงจริงตาม D-019
- **Shell มืดคาดบน** (`.shell`, sticky z-20) ครอบ workspace สว่าง — brand mark ส้ม +
  สถานะเชื่อมต่อ + theme toggle เป็น icon ; **ไม่ทำ sidebar** ทั้งที่ reference มี เพราะ
  แอปนี้มีหน้าเดียว เมนูที่กดไม่ได้คือของปลอม
- **การ์ด = metric card**: พื้น `--surface` เรียบ ไม่มีขอบ ไม่มีเงา แยกจากพื้นด้วยสีพื้น
  ล้วน ๆ ; สถานะเป็น rail เส้นบน 2px + tag 10.5px แทน banner ตัวหนังสือหนา + ขอบสี 4px
- **ไม่มี emoji แล้วทั้งแอป** — `components/Icons.tsx` (ใหม่) เป็น SVG stroke ที่ใช้
  `currentColor` คุมสี/ขนาดตามธีมได้เหมือน text
- **uppercase micro-label ใช้ถูกที่**: เฉพาะ field label (`EDGE-01`, `ความมั่นใจ`) กับ
  status tag ; `pt-a-boiler-pressure` และชื่อจุดกลับเป็น mono/sans เงียบ ๆ
- **radius เหลี่ยมขึ้นตามที่ผู้ใช้ขอ** — การ์ด 12px → 3px, input/ปุ่ม 8px → 4px
- **พื้นหลังจูนใหม่**: doc ให้ครีมอุ่น (#fcfaf7) คู่กับเทาอมฟ้า (#f3f4f6) ซึ่งขัดกันเอง
  ดูขุ่น → เปลี่ยนเป็น hue เดียวกัน (#faf8f5 / #f1eeea)
- **แผง point detail** เลิกใช้ขาวจ้า → พื้นเดียวกับ workspace + แบ่งโครงด้วยบล็อก surface
  (hero / timeline / ฟอร์ม) ; แก้บั๊กแผงมุดใต้ shell (เพิ่ม `top: 64px`)
- ลบ dead CSS ~50 บรรทัด (`.banner`, `.badge`, `.chip`, `.qbar`, `.d-grid`, `.d-box`,
  `.topbar`, ฯลฯ) ที่ไม่มีใครอ้างแล้วหลังรื้อ — เช็คด้วยการ grep ทุก class ใน tsx ก่อนลบ
- verify: `bun run type-check` ผ่านสะอาด ; เปิดเบราว์เซอร์จริงตรวจครบ — หน้ารวม, แผง
  รายละเอียด, ฟอร์มตั้งค่า, แผง calibrate, ทั้งธีมสว่างและมืด ; ยืนยัน aria-expanded ของ
  ปุ่ม icon ถูกต้องด้วย DevTools

---

## fix(T-014): จุด calibrate ที่ปักไม่ตรงกับตำแหน่งเมาส์ (เลื่อนไปทางขวา)  🟢
- ผู้ใช้แจ้งว่าคลิกบนภาพแล้วจุดขึ้นไม่ตรงกับ cursor เลื่อนไปทางขวา ~100px+
- สาเหตุ: `.d-calib-imgwrap` (inline-block) อยู่ใน `.d-cfg` ซึ่งเป็น flex column ที่
  `align-items: stretch` (default) — ดึง wrap ให้กว้างเท่าคอนเทนเนอร์ทั้งที่เป็น inline-block
  (529px vs ภาพจริง 402px = ล้น 127px) พอคลิก `getBoundingClientRect()` ของ wrap ให้
  ขนาดใหญ่เกินภาพ ทำให้ x เศษส่วนคำนวณผิด แล้ววาดจุดเลื่อนไปทางขวา
- แก้: เพิ่ม `align-self: flex-start` ให้ `.d-calib-imgwrap` กัน stretch — จุดกับภาพจริงตรง
  กันเป๊ะทั้ง width และ position
- verify: DevTools ยืนยัน `imgRect === wrapRect` (402×302 ทั้งคู่ ก่อนแก้ wrap = 529px)
  หลังแก้: `sameWidth: true, sameLeft: true`

---

## T-014: UI canvas สำหรับ calibrate จุดวัด GAUGE — เสร็จ 1/2 (GAUGE เท่านั้น)  🟡
- ทีม AI implement edge sub เสร็จแล้ว (คุยกันในแชท 2026-09-07/08) T-013 ปลดบล็อกให้ทำ UI ต่อได้
- ปุ่ม **"🎯 Calibrate"** ใน `PointDetail.tsx` — โชว์เฉพาะจุด `kind=GAUGE` (7-segment/water meter
  ยังไม่ทำ fixture คนละรูปแบบ ดู note ใน T-014)
- แผง calibrate: "ขอภาพใหม่" → publish command ผ่าน `request-calibration-snap` แล้ว **poll
  จริง** เทียบ header `X-Frame-Id` กับ `request_id` (ไม่ใช่แค่เดาเวลา) timeout 10 วิ ; เริ่มด้วย
  evidence ที่มีอยู่แล้วถ้ามี ไม่บังคับขอใหม่ทุกครั้ง (ตาม CALIBRATION-PROPOSAL.md)
- คลิกบนภาพปักจุดอ้างอิง (เก็บเป็นเศษส่วน 0-1 ของขนาด render จริง ไม่ใช่ px ต้นทาง) กรอกค่าจริง
  แต่ละจุด ≥2 จุด → "บันทึก Calibration" เรียก `PATCH .../fixture` ที่มีอยู่แล้ว (T-013)
- pre-populate จุดเดิมจาก `point.fixture` ถ้าเคย calibrate ไว้แล้ว (แก้ไขต่อได้ ไม่ต้องเริ่มใหม่)
- `evidence.ts` (server) — เพิ่ม header `X-Frame-Id` ให้ endpoint ภาพเดิม (ใช้ตรวจ poll เท่านั้น
  ไม่กระทบ behavior เดิม)
- `apiClient.ts` — เพิ่ม `fixture` เข้า `PointRow` type (backend ส่งมาอยู่แล้วแต่ type ไม่มี) +
  `requestCalibrationSnap()` + `saveFixture()`
- verify: `bun run type-check` ผ่านสะอาด ; ทดสอบ end-to-end จริงบน dev ด้วย `mosquitto_pub`
  จำลอง edge ตอบกลับ evidence — ครบทุกเคส: ภาพโหลดสำเร็จ+จุดวาดตำแหน่งถูก, คลิกเพิ่มจุดได้,
  ลบจุดจนเหลือ 1 จุดแล้วปุ่มบันทึก disable ถูกต้อง, กรอกค่าว่างแล้ว validate error ไม่ให้บันทึก,
  บันทึกสำเร็จแล้ว DB+MQTT retained ตรงกันเป๊ะ ; `/api/health` ยืนยัน `ingest.invalid: 0`
- 🔴 ระหว่างทดสอบเจอว่า **timeout 10 วิสั้นเกินสำหรับทดสอบมือด้วย `mosquitto_pub`** (คนละเรื่อง
  กับ edge จริงที่ตอบเร็วกว่ามาก) ต้องปรับเป็น 60 วิชั่วคราวระหว่างทดสอบแล้วเปลี่ยนกลับ 10 วิ
  ก่อน commit — ไม่ใช่บั๊ก แค่ทดสอบมือช้ากว่า edge จริงเยอะ
- ยังไม่ทำ: 7-segment (bbox UI, ลากกรอบแทนคลิกจุด), water meter (ยังไม่มี fixture schema)

---

## T-013 ช่วง 2/3: endpoint ขอภาพ calibrate + republish-config  🟡
- ต่อจากช่วง 1/3 — เพิ่มอีก 2 endpoint ที่ scope ไว้ใน T-013
- `POST /api/points/:id/request-calibration-snap` — publish command แบบ non-retained
  ไป `command/snap-for-calibration` พร้อม `request_id` ที่ server สร้าง ; เช็ค
  `device_status` ก่อนเสมอ (409 ถ้า OFFLINE กันยิงคำสั่งไปเครื่องที่ไม่ได้ต่ออยู่) ;
  publish ล้มเหลว → 503 (ต่างจาก PATCH fixture — command ไม่มี DB ให้ fallback เพราะเป็น
  event ชั่วคราวล้วน ๆ ไม่ใช่ config)
- `POST /api/points/:id/republish-config` — อ่าน fixture จาก DB แล้ว publish retained ซ้ำ
  ใช้กู้กรณี broker ทำ retained หายหรือ edge ใหม่ต่อเข้ามา ; validate ซ้ำก่อน publish
  เผื่อ fixture เก่าที่บันทึกไว้ไม่ตรง schema ปัจจุบันแล้ว (409 ถ้าไม่ตรง)
- `server/ingest/evidence.ts` — ใส่ `kind` เข้า log line (warn/error) เพื่อ trace ได้ว่า
  ภาพมาจาก command calibrate หรือ reading ปกติ ; **ไม่แก้ path การเซฟไฟล์เลย** เพราะ
  `kind` ไม่เคยมีผลต่อ path อยู่แล้ว (ภาพ CALIBRATION ทับตำแหน่งเดียวกับภาพปกติของจุดนั้น
  โดยธรรมชาติ ตามที่ตั้งใจไว้ใน design doc)
- verify: `bun run type-check` ผ่านสะอาด ; ทดสอบผ่าน curl + `mosquitto_sub` บน dev —
  command topic ยืนยัน retain:false จริง (sub ใหม่ทีหลัง timeout ไม่ได้ค่าเก่า) ;
  republish-config ทำงานถูกต้องทั้ง 3 เคส (มี fixture / ไม่มี fixture → 400 / point
  ปลอม → 404) ; `/api/health` ยืนยัน `ingest.invalid: 0` ไม่กระทบ pipeline เดิม
- เหลือใน T-013: คุยทีม AI ให้เพิ่ม 2 sub บน edge จริง (`command/snap-for-calibration`,
  `config/+`) ; ทดสอบ end-to-end กับ edge จริงบน Pi (ตอนนี้ทดสอบได้แค่ผ่าน mosquitto_sub
  จำลอง edge ยังไม่มี edge จริงตอบกลับ) — จบ T-013 ฝั่งเราแล้ว ที่เหลือรอฝั่งเขา

---

## T-013 ช่วง 1/3: MQTT publish บน server + `PATCH /api/points/:id/fixture`  🟡
- ทีม AI ไฟเขียว pattern ใน D-017/D-018 แล้ว เริ่มเขียนโค้ดจริง — ช่วงนี้ทำแกนกลาง
  (publish capability) ที่ endpoint อื่นของ T-013 ต้องพึ่ง ยังไม่ทำ snap-command/
  republish-config/evidence CALIBRATION (แยกไว้ช่วงถัดไป)
- อัปเดต `contract/points.ts` ตาม D-018 จริง: `gaugeFixtureSchema` เป็น
  `{calibration: [{x,y,value}]}` ขั้นต่ำ 2 จุด (message ไทยกำกับ) ; `bboxSchema` เป็น
  เศษส่วน 0-1 พร้อม `.refine` ตรวจ `x+w≤1`/`y+h≤1` (ตรวจได้ทันทีเพราะไม่ต้องรู้ resolution
  จริงเหมือนตอนเป็น px)
- เพิ่ม topic helpers `snapForCalibration()`/`config()` ใน `contract/topics.ts`
- `server/ingest/index.ts` — เพิ่ม `publish()` export ใช้ client เดียวกับที่ subscribe
  (ไม่เปิด connection ที่สอง) ; ไม่ throw เมื่อ mqtt ยังไม่พร้อม (INGEST=false หรือยังไม่ต่อ)
  เพราะ DB ต้องเขียนสำเร็จได้เสมอไม่ว่า broker จะพร้อมหรือไม่
- `PATCH /api/points/:pointId/fixture` ([src/server/api/points.ts](src/server/api/points.ts))
  — validate ด้วย `pointFixtureSchema` → เขียน DB → publish retained ไป
  `meter/<device>/config/<point_id>` ; publish ล้มเหลวไม่ทำให้ request ล้มตาม (คืน
  `warning` field แทน)
- verify: `bun run type-check` ผ่านสะอาด ; ทดสอบจริงผ่าน curl + `mosquitto_sub` บน dev —
  PATCH สำเร็จแล้วเห็น retained message ที่ broker ทันที ; sub ใหม่ทีหลังยังได้ค่าเดิม
  (retained ทำงานจริง) ; validate ครบ 3 เคส (calibration <2 จุด, bbox ล้นขอบ, point_id
  ปลอม) ผ่านหมด ; `/api/health` ยืนยัน `ingest.invalid: 0` ไม่กระทบ pipeline เดิม

---

## แก้ GAUGE calibration schema ตามฟีดแบ็กทีม AI: วงกลม(px) → จุดอ้างอิง(%)  🟢
- ทีม AI ทักกลับหลังอ่าน `CALIBRATION-PROPOSAL.md` — px ผูกกับ resolution กล้อง เปลี่ยนกล้อง/
  ความละเอียดแล้ว config เดิมใช้ไม่ได้เลย เสนอเปลี่ยนเป็นจุดอ้างอิง (x%, y%, value) แทน
- คุยแล้วเคาะ 3 เรื่อง (D-018): ขั้นต่ำ 2 จุด · แก้ `bbox` ของ SEVEN_SEGMENT เป็นเศษส่วนด้วย
  (ปัญหา resolution เดียวกัน) · ตัด `message_type` ออกจาก payload command/config ทั้งคู่
  (topic path บอกประเภทอยู่แล้ว ไม่ต้องซ้ำ)
- อัปเดต `docs/CALIBRATION-PROPOSAL.md` (topic A/C payload+ตัวอย่างใหม่ทั้งหมด) และ
  `docs/TICKETS.md` T-014 (UI เปลี่ยนจาก "ลากรัศมี/มุม" เป็น "คลิกจุด+กรอกค่า")
- ยังไม่มีโค้ดต้องแก้ (T-013/T-014 ยังไม่เริ่ม) — แก้แค่เอกสารตอนนี้

---

## เขียน design + tickets สำหรับ calibrate จุดวัดจาก UI  🟢
- แอดมินขอ feature ตั้ง fixture (cx/cy/r/มุม สำหรับ GAUGE ฯลฯ) จากหน้าเว็บ ให้ edge sub ไป
  apply — คุย pattern กันแล้ว (2026-09-07) เคาะเลือก command ephemeral + config retained
  ไม่มี explicit state บน edge (D-017)
- เขียน `docs/CALIBRATION-PROPOSAL.md` ครบชุด: flow diagram, topic + payload schema 3 topic
  (command, response, config), กติกาบน edge, เปรียบเทียบ trade-off กับ pattern stateful ที่
  หลีกเลี่ยง, edge cases, คำถามที่ทีม AI ต้องตอบก่อน merge
- `docs/DECISIONS.md` — เพิ่ม D-017 บันทึกการเลือก pattern พร้อมเหตุผลจาก 4 มุม (state ค้าง,
  declarative vs event, reuse pipeline, DB as source of truth)
- `docs/TICKETS.md` — เพิ่ม T-013 (backend/edge integration — ต้องคุยกับทีม AI ก่อน) และ
  T-014 (UI canvas สำหรับกำหนดจุดบนภาพ blocked โดย T-013) ; แยกใบเพราะจบคนละรอบ
- ยังไม่ได้เขียนโค้ด — รอทีม AI ตอบว่ารับ pattern ไหวไหมก่อน

---

## ล้าง ring buffer ของ sparkline เดิมที่ค้างทำงานทั้งที่ไม่มีใครใช้แล้ว  🟢
- ตามที่ค้างไว้จากรอบก่อน (เอา gauge/sparkline ออกจาก UI แต่ยังไม่ได้ล้าง state เบื้องหลัง)
- `useLiveData.ts` — เอา state `spark`, `SPARK_LIMIT`, type `SparkPoint`, และการยิง
  `fetchAllHistory("15m")` ตอนโหลดหน้าออกทั้งหมด (เดิมยิง 1 request รวมทุกจุด + ประมวลผล
  ทุก SSE event เข้า ring buffer โดยไม่มีใครอ่านผลลัพธ์เลย)
- `apiClient.ts` — ลบ `fetchAllHistory`/`BatchHistoryRow` ที่ไม่มีคนเรียกแล้ว
- `server/api/points.ts` — ลบ route `GET /api/points/history` (endpoint รวมสำหรับ sparkline
  โดยเฉพาะ) ทิ้ง ; endpoint รายจุด `GET /api/points/:pointId/history` ที่แผงรายละเอียดใช้อยู่
  ไม่กระทบ คนละ route กัน
- verify: `bun run type-check` ผ่านสะอาด ; เปิดเบราว์เซอร์จริงเช็คหน้ารวมและแผงรายละเอียด
  (กราฟประวัติรายจุด) ยังทำงานปกติ ไม่มี request ยิงไป `/api/points/history` อีกแล้ว

---

## ตั้งค่าจุดวัด (label/หน่วย/สเกล) จากหน้าเว็บได้เอง  🟡
- จุดที่ ingest สร้างอัตโนมัติ (`enabled=false`) ต้องมีคนมาตั้ง label/หน่วย/สเกลให้ก่อนถึงจะ
  ขึ้นจอหลัก — เดิมทำได้ทางเดียวคือ SQL ตรง ๆ บน Pi ตอนนี้ทำในหน้าเว็บได้เลย
- เพิ่ม `PATCH /api/points/:pointId` ([src/server/api/points.ts](src/server/api/points.ts))
  — validate ด้วย zod: ชื่อห้ามว่าง, min/max ต้องมาคู่กันหรือว่างทั้งคู่, max ต้องมากกว่า min ;
  บันทึกสำเร็จตั้ง `enabled=true` ให้เสมอ (บันทึก = คนยืนยันจุดนี้แล้ว) ; 404 ถ้า point_id ไม่มีจริง
- `PointDetail.tsx` — ปุ่ม "⚙ ตั้งค่า" เปิดฟอร์มอินไลน์ในแผงรายละเอียด (ไม่ใช่ inline-edit บนการ์ด
  เพราะการ์ดกด click ทั้งใบเพื่อเปิดแผงอยู่แล้ว ใส่ inline-edit จะชนกัน) ; บันทึกสำเร็จอัปเดต state
  ฝั่ง browser ทันทีผ่าน `patchPoint()` ใหม่ใน `useLiveData.ts` ไม่ต้องรอ SSE (ซึ่งกระจายแค่ reading
  ไม่กระจาย config) หรือ reload ทั้งหน้า
- แก้ได้ทั้งจุดที่ยังไม่ตั้งค่าและจุดที่ตั้งไว้แล้ว ฟอร์มเดียวกัน (ไม่ได้จำกัดเฉพาะ `enabled=false`)
- verify: `bun run type-check` ผ่านสะอาด ; ทดสอบผ่านเบราว์เซอร์จริง (แก้ label จุดที่ `enabled=false`
  แล้ว badge "ยังไม่ตั้งค่า" หายจากการ์ดทันทีไม่ต้อง reload) ; ทดสอบ validation ฝั่ง server ตรง ๆ ด้วย
  curl ครบ 4 เคส (ชื่อว่าง / min ไม่มี max / max ≤ min / point_id ปลอม) ผ่านหมด
- ยังไม่ทำ: ปุ่มปิดใช้งานจุด (`enabled=false` ย้อนกลับ) — ไม่มีในฟอร์มนี้ตั้งใจ เพราะ "ยังไม่ตั้งค่า"
  กับ "ตั้งค่าแล้วแต่ปิดใช้งาน" เป็นคนละเรื่องกัน

---

## เอา gauge SVG กับ sparkline ออกจากการ์ด/แผงรายละเอียด — เหลือแค่ภาพจริงจากกล้อง  🟢
- ตอนนี้มีภาพ evidence จริงจากกล้องแล้ว (T-011) เลยไม่จำเป็นต้องมี gauge SVG จำลองเข็ม/
  sparkline เส้นแนวโน้มซ้อนอีก — ของจริงดีกว่า mock เสมอ
- `PointCard.tsx` / `PointDetail.tsx` — เอา `<Gauge>` fallback และ `<Sparkline>` ออกทั้งคู่
  เหลือรูป evidence (ถ้ามี) + ตัวเลขค่าเท่านั้น
- ลบไฟล์ `Gauge.tsx` และ `Sparkline.tsx` ทิ้งทั้งคู่ เพราะไม่มีใครเรียกใช้เหลืออยู่เลยหลังจากนี้
  พร้อม CSS ที่ผูกกับมันโดยเฉพาะ (`.gauge*`, `.spark*`, `.card-spark`)
- sparkline เดิมมีปัญหาอยู่แล้วสำหรับจุดที่ไม่มีสเกล (เช่นไฟสถานะ ค่าเป็น text) จะค้าง
  "ยังไม่พอวาดเส้น" ตลอดไปเพราะไม่มีตัวเลขให้ลากเส้นตั้งแต่ต้น — ปัญหานี้หมดไปพร้อมกัน
- verify: `bun run type-check` ผ่านสะอาด (`noUnusedLocals` จับ import ที่เหลือค้างได้ครบ) ;
  เปิดเบราว์เซอร์จริงเทียบการ์ดหน้ารวมและแผงรายละเอียด ไม่มี layout ค้าง
- ⚠️ ยังไม่ได้ทำความสะอาด: ring buffer ของ sparkline ใน `useLiveData.ts` (state `spark` +
  `fetchAllHistory` ตอนโหลดหน้า) ยังทำงานอยู่เบื้องหลังทั้งที่ไม่มีใครใช้ผลลัพธ์แล้ว — เสีย
  request/CPU เปล่า ๆ ทุกครั้งที่มีค่าใหม่เข้า ตั้งใจไม่แตะตอนนี้เพราะเป็นคนละเรื่องกับ UI
  (การ์ด/แผง) ที่ผู้ใช้ขอให้แก้ — รอ confirm ก่อนเก็บกวาดส่วนนี้แยกอีกที

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
