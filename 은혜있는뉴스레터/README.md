# 은혜있는 뉴스레터

핸드폰에서 편하게 읽는 소식지를, **사진 + 글**만 채우면 매번 같은 디자인으로 찍어냅니다.
워드프레스처럼 매달 새로 꾸밀 필요 없이, 내용만 채우면 됩니다.

## 호수·이름 규칙 (2026 여름호에서 확정)

- **정식 번호 = `Vol.N`** — 발행 주기와 무관하게 1씩 증가. 정렬·아카이브·"지난 호"에 유리.
- **표시 라벨 = `YYYY년 M월`** — 사람에게 보이는 발행 시점.
  - 마스트헤드에는 `2026년 9월 · Vol.2` 처럼 함께 표기됩니다.
- **폴더 = `issues/NN-YYYY-MM/`** — 번호가 앞에 와서 항상 순서대로 정렬됨.
  - 각 호의 사진은 그 폴더 안 `사진/` 에 넣습니다. (창간호는 공용 `26여름사진/` 사용)
- 창간호: `issues/01-2026-07/`, 라벨 `2026년 7월 · Vol.1`.

## 다음 호 만드는 법 (3단계)

1. **폴더 자동 생성** — 터미널에서:
   ```bash
   node new-issue.mjs 2 2026 9      # Vol.2 · 2026년 9월
   ```
   → `issues/02-2026-09/` 와 그 안 `사진/` 폴더, 기본 `content.json` 이 만들어집니다.
   (푸터 링크는 지난 호에서 자동으로 이어받습니다.)

2. **채우기** — 사진을 `issues/02-2026-09/사진/` 에 넣고, `content.json` 에 글·사진·링크를 채웁니다.
   블록 종류:
   - `{"t":"p", ...}` 문단 · `{"t":"photo", ...}` 사진 · `{"t":"gallery", ...}` 사진 여러 장
   - `{"t":"linkcards", ...}` 링크 카드(미리보기 이미지 + 바로가기) · `{"t":"note", ...}` 맺음말
   - 섹션의 `flower` 는 섹션 위 감성 컷

3. **생성** — 
   ```bash
   node build.mjs issues/02-2026-09
   ```
   → `index.html`(완성본)이 만들어집니다. 사진은 자동으로 웹용으로 줄여 파일 안에 넣어줍니다.

> 실제로는 은쌤이 사진과 글을 주시면 Claude가 위 과정을 대신 해 드립니다. 이 문서는 구조 참고용이에요.

## 만들어지는 파일

| 파일 | 용도 |
|------|------|
| `index.html` | 완성본. 더블클릭하면 열림. 카톡·이메일로 파일째 보내도 사진까지 다 들어있음. |
| `_artifact.html` | claude.ai Artifact(링크) 발행용 본문 |

## 링크 미리보기 이미지 만들기

본문 링크 카드에 들어가는 사이트 미리보기는 macOS 기본 Chrome으로 캡처합니다(Claude가 처리):
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --force-device-scale-factor=2 \
  --window-size=1200,620 --virtual-time-budget=7000 \
  --screenshot="issues/<이슈>/사진/preview-web.png" "https://…"
```
유튜브 쇼츠 썸네일은 `https://i.ytimg.com/vi/<영상ID>/maxresdefault.jpg` 로 받습니다.

## 지난 호 아카이브 홈 (Vercel)

모든 호를 모아 하나의 홈페이지로 만들려면:
```bash
node site-build.mjs      # public/ 폴더 생성 (홈 + 각 호를 /YYYY-MM/ 경로로)
```
- `public/index.html` — 지난 호 목록(최신호 배지), 각 카드가 해당 호로 연결
- `public/2026-07/index.html` — 창간호 등 각 호
- **배포된 주소: https://eunhye-newsletter.vercel.app** (지난 호가 여기에 쌓입니다)
- 새 호 발행 후 재배포:
  ```bash
  node site-build.mjs
  rm -rf eunhye-newsletter && cp -r public eunhye-newsletter
  npx vercel@latest deploy eunhye-newsletter --prod --yes --scope eunssaem26-3562s-projects
  ```
  → 새 호 카드가 홈에 자동으로 추가됩니다.

## 공유하는 3가지 방법

1. **링크** — Claude에게 "이번 호 링크로 만들어줘" → `claude.ai` 주소. 단톡방에 붙이면 핸드폰에서 바로 열림.
2. **파일** — `index.html` 하나만 보내도 됨.
3. **Vercel 고정주소 + 지난 호 보관(선택)** — "뉴스레터도 Vercel에 올려줘" 하면 아카이브 페이지까지 세팅.

## 브랜드 고정 규칙

- 스튜디오명 `생각하는 글밭`, 영문은 **항상 `Where Thoughts Grow`** (마침표 없음).
- 뉴스레터 제목 `은혜있는 뉴스레터`. 서명은 **항상 `이재은 드림`** ("은혜 드림" 안 씀).
- 링크는 가능하면 미리보기 이미지 카드로. 사진 캡션은 최소화(사진마다 설명 X).
- 디자인: 정원 그린 + 여름 꽃 포인트, 라이트/다크 대응, 본문 18px(모바일 우선).
