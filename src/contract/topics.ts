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
  /** subscribe ครั้งเดียวครอบทุกเครื่องและทุกชนิดข้อความ */
  all: () => `${TOPIC_PREFIX}/+/+`,
} as const;

/** แกะ device_id กับ message_type ออกจาก topic ; คืน null ถ้ารูปแบบไม่ตรง */
export function parseTopic(topic: string): { deviceId: string; messageType: string } | null {
  const parts = topic.split("/");
  if (parts.length !== 3) return null;
  const [prefix, deviceId, messageType] = parts;
  if (prefix !== TOPIC_PREFIX || !deviceId || !messageType) return null;
  return { deviceId, messageType };
}
