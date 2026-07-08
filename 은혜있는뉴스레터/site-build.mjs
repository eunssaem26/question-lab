#!/usr/bin/env node
// 아카이브 사이트 빌더 — 모든 호를 모아 하나의 홈페이지 + 각 호 페이지로 배포용 폴더(public/)를 만든다.
// 사용법:  node site-build.mjs
//   결과:  public/index.html            (지난 호 목록 홈)
//          public/<YYYY-MM>/index.html  (각 호)
// 배포:    vercel public --prod   (또는 Vercel 대시보드에 public 폴더 연결)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");
const issuesDir = path.join(root, "issues");
const outDir = path.join(root, "public");

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// public 초기화
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

// 이슈 폴더 수집 (content.json 있는 것), 이름순 = 번호순
const issueFolders = fs
  .readdirSync(issuesDir)
  .filter((n) => fs.existsSync(path.join(issuesDir, n, "content.json")))
  .sort();

function firstPhoto(data) {
  if (data.cover && data.cover.src) return data.cover.src;
  for (const s of data.sections || []) {
    for (const it of s.items || []) {
      if (it.t === "photo" && it.src) return it.src;
      if (it.t === "gallery" && it.photos && it.photos[0]) return it.photos[0].src;
    }
  }
  return null;
}

function thumbDataURI(photosDir, src, max = 800) {
  const input = path.join(photosDir, src);
  if (!fs.existsSync(input)) return null;
  const cache = path.join(outDir, ".thumbcache");
  fs.mkdirSync(cache, { recursive: true });
  const out = path.join(cache, `${path.parse(src).name}-${max}.jpg`);
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", String(max), input, "--out", out], { stdio: "ignore" });
  return `data:image/jpeg;base64,${fs.readFileSync(out).toString("base64")}`;
}

const issues = [];
for (const folder of issueFolders) {
  const dir = path.join(issuesDir, folder);
  const data = JSON.parse(fs.readFileSync(path.join(dir, "content.json"), "utf8"));

  // 각 호 최신 빌드 보장
  execFileSync("node", ["build.mjs", `issues/${folder}`], { cwd: root, stdio: "ignore" });

  const slug = folder.replace(/^\d+-/, ""); // 01-2026-07 → 2026-07
  fs.mkdirSync(path.join(outDir, slug), { recursive: true });
  fs.copyFileSync(path.join(dir, "index.html"), path.join(outDir, slug, "index.html"));

  const photosDir = path.resolve(dir, data.meta.photosDir);
  const photo = firstPhoto(data);
  const thumb = photo ? thumbDataURI(photosDir, photo) : null;

  issues.push({
    slug,
    thumb,
    issueNo: data.meta.issueNo || "",
    issueLabel: data.meta.issueLabel || "",
    brand: data.meta.brand || "은혜있는 뉴스레터",
    volNum: parseInt((data.meta.issueNo || "0").replace(/\D/g, ""), 10) || 0,
  });
}

// 최신 호가 위로
issues.sort((a, b) => b.volNum - a.volNum);
const latest = issues[0];

