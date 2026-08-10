# 리뷰 보고서(최종 통합): malgnai-hub 대상 프로젝트 부트스트랩 재설계 (2026-08-11, 2차 라운드)

- 대상: `d1d44a1`(오늘 아침 시작 기준점) → `HEAD`(`369ec24`) 전체 누적 diff. 포함 커밋: `795b287`(architect 설계+hooks.json), `169f1d9`(PM, block v1→v2), `369ec24`(trainer, gitignore화+훅→스킬 이관+회귀 3건 수정).
- 워크트리: `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-a1fba4b8d23d957bf`
- 등급: Sensitive 상당(회사 전체 배포용 신규 프로젝트 스캐폴딩 로직 + 훅 구조 변경) — 풀 패널(5명, 발산형 1명 포함) 투입
- **종합 판정: 🟢 Green — GO.** Critical 없음, Major 없음(1차 라운드 RV-01/02/03 전부 확인 후 정정 완료). 남은 지적은 Minor 1건(신규 발견, `doc-drift.mjs` 콘솔 메시지 모순)과 백로그성 Nit/Rethink뿐이며 배포를 막을 사유가 아니다.

## 이전 리뷰(1차 라운드) 대비 이번 라운드에서 달라진 것

이전 리뷰(`docs/reviewer/review-malgnai-hub-bootstrap-redesign-2026-08-11.md`, 커밋 `66f37ec`)는 `83d94fe`/`db48561` 두 커밋만 대상으로 했고, 그 리뷰 도중 다른 프로세스가 이미 워크트리를 동시편집 중이라는 사실을 발견해 "GO-with-fix는 그 두 커밋 스냅숏에만 유효하다"고 명시적으로 경고했었다. 이번 라운드는 그 경고가 정확했음을 확인한다 — 실제로 그 이후 `795b287`(PM 블록 훅 재제거 설계) → `169f1d9`(block v2) → `369ec24`(구현+회귀수정)가 이어졌다. 이번 리뷰는 이 전체를 `d1d44a1` 대비로 처음부터 재검증했다.

## 페르소나 패널 구성 (5명, 발산형 1명 포함 — 1차 라운드 4명 재사용 + 1명 신규)

| 페르소나 | 파일 | 역할 |
|---|---|---|
| 신규 프로젝트 온보더 | `docs/reviewer/personas/persona-scaffold-new-project-onboarder.md` | 재사용 — 오늘 처음 `new-project.mjs` 실행하는 직원 관점 |
| 기존 5필드 프로젝트 유지보수자 | `docs/reviewer/personas/persona-legacy-5field-project-maintainer.md` | 재사용 — 원복 이전 버전으로 만들어진 프로젝트 관리자 |
| 스펙-구현 정합성 감사관 | `docs/reviewer/personas/persona-spec-implementation-conformance-auditor.md` | 재사용 — 설계문서 조항 대 실제 diff 1:1 대조 |
| STATUS.md 존재당위 도전자 [발산형] | `docs/reviewer/personas/persona-status-md-necessity-challenger.md` | 재사용 — 이번 라운드의 새 구조(훅 완전 제거)까지 반영해 재질문 |
| 온디맨드 PM 블록 재설치 검증관 (신규) | `docs/reviewer/personas/persona-ondemand-pm-block-reinstall-verifier.md` | **신규** — "훅→스킬 온디맨드 이관"이 실제로 동작하는지 5가지 상태를 실행해 검증 |

## RV-01/02/03 재검증 (1차 라운드 지적 — 다른 사람 보고 신뢰하지 않고 diff로 직접 확인)

`git show 369ec24 -- malgn-agent/bin/new-project.mjs malgn-agent/skills/project-standards/SKILL.md`로 직접 대조했다.

