---
created: 2026-08-24
author: evaluator
status: FINAL
target: round/spec-audit (v1.7.8 → v1.8.0)
verdict: 조건부 통과
related_files:
  - /Users/hopegiver/workspace/claude-plugins/docs/reviewer/review-spec-audit-2026-08-24.md
tags: [evaluation, gate, release, spec-audit, v1.8.0]
---

# 배포 전 최종 판정 — `round/spec-audit` (v1.8.0)

**판정: 조건부 통과 (Conditional PASS)**
**판정자: evaluator / 판정일: 2026-08-24**

게이트 3종은 전부 초록불이고 배포를 막을 결함은 없다. 다만 아래 **조건 3건**을
배포 전에 처리해야 하고, **런타임 미검증 1건**은 배포 직후 확인해야 한다.

---

## 0. 선기대치 자술 (diff 열람 전 작성)

이 라운드가 PASS하려면 다음이 참이어야 한다고 먼저 적었다:

1. `check-assets` ERROR 0 / WARN 18(기준선), `claude plugin validate` 2종 통과.
2. `tools` 허용목록 전환으로 **본문이 지시하는데 실행할 수 없게 된 도구가 없을 것**.
3. 신설 린터 규칙 3종이 각각 뮤테이션에 반응하고 정상 트리에서 오탐 0일 것.
4. README·CHANGELOG의 모든 수치·경로·주장이 실물과 일치할 것.
5. 조회 불가 식별자 0건.
6. 상시 비용 증가분이 있다면 그것이 성능(=실행 가능성) 회복의 대가로 설명될 것.

이후 `git diff main..round/spec-audit`와 원문만으로 독립 판정하고, 마지막에
reviewer 보고서·CHANGELOG의 주장과 대조했다.

---

## 1. 게이트 — 통과 (verified)

| 검사 | 결과 | 확인 방법 |
|---|---|---|
| `pnpm run check-assets` | **ERROR 0 · WARN 18 · INFO 0** — 기준선 일치 | 직접 실행 |
| `claude plugin validate . --strict` | ✔ Validation passed (exit 0) | 직접 실행 |
| `claude plugin validate ./malgn-agent --strict` | ✔ Validation passed (exit 0) | 직접 실행 |
| 조회 불가 식별자 (백틱 앵커 없이) | **실질 0건** | 아래 §5 |

`git diff main..HEAD` 기준 25커밋 · 63파일 · +2,218/−499. 판정은 이 diff와 현재
트리 원문으로만 했다.

---

## 2. 회귀 — 조건부. "세 번째 사고"가 있다

`main`은 21종 중 **9종이 `tools` 필드 자체가 없었다**(=전체 도구 상속):
`architect · backend-dev · devops · evaluator · frontend-dev · pm · qa-engineer ·
security · trainer`. 나머지 12종은 이미 제한돼 있었다. 따라서 **회귀가 가능한 곳은
이 9종뿐이고, 12종은 순증(順增)이라 회귀 위험이 없다.** (`git show main:<path>`로 확인)

### 2-1. 새로 생긴 실행 불가 — `frontend-dev`의 `Agent` (Major, 이번 라운드 유래)

`malgn-agent/agents/frontend-dev.md:28`

> `필요`면 visual-designer를 **호출해** 경량 또는 풀 산출물을 먼저 받은 뒤 구현하고

`frontend-dev`의 새 `tools`에는 `Agent`가 없다(`Agent`는 `pm` 단독). `main`에서는
전체 상속이라 실행 가능했으므로 **이번 전환으로 죽은 지시**다. 같은 파일 `:40`의
"재위임 금지"와도 충돌하므로, 도구를 주는 것이 아니라 **`:28`의 "호출해"를
"PM에게 요청해"로 고치는 쪽**이 설계 의도에 맞아 보인다. 어느 쪽이든 지금은
문장과 권한이 어긋나 있다.

### 2-2. 9종 전부에서 `BashOutput`·`KillShell`이 빠졌다 (Major, 미확정)

`Bash`는 줬지만 `BashOutput`/`KillShell`은 어느 에이전트에도 없다. 그런데
`frontend-dev.md:17`("로컬 서버(`pnpm run dev`)를 띄우고"), `qa-engineer.md:21`
("로컬 서버 실기동(`wrangler dev` 등)"), `reviewer.md:102`는 장시간 실행 서버를 전제한다.

