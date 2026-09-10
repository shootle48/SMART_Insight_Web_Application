# TICKETS — backlog (active อยู่บน / done ย้ายลง archive ท้ายไฟล์)

<!-- 1 ใบ = จบใน 1 รอบ + verify ได้เอง. AI ทำทีละใบตาม WORKFLOW.md แล้วหยุดรอ confirm.
     เจองานนอก scope ระหว่างทำ → เปิดใบใหม่ ห้ามแถมในใบเดิม.
     สถานะ: todo / doing / blocked(เพราะอะไร) / done(ย้ายลง archive) -->

# Active

<!-- T-015…T-018 = ใบ "ตัดสินใจ" ของ docs/ROADMAP-PACKAGE.md (ปลายทาง: ติดตั้งโรงงานที่ 2
     ได้โดยไม่แก้โค้ด) — จบใบด้วยการ**เคาะแล้วจด DECISIONS.md** ไม่ใช่ด้วยการส่งโค้ด
     ถ้าเริ่มอยากลงมือเขียนโค้ดในใบพวกนี้ แปลว่าถึงขอบแผนที่แล้ว ให้เปิดใบทำจริงแยก -->



## T-018 [P2] เคาะ: อะไรบ้างที่ต่างกันต่อโรงงาน และเก็บที่ไหน — blocked (รอ T-015)
why:        ปลายทางคือ "ไม่ต้องแก้โค้ด" แต่ยังไม่มีรายการว่าอะไรบ้างที่ต่างกันจริง ; `.env` รับไป
            เยอะแล้ว (throttle/retention/`MQTT_TOPIC_PREFIX`/พอร์ต) แต่ไม่รู้ว่าพอไหม
            ที่เห็นชัดแล้ว 1 อย่างคือ **ชื่อบนจอ hardcode เป็น `METER`** (`App.tsx:73`)
scope:      เอารายการจริงที่ T-015 จดมา จัดว่าอันไหนควรอยู่ที่ `.env` (ตั้งครั้งเดียวตอนติดตั้ง) /
            DB+UI (ลูกค้าแก้เองหลังเราออกจากโรงงาน) / hardcode ต่อไปได้
done-when:  จด DECISIONS.md ว่าแบ่งด้วยเกณฑ์อะไร แล้วเปิดใบทำจริงต่อ
note:       เกณฑ์ที่เสนอไว้ก่อน: **ของที่ลูกค้าอยากแก้เองหลังเราออกจากโรงงาน → ต้องอยู่ใน UI**
            ; ของที่แก้ผิดแล้วระบบพัง → `.env` ที่ต้องตั้งใจแก้

## T-017 [P2] เคาะ: ชะตากรรมของ `dev-inventory.ts` + `mock-edge` ตอนขายจริง — todo
why:        หัวไฟล์ `dev-inventory.ts` สั่งไว้เองว่า "ลบไฟล์นี้ทิ้งเมื่อ edge จริงมาแล้วและมีหน้าจอ
            ตั้งค่าจุดวัดเอง" — **เงื่อนไขครบทั้งสองข้อแล้ว** แต่ `db:seed` กับ
            `mock-edge-publisher.ts` ยังพึ่งมันอยู่ ; ที่โรงงานลูกค้า `db:seed` จะยัดโรงงานปลอม
            (`edge-01` "ตู้ควบคุมหม้อไอน้ำ" ฯลฯ) เข้าไปในระบบจริง
scope:      เคาะ 3 เรื่อง — mock ยังต้องมีไหม/กินข้อมูลจากไหนถ้า dev-inventory หายไป ·
            `db:seed` ควรหายไปเลย หรือกลายเป็น demo mode ที่ต้องสั่งชัด ๆ ·
            `purge-dev-seed.ts` ที่มีอยู่แล้วพอสำหรับล้างของปลอมไหม
done-when:  จด DECISIONS.md + รู้ว่าต้องเปิดใบทำจริงกี่ใบ
note:       mock ยังจำเป็นแน่ ๆ ตอน dev (ไม่มี edge จริงบนเครื่อง Windows) — อย่าเผลอตัดจน
            ทดสอบอะไรไม่ได้เลย ; ทางที่น่าจะถูกคือแยก "ข้อมูลตัวอย่างของ mock" ออกจาก
            "ข้อมูลตั้งต้นที่ยัดลง DB" ซึ่งตอนนี้เป็นไฟล์เดียวกัน

## T-016 [P2] เคาะ: จุดวัดที่ไม่เอาแล้ว ทำยังไง — todo
why:        ทาง adopt ที่เคาะใน D-020 แถมปัญหามาให้ — จุดที่รับเข้าผิด / edge เลิกยิง / `point_id`
            พิมพ์ผิดครั้งเดียว จะค้างบนจอตลอดไปเพราะ **ไม่มี DELETE ทั้งใน API และ UI** ;
            และต่อให้ลบได้ `ingest` จะสร้างแถวใหม่ให้ทันทีที่ edge ยิง id นั้นมาอีก = ลบไม่ออกจริง
scope:      เคาะว่าจะใช้ทางไหน — ลบจริง (แล้ว `readings` ของมันไปไหน) / ซ่อน (`enabled=false`
            + ไม่แสดงบนจอ) / archive ; **และกลไกกันสร้างซ้ำ** (blocklist ต่อ point_id? หรือถือว่า
            edge ยิงมา = ต้องโผล่เสมอ แล้วแก้ที่ต้นทางแทน)
done-when:  จด DECISIONS.md ว่าเลือกทางไหนเพราะอะไร แล้วเปิดใบทำจริงต่อ
note:       ⚠️ เคสที่ต้องทดสอบไม่ว่าเลือกทางไหน: **ลบแล้ว edge ยิงมาอีก** — ถ้าคำตอบคือ "โผล่ใหม่"
            แปลว่าเราไม่ได้แก้ปัญหา แค่ย้ายที่ ; อย่าลืมว่า `readings` มี FK ไป `points`

## T-015 [P2] ซ้อมติดตั้ง "โรงงานที่ 2" บนเครื่อง dev — todo
why:        ปลายทางของ ROADMAP-PACKAGE คือติดตั้งโรงงานที่ 2 ได้โดยไม่แก้โค้ด แต่**ยังไม่มีใคร
            เคยเดินเส้นนั้นจริงแม้แต่ครั้งเดียว** — รายการ "อะไรที่ต่างกันต่อโรงงาน" ตอนนี้เป็น
            การเดาจากการอ่านโค้ดล้วน ; ถูกที่สุดคือซ้อมบนเครื่อง dev ก่อนไปเจอของจริงหน้างาน
            (ยิ่งตอนนี้ไปหน้างานไม่ได้ ใบนี้คือวิธีที่ใกล้เคียงที่สุดที่ทำได้)
