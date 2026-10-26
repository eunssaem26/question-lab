// 대기열 1건을 인스타·스레드·유튜브에 올린다. 밭피디는 은쌤 승인을 받은 뒤에만 이 명령을 실행한다.
//
//   node scripts/social/publish.mjs <id> --dry-run        네트워크 없이 파일·글·길이만 점검
//   node scripts/social/publish.mjs <id>                  아직 안 올린 채널 전부
//   node scripts/social/publish.mjs <id> --only instagram 한 채널만
//
// 채널 하나가 끝날 때마다 queue.json 에 기록한다. 중간에 실패해도 다시 실행하면 남은 채널만 올린다.
// 유튜브는 구글 감사 전이라 '비공개'로 올라간다 → 은쌤이 스튜디오에서 공개로 바꾼다.
// 토큰 값은 어떤 경우에도 출력하지 않는다.
import { readFile, readdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, extname } from "node:path";
import {
  loadEnv, loadQueue, saveQueue, pending, captionFor, fromRepo, CHANNEL_KO, LIMITS,
} from "./lib.mjs";

const run = promisify(execFile);
const IG = "https://graph.instagram.com/v23.0";
const TH = "https://graph.threads.net/v1.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith("--"));
const dry = args.includes("--dry-run");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;

if (!id) {
  console.error("사용법: node scripts/social/publish.mjs <id> [--dry-run] [--only instagram,threads,youtube]");
  process.exit(1);
}
const q = await loadQueue();
const item = q.items.find((x) => x.id === id);
if (!item) {
  console.error(`❌ 대기열에 없는 id: ${id}`);
  process.exit(1);
}
const channels = pending(item).filter((c) => !only || only.includes(c));
if (!channels.length) {
  console.log(`이미 다 올렸다: ${item.label}`);
  process.exit(0);
}

// ── 파일 목록 ────────────────────────────────────────────
async function mediaFiles() {
  if (item.kind === "carousel") {
    const dir = fromRepo(item.mediaDir);
    const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort();
    return files.map((f) => `${dir}/${f}`);
  }
  return [fromRepo(item.video)];
}

async function probe(file) {
  const { stdout } = await run("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries",
    "stream=width,height:format=duration", "-of", "json", file]);
  const j = JSON.parse(stdout);
  return { w: j.streams[0].width, h: j.streams[0].height, sec: Number(j.format.duration) };
}

