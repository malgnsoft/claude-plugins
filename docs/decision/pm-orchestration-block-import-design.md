# PM 오케스트레이션 블록 전파 메커니즘 — `@import` 우선 + 드리프트 가드 설계

- 작성: architect (2026-08-10)
- 확정 방향(사용자 지시): **`@import` 우선 방식 + 경로 취약성은 드리프트 가드로 보완**
- 대상 코드: `malgn-agent/hooks/pm-orchestration-nudge.mjs`, `pm-orchestration-block.md`, `hooks.json`
- 선행 문서: `docs/decision/pm-orchestration-block-sync-strategy.md`(2026-08-10 오전, 훅 상시주입안 채택 근거) · `docs/reviewer/review-pm-block-propagation-mechanism-2026-08-10.md`(2026-08-10 재검토, "정체성 지속성" 회귀 지적)
- 코드 수정 없음 — 이 문서는 설계만 다룬다. 구현은 backend-dev.

## 0. 이 설계가 푸는 문제

기존 재검토(`review-pm-block-propagation-mechanism-2026-08-10.md`)는 두 요구사항이 서로 배타적이라고 결론 냈다:
- **정체성 지속성**: 내용이 CLAUDE.md에 물리적으로 존재해야 `/compact` 이후에도 자동 재주입되고(§1 실증 참조), 하네스의 강한 프레이밍(override)을 받는다.
- **stale-copy 회피**: 플러그인 원문이 개정되면 다음 세션부터 자동 반영돼야 하고, CLAUDE.md에 복사본이 남으면 안 된다.

`@import`는 원래 이 둘을 동시에 만족하는 유일한 방법이지만, 2026-08-10 오전 결정에서 "마켓플레이스 clone 경로가 사용자 로컬 설정에 따라 달라져 하드코딩이 깨진다"는 이유로 기각됐다. 이번 라운드에서 그 기각 사유 자체를 실증·재검증한 결과, **문제의 성격이 "깨진다/안 깨진다"가 아니라 "경로를 정적 상수로 하드코딩하면 깨질 수 있고, 매번 동적으로 탐색하면 깨지지 않는다"**는 것으로 재정의된다. 아래 §1이 그 근거다.

## 1. 로컬 실증 + 웹 검색 교차확인 결과

