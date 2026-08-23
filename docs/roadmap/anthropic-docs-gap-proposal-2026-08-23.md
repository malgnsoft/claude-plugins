---
created: 2026-08-23
author: trainer
status: DRAFT (제안 — 채택 여부는 사용자 판단)
tags: [anthropic-docs, gap-analysis, plugin-spec, defect]
---

# Anthropic 공식 문서 대조 갭 분석 — 개선 제안 1건

**범위**: 공식 문서를 실제 조회해 `malgn-agent/` v1.7.6 현재 상태와 대조하고, 효과가 가장 큰 개선 1건을 선정한다.
**이번 라운드에서 `malgn-agent/` 아래 파일은 하나도 수정하지 않았다.** 산출물은 이 제안서뿐이다.

---

## 1. 조회한 공식 문서

전부 WebFetch로 직접 열어 읽었다. 기억에 의한 인용은 없다.

| # | URL | 상태 | 이 문서에서 취한 핵심 권고 (직접 인용) |
|---|-----|------|----------------------------------------|
| 1 | `https://code.claude.com/docs/en/plugins-reference` | 200 | **"`bin/` — Executables added to the Bash tool's `PATH`. Files here are invokable as bare commands in any Bash tool call while the plugin is enabled"** / `${CLAUDE_PLUGIN_ROOT}`는 **"Skill and agent content — anywhere the placeholder appears"**에서 치환된다 / "`${CLAUDE_PLUGIN_ROOT}` changes when the plugin updates... treat it as ephemeral" |
| 2 | `https://code.claude.com/docs/en/sub-agents` | 200 | "Claude uses each subagent's description to decide when to delegate tasks" / `skills:` 필드 — "inject skill content into a subagent's context at startup... without requiring it to discover and load skills during execution" / `model` 생략 시 "defaults to `inherit`" / "Grant only necessary permissions for security and focus" |
| 3 | `https://code.claude.com/docs/en/skills` | 200 | 프론트매터 전 필드표. "All fields are optional. Only `description` is recommended" / description+when_to_use는 **"truncated at 1,536 characters in the skill listing"** / `disable-model-invocation`, `allowed-tools`, `paths`, `context: fork` 등 |
| 4 | `https://code.claude.com/docs/en/plugins` | 200 | "Don't put `commands/`, `agents/`, `skills/`, or `hooks/` inside the `.claude-plugin/` directory" / `claude plugin validate ./your-plugin` 권고 |
| 5 | `https://code.claude.com/docs/en/hooks` | 200 | 전체 훅 이벤트 30종(PreToolUse·PostToolUse·SubagentStop·UserPromptSubmit 등). "Exit 2 means a blocking error" — 하드 게이트는 exit 2뿐 |
| 6 | `https://code.claude.com/docs/en/best-practices` | 200 (구 `anthropic.com/engineering/claude-code-best-practices`에서 308 리다이렉트) | "CLAUDE.md is loaded every session, so only include things that apply broadly... use skills instead" / **"For each line, ask: 'Would removing this cause Claude to make mistakes?' If not, cut it"** / **"Unlike CLAUDE.md instructions which are advisory, hooks are deterministic and guarantee the action happens"** / "Give Claude a check it can run" |
| 7 | `https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills` | 200 | "Progressive disclosure is the core design principle" (3단계: 메타데이터 → SKILL.md 본문 → 링크 파일) / "Skills can also include code for Claude to execute as tools at its discretion" / "iterate based on observations" |
| 8 | `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents` | 200 | "context must be treated as a finite resource with diminishing marginal returns" / "find the smallest possible set of high-signal tokens" |
| 9 | `https://www.anthropic.com/engineering/writing-tools-for-agents` | 200 | "More tools don't always lead to better outcomes" / **"prompt-engineer your error responses to clearly communicate specific and actionable improvements, rather than opaque error codes"** |
| 10 | `https://www.anthropic.com/engineering/building-effective-agents` | 200 | "Finding the simplest solution possible" / "consider adding complexity *only* when it demonstrably improves outcomes" / "Tool definitions and specifications should be given just as much prompt engineering attention as your overall prompts" |
| — | `https://code.claude.com/docs/en/plugin-components` | **404 (죽은 링크)** | 위임 지시서에 있던 URL이나 실재하지 않는다. 해당 내용의 정본은 #1 `plugins-reference`다. |

