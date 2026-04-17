#!/usr/bin/env python3
"""
2단계 AI 피드백 프롬프트 테스트 러너

비용 절감:
- 프롬프트 캐싱: 시스템 프롬프트 cache_control 적용
- 모델 분기: 차시01~06 → Haiku, 차시07~ → Sonnet
- max_tokens 제한: 차시별 상한 설정
"""

import os
import json
import anthropic

# ─────────────────────────────────────────────
# 시스템 프롬프트 (1단계와 동일 기반, 단락 평가 규칙 추가)
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """당신은 초등학생 글쓰기를 도와주는 한국어 글쓰기 코치입니다.

반드시 아래 규칙을 지키세요.

[역할]
- 학생이 제출한 글을 해당 차시 기준으로만 평가합니다.
- 초등 3~4학년이 이해할 수 있는 쉬운 말로 피드백합니다.
- 칭찬 먼저, 개선점 나중 순서로 판단합니다.
- 개선점을 지적할 때는 반드시 수정 예시 문장을 직접 제시합니다.

[중요 규칙]
- 해당 차시에서 배우지 않은 기준으로 평가하지 마세요.
- 문제가 있는 문장은 반드시 위치로 지목하세요 (예: "첫 번째 뒷받침 문장", "마무리 문장").
- 출력은 반드시 JSON 하나만 반환하세요.
- JSON 바깥의 설명 문장은 절대 쓰지 마세요.
- 마크다운 코드 블록(```)을 사용하지 마세요. 순수 JSON 텍스트만 반환하세요.
- 입력 글이 판단 불가 수준이면 teacher_handoff_needed=true로 표시하세요.

[주어 규칙]
- 주어가 없는 문장은 한국어에서 자연스럽더라도 C 실패로 처리하세요.
  단, "비가 왔다", "바람이 불었다"처럼 자연 현상 문장은 "비가", "바람이"가 주어이므로 실패 처리하지 마세요.
  주어 명시 규칙은 사람이나 동물이 행위자인 문장에 적용합니다.

[판정 원칙]
- pass=true 이면 result_label은 "합격"
- pass=false 이면 result_label은 "아직 조금 더 다듬어봐요"
- 차시 12가 아니면 score는 null
- 가장 중요한 개선점부터 최대 3개까지만 제시하세요.
- strengths는 1~2개, improvements는 1~3개만 제시하세요.
- strengths에서 진짜 칭찬할 것이 없으면 빈 배열([])로 두세요.
- improvements의 criterion_id는 반드시 failed_criteria의 criterion_id와 같은 값을 사용하세요.

[단락 평가 원칙]
- 중심 문장은 단락의 첫 번째 문장이어야 합니다.
- 뒷받침 문장은 중심 문장과 내용이 연결되어야 합니다.
- 마무리 문장이 중심 문장을 그대로 반복하면 C 실패로 처리하세요.
- 접속어는 두 단락의 관계(같은 방향/반대 방향/결과)에 맞아야 합니다.

[문장 번호 규칙]
- 빈 줄로 구분된 단락을 기준으로 구조를 파악합니다.
- 각 단락 안에서 줄 순서로 문장 번호를 셉니다.

[스타일]
- 친절하지만 모호하지 않게 말하세요.
- "더 잘 써봐요" 같은 추상적 표현을 쓰지 마세요.
- 수정 예시는 원래 문장보다 너무 어렵지 않게 쓰세요."""

# ─────────────────────────────────────────────
# JSON 반환 스키마
# ─────────────────────────────────────────────
JSON_SCHEMA_COMMON = """{
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
}"""

JSON_SCHEMA_L12 = """{
  "lesson_id": "12",
  "pass": true,
  "result_label": "합격 또는 아직 조금 더 다듬어봐요",
  "score": {
    "total": 0,
    "breakdown": {
      "topic_sentence": 0,
      "supporting": 0,
      "closing": 0,
      "coherence": 0,
      "connectives": 0
    }
  },
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
}"""

