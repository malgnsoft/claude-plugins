# malgn-agent `knowledge/` 44종 + `hooks/` 4파일 전수 리뷰 보고서

리뷰 페르소나 패널 (5명, 전원 재사용 — 신규 0):
- `docs/reviewer/personas/persona-hook-execution-safety-verifier.md` (수렴)
- `docs/reviewer/personas/persona-product-body-portability-auditor.md` (수렴)
- `docs/reviewer/personas/persona-script-skill-consistency-auditor.md` (수렴)
- `docs/reviewer/personas/persona-dead-reference-scope-challenger.md` (**발산**)
- `docs/reviewer/personas/persona-mechanism-zero-based-challenger.md` (**발산**)

리뷰 대상: `malgn-agent/knowledge/**` (`*.md` 44 + `*.html` 2 + `*.png` 1) · `malgn-agent/hooks/{hooks.json, pm-orchestration-block.md, sessionstart-context.mjs, stop-mcp-reminder.cjs}`
target_id: `knowledge-hooks-full-audit-20260829` (신규 — 최초 리뷰)
리스크 범주: **전역 자동실행 자산**(SessionStart/Stop 훅) + **전 직원 상시 로드 지식자산**
리뷰 일자: 2026-08-29 / 기준 트리 : 워킹트리 (main, v1.8.16 배포 후)
등급: Refactor(풀패널) — 배포 완료된 전역 자산의 전수 재검증

**종합 판정: 🟡 Amber** (Major 3 · Minor 11 · Nit 4 · Rethink 2 · Critical 0)

---

## 페르소나 재사용 판정 (산출물 게이트)

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 역할개념 열을 스크리닝했다. **신규 0건 · 재사용 5건.**

| 페르소나 | 유형 | 판정 | 사유 |
|---|---|---|---|
| persona-hook-execution-safety-verifier.md | 수렴 | **재사용** | 역할개념 "전역 자동실행 코드를 자기보고가 아니라 실제 실행 결과로 검증"이 이번 `hooks/` 4파일 대상과 정확히 동형 |
| persona-product-body-portability-auditor.md | 수렴 | **재사용** | 역할개념 "설치 직원이 조회할 수 없는 근거를 목적 기준으로 감사"가 위임 지정 항목(식별자·이력 금지)과 동형 |
| persona-script-skill-consistency-auditor.md | 수렴 | **재사용** | 역할개념 "문서가 서술하는 약속(옵션·임계값)과 코드 구현의 한 줄 대조"가 10,000자 캡·12,000B 상한 실측 항목과 동형 |
| persona-dead-reference-scope-challenger.md | **발산** | **재사용** | 역할개념 "스코프를 형태로 정의한 것과 목적 기준의 간극"이 이번 위임의 형태 grep 방식과 정확히 동형 → R-1의 뿌리 |
| persona-mechanism-zero-based-challenger.md | **발산** | **재사용** | 역할개념 "다중 레이어가 정말 필요한가, 단일 채널로 같은 효과가 나는가"가 knowledge/skills 이중 레이어 검토와 동형 → R-2의 뿌리 |

5개 모두 §5 참고파일이 직전 라운드 대상에 고정돼 있어 **역할개념 수준으로만** 적용했다(INDEX의 2026-08-10 RV-002 선례와 동일 처리). 6대 요소 본문은 무수정, "적용 이력"만 append했다. **신규 페르소나를 만들지 않은 것이 이번 판단의 요점이다** — 이 대상(전역 자동실행 자산 + 제품 본문 이식성)은 이미 여러 라운드가 다뤄 온 리스크 표면이고, 새 서사를 써서 신규 파일을 만들면 INDEX가 경고하는 "회전문 페르소나"가 된다.

---

## 요약 (2분 규칙)

훅 4파일은 **실기동으로 전건 확인했고 PM 행동규율 주입 경로는 설계대로 정확히 작동한다** — 출력 1,294자가 정본 파일 본문과 문자열 단위로 일치하고, 4가지 실패 상태 모두 세션을 막지 않으면서 사람에게 알린다. 위임이 지정한 점검 7항목 중 5항목은 **위반 0**이다(식별자 grep 0건, doc-drift 죽은 참조 0건, knowledge README 44/44 전건 안내, device_token 안전장치 실물 일치, `${CLAUDE_PLUGIN_ROOT}` 포터블성 정상).

그러나 세 가지가 걸린다. ①**STATUS.md 주입에는 PM 블록에 적용한 캡 가드가 빠져 있어**, ASCII 위주 STATUS.md에서 플랫폼 캡 10,000자를 조용히 넘기는 것을 재현했다(11,944B 투입 → 12,015자 emit, 경고 0). ②`knowledge/review/reviewer-personas.md`가 정본 스킬과 **실제로 드리프트**했고 파일 상단 면책이 그 차이를 다 덮지 못한다. ③`knowledge/README.md:143`의 owner/최종검토일 규칙은 저장소 CLAUDE.md의 "이력 금지"와 **정면 충돌**하며, 파일럿 5건 중 4건이 이미 되말려 실적 1/44인 죽은 규약이다.

---

## 지적 사항 (통합)