> 미조회: `/docs/en/memory`, `/docs/en/slash-commands`, `/docs/en/settings`, `/docs/en/mcp`, `/docs/en/common-workflows`는 열지 않았다(§5 정직 명시 참조).

---

## 2. 후보 목록과 비교

| # | 후보 | 효과(산출물 품질) | 비용 | 결함/개선 |
|---|------|------------------|------|-----------|
| **1** | **번들 `bin/` 스크립트를 에이전트가 실제로 실행할 수 없음** — 문서화된 3경로가 모두 막힘 | **매우 높음.** 화면검증·보안점검·산출물규약·배포게이트 등 "실행 가능한 검증"이 전부 첫 시도에 실패 → 에이전트가 검증을 건너뛰고 서술로 때움 | **매우 낮음.** 문자열 치환 + `chmod +x`. 상시 토큰 증가 0 | **결함** (재현 로그 3종 확보) |
| 2 | 21개 에이전트 전원 `skills:` 프론트매터 미사용 — "필수 참조" 스킬이 산문 지시뿐 | 중~높음. 필수 스킬 로드가 확률적 → 결정론적으로 바뀜 | **높음.** 프리로드는 전문을 주입한다. `common-*` 9종 총 64KB — 에이전트당 상시비용으로 전환됨. 선별 없이는 역효과 | 개선 |
| 3 | 에이전트 전원 `model:` 미지정 (전부 `inherit`) | 낮음(품질). 비용 효율은 중간 | 낮음. 단 품질 저하 위험 — 1순위 성능 원칙과 충돌 가능 | 개선 |
| 4 | 에이전트 `description`이 위임 트리거가 아닌 내부 용어("STAGE 2") 기준 | 중간. 자동 위임 정확도 | 낮음(문안 재작성) | 개선 |
| 5 | 9개 에이전트가 `tools:` 미지정 → 전 도구 상속 | 중간. "focus" 및 권한 경계 | 중간. 잘못 좁히면 작업 불능 → 회귀 위험 | 개선 |
| 6 | 상시비용 비대 — `agents/` 총 266KB, `pm.md` 32KB | 중간. best-practices의 "너무 길면 규칙이 묻힌다" | 높음. 직전 86커밋 슬리밍 라운드가 순효과 없음으로 폐기된 전례 | 개선(보류 권장) |
| 7 | 죽은 스킬 참조 1건 — `Skill \`backend-security-audit\`` (실재 디렉터리 없음) | 낮음. 괄호로 개명 사실이 병기돼 있어 오작동은 제한적 | 매우 낮음 | 결함(경미) |
| 8 | 훅 이벤트 30종 중 2종만 사용(SessionStart/Stop) — 산출물 실재 게이트가 산문 자기점검뿐 | 중~높음 | 높음. 신규 훅 = 구조 변경, 동결 대상 | 개선(보류) |
| 9 | 부작용 있는 스킬에 `disable-model-invocation` 미설정 | 낮음 | 낮음 | 개선 |

**검증했으나 결함이 아니었던 것** (기록해 둔다 — 다음 라운드가 같은 의심을 반복하지 않도록):
- `claude plugin validate ./malgn-agent` → **`✔ Validation passed`**. 매니페스트·구조 위반 없음.
- 스킬 참조를 `malgn-agent:` 네임스페이스 없이 맨이름으로 쓰는 것(67곳) → **실제로 해결된다.** 세션에서 맨이름 invoke를 실행해 정상 로드를 확인했다. 결함 아님.
- 스킬 `description` 1,536자 상한 → 최장이 916자. 잘리는 것 없음.

---

## 3. 선정: 후보 1 — 번들 `bin/` 스크립트 도달 경로 파손

**분류: 결함(defect).** "이렇게 하면 더 좋아진다"가 아니라 **지금 실행하면 에러가 난다.**
1순위(성능) 기준으로 골랐다. 이 결함은 제품이 스스로 세운 검증 게이트를 조용히 무력화하는데, 고치는 비용은 문자열 치환과 파일 권한뿐이고 **상시 토큰 비용 증가가 0**이다. 후보 2·3·5·6은 전부 토큰·회귀 트레이드오프를 동반하는 "개선"이라 변경 동결 원칙상 백로그가 맞다.

