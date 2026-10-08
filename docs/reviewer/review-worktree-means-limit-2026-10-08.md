# 리뷰: 워크트리 격리 수단 한정 (787ff03) — 2026-10-08

- **대상**: 브랜치 `worktree-agent-aa7ff947a1cbab560` 커밋 `787ff03` (베이스 `55428ad`), 3파일 3줄
  - `malgn-agent/skills/project-orchestration/delegation-transfer.md:21`
  - `malgn-agent/skills/project-standards/SKILL.md:20`
  - `malgn-agent/bin/new-project.mjs:47`
- **target_id**: `worktree-means-limit-20261008` (최초 리뷰. 재검토 3요소가 위임에 없어 최초로 처리. 주제상 가장 가까운 선행 리뷰: `docs/reviewer/review-worktree-isolation-merge-completion-2026-09-18.md`)
- **등급**: Standard (약식 패널) — 노출 범위 축소 해당 없음
- **실행 액션**: 없음. 대상 파일은 하나도 수정하지 않았다. 커밋·병합·push도 하지 않았다. 이 저장소에 쓴 것은 이 보고서와 페르소나 이력 append, INDEX.md 갱신뿐이다(메인 체크아웃 `docs/reviewer/` 아래, 미커밋)

## 종합 판정: 🟡 Amber

요구사항 ①~④는 문면상 전부 충족한다. 다만 새로 들어간 사실 단정 "서브에이전트에게는 `EnterWorktree`가 없다"가 공식문서 미러 원문과 **정면으로 어긋난다**(🟠 RV-01). 실제 행동 지시("쓸 수 없으면 직접 만들지 말고 보고")는 조건문이라 안전하다. 틀린 것은 이유 서술이다. 고쳐야 하는 건 한 문장이다.

## 페르소나 재사용 판정 (INDEX.md 대조 완료)

| 페르소나 | 유형 | 재사용/신규 | 사유 |
|---|---|---|---|
| persona-harness-spec-factchecker.md | 수렴 | 재사용 | 새 문장이 단정한 하네스 사양(`EnterWorktree`의 서브에이전트 가용성, `ExitWorktree` 의미)을 미러와 줄 단위로 대조하는 일이 바로 이 역할개념이다 |
| persona-decision-reversal-auditor.md | 수렴 | 재사용 | 정본 한 곳을 고칠 때 같은 규율을 인용·요약하는 다른 자리와 어긋나지 않는지 보는 일(요구 (c)) |
| persona-product-body-portability-auditor.md | 수렴 | 재사용 | 날짜·식별자·이력이 유입됐거나 제거됐는지 보는 일(요구 ③) |
| persona-zero-based-redesigner.md | 발산 | 재사용 | "산문으로 금지를 늘리는 구조가 최선인가"를 묻는 발산형 슬롯 |

신규 페르소나는 없다. 4개 모두 INDEX.md에 같은 역할개념 행이 이미 있었다.

## 요구사항 충족표

| # | 요구사항 | 판정 | 근거 |
|---|---|---|---|
| ① | 격리 수단은 하네스 기능 둘뿐이고, `git worktree add` 금지와 프로젝트 밖 폴더 금지가 정본 한 곳에 명확하다 | ✅ (RV-01 조건부) | `delegation-transfer.md:21` "격리 수단은 하네스가 이미 제공하는 둘로 한정한다" + 볼드 "**이 둘 밖에서 작업 폴더를 만들지 않는다**" + "`git worktree add`를 쓰지 않고 … 프로젝트 밖(`~/workspace/` 아래 등)의 별도 폴더든". 정본은 이 한 곳이고, 다른 자리는 여기를 가리킨다 |
| ② | project-standards의 ~/workspace 규칙이 워크트리에 적용되는 것처럼 읽히지 않는다 | ✅ | `project-standards/SKILL.md:20` "이 규칙은 새 프로젝트를 어디에 만드는가에만 적용된다 — 기존 프로젝트 안에서 브랜치 작업을 격리할 워크트리는 여기에 만들지 않으며" |
| ③ | 제품 본문 규율(이력·날짜·식별자 없음, 이유는 현재형) | ✅ | 추가된 줄 전체를 `\b[0-9a-f]{8}\b`와 `20[0-9]{2}-[0-9]{2}`로 grep → 0건. 이유는 현재형 문장이다("하네스 밖에서 만든 폴더는 정리되지 않고 별도 프로젝트처럼 남으며"). `new-project.mjs:47`은 날짜 도장 `(2026-08-23 재현)`만 지웠고 이유 문장은 그대로다. 파일 안에 남은 날짜 0건 |
| ④ | 새 프로젝트 생성 규칙 불변 | ✅ | `new-project.mjs`는 주석 1줄만 바뀌었다(코드 무변경). `project-standards:20` 첫 문장은 그대로이고 범위를 좁히는 문장이 뒤에 붙었다 |