### 🟠 Major

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| M-1 | 🟠 | 훅 실행안전 / 정합성 | `hooks/sessionstart-context.mjs:49`(`DEFAULT_MAX_BYTES=12000`), `:65`, `:172-194` | 임시 디렉터리에 ASCII STATUS.md(11,944B) 생성 후 훅 실기동 | `clip()`이 **바이트**로만 판정해 11,944B ≤ 12,000B → "절단 아님"으로 통과시키고 `additionalContext`를 **12,015자**로 emit한다. 플랫폼 캡은 10,000**자**(`docs/anthropic/hooks/hooks.md:892`)라 Claude Code가 본문을 파일로 강등하고 미리보기+경로만 전달한다. 이때 **절단 배너도 systemMessage도 붙지 않는다** — 이 모듈이 스스로 내세운 "조용히 자르지 않는다"(`:28`)가 이 경로에서만 무력화된다. 같은 위험을 PM 블록에 대해서는 `PM_BLOCK_SAFE_LIMIT=9500`으로 막아뒀는데(`:98`), STATUS.md 쪽에는 대응 가드가 없다 | `clip()` 이후 최종 `head`의 **문자 길이**를 재서 안전 임계값(예: 9,500자)을 넘으면 추가 절단하고 배너·systemMessage를 붙인다. 또는 `DEFAULT_MAX_BYTES`를 제품 표준(`skills/project-standards` §3 = 3,000B)에 맞춰 내린다 |
| M-2 | 🟠 | 문서-정본 정합성 | `knowledge/review/reviewer-personas.md:5`, `:82-122`, `:243-255` vs `skills/reviewer-persona-panel-standard/SKILL.md:104,112,116,158,169,198` | 두 파일을 나란히 열어 섹션별 대조 + `grep -n "확인방법\|리스크 범주\|기각된 지적\|재사용 판정\|INDEX.md\|적용 이력\|축소\|증분"` 양쪽 실행 | knowledge 사본이 정본 스킬 절차를 **통째로 이중 게재**한 채 드리프트했다. 사본에 없는 것: 지적표 `확인방법` 컬럼 · §4 **기각 게이트**(오탐 기각·강등 4기준 전체) · §0 역할개념/적용이력 분리 · §1.5 `INDEX.md` 대조 절차 · §5.5 다차수 3모드(최초/증분/축소). `:5` 면책은 **3건만**(리스크 범주 헤더·기각된 지적 섹션·재사용 판정 표) 열거해 나머지를 덮지 못한다. `agents/reviewer.md`가 이 문서를 "패턴 D~G만 참조"로 가드하지만, 문서 자체를 연 에이전트는 낡은 보고서 템플릿을 그대로 베낀다 | ①이중 게재 구간(§17~§60·§64~§141·§243~§255)을 삭제하고 스킬을 가리키는 1줄로 대체하거나, ②최소한 `:5` 면책을 "이 문서의 절차 서술은 요약이며 스킬과 다르면 전부 스킬이 맞다"로 포괄 문구화. 부분 열거는 새 조항이 추가될 때마다 또 낡는다 |
| M-3 | 🟠 | 이식성 / 규칙 충돌 | `knowledge/README.md:143` · 대조: 저장소 `CLAUDE.md` "제품 본문은 최신 상태만 담는다" · `knowledge/architecture/usage-collection-agent-architecture.md:3` | `grep -rln 최종검토일 malgn-agent/knowledge/` → 2건(README 자신 + 1개 문서) / `git show --stat ebc1c82`(파일럿 5건) / 각 파일럿 파일 재검 → 4건에서 제거됨(`git log -S최종검토일 -- .../intent-fit-vs-correctness-split.md` → `29c4028` "이력 서술 제거") | 신규 knowledge 문서에 `최종검토일`(YYYY-MM-DD) 메타 라인을 **의무화**하는데, 저장소 CLAUDE.md는 제품 본문의 **날짜 도장을 금지**한다. 실제로 파일럿 5건 중 4건이 이력제거 커밋에서 되말렸고 현재 실적은 **1/44**. 게다가 규칙 도입(2026-08-14) 이후 신설된 유일한 knowledge 문서(`usage-collection-agent-architecture.md`, 2026-08-19)도 `owner`만 있고 `최종검토일`이 없어 규칙 위반이다 — 즉 이 규칙은 도입 이래 단 한 번도 지켜진 적이 없다. **살아 있지 않은 규칙이 본문에 남아 있으면 다음 라운드가 이걸 근거로 날짜를 다시 심고 그다음 라운드가 다시 걷어내는 왕복이 난다**(CLAUDE.md "변경이력 관리 원칙"이 금지하는 패턴) | 둘 중 하나로 확정: (a) `최종검토일` 의무를 삭제하고 `owner`만 남긴다(날짜 없는 소유자 표기는 이력이 아님), (b) 예외 조항으로 명시 승격. 어느 쪽이든 `usage-collection-agent-architecture.md`를 그 결정에 맞춘다 |

