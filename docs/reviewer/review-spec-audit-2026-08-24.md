# 리뷰 보고서 — `round/spec-audit` (배포 직전 게이트)

- **target_id**: `spec-audit` · **차수**: 1차(최초 리뷰)
- **대상**: `git diff main..round/spec-audit` — 12커밋 / 40파일 / +1,395 −487
- **등급 판정**: **Refactor** (에이전트 21종 frontmatter 전면 개정 + 훅 2종 로직 변경 + 스킬 1종 폐지 + 전 직원 배포 대상) → 발산형 포함 **풀패널 필수**
- **작성**: reviewer · 2026-08-24
- **종합 판정**: 🔴 **Red** — Critical 1건이 있어 현 상태로 병합·배포 불가

> **측정 스코프 명시**: 이 판정은 `main..round/spec-audit` 의 40개 변경 파일과 그 변경이 직접 건드린 인접 실물(폐지 스킬 원문, 흡수처 스킬, 훅 2종, 린터, 매니페스트, 루트 문서 3종)만을 대상으로 한다. **`malgn-agent` 전체 품질에 대한 판정이 아니다.** 이 브랜치 밖의 기존 자산(스킬 37종 본문, knowledge 54종 본문, `bin/` 12종)은 이번 스코프에 포함되지 않았다.

---

## 0. 페르소나 패널 — 재사용/신규 판정

착수 전 `docs/reviewer/personas/INDEX.md` 를 Read해 "역할개념(1줄)" 열만 스크리닝했다. **신규 0건 — 6개 전부 재사용.**

| # | 페르소나 | 유형 | 판정 | 사유 |
|---|---|---|---|---|
| A | `persona-semantic-force-preservation-auditor.md` | 수렴 | **재사용** | 역할개념 "삭제·치환 리팩터링 후 규칙의 강제력이 조용히 약해졌는가"가 이번의 "상속→허용목록 전환으로 능력이 조용히 사라졌는가"와 동형. 대상이 문장에서 선언표면으로 바뀐 것뿐 |
| B | `persona-spec-implementation-conformance-auditor.md` | 수렴 | **재사용** | "명세=계약서, 커밋=납품물 1:1 대조"가 "폐지 스킬 283줄 ↔ 흡수처 3종" 대조와 동형 |
| C | `persona-hook-execution-safety-verifier.md` | 수렴 | **재사용** | "전역 자동실행 코드를 자기보고가 아니라 실제 실행 결과로 검증"이 훅 2종 변경과 정확히 일치 |
| D | `persona-script-skill-consistency-auditor.md` | 수렴 | **재사용** | "문서가 서술하는 약속 ↔ 실물 한 줄씩 대조"가 새 README·CHANGELOG·plugin.json·CI 주석 검증과 동형 |
| E | `persona-enforcement-gap-auditor.md` | 수렴 | **재사용** | "원칙이 게이트로 강제되는가"가 신설 린터 규칙·CI 검증 커버리지 판정과 동형 |
| F | `persona-zero-based-redesigner.md` | **발산** | **재사용** | "구조 자체가 최선인가, 더 단순한 검증된 대안이 있는가". INDEX의 「알려진 중복 역할개념」 안내에 따라 `persona-mechanism-zero-based-challenger.md` 대신 먼저 생성된 이쪽을 재사용 |

6개 모두 §5 참고파일이 직전 라운드 대상에 고정돼 있어 **역할개념 수준으로만** 적용했다(2026-08-10 RV-002 선례와 동일 처리). 각 파일 "적용 이력"에 이번 라운드 항목만 append했고 6대 요소 본문은 수정하지 않았다. INDEX.md 는 「최근 재사용」 열 갱신 + 표에 누락돼 있던 B의 행 추가.

---

## 1. 종합 지적 사항

| ID | 심각도 | 위치 | 요약 |
|---|---|---|---|
| RV-001 | 🔴 Critical | `agents/*.md` frontmatter 전체 | `AskUserQuestion` 이 어느 허용목록에도 없다 — **사람 승인 게이트가 실행 불가**해졌다 |
| RV-002 | 🟠 Major | `README.md:5,60` · `plugin.json:5` | 스킬 개수 38 → 실물 37. 같은 브랜치의 통폐합이 만든 드리프트 |
| RV-003 | 🟠 Major | `STATUS.md` 마지막 절 | 지목하는 `docs/anthropic/` 미러와 `pnpm run sync-docs` 가 존재하지 않는다 |
| RV-004 | 🟠 Major | `.github/workflows/validate-plugin.yml` | 새 CI는 `tools:` 도구명을 전혀 검증하지 않는다 — RV-001이 초록불로 통과한 구조적 원인 |
| RV-005 | 🟠 Major | `CHANGELOG.md:12~26` · 양 매니페스트 | `[Unreleased]` 가 5개 항목 중 1개만 담고 버전이 그대로 — 병합·푸시해도 `/plugin update` 가 감지하지 못한다 |
| RV-006 | 🟡 Minor | `validate-plugin.yml:70~73` | 말미 NOTE가 같은 브랜치에서 이미 수리된 `check-docs` 를 "아직 개인 홈 경로"라 서술 |
| RV-007 | 🟡 Minor | `agents/finance.md:60` | 자기검증이 `ls docs/finance/` 를 요구하는데 finance에는 Bash가 없다 |
| RV-008 | 🟡 Minor | `hooks/stop-mcp-reminder.cjs:128` | stdin이 `null` 이면 uncaught TypeError로 exit 1 (자기 파일이 선언한 "폴백" 계약 위반) |
| RV-009 | 🟡 Minor | `hooks/sessionstart-context.mjs:44` | `MALGN_STATUS_MAX_BYTES=1e5` 가 `parseInt` 로 **1** 이 되어 STATUS.md가 0줄 주입된다 |
| RV-010 | 🟡 Minor | `scripts/validate-agent-assets.mjs:356` | 새 규칙 정규식이 도메인 하위폴더를 요구해 `knowledge/README.md` 형태를 놓친다 |
| RV-011 | 🟡 Minor | `skills/reviewer-persona-panel-standard/SKILL.md:13` | **쓰기** 대상 경로에 읽기 전용 플러그인 루트 형태를 붙였고, 그 대상 파일군은 실재하지 않는다 |
| RV-012 | 🟡 Minor | `agents/*.md` frontmatter | `Agent` 는 현행 도구명이 맞으나, 이름이 바뀌기 전 버전의 Claude Code를 쓰는 직원에겐 pm이 위임 도구를 잃는다. 최소 버전 명시가 없다 |
| RV-013 | ⚪ Nit | `hooks/sessionstart-context.mjs` clip() | STATUS.md 첫 줄이 상한보다 크면 "앞 0B(0줄)" — 배너만 주입된다 |
| RV-014 | ⚪ Nit | 같은 파일 `emit(head + note, …)` | 드리프트 경고가 "이 아래는 주입되지 않았다" **뒤에** 붙어 잘린 내용으로 오독될 수 있다 |
| RV-015 | ⚪ Nit | `skills/topic-learning/SKILL.md:79,90` | 예시가 대상 문서에 없는 섹션명("환경변수·시크릿")을 인용하고, 헤딩("Docker 보안")과 링크 텍스트("Docker 배포 가이드")가 어긋난다 |
| RV-016 | ⚪ Nit | `agents/trainer.md:101,110` | 같은 파일 112·131행은 `malgn-agent/knowledge/…` 인데 이 두 행만 맨 `knowledge/…` |
| RV-017 | ⚪ Nit | `agents/finance.md` frontmatter | 21종 중 유일하게 hub MCP·ToolSearch 미부여인데 그 사유가 커밋 메시지에도 본문에도 없다 |
| RT-001 | 🔵 Rethink | 구조 | 21종 × 12항목 허용목록을 손으로 복제하는 구조 자체 |
| RT-002 | 🔵 Rethink | 판정 요청 | `${CLAUDE_PLUGIN_ROOT}` 에이전트 본문 치환 미검증 리스크의 무게 |

