// จอ dashboard หลัก — ตัวที่ไปขึ้นจอ kiosk บน Pi

import { useEffect, useState } from "react";
import { useLiveData } from "./useLiveData";
import { DeviceBar } from "./components/DeviceBar";
import { PointCard } from "./components/PointCard";
import { PointDetail } from "./components/PointDetail";

/** อ่านค่าที่จำไว้ตอนเปิดหน้าครั้งแรก — ต้องตรงกับ script ใน index.html เป๊ะ
 * (ไฟล์นั้นตั้ง attribute ให้ก่อน React mount กันจอกระพริบ ที่นี่แค่ต้องรู้ค่าเดียวกัน
 * เพื่อไม่ให้ state ของ React เพี้ยนไปจาก DOM จริงตอนเรนเดอร์รอบแรก) */
function initialTheme(): "light" | "dark" {
  try {
    return localStorage.getItem("meter-theme") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export function App() {
  const { points, devices, spark, conn, error, reload } = useLiveData();

  const [theme, setTheme] = useState<"light" | "dark">(initialTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("meter-theme", theme);
    } catch {
      // จอ kiosk บางเครื่องอาจปิด localStorage (private mode ของ chromium) —
      // ธีมจะไม่จำข้ามรีโหลด แต่สลับใช้งานตอนนี้ได้ปกติ ไม่ต้องล้มทั้งฟีเจอร์
    }
  }, [theme]);

  // จุดที่กำลังเปิดดูรายละเอียด — เก็บเป็น id ไม่ใช่ object
  // เพื่อให้ค่าที่โชว์ในแผงอัปเดตสดตาม SSE ไปด้วย ไม่ค้างที่ snapshot ตอนกด
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = points.find((p) => p.point_id === selectedId) ?? null;

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
    <>
      {/* พื้นหลังเรืองแสง — static ทั้งหมด เบราว์เซอร์ raster ครั้งเดียวแล้วจบ */}
      <div className="liquid-bg" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <div className={`app${selected ? " app-detail" : ""}`}>
      <header className="topbar">
        <div>
          <h1>Meter</h1>
          <p className="sub">ค่าหน้าปัดจากตู้ควบคุม · อัปเดตสด</p>
        </div>
        <div className="topbar-right">
          <div className="theme-toggle" role="group" aria-label="สลับธีม">
            <button
              type="button"
              className={theme === "light" ? "on" : ""}
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
            >
              สว่าง
            </button>
            <button
              type="button"
              className={theme === "dark" ? "on" : ""}
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
            >
              มืด
            </button>
          </div>
          <div className={`conn conn-${conn}`}>
            <span className="conn-dot" />
            {conn === "live" ? "เชื่อมต่ออยู่" : conn === "connecting" ? "กำลังเชื่อมต่อ" : "สายหลุด — กำลังต่อใหม่"}
          </div>
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
                <PointCard
                  key={p.point_id}
                  point={p}
                  spark={spark[p.point_id] ?? []}
                  now={now}
                  selected={p.point_id === selectedId}
                  onOpen={() => setSelectedId(p.point_id)}
                />
              ))}
            </div>
          </section>
        ),
      )}
      </div>

      {selected && (
        <PointDetail point={selected} now={now} onClose={() => setSelectedId(null)} />
      )}
    </>
  );
}
