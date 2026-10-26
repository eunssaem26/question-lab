#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out="$(TG_DUMP=1 "$ROOT/scripts/tg" 영쌤 "영어 학습 경험 설계 테스트")"

if [[ "$out" == *"===== 레이어 3:"* ]]; then
  echo "FAIL: 영쌤에게 한국어 읽기·글쓰기 준거틀이 자동 주입됨" >&2
  exit 1
fi
if [[ "$out" != *"영쌤 — SOUL"* ]]; then
  echo "FAIL: 영쌤 SOUL이 로드되지 않음" >&2
  exit 1
fi

echo "PASS: 영쌤은 별도 영어 준거틀 전까지 SOUL만 로드함"
