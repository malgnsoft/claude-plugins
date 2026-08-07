# 맑은소프트 에이전트 개발방법론 (초안 E안)

> 작성 목적: 이 문서는 이후 진행될 **"기존 malgn-agent 전수 감사"**와 **"전체 재작성 여부 판정"**의 판정 기준(rubric)으로 그대로 쓰인다. 따라서 추상적 선언이 아니라 "이럴 때는 이렇게 판단한다"는 실행 가능한 기준 위주로 작성했다.
> 조사 근거: `CLAUDE.md`, `malgn-agent/agents/pm.md`(257줄), agents 21종·skills 35종(common-* 6종 포함)·knowledge 61개·hooks 2종의 실제 디렉토리 구조와 대표 샘플(architect/marketer/finance 등), `knowledge/common/skill-vs-knowledge-boundary.md`, `STATUS.md`의 열린 이슈 3건(`929edddc`, `c3ef5744`, `f1913b79`)을 직접 열람해 확인했다.

---

## 0. 전제 — 이 방법론이 답해야 하는 질문

malgn-agent는 개발자 전용 도구가 아니라 **개발/기획/디자인/마케팅/재무를 포함한 맑은소프트 전 직원**에게 배포된다(agents 목록: architect, backend-dev, frontend-dev, devops, qa-engineer, security, planner, researcher, rfp-analyst, capture-strategist, writer, presenter, localizer, marketer, finance, ux-designer, visual-designer, pm, trainer, evaluator, reviewer — 21종). 이 방법론은 다음 4가지 질문에 실행 가능한 답을 낸다.

1. 직원이 클로드코드를 켰을 때 **무엇을 배우지 않아도 되어야** 하는가?
2. 어떤 지식을 **자동 트리거**로, 어떤 지식을 **명시 호출**로 설계해야 하는가?
3. 실패했을 때 **무엇을 보고하고 무엇을 학습 자산으로 남겨야** 하는가?
4. 개발팀의 정교한 기준(코드 리뷰, 보안)과 마케팅/재무팀의 느슨한 기준(전략·가정)이 **하나의 플러그인 안에서 어떻게 공존**해야 하는가?

이 4가지에 대한 답이 §1~§4이고, 그 답을 근거로 §5~§7에서 실제 감사 rubric과 재작성 임계값을 정의한다.

---

## 1. 최종사용자 기대 모델 — L0/L1/L2 3층 구조

비개발자 직원 기준으로 설계한다: **"아무것도 몰라도 되는 것(L0)" → "이름 하나만 알면 되는 것(L1)" → "필요한 사람만 깊이 아는 것(L2)"**.

| 층 | 담당 구성요소 | 사용자가 배워야 하는 것 | 실측 사례 |
|---|---|---|---|
| L0 자동 | `hooks/` (SessionStart, Stop) | 없음. 세션을 열면 이미 컨텍스트가 주입돼 있다 | `session-context.mjs`가 SessionStart에 STATUS.md 주입, `hook-stop-mcp-reminder.cjs`가 Stop에 기록 리마인더 |
| L1 명시 호출 | `agents/` 21종 + PM 오케스트레이터 | 자기 팀에 해당하는 에이전트 이름 1~2개, 또는 "그냥 PM에게 말하면 알아서 위임한다"는 사실 | marketer.md는 "COO의 마케팅·사업성 검토에 호출하거나 단독으로 사용 가능"으로 명시 — 마케팅 직원은 `marketer`라는 이름 하나만 알면 됨 |
| L2 심화 | `skills/` 35종, `knowledge/` 61개 | 없음(원칙). 에이전트가 내부적으로 참조 | knowledge/README.md: "각 에이전트 MD 파일에서 Read 도구로 참조" — 직원이 직접 knowledge를 열 필요가 없는 구조가 정상 |

**판정 기준 — 신규 지식을 어디에 둘 것인가:**

```
이 지식이 없으면 모든 세션이 잘못 시작되는가?          → hooks (L0)
사람의 이름 호출/의도가 필요한 전문 판단인가?           → agents (L1)
특정 상황(파일패턴·키워드)에서만, 결과물의 "방법"인가?  → skills (L2, 자동트리거)
"왜 그런가"에 대한 배경·사례·트레이드오프인가?          → knowledge (L2, agent가 pull)
```

