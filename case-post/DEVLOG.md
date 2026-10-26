# 오픈클로 이전 — 개발 로그

Claude Code(Fable 5.1)와 함께 진행한 작업 기록입니다. 세션 `1f7da7f5`, 2026-09-30 13:51~16:23 KST, 작업 폴더 `open claw 준비`.

증거 등급: `[V]` 직접 확인(도구 출력·파일·커밋) · `[P]` 세션 안 진술만 · `[I]` 추정(원고에 쓰지 않음)

---

## 2026-09-30 (Day 1)

### 1. 시작 — 헤르메스에서 오픈클로로 옮기기로 결정

```
오픈클로를 다시 설치했어. 코덱스를 연결할까 했는데, 플러스는 용량이 너무 작아서 리밋 걸려서 안될 듯. 오픈클로에 클로드 구독 연결해서 잘 쓰더라고. 우리도 오픈클로 쓰자. 헤르메스에서 이전작업도 해야 하고, 슬랙이랑 텔레그램 연결도 다시 하자.
```

**Claude Code 작업:**
- 현재 상태 파악: OpenClaw 2026.9.6 설치 확인, 인증 프로필에 코덱스(openai/oauth)만 있음 `[V]`
- 헤르메스 쪽에 캐릭터 프로필 10개(필로·별쌤·책쌤·글쌤·은쌤·깐쌤·호기·영쌤·밭피디·가드너)와 텔레그램 봇 토큰이 있음 `[V]`
- 슬랙 토큰은 그 전 세대인 NanoClaw 백업 폴더의 env 파일에 있음 `[V]`
- `openclaw migrate hermes --dry-run` 실행 → 120개 항목, 대부분 범용 스킬 복사라 **자동 마이그레이션은 쓰지 않기로** 함 `[V]`
- 공식 문서에서 클로드 구독 연결 방식 확인: "Claude CLI 재사용"이 1순위(토큰 복사 없음) `[V]`
- 코덱스 Plus가 리밋에 걸렸다는 것은 사용자 진술 `[P]` (뒤에 실제 리밋 에러가 도구 출력에 찍힘 `[V]`)

### 2. 농부 10명을 오픈클로 에이전트로 설치

**Claude Code 작업:**
- `scripts/openclaw/setup-agents.sh` 작성·실행: 캐릭터별 워크스페이스 생성(IDENTITY/AGENTS/USER/MEMORY + 아바타), `openclaw agents add` 10회, philo-blog 스킬 링크 `[V]`
- 결과: 에이전트 11개(main + 10) `[V]`
- 메모리는 AKM(지식 저장소) 포인터 3줄만 두고 본체는 복제하지 않음 `[V]`

### 3. 텔레그램·슬랙 연결

**Claude Code 작업:**
- 텔레그램: 헤르메스 env의 기존 봇 토큰으로 `openclaw channels add --channel telegram` → `dmPolicy: pairing`, `groupPolicy: allowlist` `[V]`
- 슬랙: NanoClaw 백업의 bot/app 토큰으로 소켓 모드 추가. `@openclaw/slack` 플러그인이 자동 설치됨 `[V]`
- `openclaw channels status --probe` → Slack `works`, Telegram `works`(polling, @eunssaem_bot) `[V]`
- 같은 텔레그램 토큰이라 충돌하므로 헤르메스 게이트웨이 정지, LaunchAgent plist를 `.disabled`로 이름 변경 `[V]`

### 4. 클로드 Max 구독 연결 — 사용자가 직접 실행

브라우저 확인이 필요한 TTY 명령이라 사용자에게 한 줄 실행을 요청.

```
! openclaw models auth login --provider anthropic --method cli --set-default
```
```
이렇게 뜨는데?  (→ "Multiple agents are configured ... Pass --agent <id>")
```

