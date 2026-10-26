#!/usr/bin/env node
// orchestrate.mjs — 필로 오케스트레이터 v0.2 (품질 게이트 v2)
//
// operations/play 보드(tasks/*.yaml)를 읽어, "필로가 자동으로 돌리면
// 어떤 농부를 어떤 순서로 부를지 + 예상 전이"를 실제 호출 없이 출력한다.
//
// 정책(누가 언제 검수)은 operations/play/REVIEW-ROUTING.md, 실행은 이 파일.
// 설계: operations/ORCHESTRATION-DESIGN.md (§4 상태기계, §5 경계, §7 불변식)
//
// 사용: node scripts/orchestrate.mjs            # dry-run
//       node scripts/orchestrate.mjs --go       # 승인·기술 게이트를 제외한 농부 검수 단계 실행
//
// 기본은 dry-run. --go도 제작·기술검수·사람 승인·배포는 실행하지 않는다.

import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_DIR = join(ROOT, 'operations/play/tasks');
const GO = process.argv.includes('--go');
const CLAUDE_BUILD_MAX = 3;
const AUTO_STAGES = new Set(['DOMAIN_REVIEW', 'MERGE', 'ADVERSARIAL_QA', 'RELEASE_GATE']);
const POST_PLAN = new Set(['READY', 'CLAUDE_BUILD', 'AUTO_VERIFIED', 'CODE_REVIEW', 'DOMAIN_REVIEW', 'MERGE', 'ADVERSARIAL_QA', 'RELEASE_GATE', 'HUMAN_APPROVAL', 'RELEASED', 'DONE']);
const POST_CODE_REVIEW = new Set(['DOMAIN_REVIEW', 'MERGE', 'ADVERSARIAL_QA', 'RELEASE_GATE', 'HUMAN_APPROVAL', 'RELEASED', 'DONE']);
const POST_ADVERSARIAL_QA = new Set(['RELEASE_GATE', 'HUMAN_APPROVAL', 'RELEASED', 'DONE']);

// 농부(자동 실행) → scripts/tg 캐릭터명.  나머지(사람/개발)는 정지.
const FARM = {
  '필로': '필로', '책쌤': '책쌤', '호기': '호기', '밭피디': '밭피디', '글쌤': '글쌤',
  '별쌤': '별쌤', '영쌤': '영쌤', '가드너': '가드너', '깐쌤': '깐쌤',
  'AI은쌤': '은쌤', 'AI 은쌤': '은쌤', '은쌤': '은쌤',
};
const isFarm = (who) => Object.prototype.hasOwnProperty.call(FARM, (who || '').trim());
const isHumanDev = (who) => /사람|claude[- ]?code|개발/i.test(who || '');
const isTechnicalGate = (who) => /Hermes 기술검수|기술검수/i.test(who || '');

const DOMAIN_REVIEWERS = ['책쌤', '호기', '밭피디', '글쌤', '별쌤', '영쌤', '가드너'];

// 상태기계(§4) 기반 다음 단계 예측 — 농부 역할로 분기를 보여준다.
function predictAfter(agent) {
  const a = (agent || '').trim();
  if (DOMAIN_REVIEWERS.includes(a))
    return '검수 완료 → (남은 필수 검수자 병렬) → 필로 병합(MERGE)';
  if (a === '필로') return 'CRITICAL 없으면 → 깐쌤(RED_TEAM), 있으면 → RETURNED(제작자)';
  if (a === '깐쌤') return 'CRITICAL 없으면 → AI 은쌤(GATE), 있으면 → RETURNED(제작자)';
  if (FARM[a] === '은쌤') return '판정=통과 → AWAIT_HUMAN(사람 은쌤 승인), 반려/수정후통과 → RETURNED';
  return '(예측 규칙 없음)';
}

