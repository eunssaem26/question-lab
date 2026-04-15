# 맥미니 인수인계 문서

> 작성일: 2026-04-15
> 작성 환경: 맥북 → 맥미니 이전용

---

## 1. 프로젝트 가져오기

```bash
git clone https://github.com/jaegrace25/question-lab.git
cd question-lab
```

---

## 2. 맥미니에서 해야 할 설정

### Vercel 자동배포 설정

1. [vercel.com](https://vercel.com) 로그인
2. "Add New Project" → "Import Git Repository"
3. GitHub 계정 연결 → `jaegrace25/question-lab` 선택
4. 설정:
   - **Framework Preset**: Astro
   - **Root Directory**: `site`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. "Deploy" 클릭 → 이후 main push마다 자동배포

### 블로그 로컬 개발

```bash
cd site
npm install
npm run dev
# http://localhost:4321 에서 확인
```

---

## 3. 현재 프로젝트 구조

```
question-lab/
├── CLAUDE.md              ← Claude 프로젝트 지침
├── HANDOFF.md             ← 이 문서
│
├── site/                  ← Astro 블로그 (Vercel 배포 대상)
│   └── src/content/blog/  ← 블로그 원본 5편 (설립기 시리즈)
│
├── 배포/                  ← 크로스포스팅용 최적화 본문
│   ├── 가이드.md          ← 발행 체크리스트
│   ├── 브런치/            ← 브런치 최적화 5편
│   └── 네이버블로그/      ← 네이버 블로그 최적화 5편
│
├── 별쌤작업/              ← 별쌤 출제 데이터 (읽기/글쓰기 문항, 준거틀)
├── review/                ← 검수 리포트
├── blog/                  ← 블로그 초안 (site/로 이전 완료, 아카이브)
│
├── data/                  ← 교육과정 데이터, 검수 규칙
├── agents/                ← 에이전트 시스템 프롬프트
└── docs/                  ← 프로젝트 문서
```

---

## 4. 다음 작업 목록 (우선순위 순)

### 즉시 할 일
- [ ] Vercel 자동배포 설정 (위 2번 참고)
- [ ] 브런치 작가 신청 (승인 1~3일 소요)
- [ ] 네이버 블로그 개설

### 크로스포스팅 (배포 후)
- [ ] 자체 블로그 Vercel 배포 확인
- [ ] 브런치: `배포/브런치/` 5편 발행 (브런치북으로 묶기)
- [ ] 네이버 블로그: `배포/네이버블로그/` 5편 발행

### 바이브코딩 시리즈 시작
- [ ] 1편: 회고형 — "AI와 함께 교육 서비스를 바이브코딩하는 이야기" (전체 여정 소개)
- [ ] 2편: 회고형 — 구체적 에피소드 (예: Claude/Codex 협업, 캐릭터 제작 등)
- [ ] 3편~: 실시간형 — 매주 개발 과정 기록으로 전환

### 별쌤 프로젝트 (병행)
- [ ] 은쌤 검수: 읽기/글쓰기 1~2단계 문항
- [ ] 3단계 문항 출제 시작

---

## 5. 계정 정보 참고

| 서비스 | 계정 | 비고 |
|--------|------|------|
| GitHub | jaegrace25 | 맥미니에서 재로그인 필요할 수 있음 |
| Vercel | (맥미니 계정 사용) | GitHub Integration 연결 |
| 브런치 | (카카오 계정) | 작가 신청 필요 |
| 네이버 블로그 | (네이버 계정) | 블로그 개설 필요 |

---

## 6. Claude Code 메모리

`.claude/` 폴더에 프로젝트 메모리가 저장되어 있습니다.
맥미니에서 Claude Code 사용 시 자동으로 읽어옵니다.
단, `.claude/projects/` 경로가 맥 이름에 따라 달라질 수 있으므로
첫 대화에서 "메모리 확인해줘"라고 말하면 됩니다.
