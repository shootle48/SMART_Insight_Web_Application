// รับภาพหลักฐาน (evidence) จาก MQTT แล้วเซฟลงดิสก์ — T-011
//
// ตั้งใจแยกจาก ingest/index.ts (การรับค่าตัวเลข/สถานะ) เป็นไฟล์ต่างหาก แม้จะใช้
// connection MQTT เดียวกัน เพราะคนละงานกันโดยสิ้นเชิง: อันนั้นคือ validate+เขียน DB
// อันนี้คือรับไบต์ดิบ+เขียนไฟล์ ไม่แตะ DB เลย (ไม่งั้น pg_dump จะบวมตามภาพ)
//
// ⚠️ ต้องไม่กระทบ ingest.invalid ที่ /api/health ใช้เฝ้าดูสุขภาพสัญญากับทีม AI
// เก็บสถิติของตัวเองแยกไว้ต่างหาก (evidenceStats) ไม่ปนกับของ ingest/index.ts

import { mkdir, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const EVIDENCE_DIR = process.env.EVIDENCE_DIR ?? join(homedir(), "meter-evidence");

// ยังไม่ได้ตั้ง message_size_limit ใน mosquitto.conf (ค่า default ของ broker = ไม่จำกัด)
// เช็คขนาดตรงนี้เป็นเกราะชั้นแรกกันภาพใหญ่ผิดปกติเขียน SD จนเปลืองโดยไม่ตั้งใจ
// ระหว่างรอไปตั้งค่าที่ตัว broker เอง (ของจริง = คนละชั้นกัน ไม่ใช่ตัวเดียวกัน)
const MAX_EVIDENCE_BYTES = Number(process.env.MAX_EVIDENCE_BYTES ?? 2_000_000); // ~2MB/ภาพ

let evidenceStats = { received: 0, saved: 0, rejected_too_large: 0, failed: 0 };
export const evidenceIngestStats = () => ({ ...evidenceStats, dir: EVIDENCE_DIR, max_bytes: MAX_EVIDENCE_BYTES });

/**
 * เซฟภาพลงดิสก์ — จัดกลุ่มโฟลเดอร์ตาม device/point เพื่อไม่ให้กองรวมเป็นโฟลเดอร์เดียว
 * เป็นหมื่น ๆ ไฟล์ และเผื่ออนาคตอยากดู "ภาพล่าสุดของจุดนี้" ง่าย ๆ จาก path ตรง ๆ
 *
 * ตั้งใจไม่ validate ว่าเป็น JPEG จริงไหม (เช่นเช็ค magic bytes) — เขียนไฟล์ไปตามที่
 * ได้มา ถ้าไฟล์เสียคนดูภาพจะเห็นเองว่าเปิดไม่ขึ้น ดีกว่าทิ้งเงียบ ๆ แล้วไม่มีหลักฐานเลย
 */
export async function handleEvidence(
  info: { deviceId: string; frameId: string; pointId: string; kind: string },
  payload: Uint8Array,
): Promise<void> {
  evidenceStats.received += 1;

  if (payload.byteLength > MAX_EVIDENCE_BYTES) {
    evidenceStats.rejected_too_large += 1;
    console.warn(
      `[evidence] ข้ามภาพจาก ${info.deviceId}/${info.pointId} — ใหญ่เกิน ${MAX_EVIDENCE_BYTES} bytes (ได้ ${payload.byteLength})`,
    );
    return;
  }

  try {
    const dir = join(EVIDENCE_DIR, info.deviceId, info.pointId);
    await mkdir(dir, { recursive: true });
    // ชื่อไฟล์มี frame_id พอกันชนกันเอง ไม่ต้องมี timestamp ซ้ำซ้อน (frame_id มีเวลาฝังอยู่แล้ว
    // จากฝั่ง publisher — ดู mock-edge-publisher.ts ที่ตั้งชื่อด้วย time.time_ns())
    const filePath = join(dir, `${info.frameId}.jpg`);
    await writeFile(filePath, payload);
    evidenceStats.saved += 1;
  } catch (e) {
    evidenceStats.failed += 1;
    console.error(`[evidence] เซฟภาพจาก ${info.deviceId}/${info.pointId} ไม่สำเร็จ:`, e instanceof Error ? e.message : e);
  }
}

/** เช็คว่าโฟลเดอร์เก็บภาพมีอยู่จริงและเขียนได้ — เรียกครั้งเดียวตอนเริ่มระบบ
 *  ดีกว่าไปเจอตอนภาพแรกเข้ามาแล้วค่อยรู้ว่าเขียนไม่ได้ */
export async function ensureEvidenceDir(): Promise<void> {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  // เขียนไฟล์ทดสอบเล็ก ๆ แล้วลบทิ้ง — mkdir ผ่านไม่ได้แปลว่าเขียนไฟล์ได้เสมอ (เช่น mount แบบ read-only)
  const probe = join(EVIDENCE_DIR, ".write-probe");
  await writeFile(probe, "");
  await unlink(probe);
}
