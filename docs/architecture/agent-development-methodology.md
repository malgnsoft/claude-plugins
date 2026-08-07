# 맑은소프트 에이전트 개발방법론 (초안 A안 v0.1)

> 작성: architect 위임 산출물 · 작성일 2026-08-07
> 목적: `malgn-agent` 플러그인(agents 21종·skills 35종·knowledge 61개·hooks 2종)의 **기존 전수 감사**와 **전체 재작성** 판정 기준(rubric)으로 그대로 쓴다. 추상 선언이 아니라 "이럴 때는 이렇게 판단한다"는 실행 가능한 규칙만 담는다.
> 지위: 초안(A안). 확정 전 reviewer 검증 대상 — 특히 §7의 폐기/재작성 권고는 PM 승인 후 실행.

---

## 0. 전제 — 이미 있는 것을 무시하지 않는다

이 저장소에는 이미 교차 관심사를 encode한 6개 `common-*` 스킬(`common-beyond-mediocre-output`, `common-task-grading-and-verification-depth`, `common-token-efficient-collaboration`, `common-output-storage-and-path-management`, `common-product-principles-reference`, `common-learning-loop-knowledge-management`)과, Skill/Knowledge 경계를 이미 정의한 `knowledge/common/skill-vs-knowledge-boundary.md`가 존재한다. 이 방법론은 그것들을 **대체하지 않고 채택·정합화**한다. 새로 발명한 개념은 §5(명명규칙 재정렬)와 §7(감사 판정)뿐이며, 나머지는 기존 문서의 판정 기준을 실행 가능한 형태로 명시화한 것이다.

동시에, 조사 과정에서 **기존 knowledge 문서 중 실제 코드베이스와 어긋난 것**을 발견했다(§7.3). 이 방법론은 그 드리프트를 "정답"으로 취급하지 않고, 실제 파일 구조(agents 21개, skills 35개의 실제 이름과 frontmatter)를 관찰해 역으로 규칙을 도출했다. **문서보다 코드가 진실**이라는 이 프로젝트의 기존 원칙(`doc-drift` 가드)을 방법론 수립에도 동일 적용한 결과다.

---

## 1. 4계층 모델 — 정의와 책임 경계

| 계층 | 담는 것 | 읽히는 시점 | 변경 빈도 | 독자 |
|---|---|---|---|---|
| **Agent** (`agents/*.md`) | 역할 정체성, 핵심 원칙(≤5개 급의 압축 규범), 역할 경계, 산출물 게이트, knowledge/skill 참조 경로 목록 | 해당 역할로 호출될 때 항상 전량 로드 | 낮음 (역할 자체가 바뀔 때만) | Claude Code 런타임(subagent 시스템 프롬프트) |
| **Skill** (`skills/*/SKILL.md`) | "무엇을 하라/하지 마라"는 실행형 체크리스트·절차. description 기반으로 **필요할 때만** 매칭되어 로드됨 | description이 현재 작업과 매칭될 때 동적 로드 | 중간 (절차가 바뀌면) | 여러 에이전트가 공유 참조 |
| **Knowledge** (`knowledge/**/*.md`) | 왜 그 규칙이 필요한가 — 배경, 사고사례, 트레이드오프, 심화 참조자료 | 에이전트가 Read 도구로 명시 호출할 때만 | 낮음 (역사적 기록이라 거의 불변, 추가만 함) | 필요할 때 pull하는 참조 자료 |
| **Hook** (`hooks/*`) | 세션 생애주기 이벤트에 자동 개입하는 코드(컨텍스트 주입/리마인드) | SessionStart/Stop 등 이벤트마다 **매번 무조건 실행** | 매우 낮음 (전역 정책이라 신중) | 모든 세션, 예외 없이 |

**핵심 차이는 "로드 비용"과 "강제성"이다.** Agent는 항상 전량 로드되므로 짧아야 하고(현재 사실상 표준: 원칙 5개 이내 + 경로 목록), Skill은 필요할 때만 골라 로드되므로 절차를 상세히 담아도 무방하며, Knowledge는 명시 호출 전까지 전혀 로드되지 않으므로 가장 길어도 된다. Hook은 매 세션 무조건 실행되므로 **토큰·시간 비용이 0에 수렴하지 않으면 안 된다**(아래 §4).

