---
name: project-orchestration
description: 요청을 위임한 뒤 WBS로 진행·리스크를 추적하고, 팀을 구성해 위임 모델대로 진행하며, claimed≠verified 원칙으로 검증·재작업까지 마무리하는 PM 실행 절차. Standard 이상 작업을 위임·추적하거나 "진행상황 관리해줘/팀 구성해줘/리스크 점검해줘"라고 요청할 때 사용한다.
---

# Project Orchestration

## 정의

PM(`agents/pm.md`)이 작업을 위임한 **이후** 실행을 관리하는 절차 모음이다. PM의 정체성·핵심 원칙·역할 경계·권한 참조표는 `agents/pm.md`가 정본이며, 이 스킬은 그중 "무엇을 어떻게 위임·추적·검증할지"의 실행 절차만 다룬다(§3.2-bis 판정: 절차 원문은 이 스킬이 정본, `agents/pm.md`의 "스킬 상세" 섹션은 이 스킬을 가리키는 포인터로 압축돼 있다).

`project-standards`(패키지매니저·STATUS.md 형식 등 정적 운영표준)와는 역할이 다르다 — 이 스킬은 "무엇을 어떻게 위임·추적·검증할지"의 행동 절차를 다룬다.

**이 파일은 색인이다.** 절 번호는 그대로다 — 다른 문서가 §2·§3.5·§4.1처럼 가리키는 절은 전부 이 파일의 같은 번호에 있다. 다만 긴 절은 여기에 "무엇이 들어 있고 언제 여는가"만 두고 본문을 같은 디렉터리의 절별 파일로 내보냈다. 한 번의 판단에 필요한 절은 대개 한둘이므로, 전체를 안고 가지 말고 **그 판단에 해당하는 절의 파일만 Read한다**.

- **요약만 보고 그 절의 판단을 하지 않는다.** 각 절에 적힌 한 줄 요약은 "무엇을 열지" 고르라고 있는 것이지 본문을 대신하지 않는다 — 요약으로 갈음하면 그 절이 막으려던 실패가 그대로 난다.
- 본문이 이 파일에 그대로 있는 절(§2의 실행 커맨드·§3.5·§4.1·§4.2·§5·§6·§7)은 따로 열 것이 없다. 매 위임·매 검증마다 걸리는 짧은 규율이거나, 플러그인 경로를 담고 있어 여기 있어야 하는 것들이다.
- **절별 파일을 만들거나 옮길 때**: `${CLAUDE_PLUGIN_ROOT}`가 들어간 문장은 내보내지 않는다. 이 변수는 SKILL.md 본문에서만 실제 경로로 치환되고, Read로 연 파일 안에서는 문자 그대로 남아 열리지도 실행되지도 않는다.

---

## 1. WBS 기반 프로젝트 관리

WBS 항목 생성·진행상황 추적(부모 rollup과 리프 progress를 가르는 법)·병목/지연 모니터링·동적 우선순위 재조정·마일스톤 게이트. **hub의 WBS 도구를 호출하기 전에**(항목을 세울 때든 현황을 수집·갱신할 때든) `${CLAUDE_PLUGIN_ROOT}/skills/project-orchestration/wbs-management.md`를 Read한다 — 일괄 생성 시 부모·자식의 배열 순서, 필수 필드, 파라미터 표기, 서버가 계산해 직접 지정할 수 없는 값 같은 호출 규약이 그 파일에만 있다. 도구 이름만 알고 호출하면 규약을 어겨 실패한다.

---

## 2. 리스크 판단 (WBS 신호 기반)

**신호 판정은 스크립트, 원인 조사·대응은 PM.** 8개 조기경고 신호 중 6개는 `wbs_list` 응답(JSON)에 대한 임계값 비교라, 매번 표를 눈으로 대조하면 놓치기 쉽다(나머지 2개가 왜 빠지는지는 아래 판정 로직 파일의 체크리스트 표 아래 주석 참조). `bin/check-wbs-warnings.mjs`(의존성 없는 Node 내장 모듈만 사용, `bin/analyze-usage.mjs`와 동일 스타일)가 이 판정을 대신한다 — PM은 스크립트 출력에서 걸린 항목만 골라 원인 조사·담당자 확인·재계획 같은 판단을 한다.

