// สัญญาข้อความที่ edge device ส่งเข้ามา — **ยังไม่ได้เคาะกับทีม AI**
//
// ไฟล์นี้เขียนขึ้นเพื่อให้ทีม AI มีของจริงให้ค้าน แทนที่จะรอกันไปมา
// ทุกจุดที่เราเดาเองมี `OPEN-n:` กำกับ และรวมไว้ท้ายไฟล์ — เอารายการนั้นไปคุยได้เลย

import { z } from "zod";
import { pointKindSchema } from "./points";

// อ่านค่าได้แค่ไหน — แยกจาก confidence ตั้งใจ
// เข็มโดนแสงสะท้อนจนอ่านไม่ออก กับ อ่านออกแต่มั่นใจ 0.62 เป็นคนละปัญหา
// และหน้าจอต้องแสดงต่างกัน (ว่างเปล่า vs เลขสีเหลือง)
export const readingQualitySchema = z.enum([
  "OK",
  "UNCERTAIN", // อ่านได้ แต่ต่ำกว่าเกณฑ์ที่ edge ตั้งไว้เอง
  "UNREADABLE", // อ่านไม่ได้เลย (แสงสะท้อน โดนบัง หลุดโฟกัส)
]);
export type ReadingQuality = z.infer<typeof readingQualitySchema>;

export const pointReadingSchema = z
  .object({
    point_id: z.string().min(1),
    kind: pointKindSchema,
    // ค่าอยู่ในช่องใดช่องหนึ่ง — แยกเป็นสองคอลัมน์ nullable ไม่ใช้ union
    // เพื่อให้ map ลงตาราง readings ได้ 1:1 โดยไม่ต้องแตกตาราง
    //
    // ⚠️ ตั้งใจไม่ผูกว่า kind ไหนต้องใช้ช่องไหน (เคยผูกกับ LAMP ตัวเดียวมาก่อน แต่พัง
    // ตอนเจอ WATER_METER ที่ส่งค่าเป็นข้อความเหมือนกัน) — ปล่อยให้ edge เลือกเองว่าค่าที่อ่านได้
    // ของจุดนั้นเป็นตัวเลขหรือข้อความ กฎเช็คแค่ "ต้องมีค่าใดค่าหนึ่งไม่ว่าง" ด้านล่าง
    value_num: z.number().nullable(),
    value_text: z.string().nullable(),
    unit: z.string().min(1).nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    quality: readingQualitySchema,
  })
  .refine((r) => r.quality === "UNREADABLE" || r.value_num !== null || r.value_text !== null, {
    message: "จุดที่อ่านได้ต้องมีค่าอย่างน้อยหนึ่งช่อง (value_num หรือ value_text)",
    path: ["quality"],
  });
export type PointReading = z.infer<typeof pointReadingSchema>;

// ผลอ่านหนึ่งเฟรม = ทุกจุดที่เห็นในภาพเดียวกัน ใช้ timestamp เดียวกัน
//
// ส่งแบบ RETAINED เพื่อให้จอ kiosk ที่เพิ่งบูตวาดค่าได้ทันที ไม่ต้องรอรอบถัดไป
// ⚠️ ผลข้างเคียง: retained ไม่ตายตามคนส่ง — edge ดับไปแล้วค่าเก่ายังค้างบน broker
//    ฝั่งรับต้องดูอายุ `captured_at` เอง ห้ามตีความว่ามีค่า = edge ยังมีชีวิต
export const meterFrameMessageSchema = z.object({
  message_type: z.literal("meter_frame"),
  device_id: z.string().min(1),
  camera_id: z.string().min(1),
  frame_id: z.string().min(1), // ใช้โยงกลับไปหาภาพต้นทาง ถ้ามีการเก็บ
  captured_at: z.string().min(1), // ISO8601 พร้อม offset — นาฬิกาของ edge
  readings: z.array(pointReadingSchema).min(1),
});
export type MeterFrameMessage = z.infer<typeof meterFrameMessageSchema>;

export const deviceHeartbeatMessageSchema = z.object({
  message_type: z.literal("device_heartbeat"),
  device_id: z.string().min(1),
  sent_at: z.string().min(1),
  device_status: z.enum(["ONLINE", "WARNING", "OFFLINE"]),
  ai_service_status: z.enum(["RUNNING", "STOPPED"]),
  storage_usage_percent: z.number().min(0).max(100),
  software_version: z.string().min(1),
  model_version: z.string().min(1),
  cameras: z.array(
    z.object({
      camera_id: z.string().min(1),
      camera_status: z.enum(["ONLINE", "OFFLINE", "STREAM_ERROR"]),
    }),
  ),
});
export type DeviceHeartbeatMessage = z.infer<typeof deviceHeartbeatMessageSchema>;

