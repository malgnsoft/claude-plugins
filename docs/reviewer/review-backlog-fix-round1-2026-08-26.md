# 백로그 6건 수정 초안(backlog-fix-round1) 리뷰 보고서

리뷰 페르소나 패널 (4명, 신규 0 · 재사용 4):
- `docs/reviewer/personas/persona-spec-implementation-conformance-auditor.md` (수렴)
- `docs/reviewer/personas/persona-script-skill-consistency-auditor.md` (수렴)
- `docs/reviewer/personas/persona-field-executability-officer.md` (수렴)
- `docs/reviewer/personas/persona-process-mechanism-zero-based-challenger.md` (**발산**)

리뷰 대상: 워크트리 `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-a25517764b2b562ba`, 브랜치 `backlog-fix-round1`, `43f2040..c58d8e8` (7파일 +187/−10)
리스크 범주: 전역 자동실행 자산(전 직원 배포 플러그인 본문 + 훅) + 빌드 검사 스크립트
작업 등급: Sensitive (풀패널)
리뷰 일자: 2026-08-26
target_id: `backlog-fix-round1` (최초 리뷰 — PM 위임에 재검토 3요소 미포함이므로 풀패널로 처리)

**종합 판정: 🟡 Amber**
Critical 0 · Major 1 · Minor 5 · Nit 3 · Rethink 3 · 기각/강등 4

---

## 요약 (2분 규칙)

**6건의 수용 기준은 전건 착지했고, 스코프 밖 파일 변경 0건이다.** 신규 픽스처 검사는 PASS 4·FAIL 0, `check-docs` exit 0, `check-assets` ERROR 0을 유지한다. 병합을 막는 Critical은 없다.

다만 **이 커밋이 검사기에 새 WARN 1건을 유입시켰다** — `agents/evaluator.md`가 21,353 B → 23,307 B로 커지면서, 바로 직전 커밋이 실측 갱신해둔 예산 사유서(21,353 B)를 1,954 B 초과해 `BUDGET_RATIONALE_DRIFT`로 전환됐다(허용오차 512 B의 3.8배). 늘어난 분량 자체는 성능 기여가 실증되므로 "줄여라"가 아니라 "사유서를 같은 라운드에 갱신하라"가 맞는 조치이며, 대상 2파일 모두 PM 직접 편집 허용 구역이다.

---

## 페르소나 재사용 판정 (§6 산출물 게이트)

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 역할개념 열만 스크리닝했다. **신규 0건 — 4개 전부 재사용.**

| 페르소나 | 재사용/신규 | 사유 (INDEX 대조 근거) |
|---|---|---|
| persona-spec-implementation-conformance-auditor.md | **재사용** | INDEX 역할개념 "명세를 계약서, 커밋을 납품물로 놓고 조항을 1:1로 대조" — 이번 위임의 핵심(6건 수용 기준 ↔ 실제 착지)과 동일 |
| persona-script-skill-consistency-auditor.md | **재사용** | INDEX 역할개념 "문서가 서술하는 약속(옵션·임계값·근거)과 코드 구현이 실제로 정확히 일치하는지 한 줄씩 대조" — doc-drift 헤더 사양 ↔ 코드, hub 스키마 ↔ 문면 대조가 그대로 이 개념 |
| persona-field-executability-officer.md | **재사용** | INDEX 역할개념 "지금 당장 실행 가능한 구체 절차인지" — 신설 grep 명령·판정축 대입 가능성 검증이 동일 개념 |
| persona-process-mechanism-zero-based-challenger.md (**발산**) | **재사용** | INDEX 역할개념 "도입한 메커니즘 전체가 문제 크기에 비례하는지, 더 단순한 개입으로 같은 효과를 낼 수 있는지" — "이 6건 묶음·픽스처 스크립트·체크리스트 배치가 애초에 옳은가"가 동일 개념 |

신규 페르소나를 만들지 않은 이유: 이번 라운드의 리스크 표면(제품 본문 문면 정합 · 훅 사양-구현 정합 · hub 스키마 정합 · 검사 스크립트)이 전부 기존 4개 역할개념 안에 들어간다. 새 서사를 쓸 이유가 없어 회전문 페르소나(§7 안티패턴)를 피했다. 4개 파일 하단 "적용 이력"에 이번 라운드 항목을 append하고 INDEX.md "최근 재사용" 열을 갱신했다.

