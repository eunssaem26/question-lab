#!/bin/bash
# 그림일기 한 편을 공개 아카이브 저장소(~/Desktop/geulbat-diary)에 넣고 push 한다.
#   archive.sh YYYY-MM-DD
# 저장소 구조: <날짜>.jpg, <날짜>.json, README.md (최신이 위인 목록)
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
DATE=${1:?날짜}
ROOT="/Users/eunssaem/Desktop/open claw 준비"
SRC="$ROOT/diary/$DATE"
ARCH="$HOME/Desktop/geulbat-diary"
[ -f "$SRC/diary.jpg" ] || { echo "✗ $SRC/diary.jpg 없음"; exit 1; }
[ -d "$ARCH/.git" ] || { echo "✗ 아카이브 저장소 없음: $ARCH (gh repo clone eunssaem26/geulbat-diary ~/Desktop/geulbat-diary)"; exit 1; }

cp "$SRC/diary.jpg" "$ARCH/$DATE.jpg"
cp "$SRC/diary.json" "$ARCH/$DATE.json"
TITLE=$(python3 -c "import json;print(json.load(open('$SRC/diary.json'))['title'])")

cd "$ARCH"
# README 목록 갱신 (같은 날짜 줄이 있으면 교체, 없으면 맨 위에 추가)
python3 - "$DATE" "$TITLE" <<'PY'
import sys,re,os
date,title=sys.argv[1],sys.argv[2]
head="# 필로의 그림일기\n\n생각하는 글밭 코디네이터 필로가 매일 배운 것을 크레파스 한 장으로 남긴다.\n사관학교 그림일기에 올린 뒤 여기에 쌓인다. 인스타 @eunssaem26 에는 은쌤이 골라 올린다.\n\n| 날짜 | 제목 | |\n|---|---|---|\n"
rows=[]
if os.path.exists("README.md"):
    for line in open("README.md"):
        m=re.match(r"\| (\d{4}-\d{2}-\d{2}) \| (.*?) \| .*\|$", line.strip())
        if m and m.group(1)!=date: rows.append((m.group(1),m.group(2)))
rows.append((date,title)); rows.sort(reverse=True)
open("README.md","w").write(head+"".join(f"| {d} | {t} | [보기]({d}.jpg) |\n" for d,t in rows))
PY
git add "$DATE.jpg" "$DATE.json" README.md
if git diff --cached --quiet; then echo "· 아카이브: 변경 없음"; exit 0; fi
git commit -qm "diary $DATE: $TITLE"
git push -q origin main
echo "✓ 아카이브: https://github.com/eunssaem26/geulbat-diary/blob/main/$DATE.jpg"
