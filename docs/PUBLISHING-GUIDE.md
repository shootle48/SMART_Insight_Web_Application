# คู่มือส่งข้อมูลเข้าระบบ Meter (สำหรับทีม AI)

> เขียน 2026-08-27 · สัญญาต้นฉบับอยู่ที่ `src/contract/` — ถ้าไฟล์นี้ขัดกับที่นั่น ให้เชื่อ `src/contract/`

ระบบนี้รับค่าที่ AI อ่านได้จากหน้าปัดในตู้ ผ่าน **MQTT** แล้วเก็บลง DB + แสดงบนจอ
ฝั่งคุณมีหน้าที่เดียว: **publish ตัวเลขที่อ่านได้** — ไม่ต้องส่งภาพ ไม่ต้องเรียก API อะไรทั้งสิ้น

---

## 1. ต่อที่ไหน

| | |
|---|---|
| Broker | Raspberry Pi ที่ออฟฟิศ — `smsn-pi-office-01.local` หรือ IP (เคยเป็น `192.168.8.138`) |
| Port | `1883` |
| ผู้ใช้/รหัสผ่าน | **ยังไม่มี** (ช่วง dev เปิด anonymous) — จะมีทีหลัง เดี๋ยวแจ้ง |

เช็คก่อนว่าต่อได้ไหม:

```bash
mosquitto_sub -h smsn-pi-office-01.local -t 'meter/#' -v
```

ถ้าค้างอยู่เฉย ๆ ไม่ error = ต่อได้แล้ว (ยังไม่มีข้อความก็ปกติ)
ถ้าชื่อ `.local` ใช้ไม่ได้ ให้ถามบิ๊กขอ IP ปัจจุบัน (IP เปลี่ยนได้)

---

## 2. Topic

```
meter/<device_id>/meter_frame        ← ค่าที่อ่านได้    ส่งบ่อยสุด
meter/<device_id>/device_heartbeat   ← สุขภาพเครื่อง    ทุก 15-60 วิ
meter/<device_id>/device_status      ← ออนไลน์/ออฟไลน์  ตอนต่อติด + ตั้งเป็น LWT
```

`<device_id>` คือชื่อเครื่อง edge ที่คุณตั้งเอง เช่น `edge-01` — ขอให้**คงที่ ไม่เปลี่ยนไปมา**
เพราะระบบใช้อันนี้แยกว่าข้อมูลมาจากตู้ไหน

> `device_id` ต้องอยู่ทั้งใน topic และใน payload และ**ต้องตรงกัน** ถ้าไม่ตรงข้อความจะถูกทิ้ง

---

## 3. รูปแบบข้อมูล

### 3.1 `meter_frame` — ค่าที่อ่านได้ (ตัวหลัก)

หนึ่งข้อความ = หนึ่งเฟรมจากกล้อง = **ทุกจุดที่เห็นในภาพนั้น** ใช้เวลาเดียวกัน

```json
{
  "message_type": "meter_frame",
  "device_id": "edge-01",
  "camera_id": "cam-panel-a",
  "frame_id": "frm-edge-01-1787805206152",
  "captured_at": "2026-08-27T11:33:26+07:00",
  "readings": [
    {
      "point_id": "pt-a-boiler-pressure",
      "kind": "GAUGE",
      "value_num": 2.48,
      "value_text": null,
      "unit": "bar",
      "confidence": 0.93,
      "quality": "OK"
    },
    {
      "point_id": "pt-a-run-lamp",
      "kind": "LAMP",
      "value_num": null,
      "value_text": "OFF",
      "unit": null,
      "confidence": 0.97,
      "quality": "OK"
    }
  ]
}
```

**ส่งด้วย QoS 1 + retain = true**

กติกาของแต่ละช่อง:

