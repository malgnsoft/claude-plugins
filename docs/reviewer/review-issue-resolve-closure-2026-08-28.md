# 이슈 종결(issue_resolve) 절차 공백 보강 리뷰 보고서

리뷰 페르소나 패널(5인, 전원 재사용):
`personas/persona-doc-table-source-consistency-auditor.md` · `personas/persona-field-executability-officer.md` · `personas/persona-product-body-portability-auditor.md` · `personas/persona-enforcement-gap-auditor.md` · `personas/persona-process-mechanism-zero-based-challenger.md`(발산형)

리뷰 대상: worktree `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-afbfae2565a6672a2`, 브랜치 `trainer/issue-resolve-closure-20260828`, 커밋 `813f2a2` (main 대비 5파일 +22/-4)
target_id: `issue-resolve-closure-20260828` (1차, 최초 리뷰 — 풀패널)
리스크 범주: 전역 배포 자산(21개 에이전트 중 3개 MD + 전 에이전트 참조 스킬) · 상시비용 증가 · hub 기록 파이프라인
리뷰 일자: 2026-08-28
종합 판정: 🟡 **Amber** (🔴 0 · 🟠 2 · 🟡 8 · ⚪ 0 · 🔵 2)

## 요약 (2분 규칙)

절차 설계와 hub 스키마 대조는 정확하다 — `issue_resolve(projectId/issueId/result)`·`issue_update` 미제공·`sections=['issues']`가 전부 실재하고, "여기서 `issueId`도 회수된다"는 주장은 **실호출 1회로 실증**했다(발명된 파라미터 0건). 병합 전 처리를 권고하는 Major는 둘이다: ①정본이 세운 카브아웃 "파일을 고치지 않는 역할은 지목까지만 한다"가 **evaluator를 문자 그대로 포함**해(evaluator.md에 Edit 도구 없음) 같은 커밋이 evaluator.md에 넣은 필수 의무와 정면 충돌한다. ②evaluator.md +677 B가 예산 사유서가 변호하는 실측치를 정확히 초과해 `pnpm run check-assets`에 **이 diff가 만든 새 WARN**(`BUDGET_RATIONALE_DRIFT`)이 떴다. 부수적으로, reviewer 제외 판단은 사실관계는 맞지만 "이미 커버된다"는 결론은 성립하지 않는다 — 부여된 의무가 적힌 정본을 reviewer가 읽을 경로가 없다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|-------|------|------|---------|------|--------|
| RV-001 | 🟠 | 정합성 | `skills/common-learning-loop-knowledge-management/SKILL.md:31` ↔ `agents/evaluator.md:125` | 두 파일 Read + `agents/*.md` frontmatter `tools:` 전수 출력 | 정본의 카브아웃이 **"산출물을 검증만 하고 수정하지 않는 역할"**을 지목까지로 제한하는데, evaluator.md:4 `tools:`에 Edit이 없다(Read, Grep, Glob, Write, Bash, Skill, WebFetch, WebSearch, TodoWrite, ToolSearch, mcp). 즉 evaluator가 이 카브아웃에 문자 그대로 해당하는데, 같은 커밋이 evaluator.md:125에 "닫았는가"를 필수 체크로 넣었다. 더구나 이 카브아웃의 축("Edit 없음")은 trainer가 reviewer를 제외할 때 쓴 근거와 같은 축이라, 그 근거를 evaluator에 적용하면 모순이 된다 | 기준을 **"파일을 고치는가"에서 "그 라운드의 hub 기록 주체인가"로** 바꾼다. 같은 문장 뒷부분("호출은 그 라운드의 기록 주체가 한다")이 이미 옳은 기준을 담고 있으므로 앞 절만 정정하면 된다 |
| RV-008 | 🟠 | 강제력/상시비용 | `agents/evaluator.md` (전체 크기) · `docs/refactor/evaluator-budget-rationale.md:5` | `pnpm run check-assets` 실행 + `git show main:…\| wc -c` | **이 diff가 새 WARN을 만든다**: `WARN [BUDGET_RATIONALE_DRIFT] agents/evaluator.md — 24.8 KB, 사유서가 변호하는 24.1 KB를 677 B 초과`. main의 evaluator.md는 24,691 B로 사유서 :5의 값과 정확히 일치했으므로 초과분 677 B는 전부 이번 추가분이다. 이 저장소는 ERROR 0을 기준선으로 삼고 직전 릴리스에서도 "예산 사유서 실측 갱신"을 같은 라운드에 처리한 선례가 있다 | 사유서 :5 실측치를 갱신하고 항목 불릿 1줄(무엇이 677 B를 늘렸는가)을 추가한다 — 그 문서는 이미 항목별 증분 구조라 형식이 준비돼 있다. 같은 커밋에서 처리 |
| RV-002 | 🟡 | 정합성 | `skills/common-learning-loop-knowledge-management/SKILL.md:19-34` (신규 H4 :24) | 해당 파일 헤딩·목록 구조 grep(`^#`/`^- \*\*`) | 신규 `#### 이슈 종결(Close)`가 "### 1. 교훈 기록(Capture)"의 **도구별 필드매핑 목록 한가운데** 삽입돼, 뒤따르는 `- decision_record`(:34)·work_record 항목들이 문서 구조상 "이슈 종결" 하위로 종속된다. 목록이 H4로 두 동강 났다 | Close 소절을 목록이 끝나는 자리(`### 2. 메모리 참조` 직전)로 옮기거나 `### 1-2. 이슈 종결(Close)` 형제 헤딩으로 승격 |
| RV-003 | 🟡 | 정합성 | 정본 `SKILL.md:32` · `agents/evaluator.md:125` · `agents/pm.md:41` · `skills/project-orchestration/SKILL.md:190` | 4파일 해당 줄 Read | "부분 해소는 닫고 다시 연다(issue_update 없음)" 절차가 **4자리에 복제**됐다. 이 저장소 CLAUDE.md [변경이력 관리 원칙]이 명시적으로 경고한 패턴이고, hub에는 같은 뿌리의 열린 이슈("판정 회차 기록 주체 서술이 6곳 중복 → 3라운드 연속 새 결함")가 실재한다. 지금은 4사본이 서로 일치하지만 다음 변경 때 고칠 자리가 4곳이다 | 트리거 자리에는 "겹침 재점검 + `issue_resolve`"만 남기고 부분해소 처리는 정본 포인터로 대체(3자리 ≈ 600 B 회수, 트리거 실효는 불변) |
| RV-004 | 🟡 | 정합성 | `agents/pm.md:45` (미변경) · pm.md:41(신규 문장) | pm.md Read + `grep -rln 'common-learning-loop-knowledge-management' agents/` | pm.md의 이슈 기록 정본 자리(:45 "주요 결정·이슈는 malgnai-hub에 기록 (decision_record / issue_record)")는 여전히 **여는 쪽만** 말한다. 새 문장은 :41의 장문 STATUS.md 불릿 속(WBS/issue 라벨 실측 맥락)에 있어, "이슈를 어떻게 기록하나"를 찾는 독자가 닫는 절차를 만나지 못한다. pm.md는 정본 스킬을 참조하지 않아(grep 결과 미포함) 파일 내 도달 경로도 없다 | :45에 "(해소를 확인하면 `issue_resolve`로 닫는다 — 정본: Skill `common-learning-loop-knowledge-management`)" 한 구절 추가. pm.md 신규 사본에 정본 포인터가 없는 문제(RV-003)도 함께 닫힌다 |
| RV-005 | 🟡 | 실행가능성 | 정본 `SKILL.md:30` · `project-orchestration/SKILL.md:190` · `evaluator.md:125` | `project_get_context(projectId, sections=['issues'], limit=20)` **실호출 1회** | 라운드마다 열린 이슈를 **전량 열거**하는 비용이 절차에 반영돼 있지 않다. 실측: 이 프로젝트 응답이 이슈 10건 ≈ 14,000자(설명 필드가 건당 1~3 KB). 같은 라운드에서 PM(§5-5)과 evaluator(자기검증)가 각각 호출하면 2배다. 도구에 `limit`(최대 50)이 있는데 절차가 언급하지 않는다 | 정본에 "`limit`으로 상한을 두고, 열린 이슈가 많으면 `project_search_history(query=이번 라운드가 손댄 파일·주제, types=['issue'])`를 1차 필터로 쓴다"를 명시. 열거는 라운드당 1회로 몰고 다른 주체는 지목 결과를 인계받게(트레이드오프 §1 참조) |
| RV-006 | 🟡 | 정합성(스코프) | 정본 `SKILL.md:22` | diff 해당 줄 + `issue_record` 스키마 원문 | "문제로 인지한 순간 연다 / hub에 백로그 타입은 없다"는 **여는 시점·백로그 의미**에 관한 신규 규칙으로, 이번 위임 범위(닫는 절차 공백)의 밖이다. 사실관계는 정확하다(스키마에 type/backlog 필드 없음, status는 open/resolved). 변경 동결 원칙상 위임 범위 밖 규칙 신설은 별건 판단 대상 | 이번 커밋에서 분리하거나, PM이 "이 문장도 승인 범위"임을 명시 |
| RV-009 | 🟡 | 상시비용 | `agents/trainer.md`(+936 B) · `skills/project-orchestration/SKILL.md`(+797 B) | `pnpm run check-assets` 실행 + 파일별 바이트 실측 | 둘 다 이미 `BUDGET_UNJUSTIFIED` 상태(trainer 29.5 KB vs 권고 15 KB, project-orchestration 28.7 KB vs 권고 25 KB)에서 더 커졌다. trainer.md 추가분 중 표 아래 3문장은 정본 서술의 재진술이고, 같은 문단 끝에 이미 정본 포인터가 있다 | 표 행 + "정본은 Skill …" 1문장으로 압축(≈600 B 회수). 트리거 실효는 표 행이 담당하므로 불변 |
| RV-010 | 🟡 | 강제력 | `hooks/stop-mcp-reminder.cjs:139,148` (미변경) | 훅 소스 Read | 새 절차의 강제 장치는 evaluator 자기검증 1줄 + PM 검증절차 1단계뿐이고, 둘 다 **건너뛰면 아무 신호도 남지 않는 자기판단**이다. 반면 이 저장소의 유일한 자동 발동 장치인 Stop 훅은 이번에 손대지 않았고, 그 구조가 정확히 이 사각을 만든다: `needRecord = hasWriteSignal && !alreadyRecorded`(:139) 때문에 **이번 턴에 `issue_record`를 한 번이라도 부르면 리마인더가 통째로 억제**되고, 문면(:148)도 "이번에 연 이슈가 해결됐으면"만 말한다 | 발산형 R1 참조. 이 diff의 결함이라기보다 남은 공백이므로 별건 승인 대상 |
| RV-011 | 🟡 | 누락 | `agents/reviewer.md`(제외 결정) · 정본 `SKILL.md:31` | reviewer.md 실물 Read + `grep -rln`(참조 관계) + `grep -nE '_record\|hub'` | 제외의 **사실관계는 참**이다 — reviewer.md:4 `tools:`에 Edit 없음, hub 기록 언급 0건. 그러나 "이미 커버된다"는 결론은 성립하지 않는다: reviewer에게 부여된 의무("지목까지만 한다")가 적힌 자리는 정본 SKILL인데 **reviewer.md는 그 스킬을 참조하지 않는다**(참조 목록: backend-dev·capture-strategist·evaluator·frontend-dev·qa-engineer·trainer·agent-common-principles·learning-loop-patterns·project-orchestration — reviewer 없음). `knowledge/common/agent-common-principles.md:27`에 "본문 정본은 …" 수동 각주가 있을 뿐 호출 지시가 아니다(2홉). reviewer 산출물 표준(`reviewer-persona-panel-standard` §5)에도 "종결 후보" 자리가 없다. 또 reviewer.md `tools:`에는 `mcp__…malgnai-hub__*`가 있어 도구 부재도 근거가 못 된다 | (a) 최소안: 보고서에서 "커버된다"는 근거를 빼고 미커버로 정직하게 남긴다. (b) 저비용 실효안: 정본 :31의 지목 문장에 "그 라운드의 리뷰 보고서 'PM에게 권고'에 적는다"를 붙이고 reviewer.md 자기검증에 8~10 단어 추가. **실증**: 이번 리뷰가 정본을 읽었기에 지목이 나왔다 — 안 읽었으면 아래 §PM 권고 4항은 없었다 |
| RV-012 | 🟡 | 누락 | `skills/learning-loop-patterns/SKILL.md:96,107,110,175` · `agents/pm.md:96` | `grep -rn 'issue_record\|issue_resolve'` 전수 + 각 자리 문맥 Read | 이슈를 **여는** 지시를 담은 자리 2곳이 이번 grep 사이트 목록에서 빠졌다. (a) `learning-loop-patterns`는 태스크 단위 3단계 플레이북으로 issue_record를 4곳에서 지시하는데 Post-Execution에 닫는 대응이 없다 — **backend-dev·frontend-dev·qa-engineer 등 실제로 이슈를 여는 실무 에이전트가 이 경로로 온다**. :12에서 이미 정본을 참조하므로 한 줄로 닫힌다. (b) `pm.md:96`은 사람 승인 대기 시 `issue_record`를 남기게 하는데, 승인을 받아 그 행위를 마친 뒤 닫으라는 대응이 없다 — 종결 시점이 명확한 대표적 짝이라 일반 규칙보다 이 자리에 1구절이 더 듣는다 | (a) `learning-loop-patterns` Post-Execution에 "연 이슈가 해소됐으면 `issue_resolve`" 1줄. (b) pm.md:96 문장 끝에 "승인을 받아 그 행위를 마치면 그 이슈를 닫는다" 1구절. 판단 필요: `common-permission-policy-compliance/SKILL.md:151`(승인 결과를 issue_record에 기록)은 성격이 "기록"이라 종결 대상인지 별도 판단 |

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|------|----------|------|------|
| 본문 저작 규율 | evaluator.md 신규 문장만 "합니다"체라 나머지 4자리(한다체)와 문체 불일치 | 기각 | evaluator.md는 원래 합니다체다(:27, :141 등 동일). 파일별 기존 문체와 일치하므로 결함이 아니다 |
| 발산형 | "issue_resolve를 트리거하는 절차가 malgn-agent 어디에도 없었다"는 전제가 틀렸다 — `hooks/stop-mcp-reminder.cjs:148`이 이미 `issue_resolve`를 안내한다 | 기각(근거는 R1로 이관) | 문면은 있으나 실효가 0이다: (a) "이번에 연 이슈가 해결됐으면"이라 기존 열린 이슈를 가리키지 않고 (b) :139 억제 조건 때문에 `issue_record`를 부른 턴에는 아예 출력되지 않는다. 전제는 실질적으로 참 |
| 정합성 | 정본에서 "해결책: 해결 시 `issue_resolve`의 `result`에 기록" 필드매핑 줄이 삭제돼 의미가 손실됐다 | 기각 | 신규 :30이 "확인한 근거(파일:라인, 확인 방법)를 `result`에 적는다"로 더 구체적으로 대체했고 부분해소 절차(:32)도 `result` 사용을 규정한다. 손실 없음 |
| 실행가능성 | evaluator가 `projectId`를 어디서 얻는지 신규 문장에 없어 실행 불가 | 기각 | 같은 파일 :132가 "STATUS.md 상단 `project_id`를 그대로 쓰고, 비어 있으면 `repository_key`로 `project_bootstrap`" 조달 경로를 정의한다. 파일 내 자기완결 |