scope:      DB เปล่าใบใหม่ → `db:migrate` → **ไม่รัน `db:seed`** → ปล่อย `mock-edge` ยิงเป็น edge
            ของโรงงานใหม่ → รับจุดเข้าผ่าน UI จนจอใช้งานได้จริง → **จดทุกจุดที่ต้องแก้โค้ด/แก้ไฟล์/
            พิมพ์คำสั่งเอง** ระหว่างทาง
done-when:  มีรายการ "ติดตรงไหนบ้าง" ที่ได้จากการทำจริงไม่ใช่การอ่านโค้ดเดา — และแยกได้ว่า
            จุดไหนแก้จาก UI/`.env` ได้แล้ว จุดไหนยังต้องแก้โค้ด
note:       🔴 **ห้ามแตะ DB ของ dev เดิม** — สร้างฐานใหม่แยก (ของเดิมมีข้อมูลทดสอบที่ใช้อ้างอิงอยู่)
            ; ผลของใบนี้ป้อนเข้า T-018 โดยตรง จึงต้องทำใบนี้ก่อน

## T-014 [P2] UI canvas ให้แอดมินคลิกกำหนดจุด calibration บนภาพ — doing
why:        ครึ่งหลังของ D-017 (calibrate จาก UI) — ครึ่งแรกคือ backend/broker plumbing (T-013)
            ครึ่งนี้คือให้แอดมินคลิกจุดอ้างอิงบนภาพแล้วพิมพ์ค่าจริง ณ จุดนั้น (GAUGE, ดู D-018)
            หรือลาก bbox แบบเศษส่วน (SEVEN_SEGMENT) บนภาพจริง ; ตอนนี้ไม่มี UI ทำเรื่องนี้เลย
scope:      component canvas ใหม่ในแผงรายละเอียด (`PointDetail.tsx`) — โหลดภาพจาก
            `/api/evidence/:pointId/latest` เป็น background · overlay SVG ที่คลิกกำหนดค่า
            ตาม kind (GAUGE: คลิกจุด + กรอกค่า ≥2 จุด, เก็บพิกัดเป็นเศษส่วน 0-1 ของขนาดภาพ
            ที่ render ไม่ใช่ px จริง ; SEVEN_SEGMENT: ลาก bbox แล้วแปลงเป็นเศษส่วนก่อนส่ง) ·
            ปุ่ม "ขอภาพใหม่" ยิง command ผ่าน server (ไม่ pub ตรงจาก browser ห้ามให้ browser
            เขียน MQTT ตรง) · ปุ่ม Done ยิง `PATCH /api/points/:id/fixture`
            (extend endpoint ที่มีอยู่แล้ว)
done-when:  แอดมินเปิดจุดใหม่ (ไม่มี fixture) → กด "ขอภาพ" → คลิก 3 จุดบน gauge (พิมพ์ค่าที่
            รู้จริง เช่น 0/5/10) → กด Done → refresh หน้า edge อ่านค่าได้ถูก · **verify ด้วย
            point จริงบน dev (mock edge)** ไม่ใช่แค่ mock canvas
note:       ต้อง block ทำใบนี้จนกว่า T-013 (backend + edge integration) เสร็จก่อน — ไม่ใช้
            งานได้ถ้ายังไม่มี command topic + config publish
            ✅ **2026-09-09 scope หดเหลือ GAUGE อย่างเดียวถาวร** — ผู้ใช้ยืนยันว่า SEVEN_SEGMENT
            กับ WATER_METER อ่านด้วยโมเดล ไม่ใช่ computer vision จึงไม่มีเรขาคณิตให้สอบเทียบ
            (ของเดิมที่เขียนไว้ว่า "3 kinds คนละ shape ต้อง discriminated union" ตกไป
            ; ตัด schema ที่ไม่ใช้แล้วที่ T-020)
progress:   2026-09-08 GAUGE เสร็จแล้ว — ปุ่ม Calibrate + แผงคลิกปักจุด/กรอกค่า/บันทึก ครบ
            วงจร ทดสอบผ่าน mosquitto_pub จำลอง edge ตอบกลับจริงบน dev (ภาพโหลด, จุดวาดตำแหน่ง
            ถูก, validate <2 จุด/ค่าว่างถูกกัน, save แล้ว DB+MQTT retained ตรงกัน)
            2026-09-09 **ตัด SEVEN_SEGMENT / WATER_METER ออกจาก scope ถาวร** (ดู note)
            2026-09-09 **deploy ขึ้น Pi แล้ว** (ผู้ใช้ deploy เอง + verify บั๊กภาพช้า 1 เฟรมหายจริง)
            → เงื่อนไข "ทดสอบบน Pi" ของใบนี้ผ่านฝั่งเราครบแล้ว
            🔒 **ที่เหลือบล็อกอยู่ฝั่งทีม AI อย่างเดียว** — ต้องมี edge จริงที่ sub
            `command/snap-for-calibration` แล้วตอบ evidence `kind=CALIBRATION` + apply config
            ที่ได้รับ ถึงจะพิสูจน์ done-when ข้อ "edge อ่านค่าได้ถูกหลัง calibrate" ได้
            **อยู่นอกขอบเขตเรา — อย่านับเป็นงานค้างของเรา**

## T-013 [P2] backend + edge integration สำหรับ calibrate ผ่าน UI — doing
why:        D-017 เคาะ pattern แล้ว ; ครึ่งแรกคือทำให้ browser สั่ง snap + publish config
            retained ผ่าน server ได้ (ไม่ให้ browser ยิง MQTT ตรง) · ยังไม่มีอะไรทำเรื่องนี้เลย
            ตอนนี้ MQTT publish บน server ไม่มีเลย (subscribe อย่างเดียว)
scope:      - เพิ่ม MQTT publisher ใน `src/server/ingest/` (reuse connection ที่ subscribe อยู่)
            - endpoint `POST /api/points/:id/request-calibration-snap` → publish command
              (non-retained, QoS 1) พร้อม `request_id` ที่ server สร้าง
            - endpoint `PATCH /api/points/:id/fixture` → update DB + publish `config/<point>`
              (retained, QoS 1) พร้อม validate payload ด้วย `pointFixtureSchema`
            - endpoint `POST /api/points/:id/republish-config` → re-sync retained ↔ DB
              (fallback ถ้า broker หาย retained หรือ edge ใหม่เข้ามา)
            - ingest ต้องรู้จัก `kind=CALIBRATION` ใน evidence topic → เซฟไฟล์เหมือนเดิม
              แต่มี metadata ให้แยกได้ (log line? path? — เคาะตอนทำ)
            - **คุยกับทีม AI ให้เพิ่ม 2 sub บน edge ก่อน**: `command/snap-for-calibration`
              และ `config/<point_id>` (retained)
