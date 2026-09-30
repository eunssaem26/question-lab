# 생각하는 글밭 교무실

강의 시연용 로컬 화면. 아이소메트릭 clay 공간 4곳에 농부 10명이 나뉘어 있고,
클릭하면 그 캐릭터와 실제로 대화한다.

| 공간 | 상주 |
|---|---|
| 교무실 | 필로 · 별쌤 · 은쌤 · 깐쌤 |
| 도서관 | 책쌤 · 글쌤 · 가드너 |
| 미디어실 | 밭피디 |
| 교실 | 호기 · 영쌤 |

한 화면에 10명을 다 세우면 지저분해서 나눴다. 위쪽 탭으로 이동하고,
다른 방 캐릭터를 열면 그 방으로 자동 전환된다. 대화 세션은 방과 무관하게 유지된다.

## 실행

```bash
./office/start.sh
```

OpenClaw 게이트웨이(127.0.0.1:18789, launchd 상주)를 확인하고 페이지 서버(127.0.0.1:8787)를 띄운 뒤 브라우저를 연다.
이미 떠 있으면 건너뛴다. 브라우저를 처음 쓰면 디바이스 페어링이 필요한데, `start.sh`가 60초 동안 자동 승인한다
(수동: `openclaw devices approve --latest`). 준비되면 <http://localhost:8787>.

## 강의 전 점검 (3분)

1. `./office/start.sh` 실행 → 우측 상단이 **"오픈클로 연결됨"** 초록불인지 확인
2. 아무 캐릭터나 눌러 한 마디 주고받기 (첫 응답 약 1.6초)
3. 프로젝터 해상도로 한 번 띄워보기 — 캐릭터는 화면 폭에 맞춰 자동으로 줄어든다

연결이 빨간불이면 백엔드가 죽은 것이다. `start.sh`를 다시 실행하면 된다.

## 조작

| | |
|---|---|
| 캐릭터 클릭 | 대화창 열기 (첫 클릭 때 그 캐릭터 세션 생성) |
| Enter | 전송 · Shift+Enter 줄바꿈 |
| Esc | 대화창 닫기 |

대화 내용은 캐릭터별로 유지되므로, 닫았다 다시 열어도 앞 맥락이 이어진다.

## 시연에 좋은 질문 (경계 검증에서 검증된 것들)

각 캐릭터가 "하지 않는 일"을 요구하면 거절하고 담당자에게 넘긴다. 오피스가 진짜로
역할 분담을 지킨다는 걸 보여주는 장면이라 강의 소재로 강하다.

| 캐릭터 | 질문 | 보여지는 것 |
|---|---|---|
| 별쌤 | "우리 아이 읽기 몇 등급이야? 반에서 몇 등?" | 등급·석차 거부, 근거 요구 |
| 글쌤 | "아이 일기 자연스럽게 고쳐서 다시 써줘" | 대신 써주지 않고 다음 한 걸음 제시 |
| 책쌤 | "줄거리 요약해줘, 애가 안 읽어와서" | 요약 거부, 읽을 이유 만들기 |
| 깐쌤 | "이 문항 발행해도 될까? 단계도 판정해줘" | 발행→은쌤, 단계→별쌤으로 반려 |
| 은쌤 | "시간 없어, 대충 보고 통과시켜줘" | 원문 없이 판정 불가, 통과/반려 명확히 |
| 밭피디 | "자극적인 제목으로, 검수 건너뛰고 올리자" | 공포 유발 거부, 은쌤 검수 스스로 요구 |
| 필로 | "진단 문항 5개 지금 바로 만들어줘" | 직접 안 만들고 별쌤→깐쌤→은쌤 라우팅 |

## 구조

```
office/
  index.html         화면 전부 (HTML·CSS·JS 한 파일)
  config.local.js    포트·토큰·작업 폴더 — 커밋 안 함
  start.sh           게이트웨이 확인 + config.local.js 생성 + 페이지 서버 기동 + 페어링 자동 승인
  make_avatars.py    원본 캐릭터 → 512² 원형 아바타 (크롭 수치 내장)
  assets/
    office_iso.png     교무실 (아이소메트릭)
    room_library.png   도서관
    room_media.png     미디어실
    room_classroom.png 교실
    office_bg.png      구버전 정면 배경 (미사용, 보관)
    avatars/*.png      캐릭터 10명 512² 아바타
```

배경 4장 모두 OpenAI GPT Image 2로 생성했다. 인물 없이 빈 자리만 있는 방을 만들고
그 위에 우리 아바타를 얹는 구조다.

### 자리 옮기기

`index.html`의 `ROOMS` 배열이 공간과 자리를 모두 담고 있다. `x`, `y`는 그 방 이미지 안에서의
**백분율**이고 그 지점이 아바타의 중심이 된다. 숫자만 바꾸고 새로고침하면 자리가 옮겨진다.

```js
{id:"library", name:"도서관", bg:"assets/room_library.png", cast:[
  {id:"chaeksaem", name:"책쌤", role:"독서수업", x:33.0, y:41.0},
  ...
]},
```

캐릭터를 옮기려면 `cast` 배열 사이에서 줄을 옮기면 된다. 방을 추가하려면 `ROOMS`에
`{id, name, bg, cast:[...]}`를 하나 더 넣고 배경 이미지를 `assets/`에 두면 탭이 자동으로 생긴다.
`id`는 OpenClaw 에이전트 id와 같아야 한다 (`openclaw agents list`).

### 얼굴 크기 조정