**공식 문서는 "허용목록을 쓰면 어떤 도구가 암묵 제공되는가"를 명시하지 않는다**
(claude-code-guide 조회 결과: 문서 침묵). 따라서 이것이 실제 손실인지는
**런타임에서만 확정된다** → §7 스모크 테스트 2번.

### 2-3. 기존부터 있던 실행 불가 2건 (이번 라운드 유래 아님 — 반려 사유 아님)

reviewer 보고서와 별개로 확인했고, **`main`에도 동일하게 존재**하므로 이번 라운드의
회귀로 계산하지 않는다. 다만 실물 결함이므로 기록한다.

- **`reviewer`에 `Edit` 없음.** `reviewer.md:60~62`가 "적용 이력 섹션에 이번 라운드
  항목만 **append**", "INDEX.md의 '최근 재사용' 열을 **갱신**", "INDEX.md에 새 행을
  **추가**"를 지시하고 `:63`이 이를 **산출물 게이트**("없으면 리뷰 미완료")로 못박는다.
  `skills/reviewer-persona-panel-standard/SKILL.md:19`는 "6대 요소 본문은 건드리지
  않는다"까지 요구한다. `Write`로 전량 재작성하면 그 요구를 정면으로 어긴다.
  → `main`의 reviewer `tools`도 `Read, Grep, Glob, Write, Bash, WebFetch, WebSearch`로
  `Edit`이 없었다. **선행 결함**.
- **`finance`에 `Bash` 없음.** `finance.md:60`이 자기검증 항목으로 `` `ls docs/finance/`로
  확인 ``을 요구한다. `main`도 동일. **선행 결함**.

### 2-4. `finance`만 hub MCP·`ToolSearch` 미부여 (Minor, 확인 필요)

21종 중 `finance` 하나만 `mcp__plugin_malgn-agent_malgnai-hub__*`와 `ToolSearch`가
없다. 의도된 예외인지 누락인지 diff·커밋 메시지 어디에도 근거가 없다. CHANGELOG는
"해당 지시가 도달하는 20종"이라고만 적어 `finance`가 도달 대상이 아니라는 판단을
암시하는데, 그 판단의 근거는 어디에도 없다.

### 2-5. 규격 적합성은 확인됨 (verified)

- `mcp__plugin_malgn-agent_malgnai-hub__*` 와일드카드는 **허용 규칙에서 유효**하고
  (permissions 문서: "`mcp__puppeteer__*` matches every tool from the puppeteer server"),
  플러그인 MCP 도구의 접두어 형식도 `mcp__plugin_<plugin>_<server>__<tool>`로 정확하다
  (MCP 문서). 20종 전부 이 형식이며 오타 없음.
- `model:` 값 `opus`/`sonnet`은 유효한 리터럴이다(subagents 문서).
- `Task`는 어느 목록에도 없고 `Agent`만 `pm.md:4`에 있다 — 현행 도구명과 일치.

---

## 3. 신설 린터 규칙 — 2종은 값을 하고, 1종은 이름값을 못 한다

정상 트리 복제본(`git archive HEAD`)에 뮤테이션을 직접 심어 확인했다. 복제본
기준선이 원본과 동일함(ERROR 0 · WARN 18)을 먼저 맞춘 뒤 진행했다.

| 규칙 | 뮤테이션 | 결과 | 오탐 |
|---|---|---|---|
| `REF_KNOWLEDGE_UNREACHABLE` | `${CLAUDE_PLUGIN_ROOT}/knowledge/` → `knowledge/` (architect.md) | **ERROR 5건 검출** ✅ | 정상 트리 0건 ✅ |
| `DOC_COUNT_DRIFT` | README "스킬 37종" → "38종" | **ERROR 2건 검출** ✅ | 정상 트리 0건 ✅ |
| `AGENT_TOOL_SKILL_UNREACHABLE` | 21종 전부에서 `Skill` 제거 | **20/21 검출** ✅ | 정상 트리 0건 ✅ |
| `AGENT_TOOL_UNREACHABLE` (일반) | 아래 전수 스윕 | **33/230 (14.3%)** ⚠️ | 0건 |
| `AGENT_TOOL_UNKNOWN` (오타) | `Read` → `Raed` | WARN만 ⚠️ | — |