done-when:  บน dev — `curl -X POST /api/points/pt-a-boiler-pressure/request-calibration-snap`
            แล้วเห็น mosquitto_sub รับ command · `curl -X PATCH /api/points/…/fixture` กับ
            payload GAUGE valid แล้วเห็น retained ที่ `mosquitto_sub -t 'meter/+/config/+'` ·
            payload invalid → 400 + zod error message · **บน Pi พร้อม edge จริง** — ยิง PATCH
            แล้ว edge apply config ทันที (readings ที่ตามมาต้องเปลี่ยนตาม)
progress:   2026-09-07 เสร็จส่วน "config": `contract/points.ts` แก้ตาม D-018 จริง (calibration
            array + bbox เศษส่วน) · เพิ่ม `publish()` ใน `server/ingest/index.ts` (ใช้ client
            เดียวกับที่ subscribe) · `PATCH /api/points/:id/fixture` ครบวงจร (validate→DB→
            publish retained) ทดสอบผ่าน curl+mosquitto_sub จริงบน dev ครบ 3 เคส validate +
            retained ทำงานถูกต้อง
            2026-09-07 เสร็จส่วน "command + republish": `POST .../request-calibration-snap`
            (เช็ค device ONLINE ก่อน, publish non-retained, 503 ถ้า mqtt ไม่พร้อม) ·
            `POST .../republish-config` (อ่าน DB republish retained ซ้ำ, validate ซ้ำกัน
            fixture เก่าไม่ตรง schema) · `evidence.ts` ใส่ kind เข้า log ไม่แก้ path (ไม่จำเป็น
            เพราะ kind ไม่เคยมีผลต่อ path) ; ทดสอบยืนยัน retain:false ของ command จริง ;
            2026-09-07 ทีม AI ยืนยันแล้วว่า `mosquitto_sub` บน Pi เห็นทั้ง 2 topic
            (`command/snap-for-calibration`, `config/+`) ปกติ payload ตรงตามสัญญาที่ตกลงกัน —
            ผ่านขั้น "verify shape ก่อนเขียนโค้ด" แล้ว (ดูขั้นตอนทดสอบใน CHANGELOG)
            **ที่เหลือ (บล็อกอยู่ฝั่งทีม AI)**: เขียน edge sub จริง + ตอบกลับ evidence
            `kind=CALIBRATION` และ apply config ที่ได้รับ แล้วทดสอบ end-to-end กับ edge จริง —
            ฝั่งเราทำครบตาม scope ที่ตั้งไว้แล้ว
note:       ห้ามให้ browser publish MQTT ตรง (แม้ mqtt-over-websocket จะทำได้) เพราะ:
            (1) ยัง auth ไม่ได้จนกว่า T-008 · (2) validate ที่ 2 ที่ต้อง sync กัน · (3) DB
            กับ broker ควรเป็นเรื่องเดียวกันจาก view ของ browser · flow: browser → HTTP →
            server (validate + write DB + publish) → broker → edge
            ⚠️ **T-008 (auth) ยังไม่ทำ** = ตอนนี้ใครใน LAN ก็ส่ง command/config ปลอมได้
            ถ้าจะ deploy หน้างานก่อน T-008 ต้อง firewall กัน broker port ให้แน่นก่อน

## T-011 [P2] รับ snapshot จาก edge — doing
why:        ภาพตอน UNREADABLE คือหลักฐานว่าทำไมอ่านไม่ออก ซึ่งเป็นกุญแจแก้ปัญหา 47% ที่ค้างอยู่
scope:      subscribe `<prefix>/+/evidence/+/+/+` (**คนละ subscription กับ `meter/+/+` เดิม**
            เพราะ topic ภาพมี 6 ระดับ ของเดิมจับได้แค่ 3) · เก็บเป็นไฟล์บนดิสก์ ไม่ลง DB
            (ไม่งั้น pg_dump บวมตาม) · retention แยกและสั้นกว่าของ readings · แสดงบนการ์ด
            · ตั้ง `message_size_limit` ใน mosquitto.conf (default = ไม่จำกัด)
done-when:  edge ส่งภาพตอนอ่านไม่ออก แล้วกดดูจากการ์ดบนจอได้ · ปริมาณต่อวันไม่เกิน ~100 MB ·
            `ingest.invalid` ไม่ขยับ (ภาพต้องไม่ไหลเข้า parser ของ meter_frame)
note:       เคาะทาง B แล้ว (D-013) · ⚠️ ห้าม subscribe `meter/#` เพราะภาพจะเข้า parseTopic
            แล้วถูกนับเป็น invalid ทำให้ตัวเลขที่ใช้เฝ้าดูสัญญาเพี้ยน
progress:   2026-09-04 topic จริงจากทีม AI ต่างจาก D-013 ที่เดาไว้ (`evidence/<frame_id>/
            <point_id>/<kind>` 6 ระดับ ไม่ใช่ `snapshot/<frame_id>` 4 ระดับ) — อัปเดต
            `topics.ts` ตามของจริงแล้ว · เขียน `ingest/evidence.ts` รับ+เซฟไฟล์ที่
            `~/meter-evidence/<device>/<point>/<frame_id>.jpg` + กันภาพใหญ่เกิน (2MB
            default) เสร็จแล้ว ทดสอบจริงด้วย mosquitto_pub บนเครื่อง dev ผ่าน —
            `ingest.invalid` นิ่ง 0 ตลอด ตรง done-when
            2026-09-04 เพื่อนแก้ quality gate แล้ว ส่งภาพจริงสำเร็จ — เห็นบน Pi 13 ไฟล์
            ที่ `~/meter-evidence/edge-01/pt-7segment-01/*.jpg` ยืนยันด้วย magic number
            (`FF D8 FF E0 ... JFIF`) ว่าเป็น JPEG จริง ; เพิ่ม `GET /api/evidence/:pointId/
            latest` (เช็ค device_id จาก DB ก่อนแตะ filesystem กัน point_id ปลอม, เลือกไฟล์
            ล่าสุดตาม mtime) + แสดงใน `PointDetail.tsx` แทน placeholder เดิม พร้อม fallback
            เมื่อจุดนั้นยังไม่มีภาพ ; ทดสอบทั้ง 3 เคส (มีภาพ/ไม่มีภาพ/point_id ปลอม) ผ่านหมด
            ทั้งสองธีม
            **ที่เหลือยังไม่ทำ:** retention แยกสำหรับภาพ (ตอนนี้เก็บไม่มีวันลบ) ·
            `message_size_limit` ใน mosquitto.conf · ยังไม่ deploy ขึ้น Pi

## T-010 [P2] pg_dump cron ออกนอกเครื่อง — doing
why:        D-006 ยอมให้ Postgres อยู่บน SD โดยแลกกับต้องมี backup นอกเครื่อง
            ถ้าไม่ทำ = ยอมรับความเสี่ยงเปล่า ๆ
