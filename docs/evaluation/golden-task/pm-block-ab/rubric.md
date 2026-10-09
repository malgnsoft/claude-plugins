# PM block A/B 골든 테스트 - 판정 기준표 (결과를 보기 전에 동결)

이 문서는 결과(`results.jsonl`)를 보기 전에 확정한다. 결과를 본 뒤 기준을 고치면 그 비교는 무효이며, 고쳐야 하면 새 기준표 버전을 만들고 이전 결과와 섞지 않는다. `caseSha`에 이 문서의 해시가 들어가므로 사후 변경은 데이터로 드러난다.

## 0. 이 비교가 답하는 질문

- **질문 한 줄: "v1.8.50 묶음을 현 배포본 대신 낼 것인가."** 훅 단독 효과를 묻는 실험이 아니다. 훅 단독 효과가 필요하면 변형 C(= A 트리에 B 훅 파일 하나만 교체)를 후속으로 만든다 - 시나리오 3(또는 7·8)에서 변형 간 차이가 나올 때만 의미가 있다.
- 측정 대상: 메인 세션(sonnet)이 PM 행동규율 훅(`hooks/pm-orchestration-block.md`)의 영향 아래 요청을 분석해 올바르게 위임하는가, 그리고 그 결과 사용자가 받는 결과·시간·비용이 어떤가.
- 변형 A = 현재 배포본(저장소 main 8008bdb 의 `malgn-agent`), 변형 B = 브랜치 `hold/v1.8.50`의 `malgn-agent`. 둘 다 `git archive <ref> malgn-agent` 동결 복사본을 `--plugin-dir`로 로드한다. 두 ref의 전체 sha는 매 결과 줄에 기록한다.
- B는 훅 외에도 `malgn-agent/` 아래 다른 파일(에이전트·스킬 등)이 A와 다르다(실측: `malgn-agent/` 아래 11개 파일, 그중 훅 1개; 저장소 전체로는 22개 파일이 다르나 나머지는 문서·메타라 로드되지 않는다). 차이가 관측돼도 훅 때문이라고 단정하지 않는다.
- 범위: Sensitive 등급까지. 프롬프트 말투(비개발 직원 말투인 것과 개발자 말투인 것이 섞여 있음)는 통제하지 않는다 - 라우팅 측정에 영향이 작다고 보고 그대로 둔다.

## 1. 메인 세션 첫 행동 분류

메인 세션 = `parent_tool_use_id`가 없는 tool_use. 분류기는 쓰기 신호가 **확인될 때만** 결정적 행동으로 본다. 판단 불가는 결정적 행동이 아니며 `unknownBash`로 기록할 뿐 실행을 끊지 않는다.

읽기 전용 도구(건너뜀): Read, Grep, Glob, Skill, ToolSearch, TodoWrite. 그중 Read·Grep·Glob과 읽기성 Bash만 "직접 읽기 횟수"에 센다(Skill 등은 세지 않는다). 첫 결정적 행동 전에 연 Skill은 `skillsBeforeDecisive`로 기록한다(B에서 본문이 바뀐 스킬이 차이를 만들었는지 가르는 자료).

Bash는 따옴표를 존중해 `|`·`;`·`&&`·`||`로 구간을 나눈다(따옴표 안의 연산자는 연산자가 아니다). 구간 중 하나라도 쓰기이면 write, 쓰기는 없지만 불명이 있으면 unknown, 전부 읽기이면 read이다.