이 기준은 이미 조직 내부에 `knowledge/common/skill-vs-knowledge-boundary.md`로 정식화되어 있다(skill=명령형·3~5분·재사용성, knowledge=설명형·15~30분·맥락). 이 방법론은 이를 **부정하지 않고 그대로 채택**하며, 감사 rubric(§6-C)에 이 판정 기준을 그대로 검사 항목으로 넣는다.

**러닝커브 관점의 실패 신호**: 비개발자가 "이 스킬을 왜 내가 알아야 하지?"라고 느끼는 순간이 설계 실패다. 예: `domain-serverless-edge-api-security`, `wrangler`, `durable-objects` 같은 Cloudflare 벤더 스킬은 backend-dev/devops에게만 발견되어야 하며, marketer가 세션을 시작했을 때 이런 스킬의 존재가 어떤 형태로든 인지 부하를 유발하면 실패다. → **감사 항목**: 스킬 `description`이 트리거 조건을 충분히 좁게 명시하는가(§6-C).

---

## 2. 자동 트리거 vs 명시 호출 — 결정 트리

가장 러닝커브에 직접 영향을 주는 설계축이다. 다음 순서로 판정한다.

```
Q1. 이 동작이 실패/오작동하면 되돌리기 어렵거나(비가역) 금전·대외 영향이 있는가?
    YES → 명시 호출 + 사람 승인 게이트 필수 (자동화 금지)
    NO  → Q2

Q2. 이 동작이 "거의 모든 세션"에서 100% 필요한가?
    YES → hook으로 자동화 (SessionStart/Stop)
    NO  → Q3

Q3. 특정 파일 패턴·작업 유형·키워드가 있을 때만 필요한가?
    YES → skill의 description 트리거로 자동 발견되게 설계
          (사용자가 스킬 이름을 몰라도 Claude가 알아서 로드)
    NO  → Q4

Q4. 사람의 취향·전문 판단·도메인 지식이 개입해야 하는가?
    YES → agent 명시 호출 (또는 PM이 대신 판단해 위임)
```

**실측 대조 — 이미 이 기준을 따르는 좋은 사례:**
- 비가역·대외영향(Q1=YES) → marketer.md는 "광고 집행(예산 지출, 캠페인 ON)"을 "산출물=계획서까지, 실제 집행은 사람 승인 뒤"로 명시하고 "집행 승인 필요 항목 표"를 필수화했다. finance.md도 "실제 투자 집행 권한 없음"을 역할 경계에 명시한다. → 이 패턴은 **동일한 위험도를 가진 다른 에이전트(devops의 배포, security의 취약점 공개)에도 있어야 하며, 없다면 감사 실패(§6-D)다.**
- 매 세션 100% 필요(Q2=YES) → STATUS.md 자동주입은 hook, "결과는 파일로 저장하고 경로만 반환"은 모든 에이전트가 공유하는 common-token-efficient-collaboration 스킬로 처리 — 개별 에이전트 MD에 반복 기술하지 않는다.
- 도메인 특화·판단 개입(Q4=YES) → architect/marketer/finance처럼 "어떤 전략을 택할지"는 명시 호출 에이전트의 몫으로 남기고 스킬화하지 않는다(스킬은 방법을, 에이전트는 판단을 담당).

**흔한 오판 두 가지:**
1. **비가역 동작을 skill 자동 트리거로만 걸어두는 것** — description만으로 발견되게 하면 사람 승인 없이 절차가 자동 진행될 위험이 있다. Q1=YES인 항목은 skill 자동트리거가 아니라 반드시 agent 경계+게이트 문장으로 명문화해야 한다.
2. **매 세션 필요한 걸 agent 호출로 남겨두는 것** — 예: 프로젝트 표준(pnpm, STATUS.md 3층 부트스트랩)은 `malgn-project-standards` 스킬로 존재하지만, 이게 실제로 "매 세션 100% 필요"라면 hook 주입이 더 적합한지 재검토 대상이다(§6-C 발견가능성 항목에서 확인).