---

## 2. Critical — RV-001

### 무엇이 깨졌나

**`AskUserQuestion` 은 이 제품에서 "사람 승인"을 실행하는 유일한 채널이다.** `pm.md:74` 가 그 이유를 직접 적고 있다.

> `| **Sensitive/Refactor 등급** | reviewer 풀패널 필수 + **사람 승인 필수**. PM 단독으로 승인 불가 — malgnai-hub에 웹 승인함이 없으므로 `AskUserQuestion`으로 세션 내 직접 확인 |`

이 도구를 지시하는 곳은 제품 본문에 **26곳**이다.

| 파일 | 행 | 건수 |
|---|---|---|
| `agents/pm.md` | 74, 83, 94, 97, 98 | 5 |
| `agents/security.md` | 19, 21, 40, 113 | 4 |
| `agents/evaluator.md` | 28, 96, 102 | 3 |
| `agents/devops.md` | 38 | 1 |
| `agents/frontend-dev.md` | 38 | 1 |
| `agents/marketer.md` | 28 | 1 |
| `agents/reviewer.md` | 34 | 1 |
| `skills/common-permission-policy-compliance/SKILL.md` | 35, 43, 72, 78, 90, 95, 108, 151 | 8 |
| `skills/project-standards/SKILL.md` | 122 | 1 |

그리고 **21개 에이전트 중 어느 하나의 `tools:` 에도 `AskUserQuestion` 이 없다.**

`common-permission-policy-compliance` 는 qa-engineer·frontend-dev·devops·security·trainer·backend-dev 6종이 참조하므로, 직접 지시 7종 + 스킬 경유 6종 = **13개 에이전트가 자기가 가지지 못한 도구를 쓰라고 지시받는다.**

### 이 브랜치가 만든 회귀다

`main` 에서 pm·security·evaluator·devops·frontend-dev 5종은 `tools:` 줄 자체가 없어 **전체 상속**이었고, 따라서 `AskUserQuestion` 을 보유했다. 커밋 `5c58707` 이 이 5종을 명시 허용목록으로 옮기면서 그 능력이 목록에서 빠졌다. (marketer·reviewer는 이전에도 명시 목록이라 원래부터 없었다 — 이쪽은 기존 결함.)

### 재현

```bash
cd /Users/hopegiver/workspace/claude-plugins/malgn-agent/agents
node -e '
const fs=require("fs");
for(const f of fs.readdirSync(".").filter(x=>x.endsWith(".md"))){
  const m=fs.readFileSync(f,"utf8").match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const tools=(m[1].match(/^tools:\s*(.*)$/m)||[])[1]||"";
  const n=(m[2].match(/AskUserQuestion/g)||[]).length;
  if(n && !tools.includes("AskUserQuestion")) console.log(f, "본문", n, "회 지시 / 허용목록 없음");
}'
```
→ devops.md 1 / evaluator.md 3 / frontend-dev.md 1 / marketer.md 1 / pm.md 5 / reviewer.md 1 / security.md 4

`git show main:malgn-agent/agents/pm.md | sed -n '1,6p'` 로 이전에 `tools:` 줄이 없었음(=전체 상속)을 확인할 수 있다.

### "목록 누락 = 차단"의 근거

이 브랜치 자신의 커밋 메시지(`5c58707`)가 인용한 공식 문서 문장이 그대로 근거가 된다.

> "To prevent a subagent from invoking skills entirely, omit `Skill` from the tools list"

즉 **목록에서 빼는 것이 곧 차단**이며, 이 라운드는 그 전제 위에서 12개 에이전트에 `Skill` 을 추가했다. 같은 전제를 `AskUserQuestion` 에 적용하면 결론은 하나다.

### 영향

Sensitive/Refactor 등급 작업, 프로덕션 배포(`devops.md:38`), 광고비 집행(`marketer.md:28`), 거버넌스 파일 편집(`frontend-dev.md:38`), 최종 보안 게이트(`security.md:113`), Sensitive PR 병합(`evaluator.md:28`) — 이 제품의 **비가역·대외 영향 행위 전부**가 이 게이트 뒤에 있다. 도구가 없으면 에이전트는 둘 중 하나로 간다: 평문으로 "승인해 주세요"라고 적고 그대로 진행하거나, 멈춰 서서 위임이 끊긴다. 둘 다 배포 전에 막아야 한다.

