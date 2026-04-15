# 문해력 평가 프로젝트 Agent 아키텍처

## 1. 목적

이 문서는 초등 3학년~중학교 3학년 대상 7단계 문해력 평가 프로젝트를
여러 agent가 분업하여 안정적으로 생성, 검수, 정비하기 위한 운영 구조를 정의한다.

핵심 목표는 다음과 같다.

- 평가 철학과 데이터 구조의 일관성 유지
- 단계별 문항 대량 생성의 속도 확보
- 문항 품질과 교육과정 정합성 확보
- 사람의 최종 검토 부담 감소

---

## 2. 전체 구조

이 프로젝트는 하나의 메인 조정자와 네 개의 작업 agent로 운영한다.

1. `Orchestrator Agent`
2. `Spec Agent`
3. `Authoring Agent`
4. `Review Agent`
5. `Schema Agent`

필요하면 이후에 `Reporting Agent`를 추가할 수 있지만, 초기에는 위 5개로 충분하다.

---

## 3. 역할 정의

### 3.1 Orchestrator Agent

프로젝트 전체 흐름을 관리하는 메인 agent다.

담당 역할:

- 단계별 작업 순서 결정
- 각 agent에 작업 할당
- 파일 소유권 충돌 방지
- 결과 취합
- 승인 전 최종 상태 정리

입력:

- 프로젝트 목표
- 현재 단계
- 우선순위
- 각 agent 결과물

출력:

- 작업 지시
- 단계별 완료 상태
- 다음 작업 순서

수정 가능 파일:

- 직접 데이터 파일을 대량 수정하지 않는다.
- 작업 지시 문서, 체크리스트, 진행 로그만 수정 가능

---

### 3.2 Spec Agent

평가 철학, 준거틀, 출제 가이드, 판정 로직을 담당한다.

담당 역할:

- 평가준거틀 유지보수
- 출제 가이드 유지보수
- 단계 기준과 성취기준 연결 검토
- 영역 분류 규칙 정의
- 스키마 기준 정의

입력:

- 교육과정 기준
- 기존 준거틀 문서
- 기존 출제 가이드
- Review Agent 피드백

출력:

- 수정된 준거틀
- 수정된 출제 가이드
- 스키마 기준
- 생성 지침

수정 가능 파일:

- `별쌤-평가준거틀.md`
- `item-bank/출제-가이드.md`
- `COLLAB_RULES.md`
- 스키마 문서

금지:

- `items.json`, `passages.json` 직접 대량 생성 금지

---

### 3.3 Authoring Agent

단계별 지문과 문항 JSON 초안을 생성하는 agent다.

담당 역할:

- `passages.json` 초안 생성
- `items.json` 초안 생성
- 레벨별 문항 추가 생성
- 지문-문항 참조 연결
- 필수 메타데이터 입력

입력:

- Spec Agent가 확정한 규칙
- 대상 단계
- 기존 passages/items 구조

출력:

- 생성된 지문 초안
- 생성된 문항 초안
- 생성 결과 요약

수정 가능 파일:

- `item-bank/passages.json`
- `item-bank/items.json`
- 필요 시 레벨별 분리 JSON

필수 준수 사항:

- 모든 문항에 `primary_domain` 입력
- 모든 문항에 `achievement_standard` 입력
- 모든 문항에 `level_differentiation` 입력
- 지문 ID는 영역 중립형 사용
- 독립형 문항은 `passage_id: null`

금지:

- 준거틀 해석을 임의 확장
- 판정 로직 변경
- 성취기준 체계 변경

---

### 3.4 Review Agent

문항의 교육과정 정합성, 영역 분류, 단계 위계를 검토한다.

담당 역할:

- 성취기준 연결 검토
- 문항이 해당 단계에 맞는지 검토
- 영역 분류 적절성 검토
- 오답 품질 검토
- 사실/의견, 추론, 구조 문항의 개념 오류 탐지

입력:

- Authoring Agent 산출물
- Spec Agent 규칙 문서

출력:

- 수정 필요 문항 목록
- 문제점 요약
- 승인 가능 여부

수정 가능 파일:

- 직접 대량 수정하지 않는 것을 원칙으로 한다.
- 별도 검수 노트 또는 피드백 문서 작성 가능

금지:

- 스키마를 임의 변경
- 생성 기준을 독단적으로 재정의

---

### 3.5 Schema Agent

JSON 구조, 참조 무결성, 필드 누락, ID 규칙을 점검하는 agent다.

담당 역할:

- 필수 필드 누락 검사
- `passage_id` 참조 무결성 검사
- 중복 ID 검사
- `level`, `domain_code`, `primary_domain` 일관성 검사
- `item_type`과 `answer` 타입 정합성 검사

입력:

- `items.json`
- `passages.json`
- 스키마 기준 문서

출력:

- 구조 오류 목록
- 정합성 체크 결과
- 수정 권고

수정 가능 파일:

- 원칙적으로 직접 수정하지 않는다.
- 필요 시 자동 수정 가능한 항목만 제안한다.

---

## 4. 권장 작업 흐름

단계별 작업은 아래 순서를 기본으로 한다.

