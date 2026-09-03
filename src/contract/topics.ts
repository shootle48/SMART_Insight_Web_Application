// ผังหัวข้อ MQTT
//
//   <prefix>/<device_id>/<message_type>
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

  // ── snapshot (T-011, เคาะทางแล้ว D-013) ─────────────────────────────────
  // ตั้งใจให้มี 4 ระดับ (ไม่ใช่ 3 เหมือนข้างบน) เพื่อไม่ให้ไปชนกับ subscription
  // `all()` (`meter/+/+`) โดยธรรมชาติ — ภาพจึงไม่มีทางไหลเข้า parseTopic()/parser
  // ของ meter_frame แล้วถูกนับเป็น invalid ทั้งที่ยังไม่ได้เขียนโค้ดรับภาพเลยด้วยซ้ำ
  //
  // ไบต์ดิบ (JPEG ตรง ๆ) ไม่ใช่ JSON/base64 — publish ด้วย retain=false เท่านั้น
  // (ต่างจาก frame/status ที่ retain=true) เพราะภาพเก่าค้างบน broker ไม่มีประโยชน์
  // ตอนจอ kiosk บูตใหม่เหมือน retained reading ; ตัวอย่างโค้ดที่ส่งให้ทีม AI แล้ว
  // อยู่ที่ docs/SNAPSHOT-PROPOSAL.md — คนละหัวข้อกันแต่ยังไม่มีใน source of truth
  // นี้มาก่อน (เพิ่งเพิ่มตอนนี้)
  snapshot: (deviceId: string, frameId: string) => `${TOPIC_PREFIX}/${deviceId}/snapshot/${frameId}`,
  /** subscribe เฉพาะภาพ — ต้องแยก subscription จาก all() เสมอ ห้ามรวมเป็น `meter/#`
   *  ไม่งั้นภาพจะไหลเข้า parseTopic() (คาด 3 ระดับ) แล้วพัง/ถูกนับเป็น invalid */
  snapshotAll: () => `${TOPIC_PREFIX}/+/snapshot/+`,
} as const;

/** แกะ device_id กับ message_type ออกจาก topic (เฉพาะ 3 ระดับ — meter_frame/heartbeat/status)
 *  คืน null ถ้ารูปแบบไม่ตรง ; topic ภาพ (4 ระดับ) ตั้งใจให้คืน null ที่นี่เสมอ
 *  ต้องแกะด้วยตัวแยกต่างหากตอนเขียนโค้ดรับภาพจริง ไม่ใช้ตัวนี้ */
export function parseTopic(topic: string): { deviceId: string; messageType: string } | null {
  const parts = topic.split("/");
  if (parts.length !== 3) return null;
  const [prefix, deviceId, messageType] = parts;
  if (prefix !== TOPIC_PREFIX || !deviceId || !messageType) return null;
  return { deviceId, messageType };
}
