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

/** กลุ่มของเอกสาร — ยึดตาม `docs/WORKFLOW.md` §0 ไม่ได้จัดกลุ่มขึ้นมาใหม่เอง
 *  ถ้า §0 เปลี่ยน ต้องแก้ตรงนี้ตาม ไม่งั้นเว็บจะสอนคนละอย่างกับเอกสาร */
const TIER: Record<string, { label: string; hint: string }> = {
  core: { label: "วนอ่านทุกครั้ง", hint: "3 ไฟล์นี้พอสำหรับรู้ว่าค้างอะไรและทำอะไรต่อ" },
  ref: { label: "เปิดเมื่อมีคำถาม", hint: "อย่าไล่อ่านตามลำดับ — เปิดเฉพาะตอนสงสัยเรื่องนั้น" },
  rules: { label: "อ่านครั้งเดียวก็พอ", hint: "กติกาที่ไม่ค่อยเปลี่ยน" },
  outbound: { label: "เอกสารที่ส่งให้ทีมอื่น", hint: "ฝั่ง edge / ข้อเสนอที่เคาะไปแล้ว" },
};

type DocMeta = {
  role: string;
  tier: keyof typeof TIER;
  /** ลำดับใน "วนอ่านทุกครั้ง" — ใส่เฉพาะ tier core */
  step?: number;
  /** อ่านจบแล้วไปไหนต่อ: [ชื่อไฟล์, เหตุผลว่าทำไมไฟล์นี้ต่อ] */
  next?: [string, string];
  /** อ่านเพิ่มเมื่อ...: [ชื่อไฟล์, เปิดตอนสงสัยอะไร] */
  also?: [string, string][];
};

