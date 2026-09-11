// พิสูจน์กติกาการตัดสิน "ค่าผิดปกติ" ของ ingest/alarm.ts (D-023 / T-024)
//
//   bun run smoke-alarm        # ไม่ต้องมี broker/postgres — ตรรกะเป็น pure function
//
// เทสระดับนี้จับได้ 3 กติกาที่ถ้าพังแล้ว "ดูเหมือนทำงาน" แต่ใช้จริงไม่ได้:
// เด้งทุกเฟรม (ท่วมจอ) · ค่าวูบเดียวปลุกทั้งโรงงาน · UNREADABLE ถูกนับเป็นค่าเกิน
// ส่วนการเขียน DB + SSE ทดสอบแยกตอน stack ขึ้น (ดู CHANGELOG ของ T-024)

import { evaluateAlarm, resetAlarmMemory, alarmConfig, type AlarmThresholds } from "../src/server/ingest/alarm";

const N = alarmConfig.confirm_readings;
console.log(`ALARM_CONFIRM_READINGS = ${N}\n`);

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed += 1;
};

const thr = (state: "OK" | "ALARM" | null = null): AlarmThresholds => ({ low: 100, high: 150, state });
const feed = (id: string, values: (number | null)[], quality: "OK" | "UNREADABLE" = "OK", t: AlarmThresholds = thr()) =>
  values.map((v) => evaluateAlarm(id, v, quality, t));
const transitions = (rs: ReturnType<typeof evaluateAlarm>[]) => rs.filter((r) => r !== null);

// ---- 1. จุดใหม่ ค่าปกติ → ต้องได้ OK หลังครบ N ไม่ใช่ทันที และได้ครั้งเดียว ----
resetAlarmMemory();
{
  const rs = feed("p1", [120, 120, 120, 120, 120]);
  const ts = transitions(rs);
  check("ค่าปกติ N ครั้งแรก → เปลี่ยนเป็น OK ครั้งเดียว", ts.length === 1 && ts[0]!.to === "OK");
  check("ไม่เปลี่ยนก่อนครบ N", rs.slice(0, N - 1).every((r) => r === null));
  check("หลังจากนั้นค่าปกติต่ออีก 100 ครั้ง → ไม่มี event", transitions(feed("p1", Array(100).fill(120))).length === 0);
}

// ---- 2. ค่าเกินค้างนาน → เด้งครั้งเดียว ไม่ใช่ทุกเฟรม (กันท่วมจอ) ----
resetAlarmMemory();
{
  feed("p2", [120, 120, 120]); // → OK
  const rs = feed("p2", Array(200).fill(160));
  const ts = transitions(rs);
  check("เกินเกณฑ์ค้าง 200 เฟรม → ALARM ครั้งเดียว", ts.length === 1 && ts[0]!.to === "ALARM", `ได้ ${ts.length} event`);
  check("event เกิดที่เฟรมที่ N พอดี", rs[N - 1] !== null && rs.slice(0, N - 1).every((r) => r === null));
  check("จด from/to/value ถูก", ts[0]!.from === "OK" && ts[0]!.value === 160);
}

// ---- 3. ค่าวูบเดียว (OCR อ่านพลาด) → ไม่เปลี่ยนสถานะ ----
resetAlarmMemory();
{
  feed("p3", [120, 120, 120]); // → OK
  const ts = transitions(feed("p3", [999, 120, 120, 999, 120]));
  check("ค่าเพี้ยน 999 วูบเดียวแทรกค่าปกติ → ไม่เด้ง", ts.length === 0, `ได้ ${ts.length} event`);
}

// ---- 4. แกว่งรอบขอบเกณฑ์ → ไม่เด้งรัว ----
resetAlarmMemory();
{
  feed("p4", [120, 120, 120]); // → OK
  const ts = transitions(feed("p4", [99.9, 100.1, 99.9, 100.1, 99.9, 100.1, 99.9, 100.1]));
  check("สลับ 99.9/100.1 แปดครั้ง → ไม่เด้งเลย", ts.length === 0, `ได้ ${ts.length} event`);
}

