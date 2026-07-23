#!/usr/bin/env node
// orchestrate.mjs — 필로 오케스트레이터 v0.1 (dry-run)
//
// operations/play 보드(tasks/*.yaml)를 읽어, "필로가 자동으로 돌리면
// 어떤 농부를 어떤 순서로 부를지 + 예상 전이"를 실제 호출 없이 출력한다.
//
// 정책(누가 언제 검수)은 operations/play/REVIEW-ROUTING.md, 실행은 이 파일.
// 설계: operations/ORCHESTRATION-DESIGN.md (§4 상태기계, §5 경계, §7 불변식)
//
// 사용: node scripts/orchestrate.mjs            # dry-run
//       node scripts/orchestrate.mjs --go       # (v0.2 예정) 실제 tg 호출 — 지금은 안내만
//
// v0.1은 절대 tg를 호출하지 않는다. 시뮬레이션만.

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TASKS_DIR = join(ROOT, 'operations/play/tasks');
const GO = process.argv.includes('--go');
const CLAUDE_BUILD_MAX = 3;

// 농부(자동 실행) → scripts/tg 캐릭터명.  나머지(사람/개발)는 정지.
const FARM = {
  '필로': '필로', '책쌤': '책쌤', '호기': '호기', '밭피디': '밭피디', '글쌤': '글쌤',
  '별쌤': '별쌤', '영쌤': '영쌤', '가드너': '가드너', '깐쌤': '깐쌤',
  'AI은쌤': '은쌤', 'AI 은쌤': '은쌤', '은쌤': '은쌤',
};
const isFarm = (who) => Object.prototype.hasOwnProperty.call(FARM, (who || '').trim());
const isHumanDev = (who) => /사람|claude[- ]?code|개발/i.test(who || '');

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

// 최소 필드 추출 파서 (task.yaml 스키마 한정 — 범용 YAML 아님)
function parseCard(text) {
  const lines = text.split('\n');
  const c = { required_reviewers: [], conditional_reviewers: [], blockers: [], review_verdicts: {}, human_approval: {} };
  const strip = (v) => (v ?? '').replace(/^["']|["']$/g, '').trim();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line) || !line.trim()) continue;
    let m;
    if ((m = line.match(/^(id|title|status|next_handoff|owner|producer|type|priority|student_facing|data_risk):\s*(.*)$/))) {
      c[m[1]] = strip(m[2]);
    } else if ((m = line.match(/^(required_reviewers|conditional_reviewers|blockers):\s*(.*)$/))) {
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
    }
  }
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
  if (flags.length) console.log('  ' + flags.join('  '));

  if (c.status === 'BLOCKED') {
    blocked.push(c);
    console.log(`  🚫 BLOCKED — ${c.blockers[0] || '막힘 사유 미기재'}`);
    continue;
  }
  if (isFarm(next)) {
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
  } else if (isHumanDev(next)) {
    waiting.push(c);
    console.log(`  ⏸ 정지 — 사람/개발 대기(${next}): ${c.blockers[0] || '다음 행동 대기'}`);
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

console.log('\n' + (GO
  ? '⚠ --go 실제 실행은 v0.2에서 활성화됩니다. 지금은 dry-run만 수행했습니다(안전).'
  : 'dry-run 완료 — 실제 tg 호출 없음. 실제 실행은 v0.2(--go).'));
console.log('');
