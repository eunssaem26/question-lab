#!/usr/bin/env node
// 다음 호 폴더를 자동으로 만들어 주는 스캐폴더
// 사용법:  node new-issue.mjs <Vol번호> <연도> <월>
//   예:    node new-issue.mjs 2 2026 9   →  issues/02-2026-09/ 생성
//
// 규칙: 폴더는 "NN-YYYY-MM" (번호가 앞에 와서 항상 순서대로 정렬됨)
//       라벨은 "YYYY년 M월 · Vol.N", 사진은 각 호의 사진/ 폴더에 넣음

import fs from "node:fs";
import path from "node:path";

const [, , volArg, yearArg, monthArg] = process.argv;
if (!volArg || !yearArg || !monthArg) {
  console.error("사용법: node new-issue.mjs <Vol번호> <연도> <월>\n  예: node new-issue.mjs 2 2026 9");
  process.exit(1);
}
const vol = String(parseInt(volArg, 10));
const volPad = vol.padStart(2, "0");
const year = String(parseInt(yearArg, 10));
const month = String(parseInt(monthArg, 10));
const monthPad = month.padStart(2, "0");

const issuesDir = path.resolve("issues");
const rel = `${volPad}-${year}-${monthPad}`;
const dir = path.join(issuesDir, rel);
if (fs.existsSync(dir)) {
  console.error(`이미 있는 폴더예요: issues/${rel}`);
  process.exit(1);
}
fs.mkdirSync(path.join(dir, "사진"), { recursive: true });

// 가장 최근 호에서 푸터 링크를 물려받아 반복 입력을 줄임
let footerLinks = [];
try {
  const prev = fs
    .readdirSync(issuesDir)
    .filter((n) => fs.existsSync(path.join(issuesDir, n, "content.json")))
    .sort();
  if (prev.length) {
    const base = JSON.parse(fs.readFileSync(path.join(issuesDir, prev[prev.length - 1], "content.json"), "utf8"));
    footerLinks = base.footerLinks || [];
  }
} catch {}

const content = {
  meta: {
    brand: "은혜있는 뉴스레터",
    studio: "생각하는 글밭",
    tagline: "Where Thoughts Grow",
    issueLabel: `${year}년 ${month}월`,
    issueNo: `Vol.${vol}`,
    author: "이재은 드림",
    photosDir: "사진",
  },
  sections: [
    {
      kicker: "여는 글 · Greetings",
      title: "샬롬!",
      items: [{ t: "p", text: "(여기에 인사말을 적어 주세요.)" }],
    },
  ],
  footerLinks,
};

fs.writeFileSync(path.join(dir, "content.json"), JSON.stringify(content, null, 2) + "\n");

console.log(`✓ 새 호 폴더를 만들었어요: issues/${rel}/`);
console.log(`  1) 사진을 issues/${rel}/사진/ 에 넣기`);
console.log(`  2) issues/${rel}/content.json 에 글·사진·링크 채우기`);
console.log(`  3) node build.mjs issues/${rel}`);