### 🟡 Minor

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| m-1 | 🟡 | 훅 실행안전 | `hooks/stop-mcp-reminder.cjs:157-162` | 30KB짜리 MCP 접두어를 심은 합성 transcript로 훅 실기동. 파이프 수신 = **65,536B에서 절단·JSON 파손**, 파일 리다이렉트 대조군 = 120,672B 온전 | `process.stdout.write()` 직후 `process.exit(0)`. 훅의 실제 stdout은 파이프라 비동기 쓰기가 플러시되기 전에 프로세스가 죽는다. **형제 파일 `sessionstart-context.mjs:150-156`이 정확히 이 위험을 7줄 주석으로 문서화하고 회피했는데, 같은 디렉터리의 이 파일에는 그대로 남아 있다** — CLAUDE.md "정본 하나만 고치고 참조처를 놓치면 재발한다"의 실물 사례. **다만 정상 페이로드는 ~600B라 실전 촉발 조건은 비현실적이므로 Major에서 강등한다**(합성 조건에서만 재현) | `:162`의 `process.exit(0)` 제거(자연 종료에 맡김) 또는 `write(..., cb)` 후 종료. 1줄 수정 |
| m-2 | 🟡 | 이식성 / 죽은참조 | `hooks/sessionstart-context.mjs:14, 34, 39` | `ls ~/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/1.8.16/docs` → **No such file or directory**(설치본에 `docs/` 미배포). 라인 드리프트: `git show HEAD:docs/anthropic/hooks/hooks.md \| sed -n '1001p'`가 워킹트리 `1001p`와 다른 행을 가리킴(해당 미러 파일이 +90/−97 재동기화됨) | `docs/anthropic/hooks/hooks.md:852 / :892 / :971 / :1001`을 근거로 인용하는데 ①그 파일은 플러그인에 배포되지 않아 설치 직원이 열 수 없고 ②라인 핀은 미러 재동기화마다 어긋난다(실증). 인용 **내용 자체는 현재 정확함을 확인**했으므로 사실 오류는 아니다 | 라인 번호 대신 인용문 원문(예: `"capped at 10,000 characters"`)과 앵커(`#sessionstart`)로 적는다. 문서 URL은 공개 주소이므로 그대로 둬도 된다 |
| m-3 | 🟡 | 이식성 / 죽은참조 | `hooks/stop-mcp-reminder.cjs:153` | `ls docs/methodology/`(rubric 파일명 없음) + 저장소 `CLAUDE.md` Architecture: "rubric v1.0 — 설계 이력 사료, **현행 판정 기준 아님**" | `rubric §6 / §1.2 Q2 조건③`을 설계 근거로 인용한다. 저장소 전용 문서인 데다 현행 기준도 아니다 — 이중으로 죽은 참조 | 근거를 문장으로 대체: "세션 종료를 막지 않는다 — 강제가 아니라 주입이 이 훅의 설계 전제다" |
| m-4 | 🟡 | 훅 실행안전 | `hooks/stop-mcp-reminder.cjs:20` (`WRITE_TOOL_RE`), 소비처 `:100`, `:141-143` | 정규식 원문 대조 + `docs/anthropic/agents/sub-agents.md:371`에서 실도구 목록 확인(`Bash`, **`PowerShell`** 병기) | `PowerShell`이 누락돼 있다. Windows 세션이 PowerShell 도구로만 작업하면 `hasWriteSignal=false` → `:142` 조기 종료 → **기록 리마인더가 통째로 안 뜬다**(무음 실패, 안전측 폴백도 안 걸림). 이 제품은 "Windows/macOS 동일 실행"을 표방한다 | `PowerShell`을 정규식에 추가. 함께 검토: `MultiEdit`·`Skill`·`Artifact` |
| m-5 | 🟡 | 문서-코드 정합성 | `hooks/sessionstart-context.mjs:31`, `:191` | `grep -rn MALGN_STATUS_MAX_BYTES malgn-agent/` → 코드 2곳 + `bin/check-status-size.mjs` 주석 1곳뿐. `skills/`·`knowledge/`·`agents/` **0건** | 훅이 사용자에게 "상한 조정은 `MALGN_STATUS_MAX_BYTES` 환경변수"라고 systemMessage로 **안내하는데**, 그 변수의 기본값·단위·설정 위치를 설명한 사용자용 문서가 어디에도 없다. 안내를 받은 사람이 갈 곳이 없다 | `skills/project-standards` §3(STATUS.md 크기 절)에 한 줄 추가 — 기본 12,000B, 0=무제한, 훅 주입 전용이며 3,000B 상한과는 다른 값임을 명시 |
| m-6 | 🟡 | 이식성(이력) | `hooks/sessionstart-context.mjs:18` · `hooks/stop-mcp-reminder.cjs:8, 21, 38` | `grep -rnE '20[0-9]{2}-[0-9]{2}-[0-9]{2}' malgn-agent/hooks/` | `(2026-08-24 추가)` `(2026-07-03 추가)` `(2026-08-24 수리)` `(2026-08-24 A/B 중 실제로 재현됨)` — 날짜 도장 4건. CLAUDE.md의 이력금지 조항은 문면상 `agents/`·`skills/`·`knowledge/`만 열거해 `hooks/`가 스코프 밖이나, **동일 목적(설치 직원이 조회 불가)에 걸린다**. 규칙의 이유 서술은 유지 대상이므로 **괄호 안 날짜만** 문제 | 날짜만 제거하고 사유는 현재형으로 유지. 예: `(2026-08-24 수리)` → 삭제, 뒤 설명 문장은 그대로. **동시에 CLAUDE.md 이력금지 스코프에 `hooks/`를 넣을지 결정**해야 왕복이 안 난다 |
| m-7 | 🟡 | 이식성 | `knowledge/design/ux-design-guide.md:147` · `knowledge/planning/business-brief-patterns.md:3` · `knowledge/planning/prd-craft-patterns.md:3` · `knowledge/review/reviewer-personas.md:206` · `knowledge/common/verifiable-output-and-honesty.md:80` | `grep -rnE '`docs/(specs\|refactor\|methodology)/' malgn-agent/knowledge/` + 목적 기준 재검 | 타 저장소 경로를 출처로 단다(`coaching` 프로젝트 `docs/specs/00-business-brief.md`, `docs/specs/50~54-ui-ux-*.md`, `docs/specs/60·61-review-*.md`). 설치 직원은 열 수 없다. `verifiable-output-and-honesty.md:80`의 "(이번 사건에서 회고조차…)"는 **가리키는 대상이 없는 지시어** | 출처는 프로젝트명 수준까지만 남기고 파일 경로는 뺀다(내용 자체는 유효하므로 삭제 대상 아님). "이번 사건" → "이런 사건에서는" |
| m-8 | 🟡 | 죽은참조 | `knowledge/common/verifiable-output-and-honesty.md:87` | `ls malgn-agent/knowledge/design/` — 화면 캡처 원칙 문서 없음. 실제 정본은 `knowledge/review/screenshot-capture-guide.md` / Skill `common-screen-verification-and-capture` | "(원칙은 design 폴더 가이드 참조)" — **잘못된 방향을 가리킨다**. 그 폴더에 그 원칙이 없다 | `Skill common-screen-verification-and-capture`로 교체 |
| m-9 | 🟡 | 죽은 자산 파이프라인 | `knowledge/README.md:19` · `knowledge/review/reviewer-personas.md:11` · (참조: `agents/reviewer.md` "재사용 페르소나 자산") | `ls malgn-agent/knowledge/review/persona-*.md` → **no matches**. 대조: `docs/reviewer/personas/`에는 36개 존재 | 세 곳이 "번들의 `knowledge/review/persona-*.md`, trainer가 승격해 키움"이라 안내하지만 **실물 0건**이다. 프로젝트 페르소나가 36개 쌓이는 동안 승격은 한 번도 일어나지 않았다. 리뷰어가 "자산이 있으면 재활용"하려고 그 경로를 열면 매번 빈손 | (a) trainer 모드 5를 실제로 돌려 자산을 만들거나 (b) 세 곳의 문구를 "아직 승격된 자산 없음 — 프로젝트 페르소나만 재활용한다"로 정정. 있는 척하는 편이 없는 것보다 나쁘다 |
| m-10 | 🟡 | 경로 규약 | `knowledge/quality/e2e-testing-guide.md:3, 8` · `knowledge/architecture/usage-collection-agent-architecture.md:5` · `knowledge/review/screenshot-capture-guide.md:3` | `grep -rn 'malgn-agent/' malgn-agent/knowledge/` (5건) + `skills/common-output-storage-and-path-management` §1-2 표 대조 | §1-2가 정한 세 형태 중 어느 것도 아니다. `malgn-agent/bin/capture.mjs`는 **소스 clone을 고칠 때만** 쓰는 형태인데 여기선 "실행할 스크립트"를 가리킨다(설치본에서 해석 불가). `screenshot-capture-guide.md:3`은 §1-2 3행("지금은 없는 옛 문서는 경로 없이 산문으로")을 어기고 폐지된 `bin/capture-all.js`/`bin/capture-nav.js`를 경로로 적는다 | 실행 대상은 `bin/capture.mjs`로만 적고 실행법은 스킬을 가리킨다(이미 그렇게 하고 있으므로 경로 접두어만 제거). 폐지 파일은 이름 없이 "프로젝트별 복사-커스터마이즈 템플릿" 정도로 |
| m-11 | 🟡 | 이식성(이력·미결) | `knowledge/README.md:58`, `:77` | 해당 라인 Read | `:58` "evaluator 판정 체크리스트 개선 논의의 참고 자료(**evaluator.md 자체는 미수정**)" — 자사 내부 논의 경위. `:77` "폴더는 architecture/이나 대상은 frontend — **물리적 이동은 별도 판단 필요**" — 미해결 TODO를 제품 본문에 방치. 설치 직원에겐 둘 다 잡음 | `:58`은 용도만 남긴다. `:77`의 이동 판단은 백로그로 옮기고 본문엔 "대상 에이전트는 frontend-dev"만 |