const style = `<style>
  :root{ --paper:#F5F3EC; --raised:#FFFFFF; --ink:#232821; --muted:#5F6A59;
    --green:#3E6B4F; --green-2:#2F7D5A; --sun:#C98A24; --line:#E1DBC9; --on-green:#FBFDF7;
    --kr:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;
    --serif:Georgia,"Times New Roman",serif; }
  @media (prefers-color-scheme:dark){ :root{ --paper:#14180F; --raised:#1E241A; --ink:#ECEADE; --muted:#9CA690;
    --green:#7BB489; --green-2:#8FC79E; --sun:#E0B24E; --line:#2E3626; --on-green:#10160B; } }
  :root[data-theme="light"]{ --paper:#F5F3EC; --raised:#FFFFFF; --ink:#232821; --muted:#5F6A59;
    --green:#3E6B4F; --green-2:#2F7D5A; --sun:#C98A24; --line:#E1DBC9; --on-green:#FBFDF7; }
  :root[data-theme="dark"]{ --paper:#14180F; --raised:#1E241A; --ink:#ECEADE; --muted:#9CA690;
    --green:#7BB489; --green-2:#8FC79E; --sun:#E0B24E; --line:#2E3626; --on-green:#10160B; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--kr);
    font-size:18px;line-height:1.8;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%}
  .wrap{max-width:720px;margin:0 auto;padding:0 22px}
  a{color:var(--green-2)}
  .mast{padding:60px 0 30px;text-align:center}
  .mast .studio{font-weight:800;font-size:14px;letter-spacing:.12em;color:var(--green);margin:0 0 6px}
  .mast .tagline{font-family:var(--serif);font-style:italic;font-size:14px;letter-spacing:.05em;color:var(--muted);margin:0 0 18px}
  .mast h1{font-size:clamp(30px,8vw,44px);line-height:1.2;margin:0;font-weight:800;letter-spacing:-.01em}
  .mast p.sub{margin:16px 0 0;color:var(--muted);font-size:16px;text-wrap:pretty}
  .rule{width:44px;height:2px;background:var(--sun);border:0;margin:22px auto 0}
  .list{display:flex;flex-direction:column;gap:18px;margin:34px 0 10px}
  .card{display:flex;gap:16px;align-items:stretch;text-decoration:none;color:var(--ink);
    background:var(--raised);border:1px solid var(--line);border-radius:16px;overflow:hidden;
    transition:border-color .15s,transform .05s,box-shadow .15s}
  .card:hover{border-color:var(--green)}
  .card:active{transform:translateY(1px)}
  .card:focus-visible{outline:2px solid var(--green-2);outline-offset:2px}
  .card .thumb{flex:none;width:132px;background:#0000000d}
  .card .thumb img{width:100%;height:100%;object-fit:cover;display:block}
  .card .body{padding:16px 18px;display:flex;flex-direction:column;justify-content:center;gap:5px;min-width:0}
  .card .vol{font-family:var(--serif);font-style:italic;color:var(--sun);font-size:14px}
  .card .label{font-weight:800;font-size:20px;line-height:1.25}
  .card .go{margin-top:4px;color:var(--green-2);font-weight:700;font-size:14px}
  .card.latest{border-color:var(--green)}
  .card .badge{display:inline-block;align-self:flex-start;background:var(--green);color:var(--on-green);
    font-size:11px;font-weight:800;letter-spacing:.06em;padding:3px 9px;border-radius:999px;margin-bottom:2px}
  footer{margin-top:44px;padding:30px 0 60px;border-top:1px solid var(--line);text-align:center;color:var(--muted)}
  footer .brand{font-weight:800;color:var(--ink);font-size:18px;margin-bottom:4px}
  footer .sign{font-family:var(--serif);font-style:italic;font-size:15px}
  @media (max-width:420px){ .card .thumb{width:104px} .card .label{font-size:18px} }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>`;

const cards = issues
  .map(
    (it, i) => `      <a class="card${i === 0 ? " latest" : ""}" href="./${esc(it.slug)}/">
        <span class="thumb">${it.thumb ? `<img src="${it.thumb}" alt="${esc(it.issueLabel)} 표지" />` : ""}</span>
        <span class="body">
          ${i === 0 ? `<span class="badge">최신호</span>` : ""}
          <span class="vol">${esc(it.issueNo)}</span>
          <span class="label">${esc(it.issueLabel)}</span>
          <span class="go">읽기 →</span>
        </span>
      </a>`
  )
  .join("\n");

const home = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>은혜있는 뉴스레터 — 지난 호</title>
<meta name="description" content="생각하는 글밭 · Where Thoughts Grow — 은혜있는 뉴스레터 지난 호 모음" />
${style}
</head>
<body>
  <div class="wrap">
    <header class="mast">
      <p class="studio">생각하는 글밭</p>
      <p class="tagline">Where Thoughts Grow</p>
      <h1>은혜있는 뉴스레터</h1>
      <p class="sub">기도와 사랑으로 함께해 주시는 동역자님께 전하는 소식.<br />지난 호를 모아 두었습니다.</p>
      <hr class="rule" />
    </header>
    <main class="list">
${cards}
    </main>
    <footer>
      <p class="brand">은혜있는 뉴스레터</p>
      <p class="sign">이재은 드림</p>
    </footer>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, "index.html"), home);
fs.rmSync(path.join(outDir, ".thumbcache"), { recursive: true, force: true });

console.log(`✓ 아카이브 사이트 생성: public/`);
console.log(`  홈: public/index.html`);
for (const it of issues) console.log(`  ${it.issueNo}  ${it.issueLabel}  → public/${it.slug}/`);
console.log(`\n배포:  vercel public --prod   (또는 Vercel에 public 폴더 연결)`);
