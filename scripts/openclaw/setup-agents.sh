#!/usr/bin/env bash
# 생각하는 글밭 농부 10명을 OpenClaw 에이전트로 설치한다.
# - SOUL.md 원본은 저장소 souls/*.SOUL.md. OpenClaw는 심볼릭 링크를 거부하므로 sync-souls.sh로 복사·동기화한다
# - 메모리는 AKM 포인터만 둔다 (본체 복제 금지)
# - 재실행해도 안전하다 (워크스페이스 파일·에이전트 등록은 있으면 건너뜀)
set -euo pipefail

# 워크스페이스 파일은 에이전트가 운영 중에 고친다 (Slack ID, 규칙 등) — 없을 때만 만든다
write_if_absent() {
  if [ -e "$1" ]; then cat >/dev/null; else cat > "$1"; fi
}

GB="/Users/eunssaem/Desktop/open claw 준비"
WS_ROOT="$HOME/.openclaw/workspaces"
AGENT_ROOT="$HOME/.openclaw/agents"

# id | 한글 | SOUL 파일 | 역할 | 생물 | 이모지
CAST=(
  "philo|필로|필로|코디네이터 · 블로그|회청색 토끼|🐰"
  "byeolsaem|별쌤|별쌤|진단평가|별자리를 읽는 올빼미|⭐"
  "chaeksaem|책쌤|책쌤|독서수업|숲의 사서|📚"
  "geulsaem|글쌤|글쌤|글쓰기수업|씨앗을 글로 키우는 농부|✍️"
  "eunsaem|은쌤|은쌤|발행 게이트 · 검수|숲지기|🛡️"
  "kkansaem|깐쌤|깐쌤|레드팀 · 품질비평|빨간 펜 든 까마귀|🔍"
  "hogi|호기|호기|학생 소통|탐험가|🧭"
  "yeongsaem|영쌤|영쌤|영어 학습설계|파랑새|🐦"
  "batpd|밭피디|밭피디|콘텐츠 디렉터 · 유튜브|수달|🎬"
  "gardener|가드너|가드너|지식 아키텍트|거북|🐢"
)

mkdir -p "$WS_ROOT"

for row in "${CAST[@]}"; do
  IFS='|' read -r id ko soul role creature emoji <<<"$row"
  ws="$WS_ROOT/$id"
  mkdir -p "$ws/memory" "$ws/avatars"

  # SOUL: 원본은 souls/, 워크스페이스엔 복사본 (OpenClaw가 심볼릭 링크를 거부함) — 아래 sync-souls.sh가 채운다

  # 아바타
  [ -f "$GB/office/assets/avatars/$id.png" ] && cp -n "$GB/office/assets/avatars/$id.png" "$ws/avatars/$id.png" || true

  write_if_absent "$ws/IDENTITY.md" <<ID
# IDENTITY.md

- **Name:** $ko
- **Creature:** $creature
- **Vibe:** $role — 생각하는 글밭의 농부. 세부 성격과 규칙은 SOUL.md.
- **Emoji:** $emoji
- **Avatar:** avatars/$id.png
ID

  write_if_absent "$ws/AGENTS.md" <<AG
# AGENTS.md — $ko 작업공간 규칙

