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
import { IconCamera, IconClose, IconSettings, IconTarget } from "./Icons";
import { useEvidenceSrc } from "../useEvidenceSrc";
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
    alarmLow: point.alarm_low !== null ? String(point.alarm_low) : "",
    alarmHigh: point.alarm_high !== null ? String(point.alarm_high) : "",
  };
}

/**
 * แปลงคู่ช่อง "ต่ำ/สูง" จาก string ในฟอร์มเป็นตัวเลข — กติกาเดียวกันทั้งสเกลและเกณฑ์:
 * ต้องมาคู่กันหรือเว้นว่างทั้งคู่ · เป็นตัวเลข · สูงต้องมากกว่าต่ำ
 * คืน error message เมื่อไม่ผ่าน (ให้ผู้เรียกใส่ชื่อคู่ให้เอง จะได้บอกคนใช้ถูกช่อง)
 */
type PairResult = { error: string } | { low: number | null; high: number | null };
function parsePair(lowRaw: string, highRaw: string, name: string, emptyHint: string): PairResult {
  const lo = lowRaw.trim();
  const hi = highRaw.trim();
  if ((lo === "") !== (hi === "")) return { error: `ต้องใส่${name}คู่กัน หรือเว้นว่างทั้งคู่ (${emptyHint})` };
  const low = lo === "" ? null : Number(lo);
  const high = hi === "" ? null : Number(hi);
  if ((low !== null && Number.isNaN(low)) || (high !== null && Number.isNaN(high))) return { error: `${name}ต้องเป็นตัวเลข` };
  if (low !== null && high !== null && high <= low) return { error: `${name}: ค่าสูงต้องมากกว่าค่าต่ำ` };
  return { low, high };
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
  const evidenceSrc = useEvidenceSrc(point.point_id, point.frame_id);

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
      const scale = parsePair(configForm.min, configForm.max, "ค่าต่ำสุด/สูงสุดของสเกล", "จุดที่ไม่มีสเกล");
      if ("error" in scale) {
        setSaveError(scale.error);
        return;
      }
      const alarm = parsePair(configForm.alarmLow, configForm.alarmHigh, "เกณฑ์แจ้งเตือน", "ไม่แจ้งเตือนจุดนี้");
      if ("error" in alarm) {
        setSaveError(alarm.error);
        return;
      }

      setSaving(true);
      setSaveError(null);
      try {
        const updated = await updatePointConfig(point.point_id, {
          label,
          unit,
          min_value: scale.low,
          max_value: scale.high,
          alarm_low: alarm.low,
          alarm_high: alarm.high,
        });
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

  // ปิดแผงตอนแตะนอกแผง — เดิมมีแต่ปุ่ม X กับ Escape (คีย์บอร์ดจริง ไม่มีบนจอทัชสกรีนโรงงาน)
  // ผู้ใช้ทัชสกรีนคาดหวังแตะที่ว่างแล้วปิดได้เหมือน modal ทั่วไป
  const panelRef = useRef<HTMLElement>(null);

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

  // ใช้ pointerdown (ครอบทั้งเมาส์และทัช) ไม่ใช่ click — ตอบสนองไวกว่าตั้งแต่เริ่มแตะ
  // capture: true กันเผื่ออนาคตมีปุ่ม/อินพุตข้างในแผง stopPropagation ไว้ (ตอนนี้ยังไม่มี
  // แต่ capture phase ทำงานก่อนเสมอไม่ว่าจะมีวันหลังหรือเปล่า ปลอดภัยไว้ก่อน)
  //
  // เงื่อนไขปิด: แตะนอกตัวแผงเอง (panelRef) **และ** ไม่ใช่การ์ดจุดอื่นในหน้ารวม —
  // แตะการ์ดต้องปล่อยให้ onOpen ของการ์ดนั้นจัดการแทน (สลับไปดูจุดอื่น ไม่ใช่ปิดแผง)
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (panelRef.current?.contains(target)) return;
      if (target?.closest(".card")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, [onClose]);

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

  // ดึงกราฟซ้ำเงียบ ๆ ทุกครั้งที่มีเฟรมใหม่เข้ามาทาง SSE (captured_at เปลี่ยน) —
  // 🔴 บั๊กเดิม (2026-09-08): effect ด้านบนผูกแค่ point_id/range กราฟเลยไม่ขยับเลย
  // จนกว่าจะเปลี่ยนช่วงเวลาหรือปิด-เปิดแผงใหม่ ทั้งที่ค่าบนจอ (ก้อนบนสุด) วิ่งเป็นค่าใหม่ตลอด
  //
  // ตั้งใจไม่ setBuckets(null) ที่นี่เหมือน effect บน — จะกลายเป็นกราฟกระพริบเป็น "กำลังโหลด"
  // ทุกครั้งที่มีค่าใหม่ ซึ่งถี่กว่าตอนเปลี่ยน range/จุดมาก แค่แทนที่ข้อมูลเดิมเงียบ ๆ พอ
  useEffect(() => {
    if (point.captured_at === null) return;
    let cancelled = false;
    fetchHistory(point.point_id, range)
      .then((b) => !cancelled && setBuckets(b))
      .catch(() => {
        /* เงียบไว้ — error ของการโหลดครั้งแรกยังโชว์ค้างอยู่แล้ว ไม่ต้องแย่งจอ */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ตั้งใจไม่ใส่ point.point_id/range:
    // ให้ effect บนจัดการตอน mount/เปลี่ยนช่วงเวลา (พร้อม loading state) ส่วนอันนี้จับแค่
    // "มีเฟรมใหม่" อย่างเดียว ไม่งั้นจะยิงซ้ำสองรอบทุกครั้งที่เปลี่ยนจุด/ช่วงเวลา
  }, [point.captured_at]);

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
    <aside ref={panelRef} className="detail" onPointerDown={touch} onPointerMove={touch} onWheel={touch}>
      <header className="d-head">
        <div className="d-head-title">
          <h2>{point.label ?? point.point_id}</h2>
          <div className="d-id">
            <span className="d-id-mono">{point.point_id}</span>
            <span className="d-id-sep">·</span>
            <span className="d-id-mono">{point.device_id}</span>
            {point.enabled === false && <span className="d-unconfigured">ยังไม่ตั้งค่า</span>}
          </div>
        </div>
        {/* chrome เดิม 4 อันแข่งกันเอง (ปุ่มข้อความ 2 + pill นับถอยหลัง + ปิด) —
            ตัดเหลือ icon 3 อัน ; countdown ย้ายไปอยู่บรรทัด meta ท้ายแผงแบบเงียบ ๆ */}
        <div className="d-actions">
          <button
            className="d-icon-btn"
            onClick={() => setEditingConfig((v) => !v)}
            aria-expanded={editingConfig}
            aria-label="ตั้งค่าจุดวัด"
            title="ตั้งค่า label/หน่วย/สเกล"
          >
            <IconSettings />
          </button>
          {point.kind === "GAUGE" && (
            <button
              className="d-icon-btn"
              onClick={() => setCalibrating((v) => !v)}
              aria-expanded={calibrating}
              aria-label="Calibrate จุดวัด"
              title="กำหนดจุดอ้างอิงบนภาพ"
            >
              <IconTarget />
            </button>
          )}
          <button className="d-icon-btn" onClick={onClose} aria-label="ปิด" title="ปิด (Esc)">
            <IconClose />
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
          {/* สองกลุ่มนี้หน้าตาเหมือนกัน (ต่ำ/สูง) แต่คนละความหมาย — หัวกลุ่มอย่างเดียวพอ
              (เคยมีคำอธิบายใต้หัว ผู้ใช้บอกว่างุนงงกว่าไม่มี — ตัดออก 2026-09-11) */}
          <fieldset className="d-cfg-group">
            <legend>สเกลของหน้าปัด</legend>
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
          </fieldset>
          <fieldset className="d-cfg-group">
            <legend>ช่วงที่ยอมรับได้</legend>
            <div className="d-cfg-scale">
              <label>
                เกณฑ์ต่ำ
                <input
                  type="number"
                  step="any"
                  value={configForm.alarmLow}
                  onChange={(e) => setConfigForm((f) => ({ ...f, alarmLow: e.target.value }))}
                  placeholder="ไม่เตือน = เว้นว่าง"
                />
              </label>
              <label>
                เกณฑ์สูง
                <input
                  type="number"
                  step="any"
                  value={configForm.alarmHigh}
                  onChange={(e) => setConfigForm((f) => ({ ...f, alarmHigh: e.target.value }))}
                  placeholder="ไม่เตือน = เว้นว่าง"
                />
              </label>
            </div>
          </fieldset>
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
          {/* ปุ่มสองอันคนละระดับ: ขอภาพ = action หลักของขั้นตอนนี้ / ล้างจุด = ทำลาย
              ต้องจางกว่าและอยู่คนละฝั่ง ไม่ให้กดพลาด */}
          <div className="d-calib-row">
            <button
              type="button"
              className="d-calib-primary"
              onClick={requestNewSnap}
              disabled={snapStatus === "waiting"}
            >
              <IconCamera size={16} />
              {snapStatus === "waiting" ? "กำลังรอภาพ..." : "ขอภาพใหม่"}
            </button>
            {calibPoints.length > 0 && (
              <button
                type="button"
                className="d-calib-ghost"
                onClick={() => setCalibPoints([])}
                disabled={snapStatus === "waiting"}
              >
                ล้างจุดทั้งหมด
              </button>
            )}
          </div>
          {snapStatus === "error" && <div className="d-err">{snapError}</div>}

          {calibImgFrameId ? (
            <div className="d-calib-stage">
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
                {/* บอกว่าคลิกได้เฉพาะตอนยังไม่มีจุด — พอเริ่มปักแล้วผู้ใช้รู้แล้ว
                    ไม่ต้องมีข้อความค้างบังภาพตลอด */}
                {calibPoints.length === 0 && (
                  <div className="d-calib-cue">คลิกบนภาพเพื่อปักจุดอ้างอิง</div>
                )}
              </div>
            </div>
          ) : (
            <div className="d-snap">ยังไม่มีภาพให้ calibrate — กด "ขอภาพใหม่" ก่อน</div>
          )}

          {calibPoints.length > 0 && (
            <div className="d-calib-list">
              {calibPoints.map((p, i) => (
                <div className="d-calib-item" key={i}>
                  {/* ตำแหน่ง x/y ไปอยู่ใน title แทนที่จะกินพื้นที่เป็นคอลัมน์ที่ 2 —
                      ของสำคัญในแถวนี้คือ "ค่าจริง" ช่องเดียว ที่เหลือเป็นของประกอบ */}
                  <span
                    className="d-calib-num"
                    title={`ตำแหน่งบนภาพ x=${(p.x * 100).toFixed(0)}% y=${(p.y * 100).toFixed(0)}%`}
                  >
                    {i + 1}
                  </span>
                  <div className="d-calib-field">
                    <input
                      type="number"
                      step="any"
                      value={p.value}
                      placeholder="ค่าที่อ่านได้ ณ จุดนี้"
                      onChange={(e) =>
                        setCalibPoints((pts) => pts.map((q, j) => (j === i ? { ...q, value: e.target.value } : q)))
                      }
                    />
                    {point.unit && <span className="d-calib-unit">{point.unit}</span>}
                  </div>
                  <button
                    type="button"
                    className="d-calib-rm"
                    onClick={() => setCalibPoints((pts) => pts.filter((_, j) => j !== i))}
                    aria-label={`ลบจุดที่ ${i + 1}`}
                    title={`ลบจุดที่ ${i + 1}`}
                  >
                    <IconClose size={14} />
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

      {/* HERO — ค่าปัจจุบัน + ภาพเทียบ อยู่แถวเดียวกัน น้ำหนักจริงจัง (คำถามหลักที่คนเปิดแผงมา)
          value อยู่ซ้าย ภาพอยู่ขวา ทั้งสองอันมีขนาดใหญ่ให้เห็นทันทีไม่ต้องอ่านหา */}
      <section className="d-hero">
        <div className="d-hero-value">
          {unreadable ? (
            <div className="v-unreadable-big">อ่านไม่ออก</div>
          ) : point.value_num !== null ? (
            <div className="d-value-wrap">
              <span className="d-value-num">{formatValue(point.value_num, point.min_value, point.max_value)}</span>
              {point.unit && <span className="d-value-unit">{point.unit}</span>}
            </div>
          ) : point.value_text !== null ? (
            <div className="d-value-text">{point.value_text}</div>
          ) : (
            <div className="d-value-none">ยังไม่มีค่า</div>
          )}
          <div className="d-hero-meta">
            <span>{ageLabel(point.captured_at, now)}</span>
            {hasScale && <span>ช่วง {point.min_value}–{point.max_value}{point.unit ? ` ${point.unit}` : ""}</span>}
            {offline && <span className="d-meta-warn">เครื่องออฟไลน์</span>}
            {!offline && stale && <span className="d-meta-warn">ค่าเก่า</span>}
          </div>
        </div>
        <div className="d-hero-image">
          {hasEvidence ? (
            <img
              src={evidenceSrc}
              alt={`ภาพจากกล้องของ ${point.label ?? point.point_id}`}
              onError={() => setHasEvidence(false)}
            />
          ) : (
            <div className="d-hero-nopic">ยังไม่มีภาพ</div>
          )}
        </div>
      </section>

      {/* TIMELINE — tab บาง underline ไม่ใช่ pill filled ; chart edge-to-edge ไม่ห่อ card */}
      <section className="d-timeline">
        <div className="d-tabs">
          {RANGES.map((r) => (
            <button
              key={r.key}
              className={`d-tab ${range === r.key ? "d-tab-on" : ""}`}
              onClick={() => { touch(); setRange(r.key); }}
            >
              {r.label}
            </button>
          ))}
          {buckets && totals.samples > 0 && (
            <span className="d-tab-summary">
              {totals.samples} ค่า · <b className="q-ok-text">{pct(okCount).toFixed(0)}%</b> ปกติ
              {totals.uncertain > 0 && <> · <b className="q-unc-text">{pct(totals.uncertain).toFixed(0)}%</b> ไม่มั่นใจ</>}
              {totals.unreadable > 0 && <> · <b className="q-bad-text">{pct(totals.unreadable).toFixed(0)}%</b> อ่านไม่ออก</>}
            </span>
          )}
        </div>

        {error && <div className="d-err">โหลดประวัติไม่ได้: {error}</div>}
        {!error && buckets === null && <div className="hc-empty">กำลังโหลด...</div>}
        {!error && buckets && <HistoryChart buckets={buckets} unit={point.unit} />}
      </section>

      {/* META FOOTER — inline mono ; ข้อมูลอ้างอิงทางเทคนิคที่ไม่ควรแข่งกับข้อมูลหลัก
          กราวลง จบเบา ๆ เป็น "รายละเอียดของช่างเทคนิค" ไม่ใช่ 4 กล่องเน้นเท่ากับส่วนหลัก */}
      <footer className="d-meta">
        <span>ต่ำ/สูง ในช่วง <b>{lo !== null ? `${formatValue(lo, point.min_value, point.max_value)}–${formatValue(hi!, point.min_value, point.max_value)}` : "—"}</b></span>
        <span>confidence <b>{point.confidence !== null ? point.confidence.toFixed(2) : "—"}</b></span>
        <span>drift <b>{drift !== null ? `${drift >= 0 ? "+" : ""}${drift.toFixed(1)}s` : "—"}</b></span>
        {point.frame_id && <span className="d-meta-frame">frame {point.frame_id}</span>}
        <span className="d-meta-auto" aria-live="polite">ปิดใน {remaining}s</span>
      </footer>
    </aside>
  );
}
