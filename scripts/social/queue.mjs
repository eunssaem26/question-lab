// 밭피디 SNS 대기열.
//
//   node scripts/social/queue.mjs --status          전체 순서와 채널별 진행
//   node scripts/social/queue.mjs --next            다음 1건 (승인 요청용 요약 + 채널별 글)
//   node scripts/social/queue.mjs --next --json     같은 내용을 JSON으로
//   node scripts/social/queue.mjs --add --id <id> --label <이름> --video <파일>
//        [--ig <글파일>] [--threads <글파일>] [--yt <json파일>] [--channels instagram,threads,youtube]
//                                                   맨 뒤에 영상 1건 추가 (motion-prompt 스킬이 부른다)
//   node scripts/social/queue.mjs --hold <id> / --unhold <id>   잠시 빼 두기 / 되살리기
//
// 순서 = items 배열 순서. 위에서부터 올린다.
import { access } from "node:fs/promises";
import { loadQueue, saveQueue, pending, skipped, isDone, nextItem, captionFor, fromRepo, CHANNEL_KO, CHANNELS } from "./lib.mjs";

const args = process.argv.slice(2);
const opt = (k) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const q = await loadQueue();

if (args.includes("--status")) {
  const done = q.items.filter(isDone).length;
  console.log(`\n대기열 ${done}/${q.items.length} 완료 · 연결된 채널: ${(q.channelsEnabled ?? CHANNELS).map((c) => CHANNEL_KO[c]).join(" · ")} (⏸ = 연결 전이라 건너뜀)\n`);
  q.items.forEach((it, i) => {
    const ch = it.channels.map((c) => `${it.results?.[c] ? "✅" : skipped(it).includes(c) ? "⏸" : "⬜"}${CHANNEL_KO[c]}`).join(" ");
    const mark = it.hold ? "⏸" : isDone(it) ? "✅" : "⬜";
    console.log(`  ${mark} ${String(i + 1).padStart(2)}. ${it.label.padEnd(14)} [${it.group}] ${ch}`);
  });
  console.log();
  process.exit(0);
}

if (args.includes("--next")) {
  const it = nextItem(q);
  if (!it) {
    console.log(args.includes("--json") ? "null" : "대기열이 비었다.");
    process.exit(0);
  }
  const captions = {};
  for (const c of pending(it)) captions[c] = await captionFor(it, c);
  if (args.includes("--json")) {
    console.log(JSON.stringify({ ...it, pendingChannels: pending(it), captions }, null, 2));
    process.exit(0);
  }
  const idx = q.items.indexOf(it) + 1;
  console.log(`다음: ${idx}/${q.items.length} ${it.label} (${it.kind}, ${it.group})`);
  console.log(`파일: ${it.mediaDir ?? it.video}`);
  console.log(`채널: ${pending(it).map((c) => CHANNEL_KO[c]).join(" · ")}`);
  console.log(`승인되면 실행할 명령: node scripts/social/publish.mjs ${it.id}`);
  for (const [c, text] of Object.entries(captions)) {
    console.log(`\n── ${CHANNEL_KO[c]} ──`);
    console.log(typeof text === "string" ? text : JSON.stringify(text, null, 2));
  }
  process.exit(0);
}

if (args.includes("--add")) {
  const id = opt("--id"), label = opt("--label"), video = opt("--video");
  if (!id || !label || !video) {
    console.error("❌ --id, --label, --video 가 필요하다.");
    process.exit(1);
  }
  if (q.items.some((x) => x.id === id)) {
    console.error(`❌ 이미 있는 id: ${id}`);
    process.exit(1);
  }
  await access(fromRepo(video)).catch(() => {
    console.error(`❌ 영상 파일이 없다: ${video}`);
    process.exit(1);
  });
  const channels = (opt("--channels") ?? "instagram,threads,youtube").split(",").filter((c) => CHANNELS.includes(c));
  const caption = {};
  if (opt("--ig")) caption.instagram = opt("--ig");
  if (opt("--threads")) caption.threads = opt("--threads");
  if (opt("--yt")) caption.youtube = opt("--yt");
  q.items.push({ id, label, group: opt("--group") ?? "영상", kind: "reel", video, channels, caption, results: {} });
  await saveQueue(q);
  console.log(`✅ 대기열 ${q.items.length}번째에 추가: ${label}`);
  process.exit(0);
}

for (const flag of ["--hold", "--unhold"]) {
  if (args.includes(flag)) {
    const it = q.items.find((x) => x.id === opt(flag));
    if (!it) {
      console.error(`❌ 없는 id: ${opt(flag)}`);
      process.exit(1);
    }
    if (flag === "--hold") it.hold = true;
    else delete it.hold;
    await saveQueue(q);
    console.log(`${flag === "--hold" ? "⏸ 빼 둠" : "▶ 되살림"}: ${it.label}`);
    process.exit(0);
  }
}

console.log("사용법은 파일 맨 위 주석을 보세요: --status | --next | --add | --hold | --unhold");