### 권고

pm·security·evaluator·devops·frontend-dev·marketer·reviewer 7종의 `tools:` 에 `AskUserQuestion` 을 추가한다. (`common-permission-policy-compliance` 를 참조하는 qa-engineer·trainer·backend-dev도 같은 지시를 받으므로 함께 검토.) 수정은 trainer 위임 대상이다.

### 정직 표기 — 이 지적의 미검증 지점

허용목록이 런타임에서 `AskUserQuestion` 을 실제로 차단하는지 **실행으로 재현하지 못했다**(이 세션에는 서브에이전트를 띄울 도구가 없다). 근거는 ①공식 문서의 allowlist 의미론 ②같은 문서의 `Skill` 누락=차단 문장 ③이 라운드가 그 문장을 이미 수리 근거로 채택했다는 내적 정합성 — 세 가지다. 만약 인터랙티브 도구가 허용목록과 무관하게 항상 제공된다면 이 지적은 기각되어야 한다. 병합 전 그 한 가지만 확인하면 판정이 확정된다.

---

## 3. Major

### RV-002 — 스킬 개수가 실물과 다르다 (38 vs 37)

- **위치**: `malgn-agent/README.md:5`("노하우 스킬 38종"), `README.md:60`("### 스킬 38종"), `malgn-agent/.claude-plugin/plugin.json:5`(description). (저장소 내부 `CLAUDE.md:133` 도 동일)
- **문제**: 같은 브랜치의 커밋 `74ea657`(보안 스킬 4→3종)이 스킬을 하나 줄여 실물이 37이 됐는데, 그보다 앞선 커밋 `12c8952` 가 만든 README·plugin.json은 38로 적혀 있다. **이 라운드가 스스로 만든 드리프트**다.
- **재현**: `git ls-tree --name-only main:malgn-agent/skills | wc -l` → 38 / `git ls-tree --name-only round/spec-audit:malgn-agent/skills | wc -l` → **37**
- **왜 Major인가**: 기능은 안 깨지지만 ⑴전 직원이 처음 읽는 문서이고 ⑵`plugin.json` 의 description은 `/plugin` 목록에 그대로 노출되며 ⑶수정 비용이 0에 가깝고 ⑷이 값을 지키는 자동 게이트가 없어 한 번 어긋나면 계속 어긋난다.
- **권고**: 37로 정정. 함께, 개수를 문서에 박는 대신 `check-assets` 가 실측치와 대조하는 규칙을 넣을지 별건으로 판단(변경 동결 중이므로 백로그).

### RV-003 — STATUS.md가 존재하지 않는 문서 미러를 정본으로 지목한다

- **위치**: `STATUS.md` 마지막 절 — "**사양 확인은 기억·웹검색이 아니라 `docs/anthropic/` 미러.**"
- **문제**: `docs/anthropic/` 은 이 저장소에 **없다**. 그것을 만든 커밋 `a5b75a3`("Anthropic 공식 문서 원문 미러 구축 + 갱신 스크립트", 2026-08-20, 23건)은 `main` 에도 `round/spec-audit` 에도 들어오지 않았고, 폐기된 라운드 브랜치(`principle-upgrade-priority` 계열)에만 남아 있다. `pnpm run sync-docs` 도 `package.json` 에 없다.
- **재현**:
  ```bash
  ls docs/anthropic            # No such file or directory
  grep -n sync-docs package.json   # 없음
  git branch -a --contains a5b75a3 # principle-upgrade-priority 계열만
  ```
- **왜 Major인가**: STATUS.md는 SessionStart 훅이 **매 세션 통째로 주입**하는 파일이다. 즉 이 저장소에서 열리는 모든 세션이 "사양은 저 미러에서 확인하라"는 지시를 받고, 그 미러가 없다는 사실은 열어봐야만 알게 된다. 더 뼈아픈 건 **이번 라운드의 전제가 바로 "공식문서와 실물 대조"였다는 점**이다 — 세 병렬 에이전트가 대조 근거로 삼으라고 지목받은 자료가 그들 브랜치에 없었다. (실제로 RT-002의 미검증 항목이 남은 것도 이 공백과 무관하지 않다.)
- **권고**: 둘 중 하나. ⑴`a5b75a3` 의 `docs/anthropic/` + `scripts/sync-anthropic-docs.mjs` 를 별도 워크트리에서 cherry-pick 해 main에 살린다(폐기 라운드의 다른 커밋이 딸려오지 않도록 경로 지정). ⑵살리지 않을 거면 STATUS.md의 그 문장과 "최근 완료"의 해당 항목을 지운다. **어느 쪽이든 지금 결정해야 한다** — 지금은 세션마다 거짓 지시가 주입되고 있다.

### RV-004 — 새 CI는 `tools:` 도구명을 전혀 검증하지 않는다

- **위치**: `.github/workflows/validate-plugin.yml:63,71`(`claude plugin validate … --strict`), `scripts/validate-agent-assets.mjs:26,36`
- **문제**: 이 라운드는 21개 에이전트를 "상속"에서 "명시 허용목록"으로 옮겼다. 이제 도구명 한 글자만 틀려도 능력이 조용히 사라진다. 그런데 그것을 잡는 게이트가 없다.
- **재현(양성 대조군)**: 샌드박스 사본의 `pm.md` frontmatter를 `tools: TotallyBogusTool, Read` 로 바꾸고
  ```bash
  claude plugin validate <sandbox>/malgn-agent --strict
  ```
  → `✔ Validation passed`. `Agent` / `Task` / `mcp__…__*` / `TotallyBogusTool` **네 값이 전부 동일하게 통과**한다. 저장소 자체 린터(`validate-agent-assets.mjs`)도 `tools` 를 "허용된 frontmatter 키"로만 알 뿐 값은 보지 않는다.
