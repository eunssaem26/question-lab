#!/usr/bin/env node
/**
 * 별쌤 문항은행 자동 검증 스크립트
 * 사용법: node scripts/validate.js [--level N]
 *
 * 검증 항목:
 *  1. JSON 파싱 가능 여부
 *  2. 필수 필드 존재 여부
 *  3. ID 형식 (P-{level}-{seq}, R-{level}-{domain}-{seq})
 *  4. passage_id 참조 무결성
 *  5. 영역 코드 유효성
 *  6. 성취기준 코드 형식
 *  7. 단계(level) 범위
 *  8. 선택지 수 (4개)
 *  9. 정답 인덱스 범위
 * 10. review_status 유효값
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ── 상수 ──
const VALID_DOMAINS = ["VOC", "LIT", "INF", "CRT", "STR"];
const VALID_DOMAIN_NAMES = {
  VOC: "어휘력",
  LIT: "사실적 이해",
  INF: "추론적 이해",
  CRT: "비판적 이해",
  STR: "구조 파악",
};
const VALID_GENRES = ["설명문", "논설문", "서사문", "시", "실용문"];
const VALID_ITEM_TYPES = ["multiple_choice", "true_false", "ordering"];
const VALID_REVIEW_STATUS = ["draft", "reviewed", "approved"];
const VALID_RISK = ["low", "medium", "high"];
const VALID_SOURCE = ["AI생성", "원문발췌", "원문개작"];

const PASSAGE_ID_RE = /^P-(\d)-(\d{3})$/;
const ITEM_ID_RE = /^R-(\d)-(VOC|LIT|INF|CRT|STR)-(\d{3})$/;
const ACHIEVEMENT_RE = /^\[\d국02-\d{2}\]$/;

// ── 에러 수집 ──
const errors = [];
const warnings = [];

function error(file, id, msg) {
  errors.push(`[오류] ${file} | ${id} — ${msg}`);
}
function warn(file, id, msg) {
  warnings.push(`[주의] ${file} | ${id} — ${msg}`);
}

// ── JSON 로드 ──
function loadJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (e) {
    errors.push(`[오류] ${filePath} — JSON 파싱 실패: ${e.message}`);
    return null;
  }
}

// ── 지문 검증 ──
const PASSAGE_REQUIRED = [
  "passage_id",
  "level",
  "text",
  "genre",
  "char_count",
  "source",
  "topic",
  "intended_domains",
  "background_knowledge_risk",
  "review_status",
];

function validatePassage(p, file) {
  const id = p.passage_id || "(ID 없음)";

  // 필수 필드
  for (const f of PASSAGE_REQUIRED) {
    if (p[f] === undefined || p[f] === null) {
      error(file, id, `필수 필드 '${f}' 누락`);
    }
  }

  // ID 형식
  if (p.passage_id && !PASSAGE_ID_RE.test(p.passage_id)) {
    error(file, id, `ID 형식 오류 — 'P-{단계}-{번호}' 형식이어야 합니다`);
  }

  // ID 내 단계와 level 필드 일치
  if (p.passage_id && p.level) {
    const match = p.passage_id.match(PASSAGE_ID_RE);
    if (match && Number(match[1]) !== p.level) {
      error(file, id, `ID 내 단계(${match[1]})와 level(${p.level}) 불일치`);
    }
  }

  // level 범위
  if (p.level !== undefined && (p.level < 1 || p.level > 7)) {
    error(file, id, `level 범위 초과: ${p.level} (1~7)`);
  }

  // genre
  if (p.genre && !VALID_GENRES.includes(p.genre)) {
    error(file, id, `유효하지 않은 genre: '${p.genre}'`);
  }

  // source
  if (p.source && !VALID_SOURCE.includes(p.source)) {
    error(file, id, `유효하지 않은 source: '${p.source}'`);
  }

  // intended_domains
  if (Array.isArray(p.intended_domains)) {
    for (const d of p.intended_domains) {
      if (!VALID_DOMAINS.includes(d)) {
        error(file, id, `intended_domains에 유효하지 않은 영역 코드: '${d}'`);
      }
    }
  }

  // background_knowledge_risk
  if (p.background_knowledge_risk && !VALID_RISK.includes(p.background_knowledge_risk)) {
    error(file, id, `유효하지 않은 background_knowledge_risk: '${p.background_knowledge_risk}'`);
  }

  // review_status
  if (p.review_status && !VALID_REVIEW_STATUS.includes(p.review_status)) {
    error(file, id, `유효하지 않은 review_status: '${p.review_status}'`);
  }

  // char_count 정확성
  if (p.text && p.char_count) {
    const actual = p.text.replace(/\n/g, "").length;
    if (Math.abs(actual - p.char_count) > 5) {
      warn(file, id, `char_count(${p.char_count})와 실제 글자 수(${actual}) 차이 > 5`);
    }
  }

  return id;
}

// ── 문항 검증 ──
const ITEM_REQUIRED = [
  "item_id",
  "level",
  "domain",
  "domain_code",
  "primary_domain",
  "achievement_standard",
  "level_differentiation",
  "item_type",
  "question_text",
  "choices",
  "answer",
  "explanation",
  "review_status",
  "is_warmup",
];

function validateItem(item, file, passageIds) {
  const id = item.item_id || "(ID 없음)";

  // 필수 필드 (passage_id와 passage_genre는 null 허용)
  for (const f of ITEM_REQUIRED) {
    if (item[f] === undefined) {
      error(file, id, `필수 필드 '${f}' 누락`);
    }
  }

  // ID 형식
  if (item.item_id && !ITEM_ID_RE.test(item.item_id)) {
    error(file, id, `ID 형식 오류 — 'R-{단계}-{영역코드}-{번호}' 형식이어야 합니다`);
  }

  // ID 내 단계/영역과 필드 일치
  if (item.item_id) {
    const match = item.item_id.match(ITEM_ID_RE);
    if (match) {
      if (Number(match[1]) !== item.level) {
        error(file, id, `ID 내 단계(${match[1]})와 level(${item.level}) 불일치`);
      }
      if (match[2] !== item.domain_code) {
        error(file, id, `ID 내 영역(${match[2]})와 domain_code(${item.domain_code}) 불일치`);
      }
    }
  }

  // level 범위
  if (item.level !== undefined && (item.level < 1 || item.level > 7)) {
    error(file, id, `level 범위 초과: ${item.level}`);
  }

  // domain_code 유효성
  if (item.domain_code && !VALID_DOMAINS.includes(item.domain_code)) {
    error(file, id, `유효하지 않은 domain_code: '${item.domain_code}'`);
  }

  // primary_domain 유효성
  if (item.primary_domain && !VALID_DOMAINS.includes(item.primary_domain)) {
    error(file, id, `유효하지 않은 primary_domain: '${item.primary_domain}'`);
  }

  // domain과 domain_code 매칭
  if (item.domain && item.domain_code && VALID_DOMAIN_NAMES[item.domain_code] !== item.domain) {
    error(file, id, `domain('${item.domain}')과 domain_code('${item.domain_code}') 불일치`);
  }

  // 성취기준 형식
  if (item.achievement_standard && !ACHIEVEMENT_RE.test(item.achievement_standard)) {
    error(file, id, `성취기준 형식 오류: '${item.achievement_standard}'`);
  }

  // item_type
  if (item.item_type && !VALID_ITEM_TYPES.includes(item.item_type)) {
    error(file, id, `유효하지 않은 item_type: '${item.item_type}'`);
  }

  // 선택지 수
  if (Array.isArray(item.choices)) {
    if (item.item_type === "multiple_choice" && item.choices.length !== 4) {
      error(file, id, `선택형 문항의 선택지가 ${item.choices.length}개 (4개 필요)`);
    }
  }

  // 정답 인덱스 범위
  if (item.item_type === "multiple_choice" && typeof item.answer === "number") {
    if (item.answer < 0 || item.answer >= (item.choices?.length || 4)) {
      error(file, id, `정답 인덱스 범위 초과: ${item.answer}`);
    }
  }

  // passage_id 참조 무결성
  if (item.passage_id !== null && item.passage_id !== undefined) {
    if (!passageIds.has(item.passage_id)) {
      error(file, id, `passage_id '${item.passage_id}'가 지문 데이터에 존재하지 않음`);
    }
  }

  // 독립형 문항이면 passage_genre도 null이어야
  if (item.passage_id === null && item.passage_genre !== null && item.passage_genre !== undefined) {
    warn(file, id, `passage_id가 null인데 passage_genre가 설정됨: '${item.passage_genre}'`);
  }

  // review_status
  if (item.review_status && !VALID_REVIEW_STATUS.includes(item.review_status)) {
    error(file, id, `유효하지 않은 review_status: '${item.review_status}'`);
  }

  return id;
}

// ── 중복 ID 검사 ──
function checkDuplicates(ids, label) {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      error(label, id, "중복 ID 발견");
    }
    seen.add(id);
  }
}

// ── 메인 ──
function main() {
  const args = process.argv.slice(2);
  const levelFilter = args.includes("--level") ? Number(args[args.indexOf("--level") + 1]) : null;

  console.log("═══════════════════════════════════════════");
  console.log("  별쌤 문항은행 자동 검증");
  console.log("═══════════════════════════════════════════\n");

  // 지문 파일 수집
  const passageFiles = [];
  const mainPassages = path.join(ROOT, "item-bank", "passages.json");
  if (fs.existsSync(mainPassages)) passageFiles.push(mainPassages);

  // level별 폴더
  for (let l = 1; l <= 7; l++) {
    const lp = path.join(ROOT, "item-bank", `level-${l}`, "passages.json");
    if (fs.existsSync(lp)) passageFiles.push(lp);
  }

  // 문항 파일 수집
  const itemFiles = [];
  const mainItems = path.join(ROOT, "item-bank", "items.json");
  if (fs.existsSync(mainItems)) itemFiles.push(mainItems);

  for (let l = 1; l <= 7; l++) {
    const lp = path.join(ROOT, "item-bank", `level-${l}`, "items.json");
    if (fs.existsSync(lp)) itemFiles.push(lp);
  }

  // 지문 검증
  const allPassageIds = new Set();
  const allPassageIdList = [];

  for (const file of passageFiles) {
    const rel = path.relative(ROOT, file);
    const data = loadJSON(file);
    if (!data) continue;

    console.log(`지문 검증: ${rel} (${data.length}건)`);
    for (const p of data) {
      if (levelFilter && p.level !== levelFilter) continue;
      const pid = validatePassage(p, rel);
      allPassageIds.add(pid);
      allPassageIdList.push(pid);
    }
  }

  checkDuplicates(allPassageIdList, "지문");

  // 문항 검증
  const allItemIdList = [];

  for (const file of itemFiles) {
    const rel = path.relative(ROOT, file);
    const data = loadJSON(file);
    if (!data) continue;

    console.log(`문항 검증: ${rel} (${data.length}건)`);
    for (const item of data) {
      if (levelFilter && item.level !== levelFilter) continue;
      const iid = validateItem(item, rel, allPassageIds);
      allItemIdList.push(iid);
    }
  }

  checkDuplicates(allItemIdList, "문항");

  // 통계
  console.log("\n───────────────────────────────────────────");
  console.log("  검증 결과 요약");
  console.log("───────────────────────────────────────────");

  const passageCount = allPassageIdList.length;
  const itemCount = allItemIdList.length;

  // 영역별 문항 수
  const domainCounts = {};
  for (const file of itemFiles) {
    const data = loadJSON(file);
    if (!data) continue;
    for (const item of data) {
      if (levelFilter && item.level !== levelFilter) continue;
      const dc = item.domain_code || "?";
      domainCounts[dc] = (domainCounts[dc] || 0) + 1;
    }
  }

  console.log(`\n지문: ${passageCount}건 | 문항: ${itemCount}건`);
  if (Object.keys(domainCounts).length > 0) {
    console.log("영역별 문항 수:");
    for (const d of VALID_DOMAINS) {
      console.log(`  ${d}: ${domainCounts[d] || 0}건`);
    }
  }

  // 오류/주의 출력
  if (errors.length > 0) {
    console.log(`\n오류: ${errors.length}건`);
    for (const e of errors) console.log(`  ${e}`);
  }

  if (warnings.length > 0) {
    console.log(`\n주의: ${warnings.length}건`);
    for (const w of warnings) console.log(`  ${w}`);
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log("\n모든 검증 통과!");
  }

  console.log("───────────────────────────────────────────\n");

  process.exit(errors.length > 0 ? 1 : 0);
}

main();
