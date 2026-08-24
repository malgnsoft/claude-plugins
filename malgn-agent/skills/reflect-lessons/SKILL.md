---
name: reflect-lessons
description: 프로젝트 교훈을 에이전트 Knowledge/MD에 반영(trainer 모드 4). "교훈 반영", "lessons 적용" 요청 시 사용.
---

# Reflect Lessons Skill (모드 4)

회고·교정에서 나온 교훈을 에이전트 역량별로 분류하고, 아직 반영되지 않은 내용을 Knowledge/에이전트 MD에 추가합니다.

**⚠️ 병렬화 원칙**: 교훈마다 도구 호출을 하나씩 순차로 하지 마라 — 턴 수를 늘리는 것 자체가 비용이다(매 턴 그 시점까지 누적된 전체 대화를 캐시에서 재독하므로, 턴이 늘수록 비용이 선형이 아니라 사실상 제곱으로 커진다. 실측: 10건 순차처리 1세션=142턴/cache_read 21.27M토큰). 서로 의존관계 없는 도구 호출(여러 교훈의 Read/Grep, 여러 파일의 Edit, 여러 건의 기록 호출)은 **같은 턴에서 병렬로 묶어라.**

## 실행 흐름

### 1단계: 교훈 후보 수집

malgnai-hub에는 "미분류 pending 큐"가 없다. 대신 아래 세 곳에서 후보를 모은다:
- `agent_get_context(agentName, learningLimit=50)` — 그 에이전트의 최근 학습 이력. `/project-retrospective`(모드2)가 `agent_learning_record`로 남긴 항목이 여기 그대로 나온다. **1차 소재.**
  - **대상 agentName 집합**: `agentName`은 단수 필수라 한 번에 한 명만 읽힌다. 이번 회고/위임에 참여한 에이전트 **전원**을 세어 그 이름들을 같은 턴에서 병렬로 호출한다 — 참여자 목록은 모드2 보고, PM 위임 이력, 또는 `project_search_history`의 작업 기록에서 확보한다. 한 명만 읽고 "후보 없음"으로 끝내지 않는다.
  - **조회창 상한과 그 한계(정직 고지)**: `learningLimit`은 **최대 50**이고, hub에는 개별 항목을 "반영됨"으로 표시하거나 갱신하는 수단이 없다(학습 이력은 추가 전용). 그래서 이 절차의 회수 범위는 **에이전트당 최근 50건 이내로 한정**되며, 그 밖으로 밀린 항목은 이 스킬로 회수되지 않는다. 밀려남 자체를 막을 수단은 hub에 없으므로 **쌓아두지 않는 것**이 유일한 대응이다 — 모드2를 돌렸으면 같은 세션에서 모드4까지 이어서 끝낸다.
- `project_search_history`(projectId, query, types=['decision','work'], since=최근 기간) — 최근 결정·작업 기록 중 재사용 가능한 교훈.
- 이번 세션의 사용자 교정·리뷰 지적·evaluator 반려 사유 — 이미 드러난 실수라 가장 우선순위가 높다.

**대상이 여러 건이면, 각 건의 원문 확인 및 관련 후보 파일 탐색(Read/Grep)을 건별로 순차 호출하지 말고 같은 턴에서 병렬로 묶어 조회한다.**

**중복 반영 방지 (pending 큐가 없으므로 이 확인이 그 역할을 대신한다)**: 반영 착수 전, 그 교훈의 핵심 문구를 대상 MD/knowledge에 `grep`으로 먼저 찾아본다 — 이미 있으면 다시 넣지 않고 그 사실을 보고에 적는다.

각 후보의 내용에서 4부 구조(전제조건/권장행동/반례/판별질문)를 확인 — 비어있으면 여기서 보완한다.

### 2단계: 교훈 분류
후보를 에이전트별로 매핑한다:
- reviewer 취약점 → reviewer.md "리뷰 관점" 섹션
- architect 실수 → architect.md "Work Order 분석" 섹션
- backend-dev 패턴 → backend-dev.md "데이터 설계" 섹션
- 등등
- **2개 이상 에이전트/공통 자산에 걸치면 신중히 판단** — 확신 없으면 `docs/retro-pending-approval.md`에 적어 사람 승인을 먼저 받고, 승인 전까지 MD를 고치지 않는다.
- 여러 에이전트에 사실상 같은 문구를 넣게 된다면 개별 MD 중복 삽입 대신 `malgn-agent/knowledge/common/` 공통 파일 1개 + 각 MD에서 참조하는 형태를 먼저 검토한다.