function workflowViolations(c) {
  const v = [];
  if (c.workflow_version !== '2') v.push('workflow_version=2 누락');
  if (POST_PLAN.has(c.status) && c.plan_approval?.status !== 'APPROVED')
    v.push('계획 승인 증거 없이 실행 이후 상태');
  if (POST_CODE_REVIEW.has(c.status) && !['PASSED', 'NOT_APPLICABLE'].includes(c.code_review?.status))
    v.push('코드 리뷰 PASS 없이 도메인/QA 단계');
  if (POST_ADVERSARIAL_QA.has(c.status) && c.adversarial_qa?.status !== 'PASSED')
    v.push('적대적 QA PASS 없이 발행 단계');
  if (['CLAUDE_BUILD', 'AUTO_VERIFIED', 'CODE_REVIEW', 'DOMAIN_REVIEW', 'MERGE', 'ADVERSARIAL_QA', 'RELEASE_GATE', 'HUMAN_APPROVAL', 'RELEASED', 'DONE'].includes(c.status) && c.checkpoint_count < 1)
    v.push('실행 이후 상태인데 durable checkpoint 없음');
  if (['RELEASED', 'DONE'].includes(c.status) && c.human_approval?.production !== 'true')
    v.push('사람 프로덕션 승인 없이 RELEASED/DONE');
  return v;
}

// 검수용 입력 조립 (카드 → 농부에게 전달할 프롬프트)
function buildReviewInput(c, reviewer) {
  const L = [];
  L.push(`[검수 요청]`);
  L.push(`아래 작업 결과물을 '${reviewer}'로서 네 SOUL의 검수 관점에서 검수하라.`);
  L.push(`각 지적은: ID(역할약칭-C/W/S+번호) · 위치 · 문제 · 근거 · 영향 · 수정 방향. 심각도는 CRITICAL / WARNING / SUGGESTION.`);
  L.push(`직접 확인하지 못한 것(실제 문구·모바일 화면·원문 등)은 지어내지 말고 "확인 필요"로 명시하라.`);
  L.push('');
  L.push(`[작업 카드 ${c.id}] ${c.title}`);
  if (c.why) L.push(`- 교육 목적: ${c.why}`);
  if (c.scope.length) L.push(`- 범위:\n${c.scope.map((s) => '  · ' + s).join('\n')}`);
  if (c.acceptance.length) L.push(`- 완료 조건:\n${c.acceptance.map((s) => '  · ' + s).join('\n')}`);
  if (c.claude.result_commit) L.push(`- 결과 커밋: ${c.claude.result_commit}${c.claude.preview_url ? ' / 프리뷰: ' + c.claude.preview_url : ''}`);
  if (c.blockers.length) L.push(`- 현재 막힘: ${c.blockers.join('; ')}`);
  return L.join('\n');
}

