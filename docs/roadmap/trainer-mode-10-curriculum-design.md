# Trainer Mode 10: Knowledge·Skill 자동 분류 & 커리큘럼 생성

> **상태 (2026-08-07)**: 미채택 로드맵 — `agents/trainer.md`에 "(로드맵, 미구현) ... 스킬 미신설. 필요 시 별도
> 신설 판정(§2.2 신설 판정 트리)을 먼저 거칠 것"으로 남아있을 뿐, 실제 모드로 구현되지 않았다. 이 문서는
> `malgn-agent` 플러그인(고객 배포 대상)이 아니라 이 저장소(`claude-plugins`) 자신의 설계 메모로 이관됨 —
> 배포판 knowledge에 미구현 기능을 실재하는 것처럼 남겨두면 방법론 rubric §7.4(경로 실재 대조)를 위반하기
> 때문. 향후 실제로 착수할 때 이 설계를 출발점으로 삼되, 착수 전 §2.2 신설 판정을 거칠 것.

## 1. 목표 및 정의

### Why Mode 10?
에이전트의 신규 채용·온보딩 또는 기존 에이전트의 스킬업을 계획할 때, **"이 에이전트가 어떤 스킬을 어느 깊이로 학습해야 하는가"**를 체계적으로 설계하고 실행 가능한 14일 커리큘럼으로 변환한다.

### What is Mode 10?
입력: 특정 에이전트(또는 에이전트 그룹) 선택
→ 처리: 
  - 그 에이전트가 참조하는 10개 공통 스킬 + 도메인 스킬 수집
  - 각 스킬에서 "Skill" (실행형 체크리스트) vs "Knowledge" (학습형 배경) 부분 자동 분류
  - 에이전트 MD의 "학습 루프" 섹션과 매핑
  - 14일 온보딩 커리큘럼 자동 생성
→ 출력: markdown 커리큘럼 파일 + 학습 체크리스트 + 시간 투입 추정치

### 사용 사례
```
"reviewer 온보딩 커리큘럼 만들어줘" 
→ Trainer: 10개 공통 스킬 + reviewer 도메인 스킬 수집 
→ Skill vs Knowledge 분류 → 14일 일정표 생성 
→ 신입 reviewer가 즉시 활용 가능
```

---

## 2. 실행 절차 (4단계)

### Step 1: 에이전트 프로필 수집 (Phase 0 — 30분)
**입력**: 에이전트명 (예: `reviewer`, `qa-engineer`)

**수행**:
1. 대상 에이전트 MD (플러그인 번들 `agents/<이름>.md`) 읽기
2. MD의 "## 스킬 상세" 섹션 추출 → 참조하는 모든 스킬 식별
   - 10개 공통 스킬 (1순위/2순위/3순위)
   - 도메인 스킬 (프로젝트별/역할별)
3. MD의 "## 학습 루프" 섹션 추출 (있으면) → 현재 학습 방식 파악
4. "## 책임" 섹션 추출 → 우선순위 작업 식별

**출력**: 
```
에이전트: reviewer
- 공통 스킬: token-efficient-collaboration, beyond-mediocre-output, training-scorecard-eval (3/10)
- 도메인 스킬: code-review, security-review, architecture-review (3개)
- 핵심 책임: 산출물 다관점 검증 (진단 1순위)
```

---

### Step 2: 스킬별 Skill vs Knowledge 분류 (Phase 1 — 1시간)
**입력**: Step 1의 스킬 목록

**수행** (각 스킬마다):
1. 해당 스킬 파일 읽기 (플러그인 번들 `skills/common-<이름>/SKILL.md` 또는 `skills/<도메인>-<이름>/SKILL.md`)
2. 스킬 파일를 2부로 분류:
   - **Skill 파트**: "## Checklist", "## Procedure" (짧은 순서 1~8단계)
     - 특징: 실행 가능한 단계, 체크 항목, 3~5분 읽기
     - 대상: 처음 배우는 사람도 따라 할 수 있는 절차
   - **Knowledge 파트**: "## When to Use", "## Anti-patterns", "## Inputs", 배경 설명
     - 특징: 개념, 반례, 트레이드오프, 15~30분 읽기
     - 대상: 왜 이렇게 하는지 이해하려는 사람
3. 분류 결과를 메타데이터로 기록
   ```
   Skill (2~5분): Procedure 1~5 + Checklist
   Knowledge (15~20분): When/Anti-patterns/개념 설명
   ```