## 페르소나별 관점

### [정합성 감사관 `persona-doc-table-source-consistency-auditor`] — 판정: 🟠 Amber
정본↔트리거 4자리 대조에서 **서술 내용의 모순은 없다** — 네 자리 모두 "확인한 사람이 닫는다 + 부분 해소는 닫고 다시 연다"로 일치하고, 세 자리(evaluator·trainer·orchestration)는 정본 포인터까지 달았다. 문제는 **기준 자체의 자기모순 1건**(RV-001)과 **정본 문서구조 1건**(RV-002), 그리고 **사본 수**(RV-003·RV-004)다.

역할경계 충돌 여부는 위임이 지목한 두 지점을 각각 확인했고 **둘 다 충돌 없음**으로 판정한다:
- trainer.md의 `work_record` 주인 판별("각 행은 그 행이 서술하는 실행을 실제로 한 주체가 남긴다")과 새 규칙은 **오히려 같은 원리**다 — `issue_resolve`의 `result`가 서술하는 실행은 "해소 확인"이므로 주어가 확인자다. 표에서 유일하게 3열 모두 ✅인 행을 만들고 그 이유를 바로 아래 문단에서 못박은 처리는 표의 의미론(역할별 분리)을 깨지 않으면서 예외를 드러낸다.
- evaluator.md의 "회차 기록 전담"(:27, :141)과도 충돌하지 않는다 — 그 배타 선언의 대상은 `decision_record`/`agent_score_record`이고, 신규 항목은 다른 도구·다른 대상이다.

