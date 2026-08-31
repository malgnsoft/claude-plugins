# pm/trainer/evaluator MD 재배치 라운드 리뷰 보고서

리뷰 페르소나 패널: `personas/persona-spec-implementation-conformance-auditor.md`, `personas/persona-semantic-force-preservation-auditor.md`, `personas/persona-product-body-portability-auditor.md`, `personas/persona-mechanism-zero-based-challenger.md`(발산형)
리뷰 대상: 워크트리 `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-ad71d760e8a2eaa84`, 브랜치 `trainer/md-relocation-20260831`, 베이스 `38ce18c` → HEAD `3092bfe` (`git diff 38ce18c`, 20파일 +332/-93)
리스크 범주: 전역 자동실행 자산(전 직원 배포되는 에이전트 MD·스킬·knowledge)
등급: Refactor (풀패널)
리뷰 일자: 2026-08-31
종합 판정: 🟡 **Amber** — Critical 0 / Major 3 / Minor 5 / Nit 2 / Rethink 2

## 요약 (2분 규칙)

이관 12건은 **전부 목적지에 착지했고 포인터 앵커도 전부 실재한다(죽은 참조 0)**. 절대 훼손 금지로 지정된 3구역(evaluator 판정 체크리스트·등급별 merge 규칙 / pm 승인 게이트 4항·권한 참조표 / trainer 3자 책임 구분표)은 원문 대조 결과 무손상이며, 신규·수정 자산에 날짜·식별자 유입도 0건이다. 다만 **① 옮긴 곳이 나간 곳의 2.9배로 팽창했는데(agents −10,535B vs skills+knowledge +30,136B) 그 수치가 보고에 없고, ② 이관이 아닌 신규 규칙(cherry-pick 열거·워크트리 격리·검사 grep)이 같은 커밋에 섞여 들어갔으며, ③ `common-` 접두어가 같은 커밋에서 추가한 재배치 스코프 밖 참조 2건으로 성립한다.** 이 셋은 결과물의 정확성 문제가 아니라 스코프·측정 규율 문제이므로 조건부 통과로 판정한다.

## 이관 완전성 대조 (위임 명세 12건 ↔ 실물)

| # | 출처(삭제된 자리) | 목적지 | 실재 | MD 트리거 문장 |
|---|---|---|---|---|
| 1 | pm.md STATUS.md 재작성 6가지·3,000B·재압축 | `skills/project-standards` §3 (SKILL.md:43-51) | ✅ | "STATUS.md를 고쳐야 할 것 같은 순간마다" |
| 2 | pm.md 동시성 워킹트리 + 되돌릴 지점 2불릿 | `skills/common-git-safety-and-concurrency` §1~§5 | ✅ | "커밋하기 직전, 그리고 merge…실행하기 직전에" |
| 3 | pm.md 기록 공통 폴백 | `common-learning-loop-knowledge-management` "기록 도구를 쓸 수 없을 때 — 공통 폴백" | ✅ | "도구가 목록에 없거나 호출이 실패한 그 자리에서" |
| 4 | pm.md 전역 자산 승격 절차 1~4 | `agents/evaluator.md` §2(35행)·§3(83-108행) | ✅ | "그 절차의 정본은 `agents/evaluator.md` §2·§3" |
| 5 | pm.md 검증 실무 4건 + KPI·점수 검증 | `knowledge/leadership/pm-verification-field-notes.md` §1~§6 | ✅ | "그 확인에 착수하기 전" |
| 6 | pm.md 위임 프롬프트 3규율 | `skills/project-orchestration` §4.1·§4.2 | ✅ | "위임 프롬프트를 쓰기 직전에" |
| 7 | trainer.md 식별자 금지 + 이력 금지 | `skills/domain-product-body-authoring-rules` §1~§4 | ✅ | "본문을 새로 쓰거나 고치기 전에" |
| 8 | trainer.md `work_record` 주인 판별 | `common-learning-loop-knowledge-management` 동명 절 | ✅ | "hub에 기록을 남기기 직전에" |
| 9 | trainer.md 모드 1~4 상세 4개 절 | 모드 표 "참고" 열 + 각 실행 스킬 | ✅ | "모드 1~4는 해당 skill을 호출하면 절차 전체가 그 안에 있다" |
| 10 | trainer.md 자기검증 3항목 상세 | `agent-upskill` "MD 보강"(SKILL.md:35), `reflect-lessons` §4-1·§4-2 | ✅ | 각 체크리스트 항목 말미 "(절차: …)" |
| 11 | evaluator.md 판정 체크리스트 근거 | `domain-training-scorecard-eval` "판정 체크리스트 근거 해설" | ✅ | "어떤 항목이 왜 그렇게 판정하라는 것인지 갈릴 때만" |
| 12 | evaluator.md 판정 회차 기록 파라미터 | `domain-training-scorecard-eval` "판정 회차 기록 — 도구 파라미터 상세" | ✅ | "기록을 남기기 직전에" |

