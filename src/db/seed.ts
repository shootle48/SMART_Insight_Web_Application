// ใส่เครื่องและจุดวัดตั้งต้นสำหรับช่วง dev
//
//   bun run db:seed
//
// รันซ้ำได้ไม่พัง (idempotent) และ **ไม่ทับค่าที่คนแก้ไว้แล้ว** — อัปเดตเฉพาะ label/unit/kind
// ที่มาจาก dev-inventory ส่วน fixture กับ enabled ปล่อยไว้ เพราะสองอันนั้นคนเป็นคนตั้ง
// (seed ที่ล้างงานคนทิ้งทุกครั้งที่รัน จะไม่มีใครกล้ารันมัน)

import { db, sql } from "./index";
import { devices, points } from "./schema";
import { DEV_DEVICES, DEV_POINT_COUNT } from "./dev-inventory";

for (const device of DEV_DEVICES) {
  await db
    .insert(devices)
    .values({ device_id: device.device_id, label: device.label })
    .onConflictDoUpdate({
      target: devices.device_id,
      set: { label: device.label },
    });

  for (const point of device.points) {
    await db
      .insert(points)
      .values({
        point_id: point.point_id,
        device_id: device.device_id,
        camera_id: device.camera_id,
        label: point.label,
        unit: point.unit,
        kind: point.kind,
        min_value: point.min_value ?? null,
        max_value: point.max_value ?? null,
        // จุดวัดจาก seed ถือว่ายืนยันแล้ว ต่างจากจุดที่ ingest เจอเองแล้วสร้างให้
        enabled: true,
      })
      .onConflictDoUpdate({
        target: points.point_id,
        set: {
          device_id: device.device_id,
          camera_id: device.camera_id,
          label: point.label,
          unit: point.unit,
          kind: point.kind,
          min_value: point.min_value ?? null,
          max_value: point.max_value ?? null,
        },
      });
  }
}

console.log(`seed เรียบร้อย — ${DEV_DEVICES.length} เครื่อง / ${DEV_POINT_COUNT} จุดวัด`);
await sql.end();