- **왜 Major인가**: RV-001이 `pnpm run check-assets` **ERROR 0 · WARN 18** 초록불 아래에서 그대로 통과한 이유가 정확히 이것이다. 이 저장소는 과거에도 같은 패턴(죽은 스킬 참조 16건이 2주간 초록불 밑에서 생존)을 겪었다.
- **권고**: `validate-agent-assets.mjs` 에 두 규칙을 넣는다. ①`tools` 값의 각 항목이 알려진 도구명 화이트리스트 또는 `mcp__<server>__*` 패턴에 맞는지 ②**본문이 이름을 대며 지시하는 도구가 허용목록에 있는지**(RV-001을 잡는 규칙). 둘 다 기존 `liveReferences`·`warn()` 헬퍼로 저비용이다. 다만 **이는 신설이므로 변경 동결 정책상 사용자 승인 대상** — 이번 라운드에 끼워넣지 말고 백로그로 올릴 것을 권한다.

### RV-005 — 릴리스가 닿지 않는다: CHANGELOG 미기재 + 버전 미상향

- **위치**: `malgn-agent/CHANGELOG.md:12~26`, `malgn-agent/.claude-plugin/plugin.json:4`(1.7.8), `.claude-plugin/marketplace.json`(1.7.8)
- **문제**: `[Unreleased]` 절에 적힌 것은 **배포 위생 커밋(`12c8952`) 하나뿐**이다. 이 라운드의 나머지 4건 — 훅 결함 2건 수리, 에이전트 21종 frontmatter, knowledge 경로 규약 112건, 보안 스킬 4→3종 통폐합 — 이 전부 빠져 있다. 버전도 1.7.8 그대로다.
- **왜 Major인가**: 같은 CHANGELOG 머리말이 그 위험을 직접 적고 있다 — "두 값이 어긋나면 `/plugin update` 가 변경을 감지하지 못하므로 반드시 같이 올립니다." 버전을 안 올리고 main에 push하면 **이 라운드의 수리가 아무 직원에게도 닿지 않는다.** 이 저장소는 실제로 v1.7.3에서 그 사고를 겪었다.
- **인지 여부**: 버전·배포 미착수는 `STATUS.md` 열린 작업에 "**버전 번호와 배포는 아직**"으로 적혀 있다. 즉 절반은 인지된 상태다. **인지되지 않은 것은 CHANGELOG `[Unreleased]` 의 불완전성**이다 — 지금 상태로 릴리스하면 4건이 이력에서 영구히 누락된다.
- **권고**: 병합 전 체크리스트로 고정 — ①`[Unreleased]` 에 5개 항목 전부 기재 → `## [1.7.9]` 로 확정 ②`plugin.json` + `marketplace.json` 양쪽 버전 동시 상향 ③CI의 마켓플레이스 검증이 두 값 불일치를 실제로 잡는다는 것은 확인됨(아래 §6 참조).

---

## 4. Minor

### RV-006 — CI 주석이 같은 브랜치에서 이미 고친 것을 "아직 안 고쳤다"고 적는다
`validate-plugin.yml` 말미 NOTE: "`pnpm run check-docs` 는 현재 개인 전역 경로(`$HOME/.claude/hooks/`)를 실행하도록 되어 있어 …". 그러나 같은 브랜치의 **뒷 커밋** `361ae15` 가 `package.json` 을 `node malgn-agent/hooks/doc-drift.mjs` 로 이미 바꿨다(커밋 순서: `12c8952` → `361ae15`). 실행도 확인했다 — `node malgn-agent/hooks/doc-drift.mjs` → exit 0. **권고**: NOTE를 지우고 `check-docs` 를 CI 단계로 추가할지 판단(현재는 매니페스트 부재로 사실상 no-op이라 추가해도 얻는 게 적다는 점을 함께 고려).

### RV-007 — finance의 자기검증이 실행 불가
`agents/finance.md:60`: "`docs/finance/` 아래 필요한 산출물 파일이 실제로 생성되었는가? (`ls docs/finance/` 로 확인)". finance의 `tools` 는 `Read, Grep, Glob, Write, Skill, WebFetch, WebSearch` — **Bash가 없다.** main에서도 finance는 명시 목록이었고 Bash가 없었으므로 이 브랜치가 만든 회귀는 아니지만, 이번에 21종 frontmatter를 전수 손본 라운드가 잡았어야 할 자리다. **권고**: `ls` 대신 Glob으로 확인하도록 문구를 고치거나(권장), finance에 Bash를 준다.

### RV-008 — Stop 훅이 `null` 입력에 크래시한다
```bash
printf 'null' | node malgn-agent/hooks/stop-mcp-reminder.cjs
# TypeError: Cannot read properties of null (reading 'transcript_path')  → exit 1
```
`payload = input ? JSON.parse(input) : {}` 에서 `JSON.parse("null")` 이 `null` 을 돌려준다. 파일 자신이 머리에 "파싱 실패/불확실하면 항상 안전한 쪽(리마인더 표시)으로 폴백한다"고 적어둔 계약을 이 경로만 지키지 않는다. **완화**: Claude Code는 항상 객체를 보내므로 실사용 재현 경로는 없고, exit 1은 Stop 훅을 차단하지 않는다(차단은 exit 2). 그래서 Critical이 아니라 Minor. **권고**: `payload = (input && JSON.parse(input)) || {}` 후 타입 확인 한 줄.

### RV-009 — 상한 환경변수 오설정이 조용히 주입량을 0으로 만든다
```
MALGN_STATUS_MAX_BYTES=1e5  →  limit=1,  kept=0줄
MALGN_STATUS_MAX_BYTES=abc  →  기본 12000 (정상 폴백)
MALGN_STATUS_MAX_BYTES=-5   →  기본 12000 (정상 폴백)
```
`Number.parseInt("1e5", 10)` 은 **1** 이다. 코드 주석은 "오설정은 기본값으로 — 세션을 막지 않는다"고 선언했지만 지수 표기(사람이 100000을 적는 흔한 방식)는 폴백을 타지 않고 1바이트 상한이 된다. **권고**: `/^\d+$/` 로 먼저 걸러 통과 못 하면 기본값.