scope:      cron/systemd timer รัน pg_dump + ส่งออกไปเครื่องอื่น + ทดสอบ restore จริง
done-when:  ลบ DB ทิ้งแล้ว restore จาก dump กลับมาได้ครบ (ไม่ใช่แค่มีไฟล์ dump)
note:       backup ที่ไม่เคยทดสอบ restore ไม่นับว่าเป็น backup
progress:   2026-08-28 ทำแล้ว: `deploy/backup.sh` (pg_dump -Fc + rotation) ·
            `deploy/restore-test.sh` (restore เข้า db ชั่วคราว ตรวจแถว+index ไม่แตะของจริง) ·
            systemd timer ตี 3 (`Persistent=true`) · สถานะโผล่ใน `/api/health` ที่ `checks.backup`
            ทดสอบบนเครื่อง dev ผ่านทั้งคู่
🔴 ที่ยังขาด: **`BACKUP_REMOTE` ยังไม่ได้ตั้ง** เพราะยังไม่มีปลายทาง (เคาะ 2026-08-28 ว่าปล่อยไว้ก่อน)
            ไฟล์ dump จึงอยู่บน SD ใบเดียวกับ DB = **กันได้แค่ "ลบผิด" ไม่ได้กัน "การ์ดพัง"**
            ซึ่งเป็นเหตุผลทั้งหมดที่ D-006 ยอมให้ DB อยู่บน SD ตั้งแต่แรก
            → ใบนี้ยังปิดไม่ได้จนกว่าจะมีปลายทาง ; health เตือนไว้ที่ `checks.backup.warning`

## T-008 [P3] auth + ACL — todo
why:        ตอนนี้ broker เปิด anonymous ใครอยู่ใน LAN ก็ publish ปลอมได้
            · **และ wayvnc เปิด `*:5900` ไม่มี auth** (เปิดไว้ช่วง dev ตามที่เคาะ 2026-08-27)
              ต้องปิดหรือ bind loopback + SSH tunnel ก่อนเครื่องเข้าโรงงาน
scope:      ผู้ใช้/รหัสผ่านต่อ edge device + topic ACL, auth หน้าเว็บ
done-when:  edge ที่ไม่มี credential publish ไม่ได้ · เปิดหน้าเว็บโดยไม่ล็อกอินไม่เห็นข้อมูล
note:       ทำหลัง core เดินครบ (T-001..T-007) — บิ๊กสั่งโฟกัส flow ข้อมูลก่อน
            🔴 **2026-09-09 เคาะให้อยู่นอกแผนที่ "ขายเป็น package" (D-020) — เลื่อน ไม่ใช่ยกเลิก**
            เหตุผลคือยังไม่มีลูกค้ามาตั้งเงื่อนไข และการกั้นผิดแบบแพงกว่าการยังไม่กั้น ;
            **ต้องกลับมาทำก่อนส่งมอบลูกค้ารายแรกเสมอ** ดูความเสี่ยงที่ยอมรับไว้ใน D-020

---

# Archive (done — ใหม่สุดอยู่บน)

## T-020 [P3] ตัด dead code ของ calibration ที่ไม่ได้ใช้แล้ว — done
why:        2026-09-09 ผู้ใช้ยืนยันว่า **SEVEN_SEGMENT กับ WATER_METER อ่านด้วยโมเดล** ไม่ใช่
            computer vision แบบ GAUGE จึงไม่มีเรขาคณิตในภาพให้สอบเทียบ → `bboxSchema` กับ
            `sevenSegmentFixtureSchema` ไม่มีใครใช้ และครึ่งของ D-018 ที่ว่าด้วย bbox ตกไป
            ; เหลือ **GAUGE ชนิดเดียวที่ต้อง calibrate**
scope:      `contract/points.ts` (ลบ 2 schema + แก้ comment ของ `pointKindSchema` ที่ยังเขียนว่า
            7SEG "สอบเทียบด้วยกรอบสี่เหลี่ยม" และ WATER_METER "ยังไม่มี fixture schema") ·
            ไล่ว่ามีที่อื่น import ไหม · ลบ `pt-a-run-lamp` ใน `dev-inventory.ts` ที่ผู้ใช้ยืนยัน
            แล้วว่าไม่ใช่ของจริง · จด DECISIONS.md ว่าทำไม calibration เหลือ GAUGE ชนิดเดียว
done-when:  `bun run type-check` ผ่าน + `smoke-db` / `verify-contract` ยังผ่านเท่าเดิม (จำนวนไม่ลด)
note:       ⚠️ ลบ schema = แก้สัญญาที่ส่งทีม AI ไปแล้ว — เช็ค `PUBLISHING-GUIDE.md` กับ
            `CALIBRATION-PROPOSAL.md` ว่ามีตัวอย่าง 7SEG อยู่ไหม ถ้ามีต้องแก้แล้วส่งฉบับใหม่ซ้ำ
            (เคยพลาดแบบนี้มาแล้วตอน D-016 ตัด LAMP)
files:      src/contract/points.ts · src/web/apiClient.ts · src/db/schema.ts ·
            docs/CALIBRATION-PROPOSAL.md
done: 2026-09-10 ลบ 2 schema + ยุบ `pointFixtureSchema` เหลือ `gaugeFixtureSchema` ตัวเดียว
      (ไม่ต้องเป็น discriminatedUnion อีก) · ตัด union ฝั่งเว็บที่สะท้อนโครงเดิมไว้ ·
      แก้คอมเมนต์ที่ยังอ้าง bbox ใน `db/schema.ts` · จด **D-022**
      📌 **สิ่งที่ note ของใบนี้เขียนไว้ผิด**: `pt-a-run-lamp` **ไม่อยู่ใน dev-inventory แล้ว**
      (D-016 ลบไปตั้งแต่ 2026-09-03) — การ์ดที่เห็นบนจอ dev มาจากแถวเก่าใน DB ไม่ใช่โค้ด
      📌 **`PUBLISHING-GUIDE.md` ไม่ต้องแก้** — ที่นั่นพูดถึง `SEVEN_SEGMENT` ในฐานะ
      *ชนิดหน้าปัด* ซึ่งยังใช้งานปกติ ; ที่ถอนคือ *การสอบเทียบ* เท่านั้น ไม่ใช่ตัวชนิด
      ; `CALIBRATION-PROPOSAL.md` **ทำเครื่องหมายยกเลิก ไม่ลบทิ้ง** เพราะฉบับเก่าส่งทีม AI ไปแล้ว
      ; verify: type-check + build + smoke-db ผ่าน · verify-contract 36 ข้อความ parse ไม่ผ่าน 0
      ครบทั้ง 3 เครื่อง (เท่าเดิม ไม่ลด)
      🔴 **ต้องแจ้งทีม AI ว่าถอน bbox แล้ว** — ถ้าเขาเริ่มทำฝั่ง edge รองรับไว้จะเสียเปล่า



