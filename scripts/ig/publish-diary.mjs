// 그림일기 한 장을 인스타 @eunssaem26 에 발행한다 (Instagram Graph API, 단일 이미지).
//
//   node scripts/ig/publish-diary.mjs 2026-09-30            발행
//   node scripts/ig/publish-diary.mjs 2026-09-30 --dry-run  URL 준비·캡션까지만, 인스타는 안 부름
//
// 흐름: diary/<날짜>/diary.jpg → 공개 저장소(~/Desktop/geulbat-diary)에 push → raw URL 200 확인
//       → media 컨테이너 생성 → 상태 FINISHED 대기 → media_publish → operations/instagram/diary-state.json 기록
// 하루 한 편만 올린다. 이미 기록된 날짜면 아무것도 하지 않는다.
// 토큰 값은 절대 출력하지 않는다.
import { readFile, writeFile, mkdir, copyFile, access } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const run = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const IMAGE_REPO = resolve(process.env.HOME, "Desktop/geulbat-diary");
const RAW_BASE = "https://raw.githubusercontent.com/eunssaem26/geulbat-diary/main";
const GRAPH = "https://graph.instagram.com/v21.0";
const statePath = resolve(repoRoot, "operations/instagram/diary-state.json");

const [date, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) fail("사용법: publish-diary.mjs YYYY-MM-DD [--dry-run]");

const exists = (p) => access(p).then(() => true, () => false);
function fail(msg) { console.error("❌ " + msg); process.exit(1); }

async function loadEnv() {
  const p = resolve(repoRoot, ".env");
  if (!(await exists(p))) fail(`.env 가 없다: ${p} — operations/instagram/SETUP.md 7단계`);
  const env = {};
  for (const line of (await readFile(p, "utf8")).split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}
async function loadState() {
  return (await exists(statePath)) ? JSON.parse(await readFile(statePath, "utf8")) : { posted: [] };
}
async function graph(path, params, { method = "POST" } = {}) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { method });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = body?.error ?? {};
    fail(`인스타 거절 (HTTP ${res.status}) ${e.type ?? ""} code ${e.code ?? "?"}: ${e.message ?? JSON.stringify(body)}`);
  }
  return body;
}

// 1. 입력
const dir = resolve(repoRoot, "diary", date);
const jpg = resolve(dir, "diary.jpg");
const json = resolve(dir, "diary.json");
if (!(await exists(jpg)) || !(await exists(json))) fail(`${dir} 에 diary.jpg / diary.json 이 없다`);
const diary = JSON.parse(await readFile(json, "utf8"));

const state = await loadState();
if (state.posted.some((p) => p.date === date)) {
  console.log(`· ${date} 는 이미 올렸다 (${state.posted.find((p) => p.date === date).permalink ?? "id " + state.posted.find((p) => p.date === date).mediaId}). 하루 한 편.`);
  process.exit(0);
}

const caption = [
  diary.title,
  "",
  diary.text,
  "",
  `${diary.sign ?? "— 필로"} · ${date}`,
  "",
  "#생각하는글밭 #그림일기 #필로 #AI에이전트 #개발일지 #WhereThoughtsGrow",
].join("\n");

// 2. 공개 URL 만들기 (전용 공개 저장소에 push)
if (!(await exists(resolve(IMAGE_REPO, ".git")))) fail(`이미지 저장소가 없다: ${IMAGE_REPO} — gh repo clone eunssaem26/geulbat-diary ~/Desktop/geulbat-diary`);
const fileName = `${date}.jpg`;
await copyFile(jpg, resolve(IMAGE_REPO, fileName));
const git = (...a) => run("git", a, { cwd: IMAGE_REPO });
await git("add", fileName);
const { stdout: status } = await git("status", "--porcelain");
if (status.trim()) {
  await git("commit", "-qm", `diary ${date}: ${diary.title}`);
  await git("push", "-q", "origin", "main");
}
const imageUrl = `${RAW_BASE}/${fileName}`;

// raw URL 이 실제로 JPEG 로 열리는지 확인 (푸시 직후 잠깐 404 가 날 수 있어 몇 번 본다)
let ok = false;
for (let i = 0; i < 10 && !ok; i++) {
  const r = await fetch(imageUrl, { method: "HEAD", cache: "no-store" });
  ok = r.ok && /image\/jpeg/.test(r.headers.get("content-type") ?? "");
  if (!ok) await new Promise((r) => setTimeout(r, 3000));
}
if (!ok) fail(`공개 URL 확인 실패: ${imageUrl}`);
console.log(`· 이미지 URL 준비됨: ${imageUrl}`);
console.log(`· 캡션:\n${caption.split("\n").map((l) => "    " + l).join("\n")}`);

if (dryRun) { console.log("· --dry-run: 인스타는 부르지 않았다"); process.exit(0); }

// 3. 인스타 발행
const env = await loadEnv();
const token = env.IG_ACCESS_TOKEN, igUser = env.IG_USER_ID;
if (!token) fail(".env 에 IG_ACCESS_TOKEN 이 없다");
if (!igUser) fail(".env 에 IG_USER_ID 가 없다 — node scripts/ig/verify-token.mjs 로 알아내서 적는다");

const { id: creationId } = await graph(`${igUser}/media`, { image_url: imageUrl, caption, access_token: token });
for (let i = 0; i < 20; i++) {
  const { status_code: s, status } = await graph(creationId, { fields: "status_code,status", access_token: token }, { method: "GET" });
  if (s === "FINISHED") break;
  if (s === "ERROR") fail(`컨테이너 처리 실패: ${status}`);
  await new Promise((r) => setTimeout(r, 3000));
}
const { id: mediaId } = await graph(`${igUser}/media_publish`, { creation_id: creationId, access_token: token });
const { permalink } = await graph(mediaId, { fields: "permalink", access_token: token }, { method: "GET" }).catch(() => ({}));

state.posted.push({ date, mediaId, permalink, imageUrl, title: diary.title, postedAt: new Date().toISOString() });
await mkdir(dirname(statePath), { recursive: true });
await writeFile(statePath, JSON.stringify(state, null, 2) + "\n");
console.log(`✅ 올라갔어 → ${permalink ?? "media " + mediaId}`);
