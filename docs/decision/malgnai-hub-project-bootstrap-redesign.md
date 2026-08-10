# malgnai-hub 대상 프로젝트 부트스트랩 — STATUS.md 저비용화 (폐기 결정 원복)

- 작성: architect (2026-08-11, 원복 개정 — 같은 날 오전 작성된 "STATUS.md 폐기 + 훅 제거"안을 이 파일 자체에서 전면 대체한다. 옛 내용은 git 이력으로 조회 가능하다)
- 원복 근거: 사용자 직접 지시, malgnai-mcp `decision_add` id `7890dc69`.
- 범위: 오전 버전과 동일 — **malgn-agent가 만들어서 배포하는 산출물/스캐폴딩 로직만.** 이 저장소(claude-plugins) 자신은 `provider: malgnai-mcp`로 STATUS.md를 그대로 쓰고 있었고, 이번 원복으로도 처음부터 영향이 없다(오전 버전이 폐기하려던 것도, 지금 되살리는 것도 malgnai-hub 대상 프로젝트 쪽 이야기다).

## 0. 경위 — 왜 "폐기"에서 "저비용화"로 되돌아갔는가

**원래 계기(여전히 유효한 문제)**: 세션마다 STATUS.md가 전역 훅(`~/.claude/hooks/session-context.mjs`, 사용자 개인 설정)과 플러그인 훅(`sessionstart-context.mjs`)으로 **2번 중복 주입**되는 낭비가 실측됐다(issue `22789b9e`, decision `b6797f0f`). 이 문제 자체는 이번 원복 이후에도 사라지지 않는다.

**오전 결정과 그 재평가**: 오전에는 이 문제를 "STATUS.md 자체를 malgnai-hub 대상 프로젝트에서 폐기"하는 방향으로 풀었다(이 파일의 이전 버전). 그 문서 §8은 스스로 "STATUS.md가 제공하던 완전 자기완결적 로컬 스냅숏을 잃는다 — 이제 진행상태 확인은 malgnai-hub 가용성에 의존한다"는 손실을 정직하게 짚어뒀는데, 사용자가 재검토한 결과 **이 손실이 실제로는 감당 불가능한 손실**이었다는 결론에 도달했다. 사용자 코멘트 원문: "사실 status.md 읽고 쓰는데 토큰소모가 많다고 여겼는데 없을때 손해가 더 큰 것 같아."

**새 방향 — "폐기"가 아니라 "저비용화"**: STATUS.md는 유지하되, 쓰기/읽기 비용 자체를 낮추는 세 가지 조치로 원래 문제(중복 주입 낭비)를 완화한다:
1. YAML frontmatter 필드를 3개로 축소(§1)
2. 파일 전체를 1000토큰 이내로 상한(§2)
3. 재작성 트리거를 6가지로 명시 제한(§3) — 매 턴 갱신하던 관성 자체를 줄여 "쓰기" 비용을 낮춘다.

캡이 걸리면 중복 주입되더라도 최악 2×1000토큰 이하로 상한이 걸린다 — 이 저장소 자신의 현재 실측(약 1,844토큰, cl100k_base 근사, 2026-08-11 tiktoken 실측)보다도 낮은 수준이다. 즉 "훅 두 개가 겹쳐 도는 것" 자체는 이번 결정으로 없애지 않지만, 겹쳐 돌아도 감당 가능한 크기로 눌러두는 쪽을 택했다.

**부수 조치**: SessionStart 훅 제거 계획(오전 §0/§4, hooks.json 변경안)도 함께 철회한다(§4) — STATUS.md가 살아있으니 그 훅들이 원래 하던 일(자동 주입, PM 블록 넛지)도 다시 필요하다.

## 1. STATUS.md YAML frontmatter — 3필드로 축소

```yaml
---
provider: malgnai-hub
project_id: # 참고용 표시값 — 실제 도구 호출엔 repository_key만 사용됨(아래 비고)
repository_key:
---
```

기존(오전 버전 이전의 원본) 필드는 `provider`/`project_id`/`repository_id`/`repository_key`/`web_url` 5개였다. **`repository_id`/`web_url`을 제거**한다 — 근거(사용자 판단): 화면 링크(`web_url`)나 내부 DB id(`repository_id`)는 실사용 가치가 낮다.

