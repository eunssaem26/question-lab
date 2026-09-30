#!/usr/bin/env bash
# souls/*.SOUL.md (원본) → ~/.openclaw/workspaces/<id>/SOUL.md (복사본) 동기화.
# OpenClaw는 부트스트랩 파일의 심볼릭 링크를 거부하므로(rejectSymlinks 하드코딩) 복사본을 둔다.
# 원본은 언제나 저장소 souls/. 워크스페이스 SOUL.md를 직접 고치지 말 것 — 다음 동기화 때 덮인다.
#   sync-souls.sh          동기화
#   sync-souls.sh --check  드리프트만 보고 (exit 1 if drift)
set -euo pipefail
GB="$(cd "$(dirname "$0")/../.." && pwd)"
WS_ROOT="$HOME/.openclaw/workspaces"
MAP="philo:필로 byeolsaem:별쌤 chaeksaem:책쌤 geulsaem:글쌤 eunsaem:은쌤 kkansaem:깐쌤 hogi:호기 yeongsaem:영쌤 batpd:밭피디 gardener:가드너"
check=${1:-}
drift=0
for pair in $MAP; do
  id=${pair%%:*}; ko=${pair##*:}
  src="$GB/souls/$ko.SOUL.md"; dst="$WS_ROOT/$id/SOUL.md"
  [ -d "$WS_ROOT/$id" ] || continue
  [ -L "$dst" ] && rm "$dst"   # 옛 심볼릭 링크 제거
  if [ -f "$dst" ] && cmp -s "$src" "$dst"; then continue; fi
  if [ "$check" = "--check" ]; then echo "drift: $id ($ko)"; drift=1; continue; fi
  cp "$src" "$dst"; echo "synced: $id ($ko)"
done
[ "$check" = "--check" ] && [ $drift = 0 ] && echo "souls in sync"
exit $drift
