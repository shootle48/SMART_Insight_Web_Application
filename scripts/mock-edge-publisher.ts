// ยืนแทน edge device ของทีม AI จนกว่าของจริงจะมี
//
//   bun run mock-edge
//
// จำลอง 3 ตู้ ยิงตามสัญญาใน src/contract/ เพื่อให้ ingest / DB / dashboard
// สร้างและทดสอบได้ก่อนที่ edge จริงจะพร้อม ลบไฟล์นี้เมื่อของจริงยิงเข้ามาแล้ว
//
// จุดวัดทั้งหมดยกช่วงค่า/หน่วยมาจาก ../bench/samples.json ของจริง ไม่ได้แต่งเอง
// รวมเคสยาก 3 แบบที่ของจริงมี: ช่วงติดลบ, ช่วงเล็กมาก, หน้าปัดไม่มีหน่วย

import mqtt from "mqtt";
import {
  meterTopics,
  type MeterFrameMessage,
  type DeviceHeartbeatMessage,
  type PointReading,
  type DeviceStatusMessage,
} from "../src/contract";
// รายการเครื่อง/จุดวัดอยู่ที่เดียวกับที่ db/seed.ts ใช้ — ถ้าแยกกันนิยามจะเพี้ยนจากกัน
// แล้วเกิดอาการ "mock ยิง point_id ที่ DB ไม่มี" ซึ่งดูเหมือนบั๊กของ ingest
import { DEV_DEVICES, type DevDevice, type DevPoint } from "../src/db/dev-inventory";

const BROKER_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";

// 🔴 กันยิงข้อมูลปลอมเข้าเครื่องจริงโดยไม่ตั้งใจ
//
// เคยเกิดมาแล้ว: .env บนเครื่อง dev ถูกแก้ให้ MQTT_URL ชี้ไป Pi ตอนทดสอบ
// แล้วลืมแก้กลับ พอรัน mock รอบถัดไปข้อมูลปลอมก็ไหลเข้า DB จริงเงียบ ๆ
// ปนกับข้อมูลของทีม AI โดยไม่มีอะไรเตือน
//
// ยิงออกนอกเครื่องได้ แต่ต้องตั้งใจพิมพ์ --allow-remote เอง
const host = new URL(BROKER_URL).hostname;
const isLocal = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
if (!isLocal && !process.argv.includes("--allow-remote")) {
  console.error(`
🔴 ปฏิเสธการยิง: ${BROKER_URL} ไม่ใช่ broker ในเครื่องนี้`);
  console.error(`   mock สร้างข้อมูล "ปลอม" ถ้ายิงเข้าเครื่องจริงจะปนกับข้อมูลของทีม AI`);
  console.error(`   ถ้าตั้งใจจริง ใส่ --allow-remote ต่อท้าย:`);
  console.error(`     bun run scripts/mock-edge-publisher.ts --allow-remote
`);
  process.exit(1);
}
if (!isLocal) {
  console.warn(`⚠️  กำลังยิงข้อมูลปลอมเข้า ${host} — ล้างด้วย purge-dev-seed --yes เมื่อเสร็จ`);
}
const FRAME_INTERVAL_MS = Number(process.env.MOCK_FRAME_INTERVAL_MS ?? 5_000);
const HEARTBEAT_INTERVAL_MS = Number(process.env.MOCK_HEARTBEAT_INTERVAL_MS ?? 15_000);

// อัตราที่อ่านไม่ออก — ตั้งใจไม่ให้เป็นศูนย์
// demo ที่อ่านได้ครบ 100% ตลอดจะทำให้ทุกคนเข้าใจผิดว่าหน้าจอไม่ต้องรับมือกรณีอ่านไม่ออก
const UNREADABLE_RATE = 0.04;
const UNCERTAIN_RATE = 0.08;
// เข็มชี้เลยสุดสเกล — ของจริงใน samples.json มีเคสนี้ (min 0.0 / max 0.099 / truth 0.2)
const OUT_OF_RANGE_RATE = 0.02;

/** ค่าล่าสุดต่อจุด เพื่อให้เฟรมถัดไปดูเป็นแนวโน้ม ไม่ใช่สุ่มกระโดด */
const lastValue = new Map<string, number>();

function nextNumeric(spec: DevPoint): number {
  const min = spec.min_value ?? 0;
  const max = spec.max_value ?? 100;
  const centre = (min + max) / 2;
  const previous = lastValue.get(spec.point_id) ?? centre;
  // ขยับได้มากสุด ~2.5% ของช่วงต่อเฟรม ให้ดูเป็นแนวโน้มไม่ใช่สุ่มกระโดด
  const step = (Math.random() - 0.5) * 2 * ((max - min) / 40);
  // ดึงกลับเข้าหากลางสเกลเบา ๆ ไม่งั้น demo ยาว ๆ ค่าจะไหลไปกองที่ปลายสเกล
  const pullBack = (centre - previous) * 0.05;
  let next = previous + step + pullBack;

  if (Math.random() < OUT_OF_RANGE_RATE) {
    next = Math.random() < 0.5 ? max + (max - min) * 0.08 : min - (max - min) * 0.08;
  } else {
    next = Math.min(max, Math.max(min, next));
  }

  lastValue.set(spec.point_id, next);
  // ปัดตามความละเอียดของสเกล — สเกล 0..0.099 ต้องเหลือทศนิยมมากกว่าสเกล 0..500
  const decimals = Math.max(0, Math.min(4, Math.ceil(-Math.log10((max - min) / 200))));
  return Number(next.toFixed(decimals));
}

