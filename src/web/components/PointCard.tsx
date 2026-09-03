// การ์ดหนึ่งใบ = หนึ่งจุดวัด
//
// กติกาที่ยึดทั้งไฟล์: **สถานะที่ผิดปกติต้องดูต่างจากค่าปกติทันทีจากระยะไกล**
// จอนี้ไปอยู่บนผนังโรงงาน ไม่มีใครยืนเพ่งอ่านตัวเล็ก ๆ
//
// สี่สถานะที่ห้ามปนกัน:
//   ปกติ        — ตัวเลขใหญ่ สีสว่าง
//   ไม่มั่นใจ    — ตัวเลข + เตือนว่า confidence ต่ำ (ค่ายังใช้ได้แต่ต้องรู้)
//   อ่านไม่ออก   — **ไม่แสดงตัวเลขใด ๆ** เพราะ 0 คือค่าที่อ่านได้จริงในเกือบทุกสเกล
//   ค่าเก่า/ตาย  — หรี่ทั้งใบ + บอกอายุ ไม่ให้เข้าใจผิดว่ากำลังดูค่าปัจจุบัน

import type { PointRow } from "../apiClient";
import type { SparkPoint } from "../useLiveData";
import { Gauge } from "./Gauge";
import { Sparkline } from "./Sparkline";
import { ageLabel, formatValue, isStale } from "../time";

type Props = { point: PointRow; spark: SparkPoint[]; now: number; onOpen?: () => void; selected?: boolean };

export function PointCard({ point, spark, now, onOpen, selected }: Props) {
  const offline = point.device_status !== "ONLINE";
  const stale = isStale(point.captured_at, now);
  const unreadable = point.quality === "UNREADABLE";
  const uncertain = point.quality === "UNCERTAIN";
  const never = point.captured_at === null;

  // ไม่ต้องเช็ค kind เลย — จุดที่ไม่มีสเกล (min/max เป็น null) ไม่มีทางวาดเกจได้อยู่แล้ว
  // ไม่ว่าจะเป็นชนิดไหน (เดิมเคยเช็ค kind !== "LAMP" เพิ่ม แต่ WATER_METER ก็ไม่มีสเกลเหมือนกัน
  // ผูกกับ kind เฉพาะเจาะจงแบบนั้นจะต้องคอยตามแก้ทุกครั้งที่มีชนิดใหม่)
  const hasScale = point.min_value !== null && point.max_value !== null;
  const showGauge = hasScale;
  const over =
    point.value_num !== null && hasScale && (point.value_num < point.min_value! || point.value_num > point.max_value!);

  // ลำดับสำคัญ: ความเก่า/ตายของข้อมูลต้องมาก่อนคุณภาพของค่าเสมอ
  // ถ้าให้ unreadable มาก่อน stale การ์ดที่ "อ่านไม่ออกเมื่อนาทีที่แล้วแล้วเงียบไปเลย"
  // จะไม่ถูกหรี่ ดูเหมือนเพิ่งอ่านไม่ออกเมื่อกี้ ทั้งที่ข้อมูลทั้งใบเชื่อไม่ได้แล้ว
  const state = never
    ? "never"
    : offline
      ? "offline"
      : stale
        ? "stale"
        : unreadable
          ? "unreadable"
          : over
            ? "over"
            : uncertain
              ? "uncertain"
              : "ok";

  // ข้อความ banner — "never" ไม่มี banner เพราะขอบประเฉย ๆ ก็สื่อพอแล้วว่า
  // "ยังไม่เคยมีข้อมูล" (สถานะเป็นกลาง) ต่างจากสถานะอื่นที่ "ผิดปกติ" จริง ๆ
  const bannerText =
    state === "unreadable"
      ? "อ่านไม่ออก"
      : state === "over"
        ? "เกินสเกล"
        : state === "uncertain"
          ? "ไม่มั่นใจ"
          : state === "offline"
            ? "เครื่องออฟไลน์"
            : state === "stale"
              ? "ค่าเก่า"
              : null;

  const confPct = point.confidence !== null ? Math.round(point.confidence * 100) : null;

  return (
    <article
      className={`card card-${state}${selected ? " card-selected" : ""}${onOpen ? " card-clickable" : ""}`}
      // ใช้ role/tabIndex แทน <button> เพราะการ์ดมีโครงสร้างซ้อนหลายชั้น
      // ห่อด้วยปุ่มจะทำให้ semantics ข้างในเพี้ยน — แต่ต้องรับคีย์บอร์ดเองให้ครบ
      {...(onOpen
        ? {
            role: "button",
            tabIndex: 0,
            onClick: onOpen,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
              }
            },
          }
        : {})}
    >
      {bannerText && <div className="banner">{bannerText}</div>}

      <div className="card-inner">
        <header className="card-head">
          <h2>{point.label ?? point.point_id}</h2>
          <span className="card-id">{point.point_id}</span>
        </header>

        <div className="card-body">
          {showGauge && (
            <Gauge
              value={unreadable ? null : point.value_num}
              min={point.min_value!}
              max={point.max_value!}
              unreadable={unreadable || never}
              uncertain={uncertain}
            />
          )}

          <div className="card-value">
            {never ? (
              <span className="v-none">ยังไม่มีค่า</span>
            ) : unreadable ? (
              // ตั้งใจไม่โชว์ตัวเลขใด ๆ ที่นี่ — เขียน 0 หรือ "-" ที่ดูเหมือนตัวเลข
              // จะทำให้คนอ่านผิดว่าค่าตกลงไปจริง
              <span className="v-unreadable">อ่านไม่ออก</span>
            ) : point.value_num !== null ? (
              <>
                <span className="v-num">{formatValue(point.value_num, point.min_value, point.max_value)}</span>
                {point.unit && <span className="v-unit">{point.unit}</span>}
              </>
            ) : (
              <span className="v-text">{point.value_text}</span>
            )}
          </div>
        </div>

        <div className="card-spark">
          <Sparkline data={spark} />
        </div>

        {confPct !== null && (
          <div className="conf">
            <div className="conf-row">
              <span>ความมั่นใจ</span>
              <span>{confPct}%</span>
            </div>
            <div className="conf-track">
              <i
                className="conf-fill"
                style={{
                  width: `${confPct}%`,
                  background: unreadable
                    ? "var(--bad)"
                    : over
                      ? "var(--over)"
                      : uncertain
                        ? "var(--uncertain)"
                        : "var(--ok)",
                }}
              />
            </div>
          </div>
        )}

        <footer className="card-foot">
          {/* badge สถานะคุณภาพ (ออฟไลน์/ค่าเก่า/ไม่มั่นใจ/เกินสเกล) ย้ายไปขึ้น banner ด้านบนแล้ว
              เหลือ "ยังไม่ตั้งค่า" ไว้เพราะเป็นคนละแกน (สถานะ config ไม่ใช่คุณภาพข้อมูล)
              ยังต้องมีที่ทางของมันแม้การ์ดจะดู "ok" อยู่ก็ตาม */}
          <span className="badges">{point.enabled === false && <b className="badge b-new">ยังไม่ตั้งค่า</b>}</span>
          <span className="card-age">
            {ageLabel(point.captured_at, now)}
            {hasScale && (
              <span className="card-range">
                {" · "}
                {point.min_value}–{point.max_value}
                {point.unit ? ` ${point.unit}` : ""}
              </span>
            )}
          </span>
        </footer>
      </div>
    </article>
  );
}
