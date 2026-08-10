---
name: project-orchestration
description: 요청을 위임한 뒤 WBS로 진행·리스크를 추적하고, 팀을 구성해 위임 모델대로 진행하며, claimed≠verified 원칙으로 검증·재작업까지 마무리하는 PM 실행 절차. Standard 이상 작업을 위임·추적하거나 "진행상황 관리해줘/팀 구성해줘/리스크 점검해줘"라고 요청할 때 사용한다.
---

# Project Orchestration

## 정의

PM(`agents/pm.md`)이 작업을 위임한 **이후** 실행을 관리하는 절차 모음이다. PM의 정체성·핵심 원칙·역할 경계·권한 참조표는 `agents/pm.md`가 정본이며, 이 스킬은 그중 "무엇을 어떻게 위임·추적·검증할지"의 실행 절차만 다룬다(§3.2-bis 판정: 절차 원문은 이 스킬이 정본, `agents/pm.md`의 "스킬 상세" 섹션은 이 스킬을 가리키는 포인터로 압축돼 있다).

`project-standards`(패키지매니저·STATUS.md 형식 등 정적 운영표준)와는 역할이 다르다 — 이 스킬은 "무엇을 어떻게 위임·추적·검증할지"의 행동 절차를 다룬다.

---

## 1. WBS 기반 프로젝트 관리

**WBS 진행상황 추적**
- **정기 현황 수집** (주 1회 이상): `wbs_list(repositoryKey)` 호출 → 전체 항목의 status/computed_progress/bucket 수집
- **부모 노드는 rollup 신호만 본다**: WBS 그룹(Step/Group)의 status는 직접 변경 불가 — 리프 항목들의 progress로 자동 계산되는 computed_progress와 bucket('planned'/'in_progress'/'done'/'delayed')이 진짜 신호
  - 예: 그룹 status='planned'인데 computed_progress=100·bucket='done' → 정상(리프 다 완료)
  - 예: 그룹 status='in_progress'인데 bucket='delayed' → 하위 항목 지연 상황 반영
- **리프 항목만 실제 진행률**: progress는 리프 노드만 업데이트 가능(`wbs_update` 호출), 자식이 있는 노드에 progress를 주면 에러

**병목·지연 항목 모니터링**
- **지연 항목 식별**: `wbs_list(repositoryKey, status='delayed')` → 계획 종료일 경과 + progress < 100인 항목 필터
- **진행 정체 신호**:
  - status='in_progress'인데 progress=0 지속(3일 이상) → 실제 착수 미확인, 담당자 확인 필수
  - progress 무변화 기간이 deadline까지 남은 일수보다 길면 → 가속화 필요
- **롤업 추락 추적**: 부모 computed_progress가 이전 점검 대비 5% 이상 하락 → 하위 항목 연쇄 지연 신호

**동적 우선순위 재조정**
- **병렬 작업 상위 영향**: WBS에서 진행 중인 항목 중 deadline이 가장 가까운 항목(크리티컬 패스) 식별
- **상위 항목 지연 시**: parent_id 필터로 해당 그룹의 모든 자식 항목 조회 → 상위 완료 대기 중인 후속 작업 일정 재조정
- **blocked 상태 추적**: 다른 팀/에이전트의 산출물 대기 중인 항목은 우선순위 맨 뒤로, 대기 해제 후 재상향
  - malgnai issue와 연계: issue_list(repositoryKey)에서 해당 WBS 항목 참조 → issue 해결 시 자동 blocked 해제

**마일스톤·단계별 진행 관리**
- **Phase별 게이트**: 각 phase 완료를 "모든 리프 항목 progress=100 && status='done'"으로 정의
  - wbs_list(repositoryKey, parent_id=<phase_id>) → 해당 phase의 리프만 조회
  - 리프 중 하나라도 progress < 100이면 phase 미완료 선언
- **Status 전이 추적**: 단계별 담당자가 wbs_update(status='done')할 때 completed_date 동시 기록
- **STATUS.md와 동기**: 각 phase 완료 후 STATUS.md 완료섹션 갱신 + WBS 상태 일관성 확인

