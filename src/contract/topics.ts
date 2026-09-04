// ผังหัวข้อ MQTT
//
//   <prefix>/<device_id>/<message_type>                          (ค่า/สถานะ — 3 ระดับ)
//   <prefix>/<device_id>/evidence/<frame_id>/<point_id>/<kind>    (ภาพ — 6 ระดับ, T-011)
//
// prefix ปรับผ่าน env เพราะทีม AI ยังไม่เคาะชื่อ — เปลี่ยนชื่อแล้วต้องไม่ต้องแก้โค้ด
// device_id อยู่ทั้งใน topic และใน payload โดยตั้งใจ:
//   - ใน topic  → broker route/ทำ ACL รายเครื่องได้ (T-008)
//   - ใน payload → ข้อความอธิบายตัวเองได้เมื่อหลุดออกจากสายไปแล้ว (log, ไฟล์, replay)

export const TOPIC_PREFIX = process.env.MQTT_TOPIC_PREFIX ?? "meter";

export const meterTopics = {
  frame: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/meter_frame`,
  heartbeat: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/device_heartbeat`,
  /** ใช้เป็น LWT topic — broker ประกาศ OFFLINE แทน edge ที่หลุดแบบไม่บอกลา */
  status: (deviceId: string) => `${TOPIC_PREFIX}/${deviceId}/device_status`,
  /** subscribe ครั้งเดียวครอบทุกเครื่องและทุกชนิดข้อความ (3 ระดับพอดี) */
  all: () => `${TOPIC_PREFIX}/+/+`,

  // ── evidence/ภาพ (T-011) ─────────────────────────────────────────────
  // เดิมออกแบบไว้เป็น `snapshot/<frame_id>` (4 ระดับ ตาม D-013) แต่ของจริงที่ทีม AI
  // ใช้กลับเป็น `evidence/<frame_id>/<point_id>/<kind>` (6 ระดับ) — พิสูจน์แล้วด้วย
  // mosquitto_pub มือ ๆ ว่า broker/เครือข่ายรับได้ปกติ (2026-09-04) เปลี่ยนตามของจริง
  // เพราะ payload เป็นไบต์ภาพล้วน ไม่มี JSON header ให้ใส่ point_id/kind ได้ ต้องฝากไว้
  // ใน topic แทน — ไม่ได้ผิดสัญญาเดิม แค่เป็นทางที่สมเหตุสมผลกว่าที่เราเสนอไปตอนแรก
  //
  // ยังคง 2 หลักการเดิมจาก D-013: ต้องมีจำนวนระดับต่างจาก all() (3 ระดับ) เสมอ
  // เพื่อไม่ให้ไปชนกัน และ publish ด้วย retain=false (ภาพเก่าค้างบน broker ไม่มีประโยชน์
  // ตอนจอ kiosk บูตใหม่เหมือน retained reading)
  evidence: (deviceId: string, frameId: string, pointId: string, kind: string) =>
    `${TOPIC_PREFIX}/${deviceId}/evidence/${frameId}/${pointId}/${kind}`,
  /** subscribe เฉพาะภาพ — ต้องแยก subscription จาก all() เสมอ ห้ามรวมเป็น `meter/#`
   *  ไม่งั้นภาพจะไหลเข้า parseTopic() (คาด 3 ระดับ) แล้วพัง/ถูกนับเป็น invalid */
  evidenceAll: () => `${TOPIC_PREFIX}/+/evidence/+/+/+`,
} as const;

/** แกะ device_id กับ message_type ออกจาก topic (เฉพาะ 3 ระดับ — meter_frame/heartbeat/status)
 *  คืน null ถ้ารูปแบบไม่ตรง ; topic ภาพ (6 ระดับ) ตั้งใจให้คืน null ที่นี่เสมอ
 *  ใช้ parseEvidenceTopic() แยกต่างหากสำหรับภาพ */
export function parseTopic(topic: string): { deviceId: string; messageType: string } | null {
  const parts = topic.split("/");
  if (parts.length !== 3) return null;
  const [prefix, deviceId, messageType] = parts;
  if (prefix !== TOPIC_PREFIX || !deviceId || !messageType) return null;
  return { deviceId, messageType };
}

/** แกะ topic ของภาพ (6 ระดับ) ; คืน null ถ้ารูปแบบไม่ตรง */
export function parseEvidenceTopic(
  topic: string,
): { deviceId: string; frameId: string; pointId: string; kind: string } | null {
  const parts = topic.split("/");
  if (parts.length !== 6) return null;
  const [prefix, deviceId, marker, frameId, pointId, kind] = parts;
  if (prefix !== TOPIC_PREFIX || marker !== "evidence") return null;
  if (!deviceId || !frameId || !pointId || !kind) return null;
  return { deviceId, frameId, pointId, kind };
}
