# TICKETS — backlog (active อยู่บน / done ย้ายลง archive ท้ายไฟล์)

<!-- 1 ใบ = จบใน 1 รอบ + verify ได้เอง. AI ทำทีละใบตาม WORKFLOW.md แล้วหยุดรอ confirm.
     เจองานนอก scope ระหว่างทำ → เปิดใบใหม่ ห้ามแถมในใบเดิม.
     สถานะ: todo / doing / blocked(เพราะอะไร) / done(ย้ายลง archive) -->

# Active

## T-009 [P2] partition ตาราง readings + retention — todo
why:        SD 19GB มีจำกัด ต้องลบข้อมูลเก่าได้เร็วโดยตารางไม่บวม (D-007 เลื่อนมาจาก D-002)
scope:      แปลง readings เป็น partitioned by range (captured_at) รายเดือน + งานสร้าง partition
            ล่วงหน้า + DEFAULT partition กันข้อมูลหาย + policy ลบตามอายุ
done-when:  ข้ามเดือนแล้ว INSERT ยังผ่าน (ทดสอบด้วยการ insert วันที่เดือนหน้า) ·
            DROP partition เก่าแล้วพื้นที่คืนจริง
note:       ทำก่อน production ; ต้องรู้อัตรายิงจริงจากทีม AI ก่อนถึงจะตั้ง retention ได้

## T-010 [P2] pg_dump cron ออกนอกเครื่อง — todo
why:        D-006 ยอมให้ Postgres อยู่บน SD โดยแลกกับต้องมี backup นอกเครื่อง
            ถ้าไม่ทำ = ยอมรับความเสี่ยงเปล่า ๆ
scope:      cron/systemd timer รัน pg_dump + ส่งออกไปเครื่องอื่น + ทดสอบ restore จริง
done-when:  ลบ DB ทิ้งแล้ว restore จาก dump กลับมาได้ครบ (ไม่ใช่แค่มีไฟล์ dump)
note:       backup ที่ไม่เคยทดสอบ restore ไม่นับว่าเป็น backup

## T-004 [P1] ingest: MQTT → validate → DB — todo
why:        หัวใจของระบบ ข้อมูลต้องลงถังให้ได้ก่อนคิดเรื่องแสดงผล
scope:      subscribe `meter/+/+` (clean:false, QoS 1), Zod validate, เขียน Postgres,
            emit ค่าสดผ่าน EventEmitter ; ข้อความ parse ไม่ผ่าน → log + ทิ้ง ห้ามทำทั้ง process ตาย
done-when:  รัน mock 60 วินาที แล้ว `SELECT count(*)` ตรงกับจำนวนที่ publish จริง ·
            แถว UNREADABLE เก็บเป็น null ไม่ใช่ 0 · ยิง JSON เสียเข้าไป process ยังอยู่
files:      src/server/ingest/*
note:       เก็บ `received_at` ของฝั่งเราคู่กับ `captured_at` ของ edge เสมอ

## T-005 [P1] API + SSE — todo
why:        หน้าเว็บต้องมีทางดึงค่าล่าสุด/ประวัติ และรับค่าสด
scope:      Hono: `GET /api/points` (ค่าล่าสุดทุกจุด), `GET /api/points/:id/history?range=`,
            `GET /api/devices`, `GET /api/stream` (SSE)
done-when:  `curl -N localhost:3000/api/stream` เห็น event ไหลออกมาตอน mock ยิง ·
            history คืนข้อมูลย้อนหลังตามช่วงที่ขอจริง
files:      src/server/api/*

## T-006 [P1] Dashboard UI — todo
why:        เป้าหมายของโปรเจกต์ — ให้ฝ่ายผลิตดูค่าบนจอได้
scope:      หน้าเดียว: การ์ดต่อจุดวัด (ค่า+หน่วย+sparkline), gauge สำหรับค่าที่มี min/max,
            แถบสถานะ device 3 ตัว, ทำเครื่องหมาย stale/UNREADABLE ให้ต่างจากค่าปกติชัดเจน
done-when:  เปิดเบราว์เซอร์ค้างไว้ เห็นตัวเลขขยับเองตาม mock โดยไม่ต้อง refresh ·
            ปิด mock แล้วการ์ดขึ้นสถานะ stale ภายใน 30 วินาที
files:      src/web/*
note:       ยังไม่ทำ alarm/threshold — รอทีม AI ตอบว่ามี requirement ไหม

## T-007 [P2] deploy ขึ้น Pi 5 — todo
why:        แก้บนเครื่อง dev ไม่นับว่าเสร็จ
scope:      docker-compose (postgres+mosquitto), systemd unit ของ Bun server,
            Chromium kiosk autostart, เขียน `docs/DEPLOYMENT.md`
done-when:  reboot Pi แล้วจอขึ้น dashboard เองโดยไม่ต้องพิมพ์อะไร · edge (mock) จากอีกเครื่อง
            ยิงเข้ามาที่ Pi แล้วค่าขึ้นจอ
files:      deploy/*, docs/DEPLOYMENT.md
note:       Pi บูตจาก SD — ตัดสินใจเรื่องที่เก็บ Postgres (SD vs NVMe) ก่อนทำใบนี้

## T-008 [P3] auth + ACL — todo
why:        ตอนนี้ broker เปิด anonymous ใครอยู่ใน LAN ก็ publish ปลอมได้
scope:      ผู้ใช้/รหัสผ่านต่อ edge device + topic ACL, auth หน้าเว็บ
done-when:  edge ที่ไม่มี credential publish ไม่ได้ · เปิดหน้าเว็บโดยไม่ล็อกอินไม่เห็นข้อมูล
note:       ทำหลัง core เดินครบ (T-001..T-007) — บิ๊กสั่งโฟกัส flow ข้อมูลก่อน

---

# Archive (done — ใหม่สุดอยู่บน)

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

<!-- ย้ายใบที่ done มาไว้นี่ทั้งใบ + เติมบรรทัด `done: YYYY-MM-DD <สรุป 1 บรรทัด>` -->
