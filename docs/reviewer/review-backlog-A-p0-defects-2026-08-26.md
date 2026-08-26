# `fix/backlog-A-p0-defects` (실증 결함 3건 수리) 리뷰 보고서

리뷰 페르소나 패널(6, 전부 재사용 · 신규 0): `personas/persona-enforcement-gap-auditor.md`, `personas/persona-field-executability-officer.md`, `personas/persona-unattended-agent-runtime-safety-auditor.md`, `personas/persona-hook-execution-safety-verifier.md`, `personas/persona-script-skill-consistency-auditor.md`, `personas/persona-dead-reference-scope-challenger.md`(발산형)
리뷰 대상: `fix/backlog-A-p0-defects` — `fdcaffc`·`a4f5ed5`·`247da78` (base `main`=`54dff12`), 6파일 +92/−16
target_id: `backlog-A-p0-defects` / 1차(최초, 풀패널)
리스크 범주: **전역 자동실행 자산**(`hooks/` 훅 코드 + 전 직원 PC 무인 실행 스크립트) + **승격 거버넌스**(evaluator 게이트)
작업 등급: Sensitive (rubric §7.1 "`hooks/` 변경은 등급 무관 고정" + 프로덕션 텔레메트리 사고 이력)
리뷰 일자: 2026-08-26
**종합 판정: 🟡 Amber** — Critical 0 / Major 2 / Minor 4 / Nit 2 / Rethink 2 · 기각 2

## 요약 (2분 규칙)

세 수정 모두 **원래 겨냥한 결함은 실제로 닫았다**(D3의 전제였던 무증상 드리프트가 main에 실재했음을 실측으로 확인했고, D2 가드는 절대·상대·파일심볼릭·디렉터리심볼릭 4경로 전건에서 정상 발동한다). 다만 Major 2건이 남는다 — ①D3가 "문서 문구를 바꾸면 그 항목의 드리프트 감시가 조용히 꺼지는데 `check-docs`는 초록불(exit 0)로 통과"하는 새 경로를 열었고(픽스처로 재현), ②D1의 신규 판정축 중 `Knowledge→Skill 지시형 링크 금지`가 예외를 명시하지 않아 **현재 배포 중인 knowledge 19/44 파일을 FAIL시킨다**(금지 예시와 문장 형태까지 동일한 실물 존재). 둘 다 각 1파일 국소 수정으로 닫히며, 변경 동결 원칙상 "결함"에 해당한다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|-------|------|------|---------|------|--------|
| M-01 | 🟠 | 훅 실행 안전성 | `malgn-agent/hooks/doc-drift.mjs:264-266`, `:382`, `:386` | 임시 프로젝트에 check 2건(하나는 `docRegex` 미매치) 픽스처를 깔고 CLI 실행 | `docRegex` 미매치가 **부분 skip**으로 처리되고, `allUnmeasurable`은 "전부 skip"일 때만 참이라 CLI가 `(skip, 측정불가: b)` 바로 뒤에 **`✅ 문서가 코드와 일치.` + exit 0**을 출력한다. 정적 `expected` 시절엔 문서 문구를 아무리 고쳐도 감시가 꺼지지 않았는데, 이번 전환으로 **가장 자주 편집되는 산출물(문서 문장)이 감시 스위치가 됐다.** `hooks/sessionstart-context.mjs:102-106`도 `results.length === 0`일 때만 경고하므로 세션에도 신호가 없다 | `docFile`+`docRegex`가 **명시적으로 지정된** check에 한해 `expected == null`을 skip이 아니라 실패로 승격(또는 최소한 `skipped.length > 0`이면 `✅ 문서가 코드와 일치.` 문구를 억제). 지정 자체가 "이 문서를 감시하겠다"는 선언이므로 미매치는 정당한 skip이 아니다. `homeGlob` 타호스트 같은 기존 정당 skip은 영향 없음 |
| M-02 | 🟠 | 강제력 격차 | `malgn-agent/agents/evaluator.md:68` | `grep -rlE 'Skill \`\|skills/' malgn-agent/knowledge/` (19/44 파일) + 실물 라인 육안 대조 | 신규 항목이 "Knowledge→Skill 지시형 링크가 **없는가**"를 예외 없이 요구하는데, 배포 중인 knowledge 19개 파일이 걸린다. `knowledge/leadership/team-composition-patterns.md:123`("위임·추적·검증의 실행 절차는 Skill \`project-orchestration\`을 따른다.")은 항목이 든 금지 예시("따라서 X 스킬을 따르라로 끝나면")와 문장 형태가 동일하다. 게다가 `knowledge/review/reviewer-personas.md:5`·`knowledge/review/screenshot-capture-guide.md:3`의 "정본은 Skill X다" 포인터는 **중복 제거를 위해 의도적으로 채택된 패턴**이고, 항목이 내세운 해악("어느 쪽이 정본인지 판별할 수 없다")의 정확히 반대 효과를 낸다. 결과적으로 evaluator는 정당한 trainer 산출물을 오반려하거나 이 항목을 무시하게 된다. 대조: 같은 체크리스트 `:51`(이식성)은 "0건이어야 PASS인 것은 아니다"라며 허용 케이스 3종을 명시한다 — 신규 항목만 그 장치가 없다 | 문면을 좁힌다: grep은 **후보 추출용**임을 명시하고, ①"정본은 Skill X다"류 **단방향 정본 선언 포인터**는 허용 ②"절차 본문을 Knowledge에 두고 Skill을 따르라고만 넘기는 것"만 FAIL. `:51`의 예외 열거 형식을 그대로 따르면 된다 (trainer 위임) |
| m-01 | 🟡 | 현장 실행가능성 | `malgn-agent/agents/evaluator.md:63` | `grep -r "승인 게이트" skills/` 실행 → `No such file or directory`(exit 2) | 신규 중복판정 항목의 명령이 저장소 루트에서 실패한다. 같은 문서 `:42`는 정본 경로를 `malgn-agent/skills/<name>/SKILL.md`로, `:67`은 `malgn-agent/knowledge/README.md`로 적고 있어 **인접 줄과 접두어가 어긋난다**(기존 `:62` `agents/*.md`가 같은 결함을 이미 갖고 있고 신규 항목이 그것을 확대) | `grep -r <핵심 키워드> malgn-agent/skills/`로 정정. `:62`도 같이 정정할지는 PM 판단(기존 결함) |
| m-02 | 🟡 | 강제력 격차 | `malgn-agent/agents/evaluator.md:53` vs `:46` | 신규 4항목과 기존 항목의 문형 대조 | `:46`이 "아래 체크리스트 **전 항목이 PASS**해야 게이트 통과"라고 규정하는데, 등급고정 항목만 판정문("…인가?")이 아니라 절차 지시("…Sensitive로 고정하고 …적용한다")다. 체크박스에 PASS/FAIL을 매길 근거가 모호하다(나머지 신규 3항목은 정상적으로 판정문) | "…등급을 Sensitive로 고정했는가?"처럼 판정문으로 어미만 바꾸거나, 체크리스트가 아니라 `:42` 전제 문단으로 위치를 옮긴다 |
| m-03 | 🟡 | 스크립트-문서 정합성 | `malgn-agent/skills/project-standards/SKILL.md:78`, `malgn-agent/bin/new-project.mjs:247` | 두 파일 원문 Read | 매니페스트 작성법을 가르치는 두 소비자가 모두 미갱신 — SKILL.md는 정적 `expected` + 측정법 4종만, `_help` 문자열도 `label/expected 와 측정법(glob\|homeGlob\|jsonLength\|file+regex)`만 안내한다. 그래서 **이 저장소 밖의 모든 신규 프로젝트는 D3가 없앤 "매니페스트가 문서 숫자를 자체 복제" 방식 그대로 스캐폴드된다.** 스캐폴드 자체는 정상 동작하므로 깨짐이 아니라 미완결 롤아웃 | `_help` 1줄 + SKILL.md §6 1문장 추가(`docFile`+`docRegex`로 문서 원문에서 직접 캡처 가능). **변경 동결 기준상 "깨짐"이 아니므로 백로그 권고** — 다만 M-01 수정과 함께 묶으면 비용이 거의 0 |
| m-04 | 🟡 | 무인 실행 안전성 | `malgn-agent/bin/report-usage.mjs:588` | 가드 로직 복제 픽스처를 6경로로 실행 | 가드가 `process.argv[1]`만 `realpathSync`로 정규화하고 `import.meta.url` 쪽은 그대로 쓴다(비대칭). `--preserve-symlinks-main`(또는 같은 값의 `NODE_OPTIONS`) + 심볼릭 링크 호출 조합에서 `IMPORTED` 오판 → run() 스킵을 **재현했다**. 다만 `install-usage-agent.mjs:30-31`이 등록하는 경로는 자신의 `fileURLToPath(import.meta.url)`로 만든 realpath 절대경로라(plist `:88` / schtasks `:139`) 심볼릭 링크를 거치지 않는다 — **스케줄러 경로에서는 성립하지 않아 실피해 없음** | 양쪽을 대칭으로 정규화: `pathToFileURL(fs.realpathSync(process.argv[1])).href === pathToFileURL(fs.realpathSync(fileURLToPath(import.meta.url))).href`. 지금 깨진 것은 아니므로 백로그로도 무방 |
| n-01 | ⚪ | 스크립트-문서 정합성 | `malgn-agent/bin/report-usage.mjs` 파일 끝 | `git diff`에 `\ No newline at end of file` 잔존 | 파일 끝 개행이 변경 후에도 없다 | 개행 1개 추가(다음 diff 노이즈 제거) |
| n-02 | ⚪ | 스코프(발산) | `CLAUDE.md:146`, `.claude/doc-drift.json` knowledge check | glob 의미 추적 + `find malgn-agent/knowledge -name '*.md'`(45) vs 실측(44) | `knowledge/*/**/*.md`는 최상위 문서를 세지 않는데(현재는 `README.md` 하나뿐, 의도대로), `CLAUDE.md:146`에는 "도메인 디렉토리 하위만 센다"는 한정어가 없다 — 다음 사람이 `find`로 세어 45로 되돌릴 여지가 있다 | `CLAUDE.md:146`에 "(진입점 README 제외)" 정도의 한정어 1개. PM 편집 가능 파일이라 즉시 처리 가능 |

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|------|----------|------|------|
| 무인 실행 안전성 | Windows에서 드라이브 문자 대소문자·백슬래시 때문에 `pathToFileURL(realpathSync(argv[1])).href === import.meta.url` 비교가 어긋난다 | 기각(단, 실측 아님을 명시) | Node는 ESM 메인 진입점의 URL도 `toRealPath()` → `pathToFileURL()` 순으로 만들고, 이 가드도 **같은 두 함수를 같은 순서로** 쓴다 — 양쪽이 동일한 정규화를 통과하므로 드라이브 문자 케이싱·구분자·UNC 표기가 어긋날 여지가 구조적으로 없다. **Windows 실기동 실측은 못 했다**(환경 없음, 코드 경로 분석 근거) |
| 스크립트-문서 정합성 | 사유서·validator에 새로 적힌 `20,747 B`가 실제 파일 크기와 다르다 | 기각 | `wc -c malgn-agent/agents/evaluator.md` = 20747, `docs/refactor/evaluator-budget-rationale.md:5`·`scripts/validate-agent-assets.mjs:83` 모두 동일. `pnpm run check-assets`가 `INFO [BUDGET_RATIONALE_OK] … 변호 20.3 KB`로 확인 |

