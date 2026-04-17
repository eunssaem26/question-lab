# 1단계 Claude API 호출 가이드

## 목표

이 문서는 **1단계 AI 피드백 프롬프트를 Claude API로 검증할 때 사용할 호출 템플릿과 출력 스키마**를 정리한 문서입니다.

핵심 원칙:

- 출력은 반드시 JSON
- 설명형 문장보다 **판정 근거를 구조화**
- 웹서비스에서 그대로 표시 가능한 필드로 설계
- 채점과 친절한 피드백을 동시에 만족

---

## 권장 출력 필드

```json
{
  "lesson_id": "01",
  "pass": true,
  "result_label": "합격",
  "score": null,
  "failed_criteria": [],
  "strengths": [
    {
      "sentence_index": 2,
      "text": "나는 쉬는 시간에 친구와 공놀이를 했다.",
      "reason": "주어와 서술어가 분명하고, 무슨 일을 했는지 잘 드러납니다."
    }
  ],
  "improvements": [
    {
      "criterion_id": "C1",
      "sentence_index": 1,
      "original": "아침에 학교에 갔다.",
      "problem": "주어가 빠져 있습니다.",
      "suggestion": "나는 아침에 학교에 갔다."
    }
  ],
  "one_tip": "주어가 빠진 문장부터 먼저 고쳐보세요.",
  "teacher_handoff_needed": false,
  "teacher_handoff_reason": null
}
```

---

## 필드 설명

| 필드 | 설명 |
|------|------|
| `lesson_id` | 차시 번호 |
| `pass` | 합격 여부 (`true` / `false`) |
| `result_label` | 사용자에게 보여줄 문구 (`합격`, `아직 조금 더 다듬어봐요`) |
| `score` | 루브릭 점수. 차시 12만 숫자, 그 외는 `null` |
| `failed_criteria` | 실패한 기준 목록 |
| `strengths` | 잘한 점 1~2개 |
| `improvements` | 가장 먼저 고쳐야 할 점 1~3개 |
| `one_tip` | 지금 당장 고칠 한 가지 |
| `teacher_handoff_needed` | 은쌤 상담이나 수동 검토 필요 여부 |
| `teacher_handoff_reason` | AI 판단 불가일 때 사유 |

---

## `failed_criteria` 권장 구조

**실패한 기준만** 이 배열에 포함합니다. 합격한 기준은 넣지 않습니다.

```json
[
  {
    "criterion_id": "C1",
    "criterion_text": "각 문장에 주어가 명시적으로 있는가",
    "evidence_sentence_indexes": [1, 3]
  }
]
```

설계 원칙:

- 웹에서 체크리스트처럼 렌더링하기 쉽게 한다
- 어떤 기준이 왜 실패했는지 바로 추적할 수 있게 한다
- 문장 번호를 같이 주어 재수정 UX를 쉽게 만든다
- `improvements[].criterion_id`는 반드시 이 배열의 `criterion_id`와 동일한 값을 사용해야 한다
- 모든 기준을 통과하면 빈 배열(`[]`)로 반환한다

---

## 차시 12용 `score` 구조

차시 12는 총점과 항목별 점수를 분리해서 받는 것이 좋습니다.

```json
{
  "total": 11,
  "breakdown": {
    "fluency": 3,
    "structure": 2,
    "content": 1,
    "expression": 1,
    "conventions": 4
  }
}
```

웹서비스 표시 문구 예시:

- 유창성 3점
- 구조 2점
- 내용 1점
- 어휘/표현 1점
- 관례 4점
- 총점 11점

---

## 시스템 프롬프트 템플릿

아래는 Claude API의 system prompt 초안입니다.

```text
당신은 초등학생 글쓰기를 도와주는 한국어 글쓰기 코치입니다.

반드시 아래 규칙을 지키세요.

[역할]
- 학생이 제출한 글을 해당 차시 기준으로만 평가합니다.
- 초등 3학년이 이해할 수 있는 쉬운 말로 피드백합니다.
- 칭찬 먼저, 개선점 나중 순서로 판단합니다.

[중요 규칙]
- 해당 차시에서 배우지 않은 기준으로 평가하지 마세요.
- 문제가 있는 문장은 반드시 문장 번호로 지목하세요.
- 문제를 지적할 때는 반드시 더 나은 수정 예시 문장을 직접 제시하세요.
- 출력은 반드시 JSON 하나만 반환하세요.
- JSON 바깥의 설명 문장은 절대 쓰지 마세요.
- 마크다운 코드 블록(```)을 사용하지 마세요. 순수 JSON 텍스트만 반환하세요.
- 입력 글이 너무 짧거나 형식이 심하게 깨져도 가능한 범위에서 판단하고,
  정말 판단이 불가능할 때만 teacher_handoff_needed=true로 표시하세요.

[판정 원칙]
- pass=true 이면 result_label은 "합격"
- pass=false 이면 result_label은 "아직 조금 더 다듬어봐요"
- 차시 12가 아니면 score는 null
- 가장 중요한 개선점부터 최대 3개까지만 제시하세요.
- strengths는 1~2개, improvements는 1~3개만 제시하세요.
- strengths에서 진짜 칭찬할 것이 없으면 빈 배열([])로 두세요. 억지로 만들지 마세요.
- improvements의 criterion_id는 반드시 failed_criteria의 criterion_id와 같은 값을 사용하세요.