---

## 2. 언제 새 에이전트를 만들고, 언제 기존 에이전트에 스킬을 붙이는가

### 2.1 판정 질문 (순서대로 적용)

1. **호출자가 다른가?** — PM이 팀 구성 표(`pm.md` "권위자 매핑")에서 이 요청을 누구에게 넘겨야 명확한가? 기존 21개 에이전트 중 "이 산출물의 최종 책임자"로 지목할 대상이 없으면 새 에이전트 후보다. 있으면 스킬 후보다.
2. **산출물의 성격이 다른가, 절차만 다른가?** — 새 요청이 기존 에이전트와 **다른 파일/문서 종류**를 만드는가(예: architect는 `docs/architecture.md`를 만드는데 이번 요청은 재무모델 `docs/financial-model.md`를 만든다) → 새 에이전트. 같은 산출물 종류인데 **특정 상황에서 절차만 추가**된다(예: backend-dev가 만드는 API인데 이번엔 서버리스/엣지 스택이라 추가 체크리스트가 필요하다) → 기존 에이전트 + 스킬.
3. **역할 경계가 이미 있는 에이전트와 겹치는가?** — 겹치면(예: "재무도 보고 마케팅도 보는 신규 에이전트") 새 에이전트를 만들지 말고 기존 두 에이전트를 순차 위임하는 팀 구성으로 해결한다. **에이전트 경계는 산출물 종류로 나뉘어야지, 업무 크기로 나뉘면 안 된다.**
4. **역량이 여러 에이전트에 공통으로 필요한가?** — 2개 이상의 기존 에이전트가 동일 절차를 필요로 하면 새 에이전트가 아니라 **스킬**이다(에이전트를 늘리면 같은 절차가 N군데 중복 인라인된다). 예: `domain-backend-security-audit`은 backend-dev 전용이 아니라 security와도 공유될 수 있는 절차라 스킬로 분리되어 있다.

### 2.2 반례로 검증

- `localizer`는 새 에이전트가 정당하다 — 산출물(용어집 감사·번역)이 writer/marketer와 다르고, "직역 금지·업계 관용표현" 판단은 다른 에이전트가 겸업하기엔 전문성 폭이 좁고 깊다.
- 반대로 "AI 검색 기능 전문 에이전트"를 새로 만드는 것은 **부당**하다 — 산출물은 여전히 backend-dev의 `docs/api-spec.md`/`src/`이고, 필요한 것은 `knowledge/backend/search-strategy-vector-vs-fulltext.md` 참조 경로 하나 추가뿐이다. 실제로 이 저장소는 이렇게 처리되어 있다(새 에이전트 없이 backend-dev·architect MD의 "학습 자료" 섹션에 조건부 참조로만 추가됨) — **올바른 선례**로 채택한다.

### 2.3 새 에이전트 생성 시 필수 요소

- `agents/*.md` 프런트매터: `name`(kebab-case, 파일명과 동일), `description`(PM이 팀 구성 시 매칭할 수 있도록 "무엇을 받아 무엇을 만드는가" + "누가 호출하는가" 명시), 필요시 `tools`(§4).
- 본문 최소 구성(현재 21개 에이전트가 실제로 따르는 사실상 표준, `knowledge/leadership/agent-md-format-standard.md`가 제안하는 스킬점수표 포맷과는 다름 — §7.3 참조): `핵심 원칙` → `역할 경계`(호출자/범위/경계) → `스킬 상세`(있으면) → `전제 조건` → `자기 검증` 체크리스트 → `산출물` → `학습 자료`(필수/참고 2단) → `토큰 효율`.
- **역할 경계 섹션은 반드시 "무엇을 하지 않는가"를 포함**한다 — 예: architect는 "구현은 backend-dev 영역, 손대지 않는다"를 명시. 이게 없으면 신설 에이전트가 위임 범위를 스스로 확장하는 실패 패턴(`pm.md`가 실제로 경계했던 문제)이 재발한다.

---

## 3. Skill과 Knowledge의 경계