### 3.1 무엇이 문제인가 (실물 근거)

번들 스크립트에 도달하는 길은 공식적으로 둘인데, 제품은 셋으로 갈라져 있고 **하나만 동작한다.**

**경로 A — `${CLAUDE_PLUGIN_ROOT}` (동작함, 그러나 4곳뿐)**
`malgn-agent/skills/common-output-storage-and-path-management/SKILL.md:145,150,153,156`
```
node ${CLAUDE_PLUGIN_ROOT}/bin/check-output-conventions.mjs
```
이 스킬을 실제로 invoke해 확인한 결과, 본문이 다음으로 **치환되어** 도착한다:
```
node /Users/hopegiver/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/1.7.1/bin/check-output-conventions.mjs
```
공식 문서 #1의 "Skill and agent content — anywhere the placeholder appears"가 사실임이 실증됐다. **우리 저장소 안에 이미 정답이 있다.**

**경로 B — 한국어 플레이스홀더 (파손, 21곳)**
`malgn-agent/skills/common-screen-verification-and-capture/SKILL.md:20`
```
node <malgn-agent 플러그인 경로>/bin/capture.mjs <url> [output.png] [옵션...]
```
같은 파일 `:33,34,35`, `agents/ux-designer.md:23`, `skills/domain-serverless-edge-api-security/SKILL.md:82`, `skills/domain-pre-deployment-verification-gate/SKILL.md:16,31`, `skills/token-usage-diagnosis/SKILL.md:21,52,96`, `skills/usage-agent-healthcheck/SKILL.md:16,33,35,36,37,103`, `skills/project-standards/SKILL.md:73,94` 동일.
이 플레이스홀더는 치환되지 않는다. 에이전트는 절대경로를 **스스로 추측해야 하는데, 그 방법을 알려주는 서술이 제품 어디에도 없다.** 게다가 실제 경로는 버전마다 바뀐다 — 설치 캐시에 이미 13개 버전 디렉터리(`1.0.0` … `1.7.6`)가 공존한다.

**경로 C — 맨 명령어 (파손, 33곳)**
`agents/reviewer.md:14`, `skills/domain-training-scorecard-eval/SKILL.md` 등은 `bin/capture.mjs`처럼 접두어 없이 적는다.
공식 문서 #1은 이것이 동작해야 한다고 말한다 — "invokable as bare commands." 실제로 PATH에는 들어와 있다:
```
$ echo "$PATH" | tr ':' '\n' | grep malgn
/Users/hopegiver/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/1.7.1/bin
```
그런데 실행하면:
```
$ capture.mjs --help
(eval):3: permission denied: capture.mjs
```
**원인: 실행 비트 누락.** 12개 중 6개가 mode 644다 — 그리고 그 6개가 정확히 *에이전트가 실행하도록 지시받는* 스크립트다:
```
NO +x: bin/analyze-usage.mjs      NO +x: bin/check-output-conventions.mjs
NO +x: bin/capture.mjs            NO +x: bin/check-wbs-warnings.mjs
NO +x: bin/check-edge-api-security.mjs   NO +x: bin/diff-env-keys.mjs
```
`+x`가 있는 6개는 launchd/사람이 돌리는 usage-agent 계열이다. 셔뱅(`#!/usr/bin/env node`)은 전부 정상이고, **절대경로를 주면 스크립트 자체는 완벽히 동작한다** (`node <abs>/check-output-conventions.mjs --help` → 정상 사용법 출력). 즉 깨진 것은 스크립트가 아니라 **도달 경로**다.

**참고로 경로 A를 흉내 낸 오용도 실패한다.** Bash 툴 세션에서 `${CLAUDE_PLUGIN_ROOT}`는 **빈 문자열**이다(hook 프로세스에만 export된다):
```
$ echo "CLAUDE_PLUGIN_ROOT=[${CLAUDE_PLUGIN_ROOT}]"
CLAUDE_PLUGIN_ROOT=[]
$ node ${CLAUDE_PLUGIN_ROOT}/bin/check-output-conventions.mjs
node:internal/modules/cjs/loader:1433  throw err;   ← MODULE_NOT_FOUND (/bin/... 을 찾음)
```
경로 A가 성립하는 이유는 **스킬 본문이 모델에 도달하기 전에 미리 치환되기 때문**이지, 셸이 그 변수를 알기 때문이 아니다. 이 구분을 문안에 남기지 않으면 다음 라운드가 반드시 재발시킨다.

