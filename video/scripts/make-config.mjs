// 캡처된 카드로 회차 설정(public/config/<id>.json) 생성
// 사용법: node scripts/make-config.mjs 03
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");
const repoRoot = resolve(videoRoot, "..");

const FPS = 30;
const SEC = (s) => Math.round(s * FPS);

// 카드 노출 시간 = 읽는 시간 (글자 수에 비례). 천천히 읽도록 넉넉하게.
// duration(초) = BASE + 글자수 × PER_CHAR, [MIN, MAX] 범위로 제한
const READ = { BASE: 3.0, PER_CHAR: 0.045, MIN: 4.5, MAX: 9.0 };
const readSeconds = (chars) =>
  Math.min(READ.MAX, Math.max(READ.MIN, READ.BASE + chars * READ.PER_CHAR));

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function readTitle(id) {
  const htmlPath = resolve(repoRoot, "site/public/cardnews", `${id}.html`);
  try {
    const html = await readFile(htmlPath, "utf8");
    const m = html.match(/<title>([^<]*)<\/title>/);
    if (!m) return id;
    // "생각하는 글밭 — 03. 질문하는 힘" → "질문하는 힘"
    const afterDash = m[1].split(/[—-]/).pop().trim();
    return afterDash.replace(/^\d+\.\s*/, "").trim() || id;
  } catch {
    return id;
  }
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("회차 번호를 지정하세요. 예: node scripts/make-config.mjs 03");
    process.exit(1);
  }

  const cardsDir = resolve(videoRoot, "public/cards", id);
  const pngs = (await readdir(cardsDir).catch(() => []))
    .filter((f) => f.endsWith(".png"))
    .sort();
  if (pngs.length === 0) {
    console.error(`캡처된 카드가 없습니다. 먼저 capture 를 실행하세요: ${cardsDir}`);
    process.exit(1);
  }

  // 카드별 배경색 + 글자 수 (capture 가 추출한 _meta.json)
  let meta = [];
  try {
    meta = JSON.parse(await readFile(resolve(cardsDir, "_meta.json"), "utf8"));
  } catch {
    meta = [];
  }

  // 타이밍: 글자 수에 비례해 읽는 시간 자동 배분 (글 많은 카드일수록 오래 머묾)
  const cards = pngs.map((png, i) => {
    const info = meta[i] || {};
    const chars = typeof info.chars === "number" ? info.chars : 80;
    return {
      image: `cards/${id}/${png}`,
      bg: info.bg || "#E8D5C0",
      durationInFrames: SEC(readSeconds(chars)),
    };
  });

  const audioRel = `audio/${id}.mp3`;
  const hasAudio = await exists(resolve(videoRoot, "public", audioRel));

  const config = {
    id,
    title: await readTitle(id),
    fps: FPS,
    cards,
    audio: hasAudio ? audioRel : null,
  };

  const outDir = resolve(videoRoot, "public/config");
  await mkdir(outDir, { recursive: true });
  const outPath = resolve(outDir, `${id}.json`);
  await writeFile(outPath, JSON.stringify(config, null, 2), "utf8");

  const totalSec = (
    cards.reduce((s, c) => s + c.durationInFrames, 0) / FPS
  ).toFixed(1);
  console.log(`✅ 설정 생성: ${outPath}`);
  console.log(`   카드 ${cards.length}장 · 약 ${totalSec}초 · 음악 ${hasAudio ? "있음" : "없음(무음)"}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
