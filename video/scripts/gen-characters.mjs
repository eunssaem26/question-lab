// 캐릭터 소개 캐러셀 HTML 10편을 데이터에서 생성한다.
// 사용법: npm run chars
//   → site/public/cardnews/char-<slug>.html  (각 4장짜리 캐러셀)
//   → exports/instagram/_publish-order.md    (발행 순서 + 캡션 초안)
//
// 문구를 고칠 때는 이 파일이 아니라 video/data/characters.json 을 고친다.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");
const repoRoot = resolve(videoRoot, "..");
const cardnewsDir = resolve(repoRoot, "site/public/cardnews");
const exportsDir = resolve(repoRoot, "exports/instagram");

const { characters } = JSON.parse(
  await readFile(resolve(videoRoot, "data/characters.json"), "utf8")
);
const bySlug = Object.fromEntries(characters.map((c) => [c.slug, c]));

const SITE = "wherethoughtsgrow.com";

// 이름 끝 글자의 받침 유무로 주격조사를 고른다.
// (별쌤"이" / 필로"가" — 한글 음절은 0xAC00 부터 28개 종성 주기로 배열된다)
function subjectParticle(name) {
  const code = name.charCodeAt(name.length - 1);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangulSyllable) return "가";
  return (code - 0xac00) % 28 === 0 ? "가" : "이";
}

// 서술격 조사. 주격(이/가)과 규칙이 다르다 — 받침 있으면 "이에요", 없으면 "예요".
function copulaEnding(name) {
  const code = name.charCodeAt(name.length - 1);
  const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangulSyllable) return "예요";
  return (code - 0xac00) % 28 === 0 ? "예요" : "이에요";
}

