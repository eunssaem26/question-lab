// 인스타 발행 토큰이 살아 있는지, 어느 계정에 붙었는지 확인한다.
// 사용법: node scripts/ig/verify-token.mjs
//
// 토큰 값은 어떤 경우에도 출력하지 않는다. 로그·터미널에 남으면 안 되기 때문이다.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const envPath = resolve(repoRoot, ".env");

// .env 파서 (의존성 없이). KEY=VALUE 만 읽고 따옴표는 벗긴다.
async function loadEnv() {
  let raw;
  try {
    raw = await readFile(envPath, "utf8");
  } catch {
    console.error(`❌ .env 가 없다: ${envPath}`);
    console.error(`   operations/instagram/SETUP.md 의 7단계를 먼저 하세요.`);
    process.exit(1);
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

const env = await loadEnv();
const token = env.IG_ACCESS_TOKEN;

if (!token) {
  console.error("❌ .env 에 IG_ACCESS_TOKEN 이 없다.");
  process.exit(1);
}
if (/\s/.test(token)) {
  console.error("❌ 토큰에 공백이나 줄바꿈이 섞였다. 복사할 때 잘린 것 같다.");
  process.exit(1);
}

const url = new URL("https://graph.instagram.com/me");
url.searchParams.set("fields", "id,username,account_type");
url.searchParams.set("access_token", token);

const res = await fetch(url);
const body = await res.json();

if (!res.ok) {
  const err = body?.error ?? {};
  console.error(`❌ 인스타가 거절했다 (HTTP ${res.status})`);
  console.error(`   ${err.type ?? "?"} / code ${err.code ?? "?"}: ${err.message ?? JSON.stringify(body)}`);
  if (err.code === 190) {
    console.error(`   → 토큰이 만료됐거나 잘못됐다. SETUP.md 6~7단계를 다시 하세요.`);
  }
  process.exit(1);
}

console.log("✅ 토큰이 살아 있다.\n");
console.log(`   계정      @${body.username}`);
console.log(`   유형      ${body.account_type ?? "(응답 없음)"}`);
console.log(`   IG_USER_ID ${body.id}`);

if (body.account_type && !/business/i.test(body.account_type)) {
  console.log(
    `\n⚠️  계정 유형이 비즈니스가 아니다(${body.account_type}). 발행 API 가 막힐 수 있으니\n` +
    `   인스타 앱에서 비즈니스로 전환하세요. (SETUP.md 1단계)`
  );
}

if (!env.IG_USER_ID) {
  console.log(`\n📋 .env 의 IG_USER_ID 가 비어 있다. 위 값을 넣어 두세요:`);
  console.log(`   IG_USER_ID=${body.id}`);
} else if (env.IG_USER_ID !== body.id) {
  console.log(
    `\n⚠️  .env 의 IG_USER_ID(${env.IG_USER_ID}) 가 실제 값(${body.id}) 과 다르다. 고쳐야 한다.`
  );
}
