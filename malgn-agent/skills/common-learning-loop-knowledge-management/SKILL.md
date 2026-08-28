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
  - **문제로 인지한 순간 연다** — 지금 고치든 나중으로 미루든 같다. hub에 "백로그"라는 별도 이슈 타입은 없고, 백로그는 열린 이슈 중 착수를 미룬 부분집합을 프로젝트 문서(STATUS.md 등)에서 그렇게 부르는 것뿐이다

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

#### 이슈 종결(Close) — 여는 것과 닫는 것은 한 쌍이다

`issue_record`로 연 이슈는 `issue_resolve`(`projectId`/`issueId`/`result`)로 닫아야 열린 이슈 목록이 현실과 맞는다. 여는 절차만 있고 닫는 절차가 없으면 이미 고쳐진 문제가 열린 채 쌓여, 다음 세션이 그 목록을 현재 상태로 믿고 끝난 일을 다시 착수한다.

- **닫는 주체는 "확인한 사람"이다.** 이슈를 연 사람이 아니라, 그 이슈가 실제로 해소된 것을 실물 대조(코드 grep·파일 확인·재현)로 확인한 사람이 그 자리에서 호출한다. 다른 목적의 작업이 부수적으로 해소한 경우도 같다 — "내가 연 이슈가 아니다"·"이번 작업 범위가 아니다"는 미루는 근거가 되지 않는다. 미루면 아무도 돌아오지 않는다.
- **양쪽 다 라벨이 아니라 실물이 근거다.** 열려 있다는 상태를 미해소의 증거로 삼지 않고, 닫을 때도 해소됐다고 짐작하지 않는다. 확인한 근거(파일:라인, 확인 방법)를 `result`에 적는다.
- **라운드를 마칠 때 겹침을 재점검한다.** 작업·검증 라운드를 닫기 전 `project_get_context(projectId, sections=['issues'])`로 열린 이슈를 열거해(여기서 `issueId`도 회수된다) 이번 라운드가 손댄 파일·주제와 겹치는 것을 고르고, 겹치면 그 이슈도 같이 대조해 해소됐으면 닫는다. 주제로 넓게 훑어야 하면 `project_search_history(projectId, query, types=['issue'])`를 보조로 쓴다. 새로 여는 것만 하고 이 재점검을 빠뜨리면 목록이 한 방향으로만 늘어난다.
- **호출하는 쪽은 그 라운드의 기록 주체다.** 기준은 파일을 고치는가도, hub 도구를 가졌는가도 아니다 — 파일을 고치지 않아도 회차마다 `decision_record`·`work_record`를 남기는 역할은 기록 주체이므로 확인한 이슈를 직접 닫는다. 반대로 절차가 hub 기록 책임을 부여하지 않은 검증 전용 역할은 종결 후보를 보고서·반환문에 지목하는 데까지 하고, 그 지목은 기록 주체가 수거해 실물 대조 후 닫는다.
- **부분 해소는 "닫고 다시 연다".** 여러 하위 항목을 묶은 이슈에서 일부만 해소됐을 때, 열린 이슈를 나중에 갱신하는 도구는 없다(`issue_update` 미제공). ①`issue_resolve`의 `result`에 무엇이 해소됐고 무엇이 남았는지 항목 단위로 적어 닫고 ②남은 항목만으로 `issue_record`를 새로 열어 잔여 범위를 좁힌다. 원본을 열어둔 채 "일부 해소"로만 두면 다음 세션이 해소분까지 다시 조사한다.

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

- [ ] 문제 발생? → issue_record (미루기로 한 건도 동일)
- [ ] 문제가 해소된 것을 실물로 확인? → issue_resolve (내가 연 이슈가 아니어도, 부수적 해소여도)
- [ ] 라운드 종료? → 열린 이슈 중 이번에 손댄 파일·주제와 겹치는 것 재점검 후 종결
- [ ] 판단 필요? → project_search_history로 선례 확인 후 decision_record
- [ ] 새로운 패턴? → decision_record의 reason/impact 또는 work_record의 result/nextAction에 녹여 기록
- [ ] 에이전트 배운 점? → `agent_learning_record`로 기록 + trainer의 MD/Knowledge 갱신 절차

### 판단 전 (참조)

- [ ] project_search_history로 관련 교훈 있는가?
- [ ] project_get_context(recent_decisions)로 유사 사례 확인했는가?
- [ ] 이 판단이 기존 기록과 충돌하는가?

### 주/월/분기 회고 (갱신)

- [ ] 열린 이슈 중 이미 해소됐는데 닫히지 않은 것이 있는가? → 실물 대조 후 issue_resolve
- [ ] 반복되는 issue가 있는가? → decision_record 또는 product-principles.md 원칙으로 격상
- [ ] 새로운 원칙 필요한가? → product-principles.md 갱신
- [ ] 에이전트 역량 부족한 부분? → upskill 계획

## 기록 필수 필드

**모든 기록에 포함:**
- **내용**: 무엇인가? (1~3문장)
- **도메인**: 누가 참조해야 하는가? (기술스택, 조직, 비즈니스)
- **유효 기간**: 언제까지 유효한가? (영구/임시)
- **출처**: 누가/어디서 배웠는가? (세션ID, 파일경로)