## 페르소나별 관점

### [persona-enforcement-gap-auditor] — 판정: 🟠 Amber
- **§3 대응은 성립한다(PASS)**: 신규 등급고정 항목(`:53`)이 지시하는 "아래 3)의 Sensitive 행(merge 금지·사람 승인 필수)"은 `evaluator.md:98-101`에 문면 그대로 실재하고, 같은 규칙이 `:14`·`:28`(역할 경계)에도 이미 있어 삼중으로 물린다. **판정축을 추가했는데 그 결과를 받을 자리가 없는 "반쪽 수정"은 아니다.**
- 기존 항목과의 중복 없음: `:28`/`:98-101`은 "Sensitive면 merge 금지"라는 **결과**만 정의했고, "어떤 변경이 Sensitive인가"라는 **트리거 판정**은 evaluator 본문 어디에도 없었다. 신규 항목이 그 공백을 정확히 메운다.
- 그러나 M-02: 신규 4항목 중 하나가 자기 제품을 FAIL시킨다. 강제력을 세운 것까지는 옳으나 **경계선을 긋지 않은 강제력은 무시되거나 오반려로 귀결**된다.
- m-02: 4항목 중 1개만 판정문이 아니라 절차 지시라 `:46` 규약과 형식이 어긋난다.

### [persona-field-executability-officer] — 판정: 🟡 Amber
- 신규 항목이 담은 명령 3개를 그대로 쳐봤다. `grep -n "Skill \`\|skills/" <파일>`(`:68`)은 **정상 동작한다** — 셸 이중따옴표 안의 `\``가 리터럴 백틱으로, `\|`가 BRE 대체로 넘어가 `knowledge/leadership/team-composition-patterns.md:123`을 실제로 잡았다(백틱이 명령치환으로 새지 않는다).
- `grep -n "승인" <파일>`(`:58`)도 devops/security/marketer/finance 4개 전부에서 검출(각 2/12/7/1건). 육안 대조 결과 `devops.md:38`·`marketer.md:17,28`·`security.md`는 전용 "승인 게이트" 항목, `finance.md:26`은 호출자 줄 안에 "PM이 사람 승인을 받은 뒤에만 실행으로 이어진다"로 서술 — **네 파일 모두 항목을 통과한다**(항목이 자기 제품에서 실행 가능하고 만족 가능함을 확인).
- 유일한 실패: `grep -r <핵심 키워드> skills/`(m-01).

### [persona-unattended-agent-runtime-safety-auditor] — 판정: 🟢 Green (m-04 조건부)
- 오발동 = 전 직원 수집의 **무증상 정지**이므로 여기를 가장 세게 봤다. 가드 로직을 문자 그대로 복제한 픽스처로 재현: 절대경로 ✅ MAIN / 상대경로 ✅ MAIN(Node가 argv[1]을 절대화) / 파일 심볼릭링크 ✅ MAIN / 디렉터리 심볼릭링크 ✅ MAIN.
- 스케줄러 등록 경로 추적: `install-usage-agent.mjs:30`(`SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))`) → `:31 REPORT_SCRIPT` → plist `:88` / schtasks `:139` / cron 안내 `:166`. 셋 다 **Node가 이미 realpath로 해석한 절대경로**라 심볼릭 링크를 타지 않는다 → 가드 반드시 발동.
- 폴백 `catch` 분기의 의미는 **의도대로다**: `realpathSync`가 던지는 경우는 경로 정규화 자체가 불가능한 상황(존재하지 않는 경로 등)뿐이고, "정규화는 됐는데 값이 다르다"는 예외가 아니라 정상 `false` 반환이라 폴백을 타지 않는다. 즉 폴백은 "불일치 구제용"이 아니라 "정규화 실패 시 종전 동작 유지용"으로만 쓰인다.
- 남은 비대칭 1건은 m-04(스케줄러 경로에서는 성립 불가).