### ⚪ Nit

| # | 위치 | 확인방법 | 문제 |
|---|---|---|---|
| n-1 | `knowledge/review/reviewer-personas.md:138` | 해당 라인 Read | 오타 — "권고를 **답는다**" → "단다" |
| n-2 | `knowledge/common/verifiable-output-and-honesty.md:20` | 해당 라인 Read | 마크다운 표 셀 안의 `curl … \| grep …` 파이프가 이스케이프되지 않아 표 행이 깨진다 → `\|` |
| n-3 | 저장소 `CLAUDE.md` Architecture(`hooks/` 항목) | `cat malgn-agent/hooks/hooks.json` | "인자 없이 STATUS.md 주입, `--pm-block`으로 PM 행동규율 주입" 순서로 서술하나 실물은 `--pm-block`이 **먼저** 등록돼 있다. 동작엔 영향 없으나 실물과 서술이 반대 (※ 제품 본문 아님 — PM 직접 수정 가능 구역) |
| n-4 | `hooks/` 실행비트 | `ls -l malgn-agent/hooks/` | `stop-mcp-reminder.cjs`만 755, 나머지 644. 둘 다 `node "…"`로 호출돼 무해하나 형태가 갈린다 |

---

## 기각된 지적

패널이 냈으나 진행자가 실물 대조로 기각/강등한 것. **모두 "그럴듯했지만 틀린" 지적이며, 그대로 올렸다면 trainer 작업 시간을 태웠을 것들이다.**

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 훅 실행안전 | `WRITE_TOOL_RE`의 `Agent`·`Workflow`가 실재하지 않는 도구명(실제는 `Task`) | **기각** | `docs/anthropic/agents/sub-agents.md:86,361,371,427,433` 대조 — `Agent`가 정확한 도구명이고 `` `Task` ``는 미러 전체에서 0건. `Workflow`도 미러에 7회 등장. 기억으로 판단했다면 정반대 결론이 됐다 |
| 죽은참조 | `knowledge/README.md:120`의 `knowledge/lessons/[프로젝트명].md`가 존재하지 않는 경로 | **기각** | 같은 절(`:119-121`)이 "이 저장소에 `lessons/` 폴더는 **존재하지 않는다**"고 명시적으로 선언하고 그 전제를 설명하는 문맥. 경로 형태만 보고 유추한 지적 |
| 죽은참조 | `knowledge/leadership/agent-training-guide.md:520`의 `bin/skill-definitions.js`·`bin/sync-agents.js` 부재 | **기각** | 같은 표 셀이 "**이 플러그인에는 미포함** — 운영 프로젝트에 구축되어 있다면 그 경로를 사용, 없으면 수동 산정"이라 명시 |
| 죽은참조 | doc-drift 제거 후 knowledge·hooks에 잔존 참조 | **기각(해당 없음)** | `git grep -n doc-drift -- malgn-agent/knowledge/ malgn-agent/hooks/` → exit 1(0건). `malgn-agent/` 전체로 넓혀도 `CHANGELOG.md`(정당한 이력 보관처)뿐 |
| 정합성 | `knowledge/common/agent-common-principles.md:5` "16개 이상의 에이전트 MD가 참조" 수치 미검증 | **기각** | `grep -rln agent-common-principles.md malgn-agent/agents/ \| wc -l` → 정확히 16(전체 21 중). "16개 이상"은 참 |
| 정합성 | `knowledge/README.md:92`가 "심각도 CVSS 매핑 → `agents/security.md` 핵심 원칙"이라 하나 실재 여부 미확인 | **기각** | `agents/security.md:25` "**심각도 판정 기준 (CVSS 매핑)**" + `:27` 표 실재 |
| 이식성 | knowledge 문서 다수가 아무 에이전트·스킬에서도 참조되지 않는 고아 자산 | **기각** | 44문서 전건에 대해 `agents/`·`skills/`·`knowledge/`·`hooks/` 교차 참조 스캔 실행 — **고아 0건, README에서만 참조되는 것도 0건** |
| 이식성 | `knowledge/leadership/agent-training-guide.md:408-409`, `:434`의 `2026-07-09` 날짜 도장 | **기각** | CLAUDE.md 예외 조항("형식 예시 안의 날짜는 이력이 아니다")에 해당 — hub 기록 title 형식 예시와 `idempotencyKey` 예시. 기계적으로 밀면 예시가 망가진다 |
| 훅 실행안전 | STATUS.md 첫 줄이 상한보다 길면 `clip()`이 빈 문자열을 반환해 크래시 | **기각(무해 확인)** | `MALGN_STATUS_MAX_BYTES=1000` + 20,000자 단일행으로 재현 — exit 0, 본문 0바이트지만 "앞 0.0KB만 주입(0/1줄)" 배너와 systemMessage가 정직하게 붙는다. 노이즈 367자는 남으나 실패 아님 |
| 훅 실행안전 | m-1(파이프 절단)을 Major로 | **강등 → 🟡** | 재현은 됐으나 촉발 조건이 >64KB MCP 도구명이라는 합성 상황. 실 페이로드 ~600B. §4 기각 게이트("재현 절차 대비 영향 경로가 비현실적이면 강등")를 자기 지적에도 적용 |

