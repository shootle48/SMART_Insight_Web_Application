// ตรวจคู่สีใน styles.css ว่าผ่าน WCAG 2.2 AA ไหม
//
//   bun run check-contrast
//
// ทำไมต้องมี: นี่เป็นบั๊ก contrast รอบที่ 3 ของโปรเจกต์แล้ว (D-014 audit → D-015 ธีมมืด →
// T-021/D-021 ปุ่มหลัก) ทุกรอบเจอเพราะ "บังเอิญไปตรวจ" ไม่ใช่เพราะมีอะไรเตือน
// การกะด้วยตาจับไม่ได้ — สีที่ดูคอนทราสต์ดีมากอย่างส้มสดบนขาวได้แค่ 2.86:1
//
// **อ่านค่าจาก styles.css จริงเสมอ ห้ามพิมพ์ค่าสีซ้ำลงในไฟล์นี้** — ถ้าพิมพ์ซ้ำ วันที่มีคนแก้
// token แล้วลืมแก้สคริปต์ จะได้ผลลวงว่ายังผ่านอยู่ ซึ่งแย่กว่าไม่มีสคริปต์เลย
//
// เกณฑ์: ตัวหนังสือปกติ ≥4.5:1 (AA) · องค์ประกอบ UI/ขอบที่ต้องมองเห็น ≥3:1 (WCAG 1.4.11)

const css = await Bun.file(new URL("../src/web/styles.css", import.meta.url)).text();

const grab = (re: RegExp) => css.match(re)?.[1] ?? "";
const lightBlock = grab(/:root\s*\{([\s\S]*?)\n\}/);
const darkBlock = grab(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);

const tok = (block: string, name: string) =>
  block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1];

/** `--x: rgba(r,g,b,a)` — คืน [r,g,b,a] ไว้ composite ทับพื้นก่อนคำนวณ */
const tokRgba = (block: string, name: string) => {
  const m = block.match(
    new RegExp(`--${name}:\\s*rgba\\(\\s*([0-9]+)\\s*,\\s*([0-9]+)\\s*,\\s*([0-9]+)\\s*,\\s*([0-9.]+)\\s*\\)`),
  );
  return m ? ([+m[1]!, +m[2]!, +m[3]!, +m[4]!] as const) : null;
};

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");
/** สีโปร่งแสงทับพื้นทึบ → สีทึบที่ตาเห็นจริง ; ถ้าไม่ composite จะคำนวณ contrast ไม่ได้เลย */
const composite = (fg: readonly [number, number, number, number], bgHex: string) => {
  const n = parseInt(bgHex.replace("#", ""), 16);
  const bg = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const [r, g, b, a] = fg;
  return `#${[r, g, b].map((c, i) => hex2(c * a + bg[i]! * (1 - a))).join("")}`;
};

const declared = (block: string, name: string) => new RegExp(`--${name}:`).test(block);

/**
 * ธีมมืด override เฉพาะบางตัว — ที่ไม่ override ให้ตกกลับไปใช้ค่าธีมสว่าง (ตามที่ CSS ทำจริง)
 *
 * ⚠️ ต้องแยก "ธีมมืดไม่ได้ override" ออกจาก "override แล้วแต่เป็น rgba()/color-mix()"
 * ให้ได้ ไม่งั้นกรณีหลังจะ fallback ไปวัดค่าธีมสว่างเงียบ ๆ แล้วรายงานว่าผ่านทั้งที่วัดผิดตัว
 * (เจอจริงตอน T-022: `--line` ธีมมืดเป็น rgba แล้วสคริปต์ไปวัด hex ของธีมสว่างแทน)
 * — สคริปต์ที่โกหกแย่กว่าไม่มีสคริปต์ กรณีนี้จึงต้อง "ข้าม" ไม่ใช่ "เดา"
 */
const val = (name: string, theme: "light" | "dark") => {
  if (theme === "light") return tok(lightBlock, name);
  if (declared(darkBlock, name)) return tok(darkBlock, name); // undefined ถ้าไม่ใช่ hex → ข้าม
  return tok(lightBlock, name);
};

