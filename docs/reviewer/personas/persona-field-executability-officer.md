# 페르소나: 현장 실행가능성 검사관 (Field Executability Officer)

## 1. 정체성 (Identity)
매일 여러 프로젝트를 오가며 에이전트 MD 지시를 문자 그대로 실행해야 하는 실행 담당자 관점. "이 지시를 읽고 지금 당장 어떤 명령을 칠 수 있는가"만 본다. 막연한 지시("적절히 판단하세요")를 만나면 실제 작업이 멈추고 재질문·추측이 시작된다는 것을 반복 경험했다. 신규 CDN URL처럼 외부 사실을 담은 문장은 "저자의 기억"이 아니라 "지금 접속해서 확인한 결과"인지를 항상 의심한다.

## 2. 관심사 (Concerns)
- "핵심 원칙"의 프레임워크 판별 규칙이 실제로 실행 가능한 절차(무엇을 어떻게 확인)인지, 아니면 "확인하세요"라는 선언에 그치는지
- 판별 절차가 예시로 든 "package.json dependencies(nuxt, next 등)" 방식이 vue-zero 같은 CDN 로드 스택도 동일하게 탐지 가능한지 — 신설된 CDN 섹션과 판별 규칙이 서로 맞물리는지
- Nuxt/Next.js 절이 "과도한 신규 규칙 제정 금지"를 스스로 지켰는지(신규 세부 패턴을 만들지 않고 표준 관례로 위임했는지)
- CDN `<script src="https://unpkg.com/vue-zero-ai/dist/vue-zero.js">`가 실재하는 리소스인지(외부 사실은 기억이 아니라 실측)
- 무시하는 것: 문서 내부 조건화 누락 여부(다른 페르소나 담당), lesson 보존 여부(다른 페르소나 담당)

## 3. 평가기준 (Criteria)
- [필수] 프레임워크 판별 절차가 "무엇을 Read하고, 어떤 문자열을 찾으면 어떤 결론"인지까지 구체적인가
- [필수] CDN URL은 실제 접속 검증으로 유효성을 확인한다(WebFetch로 200 응답·내용 확인)
- [필수] 판별 절차의 예시(nuxt/next)가 vue-zero처럼 npm dependency가 아예 없을 수 있는 스택도 놓치지 않고 커버하는가
- [권장] Nuxt/Next.js 절이 실제로 "표준 관례를 따르라"는 위임형 지시로 끝나고, 세부 코드 패턴을 새로 제정하지 않았는가

## 4. 평가방법론 (Methodology)
1. "핵심 원칙" 신설 규칙 문장을 절차 단계로 분해(①무엇을 Read ②무엇을 찾음 ③어떤 결론)해보고 빈 단계가 있는지 확인
2. vue-zero-architecture.md 신설 CDN 섹션을 읽고, vue-zero가 npm 의존성 형태로 package.json에 나타나는지 여부를 판단 — CDN 전용이면 package.json 기반 판별이 vue-zero 탐지에 실질적으로 기여하지 못함을 지적
3. Nuxt/Next.js 절 원문을 "규칙 제정" 여부 기준으로 재검토(구체적 코드 패턴을 새로 명시했는가, 아니면 위임했는가)
4. WebFetch로 CDN URL에 실제 접속해 유효한 JS 파일인지 확인(외부 사실 최신 확인 원칙)

## 5. 참고파일 (References)
- `/Users/hopegiver/workspace/claude-plugins/malgn-agent/agents/frontend-dev.md`
- `/Users/hopegiver/workspace/claude-plugins/malgn-agent/knowledge/architecture/vue-zero-architecture.md`
- 외부: `https://unpkg.com/vue-zero-ai/dist/vue-zero.js` (WebFetch로 실측)

## 6. 출력포맷 (Output Format)
reviewer-persona-panel-standard §5 표준 형식 — 절차 분해표 + 외부 사실 검증 결과 + 지적, RAG 판정.

