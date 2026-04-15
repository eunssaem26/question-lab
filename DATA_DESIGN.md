# 질문연구소 데이터 설계 v2.0

> **최종 수정**: 2026-04-15
> **대상**: 질문연구소 6에이전트 시스템
> **연결 문서**: `AGENT_ARCHITECTURE.md` 섹션 8

---

## 1. 목적

이 문서는 질문연구소의 모든 데이터가 어디에 놓이고, 누가 읽고 쓰며, 어떤 흐름으로 이동하는지를 정의한다.

핵심 목표는 세 가지다.
- 데이터 소유권을 명확히 한다.
- 에이전트별 최소 권한 원칙을 강제한다.
- F단계 전송 패키지 시점에 현재 파일을 목표 구조로 안전하게 옮길 수 있도록 기준을 만든다.

---

## 2. 설계 원칙

| 원칙 | 설명 |
|------|------|
| **7개 최상위 데이터 디렉토리** | 데이터는 `knowledge/`, `diagnosis/`, `reading-lessons/`, `writing-lessons/`, `review/`, `student-hub/`, `runtime/` 아래에만 둔다. |
| **소유자 중심 쓰기 권한** | 특정 데이터는 해당 프로젝트 소유 에이전트만 쓴다. |
| **공유 지식과 운영 데이터 분리** | 교육과정·스키마 같은 정적 지식과 학생 결과 같은 런타임 데이터를 분리한다. |
| **최소 권한** | 필요한 데이터만 읽고, 가능한 한 좁은 범위에만 쓴다. |
| **학생 보호 우선** | 학생 식별 정보와 진단 원본 데이터는 제한적으로만 노출한다. |
| **핸드오프 친화 구조** | 진단 결과가 수업 설계와 학생 전달로 자연스럽게 이어지도록 폴더를 설계한다. |

---

## 3. 최상위 폴더 구조

질문연구소의 **데이터 영역**은 아래 7개 최상위 디렉토리로 구성한다.

```text
/
├── knowledge/
├── diagnosis/
├── reading-lessons/
├── writing-lessons/
├── review/
├── student-hub/
└── runtime/
```

참고:
- `agents/`, `scripts/`, `AGENT_ARCHITECTURE.md`, `DATA_DESIGN.md` 같은 파일과 폴더는 **시스템/운영 자산**이며, 위 7개 데이터 디렉토리와 별도로 관리한다.
- 이 문서에서 “데이터 구조”라고 할 때는 기본적으로 위 7개 디렉토리를 뜻한다.

---

## 4. 목표 구조 상세

```text
knowledge/
├── curriculum/
│   ├── reading-achievement-standards.json
│   ├── writing-achievement-standards.json
│   └── benchmark-analysis.md
└── schema/
    └── schema.json

diagnosis/
├── frameworks/
│   ├── reading-framework.json
│   ├── writing-framework.json
│   ├── 별쌤-평가준거틀.md
│   └── 글쓰기-평가준거틀.md
├── item-bank/
│   ├── reading/
│   │   └── level-{1..7}/
│   │       ├── passages.json
│   │       └── items.json
│   └── writing/
│       └── level-{1..7}/
│           ├── passages.json
│           ├── items.json
│           └── 검수-리포트.md
├── guides/
│   ├── 출제-가이드.md
│   ├── 글쓰기-출제-가이드.md
│   ├── 글쓰기-35셀-매핑표.md
│   ├── 글쓰기-35셀-청사진.md
│   └── 통합-검사-조립-규칙.md
└── scoring/

reading-lessons/
├── book-db/
├── curriculum/
├── activities/
└── teacher-guides/

writing-lessons/
├── prompts-db/
├── curriculum/
├── activities/
└── teacher-guides/

review/
├── reports/
└── checklists/

student-hub/
├── templates/
└── content-pool/

runtime/
├── students/
├── results/
├── history/
│   ├── reading-log/
│   └── writing-portfolio/
└── logs/
```

---

## 5. 데이터 3분류

### 5.1 정적 지식

운영 중 자주 바뀌지 않는 기준 데이터.

