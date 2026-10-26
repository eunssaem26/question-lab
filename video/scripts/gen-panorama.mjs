// 그리드 한 줄을 가로지르는 파노라마를 3개 게시물로 잘라 낸다.
// 사용법: npm run pano
//   → exports/instagram/pano-1-right/01.jpg   (제일 먼저 올릴 것)
//     exports/instagram/pano-2-center/01.jpg
//     exports/instagram/pano-3-left/01.jpg    (제일 나중에 올릴 것)
//   → exports/instagram/_panorama-full.jpg    (이어붙인 전체 — 검수용)
//
// 폴더 이름의 숫자가 곧 발행 순서다. 인스타 그리드는 최신이 왼쪽에 붙으므로
// 오른쪽 조각부터 올려야 왼→오 순서로 이어진 그림이 된다.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, rm, stat } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

const TILE_W = 1080;
const TILE_H = 1350;
const COLS = 3;
const QUALITY = 92;
const IG_MAX_BYTES = 8 * 1024 * 1024;

const htmlPath = resolve(repoRoot, "site/public/cardnews/_panorama.html");
const exportsDir = resolve(repoRoot, "exports/instagram");

// 왼쪽부터 잘라내되, 폴더 번호는 발행 순서(오른쪽 먼저)로 붙인다
const slices = [
  { col: 0, dir: "pano-3-left" },
  { col: 1, dir: "pano-2-center" },
  { col: 2, dir: "pano-1-right" },
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: TILE_W * COLS, height: TILE_H },
  deviceScaleFactor: 1,
});
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// 칸 경계선·안전영역선은 검수용 눈금이므로 실제 산출물에서는 지운다
await page.evaluate(() => {
  document.querySelectorAll(".seam, .fold").forEach((el) => el.remove());
});
await page.waitForTimeout(600);

await mkdir(exportsDir, { recursive: true });

// 이어붙인 전체 그림 (검수용)
await page.locator(".pano").screenshot({
  path: resolve(exportsDir, "_panorama-full.jpg"),
  type: "jpeg",
  quality: QUALITY,
});

const oversized = [];
for (const { col, dir } of slices) {
  const outDir = resolve(exportsDir, dir);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const file = resolve(outDir, "01.jpg");
  await page.screenshot({
    path: file,
    type: "jpeg",
    quality: QUALITY,
    clip: { x: col * TILE_W, y: 0, width: TILE_W, height: TILE_H },
  });

  const { size } = await stat(file);
  if (size > IG_MAX_BYTES) oversized.push(dir);
  console.log(`  ${dir.padEnd(15)} ← ${col + 1}번째 칸  (${(size / 1024).toFixed(0)}KB)`);
}

await browser.close();

if (oversized.length > 0) {
  console.log(`\n⚠️  8MB 초과 (업로드 거부됨): ${oversized.join(", ")}`);
}

console.log(`\n✅ 파노라마 3칸: ${exportsDir}`);
console.log(`   전체 미리보기: _panorama-full.jpg`);
console.log(`\n   올리는 순서는 폴더 번호대로 1 → 2 → 3.`);
console.log(`   (오른쪽 조각을 먼저 올려야 그리드에서 왼→오로 이어진다)`);
