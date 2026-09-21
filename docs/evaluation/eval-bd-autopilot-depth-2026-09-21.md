# evaluator 판정 — business-director → autopilot 스폰 깊이 초과 수정

- 판정 대상: `malgn-agent/agents/business-director.md` · `malgn-agent/agents/autopilot.md` · 신규 `malgn-agent/skills/business-director-autopilot-relay/SKILL.md`
- 범위: 워크트리 `.claude/worktrees/trainer-bd-autopilot-depth`, 브랜치 `trainer/bd-autopilot-depth-20260921`, `git diff 9c693d7 1cfd304`
- 등급: **Sensitive (고정)** — 변경 헝크가 에이전트 MD의 "역할 경계" 절 안에 걸린다(`autopilot.md:27`, `business-director.md:25-30`). 판정 기준은 변경된 **위치**이지 문구의 무게가 아니다.
- 종합: **조건부 PASS — merge 보류.** 문서 판정 체크리스트는 전 항목 PASS. 다만 ①Sensitive 등급이라 사람 승인 전 merge 금지 ②성능형 Sensitive의 실행 검증 1건이 미수행 ③병합 전 PM 동반 처리 3건이 남는다.
- 판정자: evaluator / 판정일: 2026-09-21

기록의 정본 채널은 malgnai-hub(`decision_record` + `agent_score_record`)다. 이 문서는 그 판정의 근거 표를 브랜치에 남기기 위한 사본이다.

## 1. 판정 체크리스트

### 공통

| 항목 | 판정 | 실측 근거 |
|---|---|---|
| 경로 실재 | PASS | 새 본문이 인용하는 `agents/business-director.md`·`agents/pm.md`·`agents/autopilot.md`·`knowledge/leadership/autonomous-iteration-philosophy.md` 4건 `test -f` 전부 OK. 미실재 인용 0건 |
| 이식성 | PASS | `grep -n "/Users/\|~/\.claude"` 3개 파일 전부 0건 |
| malgnai-hub 정합 | PASS | 미존재 도구(`lesson_*`/`memory_*`/`command_add`/`project_autonomy_*`/`decision_add`/`issue_add`/`agent_learning_log_add` 등) 0건. 파라미터도 스키마 원문 대조 일치 — `work_record.nextAction`(실재, maxLength 2000), `project_search_history(projectId, query)`(query maxLength 200 ≥ "목표 제목 1줄"), `project_get_context.sections`가 쓰는 `state`/`issues`/`wbs`가 전부 enum 값 |
| 등급 고정 | **Sensitive** | `git diff --name-only`로 3파일 열거. `hooks/`·`plugin.json`·`marketplace.json`은 미포함이나, **에이전트 MD "역할 경계" 절 안에 헝크가 걸려** Sensitive로 고정된다 → merge 금지·사람 승인 필수 |

### Agent MD

| 항목 | 판정 | 근거 |
|---|---|---|
| 9단 골격 순서 | PASS | `business-director.md` 헤딩 순서 핵심원칙(:16)→역할경계(:25)→스킬상세(:60)→전제조건(:164)→자기검증(:171)→산출물(:198)→학습자료(:206)→토큰효율(:228). 신설 절(:50)은 역할 경계의 하위 절로 들어가 순서를 깨지 않는다 |
| 페르소나 5요소 | PASS | 정체성·호출조건(:25)·역할경계(인접 에이전트 `autopilot`/`marketer`/`finance`/`researcher`/`customer-support`/`reviewer` 명시)·산출물 계약(:198)·완료정의(:171) 전부 유지. 호출자 정의가 autopilot 쪽에서도 짝으로 갱신됨(`autopilot.md:27`) |
| 실행력 도메인 승인 게이트 | PASS | 대상 목록(devops/security/marketer/finance) 밖이나 director는 자체 사업 게이트 4종 보유. 이번 diff가 그 게이트를 약화시키지 않음을 원문 대조로 확인 — `:56`이 새 마커를 "사람 승인 대기가 아니다"로 못박는 동시에 **게이트에 걸린 건을 이 마커로 내보내지 말 것**까지 양방향으로 막고(:190 자기검증에 짝으로 걸림), 같은 줄이 **사업 게이트 사전 판정(:117)이 요청 반환보다 앞서 끝나 있어야 한다**고 명시 |

