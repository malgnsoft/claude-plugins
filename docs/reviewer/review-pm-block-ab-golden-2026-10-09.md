# 리뷰: PM block A/B 골든 테스트 (rubric 동결 전 검토)

- target_id: `pm-block-ab-golden-20261009` (최초 리뷰 — 재검토 3요소 없음)
- 대상: 브랜치 `worktree-agent-ad0b238a195369fe6` 커밋 `5c58073` (베이스 `8008bdb`), 33파일 +1351
  - `scripts/run-pm-block-ab.mjs`(773줄) · `scripts/verify-pm-block-ab.mjs`(189줄) · `scripts/pm-block-ab-samples/*.ndjson`(14) · `docs/evaluation/golden-task/pm-block-ab/{cases/*.json(6), fixture/(9), rubric.md}` · `package.json`(+2)
- 등급: Standard(저장소 전용 도구, 배포 트리 아님). 읽기 전용 리뷰 — 유료 `claude` 실행 없음, 코드 수정·커밋·병합 없음.
- 실행한 것(비용 0): `node scripts/verify-pm-block-ab.mjs` → 통과 120 / 실패 0. 분류기·grader에 경계 입력을 직접 넣어 재현(아래 RV-001). `git diff 8008bdb hold/v1.8.50`로 훅·스킬 차이 확인. 판정자 격리 플래그는 로컬 공식문서 미러(`docs/anthropic/`)로만 대조(미러에 cli-reference가 없어 `--tools ""`·`--disable-slash-commands`는 확인 불가).

## 종합 판정: 🔴 Red — rubric 동결 전에 고쳐야 할 것이 있다

Critical 2건. 둘 다 "결과를 보고 나서 고치면 비교가 무효"라는 이 rubric 자신의 규칙(rubric.md:3) 때문에 **동결 전에** 손봐야 한다.
1. 무해한 읽기 명령(`grep -E "a|b"`)이 "메인이 직접 수정"으로 분류돼 실행이 즉시 종료되고, 그 오분류가 **변형을 가르는 유일한 시나리오(③)에서 A에 PASS, B에 FAIL**을 준다(재현함).
2. ③이 각 변형을 자기 훅 규칙으로만 채점해, 실험이 "어느 규칙이 사용자에게 더 나은가"가 아니라 "모델이 주입된 문구를 따르는가"만 잰다. 훅과 무관한 공통 결과 기준이 없다.

## 페르소나 재사용 판정 (착수 전 `docs/reviewer/personas/INDEX.md` 역할개념 열 전 행 스크리닝)

| 페르소나 | 재사용/신규 | 사유 |
|---|---|---|
| `persona-skeptical-verification-architect.md` | 재사용 | "동등성을 주장하려면 측정 실험부터 설계하라" + 자기 증거의 확증편향 경계 — 순환 채점·n=2·사전 결정규칙 문제와 같은 역할개념 |
| `persona-script-skill-consistency-auditor.md` | 재사용 | rubric(약속) ↔ 러너 코드(구현) 줄 대조 — 분류 목록 드리프트·판정자 규칙 구현 확인 |
| `persona-token-attribution-accuracy-auditor.md` | 재사용 | "실제 로그 구조(sidechain·동시 다중 tool_use)에서도 산수가 깨지지 않는가" — stream-json 증분 파싱·kill 시점 오분류 |
| `persona-zero-based-redesigner.md` | 재사용(발산형 슬롯) | 측정 구조 자체(첫 행동에서 kill)가 이 질문에 맞는 도구인가 |

신규 0건. 실험설계 타당성 전용 페르소나를 새로 만들지 않은 근거: 회의적 검증 설계자의 평가기준([필수] 표본 크기 명시, [권장] 확증편향 경계)이 이번 리스크 표면을 그대로 덮는다.

## 지적 사항

