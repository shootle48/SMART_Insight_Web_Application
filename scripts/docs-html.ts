// รวมเอกสารทั้งชุดเป็น HTML ไฟล์เดียวไว้อ่านย้อนหลัง
//
//   bun run docs-html
//
// ทำไมต้องมี: ไฟล์ .md อ่านสะดวกสำหรับ AI แต่คนอ่านย้อนหลังบนจอ/มือถืออ่านยาก
// (TICKETS.md 31KB · DECISIONS.md 53KB · CHANGELOG.md 99KB) — ตัว .md ยังเป็นต้นฉบับเสมอ
// ไฟล์นี้แค่แปลงออกมาอ่าน ไม่ใช่แหล่งข้อมูลที่สอง ห้ามแก้ผลลัพธ์ด้วยมือ
//
// **ไม่ลง dependency** — เขียน markdown renderer เองเท่าที่เอกสารชุดนี้ใช้จริง
// (เหตุผลเดียวกับ D-009 ที่เขียน SVG เองแทนลง Recharts: ของที่ต้องการเล็กกว่าไลบรารีมาก
// และ Pi/ผู้ดูแลไม่ต้องรับภาระ dep เพิ่มเพื่องานที่รันปีละไม่กี่ครั้ง)
//
// ⚠️ renderer นี้จงใจ **ไม่ทำกฎ "ย่อหน้า 4 ช่อง = code block"** ของ markdown มาตรฐาน
// เพราะ TICKETS.md/DECISIONS.md ใช้ย่อหน้าแบบแขวน (`why:` แล้วบรรทัดถัดไปย่อหน้าลึก)
// ถ้าใช้กฎนั้นทั้งสองไฟล์จะกลายเป็นกล่องโค้ดทั้งไฟล์

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DOCS = join(ROOT, "docs");
const OUT = join(DOCS, "DOCS.html");

/** คำอธิบายบทบาทของแต่ละไฟล์ — ยกมาจาก CLAUDE.md หัวข้อ "เปิดเมื่อเกี่ยวข้อง" */
const ROLE: Record<string, string> = {
  "HANDOFF.md": "สถานะเครื่อง · ของค้าง · กับดัก — อ่านก่อนเริ่ม session",
  "CLAUDE.md": "กฎการทำงาน + โปรเจกต์นี้คืออะไร",
  "ROADMAP-PACKAGE.md": "แผนที่เส้นทางไปสู่ขายเป็น package ต่อโรงงาน",
  "TICKETS.md": "backlog — ใบถัดไปที่ต้องทำ",
  "DECISIONS.md": "ตัดสินใจอะไร เพราะอะไร (ADR-lite)",
  "CHANGELOG.md": "ประวัติงานที่ทำแล้ว",
  "ARCHITECTURE.md": "ภาพรวม + data flow + ขอบเขต layer",
  "DEPLOYMENT.md": "ขั้นตอนเอาขึ้น Pi + กับดักที่เจอมาแล้ว",
  "WORKFLOW.md": "plan → design → tickets → ทำทีละใบ",
  "AI-GUIDE.md": "พฤติกรรมที่คาดหวังจาก AI",
  "PUBLISHING-GUIDE.md": "คู่มือ publish สำหรับทีม AI (ฝั่ง edge)",
  "SNAPSHOT-PROPOSAL.md": "ข้อเสนอเรื่องส่งภาพ snapshot (เคาะแล้ว D-013)",
  "CALIBRATION-PROPOSAL.md": "ข้อเสนอ calibrate จุดวัดจาก UI (D-017/D-018)",
};

/** ลำดับที่อยากให้โผล่ในสารบัญ — ที่ไม่อยู่ในนี้ต่อท้ายตามตัวอักษร */
const ORDER = [
  "HANDOFF.md",
  "CLAUDE.md",
  "ROADMAP-PACKAGE.md",
  "TICKETS.md",
  "DECISIONS.md",
  "CHANGELOG.md",
  "ARCHITECTURE.md",
  "DEPLOYMENT.md",
  "WORKFLOW.md",
  "AI-GUIDE.md",
  "PUBLISHING-GUIDE.md",
  "SNAPSHOT-PROPOSAL.md",
  "CALIBRATION-PROPOSAL.md",
];