const DOCS_META: Record<string, DocMeta> = {
  "HANDOFF.md": {
    role: "สถานะเครื่อง · ของค้าง · กับดัก — อ่านก่อนเริ่ม session",
    tier: "core",
    step: 1,
    next: ["ROADMAP-PACKAGE.md", "รู้สถานะแล้ว ดูต่อว่ากำลังเดินไปทางไหน จะได้ไม่หยิบใบที่หลุดทาง"],
    also: [
      ["WORKFLOW.md", "ไม่แน่ใจว่าควรหยิบใบไหนก่อน → §0 มีเกณฑ์ 4 ข้อ"],
      ["DEPLOYMENT.md", "จะ deploy ของที่ค้างขึ้นเครื่องจริง"],
    ],
  },
  "ROADMAP-PACKAGE.md": {
    role: "ปลายทางที่กำลังเดินไป + อะไรตัดออกนอกขอบเขตแล้ว",
    tier: "core",
    step: 2,
    next: ["TICKETS.md", "รู้ปลายทางแล้ว เปิดใบที่อยู่บนแผนที่นี้ (T-015…T-018)"],
    also: [["DECISIONS.md", "อยากรู้ว่าทำไมเคาะขอบเขตแบบนี้ → D-020"]],
  },
  "TICKETS.md": {
    role: "backlog — ใบถัดไปที่ต้องทำ",
    tier: "core",
    step: 3,
    next: ["WORKFLOW.md", "ก่อนลงมือ ดูกติกา plan → design → verify แล้วค่อยเปิดใบ"],
    also: [
      ["DECISIONS.md", "ใบอ้าง D-0NN แล้วจำไม่ได้ว่าเคาะอะไรไว้"],
      ["ARCHITECTURE.md", "ไม่รู้ว่าโค้ดที่จะแก้อยู่ตรงไหนของระบบ"],
    ],
  },
  "DECISIONS.md": {
    role: "ตัดสินใจอะไร เพราะอะไร แลกอะไรไป (ADR-lite)",
    tier: "ref",
    next: ["CHANGELOG.md", "รู้ว่าเคาะอะไรไว้แล้ว ดูต่อว่าลงมือจริงแล้วผลออกมายังไง"],
    also: [["ROADMAP-PACKAGE.md", "อยากเห็นว่าการตัดสินใจนี้อยู่ตรงไหนของเส้นทาง"]],
  },
  "CHANGELOG.md": {
    role: "ทำอะไรไปแล้วบ้าง + verify ยังไง (ใหม่สุดอยู่บน)",
    tier: "ref",
    next: ["HANDOFF.md", "ประวัติจบแล้ว กลับไปดูว่าตอนนี้ค้างอะไรอยู่"],
    also: [["TICKETS.md", "อยากรู้ว่าใบที่ทำไปแล้วเขียน done-when ว่าอะไร"]],
  },
  "ARCHITECTURE.md": {
    role: "ภาพรวม + data flow + ขอบเขต layer",
    tier: "ref",
    next: ["DECISIONS.md", "รู้ว่าโครงเป็นแบบไหนแล้ว ดูต่อว่าทำไมถึงเลือกแบบนั้น"],
    also: [["DEPLOYMENT.md", "จะเอาโครงนี้ขึ้นเครื่องจริง"]],
  },
  "DEPLOYMENT.md": {
    role: "ขั้นตอนเอาขึ้น Pi + กับดักที่เจอมาแล้ว",
    tier: "ref",
    next: ["HANDOFF.md", "ดูว่าตอนนี้เครื่องจริงอยู่สถานะไหน มีอะไรค้างรอ deploy"],
    also: [["ARCHITECTURE.md", "สงสัยว่าชิ้นส่วนที่กำลัง deploy ทำหน้าที่อะไร"]],
  },
  "CLAUDE.md": {
    role: "กฎการทำงาน + โปรเจกต์นี้คืออะไร (โหลดทุก turn)",
    tier: "rules",
    next: ["AI-GUIDE.md", "รู้กฎแล้ว ดูต่อว่าคาดหวังพฤติกรรมแบบไหนจาก AI"],
    also: [["WORKFLOW.md", "จะเริ่มงานที่ใหญ่กว่าแก้บั๊กจุดเดียว"]],
  },
  "WORKFLOW.md": {
    role: "§0 วิธีกลับมาอ่าน + เลือกใบถัดไป · plan → design → tickets → verify",
    tier: "rules",
    next: ["TICKETS.md", "รู้กติกาแล้ว เปิดใบถัดไปได้เลย"],
    also: [["AI-GUIDE.md", "อยากรู้ว่า AI ควรคิด/เสนออะไรก่อนพาลงมือ"]],
  },
  "AI-GUIDE.md": {
    role: "พฤติกรรมที่คาดหวังจาก AI — คิด/เสนอ/เตือน debt ก่อนพาทำ",
    tier: "rules",
    next: ["WORKFLOW.md", "รู้ว่าคาดหวังอะไรแล้ว ดูต่อว่ากระบวนการทำงานเป็นยังไง"],
    also: [["CLAUDE.md", "อยากทวนกฎพื้นฐานของโปรเจกต์นี้"]],
  },
  "PUBLISHING-GUIDE.md": {
    role: "คู่มือ publish สำหรับทีม AI (ฝั่ง edge)",
    tier: "outbound",
    next: ["CALIBRATION-PROPOSAL.md", "อีกฉบับที่ส่งให้ทีม AI — เรื่อง calibrate จุดวัด"],
    also: [["DECISIONS.md", "สัญญาเปลี่ยนเพราะอะไร → D-016 / D-018"]],
  },
  "SNAPSHOT-PROPOSAL.md": {
    role: "ข้อเสนอเรื่องส่งภาพ snapshot (เคาะแล้ว D-013)",
    tier: "outbound",
    next: ["CALIBRATION-PROPOSAL.md", "ข้อเสนออีกฉบับที่ต่อยอดจาก pipeline ภาพเดียวกัน"],
    also: [["DECISIONS.md", "ผลที่เคาะจริง → D-013"]],
  },
  "CALIBRATION-PROPOSAL.md": {
    role: "ข้อเสนอ calibrate จุดวัดจาก UI (D-017 / D-018)",
    tier: "outbound",
    next: ["TICKETS.md", "ข้อเสนอนี้กลายเป็นใบ T-013 / T-014 แล้ว"],
    also: [["DECISIONS.md", "ทำไมเปลี่ยนจาก px เป็นเศษส่วน → D-018"]],
  },
};

