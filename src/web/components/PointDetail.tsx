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
import {
  fetchHistory,
  requestCalibrationSnap,
  saveFixture,
  updatePointConfig,
  type CalibrationPoint,
  type HistoryBucket,
  type PointRow,
} from "../apiClient";
import { HistoryChart } from "./HistoryChart";
import { ageLabel, formatValue, isStale } from "../time";

/** จุดที่กำลังแก้ในฟอร์ม calibrate — value เป็น string ระหว่างพิมพ์ (เว้นว่างได้ชั่วคราว) */
type EditableCalibPoint = { x: number; y: number; value: string };

function calibPointsFromFixture(point: PointRow): EditableCalibPoint[] {
  if (point.fixture?.kind === "GAUGE") {
    return point.fixture.calibration.map((p) => ({ x: p.x, y: p.y, value: String(p.value) }));
  }
  return [];
}

/** ไม่มีใครแตะนานเท่านี้ → กลับหน้ารวมเอง */
const AUTO_CLOSE_MS = 60_000;

const RANGES = [
  { key: "15m", label: "15 นาที" },
  { key: "1h", label: "1 ชม." },
  { key: "6h", label: "6 ชม." },
  { key: "24h", label: "24 ชม." },
] as const;

/** ค่าตั้งต้นของฟอร์ม — min/max เป็น string เพื่อให้เว้นว่างได้ระหว่างพิมพ์ (จุดไม่มีสเกล) */
function toConfigForm(point: PointRow) {
  return {
    label: point.label ?? "",
    unit: point.unit ?? "",
    min: point.min_value !== null ? String(point.min_value) : "",
    max: point.max_value !== null ? String(point.max_value) : "",
  };
}

type Props = {
  point: PointRow;
  now: number;
  onClose: () => void;
  /** เรียกหลังบันทึกค่าตั้งค่าสำเร็จ — ให้ App.tsx อัปเดต state ในเครื่องทันที ไม่ต้องรอ SSE */
  onConfigSaved: (patch: Partial<PointRow>) => void;
};