// สถานะออนไลน์ของเครื่อง — ส่งแบบ RETAINED บน topic แยก
//
// **ต้องตั้งเป็น LWT (Last Will and Testament) ตอนเชื่อมต่อ** ไม่ใช่ส่งเองตอนจะปิด
// เหตุผล: edge ในโรงงานตายแบบไม่ได้บอกลาเป็นเรื่องปกติ (ไฟดับ สายหลุด kill -9)
// กรณีพวกนี้ไม่มีโอกาสรันโค้ดปิดตัวเองเลย ถ้าพึ่ง handler ตอนออก ค่าจะค้างบน broker
// โดยไม่มีใครรู้ว่าเครื่องตายไปแล้ว — broker เท่านั้นที่ประกาศแทนได้
//
// ไม่มี timestamp ในข้อความนี้โดยตั้งใจ: payload ของ LWT ถูกกำหนดตั้งแต่ตอน connect
// ถ้าใส่เวลาไป มันจะเป็นเวลาที่ "ต่อติด" ไม่ใช่เวลาที่ "ตาย" ซึ่งหลอกคนอ่าน
// เวลาที่ตายจริงให้ดูจาก timestamp ที่ฝั่งเรารับข้อความนี้ (received_at)
export const deviceStatusMessageSchema = z.object({
  message_type: z.literal("device_status"),
  device_id: z.string().min(1),
  status: z.enum(["ONLINE", "OFFLINE"]),
});
export type DeviceStatusMessage = z.infer<typeof deviceStatusMessageSchema>;

export const inboundMessageSchema = z.discriminatedUnion("message_type", [
  meterFrameMessageSchema,
  deviceHeartbeatMessageSchema,
  deviceStatusMessageSchema,
]);
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

// ─── สิ่งที่เราเดาเอง — ต้องให้ทีม AI เคาะ ────────────────────────────────
//
// OPEN-1  รวมทุกจุดในเฟรมเดียว (batch) แทนที่จะแยก message ต่อจุด
//         ได้: ทุกค่าบนหน้าจอใช้เวลาเดียวกัน ไม่เหลื่อมกันเป็นวินาที / retained น้อยหัวข้อ
//         เสีย: ทำ ACL หรือ retain รายจุดแยกไม่ได้
//
// OPEN-2  `quality` แยกจาก `confidence`
//         สมมติว่า edge รู้ตัวเองว่าอ่านไม่ออก ถ้าเขาส่งมาแค่ confidence
//         UNREADABLE จะกลายเป็นเกณฑ์ที่ฝั่งเราตั้งเอง ซึ่งเรามองไม่เห็นภาพจึงตั้งได้แย่กว่า
//
// OPEN-3  `point_id` เราเป็นคนตั้งแล้ว push ลงไปเป็น config (ดู points.ts)
//         ถ้าฝั่ง AI อยากเป็นเจ้าของเอง ทิศทาง config flow กลับด้านทั้งหมด
//         และยังไม่ได้ตกลงว่าจะ push config ลงไปทางไหน (MQTT topic แยก? HTTP?)
//
// OPEN-4  🔴 ไม่ส่งภาพมาใน MQTT ส่งแค่ `frame_id`
//         ถามข้อนี้ก่อนข้ออื่น — ถ้าตั้งใจยัด base64 crop มาด้วย
//         แผน storage บน Pi 5 (บูตจาก SD เหลือ 19GB) และการ sizing broker เปลี่ยนทั้งหมด
//
// OPEN-5  `captured_at` เป็นนาฬิกาของ edge
//         ต้องตั้ง NTP ที่ edge ทั้ง 3 ตัว ไม่งั้นกราฟย้อนหลังเพี้ยน
//         ฝั่งเราจะเก็บ `received_at` ของตัวเองคู่ไว้เสมอเพื่อจับ clock drift
//
// OPEN-6  ยังไม่มี threshold/alarm ในสัญญา
//         ถ้าต้องมี ต้องรู้ว่าใครตัดสิน — edge ส่งสถานะ alarm มาเลย หรือฝั่งเราคำนวณจากค่าดิบ
//
// OPEN-7  🔴 edge ทุกตัว **ต้องตั้ง LWT** บน <prefix>/<device_id>/device_status
//         retained + QoS 1 payload {"message_type":"device_status","device_id":"...","status":"OFFLINE"}
//         และ publish status ONLINE (retained) ทันทีที่ต่อติด
//         ถ้าไม่ทำ ฝั่งเราจะแยกไม่ออกระหว่าง "เครื่องตาย" กับ "เครื่องยังอยู่แต่ยังไม่ถึงรอบส่ง"
//         ได้แต่เดาจากอายุ heartbeat ซึ่งช้ากว่าและผิดได้