| 항목 | 확인 결과 | 근거 |
|---|---|---|
| 표준 설치 흐름(`/plugin marketplace add hopegiver/claude-plugins`)의 로컬 키 | `malgnsoft-plugins` — `marketplace.json`의 `name` 필드와 정확히 일치. `~/.claude/settings.json`의 `extraKnownMarketplaces.malgnsoft-plugins` + `enabledPlugins."malgn-agent@malgnsoft-plugins": true` 로 확인 | 로컬 실측(`cat ~/.claude/settings.json`) |
| 로컬 clone 디렉토리 | `~/.claude/plugins/marketplaces/malgnsoft-plugins/malgn-agent/` — 정확히 1개, 버전 번호 없음 | 로컬 실측(`find ~/.claude/plugins/marketplaces -name malgn-agent`) |
| **경로 취약성이 실재하는 경로**: 팀 전체 배포용 `.claude/settings.json`의 `extraKnownMarketplaces` | 공식 문서(discover-plugins)가 권장하는 팀 배포 패턴 자체가 **관리자가 임의로 고른 별칭 키**를 쓴다(예시: `"my-team-tools"`) — 이 별칭은 `marketplace.json`의 `name`과 무관하게 선택 가능. 즉 "커스텀 이름 등록 시 경로가 깨진다"는 2026-08-09 architect의 원 우려는 **사실이며, 오히려 공식 권장 배포 경로에서 발생 가능성이 더 높다** | WebFetch `code.claude.com/docs/en/discover-plugins` §"Configure team marketplaces" |
| 플러그인 런타임 캐시 경로 | `~/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/<version>/...` — **버전 번호 포함**, plugin.json 버전 변경마다 디렉토리명이 바뀜 → `@import`가 환경변수를 지원하지 않는 이상 이 경로는 애초에 하드코딩 대상이 될 수 없다(버전 릴리스마다 전사 CLAUDE.md를 다시 써야 함) | 로컬 실측 |
| `@import` 존재하지 않는 파일 처리 | **세션을 막지 않는다.** 조용히 스킵(콘텐츠 미로드), 에러·경고 없음 — 여러 공개 이슈(#56927 공백경로, PAI #1133 등)로 반복 확인된 플랫폼 공통 동작 | WebSearch, GitHub Issues #56927/#1041/#7768 등 교차확인 |
| **`@import` 대상이 프로젝트 작업 디렉토리 바깥일 때("external import")** | **최초 1회 승인 다이얼로그**가 뜬다. 거절하면 "the imports stay disabled and the dialog doesn't appear again" — 이후 그 프로젝트에서는 어떤 external import를 추가해도 다이얼로그가 다시 뜨지 않고 영구 비활성 상태로 남는다 | 공식문서 `code.claude.com/docs/en/memory` §Import additional files (2026-08 개정판, 이전 재검토에서 인용되지 않은 신규 사실) |
| 위 승인 상태의 저장 위치 | `~/.claude.json` → `projects["<절대경로>"].hasClaudeMdExternalIncludesApproved` (boolean) / `.hasClaudeMdExternalIncludesWarningShown` (boolean). 이 프로젝트(`claude-plugins`)는 현재 둘 다 `false`(아직 external import 없음) | 로컬 실측(`python3 -c "json.load(...)"`, `~/.claude.json` 62KB, 읽기 비용 무시 가능) |
| `/compact` 생존 여부 | **"Project-root CLAUDE.md survives compaction: after /compact, Claude re-reads it from disk and re-injects it into the session."** `@import`로 확장된 내용은 CLAUDE.md 로드 시점에 물리적으로 그 파일의 일부이므로 이 재주입 대상에 포함된다(반면 SessionStart 훅의 `additionalContext`는 이 재주입 경로에 없음 — 대화 히스토리 쪽에 얹혀 compaction 시 탈락) | 공식문서 `code.claude.com/docs/en/memory` §Troubleshoot memory issues, "Instructions seem lost after /compact" |
| HTML 주석 스트립 | CLAUDE.md의 block-level HTML 주석은 컨텍스트 주입 전 제거됨(이미 `pm-orchestration-block.md`가 상단에 버전마커 주석을 두고 있는 이유와 일치) | 공식문서 동일 페이지. `@import`로 확장된 파일 내부의 주석도 동일 규칙을 받는지는 미검증 — backend-dev 구현 후 `/context`로 스팟체크 권고(§6) |

**결론**: `@import` 기각의 원 사유(경로 하드코딩 취약)는 **"정적 상수로 하드코딩할 경우"에 한해 사실**이지만, 매 세션 파일시스템을 스캔해 실제 clone 위치를 동적으로 찾아내면(§2) 이 취약성 자체가 발생하지 않는다. 대신 이번 조사로 **원래 검토되지 않았던 새로운 실패 모드**(external-import 승인 다이얼로그 거절 시 영구 비활성)가 발견됐다 — 이것이 이번 설계의 핵심 리스크이며, 드리프트 가드가 정조준해야 할 대상이다.

## 2. 경로 탐색 알고리즘 (정적 하드코딩 대신 매번 동적 스캔)

`pm-orchestration-nudge.mjs`와, "예" 응답 시 CLAUDE.md를 Edit하는 Claude 세션 양쪽이 **동일한 절차**로 경로를 계산한다(하나는 감시용, 하나는 설치용 — 로직은 하나여야 드리프트 판정과 설치 결과가 항상 일치한다).

```
findMalgnAgentBlockPath():
  1. ~/.claude/plugins/marketplaces/*/malgn-agent/hooks/pm-orchestration-block.md 를
     글롭 스캔한다(마켓플레이스 로컬 별칭이 무엇이든 상관없음 — 별칭을 아예 몰라도 됨).
  2. 매치 0개 → null 반환 (마켓플레이스 미등록 또는 플러그인 미설치)
  3. 매치 1개 → 그 경로 반환 (표준 케이스, 로컬 실측상 현재 유일한 케이스)
  4. 매치 2개 이상 → ~/.claude/settings.json + .claude/settings.json + .claude/settings.local.json 의
     enabledPlugins 키 중 "malgn-agent@<별칭>" 패턴을 찾아 <별칭>과 일치하는 경로를 우선 채택.
     그래도 모호하면 "ambiguous" 상태로 취급(드리프트 가드가 경고, 임의 선택 금지).
```

이 알고리즘은 §1에서 확인된 "표준 설치는 항상 1개 매치"라는 실측과, "팀 배포 별칭이 다를 수 있다"는 문서상 리스크를 **동시에** 만족한다 — 별칭을 몰라도 파일시스템에서 직접 찾으므로 정적 하드코딩이 아예 필요 없다.

## 3. CLAUDE.md 표기 구조 — 마커(상태) + import(내용) 분리

```
<!-- malgn-agent:pm-orchestration:installed:v1 -->
@/Users/xxx/.claude/plugins/marketplaces/malgnsoft-plugins/malgn-agent/hooks/pm-orchestration-block.md
```

- **1번째 줄(마커)**: 기존과 동일한 역할 — 설치/거절 상태 + 동의 당시 버전을 기계가 판정하기 위한 신호. HTML 주석이라 컨텍스트에는 안 실린다(§1 스트립 규칙과 일치, 토큰 낭비 없음). 정규식은 기존 `STATE_MARKER_RE`를 그대로 재사용한다 — 마커 문법 자체는 바뀌지 않는다.
- **2번째 줄(`@import`)**: 신설. §2 알고리즘으로 계산한 **절대경로**를 그대로 쓴다(상대경로는 "import를 담은 파일 기준"으로 해석되므로 절대경로가 더 안전 — CLAUDE.md가 서브디렉토리에서도 로드될 수 있는 점 고려). 이 줄이 실제 내용 전달을 담당한다.

두 줄을 분리한 이유: 마커는 "동의 여부"라는 프로젝트별 결정을 담고, import는 "그 결정이 유효할 때 내용을 어디서 가져올지"를 담는다 — 별도 관심사라 같은 줄에 섞지 않는다. 거절 상태에서는 import 줄이 아예 없어야 한다(내용 주입 자체가 없어야 하므로).

## 4. 훅 로직 — 드리프트 가드 겸 안전망 (`pm-orchestration-nudge.mjs` 확장)

**핵심 원칙: `@import`가 "확실히 살아있다"고 확인될 때만 훅의 본문 주입을 끈다. 그 외 모든 경우(파일 없음/승인대기/거절됨/모호함/구버전 마커뿐인 프로젝트)는 기존처럼 훅이 `additionalContext`로 본문을 주입한다.** 이 하나의 규칙이 롤백 안전성(§6)을 구조적으로 보장한다 — 최악의 경우 현재 동작과 동일해질 뿐, 더 나빠질 수 없다.

의사코드(기존 `installed` 분기를 대체):

**분기 순서 주의**: `findMalgnAgentBlockPath()`(§2)는 매치가 2개 이상인데 `enabledPlugins`로도 하나로 못 좁히면 `null`이 아니라 전용 센티널 `AMBIGUOUS`(Symbol)를 반환한다. 이 `resolvedPath === AMBIGUOUS` 케이스를 아래처럼 **명시적으로 먼저 걸러내지 않고** `importLine !== resolvedPath`(문자열 vs Symbol 비교이므로 항상 참)로 흘려보내면, 그 분기 안의 `` `@${resolvedPath}` `` 템플릿 리터럴이 `TypeError: Cannot convert a Symbol value to a string`를 던진다. 훅 전체가 최상위 `try/catch`로 감싸여 있어 세션은 막히지 않지만, 이 경로에서는 `catch`가 곧바로 `emit('')`로 떨어져 **본문 주입까지 함께 스킵된다** — "훅은 항상 안전망으로 살아있다"(§6-2)는 불변식이 유일하게 깨지는 지점이다. 실제 구현(`pm-orchestration-nudge.mjs`)은 이 순서를 지키고 있다(2026-08-10 reviewer 실행검증, `docs/reviewer/review-pm-import-implementation-2026-08-10.md` RV-01) — 아래 의사코드도 그 순서로 갱신한다.

```js
if (state === 'installed') {
  const importLine = extractImportLine(claudeMd)   // 정규식: /^@(.+pm-orchestration-block\.md)\s*$/m
  const resolvedPath = findMalgnAgentBlockPath()     // §2 — null | AMBIGUOUS(Symbol) | 실경로 문자열

  if (!importLine) {
    // 구버전 마커만 있는 프로젝트(이번 설계 이전 설치) — 자동 마이그레이션 유도.
    // 사용자 재동의 불필요(콘텐츠 변경 아님, 전달 방식만 바뀜) — 넛지가 아니라 "그냥 하라"는 지시.
    emit(fullBodyInjection(block) + migrateToImportInstruction(resolvedPath))
  } else if (resolvedPath === AMBIGUOUS) {
    // import 줄은 있는데 마켓플레이스 후보가 2개 이상이고 enabledPlugins로도 특정 불가.
    // 반드시 다음 분기(importLine !== resolvedPath)보다 먼저 와야 한다 — 안 그러면 위 설명대로
    // 문자열과 Symbol을 비교해 항상 "드리프트"로 오판, rewriteImportInstruction 내부에서 TypeError.
    emit(fullBodyInjection(block) + ambiguousPathInstruction())
  } else if (!resolvedPath) {
    // import 줄은 있는데 파일 자체가 어디서도 안 찾아짐 — 마켓플레이스 제거/미등록
    emit(fullBodyInjection(block) + warnPluginMissingInstruction())
  } else if (importLine !== resolvedPath) {
    // 마커에 적힌 import 경로가 실제 계산 결과와 다름 = 드리프트(마켓플레이스 별칭이 바뀌었거나 오설치)
    emit(fullBodyInjection(block) + rewriteImportInstruction(resolvedPath, reason: 'path-mismatch'))
  } else {
    const { approved, warningShown } = readExternalImportState(cwd)  // ~/.claude.json
    if (approved) {
      emit('')   // @import가 이미 컨텍스트에 본문을 올렸다 — 중복 주입 금지
    } else {
      // 파일도 맞고 경로도 맞는데 다이얼로그 미승인/거절 상태
      emit(fullBodyInjection(block) + approvalReminderInstruction(warningShown))
    }
  }
}
```

`declined` 분기는 기존 로직(버전 비교 후 1회 재넛지)을 유지하되, 재넛지 시 "혹시 남아있는 import 줄도 함께 제거하라"는 지시를 추가한다(설치→거절 전환 시 정리 누락 방지, §5).

`readExternalImportState`/`findMalgnAgentBlockPath` 모두 try/catch로 감싸 어떤 이유로든 실패하면 `{approved:false}` / `null`로 안전하게 폴백한다 — 기존 "훅은 세션을 막지 않는다" 불변식을 그대로 유지한다(§6 재확인).

## 5. 넛지 문구 — "예/아니오" 응답 시 정확한 지시 (Major #2 재발 방지)

기존 버그 패턴(declined→installed 전환 시 옛 마커가 안 지워짐)을 이번에는 **마커 + import 줄 두 개 모두**에 대해 일반화해서 막는다. `askInstallNudge()`가 반환하는 지시문에 다음을 명시한다:

> "예" 선택 시:
> 1. `~/.claude/plugins/marketplaces/*/malgn-agent/hooks/pm-orchestration-block.md` 를 글롭으로 찾는다(Bash `find` 또는 Glob 도구). 0개면 설치를 진행하지 말고 마켓플레이스 미등록 사실만 사용자에게 알린다. 2개 이상이면 `~/.claude/settings.json`·`.claude/settings.json`·`.claude/settings.local.json`의 `enabledPlugins`에서 `malgn-agent@<별칭>` 키를 찾아 그 별칭과 일치하는 경로를 쓴다. 그래도 모호하면 사용자에게 되묻는다.
> 2. CLAUDE.md 전체에서 `<!-- malgn-agent:pm-orchestration:(installed|declined)?:?v\d+ -->` 형태의 줄(구버전 포함)과, `@`로 시작하며 `pm-orchestration-block.md`로 끝나는 줄을 **모두 찾아 제거**한다(몇 개가 있든, 어디에 있든).
> 3. 그 자리(또는 그런 줄이 없었으면 파일 끝)에 아래 두 줄을 **정확히 이 순서로** 삽입한다: 마커 줄, 그다음 줄에 `@<1단계에서 찾은 절대경로>`.
> 4. 사용자에게 알린다: "다음 세션(또는 이번 세션 재시작)에 이 경로에 대한 외부 파일 승인 다이얼로그가 뜰 수 있다 — 반드시 승인해야 규율이 실제로 적용된다. 거절하면 이 프로젝트에서는 조용히 계속 비활성 상태가 되며, 그 경우에도 매 세션 훅이 안전망으로 규율 본문을 계속 주입하니 기능 자체가 사라지지는 않는다."

> "아니오" 선택 시:
> 1. 2단계와 동일하게(구버전 포함) 마커 줄 + import 줄을 모두 찾아 제거한다.
> 2. 그 자리에 거절 마커 한 줄만 삽입한다(import 줄은 넣지 않는다).

이렇게 "찾아서 전부 제거 후 새로 쓴다"를 **모든 전환 경로에 대해 동일한 절차**로 명시함으로써, installed→declined든 declined→installed든 구버전 마커 잔존이든 하나의 규칙으로 커버한다.

## 6. 롤백 안전성 — 최우선 확인 결과

**결론: 이 설계는 세션을 막지 않으며, 최악의 경우에도 현재 동작(훅 상시주입)과 동일한 수준으로 저하될 뿐 그 이하로 떨어지지 않는다. 기각 대상 아니다.**

근거:
1. `@import` 대상 파일이 없으면 세션 로드는 실패하지 않고 조용히 스킵된다(§1, 다수 공개 이슈로 반복 확인된 플랫폼 공통 동작 — Claude Code 자체 버그가 아니라 문서화된 사양).
2. §4의 규칙("확실히 확인된 경우에만 훅 주입을 끈다")에 의해, `@import`가 어떤 이유로든 깨져 있으면(파일 없음/경로 드리프트/미승인/거절) 훅이 즉시 오늘과 동일한 `additionalContext` 전체 본문 주입으로 폴백한다. 즉 `@import`는 **이번 설계에서 유일한 전달 경로가 아니라 "성공하면 더 강한 지속성을 얻는 최적화 레이어"**이고, 훅 주입은 항상 살아있는 안전망이다.
3. 새로 발견된 리스크(external-import 승인 다이얼로그 거절 시 영구 비활성, §1)조차 "콘텐츠가 사라지는" 사고가 아니라 "지속성 이점만 못 받고 오늘 수준으로 남는" 사고다 — §4 로직이 이 상태를 정확히 감지해 안전망을 계속 가동한다.
4. 훅 스크립트 자신은 여전히 어떤 파일도 쓰지 않는다(기존 확정 안전장치 유지) — 마커/import 줄 쓰기는 전부 Claude가 Edit 도구로 수행(§5 지시문 경유), 훅은 감시·안내만 한다.

## 7. 기존 마커 체계와의 관계 (질문 3 답변)

- 마커(`installed:vN`/`declined:vN`)는 **여전히 필요하다** — "동의했는가"는 파일 존재 여부(`@import`)만으로는 판단할 수 없는 별도 상태다(예: 사용자가 명시적으로 거절했는데 실수로 import 줄만 남는 것을 막기 위해서라도 마커가 진실의 근거여야 한다).
- 구버전 마커(`installed:` 리터럴 없는 `:vN` 형태)의 하위호환은 그대로 유지 — 정규식 캡처 그룹 옵셔널 처리 변경 없음.
- `@import` 줄은 마커를 **대체하지 않고 보완**한다 — "이 두 줄은 항상 짝으로 다닌다(installed일 때만)"는 새 불변식이 추가될 뿐이다.
- 구버전(마커만 있고 import 줄 없는) 설치 프로젝트는 §4의 "구버전 마커만 있는 프로젝트" 분기가 다음 세션에 자동으로 §5의 "예" 절차를 트리거해 스스로 업그레이드한다 — 별도 마이그레이션 스크립트나 전 프로젝트 일괄 작업이 필요 없다. 사용자 재동의도 요구하지 않는다(전달 방식 변경일 뿐 규율 내용에 대한 새 동의가 아니므로).

## 8. 트레이드오프 요약 (①의무)

- **선택**: `@import`(경로는 매 세션 동적 탐색) 우선 + 훅 상시주입을 안전망 겸 드리프트 가드로 유지하는 이중 레이어
- **대안 A**: 순수 훅 상시주입 유지(2026-08-10 오전 채택안) — 장점: 이미 구현·검증됨, 별도 승인 다이얼로그 리스크 없음. 단점: "정체성 지속성" 회귀를 방치(재검토에서 지적된 Major #2 그대로 남음).
- **대안 B**: 순수 `@import`(정적 경로 하드코딩) — 장점: 가장 단순. 단점: §1에서 확인된 대로 팀 배포 별칭이 다르면 실제로 깨지고, 승인 다이얼로그 거절 시 감지·복구 수단이 전혀 없다. 기각.
- **대안 C**: 짧은 요약문만 CLAUDE.md에 물리기재 + 상세는 훅(직전 재검토의 하이브리드 권고) — 장점: 구현 비용 최소. 단점: 요약문과 상세 본문 두 벌을 계속 동기화해야 하는 새로운 이원화 부채가 생기고, "무엇을 요약문에 넣을지"가 향후 개정마다 재판단 대상이 된다.
- **포기한 것**: `@import` 실패 모드(특히 external-import 다이얼로그 거절)를 완전히 없애지는 못한다 — 다만 §4의 감지로 "조용히 사라지는" 실패를 "감지되고 안전망이 가동되는" 실패로 격하시켰다. 완전 무결한 단일 채널은 없다는 것이 이번 조사의 결론이다(재검토 문서와 동일 결론).
- **감당 방안**: 드리프트 가드(§4)가 매 세션 이 실패 모드를 재확인하고 안전망으로 즉시 폴백하므로, 사용자가 겪는 최종 결과는 "이번 설계 이전과 최소 동급, 성공 시 더 강한 지속성"이다.

## 9. backend-dev 구현 지시 (파일별)

1. **`malgn-agent/hooks/pm-orchestration-nudge.mjs`**
   - 신규 함수 `findMalgnAgentBlockPath()`: `~/.claude/plugins/marketplaces/*/malgn-agent/hooks/pm-orchestration-block.md` 글롭 스캔(§2 알고리즘). `readdirSync`/`existsSync` 조합으로 구현(doc-drift.mjs의 `countGlob` 패턴을 참고하되, 카운트가 아니라 "매치된 절대경로 배열"을 반환하도록 별도 함수로 작성 — doc-drift.mjs 자체는 손대지 않는다).
   - 신규 함수 `readExternalImportState(cwd)`: `~/.claude.json`을 읽어 `JSON.parse(...).projects[cwd]` 에서 `hasClaudeMdExternalIncludesApproved`/`hasClaudeMdExternalIncludesWarningShown`을 추출. try/catch로 감싸 실패 시 `{approved:false, warningShown:false}`.
   - 신규 정규식: `IMPORT_LINE_RE = /^@(.+pm-orchestration-block\.md)\s*$/m` (CLAUDE.md 내 기존 import 줄 탐지용).
   - `installed` 분기를 §4 의사코드대로 확장(파일없음/경로드리프트/미승인/정상 4가지 케이스 분기 + 각 케이스별 emit 문구).
   - `askInstallNudge()`(또는 신설 함수)에 §5의 "찾아서 전부 제거 후 새로 쓴다" 지시문을 반영(설치·거절 양쪽 모두).
   - 상단 주석(현재 L1-18)을 이번 설계로 갱신 — 특히 "훅은 파일을 쓰지 않는다" 불변식과 "언제 훅 본문 주입을 끄는지"의 정확한 조건을 명시.
   - 기존 `readBlockFile()`/`installMarkerFor()`/`declinedMarkerFor()`/`STATE_MARKER_RE`/`BLOCK_VERSION_RE`는 그대로 재사용(변경 불필요).

2. **`malgn-agent/hooks/pm-orchestration-block.md`**: 내용 변경 불필요. `@import`로도 직접 로드되는 파일이 됐다는 사실만 파일 상단 주석에 한 줄 추가 권고(향후 편집자가 "이 파일은 두 경로로 로드된다"는 것을 인지하도록).

3. **`malgn-agent/hooks/hooks.json`**: 변경 없음.

4. **`docs/decision/pm-orchestration-block-sync-strategy.md`**: 최상단에 "이 결정은 `pm-orchestration-block-import-design.md`(2026-08-10)로 대체됨 — `@import` 우선안 채택" 한 줄 포인터만 추가(재검토 Major #1이 지적한 "이전 트레이드오프가 조용히 증발"을 막기 위해, 문서 자체는 이력으로 보존).

5. **구현 후 검증(qa-engineer 또는 backend-dev 자체 스팟체크 권고, 코드 리뷰 게이트와 별개)**:
   - 실제 프로젝트 하나에 §5 절차대로 설치 → 세션 재시작 → external-import 승인 다이얼로그 실제로 뜨는지, 승인 후 `~/.claude.json`의 `hasClaudeMdExternalIncludesApproved`가 `true`로 바뀌는지, `/context`에서 import된 파일이 목록에 잡히는지 확인.
   - 같은 프로젝트에서 일부러 거절 → `warningShown:true, approved:false` 상태에서 훅이 안전망(전체 본문 emit)으로 정확히 폴백하는지 확인.
   - `pm-orchestration-block.md`의 선두 HTML 주석이 `@import` 경유 시에도 컨텍스트에서 스트립되는지(§1 마지막 행 미검증 항목) `/context` 또는 실측으로 확인.

## 정직 명시(생략한 것)

- 이번 설계는 실제 멀티턴 세션에서 `@import`가 실제로 "훅 additionalContext보다 준수율이 높은가"를 정량 측정하지 않았다 — 이는 직전 재검토(#3)가 이미 지적한 미검증 영역이며 이번 설계도 그 A/B 실험을 대신하지 않는다. 이 설계는 "정체성 지속성이 메커니즘상 다르다"는 문서화된 사실에 근거해 설계했을 뿐, 그 차이의 실질적 크기는 여전히 추정이다.
- `pm-orchestration-block.md` 내부 HTML 주석이 `@import` 경유 시에도 스트립되는지는 문서에 명시적으로 없어 §9의 검증 항목으로 남겨뒀다(스트립 안 되더라도 토큰 낭비 정도의 문제이지 기능 실패는 아니다).
- 팀 배포용 `.claude/settings.json` 기반 별칭 설치(§1의 "경로 취약성이 실재하는 경로")는 이 저장소에서 아직 실제로 채택되지 않은 가상 시나리오다 — §2 알고리즘이 이를 이미 커버하도록 설계했지만, 실제 팀 배포 전환 시점에 한 번 더 실측 확인을 권고한다.
