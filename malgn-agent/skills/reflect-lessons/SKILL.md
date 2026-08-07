---
name: reflect-lessons
description: 프로젝트 교훈을 에이전트 Knowledge/MD에 반영(trainer 모드 4). "교훈 반영", "lessons 적용" 요청 시 사용.
---

# Reflect Lessons Skill (모드 4)

프로젝트 회고 파일(`docs/training-report-*.md`)의 교훈을 에이전트 역량별로 분류하고, 아직 반영되지 않은 내용을 Knowledge/MD에 추가합니다.

**⚠️ 병렬화 원칙(2026-07-24, malgnai memory `1f74ea93` 실측 근거)**: lesson마다 도구 호출을 하나씩 순차로 하지 마라 — 턴 수를 늘리는 것 자체가 비용이다(매 턴 그 시점까지 누적된 전체 대화를 캐시에서 재독하므로, 턴이 늘수록 비용이 선형이 아니라 사실상 제곱으로 커진다. 실측: 10 lesson 순차처리 1세션=142턴/cache_read 21.27M토큰). 서로 의존관계 없는 도구 호출(여러 lesson의 Read/Grep, 여러 파일의 Edit, 여러 lesson의 기록 호출)은 **같은 턴에서 병렬로 묶어라.**

## 실행 흐름

### 1단계: pending lesson 수집

**⚠️ malgnai-hub v1에는 lesson_* 도구가 없음 — 이 워크플로우는 malgnai-mcp(사내 전용) 환경에서만 동작하며, malgnai-hub 연동판에서는 해당 기능 없음.** 원래 목적은 아직 분류되지 않은 원시 학습 이력을 pending 큐에서 가져와 이 스킬의 분류 대상으로 삼는 것이었다. malgnai-hub에는 구조화된 pending→classified 큐가 없으므로, malgnai-hub 연동판에서는 `mcp__malgnai-hub__project_search_history`(repositoryKey, query, types=['decision','work'], since=최근 기간)로 최근 decision_record/work_record 중 재사용 가능한 교훈 후보를 직접 찾아 이하 단계를 진행한다.

> 아래는 malgnai-mcp 전용 원본 절차(malgnai-hub에서는 미동작, 참고용으로 보존):
> (2026-07-16부터 — 로컬 파일 대신 malgnai `lessons` 큐) malgnai-mcp `lesson_list`(status='pending', 필요 시 project_id 필터)로 아직 분류되지 않은 원시 학습 이력을 가져온다. retro-prompt.txt(자동회고)·pm.md 상시 캡처·`/project-retrospective`는 모두 `lesson_add`로 캡처만 하고 분류·MD 반영은 이 스킬(또는 아래 정정 경로)로 넘긴다.
>
> **대상 lesson이 여러 건이면, 각 lesson의 원문 확인 및 관련 후보 파일 탐색(Read/Grep)을 lesson별로 순차 호출하지 말고 같은 턴에서 병렬로 묶어 조회한다.**
>
> **(2026-07-21 정정, lesson `fd35f13c`)** pending → classified/rejected 종결 권한은 이 스킬 호출 여부에 매이지 않는다: trainer가 해당 lesson의 MD/knowledge 반영을 완료하고, evaluator가 판정+전역 승격(git 커밋→evaluator 판정→PR merged 확인, methodology §1.5 절차)까지 확인해준 뒤라면 — PM이 이 스킬을 거치지 않고 trainer→evaluator를 직접 체이닝한 자율 사이클 경로에서도 — trainer가 직접 `lesson_classify`를 호출해 종결까지 책임진다. (다중 대상 반영 시에는 각 이름의 MD에 실제로 반영됐는지 grep으로 먼저 확인한다, lesson `1ada1efb`.)
> - 각 lesson의 `content`에서 4부 구조(전제조건/권장행동/반례/판별질문)를 확인 — 비어있으면 여기서 보완

### 2단계: 교훈 분류
추출한 교훈을 에이전트별로 매핑(각 lesson의 `candidate_agents` 힌트를 출발점으로 확정):
- reviewer 취약점 → reviewer.md "리뷰 관점" 섹션
- architect 실수 → architect.md "Work Order 분석" 섹션
- backend-dev 패턴 → backend.md "데이터 설계" 섹션
- 등등
- **2개 이상 에이전트/공통 자산에 걸치면 신중히 판단** — 확신 없으면 `docs/retro-pending-approval.md`에 적어 사람 승인을 먼저 받는다(malgnai-mcp 환경에서는 승인 전까지 해당 lesson을 `lesson_classify` 하지 않고 pending으로 남긴다 — malgnai-hub v1에는 lesson_* 큐가 없으므로 이 문장은 malgnai-mcp 전용, malgnai-hub 연동판에서는 해당 없음).

### 3단계: Knowledge 추가 (해당하는 경우만)
정말 재사용 가능한 일반 지식이면 `malgn-agent/knowledge/` 도메인 폴더에 문서 작성(대부분은 4단계 MD 보강만으로 충분 — 별도 knowledge 문서는 예외적인 경우만):
- 기존 파일은 절대 덮어쓰지 말고 추가만
- **README 등록 필수**: `malgn-agent/knowledge/README.md`에 새 문서 1줄 등록(폴더-대상 매핑 표). 등재에 없는 교훈은 검색되지 않아 없는 것과 같다.