---

## 페르소나별 관점

### [훅 실행안전성 검증가] — 판정: 🟡 Amber
자기보고를 받지 않고 **4파일 전건 실기동**했다. **PM 행동규율 주입 경로는 흠잡을 데가 없다** — 정상 출력 1,294자(배너 73 + 본문 1,221)가 정본 파일 trim 결과와 문자열 단위로 일치하고, 캡 10,000자 대비 8,706자 여유. 4가지 실패 상태(파일 부재 / 본문 공백 / 본문 9,605자 과대 / 예외)를 모두 재현했고 전부 세션을 막지 않으면서 systemMessage로 사람에게 알린다. `hooks.json`의 SessionStart 2회 등록도 실물 확인.

그런데 **같은 파일의 STATUS.md 경로에는 그 성숙도가 적용돼 있지 않다**(M-1). PM 블록은 별도 프로세스 분리 + 9,500자 가드로 이중 방어하면서, STATUS.md는 바이트 상한 하나뿐이고 문자 캡을 아예 보지 않는다. 헤더 주석 `:36-37`이 "STATUS.md는 ASCII 위주면 12,000바이트가 10,000문자를 넘을 수 있다"고 **스스로 정확히 진단해놓고**, 그 진단으로 PM 블록만 구하고 STATUS.md는 두고 갔다. 그리고 `stop-mcp-reminder.cjs`는 형제 파일이 7줄 주석으로 경고한 `exit()` 조기종료 패턴을 그대로 갖고 있다(m-1).

### [제품 본문 이식성 감사관] — 판정: 🟡 Amber
**형태 기준으로는 이 영역이 깨끗하다.** 위임이 지정한 `grep -rnoE '\b[0-9a-f]{8}\b|\b01[0-9a-hjkmnp-tv-z]{24}\b'`는 knowledge·hooks 양쪽에서 **0건**. 커밋 해시·ULID·auto-memory 키 재유입 없음.

그러나 목적 기준("설치 직원이 이 근거를 열 수 있는가")으로 다시 훑으면 조회 불가 근거가 남아 있다 — 설치본에 `docs/`가 없음을 `ls`로 확인한 뒤 `docs/anthropic/hooks/hooks.md:852`(m-2), `rubric §6`(m-3), `coaching` 프로젝트 `docs/specs/…` 4건(m-7)을 확인했다. 날짜 도장은 hooks 코드 주석 4곳(m-6). knowledge 본문의 자사 프로젝트명(`coaching`/`malgnuniv`/`malgnhrd`/`Coach Connect`) 자체는 **기각하지 않았다** — 맑은소프트 직원 대상 제품이라 프로젝트명은 맥락이 통하고, 조회 불가한 것은 이름이 아니라 **파일 경로**이기 때문이다. 그 경계를 그은 것이 이번 판정의 핵심이다.

