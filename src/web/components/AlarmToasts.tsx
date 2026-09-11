// toast แจ้งเตือนมุมขวาล่าง (T-025 / D-023)
//
// กติกาที่ตั้งใจ — ทุกข้อมาจาก "จอนี้เป็น kiosk บนผนังโรงงาน ไม่มีคนนั่งเฝ้า":
//   1. **หายเอง** ใน 10 วิ (จัดการที่ useLiveData) — ไม่มีใครกดปิด ถ้าไม่หายจะกองเต็มจอ
//   2. **ซ้อนได้ไม่เกิน 3** — วันที่หลายจุดเสียพร้อมกัน toast ต้องไม่บังการ์ดที่คนต้องดู
//   3. **toast ไม่ใช่ที่เดียวที่บอกว่าผิดปกติ** — การ์ดค้างสถานะไว้เอง toast แค่ดึงสายตาชั่วคราว
//   4. แตะที่ตัว toast เพื่อปิดได้ แต่**ไม่มีปุ่ม X แยก** — ปุ่มบนจอที่ไม่มีใครกดคือของปลอม (D-019)
//   5. ไม่มีเสียง — โรงงานเสียงดังและจอไม่มีคนอยู่ประจำ ใส่ไปก็ไม่มีใครได้ยินแต่ทำให้ Chromium
//      ต้องขอ permission ซึ่งบน kiosk ไม่มีใครกดอนุญาต

import type { AlarmToast } from "../useLiveData";
import type { DeviceRow, PointRow } from "../apiClient";
import { formatValue } from "../time";
import { IconAlert, IconCheckCircle } from "./Icons";

type Props = {
  toasts: AlarmToast[];
  points: PointRow[];
  devices: DeviceRow[];
  onDismiss: (id: number) => void;
};

export function AlarmToasts({ toasts, points, devices, onDismiss }: Props) {
  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => {
        const point = points.find((p) => p.point_id === t.point_id);
        const device = devices.find((d) => d.device_id === t.device_id);
        const alarm = t.to === "ALARM";
        const name = point?.label ?? t.point_id;
        const where = device?.label ?? t.device_id;
        const value =
          t.value !== null ? `${formatValue(t.value, point?.min_value ?? null, point?.max_value ?? null)}${point?.unit ? ` ${point.unit}` : ""}` : null;
        const range =
          point && point.alarm_low !== null && point.alarm_high !== null
            ? `${formatValue(point.alarm_low, point.min_value, point.max_value)}–${formatValue(point.alarm_high, point.min_value, point.max_value)}`
            : null;

        return (
          <button
            key={t.id}
            type="button"
            className={`toast ${alarm ? "toast-alarm" : "toast-ok"}`}
            onClick={() => onDismiss(t.id)}
            aria-label={`${alarm ? "ค่าผิดปกติ" : "กลับสู่ปกติ"}: ${name} — แตะเพื่อปิด`}
          >
            <span className="toast-icon">{alarm ? <IconAlert size={20} /> : <IconCheckCircle size={20} />}</span>
            <span className="toast-body">
              <span className="toast-kicker">{alarm ? "ค่าผิดปกติ" : "กลับสู่ปกติ"}</span>
              <span className="toast-title">{name}</span>
              <span className="toast-meta">
                {where}
                {value && <> · <b>{value}</b></>}
                {alarm && range && <> · ช่วงที่ยอมรับ {range}</>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
