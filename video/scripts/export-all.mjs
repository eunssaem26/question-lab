// posts.json 에 있는 게시물 전부를 다시 내보낸다.
// 사용법: npm run ig:all
//
// 카드 디자인을 손봤을 때 18개를 하나씩 다시 뽑다가 빠뜨리는 사고를 막는다.
// 파노라마 3칸은 원본이 다르므로 gen-panorama.mjs 로 따로 처리한다.
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFile, access } from "node:fs/promises";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");
const repoRoot = resolve(videoRoot, "..");
const cardnewsDir = resolve(repoRoot, "site/public/cardnews");

const { posts } = JSON.parse(await readFile(resolve(videoRoot, "data/posts.json"), "utf8"));
const exists = (p) => access(p).then(() => true, () => false);

function run(script, args) {
  return new Promise((res, rej) => {
    const p = spawn("node", [script, ...args], { cwd: videoRoot, stdio: "inherit" });
    p.on("close", (c) => (c === 0 ? res() : rej(new Error(`${script} ${args.join(" ")} → exit ${c}`))));
  });
}

const panoDirs = posts.filter((p) => p.dir.startsWith("pano-")).map((p) => p.dir);
const htmlPosts = posts.filter((p) => !p.dir.startsWith("pano-"));

console.log(`\n▶ 카드 게시물 ${htmlPosts.length}개 내보내기\n`);
for (const p of htmlPosts) {
  const html = resolve(cardnewsDir, `${p.dir}.html`);
  if (!(await exists(html))) {
    console.error(`  ⚠️  건너뜀 — HTML 이 없다: ${p.dir}.html`);
    continue;
  }
  console.log(`  ${p.label}`);
  await run("scripts/export-ig.mjs", [p.dir]);
}

if (panoDirs.length > 0) {
  console.log(`\n▶ 파노라마 ${panoDirs.length}칸 내보내기\n`);
  await run("scripts/gen-panorama.mjs", []);
}

console.log(`\n▶ 그리드 미리보기 갱신\n`);
await run("scripts/preview-grid.mjs", []);

console.log(`\n✅ 전체 내보내기 완료`);