### [현장 실행가능성 검사관 `persona-field-executability-officer`] — 판정: 🟢 Green
신규 문장이 가리키는 도구·파라미터를 **스키마 원문 + 실호출**로 전수 대조했다. 전부 통과:

| 신규 문장의 주장 | 대조 결과 |
|---|---|
| `issue_resolve`(`projectId`/`issueId`/`result`) | 스키마 required와 정확히 일치(3개, 그 외 필드 없음) |
| "열린 이슈를 갱신하는 도구는 없다(`issue_update` 미제공)" | `issue_record` 도구 description이 직접 명시 — 인용 정확 |
| `project_get_context(projectId, sections=['issues'])` | `sections` enum에 `issues` 실재 |
| "여기서 `issueId`도 회수된다" | **실호출로 실증** — 응답의 각 이슈에 `id`(ULID) 존재 |
| `project_search_history(projectId, query, types=['issue'])` | `types` enum에 `issue` 실재 |
| evaluator의 `projectId` 조달 | 같은 파일 :132에 정의 — 자기완결 |

발명된 파라미터 0건. 이 저장소가 과거 데인 "hub에 없는 도구명이 실행 단계로 지시됨" 유형의 결함은 이번 diff에 없다. 잔여는 비용 규율 1건(RV-005)뿐이다.