미검출된 `finance` 1건은 규칙 결함이 아니다 — `finance` 본문에 `` Skill `이름` ``
참조가 하나도 없어 **정탐(true negative)**이다. 다만 이는 `finance`가 `common-*`
품질 스킬 전체와 단절돼 있다는 별개 사실을 드러낸다.

### 3-1. 전수 뮤테이션 스윕 (핵심 결과)

21종 × 각자의 `tools` 항목을 **하나씩 제거**해 230회 검사했다. 검출된 것은 33건뿐이다.

**모든 에이전트에서 제거해도 조용히 통과한 도구:**
`Read` · `Grep` · `Glob` · `Edit` · `Write` · `Bash` · `TodoWrite` · `ToolSearch` ·
`Agent` · `mcp__plugin_malgn-agent_malgnai-hub__*` — **21/21 전부 무검출.**

**`AskUserQuestion`은 이 규칙이 태어난 계기인데, 9종 중 2종(`pm`·`security`)만 검출된다.**
`evaluator.md:102`의 "…라고 사람에게 요청합니다(AskUserQuestion)" 같은 괄호형은
조사(助詞) 휴리스틱에 걸리지 않아 빠져나간다.

**원인(코드 확인):** `scripts/validate-agent-assets.mjs`
- `checkToolReachability()`는 **KNOWN_TOOLS의 이름 + 한국어 도구격 조사**가 붙은
  형태만 본다(`TOOL_PARTICLE`). "파일을 저장한다"(→Write), "`ls`로 확인"(→Bash),
  "갱신한다"(→Edit), "호출해"(→Agent) 같은 **서술형 지시는 원리적으로 안 잡힌다.**
- `AMBIGUOUS_TOOL_WORDS`가 `Read/Write/Edit/Bash/Glob/Grep/Skill/Agent/…`를 WARN으로
  강등한다. 그런데 **CI는 `pnpm run check-assets`를 `--strict` 없이 돌린다**
  (`.github/workflows/validate-plugin.yml:74` 주석이 명시). 즉 이 도구들이 빠져도
  **CI는 초록불**이다. 오타(`AGENT_TOOL_UNKNOWN`)도 WARN이라 같은 경로로 통과한다.
- mcp 도구는 `if (t.startsWith('mcp__')) continue`로 검사에서 아예 제외된다 —
  이 제품의 간판 기능인 hub 연동의 도달성은 **전혀 검사되지 않는다.**

**판정:** `REF_KNOWLEDGE_UNREACHABLE`·`DOC_COUNT_DRIFT`·`AGENT_TOOL_SKILL_UNREACHABLE`
3종은 값을 한다. **`AGENT_TOOL_UNREACHABLE`은 "같은 사고를 세 번 내지 않게 한다"는
목적을 달성하지 못한다** — 실제로 §2-1의 `frontend-dev`/`Agent` 회귀를 이 규칙이
놓쳤다(현재 트리 ERROR 0). 규칙을 없애자는 게 아니라, **이 규칙의 초록불을 회귀
부재의 근거로 삼지 말라**는 뜻이다.

---

## 4. 설치 직원 관점 — CHANGELOG에 사실 오류가 있다

### 4-1. (Major) CHANGELOG가 **이번 라운드 안에서 만들고 고친 버그**를 배포본의 결함으로 적었다

`malgn-agent/CHANGELOG.md:25~30`

> `AskUserQuestion`이 **어느 에이전트 목록에도 들어 있지 않아서**, 프로덕션 배포
> 트리거·광고비 집행·민감한 변경의 병합·최종 보안 게이트 진입처럼 "사람 승인을 받고
> 진행"해야 하는 자리에서 **확인 창이 아예 뜨지 않았습니다.**

**사실이 아니다.** 열거된 9종 중 8종(`pm` `security` `evaluator` `trainer`
`backend-dev` `frontend-dev` `devops` `qa-engineer`)은 배포본 v1.7.8에서 `tools`
필드가 없어 `AskUserQuestion`을 **상속받고 있었다.** 실제로 못 쓴 것은
`capture-strategist` 1종뿐이다. 나머지 8종의 단절은 이 브랜치의 `5c58707`이 만들고
`411b31c`가 되돌린 **브랜치 내부 사건**이다.

