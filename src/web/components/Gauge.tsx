// เกจรูปโค้ง — เขียน SVG เอง ไม่พึ่ง lib (D-009)
//
// เลือกวาดเป็น "แถบที่เติมตามค่า" แทนเข็ม เพราะอ่านจากระยะไกลบนจอ kiosk ได้ง่ายกว่า
// เข็มบาง ๆ ที่ต้องเพ่งว่าชี้ขีดไหน

type Props = {
  value: number | null;
  min: number;
  max: number;
  /** ค่าอ่านไม่ออก — วาดต่างจาก "ค่าเป็น 0" ให้ชัด */
  unreadable?: boolean;
  uncertain?: boolean;
};

const START = 135; // องศา เริ่มมุมล่างซ้าย
const SWEEP = 270; // กวาด 270 องศา เหลือช่องว่างด้านล่าง

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const arcPath = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number) => {
  const a = polar(cx, cy, r, fromDeg);
  const b = polar(cx, cy, r, toDeg);
  const large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
};

export function Gauge({ value, min, max, unreadable, uncertain }: Props) {
  const size = 116;
  const c = size / 2;
  const r = 46;

  const span = max - min;
  const raw = value === null || span === 0 ? null : (value - min) / span;
  // เข็มชี้เลยสุดสเกลเกิดขึ้นจริง (bench/samples.json มีเคสนี้) — หนีบไว้ที่ปลาย
  // เพื่อให้วาดได้ แต่ตัวเลขและสีจะบอกเองว่าเกิน ไม่กลบข้อมูล
  const ratio = raw === null ? null : Math.max(0, Math.min(1, raw));
  const over = raw !== null && (raw < 0 || raw > 1);

  const cls = unreadable ? "gauge-unreadable" : over ? "gauge-over" : uncertain ? "gauge-uncertain" : "gauge-ok";

  return (
    <svg className={`gauge ${cls}`} viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <path className="gauge-track" d={arcPath(c, c, r, START, START + SWEEP)} />
      {ratio !== null && !unreadable && (
        <path className="gauge-fill" d={arcPath(c, c, r, START, START + SWEEP * Math.max(ratio, 0.001))} />
      )}
      {over && (
        // ขีดเตือนที่ปลายด้านที่เกิน — บอกว่าค่าทะลุสเกลไปทางไหน
        <circle
          className="gauge-over-dot"
          {...(() => {
            const p = polar(c, c, r, START + (raw! > 1 ? SWEEP : 0));
            return { cx: p.x, cy: p.y, r: 4 };
          })()}
        />
      )}
    </svg>
  );
}