[문장 번호 규칙]
- 학생 글의 줄바꿈 기준으로 문장 번호를 셉니다.
- 한 줄에 문장이 2개 이상이면 문장 부호 기준으로 나눕니다.

[스타일]
- 친절하지만 모호하지 않게 말하세요.
- "더 잘 써봐요" 같은 추상적 표현을 쓰지 마세요.
- 수정 예시는 원래 문장보다 너무 어렵지 않게 쓰세요.
```

---

## 사용자 프롬프트 템플릿

아래는 매 호출 때 넣는 user prompt 템플릿입니다.

```text
[차시 정보]
lesson_id: {{lesson_id}}
lesson_title: {{lesson_title}}

[수업 내용]
{{lesson_summary}}

[과제]
{{assignment}}

[채점 기준]
{{criteria_list}}

[합격 기준]
{{pass_rule}}

[아직 평가 안 함]
{{not_evaluated_list}}

[학생 글]
{{student_text}}

[반환 형식]
다음 JSON 스키마를 정확히 지켜서 답하세요.

{
  "lesson_id": "string",
  "pass": true,
  "result_label": "합격 또는 아직 조금 더 다듬어봐요",
  "score": null,
  "failed_criteria": [
    {
      "criterion_id": "string",
      "criterion_text": "string",
      "evidence_sentence_indexes": [1]
    }
  ],
  "strengths": [
    {
      "sentence_index": 1,
      "text": "string",
      "reason": "string"
    }
  ],
  "improvements": [
    {
      "criterion_id": "string",
      "sentence_index": 1,
      "original": "string",
      "problem": "string",
      "suggestion": "string"
    }
  ],
  "one_tip": "string",
  "teacher_handoff_needed": false,
  "teacher_handoff_reason": null
}
```

---

## 차시 12 전용 사용자 프롬프트 차이

차시 12는 `score`를 `null`로 두지 말고 아래 구조로 받습니다.

```json
"score": {
  "total": 0,
  "breakdown": {
    "fluency": 0,
    "structure": 0,
    "content": 0,
    "expression": 0,
    "conventions": 0
  }
}
```

추가 규칙:

- 총점은 항목별 점수 합과 반드시 같아야 함
- 14점 이상이면 `pass=true`
- 13점 이하이면 `pass=false`
- 개선점은 점수가 낮은 항목부터 우선 제시

---

## API 테스트용 권장 설정

정확한 수치는 운영 환경에 맞게 조정하면 되지만, 첫 검증은 아래처럼 시작하는 것을 권장합니다.

```text
temperature: 0.2
top_p: 0.9
max_tokens: 충분히 넉넉하게
```

이유:

- 채점은 창의성보다 일관성이 중요함
- temperature가 높으면 합격/불합격 판정이 흔들릴 수 있음

---

## 반복 호출 검증 방법

같은 입력을 3번 호출해서 아래를 비교합니다.

1. `pass` 값이 같은가
2. `failed_criteria`가 비슷한가
3. `improvements`의 우선순위가 크게 흔들리지 않는가
4. 차시 12라면 `score.total`이 크게 흔들리지 않는가

권장 합격선:

- 케이스 1, 3은 3회 중 3회 합격
- 케이스 2, 4, 6은 3회 중 3회 불합격
- 케이스 5는 경계 사례이므로 흔들릴 수 있으나, 흔들리면 프롬프트 보정 대상으로 기록

---

## 운영 전 꼭 보정할 규칙

실전에서 자주 흔들리는 항목은 아예 문장으로 박아두는 편이 좋습니다.

### 보정 규칙 1. 직접 표현과 간접 표현 구분

```text
직접 감정 표현이 일부 포함되어 있어도, 몸의 반응이나 행동으로 드러난 감정 표현이 1개 이상 있으면
"간접 표현이 있다" 기준은 충족으로 판단하세요.
```

### 보정 규칙 2. 차시 외 평가 금지

```text
학생 글에 다른 아쉬운 점이 보여도, 이번 차시 채점 기준에 없는 항목은 불합격 사유로 사용하지 마세요.
```

### 보정 규칙 3. 수정 예시 난이도 제한

```text
수정 예시 문장은 학생 원문보다 지나치게 길거나 어려워지지 않게 쓰세요.
```

### 보정 규칙 4. 자연 현상 문장의 주어 인정

```text
"비가 왔다", "바람이 불었다", "눈이 내렸다"처럼 자연 현상을 묘사하는 문장은
"비가", "바람이", "눈이"가 주어입니다. 주어 없음으로 처리하지 마세요.
주어 명시 규칙은 사람이나 동물이 행위자인 문장에 적용합니다.
```

이 규칙을 추가하지 않으면 일기의 첫 문장 "오늘은 비가 많이 왔다." 같은 자연스러운 날씨 묘사를
주어 없음으로 오판해 경계 케이스에서 불합격을 내는 문제가 발생합니다.

---

## 웹서비스 연동 팁

- `failed_criteria`는 체크리스트 UI로 바로 보여주기 좋음
- `improvements[].sentence_index`로 학생 글 하이라이트 가능
- `one_tip`은 수정 화면 상단 고정 배너에 적합
- `teacher_handoff_needed`는 은쌤 상담 버튼 조건과 연결하기 좋음

---

## 추천 다음 단계

1. 이 가이드로 케이스 6개를 실제 Claude API에 3회씩 호출한다
2. 흔들린 항목만 모아 공통 프롬프트를 1차 보정한다
3. 보정이 끝나면 같은 JSON 구조를 유지한 채 2단계 프롬프트를 설계한다
