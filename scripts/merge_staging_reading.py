#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""스테이징 읽기 문항(.staging/lN_reading.json)을 item-bank/level-N에 병합·검증.
사용: python3 scripts/merge_staging_reading.py [--apply]
기본은 dry-run(검증만). --apply 시 실제 병합 후 파일 기록.
"""
import json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGING = os.path.join(ROOT, "item-bank/.staging")
APPLY = "--apply" in sys.argv
DOMAINS = ["VOC", "LIT", "INF", "CRT", "STR"]
REQ = ["item_id", "level", "domain", "domain_code", "primary_domain", "achievement_standard",
       "level_differentiation", "item_type", "question_text", "choices", "answer", "explanation",
       "passage_id", "passage_genre", "difficulty", "discrimination", "review_status",
       "is_warmup", "difficulty_tier"]

total_new_items = total_new_pass = 0
all_ok = True
for n in range(2, 8):
    sp = os.path.join(STAGING, f"l{n}_reading.json")
    if not os.path.exists(sp):
        print(f"L{n}: 스테이징 없음 (건너뜀)"); continue
    stage = json.load(open(sp, encoding="utf-8"))
    new_items = stage["items"]; new_pass = stage.get("passages", [])

    items = json.load(open(os.path.join(ROOT, f"item-bank/level-{n}/items.json"), encoding="utf-8"))
    passages = json.load(open(os.path.join(ROOT, f"item-bank/level-{n}/passages.json"), encoding="utf-8"))
    eids = {i["item_id"] for i in items}
    epids = {p["passage_id"] for p in passages}
    valid_pids = epids | {p["passage_id"] for p in new_pass}

    errs = []
    for it in new_items:
        for f in REQ:
            if f not in it: errs.append(f"{it.get('item_id','?')}: 필드 누락 {f}")
        iid = it.get("item_id", "?")
        if it.get("level") != n: errs.append(f"{iid}: level != {n}")
        if iid in eids: errs.append(f"{iid}: 기존 ID 중복")
        if it.get("domain_code") not in DOMAINS: errs.append(f"{iid}: domain_code 오류")
        if it.get("primary_domain") != it.get("domain_code"): errs.append(f"{iid}: primary_domain 불일치")
        ch = it.get("choices", [])
        if len(ch) != 4: errs.append(f"{iid}: 선택지 {len(ch)}개")
        if len(set(ch)) != len(ch): errs.append(f"{iid}: 선택지 중복")
        if not isinstance(it.get("answer"), int) or not (0 <= it.get("answer", -1) < 4):
            errs.append(f"{iid}: answer 오류 {it.get('answer')}")
        if it.get("passage_id") and it["passage_id"] not in valid_pids:
            errs.append(f"{iid}: 미존재 지문 {it['passage_id']}")
        if it.get("difficulty_tier") not in ("easy", "medium", "hard"):
            errs.append(f"{iid}: tier 오류")
        eids.add(iid)
    for p in new_pass:
        if p.get("passage_id") in epids: errs.append(f"{p.get('passage_id')}: 기존 지문 ID 중복")
        if not str(p.get("passage_id", "")).startswith(f"P-{n}-"): errs.append(f"{p.get('passage_id')}: 지문 ID 형식")

    # 영역별 +3 → 8 확인
    merged_items = items + new_items
    cnt = collections.Counter(i["domain_code"] for i in merged_items)
    short = {d: cnt[d] for d in DOMAINS if cnt[d] != 8}
    ans = collections.Counter(i["answer"] for i in new_items if isinstance(i.get("answer"), int))

    status = "OK" if not errs else f"오류 {len(errs)}건"
    print(f"L{n}: 신규 {len(new_items)}문항/{len(new_pass)}지문 → 병합후 {dict(cnt)} | 정답분포 {dict(sorted(ans.items()))} [{status}]")
    if short: print(f"     ⚠ 영역 8개 미달/초과: {short}")
    if errs:
        all_ok = False
        for e in errs[:20]: print("     -", e)
        continue

    total_new_items += len(new_items); total_new_pass += len(new_pass)
    if APPLY:
        json.dump(merged_items, open(os.path.join(ROOT, f"item-bank/level-{n}/items.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        json.dump(passages + new_pass, open(os.path.join(ROOT, f"item-bank/level-{n}/passages.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

print(f"\n{'[APPLIED]' if APPLY else '[DRY-RUN]'} 신규 합계: {total_new_items}문항, {total_new_pass}지문 | 전체검증 {'통과' if all_ok else '실패'}")
if not all_ok and APPLY:
    print("오류가 있어 일부 레벨은 병합하지 않았습니다.")