### [이식성 감사관 `persona-product-body-portability-auditor`] — 판정: 🟢 Green
신규 본문 5자리 전수 검사: 조회 불가 식별자(hub id·ULID·커밋 해시·메모리 키) **0건**, 날짜 도장 **0건**, 이관/폐기 경위·버전·라운드 언급 **0건**. 규칙이 생긴 이유는 날짜·주체 없는 현재형으로 남겼다("미루면 아무도 돌아오지 않는다", "다음 세션이 그 목록을 현재 상태로 믿고 끝난 일을 다시 착수한다") — [제품 본문에 이력 금지] 원칙이 요구하는 형태 그대로다. 설치 직원이 조회할 수 없는 근거는 한 건도 유입되지 않았다.

### [강제력 격차 감사관 `persona-enforcement-gap-auditor`] — 판정: 🟠 Amber
"절차를 적었다"와 "그 절차가 발동하고 상시비용을 정당화한다"를 갈랐다. 기계 검증에서 **이 diff가 만든 새 WARN 1건**을 잡았다(RV-008) — 이 저장소는 예산 사유서를 실측치로 변호하는 구조라, 사유서를 갱신하지 않은 증분은 자동으로 드리프트 신호가 된다.

상시비용 실측(상시 = 매 호출 전량 로드):