| ID | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안(요구 상태) |
|---|---|---|---|---|---|---|
| RV-001 | 🔴 Critical | 측정 타당성 | `scripts/run-pm-block-ab.mjs:60-61`, `:99-101`, `:288-290` | 모듈을 import해 직접 실행 | `isReadOnlyBash`가 따옴표를 무시하고 `\|`로 구간을 나눈다. `grep -rnE "btn-primary\|저장" public` → 두 번째 구간 `저장" public`이 읽기성 아님 → `main_edit`로 분류 → **kill**. 재현 결과: 시나리오③ A=`PASS`, B=`FAIL:main_edit_violation`. 시나리오① `grep -nE "회원갑입\|회원가입" README.md` → bash 경로의 편집 확인(`cmd.includes(file) && cmd.includes(oldContains)`)까지 통과해 **PASS**(실제 편집 전). 같은 이유로 `grep "=>"`, `git -C . log`, `echo`, `sort`, `awk`, `jq`, `diff`, `npm test`도 전부 `main_edit`. 이 편향은 "일찍 끊고 main_edit로 적는다" 한 방향이라 ①·③-A의 PASS를 부풀리고 ③-B·②를 FAIL로 만든다 | ①따옴표 안의 `\| ; & < >`는 구간 분리·리다이렉트 판정에서 제외 ②Bash는 **쓰기 신호가 확인될 때만** `main_edit`(리다이렉트·`sed -i`·`tee`·`rm/mv/cp/mkdir/touch`·`git commit/checkout/switch/branch <name>/worktree add`·패키지 설치 등), 판단 불가는 `bash_unknown`으로 기록하고 kill하지 않거나 해당 실행을 `needs_human` 처리 ③①의 bash 편집 확인은 "명령이 파일을 실제로 바꾸는가"(sed -i/리다이렉트)까지 요구 ④위 반례들을 `verify-pm-block-ab.mjs`에 추가 |
| RV-002 | 🔴 Critical | 실험설계(순환 채점) | `rubric.md:35`, `cases/03-button-style.json` `expect.A/B`, `rubric.md:33-37` | 훅 diff(`8008bdb..hold/v1.8.50 hooks/pm-orchestration-block.md`)와 기대값 대조 | 변형 간 기대가 다른 시나리오는 ③ 하나뿐이고, ③은 A를 A 훅 문구로, B를 B 훅 문구로 채점한다. 두 변형이 각자 규칙을 지키면 둘 다 PASS — 결과가 "B가 더 낫다/못하다"를 말할 수 없다. 게다가 A의 기대 자체가 논쟁적이다: A 훅은 "Micro(오탈자·단순조회·**1줄 수정**)만 직접"인데 ③은 2개 속성(배경색·radius) 변경이라 A 훅 문면상 위임이 맞을 수도 있고, rubric은 등급표의 "CSS·단일파일=Micro"를 골라 main_edit를 PASS로 정했다. ①②④⑤는 양쪽 기대가 같아 회귀 검사일 뿐 우열 정보를 주지 않는다 | **훅과 무관한 사용자 결과 기준**을 동결 전에 추가: (가) 결과 정확성 — ③을 끝까지 실행(편집 허용 권한, 예산 상한)하고 픽스처 diff로 결정적 판정: `public/css/app.css`의 `.btn-primary`만 변경, background가 더 밝아짐, `border-radius` 증가, `.btn-secondary`·`index.html` 무변경 (나) 완료까지 벽시계 시간·비용(위임 과잉의 사용자 비용) (다) 사용자에게 되물은 횟수 (라) 다른 파일 오염. 판정은 이 공통 기준으로 하고, "자기 규칙 준수율"은 보조 지표로 내린다 |
| RV-003 | 🟠 Major | 시나리오 대표성 | `cases/01`·`02`·`04`·`05` | 각 케이스 기대값 vs B 훅의 ①②③ 허용 목록 대조 | B의 핵심 변화(직접 처리를 "읽기 1~2회·오탈자 1줄·기록"으로 좁힘)가 **사용자 비용을 늘릴 수 있는 지점**을 건드리는 시나리오가 없다. ①은 오탈자(B ② 허용), ②는 "사용자가 지목한 파일 하나"(B ① 허용)라 양쪽 다 직접 처리가 기대 — B의 제한이 발동하지 않는다 | 변별 시나리오 추가: (a) 파일 미지정·읽기 3회 이상 필요한 단순 조회("할인 규칙 어디서 정해? 주문 API는 몇 개야?") — A는 직접, B는 Explore 위임 예상 → 공통 기준(시간·정확성)으로 비교 (b) 오탈자가 아닌 문서 소수정("README 시작하기에 `pnpm test` 한 줄 추가") — A 직접, B general-purpose 예상. 비용이 문제면 ①②보다 이쪽이 정보량이 크다 |
| RV-004 | 🟠 Major | 측정 타당성 | `run-pm-block-ab.mjs:261-304`(gradeRun), `:267-274`, `:514` | 코드 경로 추적 | `gradeRun`이 프로세스 상태(timeout·비정상 종료·예산 초과·`result.is_error`)를 보지 않는다. 결과: ②는 timeout/API 오류/예산 소진으로 답 없이 끝나도 Agent·변경 0이면 **PASS**(`:273`), 나머지 시나리오는 같은 상황이 `FAIL:no_action`. 인프라 실패가 행동 판정으로 섞인다 | `killedBy==='timeout'`·`exitCode≠0 && killedBy==null`·`result.is_error`·`result.subtype`이 예산 초과면 판정을 `INCONCLUSIVE`(또는 `excluded`)로 두고 집계에서 뺀다. ②의 PASS는 "답변 텍스트가 실제로 있음"을 추가 조건으로 |
| RV-005 | 🟠 Major | 판정자 격리 | `run-pm-block-ab.mjs:555-559` | 코드 확인 + `docs/anthropic/plugins/plugins-reference.md:616`(setting-sources는 user만 뺄 수 있고 managed·`--settings`는 남음) | 주석이 스스로 "미검증"이라 적은 격리(`--tools "" --setting-sources project`)를 **어디서도 실행으로 확인하지 않는다**. 판정자 스트림도 `StreamAnalyzer`로 파싱하면서 `hookResponses.length===0`·`init.tools` 비어 있음을 검사하지 않고, `--preflight`는 판정자 호출을 전혀 거치지 않는다(`:650-695`). `--tools ""` 인자가 CLI에서 거부되면 본 실행의 판정자 전부가 파싱 실패 → 전건 `needs_human`(비용만 소모). managed settings로 켜진 플러그인 훅은 이 플래그로 못 막는다 | ①판정자 호출 결과에 `hookSessionStartCount`·`initTools`를 기록하고 0/빈 배열이 아니면 그 판정을 `contaminated`로 무효 ②`--preflight`에 판정자 1회(고정 지시서)를 포함해 격리·모델 별칭(`fable`)·JSON 출력이 실제로 되는지 확인 |
| RV-006 | 🟠 Major | 실험설계 | `rubric.md:61-67` | rubric 전문 확인 | 결과→결정 매핑이 사전 등록돼 있지 않다. "2/2 대 0/2가 아니면 결론 없음"은 어떤 결과를 내면 v1.8.50을 배포/보류하는지 말하지 않는다. n=2는 회귀율 50% 미만을 사실상 검출 못 하는데(양쪽 2/2 PASS여도 실제 실패율 30%와 구분 불가) 그 한계가 결론 문구에 반영돼 있지 않다 | 동결 전에 결정 규칙을 적는다(예: "①②④⑤ 중 B만 FAIL이 1건이라도 나오면 그 시나리오를 n=5로 재실행 후 판단", "공통 결과 기준에서 B가 열세가 아니면 배포 후보 유지"). "검출 가능한 최소 차이" 한 줄을 명시 |
| RV-007 | 🟡 Minor | 판정자 규칙 | `run-pm-block-ab.mjs:325-332`, `rubric.md:57` | 코드 + 단위 테스트 `verify:143`("INVALID는 needs_human 판단에서 제외") | (a)나 (c)가 `INVALID`(인용 조작)면 `needs_human`이 **false**로 남는다. 판정자가 근거를 지어낸 실행이 사람 검토에서 빠지는 방향 | (a)·(c) 중 하나라도 `INVALID`면 `needs_human=true` |
| RV-008 | 🟡 Minor | 판정자 규칙 | `run-pm-block-ab.mjs:307-312`, `:544` | 코드 확인 | 인용 검증이 "부분문자열이면 유효"뿐이라 `"버튼"` 한 단어도 통과한다. 게다가 프롬프트가 FAIL일 때 "가장 가까운 문장을 인용하라"고 시켜 FAIL 인용은 근거 확인 기능이 없다 | 인용 최소 길이(예: 8자) + FAIL 판정은 인용 대신 "없는 요소"를 적게 하고 인용 검증 대상에서 분리 |
| RV-009 | 🟡 Minor | 결정적 regex | `cases/04-orders-count-api.json` `brief.constraint.regex`, `cases/05` `brief.all[0]` | 정규식 직접 실행 | ④ 극성 정규식: `"새 테스트를 추가하고, 기존 엔드포인트는 수정하지 말 것"`→ **true**(극성 반대인데 통과), `"tests/orders.test.mjs는 수정하지 마세요"`·`"기존 테스트는 손대지 말 것"`·영문 지시서 → false. ⑤의 `"5"`는 숫자 5가 들어간 어떤 문자열에도 맞는다. regexPass는 판정을 바꾸지 않지만 `needs_human` 트리거라 오탐·미탐이 그대로 사람 검토량이 된다 | ④는 `tests?/`·`손대지`·영문 부정형 포함, "테스트"와 부정어 사이에 다른 목적어가 끼면 불통과. ⑤는 `5\s*(번|회)` |
| RV-010 | 🟡 Minor | 결과 위생 | `run-pm-block-ab.mjs:31`, `:728`, `:757-763`, `.gitignore` | 코드 + `.gitignore` 확인 | ①`results.jsonl`이 `runs/`(gitignore) 밖에 있어 실행 후 추적 대상 파일로 남는다 — 커밋할지 정책 미정 ②`runId`(`A-04-r1`)가 실행 묶음 간에 겹치는데 append 전용 파일에 묶음 id 필드가 없다(타임스탬프는 transcript 경로에만) ③SessionStart 훅 수가 2가 아니면 중단하지만 **그 오염된 행은 이미 append된 뒤**이고 `excluded` 표시가 없다(`:757` 다음 `:760`) | ①`runs/` 아래로 옮기거나 "요약만 커밋" 정책을 rubric에 명시 ②행에 `batchId`(runsDir 이름) ③훅 수 검사를 append 전으로 옮기고 위반 행은 `excluded` |
| RV-011 | 🟡 Minor | 묶음 교란 방어 | `rubric.md:9`, `run-pm-block-ab.mjs:149`, `:497` | `git diff 8008bdb hold/v1.8.50 -- malgn-agent`, `~/.claude/settings.json` 확인 | ①kill 전에 메인이 `Skill`로 연 스킬(B에서 본문이 바뀐 `common-task-grading-and-verification-depth`·`project-orchestration`)이 행에 기록되지 않아, 차이가 나도 "훅 때문인가 스킬 본문 때문인가"를 가를 데이터가 없다 ②`init.plugins`를 수집만 하고 검사하지 않는다 — 이 PC는 `enabledPlugins`에 설치본 `malgn-agent`가 켜져 있다. 훅이 4건이면 중단되지만, 설치본이 `--plugin-dir` 사본을 가리는 경우 A는 마커가 같아 구분이 안 된다(가림 동작은 공식문서 미러에서 확인 못 함 — 확인 필요) ③피험 세션은 `--setting-sources`를 안 써 실행자 개인 설정·다른 플러그인이 양쪽에 똑같이 섞인다(편향은 아니지만 "직원 기본 환경" 대표성은 아님) | ①`skillsBeforeDecisive` 필드 ②preflight에서 `init.plugins`의 malgn-agent 경로 == 변형 pluginDir 확인 ③피험 세션에도 `--setting-sources project`를 쓰고 preflight로 훅 2건 확인 |
| RV-012 | 🟡 Minor | 해석 규칙 | `rubric.md:64` | rubric + B 훅 "맡길 곳" 대조 | "④에서 차이가 나면 노이즈 의심" — 첫 행동에는 맞지만, B는 지시서에 "대화 맥락" 싣기를 새로 요구하므로 ④의 **지시서 품질** 차이는 실제 B 효과일 수 있다 | 노이즈 규칙을 "첫 행동 분포"로 한정한다고 명시 |
| RV-013 | 🟡 Minor | 측정 타당성 | `run-pm-block-ab.mjs:303`, `cases/05` | 코드 확인 | 확인 질문만 하고 끝난 실행(⑤처럼 "관리자 해제 방식은?"이 타당할 수 있음)이 `FAIL:no_action`. 헤드리스라 `AskUserQuestion`이 못 쓰이면 텍스트 질문으로 끝나는데 이것이 과소 라우팅과 같은 FAIL로 집계된다 | `no_action`을 `asked_clarification`(최종 텍스트가 질문으로 끝남)과 분리해 따로 보고 |
| RV-014 | ⚪ Nit | rubric↔코드 정합 | `rubric.md:14` vs `run-pm-block-ab.mjs:44-45,54-55,68` | 줄 대조 | 코드가 rubric 목록에 없는 `stat/file/tree/sed(-i 없음)/ls-files/blame/describe`, `MultiEdit`, `Task`를 추가로 다룬다. 동결 문서와 구현이 다르면 사후 해석 시 어느 쪽이 기준인지 갈린다 | rubric을 코드에 맞추거나 코드를 rubric으로 줄인다(동결 전) |
| RV-015 | ⚪ Nit | 정리 | `run-pm-block-ab.mjs:706-708`, `:725`, `:765` | 코드 확인 | 예외(`:708` 마커 throw 등)·Ctrl-C 시 `tmpRoot`·작업폴더가 남는다(try/finally·SIGINT 처리 없음) | try/finally로 정리 |
| RV-016 | ⚪ Nit | 프롬프트 말투 | `cases/02`·`04`·`05` | 프롬프트 원문 | ③①은 비개발 직원 말투지만 ④(`GET /orders/count`, `{"count": 숫자}`)·②(`price.js 파일에 있는 calcPrice 함수`)·⑤(`users 테이블에 필요한 칸`)는 개발자 말투다. 측정 대상(라우팅)에는 큰 영향 없음 | 의도라면 rubric에 "말투는 통제하지 않음" 한 줄 |
| RV-017 | ⚪ Nit | 판정 결함(경계) | `run-pm-block-ab.mjs:515-526`, `:180-183` | 코드 경로 추적 | kill 후에도 같은 data 청크의 뒷줄을 계속 feed한다. ⑥에서 첫 행동이 `EnterWorktree`(PASS)여도 같은 청크 뒤에 `git checkout -b`가 있으면 `isolation_bypass`로 뒤집힌다(⑥은 참고 관측이라 영향 작음) | `killedBy`가 정해지면 feed 중단 |