---

## 3. 실패했을 때 무엇을 보고하고 배우는가

실패를 4가지로 분류하고 각각 다른 기록 대상을 매핑한다.

| 실패 유형 | 예시 | 기록 대상(malgnai-hub) | 학습 자산화 |
|---|---|---|---|
| (a) 산출물 품질 미달 | 근거 없는 수치, happy-path만 서술 | `activity_log`(업무 턴) | `common-beyond-mediocre-output` 체크리스트 보강 후보 |
| (b) 팀 구성/위임 오류 | 불필요한 풀파이프라인 가동, 등급 오판 | `decision_add`(importance 재판정) | `common-task-grading-and-verification-depth` 등급표 보강 후보 |
| (c) 도구/경로 오류 | 존재하지 않는 파일 참조, 개인 절대경로 잔존 | `issue_add` → 해결 후 `issue_resolve` | 감사 rubric §6-A/G 항목으로 흡수 |
| (d) 권한/승인 경계 위반 | 승인 없이 비가역 실행(배포·집행) | `issue_add`(importance 최고) + 즉시 사용자 보고 | agent 역할 경계 문구 즉시 수정 |

**구조적 제약(반드시 명시해야 하는 비대칭)**: malgn-agent에 번들된 `pm.md`는 **malgnai-hub**(원격, 회사 전체용) 연동판이라 `lesson_add`/`lesson_list`/`lesson_classify`/`memory_add` 같은 전용 교훈 캡처·분류 파이프라인이 없다 — decision_record의 reason/impact, work_record의 result/nextAction에 녹여 기록하는 방식으로 대체되어 있다(pm.md 52행, 253행에 명시적으로 "해당 없음" 처리됨). 반면 이 세션(claude-plugins 저장소 자체의 운영)은 로컬 **malgnai-mcp**를 쓰며 `lesson_add` 등 전용 파이프라인이 있다. **이 두 파이프라인을 절대 혼동해서는 안 된다** — 감사 시 "malgn-agent 안의 agents/skills가 malgnai-mcp 전용 도구(`lesson_add` 등)를 그대로 호출하도록 남아있는지"를 반드시 확인한다(§6-F, 이미 STATUS.md에 "malgnai-mcp→malgnai-hub 도구명 어댑테이션 완료"로 기록되어 있으나 전수 재검증 필요).

**보고 형식 원칙**: 실패 보고는 "claimed(주장)"과 "verified(확인)"을 구분한다(`verifiable-output-and-honesty` 스킬 원칙 채택). 예: "3개 화면 검증 완료"라는 보고를 받으면, 최소 1~2개 산출물을 직접 열어 대조한 뒤에만 완료로 인정한다 — 이는 pm.md에 이미 lesson 근거(`f15fd34c`)로 명문화돼 있다.

---

## 4. 이질적 팀 니즈를 하나의 플러그인이 만족시키는 법

### 4.1 공통 코어 + 도메인 특화 골격

21개 agent MD를 실측한 결과 예외 없이 동일한 골격을 따른다: `frontmatter(name/description[/tools])` → `핵심 원칙` → `역할 경계` → `스킬 상세` → `학습 자료`. 이 골격 일관성 자체가 **"직원이 어느 에이전트 MD를 열어봐도 같은 위치에서 같은 정보를 찾을 수 있다"**는 발견가능성 계약이다. 새 에이전트를 추가하거나 기존 에이전트를 수정할 때 이 골격을 깨는 것은 곧 러닝커브 훼손이다.

### 4.2 도메인 대분류와 각 대분류의 설계 의무