```bash
# wbs_list 결과를 JSON 파일로 저장(도구 응답을 그대로 파일로 떨어뜨리거나 붙여넣기)한 뒤:
node "${CLAUDE_PLUGIN_ROOT}/bin/check-wbs-warnings.mjs" --current wbs-snapshot.json

# "롤업 추락"(computedProgress 5%p 하락) 신호는 이전 시점 스냅샷이 있어야 판정된다.
# 정기 점검(§1 "주 1회 이상") 때마다 wbs_list 결과를 날짜별 파일로 남겨두고 직전 스냅샷과 비교:
node "${CLAUDE_PLUGIN_ROOT}/bin/check-wbs-warnings.mjs" --previous wbs-2026-08-05.json --current wbs-2026-08-12.json

# stdin으로도 받는다 + --format json으로 후속 자동화(issue_record 등)에 그대로 넘길 수 있다.
# 종료 코드: High 신호 있으면 2, Medium/Low만 있으면 1, 신호 없으면 0 (CI/스크립트 분기용).
```

> 이 커맨드가 실패하거나(특히 `MODULE_NOT_FOUND`) 새 실행 지시를 쓸 때의 규약 — 따옴표, 이 변수가 치환되는 자리와 안 되는 자리, 맨 명령어를 쓰지 않는 이유 — 은 Skill `common-output-storage-and-path-management` §1-1이 정본이다.

**입력 JSON 규약·출력 해석·8행 조기경고 체크리스트(판정 로직의 정본)·신호별 원인과 대응·malgnai-hub Issue/Decision 교차 확인**은 `${CLAUDE_PLUGIN_ROOT}/skills/project-orchestration/risk-signals.md`에 있다 — 신호를 판정하거나 걸린 항목의 원인을 조사할 때 Read한다.

**점검 주기**
- **일일**: critical path 항목(deadline ≤ 1주) status/progress 단순 조회
- **주 1회(월요 또는 금요)**: wbs_list 전체 조회 → 결과를 `wbs-YYYY-MM-DD.json`으로 저장 → `node "${CLAUDE_PLUGIN_ROOT}/bin/check-wbs-warnings.mjs" --previous <직전 파일> --current <이번 파일>`로 심각도 High 신호 필터 + 보고
- **월 1회**: 완료 항목까지 includeDone=true로 조회 → 계획 대비 실제 소요시간 분석

---

## 3. 팀 구성 원칙

업무 유형별 최소 팀 구성과 단계 축소 기준, ux-designer 투입 판단, 보안 단계 배치, 권위자 매핑, 전역 자산 승격 트랙의 소집 범위, 공유 가정 주입. **누구를 부를지 정할 때** `${CLAUDE_PLUGIN_ROOT}/skills/project-orchestration/team-composition.md`를 Read한다.

## 3.5 산출물 지도 (누가 무엇을 읽고 만드는가)

웹/앱 개발 파이프라인에서 단계별 에이전트가 읽는 입력 문서와 만드는 산출물 경로를 정리한 지도다. §5 자기 검증의 "산출물이 지정된 경로에 실제로 존재하는가" 확인은 이 표를 기준으로 한다.

> **주의(유지보수)**: 이 표는 참고용 요약이지 진실의 원천이 아니다 — 각 에이전트 MD(`agents/<name>.md`) 자체가 정본이다. 에이전트의 산출물 파일명·경로가 바뀌면 trainer가 해당 에이전트 MD를 고치는 김에 이 표도 함께 갱신한다.

| 단계 | 에이전트 | 읽는 문서 | 만드는 문서 |
|------|----------|-----------|-------------|
| STAGE 1 (기획) | planner | - | `docs/requirements.md`, `docs/prd.md`, `docs/product-principles.md`(선택 — 있으면 이후 전 에이전트가 참조) |
| STAGE 2 (설계) | architect | requirements.md, prd.md, product-principles.md(있으면) | `docs/architecture.md`, `docs/tech-stack.md`, `docs/api-spec.md`, `docs/data-model.md` |
| 디자인 트랙(기본 투입 — Micro 등급 제외 항상, 화면 신설/기존 화면 기능변경 시) | ux-designer | prd.md, requirements.md | `docs/design/ux-flow.md`, `docs/design/wireframes.md`, `docs/design/ia.md`(참조: `${CLAUDE_PLUGIN_ROOT}/knowledge/design/ux-design-guide.md`) — wireframes.md에 "visual-designer 필요 여부 + 근거" 명시 필수 |
| 디자인 트랙(ux-designer가 설계 산출물에서 필요 여부 판단: 신규 모듈 또는 비관리자 사용자단 페이지면 필요, 기존 스타일가이드 준수 관리자단 화면이면 생략 가능 — 기존 enum 2개 이상/화면 5개 초과 조건은 보조 신호로 유지) | visual-designer | - | `docs/design/design-system.md`, `docs/design/brand.md`(브랜딩 프로젝트인 경우만) |
| STAGE 3 (구현) | backend-dev | architecture.md, api-spec.md, data-model.md | 코드 + `docs/security-plan.md`(누적 기록, security와 공유) |
| STAGE 3 (구현) | frontend-dev | architecture.md, api-spec.md | `docs/design/publishing-style-guide.md`(프로젝트에 없으면 `${CLAUDE_PLUGIN_ROOT}/knowledge/design/publishing-style-guide-template.md`를 복사해 그 자리에서 생성 — 백지 작성 금지, 이후 전 화면이 이를 따름) |
| STAGE 4 (검증) | qa-engineer | `docs/api-spec.md`(테스트 기준) | `tests/`(단위·통합 테스트) + `tests/test-report.md`(전체/통과/실패 수·커버리지·시나리오 표) |
| 보안(개발 전 구간 상시 병행) | security | api-spec.md, architecture.md(있으면) | 개발 단계: `docs/security-plan.md`(비차단, 발견 적재) / 최종 단계: `docs/security-report.md`(사용자 승인 후에만) |
| STAGE 5 (배포) | devops | `docs/tech-stack.md` | `docs/deployment-runbook-YYYY-MM-DD.md` |
| 독립 트랙 | researcher | - | `docs/research.md`(또는 PM 지정 파일명) |
| 독립 트랙 | localizer | `docs/i18n-glossary.md`(있으면 재사용·갱신) | `docs/i18n-glossary.md`(없으면 감사/번역 중 확정한 용어로 신규 생성 제안) |

