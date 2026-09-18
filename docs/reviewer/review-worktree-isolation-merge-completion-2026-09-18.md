# Micro 초과 작업의 브랜치+워크트리 격리·병합 완결 규율 리뷰 보고서

리뷰 페르소나 패널: persona-enforcement-gap-auditor.md · persona-harness-spec-factchecker.md · persona-semantic-force-preservation-auditor.md · persona-product-body-portability-auditor.md · persona-process-mechanism-zero-based-challenger.md(발산)
리뷰 대상: 워크트리 `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-a8bd5bd469d51ebfb`, 브랜치 `worktree-agent-a8bd5bd469d51ebfb`, 커밋 `9b020ee` (`git diff main` 4파일 / +23 −14)
target_id: `worktree-isolation-merge-completion-20260918`
리스크 범주: 전 직원 배포되는 PM 제품 본문(오케스트레이션 규율) — 전역 자산
작업 등급: Sensitive(배포 제품 본문 변경) → 발산형 포함 풀패널
리뷰 일자: 2026-09-18
종합 판정: 🟡 Amber (Critical 0 · Major 1 · Minor 3 · Nit 2 · Rethink 3)

## 요약 (2분 규칙)

수용 기준 5가지는 **문면상 전부 충족**했고, 인용한 하네스 사양(`EnterWorktree` · `isolation:"worktree"` · `.claude/worktrees/`)은 공식문서 미러와 3중 대조해 전건 실재를 확인했다. 제품 본문 이력 금지 위반 0건, `check-assets` ERROR 0 · WARN 15 · INFO 7로 main과 동일, `bin/new-project.mjs`는 3가지 초기 상태 + 마이그레이션 케이스를 실제 실행해 정상 동작을 확인했다.

다만 **사고의 두 증상 중 "통합하지 않고 완료 처리"를 막는 절반이 잘못된 자리에 놓였다**(🟠 RV-01). "병합 전에는 완료가 아니다"는 위임 프롬프트 발송 직전에만 읽히는 파일에 들어갔는데, 그 규율이 발동해야 하는 시점은 라운드를 닫을 때다. 그 시점에 PM이 실제로 훑는 상시 로드 표면 셋(`agents/pm.md` 자기검증 · `SKILL.md` §5 · `hooks/pm-orchestration-block.md`) 어디에도 "미병합 브랜치" 항목이 없다. 부수적으로, 수용 기준 5(`.gitignore`)는 하네스가 `.git/info/exclude`에 이미 자동 기입하는 항목과 겹친다는 것을 실측으로 확인했다(🟡 RV-03).

## 배치 판단(`agents/pm.md` 미수정)의 타당성 — 호출자 지정 검증 항목

trainer의 논리는 "`pm.md:115`가 위임 전 `project-orchestration` 스킬 호출을 이미 강제하므로 충분하다"였다. 원문 대조 결과 **절반은 성립하고 절반은 성립하지 않는다.**

| 대상 | 원문 | 판정 |
|---|---|---|
| `agents/pm.md:115` | "…전체 절차는 Skill `project-orchestration`이 정본이다. **Standard 이상 작업을 위임하기 전** 이 스킬을 호출해 따른다." | 인용 정확 ✅ |
| `agents/pm.md:110` | "**설계 논의·위임에 착수하기 전에는** §4.3의 스코프 대조…를 먼저 본다." | §4.3으로 가는 2번째 경로 실재 ✅ |
| `SKILL.md:102`(§4.3) | "…작업 격리(브랜치·워크트리)와 병합 완결. **실제 위임 프롬프트를 보내기 직전** `delegation-transfer.md`를 Read한다." | 색인에 신규 키워드 반영됨 ✅ |