**참고**: 신설 판정 정본은 플러그인 번들 `agents/trainer.md`의 "반영 매체 판단(skill vs knowledge)" 항목
- **Skill**: 재사용 가능한 절차/기법, 실행 체크리스트 중심, 3~5분 읽기
- **Knowledge**: 도메인별 교훈·사례·개념, 배경 학습, 15~30분 읽기

---

### Step 3: 커리큘럼 일정표 생성 (Phase 2 — 1시간)
**입력**: Step 2의 분류 결과

**수행**:
1. 14일을 4 구간으로 나누기:
   - **Day 1~3**: 필수 공통 스킬 3개 (체크리스트만, Skill 파트만)
   - **Day 4~7**: 도메인 스킬 (Skill 파트 우선, Knowledge는 선택)
   - **Day 8~10**: Knowledge 깊은 학습 (배경 개념, 반례, 트레이드오프)
   - **Day 11~14**: 프로젝트 교훈 적용 (lessons/ 파일 + 실제 산출물 검토)

2. 각 Day별로 타임라인 지정:
   - 구체 시간 (예: "오전 1시간 + 오후 30분")
   - 선행 조건 ("Day 1 완료 필수")
   - 검증 방법 ("자가 체크리스트" vs "실제 산출물 검토")

3. 우선순위 판단 로직:
   - **필수 공통 스킬**: token-efficient, beyond-mediocre, product-principles 고정
   - **도메인 스킬**: 에이전트 MD "## 책임"에서 "산출물" 키워드 빈도 + 모드 사용 빈도로 rank
   - **Knowledge**: Day 8~10에만 배치, 선택사항 (시간 여유 있을 때)

---

### Step 4: 체크리스트 & 커리큘럼 파일 생성 (Phase 3 — 1시간)
**입력**: Step 3의 일정표

**수행**:
1. 산출 파일 생성 경로: `~/.claude/knowledge/curriculum/onboarding-<에이전트명>-14d.md`
2. 파일 구조:
   ```md
   # 14일 온보딩 커리큘럼: [에이전트명]
   
   ## 개요
   - 대상: [역할]
   - 기간: 14일 (총 X시간)
   - 핵심 목표: [산출물 3개]
   - 사전요구사항: [선행 학습 1~2개]
   
   ## Day 1~3: 필수 공통 스킬 (Skill 파트만)
   - Day 1: [스킬1] — [체크리스트 1~3]
   - Day 2: [스킬2] — [체크리스트 1~3]
   - Day 3: [스킬3] — [체크리스트 1~3]
   
   ## Day 4~7: 도메인 스킬 (Skill 우선)
   - Day 4~5: [도메인스킬1] — Skill 파트
   - Day 6~7: [도메인스킬2] — Skill 파트 + 선택 Knowledge
   
   ## Day 8~10: Knowledge 깊은 학습 (선택, 시간 여유 시)
   - Day 8: [스킬1의 Knowledge] — 개념, 반례
   - Day 9~10: [도메인스킬1의 Knowledge] — 트레이드오프, 사례 분석
   
   ## Day 11~14: 프로젝트 교훈 & 실제 산출물
   - Day 11: lessons/ 파일 3개 읽기
   - Day 12~14: 실제 산출물 (3~5개) 리뷰 + 체크리스트 적용
   
   ## 타임라인 & 리소스
   [표: 요일/시간/활동/선행조건/검증]
   
   ## 학습 체크리스트
   [전체 항목 간편 체크리스트]
   ```

3. 학습 체크리스트 생성 (별도 섹션):
   ```md
   ## 체크리스트 (학습자용)
   
   ### Day 1~3: 필수 공통 스킬
   - [ ] [Skill1] Procedure 1~5 읽음
   - [ ] [Skill1] Checklist 자가채점 완료
   - [ ] [Skill1] 1회 적용 (실제 작업 또는 시뮬레이션)
   ...
   ```

**검증**:
- 전체 시간 총합 ≤ 40시간 (14일/5일주 = 8시간/일 기준)
- Day 1~3 필수 스킬 3개 ✓
- Day 11~14에 lessons/ + 산출물 검토 포함 ✓

---

## 3. 출력 형식 (커리큘럼 탬플릿)

### 파일 구조
```
~/.claude/knowledge/curriculum/
├── onboarding-reviewer-14d.md          (메인 커리큘럼)
├── onboarding-qa-engineer-14d.md
├── onboarding-architect-14d.md
└── README.md (인덱스)
```

### 커리큘럼 파일 (상세 템플릿)