### 4단계: MD 보강
해당 에이전트 MD 섹션에:
- 교훈 내용 추가 또는 기존 항목 강화
- 체크리스트 보강
- 근거(프로젝트+날짜, lesson id) 명시
- **(2026-07-25 신설, 대표 확정 decision `bcfe1e64`) 적용범위 라벨 필수, 그 자리에서 바로**: `## 핵심 원칙` 등에 새로 추가하는 불릿 항목 앞에 `**[상시]**`(항상 적용) 또는 `**[상황: 조건 요약]**`(특정 조건에서만 적용) 라벨을 반영 시점에 바로 붙인다. 예: `- **[상시]** 자율 실행 환경입니다...` / `- **[상황: 배포 작업 시]** 로컬 검증 게이트부터 확인...`. **나중에 누가 몰아서 정리하는 방식은 쓰지 않는다.** (기존 MD의 미태깅 항목을 지금 소급 태깅하지는 않는다 — 이 규칙은 신규 추가분부터 적용.)

**서로 다른 파일을 건드리는 편집은 파일 간 의존관계가 없는 한 같은 턴에서 병렬로 Edit한다.**

### 5단계: git 커밋 + evaluator 인계 (agents/evaluator.md §2·§3)

malgn-agent 소스를 git으로 관리하는 조직(맑은소프트 한정으로는 `claude-plugins` 저장소 자신)에서만 적용된다. 소스클론이 없으면 이 단계는 건너뛰고 4단계 Edit 결과를 그대로 evaluator에게 보고한다.

- trainer: `git checkout -b trainer/reflect-lessons-<YYYYMMDD>` → 3~4단계에서 Edit한 knowledge/MD 파일을 `git commit`까지만 수행(push/PR은 하지 않는다 — 초안 작성과 승격 실행을 분리 유지).
- evaluator에게 인계: `git diff main..<branch>`로 변경 확인 → evaluator가 evaluator.md §2) 판정 체크리스트로 게이트 판정 → PASS 시 `git push` + `gh pr create`(등급별 merge 조건은 evaluator.md §3) 4단계 그대로 적용, Sensitive/Refactor급이면 사람 승인 전 merge 금지).
- `gh` 미설치 또는 GitHub 외 호스팅이면 evaluator가 push까지만 하고 사람에게 PR/MR을 직접 열어달라고 `AskUserQuestion`으로 요청한다.

### 6단계: 학습 기록 + pending 종결

malgnai-hub v1 기준:
- **⚠️ `lesson_classify`는 malgnai-hub v1에 대응 도구가 없음** — pending 큐 자체가 없으므로 "종결" 개념도 없다. malgnai-hub 연동판에서는 해당 기능 없음.
- 학습 기록은 `mcp__malgnai-hub__work_record`(repositoryKey, status='completed', title, summary, result=반영 내용 요약, nextAction?)로 남긴다. 재사용 가능한 교훈이 특히 뚜렷하면 `mcp__malgnai-hub__decision_record`(repositoryKey, title, decision, reason, impact)로도 남겨 검색성을 높인다.
- 여러 건을 동시에 기록할 때, 항목마다 개별 턴으로 나누지 말고 서로 의존관계 없는 `work_record`/`decision_record` 호출은 같은 턴에서 병렬로 묶어 호출한다.

> malgnai-mcp 전용 원본 절차(참고용, malgnai-hub에서는 미동작): 처리한 lesson마다 두 호출 모두 남긴다 — malgnai-mcp `agent_learning_log_add`(agent_name, type: "lesson", title, content, source, 사후 감사로그) / malgnai-mcp `lesson_classify`(id, project_id, status='classified'|'rejected', classified_agents=실제 반영된 에이전트, pending 큐 종결, 실제 반영을 완료한 이 단계에서만 호출).

## 교훈 승격 게이트

4부 구조 완성 후에만 일반화 가능:
1. **전제조건**: 언제 이 교훈이 필요한가?
2. **권장행동**: 구체적 액션
3. **반례**: 이것을 무시하면?
4. **판별질문**: 상황을 판단하는 질문

반례 검토 후만 Knowledge 승격 (전칭 금지)

## 외부 검색 vs 내부 자료

**내부 자료 우선** — 외부 WebSearch 전에 항상 malgnai-hub `mcp__malgnai-hub__project_search_history`(전체 types)부터 확인 (1차 소재). (malgnai-mcp 전용 원본: `lesson_list`(전체 status)부터 확인 — malgnai-hub v1에는 lesson_* 없음)

## 산출물

- 처리한 교훈 후보 목록: (malgnai-mcp 환경) lesson id 목록(classified/rejected) — malgnai-hub 연동판은 해당 없음, `project_search_history`로 찾은 decision/work 항목 id로 대체
- 분류 결과 (에이전트별)
- 추가한 Knowledge 파일 (있는 경우만)
- 보강한 MD 섹션
- malgnai-hub 기록 (`work_record` + 필요 시 `decision_record`). (malgnai-mcp 전용: `agent_learning_log_add` + `lesson_classify` — malgnai-hub v1에는 대응 도구 없음)