### RV-010 — 새 린터 규칙에 구멍이 하나 있다
`REF_KNOWLEDGE_UNREACHABLE` 의 정규식 `\bknowledge\/[A-Za-z0-9_-]+\/…` 는 **도메인 하위폴더를 필수로 요구**한다. 그래서 `knowledge/README.md` 처럼 최상위 파일을 맨 상대경로로 가리키면 잡히지 않는다.

양성 대조군으로 확인했다(샌드박스 `writer.md` 에 3줄 주입):

| 주입한 형태 | 결과 |
|---|---|
| `이 플러그인의 knowledge/common/agent-common-principles.md` | ✅ ERROR |
| ``` `knowledge/common/…md` ``` (백틱형) | ✅ ERROR |
| `knowledge/common/…md` (맨몸) | ✅ ERROR |
| `${CLAUDE_PLUGIN_ROOT}/knowledge/…` | ✅ 통과(정상) |
| `malgn-agent/knowledge/…` | ✅ 통과(정상) |
| **`knowledge/README.md`** | ❌ **놓침** |
| **`이 플러그인의 knowledge/README.md`** | ❌ **놓침** |

**현재 위반 실물은 0건**이다(`agents/`·`skills/` 의 `knowledge/README.md` 참조 6곳 전부 올바른 `malgn-agent/` 쓰기형). 잠재 구멍이므로 Minor. **권고**: 하위폴더를 선택적으로(`knowledge/(?:[A-Za-z0-9_-]+/)*…`).

### RV-011 — 쓰기 대상에 읽기 전용 경로를 붙였고, 그 파일군은 없다
`skills/reviewer-persona-panel-standard/SKILL.md:13`
> `재사용 페르소나 자산: ${CLAUDE_PLUGIN_ROOT}/knowledge/review/persona-*.md — trainer가 반복·검증된 페르소나를 승격`

이건 trainer가 **파일을 만드는** 자리다. 그런데 이 브랜치가 같은 커밋에서 새로 세운 규약(`common-output-storage-and-path-management` §1-2 표)이 "malgn-agent 소스 clone을 **고친다** → `malgn-agent/knowledge/…`" 라고 못박고 있다. 실제로 `agents/trainer.md:112` 와 `agents/evaluator.md:64` 는 올바르게 `malgn-agent/knowledge/…` 를 쓴다 — 같은 대상을 두 형태로 적고 있다. 덧붙여 `knowledge/review/` 에는 `reviewer-personas.md` 와 `screenshot-capture-guide.md` 뿐이고 **`persona-*.md` 는 하나도 없다**. 와일드카드 `*` 때문에 린터의 부재 검사(`REF_KNOWLEDGE_MISSING`)도 형태 검사도 이 줄을 보지 못한다. **권고**: `malgn-agent/knowledge/review/persona-*.md` 로 형태를 맞추고, 자산이 0건인 현실을 문장에 반영할지 별도 판단.

### RV-012 — `Agent` 는 맞지만 최소 버전이 어디에도 없다
`pm.md` 의 `tools: Agent, …` 는 **현행 도구명이 맞다**(공식 sub-agents 문서가 `Agent(agent_type)` 문법을 규정하고, `Task` 는 별칭으로 남아 있다고 적는다). 다만 claude-code CHANGELOG를 보면 이 이름은 2.1.6x 대에서 바뀌었고, 그 이전 버전의 frontmatter 문법은 `Task(agent_type)` 이었다. 이름이 바뀌기 전 버전을 쓰는 직원 PC에서는 `Agent` 가 인식되지 않아 **pm이 위임 도구를 통째로 잃는다** — 그리고 그 상황을 사용자에게 알리는 에러는 비교적 최근 버전에서야 추가됐다("Fixed the Agent tool launching with no tools when a subagent's `tools` list resolves to nothing — it now returns a clear error naming the unrecognized entries"). 이 저장소는 CI에서 CLI 2.1.241을 고정하지만 **직원 PC의 최소 버전은 어디에도 명시돼 있지 않다.** **권고**: README 설치 절에 최소 Claude Code 버전 한 줄. (직원들의 실제 버전 분포는 이 세션에서 확인할 수 없었다 — 미확인.)

---

## 5. Nit

- **RV-013** `clip()` 은 줄 경계로 자르므로 STATUS.md의 **첫 줄**이 상한보다 크면 `앞 0B(0.0KB, 0줄)만 들어왔다` 가 되어 배너만 주입된다(120KB 1줄 파일로 재현). 안내하는 `offset 1` 자체는 맞아서 실해는 작다.
- **RV-014** `emit(head + note, userMsg)` 라 드리프트 경고가 `⚠️ **여기서 잘렸다** … 이 아래는 주입되지 않았다` **뒤**에 붙는다. 잘려나간 내용처럼 읽힐 수 있다.
- **RV-015** `topic-learning/SKILL.md:90` 의 예시가 `docker-cloudflare-guide.md` 의 "환경변수·시크릿" 섹션을 인용하는데 그 문서의 실제 섹션은 `## .env 관리` / `### 5. 시크릿/CI` 다. 같은 예시 블록의 헤딩은 여전히 `### Docker 보안 (2024-07-15)` 인데 링크 텍스트만 "Docker 배포 가이드"로 바뀌었다. 예시가 "없는 섹션명을 지어내도 된다"를 가르치게 된다.
- **RV-016** `agents/trainer.md:101,110` 은 맨 `knowledge/<도메인>/…`, 같은 파일 112·131행은 `malgn-agent/knowledge/…`. 둘 다 쓰기 맥락이라 후자가 맞다. `<` 가 들어 있어 린터가 자리표시자로 보고 건너뛴다.
- **RV-017** `STATUS.md` 에 있던 「위임 모델」이 `CLAUDE.md` 로 옮겨지면서 5개 운영 규칙은 온전히 보존됐으나 **근거(실측) 문단**(서브에이전트 10회·246만 토큰, trainer 거부·정정 15/15 적중)이 빠졌다. 규칙만 남고 이유가 사라지면 다음 세션이 같은 논쟁을 다시 연다.

