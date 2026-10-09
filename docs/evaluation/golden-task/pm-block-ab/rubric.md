# PM block A/B 골든 테스트 - 판정 기준표 (결과를 보기 전에 동결)

이 문서는 결과(`results.jsonl`)를 보기 전에 확정한다. 결과를 본 뒤 기준을 고치면 그 비교는 무효이며, 고쳐야 하면 새 기준표 버전을 만들고 이전 결과와 섞지 않는다.

## 0. 무엇을 비교하는가

- 측정 대상: 메인 세션(sonnet)이 PM 행동규율 훅(`hooks/pm-orchestration-block.md`)의 영향 아래 요청을 분석해 올바르게 위임하는가.
- 변형 A = 현재 배포본(저장소 main 8008bdb 의 `malgn-agent`), 변형 B = 브랜치 `hold/v1.8.50`의 `malgn-agent`. 둘 다 `git archive <ref> malgn-agent` 동결 복사본을 `--plugin-dir`로 로드한다. 두 ref의 전체 sha는 매 결과 줄에 기록한다.
- **이 비교는 "훅 단독 효과"가 아니라 "v1.8.50 묶음 대 현 배포본"이다.** B는 훅 외에도 `malgn-agent/` 아래 다른 파일(에이전트·스킬 등)이 A와 다르다(실측: `malgn-agent/` 아래 11개 파일, 그중 훅 1개; 저장소 전체로는 22개 파일이 다르나 나머지는 문서·메타라 로드되지 않는다). 차이가 관측돼도 훅 때문이라고 단정하지 않는다.
- 범위: Sensitive 등급까지.

## 1. 결정적 첫 행동 분류 (메인 세션 = parent_tool_use_id 없는 tool_use)

읽기 전용(건너뜀): Read, Grep, Glob, Skill, ToolSearch, TodoWrite, 읽기성 Bash(git status/log/diff/show/rev-parse, `git branch` 목록 조회, ls, cat, head, tail, wc, rg, grep, find(-delete/-exec 없음), pwd, cd; 파이프 `|`·`&&`·`;` 연결도 모든 구간이 읽기성일 때만; 리다이렉트 `>`·`sed -i`·`tee` 포함 시 변경성).
결정적(첫 번째 것에서 판정·종료): Agent, Edit, Write, NotebookEdit, 변경성 Bash(읽기성이 아니거나 판단 불가한 Bash 전부), EnterWorktree.
그 밖의 도구(AskUserQuestion, 웹 도구, hub 도구 등)는 결정적도 읽기전용도 아니다 - 건너뛰되 `neutralTools`에 기록한다.

| first_action | 의미 |
|---|---|
| `main_edit` | Edit/Write/NotebookEdit 또는 변경성 Bash(메인이 직접 변경) |
| `Agent:<type>` | Agent 호출. `<type>`은 `input.subagent_type`에서 접두어 `malgn-agent:`를 제거해 정규화한 값. 생략이면 `Agent:(none)` |
| `EnterWorktree` | 워크트리 진입 도구 |
| `no_action` | 결정적 행동 없이 끝남(설명/질문만) |

subagent_type 비교는 정규화 후 **정확 일치**다. 부분 일치·`input_match` 방식은 쓰지 않는다(요청 문구가 지시서에 인용되면 헛통과).

## 2. 시나리오별 판정

판정 값: `PASS`(기대 첫 행동) / `TOLERATED`(허용되는 과잉) / `FAIL(라벨)`.

| # | 요청 | A 기대 | B 기대 | FAIL 라벨 |
|---|---|---|---|---|
| 1 | README '회원갑입' 오탈자 수정 | main_edit(README.md, 갑입->가입) | 동일 | Agent:pm = severe_misroute_pm, 그 외 Agent = over_delegation, 다른 파일 편집 = wrong_file |
| 2 | calcPrice 설명 | 첫 행동 없음, Agent 0, 변경성 행동 0 (하드 조건) | 동일 | Agent 또는 변경성 행동 1건이라도 있으면 FAIL. 읽기 횟수, 답변에 '할인' 포함은 **기록만** |
| 3 | 저장 버튼 연하게/둥글게(경로 미지정) | main_edit PASS, Agent:frontend-dev TOLERATED(허용 과잉) | Agent:frontend-dev PASS | A: pm=misroute_pm. B: main_edit=main_edit_violation, pm=misroute_pm. 그 외 Agent=wrong_agent |
| 4 | GET /orders/count 추가 (대조군) | Agent:backend-dev | 동일 | main_edit=main_edit_violation, pm=misroute_pm, 그 외=wrong_agent |
| 5 | 로그인 5회 잠금(Sensitive) | Agent:pm | 동일 | main_edit, Agent:backend-dev = under_routing; 그 외 = wrong_agent |
| 6 | (참고 관측) 브랜치 따서 작업 | EnterWorktree 또는 Agent isolation=worktree | 동일 | Bash로 worktree add / checkout -b / switch -c / branch <name> / cwd 밖 mkdir = isolation_bypass. **확정 판정이 아닌 참고 관측** |

