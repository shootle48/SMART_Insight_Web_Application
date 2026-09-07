# ข้อเสนอเรื่อง calibrate จุดวัดจากหน้า UI (สำหรับทีม AI)

> เขียน 2026-09-07 · ต่อจาก `docs/PUBLISHING-GUIDE.md` (สัญญาปัจจุบัน) และ
> `docs/SNAPSHOT-PROPOSAL.md` (D-013 · pipeline ภาพที่มีอยู่แล้ว)
>
> เคาะแล้วในหลักการ: **command ephemeral + config retained + reuse evidence pipeline**
> รอทีม AI ยืนยันว่ารับ pattern นี้ได้ก่อนเริ่มทำจริง (T-013, T-014)

## เป้าหมาย

ให้แอดมินโรงงาน **ตั้ง/แก้ค่า calibration ของจุดวัด (fixture) ได้จากหน้าเว็บ**
โดยไม่ต้อง SSH เข้า edge หรือ commit config เป็นไฟล์

ต้องรองรับ 2 เคส:
- **จุดใหม่ที่ยังไม่มี config** — edge ยังอ่านค่าไม่ได้ = ยังไม่ส่ง evidence = UI ต้อง "ขอภาพสด" เพื่อ calibrate
- **จุดที่ตั้งค่าแล้วอยากแก้** — evidence ล่าสุดมีอยู่แล้ว ใช้ได้เลย (แต่ก็ควรมีปุ่มขอภาพใหม่เผื่อสถานการณ์เปลี่ยน)

## Flow ที่เสนอ

```
                    ┌─────────────────────────────────────────┐
                    │ 1. แอดมินสร้าง point ใหม่ / เปิดจุดเดิม │
                    └────────────┬────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ 2. UI ขอภาพเพื่อ calibrate              │
                    │    publish command (non-retained, QoS 1)│
                    └────────────┬────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ 3. Edge sub รับ command → snap raw image│
                    │    publish กลับ evidence topic เดิม     │
                    └────────────┬────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ 4. UI ดึงภาพผ่าน /api/evidence/…/latest │
                    │    แสดง canvas ให้แอดมินกำหนดจุดบนภาพ   │
                    └────────────┬────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ 5. แอดมินกด Done                        │
                    │    server บันทึก DB + publish config    │
                    │    (retained, QoS 1)                    │
                    └────────────┬────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────────────┐
                    │ 6. Edge sub รับ config → apply → เริ่ม  │
                    │    infer + ส่ง reading + evidence ปกติ  │
                    └─────────────────────────────────────────┘
```

## Topic ที่ต้องเพิ่ม (ทั้งฝั่ง edge และ server)

### A. Command: ขอภาพเพื่อ calibrate (UI → Edge)

```
topic:   meter/<device_id>/command/snap-for-calibration
retain:  false          ← สำคัญมาก ห้าม retain
QoS:     1
payload: {
  "point_id":   "pt-gauge-01",
  "kind":       "GAUGE",
  "request_id": "req-1725684123456-a3f9"   // UI สร้าง กัน race
}
```

- **ไม่มี `message_type`** — topic เองระบุประเภทข้อความอยู่แล้ว (`command/snap-for-calibration`)
  ไม่เหมือน topic รวม `meter/+/+` เดิมที่ต้องพึ่ง `message_type` แยก meter_frame/device_status
  ออกจากกัน (เคาะกับทีม AI แล้ว 2026-09-07)
- **`retain: false` บังคับ** — ถ้าใครเผลอส่ง retained ตอน edge reboot จะเจอ command ค้าง
  แล้ว snap ทันทีทั้งที่ไม่มีใครขอ (potential loop)
- **`request_id`** — กัน 2 UI ยิงพร้อมกัน edge ตอบทั้งสอง request ได้ (ใส่ใน filename metadata)
- **ไม่มี "state" ที่ edge ต้องจำ** — รับ → snap → ส่ง → ลืม เหมือน HTTP request

### B. Response: ภาพดิบสำหรับ calibrate (Edge → UI)

**ใช้ topic `evidence/` เดิมที่มีอยู่แล้ว** ไม่ต้องเพิ่ม topic ใหม่:

```
topic:   meter/<device_id>/evidence/<frame_id>/<point_id>/CALIBRATION
retain:  false
QoS:     0 หรือ 1
payload: <bytes ของ JPEG>
```

- `kind` ในตำแหน่งท้ายให้ใช้ค่า `CALIBRATION` (แทน `GAUGE`/`SEVEN_SEGMENT` ปกติ)
  เพื่อให้ฝั่ง server รู้ว่านี่เป็นภาพจาก command ไม่ใช่จาก reading ปกติ
- `frame_id` แนะนำใช้ `request_id` ที่ได้จาก command เพื่อให้ trace ได้
- Server เก็บไฟล์ path เดิม (`<device>/<point>/<frame_id>.jpg`) — UI ดึงผ่าน endpoint เดิม