### project_id 비고 — 검증된 사실과 왜 필드를 다시 빼지 않는지

사용자가 malgnai-hub 실제 서버 소스(`~/workspace/malgnai-public/server/dao/projects.js`)를 직접 열어 확인한 사실:
- `project_id`는 `(user_id, repository_id)` 조합으로 **직원별로 다르게 발급**된다 — 같은 저장소라도 직원 A/B가 각자 `project_bootstrap`을 호출하면 서로 다른 `project_id`를 받는다.
- malgnai-hub MCP 도구 10개는 전부 `repositoryKey`만 입력 파라미터로 받고, `projectId`는 어떤 도구에도 클라이언트 입력 파라미터로 존재하지 않는다.

즉 `project_id`는 실제 도구 호출에는 전혀 쓰이지 않는 **순수 표시/참고용 값**이다. STATUS.md는 git에 커밋되므로, 최초 커밋자 이후 다른 직원이 그 파일을 열어보면 자신의 실제 `project_id`가 아닌 값을 보게 될 수 있다 — 기능은 깨지지 않는다(어떤 도구도 이 값을 안 쓰므로) 하지만 오해 소지가 있어 필드 옆에 짧은 캐비어트 주석을 남긴다(위 YAML 블록 참고). 이 사실만으로 `project_id` 필드를 다시 빼는 것은 제안하지 않는다 — 사용자가 이미 3필드로 확정했다.

### repository_key 값 관례 — 권장안(이번 원복의 핵심은 아님, 후속 검토)

현재 `project-standards/SKILL.md`(§8)의 관례는 "폴더명 기반으로 제안하고 사용자 확인 후 확정"이다 — 전역 유일성을 보장하지 못한다(다른 팀이 같은 폴더명을 쓰면 충돌 가능). malgnai-hub 쪽 문서(`malgnai-public/docs/architecture.md:389`)의 예시는 `"malgnsoft/lms-core"`처럼 git remote org/repo 슬러그 스타일을 쓴다. **권장안**: `git remote get-url origin`에서 뽑은 `org/repo` 슬러그를 기본 제안값으로 쓰고, git remote가 없으면(로컬 전용 신규 프로젝트) 기존처럼 폴더명 기반 제안으로 폴백한다. 이번 결정에서 `project-standards/SKILL.md` §8을 이 방향으로 확정 개정하지는 않는다 — §6 Tier 2 후속 항목으로 남긴다.

## 2. STATUS.md 크기 상한 — 1000토큰

- 이 저장소 자신의 현재 STATUS.md 실측: 약 1,844토큰(cl100k_base 근사, tiktoken으로 직접 측정, 2026-08-11).
- **상한: 1000토큰.** malgnai-hub 대상 신규 프로젝트는 이 상한을 목표로 한다. (문자수 환산은 언어 구성(한글/영문 비율)에 따라 편차가 커서 — 한글은 영문보다 토큰당 문자수가 대체로 적다 — 이 문서에서 "약 O자"로 단정하지 않는다. 정확한 확인은 아래 측정 도구가 필요하다.)
- 기존 `project-standards/SKILL.md` §3의 압축 규율(완료 항목 1줄 요약+id, 완료 섹션 최근 5~7개만 유지)은 방향은 맞지만, 이 저장소 실측(1,844토큰)이 보여주듯 **그것만으로는 1000토큰을 못 지킨다** — 더 타이트하게 조여야 한다. 구체 조정안(trainer/qa가 실제 측정하며 확정 권고):
  - 완료 섹션 개수: 5~7개 → **3~5개**로 축소.
  - "진행 중" 섹션 재압축 규율(lesson `1f2d41b6`, 기존에 이미 있던 규율)을 더 강하게 적용 — append 금지를 원칙이 아니라 매번 즉시 압축으로.
  - 헤더 라인(정체성 한 줄)은 유지하되 부연 설명 문장은 최소화.
