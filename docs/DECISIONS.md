# DECISIONS — ตัดสินใจอะไร เพราะอะไร (ADR-lite, ใหม่สุดอยู่บน)

<!-- จดทุกครั้งที่เคาะเรื่องที่ "มีทางเลือกแล้วเลือกทางหนึ่ง" — กันถกซ้ำ/ลืมเหตุผล
     1 เรื่อง = 5-8 บรรทัด พอ. ถ้าการตัดสินใจถูกล้ม → เพิ่มรายการใหม่อ้างของเก่า (ไม่ลบ) -->

## D-005 ใช้ MQTT LWT ประกาศเครื่องตาย ไม่พึ่งโค้ดตอนปิดตัวเอง  (2026-08-25)
เลือก:      LWT (Last Will and Testament) + topic `<prefix>/<device>/device_status` แบบ retained
แทนที่จะ:   ล้าง retained frame ใน SIGINT/SIGTERM handler ตอน process ปิด
เพราะ:      handler ตอนออกไม่ครอบคลุมสิ่งที่เกิดจริงกับ edge ในโรงงาน — ไฟดับ สายหลุด kill -9
            ล้วนไม่มีโอกาสรันโค้ด ; และพิสูจน์แล้วว่าบน Windows/Bun สัญญาณไม่ถึง JS เลย
            (exit 143 handler ไม่ทำงาน retained ค้างครบ 3) ; broker เท่านั้นที่ประกาศแทนได้
trade-off:  เพิ่มข้อกำหนดให้ทีม AI — edge ทุกตัวต้องตั้ง LWT เอง (OPEN-7 ใน contract/messages.ts)
            ถ้าเขาไม่ทำ เราจะแยก "ตาย" กับ "ยังไม่ถึงรอบส่ง" ไม่ออก ; retained frame ยังค้างอยู่
            ผู้อ่านต้องดู device_status ควบคู่เสมอ ไม่ใช่ดูแต่ค่า
ทบทวนเมื่อ: ทีม AI ยืนยันว่าตั้ง LWT ไม่ได้ → ต้องถอยไปใช้ heartbeat timeout ซึ่งช้ากว่าและพลาดง่ายกว่า
✅ ทดสอบบน Pi 5 (Linux) 2026-08-26: เส้นทาง **ปิดแบบสุภาพ (Ctrl+C) ทำงานจริง** → OFFLINE ครบ 3
   ซึ่งบน Windows ทดสอบไม่ได้เลยเพราะ signal ไปไม่ถึง JS — ยืนยันว่าโค้ด handler ถูกต้อง
   เส้นทาง **LWT (kill -9) ยืนยันบน Pi แล้ว**: เห็น ONLINE → ฆ่าดิบ → พลิกเป็น OFFLINE จริง
   (เทสรอบแรกสรุปไม่ได้เพราะ retained ค้างจากรอบก่อน ต้องคุมลำดับให้เห็น ONLINE ก่อนเสมอ)

## D-004 แยกเป็นโปรเจกต์ใหม่ ไม่ต่อยอดใน YoshiOpspectWebsite  (2026-08-25)
เลือก:      โปรเจกต์ใหม่ `OCR/Meter/`
แทนที่จะ:   เพิ่มโดเมนอ่านมิเตอร์เข้าไปใน YoshiOpspectWebsite
เพราะ:      คนละโดเมน (ท่าทางคนข้ามถนน vs อ่านหน้าปัดในตู้) · คนละเครื่องเป้าหมาย ·
            repo นั้นเป็นของพี่ Sun การเอาโดเมนอื่นไปปนกระทบเจ้าของ
trade-off:  เสีย reuse ที่เคยประเมินไว้ — ROI editor, camera CRUD, WebRTC preview, shadcn kit
            ต้องเขียนใหม่ถ้าโปรเจกต์นี้ต้องตั้งกรอบบนภาพกล้องเอง