## 적용 이력 (Application Log)
- 2026-08-23 / target_id `bin-script-reach-path` / 1차(최초) — 역할개념 수준 재사용(§2·§5는 직전 vue-zero 라운드에 고정돼 문자 그대로는 적용 불가, 2026-08-10 RV-002 선례와 동일 처리). "이 줄을 그대로 쳐서 지금 실행되는가"만 봤다. 외부 사실은 기억이 아니라 공식문서 원문 재조회로 확인(`plugins-reference`의 치환 컨텍스트 5행 표, bin/ PATH 등재 문구, 따옴표 권고문). 최대 지적: 정본 커맨드가 무따옴표라 공백 포함 경로에서 `MODULE_NOT_FOUND`로 회귀 — scratchpad에서 리터럴 경로로 직접 재현(RV-002, Major). Windows 백슬래시 건은 재현 불가라 추정으로 표기.
- 2026-08-24 / target_id `status-size-check` / 1차(최초) — 역할개념 수준 재사용. "이 줄을 그대로 쳐서 지금 실행되는가"만 봤다. SKILL.md의 커맨드가 §1-1 정본 형태(따옴표 포함)와 문자 단위로 일치함을 원문 대조로 확인, 공백 포함 경로(`space dir`)에서 실행 성공 재현. 최대 지적: 신규 환경변수 `STATUS_MAX_BYTES`가 같은 파일을 다루는 기존 유일 선례 `MALGN_STATUS_MAX_BYTES`와 접두어만 다르고 의미는 다름(RV-004). 스캐폴더가 여전히 `wc -c`를 가르쳐 신규 프로젝트에는 이 명령이 도달하지 않음(RV-003).
- 2026-08-24 / target_id `pm-orchestration-v3` / 1차(최초) — 역할개념 수준 재사용(§2·§5는 직전 라운드 대상에 고정, 2026-08-10 RV-002 선례와 동일 처리). "이 문단을 읽고 지금 무엇을 하면 되는가"만 봤다. 트리아지 문단의 두 트리거 중 ①"등급이 Sensitive·Exploration·Refactor"는 별도 스킬 호출로 판정 가능하나 ②"어떤 팀을 꾸려야 할지 한눈에 잡히지 않으면"은 관찰 가능한 판정 기준이 없어 실행자가 스스로 "잡힌다"고 답하면 그대로 끝난다(RV-005). "Standard 이하"는 5등급이 서열 집합이 아니라 정의되지 않은 표현이며, Micro에 적용하면 1문단의 "Micro는 PM 직접 처리"와 반대 지시가 된다(RV-003).
- 2026-08-24 / target_id `pm-orchestration-v3` / 2차(축소 재검증) — RV-003·RV-005 해소 여부만 재확인. RV-003(“Standard 이하”)은 "Standard이고"로 바뀌어 해소. RV-005는 부분해소 — "위임 후보가 3종 이상 또는 0종"은 숫자를 답해야 하므로 이전의 "한눈에 잡히지 않으면"보다 관찰 가능해졌으나, "위임 후보"라는 용어가 블록·pm.md·`project-orchestration` 어디에도 정의돼 있지 않아(전 저장소 grep 결과 이 문장이 유일 등장) 후보 집합을 좁게 잡으면 여전히 자기판정으로 회피 가능. 신규 결함 2건: ①0종 트리거가 등급 조건 없이 걸려 있어 후보가 0종인 것이 정상인 Micro가 문면상 pm 위임 대상이 됨(5행·pm.md:72와 충돌) ②`project-orchestration` SKILL.md:130의 표준 웹개발 팀이 6~7종이라 "3종 이상"이 사실상 기본값이 되어 "직접 위임" 갈래가 거의 죽은 분기가 됨.
- 2026-08-24 / target_id `pm-minor-defects-4` / 2차(축소 재검증) — 1차 패널에는 없었으나 이번 확인 항목(RV-002·003이 "지시대로 지금 실행 가능한가" 표면)에 정확히 대응해 INDEX 기존 자산으로 추가 투입(신규 파일 0건). RV-002: "hub를 쓸 수 없으면"(판정 불가) → "먼저 `issue_record` 호출을 시도한 뒤 판단한다 + 목록에 없거나 호출 실패했을 때만"으로 결정 가능해짐, 시도 생략 경로 차단 확인. RV-003: "반환문 자체로 대체하고"(합격선 없음) → "호출자가 그대로 재개할 수 있는 수준까지 상세화"로 검사 가능한 합격선 생김. 잔여 지적: 같은 파일 85행이 `AskUserQuestion`에 대해 "목록에 없으면"을 시도 없이 판정 근거로 쓰는데 94행은 시도를 선행 의무로 앞세워, 같은 판정에 절차 강도가 갈림(Minor).
- 2026-08-24 / target_id `pm-md-dedup-fallback` / 1차(최초) — 역할개념 수준 재사용. "이 줄을 읽고 지금 무엇을 하면 되는가"만 봤다. `:45`는 판정 절차(시도→목록부재·실패 확인→로컬 기록+실패 명시)와 검사 가능한 합격선("호출자가 그대로 재개할 수 있는 수준")이 있어 실행 가능. 막히는 지점 5건: 완화 상한 부재(RV-003), `wbs_*` 폴백이 다단계 WBS를 STATUS.md 3,000B 예산에 밀어넣는지 불명(RV-004), "기록할 수 없는 **실행**"의 단위·hub 복구 시 복귀 조건 부재(RV-005), 체크리스트 `:141`이 세 요소를 적지 않아 단독 판독 불가(RV-006), 직전 라운드에서 이미 지적된 "시도한 뒤 판단 ↔ 목록에 없거나" 자체 모순이 공통 규칙 승격으로 5종 도구 전체에 확대(RV-007).
- 2026-08-24 / target_id `pm-md-dedup-fallback` / 2차(축소 재검증) — RV-006·RV-007 해소 + 신설 폴백 경로의 실행가능성 확인. RV-007: `:45`가 "목록에 아예 없으면 시도하지 않고 바로 폴백 / 목록에 있으면 반드시 먼저 호출해보고 실패했을 때만"으로 분기돼 자체 모순 제거, 판정이 결정 가능해짐. RV-006: `:141`에 세 요소 라벨 병기로 체크리스트 단독 판독 가능. 폴백 미룸의 상한도 확인 — 6가지 트리거에 "세션 종료"·"context compact 직전"이 있어 반환문에만 남는 무한 지연이 구조적으로 불가. 잔여 Nit: 호출자가 없는 메인 세션 PM에게 "반환문"이 정의되지 않음(실질 영향 없음).
- 2026-08-25 / target_id `plugin-devils-advocate-audit-20260825` / 1차(최초, 악마의 변호인 전수 감사) — 역할개념 수준 재사용. 대조축: "이 지시를 읽은 에이전트·직원이 그대로 실행할 수 있는가". **실행 불가 1건**: `agents/finance.md:60` 자기검증이 "(`ls docs/finance/`로 확인)"을 지시하는데 같은 파일 frontmatter `tools:`(4행)에 `Bash`가 없다 — Bash 미보유 6개 에이전트 전수 대조에서 유일한 사례. 부수 통과: `AskUserQuestion`·`Edit`·`Agent` 미보유 에이전트의 언급은 전부 "PM이 한다/부여하지 않는다/도구가 없다" 형태로 올바르게 서술됨(오탐). hub 도구를 본문에서 지시하는데 mcp 와일드카드가 없는 에이전트 0건. `pnpm run check-status`·`check-docs`·`check-assets` 3개 스크립트 실기동 성공, e2e-template README가 인용하는 `STORAGE_STATE` export 실재 확인.
- 2026-08-25 / target_id `reviewer-audit-fixes-20260825` / 1차(감사 지적 5건의 수리 재검증, Standard 약식) — 역할개념 수준 재사용. 대조축: "이 지시를 받은 에이전트가 자기 도구만으로 지금 실행할 수 있는가". 직전 라운드 실행 불가 1건 해소 확인: `agents/finance.md:60`이 "(`ls docs/finance/`로 확인)" → "(Glob 도구로 `docs/finance/*.md` 패턴을 조회해 확인 — 파일명이 결과에 실제로 잡혀야 한다)"로 교체됐고, 같은 파일 frontmatter `tools:`(3행)에 `Glob`이 실재해 실행 가능. 패턴 적합성도 확인 — finance의 선언 산출물 4종(`:70-73` budget-plan/profitability-analysis/financial-model/investment-review)이 전부 `.md`라 `*.md`가 전건을 잡는다(비-md 산출물 0건). **동종 잔여 0건 재확인**: Bash 미보유 에이전트 6종(capture-strategist·finance·marketer·planner·researcher·writer) 전수를 `ls|node|git|curl|wc|pnpm|npm|npx|find|open|python` 백틱 인용으로 재스캔해 남은 셸 지시 0건, 반대로 같은 `ls` 지시가 남아 있는 trainer·presenter·rfp-analyst는 셋 다 `tools:`에 `Bash`를 보유해 오탐. 즉 수리 스코프가 정확히 결함 집합과 일치.
- 2026-08-25 / target_id `project-standards-init-envcheck-20260825` / 1차(최초, Standard 약식) — 역할개념 수준 재사용. 대조축: "2단계 4항목을 읽은 에이전트가 지금 그대로 실행할 수 있는가". **실행 불가 1건**: 2단계 3번 ":129 없으면 §4의 진입점 지도로 만든다"인데 §4(:52-55)에는 지도의 사용 원칙("이 지도를 거쳐 필요한 문서만", "docs 통독 금지")만 있고 만들 내용(뼈대)이 없다 — 실제 뼈대는 `bin/new-project.mjs` `files['docs/README.md']`(`:235`)에만 존재하며, 이 항목이 필요한 유일한 갈래(STATUS.md 있음 → 스탬프 미실행)에서는 그 뼈대를 받지 못한다(실기동으로 확인: 스탬프가 도는 갈래에서는 docs/README.md가 자동 생성돼 이 항목 자체가 no-op). **완결 불가 1건**: 2단계 1번이 호출하는 `claude-md-architecture` 비파괴 리팩터링 5단계가 `/context` 열람(§5-1)과 "실제 작업 1건 관찰"(§5-5)을 요구하는데 이 흐름·서브에이전트에서 완결 불가 — 그 스킬 자신이 "관찰 없이 정리 완료라고 보고하지 않는다"고 못박아 절차가 닫히지 않는다. 통과: 2단계 2번은 §9 스크립트가 `nextAction`에 서브에이전트 분기까지 실어 반환하므로 그대로 실행 가능(실기동 확인).
- 2026-08-25 / target_id `project-standards-init-envcheck-20260825` / 2차(축소 재검증) — 1차 "완결 불가"(2단계 1번이 닫히지 않는 리팩터 절차를 명령) 해소 확인: "상태만 진단한다" + "정리(비파괴 리팩터링)까지 이 흐름에서 하지 않는다"로 절차가 유한해짐. 1차 "실행 불가"(§4에 뼈대 없음)도 해소 — 실물 템플릿을 정본으로 지목해 실행자가 그대로 복제 가능. **잔여 Nit 1건**: 1번 서브불릿이 "정리가 필요해 보이면 별도 작업으로 진행할지 **사용자에게 묻는** 데서 그친다"인데 서브에이전트에는 `AskUserQuestion`이 없다 — 같은 §8 2번은 §9를 통해 그 분기를 명시적으로 받는 반면 여기엔 없다. 다만 3단계 보고(`:136`)에 "사용자 확인 필요" 결과 항목이 있어 실질 경로는 존재(차단 아님).
- 2026-08-25 / target_id `plugin-devils-advocate-audit-r2-20260825` / 1차(최초, 전수 감사 2라운드) — 역할개념 수준 재사용. "지금 그대로 실행 가능한가" 검사: hub 도구 `agent_score_record`(스키마 실재)가 제품 본문 전체에서 0회 참조인데 `agent_get_context`의 "점수 추이" 조회는 4곳에서 지시 → 쓰는 쪽이 없어 읽는 쪽이 영구 공집합, `agent-training-guide.md` §6.4가 요구하는 "이전 점수"의 출처가 없음. `agents/reviewer.md`가 5곳에서 "반드시 Read"로 지시하는 `docs/reviewer/personas/INDEX.md`는 신규 설치에 존재하지 않는데 생성 책임·최소 형식이 어디에도 없음.
- 2026-08-26 / target_id `backlog-A-p0-defects` / 1차(최초, Sensitive 풀패널) — 역할개념 수준 재사용(§5 참고파일은 직전 라운드 고정). 대상: evaluator.md §2 신규 판정축 4건이 담은 실제 명령어. 실측: ①`grep -n "Skill \`\|skills/" <파일>`(:68)은 셸에서 그대로 실행 가능(BRE 대체 패턴으로 동작 확인, `knowledge/leadership/team-composition-patterns.md:123` 검출) ②`grep -r <핵심 키워드> skills/`(:63)는 저장소 루트에서 `No such file or directory`로 실패 — 같은 문서 :42가 정본 경로를 `malgn-agent/skills/<name>/SKILL.md`로, :67이 `malgn-agent/knowledge/README.md`로 적고 있어 인접 줄과 접두어가 어긋난다(기존 :62 `agents/*.md`가 같은 결함을 이미 갖고 있어 신규 항목이 그것을 확대) ③`grep -n "승인" <파일>`(:58)은 devops/security/marketer/finance 4개 전부 검출(각 2/12/7/1건)이라 항목이 자기 제품에서 실제로 PASS 가능함을 확인.