**성립하는 부분(격리 절반)** — `isolation:"worktree"`는 Agent 도구 호출의 파라미터다. 즉 "격리할 것인가"를 결정하는 시점이 곧 위임 프롬프트를 쓰는 시점이고, `delegation-transfer.md`의 Read 트리거와 정확히 일치한다. 이 절반에 대해서는 `pm.md`를 고치지 않은 판단이 옳다. 상시비용을 0으로 두고 필요한 시점에만 로드되므로 배치가 오히려 낫다.

**성립하지 않는 부분(병합 절반)** — `delegation-transfer.md:23`이 규율하는 행동("미병합 상태를 완료로 보고하지 않는다")은 라운드를 닫는 시점에 일어난다. 위임 프롬프트를 쓰던 시점과 여러 턴(경우에 따라 컨텍스트 압축 1회 이상) 떨어져 있다. 그 시점에 PM이 실제로 훑는 것은 열거된 자기검증 체크리스트인데, `병합|merge` 전수 grep 결과 완료 게이트에 물린 항목이 **0건**이다.

- `agents/pm.md` 자기검증 8항목 — 미병합 관련 0
- `skills/project-orchestration/SKILL.md` §5 자기 검증 & 재작업 6항목 — 미병합 관련 0
- `hooks/pm-orchestration-block.md` 12항목 — `:19`가 "되돌릴 지점 확보"를 다루나 착수 전 규율이고 완료 게이트가 아님
- `agents/pm.md:109` "**작업 마무리 = STATUS.md 갱신 + git commit 둘 다**" — 완료 정의를 명시적으로 열거하는 상시 로드 문장인데 `commit`까지만 있고 `merge`가 없다