### 3.2 지금 구체적으로 무엇이 나빠지는가

문서 권고를 안 따라서가 아니라, **제품의 검증 장치가 실제로 안 돈다.**

- `capture.mjs`는 `common-screen-verification-and-capture`의 유일한 캡처 수단이고, 이 스킬은 **frontend-dev / reviewer / ux-designer / visual-designer / qa-engineer 5개 에이전트의 화면 검증 근거**다. 첫 명령이 `permission denied`나 경로 추측 실패로 끝나면, 에이전트는 캡처를 포기하고 "화면을 확인했다"는 서술로 대체하기 쉽다 — 이 제품이 `common-verifiable-output-and-honesty`로 막으려는 바로 그 실패다.
- 같은 구조로 `check-edge-api-security.mjs`(보안 점검 §7 체크리스트 자동화), `diff-env-keys.mjs`(배포 전 게이트), `check-output-conventions.mjs`(산출물 규약 1차 스캔), `check-wbs-warnings.mjs`(WBS 추적)가 모두 무력화된다.
- best-practices #6은 **"Give Claude a check it can run"**을 검증의 핵심으로 든다. 우리는 그 check를 12개나 만들어 번들해 놓고 실행 경로를 끊어 두었다. writing-tools #9의 **"opaque error codes"** 지적도 정확히 들어맞는다 — 에이전트가 받는 건 `permission denied`나 `MODULE_NOT_FOUND`뿐이고, 다음에 뭘 해야 하는지 알려주는 문안이 없다.

### 3.3 요구사항 (구체 문안은 채택 후 별도 라운드)

방법이 아니라 **참으로 남아야 할 것**만 적는다.

- **R1.** 번들 스크립트를 실행하라는 지시는 **에이전트가 경로를 추측하지 않아도 되는 형태**여야 한다. 추측을 요구하는 플레이스홀더(`<malgn-agent 플러그인 경로>` 등)는 제품 본문에서 사라져야 한다.
- **R2.** 도달 방법은 **하나로 통일**되어야 한다. 현재 A/B/C 세 갈래인 것 자체가 결함의 원인이다. 어느 것을 정본으로 삼든, 그 하나가 **실증된 것**이어야 한다(A는 실증됨, C는 R3 없이는 불가).
- **R3.** 경로 C를 정본으로 택한다면 `bin/*.mjs` 전부에 실행 비트가 있어야 하고, 그 상태가 **git에 보존되고 배포본까지 전달됨**이 확인돼야 한다(현재 6개 누락).
- **R4.** Bash 툴 세션에서 `${CLAUDE_PLUGIN_ROOT}`가 비어 있다는 사실이 문안에 남아야 한다 — 그래야 "변수를 셸에서 쓰면 된다"는 오해가 재발하지 않는다.
- **R5.** 회귀 방지: `pnpm run check-assets`(현 ERROR 0 기준선) 계열 정적 검사가 **추측형 플레이스홀더와 실행비트 누락을 잡아야 한다.** 이 검사가 없으면 다음 스크립트 추가 때 그대로 재발한다.
- **R6.** 비범위: 스크립트 자체의 기능·인터페이스는 건드리지 않는다(정상 동작 확인됨). 신규 훅·신규 스킬도 만들지 않는다(동결).

### 3.4 기대 효과와 검증 방법

"좋아졌다"고 말하려면 아래가 관측돼야 한다. 라인 수·토큰 감소는 근거로 치지 않는다.

