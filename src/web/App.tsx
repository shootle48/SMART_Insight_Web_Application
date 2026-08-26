// หน้าเปล่าสำหรับ T-001 — มีไว้พิสูจน์ว่าเส้นทาง React → /api → Hono ต่อกันติดจริง
// dashboard ของจริงอยู่ที่ T-006 อย่าเพิ่งใส่ UI อะไรที่นี่

import { useEffect, useState } from "react";

type Health = { status: string; uptime_seconds: number };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch("/api/health");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Health;
        if (!cancelled) {
          setHealth(data);
          setError(null);
        }
      } catch (e) {
        // แสดง error ไว้บนจอ ไม่ใช่แค่ console — จอ kiosk ไม่มีใครเปิด devtools ดู
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };

    void check();
    const timer = setInterval(check, 5_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", lineHeight: 1.6 }}>
      <h1 style={{ margin: 0 }}>Meter</h1>
      <p style={{ color: "#666", marginTop: ".25rem" }}>
        รับค่าหน้าปัดจาก edge device ผ่าน MQTT — scaffold (T-001)
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1rem" }}>สถานะ server</h2>
        {error && <p style={{ color: "#b00" }}>ต่อ /api/health ไม่ได้: {error}</p>}
        {!error && !health && <p>กำลังเช็ค...</p>}
        {health && (
          <p>
            <strong style={{ color: "#0a0" }}>{health.status}</strong> · uptime {health.uptime_seconds}s
          </p>
        )}
      </section>
    </main>
  );
}
