#!/usr/bin/env node
// 은혜있는 뉴스레터 — 정적 소식지 생성기
// 사용법:  node build.mjs issues/2026-여름
// 하는 일:  content.json + 사진 폴더 → 모바일 최적화 소식지 HTML (사진 내장, 링크 하나로 공유)
//
// 산출물 (해당 이슈 폴더 안):
//   index.html      브라우저/이메일/Vercel 어디서나 열리는 완성본 (사진 포함, 단일 파일)
//   _artifact.html  claude.ai Artifact 발행용 본문 (참고용)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const issueDir = process.argv[2] || "issues/2026-여름";
const root = path.resolve(issueDir);
const data = JSON.parse(fs.readFileSync(path.join(root, "content.json"), "utf8"));
const photosDir = path.resolve(root, data.meta.photosDir);
const cacheDir = path.join(root, ".cache");
fs.mkdirSync(cacheDir, { recursive: true });

// ---- 사진: 웹용으로 축소 + JPEG 압축 후 data URI로 내장 -------------------
const embedCache = new Map();
function embed(src, max = 1280, q = 68) {
  const key = `${src}@${max}q${q}`;
  if (embedCache.has(key)) return embedCache.get(key);
  const input = path.join(photosDir, src);
  if (!fs.existsSync(input)) throw new Error(`사진 없음: ${input}`);
  const out = path.join(cacheDir, `${path.parse(src).name}-${max}.jpg`);
  execFileSync("sips", [
    "-s", "format", "jpeg",
    "-s", "formatOptions", String(q),
    "-Z", String(max),
    input, "--out", out,
  ], { stdio: "ignore" });
  const b64 = fs.readFileSync(out).toString("base64");
  const uri = `data:image/jpeg;base64,${b64}`;
  embedCache.set(key, uri);
  return uri;
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---- 블록 렌더러 -----------------------------------------------------------
function figure(src, caption, max, cls = "photo") {
  return `<figure class="${cls}">
      <img src="${embed(src, max)}" alt="${esc(caption || "")}" loading="lazy" />
      ${caption ? `<figcaption>${esc(caption)}</figcaption>` : ""}
    </figure>`;
}

function renderItem(it) {
  switch (it.t) {
    case "p":
      return `<p>${esc(it.text)}</p>`;
    case "photo":
      return figure(it.src, it.caption, 1280);
    case "note":
      return `<hr class="note-rule" /><p class="note">${esc(it.text)}</p>`;
    case "gallery":
      return `<div class="gallery">${it.photos
        .map((p) => figure(p.src, p.caption, 900, "shot"))
        .join("")}</div>`;
    case "links":
      return `<div class="links">${it.links
        .map(
          (l) =>
            `<a class="pill" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<span aria-hidden="true">↗</span></a>`
        )
        .join("")}</div>`;
    case "linkcards":
      return `${it.lead ? `<p class="lc-lead">${esc(it.lead)}</p>` : ""}<div class="lcards">${it.cards
        .map(
          (c) =>
            `<a class="lcard" href="${esc(c.url)}" target="_blank" rel="noopener">
        <span class="lcard-shot"><img src="${embed(c.src, 1200)}" alt="${esc(c.title)} 미리보기" loading="lazy"${c.pos ? ` style="object-position:${esc(c.pos)}"` : ""} /></span>
        <span class="lcard-foot">
          <span class="lcard-txt"><span class="lcard-title">${esc(c.title)}</span>${c.sub ? `<span class="lcard-sub">${esc(c.sub)}</span>` : ""}</span>
          <span class="lcard-go">바로가기 <span aria-hidden="true">↗</span></span>
        </span>
      </a>`
        )
        .join("")}</div>`;
    default:
      return "";
  }
}

function renderSection(s, i) {
  const num = String(i + 1).padStart(2, "0");
  const flower = s.flower
    ? `<figure class="flower">
        <img src="${embed(s.flower.src, 1280)}" alt="${esc(s.flower.caption || "")}" loading="lazy" />
        ${s.flower.caption ? `<figcaption>${esc(s.flower.caption)}</figcaption>` : ""}
      </figure>`
    : "";
  return `${flower}
    <section class="sec">
      <header class="sec-head">
        <span class="kicker">${esc(s.kicker)}</span>
        <h2><span class="num">${num}</span>${esc(s.title)}</h2>
      </header>
      <div class="prose">${s.items.map(renderItem).join("\n")}</div>
    </section>`;
}

// ---- 스타일 ----------------------------------------------------------------
const style = `<style>
  :root{
    --paper:#F5F3EC; --raised:#FFFFFF; --ink:#232821; --muted:#5F6A59;
    --green:#3E6B4F; --green-2:#2F7D5A; --sun:#C98A24; --line:#E1DBC9;
    --scrim:rgba(20,24,15,.62); --on-green:#FBFDF7;
    --kr:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif;
    --serif:Georgia,"Times New Roman",serif;
    --wrap:660px;
  }
  @media (prefers-color-scheme:dark){
    :root{ --paper:#14180F; --raised:#1E241A; --ink:#ECEADE; --muted:#9CA690;
      --green:#7BB489; --green-2:#8FC79E; --sun:#E0B24E; --line:#2E3626; --scrim:rgba(6,9,4,.66); --on-green:#10160B; }
  }
  :root[data-theme="light"]{ --paper:#F5F3EC; --raised:#FFFFFF; --ink:#232821; --muted:#5F6A59;
    --green:#3E6B4F; --green-2:#2F7D5A; --sun:#C98A24; --line:#E1DBC9; --scrim:rgba(20,24,15,.62); }
  :root[data-theme="dark"]{ --paper:#14180F; --raised:#1E241A; --ink:#ECEADE; --muted:#9CA690;
    --green:#7BB489; --green-2:#8FC79E; --sun:#E0B24E; --line:#2E3626; --scrim:rgba(6,9,4,.66); --on-green:#10160B; }

  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--kr);
    font-size:18px;line-height:1.9;-webkit-font-smoothing:antialiased;
    -webkit-text-size-adjust:100%;}
  .wrap{max-width:var(--wrap);margin:0 auto;padding:0 22px;}
  img{max-width:100%;display:block;border:0}
  a{color:var(--green-2)}

  /* 마스트헤드 */
  .mast{padding:52px 0 22px;text-align:center}
  .studio{font-weight:800;font-size:14px;letter-spacing:.12em;color:var(--green)}
  .tagline{font-family:var(--serif);font-style:italic;font-size:14px;
    letter-spacing:.05em;color:var(--muted)}
  .mast .studio{margin:0 0 6px}
  .mast .tagline{margin:0 0 16px}
  .mast h1{font-size:clamp(30px,8vw,42px);line-height:1.24;margin:0;font-weight:800;
    letter-spacing:-.01em;text-wrap:balance}
  .mast .issue{margin:16px 0 0;font-family:var(--serif);font-style:italic;
    font-size:16px;color:var(--muted)}
  .mast .issue b{color:var(--sun);font-style:normal;font-weight:700;
    font-family:var(--kr);letter-spacing:.01em}
  .rule{width:44px;height:2px;background:var(--sun);border:0;margin:22px auto 0}

  /* 히어로 */
  .hero{margin:26px 0 6px}
  .hero img{width:100%;height:min(58vh,440px);object-fit:cover;border-radius:20px}
  .hero figcaption,.flower figcaption,.photo figcaption,.shot figcaption{
    font-family:var(--serif);font-style:italic;color:var(--muted);
    font-size:14.5px;line-height:1.5;margin-top:9px;text-align:center}

  .dek{font-size:19px;line-height:1.85;color:var(--muted);margin:22px 0 8px;
    text-align:center;text-wrap:pretty}

  /* 섹션 */
  .sec{padding:14px 0 10px}
  .sec-head{margin:26px 0 18px}
  .kicker{display:block;font-family:var(--serif);font-size:12.5px;letter-spacing:.24em;
    text-transform:uppercase;color:var(--green);margin-bottom:10px}
  .sec-head h2{font-size:clamp(23px,5.6vw,28px);line-height:1.34;margin:0;font-weight:800;
    letter-spacing:-.01em;text-wrap:balance;display:flex;gap:12px;align-items:baseline}
  .num{font-family:var(--serif);font-style:italic;font-weight:400;font-size:.72em;
    color:var(--sun);flex:none}
  .prose p{margin:0 0 20px;word-break:keep-all;text-wrap:pretty}
  .prose p:last-child{margin-bottom:0}
  .note-rule{width:40px;height:2px;background:var(--sun);border:0;margin:36px auto 24px}
  .prose .note{margin:0 auto;max-width:30em;text-align:center;color:var(--ink);
    font-size:17px;line-height:2.05;word-break:keep-all;text-wrap:pretty}

  figure{margin:26px 0}
  .photo img,.flower img,.shot img{width:100%;border-radius:16px}
  .flower img{height:200px;object-fit:cover;border-radius:16px}

  /* 갤러리 */
  .gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:26px 0}
  .gallery .shot{margin:0}
  .gallery .shot img{height:190px;object-fit:cover;border-radius:13px}
  .gallery figcaption{font-size:13px;margin-top:7px}

  /* 링크 pill */
  .links{display:flex;flex-direction:column;gap:11px;margin:22px 0}
  .pill{display:flex;justify-content:space-between;align-items:center;gap:12px;
    text-decoration:none;color:var(--ink);background:var(--raised);
    border:1px solid var(--line);border-radius:13px;padding:15px 18px;
    font-weight:600;font-size:16.5px;line-height:1.35;transition:border-color .15s,transform .05s}
  .pill span{color:var(--green-2);font-weight:700;flex:none}
  .pill:hover{border-color:var(--green)}
  .pill:active{transform:translateY(1px)}
  .pill:focus-visible{outline:2px solid var(--green-2);outline-offset:2px}

  /* 링크 카드 (사이트 미리보기) */
  .lc-lead{margin:24px 0 14px;color:var(--muted);font-size:16px;text-align:center;text-wrap:pretty}
  .lcards{display:flex;flex-direction:column;gap:16px;margin:6px 0 8px}
  .lcard{display:block;text-decoration:none;color:var(--ink);background:var(--raised);
    border:1px solid var(--line);border-radius:16px;overflow:hidden;
    transition:border-color .15s,transform .05s,box-shadow .15s}
  .lcard:hover{border-color:var(--green)}
  .lcard:active{transform:translateY(1px)}
  .lcard:focus-visible{outline:2px solid var(--green-2);outline-offset:2px}
  .lcard-shot{display:block}
  .lcard-shot img{width:100%;height:184px;object-fit:cover;object-position:top;
    border-bottom:1px solid var(--line)}
  .lcard-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px}
  .lcard-txt{display:flex;flex-direction:column;gap:3px;min-width:0}
  .lcard-title{font-weight:800;font-size:17px;line-height:1.3}
  .lcard-sub{font-size:13.5px;color:var(--muted);line-height:1.4}
  .lcard-go{flex:none;font-weight:800;font-size:14px;color:var(--on-green);
    background:var(--green);padding:9px 14px;border-radius:999px;white-space:nowrap}

  hr.sep{border:0;border-top:1px solid var(--line);margin:40px 0 0}

  /* 푸터 */
  footer{margin-top:44px;padding:34px 0 60px;border-top:1px solid var(--line);text-align:center}
  footer .studio{margin-bottom:5px}
  footer .tagline{margin-bottom:14px}
  footer .brand{font-weight:800;font-size:20px;margin-bottom:20px}
  footer .flinks{display:flex;flex-direction:column;gap:2px;margin-bottom:22px}
  footer .flinks a{color:var(--green-2);text-decoration:none;font-weight:600;
    font-size:16px;padding:7px 0;display:inline-block}
  footer .flinks a:hover{text-decoration:underline}
  footer .sign{font-family:var(--serif);font-style:italic;color:var(--muted);font-size:15px}

  @media (min-width:520px){
    .flower img{height:260px}
    .gallery .shot img{height:230px}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>`;

// ---- 본문 ------------------------------------------------------------------
const m = data.meta;
const sectionsHtml = data.sections
  .map((s, i) => renderSection(s, i))
  .join("\n<hr class=\"sep\"/>\n");

const footerLinks = (data.footerLinks || [])
  .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
  .join("");

const body = `
  <div class="wrap">
    <header class="mast">
      <p class="studio">${esc(m.studio)}</p>
      <p class="tagline">${esc(m.tagline)}</p>
      <h1>${esc(m.brand)}</h1>
      <p class="issue"><b>${esc(m.issueLabel)}</b> · ${esc(m.issueNo)}</p>
      <hr class="rule"/>
    </header>
${data.cover ? `
    <figure class="hero">
      <img src="${embed(data.cover.src, 1400)}" alt="${esc(data.cover.caption || "")}" />
      ${data.cover.caption ? `<figcaption>${esc(data.cover.caption)}</figcaption>` : ""}
    </figure>` : ""}
${m.dek ? `\n    <p class="dek">${esc(m.dek)}</p>` : ""}

    ${sectionsHtml}

    <footer>
      <p class="studio">${esc(m.studio)}</p>
      <p class="tagline">${esc(m.tagline)}</p>
      <p class="brand">${esc(m.brand)}</p>
      <nav class="flinks">${footerLinks}</nav>
      <p class="sign">${esc(m.author)}</p>
    </footer>
  </div>`;

const title = `${m.brand} — ${m.issueLabel}`;

// 완성본 (단일 파일, 어디서나 열림)
const full = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(title)}</title>
${style}
</head>
<body>${body}
</body>
</html>`;

// Artifact 발행용 본문 (참고)
const artifact = `<title>${esc(title)}</title>\n${style}${body}`;

fs.writeFileSync(path.join(root, "index.html"), full);
fs.writeFileSync(path.join(root, "_artifact.html"), artifact);

const kb = (s) => Math.round(Buffer.byteLength(s) / 1024);
console.log(`✓ 생성 완료 (${issueDir})`);
console.log(`  index.html      ${kb(full)} KB  — 브라우저/이메일/Vercel 공유용`);
console.log(`  _artifact.html  ${kb(artifact)} KB  — Artifact 발행용`);
console.log(`  사진 ${embedCache.size}장 내장`);