정적검사: 리뷰 대상 워크트리에서 `validate-agent-assets.mjs` 결과 ERROR 0 · WARN 15 · INFO 10. 베이스(`55428ad`, 메인 체크아웃)와 같다. `check-docs` 3/3 통과.

## 지적 사항

| ID | 심각도 | 위치 | 인용 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| RV-01 | 🟠 Major | `delegation-transfer.md:21` | "서브에이전트에게는 `EnterWorktree`가 없다" | `docs/anthropic/agents/sub-agents.md:407-418` 원문을 Read했다. `malgn-agent/agents/*.md` 24개 frontmatter `tools:`도 grep했다 | **사양과 반대다.** sub-agents.md:407 "Subagents inherit the built-in tools … narrowed by two filters". 첫 필터의 제거 목록(:409-417)에 `EnterWorktree`는 없다. 두 번째 필터(:418)는 백그라운드 서브에이전트에도 "`EnterWorktree`, `ExitWorktree`"를 **명시적으로 남긴다**. 하네스 차원에서 서브에이전트는 이 도구를 갖는다. 문장이 malgn-agent 안에서만 사실상 맞는 이유는 다르다. 24개 에이전트 전부의 `tools:` 허용목록에 `EnterWorktree`가 없기 때문이다(pm.md 포함). 사용자 정의 에이전트나 general-purpose처럼 `tools`를 생략한 에이전트는 이 도구를 갖는다. 그런 에이전트는 도구 목록과 본문이 모순되는 상태로 일하게 된다. 선행 리뷰(2026-09-18)도 같은 :418을 "`EnterWorktree` 실재" 근거로 썼는데, 그 줄이 이번 단정을 반증한다 | 이유를 사실대로 바꾼다. 예: "도구 목록(`tools`)에 `EnterWorktree`가 없는 에이전트는". 아니면 사실 단정을 지우고 조건문만 남긴다("격리되지 않은 상태로 작업을 받았는데 하네스 수단을 쓸 수 없으면 …"). 뒤따르는 행동 지시는 그대로 유지한다 |
| RV-02 | 🟡 Minor | `delegation-transfer.md:21` | "`EnterWorktree`로 들어간 워크트리의 정리는 `ExitWorktree`로 한다" | `docs/anthropic/` 전체를 `ExitWorktree`로 grep했다 → `sub-agents.md:418`의 도구 이름 나열 1건뿐이다. `worktrees` 페이지와 tools-reference는 미러에 없다(`ls docs/anthropic/reference`) | 도구가 실재하는 것은 확인된다. **의미(정리가 "나가기"인지 "삭제"인지, 브랜치를 함께 지우는지)는 미러로 확인할 수 없다.** 같은 bullet의 하위 항목 :23 "병합 전에는 완료가 아니다"와의 순서도 적혀 있지 않다. `ExitWorktree`가 워크트리를 지우는 동작을 포함한다면 미병합 상태에서 "정리"할 때 작업이 사라질 수 있다(이 위험은 기억에 근거한 추정이라 Minor로 둔다) | "정리는 병합(또는 미병합·승인대기 기록) 뒤에" 같은 순서 조건을 붙인다. 의미 단정은 사양을 확인한 범위로만 적는다. 저장소 쪽 후속: `sync-docs` 대상에 worktrees 페이지 추가를 검토한다(PM 몫, 제품 본문 아님) |
| RV-03 | 🟡 Minor | `project-standards/SKILL.md:20` | "[delegation-transfer.md](../project-orchestration/delegation-transfer.md)" | `ls`로 링크 대상 실재 확인(존재함). `common-output-storage-and-path-management/SKILL.md:77-89`(§1-2)를 Read. `project-orchestration/SKILL.md:102` 형식 대조. `skills/` 아래 `](../` 패턴 grep | **경로는 실재한다(요구 (d) 충족).** 다만 스킬 사이를 가로지르는 상대 링크는 이 자리 하나뿐이다(다른 1건은 예시 이미지). 같은 대상을 가리키는 `project-orchestration/SKILL.md:102`는 `${CLAUDE_PLUGIN_ROOT}/skills/project-orchestration/delegation-transfer.md` 형식을 쓴다. §1-2는 맨 상대경로를 Read하면 사용자 프로젝트 cwd에서 찾다가 실패한다고 적는다. 이 문장은 "열라"는 지시가 아니라 정본 위치 안내라서 실패 영향은 작다 | `${CLAUDE_PLUGIN_ROOT}/skills/project-orchestration/delegation-transfer.md` 형식으로 맞춘다. 아니면 링크를 빼고 "Skill `project-orchestration` §4.3" 산문 포인터만 남긴다(`team-composition-patterns.md:120`과 같은 방식) |
| RV-04 | ⚪ Nit | `delegation-transfer.md:21` | (bullet 전체) | 파일 Read | 한 bullet에 적용 범위·`git init` 선행·수단 2종·Workflow 경로·경로 고정·금지 목록·금지 이유·정리 도구·서브에이전트 예외까지 9개 절이 들어가 있다. 형제 규칙은 하위 bullet(:22-23)로 나뉘어 있다. 모순은 없다 | 변경 동결 중이라 지금은 손대지 않는다. 다음 구조 정리 때 "격리 수단"을 하위 bullet로 분리할 후보로 둔다 |
| RV-05 | ⚪ Nit | `delegation-transfer.md:21` (대비 함의) / 저장소 `CLAUDE.md:25` | "하네스 밖에서 만든 폴더는 정리되지 않고" / CLAUDE.md "작업이 끝나면 정리까지 해주지만" | `sub-agents.md:305`, `claude-code/claude-directory.md:1519` Read | 사양상 자동 정리는 "subagent makes no changes"일 때만이다(:305). 변경이 있는 워크트리는 남고, orphan으로 판정될 때 `cleanupPeriodDays` 기준으로 지워진다(:1519). 제품 본문은 대비로만 함의하니 문제가 작다. 단정은 저장소 CLAUDE.md:25 쪽이 더 강하다 | CLAUDE.md는 PM이 고칠 수 있는 범위이니 "변경 없으면 정리" 수준으로 표현을 맞춘다. 제품 본문은 그대로 둬도 된다 |

