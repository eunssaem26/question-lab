#!/usr/bin/env bash
# 공유방 경계 공사 적용 (2026-10-22) — Claude Code 자동 모드가 막은 두 단계를 은쌤이 직접 실행
# 근거: AKM 30-context/constraints/openclaw-shared-session-boundary.md
set -euo pipefail

HOOK_DIR="$HOME/.openclaw/hooks/shared-session-privacy"
SRC_HANDLER="${1:-/private/tmp/claude-501/-Users-eunssaem-Desktop-open-claw---/d1b31235-545d-4354-96e3-3c8e1a4774f3/scratchpad/shared-session-privacy/handler.js}"
PATCH="${2:-/private/tmp/claude-501/-Users-eunssaem-Desktop-open-claw---/d1b31235-545d-4354-96e3-3c8e1a4774f3/scratchpad/shared-boundary.patch.json5}"

echo "① 훅 handler.js 설치"
test -f "$SRC_HANDLER" || { echo "handler.js 원본이 없음: $SRC_HANDLER"; exit 1; }
cp "$SRC_HANDLER" "$HOOK_DIR/handler.js"
node "$HOOK_DIR/selftest.mjs"

echo "② 설정 패치 적용 (dry-run → 실제)"
test -f "$PATCH" || { echo "패치 파일이 없음: $PATCH"; exit 1; }
openclaw config patch --file "$PATCH" --dry-run
openclaw config patch --file "$PATCH"

echo "③ 확인"
openclaw config get channels.slack.accounts.academy24-philo.groupPolicy
openclaw hooks enable shared-session-privacy || true
openclaw hooks info shared-session-privacy
echo "끝. #봇-실험실에서 '@필로 지금 실린 부트스트랩 파일 이름만 말해 줘'로 USER.md가 빠졌는지 확인하세요."