| 파일 | 성격 | 증분 | 평가 |
|---|---|---|---|
| `agents/evaluator.md` | 상시 | +677 B | 실효 **높음** — evaluator는 실물 대조를 가장 많이 하고 이미 hub 기록 주체다. 단 부분해소 재진술을 빼면 같은 실효를 ~250 B로 낼 수 있다 |
| `agents/trainer.md` | 상시 | +936 B | 실효 **중간** — 표 행이 트리거를 담당하고 아래 3문장은 정본 재진술. 압축 권고(RV-009) |
| `agents/pm.md` | 상시 | +332 B | 실효 **높음** — PM이 stale 이슈를 실제로 발견하는 지점에 붙었다. 자리 선택이 정확하다 |
| `skills/project-orchestration/SKILL.md` | 조건부(PM invoke) | +797 B | 실효 **높음** — 라운드 종료 시점에 정확히 걸린다. 상시비용 아님 |
| 정본 SKILL | 조건부 | +3,052 B (5.0→8.0 KB) | 정본이 커지는 것은 설계대로. 이견 없음 |

즉 위임이 물은 두 지점의 답: **evaluator.md 1줄은 실효가 있으나 현재 길이의 60%면 충분**하고, **project-orchestration §5 1단계는 상시비용이 아니며 발동 시점이 정확해 유지 권고**다. 다만 둘 다 자기판단 강제라 발동 보장은 없다(RV-010·R1).