---

## 2. 리스크 판단 (WBS 신호 기반)

**WBS 신호 읽기 (조기 경고 패턴)**
- **진행 정체**: progress=0 지속(3일 이상)
  - 원인: 담당자 미할당, 의존성 미해결, 요구사항 불명확
  - 대응: wbs_update(assignee_agent_name) 확인 후 담당자 1:1 확인 필수

- **Status 불일치**: in_progress인데 progress=0 또는 planned인데 progress > 0
  - 원인: 상태 기록 누락, 또는 자동 착수 후 수동 미업데이트
  - 대응: 실제 진행 상태 재확인 + wbs_update로 status와 progress 동기화

- **Computed_progress 추락**: 부모 노드의 computed_progress가 전일 대비 5% 이상 하락
  - 원인: 자식 항목 중 하나 이상이 완료→미완료로 되돌려지거나(버그 fix), 또는 새 자식 항목이 added with progress=0
  - 대응: wbs_list(repositoryKey, parent_id=<부모_id>)로 자식들을 재조회해 변화 요인 식별

**병렬 작업 의존성 추적**
- **Parent-Child 블로킹 리스크**:
  - wbs_list(repositoryKey, status='delayed') → parent_id별로 그룹화
  - 상위 항목(parent)이 delayed면 그 자식들도 실질적으로 시작 불가 → 의존성 블로킹

- **크리티컬 패스 모니터링**:
  - wbs_list(repositoryKey, include_done=false) → 모든 항목의 end_date 추출
  - 가장 가까운 deadline 항목들이 progress < 70% 이면 → critical path 리스크
  - 여러 항목의 deadline이 같은 주에 몰려 있으면 → 리소스 경합 리스크

- **의존성 체인 명확화** (WBS 설계 단계에서):
  - 각 항목의 description에 "선행: [선행항목_id]" 또는 "블로킹: [블로킹_id]" 태그 기재
  - 프로젝트 회고 시 이 메타데이터가 실제 진행에 맞았는지 검증

**malgnai-hub Issue/Decision과 연계**
- **Issue 매핑**: malgnai-hub issue_list(repositoryKey)에서
  - 설명에 "[WBS:#<item_id>]" 태그가 있으면 해당 WBS 항목의 블로킹 리스크로 판정
  - issue status='open' + WBS status='delayed' → 복합 리스크(2배 에스컬레이션)

- **의사결정 지연 추적**: decision_list에서
  - 의사결정이 필요한 항목(description에 "의사결정 대기" 표기)인데 decision이 last 7일 동안 없으면 → 지연 위험
  - WBS start_date 경과 후에도 관련 decision이 없으면 → 착수 전 명확화 부족

- **기록 선택(옵션)**: 리스크 발견 시 issue_record로 기록
  - summary: "WBS:#item_id 지연 (3일 progress=0)" 형식으로 트레이서빌리티 확보

**조기 경고 휴리스틱 체크리스트**

| 신호 | 조건 | 심각도 | 대응 |
|------|------|--------|------|
| 진행 정체 | progress=0 > 3일 | Medium | 담당자 1:1, status 재확인 |
| 착수 미확인 | status='in_progress' && progress=0 > 1일 | Medium | 실제 진행 상태 수집 |
| 임박 기한 위반 | deadline ≤ today && progress < 100 | High | 즉시 에스컬레이션 + 일정 재계획 |
| 기한 박박 | (end_date - today) ≤ 3일 && progress < 50% | Medium | 가속화 협의, 스코프 축소 검토 |
| 크리티컬 패스 | earliest_deadline인데 progress < 70% | High | 리소스 추가, 병렬화 재검토 |
| 롤업 추락 | parent.computed_progress ↓ 5% | Medium | 자식 상태 재조회, 변화 요인 식별 |
| 의존성 블로킹 | parent.status='delayed' → children.start_date_passed | High | 상위 항목 가속화 또는 의존성 제거 검토 |
| 상태 불일치 | status ≠ inferred_status_from_progress | Low | wbs_update로 동기화 + 미래 기록 개선 |