// 카드 yaml 자동 전이 (백업 + 라인 단위 안전 편집만 — 블록 삭제 없음)
function applyCardTransition(cardPath, raw, { reviewer, verdictLine, newStatus, newNext, blockerLine, handoffRel, gateKey, gateStatus }) {
  writeFileSync(cardPath + '.bak', raw); // 편집 전 백업 (operations/는 git 밖)
  let t = raw;
  t = t.replace(/^status: .*$/m, `status: ${newStatus}`);
  t = t.replace(/^next_handoff: .*$/m, `next_handoff: "${newNext}"`);
  if (/^review_verdicts:\s*\{\}\s*$/m.test(t))
    t = t.replace(/^review_verdicts:\s*\{\}\s*$/m, `review_verdicts:\n  ${reviewer}: "${verdictLine}"`);
  else if (!new RegExp(`^\\s+${reviewer}:`, 'm').test(t))
    t = t.replace(/^review_verdicts:\s*$/m, `review_verdicts:\n  ${reviewer}: "${verdictLine}"`);
  if (blockerLine) t = t.replace(/^blockers:.*$/m, `blockers:\n  - "${blockerLine}"`);
  t = t.replace(/^evidence:\s*$/m, `evidence:\n  - "${handoffRel}"`);
  if (gateKey) {
    t = t.replace(new RegExp(`(${gateKey}:\\n\\s+status:)\\s*\\S+`), `$1 ${gateStatus}`);
    t = t.replace(new RegExp(`(${gateKey}:[\\s\\S]*?\\n\\s+evidence:)\\s*\\[\\]`), `$1\n    - "${handoffRel}"`);
  }
  const phase = reviewer === '깐쌤' ? 'ADVERSARIAL_QA' : (FARM[reviewer] === '은쌤' ? 'RELEASE_GATE' : 'DOMAIN_REVIEW');
  const cp = [
    `  - phase: ${phase}`,
    `    status: ${newStatus === 'RETURNED' ? 'RETURN' : 'PASS'}`,
    `    at: "${new Date().toISOString()}"`,
    `    actor: "${reviewer}"`,
    `    git_sha: ""`,
    `    evidence:`,
    `      - "${handoffRel}"`,
    `    next_handoff: "${newNext}"`,
  ].join('\n');
  if (/^checkpoints:\s*\[\]\s*$/m.test(t)) t = t.replace(/^checkpoints:\s*\[\]\s*$/m, `checkpoints:\n${cp}`);
  else t = t.replace(/^next_handoff:/m, `${cp}\nnext_handoff:`);
  writeFileSync(cardPath, t);
}

// BOARD.md 해당 행의 상태·다음행동·다음담당·막힘 셀만 갱신
function updateBoardRow(id, { status, action, next, blocker }) {
  const bp = join(ROOT, 'operations/play/BOARD.md');
  const raw = readFileSync(bp, 'utf8');
  writeFileSync(bp + '.bak', raw);
  const out = raw.split('\n').map((ln) => {
    if (!ln.includes(id) || !ln.trim().startsWith('|')) return ln;
    const cells = ln.split('|'); // ['', ID, 작업, 우선, 상태(4), 책임자, 제작자, 다음행동(7), 다음담당(8), 막힘(9), '']
    if (cells.length < 10) return ln;
    cells[4] = ` ${status} `; cells[7] = ` ${action} `; cells[8] = ` ${next} `; cells[9] = ` ${blocker} `;
    return cells.join('|');
  });
  writeFileSync(bp, out.join('\n'));
}

// 최소 필드 추출 파서 (task.yaml 스키마 한정 — 범용 YAML 아님)
function parseCard(text) {
  const lines = text.split('\n');
  const c = { required_reviewers: [], conditional_reviewers: [], blockers: [], scope: [], acceptance: [], review_verdicts: {}, human_approval: {}, plan_approval: {}, code_review: {}, adversarial_qa: {}, claude: {}, checkpoint_count: 0 };
  const strip = (v) => (v ?? '').replace(/^["']|["']$/g, '').trim();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line) || !line.trim()) continue;
    let m;
    if ((m = line.match(/^(id|title|why|status|next_handoff|owner|producer|type|priority|workflow_version|student_facing|data_risk):\s*(.*)$/))) {
      c[m[1]] = strip(m[2]);
    } else if (/^claude:\s*$/.test(line)) {
      while (i + 1 < lines.length && /^\s+\w+:/.test(lines[i + 1])) {
        const km = lines[++i].match(/^\s+(\w+):\s*(.*)$/); if (km) c.claude[km[1]] = strip(km[2]);
      }
    } else if ((m = line.match(/^(required_reviewers|conditional_reviewers|blockers|scope|acceptance):\s*(.*)$/))) {
      const key = m[1];
      if (m[2].trim() && m[2].trim() !== '[]') { c[key].push(strip(m[2])); continue; }
      while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) c[key].push(strip(lines[++i].replace(/^\s+-\s+/, '')));
    } else if (/^review_verdicts:\s*(.*)$/.test(line)) {
      const rest = line.replace(/^review_verdicts:\s*/, '').trim();
      if (rest && rest !== '{}') continue;
      while (i + 1 < lines.length && /^\s+\S+:/.test(lines[i + 1]) && !/^\s+-/.test(lines[i + 1])) {
        const vm = lines[++i].match(/^\s+(\S+):\s*(.*)$/); if (vm) c.review_verdicts[vm[1]] = strip(vm[2]);
      }
    } else if (/^human_approval:\s*$/.test(line)) {
      while (i + 1 < lines.length && /^\s+\w+:/.test(lines[i + 1])) {
        const hm = lines[++i].match(/^\s+(\w+):\s*(.*)$/); if (hm) c.human_approval[hm[1]] = strip(hm[2]);
      }
    } else if ((m = line.match(/^(plan_approval|code_review|adversarial_qa):\s*$/))) {
      const key = m[1];
      while (i + 1 < lines.length && /^\s+\w+:/.test(lines[i + 1])) {
        const gm = lines[++i].match(/^\s+(\w+):\s*(.*)$/); if (gm) c[key][gm[1]] = strip(gm[2]);
      }
    }
  }
  c.checkpoint_count = (text.match(/^\s+- phase:/gm) || []).length;
  return c;
}