# ─────────────────────────────────────────────
# 테스트 케이스 6개
# ─────────────────────────────────────────────
TEST_CASES = [
    {
        "case_num": 1,
        "title": "차시02 명확한 합격",
        "lesson_id": "02",
        "lesson_title": "뒷받침 문장 — 예시와 이유",
        "lesson_summary": "예시 뒷받침('예를 들어'), 이유 뒷받침('왜냐하면'). 뒷받침은 중심 문장과 연결되어야 함.",
        "assignment": "내 친구(또는 가족)를 소개하는 단락 (중심 문장 1개 + 예시 또는 이유 뒷받침 3개)",
        "criteria": "C1: 중심 문장이 첫 번째 문장인가\nC2: 뒷받침 문장이 3개 있는가\nC3: 각 뒷받침 문장이 중심 문장과 연결되는가 (무관한 내용이 아닌가)\nC4: 예시 또는 이유 뒷받침 방법이 사용되었는가\nC5: 모든 문장에 주어와 서술어가 있는가",
        "pass_rule": "C1·C2·C3·C4·C5 모두 충족",
        "not_evaluated": "마무리 문장, 뒷받침 방법 혼합 여부, 맞춤법",
        "student_text": "나는 우리 형이 정말 멋지다고 생각한다.\n왜냐하면 형은 무슨 일이든 포기하지 않기 때문이다.\n예를 들어 형은 수영을 배울 때 3개월 동안 매일 연습했다.\n또 형은 나에게 모르는 것을 물어보면 항상 친절하게 알려준다.",
        "expected_pass": True,
        "expected_handoff": False,
    },
    {
        "case_num": 2,
        "title": "차시02 명확한 불합격 — 뒷받침이 중심 문장과 무관",
        "lesson_id": "02",
        "lesson_title": "뒷받침 문장 — 예시와 이유",
        "lesson_summary": "예시 뒷받침('예를 들어'), 이유 뒷받침('왜냐하면'). 뒷받침은 중심 문장과 연결되어야 함.",
        "assignment": "내 친구(또는 가족)를 소개하는 단락 (중심 문장 1개 + 예시 또는 이유 뒷받침 3개)",
        "criteria": "C1: 중심 문장이 첫 번째 문장인가\nC2: 뒷받침 문장이 3개 있는가\nC3: 각 뒷받침 문장이 중심 문장과 연결되는가 (무관한 내용이 아닌가)\nC4: 예시 또는 이유 뒷받침 방법이 사용되었는가\nC5: 모든 문장에 주어와 서술어가 있는가",
        "pass_rule": "C1·C2·C3·C4·C5 모두 충족",
        "not_evaluated": "마무리 문장, 뒷받침 방법 혼합 여부, 맞춤법",
        "student_text": "나는 내 친구 민준이가 재미있다고 생각한다.\n왜냐하면 민준이는 항상 웃기 때문이다.\n민준이는 키가 나보다 크다.\n민준이는 어제 떡볶이를 먹었다.",
        "expected_pass": False,
        "expected_handoff": False,
    },
    {
        "case_num": 3,
        "title": "차시06 아슬아슬한 합격 — 마무리 문장이 약함 (경계)",
        "lesson_id": "06",
        "lesson_title": "완전한 단락 1개 완성",
        "lesson_summary": "중심 문장(첫 번째) + 뒷받침 3개(방법 2가지 이상) + 마무리 문장(단순 반복 금지).",
        "assignment": "처음부터 끝까지 혼자서 완전한 단락 쓰기 (자유 주제)",
        "criteria": "C1: 중심 문장이 명확하고 첫 번째 문장인가\nC2: 뒷받침 문장이 3개 있는가\nC3: 뒷받침 방법이 2가지 이상 혼합되었는가\n    - 이유: '왜냐하면'이 있거나 이유를 설명하는 내용\n    - 예시: '예를 들어'가 있거나 구체적 경험/사례\n    - 비교: '~와 달리', '~에 비해'가 있거나 다른 것과 비교하는 내용\n    - 경험: '한 번은', '내가 직접' 또는 과거 경험 서술\n    신호어가 없어도 내용으로 방법을 판단할 수 있으면 인정\nC4: 각 뒷받침 문장이 중심 문장과 연결되는가\nC5: 마무리 문장이 있고, 중심 문장의 단순 반복이 아닌가\n    단순 반복 = 중심 문장과 거의 같은 의미를 다시 씀\n    표현이 조금 다르더라도 의미가 완전히 같으면 단순 반복으로 봄\n    단, '즐거운 활동'→'좋은 활동' 정도의 소폭 변형은 단순 반복으로 볼 수 있음\nC6: 모든 문장에 주어와 서술어가 있는가",
        "pass_rule": "C1·C2·C3·C4·C5·C6 모두 충족",
        "not_evaluated": "맞춤법(명백한 오류가 아니면), 단락 간 연결",
        "student_text": "나는 독서가 즐거운 활동이라고 생각한다.\n왜냐하면 책을 읽으면 새로운 세계를 경험할 수 있기 때문이다.\n예를 들어 내가 탐정 소설을 읽을 때 나도 탐정이 된 것 같은 느낌이 들었다.\n독서는 수영이나 달리기와 달리 비가 와도 할 수 있다.\n그래서 나는 독서가 좋은 활동이라고 생각한다.",
        "expected_pass": True,  # 경계 케이스 — 흔들릴 수 있음
        "expected_handoff": False,
    },
    {
        "case_num": 4,
        "title": "차시06 명확한 불합격 — 중심 문장이 마지막에 있음",
        "lesson_id": "06",
        "lesson_title": "완전한 단락 1개 완성",
        "lesson_summary": "중심 문장(첫 번째) + 뒷받침 3개(방법 2가지 이상) + 마무리 문장(단순 반복 금지).",
        "assignment": "처음부터 끝까지 혼자서 완전한 단락 쓰기 (자유 주제)",
        "criteria": "C1: 중심 문장이 명확하고 첫 번째 문장인가\nC2: 뒷받침 문장이 3개 있는가\nC3: 뒷받침 방법이 2가지 이상 혼합되었는가\nC4: 각 뒷받침 문장이 중심 문장과 연결되는가\nC5: 마무리 문장이 있고, 중심 문장의 단순 반복이 아닌가\nC6: 모든 문장에 주어와 서술어가 있는가",
        "pass_rule": "C1·C2·C3·C4·C5·C6 모두 충족",
        "not_evaluated": "맞춤법(명백한 오류가 아니면), 단락 간 연결",
        "student_text": "나는 매일 아침 강아지와 산책을 한다.\n한 번은 비가 오는 날 산책을 했는데, 강아지가 빗속에서 뛰어노는 것을 보고 나도 기분이 좋아졌다.\n강아지는 고양이와 달리 산책을 좋아해서 같이 밖에 나갈 수 있다.\n그래서 나는 강아지가 최고의 반려동물이라고 생각한다.",
        "expected_pass": False,
        "expected_handoff": False,
    },
    {
        "case_num": 5,
        "title": "차시07 접속어 흐름 오류",
        "lesson_id": "07",
        "lesson_title": "접속어로 단락 연결하기",
        "lesson_summary": "단락 간 접속어: 같은 방향(그리고/또한), 반대(하지만/반면에), 결과(그래서/따라서). 흐름에 맞게 사용해야 함.",
        "assignment": "단락 2개를 접속어로 연결하기",
        "criteria": "C1: 단락이 2개 있는가\nC2: 각 단락에 중심 문장이 있는가\nC3: 각 단락에 뒷받침 문장이 2개 이상 있는가\nC4: 두 단락 사이에 접속어가 사용되었는가\nC5: 사용된 접속어가 두 단락의 흐름에 맞는가 (같은 방향인데 '하지만' 사용 등 오류 감지)\nC6: 모든 문장에 주어와 서술어가 있는가",
        "pass_rule": "C1·C2·C3·C4·C5·C6 모두 충족",
        "not_evaluated": "마무리 문장(이번 차시는 단락 연결 집중), 맞춤법",
        "student_text": "나는 수학을 좋아한다.\n왜냐하면 문제를 풀었을 때 정답이 나오면 기분이 좋기 때문이다.\n예를 들어 어려운 문제를 오래 생각해서 풀었을 때 정말 뿌듯했다.\n\n하지만 나는 미술도 좋아한다.\n왜냐하면 내가 그린 그림이 완성됐을 때 뿌듯하기 때문이다.\n예를 들어 작년 미술 시간에 그린 그림을 선생님이 칭찬해주셨다.",
        "expected_pass": False,
        "expected_handoff": False,
    },
    {
        "case_num": 6,
        "title": "차시12 명확한 불합격 (루브릭)",
        "lesson_id": "12",
        "lesson_title": "최종 과제 — 루브릭 종합 평가",
        "lesson_summary": "2단계 전체 복습. 루브릭 5항목 × 4점 = 20점 만점.",
        "assignment": "자유 주제 소개글 (2단락 이상, 각 단락 중심 문장 + 뒷받침 3개(방법 2가지 이상) + 마무리 문장, 단락 간 접속어)",
        "criteria": "R1: 중심 문장(4점) — 명확성, 첫 번째 문장 여부\nR2: 뒷받침(4점) — 3개 이상, 2가지 이상 방법, 중심 문장 연결\nR3: 마무리 문장(4점) — 의미 있는 마무리, 단순 반복 아님\nR4: 연결성(4점) — 뒷받침이 중심 문장과 연결\nR5: 접속어(4점) — 단락 간 자연스러운 연결",
        "pass_rule": "총점 14점 이상 합격. 각 항목 점수 합 = total과 반드시 일치.",
        "not_evaluated": "없음",
        "student_text": "나는 축구를 좋아한다.\n축구는 재미있다.\n나는 어제 학교에 갔다.\n친구들이 운동장에서 뛰었다.\n축구가 최고이다.\n\n그리고 나는 피자도 좋아한다.\n피자는 맛있다.\n나는 피자를 먹은 적이 있다.\n피자는 치즈가 있다.\n피자가 제일 맛있다.",
        "expected_pass": False,
        "expected_handoff": False,
        "is_lesson12": True,
    },
]