export function PointDetail({ point, now, onClose, onConfigSaved }: Props) {
  const [range, setRange] = useState<string>("1h");
  const [buckets, setBuckets] = useState<HistoryBucket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(Math.round(AUTO_CLOSE_MS / 1000));

  // เริ่มด้วย true (ลอง <img> ก่อนเสมอ) แล้วให้ onError สลับเป็น false ถ้าจุดนี้ไม่มีภาพ
  // (404) — ต้อง reset ทุกครั้งที่สลับจุด ไม่งั้นค้างจากจุดก่อนหน้า เพราะ component นี้
  // ไม่ได้ unmount ตอนกดการ์ดอื่นขณะแผงเปิดอยู่ (state เดิมจะค้างข้ามจุด)
  const [hasEvidence, setHasEvidence] = useState(true);
  useEffect(() => setHasEvidence(true), [point.point_id]);

  // แผง calibrate (T-014) — เฉพาะ GAUGE ตามที่ ticket กำหนดไว้ก่อน (7-segment/water meter
  // ทำทีหลัง เพราะ fixture คนละรูปแบบ ต้องมี UI ต่างกัน)
  //
  // เริ่มด้วยภาพ evidence ที่มีอยู่แล้ว (ถ้ามี) ไม่บังคับขอภาพใหม่ทุกครั้ง — จุดที่ตั้งค่า
  // แล้วอยากแก้เล็กน้อยไม่จำเป็นต้องรอ edge snap ใหม่ (ดู CALIBRATION-PROPOSAL.md)
  const [calibrating, setCalibrating] = useState(false);
  const [calibPoints, setCalibPoints] = useState<EditableCalibPoint[]>([]);
  const [calibImgFrameId, setCalibImgFrameId] = useState<string | null>(null);
  const [snapStatus, setSnapStatus] = useState<"idle" | "waiting" | "error">("idle");
  const [snapError, setSnapError] = useState<string | null>(null);
  const [calibSaving, setCalibSaving] = useState(false);
  const [calibSaveError, setCalibSaveError] = useState<string | null>(null);
  const pollCancelRef = useRef(0);

  useEffect(() => {
    setCalibrating(false);
    setCalibPoints(calibPointsFromFixture(point));
    setCalibImgFrameId(point.frame_id ?? null);
    setSnapStatus("idle");
    setSnapError(null);
    setCalibSaveError(null);
    pollCancelRef.current += 1; // ยกเลิก poll ค้างจากจุดก่อนหน้า (ดู requestNewSnap)
  }, [point.point_id]);

  const requestNewSnap = useCallback(async () => {
    const myToken = ++pollCancelRef.current;
    setSnapStatus("waiting");
    setSnapError(null);
    try {
      const { request_id } = await requestCalibrationSnap(point.point_id);
      const deadlineAt = Date.now() + 10_000;
      // Poll endpoint ภาพเดิม เทียบ header X-Frame-Id กับ request_id ที่เพิ่งขอ — รู้แน่ชัด
      // ว่า "ภาพที่ได้คือภาพที่เพิ่งขอ" ไม่ใช่แค่เดาว่ารอนานพอหรือยัง (ดู evidence.ts header)
      const poll = async () => {
        if (myToken !== pollCancelRef.current) return; // ถูกยกเลิก (สลับจุด/ขอใหม่ซ้อน)
        if (Date.now() > deadlineAt) {
          setSnapStatus("error");
          setSnapError("รอภาพนานเกินไป (>10 วิ) — เครื่องอาจออฟไลน์หรือ edge ยังไม่รองรับคำสั่งนี้");
          return;
        }
        try {
          const res = await fetch(`/api/evidence/${encodeURIComponent(point.point_id)}/latest`, {
            cache: "no-store",
          });
          const frameId = res.headers.get("X-Frame-Id");
          if (res.ok && frameId === request_id) {
            setCalibImgFrameId(frameId);
            setSnapStatus("idle");
            return;
          }
        } catch {
          // เครือข่ายสะดุดชั่วคราว ไม่ถือเป็น error ทันที ลองรอบถัดไป
        }
        setTimeout(poll, 1_000);
      };
      void poll();
    } catch (e) {
      setSnapStatus("error");
      setSnapError(e instanceof Error ? e.message : String(e));
    }
  }, [point.point_id]);

  const addCalibPoint = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setCalibPoints((pts) => [...pts, { x, y, value: "" }]);
  }, []);

  const saveCalibration = useCallback(async () => {
    if (calibPoints.length < 2) {
      setCalibSaveError("ต้องมีจุดอ้างอิงอย่างน้อย 2 จุด");
      return;
    }
    const parsed: CalibrationPoint[] = [];
    for (const p of calibPoints) {
      const value = Number(p.value.trim());
      if (p.value.trim() === "" || Number.isNaN(value)) {
        setCalibSaveError("ทุกจุดต้องกรอกค่าจริงเป็นตัวเลข");
        return;
      }
      parsed.push({ x: p.x, y: p.y, value });
    }
    setCalibSaving(true);
    setCalibSaveError(null);
    try {
      const updated = await saveFixture(point.point_id, { kind: "GAUGE", calibration: parsed });
      onConfigSaved(updated);
      setCalibrating(false);
    } catch (e) {
      setCalibSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setCalibSaving(false);
    }
  }, [calibPoints, point.point_id, onConfigSaved]);

  // ฟอร์มตั้งค่าจุด (label/หน่วย/สเกล) — ปิดไว้เป็นค่าเริ่มต้น เปิดเมื่อกดปุ่ม ⚙ ตั้งค่า
  // เหตุผลเดียวกับ hasEvidence ข้างบน: ต้อง reset ทุกครั้งที่สลับจุด เพราะ component ไม่
  // unmount ระหว่างกดการ์ดอื่นขณะแผงเปิดค้างอยู่ ไม่งั้นฟอร์มค้างเปิดแก้จุดผิดข้ามกัน
  const [editingConfig, setEditingConfig] = useState(false);
  const [configForm, setConfigForm] = useState(() => toConfigForm(point));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    setEditingConfig(false);
    setConfigForm(toConfigForm(point));
    setSaveError(null);
  }, [point.point_id]);

  const submitConfig = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const label = configForm.label.trim();
      if (!label) {
        setSaveError("ต้องใส่ชื่อจุดวัด");
        return;
      }
      const unit = configForm.unit.trim() === "" ? null : configForm.unit.trim();
      const minRaw = configForm.min.trim();
      const maxRaw = configForm.max.trim();
      if ((minRaw === "") !== (maxRaw === "")) {
        setSaveError("ต้องใส่ค่าต่ำสุด/สูงสุดคู่กัน หรือเว้นว่างทั้งคู่ (จุดที่ไม่มีสเกล)");
        return;
      }
      const min_value = minRaw === "" ? null : Number(minRaw);
      const max_value = maxRaw === "" ? null : Number(maxRaw);
      if ((min_value !== null && Number.isNaN(min_value)) || (max_value !== null && Number.isNaN(max_value))) {
        setSaveError("ค่าต่ำสุด/สูงสุดต้องเป็นตัวเลข");
        return;
      }
      if (min_value !== null && max_value !== null && max_value <= min_value) {
        setSaveError("ค่าสูงสุดต้องมากกว่าค่าต่ำสุด");
        return;
      }

      setSaving(true);
      setSaveError(null);
      try {
        const updated = await updatePointConfig(point.point_id, { label, unit, min_value, max_value });
        onConfigSaved(updated);
        setEditingConfig(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [configForm, point.point_id, onConfigSaved],
  );

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
            {point.enabled === false && <span className="d-unconfigured"> · ยังไม่ตั้งค่า</span>}
          </div>
        </div>
        <div className="d-actions">
          <button
            className="d-cfg-btn"
            onClick={() => setEditingConfig((v) => !v)}
            aria-expanded={editingConfig}
          >
            ⚙ ตั้งค่า
          </button>
          {/* Calibrate เฉพาะ GAUGE ก่อน (T-014) — 7-segment/water meter fixture คนละรูปแบบ
              ยังไม่มี UI รองรับ (bbox แทนจุดอ้างอิง) */}
          {point.kind === "GAUGE" && (
            <button
              className="d-cfg-btn"
              onClick={() => setCalibrating((v) => !v)}
              aria-expanded={calibrating}
            >
              🎯 Calibrate
            </button>
          )}
          <span className="d-auto" title="จอผนังไม่มีใครเดินไปกดปิด จึงกลับหน้ารวมเอง">
            ↩ กลับหน้ารวมใน {remaining} วิ
          </span>
          <button className="d-close" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </div>
      </header>

      {editingConfig && (
        <form className="d-cfg" onSubmit={submitConfig}>
          <label>
            ชื่อจุดวัด
            <input
              type="text"
              value={configForm.label}
              onChange={(e) => setConfigForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="เช่น แรงดันหม้อไอน้ำ"
              autoFocus
            />
          </label>
          <label>
            หน่วย
            <input
              type="text"
              value={configForm.unit}
              onChange={(e) => setConfigForm((f) => ({ ...f, unit: e.target.value }))}
              placeholder="เช่น bar (เว้นว่างได้ถ้าไม่มีหน่วย)"
            />
          </label>
          <div className="d-cfg-scale">
            <label>
              ค่าต่ำสุด
              <input
                type="number"
                step="any"
                value={configForm.min}
                onChange={(e) => setConfigForm((f) => ({ ...f, min: e.target.value }))}
                placeholder="ไม่มีสเกล = เว้นว่าง"
              />
            </label>
            <label>
              ค่าสูงสุด
              <input
                type="number"
                step="any"
                value={configForm.max}
                onChange={(e) => setConfigForm((f) => ({ ...f, max: e.target.value }))}
                placeholder="ไม่มีสเกล = เว้นว่าง"
              />
            </label>
          </div>
          {saveError && <div className="d-err">{saveError}</div>}
          <div className="d-cfg-actions">
            <button type="submit" className="d-cfg-save" disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button type="button" onClick={() => setEditingConfig(false)} disabled={saving}>
              ยกเลิก
            </button>
          </div>
        </form>
      )}

      {calibrating && (
        <div className="d-cfg d-calib">
          <div className="d-calib-row">
            <button type="button" onClick={requestNewSnap} disabled={snapStatus === "waiting"}>
              {snapStatus === "waiting" ? "กำลังรอภาพ..." : "📷 ขอภาพใหม่สำหรับ calibrate"}
            </button>
            {calibPoints.length > 0 && (
              <button type="button" onClick={() => setCalibPoints([])} disabled={snapStatus === "waiting"}>
                ล้างจุดทั้งหมด
              </button>
            )}
          </div>
          {snapStatus === "error" && <div className="d-err">{snapError}</div>}

          {calibImgFrameId ? (
            <>
              <div className="d-calib-hint">คลิกบนภาพเพื่อปักจุดอ้างอิง (อย่างน้อย 2 จุด) แล้วกรอกค่าจริง ณ จุดนั้น</div>
              <div className="d-calib-imgwrap">
                <img
                  className="d-calib-img"
                  src={`/api/evidence/${encodeURIComponent(point.point_id)}/latest?f=${encodeURIComponent(calibImgFrameId)}`}
                  alt="ภาพสำหรับ calibrate"
                  onClick={addCalibPoint}
                  onError={() => setCalibImgFrameId(null)}
                />
                {calibPoints.map((p, i) => (
                  <div
                    key={i}
                    className="d-calib-dot"
                    style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="d-snap">📷 ยังไม่มีภาพให้ calibrate — กด "ขอภาพใหม่" ก่อน</div>
          )}

          {calibPoints.length > 0 && (
            <div className="d-calib-list">
              {calibPoints.map((p, i) => (
                <div className="d-calib-item" key={i}>
                  <span className="d-calib-num">{i + 1}</span>
                  <span className="d-calib-pos">
                    x={(p.x * 100).toFixed(0)}% y={(p.y * 100).toFixed(0)}%
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={p.value}
                    placeholder="ค่าจริง"
                    onChange={(e) =>
                      setCalibPoints((pts) => pts.map((q, j) => (j === i ? { ...q, value: e.target.value } : q)))
                    }
                  />
                  <button
                    type="button"
                    className="d-calib-rm"
                    onClick={() => setCalibPoints((pts) => pts.filter((_, j) => j !== i))}
                    aria-label={`ลบจุดที่ ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {calibSaveError && <div className="d-err">{calibSaveError}</div>}
          <div className="d-cfg-actions">
            <button
              type="button"
              className="d-cfg-save"
              onClick={saveCalibration}
              disabled={calibSaving || calibPoints.length < 2}
            >
              {calibSaving ? "กำลังบันทึก..." : "บันทึก Calibration"}
            </button>
            <button type="button" onClick={() => setCalibrating(false)} disabled={calibSaving}>
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      <div className="d-now">
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