/** ลำดับที่อยากให้โผล่ในสารบัญ — ที่ไม่อยู่ในนี้ต่อท้ายตามตัวอักษร */
const ORDER = [
  "HANDOFF.md",
  "ROADMAP-PACKAGE.md",
  "TICKETS.md",
  "DECISIONS.md",
  "CHANGELOG.md",
  "ARCHITECTURE.md",
  "DEPLOYMENT.md",
  "CLAUDE.md",
  "WORKFLOW.md",
  "AI-GUIDE.md",
  "PUBLISHING-GUIDE.md",
  "SNAPSHOT-PROPOSAL.md",
  "CALIBRATION-PROPOSAL.md",
];
const TIER_ORDER: (keyof typeof TIER)[] = ["core", "ref", "rules", "outbound"];

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

const docId = (file: string) => "doc-" + file.replace(/\.md$/, "").toLowerCase();

const docs = found.map((d) => {
  slugSeen = new Set<string>();
  const meta = DOCS_META[d.file];
  return {
    id: docId(d.file),
    file: d.file,
    meta,
    role: meta?.role ?? "",
    tier: meta?.tier ?? "outbound",
    kb: Math.round(Buffer.byteLength(d.md, "utf8") / 1024),
    html: render(d.md),
  };
});

const byFile = new Map(docs.map((d) => [d.file, d]));

/** ท้ายเอกสาร: อ่านจบแล้วไปไหนต่อ — ข้อมูลมาจาก DOCS_META ซึ่งยึด WORKFLOW §0 */
function nextUp(m: DocMeta | undefined): string {
  if (!m) return "";
  const cards: string[] = [];
  if (m.next && byFile.has(m.next[0])) {
    const [file, why] = m.next;
    cards.push(`<a class="nu-card nu-primary" href="#${docId(file)}">
      <span class="nu-kicker">อ่านต่อ</span>
      <span class="nu-file">${file}</span>
      <span class="nu-why">${esc(why)}</span></a>`);
  }
  for (const [file, why] of m.also ?? []) {
    if (!byFile.has(file)) continue;
    cards.push(`<a class="nu-card" href="#${docId(file)}">
      <span class="nu-kicker">เปิดเมื่อ</span>
      <span class="nu-file">${file}</span>
      <span class="nu-why">${esc(why)}</span></a>`);
  }
  if (!cards.length) return "";
  return `<nav class="next-up" aria-label="อ่านต่อ">${cards.join("")}</nav>`;
}

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

/* คอลัมน์อ่านอยู่กลางจอ ได้พื้นที่เต็ม — สารบัญเป็นแผงลอยที่ซ่อนไว้ ไม่กินที่อ่านตลอดเวลา */
.wrap{padding:30px 24px 96px;display:flex;justify-content:center}

/* โซนเรียกสารบัญ: แถบบางที่ขอบซ้าย เอาเมาส์ไปแตะแล้วแผงเลื่อนออกมา
   ⚠️ hover อย่างเดียวไม่พอ — จอสัมผัสกับคีย์บอร์ดไม่มี hover จึงต้องมีปุ่มในแถบบนคู่กันเสมอ */
#navzone{position:fixed;left:0;top:50px;bottom:0;width:22px;z-index:30}
#navzone:focus-within{width:326px}
body.nav-open #navzone{width:326px}
/* เปิดด้วยการเอาเมาส์มาแตะ เฉพาะเครื่องที่มีเมาส์จริง — บนจอสัมผัส hover คือการแตะค้าง
   ซึ่งจะทำให้แผงเด้งตอนคนตั้งใจจะ scroll ; เครื่องพวกนั้นใช้ปุ่มในแถบบนแทน */
@media (hover:hover) and (pointer:fine){
  #navzone:hover{width:326px}
}
.edge{position:absolute;inset:0 auto 0 0;width:22px;transition:opacity .2s ease;
  background:linear-gradient(90deg,var(--panel-hi),transparent)}