기존 `knowledge/common/skill-vs-knowledge-boundary.md`(규칙 1~5)를 **그대로 채택**한다. 요약과 실행 가능한 판정법만 여기 재수록:

### 3.1 문체 판정법 (규칙 1)
독자가 "아, 그럼 이렇게 해야겠네"라고 반응하면 **Skill**, "아, 그래서 이런 규칙이구나"라고 반응하면 **Knowledge**. 실무 판정 질문: 이 문단에서 "왜"라는 단어를 빼도 내용이 온전한가? → 온전하면 Skill(체크리스트로 압축 가능), 빠지면 뜻이 통하지 않으면 → Knowledge.

### 3.2 링크 방향 (규칙 2, 절대)
Skill → Knowledge 참조는 허용(예: backend-dev.md의 "ℹ️ Skill: domain-backend-security-audit 참조"), **Knowledge → Skill 참조는 금지**. Knowledge가 Skill을 "증명"하려 들면 순환 참조가 생긴다. 위반 예시를 찾으면(예: 배경 설명 문서가 "따라서 X 스킬을 따르라"고 지시형으로 끝맺으면) 그 지시문은 Skill로 옮기고 Knowledge에는 배경만 남긴다.

### 3.3 실제로 잘 작동한 선례 — 이관 패턴
이 저장소는 이미 "Knowledge 본문을 Skill로 이관하고 Knowledge에는 배경·출처만 남긴다"는 이관을 여러 번 실행했다(`knowledge/README.md`에 2026-07-23~24 날짜로 기록된 8건: `shipley-proposal-process.md`→`skills/shipley-proposal-methodology`, `system-design-patterns.md`→`skills/architecture-patterns-reference`, `visual-design-system.md`→`skills/visual-design-token-system` 등). 이것이 **정본 이관 절차**다:
1. Knowledge 파일의 실행형 문단(체크리스트·절차·템플릿)을 골라낸다.
2. 새/기존 Skill로 옮기고 SKILL.md 형식(frontmatter `name`+`description`, 본문에 체크리스트)으로 재구성한다.
3. 원 Knowledge 파일에는 "(YYYY-MM-DD 본문은 skills/X로 이관) 배경·출처만 남음" 한 줄과 실제 배경 서술만 남긴다 — **삭제하지 않는다**(연혁 추적성).
4. 참조하던 에이전트 MD의 경로를 함께 갱신한다(`grep -rl`로 역참조 전수 확인 — `pm.md` lesson `5ea6cb19`와 동일 원칙).

### 3.4 이미 올바른 짝 — 감사 시 참고 기준점
`knowledge/common/beyond-mediocre-output.md`(41줄, "신설 사유"+사고사례+5가지 냄새)와 `skills/common-beyond-mediocre-output/SKILL.md`(100줄, 4대 원칙+체크리스트)는 **경계가 정확히 지켜진 모범 사례**다. 신설 사유·사고사례는 knowledge에만, 체크리스트·판정 기준은 skill에만 있고 중복 서술이 없다. `token-efficient-collaboration` 짝도 동일하게 건강하다. 감사 시 이 두 쌍을 "정답 예시"로 놓고 다른 24개 knowledge 파일과 대조한다.

### 3.5 신설 여부 판정 트리
```
이 내용이 "무엇을 하라"인가?
├─ YES → 명령형·3~5분 분량인가?
│         ├─ YES → Skill (여러 에이전트가 재사용 가능하면 우선순위 상향)
│         └─ NO  → 왜/사고사례/트레이드오프가 있는가?
│                   ├─ YES → Knowledge
│                   └─ NO  → 미완성. 다시 쓴다.
└─ NO(설명형) → Knowledge
```
프로젝트 1회성 특수 사례("A 프로젝트에서만 해당")면 knowledge에도 넣지 않는다 — 그 프로젝트의 STATUS.md/malgnai-hub로 보낸다(이 플러그인은 회사 전체 배포용이라 프로젝트 특수 교훈이 섞이면 이식성이 깨진다).

---

## 4. 훅(Hook)은 언제만 정당화되는가

