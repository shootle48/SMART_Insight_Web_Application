// พิสูจน์ว่า mock ยิงตรงตามสัญญาใน src/contract/ จริง (done-when ของ T-002)
//
//   bun run verify-contract            # ฟัง 20 วินาทีแล้วสรุป
//   bun run verify-contract -- 60      # ฟัง 60 วินาที
//
// ออกด้วย exit code 1 ถ้ามีข้อความไหน parse ไม่ผ่าน หรือได้ไม่ครบ 3 เครื่อง
// เพื่อให้เอาไปแขวนใน CI ได้ตรง ๆ ทีหลัง

import mqtt from "mqtt";
import { inboundMessageSchema, meterTopics, parseTopic } from "../src/contract";

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const LISTEN_SECONDS = Number(process.argv[2] ?? 20);
const EXPECTED_DEVICES = 3;

type Tally = { frames: number; heartbeats: number; readings: number; unreadable: number; status: string };

const perDevice = new Map<string, Tally>();
const failures: { topic: string; reason: string; raw: string }[] = [];
let total = 0;
let retainedCleared = 0;

const tallyFor = (deviceId: string): Tally => {
  let t = perDevice.get(deviceId);
  if (!t) {
    t = { frames: 0, heartbeats: 0, readings: 0, unreadable: 0, status: "-" };
    perDevice.set(deviceId, t);
  }
  return t;
};

const client = mqtt.connect(BROKER_URL, { clientId: `verify-contract-${process.pid}` });

client.on("connect", () => {
  client.subscribe(meterTopics.all(), { qos: 1 }, (err) => {
    if (err) {
      console.error("subscribe ล้มเหลว:", err.message);
      process.exit(1);
    }
    console.log(`ฟัง ${meterTopics.all()} ที่ ${BROKER_URL} เป็นเวลา ${LISTEN_SECONDS} วินาที...`);
  });
});

client.on("message", (topic, payload) => {
  // payload ว่าง = คนส่งกำลังล้าง retained ไม่ใช่ข้อความจริง อย่านับเป็น error
  if (payload.length === 0) {
    retainedCleared += 1;
    return;
  }

  total += 1;
  const raw = payload.toString();

  const parsedTopic = parseTopic(topic);
  if (!parsedTopic) {
    failures.push({ topic, reason: "รูปแบบ topic ไม่ตรงผัง <prefix>/<device>/<type>", raw: raw.slice(0, 120) });
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    failures.push({ topic, reason: "ไม่ใช่ JSON", raw: raw.slice(0, 120) });
    return;
  }

  const result = inboundMessageSchema.safeParse(json);
  if (!result.success) {
    failures.push({
      topic,
      reason: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" | "),
      raw: raw.slice(0, 120),
    });
    return;
  }

  const msg = result.data;

  // สัญญาบอกว่า device_id อยู่ทั้งใน topic และ payload — ต้องตรงกัน ไม่งั้น routing กับ
  // เนื้อข้อความจะเล่าคนละเรื่อง และ ingest จะเก็บผิดเครื่องโดยไม่มีใครรู้
  if (msg.device_id !== parsedTopic.deviceId) {
    failures.push({ topic, reason: `device_id ใน payload (${msg.device_id}) ไม่ตรงกับใน topic`, raw: "" });
    return;
  }
  if (msg.message_type !== parsedTopic.messageType) {
    failures.push({ topic, reason: `message_type ใน payload (${msg.message_type}) ไม่ตรงกับใน topic`, raw: "" });
    return;
  }

  const t = tallyFor(msg.device_id);
  if (msg.message_type === "meter_frame") {
    t.frames += 1;
    t.readings += msg.readings.length;
    t.unreadable += msg.readings.filter((r) => r.quality === "UNREADABLE").length;
  } else if (msg.message_type === "device_heartbeat") {
    t.heartbeats += 1;
  } else {
    t.status = msg.status;
  }
});

client.on("error", (err) => {
  console.error("mqtt error:", err.message);
  process.exit(1);
});

setTimeout(() => {
  client.end(true);

  console.log(`\n=== สรุป (${LISTEN_SECONDS} วินาที) ===`);
  console.log(`ข้อความทั้งหมด: ${total}   parse ไม่ผ่าน: ${failures.length}   retained ที่ถูกล้าง: ${retainedCleared}`);

  const devices = [...perDevice.keys()].sort();
  for (const id of devices) {
    const t = perDevice.get(id)!;
    const pct = t.readings ? ((t.unreadable / t.readings) * 100).toFixed(1) : "0.0";
    console.log(`  ${id.padEnd(10)} status ${t.status.padEnd(7)} · frame ${String(t.frames).padStart(3)} · heartbeat ${String(t.heartbeats).padStart(3)} · reading ${String(t.readings).padStart(4)} · UNREADABLE ${t.unreadable} (${pct}%)`);
  }

  for (const f of failures.slice(0, 10)) {
    console.log(`  ✗ ${f.topic}\n      ${f.reason}\n      ${f.raw}`);
  }
  if (failures.length > 10) console.log(`  ... อีก ${failures.length - 10} รายการ`);

  const problems: string[] = [];
  if (total === 0) problems.push("ไม่ได้รับข้อความเลย — mock รันอยู่หรือเปล่า");
  if (failures.length > 0) problems.push(`${failures.length} ข้อความไม่ตรงสัญญา`);
  if (devices.length < EXPECTED_DEVICES) problems.push(`ได้ ${devices.length} เครื่อง คาดว่า ${EXPECTED_DEVICES}`);

  if (problems.length) {
    console.log(`\n❌ ไม่ผ่าน: ${problems.join(" · ")}`);
    process.exit(1);
  }
  console.log("\n✅ ผ่าน — ทุกข้อความตรงสัญญา และครบทุกเครื่อง");
  process.exit(0);
}, LISTEN_SECONDS * 1000);