### [제로베이스 도전자 `persona-process-mechanism-zero-based-challenger`] — 판정: 🔵 (구조 제언 2건, 아래)

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|----------|----------|------------|----------------|
| R1 | 절차 문장을 5자리(상시비용 3자리 포함)에 추가하고, 발동은 evaluator·PM의 자기판단에 맡긴다 | 이미 매 턴 Stop에 발동하고 이미 `issue_resolve`를 문면에 가진 `hooks/stop-mcp-reminder.cjs`를 두 줄 고친다: ①:139 억제 조건에서 "이번 턴에 `issue_record`만 쓴 경우"를 제외(현재는 아무 기록 도구나 쓰면 통째 억제돼, **이슈를 연 바로 그 턴이 닫기 리마인더를 못 받는다**) ②:148 문면에 "이번 작업이 건드린 파일과 겹치는 **기존** 열린 이슈도 확인"을 추가 | 자기판단 의존 0(훅은 조건이 맞으면 반드시 발동) · 상시 MD 비용 0(턴 종료 시에만 실행) · 21개 에이전트가 아니라 세션 1곳에서 발동 · 이미 존재하는 인프라라 신설 없음 | 훅은 코드라 변경 동결 하 **별건 승인** + 픽스처 실행 검증 필요. 리마인더는 비차단(`systemMessage`)이라 강제력은 여전히 약하다 — 문서 절차와 배타적이지 않고 **보완재**다 |
| R2 | 라운드마다 열린 이슈를 전량 열거해 "이번에 손댄 파일·주제와 겹치는 것"을 사람이 고른다 | 이슈에 대상 파일을 실어두고 "이번 diff 파일 목록 ∩ 열린 이슈의 파일"로 기계 매칭한다. hub 이슈 레코드에는 `related_file` 컬럼이 **실재하는데**(실호출 응답 전건 `"related_file":null`) `issue_record` 도구 파라미터에 노출돼 있지 않아 채울 수 없다 | 지금 절차의 가장 약한 고리는 "겹치는 것을 고른다"는 자기판단이다(건너뛰어도 무증상). 그 판정을 데이터로 옮기면 판단 편차와 전량 열거 토큰(RV-005)이 동시에 사라진다 | 도구 스키마 변경은 **malgnai-hub 저장소 스코프**라 이 저장소에서 못 한다 → hub 백로그로 제기. 단기 근사: `summary` 첫 줄에 `[files] a.md, b.md` 규약을 두고 grep — 규약 준수가 다시 자기판단이라 효과는 절반 |

## 트레이드오프 (페르소나 간 충돌)

1. **강제력 vs 실행비용** — 강제력 페르소나는 "evaluator와 PM 양쪽에 sweep을 걸어야 한쪽이 건너뛰어도 잡힌다"고 보고, 실행가능성 페르소나는 "같은 라운드에서 전량 열거를 2회 하면 라운드당 2만~3만 자를 태운다"(실측 기반)고 본다. → **권고**: 열거는 라운드당 1회로 몰되 주체를 evaluator로 고정하고(어차피 실물 대조를 하는 회차), PM의 §5-5는 "evaluator/reviewer가 지목한 후보 + 자신이 직접 확인한 것"을 닫는 것으로 좁힌다. 이중 안전망은 잃지만 비용이 절반이고, 잃은 안전망은 R1(훅)이 더 싸게 대신한다.
2. **정본 단일화 vs 트리거 도달성** — 정합성 페르소나는 사본 4개를 줄이라 하고(RV-003), 강제력 페르소나는 "상시 MD에 문장이 없으면 그 에이전트는 발동하지 않는다"고 본다(reviewer 사례가 그 증거 — RV-011). → **권고**: 트리거 문장(조건+도구명+정본 포인터)은 각 자리에 남기고, **절차 상세(부분해소 처리)만** 정본으로 회수한다. 트리거 실효는 유지하면서 다음 변경 시 고칠 자리를 1곳으로 줄인다.

