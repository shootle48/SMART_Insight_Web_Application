// ท่อส่งค่าสดในหน่วยความจำ ระหว่าง ingest กับ API (SSE)
//
// ใช้ EventEmitter ธรรมดาได้เพราะ ingest กับ API อยู่ process เดียวกัน (D-001)
// ถ้าวันหนึ่งต้องแยก process ค่อยเปลี่ยนไส้ในตรงนี้เป็น Postgres LISTEN/NOTIFY
// โดยที่ฝั่งเรียกใช้ไม่ต้องแก้ — นั่นคือเหตุผลที่ห่อไว้แทนที่จะ import EventEmitter ตรง ๆ

import { EventEmitter } from "node:events";
import type { PointReading } from "../contract/messages";

export type LiveReading = PointReading & {
  device_id: string;
  frame_id: string;
  captured_at: string;
  /**
   * เวลาที่ "เรา" รับข้อความนี้ — ต้องส่งไปด้วยเสมอ อย่าให้ฝั่ง client เดาเอง
   *
   * เคยพลาดมาแล้ว: ตอนแรกไม่ได้ส่ง ฝั่ง client จึงใช้ค่าจากตอนโหลดหน้าค้างไว้
   * แล้วอัปเดตเฉพาะ captured_at ทำให้ "ส่วนต่างนาฬิกา" ถ่างขึ้นเรื่อย ๆ ตามเวลาที่เปิดหน้าไว้
   * ดูเหมือน edge ตั้งเวลาเพี้ยนทั้งที่จริง ๆ ตรงกันเป๊ะ (ความผิดพลาดแบบเดียวกับ last_frame_at)
   */
  received_at: string;
};

export type LiveDeviceState = {
  device_id: string;
  status?: "ONLINE" | "OFFLINE";
  ai_service_status?: string;
  storage_usage_percent?: number;
  last_heartbeat_at?: string;
};

type Events = {
  readings: [LiveReading[]];
  device: [LiveDeviceState];
};

class TypedEmitter extends EventEmitter {
  override emit<K extends keyof Events>(event: K, ...args: Events[K]): boolean {
    return super.emit(event, ...args);
  }
  override on<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }
  override off<K extends keyof Events>(event: K, listener: (...args: Events[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}

export const liveEvents = new TypedEmitter();

// จอ kiosk หลายเครื่อง + hot reload ตอน dev ทำให้ listener เกิน 10 ตัวได้ง่าย
// ค่า default ของ Node จะเตือนว่า memory leak ทั้งที่เป็นเรื่องปกติของงานนี้
liveEvents.setMaxListeners(50);