| ID | 1차 지적 | 재확인 결과 |
|---|---|---|
| RV-01 | `new-project.mjs:67` STATUS.md 본문에 구 규율("상태가 바뀌면 끝내기 전 갱신")이 남아 CLAUDE.md의 6트리거와 모순 | ✅ **수정 확인.** 현재 `new-project.mjs`(파일 내 STATUS.md 템플릿)는 `"이 파일이 진행 상태의 단일 소스다. 재작성 규율(6가지 트리거로 제한)은 CLAUDE.md 참조 — 평범한 진행 중에는 건드리지 않는다."`로 교체됨. 실제 `--here` 스캐폴딩 실행 결과(아래 실기동 검증)에서도 이 문구가 그대로 생성됨을 확인. |
| RV-02 | `SKILL.md` §3이 "malgnai-hub 대상 한정"이라는 설계문서(§0/§2) 스코프 qualifier 없이 범용 규율로 적힘 | ✅ **수정 확인.** `SKILL.md`에 `"**이 상한/트리거는 malgnai-hub 대상 프로젝트를 우선 목표로 하며, provider: malgnai-mcp 프로젝트(이 저장소 claude-plugins 포함)에는 소급 적용을 강제하지 않는다.**"` 한 줄이 §3 크기 상한 서술 바로 앞에 추가됨(diff로 확인). |
| RV-03 | 기존 5필드 STATUS.md 유지보수자를 위한 안내 부재 | ✅ **수정 확인.** `SKILL.md` §8 말미에 `"기존 5필드 STATUS.md(2026-08-11 원복 이전에 스캐폴딩된 프로젝트)는 그대로 둬도 기능상 문제없다... 억지로 지금 3필드로 정리할 필요는 없다... 급하지 않다."` 문단이 추가됨. |

세 건 모두 1차 리뷰의 정확한 위치·문구를 그대로 겨냥한 최소 수정으로 처리됐다 — 과잉수정도, 회피성 수정도 없었다.

## 신규 메커니즘 검증 (코드 diff + 실기동)

### 1) `find-pm-block-path.mjs` 로직 무손실 이관 여부
`git show 795b287^:malgn-agent/hooks/pm-orchestration-nudge.mjs`(삭제 전 원본, 328줄)와 `malgn-agent/hooks/lib/find-pm-block-path.mjs`(신규, 102줄)를 나란히 대조했다. 6개 export(`findMalgnAgentBlockPath`/`AMBIGUOUS`/`readBlockFile`/`STATE_MARKER_RE`/`BLOCK_VERSION_RE`/`IMPORT_LINE_RE`) 모두 **로직 변경 없이** 이관됐다 — 유일한 차이는 `readBlockFile()`의 상대경로 기준점(원본: 같은 디렉토리 `hooks/`, 신규: 부모 디렉토리 `hooks/lib/` → `..`)뿐이며 이는 파일 위치 이동에 따른 필연적 조정이지 로직 변경이 아니다. `findMalgnAgentBlockPath()`의 마켓플레이스 글롭스캔+`enabledPlugins` 소거+`AMBIGUOUS` 판정 알고리즘은 라인 단위로 동일하다.

### 2) `doc-drift.mjs`의 `checkPmBlockImport()` — 자동 세션 경로와 분리됐는가
- `checkPmBlockImport()`는 named export이지만, 실제 호출은 `doc-drift.mjs` 파일 하단의 `if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])` CLI 블록 **안에서만** 일어난다(`hooks/doc-drift.mjs:108`).
- `git diff d1d44a1 HEAD -- malgn-agent/hooks/sessionstart-context.mjs`가 **빈 결과**임을 직접 확인 — 이 파일은 손대지 않았다는 설계문서 주장이 코드 레벨로 정확하다.
- `sessionstart-context.mjs:29-30`을 직접 읽어 `computeDrift()`만 동적 import해서 쓰는 것을 확인, `checkPmBlockImport`는 이 파일 어디에도 등장하지 않는다.
- 실기동: `node malgn-agent/hooks/doc-drift.mjs .`(이 저장소 루트, doc-drift.json 없음)와, PM 블록 상태가 다른 임시 디렉토리 여러 곳에 대해 CLI를 직접 실행해 exit code/출력을 확인했다(아래 §"실기동 검증" 참고).

