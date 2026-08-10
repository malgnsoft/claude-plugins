# PM 오케스트레이션 블록 `@import` 구현물 검증 — 풀패널 리뷰

- 리뷰 대상 등급: **Sensitive 등급 고정**(hooks/CLAUDE.md 부트스트랩 절 변경 — 등급 무관 Sensitive)
- WBS: `524b6650` 하위 `495e4fe9-a04f-4a87-adfd-b532b24c9db1` ("풀패널 리뷰 검증" 단계)
- 페르소나 패널(3, 이번 리뷰 전용 사전 작성분 재사용): `docs/reviewer/personas/persona-hook-execution-safety-verifier.md`(수렴형), `docs/reviewer/personas/persona-ops-drift-realist.md`(수렴형), `docs/reviewer/personas/persona-mechanism-zero-based-challenger.md`(발산형)
- 이 문서는 "택한 방식(@import 우선+훅 드리프트가드)의 **구현물**" 검증이다. "어느 방식을 택할지" 재검토는 `docs/reviewer/review-pm-block-propagation-mechanism-2026-08-10.md`(건드리지 않음, 별개 문서).

## 종합 판정: 🟡 **GO-with-fix**

- **Critical: 0건 / Major: 1건(문서 드리프트, 코드 자체는 안전) / Minor: 1건 / Rethink: 1건**
- 핵심 결론: `pm-orchestration-nudge.mjs`의 실제 동작은 직접 실행 검증(8개 시나리오, 아래 §실행검증) 결과 설계 스펙과 일치하고, 훅 파일쓰기 금지 불변식도 위반 없음. 다만 **backend-dev가 "자체 재정렬"이라고 보고한 분기 순서는 사실 스타일 선택이 아니라 설계 문서 §4의 의사코드를 문자 그대로 구현했다면 발생했을 크래시(Symbol→string 변환 TypeError)를 막는 필수 수정**이었다는 것을 실증했다(§1-3). 설계 문서 §4는 이 사실을 반영하지 않은 채 남아 있어 문서 드리프트 리스크가 있다 — 이것이 유일한 Major이며, **코드 커밋 자체를 막지는 않는다**(코드는 이미 옳게 구현됨). fix 대상은 설계 문서 쪽.

## 실행 검증 방법 (자체보고 신뢰 금지 원칙)

기존 로그(`/private/tmp/.../c3580869.../scratchpad/pmimport-test/`, 2026-08-10 20:00~20:03 생성, out\*.json 13개)는 `pm-orchestration-nudge.mjs`의 mtime(19:54:50)보다 늦게 생성되어 최신 코드를 테스트했을 개연성은 있으나, 동일 코드로 실행됐다는 결정적 증거(스크립트 사본·커맨드 로그)가 남아있지 않아 **재사용하지 않고 독립적으로 8개 시나리오를 새로 구성해 직접 실행**했다(`/private/tmp/.../1cf22071.../scratchpad/pmtest/`). 각 시나리오는 격리된 `HOME`/프로젝트 디렉토리를 만들어 `HOME=... node pm-orchestration-nudge.mjs`로 직접 실행하고 stdout JSON을 파싱해 대조했다.