```markdown
# 14일 온보딩 커리큘럼: [에이전트 역할명]

**작성일**: 2026-07-10 | **대상**: [에이전트명] | **버전**: 1.0

## 개요 & 목표

### 학습 대상
- **역할**: [예: Code Review 전문가]
- **핵심 책임**: [3개 주요 업무]
- **산출물**: [3~5개 주요 산출물 예시]

### 기간 & 투입량
- **기간**: 14일 (2주, 월~금 8시간/일)
- **총 투입시간**: X시간
  - Day 1~3: 12시간 (필수 공통 스킬)
  - Day 4~7: 16시간 (도메인 스킬)
  - Day 8~10: 8시간 (Knowledge 심화, 선택)
  - Day 11~14: 12시간 (프로젝트 교훈 + 실제 산출물)

### 사전 요구사항
- [ ] Claude Code CLI 설치 및 기본 사용법 (2시간)
- [ ] 프로젝트 repository clone 및 구조 파악 (1시간)
- [ ] malgnai-mcp 기본 도구 소개 (1시간)

---

## Day 1~3: 필수 공통 스킬 (Skill 파트만 — 실행형)

**목표**: "즉시 적용 가능한 절차를 3개 배우기" → 첫 작업부터 품질 기준 적용

### Day 1: 토큰 효율 협업 (common-token-efficient-collaboration)

**시간**: 4시간 (오전 2h + 오후 2h)
**선행**: 프로젝트 구조 파악 (사전요구사항)

**활동**:
1. 플러그인 번들 `skills/common-token-efficient-collaboration/SKILL.md` **Skill 파트 읽기** (30분)
   - Procedure: 점진적 코드 읽기, 필요한 부분만 Read
   - Checklist: 5항목 이상 체크
2. 실제 프로젝트에서 (또는 시뮬레이션):
   - 파일 3개를 "한 번에" 읽지 말고 Grep/Glob으로 찾기 (1시간)
   - Read 도구로 필요한 구간만 추출 (1시간)
   - 자가 체크리스트 완료 (1시간)

**검증 방법**:
```
Checklist 항목:
- [ ] Grep/Glob으로 위치를 먼저 찾는가?
- [ ] 파일 전체가 아닌 특정 라인 범위만 Read하는가? (limit/offset 사용)
- [ ] 설명은 3줄 이내인가?
- [ ] 불필요한 파일 읽기를 건너뛰었는가?
```

---

### Day 2: 평범을 넘기 (common-beyond-mediocre-output)

**시간**: 4시간 (오전 2h + 오후 2h)
**선행**: Day 1 완료

**활동**:
1. 플러그인 번들 `skills/common-beyond-mediocre-output/SKILL.md` **Skill 파트 읽기** (30분)
   - Checklist: 8항목 이상 체크 (산출물 품질 기준)
2. 기존 산출물 3개 (같은 역할의 선배 에이전트가 만든 것) 분석:
   - "평범" vs "우수" 판별 연습 (1.5시간)
   - 자체 산출물 1개(또는 과제) 품질 자가진단 (1시간)
   - 멘토 피드백 (1시간, 선택)

**검증 방법**:
```
자가진단 결과:
- 산출물이 "명확함, 완성도, 검증 가능성" 3가지를 모두 만족하는가?
- Checklist 8개 항목 중 몇 개를 충족했는가?
```

---

### Day 3: 제품 원칙 참조 (common-product-principles-reference)

**시간**: 4시간 (오전 2h + 오후 2h)
**선행**: Day 1~2 완료

**활동**:
1. 플러그인 번들 `skills/common-product-principles-reference/SKILL.md` **Skill 파트 읽기** (30분)
   - Checklist: 5항목 (의사결정 기준)
2. 실제 프로젝트의 의사결정 3개 케이스 분석:
   - "이 결정이 제품 원칙을 따르는가?" 검토 (1.5시간)
   - 본인의 의사결정 1개 재검토 (1시간)
   - 팀 리뷰 (1시간, 선택)

**검증 방법**:
```
Checklist:
- [ ] 제품 원칙 3개를 명확히 말할 수 있는가?
- [ ] 의사결정 3개를 각각 원칙과 매핑했는가?
- [ ] 기준을 "느낌"이 아닌 "규칙"으로 설명할 수 있는가?
```

---

## Day 4~7: 도메인 스킬 (Skill 우선 + 선택 Knowledge)

**목표**: "역할 고유의 기술 4개 배우기" → 도메인 전문가 기초 다지기

### Day 4~5: [도메인 스킬 1명]

**시간**: 8시간 (Day 4: 4h, Day 5: 4h)
**선행**: Day 3 완료

**활동**:
1. 스킬 파일 **Skill 파트 읽기** (1시간)
   - Procedure: [구체 8단계]
   - Checklist: [5~10항목]
2. 실제 작업 수행 (또는 과제):
   - 준비 (1시간): 입력값 수집, Work Order 읽기
   - 절차 따라하기 (3시간): Procedure 1~8 각 단계 이행 + 체크
   - 검증 (2시간): 산출물 자가검수 + 멘토 피드백 (선택)
3. 복습 (1시간): Checklist 재확인, 개선점 기록

**검증 방법**:
```
Checklist (필수):
- [ ] Procedure 1~8을 모두 수행했는가?
- [ ] 산출물이 기대 결과를 충족하는가?
- [ ] Checklist X개 항목을 모두 체크했는가?
- [ ] 차후 반복 시 "빠른 참조용" 메모를 남겼는가?
```

---

### Day 6~7: [도메인 스킬 2명] + Knowledge 선택

**시간**: 8시간 (Day 6: 4h, Day 7: 4h)
**선행**: Day 4~5 완료

**활동** (Day 4~5와 동일 구조):
1. Skill 파트 읽기 (1시간)
2. 실제 작업 (3시간)
3. 검증 (2시간)
4. **선택: Knowledge 파트** (선택, 1시간)
   - 이 스킬의 "반례·트레이드오프" 섹션 읽기
   - "왜 이렇게 할까?"를 이해하는 단계

---

## Day 8~10: Knowledge 깊은 학습 (선택 — 시간 여유 시)

**목표**: "왜 이렇게 할까?"를 깊이 있게 이해하기

**대상**:
- Day 1~3의 공통 스킬 중 이해 부족한 1개
- Day 4~7의 도메인 스킬 중 실패 사례를 경험한 1~2개
- (시간 여유 시) 다른 에이전트의 케이스 스터디 1개

**활동** (Day 8): 4시간
1. 스킬의 **Knowledge 파트 읽기** (1.5시간)
   - When to Use, Anti-patterns, 개념 설명
2. 관련 교훈 파일 읽기 (1시간)
   - `~/.claude/knowledge/lessons/` 중 연관 파일 2~3개
3. 실패 사례 분석 (1.5시간)
   - "이 반례가 내 작업에서 나타날 수 있는가?" 자가진단

**활동** (Day 9~10): 각 4시간
- 도메인 스킬 2개의 Knowledge 심화 (Day 9: 스킬1, Day 10: 스킬2)

---

## Day 11~14: 프로젝트 교훈 & 실제 산출물

**목표**: "배운 절차를 실제 맥락에서 적용하기"

### Day 11: 프로젝트 교훈 수집 (4시간)

**활동**:
1. `~/.claude/knowledge/lessons/` 중 관련 파일 3개 읽기 (1시간)
   - 예: `lessons/[프로젝트명]-*.md`, `lessons/[역할명]-*.md`
2. 각 교훈에서 "이 에이전트에 적용 가능한가?" 판별 (1시간)
3. 교훈과 Day 1~3의 공통 스킬 매핑 (1시간)
   - "토큰 효율" 원칙이 이 교훈에서 어떻게 나타나는가?
4. 자체 학습 메모 작성 (1시간)

**검증**:
```
이 단계 후 다음을 설명할 수 있는가?
- 프로젝트가 겪은 주요 실패 3개
- 각 실패를 예방하는 "이 에이전트의 역할"
- Day 1~3의 공통 스킬이 이를 어떻게 도와주는가?
```

---

### Day 12~14: 실제 산출물 리뷰 & 체크리스트 적용 (12시간)

**활동**:
1. 선배 에이전트 또는 같은 역할의 산출물 3~5개 수집 (1시간)
2. 각 산출물별로 (2시간×3=6시간):
   - Skill 체크리스트 적용 (Day 1~7 배운 절차가 보이는가?)
   - 품질 진단 (beyond-mediocre 기준으로 평가)
   - 개선 제안 3개 작성
3. 팀 피드백 & 상호 검토 (4시간, 선택)
   - 동료 또는 멘토와 함께 산출물 검토
   - 실제 개선 반영

**최종 검증**:
```
Day 12~14 후 자가진단:
- [ ] 산출물 3개를 Skill 체크리스트로 평가할 수 있는가?
- [ ] "이 부분이 Day X에서 배운 절차를 따르지 않음" 지적할 수 있는가?
- [ ] 본인의 첫 산출물에 Day 1~3의 공통 스킬 3개 모두 적용했는가?
```

---

## 타임라인 & 리소스 (한눈에)

| Day | 요일 | 구간 | 내용 | 선행조건 | 검증 | 소요시간 |
|-----|------|------|------|---------|------|---------|
| 1 | 월 | 전일 | 토큰 효율 협업 | 사전요구 | Checklist 체크 | 4h |
| 2 | 화 | 전일 | 평범을 넘기 | Day 1 | 자가진단 | 4h |
| 3 | 수 | 전일 | 제품 원칙 | Day 1~2 | 의사결정 3개 매핑 | 4h |
| 4~5 | 목~금 | 전일 | 도메인 스킬 1 | Day 3 | 실제 산출물 | 8h |
| 6~7 | 월~화 | 전일 | 도메인 스킬 2 | Day 5 | 실제 산출물 | 8h |
| 8~10 | 수~금+월 | 오전 | Knowledge 심화 (선택) | Day 7 | 개념 설명 | 0~12h |
| 11 | 화 | 전일 | 교훈 수집 | Day 10 | 메모 | 4h |
| 12~14 | 수~금 | 전일 | 산출물 리뷰 | Day 11 | 평가 보고서 | 12h |
| **합계** | - | - | - | - | - | **40~52h** |

---

## 학습 체크리스트 (학습자용 간편본)

```
# [에이전트명] 14일 온보딩 체크리스트

