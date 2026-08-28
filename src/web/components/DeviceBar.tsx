// แถบสถานะเครื่อง edge ด้านบนจอ

import type { DeviceRow } from "../apiClient";
import { ageLabel, isStale } from "../time";

export function DeviceBar({ devices, now }: { devices: DeviceRow[]; now: number }) {
  if (devices.length === 0) return null;

  return (
    <div className="devicebar">
      {devices.map((d) => {
        const offline = d.status !== "ONLINE";
        // เครื่องยัง ONLINE แต่ไม่ส่งเฟรมมานาน = AI หยุดอ่าน ซึ่งสถานะ ONLINE จับไม่ได้
        // ต้องแยกให้เห็นเป็นคนละอาการ ไม่งั้นจะนึกว่าทุกอย่างปกติ
        const quiet = !offline && isStale(d.last_frame_at, now);

        return (
          <div key={d.device_id} className={`dev ${offline ? "dev-offline" : quiet ? "dev-quiet" : "dev-ok"}`}>
            <div className="dev-top">
              <span className="dev-dot" />
              <span className="dev-name">{d.label ?? d.device_id}</span>
              <span className="dev-id">{d.device_id}</span>
            </div>
            <div className="dev-meta">
              {offline ? (
                <strong>ออฟไลน์</strong>
              ) : quiet ? (
                <strong>ไม่ส่งข้อมูล {ageLabel(d.last_frame_at, now)}</strong>
              ) : (
                <>
                  <span>{d.enabled_point_count}/{d.point_count} จุด</span>
                  {d.storage_usage_percent !== null && <span>ดิสก์ {d.storage_usage_percent}%</span>}
                  <span>heartbeat {ageLabel(d.last_heartbeat_at, now)}</span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
