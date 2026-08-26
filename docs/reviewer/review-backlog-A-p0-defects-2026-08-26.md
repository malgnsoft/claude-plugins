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