---

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| RV-201 | 🟠 Major | 명세-구현 정합 | `scripts/validate-agent-assets.mjs:81-84` ↔ `malgn-agent/agents/evaluator.md` | `wc -c` 실측(base 21,353 → branch 23,307) + `node scripts/validate-agent-assets.mjs` 실행 | 이 커밋이 evaluator.md를 +1,954 B 늘려 예산 사유서 등록치(21,353 B, 허용오차 512 B)를 초과 → 베이스의 `INFO [BUDGET_RATIONALE_OK]`가 `WARN [BUDGET_RATIONALE_DRIFT]`로 전환. **검사기에 새 WARN 1건 유입** | `docs/refactor/evaluator-budget-rationale.md` 실측치와 `validate-agent-assets.mjs`의 `bytes: 21353`을 23307로 갱신 + 늘어난 두 문면(점수 왕복·접두어 게이트)이 왜 상시 비용으로 정당한지 1~2줄 추가. 두 파일 모두 PM 직접 편집 허용 구역 |
| RV-202 | 🟡 Minor | 실행가능성 | `package.json:8` | `node scripts/validate-agent-assets.mjs; echo $?` → EXIT=0 (WARN 19 상태), `&&` 의미론 | 앞 스크립트가 ERROR 1건이라도 내면 exit≠0이 되어 `check-doc-drift-spec.mjs`가 **아예 실행되지 않는다**. 두 검사는 서로 독립인데 무관한 ERROR가 사양-구현 드리프트 검사를 통째로 가린다. (현재는 WARN만 있어 exit 0 → 정상 동작 확인) | 둘 다 실행하고 종료코드를 OR하는 형태로 바꾸거나, 최소한 `CLAUDE.md` Commands 절에 "ERROR가 있으면 drift-spec은 실행되지 않는다"를 명시. 완화 요인: `check-drift-spec` 별칭이 함께 추가돼 단독 실행 경로는 존재 |
| RV-203 | 🟡 Minor | 실행가능성 | `malgn-agent/agents/trainer.md:124` | 저장소 루트에서 해당 grep을 그대로 실행 → `warning: agents/: No such file or directory`(skills/·knowledge/ 동일) | 수용 기준이 "**실행 가능한** 지시"인데 상대경로가 `agents/ skills/ knowledge/`라 복붙 실행이 실패한다(실제 경로는 `malgn-agent/` 하위). 인접 항목·`evaluator.md:62`도 같은 관례라 신규 결함이라기보다 관례 답습이나, 이번 항목만 실행가능성을 명시적 수용 기준으로 갖는다 | `malgn-agent/agents/ malgn-agent/skills/ malgn-agent/knowledge/`로 적거나 "플러그인 루트 기준" 한 마디 병기 |
| RV-204 | 🟡 Minor | 스키마 정합 | `malgn-agent/knowledge/leadership/agent-training-guide.md:458` | `agent_get_context(agentName:"evaluator", scoreHistoryLimit:3)` **라이브 호출** → `{"agentName":"evaluator","latestScore":null,"scoreHistory":[],"recentLearnings":[]}` (최상위 `overallScore` 없음). 기존 정본 `skills/domain-training-scorecard-eval/SKILL.md:97`과 문면 대조 | 새 문장이 "조회한 최신 `overallScore`"로 한정어 "기록의"를 빠뜨려, 응답 **최상위**에 그 필드가 있는 것처럼 읽힌다. 이미 미해결 백로그로 올라 있는 부정확 표현을 **두 번째 자리에 복제**한 셈 — CLAUDE.md [변경이력 관리 원칙]의 "정본 고칠 때 참조처 전체 grep"과 반대 방향 | `latestScore`를 명시하거나 SKILL.md:97과 동일 문면("최신 **기록의** `overallScore`")으로 맞춘다. 백로그의 원 지적과 **같은 라운드에서 두 자리를 함께** 고치는 것이 최선 |
| RV-205 | 🟡 Minor | 스키마 정합 | `malgn-agent/agents/evaluator.md:124`, `:138` | `agent_score_record` 스키마 원문(ToolSearch): properties = agentName/dimensionScores/evaluatorNote/idempotencyKey/improvementNote/overallScore/projectId, `additionalProperties:false`. `previousScore` 실소재는 `bin/calc-training-scorecard.mjs:59`·`skills/domain-training-scorecard-eval/SKILL.md:93` | `:138`의 신설 문장이 `agent_score_record` 필드 규칙 문단 **끝에** 붙어 있어 `previousScore`가 그 도구의 파라미터처럼 읽힌다. 그렇게 호출하면 `additionalProperties:false`로 거절된다 | 양쪽에 "(`previousScore`는 Scorecard 입력 JSON 필드 — hub 파라미터가 아니다)" 한 마디 병기 |
| RV-206 | 🟡 Minor | 실행가능성 | `malgn-agent/agents/evaluator.md:62` | 38종 중 표본 9종에 새 문면 **실제 대입**(아래 검증표) + `grep -rl` 실측 | (a) "판정축은 grep 히트 수가 아니라 비용 구조"라고 강하게 부정한 뒤 신설 스킬은 여전히 "5개 이상/2~4개/1개" 숫자 구간으로 정한다 — 실제로 바뀐 건 판정축이 아니라 **세는 범위**(1경로→3경로 합산)라 읽는 evaluator가 흔들린다. (b) 경로 ①②는 grep 명령이 명시돼 재현 가능하지만 경로 ③은 **검색어가 지정되지 않아** 사람마다 다른 수가 나온다 — `common-product-principles-reference`는 ①=1·②=0이라 **경로 ③에만 의존**해 통과한다 | (a) "판정축이 아니라 도달 범위를 3경로 합산으로 센다"로 문면 정리. (b) 경로 ③에 검색어 지정 규칙 1줄 추가(예: "그 스킬 SKILL.md가 정본으로 지목한 문서/파일명을 검색어로 쓴다") |
| RV-207 | ⚪ Nit | 명세-구현 정합 | `scripts/check-doc-drift-spec.mjs:55`, `:67`, `:153`, `:115` | 파일 정독 + `node scripts/check-doc-drift-spec.mjs` (PASS 4·FAIL 0) | **하드코딩 아님이 우세**(아래 판정 참조). 잔여 결합 3곳: `:55` 단락 앵커 `'측정 불가(경로 없음'` 산문 고정, `:67` `exit N로 종료` 어순 고정, `:153` `'✅ B: 문서=3 실측=3'` — 헤더에서 읽지 않은 **CLI 출력 서식**을 그대로 박아둔 유일한 자리. 그 외 `:115 runFixture(name, files)`의 `name` 미사용 | `:153`만 `/✅\s*B:/`류 느슨한 매칭으로 완화하면 목적 손실 없이 결합이 준다. `:55`·`:67`은 실패 시 원인을 설명하는 메시지가 있어 조용한 실패가 아니므로 그대로 둬도 무방 |
| RV-208 | ⚪ Nit | 명세-구현 정합 | `scripts/check-doc-drift-spec.mjs:78-82` | `grep -rn "computeDrift" malgn-agent/ scripts/ package.json` → 소비자는 `hooks/doc-drift.mjs`(CLI) + `hooks/sessionstart-context.mjs` **둘뿐**(헤더의 "소비자는 둘" 단정은 현재 정확) | 탐지가 `readdirSync(HOOKS_DIR)` **비재귀** + `.mjs` 한정이라, 장래 소비자가 `bin/`·`hooks/lib/`·`.cjs`에 생기면 헤더의 "둘" 단정이 틀려도 검사가 못 잡는다 | 탐지 루트를 `malgn-agent/` 전체 `.mjs\|.cjs`로 넓히거나, 그 한계를 스크립트 헤더에 1줄 명시 |
| RV-209 | ⚪ Nit | 스키마 정합 | `malgn-agent/skills/topic-learning/SKILL.md:111`, `skills/agent-upskill/SKILL.md:21` | `agent_learning_record` 스키마 원문: required = agentName, **type, title, content, idempotencyKey** | 요구했던 **대칭은 회복됨**(문면이 자매 스킬과 동형). 다만 양쪽 다 `title`·`content`·`idempotencyKey`를 빠뜨려 적힌 대로만 호출하면 거절된다 | 이번 스코프 밖 잔여 — 두 파일을 같은 라운드에 함께 고칠 때 required 3개 병기 |

