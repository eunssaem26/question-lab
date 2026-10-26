// 세 채널 + 임시 보관소 토큰이 살아 있는지, 어느 계정에 붙었는지만 확인한다.
// 사용법: node scripts/social/verify.mjs
// 토큰 값은 어떤 경우에도 출력하지 않는다. 계정 이름·ID·응답 코드만 찍는다.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadEnv } from "./lib.mjs";

const run = promisify(execFile);
const env = await loadEnv();
let bad = 0;

async function check(name, keys, fn) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) {
    console.log(`⬜ ${name}: 아직 연결 안 됨 (.env 에 ${missing.join(", ")} 없음)`);
    return;
  }
  try {
    console.log(`✅ ${name}: ${await fn()}`);
  } catch (e) {
    bad++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}
async function get(url) {
  const res = await fetch(url);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`${res.status} ${j.error?.message ?? j.error_description ?? ""}`.trim());
  return j;
}

await check("인스타", ["IG_ACCESS_TOKEN"], async () => {
  const j = await get(`https://graph.instagram.com/v23.0/me?fields=user_id,username&access_token=${encodeURIComponent(env.IG_ACCESS_TOKEN)}`);
  const hint = env.IG_USER_ID && env.IG_USER_ID !== j.user_id ? ` ⚠️ .env 의 IG_USER_ID 를 ${j.user_id} 로 고치세요` : env.IG_USER_ID ? "" : ` → .env 에 IG_USER_ID=${j.user_id} 추가`;
  return `@${j.username} (IG_USER_ID ${j.user_id})${hint}`;
});
await check("스레드", ["THREADS_ACCESS_TOKEN"], async () => {
  const j = await get(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${encodeURIComponent(env.THREADS_ACCESS_TOKEN)}`);
  const hint = env.THREADS_USER_ID ? "" : ` → .env 에 THREADS_USER_ID=${j.id} 추가`;
  return `@${j.username} (THREADS_USER_ID ${j.id})${hint}`;
});
await check("유튜브", ["YT_CLIENT_ID", "YT_CLIENT_SECRET", "YT_REFRESH_TOKEN"], async () => {
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({
    client_id: env.YT_CLIENT_ID, client_secret: env.YT_CLIENT_SECRET, refresh_token: env.YT_REFRESH_TOKEN, grant_type: "refresh_token" }) });
  const t = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${t.error ?? ""}`);
  const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${t.access_token}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} ${j.error?.message ?? ""}`);
  return j.items?.map((c) => `${c.snippet.title} (${c.id})`).join(", ") ?? "채널 없음";
});
await check("임시 보관소(Vercel Blob)", ["BLOB_READ_WRITE_TOKEN"], async () => {
  await run("vercel", ["blob", "list", "--limit", "1", "--rw-token", env.BLOB_READ_WRITE_TOKEN, "--non-interactive"]);
  return "접속됨";
});
process.exit(bad ? 1 : 0);
