// โครงตารางทั้งหมด — Drizzle เป็นเจ้าของ schema ที่นี่ที่เดียว
//
// ตารางแบ่งเป็นสองกลุ่มที่มีอายุต่างกันมาก:
//   config (devices, points) — เปลี่ยนนาน ๆ ครั้ง คนเป็นคนแก้
//   telemetry (readings)     — เขียนตลอดเวลา ไม่มีใครแก้ด้วยมือ
// แยกกันเพื่อให้ retention/backup ทำกับ readings อย่างเดียวได้โดยไม่แตะ config

import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  doublePrecision,
  real,
  bigserial,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { PointFixture } from "../contract/points";

// id เป็น text ไม่ใช่ uuid ทุกที่ เพราะ edge ส่ง "edge-01" / "pt-a-boiler-pressure" มาตรง ๆ
// การแปลงไปมาเป็น uuid จะทำให้ debug จาก log ของ MQTT ยากขึ้นโดยไม่ได้อะไรกลับมา

export const devices = pgTable("devices", {
  device_id: text("device_id").primaryKey(),
  label: text("label"),

  // มาจาก topic device_status (LWT) — ไม่ใช่จาก heartbeat
  // แยกกันเพราะ LWT บอก "ตายแล้ว" ได้ทันทีที่สายหลุด ส่วน heartbeat บอกได้แค่ "เงียบไป"
  status: text("status").notNull().default("OFFLINE"),
  status_changed_at: timestamp("status_changed_at", { withTimezone: true }),

  // มาจาก heartbeat
  ai_service_status: text("ai_service_status"),
  storage_usage_percent: integer("storage_usage_percent"),
  software_version: text("software_version"),
  model_version: text("model_version"),
  last_heartbeat_at: timestamp("last_heartbeat_at", { withTimezone: true }),

  // เวลาที่รับเฟรมล่าสุด ใช้จับเคส "เครื่องยังต่ออยู่แต่ AI หยุดอ่าน"
  // ซึ่ง status=ONLINE จับไม่ได้
  last_frame_at: timestamp("last_frame_at", { withTimezone: true }),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const points = pgTable(
  "points",
  {
    point_id: text("point_id").primaryKey(),
    device_id: text("device_id")
      .notNull()
      .references(() => devices.device_id, { onDelete: "cascade" }),
    camera_id: text("camera_id").notNull(),

    label: text("label"),
    unit: text("unit"),
    kind: text("kind").notNull(),

    // ค่าสอบเทียบหน้าปัด (cx/cy/r/min_angle/... ตาม contract/points.ts)
    //
    // nullable โดยตั้งใจ: ingest จะสร้างแถวให้อัตโนมัติเมื่อเจอ point_id ที่ไม่รู้จัก
    // แล้วปล่อย fixture ว่างไว้ให้คนมาเติมทีหลัง — ดีกว่าทิ้งค่าที่อ่านมาได้แล้ว
    // เพราะ config ยังไม่ตรงกัน ("ตรวจไม่ได้" ไม่ควรแปลว่า "โยนข้อมูลทิ้ง")
    fixture: jsonb("fixture").$type<PointFixture>(),

    // false = ยังไม่ถูกยืนยันโดยคน (เช่นตัวที่ ingest สร้างเอง) — ไม่ต้องขึ้นจอหลัก
    enabled: boolean("enabled").notNull().default(false),

    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("points_device_idx").on(t.device_id)],
);

export const readings = pgTable(
  "readings",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),

    point_id: text("point_id")
      .notNull()
      .references(() => points.point_id, { onDelete: "cascade" }),
    device_id: text("device_id").notNull(),
    frame_id: text("frame_id").notNull(),

    // captured_at = นาฬิกาของ edge / received_at = นาฬิกาของเรา
    // เก็บทั้งคู่เสมอ เพื่อให้จับ clock drift ได้ ถ้า edge ลืมตั้ง NTP (OPEN-5 ในสัญญา)
    // ถ้าเก็บอันเดียวแล้วเวลาเพี้ยน จะไม่มีทางรู้เลยว่าเพี้ยนที่ใคร
    captured_at: timestamp("captured_at", { withTimezone: true }).notNull(),
    received_at: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),

    // ค่าอยู่ช่องใดช่องหนึ่งตาม kind ; ทั้งคู่เป็น null ได้เมื่อ quality = UNREADABLE
    // ⚠️ ห้ามแปลง UNREADABLE เป็น 0 เด็ดขาด — 0 เป็นค่าที่อ่านได้จริงในสเกลส่วนใหญ่
    // (เช่น vacuum -1..1.5, volt -5..15) การแทนด้วย 0 คือการกุข้อมูล
    value_num: doublePrecision("value_num"),
    value_text: text("value_text"),

    unit: text("unit"),
    confidence: real("confidence"),
    quality: text("quality").notNull(),
  },
  (t) => [
    // ใช้ตอบ "ค่าล่าสุดของจุดนี้" และ "ย้อนหลังช่วงเวลา" ซึ่งเป็น query หลักของ dashboard
    index("readings_point_time_idx").on(t.point_id, t.captured_at.desc()),

    // ทำให้การเขียนซ้ำไม่เพิ่มแถว — จำเป็นเพราะสองเหตุผลที่เลี่ยงไม่ได้:
    //   1. MQTT QoS 1 คือ at-least-once ตามสเปก broker ส่งซ้ำได้
    //   2. เฟรมล่าสุด publish แบบ retained → ทุกครั้งที่ ingest subscribe ใหม่จะได้ของเก่ากลับมา
    // ถ้าไม่มีข้อนี้ จำนวนแถวจะเกินจริงแบบเงียบ ๆ และกราฟจะมีจุดซ้อนกันที่เวลาเดียวกัน
    uniqueIndex("readings_point_frame_uq").on(t.point_id, t.frame_id),

    // BRIN แทน btree บน captured_at ล้วน: ข้อมูลเข้ามาเรียงตามเวลาอยู่แล้ว
    // BRIN จึงเล็กกว่า btree หลายสิบเท่า ซึ่งสำคัญเมื่ออยู่บน SD card ที่มีจำกัด (D-006)
    index("readings_captured_brin").using("brin", t.captured_at),
  ],
);

export type Device = typeof devices.$inferSelect;
export type Point = typeof points.$inferSelect;
export type Reading = typeof readings.$inferSelect;
export type NewReading = typeof readings.$inferInsert;