ทบทวนเมื่อ: ต้องมีหน้าตั้ง ROI บนภาพสดจริง — ตอนนั้นค่อยชั่งว่า port มาหรือ extract เป็น package

## D-003 Bun เป็น runtime บน Pi  (2026-08-25)
เลือก:      Bun (dev บน Windows + prod บน Pi 5 arm64)
แทนที่จะ:   Node 22 LTS
เพราะ:      รัน TypeScript ตรงไม่ต้อง build ฝั่ง server ทำให้แก้หน้างานเร็ว · ตรงกับที่ใช้ใน Yoshi
trade-off:  Bun บน arm64 ยังเจอเคสแปลกได้มากกว่า Node ที่นิ่งกว่า
ทบทวนเมื่อ: เจอ crash/ปัญหา native module บน Pi — Hono รันได้ทั้ง Bun และ Node สลับได้ถูก

## D-002 Postgres 17 ล้วน ยังไม่เอา TimescaleDB  (2026-08-25)
เลือก:      Postgres 17 ใน Docker + partition รายเดือน + BRIN index บนคอลัมน์เวลา
แทนที่จะ:   TimescaleDB ตั้งแต่ต้น / InfluxDB
เพราะ:      3 device × จุดวัดหลักสิบ × ทุกไม่กี่วินาที ยังไม่ถึงล้านแถว/วัน — Postgres ล้วนรับไหวบน Pi 5 ·
            `create_hypertable()` แปลงตารางที่มีข้อมูลแล้วได้ → เติมทีหลังไม่แพง ·
            InfluxDB จะกลายเป็น DB ตัวที่สองเพราะยังต้องมี Postgres เก็บ config อยู่ดี
trade-off:  ถ้าอัตรายิงสูงกว่าประเมินมาก ต้องทำ rollup รายนาที/ชั่วโมงเองด้วย materialized view + cron
ทบทวนเมื่อ: อัตรายิงจริงจากทีม AI ชัด หรือตาราง readings โตเกิน ~50M แถว
⚠️ ยังไม่รู้อัตราจริง — ตัวเลขข้างบนเป็นการประเมิน ไม่ใช่ข้อมูลจากทีม AI

## D-001 Vite + React + Hono ไม่เอา Next.js  (2026-08-25)
เลือก:      Bun + Hono (API + SSE + เสิร์ฟ static) + Vite/React แยก build
แทนที่จะ:   Next.js 16 เหมือน YoshiOpspectWebsite / FastAPI + Jinja
เพราะ:      **MQTT subscriber อยู่ใน process เดียวกับ API ได้** — Next ทำไม่ได้ (route handler
            ค้างฟัง subscription ไม่ได้) ต้องแยก worker + คุยผ่าน DB/NOTIFY = ชิ้นส่วนเพิ่มบนเครื่องหน้างาน ·
            เหลือ systemd unit เดียว · build บน Pi ~10 วินาทีแทน 2-5 นาที · node_modules ~150MB แทน ~600MB
            (สำคัญเพราะบูตจาก SD เหลือ 19GB) · โปรเจกต์มีแค่ 3-4 หน้า ไม่ต้องใช้ SSR/RSC
trade-off:  ต้องประกอบ routing/data-fetching เอง (React Router + TanStack Query) ไม่มีของแถมแบบ Next ·
            เหตุผลเดิมที่เคยเชียร์ Next คือ reuse ของพี่ Sun ซึ่งตกไปพร้อม D-004
ทบทวนเมื่อ: หน้าเว็บโตเกิน ~10 หน้า หรือต้องการ SSR เพื่อ SEO/first paint จริงจัง
✅ ยืนยันบนเครื่องจริง 2026-08-26: `bun run build` บน Pi 5 arm64 = **178ms**
   (เครื่อง dev Windows 186ms) — สมมติฐานเรื่องความเร็ว build ถูกต้อง และ Bun บน arm64 ไม่มีปัญหา (D-003)