function page(c) {
  const next = c.next ? bySlug[c.next] : null;
  if (c.next && !next) {
    throw new Error(`${c.slug} 의 next "${c.next}" 를 characters.json 에서 찾지 못했다`);
  }

  // 마지막 캐릭터는 '다음 예고' 대신 전체 CTA 로 닫는다
  const lastCard = next
    ? `  <div class="safe">
    <div class="next-label">다음 농부는</div>
    <div class="portrait-wrap next-wrap" style="--fx:${next.fx}; --fy:${next.fy}; --zoom:${next.zoom};">
      <img src="../assets/characters/${next.image}" alt="${next.name}">
    </div>
    <div class="next-name">${next.name}</div>
    <div class="next-one-liner">${next.role}</div>
    <div class="follow">팔로우하고 10명 다 만나기</div>
  </div>`
    : `  <div class="safe">
    <div class="next-label">농부 열 명, 모두 만났어요</div>
    <div class="finale">우리는 대신<br>자라주지 않아요</div>
    <div class="finale-sub">자랄 자리를 만들 뿐입니다</div>
    <div class="follow">${SITE}</div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>생각하는 글밭 — 농부 소개 ${String(c.order).padStart(2, "0")}. ${c.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  /* 이 파일은 gen-characters.mjs 가 생성한다. 직접 고치지 말고 data/characters.json 을 고칠 것. */
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

  /* ─── 그리드 안전영역 ───────────────────────────
     인스타 프로필 그리드는 4:5 를 1:1 로 중앙 크롭한다.
     1080×1350 중 그리드에 보이는 건 y=135~1215 뿐이므로
     얼굴·이름은 반드시 .safe 안에 둔다. 인스타 업로드 기본값이 1:1 이라
     위아래 135px 은 실제로 잘려 나간다 — 글자를 두면 안 된다.
     ───────────────────────────────────────────── */
  .safe {
    position: absolute; top: 135px; left: 0;
    width: 1080px; height: 1080px;
    display: flex; flex-direction: column;
    justify-content: center; align-items: center;
  }
  .above-fold, .below-fold {
    position: absolute; left: 0; width: 100%;
    text-align: center; color: #A67B5B;
  }
  .above-fold { top: 165px; }
  .below-fold { bottom: 165px; }
  .card-number {
    position: absolute; top: 160px; right: 50px;
    font-size: 28px; font-weight: 700;
    color: #A67B5B; opacity: 0.5; letter-spacing: 2px; z-index: 5;
  }
  .brand-tag { font-size: 26px; font-weight: 700; letter-spacing: 6px; opacity: 0.65; }
  .swipe { font-size: 30px; font-weight: 700; letter-spacing: 8px; opacity: 0.55; }

  /* 얼굴 초점: --fx/--fy 지점을 기준으로 --zoom 만큼 당긴다 */
  .portrait-wrap {
    width: 620px; height: 620px;
    border-radius: 50%; overflow: hidden;
    border: 14px solid #FBF3EA;
    box-shadow: 0 18px 50px rgba(92,61,46,0.18);
    flex-shrink: 0;
  }
  .portrait-wrap img {
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: var(--fx) var(--fy);
    transform: scale(var(--zoom));
    transform-origin: var(--fx) var(--fy);
  }

  /* ─── 01 커버 ─── */
  .card-1 { background: #F5E6D0; color: #5C3D2E; }
  .card-1 .name {
    font-size: 130px; font-weight: 900; line-height: 1;
    margin-top: 52px; letter-spacing: -2px;
  }
  .card-1 .role {
    margin-top: 26px; background: #6B7F4A; color: #FBF3EA;
    font-size: 36px; font-weight: 700;
    padding: 16px 44px; border-radius: 999px; letter-spacing: 1px;
  }

  /* ─── 02 하는 일 ─── */
  .card-2 { background: #FBF3EA; color: #5C3D2E; }
  .card-2 .label {
    font-size: 34px; font-weight: 700; color: #A67B5B;
    letter-spacing: 8px; margin-bottom: 44px;
  }
  .card-2 .quote {
    font-size: 76px; font-weight: 900; line-height: 1.45;
    text-align: center; word-break: keep-all; padding: 0 90px;
  }
  .card-2 .quote em { font-style: normal; color: #C4956A; }
  .card-2 .desc {
    margin-top: 60px; font-size: 38px; font-weight: 500; line-height: 1.75;
    color: #6B5344; text-align: center; word-break: keep-all; padding: 0 110px;
  }

  /* ─── 03 원칙 (톤 반전) ─── */
  .card-3 { background: #6B7F4A; color: #FBF3EA; }
  .card-3 .mark { font-size: 110px; font-weight: 900; opacity: 0.35; line-height: 1; margin-bottom: 24px; }
  .card-3 .principle {
    font-size: 82px; font-weight: 900; line-height: 1.5;
    text-align: center; word-break: keep-all; padding: 0 100px;
  }
  .card-3 .who { margin-top: 56px; font-size: 34px; font-weight: 700; letter-spacing: 4px; opacity: 0.8; }
  .card-3 .above-fold, .card-3 .below-fold { color: #FBF3EA; opacity: 0.7; }

  /* ─── 04 다음 예고 / 마무리 ─── */
  .card-4 { background: #F5E6D0; color: #5C3D2E; }
  .card-4 .next-label {
    font-size: 40px; font-weight: 700; color: #A67B5B;
    letter-spacing: 6px; margin-bottom: 50px; text-align: center; word-break: keep-all;
  }
  .card-4 .next-wrap { width: 400px; height: 400px; border-width: 12px; }
  .card-4 .next-name { font-size: 92px; font-weight: 900; margin-top: 44px; line-height: 1; }
  .card-4 .next-one-liner { margin-top: 26px; font-size: 38px; font-weight: 500; color: #6B5344; }
  .card-4 .finale {
    font-size: 86px; font-weight: 900; line-height: 1.45;
    text-align: center; word-break: keep-all;
  }
  .card-4 .finale-sub { margin-top: 34px; font-size: 40px; font-weight: 500; color: #6B5344; }
  .card-4 .follow {
    margin-top: 60px; background: #5C3D2E; color: #F5E6D0;
    font-size: 36px; font-weight: 700;
    padding: 22px 56px; border-radius: 999px; letter-spacing: 1px;
  }
</style>
</head>
<body>

<section class="card card-1">
  <div class="card-number">01 / 04</div>
  <div class="above-fold"><div class="brand-tag">생각하는 글밭</div></div>
  <div class="safe">
    <div class="portrait-wrap" style="--fx:${c.fx}; --fy:${c.fy}; --zoom:${c.zoom};">
      <img src="../assets/characters/${c.image}" alt="${c.name}">
    </div>
    <div class="name">${c.name}</div>
    <div class="role">${c.role}</div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>

<section class="card card-2">
  <div class="card-number">02 / 04</div>
  <div class="safe">
    <div class="label">하는 일</div>
    <div class="quote">${c.quote}</div>
    <div class="desc">${c.desc}</div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>

<section class="card card-3">
  <div class="card-number">03 / 04</div>
  <div class="safe">
    <div class="mark">&ldquo;</div>
    <div class="principle">${c.principle}</div>
    <div class="who">${c.name}${subjectParticle(c.name)} 잊지 않는 것</div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>

<section class="card card-4">
  <div class="card-number">04 / 04</div>
${lastCard}
</section>

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

// ── 열 명 총정리 (오픈 시퀀스 17번) ───────────────────────
// 파노라마가 단체'사진'을 맡으므로, 이 글은 열 명이 각각 무슨 일을 하는지 정리한다.
// 묶음은 WORLD-BIBLE 5장의 역할 구분을 따른다.
const TEAMS = [
  { label: "전체를 조율한다", slugs: ["philo"] },
  { label: "창조 · 연결 · 성장", slugs: ["batpd", "gardener", "yeongsaem"] },
  { label: "아이 곁에서 가르친다", slugs: ["byeolsaem", "chaeksaem", "geulsaem", "hogi"] },
  { label: "나가기 전에 검증한다", slugs: ["kkansaem", "eunsaem"] },
];

function ring(c, cls = "") {
  return `<div class="portrait-wrap ${cls}" style="--fx:${c.fx}; --fy:${c.fy}; --zoom:${c.zoom};">
        <img src="../assets/characters/${c.image}" alt="${c.name}"></div>`;
}

function rosterPage() {
  const total = TEAMS.length + 2; // 커버 + 팀들 + 마무리
  let n = 0;
  const num = () => `<div class="card-number">${String(++n).padStart(2, "0")} / ${String(total).padStart(2, "0")}</div>`;

  const cover = `<section class="card card-cover">
  ${num()}
  <div class="above-fold"><div class="brand-tag">생각하는 글밭</div></div>
  <div class="safe">
    <div class="cover-title">농부 열 명이<br>하는 일</div>
    <div class="mini-grid">
      ${characters.map((c) => ring(c, "mini")).join("\n      ")}
    </div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>`;

  const teamCards = TEAMS.map((t, i) => {
    const members = t.slugs.map((s) => bySlug[s]);
    return `<section class="card card-team ${i % 2 ? "alt" : ""}">
  ${num()}
  <div class="safe">
    <div class="label">${t.label}</div>
    <div class="team ${members.length === 1 ? "solo" : ""}${members.length === 4 ? "four" : ""}">
      ${members
        .map(
          (c) => `<div class="member">
        ${ring(c, "member-ring")}
        <div class="m-name">${c.name}</div>
        <div class="m-role">${c.role}</div>
      </div>`
        )
        .join("\n      ")}
    </div>
  </div>
  <div class="below-fold"><div class="swipe">SWIPE →</div></div>
</section>`;
  }).join("\n\n");

  const closing = `<section class="card card-closing">
  ${num()}
  <div class="above-fold"><div class="brand-tag">생각하는 글밭</div></div>
  <div class="safe">
    <div class="closing-big">열 명이 하는 일은<br>결국 하나예요</div>
    <div class="closing-sub">아이가 스스로 생각하도록<br>자랄 자리를 만드는 것</div>
    <div class="pill">${SITE}</div>
  </div>
</section>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>생각하는 글밭 — 농부 열 명이 하는 일</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  /* 이 파일은 gen-characters.mjs 가 생성한다. 직접 고치지 말 것. */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Noto Sans KR', -apple-system, sans-serif;
    background: #E8D5C0;
    display: flex; flex-direction: column; align-items: center;
    gap: 40px; padding: 40px 0;
    -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  }
  .card {
    width: 1080px; height: 1350px; position: relative; overflow: hidden;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
  }
  body.scaled { display: block; padding: 10px; }
  body.scaled .card { transform-origin: top left; display: flex; margin-bottom: 10px; }

  /* 그리드 안전영역 — 1:1 중앙 크롭에서 살아남는 1080×1080 */
  .safe {
    position: absolute; top: 135px; left: 0; width: 1080px; height: 1080px;
    display: flex; flex-direction: column; justify-content: center; align-items: center;
  }
  .above-fold, .below-fold {
    position: absolute; left: 0; width: 100%; text-align: center; color: #A67B5B;
  }
  .above-fold { top: 165px; }
  .below-fold { bottom: 165px; }
  .card-number {
    position: absolute; top: 160px; right: 50px; font-size: 28px; font-weight: 700;
    color: #A67B5B; opacity: 0.5; letter-spacing: 2px; z-index: 5;
  }
  .brand-tag { font-size: 26px; font-weight: 700; letter-spacing: 6px; opacity: 0.65; }
  .swipe { font-size: 30px; font-weight: 700; letter-spacing: 8px; opacity: 0.55; }

  .portrait-wrap {
    border-radius: 50%; overflow: hidden;
    border: 8px solid #FBF3EA;
    box-shadow: 0 10px 26px rgba(92,61,46,0.20);
    flex-shrink: 0;
  }
  .portrait-wrap img {
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: var(--fx) var(--fy);
    transform: scale(var(--zoom));
    transform-origin: var(--fx) var(--fy);
  }

  /* ─── 커버: 열 명 얼굴을 5×2 로 ─── */
  .card-cover { background: #6B7F4A; color: #FBF3EA; }
  .card-cover .above-fold, .card-cover .below-fold { color: #FBF3EA; opacity: 0.7; }
  .card-cover .card-number { color: #FBF3EA; }
  .cover-title {
    font-size: 96px; font-weight: 900; line-height: 1.35;
    text-align: center; margin-bottom: 70px;
  }
  .mini-grid {
    display: grid; grid-template-columns: repeat(5, 150px);
    gap: 34px 30px; justify-content: center;
  }
  .mini { width: 150px; height: 150px; border-width: 6px; }

  /* ─── 팀 카드 ─── */
  .card-team { background: #FBF3EA; color: #5C3D2E; }
  .card-team.alt { background: #F5E6D0; }
  .label {
    font-size: 40px; font-weight: 700; color: #A67B5B;
    letter-spacing: 4px; margin-bottom: 60px; text-align: center; word-break: keep-all;
  }
  .team {
    display: flex; flex-wrap: wrap; justify-content: center;
    gap: 56px 48px; width: 940px;
  }
  .member { width: 200px; text-align: center; }
  .member-ring { width: 200px; height: 200px; }
  .m-name { margin-top: 22px; font-size: 46px; font-weight: 900; line-height: 1; }
  .m-role { margin-top: 12px; font-size: 28px; font-weight: 500; color: #A67B5B; }
  /* 네 명이면 한 줄에 안 들어가 3+1 로 갈라진다 → 폭을 좁혀 2×2 로 */
  .team.four { width: 460px; }
  /* 혼자인 카드(필로)는 크게 */
  .team.solo .member { width: 340px; }
  .team.solo .member-ring { width: 340px; height: 340px; border-width: 12px; }
  .team.solo .m-name { font-size: 72px; margin-top: 34px; }
  .team.solo .m-role { font-size: 36px; }

  /* ─── 마무리 ─── */
  .card-closing { background: #5C3D2E; color: #F5E6D0; }
  .card-closing .above-fold { color: #F5E6D0; opacity: 0.5; }
  .card-closing .card-number { color: #F5E6D0; }
  .closing-big {
    font-size: 84px; font-weight: 900; line-height: 1.45;
    text-align: center; word-break: keep-all;
  }
  .closing-sub {
    margin-top: 40px; font-size: 40px; font-weight: 500; line-height: 1.7;
    color: #D4BFA8; text-align: center; word-break: keep-all;
  }
  .pill {
    margin-top: 66px; background: #F5E6D0; color: #5C3D2E;
    font-size: 36px; font-weight: 700; padding: 24px 58px; border-radius: 999px;
  }
</style>
</head>
<body>

${cover}

${teamCards}

${closing}

<script>
function scaleCards() {
  var vw = window.innerWidth;
  if (vw >= 1080) {
    document.body.classList.remove('scaled');
    document.querySelectorAll('.card').forEach(function(c){ c.style.transform=''; c.style.marginBottom=''; });
    return;
  }
  document.body.classList.add('scaled');
  var s = vw / 1080; var realH = 1350 * s;
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

// ── HTML 생성 ────────────────────────────────────────────
for (const c of characters) {
  const file = resolve(cardnewsDir, `char-${c.slug}.html`);
  await writeFile(file, page(c), "utf8");
  console.log(`  ${String(c.order).padStart(2, "0")}. ${c.name.padEnd(4)} → char-${c.slug}.html`);
}

await writeFile(resolve(cardnewsDir, "roster.html"), rosterPage(), "utf8");
console.log(`  17. 총정리 → roster.html`);

// ── 발행 순서 + 캡션 초안 ─────────────────────────────────
const lines = [
  "# 인스타 농부 소개 — 캡션 초안",
  "",
  "> gen-characters.mjs 가 생성. 캡션은 **초안**이니 올리기 전에 손보세요.",
  "",
  "## 왜 이 순서인가",
  "",
  "인스타 그리드는 최신 게시물이 왼쪽 위다. 아래 순서대로 **연속으로** 올려야",
  "프로필에 캐릭터 얼굴 띠가 생긴다. 중간에 다른 게시물이 끼면 띠가 깨진다.",
  "",
  "| # | 캐릭터 | 내보내기 | 업로드할 폴더 |",
  "|---|--------|---------|--------------|",
  ...characters.map(
    (c) =>
      `| ${c.order} | ${c.name} | \`npm run ig char-${c.slug}\` | \`exports/instagram/char-${c.slug}/\` |`
  ),
  "",
  "## 캡션 초안",
  "",
];

for (const c of characters) {
  const plain = (s) => s.replace(/<br>/g, " ").replace(/<\/?em>/g, "");
  lines.push(
    `### ${c.order}. ${c.name} — ${c.role}`,
    "",
    "```",
    `${c.name} · ${c.role}`,
    "",
    plain(c.quote),
    "",
    plain(c.desc),
    "",
    `"${plain(c.principle)}"`,
    "",
    `생각하는 글밭의 농부 열 명을 한 명씩 소개합니다.`,
    c.next
      ? `다음은 ${bySlug[c.next].name}. 놓치지 않으려면 팔로우해 주세요.`
      : `열 명 모두 만나셨어요. 진단은 프로필 링크에서 → ${SITE}`,
    "",
    "#생각하는글밭 #문해력 #WhereThoughtsGrow #캐릭터소개 #브랜드캐릭터 #클레이애니메이션 #AI캐릭터 #교육캐릭터 #초등문해력 #독서교육",
    "```",
    ""
  );
}

await mkdir(exportsDir, { recursive: true });
await writeFile(resolve(exportsDir, "_captions-characters.md"), lines.join("\n"), "utf8");

// ── 캡션 파일 (발행 자동화가 읽는 자리) ────────────────────
// 게시물 18개의 캡션은 전부 video/data/captions/<dir>.txt 한 곳에 모인다.
// 여기서는 농부 10편의 '초안'만 만든다. 이미 파일이 있으면 절대 덮어쓰지 않는다 —
// 손으로 다듬은 캡션이 npm run chars 한 번에 날아가면 안 된다.
const captionsDir = resolve(videoRoot, "data/captions");
await mkdir(captionsDir, { recursive: true });

const plain = (s) => s.replace(/<br>/g, " ").replace(/<\/?em>/g, "");
let written = 0;
let kept = 0;

for (const c of characters) {
  const file = resolve(captionsDir, `char-${c.slug}.txt`);
  if (await access(file).then(() => true, () => false)) {
    kept++;
    continue;
  }
  const body = [
    `${c.name} · ${c.role}`,
    "",
    plain(c.quote),
    "",
    plain(c.desc),
    "",
    `"${plain(c.principle)}"`,
    "",
    "생각하는 글밭을 함께 가꾸는 농부 열 명을 한 명씩 소개합니다.",
    c.next
      ? `다음은 ${bySlug[c.next].name}${copulaEnding(bySlug[c.next].name)}.`
      : `열 명을 모두 만나셨어요. 진단은 프로필 링크에서 → ${SITE}`,
    "",
    "#생각하는글밭 #문해력 #WhereThoughtsGrow #캐릭터소개 #브랜드캐릭터 #클레이애니메이션 #AI캐릭터 #교육캐릭터 #초등문해력 #독서교육",
    "",
  ].join("\n");
  await writeFile(file, body, "utf8");
  written++;
}

console.log(`\n✅ 캐릭터 ${characters.length}편 생성`);
console.log(`   캡션: data/captions/ (새로 ${written}개, 기존 유지 ${kept}개)`);
console.log(`   (전체 발행 순서는 npm run grid 가 _publish-order.md 로 만든다)`);
