리뷰 페르소나 패널: persona-spec-implementation-conformance-auditor.md, persona-script-skill-consistency-auditor.md, persona-semantic-force-preservation-auditor.md (3인, 전원 재사용 · 발산형 파일 미소집 — Standard 약식)
리뷰 대상: 워크트리 `.claude/worktrees/agent-a957e1b1039a004fc`, 브랜치 `trainer/skills-confirmed-defects-20260829`, 커밋 `7129387` (base `b2b1bd7`) — 18파일 +100/−80 (`malgn-agent/skills/` 16 · `malgn-agent/bin/` 2 · `malgn-agent/knowledge/review/screenshot-capture-guide.md` 1)
리스크 범주: 전 직원 배포 자산(스킬 본문 + 번들 스크립트) · hub 도구 호출 계약
리뷰 일자: 2026-08-29
종합 판정: 🟡 Amber — **GO (조건부)**

---

## 요약 (2분 규칙)

PM이 지목한 11개 확인 항목을 전부 실물로 재검증했다. **10개 항목은 정확하고, 스키마·grep·스크립트 재실행 모두 trainer 주장과 일치한다.** 정적 게이트도 전건 통과했고(ERROR 0 / 3-3 / `node --check` 2-2), WARN은 오히려 18 → 17로 하나 줄었다(`ABS_PATH` 1건 해소).

막는 문제는 하나다. **trainer가 고친 `bin/check-wbs-warnings.mjs`의 같은 결함이 같은 파일 300줄 아래에 하나 더 남아 있다** (`:310` `wbs_list(parent_id=...)` → 실제 파라미터는 `parentId`). 게다가 그 문장의 쌍둥이인 `project-orchestration/SKILL.md:87`은 이번에 `parentId`로 올바르게 적혀 있어, 이번 커밋이 **스크립트와 SKILL 사이에 없던 불일치를 새로 만들었다.** 1줄 수정으로 닫힌다.

그리고 PM이 물은 11번(의도적으로 안 고친 것) 판단을 검증하는 과정에서, **범위 밖의 더 큰 선행 결함**이 실증됐다. trainer는 "응답 JSON 필드라 grep만으로 casing을 단정할 수 없다"고 했는데, `wbs_list`를 읽기전용으로 실호출해 보면 단정할 수 있었다 — 실제 응답은 camelCase이고 `updated_at` 필드는 아예 없다. 즉 `check-wbs-warnings.mjs`는 진짜 `wbs_list` 응답을 넣으면 High 신호(기한 초과·의존성 블로킹)와 크리티컬 패스가 **전부 조용히 침묵한다.** 이번 커밋이 만든 문제는 아니므로 병합을 막지는 않지만, 별도 결함으로 열어야 한다.

---

## 지적 사항 (통합)

