// เส้นแนวโน้มย้อนหลัง — SVG ล้วน (D-009)
//
// จุดที่ค่าเป็น null (อ่านไม่ออก) ต้องทำให้เส้น "ขาด" ไม่ใช่ลากผ่านหรือลากลงศูนย์
// เส้นที่ลากผ่านช่วงที่อ่านไม่ออกจะโกหกว่าค่าเดินต่อเนื่อง ซึ่งเป็นสิ่งที่คนดูตัดสินใจผิดได้

import { useId } from "react";
import type { SparkPoint } from "../useLiveData";

type Props = { data: SparkPoint[]; width?: number; height?: number };

export function Sparkline({ data, width = 240, height = 48 }: Props) {
  // id ต้องไม่ซ้ำกันข้ามการ์ด ไม่งั้น gradient ของใบแรกจะถูกใบหลังแย่งไปใช้
  const gid = useId().replace(/:/g, "");

  const values = data.map((d) => d.v).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return <div className="spark-empty">ยังไม่พอวาดเส้น</div>;
  }

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // ค่านิ่งสนิททำให้ span=0 แล้วหารศูนย์ — ดันเส้นไปกลางกรอบแทน
  const span = hi - lo || 1;

  const t0 = data[0]!.t;
  const tSpan = data[data.length - 1]!.t - t0 || 1;

  const x = (t: number) => ((t - t0) / tSpan) * (width - 2) + 1;
  const y = (v: number) => height - 4 - ((v - lo) / span) * (height - 10);

  // แตกเป็นหลาย segment ทุกครั้งที่เจอ null เพื่อให้เส้นขาดจริง
  const segments: { d: string; from: number; to: number }[] = [];
  let current: string[] = [];
  let from = 0;
  let to = 0;
  for (const p of data) {
    if (p.v === null) {
      if (current.length > 1) segments.push({ d: current.join(" "), from, to });
      current = [];
      continue;
    }
    const px = x(p.t);
    if (current.length === 0) from = px;
    to = px;
    current.push(`${current.length === 0 ? "M" : "L"} ${px.toFixed(1)} ${y(p.v).toFixed(1)}`);
  }
  if (current.length > 1) segments.push({ d: current.join(" "), from, to });

  const gaps = data.filter((p) => p.v === null);

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        {/* ไล่สีจางลงด้านล่าง ให้เส้นดูมีน้ำหนักโดยไม่บังตัวเลขข้างบน */}
        <linearGradient id={`sg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="spark-stop-top" />
          <stop offset="100%" className="spark-stop-bottom" />
        </linearGradient>
      </defs>

      {segments.map((s, i) => (
        <path
          key={`f${i}`}
          className="spark-area"
          fill={`url(#sg-${gid})`}
          d={`${s.d} L ${s.to.toFixed(1)} ${height} L ${s.from.toFixed(1)} ${height} Z`}
        />
      ))}

      {segments.map((s, i) => (
        <path key={`l${i}`} className="spark-line" d={s.d} />
      ))}

      {gaps.map((g, i) => (
        // ขีดจาง ๆ ตรงช่วงที่อ่านไม่ออก ให้เห็นว่ามีรูโหว่จริง ไม่ใช่แค่เส้นสั้น
        <line key={`g${i}`} className="spark-gap" x1={x(g.t)} x2={x(g.t)} y1={2} y2={height - 2} />
      ))}
    </svg>
  );
}
