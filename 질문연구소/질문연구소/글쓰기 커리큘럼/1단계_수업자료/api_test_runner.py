#!/usr/bin/env python3
"""
1단계 AI 피드백 프롬프트 테스트 러너

비용 절감 적용:
- 프롬프트 캐싱: 시스템 프롬프트 cache_control 적용
- 모델 분기: 차시01~04 → Haiku, 차시05~ → Sonnet
- max_tokens 제한: 차시별 상한 설정
"""

import os
import json
import anthropic

# ─────────────────────────────────────────────
# 시스템 프롬프트 (모든 차시 공통 — 캐싱 대상)
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """당신은 초등학생 글쓰기를 도와주는 한국어 글쓰기 코치입니다.

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
- 주어가 없는 문장은 한국어에서 자연스럽더라도 반드시 C1 실패로 처리하세요.
  예: "아침에 학교에 갔다." → 주어 없음 → C1 실패 (pass=false)
  "나는"이나 "우리는" 같은 명시적 주어가 반드시 있어야 C1 통과입니다.
- 단, 자연 현상 문장은 예외입니다.
  "비가 왔다", "바람이 불었다", "눈이 내렸다"처럼 자연 현상을 묘사하는 문장은
  "비가", "바람이", "눈이"가 주어입니다. 주어 없음으로 처리하지 마세요.
  주어 명시 규칙은 사람이나 동물이 행위자인 문장에 적용합니다.
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
- 수정 예시는 원래 문장보다 너무 어렵지 않게 쓰세요."""