부수 확인: 모드 4에서 사라진 "형제 에이전트 대조" 조항은 `reflect-lessons` 2단계에 신규 추가되어 보존됐고(SKILL.md 신규 불릿), "공통 knowledge 1개 + 참조" 조항은 이미 같은 절에 존재했다.

## 감량 금지 구역 대조 (전부 무손상)

| 구역 | 위치 | 판정 | 근거 |
|---|---|---|---|
| evaluator 판정 체크리스트 항목·배점·기준선 | `agents/evaluator.md`:47-73 | ✅ 무손상 | 항목 수·제목 동일. 접두어 구간(5↑=common/2~4=domain/1=무접두어)·FAIL 조건·"직접 히트 수만으로 반려하지 않는다" 전부 유지. 삭제된 것은 근거 서술뿐이며 스킬 "판정 체크리스트 근거 해설"에 보존 |
| evaluator 등급별 merge 권한 규칙 | `agents/evaluator.md`:96-103 | ✅ 무변경 | diff 헝크 없음. Standard=조직 설정에 따름 / Sensitive·Refactor=merge 금지·사람 승인 유지 |
| pm `AskUserQuestion` 부재 승인 게이트 4항 | `agents/pm.md`:88-99 | ✅ 무손상 | 1~4항 문면 무변경. 변경은 게이트 적용 지점 열거의 절 번호(3항 → 2항·3항)뿐이며 새 목록(1 대상선정/2 사람승인/3 gh부재/4 결과반영)과 일치 |
| pm 권한 참조표 | `agents/pm.md`:72-86 | ✅ 무변경 | diff 헝크 없음 |
| trainer 3자 책임 구분표 | `agents/trainer.md`:36-48 | ✅ 무변경 | diff 헝크 없음. 표 아래 `work_record` 주인 판별도 3분기 전부 잔존(52행) |

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| 1 | 🟠 | 발산/정합 | 영역 전체 | `git ls-tree -r -l 38ce18c/HEAD` 합계 | agents −10,535B인데 skills +24,896B·knowledge +5,240B → 순 +19,601B(2.9배 팽창). evaluator.md −2,072 → `domain-training-scorecard-eval` +5,836(2.8배). CLAUDE.md "에이전트 업그레이드 원칙"이 요구하는 "영역 합계 실측 + 옮긴 곳이 늘어난 양"이 보고에 없고 agents 3개 수치만 제시됨 | 목적지 증가분을 보고에 병기하고, 팽창분이 원문에 없던 신규 서술인지 항목별로 구분 |
| 2 | 🟠 | 정합/스코프 | `skills/common-git-safety-and-concurrency/SKILL.md`:47(§5-1), :36(§4); `skills/domain-product-body-authoring-rules/SKILL.md`:52-58(§4) | `git grep -n 'cherry-pick' 38ce18c -- malgn-agent/` → 0건; `git show 38ce18c:malgn-agent/agents/pm.md \| grep 워크트리` → 0건; base trainer.md에 grep 명령 0건 | 재배치가 아니라 **신규 규칙**이 섞였다. cherry-pick 열거 지침은 base 시점 malgn-agent 전체에 문자열 자체가 없었고, 워크트리 격리·검사 grep 3줄도 삭제된 pm.md/trainer.md 본문에 없던 내용(저장소 CLAUDE.md에서 유입). 이관 검증은 "원문 대조"라 신규 조항은 아무도 타당성을 판정하지 않은 채 전 직원에 배포된다 | 신규 조항을 diff에서 분리해 별도 승인 대상으로 올리거나 이번 라운드에서 제거 |
| 3 | 🟠 | 정합/게이트 | `agents/backend-dev.md`:104, `agents/devops.md`:98 (신규 +1행), `skills/common-git-safety-and-concurrency/` | `grep -rln common-git-safety-and-concurrency agents/` → 5건, 그중 2건이 이번 커밋 신규 | 접두어 `common-`이 **같은 커밋에서 만든 재배치 스코프 밖 참조 2건**으로 성립한다. 그 2건을 빼면 도달 3 → 게이트 구간상 `domain-`(2~4). 게이트 문면상 PASS이나 "비용 구조가 common-이라서"인지 "접두어를 맞추려 참조를 늘려서"인지 판별 불가. 이 저장소 CLAUDE.md는 `common-*`을 상시 비용으로 분류하므로 감축 목적과 반대 방향이기도 하다 | backend-dev/devops 참조 추가의 독립적 타당성을 별도 판정하거나, 스코프 밖으로 되돌리고 `domain-`으로 명명 |
| 4 | 🟡 | 정합 | `common-git-safety-and-concurrency` §4 / `project-orchestration`:209 / `knowledge/leadership/team-composition-patterns.md`:120 | 3파일 grep 후 원문 대조 | 워크트리 격리 규칙이 3곳에 중복되고 셋 다 명령형이며 서로를 정본으로 지목하지 않는다. 변경이력 관리 원칙이 경고하는 "정본 하나 고치고 참조처를 놓치는" 형태 | 새 스킬 §4에 "정본: `project-orchestration`" 한 줄을 넣거나, 반대로 두 기존 자리를 포인터로 바꿈 |
| 5 | 🟡 | 발산/정합 | `agents/pm.md`:45 vs `common-git-safety-and-concurrency` §1 3번째 불릿 | 두 문장 원문 대조 | "진행 상태 라벨은 라벨이 아니라 실물로 대조" 규칙이 상시비용(MD)과 조건부(스킬) 양쪽에 전문으로 남았다 — 재배치 목적(상시→조건부)에 반한다 | 한쪽만 남기고 다른 쪽은 트리거 문장으로 |
| 6 | 🟡 | 의미보존 | `agents/trainer.md`:100-102(자기검증 3항목) | 포인터 대상 스킬의 적용 모드 확인 | trainer 자기검증은 모드 1~6 전체에 적용되는데 정본이 모드 전용 스킬을 가리킨다 — "문서경로 실재 대조"→`agent-upskill`(모드1 전용), "기록 주체 전수 grep"·"역참조 갱신"→`reflect-lessons` §4-1/4-2(모드4 전용). 역참조 전수 갱신이 가장 필요한 모드 6(MD 정리 — 죽은참조제거·구조재배치)은 스킬을 로드하지 않는 수동 모드다 | 세 절차를 모드 중립 자리(예: `domain-product-body-authoring-rules`)로 모으거나, 모드 6 항목에서 그 절차를 별도 지목 |
| 7 | 🟡 | 의미보존 | `agents/evaluator.md`:126 | 삭제 전후 문장 대조 | "점수 이력이 없어 읽지 못했으면 최초 회차임을 보고에 밝힌다"는 **보고 의무**인데 MD에서 삭제되고 스킬의 "도구 파라미터 상세"로 이동했다. MD 포인터가 "(파라미터 상세: …)"라 행위 의무가 그쪽에 있다는 신호가 없다 | 그 한 문장은 체크리스트 항목에 되돌리거나, 포인터 문구를 "파라미터·보고 의무 상세"로 |
| 8 | 🟡 | 정합 | `skills/project-orchestration`:185 vs `agents/pm.md`:62 | 두 문장 원문 대조 | §4.1 "금지 범위 — 거버넌스 파일(훅 설정·정책/역할 정의)"이 pm.md:62 "위임 범위 명시 필수 — 거버넌스 필드(`hooks/hooks.json`)는 금지 목록"과 같은 취지. pm.md:62는 삭제되지 않아 새 중복이 생겼다 | pm.md:62를 §4.1로 흡수하거나 §4.1에서 그 항목을 뺌 |
| 9 | ⚪ | 정합 | `agents/trainer.md`:100 → `skills/agent-upskill/SKILL.md` | 대상 파일 grep | 포인터 `Skill agent-upskill "MD 보강"`의 앵커 문자열이 SKILL.md 두 곳(실행흐름 6단계:19 / `## 보강 범위` 하위 소제목:30)에 있고 첫 히트가 절차 없는 쪽이다 | 앵커를 `"보강 범위 — 문서경로 참조는 실재 대조까지 한다"`로 구체화 |
| 10 | ⚪ | 정합 | `hooks/pm-orchestration-block.md`:13 | 원문 확인 | 되돌림 지점 규칙의 4번째 사본. 훅 블록은 pm.md와 별개 정본이므로 결함은 아니나, 이 라운드에서 함께 정합 점검되지 않았다 | 다음 라운드에서 훅 블록도 포인터화 여부 판단 |

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 의미보존 | evaluator.md 전제에서 `agents/<name>/manifest.json` 예시가 삭제돼 판정 기준이 약해졌다 | 기각 | 규칙 문장("manifest나 별도 동기화 상태를 신뢰하지 않습니다")과 판정 행위(`git diff`로 확정)는 그대로다. 삭제된 것은 **존재하지 않는 구조의 예시** 하나이고, 그 근거는 `domain-training-scorecard-eval` "왜 판정 대상이 평면 경로 하나뿐인가"에 보존됐다 |
| 이식성 | 신규 knowledge가 Skill을 참조해 "Knowledge→Skill 단방향" 원칙 위반 | 기각 | `pm-verification-field-notes.md`의 Skill 언급 1건은 `common-permission-policy-compliance`를 **정본으로 선언**하는 형태 → evaluator 체크리스트 ①정본 선언에 해당해 PASS. 나머지 문체도 전부 설명형이고 명령형 체크리스트 없음 |
| 정합 | CLAUDE.md·plugin.json·README·사유서·린터 수치가 실물과 어긋난다 | 기각 | `pnpm run check-docs` 3/3 통과(agents 21 / skills 40 / knowledge 44), plugin.json·README도 40·44로 동기화, `wc -c` 실측이 사유서·BUDGET_RATIONALE의 24,362와 정확히 일치, `pnpm run check-assets` ERROR 0(evaluator.md는 BUDGET_RATIONALE_OK로 INFO 강등) |
| 이식성 | `domain-product-body-authoring-rules`에 `이관됐`·`라운드`·`2025-07-10` 등 금지 표현이 있다 | 기각 | 전부 **규칙 본문이 금지 대상을 설명하려 인용한 문자열**과 규칙이 명시적으로 허용한 형식 예시 날짜다. base 대비 `라운드` 히트 수도 pm.md 1→1, trainer.md 2→1로 증가 없음 |

