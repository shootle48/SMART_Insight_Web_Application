// เส้นแนวโน้มย้อนหลัง — SVG ล้วน (D-009)
//
// จุดที่ค่าเป็น null (อ่านไม่ออก) ต้องทำให้เส้น "ขาด" ไม่ใช่ลากผ่านหรือลากลงศูนย์
// เส้นที่ลากผ่านช่วงที่อ่านไม่ออกจะโกหกว่าค่าเดินต่อเนื่อง ซึ่งเป็นสิ่งที่คนดูตัดสินใจผิดได้

import type { SparkPoint } from "../useLiveData";

type Props = { data: SparkPoint[]; width?: number; height?: number };

export function Sparkline({ data, width = 220, height = 44 }: Props) {
  const values = data.map((d) => d.v).filter((v): v is number => v !== null);
  if (values.length < 2) {
    return <div className="spark-empty">ยังไม่พอวาดเส้น</div>;
  }

  const lo = Math.min(...values);
  const hi = Math.max(...values);
  // ค่านิ่งสนิททำให้ span=0 แล้วหารศูนย์ — ดันเส้นไปกลางกรอบแทน
  const span = hi - lo || 1;

  const t0 = data[0]!.t;
  const tSpan = (data[data.length - 1]!.t - t0) || 1;

  const x = (t: number) => ((t - t0) / tSpan) * (width - 2) + 1;
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);

  // แตกเป็นหลาย segment ทุกครั้งที่เจอ null เพื่อให้เส้นขาดจริง
  const segments: string[] = [];
  let current: string[] = [];
  for (const d of data) {
    if (d.v === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      continue;
    }
    current.push(`${current.length === 0 ? "M" : "L"} ${x(d.t).toFixed(1)} ${y(d.v).toFixed(1)}`);
  }
  if (current.length > 1) segments.push(current.join(" "));

  const gaps = data.filter((d) => d.v === null);

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} width={width} height={height} aria-hidden="true">
      {segments.map((d, i) => (
        <path key={i} className="spark-line" d={d} />
      ))}
      {gaps.map((g, i) => (
        // ขีดจาง ๆ ตรงช่วงที่อ่านไม่ออก ให้เห็นว่ามีรูโหว่จริง ไม่ใช่แค่เส้นสั้น
        <line key={i} className="spark-gap" x1={x(g.t)} x2={x(g.t)} y1={2} y2={height - 2} />
      ))}
    </svg>
  );
}
