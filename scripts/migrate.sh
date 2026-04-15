#!/bin/bash
# ============================================================
# F단계 전송 패키지: 현재 파일 → 목표 구조 마이그레이션
# 기준 문서: DATA_DESIGN.md 섹션 9
#
# 사용법:
#   bash scripts/migrate.sh          # dry-run (미리보기만)
#   bash scripts/migrate.sh --run    # 실제 실행
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRY_RUN=true

if [[ "${1:-}" == "--run" ]]; then
  DRY_RUN=false
fi

# --- 유틸리티 ---

move_file() {
  local src="$1" dst="$2"
  if [[ ! -e "$src" ]]; then
    echo "  [SKIP] 원본 없음: $src"
    return
  fi
  local dst_dir
  dst_dir="$(dirname "$dst")"
  if $DRY_RUN; then
    echo "  [DRY] $src → $dst"
  else
    mkdir -p "$dst_dir"
    mv "$src" "$dst"
    echo "  [OK]  $src → $dst"
  fi
}

section() {
  echo ""
  echo "=== $1 ==="
}

# ============================================================
section "1. reference/ → knowledge/"
# ============================================================

move_file "$ROOT/reference/achievement-standards.json" \
          "$ROOT/knowledge/curriculum/reading-achievement-standards.json"

move_file "$ROOT/reference/writing-achievement-standards.json" \
          "$ROOT/knowledge/curriculum/writing-achievement-standards.json"

move_file "$ROOT/reference/benchmark-analysis.md" \
          "$ROOT/knowledge/curriculum/benchmark-analysis.md"

move_file "$ROOT/reference/schema.json" \
          "$ROOT/knowledge/schema/schema.json"

# ============================================================
section "2. item-bank/ 가이드 문서 → diagnosis/guides/"
# ============================================================

move_file "$ROOT/item-bank/출제-가이드.md" \
          "$ROOT/diagnosis/guides/출제-가이드.md"

move_file "$ROOT/item-bank/글쓰기-출제-가이드.md" \
          "$ROOT/diagnosis/guides/글쓰기-출제-가이드.md"

move_file "$ROOT/item-bank/통합-검사-조립-규칙.md" \
          "$ROOT/diagnosis/guides/통합-검사-조립-규칙.md"

# ============================================================
section "3. item-bank/ 문항 → diagnosis/item-bank/"
# ============================================================

# 읽기 - 루트 레거시 파일
move_file "$ROOT/item-bank/passages.json" \
          "$ROOT/diagnosis/item-bank/reading/legacy/passages.json"

move_file "$ROOT/item-bank/items.json" \
          "$ROOT/diagnosis/item-bank/reading/legacy/items.json"