훅은 4계층 중 유일하게 **매 세션 무조건·자동 실행**되며 사용자가 로드 여부를 선택할 수 없다. 이 때문에 정당화 기준이 가장 엄격해야 한다. 아래 4개 조건을 **모두** 만족해야 신설을 검토한다(하나라도 실패하면 Skill이나 Agent 원칙으로 대체):

1. **이벤트 트리거 필연성** — 그 개입이 특정 세션 생애주기 이벤트(SessionStart/Stop 등)에서만 유효한가? 언제든 에이전트가 스스로 "지금 확인해야지"라고 판단할 수 있는 것이면 훅이 아니라 Skill/Agent 원칙이다. 예: "STATUS.md 자동 주입"은 세션 시작 시점이 아니면 의미가 없다(SessionStart 필연).
2. **무해 시 0비용** — 개입할 것이 없을 때 토큰·프롬프트 오염이 0이어야 한다. `session-context.mjs`는 STATUS.md도 드리프트도 없으면 빈 문자열을 반환한다. `hook-stop-mcp-reminder.cjs`는 이번 턴에 기록할 실질 작업이 없으면(Read/Grep만 썼으면) 리마인더를 건너뛴다. **"혹시 몰라서 매번 경고"는 기준 미달**이다.
3. **강제(enforcement)가 아니라 주입/리마인드** — 훅이 작업을 막거나(exit code로 차단) 자동으로 무언가를 고치면 안 된다(그 경우 되돌리기 어려운 부작용의 책임 소재가 불분명해진다). 현재 2개 훅은 모두 `additionalContext`를 주입하거나 리마인드 텍스트를 얹을 뿐, 아무것도 막지 않는다. 차단이 필요한 정책은 훅이 아니라 CI/서버 측 검증으로 옮긴다.
4. **모든 세션·모든 프로젝트에 보편 타당** — 특정 프로젝트/특정 에이전트에만 의미 있는 로직이면 훅이 아니라 그 프로젝트의 `.claude/doc-drift.json` 매니페스트나 해당 에이전트의 원칙으로 넣는다. 훅 자체는 제네릭(`doc-drift.mjs`처럼 매니페스트로 프로젝트별 차이를 흡수)이어야 한다.

**신설 훅 후보를 평가하는 예시 질문**: "PR 생성 전 lint를 강제로 돌리는 훅"은? → 조건 3(강제) 위반 가능성 높음(차단형) → 훅보다는 qa-engineer 스킬의 자기검증 체크리스트나 CI로. "매 세션 시작 시 malgnai-hub에서 최근 decision 3개를 요약해 주입"은? → 조건 1 필연(세션 시작 시점 의미), 조건 2 확인 필요(decision이 없으면 0비용인가), 조건 3 통과(주입뿐), 조건 4 통과(전 프로젝트 보편) → **정당화 가능, 단 조건 2를 구현으로 검증 후 채택**.

---

## 5. 중복·응집도·재사용성 판정

### 5.1 중복 판정 — "80% 겹침 테스트"
신규 산출물(에이전트/스킬/knowledge) 작성 전, 기존 자산이 요구의 80% 이상을 이미 커버하는지 먼저 확인한다(`grep -r` 키워드 검색 1회). 80% 이상 겹치면 **새로 만들지 않고 기존 자산을 확장**한다. 이 저장소에는 이미 실패 사례가 있다 — `domain-backend-security-audit`(malgnai 스택 특화 3대 보안 규약)과 `domain-backend-api-security`(범용 API 보안 체크리스트)와 `domain-serverless-edge-api-security`(Cloudflare/Workers 특화)가 서로 다른 스코프임을 각 SKILL.md description에 "이 스킬은 그와 중복 없이…" 라고 **명시적으로 선언**하고 있다 — 이것이 올바른 처리다: 겹칠 위험이 있는 스킬끼리는 description에 서로의 경계를 상호 참조해 명시한다. 감사 시 이 상호 참조가 실제로 겹치지 않는지(각 스킬의 체크리스트 항목을 나열해 교집합 확인) 검증한다.

