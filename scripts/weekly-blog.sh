#!/bin/zsh
# 주간 블로그 자동 초안 생성
# 매주 월 09:00 launchd(com.eunssaem.weekly-blog)가 실행.
# 지난 7일 git log를 훑어 '블로그 글로 쓸 만한 큰 변화'가 있으면
# philo-blog 스킬로 status:draft 초안을 site/src/content/blog/에 생성한다.
# 발행은 사람이 검토 후 status를 published로 바꾼다. 절대 자동 발행/푸시 금지.

PROJECT="/Users/eunssaem/Desktop/open claw 준비"
CLAUDE="/Users/eunssaem/.local/bin/claude"
LOG="/Users/eunssaem/Library/Logs/weekly-blog.log"

cd "$PROJECT" || exit 1

echo "===== $(date '+%Y-%m-%d %H:%M') 주간 블로그 체크 시작 =====" >> "$LOG"

PROMPT='너는 생각하는 글밭 프로젝트의 블로그 자동화 담당이야. 다음을 순서대로 수행해.

1. `git log --since="7 days ago" --oneline` 으로 지난 7일 커밋을 확인한다.
2. 그 중 "블로그 글로 쓸 만한 큰 변화"가 있는지 판단한다.
   - 글감이 되는 것: 새 기능/새 게임/새 서비스/큰 개편/사용자에게 보이는 의미 있는 추가 (feat 커밋 등).
   - 글감이 아닌 것: 오타/링크/도메인/문서/리팩터링/설정 등 잔손질(chore, docs, fix 중 사소한 것).
   - 이미 그 변화에 대한 블로그 글이 site/src/content/blog/ 에 있으면 중복 작성하지 않는다.
3. 글감이 있으면 philo-blog 스킬(/philo-blog)을 사용해 초안을 작성한다.
   - 카테고리는 소재에 맞게(개발일지=devlog, 사용자 기능/게임=insight 등) 고른다.
   - 반드시 frontmatter를 status: "draft" 로 저장한다.
   - 파일은 site/src/content/blog/ 에 저장한다.
4. 글감이 없으면 아무 파일도 만들지 말고 정확히 "이번 주 글감 없음"이라고만 출력하고 끝낸다.

엄수 사항:
- status를 절대 "published"로 바꾸지 마라. 발행은 사람이 한다.
- git commit / git push 를 절대 하지 마라. 초안 파일만 작업트리에 남긴다.
- 마지막에 무엇을 했는지(생성한 파일 경로와 제목, 또는 스킵 사유) 한 줄로 요약해라.'

"$CLAUDE" -p "$PROMPT" --permission-mode bypassPermissions >> "$LOG" 2>&1

echo "===== $(date '+%Y-%m-%d %H:%M') 완료 =====" >> "$LOG"
echo "" >> "$LOG"