# 읽기 - 단계별
for level_dir in "$ROOT/item-bank/level-"*; do
  if [[ -d "$level_dir" ]]; then
    level_name="$(basename "$level_dir")"
    for f in "$level_dir"/*; do
      [[ -e "$f" ]] || continue
      move_file "$f" "$ROOT/diagnosis/item-bank/reading/$level_name/$(basename "$f")"
    done
  fi
done

# 글쓰기 - 단계별
for level_dir in "$ROOT/item-bank/writing/level-"*; do
  if [[ -d "$level_dir" ]]; then
    level_name="$(basename "$level_dir")"
    for f in "$level_dir"/*; do
      [[ -e "$f" ]] || continue
      move_file "$f" "$ROOT/diagnosis/item-bank/writing/$level_name/$(basename "$f")"
    done
  fi
done

# ============================================================
section "4. 루트 한국어 파일 → diagnosis/"
# ============================================================

# 준거틀 (사람용)
move_file "$ROOT/별쌤-평가준거틀.md" \
          "$ROOT/diagnosis/frameworks/별쌤-평가준거틀.md"

move_file "$ROOT/글쓰기-평가준거틀.md" \
          "$ROOT/diagnosis/frameworks/글쓰기-평가준거틀.md"

# 준거틀 (기계용)
move_file "$ROOT/framework.json" \
          "$ROOT/diagnosis/frameworks/reading-framework.json"

move_file "$ROOT/writing-framework.json" \
          "$ROOT/diagnosis/frameworks/writing-framework.json"

# 가이드 문서
move_file "$ROOT/글쓰기-35셀-성취기준-매핑표.md" \
          "$ROOT/diagnosis/guides/글쓰기-35셀-매핑표.md"

move_file "$ROOT/글쓰기-35셀-출제-청사진.md" \
          "$ROOT/diagnosis/guides/글쓰기-35셀-청사진.md"

move_file "$ROOT/글쓰기-진단평가-분석및수준별문항초안.md" \
          "$ROOT/diagnosis/guides/글쓰기-진단평가-분석및수준별문항초안.md"

move_file "$ROOT/글쓰기-출제-가이드-위계및정합성-검토.md" \
          "$ROOT/diagnosis/guides/글쓰기-출제-가이드-위계및정합성-검토.md"

# ============================================================
section "5. 별쌤작업/ 분해 (최종본 우선)"
# ============================================================

# "최종" 표기 파일이 정본 → 기존 위치 덮어쓰기
move_file "$ROOT/별쌤작업/글쓰기-출제-가이드-최종.md" \
          "$ROOT/diagnosis/guides/글쓰기-출제-가이드.md"

move_file "$ROOT/별쌤작업/통합-검사-조립-규칙-최종.md" \
          "$ROOT/diagnosis/guides/통합-검사-조립-규칙.md"

# 별쌤작업/ 내 준거틀 (루트 사본과 동일하면 스킵 — 이미 4단계에서 이동)
if [[ -e "$ROOT/별쌤작업/별쌤-평가준거틀.md" ]]; then
  echo "  [INFO] 별쌤작업/별쌤-평가준거틀.md — 루트 사본과 diff 비교 필요"
  if ! $DRY_RUN; then
    if [[ -e "$ROOT/diagnosis/frameworks/별쌤-평가준거틀.md" ]]; then
      if diff -q "$ROOT/별쌤작업/별쌤-평가준거틀.md" "$ROOT/diagnosis/frameworks/별쌤-평가준거틀.md" > /dev/null 2>&1; then
        echo "  [SKIP] 동일 파일 — 별쌤작업 사본 제거"
        rm "$ROOT/별쌤작업/별쌤-평가준거틀.md"
      else
        echo "  [WARN] 내용 차이 있음 — 수동 비교 필요"
      fi
    fi
  fi
fi

# 별쌤작업/ 내 출제-가이드 (별쌤작업 버전은 item-bank 사본보다 오래될 수 있음)
move_file "$ROOT/별쌤작업/출제-가이드.md" \
          "$ROOT/diagnosis/guides/출제-가이드-별쌤작업본.md"

# 별쌤작업/ 내 passages/items 마크다운 (JSON 변환 검토 대상)
move_file "$ROOT/별쌤작업/passages (1-7).md" \
          "$ROOT/diagnosis/item-bank/reading/drafts/passages-1-7.md"

move_file "$ROOT/별쌤작업/items (1-7).md" \
          "$ROOT/diagnosis/item-bank/reading/drafts/items-1-7.md"

move_file "$ROOT/별쌤작업/passages (2-7).md" \
          "$ROOT/diagnosis/item-bank/reading/drafts/passages-2-7.md"

move_file "$ROOT/별쌤작업/items (2-7).md" \
          "$ROOT/diagnosis/item-bank/reading/drafts/items-2-7.md"

move_file "$ROOT/별쌤작업/passages.json" \
          "$ROOT/diagnosis/item-bank/reading/drafts/passages-별쌤작업.json"

# 별쌤작업/ 내 주의사항
move_file "$ROOT/별쌤작업/900.주의사항.md" \
          "$ROOT/review/checklists/별쌤-주의사항.md"

# 별쌤작업/ 내 구버전 아키텍처
if [[ -e "$ROOT/별쌤작업/AGENT_ARCHITECTURE.md" ]]; then
  echo "  [INFO] 별쌤작업/AGENT_ARCHITECTURE.md — 구버전, 아카이브 대상"
  if ! $DRY_RUN; then
    mkdir -p "$ROOT/archive"
    mv "$ROOT/별쌤작업/AGENT_ARCHITECTURE.md" "$ROOT/archive/AGENT_ARCHITECTURE-별쌤작업.md"
    echo "  [OK]  archive/AGENT_ARCHITECTURE-별쌤작업.md"
  fi
fi

# 별쌤작업/ 도구 설정 제거
if ! $DRY_RUN; then
  rm -rf "$ROOT/별쌤작업/.claude" "$ROOT/별쌤작업/.obsidian" 2>/dev/null || true
  echo "  [OK]  별쌤작업/.claude, .obsidian 제거"
fi

# ============================================================
section "6. 빈 폴더 정리"
# ============================================================

if ! $DRY_RUN; then
  # reference/ 비었으면 제거
  rmdir "$ROOT/reference" 2>/dev/null && echo "  [OK]  reference/ 제거 (빈 폴더)" || true
  # item-bank/ 하위 빈 폴더 재귀 제거
  find "$ROOT/item-bank" -type d -empty -delete 2>/dev/null || true
  rmdir "$ROOT/item-bank" 2>/dev/null && echo "  [OK]  item-bank/ 제거 (빈 폴더)" || true
  # 별쌤작업/ 비었으면 제거
  find "$ROOT/별쌤작업" -type d -empty -delete 2>/dev/null || true
  rmdir "$ROOT/별쌤작업" 2>/dev/null && echo "  [OK]  별쌤작업/ 제거 (빈 폴더)" || true
fi

# ============================================================
section "7. 경로 참조 점검 알림"
# ============================================================

echo ""
echo "[TODO] 마이그레이션 완료 후 아래 파일의 경로 참조를 점검하세요:"
echo "  - AGENT_ARCHITECTURE.md (섹션 8)"
echo "  - agents/*.md (데이터 접근 권한 섹션)"
echo "  - DATA_DESIGN.md (섹션 9 매핑표 — 완료 표시)"
echo "  - scripts/validate.js (입력 경로)"
echo ""

if $DRY_RUN; then
  echo "=== DRY RUN 완료 ==="
  echo "실제 실행하려면: bash scripts/migrate.sh --run"
else
  echo "=== 마이그레이션 완료 ==="
fi