| ID | 심각도 | 위치 | 문제 | 확인방법 | 개선안 |
|---|---|---|---|---|---|
| M-01 | 🟠 Major | `malgn-agent/bin/check-wbs-warnings.mjs:310` | 이번 커밋이 고친 것과 **같은 파일·같은 결함 클래스**가 미수거. 권고 문자열이 `wbs_list(parent_id=<부모_id>)`인데 실제 스키마 파라미터는 `parentId`이고 `additionalProperties:false`라 그대로 호출하면 거부된다. 미러 문장인 `skills/project-orchestration/SKILL.md:87`은 이번에 `parentId`로 올바르게 적혀 있어 **스크립트↔SKILL 불일치가 새로 생겼다** | `wbs_list` 스키마 원문 로드 → `parentId` 확인. `grep -rnE '(wbs_list\|wbs_update\|…)\([^)]*(_id\|_name\|_date\|…)' malgn-agent/` → 이 1건만 잔존 | `parent_id` → `parentId` 1곳 치환(trainer) |
| M-02 | 🟠 Major (선행 결함, 이번 커밋 무관) | `malgn-agent/bin/check-wbs-warnings.mjs` 전체 (`:14-15`, `:167-168`, `:198`, `:227`, `:274`, `:300-303`, `:321-324`) | 스크립트가 "`wbs_list` 응답과 같은 구조"라며 `parent_id`/`computed_progress`/`start_date`/`end_date`/`updated_at`를 읽는데, **실제 응답은 camelCase**(`parentId`·`computedProgress`·`startDate`·`endDate`·`completedDate`)이고 `updated_at`/`updatedAt`은 **응답에 존재하지 않는다**. "필드 없으면 조용히 건너뛴다"는 설계라 실응답 투입 시 신호 1·2·3·4·5·6·7이 전부 침묵 | ①`wbs_list(projectId)` 실호출로 응답 필드 실측 ②실응답 형태 JSON(종료일 2026-01-05, progress 0, 기준일 2026-08-29 = 236일 지연)을 스크립트에 투입 → 결과: High "기한 초과" 미발생, `크리티컬 패스: end_date가 있는 미완료 항목이 없어 판정 대상 없음` 출력, Low 1건만 검출 | 스크립트가 camelCase를 읽도록 정정(또는 양쪽 허용) + `updated_at` 의존 신호 2건은 응답에 그 필드가 없으므로 근거 재설계. 별도 이슈로 열어 backend-dev 위임 |
| m-01 | 🟡 Minor | `skills/domain-backend-api-implementation-patterns/SKILL.md:145` vs `:185-186` | 익명화 라벨 `①형`이 **정의보다 40줄 먼저** 헤딩에 등장한다(`## Route → Service 계층 분리 (①형)`). 처음 읽는 사람은 그 시점에 ①이 무엇인지 알 수 없다 | 두 위치를 원문(`git show b2b1bd7:`)과 나란히 대조 | 헤딩을 `(①형 — Service가 SQL을 함께 가지는 형태)`처럼 자기설명형으로 바꾸거나, ①/② 정의 절을 앞으로 올린다 |
| m-02 | 🟡 Minor | 같은 파일 `:255`, `:262` | 익명화가 **행위 주체를 구조 라벨로 치환**해 인과 서사가 흐려졌다 — "②형은 정확히 이 지점에서 막혀 DAO를 도입한 것이다", "그래서 ②형에서 DAO로 분리했다". 형(form)은 막히거나 도입하는 주체가 될 수 없다 | 원문(`malgnai가 정확히 이 지점에서 막혀 DAO를 도입했다`)과 대조 | "②형을 택한 프로젝트는…" 처럼 주체를 익명 명사구로 복원 |
| m-03 | 🟡 Minor (위임 스코프 밖) | `skills/domain-architecture-patterns-reference/SKILL.md:113`, `:142` | 같은 결함 클래스 잔존 — 내부 프로젝트명 `malgnai`와 내부 산출물 파일명(`central-monitoring.md`·`setup-guide.md`)이 근거로 그대로 남아 있다. 설치 직원은 조회할 수 없다 | `grep -rn "malgnai" malgn-agent/skills/ \| grep -v malgnai-hub` | 4종과 같은 방식으로 익명화. 지시 범위 밖이었으므로 trainer 과실 아님 — 다음 위임에 포함 |
| m-04 | 🟡 Minor | trainer 보고 문구 | "하드 위반 63건 → 3건"이 실측과 다르다. 실측은 **63 → 하드 1건 + 확인필요 3건**(repo 루트 전체로는 380 → 18) | old/new 두 스크립트 버전을 `docs/reviewer`와 repo 루트에 각각 직접 실행해 대조 | 결과는 주장보다 **좋다**. 다만 수치 보고는 실행 출력 그대로 옮긴다 |
| m-05 | 🟡 Minor | `skills/common-learning-loop-knowledge-management/SKILL.md:11` | 섹션명을 `## 기록 필수 필드` → `## 기록에 반드시 담을 것`으로 고쳤으나, 같은 파일 상단 "역할 구분" 문장이 **옛 이름 "기록 필수 필드"를 그대로 인용**한다 | `grep -rn "기록 필수 필드" malgn-agent/` → 이 1건만 잔존 | 새 절 이름으로 동기화 |
| m-06 | 🟡 Minor | `skills/domain-backend-api-implementation-patterns/SKILL.md:398` | 익명화가 프로젝트명은 지웠으나 **자사 코드 실측치는 남겼다** — "`goalService.js`는 1,700줄로". 설치 직원이 조회할 수 없는 수치다 | 해당 라인 직접 확인 + CLAUDE.md 제품 본문 이식성 원칙 대조 | "서비스 파일 하나가 1,000줄대로 비대해진 사례"처럼 서술형으로 치환 |
| n-01 | ⚪ Nit | `bin/check-output-conventions.mjs:305` vs `skills/common-output-storage-and-path-management/SKILL.md:165-168` | 코드 예외는 `area === 'review'`라 **위치 무관** 모든 `review-*.md`를 프론트매터 검사에서 면제하는데, SKILL 예외문은 `docs/reviewer/review-*.md`로 한정한다 | 코드와 SKILL 문안을 나란히 대조 | 실질 영향 없음(`docs/reviewer` 밖의 `review-*`는 경로 하드위반이 먼저 걸린다). 문구만 맞추면 충분 |
| n-02 | ⚪ Nit | `skills/project-orchestration/SKILL.md` 신설 절 | `wbs_bulk_add`의 items는 `parentTempId` 외에 **`parentId`도 받는데**(이미 존재하는 부모에 붙이는 경로) SKILL은 `parentTempId`만 소개한다 | `wbs_bulk_add` 스키마 원문 | 한 구절 보완(선택) |
| n-03 | ⚪ Nit | `skills/project-orchestration/SKILL.md:42` | "malgnai issue와 연계" — `malgnai-hub`의 오기로 보인다(뒤에 `project_get_context` 호출이 이어진다) | 해당 라인 확인 | `malgnai-hub` |
| n-04 | ⚪ Nit | `skills/project-orchestration/SKILL.md` `delayed` 설명 | "`delayed`는 종료일·진행률로 **서버가 계산해** 붙인다"는 계산 로직 자체는 스키마로 확인되지 않는 추론이다 | `wbs_update` status enum = `planned/in_progress/done`, `wbs_list` status enum에만 `delayed` 포함 | 행동 지시("직접 지정하지 말고 종료일·progress를 갱신하라")는 enum으로 **확증**되므로 실질 문제 없음. 기제 서술만 단정을 낮추면 완벽 |
| R-01 | 🔵 Rethink | `skills/common-output-storage-and-path-management/`, `skills/common-product-principles-reference/` | description에서 "전 에이전트"라는 과장은 지웠지만, **디렉토리명의 `common-` 접두어는 그대로**다. CLAUDE.md는 이 접두어를 "전역 상시비용"의 표식으로 정의하는데 실측 참조는 각 1개(trainer)뿐이다 — 증상(문구)만 고치고 신호(이름)는 남았다 | `grep -rl` 실측: 1 / 1 / 3 | 대안 구조: 접두어 규약을 "참조 수"가 아니라 "**참조 방식**"(에이전트 MD가 무조건 로드하는가 vs 상황에서 invoke하는가)으로 재정의하거나, 두 스킬을 무접두어로 개명. **디렉토리 개명은 Refactor 등급 → 변경 동결 백로그**(지금 하자는 제안이 아니다) |