### [문서-구현 정합성 감사관] — 판정: 🟠 Amber(경계선)
임계값 세 개가 세 자리에서 서로 다르다: 제품 표준 **3,000바이트**(`skills/project-standards` §3) / 훅 기본 **12,000바이트**(`sessionstart-context.mjs:49`) / 플랫폼 캡 **10,000자**(`skills/claude-md-architecture` §55가 정확히 서술). 단위와 값이 모두 갈려 10,001~12,000자 ASCII 구간이 무경고 사각지대가 된다(M-1). 게다가 훅이 해법으로 안내하는 환경변수는 사용자용 문서에 정의가 없다(m-5).

`knowledge/review/reviewer-personas.md`는 "정본은 스킬"이라 선언한 뒤 그 절차를 다시 실어 놓았고, **실제로 어긋났다**(M-2). 이 문서의 낡은 보고서 템플릿을 따랐다면 이번 보고서에도 `확인방법` 컬럼과 "기각된 지적" 섹션이 없었을 것이다. `knowledge/README.md:143`의 owner/최종검토일 규칙은 도입 이래 한 번도 지켜진 적 없고 파일럿 4/5가 되말렸다(M-3).

### [죽은참조 스코프 도전자 — 발산형] — 판정: 🔵 (R-1)
아래 "구조적 제언" 참조.

### [메커니즘 제로베이스 도전자 — 발산형] — 판정: 🔵 (R-2)
아래 "구조적 제언" 참조.

---

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| R-1 | "제품 본문 오염"을 **형태**로 정의하고 형태 grep 2개(8자리 hex·26자 ULID)로 지킨다. CLAUDE.md 스스로 "스코프는 형태가 아니라 목적으로 잡는다"고 적어놓고, 실제 집행 수단은 형태다 | **판정 기준을 "설치본에서 열리는가"로 바꾸고 기계로 집행한다.** 저장소 스크립트(`scripts/`, 미배포)에 링크 체커를 추가: `malgn-agent/**` 본문에서 경로형 토큰을 추출해 **설치본 루트 기준으로 존재 검사**하고, 존재하지 않으면 ERROR. 화이트리스트는 사용자 프로젝트 경로(`docs/reviewer/`, `docs/screenshots/` 등)와 공개 URL만 | 이번 라운드에서 형태 grep은 0건인데 목적 기준으로는 **7건이 잡혔다**(m-2·m-3·m-7·m-8·m-9·m-10). 형태 grep은 이미 통과 도장을 찍었고 아무도 다시 안 본다 — CLAUDE.md가 경고한 "제외 항목이 살아남는" 경로가 바로 이것이다. 라인핀 인용의 드리프트도 같은 체커가 잡는다(`hooks.md`가 +90/−97 재동기화되며 `:1001`이 이미 다른 행을 가리킴을 실측) | 중간. 파서가 코드펜스·플레이스홀더(`[프로젝트명]`)·글로브(`bin/*.mjs`)를 오탐하지 않게 만드는 것이 실제 비용이다 — 이번 리뷰에서 같은 스캔을 돌려 오탐 4건이 나왔고 전부 눈으로 걸러야 했다. **다만 오탐 패턴이 이미 열거돼 있어 규칙화 가능**(미확인 추정치 아님). 변경 동결 중이므로 백로그 |
| R-2 | `knowledge/` 44종과 `skills/` 38종의 **이중 레이어**. knowledge 44개 중 최소 12개는 본문이 없는 포인터 문서다 — `README.md:31~106`이 "(본문 정본은 `skills/…`, **배경만 남음**)" 형태로 스스로 열거한다. 본문을 가진 문서 중 `review/reviewer-personas.md`는 정본 절차를 통째로 이중 게재했다 | **포인터 문서를 폐지하고 두 층의 역할을 물리적으로 가른다.** (a) 본문 없이 "정본은 스킬"만 남은 knowledge 문서는 삭제하고, 그 "배경/왜"를 스킬 본문 상단 2~3줄로 흡수한다. (b) 살아남는 knowledge는 **어떤 스킬과도 본문이 겹치지 않는 것**만(도메인 레퍼런스·브랜드 자산·역추출 사례). (c) `check-assets`에 "같은 소제목이 skill과 knowledge 양쪽에 있으면 WARN" 규칙 추가 | "정본은 저기"라는 면책 한 줄이 사본의 낡음을 **정당화하는 장치**로 작동한다. M-2가 그 결과다 — 면책이 있었기 때문에 사본이 낡아도 아무도 결함으로 안 봤고, 그 사이 스킬에 조항 5개가 추가됐다. 레이어가 하나면 드리프트할 자리가 없다. **CLAUDE.md "에이전트 업그레이드 원칙"의 정당한 슬리밍 대상(중복 서술)에 정확히 해당한다** — 성능 저하 없이 상시 참조면이 줄어든다 | 큼. 12개 문서의 참조처를 전 저장소 grep해 함께 정정해야 하고(CLAUDE.md 변경이력 원칙), 배포 후 변경 동결 대상이다. **지금 하자는 제안이 아니라 동결 해제 시 1순위로 올리자는 제안**이다. 부분 착수도 가능 — M-2(reviewer-personas) 하나만 먼저 정리해도 즉시 이득 |

---

## 트레이드오프 (페르소나 간 충돌)

