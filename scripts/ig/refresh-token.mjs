// 인스타 장기 토큰(60일)을 갱신한다. 발급 24시간 뒤부터 가능, 50~55일 안에 해야 한다.
// daily.sh 가 매일 부르고, 마지막 갱신에서 7일이 지났을 때만 실제로 갱신한다.
//   node scripts/ig/refresh-token.mjs          (7일 지났으면 갱신)
//   node scripts/ig/refresh-token.mjs --force  (지금 갱신)
// .env 의 IG_ACCESS_TOKEN 과 IG_TOKEN_REFRESHED_AT 을 제자리에서 고쳐 쓴다. 토큰 값은 출력하지 않는다.
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env");
const force = process.argv.includes("--force");

let raw;
try { raw = await readFile(envPath, "utf8"); } catch { console.error("❌ .env 없음"); process.exit(1); }
const get = (k) => raw.match(new RegExp(`^\\s*${k}\\s*=\\s*(.*)\\s*$`, "m"))?.[1]?.replace(/^["']|["']$/g, "").trim();
const token = get("IG_ACCESS_TOKEN");
if (!token) { console.error("❌ IG_ACCESS_TOKEN 없음"); process.exit(1); }

const last = get("IG_TOKEN_REFRESHED_AT");
const days = last ? (Date.now() - Date.parse(last)) / 86400000 : Infinity;
if (!force && days < 7) { console.log(`· 토큰 갱신 ${days.toFixed(1)}일 전 — 건너뜀`); process.exit(0); }

const url = new URL("https://graph.instagram.com/refresh_access_token");
url.searchParams.set("grant_type", "ig_refresh_token");
url.searchParams.set("access_token", token);
const res = await fetch(url);
const body = await res.json().catch(() => ({}));
if (!res.ok || !body.access_token) {
  const e = body?.error ?? {};
  console.error(`❌ 갱신 실패 (HTTP ${res.status}) code ${e.code ?? "?"}: ${e.message ?? JSON.stringify(body)}`);
  if (!last) console.error("   (발급 24시간 안이면 아직 갱신이 안 된다 — 내일 다시)");
  process.exit(1);
}

const now = new Date().toISOString();
let next = raw.replace(/^(\s*IG_ACCESS_TOKEN\s*=).*$/m, `$1${body.access_token}`);
next = /^\s*IG_TOKEN_REFRESHED_AT\s*=/m.test(next)
  ? next.replace(/^(\s*IG_TOKEN_REFRESHED_AT\s*=).*$/m, `$1${now}`)
  : next.trimEnd() + `\nIG_TOKEN_REFRESHED_AT=${now}\n`;
await writeFile(envPath, next, { mode: 0o600 });
console.log(`✅ 토큰 갱신됨 (유효 ${Math.round((body.expires_in ?? 0) / 86400)}일)`);