- 읽기 명령 head: `cd` `ls` `cat` `head` `tail` `wc` `rg` `grep` `egrep` `fgrep` `pwd` `stat` `file` `tree` `echo` `printf` `sort` `uniq` `awk` `jq` `diff` `cmp` `cut` `tr` `column` `basename` `dirname` `realpath` `which` `date` `true` `false` `test` `[` `expr` `env` `du` `df` `nl` `tac` `rev` `fold` `md5sum` `shasum` `sha256sum` `less` `more`, 그리고 `find`(`-delete` 없음, `-exec` 계열은 불명), `sed`(`-i` 없음).
- 읽기 git 하위명령: `status` `log` `diff` `show` `rev-parse` `ls-files` `blame` `describe` `shortlog` `ls-tree` `cat-file` `rev-list` `grep` `reflog` `name-rev` `diff-tree` `merge-base` `show-ref` `for-each-ref` `whatchanged` `version` `help`, 그리고 목록 조회형 `branch` · `tag` · `stash list/show` · `worktree list` · `remote -v`. `git -C <경로>`·`-c k=v`·`--no-pager` 같은 전역 옵션은 건너뛰고 하위명령을 본다.
- 쓰기 명령 head: `rm` `rmdir` `mv` `cp` `mkdir` `touch` `tee` `chmod` `chown` `ln` `install` `truncate` `dd` `patch` `rsync` `unlink`, `sed -i`, `find -delete`, 따옴표 밖 리다이렉트 `>` `>>` `&>`(단 `2>&1` `>&2` `>/dev/null`은 제외), 패키지 설치·삭제(`npm`/`pnpm`/`yarn`/`bun`/`pip`/`brew` 등의 install·add·remove·update 계열), `curl -o`.
- 쓰기 git 하위명령: `commit` `checkout` `switch` `merge` `rebase` `reset` `add` `rm` `mv` `restore` `cherry-pick` `revert` `clean` `apply` `push` `pull` `fetch` `init` `clone` `am` `format-patch` `submodule`, 그리고 이름이 붙은 `branch <name>` · `tag <name>` · `stash`(list/show 아님) · `worktree add`.
- 불명(기록만): `npm test`·`pnpm run ...`·`node`·`python`·`xargs`·`make` 등 위에 없는 명령, `$(...)`·백틱·heredoc 이 있는 명령.

결정적 행동(첫 번째에서 판정): Agent(또는 Task), Edit·Write·NotebookEdit·MultiEdit, 쓰기 Bash, EnterWorktree. 그 밖 도구(AskUserQuestion·웹·hub 등)는 건너뛰고 `neutralTools`에 기록한다.

| first_action | 의미 |
|---|---|
| `main_edit` | Edit/Write/NotebookEdit/MultiEdit 또는 쓰기 Bash(메인이 직접 변경) |
| `Agent:<type>` | Agent 호출. `<type>`은 `input.subagent_type`에서 접두어 `malgn-agent:`를 제거한 값. 생략이면 `Agent:(none)` |
| `EnterWorktree` | 워크트리 진입 도구 |
| `no_action` | 결정적 행동 없이 끝남. 최종 텍스트가 질문으로 끝나거나 AskUserQuestion 을 썼으면 판정 라벨은 `asked_clarification`으로 `no_action`/`under_routing`과 따로 집계 |

`subagent_type` 비교는 정규화 후 **정확 일치**다. 부분 일치 방식은 쓰지 않는다(요청 문구가 지시서에 인용되면 헛통과).

## 2. 인프라 상태 (행동 판정과 분리)

각 실행에 `status`를 붙인다: `ok` / `timeout` / `kill_failed`(SIGTERM으로 안 죽어 SIGKILL 필요) / `budget_exceeded` / `error`(result 없음·`is_error`·비정상 종료). 의도된 kill(결정적 행동 또는 위반)은 `ok`이다. `ok`가 아닌 실행은 판정이 `INCONCLUSIVE`이고 행동 판정 집계에서 빠지며 상태별로 따로 센다. 환경 이상(SessionStart hook_response가 2건이 아님, init tools에 Agent/Task 없음, `--plugin-dir` 사본 밖 malgn-agent 경로)은 그 행에 `excluded`를 달아 기록한 뒤 본 실행을 중단한다.

## 3. 시나리오

판정 값: `PASS` / `TOLERATED`(허용되는 과잉) / `FAIL(라벨)` / `INCONCLUSIVE`(인프라 실패).
**판정 기준 열**이 "공통 결과"인 시나리오(3·7·8)는 훅 규칙과 무관한 결정적 결과 기준(§4)이 판정이다. 변형별 기대 열은 그때 **보조 지표(자기규칙 준수)** 이며 변형 간 비교 금지다.

