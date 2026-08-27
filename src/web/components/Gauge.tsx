// เกจวงแหวน — SVG ล้วน ไม่พึ่ง lib (D-009)
//
// ใช้ stroke-dasharray/dashoffset บนวงกลมเต็มวง แทนการวาด path โค้งเอง
// เหตุผลไม่ใช่แค่หน้าตา: `transition` บน attribute `d` ของ path เบราว์เซอร์ส่วนใหญ่
// ไม่ animate จริง แต่ dashoffset เป็นตัวเลขล้วน จึงลื่นได้ทุกที่
//
// หมุน -90° ให้เริ่มนับที่ 12 นาฬิกา ตามแบบใน mockup

type Props = {
  value: number | null;
  min: number;
  max: number;
  /** อ่านไม่ออก — วาดต่างจาก "ค่าเป็น 0" ให้ชัด */
  unreadable?: boolean;
  uncertain?: boolean;
  size?: number;
};

const R = 40; // รัศมีใน viewBox 100x100
const CIRC = 2 * Math.PI * R;

export function Gauge({ value, min, max, unreadable, uncertain, size = 92 }: Props) {
  const span = max - min;
  const raw = value === null || span === 0 ? null : (value - min) / span;

  // เข็มชี้เลยสุดสเกลเกิดขึ้นจริง (bench/samples.json มีเคสนี้) — หนีบไว้ที่ปลาย
  // เพื่อให้วาดได้ แต่สีกับตัวเลขจะบอกเองว่าเกิน ไม่กลบข้อมูล
  const ratio = raw === null ? null : Math.max(0, Math.min(1, raw));
  const over = raw !== null && (raw < 0 || raw > 1);

  const state = unreadable ? "unreadable" : over ? "over" : uncertain ? "uncertain" : "ok";
  const filled = ratio === null || unreadable ? 0 : ratio;

  return (
    <svg
      className={`gauge gauge-${state}`}
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <g transform="rotate(-90 50 50)">
        <circle className="gauge-track" cx="50" cy="50" r={R} />
        {filled > 0 && (
          <circle
            className="gauge-fill"
            cx="50"
            cy="50"
            r={R}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - filled)}
          />
        )}
      </g>
    </svg>
  );
}