| 분류 | 위치 | 예시 |
|------|------|------|
| 교육과정 원문 | `knowledge/curriculum/` | 읽기/쓰기 성취기준 |
| 스키마 | `knowledge/schema/` | 문항 구조 계약 |
| 준거틀 | `diagnosis/frameworks/` | 읽기/글쓰기 단계 기준 |
| 출제 가이드 | `diagnosis/guides/` | 출제 규칙, 조립 규칙 |
| 검수 체크리스트 | `review/checklists/` | 프로젝트별 검수 기준 |

### 5.2 프로젝트 데이터

에이전트가 프로젝트 운영을 위해 만드는 설계 산출물.

| 분류 | 위치 | 주 생산자 |
|------|------|----------|
| 문항은행 | `diagnosis/item-bank/` | 별쌤 |
| 독서 수업 자료 | `reading-lessons/` | 책쌤 |
| 글쓰기 수업 자료 | `writing-lessons/` | 글쌤 |
| 검수 리포트 | `review/reports/` | 은쌤 |
| 학생 전달 템플릿/큐레이션 | `student-hub/` | 호기, 책쌤, 글쌤 |

### 5.3 런타임 데이터

학생 사용과 운영 과정에서 계속 생성되는 데이터.

| 분류 | 위치 | 예시 |
|------|------|------|
| 학생 프로필 | `runtime/students/` | 이름, 보호자 메모, 관심사 |
| 진단 결과 | `runtime/results/` | 읽기/글쓰기 진단 결과 |
| 학습 이력 | `runtime/history/` | 독서 로그, 글쓰기 포트폴리오 |
| 운영 로그 | `runtime/logs/` | 작업 기록, 이벤트 로그 |

---

## 6. 접근 권한 매트릭스

범례:
- `RW`: 읽기+쓰기
- `R`: 읽기 전용
- `R*`: 제한적 읽기
- `—`: 접근 불가

### 6.1 전체 매트릭스

| 데이터 영역 | 필로 | 별쌤 | 책쌤 | 글쌤 | 은쌤 | 호기 |
|------------|:----:|:----:|:----:|:----:|:----:|:----:|
| `knowledge/curriculum/` | R | R | R | R | R | — |
| `knowledge/schema/` | RW | R | — | — | R | — |
| `diagnosis/frameworks/` | R | RW | R | R | R | — |
| `diagnosis/item-bank/reading/` | R | RW | R* | — | R | — |
| `diagnosis/item-bank/writing/` | R | RW | — | R* | R | — |
| `diagnosis/guides/` | R | RW | R | R | R | — |
| `diagnosis/scoring/` | R | RW | — | — | R | — |
| `reading-lessons/` | R | — | RW | — | R | — |
| `writing-lessons/` | R | — | — | RW | R | — |
| `review/reports/` | R | R | R | R | RW | — |
| `review/checklists/` | R | R | R | R | RW | — |
| `student-hub/templates/` | R | — | — | — | — | RW |
| `student-hub/content-pool/` | R | — | RW | RW | — | R |
| `runtime/students/` | RW | R | R | R | — | R* |
| `runtime/results/` | RW | RW | R | R | R | R* |
| `runtime/history/reading-log/` | R | — | RW | — | — | — |
| `runtime/history/writing-portfolio/` | R | — | — | RW | — | — |
| `runtime/logs/` | RW | — | — | — | — | — |

### 6.2 `R*`의 의미

#### 책쌤의 `diagnosis/item-bank/reading/` 제한적 읽기
- 허용: 별쌤이 명시적으로 자문을 요청한 읽기 문항 또는 지문
- 금지: 전체 문항은행 탐색, 임의 수준 비교, 대량 열람

#### 글쌤의 `diagnosis/item-bank/writing/` 제한적 읽기
- 허용: 별쌤이 명시적으로 자문을 요청한 글쓰기 문항 또는 제시문
- 금지: 전체 문항은행 탐색, 임의 수준 비교, 대량 열람

#### 호기의 `runtime/students/`, `runtime/results/` 제한적 읽기
- 허용: 학생에게 안전하게 전달하는 데 필요한 요약 정보
- 금지: 원시 점수, 상세 판정 로직, 민감 메모, 개별 문항 응답

---