---

## 기각된 지적

- **"`agents/qa-engineer.md:45`에 죽은 전역 `shot` CLI 참조가 남았다"** → 기각. 실물을 열어보니 "전역 `shot` CLI는 이 배포 환경에 **실재하지 않으므로** 인증 경로로 쓰지 않는다"는 **부정 서술**이다. 죽은 참조가 아니라 죽은 참조를 막는 문장이다.
- **"`authService`/`sessionService`/`goalService` 함수명이 내부 함수명 노출"** → 강등(미채택). `docs/methodology/` 등 자사 문서와 대조한 결과 이들은 프레임워크 관례상 일반명사형 서비스명이라, 설치 직원의 "조회 가능성" 판단에 영향을 주지 않는다. 다만 그중 **자사 실측치**인 "1,700줄"만 별건으로 m-06에 남겼다 — 스코프는 형태가 아니라 목적으로 잡는다는 CLAUDE.md 원칙에 따른 분리다.
- **"`skills/project-retrospective/SKILL.md`의 파일명 규칙이 통일되지 않았다"** → 기각. PM 항목 10에 이름이 올라 있으나, 실물 확인 결과 `:71`이 이미 `docs/training-report-[주제]-YYYY-MM-DD.md`로 규칙을 지키고 있어 수정 대상이 아니었다. 무변경이 정답.
- **"`check-output-conventions.mjs` 변경이 다른 영역 검사를 약화시켰다"** → 기각. old/new를 repo 루트 전체에 돌려 대조한 결과 카테고리 구성이 동일하고(archived-접두어 6 / 헤더 메타데이터 6 / 파일명 18), 줄어든 362건이 전부 `review-` 경로·프론트매터 두 규칙에서만 발생했다. 다른 영역 무영향.