### 3) `hooks.json` / `pm-orchestration-nudge.mjs` 삭제 여부
- `cat malgn-agent/hooks/hooks.json` 결과 SessionStart에는 `sessionstart-context.mjs` 하나만 남아있고, Stop에는 `stop-mcp-reminder.cjs`만 있다 — `pm-orchestration-nudge.mjs` 항목 없음.
- `ls malgn-agent/hooks/`로 실제 파일 목록을 확인 — `pm-orchestration-nudge.mjs` 파일 자체가 존재하지 않음(`doc-drift.mjs`, `hooks.json`, `lib/`, `pm-orchestration-block.md`, `sessionstart-context.mjs`, `stop-mcp-reminder.cjs`만 존재).

### 4) `new-project.mjs`의 `loadPmOrchestrationBlockRef()` + `.gitignore` 로직 — 실기동 검증
`/private/tmp/.../scratchpad/test-scaffold2`에서 `node .../bin/new-project.mjs --here`를 실제로 실행했다(설계문서 §4-2 그대로 `import.meta.url` 기반, 글롭스캔 없음을 코드로도 확인):
- 생성된 `CLAUDE.md`에 `<!-- malgn-agent:pm-orchestration:installed:v2 --><br>@<이 워크트리의 pm-orchestration-block.md 절대경로>` 두 줄이 정확히 삽입됨.
- 생성된 `.gitignore`에 `STATUS.md` 한 줄만 추가됨 — `git status --short` 결과 `STATUS.md`가 실제로 추적에서 빠져 있고, `git check-ignore -v STATUS.md`로 `.gitignore:1:STATUS.md` 매치를 재확인함.
- **`.gitignore` 멱등성 검증(2개 케이스)**: ①기존 `.gitignore`가 이미 있고 trailing newline이 없는 상태(`printf 'node_modules'`)에서 스캐폴딩 실행 → 개행이 정확히 삽입되고 `STATUS.md`가 새 줄에 추가됨(파일 오염 없음). ②`--here` 재실행 시 `STATUS.md`가 이미 있으면 line 65-68의 이전 가드("이미 초기화된 프로젝트입니다")가 먼저 발동해 스캐폴딩 로직(파일쓰기+`.gitignore` append) 전체가 실행되지 않음 — 즉 `.gitignore` append 로직 자신의 중복방지 체크(`alreadyIgnored`)는 실제로는 이 이전 가드에 의해 도달 자체가 차단된다. 코드는 방어적으로 멱등하게 작성돼 있으나(문제는 아님), 이 멱등성이 정상 재실행 경로로는 실제로 트리거되지 않는다는 점은 참고로 남긴다(신규 프로젝트 생성 경로도 `existsSync(root)` 가드로 동일하게 재진입이 막힘).

### 5) `check-pm-orchestration-block.mjs` — 파일을 쓰지 않는지 + 실제 5가지 상태 실행
코드 정독으로 `writeFileSync`/`appendFileSync` 등 쓰기 함수가 이 파일 안에 전혀 없음을 확인(import한 `readFileSync`만 사용). 추가로 5가지 상태를 임시 디렉토리에 실제로 만들어 직접 실행했다(이 머신에 실제 malgn-agent 마켓플레이스가 설치돼 있어 진짜 `findMalgnAgentBlockPath()` 스캔 결과로 검증 가능했다):