## T-022 [P2] คู่สี 4 คู่ตกเกณฑ์ AA เมื่ออยู่บน "พื้นการ์ด" — done
why:        `bun run check-contrast` (เพิ่มตอน T-021) เจอตั้งแต่รันครั้งแรก — **ต้นตอคือ
            D-014/D-015 คำนวณคู่สีเทียบกับ `--bg` (พื้นหน้า) แต่ไม่เคยเทียบกับ `--surface`
            (พื้นการ์ด)** ; คอมเมนต์ใน `styles.css` เขียนไว้เองว่า "ผ่าน 4.86:1 บนพื้น bg ใหม่"
            พอตัวหนังสือชุดเดียวกันไปอยู่บนการ์ดซึ่งเข้มกว่า (`#f1eeea` vs `#faf8f5`) จึงตก
            ⇒ **ของจริงบนจอส่วนใหญ่คือการ์ด ไม่ใช่พื้นหน้า** เกณฑ์ที่ผ่านจึงผ่านผิดที่มาตลอด
scope:      ธีมสว่าง: `--muted` บนการ์ด 4.20:1 (ต้อง 4.5) · `--dead` บนการ์ด 4.35:1 ·
            `--line` บนการ์ด 2.66:1 (ต้อง 3 — เส้นขอบที่คนต้องมองเห็น)
            ธีมมืด: `--dead` บนการ์ด 4.40:1
            → ปรับค่า token ให้ผ่านเมื่อวัดบน `--surface` โดยไม่ทำให้บน `--bg` เพี้ยน
            แล้ว **ลบชื่อคู่นั้นออกจาก `KNOWN_FAIL` ใน `scripts/check-contrast.ts`**
done-when:  `bun run check-contrast` ไม่มีรายการ ⚠️ เหลือ และ `KNOWN_FAIL` ว่าง ·
            เปิดจอจริงดูทั้งสองธีมแล้วตัวหนังสือรอง/ค่าเก่ายังแยกออกจากค่าปกติได้ด้วยตา
note:       ⚠️ **ห้ามแก้ด้วยการลดเกณฑ์หรือเติมเข้า KNOWN_FAIL** — รายการนั้นมีไว้บันทึกหนี้เก่า
            อย่างเดียว ไม่ใช่ที่ซ่อนของใหม่
            ; `--dead` ตกทั้งสองธีม แปลว่าต้องคิดใหม่ทั้งคู่ ไม่ใช่ขยับทีละธีม
            ; ระวังผลข้างเคียง — `--muted`/`--dim` เป็นค่าเดียวกัน ใช้ทั่วทั้งแอป
files:      src/web/styles.css (4 token) · scripts/check-contrast.ts (ปิดรู rgba + ล้าง KNOWN_FAIL)
done: 2026-09-10 ปรับ **ความสว่างอย่างเดียว คง hue เดิม** เพื่อให้หน้าตาเปลี่ยนน้อยที่สุด —
      ขยับแค่ 7-12 หน่วยใน sRGB : `--muted`/`--dim` #797067→#726961 (4.20→4.65) ·
      `--dead` สว่าง #6b7070→#676c6c (4.35→4.61) · `--line` สว่าง #8f9495→#83888a (2.66→3.10) ·
      `--dead` มืด #a89f96→#aba39a (4.40→4.60)
      🔴 **ระหว่างทางพบว่าสคริปต์ตรวจมีรู**: ธีมมืดตั้ง `--line` เป็น `rgba()` ซึ่งไม่ใช่ hex
      แล้ว `val()` fallback ไปวัดค่าธีมสว่างเงียบ ๆ → รายงานว่าผ่านทั้งที่วัดผิดตัว
      แก้ให้ composite rgba ทับพื้นก่อนคำนวณ **แล้วเจอคู่ที่ 5 ที่ไม่เคยมีใครตรวจ**:
      `--line` มืด .36 ทับพื้นการ์ด = 2.93:1 ตกเกณฑ์ → ปรับเป็น .40 ได้ 3.26:1
      ; verify: `check-contrast` ผ่านครบ 32 คู่ · `KNOWN_FAIL` ว่าง · ไม่มีคู่ไหนถูกข้าม ·
      type-check + build + smoke-db ผ่าน
      ⚠️ **ยังไม่ได้ดูด้วยตา** — done-when ข้อ "ตัวหนังสือรอง/ค่าเก่ายังแยกจากค่าปกติได้" ต้องให้คนดู


## T-023 [P1] กราฟย้อนหลังไม่ขึ้นสำหรับ 7SEG/WATER_METER — done
why:        ผู้ใช้เจอบนเครื่องจริง: ค่าปัจจุบันขึ้นปกติ แต่กราฟขึ้นข้อความ "ยังไม่มีข้อมูลพอ
            วาดกราฟในช่วงนี้" เฉพาะ SEVEN_SEGMENT กับ WATER_METER (GAUGE ปกติ)
            ⇒ สองชนิดนี้ edge ส่ง**เลขนับมาในช่อง `value_text`** (D-016) ทำให้
            `avg(value_num)` เป็น null ทุก bucket ; ต้นตออยู่ที่ edge ส่งผิดช่อง แต่ edge
            อยู่นอกขอบเขตเรา (D-020) จึงรับมือฝั่งเรา
scope:      (ก) `api/points.ts` history — cast `value_text` ที่หน้าตาเป็นตัวเลขมารวมด้วย
            (ข) `ingest/normalize.ts` + `ingest/index.ts` — เติม `value_num` ตอนรับเข้า
            (ค) `HistoryChart.tsx` — แยกข้อความให้ตรงความจริง 3 กรณี
done-when:  จุด 7SEG ที่ส่งค่าเป็นข้อความขึ้นกราฟได้ · ค่าที่เป็นคำจริง ๆ ไม่ถูก cast มั่ว
files:      src/server/api/points.ts · src/server/ingest/{normalize,index}.ts ·
            src/web/components/HistoryChart.tsx · src/web/styles.css
