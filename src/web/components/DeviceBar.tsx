// แถบสถานะเครื่อง edge ด้านบนจอ

import { useEffect, useRef, useState } from "react";
import { updateDeviceLabel, type DeviceRow } from "../apiClient";
import { ageLabel, isStale } from "../time";

export function DeviceBar({
  devices,
  now,
  patchDevice,
}: {
  devices: DeviceRow[];
  now: number;
  patchDevice: (deviceId: string, patch: Partial<DeviceRow>) => void;
}) {
  // แก้ได้ทีละเครื่อง — เก็บ id ที่กำลังแก้ ไม่ใช่ flag ต่อบล็อก
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (devices.length === 0) return null;

  function startEdit(d: DeviceRow) {
    setEditing(d.device_id);
    setDraft(d.label ?? "");
    setError(null);
  }
  function cancel() {
    setEditing(null);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateDeviceLabel(editing, draft);
      patchDevice(editing, { label: updated.label });
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="devicebar">
      {devices.map((d) => {
        const offline = d.status !== "ONLINE";
        // เครื่องยัง ONLINE แต่ไม่ส่งเฟรมมานาน = AI หยุดอ่าน ซึ่งสถานะ ONLINE จับไม่ได้
        // ต้องแยกให้เห็นเป็นคนละอาการ ไม่งั้นจะนึกว่าทุกอย่างปกติ
        const quiet = !offline && isStale(d.last_frame_at, now);

        return (
          <div key={d.device_id} className={`dev ${offline ? "dev-offline" : quiet ? "dev-quiet" : "dev-ok"}`}>
            <div className="dev-label">
              <span className="dev-dot" />
              {d.device_id}
            </div>

            {editing === d.device_id ? (
              <form className="dev-rename" onSubmit={submit}>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Escape" && cancel()}
                  placeholder="เช่น ตู้ควบคุมหม้อไอน้ำ"
                  maxLength={80}
                  disabled={saving}
                  aria-label={`ชื่อของ ${d.device_id}`}
                />
                <button type="submit" className="dev-rename-save" disabled={saving}>
                  {saving ? "กำลังบันทึก…" : "บันทึก"}
                </button>
                <button type="button" onClick={cancel} disabled={saving}>
                  ยกเลิก
                </button>
                {error && <p className="dev-rename-err">{error}</p>}
              </form>
            ) : (
              // ปุ่มครอบเฉพาะบรรทัดชื่อ ไม่ใช่ทั้งบล็อก — บล็อกกว้าง 260px+ ถ้ากดได้ทั้งใบ
              // คนหน้างานจะเผลอแตะบ่อยเกินจำเป็น (จอนี้ไม่มี auth กั้น — D-020)
              <button type="button" className="dev-name" onClick={() => startEdit(d)}>
                {d.label ?? <span className="dev-unnamed">ยังไม่ตั้งชื่อ</span>}
              </button>
            )}

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