| 시나리오 | 실행 결과 `status` | 기대값(SKILL.md §9) | 일치 |
|---|---|---|---|
| CLAUDE.md에 마커 없음 | `no-marker` | `no-marker` | ✅ |
| `installed:v1` 마커만, import 줄 없음 | `legacy-no-import` | `legacy-no-import` | ✅ |
| `installed:v2` + import 줄이 이 워크트리 자신의 경로(마켓플레이스 설치 경로와 다름) | `drift` | `drift` | ✅ — 실제로 이 워크트리에서 `--here` 스캐폴딩하면 이 워크트리 자신을 가리키므로, 실제 마켓플레이스 설치 위치(`~/.claude/plugins/marketplaces/malgnsoft-plugins/...`)와 달라 드리프트로 정확히 잡힘(설계 의도대로 동작 — 버그 아님, 오히려 드리프트 감지가 실제로 작동함을 실증) |
| `installed:v2` + import 줄이 실제 마켓플레이스 설치 경로 | `ok` | `ok` | ✅ |
| `declined:v1` (현재 block.md는 v2) | `declined`, `revisedSinceDecline: true` | `declined`(재확인 필요 안내) | ✅ |

5가지 상태 모두 SKILL.md §9가 문서화한 상태값과 정확히 일치했다 — "훅에서 스킬로 바뀐 뒤 실제로 온디맨드 재설치가 잘 동작하는가"라는 이번 라운드의 신규 관점 질문에 **예**로 답할 수 있는 실측 근거를 확보했다.

### 6) `SKILL.md` §9와 설계문서 §4-3 일치 여부
§9 절차 1~5단계(마커 확인 → `no-marker` AskUserQuestion → `legacy-no-import`/`drift` Edit 교정 → `declined`+재요청 시 교체 → `ambiguous`/`plugin-missing` 시 건드리지 않고 알림)가 설계문서 §4-3의 5단계와 그대로 대응한다. `check-pm-orchestration-block.mjs`가 반환하는 `nextAction` 필드의 문구도 이 절차를 그대로 반복하도록 작성돼 있어, 세션이 스크립트 출력만 읽고도 §9 절차를 그대로 따라갈 수 있다.

## `pm-orchestration-block.md` v1→v2 변경 판단

`git diff 169f1d9^ 169f1d9`로 직접 확인: 추가된 한 줄은 `"판단이 갈리는 중요한 결정(설계 방향·기술 선택 등)은 단독판단 대신 관련 에이전트의 다각 평가와 합의를 거친 뒤 결정한다."`

- **내용 적합성**: 기존 두 문단(①Standard 이상 위임 원칙 ②5등급 판정+WBS+실물대조 검증)과 마찬가지로 "PM이 혼자 결정하지 말라"는 동일 계열의 행동 규율이다. 순서상 ①(위임)→②(검증)→③(신규, 다각평가) 흐름도 자연스럽다 — 위임한 뒤 검증하고, 그중 중요한 결정은 합의까지 거치라는 단계적 확장으로 읽힌다. 뜬금없이 붙은 이질적 문장이 아니다.
- **버전 마커 갱신 규칙 부합 여부**: 파일 1번째 줄의 규칙("의무 내용이 바뀔 때만 값을 올린다. 문구 다듬기·오타 수정은 값을 유지한다")과 대조하면, 이 추가는 이전에 없던 새 행동 요구사항(다각 평가·합의)을 신설하는 것이므로 "의무 내용이 바뀜"에 해당한다 — v1→v2 상향은 타당하다.
- **상단 주석 정합성**: `git show 795b287`에서 이미 상단 안내 주석(1~2번째 줄)이 "이 파일은 더 이상 매 세션 훅이 읽지 않는다 — ①스캐폴딩 1회 ②온디맨드 스킬, 두 경로로만 참조된다"로 갱신돼 있음을 확인 — v2 버전업이 실제로 "스캐폴딩 시점에 반영되는 버전"이라는 문맥과 맞다(설계문서 §4-2: `pmBlock.version`을 읽어 `installed:v${pmBlock.version}` 마커를 찍음 — 실기동 테스트에서도 `v2`가 정확히 찍힘을 확인).

결론: v1→v2 변경은 문면·규칙 양쪽에서 타당하다. 지적 없음.

## 지적 사항 (통합, 이번 라운드 신규 발견분)