// ── 점검 (dry-run 이든 아니든 먼저 한다) ──────────────────
const files = await mediaFiles();
const problems = [];
for (const f of files) await stat(f).catch(() => problems.push(`파일 없음: ${f}`));
if (item.kind === "carousel" && (files.length < 2 || files.length > 10)) problems.push(`캐러셀 장수 ${files.length} (2~10장이어야 함)`);
const texts = {};
for (const c of channels) {
  texts[c] = await captionFor(item, c);
  if (!texts[c]) problems.push(`${CHANNEL_KO[c]} 글 없음`);
}
if (texts.instagram && texts.instagram.length > LIMITS.instagram) problems.push(`인스타 글 ${texts.instagram.length}자 > ${LIMITS.instagram}`);
if (texts.instagram && (texts.instagram.match(/#\S+/g) ?? []).length > 30) problems.push("인스타 해시태그 30개 초과");
if (texts.threads && texts.threads.length > LIMITS.threads) problems.push(`스레드 글 ${texts.threads.length}자 > ${LIMITS.threads}`);
if (texts.youtube && texts.youtube.title.length > LIMITS.youtubeTitle) problems.push(`유튜브 제목 ${texts.youtube.title.length}자 > ${LIMITS.youtubeTitle}`);
let video;
if (item.kind === "reel" && !problems.length) {
  video = await probe(files[0]);
  if (video.h <= video.w) problems.push(`세로 영상이 아님 (${video.w}×${video.h})`);
  if (channels.includes("youtube") && video.sec > 180) problems.push(`쇼츠는 3분 이하 (${video.sec.toFixed(1)}초)`);
}

console.log(`${item.label} → ${channels.map((c) => CHANNEL_KO[c]).join(" · ")}`);
console.log(`파일 ${files.length}개${video ? ` · ${video.w}×${video.h} · ${video.sec.toFixed(1)}초` : ""}`);
if (problems.length) {
  console.error("❌ 점검 실패\n  - " + problems.join("\n  - "));
  process.exit(1);
}
if (dry) {
  console.log("✅ 점검 통과 (dry-run: 아무것도 올리지 않았다)");
  process.exit(0);
}

// ── 토큰 ────────────────────────────────────────────────
const env = await loadEnv();
const need = {
  instagram: ["IG_ACCESS_TOKEN", "IG_USER_ID"],
  threads: ["THREADS_ACCESS_TOKEN", "THREADS_USER_ID"],
  youtube: ["YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"],
};
const needsBlob = channels.includes("threads") || (channels.includes("instagram") && item.kind === "carousel");
const missing = channels.flatMap((c) => need[c].filter((k) => !env[k]));
if (needsBlob && !env.BLOB_READ_WRITE_TOKEN) missing.push("BLOB_READ_WRITE_TOKEN");
if (missing.length) {
  console.error(`❌ .env 에 없음: ${missing.join(", ")} — docs/intent 문서의 '은쌤이 직접 해야 하는 것' 참고`);
  process.exit(1);
}

// ── 임시 공개 주소 (Vercel Blob) ─────────────────────────
// 인스타 사진·스레드는 API가 공개 주소의 파일만 받는다. 올린 뒤 바로 지운다.
const blobs = [];
async function publicUrl(file) {
  const name = `social-tmp/${item.id}-${Date.now()}-${basename(file)}`;
  const { stdout, stderr } = await run("vercel", ["blob", "put", file, "--access", "public", "--pathname", name,
    "--rw-token", env.BLOB_READ_WRITE_TOKEN, "--non-interactive", "--no-color"], { maxBuffer: 1 << 20 });
  const url = (stdout + "\n" + stderr).match(/https:\/\/[^\s"']+\.blob\.vercel-storage\.com\/[^\s"']+/)?.[0];
  if (!url) throw new Error("Blob 주소를 받지 못했다");
  blobs.push(url);
  return url;
}
async function cleanupBlobs() {
  for (const url of blobs) {
    await run("vercel", ["blob", "del", url, "--rw-token", env.BLOB_READ_WRITE_TOKEN, "--non-interactive"]).catch(() =>
      console.error(`⚠️ 임시 파일을 못 지웠다(나중에 지우기): ${url}`));
  }
}

// ── 공통 HTTP ───────────────────────────────────────────
async function call(url, { method = "GET", params = {}, headers = {}, body } = {}) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { method, headers, body });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  if (!res.ok || json.error) {
    const msg = json.error?.message ?? json.error_description ?? json.raw ?? res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }
  return json;
}
const form = (o) => new URLSearchParams(o);

// ── 인스타 ──────────────────────────────────────────────
async function igWait(containerId) {
  for (let i = 0; i < 60; i++) {
    const s = await call(`${IG}/${containerId}`, { params: { fields: "status_code,status", access_token: env.IG_ACCESS_TOKEN } });
    if (s.status_code === "FINISHED") return;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") throw new Error(`인스타 처리 실패: ${s.status ?? s.status_code}`);
    await sleep(5000);
  }
  throw new Error("인스타 처리 5분 초과");
}
async function igPublish(creationId) {
  const p = await call(`${IG}/${env.IG_USER_ID}/media_publish`, { method: "POST",
    body: form({ creation_id: creationId, access_token: env.IG_ACCESS_TOKEN }) });
  const info = await call(`${IG}/${p.id}`, { params: { fields: "permalink", access_token: env.IG_ACCESS_TOKEN } });
  return { id: p.id, url: info.permalink };
}
async function postInstagram(text) {
  const tok = env.IG_ACCESS_TOKEN, me = env.IG_USER_ID;
  if (item.kind === "carousel") {
    const children = [];
    for (const f of files) {
      const c = await call(`${IG}/${me}/media`, { method: "POST",
        body: form({ image_url: await publicUrl(f), is_carousel_item: "true", access_token: tok }) });
      children.push(c.id);
    }
    for (const c of children) await igWait(c);
    const parent = await call(`${IG}/${me}/media`, { method: "POST",
      body: form({ media_type: "CAROUSEL", children: children.join(","), caption: text, access_token: tok }) });
    await igWait(parent.id);
    return igPublish(parent.id);
  }
  // 릴스: 이 컴퓨터의 파일을 바로 올린다 (resumable upload)
  const c = await call(`${IG}/${me}/media`, { method: "POST",
    body: form({ media_type: "REELS", upload_type: "resumable", caption: text, share_to_feed: "true", access_token: tok }) });
  const bytes = await readFile(files[0]);
  const up = await fetch(c.uri ?? `https://rupload.facebook.com/ig-api-upload/v23.0/${c.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${tok}`, offset: "0", file_size: String(bytes.length) },
    body: bytes,
  });
  if (!up.ok) throw new Error(`인스타 영상 업로드 ${up.status}`);
  await igWait(c.id);
  return igPublish(c.id);
}

// ── 스레드 ──────────────────────────────────────────────
async function thWait(containerId) {
  for (let i = 0; i < 60; i++) {
    const s = await call(`${TH}/${containerId}`, { params: { fields: "status,error_message", access_token: env.THREADS_ACCESS_TOKEN } });
    if (s.status === "FINISHED") return;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`스레드 처리 실패: ${s.error_message ?? s.status}`);
    await sleep(5000);
  }
  throw new Error("스레드 처리 5분 초과");
}
async function postThreads(text) {
  const tok = env.THREADS_ACCESS_TOKEN, me = env.THREADS_USER_ID;
  let creation;
  if (item.kind === "carousel") {
    const children = [];
    for (const f of files) {
      const c = await call(`${TH}/${me}/threads`, { method: "POST",
        body: form({ media_type: "IMAGE", image_url: await publicUrl(f), is_carousel_item: "true", access_token: tok }) });
      children.push(c.id);
    }
    for (const c of children) await thWait(c);
    creation = await call(`${TH}/${me}/threads`, { method: "POST",
      body: form({ media_type: "CAROUSEL", children: children.join(","), text, access_token: tok }) });
  } else {
    creation = await call(`${TH}/${me}/threads`, { method: "POST",
      body: form({ media_type: "VIDEO", video_url: await publicUrl(files[0]), text, access_token: tok }) });
  }
  await thWait(creation.id);
  const p = await call(`${TH}/${me}/threads_publish`, { method: "POST", body: form({ creation_id: creation.id, access_token: tok }) });
  const info = await call(`${TH}/${p.id}`, { params: { fields: "permalink", access_token: tok } });
  return { id: p.id, url: info.permalink };
}

