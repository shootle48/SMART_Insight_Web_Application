// รัน migration ที่ drizzle-kit generate ไว้
//
//   bun run db:migrate
//
// แยกเป็นสคริปต์แทนการใช้ `drizzle-kit migrate` เพราะตัวนั้นอ่าน .env เองไม่ได้เสมอไป
// ส่วน Bun โหลด .env ให้อัตโนมัติ — ลดโอกาสที่ dev กับ prod จะอ่าน config คนละทาง

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sql } from "./index";

await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("migration เรียบร้อย");
await sql.end();