---

## 6건 수용 기준 충족 현황 (계약서 ↔ 납품물 1:1)

| 요구 | 착지 위치 | 확인방법 | 충족 | 비고 |
|---|---|---|---|---|
| **[1군-①]** 기록주체 수정 시 도구명 전수 grep 절차화 | `agents/trainer.md:124` | 원문 정독 + 명령 실행 | ✅ | 실행 가능한 지시 + 구체 grep 명령 + "소진 후에야 완료 보고" 게이트 문면 존재. **배치 판정**: `trainer.md`는 매 호출 전량 로드라 도달은 확실하나, 절 제목이 "자기 검증(보고 전 필수)"이라 **사후 게이트**다 — "먼저 목록을 만든다"는 지시가 사후 자리에만 있어 재작업으로만 닫힌다(🔵 Rethink 3). 상대경로는 RV-203 |
| **[1군-②a]** 헤더가 소비자 2곳을 정확히 서술 | `hooks/doc-drift.mjs:63-67` | `sessionstart-context.mjs:89-105` **직접 Read**해 대조 | ✅ | 헤더는 "훅은 같은 판정식으로 경고 1줄만 붙이고 세션은 그대로 진행"이라 단정 — 실물 `:101`이 `!r.corrupted && !r.empty && r.results.length===0 && r.skipped.length>0`로 동일 판정식이고, `:105`가 `note`에 1줄만 할당하며 이후 세션을 중단시키지 않음. **서술과 동작 일치 확인.** `computeDrift` 소비자 전수 grep 결과도 정확히 2곳 |
| **[1군-②b]** 죽은 앵커 `(§ 실행 블록)` 실재화 | `hooks/doc-drift.mjs:364` | 스크립트 앵커 검사 PASS + 파일 확인 | ✅ | `// ===== § 실행 블록 =====` 마커 신설, 자기설명 주석("이 마커 문구를 바꾸면 그 참조가 죽는다") 동봉 |
| **[1군-②c]** 재발 방지 픽스처 검사 2종 | `scripts/check-doc-drift-spec.mjs` | `node scripts/check-doc-drift-spec.mjs` 실행 → PASS 4 · FAIL 0 · exit 0 | ✅ | 이전 라운드 검증 형태(`docs/reviewer/review-audit-r2-hooks-20260825-2차-2026-08-26.md`)와 대조: 그 라운드가 실측한 3사실(`allUnmeasurable` 판정식 / `⚠️ 모든 체크가 측정 불가` 문면 / `process.exit(... ? 1 : 0)`)을 **전부 커버하고 더 강하다** — 그때는 사람이 1회 대조했고 지금은 실행으로 상시 고정된다. 약화 지점 없음 |
| **[1군-③(1)]** "둘로 나눈다" 정정 | — | `git grep -n "둘로 나눈다" 43f2040` 전 저장소 | ✅ (해당 없음) | **PM 판단 독립 확인 완료**: 베이스에서 `malgn-agent/` 히트 0건, `docs/reviewer/` 2건(리뷰 기록)뿐. 이미 해소돼 있었고 이번 커밋의 대상이 아니다 |
| **[1군-③(2)]** trainer 자신의 학습 이력 기록 보완 | `skills/topic-learning/SKILL.md:111`, `:119` | `agent-upskill/SKILL.md:21`과 나란히 대조 | ✅ | 양쪽 문면이 동형("이번 …로 그 에이전트의 역량으로 남길 교훈이 생겼으면 `agent_learning_record`(agentName, type='experience')로 함께 남긴다") + 산출물 절에도 반영. **대칭 회복 확인.** `type='experience'`는 스키마 enum과 일치. 잔여는 RV-209 |
| **[1군-③(3)]** 조건부 PR URL 언급을 agent-upskill과 동일화 | `skills/topic-learning/SKILL.md:111` | 두 파일 문면 대조 + 단계 번호 실재 확인 | ✅ | 괄호 사유절("모르는 값을 채우려 재확인하러 돌아가지 않는다")까지 축자 동일. 단계 번호 차이(topic-learning 5단계 / agent-upskill 7단계)는 `## 실행 흐름` 헤딩 실측 결과 **각 파일에서 정확** |
| **[2군-①]** 접두어 게이트 판정축 교체 | `agents/evaluator.md:62` | 38종 중 표본 9종 실제 대입(아래 표) | ✅ | **오판정 3건 해소 확인, 정당 반려 0건.** 기존 6종 개명 없음(스코프 준수). 문면 흔들림·경로③ 재현성은 RV-206 |
| **[2군-②]** 점수 왕복을 완료 정의로 명시 | `agents/evaluator.md:124`, `:138` | 자기검증 절 신설 항목 확인 + hub 스키마 원문 대조 | ✅ | 읽기(`agent_get_context`)+쓰기(`agent_score_record`) 왕복이 "둘 다 닫혀야 그 회차가 완료"로 명시. `agent_get_context` 파라미터 `agentName`(required, minLength 1)·`scoreHistoryLimit`(integer 1~50) **스키마 원문과 정확히 일치**. 착수 시점 지시는 `domain-training-scorecard-eval/SKILL.md:97`에 이미 있어 이중 안전망. 잔여는 RV-205 |
| **[2군-③]** §6.4 ↔ §3.1 자기모순 해소 | `knowledge/leadership/agent-training-guide.md:441-442`, `:458`, `:205` | 문서 전체 훑기 + `grep -rn "이전 점수\|이후 점수" malgn-agent/` | ✅ | 필수 칸이 조회 가능한 값(Scorecard 총점)으로 치환되고 키워드 점수는 `(선택)`으로 강등 → §3.1 "키워드 점수는 보조 지표"와 정합. **연쇄 드리프트 0건**: 옛 3칸 양식을 전제한 잔존 서술 0건, §6.4 역참조는 `:205` 한 곳뿐이며 같은 커밋에서 "선택 항목"으로 함께 정정됨. `§5.7`·`§2.2` 앵커 실재 확인. 잔여는 RV-204 |

