# MQTT CHECKLIST — ทีมถามว่า "ข้อมูลส่งมาไหม" ตอบยังไง

<!-- runbook สำหรับตรวจ**ขาเข้า/ขาออก**ของทุก topic ที่มีอยู่จริง (ต้นทาง: src/contract/topics.ts)
     ต่างจาก PUBLISHING-GUIDE.md ซึ่งบอกทีม AI ว่า "ต้องส่งอะไร" — ไฟล์นี้บอกเราว่า "ถึงแล้วไหม ดูตรงไหน"
     ถ้าเพิ่ม topic ใหม่ใน topics.ts ต้องเพิ่มหัวข้อที่นี่ด้วย -->

> ใช้ 2 ชั้นเสมอ: **(1) ผ่าน broker ไหม** → `mosquitto_sub` · **(2) ถึงระบบเราไหม** → health/DB/ไฟล์
> ผ่านชั้น 1 แต่ไม่ผ่านชั้น 2 = ของเราพัง ; ไม่ผ่านชั้น 1 = ฝั่งเขายังไม่ส่ง หรือส่งผิด topic

## คำสั่งตั้งต้น

รันบน Pi (broker อยู่ใน container `meter-mqtt`) — ดูทุกอย่างที่วิ่งผ่าน broker:

```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/#' -F '%I  %t  (%l bytes)'
```

`-F '%I %t (%l bytes)'` = เวลา · topic · ขนาด — **ไม่พิมพ์ payload** เพราะภาพเป็นไบต์ดิบ
ถ้าใช้ `-v` ธรรมดาจะพ่นขยะเต็มจอเมื่อมีภาพผ่าน ; อยากดู payload ของ topic ข้อความค่อยระบุ topic ให้แคบ

จากเครื่อง dev ไม่ต้อง ssh (broker บน Pi เปิด `-p 1883:1883` ทุก interface):

```bash
mosquitto_sub -h smsn-pi-office-01.local -t 'meter/#' -F '%I  %t  (%l bytes)'
```

ตัวเลขรวมฝั่งเรา (รันบน Pi หรือแทน `localhost` ด้วย `smsn-pi-office-01.local`):

```bash
curl -s localhost:3000/api/health | python3 -c "import sys,json;h=json.load(sys.stdin)['checks'];print(h['ingest']);print('sse_clients',h['sse_clients'])"
```

| ตัวเลข | อ่านว่า |
|---|---|
| `received` ขยับ | มีข้อความเข้า topic 3 ระดับ (meter_frame/heartbeat/status) |
| `invalid` ขยับ | **มีคนส่ง แต่ผิดสัญญา** — ดู `journalctl -u meter` จะบอกว่า field ไหน |
| `received` ขยับแต่ `inserted` ไม่ขยับ | ถูก throttle ทิ้ง (ค่าไม่ขยับ) — ปกติ ไม่ใช่บั๊ก (D-012) |
| `alarm_transitions` | จำนวนครั้งที่สถานะเกณฑ์เปลี่ยน — ไม่ใช่จำนวนค่าที่เกิน |

⚠️ `meter/#` ปลอดภัยสำหรับ**คนดู** — แต่ **ingest ของเราห้าม sub `meter/#`** เด็ดขาด
(ภาพ 6 ระดับจะไหลเข้า parser 3 ระดับแล้วถูกนับเป็น invalid — กับดัก T-011)

---

## 1. `meter/<device>/meter_frame` — ค่าที่อ่านได้

edge → server · QoS 1 · **retained** (จอที่เพิ่งบูตเห็นค่าล่าสุดทันที)

