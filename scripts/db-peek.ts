// ส่องดูว่าใน DB มีอะไรอยู่ — อ่านอย่างเดียว ไม่แก้อะไรทั้งสิ้น
//
//   bun run db-peek            # สรุปทั้งหมด
//   bun run db-peek pt-gauge   # กรองเฉพาะ point_id ที่ขึ้นต้นด้วยคำนี้
//
// มีไว้เพราะบน Pi ไม่มี GUI และคำถามที่ถามบ่อยที่สุดคือ "ตอนนี้มีข้อมูลของใครอยู่บ้าง"
// ซึ่งถ้าต้องพิมพ์ SQL เองทุกครั้งจะช้าและพิมพ์ผิดง่าย

import { sql as raw } from "drizzle-orm";
import { db, sql } from "../src/db/index";

const filter = process.argv[2] ?? "";
const line = (s = "") => console.log(s);

// ---- เครื่อง ----
const devices = (await db.execute(raw`
  SELECT d.device_id, d.label, d.status, d.ai_service_status,
         d.storage_usage_percent, d.software_version, d.model_version,
         d.last_heartbeat_at, d.last_frame_at,
         count(p.point_id)::int AS points
  FROM devices d
  LEFT JOIN points p ON p.device_id = d.device_id
  GROUP BY d.device_id
  ORDER BY d.device_id
`)) as unknown as Record<string, unknown>[];

line("=== เครื่อง ===");
if (devices.length === 0) line("  (ยังไม่มีเครื่องเลย)");
for (const d of devices) {
  const frame = d.last_frame_at ? new Date(d.last_frame_at as string).toISOString().slice(0, 19) : "ไม่เคย";
  line(`  ${String(d.device_id).padEnd(12)} ${String(d.status).padEnd(8)} จุดวัด ${String(d.points).padStart(2)}  เฟรมล่าสุด ${frame}`);
  line(`      label=${d.label ?? "(ยังไม่ตั้ง)"}  ai=${d.ai_service_status ?? "-"}  sw=${d.software_version ?? "-"}  model=${d.model_version ?? "-"}`);
}

// ---- จุดวัด + ค่าล่าสุด ----
// ใช้ LATERAL เหมือน /api/points เพื่อให้จุดที่ยังไม่เคยมีค่าก็ยังโผล่
const points = (await db.execute(raw`
  SELECT p.point_id, p.device_id, p.kind, p.unit, p.label,
         p.min_value, p.max_value, p.enabled,
         (p.fixture IS NOT NULL) AS has_fixture,
         r.value_num, r.value_text, r.quality, r.confidence, r.captured_at,
         (SELECT count(*)::int FROM readings x WHERE x.point_id = p.point_id) AS rows
  FROM points p
  LEFT JOIN LATERAL (
    SELECT value_num, value_text, quality, confidence, captured_at
    FROM readings WHERE readings.point_id = p.point_id
    ORDER BY captured_at DESC LIMIT 1
  ) r ON true
  WHERE ${filter ? raw`p.point_id LIKE ${filter + "%"}` : raw`true`}
  ORDER BY p.device_id, p.point_id
`)) as unknown as Record<string, unknown>[];

line();
line(`=== จุดวัด ${filter ? `(กรอง "${filter}*")` : ""} ===`);
if (points.length === 0) line("  (ไม่มีจุดวัดที่ตรงเงื่อนไข)");
for (const p of points) {
  const v = p.value_num ?? p.value_text;
  const shown = p.quality === "UNREADABLE" ? "อ่านไม่ออก" : v === null || v === undefined ? "ยังไม่มีค่า" : String(v);
  const scale = p.min_value !== null && p.max_value !== null ? `${p.min_value}–${p.max_value}` : "ไม่มีสเกล";
  const when = p.captured_at ? new Date(p.captured_at as string).toISOString().slice(11, 19) : "-";
  line(
    `  ${String(p.point_id).padEnd(26)} ${String(p.kind).padEnd(14)} ${String(p.unit ?? "-").padEnd(7)}` +
      ` ${shown.padStart(12)} ${String(p.quality ?? "-").padEnd(11)} ${scale.padEnd(14)}` +
      ` แถว ${String(p.rows).padStart(6)}  ${when}`,
  );
  line(`      label=${p.label ?? "(ยังไม่ตั้ง)"}  enabled=${p.enabled}  fixture=${p.has_fixture ? "มี" : "ยังไม่มี"}`);
}

// ---- ภาพรวม readings ----
const totals = (await db.execute(raw`
  SELECT count(*)::int AS rows,
         min(captured_at) AS oldest,
         max(captured_at) AS newest,
         count(*) FILTER (WHERE quality = 'UNREADABLE')::int AS unreadable,
         count(*) FILTER (WHERE quality = 'UNCERTAIN')::int AS uncertain
  FROM readings
`)) as unknown as Record<string, unknown>[];
const t = totals[0]!;

line();
line("=== readings ===");
line(`  ทั้งหมด ${t.rows} แถว · UNREADABLE ${t.unreadable} · UNCERTAIN ${t.uncertain}`);
if (t.oldest) {
  line(`  เก่าสุด ${new Date(t.oldest as string).toISOString().slice(0, 19)}`);
  line(`  ใหม่สุด ${new Date(t.newest as string).toISOString().slice(0, 19)}`);
}

// ---- พื้นที่ที่ใช้ ----
// สำคัญบน Pi ที่บูตจาก SD และยังไม่มี retention (T-009)
const sizes = (await db.execute(raw`
  SELECT relname AS table,
         pg_size_pretty(pg_total_relation_size(c.oid)) AS total
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY pg_total_relation_size(c.oid) DESC
`)) as unknown as Record<string, unknown>[];

line();
line("=== พื้นที่ที่ใช้ (รวม index) ===");
for (const s of sizes) line(`  ${String(s.table).padEnd(14)} ${s.total}`);
line();
line("  ⚠️ ยังไม่มี retention — ตาราง readings โตไปเรื่อย ๆ บน SD (ดู T-009)");

await sql.end();
