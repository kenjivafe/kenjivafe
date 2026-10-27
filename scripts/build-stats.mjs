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

// Matches the portfolio's dark theme (kenjivafe.vercel.app)
const T = {
  bg: "#10100e",
  line: "#30302b",
  empty: "#22221e",
  text: "#ffffe3",
  muted: "#c0c0ab",
  dim: "#8a8a7a",
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

function frame(w, h, num, title, body, right = "") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(title)}">
<style>${FONT_FACE}
  .t{font:700 10px ${T.sans};letter-spacing:.14em;fill:${T.muted}}
  .n{fill:${T.accent}}
  .lbl{font:500 13px ${T.sans};fill:${T.muted}}
  .val{font:700 15px ${T.sans};fill:${T.text};letter-spacing:-.01em}
  .big{font:900 40px ${T.sans};fill:${T.text};letter-spacing:-.05em}
  .sub{font:400 11px ${T.mono};fill:${T.dim}}
</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" fill="${T.bg}" stroke="${T.line}"/>
<text x="24" y="34" class="t"><tspan class="n">${num}</tspan>  ${esc(title.toUpperCase())}</text>
${right ? `<text x="${w - 24}" y="34" class="t" text-anchor="end">${right}</text>` : ""}
<line x1="24" y1="48" x2="${w - 24}" y2="48" stroke="${T.line}"/>
${body}
</svg>`;
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
  return frame(410, 220, "01", "GitHub stats", body);
}

function langsCard(langs) {
  const top = langs.slice(0, 8);
  const sum = top.reduce((a, l) => a + l.size, 0) || 1;
  const shades = [1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.22, 0.16];
  const W = 362;
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
      const lx = 24 + col * 190, ly = 106 + row * 28;
      return `<g>
  <rect x="${lx}" y="${ly - 9}" width="9" height="9" fill="${T.accent}" fill-opacity="${shades[i]}"/>
  <text x="${lx + 18}" y="${ly}" class="lbl" style="fill:${T.text}">${esc(l.name)}</text>
  <text x="${lx + 172}" y="${ly}" class="sub" text-anchor="end">${((l.size / sum) * 100).toFixed(1)}%</text>
</g>`;
    })
    .join("\n");
  return frame(410, 220, "02", "Top languages", bar + "\n" + list);
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
  return frame(830, 164, "03", "Contributions", body);
}

function heatmapCard(weeks, total) {
  const gap = 3, x0 = 24, y0 = 84;
  const step = (830 - 48 + gap) / weeks.length, cell = +(step - gap).toFixed(2);
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
    .map((o, i) => `<rect x="${830 - 24 - 34 - (5 - i) * 15}" y="${ly - 10}" width="12" height="12" ${o ? `fill="${T.accent}" fill-opacity="${o}"` : `fill="${T.empty}"`}/>`)
    .join("");
  const body = `${months.join("\n")}
<g>${cells}</g>
<text x="${x0}" y="${ly}" class="sub">${fmt(total)} CONTRIBUTIONS IN THE LAST YEAR</text>
<text x="${830 - 24 - 34 - 5 * 15 - 8}" y="${ly}" class="sub" text-anchor="end">LESS</text>${legend}
<text x="${830 - 24}" y="${ly}" class="sub" text-anchor="end">MORE</text>`;
  return frame(830, ly + 22, "04", "Last 12 months", body, `@${esc(USERNAME)}`);
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

function footerSvg() {
  const W = 830, H = 140, text = "KENJI VON ASHLEY";
  const t = (attrs) => `<text x="${W / 2}" y="${H / 2 + 26}" text-anchor="middle" textLength="${W - 48}" lengthAdjust="spacingAndGlyphs" class="f" ${attrs}>${text}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kenji Von Ashley">
<style>${FONT_FACE}
  .f{font:900 80px ${T.sans};letter-spacing:-.06em}
</style>
<defs>
  <radialGradient id="g" cx="50%" cy="50%" r="45%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <mask id="m"><rect width="${W}" height="${H}" fill="url(#g)"/></mask>
</defs>
<rect width="${W}" height="${H}" fill="${T.bg}"/>
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
  let commits = 0;
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
    stats: { stars: 42, commits: 3050, prs: 61, issues: 18, reviews: 4, followers: 37, contributedTo: 14 },
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
await Promise.all([
  writeFile(new URL("hero.svg", OUT), heroSvg()),
  writeFile(new URL("footer.svg", OUT), footerSvg()),
  writeFile(new URL("stats.svg", OUT), statsCard(data.stats)),
  writeFile(new URL("languages.svg", OUT), langsCard(data.langs)),
  writeFile(new URL("streak.svg", OUT), streakCard(streaks(data.days))),
  writeFile(new URL("heatmap.svg", OUT), heatmapCard(data.heat.weeks, data.heat.total)),
]);
console.log("Wrote hero, footer, stats, languages, streak, heatmap" + (FONT_FACE ? " with Satoshi" : " (system fonts)"), MOCK ? "(mock data)" : "");
