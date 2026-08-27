// Connection ที่ทุกฝั่ง server ใช้ร่วมกัน
//
// cache ไว้บน globalThis เพราะตอน dev `bun --hot` โหลดโมดูลใหม่ทุกครั้งที่แก้ไฟล์
// ถ้าไม่ cache จะเปิด pool ใหม่ซ้อนไปเรื่อยจน Postgres ปฏิเสธการเชื่อมต่อ

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // พังตั้งแต่ตอนเปิดแอปดีกว่าไปพังตอน query แรกกลางดึก
  throw new Error("ไม่ได้ตั้ง DATABASE_URL — ดู .env.example");
}

const g = globalThis as unknown as { __meterSql?: ReturnType<typeof postgres> };

const sql = g.__meterSql ?? (g.__meterSql = postgres(connectionString, { max: 4 }));

export const db = drizzle(sql, { schema });
export { sql, schema };
