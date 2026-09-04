// แผงรายละเอียดรายจุด — slide-over ที่ยังเห็นจุดอื่นหรี่ ๆ ข้าง ๆ
//
// ตั้งใจไม่ทำเป็นหน้าใหม่ (route แยก) เพราะคำถามที่ตามมาเสมอหลังดูจุดหนึ่งคือ
// "แล้วจุดอื่นล่ะ ปกติไหม" — เปลี่ยนหน้าเต็มจะเสีย context นั้นไป
// และบนทัชสกรีนต้องหาปุ่ม back ซึ่งเป็นเรื่องน่ารำคาญ
//
// ⚠️ **ต้องปิดตัวเองเมื่อไม่มีใครแตะ** — จอนี้ไปอยู่บนผนังโรงงาน
// ถ้ามีคนเดินไปกดแล้วไม่มีใครกดปิด มันจะค้างโชว์จุดเดียวตลอดไป
// จอที่ควรบอกภาพรวมจะกลายเป็นจอที่บอกเรื่องเดียว

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistory, type HistoryBucket, type PointRow } from "../apiClient";
import { HistoryChart } from "./HistoryChart";
import { Gauge } from "./Gauge";
import { ageLabel, formatValue, isStale } from "../time";

/** ไม่มีใครแตะนานเท่านี้ → กลับหน้ารวมเอง */
const AUTO_CLOSE_MS = 60_000;

const RANGES = [
  { key: "15m", label: "15 นาที" },
  { key: "1h", label: "1 ชม." },
  { key: "6h", label: "6 ชม." },
  { key: "24h", label: "24 ชม." },
] as const;

type Props = { point: PointRow; now: number; onClose: () => void };

