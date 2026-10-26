// 책 기반 게임 카드뉴스 HTML 생성기
// 사용법: npm run books            (data/book-games.json 전체 생성)
//        npm run books shinga     (한 편만)
//
// 결과: site/public/cardnews/game-<slug>.html  → npm run ig game-<slug> 로 JPG 추출
//
// 오리지널 2편(game-redpen / game-geulbat)은 이 생성기가 만들지 않는다.
// 그 둘은 타이틀이 박힌 정사각 커버가 따로 있어 레이아웃이 다르다 — 손으로 관리한다.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");
const repoRoot = resolve(videoRoot, "..");
const OUT_DIR = resolve(repoRoot, "site/public/cardnews");

const esc = (s) => String(s ?? "");

function rankRows(g) {
  const list = (g.ranks || []).filter(Boolean);
  const last = list.length - 1;
  return list
    .map(
      (t, i) =>
        `      <div class="rank${i === last ? " top" : ""}"><div class="n">${i + 1}</div><div class="t">${esc(t)}</div></div>`
    )
    .join("\n");
}

// 등급이 없는 게임(한목리)은 등급 카드 대신 마무리 문구를 크게 쓴다
function cardRank(g, n, total) {
  if (!g.ranks || g.ranks.filter(Boolean).length === 0) return "";
  return `
<section class="card card-rank">
  <div class="card-number">${String(n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>
  <div class="safe">
    <div class="eyebrow">${esc(g.rankLabel)}</div>
    <div class="ranks">
${rankRows(g)}
    </div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>
`;
}

