// 밭피디 SNS 발행 공용 도우미. 의존성 없음.
// 대기열·기록은 operations/social/queue.json 하나 (operations/ 는 gitignore).
// 토큰은 .env 에만 있고, 어떤 함수도 토큰 값을 출력하지 않는다.
import { readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "../..");
export const socialDir = resolve(repoRoot, "operations/social");
export const queuePath = resolve(socialDir, "queue.json");

export const CHANNELS = ["instagram", "threads", "youtube"];
export const CHANNEL_KO = { instagram: "인스타", threads: "스레드", youtube: "유튜브" };

export const fromRepo = (p) => (isAbsolute(p) ? p : resolve(repoRoot, p));

export async function loadEnv() {
  let raw = "";
  try {
    raw = await readFile(resolve(repoRoot, ".env"), "utf8");
  } catch {
    return {};
  }
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

// 아직 연결 안 된 채널은 queue.json 의 channelsEnabled 에서 빼 둔다 → 그 채널은 기다리지 않고 건너뛴다.
let enabled = CHANNELS;
export async function loadQueue() {
  const q = JSON.parse(await readFile(queuePath, "utf8"));
  enabled = q.channelsEnabled ?? CHANNELS;
  return q;
}

// 쓰다가 죽어도 파일이 반쯤 남지 않게 임시 파일에 쓰고 바꿔 끼운다.
export async function saveQueue(q) {
  const tmp = queuePath + ".tmp";
  await writeFile(tmp, JSON.stringify(q, null, 2) + "\n", "utf8");
  await rename(tmp, queuePath);
}

export const pending = (item) => item.channels.filter((c) => enabled.includes(c) && !item.results?.[c]);
export const skipped = (item) => item.channels.filter((c) => !enabled.includes(c));
export const isDone = (item) => pending(item).length === 0;
export const nextItem = (q) => q.items.find((it) => !isDone(it) && !it.hold);

// 채널별 글. 파일 경로가 있으면 읽고, 스레드는 인스타 글에서 해시태그 줄을 빼고 500자로 줄인다.
export async function captionFor(item, channel) {
  const src = item.caption?.[channel];
  if (channel === "youtube") {
    if (src) return JSON.parse(await readFile(fromRepo(src), "utf8"));
    // 따로 쓴 게 없으면 인스타 글에서 만든다: 첫 줄 = 제목, 전체 = 설명
    if (!item.caption?.instagram) return null;
    const ig = (await readFile(fromRepo(item.caption.instagram), "utf8")).trim();
    const first = ig.split("\n").find((l) => l.trim()) ?? item.label;
    const title = (first.length > 80 ? first.slice(0, 79) + "…" : first) + " #Shorts";
    return { title, description: ig, tags: ["생각하는 글밭"], categoryId: "27" };
  }
  if (src) return (await readFile(fromRepo(src), "utf8")).trim();
  if (channel === "threads" && item.caption?.instagram) {
    const ig = (await readFile(fromRepo(item.caption.instagram), "utf8")).trim();
    const body = ig.split("\n").filter((l) => !/^#\S/.test(l.trim())).join("\n").trim();
    return body.length <= 500 ? body : body.slice(0, 497).trimEnd() + "…";
  }
  return null;
}

export const LIMITS = { instagram: 2200, threads: 500, youtubeTitle: 100, youtubeDesc: 5000 };