# ─────────────────────────────────────────────
# JSON 반환 스키마 (차시12 제외 공통)
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
      "fluency": 0,
      "structure": 0,
      "content": 0,
      "expression": 0,
      "conventions": 0
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
# 테스트 케이스 8개
# ─────────────────────────────────────────────
TEST_CASES = [
    {
        "case_num": 1,
        "title": "차시01 명확한 합격",
        "lesson_id": "01",
        "lesson_title": "문장이란 무엇인가",
        "lesson_summary": "완전한 문장 = 주어 + 서술어. 주어는 반드시 명시. 문장 끝에 마침표.",
        "assignment": "오늘 있었던 일 3가지를 각각 완전한 문장 1개로 쓰기",
        "criteria": "C1: 각 문장에 주어가 명시적으로 있는가\nC2: 각 문장에 서술어가 있는가\nC3: 각 문장 끝에 마침표가 있는가",
        "pass_rule": "3문장 모두 C1·C2·C3 충족",
        "not_evaluated": "육하원칙, 맞춤법, 문장 부호 종류, 감정 표현",
        "student_text": "나는 아침에 학교에 갔다.\n나는 쉬는 시간에 친구와 공놀이를 했다.\n나는 저녁에 엄마와 책을 읽었다.",
        "expected_pass": True,
        "expected_handoff": False,
    },
    {
        "case_num": 2,
        "title": "차시01 명확한 불합격",
        "lesson_id": "01",
        "lesson_title": "문장이란 무엇인가",
        "lesson_summary": "완전한 문장 = 주어 + 서술어. 주어는 반드시 명시. 문장 끝에 마침표.",
        "assignment": "오늘 있었던 일 3가지를 각각 완전한 문장 1개로 쓰기",
        "criteria": "C1: 각 문장에 주어가 명시적으로 있는가\nC2: 각 문장에 서술어가 있는가\nC3: 각 문장 끝에 마침표가 있는가",
        "pass_rule": "3문장 모두 C1·C2·C3 충족",
        "not_evaluated": "육하원칙, 맞춤법, 문장 부호 종류, 감정 표현",
        "student_text": "아침에 학교에 갔다.\n나는 쉬는 시간에 친구와 공놀이를 했다.\n저녁에 책을 읽었다.",
        "expected_pass": False,
        "expected_handoff": False,
    },
    {
        "case_num": 3,
        "title": "차시04 아슬아슬한 합격",
        "lesson_id": "04",
        "lesson_title": "맞춤법과 띄어쓰기 기초",
        "lesson_summary": "자주 틀리는 표현: 됐다/됬다, 며칠/몇일, 안 했다(띄어쓰기), 오랜만에/오랫만에, 왠지/웬지",
        "assignment": "어제 한 일을 4문장으로 쓰기 (맞춤법·띄어쓰기 집중)",
        "criteria": "C1: '됬' → '됐' 오류 여부\nC2: '몇일' → '며칠' 오류 여부\nC3: '안했다', '못갔다' 등 붙여쓰기 오류 여부\nC4: '오랫만에' → '오랜만에' 오류 여부\nC5: '웬지' → '왠지' 오류 여부\nC6: 단어 사이 기본 띄어쓰기 누락 여부",
        "pass_rule": "4문장 중 위 오류 합산 2개 이하",
        "not_evaluated": "감정 표현, 육하원칙",
        "student_text": "나는 어제 학교에서 발표를 했다.\n나는 발표 전에 조금 긴장했다.\n나는 집에 와서 숙제를 안 했다.\n나는 오랜만에 일찍 잠을 잤다.",
        "expected_pass": True,
        "expected_handoff": False,
    },
    {
        "case_num": 4,
        "title": "차시04 명확한 불합격",
        "lesson_id": "04",
        "lesson_title": "맞춤법과 띄어쓰기 기초",
        "lesson_summary": "자주 틀리는 표현: 됐다/됬다, 며칠/몇일, 안 했다(띄어쓰기), 오랜만에/오랫만에, 왠지/웬지",
        "assignment": "어제 한 일을 4문장으로 쓰기 (맞춤법·띄어쓰기 집중)",
        "criteria": "C1: '됬' → '됐' 오류 여부\nC2: '몇일' → '며칠' 오류 여부\nC3: '안했다', '못갔다' 등 붙여쓰기 오류 여부\nC4: '오랫만에' → '오랜만에' 오류 여부\nC5: '웬지' → '왠지' 오류 여부\nC6: 단어 사이 기본 띄어쓰기 누락 여부",
        "pass_rule": "4문장 중 위 오류 합산 2개 이하",
        "not_evaluated": "감정 표현, 육하원칙",
        "student_text": "나는 어제 발표를 했는데 너무 떨렸다.\n나는 몇일 동안 연습한 내용을 말했다.\n나는 집에 와서 숙제를 안했다.\n나는 오랫만에 푹 쉬었다.",
        "expected_pass": False,
        "expected_handoff": False,
    },
    {
        "case_num": 5,
        "title": "차시08 엣지 케이스 (경계 판정)",
        "lesson_id": "08",
        "lesson_title": "일기 — 자유 일기",
        "lesson_summary": "차시01~07 종합. 일기 3구성(날짜·날씨/있었던 일/느낌·생각) + 감정 간접 표현(몸의 반응).",
        "assignment": "자유 주제 일기 (8문장 이상). 완전한 문장, 구체성, 문장 부호, 맞춤법, 느낌 표현 모두 적용.",
        "criteria": "C1: 문장 수가 8개 이상인가 — 줄 수를 세면 됩니다. 날짜·날씨 유무와 무관합니다.\nC2: 모든 문장에 주어와 서술어가 있는가 — '비가 왔다'에서 '비가'가 주어, '기분이 좋았다'에서 '기분이'가 주어, '내 손이 차가워졌다'에서 '손이'가 주어입니다.\nC3: 있었던 일이 구체적인가 (육하원칙 요소 2개 이상)\nC4: 감정 간접 표현(몸의 반응)이 1개 이상 있는가 — 직접 표현이 일부 있어도 몸의 반응 1개 이상이면 충족\nC5: 문장 부호(마침표/물음표/느낌표)가 올바르게 쓰였는가\nC6: 명백한 맞춤법 오류가 3개 이하인가",
        "pass_rule": "C1~C6 모두 충족. C1은 날짜·날씨·구성 여부와 무관하게 문장 수(8개)만 셉니다.",
        "not_evaluated": "없음 (차시01~07 전체 복습)",
        "student_text": "오늘은 비가 많이 왔다.\n나는 아침에 우산을 쓰고 학교에 갔다.\n나는 교실에 들어가서 젖은 신발을 털었다.\n나는 2교시에 발표를 했다.\n발표를 시작할 때 내 손이 차가워지고 목소리가 작아졌다.\n그래도 발표를 마치고 나니 기분이 좋았다.\n나는 점심시간에 친구와 떡볶이를 먹었다.\n오늘은 긴장됐지만 뿌듯한 하루였다.",
        "expected_pass": True,  # 경계 케이스 — 흔들릴 수 있음
        "expected_handoff": False,
    },
    {
        "case_num": 6,
        "title": "차시12 명확한 불합격 (루브릭)",
        "lesson_id": "12",
        "lesson_title": "최종 과제 — 루브릭 종합 평가",
        "lesson_summary": "1단계 전체 복습. 루브릭 5항목 × 4점 = 20점 만점.",
        "assignment": "자유 주제 일기 (8문장 이상)",
        "criteria": "R1: 유창성(4점) — 8문장이상·자연스러운흐름\nR2: 구조(4점) — 날짜·날씨/있었던일/느낌·생각/마무리\nR3: 내용(4점) — 육하원칙 요소 수, 구체성\nR4: 어휘/표현(4점) — 감정 간접 표현·감각 표현\nR5: 관례(4점) — 맞춤법·띄어쓰기·문장부호 오류 수",
        "pass_rule": "총점 14점 이상 합격. 각 항목 점수 합 = total과 반드시 일치.",
        "not_evaluated": "없음",
        "student_text": "오늘은 재미있었다.\n나는 학교에 갔다.\n나는 수업을 들었다.\n나는 친구를 만났다.\n나는 밥을 먹었다.\n나는 집에 왔다.\n나는 숙제를 했다.\n나는 잤다.",
        "expected_pass": False,
        "expected_handoff": False,
        "is_lesson12": True,
    },
    {
        "case_num": 7,
        "title": "차시07 직접 표현 과다 불합격",
        "lesson_id": "07",
        "lesson_title": "일기 — 느낌 표현하기",
        "lesson_summary": "직접 표현(Tell): '기뻤다' / 간접 표현(Show): '심장이 두근거렸다'. 간접 표현이 더 생생하게 전달됨.",
        "assignment": "오늘 일기에서 감정이 드러나는 문장을 3개 이상 포함해 일기 쓰기",
        "criteria": "C1: 모든 문장에 주어와 서술어가 있는가\nC2: 감정을 몸의 반응이나 행동으로 표현한 문장이 1개 이상 있는가\nC3: '기뻤다', '슬펐다', '좋았다' 수준의 직접 표현이 3개 이상인가 (3개 이상이면 불합격)",
        "pass_rule": "C1·C2 충족, C3 위반 없음 (직접 표현 2개 이하여야 합격)",
        "not_evaluated": "맞춤법, 육하원칙",
        "student_text": "오늘은 학교에서 발표를 했다.\n나는 발표가 끝나서 기뻤다.\n나는 점심시간에 친구와 놀아서 좋았다.\n집에 와서 엄마가 간식을 줬는데 신났다.\n나는 오늘 하루가 즐거웠다.\n나는 내일도 학교에 가고 싶다.",
        "expected_pass": False,
        "expected_handoff": False,
    },
    {
        "case_num": 8,
        "title": "teacher_handoff 케이스 (판단 불가 입력)",
        "lesson_id": "01",
        "lesson_title": "문장이란 무엇인가",
        "lesson_summary": "완전한 문장 = 주어 + 서술어. 주어는 반드시 명시. 문장 끝에 마침표.",
        "assignment": "오늘 있었던 일 3가지를 각각 완전한 문장 1개로 쓰기",
        "criteria": "C1: 각 문장에 주어가 명시적으로 있는가\nC2: 각 문장에 서술어가 있는가\nC3: 각 문장 끝에 마침표가 있는가",
        "pass_rule": "3문장 모두 C1·C2·C3 충족",
        "not_evaluated": "육하원칙, 맞춤법, 문장 부호 종류, 감정 표현",
        "student_text": "ㅎㅎ\n모르겠어요\nㅋ",
        "expected_pass": False,
        "expected_handoff": True,
        "extra_instruction": "제출된 내용이 과제 형식과 전혀 맞지 않거나 평가할 수 없는 경우, teacher_handoff_needed=true로 설정하고 teacher_handoff_reason에 사유를 간단히 쓰세요. 이 경우 improvements와 strengths는 빈 배열로 두세요.",
    },
]