---

## 페르소나별 관점

### persona-spec-implementation-conformance-auditor (수렴) — 계약서=hub 스키마 원문, 납품물=커밋
스키마를 세션에서 직접 로드해 조항별로 대조했다. **전건 일치.**
- `wbs_update` → `assigneeAgentName` · `completedDate` 존재 확인, status enum = `planned`/`in_progress`/`done`. 항목 1·11의 casing 정정과 "delayed는 직접 지정 불가"가 둘 다 스키마로 확증됨.
- `wbs_add` → required `projectId`·`title`·`idempotencyKey`, optional `parentId`. SKILL이 적은 시그니처와 **정확히** 일치.
- `wbs_bulk_add` → items 1~100, `tempId`·`title` required, `parentTempId` 존재, 스키마 설명이 "부모가 자식보다 배열에서 먼저 와야 한다"를 그대로 말한다. SKILL 문안과 일치.
- `project_get_context.sections` enum = `state`/`decisions`/`issues`/`recentWork`/`wbs` → 항목 3·5에서 쓴 `['decisions']`·`['recentWork']`·`['issues']` 전부 유효. 옛 표기 `recent_decisions`는 저장소 전체 grep 0건으로 완전 제거 확인.
- `decision_record.reversalCondition` · `issue_record.suspectedCause` · `work_record.result`/`nextAction`/`artifacts` 모두 실재. 항목 5의 "재매핑"은 **없는 필드를 지어내지 않았다.**
- 항목 4 실측: `grep -rl` 결과 3(qa-engineer·security·trainer) / 1(trainer) / 1(trainer) — trainer 실측과 일치하고, 새 description이 이름까지 정확히 열거한다.

### persona-script-skill-consistency-auditor (수렴) — 문서 약속 ↔ 코드 실행 결과
old/new 두 버전을 같은 대상에 직접 돌려 비교했다.
- `docs/reviewer` 대상: **하드 63 → 1**(+확인필요 3, 양쪽 동일). 남은 4건은 전부 기존 보고서의 파일명 날짜 형식 문제이고 old 버전에서도 같은 항목이 잡혀 있었다 — **이번 변경과 무관한 별개 결함이 맞다.**
- repo 루트 전체: **하드 380 → 18.** 신규 위반 카테고리 0.
- 경로 정본 일관성: `grep -rn "output/reports" malgn-agent/`에 review 관련 잔존 0건, `agents/reviewer.md`·`knowledge/review/reviewer-personas.md`는 원래부터 `docs/reviewer/`로 되어 있어 **스크립트가 문서 쪽에 맞춰진 것**이 맞다.
- 여기서 M-01을 잡았다: 같은 스크립트 안 `:209`는 고쳐졌는데 `:310`은 안 고쳐졌고, 대응하는 SKILL 문장(`:87`)은 고쳐져 있어 정합성이 깨졌다.
- 그리고 M-02: 스크립트가 선언한 입력 계약("`wbs_list` 응답과 같은 구조")이 실제 응답과 다르다는 것을 **실호출 + 실투입**으로 실증했다.