# ─────────────────────────────────────────────
# 유틸리티
# ─────────────────────────────────────────────
def get_model(lesson_id: str) -> str:
    """차시01~06: Haiku (구조 기반), 차시07~: Sonnet (판단 필요)"""
    if int(lesson_id) <= 6:
        return "claude-haiku-4-5-20251001"
    return "claude-sonnet-4-6"


def get_max_tokens(lesson_id: str) -> int:
    n = int(lesson_id)
    if n <= 6:
        return 1300
    elif n == 12:
        return 1800
    return 1600


def strip_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner).strip()
    return text


def build_user_prompt(case: dict) -> str:
    schema = JSON_SCHEMA_L12 if case.get("is_lesson12") else JSON_SCHEMA_COMMON
    extra = f"\n[추가 지시]\n{case['extra_instruction']}" if case.get("extra_instruction") else ""
    return f"""[차시 정보]
lesson_id: {case['lesson_id']}
lesson_title: {case['lesson_title']}

[수업 내용]
{case['lesson_summary']}

[과제]
{case['assignment']}

[채점 기준]
{case['criteria']}

[합격 기준]
{case['pass_rule']}

[아직 평가 안 함]
{case['not_evaluated']}{extra}

[학생 글]
{case['student_text']}

[반환 형식]
다음 JSON 스키마를 정확히 지켜서 답하세요.

{schema}"""