| # | 시나리오 | 기대 분기(설계 §4 + 구현 우선순위 주석) | 실측 결과 |
|---|---|---|---|
| A | import 줄 없음, 마켓플레이스 1개 매치 | migrateToImportInstruction(실경로) | ✅ "[전달 방식 업그레이드 — 사용자 재동의 불필요]", `@<실경로>` 정확히 삽입 |
| B | import 줄 없음, 마켓플레이스 0개 매치 | migrateToImportInstruction(null) — 보류 | ✅ "[전달 방식 업그레이드 보류]" |
| C | import 줄 없음, 마켓플레이스 2개(ambiguous) | migrateToImportInstruction(AMBIGUOUS) — 보류 (①이 최우선이라는 구현 주석 검증) | ✅ "[전달 방식 업그레이드 보류]" — ambiguousPathInstruction으로 새지 않음 확인 |
| D | import 줄 일치 + 승인됨(true) | emit('') | ✅ 빈 문자열 |
| E | import 줄 일치 + 미승인(false) | approvalReminderInstruction | ✅ "[외부 import 승인 대기]", 3회 반복 실행 모두 동일(반복성 확인) |
| F | import 줄 존재, 값 드리프트(실파일은 다른 곳에 존재) | rewriteImportInstruction | ✅ "[경로 드리프트 감지]" |
| G | import 줄 존재, 파일 어디서도 못 찾음 | warnPluginMissingInstruction | ✅ "[플러그인 원본 파일을 찾을 수 없음]" |
| H | import 줄 존재, resolvedPath가 AMBIGUOUS | ambiguousPathInstruction | ✅ "[경로 확정 불가 — ambiguous]", 2회 반복 동일 |
| I | (추가) 마켓플레이스 2개 + `enabledPlugins`에 별칭 1개만 활성 | 그 별칭 경로로 확정 → migrate 지시문에 그 경로 삽입 | ✅ `aliasY` 경로로 정확히 확정(팀배포 별칭 리스크 §2 알고리즘 실제 해소 확인) |

정적 분석: `grep -nE "writeFileSync|appendFileSync|fs\.write|unlinkSync|rmSync|renameSync|writeFile\("` → **0 매치**(파일쓰기 금지 불변식 유지 확인).

## 페르소나별 관점

### 1. 훅 실행 안전성 검증가 (수렴형) — 판정: 🟢 Green (조건부, §1-3 참조)

- **[검증 완료] 8개 분기 모두 실행 결과가 기대값과 정확히 일치**(위 표). "일치+승인" 단 한 케이스만 `emit('')`이고 나머지 5개 케이스는 전부 본문 주입 — 필수 기준 충족.
- **[핵심 발견, RV-01] backend-dev의 "분기 순서 자체 재정렬" 자체보고는 사실이지만, 그 성격은 "취향"이 아니라 "필수 버그 수정"이다.** 설계 §4 의사코드를 문자 그대로 구현했다면 순서는 `!importLine → importLine!==resolvedPath → !resolvedPath → else`이며, 이 순서에는 `resolvedPath===AMBIGUOUS`를 위한 명시적 분기가 없다. 이 경우 `importLine`(문자열)과 `resolvedPath`(Symbol)를 비교하는 `importLine !== resolvedPath`가 항상 참이 되어 `rewriteImportInstruction(AMBIGUOUS)`가 호출되고, 그 안의 템플릿 리터럴 `` `@${resolvedPath}` ``가 **`TypeError: Cannot convert a Symbol value to a string`를 던진다**(직접 재현: `node -e "\`@\${Symbol('x')}\`"` → 동일 에러). 스크립트 전체가 최상위 `try{...}catch{emit('')}`로 감싸여 있어 세션 자체가 막히지는 않지만(크래시 아님), **이 경로에서는 본문 주입까지 함께 스킵되어 "훅은 항상 안전망으로 살아있다"(설계 §6-2)는 불변식이 유일하게 깨지는 지점이 된다.** 실제 구현은 `resolvedPath === AMBIGUOUS`를 최우선 분기 중 하나로 명시적으로 처리해 이 문제를 이미 피해가고 있다(코드 289-296행) — 즉 **오늘 구현된 코드는 안전하다.** 다만 설계 문서 §4는 이 필수 분기를 반영하지 않은 채 남아 있어, 향후 누군가 "설계 문서를 다시 정본 삼아" 코드를 리팩터하면 이 크래시-후-침묵 버그가 재도입될 수 있다.
  - **fix 권고**: `docs/decision/pm-orchestration-block-import-design.md` §4 의사코드에 `resolvedPath === AMBIGUOUS` 명시 분기를 추가하고, "이 순서가 아니면 Symbol→string TypeError로 안전망이 침묵 실패한다"는 이유를 주석으로 남길 것. 코드 커밋을 막을 필요는 없음(코드는 이미 옳음) — 문서만 별도로 빠르게 보완 권고.