### 5.2 응집도 판정 — 단일 책임 테스트
스킬/knowledge 파일 하나가 "서로 다른 트리거 문맥에서 호출되는 두 가지 이상의 무관한 절차"를 담고 있으면 응집도 위반이다. 판정법: SKILL.md의 `description`을 한 문장으로 다시 요약해봤을 때 "그리고"로 연결된 두 가지 목적이 나오면 분리 후보다. 예: `a4-vertical-layout`(A4 세로 인쇄 문서 배치)과 `visual-design-token-system`(디자인 토큰 체계)이 분리되어 있는 것은 올바르다 — 하나는 "페이지네이션 알고리즘", 다른 하나는 "색상/타이포 변수 체계"로 트리거 문맥이 다르다.

### 5.3 재사용성 판정 — 승격/강등 기준
- **개인 스킬 → malgn-agent 편입 기준**: 이 회사 소속 다른 프로젝트에서 3회 이상 재사용될 것으로 예상되거나, 이미 재사용된 실적이 있는가? 재사용 문맥이 특정 프로젝트의 특이성(그 프로젝트만의 스키마·브랜드명 등)에 의존하지 않는가? 두 조건 모두 충족해야 편입한다. 편입 경로: trainer가 초안 이식 → reviewer 검증 → PM이 malgn-agent에 병합.
- **malgn-agent 내부 스킬 → 세분화(강등) 기준**: 특정 에이전트 1명만 쓰는데도 범용처럼 이름 붙어 있으면(예: 실제로는 backend-dev 전용인데 `common-*` 접두어) 이름과 배치를 재조정한다. 판정: 이 스킬을 실제로 참조하는 에이전트 MD를 `grep -rl`로 세어본다 — 1개면 그 에이전트 전용으로 재명명, 2~4개면 도메인 스킬, 5개 이상(21개 중 과반)이면 `common-*` 유지.
- 중요: **스킬 매칭은 파일명이 아니라 SKILL.md의 `description` 프런트매터로 이뤄진다.** 접두어(`common-`/`domain-`) 자체는 Claude Code 런타임 동작에 영향을 주지 않는다 — 이것은 **사람이 감사·grep할 때 쓰는 거버넌스 신호**일 뿐이다. 따라서 "이름이 범용처럼 보이는데 실제로는 좁다"는 불일치가 곧 audit finding이다.

---

## 6. 도구 권한(Tools) 부여 원칙

21개 에이전트 프런트매터를 실측한 결과(2026-08-07), `tools:` 필드는 **6개 에이전트에만** 명시되어 있다 — `capture-strategist`, `finance`, `localizer`(Edit/Bash 포함), `marketer`, `rfp-analyst`(Bash 포함), `writer`. 나머지 15개(architect/backend-dev/pm/devops/frontend-dev/planner/qa-engineer 등 구현·조율계)는 `tools:` 미지정 → 기본값(전체 도구) 사용. 이 관측에서 다음 원칙을 도출한다:

1. **기본값(미지정)은 "코드/구성 변경이 본질인 역할"에만 허용한다** — architect/backend-dev/frontend-dev/devops/qa-engineer/pm/trainer/evaluator/security처럼 Edit·Write·Bash로 실제 파일을 만들고 고치는 것이 산출물 자체인 에이전트는 도구를 제한하면 일을 할 수 없다.
2. **분석·조사·집필 전용 역할은 명시적으로 좁힌다** — finance/marketer/researcher/capture-strategist/rfp-analyst처럼 산출물이 "문서"이고 대상 코드베이스를 고칠 이유가 구조적으로 없는 역할은 `Read, Grep, Glob, Write, WebFetch, WebSearch`류로 제한해, 실수로 프로젝트 소스를 건드리는 사고를 원천 차단한다. **Edit을 넣지 않고 Write만 주는 이유**: 이들의 산출물은 신규 보고서/문서 생성이지 기존 코드 수정이 아니므로, Edit 권한이 없어도 목적을 100% 달성할 수 있다.
3. **Bash·Edit을 좁은 역할에 예외적으로 추가할 때는 사유가 명확해야 한다** — `localizer`는 Edit+Bash를 가진다(다국어 파일을 대량 치환해야 하므로), `rfp-analyst`는 Bash를 가진다(제출 서류 포맷 검사 스크립트 실행 등). 이런 예외는 description이나 핵심 원칙에 "왜 이 권한이 필요한가"가 드러나야 하며, 드러나지 않으면 감사에서 과다 권한(over-privilege)으로 표시한다.
4. **신규 에이전트의 tools 결정 절차**: (a) 이 역할의 산출물이 코드/구성 변경인가 → 예: 미지정(전체 도구). (b) 산출물이 문서/보고서뿐인가 → 예: `Read, Grep, Glob, Write, WebFetch, WebSearch` 기본 세트에서 시작. (c) 기본 세트에 없는 도구가 필요한가 → 필요하면 최소한만 추가하고 이유를 핵심 원칙에 1줄 기록.
5. **과다 권한이 낳는 구체적 실패 시나리오**: writer(문서 작성)가 Bash를 가지면, "참고 자료를 찾겠다"며 프로젝트 빌드/배포 스크립트를 실행해 devops 영역을 침범할 수 있다 — 이는 pm.md가 이미 명시한 "위임 범위 명시 필수"(거버넌스 필드는 금지 목록에 포함) 원칙의 도구 버전이다. 감사 시 "이 에이전트가 가진 도구로 역할 경계 밖의 파일을 건드릴 수 있는가"를 각 에이전트마다 1회 점검한다.