def run_test(client: anthropic.Anthropic, case: dict) -> tuple[dict, object, str]:
    model = get_model(case["lesson_id"])
    max_tokens = get_max_tokens(case["lesson_id"])
    user_prompt = build_user_prompt(case)

    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        temperature=0.2,
        system=[
            {
                "type": "text",
                "text": SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text.strip()
    cleaned = strip_json(raw)
    result = json.loads(cleaned)
    return result, response.usage, raw


# ─────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────
def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌  ANTHROPIC_API_KEY 환경변수가 없습니다.")
        print("    터미널에서 실행: export ANTHROPIC_API_KEY=sk-ant-...")
        return

    client = anthropic.Anthropic(api_key=api_key)

    print("=" * 60)
    print("2단계 AI 피드백 프롬프트 테스트")
    print("=" * 60)

    summary_rows = []
    total_input = 0
    total_cached = 0
    total_output = 0

    for case in TEST_CASES:
        print(f"\n▶ 케이스 {case['case_num']}: {case['title']}")
        model = get_model(case["lesson_id"])
        print(f"  모델: {model} | max_tokens: {get_max_tokens(case['lesson_id'])}")

        raw_text = ""
        try:
            result, usage, raw_text = run_test(client, case)

            pass_match = result["pass"] == case["expected_pass"]
            handoff_match = result["teacher_handoff_needed"] == case["expected_handoff"]
            overall_ok = pass_match and handoff_match

            cached = getattr(usage, "cache_read_input_tokens", 0)
            total_input += usage.input_tokens
            total_cached += cached
            total_output += usage.output_tokens

            print(f"  판정: {result['result_label']}")
            print(f"  pass={result['pass']} (기대={case['expected_pass']}) {'✅' if pass_match else '❌'}")
            print(f"  토큰: 입력={usage.input_tokens} (캐시히트={cached}) | 출력={usage.output_tokens}")

            if result.get("failed_criteria"):
                ids = [c["criterion_id"] for c in result["failed_criteria"]]
                print(f"  실패 기준: {ids}")

            if result.get("strengths"):
                for s in result["strengths"]:
                    print(f"  ✨ {s['reason']}")

            if result.get("improvements"):
                for imp in result["improvements"]:
                    print(f"  💬 {imp['criterion_id']}: {imp['problem']}")
                    print(f"      → {imp['suggestion']}")

            if result.get("one_tip"):
                print(f"  💡 {result['one_tip']}")

            if case.get("is_lesson12") and result.get("score"):
                bd = result["score"]["breakdown"]
                print(f"  📊 점수: 중심={bd.get('topic_sentence')} 뒷받침={bd.get('supporting')} "
                      f"마무리={bd.get('closing')} 연결성={bd.get('coherence')} 접속어={bd.get('connectives')} "
                      f"총점={result['score']['total']}")

            summary_rows.append({
                "케이스": case["case_num"],
                "제목": case["title"],
                "기대": "합격" if case["expected_pass"] else ("handoff" if case["expected_handoff"] else "불합격"),
                "실제": result["result_label"],
                "일치": "✅" if overall_ok else "❌",
            })

        except json.JSONDecodeError as e:
            print(f"  ❌ JSON 파싱 실패: {e}")
            if raw_text:
                print(f"     원본 앞 200자: {raw_text[:200]}")
            summary_rows.append({
                "케이스": case["case_num"],
                "제목": case["title"],
                "기대": str(case["expected_pass"]),
                "실제": "파싱 오류",
                "일치": "❌",
            })
        except Exception as e:
            print(f"  ❌ 오류: {e}")
            summary_rows.append({
                "케이스": case["case_num"],
                "제목": case["title"],
                "기대": str(case["expected_pass"]),
                "실제": f"오류: {e}",
                "일치": "❌",
            })

    print("\n" + "=" * 60)
    print("테스트 결과 요약")
    print("=" * 60)
    correct = sum(1 for r in summary_rows if r["일치"] == "✅")
    print(f"정확도: {correct}/{len(summary_rows)}")
    print()
    for row in summary_rows:
        print(f"  케이스{row['케이스']:2d} {row['일치']}  기대={row['기대']:6s}  실제={row['실제']}")

    print(f"\n토큰 사용량 합계")
    print(f"  입력: {total_input:,} (캐시 히트: {total_cached:,} / {total_cached/max(total_input,1)*100:.0f}%)")
    print(f"  출력: {total_output:,}")


if __name__ == "__main__":
    main()