| ID | 심각도 | 위치 | 지적 | 담당 페르소나 |
|---|---|---|---|---|
| RV2-01 | 🟡 Minor | `malgn-agent/hooks/doc-drift.mjs:113-117` | `doc-drift.json` 매니페스트가 있지만 `checks` 배열이 비어있는 프로젝트(예: 방금 스캐폴딩된 신규 프로젝트, `new-project.mjs`가 만드는 기본값이 정확히 이 상태다)에서 `pnpm run check-docs`를 실행하면, PM 블록에 `drift`/`legacy-no-import` 등 실제 경고가 있어도 콘솔에 `"⚠️ PM 행동규율 @import: ..."` 경고 줄 **바로 다음**에 `"✅ 문서가 코드와 일치."`가 함께 출력된다. `hasDrift`(=`r.drift.length`, doc-drift.json 항목 기준)와 `hasPmIssue`(=PM 블록 상태)가 서로 다른 신호인데, "일치" 메시지 조건(`if (!hasDrift && r)`)이 `hasPmIssue`를 고려하지 않기 때문이다. 실측: 임시 디렉토리에 `checks: []`인 `doc-drift.json`+drift 상태의 PM 블록을 만들어 `node hooks/doc-drift.mjs .`를 실행한 결과, `⚠️ PM 행동규율 @import: import 경로(...) != 현재 설치 경로(...)` 다음 줄에 `✅ 문서가 코드와 일치.`가 그대로 출력됨을 확인. **exit code는 정확히 1**이라 CI/자동화는 영향받지 않지만, 사람이 눈으로 읽을 때 경고 직후 "일치" 문구가 나와 혼란을 줄 수 있다. | 온디맨드 PM 블록 재설치 검증관 |
| RV2-02 | 🟡 Minor (1차 RV-04 재확인, 미해결 유지) | `malgn-agent/knowledge/common/project-folder-structure.md:26`, `knowledge/common/project-management.md:10` | 여전히 "완료 섹션 5~7개"로 서술 — `SKILL.md`(정본, §3)는 이미 3~5개로 갱신됨. 이번 라운드도 knowledge/는 설계문서 스코프 밖(§6에 명시 없음)이라 손대지 않았다 — 회귀는 아니고 기존에 이미 열려있던 드리프트가 그대로 남은 것. | 스펙-구현 정합성 감사관 |
| RV2-03 | ⚪ Nit (1차 RV-06 재확인, 미해결 유지) | `malgn-agent/agents/pm.md:70` | "Micro 등급: STATUS.md 1줄 갱신"이 6트리거와 정확히 겹치는지는 설계문서 §7이 스스로 "trainer가 개정 시 한 번 훑어볼 것을 권고"로 미확정 남겼고, 이번 trainer 구현도 손대지 않았다 — 설계문서가 허용한 범위 내 판단이므로 위반 아님, 백로그로만 재확인. | 스펙-구현 정합성 감사관 |

**1차 라운드 RV-05(원문자 기호 중복)**: `new-project.mjs:93~97`(1차 지적 당시 라인 번호)에 해당하는 CLAUDE.md 템플릿을 다시 확인 — 현재도 "6가지 트리거"(①~⑥)와 "필수 규율"(①②) 두 목록이 각자 원문자를 재사용하는 구조가 그대로다(`bin/new-project.mjs:119-123`). Nit이라 이번 라운드도 굳이 고치지 않은 것으로 판단되며, 여전히 유효한 초경미 지적으로만 재확인해 둔다.

## 🔵 Rethink (발산형 — STATUS.md 존재당위 도전자, 이번 라운드 갱신)