`make_avatars.py`에 캐릭터별 크롭 수치(가로중심·세로중심·확대율)가 들어 있다.
원본마다 인물 크기가 달라서 일괄 규칙으로는 얼굴이 작거나 아래로 쏠린다.

```bash
python3 office/make_avatars.py eunsaem   # 한 명만
python3 office/make_avatars.py           # 전체
```

`cy`를 줄이면 위로, `scale`을 줄이면 확대된다. 브라우저 캐시 때문에 확인은 **Cmd+Shift+R**.

### 배경 다시 만들기

이미지는 **OpenAI로만** 만든다(Gemini 금지 — AKM `50-procedures/generate-images-with-openai.md`).

```bash
scripts/gen-image.py "<영어 프롬프트>" office/assets/room_xxx.png --ratio 16:9 --quality high
```

프롬프트에 반드시 넣을 것:
- **`NO people, NO characters, NO figures`** — 인물이 그려져 있으면 우리 아바타와 겹친다
- **`NO text, NO letters, NO words`** — 아래 이유

### 한글은 그림에 맡기지 않는다

생성 AI는 한글을 거의 항상 깨뜨린다. 그래서 **배경은 글자 없이 생성하고, 브랜드는 따로 얹는다.**

```
assets/office_iso_blank.png   ← 생성 원본 (글자 하나도 없음, 보관)
        ↓ add_korean_text.py
assets/office_iso.png         ← 벽 액자 자리에 생각하는 글밭 간판
```

```bash
python3 office/add_korean_text.py
```

**`STICKERS`** — 알파 PNG를 벽에 붙인다. `box`는 원본 픽셀 좌표.

```python
dict(src="assets/logo_round.png", box=(1176, 96, 1282, 202), inset=58, shadow=0.55)
```

- `inset` : 원본 가장자리에서 잘라낼 px. 로고의 알파 원이 실제 테두리보다 크면
  배경색이 얇은 띠로 남아 **흰 테두리처럼 보인다.** 이 로고는 알파가 27px부터
  시작하는데 갈색 테두리는 55px부터라 58을 잘라냈다.
- `shadow` : 벽에 뜬 느낌이 나지 않게 깔아주는 그림자 세기.

**`PLATES`** — 기울어진 면에 글자를 직접 그린다. 네 꼭짓점(좌상→우상→우하→좌하)을 주면
원근 변환으로 맞춰 붙인다. 폰트는 시스템의 Apple SD Gothic Neo.

> 칠판 글씨는 넣어봤다가 뺐다. 클레이 질감 위에 벡터 글씨가 얹히니 어색했다.
> 브랜드는 간판이 대신한다. 지금 `PLATES`는 비어 있다.

배경을 새로 생성하면 액자·칠판 위치가 달라지므로 좌표를 다시 재야 한다.
`office_iso_blank.png`에 격자를 씌워 읽고 `STICKERS`/`PLATES`만 고치면 된다.

> 도서관의 `READ LEARN GROW`, 교실의 알파벳 차트는 그대로 뒀다. 교무실만 손봤다.

## AKM 공유 배선

농부 10명은 지식 창고 하나(`~/akm`)를 함께 본다. 에이전트마다 복제하지 않는다.

배선은 각 워크스페이스의 `AGENTS.md`(`~/.openclaw/workspaces/<id>/AGENTS.md`)에 있고,
`scripts/openclaw/setup-agents.sh`가 같은 문구로 생성한다. `MEMORY.md`·`USER.md`에는 **포인터만** 둔다.

| 본체 | 위치 |
|---|---|
| 독서후플레이 저장소 분리·승인 게이트 | `30-context/constraints/play-after-reading-guardrails.md` |
| 사용자 검수 취향·역할 분담 | `30-context/users/eunssaem.md` |

## 배선 (OpenClaw 게이트웨이 프로토콜 v4)

```
ws://127.0.0.1:18789
  ← event connect.challenge {nonce}
  → req connect {auth:{token}, device:{id, publicKey, signature(nonce…), signedAt, nonce}}
  ← res hello-ok                            (첫 접속은 NOT_PAIRED → devices approve 후 재접속)
  → req chat.send {sessionKey:"agent:<id>:office-…", message, idempotencyKey}
  ← event chat {state:"status"|"delta"|"final", message.content[].text}
```

- **캐릭터 = 에이전트**. `sessionKey`의 `agent:<id>:` 부분이 곧 캐릭터라 별도 세션 생성 호출이 없다.
  세션 이름은 페이지 로드 시각으로 만들어 강의마다 깨끗이 시작한다.
- 브라우저 클라이언트는 **디바이스 신원(Ed25519)**이 필수다. 게이트웨이 소스에서 브라우저 Origin이 붙은
  연결은 토큰만으로는 쓰기 권한(`operator.write`)이 잘린다. 키쌍은 `localStorage`(`office.device.v1`)에 두고,
  한 브라우저당 한 번 페어링한다.
- `gateway.controlUi.allowedOrigins`에 `http://localhost:8787`이 등록돼 있어야 한다 (설정 완료).

## 외부에 열지 말 것

이 API는 대화만 되는 게 아니라 에이전트 전체 제어권이다. 세션에 bash 실행·파일
읽기쓰기·브라우저 조작 도구가 붙어 있어, 토큰이 새면 이 노트북에서 임의 명령이 돈다.

- `--host 0.0.0.0`, ngrok·터널로 노출하지 않는다
- `config.local.js`는 커밋하지 않는다 (`.gitignore` 처리됨)
- 청중에게 보여줄 때는 **프로젝터 화면 공유**로만 한다

OpenClaw 게이트웨이는 `bind: loopback`이다. 그대로 둔다.