1. **실행 성공(1차)**: 정본 경로 형태 그대로를 복사해 실행했을 때 6개 스크립트 전부가 사용법/정상 출력을 낸다. 현재 재현 로그(`permission denied`, `MODULE_NOT_FOUND`)가 사라지는 것이 합격선.
2. **배포본 대조(2차)**: 저장소 워킹트리가 아니라 **설치 캐시 경로**에서 같은 검증을 반복한다. 워킹트리에서만 되는 수정은 미검증으로 다룬다(설치본이 뒤처지는 구조이므로 필수).
3. **산출물 관찰(3차, 본질)**: 수정 후 화면이 있는 작업 1건을 실제로 돌려, ux-designer/reviewer가 **캡처 파일을 실제로 남기는지** 확인한다. 캡처 png가 생기면 개선, 여전히 서술로 때우면 원인이 경로가 아니었다는 뜻이므로 재진단한다. — 이것이 "산출물 품질이 좋아졌나"에 답하는 유일한 관측이다.
4. **회귀 게이트**: 플레이스홀더를 일부러 1건 되돌렸을 때 정적 검사가 ERROR로 잡는지 확인한다(양성 대조군). 잡지 못하면 R5 미충족.

### 3.5 예상 비용

| 구분 | 영향 |
|------|------|
| **상시 비용**(에이전트 MD 본문·`common-*`) | **실질 0.** 치환 대상은 대부분 `common-screen-verification-and-capture` 등 조건부 로드 스킬 본문이다. 에이전트 MD 본문 변경은 `ux-designer.md:23`, `reviewer.md:14`, `frontend-dev.md`, `visual-designer.md` 4개 파일의 각 1~2줄뿐 |
| **조건부 비용**(invoke 시 로드) | 경로 A 채택 시 스킬 본문에 절대경로가 렌더링되어 참조 1건당 수십 바이트 증가. 21곳 기준 미미. 경로 C 채택 시 오히려 **감소**(맨 명령어가 가장 짧다) |
| **작업량** | 문자열 치환 21곳 + `chmod +x` 6건 + 정적 검사 룰 1개. 1파일 국소 수정은 아니지만 설계 판단이 필요한 부분은 "A와 C 중 무엇을 정본으로 삼을까" 하나뿐 |
| **회귀 위험** | 낮음. 스크립트 기능·인터페이스 불변, 문서 문자열과 파일 권한만 변경 |

---

## 4. 조사 중 확인하지 못한 것 (정직 명시)

- **`/docs/en/memory`, `/docs/en/slash-commands`, `/docs/en/settings`, `/docs/en/mcp`, `/docs/en/common-workflows`는 열지 않았다.** 선정 후보가 조기에 확정돼 우선순위에서 밀렸다. 이 5개에 더 큰 갭이 있을 가능성을 배제하지 못한다.
- **`${CLAUDE_PLUGIN_ROOT}`가 *에이전트 MD 본문*에서도 치환되는지는 직접 실증하지 못했다.** 공식 문서 #1의 표가 "Skill and agent content"라고 명시하고 있고 **스킬 본문에서는 실증했으나**, 에이전트 본문 치환은 문서 기술을 신뢰한 것이다. R2에서 경로 A를 정본으로 택한다면 이것부터 실증해야 한다.
- **`bin/`의 실행 비트가 git에 보존되고 마켓플레이스 설치 과정에서 유지되는지 확인하지 않았다.** 설치 캐시의 mode가 저장소와 일치하는 것은 관측했으나(6개 644 동일), 설치 파이프라인이 mode를 보존하는 것인지 단순 복사의 부수효과인지는 구분하지 못했다. R3의 전제 조건이다.
- **결함의 실제 발생 빈도를 로그로 재현하지 못했다.** 실패 명령은 이 세션에서 직접 재현했으나, 실제 프로젝트에서 에이전트가 이 실패를 만난 뒤 검증을 건너뛴 사례를 이력에서 찾지는 않았다. §3.2의 "서술로 대체하기 쉽다"는 메커니즘 추론이며 관측이 아니다 — §3.4의 3차 검증이 이를 사후 확인하는 절차다.
- **Windows 환경은 전혀 확인하지 않았다.** 실행 비트(경로 C)는 POSIX 개념이다. 번들 스크립트가 Windows/macOS 동일 실행을 표방하므로, 경로 C를 정본으로 택할 경우 Windows에서 맨 명령어 호출이 되는지가 미검증 리스크다. **이 점은 A와 C 중 정본 선택을 좌우할 수 있다.**