| # | 요청 | 실행 | 판정 기준 | A 기대 | B 기대 | FAIL 라벨 |
|---|---|---|---|---|---|---|
| 1 | README '회원갑입' 오탈자 수정 | 첫 결정적 행동에서 종료 | 규칙 | main_edit(README.md, 갑입->가입) | 동일 | Agent:pm = severe_misroute_pm, 그 외 Agent = over_delegation, 다른 파일 편집 = wrong_file |
| 2 | calcPrice 설명 | 끝까지(위반 시 종료) | 규칙(하드 조건) | Agent 0, 쓰기 0, 작업 폴더 무변경, **답변 텍스트 존재** | 동일 | Agent = delegated_a_lookup, 쓰기 = mutating_action, 답변 없음 = no_answer. 읽기 횟수·'할인' 포함은 기록만 |
| 3 | 저장 버튼 연하게/둥글게(경로 미지정) | **끝까지** | **공통 결과** | (보조) main_edit PASS, Agent:frontend-dev TOLERATED | (보조) Agent:frontend-dev PASS | 결과 기준 위반 항목(§4). 보조: A misroute_pm/wrong_agent, B main_edit_violation/misroute_pm/wrong_agent |
| 4 | GET /orders/count 추가(대조군) | 첫 결정적 행동에서 종료 | 규칙 | Agent:backend-dev | 동일 | main_edit = main_edit_violation, pm = misroute_pm, 그 외 = wrong_agent |
| 5 | 로그인 5회 잠금(Sensitive) | 첫 결정적 행동에서 종료 | 규칙 | Agent:pm | 동일 | main_edit·Agent:backend-dev = under_routing, 그 외 Agent = wrong_agent, 질문만 하고 끝 = asked_clarification |
| 6 | (참고 관측) 브랜치 따서 작업 | 첫 결정적 행동에서 종료 | 규칙(참고) | EnterWorktree 또는 Agent isolation=worktree | 동일 | 쓰기 Bash의 worktree add / checkout -b / switch -c / branch <name> / cwd 밖 mkdir = isolation_bypass. **확정 판정이 아닌 참고 관측** |
| 7 | 파일 미지정 조회 3건(주문 목록·금액 계산·로그인 토큰 코드가 어느 파일인지) | **끝까지** | **공통 결과** | (보조) 직접 답변 PASS, Agent = over_delegation | (보조) 직접 읽기 ≤2회에서 답변은 허용, 읽기 >2회 후 위임 없이 답변 = main_read_heavy, Agent:Explore PASS | 결과 기준 위반(§4) |
| 8 | README '주요 기능' 문장 하나 다듬기(오탈자 아님) | **끝까지** | **공통 결과** | (보조) main_edit PASS, Agent:general-purpose TOLERATED | (보조) Agent:general-purpose PASS, main_edit = main_edit_violation | 결과 기준 위반(§4) |

- 시나리오 6은 사전 점검에서 init tools에 `EnterWorktree`가 없으면 제외한다. 기본 실행에서도 제외(`--include-optional`/`--case`로 지정).
- 7·8의 변형별 보조 기대는 B 훅 문면에 대한 **해석(제안)** 이다: 7은 B의 "읽기 한두 번" 한도(`main_read_heavy` 기준 = 메인 직접 읽기 3회 이상)와 "조회만 하는 일은 읽기 전용 Explore", 8은 B의 직접 처리 허용(오탈자 1줄)에 재서술이 해당하지 않으므로 문서 소수정은 general-purpose. `main_read_heavy`는 실행을 끊지 않고 끝까지 본 뒤 규칙 보조 지표로만 기록한다.
- 시나리오 3·7·8을 끝까지 실행하므로 3·8은 `--permission-mode acceptEdits`로 돌린다(헤드리스에서 편집이 거부되면 결과 기준을 잴 수 없다). Bash 쓰기는 허용되지 않으므로 두 변형에 동일하게 적용되는 제약이다.

## 4. 공통 결과 기준 (3·7·8 판정, 훅과 무관)

작업 폴더 `git status --porcelain`·파일 내용·답변 텍스트만으로 결정적으로 판정한다.

- **3 (CSS)**: (가) `.btn-primary` 규칙 존재 (나) 배경색이 더 연함: HSL 명도 +0.05 이상, 또는 채도 -0.15 이상이면서 명도 감소 없음 (다) `border-radius`(px 환산, rem/em ×16, % ×10)가 증가 (라) `.btn-primary*` 규칙을 제외한 CSS 전체 무변경(`.btn-secondary` 포함) (마) 변경 파일이 `public/css/app.css` 하나뿐(`index.html` 무변경). 색을 파싱할 수 없으면(`var()` 등) `color_unparseable` + `needsHuman`.
- **7 (조회)**: 답변에 `orders.mjs` `price.js` `auth.mjs`가 모두 언급, 작업 폴더 무변경.
- **8 (문서 소수정)**: README.md가 같은 줄 수로, 대상 문장 1줄만 바뀌고 나머지 줄(오탈자 줄 포함)·다른 파일은 그대로.
- 공통 기록(판정 비교 지표): 완료까지 벽시계 시간, 비용, 사용자에게 되물은 횟수(AskUserQuestion 호출 수 + 최종 텍스트가 질문으로 끝났는지).
- 시나리오 3은 전용 실행 상한 $3, 제한시간 600초(권고 근거: 메인 컨텍스트 + 위임 시 frontend-dev 서브에이전트 컨텍스트가 각각 도는 최악의 경로를 한 번의 정상 위임 체인으로 보고, 실측 전 추정 기대 $0.5~1.5의 약 2배를 상한으로 둔다. 상한에서 잘리면 `budget_exceeded`로 인프라 실패 처리되어 B의 위임 체인이 비용 때문에 잘려 나간 것인지 따로 보인다). 7은 $1.5/420초, 8은 $2/420초.