---

## [2군-①] 새 판정축 실제 대입 검증 (요청 항목)

새 문면을 38종 중 표본 9종에 실제로 대입했다. 도달 수는 `grep -rl`로 **distinct 파일 수**를 실측한 값이다.

| 스킬 | 접두어 | ①직접(agents) | ②knowledge 경유 | ③규율 대상 | **새 문면 판정** | 옛 문면 판정 |
|---|---|---|---|---|---|---|
| `common-output-storage-and-path-management` | common- | **1** (trainer) | `knowledge/common/agent-common-principles.md`가 정본 지목 → 그 문서를 참조하는 agent **16개** | — | ✅ PASS | ❌ FAIL (오판정) |
| `common-beyond-mediocre-output` | common- | **3** (qa-engineer, security, trainer) | 동일 knowledge(16 agents) | — | ✅ PASS | ❌ FAIL (오판정) |
| `common-product-principles-reference` | common- | **1** (trainer) | 0 | `docs/product-principles.md`를 본문에 실은 agent **12개** | ✅ PASS (**경로 ③에만 의존**) | ❌ FAIL (오판정) |
| `common-learning-loop-knowledge-management` | common- | **5** | 동일 knowledge(16 agents) | — | ✅ PASS | ✅ PASS (경계) |
| `common-verifiable-output-and-honesty` | common- | **5** | — | — | ✅ PASS | ✅ PASS |
| `domain-shipley-proposal-methodology` | domain- | **4** | — | — | ✅ PASS | ✅ PASS |
| `domain-reference-benchmarking-standard` | domain- | **3** | — | — | ✅ PASS | ✅ PASS |
| `domain-backend-api-security` | domain- | **3** | — | — | ✅ PASS | ✅ PASS |
| `a4-vertical-layout` | 무접두어 | **1** (presenter) | `knowledge/presentation/*` 2건 → 되짚으면 presenter 1개 | — | ✅ PASS | ✅ PASS |