1. `Spec Agent`가 해당 단계 규칙과 예외를 확정한다.
2. `Authoring Agent`가 passages/items 초안을 만든다.
3. `Schema Agent`가 구조 검사를 수행한다.
4. `Review Agent`가 문항 품질 검수를 수행한다.
5. `Orchestrator Agent`가 결과를 취합한다.
6. 수정 필요 시 `Authoring Agent`가 반영한다.
7. 다시 `Schema Agent`와 `Review Agent`가 재확인한다.
8. 최종 승인 후 다음 단계로 넘어간다.

---

## 5. 단계별 운영 전략

### Phase 1. 기반 정비

목표:

- 준거틀 확정
- 출제 가이드 확정
- JSON 스키마 확정
- 1단계 파일 구조 정비

주 담당:

- `Spec Agent`
- `Schema Agent`

### Phase 2. 단계별 생성

목표:

- 2~7단계 passages/items 초안 생성

주 담당:

- `Authoring Agent`

지원:

- `Schema Agent`
- `Review Agent`

### Phase 3. 종합 검수

목표:

- 1~7단계 위계 검토
- 영역별 균형 검토
- 판정 엔진 연결 가능성 확인

주 담당:

- `Review Agent`
- `Spec Agent`

### Phase 4. 서비스 연결 준비

목표:

- API/DB 적재용 구조 정비
- 진단 폼 조립 규칙 정의
- 라우팅/판정 엔진 입력 구조 확정

주 담당:

- `Spec Agent`
- `Schema Agent`

---

## 6. 파일 소유권

### Spec Agent 소유

- `별쌤-평가준거틀.md`
- `item-bank/출제-가이드.md`
- `COLLAB_RULES.md`
- 판정 로직 문서
- 스키마 문서

### Authoring Agent 소유

- `item-bank/items.json`
- `item-bank/passages.json`
- 레벨별 분리 산출물

### Review Agent 소유

- 검수 리포트
- 피드백 문서

### Schema Agent 소유

- 정합성 검사 리포트
- 스키마 체크 결과 문서

---

## 7. 충돌 방지 규칙

1. 같은 순간에 둘 이상의 agent가 같은 파일을 수정하지 않는다.
2. `items.json`과 `passages.json`은 한 번에 한 agent만 편집한다.
3. 준거틀과 출제 가이드가 변경되면, Authoring Agent는 새 규칙을 반영하기 전까지 생성 작업을 일시 중지한다.
4. Review Agent는 직접 대량 수정하지 않고 피드백 우선 원칙을 따른다.
5. Schema Agent는 구조 문제를 고쳐 쓰기보다 먼저 보고한다.

---

## 8. 입출력 계약

각 agent는 아래 형식으로 결과를 남기는 것을 권장한다.

### Spec Agent 출력 형식

- 변경한 규칙
- 변경 이유
- 생성/검수에 미치는 영향

### Authoring Agent 출력 형식

- 생성한 단계
- 생성한 지문 수
- 생성한 문항 수
- 예외 처리한 항목
- 검수 필요 항목

### Review Agent 출력 형식

- 치명 문제
- 수정 권고
- 승인 가능 여부

### Schema Agent 출력 형식

- 누락 필드
- 중복 ID
- 잘못된 참조
- 타입 오류

---

## 9. 품질 게이트

아래 조건을 모두 만족해야 다음 단계로 넘어간다.

1. 필수 필드 누락 없음
2. `passage_id` 참조 오류 없음
3. 단계-영역-성취기준 연결 가능
4. 문항이 해당 단계의 평가 초점과 일치
5. 사실/의견, 구조, 추론 개념 오류 없음
6. 지문 길이 기준 충족
7. 지문 주제의 배경지식 의존이 과도하지 않음

---

## 10. 추천 실행 방식

### 소규모 운영

- 사람 1명 + Codex + Claude
- 사람은 `Orchestrator`
- Codex는 `Spec Agent` + `Review Agent`
- Claude는 `Authoring Agent`
- 간단 스크립트나 사람이 `Schema Agent` 역할 수행

### 확장 운영

- Codex: `Spec Agent`
- Claude A: `Authoring Agent` for passages
- Claude B: `Authoring Agent` for items
- Codex or 별도 agent: `Review Agent`
- 스크립트/agent: `Schema Agent`

초기에는 소규모 운영이 더 안정적이다.

---

## 11. 현재 프로젝트에 대한 권장 배치

현재 가장 현실적인 구조는 다음과 같다.

- 사람: `Orchestrator`
- Codex: `Spec Agent` + `Review Agent`
- Claude: `Authoring Agent`
- 검사용 스크립트 또는 별도 경량 agent: `Schema Agent`

이 배치의 장점:

- 규칙 변경 권한이 한쪽에 모인다.
- Claude는 생성에 집중할 수 있다.
- 구조 검사는 자동화하기 쉽다.
- 문항 품질 검수는 Codex가 일관되게 유지할 수 있다.

---

## 12. 다음 단계

이 문서를 바탕으로 바로 이어서 만들 수 있는 것은 다음과 같다.

1. agent별 실행 프롬프트 템플릿
2. Schema Agent용 JSON 검사 체크리스트
3. 단계별 생성 배치 계획표
4. Claude용 실제 작업 프롬프트