## Week 1: 필수 공통 스킬 (Day 1~3)

### Day 1: 토큰 효율 협업
- [ ] Skill 파트 읽음 (30분)
- [ ] Grep/Glob으로 파일 위치 찾기 (1회 이상)
- [ ] Read 도구로 필요 라인만 추출 (2회 이상)
- [ ] Checklist 5개 항목 자가채점 완료
- [ ] "이번 주에 할 일" Grep으로 찾기 (1회 이상)

### Day 2: 평범을 넘기
- [ ] Skill 파트 읽음 (30분)
- [ ] 선배 산출물 3개 분석 (1.5시간)
  - [ ] 산출물1 (점수:  /100)
  - [ ] 산출물2 (점수:  /100)
  - [ ] 산출물3 (점수:  /100)
- [ ] 본인의 과제 또는 산출물 1개 자가진단 완료
- [ ] Checklist 8개 항목 모두 체크
- [ ] "이 산출물은 우수한가 평범한가" 판별 가능

### Day 3: 제품 원칙 참조
- [ ] Skill 파트 읽음 (30분)
- [ ] 프로젝트 의사결정 3개 원칙과 매핑
  - [ ] 의사결정1: [원칙X]
  - [ ] 의사결정2: [원칙Y]
  - [ ] 의사결정3: [원칙Z]
