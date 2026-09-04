// กราฟย้อนหลังในหน้ารายละเอียด — SVG ล้วน (D-009)
//
// ต้อง "อธิบายได้" ไม่ใช่แค่บอกทิศทางคร่าว ๆ (ต่างจาก sparkline การ์ดหน้ารวมที่เคยมี
// แต่เอาออกไปแล้วเพราะมีภาพจริงจากกล้องแทน — ดู CHANGELOG):
//
//   1. **แถบสีตรงช่วงที่อ่านไม่ออก** ไม่ใช่แค่เส้นขาด
//      ด้วยอัตราอ่านไม่ออกระดับ 47% ของทีม AI เส้นจะขาดถี่จนดูเหมือนกราฟเสีย
//      แถบบอกชัดว่า "ตรงนี้ไม่มีข้อมูล และเรารู้ว่าไม่มี" ซึ่งคนละความหมายกับ "วาดไม่ติด"
//   2. **แถบ min–max** ไม่ใช่แค่ค่าเฉลี่ย — ค่าพุ่งชั่วขณะคือสิ่งที่ฝ่ายผลิตต้องเห็น
//      แต่ค่าเฉลี่ยจะกลบมันหายไป (เหตุผลเดียวกับที่ api คืน min/max มาให้ตั้งแต่ T-005)

import { useId } from "react";
import type { HistoryBucket } from "../apiClient";

type Props = { buckets: HistoryBucket[]; unit: string | null };

const W = 620;
const H = 150;
const PAD_L = 34;
const PAD_B = 16;
const PAD_T = 6;

export function HistoryChart({ buckets, unit }: Props) {
  const gid = useId().replace(/:/g, "");

  const withValue = buckets.filter((b) => b.avg_value !== null);
  if (withValue.length < 2) {
    return <div className="hc-empty">ยังไม่มีข้อมูลพอวาดกราฟในช่วงนี้</div>;
  }

  const lows = withValue.map((b) => b.min_value ?? b.avg_value!);
  const highs = withValue.map((b) => b.max_value ?? b.avg_value!);
  let lo = Math.min(...lows);
  let hi = Math.max(...highs);
  if (hi === lo) {
    // ค่านิ่งสนิท — เปิดกรอบเล็กน้อยไม่ให้เส้นทับขอบบนพอดี
    hi = lo + Math.abs(lo || 1) * 0.05;
    lo = lo - Math.abs(lo || 1) * 0.05;
  }

  const t0 = new Date(buckets[0]!.bucket).getTime();
  const t1 = new Date(buckets[buckets.length - 1]!.bucket).getTime();
  const tSpan = t1 - t0 || 1;

  const x = (iso: string) => PAD_L + ((new Date(iso).getTime() - t0) / tSpan) * (W - PAD_L - 6);
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B);

  // ความกว้างโดยประมาณของหนึ่ง bucket ใช้วาดแถบ "อ่านไม่ออก"
  const bw = Math.max(2, (W - PAD_L - 6) / Math.max(buckets.length, 1));

  // เส้นค่าเฉลี่ย + แถบ min–max แตกเป็นช่วง ๆ ทุกครั้งที่เจอ bucket ที่ไม่มีค่า
  type Seg = { line: string; band: string };
  const segs: Seg[] = [];
  let line: string[] = [];
  let top: string[] = [];
  let bottom: string[] = [];

  const flush = () => {
    if (line.length > 1) {
      segs.push({ line: line.join(" "), band: `${top.join(" ")} ${bottom.reverse().join(" ")} Z` });
    }
    line = [];
    top = [];
    bottom = [];
  };

  for (const b of buckets) {
    if (b.avg_value === null) {
      flush();
      continue;
    }
    const px = x(b.bucket);
    line.push(`${line.length === 0 ? "M" : "L"} ${px.toFixed(1)} ${y(b.avg_value).toFixed(1)}`);
    top.push(`${top.length === 0 ? "M" : "L"} ${px.toFixed(1)} ${y(b.max_value ?? b.avg_value).toFixed(1)}`);
    bottom.push(`L ${px.toFixed(1)} ${y(b.min_value ?? b.avg_value).toFixed(1)}`);
  }
  flush();

  const fmt = (v: number) => (Math.abs(hi - lo) < 1 ? v.toFixed(3) : Math.abs(hi - lo) < 10 ? v.toFixed(2) : v.toFixed(0));
  const clock = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

  return (
    <svg className="hc" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`hg-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className="hc-band-top" />
          <stop offset="100%" className="hc-band-bottom" />
        </linearGradient>
      </defs>

      {[0, 0.5, 1].map((f) => {
        const v = lo + (hi - lo) * (1 - f);
        return (
          <g key={f}>
            <line className="hc-grid" x1={PAD_L} x2={W - 6} y1={y(v)} y2={y(v)} />
            <text className="hc-axis" x={PAD_L - 5} y={y(v) + 3} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        );
      })}

      {/* ช่วงที่อ่านไม่ออก — ความเข้มตามสัดส่วนที่อ่านไม่ออกใน bucket นั้น
          bucket ที่อ่านไม่ออกบางส่วนกับที่อ่านไม่ออกทั้งหมด ไม่ควรดูเหมือนกัน */}
      {buckets
        .filter((b) => b.unreadable > 0)
        .map((b, i) => (
          <rect
            key={`u${i}`}
            className="hc-unreadable"
            x={x(b.bucket) - bw / 2}
            y={PAD_T}
            width={bw}
            height={H - PAD_T - PAD_B}
            opacity={0.08 + 0.22 * (b.unreadable / Math.max(b.samples, 1))}
          />
        ))}

      {segs.map((s, i) => (
        <path key={`b${i}`} className="hc-band" fill={`url(#hg-${gid})`} d={s.band} />
      ))}
      {segs.map((s, i) => (
        <path key={`l${i}`} className="hc-line" d={s.line} />
      ))}

      <text className="hc-axis" x={PAD_L} y={H - 4}>
        {clock(buckets[0]!.bucket)}
      </text>
      <text className="hc-axis" x={W - 6} y={H - 4} textAnchor="end">
        {clock(buckets[buckets.length - 1]!.bucket)}
      </text>
      {unit && (
        <text className="hc-axis" x={PAD_L - 5} y={H - 4} textAnchor="end">
          {unit}
        </text>
      )}
    </svg>
  );
}
