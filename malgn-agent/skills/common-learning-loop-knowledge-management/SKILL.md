---
name: common-learning-loop-knowledge-management
description: 전 에이전트 운영 표준 — 조직 학습 체계, 교훈 기록→반영 폐쇄 루프로 반복 실수 제거. 재발방지·교훈 관리가 필요할 때 사용.
---

# Learning Loop Knowledge Management

## 정의

팀 전체가 경험한 교훈·실수·성공을 기록하고, 그것을 다음 의사결정에 자동 반영하는 폐쇄 루프 시스템. malgnai-hub를 중심으로 메모리 → 판단 → 기록 → 갱신을 순환시킨다.
- **역할 구분:** 이 스킬은 malgnai-hub 기록 규칙 자체(issue_record/decision_record/work_record를 언제·어떻게 쓰는지, 회고 주기, 기록 필수 필드)만 다룬다. 특정 태스크 하나를 실행하는 동안의 Pre/Mid/Post-Execution 체크리스트와 구체 실행 예시는 `learning-loop-patterns` 스킬을 참조하라 — 그 스킬이 이 규칙 위에서 동작하는 태스크 단위 실행 플레이북이다.

## 핵심 원칙

### 1. 교훈 기록 (Capture)

**의미 있는 모든 학습을 malgnai-hub에 기록:**

- **issue_record**: 장애물, 실패, 오류
  - 문제/영향: `summary`에 기록
  - 원인: `suspectedCause`에 기록
  - 해결책: 해결 시 `issue_resolve`의 `result`에 기록

- **decision_record**: 기술적·조직적 판단
  - 결정: `decision` 필드에 기록
  - 대안: `alternatives` 필드에 기록
  - 이유: `reason` 필드에 기록
  - 효과: `impact` 필드에 기록 (예상 결과와 실제 결과)
  - `importance`는 매번 실제로 판단해서 지정한다 (기본값 3 습관적 사용 금지)

- **재사용 가능한 교훈**(방법론·패턴·재발 방지 규칙): `decision_record`의 `reason`/`impact`(의사결정형) 또는 `work_record`의 `result`/`nextAction`(작업형)에 녹여 기록한다 — malgnai-hub에는 교훈 전용 저장소가 없으므로 이 두 곳이 정본이다.

- **에이전트 역량 진화**: malgnai-hub `agent_learning_record`(agentName, type, title, content, idempotencyKey)로 기록한다. MD/Knowledge 반영은 trainer의 `agent-upskill` 절차로 이어간다.

**체크:**
```
❌ 기록 없음 (구두로만)
❌ 카테고리 섞임 (issue인데 decision처럼 기록)
✅ "issue #456: pnpm 모노레포 부분 의존성 해결 실패 → 
   decision: monorepo 구조 폐기하고 멀티레포로 전환
   (reason에 '의존성 순환은 루트 lockfile로만 해결 가능' 교훈 포함)"
```

### 2. 메모리 참조 (Remember)

**새로운 판단 전에 기존 기록 확인:**

- **project_search_history**: 관련 교훈이 있는가?
- **project_get_context**: 최근 결정(recent_decisions)·최근 작업(work_record)에 유사한 판단이 있는가?

**체크:**
```
❌ "첫 판단처럼 처음부터"
✅ "project_search_history('pnpm 설치 오류') → 기존 해결책 3가지 확인 → 
   새로운 케이스면 issue_record, 기존 케이스면 적용"
```

### 3. 반영 (Apply)

**기록된 교훈을 다음 판단에 자동 반영:**

- 반복되는 이슈는 원칙으로 격상
- 유효성 검증 후 docs/product-principles.md에 추가
- 에이전트 역량 개선 필요하면 upskill 기록

**체크:**
```
❌ "또 같은 실수" (로깅만 하고 적용 안 함)
✅ "issue를 3회 반복 → product-principles 갱신 → 
   decision_record('왜 이제야?', reason에 반복 패턴 기록) → 다음부터 자동 체크"
```

### 4. 폐쇄 루프 (회고 주기)

**정기적으로 기록된 교훈을 검토·갱신:**

- **주 회고** (주 1회): 주요 `issue_record`/`decision_record`/`agent_learning_record` 검토, 중복 있는가?
- **월 회고** (월 1회): 에이전트별 학습 성과, 새로운 원칙 제안
- **분기 회고** (분기 1회): 조직 수준 규칙 갱신

**회고 산출물:**
- training-report-*.md (재발 방지 문서)
- docs/product-principles.md 갱신
- 에이전트 MD 보강 (upskill)

## 적용 체크리스트

### 일상 작업 중 (기록)

- [ ] 문제 발생? → issue_record
- [ ] 판단 필요? → project_search_history로 선례 확인 후 decision_record
- [ ] 새로운 패턴? → decision_record의 reason/impact 또는 work_record의 result/nextAction에 녹여 기록
- [ ] 에이전트 배운 점? → `agent_learning_record`로 기록 + trainer의 MD/Knowledge 갱신 절차

### 판단 전 (참조)

- [ ] project_search_history로 관련 교훈 있는가?
- [ ] project_get_context(recent_decisions)로 유사 사례 확인했는가?
- [ ] 이 판단이 기존 기록과 충돌하는가?

### 주/월/분기 회고 (갱신)

- [ ] 반복되는 issue가 있는가? → decision_record 또는 product-principles.md 원칙으로 격상
- [ ] 새로운 원칙 필요한가? → product-principles.md 갱신
- [ ] 에이전트 역량 부족한 부분? → upskill 계획

## 기록 필수 필드

**모든 기록에 포함:**
- **내용**: 무엇인가? (1~3문장)
- **도메인**: 누가 참조해야 하는가? (기술스택, 조직, 비즈니스)
- **유효 기간**: 언제까지 유효한가? (영구/임시)
- **출처**: 누가/어디서 배웠는가? (세션ID, 파일경로)