function build(g) {
  const hasRank = !!(g.ranks && g.ranks.filter(Boolean).length);
  const total = hasRank ? 5 : 4;
  let n = 1;
  const num = () => String(n++).padStart(2, "0");
  const T = String(total).padStart(2, "0");

  const cover = `
<section class="card card-cover">
  <img class="cover-art" src="assets/games/${esc(g.cover)}" alt="${esc(g.title)}">
  <div class="band top"><div class="brand-tag">생 각 하 는  글 밭</div></div>
  <div class="card-number">${num()} / ${T}</div>
  <div class="scrim">
    <div class="t-main">${esc(g.title)}</div>
    <div class="t-sub">${esc(g.subtitle)}</div>
    <div class="t-book">${esc(g.book)}</div>
  </div>
  <div class="band bottom"><div class="swipe">SWIPE →</div></div>
</section>
`;

  const premise = `
<section class="card card-premise">
  <div class="card-number">${num()} / ${T}</div>
  <div class="safe">
    <div class="eyebrow">${esc(g.premiseLabel)}</div>
    <div class="head">${esc(g.premiseHead)}</div>
    <div class="sub">${esc(g.premiseSub)}</div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>
`;

  const device = `
<section class="card card-device">
  <div class="card-number">${num()} / ${T}</div>
  <div class="safe">
    <div class="eyebrow">${esc(g.deviceLabel)}</div>
    <div class="head">${esc(g.deviceHead)}</div>
    <div class="sub">${esc(g.deviceSub)}</div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>
`;

  const rank = hasRank ? cardRank(g, n++, total) : "";

  const cta = `
<section class="card card-cta">
  <div class="card-number">${num()} / ${T}</div>
  <div class="safe">
    <div class="head closer">${esc(g.closer)}</div>
    <div class="badge">설치 없이 브라우저에서 바로</div>
    <div class="url">play.wherethoughtsgrow.com</div>
    <div class="where">프로필 링크에서 바로 열려요</div>
  </div>
</section>
`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>생각하는 글밭 — 게임 소개 : ${esc(g.title)} ${esc(g.subtitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  /* 이 파일은 gen-book-games.mjs 가 생성한다. 직접 고치지 말고 data/book-games.json 을 고칠 것. */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', -apple-system, sans-serif;
    background: #E8D5C0;
    display: flex; flex-direction: column; align-items: center;
    gap: 40px; padding: 40px 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .card {
    width: 1080px; height: 1350px;
    position: relative; overflow: hidden;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
  }
  body.scaled { display: block; padding: 10px; }
  body.scaled .card { transform-origin: top left; display: flex; margin-bottom: 10px; }

  /* 그리드 안전영역 — 인스타 업로드 기본값 1:1 이라 1080×1350 중 y=135~1215 만 남는다 */
  .safe {
    position: absolute; top: 135px; left: 0;
    width: 1080px; height: 1080px;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
  }
  .below-fold { position: absolute; left: 0; bottom: 165px; width: 100%; text-align: center; }
  .card-number {
    position: absolute; top: 160px; right: 50px;
    font-size: 28px; font-weight: 700; letter-spacing: 2px; z-index: 5; opacity: 0.55;
    color: var(--ink);
  }
  .brand-tag { font-size: 26px; font-weight: 700; letter-spacing: 6px; opacity: 0.7; }
  .swipe { font-size: 30px; font-weight: 700; letter-spacing: 8px; opacity: 0.6; color: var(--ink); }

  :root {
    --theme: ${esc(g.theme)};
    --deep: ${esc(g.deep)};
    --ink: ${esc(g.ink)};
    --accent: ${esc(g.accent)};
    /* theme(밝은/중간) 배경 위에서는 accent 가 배경과 붙는 게임이 있어 따로 쓴다 */
    --em-theme: ${esc(g.emTheme || g.accent)};
  }

  /* ─── 커버 ─── */
  .card-cover { background: var(--deep); }
  .card-cover .cover-art {
    position: absolute; top: 135px; left: 0;
    width: 1080px; height: 1080px;
    object-fit: cover; object-position: ${esc(g.coverPos)};
  }
  .card-cover .band {
    position: absolute; left: 0; width: 100%; height: 135px;
    display: flex; align-items: center; justify-content: center;
    background: var(--deep); color: var(--ink);
  }
  .card-cover .band.top { top: 0; }
  .card-cover .band.bottom { bottom: 0; }
  .card-cover .scrim {
    position: absolute; left: 0; bottom: 135px; width: 100%;
    padding: 200px 80px 56px;
    background: linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.72) 45%, rgba(0,0,0,0) 100%);
    text-align: center; color: #fff;
  }
  .card-cover .t-main { font-size: 96px; font-weight: 900; line-height: 1.15; word-break: keep-all; }
  .card-cover .t-sub {
    margin-top: 12px; font-size: 62px; font-weight: 900;
    color: var(--accent); line-height: 1.2; word-break: keep-all;
  }
  .card-cover .t-book {
    margin-top: 28px; font-size: 29px; font-weight: 500;
    opacity: 0.82; word-break: keep-all;
  }

  /* ─── 공통 텍스트 카드 ─── */
  .eyebrow {
    font-size: 34px; font-weight: 700; letter-spacing: 4px;
    opacity: 0.75; margin-bottom: 42px; color: var(--ink);
  }
  .head {
    font-size: 86px; font-weight: 900; line-height: 1.35;
    text-align: center; word-break: keep-all; padding: 0 80px; color: var(--ink);
  }
  .head em { font-style: normal; color: var(--accent); }
  .sub {
    margin-top: 46px; font-size: 39px; font-weight: 500; line-height: 1.7;
    text-align: center; word-break: keep-all; padding: 0 105px;
    color: var(--ink); opacity: 0.9;
  }

  /* deep 배경엔 accent, theme 배경엔 --em-theme 를 쓴다 (대비 확보) */
  .card-premise { background: var(--theme); }
  .card-premise .head em { color: var(--em-theme); }
  .card-device { background: var(--deep); }

  /* ─── 등급 ─── */
  .card-rank { background: var(--ink); }
  .card-rank .eyebrow, .card-rank .card-number, .card-rank .swipe { color: var(--deep); }
  .card-rank .ranks { display: flex; flex-direction: column; gap: 22px; }
  .card-rank .rank {
    display: flex; align-items: center; gap: 28px;
    background: rgba(0,0,0,0.07); border-radius: 999px;
    padding: 22px 52px; width: 780px;
  }
  .card-rank .rank .n { font-size: 34px; font-weight: 900; color: var(--theme); width: 54px; flex-shrink: 0; }
  .card-rank .rank .t { font-size: 46px; font-weight: 700; color: var(--deep); }
  .card-rank .rank.top { background: var(--accent); }
  .card-rank .rank.top .n, .card-rank .rank.top .t { color: var(--deep); font-weight: 900; }

  /* ─── CTA ─── */
  .card-cta { background: var(--theme); }
  .card-cta .head em { color: var(--em-theme); }
  .card-cta .closer { font-size: 74px; }
  .card-cta .badge {
    margin-top: 52px; background: var(--accent); color: var(--deep);
    font-size: 37px; font-weight: 900;
    padding: 20px 52px; border-radius: 999px;
  }
  .card-cta .url {
    margin-top: 44px; background: var(--ink); color: var(--deep);
    font-size: 44px; font-weight: 900;
    padding: 26px 62px; border-radius: 999px;
  }
  .card-cta .where { margin-top: 32px; font-size: 33px; font-weight: 500; color: var(--ink); opacity: 0.88; }
</style>
</head>
<body>
${cover}${premise}${device}${rank}${cta}
<script>
function scaleCards() {
  var vw = window.innerWidth;
  if (vw >= 1080) {
    document.body.classList.remove('scaled');
    document.querySelectorAll('.card').forEach(function(c){ c.style.transform=''; c.style.marginBottom=''; });
    return;
  }
  document.body.classList.add('scaled');
  var s = vw / 1080;
  var realH = 1350 * s;
  document.querySelectorAll('.card').forEach(function(c){
    c.style.transform = 'scale(' + s + ')';
    c.style.marginBottom = (realH - 1350) + 'px';
  });
}
scaleCards();
window.addEventListener('resize', scaleCards);
</script>
</body>
</html>
`;
}

async function main() {
  const only = process.argv[2];
  const games = JSON.parse(
    await readFile(resolve(videoRoot, "data/book-games.json"), "utf8")
  );
  const targets = only ? games.filter((g) => g.slug === only) : games;

  if (targets.length === 0) {
    console.error(`'${only}' 를 data/book-games.json 에서 찾지 못했습니다.`);
    process.exit(1);
  }

  for (const g of targets) {
    const out = resolve(OUT_DIR, `game-${g.slug}.html`);
    await writeFile(out, build(g), "utf8");
    const n = g.ranks && g.ranks.filter(Boolean).length ? 5 : 4;
    console.log(`  game-${g.slug}.html  (${n}장)  ${g.title} ${g.subtitle}`);
  }
  console.log(`\n✅ ${targets.length}편 생성. 이제 JPG 로: npm run ig game-<slug>`);
}

main();