- [ ] 본인의 의사결정 1개 재검토 완료
- [ ] Checklist 5개 항목 모두 체크
- [ ] "이 판단이 맞는 이유"를 규칙으로 설명 가능

## Week 2: 도메인 스킬 (Day 4~7)

### Day 4~5: [도메인 스킬 1]
- [ ] Skill 파트 읽음 (1시간)
- [ ] Procedure 1~8 모두 수행
- [ ] 실제 산출물 또는 과제 완료
- [ ] Checklist X개 항목 모두 체크
- [ ] 차후 참조용 메모 작성

### Day 6~7: [도메인 스킬 2]
- [ ] Skill 파트 읽음 (1시간)
- [ ] Procedure 1~8 모두 수행
- [ ] 실제 산출물 또는 과제 완료
- [ ] Checklist X개 항목 모두 체크
- [ ] (선택) Knowledge 파트 읽음 (1시간)

## Week 3: Knowledge & 프로젝트 교훈 (Day 8~14)

### Day 8~10: Knowledge 심화 (선택, 시간 여유 시)
- [ ] Knowledge 파트 1개 읽음 (1.5시간)
- [ ] 관련 교훈 파일 2~3개 읽음 (1시간)
- [ ] 실패 사례 분석 완료 (1.5시간)
- [ ] Knowledge 파트 2개 읽음 (선택)

### Day 11: 프로젝트 교훈
- [ ] lessons/ 파일 3개 읽음
- [ ] 각 교훈의 "이 에이전트 관련성" 판별 완료
- [ ] 교훈 & Day 1~3 공통 스킬 매핑 작성
- [ ] 학습 메모 작성 완료

### Day 12~14: 실제 산출물 리뷰
- [ ] 산출물 3개 수집 완료
- [ ] 각 산출물별 Skill 체크리스트 적용 (2시간×3)
  - [ ] 산출물1: Skill 체크리스트 적용, 점수: /100
  - [ ] 산출물2: Skill 체크리스트 적용, 점수: /100
  - [ ] 산출물3: Skill 체크리스트 적용, 점수: /100
