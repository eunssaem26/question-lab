# Failure Registry

검수 과정에서 발견된 실패 패턴 누적 로그. 새 배치는 이 리스트에 자동/에이전트 대조.

## 사용 규칙

- 새 실패 발견 → 하단 Template으로 `## Active Failures` 섹션에 추가 (삭제 금지)
- 매 배치 검수 시 `check_method: automated`는 스크립트로, `agent`는 에이전트 프롬프트에 주입
- 3개월 이상 재발 없는 항목은 `## Resolved` 섹션으로 이동 (재발 추적용 히스토리 유지)
- 트리거 조건이 비어 있으면(`확인 필요`) 자동 체크 연결이 안 됨 → 실제 재현 케이스를 놓고 조건 역추적이 우선 과제
- 신뢰도 표기: `code-confirmed`(코드상 버그 명확) / `hypothesized`(가설, 시각 확인 필요)

---

## Active Failures

### FR-0001: 지문이 학생 시야에서 de-emphasize 되어 "안 보임"

- **발견일**: 2026-04-23
- **트랙**: 진단평가
- **카테고리**: 렌더링 / 시각 위계
- **신뢰도**: `hypothesized` (코드상 실제 숨겨짐 없음. 지각적 원인 가설)
- **증상**: 지문이 렌더링은 되지만 학생이 지문을 못 알아보거나 놓침
- **트리거 조건** (컴포넌트 자체의 구조적 문제 — 모든 `passage_text` 포함 문항에 적용):
  - 지문 본문 `text-sm` (14px) — 문항 본문 `text-base`(16px)보다 작음
  - 라벨 "📄 지문" `text-xs` (12px) — 존재감 약함
  - 배경 `bg-amber-50` + 텍스트 `text-gray-800` — 대비 낮음
  - 결과: 지문이 decoration/보조 요소처럼 보여 학생이 읽지 않고 문항으로 건너뜀
- **관련 파일**: `app/diagnosis/session/[sessionId]/page.tsx:194-201`
- **체크 방법**: `manual` — 현재는 시각 확인 필요. 수정 후에는 `agent` (학생쌤이 "지문을 읽기 전에 놓치고 문항으로 갈 것 같나?" 체크)
- **Fix 방향**:
  - 지문 본문 `text-base` 이상
  - 라벨 `text-sm font-semibold` + 지문 시작 표시 강화
  - 배경/테두리 대비 강화 (예: `bg-amber-100 border-2 border-amber-300`)
- **상태**: active

### FR-0002: `_xxx_` 마크다운 밑줄이 렌더링에서 소실되거나 언더스코어가 리터럴로 남음

- **발견일**: 2026-04-23
- **시각 확인일**: 2026-04-23 (스크린샷, 경로 C 케이스)
- **트랙**: 진단평가
- **카테고리**: 렌더링 / 데이터 이중 마크업
- **신뢰도**: `code-confirmed + visual-confirmed`
- **증상**: 원본 콘텐츠의 `_xxx_` 밑줄 마크업이 리터럴 `_xxx_`로 표시되거나 언더스코어만 사라짐. 특히 `target_word`가 설정된 문항에서는 targetWord는 `<u>`로 밑줄 쳐지는데 양옆의 `_` 문자가 남아서 "밑줄 이상하게 나옴"으로 보임.
- **실제 관찰 사례** (2026-04-23):
  ```
  표시: "기후 변화는 _<u>뭔가 이상한 날씨를 만드는 것</u>_입니다. ..."
  의도: "기후 변화는 <u>뭔가 이상한 날씨를 만드는 것</u>입니다. ..."
  ```
  → 콘텐츠 데이터에 `target_word` 필드와 content의 `_xxx_` 마크다운이 **중복**으로 들어가 있음.

- **트리거 조건** — 다음 **셋 중 하나라도** 해당하면 발생:

  | 경로 | 조건 | 파일:줄 |
  |---|---|---|
  | A | `passage_text`에 `_xxx_` 포함 | `app/diagnosis/session/[sessionId]/page.tsx:197-199` (raw render) |
  | B | 문항의 `target_word`가 설정되어 있고 `content`의 `\n\n` **앞부분**에 `_xxx_` 포함 | `page.tsx:50` |
  | C | 문항의 `target_word`가 설정되어 있고 `content`의 `\n\n` **뒷부분**에 `_xxx_` 포함 | `page.tsx:51-55` |
  | D (데이터) | `target_word` non-null AND content에 `_target_word_` 마크다운 중복 존재 | 아이템 뱅크 데이터 레벨 |

  (정상 경로: `target_word`가 null이고 `content`에 `_xxx_` 포함 → `renderMarkdownUnderline` 호출됨 → 정상)