---

## 7. 명명 규칙과 디렉토리 구조 표준

### 7.1 Agent
- 파일: `agents/<role>.md`, `<role>`은 kebab-case 명사(직무명), frontmatter `name`과 동일.
- 산출물 폴더는 프로젝트 표준(`docs/`, `src/`, `output/`)을 그대로 따르고 에이전트별 전용 폴더를 만들지 않는다(현재 21개 전원 준수).

### 7.2 Skill — 3단 접두어 규칙 (관측 기반 재정렬)
실제 35개 스킬을 전수 확인한 결과 접두어 사용 비율은 `common-*` 6개, `domain-*` 5개, 무접두어(설명형 고유명사) 24개다. 이것을 **의도적 표준**으로 명문화한다:

| 접두어 | 적용 기준 | 배치 |
|---|---|---|
| `common-*` | §5.3의 "5개 이상(과반)" 기준 통과 — 거의 모든 에이전트가 참조하는 운영 규율 | `skills/common-<name>/SKILL.md` |
| `domain-*` | 특정 기술 스택/보안 도메인에 묶여 2~4개 에이전트가 공유 (예: 서버리스 엣지 스택, Vue-Zero 플랫폼) | `skills/domain-<name>/SKILL.md` |
| 무접두어 | 특정 방법론/절차 1건을 캡슐화, 주로 1~2개 에이전트(또는 하나의 협업 클러스터, 예: 제안서 작성 클러스터)가 참조 | `skills/<name>/SKILL.md` |

**신설 스킬은 배치 전 이 표에 스스로를 대조해 접두어 유무를 정한다.** 접두어를 실제 사용 범위보다 넓게 붙이면(예: 1개 에이전트만 쓰는데 `common-`) 감사에서 즉시 재명명 대상이 된다(§5.3 grep 카운트 기준).

### 7.3 Knowledge
- 경로: `knowledge/<domain>/<topic>.md`, `<domain>`은 `knowledge/README.md`의 폴더-대상 매핑 표를 따른다(신규 도메인 폴더 생성 시 그 표에 즉시 추가).
- 이관형 문서(§3.3)는 삭제하지 않고 "본문은 skills/X로 이관, 배경만 남음" 스텁을 유지한다.
- **발견된 드리프트(감사 우선순위 최상위 후보, 이번 작업 범위 밖 — 별도 위임 필요)**:
  - `knowledge/common/global-skill-architecture.md`와 `knowledge/common/skill-discovery-and-reuse-guide.md`는 `~/.claude/skills/common-deep-research.md`, `common-dataviz.md`, `common-code-review.md` 등 **이 플러그인에 존재하지 않는 스킬명**과 `~/.claude/skills/` 개인 경로를 정본처럼 서술한다. 실제 malgn-agent의 6개 `common-*`/5개 `domain-*` 스킬명과 전혀 매핑되지 않는다 — 개인 전역 설정에서 이식되며 미조정된 것으로 추정된다. **재작성 또는 archive 필요.**
  - `knowledge/leadership/agent-md-format-standard.md`는 "역할/팀/모델/스킬 정의 점수표/경험 이력" 포맷을 표준으로 제시하지만, 실측한 21개 에이전트 MD 중 이 포맷을 따르는 것은 0개다(실제 표준은 §2.3에 기술한 구조). **이 방법론 §2.3을 반영해 재작성하거나, §2.3 자체를 이 문서의 후속 갱신 대상으로 지정 필요.**
  - 이 두 사례는 "문서만 있고 실물과 대조되지 않은 채 방치된 지식"의 전형이다 — §8 감사 체크리스트에 일반 규칙으로 반영한다.

