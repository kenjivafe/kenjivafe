// Builds the profile stat cards as static SVGs in ./assets.
// Runs in GitHub Actions (see .github/workflows/stats.yml). No dependencies.
//
//   GH_TOKEN=xxx USERNAME=kenjivafe node scripts/build-stats.mjs
//   node scripts/build-stats.mjs --mock      (render with sample data, no API)

import { mkdir, readFile, writeFile } from "node:fs/promises";

const USERNAME = process.env.USERNAME || "kenjivafe";
const TOKEN = process.env.GH_TOKEN;
const OUT = new URL("../assets/", import.meta.url);
const MOCK = process.argv.includes("--mock");

/* ------------------------------------------------------------------ theme */

// Matches the portfolio's two themes (kenjivafe.vercel.app). Every card is
// rendered once per theme; the README swaps them with <picture>.
const THEMES = {
  dark: { bg: "#10100e", line: "#30302b", empty: "#22221e", text: "#ffffe3", muted: "#c0c0ab", dim: "#8a8a7a" },
  light: { bg: "#ffffe3", line: "#e8e8cf", empty: "#ececd2", text: "#10100e", muted: "#606055", dim: "#8a8a7a" },
};
const T = {
  ...THEMES.dark,
  accent: "#ff3800",
  green: "#22c55e",
  sans: "Satoshi, Inter, 'Segoe UI', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

// Satoshi is embedded into every SVG when FONT_FILE points at a font file
// (the workflow downloads it from Fontshare), so the cards render in the
// same typeface as the portfolio without loading anything external.
let FONT_FACE = "";
if (process.env.FONT_FILE) {
  try {
    const f = process.env.FONT_FILE;
    const ext = f.split(".").pop().toLowerCase();
    const fmtName = { woff2: "woff2", woff: "woff", ttf: "truetype", otf: "opentype" }[ext];
    const b64 = (await readFile(f)).toString("base64");
    FONT_FACE = `@font-face{font-family:Satoshi;src:url(data:font/${ext};base64,${b64}) format('${fmtName}');font-weight:300 900}`;
  } catch (e) {
    console.warn("Could not embed font:", e.message);
  }
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (n) => n.toLocaleString("en-US");
const fmtDate = (d) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const STYLE = () => `${FONT_FACE}
  .t{font:700 10px ${T.sans};letter-spacing:.14em;fill:${T.muted}}
  .tc{font:500 10px ${T.sans};letter-spacing:.08em;fill:${T.dim}}
  .lbl{font:500 13px ${T.sans};fill:${T.muted}}
  .val{font:700 15px ${T.sans};fill:${T.text};letter-spacing:-.01em}
  .big{font:900 40px ${T.sans};fill:${T.text};letter-spacing:-.05em}
  .sub{font:400 11px ${T.mono};fill:${T.dim}}`;

function svg(w, h, label, inner, extraStyle = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<style>${STYLE()}${extraStyle}</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="${T.bg}" stroke="${T.line}"/>
${inner}
</svg>`;
}

// Card with a portfolio-style label bar: TITLE on the left, a count on the right.
function frame(w, h, title, body, right = "") {
  const pad = w < 600 ? 16 : 24;
  return svg(
    w,
    h,
    title,
    `<text x="${pad}" y="29" class="t">${esc(title.toUpperCase())}</text>
${right ? `<text x="${w - pad}" y="29" class="tc" text-anchor="end">${right}</text>` : ""}
<line x1="0" y1="48" x2="${w}" y2="48" stroke="${T.line}"/>
${body}`
  );
}

/* ------------------------------------------------------------------ rank */
// Same scoring as github-readme-stats (all-commits mode), so the grade matches.

function rank({ commits, prs, issues, reviews, stars, followers }) {
  const exp = (x) => 1 - 2 ** -x;
  const logn = (x) => x / (1 + x);
  const parts = [
    [2, exp(commits / 1000)],
    [3, exp(prs / 50)],
    [1, exp(issues / 25)],
    [1, exp(reviews / 2)],
    [4, logn(stars / 50)],
    [1, logn(followers / 10)],
  ];
  const total = parts.reduce((a, [w]) => a + w, 0);
  const pct = (1 - parts.reduce((a, [w, v]) => a + w * v, 0) / total) * 100;
  const th = [1, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100];
  const lv = ["S", "A+", "A", "A-", "B+", "B", "B-", "C+", "C"];
  return { level: lv[th.findIndex((t) => pct <= t)], percentile: pct };
}

/* ------------------------------------------------------------------ cards */

function statsCard(s) {
  const rows = [
    ["Total stars", s.stars],
    ["Commits", s.commits],
    ["Pull requests", s.prs],
    ["Issues", s.issues],
    ["Contributed to", s.contributedTo],
  ];
  const r = rank(s);
  const R = 46, C = 2 * Math.PI * R;
  const filled = C * (1 - r.percentile / 100);
  const body =
    rows
      .map(
        ([k, v], i) => `<g>
  <text x="24" y="${82 + i * 28}" class="lbl">${k}</text>
  <text x="236" y="${82 + i * 28}" class="val" text-anchor="end">${fmt(v)}</text>
</g>`
      )
      .join("\n") +
    `
<line x1="268" y1="64" x2="268" y2="196" stroke="${T.line}"/>
<g transform="translate(339 124)">
  <circle r="${R}" fill="none" stroke="${T.empty}" stroke-width="6"/>
  <circle r="${R}" fill="none" stroke="${T.accent}" stroke-width="6" stroke-linecap="butt"
    stroke-dasharray="${C}" stroke-dashoffset="${C - filled}" transform="rotate(-90)"/>
  <text y="10" text-anchor="middle" style="font:900 32px ${T.sans};fill:${T.text};letter-spacing:-.04em">${r.level}</text>
</g>
<text x="339" y="198" class="sub" text-anchor="middle">TOP ${r.percentile < 1 ? r.percentile.toFixed(1) : Math.round(r.percentile)}%</text>`;
  return frame(415, 220, "GitHub stats", body, "ALL TIME");
}

function langsCard(langs) {
  const top = langs.slice(0, 8);
  const sum = top.reduce((a, l) => a + l.size, 0) || 1;
  const shades = [1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.22, 0.16];
  const W = 368;
  let x = 24;
  const bar = top
    .map((l, i) => {
      const w = Math.max((l.size / sum) * W, 2);
      const seg = `<rect x="${x.toFixed(2)}" y="64" width="${w.toFixed(2)}" height="8" fill="${T.accent}" fill-opacity="${shades[i]}"/>`;
      x += w;
      return seg;
    })
    .join("");
  const list = top
    .map((l, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const lx = 24 + col * 193, ly = 106 + row * 28;
      return `<g>
  <rect x="${lx}" y="${ly - 9}" width="9" height="9" fill="${T.accent}" fill-opacity="${shades[i]}"/>
  <text x="${lx + 18}" y="${ly}" class="lbl" style="fill:${T.text}">${esc(l.name)}</text>
  <text x="${lx + 175}" y="${ly}" class="sub" text-anchor="end">${((l.size / sum) * 100).toFixed(1)}%</text>
</g>`;
    })
    .join("\n");
  return frame(416, 220, "Top languages", bar + "\n" + list, "BY SIZE");
}

function streakCard(st) {
  const cols = [
    ["Total contributions", fmt(st.total), `${fmtDate(st.firstDay)} — Present`, T.text],
    ["Longest streak", `${st.longest.length} days`, st.longest.length ? `${fmtDate(st.longest.start)} — ${fmtDate(st.longest.end)}` : "—", T.accent],
    ["Active days", fmt(st.activeDays), `${st.activePct}% of days since joining`, T.text],
  ];
  const cw = (830 - 48) / 3;
  const body = cols
    .map(([k, v, sub, color], i) => {
      const x = 24 + i * cw + (i ? 24 : 0);
      return `${i ? `<line x1="${24 + i * cw}" y1="64" x2="${24 + i * cw}" y2="140" stroke="${T.line}"/>` : ""}
<g>
  <text x="${x}" y="78" class="lbl">${k}</text>
  <text x="${x}" y="118" class="big" style="fill:${color}">${v}</text>
  <text x="${x}" y="140" class="sub">${esc(sub)}</text>
</g>`;
    })
    .join("\n");
  return frame(830, 164, "Contributions", body, `SINCE ${st.firstDay.slice(0, 4)}`);
}

function heatmapCard(weeks, total, HW = 830, title = "Last 12 months", caption = "CONTRIBUTIONS IN THE LAST YEAR") {
  const pad = HW < 600 ? 16 : 24, gap = 3, x0 = pad, y0 = 84;
  const step = (HW - 2 * pad + gap) / weeks.length, cell = +(step - gap).toFixed(2);
  const op = { NONE: 0, FIRST_QUARTILE: 0.18, SECOND_QUARTILE: 0.38, THIRD_QUARTILE: 0.6, FOURTH_QUARTILE: 1 };
  const months = [];
  let lastM = -1, lastW = -9;
  const cells = weeks
    .map((w, wi) =>
      w.map((d) => {
        const dow = new Date(d.date + "T00:00:00Z").getUTCDay();
        const m = new Date(d.date + "T00:00:00Z").getUTCMonth();
        if (dow === 0 && m !== lastM) {
          const first = wi === 0 ? new Date(d.date + "T00:00:00Z").getUTCDate() <= 7 : wi - lastW >= 3;
          if (first && wi < weeks.length - 2) {
            months.push(`<text x="${(x0 + wi * step).toFixed(2)}" y="${y0 - 10}" class="sub">${new Date(d.date + "T00:00:00Z").toLocaleString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase()}</text>`);
            lastW = wi;
          }
          lastM = m;
        }
        const o = op[d.level] ?? 0;
        const fill = o ? `fill="${T.accent}" fill-opacity="${o}"` : `fill="${T.empty}"`;
        return `<rect x="${(x0 + wi * step).toFixed(2)}" y="${(y0 + dow * step).toFixed(2)}" width="${cell}" height="${cell}" ${fill}><title>${d.count} on ${d.date}</title></rect>`;
      }).join("")
    )
    .join("\n");
  const ly = Math.round(y0 + 7 * step + 14);
  const legend = [0, 0.18, 0.38, 0.6, 1]
    .map((o, i) => `<rect x="${HW - pad - 34 - (5 - i) * 15}" y="${ly - 10}" width="12" height="12" ${o ? `fill="${T.accent}" fill-opacity="${o}"` : `fill="${T.empty}"`}/>`)
    .join("");
  const body = `${months.join("\n")}
<g>${cells}</g>
<text x="${x0}" y="${ly}" class="sub">${fmt(total)} ${caption}</text>
<text x="${HW - pad - 34 - 5 * 15 - 8}" y="${ly}" class="sub" text-anchor="end">LESS</text>${legend}
<text x="${HW - pad}" y="${ly}" class="sub" text-anchor="end">MORE</text>`;
  return frame(HW, ly + 22, title, body, `@${esc(USERNAME)}`);
}

/* ------------------------------------------------------------------ content */
// Edit these to change what the profile shows. Mirrors kenjivafe.vercel.app.

const CONTENT = {
  about: [
    "I build precise, thoughtful digital products — from",
    "scalable backend architectures to fluid user interfaces.",
    "Focused on crafting software that feels effortless",
    "and intentional.",
  ],
  location: "KALINGA, PH",
  work: [
    { name: "Rigko", desc: "Custom PC Configuration & Logistics SaaS", tags: ["Next.js", "System Design", "E-commerce"], year: 2026, url: "https://rigko.com" },
    { name: "Gymcentrix", desc: "Enterprise Gym Management & Analytics Platform", tags: ["SaaS", "PostgreSQL", "Real-time"], year: 2026, url: "https://gymcentrix.vercel.app" },
    { name: "Grit Digital Performance", desc: "Sports Data Infrastructure & Team Management", tags: ["Backend", "API Design", "Infrastructure"], year: 2026, url: "https://gritdp.com" },
    { name: "RESQ-Link", desc: "Real-time Emergency Dispatch & Event Response", tags: ["Real-time", "Event-Driven", "Mapping"], year: 2025, url: "https://resq-link-kappa.vercel.app" },
  ],
  more: [
    ["Tenantra", "Real estate management"],
    ["Airtime", "Premiere & airing countdowns"],
    ["Perbee", "AI personal best tracker"],
    ["SPUP AdServIS", "Administrative services system"],
    ["Doctor Smile", "Dental appointment system"],
    ["DICT Geofence", "Geofenced attendance"],
    ["Apit Lako", "Mobile marketplace"],
  ],
  experience: [
    ["2025 — Now", "UI/UX and Frontend Developer", "RESQ-Link"],
    ["2025 — Now", "Founder and Lead Developer", "Northernware"],
    ["2024 — Now", "Apprentice", "Hackthenorth.ph"],
    ["2025", "Apprentice and Junior Developer", "DICT Region II"],
  ],
  // [name, simple-icons slug, letters shown when no icon exists]
  capabilities: [
    ["React", "react"], ["Next.js", "nextdotjs"], ["TypeScript", "typescript"], ["Tailwind", "tailwindcss"],
    ["PostgreSQL", "postgresql"], ["npm", "npm"], ["Prisma", "prisma"], ["Shadcn UI", "shadcnui"],
    ["Node.js", "nodedotjs"], ["Express.js", "express"], ["FastAPI", "fastapi"], ["Postman", "postman"],
    ["Git", "git"], ["Vercel", "vercel"], ["Railway", "railway"], ["Expo", "expo"],
    ["Photoshop", null, "Ps"], ["Illustrator", null, "Ai"], ["Figma", "figma"], ["Canva", null, "Ca"],
    ["Antigravity", null, "Ag"], ["Claude", "claude"], ["ChatGPT", null, "AI"], ["Windsurf", "windsurf"],
  ],
  email: "kenjivafe@gmail.com",
  links: [
    { id: "portfolio", label: "View Portfolio", primary: true, icon: "logo" },
    { id: "linkedin", label: "LinkedIn", icon: "linkedin" },
    { id: "email", label: "Email", icon: "mail" },
  ],
};

/* ------------------------------------------------------------------ sections */

const W = 830;
const charW = (text, size, track = 0) => text.length * size * (0.56 + track); // rough Satoshi advance

function aboutSvg(commitsThisYear) {
  const H = 260, split = 420;
  const stats = [
    ["5", "+", "Years experience"],
    ["10", "+", "Unfinished side projects"],
    [fmt(commitsThisYear), "", "Commits this year"],
    ["100", "%", "Model quota used"],
  ];
  const cw = (W - split) / 2, ch = (H - 48) / 2;
  const cells = stats
    .map(([n, sup, l], i) => {
      const x = split + (i % 2) * cw, y = 48 + Math.floor(i / 2) * ch;
      return `<text x="${x + 28}" y="${y + 62}" class="num">${n}<tspan class="sup" dy="-16">${sup}</tspan></text>
<text x="${x + 28}" y="${y + 86}" class="sl">${l.toUpperCase()}</text>`;
    })
    .join("\n");
  const body = `${CONTENT.about.map((l, i) => `<text x="24" y="${92 + i * 26}" class="p">${esc(l)}</text>`).join("\n")}
<line x1="${split}" y1="48" x2="${split}" y2="${H}" stroke="${T.line}"/>
<line x1="${split + cw}" y1="48" x2="${split + cw}" y2="${H}" stroke="${T.line}"/>
<line x1="${split}" y1="${48 + ch}" x2="${W}" y2="${48 + ch}" stroke="${T.line}"/>
${cells}`;
  return svg(W, H, "About", `<text x="24" y="29" class="t">ABOUT</text>
<text x="${W - 24}" y="29" class="tc" text-anchor="end">${CONTENT.location}</text>
<line x1="0" y1="48" x2="${W}" y2="48" stroke="${T.line}"/>
${body}`, `
  .p{font:400 14px ${T.sans};fill:${T.muted}}
  .num{font:900 42px ${T.sans};letter-spacing:-.05em;fill:${T.text}}
  .sup{font:900 20px ${T.sans};fill:${T.accent}}
  .sl{font:600 10px ${T.sans};letter-spacing:.08em;fill:${T.muted}}`);
}

const LOGO = () => `<polygon fill="#10100E" points="629.37 527.12 549.44 386.65 527.73 415 527.73 527.12 0 527.12 0 0 527.73 0 527.73 134.24 629.11 0 845.42 0 666.04 234.3 834.93 527.12 629.37 527.12"/><polygon fill="#FFFFE3" points="765.68 487.12 652.63 487.12 554.36 314.42 487.73 401.44 487.73 487.12 40 487.12 40 40 487.73 40 487.73 253.57 649.03 40 764.42 40 618.06 231.17 765.68 487.12"/><circle fill="${T.accent}" cx="263.57" cy="263.56" r="156.57"/>`;

// 16x16 line icons drawn in the card style (1.5px strokes, square caps)
const ICONS = {
  logo: () => `<g transform="translate(0 2.5) scale(0.0265)">${LOGO()}</g>`,
  linkedin: (c) => `<g fill="none" stroke="${c}" stroke-width="1.5"><rect x=".75" y=".75" width="14.5" height="14.5"/><path d="M4.5 7v5M8 12V7m0 2.2c0-1.3.9-2.2 2-2.2s1.8.8 1.8 2.2V12"/></g><rect x="3.8" y="3.6" width="1.5" height="1.5" fill="${c}"/>`,
  plus: () => `<path d="M3 8h10M8 3v10" stroke="${T.accent}" stroke-width="1.6"/>`,
  mail: (c) => `<g fill="none" stroke="${c}" stroke-width="1.5"><rect x=".75" y="2.75" width="14.5" height="10.5"/><path d="M1 3.5l7 5.5 7-5.5"/></g>`,
};

function buttonSvg(b) {
  const label = b.label.toUpperCase() + (b.primary ? "  ↗" : "");
  const fg = b.primary ? T.bg : T.muted;
  const iconW = b.icon ? (b.icon === "logo" ? 26 : 16) + 10 : 0;
  const textW = charW(label, 11, 0.12);
  const w = Math.round(textW + iconW + 44), h = 40;
  const icon = b.icon ? `<g transform="translate(22 12)">${ICONS[b.icon](fg)}</g>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(b.label)}">
<style>${FONT_FACE}.b{font:700 11px ${T.sans};letter-spacing:.12em;fill:${fg}}</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="${b.primary ? T.text : T.bg}" stroke="${b.primary ? T.text : T.line}"/>
${icon}
<text x="${22 + iconW}" y="24.5" class="b">${esc(label)}</text>
</svg>`;
}

// Stacks finished cards into one SVG (shared borders overlap by 1px).
// parts: [svgString, x, y]
function compose(w, h, label, parts) {
  const inner = parts
    .map(([str, x, y]) => str.replace(FONT_FACE, "").replace("<svg ", `<svg x="${x}" y="${y}" `))
    .join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
<style>${FONT_FACE}</style>
${inner}
</svg>`;
}

// Drops a card's 48px label bar (keeps the divider as its top border) so the
// list can sit under a <details> summary.
function cropHeader(str) {
  const [, w, h] = str.match(/width="([\d.]+)" height="([\d.]+)"/);
  const nh = +h - 47.5;
  return str.replace(/width="[\d.]+" height="[\d.]+" viewBox="[^"]+"/, `width="${w}" height="${nh}" viewBox="0 47.5 ${w} ${nh}"`);
}

function labelBarSvg(title, right, W = 830) {
  const pad = W < 600 ? 16 : 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40" viewBox="0 0 ${W} 40" role="img" aria-label="${esc(title)}">
<style>${STYLE()}</style>
<rect x=".5" y=".5" width="${W - 1}" height="39" fill="${T.bg}" stroke="${T.line}"/>
<text x="${pad}" y="25" class="t">${esc(title.toUpperCase())}</text>
<text x="${W - pad}" y="25" class="tc" text-anchor="end">${esc(right)}</text>
</svg>`;
}

function workRowSvg(p, i) {
  const H = 84;
  const tagsW = 280, yearW = 70, arrowW = 60;
  const xTags = W - arrowW - yearW - tagsW;
  let tx = xTags + 20;
  const tags = p.tags
    .map((t) => {
      const label = t.toUpperCase();
      const w = Math.round(charW(label, 9, 0.12) + 16);
      const g = `<rect x="${tx + 0.5}" y="${H / 2 - 9.5}" width="${w}" height="19" fill="none" stroke="${T.line}"/><text x="${tx + w / 2}" y="${H / 2 + 3.5}" class="tag" text-anchor="middle">${esc(label)}</text>`;
      tx += w + 4;
      return g;
    })
    .join("");
  return svg(W, H, p.name, `<line x1="44" y1="0" x2="44" y2="${H}" stroke="${T.line}"/>
<text x="22" y="${H / 2 + 4}" class="pn" text-anchor="middle">${String(i + 1).padStart(2, "0")}</text>
<text x="76" y="38" class="name">${esc(p.name)}</text>
<text x="76" y="58" class="desc">${esc(p.desc)}</text>
<line x1="${xTags}" y1="0" x2="${xTags}" y2="${H}" stroke="${T.line}"/>
${tags}
<text x="${W - arrowW - 20}" y="${H / 2 + 4}" class="yr" text-anchor="end">${p.year}</text>
<line x1="${W - arrowW}" y1="0" x2="${W - arrowW}" y2="${H}" stroke="${T.line}"/>
<path d="M${W - 36} ${H / 2 + 6} l12 -12 M${W - 33} ${H / 2 - 6} h9 v9" fill="none" stroke="${T.accent}" stroke-width="1.6"/>`, `
  .pn{font:700 11px ${T.sans};letter-spacing:.06em;fill:${T.dim}}
  .name{font:700 18px ${T.sans};letter-spacing:-.025em;fill:${T.text}}
  .desc{font:400 13px ${T.sans};fill:${T.muted}}
  .tag{font:700 9px ${T.sans};letter-spacing:.08em;fill:${T.muted}}
  .yr{font:600 11px ${T.sans};letter-spacing:.04em;fill:${T.dim}}`);
}

function moreSvg() {
  const rows = Math.ceil(CONTENT.more.length / 2), rh = 56, H = 48 + rows * rh;
  const cells = CONTENT.more
    .map(([n, d], i) => {
      const x = (i % 2) * (W / 2), y = 48 + Math.floor(i / 2) * rh;
      return `<text x="${x + 24}" y="${y + 26}" class="name">${esc(n)}</text><text x="${x + 24}" y="${y + 44}" class="desc">${esc(d)}</text>`;
    })
    .join("\n");
  const lines = Array.from({ length: rows - 1 }, (_, r) => `<line x1="0" y1="${48 + (r + 1) * rh}" x2="${W}" y2="${48 + (r + 1) * rh}" stroke="${T.line}"/>`).join("");
  return frame(W, H, "Also built", `<line x1="${W / 2}" y1="48" x2="${W / 2}" y2="${H}" stroke="${T.line}"/>${lines}\n${cells}`, `${String(CONTENT.more.length).padStart(2, "0")} PROJECTS`)
    .replace("</style>", `.name{font:700 15px ${T.sans};letter-spacing:-.02em;fill:${T.text}}.desc{font:400 12px ${T.sans};fill:${T.muted}}</style>`);
}

function experienceSvg() {
  const rh = 62, H = 48 + CONTENT.experience.length * rh;
  const rows = CONTENT.experience
    .map(([yr, role, place], i) => {
      const y = 48 + i * rh;
      return `${i ? `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${T.line}"/>` : ""}
<text x="24" y="${y + 27}" class="yr">${esc(yr.toUpperCase())}</text>
<text x="168" y="${y + 27}" class="role">${esc(role)}</text>
<text x="168" y="${y + 45}" class="place">${esc(place)}</text>`;
    })
    .join("\n");
  return frame(W, H, "Experience", `<line x1="144" y1="48" x2="144" y2="${H}" stroke="${T.line}"/>\n${rows}`, `${String(CONTENT.experience.length).padStart(2, "0")} ROLES`).replace(
    "</style>",
    `.yr{font:600 11px ${T.sans};letter-spacing:.06em;fill:${T.dim}}.role{font:700 14px ${T.sans};letter-spacing:-.01em;fill:${T.text}}.place{font:400 12px ${T.sans};fill:${T.muted}}</style>`
  );
}

async function capabilitiesSvg(W = 830, cols = 4, rh = 64) {
  const cw = W / cols;
  const items = CONTENT.capabilities;
  const H = 48 + Math.ceil(items.length / cols) * rh;
  // Icons come from the simple-icons package (installed by the workflow).
  const si = await import("simple-icons").catch(() => null);
  if (!si) console.warn("simple-icons not installed; using letter tiles");
  const icons = items.map(([, slug]) => (slug && si ? si["si" + slug[0].toUpperCase() + slug.slice(1)]?.path : null) || null);
  const cells = items
    .map(([name, , abbr], i) => {
      const x = (i % cols) * cw, y = 48 + Math.floor(i / cols) * rh;
      const ix = x + (W < 600 ? 16 : 24), iy = y + rh / 2 - 10;
      const icon = icons[i]
        ? `<path d="${icons[i]}" transform="translate(${ix} ${iy}) scale(${20 / 24})" fill="${T.muted}" opacity=".6"/>`
        : `<rect x="${ix + 0.5}" y="${iy + 0.5}" width="19" height="19" fill="none" stroke="${T.dim}"/><text x="${ix + 10}" y="${iy + 13.5}" class="ab" text-anchor="middle">${esc(abbr || name.slice(0, 2))}</text>`;
      return `${icon}<text x="${ix + 34}" y="${y + rh / 2 + 5}" class="cap">${esc(name)}</text>`;
    })
    .join("\n");
  const grid =
    Array.from({ length: cols - 1 }, (_, c) => `<line x1="${(c + 1) * cw}" y1="48" x2="${(c + 1) * cw}" y2="${H}" stroke="${T.line}"/>`).join("") +
    Array.from({ length: Math.ceil(items.length / cols) - 1 }, (_, r) => `<line x1="0" y1="${48 + (r + 1) * rh}" x2="${W}" y2="${48 + (r + 1) * rh}" stroke="${T.line}"/>`).join("");
  return frame(W, H, "Capabilities", `${grid}\n${cells}`, `${items.length} TOOLS`).replace(
    "</style>",
    `.cap{font:700 14px ${T.sans};letter-spacing:-.01em;fill:${T.muted}}.ab{font:700 9px ${T.sans};fill:${T.dim}}</style>`
  );
}

function contactSvg() {
  const H = 300, split = 430;
  return svg(W, H, "Let's build together.", `<text x="24" y="29" class="t">CONTACT</text>
<text x="${W - 24}" y="29" class="tc" text-anchor="end">OPEN TO WORK</text>
<line x1="0" y1="48" x2="${W}" y2="48" stroke="${T.line}"/>
<line x1="${split}" y1="48" x2="${split}" y2="${H}" stroke="${T.line}"/>
<text x="24" y="138" class="h">Let's build</text>
<text x="24" y="196" class="h"><tspan fill="${T.accent}">together.</tspan></text>
<text x="24" y="236" class="p">Open to freelance projects, full-time roles,</text>
<text x="24" y="258" class="p">and interesting collaborations.</text>
<text x="${split + 24}" y="86" class="t">DIRECT EMAIL</text>
<text x="${split + 24}" y="122" class="mail">${esc(CONTENT.email)}</text>
<line x1="${split}" y1="160" x2="${W}" y2="160" stroke="${T.line}"/>
<text x="${split + 24}" y="196" class="t">BASED IN</text>
<text x="${split + 24}" y="220" class="v">Kalinga, Philippines</text>
<text x="${split + 200}" y="196" class="t">TIMEZONE</text>
<text x="${split + 200}" y="220" class="v">GMT+8</text>
<text x="${split + 24}" y="262" class="t">STATUS</text>
<circle cx="${split + 28}" cy="281" r="3" fill="${T.green}"/>
<text x="${split + 40}" y="285" class="v">Available for new work</text>`, `
  .h{font:900 56px ${T.sans};letter-spacing:-.04em;fill:${T.text}}
  .p{font:400 14px ${T.sans};fill:${T.muted}}
  .mail{font:800 26px ${T.sans};letter-spacing:-.02em;fill:${T.text}}
  .v{font:600 13px ${T.sans};fill:${T.text}}`);
}

/* ------------------------------------------------------------------ mobile layouts */
// Phone-width versions (390 wide), shown by the README below 600px so text
// stays close to its designed size instead of shrinking to ~40%.

const MW = 390;

function wrap(text, max) {
  const out = [];
  let line = "";
  for (const w of text.split(" ")) {
    if ((line + " " + w).trim().length > max) {
      out.push(line.trim());
      line = w;
    } else line += " " + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

function heroM() {
  const H = 170;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${H}" viewBox="0 0 ${MW} ${H}" role="img" aria-label="Kenji.">
<style>${FONT_FACE}
  .e{font:700 9px ${T.sans};letter-spacing:.12em;fill:${T.muted}}
  .name{font:900 104px ${T.sans};letter-spacing:-.05em;fill:${T.text}}
</style>
<defs><pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1" fill="${T.line}"/></pattern></defs>
<rect x=".5" y=".5" width="${MW - 1}" height="${H - 1}" fill="${T.bg}" stroke="${T.line}"/>
<text x="16" y="24" class="e">SOFTWARE ENGINEER &amp; BUILDER</text>
<circle cx="${MW - 16 - 70}" cy="20.8" r="2.8" fill="${T.green}"/>
<text x="${MW - 16}" y="24" class="e" text-anchor="end">AVAILABLE</text>
<line x1="0" y1="40" x2="${MW}" y2="40" stroke="${T.line}"/>
<rect x="1" y="41" width="${MW - 2}" height="${H - 42}" fill="url(#dots)"/>
<text x="14" y="134" class="name">Kenji<tspan fill="${T.accent}">.</tspan></text>
</svg>`;
}

function aboutM(commitsThisYear) {
  const lines = wrap(CONTENT.about.join(" "), 44);
  const pTop = 48 + 30, pH = lines.length * 23;
  const gridY = pTop + pH + 6, ch = 88, cw = MW / 2;
  const H = gridY + ch * 2;
  const stats = [
    ["5", "+", "Years experience"],
    ["10", "+", "Unfinished side projects"],
    [fmt(commitsThisYear), "", "Commits this year"],
    ["100", "%", "Model quota used"],
  ];
  const cells = stats
    .map(([n, sup, l], i) => {
      const x = (i % 2) * cw, y = gridY + Math.floor(i / 2) * ch;
      const lab = wrap(l.toUpperCase(), 20);
      return `<text x="${x + 16}" y="${y + 44}" class="num">${n}<tspan class="sup" dy="-12">${sup}</tspan></text>
${lab.map((t, j) => `<text x="${x + 16}" y="${y + 64 + j * 13}" class="sl">${t}</text>`).join("")}`;
    })
    .join("\n");
  return svg(MW, H, "About", `<text x="16" y="29" class="t">ABOUT</text>
<text x="${MW - 16}" y="29" class="tc" text-anchor="end">${CONTENT.location}</text>
<line x1="0" y1="48" x2="${MW}" y2="48" stroke="${T.line}"/>
${lines.map((l, i) => `<text x="16" y="${pTop + i * 23}" class="p">${esc(l)}</text>`).join("\n")}
<line x1="0" y1="${gridY}" x2="${MW}" y2="${gridY}" stroke="${T.line}"/>
<line x1="0" y1="${gridY + ch}" x2="${MW}" y2="${gridY + ch}" stroke="${T.line}"/>
<line x1="${cw}" y1="${gridY}" x2="${cw}" y2="${H}" stroke="${T.line}"/>
${cells}`, `
  .p{font:400 14px ${T.sans};fill:${T.muted}}
  .num{font:900 34px ${T.sans};letter-spacing:-.05em;fill:${T.text}}
  .sup{font:900 16px ${T.sans};fill:${T.accent}}
  .sl{font:600 10px ${T.sans};letter-spacing:.08em;fill:${T.muted}}`);
}

function workRowM(p, i) {
  const H = 110;
  let tx = 16;
  const tags = p.tags
    .map((t) => {
      const label = t.toUpperCase();
      const w = Math.round(charW(label, 9, 0.12) + 16);
      const g = `<rect x="${tx + 0.5}" y="78.5" width="${w}" height="19" fill="none" stroke="${T.line}"/><text x="${tx + w / 2}" y="91.5" class="tag" text-anchor="middle">${esc(label)}</text>`;
      tx += w + 4;
      return g;
    })
    .join("");
  return svg(MW, H, p.name, `<text x="16" y="30" class="pn">${String(i + 1).padStart(2, "0")}</text>
<text x="${MW - 60}" y="30" class="yr" text-anchor="end">${p.year}</text>
<path d="M${MW - 34} 32 l12 -12 M${MW - 31} 20 h9 v9" fill="none" stroke="${T.accent}" stroke-width="1.6"/>
<text x="16" y="54" class="name">${esc(p.name)}</text>
<text x="16" y="70" class="desc">${esc(p.desc)}</text>
${tags}`, `
  .pn{font:700 11px ${T.sans};letter-spacing:.06em;fill:${T.dim}}
  .name{font:700 18px ${T.sans};letter-spacing:-.025em;fill:${T.text}}
  .desc{font:400 12.5px ${T.sans};fill:${T.muted}}
  .tag{font:700 9px ${T.sans};letter-spacing:.08em;fill:${T.muted}}
  .yr{font:600 11px ${T.sans};letter-spacing:.04em;fill:${T.dim}}`);
}

function listM(title, right, rows, rh = 54) {
  const H = 48 + rows.length * rh;
  const body = rows
    .map(([a, b, c], i) => {
      const y = 48 + i * rh;
      return `${i ? `<line x1="0" y1="${y}" x2="${MW}" y2="${y}" stroke="${T.line}"/>` : ""}
${c ? `<text x="16" y="${y + 20}" class="yr">${esc(c.toUpperCase())}</text>` : ""}
<text x="16" y="${y + (c ? 39 : 24)}" class="name">${esc(a)}</text>
<text x="${c ? MW - 16 : 16}" y="${y + (c ? 39 : 42)}" class="desc" ${c ? 'text-anchor="end"' : ""}>${esc(b)}</text>`;
    })
    .join("\n");
  return frame(MW, H, title, body, right).replace(
    "</style>",
    `.name{font:700 15px ${T.sans};letter-spacing:-.02em;fill:${T.text}}.desc{font:400 12px ${T.sans};fill:${T.muted}}.yr{font:600 10px ${T.sans};letter-spacing:.06em;fill:${T.dim}}</style>`
  );
}

function experienceM() {
  const rh = 72, H = 48 + CONTENT.experience.length * rh;
  const rows = CONTENT.experience
    .map(([yr, role, place], i) => {
      const y = 48 + i * rh;
      return `${i ? `<line x1="0" y1="${y}" x2="${MW}" y2="${y}" stroke="${T.line}"/>` : ""}
<text x="16" y="${y + 22}" class="yr">${esc(yr.toUpperCase())}</text>
<text x="16" y="${y + 42}" class="role">${esc(role)}</text>
<text x="16" y="${y + 59}" class="place">${esc(place)}</text>`;
    })
    .join("\n");
  return frame(MW, H, "Experience", rows, `${String(CONTENT.experience.length).padStart(2, "0")} ROLES`).replace(
    "</style>",
    `.yr{font:600 10px ${T.sans};letter-spacing:.06em;fill:${T.dim}}.role{font:700 15px ${T.sans};letter-spacing:-.01em;fill:${T.text}}.place{font:400 12px ${T.sans};fill:${T.muted}}</style>`
  );
}

async function capabilitiesM() {
  const full = await capabilitiesSvg(MW, 2, 52);
  return full;
}

function activityM(data) {
  const s = data.stats, r = rank(s);
  const R = 34, C = 2 * Math.PI * R, filled = C * (1 - r.percentile / 100);
  const rows = [["Total stars", s.stars], ["Commits", s.commits], ["Pull requests", s.prs], ["Issues", s.issues], ["Contributed to", s.contributedTo]];
  const statsH = 48 + 160;
  const stats = frame(MW, statsH, "GitHub stats", rows
    .map(([k, v], i) => `<text x="16" y="${78 + i * 26}" class="lbl">${k}</text><text x="${MW - 136}" y="${78 + i * 26}" class="val" text-anchor="end">${fmt(v)}</text>`)
    .join("\n") + `
<line x1="${MW - 116}" y1="64" x2="${MW - 116}" y2="${statsH - 16}" stroke="${T.line}"/>
<g transform="translate(${MW - 58} 118)">
  <circle r="${R}" fill="none" stroke="${T.empty}" stroke-width="5"/>
  <circle r="${R}" fill="none" stroke="${T.accent}" stroke-width="5" stroke-dasharray="${C}" stroke-dashoffset="${C - filled}" transform="rotate(-90)"/>
  <text y="9" text-anchor="middle" style="font:900 26px ${T.sans};fill:${T.text};letter-spacing:-.04em">${r.level}</text>
</g>
<text x="${MW - 58}" y="${statsH - 22}" class="sub" text-anchor="middle">TOP ${Math.round(r.percentile)}%</text>`, "ALL TIME");

  const top = data.langs.slice(0, 6), sum = top.reduce((a, l) => a + l.size, 0) || 1;
  const shades = [1, 0.8, 0.62, 0.46, 0.32, 0.2];
  let bx = 16;
  const langsH = 48 + 30 + 3 * 26 + 10;
  const langs = frame(MW, langsH, "Top languages", top
    .map((l, i) => { const w = Math.max((l.size / sum) * (MW - 32), 2); const seg = `<rect x="${bx.toFixed(2)}" y="64" width="${w.toFixed(2)}" height="8" fill="${T.accent}" fill-opacity="${shades[i]}"/>`; bx += w; return seg; })
    .join("") + top
    .map((l, i) => { const x = 16 + (i % 2) * 183, y = 100 + Math.floor(i / 2) * 26; return `<rect x="${x}" y="${y - 9}" width="9" height="9" fill="${T.accent}" fill-opacity="${shades[i]}"/><text x="${x + 17}" y="${y}" class="lbl" style="fill:${T.text}">${esc(l.name)}</text><text x="${x + 167}" y="${y}" class="sub" text-anchor="end">${((l.size / sum) * 100).toFixed(1)}%</text>`; })
    .join(""), "BY SIZE");

  const st = streaks(data.days);
  const cols = [["Total", fmt(st.total), T.text], ["Longest streak", `${st.longest.length}d`, T.accent], ["Active days", fmt(st.activeDays), T.text]];
  const cw = MW / 3, contribH = 48 + 76;
  const contrib = frame(MW, contribH, "Contributions", cols
    .map(([k, v, c], i) => `${i ? `<line x1="${i * cw}" y1="48" x2="${i * cw}" y2="${contribH}" stroke="${T.line}"/>` : ""}<text x="${i * cw + 16}" y="74" class="lbl" style="font-size:11px">${k}</text><text x="${i * cw + 16}" y="106" class="big" style="font-size:28px;fill:${c}">${v}</text>`)
    .join(""), `SINCE ${st.firstDay.slice(0, 4)}`);

  const weeks = data.heat.weeks.slice(-22);
  const sixTotal = weeks.flat().reduce((a, d) => a + d.count, 0);
  const heat = heatmapCard(weeks, sixTotal, MW, "Last 5 months", "CONTRIBUTIONS");
  const heatH = +heat.match(/height="(\d+)"/)[1];

  const parts = [[labelBarSvg("Activity", "EVERY 6 HOURS", MW), 0, 0]];
  let y = 39;
  for (const [svgStr, h] of [[stats, statsH], [langs, langsH], [contrib, contribH], [heat, heatH]]) {
    parts.push([svgStr, 0, y]);
    y += h - 1;
  }
  return compose(MW, y + 1, "Activity", parts);
}

function contactM() {
  const H = 330;
  return svg(MW, H, "Let's build together.", `<text x="16" y="29" class="t">CONTACT</text>
<text x="${MW - 16}" y="29" class="tc" text-anchor="end">OPEN TO WORK</text>
<line x1="0" y1="48" x2="${MW}" y2="48" stroke="${T.line}"/>
<text x="16" y="104" class="h">Let's build</text>
<text x="16" y="146" class="h"><tspan fill="${T.accent}">together.</tspan></text>
<text x="16" y="176" class="p">Open to freelance projects, full-time roles,</text>
<text x="16" y="196" class="p">and interesting collaborations.</text>
<line x1="0" y1="218" x2="${MW}" y2="218" stroke="${T.line}"/>
<text x="16" y="242" class="t">DIRECT EMAIL</text>
<text x="16" y="268" class="mail">${esc(CONTENT.email)}</text>
<line x1="0" y1="284" x2="${MW}" y2="284" stroke="${T.line}"/>
<circle cx="20" cy="303" r="3" fill="${T.green}"/>
<text x="30" y="307" class="v">Available · Kalinga, PH · GMT+8</text>`, `
  .h{font:900 42px ${T.sans};letter-spacing:-.04em;fill:${T.text}}
  .p{font:400 13px ${T.sans};fill:${T.muted}}
  .mail{font:800 20px ${T.sans};letter-spacing:-.02em;fill:${T.text}}
  .v{font:600 12px ${T.sans};fill:${T.text}}`);
}

/* ------------------------------------------------------------------ hero + footer */

function heroSvg() {
  const W = 830, H = 230;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kenji.">
<style>${FONT_FACE}
  .e{font:700 10px ${T.sans};letter-spacing:.14em;fill:${T.muted}}
  .name{font:900 150px ${T.sans};letter-spacing:-.05em;fill:${T.text}}
</style>
<defs><pattern id="dots" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="1" fill="${T.line}"/></pattern></defs>
<rect width="${W}" height="${H}" fill="${T.bg}"/>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="none" stroke="${T.line}"/>
<text x="24" y="27" class="e">SOFTWARE ENGINEER &amp; BUILDER</text>
<circle cx="${W - 24 - 76}" cy="23.5" r="3" fill="${T.green}"/>
<text x="${W - 24}" y="27" class="e" text-anchor="end">AVAILABLE</text>
<line x1="0" y1="44" x2="${W}" y2="44" stroke="${T.line}"/>
<rect x="1" y="45" width="${W - 2}" height="${H - 46}" fill="url(#dots)"/>
<text x="28" y="182" class="name">Kenji<tspan fill="${T.accent}">.</tspan></text>
</svg>`;
}

function footerSvg(W = 830, H = 140) {
  const text = "KENJI VON ASHLEY";
  const t = (attrs) => `<text x="${W / 2}" y="${(H / 2 + (W / 10.4) * 0.33).toFixed(1)}" text-anchor="middle" textLength="${W - 48}" lengthAdjust="spacingAndGlyphs" class="f" ${attrs}>${text}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kenji Von Ashley">
<style>${FONT_FACE}
  .f{font:900 ${Math.round(W / 10.4)}px ${T.sans};letter-spacing:-.06em}
</style>
<defs>
  <radialGradient id="g" cx="50%" cy="50%" r="45%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="m"><rect width="${W}" height="${H}" fill="url(#g)"/></mask>
</defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="${T.bg}" stroke="${T.line}"/>
${t(`fill="${T.empty}"`)}
<g mask="url(#m)">${t(`fill="${T.accent}"`)}</g>
</svg>`;
}

/* ------------------------------------------------------------------ data */

async function gql(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${TOKEN}`, "Content-Type": "application/json", "User-Agent": "profile-stats" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function fetchAll() {
  const base = await gql(
    `query($u:String!){ user(login:$u){
      createdAt
      followers{totalCount}
      pullRequests{totalCount}
      openIssues:issues(states:OPEN){totalCount}
      closedIssues:issues(states:CLOSED){totalCount}
      repositoriesContributedTo(contributionTypes:[COMMIT,ISSUE,PULL_REQUEST,REPOSITORY]){totalCount}
      contributionsCollection{ contributionYears totalPullRequestReviewContributions }
    }}`,
    { u: USERNAME }
  );
  const u = base.user;

  // Owned repos: stars + language sizes
  let stars = 0, after = null;
  const langMap = new Map();
  do {
    const d = await gql(
      `query($u:String!,$a:String){ user(login:$u){ repositories(first:100,after:$a,ownerAffiliations:OWNER,isFork:false){
        pageInfo{hasNextPage endCursor}
        nodes{ stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){ edges{size node{name}} } }
      }}}`,
      { u: USERNAME, a: after }
    );
    const r = d.user.repositories;
    for (const n of r.nodes) {
      stars += n.stargazerCount;
      for (const e of n.languages.edges) langMap.set(e.node.name, (langMap.get(e.node.name) || 0) + e.size);
    }
    after = r.pageInfo.hasNextPage ? r.pageInfo.endCursor : null;
  } while (after);

  // Every contribution year: commits + full calendar
  let commits = 0, commitsThisYear = 0;
  const days = [];
  let lastYear = null;
  for (const y of u.contributionsCollection.contributionYears) {
    const from = `${y}-01-01T00:00:00Z`, to = `${y}-12-31T23:59:59Z`;
    const d = await gql(
      `query($u:String!,$f:DateTime!,$t:DateTime!){ user(login:$u){ contributionsCollection(from:$f,to:$t){
        totalCommitContributions restrictedContributionsCount
        contributionCalendar{ weeks{ contributionDays{ date contributionCount contributionLevel } } }
      }}}`,
      { u: USERNAME, f: from, t: to }
    );
    const c = d.user.contributionsCollection;
    commits += c.totalCommitContributions + c.restrictedContributionsCount;
    if (y === new Date().getUTCFullYear()) commitsThisYear = c.totalCommitContributions + c.restrictedContributionsCount;
    for (const w of c.contributionCalendar.weeks) for (const x of w.contributionDays) days.push(x);
  }

  // Rolling last-year calendar for the heatmap
  const last = await gql(
    `query($u:String!){ user(login:$u){ contributionsCollection{ contributionCalendar{ totalContributions
      weeks{ contributionDays{ date contributionCount contributionLevel } } } } } }`,
    { u: USERNAME }
  );
  lastYear = last.user.contributionsCollection.contributionCalendar;

  return {
    stats: {
      stars,
      commits,
      prs: u.pullRequests.totalCount,
      issues: u.openIssues.totalCount + u.closedIssues.totalCount,
      reviews: u.contributionsCollection.totalPullRequestReviewContributions,
      followers: u.followers.totalCount,
      contributedTo: u.repositoriesContributedTo.totalCount,
      commitsThisYear,
    },
    langs: [...langMap].map(([name, size]) => ({ name, size })).sort((a, b) => b.size - a.size),
    days: days.map((d) => ({ date: d.date, count: d.contributionCount })),
    heat: {
      total: lastYear.totalContributions,
      weeks: lastYear.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: d.contributionLevel }))),
    },
  };
}