**점검 주기**
- **일일**: critical path 항목(deadline ≤ 1주) status/progress 단순 조회
- **주 1회(월요 또는 금요)**: wbs_list 전체 조회 → 심각도 High 신호 필터 + 보고
- **월 1회**: 완료 항목까지 include_done=true로 조회 → 계획 대비 실제 소요시간 분석

---

## 3. 팀 구성 원칙
- **업무 유형 → 최소 팀 구성** (과다팀 금지). 웹개발: planner→architect→backend/frontend-dev→qa-engineer→devops (각 단계별 reviewer 검증). 단일 엔드포인트/필드 수준의 소규모 변경(설계 변경 없이 기존 아키텍처 내 필드 추가 등)은 architect/planner 단계를 생략하고 backend-dev→frontend-dev→qa-engineer로 축소한다. 신규 아키텍처 결정이 필요할 때만 architect를 포함한다.
- **보안 단계 배치**: 개발·구현 중에는 security를 게이트로 돌리지 않는다 — 보안 리뷰가 게이트를 양산해 개발을 막는 것을 방지. security는 개발 중 "아주 심각한 Critical"만 즉시 올리고 나머지는 `docs/security-plan.md`에 적재만 한다. **정밀 보안 점검·보안계획 실행은 배포 직전 최종 운영 테스트 단계에서, 사용자 승인(Sensitive/Refactor급 상당 — malgnai-hub 연동판에서는 세션 내 `AskUserQuestion` 등으로 직접 확인) 후에만** 착수한다(security.md 운영 정책과 정합).
- **권위자 매핑**: architecture=architect, requirements/prd=planner, src=backend/frontend-dev, 문서=writer, 발표=presenter, 리뷰=reviewer, 에이전트MD/knowledge 초안=trainer, 전역 자산(에이전트/스킬/knowledge) 채점·판정·승격=evaluator.
- **공유 가정 주입**: 여러 에이전트가 같은 수치(마진율·CAC)를 쓸 때, 위임 전에 PM이 값을 고정해 동일하게 주입.