### [persona-hook-execution-safety-verifier] — 판정: 🟠 Amber
- 자기보고를 받지 않고 픽스처로 돌렸다. **M-01을 재현했다**(출력 3줄·exit 0 실측). 이 저장소 실물에서는 `check-docs` exit 0, `agents 21 / skills 38 / knowledge 44` 전건 일치 — **지금 상태는 정상**이며 문제는 앞으로 열린 경로다.
- 이 결함은 새것이 아니라 **한 번 절반만 닫힌 자리**다: 이전 라운드에 "전부 측정불가인데 ✅ 통과"를 지적해 `:382 allUnmeasurable` + exit 1이 들어왔지만 **부분 skip은 그대로 남았고**, 이번 변경이 거기에 "문서 리워딩"이라는 흔한 유발 경로를 붙였다.
- 소비자 회귀는 없다: `computeDrift()` 반환 필드(`results`/`drift`/`skipped`/`empty`/`corrupted`) 전부 불변이고 `expected` 값의 출처만 바뀌므로 `sessionstart-context.mjs:89-107`은 무수정 동작. `check-assets` ERROR 0 · WARN 18 · INFO 2로 기준선 동일.

### [persona-script-skill-consistency-auditor] — 판정: 🟡 Amber
- **하위호환은 코드로 확인했다**: `doc-drift.mjs:262-263`이 `docFile && docRegex` 유무로 분기해 정적 `expected` 경로가 그대로 살아 있고, `bin/check-output-conventions.mjs:93`은 파일명만 허용목록에 둘 뿐 매니페스트 키를 검증하지 않으므로 신규 키가 거부되지 않는다. **다른 프로젝트의 기존 매니페스트는 아무 영향도 받지 않는다.**
- 반면 새 문법을 **가르치는** 쪽은 미갱신(m-03). `doc-drift.mjs` 상단 주석만 정본이고, 실제로 매니페스트를 쓰는 사람이 읽는 두 자리(SKILL.md §6, `new-project.mjs` `_help`)에는 도달하지 않는다.
- 사유서 3중 실측 일치 확인(위 기각 표 참조).

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

`persona-dead-reference-scope-challenger.md`

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|----------|----------|------------|----------------|
| RT-01 | 문서가 숫자를 문장으로 주장하고, 감시기가 그 문장을 정규식으로 캡처해 코드 실측과 비교한다(문서→감시기 방향) | **코드 실측을 정본으로 두고 문서가 그것을 렌더링**한다 — `check-docs --write`가 `CLAUDE.md`의 해당 숫자를 직접 갱신(managed region과 같은 방식) | "문서가 주장하는 값"이라는 중간 개념 자체가 사라지므로 M-01의 실패 모드(문장을 고치면 감시가 꺼짐)도, D3가 고친 실패 모드(매니페스트 사본이 문서와 갈라짐)도 **둘 다 구조적으로 존재할 수 없게 된다.** 지금은 사본을 매니페스트에서 문서로 옮긴 것뿐이라 "사본이 두 벌"이라는 근본 형태는 남아 있다 | 중간. `CLAUDE.md`를 도구가 자동 편집하게 되므로 이 저장소의 "PM 편집 영역" 경계와 충돌 검토 필요. `hooks/`+`skills/project-standards` 동시 변경 → Sensitive. **변경 동결 중이라 백로그** |
| RT-02 | `skip`(측정 불가)이라는 한 단어가 두 상태를 겸한다 — ①이 호스트엔 해당 없음(정상, 예: `homeGlob` 타호스트) ②설정·문서가 썩음(비정상) | 매니페스트에 상태를 **선언적으로** 가른다 — `{"onMissing": "skip"}`(기본, 기존 동작 보존) vs `{"onMissing": "fail"}`. `docFile`+`docRegex`를 지정한 check은 지정 행위 자체가 감시 선언이므로 `fail`이 기본값 | 지금은 ①을 살리려다 ②를 놓치는 구조라, M-01을 고치려 해도 "일괄 승격하면 타호스트 오경보"라는 벽에 부딪힌다. 두 상태를 매니페스트가 직접 선언하면 그 트레이드오프가 사라지고, M-01이 국소 패치가 아니라 **구조적으로** 닫힌다 | 낮음. `hooks/doc-drift.mjs` 1파일 + 매니페스트 키 1개. 단 `hooks/` 변경이라 Sensitive — reviewer 풀패널 필요 |

## 트레이드오프 (페르소나 간 충돌)

- **M-02를 두고 강제력 감사관 ↔ 스코프 도전자**: 전자는 "예외를 명시해 항목을 좁혀라", 후자는 "그렇다고 Knowledge→Skill 포인터를 전면 허용하면 순환 참조를 감시할 게이트가 사라진다"고 본다. → **권고: 전면 허용도 전면 금지도 아니다.** "정본이 어디인지 선언하는 단방향 포인터"는 허용, "절차 본문 없이 Skill로 넘기기만 하는 위임형"은 FAIL로 문면을 좁힌다. `:51` 이식성 항목이 이미 같은 형식(허용 케이스 열거)을 쓰고 있으므로 새 서술 양식을 만들 필요도 없다.
- **M-01을 두고 훅 안전성 ↔ 운영 현실**: 전자는 "미매치를 실패로 승격", 후자는 "`homeGlob` 타호스트처럼 정당한 skip이 있어 일괄 승격은 상시 오경보"라고 본다. → **권고: 승격 범위를 `docFile`+`docRegex`가 명시된 check으로만 한정.** 이 조건이 곧 "이 문서를 감시하겠다"는 명시적 선언이므로 정당한 skip과 구분된다. RT-02를 채택하면 이 충돌 자체가 사라진다.

## 잘 된 점 (유지할 패턴)

