# STATUS.md 크기 검사 스크립트 번들 (trainer 초안) 리뷰 보고서

리뷰 페르소나 패널: persona-script-skill-consistency-auditor.md · persona-field-executability-officer.md · persona-enforcement-gap-auditor.md · persona-zero-based-redesigner.md (발산형)
리뷰 대상: 브랜치 `trainer/status-size-check-20260824` 커밋 `58bf24b` (worktree `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-a087e9ea4b6a792b5`)
 - `malgn-agent/bin/check-status-size.mjs` (신규, 197줄)
 - `malgn-agent/skills/project-standards/SKILL.md` (2곳, +3/-2)
리스크 범주: 전 직원 배포 자산(번들 실행 스크립트 신설 + 전 프로젝트 공통 표준 스킬 본문)
리뷰 일자: 2026-08-24
target_id: status-size-check / 1차(최초 리뷰 — PM 위임에 target_id 없음, 안전측 기본값)
종합 판정: 🟡 Amber — **조건부 반려(Major 2건 수정 후 재검토)**

## 요약 (2분 규칙)
스크립트 자체는 형제 `check-*.mjs` 3종의 스타일·무의존성·크로스플랫폼 관례를 정확히 따르고, 저장소 하드코딩도 없다(cwd 기준 + `path.join/resolve`, 공백 포함 경로·CRLF 실행 재현 확인). `pnpm run check-assets`는 이 worktree에서 **ERROR 0 · WARN 18**로, main 기준선(ERROR 0 · WARN 18)과 동일 — trainer 보고와 일치한다.
막는 것은 두 가지다. ①`--require`가 실패(exit 1)하면서 출력은 `SKIP`, JSON `status`도 `"skip"`이라 텍스트/JSON 계약이 종료코드와 모순된다. ②SKILL.md가 스스로 "반드시 있어야 하는 자리에서는 `--require`"라고 정해놓고, 정작 자기 체크리스트(:134)에서는 `--require` 없이 exit 0만 보므로 **STATUS.md가 없으면 SKIP이 통과로 집계된다** — 게이트가 열린 채로 배포된다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|-------|------|------|---------|------|--------|
| RV-001 | 🟠 Major | 정합성 | `bin/check-status-size.mjs:140-147` | `node check-status-size.mjs <빈디렉터리> --require` 실행 → `exit=1`인데 출력 첫 줄이 `SKIP  STATUS.md 없음 — 검사 대상 없음`. `--format json`도 `"status": "skip"` + exit 1 | 실패 경로가 자신을 "건너뜀"으로 표기한다. 출력 텍스트를 읽는 에이전트/사람은 통과로 오독하고, JSON `status`로 분기하는 자동화는 exit code와 반대로 판정한다 | `--require`가 켜져 있고 파일이 없으면 `status:'fail'`(reason `STATUS.md 필수인데 없음`), 텍스트도 `FAIL  STATUS.md 없음 — --require 지정`으로 분기. SKIP 표기는 `--require` 미지정일 때만 |
| RV-002 | 🟠 Major | 강제력 | `skills/project-standards/SKILL.md:134` | 같은 파일 :42 원문("반드시 있어야 하는 자리에서는 `--require`로 실패로 승격한다")과 :134 대조 + SKIP 시 exit 0 실행 확인 | 표준 준수 체크리스트는 STATUS.md가 **반드시 있어야 하는 자리**인데 `--require`가 빠져 있다. 잘못된 디렉터리에서 돌리거나 STATUS.md를 아예 안 만든 프로젝트가 exit 0으로 통과한다 — 자기 문서가 정한 규칙과의 자기모순 | :134를 `node "${CLAUDE_PLUGIN_ROOT}/bin/check-status-size.mjs" --require`로 바꾼다(RV-001 수정과 함께여야 출력도 FAIL로 보인다) |
| RV-003 | 🟠 Major | 강제력/도달 | `bin/new-project.mjs:204`, `:305` | `grep -rn "wc -c\|Get-Item" malgn-agent/` 전량 스캔 | 스캐폴더가 **새 프로젝트의 CLAUDE.md 본문과 완료 안내에 여전히 `wc -c STATUS.md` / PowerShell `(Get-Item ...).Length`를 심는다.** 이번 변경의 목적("바이트를 손으로 세지 않는다")이 신규 프로젝트에는 도달하지 않고, 오히려 제품이 두 가지 방법을 동시에 가르친다 | 두 곳의 수동 명령을 지우고 **Skill `project-standards` §3을 가리키게** 한다. 커맨드를 복제하면 안 된다 — `bin/`·생성된 사용자 파일에서는 `${CLAUDE_PLUGIN_ROOT}`가 치환되지 않는다(Skill `common-output-storage-and-path-management` §1-1: "그런 문서에는 커맨드를 두 벌로 싣지 말고 그 명령을 소유한 스킬을 가리킨다") |
| RV-004 | 🟠 Major | 실행가능성 | `bin/check-status-size.mjs:103` (`STATUS_MAX_BYTES`) vs `hooks/sessionstart-context.mjs:34` (`MALGN_STATUS_MAX_BYTES`) | `grep -roE "process\.env\.[A-Z_]+" malgn-agent/bin/*.mjs malgn-agent/hooks/*.mjs` — 제품 전체에 환경변수는 이 둘뿐 | 같은 파일(STATUS.md)을 다루는 유일한 선례가 `MALGN_` 접두어인데 신규 변수만 접두어가 없고, 이름은 접두어 하나 차이인데 의미는 다르다(3,000B 규약 게이트 vs 12,000B 주입 절단). 배포 후에는 개명이 파괴적 변경이 된다. SKILL.md에도 이 변수가 문서화돼 있지 않다 | 릴리스 전에 `MALGN_STATUS_SIZE_LIMIT` 등 접두어 있는 이름으로 바꾸고(또는 `--limit`만 남기고 환경변수를 제거), 남긴다면 SKILL.md에 한 줄 명시 |
| RV-005 | 🟡 Minor | 정합성 | `bin/check-status-size.mjs:6-7` | `hooks/sessionstart-context.mjs:12-25, 31` 원문 대조 | "SessionStart 훅이 STATUS.md를 **매 세션 통째로 주입**하므로"는 사실이 아니다. 훅은 기본 12,000B 상한으로 줄 경계에서 잘라 앞부분만 넣고 잘린 사실을 경고한다. 게이트의 존재 근거를 설명하는 문장이라 틀린 채로 두면 후임이 "절단 장치가 없다"고 오판한다 | "SessionStart 훅이 매 세션 STATUS.md 앞부분을 주입하므로"로 정정 |
| RV-006 | 🟡 Minor | 정합성 | `malgn-agent/README.md:97-98` | 해당 표 Read — `check-edge-api-security` / `check-output-conventions` / `check-wbs-warnings` / `diff-env-keys`는 등재, 신규 스크립트만 없음 | 사용자 대면 번들 스크립트 인벤토리에서 누락 — 설치 직원이 목록으로는 이 도구의 존재를 알 수 없다 | :98 행에 `check-status-size.mjs`를 추가("STATUS.md 크기 상한 점검") |
| RV-007 | 🟡 Minor | 유지보수 | `scripts/check-status-size.mjs`(저장소, 34줄) vs `malgn-agent/bin/check-status-size.mjs` | 두 파일 Read + `package.json:9` (`check-status`) | 같은 게이트의 구현이 둘이 됐고 이미 갈렸다(저장소판은 규칙 정본을 "CLAUDE.md → 새 세션 부트스트랩"으로, 번들판은 "Skill `project-standards` §3"으로 안내. 옵션·섹션 분해·json도 번들판에만 있다). 이 저장소가 자기 표준을 도그푸딩하지 않는 상태 | `package.json`의 `check-status`를 `node malgn-agent/bin/check-status-size.mjs`로 바꾸고 `scripts/check-status-size.mjs`를 삭제. **PM 소관 파일이므로 trainer 스코프 밖 — PM이 직접 처리하거나 별도 위임** |
| RV-008 | ⚪ Nit | 정합성 | `bin/check-status-size.mjs:122` | `--format json`의 `largestSections` 합계 vs `bytes` 비교(3629 vs 3628) | 끝 개행 때문에 `split('\n')`의 마지막 빈 원소가 1B를 더해 섹션 합계가 총 바이트보다 항상 1B 크다 | 마지막 빈 원소를 건너뛰거나, 개행 가산을 마지막 줄에서 제외 |
| RV-009 | ⚪ Nit | 정합성 | `bin/check-status-size.mjs:118` | 정규식 `^##\s+` 검토 | 코드펜스 안의 `## …`도 섹션 헤더로 계수된다. STATUS.md에서는 드물어 실피해는 낮다 | 펜스 상태를 토글로 추적하거나 현 상태 유지(비용 대비 이득 낮음) |

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|------|----------|------|------|
| 실행가능성 | 실행 비트가 없다(`-rw-r--r--`) — PATH에서 못 부른다 | 기각 | `ls -la malgn-agent/bin/` 실측: 형제 `check-edge-api-security.mjs`·`check-output-conventions.mjs`·`check-wbs-warnings.mjs` 전부 동일하게 실행 비트 없음. §1-1이 맨 명령어 실행을 금지하고 `node "..."` 형태를 정본으로 정했으므로 오히려 정합 |
| 정합성 | `printHelp()`가 치환된 절대경로를 인쇄해 §1-1 "치환값을 산출물에 옮겨 적지 않는다"에 저촉 | 기각 | 형제 3종(`check-edge-api-security.mjs:46`, `check-output-conventions.mjs:62`, `check-wbs-warnings.mjs:76`)과 **동일한 `process.argv[1]` 패턴**이고, 그 패턴은 직전 라운드가 맨 명령어 인쇄를 고치려고 의도적으로 도입한 정본이다(`scripts/validate-agent-assets.mjs:547-551`). §1-1의 해당 조항은 보고·기록 문서 대상 |
| 실행가능성 | 헤더 주석 :18 `node check-status-size.mjs [projectRoot]`가 맨 명령어라 §1-1 위반 | 기각(강등 후 제외) | 린터가 **선두 헤더 주석을 명시적 제외 구역**으로 두고 있고(`scripts/validate-agent-assets.mjs:519-525, 553-555`), 기존 `bin/*.mjs` 12개 헤더가 전부 같은 표기다. "헤더 12개 표기 통일"은 이미 별도 백로그 항목 — 이 초안만 다르게 요구할 근거 없음 |