| 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|
| 이번 라운드는 **PM 블록 쪽 중복 주입 문제를 "역할 분리"가 아니라 "자동 주입 자체를 제거"하는 방식으로 근본 해결했다**(SessionStart 훅 삭제, 스캐폴딩 1회+온디맨드로 대체) — 1차 라운드에서 이 페르소나가 제안했던 "역할 분리"보다 더 급진적이고 실제로 중복 자체를 없앴다. 반면 **STATUS.md 쪽 중복 주입 문제(전역 개인 훅 `~/.claude/hooks/session-context.mjs` + 플러그인 훅 `sessionstart-context.mjs`가 각자 STATUS.md를 주입)는 이번 라운드에서 전혀 손대지 않았다** — 설계문서 §0이 스스로 "이 문제 자체는 이번 원복 이후에도 사라지지 않는다"고 인정한 그대로다. | PM 블록에 적용한 것과 **동일한 패턴**(자동 상시주입 제거 → 1회성 배선+온디맨드 재확인)을 STATUS.md 쪽에도 적용할 수 있는지 재검토할 가치가 있다: 예컨대 플러그인 훅(`sessionstart-context.mjs`)이 CLAUDE.md에 STATUS.md 내용이 이미 `@import`류로 로드돼 있는지 판별해, 로드돼 있으면 중복 주입을 건너뛰는 가드를 추가하는 안. (STATUS.md는 세션마다 값이 달라지므로 PM 블록처럼 "1회성 정적 배선"으로 완전히 대체할 수는 없다 — 최소한 "이미 같은 내용이 이번 세션에 다른 경로로 들어왔는지"를 감지하는 가드만이라도 검토 대상.) | 이번 라운드가 PM 블록에서 입증한 것 — "겹쳐도 감당 가능한 크기로 줄인다"(1000토큰 상한, §2)보다 "애초에 안 겹치게 만든다"(훅 제거)가 더 근본적인 해법이라는 것 — 을 STATUS.md에는 아직 적용하지 않은 비대칭이 존재한다. 1000토큰 상한은 강제 수단이 없다(§9 스스로 인정)는 점에서, 이 저장소 자신이 압축 규율을 지키고도 1,844토큰까지 불어난 전례가 새 프로젝트에도 재발할 개연성이 낮지 않다. | 이 저장소 자신의 STATUS.md 중복 주입 원천(전역 개인 훅)은 malgn-agent 플러그인 배포 범위 밖(사용자 개인 `~/.claude/hooks/`)이라 플러그인 쪽에서 통제할 수 있는 건 "우리 쪽 주입을 건너뛰는 가드" 뿐이다 — 가드를 걸려면 "이미 다른 경로로 주입됐는지"를 훅이 판별할 근거(마커/신호)가 STATUS.md 쪽에는 아직 없다(PM 블록의 `@import` 마커에 해당하는 게 없음). 이 설계 자체가 이번 리뷰 범위에서 새로 만들 수 있는 건 아니고, 후속 검토 항목으로만 남긴다. |

## 페르소나별 관점 요약

- **신규 프로젝트 온보더**: `--here` 실기동 결과 STATUS.md/CLAUDE.md 두 파일이 이제 같은 6트리거 규율을 말한다(RV-01 수정 확인) — 1차 라운드에서 지적했던 "첫날부터 두 파일이 다른 소리를 하는" 문제는 사라졌다. 콘솔 안내문도 6단계로 늘어 gitignore/PM 블록 승인까지 순서대로 안내한다.
- **기존 5필드 프로젝트 유지보수자**: RV-03 수정으로 "그대로 둬도 되는가"에 대한 불확실성이 해소됐다. RV-02 수정으로 새 규율의 적용 범위(malgnai-hub 우선, malgnai-mcp 소급강제 없음)도 문면에 명시됐다 — 1차 라운드에서 지적한 두 Major가 모두 해소돼 이번 라운드는 지적할 게 없다.
- **스펙-구현 정합성 감사관**: `git diff d1d44a1 HEAD -- malgn-agent/hooks/sessionstart-context.mjs`가 실제로 빈 결과임을 재확인 — "STATUS.md용 훅은 안 건드림" 주장이 두 라운드 누적 diff로도 정확하다. `find-pm-block-path.mjs`가 원본 6개 export를 로직 손실 없이 이관했음을 직접 라인 대조로 확인. `check-pm-orchestration-block.mjs`가 파일을 쓰지 않는 불변식도 코드 정독으로 재확인. RV2-01(콘솔 메시지 모순)만 이번 라운드 신규 발견.
- **온디맨드 PM 블록 재설치 검증관 [신규]**: 5가지 상태(no-marker/legacy-no-import/drift/ok/declined)를 실제 파일시스템에 만들어 직접 실행한 결과 전부 SKILL.md §9 문서화 상태값과 일치했다 — "훅→스킬 전환 후 실제로 동작하는가"에 실측 근거로 답했다. 이 과정에서 doc-drift.mjs의 콘솔 메시지 모순(RV2-01)을 발견했다.
- **STATUS.md 존재당위 도전자 [발산형]**: 위 Rethink 표 참조 — 이번 라운드가 PM 블록에 적용한 "중복 자체를 없앤다"는 해법 패턴이 STATUS.md 자신에는 아직 비대칭적으로 적용되지 않았다는 점을 재질문했다. 배포를 막을 사유는 아니다(1000토큰 상한이라는 완화책은 이미 있다).