## 7. 호기의 제한적 읽기 상세

호기는 학생과 직접 맞닿는 에이전트이므로, 가장 좁은 범위의 런타임 정보만 읽는다.

### 7.1 `runtime/students/{student-id}.json`

| 필드 | 호기 읽기 가능 여부 | 설명 |
|------|------------------|------|
| `student_id` | 가능 | 내부 매칭용 |
| `display_name` | 가능 | 학생 호칭 |
| `grade_band` | 가능 | 설명 톤 조절용 |
| `interests` | 가능 | 책/글감 큐레이션용 |
| `preferred_topics` | 가능 | 학생 취향 반영용 |
| `encouragement_style` | 가능 | 메시지 톤 조절용 |
| `guardian_notes` | 불가 | 보호자 민감 메모 |
| `admin_notes` | 불가 | 운영 메모 |
| `school_name` | 불가 | 불필요한 식별 정보 |
| `contact_info` | 불가 | 개인정보 |

### 7.2 `runtime/results/{student-id}/...`

| 필드 | 호기 읽기 가능 여부 | 설명 |
|------|------------------|------|
| `session_date` | 가능 | 최근 결과 안내 |
| `reading_level_band` | 가능 | 범위형 전달 |
| `writing_level_band` | 가능 | 범위형 전달 |
| `strength_keywords` | 가능 | 긍정 메시지 생성 |
| `growth_message` | 가능 | 별쌤 메시지 재구성 |
| `recommended_next_action_summary` | 가능 | 전문가 연결 문장 생성 |
| `domain_labels` | 가능 | 쉬운 말로 바꾸기 위한 최소 정보 |
| `exact_level_numeric` | 불가 | 직접 판정 수치 노출 금지 |
| `raw_score` | 불가 | 원시 점수 비공개 |
| `weighted_score` | 불가 | 계산값 비공개 |
| `item_responses` | 불가 | 문항 응답 비공개 |
| `domain_subscores` | 불가 | 세부 분석 비공개 |
| `routing_trace` | 불가 | 내부 판정 로직 비공개 |
| `review_flags` | 불가 | 내부 운영용 |

원칙:
- 호기는 `정확한 수준 판정자`가 아니라 `학생 친화 전달자`다.
- 따라서 수치를 읽기보다 **요약 메시지와 강점 키워드**를 읽는다.

---

## 8. 데이터 흐름 3가지

### 8.1 흐름 A: 진단 → 수업 설계

```text
별쌤
  → runtime/results/ 에 읽기·글쓰기 결과 기록
필로
  → 결과를 중계하고 작업을 라우팅
책쌤
  → reading-lessons/ 에 독서 수업 설계 작성
글쌤
  → writing-lessons/ 에 글쓰기 수업 설계 작성
  → student-hub/content-pool/ 에 추천용 콘텐츠도 함께 적재
```

핵심 입력:
- 학생 ID
- 읽기/글쓰기 결과 요약
- 영역별 강약점
- 성장 경로 권고

핵심 출력:
- 맞춤 독서 수업안
- 맞춤 글쓰기 수업안
- 학생 전달용 추천 콘텐츠

### 8.2 흐름 B: 검수

```text
별쌤 / 책쌤 / 글쌤
  → 각 소유 폴더에 산출물 작성
필로
  → review/checklists/ 기준으로 은쌤에게 검수 요청
은쌤
  → 산출물 읽기
  → review/reports/ 에 검수 리포트 작성
원 생산자
  → 리포트 반영 후 자신의 폴더에서 수정
```

원칙:
- 은쌤은 판단하고 기록하지만, 원본 산출물을 직접 수정하지 않는다.
- 수정 책임은 항상 원 생산자에게 있다.

### 8.3 흐름 C: 콘텐츠 풀 → 학생 전달

```text
책쌤 / 글쌤
  → student-hub/content-pool/ 에 책/글감 후보 적재
호기
  → content-pool + 제한적 student/result 정보 읽기
  → 학생 맞춤형 안내 메시지 생성
```

원칙:
- 호기는 콘텐츠를 새로 설계하지 않는다.
- 호기는 기존 전문가 산출물을 학생 언어로 번역해 전달한다.