---

## 6. 🔵 Rethink (발산형 — `persona-zero-based-redesigner`)

### RT-001 — 21종 × 12항목 허용목록을 손으로 복제하는 구조가 옳은가

이번 라운드는 21개 파일에 사실상 같은 12개 항목 목록을 붙여 넣었다. 그 결과가 RV-001이다 — **한 항목을 빠뜨리면 21곳 중 어디서도 알 수 없고, 게이트도 없다(RV-004).**

공식 sub-agents frontmatter에는 `tools` 뿐 아니라 **`disallowedTools`(denylist)** 가 있다. 이 라운드가 실제로 달성하려던 것은 목록에 열거된 셋 중 하나뿐이었다:

1. 12종에 `Skill` 추가 → **누락 수리**(빼려던 게 아니라 넣으려던 것)
2. 5종에 hub MCP 추가 → **누락 수리**
3. 9종에서 `Agent` 제거 → **유일하게 "빼려던 것"**

즉 **진짜 요구는 "서브에이전트 재귀 생성 금지" 하나**였다. 그렇다면 상속을 유지한 채 `disallowedTools: Agent` 한 줄이 같은 목표를 달성하면서 표면적을 1/12로 줄인다. 20개 파일에서 `tools:` 를 지우고 `disallowedTools: Agent` 로 바꾸면 RV-001·RV-007·RV-012가 **동시에 소멸**한다(상속이므로 본문이 요구하는 도구는 늘 있다).

반론도 있다: 명시 허용목록은 "이 에이전트가 무엇을 할 수 있는지"를 문서로 드러내고, 최소권한 원칙에 부합한다. ux-designer/visual-designer/reviewer가 본문에 "Edit은 부여하지 않는다"라고 적어둔 것과 정합하기도 한다.

**권고**: 두 방식 중 하나를 고르라는 게 아니라, **최소권한을 유지하려면 RV-004의 게이트가 선행조건**이라는 것이다. 게이트 없이 허용목록만 도입한 지금 상태가 최악의 조합이다 — 표면은 21배로 늘었는데 그것을 지키는 기계는 없다. 배포 동결 정책상 이번 라운드에서 구조를 바꾸는 것은 권하지 않는다. **RV-001만 수리해 배포하고, "허용목록 유지 + 도구명 게이트 신설" vs "denylist 회귀" 를 백로그 결정으로 올린다.**

### RT-002 — `${CLAUDE_PLUGIN_ROOT}` 에이전트 본문 치환 미검증 리스크 (PM 판정 요청 항목)

**결론: 이 미검증 항목은 배포를 막을 이유가 되지 않는다. 하방이 닫혀 있기 때문이다.**

세 가지를 확인했다.

**① 공식 문서는 이 자리를 명시적으로 규정한다.** plugins-reference의 치환 위치 표 첫 행이 그것이다.

| Plugin component | Fields where placeholders resolve |
|---|---|
| **Skill and agent content** | **Anywhere the placeholder appears** |

스킬과 에이전트가 **같은 행**에 있고, 스킬 쪽 치환은 이미 실물로 확인됐다. 두 컴포넌트가 같은 행에 묶여 있는데 한쪽만 동작하지 않으려면 문서가 틀렸어야 한다.

**② 이미 배포된 상태다.** `~/.claude/plugins/marketplaces/malgnsoft-plugins/malgn-agent`(v1.7.8, origin/main)의 `ux-designer.md`·`frontend-dev.md` 본문에 이 변수가 각 1건씩 이미 들어 있다. **즉 이 리스크는 이 브랜치가 새로 만든 것이 아니라 이미 전 직원에게 나가 있다.** 이 브랜치를 막아도 리스크는 줄지 않는다.

**③ 결정적으로, 실패했을 때의 결과가 "직전 상태와 동일"이다.** 이 라운드가 바꾼 97곳의 이전 형태는 `이 플러그인의 knowledge/…` 라는 **산문**이었고, 그것은 도달 불가가 **실측으로 증명된** 형태다(서브에이전트가 본문 그대로 Read → `File does not exist`). 따라서:

| 시나리오 | 결과 |
|---|---|
| 치환된다 (문서대로) | 97곳이 도달 가능해진다 — 순이득 |
| 치환 안 된다 | 97곳이 여전히 도달 불가 — **직전과 동일**, 추가 손실 없음 |

게다가 실패 모드가 **더 낫다**. 산문은 사람에게 뜻이 통해서 아무도 결함으로 인지하지 못했지만(109건이 그렇게 살아남았다), 문자 그대로의 `${CLAUDE_PLUGIN_ROOT}` 는 누가 봐도 안 풀린 자리표시자라 즉시 드러난다. 그리고 §1-1이 그 상황의 대처법("이미 로드된 스킬 본문 머리의 base directory에서 플러그인 루트를 얻어 이어붙인다")까지 적어뒀다.

**권고**:
- 이 항목을 **배포 차단 사유에서 내린다.**
- 대신 **배포 직후 30초짜리 확인**을 배포 체크리스트에 넣는다: 버전 상향 → `/plugin marketplace update` + `/plugin update` → 재시작 → 아무 에이전트(예: writer)를 호출해 "네 본문 '학습 자료' 절에 적힌 첫 번째 knowledge 경로를 Read해 첫 줄을 보고하라"고 시킨다. 열리면 치환 확인, `File does not exist` 면 미치환 확인. 어느 쪽이든 그 결과를 STATUS.md/hub에 한 줄로 남긴다.
- 이 PC의 실행 캐시가 1.7.6에서 멈춰 있어(캐시 13개 버전 확인, 최신이 1.7.6) 지금은 프로브 자리가 없다는 PM의 관측을 **재확인했다**. 즉 "배포 전에는 확인할 수 없다"는 진단 자체가 맞다.

---

## 7. 기각된 지적 (오탐 — 삭제하지 않고 사유와 함께 남긴다)