/* ขีดจับ — บอกว่าตรงนี้มีของซ่อนอยู่ ไม่งั้นไม่มีใครรู้ว่าต้องเอาเมาส์มาแตะ */
.edge::after{content:"";position:absolute;left:6px;top:50%;margin-top:-28px;
  width:3px;height:56px;border-radius:var(--r-pill);background:var(--line)}
#navzone:focus-within .edge,body.nav-open .edge{opacity:0}

.rail{position:absolute;left:0;top:0;bottom:0;width:304px;overflow-y:auto;
  background:var(--surface);border-right:1px solid var(--line-soft);padding:16px 15px 28px;
  transform:translateX(-105%);transition:transform .2s ease}
#navzone:focus-within .rail,body.nav-open .rail{transform:none}
@media (hover:hover) and (pointer:fine){
  #navzone:hover .edge{opacity:0}
  #navzone:hover .rail{transform:none}
}

.nav-group{margin:0 0 20px}
.nav-group>h2{margin:0 0 2px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);font-weight:600}
.g-hint{margin:0 0 9px;font-size:12px;line-height:1.6;color:var(--muted)}
.rail>h2{margin:0 0 10px;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);font-weight:600}
/* ตัวเลขบนกลุ่มแรก = ลำดับการอ่านจริงตาม WORKFLOW §0 ไม่ใช่เลขประดับ */
.step{display:inline-flex;align-items:center;justify-content:center;
  width:17px;height:17px;margin-right:7px;border-radius:var(--r-pill);
  background:var(--primary);color:#fff;font-size:10.5px;font-weight:700;
  font-family:var(--mono);vertical-align:1px}
#q{width:100%;font:inherit;font-size:14.5px;padding:9px 11px;margin-bottom:14px;
  background:var(--panel);color:var(--text);
  border:1px solid var(--line-soft);border-radius:var(--r-sm)}
#q:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.rail ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:1px}
@media (max-width:900px){.rail{width:min(88vw,304px)}}
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
.doc{background:var(--surface);border-radius:var(--r-sm);padding:34px 44px 40px;
  width:100%;max-width:46rem;line-height:1.95;overflow-wrap:break-word}
@media (max-width:640px){.doc{padding:20px 17px 28px;line-height:1.9}}

/* ท้ายเอกสาร: อ่านจบแล้วไปไหนต่อ — ใบแรกคือเส้นทางหลัก ที่เหลือคือ "เปิดเมื่อสงสัยเรื่องนี้" */
.next-up{display:grid;gap:10px;margin-top:44px;padding-top:24px;
  border-top:1px solid var(--line-soft)}
@media (min-width:700px){.next-up{grid-template-columns:repeat(auto-fit,minmax(200px,1fr))}}
.nu-card{display:flex;flex-direction:column;gap:1px;padding:13px 15px;
  background:var(--panel-hi);border-radius:var(--r-sm);
  text-decoration:none;color:var(--text)}
.nu-card:hover{background:var(--panel)}
.nu-card:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.nu-primary{box-shadow:inset 3px 0 0 var(--primary)}
.nu-kicker{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--muted);font-weight:600}
.nu-file{font-family:var(--mono);font-size:13.5px;margin-bottom:2px}
.nu-why{font-size:13px;line-height:1.7;color:var(--muted)}

#backdrop{position:fixed;inset:0;z-index:25;background:rgba(0,0,0,.4);
  opacity:0;pointer-events:none;transition:opacity .2s ease}
