// โหลดค่าตั้งต้น แล้วอัปเดตสดผ่าน SSE
//
// จอ kiosk เปิดค้างเป็นเดือน ทุกอย่างในนี้จึงต้องทนต่อการหลุด/ต่อใหม่:
//   - EventSource ต่อใหม่เองอัตโนมัติ แต่ระหว่างที่หลุดค่าจะเก่า → ต้องโหลดใหม่ตอนกลับมา

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchDevices,
  fetchPoints,
  type DeviceRow,
  type LiveDevice,
  type LiveReading,
  type PointRow,
} from "./apiClient";

export type ConnState = "connecting" | "live" | "lost";

export function useLiveData() {
  const [points, setPoints] = useState<PointRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [error, setError] = useState<string | null>(null);

  // ใช้บังคับให้ component วาดใหม่ทุกวินาที เพื่อให้ "อายุของค่า" กับสถานะ stale
  // เดินหน้าเองแม้ไม่มีข้อมูลใหม่เข้ามา — ถ้าไม่มีตัวนี้ จอที่ข้อมูลหยุดไหลจะดูเหมือนปกติตลอดไป
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [p, d] = await Promise.all([fetchPoints(), fetchDevices()]);
      setPoints(p);
      setDevices(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const lostSince = useRef<number | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.addEventListener("hello", () => {
      setConn("live");
      // ต่อกลับมาได้หลังจากเคยหลุด = ระหว่างนั้นมีค่าที่พลาดไป ต้องโหลดใหม่ทั้งชุด
      // ไม่งั้นจอจะค้างที่ค่าเก่าจนกว่าจะมีเฟรมถัดไปของจุดนั้น ๆ เข้ามา
      if (lostSince.current !== null) {
        lostSince.current = null;
        void loadAll();
      }
    });

    es.addEventListener("readings", (ev) => {
      const list = JSON.parse((ev as MessageEvent).data) as LiveReading[];

      setPoints((prev) =>
        prev.map((p) => {
          const hit = list.find((r) => r.point_id === p.point_id);
          return hit
            ? {
                ...p,
                value_num: hit.value_num,
                value_text: hit.value_text,
                confidence: hit.confidence,
                quality: hit.quality,
                captured_at: hit.captured_at,
                // ต้องอัปเดตคู่กับ captured_at เสมอ ไม่งั้น "ส่วนต่างนาฬิกา" จะถ่างขึ้น
                // เรื่อย ๆ ตามเวลาที่เปิดหน้าไว้ แล้วดูเหมือน edge ตั้งเวลาเพี้ยน
                received_at: hit.received_at,
                frame_id: hit.frame_id,
              }
            : p;
        }),
      );

      // เฟรมที่เพิ่งมาถึงคือหลักฐานว่าเครื่องนั้นยังส่งข้อมูลอยู่ — ต้องเลื่อน last_frame_at ตาม
      // ไม่งั้นค่าจะค้างอยู่ที่ตอนโหลดหน้า แล้วแถบสถานะจะขึ้น "ไม่ส่งข้อมูล" ตลอดไป
      // ทั้งที่ข้อมูลไหลปกติ (จอ kiosk เปิดค้างเป็นเดือน จะเจออาการนี้ตลอด)
      setDevices((prev) =>
        prev.map((d) => {
          const hit = list.find((r) => r.device_id === d.device_id);
          return hit ? { ...d, last_frame_at: hit.captured_at } : d;
        }),
      );
    });

    es.addEventListener("device", (ev) => {
      const d = JSON.parse((ev as MessageEvent).data) as LiveDevice;
      setDevices((prev) => prev.map((x) => (x.device_id === d.device_id ? { ...x, ...d } : x)));
      if (d.status) {
        setPoints((prev) =>
          prev.map((p) => (p.device_id === d.device_id ? { ...p, device_status: d.status! } : p)),
        );
      }
    });

    es.onerror = () => {
      // EventSource จะพยายามต่อใหม่เอง — เราแค่บอกสถานะบนจอให้คนเห็นว่ากำลังหลุด
      setConn("lost");
      if (lostSince.current === null) lostSince.current = Date.now();
    };

    return () => es.close();
  }, [loadAll]);

  // อัปเดต state ในเครื่องทันทีหลังบันทึกค่าตั้งค่าจุดสำเร็จ — ไม่ต้องรอ SSE (ซึ่งกระจาย
  // เฉพาะ reading ใหม่ ไม่กระจาย config ที่เพิ่งแก้) หรือ reload ทั้งหน้าซึ่งช้าและกระพริบ
  const patchPoint = useCallback((pointId: string, patch: Partial<PointRow>) => {
    setPoints((prev) => prev.map((p) => (p.point_id === pointId ? { ...p, ...patch } : p)));
  }, []);

  return { points, devices, conn, error, reload: loadAll, patchPoint };
}
