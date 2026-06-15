#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""L1 읽기 QA 검수 반영 패치 (멱등)."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ITEMS_P = os.path.join(ROOT, "item-bank/level-1/items.json")
PASS_P = os.path.join(ROOT, "item-bank/level-1/passages.json")

items = json.load(open(ITEMS_P, encoding="utf-8"))
passages = json.load(open(PASS_P, encoding="utf-8"))
bid = {i["item_id"]: i for i in items}
bpid = {p["passage_id"]: p for p in passages}

# 1) P-1-012: 관찰 가능 사실 문장 포함하도록 지문 보강
p = bpid["P-1-012"]
p["text"] = ("우리는 날마다 여러 사람과 인사를 나눕니다. 인사를 할 때는 고개를 숙이거나 손을 흔들기도 합니다. "
             "밝게 인사를 나누면 서로 기분이 좋아집니다. 인사는 상대를 존중하는 마음을 나타내는 행동입니다. "
             "그러므로 우리는 먼저 밝게 인사하는 습관을 길러야 합니다.")
p["char_count"] = len(p["text"])

# 2) [필수] CRT-008: 오답 3개를 순수 사실로 교체 → 의견(당위) 1개만 정답
it = bid["R-1-CRT-008"]
it["choices"] = [
    "우리는 날마다 여러 사람과 인사를 나눈다.",
    "인사를 할 때는 고개를 숙이거나 손을 흔들기도 한다.",
    "우리는 먼저 밝게 인사하는 습관을 길러야 한다.",
    "인사말에는 '안녕하세요'와 '안녕히 가세요'가 있다.",
]
it["answer"] = 2
it["explanation"] = ("③은 '습관을 길러야 한다'는 글쓴이의 주장이 담긴 의견입니다. "
                     "①, ②, ④는 누구나 보고 확인할 수 있는 사실입니다.")

# 3) [권장] CRT-006: 당위 오답 1개를 평서형 의견으로 교체(형태 단서 차단)
it = bid["R-1-CRT-006"]
it["choices"] = [
    "운동은 날마다 꼭 해야 하는 일이다.",
    "운동을 하면 근육과 뼈가 튼튼해진다.",
    "운동을 좋아하는 사람은 더 행복하게 산다.",
    "운동을 게을리하면 안 된다.",
]
it["answer"] = 1
it["explanation"] = ("②는 운동의 효과로 확인할 수 있는 내용이므로 사실입니다. "
                     "①과 ④는 '해야 한다', '안 된다'처럼 당위가 담긴 의견이고, "
                     "③은 '더 행복하게 산다'처럼 글쓴이의 생각이 담긴 의견입니다.")

# 4) [권장] INF-005: 심정 추론 → 예측형(단서로 다음 행동 예측)으로 재설계
it = bid["R-1-INF-005"]
it["question_text"] = "민수가 친구에게 '다음에 만나자'고 말한 것으로 보아, 이어서 민수가 할 행동으로 알맞은 것은?"
it["choices"] = [
    "친구를 따라 놀러 나간다",
    "동생과 함께 도서관에 간다",
    "약속을 잊고 집에서 쉰다",
    "동생에게 가지 말자고 한다",
]
it["answer"] = 1
it["explanation"] = ("친구의 제안을 미루고 동생과 한 약속을 택했으므로, 이어서 동생과 함께 도서관에 갈 것임을 예측할 수 있습니다.")

# 5) [검토] VOC-005 tier 하향, VOC-007 오답 인접 의미로 보강
bid["R-1-VOC-005"]["difficulty_tier"] = "medium"
it = bid["R-1-VOC-007"]
it["choices"] = ["흐릿하고 희미하게", "밝고 환하게", "작고 가늘게", "흐리지 않고 분명하게"]
it["answer"] = 3  # 변동 없음(위치 유지)

# --- 검증 ---
errs = []
for i in items:
    if len(i["choices"]) != 4:
        errs.append(f"{i['item_id']}: 선택지 4개 아님")
    if not (0 <= i["answer"] < 4):
        errs.append(f"{i['item_id']}: answer 범위 오류")
    if len(set(i["choices"])) != 4:
        errs.append(f"{i['item_id']}: 선택지 중복")
    if i["passage_id"] and i["passage_id"] not in bpid:
        errs.append(f"{i['item_id']}: 미존재 지문")
if errs:
    print("검증 실패:\n" + "\n".join(errs)); raise SystemExit(1)

json.dump(passages, open(PASS_P, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
json.dump(items, open(ITEMS_P, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("QA 패치 반영 완료. 문항", len(items), "지문", len(passages))
import collections
ans = collections.Counter(i["answer"] for i in items)
print("정답 위치 분포:", dict(sorted(ans.items())))