body.nav-open #backdrop{opacity:1;pointer-events:auto}
@media (min-width:901px){#backdrop{display:none}}
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
@media print{.shell,#navzone,#backdrop,.next-up{display:none}
  .wrap{display:block;max-width:none;padding:0}
  .doc{background:none;padding:0;max-width:none}[hidden]{display:none!important}}
</style>

<header class="shell">
  <div class="shell-in">
    <button id="menu" type="button" aria-expanded="false" aria-controls="rail">☰ เอกสาร</button>
    <span class="brand">Meter</span>
    <span class="shell-sub">เอกสารทั้งชุด · รวมจากไฟล์ .md ต้นฉบับเมื่อ ${generated}</span>
    <button id="theme" type="button">สลับธีม</button>
  </div>
</header>

<div id="backdrop"></div>

<div id="navzone">
  <div class="edge" aria-hidden="true"></div>
  <nav class="rail" id="rail" aria-label="สารบัญเอกสาร">
    <input id="q" type="search" placeholder="ค้นหาในทุกไฟล์…" autocomplete="off">
    <div id="toc">
      ${TIER_ORDER.filter((t) => docs.some((d) => d.tier === t))
        .map(
          (t) => `<section class="nav-group">
        <h2>${TIER[t]!.label}</h2>
        <p class="g-hint">${esc(TIER[t]!.hint)}</p>
        <ul>
          ${docs
            .filter((d) => d.tier === t)
            .map(
              (d) => `<li data-doc="${d.id}"><a href="#${d.id}"${d.id === docs[0]!.id ? ' aria-current="true"' : ""}>
            <span class="r-kb">${d.kb}KB</span>
            <span class="r-name">${d.meta?.step ? `<span class="step">${d.meta.step}</span>` : ""}${d.file}</span>
            <span class="r-role">${esc(d.role)}</span></a></li>`,
            )
            .join("\n          ")}
        </ul>
      </section>`,
        )
        .join("\n      ")}
    </div>
    <p class="empty" id="nohit" hidden>ไม่พบคำนี้ในไฟล์ไหนเลย</p>
  </nav>
</div>

<div class="wrap">
  <main>
    ${docs
      .map(
        (d, n) => `<article class="doc" id="${d.id}"${n === 0 ? "" : " hidden"}>
      <div class="doc-head"><span class="f">${d.file}</span><span class="role">${esc(d.role)}</span></div>
      ${d.html}
      ${nextUp(d.meta)}
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
const menu = document.getElementById("menu");

function closeNav(){
  document.body.classList.remove("nav-open");
  menu.setAttribute("aria-expanded", "false");
}
function show(id){
  for (const a of document.querySelectorAll("article.doc")) a.hidden = a.id !== id;
  for (const a of toc.querySelectorAll("a")) a.setAttribute("aria-current", String(a.hash === "#" + id));
  closeNav();
  window.scrollTo({ top: 0 });
}

// ลิงก์ไปเอกสารอื่นมี 3 ที่: สารบัญ · ลิงก์ข้ามไฟล์ในเนื้อความ · การ์ด "อ่านต่อ" ท้ายหน้า
// ทั้งหมดชี้ #doc-* เหมือนกัน จึงดักที่เดียวจบ
document.addEventListener("click", (e) => {
  const a = e.target.closest('a[href^="#doc-"]');
  if (!a) return;
  const id = a.hash.slice(1);
  if (!document.getElementById(id)) return;
  e.preventDefault();
  show(id);
  history.replaceState(null, "", a.hash);
});
if (location.hash && document.getElementById(location.hash.slice(1))) show(location.hash.slice(1));

q.addEventListener("input", () => {
  const term = q.value.trim().toLowerCase();
  let hits = 0;
  for (const li of toc.querySelectorAll("li[data-doc]")) {
    const rec = INDEX.find((r) => r.id === li.dataset.doc);
    const hit = !term || (rec && rec.t.includes(term));
    li.hidden = !hit;
    if (hit) hits++;
  }
  // ซ่อนหัวกลุ่มที่ไม่เหลือไฟล์แล้ว ไม่งั้นจะเห็นหัวข้อลอยไม่มีอะไรอยู่ข้างใต้
  for (const g of toc.querySelectorAll(".nav-group"))
    g.hidden = ![...g.querySelectorAll("li[data-doc]")].some((li) => !li.hidden);
  nohit.hidden = hits > 0;
});

menu.addEventListener("click", () => {
  const open = document.body.classList.toggle("nav-open");
  menu.setAttribute("aria-expanded", String(open));
  if (open) q.focus();
});
document.getElementById("backdrop").addEventListener("click", closeNav);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });

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