// ---- 로드 ----
const files = readdirSync(TASKS_DIR).filter((f) => f.endsWith('.yaml'));
const cards = files.map((f) => parseCard(readFileSync(join(TASKS_DIR, f), 'utf8'))).filter((c) => c.id);
cards.sort((a, b) => (a.priority || '').localeCompare(b.priority || '') || (a.id || '').localeCompare(b.id || ''));

// ---- 분석 ----
const auto = [], waiting = [], blocked = [];
const buildCount = cards.filter((c) => /BUILD|IN_PROGRESS/i.test(c.status)).length;

console.log('\n🌿 필로 오케스트레이터 — dry-run (실제 호출 없음)');
console.log(`   보드: operations/play · 카드 ${cards.length}개 · CLAUDE_BUILD ${buildCount}/${CLAUDE_BUILD_MAX}\n`);
console.log('─'.repeat(64));

for (const c of cards) {
  const next = c.next_handoff || c.owner || '';
  const risk = c.data_risk && c.data_risk !== 'none' ? ` · 위험:${c.data_risk}` : '';
  const sf = c.student_facing === 'true' ? ' · 학생대면' : '';
  console.log(`\n[${c.id}] ${c.title}`);
  console.log(`  상태: ${c.status} · ${c.type || '?'}${risk}${sf}  |  다음 담당: ${next}`);

  // 불변식 체크(§7) — 라우팅(required_reviewers)은 신뢰하고, 구조적 게이트만 강제
  const flags = [];
  const TEXTY = ['content', 'new-game', 'game-improvement'];
  if (c.student_facing === 'true' && TEXTY.includes(c.type) && !c.required_reviewers.includes('호기'))
    flags.push('⚠ 학생 문구성 카드인데 필수 검수자에 호기 없음');
  if (c.human_approval?.production === 'true')
    flags.push('🔒 배포=사람 승인 필요(production gate)');
  const violations = workflowViolations(c);
  if (violations.length) flags.push(...violations.map((x) => `⛔ ${x}`));
  if (flags.length) console.log('  ' + flags.join('  '));

  if (c.status === 'BLOCKED') {
    blocked.push(c);
    console.log(`  🚫 BLOCKED — ${c.blockers[0] || '막힘 사유 미기재'}`);
    continue;
  }
  if (AUTO_STAGES.has(c.status) && isFarm(next) && violations.length === 0) {
    auto.push(c);
    // 도메인 검수(병렬·독립) vs 게이트(순차 깐쌤→은쌤) 구분
    const pendingDomain = c.required_reviewers.filter((r) => DOMAIN_REVIEWERS.includes(r) && !c.review_verdicts[r]);
    const gateStages = c.required_reviewers.filter((r) => r === '깐쌤' || FARM[r] === '은쌤');
    console.log(`  ▶ 자동 실행 예정: scripts/tg ${FARM[next.trim()]}  — "${c.title}" 검수`);
    if (pendingDomain.length > 1)
      console.log(`     도메인 검수 병렬(독립): ${pendingDomain.join(', ')}`);
    if (gateStages.length)
      console.log(`     이후 게이트(순차): ${gateStages.map((g) => (g === '깐쌤' ? '깐쌤(레드팀)' : 'AI 은쌤(발행)')).join(' → ')} → 사람 은쌤`);
    console.log(`     예상 전이: ${predictAfter(next)}`);
  } else if (isHumanDev(next) || isTechnicalGate(next) || ['PLAN_DRAFT', 'PLAN_REVIEW', 'PLAN_APPROVAL', 'READY', 'CLAUDE_BUILD', 'AUTO_VERIFIED', 'CODE_REVIEW', 'HUMAN_APPROVAL'].includes(c.status)) {
    waiting.push(c);
    const reason = violations[0] || c.blockers[0] || '별도 게이트/다음 행동 대기';
    console.log(`  ⏸ 정지 — 사람/개발/기술게이트 대기(${next}): ${reason}`);
  } else {
    console.log(`  ? 다음 담당 분류 불가: "${next}"`);
  }
}