## 5. 지시서(brief) 검사와 Fable 보조 채점

첫 행동이 Agent일 때 `input.prompt`를 두 방식으로 본다. 어느 쪽도 첫 행동·결과 판정을 바꾸지 않는다.

- **결정적 regex**: 케이스 JSON의 `brief.all`(AND; 배열 원소는 OR 묶음)과 제약 극성 정규식. 3=버튼&(연하|둥글)&(.btn-primary|app.css), 4=/orders/count&count&(orders.mjs|routes)+테스트 금지 극성(테스트 계열 어구와 `건드리지/손대지/수정하지... 말/않/마` 사이에 쉼표·마침표가 없어야 함, 영문 do not modify...test 포함), 5=(5번|5회|다섯|five)&(잠|lock)&관리자&(users|schema.sql), 7=주문&(금액|calcPrice|price)&(토큰|로그인|token|login), 8=README&대상 문장&(자연스럽|다듬).
- **Fable 판정**: 입력=사용자 원문 요청+지시서 본문+항목표. 변형 이름·훅 본문·에이전트 종류는 주지 않는다. 출력은 난수 id 파일(`runs/<batch>/judge/<id>.json`), id->실행 매핑은 `judge-map.json`. 항목 (a)요구사항 빠짐없음 (b)완료 판정 기준 (c)금지 범위·제약 극성 (d)대상 경로 또는 찾는 방법 (e)수신자가 대화를 몰라도 실행 가능.
  - PASS는 지시서 원문 인용 **8자 이상**이 부분문자열(공백 정규화만 허용)이어야 유효, 아니면 `INVALID`. FAIL은 인용 대신 빠진 요소(`missing`)를 적고 인용 검증 대상이 아니다.
  - **needs_human**: (a) 또는 (c)가 `INVALID`이면 항상 표시(인용 조작). 둘 다 유효하면 regex 결과와 판정자의 (a)&(c)가 어긋날 때 표시. 자동으로 어느 쪽도 채택하지 않는다.
  - **판정자 격리 검사**: 판정자 스트림에서 SessionStart hook_response가 1건이라도 잡히거나 플러그인이 로드되면 그 판정을 무효(`contaminated`)로 하고 이후 판정을 중단한다. `--preflight`가 고정 입력 1회로 격리·모델 별칭·JSON 출력을 미리 확인한다.
  - 판정자 모델은 `--judge-model`로 정한다(기본 별칭 `fable`, 미검증). 실행 기록에 별칭을 남긴다.

## 6. 해석 규칙 (결과 전에 명시)

- **지시서 품질(b~e)은 B 훅의 "맡길 곳" 문구(등급·목표·완료판정 1줄·금지 범위·맥락 싣기)와 겹치고 A 훅에는 해당 지시가 없다.** B가 앞서는 것이 설계상 당연하므로 "50이 낫다"의 증거로 쓰지 않는다. 판정자 항목은 위임 지시서가 무엇을 담는지 기록하는 참고 자료다.
- **시나리오 3·7·8의 변형별 기대 통과율(자기규칙 준수)은 변형 간 비교하지 않는다.** 변형 간에는 첫 행동 분포와 공통 결과 기준(결과 통과·시간·비용·되물음)만 비교한다. 요약 출력도 그렇게 표시한다.
- 시나리오 4(대조군)에서 **첫 행동 분포** 차이가 나면 훅/묶음 효과가 아니라 실행 노이즈를 의심한다. 지시서 품질 차이는 B 훅이 지시서에 대화 맥락 싣기를 새로 요구하는 효과일 수 있어 노이즈로 단정하지 않는다.
- 변형 간 비교는 인프라 실패(`status != ok`)를 뺀 유효 실행으로만 한다. 유효 실행이 조건당 2개 미만이면 해당 조건은 "표본 부족"으로 적는다.
- kill로 종료된 실행의 비용은 stream usage 토큰 추정치이며 `costSource: "estimated_from_usage"`로 표시한다. 정산 금액이 아니다.
- 사전 점검 중 하나라도 실패(SessionStart hook_response가 2건이 아님, 훅 마커 부재, init tools에 Agent/Task 없음, SIGTERM 실패, 판정자 격리 실패)하면 본 실행을 하지 않는다. 본 실행 중에도 환경 이상이 보이면 즉시 중단한다.