### 🔵 Rethink (발산형 — 측정 구조 자체)

- **RT-01 "첫 행동에서 kill"은 우열 판단에 맞는 도구가 아니다.** 첫 행동은 의도를 싸게 재지만 사용자가 받는 결과(정확성·시간)를 못 잰다. 대안: 판정 시나리오 ①③(+RV-003의 신규 2개)는 **끝까지 실행**하고 작업폴더 diff + 벽시계 시간 + 비용을 공통 기준으로, ④⑤는 지금처럼 첫 행동 kill(위임 경로 회귀 검사용). 비용은 늘지만(③ 1회 약 $0.5~1, 미실측 추정) 정보가 생기는 곳에만 쓴다. 덤으로 ④ 픽스처에는 결과 품질 함정이 이미 들어 있다 — `orders.mjs`에서 `/orders/:id`가 먼저 등록돼 있어 `/orders/count`를 뒤에 붙이면 `:id`가 먼저 잡힐 수 있다(Hono의 등록 순서 우선 — 실행 미확인). 끝까지 돌리면 "위임 경로가 실제로 더 나은 결과를 냈는가"를 이 함정으로 결정적 판정할 수 있다.
- **RT-02 훅 단독 효과가 필요하면 세 번째 변형 A'(= A 트리 + B 훅 파일 1개 교체)를 추가한다.** `prepareVariants` 뒤에 파일 하나 복사하면 되는 저비용 변경이다. 반대로 "v1.8.50을 낼지"가 질문이면 지금의 묶음 비교가 맞는 결정 단위다 — 트레이드오프이므로 rubric에 어느 질문을 답하는지 한 줄로 정한다(지금은 "단정하지 않는다"까지만 있음).