- **[확인] readExternalImportState/findMalgnAgentBlockPath 예외 폴백** — `~/.claude.json` 없음/파싱실패/`~/.claude/settings.json` 손상 등은 모두 try/catch로 감싸져 있고, 시나리오 B/G(매치 0개), H(2개 모호)에서 각각 `null`/`AMBIGUOUS`로 안전 폴백함을 실측 확인.
- **[확인] 팀배포 별칭 해소(시나리오 I)** — `enabledPlugins`의 `malgn-agent@<별칭>` 매칭 로직이 실제로 동작해 2개 후보 중 1개로 정확히 좁혀짐을 확인.

### 2. 운영 드리프트 현실주의자 (수렴형) — 판정: 🟢 Green

- **[확인, RV-02] `hooks.json` 무변경 주장 — 실제로 사실.** `git diff -- malgn-agent/hooks/hooks.json` 출력 없음(exit 0, diff 0줄). 설계 문서·구현 양쪽의 자체보고와 일치.
- **[확인, RV-03] `pm-orchestration-block-sync-strategy.md` 이력 보존 — 사실.** `git diff`로 라인 단위 대조한 결과 변경분은 최상단에 `> **[대체됨]** 이 결정은 ... import-design.md(2026-08-10)로 대체됨 ... 아래 본문은 이력 보존을 위해 그대로 둔다.` 인용문 1개 블록(+2줄) 추가뿐이고, 기존 본문(작성일·대상코드·배경·트레이드오프 등)은 전혀 삭제·수정되지 않았다. 직전 라운드 Major #1("이전 트레이드오프가 조용히 증발") 재발 방지 요구사항 충족.
- **[확인, RV-04] 승인대기/모호 상태의 반복 경고 여부** — 시나리오 E(미승인)를 3회 연속 재실행, 시나리오 H(ambiguous)를 2회 연속 재실행한 결과 매번 바이트 단위로 동일한 경고 문자열이 재생성됨(1회성 소실 아님) — "6개월 후에도 사용자가 결국 인지 가능"이라는 관심사 충족.
- **[확인, RV-05] 승인대기 안내문의 명확성** — `approvalReminderInstruction()`이 "승인 다이얼로그가 뜨면 사용자에게 승인하라고 안내할 것"과 승인 시 이점(정체성 지속성)·미승인 시에도 기능이 유지된다는 점을 모두 명시. "무엇을 해야 하는지"가 불명확하다는 지적 없음.
- **[정보, 이번 리뷰 스코프 밖이지만 발견됨]** 워킹트리의 루트 `CLAUDE.md`에 `<!-- malgn-agent:pm-orchestration:installed:v1 -->` 마커가 이미 (import 줄 없이) 존재한다 — STATUS.md 기록(decision `0eb2b270`)에 따르면 이번 `@import` 작업 이전, 구버전 방식으로 이 저장소 자신이 실사용 검증 차 설치한 것이다. 이는 정확히 시나리오 A(import 줄 없음, 매치 1개)에 해당하므로, 이 구현이 커밋되고 다음 세션이 시작되면 이 저장소 자신의 CLAUDE.md에 `migrateToImportInstruction`이 실제로 발동해 마이그레이션이 유도된다 — 별도 조치 불필요, 설계가 의도한 대로 정확히 동작할 상황이다(버그 아님, 참고 정보로 기록).

### 3. 전파 메커니즘 제로베이스 도전자 (발산형) — 🔵 Rethink