### C. Config: ค่า calibration ที่ apply แล้ว (Server → Edge)

```
topic:   meter/<device_id>/config/<point_id>
retain:  true           ← retained เพราะเป็น declarative "นี่คือ config ล่าสุด"
QoS:     1
payload: pointFixtureSchema (discriminated union ตาม kind)
```

ตัวอย่าง GAUGE — **แก้ตามที่ทีม AI เสนอ 2026-09-07** (ดู D-018): จากโมเดลวงกลม+px เดิม
เปลี่ยนเป็นจุดอ้างอิงหลายจุด (sample points) ตำแหน่งเป็นเศษส่วนของภาพเต็ม ไม่ใช่ pixel ตรงๆ
กัน resolution กล้องไม่เท่ากันทำ config เดิมพัง:

```json
{
  "point_id": "pt-gauge-01",
  "kind": "GAUGE",
  "calibration": [
    { "x": 0.42, "y": 0.47, "value": 0 },
    { "x": 0.51, "y": 0.32, "value": 5 },
    { "x": 0.62, "y": 0.45, "value": 10 }
  ]
}
```

- `x`, `y` = ตำแหน่งจุดอ้างอิงบนภาพ **เป็นเศษส่วน 0–1 ของขนาดภาพเต็ม** (ไม่ใช่ 0–100)
  เช่น `x: 0.42` = 42% ของความกว้างภาพ
- `value` = ค่าจริงของหน้าปัด ณ ตำแหน่งนั้น (หน่วยเดียวกับ `points.unit`)
- **อย่างน้อย 2 จุด** — พอสำหรับ fit เส้นตรง ; ทีม AI ใส่ 3+ จุดได้ถ้าต้องการความแม่นยำสูงขึ้น
  หรือรองรับหน้าปัดที่สเกลไม่เชิงเส้น (เราไม่ validate ว่าจุดที่ให้มา "สมเหตุสมผล" ทางเรขาคณิต
  — เป็นหน้าที่โมเดล AI ตอนอ่านค่า)

ตัวอย่าง SEVEN_SEGMENT — `bbox` เปลี่ยนเป็นเศษส่วนด้วยเหตุผลเดียวกัน (เจอปัญหา resolution
แบบเดียวกับ GAUGE เป๊ะ ทีม AI ยืนยันแล้วว่าเอาด้วย):

```json
{
  "point_id": "pt-7segment-01",
  "kind": "SEVEN_SEGMENT",
  "bbox": { "x": 0.15, "y": 0.20, "w": 0.30, "h": 0.12 },
  "decimals": 2
}
```

- `x`, `y`, `w`, `h` เป็นเศษส่วน 0–1 ของขนาดภาพเต็ม (มุมบนซ้าย + กว้าง/สูง) ; ต้องมี
  `x + w ≤ 1` และ `y + h ≤ 1` (กรอบไม่ล้นขอบภาพ) — ตรวจได้ทันทีตอน validate เพราะไม่ต้องรู้
  ขนาดภาพจริง (ต่างจากตอนเป็น px ที่ตรวจไม่ได้จนกว่าจะรู้ resolution จริง)

- **ไม่มี `message_type`** — เหตุผลเดียวกับ topic A (topic เจาะจงอยู่แล้ว)
- **retained = true** — edge reboot แล้ว sub ได้ config ล่าสุดทันที ไม่ต้องถามใคร
- **schema ตาม `pointFixtureSchema`** ที่มีอยู่ใน `src/contract/points.ts` — จะ export
  เป็นเอกสาร JSON schema แยกให้ฝ่าย edge อ่านง่าย
- **สั่งลบ config** = publish empty payload (0 bytes) เข้า topic เดิม (MQTT convention)
  edge sub จะรู้ว่า config ถูกยกเลิก → หยุด infer จุดนั้น

## กติกาบน edge (ที่ต้องเปลี่ยน)

1. **เพิ่ม sub `meter/<self>/command/snap-for-calibration`** — รับ command แล้ว capture
   raw image (ไม่ต้อง infer เพราะยังไม่มี config ก็ได้) publish กลับ evidence topic
2. **เพิ่ม sub `meter/<self>/config/+`** (retained) — apply config ล่าสุดเสมอ ใช้แทน
   ไฟล์ calibration ที่เก็บไว้เองในเครื่อง (ถ้ามี)
3. **ไม่ต้องเก็บ "state" หรือ "mode"** — command กับ config เป็น 2 message-driven behaviors
   ที่ไม่รู้จักกัน edge script แค่ตอบ message ที่มาถึง

## เรื่องความปลอดภัย

- **ยังไม่มี auth บน broker** (T-008 ยังไม่ทำ) — ตอนนี้ทั้ง command และ config ใครใน LAN ก็
  ยิงได้ ; **จน T-008 เสร็จ ห้ามใช้ pattern นี้ในเครือข่ายที่ไม่ trust**