즉 trainer의 자기합리화는 **격리에 대해서는 정확한 판단, 병합에 대해서는 검증되지 않은 유추**다. 사고 보고의 두 증상 중 후자("통합하지 않은 채 완료 처리")가 바로 이 절반이므로 그대로 두면 재발 경로가 남는다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| RV-01 | 🟠 Major | 강제력 | `skills/project-orchestration/delegation-transfer.md:23` (+ 미수정 `agents/pm.md` 자기검증 · `SKILL.md` §5) | 세 파일 Read + `병합\|merge` 전수 grep | "병합 전에는 완료가 아니다"가 위임 프롬프트 발송 직전에만 읽히는 파일에 있다. 규율 발동 시점(라운드 종결)의 상시 로드 표면 3곳 모두 미병합 점검 항목 0건 — 사고의 두 증상 중 "통합 없이 완료 처리"를 막는 게이트가 없다 | `SKILL.md` §5와 `agents/pm.md` 자기검증에 각 1줄 추가: "격리해 진행한 브랜치 중 미병합·미승인으로 남은 것이 있는가(`git worktree list` · `git branch --no-merged`)". 약 150 B로 기계 판정 가능한 신호에 물린다 |
| RV-02 | 🟡 Minor | 강제력 | `delegation-transfer.md:21` "세션이 직접 수행할 때는 `EnterWorktree` 도구" | 파일 Read + `hooks/pm-orchestration-block.md:5` 대조 | 직접수행 분기를 지시하면서 그 문장의 유일한 Read 트리거는 "위임 프롬프트를 보내기 직전"이다 — 위임하지 않으면 도달 경로가 0 | 실질 공백은 좁다(`pm-orchestration-block.md:5`가 "Micro만 직접 처리한다"로 Standard+ 직접수행을 이미 금지). 현 상태 유지 가능하되, RV-01 수정 시 같은 줄에 흡수하면 자연히 닫힌다 |
| RV-03 | 🟡 Minor | 사실검증 | `bin/new-project.mjs:179-181` 주석 | `git check-ignore -v .claude/worktrees/` · `cat .git/info/exclude` · `git status --porcelain --ignored -- .claude/` 실행 | 주석이 단정한 피해("추적하면 격리 작업 파일이 부모 저장소 git 상태에 섞여 커밋 범위를 오염시킨다")가 기본 경로에서 발생하지 않는다. 하네스가 `**/.claude/worktrees/`를 `.claude/` 런타임 10경로와 함께 `.git/info/exclude:11`에 자동 기입하며, `git status`는 `!! .claude/`만 반환한다 | 추가 자체는 무해하므로 되돌릴 필요 없다. 주석의 근거만 실제 차이로 교체: "`.git/info/exclude`는 로컬 전용이라 팀원과 공유되지 않는다 — `.gitignore`에 두면 같은 저장소를 받는 모두에게 적용된다" |
| RV-04 | 🟡 Minor | 의미강도 | `knowledge/leadership/team-composition-patterns.md:120` | 해당 파일 Read + `agents/pm.md:155` 대조 | 덧붙인 포인터("일반 규율은 Skill `project-orchestration` §4.3에서 확인한다")의 도달 확률이 낮다. `pm.md:155`에서 이 knowledge는 상황 태그조차 없는 "참고(상황별 확인)" 목록에 있어 열릴 계기가 약하다 | 구절 자체는 중복 0·무해하므로 유지. 다만 이 줄을 격리 규율의 전달 경로로 계산하지 말 것 — 실 전달은 `SKILL.md` §4.3 → `delegation-transfer.md` 경로가 전부다 |
| RV-05 | ⚪ Nit | 사실검증 | `delegation-transfer.md:21` "경로는 하네스가 `.claude/worktrees/` 아래로 고정하므로" | `docs/anthropic/reference/glossary.md:329` · `hooks/hooks.md:2888`·`:2969` | "고정"은 과한 단정이다. 기본값은 맞으나 `WorktreeCreate` 훅이 `worktree_path`를 임의 경로(`$HOME/…`, SVN 체크아웃 등)로 반환할 수 있다 | "하네스 기본값이 `.claude/worktrees/` 아래이므로"로 완화. 실행 지시("프로젝트마다 별도 경로 규칙을 만들지 않는다")는 그대로 유효 |
| RV-06 | ⚪ Nit | 의미강도 | `delegation-transfer.md:22` | `git show main:…delegation-transfer.md` 원문과 1:1 대조 | 원문의 "…PM이 수동으로 정리해야 하는 **사고가 난다**"에서 결과 명명이 빠졌다 | 부제목에 "필수"가 들어와 순증이므로 조치 불요. 기록만 |

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 사이즈 규율 | `SKILL.md`가 10 KB 상한을 이미 초과한 상태인데 서술이 추가됐다 | **기각(전제 오류)** | 10 KB는 `scripts/validate-agent-assets.mjs:51` `BUDGET_SPECIALIST_KB`(에이전트 MD)이고 스킬 예산은 같은 파일 `BUDGET_SKILL_KB = 25`다. `SKILL.md`는 17.7 KB로 예산 안이며 이번 diff 증가분은 **+23 B**(18,067→18,090)에 불과하다. `check-assets` WARN 개수도 main과 동일(15) |
| 사이즈 규율 | `delegation-transfer.md` +1,320 B가 과도하다 | **기각** | 절 파일이라 `SKILL.md` §4.3 지시로 invoke될 때만 열리는 조건부 비용이다. 상시비용 순증은 색인 +23 B뿐. `SKILL_DIR_TOTAL` 51.3 KB는 검사기가 INFO로만 보고하며 "이 총량 자체가 결함은 아니다"라고 명시한다 |
| 정합성 | `team-composition-patterns.md` 수정이 `CANONICAL_CIRCULAR` 순환참조를 유발한다 | **기각(위험 자체가 미성립)** | 검사기의 `CANONICAL_CLAIM`(`:264`)은 "정본"이라는 낱말이 참조 앞 40자 안에 있어야 매칭되는데 추가 구절은 "…§4.3에서 **확인한다**"로 정본 지목이 아니다. 더욱이 `project-orchestration` 쪽에 `CANONICAL_DISCLAIMER`(정본이 아니다 류) 문장이 0건이라 순환 조건이 애초에 성립하지 않는다. `check-assets` ERROR 0으로 재확인 |
| 중복 | 기존 문장을 일반화한다면서 새 문단을 덧붙여 중복이 생겼다 | **기각** | 원문 1줄 → 신규 3줄(주1·부2) 요소 전수 대조 결과 병렬 조항은 재서술이 아니라 주 규칙의 하위 항목으로 강등됐다. 주 규칙(`:21`)과 하위(`:22`)의 문장이 겹치지 않고, 원문 4요소(`isolation:"worktree"` · 브랜치 얽힘 · 조회/리서치 예외 · Workflow `opts.isolation`)가 모두 1회씩만 등장한다 |

