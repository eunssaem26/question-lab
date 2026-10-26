#!/usr/bin/env bash
# 깐쌤 tools.exec 정책 추가 (2026-10-26) — Claude Code 자동 모드가 [Security Weaken]으로 막아 은쌤이 직접 실행
# 실행: 터미널에서 이 저장소 루트로 가서  bash scripts/openclaw/apply-kkansaem-tools.sh
#       (Claude Code 입력창이면  ! bash scripts/openclaw/apply-kkansaem-tools.sh)
set -euo pipefail
cd "$(dirname "$0")"
PATCH="$PWD/kkansaem-tools.patch.json5"
CFG="$HOME/.openclaw/openclaw.json"

echo "① 백업"
BAK="$CFG.bak.kkansaem-tools-$(date +%Y%m%d-%H%M%S)"
cp "$CFG" "$BAK" && echo "   $BAK"

echo "② 패치 (dry-run → 실제)"
openclaw config patch --file "$PATCH" --dry-run
openclaw config patch --file "$PATCH"

echo "③ 확인"
openclaw config get agents.entries.kkansaem.tools

echo "④ 깐쌤 시험 턴 — Read 도구로 AKM 파일을 읽게 해서 승인 알림 없이 끝나는지"
openclaw agent --agent kkansaem --timeout 240 --thinking off \
  -m "시험입니다. Read 도구(cat 금지)로 ~/akm/40-memory/user-profile.md 첫 줄만 읽고 그 줄을 그대로 답하세요. 다른 작업은 하지 마세요." \
  || echo "   시험 턴 실패 — 슬랙 DM에 승인 만료 알림이 새로 왔는지 확인"
echo "끝. 슬랙 필로 DM에 새 「Plugin approval expired」가 안 오면 성공."
