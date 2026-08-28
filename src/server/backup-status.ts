// รายงานว่า backup ล่าสุดเกิดขึ้นเมื่อไหร่ — เอาไปโชว์ใน /api/health
//
// ทำไมต้องมี: backup ที่หยุดทำงานเงียบ ๆ คือกับดักคลาสสิก
// timer อาจตาย ดิสก์เต็ม หรือ container เปลี่ยนชื่อ แล้วไม่มีใครรู้จนถึงวันที่ต้องใช้จริง
// ซึ่งเป็นวันที่สายเกินไปแล้ว — ต้องมองเห็นได้จากที่เดียวกับที่ดูสุขภาพระบบอยู่แล้ว
//
// ไฟล์นี้อ่านอย่างเดียว ไม่ได้เป็นคนสร้าง backup (ตัวนั้นคือ deploy/backup.sh + systemd timer)

import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const BACKUP_DIR = process.env.BACKUP_DIR ?? join(homedir(), "meter-backups");

/** เกินเท่านี้ถือว่าผิดปกติ — timer ตั้งไว้วันละครั้ง เผื่อ RandomizedDelay + เครื่องดับข้ามคืน */
const STALE_AFTER_HOURS = Number(process.env.BACKUP_STALE_HOURS ?? 36);

export async function backupStatus() {
  try {
    const files = (await readdir(BACKUP_DIR)).filter(
      (f) => f.startsWith("meter-") && f.endsWith(".dump"),
    );

    if (files.length === 0) {
      return { ok: false, reason: "ยังไม่มีไฟล์ backup เลย", dir: BACKUP_DIR, count: 0 };
    }

    let newest = { name: "", mtime: 0, size: 0 };
    for (const f of files) {
      const s = await stat(join(BACKUP_DIR, f));
      if (s.mtimeMs > newest.mtime) newest = { name: f, mtime: s.mtimeMs, size: s.size };
    }

    const ageHours = (Date.now() - newest.mtime) / 3_600_000;
    const fresh = ageHours <= STALE_AFTER_HOURS;

    return {
      ok: fresh,
      ...(fresh ? {} : { reason: `backup ล่าสุดเก่ากว่า ${STALE_AFTER_HOURS} ชม. — timer อาจหยุดทำงาน` }),
      latest: newest.name,
      at: new Date(newest.mtime).toISOString(),
      age_hours: Math.round(ageHours * 10) / 10,
      bytes: newest.size,
      count: files.length,
      dir: BACKUP_DIR,
      // ⚠️ ไฟล์อยู่บนเครื่องเดียวกับ DB หรือเปล่า — ตัวชี้ขาดว่า backup นี้กัน "การ์ดพัง" ได้ไหม
      offsite: Boolean(process.env.BACKUP_REMOTE),
      // เขียนคำเตือนออกมาตรง ๆ ไม่ให้ต้องรู้ความหมายของ offsite ก่อนถึงจะเข้าใจ
      // `ok:true` คู่กับ `offsite:false` อ่านผ่าน ๆ แล้วนึกว่าเรียบร้อยดี ทั้งที่ยังกันโหมดพังหลักไม่ได้
      ...(process.env.BACKUP_REMOTE
        ? {}
        : { warning: "backup อยู่บน SD ใบเดียวกับ DB — กันได้แค่ลบผิด ไม่ได้กันการ์ดพัง (T-010)" }),
    };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e), dir: BACKUP_DIR };
  }
}