### 🔵 Rethink (발산형 — persona-zero-based-redesigner)

**RT-01: 금지 문장을 늘리기보다 종결 시점에 탐지한다.** 이번 수정은 실패(작업 폴더가 `~/workspace/` 아래에 따로 생겨 남는 것)를 "하지 마라" 산문으로 막는다. 그런데 같은 스킬의 종결 체크리스트 `project-orchestration/SKILL.md:110` 6항이 이미 `git worktree list`를 돌린다. 대안은 그 6항에 판정 한 줄을 더하는 것이다. "목록에 `.claude/worktrees/` 밖 경로가 있으면 하네스 밖에서 만든 워크트리다 → 병합 여부를 확인하고 정리한다." 금지문은 착수할 때 읽혀야 효과가 있다(이 bullet의 Read 트리거는 "위임 프롬프트를 보내기 직전"뿐이다). 종결 체크는 매 라운드 끝에 실행된다. 즉 이미 돌아가는 명령 하나의 출력을 해석하는 것만으로 산문 금지가 놓친 경우를 잡을 수 있다. 다만 `git init` 없이 만든 독립 폴더는 `git worktree list`에 나오지 않으므로 이 대안은 `git worktree add` 경로만 잡는다. 비용: 6항에 1문장. 변경 동결 기준으로는 개선이라 지금이 아니라 백로그 판단 대상이다.

## 인용·요약처 전파 점검 (요구 (c))

같은 규율을 담은 자리를 커밋 `787ff03` 기준으로 `git grep -nE "git worktree|EnterWorktree|ExitWorktree|isolation|워크트리"`(대상: `malgn-agent/`·`CLAUDE.md`) 돌려 하나씩 대조했다.