function readPoint(spec: DevPoint): PointReading {
  const roll = Math.random();

  if (roll < UNREADABLE_RATE) {
    return {
      point_id: spec.point_id,
      kind: spec.kind,
      value_num: null,
      value_text: null,
      unit: spec.unit,
      confidence: null,
      quality: "UNREADABLE",
    };
  }

  const quality = roll < UNREADABLE_RATE + UNCERTAIN_RATE ? "UNCERTAIN" : "OK";
  const confidence = Number(
    (quality === "UNCERTAIN" ? 0.4 + Math.random() * 0.25 : 0.9 + Math.random() * 0.1).toFixed(2),
  );

  return {
    point_id: spec.point_id,
    kind: spec.kind,
    value_num: nextNumeric(spec),
    value_text: null,
    unit: spec.unit,
    confidence,
    quality,
  };
}

const buildFrame = (device: DevDevice): MeterFrameMessage => ({
  message_type: "meter_frame",
  device_id: device.device_id,
  camera_id: device.camera_id,
  frame_id: `frm-${device.device_id}-${Date.now()}`,
  captured_at: new Date().toISOString(),
  readings: device.points.map(readPoint),
});

const buildHeartbeat = (device: DevDevice): DeviceHeartbeatMessage => ({
  message_type: "device_heartbeat",
  device_id: device.device_id,
  sent_at: new Date().toISOString(),
  device_status: "ONLINE",
  ai_service_status: "RUNNING",
  storage_usage_percent: Math.round(30 + Math.random() * 40),
  software_version: "0.0.0-mock",
  model_version: "mock-gauge-0.1",
  cameras: [{ camera_id: device.camera_id, camera_status: "ONLINE" }],
});

// เปิด connection แยกต่อเครื่อง — LWT ผูกกับ connection ไม่ใช่กับ topic
// ถ้ารวม 3 เครื่องไว้ใน connection เดียวจะตั้ง will ได้ใบเดียว และ edge จริงก็ต่อแยกกันอยู่แล้ว
const clients = DEV_DEVICES.map((device) => {
  const offline: DeviceStatusMessage = {
    message_type: "device_status",
    device_id: device.device_id,
    status: "OFFLINE",
  };

  const client = mqtt.connect(BROKER_URL, {
    clientId: `mock-${device.device_id}-${process.pid}`,
    reconnectPeriod: 2_000,
    // broker จะส่งข้อความนี้แทนเรา ถ้าเราหลุดแบบไม่ได้บอกลา (ไฟดับ/สายหลุด/kill -9)
    will: {
      topic: meterTopics.status(device.device_id),
      payload: Buffer.from(JSON.stringify(offline)),
      qos: 1,
      retain: true,
    },
  });

  const publish = (topic: string, payload: object, retain: boolean) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1, retain }, (err) => {
      if (err) console.error(`[${device.device_id}] publish ล้มเหลว ${topic}:`, err.message);
    });
  };

  client.on("connect", () => {
    const online: DeviceStatusMessage = {
      message_type: "device_status",
      device_id: device.device_id,
      status: "ONLINE",
    };
    // ประกาศว่ามีชีวิตทันทีที่ต่อติด แล้วค่อยตามด้วย heartbeat และเฟรมแรก
    publish(meterTopics.status(device.device_id), online, true);
    publish(meterTopics.heartbeat(device.device_id), buildHeartbeat(device), false);
    publish(meterTopics.frame(device.device_id), buildFrame(device), true);
    console.log(`[${device.device_id}] ออนไลน์ — ${device.points.length} จุดวัด`);
  });

  client.on("error", (err) => console.error(`[${device.device_id}] mqtt error:`, err.message));

  return { device, client, publish };
});

setInterval(() => {
  for (const { device, publish } of clients) {
    publish(meterTopics.frame(device.device_id), buildFrame(device), true);
  }
}, FRAME_INTERVAL_MS);

setInterval(() => {
  for (const { device, publish } of clients) {
    publish(meterTopics.heartbeat(device.device_id), buildHeartbeat(device), false);
  }
}, HEARTBEAT_INTERVAL_MS);

console.log(`[mock-edge] ${BROKER_URL} · ${DEV_DEVICES.length} เครื่อง · เฟรมทุก ${FRAME_INTERVAL_MS}ms`);

// ⚠️ ตั้งใจไม่ล้าง retained frame ตอนออก และไม่พึ่ง handler นี้เป็นกลไกหลัก
// สัญญาณบน Windows ส่งเข้ามาไม่ถึงอยู่แล้ว และต่อให้ถึง (บน Linux) ก็ยังไม่ครอบคลุม
// ไฟดับ/สายหลุด/kill -9 ซึ่งเป็นสิ่งที่เกิดจริงกับ edge ในโรงงาน
// ตัวที่รับประกันคือ LWT ข้างบน — broker ประกาศ OFFLINE ให้เองไม่ว่าเราจะตายยังไง
// ส่วนนี้เป็นแค่การบอกลาให้เร็วขึ้นเมื่อปิดแบบสุภาพได้เท่านั้น
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("[mock-edge] ปิด — ประกาศ OFFLINE");
    let pending = clients.length;
    for (const { device, client } of clients) {
      const offline: DeviceStatusMessage = {
        message_type: "device_status",
        device_id: device.device_id,
        status: "OFFLINE",
      };
      client.publish(meterTopics.status(device.device_id), JSON.stringify(offline), { qos: 1, retain: true }, () => {
        client.end(false);
        if (--pending === 0) process.exit(0);
      });
    }
    setTimeout(() => process.exit(0), 2_000);
  });
}
