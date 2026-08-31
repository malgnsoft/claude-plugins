# §1. WBS 기반 프로젝트 관리

> Skill `project-orchestration` §1의 본문이다. 색인은 `skills/project-orchestration/SKILL.md`에 있다(이 파일을 열라고 지시한 그 파일이며 이미 로드돼 있다).
> 이 파일에서는 `CLAUDE_PLUGIN_ROOT` 변수가 치환되지 않는다 — 플러그인 자원을 실제로 열거나 실행하는 지시는 색인 쪽에 둔다.

**WBS 착수 — 항목 생성**
- **초안 일괄 생성**: `wbs_bulk_add(projectId, items[])`로 Step+하위 작업을 트랜잭션 1개에 원자 생성한다(1~100개). 각 항목은 `tempId`·`title`이 필수이고, 자식은 `parentTempId`로 부모를 가리키며 **부모가 배열에서 자식보다 먼저 와야 한다**. 착수 시 WBS 전체 골격을 한 번에 세우는 기본 경로다.
- **항목 1건 추가**: `wbs_add(projectId, title, idempotencyKey, [parentId])`. 진행 중 작업이 하나 늘어날 때 쓴다 — `parentId`를 생략하면 최상위 Step이 된다. `idempotencyKey`가 필수라 재시도해도 중복 생성되지 않는다.
- 두 도구 모두 파라미터는 camelCase다(`assigneeAgentName`·`startDate`·`endDate`·`responsibleTeam`). 생성 이후의 상태 갱신은 `wbs_update`, 조회는 `wbs_list`가 담당한다.

**WBS 진행상황 추적**
- **정기 현황 수집** (주 1회 이상): `wbs_list(projectId)` 호출 → 전체 항목의 status/computedProgress/bucket 수집
- **부모 노드는 rollup 신호만 본다**: WBS 그룹(Step/Group)의 status는 직접 변경 불가 — 리프 항목들의 progress로 자동 계산되는 computedProgress와 bucket('planned'/'in_progress'/'done'/'delayed')이 진짜 신호
  - 예: 그룹 status='planned'인데 computedProgress=100·bucket='done' → 정상(리프 다 완료)
  - 예: 그룹 status='in_progress'인데 bucket='delayed' → 하위 항목 지연 상황 반영
- **리프 항목만 실제 진행률**: progress는 리프 노드만 업데이트 가능(`wbs_update` 호출), 자식이 있는 노드에 progress를 주면 에러

**병목·지연 항목 모니터링**
- **지연 항목 식별**: `wbs_list(projectId, status='delayed')` → 계획 종료일 경과 + progress < 100인 항목 필터
  - **`delayed`는 서버 파생값이다 — 직접 지정할 수 없다.** `wbs_update`의 status가 받는 값은 `planned`/`in_progress`/`done` 셋뿐이고, `delayed`는 종료일·진행률로 서버가 계산해 붙인다. 조회 필터(`wbs_list`)와 rollup bucket에서만 등장하므로, 지연을 "기록"하려 들지 말고 종료일·progress를 사실대로 갱신한다.
- **진행 정체 신호**:
  - status='in_progress'인데 progress=0 지속(3일 이상) → 실제 착수 미확인, 담당자 확인 필수
  - progress 무변화 기간이 deadline까지 남은 일수보다 길면 → 가속화 필요
- **롤업 추락 추적**: 부모 computedProgress가 이전 점검 대비 5% 이상 하락 → 하위 항목 연쇄 지연 신호

**동적 우선순위 재조정**
- **병렬 작업 상위 영향**: WBS에서 진행 중인 항목 중 deadline이 가장 가까운 항목(크리티컬 패스) 식별
- **상위 항목 지연 시**: parentId 필터로 해당 그룹의 모든 자식 항목 조회 → 상위 완료 대기 중인 후속 작업 일정 재조정
- **blocked 상태 추적**: 다른 팀/에이전트의 산출물 대기 중인 항목은 우선순위 맨 뒤로, 대기 해제 후 재상향
  - malgnai-hub issue와 연계: `project_get_context(projectId, sections=['issues'])`의 열린 이슈에서 해당 WBS 항목 참조 → issue 해결 시 자동 blocked 해제

**마일스톤·단계별 진행 관리**
- **Phase별 게이트**: 각 phase 완료를 "모든 리프 항목 progress=100 && status='done'"으로 정의
  - wbs_list(projectId, parentId=<phase_id>) → 해당 phase의 리프만 조회
  - 리프 중 하나라도 progress < 100이면 phase 미완료 선언
- **Status 전이 추적**: 단계별 담당자가 `wbs_update(status='done')`할 때 `completedDate` 동시 기록
- **STATUS.md와 동기**: 각 phase 완료 후 STATUS.md 완료섹션 갱신 + WBS 상태 일관성 확인
