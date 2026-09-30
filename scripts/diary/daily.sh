#!/bin/bash
# 필로의 그림일기 — 매일 21:30 launchd (com.eunssaem.picture-diary)
#
#  1) Claude Code 헤드리스(claude -p, Max 구독)가 picture-diary 스킬 절차대로
#     오늘 기록에서 배운 것 하나를 골라 → codex-image 로 그림 → diary.jpg 렌더 → 사관학교 업로드
#  2) 텔레그램(필로 봇)으로 그림·글을 보낸다 — 인스타는 은쌤이 보고 결정한다.
#     올리려면 Claude Code 에게 "오늘 그림일기 인스타 올려줘" (크롬 조작, 4:5 크롭 필수)
#
#  사용:  daily.sh            전체 실행
#         daily.sh --no-post  1)만, 사관학교에 안 올림 (시험용)
#  로그:  /tmp/geulbat-diary.log
set -uo pipefail
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
ROOT="/Users/eunssaem/Desktop/open claw 준비"
SKILL="$HOME/.openclaw/workspaces/philo/skills/picture-diary"
VAULT="/Users/eunssaem/Documents/Obsidian Vault"
DATE=$(date +%F)
DIR="$ROOT/diary/$DATE"
NO_POST=0; [ "${1:-}" = "--no-post" ] && { NO_POST=1; DIR="$DIR-test"; }   # 시험은 별도 폴더
TG=7862126062

notify() { openclaw message send --channel telegram --target "$TG" --message "$1" >/dev/null 2>&1 || true; }
log() { echo "[$(date '+%F %T')] $*"; }

log "=== 그림일기 시작 ($DATE, no_post=$NO_POST)"
mkdir -p "$DIR"

# 오늘 것이 이미 있으면 끝 (사관학교도 하루 1편)
if [ $NO_POST = 0 ] && [ -f "$DIR/diary.jpg" ]; then
  log "오늘 것은 이미 있음 — 종료"; exit 0
fi

# 오늘 기록 모으기 (배운 것의 재료)
NOTES=$(mktemp)
{
  echo "## git 오늘 커밋"; git -C "$ROOT" log --since=midnight --format='- %s' 2>/dev/null | head -30
  for r in "$HOME/Desktop/독서후플레이/par-app"; do [ -d "$r/.git" ] && { echo; echo "## $(basename "$r") 오늘 커밋"; git -C "$r" log --since=midnight --format='- %s' | head -15; }; done
  f="$VAULT/70. Outputs/세션 정리/$DATE.md"; [ -f "$f" ] && { echo; echo "## 세션 정리"; cat "$f"; }
  f="$VAULT/00. Inbox/01. Daily Notes/$DATE.md"; [ -f "$f" ] && { echo; echo "## 데일리 노트"; sed -n '/## 작업 내역/,/## 내일/p' "$f"; }
} > "$NOTES"
if [ "$(grep -cvE '^\s*$|^##' "$NOTES")" -lt 2 ]; then
  log "오늘 기록이 없다 — 일기 생략"; notify "🐰 오늘($DATE)은 기록이 없어 그림일기를 쉬었어요."; rm -f "$NOTES"; exit 0
fi

# 오늘 날씨 (인천) → 맑음|구름|흐림|비|눈
W=$(curl -s -m 8 'https://wttr.in/Incheon?format=%C' 2>/dev/null | tr 'A-Z' 'a-z')
case "$W" in *snow*|*sleet*) WEATHER="눈";; *rain*|*drizzle*|*shower*|*thunder*) WEATHER="비";; *overcast*|*fog*|*mist*) WEATHER="흐림";; *cloud*) WEATHER="구름";; "") WEATHER="맑음";; *) WEATHER="맑음";; esac

# 1) 그림일기 생성 (+ 사관학교 업로드)
POST_STEP="5단계까지 그대로 진행한다 (사관학교에 올린다)."
[ $NO_POST = 1 ] && POST_STEP="5단계(올리기)는 하지 않는다. diary.jpg 까지만 만든다."