- **UI ต้อง validate ก่อน publish** — payload ที่ผิด schema ห้ามส่งขึ้น broker เลย
  (Zod schema เดียวกับที่ฝ่าย server ใช้ import ตรง ๆ)

## ทำไมไม่ใช้ "Calibration mode/state" บน edge

ทีม AI เคยเสนอให้ edge มี state `Calibration` ที่ set/unset ผ่าน message — pattern นั้น
มีปัญหาแบบที่เจ็บใน production:

| ปัญหา | pattern เสนอ (message-driven) | pattern stateful (ที่หลีกเลี่ยง) |
|---|---|---|
| UI ตายกลาง flow | ไม่มีผลกับ edge | edge ค้างในโหมด calib ตลอด |
| Edge reboot | apply retained config ใหม่ทันที | ต้องจำว่าอยู่ในโหมดไหน |
| 2 คน calibrate จุดเดียวกัน | retained config = latest-wins | race, mode ค้าง |
| Debug | `mosquitto_sub -t 'meter/+/config/+'` เห็นหมด | ต้องส่อง state บน edge |

**ข้อยกเว้น**: ถ้า "state" ในความหมายของทีม AI คือแค่ `on message('state=Calibration') → snap`
แบบ pure message-driven (edge ไม่จำ mode) — pattern เป็นเรื่องเดียวกันแค่ตั้งชื่อต่างกัน
ก็ไม่มีปัญหา (คุยกันแล้ว 2026-09-07)

## Edge case ที่ต้องคิด

| เคส | จัดการอย่างไร |
|---|---|
| Edge offline ตอนกด "ขอภาพ" | UI เช็ค `device_status` ก่อน — disable ปุ่มถ้า OFFLINE |
| Online แต่ไม่ตอบภายใน 10 วิ | UI timeout → "ลองใหม่" ; ไม่มี state ที่ต้อง recover |
| ผู้ใช้ปิด browser กลาง flow | ไม่มีผลกับ edge ; config ยังไม่ถูก publish = ไม่มีอะไรเปลี่ยน |
| Config payload เสีย (ผิด schema) | Edge sub ต้อง log + ทิ้ง ห้าม crash ; UI validate ก่อน publish อยู่แล้ว |
| ลบ config แล้ว edge ยัง infer อยู่ | Edge sub รับ empty payload → หยุด infer จุดนั้น (คล้าย retain=false semantics) |
| จุดใหม่ที่ยังไม่ config แต่ edge ส่งค่ามา | ingest สร้างแถว `enabled=false` ให้อยู่แล้ว (ปัจจุบัน) — ไม่กระทบ |

## Trade-off ที่ยอมรับ

- **ต้องเพิ่ม MQTT publish บน server** (ตอนนี้ subscribe อย่างเดียว) — ไม่ยาก แต่ต้อง
  reconnect + persistent session ให้ครบ ; retained message = broker เก็บให้อัตโนมัติ
- **DB กับ retained config อาจไม่ตรงกันในทางทฤษฎี** — เช่นถ้า broker หายหรือ config
  หาย จาก retained store ; broker คือ system of record ของ edge, DB คือของ server —
  ยึด **DB เป็น source of truth** ; ถ้าไม่ตรง server publish ซ้ำจาก DB ได้เสมอ (ทำ endpoint
  `POST /api/points/:id/republish-config` เผื่อกรณีนี้)
- **ไม่ทำ multi-frame preview** — capture 1 ภาพต่อ 1 command ; ถ้าภาพเบลอ/แสงไม่ดี
  แอดมินกดขอใหม่ได้ ยอมแลกกับความเรียบง่าย
- **CALIBRATION kind จะปนกับ evidence ปกติในโฟลเดอร์เดียวกัน** — แต่ mtime ล่าสุดชนะเสมอ
  จุดที่ผ่าน calibration แล้วเริ่ม infer จะทับภาพ CALIBRATION เก่าเองอย่างธรรมชาติ

## สิ่งที่ทีมต้องตอบก่อน merge

1. **ขนาดภาพ raw capture** — ควรเท่า evidence ปกติ (ไม่เกิน 2MB ที่ตั้งไว้) หรือขอใหญ่กว่า
   เพื่อดู detail? ถ้าใหญ่ ต้องปรับ `message_size_limit` ของ mosquitto (ยังไม่ตั้ง)
2. **ถ้ายังไม่มี config, edge จะรู้ได้ไหมว่าจะ crop ที่ไหน** สำหรับ snap-for-calibration?
   น่าจะส่งภาพเต็มเฟรมกล้อง (uncropped) — UI จะ crop ให้แอดมินเห็นจุดที่จะ config
3. **แผน migration** — จุด `pt-a-*` / `pt-b-*` / `pt-c-*` ปัจจุบันที่มี fixture อยู่แล้ว
   จะ push ขึ้น retained config ทีเดียวจาก DB ตอน deploy หรือรอผู้ใช้ trigger เอง?