## 페르소나별 관점

### [persona-script-skill-consistency-auditor] — 판정: 🟡 Amber
SKILL.md:42가 약속한 동작을 15개 시나리오로 실행 대조했다. 일치: 상한 초과 시 exit 1 + 감축 바이트 + `##` 섹션 큰 순 출력 / 인자로 다른 프로젝트 루트 지정 / STATUS.md 없으면 SKIP(exit 0). **불일치 1건이 RV-001**(`--require`가 exit 1이면서 SKIP으로 표기). 부수로 헤더 주석의 훅 동작 서술이 현행 훅과 어긋남(RV-005), README 인벤토리 미등재(RV-006)를 발견했다. `--limit`·`--format`·환경변수는 SKILL.md에 안 적혀 있으나 §1-1 정본 커맨드만 싣는 편이 본문 비용 면에서 타당해 결함으로 보지 않았다(단 RV-004의 환경변수는 예외 — 이름 자체가 문제).

### [persona-field-executability-officer] — 판정: 🟡 Amber
"이 줄을 그대로 쳐서 지금 실행되는가"만 봤다. SKILL.md:42·:134의 커맨드는 §1-1 정본 `node "${CLAUDE_PLUGIN_ROOT}/bin/<스크립트>.mjs"`와 **따옴표까지 문자 단위로 일치**한다(§1-1 원문 :58-61 대조). 공백이 든 디렉터리(`space dir/`)에서 실행 성공을 재현했고, 저장소 절대경로·`~/` 하드코딩은 없다(cwd 기준 + `path.resolve/join`, 셸 호출 0건 → Windows에서도 동일 동작이 성립할 근거 있음). CRLF 파일도 정상 계수하고 섹션 제목의 `\r`이 `trim()`으로 제거되는 것까지 확인했다. 남은 실행가능성 결함은 환경변수 이름(RV-004)과, 신규 프로젝트에서는 이 명령을 아예 배우지 못한다는 점(RV-003)이다.