성격·역할·경계는 \`SOUL.md\`에 있다 (원본은 저장소 \`souls/$soul.SOUL.md\`, 여기 파일은 \`scripts/openclaw/sync-souls.sh\`가 만든 복사본 — 직접 고치지 말고 원본을 고친다). 여기엔 공간 규칙만 둔다.

## 지식은 AKM 하나
- 지식·규칙·절차의 본체는 \`/Users/eunssaem/akm\` (AKM) 하나다. 여기 파일엔 포인터만 둔다.
- 세션 시작 때 AKM \`40-memory/\` 전체와 \`99-system/INDEX.md\`를 읽는다. 둘 다 짧다. 그 다음은 필요한 층만 편다.
- 저장은 \`99-system/ROUTER.md\` 분류를 따른다. 임의 위치에 쓰지 않는다. \`10-sources/\` 원본은 수정 금지.

## 프로젝트
- 저장소: \`$GB\` (생각하는 글밭). 세계관은 \`WORLD-BIBLE.md\`, 다른 농부의 규칙은 \`souls/\`.
- 독서후플레이 경계(저장소 분리·사람 승인·자동 커밋 금지): AKM \`30-context/constraints/play-after-reading-guardrails.md\`.

## 메모리
- \`memory/YYYY-MM-DD.md\` 일일 기록, \`MEMORY.md\` 장기 사실. 둘 다 AKM에 이미 있는 내용은 적지 않는다.
- 사람 운영자 이재은(은쌤)과 은쌤 에이전트(발행 게이트)를 구분한다.

## 다른 농부 부르기
- 한 명이 끝낼 수 없는 일은 필로(\`philo\`)에게 넘긴다. 발행 전엔 깐쌤 → 은쌤 순서를 지킨다. 아이에게 전달은 호기를 거친다.
AG

  write_if_absent "$ws/USER.md" <<US
# USER.md

<!-- observed: 2026-07-26 | status: active -->

- 사용자 이재은(은쌤, 사람 운영자)의 지속 프로필은 AKM \`30-context/users/eunssaem.md\`에 있다. 여기엔 포인터만 둔다.
- 검수할 때는 칭찬보다 결함·리스크·우선순위를 분명히 짚는 엄격하고 솔직한 피드백을 원한다.
- 한국어로 답한다.
US

  write_if_absent "$ws/MEMORY.md" <<MEM
# MEMORY.md — $ko

지식·규칙·절차의 본체는 AKM \`/Users/eunssaem/akm\` 하나다. 여기엔 포인터만 둔다 — 같은 내용을 두 곳에 두면 캐릭터마다 사실이 갈라진다.

- 세션 시작 때 AKM \`40-memory/\` 전체와 \`99-system/INDEX.md\`를 읽는다.
- 에이전트 오피스 맥락: AKM \`30-context/projects/thinking-garden-agent-office.md\`
- 독서후플레이 작업 경계: AKM \`30-context/constraints/play-after-reading-guardrails.md\`
MEM

  # 에이전트 등록 (있으면 건너뜀)
  if ! openclaw agents list --json 2>/dev/null | grep -q "\"id\": *\"$id\""; then
    openclaw agents add "$id" --workspace "$ws" --agent-dir "$AGENT_ROOT/$id/agent" --non-interactive >/dev/null
  fi
  openclaw agents set-identity --agent "$id" --name "$ko" --emoji "$emoji" --avatar "avatars/$id.png" >/dev/null 2>&1 || true
  echo "✓ $id ($ko)"
done

# 필로 전용 규칙: 게이트웨이 설정을 고친 턴에서 오래 걸리는 점검 금지 (없을 때만 덧붙임)
if ! grep -q '^## 게이트웨이 설정을 고칠 때' "$WS_ROOT/philo/AGENTS.md"; then
  cat >> "$WS_ROOT/philo/AGENTS.md" <<'AG'

## 게이트웨이 설정을 고칠 때
- `openclaw.json`을 고친 턴에서는 `openclaw doctor`나 게이트웨이 재시작처럼 오래 걸리는 점검을 돌리지 않는다. 바꾼 내용과 백업 위치를 보고하고 턴을 끝낸다. 점검이 필요하면 은쌤에게 부탁한다. (2026-09-30: 같은 턴에서 doctor를 돌렸다가 CLI 무출력 워치독 600초 오류가 났다.)
AG
fi

# 필로 전용 스킬: philo-blog (저장소 원본 링크)
mkdir -p "$WS_ROOT/philo/skills"
ln -sfn "$GB/.claude/skills/philo-blog" "$WS_ROOT/philo/skills/philo-blog"
echo "✓ philo-blog skill linked"
"$GB/scripts/openclaw/sync-souls.sh"