## 트레이드오프

- RV2-01은 exit code가 정확해 자동화(CI)에는 영향이 없다 — "사람이 콘솔을 눈으로 읽을 때"만 문제되는 메시지 순서 이슈다. 이번 배포를 막을 이유는 아니지만, 다음에 `doc-drift.mjs`를 만질 때 `hasPmIssue`도 "일치" 메시지 조건에 포함시키는 1줄 수정으로 쉽게 없앨 수 있다.
- 발산형 Rethink(STATUS.md 쪽에도 "중복 제거" 패턴 적용)는 이번 결정의 실패가 아니라 "이번에 PM 블록에서 입증된 더 나은 해법을 아직 STATUS.md에는 적용하지 않았다"는 비대칭 지적이다 — 즉시 착수를 요구하는 지적이 아니라, PM 블록 전환이 실제로 잘 동작한다는 것이 이번 라운드로 입증된 지금, STATUS.md 쪽도 같은 패턴을 재검토할 근거가 하나 더 생겼다는 취지다.

## 잘 된 점

- **1차 라운드 Major 3건(RV-01/02/03) 전부 정확한 위치에 최소 수정으로 해소** — diff로 직접 확인, 구두 보고를 신뢰하지 않고 재검증한 결과 실제로 고쳐져 있었다.
- **로직 이관 무손실** — `find-pm-block-path.mjs`가 원본 328줄 파일의 핵심 6개 export를 라인 단위로 동일하게 옮겼다. 리팩터링 중 흔한 실수(로직 미묘하게 변경, 일부 분기 누락)가 없었다.
- **"훅은 파일을 쓰지 않는다" 불변식이 새 스크립트에도 그대로 계승** — `check-pm-orchestration-block.mjs`를 코드 레벨로 확인, 쓰기 함수가 전혀 없다.
- **자동/수동 경로 분리가 실제로 구조적으로 보장됨** — `checkPmBlockImport()`가 `sessionstart-context.mjs`(매 세션)와 물리적으로 분리된 CLI 블록에서만 호출되는 것을 diff+코드 정독 양쪽으로 확인. "설계 의도"가 아니라 "코드 구조 자체"가 이를 강제한다.
- **실기동 테스트 전 구간 통과** — `node --check` 5개 스크립트 전부 통과, `new-project.mjs --here` 실제 실행 성공(파일 생성/gitignore/PM 블록 삽입 모두 정상), `check-pm-orchestration-block.mjs` 5가지 상태 실행 결과 전부 문서와 일치, `doc-drift.mjs` CLI 실행 결과 exit code 정확.
- **드리프트 감지가 "우연히 통과"가 아니라 실제로 작동함을 실증** — 이 워크트리에서 `--here`로 스캐폴딩하면 워크트리 자신을 가리키는 경로가 삽입되고, 이는 실제 마켓플레이스 설치 경로와 다르므로 `drift`로 정확히 잡혔다. 이는 설계가 원래 의도한 "경로가 어긋나면 감지하라"는 요구사항이 실제 데이터로 검증된 사례다.
- **v1→v2 버전 마커 갱신이 자체 규칙에 맞게 처리됨** — 의무 내용 변경(다각 평가 원칙 신설)에만 버전을 올리는 규칙을 정확히 따랐고, 상단 참조 경로 안내 주석과도 내용상 정합적이다.

