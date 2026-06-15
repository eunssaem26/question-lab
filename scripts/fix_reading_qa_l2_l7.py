#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""L2~L7 신규 읽기 문항 QA 검수 반영 패치 (멱등)."""
import json, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(n):
    return json.load(open(os.path.join(ROOT, f"item-bank/level-{n}/items.json"), encoding="utf-8"))


def save(n, items):
    json.dump(items, open(os.path.join(ROOT, f"item-bank/level-{n}/items.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=2)


def find(items, iid):
    return next(i for i in items if i["item_id"] == iid)


# ---------- L2 ----------
I2 = load(2)
# R-2-CRT-007: 형태 단서 오답 1개를 '그럴듯하지만 출처 약한' 매력 오답으로 교체
it = find(I2, "R-2-CRT-007")
it["choices"][2] = "글을 잘 쓰는 블로거가 정리한 글 — 읽기 쉽게 잘 써서 믿을 수 있다."
it["explanation"] = ("자료의 신뢰성은 인기·분량·광고나 글솜씨가 아니라 누가 내용을 확인했는지로 판단해야 합니다. "
                     "동물 박사가 감수한 도감은 전문가가 내용을 확인했으므로 가장 믿을 만하며 까닭도 알맞습니다. "
                     "나머지는 신뢰성과 관련 없는 까닭을 들고 있습니다.")
# R-2-CRT-008: 부정형 강조 마커 추가
it = find(I2, "R-2-CRT-008")
it["question_text"] = it["question_text"].replace("가장 낮은 자료는?", "가장 _낮은_ 자료는?")
save(2, I2)

# ---------- L3 ----------
I3 = load(3)
# R-3-CRT-008: 마크다운 볼드 -> 밑줄 마커(앱 지원 형식)
it = find(I3, "R-3-CRT-008")
it["question_text"] = it["question_text"].replace("**않은**", "_않은_")
# R-3-CRT-005: 부정형 강조 마커 추가
it = find(I3, "R-3-CRT-005")
it["question_text"] = it["question_text"].replace("가장 약한 것은?", "가장 _약한_ 것은?")
save(3, I3)

# ---------- L4 ----------
I4 = load(4)
# R-4-CRT-006: 4단계 핵심(내용 타당성 + 표현 적절성)을 정답에 함께 담도록 보강
it = find(I4, "R-4-CRT-006")
it["choices"][0] = "더위 완화·공기 정화·휴식처라는 구체적 근거를 들었고, 상대를 비난하지 않고 공정하게 표현했다"
it["explanation"] = ("글쓴이는 녹지가 더위를 낮추고 공기를 맑게 하며 휴식처가 된다는 구체적 근거로 주장을 뒷받침하고(내용 타당성), "
                     "상대를 깎아내리지 않고 공정하게 서술합니다(표현 적절성). ②는 글에 없는 인신공격이고, "
                     "③은 글이 근거를 제시했다는 사실과 어긋나며, ④는 글이 녹지의 장점을 들었다는 점과 반대됩니다.")
save(4, I4)

# ---------- L5 ----------
I5 = load(5)
# R-5-STR-006: 발문이 설명 방법을 직접 묘사(=정답 노출)하던 것을 제거
it = find(I5, "R-5-STR-006")
it["question_text"] = "이 설명문에서 '필터 버블' 개념을 독자에게 이해시키기 위해 사용한 설명 방법은?"
it["explanation"] = ("글은 '필터 버블이란 ~을 말한다'처럼 개념을 정의한 뒤, 추천 영상이 비슷한 주제로만 이어지는 구체적 상황을 "
                     "예로 들어 보입니다. 개념 풀이와 예시를 함께 쓰는 것은 '정의와 예시'의 설명 방법입니다.")
# R-5-STR-008: '정의와 예시' 중복 해소 -> '분류'로 교체(표지어 직접 노출도 완화), 정답 위치 2 유지
it = find(I5, "R-5-STR-008")
it["question_text"] = ("다음 글에 사용된 설명 방법은?\n\n"
                       "\"에너지는 크게 두 갈래로 나눌 수 있다. 하나는 석탄·석유처럼 한 번 쓰면 사라지는 화석 에너지이고, "
                       "다른 하나는 햇빛·바람처럼 거듭 얻을 수 있는 재생 에너지이다.\"")
it["choices"] = ["시간 순서에 따른 전개", "정의와 예시", "기준에 따라 갈래로 나누는 분류", "문제와 해결"]
it["answer"] = 2
it["explanation"] = ("글은 에너지를 '화석 에너지'와 '재생 에너지'라는 두 갈래로 묶어 설명합니다. "
                     "대상을 일정한 기준에 따라 갈래로 나누어 설명하는 방법은 '분류'입니다. "
                     "개념을 '~란 …을 말한다'로 풀이하거나 시간 흐름·문제 해결로 전개하지 않았습니다.")
save(5, I5)

# ---------- L6 ----------
I6 = load(6)
# R-6-LIT-006: 해설 오타(정답은 ①(index 0)인데 해설은 '②가 일치') 수정
it = find(I6, "R-6-LIT-006")
it["explanation"] = it["explanation"].replace("②가 일치합니다", "①이 일치합니다")
assert it["answer"] == 0
save(6, I6)

# ---------- L7 ----------
I7 = load(7)
# R-7-LIT-008: 부정형 강조 마커 추가
it = find(I7, "R-7-LIT-008")
it["question_text"] = it["question_text"].replace("보기 어려운 것은?", "_보기 어려운_ 것은?")
save(7, I7)

# ---------- 검증 ----------
errs = []
for n in range(2, 8):
    for it in load(n):
        if "**" in it["question_text"] or "<strong>" in it["question_text"]:
            errs.append(f"{it['item_id']}: 미정규화 마커 잔존")
        if len(it["choices"]) != 4 or len(set(it["choices"])) != 4:
            errs.append(f"{it['item_id']}: 선택지 문제")
        if not (0 <= it["answer"] < 4) if isinstance(it["answer"], int) else False:
            errs.append(f"{it['item_id']}: answer 범위")
print("패치 완료." if not errs else "오류:\n" + "\n".join(errs))
# 정답 분포 재확인
for n in range(2, 8):
    c = collections.Counter(i["answer"] for i in load(n) if isinstance(i["answer"], int))
    print(f"L{n} 정답분포:", {k: c[k] for k in range(4)})