// ── 유튜브 (쇼츠, 비공개) ───────────────────────────────
async function postYoutube(meta) {
  const t = await call("https://oauth2.googleapis.com/token", { method: "POST", body: form({
    client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  const bytes = await readFile(files[0]);
  const type = extname(files[0]).toLowerCase() === ".mov" ? "video/quicktime" : "video/mp4";
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: { Authorization: `Bearer ${t.access_token}`, "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(bytes.length), "X-Upload-Content-Type": type },
    body: JSON.stringify({
      snippet: { title: meta.title, description: meta.description, tags: meta.tags ?? [], categoryId: meta.categoryId ?? "27",
        defaultLanguage: "ko", defaultAudioLanguage: "ko" },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) throw new Error(`유튜브 업로드 시작 ${init.status} ${(await init.text()).slice(0, 200)}`);
  const put = await fetch(init.headers.get("location"), { method: "PUT", headers: { "Content-Type": type }, body: bytes });
  const v = await put.json();
  if (!put.ok) throw new Error(`유튜브 업로드 ${put.status} ${v.error?.message ?? ""}`);
  return { id: v.id, url: `https://youtube.com/shorts/${v.id}`, privacy: "private" };
}

// ── 실행 ────────────────────────────────────────────────
const posters = { instagram: postInstagram, threads: postThreads, youtube: postYoutube };
let failed = 0;
try {
  for (const c of channels) {
    try {
      const r = await posters[c](texts[c]);
      item.results ??= {};
      item.results[c] = { ...r, at: new Date().toISOString() };
      await saveQueue(q);
      console.log(`✅ ${CHANNEL_KO[c]}: ${r.url}${r.privacy === "private" ? " (비공개 — 스튜디오에서 공개로 바꾸기)" : ""}`);
    } catch (e) {
      failed++;
      console.error(`❌ ${CHANNEL_KO[c]}: ${e.message}`);
    }
  }
} finally {
  await cleanupBlobs();
}
process.exit(failed ? 1 : 0);