### Skill (신규 `business-director-autopilot-relay`)

| 항목 | 판정 | 근거 |
|---|---|---|
| description 2단 구조 | PASS | "[무엇] 마커 요청을 호출자가 이어받는 인계 절차 — 4단계 요지" + "[언제] 그 마커가 첫 줄에 담긴 반환을 받았을 때 / director에게 개발·운영·배포를 맡기기 전" 양쪽 실재 |
| description 길이 | PASS | **[r2 정정]** r1에 적은 "556자"는 문자 수가 아니라 바이트였다. 실제는 276자로 기준("300자 내외") 안이며 애초에 관찰 대상이 아니었다 — 측정 단위를 틀린 것은 evaluator 쪽 오류다. 저장소 42개 스킬의 문자 수 중앙값은 190자, 최장 483자다 |
| 접두어(비용 구조) | PASS | 합산 도달 = **1**. ①직접 참조: `agents/business-director.md` 1개(4곳) ②knowledge 경유: 0 ③규율 대상(고정 문자열 `⚠️ autopilot 위임 필요 — 호출자 실행`) 경유: 추가 도달 0(전부 같은 파일). 1 → 무접두어가 정확 |
| 중복 판정 | PASS | `grep -rl autopilot skills/*/SKILL.md` 결과가 이 스킬 1건뿐. 같은 트리거 문구에 반응하는 기존 스킬 없음. 상호 해명문("X와 중복되지 않는다")에 기대지 않고 **경계 절(:16-18)이 무엇을 다루지 않는지를 정본 파일 경로로 지목**해 배타성을 세웠다 |

### 성능형 Sensitive 실행 검증

| 항목 | 판정 | 근거 |
|---|---|---|
| 정상경로 1건 + 경계/오용경로 1건 재현 | **미충족(이월)** | evaluator에 `Agent` 도구가 없어 직접 스폰 불가. 병합 전이라 설치본에도 이 경로가 없다. **PM에 재현 실행을 요청한다**(§4) |

## 2. trainer 주장 ↔ 실물 대조 (claimed ≠ verified)

| # | trainer 주장 | 판정 | 독립 실측 |
|---|---|---|---|
| 1 | 신규 마커가 기존 마커와 충돌하지 않는다 | **verified** | `agents/`·`skills/`·`hooks/` 전역에서 `⚠️ … — …` 형태를 전수 추출. 실재 마커는 `사람 승인 대기 — 미실행` / `사람 판단 대기 — 미실행` / `산출 미완료 — 차단` / `외부계약 필요 — director 범위 밖` / `전담 에이전트 부재 — 신설 요청` / `Sensitive — 사람 리뷰 전 merge 금지`. 신규 `autopilot 위임 필요 — 호출자 실행`과 접두 충돌 없음 |
| 2 | reviewer·evaluator에 `Agent`가 원래 없어 깊이 제한 손실이 없다 | **verified** | frontmatter 실측 — `Agent`를 가진 에이전트는 `pm`·`autopilot`·`business-director` 3종뿐. reviewer·evaluator·marketer·finance·researcher·customer-support 전부 미보유 → 3층에 놓여도 잃을 것이 없다 |
| 3 | `autopilot-budget-rationale.md` 갱신 불필요(드리프트 419B < 허용 512B) | **verified** | `wc -c autopilot.md` = 19,015 B, 사유서 :5 변호분 18,596 B → 419 B. `RATIONALE_DRIFT_TOLERANCE_B = 512` 이내. `check-assets` 실행 출력도 `INFO [BUDGET_RATIONALE_OK]` |
| 4 | pm·marketer·finance·researcher·customer-support 영향 없음 | **verified** | `git diff --name-only`에 5파일 모두 미포함. 5개 파일 본문에 `business-director` 언급 0건이라 director 쪽 변경이 반대편 서술을 낡게 만들 자리가 없다. `autopilot.md`만 짝으로 갱신됐고 그것이 옳다 |
| 5 | 깊이 예산 계산(3층·한계층 `Agent` 회수) | **verified** | `docs/anthropic/agents/sub-agents.md:983` 원문 — "a subagent can spawn subagents of its own, **up to three layers below the main conversation**. At the depth limit, Claude Code **withholds the `Agent` tool** from every subagent except a fork". 같은 파일 :408도 도구 필터 조건으로 재확인. 구(舊) 경로 main→director(1)→autopilot(2)→**PM(3, 회수)**로 위임 불가, 신 경로 main→autopilot(1)→PM(2, 보유)→전문가(3, 잎)로 성립 — 본문 서술과 정확히 일치 |