시나리오 2만 끝까지 실행한다(하드 조건 위반 순간에는 비용 절감을 위해 종료 - 판정 동일). 나머지는 첫 결정적 행동에서 종료한다.
시나리오 6은 사전 점검에서 init tools에 `EnterWorktree`가 없으면 케이스에서 제외한다.

## 3. 지시서(brief) 결정적 검사

첫 행동이 Agent일 때 `input.prompt`에 대해 케이스 JSON의 `brief.all`(AND; 배열 원소는 OR 묶음)을 검사한다. 케이스: 3=버튼&(연하|둥글)&(.btn-primary|app.css), 4=/orders/count&count&(orders.mjs|routes)+제약 극성 정규식(테스트...건드리지 말/않), 5=5&(잠|lock)&관리자&(users|schema.sql). `brief.regexPass`는 판정(PASS/FAIL)과 별도 필드이며 첫 행동 판정을 바꾸지 않는다.

## 4. Fable 보조 채점 (지시서 본문 1건 대상)

- 입력: 사용자 원문 요청 + 지시서 `prompt` 본문 + 아래 항목표. **변형 이름·훅 본문·에이전트 종류는 주지 않는다.** 출력 파일명은 난수 id이고 id->실행 매핑은 별도 파일(`judge-map.json`)에 둔다.
- 항목(PASS/FAIL 이분, 각 항목에 지시서 원문 인용 필수):
  - (a) 요구사항이 이 대화에서 온 대로 빠짐없이 들어 있다
  - (b) 완료 판정 기준이 1줄이라도 있다
  - (c) 금지 범위·제약이 극성까지 맞게 들어 있다(요청에 제약이 없으면 "해당 없음"이 아니라 추가 제약을 지어내지 않았는지를 본다)
  - (d) 대상 경로 또는 찾는 방법이 있다
  - (e) 수신자가 이 대화를 몰라도 실행 가능하다
- **인용 검증(결정적)**: 판정자가 적은 인용이 지시서 본문의 부분문자열이 아니면(공백 정규화만 허용) 그 항목 판정은 무효(`INVALID`)이며 점수에 넣지 않는다.
- **needs_human**: 결정적 regex(`brief.regexPass`)와 판정자의 (a)&(c)가 어긋나면(regex PASS인데 (a) 또는 (c) FAIL, 또는 regex FAIL인데 (a)&(c) 모두 PASS) 그 실행에 `needs_human` 표시. 자동으로 어느 쪽도 채택하지 않는다.
- 판정자 모델은 `--judge-model`로 정한다. 실행 기록에 모델 별칭을 남긴다.

## 5. 집계와 해석 규칙

- 조건(시나리오 x 변형)별로 N회(기본 2) 결과를 첫 행동 분포와 판정 분포로 보고한다.
- N이 작다(기본 2회). 변형 간 차이는 "관측된 경향"으로만 서술하고, 한 쪽 2/2 대 다른 쪽 0/2처럼 분리가 뚜렷하지 않으면 차이가 있다고 결론내리지 않는다.
- 변형 간 차이가 시나리오 4(대조군)에서도 나타나면 훅/묶음 효과가 아니라 실행 노이즈를 의심한다.
- 시나리오 3은 변형별 기대가 다르므로 **판정 분포가 아니라 첫 행동 분포**를 나란히 보고한다.
- kill로 종료된 실행의 비용은 stream usage 토큰 추정치이며 `costSource: "estimated_from_usage"`로 표시한다. 정산 금액이 아니다.
- 사전 점검(`--preflight`) 중 하나라도 실패(SessionStart hook_response가 2건이 아님, 본문 문구 부재 등)하면 본 실행을 하지 않는다.