export function PointDetail({ point, now, onClose }: Props) {
  const [range, setRange] = useState<string>("1h");
  const [buckets, setBuckets] = useState<HistoryBucket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(Math.round(AUTO_CLOSE_MS / 1000));

  // เริ่มด้วย true (ลอง <img> ก่อนเสมอ) แล้วให้ onError สลับเป็น false ถ้าจุดนี้ไม่มีภาพ
  // (404) — ต้อง reset ทุกครั้งที่สลับจุด ไม่งั้นค้างจากจุดก่อนหน้า เพราะ component นี้
  // ไม่ได้ unmount ตอนกดการ์ดอื่นขณะแผงเปิดอยู่ (state เดิมจะค้างข้ามจุด)
  const [hasEvidence, setHasEvidence] = useState(true);
  useEffect(() => setHasEvidence(true), [point.point_id]);

  const lastTouch = useRef(Date.now());
  const touch = useCallback(() => {
    lastTouch.current = Date.now();
  }, []);

  // นับถอยหลังแล้วปิดเอง — แสดงเลขให้เห็นด้วย ไม่ให้หน้าจอหายไปเฉย ๆ แบบไม่มีปี่มีขลุ่ย
  useEffect(() => {
    const t = setInterval(() => {
      const left = AUTO_CLOSE_MS - (Date.now() - lastTouch.current);
      setRemaining(Math.max(0, Math.round(left / 1000)));
      if (left <= 0) onClose();
    }, 1_000);
    return () => clearInterval(t);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      touch();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, touch]);

  useEffect(() => {
    let cancelled = false;
    setBuckets(null);
    setError(null);
    fetchHistory(point.point_id, range)
      .then((b) => !cancelled && setBuckets(b))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [point.point_id, range]);

  const stale = isStale(point.captured_at, now);
  const offline = point.device_status !== "ONLINE";
  const unreadable = point.quality === "UNREADABLE";
  const hasScale = point.min_value !== null && point.max_value !== null;

  // สัดส่วนคุณภาพในช่วงที่เลือก — ตอบคำถาม "ช่วงนี้เชื่อได้แค่ไหน"
  // ซึ่งสำคัญมากเมื่ออัตราอ่านไม่ออกสูง (ของทีม AI อยู่ราว 47%)
  const totals = (buckets ?? []).reduce(
    (a, b) => ({
      samples: a.samples + b.samples,
      unreadable: a.unreadable + b.unreadable,
      uncertain: a.uncertain + b.uncertain,
    }),
    { samples: 0, unreadable: 0, uncertain: 0 },
  );
  const okCount = Math.max(0, totals.samples - totals.unreadable - totals.uncertain);
  const pct = (n: number) => (totals.samples > 0 ? (n / totals.samples) * 100 : 0);

  const nums = (buckets ?? []).filter((b) => b.avg_value !== null);
  const lo = nums.length ? Math.min(...nums.map((b) => b.min_value ?? b.avg_value!)) : null;
  const hi = nums.length ? Math.max(...nums.map((b) => b.max_value ?? b.avg_value!)) : null;

  // ต่างกันมาก = edge ยังไม่ได้ตั้ง NTP (OPEN-5 ในสัญญา) กราฟย้อนหลังจะเพี้ยนตาม
  const drift =
    point.captured_at && point.received_at
      ? (new Date(point.received_at).getTime() - new Date(point.captured_at).getTime()) / 1000
      : null;

  return (
    <aside className="detail" onPointerDown={touch} onPointerMove={touch} onWheel={touch}>
      <header className="d-head">
        <div>
          <h2>{point.label ?? point.point_id}</h2>
          <div className="d-id">
            {point.point_id} · {point.device_id}
          </div>
        </div>
        <div className="d-actions">
          <span className="d-auto" title="จอผนังไม่มีใครเดินไปกดปิด จึงกลับหน้ารวมเอง">
            ↩ กลับหน้ารวมใน {remaining} วิ
          </span>
          <button className="d-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
      </header>

      <div className="d-now">
        {hasScale && (
          <Gauge
            value={unreadable ? null : point.value_num}
            min={point.min_value!}
            max={point.max_value!}
            unreadable={unreadable}
            uncertain={point.quality === "UNCERTAIN"}
            size={76}
          />
        )}
        <div>
          {unreadable ? (
            <span className="v-unreadable">อ่านไม่ออก</span>
          ) : point.value_num !== null ? (
            <>
              <span className="d-big">{formatValue(point.value_num, point.min_value, point.max_value)}</span>
              {point.unit && <span className="v-unit"> {point.unit}</span>}
            </>
          ) : point.value_text !== null ? (
            <span className="d-big">{point.value_text}</span>
          ) : (
            <span className="v-none">ยังไม่มีค่า</span>
          )}
          <div className="d-sub">
            {ageLabel(point.captured_at, now)}
            {hasScale && ` · ช่วง ${point.min_value}–${point.max_value}${point.unit ? ` ${point.unit}` : ""}`}
            {offline && " · เครื่องออฟไลน์"}
            {!offline && stale && " · ค่าเก่า"}
          </div>
        </div>
      </div>

      {/* ภาพล่าสุดจากกล้อง (T-011) — ตั้งใจไว้ติดกับตัวเลขบนสุด ไม่ใช่ท้ายแผง เพราะเป็น
          สิ่งที่คนอยากเห็นทันทีที่เปิดแผงมา (เทียบภาพกับตัวเลขว่า AI อ่านตรงไหม) ไม่ใช่
          ของที่ต้องเลื่อนหาหลังกราฟ/สถิติย้อนหลัง — ไม่ผูกกับสถานะอ่านได้/ไม่ได้ตอนนี้
          มีภาพก็โชว์ ไม่มีก็บอกตรง ๆ ว่ายังไม่มี */}
      <div className="d-lab">ภาพล่าสุดจากกล้อง</div>
      {hasEvidence ? (
        <img
          className="d-evidence"
          // เหตุผลเดียวกับใน PointCard.tsx — ผูกกับ frame_id กัน URL ค้างเดิมจนเบราว์เซอร์
          // ไม่ยอมโหลดภาพใหม่ตาม
          src={`/api/evidence/${encodeURIComponent(point.point_id)}/latest${point.frame_id ? `?f=${encodeURIComponent(point.frame_id)}` : ""}`}
          alt={`ภาพจากกล้องของ ${point.label ?? point.point_id}`}
          onError={() => setHasEvidence(false)}
        />
      ) : (
        <div className="d-snap">📷 ยังไม่มีภาพของจุดนี้</div>
      )}

      <div className="d-chips">
        {RANGES.map((r) => (
          <button
            key={r.key}
            className={`chip ${range === r.key ? "chip-on" : ""}`}
            onClick={() => {
              touch();
              setRange(r.key);
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {error && <div className="d-err">โหลดประวัติไม่ได้: {error}</div>}
      {!error && buckets === null && <div className="hc-empty">กำลังโหลด...</div>}
      {!error && buckets && <HistoryChart buckets={buckets} unit={point.unit} />}

      {buckets && totals.samples > 0 && (
        <>
          <div className="d-lab">สัดส่วนคุณภาพในช่วงนี้ · {totals.samples} ค่า</div>
          <div className="qbar">
            {okCount > 0 && <i className="q-ok" style={{ width: `${pct(okCount)}%` }} />}
            {totals.uncertain > 0 && <i className="q-unc" style={{ width: `${pct(totals.uncertain)}%` }} />}
            {totals.unreadable > 0 && <i className="q-bad" style={{ width: `${pct(totals.unreadable)}%` }} />}
          </div>
          <div className="qleg">
            <span>
              <i className="dot q-ok" />
              อ่านได้ {pct(okCount).toFixed(0)}%
            </span>
            {totals.uncertain > 0 && (
              <span>
                <i className="dot q-unc" />
                ไม่มั่นใจ {pct(totals.uncertain).toFixed(0)}%
              </span>
            )}
            <span>
              <i className="dot q-bad" />
              อ่านไม่ออก {pct(totals.unreadable).toFixed(0)}%
            </span>
          </div>
        </>
      )}

      <div className="d-grid">
        <div className="d-box">
          <div className="t">ต่ำสุด / สูงสุด ในช่วง</div>
          <div className="v">{lo !== null ? `${formatValue(lo, point.min_value, point.max_value)} – ${formatValue(hi!, point.min_value, point.max_value)}` : "—"}</div>
        </div>
        <div className="d-box">
          <div className="t">confidence ล่าสุด</div>
          <div className="v">{point.confidence !== null ? point.confidence.toFixed(2) : "—"}</div>
        </div>
        <div className="d-box">
          <div className="t">นาฬิกา edge ต่างจากเรา</div>
          <div className="v">{drift !== null ? `${drift >= 0 ? "+" : ""}${drift.toFixed(1)} วิ` : "—"}</div>
        </div>
        <div className="d-box">
          <div className="t">frame ล่าสุด</div>
          <div className="v v-sm">{point.frame_id ?? "—"}</div>
        </div>
      </div>
    </aside>
  );
}