**제품 본문 저작 규율** — 식별자(8자리 hex·ULID) 0건, 커밋 해시·날짜 도장·버전 언급 0건, 이관 경위 서술 0건. 본문에 자주 나오는 "라운드"는 전부 자율 루프의 **회차**를 뜻하는 도메인 용어이고 프로젝트 이력 서술이 아니다. 신규 스킬 description에도 id·경위 없음.

**PM 영역 불가침** — `malgn-agent/README.md`·`.claude-plugin/plugin.json`·`.claude-plugin/marketplace.json`·`CLAUDE.md`·`scripts/validate-agent-assets.mjs`·`docs/refactor/*-budget-rationale.md` 전부 diff에 없다. 경계 준수 확인.

## 3. 크기 초과 정당성 (+9,122 B, 계획 +2,500~3,000 B 대비 3배)

기준은 "1순위 성능, 2순위 토큰 효율"이다. 라인 수가 아니라 **그 문장이 빠지면 무엇이 깨지는가**로 갈랐다.

**정당한 증분 (대부분)** — 실행 주체가 바뀌면 그에 딸린 분기가 **여러 자리**에서 같이 바뀌어야 하고, 한 자리만 고치면 다른 경로로 들어온 회차가 옛 지시를 따른다. 실제로 여덟 자리가 전부 갱신됐다: 위임 지도 표(:35) · 신설 절(:50-58) · OBSERVE 재개(:129) · DELEGATE ⓐ/ⓑ 분기(:136-138) · VERIFY 대조 시점(:139) · RECORD·CONTINUE 종료(:141-142) · 자기검증 3항(:187·:188·:190) · 산출물 압축 예외(:202). 특히 **"압축 대상에서 제외하고 그대로 싣는다"(:202)** 는 빠지면 2분 요약 규칙이 위임문을 깎아 다음 층의 등급 판정 근거를 없애므로 승인 우회로 직결된다. 승인 게이트 관련 증분(:58·:118·:122)도 전부 "읽는 시점이 한 라운드 늦어진다"는 사실이 낳는 실제 분기라 압축 대상이 아니다.

**압축 후보 (실재, 비차단)** — 아래 §5 개선안 1~2 참조. 총 300~500 B 수준이라 초과분 9,122 B의 설명을 뒤집지는 않는다.

**남는 비용 사실** — `business-director.md`가 60.5 KB로 플러그인 최대 에이전트 MD 지위를 굳혔다(pm.md 41.3 KB). 상시 비용이며 호출마다 전량 로드된다. 이번 증분 자체는 정당하나 누적 총량은 별도 관리 대상이다.

## 4. 병합 전 PM 동반 처리 (3건, 전부 PM 편집 구역)

1. **`check-assets` ERROR 3** — 신규 스킬로 스킬 수가 41→42가 되어 `malgn-agent/README.md`(2곳)·`malgn-agent/.claude-plugin/plugin.json`의 "스킬 41종" 표기가 실물과 어긋난다. 이 저장소 기준선은 ERROR 0이므로 **병합 차단 사유**다. 루트 `CLAUDE.md` Architecture의 "`skills/` 41종"도 같이 올린다(`pnpm run check-docs` 대상).
2. **`BUDGET_RATIONALE_DRIFT` 신규 WARN 1건** — `docs/refactor/business-director-budget-rationale.md`가 변호하는 51.6 KB를 9,122 B 초과. 사유서 실측치 갱신 + 이번 증분이 왜 압축 대상이 아닌지 1~2줄(위 §3 요지)을 추가한다. base는 `BUDGET_RATIONALE_OK`였으므로 이번에 유입된 WARN이다.
3. **실행 검증 재현 2건** — evaluator가 `Agent`를 갖지 않아 직접 띄울 수 없다. PM이 대신 스폰해 결과를 확인한다.
   - **정상경로**: 개발 목표가 포함된 사업 위임으로 `business-director`를 1회 호출 → 반환문 **첫 줄**이 `⚠️ autopilot 위임 필요 — 호출자 실행`인지, 위임문 전량·목표 제목 1줄·호출자가 할 일 3줄이 **요약 없이** 실렸는지, director가 `Agent`로 autopilot을 띄우지 않고 턴을 끝냈는지.
   - **경계/오용경로**: 사람 기록에 자율 범위가 없는 목표를 주고 호출 → 요청을 반환하지 **않고** 보류하는지(`:138`), 그리고 사업 게이트 ①④에 걸리는 목표를 주면 relay 마커가 아니라 `⚠️ 사람 승인 대기 — 미실행`으로 멈추는지(마커 오용 방지, `:190`).