**ดูสด**
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/+/meter_frame' -v
```
เห็นทันทีที่ต่อ 1 ข้อความต่อเครื่อง = **ของเก่าที่ retained** ยังไม่ใช่หลักฐานว่ากำลังส่งอยู่
รอดูว่ามีข้อความ**ใหม่**ตามมาไหม (`captured_at` ต้องเดินหน้า)

**ถึงเราไหม**
```bash
curl -s localhost:3000/api/points | python3 -c "import sys,json;[print(p['point_id'],p['value_num'],p['value_text'],p['quality'],p['captured_at']) for p in json.load(sys.stdin)['points']]"
```
`captured_at` ต้องใกล้เวลาปัจจุบัน ; ถ้าค้าง = ส่งมาแล้วแต่ไม่ลง (ดู `invalid`) หรือไม่ได้ส่ง

```bash
docker exec meter-postgres psql -U meter -d meter -c "SELECT point_id, value_num, value_text, quality, captured_at FROM readings ORDER BY captured_at DESC LIMIT 10;"
```

**อาการที่เจอบ่อย**
- `invalid` ขยับ + log บอก `kind` ไม่รู้จัก → ส่ง kind นอก `GAUGE/SEVEN_SEGMENT/WATER_METER`
- `invalid` ขยับ + log บอก `value` → `quality: OK` แต่ `value_num` กับ `value_text` เป็น null ทั้งคู่
- ค่าขึ้นแต่**กราฟไม่ขึ้น**สำหรับ 7SEG/WATER_METER → เลขส่งมาในช่อง `value_text` (แก้แล้ว T-023 —
  ถ้ายังเจอแปลว่า Pi ยังไม่ได้ deploy ของหลัง `bbc5650`)
- จุดโผล่บนจอเป็น "ยังไม่ตั้งค่า" → ปกติ ingest สร้างให้เองเมื่อเจอ `point_id` ใหม่ (D-020 adopt)

---

## 2. `meter/<device>/device_heartbeat` — เครื่องยังอยู่ + สุขภาพ

edge → server · QoS 1 · ไม่ retain

**ดูสด**
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/+/device_heartbeat' -v
```

**ถึงเราไหม**
```bash
curl -s localhost:3000/api/devices | python3 -c "import sys,json;[print(d['device_id'],d['status'],'hb',d['last_heartbeat_at'],'frame',d['last_frame_at'],'disk',d['storage_usage_percent']) for d in json.load(sys.stdin)['devices']]"
```
`last_heartbeat_at` ต้องขยับ ; `storage_usage_percent`/`software_version`/`model_version` มาจาก heartbeat

**อาการที่เจอบ่อย**
- `last_heartbeat_at` ขยับแต่ `last_frame_at` ไม่ขยับ → เครื่องต่ออยู่แต่ **AI หยุดอ่าน** (จอขึ้น
  "ไม่ส่งข้อมูล") — เป็นเรื่องฝั่งโมเดล ไม่ใช่เครือข่าย

---

## 3. `meter/<device>/device_status` — ONLINE/OFFLINE ผ่าน LWT

edge → server · **retained** · **broker เป็นคนประกาศ OFFLINE แทนเมื่อ edge หลุด** (LWT — D-005)

**ดูสด**
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/+/device_status' -v
```
ทดสอบ LWT จริง: ดึงสาย/kill -9 edge แล้วต้องเห็น `OFFLINE` โผล่เอง**โดยไม่มีใคร publish** —
ถ้าไม่โผล่ = edge ไม่ได้ตั้ง LWT (OPEN-7) จอจะแยก "ตาย" กับ "ยังไม่ถึงรอบส่ง" ไม่ออก

**ถึงเราไหม** — คอลัมน์ `status` ใน `/api/devices` (คำสั่งข้อ 2) และแถบเครื่องบนจอ

**อาการที่เจอบ่อย**
- เห็น `ONLINE` retained ค้างทั้งที่เครื่องปิดไปแล้ว → edge ไม่ได้ตั้ง LWT
- 🔴 **ระดับตัวถูก (D-024)**: โมเดล process เดียว publish แทนหลาย Zero → LWT บอกได้แค่ "โมเดลตาย"
  แยก Zero ที่ตายไม่ออก — ต้องให้โมเดล publish `OFFLINE` ต่อ Zero เอง (T-030)

---

## 4. `meter/<device>/evidence/<frame_id>/<point_id>/<kind>` — ภาพ (ไบต์ดิบ)

edge → server · **6 ระดับ** · retain=false · payload = JPEG ล้วน ไม่มี JSON

**ดูสด** (ห้ามใช้ `-v` — จะพ่นไบต์ภาพเต็มจอ)
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/+/evidence/+/+/+' -F '%I  %t  (%l bytes)'
```
ต้องเห็น 6 ระดับพอดี ; `kind` ท้ายสุดเป็น `GAUGE/SEVEN_SEGMENT/WATER_METER` หรือ `CALIBRATION`

**ถึงเราไหม** — ⚠️ health **ยังไม่มี**ตัวเลขของ evidence (`evidenceIngestStats()` ยังไม่ได้ต่อเข้า
`/api/health` — ของค้างเก่า) ต้องดูไฟล์บนดิสก์ตรง ๆ:
```bash
ls -lt ~/meter-evidence/*/*/ | head -20
```
```bash
file ~/meter-evidence/<device>/<point>/<frame_id>.jpg    # ต้องขึ้น JPEG image data
```
```bash
curl -sI localhost:3000/api/evidence/<point_id>/latest | grep -i "content-type\|x-frame-id"
```

