# TICKETS — backlog (active อยู่บน / done ย้ายลง archive ท้ายไฟล์)

<!-- 1 ใบ = จบใน 1 รอบ + verify ได้เอง. AI ทำทีละใบตาม WORKFLOW.md แล้วหยุดรอ confirm.
     เจองานนอก scope ระหว่างทำ → เปิดใบใหม่ ห้ามแถมในใบเดิม.
     สถานะ: todo / doing / blocked(เพราะอะไร) / done(ย้ายลง archive) -->

# Active

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

<!-- ย้ายใบที่ done มาไว้นี่ทั้งใบ + เติมบรรทัด `done: YYYY-MM-DD <สรุป 1 บรรทัด>` -->