- **집행 수단(미확정, 후속)**: `.claude/doc-drift.json`에 STATUS.md 길이 체크를 추가하려면 `doc-drift.mjs`의 현재 측정 프리미티브(`glob`/`homeGlob`/`jsonLength`/`file`+`regex`)에 없는 **토큰 근사 측정**(`fileTokenApprox` 같은 신규 프리미티브)이 필요하다 — 이번 문서에서 그 구현 방식(문자수/4 근사 vs tiktoken 의존성 도입)까지 확정하지 않는다(§6 Tier 2). 1차 완화책으로 `sessionstart-context.mjs`가 이미 STATUS.md 원문을 읽고 있으므로, 그 파일 길이(문자수 또는 줄 수)를 emit 문구에 함께 표시해 PM이 스스로 압축 필요성을 체감하게 하는 정도는 이번 결정 없이도 가능한 개선이다(필수 항목은 아님, §6 Tier 1 비고).

## 3. STATUS.md 재작성 트리거 — 6가지로 제한

기존에는 "착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신"처럼 사실상 매 턴·매 작은 변경마다 갱신하는 관성이 있었다(`project-standards/SKILL.md` §3). 이번 원복에서 **재작성을 아래 6가지 상황으로 명시적으로 제한**한다 — 그 외 평범한 진행 중에는 STATUS.md를 건드리지 않는다:

1. 중요한 작업 완료
2. WBS 단계 변경
3. 중요한 설계 결정
4. blocker 발생/해결
5. 세션 종료
6. context compact 직전

이 목록은 **CLAUDE.md의 "새 세션 부트스트랩" 안내문**(아래 템플릿)과 **pm.md 개정 지침**(§7) 양쪽에 동일하게 명시한다 — 한쪽에만 있으면 다른 경로로 진입한 세션이 여전히 매 턴 갱신 관성을 반복할 수 있다.

### CLAUDE.md 템플릿 (new-project.mjs가 생성)

```markdown
## 새 세션 부트스트랩 (읽기 순서 = 토큰 예산)
- **L0 (자동 주입):** `STATUS.md`(라이브 상태, 1000토큰 이내 유지) + 이 `CLAUDE.md`(구조·규칙). → 대부분의 경우 이것만으로 충분.
- **L1 (필요할 때만 호출):** malgnai-hub `project_get_context`(project_id) 등 — L0로 충분하면 호출하지 않는다. 불필요한 호출은 토큰 낭비.
- **L2 (깊은 작업만):** `docs/README.md` 지도 → 필요한 문서만.

**STATUS.md 재작성은 다음 6가지 상황으로 제한한다** — 그 외 평범한 진행 중에는 건드리지 않는다:
①중요한 작업 완료 ②WBS 단계 변경 ③중요한 설계 결정 ④blocker 발생/해결 ⑤세션 종료 ⑥context compact 직전.
그 외에는 malgnai-hub `work_record`/`decision_record`/`issue_record`에만 기록하고 STATUS.md는 그대로 둔다 — STATUS.md는 "현재 스냅숏"이지 "매 턴 로그"가 아니다.
```

## 4. SessionStart 훅 복원 — 오전의 제거 계획 전부 철회

오전 버전이 세운 다음 계획을 **전부 철회**한다:
- ~~`hooks.json`에서 `SessionStart` 키 전체 삭제~~
- ~~`sessionstart-context.mjs` 삭제~~
- ~~`pm-orchestration-nudge.mjs` 삭제 + `findMalgnAgentBlockPath()`를 `lib/find-pm-block-path.mjs`로 이관~~
- ~~`new-project.mjs`가 스캐폴딩 시점에 PM 블록 `@import`를 1회 삽입(오전 버전 §3)~~
- ~~`doc-drift.mjs`에 `checkPmBlockImport()` 확장 추가(오전 버전 §4)~~