| ช่อง | กติกา |
|---|---|
| `frame_id` | 🔴 **ห้ามซ้ำ** ระบบใช้เป็นกุญแจกันข้อมูลซ้ำ ถ้าซ้ำเฟรมใหม่จะถูกกลืนหายเงียบ ๆ · ใช้ `f"{device_id}-{time.time_ns()}"` ก็พอ |
| `captured_at` | ISO8601 **พร้อม timezone** เช่น `2026-08-27T11:33:26+07:00` · ⚠️ ต้องตั้ง NTP บนเครื่อง edge ไม่งั้นกราฟย้อนหลังเพี้ยน |
| `point_id` | ชื่อจุดวัดที่คุณตั้งเอง — **ตั้งได้เลยไม่ต้องรอใคร** ระบบสร้างให้อัตโนมัติ แล้วขึ้นบนจอว่า "ยังไม่ตั้งค่า" · ขอให้คงที่ |
| `kind` | `GAUGE` (หน้าปัดเข็ม) · `SEVEN_SEGMENT` (จอตัวเลข) · `LAMP` (ไฟสถานะ) |
| `value_num` / `value_text` | GAUGE/SEVEN_SEGMENT ใส่ `value_num` · LAMP ใส่ `value_text` · อีกช่องเป็น `null` |
| `unit` | `"bar"`, `"psi"`, `"mmHg"`, `"V"`, `"RPM"`, `"mm"` … · ไม่มีหน่วยใส่ `null` (อย่าใส่ `"-"`) |
| `confidence` | 0.0–1.0 หรือ `null` ถ้าโมเดลไม่ได้ให้มา |
| `quality` | `OK` · `UNCERTAIN` (อ่านได้แต่ไม่มั่นใจ) · `UNREADABLE` (อ่านไม่ได้เลย) |

### 🔴 เรื่องที่สำคัญที่สุด: อ่านไม่ออกให้ส่ง `UNREADABLE`

ถ้าแสงสะท้อน โดนบัง หรือหลุดโฟกัสจนอ่านไม่ได้ **อย่าส่ง 0 อย่าเดาค่า อย่าข้ามไม่ส่ง**

```json
{
  "point_id": "pt-a-boiler-pressure",
  "kind": "GAUGE",
  "value_num": null,
  "value_text": null,
  "unit": "bar",
  "confidence": null,
  "quality": "UNREADABLE"
}
```

เหตุผล: `0` เป็นค่าที่อ่านได้จริงในเกือบทุกสเกล (เช่น สุญญากาศ -1 ถึง 1.5 bar)
ถ้าส่ง 0 แทน "อ่านไม่ออก" คนดูจอจะเห็นค่าตกฮวบและอาจสั่งหยุดเครื่องโดยไม่จำเป็น
ระบบเราแสดง `UNREADABLE` เป็นข้อความ "อ่านไม่ออก" และทำให้เส้นกราฟ**ขาดเป็นช่วง** ซึ่งถูกต้องกว่า

**ค่าที่เกินสเกลก็ส่งมาตามจริง** เข็มชี้เลยสุดสเกลเกิดขึ้นได้และเป็นสัญญาณผิดปกติที่ฝ่ายผลิตอยากเห็นที่สุด — อย่าหนีบให้อยู่ในช่วง

### 3.2 `device_heartbeat` — ทุก 15-60 วินาที

```json
{
  "message_type": "device_heartbeat",
  "device_id": "edge-01",
  "sent_at": "2026-08-27T11:33:26+07:00",
  "device_status": "ONLINE",
  "ai_service_status": "RUNNING",
  "storage_usage_percent": 42,
  "software_version": "1.0.0",
  "model_version": "gauge-yolo-v3",
  "cameras": [{ "camera_id": "cam-panel-a", "camera_status": "ONLINE" }]
}
```

`ai_service_status`: `RUNNING` | `STOPPED` · `camera_status`: `ONLINE` | `OFFLINE` | `STREAM_ERROR`
**QoS 1, retain = false**

### 3.3 `device_status` + LWT — ข้อที่คนลืมบ่อยที่สุด

```json
{ "message_type": "device_status", "device_id": "edge-01", "status": "ONLINE" }
```

ต้องทำ **สองอย่าง**:

1. ตั้งเป็น **Last Will and Testament (LWT)** ตอน connect โดยให้ payload เป็น `"status": "OFFLINE"`
2. พอต่อติดแล้ว publish ทับด้วย `"status": "ONLINE"` (retain = true)

