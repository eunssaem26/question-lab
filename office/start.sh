#!/bin/bash
# 생각하는 글밭 교무실 — 강의용 로컬 실행기
# 1) OpenClaw 게이트웨이(18789)가 떠 있는지 확인(없으면 launchd 서비스 기동)
# 2) 게이트웨이 토큰으로 config.local.js를 생성 3) 교무실 페이지를 8787에 서빙
# 4) 브라우저 첫 접속의 디바이스 페어링을 60초 동안 자동 승인 (게이트웨이는 루프백 전용)
set -uo pipefail
cd "$(dirname "$0")"

OC="$HOME/.local/bin/openclaw"
CONF="$HOME/.openclaw/openclaw.json"
PORT=$(python3 -c "import json;print(json.load(open('$CONF'))['gateway'].get('port',18789))" 2>/dev/null || echo 18789)
TOKEN=$(python3 -c "import json;print(json.load(open('$CONF'))['gateway']['auth']['token'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo "✗ $CONF 에서 gateway.auth.token 을 못 읽었습니다"; exit 1; fi

if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "· 오픈클로 게이트웨이 $PORT 실행 중"
else
  echo "· 오픈클로 게이트웨이 기동 중…"
  "$OC" daemon start >/dev/null 2>&1
  for _ in $(seq 1 30); do
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1 && break
    sleep 1
  done
fi

cat > config.local.js <<JS
// start.sh 가 매번 생성한다 — 커밋하지 않는다 (.gitignore 처리됨)
window.OFFICE_CONFIG = { port: $PORT, token: "$TOKEN" };
JS

if lsof -nP -iTCP:8787 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "· 페이지 서버 8787 이미 실행 중"
else
  python3 -m http.server 8787 --bind 127.0.0.1 > /tmp/geulbat-office-web.log 2>&1 &
  sleep 1
fi

echo
echo "  교무실 준비됨 →  http://localhost:8787"
echo
open "http://localhost:8787" 2>/dev/null || true

# 첫 접속 브라우저의 디바이스 페어링 자동 승인 (한 브라우저당 한 번만 필요). 게이트웨이가 루프백 전용이라 안전.
nohup bash -c '
  for _ in $(seq 1 20); do
    sleep 3
    for req in $("'"$OC"'" devices list 2>/dev/null | grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"); do
      "'"$OC"'" devices approve "$req" >/dev/null 2>&1 && echo "· 브라우저 디바이스 페어링 승인됨 ($req)"
    done
  done
' > /tmp/geulbat-office-pair.log 2>&1 &