**표에 없는 에이전트(writer/reviewer/finance/presenter/marketer/rfp-analyst/capture-strategist 등)**: 자체 산출물은 각자 도메인 폴더에 만든다. `docs/product-principles.md`를 조건부로만 참조한다 — 있으면 읽고 방향성에 맞춰 작성, 없으면 그냥 진행(파일이 없다고 오류 처리하거나 임의로 만들어내지 않는다).

## 3.6 신규 자산 신설 판단 — Agent / Skill / Knowledge 3지선다

전담 에이전트 신설 / 새 Skill 신설 / knowledge 보강·신설 중 무엇을 지시할지 고르는 판정표와, 신설 전 중복·응집도 확인, seedling 표기. **새 도메인 지식·절차가 필요해 무엇을 만들라고 위임할지 정할 때** `${CLAUDE_PLUGIN_ROOT}/skills/project-orchestration/asset-triage.md`를 Read한다.

## 4. 위임 모델

### 4.1 위임 프롬프트에 반드시 들어가는 것

- **작업 등급**: Micro/Standard/Sensitive/Exploration/Refactor 중 하나를 프롬프트에 직접 적는다(판정 기준: Skill `common-task-grading-and-verification-depth`). 등급이 빠지면 수신 에이전트가 검증·캡처 깊이를 임의로 추정한다.
- **목표 + 완료판정 1줄**: "이 작업이 무엇을 만족하면 완료인가"를 측정 가능한 문장으로 못박는다. 완료판정이 빠지면 사후에 evaluator/reviewer가 판정 기준을 즉석에서 재해석하게 되어, 착수 시점의 의도와 사후 판정이 어긋난다.
- **금지 범위**: 건드리면 안 되는 파일·영역을 명시한다. 특히 거버넌스 파일(훅 설정·정책/역할 정의)은 명시적 금지 목록에 넣는다 — 범위를 애매하게 두면 수신 에이전트가 임의로 확장한다.

### 4.2 위임 지시서에는 설계를 쓰지 않는다

프롬프트에는 **무엇이 참으로 남아야 하는가**(요구사항·수용 기준·불변량·금지 범위)만 적고, 방법·구조·문안은 위임받는 전문가가 제안하게 한 뒤 PM이 검증한다.

PM이 해법까지 적어 보내면 전문가는 그 해법을 옮겨 적는 타자기가 되고, 더 나은 대안이 있어도 검토되지 않은 채 **PM의 초안 품질이 산출물의 상한**이 된다. 제안된 방법이 요구를 만족하지 못하면 PM이 그 자리에서 고쳐 쓰지 말고 사유를 붙여 되돌려보낸다(§5의 "검증 사이클 중 설계 변경 금지"와 같은 이유다).

### 4.3 전달 방식

경로 릴레이 순차·슬라이스 위임·저장 경로 명시·`subagent_type` 명시 같은 전달 규약과, 위임 전에 실물로 대조해야 하는 것들(파일 스코프·API 응답 필드·호출자별 부작용·기존 자산 실재)·병렬 위임의 worktree 격리. **실제 위임 프롬프트를 보내기 직전** `${CLAUDE_PLUGIN_ROOT}/skills/project-orchestration/delegation-transfer.md`를 Read한다.

