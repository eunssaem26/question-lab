// 인스타 프로필 그리드를 실제 산출물로 미리 본다 + 전체 발행 순서표를 갱신한다.
// 사용법: npm run grid
//   → exports/instagram/_grid-preview.png   (프로필 화면 재현)
//   → exports/instagram/_publish-order.md   (18개 게시물 발행 순서)
//
// 각 타일은 그 게시물의 커버(01.jpg)를 인스타 그리드와 같은 4:5 로 보여준다.
//
// 주의: 그리드는 4:5 지만 **업로드 단계에서는 1:1 로 잘릴 수 있다**(2026-07-28 실측).
// 그래서 카드 디자인은 여전히 중앙 1080×1080 안에 모든 요소를 넣어야 안전하다.
// 그 검증은 이 미리보기가 아니라 `sips -c 1080 1080 <카드>.jpg` 로 한다.
// 아직 안 만든 게시물은 회색 '미제작' 타일로 표시된다.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");
const repoRoot = resolve(videoRoot, "..");
const exportsDir = resolve(repoRoot, "exports/instagram");

const { posts } = JSON.parse(
  await readFile(resolve(videoRoot, "data/posts.json"), "utf8")
);

const exists = async (p) => access(p).then(() => true, () => false);

// 커버 경로와 제작 여부를 붙인다
const enriched = await Promise.all(
  posts.map(async (p, i) => {
    const cover = resolve(exportsDir, p.dir, "01.jpg");
    return { ...p, order: i + 1, cover, made: await exists(cover) };
  })
);

// 그리드는 최신이 왼쪽 위 → 발행 순서를 뒤집는다
const gridOrder = [...enriched].reverse();

const tiles = gridOrder
  .map((p) =>
    p.made
      ? `<div class="tile"><img src="${pathToFileURL(p.cover).href}" alt="${p.label}">
           <div class="badge">${p.order}</div></div>`
      : `<div class="tile todo"><div class="todo-in">
           <div class="todo-label">${p.label}</div><div class="todo-note">미제작</div></div>
           <div class="badge">${p.order}</div></div>`
  )
  .join("\n");

const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#000; font-family:'Noto Sans KR',sans-serif; }
  .phone { width:1080px; }
  .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; background:#000; }
  .tile { position:relative; width:100%; aspect-ratio:4/5; overflow:hidden; background:#F5E6D0; }
  /* 인스타 그리드는 4:5 로 보여준다 (2026-07 실측). 커버가 4:5 라 크롭 없이 그대로 들어간다. */
  .tile img { width:100%; height:100%; object-fit:cover; object-position:center center; display:block; }
  .tile.todo { background:#2A2622; }
  .todo-in { position:absolute; inset:0; display:flex; flex-direction:column;
             justify-content:center; align-items:center; color:#8A7B6B; }
  .todo-label { font-size:38px; font-weight:900; }
  .todo-note { margin-top:10px; font-size:22px; font-weight:700; letter-spacing:2px; }
  .badge { position:absolute; top:8px; left:8px;
           background:rgba(0,0,0,0.55); color:#fff;
           font-size:20px; font-weight:700; padding:4px 10px; border-radius:999px; }
</style></head><body>
<div class="phone"><div class="grid">
${tiles}
</div></div></body></html>`;

await mkdir(exportsDir, { recursive: true });

// setContent 로 넣으면 문서 origin 이 about:blank 이라 file:// 이미지가 차단된다.
// 실제 파일로 쓴 뒤 file:// 로 열어야 커버 JPG 들이 로드된다.
const tmpHtml = resolve(exportsDir, "_grid-preview.html");
await writeFile(tmpHtml, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1800 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(tmpHtml).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.locator(".phone").screenshot({ path: resolve(exportsDir, "_grid-preview.png") });
await browser.close();

// ── 발행 순서표 ──────────────────────────────────────────
const made = enriched.filter((p) => p.made).length;
const doc = [
  "# @eunssaem26 오픈 시퀀스 — 발행 순서",
  "",
  "> `npm run grid` 가 생성. 순서의 출처는 `video/data/posts.json`.",
  "",
  "## 순서를 지켜야 하는 이유",
  "",
  "인스타 그리드는 최신 게시물이 왼쪽 위다. 아래 순서대로 **연속으로** 올려야",
  "프로필에 얼굴 띠와 파노라마가 제대로 맞춰진다. 중간에 카드뉴스 같은 다른 게시물이",
  "하나라도 끼면 배치가 한 칸씩 밀려 전부 어긋난다.",
  "",
  `현재 ${made}/${enriched.length}개 제작 완료.`,
  "",
  "| # | 게시물 | 묶음 | 폴더 | 상태 |",
  "|---|--------|------|------|------|",
  ...enriched.map(
    (p) =>
      `| ${p.order} | ${p.label} | ${p.group} | \`exports/instagram/${p.dir}/\` | ${p.made ? "✅" : "⬜ 미제작"} |`
  ),
  "",
  "## 올릴 때",
  "",
  "1. 폴더를 열어 `01.jpg`부터 순서대로 전부 선택한다 (이름순 = 캐러셀 순서).",
  "2. 캡션은 `_captions-characters.md` 참고.",
  "3. 프로필 링크에 `wherethoughtsgrow.com` 을 걸어둔다 — 카드가 링크를 안내한다.",
  "",
].join("\n");

await writeFile(resolve(exportsDir, "_publish-order.md"), doc, "utf8");

console.log(`✅ 그리드 미리보기: ${resolve(exportsDir, "_grid-preview.png")}`);
console.log(`   발행 순서표:     ${resolve(exportsDir, "_publish-order.md")}  (${made}/${enriched.length} 제작)`);