done: 2026-09-10 ทำทั้ง (ก)+(ข) ตามที่ผู้ใช้เคาะ — **(ก) ทำให้ข้อมูลเก่าที่เก็บไว้แล้วขึ้นกราฟ
      ทันที** ไม่ต้องรอข้อมูลใหม่ ส่วน **(ข) ได้ deadband throttle กลับมาด้วย** ซึ่งจุดพวกนี้
      ไม่เคยโดนบีบเลยเพราะ deadband เทียบด้วยตัวเลข
      ; verify ด้วยข้อมูลจริงที่ยิงผ่าน MQTT: `"['9dot875']"` → เก็บเป็น `9.875` + เติม
      `value_num` ให้ · `"ERR"` ยังเป็นข้อความ `value_num` ว่าง ไม่ได้เลขมั่ว · `invalid` คง 0
      · history คืน `avg_value` เป็นเลขจริงจากค่าที่อยู่ในช่องข้อความ · SVG วาดติดบนหน้าเว็บ
      ⚠️ regex ฝั่ง SQL กับฝั่ง TS **ต้องตรงกันเป๊ะ** ไม่งั้นข้อมูลก่อน/หลัง deploy จะถูกนับ
      คนละแบบ แล้วกราฟจะมีรอยต่อแปลกตรงวันที่ deploy — เขียนเตือนไว้ในทั้งสองไฟล์แล้ว

      ✅ **2026-09-10 ผู้ใช้ยืนยันบนเครื่องจริงแล้วว่ากราฟจุด 7SEG ขึ้นจริง** — ปิดข้อค้าง
      "ตรวจได้แค่ระดับ DOM" ของใบนี้

## T-021 [P2] ปุ่มหลักในฟอร์มไม่เคยได้สีส้มจริง — specificity ชนกัน — done
why:        เจอระหว่างทำ T-019 — `.d-cfg-save` ตั้ง `background: var(--primary)` ไว้ แต่
            `.d-cfg-actions button` มี specificity สูงกว่า **(0,1,1) > (0,1,0)** จึงชนะเสมอ
            ⇒ ปุ่มบันทึกได้พื้น `--panel` **ไม่เคยเป็นปุ่มหลักสีส้มอย่างที่ตั้งใจเลยตั้งแต่แรก**
scope:      `web/styles.css` — แก้ selector + ไล่ตรวจแพตเทิร์น `.x button {}` ทั้งไฟล์
done-when:  ปุ่มบันทึกเป็นสีส้มจริงทั้งสองธีม · คู่สีผ่าน WCAG AA (คำนวณจริง ไม่กะด้วยตา)
files:      `web/styles.css` (token 4 ตัว + 3 selector)
done: 2026-09-09 **กวาดทั้งไฟล์แล้วพบว่าพังจุดเดียวจริง** — `.d-calib-primary`/`.d-calib-ghost`
      ปลอดภัยเพราะ `.d-calib-row button` ไม่ได้ตั้ง background/color/border ทับ (ไม่มี property
      ชนกัน) · `.err button` ไม่มีคลาสเดี่ยวมาชน · `.theme-toggle button.on` เขียน selector ถูกอยู่แล้ว
      ; **อาการที่ทำให้ไม่มีใครจับได้มาก่อน**: `:hover:not(:disabled)` ดัน specificity เป็น (0,3,0)
      จนชนะ ⇒ ปุ่มเทาตอนปกติแต่ส้มตอน hover ซึ่งดูเหมือน hover effect ที่ตั้งใจ
      ; 🔴 **แต่แก้ specificity อย่างเดียวไม่พอ** — คำนวณแล้ว `--primary` + ตัวอักษรขาวได้แค่
      2.86:1 (สว่าง) / 2.82:1 (มืด) ตกเกณฑ์ AA ⇒ ต้องแยก token พื้นปุ่มออกมา (**D-021**)
      ; verify: สคริปต์คำนวณ contrast โดยอ่าน token จาก `styles.css` จริง ผ่านครบ 10 คู่ ·
      ตรวจ DOM บนหน้าที่โหลดใหม่ทั้งสองธีม (สว่าง `#c2410c`+ขาว · มืด `#fe6e00`+`#2b2622`)
      ⚠️ ยืนยันด้วย DOM ไม่ใช่ภาพ — browser pane ไม่ยอมวาด และ `getComputedStyle` คืนค่าค้าง
      หลังสลับธีมตอนรัน (ต้องโหลดหน้าใหม่ถึงจะอ่านค่าถูก)

      ✅ **2026-09-10 ผู้ใช้ยืนยันบนเครื่องจริงแล้วว่าปุ่ม "บันทึก" เป็นสีส้มทั้งสองธีม** —
      ปิดข้อค้างเรื่องยืนยันด้วยตา (เดิมตรวจได้แค่ค่า computed ใน DOM)

## T-019 [P3] ตั้งชื่อเครื่อง (`devices.label`) จาก UI — done
why:        ingest สร้างแถว device ให้อัตโนมัติโดย**ไม่ใส่ label** (`insert ... onConflictDoNothing`)
            → DeviceBar ขึ้น `edge-01` ดิบ ๆ ที่คนหน้างานไม่รู้ว่าหมายถึงตู้ไหน ; ตาราง `devices`
            มีคอลัมน์ `label` และ API ก็คืนมาให้แล้ว ขาดแค่ทางตั้งค่า — ตอนนี้ตั้งได้ทางเดียวคือ
            `db:seed` ซึ่งใช้ที่โรงงานลูกค้าไม่ได้
scope:      `PATCH /api/devices/:deviceId` (รับแค่ `label`) + ที่แก้ใน `DeviceBar.tsx`
done-when:  เครื่องที่ ingest สร้างเอง ตั้งชื่อไทยได้จากจอ แล้วชื่อขึ้นแทน `device_id` ทันที
files:      `server/api/devices.ts` · `web/apiClient.ts` · `web/useLiveData.ts` ·
            `web/components/DeviceBar.tsx` · `web/App.tsx` · `web/styles.css`
done: 2026-09-09 ทดสอบด้วยเครื่องที่ ingest สร้างเองจริง (publish `meter/edge-t019/meter_frame`
      เข้า broker → แถวโผล่พร้อม `label: null`) → ตั้งชื่อไทยจากจอ → ขึ้นทันทีโดยไม่ reload
      → ยืนยันลง DB จริง ; เทสเคสพลาดครบ: ชื่อว่าง 400 · เกิน 80 ตัว 400 · เครื่องไม่มีจริง 404
      ; **แก้บั๊กพ่วง**: เดิม `.dev-name` fallback เป็น `device_id` ทำให้เครื่องที่ยังไม่ตั้งชื่อ
      ขึ้น id ซ้ำกับบรรทัดบน (ต่างแค่ตัวพิมพ์) ดูเหมือนของเสีย → เปลี่ยนเป็น "ยังไม่ตั้งชื่อ"
      แบบจางซึ่งบอกใบ้ไปในตัวว่าแตะได้
      ; **เจอของนอก scope → เปิด T-021**: ปุ่มหลัก `.d-cfg-save` โดน specificity ชนมาตลอด
      🔴 **ยังไม่ได้ยืนยันด้วยตาในธีมมืด** — browser pane ไม่ยอมวาดตอนท้าย (จอเปล่า) และ
      `getComputedStyle` คืนค่าค้าง ; ตรรกะ cascade ยืนยันได้จากซอร์สว่าถูก แต่ถ้าเปิดจอจริง
      แล้วปุ่มบันทึกยังไม่เป็นสีส้ม ให้ดู T-021 เป็นที่แรก