## 5. 개선안 (trainer 이월 — 비차단)

1. **깊이 설명의 이중 보유** — `business-director.md:52`와 `SKILL.md:12`가 깊이 제한 근거를 거의 같은 문장으로 각각 들고 있다(각 ~230 B). 둘은 독자가 달라 한쪽을 지울 수는 없지만, **상시 비용인 MD 쪽을 한 문장으로 줄이고 전체 근거는 조건부 비용인 스킬에 두는** 방향이 비용 구조에 맞는다.
2. **[r2 철회] 스킬 description 압축** — 근거였던 "556자"가 바이트를 문자로 오독한 것이었다. 실제 276자로 기준 안이라 이 개선안은 성립하지 않는다.
3. **relay 스킬 단계 3의 `projectId` 조달처 부재** — `SKILL.md:43`이 호출자에게 `work_record`를 남기라고 지시하는데 그 도구의 필수 파라미터 `projectId`를 어디서 얻는지가 없다. 대상 프로젝트 `STATUS.md` 상단 `project_id`를 쓴다는 한 구가 필요하다(없으면 호출자가 값을 지어내거나 기록을 포기한다).
4. **호출자가 최상위라는 전제의 명시** — 이 해법은 호출자가 **메인 대화**일 때만 예산이 맞는다. director가 서브에이전트로 호출된 상황이면 autopilot이 2층이 되어 PM이 다시 3층에서 `Agent`를 잃는다. `business-director.md:25`가 "호출자: 사용자 직접(최상위)"로 이미 막고 있으나, `SKILL.md:12`에도 "당신이 메인 대화일 때 성립한다" 한 구를 붙이면 스킬만 읽고 진입한 경로에서도 전제가 보인다.
5. **깊이 3층이 기본값이라는 사실** — 원문(`sub-agents.md:987`)은 `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`로 조정 가능하다고 적는다. 본문은 "세 층까지만"을 불변 사실로 서술한다. 안전측(더 막는 방향)이라 결함은 아니므로 고치지 않아도 되나, 고친다면 "기본값 세 층" 한 단어면 된다.

## 6. Scorecard (대상: trainer — 이 산출물을 만든 주체)

총점은 `malgn-agent/bin/calc-training-scorecard.mjs`로 계산했다(암산 아님).

| 구성요소 | 점수 | 비고 |
|---|---|---|
| 기본수행 60% | 83 | 요구사항이해 14/15 · 변경범위 12/15 · 정확도 **24/25** · 검증품질 **13/20** · 리스크인지 8/10 · 보고명료성 9/10 · 산출효율 3/5 |
| Eval Set 25% | 70 | 깊이계산 pass · 안전장치 보존 pass · 신규스킬 설계 partial · 저작 규율 pass · **실행 검증 fail** |
| 실전 성공률 10% | 60 | 최근 위임 5건 중 1차 승인 3건 |
| 비용 효율 5% | 100 | 통독·반복 재확인·전체 재작성 0건 |
| **최종** | **78.3** | 지난 회차 79.9 → **-1.6, 정체** |

**강점**: 정확도 24/25. 다섯 개 주장 전부가 실물 대조에서 그대로 참이었고, 특히 깊이 예산 서술이 공식 원문과 문면 수준에서 일치한다. 해법 선택도 옳다 — 중간 계층(autopilot)을 건너뛰어 깊이를 줄이는 대신 **실행 주체를 호출자로 올려** 안전장치를 전부 보존했다. 정본을 고치면서 그 규칙을 요약·인용하는 형제 자리 여덟 곳을 같은 커밋에서 전부 갱신한 것은 직전 회차 개선안 ③이 지적한 재발 패턴의 **해소**다.