---

## 9. 현재 → 목표 파일 매핑표

이 표는 **F단계 전송 패키지 실행 시** 현재 저장 위치를 목표 구조로 옮길 때 사용한다.

| 현재 위치 | 목표 위치 | 비고 |
|----------|----------|------|
| `reference/` | `knowledge/` | 교육과정 원문, 스키마, 벤치마크 자료 분리 이동 |
| `item-bank/출제-가이드.md` | `diagnosis/guides/출제-가이드.md` | 읽기 출제 가이드 |
| `item-bank/글쓰기-출제-가이드.md` | `diagnosis/guides/글쓰기-출제-가이드.md` | 글쓰기 출제 가이드 |
| `item-bank/통합-검사-조립-규칙.md` | `diagnosis/guides/통합-검사-조립-규칙.md` | 검사 조립 규칙 |
| `item-bank/passages.json` | `diagnosis/item-bank/reading/legacy/passages.json` 또는 단계별 분해 | 현재 구조 확인 후 분리 |
| `item-bank/items.json` | `diagnosis/item-bank/reading/legacy/items.json` 또는 단계별 분해 | 현재 구조 확인 후 분리 |
| `item-bank/level-2/` | `diagnosis/item-bank/reading/level-2/` | 읽기 단계별 문항 |
| `item-bank/writing/level-1/` | `diagnosis/item-bank/writing/level-1/` | 글쓰기 단계별 문항 |
| 루트의 `AGENT_ARCHITECTURE.md` | 유지 | 시스템 문서, 데이터 디렉토리 밖 |
| 루트의 `DATA_DESIGN.md` | 유지 | 시스템 문서, 데이터 디렉토리 밖 |
| `agents/*.md` | 유지 | 시스템 프롬프트, 데이터 디렉토리 밖 |

### 9.1 F단계 전송 패키지 실행 순서

1. `reference/` 내용을 `knowledge/` 하위 규격으로 재배치한다.
2. `item-bank/`의 가이드 문서를 `diagnosis/guides/`로 이동한다.
3. 읽기/글쓰기 문항 파일을 `diagnosis/item-bank/reading|writing/`으로 분리한다.
4. 기존 루트 `item-bank/`는 전송 완료 후 아카이브하거나 제거한다.
5. 매핑 완료 뒤 `AGENT_ARCHITECTURE.md`와 에이전트 프롬프트의 경로 참조를 점검한다.

---

## 10. 운영 규칙

### 10.1 쓰기 권한 규칙
- 별쌤은 `diagnosis/`만 쓴다.
- 책쌤은 `reading-lessons/`와 `student-hub/content-pool/`의 도서 추천 영역만 쓴다.
- 글쌤은 `writing-lessons/`와 `student-hub/content-pool/`의 글감 추천 영역만 쓴다.
- 은쌤은 `review/`만 쓴다.
- 호기는 `student-hub/templates/`만 직접 쓴다.
- 필로는 시스템 운영과 런타임 관리에 필요한 영역만 쓴다.

### 10.2 교차 프로젝트 수정 규칙
- 다른 에이전트 소유 폴더는 읽을 수 있어도 임의로 수정하지 않는다.
- 교차 수정이 필요하면 필로를 통해 작업 요청을 보낸다.

### 10.3 학생 데이터 보호 규칙
- 학생 식별 정보는 `runtime/` 밖으로 복사하지 않는다.
- 학생 개별 결과를 검수 리포트나 가이드 문서에 원문 그대로 재기록하지 않는다.
- 호기에게 전달되는 데이터는 항상 요약본 또는 안전 필드만 사용한다.

---

## 11. 체크포인트

이 설계가 적용되면 아래 조건이 충족되어야 한다.

- 데이터는 7개 최상위 디렉토리 기준으로 설명할 수 있다.
- 각 데이터 영역은 6에이전트 권한 매트릭스로 설명할 수 있다.
- 호기의 제한적 읽기 범위가 필드 수준에서 명시되어 있다.
- 진단, 검수, 학생 전달 흐름이 서로 섞이지 않는다.
- F단계 전송 패키지에서 현재 파일을 목표 구조로 옮길 수 있다.
