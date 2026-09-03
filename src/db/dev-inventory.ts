// รายการเครื่องและจุดวัดสำหรับช่วง dev — แหล่งเดียวที่นิยามไว้
//
// ทั้ง `db/seed.ts` และ `scripts/mock-edge-publisher.ts` ดึงจากไฟล์นี้
// ถ้าแยกกันนิยาม สองฝั่งจะเพี้ยนจากกันแล้วเกิดอาการ "mock ยิง point_id ที่ DB ไม่มี"
// ซึ่งดูเหมือนบั๊กของ ingest ทั้งที่เป็นแค่ข้อมูลตั้งต้นไม่ตรงกัน
//
// ช่วงค่าและหน่วยทุกตัวยกมาจาก fixture จริงใน ../../../bench/samples.json ไม่ได้แต่งเอง
// เก็บเคสยากไว้ครบโดยตั้งใจ: ช่วงติดลบ · ช่วงเล็กมาก · หน้าปัดไม่มีหน่วย
//
// ไม่มีจุดตัวอย่างของ WATER_METER ในนี้ — bench/samples.json ยังไม่มีข้อมูลจริงรองรับ
// (กฎของไฟล์นี้คือห้ามแต่งค่าขึ้นเอง) เพิ่มได้เมื่อมี fixture จริงจากทีม AI
//
// ลบไฟล์นี้ทิ้งเมื่อ edge จริงมาแล้วและมีหน้าจอตั้งค่าจุดวัดเอง

import type { PointKind } from "../contract/points";

export type DevPoint = {
  point_id: string;
  label: string;
  kind: PointKind;
  unit: string | null;
  /** สำหรับ GAUGE / SEVEN_SEGMENT */
  min_value?: number;
  max_value?: number;
  /** ที่มาของช่วงค่า อ้างชื่อไฟล์ใน bench/samples.json */
  source: string;
};

export type DevDevice = {
  device_id: string;
  label: string;
  camera_id: string;
  points: DevPoint[];
};

export const DEV_DEVICES: DevDevice[] = [
  {
    device_id: "edge-01",
    label: "ตู้ควบคุมหม้อไอน้ำ",
    camera_id: "cam-panel-a",
    points: [
      { point_id: "pt-a-boiler-pressure", label: "แรงดันหม้อไอน้ำ", kind: "GAUGE", unit: "bar", min_value: 0, max_value: 4, source: "bar_gauge_f00300.png" },
      { point_id: "pt-a-header-pressure", label: "แรงดันท่อรวม", kind: "GAUGE", unit: "psi", min_value: 0, max_value: 500, source: "High-Pressure-Gauge-Meter.jpg" },
    ],
  },
  {
    device_id: "edge-02",
    label: "ตู้ปั๊มและมอเตอร์",
    camera_id: "cam-panel-b",
    points: [
      { point_id: "pt-b-vacuum", label: "สุญญากาศ", kind: "GAUGE", unit: "bar", min_value: -1, max_value: 1.5, source: "images.jpg (ช่วงติดลบ)" },
      { point_id: "pt-b-motor-rpm", label: "รอบมอเตอร์", kind: "GAUGE", unit: "RPM", min_value: 0, max_value: 10, source: "images (1).jpg" },
      { point_id: "pt-b-batch-counter", label: "ตัวนับรอบผลิต", kind: "SEVEN_SEGMENT", unit: null, min_value: 0, max_value: 9.9, source: "091619-01.jpg (ไม่มีหน่วย)" },
    ],
  },
  {
    device_id: "edge-03",
    label: "ตู้จ่ายไฟและวัดระยะ",
    camera_id: "cam-panel-c",
    points: [
      { point_id: "pt-c-manifold-bp", label: "แรงดันแมนิโฟลด์", kind: "GAUGE", unit: "mmHg", min_value: 20, max_value: 300, source: "bp_gauge_f00200.png" },
      { point_id: "pt-c-control-volt", label: "แรงดันวงจรควบคุม", kind: "GAUGE", unit: "V", min_value: -5, max_value: 15, source: "51biXXAiKIL (ช่วงติดลบ)" },
      { point_id: "pt-c-clearance", label: "ระยะห่างชิ้นงาน", kind: "GAUGE", unit: "mm", min_value: 0, max_value: 0.099, source: "images (2).jpg (ช่วงเล็กมาก + truth เกินสเกล)" },
    ],
  },
];

export const DEV_POINT_COUNT = DEV_DEVICES.reduce((n, d) => n + d.points.length, 0);