지금 문장대로면 직원은 "내가 지금 쓰는 버전은 배포 승인 게이트가 조용히 죽어 있었다"고
믿게 된다. 사실이 아니고, 승인 게이트의 신뢰 문제라 오해의 대가가 크다.

같은 과잉 귀속이 더 약한 형태로 2건 더 있다:
- `:39~43` hub 도구 "그 경로가 빠져 있었습니다" — 제한돼 있던 12종에만 참.
- `:48~49` "나머지 **20종에서** 뺐습니다" — 실제로 `Agent`를 갖고 있던 것은 8종.

반면 `:31~34`의 `Skill` 항목은 "**도구를 제한한 에이전트 12종**"이라고 범위를 정확히
적어 **정확하다.** 나머지도 이 문장처럼 범위를 한정하면 해결된다.

### 4-2. (Minor) `:52~54` "누가 내려받아도 같은 결과가 나옵니다"는 과장

직접 재현: 빈 `HOME`으로 `node malgn-agent/hooks/doc-drift.mjs` 실행 시
`⚠️ PM 행동규율 @import: malgn-agent 플러그인 원본을 찾을 수 없다` + **exit 1**.
평소 `HOME`에서는 exit 0. **스크립트 경로**는 저장소 기준으로 고쳐졌지만
`checkPmBlockImport()`가 여전히 개인 `$HOME`의 마켓플레이스 설치를 찾는다.
(워크플로 주석 `:77~90`은 이 사실을 이미 정확히 기술하고 있다 — CHANGELOG 문장만 어긋난다.)

> **reviewer 지적 1건 기각:** "워크플로 주석이 CHANGELOG와 모순된다"는 지적은 오탐이다.
> `.github/workflows/validate-plugin.yml:77~90` 원문은 "예전 이유(해소됨)"과
> "지금 이유(둘 다 실측 확인)"를 나누어 정확히 적고 있다. 원문 대조로 확인.

### 4-3. 정확성이 확인된 것 (verified)

- 개수 표기: 에이전트 21 / 스킬 37 / 참고자료 54 — 실물 일치. `knowledge/README.md`를
  뺀 54가 맞고, 그 세는 규칙이 `validate-agent-assets.mjs:955~965`에 코드로 못박혀
  이제 기계 검사된다.
- 버전 3중 일치: `plugin.json` 1.8.0 = `marketplace.json` 1.8.0 = CHANGELOG 1.8.0.
- 제거된 `domain-backend-security-audit` 참조 잔재 0건, CHANGELOG가 개명 안내를 함
  (파괴적 변경 표기 적절).
- README가 설치·재시작·device_token·트러블슈팅을 답한다.
- CI가 `CLAUDE_CLI_VERSION: 2.1.241`로 핀 고정 — 실재하는 버전.

---

## 5. 프로젝트 규칙 — 통과 (verified)

백틱 앵커 **없이** 전수 스캔:

```
grep -rnoE '\b[0-9a-f]{8}\b|\b01[0-9a-hjkmnp-tv-z]{24}\b' malgn-agent/   → 원시 4건
grep -rnE 'commit `?[0-9a-f]{7,12}|memory `[^`]+`' malgn-agent/          → 원시 1건
```

5건 전부 오탐이며 실질 **0건**:

| 위치 | 값 | 판정 |
|---|---|---|
| `bin/check-wbs-warnings.mjs:147` | `86400000` | 밀리초 상수 |
| `skills/common-screen-verification-and-capture/SKILL.md:94,169` | `20250210` | 파일명 예시 안의 날짜 |
| `skills/token-usage-diagnosis/SKILL.md:103` | `a1b2c3d4` | 예시 리포트의 자리표시자 |
| `skills/common-verifiable-output-and-honesty/SKILL.md:143` | `commit a1b2c3d` | 보고서 템플릿의 자리표시자 |

---

## 6. 성능 1순위 · 토큰 2순위 — 영역 합계 실측

라인 수가 아니라 **바이트**로, git object 기준(`ls-tree -r -l`)으로 `main` ↔ `HEAD`를 쟀다.

