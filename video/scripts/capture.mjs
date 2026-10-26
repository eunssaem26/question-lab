// 카드뉴스 HTML → 카드별 PNG 캡처
// 사용법: node scripts/capture.mjs 03
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir, rm, readdir, writeFile } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");
const repoRoot = resolve(videoRoot, "..");

const CARD_W = 1080;
const CARD_H = 1350;

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("회차 번호를 지정하세요. 예: node scripts/capture.mjs 03");
    process.exit(1);
  }

  const htmlPath = resolve(repoRoot, "site/public/cardnews", `${id}.html`);
  const outDir = resolve(videoRoot, "public/cards", id);

  // 이전 캡처 정리 후 디렉토리 생성
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: CARD_W, height: CARD_H },
    deviceScaleFactor: 1,
  });

  // file:// 로 로드하면 상대경로 assets/*.png 가 그대로 해석됨
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

  const meta = [];
  for (let i = 0; i < count; i++) {
    const n = String(i + 1).padStart(2, "0");
    const file = resolve(outDir, `${n}.png`);
    await cards.nth(i).screenshot({ path: file });

    // 카드별 배경색 + 글자 수 추출
    // - bg: 9:16 여백 밴드를 같은 색으로 채워 풀블리드처럼 보이게 함
    //   (그라데이션 카드는 background-color 가 투명하므로 첫 색을 파싱)
    // - chars: 공백 제외 글자 수 → 카드 노출 시간(읽는 시간) 자동 배분에 사용
    const info = await cards.nth(i).evaluate((el) => {
      const cs = getComputedStyle(el);
      let bg = cs.backgroundColor;
      if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") {
        const img = cs.backgroundImage || "";
        const m = img.match(/rgba?\([^)]*\)|#[0-9a-fA-F]{3,8}/);
        bg = m ? m[0] : "#F5E6D0";
      }
      const chars = (el.innerText || "").replace(/\s/g, "").length;
      return { bg, chars };
    });
    meta.push(info);
    process.stdout.write(`  카드 ${n} 캡처 완료 (bg ${info.bg}, ${info.chars}자)\n`);
  }

  await browser.close();
  await writeFile(resolve(outDir, "_meta.json"), JSON.stringify(meta), "utf8");

  const files = (await readdir(outDir)).filter((f) => f.endsWith(".png"));
  console.log(`\n✅ ${id}회차 카드 ${files.length}장 캡처: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