| 대분류 | 소속 에이전트 | 이 대분류에 반드시 있어야 하는 요소 |
|---|---|---|
| 개발 | architect, backend-dev, frontend-dev, devops, qa-engineer, security | 트레이드오프 명시 의무(architect 4대 의무), 검증 등급 매핑(Sensitive=DB/권한/배포) |
| 기획 | planner, researcher, rfp-analyst, capture-strategist | 근거·출처 명시(external-research-and-citation), 요구사항 추적성 |
| 콘텐츠 | writer, presenter, localizer | 브랜드 스타일가이드 정본 참조, 직역 금지 원칙 |
| 비즈니스(실행력 보유) | marketer, finance | **승인 게이트 필수**(집행/투자는 계획까지만), 가정·산식·출처 명시 |
| 디자인 | ux-designer, visual-designer | 레퍼런스 벤치마킹 대조, 화면 캡처 검증 |
| 메타(오케스트레이션) | pm, trainer, evaluator, reviewer | 위임·검증·승격의 실행 권한, 다른 에이전트를 평가할 자격 |

**핵심 판정 기준 — "실행력 있는 도메인"에 대한 차등 게이트**: marketer/finance는 실제로 돈을 움직일 수 있는 결정을 만들어낸다. 이 두 에이전트는 이미 "집행 승인 필요 항목 표" / "가정 기반 시뮬레이션 명시"를 갖고 있다(실측 확인됨). **동일한 실행력을 가진 devops(배포)·security(취약점 공개·패치)도 같은 수준의 명시적 게이트 문구가 있는지가 전수 감사의 필수 항목이다**(§6-D). "실행력이 있는데 게이트가 없는 에이전트"는 이 방법론 기준으로 즉시 fail이다.

### 4.3 `tools:` 필드에 의한 최소 권한 원칙

marketer.md/finance.md는 frontmatter에 `tools: Read, Grep, Glob, Write, WebFetch, WebSearch`를 명시해 Bash/Edit을 원천 배제한다. 비개발 직원이 쓰는 에이전트일수록 "실수로 시스템을 건드릴 수 있는 도구"를 원천 차단하는 것이 러닝커브보다 우선하는 안전장치다. **감사 기준**: 코드를 직접 수정하지 않는 에이전트(marketer/finance/writer/presenter/researcher 등)에 `tools:` 필드가 없거나 Bash/Edit이 포함돼 있으면 fail 후보.

---

## 5. common-* 스킬 6종 판정 (유지/흡수/재편)

요청받은 대로 6종 전문을 읽고 판정했다. **이 판정은 최종 결정이 아니라 전수 감사 단계에서 재확인해야 할 "1차 소견"이다.**

| 스킬 | 판정 | 근거 |
|---|---|---|
| `common-task-grading-and-verification-depth` | **유지** | 5등급 체계가 전체 방법론의 축이다. risk_level(자율엔진 집행 게이트)과 이 문서의 검증등급을 혼동하지 말라는 각주까지 이미 정확히 분리돼 있다 — 이 명확성을 훼손하지 않아야 한다. |
| `common-token-efficient-collaboration` | **유지, 문구 재검증** | 원칙 자체는 견고하나(파일저장→경로반환, 턴예산), "malgnai-hub 기록 시 경로 포함" 예시가 `work_record`/`decision_record`/`issue_record`라는 **malgnai-mcp 시절 도구명**을 그대로 쓰고 있다 — pm.md는 이미 `decision_add`/`issue_add`/`activity_log`로 어댑테이션됐는데 이 스킬은 안 됐을 가능성이 있다. 전수 감사 필수 항목(§6-F)으로 지정. |
| `common-output-storage-and-path-management` | **재편 후보** | 저장소 위계 다이어그램이 `~/workspace/[프로젝트]/`, `~/.claude/skills/` 같은 **개인 로컬 절대경로 관례**를 예시로 쓰고 있다 — 회사 전체 배포판에서 각 직원의 실제 워크스페이스 경로와 다를 수 있다. malgn-project-standards 스킬(신규 작성분)과 내용이 겹치는지, 겹친다면 이쪽을 참조로 흡수 통합할지 판단 필요. |
| `common-beyond-mediocre-output` | **유지** | 4대 원칙(고유성/엣지케이스/트레이드오프/의존성 문서화)이 코드/문서/전략 산출물 모두에 범용 적용 가능하고, 실제로 architect.md·marketer.md·finance.md에 각기 "평범함을 넘는 기준"으로 도메인 특화되어 잘 계승되고 있다. |
| `common-product-principles-reference` | **조건화 필요** | `docs/product-principles.md`를 전제하는데 이는 **제품(코드) 개발 프로젝트 개념**이다. 마케팅 단독 리포트, 재무 단독 분석처럼 코드 프로젝트가 아닌 요청에도 이 스킬이 걸리면 "존재하지 않는 문서를 찾다가 멈추는" 불필요한 마찰이 생긴다. "product-principles.md가 없는 프로젝트/요청에서는 이 스킬을 생략한다"는 조건문이 스킬 본문에 명시돼야 한다(현재는 "원칙 부재 시 COO에 보고"로만 돼 있어 비개발 단독 작업에는 과함). |
| `common-learning-loop-knowledge-management` | **중복 확인 필요(흡수 후보)** | `learning-loop-patterns` 스킬과 목적 기술(전자: "교훈 기록→반영 폐쇄 루프", 후자: "작업전 확인→작업중 기록→작업후 자산화")이 상당히 겹친다. 이번 조사에서 `learning-loop-patterns` 전문은 읽지 않았으므로 **단정하지 않는다** — 전수 감사 시 두 파일을 나란히 놓고 실제 중복 문장 비율을 측정해 흡수(하나로 병합) 여부를 결정한다. |