### persona-semantic-force-preservation-auditor (수렴) — 치환 후 의미강도
`git show b2b1bd7:` 원문과 한 줄씩 대조했다.
- **항목 8의 핵심 판단: 실질 훼손 없음.** ①형/②형 라벨은 삭제가 아니라 치환이고, 판단 기준(언제 DAO를 두나) · 4가지 한계 · 코드 예시 · 결론 규칙이 모두 그대로 남았다. 테이블명은 `cc_users`→`users`처럼 서술과 코드블록이 **짝을 맞춰** 바뀌어 예시가 깨지지 않았다.
- 다만 독해 비용이 늘었다(m-01 forward reference, m-02 주체 소실). 규칙의 **강제력**은 안 깎였고 **설명력**이 살짝 깎인 형태다.
- 항목 5의 "유효 기간: 언제까지 유효한가(영구/임시)" → "무엇이 바뀌면 이 판단이 뒤집히는가"는 **약화가 아니라 강화**다. 전자는 답이 대개 "영구"로 수렴해 아무것도 강제하지 못하는 반면, 후자는 `reversalCondition`이라는 실재 필드에 착지해 검증 가능해진다.
- 항목 3의 STATUS.md 교체도 강화다. `project-standards` §3의 3,000B 상한과 6가지 재작성 트리거가 이제 **유일한 정본**이고, `learning-loop-patterns`는 그것을 가리키기만 한다(`:43`·`:76`·`:149`·`:153`·`:262`). 이전에는 두 스킬이 서로 반대 행동을 명령했다.
- 항목 7·9·10도 확인: 내부 실측치(`142턴/21.27M토큰`) 제거 후에도 "왜 병렬화해야 하는가"의 인과가 현재형으로 남았고, 죽은 `capture-all.js`/`capture-nav.js` 참조는 플러그인 전체 0건, 하드코딩 연도(`2024년 이후`)도 0건이다.

---

## 트레이드오프 (페르소나 간 충돌)

없음. 세 페르소나가 같은 방향으로 수렴했다 — 스키마 적합성은 만점, 정합성은 M-01 1건 미수거, 의미강도는 유지(가독성만 소폭 손실).

한 가지 판단이 갈릴 여지가 있는 지점은 **M-02를 이번 병합에 묶을 것인가**다. conformance 관점에서는 위임 계약 밖이라 이번 커밋의 흠이 아니고, consistency 관점에서는 "고치라고 지목받은 파일 안에서 발견된 더 큰 결함"이라 같이 처리하는 게 자연스럽다. 리뷰 진행자 판단으로 **분리**를 권고한다 — 이번 커밋은 문서 표기 정정이고 M-02는 스크립트 로직 수정이라 등급도 검증 방법도 다르다.

---

## 잘 된 점

1. **hub 파라미터 정정이 스키마와 100% 일치한다.** 5개 도구 · 15개 필드를 대조했는데 어긋난 것이 하나도 없었다. 기억이 아니라 실제 스키마를 보고 고쳤다는 증거다.
2. **`wbs_add`/`wbs_bulk_add` 신설 절이 요구 이상으로 정확하다.** required/optional 구분, 1~100 상한, `parentTempId` 정렬 제약까지 스키마 설명문과 일치한다. 특히 "`delayed`는 서버 파생값이라 직접 지정할 수 없다"를 짚은 것은 이 스킬을 실제로 쓰는 PM이 반드시 부딪히는 지점이다.
3. **STATUS.md 충돌 해소가 "지우기"가 아니라 "재배치"다.** 각 지시를 없애지 않고 `issue_record`/`decision_record`/`work_record`의 어느 필드로 갈지까지 지정했고, 상한·트리거의 정본이 어디인지 명시했다. 두 스킬이 다시 갈라질 여지를 닫았다.
4. **본문 수정이 정적 게이트를 개선했다.** `common-screen-verification-and-capture`에서 개인 전역 경로 서술을 걷어낸 결과 `ABS_PATH` WARN이 실제로 사라졌다(18 → 17). 문서를 고쳤는데 검사기 신호가 줄었다는 것은 표면 수정이 아니라는 뜻이다.
5. **지시받은 라인 밖까지 같은 클래스를 훑었다.** 항목 8에서 14곳, 항목 9에서 범위 밖 1건을 자진 처리했고, 그 사실을 보고에 밝혔다. 발견 못 한 잔존(m-03)이 있긴 하나 스코프 밖 파일이다.
6. **폐기 서술 방식이 개선됐다.** "과거 X는 더 이상 쓰지 않는다"(이력)를 "X처럼 하면 다른 PC에서 깨진다"(현재형 실패 양상)로 바꿨다 — 제품 본문 이력 금지 원칙과 "규칙이 생긴 이유는 남긴다"를 동시에 만족한다.