// ---------- markdown → html ----------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** ฟิลด์ที่ใช้จริงใน TICKETS.md / DECISIONS.md — เรนเดอร์เป็น field label ไม่ใช่ข้อความเว้นวรรค */
const FIELD =
  /^(why|scope|done-when|note|progress|files|done|เลือก|แทนที่จะ|เพราะ|trade-off|ทบทวนเมื่อ|สิ่งที่เจอระหว่างทำ|status|type|blocked by)\s*:\s*(.*)$/i;

/** inline: `code` · **bold** · [text](url) — ทำหลัง escape แล้วเสมอ */
function inline(s: string): string {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, (_m, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, href) => {
    if (/^https?:/.test(href)) return `<a href="${href}" target="_blank" rel="noopener">${t}</a>`;
    // ลิงก์ข้ามไฟล์ .md — ทุกไฟล์อยู่ในหน้าเดียวกันแล้ว จึงกระโดดถึงกันได้จริง
    const md = /([A-Za-z0-9_-]+)\.md(?:#|$)/.exec(href);
    if (md) return `<a class="xdoc" href="#doc-${md[1]!.toLowerCase()}">${t}</a>`;
    return `<span class="ref">${t}</span>`;
  });
  // T-0NN / D-0NN / OPEN-N — คำศัพท์ประจำเอกสารชุดนี้ ทำให้กวาดตาหาได้
  out = out.replace(/\b([TD]-\d{3}|OPEN-\d+)\b/g, '<span class="id">$1</span>');
  return out;
}

type Block = { html: string };

function render(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;

  const flushList = (items: string[], ordered: boolean) => {
    if (!items.length) return;
    out.push(`<${ordered ? "ol" : "ul"}>${items.map((x) => `<li>${x}</li>`).join("")}</${ordered ? "ol" : "ul"}>`);
    items.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i]!;

    // --- fenced code ---
    if (/^\s*```/.test(line)) {
      const lang = line.replace(/^\s*```/, "").trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) buf.push(lines[i++]!);
      i++;
      out.push(
        `<div class="code-wrap"><pre><code${lang ? ` data-lang="${esc(lang)}"` : ""}>${esc(buf.join("\n"))}</code></pre></div>`,
      );
      continue;
    }

    // --- html comment (กติกาที่ผู้เขียนจดไว้ให้คนอ่านทีหลัง — เก็บไว้แต่ทำให้เงียบ) ---
    if (/^\s*<!--/.test(line)) {
      const buf: string[] = [];
      let l = line;
      while (i < lines.length && !/-->/.test(l)) {
        buf.push(l);
        l = lines[++i] ?? "";
      }
      buf.push(l);
      i++;
      const text = buf.join("\n").replace(/<!--/, "").replace(/-->/, "").trim();
      if (text) out.push(`<aside class="authoring-note">${inline(text).replace(/\n/g, "<br>")}</aside>`);
      continue;
    }

    // --- table ---
    if (/^\s*\|/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const cells = (row: string) =>
        row
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i]!)) body.push(cells(lines[i++]!));
      const thead = head.some((h) => h)
        ? `<thead><tr>${head.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead>`
        : "";
      out.push(
        `<div class="table-wrap"><table>${thead}<tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      );
      continue;
    }

    // --- heading ---
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1]!.length;
      const text = h[2]!;
      const id = slug(text);
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // --- hr ---
    if (/^\s*---+\s*$/.test(line)) {
      out.push("<hr>");
      i++;
      continue;
    }

    // --- blockquote ---
    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i]!)) buf.push(lines[i++]!.replace(/^\s*>\s?/, ""));
      out.push(`<blockquote>${inline(buf.join(" "))}</blockquote>`);
      continue;
    }

    // --- field block (why: / เลือก: / ...) — เฉพาะเอกสารชุดนี้ ---
    const f = FIELD.exec(line);
    if (f) {
      const label = f[1]!;
      const buf = [f[2]!];
      i++;
      // บรรทัดต่อเนื่องคือบรรทัดที่ย่อหน้าลึกและไม่ใช่ฟิลด์ใหม่
      while (i < lines.length) {
        const nx = lines[i]!;
        if (!/^\s{4,}\S/.test(nx) || FIELD.test(nx.trim())) break;
        buf.push(nx.trim());
        i++;
      }
      out.push(
        `<div class="field"><div class="field-label">${esc(label)}</div><div class="field-body">${inline(
          buf.join(" "),
        )}</div></div>`,
      );
      continue;
    }

    // --- list ---
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: string[] = [];
      const ordered = /^\s*\d+\.\s/.test(line);
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        const indent = (/^(\s*)/.exec(lines[i]!) ?? ["", ""])[1]!.length;
        const buf = [lines[i]!.replace(/^\s*([-*]|\d+\.)\s+/, "")];
        i++;
        // บรรทัดต่อเนื่องของ bullet เดิม (ย่อหน้าลึกกว่าและไม่ใช่ bullet ใหม่)
        while (
          i < lines.length &&
          lines[i]!.trim() !== "" &&
          !/^\s*([-*]|\d+\.)\s+/.test(lines[i]!) &&
          (/^(\s*)/.exec(lines[i]!) ?? ["", ""])[1]!.length > indent
        ) {
          buf.push(lines[i++]!.trim());
        }
        items.push(inline(buf.join(" ")));
      }
      flushList(items, ordered);
      continue;
    }

    // --- ว่าง ---
    if (line.trim() === "") {
      i++;
      continue;
    }

    // --- ย่อหน้า ---
    const buf = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i]!.trim() !== "" &&
      !/^\s*([-*#>|]|\d+\.|```|---+\s*$|<!--)/.test(lines[i]!) &&
      !FIELD.test(lines[i]!.trim())
    ) {
      buf.push(lines[i++]!.trim());
    }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }

  return out.join("\n");
}

