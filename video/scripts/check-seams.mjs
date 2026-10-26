// 파노라마를 자르기 전에 칸 경계선을 눈으로 확인한다.
// 사용법: node scripts/check-seams.mjs   → exports/instagram/_seam-check.png
//
// 경계(빨강)에 인물이 걸치면 그리드에서 얼굴이 반으로 갈라진다.
// 반드시 자르기 전에 이걸로 확인할 것.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const htmlPath = resolve(repoRoot, "site/public/cardnews/_panorama.html");
const outDir = resolve(repoRoot, "exports/instagram");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 3240, height: 1350 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
// 경계선을 더 굵고 선명하게 (검수용)
await page.evaluate(() => {
  document.querySelectorAll(".seam").forEach((el) => {
    el.style.width = "6px";
    el.style.background = "rgba(255,0,0,0.85)";
  });
});
await page.locator(".pano").screenshot({ path: resolve(outDir, "_seam-check.png") });
await browser.close();
console.log(`✅ 경계 확인용: ${resolve(outDir, "_seam-check.png")}`);