**약점**: 검증 품질 13/20. 이번 결함의 정의 자체가 "문서를 읽어서는 안 보이고 실제 스폰해야 드러난다"인데, 그 결함의 수정본이 또 실제 스폰 없이 문서 판정만으로 올라왔다. 세 회차 연속 이월이다. 구조적 제약(evaluator `Agent` 미보유, 병합 전 설치본 부재)이 실재하므로 신규 반려 사유로는 올리지 않되, **다음 회차에도 같은 사유로 이월되면 그때는 감점이 아니라 게이트 항목으로 다룬다.** 리스크 인지 8/10은 신규 스킬이 스킬 수 표기 3곳을 깨뜨려 `check-assets` ERROR 3을 만든다는 사실을 반환문에서 예고하지 않은 것 — PM 구역이라 고치지 않는 것은 맞으나, 알리는 것은 trainer의 몫이다.

---

# r2 재판정 — reviewer Red 수리 반영 (커밋 `8c2f7dd`)

- 범위: `git diff 1cfd304 8c2f7dd`. 최종 크기 `business-director.md` 64,481B · `autopilot.md` 19,273B · `SKILL.md` 9,638B.
- 종합: **조건부 PASS 유지 — merge 보류.** 문서 게이트는 r1보다 강해졌다(reviewer Critical 1·Major 3이 실제로 닫혔고 회귀 0건). merge를 막는 것은 이제 **사람 승인 + PM 구역 잔여 3건**뿐이다.
- 판정자: evaluator / 판정일: 2026-09-21

## r2-1. reviewer 지적 폐쇄 재대조

| # | 지적 | 판정 | 실물 근거 |
|---|---|---|---|
| **C-1** | 상관 핸들을 기록에 심는 주체가 없다(계약 체인 단절) | **닫힘** | 체인 네 마디가 전부 실재한다 — ①발급: `business-director.md` 상관 핸들 불릿이 `<목표 제목> #<라운드 서수>` 형식과 서수 채번 규칙을 정의 ②전달: `SKILL.md` 단계 1이 "문자열 그대로 포함" ③**기록: `autopilot.md` RECORD에 "위임문에 상관 핸들이 실려 왔으면 `title`에 그 문자열을 그대로 쓴다" 신설** — r1에 없던 이 한 줄이 계약의 연결 고리다 ④검색: `SKILL.md` 단계 3이 "핸들로 검색해 걸리는지"로 바뀌고 안 걸릴 때만 호출자가 보강. C-1이 지적한 역설(열화 경로만 튼튼)도 해소됐다. 스키마 적합성 재확인 — `work_record.title` 200자, `project_search_history.query` 200자로 핸들이 양쪽에 들어간다 |
| **M-1** | 깊이 복원이 "호출자=메인 대화"일 때만 성립하는데 전제가 없다 | **닫힘** | 네 자리에 실재 — `business-director.md` 신설 문단(최상위가 아니면 요청 반환문에 전제를 명시) · `SKILL.md` 단계 1 머리 · 양쪽 자기검증. 특히 reviewer가 짚은 실패 경로 ②(메인이 릴레이를 `pm` 서브에이전트에 재위임)를 `SKILL.md` 단계 1이 **`pm`을 이름으로 지목해** 막는다. 가드가 결정이 내려지는 자리에 놓여 있어 유효하다 |
| **M-2** | 핸들에 라운드·완료 구분자가 없다 | **닫힘** | R-3 방식 채택. 서수가 라운드를 가르고, director 자신의 인계 기록은 `title`을 `<핸들> — 인계`로 적어 결과 기록과 구분된다. 선별 규칙이 OBSERVE·RECORD·자기검증 세 자리에 일관되게 적혔다(`— 인계`는 출발점, 나머지가 결과). 접미사 판정을 "title 끝"으로 규정해 제목 안의 em-dash와도 충돌하지 않는다 |
| **M-3** | 스킬 1종 신설이 개수 서술 4곳에 미전파 | **부분 — trainer 몫 닫힘, PM 몫 1건 잔존** | `README.md` 2곳·`plugin.json` 갱신 → `check-assets` **ERROR 0 복귀**(실행 확인). 그러나 **루트 `CLAUDE.md`:148의 "`skills/` 41종"이 남아 `check-docs`가 2/3 FAIL**이다. reviewer가 이 한 곳을 PM 몫으로 배분했으므로 trainer 반려 사유가 아니다 |
| m-1~m-4 | 지시 충돌 4건 | **전부 닫힘** | m-1: autopilot 정지 마커를 호출자가 "그 자리에서 사람에게 올린다"로 고쳐 SKILL 단계 2와 일치 · m-2: 중단 목록의 인계 항목에 "게이트 정지 절차가 아니라 반환 형식을 따른다" 괄호 추가 · m-3: "**기본값으로** 세 층" 한정 추가 · m-4: `SKILL.md`의 깊이 서술을 결론 1문장 + 정본 포인터로 축약 |
| m-5 · n-1 · n-2 | 사유서 · 중복 · 잔존 서술 | m-5 PM 잔존 · n-1 대체됨 · n-2 닫힘 | n-1(상관 핸들 불릿 삭제 권고)은 그 불릿이 이제 형식 정의·서수 규칙·autopilot title 계약을 단독으로 지므로 삭제 대상이 아니다 — 무시가 아니라 대체다. n-2는 자기검증에 "(autopilot은 기록으로 읽은 결과다)" 삽입으로 닫힘 |