PROMPT=$(cat <<EOF
너는 생각하는 글밭의 코디네이터 필로(회청색 토끼)다. 오늘 배운 것을 그림일기로 남긴다.
스킬 절차: $SKILL/SKILL.md 를 읽고 1~4단계를 그대로 따른다. $POST_STEP
작업 폴더: $DIR (이미 만들어져 있다. 파일은 전부 여기에 둔다)
\$S = $SKILL

- 0단계(열쇠)는 이미 돼 있다. 2단계 my-bot.png 는 \`node \$S/scripts/diary-api.mjs whoami $DIR/my-bot.png\` 로 받는다.
- 3단계 그림은 반드시 이 명령으로 그린다 (다른 이미지 도구 금지, 1회만):
  ~/.claude/skills/codex-image/gen.sh --out $DIR/picture.png --size 1536x1024 --ref $DIR/my-bot.png --ref \$S/references/style-crayon.jpg "<SKILL.md 3단계 프롬프트 + 장면>"
  프롬프트에 필로의 특징(회청색 토끼, 둥근 갈색 안경, 남색 조끼에 흰 셔츠)을 적고 "안경과 남색 조끼는 반드시 유지"를 넣는다. 결과는 Read 로 한 번 본다.
- 4단계 diary.json 의 sign 은 "— 필로", date 는 $DATE, weather 는 "$WEATHER" (이미 조회한 값, 그대로 쓴다). 렌더: \`node \$S/scripts/render.mjs $DIR/diary.json $DIR/diary.jpg\`
- 오늘 재료는 아래 기록이다. 여기에 없는 일은 지어내지 않는다. 사람 이름·전화번호·비밀키·토큰은 쓰지 않는다.
- 끝나면 제목·본문·(올렸다면) 주소만 3줄로 출력한다.

===== 오늘 기록 =====
$(cat "$NOTES")
EOF
)
rm -f "$NOTES"

cd "$DIR"
claude -p "$PROMPT" \
  --allowedTools "Read,Write,Bash(node *),Bash(*gen.sh *),Bash(ls *),Bash(cat *),Bash(mkdir *)" \
  --max-turns 40 > "$DIR/claude-output.txt" 2>&1
RC=$?
log "claude -p 종료 코드 $RC"; tail -5 "$DIR/claude-output.txt"

if [ ! -f "$DIR/diary.jpg" ]; then
  log "diary.jpg 없음 — 실패"; notify "🐰 그림일기 실패($DATE): diary.jpg 가 안 만들어졌어요. /tmp/geulbat-diary.log 확인."; exit 1
fi
[ $NO_POST = 1 ] && { log "--no-post: 여기서 끝"; exit 0; }

# 2) 텔레그램으로 보여주기 (인스타는 은쌤 확인 후 수동)
TITLE=$(python3 -c "import json;print(json.load(open('$DIR/diary.json'))['title'])" 2>/dev/null)
ACADEMY=$(grep -oE 'https://[^ ]+/diary/\?h=[^ ]+' "$DIR/claude-output.txt" | tail -1)
# 오픈클로는 ~/.openclaw 아래 파일만 첨부할 수 있다
mkdir -p "$HOME/.openclaw/media/diary"; cp "$DIR/diary.jpg" "$HOME/.openclaw/media/diary/$DATE.jpg"
openclaw message send --channel telegram --target "$TG" --media "$HOME/.openclaw/media/diary/$DATE.jpg" \
  --message "🐰 오늘 그림일기 — 「$TITLE」
사관학교: ${ACADEMY:-업로드 확인 필요}
인스타에 올리려면 Claude Code 에게 「오늘 그림일기 인스타 올려줘」" >/dev/null 2>&1 || notify "🐰 오늘 그림일기 「$TITLE」 만들었어요 (사진 전송 실패). $DIR/diary.jpg"
RC=0
log "=== 끝 (rc=$RC)"
exit $RC