## 페르소나별 관점

### [강제력 격차 감사관] — 판정: 🟠 Amber
격리 절반은 도달 시점이 정확하나(PASS), 병합 절반은 시점이 어긋난다(RV-01). 강제 장치는 이번에도 자기판단 1겹으로 0이며, `git worktree list` / `git branch --no-merged`라는 기계 판정 가능한 신호가 바로 옆에 있는데도 쓰이지 않았다. 이 페르소나가 다섯 라운드 연속 같은 결론을 냈다.

### [하네스 사양 사실검증관] — 판정: 🟢 Green
신설 문장이 단정한 하네스 사양 4건 중 **지어낸 사양 0건**. `EnterWorktree`는 `glossary.md:329`·`claude-directory.md:87`·`sub-agents.md:418` 3중 확인. `isolation: worktree` + `.claude/worktrees/`는 glossary 원문 문자 일치. "고정"의 과단정(RV-05)과 `new-project.mjs` 주석의 사실 오류(RV-03) 2건만 남는다.

### [의미강도 보존 감사관] — 판정: 🟢 Green
일반화 과정에서 원문 4요소 전건 보존, 누락 0, 중복 0. 병렬 조항의 의무 강도는 "특히 격리가 필수"로 오히려 순증했다. 이번 라운드에서 이 축은 모범적이다.

### [제품 본문 이식성 감사관] — 판정: 🟢 Green
추가 라인 전수에 대해 날짜 도장 · "이번 사고/라운드" · "예전/이전엔" · 8자리 hex · ULID 전 패턴 히트 **0건**. 사고 경위를 현재형 메커니즘 서술로 치환한 형태가 정확하다("저장소 밖에 쌓인 산출물은 병합할 경로 자체가 없어 통합이 통째로 누락된 채 완료로 넘어간다"). 자사 배선 유입 0.

### [제로베이스 프로세스 도전자(발산)] — 판정: 🔵 아래 별도 섹션

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| RT-1 | 병합 완결을 **산문**으로 조건부 로드 파일(`delegation-transfer.md:23`)에 둔다 | `SKILL.md` §5 + `agents/pm.md` 자기검증에 **점검 1줄**: "미병합·미승인 격리 브랜치가 남아 있는가(`git worktree list` · `git branch --no-merged`)" | "병합해야 한다"를 모르는 세션은 없다 — 실패는 지식 부재가 아니라 **라운드 종결 시점에 미병합 상태가 아무에게도 안 보이는** 관측 공백에서 났다. 산문은 그 공백을 못 메우고, 기계로 셀 수 있는 신호에 물린 체크 항목은 메운다 | 상시 로드 표면 약 +150 B. 낮음 |
| RT-2 | 준수 여부를 세션 밖에서 셀 수단이 없다 | 같은 두 명령을 읽는 종결 점검을 `project-closure-check` 경로 또는 `scripts/check-*.mjs` 계열에 붙인다 | 이 저장소에 이미 `check-assets`/`check-docs`/`check-status` 선례가 있다. 다섯 라운드 연속 "강제력 0"으로 판정돼 온 고리를 처음으로 닫는 최소 개입 | 스크립트 1개 신설 — **변경 동결 원칙상 개선이므로 백로그 대상** |
| RT-3 | 수용 기준 5가 `.gitignore` 템플릿에 `.claude/worktrees/` 1줄을 넣는다 | 유지하되 주석 근거를 교체하거나, 제로베이스라면 이 줄을 빼고 하네스 자동 제외에 맡긴다 | 하네스가 `.claude/` 런타임 **10경로**를 `.git/info/exclude`에 자동 기입하므로 현재 줄은 "1/10만 덮는 수동 중복"이다. 남길 유일한 근거는 "`.gitignore`는 팀원과 공유되고 `.git/info/exclude`는 로컬 전용"이라는 차이인데, 그 근거가 코드 주석에 없다 | 주석 교체만이면 낮음. 줄 제거는 팀 공유 이점 상실 — **유지 + 주석 교체를 권고** |