const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const lum = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a: string, b: string) => {
  const la = lum(a);
  const lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

/** [คำอธิบาย, token หน้า, token พื้น, เกณฑ์ขั้นต่ำ] — ใส่เฉพาะคู่ที่ "ถ้าพังแล้วอ่านไม่ออกจริง"
 *  ไม่ใช่ทุกคู่ที่เป็นไปได้ ไม่งั้นจะมีเสียงรบกวนจนไม่มีใครรันมัน */
type Pair = [label: string, fg: string, bg: string, min: number];
const PAIRS: Pair[] = [
  // --- ตัวหนังสือ (≥4.5) ---
  ["ตัวหนังสือหลักบนพื้นหน้า", "text", "bg", 4.5],
  ["ตัวหนังสือหลักบนพื้นการ์ด", "text", "surface", 4.5],
  ["ตัวหนังสือรองบนพื้นหน้า", "muted", "bg", 4.5],
  ["ตัวหนังสือรองบนพื้นการ์ด", "muted", "surface", 4.5],
  ["ค่าเก่า/ออฟไลน์บนพื้นการ์ด", "dead", "surface", 4.5],
  // สีสถานะเมื่อเป็นตัวหนังสือ — D-014 เจอว่าชุดจาก design doc ตกหมดตอนอยู่บนพื้นสว่าง
  ["สถานะปกติ (ok) เป็นตัวหนังสือ", "ok", "surface", 4.5],
  ["สถานะไม่แน่ใจ เป็นตัวหนังสือ", "uncertain", "surface", 4.5],
  ["สถานะเกินสเกล เป็นตัวหนังสือ", "over", "surface", 4.5],
  ["สถานะผิดพลาด เป็นตัวหนังสือ", "bad", "surface", 4.5],
  ["ลิงก์/ข้อมูล (info) เป็นตัวหนังสือ", "info", "surface", 4.5],
  // tag "ผิดปกติ" พื้นทึบ (T-025) — ตัวอักษร --on-banner บนพื้น --bad
  ["tag ผิดปกติ: ตัวอักษรบนพื้นทึบ", "on-banner", "bad", 4.5],
  // ปุ่มหลัก (D-021)
  ["ปุ่มหลัก: ตัวอักษรบนพื้นปุ่ม", "on-primary-btn", "primary-btn", 4.5],
  ["ปุ่มหลัก hover: ตัวอักษรบนพื้น", "on-primary-btn", "primary-btn-hover", 4.5],
  // --- องค์ประกอบที่ไม่ใช่ตัวหนังสือ (≥3) ---
  ["เส้นขอบโครงสร้างบนพื้นการ์ด", "line", "surface", 3],
  ["ปุ่มหลักแยกจากพื้นการ์ด", "primary-btn", "surface", 3],
  ["ปุ่มสลับธีม active: ไอคอนบนปุ่ม", "on-primary", "primary", 3],
  ["ปุ่มสลับธีม active: แยกจากแถบบน", "primary", "shell", 3],
];

/** คู่ที่ "ตกอยู่แล้วตั้งแต่ก่อนมีสคริปต์นี้" — เจอครั้งแรกตอนรันครั้งแรกสุด (T-022 รับไปแก้)
 *
 * มีรายการนี้เพราะถ้าปล่อยให้สคริปต์แดงค้าง จะไม่มีใครรันมันอีกเลย แล้วของใหม่ที่พัง
 * ก็จะหลุดไปด้วย ; แบบนี้สคริปต์ยังจับ **ของใหม่** ได้ตั้งแต่วันนี้ โดยไม่กลบว่ายังมีของเก่าค้าง
 * 🔴 ลบรายการออกทีละอันเมื่อแก้จริง — ห้ามเติมของใหม่เข้ามาเพื่อให้ผ่าน */
const KNOWN_FAIL = new Set<string>([
  // ว่างแล้ว — 4 คู่ที่เคยตกถูกแก้ครบที่ T-022 (2026-09-10)
]);

let failed = 0;
let known = 0;
let fixed = 0;
let skipped = 0;
for (const theme of ["light", "dark"] as const) {
  console.log(`\n── ธีม${theme === "light" ? "สว่าง" : "มืด"} ──`);
  for (const [label, fgName, bgName, min] of PAIRS) {
    const bg = val(bgName, theme);
    // token โปร่งแสงต้อง composite ทับพื้นก่อน ถึงจะได้สีที่ตาเห็นจริง
    // (ธีมมืดใช้ rgba กับ --line / --panel — ถ้าไม่ทำตรงนี้จะกลายเป็นรูที่ไม่มีใครตรวจ
    //  ทั้งที่ D-014 เคยเจอ --line ตกหนักสุด 1.36:1)
    const fgBlock = theme === "dark" && declared(darkBlock, fgName) ? darkBlock : lightBlock;
    const rgba = tokRgba(fgBlock, fgName);
    const fg = rgba && bg ? composite(rgba, bg) : val(fgName, theme);
    // ที่เหลือคำนวณตรง ๆ ไม่ได้ (เช่น color-mix) — ข้ามแล้วบอกให้รู้ ดีกว่าแกล้งคำนวณ
    if (!fg || !bg) {
      console.log(`  ⏭️  ข้าม (--${fgName} หรือ --${bgName} ไม่ใช่ค่า hex ตรง ๆ)  ${label}`);
      skipped++;
      continue;
    }
    const r = ratio(fg, bg);
    const ok = r >= min;
    const isKnown = KNOWN_FAIL.has(`${theme}:${label}`);
    let mark: string;
    if (ok && isKnown) {
      mark = "🎉";
      fixed++;
    } else if (ok) {
      mark = "✅";
    } else if (isKnown) {
      mark = "⚠️ ";
      known++;
    } else {
      mark = "❌";
      failed++;
    }
    console.log(
      `  ${mark} ${r.toFixed(2).padStart(5)}:1 (ต้อง ≥${min})  ${label}  ${fg} บน ${bg}`,
    );
  }
}

console.log("");
if (skipped) console.log(`⏭️  ข้าม ${skipped} คู่ (token ไม่ใช่ hex — ต้องตรวจด้วยตาเอง)`);
if (known) console.log(`⚠️  ตกอยู่แล้วตั้งแต่ก่อนมีสคริปต์นี้ ${known} คู่ — T-022 รับไปแก้`);
if (fixed) console.log(`🎉 ${fixed} คู่ที่เคยตกผ่านแล้ว — ลบออกจาก KNOWN_FAIL ในไฟล์นี้ได้เลย`);
console.log(failed === 0 ? "✅ ไม่มีของใหม่ที่พัง" : `❌ พังใหม่ ${failed} คู่ — ต้องแก้ก่อน commit`);
process.exit(failed === 0 ? 0 : 1);