- [ ] 각 산출물별 개선 제안 3개 작성
- [ ] 팀 피드백 (선택, 4시간)
- [ ] 최종 자가진단 보고서 작성

## 최종 검증 (Day 14 말)

체크박스를 모두 완료했다면:
- [ ] Day 1~3의 공통 스킬 3개를 체크리스트 없이 설명할 수 있는가?
- [ ] Day 4~7의 도메인 스킬 2개를 새로운 작업에 즉시 적용할 수 있는가?
- [ ] Day 11~14의 교훈을 본인의 향후 작업에 반영할 계획을 세웠는가?

**이 3가지 YES면 14일 온보딩 완료! 🎓**
```

---

## 4. 자동화 기준 (우선순위 판단 로직)

### 4.1 필수 공통 스킬 3개 선정 (Day 1~3 고정)

**고정값**: 다음 3개는 모든 에이전트 동일
1. `common-token-efficient-collaboration` — 모든 에이전트의 기본 역량
2. `common-beyond-mediocre-output` — 산출물 품질 기준 (모드 7과 연동)
3. `common-product-principles-reference` — 의사결정 기준

**근거**:
- 에이전트 MD에 "## 핵심 원칙" 섹션이 거의 모두 포함
- trainer.md "## 속행 규칙"에서 명시
- 10개 공통 스킬 중 사용 빈도 가장 높음 (1순위 5개 중 3개)

---

### 4.2 도메인 스킬 우선순위 (Day 4~7 배치)

**알고리즘**:

```python
def rank_domain_skills(agent_md_path):
    """에이전트 MD에서 도메인 스킬 우선순위 계산"""
    
    # Step 1: MD의 "## 책임" 섹션 추출
    responsibilities = extract_section(agent_md, "책임")
    
    # Step 2: 각 도메인 스킬마다 점수 계산
    scores = {}
    for skill in domain_skills:
        # 2a. 책임 섹션에서 스킬 키워드 빈도
        keyword_freq = responsibilities.count(skill.keyword) * 1.0
        
        # 2b. "산출물" 키워드와의 근접도 (산출물 설명에서 위치)
        product_proximity = 1.0 if skill in responsibilities.section("산출물") else 0.5
        
        # 2c. 모드 사용 빈도 (trainer.md 모드 테이블에서)
        mode_frequency = skill_to_modes[skill].count() * 0.5
        
        # 2d. 에이전트 MD의 "## 스킬 상세" 섹션에 명시되어 있는가?
        explicitly_mentioned = 1.0 if skill in agent_md.section("스킬_상세") else 0.0
        
        # 최종 점수
        scores[skill] = (
            keyword_freq * 3.0 +           # 책임 키워드 중요도 높음
            product_proximity * 2.0 +      # 산출물과의 연관성
            mode_frequency * 1.0 +         # 모드 사용 빈도
            explicitly_mentioned * 2.0     # 명시 여부
        )
    
    # Step 3: 상위 2~4개 선정 (도메인마다 다름)
    # - reviewer: 3~4개 (code-review, security-review, architecture-review, ...)
    # - qa-engineer: 2~3개 (functional-testing, regression-testing, ...)
    # - architect: 4~5개 (design-review, performance-analysis, ...)
    
    top_skills = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:3]
    return top_skills
```

**예시 (reviewer)**:
```
Skill                          Frequency  Proximity  Mode  Explicit  Score
code-review                         4          2       3      2       16.0  ← Day 4~5
architecture-review                3          2       2      2       13.0  ← Day 6~7
security-review                     2          1       1      1        6.0  (선택)
feedback-integration                2          1       2      1        6.0  (선택)
```

---

### 4.3 Knowledge 배치 우선순위 (Day 8~10 선택)

**규칙**:
1. Day 1~7에서 "실패" 또는 "검증 실패"가 있던 스킬의 Knowledge 우선
2. "When to Use"와 "Anti-patterns" 섹션이 풍부한 스킬 우선 (학습 효과 높음)
3. 시간 여유가 남으면 "도메인 스킬의 Knowledge" 순으로 배치

**자동 판별**:
```
Knowledge 추천 점수 = (
    (Day 1~7 체크리스트 미충족 항목 수) * 2.0 +
    (Anti-patterns 섹션 존재 여부) * 1.0 +
    (개념 설명 길이 / 1000자) * 0.5
)
```

---

### 4.4 교훈 선정 (Day 11 lessons/)

**규칙**:
1. 에이전트 역할과 직접 연관된 lessons/ 파일 우선
   - 예: `lessons/reviewer-*.md` for reviewer
2. 프로젝트별 lessons/ 파일 중 "산출물" 키워드 포함된 것 우선
3. 최근순 (파일 수정일) 상위 3개

**경로**:
```
~/.claude/knowledge/lessons/
├── [프로젝트명]-*.md        # 프로젝트 교훈
├── [역할명]-*.md            # 역할별 교훈 (존재하면)
├── [주제명]-*.md            # 주제별 교훈
└── INDEX.md                 # 교훈 카탈로그
```

---

## 5. 통합 체크리스트 (Trainer 실행용)

Mode 10을 실행하기 전에:

```
[ ] 대상 에이전트 MD (플러그인 번들 agents/<이름>.md) 존재 확인
[ ] 에이전트 MD에 "## 스킬 상세" 섹션 존재 확인
[ ] 대상 에이전트의 도메인 스킬 폴더 경로 확인
    (플러그인 번들 skills/common-*/SKILL.md + 도메인 스킬 폴더)