관심사: 오늘 세 번째 전환(오전 훅상시주입 → 재검토 회귀지적+하이브리드/@import 갈림 → 이번 @import+드리프트가드 구체화)이 "정말 이만큼 복잡해야 하는가". 이번 구현은 **마커+import+훅드리프트가드의 3중 레이어**이며, 코드상 새로 생긴 상태만 6개(무import/ambiguous-무import/ambiguous-유import/파일없음/드리프트/승인대기)다. 직전 재검토(`review-pm-block-propagation-mechanism-2026-08-10.md`)가 이미 권고했던 **대안 C(하이브리드: 2~4줄 요약문 물리기재 + 상세는 훅 상시주입)**는 이번 설계 문서 §8에서 "요약문과 상세 두 벌 동기화 부채"를 이유로 기각됐는데, 이번 리뷰의 실행 검증(§1)에서 드러난 사실을 대입하면 이 기각 논거는 재검토할 가치가 있다: 하이브리드의 "동기화 부채"는 `pm-orchestration-block.md`의 **의무 내용이 바뀔 때만**(버전 마커 증가 시에만, STATUS.md 이력상 2026-08-07 이후 두 달간 1회) 발생하는 저빈도 이벤트인 반면, 이번 3중 레이어는 **매 세션·모든 프로젝트에서 상시** 6개 상태 중 하나를 판정해야 하고, 그중 하나(ambiguous 분기 처리 순서)는 실제로 크래시 직전까지 갔다가 구현자가 즉흥적으로 막은 상태다(RV-01). 또한 이 저장소 자신의 `CLAUDE.md`가 이미 "## 역할 정의 — 이 세션은 이 프로젝트의 PM이다"라는 물리적으로 기재된 섹션을 몇 주째 운영 중이고 이 세션 자신의 시스템 프롬프트에서 `IMPORTANT: override` 프레이밍을 받는 것으로 실측 확인된다 — 즉 "핵심 지시문을 CLAUDE.md에 물리적으로 새기고 가끔 재동기화한다"는 패턴이 이 저장소에서 이미 별도 검증 없이 몇 주간 실전 가동 중인 선례다.