# ─────────────────────────────────────────────
# 유틸리티
# ─────────────────────────────────────────────
def get_model(lesson_id: str) -> str:
    """차시01~04: Haiku (규칙 기반), 차시05~: Sonnet (판단 필요)"""
    if int(lesson_id) <= 4:
        return "claude-haiku-4-5-20251001"
    return "claude-sonnet-4-6"


def get_max_tokens(lesson_id: str) -> int:
    n = int(lesson_id)
    if n <= 4:
        return 900
    elif n == 12:
        return 1400
    return 1400


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


# ─────────────────────────────────────────────
# 메인 실행
# ─────────────────────────────────────────────
def strip_json(text: str) -> str:
    """마크다운 코드 블록 제거. 모델이 지시를 무시하고 감쌀 때 대비."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # 첫 줄(```json 또는 ```) 제거, 마지막 줄(```) 제거
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner).strip()
    return text


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


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌  ANTHROPIC_API_KEY 환경변수가 없습니다.")
        print("    터미널에서 실행: export ANTHROPIC_API_KEY=sk-ant-...")
        return

    client = anthropic.Anthropic(api_key=api_key)

    print("=" * 60)
    print("1단계 AI 피드백 프롬프트 테스트")
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
            print(f"  teacher_handoff={result['teacher_handoff_needed']} (기대={case['expected_handoff']}) {'✅' if handoff_match else '❌'}")
            print(f"  토큰: 입력={usage.input_tokens} (캐시히트={cached}) | 출력={usage.output_tokens}")

            if result.get("failed_criteria"):
                ids = [c["criterion_id"] for c in result["failed_criteria"]]
                print(f"  실패 기준: {ids}")

            if result.get("strengths"):
                for s in result["strengths"]:
                    print(f"  ✨ 잘한 점: {s['reason']}")

            if result.get("improvements"):
                for imp in result["improvements"]:
                    print(f"  💬 {imp['criterion_id']}: {imp['problem']}")
                    print(f"      → {imp['suggestion']}")

            if result.get("one_tip"):
                print(f"  💡 one_tip: {result['one_tip']}")

            if result.get("teacher_handoff_reason"):
                print(f"  🚨 handoff 사유: {result['teacher_handoff_reason']}")

            # 차시12 점수 출력
            if case.get("is_lesson12") and result.get("score"):
                bd = result["score"]["breakdown"]
                print(f"  📊 점수: 유창성={bd.get('fluency')} 구조={bd.get('structure')} "
                      f"내용={bd.get('content')} 표현={bd.get('expression')} 관례={bd.get('conventions')} "
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
            try:
                print(f"     원본 앞 200자: {raw_text[:200]}")
            except NameError:
                pass
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

    # ─── 최종 요약 ───
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

    # 비용 추산 (Sonnet 기준)
    # Sonnet: 입력 $3/MTok, 캐시읽기 $0.30/MTok, 출력 $15/MTok
    # Haiku:  입력 $0.25/MTok, 캐시읽기 $0.03/MTok, 출력 $1.25/MTok
    print("\n※ 이 결과에서 정확한 비용은 모델별로 달라지니 Anthropic 콘솔에서 확인하세요.")


if __name__ == "__main__":
    main()
