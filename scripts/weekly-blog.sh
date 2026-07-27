#!/bin/zsh
# 주간 블로그 자동 초안 생성
# 매주 월 09:00 launchd(com.eunssaem.weekly-blog)가 실행.
# 생각하는 글밭 + 독서후플레이 두 저장소의 지난 7일 git log를 훑어
# '블로그 글로 쓸 만한 큰 변화'가 있으면 philo-blog 스킬로
# status:draft 초안을 site/src/content/blog/에 생성한다.
# 발행은 사람이 검토 후 status를 published로 바꾼다. 절대 자동 발행/푸시 금지.

PROJECT="/Users/eunssaem/Desktop/open claw 준비"
PAR_APP="/Users/eunssaem/Desktop/독서후플레이/par-app"
CLAUDE="/Users/eunssaem/.local/bin/claude"
LOG="/Users/eunssaem/Library/Logs/weekly-blog.log"
STATUS="/Users/eunssaem/Library/Logs/weekly-blog.status"
BLOGDIR="site/src/content/blog"

cd "$PROJECT" || exit 1

# 실패를 조용히 넘기지 않는다. 알림 + 상태파일 양쪽에 남긴다.
notify() {  # notify <제목> <본문>
  /usr/bin/osascript -e "display notification \"$2\" with title \"$1\"" 2>/dev/null
}
record() {  # record <결과> <메시지>
  echo "$(date '+%Y-%m-%d %H:%M') | $1 | $2" > "$STATUS"
  echo "[$1] $2" >> "$LOG"
}

echo "===== $(date '+%Y-%m-%d %H:%M') 주간 블로그 체크 시작 =====" >> "$LOG"

# 초안이 새로 생겼는지 판정하기 위한 실행 전 스냅샷
BEFORE=$(ls "$BLOGDIR" 2>/dev/null)

# 독서후플레이는 별도 저장소다. #13·#15가 이 저장소 소재였으므로 함께 훑는다.
if [ -d "$PAR_APP/.git" ]; then
  PAR_LINE="   - 독서후플레이: \`git -C \"$PAR_APP\" log --since=\"7 days ago\" --oneline\`
     (별도 저장소다. 개발일지 #13·#15가 여기서 나온 소재였으니 반드시 함께 본다.)"
else
  PAR_LINE="   - 독서후플레이 저장소를 찾지 못했다. 생각하는 글밭 커밋만 본다."
fi

PROMPT="너는 생각하는 글밭 프로젝트의 블로그 자동화 담당이야. 다음을 순서대로 수행해.

1. 두 저장소의 지난 7일 커밋을 모두 확인한다.
   - 생각하는 글밭(현재 디렉터리): \`git log --since=\"7 days ago\" --oneline\`
$PAR_LINE
2. 두 저장소를 통틀어 \"블로그 글로 쓸 만한 큰 변화\"가 있는지 판단한다.
   - 글감이 되는 것: 새 기능/새 게임/새 서비스/큰 개편/사용자에게 보이는 의미 있는 추가 (feat 커밋 등).
   - 글감이 아닌 것: 오타/링크/도메인/문서/리팩터링/설정 등 잔손질(chore, docs, fix 중 사소한 것).
   - 이미 그 변화에 대한 블로그 글이 $BLOGDIR 에 있으면 중복 작성하지 않는다.
   - 두 저장소 모두에 글감이 있으면 더 큰 변화 하나만 고른다. 한 번에 한 편만 쓴다.
3. 글감이 있으면 philo-blog 스킬(/philo-blog)을 사용해 초안을 작성한다.
   - 새 기능·게임·서비스·큰 개편 같은 개발 성과 글은 반드시 개발일지 series로 붙인다:
     category: devlog + series: \"생각하는 글밭 개발일지\" + seriesNumber는 기존 최댓값+1.
     (series 없이 insight 등 단독 카테고리로 저장하면 홈에서 누락되고 목록 맨 아래로 떨어진다.)
   - 반드시 frontmatter를 status: \"draft\" 로 저장한다.
   - 파일은 $BLOGDIR 에 저장한다.
   - 독서후플레이 소재라도 초안은 이 저장소($BLOGDIR)에 만든다.
4. 글감이 없으면 아무 파일도 만들지 말고 정확히 \"이번 주 글감 없음\"이라고만 출력하고 끝낸다.

엄수 사항:
- status를 절대 \"published\"로 바꾸지 마라. 발행은 사람이 한다.
- git commit / git push 를 절대 하지 마라. 초안 파일만 작업트리에 남긴다.
- 독서후플레이 저장소에는 아무것도 쓰지 마라. 읽기만 한다.
- 마지막에 무엇을 했는지(생성한 파일 경로와 제목, 또는 스킵 사유) 한 줄로 요약해라."

OUT=$(mktemp -t weekly-blog-out)
"$CLAUDE" -p "$PROMPT" --permission-mode bypassPermissions >"$OUT" 2>&1
CODE=$?
cat "$OUT" >> "$LOG"

AFTER=$(ls "$BLOGDIR" 2>/dev/null)
NEW=$(comm -13 <(echo "$BEFORE") <(echo "$AFTER") | head -3)

if [ $CODE -ne 0 ]; then
  record "실패" "claude 종료코드 $CODE"
  notify "주간 블로그 실패" "claude가 종료코드 ${CODE}, 실행이 중단됐어요. 로그를 확인하세요."
elif grep -q "API Error" "$OUT"; then
  record "실패" "API Error (응답 중단)"
  notify "주간 블로그 실패" "API 오류로 초안을 못 만들었어요. 수동 실행이 필요해요."
elif [ -n "$NEW" ]; then
  record "성공" "초안 생성: $NEW"
  notify "주간 블로그 초안 나왔어요" "$NEW"
elif grep -q "글감 없음" "$OUT"; then
  record "정상" "이번 주 글감 없음"
else
  record "확인필요" "초안도 없고 '글감 없음'도 아님"
  notify "주간 블로그 확인 필요" "초안이 안 생겼는데 사유도 불분명해요. 로그를 확인하세요."
fi

rm -f "$OUT"

echo "===== $(date '+%Y-%m-%d %H:%M') 완료 =====" >> "$LOG"
echo "" >> "$LOG"