1. **이식성 감사관 vs 정합성 감사관 — 코드 주석의 근거 인용을 어디까지 빼는가.**
   이식성 감사관은 `docs/anthropic/hooks/hooks.md:852` 같은 인용을 조회 불가 근거로 빼자고 한다(m-2). 정합성 감사관은 반대다 — 그 인용이 있었기 때문에 이번 리뷰가 `:852`를 열어 "SessionStart는 블로킹 불가"를 **1분 만에 확인**할 수 있었고, 빼면 다음 유지보수자가 근거를 처음부터 다시 찾는다.
   → **권고: 라인 번호만 빼고 인용문 원문 + 앵커는 남긴다.** 조회 가능성(설치본에서 URL로 열림)과 검증 가능성(무엇을 근거로 삼았는지)을 둘 다 지키는 유일한 지점이다. "근거를 지운다"가 아니라 "썩는 형태의 근거를 안 썩는 형태로 바꾼다"로 프레이밍해야 다음 라운드가 근거 자체를 지우는 과잉으로 가지 않는다.

2. **M-3의 두 갈래 — owner 메타를 살릴 것인가 죽일 것인가.**
   이식성 감사관은 날짜 도장이므로 삭제, 정합성 감사관은 knowledge 문서의 소유자·신선도가 없으면 44개가 누구 것인지 알 수 없다고 본다.
   → **권고: `owner`는 살리고 `최종검토일`만 뺀다.** 소유자는 이력이 아니라 현재 상태다. 신선도가 정말 필요하면 날짜를 본문에 심는 대신 `git log -1 --format=%ad <파일>`로 얻는다 — 저장소가 이미 갖고 있는 정보를 본문에 복사하지 않는 것이 "두 벌을 만들지 않는다"는 이 프로젝트의 원칙과 일치한다.

---

## 잘 된 점 (유지할 패턴)

1. **PM 블록의 이중 방어가 설계대로 작동한다.** 별도 프로세스 분리(1차)와 `PM_BLOCK_SAFE_LIMIT=9500`(2차)를 나눠 놓고, 헤더 주석이 "구조적 분리가 안전 임계값보다 먼저 오는 1차 방어선"이라고 층위까지 밝힌다. 실기동 결과 정확히 그대로다. **M-1의 처방은 새 설계가 아니라 이 패턴을 STATUS.md에 복사하는 것뿐이다.**
2. **실패해도 조용히 넘어가지 않는다.** pm-block 3가지 실패 상태 전부 systemMessage로 사람에게 알린다. "SessionStart는 블로킹 불가이므로 막을 수는 없지만 알리기는 한다"는 판단이 코드와 주석 양쪽에 일관된다.
3. **`extractPmBlockBody()`가 자기 파일의 현재 모양에 의존하지 않는다**(`:107-112`). 선행 HTML 주석이 0개든 2개든 동일 동작 — "지금 마커가 있으니까 그걸 기준으로" 짜지 않은 절제.
4. **`process.exit()`를 안 쓰는 이유를 주석으로 박제했다**(`:150-156`). 이 주석이 없었으면 m-1을 형제 파일에서 발견하지 못했을 것이다. **이 주석 자체가 이번 리뷰의 도구가 됐다.**
5. **knowledge 진입점 정합성 100%.** 44/44 전건이 `README.md`에 등재돼 있고, 고아 문서 0건, README에서만 참조되는 문서도 0건. 44개 전부 최소 1개 에이전트·스킬에서 실제 진입로를 갖는다.
6. **폴더 부재를 명시적으로 선언한다.** `README.md:91`(security/), `:119`(lessons/) — "없다"를 적어두면 다음 사람이 "왜 없지"를 다시 조사하지 않는다. 이번 리뷰에서 오탐 2건을 이 문장들이 직접 막았다.
7. **`stop-mcp-reminder.cjs`의 접두어 무관 판정**(`:21-38`). "플러그인 설치본에서 단 한 번도 매치되지 않았다"는 실패 양상을 근거로 남기고 와일드카드로 고친 것 — 규칙의 이유를 남기는 좋은 예다(날짜만 빼면 CLAUDE.md 기준에도 부합).
8. **device_token 안전장치가 문서와 코드에서 일치한다.** `plugin.json:20-26`이 "값을 채워도 자동으로 쓰이지 않는다(정적 헤더 제거됨)"라고 적었고, `mcpServers.malgnai-hub`에 `headers` 키가 실제로 없다. `skills/project-standards` §40-41이 사용량 수집용 `device_token`과 **별개 값**임을 구분해준 것도 정확하다.
9. **`knowledge/README.md:5`가 `${CLAUDE_PLUGIN_ROOT}`를 산문으로 우회한다.** knowledge 문서에서는 변수가 치환되지 않는다는 제약을 알고, 변수를 쓰는 대신 "맨이름을 달러+중괄호로 감싸"라고 말로 적었다. 제약을 이해한 사람만 쓸 수 있는 문장이다.

---

## 평가기준 충족 현황 (위임 지정 7항목)

