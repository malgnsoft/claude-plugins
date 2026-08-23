---
created: 2026-08-23
author: reviewer
status: FINAL
target_id: bin-script-reach-path
round: 1 (최초 리뷰)
tags: [review, plugin-path, bin-scripts, defect-fix, lint-gate]
related_files:
  - docs/roadmap/anthropic-docs-gap-proposal-2026-08-23.md
  - scripts/validate-agent-assets.mjs
  - malgn-agent/skills/common-output-storage-and-path-management/SKILL.md
---

# 리뷰 보고서 — 번들 `bin/` 스크립트 도달 경로 통일 (`fix/bin-script-reach-path`)

**대상**: `87f8405..HEAD` 3커밋(`c528441`, `d76762e`, `d990224`), 21파일 `+185 / −54`
**등급 판정**: Sensitive (전 직원 배포 제품의 `agents/`·`skills/`·`knowledge/`·`templates/` 다파일 개정) → **발산형 포함 풀패널**
**종합 판정: 🟡 Amber** — Critical 0. 방향은 옳고 실증 근거도 충분하나, **실행 지시의 "런타임 표면"(스크립트 `--help` 출력)이 통째로 빠졌고**, 정본 커맨드가 따옴표 없이 정의돼 공백 포함 경로에서 같은 실패로 되돌아간다. 병합 전 RV-001·RV-002 처리 권고.

---

## 0. 페르소나 패널 — 재사용/신규 판정

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 역할개념을 스크리닝했다. **신규 0건 / 재사용 5건.**

| # | 페르소나 | 유형 | 판정 | 사유 |
|---|---|---|---|---|
| 1 | `persona-script-skill-consistency-auditor.md` | 수렴 | **재사용** | 역할개념 "문서가 서술하는 약속 ↔ 코드 구현을 한 줄씩 대조"가 이번 라운드의 "문서 커맨드 ↔ 스크립트가 실제로 인쇄하는 usage 문자열" 대조와 동형 |
| 2 | `persona-semantic-force-preservation-auditor.md` | 수렴 | **재사용** | "치환 후에도 같은 뜻/같은 행동인가"가 이번의 31건 문자열 치환 검증과 정확히 동형 |
| 3 | `persona-enforcement-gap-auditor.md` | 수렴 | **재사용** | "원칙 문장이 게이트로 강제 가능한가 vs 서술에 그치는가"가 린터 스코프 한정·정본 규약 도달성 검증과 동형 |
| 4 | `persona-field-executability-officer.md` | 수렴 | **재사용** | "이 줄을 읽고 지금 당장 칠 수 있는 명령인가"가 이번 합격선과 동일. 외부 사실(공식문서)을 기억이 아니라 실측으로 확인하는 관심사도 그대로 적용 |
| 5 | `persona-dead-reference-scope-challenger.md` | 발산 | **재사용** | "탐지 조건을 *형태*로 잡은 것이 *목적* 기준과 어긋나지 않는가, 제외 조항의 단정을 실측으로 반증"이 린터의 `bin/`·`hooks/` 제외 조항과 "맨 명령어" 형태 기준에 그대로 적용 |

5개 모두 §5 참고파일이 직전 라운드 대상에 고정돼 있어 **역할개념 수준으로만** 적용했다(2026-08-10 RV-002 선례와 동일 처리). 각 파일 "적용 이력"에 이번 라운드 항목을 append했고 INDEX.md "최근 재사용" 열을 갱신했다.

**생략한 관점(정직 명시)**
- **화면 리뷰 없음** — 이번 변경분에 UI 산출물이 없다(문서 문자열 + 검사 스크립트). `docs/screenshots/` 캡처 미수행.
- **Windows 실측 없음** — RV-002의 백슬래시 경로 부분은 macOS에서 재현 불가라 **추정**으로 표기했다(공백 부분은 재현 완료).
- **헤드리스 세션에서 마켓플레이스 설치본의 에이전트 MD 치환을 직접 재현하지 않았다** — §1의 판정은 공식문서 원문 + 제안서 §3.1이 관측한 값이 이미 마켓플레이스 캐시 경로였다는 사실에 근거한 간접 실증이다.

---

## 1. PM 질문 1 — `${CLAUDE_PLUGIN_ROOT}` 치환 전제는 견고한가 → **견고하다 (판정: 🟢)**

PM의 우려는 "테스트가 `--plugin-dir` 로컬 사본이었으니 마켓플레이스 설치 경로에서도 성립하는지 모른다"였다. **성립한다고 볼 근거가 셋 있다.**

1. **공식문서 원문**(`https://code.claude.com/docs/en/plugins-reference`, 이번 리뷰에서 직접 재조회):
   > `| Skill and agent content | Anywhere the placeholder appears |`
   설치 방식(`--plugin-dir` vs 마켓플레이스)에 대한 한정어가 없다. 치환은 플러그인 컴포넌트 로딩의 성질이지 설치 경로의 성질이 아니다.
2. **제안서 §3.1이 이미 마켓플레이스 설치본에서 관측했다.** 치환 결과로 기록된 값이
   `/Users/hopegiver/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/1.7.1/bin/...` 이다 — 이건 `--plugin-dir` 로컬 사본이 아니라 **마켓플레이스 캐시 경로**다. 실측으로 캐시 디렉터리 실재 확인: `~/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/`에 13개 버전(`1.0.0`…`1.7.6`)이 공존한다. 즉 PM이 걱정한 검증 공백은 사실상 이미 메워져 있었다.
3. **저장소 자신이 같은 전제로 이미 돌고 있다.** `malgn-agent/hooks/hooks.json:8,18`이 `${CLAUDE_PLUGIN_ROOT}`로 SessionStart/Stop 훅을 걸고 있고, 이 훅은 마켓플레이스 설치본에서 동작 중이다(공식문서 표의 "Hook and monitor commands" 행).

**다만 이 검증 과정에서 §1-1 본문의 사실 오류 하나가 드러났다 → RV-003.**

---

## 2. 지적 사항

심각도: 🔴 Critical 0 / 🟠 Major 5 / 🟡 Minor 4 / ⚪ Nit 1 / 🔵 Rethink 2 / (범위 밖 결함 1)