## 잘 된 점

- **스키마 대조가 정확하다.** 4개 도구·모든 파라미터가 실재하고 "issue_update 미제공"은 도구 description 원문과 일치한다. 이 저장소가 반복해서 데인 "hub에 없는 도구명을 실행 단계로 지시" 유형이 이번엔 0건이다.
- **"닫는 주체는 확인한 사람"이 기존 기록 주체 원칙과 충돌하지 않는다.** trainer.md의 "각 행은 그 행이 서술하는 실행을 실제로 한 주체가 남긴다"와 같은 원리 위에 서 있고, 표에서 유일하게 3열 ✅인 행을 만든 뒤 그 이유를 바로 아래에서 설명한 처리는 표의 의미론을 지키면서 예외를 드러낸다.
- **부분 해소를 "닫고 다시 연다"로 푼 것은 도구 제약 하의 유일한 실행 가능 경로**이고, 이 프로젝트에서 오늘 실제로 그 패턴이 쓰인 이슈 2건이 hub에 남아 있어 실증됐다("…이전 이슈에서 분리" 2건).
- **정본 1 + 트리거 4의 배치와 정본 포인터 부착**(pm.md 제외 3자리)은 이 저장소가 3라운드 연속 데인 "정본 없이 6곳이 각자 서술" 패턴을 구조적으로 피한다.
- **pm.md의 트리거 위치 선택이 정확하다** — "WBS/issue 라벨을 믿지 말고 코드로 실측하라"는 바로 그 문단은 PM이 실제로 stale 이슈를 발견하는 지점이다. 발견 지점과 조치 지점이 같은 문장에 있다.

## 평가기준 충족 현황

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|------|------|-------|------|------|
| 정본↔트리거 4자리 서술 불일치 0건 | 정합성 | 필수 | ✅ | 내용은 일치. 기준 자체의 자기모순은 RV-001 |
| 기존 역할경계(work_record 주인·회차 기록 전담)와 무충돌 | 정합성 | 필수 | ✅ | 두 지점 각각 확인 |
| 정본 문서구조 정합 | 정합성 | 권장 | ❌ | RV-002 |
| 인용 도구·파라미터 전부 실재 | 실행가능성 | 필수 | ✅ | 스키마 원문 + 실호출 |
| 지시 실행에 필요한 입력(projectId·issueId) 조달 경로 존재 | 실행가능성 | 필수 | ✅ | evaluator :132, `issueId`는 열거 응답에서 회수 |
| 실행 비용이 절차에 규율됨 | 실행가능성 | 권장 | ❌ | RV-005 |
| 조회 불가 식별자·이력 유입 0건 | 본문 규율 | 필수 | ✅ | 5자리 전수 |
| 규칙의 이유를 현재형으로 유지 | 본문 규율 | 권장 | ✅ | |
| 정적검사 신규 ERROR/WARN 0건 | 강제력 | 필수 | ❌ | RV-008 (신규 WARN 1건) |
| 상시비용 증분이 실효로 정당화됨 | 강제력 | 권장 | △ | evaluator·pm 자리는 정당, trainer는 압축 여지 |
| 이슈를 여는 모든 사이트에 짝이 되는 닫기 경로 | 누락 | 권장 | ❌ | RV-011·RV-012 |
| 발산형 대안 제시 | 발산 | 필수 | ✅ | R1·R2 |

## PM에게 권고