function mockData() {
  const today = new Date();
  const days = [];
  for (let i = 1400; i >= 0; i--) {
    const d = new Date(today - i * 864e5).toISOString().slice(0, 10);
    const r = Math.random();
    days.push({ date: d, count: r < 0.3 ? 0 : Math.floor(r * r * 25) });
  }
  const recent = days.slice(-371);
  const start = recent.findIndex((d) => new Date(d.date + "T00:00:00Z").getUTCDay() === 0);
  const weeks = [];
  for (let i = start; i < recent.length; i += 7) weeks.push(recent.slice(i, i + 7));
  const lv = (c) => (c === 0 ? "NONE" : c < 4 ? "FIRST_QUARTILE" : c < 8 ? "SECOND_QUARTILE" : c < 14 ? "THIRD_QUARTILE" : "FOURTH_QUARTILE");
  return {
    stats: { stars: 42, commits: 3050, prs: 61, issues: 18, reviews: 4, followers: 37, contributedTo: 14, commitsThisYear: 1890 },
    langs: [["TypeScript", 900], ["JavaScript", 300], ["PHP", 220], ["Python", 160], ["CSS", 120], ["Blade", 60], ["Dart", 40], ["Shell", 12]].map(([name, size]) => ({ name, size })),
    days,
    heat: { total: 3060, weeks: weeks.map((w) => w.map((d) => ({ ...d, level: lv(d.count) }))) },
  };
}