// ---- 5. กลับเข้าเกณฑ์ → กลับ OK ครั้งเดียว หลังครบ N ----
resetAlarmMemory();
{
  feed("p5", [120, 120, 120]); // OK
  feed("p5", [160, 160, 160]); // ALARM
  const rs = feed("p5", [120, 120, 120, 120]);
  const ts = transitions(rs);
  check("กลับเข้าเกณฑ์ → OK ครั้งเดียว", ts.length === 1 && ts[0]!.from === "ALARM" && ts[0]!.to === "OK");
}

// ---- 6. UNREADABLE ไม่ประเมิน ไม่นับ ไม่รีเซ็ต ----
resetAlarmMemory();
{
  feed("p6", [120, 120, 120]); // OK
  const a = feed("p6", [160, 160]); // สะสม 2/3
  const u = feed("p6", [null, null, null], "UNREADABLE"); // แทรก
  const b = feed("p6", [160]); // ครบ 3 → ต้องเด้ง
  check("UNREADABLE ไม่ทำให้เกิด event", transitions(u).length === 0);
  check("UNREADABLE ไม่รีเซ็ตตัวนับ — ค่าเกินครั้งที่ 3 หลังแทรกยังเด้ง", transitions([...a, ...b]).length === 1 && b[0]?.to === "ALARM");
  check("UNREADABLE ยาว ๆ ไม่เปลี่ยนสถานะ (ค้างที่ ALARM)", transitions(feed("p6", Array(50).fill(null), "UNREADABLE")).length === 0);
}

// ---- 7. ไม่มีเกณฑ์ → ไม่ประเมิน ; ถอนเกณฑ์ → เคลียร์สถานะทันที ----
resetAlarmMemory();
{
  const none = { low: null, high: null, state: null };
  check("ไม่มีเกณฑ์ → ไม่มี event แม้ค่าจะ 9999", transitions(feed("p7", [9999, 9999, 9999, 9999], "OK", none)).length === 0);

  feed("p8", [160, 160, 160]); // ALARM
  const rs = feed("p8", [160], "OK", none); // ถอนเกณฑ์
  const ts = transitions(rs);
  check("ถอนเกณฑ์ขณะ ALARM → เคลียร์เป็น null ทันที ไม่รอ N", ts.length === 1 && ts[0]!.from === "ALARM" && ts[0]!.to === null);
  check("ถอนซ้ำ → ไม่มี event เพิ่ม", transitions(feed("p8", [160], "OK", none)).length === 0);
}

// ---- 8. seed จาก DB — restart แล้วจุดที่ ALARM อยู่ต้องไม่เด้งซ้ำ ----
resetAlarmMemory();
{
  const ts = transitions(feed("p9", Array(20).fill(160), "OK", thr("ALARM")));
  check("seed = ALARM + ค่ายังเกิน → ไม่เด้งซ้ำหลัง restart", ts.length === 0, `ได้ ${ts.length} event`);
  const back = transitions(feed("p9", [120, 120, 120], "OK", thr("ALARM")));
  check("seed = ALARM + ค่ากลับปกติ → เด้ง OK ครั้งเดียว", back.length === 1 && back[0]!.to === "OK");
}

// ---- 9. ขอบเกณฑ์นับเป็น "ใน" (ปิดช่วง) ----
resetAlarmMemory();
{
  const ts = transitions(feed("p10", [100, 150, 100, 150]));
  check("ค่าเท่าขอบพอดี (100, 150) = ปกติ", ts.length === 1 && ts[0]!.to === "OK");
}

console.log(failed === 0 ? "\n✅ ผ่านครบ" : `\n❌ ตก ${failed} ข้อ`);
process.exit(failed === 0 ? 0 : 1);