## 트레이드오프

- RV-002/RT-01(끝까지 실행) ↔ 비용 가드: 끝까지 실행은 실행당 비용을 수 배로 올린다. 판정 시나리오만 끝까지, 회귀 시나리오는 kill로 나누면 총액 증가를 억제할 수 있다.
- RV-001 ②(판단 불가 Bash를 kill하지 않음) ↔ 비용: kill 지점이 늦어진다. 대신 `bash_unknown` 발생 시 다음 결정적 행동까지 가는 것이 오분류보다 싸다.

## 기각·강등한 지적

| 후보 | 처리 | 사유 |
|---|---|---|
| `MALGNAI_HEADLESS_WORKER=1`이 PM 블록 주입을 끈다 | 기각 | `sessionstart-context.mjs`에 해당 환경변수 분기 없음. Stop 훅에서만 쓰이고 A·B 모두 같은 분기 보유(`git grep -c` A=3) |
| A(8008bdb)가 실제 배포본이 아니다 | 기각 | `origin/main`=`a86c9dc`(v1.8.49), `git diff a86c9dc 8008bdb -- malgn-agent` 비어 있음 — 트리 동일 |
| Skill 호출 뒤 Agent, ToolSearch 뒤 Agent가 오분류된다 | 기각 | Skill·ToolSearch는 읽기로 건너뛰고(`:43`,`:104`) 이후 Agent를 첫 결정적 행동으로 잡는다. 잔여 위험은 preflight가 `initToolsHaveAgent`를 통과 조건에 넣지 않는 것뿐(⚪, 별도 ID 없이 여기 기록) |
| 병렬 tool_use에서 첫 행동이 틀린다 | 기각 | 스트림 순서상 첫 블록을 쓰는 것은 rubric 정의와 일치. 영향은 후속 카운트뿐이며 판정 무관(RV-017 경계 사례만 별도) |
| judge-map 파일명 난수화가 블라인드를 보장한다/깨뜨린다 | 기각(지적 대상 아님) | 판정자는 파일시스템을 못 보므로 파일명은 블라인드와 무관. 실제 누출 경로는 지시서 문면의 변형 흔적(B 훅이 요구하는 "등급"·"재위임하지 말고")인데, 채점 항목이 그 문구를 보상하지 않아 영향 작음 |
| kill 후 `close` 이벤트가 손자 프로세스의 파이프 점유로 영영 안 온다 | 강등(⚪, 미재현) | 가능 경로는 있으나(`:530` close만 대기, kill 뒤 타이머 해제 없음) 재현하지 못했다. 가짜 claude 테스트에서는 정상 종료 |

