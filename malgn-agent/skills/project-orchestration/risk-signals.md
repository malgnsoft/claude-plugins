# §2. 리스크 판단 — 신호 판정 로직

> Skill `project-orchestration` §2의 본문이다. 색인은 `skills/project-orchestration/SKILL.md`에 있다(이 파일을 열라고 지시한 그 파일이며 이미 로드돼 있다).
> 이 파일에서는 `CLAUDE_PLUGIN_ROOT` 변수가 치환되지 않는다 — 플러그인 자원을 실제로 열거나 실행하는 지시는 색인 쪽에 둔다.

- **입력**: `wbs_list` 응답과 동일한 배열(또는 `{items:[...]}`) JSON. 필드가 일부 없는 항목은 해당 신호만 조용히 건너뛴다(전체 실행 중단 없음).
- **이전 스냅샷 확보 방법**: 별도 이력 저장소가 없으므로, 정기 점검 시점마다 `wbs_list` 결과를 `wbs-YYYY-MM-DD.json` 형태로 파일에 남겨두는 습관이 필요하다 — 직전 파일을 `--previous`로 넘기면 된다.
- **출력**: 항목별 신호·심각도·판정 근거(수치)·표준 대응 문구를 표로 출력(§ 아래 체크리스트와 1:1 대응). PM은 이 표를 받아 High부터 원인 조사에 들어간다.
- 스크립트가 다루지 않는 것: 아래 "malgnai-hub Issue/Decision과 연계" 섹션(`project_get_context`의 issues/decisions 교차 확인)은 WBS 단일 소스가 아니라 별도 시스템 조회가 필요해 스크립트 범위 밖이다 — 이 부분은 계속 수동으로 확인한다.

**WBS 신호 읽기 (조기 경고 패턴의 근거 로직)**
- **진행 정체** *(스크립트 미판정 — 아래 표 주석 참조)*: progress=0 지속(3일 이상)
  - 원인: 담당자 미할당, 의존성 미해결, 요구사항 불명확
  - 대응: `wbs_update(assigneeAgentName)` 확인 후 담당자 1:1 확인 필수

- **Status 불일치**: in_progress인데 progress=0 또는 planned인데 progress > 0
  - 원인: 상태 기록 누락, 또는 자동 착수 후 수동 미업데이트
  - 대응: 실제 진행 상태 재확인 + wbs_update로 status와 progress 동기화

- **computedProgress 추락**: 부모 노드의 computedProgress가 전일 대비 5% 이상 하락
  - 원인: 자식 항목 중 하나 이상이 완료→미완료로 되돌려지거나(버그 fix), 또는 새 자식 항목이 added with progress=0
  - 대응: wbs_list(projectId, parentId=<부모_id>)로 자식들을 재조회해 변화 요인 식별

**병렬 작업 의존성 추적**
- **Parent-Child 블로킹 리스크**:
  - wbs_list(projectId, status='delayed') → parentId별로 그룹화
  - 상위 항목(parent)이 delayed면 그 자식들도 실질적으로 시작 불가 → 의존성 블로킹

- **크리티컬 패스 모니터링**:
  - wbs_list(projectId, includeDone=false) → 모든 항목의 endDate 추출
  - ⚠️ 이 필터된 결과는 **눈으로 볼 때만** 쓴다. `check-wbs-warnings.mjs`에는 넣지 말 것 — 스크립트는 전체 스냅샷(`includeDone=true`, 즉 필터 없는 `wbs_list(projectId)`)을 전제로 부모·자식 관계를 계산하므로, done 항목이 빠진 입력을 주면 자식이 전부 done인 그룹이 리프로 오판된다
  - 가장 가까운 deadline 항목들이 progress < 70% 이면 → critical path 리스크
  - 여러 항목의 deadline이 같은 주에 몰려 있으면 → 리소스 경합 리스크

- **의존성 체인 명확화** (WBS 설계 단계에서):
  - 각 항목의 description에 "선행: [선행항목_id]" 또는 "블로킹: [블로킹_id]" 태그 기재
  - 프로젝트 회고 시 이 메타데이터가 실제 진행에 맞았는지 검증

**malgnai-hub Issue/Decision과 연계**
- **Issue 매핑**: malgnai-hub `project_get_context(projectId, sections=['issues'])`의 열린 이슈에서
  - 설명에 "[WBS:#<item_id>]" 태그가 있으면 해당 WBS 항목의 블로킹 리스크로 판정
  - issue status='open' + WBS status='delayed' → 복합 리스크(2배 에스컬레이션)

- **의사결정 지연 추적**: `project_get_context(projectId, sections=['decisions'])`에서
  - 의사결정이 필요한 항목(description에 "의사결정 대기" 표기)인데 decision이 last 7일 동안 없으면 → 지연 위험
  - WBS startDate 경과 후에도 관련 decision이 없으면 → 착수 전 명확화 부족

- **기록 선택(옵션)**: 리스크 발견 시 issue_record로 기록
  - summary: "WBS:#item_id 지연 (3일 progress=0)" 형식으로 트레이서빌리티 확보

**조기 경고 휴리스틱 체크리스트** (이 8행이 판정 로직의 정본이고, 그중 **6행을 `check-wbs-warnings.mjs`가 구현한다** — 조건·심각도·대응 문구를 바꿀 때는 스크립트도 함께 갱신한다)

| 신호 | 조건 | 심각도 | 대응 |
|------|------|--------|------|
| 진행 정체 *(스크립트 미판정)* | progress=0 > 3일 | Medium | 담당자 1:1, status 재확인 |
| 착수 미확인 *(스크립트 미판정)* | status='in_progress' && progress=0 > 1일 | Medium | 실제 진행 상태 수집 |
| 임박 기한 위반 | 리프 항목이 deadline ≤ today && progress < 100 | High | 즉시 에스컬레이션 + 일정 재계획 |
| 기한 박박 | (endDate - today) ≤ 3일 && progress < 50% | Medium | 가속화 협의, 스코프 축소 검토 |
| 크리티컬 패스 | earliest_deadline인데 progress < 70% | High | 리소스 추가, 병렬화 재검토 |
| 롤업 추락 | parent.computedProgress ↓ 5% | Medium | 자식 상태 재조회, 변화 요인 식별 |
| 의존성 블로킹 | parent.status='delayed' → children.startDate 경과 | High | 상위 항목 가속화 또는 의존성 제거 검토 |
| 상태 불일치 | status ≠ inferred_status_from_progress | Low | wbs_update로 동기화 + 미래 기록 개선 |

> **"스크립트 미판정" 두 행은 시간 경과를 봐야 하는 신호다.** 두 조건 모두 "얼마나 오래 그 상태였나"를 요구하는데, `wbs_list`·`project_get_context` 어느 응답에도 항목의 최종수정시각 필드가 없어 단일 스냅샷만으로는 판정할 수 없다 — 스크립트는 이 둘을 건너뛰고 그 사유를 리포트에 남긴다. **`--previous` 스냅샷 비교로 복원할 수 있다**("롤업 추락"과 같은 패턴: 직전 스냅샷과 대조해 무변화 기간을 계산). 그전까지 이 두 신호는 PM이 눈으로 확인한다.
>
> **임박 기한 위반·기한 박박은 리프 항목에만 적용된다.** 그룹 노드의 진행률은 자식 롤업이라 그룹까지 세면 같은 지연이 부모·자식 양쪽에서 중복 경고된다.