**m-4가 제 r1 개선안 1을 뒤집은 것은 타당합니다.** 저는 비용 구조(상시 vs 조건부)를 근거로 "MD를 줄이고 스킬에 근거를 두라"고 했는데, reviewer는 정본 단일화를 근거로 반대 방향을 제시했고 그쪽이 이 저장소의 상위 규율입니다. 결과물(스킬 = 결론 1문장 + 정본 포인터)은 두 목적을 다 만족합니다.

## r2-2. 새 주장 claimed↔verified

| 주장 | 판정 | 근거 |
|---|---|---|
| 자기 인계 기록을 `— 인계` 접미사로 구분한다 | **verified** | RECORD·OBSERVE·자기검증 세 자리에 같은 규칙이 모순 없이 실재 |
| `check-assets` ERROR 0 | **verified** | 직접 실행 — `ERROR 0 · WARN 17 · INFO 8` |
| description 269자 | **verified** | 269자 / 537바이트. r1의 "556자"는 제가 바이트를 문자로 오독한 것이며 실제는 276자였다 — 정정 |
| 제 개선안 3(`projectId` 조달처) 반영 | **verified** | `SKILL.md` 단계 3에 "`projectId`는 대상 프로젝트 `STATUS.md` 상단의 `project_id`에서 읽는다(기억하거나 새로 만들지 않는다)" |
| 제 개선안 5("기본값 세 층") 반영 | **verified** | `business-director.md`에 "기본값으로", `SKILL.md`에 "기본 상한이 있어" |

**회귀 0건** — 이식성 0건 · 식별자/날짜/커밋 0건 · hub 미존재 도구 0건 · 새 인용 경로(`${CLAUDE_PLUGIN_ROOT}/agents/business-director.md`) 실재 · 9단 골격 8개 `##` 유지 · 스킬 도달 수 불변(1 → 무접두어 유지).

## r2-3. `autopilot-budget-rationale.md` 재계산 — **갱신 필요(신규)**

`autopilot.md` 19,273B − 사유서 변호분 18,596B = **677B 초과**. `RATIONALE_DRIFT_TOLERANCE_B = 512`를 넘었으므로 r1의 `INFO [BUDGET_RATIONALE_OK]`가 이번에 **`WARN [BUDGET_RATIONALE_DRIFT]`로 전환**됐다(실행 출력 확인). r1 시점 여유는 93B뿐이었고 이번 +258B가 그것을 넘겼다. 사유서 실측치를 19,273B로 갱신하고 "상위 루프가 넘긴 상관 핸들을 `work_record.title`에 그대로 쓰는 계약" 1줄을 항목에 추가하면 닫힌다(`docs/refactor/`라 PM 구역).

## r2-4. 병합 전 PM 처리 — 3건 (전부 PM 편집 구역)

1. 루트 `CLAUDE.md`:148 "`skills/` 41종" → 42 (`check-docs` 2/3 → 3/3)
2. `docs/refactor/autopilot-budget-rationale.md` 실측 18,596 → 19,273B **(신규)**
3. `docs/refactor/business-director-budget-rationale.md` 실측 → 64,481B (변호분 51.6KB를 11,610B 초과)