- **체크 방법**: `automated` — 아이템 뱅크에서 regex 스캔:
  - `passage_text` 필드에 `_[^_\n]+_` 매치 → 경로 A 플래그
  - `target_word` non-null AND `content` 필드에 `_[^_\n]+_` 매치 → 경로 B/C 플래그
  - `target_word` non-null AND `content` 필드에 `_${target_word}_` 리터럴 매치 → 경로 D 플래그 (이중 마크업)

- **Fix 방향** (2-layer):
  1. **데이터 정책** (근본): 아이템 뱅크의 content에서 `target_word`와 중복되는 `_xxx_` 마크다운 제거. 앞으로는 "`target_word` 있으면 content에 `_xxx_` 금지" 정책 명문화.
  2. **렌더러 방어** (안전망): `passage_text` 렌더링과 `targetWord` 분기(`page.tsx:34-57`)에도 `renderMarkdownUnderline()` 적용. 그리고 targetWord 경로에서 before/after에 남은 밑줄 마커 `_`를 정규화(strip)하는 로직 추가.

- **현재 상태 (2026-04-23 기준)**:
  - 데이터 스캔 결과: Path A/B/C/D 모두 **현재 트리거 데이터 0건** (passages에 `_xxx_` 없음, VOC 아이템에 `_xxx_` 없음, target_word·markdown 중복 없음)
  - 오늘 커밋 `7519875` — `!targetWord` 경로에 `renderMarkdownUnderline` 적용 (비-VOC 6개 아이템 해당, 스크린샷 케이스 W-4-EXP-002 포함)
  - 후속 커밋(대기 중) — `passage_text`, `questionPart`, `before`, `after` 4곳에 방어적 `renderMarkdownUnderline` 적용 완료.
  - **파생 이슈 발견 (2026-04-23 저녁, R-7-CRT-005 debug 세션)**: `<u>` HTML 네이티브 밑줄 + Tailwind `decoration-*` 유틸이 간섭해 긴 검은 줄이 추가로 렌더되는 현상. `<u>` → `<span>`으로 전환 (같은 Tailwind 클래스 유지). 네이티브 요소의 기본 text-decoration이 유틸과 다른 오프셋에 그려지는 것이 원인으로 추정.
  - 파생 이슈 수정 완료, 타입체크 통과, **브라우저 UI 시각 확인 완료 (2026-04-23 저녁)**.
- **상태**: **code-fix verified (monitoring)** — 3개월 재발 없으면 Resolved로 이동

**Lessons**:
- HTML 시맨틱 요소(`<u>`, `<b>`, `<i>` 등) + Tailwind decoration/weight 유틸의 조합은 브라우저 기본 스타일과 간섭 가능. 순수 시각 용도라면 `<span>`을 쓰는 편이 예측 가능.

---

### FR-0004: 언더스코어 밑줄 convention 불일치로 partial 렌더링 (싱글/더블/트리플 혼재)

- **발견일**: 2026-04-23 (FR-0002 검증 중 연쇄 발견)
- **트랙**: 진단평가
- **카테고리**: 렌더링 / 데이터 convention 불일치
- **신뢰도**: `code-confirmed + visual-confirmed`
- **증상**: 콘텐츠에 혼재된 여러 convention 중 regex가 지원하지 않는 패턴은 안쪽 `_X_`만 매칭돼, 양옆의 `_` 또는 `__`가 리터럴 문자로 남음. 작은 폰트 크기에서 언더스코어가 baseline 근처 가로선처럼 보여 "긴 검은 줄" 또는 "이상한 점"으로 체감됨.

- **데이터 스캔 결과** (2026-04-23 기준):
  - 싱글 `_X_`: 2건 (W-4-EXP-002 "뭔가 이상한 날씨를 만드는 것", W-6-CVN-005 "되어지지")
  - 더블 `__X__`: 1건 (W-1-REV-001 "조아합니다")
  - 트리플 `___X___`: 3건 (R-7-CRT-005 "그러므로", W-5-CVN-001, W-5-REV-004)
  - 총 6건, 세 가지 convention이 뒤섞임

- **근본 원인**: 출제자 간 밑줄 convention 불통일. 별쌤/책쌤/글쌤이 각기 다른 관습으로 마크업.

- **트리거 조건**:
  - 콘텐츠 필드에 `_{1,3}[^_\n]+_{1,3}` 패턴 포함
  - 빈칸 플레이스홀더(`___`, `______` 내용 없음)와는 구분 — 내부 content 있을 때만 트리거

- **체크 방법**: `automated` — `grep -E '_{1,3}[^_\n]+_{1,3}'` on item bank items.json 필드

- **Fix 방향** (2-layer):
  1. **렌더러** (완료, 2단계): 1차는 `___X___`만 추가 처리. 2차에서 `__X__`까지 포함해 1~3개 모두 동일 처리. Regex: `/(___[^_\n]+___|__[^_\n]+__|_[^_\n]+_)/g`. 빈칸 marker는 자동 보존.
  2. **데이터 convention** (권장): 향후 출제 가이드에 **밑줄은 싱글 `_X_`로 통일**, 빈칸은 `______` 전용 명시. 기존 6건도 점진적으로 싱글로 통일 바람직.