let slugSeen = new Set<string>();
function slug(s: string): string {
  const base =
    "h-" +
    s
      .toLowerCase()
      .replace(/[`*_[\]()]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  let id = base;
  let n = 2;
  while (slugSeen.has(id)) id = `${base}-${n++}`;
  slugSeen.add(id);
  return id;
}

// ---------- เก็บไฟล์ ----------

const found: { file: string; path: string; md: string }[] = [];
for (const name of ["HANDOFF.md", "CLAUDE.md"]) {
  const p = join(ROOT, name);
  if (existsSync(p)) found.push({ file: name, path: p, md: readFileSync(p, "utf8") });
}
for (const name of readdirSync(DOCS).filter((f) => f.endsWith(".md"))) {
  found.push({ file: name, path: join(DOCS, name), md: readFileSync(join(DOCS, name), "utf8") });
}
found.sort((a, b) => {
  const ia = ORDER.indexOf(a.file);
  const ib = ORDER.indexOf(b.file);
  return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.file.localeCompare(b.file);
});

// ฟอนต์ไทยไม่มีหัว — ฝังมาในไฟล์เลย ให้เปิดที่ไหนก็ได้ตัวเดียวกัน ไม่พึ่ง CDN
const fontFaces = [400, 600, 700]
  .map((w) => {
    const p = join(ROOT, "src/web/public/fonts", `noto-sans-thai-${w}.woff2`);
    if (!existsSync(p)) return "";
    const b64 = readFileSync(p).toString("base64");
    return `@font-face{font-family:"Noto Sans Thai";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");unicode-range:U+02D7,U+0303,U+0331,U+0E01-0E5B,U+200C-200D,U+25CC}`;
  })
  .join("\n");

const docs = found.map((d) => {
  slugSeen = new Set<string>();
  const id = "doc-" + d.file.replace(/\.md$/, "").toLowerCase();
  return {
    id,
    file: d.file,
    role: ROLE[d.file] ?? "",
    kb: Math.round(Buffer.byteLength(d.md, "utf8") / 1024),
    html: render(d.md),
    plain: d.md.toLowerCase(),
  };
});

const generated = new Date().toISOString().slice(0, 10);

const html = `<title>Meter Docs</title>
<style>
${fontFaces}

:root{
  --bg:#faf8f5; --surface:#f1eeea; --panel:#ffffff; --panel-hi:#e8e4df;
  --line-soft:#e3e0dd; --line:#8f9495;
  --text:#423d38; --muted:#797067;
  --ok:#016630; --uncertain:#874b00; --bad:#ba1a1a; --info:#1447e6;
  --primary:#ff6b00;
  --shell:#2f2a26; --on-shell:#ffffff; --on-shell-muted:rgba(255,255,255,.68);
  --shell-line:rgba(255,255,255,.1);
  --code-bg:#e8e4df;
  --r-sm:3px; --r-pill:9999px;
  --mono:ui-monospace,"DejaVu Sans Mono","Cascadia Mono",monospace;
  --sans:"Segoe UI",system-ui,-apple-system,"Noto Sans Thai","Noto Sans",sans-serif;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --bg:#33302c; --surface:#413830; --panel:#3a332c; --panel-hi:#4a4038;
    --line-soft:rgba(255,255,255,.08); --line:rgba(255,255,255,.36);
    --text:#fafaf9; --muted:#b9b3ac;
    --ok:#00e1ab; --uncertain:#ffba20; --bad:#ffb4ab; --info:#a2c9ff;
    --primary:#ff8933;
    --shell:#241f1b; --code-bg:#2b2621;
  }
}
:root[data-theme="dark"]{
  --bg:#33302c; --surface:#413830; --panel:#3a332c; --panel-hi:#4a4038;
  --line-soft:rgba(255,255,255,.08); --line:rgba(255,255,255,.36);
  --text:#fafaf9; --muted:#b9b3ac;
  --ok:#00e1ab; --uncertain:#ffba20; --bad:#ffb4ab; --info:#a2c9ff;
  --primary:#ff8933;
  --shell:#241f1b; --code-bg:#2b2621;
}

*{box-sizing:border-box}
/* ขนาด/ระยะบรรทัดตั้งตามภาษาไทยเป็นหลัก ไม่ใช่ Latin:
   ไทยซ้อนได้ 4 ชั้นในบรรทัดเดียว (สระบน+วรรณยุกต์ / สระล่าง) — ค่าที่พอดีกับอังกฤษ (~1.6)
   ทำให้วรรณยุกต์บรรทัดบนเกือบชนสระล่างบรรทัดล่าง อ่านแล้วลายตา ; และ Noto Sans Thai
   x-height เล็กกว่า Segoe UI ที่ px เท่ากัน จึงต้องตั้งฐานใหญ่กว่าที่ใช้กับเอกสารอังกฤษ */
body{margin:0;background:var(--bg);color:var(--text);font-family:var(--sans);
  font-size:16.5px;line-height:1.7;-webkit-font-smoothing:antialiased;
  -webkit-text-size-adjust:100%}

/* shell มืดคาดบน ครอบ workspace สว่าง — signature ของ D-019 */
.shell{background:var(--shell);color:var(--on-shell);border-bottom:1px solid var(--shell-line);
  position:sticky;top:0;z-index:10}
.shell-in{max-width:1080px;margin:0 auto;padding:11px 20px;
  display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:.14em;font-size:13px;text-transform:uppercase}
.shell-sub{color:var(--on-shell-muted);font-size:12.5px;flex:1;min-width:120px}
.shell button{font:inherit;font-size:12.5px;color:var(--on-shell-muted);background:transparent;
  border:1px solid var(--shell-line);border-radius:var(--r-sm);padding:4px 11px;cursor:pointer}
.shell button:hover{color:var(--on-shell);border-color:rgba(255,255,255,.3)}
.shell button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}

/* กว้างรวม = สารบัญ 262 + ช่องไฟ 26 + คอลัมน์อ่าน 44rem — ตั้งให้พอดี ไม่เหลือที่ว่างลอย ๆ ทางขวา */
.wrap{max-width:1080px;margin:0 auto;padding:26px 20px 80px;
  display:grid;grid-template-columns:262px minmax(0,1fr);gap:26px;align-items:start}
@media (max-width:900px){.wrap{grid-template-columns:1fr;gap:16px}}

/* สารบัญ — บล็อกสี ไม่มีขอบไม่มีเงา */
.rail{background:var(--surface);border-radius:var(--r-sm);padding:14px;
  position:sticky;top:62px;max-height:calc(100vh - 84px);overflow-y:auto}
@media (max-width:900px){.rail{position:static;max-height:none}}
.rail h2{margin:0 0 10px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);font-weight:600}
#q{width:100%;font:inherit;font-size:14.5px;padding:9px 11px;margin-bottom:14px;
  background:var(--panel);color:var(--text);
  border:1px solid var(--line-soft);border-radius:var(--r-sm)}
#q:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.rail ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
.rail a{display:block;padding:9px 10px;border-radius:var(--r-sm);
  color:var(--text);text-decoration:none;font-size:14px}
.rail a:hover{background:var(--panel-hi)}
.rail a[aria-current="true"]{background:var(--panel-hi);font-weight:600;
  box-shadow:inset 2px 0 0 var(--primary)}
.rail a:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}
.rail .r-name{font-family:var(--mono);font-size:13px}
/* ชื่อบทบาทเป็นภาษาไทย จึงต้องการ line-height สูงเหมือนเนื้อความ ไม่ใช่ค่าของ caption อังกฤษ */
.rail .r-role{display:block;color:var(--muted);font-size:12.5px;line-height:1.7;margin-top:2px}
.rail .r-kb{float:right;color:var(--muted);font-size:11.5px;font-variant-numeric:tabular-nums}
.rail .empty{color:var(--muted);font-size:13px;padding:6px 9px;line-height:1.7}

/* เนื้อเอกสาร */
/* ความกว้างคุมด้วย rem ไม่ใช่ ch — หน่วย ch อิงความกว้างเลขศูนย์ ซึ่งไม่สะท้อนอักษรไทย
   ที่หนาแน่นกว่า ; 78ch จึงกลายเป็นบรรทัดยาวจริงราว 90 ตัวอักษรไทย ซึ่งเกินที่ตาไล่ทัน */
.doc{background:var(--surface);border-radius:var(--r-sm);padding:32px 38px;
  max-width:44rem;line-height:1.95;overflow-wrap:break-word}
@media (max-width:640px){.doc{padding:20px 17px;line-height:1.9}}
.doc-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--line-soft);line-height:1.7}
.doc-head .f{font-family:var(--mono);font-size:13.5px;color:var(--muted)}
.doc-head .role{font-size:13.5px;color:var(--muted)}

/* หัวข้อไทยก็ต้องการ line-height มากกว่าหัวข้ออังกฤษด้วยเหตุผลเดียวกับเนื้อความ */
.doc h1{font-size:27px;line-height:1.5;margin:.2em 0 .7em;text-wrap:balance}
.doc h2{font-size:20.5px;line-height:1.55;margin:2.1em 0 .7em;text-wrap:balance;
  padding-top:.7em;border-top:1px solid var(--line-soft)}
.doc h2:first-of-type{border-top:0;padding-top:0;margin-top:1em}
.doc h3{font-size:17px;line-height:1.6;margin:1.8em 0 .55em;text-wrap:balance}
.doc h4{font-size:15px;margin:1.5em 0 .4em;color:var(--muted)}
/* เอกสารชุดนี้ใช้ตัวหนาถี่มาก ถ้าย่อหน้าชิดกัน ก้อนตัวหนาจะเชื่อมกันจนหาจุดเริ่มไม่เจอ */
.doc p{margin:1.05em 0;text-wrap:pretty}
.doc ul,.doc ol{margin:1em 0;padding-left:1.5em}
.doc li{margin:.55em 0}
.doc li>ul,.doc li>ol{margin:.4em 0}
.doc blockquote{margin:1.2em 0;padding:4px 0 4px 16px;color:var(--muted);
  box-shadow:inset 2px 0 0 var(--line-soft)}
.doc hr{border:0;border-top:1px solid var(--line-soft);margin:2.2em 0}
.doc a{color:var(--info);text-decoration-thickness:1px;text-underline-offset:2px}
.doc strong{font-weight:600}
.ref{border-bottom:1px dotted var(--line);cursor:help}
.doc a.xdoc{font-family:var(--mono);font-size:.9em}

/* padding แนวตั้งของ inline code ต้องน้อย ไม่งั้นมันดัน line box ให้บรรทัดที่มี code
   ห่างกว่าบรรทัดอื่น จังหวะการอ่านเลยสะดุดเป็นช่วง ๆ */
code{font-family:var(--mono);font-size:.9em;background:var(--code-bg);
  padding:0 5px;border-radius:2px}
.code-wrap{overflow-x:auto;margin:1.2em 0;background:var(--code-bg);border-radius:var(--r-sm)}
.code-wrap pre{margin:0;padding:14px 16px}
.code-wrap code{background:transparent;padding:0;font-size:13.5px;line-height:1.75}

.table-wrap{overflow-x:auto;margin:1.3em 0}
table{border-collapse:collapse;width:100%;font-size:15px;line-height:1.8}
th,td{text-align:left;padding:10px 14px 10px 0;vertical-align:top;
  border-bottom:1px solid var(--line-soft)}
th{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:600}

/* field label — โครง why:/scope:/เลือก: ของ TICKETS กับ DECISIONS
   uppercase ใช้ได้ตรงนี้เพราะเป็น "field label" จริงตามกติกา D-019 ข้อ 4 */
.field{display:grid;grid-template-columns:100px minmax(0,1fr);gap:2px 18px;margin:.9em 0}
@media (max-width:640px){.field{grid-template-columns:1fr;gap:0;margin:1.1em 0}}
.field-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);font-weight:600;padding-top:9px;line-height:1.4}
.field-body{min-width:0}

.id{font-family:var(--mono);font-size:.9em;background:var(--panel-hi);
  padding:0 7px;border-radius:var(--r-pill);white-space:nowrap}

.authoring-note{margin:1.2em 0;padding:12px 15px;background:var(--panel);
  border-radius:var(--r-sm);color:var(--muted);font-size:14px;line-height:1.85}

@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{.shell,.rail{display:none}.wrap{display:block;max-width:none;padding:0}
  .doc{background:none;padding:0;max-width:none}[hidden]{display:none!important}}
</style>

<header class="shell">
  <div class="shell-in">
    <span class="brand">Meter</span>
    <span class="shell-sub">เอกสารทั้งชุด · รวมจากไฟล์ .md ต้นฉบับเมื่อ ${generated}</span>
    <button id="theme" type="button">สลับธีม</button>
  </div>
</header>

<div class="wrap">
  <nav class="rail" aria-label="สารบัญเอกสาร">
    <h2>เอกสาร</h2>
    <input id="q" type="search" placeholder="ค้นหาในทุกไฟล์…" autocomplete="off">
    <ul id="toc">
      ${docs
        .map(
          (d, n) =>
            `<li data-doc="${d.id}"><a href="#${d.id}" ${n === 0 ? 'aria-current="true"' : ""}>
        <span class="r-kb">${d.kb}KB</span><span class="r-name">${d.file}</span>
        <span class="r-role">${esc(d.role)}</span></a></li>`,
        )
        .join("\n      ")}
    </ul>
    <p class="empty" id="nohit" hidden>ไม่พบคำนี้ในไฟล์ไหนเลย</p>
  </nav>

  <main>
    ${docs
      .map(
        (d, n) => `<article class="doc" id="${d.id}"${n === 0 ? "" : " hidden"}>
      <div class="doc-head"><span class="f">${d.file}</span><span class="role">${esc(d.role)}</span></div>
      ${d.html}
    </article>`,
      )
      .join("\n    ")}
  </main>
</div>

<script>
// index ค้นหาสร้างจาก DOM ตอนโหลด — ไม่ฝังสำเนาเนื้อหาลงไฟล์ซ้ำ (จะบวมอีกเท่าตัวเปล่า ๆ)
const INDEX = [...document.querySelectorAll("article.doc")]
  .map((a) => ({ id: a.id, t: a.textContent.toLowerCase() }));
const toc = document.getElementById("toc");
const q = document.getElementById("q");
const nohit = document.getElementById("nohit");

function show(id){
  for (const a of document.querySelectorAll("article.doc")) a.hidden = a.id !== id;
  for (const a of toc.querySelectorAll("a")) a.setAttribute("aria-current", String(a.hash === "#" + id));
  window.scrollTo({ top: 0 });
}
toc.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  e.preventDefault();
  show(a.hash.slice(1));
  history.replaceState(null, "", a.hash);
});
if (location.hash && document.getElementById(location.hash.slice(1))) show(location.hash.slice(1));

// ลิงก์ข้ามไฟล์ในเนื้อเอกสาร — สลับไฟล์แทนการกระโดด anchor เปล่า
document.addEventListener("click", (e) => {
  const a = e.target.closest("a.xdoc");
  if (!a) return;
  const id = a.hash.slice(1);
  if (!document.getElementById(id)) return;
  e.preventDefault();
  show(id);
  history.replaceState(null, "", a.hash);
});

q.addEventListener("input", () => {
  const term = q.value.trim().toLowerCase();
  let hits = 0;
  for (const li of toc.children) {
    const rec = INDEX.find((r) => r.id === li.dataset.doc);
    const hit = !term || (rec && rec.t.includes(term));
    li.hidden = !hit;
    if (hit) hits++;
  }
  nohit.hidden = hits > 0;
});

document.getElementById("theme").addEventListener("click", () => {
  const dark = matchMedia("(prefers-color-scheme: dark)").matches;
  const now = document.documentElement.dataset.theme || (dark ? "dark" : "light");
  document.documentElement.dataset.theme = now === "dark" ? "light" : "dark";
});
</script>
`;

await Bun.write(OUT, html);
console.log(`เขียน ${OUT}`);
console.log(`  ${docs.length} ไฟล์ · ${Math.round(Buffer.byteLength(html, "utf8") / 1024)}KB`);