`malgn-agent/README.md`·`plugin.json`은 이번 라운드에 trainer가 처리해 닫혔다 — 제가 r1에서 이 둘을 PM 몫으로 분류했으나 reviewer의 배분(배포물이므로 trainer)이 더 정확했다.

## r2-5. 실행 스폰 검증 — 구조적 유예

이 항목은 판정 체크리스트상 여전히 미충족이나, **신규 회피가 아니라 이미 세 차례(autopilot·business-director·customer-support 신설) 같은 사유로 수용된 동일 제약**이다: 워크트리 초안은 설치본에 없어 라이브로 띄울 수 없고, evaluator에는 `Agent`가 없다. 따라서 **trainer 감점 사유로 쓰지 않고**(Eval Set 역량에서 제외) 게이트에는 "구조적 유예 — 배포 후 스모크테스트로 이월"로 표기한다.

유예의 조건은 그 스모크테스트가 실제로 잡혀 있다는 것이다. `STATUS.md`에 이미 "배포 후 autopilot·business-director·customer-support 실제 스폰 스모크테스트 — PM 관측 필요"가 있으므로, **그 줄에 이번 relay 경로(정상경로 첫 줄 마커·위임문 무손실 / 경계경로 자율범위 부재 시 보류·게이트 걸린 건의 마커 분리 / 최상위 아닌 호출자의 에스컬레이션)를 추가**하면 유예가 관리 대상으로 남는다. 이 한 줄이 없으면 유예는 소멸이 된다.

## r2-6. Scorecard 재채점 (대상: trainer)

| 구성요소 | r1 | r2 | 비고 |
|---|---|---|---|
| 기본수행 60% | 83 | **89** | 검증품질 13→16(`check-assets`를 직접 돌려 ERROR 0을 확인하고 반환문에 실었다) · 리스크인지 8→9 · 요구사항이해 14→15 |
| Eval Set 25% | 70 | **87.5** | 4역량(실행검증 제외) — Critical/Major 폐쇄 pass · 계약 체인 무결성 pass · 정본 전파 pass · 정적검사 자기확인 **partial** |
| 실전 성공률 10% | 60 | 66.7 | 4/6 |
| 비용 효율 5% | 100 | 100 | 재작업 0 |
| **최종** | 78.3 | **86.95** | **+8.65, 상승** |

**강점**: reviewer가 제시한 두 선택지 중 R-3(서수 포함 기계발급 슬러그)을 골라 C-1과 M-2를 한 수정으로 동시에 닫았다. 필터 조건을 덧붙이는 대안이었다면 M-2만 닫히고 C-1의 "심는 주체 부재"는 그대로 남았을 것이다. 전파도 정확하다 — 핸들 형식 변경이 위임지도·반환형식·상관핸들 불릿·OBSERVE·DELEGATE·RECORD·세션전환·자기검증 2곳까지 일관되게 반영됐고 옛 표현("목표 제목 1줄")의 잔존이 0건이다.

**약점(Eval Set partial의 실체)**: `check-assets`는 직접 돌려 확인했으나 **`check-docs`를 돌리지 않아** 루트 `CLAUDE.md` 잔존을 스스로 잡지 못했다. reviewer가 M-3 개선안에 "병합 전 `check-assets`·`check-docs` 둘 다 통과를 확인"이라고 명시했는데 한쪽만 실행했다. 같은 성격으로, `autopilot.md`를 +258B 늘리면서 사유서 드리프트가 허용치를 넘는다는 사실을 예고하지 않았다 — r1 판정문이 "419B"를 명시했으므로 남은 여유가 93B뿐임은 계산 가능했다.

**개선안(다음 라운드)**: 정적검사를 근거로 삼을 때는 `check-assets`·`check-docs`·`check-links`를 **세트로** 돌리고 그 결과를 반환문에 함께 싣는다 — 한쪽만 돌리면 이번처럼 "ERROR 0"이 사실이면서도 다른 게이트가 열린 채 남는다. 그리고 MD 크기를 늘리는 변경은 직전 판정문에 적힌 드리프트 잔여 여유와 대조해 초과 여부를 미리 알린다.