**결론**: 요구한 대로 `common-*` 3종의 문면 위반 오판정이 해소됐고(위 3행), `domain-*`·무접두어 표본은 어느 쪽도 반려되지 않았다 — **"모호해서 아무거나 통과"도 "정당한 스킬 반려"도 관측되지 않았다.**

**안정성 리스크 2건 (RV-206으로 등재)**
1. **경로 ② 인플레이션 상한 실측**: `knowledge/README.md`는 스킬 18종을 나열하는 카탈로그다. 이를 경로 ②의 "정본 지목 문서"로 세면 나열된 모든 스킬이 README의 agent-도달을 상속한다. 실측 결과 README를 참조하는 agent MD는 **2개뿐**이라 1-agent 스킬이 5까지 부풀 수 없다 — **현재는 안전**하나 README 도달이 커지면 판정이 흔들린다. 문면에 카탈로그 문서 제외 규칙이 없다.
2. **경로 ③ 재현 불가**: 검색어가 지정되지 않았다. `common-product-principles-reference`는 이 경로에만 의존해 통과하는데, 내가 쓴 검색어(`product-principles`)를 다르게 잡으면 판정이 뒤집힌다.

---

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 명세-구현 정합 | topic-learning의 "둘로 나눈다" 서술이 아직 남아 있다 | **기각** | `git grep -n "둘로 나눈다" 43f2040` 전 저장소 실행 결과 `malgn-agent/` 0건, `docs/reviewer/` 2건(리뷰 기록)뿐. **PM 판단이 맞다** — 베이스 시점에 이미 해소돼 있었고 이번 커밋 대상이 아니다 |
| 이식성 | 제품 본문에 이력·식별자가 새로 유입됐다 | **기각** | 이번 diff의 `+` 라인 전량을 `\b[0-9a-f]{8}\b\|\b01[0-9a-hjkmnp-tv-z]{24}\b\|YYYY-MM-DD\|N차\|vX.Y`로 스캔한 결과 유효 히트 0건("1차 정본"은 회차 번호가 아니라 '일차 정본'의 뜻) |
| 이식성 | `hooks/doc-drift.mjs:392`의 `(RV-005)`가 조회 불가 식별자다 | **강등 🟠→⚪ + 스코프 밖** | `git show 43f2040:malgn-agent/hooks/doc-drift.mjs \| grep -n "RV-005"` → **이번 커밋 이전부터 :392에 존재**하며 이번 diff가 그 줄을 건드리지 않았다. 별도 백로그 항목으로만 기록 |
| 스펙 정합 | §6.4 옛 3칸 양식을 전제한 다른 절이 남아 있다(연쇄 드리프트) | **기각** | `grep -rn "이전 점수\|이후 점수" malgn-agent/` 0건, `§6.4` 역참조는 `:205` 한 곳뿐이고 그 줄도 같은 커밋에서 "선택 항목"으로 함께 정정됨. **연쇄 드리프트 없음** |

---

## 페르소나별 관점

### [명세-구현 적합성 감사관] — 판정: 🟡 Amber
계약서를 6건의 수용 기준, 납품물을 `43f2040..c58d8e8`로 놓고 1:1 대조했다. **6건 전건 착지 + 스코프 초과 0건** — `git diff --stat`의 7파일이 전부 6건의 대상 파일이고 지시 밖 변경 0건이다. [1군-③(1)]은 착지가 아니라 "베이스에서 이미 해소"였고 이를 독립 확인했다.

계약 외곽에서 1건을 잡았다: **납품물이 검사기 상태를 베이스보다 나쁘게 만들었다**(RV-201). 베이스 evaluator.md는 21,353 B로 등록치와 **정확히 일치**해 INFO였는데, 이 커밋이 23,307 B로 키워 WARN으로 전환됐다. 이 저장소는 직전 커밋에서 바로 그 등록치를 실측 갱신했으므로, 같은 라운드에 사유서를 동반 갱신하는 것이 확립된 관례다.

부수 확인: `check-docs` exit 0(agents 21·skills 38·knowledge 44 전건 일치, PM 관리구역 정상), `check-assets` ERROR 0.

