// 손으로 올릴 때 "다음 차례"를 짚어주고 폴더를 열어준다.
// 순서가 한 번 틀어지면 프로필 그리드 전체가 밀리므로, 다음 1건만 보여준다.
//
//   node scripts/ig/next.mjs          다음 차례 확인 + 폴더 열기 + 캡션 출력
//   node scripts/ig/next.mjs --done   방금 올린 걸 완료 처리
//   node scripts/ig/next.mjs --status 전체 진행 상황
//   node scripts/ig/next.mjs --undo   마지막 완료를 취소 (잘못 눌렀을 때)
//
// 진행 상태는 operations/instagram/state.json 에 쌓인다.
// 나중에 API 자동 발행으로 넘어갈 때도 같은 파일을 그대로 쓴다.
import { readFile, writeFile, mkdir, readdir, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const videoRoot = resolve(repoRoot, "video");
const exportsDir = resolve(repoRoot, "exports/instagram");
const stateDir = resolve(repoRoot, "operations/instagram");
const statePath = resolve(stateDir, "state.json");

const exists = (p) => access(p).then(() => true, () => false);

const { posts } = JSON.parse(await readFile(resolve(videoRoot, "data/posts.json"), "utf8"));

async function loadState() {
  if (!(await exists(statePath))) return { posted: [] };
  return JSON.parse(await readFile(statePath, "utf8"));
}
async function saveState(s) {
  await mkdir(stateDir, { recursive: true });
  await writeFile(statePath, JSON.stringify(s, null, 2) + "\n", "utf8");
}

const state = await loadState();
const args = process.argv.slice(2);
const done = new Set(state.posted.map((p) => p.dir));

// ── --status ──────────────────────────────────────────────
if (args.includes("--status")) {
  console.log(`\n진행 ${done.size}/${posts.length}\n`);
  posts.forEach((p, i) => {
    const mark = done.has(p.dir) ? "✅" : "⬜";
    const when = state.posted.find((x) => x.dir === p.dir)?.at ?? "";
    console.log(`  ${mark} ${String(i + 1).padStart(2)}. ${p.label.padEnd(12)} ${when}`);
  });
  console.log();
  process.exit(0);
}

// ── --undo ────────────────────────────────────────────────
if (args.includes("--undo")) {
  const last = state.posted.pop();
  if (!last) {
    console.log("취소할 기록이 없다.");
    process.exit(0);
  }
  await saveState(state);
  console.log(`↩️  "${last.label}" 완료 표시를 취소했다. 다시 다음 차례가 된다.`);
  process.exit(0);
}

// 다음 차례 = 아직 안 올린 것 중 순서상 가장 앞
const nextIndex = posts.findIndex((p) => !done.has(p.dir));

if (nextIndex === -1) {
  console.log(`\n🎉 ${posts.length}개 전부 올렸다. 오픈 시퀀스 완료.\n`);
  console.log(`   프로필에 들어가 그리드가 _grid-preview.png 와 같은지 확인해보세요.\n`);
  process.exit(0);
}

const next = posts[nextIndex];
const folder = resolve(exportsDir, next.dir);
const captionPath = resolve(videoRoot, "data/captions", `${next.dir}.txt`);

// ── --done ────────────────────────────────────────────────
if (args.includes("--done")) {
  // 날짜는 스크립트가 실행된 시점 기준으로 남긴다
  const at = new Date().toISOString().slice(0, 16).replace("T", " ");
  state.posted.push({ dir: next.dir, label: next.label, at });
  await saveState(state);
  const left = posts.length - state.posted.length;
  console.log(`\n✅ ${nextIndex + 1}. ${next.label} 완료 처리 (${at})`);
  console.log(left > 0 ? `   남은 게시물 ${left}개. 다음 차례를 보려면 인자 없이 다시 실행.\n` : `   전부 끝났다.\n`);
  process.exit(0);
}

// ── 기본: 다음 차례 안내 ──────────────────────────────────
if (!(await exists(folder))) {
  console.error(`\n❌ 이미지 폴더가 없다: ${folder}`);
  console.error(`   먼저 내보내세요:  cd video && npm run ig ${next.dir}\n`);
  process.exit(1);
}

const files = (await readdir(folder)).filter((f) => f.endsWith(".jpg")).sort();

console.log(`\n━━━ ${nextIndex + 1} / ${posts.length} 번째 게시물 ━━━\n`);
console.log(`  ${next.label}  (${next.group})`);
console.log(`  이미지 ${files.length}장 — ${files.join(", ")}`);
console.log(`  폴더: ${folder}\n`);

if (await exists(captionPath)) {
  console.log(`━━━ 캡션 (아래를 그대로 복사) ━━━\n`);
  console.log(await readFile(captionPath, "utf8"));
} else {
  console.log(`⚠️  캡션 파일이 없다: ${captionPath}\n`);
}

console.log(`━━━ 업로드 화면에서 ━━━\n`);
if (next.fullBleed) {
  console.log(`  🚨 반드시 확대 아이콘(⤢)을 눌러 4:5 로 맞출 것.`);
  console.log(`     이 게시물은 사진이 가장자리까지 꽉 찬다. 1:1 로 올리면 정사각이 되고,`);
  console.log(`     그리드가 4:5 로 되돌리면서 좌우를 잘라내 가장자리 인물이 사라진다.\n`);
} else {
  console.log(`  확대 아이콘(⤢)을 한 번 눌러 4:5 로 두면 피드에서 더 크게 보인다.`);
  console.log(`  이 게시물은 여백이 있어 1:1 로 올려도 내용은 안 잘린다.\n`);
}
console.log(`━━━ 올린 뒤 ━━━\n`);
console.log(`  node scripts/ig/next.mjs --done\n`);

// 파인더로 폴더 열기 (macOS)
spawn("open", [folder], { stdio: "ignore", detached: true }).unref();
