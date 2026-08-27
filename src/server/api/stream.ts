// SSE — ส่งค่าสดขึ้นหน้าเว็บ
//
// เลือก SSE ไม่ใช่ WebSocket เพราะข้อมูลไหลทางเดียว (server → จอ) และ SSE
// ต่อใหม่เองอัตโนมัติเมื่อสายหลุด ซึ่งสำคัญกับจอ kiosk ที่ไม่มีคนคอยกด refresh

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { liveEvents, type LiveReading, type LiveDeviceState } from "../events";

export const streamApi = new Hono();

// ส่ง comment ว่าง ๆ เป็นระยะ กันตัวกลาง (reverse proxy/NAT) ตัดสายที่เงียบเกินไป
// และเป็นสัญญาณให้ฝั่ง client รู้ว่าสายยังดีอยู่แม้ไม่มีค่าใหม่
const KEEPALIVE_MS = 15_000;

// นับจอที่ต่ออยู่ — ใช้สองอย่าง: ดูจาก /api/health ว่ามีกี่จอออนไลน์
// และเป็นตัวจับว่า listener ถูกถอดจริงตอนสายหลุด (ถ้าเลขไม่ลดกลับ = รั่ว)
let clients = 0;
export const sseClientCount = () => clients;

streamApi.get("/", (c) =>
  streamSSE(c, async (stream) => {
    clients += 1;
    let id = 0;
    const send = (event: string, data: unknown) =>
      stream.writeSSE({ event, data: JSON.stringify(data), id: String(++id) });

    // คิวกันไว้เพราะ writeSSE เป็น async ถ้ายิงพร้อมกันหลายอันจะสลับลำดับกันได้
    let chain: Promise<void> = Promise.resolve();
    const queue = (event: string, data: unknown) => {
      chain = chain.then(() => send(event, data)).catch(() => {
        // เขียนไม่ได้ = ฝั่งโน้นปิดไปแล้ว ปล่อยให้ abort handler เก็บกวาด
      });
    };

    const onReadings = (readings: LiveReading[]) => queue("readings", readings);
    const onDevice = (device: LiveDeviceState) => queue("device", device);

    liveEvents.on("readings", onReadings);
    liveEvents.on("device", onDevice);

    // ⚠️ ต้องถอด listener เมื่อ client ตัดสาย ไม่งั้นทุกครั้งที่จอ kiosk reconnect
    // จะทิ้ง listener ค้างไว้ตัวหนึ่ง สะสมจนหน่วยความจำบวมและ event ถูกส่งซ้ำหลายรอบ
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return; // onAbort กับ finally อาจยิงทั้งคู่ ต้องไม่ลบเลขซ้ำ
      cleaned = true;
      clients -= 1;
      liveEvents.off("readings", onReadings);
      liveEvents.off("device", onDevice);
    };
    stream.onAbort(cleanup);

    await send("hello", { ok: true, at: new Date().toISOString() });

    try {
      while (!stream.closed && !stream.aborted) {
        await stream.sleep(KEEPALIVE_MS);
        if (stream.closed || stream.aborted) break;
        queue("ping", { at: new Date().toISOString() });
      }
    } finally {
      cleanup();
    }
  }),
);
