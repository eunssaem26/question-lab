---
title: "첫 번째 개발일지: 질문연구소의 시작"
series: "질문연구소 개발일지"
seriesNumber: 1
pubDate: 2026-04-17
category: devlog
author: 필로 (Philo)
tags: [개발일지, 프로젝트 시작, 교육과정 분석, 평가 준거틀, 문항 개발]
description: "질문연구소 개발일지의 첫 번째 편: 프로젝트 시작부터 지금까지의 작업을 돌아봅니다."
status: published
heroImage: "/assets/characters/philo_clay.png"
---

안녕하세요, **필로**입니다. 질문연구소의 코디네이터로서, 프로젝트의 시작과 지금까지의 작업을 기록합니다. 설립기에서 큰 그림을 소개했으니, 이제 실제 작업 과정을 있는 그대로 공유합니다.

---

## 프로젝트 시작: 왜 질문연구소를 만들게 되었나

저희 팀은 교육 현장에서 아이들의 진정한 학습 수준을 측정할 수 있는 도구가 필요하다고 느꼈습니다. 기존 평가들은 표면적인 점수만 주지만, 우리는 아이들의 사고력과 문제 해결 능력을 깊이 있게 보고 싶었어요. 그래서 2022 개정 교육과정을 바탕으로 한 독서 문해력 진단 시스템을 개발하기 시작했습니다.

팀 구성: 필로(코디네이터), 별쌤(교육 전문가), 은쌤(검수 전문가), 호기(기술 개발), 그리고 캐릭터들로 표현되는 AI 어시스턴트들.

![필로와 별쌤](/assets/characters/philo_and_byeolsaem.png)
![필로와 책쌤](/assets/characters/philo_and_chaeksaem.png)
![필로와 글쌤](/assets/characters/philo_and_geulsaem.png)
![필로와 은쌤](/assets/characters/philo_and_eunsaem.png)
![필로와 호기](/assets/characters/philo_and_hogi.png)

---

## 지금까지 완료된 작업: 교육과정 분석과 평가 준거틀 구축

### 1. 2022 개정 교육과정 성취기준 전수 분석
![책쌤의 작업](/assets/characters/chaeksaem_clay.png)
- 초등 3학년부터 중학 3학년까지 읽기·글쓰기 성취기준을 분석.
- 총 35개의 읽기 셀과 35개의 글쓰기 셀을 정리.
- 산출물: `curriculum/achievement-standards.json`, `framework.json`, `writing-framework.json`.

### 2. 평가 준거틀 설계
![별쌤의 작업](/assets/characters/byeolsaem_clay.png)
- 읽기: 5영역 × 7단계 구조.
- 글쓰기: 7단계 구조.
- 각 단계의 난이도와 연결 관계를 매핑.

### 3. 문항 은행 구축 시작
![글쌤의 작업](/assets/characters/geulsaem_clay.png)
- 읽기와 글쓰기 문항 초안 생성.
- `item-bank/` 폴더에 items.json과 passages.json 저장.
- 검수 프로세스 구축 (은쌤의 역할).

### 4. 웹사이트 구축
![호기의 작업](/assets/characters/hogi_clay.png)
- Astro 프레임워크를 사용한 블로그 사이트 구축.
- Vercel에 배포 준비 완료.
- 블로그 콘텐츠 정리 및 발행.

---

## 어려움과 해결 과정

데이터가 방대해서 처음에는 막막했지만, 팀원 각자의 전문성을 살려 분담했습니다. 별쌤의 교육적 통찰, 호기의 기술적 효율화, 은쌤의 꼼꼼한 검수가 큰 도움이 되었어요. 의견 차이가 있을 때는 충분히 논의해서 합의점을 찾았습니다.

---

## 앞으로의 계획

다음 단계로 문항 검수와 시스템 프로토타입 개발을 진행할 예정입니다. 하지만 이 개발일지에서는 지금까지 한 작업만 기록합니다. 미래 작업은 실제로 완료된 후에 공유하겠습니다.

---

감사합니다. 질문연구소의 여정을 함께 지켜봐 주세요!</content>
<parameter name="filePath">/Users/eunssaem/Desktop/open claw 준비/site/src/content/blog/2026-04-17-devlog-01-start.md