- **D3의 전제가 실증으로 확인됐다.** `git show main:CLAUDE.md`의 `knowledge/ 44개`와 main 매니페스트의 `expected: 45`가 이미 갈라져 있었는데도 `check-docs`는 초록불이었다 — 감시기가 문서 원문을 애초에 읽지 않고 매니페스트 사본만 봤기 때문이다. 이 커밋이 그 무증상 드리프트를 실제로 해소했다.
- **glob 좁힘이 숫자 맞추기 편법이 아니다.** `knowledge/*/**/*.md`(44)는 `CLAUDE.md:146`이 스스로 선언한 "도메인별 디렉토리, 진입점 `knowledge/README.md`"라는 의미와 정합한다 — 실측 정의를 문서 의미에 맞춘 것이지, 문서를 실측에 맞춰 45로 고치는 반대 방향이 아니었다는 점이 옳다.
- **D2 주석이 "왜 realpath까지 정규화했는가"와 "가장 위험한 실패 모드가 무엇인가"를 코드 옆에 남겼다.** 다음 사람이 이 비교를 `import.meta.url === argv[1]`로 단순화하려다 전 직원 수집을 조용히 끄는 것을 막는다. 이 저장소의 "규칙이 생긴 이유는 현재형으로 남긴다" 원칙과도 맞다.
- **D1이 제품 본문 이력·식별자 금지 원칙을 지켰다.** 추가된 4항목에서 8자리 hex·ULID·날짜·`rubric §7.1` 인용 **0건**(diff 추가줄 전수 grep). 판정 근거를 rubric 문서로 넘기지 않고 "무엇을 어떤 명령으로 확인해 무엇이면 FAIL인가"로 자기완결하게 적어, `:75`가 약속한 "다른 조직이 malgn-agent만 설치해도 그대로 쓸 수 있다"는 이식성을 유지했다.
- **D2는 실제 importer가 0건인 상태에서의 예방적 하드닝이다**(`bin/`·`hooks/`·`scripts/` 전수 grep 결과 `report-usage.mjs`를 import하는 코드 없음). 회귀 표면이 사실상 없으면서, 에이전트가 함수 단위 점검을 위해 `import()`하는 순간 실전송이 나가는 경로를 미리 닫았다.

## 평가기준 충족 현황

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|------|------|-------|------|------|
| 신규 판정축이 §3 게이트와 문면으로 대응하는가 | 강제력 격차 | 필수 | ✅ | `:53` → `:98-101` 실재 |
| 신규 판정축이 기존 항목과 중복되지 않는가 | 강제력 격차 | 필수 | ✅ | 결과(merge 금지)는 기존, 트리거 판정은 신규 |
| 신규 판정축의 명령이 실행 가능한가 | 현장 실행가능성 | 필수 | ⚠️ | 3개 중 2개 정상, `:63` 경로 실패(m-01) |
| 신규 판정축이 자기 제품에서 만족 가능한가 | 강제력 격차 | 필수 | ❌ | `:58`은 4/4 통과, `:68`은 19/44 FAIL(M-02) |
| 제품 본문 이력·식별자 금지 준수 | 이식성 | 필수 | ✅ | 추가줄 전수 grep 0건 |
| 가드가 스케줄러 호출 경로에서 발동하는가 | 무인 실행 안전성 | 필수 | ✅ | 등록 경로 = realpath 절대경로, 4경로 픽스처 전건 MAIN |
| 폴백 분기가 의도대로인가 | 무인 실행 안전성 | 필수 | ✅ | 정규화 실패 시에만, 불일치는 대상 아님 |
| Windows 경로에서 비교가 어긋나지 않는가 | 무인 실행 안전성 | 필수 | ⚠️ | 코드 경로 분석상 안전, **실기동 실측 못 함** |
| 다른 매니페스트 소비자 회귀 없음 | 스크립트 정합성 | 필수 | ✅ | `computeDrift` 필드 불변, `sessionstart-context.mjs` 무수정 동작 |
| 정적 `expected` 하위호환 유지 | 스크립트 정합성 | 필수 | ✅ | `:262-263` 분기, 키 검증기 없음 |
| 새 문법이 소비자 문서에 도달하는가 | 스크립트 정합성 | 권장 | ❌ | m-03 |
| 감시 꺼짐이 게이트에 드러나는가 | 훅 실행 안전성 | 필수 | ❌ | M-01 |
| 정적 검사 기준선 유지 | 스크립트 정합성 | 필수 | ✅ | `check-docs` exit 0 / `check-assets` ERROR 0·WARN 18·INFO 2 |

## 생략한 관점 / 미확인

- **화면 리뷰 없음** — 대상이 전부 코드·문서라 UI가 없다. `docs/screenshots/` 캡처는 해당 없음.
- **Windows 실기동 미실측** — 실행 환경이 없어 D2 가드의 Windows 동작은 코드 경로 분석 근거만이다(위 기각 표 1번). schtasks 등록 문자열(`install-usage-agent.mjs:139`)의 중첩 따옴표 동작도 같은 이유로 미검증(이번 diff 범위 밖).
- **`report-usage.mjs` 실행 검증 미수행** — 실제 실행은 malgnai-hub로 실전송이 나가므로 리뷰에서 돌리지 않았다. 대신 가드 로직을 문자 그대로 복제한 픽스처로 6경로를 재현했다(PM이 격리 HOME에서 수행한 실측과 별개의 독립 확인).
- **`domain-training-scorecard-eval` 채점 미수행** — 이번 위임은 승격 판정이 아니라 다관점 리뷰다(승격 게이트 판정은 evaluator 소관).

## PM에게 권고

1. **M-01·M-02는 trainer에 반려한다**(둘 다 `hooks/`·`agents/` 아래라 PM 직접 수정 대상이 아니다). M-02는 문면 좁히기 1문장, M-01은 `doc-drift.mjs` 조건절 1개 — 둘 다 변경 동결의 "실증 가능한 결함 + 1파일 국소 수정"에 해당한다.
2. **M-01 수정은 `hooks/` 변경이므로 그 자체가 다시 Sensitive다** — 수정 후 reviewer 재검토(축소 모드)를 한 번 더 태우고, 반드시 양성 대조군(문서 문구 변조 → exit 1) + 음성 대조군(`homeGlob` 타호스트 → 여전히 skip·exit 0)을 함께 실측하게 한다.
3. **m-01·m-02는 M-02와 같은 파일이므로 한 번에 묶어 위임**하면 추가 사이클 비용이 0이다.
4. **m-03·m-04·n-01은 백로그**(깨진 것이 아니라 미완결·비대칭). 단 m-03은 M-01 수정 라운드에 끼워 넣으면 1줄씩이라 사실상 무료다.
5. **n-02(`CLAUDE.md:146` 한정어)는 PM 직접 처리 가능** — 저장소 루트 `CLAUDE.md`는 PM 편집 영역이다.
6. **RT-01·RT-02는 채택 판단을 미룬다** — 변경 동결 중이며 구조 변경이다. 다만 RT-02는 M-01의 근본 해법이므로, 동결 해제 시 M-01 국소 패치를 대체할 후보로 백로그에 함께 적어둘 가치가 있다.
7. 이 리뷰에서 **실행한 것은 읽기·검사·픽스처 실행뿐이다** — `git commit`/`checkout`/`merge`/`stash`, origin push, `gh pr create` 어느 것도 하지 않았다. 저장소에 쓴 파일은 이 보고서와 `docs/reviewer/personas/`(적용 이력 append 6건 + `INDEX.md` 재사용 열 갱신·라운드 노트)뿐이다.

---

# 재검증 (2차, 모드: 축소 · targeted)

target_id: `backlog-A-p0-defects-20260826` (1차 슬러그 `backlog-A-p0-defects` + 날짜 접미어 — 커밋 계보로 실질 동일 확인)
직전 리뷰: 위 1차 본문 (판정: 🟡 Amber / Major 2)
이번 리뷰 대상: `git diff d72c1ee..HEAD` — `58506e2`(M-01, `malgn-agent/hooks/doc-drift.mjs` +30/−7) · `d52dc4e`(M-02, `malgn-agent/agents/evaluator.md:68` 1줄 교체)
리스크 범주: **전역 자동실행 자산**(`hooks/` 매 세션 자동 실행) + **승격 게이트 거버넌스**(`agents/evaluator.md`) — 1차와 동일(불변 확인)
작업 등급: Sensitive
리뷰 일자: 2026-08-26
**종합 판정: 🟢 Green** — 직전 Major 2건 해소 / 신규 Critical 0 · Major 0 · Minor 2 · Nit 2. 병합 전 조치 1건(N-01).