## 5. 자기 검증 & 재작업
1. 위임 결과 검증 (claimed ≠ verified 원칙) — 각 에이전트 산출물이 지정된 경로에 실제로 존재하는가는 §3.5 산출물 지도를 기준으로 확인한다.
2. 문제 발견 시 재지시 + 재검증 (최대 2회)
3. 중요 산출물은 직접 실물 검증 (PDF 페이지·UI·끝부터 끝까지)
4. 미검증 항목은 "미검증 + 사유"로 정직하게 보고.
5. **라운드를 닫기 전 열린 이슈를 재점검한다** — `project_get_context(projectId, sections=['issues'])`로 열린 이슈를 열거해 이번 라운드가 손댄 파일·주제와 겹치는 것을 고르고, 실물 대조로 해소된 것은 `issue_resolve`로 닫는다(부분 해소면 `result`에 해소분·잔여분을 적어 닫고 잔여만 새 이슈로 다시 연다 — 열린 이슈를 갱신하는 도구는 없다). **검증 전용 역할(reviewer 등)이 보고서에 종결 후보로 지목한 것도 여기서 수거한다** — 그들은 지목까지만 하므로 수거하지 않으면 그 지목이 어디에도 도달하지 않는다. 이슈를 여는 절차만 돌리고 이 단계를 빠뜨리면 목록이 한 방향으로만 늘어나, 다른 목적의 라운드가 부수적으로 고쳐놓은 항목이 열린 채 남아 다음 세션이 이미 끝난 일에 착수한다. 상세 규칙은 Skill `common-learning-loop-knowledge-management` "이슈 종결(Close)"이 정본이다.

**검증 사이클이 도는 중에는 설계를 바꾸지 않는다.** reviewer/evaluator가 검증 중인 산출물의 설계를 PM이 그 자리에서 손대면, 검증자는 이미 사라진 버전을 채점하게 되고 돌아온 지적과 실제 산출물이 서로 다른 것을 가리켜 사이클을 처음부터 다시 돌려야 한다. 검증 중에 떠오른 개선 아이디어는 실행하지 말고 적어두었다가, 사이클을 닫은 뒤 다음 사이클의 입력으로 판단한다. 범위·크기 초과 같은 문제도 그 자리에서 고치지 않고 사유서로 남긴다.

## 6. 운영 표준 보충 (project-standards 미포함분)
- **WBS 그룹(부모) 노드는 status를 'done'으로 직접 못 바꾼다(설계, 버그 아님)**: `wbs_update`로 그룹 노드에 status='done'을 시도하면 STATUS_DONE_LEAF_ONLY 에러가 난다 — 그룹 노드는 리프의 진행률로 계산되는 bucket/computedProgress가 진짜 신호다. "진행상태 점검" 시 그룹 status='planned'인데 bucket='done'/computedProgress=100이면 정상이며, stale 여부는 리프 항목의 status/progress로만 판단한다.
- **`docs/README.md` 문서지도가 실제와 어긋나도 알려주는 장치는 없다**: 문서지도의 서술형 안내(어떤 문서가 어디 있다는 설명)는 문서가 옮겨지거나 지워져도 그대로 남아 다음 세션을 없는 파일로 보낸다 — 프로젝트 마감·정리 시점에는 `ls`/`find`로 실제 디렉토리 구조와 문서지도 서술을 대조한다(구조 서술 일반의 대조 규칙은 Skill `project-standards` §6).

## 7. 자율 학습·업데이트 경계
**자율 경계** (사용자 승인 불필요): 국소 보강·교훈 추가 (4부 구조 충족), 기존 원칙 부담 없는 변경, 올바른 스코프 (공용=knowledge/MD).
**에스컬레이션** (사용자 승인 필수): 전칭 규칙 신설, 공용 구조 변경, 기존 원칙 충돌, 에이전트 역할 변경, 되돌리기 어려운 결정.
**되돌리기 어려운 결정은 승인만으로 실행 조건이 갖춰지지 않는다** — 승인을 받았어도 실행 직전에 영향 대상을 열거하고 브랜치·백업·태그·스냅샷으로 되돌릴 지점을 확보하는 단계를 먼저 거친다(정본: Skill `domain-git-safety-and-concurrency` §4). 승인 여부와 복구 가능성은 별개이므로, 에스컬레이션 통과를 이 단계의 대체로 삼지 않는다.
**새 트랙 설계 시 게이트 강도 판단**: 새 전역 자산 트랙(hooks/policies 등)을 설계할 때는 "잘못되면 무엇이 깨지는가"(blast radius)부터 판단해 게이트 강도를 정한다 — 자동실행 코드·전역 정책처럼 모든 세션에 영향을 주면 리뷰승인+사람 승인의 이중 게이트, 문서형은 리뷰승인 1단계로 충분하다(상세 설계 기준은 architect 참조).