**ทำไมต้องมี:** ไฟดับ สายหลุด หรือ process ถูก kill — เคสพวกนี้โค้ดคุณไม่มีโอกาสรันอะไรเลย
LWT คือกลไกที่ broker ประกาศแทนให้ ถ้าไม่ตั้ง ระบบเราจะแยกไม่ออกระหว่าง
"เครื่องตายไปแล้ว" กับ "ยังไม่ถึงรอบส่ง" แล้วจอจะโชว์ค่าเก่าค้างเหมือนยังปกติ

---

## 4. โค้ด Python พร้อมใช้

```bash
pip install paho-mqtt
```

```python
import json, time, socket
import paho.mqtt.client as mqtt

BROKER = "smsn-pi-office-01.local"   # หรือใส่ IP
PORT = 1883
DEVICE_ID = "edge-01"
CAMERA_ID = "cam-panel-a"

def topic(kind: str) -> str:
    return f"meter/{DEVICE_ID}/{kind}"

def status_payload(status: str) -> str:
    return json.dumps({
        "message_type": "device_status",
        "device_id": DEVICE_ID,
        "status": status,
    })

client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"{DEVICE_ID}-ai")

# LWT — broker จะส่งอันนี้แทนเราถ้าเราหลุดแบบไม่ได้บอกลา (ไฟดับ/สายหลุด/kill -9)
client.will_set(topic("device_status"), status_payload("OFFLINE"), qos=1, retain=True)

client.connect(BROKER, PORT, keepalive=30)
client.loop_start()

# ประกาศว่ามีชีวิตทันทีที่ต่อติด
client.publish(topic("device_status"), status_payload("ONLINE"), qos=1, retain=True)


def now_iso() -> str:
    # เวลาพร้อม timezone — ห้ามส่งเวลาเปล่า ๆ ที่ไม่มี offset
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def send_frame(readings: list[dict]) -> None:
    """readings = ผลอ่านของทุกจุดในภาพเดียวกัน"""
    payload = {
        "message_type": "meter_frame",
        "device_id": DEVICE_ID,
        "camera_id": CAMERA_ID,
        "frame_id": f"{DEVICE_ID}-{time.time_ns()}",   # ห้ามซ้ำ
        "captured_at": now_iso(),
        "readings": readings,
    }
    client.publish(topic("meter_frame"), json.dumps(payload), qos=1, retain=True)


def send_heartbeat() -> None:
    payload = {
        "message_type": "device_heartbeat",
        "device_id": DEVICE_ID,
        "sent_at": now_iso(),
        "device_status": "ONLINE",
        "ai_service_status": "RUNNING",
        "storage_usage_percent": 42,
        "software_version": "1.0.0",
        "model_version": "gauge-yolo-v3",
        "cameras": [{"camera_id": CAMERA_ID, "camera_status": "ONLINE"}],
    }
    client.publish(topic("device_heartbeat"), json.dumps(payload), qos=1, retain=False)


def gauge(point_id, value, unit, conf):
    """หน้าปัดเข็มที่อ่านได้"""
    return {
        "point_id": point_id, "kind": "GAUGE",
        "value_num": float(value), "value_text": None,
        "unit": unit, "confidence": conf,
        "quality": "OK" if conf is None or conf >= 0.7 else "UNCERTAIN",
    }


def unreadable(point_id, unit=None, kind="GAUGE"):
    """อ่านไม่ออก — ห้ามส่ง 0 ห้ามเดา ห้ามข้าม"""
    return {
        "point_id": point_id, "kind": kind,
        "value_num": None, "value_text": None,
        "unit": unit, "confidence": None,
        "quality": "UNREADABLE",
    }


def lamp(point_id, state, conf=1.0):
    return {
        "point_id": point_id, "kind": "LAMP",
        "value_num": None, "value_text": state,
        "unit": None, "confidence": conf, "quality": "OK",
    }


# ---- ตัวอย่างวนอ่าน ----
last_hb = 0.0
try:
    while True:
        readings = []
        # ↓↓↓ ตรงนี้เอาผลจากโมเดลของคุณมาใส่ ↓↓↓
        try:
            value, conf = 2.48, 0.93        # ผลอ่านจริงจากโมเดล
            readings.append(gauge("pt-a-boiler-pressure", value, "bar", conf))
        except Exception:
            readings.append(unreadable("pt-a-boiler-pressure", "bar"))
        readings.append(lamp("pt-a-run-lamp", "GREEN"))
        # ↑↑↑

        if readings:
            send_frame(readings)

        if time.time() - last_hb > 15:
            send_heartbeat()
            last_hb = time.time()

        time.sleep(5)
finally:
    # ปิดแบบสุภาพ — แต่ไม่ต้องพึ่งส่วนนี้ LWT ข้างบนคุ้มเคสที่ตายกะทันหันอยู่แล้ว
    client.publish(topic("device_status"), status_payload("OFFLINE"), qos=1, retain=True)
    client.loop_stop()
    client.disconnect()
```