모드 판정 근거: 풀패널 강제 승격 조건 5개 전건 미해당(①직전 Major를 겨냥한 수리 커밋 자체가 이번 대상이라 "미해결 존재"에 해당 안 됨 — 해소 여부를 이 라운드가 판정한다 ②새 실행경로·리스크 표면 없음(같은 2파일) ③하위도메인 동일 ④2차 ⑤PM이 오히려 targeted 축소를 명시 지시). 동일대상 4조건은 PM 판단을 신뢰하지 않고 직접 대조(동일 target_id · 같은 날 · 리스크 범주 불변 · 대상 파일 100% 중첩) → **축소(C) 모드**.

## 페르소나 재사용 판정 (산출물 게이트)

| 페르소나 | 판정 | 사유 |
|---|---|---|
| `personas/persona-hook-execution-safety-verifier.md` | **재사용** | 역할개념("전역 자동실행 코드를 자기보고가 아니라 실제 실행 결과로 검증")이 M-01 검증축과 동일. INDEX 12행 대조 |
| `personas/persona-enforcement-gap-auditor.md` | **재사용** | 역할개념("원칙이 체크리스트로 강제 가능한가")이 M-02 검증축과 동일. INDEX 23행 대조 |
| `personas/persona-field-executability-officer.md` | **재사용** | 새 문면이 담은 grep을 그대로 칠 수 있는지 확인하는 축. INDEX 15행 대조 |
| `personas/persona-script-skill-consistency-auditor.md` | **재사용** | 주석이 단정한 동작 ↔ 실행 실측 대조, 예산 사유서 정합. INDEX 20행 대조 |
| `personas/persona-dead-reference-scope-challenger.md` (발산형) | **재사용** | 1차 RT-01·RT-02가 이번 패치로 어디까지 닫혔는지 재질문. INDEX 36행 대조 |
| `personas/persona-unattended-agent-runtime-safety-auditor.md` | **미사용** | 이번 delta에 `bin/report-usage.mjs` 변경 0 — 무인 실행 표면 부재 |

**신규 0건.** INDEX.md를 착수 전 Read해 역할개념 열을 스크리닝했고, 이번 라운드에 새 리스크 표면이 없어 신규 작성 근거가 없다.

## 직전 Major 해결 여부

| ID | 직전 지적 | 해결 | 근거 |
|---|---|---|---|
| M-01 | `docRegex` 미매치가 부분 skip으로 처리돼 CLI가 `✅ 문서가 코드와 일치.` + exit 0을 찍는다 | ✅ **해소** | 픽스처 A/B 실행(아래 표) — 같은 픽스처에서 BASE(`d72c1ee`) exit 0·✅ / HEAD exit 1·⚠️ + 실패 항목 2줄 나열 |
| M-02 | `Knowledge→Skill 지시형 링크 금지`가 예외 미명시로 배포 중 knowledge 19/44를 FAIL시킨다 | ✅ **해소**(잔여 Minor 1) | 19파일 59줄 전건 대입 — 18파일 명백 PASS, 1파일만 판정 의존(m-05). 오반려 경로 제거 확인 |

## M-01 검증 상세 — 실행 근거

BASE 판본은 `d72c1ee`의 `malgn-agent/hooks/doc-drift.mjs`를 꺼내 `hooks/lib/find-pm-block-path.mjs`와 함께 스크래치패드에 배치해 import를 살린 뒤 실행했다(워킹트리 무변경). 픽스처 9종 전부 같은 프로젝트 골격(`src/a.js`·`src/b.js`, `DOC.md`에 "`src/` 2개")에 매니페스트만 바꿔 깔았다.

| # | 픽스처 | BASE(`d72c1ee`) | HEAD | 판정 |
|---|---|---|---|---|
| 1 | docCapture 정상 1 + **docRegex 미매치** 1 + **docFile 부재** 1 + homeGlob skip + 정적 skip | `(skip, 측정불가: docMISMATCH, docFileMISSING, homeGlobSkip, staticSkip)` + `✅ 문서가 코드와 일치.` **exit 0** | `(skip, 측정불가: homeGlobSkip, staticSkip)` + `⚠️ 문서 드리프트` + 실패 2줄 나열 **exit 1** | **양성 대조군 — M-01 닫힘** |
| 2 | 정적 expected 일치 + homeGlob 타호스트 + 정적 경로부재 | ✅ + exit 0 | 동일 | 무회귀 |
| 3 | 전량 측정 불가(정적) | `⚠️ 모든 체크가 측정 불가` exit 1 | 동일 | 무회귀 |
| 4 | docCapture 정상 + homeGlob 타호스트 | ✅ + exit 0 | 동일 | **음성 대조군 — 정당 skip 보존** |
| 5 | docCapture 정상인데 **코드쪽** 측정 불가 | `(skip)` + ✅ exit 0 | 동일 | 무회귀(코드쪽 null은 여전히 skip) |
| 6 | docCapture 실패 **+ 코드쪽도** 측정 불가 | `(skip)` + ✅ exit 0 | `⚠️ … 실측=측정불가` exit 1 | **의도된 유일한 추가 변화**(아래 판단) |
| 7 | 정적 expected 불일치 | ⚠️ + exit 1 | ⚠️ + exit 1(상세 1줄 추가) | 하위호환 유지 |
| 8 | `checks: []` | ℹ️ + exit 0 | 동일 | 무회귀 |
| 9 | 매니페스트 JSON 손상 | ⚠️ 손상 + exit 1 | 동일 | 무회귀 |