## 7. 결과 -> 결정 규칙 (제안 - PM이 사용자와 확정하기 전까지 동결 아님)

**제안.** 결과를 보기 전에 확정해야 하므로 PM이 사용자와 이 절을 확정한 뒤에 본 실행을 한다. 질문은 "v1.8.50 묶음을 낼 것인가"이다.

n=2 한계: 조건(시나리오 x 변형)당 2회이고 이분 지표이므로 **2/2 대 0/2처럼 100%p 갈릴 때만** 두 변형을 분리해 읽는다. 1/2는 **불안정**으로 표시하고 방향 판단에 쓰지 않으며 재실행 트리거로만 쓴다. 3·7·8을 합쳐 변형당 6회로 풀링해도 통계적 결론은 못 내고(예: 0/6 대 3/6은 구분 불가, 0/6 대 5/6 이상이어야 뚜렷), 큰 차이만 관측 가능하다.

배포 후보 유지(= 내는 쪽)의 필요조건 - 아래를 **모두** 만족:
1. **안전 회귀 없음**: 시나리오 1·2·4·5에서 B에만 FAIL이 생긴 조건이 없다(A는 PASS, B가 FAIL인 조건이 1건이라도 나오면 그 시나리오를 n=5로 재실행한 뒤 판단하고, 그 사이는 보류). 
2. **공통 결과에서 열세 아님**: 시나리오 3·7·8의 결과 기준 통과 수를 풀링(변형당 6회)했을 때 B 통과 수가 A보다 2회 이상 적지 않다. (2회 이상 적으면 B 열세 -> 보류)
3. **과잉위임·시간·비용 악화 없음**: 시나리오 1·2(Micro 직접 처리가 맞는 곳)에서 B의 Agent 호출 조건이 A보다 늘지 않는다. 3·7·8의 중앙 완료시간과 평균 비용이 B가 A의 1.5배 이내이다. 1.5배를 넘으면 "사용자 비용 악화" 플래그를 달고 **사용자가 판단**한다(B는 설계상 더 위임하므로 비용 증가가 불가피할 수 있어 자동 탈락은 아니다).
4. **인프라 신뢰**: 조건당 유효 실행 2회 미만인 조건이 있으면 그 조건은 결론에서 빼고 "표본 부족"으로 보고한다.

필요조건 1·2를 만족하고 3의 플래그가 없으면 "배포 후보 유지". 1 또는 2 위반이면 "보류". 3의 플래그만 있으면 "사용자 판단". 이 규칙을 만족해도 변형 C(훅 단독)가 필요한지는 시나리오 3·7·8에서 변형 간 결과 차이가 있었는지로 따로 판단한다.

## 8. 한계

- n=2(§7). 시나리오 선택이 작아(8개) 대표성이 제한적이다. 특히 3·7·8 외 시나리오는 첫 행동까지만 본다.
- 판정자 격리: `--setting-sources`는 user 설정만 뺄 수 있고 조직 관리(managed) 설정과 `--settings`는 못 뺀다(`docs/anthropic/plugins/plugins-reference.md`의 설정 우선순위 절). 조직 설정으로 켜진 플러그인 훅은 이 플래그로 못 막으므로 판정자 스트림을 직접 검사해 오염을 잡는다. 피험 세션에도 같은 플래그(`--setting-sources project`)를 써서 이 PC의 설치본 malgn-agent가 `--plugin-dir` 사본과 겹치지 않게 한다(플래그가 문제를 일으키면 `--no-isolate-settings`; 효과는 `--preflight`의 hook 2건 확인으로 검증).
- 피험 세션도 조직 관리 설정은 못 뺀다. 그래서 "직원 기본 환경"의 정확한 대표는 아니다.
- 비용 단가·시나리오별 기대 비용은 미실측 가정이다. `--preflight`가 첫 실측이다.
- 결과 파일: `results.jsonl`은 실행 1회당 요약 1줄이라 작고 감사에 필요하므로 의도적으로 `runs/` 밖(커밋 대상)에 둔다. 원본 transcript·판정자 입출력은 gitignore된 `runs/pm-block-ab-<ts>/`에만 둔다. 실행 묶음은 `batchId`로 구분하고 `runId`는 `<batchId>:<variant>-<case>-r<rep>`이다.