---

## 6. 전수 감사 판정 rubric

파일 단위로 **pass/fail을 기계적으로 판정할 수 있는** 7개 카테고리. 각 항목은 "확인 방법"을 함께 명시해 감사자가 임의로 해석하지 않도록 한다.

**A. 이식성(Portability)** — fail 조건: `grep -rn "/Users/" <파일>` 또는 개인 브랜딩(예: 특정 개인 페르소나 이름) 잔존. 확인: `grep -rl` 전수 스캔, 표본 아닌 전체.

**B. 골격 일관성** — fail 조건: agent MD가 `frontmatter → 핵심원칙 → 역할경계 → 스킬상세 → 학습자료` 순서를 벗어남, 또는 `description`이 "언제 호출되는가"를 명시하지 않음(PM/사용자가 호출 시점을 판단할 수 없는 description은 fail).

**C. 발견가능성** — fail 조건: skill의 `description`이 트리거 조건 없이 막연함(예: "~에 도움을 준다"류), 또는 학습자료 섹션이 가리키는 경로(`knowledge/...`, `skills/.../SKILL.md`)가 실제로 존재하지 않음(broken link) → `find`로 존재 여부 기계 검증 가능.

**D. 권한/안전 게이트** — fail 조건: 실행력 있는 도메인(devops/security/marketer/finance) 에이전트에 "사람 승인 필요 항목" 또는 이에 상응하는 명시적 경계 문구가 없음. pass 예시: marketer.md/finance.md(확인됨).

**E. 검증깊이 정합** — fail 조건: 에이전트/스킬이 규정한 검증 절차가 `common-task-grading-and-verification-depth`의 5등급표와 모순됨(예: Sensitive급 작업인데 약식 검증만 요구).

**F. malgnai-hub 어댑테이션 정합** — fail 조건: malgnai-mcp 전용 도구명(`lesson_add`, `memory_add`, `work_record`, `decision_record`, `issue_record`, `wbs_*`의 malgnai-mcp 버전 시그니처 등)이 malgnai-hub 연동판 문서에 "해당 없음" 처리 없이 그대로 호출 예시로 남아있음. pm.md는 이미 명시적으로 처리(52행, 63행, 206행, 253행)했으나 skills/knowledge 61+35개 전체는 미검증 — **가장 우선순위 높은 감사 항목**.

**G. 의존성 무결성** — fail 조건: 문서 A가 참조하는 파일 B가 실재하지 않거나, `bin/promote-*.mjs`처럼 STATUS.md에 이미 "미번들"로 기록된 도구를 여전히 실행 가능한 것처럼 서술함(이슈 `929edddc`: trainer.md/evaluator.md의 승격 파이프라인 도구 미번들, 이슈 `c3ef5744`: screen-verification-and-capture가 개인 설치 `shot` CLI 전제 — 이 두 건은 이미 known-issue이므로 감사에서 새로 "발견"할 필요 없이 곧바로 재작성 대상으로 승격).

---