- **정당 skip 무회귀(검증항목 2)**: 9종 중 7종이 BASE와 출력·exit 동일. `homeGlob` 타호스트(#2·#4)와 정적 `expected` 경로(#2·#3·#7·#8·#9)는 `usesDocCapture`가 false라 새 분기에 진입조차 하지 않는다(`doc-drift.mjs:267`, `:277`).
- **#6의 성격**: `docFile`+`docRegex`를 선언한 check에서 문서·코드 양쪽이 모두 측정 불가일 때 BASE는 skip, HEAD는 drift(`실측=측정불가`)다. "감시하겠다고 선언한 대상을 못 읽는 상태"이므로 승격 취지에 부합하며, 오경보 위험은 낮다 — `docFile`/`docRegex`는 cwd 기준 저장소 내 경로라 `homeGlob`처럼 호스트마다 달라지는 성질이 없다.
- **실물 무영향**: 이 저장소에서 `node malgn-agent/hooks/doc-drift.mjs .` → agents 21/skills 38/knowledge 44 전건 일치, `✅` exit 0. `pnpm run check-docs` 동일.

### 검증항목 3 — `sessionstart-context.mjs` 무수정이 안전한가: **타당하다(수정 불요)**

- `computeDrift`의 유일한 프로그램 소비자는 `hooks/sessionstart-context.mjs:90-91`이다(`malgn-agent`·`scripts` 전수 grep — 다른 참조 0건). `bin/new-project.mjs`는 CLI를 자식 프로세스로 부르므로 exit code·stdout만 소비한다.
- 픽스처 #1에서 그 훅을 실기동한 결과: **exit 0**, 정상 JSON(`hookSpecificOutput.additionalContext`), 내용은 기존 드리프트 경고 포맷 그대로 2줄 추가. `systemMessage` 없음, 세션 차단 없음.
- 이 체감 변화(캡처 실패가 이제 세션 경고로 뜬다)는 **의도로서 타당하다**: ①`doc-drift.mjs:249-251`이 "훅은 세션을 막지 않고 계속 진행할 뿐이고, '조용히 통과하지 않는다'는 요구는 CLI의 exit code로 강하게 만족한다 — 사람이 실행하는 CLI와 자동 실행되는 훅의 실패 처리 강도를 의도적으로 다르게 둔다"를 이미 명문화했고, 이번 변경은 그 분업을 바꾸지 않는다. ②훅이 붙이는 비용은 2줄이며 그 2줄이 정확히 "감시가 꺼졌다"는 알려야 할 신호다. ③경고를 끄는 방법이 문서 문구를 고치는 것(=원인 제거)이라 신호와 조치가 일치한다.

## M-02 검증 상세 — 전건 대조와 과소탐지 판정

### 검증항목 1 — 오탐 소멸: knowledge 19파일 59줄 전건 대입

`grep -rlE 'Skill \`|skills/' malgn-agent/knowledge/` = 19파일(1차와 동일), 매치 라인 59줄(README.md 18 + 나머지 18파일 41줄). 새 문면의 통과 3종에 한 줄씩 대입한 결과:

| 유형 | 대표 실물 | 판정 |
|---|---|---|
| ① 정본 선언 | `knowledge/README.md`의 18줄 전부("…정본은 knowledge가 아니라 `skills/…`"), `common/agent-common-principles.md:15/19/23/27`("본문 정본은 `skills/…`, 배경만 남음"), `review/reviewer-personas.md:5`("서술이 다르면 스킬이 우선한다"), `review/screenshot-capture-guide.md:3`, `presentation/a4-document-fundamentals.md:8` | PASS |
| ② 범위 표시 | `a4-document-fundamentals.md:141/163/302`("이 문서에는 절차를 다시 싣지 않는다"), `design/ux-design-guide.md:130`, `architecture/system-design-patterns.md:4/5/16/17`, `common/token-efficient-collaboration.md:3/13` | PASS |
| ③ 관련 자산 안내 | `presentation/horizontal-slide-filling-techniques.md:63`("역할이 다름, 혼동 금지"), `quality/e2e-testing-guide.md:3`("이 둘을 혼동하지 않는다"), `leadership/agent-training-guide.md:146/148/153`, `leadership/autonomous-iteration-philosophy.md:68/69`, `proposal/proposal-writing-principles.md:81`, `design/personal-data-masking-standards.md:7/33` | PASS |
| 판정 의존(경계) | `leadership/team-composition-patterns.md:123` 1건 | m-05 참조 |

**1차 M-02가 지목한 오반려 경로는 사라졌다.** 18/19 파일은 해석 여지 없이 통과한다.

### 검증항목 2 — 과소탐지 여부: **(a) 의도적·타당한 좁힘**으로 판정. 단 문면에 잔여 공백 1건(m-05)

판정 근거로 표본 2개를 만들어 새 문면을 그대로 대입했다(스크래치패드 `samples/`, 저장소 밖).

| 표본 | 구성 | `:68`의 grep 결과 | 새 문면 적용 | rubric 원문 적용 |
|---|---|---|---|---|
| **S1** | 본문에 4단계 절차(로그 수집→분류→마이그레이션 문단→승인)를 실어둔 채 마지막 줄이 "따라서 릴리스 노트를 쓸 때는 Skill \`release-note-writing\`을 따른다." | `12:따라서 … Skill \`release-note-writing\`을 따른다.` | **FAIL** — "같은 절차를 자기 본문에도 실어둔 채 정본을 밝히지 않고 실행만 넘기는 줄"에 정확히 일치 | FAIL |
| **S2** | 절차 없이 배경만(왜 릴리스 노트가 필요한가) 쓰고 **같은 문장**으로 끝냄 | `9:따라서 … Skill \`release-note-writing\`을 따른다.` (S1과 **동일 문자열**) | 통과 3종 어디에도 없고 FAIL 문형(절차 중복)에도 해당 없음 → **판정 미정의** | FAIL |

- **grep은 두 표본을 구분하지 못한다**(같은 1줄을 뽑는다). 새 문면이 grep을 "후보 추출용"으로 격하하고 최종 판정을 본문 읽기로 넘긴 것은 이 실행 현실과 일치한다.
- **좁힘이 타당한 이유**: 이 항목이 내세우는 harm은 "두 서술이 갈리면 어느 쪽이 참인지 판별할 수 없다"이고, 그 harm은 **절차가 두 벌 존재해야** 성립한다. S2는 절차가 Skill 한 곳뿐이라 정본이 모호해지지 않는다 — 순환 참조도 생기지 않는다. 또한 rubric(`docs/methodology/agent-development-methodology.md`)은 이 저장소 `CLAUDE.md` Architecture 절이 "rubric v1.0 — 설계 이력 사료, **현행 판정 기준 아님**"으로 규정한 문서이므로, rubric 문면과의 불일치 자체가 결함 근거가 되지는 않는다. 판정 기준의 정본은 evaluator 체크리스트 본문이다(`evaluator.md:75`).
- **그럼에도 남는 것(m-05)**: 형제 항목 `:51`(이식성)은 허용 3종을 열거한 뒤 **"그 외(…)는 FAIL"**로 판정 공간을 닫는다. `:68`에는 그 닫는 문장이 없고 대신 FAIL을 한 문형으로만 정의해, S2처럼 **통과 3종에도 FAIL 문형에도 안 걸리는 줄**의 판정이 미정의로 남는다. 두 가지 읽기("PASS 집합이 게이트다 → 반려" vs "FAIL은 그 하나뿐이다 → 통과")가 모두 가능해 판정자마다 갈릴 수 있다.

### 검증항목 3 — `team-composition-patterns.md:123`을 통과로 처리한 근거: **방어 가능하나 얇다**(m-05와 같은 뿌리)

원문(`:123`): `> 위임·추적·검증의 실행 절차는 Skill \`project-orchestration\`을 따른다.`

- 통과 쪽 근거: "실행 절차는 Skill을 따른다"는 그 범주의 정본을 Skill로 지정하는 효과가 있고(①에 준함), 문서 나머지는 팀 구성·판단 기준이라는 배경 성격이다. 바로 위 `:100`은 "실행 절차 요약은 `agents/pm.md`의 …항목 참조"로 절차를 다른 곳에 명시적으로 넘긴다.
- 반대 쪽 근거(실측): 이 파일 본문은 `project-orchestration` SKILL과 **실제로 겹치는 서술**을 갖고 있다 — doc:100 경로 릴레이 ↔ `SKILL.md:169`, doc:113 "evaluator·reviewer는 항상 병렬" ↔ `SKILL.md:133`, doc:118 worktree 격리 ↔ `SKILL.md:183`, doc:119 "같은 목업/시드 엔티티 … 정본 데이터셋 선확정" ↔ `SKILL.md:176`. 또 `:123`에는 "정본"이라는 말이 없다(①의 예시 문형과 다르다). 즉 FAIL 문형의 두 요건(절차 중복 + 정본 미선언)에 근접한다.
- **판정**: trainer가 "판단이 갈릴 수 있다"고 밝힌 것은 정확한 자기진단이며, PASS 처리 자체는 방어 가능하다(겹치는 서술이 절차 재현이 아니라 원칙·판단기준 서술로 읽히고, 다른 곳으로 넘기는 포인터가 이미 있다). 다만 근거가 얇아 다른 판정자가 뒤집을 수 있다 — 이번 병합을 막을 사유는 아니고, 닫는 방법은 두 갈래다(체크리스트에 "그 외는 FAIL" 추가 / 또는 그 knowledge 줄에 "정본" 한 단어 추가). **둘 다 trainer 위임 대상이며 변경 동결 기준상 개선이라 백로그.**

## 이번 delta 신규 지적

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| N-01 | 🟡 | 스크립트-문서 정합성 | `scripts/validate-agent-assets.mjs:83`, `docs/refactor/evaluator-budget-rationale.md:5`, 워킹트리 상태 | `wc -c malgn-agent/agents/evaluator.md`(21,353) vs `d72c1ee`의 `scripts/validate-agent-assets.mjs`(`bytes: 20747`) + 워킹트리 상태 확인(두 파일 미커밋 수정) | 예산 사유서·validator의 실측 갱신분이 **워킹트리에만 있고 커밋되지 않았다.** 커밋된 상태만 병합하면 `21353 > 20747 + 512`(`RATIONALE_DRIFT_TOLERANCE_B`)라 `:124` 분기가 걸려 `BUDGET_RATIONALE_DRIFT` WARN이 뜬다 — 기준선 WARN 18·INFO 2가 WARN 19·INFO 1로 바뀐다. ERROR 0은 유지되므로 병합 차단 사유는 아니다 | **병합 전 두 파일을 같은 브랜치에 커밋한다**(둘 다 PM 편집 영역이라 위임 불요). 현재 워킹트리 값(21,353)이 실측과 일치함은 확인했다 |
| m-05 | 🟡 | 강제력 격차 | `malgn-agent/agents/evaluator.md:68` | 형제 항목 `:51`과 문형 대조 + 표본 S2 대입 | 허용 3종을 열거했으나 `:51`이 가진 **"그 외는 FAIL"** 닫는 절이 없어, 통과 3종에도 FAIL 문형에도 안 걸리는 줄의 판정이 미정의다(판정자마다 갈림). 실제로 `team-composition-patterns.md:123`이 그 구간에 놓인다 | `:51` 문형을 그대로 따라 "그 외는 FAIL" 1구절 추가(trainer 위임). **변경 동결 기준상 게이트는 작동하므로 결함이 아니라 개선 → 백로그** |
| n-03 | ⚪ | 훅 실행 안전성 | `malgn-agent/hooks/doc-drift.mjs:396-406` | 픽스처 #7 출력 | 일반 불일치가 per-check 줄(`⚠️ staticMismatch: 문서=9 실측=2`)과 하단 나열(`- staticMismatch: 문서=9 ↔ 실측=2`)로 두 번 표시된다 | trainer가 `:401-404` 주석으로 이미 인지·수용("틀린 정보가 아니라 상세 재확인"). 무해 — 참고만 |
| n-04 | ⚪ | 훅 실행 안전성 | `malgn-agent/hooks/doc-drift.mjs:398` | 픽스처 #6 출력 | 캡처 실패 + 코드쪽도 측정 불가일 때 헤더 문구가 "…**실측에 맞춰** 갱신하라"인데 그 실측이 `측정불가`라 안내가 약간 어긋난다(상세 줄이 `실측=측정불가`로 보완한다) | 참고만 |

**새로 발견한 Critical/Major: 없음.**

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 훅 실행 안전성 | 캡처 실패를 drift로 올리면 SessionStart 훅이 매 세션 경고를 띄워 노이즈가 된다 | 기각 | 훅을 픽스처 #1로 실기동해 실측: exit 0·정상 JSON·경고 2줄, 세션 차단 없음. `doc-drift.mjs:249-251`이 명문화한 "훅은 막지 않고 CLI가 exit code로 강하게"와 충돌하지 않으며, 경고 해제 방법이 곧 원인 제거(문서 문구 수정)라 신호와 조치가 일치한다 |
| 강제력 격차 | 새 문면이 rubric(`agent-development-methodology.md:102`)의 "절차 중복을 요구하지 않는다"와 어긋나므로 과소탐지 결함이다 | **강등**(Major → Minor m-05) | rubric은 `CLAUDE.md` Architecture 절이 "설계 이력 사료, **현행 판정 기준 아님**"으로 규정한 문서다. 또 표본 S2 대입 결과 빠져나가는 케이스는 정본이 한 곳뿐이라 이 항목이 방지하려는 harm(정본 판별 불가·순환)이 성립하지 않는다. 남는 실질은 "판정 공간이 안 닫혔다"는 문면 정밀도 문제 → Minor |
| 스크립트-문서 정합성 | `new-project.mjs:247` `_help`와 `project-standards/SKILL.md §6`이 `docFile`/`docRegex` 신문법을 여전히 안 가르친다(이제 실패 강도까지 달라졌으니 더 중요해졌다) | 기각(스코프 밖) | 1차 m-03과 동일 지적이며 PM이 백로그로 넘긴 항목이다. 이번 위임 범위(M-01·M-02 수리 검증) 밖이라 재상정하지 않는다 |

## 페르소나별 관점 (2차)

### [persona-hook-execution-safety-verifier] — 판정: 🟢 Green
- 자기보고를 받지 않고 BASE/HEAD 두 판본에 픽스처 9종을 A/B로 돌렸다. 양성 대조군 1건에서 M-01이 닫혔고, 음성 대조군 7건이 **출력·exit 동일**로 무회귀다. 추가 변화 1건(#6)은 승격 취지 안쪽.
- 소비자는 `sessionstart-context.mjs` 하나뿐이며 실기동으로 exit 0·비차단을 확인했다. 반환 필드 계약도 불변.

### [persona-enforcement-gap-auditor] — 판정: 🟢 Green (m-05 조건부)
- 19파일 59줄 전건 대입으로 1차 M-02의 오반려가 실제로 사라졌음을 확인했다. 특히 1차가 "금지 예시와 문장 형태가 같다"고 지목한 줄들이 전부 ①정본 선언에 정확히 해당한다.
- 다만 **강제력의 경계선을 그었으나 판정 공간을 닫지는 않았다** — `:51`에 있는 "그 외는 FAIL"이 `:68`에는 없다. 강제력 감사관 입장에서 이건 "닫히지 않은 게이트"지만, 1차 M-02(19/44 오반려)와 달리 지금 무엇이 깨져 있지는 않다 → Minor.

### [persona-field-executability-officer] — 판정: 🟢 Green
- 새 문면의 grep을 두 표본에 그대로 쳐서 **같은 1줄을 뽑는다**는 것을 실행으로 확인했다. grep을 판정기가 아니라 후보 추출기로 격하한 것은 실행 현실과 일치한다.
- 대신 판정이 "본문을 읽어 절차 중복 여부를 본다"로 바뀌어 실행 난이도가 올라갔다. 문면이 그 사실을 숨기지 않으므로 결함은 아니다.

### [persona-script-skill-consistency-auditor] — 판정: 🟡 Amber (N-01)
- 코드 주석이 새로 단정한 두 방향("선언 대상의 측정 불가는 승격 / 비선언 대상은 정당 skip")이 픽스처 9종 실행과 전건 일치한다.
- 정적검사 기준선 유지(`check-docs` exit 0 / `check-assets` ERROR 0·WARN 18·INFO 2) — **단 그 INFO 2는 워킹트리 미커밋분 덕분이다.** 커밋된 상태만 병합하면 WARN 19·INFO 1로 바뀐다(N-01).

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

`persona-dead-reference-scope-challenger.md`

| # | 1차 제언 | 이번 delta 이후 상태 | 권고 |
|---|---|---|---|
| RT-02 | `skip` 한 단어가 "이 호스트엔 해당 없음"과 "설정·문서가 썩음"을 겸한다 → 매니페스트가 `onMissing`으로 선언하게 하자 | 두 상태는 **실제로 갈렸다**(픽스처로 확인) — 다만 매니페스트 선언이 아니라 코드 안의 암묵 규칙(`usesDocCapture` 참/거짓)으로 갈렸다. 즉 문제 자체는 국소 패치로 실질 해소됐고, 남은 것은 "그 규칙이 매니페스트를 쓰는 사람 눈에 안 보인다"는 점뿐이다(`new-project.mjs:247`·`project-standards/SKILL.md §6` 미갱신 — 1차 m-03) | RT-02는 **하향**한다. 동결 해제 시에도 `onMissing` 신설보다 1차 m-03(문서 1~2줄)이 먼저다 |
| RT-01 | 코드 실측을 정본으로 두고 문서를 렌더링(`check-docs --write`) | 유효하다. "문서가 주장하는 값"이라는 중간 개념은 그대로 남아 있고, 이번 수리는 그 개념이 무너졌을 때 **조용히 넘어가지 않게** 만든 것이다 — 실패를 드러내는 개선이지 실패 모드를 없앤 것은 아니다 | 백로그 유지(구조 변경, 변경 동결 대상) |

## 잘 된 점 (유지할 패턴)

- **수리 범위를 지적이 요구한 만큼으로 정확히 한정했다.** `usesDocCapture`가 참일 때만 승격하고 `actual == null` 분기를 별도로 남긴 덕에, 음성 대조군 7종이 무회귀다. "일괄 승격하면 타호스트 오경보"라는 1차 트레이드오프를 문면 그대로 지켰다.
- **소비자를 고치지 않아도 되게 설계했다.** 기존 `hasDrift` 경로로 밀어넣어 CLI·훅이 공유하는 판정 경로를 그대로 타므로 변경 표면이 1파일에 머문다. 그 이유가 코드 주석(`:269-276`)에 현재형으로 남아 있어 다음 사람이 되돌리지 않는다.
- **M-02가 "전면 허용/전면 금지"의 양극 대신 1차 권고대로 `:51` 형식을 재사용했다.** 새 서술 양식을 발명하지 않아 판정자가 두 항목을 같은 방식으로 읽는다.
- **제품 본문 이력·식별자 금지 준수**: delta 추가줄 전수 스캔에서 8자리 hex·ULID·날짜·rubric 인용 **0건**.

## 평가기준 충족 현황 (2차)

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|---|---|---|---|---|
| 부분 미매치가 실패로 드러나는가 | 훅 실행 안전성 | 필수 | ✅ | 픽스처 #1 A/B(exit 0 → exit 1) |
| 기존 정당 skip이 보존되는가 | 훅 실행 안전성 | 필수 | ✅ | 픽스처 #2~#5·#7~#9 BASE=HEAD |
| 훅 소비자가 무수정으로 안전한가 | 훅 실행 안전성 | 필수 | ✅ | 실기동 exit 0·비차단, 반환 필드 불변 |
| 훅 체감 변화가 그 훅의 원칙과 충돌하지 않는가 | 훅 실행 안전성 | 필수 | ✅ | `doc-drift.mjs:249-251` 명문 분업과 일치 |
| 오탐이 사라졌는가(knowledge 전건) | 강제력 격차 | 필수 | ✅ | 19파일 59줄 대입, 18파일 명백 PASS |
| 원래 표적(순환참조형)을 여전히 잡는가 | 강제력 격차 | 필수 | ✅ | 표본 S1 = FAIL 문형 정확히 일치 |
| 판정 공간이 닫혀 있는가 | 강제력 격차 | 권장 | ❌ | m-05("그 외는 FAIL" 부재) |
| 새 문면의 명령이 실행 가능한가 | 현장 실행가능성 | 필수 | ✅ | 표본 2종에서 grep 정상 동작 |
| 정적검사 기준선 유지 | 스크립트 정합성 | 필수 | ⚠️ | 워킹트리 기준 유지, 커밋 기준은 N-01 |
| 제품 본문 이력·식별자 금지 | 이식성 | 필수 | ✅ | 추가줄 전수 스캔 0건 |

## 생략한 관점 / 미확인

- **1차 스코프 유지**: `bin/report-usage.mjs`(D2)·`bin/new-project.mjs`·`skills/project-standards/SKILL.md`는 이번 delta에 변경이 없어 다시 보지 않았다. 1차 판정을 그대로 유지한다(`persona-unattended-agent-runtime-safety-auditor` 미투입).
- **1차 Minor/Nit/Rethink 재상정 안 함** — PM이 백로그로 넘긴 항목이라 이번 병합 조건이 아니다(m-03·m-04·n-01·n-02는 다루지 않았고, RT-01·RT-02는 위 Rethink 표의 상태 갱신만 했다).
- **화면 리뷰 없음** — 대상이 코드·문서라 UI가 없다.
- **Windows 실기동 미실측** — 환경 없음(1차와 동일).
- **표본 S1·S2는 저장소 밖 스크래치패드에 만들었다** — 제품 파일을 오염시키지 않기 위함이며 저장소에 남기지 않는다.

## PM에게 권고

1. **M-01·M-02 모두 해소됐다. 🟢 Green — 병합 가능하다.** 다만 병합 전 **N-01 처리**(예산 사유서 `docs/refactor/evaluator-budget-rationale.md` + `scripts/validate-agent-assets.mjs` 워킹트리 수정분을 이 브랜치에 커밋)를 권한다. 둘 다 PM 편집 영역이라 위임이 필요 없고, 빠뜨리면 main의 `check-assets`가 WARN 19·INFO 1로 바뀐다.
2. **m-05는 백로그**(evaluator `:68`에 `:51`과 같은 "그 외는 FAIL" 1구절). 게이트는 작동하므로 결함이 아니라 개선이며, `agents/` 편집이라 trainer 위임 대상이다.
3. **`knowledge/leadership/team-composition-patterns.md:123`의 "정본" 한 단어 명시**도 같은 백로그에 묶을 가치가 있다 — m-05와 뿌리가 같고, 둘 중 하나만 해도 그 파일의 판정 흔들림은 사라진다.
4. **RT-02는 하향**한다(이번 패치로 실질 해소). 동결 해제 시 우선순위는 1차 m-03(신문법을 `_help`·SKILL.md가 가르치게 하는 1~2줄)이 먼저다.
5. 이 재검증에서 **실행한 것은 읽기·정적검사·픽스처 실행뿐이다** — 커밋·체크아웃·스태시·병합, origin push, PR 생성 어느 것도 하지 않았다. 저장소에 쓴 파일은 이 보고서 추가분과 `docs/reviewer/personas/`(적용 이력 append 5건 + `INDEX.md` 라운드 노트)뿐이다.