// ---- 요약 ----
console.log('\n' + '─'.repeat(64));
console.log('\n📋 요약');
console.log(`  ▶ 자동 실행 가능(농부): ${auto.length}건 — ${auto.map((c) => c.id.replace('PLAY-20260721-', '#')).join(', ') || '없음'}`);
console.log(`  ⏸ 사람/개발 대기:       ${waiting.length}건 — ${waiting.map((c) => c.id.replace('PLAY-20260721-', '#')).join(', ') || '없음'}`);
console.log(`  🚫 BLOCKED:              ${blocked.length}건 — ${blocked.map((c) => c.id.replace('PLAY-20260721-', '#')).join(', ') || '없음'}`);
if (buildCount > CLAUDE_BUILD_MAX) console.log(`  ⚠ CLAUDE_BUILD ${buildCount} > ${CLAUDE_BUILD_MAX} — 새 제작 착수 금지, BLOCKED·RETURNED 먼저`);

// ---- 실제 실행 (--go) ----
if (GO && auto.length) {
  console.log('\n' + '━'.repeat(64));
  console.log(`\n🚜 --go 실제 실행 — 농부 검수 ${auto.length}건 (scripts/tg 호출)`);
  console.log('   (제작·기술검수·사람 승인·배포는 실행하지 않음. 농부 결과만 카드+BOARD+체크포인트에 기록.)\n');
  const TG = join(ROOT, 'scripts/tg');
  for (const c of auto) {
    const who = (c.next_handoff || '').trim();
    const reviewer = FARM[who];
    const input = buildReviewInput(c, who);
    console.log(`▶ [${c.id}] scripts/tg ${reviewer} — 실행 중… (Hermes 응답 대기, 최대 4분)`);
    let out;
    try {
      out = execFileSync(TG, [reviewer, input], { cwd: ROOT, encoding: 'utf8', timeout: 240000, maxBuffer: 16 * 1024 * 1024 });
    } catch (e) {
      console.log(`  ✖ 실행 실패: ${String(e.message).split('\n')[0]}\n`);
      continue;
    }
    const dir = join(TASKS_DIR, c.id);
    mkdirSync(dir, { recursive: true });
    const n = readdirSync(dir).filter((f) => /^\d\d_/.test(f)).length + 1;
    const hp = join(dir, `${String(n).padStart(2, '0')}_${who}.md`);
    writeFileSync(hp, `# ${who} 검수 — ${c.id}\n\n${out}\n`);
    const crit = (out.match(/CRITICAL/g) || []).length;
    const warn = (out.match(/WARNING/g) || []).length;
    const handoffRel = hp.replace(ROOT + '/', '');
    const short = handoffRel.replace('operations/play/', '');
    const pendingDomain = c.required_reviewers.filter((r) => DOMAIN_REVIEWERS.includes(r) && !c.review_verdicts[r] && r !== who);
    console.log('\n' + out.trim() + '\n');
    console.log(`  💾 핸드오프 저장: ${handoffRel}  (심각도 감지: CRITICAL ${crit}, WARNING ${warn})`);

    // 전이 결정 (§4 상태기계 + 불변식 §7-2: CRITICAL 잔존 → 제작자 반송)
    let tr;
    const rejectedGate = /판정\s*[:：]\s*(반려|수정후통과)/.test(out);
    if (crit > 0 || rejectedGate) {
      tr = { newStatus: 'RETURNED', newNext: 'Claude Code', boardNext: 'Claude Code',
        verdictLine: `RETURNED (${crit} CRITICAL, ${warn} WARNING) — ${short}`,
        blockerLine: `${who} RETURN: ${crit} CRITICAL — ${short}`,
        boardAction: '검수 결함 수정 후 재검수', boardBlocker: `${who} RETURN: ${crit} CRITICAL`,
        gateKey: who === '깐쌤' ? 'adversarial_qa' : null, gateStatus: 'RETURNED' };
    } else if (DOMAIN_REVIEWERS.includes(who) && pendingDomain.length) {
      tr = { newStatus: c.status, newNext: pendingDomain[0], boardNext: pendingDomain[0],
        verdictLine: `PASS (${warn} WARNING) — ${short}`, blockerLine: null,
        boardAction: `${pendingDomain[0]} 도메인 검수`, boardBlocker: '없음' };
    } else if (DOMAIN_REVIEWERS.includes(who)) {
      tr = { newStatus: 'MERGE', newNext: '필로', boardNext: '필로',
        verdictLine: `PASS (${warn} WARNING) — ${short}`, blockerLine: null,
        boardAction: '필로 병합 → 깐쌤', boardBlocker: '없음' };
    } else if (who === '필로') {
      tr = { newStatus: 'ADVERSARIAL_QA', newNext: '깐쌤', boardNext: '깐쌤',
        verdictLine: `PASS (${warn} WARNING) — ${short}`, blockerLine: null,
        boardAction: '깐쌤 적대적 QA', boardBlocker: '없음' };
    } else if (who === '깐쌤') {
      tr = { newStatus: 'RELEASE_GATE', newNext: 'AI 은쌤', boardNext: 'AI 은쌤',
        verdictLine: `PASS (${warn} WARNING) — ${short}`, blockerLine: null,
        boardAction: 'AI 은쌤 발행 게이트', boardBlocker: '없음',
        gateKey: 'adversarial_qa', gateStatus: 'PASSED' };
    } else {
      tr = { newStatus: 'HUMAN_APPROVAL', newNext: '사람 은쌤', boardNext: '사람 은쌤',
        verdictLine: `PASS (${warn} WARNING) — ${short}`, blockerLine: null,
        boardAction: '사람 은쌤 최종 승인', boardBlocker: '프로덕션 승인 필요' };
    }
    const cardPath = join(TASKS_DIR, c.id + '.yaml');
    applyCardTransition(cardPath, readFileSync(cardPath, 'utf8'), { reviewer: who, ...tr, handoffRel });
    updateBoardRow(c.id, { status: tr.newStatus, action: tr.boardAction, next: tr.boardNext, blocker: tr.boardBlocker });
    console.log(`  ✅ 자동 전이: ${c.status} → ${tr.newStatus} · 다음 담당 → ${tr.newNext}  (카드+BOARD 갱신, .bak 백업)`);
  }
  console.log('');
} else {
  console.log('\n' + (GO ? 'dry-run만 수행(실행할 농부 단계 없음).' : 'dry-run 완료 — 실제 tg 호출 없음. 실제 실행은 --go.'));
  console.log('');
}