### [문서-코드 정합성 감사관] — 판정: 🟡 Amber
"헤더가 단정한 것 ↔ 실물"을 한 줄씩 대조했다. **[1군-②]의 핵심 주장 3개가 전부 실물과 일치한다**: (1) 소비자 2곳 — `computeDrift` 전수 grep으로 정확히 doc-drift CLI + sessionstart-context 둘뿐임을 확인, (2) 훅의 실패 강도 — `sessionstart-context.mjs:101`이 동일 판정식이고 `:105`가 경고 1줄만 붙인 뒤 세션을 계속함을 **파일을 직접 열어** 확인, (3) 앵커 — `:364` 마커 실재.

hub 스키마는 기억이 아니라 **원문과 라이브 호출**로 대조했다. `agent_get_context`의 `agentName`·`scoreHistoryLimit`는 문면과 정확히 일치한다(RV-206 요구 충족). 다만 `agent_get_context` 실호출 응답이 `{agentName, latestScore, scoreHistory, recentLearnings}`라 최상위에 `overallScore`가 없는데, 새 문면이 한정어 "기록의"를 빠뜨려 **이미 백로그에 올라 있는 부정확 표현을 두 번째 자리에 복제**했다(RV-204). `previousScore`는 hub 파라미터가 아님을 스키마로 확인했고, 그 배치가 오독을 부른다(RV-205).

**미확인 명시**: `latestScore`/`scoreHistory` 원소의 **내부** 필드명은 이 계정에 점수 이력이 없어(둘 다 null·빈배열) 실측하지 못했다 — 추정하지 않고 미확인으로 남긴다.

### [현장 실행가능성 검사관] — 판정: 🟡 Amber
"이 지시를 읽고 지금 당장 실행할 수 있는가"만 봤다.

- **신설 픽스처 스크립트: 실행됨** — `node scripts/check-doc-drift-spec.mjs` PASS 4·FAIL 0·exit 0. 임시 디렉토리 픽스처를 만들어 실제 CLI를 spawn하므로 "읽으면 맞아 보인다"가 아니라 재현된다.
- **신설 판정축: 대입 가능** — 표본 9종에 실제로 대입했고 판정이 갈리지 않았다. 다만 경로 ③은 검색어가 없어 **다음 evaluator가 나와 같은 수를 낼 보장이 없다**(RV-206b).
- **신설 grep 명령: 실행 실패** — 저장소 루트에서 그대로 돌리면 세 경로 모두 "No such file or directory"다(RV-203). 수용 기준이 "실행 가능한 지시"를 명시했으므로 지적으로 올린다.
- **배치**: [1군-①]·[2군-②]가 모두 "자기 검증(보고 전 필수)" 절에 들어갔다. 점수 왕복은 `domain-training-scorecard-eval/SKILL.md:97`에 착수 시점 지시가 이미 있어 이중 안전망이지만, 기록주체 grep은 **사후 자리에만** 있다.

### [프로세스 메커니즘 제로베이스 도전자] — 판정: 🔵 (구조 제언 3건, 아래 섹션)
"이 6건 묶음이 애초에 옳은 개입인가"를 물었다. 결론: [1군-②]는 옳다 — 사람 규율을 **기계 검사로 대체**해 재발 경로를 실제로 끊었다. 반면 [1군-①]은 같은 문제를 다시 사람 규율(체크리스트)로 막았고, [2군-①]은 조건부로 쓰는 절차를 상시 비용 자리에 넣었다. 상세는 아래.