[ ] 10개 공통 스킬 파일 모두 읽을 수 있는지 확인
[ ] ~/.claude/knowledge/lessons/ 디렉터리 접근 확인
[ ] 출력 디렉터리 ~/.claude/knowledge/curriculum/ 생성 확인

## Mode 10 실행 중

[ ] Step 1: 에이전트 프로필 수집 완료
    - 공통 스킬 리스트 추출 ✓
    - 도메인 스킬 리스트 추출 ✓
    - 책임 & 산출물 섹션 추출 ✓

[ ] Step 2: Skill vs Knowledge 분류 완료
    - 10개 공통 스킬 분류 ✓
    - 도메인 스킬 분류 ✓
    - 분류 메타데이터 기록 ✓

[ ] Step 3: 커리큘럼 일정표 생성 완료
    - Day 1~3 필수 스킬 배치 ✓
    - Day 4~7 도메인 스킬 배치 ✓
    - Day 8~10 Knowledge 배치 ✓
    - Day 11~14 교훈 & 산출물 배치 ✓
    - 전체 시간 총합 ≤ 52시간 확인 ✓

[ ] Step 4: 파일 생성 완료
    - onboarding-<이름>-14d.md 생성 ✓
    - 개요 & 목표 섹션 작성 ✓
    - Day 1~14 상세 활동 작성 ✓
    - 타임라인 테이블 작성 ✓
    - 체크리스트 작성 ✓

## Mode 10 실행 후

[ ] 생성된 커리큘럼 파일 검증
    - Markdown 문법 오류 없음 ✓
    - 내부 링크 모두 유효 ✓
    - 시간 합계 확인 ✓

[ ] malgnai-mcp 기록
    - agent_learning_log_add (title: "Mode 10: Curriculum Design for [Agent]")
    - decision_add (내용: "에이전트 [이름]의 14일 커리큘럼 생성 정책 확정")
    - memory_add (학습 교훈: "이 에이전트 그룹에 공통 부분 3개")

[ ] 학습자에게 전달
    - 파일 경로 안내: ~/.claude/knowledge/curriculum/onboarding-<이름>-14d.md
    - 체크리스트 다운로드 링크
    - 첫 3일 활동 구체 지시 (Day 1~3은 강제, Day 4~14는 선택 가능)
```

---

## 6. 예시: Reviewer 에이전트 (샘플 커리큘럼)

### Step 1 결과
```
에이전트: reviewer
역할: 다관점 산출물 검증 전문가
핵심 책임: 
- 코드/문서/설계 산출물 리뷰
- 페르소나 기반 다관점 평가
- Critical/Major/Minor 결함 분류

공통 스킬 참조:
- token-efficient-collaboration (모든 모드)
- beyond-mediocre-output (산출물 품질 기준)
- training-scorecard-eval (모드 7)

도메인 스킬:
- code-review (SKILL.md)
- architecture-review (SKILL.md)
- security-review (SKILL.md, 선택)
```

### Step 2 결과
```
Skill vs Knowledge 분류:

common-token-efficient-collaboration:
  Skill (3~5분): Procedure 1~5, Checklist 5개
  Knowledge (15분): When to Use, Anti-patterns
  
common-beyond-mediocre-output:
  Skill (5분): Checklist 8개 (산출물 품질 척도)
  Knowledge (20분): 개념 설명, 산출물 예시 분석
  
code-review (도메인):
  Skill (10분): Procedure 1~10 (리뷰 단계), Checklist 8개
  Knowledge (25분): Why code review, Common pitfalls, Case studies
