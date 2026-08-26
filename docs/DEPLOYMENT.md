# DEPLOYMENT — <target: เครื่องอะไร อยู่ไหน path อะไร>

<!-- เติมตอนมีเครื่องจริง. โปรเจกต์ที่ "ส่งมอบแล้ว" — แก้โค้ดบนเครื่อง dev ยังไม่นับเสร็จ
     จนกว่าจะผ่าน checklist นี้บนเครื่องจริง -->

## ข้อมูลเครื่องจริง

| อะไร | ค่า |
|---|---|
| เครื่อง/OS | <เช่น Jetson Orin Nano, Ubuntu 22> |
| path โปรเจกต์ | <เช่น ~/Desktop/<proj>> |
| python | <system python3 / venv ไหน — ระวัง: บาง lib ต้องใช้ apt ไม่ใช่ pip (เช่น opencv บน Jetson)> |
| launcher | <ทางเดียวเท่านั้น: .desktop / systemd / run.sh — ห้ามซ้อน 2 ทาง> |
| hardware ที่ต่อ | <กล้อง index/พอร์ต, serial port, GPIO pin> |

## Deploy checklist (ทำตามลำดับ ห้ามข้าม)

1. [ ] เครื่อง dev: test ผ่านครบ + `git commit` (มี hash ให้ย้อน)
2. [ ] copy ไฟล์ที่แก้ **+ ไฟล์ใหม่ทั้งหมด** (เช็ค `git status` ก่อน — ไฟล์ใหม่ลืมง่าย import fail ทั้งแอป)
3. [ ] config บนเครื่องจริง ≠ dev: <ระบุจุดต่าง เช่น RS485_MODE="real", camera index, DISPLAY=:0>
4. [ ] รัน preflight (ถ้ามี): <เช่น scripts/preflight_xxx.py — เช็ค hardware ก่อนเปิดแอป>
5. [ ] เปิดแอป + ดู log start: กล้อง/พอร์ตครบ, ค่า fps/resolution "จริง" ตรงที่ขอ
6. [ ] ทดสอบ 1 รอบงานจริง end-to-end: <trigger → ผล → บันทึก → output ครบ>
7. [ ] ปิด-เปิดแอปซ้ำ 1 รอบ (เช็ค recover state / ไม่มี lock ค้าง / instance ไม่ซ้อน)

## Rollback

- <วิธีย้อน: git checkout <hash เดิม> หรือ copy สำรองจากไหน>

## อาการที่เคยเจอบนเครื่องจริง + วิธีแก้ (เติมสะสม — มีค่ามากตอนตี 3 หน้างาน)

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| <แอปเปิดไม่ขึ้น> | <lock ค้าง / instance ซ้อน> | <pkill + ลบ lock + ใช้ launcher เดียว> |