**Claude Code 작업:**
- `--agent philo`를 붙여 재실행 안내 → 성공. "Claude CLI auth detected", 기본 모델 `anthropic/claude-opus-5` `[V]`
- 설정을 읽어 보니 `agents.defaults`에 전역으로 잡혀 10명이 공유 `[V]`
- 첫 스모크 테스트가 "Codex subscription usage limit" 에러 → 게이트웨이 재시작 후 정상 `[V]`

### 5. 필로가 문항을 직접 만들어 버림 — SOUL 심볼릭 링크 거부 발견

**Claude Code 작업:**
- 경계 테스트 "문항 5개 지금 바로 만들어줘"에 필로가 문항 5개를 **직접 생성** → 성격 파일(SOUL.md)이 로드되지 않았다는 신호 `[V]`
- 로그와 OpenClaw 소스 확인: 워크스페이스 부트스트랩 파일의 심볼릭 링크를 하드코딩으로 거부(`symlink path component not allowed`, `rejectSymlinks`) `[V]`
- 해결: 원본은 저장소 `souls/`에 두고 워크스페이스에는 복사본. `scripts/openclaw/sync-souls.sh` 작성, post-commit 훅에 연결 `[V]`
- 재테스트: 필로가 문항을 만들지 않고 책쌤→별쌤→깐쌤→은쌤으로 요청을 분해 `[V]`
- 에이전트 간 위임 허용(`subagents.allowAgents: ["*"]`) → `agents_list`에 9명 표시 `[V]`

### 6. 채널 → 캐릭터 바인딩과 발신 테스트

**Claude Code 작업:**
- 텔레그램 DM으로 테스트 메시지 발신 성공(Message ID 10) `[V]`
- 슬랙 채널 목록 조회 후 바인딩 5개 적용: 글쌤채널→글쌤, 책쌤채널→책쌤, 별쌤채널→별쌤, 그 외 슬랙·텔레그램→필로 `[V]`
- 슬랙 발신 성공 `[V]`. 하트비트(30분마다 main 호출) 비활성화 — Max 쿼터 절약 `[V]`
- 스크립트 2개 커밋 `[V]`

### 7. 웹 교무실을 오픈클로 게이트웨이로 재배선

```
웹 교무실도 오픈클로로 재배선해줘
```

**Claude Code 작업:**
- 강의 시연용 로컬 페이지(캐릭터 10명 클릭 대화)가 헤르메스 WS(9119)에 붙어 있었음 `[V]`
- 오픈클로 게이트웨이(18789) 프로토콜 v4를 노드 스크립트로 직접 찍어 가며 확인: 프레임 타입 `req`, 브라우저 Origin은 `controlUi.allowedOrigins` 등록 필요, **브라우저 클라이언트는 Ed25519 디바이스 신원 서명 필수**, 첫 접속은 `openclaw devices approve` `[V]`
- `office/index.html` 연결부 재작성(WebCrypto 서명, `chat.send`, `delta/final` 스트리밍), `start.sh`가 토큰으로 설정 파일 생성 + 60초 페어링 자동 승인 `[V]`
- 브라우저에서 깐쌤·호기·책쌤 경계 테스트 3건 통과 `[V]`
- 호기 첫 턴 42초 → 메모리 벡터검색 임베딩이 코덱스로 가서 30초 타임아웃. `memory.search.enabled: false` → 콜드스타트 35초, 이후 6.5초 `[V]`
- 커밋 `[V]`

### 8. 스터디 자료와 대조

```
https://bboya-academy.nodak.co.kr/install
오늘 스터디자료야. 이 자료 보고 모든 내용 잘 반영되었는지 확인해줘.
```

**Claude Code 작업:**
- 설치 가이드 12항목 대조: 10개 반영, 2개(텔레그램 첫 수신·슬랙 DM)는 사용자 메시지가 있어야 확인 가능 `[V]`
- 자료대로 하면 남지 않는 **코덱스 플러그인 잔재** 발견: codex app-server 프로세스 8개 → 플러그인 비활성·설정 삭제 → 0개 `[V]`
- `doctor` 경고 해소, 슬랙 `replyToMode: "all"`(스레드 답장) 적용 `[V]`
- 토큰이 셸 히스토리에 남지 않았음을 확인 `[V]`
- 의도적으로 자료와 다르게 둔 것: `groupPolicy: allowlist`(open 대신), `allowBots` 미사용(농부끼리 루프 방지) `[V]`