## 7. "전체 재작성" vs "국소 패치" 판정 임계값

| 판정 | 조건 | 처리 |
|---|---|---|
| **국소 패치로 충분** | A/G 위반이 grep 1회로 전량 특정·수정 가능한 개인화 잔존·broken link 수준 | trainer에게 일괄 치환 위임 → reviewer 약식 검증 |
| **해당 에이전트/스킬만 재작성** | D(게이트 누락) 또는 F(malgnai-hub 어댑테이션 실패)가 그 파일 하나의 실행 가능성 자체를 막음(예: 존재하지 않는 도구 호출로 매 실행 실패) | 해당 파일 단위 재작성 + reviewer 풀패널(Sensitive급 취급) |
| **트랙 전체 재작성** | 같은 결함(F 또는 G)이 카테고리 내 30% 이상 파일에서 반복 발견되거나, 이미 STATUS.md에 구조적 재설계가 필요하다고 기록된 known-issue(`929edddc` 승격 파이프라인, `c3ef5744` 캡처 인프라)에 해당 | architect 참여해 대안 설계부터(예: 승격 파이프라인을 malgnai-hub 네이티브 기능으로 재설계할지, 로컬 스크립트를 플러그인에 번들할지) — 패치가 아니라 설계 결정이 선행돼야 함 |
| **방법론 자체 재검토** | common-* 6종 중 2개 이상에서 상충하는 지시(예: 두 스킬이 같은 상황에 다른 저장 경로를 요구)가 발견 | 이 문서(E안) 자체를 개정 |

**판정 절차**: evaluator가 rubric A~G로 파일별 채점 → 카테고리별 fail 비율 집계표 작성 → PM이 위 표로 GO/NO-GO 결정 → `decision_add`(importance는 "패치"면 2~3, "트랙 전체 재작성"이면 4~5)로 근거 기록.

---

## 8. 판단 예시 3가지 (검증용 시나리오)

1. **"이번 캠페인 리포트 정리해줘"(마케팅 신입, 에이전트 이름 모름)** → §2 Q4(도메인 판단 필요)로 명시호출 대상이지만 사용자가 이름을 모르므로 PM이 대신 marketer로 위임해야 한다. PM이 위임하지 않고 직접 리포트를 쓰면 골격 위반(§4.1)이자 L1 계약 위반.
2. **backend-dev가 "이 정도면 배포해도 되겠다"며 배포 스크립트를 스스로 실행하려는 상황** → §2 Q1(비가역·대외영향)=YES이므로 devops의 게이트 문구가 있어야 하고, backend-dev 역할 경계에도 "배포는 devops 영역"이 명시돼 있어야 한다(architect.md는 이미 "구현/배포는 손대지 않는다"로 자기 경계를 긋고 있다 — 동일 패턴이 backend-dev.md에도 있는지가 감사 항목).
3. **knowledge 파일 하나에 특정 개인의 홈 디렉터리 경로가 남아있는 것을 발견** → §6-A fail. 국소 패치(§7 1행)로 충분하며 트랙 전체 재작성 사유는 아니다. 다만 같은 패턴이 61개 knowledge 파일 중 다수에서 반복되면 §7 3행(트랙 전체)로 격상.

---

## 9. 다음 단계 제안

1. 이 문서를 근거로 evaluator에게 §6 rubric A~G 전수 채점을 위임(대상: agents 21 + skills 35 + knowledge 61 = 117개 파일).
2. §5의 "조건화/중복 확인 필요" 판정을 받은 3개 스킬(`common-output-storage-and-path-management`, `common-product-principles-reference`, `common-learning-loop-knowledge-management`)은 우선순위를 높여 먼저 확정한다 — 나머지 감사의 기준선이 되기 때문이다.
3. §6-F(malgnai-hub 어댑테이션 정합)를 최우선 감사 항목으로 지정 — 실행 실패로 직결되는 결함이라 발견 즉시 사용자 영향이 있다.
4. 감사 결과는 STATUS.md 열린 이슈 3건(`929edddc`, `c3ef5744`, `f1913b79`)과 병합해 하나의 우선순위 목록으로 정리한다.