## 페르소나별 관점

### [스펙-구현 정합성 감사관] — 판정: 🟡 Amber
계약서(위임 명세 12건 + 신설 3종 + 접두어 게이트 3축)와 납품물(`git diff 38ce18c..3092bfe`)을 조항 단위로 대조했다. **12건 전부 착지, 포인터 앵커 12건 전부 실재(죽은 참조 0)**. 접두어 게이트는 직접 재실측했다 — `domain-product-body-authoring-rules`는 ①직접 2(evaluator·trainer) ②knowledge 경유 0 ③정본 파일·커맨드를 지목하지 않아 대상 없음(0) = 합산 2 → `domain-` 정확(trainer의 판단이 옳다). `common-git-safety-and-concurrency`는 합산 5로 문면상 `common-` PASS이나 5건 중 2건이 이번 커밋이 만든 재배치 스코프 밖 참조라 지적 #3으로 올린다. 계약 밖 납품(신규 규칙)이 섞인 것이 지적 #2다.

### [의미강도 보존 감사관] — 판정: 🟢 Green (감량 금지 구역 한정)
축약 12곳을 원문과 한 줄씩 대조했다. 삭제된 것은 대부분 **"왜 그렇게 하는가"의 근거 서술**이고 **"무엇을 하라"는 판정 문장·기준선·FAIL 조건은 전부 잔존**한다. 특히 evaluator 접두어 게이트는 구간 수치·FAIL 조건·"직접 히트 수만으로는 반려하지 않는다"까지 그대로이고, Knowledge→Skill 링크 항목도 PASS 3유형·FAIL 1유형이 유지됐다. `work_record` 주인 판별은 trainer.md에 3분기가 전부 남아 강도 손실이 없다(다만 그래서 스킬과 2벌 — 지적 #5와 같은 성격). 유일한 강도 손실은 지적 #7(보고 의무 1건의 포인터 뒤 이동)이다.

### [제품 본문 이식성 감사관] — 판정: 🟢 Green
형태 무관 grep(백틱 앵커 없이 `[0-9a-f]{8}` / ULID / `YYYY-MM-DD` / 이관·폐기·라운드)으로 신규 2스킬 + 신규 knowledge + 수정 6자산을 전수 확인했다. **조회 불가 근거의 신규 유입 0건.** 신규 knowledge는 사례를 스택 일반 서술(`server/api/...`, `wrangler dev`)로만 적었고 자사 프로젝트명·실측치·커밋을 끌고 들어오지 않았다. `domain-product-body-authoring-rules`가 규칙 설명을 위해 금지어를 인용한 줄들은 규칙 본문이므로 대상 아님.

### [전파 메커니즘 제로베이스 도전자] 🔵 — 발산형
아래 "구조적 제언" 참조.

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| 1 | 12곳 모두 "MD에 압축본 + 스킬에 확장본" 2계층. 그런데 라운드 내부에서 기준이 갈린다 — `work_record` 주인 판별은 MD에 3분기 전문 + 스킬에도 전문(2벌), STATUS.md 6가지 시점은 MD에서 완전 제거(0벌), 진행 상태 라벨은 MD·스킬 양쪽 전문(2벌) | "**판단이 갈리는 지시는 MD에 단 한 벌, 나머지는 순수 포인터(트리거 한 줄)**"로 기준을 하나만 고르고 12곳을 재정렬 | 지금은 상시비용을 −10.5KB 줄이는 대가로 **드리프트 지점 12개**를 새로 만들었다(둘 중 하나만 고치면 두 벌이 갈린다 — 이 저장소가 "변경이력 관리 원칙"으로 명문화한 바로 그 실패). 기준을 고정하면 다음 재배치 라운드가 같은 판단을 반복하지 않는다 | 중간(12곳 재정렬). 지금 확정하지 않으면 다음 라운드가 또 갈린다 |
| 2 | pm.md는 재배치 후에도 39.9KB(권고 15KB)라 `BUDGET_UNJUSTIFIED` WARN이 그대로 남는다. 이번 감량폭은 9.3%인데 조건부비용은 그 3배가 늘었다 | pm.md를 **불변축(권한 참조표·승인 게이트·역할 경계)과 가변축(실무 함정 모음)** 두 종류로 가르고, 가변축을 통째로 `knowledge/leadership/pm-verification-field-notes.md` 한 곳으로 이관. 이번엔 그중 6건만 갔고 핵심 원칙에 같은 성격 항목이 다수 남아 있다 | 항목 단위로 옮기면 매 라운드 "이건 옮길까 말까" 판단이 반복되고 라운드당 9%씩 줄어드는 대신 목적지가 3배씩 부푼다. 축으로 가르면 1회로 끝나고 이후 신규 함정은 자동으로 knowledge에 쌓인다 | 중간~큼. **변경 동결 원칙상 결함이 아닌 개선이므로 백로그** — 사용자 승인 후 착수 |

## 트레이드오프 (페르소나 간 충돌)

- **의미강도 보존 감사관 🟢 vs 발산형 🔵**: 전자는 "축약해도 규칙이 안 약해졌으니 통과"라 하고, 후자는 "안 약해진 이유가 MD에 원문을 남겨서인데 그러면 애초에 왜 옮겼나"라고 본다. → **권고: 발산형 손을 들어준다.** 지적 #5·#7과 Rethink #1이 같은 뿌리다. 다만 이번 라운드를 반려할 사유는 아니고, "무엇을 남기고 무엇을 옮기는가"의 기준을 다음 라운드 착수 전에 먼저 확정하는 것이 맞다.
- **정합성 감사관 🟠(#3, 접두어) vs 게이트 문면**: 게이트 문면으로는 합산 5 → `common-` PASS다. 반려 근거로 삼기엔 약하다. → **권고: FAIL 사유가 아니라 "참조 추가 2건의 독립 타당성"을 별건으로 판정.** 타당하면 `common-` 유지, 아니면 스코프 밖으로 되돌리고 `domain-`.

## 잘 된 점 (다음 산출물의 기준)

- **트리거 문장 12/12**. 전부 "…직전에", "…갈릴 때만"처럼 시점이 박힌 문면이고, `agents/evaluator.md`:77은 "스킬을 열지 않았다는 이유로 판정을 미루지 않습니다"라는 안전장치까지 붙였다 — 포인터화가 실행을 막지 않게 하는 좋은 패턴.
- **포인터 앵커가 대상 헤딩 문자열과 정확히 일치**. `"판정 회차 기록 — 도구 파라미터 상세"`, `"기록 도구를 쓸 수 없을 때"`, `` "`work_record` 주인 판별" `` 전부 실제 헤딩과 문자열이 맞아 grep 한 번에 도달한다.
- **감량 금지 3구역 전원 무손상**, 그중 2구역은 diff 헝크조차 걸리지 않았다.
- **`domain-` 판정이 게이트 3축대로 정확**. 승인 목록의 `common-`을 그대로 따르지 않고 실측으로 되짚어 접두어를 바꾼 판단은 옳다.
- **후속 수치 정합 완결**. CLAUDE.md·plugin.json·README·`docs/refactor/evaluator-budget-rationale.md`·`scripts/validate-agent-assets.mjs` 5곳이 실측과 일치하고 `check-docs` 3/3, `check-assets` ERROR 0.

## 평가기준 충족 현황

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|---|---|---|---|---|
| 이관 후보 12건이 실제로 옮겨졌는가 | 정합성 | 필수 | ✅ | 12/12 |
| MD에 "언제 여는가" 트리거가 남았는가 | 정합성 | 필수 | ✅ | 12/12 |
| 포인터 대상이 실재하는가(죽은 참조 0) | 정합성 | 필수 | ✅ | 헤딩 문자열까지 일치 |
| 감량 금지 3구역의 의미·강도 불변 | 의미보존 | 필수 | ✅ | 원문 대조 |
| 규칙의 강제력이 조용히 약해지지 않았는가 | 의미보존 | 필수 | ⚠️ | 1건(#7) 보고 의무가 파라미터 포인터 뒤로 |
| 접두어가 게이트 3축 합산과 일치하는가 | 정합성 | 필수 | ⚠️ | `domain-` ✅ / `common-`은 합산 5지만 2건이 동일 커밋 신규(#3) |
| 신규 유입 식별자·이력 0건 | 이식성 | 필수 | ✅ | 형태 무관 grep 전수 |
| frontmatter·정적검사 통과 | 정합성 | 필수 | ✅ | ERROR 0, check-docs 3/3 |
| 재배치 범위 밖 신규 규칙 없음 | 정합성 | 권장 | ❌ | #2 |
| 영역 합계 실측·보고 | 발산 | 권장 | ❌ | #1 |
| 중복 서술을 만들지 않았는가 | 발산 | 권장 | ❌ | #4·#5·#8 |

## PM에게 권고

1. **통과 가능하다(Amber).** Critical 없고, 절대 훼손 금지 3구역과 이관 12건은 검증 완료다. 아래를 처리하면 병합 가능.
2. **trainer에 반려해 처리할 것(우선순위 순)**
   - #2 신규 규칙 분리 — `common-git-safety-and-concurrency` §4·§5-1과 `domain-product-body-authoring-rules` §4가 이관분인지 신규분인지 diff로 표시해 반환. 신규분은 변경 동결 원칙상 이번 라운드에 넣을지 별도 판단이 필요하다.
   - #3 `backend-dev.md`·`devops.md` 참조 추가의 독립 타당성 근거 제출. 근거가 서지 않으면 두 줄을 빼고 접두어를 `domain-`으로.
   - #7 evaluator 보고 의무 1문장 복원(1줄).
   - #4·#5·#8 중복 3건 정리(각 1~2줄).
3. **PM이 직접 할 것**: #1 — 이 라운드의 완료 보고에 **목적지 증가분(skills +24,896B / knowledge +5,240B)** 을 agents 감소분과 함께 적는다. `agents/*.md`는 PM 편집 금지 구역이지만 보고 수치는 PM 소관이다.
4. **백로그로 넘길 것**: Rethink #1(재배치 기준 확정)·#2(pm.md 축 분할). 둘 다 결함이 아니라 개선이므로 변경 동결 원칙상 사용자 승인 대기.
5. **생략한 것**: 화면 캡처 없음(문서·MD 대상이라 해당 없음). 런타임 실행 검증(실제 서브에이전트 위임으로 스킬이 트리거되는지)은 수행하지 않았다 — 정적 대조 범위로 한정했으므로, evaluator의 "성능형 변경" 항목(Sensitive: 정상경로 1 + 경계경로 1 실행 재현)은 evaluator 판정 단계에서 별도로 채워야 한다.