---

## 5. ทดสอบเร็ว ๆ ไม่ต้องเขียนโค้ด

ยิงข้อความเดียวดูว่าเข้าไหม:

```bash
mosquitto_pub -h smsn-pi-office-01.local -t 'meter/edge-99/meter_frame' -q 1 -r -m '{"message_type":"meter_frame","device_id":"edge-99","camera_id":"cam-test","frame_id":"test-001","captured_at":"2026-08-27T11:33:26+07:00","readings":[{"point_id":"pt-test","kind":"GAUGE","value_num":1.23,"value_text":null,"unit":"bar","confidence":0.9,"quality":"OK"}]}'
```

แล้วเปิดหน้าเว็บดู ควรเห็นการ์ด `pt-test` โผล่ขึ้นมาพร้อมป้าย "ยังไม่ตั้งค่า"

---

## 6. เช็คว่าข้อมูลเข้าจริงไหม

```bash
curl http://smsn-pi-office-01.local:3000/api/health
```

ดูใน `checks.ingest`:

| ตัวเลข | ความหมาย |
|---|---|
| `received` | รับข้อความมากี่อัน — ถ้าไม่ขยับ = ยังไม่ถึงเราเลย ให้ดูว่า publish ถูก topic ไหม |
| `invalid` | **ถูกทิ้งเพราะผิดสัญญากี่อัน** — ถ้าเลขนี้ขยับ แปลว่าข้อมูลคุณมาถึงแต่รูปแบบไม่ผ่าน |
| `inserted` | เขียนลง DB สำเร็จกี่แถว |
| `duplicate` | ซ้ำกี่แถว (เพราะ `frame_id` ซ้ำ) — ถ้าเลขนี้พุ่ง แปลว่า `frame_id` ไม่ unique |

ถ้า `invalid` ขยับ บอกบิ๊กได้เลย — ฝั่ง server มี log บอกละเอียดว่าช่องไหนผิด เช่น

```
[ingest] ทิ้งข้อความจาก meter/edge-01/meter_frame: readings.0.quality: จุดที่อ่านได้ต้องมีค่าตรงกับ kind ของมัน
```

---

## 7. เรื่องที่ยังไม่ได้ตกลงกัน — ช่วยตอบด้วย

รายละเอียดอยู่ท้ายไฟล์ `src/contract/messages.ts` (`OPEN-1` ถึง `OPEN-7`) ที่อยากได้คำตอบที่สุด:

1. 🔴 **จะส่งภาพ crop มาด้วยไหม** — ตอนนี้สัญญาไม่มีช่องให้ใส่ภาพ มีแค่ `frame_id`
   ถ้าตั้งใจจะส่ง base64 มาต้องคุยก่อน เพราะ Pi บูตจาก SD card เหลือแค่ ~19GB
2. **จุดวัดกี่จุดต่อเครื่อง และยิงถี่แค่ไหน** — ใช้ตัดสินว่าต้องปรับโครง DB ไหม
3. **`quality` แยกจาก `confidence` ทำได้ไหม** — คือโมเดลรู้ตัวไหมว่า "อ่านไม่ออก"
   หรือให้มาแค่ตัวเลข confidence แล้วเราตั้งเกณฑ์เอง
4. **`point_id` ใครเป็นคนตั้ง** — ตอนนี้ให้คุณตั้งมาเลย ถ้าอยากให้เราเป็นคนกำหนดแล้ว push ลงไป ทิศทางจะกลับด้าน