- **Lessons**:
  - 데이터 convention 불통일은 렌더러 연쇄 수정을 초래. 3회에 걸친 수정 (single→add triple→add double→add boundary constraint) 후에야 해결. 매 단계마다 부분 스캔이 false signal을 낳음.
  - **핵심 교훈**: emphasis(`_X_` 류)와 blank(`_____` 류)를 **처음부터 분리해서 스캔/설계**했어야 했다. 내가 `___X___` regex로 스캔했더니 `_____ X _____`(빈칸 두 개 사이 텍스트)가 false positive로 잡혔고, 이걸 "트리플 convention"으로 착각해 regex 확장 → 오히려 렌더 품질 악화. 데이터 분류(emphasis vs blank)를 선결했다면 한 번에 정리 가능.
  - **부실 스캔 → 부실 가설 → 부실 수정**의 체인이 파이프라인 내부에서도 그대로 발생함. 외부 검수와 동일한 실패 패턴(가설 수렴 없이 반복). 스캔은 **한 번에 철저히**가 실제로 더 싼 전략.
  - 경계 제약(`(?<!_)...(?!_)`)은 단순 alternation(긴 것부터)보다 훨씬 견고. 패턴이 서로 섞일 수 있는 도메인에서는 alternation만 쓰지 말기.

- **최종 데이터 분포** (2026-04-23 기준, 정확한 재스캔):
  - Emphasis: 5건 — R-7-CRT-005(트리플), W-1-REV-001(더블), W-4-EXP-002(싱글), W-5-REV-004(트리플), W-6-CVN-005(싱글)
  - Blank only: 9건 — R-3-INF-005, R-6-STR-005, W-1-ORG-001, W-2-ORG-001~003, W-4-CVN-005, W-5-CVN-001(빈칸 2개), W-6-ORG-003

- **상태**: **code-fix verified (monitoring)** — 브라우저 시각 확인 완료 (2026-04-23 저녁, emphasis 5건 + blank 1건 모두 정상). 3개월 재발 없으면 Resolved로 이동.

### FR-0003: 지문과 문항이 시각적으로 붙어 보여 "겹친" 것처럼 느껴짐

- **발견일**: 2026-04-23
- **트랙**: 진단평가
- **카테고리**: 레이아웃 / 시각 흐름
- **신뢰도**: `hypothesized` (DOM 실제 overlap 없음. 지각적 원인 가설)
- **증상**: 지문 카드 끝과 문항 카드 시작이 시각적으로 붙어 보이거나 경계가 모호
- **트리거 조건** (모든 `passage_text` 포함 문항에 적용되는 구조적 문제):
  - 지문 카드 `mb-4` (16px)만으로 문항 카드와 구분
  - 텍스트 크기가 지문 `text-sm` → 문항 `text-base`로 커지면서 시각 흐름이 연결됨
  - 두 카드 모두 `rounded-2xl` 둥근 모서리 + 부드러운 배경 → 명확한 분리 신호 부족
  - 모바일(≤ 640px)에서 특히 두드러질 가능성 높음
- **관련 파일**:
  - 지문 카드: `app/diagnosis/session/[sessionId]/page.tsx:195`
  - 문항 카드: `app/diagnosis/session/[sessionId]/page.tsx:203`
- **체크 방법**: `manual` — 현재는 시각 확인 필요. 수정 후에는 `agent` (학생쌤이 "지문 끝이 어딘지 명확한가?" 체크)
- **Fix 방향**:
  - 간격 `mb-6` 또는 `mb-8`
  - 또는 두 카드 사이 명시적 구분 요소 (divider, 다른 배경 톤)
  - 지문 카드에 `shadow-sm` 추가로 입체감 부여
- **상태**: active

---

## Template (새 항목 추가 시 복사)

### FR-XXXX: [한 줄 증상 요약]

- **발견일**: YYYY-MM-DD
- **트랙**: 진단평가 / 독서 N단계 / 글쓰기 N단계
- **카테고리**: 렌더링 / 레이아웃 / 콘텐츠 / 구조 / 접근성 / 일관성
- **신뢰도**: `code-confirmed` / `hypothesized`
- **증상**: [무엇이 어떻게 깨지는지 — 관찰 가능한 사실]
- **트리거 조건**: [언제 발생하는지 — 가능한 한 기계적으로 체크 가능하게]
- **관련 파일**: `path/to/file.ext:line`
- **체크 방법**: `automated` (스크립트 설명) / `agent` (프롬프트에 주입할 문장) / `manual`
- **Fix 방향**: (가능한 해결 방향)
- **상태**: active / resolved

---

## Resolved

(재발 3개월 이상 없으면 이쪽으로 이동. 삭제 금지 — 재발 추적 목적)
