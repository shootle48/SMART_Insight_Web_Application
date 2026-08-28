// ชนิดข้อมูลและตัวเรียก API ฝั่งเบราว์เซอร์
//
// นิยามชนิดซ้ำจากฝั่ง server โดยตั้งใจ — เบราว์เซอร์ไม่ควร import โค้ดที่ลาก Drizzle/pg
// เข้ามาใน bundle ; ตัวที่กันไม่ให้เพี้ยนคือ smoke test ที่ยิง API จริง ไม่ใช่ type ร่วมกัน

export type Quality = "OK" | "UNCERTAIN" | "UNREADABLE";

export type PointRow = {
  point_id: string;
  device_id: string;
  camera_id: string;
  label: string | null;
  unit: string | null;
  kind: "GAUGE" | "SEVEN_SEGMENT" | "LAMP";
  enabled: boolean;
  min_value: number | null;
  max_value: number | null;
  device_status: "ONLINE" | "OFFLINE";

  // เป็น null ได้เมื่อจุดนี้ยังไม่เคยมีค่าเลย (เพิ่งถูกสร้าง หรือกล้องเสียตั้งแต่แรก)
  value_num: number | null;
  value_text: string | null;
  confidence: number | null;
  quality: Quality | null;
  captured_at: string | null;
  received_at: string | null;
  frame_id: string | null;
};

export type DeviceRow = {
  device_id: string;
  label: string | null;
  status: "ONLINE" | "OFFLINE";
  status_changed_at: string | null;
  ai_service_status: string | null;
  storage_usage_percent: number | null;
  software_version: string | null;
  model_version: string | null;
  last_heartbeat_at: string | null;
  last_frame_at: string | null;
  point_count: number;
  enabled_point_count: number;
};

export type HistoryBucket = {
  bucket: string;
  samples: number;
  unreadable: number;
  uncertain: number;
  avg_value: number | null;
  min_value: number | null;
  max_value: number | null;
  last_text: string | null;
};

/** ค่าที่มาทาง SSE — รูปร่างเดียวกับ LiveReading ฝั่ง server */
export type LiveReading = {
  point_id: string;
  kind: PointRow["kind"];
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  confidence: number | null;
  quality: Quality;
  device_id: string;
  frame_id: string;
  captured_at: string;
};

export type LiveDevice = {
  device_id: string;
  status?: "ONLINE" | "OFFLINE";
  ai_service_status?: string;
  storage_usage_percent?: number;
  last_heartbeat_at?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const fetchPoints = () => getJson<{ points: PointRow[] }>("/api/points").then((r) => r.points);
export const fetchDevices = () => getJson<{ devices: DeviceRow[] }>("/api/devices").then((r) => r.devices);
export const fetchHistory = (pointId: string, range = "15m") =>
  getJson<{ buckets: HistoryBucket[] }>(
    `/api/points/${encodeURIComponent(pointId)}/history?range=${range}`,
  ).then((r) => r.buckets);