| ID | 심각도 | 위치 | 문제 | 개선안 |
|---|---|---|---|---|
| RV-001 | 🟠 Major | `malgn-agent/bin/capture.mjs:53` 외 10개 스크립트 | 스크립트가 **런타임에 인쇄하는** usage 문자열이 여전히 §1-1이 금지한 맨 명령어 형태 | usage 문자열을 정본 형태로 바꾸거나, 최소한 정본 경로 안내 1줄 추가 |
| RV-002 | 🟠 Major | `skills/common-output-storage-and-path-management/SKILL.md:61` (+치환된 31곳 전부) | 정본 커맨드가 **따옴표 없음**. 공백 포함 경로에서 `MODULE_NOT_FOUND`로 회귀(재현 완료) | `node "${CLAUDE_PLUGIN_ROOT}/bin/<스크립트>.mjs"` 로 정본 변경 |
| RV-003 | 🟠 Major | 같은 파일 `:66` | "치환은 스킬·에이전트 본문**에서만** 일어난다"는 단정이 공식문서 표와 저장소 자신의 `hooks/hooks.json`에 의해 반증됨 | "훅/모니터 커맨드·MCP·LSP 설정에서도 치환된다. `knowledge/`·`templates/`·`bin/` 본문에서는 치환되지 않는다"로 정정 |
| RV-004 | 🟠 Major | 같은 파일 `:56-67` (자리 선택) | 정본 규약을 **21개 에이전트 중 1개(trainer)만 참조하는** 스킬에 두었고, 그 스킬 `description`에도 번들 스크립트 실행 얘기가 없다 | description에 1구 추가 + 실행 지시를 가장 많이 쓰는 `common-screen-verification-and-capture`에서 §1-1을 명시 참조 |
| RV-005 | 🟠 Major | `knowledge/quality/e2e-testing-guide.md:16,27` · `templates/e2e-template/README.md:27` · `bin/*.mjs` 헤더 | 치환되지 **않는** 파일에 치환용 토큰을 심고 각주로 무마 — 같은 커밋이 더 나은 패턴(커맨드 삭제 후 스킬 라우팅)을 이미 두 번 채택했는데 여기만 반대로 감 | `ux-design-guide.md:129`·`screenshot-capture-guide.md:3`에 적용한 패턴으로 통일 |
| RV-006 | 🟡 Minor | `bin/` 헤더 12개 중 개정된 것은 2개 | 개정 기준이 "린터가 잡느냐"였던 탓에 헤더 스타일이 두 갈래로 남음 | 12개 헤더 처리 방침을 하나로 정하고 일괄 적용 |
| RV-007 | 🟡 Minor | `SKILL.md:56-67` (누락 서술) | 치환값은 **버전 고정·ephemeral**인데(공식문서 명시) §1-1에 경고 없음. 제품은 실행 커맨드를 증거로 산출물에 남기라고 요구함 | "산출물에 남길 때는 버전 경로를 그대로 인용하지 말 것" 1줄 추가 |
| RV-008 | 🟡 Minor | `SKILL.md:58` | "**항상** 아래 **한 가지** 형태로만"이 과대 — 스캐폴딩된 외부 프로젝트의 `package.json`은 이 변수를 쓸 수 없고 실제로 다른 방식을 씀 | "malgn-agent 제품 본문 안에서는" 으로 범위 한정 + 예외 1줄 |
| RV-009 | 🟡 Minor | `scripts/validate-agent-assets.mjs:423-424` | 플레이스홀더 탐지가 `PLUGIN_WORD` **AND** `PATH_WORD` 동시 요구 → `<플러그인 루트>`, `<플러그인 디렉터리>`, `<plugin root>`, `<malgn-agent 설치 위치>` 전부 통과(실측) | `PATH_WORD`에 `루트\|root\|디렉터리\|디렉토리\|위치\|home` 추가, 또는 PLUGIN_WORD 단독 + 화이트리스트 |
| RV-010 | ⚪ Nit | `skills/project-orchestration/SKILL.md:49` | 한 괄호 안에서 `${CLAUDE_PLUGIN_ROOT}/bin/check-wbs-warnings.mjs`(치환됨, 장문)와 `bin/analyze-usage.mjs`(맨이름)가 병기 — 산문 가독성 저하 | 산문 주어는 맨이름으로 되돌리고 경로는 코드펜스에만 |
| RT-001 | 🔵 Rethink | 구조 전반 | "모든 실행 지시에 절대경로 토큰을 인라인" 구조 자체가 옳은가 | 아래 §5 |
| RT-002 | 🔵 Rethink | 경로 A vs C 선택 근거 | 경로 C(맨 명령어) 기각 근거가 §1-1에 "실행 비트 일부 누락" 하나만 남음 — 가장 약한 이유 | 아래 §5 |
| RV-OOS-001 | (범위 밖 결함) | `bin/new-project.mjs:181` | 스캐폴딩된 프로젝트의 `check-docs`가 실재하지 않는 레이아웃을 탐색 | 아래 §6 |

---

### RV-001 🟠 Major — 문서는 고쳤는데 스크립트가 인쇄하는 usage는 그대로다 (린터 사각지대)

**근거 (실측)**. `bin/capture.mjs`는 같은 파일 안에서 두 가지 상반된 커맨드를 말한다.

- 헤더 주석 `:14` (이번에 개정) — `node ${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs <url> ...`
- `printUsage()` `:53` (미개정) — `'사용법: capture.mjs <url> [output.png] [옵션...]'`

`:53`은 §1-1 `:67`이 명시적으로 금지한 형태이고(`capture.mjs`는 mode 644라 `permission denied`로 끝난다 — `ls -l bin/*.mjs` 실측: 12개 중 6개가 644, 이번 변경 전후 동일), **에이전트가 실제로 눈으로 보게 되는 표면은 주석이 아니라 `:53`이다**(`--help` 실행 시, 그리고 인자 오류 시).

같은 형태가 11개 스크립트에 있다:
`analyze-usage.mjs:65` · `calc-training-scorecard.mjs:141` · `capture.mjs:53` · `check-edge-api-security.mjs:46` · `check-output-conventions.mjs:62` · `check-wbs-warnings.mjs:76` · `diff-env-keys.mjs:53` · `install-usage-agent.mjs:40` · `new-project.mjs:56` · `pair-usage-device.mjs:34` · `report-usage.mjs:78`

**그리고 제품이 그 표면으로 직접 안내한다.** `skills/domain-training-scorecard-eval/SKILL.md:103`:
> 상세 입력 스키마·옵션은 `node ${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs --help` 또는 스크립트 상단 주석 참고.

