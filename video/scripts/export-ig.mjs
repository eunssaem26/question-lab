// 카드뉴스 HTML → 인스타그램 업로드용 JPG
// 사용법: npm run ig 05          (→ exports/instagram/05/01.jpg ...)
//        npm run ig 05 --open   (뽑고 나서 파인더로 열기)
//
// capture.mjs 와 나란히 두는 이유: playwright 가 video/node_modules 에만 있다.
// capture.mjs 를 JPEG 로 바꾸지 않는 이유: make-config.mjs 가 .png 만 골라내므로
// 릴스 렌더가 깨진다. 영상용 PNG 와 인스타용 JPG 는 서로 건드리지 않는다.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");
const repoRoot = resolve(videoRoot, "..");

const CARD_W = 1080;
const CARD_H = 1350;
const QUALITY = 92;
const IG_MAX_CARDS = 10;      // 캐러셀 한 게시물 최대 장수
const IG_MAX_BYTES = 8 * 1024 * 1024;

async function main() {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  const openFinder = args.includes("--open");

  if (!id) {
    console.error("회차 번호를 지정하세요. 예: npm run ig 05");
    process.exit(1);
  }

  const htmlPath = resolve(repoRoot, "site/public/cardnews", `${id}.html`);
  const outDir = resolve(repoRoot, "exports/instagram", id);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: CARD_W, height: CARD_H },
    deviceScaleFactor: 1,
  });

  // file:// 로 로드해야 상대경로 assets/*.png 가 그대로 해석된다
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500); // 폰트/이모지 안정화

  const cards = page.locator("section.card");
  const count = await cards.count();
  if (count === 0) {
    console.error(`section.card 를 찾지 못했습니다: ${htmlPath}`);
    await browser.close();
    process.exit(1);
  }

  const oversized = [];
  for (let i = 0; i < count; i++) {
    const n = String(i + 1).padStart(2, "0");
    const file = resolve(outDir, `${n}.jpg`);
    // 인스타는 JPEG 만 받는다. PNG 로 올리면 업로드 단계에서 막힌다.
    await cards.nth(i).screenshot({ path: file, type: "jpeg", quality: QUALITY });

    const { size } = await stat(file);
    if (size > IG_MAX_BYTES) oversized.push(`${n}.jpg (${(size / 1024 / 1024).toFixed(1)}MB)`);
    process.stdout.write(`  카드 ${n} → ${(size / 1024).toFixed(0)}KB\n`);
  }

  await browser.close();

  console.log(`\n✅ ${id}회차 ${count}장: ${outDir}`);

  if (count > IG_MAX_CARDS) {
    console.log(
      `\n⚠️  캐러셀은 최대 ${IG_MAX_CARDS}장이다. ${count}장이므로 ` +
      `${IG_MAX_CARDS + 1}번부터는 빼거나 게시물을 나눠야 한다.`
    );
  }
  if (oversized.length > 0) {
    console.log(`\n⚠️  8MB 초과 (업로드 거부됨): ${oversized.join(", ")}`);
  }

  console.log(
    `\n올릴 때: 인스타/비즈니스 스위트에서 ${count}장을 01 → ${String(count).padStart(2, "0")} 순서로 선택한다.\n` +
    `파인더 정렬이 이름순이면 순서가 그대로 맞는다.`
  );

  if (openFinder) spawn("open", [outDir]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