### [persona-enforcement-gap-auditor] — 판정: 🔴 (개별 판정) → 통합 Amber
"검사 수단을 만들었다"와 "그 검사가 게이트로 물린다"는 다르다. 이번 초안은 전자만 달성했다. 체크리스트가 `--require` 없이 exit 0만 보므로 **STATUS.md 부재가 통과로 집계**되고(RV-002), 스캐폴딩 경로에는 반영이 없어 신규 프로젝트는 계속 수동 계수를 배운다(RV-003). 더 근본적으로, 규약 상한 3,000B를 넘겨도 제품 어디에서도 신호가 나지 않는다 — 훅은 12,000B까지 조용히 주입한다(RT-002). 즉 이 게이트는 여전히 "사람이 기억해서 돌릴 때만" 작동한다.

### [persona-zero-based-redesigner] — 판정: 🔵 (구조 제언, 아래 섹션)

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|----------|----------|------------|----------------|
| RT-001 | 사람/에이전트가 STATUS.md를 고친 **직후 기억해서** 별도 스크립트를 돌린다 | `hooks/sessionstart-context.mjs`가 이미 매 세션 STATUS.md를 읽고 `totalBytes`를 계산한다(`clip()`) — 3,000B 초과 시 `systemMessage` 한 줄을 덧붙인다. 스크립트는 "지금 얼마인지·어디를 줄일지" 진단용으로 남긴다 | 지금까지 `wc -c`가 안 돌아간 이유가 "명령이 불편해서"가 아니라 **아무도 그 시점에 기억하지 않아서**다. 명령을 자동화해도 호출 주체가 사람이면 같은 실패가 반복된다. 훅은 신규 파일 0개, 초과할 때만 출력이라 상시 비용 0, 도달률 100% | 훅은 전 직원 전 세션 자동 실행이라 변경 리스크가 높다(회귀 시 폭발반경 최대). 경고 피로 가능성 → 초과분이 클 때만/세션당 1회로 제한 필요 |
| RT-002 | 규약 상한 3,000B(스킬)와 훅 절단 상한 12,000B(기본값)가 4배 차이 나는 이중 기준 | 두 값을 한 곳에서 정의하고, 훅 절단 상한은 "사고 방지 최후선", 규약 상한은 "경고 임계"로 역할을 나눠 명시 | 지금은 3,000B를 넘겨도 12,000B까지 아무 일도 일어나지 않으므로 규약에 실효 강제력이 없다. 두 숫자가 왜 다른지 제품 어디에도 적혀 있지 않아, 다음 사람이 둘 중 하나를 "틀린 값"으로 보고 맞추려 들 위험도 있다 | 훅 수정 필요(RT-001과 동일 리스크). 문서만 정리하는 저비용 변형도 가능 |