---

## 평가기준 충족 현황

| 게이트 | 결과 |
|---|---|
| `pnpm run check-assets` | ✅ **ERROR 0** · WARN 17 · INFO 1 (base `b2b1bd7` = WARN 18 → `ABS_PATH` 1건 해소, 순개선) |
| `pnpm run check-docs` | ✅ **3/3 통과** (agents 21 / skills 38 / knowledge 44) |
| `node --check` | ✅ `check-output-conventions.mjs` OK · `check-wbs-warnings.mjs` OK |
| `check-output-conventions.mjs` 재실행 | ✅ 직접 실행 — `docs/reviewer` 63→1, repo 루트 380→18, 신규 카테고리 0 |
| hub 스키마 대조 | ✅ 5개 도구 전건 일치 (스키마 원문 세션 로드) |
| 참조 에이전트 수 실측 | ✅ 3 / 1 / 1 — trainer 실측과 일치 |
| 죽은 참조 제거 | ✅ `capture-all.js`·`capture-nav.js` 플러그인 내 0건 |

**생략한 관점 (정직 보고)**
- **발산형 페르소나 파일을 소집하지 않았다.** Standard 등급 약식 규정(발산형 생략 가능)에 따른 것이며, 대신 🔵 Rethink 1건(R-01)을 보고서 내에서 제기했다.
- **화면 리뷰 없음.** 대상이 전부 마크다운·Node 스크립트라 렌더링 화면이 없다. `docs/screenshots/` 산출물 없음이 정상이다.
- **M-02의 수정 범위는 산정하지 않았다.** 결함의 존재와 재현만 실증했고, `updated_at` 의존 신호 2건을 어떤 근거로 대체할지는 backend-dev 설계 영역이라 손대지 않았다.
- **`docs/methodology/` 하위의 옛 `shot` CLI·`capture-all.js` 언급은 검사 대상에서 제외했다.** 이 저장소 자신의 설계 이력 사료이지 배포되는 제품 본문이 아니다.

---

## PM에게 권고

**판정: 🟡 Amber — GO (조건부).** Critical 0건. 병합을 막는 것은 M-01 한 건이고 1줄이다.