**복원 상태**: `hooks.json`은 원래 형태 그대로 유지한다 — 이번 결정에서 변경하지 않는다.

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/sessionstart-context.mjs\"" } ] },
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/pm-orchestration-nudge.mjs\"" } ] }
    ],
    "Stop": [
      { "hooks": [ { "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}/hooks/stop-mcp-reminder.cjs\"" } ] }
    ]
  }
}
```

`sessionstart-context.mjs`(STATUS.md 자동 주입 + doc-drift 경고)와 `pm-orchestration-nudge.mjs`(PM 블록 넛지 + 마켓플레이스 경로 드리프트 가드 — `pm-orchestration-block-import-design.md`의 원 설계 그대로)는 삭제하지 않고 기존 로직 그대로 유지한다. 이 두 훅에 대해 이번 문서는 별도 수정을 요구하지 않는다.

**`docs/decision/pm-orchestration-block-import-design.md`에 오전에 추가했던 "[malgnai-hub 대상 프로젝트 한정 대체됨]" 포인터도 이번 세션에서 제거한다** — 그 문서의 원 설계(`@import` 우선 + 훅 상시주입 안전망 이중 레이어)가 다시 그대로 유효해졌으므로 "대체됨" 문구는 지금 시점에 부정확하다.

## 5. L1(malgnai-hub 조회) — 다시 "선택적 호출" 원칙으로

오전 버전 §2는 "L0(STATUS.md)가 없어졌으니 L1이 사실상 필수로 격상된다"고 썼다 — 이 부분을 철회한다. STATUS.md가 살아있으므로 `project-standards/SKILL.md` §5의 원래 문구("L1 선택적 호출: 텍스트 검색이 필요하거나 다중 프로젝트 범위 필터링이 필요할 때만... 불필요한 호출은 토큰 낭비")가 **그대로 다시 유효**하다. §3의 CLAUDE.md 템플릿에도 이미 "L0로 충분하면 호출하지 않는다"로 반영했다.

`project_get_context`가 실제로 최근 상태(nextAction 등)를 반환하는지에 대한 미검증 사항(오전 버전 §2 말미)은 여전히 미검증이지만 **중요도가 낮아진다** — STATUS.md가 진행상태의 1차 소스로 복귀했으므로, 이 조회는 이제 "STATUS.md만으로 부족할 때의 보충 조회"다(§9).

## 6. 영향받는 파일 전체 목록

### Tier 1 — 핵심 메커니즘

| 파일 | 변경 |
|---|---|
| `malgn-agent/hooks/hooks.json` | **변경 없음**(오전 삭제안 철회 — 원본 그대로 유지). |
| `malgn-agent/hooks/sessionstart-context.mjs` | **변경 없음**(삭제 계획 철회). STATUS.md 실측 크기를 emit에 함께 표시하는 개선은 §2에서 언급한 선택적 후속 작업(이번 결정의 필수 항목 아님). |
| `malgn-agent/hooks/pm-orchestration-nudge.mjs` | **변경 없음**(삭제 및 로직 이관 계획 철회). |
| `malgn-agent/hooks/doc-drift.mjs` | **변경 없음**(`checkPmBlockImport` 확장 계획 철회). STATUS.md 크기 체크용 신규 프리미티브는 Tier 2 후속. |
| `malgn-agent/hooks/pm-orchestration-block.md` | **변경 없음**(오전 §6이 제안한 상단 주석 갱신도 철회 — 훅이 원래대로 유일한 전달 경로이므로 "두 경로" 서술이 필요 없다). |
| `malgn-agent/bin/new-project.mjs` | `STATUS.md` 파일 생성 **복원**(YAML frontmatter 3필드 — §1). `CLAUDE.md` 템플릿의 "새 세션 부트스트랩" 문구를 §3의 신규 템플릿(L0/L1 + 6가지 재작성 트리거)으로 교체. `docs/README.md` 템플릿도 STATUS.md 참조 복원. PM 블록 `@import` 삽입 로직(오전 §3)은 **추가하지 않음**(훅이 원래대로 처리). 콘솔 안내문은 §8로 교체. |
| `docs/decision/pm-orchestration-block-import-design.md` | 오전에 추가한 "[malgnai-hub 대상 프로젝트 한정 대체됨]" 포인터 **제거**(§4). |
| `malgn-agent/skills/project-standards/SKILL.md` | §3 YAML frontmatter 예시를 3필드로 갱신(§1) + `project_id` 비고 문구 추가. §3에 "1000토큰 상한 + 압축 규율 강화(완료 섹션 5~7개→3~5개)" 반영(§2). §5(L0/L1/L2)는 원래 서술이 사실상 그대로 맞으므로 §3 템플릿의 "6가지 트리거" 문구만 추가 반영. **오전 버전이 계획했던 "provider 분기 신설"(§0에 malgnai-hub/malgnai-mcp를 다르게 취급)은 철회** — 다시 단일 절차로 되돌아간다. |

### Tier 2 — 후속 검토 (이번 결정에서 확정하지 않음)

- `doc-drift.mjs`에 STATUS.md 토큰 근사 측정 프리미티브(`fileTokenApprox` 등) 추가 — 1000토큰 상한을 기계적으로 검증하려면 필요하지만 구현 방식은 미정.
- `project-standards/SKILL.md` §8의 `repository_key` 제안 로직을 git remote org/repo 슬러그 기반으로 개정(§1) — 사용자가 이번 원복의 핵심이 아니라고 명시.

### Tier 3 — pm.md

§7에서 별도로 다룬다.

## 7. pm.md 개정 지침

오전 버전 §7이 제안했던 "STATUS.md → `work_record` 전면 치환" 패턴은 **철회**한다 — STATUS.md가 살아있으므로 pm.md의 기존 STATUS.md 관련 서술(단일 소스, 착수 전 읽기, 갱신 규율 등)은 **원래대로 유효**하며 되돌릴 필요가 없다.

**새로 추가해야 하는 것은 하나뿐이다 — 6가지 재작성 트리거를 pm.md에 명시**:

> pm.md의 "STATUS.md는 단일 소스 — 착수 전 읽고, 작업 사이클 끝마다 갱신" 서술 근처에 다음을 추가한다: "STATUS.md 재작성은 다음 6가지 상황으로 제한한다 — 중요한 작업 완료 / WBS 단계 변경 / 중요한 설계 결정 / blocker 발생·해결 / 세션 종료 / context compact 직전. 그 외 평범한 진행 중에는 STATUS.md를 건드리지 않고 malgnai-hub(`work_record`/`decision_record`/`issue_record`)에만 기록한다."

이 추가 외에 pm.md의 나머지 STATUS.md 관련 서술(작업등급표의 "Micro 등급: STATUS.md 1줄 갱신", "진행상태 보고는 STATUS.md+WBS 병행 조회" 등)은 이번 결정과 배치되지 않으므로 **손대지 않는다**. "Micro 등급: STATUS.md 1줄 갱신"은 위 6가지 트리거 중 "중요한 작업 완료"에 해당하는 것으로 자연스럽게 해석 가능하지만, 이 해석이 pm.md 전체 문맥과 실제로 매끄럽게 들어맞는지는 trainer가 개정 시 한 번 훑어볼 것을 권고한다(6가지 트리거와 충돌하는 기존 서술이 있다면 그때 발견해 조정).

## 8. new-project.mjs 콘솔 안내문 (복원 + 3필드 반영)

```
2. malgnai-hub project_bootstrap 호출 → 응답 중 provider/project_id/repositoryKey 3개를 STATUS.md 상단 YAML frontmatter의 동일한 이름 필드에 채워 넣는다(repository_id/web_url은 응답에 포함되어도 저장하지 않는다).
3. STATUS.md는 1000토큰 이내로 유지하고, 재작성은 6가지 트리거(중요 작업 완료/WBS 단계변경/중요 설계결정/blocker 발생·해결/세션종료/context compact 직전)로 제한한다 — 평범한 진행 중에는 건드리지 않는다.
4. 구조 잡히면 .claude/doc-drift.json 의 checks 채우고 `pnpm run check-docs`
```

## 9. 정직 명시 / 후속 조치

- 이 문서는 같은 경로의 오전 버전("STATUS.md 폐기 + 훅 제거")을 덮어써서 대체한다 — 옛 내용은 git log로 조회 가능하다.
- `docs/decision/pm-orchestration-block-import-design.md`의 대체 포인터 제거는 이 세션에서 함께 수행한다(§4, §6).
- STATUS.md 1000토큰 상한을 기계적으로 강제할 도구가 아직 없다(§2, §6 Tier 2) — 당분간은 PM의 자기 규율(§3 안내문)에 의존한다.
- `project_get_context` 응답 스키마는 여전히 미검증이다(malgnai-hub 도구가 이번 세션에 연결되어 있지 않아 실측 불가) — L1이 다시 선택적이 되면서 리스크는 줄었지만 완전히 사라진 것은 아니다.
- `repository_key`를 git remote 슬러그 기반으로 바꾸는 권장안(§1)은 실제 `project-standards/SKILL.md` 개정까지는 이번 세션에서 하지 않는다(Tier 2 후속).