| 후보 지적 | 기각 사유 |
|---|---|
| "보안 스킬 통폐합에서 실행 가능한 점검 항목이 소실됐다" | **전건 추적 결과 소실 0건.** `git show main:…/domain-backend-security-audit/SKILL.md`(283줄)의 6개 블록을 항목 단위로 대조: ①Hono 인증게이트 → §1 신설 체크박스("Refresh token 재발급 경로") + `domain-backend-api-implementation-patterns` §A 포인터 ②역할가드 → §B 포인터 ③site_id 테넌시 → §5 + §F 포인터 ④4위치 입력검증 → §2-1~2-4로 **전문 이식** ⑤외부호출 → §6으로 **전문 이식** ⑥자가검증 → §"적용 체크리스트" 흡수. 포인터가 가리키는 §A/§B/§D/§F 라벨이 대상 파일 312·322·349·367행에 **실재**하고, 유일하게 사라질 뻔했던 "상태코드 영문 ENUM + `statusLabel()`" 규약도 370행에 있다. 폐지 스킬로의 죽은 참조도 제품 본문 0건(`docs/` 이력 서술 3곳만 잔존, 정상) |
| "hub MCP를 `mcp__…__*` 와일드카드로 준 것은 유효하지 않다" | 공식 sub-agents 문서가 서버 단위 패턴을 명시한다 — "Both fields accept MCP server-level patterns … `mcp__<server>` or `mcp__<server>__*` grants or removes every tool from the named server." 커밋 메시지의 주장이 사실 |
| "ux-designer·visual-designer·reviewer에서 `Edit` 이 빠져 능력을 잃었다" | 세 파일 모두 본문에 "**Edit은 부여하지 않는다**"를 명문화하고 사유까지 적어뒀다(`ux-designer.md:12`, `visual-designer.md:12`, `reviewer.md:9`). 의도된 경계이고 frontmatter가 그 의도와 일치한다 |
| "STATUS.md 축약이 살아있는 정보를 아카이브로 보내버렸다" | 아카이브의 「보류 백로그」 5건은 **전부 취소선 처리된 해소 항목**이고, 살아있던 「위임 모델」은 `CLAUDE.md` 「위임 운영 규칙」으로 5개 규칙이 온전히 이관됐다(대조 확인). 열린 이슈 3건·백로그 3건은 현 STATUS.md에 유지. 단 근거 문단 소실은 RV-017 Nit으로 남김 |
| "`Task` 를 써야 하는데 `Agent` 를 썼다" | 공식 문서상 `Agent` 가 현행 도구명이고 `Task` 가 별칭이다. 구버전 호환은 별개 리스크라 RV-012로 강등해 기재 |
| "`check-docs` 가 상대경로라 어디서 실행하든 깨진다" | npm/pnpm 스크립트는 `package.json` 이 있는 디렉터리를 cwd로 실행한다. 실행 확인 결과 exit 0 |

---

## 8. 잘 된 점 (다음 라운드의 기준선)

1. **Stop 훅 수리는 A/B로 실증됐고, 내가 독립 재현했다.** 합성 트랜스크립트 8종을 만들어 돌린 결과, `main` 버전은 기록 직후에도 리마인더를 띄웠고(A 케이스) 새 버전은 침묵했다. 문서에 적힌 실패 시나리오(구 provider `mcp__malgnai-mcp__issue_resolve` 만 있는 트랜스크립트에서 엉뚱한 접두어를 학습)까지 그대로 재현해 D 케이스가 올바르게 기본 접두어로 폴백하는 것을 확인했다. **8/8 기대대로.**

   | 케이스 | 기대 | 실측 |
   |---|---|---|
   | A 플러그인 접두어 기록 도구 사용 | SKIP | SKIP ✅ |
   | B 쓰기만·기록 없음 | 리마인더(기본 접두어) | ✅ |
   | C 앞 턴에만 hub 도구 | 리마인더(학습 접두어) | ✅ |
   | D 구 provider 이름만 | 리마인더(기본 접두어로 폴백) | ✅ |
   | E `.mcp.json` 직접 등록명 | 리마인더(`mcp__malgnai-hub__`) | ✅ |
   | F 조회성 도구만 | SKIP | SKIP ✅ |
   | G 깨진 JSON 줄 혼입 | 리마인더 | ✅ |
   | H 직접 등록 기록 도구 사용 | SKIP | SKIP ✅ |

2. **SessionStart 훅은 "조용히 자르지 않는다"를 실제로 지킨다.** 887KB STATUS.md로 재현했을 때 ①본문 앞 ②잘린 지점 ③`systemMessage` 세 곳 모두에 잘린 사실·바이트 수·줄 수·이어 읽는 `offset` 이 명시됐다. 깨진 입력 5종(없음/디렉터리/권한없음/거대/1줄)에서 **전부 exit 0 + 유효 JSON**. 세션 차단 경로를 찾지 못했다.

3. **새 린터 규칙은 설계대로 동작한다(뮤테이션 검증).** 산문형·맨상대경로·백틱형 3종을 전부 잡고 정상형 2종은 통과시킨다(§4 RV-010의 표 참조). 부재 검사(`REF_KNOWLEDGE_MISSING`)와 **형태** 검사를 분리한 판단이 정확하다 — 부재 검사만으로는 "파일은 있는데 못 여는" 109건이 초록불을 통과했다는 주석의 진단이 옳다.

4. **CI의 마켓플레이스 검증 주장이 사실이다.** 샌드박스에서 `marketplace.json` 버전만 0.3.0으로 바꿔 넣고 `claude plugin validate . --strict` 를 돌리자 정확히 그 경고와 함께 실패했다 — "Entry declares version "0.3.0" but malgn-agent/.claude-plugin/plugin.json says "1.7.8" … At install time, plugin.json wins". v1.7.3의 사고를 재발 방지하는 진짜 게이트다.

5. **보안 스킬 재편의 판단 축이 좋다.** "이 스킬은 X와 중복되지 않는다"는 상호 해명문을 경계 표시로 인정하지 않고, **"언제 이걸 여는가"를 하나의 축(라우트 한 건 / 이 스택의 코드베이스 / 프로젝트 전체 태세) 위에서 배타적으로** 진술하게 바꾼 것. 그리고 "항상 함께 읽히도록 설계된 두 스킬은 하나여야 한다"는 통합 신호. 이 판단이 `docs/methodology/` 3개 문서에 회고 가능한 형태로 반영됐다.