## 잘 된 점

- 결과 전에 기준을 동결하고, 고치면 새 버전으로 분리한다는 규칙(rubric.md:3)과 `caseSha`에 rubric 해시 포함(`:451`) — 사후 기준 변경을 데이터로 감지할 수 있다.
- "훅 단독이 아니라 묶음 비교"임을 rubric·코드 주석·실행 출력 3곳에 명시(rubric.md:9, `:7`, `:768`), 차이 파일 수 실측(11/22 — 재확인 일치).
- `subagent_type` 정확 일치 + 지시서 인용 헛통과 방지(`s04` 샘플), 서브에이전트 tool_use 제외(`parent_tool_use_id`), message id 기준 usage 중복 제거 — 지난 골든 러너에서 문제됐던 지점들을 단위 검증 120건으로 고정.
- 옵트인 환경변수·`--dry-run`·transcript를 gitignore된 `runs/`에 저장·`history.jsonl`과 분리 — 저장소 규약과 맞는다(예외: RV-010 ①).
- kill된 실행 비용을 `estimated_from_usage`로 구분하고 단가가 가정값임을 코드에 명시(`:38-40`).

## PM 권고

1. **동결 전 필수(Critical)**: RV-001(Bash 분류기)과 RV-002(공통 결과 기준 추가)를 반영한 뒤 rubric을 동결한다. RV-002는 RT-01 형태(판정 시나리오만 끝까지 실행)가 비용 대비 효과가 가장 크다.
2. **같은 라운드 권장(Major)**: RV-003(변별 시나리오 2개), RV-004(인프라 실패 분리), RV-005(판정자 격리를 preflight에서 실증), RV-006(사전 결정 규칙).
3. Minor·Nit는 국소 수정이라 위 반영과 같은 커밋에 묶는 편이 왕복이 적다.
4. 이 리뷰는 실행 액션을 하지 않았다(유료 실행·커밋·병합 없음). 저장한 파일은 이 보고서와 페르소나 4개의 적용 이력, INDEX 재사용 열 갱신뿐이며 모두 미커밋 상태로 리뷰 대상 워크트리에 있다.

## 생략한 것

- 유료 `--preflight`·본 실행: 지시상 금지. 따라서 SessionStart `hook_response` 2건 가정, `--plugin-dir`와 설치본의 가림 동작, 판정자 플래그 동작은 **실행으로 확인하지 않았다**(RV-005·RV-011에 "확인 필요"로 표기).
- 화면 캡처: UI 대상 아님.
