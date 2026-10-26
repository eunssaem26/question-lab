#!/usr/bin/env bash
# 별쌤·책쌤·글쌤 tools.exec 정책 추가 (2026-10-26) — 자동 모드 [Security Weaken] 차단으로 은쌤이 직접 실행
# 실행: 저장소 루트에서  bash scripts/openclaw/apply-saem-tools.sh   (Claude Code 입력창이면 앞에 ! )
set -euo pipefail
cd "$(dirname "$0")"
PATCH="$PWD/saem-tools.patch.json5"
CFG="$HOME/.openclaw/openclaw.json"

echo "① 백업"
BAK="$CFG.bak.saem-tools-$(date +%Y%m%d-%H%M%S)"
cp "$CFG" "$BAK" && echo "   $BAK"

echo "② 패치 (dry-run → 실제)"
openclaw config patch --file "$PATCH" --dry-run
openclaw config patch --file "$PATCH"

echo "③ 확인"
for a in byeolsaem chaeksaem geulsaem; do
  echo "   [$a]"; openclaw config get "agents.entries.$a.tools"
done

echo "④ 시험 턴 — 세 명 모두 Read 도구로 AKM 파일을 승인 없이 읽는지"
for a in byeolsaem chaeksaem geulsaem; do
  echo "   --- $a"
  openclaw agent --agent "$a" --timeout 240 --thinking off \
    -m "시험입니다. Read 도구(cat 금지)로 ~/akm/40-memory/user-profile.md 첫 줄만 읽고 그 줄을 그대로 답하세요. 다른 작업은 하지 마세요." \
    || echo "   $a 시험 턴 실패 — 슬랙 필로 DM에 승인 만료 알림이 새로 왔는지 확인"
done
echo "끝. 슬랙 필로 DM에 새 「Plugin approval expired」가 안 오면 성공."