## 트레이드오프 (페르소나 간 충돌)

- **강제력 감사관(RV-01 즉시 반영) ↔ 이식성 감사관(상시비용 순증 경계)**: RV-01의 처방은 상시 로드 표면에 약 150 B를 더한다. 이번 diff가 상시비용을 +23 B로 억제한 것이 미덕인데 그 6배를 다시 쓰는 셈이다.
  → **권고: 반영한다.** 이 저장소의 에이전트 업그레이드 원칙이 "1순위 성능, 2순위 토큰"이고, 막으려는 것이 이미 한 번 실제로 난 사고의 직접 원인이다. 다만 두 자리 모두 1줄로 제한하고, `pm.md`는 이미 사유서가 있는 예산 초과 파일이므로 `SKILL.md` §5를 우선한다.
- **발산형 RT-3(중복이니 뺄 수 있다) ↔ 사실검증관(무해하고 공유 이점 있다)**: 
  → **권고: 유지.** `.git/info/exclude`는 로컬 전용이라 새 팀원·CI 클론에는 적용되지 않는다. 다만 주석의 사실 오류(RV-03)는 고친다.

## 잘 된 점 — 유지할 패턴

- **일반화를 "덧붙이기"가 아니라 "강등"으로 처리했다.** 기존 병렬 규칙을 지우지도, 옆에 새 문단을 세우지도 않고 신설 주 규칙의 하위 항목으로 내렸다. 원문 4요소가 전부 1회씩만 살아남아 중복 0·누락 0을 동시에 달성했다 — 이 저장소의 "변경이력 관리로 왕복 방지" 원칙에 정확히 부합하는 편집 형태다.
- **하네스 기존 메커니즘으로 수단을 한정하고 새 경로 컨벤션을 만들지 않았다.** 사고 대응에서 흔한 과잉반응(자체 디렉터리 규칙 신설)을 피했고, 인용한 사양 4건이 전부 공식문서에서 확인됐다.
- **사고 경위를 현재형 메커니즘으로 치환했다.** 날짜·주체·경위 없이 "왜 이 규칙이 있는가"만 남긴 서술은 제품 본문 이력 금지 규칙의 모범 사례다.
- **상시비용을 +23 B로 억제하고 상세는 조건부 로드 절 파일에 뒀다.** 배치 판단의 이 부분은 옳다.
- **`bin/new-project.mjs`의 반복문 재작성이 견고하다.** `existing` 문자열을 루프 안에서 함께 갱신해 같은 실행 내 중복 추가와 개행 누락을 동시에 막는다 — 실행 검증에서 3가지 초기 상태 모두 정확히 동작했다.

## 수용 기준 충족 현황