## 트레이드오프 (페르소나 간 충돌)
- **강제력 감사관("훅으로 자동화하라") vs 실행가능성 검사관("훅은 전원 전 세션에 물리니 손대지 마라")**: RT-001은 도달률을 확실히 올리지만 폭발반경이 가장 큰 파일을 건드린다. → **권고: 이번 라운드에서는 채택하지 않는다.** 변경 동결 원칙상 이번 초안은 "결함 수정"으로 닫고, RT-001·RT-002는 백로그로 올려 사용자 판단을 받는다.
- **정합성 감사관("환경변수를 SKILL.md에 문서화하라") vs 토큰 예산**: 상시 비용인 스킬 본문에 옵션을 다 싣는 것은 낭비다. → **권고: 환경변수를 제거하거나(`--limit`로 충분) 이름만 고치고 문서화는 최소 1줄.**

## 잘 된 점 (유지할 패턴)
- **형제 스크립트 관례를 그대로 따랐다**: 셔뱅 + 블록 헤더 주석(목적·사용법·인자·종료코드) → `import fs/path` → `── CLI 인자 파싱 ──` 구분선 → `parseArgs` switch문 → 실행부. `check-output-conventions.mjs`·`check-wbs-warnings.mjs`와 구조가 1:1로 대응한다.
- **`printHelp()`의 `process.argv[1]` 패턴**을 채택해 직전 라운드가 고친 "맨 명령어 인쇄" 회귀를 재유입시키지 않았다.
- **§1-1 커맨드 표기를 따옴표까지 정확히 지켰다** — 신규 지시가 규약을 어기는 것이 흔한 실패인데 이번엔 없다.
- **결과를 3분기(OK / FAIL / SKIP)로 나누고 ENOENT만 SKIP, EISDIR·EACCES는 exit 2로 분리한 판단은 타당하다** — 실측으로 셋 다 재현했다. "파일이 없다"와 "읽을 수 없다"를 같은 통과로 뭉개면 게이트가 조용히 무력화된다. SKIP 메시지에 찾아본 절대경로를 찍어 오실행을 구분하게 한 것도 좋다.
- **초과 시 "어디를 줄일지"까지 준다** — `##` 섹션 바이트 순위 + "새 내용을 깎지 말고 오래된 항목을 내보내라"는 규약 자체를 재진술. 검사기가 판정만 하고 끝내지 않는다.
- **날짜 도장·경위 서술·식별자 0건** — `grep -nE '20[0-9]{2}-[0-9]{2}-[0-9]{2}|v1\.[0-9]|직전 라운드|이관|폐기'` 및 hex/ULID 스캔 모두 히트 없음.