```

### Step 3 결과 (타임라인)
```
Day 1 (월): 토큰 효율 협업 Skill (4시간)
  - Procedure 읽기 (30분)
  - Grep/Glob 연습 (1시간)
  - Read 필터링 연습 (1시간)
  - Checklist 자가채점 (1.5시간)

Day 2 (화): 평범을 넘기 Skill (4시간)
  - Skill 읽기 (30분)
  - 선배 코드리뷰 3개 분석 (1.5시간)
  - 자체 리뷰 1개 진단 (1시간)
  - Checklist 완료 (1시간)

Day 3 (수): 제품 원칙 Skill (4시간)
  - Skill 읽기 (30분)
  - 리뷰 의사결정 3개 원칙 매핑 (1.5시간)
  - 본인 리뷰 재검토 (1시간)
  - Checklist 완료 (1시간)

Day 4~5 (목~금): Code Review (도메인 스킬) (8시간)
  - Skill 파트 읽기 (1시간)
  - Procedure 1~10 따라하기 + 실제 코드 리뷰 (4시간)
  - Checklist & 검증 (2시간)
  - 메모 작성 (1시간)

Day 6~7 (월~화): Architecture Review (도메인 스킬) (8시간)
  - Skill 파트 읽기 (1시간)
  - Procedure 따라하기 + 실제 아키텍처 검토 (4시간)
  - Checklist & 검증 (2시간)
  - (선택) Knowledge 파트 (1시간)

Day 8~10 (수~금+월): Knowledge 심화 (선택, 4~8시간)
  - Common 스킬의 Knowledge 1개 (4시간)
  - Code Review의 "왜 중요한가" 심화 (2~4시간)

Day 11 (화): 프로젝트 교훈 (4시간)
  - lessons/review-*.md 3개 읽기 (1시간)
  - 각 교훈의 "reviewer 관련성" 판별 (1시간)
  - Day 1~3 공통 스킬과 매핑 (1시간)
  - 학습 메모 작성 (1시간)

Day 12~14 (수~금): 실제 산출물 리뷰 (12시간)
  - 코드리뷰 산출물 1개 (선배 또는 실제) 분석 (2시간)
    - Skill 체크리스트 적용
    - 품질 평가
    - 개선 제안 3개 작성
  - 아키텍처 리뷰 산출물 1개 분석 (2시간)
  - 보안 리뷰 산출물 1개 분석 (2시간)
  - 팀 피드백 & 상호 검토 (4시간, 선택)
  - 최종 보고서 작성 (2시간)

총 40시간 (필수 28시간 + 선택 4~12시간)
```

### Step 4 결과 (파일 생성)
```md
파일: ~/.claude/knowledge/curriculum/onboarding-reviewer-14d.md
크기: ~8KB
구조:
  - 개요 & 목표 (1KB)
  - Day 1~3 (2KB)
  - Day 4~7 (2KB)
  - Day 8~10 (1KB)
  - Day 11~14 (1KB)
  - 타임라인 테이블 (0.5KB)
  - 체크리스트 (1.5KB)

체크리스트 하이라이트:
  ✓ Day 1~3: 공통 스킬 3개 필수
  ✓ Day 4~7: 도메인 스킬 2개 필수 (3번째는 선택)
  ✓ Day 8~10: Knowledge (선택, 시간 여유)
  ✓ Day 11~14: 교훈 + 산출물 검토 (필수)
```

---

## 요약

**Mode 10 설계 목표**: 에이전트별 14일 온보딩 커리큘럼을 자동으로 생성하여, "무엇을 배울 것인가"를 체계적으로 정하고, "며칠에 걸쳐" "어떤 방식으로" 학습할지를 가시화한다.

**4 단계 절차**:
1. 에이전트 프로필 수집
2. Skill vs Knowledge 자동 분류
3. 14일 일정표 생성
4. markdown + 체크리스트 파일 생성

**자동화 기준**:
- 필수 공통 스킬 3개 고정 (Day 1~3)
- 도메인 스킬은 에이전트 MD의 "책임" 섹션 분석으로 우선순위 정함
- Knowledge는 실패 경험 여부에 따라 Day 8~10에 배치 (선택)
- 교훈은 lessons/ 파일 중 역할 관련성·최신성 기준으로 선정

**출력**: `~/.claude/knowledge/curriculum/onboarding-<에이전트명>-14d.md` (5~8KB)
- 개요, Day별 상세 활동, 타임라인, 자가진단 체크리스트 포함