| # | 기준 | 관점 | 충족 | 근거 |
|---|---|---|---|---|
| 1 | Micro 초과 등급은 개수·병렬/순차 무관하게 브랜치+워크트리 격리 | 의미강도 | ✅ | `delegation-transfer.md:21` "작업 등급이 Micro가 아니면(Standard/Sensitive/Exploration/Refactor) 작업 개수와 병렬·순차 여부에 관계없이" — 5등급 전부 열거, 예외 조건 없음 |
| 2 | 수단을 하네스 기존 메커니즘 2종으로 한정 + 임의 디렉터리 금지 + 새 경로 컨벤션 없음 | 사실검증 | ✅ (⚪ RV-05) | `EnterWorktree`·`isolation:"worktree"`·Workflow `opts.isolation` 명시, "**git과 무관한 디렉터리를 새로 만들어 그 안에서 작업하지 않는다**" 볼드 금지문 실재, "프로젝트마다 별도 경로 규칙을 만들지 않는다" 실재. "고정"이라는 표현만 과단정 |
| 3 | git 저장소가 아니면 격리 전 `git init` | 실행가능성 | ✅ | `delegation-transfer.md:21` 말미 "대상 폴더가 아직 git 저장소가 아니면 격리에 앞서 `git init`부터 한다" |
| 4 | 검증 통과 + 사람 승인 후에만 병합, 병합 전 완료 보고 금지, 수단 미고정 | 강제력 | ⚠️ 문면 충족 / 배치 미흡 | `:23`에 세 요소 모두 실재하고 "로컬 `git merge` 또는 PR·MR — 어느 한쪽으로 고정하지 않는다"까지 명시. 다만 **RV-01** — 규율이 발동해야 하는 시점의 체크리스트에 도달하지 않는다 |
| 5 | `bin/new-project.mjs` `.gitignore` 템플릿에 `.claude/worktrees/` 추가 | 실행검증 | ✅ (🟡 RV-03) | 실제 실행 검증 4케이스 전부 통과 — ①`.gitignore` 없음 → `STATUS.md` + `.claude/worktrees/` 생성 ②기존 파일 있고 개행으로 끝남 → 정상 append ③기존 파일이 개행 없이 끝남 → 개행 삽입 후 append ④`STATUS.md`만 이미 등록된 마이그레이션 상태 → `.claude/worktrees/`만 추가. 콘솔 안내 문구도 복수 항목으로 정확히 갱신 |

## 정적 검사 결과

| 항목 | main | 워크트리 `9b020ee` | 판정 |
|---|---|---|---|
| `pnpm run check-assets` | ERROR 0 · WARN 15 · INFO 7 | ERROR 0 · WARN 15 · INFO 7 | 동일 — 회귀 0 |
| `SKILL.md` 바이트 | 18,067 | 18,090 (+23) | 예산 25 KB 이내 |
| `delegation-transfer.md` 바이트 | 7,022 | 8,342 (+1,320) | 조건부 로드 절 파일 |
| `team-composition-patterns.md` 바이트 | 6,680 | 6,863 (+183) | 조건부 로드 knowledge |
| 이력·식별자 금지 패턴 | — | 히트 0건 | PASS |

## PM에게 권고

1. **병합 전 완료 금지 조항이 아직 결함을 덜 막는다(RV-01) — trainer에 반려 권고.** 요구사항만 전달할 것: "격리해 진행한 브랜치의 미병합 여부가, 라운드를 닫는 시점에 PM이 실제로 훑는 상시 로드 체크리스트에서 확인 가능해야 한다." 문안·배치는 trainer가 제안하게 한다(편집 권한 경계 준수). 현 diff를 되돌릴 필요는 없다 — **추가 1~2줄로 닫히는 보완**이다.
2. **RV-03(`new-project.mjs` 주석의 사실 오류)은 같은 반려 건에 묶는다.** 주석이 서술한 피해가 실측상 발생하지 않으므로, 근거를 "`.git/info/exclude`는 로컬 전용이라 공유되지 않는다"로 교체하면 정확해진다. 코드 동작은 손대지 않는다.
3. **RV-05(⚪)는 같은 라운드에 끼워 넣어도 되고 넘겨도 된다.** "고정" → "하네스 기본값" 한 낱말 교체.
4. **RV-02·RV-04는 조치 불요.** RV-02는 `pm-orchestration-block.md:5`가 이미 덮고 RV-01 수정에 흡수되며, RV-04는 무해한 보조 포인터다.
5. **RT-2(종결 점검 스크립트)는 백로그.** 변경 동결 원칙상 개선이므로 이 라운드에서 승격하지 않는다. 다만 issue 기록에 "다섯 라운드 연속 강제력 0 판정" 맥락과 `git worktree list` / `git branch --no-merged` 두 명령을 함께 적어두면 다음 세션이 재조사 없이 착수할 수 있다.
6. **병합 전 사람 승인은 그대로 필요하다.** 이 diff는 Sensitive 등급 제품 본문 변경이며 이 리뷰는 Amber다 — reviewer 판정을 PM 단독 승인 근거로 쓰지 않는다.