| 항목 | 현재 구조 (@import + 3중 레이어, 이번 구현) | 제안 구조 (대안 C 하이브리드 재조명) | 왜 더 나은가 | 예상 비용·리스크 |
|---|---|---|---|---|
| CLAUDE.md 기재 | 마커 1줄 + `@import` 1줄 | 마커 1줄 + 2~4줄 핵심 요약 지시문(예: "Standard 이상은 Agent 도구로 위임. 상세는 세션마다 자동 주입되는 본문을 따른다") | 정체성 지속성(IMPORTANT:override 프레이밍)을 이 저장소의 "역할 정의" 섹션과 동일한 방식으로 이미 검증된 경로로 확보. 새 개념(external-import 승인 다이얼로그, ambiguous 마켓플레이스, 경로드리프트) 자체가 발생하지 않음 | 요약문이 stale해지는 것은 "의무 내용이 바뀔 때만"(저빈도) — `pm-orchestration-block.md` 버전 마커 증가 이벤트에 맞춰 훅이 재넛지하면 됨(기존 declined 재넛지 로직과 동일 패턴 재사용 가능) |
| 훅 로직 상태 수 | 6개(무import/ambiguous×2/파일없음/드리프트/승인대기) + 정상(승인+일치) | 2개(설치/거절) — 기존 로직과 동일 복잡도 | 코드 분기가 적을수록 이번 리뷰가 발견한 것과 같은 Symbol→TypeError급 사각지대가 발생할 표면적 자체가 준다 | 구현 비용은 오히려 낮음(신규 함수 `findMalgnAgentBlockPath`/`readExternalImportState`/`IMPORT_LINE_RE`/`AMBIGUOUS` 센티널 전부 불필요) |
| 사용자 경험 | 승인 다이얼로그 1회(거절 시 프로젝트별 영구 비활성, 감지는 되지만 사용자가 "왜 정체성이 약한지" 이해하려면 승인/드리프트/ambiguous 개념을 알아야 함 | 다이얼로그 없음, 개념 추가 없음 | 전사 배포 대상(비개발 성향 포함 가능) 관점에서 이해해야 할 새 개념 수가 0 | 요약문 문구를 "무엇을 넣을지" 매 개정마다 재판단해야 하는 저비용 판단 부채는 남음(design §8도 인정) — 다만 이 비용은 architect 1인의 문서작성 비용이지 전사 사용자 인지 비용이 아님 |

**포기하는 것 명시(발산형 원칙)**: `@import`가 하이브리드보다 우월한 지점은 **상세 본문 전체**(요약문이 아니라 전문)가 IMPORTANT:override 프레이밍을 받는다는 것뿐이다 — 이번 리뷰는 "이 차이가 실제 PM 위임 준수율에 몇 %p 영향을 주는가"가 여전히 미검증(직전 재검토 #3과 동일 한계)이라는 점을 재확인한다. 즉 이번 3중 레이어가 사는 것은 "검증되지 않은 크기의 이득"이고, 치르는 비용은 "이번 리뷰에서 실측된, 실재하는 크래시-직전 사각지대와 6개 신규 상태"다. 이 트레이드오프가 이번 시점에 정말 필요한지 — 사용자가 이미 "확정 방향" 지시를 내린 사안이므로 **이번 구현을 막을 근거는 아니지만**, 다음 개정 사이클에서 재고할 후보로 명시적으로 남겨둘 것을 권고한다.

## 잘 된 점

- 훅 파일쓰기 금지 확정 안전장치가 이번 diff에서도 완전히 유지됨(정적 grep 0매치, §1).
- §2 팀배포 별칭 리스크가 실제로 해소됨을 실측 확인(시나리오 I) — 직전 재검토가 지적한 실패모드에 대한 구체적 방어.
- `sync-strategy.md` 이력 보존 처리가 직전 라운드 Major #1의 정확한 재발 방지 패턴을 따름.
- 3회/2회 반복 실행으로 확인된 경고 반복성 — "1회성으로 사라지는 경고" 리스크 없음.
- 롤백 안전성 주장(설계 §6, "최악의 경우 오늘과 동일 수준")이 실제 8개 시나리오 전부에서 실증됨.

## PM 권고

1. **코드(`pm-orchestration-nudge.mjs`, `pm-orchestration-block.md`, `hooks.json` 무변경, `sync-strategy.md` 포인터)는 커밋해도 안전** — Critical/Major 결함 없음.
2. **커밋과 함께 또는 직후, `pm-orchestration-block-import-design.md` §4 의사코드에 `resolvedPath === AMBIGUOUS` 명시 분기와 그 이유(Symbol→string TypeError 회피)를 반영할 것**(RV-01, 유일한 Major, 문서 전용 fix) — 다음 리팩터가 설계 문서를 정본 삼아 되돌리는 사고를 막기 위한 저비용 조치.
3. 발산형 Rethink(하이브리드 재조명)는 이번 구현을 막지 않으나, 다음 개정 사이클 후보로 WBS 또는 STATUS.md "진행 중/다음"에 명시적으로 남겨둘 것을 권고.
4. 이번 검증 과정에서 저장소 루트 `CLAUDE.md`의 기존 `installed:v1`(import 줄 없음) 마커를 발견했다 — 별도 조치 불필요(설계가 의도한 마이그레이션 경로로 다음 세션에 자동 처리됨), 다만 PM은 이 사실을 인지하고 있을 것.

## 정직 명시(생략/한계)

- 이 리뷰는 실제 Claude 세션에서 AskUserQuestion → Edit 도구 흐름 전체(§5 지시문을 읽은 Claude가 실제로 정확히 그대로 수행하는지)까지는 재현하지 않았다 — 훅의 emit 출력값 정확성만 실행 검증했고, 그 출력을 받아 실제 Edit을 수행하는 후속 세션의 준수도는 검증 범위 밖이다(설계 문서 §9의 "구현 후 검증" 항목과 동일한 한계).
- external-import 승인 다이얼로그의 실제 UI 동작(뜨는지, 승인 시 `~/.claude.json` 갱신되는지)은 이번 리뷰에서 실기동 재현하지 않았다 — 격리된 fake-HOME 환경에서 `~/.claude.json`의 `approved` 값만 미리 세팅해 훅의 "읽기" 로직만 검증했다. 실제 다이얼로그 자체의 실기동 확인은 설계 §9-5가 별도로 권고한 항목이며 이번 리뷰 스코프 밖이다.