| 위치 | 내용 | 정합 |
|---|---|---|
| `CLAUDE.md:24-25` (저장소 규칙) | 수단 2종 · `git worktree add` 금지 · 프로젝트 밖 폴더 금지 · `ExitWorktree` | ✅ 일치(RV-05의 "정리" 과단정만 있음) |
| `knowledge/leadership/team-composition-patterns.md:120` | 병렬 위임은 `isolation:"worktree"`, 일반 규율은 §4.3을 보라 | ✅ 수단 범위 안에 있고 정본으로 위임함 |
| `skills/project-orchestration/SKILL.md:102` | §4.3에서 delegation-transfer.md를 Read하라 | ✅ |
| `skills/project-orchestration/SKILL.md:110` | `git worktree list` · `git branch --no-merged` | ✅ 조회 명령이라 `git worktree add` 금지와 충돌하지 않음 |
| `skills/project-standards/SKILL.md:20` | 범위 한정 + 정본 포인터 | ✅ (형식만 RV-03) |
| `CHANGELOG.md:41` | 직전 릴리스 항목(EnterWorktree 서술) | 해당 없음(이력 문서). 이번 커밋에는 CHANGELOG 항목이 없다. push 시점 release 커밋에서 적을 몫 |
| `trainer.md:90` · `agent-upskill:17` · `reflect-lessons:73` · `topic-learning:98`의 `git checkout -b` | — | 위임 지시에 따라 재지적하지 않음(백로그 등재됨) |

인용처 사이의 새 불일치는 0건이다.

## 잘 된 점

- 정본을 한 곳(`delegation-transfer.md:21`)에 두고 `project-standards`는 범위를 좁히는 문장과 포인터만 갖게 했다. 두 벌로 서술하는 것을 피했다.
- 금지 이유를 현재형 결과 서술로 적었다("정리되지 않고 별도 프로젝트처럼 남으며"). 경위도 날짜도 없다.
- 서브에이전트가 격리 수단을 못 쓸 때 "직접 만들지 말고 호출자에게 보고"라는 탈출구를 둔 것은 옳다. RV-01은 이유 문장만 고치면 되고 지시는 살릴 가치가 있다.
- `new-project.mjs:47`에서 날짜 도장만 정확히 걷어내고 이유 문장은 남겼다.
- 정적검사 수치가 베이스와 같다(회귀 0).

## 기각된 지적

| 후보 | 기각 사유 |
|---|---|
| "프로젝트 밖(`~/workspace/` 아래 등) 금지"가 "모든 프로젝트는 `~/workspace/` 아래" 규칙과 충돌한다 | `project-standards:20`의 새 문장이 그 규칙의 범위를 새 프로젝트 생성으로 한정했다. 두 문장을 같이 읽으면 충돌이 없다 |
| `new-project.mjs:47`에서 날짜를 지워 재현 근거가 사라졌다 | 제품 본문 이력 금지 규칙에 맞는 수정이다. 이유 문장("디렉토리가 실제로 만들어진다")은 남아 있다 |
| 정적검사 회귀 | 베이스와 대상 둘 다 ERROR 0 · WARN 15 · INFO 10. 차이 없음 |
| `.claude/worktrees/`로 "고정"이라는 표현이 과단정이다 | 사실이지만 이번 diff가 바꾼 줄이 아니다. 선행 리뷰에서 ⚪로 이미 지적됐다 |

## 생략·미검증

- `EnterWorktree`/`ExitWorktree`를 직접 호출해보지 않았다(이 리뷰어의 도구 목록에 없다). 사양 대조는 미러로만 했다.
- `ExitWorktree`의 동작 의미는 미러에 페이지가 없어 확인하지 못했다(RV-02).
- 화면 리뷰 해당 없음(문서·주석 변경).

## PM 권고

1. RV-01은 trainer에게 돌려 한 문장을 고치게 한다(Major, 국소 1줄 → 변경 동결 기준의 "사실 오류 정정"에 해당한다). 같은 라운드에서 RV-02 순서 조건과 RV-03 링크 형식도 함께 처리할 수 있다(같은 두 줄).
2. RV-05는 PM이 직접 고칠 수 있는 범위다(`CLAUDE.md:25`).
3. RT-01은 개선이라 백로그 판단 대상이다.
4. push 전 release 커밋에 이번 수정의 CHANGELOG 항목을 함께 적는다.