6. **`${CLAUDE_PLUGIN_ROOT}` 를 쓰면 안 되는 자리를 정확히 피했다.** `knowledge/quality/e2e-testing-guide.md`·`templates/e2e-template/README.md`·`bin/*.mjs` 는 변수를 쓰되 **그 자리에서 절대 풀리지 않는다는 경고를 바로 옆에 달았고**, `knowledge/README.md` 는 아예 `${...}` 형태를 쓰지 않고 "맨이름 CLAUDE_PLUGIN_ROOT를 달러+중괄호로 감싸"라고 말로 적었다. PM이 우려한 오적용은 RV-011 한 건뿐이다.

7. **제품 본문에 조회 불가능한 식별자가 새로 유입되지 않았다.** 이 브랜치의 추가분(`git diff main..branch | grep '^+'`)에서 8자리 hex·26자 ULID·`commit \`…\`` 0건. `check-assets` 기준선 **ERROR 0 · WARN 18** 도 유지된다.

---

## 9. PM 권고 (병합 전 순서)

| 순서 | 항목 | 대상 | 비고 |
|---|---|---|---|
| 1 | **RV-001 수리** — 7종 `tools` 에 `AskUserQuestion` 추가 | **trainer 위임** | 배포 차단. `agents/` 편집이므로 PM 직접 수정 금지 |
| 1b | RV-001 전제 확인 — 허용목록이 인터랙티브 도구를 실제로 막는지 1회 재현 | PM 또는 qa-engineer | 막지 않는다면 RV-001 기각 |
| 2 | **RV-003 결정** — `docs/anthropic/` 을 살릴지, STATUS.md 문장을 지울지 | PM(사용자 판단) | 매 세션 주입되는 거짓 지시. 살린다면 별도 워크트리에서 경로 지정 cherry-pick |
| 3 | RV-002 정정 (38 → 37, 3곳) | README·plugin.json은 PM 직접 가능 | `plugin.json` 은 `.claude-plugin/` 이라 PM 편집 허용 범위 |
| 4 | RV-005 — CHANGELOG `[Unreleased]` 에 5개 항목 전부 기재 → 1.7.9 확정 → 양 매니페스트 동시 상향 | PM | 안 하면 이 라운드가 아무에게도 닿지 않는다 |
| 5 | RV-006~RV-012 (Minor 7건) | `hooks/`·`skills/`·`agents/` 는 trainer / `scripts/`·`.github/` 는 PM | 배포 차단은 아니나 대부분 1~2줄 |
| 6 | 배포 직후 RT-002 프로브 실행 + 결과 1줄 기록 | PM | §6 절차 |
| 7 | 백로그 등재 — RV-004 게이트 신설, RT-001 구조 결정, RV-002 개수 자동대조 | PM | **전부 "신설/개선"이라 변경 동결 정책상 사용자 승인 대상.** 이번 라운드에 끼워넣지 말 것 |

**병합 전 마지막으로**: 워킹트리에 미커밋 변경 3건(`CLAUDE.md`, `docs/archive/status-2026-08-history.md`, `package.json`)과 미추적 파일 1건(`scripts/check-status-size.mjs`)이 있다. 새 `CLAUDE.md` 가 `pnpm run check-status` 를 항구 규칙으로 지시하는데 그 스크립트와 npm 항목이 아직 커밋되지 않았다 — **셋을 같이 커밋하지 않으면 규칙만 남고 도구가 없다.** `git add -A` 는 금지(경로 지정 커밋).

---

## 10. 이번 리뷰가 하지 않은 것 (정직 표기)

- **런타임 재현 없음**: ①허용목록이 `AskUserQuestion` 을 실제로 차단하는가(RV-001) ②`${CLAUDE_PLUGIN_ROOT}` 가 에이전트 본문에서 치환되는가(RT-002) ③hub MCP 실제 도구명이 `mcp__plugin_malgn-agent_malgnai-hub__…` 가 맞는가 — 셋 다 서브에이전트를 띄우거나 새 버전을 설치해야 확인 가능한데 이 세션에는 그 수단이 없다. 커밋 메시지의 "설치본 실제 도구명" 주장은 **검증하지 못했다**(다만 Stop 훅 수리가 로컬 트랜스크립트 실측 148건에 근거한다는 STATUS.md 기록은 있다).
- **CI 실제 실행 없음**: `claude plugin validate` 두 단계는 로컬 CLI **2.1.237** 로 돌려 통과를 확인했다. CI가 고정한 **2.1.241** 에서의 동작은 확인하지 못했다.
- **화면 리뷰 없음**: 이번 산출물에 UI가 없어 `docs/screenshots/` 캡처는 해당 사항 없음.
- **전문 정독 범위**: 21개 에이전트 본문을 전문 정독하지는 않았다. 대신 ⑴`git diff` 전량 ⑵24개 도구명 × 21파일 기계적 교차대조 ⑶핵심 5개 파일(pm·security·evaluator·finance·trainer) 관련 절 정독으로 대체했다. 이 방식은 "본문이 이름을 대며 지시하는 도구"는 잡지만, **이름 없이 서술로만 요구되는 능력**(예: "노트북을 수정한다")은 놓칠 수 있다.
- **`STATUS.md` 61KB→7KB 축약의 무손실 여부는 git으로 검증할 수 없었다** — `STATUS.md` 는 `.gitignore` 대상이라 `git show main:STATUS.md` 가 존재하지 않는다(PM 위임서의 전제가 사실과 다르다). 대신 워크트리 `.claude/worktrees/agent-ad977a01a0a9004a5/STATUS.md`(7,324B, 중간본)를 찾아 현재본(2,904B)·아카이브(71KB)와 3자 대조했다. 원본 61KB 전문과의 완전 대조는 하지 못했다.
- **기각한 지적은 §7에 사유와 함께 남겼다**(6건).