### 9. 실제 수신 테스트

```
텔레그램이랑 슬랙에 메시지 보냈어, 확인해줘
```

**Claude Code 작업:**
- 로그 확인: 슬랙 수신→스레드 답장 12초, 텔레그램 수신→답장 163초 `[V]`
- 원인: 텔레그램 DM은 `agent:philo:main` 세션을 쓰는데 초반 CLI 스모크 테스트가 세션 지정 없이 거기 쌓여 10만 토큰 `[V]`
- main 세션은 CLI로 삭제·보관 불가 → 텔레그램에서 `/new` 권고. 이후 CLI 테스트는 항상 `--session-id` `[V]`

### 10. 질문 — 두 채널을 동시에 써도 혼란스럽지 않은가

```
질문: 슬랙이랑 텔레그램이랑 둘다 동시에 써도 혼란스럽지는 않아? 대화 시간 순서대로 일이 진행되나? 역할이 어떻게 나누어져 있는거야?
```

**Claude Code 작업:**
- 세션 키 구조 설명: 텔레그램 DM은 메인 세션 하나, 슬랙은 스레드마다 새 세션, 웹 교무실은 페이지 로드마다 새 세션 → 같은 필로여도 채널이 다르면 기억이 다름 `[V]`(로그의 실제 세션 키 기준)
- 한 세션 안은 순차, 세션끼리는 병렬. 파일과 AKM이 세션 사이의 다리 `[V]`
- 실무 조언 3가지: 한 일은 한 창구에서, 같은 지시를 양쪽에 보내지 않기, 주제 바뀌면 `/new`

### 11. 마무리

```
/마무리
응 푸시해줘.
```

**Claude Code 작업:**
- 옵시디언 세션 정리 노트·데일리 노트 갱신 `[V]`
- 원격에 새 커밋이 있어 `pull --rebase` 후 푸시. 최종 해시 `be7234b`, `e6842ad` `[V]`

---

## 커밋 히스토리

| 날짜 | 커밋 | 설명 |
|------|------|------|
| 09/30 | `be7234b` | feat(openclaw): 농부 10명 OpenClaw 에이전트 설치·SOUL 동기화 스크립트 |
| 09/30 | `e6842ad` | feat(office): 웹 교무실을 OpenClaw 게이트웨이로 재배선 |

## 기술 스택

- **런타임**: OpenClaw 2026.9.6 (내장 Node 24), macOS LaunchAgent 상주
- **모델**: Claude Max 구독 → Claude CLI 재사용 방식, `anthropic/claude-opus-5`
- **채널**: Telegram(봇, polling), Slack(소켓 모드), 웹 교무실(게이트웨이 WS v4)
- **작업 도구**: Claude Code(Fable 5.1) + Claude in Chrome(브라우저 검증)

## 주요 기능

1. **캐릭터 10명 = 에이전트 10개**, 채널별 바인딩으로 슬랙 채널마다 다른 캐릭터가 응답
2. **성격 파일 단일 원본**: `souls/` 원본 → 워크스페이스 복사본 자동 동기화
3. **웹 교무실**: 브라우저에서 캐릭터를 클릭해 대화, 디바이스 페어링 자동 승인

## 남은 것 `[V]`
- 슬랙 DM은 첫 메시지 때 `openclaw pairing approve` 한 번 필요(아직 안 함)
- philo-blog 스킬이 필로에게 실제 로드되는지 미확인
- 헤르메스 프로필·데이터는 그대로 남아 있음(정리 시점 미정)

## 일러스트 팔레트 (기록)
- 2026-09-30 사례글: 딥 틸 그린 · 소프트 앰버 · 차콜 그레이 (스킬 기본 예시 그대로 사용). 다음 글에서는 다른 팔레트를 쓴다.