---

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| 1 | 접두어 게이트 판정 산식 전체(약 1,500 B — 3경로 정의·grep 명령 2개·예외조항)가 `agents/evaluator.md:62` 체크리스트 **한 항목에 인라인** | 체크리스트에는 판정 기준 1줄("상시/조건부 비용 구조와 일치하는가 — 도달은 3경로 합산")만 남기고, 산식·grep 명령·예외조항은 `skills/domain-training-scorecard-eval` 등 **조건부 비용 자리**로 이동 | 이 절차는 evaluator가 **스킬 신설/개명 심사 회차에만** 쓰는데 evaluator 호출 100%에 상시 로드된다. 이 저장소 원칙이 명시적으로 요구하는 상시/조건부 구분에 어긋나고, 이번 라운드가 만든 `BUDGET_RATIONALE_DRIFT`(RV-201)가 바로 그 비용을 눈에 보이게 드러냈다 | **낮음** — 문면 이동 1건. 리스크: 조건부 자리로 옮기면 evaluator가 그 스킬을 안 열면 안 읽힌다(체크리스트 1줄에 "상세는 Skill X"를 남겨 도달 보장 필요). 변경 동결 중이므로 **백로그** |
| 2 | [1군-①]의 재발 방지가 "도구명으로 전수 grep해라"라는 **사람 규율**(trainer 자기검증 체크리스트 1줄) | `scripts/`에 "기록 주체 서술 정합 검사" 1건 추가 — 4개 도구명이 등장하는 모든 자리에서 주체 명사(PM/trainer/evaluator)가 정본 표와 어긋나는 조합을 뽑아 WARN | 이번 백로그가 생긴 원인이 "문구 기반 grep이 사이트를 놓쳤다"인데, 대책이 같은 층위의 사람 규율이라 **안 하면 안 걸린다**. 같은 영역이 4차까지 왕복한 이력이 INDEX.md에 남아 있다. 바로 옆 [1군-②]는 동일한 종류의 문제를 스크립트로 닫아 재발 경로를 실제로 끊었다 — 성공 패턴이 같은 커밋 안에 이미 있다 | **중간** — 신규 검사 스크립트 1건. **미확인 추정치**: `validate-agent-assets.mjs`에 재사용 가능한 참조 파싱 유틸이 있는지는 이번에 확인하지 않았다(있으면 저비용일 수 있음). 리스크: 주체-도구 조합의 정본 표를 어디에 둘지 먼저 정해야 함. 변경 동결 중이므로 **백로그** |
| 3 | [1군-①]·[2군-②] 두 신설 항목이 모두 "자기 검증(**보고 전** 필수)" 절에 배치 | trainer/evaluator **실행 절차의 착수 단계**에 "대상 도구명 전수 grep으로 사이트 목록 먼저 만든다" 1줄을 두고, 자기검증은 그 목록의 **소진 여부만** 묻게 한다 | "먼저 목록을 만든다"는 지시가 사후 게이트에만 있으면 편집이 이미 끝난 뒤에야 발동해 **재작업으로만** 닫힌다. [2군-②]는 `domain-training-scorecard-eval/SKILL.md:97`에 착수 시점 지시가 이미 있어 이중 안전망이 됐지만, [1군-①]에는 그 앞단이 없다 — 같은 라운드의 두 항목이 서로 다른 견고함을 갖는다 | **낮음** — 스킬 본문 1~2줄. 변경 동결 중이므로 **백로그** |

---

## 트레이드오프 (페르소나 간 충돌)

- **[명세-구현 감사관] vs [제로베이스 도전자] — RV-201의 조치 방향**
  전자는 "사유서 실측치를 23,307 B로 갱신하고 넘어가라"(문면 이동 없이 2파일 수정), 후자는 "애초에 상시 비용 자리에 조건부 절차가 들어간 게 원인이니 문면을 옮겨라"(Rethink 1)로 갈린다.
  → **권고: 전자(사유서 갱신)를 이번 라운드에 하고, 후자는 백로그.** 근거 두 가지 — (1) 늘어난 문면의 **성능 기여가 실증됐다**(오판정 3건 해소, 위 검증표). 이 저장소 원칙은 "1순위 성능, 2순위 토큰 효율"이고 검사기 메시지도 "**줄이라는 뜻이 아니라** 사유서를 실측 갱신하라는 뜻"이라고 스스로 못박는다. (2) 문면 이동은 `agents/`·`skills/` 편집이라 trainer 위임이 필요하고 변경 동결 원칙상 "구조 변경"에 해당한다. 사유서 갱신은 `scripts/`·`docs/`라 PM 직접 편집 허용 구역이고 결함 수정에 해당한다.

- **[현장 실행가능성 검사관] vs [명세-구현 감사관] — RV-203의 심각도**
  전자는 "복붙 실행이 실패하니 결함", 후자는 "인접 항목·`evaluator.md:62`도 같은 상대경로 관례이므로 이 한 줄만 고치면 오히려 표기가 갈린다"로 갈린다.
  → **권고: Minor 유지, 단독 수정 대신 동종 잔여와 묶어 처리.** 이번 항목만 수용 기준이 "실행 가능한 지시"를 명시적으로 요구하므로 기각하지 않되, 표기 분열을 피하려면 다음 trainer 라운드에서 같은 관례의 자리들을 함께 정리하는 편이 낫다.

---

## 잘 된 점 (유지할 패턴)

1. **사양을 스크립트가 "파싱해서" 기대값으로 쓰는 구조** — `check-doc-drift-spec.mjs:66-73`이 경고 문면과 종료 코드를 헤더에서 읽어낸다. 기대값을 스크립트에 박아두는 흔한 안티패턴을 피했고, 그래서 헤더를 사실과 다르게 고치면 곧바로 FAIL한다. **픽스처의 목적을 실제로 이룬다.**
2. **앵커에 자기설명 주석을 함께 남긴 것** — `doc-drift.mjs:362-363`("이 마커 문구를 바꾸면 그 참조가 죽는다"). 죽은 앵커를 되살리는 데 그치지 않고 다음 편집자에게 이유를 남겼다.
3. **소비자 2곳의 실패 강도 차이를 "의도"로 명시한 것** — "자동 실행 경로는 사람의 작업을 막지 않는 것이 원칙"이라는 설계 의도가 헤더에 적혔다. 실물과 일치함을 확인했다. 이런 서술은 다음 사람이 훅을 "왜 여기선 exit 1 안 하지?"로 오해해 잘못 강화하는 것을 막는다.
4. **정정이 연쇄 드리프트를 남기지 않은 것** — §6.4를 고치면서 이를 참조하는 `:205`를 같은 커밋에서 함께 정정했다. 이 저장소 [변경이력 관리 원칙]이 요구하는 "정본 고칠 때 참조처 함께 정정"의 모범 사례다.
5. **스코프 준수** — [2군-①]에서 "기존 6종 개명은 범위 밖"을 그대로 지켰다. 판정축을 고치면서 개명까지 손대고 싶은 유혹을 참은 것이 확인된다(개명 0건).
6. **`check-drift-spec` 단독 별칭을 함께 추가한 것** — RV-202의 체이닝 문제를 부분적으로 완화한다.