## 평가기준 충족 현황

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|------|------|-------|------|------|
| 형제 `bin/check-*.mjs`와 스타일·관례 일치 | 정합성 | 필수 | ✅ | 헤더 주석 구성·`parseArgs` switch·구분선·`printHelp` SELF 패턴 일치 |
| Node 내장 모듈만 사용(신규 의존성 0) | 실행가능성 | 필수 | ✅ | `node:fs`, `node:path`만. `package.json` 무변경 |
| macOS/Windows 동일 동작 근거 | 실행가능성 | 필수 | ✅ | 셸/외부 명령 호출 0건, `path.join/resolve`, CRLF 계수 정상, `Buffer.byteLength` 사용 |
| 저장소 경로 하드코딩 없음 | 실행가능성 | 필수 | ✅ | cwd 기본 + 인자 override. 임시 디렉터리·공백 경로에서 실행 확인 |
| STATUS.md 부재 SKIP 판단의 타당성 | 강제력 | 필수 | ⚠️ | 기본 SKIP은 타당(`.gitignore` 대상이라 부재가 정상). 다만 `--require` 표기 모순(RV-001)과 체크리스트 미사용(RV-002)으로 게이트가 열림 |
| ENOENT 외 오류 exit 2 분리의 타당성 | 강제력 | 필수 | ✅ | EISDIR·EACCES 실측 재현, 전부 exit 2 |
| SKILL.md 커맨드 표기 §1-1 준수 | 실행가능성 | 필수 | ✅ | 원문 :58-61과 따옴표 포함 일치 |
| SKILL.md 서술 ↔ 실제 동작 일치 | 정합성 | 필수 | ⚠️ | 1건 불일치(RV-001) |
| 날짜 도장·경위 서술 미유입 | 제품 본문 규율 | 필수 | ✅ | 스캔 0건 |
| `pnpm run check-assets` ERROR 0 | 게이트 | 필수 | ✅ | worktree 직접 실행: ERROR 0 · WARN 18 = main 기준선과 동일(신규 WARN 0) |
| 변경의 도달(모든 안내 지점 반영) | 강제력 | 권장 | ❌ | `new-project.mjs` 2곳 미반영(RV-003), README 인벤토리 미등재(RV-006) |

## PM에게 권고

1. **반려 → trainer 재작업 (Major 2건, 이 diff 안에서 닫아야 함)**
   - RV-001: `--require` 실패 경로의 텍스트/JSON 표기를 FAIL로 분기
   - RV-002: SKILL.md:134 체크리스트에 `--require` 추가
2. **같은 라운드에서 함께 처리 권고 (Major 2건)**
   - RV-003: `new-project.mjs:204, 305`의 `wc -c`/PowerShell 안내를 Skill `project-standards` §3 포인터로 교체(커맨드 복제 금지 — §1-1)
   - RV-004: `STATUS_MAX_BYTES` 개명 또는 제거. **배포 후에는 파괴적 변경이 되므로 지금이 유일한 저비용 시점**
3. **저비용 동반 수정**: RV-005(헤더 주석 사실 정정), RV-006(README 표 1행)
4. **PM 직접 처리 항목(trainer 스코프 밖)**: RV-007 — `package.json:9`의 `check-status`를 번들 스크립트로 돌리고 `scripts/check-status-size.mjs` 삭제. 저장소가 자기 표준을 도그푸딩하게 된다
5. **백로그(변경 동결 원칙상 이번 라운드 채택 금지)**: RT-001(SessionStart 훅 임계 경고), RT-002(3,000/12,000 이중 기준 일원화)
6. **미확인/생략 명시**: Windows 실기동 검증은 **하지 않았다**(이 환경은 macOS). 크로스플랫폼 판단은 "OS 의존 호출이 없다"는 정적 근거 + macOS 실행 결과에 기반한 추정이다. 화면 리뷰는 해당 없음(CLI·문서 대상).