## 리뷰 한계 — 정직 보고

- **화면 리뷰 없음** — 대상이 MD/CLI 스크립트라 UI가 없다. `docs/screenshots/` 생성 없음(해당 없음).
- **실행하지 않은 것** — 브랜치 병합·push·배포·버전업 중 어느 것도 수행하지 않았다. 워크트리 `9b020ee`는 미병합 상태 그대로다. `bin/new-project.mjs`는 스크래치패드에서만 실행했고 저장소 파일을 변경하지 않았다.
- **이번 라운드에서 실제로 쓴 파일** — `docs/reviewer/personas/` 5개 페르소나의 "적용 이력" 섹션 append, `docs/reviewer/personas/INDEX.md`의 "최근 재사용" 열 5행 갱신, 그리고 이 보고서. 페르소나 6대 요소 본문은 건드리지 않았다.
- **검증하지 못한 것** — `EnterWorktree` 도구를 이 실행에서 직접 호출해보지는 않았다(공식문서 미러 3곳 대조로 갈음). `WorktreeCreate` 훅으로 경로를 재정의하는 시나리오도 문서 확인까지만 했다.
- **재사용 판정** — 5개 페르소나 전원 `INDEX.md` 대조 후 **재사용**, 신규 0개. 상세는 아래 표.

## 페르소나 재사용 판정 (산출물 게이트)

| 페르소나 | 유형 | 판정 | 사유 |
|---|---|---|---|
| persona-enforcement-gap-auditor.md | 수렴 | **재사용** | INDEX 역할개념 "원칙 문장이 체크리스트/영속 필드로 강제 가능한지 가르는 강제력 격차 감사관" — 이번 핵심 질문(배치가 행동 시점에 도달하는가)과 동일 역할개념 |
| persona-harness-spec-factchecker.md | 수렴 | **재사용** | "제3자 하네스 사양 주장이 공식문서 원문과 줄 단위로 일치하는지 대조" — `EnterWorktree`/`isolation`/`.claude/worktrees/` 검증이 정확히 이 역할 |
| persona-semantic-force-preservation-auditor.md | 수렴 | **재사용** | "삭제·치환 리팩터링 후 규칙의 경계·강제력이 조용히 약해지지 않았는지 원문과 한 줄씩 대조" — 병렬→일반 규칙 치환 검증에 그대로 적용 |
| persona-product-body-portability-auditor.md | 수렴 | **재사용** | "설치 직원이 조회할 수 없는 근거가 제품 본문에 새로 유입됐는지 목적 기준으로 감사" — 이력 금지 + 상시비용 검증 |
| persona-process-mechanism-zero-based-challenger.md | 발산 | **재사용** | "도입한 메커니즘 전체가 문제 크기에 비례하는지, 더 단순한 개입으로 같은 효과를 낼 수 있는지 의심" — 발산형 슬롯 충족 |

신규 페르소나 0개. 이번 라운드의 리스크 표면(오케스트레이션 규율의 배치·강제력·하네스 사양 정확성·상시비용)은 기존 5개 역할개념 안에 전부 들어가며, 새 리스크 표면이 없어 회전문 페르소나를 만들지 않았다.