### 3단계: Knowledge 추가 (해당하는 경우만)
정말 재사용 가능한 일반 지식이면 `malgn-agent/knowledge/` 도메인 폴더에 문서 작성(대부분은 4단계 MD 보강만으로 충분 — 별도 knowledge 문서는 예외적인 경우만):
- 기존 파일은 절대 덮어쓰지 말고 추가만
- **README 등록 필수**: `malgn-agent/knowledge/README.md`에 새 문서 1줄 등록(폴더-대상 매핑 표). 등재에 없는 교훈은 검색되지 않아 없는 것과 같다.

### 4단계: MD 보강
해당 에이전트 MD 섹션에:
- 교훈 내용 추가 또는 기존 항목 강화
- 체크리스트 보강
- 근거(프로젝트+날짜) 명시 — 조회 가능한 기록 id가 있으면 함께, 없으면 교훈의 실질을 문장으로 적는다
- **적용범위 라벨 필수, 그 자리에서 바로**: `## 핵심 원칙` 등에 새로 추가하는 불릿 항목 앞에 `**[상시]**`(항상 적용) 또는 `**[상황: 조건 요약]**`(특정 조건에서만 적용) 라벨을 반영 시점에 바로 붙인다. 예: `- **[상시]** 자율 실행 환경입니다...` / `- **[상황: 배포 작업 시]** 로컬 검증 게이트부터 확인...`. **나중에 누가 몰아서 정리하는 방식은 쓰지 않는다.** (기존 MD의 미태깅 항목을 지금 소급 태깅하지는 않는다 — 이 규칙은 신규 추가분부터 적용.)

**서로 다른 파일을 건드리는 편집은 파일 간 의존관계가 없는 한 같은 턴에서 병렬로 Edit한다.**

### 5단계: git 커밋 + evaluator 인계 (agents/evaluator.md §2·§3)

malgn-agent 소스를 git으로 관리하는 조직에서만 적용된다. 소스클론이 없으면 이 단계는 건너뛰고 4단계 Edit 결과를 그대로 evaluator에게 보고한다.

- trainer: `git checkout -b trainer/reflect-lessons-<YYYYMMDD>` → 3~4단계에서 Edit한 knowledge/MD 파일을 `git commit`까지만 수행(push/PR은 하지 않는다 — 초안 작성과 승격 실행을 분리 유지).
- evaluator에게 인계: `git diff main..<branch>`로 변경 확인 → evaluator가 evaluator.md §2) 판정 체크리스트로 게이트 판정 → PASS 시 evaluator.md §3)의 승격 절차 적용(Sensitive/Refactor급이면 사람 승인 전 merge 금지).

### 6단계: 학습 기록

- 반영 결과는 `work_record`(projectId, status='completed', title, summary, result=반영 내용 요약, nextAction?, idempotencyKey)로 남긴다.
- 특정 에이전트의 역량 변화로 남길 것은 `agent_learning_record`(agentName, type='experience', title, content, source=반영한 파일 경로, idempotencyKey)로 함께 남긴다 — 다음 회차의 1단계가 이걸 다시 읽는다.
- 재사용 가능한 판단 근거가 특히 뚜렷하면 `decision_record`(projectId, title, decision, reason, impact, idempotencyKey)로도 남겨 검색성을 높인다.
- 여러 건을 동시에 기록할 때, 항목마다 개별 턴으로 나누지 말고 서로 의존관계 없는 기록 호출은 같은 턴에서 병렬로 묶는다.

## 교훈 승격 게이트

4부 구조 완성 후에만 일반화 가능:
1. **전제조건**: 언제 이 교훈이 필요한가?
2. **권장행동**: 구체적 액션
3. **반례**: 이것을 무시하면?
4. **판별질문**: 상황을 판단하는 질문

반례 검토 후만 Knowledge 승격 (전칭 금지)

## 외부 검색 vs 내부 자료

**내부 자료 우선** — 외부 WebSearch 전에 항상 `project_search_history`(전체 types)와 `agent_get_context`부터 확인한다 (1차 소재).

## 산출물

- 처리한 교훈 후보 목록(출처 기록 id 포함)
- 분류 결과 (에이전트별)
- 추가한 Knowledge 파일 (있는 경우만)
- 보강한 MD 섹션
- malgnai-hub 기록 (`work_record` + `agent_learning_record`, 필요 시 `decision_record`)