1. **병합 전 처리(2건, 둘 다 국소 — trainer 위임)**: RV-008(예산 사유서 실측 갱신 — 이 diff가 만든 WARN이라 방치하면 다음 라운드가 원인을 다시 추적해야 한다), RV-001(정본 카브아웃 기준을 "기록 주체"로 정정 — 지금 문면대로면 evaluator.md 신규 의무가 정본 위반이 된다).
2. **권장(같은 라운드에 함께 처리하면 저비용)**: RV-002(헤딩 위치 1줄 이동), RV-004(pm.md:45에 1구절 — RV-003의 pm.md 포인터 누락도 함께 닫힘), RV-012(a)(`learning-loop-patterns`에 1줄 — 실무 에이전트 도달 경로).
3. **판단 필요**: RV-006(정본 :22의 "여는 시점" 규칙이 이번 위임 범위 밖 — 분리할지 승인 범위로 볼지), RV-011(reviewer를 미커버로 정직하게 남길지, 1구절로 닫을지).
4. **종결 후보 지목**(정본 :31에 따라 reviewer는 지목까지만 하고 호출하지 않았다): 이 라운드를 촉발한 이슈 — 제목 "백로그 이슈가 부수적으로 해소돼도 issue_resolve가 걸리지 않는 절차 공백"(`01m137j8z1fq65t66ebs9pax3b`, status `open`, 2026-08-28 개설). **지금 닫지 말 것** — 아직 main에 없다. 병합 후 닫되, 그 이슈 본문이 제안한 자리는 두 곳(project-orchestration §5 / evaluator.md 자기검증)인데 실제로는 5자리가 바뀌었으므로 `result`에 반영 5자리를 적어 닫는다. 이 이슈가 지금 열려 있다는 사실 자체가 RV-010(자기판단 강제력의 한계)의 실증이다.
5. **별건 백로그**: R1(훅 2줄 — 효과 대비 비용이 가장 낮은 후보), R2(hub `related_file` 노출 — hub 저장소로 제기), RV-003·RV-005·RV-009(사본 수·열거 비용·상시비용 압축).

## 산출물 게이트 · 정직 보고

- 페르소나 5개 전원 **재사용**(신규 0). 재사용 판정과 근거는 아래 표. 5개 파일 전부 실재하며 각 파일 "적용 이력"에 이번 라운드 항목을 append했고 `personas/INDEX.md`의 "최근 재사용" 열을 갱신했다.
- **화면 리뷰 없음** — 문서·에이전트 MD 리뷰라 캡처 대상이 없다(생략 사유).
- 모든 지적에 위치와 확인방법을 붙였다. 기각·강등한 지적 4건은 "기각된 지적"에 사유와 함께 남겼다.
- **실행 액션 없음** — push/PR/merge를 하지 않았고, `issue_resolve`도 호출하지 않았다(지목만). hub 호출은 읽기 1회(`project_get_context`)뿐이며 어떤 기록도 남기지 않았다.
- **미확인으로 남긴 것**: (a) `project_get_context`의 `limit` 기본값 — 문서화돼 있지 않아 RV-005의 비용 추정은 "limit=20 지정 시 실측"이다. (b) hub의 `related_file` 컬럼이 다른 경로로 채워지는지 여부 — 이 저장소에서 확인 불가(hub 스코프). (c) `common-permission-policy-compliance/SKILL.md:151`의 issue_record가 종결 대상인지 — 성격 판단이 필요해 지적이 아니라 질문으로 남겼다.

### 페르소나 재사용 판정 (§6 산출물 게이트)

| 페르소나 | 판정 | 사유 |
|---|---|---|
| `persona-doc-table-source-consistency-auditor.md` | **재사용** | INDEX 역할개념 "요약 표가 정본 산출물 경로를 정확히 압축했는지 원문과 대조" = 이번 대상(정본 1 ↔ 트리거 4 대조)과 동일 역할개념 |
| `persona-field-executability-officer.md` | **재사용** | "지시가 지금 당장 실행 가능한 구체 절차인지" = 도구·파라미터 실호출 가능성 대조와 동일 |
| `persona-product-body-portability-auditor.md` | **재사용** | "설치 직원이 조회할 수 없는 근거가 제품 본문에 유입됐는지" = 본문 저작 규율 관점과 동일 |
| `persona-enforcement-gap-auditor.md` | **재사용** | "원칙 문장이 체크리스트/영속 필드로 강제 가능한지" = 상시비용 대비 실효·강제력 관점과 동일 |
| `persona-process-mechanism-zero-based-challenger.md` (발산) | **재사용** | "도입한 메커니즘이 문제 크기에 비례하는지, 더 단순한 개입으로 같은 효과를 낼 수 있는지" = 발산형 요구와 동일. 신규 발산 페르소나를 만들 근거 없음 |

신규 0건이므로 "신규 표기 시 INDEX 대조 근거" 요건은 해당 없음. INDEX.md 대조는 착수 전 "역할개념(1줄)" 열 전수 스크리닝으로 수행했다.