| # | 위임 점검 항목 | 관점 | 결과 | 근거 |
|---|---|---|---|---|
| 1 | 식별자 금지 규칙 위반(hex/ULID) | 이식성 | ✅ **위반 0** | `grep -rnoE` knowledge·hooks 양쪽 0건 |
| 2 | 이력 금지 규칙 위반(날짜·경위·버전) | 이식성 | ⚠️ **부분 위반** | hooks 코드 주석 날짜 4건(m-6), knowledge 경위 서술 3건(m-7·m-11). 형식 예시 날짜는 예외로 기각 |
| 3 | doc-drift 제거 후 죽은 참조 | 죽은참조 | ✅ **잔존 0** | `git grep -n doc-drift -- knowledge/ hooks/` exit 1 |
| 4 | pm-orchestration-block.md ↔ CLAUDE.md 서술 일치 + 경로 포터블성 | 훅 실행안전 | ✅ **일치** | 훅 실행 출력이 파일 본문과 문자열 동일. `${CLAUDE_PLUGIN_ROOT}` 형태 정상(`skills/common-output-storage…` §1-1이 이 자리의 치환을 관측으로 확정) |
| 5 | hooks.json 2회 등록 실물 일치 + 10,000자 캡 실측 | 훅 실행안전 | ⚠️ **PM 블록 통과 / STATUS.md 미달** | 등록 구조 일치. PM 블록 1,294자(여유 8,706). **STATUS.md는 12,015자 emit 재현 → M-1** |
| 6 | device_token "채워도 안 쓰임" 안전장치 실물 일치 | 정합성 | ✅ **일치** | `plugin.json`에 `mcpServers.*.headers` 부재 확인 |
| 7 | knowledge/README.md 44종 전건 안내 | 정합성 | ✅ **44/44** | 프로그램 대조. 미등재는 `맑은_로고.png` 1건뿐(HTML 자산이라 정당) |

**저장소 정적검사 기준선 유지**: `pnpm run check-docs` exit 0(agents 21 / skills 38 / knowledge 44 전건 일치) · `pnpm run check-assets` **ERROR 0** · WARN 18 · INFO 1.

---

## PM에게 권고

**우선순위 1 — 지금 고칠 것 (변경 동결 규칙상 "결함"에 해당, 전부 trainer 위임)**
- **M-1** `sessionstart-context.mjs` STATUS.md 문자 길이 가드. 이 라운드의 유일한 실동작 결함이고, 처방이 이미 같은 파일 안에 있다(PM 블록 패턴 복사). 전역 자동실행 자산이므로 수정 후 reviewer 재검증 필수.
- **m-4** `PowerShell` 누락 — 1토큰 추가로 Windows 무음 실패가 닫힌다.
- **m-1** `stop-mcp-reminder.cjs:162` `process.exit(0)` 제거 — 1줄. 촉발 조건은 비현실적이나 형제 파일이 이미 고친 동일 위험이라 **남겨두면 다음 라운드가 또 발견해 또 조사한다**(왕복 비용이 수정 비용보다 크다).
- **m-8** 잘못된 방향 지시 1줄. **n-1** 오타 1자.

**우선순위 2 — 결정이 먼저 필요한 것 (PM이 방향을 정한 뒤 trainer 위임)**
- **M-3** owner/최종검토일 규칙의 존폐. 위 트레이드오프 2의 권고는 "owner 유지, 최종검토일 삭제"다. **동시에 CLAUDE.md 이력금지 스코프에 `hooks/`를 넣을지도 같은 자리에서 결정**해야 한다(m-6) — 따로 결정하면 다음 라운드에 또 갈린다.
- **M-2** `reviewer-personas.md` 이중 게재. 최소 조치(면책 문구 포괄화)는 1줄이라 지금 가능하고, 근본 조치(이중 게재 삭제)는 R-2의 부분 착수다.
- **m-9** 승격 페르소나 자산 0건 — trainer 모드 5를 돌릴지, 문구를 정정할지.

**우선순위 3 — 백로그 (변경 동결 대상, 동결 해제 시)**
- **R-1** 목적 기준 링크 체커. **R-2** knowledge/skills 이중 레이어 정리. m-2·m-3·m-7·m-10·m-11은 R-1이 도입되면 한 번에 잡히므로 개별 수리보다 R-1을 기다리는 편이 낫다.

**리뷰 스코프·한계 (정직 보고)**
- 이번 리뷰는 `knowledge/` 44종 + `hooks/` 4파일 **한정**이다. `agents/` 21종·`skills/` 38종은 병행 세션 담당이라 손대지 않았다 — 따라서 **"malgn-agent 전체 건전성"으로 인용하지 마라.** 이 판정의 측정 스코프는 전체 자산 103종 중 48종이다.
- **화면 리뷰 없음** — 대상에 UI가 없어 `docs/screenshots/` 캡처를 만들지 않았다(생략, 사유: 해당 없음).
- **미검증**: ①Windows 실행(macOS에서만 실기동 — m-4는 정규식·공식 도구목록 대조로만 판정했고 실제 Windows 세션에서 재현하지 않았다) ②Claude Code 하네스가 같은 `hooks` 배열의 두 항목에 각각 독립 캡을 적용하는지는 **공식문서 서술**(`hooks.md:971`)로만 확인했고 실세션 관측은 하지 않았다 ③`knowledge/design/html-style-guide/*.html` 2종은 렌더링하지 않고 텍스트만 훑었다.
- **실행 액션 없음** — 파일 수정·커밋·푸시·승격 어느 것도 하지 않았다. 유일한 쓰기는 `docs/reviewer/personas/` 5개 파일의 "적용 이력" append와 `INDEX.md` 주석 블록 append, 그리고 이 보고서 파일 생성이다. `INDEX.md`는 병행 세션 2개가 동시 편집 중일 수 있어 표 행 재작성 대신 append로 갈음했다(충돌 회피).
- **부수 관찰(스코프 밖)**: `persona-hook-execution-safety-verifier.md`의 최신 적용 이력이 `docs/reviewer/review-pm-block-sessionstart-injection-2026-08-28.md`를 가리키는데 **그 파일이 존재하지 않는다**(`ls` 확인). 직전 라운드의 산출물 게이트가 새어 있다 — 리뷰 프로세스 자체의 문제이므로 별도 판단 필요.