---

## 생략한 관점 / 미확인 (정직 보고)

- **화면 캡처: 생략함** — 리뷰 대상이 전부 `.md`·`.mjs`·`.json`이라 렌더링 화면이 없다. `docs/screenshots/`에 이번 라운드 이미지 없음.
- **`agent_get_context` 응답의 내부 필드명: 미확인** — 이 계정에 점수 이력이 없어 `latestScore: null`, `scoreHistory: []`였다. 최상위에 `overallScore`가 **없다**는 것은 실측했으나, `latestScore`·`scoreHistory` 원소 **안의** 필드명은 확인하지 못했다(추정하지 않음).
- **38종 전수 대입: 표본 9종만** — 새 판정축의 안정성을 요청받은 대로 `common-*` 3종 + `domain-*` 3종 + 무접두어 1종 + 경계 사례 2종에 대입했고, 나머지 29종은 대입하지 않았다. 표본은 오판정이 보고된 3종과 그 반대 방향(정당 반려) 위험이 큰 구간을 골랐다.
- **베이스 검사기 출력의 직접 실행 비교: 계산으로 대체** — 워크트리 격리 정책상 별도 베이스 워크트리를 만들지 않았다. 대신 `git show 43f2040:...  | wc -c` = **21,353 B**가 `BUDGET_RATIONALE`의 등록치와 **정확히 일치**하고 허용오차가 512 B임을 확인해, 베이스가 `BUDGET_RATIONALE_OK`(INFO)였음을 도출했다. 브랜치 실행값(WARN, 1954 B 초과)은 직접 실행으로 확인했다.
- **실행 액션 없음** — 파일 수정·커밋·push·PR 생성 **전부 하지 않았다.** 리뷰 대상 7파일은 손대지 않았다. 리뷰어 자신의 산출물(`docs/reviewer/` 아래 이 보고서 + 페르소나 4개의 "적용 이력" append + `INDEX.md` "최근 재사용" 열 갱신)만 작성했다.

---

## PM에게 권고

1. **병합 차단 Critical: 0건.** Sensitive 등급 산출물이므로 사람 승인이 전제조건이나, 리뷰 관점의 차단 사유는 없다.
2. **병합과 같은 라운드에 동반 수정 권고 — RV-201 (Major) 1건.** `docs/refactor/evaluator-budget-rationale.md`의 실측치와 `scripts/validate-agent-assets.mjs:83`의 `bytes: 21353`을 **23307**로 갱신 + 사유서에 1~2줄 추가. 두 파일 모두 PM 직접 편집 허용 구역이라 trainer 위임 없이 닫힌다. 이걸 미루면 다음 라운드가 stale한 사유서를 물려받는다.
3. **trainer 반환 대상 (다음 라운드, Minor 4건)**: RV-203(grep 상대경로 — 동종 잔여와 묶어서), RV-204(`overallScore` 한정어 — **미해결 백로그의 원 지적과 같은 라운드에 두 자리 함께**), RV-205(`previousScore` 오독 방지 병기), RV-206(판정축 문면 정리 + 경로 ③ 검색어 규칙).
4. **PM 직접 처리 가능 (Minor 1 + Nit 2)**: RV-202(`package.json` 체이닝), RV-207·RV-208(`scripts/check-doc-drift-spec.mjs`). 전부 PM 편집 허용 구역이나 결함 강도가 낮아 서두를 이유는 없다.
5. **백로그 등재 (Rethink 3건)**: 접두어 게이트 문면의 조건부 자리 이동 / 기록주체 정합 검사 스크립트화 / 착수단계 지시 배치. 셋 다 변경 동결 원칙상 "구조 변경"이라 사용자 판단 대상이다. **Rethink 2의 "중간 비용"은 미확인 추정치** — 재사용 가능한 파싱 유틸 유무를 확인하지 않았다.
6. **별도 백로그 1건**: `hooks/doc-drift.mjs:392`의 `(RV-005)` — 조회 불가 식별자가 제품 본문(hooks)에 남아 있다. 이번 커밋 이전부터 존재하며 이번 diff 대상이 아니라 강등·스코프 밖 처리했다.
