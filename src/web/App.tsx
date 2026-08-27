// จอ dashboard หลัก — ตัวที่ไปขึ้นจอ kiosk บน Pi

import { useEffect, useState } from "react";
import { useLiveData } from "./useLiveData";
import { DeviceBar } from "./components/DeviceBar";
import { PointCard } from "./components/PointCard";

export function App() {
  const { points, devices, spark, conn, error, reload } = useLiveData();

  // "ตอนนี้" ต้องเดินเองทุกวินาที ไม่ใช่คำนวณครั้งเดียวตอน render
  // ไม่งั้นอายุของค่าจะค้างอยู่ที่ตัวเลขเดิมตลอดเมื่อข้อมูลหยุดไหล ซึ่งเป็นตอนที่สำคัญที่สุด
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(t);
  }, []);

  const byDevice = devices.length
    ? devices.map((d) => ({ device: d, points: points.filter((p) => p.device_id === d.device_id) }))
    : [{ device: null, points }];

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Meter</h1>
          <p className="sub">ค่าหน้าปัดจากตู้ควบคุม · อัปเดตสด</p>
        </div>
        <div className={`conn conn-${conn}`}>
          <span className="conn-dot" />
          {conn === "live" ? "เชื่อมต่ออยู่" : conn === "connecting" ? "กำลังเชื่อมต่อ" : "สายหลุด — กำลังต่อใหม่"}
        </div>
      </header>

      {error && (
        <div className="err">
          โหลดข้อมูลไม่ได้: {error}
          <button onClick={() => void reload()}>ลองใหม่</button>
        </div>
      )}

      <DeviceBar devices={devices} now={now} />

      {points.length === 0 && !error && <p className="empty">ยังไม่มีจุดวัดในระบบ</p>}

      {byDevice.map(({ device, points: list }) =>
        list.length === 0 ? null : (
          <section key={device?.device_id ?? "all"} className="group">
            {device && (
              <h2 className="group-head">
                {device.label ?? device.device_id}
                <span className="group-id">{device.device_id}</span>
              </h2>
            )}
            <div className="grid">
              {list.map((p) => (
                <PointCard key={p.point_id} point={p} spark={spark[p.point_id] ?? []} now={now} />
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