## 생략한 부분 (정직 명시)

- 실제 malgnai-hub MCP 서버(`project_bootstrap`/`project_get_context` 등)에 대한 실기동 검증은 이번 라운드도 하지 않았다(malgnai-hub 도구가 이 세션에 연결돼 있지 않음, 설계문서 §9와 동일한 제약 — 1차 라운드와 동일하게 재확인).
- `findMalgnAgentBlockPath()`의 `AMBIGUOUS` 분기(마켓플레이스 2개 이상에 동시에 malgn-agent가 설치된 경우)는 이 머신에 실제로 그런 상태를 만들지 않아 5가지 상태 실측에는 포함했지만 `ambiguous`/`plugin-missing` 두 상태는 코드 정독으로만 확인했고 실제 실행 재현은 하지 않았다(마켓플레이스 디렉토리를 임의 조작하는 것은 이 머신의 실제 설치를 건드릴 위험이 있어 보수적으로 생략함).
- UI/화면 리뷰가 아니므로 스크린샷 캡처는 수행하지 않았다(대상이 텍스트 문서·스크립트이므로 해당 없음).
- knowledge/ 문서 3건(RV2-02 관련)의 "5~7개" 잔존 서술을 이번 라운드에도 고치지 않았다 — 설계문서 스코프 밖이라는 판단은 1차 라운드와 동일하게 유지했다(직접 수정은 reviewer 역할 밖이기도 함).

## 실행 액션 여부

- 이번 리뷰에서 코드/문서를 수정하지 않았다. `/private/tmp/.../scratchpad/` 아래 임시 디렉토리에서 `new-project.mjs --here` 등을 실행한 것은 검증 목적의 임시 산출물이며, 이 워크트리(malgn-agent 소스) 안의 어떤 파일도 변경하지 않았다.
- 승격·배포·병합 등 실행 액션은 수행하지 않았다(reviewer 역할 경계 — 검증만).
- 이 보고서와 신규 페르소나 1개(`persona-ondemand-pm-block-reinstall-verifier.md`)는 이 워크트리(`agent-a1fba4b8d23d957bf`)에 커밋했다. push는 하지 않았다.

## PM 권고

1. **GO** — Critical/Major 없음. 1차 라운드 Major 3건 전부 해소 확인, 신규 메커니즘(훅→lib+스킬 이관) 실기동 검증 통과. 병합·버전업 진행 가능.
2. RV2-01(Minor, `doc-drift.mjs` 콘솔 메시지 모순)은 배포를 막을 사유가 아니나, 다음에 이 파일을 만질 기회에 `hasPmIssue`를 "일치" 메시지 조건에 포함시키는 1줄 수정을 권고(예: `if (!hasDrift && !hasPmIssue && r) console.log(...)`).
3. RV2-02(knowledge/ 5~7개 잔존)·RV2-03(pm.md Micro 등급 문구)은 급하지 않은 백로그로 계속 이월 — 다음 knowledge/pm.md 정리 세션에서 함께 처리 권고.
4. 발산형 Rethink(STATUS.md에도 "중복 제거" 패턴 적용)는 이번 배포를 막을 사유는 아니지만, PM 블록 전환이 실제로 잘 동작함이 이번 라운드로 입증됐으므로 별도 세션에서 STATUS.md 쪽에도 같은 패턴 적용 가능성을 검토할 가치가 있다 — 단, 전역 개인 훅(`~/.claude/hooks/session-context.mjs`)은 이 플러그인 배포 범위 밖이라는 제약을 먼저 재확인해야 한다.