function streaks(days) {
  const today = new Date().toISOString().slice(0, 10);
  const ds = days.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const firstIdx = ds.findIndex((d) => d.count > 0);
  const live = firstIdx < 0 ? [] : ds.slice(firstIdx);
  let total = 0, active = 0, run = 0, runStart = null;
  let longest = { length: 0, start: null, end: null };
  for (const d of live) {
    total += d.count;
    if (d.count > 0) {
      active++;
      if (run === 0) runStart = d.date;
      run++;
      if (run > longest.length) longest = { length: run, start: runStart, end: d.date };
    } else run = 0;
  }
  return {
    total,
    activeDays: active,
    activePct: live.length ? Math.round((active / live.length) * 100) : 0,
    firstDay: live[0]?.date || today,
    longest,
  };
}

/* ------------------------------------------------------------------ main */

if (!MOCK && !TOKEN) {
  console.error("GH_TOKEN is not set");
  process.exit(1);
}
const data = MOCK ? mockData() : await fetchAll();
await mkdir(OUT, { recursive: true });
let count = 0;
for (const theme of Object.keys(THEMES)) {
  Object.assign(T, THEMES[theme]);
  const bar = (t, r) => labelBarSvg(t, r);
  const workRows = CONTENT.work.map((p, i) => workRowSvg(p, i));
  const files = {
    "hero.svg": heroSvg(),
    "about.svg": aboutSvg(data.stats.commitsThisYear),
    "more.svg": cropHeader(moreSvg()),
    "more-summary.svg": buttonSvg({ label: `Also built · ${CONTENT.more.length} more projects`, icon: "plus" }),
    "experience.svg": experienceSvg(),
    "capabilities.svg": await capabilitiesSvg(),
    "contact.svg": contactSvg(),
    "footer.svg": footerSvg(),
  };
  CONTENT.links.forEach((b) => (files[`btn-${b.id}.svg`] = buttonSvg(b)));
  // First work row carries the section label so the list reads as one block
  files["work-1.svg"] = compose(W, 40 + 84 - 1, CONTENT.work[0].name, [
    [bar("Selected work", `${String(CONTENT.work.length).padStart(2, "0")} PROJECTS`), 0, 0],
    [workRows[0], 0, 39],
  ]);
  workRows.slice(1).forEach((r, i) => (files[`work-${i + 2}.svg`] = r));
  // Activity: label + stats/languages side by side + contributions + heatmap, as one card
  {
    const st = statsCard(data.stats), lg = langsCard(data.langs);
    const sk = streakCard(streaks(data.days)), hm = heatmapCard(data.heat.weeks, data.heat.total);
    const hmH = +hm.match(/height="(\d+)"/)[1];
    const y1 = 39, y2 = y1 + 220 - 1, y3 = y2 + 164 - 1;
    files["activity.svg"] = compose(W, y3 + hmH, "Activity", [
      [bar("Activity", "UPDATED EVERY 6 HOURS"), 0, 0],
      [st, 0, y1],
      [lg, 414, y1],
      [sk, 0, y2],
      [hm, 0, y3],
    ]);
  }
  // Phone layouts
  const mRows = CONTENT.work.map((p, i) => workRowM(p, i));
  Object.assign(files, {
    "hero-m.svg": heroM(),
    "about-m.svg": aboutM(data.stats.commitsThisYear),
    "work-1-m.svg": compose(MW, 40 + 110 - 1, CONTENT.work[0].name, [
      [labelBarSvg("Selected work", `${String(CONTENT.work.length).padStart(2, "0")} PROJECTS`, MW), 0, 0],
      [mRows[0], 0, 39],
    ]),
    "more-m.svg": cropHeader(listM("Also built", `${String(CONTENT.more.length).padStart(2, "0")} PROJECTS`, CONTENT.more)),
    "experience-m.svg": experienceM(),
    "capabilities-m.svg": await capabilitiesSvg(MW, 2, 52),
    "activity-m.svg": activityM(data),
    "contact-m.svg": contactM(),
    "footer-m.svg": footerSvg(MW, 90),
  });
  mRows.slice(1).forEach((r, i) => (files[`work-${i + 2}-m.svg`] = r));
  await Promise.all(Object.entries(files).map(([n, c]) => writeFile(new URL(n.replace(".svg", `-${theme}.svg`), OUT), c)));
  count += Object.keys(files).length;
}
console.log(`Wrote ${count} SVGs` + (FONT_FACE ? " with Satoshi" : " (system fonts)"), MOCK ? "(mock data)" : "");