## 4. 위임 모델
- **경로 릴레이 순차**: A 에이전트 호출 → A가 파일 저장·경로 반환 → PM이 제어권 회수 → B 호출 (인계 주체=항상 PM).
- **슬라이스 위임**: 무거운 에이전트(backend-dev 등)에는 "이 엔드포인트 하나" 같은 좁은 산출물 1개 단위만.
- **순회 대조 위임의 반복-Read 방지**: N개 항목(에이전트/스킬 등)을 공통 기준문서에 대조하며 순회 위임할 때는 Skill `common-token-efficient-collaboration`의 반복-Read 방지 패턴을 참조 — 기준문서를 매 항목마다 재Read하지 않도록 위임 프롬프트를 설계한다.
- **저장 경로 명시**: 위임 시 "결과는 `/workspace/[프로젝트]/docs/파일명.md`에 저장하라" 명시.
- **subagent_type 명시 필수**: 리뷰/전문패널 소집처럼 특정 에이전트 타입(reviewer 등)이 필요한 작업을 Agent 도구로 위임할 때는 `subagent_type`을 반드시 명시 지정한다. 기본값(general-purpose)에 맡기면 스스로 다른 에이전트에게 재위임을 시도하다 실물 산출물 없이 조기 종료하는 실패 모드가 관찰됐다 — 프롬프트에 "산출물을 파일로 실제 저장하라" + "재위임하지 말고 직접 수행하라"도 함께 명시한다(lesson `0cfcccc3`).
- **위임 전 파일 스코프는 재귀 find로 확정**: 파일기반 라우팅 등 중첩 구조를 가진 프로젝트에서 위임 전 대상 파일 스코프를 `ls`(1단계)만으로 확정하지 않는다 — 중첩 라우트/파일을 누락할 수 있으므로 재귀 `find`로 전체 스코프를 먼저 확인한다(lesson `e3ada5b4`).
- **에이전트 간 시크릿/토큰 전달은 구분자로 감싸서**: 정확한 문자열 값(시크릿·토큰 등)을 다른 에이전트에게 전달할 때 구분자 없이 다른 텍스트와 이어붙이면 마지막 글자가 잘려나갈 수 있다 — 코드블록/별도 줄로 감싸 전달하고, 전달 전 길이·포맷을 기계적으로 검증한다(lesson `6392f243`).
- **같은 목업 엔티티를 참조하는 병렬 슬라이스 위임은 정본 데이터 선확정**: 같은 목업/시드 엔티티를 여러 화면이 참조하는 작업을 병렬 슬라이스로 위임하면 슬라이스 간 데이터 불일치가 발생할 수 있다 — 정본 데이터셋을 먼저 확정해 전달하거나, 병렬 진행 후 완료 시점에 반드시 파일 간 교차대조를 거친다(lesson `a52d2aa9`).
- **위임 전 실물 필드 대조**: "프론트 전용으로 보이는 지시"도 대상 API 응답 필드·라우트 파라미터 타입을 위임 전에 grep/코드로 실물 대조한다 — 서버가 노출하지 않는 필드를 프론트가 참조하도록 지시하면 완성 불가능한 작업을 위임하는 실수가 된다(lesson `82aec199`). "미연동/mock"류 진단을 받아 위임할 때도 대상 UI가 권고된 백엔드 기능과 실제로 같은 기능 도메인인지(마크업+API 라우트 실물 대조) 먼저 확인한다 — 같은 상위 카테고리(예: "AI")라도 하위 기능 도메인이 다르면 완성 불가능한 위임이 된다(lesson `a6b743ba`).
- **재사용 위임 전 호출자별 부작용 대조**: 여러 호출 컨텍스트(최초 발송 vs cron 재시도 등)에서 같은 함수를 재사용하라고 위임하기 전에, 그 함수가 호출자별로 다르게 취급해야 할 부작용(DB write·큐 적재·외부 API 호출)을 갖는지 실제 코드를 읽고 먼저 확인한다 — 스펙 문서에 "재사용하라"고 적혀 있다는 것이 "안전하게 재사용 가능하다"를 보장하지 않는다(lesson `ddaf33f2`).
  - **부록(값 재사용은 별도 검증)**: "코드 재사용"과 "파라미터 기본값(캡·임계치·윈도우) 재사용"은 분리해서 판단한다. 기존 실행경로의 캡(예: "3일·최대3건")을 공용 함수로 추출해 새 실행경로에 그대로 물려주라고 위임하기 전에, 그 값의 원래 존재 이유가 새 호출부의 목적과도 맞는지 별도로 확인한다 — 코드는 재사용 가능해도 값까지 그대로 재사용하면 새 경로의 목적을 무력화할 수 있다(lesson `4566ec13`).
- **백로그 라벨은 추정치, 착수 전 코드로 재확인**: 오래 방치된 비차단 리뷰 백로그 항목의 "비용/난이도" 라벨은 당시 코드를 다시 훑지 않은 채 붙은 추정치일 수 있다. 다음 작업 후보로 고를 때는 라벨을 그대로 신뢰하지 말고 관련 유틸/패턴이 이미 존재하는지 grep으로 먼저 확인한다(lesson `1663cb16`).
- **"신규 작성" 위임 전 실물부터 확인**: trainer 등에게 knowledge/에이전트 MD "신규 작성"을 위임하기 전, 없어 보인다고 바로 신규작성 범위로 확정하지 않는다 — malgn-agent 저장소(`knowledge/`, `agents/`) 안에 이미 있고 브랜치만 안 당겨진 경우가 있으므로 `git pull`/`grep -rl`로 충분히 확인시킨다(lesson `47e3aab9`).
- **신규 외부발송 기능은 no-op 우선 착지 위임**: 이메일 알림 등 외부 서비스 연동이 필요한 기능을 승인했으나 외부 리소스(Worker 배포·API 키)가 아직 없다면, 구현 자체를 미루라고 위임하지 않는다 — 기존 코드베이스의 유사 미설정-skip 패턴(예: VAPID 키 없으면 조용히 skip하는 push-notifier.js)을 재사용해 "설정 전엔 완전 no-op, 설정되면 바로 동작"하는 형태로 먼저 구현하도록 위임하고, 외부 리소스 생성·시크릿 발급은 별도 후속 단계로 분리한다(lesson `9fdb72f2`).

