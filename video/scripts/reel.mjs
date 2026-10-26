// 원클릭: 캡처 → 설정 생성 → 렌더
// 사용법: node scripts/reel.mjs 03
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(__dirname, "..");

function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: videoRoot, stdio: "inherit" });
    p.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} ${args.join(" ")} → exit ${code}`))
    );
  });
}

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error("회차 번호를 지정하세요. 예: npm run reel 03");
    process.exit(1);
  }

  console.log(`\n▶ ${id}회차 카드 캡처`);
  await run("node", ["scripts/capture.mjs", id]);

  console.log(`\n▶ ${id}회차 설정 생성`);
  await run("node", ["scripts/make-config.mjs", id]);

  console.log(`\n▶ ${id}회차 영상 렌더`);
  await run("node", [
    "node_modules/@remotion/cli/remotion-cli.js",
    "render",
    "Reel",
    `out/${id}.mp4`,
    `--props=public/config/${id}.json`,
  ]);

  console.log(`\n🎬 완료: out/${id}.mp4`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