| 영역 | main | now | 증감 |
|---|---:|---:|---:|
| `agents/` (상시) | 266,333 | 269,828 | **+3,495** |
| `common-*` 스킬 (상시) | 69,159 | 71,182 | **+2,023** |
| 스킬 description 합계 (상시) | 14,431 | 13,983 | **−448** |
| `skills/` 전체 (조건부) | 397,489 | 394,298 | −3,191 |
| `knowledge/` (조건부) | 457,663 | 458,500 | +837 |
| `hooks/` | 22,565 | 29,652 | +7,087 |
| `bin/` | 186,465 | 186,465 | 0 |
| **플러그인 전체** | 1,340,034 | 1,369,047 | +29,013 |

**상시 비용 순증 ≈ +5,070 B (약 +1.5%).** 내역:

- `agents/` +3,495 중 대부분은 (a) 21종 × `tools:`/`model:` 두 줄, (b) knowledge 참조
  97곳에 붙은 `${CLAUDE_PLUGIN_ROOT}/` 접두어(24자 × 97 ≈ 2.3 KB)다. 둘 다
  **실행 가능성을 되살리는 대가**이지 서술 증가가 아니다.
  개별 최대 증가는 `architect.md` +447 B, 감소는 `finance.md` −41 B.
- `common-*` +2,023은 전부 `common-output-storage-and-path-management` 1개 파일이고,
  나머지 8개는 **±0**이다.
- 스킬 description은 −448로 줄었다(보안 4→3종 통폐합 효과).
- 전체 +29,013의 대부분은 README·CHANGELOG·LICENSE·CI로, **컨텍스트 비용이 아니다.**

**판정: 통과.** CLAUDE.md "1순위 성능" 기준에 부합한다. 이번 증가는 "줄었으니 개선"의
반대편 — **늘었지만 실행 불가를 실행 가능으로 바꾼 대가**이고, 그 근거가 실물로 확인된다.
다만 `agents/` 프론트매터는 하위 에이전트 **본문 로드 시점**의 비용이라 메인 스레드
상시 비용으로는 계상되지 않을 가능성이 크다(문서 미명시) — 즉 위 +5,070은 **보수적
상한**이다.

---

## 7. 배포 직후 스모크 테스트 (런타임 미검증분)

### ⓪ (선행) 실제로 v1.8.0이 로드됐는지부터 확인 — **가장 먼저**

이번 판정 중 실측된 사실이다. 이 PC에서 **마켓플레이스 클론은 1.7.8**인데
**캐시 최고본은 1.7.6**이고, 실제로 기동된 서브에이전트는 **1.7.1**에서 로드됐다
(`PATH`에 `.../malgn-agent/1.7.1/bin`, 본문도 1.7.1과 바이트 일치). 즉
**"배포했다 = 직원이 그 버전을 쓴다"가 성립하지 않는다.**

```bash
ls -1 ~/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/     # 1.8.0 디렉터리가 생겼는가
node -p "require(process.env.HOME+'/.claude/plugins/marketplaces/malgnsoft-plugins/malgn-agent/.claude-plugin/plugin.json').version"
```

절차: `/plugin marketplace update malgnsoft-plugins` → `/plugin update malgn-agent`
→ **클로드코드 완전 재시작** → 위 두 명령으로 1.8.0 확인. 이게 안 되면 이하 테스트는
전부 무의미하다.

### ① `${CLAUDE_PLUGIN_ROOT}`가 **에이전트 본문**에서 치환되는가 — 최우선

이번 라운드는 agents 본문의 knowledge 참조 **97곳 + bin 실행 2곳(총 99곳)**을
이 변수에 걸었다(`main`은 2곳뿐이었다). 그런데:

- **스킬 본문 치환은 이번에 실증 확인했다(verified).** 세션에서
  `malgn-agent:common-output-storage-and-path-management`를 실제로 로드한 결과,
  본문이 `/Users/hopegiver/.claude/plugins/cache/.../1.7.1/bin/check-output-conventions.mjs`
  라는 **완전 해소된 절대경로**로 도착했다. 공식 문서와도 일치("Substituted only in
  plugin skills … the skill's markdown content").
- **에이전트 본문 치환은 공식 문서가 침묵한다(UNVERIFIED).** subagents 문서에 변수
  치환 언급이 없다. 이번 PC에서는 프로브가 불가능했다 — 로드된 캐시 1.7.1의
  `frontend-dev.md`에는 해당 토큰이 아예 없었다(브리핑의 "1.7.6이라 프로브 자리가
  없었다"는 전제도 실제와 다르다: 클론은 1.7.8, 로드본은 1.7.1이었다).

**배포 직후 절차** — 1.8.0 로드 확인 후, `frontend-dev`에 위임해 이렇게 묻는다:

> 작업하지 말고 답만 해라. 네 지시문에서 `capture.mjs`를 언급하는 줄과, knowledge
> 경로 하나를 **그대로(verbatim)** 인용해라. 달러기호·중괄호가 있으면 있는 그대로 적어라.
> 그 다음 그 경로를 `ls -la "<인용한 그대로>"`로 실행해 원문 출력을 붙여라.

- **절대경로가 인용되고 `ls`가 성공** → 치환됨. 99곳 전부 정상. 종료.
- **`${CLAUDE_PLUGIN_ROOT}` 리터럴이 인용됨** → 치환 안 됨. 이때 영향은 **둘로 갈린다**:
  - knowledge 참조 97곳: 산문 포인터라 `main`의 맨 상대경로보다 나쁘지 않다(모델이
    추론할 여지가 오히려 생긴다). **급하지 않다.**
  - **쉘 명령 2곳은 즉시 깨진다** — `frontend-dev.md:84`,`ux-designer.md:24`의
    `node "${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs"`. Bash 도구 환경에
    `CLAUDE_PLUGIN_ROOT`가 **없다는 것은 이미 실측했다**(`env | grep -i claude`에
    미존재 → 빈 문자열 → `/bin/capture.mjs` → `Cannot find module`). 이 2줄만
    핫픽스하면 된다.

### ② 서브에이전트가 hub MCP 도구와 `AskUserQuestion`을 실제로 쓸 수 있는가

린터가 mcp 도달성을 **전혀 검사하지 않으므로**(§3-1) 런타임 확인이 유일한 수단이다.

1. **hub 와일드카드** — `trainer`(또는 아무 hub 보유 에이전트)에 위임:
   > 아무 파일도 고치지 말고, 네가 접근 가능한 도구 목록에
   > `mcp__plugin_malgn-agent_malgnai-hub__` 로 시작하는 것이 몇 개인지 이름을 나열해라.
   > 하나도 없으면 "없음"이라고 답해라.

   0개면 `tools`의 `mcp__…__*` 와일드카드가 서브에이전트 허용목록에서 해소되지
   않는다는 뜻이다 → 20종 전부 hub 기록 불가. **이 경우 즉시 롤백 사유.**
2. **`AskUserQuestion`** — `security`에 위임:
   > 최종 보안 단계 진입 승인을 받아야 한다고 가정하고, 네가 `AskUserQuestion`을
   > 호출할 수 있는지 실제로 한 번 시도해라.

   승인 창이 뜨면 정상.
3. **`BashOutput`/`KillShell`(§2-2)** — `qa-engineer`에 위임:
   > `sleep 30` 을 백그라운드로 띄우고 그 출력을 읽어와라.

   백그라운드 실행은 되는데 출력을 못 읽으면 §2-2가 실제 손실로 확정된다.
4. **`Agent`(§2-1)** — `frontend-dev`에 위임:
   > 네 도구 목록에 다른 에이전트를 호출하는 도구가 있는지 답해라(호출하지는 마라).

   없으면 `frontend-dev.md:28`을 "PM에게 요청"으로 고친다.

### ③ Stop 훅 리마인더 억제

hub 기록 도구를 1회 쓴 턴을 끝내고, 세션 종료 리마인더가 **뜨지 않는지** 본다.
접두어 학습(`PREFIX_FROM_HUB_RE`)이 실제 트랜스크립트에서 동작하는지의 확인이다.
안내 문구의 도구 이름이 `mcp__plugin_malgn-agent_malgnai-hub__…` 형태인지도 함께 본다.

### ④ SessionStart 주입 상한

12,000 B가 넘는 `STATUS.md`가 있는 프로젝트에서 새 세션을 열어, 잘림 안내 문구와
`MALGN_STATUS_MAX_BYTES` 조정이 동작하는지 본다.

---

## 8. 배포 조건 (trainer 반송 항목)

**PM이 trainer에 반송할 것 — evaluator는 파일을 고치지 않았다.**

| # | 등급 | 위치 | 요구 |
|---|---|---|---|
| C1 | Major | `malgn-agent/CHANGELOG.md:25~30` (및 `:39~43`, `:48~49`) | 배포본 v1.7.8에서 실제로 영향받은 범위로 한정한다. `AskUserQuestion` 항목은 `capture-strategist` 1종이 사실이고, 나머지 8종은 이 브랜치 내부에서 생겼다 고쳐진 것이다. `:31~34`의 "도구를 제한한 에이전트 12종" 문형을 그대로 따르면 된다. |
| C2 | Major | `malgn-agent/agents/frontend-dev.md:28` | `Agent` 미보유 상태와 `:40` "재위임 금지"에 맞춰 "visual-designer를 **호출해**"를 "PM에게 visual-designer 투입을 **요청해**"로 고친다(도구 부여가 아니라 문장 수정 권고). |
| C3 | Minor | `malgn-agent/CHANGELOG.md:52~54` | "누가 내려받아도 같은 결과가 나옵니다"를 사실에 맞춘다 — 스크립트 경로는 저장소 기준이 됐지만 `checkPmBlockImport()`는 여전히 개인 `$HOME`을 본다(빈 HOME에서 exit 1 재현). |

## 9. 백로그 (이번 배포를 막지 않음 — 변경 동결 원칙에 따라 사용자 판단 대기)

| # | 내용 | 근거 |
|---|---|---|
| B1 | `AGENT_TOOL_UNREACHABLE`의 실효 커버리지 14.3% (§3-1). 최소한 mcp 도구를 검사 제외에서 빼고, CI가 이 규칙군만은 `--strict` 상당으로 보게 한다 | 이 규칙의 초록불이 회귀 부재의 근거로 쓰이면 세 번째 사고가 반복된다 |
| B2 | `reviewer`에 `Edit` 부재 — 산출물 게이트(`reviewer.md:63`)가 실행 불가 | 선행 결함, `main`에도 존재 |
| B3 | `finance`의 `Bash` 부재(`finance.md:60`) 및 hub·`ToolSearch` 단독 미부여(§2-4) | 선행 결함 + 근거 없는 예외 |
| B4 | `finance`가 `common-*` 품질 스킬을 하나도 참조하지 않음 | §3 뮤테이션에서 부수적으로 드러남 |
| B5 | 루트 `CLAUDE.md`의 "skills 38종"이 실물 37과 어긋남 — `DOC_COUNT_DRIFT`는 README·plugin.json·marketplace.json만 본다 | 병행 세션 소유 파일이라 이번 판정에서 손대지 않음 |

---

## 10. 주장(claimed) ↔ 확인(verified) 대조

| 주장 | 출처 | 판정 |
|---|---|---|
| Critical(`AskUserQuestion` 누락) 해소 | reviewer 보고서 | **verified** — 9종 프론트매터 원문 확인. 단 CHANGELOG의 원인 서술이 틀림(C1) |
| Major 4건 해소 | reviewer 보고서 | **부분 verified** — 프론트매터·경로·훅·개수 항목은 실물 확인. `frontend-dev`/`Agent`(§2-1)는 미해소 |
| "reviewer의 `Edit`은 이번 라운드에 빠졌다" | 하위 감사 | **기각** — `git show main:` 확인 결과 `main`에도 없음. 선행 결함으로 재분류 |
| "워크플로 주석이 CHANGELOG와 모순" | 하위 감사 | **기각** — 원문 `:77~90`은 "예전 이유(해소됨)/지금 이유"를 정확히 구분해 기술 |
| 스킬 본문의 `${CLAUDE_PLUGIN_ROOT}` 치환 | 공식 문서 | **verified** — 세션에서 스킬 로드해 절대경로 도착 확인 |
| 에이전트 본문의 `${CLAUDE_PLUGIN_ROOT}` 치환 | — | **UNVERIFIED** — 문서 침묵 + 이 PC 프로브 불가 → §7① |
| Bash 도구 환경의 `CLAUDE_PLUGIN_ROOT` 부재 | — | **verified** — `env` 출력에 미존재, `/bin/capture.mjs`로 실패 재현 |
| 서브에이전트의 hub 와일드카드 해소 | — | **UNVERIFIED** → §7② |
| `BashOutput`/`KillShell` 암묵 제공 여부 | — | **UNVERIFIED** — 공식 문서 침묵 → §7②-3 |