**อาการที่เจอบ่อย**
- ผ่าน broker แต่ไม่มีไฟล์ → ขนาดเกินเพดาน (default 2MB) ดู `journalctl -u meter | grep evidence`
- ไฟล์มีแต่ `file` บอกไม่ใช่ JPEG → edge ส่ง base64 หรือห่อ JSON มา (ต้องเป็นไบต์ดิบ — D-013)
- ภาพบนจอ**ช้ากว่าค่า 1 เฟรม** → บั๊กเก่าที่แก้แล้ว (`7b465c1`) ถ้ายังเจอ = Pi ยังไม่ได้ deploy

---

## 5. `meter/<device>/command/snap-for-calibration` — เราสั่ง edge ให้ snap

**server → edge** · QoS 1 · retain=**false** (เป็น event ห้ามค้าง — ไม่งั้น edge reboot จะ snap วนลูป)

**ตรวจว่าเราส่งออกจริง** — เปิด sub ค้างไว้ก่อน แล้วกด "ขอภาพ" บนจอ (หรือ curl):
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/+/command/+' -v
```
```bash
curl -s -X POST localhost:3000/api/points/<point_id>/request-calibration-snap
```
ต้องเห็น payload `{point_id, kind, request_id}` โผล่ใน sub ทันที ; ถ้า API คืน 409 = เครื่องนั้น OFFLINE
(ตั้งใจ — ไม่สั่งเครื่องที่ตายอยู่) ; 503 = MQTT ฝั่งเรายังไม่พร้อม

**edge ตอบไหม** — ต้องมีภาพกลับมาที่ topic ข้อ 4 โดย `<kind>` = `CALIBRATION` และ `<frame_id>` =
`request_id` ที่เราส่งไป (ทีม AI ยืนยันวิธีนี้แล้ว 2026-09-07)
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/+/evidence/+/+/CALIBRATION' -F '%I  %t  (%l bytes)'
```
ไม่กลับมา = ฝั่ง edge ยังไม่ได้ implement (สถานะ T-013/T-014 ณ 2026-09-11: รอทีม AI)

---

## 6. `meter/<device>/config/<point_id>` — ค่า calibrate ที่ยืนยันแล้ว

**server → edge** · QoS 1 · **retained** (declarative — edge reboot มา sub ได้ค่าล่าสุดทันที) ·
**เฉพาะ GAUGE** (D-022) · payload ว่าง 0 ไบต์ = สั่งลบ

**ตรวจว่าค้างบน broker ตรงกับ DB ไหม**
```bash
docker exec meter-mqtt mosquitto_sub -t 'meter/+/config/+' -v -W 2
```
`-W 2` = รอ 2 วิแล้วออก — เห็นทันทีคือ retained ทั้งหมดที่ค้างอยู่ ; เทียบกับ DB:
```bash
docker exec meter-postgres psql -U meter -d meter -c "SELECT point_id, fixture FROM points WHERE fixture IS NOT NULL;"
```
ไม่ตรงกัน → `POST /api/points/<point_id>/republish-config` (DB คือความจริง broker แค่ cache — D-017)

**อาการที่เจอบ่อย**
- broker ไม่มี retained แต่ DB มี → broker เคยถูกล้าง persistence ; republish
- มี config ของจุดที่เป็น 7SEG/WATER_METER ค้างอยู่ → ของเก่าก่อน D-022 ; ลบด้วย publish ว่าง:
  `mosquitto_pub -t 'meter/<device>/config/<point_id>' -r -n`

---

## 7. ภาพดิบจาก Zero (ระดับตัวถูก, D-024) — **ยังไม่มี topic**

รอ T-030 นิยาม ; กติกาที่รู้แล้ว: ต้อง**ไม่ใช่ 3 ระดับ** (ไม่งั้นชน `meter/+/+` ของ ingest)
และไม่ใช่ `evidence/` (คนละความหมาย) — เพิ่มหัวข้อที่นี่เมื่อเคาะแล้ว

---

## ล้าง retained ที่ค้าง (ตอนเทสแล้วอยากให้จอสะอาด)

```bash
docker exec meter-mqtt mosquitto_pub -t 'meter/<device>/meter_frame' -r -n
```
```bash
docker exec meter-mqtt mosquitto_pub -t 'meter/<device>/device_status' -r -n
```
`-r -n` = publish retained ว่าง = ลบ retained ของ topic นั้น ; ทำทีละ topic ไม่มี wildcard