### 7.4 Hook
- 경로: `hooks/<event>-<purpose>.mjs|cjs`, `hooks/hooks.json`에 `${CLAUDE_PLUGIN_ROOT}` 상대경로로만 등록(개인 절대경로 금지).

---

## 8. 감사 체크리스트 (전수 감사 실행용)

각 산출물(에이전트/스킬/knowledge/훅)마다 아래를 판정하고 위반 시 findings로 기록한다.

**Agent 대상**
- [ ] `description`만으로 PM이 팀 구성 시 이 에이전트를 다른 에이전트와 헷갈리지 않고 선택할 수 있는가?
- [ ] `역할 경계`에 "무엇을 하지 않는가"가 명시되어 있는가?
- [ ] `tools` 필드가 §6 원칙과 일치하는가(문서/분석 전용인데 미지정 = 과다 권한 후보)?
- [ ] 참조하는 knowledge/skill 경로가 실제로 존재하는가(dead link 여부, `test -f`로 기계 확인)?
- [ ] 개인 절대경로(`/Users/hopegiver/...`, `~/.claude/...`)가 남아있지 않은가(포터빌리티 위반)?

**Skill 대상**
- [ ] `description`이 "언제 쓰는가"를 다른 스킬과 구분되게 명시하는가(§5.1 상호 참조 존재 여부)?
- [ ] 접두어가 §7.2 표의 실제 사용 범위(참조 에이전트 수)와 일치하는가?
- [ ] Knowledge를 참조한다면 방향이 Skill→Knowledge 단방향인가(§3.2)?
- [ ] 참조 깊이가 2단계(Skill→Skill/Knowledge→그 다음 1단계)를 넘지 않는가?
- [ ] 다른 스킬과 80% 이상 내용이 겹치지 않는가(§5.1)?

**Knowledge 대상**
- [ ] 문체가 설명형(왜/배경/사례)이고 명령형 체크리스트가 섞여 있지 않은가(섞였으면 Skill로 이관 후보, §3.3 절차 적용)?
- [ ] `knowledge/README.md`의 폴더-내용 목록에 등재되어 있는가?
- [ ] 실제 코드/실제 스킬 목록과 서술이 일치하는가(§7.3 드리프트 사례처럼 존재하지 않는 대상을 정본으로 서술하지 않는가)?
- [ ] Knowledge→Skill 지시형 링크가 없는가(§3.2 위반 여부)?

**Hook 대상**
- [ ] §4의 4개 조건을 모두 통과하는가?
- [ ] 무해 입력(빈 STATUS.md, 기록할 것 없는 턴)에서 실제로 0바이트/스킵을 반환하는가(코드로 직접 확인)?
- [ ] `${CLAUDE_PLUGIN_ROOT}` 기준 상대경로만 쓰는가?

---

## 9. 열린 질문 (reviewer 검증 필요)

1. §7.2의 "5개 이상 참조 = common" 임계값이 21개 에이전트 규모에 적정한가, 아니면 비율(예: 30%)로 정의해야 확장에 안정적인가.
2. §6에서 제시한 기본 도구 세트(`Read, Grep, Glob, Write, WebFetch, WebSearch`)를 명시적 표준으로 6개 에이전트 MD에 역기재할지, 관측치로만 남길지.
3. §7.3에서 지목한 두 knowledge 드리프트 문서(`global-skill-architecture.md`, `skill-discovery-and-reuse-guide.md`, `agent-md-format-standard.md`)의 처리(재작성 vs archive)는 이 방법론이 결정하지 않는다 — 별도 trainer/evaluator 위임 필요.