이 지시를 따르면 에이전트는 정본 커맨드로 `--help`를 실행하고 → **`사용법: node calc-training-scorecard.mjs [--input FILE] ...`** 라는 금지된 형태를 되돌려 받는다. 라운드의 목표("실행 지시를 정본 한 갈래로 통일")가 여기서 깨진다.

**린터가 이걸 영구히 못 잡는다.** `scripts/validate-agent-assets.mjs:748`의 `isRoutingDoc`이 `.md`가 아니거나 `bin/`·`hooks/` 밑이면 맨 명령어 검사를 건너뛴다. 이 지적은 곧 PM 질문 3에 대한 답이기도 하다 → §3.

**개선안**: (a) 11개 usage 문자열을 `node <이 스크립트의 절대경로>` 안내가 포함된 형태로 바꾸거나, (b) 최소한 각 usage 끝에 "플러그인 안에서 부를 때는 Skill `common-output-storage-and-path-management` §1-1의 정본 커맨드를 쓴다" 1줄을 붙인다. 어느 쪽이든 **`process.argv[1]`을 그대로 찍는 방법이 가장 정확하다** — 실행 중인 파일의 절대경로라 추측도 치환도 필요 없고, 오히려 §1-1이 요구하는 "완성된 명령"을 런타임이 스스로 만들어 준다.

---

### RV-002 🟠 Major — 정본 커맨드에 따옴표가 없다 (공백 포함 경로에서 같은 실패로 회귀)

**공식문서 원문**(`plugins-reference`, 이번 리뷰에서 재조회):
> "In shell-form hooks and monitor commands, wrap the variables in double quotes, as in `"${CLAUDE_PROJECT_DIR}/scripts/server.sh"`."

**저장소 자신은 이미 따옴표를 쓴다** — `malgn-agent/hooks/hooks.json:8,18`:
```
"command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/sessionstart-context.mjs\""
```

그런데 §1-1 `:61`이 세운 정본은 따옴표가 없다:
```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/<스크립트>.mjs [인자...]
```
그리고 이번에 치환된 31곳 전부가 무따옴표다.