## T-002 [P1] สัญญา MQTT + mock edge publisher — done
why:        ทีม AI ยังไม่ให้สัญญามา — เราเสนอไปก่อนจะเร็วกว่ารอ และได้ของไว้ทดสอบทั้งระบบ
scope:      `src/contract/schemas.ts` (Zod: meter_frame, device_heartbeat + topic map),
            `scripts/mock-edge-publisher.ts` จำลอง 3 device, `deploy/mosquitto.conf`
            อิงคำศัพท์จริงจาก `../bench/samples.json` (cx/cy/r/min_angle/max_angle/min_value/max_value/unit)
done-when:  `mosquitto_sub -t 'meter/#' -v` เห็นข้อความจากครบ 3 device และ script เล็ก ๆ
            parse ทุกข้อความผ่าน Zod ได้ 100% ; ปิด mock แล้ว retained ถูกล้าง
files:      src/contract/*, scripts/mock-edge-publisher.ts, deploy/mosquitto.conf
note:       ทุกจุดที่เดาต้องมี comment `OPEN:` กำกับ — ไฟล์นี้จะถูกส่งให้ทีม AI อ่าน
done: 2026-08-25 สัญญา 4 ไฟล์ใน src/contract/ + mock 3 เครื่อง/10 จุด + verify script ;
      ระหว่างทำเจอว่าการล้าง retained ตอนปิดใช้ไม่ได้จริง → เปลี่ยนไปใช้ LWT (D-005)
      และเพิ่ม device_status เข้าสัญญา (OPEN-7)

## T-001 [P1] scaffold โปรเจกต์ (Bun + Hono + Vite/React + TS) — done
why:        ยังไม่มีอะไรให้รันเลย ทุกใบที่เหลือรอใบนี้
scope:      package.json, tsconfig, vite config, Hono server ว่าง ๆ, หน้า React ว่าง ๆ,
            script dev/build ; **ไม่รวม** DB, MQTT, UI จริง
done-when:  `bun run dev` เปิด http://localhost:5173 เห็นหน้าเปล่าที่ fetch `/api/health` ได้ 200
            และ `bun run build` ออก `dist/` ที่ `bun run start` เสิร์ฟได้
files:      package.json, tsconfig.json, vite.config.ts, src/server/index.ts, src/web/*
done: 2026-08-25 Hono + Vite/React รันได้ทั้งโหมด dev และ prod ;
      ระหว่างทำเจอ 2 เรื่อง: app.notFound() ของ Hono เป็น global ทำให้ /api/* ที่ไม่มีจริง
      คืน HTML 200 (แก้แล้ว) และ Bun script shell ไม่รองรับ `&` จึงต้องใช้ concurrently

## T-003 [P1] DB schema + migration — done
why:        ต้องมีที่เก็บก่อน ingest จะเขียนได้
scope:      ตาราง `devices`, `points` (config หน้าปัด), `readings` (time-series),
            partition รายเดือน + BRIN บน `captured_at` ; seed จุดวัดของ mock
done-when:  `bun run db:migrate` ผ่านบน Postgres เปล่า + `db:seed` ซ้ำได้ไม่พัง (idempotent)
            + insert แถวที่ `quality=UNREADABLE` แล้ว value เป็น null ได้จริง
files:      src/db/schema.ts, src/db/index.ts, src/db/seed.ts, drizzle.config.ts
note:       สัญญายังไม่นิ่ง → `readings` ออกแบบให้ยืดหยุ่น (value_num/value_text แยกคอลัมน์)
            ตั้งใจแลก type safety กับความง่ายในการรื้อ
done: 2026-08-26 3 ตาราง + BRIN + seed idempotent + smoke test 9 ข้อผ่าน ;
      เบี่ยงจากแผน: ยังไม่ partition (D-007 → T-009) ; ย้ายรายการจุดวัดไป
      src/db/dev-inventory.ts ให้ seed กับ mock ใช้ร่วมกัน กัน parallel structure

## T-004 [P1] ingest: MQTT → validate → DB — done
why:        หัวใจของระบบ ข้อมูลต้องลงถังให้ได้ก่อนคิดเรื่องแสดงผล
scope:      subscribe `meter/+/+` (clean:false, QoS 1), Zod validate, เขียน Postgres,
            emit ค่าสดผ่าน EventEmitter ; ข้อความ parse ไม่ผ่าน → log + ทิ้ง ห้ามทำทั้ง process ตาย
done-when:  รัน mock 60 วินาที แล้ว `SELECT count(*)` ตรงกับจำนวนที่ publish จริง ·
            แถว UNREADABLE เก็บเป็น null ไม่ใช่ 0 · ยิง JSON เสียเข้าไป process ยังอยู่
files:      src/server/ingest/*
note:       เก็บ `received_at` ของฝั่งเราคู่กับ `captured_at` ของ edge เสมอ
done: 2026-08-26 ingest อยู่ใน process เดียวกับ Hono · smoke-ingest ผ่าน 12/12 ·
      เพิ่ม unique (point_id, frame_id) ทำให้ idempotent (D-008) เพราะ QoS 1 + retained
      ส่งซ้ำได้ตามสเปก · จุดวัด/เครื่องที่ไม่รู้จักถูกสร้างให้ (enabled=false) ไม่ทิ้งข้อมูล

## T-005 [P1] API + SSE — done
why:        หน้าเว็บต้องมีทางดึงค่าล่าสุด/ประวัติ และรับค่าสด
scope:      Hono: `GET /api/points` (ค่าล่าสุดทุกจุด), `GET /api/points/:id/history?range=`,
            `GET /api/devices`, `GET /api/stream` (SSE)
done-when:  `curl -N localhost:3000/api/stream` เห็น event ไหลออกมาตอน mock ยิง ·
            history คืนข้อมูลย้อนหลังตามช่วงที่ขอจริง
files:      src/server/api/*
done: 2026-08-26 4 endpoint + SSE ทดสอบกับ mock จริง ; history รวมเป็น bucket
      (avg/min/max + นับ UNREADABLE) แทนการคืนแถวดิบแล้ว cap ซึ่งจะตัดข้อมูลเงียบ ๆ ;
      พิสูจน์ว่า SSE ไม่ทิ้ง listener ค้าง (sse_clients 0 -> 2 -> 0)

## T-006 [P1] Dashboard UI — done
why:        เป้าหมายของโปรเจกต์ — ให้ฝ่ายผลิตดูค่าบนจอได้
scope:      หน้าเดียว: การ์ดต่อจุดวัด (ค่า+หน่วย+sparkline), gauge สำหรับค่าที่มี min/max,
            แถบสถานะ device 3 ตัว, ทำเครื่องหมาย stale/UNREADABLE ให้ต่างจากค่าปกติชัดเจน
done-when:  เปิดเบราว์เซอร์ค้างไว้ เห็นตัวเลขขยับเองตาม mock โดยไม่ต้อง refresh ·
            ปิด mock แล้วการ์ดขึ้นสถานะ stale ภายใน 30 วินาที
files:      src/web/*
note:       ยังไม่ทำ alarm/threshold — รอทีม AI ตอบว่ามี requirement ไหม
done: 2026-08-26 dashboard + gauge/sparkline เขียน SVG เอง (D-009, bundle +8KB) ;
      แยก min/max ออกจาก fixture เพื่อให้วาดเกจได้ตั้งแต่ยังไม่ตั้งกล้อง (D-010) ;
      แก้บั๊ก 2 ตัวที่เจอตอนทดสอบจริง — ลำดับ stale ก่อน unreadable, last_frame_at ไม่อัปเดตจาก SSE

## T-007 [P2] deploy ขึ้น Pi 5 — done
why:        แก้บนเครื่อง dev ไม่นับว่าเสร็จ
scope:      docker-compose (postgres+mosquitto), systemd unit ของ Bun server,
            Chromium kiosk autostart, เขียน `docs/DEPLOYMENT.md`
done-when:  reboot Pi แล้วจอขึ้น dashboard เองโดยไม่ต้องพิมพ์อะไร · edge (mock) จากอีกเครื่อง
            ยิงเข้ามาที่ Pi แล้วค่าขึ้นจอ
files:      deploy/*, docs/DEPLOYMENT.md
note:       Pi บูตจาก SD — เคาะแล้วว่าอยู่บน SD ไปก่อน + pg_dump cron (D-006 → T-010)
progress:   2026-08-27 เขียนไฟล์ครบและทดสอบ compose บนเครื่อง dev แล้ว (ports ถูก, migrate/seed/
            build/health ผ่านครบ) · **ยังไม่ได้รันบน Pi จริง** — done-when ข้อ reboot กับข้อ
            ยิงจากเครื่องอื่น ยังพิสูจน์ไม่ได้จนกว่าจะไปรันบนเครื่อง
            เข้า ssh จาก shell ของ AI ไม่ได้ (key ไม่ผ่าน jump host) ต้องให้บิ๊กรันเอง
done: 2026-08-27 reboot แล้วจอขึ้น dashboard เอง · **done-when ข้อ "ยิงจากเครื่องอื่น"
      ผ่านด้วยของจริง** (ทีม AI publish เข้ามาแล้วการ์ดโผล่บนจอ ดีกว่าทดสอบด้วย mock) ·
      กับดักที่เจอ 4 อย่างบันทึกใน DEPLOYMENT.md: mosquitto จาก apt จองพอร์ต ·
      container ที่ run ล้มไม่มี port mapping · chromium เลือก X11 บน Wayland · exec bit หายตอน pull

## T-009 [P1] คุมปริมาณข้อมูล (throttle + retention) — done
why:        SD 19GB มีจำกัด ต้องลบข้อมูลเก่าได้เร็วโดยตารางไม่บวม (D-007 เลื่อนมาจาก D-002)
scope:      แปลง readings เป็น partitioned by range (captured_at) รายเดือน + งานสร้าง partition
            ล่วงหน้า + DEFAULT partition กันข้อมูลหาย + policy ลบตามอายุ
done-when:  ข้ามเดือนแล้ว INSERT ยังผ่าน (ทดสอบด้วยการ insert วันที่เดือนหน้า) ·
            DROP partition เก่าแล้วพื้นที่คืนจริง
note:       ทำก่อน production ; ต้องรู้อัตรายิงจริงจากทีม AI ก่อนถึงจะตั้ง retention ได้
done: 2026-08-27 **เปลี่ยนวิธีจาก partition เป็น throttle ที่ ingest** (D-012) เพราะวัดของจริง
      ได้ 26 เฟรม/วิ = 830MB/วัน/จุด และต้นตอคือเก็บค่าที่ไม่มีความหมาย ไม่ใช่ DB เก็บไม่ไหว ·
      ผล: บีบทิ้ง 89.5% (1878→875 แถว/30วิ ที่ 26Hz) · retention 30 วันทำงานจริง ·
      smoke-throttle 7/7 · smoke-retention 4/4 · partition ยังไม่ทำ (เหตุผลเดิมใน D-007)

## T-012 [P1] หน้ารายละเอียดรายจุด (slide-over) — done
why:        หน้ารวมบอกได้แค่ "ตอนนี้เท่าไหร่" แต่คำถามจริงคือ "เมื่อกี้เป็นยังไง ปกติไหม"
            · endpoint history ที่ทำไว้ใน T-005 ยังไม่ได้ถูกใช้เลย
            · โปรเจกต์นี้ขายเป็น package ต่อโรงงาน จำนวนจุดต่างกันทุกที่ ต้องเผื่อ scale
scope:      กดการ์ด → slide-over ที่ยังเห็นจุดอื่นหรี่ ๆ ข้าง ๆ (ไม่ใช่เปลี่ยนหน้า) ·
            กราฟย้อนหลัง + เลือกช่วง · แถบ min–max · **แถบสีตรงช่วงที่อ่านไม่ออก** ·
            สัดส่วนคุณภาพ · clock drift · ที่ว่างรอ snapshot (T-011) ·
            **auto-กลับหน้ารวมเมื่อไม่มีใครแตะ** — จอผนังไม่มีใครเดินไปกดปิด
            + แก้ N+1: เดิมยิง history ทีละจุดตอนโหลด (30 จุด = 30 requests)
done-when:  กดการ์ดแล้วเห็นกราฟย้อนหลังของจุดนั้น · เปลี่ยนช่วงเวลาได้ ·
            ปล่อยไว้แล้วกลับหน้ารวมเอง · Esc ปิดได้ · โหลดหน้าแรกยิง history แค่ request เดียว
files:      src/server/api/points.ts, src/web/{apiClient,useLiveData,App}.tsx,
            src/web/components/{PointDetail,HistoryChart,PointCard}.tsx, styles.css
done: 2026-08-28 slide-over + กราฟย้อนหลัง + เลือกช่วง + สัดส่วนคุณภาพ + auto-close ·
      แก้ N+1 ด้วย GET /api/points/history (1 request แทน N) ·
      เจอบั๊ก received_at ค้างเพราะ SSE ไม่ได้ส่งมาด้วย → ทำให้ "ส่วนต่างนาฬิกา" ถ่างขึ้นเรื่อย ๆ
      ดูเหมือน edge ตั้งเวลาเพี้ยนทั้งที่ตรงกันเป๊ะ (พลาดแบบเดียวกับ last_frame_at ใน T-006)

<!-- ย้ายใบที่ done มาไว้นี่ทั้งใบ + เติมบรรทัด `done: YYYY-MM-DD <สรุป 1 บรรทัด>` -->