1. **M-01을 trainer에게 돌려보내 이 브랜치에서 닫는다** (Micro). `bin/check-wbs-warnings.mjs:310`의 `parent_id` → `parentId`. 같은 파일 안에서 `:209`만 고치고 `:310`을 놓친 것이라 별도 라운드로 넘기면 "왜 그때 같이 안 고쳤나"가 다시 남는다 — CLAUDE.md 변경이력 관리 원칙(정본 고칠 때 참조처를 같은 커밋에서 정정)이 정확히 이 상황을 겨냥한다. 덧붙여 m-05(`common-learning-loop-knowledge-management/SKILL.md:11`의 옛 절 이름)도 같은 성격의 1줄이라 함께 묶기를 권한다.
2. **M-02는 별도 이슈로 열어 backend-dev에 위임한다** (Standard). 변경 동결 원칙의 "실증 가능한 결함"에 해당한다 — 재현 절차와 출력이 이 보고서에 있다. 이번 커밋과 묶지 않는 이유는 등급과 검증 방법이 다르기 때문이다(문서 표기 정정 vs 스크립트 로직 수정 + 실응답 회귀 테스트).
3. **항목 11에 대한 답**: trainer의 판단은 **"합리적이지만 불충분"**이다. "grep만으로는 응답 필드 casing을 단정할 수 없다"는 전제는 맞다. 그러나 확인 수단이 없었던 것은 아니다 — `wbs_list`는 읽기전용 조회이고 이 세션에서 바로 호출된다. 실제로 호출했더니 주석 2줄의 casing 문제가 아니라 스크립트 본체가 실응답을 못 읽는다는 것이 드러났다. **앞으로 "확인 불가라 보류"로 남길 때는 시도한 확인 수단을 함께 적게** 하면(읽기전용 도구 호출을 시도했는가) 이런 유형이 다시 미끄러지지 않는다.
4. **m-01·m-02·m-06(가독성·실측치)은 다음 스킬 라운드에 묶는다.** 이번 커밋의 목적(익명화)은 달성됐고, 남은 것은 문장 다듬기다. 지금 열면 검증 사이클 중 설계 변경이 된다.
5. **m-03(`domain-architecture-patterns-reference`의 `malgnai` 잔존)은 백로그.** 이번 위임이 "도메인 스킬 4종"으로 명시돼 있었으므로 trainer 과실이 아니다. 다만 익명화를 한 라운드에서 끝내지 않으면 다음 감사에서 "새 결함"처럼 재등장한다 — 다음 위임의 스코프에 명시적으로 넣어 달라.
6. **R-01(`common-` 접두어)은 백로그 유지.** 디렉토리 개명은 Refactor 등급이고 배포 후 변경 동결 대상이다. 지금 하자는 제안이 아니라, description만 고친 이번 조치가 **증상 처치**임을 기록해 두자는 것이다.

**실행 여부 보고**: 이 리뷰는 검증만 수행했다. 대상 브랜치·워크트리의 파일을 **한 건도 수정하지 않았고**, 커밋·병합·푸시·배포를 **하지 않았다**. 이 라운드에서 생성·수정한 파일은 reviewer 자신의 산출물 3종뿐이다 — 페르소나 3개의 적용 이력 append, `docs/reviewer/personas/INDEX.md` 갱신, 이 보고서.

---

## 페르소나 재사용 판정

| 페르소나 | 판정 | 사유 |
|---|---|---|
| `persona-spec-implementation-conformance-auditor.md` | **재사용** | INDEX.md 행 "명세를 계약서, 커밋을 납품물로 놓고 조항을 1:1로 대조" — 이번 라운드 결함 11건 중 5건이 hub 도구 파라미터 표기 정정이라 역할개념이 정확히 동형. 6대 요소 본문 무수정, 적용 이력만 append |
| `persona-script-skill-consistency-auditor.md` | **재사용** | INDEX.md 행 "문서가 서술하는 약속과 코드 구현이 실제로 정확히 일치하는지 한 줄씩 대조" — `bin/check-output-conventions.mjs`·`bin/check-wbs-warnings.mjs` ↔ 대응 SKILL 대조가 그대로 이 역할. 본문 무수정 |
| `persona-semantic-force-preservation-auditor.md` | **재사용** | INDEX.md 행 "삭제·치환 리팩터링 후 규칙의 경계·강제력이 조용히 약해지지 않았는지 원문과 한 줄씩 대조" — 항목 5(절 치환)·8(익명화 치환)이 정확히 이 관점. 본문 무수정 |

**신규 페르소나 0건.** 착수 전 `docs/reviewer/personas/INDEX.md`(39개 행)를 Read해 "역할개념(1줄)" 열만 스크리닝했고, 이번 라운드의 세 결함 클래스 전부에 대응하는 기존 행이 있어 신규 파일을 만들지 않았다.

**등급 처리**: PM 위임에 재검토 3요소(`target_id`·직전 리뷰 경로·리스크 범주)가 모두 없어 `agents/reviewer.md` 안전측 기본값에 따라 **최초 리뷰**로 처리했다. PM이 Standard 등급 약식을 명시했으므로 발산형 페르소나 파일은 소집하지 않았다(권고 1~2명이나, 결함 클래스가 셋으로 갈려 재사용 3명으로 진행 — 신규 파일 비용 0).