**재현 (이번 리뷰에서 직접 실행)**. 치환은 모델에 도달하기 전에 끝나므로 셸이 보는 것은 *리터럴 문자열*이다. 따라서 셸 종류와 무관하게 단어분리가 일어난다:
```
$ sh -c 'node /.../scratchpad/space dir/bin/t.mjs'
node:internal/modules/cjs/loader:1433
  throw err;            ← MODULE_NOT_FOUND

$ sh -c 'node "/.../scratchpad/space dir/bin/t.mjs"'
OK
```
즉 홈 디렉터리 경로에 공백이 있는 직원(예: macOS 사용자명 `Gil Dong`, Windows `C:\Users\Gil Dong\`)에게는 **이번 수정 후에도 제안서 §3.1이 재현한 그 `MODULE_NOT_FOUND`가 그대로 난다.** 고치는 비용은 따옴표 두 개다.

**추가(추정 — Windows 미검증)**: Windows에서 치환값은 백슬래시 구분자(`C:\Users\...\bin`)일 가능성이 높고, 그 경우 POSIX 셸에서는 백슬래시가 이스케이프로 해석돼 공백이 없어도 깨진다. 이 저장소는 "Windows/macOS 동일 실행"을 표방하므로(`CLAUDE.md` Architecture `bin/` 항목) 확인이 필요하다. **확인 못 했으므로 추정으로 표기한다.**

**린터 영향 없음(확인함)**: 따옴표를 붙여도 `BARE_SCRIPT_COMMAND` 두 규칙(`validate-agent-assets.mjs:451,459`)은 모두 `CLAUDE_PLUGIN_ROOT` 포함 여부로 스킵하므로 새 오탐이 생기지 않는다.

---

### RV-003 🟠 Major — §1-1의 "스킬·에이전트 본문에서만 치환된다"는 사실 오류다

`skills/common-output-storage-and-path-management/SKILL.md:66`:
> **치환은 스킬·에이전트 본문에서만 일어난다**(같은 실측).

**반증 1 — 공식문서 표**(재조회한 원문):
```
| Skill and agent content         | Anywhere the placeholder appears |
| Hook and monitor commands       | Anywhere the placeholder appears |
| MCP stdio servers               | command, args, env               |
| MCP http/sse/ws servers         | url, headers, headersHelper      |
| LSP servers                     | command, args, env, workspaceFolder |
```
5개 컨텍스트 중 2개만 적고 "만"이라고 단정했다.

**반증 2 — 저장소 자신**: `malgn-agent/hooks/hooks.json:8,18`이 hook command에서 이 변수를 쓰고 있고 실제로 동작한다. `.claude-plugin/plugin.json`의 MCP 설정도 같은 범주다.

**왜 Major인가.** 이 문장이 정본 규약 안에 있고, 이 규약을 참조하는 유일한 에이전트가 하필 **trainer**(= 제품 본문 편집 전담)다. 다음 라운드의 trainer가 "§1-1대로 정합화"하면서 `hooks.json`의 `${CLAUDE_PLUGIN_ROOT}`를 "여긴 치환 안 되는 자리"로 오판해 손대면 **전 직원의 SessionStart/Stop 훅이 죽는다.** 지금 깨져 있는 것은 아니므로 Critical은 아니지만, 잘못된 단정이 편집 권한자에게 직접 꽂혀 있다.

**개선안**: `:66`을 "치환되는 자리: 스킬·에이전트 본문, 훅/모니터 커맨드, MCP·LSP 서버 설정. 치환되지 않는 자리: `knowledge/`·`templates/`·`bin/` 파일 본문(Read로 열면 문자 그대로다)" 로 정정. 같은 오류가 `bin/capture.mjs:15`, `bin/new-project.mjs`, `hooks/doc-drift.mjs:25`, `skills/project-standards/scripts/check-pm-orchestration-block.mjs:14`, `knowledge/quality/e2e-testing-guide.md:18`, `templates/e2e-template/README.md:30`에 복제돼 있다(6곳).

---

### RV-004 🟠 Major — 정본 규약이 실질적으로 도달 불가능한 자리에 있다

PM 질문 4에 대한 답이다. **실측**:

```
$ for f in agents/*.md; do grep -q "common-output-storage-and-path-management" $f || echo $f; done
→ 21개 중 20개가 미참조. 참조하는 것은 agents/trainer.md:119 하나뿐.
```
비교(같은 방식으로 센 `common-*` 스킬별 참조 에이전트 수):
`common-token-efficient-collaboration` 19 · `common-task-grading-and-verification-depth` 8 · `common-screen-verification-and-capture` 6 · `common-permission-policy-compliance` 6 · `common-verifiable-output-and-honesty` 5 · `common-learning-loop-knowledge-management` 5 · `common-beyond-mediocre-output` 3 · `common-product-principles-reference` 1 · **`common-output-storage-and-path-management` 1**

게다가 **스킬 discovery의 1단계 표면(description)에 번들 스크립트 실행 얘기가 없다** — `SKILL.md:3`:
> `description: 전 에이전트 인프라 규칙 — 산출물 추적성 확보, 경로 명시·저장 위계로 회수 불가 손실 방지. 파일 저장 위치·경로 관리 시 사용.`

공식문서(`/docs/en/skills`)상 description은 skill listing에 노출되는 유일한 메타데이터다. "번들 스크립트를 어떻게 실행하지?"라는 질문으로는 이 스킬이 후보에 오르지 않는다. 그리고 이번에 새로 심은 각주 3곳(`knowledge/quality/e2e-testing-guide.md:18` 등)은 독자를 여기로 보내는데, 정작 그 문을 여는 열쇠가 없다.

**완화 요인(정직 기록)**: §1-1을 읽지 못해도 대부분의 경우는 동작한다 — 각 실행 지시가 이미 정본 형태로 적혀 있고 치환되어 도착하므로, 에이전트는 규약을 몰라도 그 줄을 복사하면 된다. §1-1이 실제로 필요한 순간은 ① 새 실행 지시를 **쓸 때**(= trainer, 참조하고 있음) ② 실행이 실패해 원인을 찾을 때 ③ 치환 안 되는 문서를 읽고 헤맬 때다. ②③이 남는다.

**개선안(저비용)**: (a) description 끝에 "플러그인 번들 `bin/` 스크립트 실행 커맨드 규약 포함" 추가 — 1줄, 상시비용 증가 없음. (b) `common-screen-verification-and-capture`(참조 에이전트 6개, 실행 지시가 가장 많은 스킬)의 도구 섹션에서 §1-1을 1줄 참조. 근거: 이 두 조치는 참조 유틸/패턴이 이미 존재하는 자리에 문장만 얹는 것이라 **저비용으로 판단했다(스킬 파일 2개 열어 확인)**.

---

### RV-005 🟠 Major — 치환 안 되는 파일에 치환 토큰을 심은 처리 (같은 커밋 안에 더 나은 패턴이 이미 있다)

PM 질문 2에 대한 답이다. 이번 라운드는 "치환되지 않는 자리"를 **두 가지 상반된 방식**으로 처리했다.

**패턴 X (권장 — 이번 커밋에서 2곳 채택)**: 커맨드를 아예 지우고 소유 스킬로 라우팅.
- `knowledge/design/ux-design-guide.md:129` — "실행 커맨드 정본(플러그인 절대경로가 채워진 형태)과 플래그…는 Skill `common-screen-verification-and-capture` 참조 — **이 문서에 커맨드를 다시 싣지 않는다(경로가 두 벌이 되면 어긋난다)**"
- `knowledge/review/screenshot-capture-guide.md:3` — 동일 처리.

**패턴 Y (문제 — 4곳 채택)**: 치환 안 되는 파일에 토큰을 남기고 "이건 여기선 안 풀린다"는 각주를 붙임.
- `knowledge/quality/e2e-testing-guide.md:16,27` (+`:18` 각주 1줄)
- `templates/e2e-template/README.md:27` (+`:30-32` 각주 3줄)
- `bin/capture.mjs:14-16` (+예시 6줄 전부 토큰화)
- `bin/new-project.mjs`, `hooks/doc-drift.mjs:24-25`, `skills/project-standards/scripts/check-pm-orchestration-block.mjs:13-15`

**패턴 Y가 이전보다 나쁜 이유**:
1. 이전 `<malgn-agent 플러그인 경로>`는 **읽는 순간 "네가 채워야 한다"가 자명**했다(꺾쇠 = 채움 자리). 새 `${CLAUDE_PLUGIN_ROOT}`는 **완성된 커맨드처럼 보인다** — 다른 곳(스킬 본문)에서는 실제로 완성된 커맨드이기 때문에 더 헷갈린다. 각주를 읽어야만 아닌 줄 안다.
2. `templates/e2e-template/README.md`는 **사용자 프로젝트로 복사될 수 있는 파일**이다. 거기서 이 토큰은 영원히 의미가 없다.
3. `bin/capture.mjs`는 한 파일 안에서 토큰을 7번 반복하고, 그 7번이 전부 "복사하지 마라"는 예시다. 그리고 12줄 아래 `:53`에는 복사 가능해 *보이지만* 실패하는 다른 형태가 있다(RV-001).
4. `templates/e2e-template/README.md:30-32`의 각주는 독자를 **화면 캡처 스킬**로 보낸다 — e2e 인증 스캐폴드 복사법을 찾으려고 캡처 스킬을 열어야 한다. 그 스킬(`common-screen-verification-and-capture:45`)에 실제로 경로가 있긴 하나, 라우팅이 부자연스럽다.

**개선안**: 패턴 X로 통일한다. 치환 안 되는 파일에서는 **경로를 아예 쓰지 않고** 플러그인 상대 이름(`templates/e2e-template/auth.setup.js`)만 적은 뒤 "실행 커맨드 정본은 Skill X"로 보낸다. 각주 3~4줄이 통째로 사라져 조건부 토큰도 줄고, 오해 가능성도 0이 된다. **이미 같은 커밋이 두 번 그렇게 했다는 것이 이 개선안의 최선 근거다.**

---

### RV-006 🟡 Minor — `bin/` 헤더 처리 기준이 "린터가 잡느냐"였다

`bin/*.mjs` 12개 중 헤더가 개정된 것은 `capture.mjs`, `new-project.mjs` 둘뿐이다(+`hooks/doc-drift.mjs`, `skills/project-standards/scripts/check-pm-orchestration-block.mjs`). 나머지 9개 헤더는 `node analyze-usage.mjs [--days N]`(`analyze-usage.mjs:12`) 같은 맨 명령어 그대로다.

**왜 갈렸나(실측)**: 개정된 파일들은 `<malgn-agent 플러그인 경로>` 플레이스홀더를 갖고 있었고 → `PLUGIN_PATH_PLACEHOLDER`가 잡는다. 나머지 9개는 맨 명령어라 → `bin/` 제외 조항 때문에 안 잡힌다. 즉 **문서 품질 판단이 아니라 린터 커버리지가 개정 범위를 정했다.** 결과적으로 `bin/` 헤더에 두 스타일이 공존한다.

RV-005의 개선안(패턴 X)을 채택하면 자연히 해소된다 — 헤더에서 경로를 빼고 플래그 설명만 남기면 12개가 같아진다.

---

### RV-007 🟡 Minor — 치환값이 버전 고정·ephemeral인데 경고가 없다

공식문서 원문:
> "`${CLAUDE_PLUGIN_ROOT}` changes when the plugin updates. The previous version's directory remains on disk for a grace period after an update, but treat it as ephemeral and don't write state there."

실측으로 캐시에 13개 버전이 공존한다. §1-1은 "그 줄을 그대로 복사해 실행한다"까지만 말하고, **그 경로가 산출물에 박히면 안 된다**는 말은 없다. 그런데 제품은 실행 커맨드를 증거로 남기라고 요구한다 — `skills/domain-pre-deployment-verification-gate/SKILL.md:31`:
> `3. .env: `node ${CLAUDE_PLUGIN_ROOT}/bin/diff-env-keys.mjs` 실행, exit 0 — …`

이 예시 자체는 토큰 형태라 안전하지만, 실제 게이트 통과 보고에는 **치환된 버전 경로**(`.../1.7.1/bin/diff-env-keys.mjs`)가 그대로 적히게 된다. 몇 달 뒤 그 문서를 근거로 재실행하면 사라진 디렉터리를 가리킨다.

**개선안**: §1-1에 1줄 — "치환값은 버전 고정 경로다. 산출물·기록에 남길 때는 절대경로가 아니라 `bin/<스크립트>.mjs` 이름으로 적는다."

---

### RV-008 🟡 Minor — "항상 한 가지 형태로만"이 과대하다 (실재하는 예외가 있다)

§1-1 `:58`은 예외를 두지 않는다. 그런데 **스캐폴딩된 프로젝트는 이 변수를 쓸 수 없다** — 그 프로젝트는 플러그인 컴포넌트가 아니므로 치환이 일어나지 않는다. 그래서 `bin/new-project.mjs:181`이 만드는 `package.json`의 `check-docs`는 마켓플레이스 디렉터리를 직접 스캔하는 **네 번째 도달 방식**을 쓴다(그리고 `JSON.stringify(found)`로 **따옴표까지 제대로 두른다** — RV-002와 대비된다).

이 방식은 옳지만 §1-1 어디에도 예외로 적혀 있지 않아, 다음 라운드가 "정본 위반"으로 오판해 고칠 수 있다.

**개선안**: `:58`을 "malgn-agent 제품 본문(스킬·에이전트·knowledge·템플릿) 안에서는 항상 …" 으로 한정하고, "스캐폴딩되어 외부 프로젝트로 나가는 코드는 예외 — 런타임 경로 탐색을 쓴다(`bin/new-project.mjs`의 `check-docs` 참조)" 1줄 추가.

---

### RV-009 🟡 Minor — 플레이스홀더 탐지가 두 단어 동시 매치를 요구해 구멍이 남는다

`scripts/validate-agent-assets.mjs:423-424`:
```js
const PLUGIN_WORD = /malgn-agent|플러그인|plugin/i;
const PATH_WORD = /경로|path|dir/i;
```
`:436`에서 **AND** 조건이다. 실측(리뷰에서 직접 실행):
```
CAUGHT  <malgn-agent 플러그인 경로>     CAUGHT  <이 플러그인 경로>
MISSED  <플러그인 루트>                  MISSED  <플러그인 디렉터리>
MISSED  <plugin root>                   MISSED  <malgn-agent 설치 위치>
MISSED  <malgn-agent 홈>
```
지금 남아 있는 31건은 전부 앞의 두 형태였으므로 **현재 잔존 0건은 맞다**(PM 독립 검증과 일치). 문제는 **재유입 방향**이다 — R5의 목적이 "다음 스크립트 추가 때 재발 방지"인데, 다음 저자가 `<플러그인 루트>`라고 쓰면 게이트를 그냥 통과한다. 발산형 페르소나의 관심사("탐지 조건을 형태로 잡은 것과 목적 기준의 간극")에 정확히 걸린다.

**개선안**: `PATH_WORD`에 `루트|root|디렉터리|디렉토리|위치|home|폴더` 추가. 오탐 위험은 낮다 — PLUGIN_WORD와의 AND가 유지되므로 "플러그인"이라는 단어가 꺾쇠 안에 들어간 경우로 여전히 좁혀진다.

---

### RV-010 ⚪ Nit — 한 문장 안에 두 표기가 섞였다

`skills/project-orchestration/SKILL.md:49`:
> … `${CLAUDE_PLUGIN_ROOT}/bin/check-wbs-warnings.mjs`(의존성 없는 Node 내장 모듈만 사용, `bin/analyze-usage.mjs`와 동일 스타일)가 이 판정을 대신한다

같은 괄호 안에서 앞은 치환되어 80자 넘는 절대경로가 되고, 뒤는 `bin/analyze-usage.mjs` 맨이름 그대로다. 이 자리는 커맨드가 아니라 **문장의 주어**(단순 지칭)라 §1-1 대상이 아니다. 바로 아래 `:53,:57` 코드펜스에 정본 커맨드가 이미 있다.

**개선안**: `:49`의 주어를 `bin/check-wbs-warnings.mjs`로 되돌린다. 같은 성격이 `skills/usage-agent-healthcheck/SKILL.md:16`(`## 대상 파일 (모두 `${CLAUDE_PLUGIN_ROOT}/bin/`)`) — 섹션 제목에 절대경로가 박히는 자리라 재검토 대상.

---

## 3. PM 질문 3 — 린터 맨 명령어 검사의 스코프 한정은 옳은가 → **부분적으로 옳다 (🟡)**

**옳은 부분**: 오탐 억제 설계 자체는 타당하다. 실행 지시 판정을 "`node` 직후" 또는 "플래그 동반" 두 자리로만 좁힌 것(`:451,:459`), 그리고 그 이유를 코드 주석에 남긴 것(`:436-446`)은 좋은 판단이다. 실제로 이 좁힘 덕분에 `agents/reviewer.md:14`, `agents/visual-designer.md:16,17`, `knowledge/quality/e2e-testing-guide.md:5` 같은 **순수 지칭 수십 곳이 건드려지지 않았다** — 제안서 §3.1이 "경로 C 맨 명령어 33곳"으로 셌던 것을 실제 실행 지시만으로 좁힌 판단은 정확하다.

**틀린 부분**: `bin/`·`hooks/` 제외의 **근거**가 사실과 다르다. 코드 주석 `:443-446`은 이렇게 쓴다:
> 스크립트 자신의 헤더 주석과 `--help` 출력은 그 스크립트의 CLI 인터페이스 문서다 — 셸에서 읽히는 자리라 `${CLAUDE_PLUGIN_ROOT}`가 애초에 해소되지 않는다. 여기까지 규칙을 밀면 오탐 43건이 실탐 8건을 덮는다.

**반증(실측)**: 제외 구역을 대상으로 같은 규칙을 돌려 30개 라인 히트를 재현했다(트레이너의 43은 라인당 중복 매치 포함 수로 보인다). 그런데 **그 30건은 오탐이 아니다.** 30건 전부가 헤더 주석(19) 또는 `printUsage()` 문자열(11)이고, `printUsage()` 11건은 **에이전트가 런타임에 실제로 읽고 따라 하는 지시**다(RV-001). "CLI 인터페이스 문서니까 괜찮다"는 단정은, 그 인터페이스 문서가 곧 에이전트의 다음 행동을 결정한다는 사실을 놓친다.

**즉 제외 조항은 "오탐이 많아서"가 아니라 "실탐을 오탐으로 분류해서" 성립하고 있다.** 발산형 페르소나가 제외 조항의 단정을 실측으로 반증한 결과다(2026-08-22 `13bcd60` 선례와 같은 구조 — 제외 항목은 도장을 받고 아무도 다시 안 본다).

**권고**: 제외를 없애자는 게 아니다. 두 가지 중 하나.
- (a) `printUsage()` 11건을 먼저 고치고(RV-001), 그 다음 제외 범위를 **헤더 주석에만** 좁힌다(문자열 리터럴은 검사).
- (b) 제외를 유지하되, 코드 주석의 근거를 정직하게 바꾼다 — "이 구역의 히트는 오탐이 아니라 **미처리 실탐**이다. RV-001 처리 전까지 게이트를 통과시키기 위한 임시 제외이며, 백로그 항목이 있다." 근거를 잘못 적어두면 다음 세션이 "여긴 봐도 될 게 없다"로 읽는다.

---

## 4. PM 질문 5 — 누락 / 불필요한 경로 부착

**전수 확인 방법**: `grep -rn --include='*.md' -E '\.mjs' agents skills knowledge templates | grep -v CLAUDE_PLUGIN_ROOT` 로 잔존 언급 전건을 열거하고 하나씩 "실행 지시인가 지칭인가"를 분류했다.

**누락 (실행 지시인데 안 바뀐 자리)**
1. **`printUsage()` 11건** — RV-001. 유일하고 가장 큰 누락이다.
2. `.md` 잔존분은 **전부 지칭으로 판정, 누락 아님**. 대표 예: `agents/reviewer.md:14`(Bash 권한 사유), `agents/frontend-dev.md:15,115`(도구 소개), `skills/common-screen-verification-and-capture/SKILL.md:13,156`(섹션 제목·비교표), `skills/usage-agent-healthcheck/SKILL.md:20-23`(역할 표), `knowledge/architecture/usage-collection-agent-architecture.md`(아키텍처 서술). 이들에 경로를 붙였다면 오히려 RV-010류 악화였을 것이다 — **건드리지 않은 판단이 옳다.**
3. `hooks/*.md`(`pm-orchestration-block.md`)에는 스크립트 실행 지시가 없음을 확인(`grep '\.mjs\|\.cjs' hooks/*.md` → 0건). 제외 조항으로 인한 실제 누락 없음.

**불필요하게 경로가 붙어 나빠진 자리** — RV-010(2곳), RV-005(4곳).

**재유입 확인(항구 규칙)**: 추가 라인 전량을 백틱 앵커 **없이** 검사했다.
```
git diff 87f8405..HEAD | grep '^+' | grep -noE '\b[0-9a-f]{8}\b|\b01[0-9a-hjkmnp-tv-z]{24}\b'   → 0건
git diff 87f8405..HEAD | grep '^+' | grep -nE 'commit `[0-9a-f]{7,12}`|memory `[^`]+`'          → 0건
```
**조회 불가 식별자 재유입 0건.** 신설 코드 주석(`validate-agent-assets.mjs:405-421`)도 날짜·경위만 쓰고 id를 달지 않았다 — 규칙을 정확히 지켰다.

---

## 5. 발산형 관점 (🔵 Rethink)

### RT-001 — "모든 실행 지시에 절대경로 토큰을 인라인" 구조 자체가 최선인가

**현재 구조**: 실행 지시가 나오는 모든 자리(11개 파일, 31곳)에 `${CLAUDE_PLUGIN_ROOT}/bin/...`을 인라인한다. 치환 안 되는 파일에도 넣고 각주로 무마한다(RV-005).

**무엇이 어긋났나(실측)**: 같은 커밋이 두 곳(`ux-design-guide.md:129`, `screenshot-capture-guide.md:3`)에서 **정반대 원칙**을 스스로 선언했다 — *"이 문서에 커맨드를 다시 싣지 않는다(경로가 두 벌이 되면 어긋난다)."* 이 원칙이 옳다면 나머지 자리에도 적용돼야 하는데, 적용 범위가 임의적이다. 그리고 인라인 방식은 `printUsage()`라는 **런타임 표면을 원천적으로 커버하지 못한다**(RV-001) — 문서만 고치는 접근의 구조적 한계다.

**대안 구조 — "커맨드 단일 소유(one owner per script)"**:
- 각 번들 스크립트마다 **커맨드를 소유하는 스킬을 하나만 정한다**(capture → `common-screen-verification-and-capture`, diff-env-keys → `domain-pre-deployment-verification-gate`, …). 정본 커맨드는 그 스킬에만 존재한다.
- 나머지 모든 자리는 **이름만 지칭 + 소유 스킬로 라우팅**. 경로를 두 벌 만들지 않는다.
- 스크립트 자신은 `process.argv[1]`로 자기 절대경로를 알고 있으므로, `printUsage()`가 **실행 시점에 정확한 커맨드를 스스로 인쇄**한다. 문서 동기화가 필요 없어진다.
- 린터 규칙은 "소유 스킬 밖에서 커맨드 형태가 나오면 ERROR"로 바뀌어, 지금처럼 형태를 열거해 쫓지 않아도 된다.

**비용 라벨**: **중간** — 근거를 명시한다. (a) `process.argv[1]` 기반 usage는 각 스크립트 3~5줄 수정 × 11개, 기존 유틸 없음(실제로 `bin/` 전 파일을 훑어 공용 usage 헬퍼가 없음을 확인했다). (b) 소유 스킬 지정표는 신규 문서 없이 §1-1에 표 하나로 들어간다. (c) 라우팅 문장 치환은 이번 라운드와 같은 규모. **(a)를 확인했으므로 이 라벨은 추정치가 아니다.**

**분류**: 개선(변경 동결 대상 → 백로그). 단, 그 안의 `printUsage()` 수정(RV-001)만은 **결함 수정**이므로 지금 처리 가능하다.

### RT-002 — 경로 A를 택한 것은 옳으나, 기각 근거가 가장 약한 것만 남았다

**현재**: §1-1 `:67`은 맨 명령어(경로 C)를 금지하며 이유를 하나만 댄다 — *"번들 스크립트 일부에 실행 비트가 없어 `permission denied`로 끝난다."*

**무엇이 어긋났나**: 이 이유는 `chmod +x` 6번이면 소멸한다(실측: 지금도 `calc-training-scorecard.mjs`·`install-usage-agent.mjs` 등 6개는 이미 +x라 맨 명령어가 동작할 수 있다). 그리고 공식문서는 정반대로 말한다 — *"Files here are invokable as bare commands in any Bash tool call while the plugin is enabled."* 즉 §1-1은 **공식 설계와 반대되는 규칙을 세우면서, 그 근거로 고치면 사라질 사고 하나만 제시한다.** 다음 세션이 "그럼 chmod 하고 맨 명령어 쓰자"로 되돌리기 쉽다.

**실제로 경로 A가 옳은 진짜 이유들**(제안서 §4가 미검증으로 남긴 것들 — 정본에 옮겨야 한다):
1. 실행 비트가 **git과 마켓플레이스 설치 파이프라인을 통과해 보존되는지 미검증**이다.
2. **Windows에는 실행 비트 개념이 없다.** 제품은 "Windows/macOS 동일 실행"을 표방한다.
3. PATH 등재는 "플러그인이 enabled인 동안"이라는 조건부다.
4. 경로 A는 **이미 마켓플레이스 설치본에서 실증됐다**(§1).

**대안**: §1-1 `:67`의 근거를 위 4개로 교체한다(1~2줄). 비용 거의 0, 규칙의 수명이 크게 늘어난다. **분류: 결함(사실 근거 부실) — 지금 처리 권고.**

---

## 6. 범위 밖에서 발견한 결함 (별건 보고)

### RV-OOS-001 — 스캐폴딩된 프로젝트의 `check-docs`가 실재하지 않는 경로를 찾는다

이번 diff가 건드린 파일은 아니지만, **이 라운드가 통일하겠다고 선언한 "번들 스크립트 도달 경로"의 네 번째 갈래**이고 **깨져 있다.**

`bin/new-project.mjs:181`이 생성하는 `package.json`의 `check-docs`:
```js
const c = path.join(mp, d, 'plugins', 'malgn-agent', 'hooks', 'doc-drift.mjs');
```
**실측한 실제 레이아웃에는 `plugins/` 세그먼트가 없다**:
```
$ ls ~/.claude/plugins/marketplaces/malgnsoft-plugins/
CLAUDE.md  docs  malgn-agent  package.json  scripts        ← malgn-agent가 바로 아래
$ [ -f ~/.claude/plugins/marketplaces/malgnsoft-plugins/plugins/malgn-agent/hooks/doc-drift.mjs ] → MISSING
$ ls   ~/.claude/plugins/marketplaces/malgnsoft-plugins/malgn-agent/hooks/doc-drift.mjs          → EXISTS
```
따라서 스캐폴딩된 프로젝트에서 `pnpm run check-docs`는 레거시 폴백(`~/.claude/hooks/doc-drift.mjs`)으로 떨어진다. 이 개발자 PC에는 그 레거시 파일이 우연히 남아 있어 동작하지만, **새로 설치한 직원 PC에는 없으므로 "doc-drift.mjs를 찾지 못했…"만 출력된다.**

**추가로, 저장소가 스스로 주장하는 단일 소스가 깨져 있다.** `skills/project-standards/SKILL.md:125`:
> 경로 계산 로직(`findMalgnAgentBlockPath()`…)은 `hooks/lib/find-pm-block-path.mjs`가 단일 소스다 — 이 스크립트와 `new-project.mjs`, `hooks/doc-drift.mjs`가 완전히 동일한 알고리즘을 공유해야 드리프트…

그런데 `hooks/lib/find-pm-block-path.mjs:70`은 **올바른** 레이아웃을 쓴다:
```js
const candidate = join(marketplacesDir, alias, 'malgn-agent', 'hooks', 'pm-orchestration-block.md')
```
`new-project.mjs:181`의 인라인 사본만 `plugins/`를 끼워 넣었다. 즉 단일 소스를 공유하지 않은 인라인 복제가 드리프트를 만들었고, 정확히 SKILL.md가 경고한 사고가 이미 일어나 있다.

**권고**: 별도 결함 티켓. 변경 동결 하에서도 **결함 수정 범위**이며, 수정은 1줄(`'plugins',` 제거)이다. 다만 `agents/`·`skills/` 밖이 아니라 `bin/` 안이므로 편집 권한 경계상 **trainer 위임 대상**이다.

---

## 7. 트레이드오프

| 쟁점 | 페르소나 A | 페르소나 B | 권고 |
|---|---|---|---|
| 치환 안 되는 파일의 토큰 표기 | **현장 실행가능성 검사관**: 토큰을 쓰면 "완성된 커맨드"로 오인돼 헛턴이 는다 → 지우고 스킬로 보내라 | **의미강도 보존 감사관**: 경로를 아예 지우면 "어디에 있는 파일인지" 정보가 소실돼 독자가 파일을 못 찾는다 | **플러그인 상대 경로(`templates/e2e-template/auth.setup.js`)는 남기고 절대경로 토큰만 뺀다.** 위치 정보는 보존되고 오인은 사라진다 |
| 린터 `bin/`·`hooks/` 제외 | **강제력 격차 감사관**: 제외하면 11개 실탐이 영구 사각 → 검사하라 | **죽은 참조 스코프 도전자**: 지금 상태로 검사를 켜면 30건 ERROR로 게이트가 빨개져 통째로 무시당한다(오탐이 실탐을 덮는 실패 모드는 실재한다) | **순서를 정한다** — RV-001로 `printUsage()` 11건을 먼저 고치고, 그 다음 문자열 리터럴만 검사 대상에 편입. 그 전까지는 코드 주석의 근거를 정직하게 고쳐 둔다(§3 권고 b) |
| 따옴표 추가(RV-002) | **현장 실행가능성 검사관**: 공백 경로에서 재현되는 실패다, 지금 고쳐라 | **의미강도 보존 감사관**: 31곳 재치환은 방금 한 치환을 또 하는 것이라 새 실수 유입 위험 | **고친다.** 기계적 치환이고 린터가 양성 대조군으로 검증 가능하다. 다만 편집은 trainer 위임(`agents/`·`skills/`·`knowledge/` 경계) |

---

## 8. 잘 된 점 (다음 산출물의 기준선)

1. **결함/개선 분류가 정확했다.** 제안서 §2에서 후보 2·3·5·6·8을 "개선 → 백로그"로 명시적으로 밀어내고 실증 재현 로그가 있는 1번만 골랐다. 변경 동결 원칙을 정면으로 지켰다.
2. **상시 비용 증가가 실질 0.** 에이전트 MD 본문 변경은 `frontend-dev.md:82`·`ux-designer.md:23` 두 줄, 합계 +30바이트 수준. 나머지는 전부 조건부 로드(스킬 본문·knowledge·코드 주석). "1순위 성능, 2순위 토큰" 원칙에 부합한다.
3. **린터가 검사 대상 스크립트 이름을 파일시스템에서 수집한다**(`validate-agent-assets.mjs:722-733`). 하드코딩했다면 새 스크립트가 검사망 밖에 남았을 것이고, 주석에 그 이유까지 적혀 있다.
4. **플레이스홀더 검사가 코드펜스를 벗기지 않는다**(`:433` 주석: "사용 예시가 바로 그 자리다"). 31건 중 다수가 코드펜스 안이었으므로 `stripFencedCode`를 썼다면 대부분 놓쳤다. 정확한 판단이다.
5. **오탐 억제의 경계와 그 이유를 코드 주석에 남겼다**(`:436-446`). 근거 내용에는 이견이 있으나(§3), 판단의 이유를 코드에 남기는 습관 자체는 다음 세션을 살린다.
6. **옛 사실 오류를 정정했다.** `bin/new-project.mjs`의 "(참고: `bin/` 은 PATH에 자동 등록되지 않는다)" → 공식문서와 실측 PATH에 맞게 "등재되긴 하지만 실행 비트가 없어 실패한다"로 교체. 지시받지 않은 사실 오류를 발견해 고친 것이다.
7. **순수 지칭을 건드리지 않았다.** 제안서가 "맨 명령어 33곳"으로 셌던 것을 실제 실행 지시만으로 좁혀, `agents/reviewer.md:14` 등 수십 곳의 산문을 절대경로로 오염시키지 않았다.
8. **경로 두 벌 방지 원칙을 스스로 발견해 적용했다**(`ux-design-guide.md:129`, `screenshot-capture-guide.md:3`). 이번 라운드 최선의 패턴이며 RT-001 대안의 씨앗이다.
9. **R6(비범위) 준수**: 스크립트 코드 0줄 변경, 실행 비트 0건 변경(실측 `ls -l bin/*.mjs` — 644 6개/755 6개, 변경 전과 동일). 신규 스킬·훅 0건.
10. **조회 불가 식별자 재유입 0건** — 신설 코드 주석까지 포함해 규칙을 지켰다(§4).

---

## 9. PM 권고

**병합 전 처리 (결함, 변경 동결 하에서도 허용 범위)**
1. **RV-002** — 정본 커맨드에 따옴표 추가(§1-1 + 치환된 31곳). 재현된 실패이고 비용은 문자 2개.
2. **RV-003** — §1-1 `:66`의 "스킬·에이전트 본문에서만" 정정 + 복제된 6곳. 사실 오류이며, 편집 권한자(trainer)에게 직접 꽂혀 있어 방치 시 훅 파손 위험.
3. **RT-002** — §1-1 `:67`의 맨 명령어 기각 근거를 4개(실행비트 보존 미검증 / Windows에 실행비트 없음 / PATH는 enabled 조건부 / 경로 A는 실증됨)로 교체. 1~2줄.

**병합 후 즉시 (결함, 별도 라운드)**
4. **RV-001** — `printUsage()` 11건. `process.argv[1]` 사용 권고. 이후 §3 권고 (a)로 린터 제외를 좁힌다.
5. **RV-OOS-001** — `bin/new-project.mjs:181`의 `'plugins',` 제거. 1줄, 그러나 trainer 위임 대상.

**저비용 개선 (같이 처리해도 무방)**
6. RV-004(description 1구 + 스킬 1줄 참조) · RV-007(§1-1 1줄) · RV-008(§1-1 범위 한정 1줄) · RV-009(정규식 1줄).

**백로그 (변경 동결 — PM 판단 대기)**
7. **RT-001 커맨드 단일 소유 구조** · RV-005 패턴 통일 · RV-006 헤더 12개 일괄 · RV-010 표기 정리.

**모두 `agents/`·`skills/`·`knowledge/`·`templates/`·`bin/` 아래 편집이므로 trainer 위임 대상이다** — 리뷰 지적의 반영을 PM이 직접 하지 않는다는 저장소 규칙(`CLAUDE.md` 편집 권한 경계)에 해당한다. `scripts/validate-agent-assets.mjs`(RV-009)만 PM 직접 편집 허용 영역이다.

---

## 10. 이번 리뷰에서 실행한 것 / 실행하지 않은 것 (정직 보고)

**실행함(읽기·검사만)**: 공식문서 1건 재조회(WebFetch), `git diff`·`grep`·`ls -l` 실측, 린터 규칙을 제외 구역에 적용하는 **읽기 전용 프로브 스크립트**를 scratchpad에서 실행, 공백 포함 경로 실패 재현을 scratchpad 임시 디렉터리에서 실행, 플레이스홀더 정규식 커버리지를 `node -e`로 검증.

**실행하지 않음**: 저장소 파일 수정 0건(리뷰 보고서·페르소나 적용 이력 제외), git 커밋·병합·push 0건, 배포·승격 0건, `chmod` 0건. **코드는 고치지 않았다.**