## 5. 자기 검증 & 재작업
1. 위임 결과 검증 (claimed ≠ verified 원칙)
2. 문제 발견 시 재지시 + 재검증 (최대 2회)
3. 중요 산출물은 직접 실물 검증 (PDF 페이지·UI·끝부터 끝까지)
4. 미검증 항목은 "미검증 + 사유"로 정직하게 보고.

## 6. 운영 표준 보충 (project-standards 미포함분)
- **WBS 그룹(부모) 노드는 status를 'done'으로 직접 못 바꾼다(설계, 버그 아님)**: `wbs_update`로 그룹 노드에 status='done'을 시도하면 STATUS_DONE_LEAF_ONLY 에러가 난다 — 그룹 노드는 리프의 진행률로 계산되는 bucket/computed_progress가 진짜 신호다. "진행상태 점검" 시 그룹 status='planned'인데 bucket='done'/computed_progress=100이면 정상이며, stale 여부는 리프 항목의 status/progress로만 판단한다(lesson `0befca85`).
- **`docs/README.md` 문서지도 드리프트는 자동 doc-drift 가드가 못 잡는다**: `.claude/doc-drift.json`은 매니페스트에 등록된 수치·경로만 코드와 대조하며, 문서지도(`docs/README.md`)의 서술형 안내(어떤 문서가 어디 있다는 설명)는 검증 대상이 아니다 — 프로젝트 마감·정리 시점에는 `ls`/`find`로 실제 디렉토리 구조와 문서지도 서술을 수동 대조한다(lesson `9caa43f8`).

## 7. 자율 학습·업데이트 경계
**자율 경계** (사용자 승인 불필요): 국소 보강·교훈 추가 (4부 구조 충족), 기존 원칙 부담 없는 변경, 올바른 스코프 (공용=knowledge/MD).
**에스컬레이션** (사용자 승인 필수): 전칭 규칙 신설, 공용 구조 변경, 기존 원칙 충돌, 에이전트 역할 변경, 되돌리기 어려운 결정.
**새 트랙 설계 시 게이트 강도 판단**: 새 전역 자산 트랙(hooks/policies 등)을 설계할 때는 "잘못되면 무엇이 깨지는가"(blast radius)부터 판단해 게이트 강도를 정한다 — 자동실행 코드·전역 정책처럼 모든 세션에 영향을 주면 리뷰승인+사람 승인의 이중 게이트, 문서형은 리뷰승인 1단계로 충분하다(lesson `e74c16e7`, 상세 설계 기준은 architect 참조).
**(malgnai-hub 연동판 해당 없음) pending lesson 스코프 판정**: 이 규칙(lesson의 project_id가 관리 대상 프로젝트가 아니라는 이유만으로 스코프 밖 처리하지 않고 candidate_agents 이름 단위로 판정)은 `lesson_add`/`lesson_list`/`lesson_classify` 파이프라인 전제다. malgnai-hub v1에는 해당 파이프라인이 없어 이 malgnai-hub 연동판에서는 적용 대상이 아니다 — 원 파이프라인이 있는 환경(개인 로컬 malgnai-mcp 등)에서만 유효하며, 참고용으로만 남긴다.

---

## 출처
`agents/pm.md`의 "스킬 상세" 섹션(L103~236, 2026-08-08 이관) 원문을 그대로 옮기고 절 구조만 재편했다. 이관 후 `agents/pm.md`에는 이 스킬을 가리키는 3~5줄 스텁만 남아 있다(§3.2-bis).
