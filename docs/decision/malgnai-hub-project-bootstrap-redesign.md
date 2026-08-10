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

**부수 조치(2026-08-11 재수정)**: SessionStart 훅 제거 계획은 STATUS.md 쪽(`sessionstart-context.mjs`)만 철회하고 복원했다. **PM 행동규율 블록 넛지(`pm-orchestration-nudge.mjs`)는 이후 별도 사용자 지시(decision `547c67be`)로 다시 SessionStart에서 빠졌다** — 두 훅을 동일하게 취급하지 않는다. §4에서 정확히 구분해 다룬다.

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

즉 `project_id`는 실제 도구 호출에는 전혀 쓰이지 않는 **순수 표시/참고용 값**이다. 필드 옆에 짧은 캐비어트 주석을 남긴다(위 YAML 블록 참고: "실제 도구 호출엔 repository_key만 사용됨"). 이 사실만으로 `project_id` 필드를 다시 빼는 것은 제안하지 않는다 — 사용자가 이미 3필드로 확정했다.

> **2026-08-11 추가 수정(§1-b 참고)**: 이전 버전은 여기서 "STATUS.md가 git에 커밋되므로 최초 커밋자 이후 다른 직원이 자신의 실제 project_id가 아닌 값을 보게 될 수 있다"는 문제를 지적했었다. 이 문단은 **더 이상 유효하지 않다** — STATUS.md 자체를 git 추적에서 제외하기로 결정했기 때문이다(아래 §1-b). "실제 도구 호출엔 repository_key만 쓰이고 project_id는 참고용"이라는 사실 부분만 남기고, "다른 직원이 다른 값을 본다"는 우려는 근본 원인이 없어졌으므로 삭제한다.

### 1-b. STATUS.md — git 추적 제외로 전환 (2026-08-11 추가, decision `00173a38`)

**결정**: `new-project.mjs`가 스캐폴딩 시점부터 `STATUS.md`를 `.gitignore`에 등록해 git 추적에서 제외한다.

**근거**: 위에서 확인한 대로 `project_id`는 `(user_id, repository_id)` 조합으로 직원별로 다르게 발급된다 — STATUS.md가 git에 커밋되는 공유 파일이면 이 "직원별로 다른 값"과 "팀 전체가 공유하는 파일" 사이에 구조적 불일치가 생긴다. STATUS.md를 애초에 git 추적 대상에서 빼면(팀 공유 파일 → 개인 로컬 캐시로 전환) 이 문제 자체가 근본적으로 사라진다 — 이는 malgnai-hub의 "프로젝트=직원 개인 작업기록" 데이터모델과도 정합성이 맞다(같은 저장소를 여러 직원이 각자 `project_bootstrap`하는 것 자체가 이미 이 모델을 전제하고 있었다).

**구현**:
1. `new-project.mjs`가 스캐폴딩 시 프로젝트 루트에 `.gitignore`를 생성한다(이미 있으면 append). `STATUS.md` 항목을 추가한다.
2. `.claude/settings.json`/`.claude/doc-drift.json`은 이번 gitignore 대상이 **아니다** — 계속 커밋 대상으로 남는다. `.gitignore`에는 `STATUS.md` 한 줄만 추가한다(다른 항목을 임의로 더 넣지 않는다).
3. `project-standards/SKILL.md`의 "STATUS.md는 git에 커밋되는 파일이므로 여기 넣을 수 있는 값은 project_id 등 식별자뿐이다"(§3 서술) — **이제 커밋되지 않는 파일**이므로 이 문장을 정정한다: "STATUS.md는 git에 커밋되지 않는 개인 로컬 캐시다(`.gitignore` 등록, 이번 결정) — 토큰/시크릿을 넣지 않는 이유는 이제 '커밋되는 파일이라서'가 아니라 단순히 STATUS.md의 책임범위가 아니기 때문이다(인증은 여전히 `device_token`이 전담)."

**범위 밖(§9 참고)**: 이미 STATUS.md를 커밋해버린 기존 프로젝트를 어떻게 정리할지(`git rm --cached STATUS.md` 등 마이그레이션)는 이번 결정의 범위 밖이다.

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

## 4. SessionStart 훅 — STATUS.md용은 유지, PM 블록용은 다시 제거 (2026-08-11 재수정, decision `547c67be`)

**이 절은 두 개의 서로 다른 훅을 다르게 취급한다 — 섞어 읽지 말 것.**

| 훅 | 용도 | 상태 |
|---|---|---|
| `sessionstart-context.mjs` | STATUS.md 자동 주입 + doc-drift 경고 | **SessionStart에 그대로 유지** — §1~§3 STATUS.md 저비용화 결정과 세트, 이번 절에서 변경 없음 |
| `pm-orchestration-nudge.mjs` | PM 행동규율 블록 마커 파싱 + 넛지 + 마켓플레이스 경로 드리프트 가드 | **SessionStart에서 다시 제거**(§4-1~§4-4). 파일 자체도 삭제하고 로직을 분리 이관한다 |

이전 라운드(바로 위 §0 마지막 문단, 이 문서 이전 버전)에서 "훅 제거 계획을 전부 철회하고 hooks.json을 원본 그대로 유지한다"고 썼던 것을 이번에 **PM 블록 쪽만 다시 뒤집는다** — STATUS.md 쪽은 그대로 둔다.

### 4-1. 왜 PM 블록 쪽만 다시 제거하는가

사용자 지시(malgnai-mcp decision `547c67be`) 원문: "import 체크는 매세션마다 하지 않고 첫 스캇폴딩시에만 적용. 필요시 사용자의 요구에 따라 스킬로 처리. 즉 pm 블록처리를 훅으로 하지 않음."

STATUS.md는 "매 세션 현재 상태를 보여줘야 하는" 성격이라 SessionStart 훅이 필요하다(값이 세션마다 달라진다). 반면 PM 행동규율 블록의 `@import` 참조는 **스캐폴딩 시점에 한 번 정확히 걸어두면 그 뒤로는 값이 거의 바뀌지 않는 정적 배선**이다(마켓플레이스 별칭 변경도 극히 드물다). 매 세션 이 정적 배선을 다시 확인하는 비용(프로세스 기동+파싱)이 실익 대비 크다고 판단해 "스캐폴딩 시 1회 + 필요할 때만 온디맨드 재확인 + `pnpm run check-docs`로 수동 드리프트 감지"로 전환한다.

### 4-2. `@import` 삽입 — `new-project.mjs`가 스캐폴딩 시점 1회

오늘 오전 첫 재설계안(STATUS.md 폐기안, 지금은 그 부분만 철회됨) §3에서 이미 이 설계가 나와 있었다 — PM 블록 부분은 원래도 유효했던 아이디어라 그대로 재사용한다.

**핵심 통찰**: `new-project.mjs`는 PM이 이미 `~/.claude/plugins/marketplaces/*/malgn-agent/` 아래의 **버전 없는 마켓플레이스 clone 경로**를 직접 지정해서 실행한다(`${CLAUDE_PLUGIN_ROOT}` 방식이 아니다 — 그건 hooks.json의 command에서만 쓰인다). 즉 `new-project.mjs` 안에서는 **자기 자신의 `import.meta.url`이 이미 정답 경로**다 — 별도 글롭 스캔이 필요 없다.

```js
// new-project.mjs, 기존 import 블록에 추가
function loadPmOrchestrationBlockRef() {
  try {
    const blockPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'pm-orchestration-block.md')
    const raw = readFileSync(blockPath, 'utf8')
    const m = raw.match(/<!--\s*malgn-agent:pm-orchestration:version:(\d+)\s*-->/)
    if (!m) return null
    return { path: blockPath, version: Number(m[1]) }
  } catch { return null }
}
const pmBlock = loadPmOrchestrationBlockRef()
```

CLAUDE.md 템플릿에 (pmBlock이 있을 때만) 삽입:

```markdown
<!-- malgn-agent:pm-orchestration:installed:v${pmBlock.version} -->
@${pmBlock.path}
```

`pmBlock`이 `null`이면(배포 누락 등 이례적 상황) 이 블록을 건너뛰고 콘솔에 경고만 출력한다 — 스캐폴딩 자체를 실패시키지 않는다. 이 로직은 CLAUDE.md 템플릿에만 관여하며 STATUS.md 생성 로직(§1~§3)과는 독립적이다.

**동의 흐름은 다시 만들지 않는다**: `new-project.mjs`가 만드는 프로젝트는 빈 상태에서 시작하므로 "물어볼 대상"이 없다 — `.claude/settings.json`에 마켓플레이스+플러그인을 이미 무조건 등록하는 것과 같은 성격의 표준 스탬핑이다. installed/declined 마커는 "스캐폴딩 당시 몇 버전이었는지"의 수동적 메타데이터로 남는다.

### 4-3. 온디맨드 재확인/재설치 — `project-standards` 스킬 확장 (신규 스킬 만들지 않음)

**대상 상황**: 이미 스캐폴딩된 프로젝트에서 나중에 재확인/재설치가 필요할 때 — 마켓플레이스 별칭이 바뀌었거나, PM 블록 버전이 올라갔거나, 사용자가 처음에 거절했다가 나중에 설치하고 싶을 때. **매 세션 자동이 아니라 사용자가 명시적으로 요청했을 때만** 실행한다(예: "PM 행동규율 다시 확인해줘", "마켓플레이스 옮겼는데 PM 블록 깨졌나 봐줘").

**신규 스킬 vs 기존 스킬 확장 — 판단(①의무, 대안 비교)**: 새 스킬을 만들지 않고 **`project-standards` 스킬에 절차를 추가**한다.
- **대안 A(신규 스킬, 기각)**: 트리거 설명을 독립적으로 정교화할 수 있다는 장점은 있으나, 이 절차가 project-standards가 이미 소유한 동일 생애주기 이벤트(스캐폴딩 §7, 기존 폴더 초기화 §8)와 정확히 같은 범주(프로젝트 부트스트랩 상태 점검)라 스킬을 쪼개면 "부트스트랩 상태를 점검하려면 어느 스킬을 불러야 하나"를 매번 다시 판단해야 하는 부담이 생긴다. 이 절차 하나만으로 별도 스킬을 정당화할 만큼 넓은 주제도 아니다.
- **대안 B(project-standards 확장, 채택)**: project-standards가 이미 "기존 폴더 초기화"(§8)에서 "STATUS.md 있으면 이미 초기화됨, `project_bootstrap`으로 동기화"라는 유사한 패턴을 다루고 있어 자연스럽게 이어붙는다. 스킬 하나가 "프로젝트 부트스트랩 전반"을 계속 담당하는 게 예측 가능성이 높다.

**절차(SKILL.md 신규 절, 가칭 "§9. PM 행동규율 블록 재확인/재설치 — 온디맨드")**:

```
트리거: 사용자가 명시적으로 요청할 때만("PM 행동규율 다시 확인해줘" 류). 매 세션 자동 실행 아님.

1. cwd의 CLAUDE.md를 읽어 `<!-- malgn-agent:pm-orchestration:(installed|declined)?:?vN -->` 마커와
   `@...pm-orchestration-block.md` import 줄 존재 여부를 확인한다.
2. 마커 자체가 없으면 AskUserQuestion으로 설치 여부를 묻는다(기존 pm-orchestration-nudge.mjs의
   askInstallNudge() 안내문 로직을 그대로 재사용).
3. installed인데 import 줄이 없거나(구버전) 경로가 실제 설치 위치와 다르면(드리프트):
   findMalgnAgentBlockPath()로 정확한 경로를 재계산해 Edit로 교정한다.
4. declined인데 사용자가 이번에 설치를 요청했다면 마커+import를 installed로 교체한다.
5. findMalgnAgentBlockPath()가 AMBIGUOUS/null을 반환하면 사용자에게 그 사실을 알리고 진행하지 않는다.
```

**재사용 로직**: `findMalgnAgentBlockPath()`(마켓플레이스 글롭스캔 + `enabledPlugins` 별칭 소거 + `AMBIGUOUS` 처리), 마커 정규식(`STATE_MARKER_RE`/`BLOCK_VERSION_RE`/`IMPORT_LINE_RE`), `readBlockFile()`, `askInstallNudge()` 등의 안내문 문구 — 지금 `pm-orchestration-nudge.mjs`에 이미 구현되어 있다. **새로 짜지 않는다** — 아래 4-4에서 정확히 어디로 옮기는지 다룬다.

### 4-4. 로직 분리 이관 — 세 소비자가 같은 경로탐색 알고리즘을 공유

이번 라운드에서 코디네이터가 추가한 요구사항(아래 §4-5)까지 반영하면, `findMalgnAgentBlockPath()`/`AMBIGUOUS`를 필요로 하는 소비자가 **세 곳**으로 늘어난다 — ①(과거) SessionStart 훅 ②4-3의 온디맨드 스킬 ③4-5의 `doc-drift.mjs` 수동 점검. 오늘 오전 첫 재설계안 §4가 이미 이 정확한 이유로 공용 모듈 추출을 설계해뒀다("여러 트랙이 같은 범용 유틸을 필요로 하면 기존 트랙 코드를 직접 고치지 말고 공용 lib로 추출" 원칙) — 그 설계를 그대로 재사용한다. 두 선택지를 검토했다:

- (a) `pm-orchestration-nudge.mjs`를 완전 삭제 — 장점: 죽은 코드 없음. 단점: 검증된 로직(마켓플레이스 별칭 소거, `AMBIGUOUS` 처리)을 그 자리에서 통째로 잃는다. 단독으로는 기각.
- (b) 로직을 공용 lib로 추출한 뒤 원본 파일은 삭제 — **채택**.

**이관 계획**:
1. **`malgn-agent/hooks/lib/find-pm-block-path.mjs`(신설)** — `findMalgnAgentBlockPath()`/`AMBIGUOUS`/`readBlockFile()`/`STATE_MARKER_RE`/`BLOCK_VERSION_RE`/`IMPORT_LINE_RE`를 **로직 변경 없이 그대로** 옮긴다. 세 소비자 모두가 필요로 하는 공통부다.
2. **`malgn-agent/hooks/doc-drift.mjs`(확장)** — §4-5에서 상세.
3. **`malgn-agent/skills/project-standards/scripts/check-pm-orchestration-block.mjs`(신설)** — `lib/find-pm-block-path.mjs`를 import해서 경로 계산을 위임하고, 그 위에 온디맨드 스킬 전용 로직(마커 읽기/쓰기 지시문 생성 — 기존 `askInstallNudge()`/`migrateToImportInstruction()`/`rewriteImportInstruction()` 등)을 얹는다. Claude 세션이 4-3 절차를 따라가며 이 스크립트를 호출해 "지금 상태가 뭔지" 확인하고, 실제 마커/import 줄 쓰기는 세션이 Edit 도구로 수행한다(기존 `pm-orchestration-nudge.mjs`가 "훅은 파일을 쓰지 않는다"는 불변식을 지켰던 것과 동일 원칙 — 이 스크립트도 파일을 쓰지 않는다).
4. **`malgn-agent/hooks/pm-orchestration-nudge.mjs`(삭제)** — 위 1~3으로 로직이 전부 분리 이관됐으므로 원본은 삭제한다. `hooks.json`에서 이미 참조가 빠졌으므로(§4-1, 실제 파일도 이번 세션에 수정 완료 — §6) 죽은 코드로 남기지 않는다.

### 4-5. `doc-drift.mjs` 확장 — `pnpm run check-docs`로 `@import` 드리프트 수동 점검 (코디네이터 추가 지시)

SessionStart 훅(자동)은 없애지만, 최소한 **수동 확인 경로는 남겨야** `@import`가 조용히 깨졌을 때(마켓플레이스 별칭 변경, external-import 승인 다이얼로그 거절 후 방치 등) 자동은 물론 수동으로도 감지할 방법이 하나도 없는 상태를 막을 수 있다. 오늘 오전 첫 재설계안 §4에 이미 상세 설계가 있었다 — 그대로 재사용한다.

```js
// malgn-agent/hooks/doc-drift.mjs 에 추가
import { findMalgnAgentBlockPath, AMBIGUOUS } from './lib/find-pm-block-path.mjs'

const IMPORT_LINE_RE = /^@(.+pm-orchestration-block\.md)\s*$/m

export function checkPmBlockImport(cwd = process.cwd()) {
  let claudeMd
  try { claudeMd = readFileSync(join(cwd, 'CLAUDE.md'), 'utf8') } catch { return null }
  const m = claudeMd.match(IMPORT_LINE_RE)
  if (!m) return null // import 줄 자체가 없으면(미설치 상태 — 이 저장소 자신 포함) 점검 대상 아님, 강제하지 않는다
  let resolved
  try { resolved = findMalgnAgentBlockPath() } catch { resolved = null }
  if (resolved === AMBIGUOUS) return { status: 'ambiguous', message: 'malgn-agent 마켓플레이스 후보가 2개 이상이라 경로를 하나로 특정할 수 없다.' }
  if (!resolved) return { status: 'plugin-missing', message: 'malgn-agent 플러그인 원본을 찾을 수 없다(마켓플레이스 제거/미등록 가능성).' }
  if (resolved !== m[1]) return { status: 'drift', message: `import 경로(${m[1]}) != 현재 설치 경로(${resolved}) — Edit로 교정 필요.` }
  return { status: 'ok' }
}
```

CLI 실행부(`if (process.argv[1] ... )` 블록, `pnpm run check-docs`가 부르는 부분) 말미에 추가:

```js
const pmCheck = checkPmBlockImport(cwd)
if (pmCheck) {
  console.log(pmCheck.status === 'ok' ? '  ✅ PM 행동규율 @import 정상' : `  ⚠️ PM 행동규율 @import: ${pmCheck.message}`)
  if (pmCheck.status !== 'ok') process.exitCode = 1
}
```

**"매 세션 체크 아님"을 코드 구조로도 보장**: `checkPmBlockImport()`는 `doc-drift.mjs`의 named export일 뿐이고, 위 CLI 블록 안에서만 호출된다. 이 CLI 블록은 `doc-drift.mjs`가 **직접 스크립트로 실행될 때만**(`pnpm run check-docs`) 돌고, `sessionstart-context.mjs`가 `computeDrift()`만 import해서 쓰는 경로(매 세션 자동 실행)에서는 이 블록 자체가 실행되지 않는다 — **`sessionstart-context.mjs`는 이번 확장과 무관하며 수정하지 않는다.** 이 구조가 "자동 없음 + 수동만 있음"을 우연이 아니라 구조적으로 보장한다.

(오전 §4의 원 설계와 차이: 그때는 `PROJECT_IDENTITY_MARKER_RE`로 "malgnai-hub 신규 스캐폴딩 대상"인지 먼저 게이트했었다 — 그건 그 설계가 CLAUDE.md에 project-identity YAML 블록을 새로 만드는 걸 전제했기 때문이다. 이번 원복으로 그 블록 자체가 없어졌으므로(§0/§1, project_id는 STATUS.md에 있다) 그 게이트는 빼고 **`@import` 줄의 유무 자체로 게이트**하도록 단순화했다 — 없으면 애초에 점검할 대상이 없다는 뜻이라 조용히 스킵한다.)

**`docs/decision/pm-orchestration-block-import-design.md`의 포인터 노트도 이번 세션에서 다시 갱신했다**(정확한 문구로 — SessionStart 상시 넛지/드리프트 감시 레이어만 대체, `@import` 삽입 자체는 계속 유효) — §6에 실제 파일 조치를 명시한다.

## 5. L1(malgnai-hub 조회) — 다시 "선택적 호출" 원칙으로

오전 버전 §2는 "L0(STATUS.md)가 없어졌으니 L1이 사실상 필수로 격상된다"고 썼다 — 이 부분을 철회한다. STATUS.md가 살아있으므로 `project-standards/SKILL.md` §5의 원래 문구("L1 선택적 호출: 텍스트 검색이 필요하거나 다중 프로젝트 범위 필터링이 필요할 때만... 불필요한 호출은 토큰 낭비")가 **그대로 다시 유효**하다. §3의 CLAUDE.md 템플릿에도 이미 "L0로 충분하면 호출하지 않는다"로 반영했다.

`project_get_context`가 실제로 최근 상태(nextAction 등)를 반환하는지에 대한 미검증 사항(오전 버전 §2 말미)은 여전히 미검증이지만 **중요도가 낮아진다** — STATUS.md가 진행상태의 1차 소스로 복귀했으므로, 이 조회는 이제 "STATUS.md만으로 부족할 때의 보충 조회"다(§9).

## 6. 영향받는 파일 전체 목록

### Tier 1 — 핵심 메커니즘

| 파일 | 변경 |
|---|---|
| `malgn-agent/hooks/hooks.json` | **실제 반영 완료(이번 세션)** — `SessionStart`에서 `pm-orchestration-nudge.mjs` 항목만 제거. `sessionstart-context.mjs`(STATUS.md용)와 `Stop`(stop-mcp-reminder.cjs)은 그대로 유지(§4-1). |
| `malgn-agent/hooks/sessionstart-context.mjs` | **변경 없음.** STATUS.md 자동 주입 + `computeDrift()`만 호출한다 — `checkPmBlockImport()`(§4-5)는 호출하지 않는다(자동 체크 아님을 코드 구조로 보장, §4-5 마지막 문단). |
| `malgn-agent/hooks/pm-orchestration-nudge.mjs` | **삭제.** 로직은 `lib/find-pm-block-path.mjs`(공통부)와 `skills/project-standards/scripts/check-pm-orchestration-block.mjs`(온디맨드 스킬 전용부)로 분리 이관한다(§4-4). |
| `malgn-agent/hooks/lib/find-pm-block-path.mjs` | **신설.** `findMalgnAgentBlockPath()`/`AMBIGUOUS`/`readBlockFile()`/`STATE_MARKER_RE`/`BLOCK_VERSION_RE`/`IMPORT_LINE_RE`를 로직 변경 없이 이관(§4-4). `doc-drift.mjs`와 `check-pm-orchestration-block.mjs` 둘 다 이 모듈을 import한다. |
| `malgn-agent/hooks/doc-drift.mjs` | `checkPmBlockImport()` export 추가, CLI 블록(`pnpm run check-docs`)에서만 호출(§4-5). STATUS.md 크기 체크용 신규 프리미티브(`fileTokenApprox`)는 Tier 2 후속으로 별도. |
| `malgn-agent/hooks/pm-orchestration-block.md` | 상단 안내 주석 갱신 — "이 파일은 ①`new-project.mjs`가 스캐폴딩 시 1회 삽입하는 `@import`(§4-2) ②`project-standards` 스킬의 온디맨드 재확인 절차(§4-3), 두 경로로만 참조된다 — 더 이상 매 세션 훅이 읽지 않는다." 본문(행동 규율 내용) 자체는 변경 없음. |
| `malgn-agent/bin/new-project.mjs` | `STATUS.md` 파일 생성 복원(YAML frontmatter 3필드 — §1) + 스캐폴딩 시 `.gitignore`를 생성/append해 `STATUS.md` 항목 추가(§1-b, 신규). `CLAUDE.md` 템플릿의 "새 세션 부트스트랩" 문구를 §3의 신규 템플릿(L0/L1 + 6가지 재작성 트리거)으로 교체. `docs/README.md` 템플릿도 STATUS.md 참조 복원. **PM 블록 `@import` 삽입 로직을 추가한다**(§4-2 — 이전 라운드에서는 "추가하지 않음"이었으나 이번 라운드에서 다시 필요해짐, 표 아래 비고 참고). 콘솔 안내문은 §8로 교체(3필드 + `.gitignore` 언급 반영 필요, §8 갱신). |
| `docs/decision/pm-orchestration-block-import-design.md` | 포인터 노트를 **정확한 문구로 갱신**(이번 세션에 이미 반영) — "SessionStart 훅 기반 상시 넛지/드리프트 감시 레이어만 대체됨(스킬 온디맨드로 이관), `@import` 삽입 자체는 스캐폴딩 시점 1회로 계속 유지"(§4). |
| `malgn-agent/skills/project-standards/SKILL.md` | §3 YAML frontmatter 예시를 3필드로 갱신(§1) + `project_id` 비고 문구 추가(수정본 — "다른 직원이 다른 값을 본다" 우려는 삭제, "repository_key만 실사용" 사실만 유지, §1). **"STATUS.md는 git에 커밋되는 파일이므로..." 서술을 "STATUS.md는 git에 커밋되지 않는 개인 로컬 캐시다(.gitignore 등록)"로 정정**(§1-b, 신규). §3에 "1000토큰 상한 + 압축 규율 강화(완료 섹션 5~7개→3~5개)" 반영(§2). §3 템플릿에 "6가지 트리거" 문구 추가 반영(§3). **신규 §9 "PM 행동규율 블록 재확인/재설치 — 온디맨드" 절 추가**(§4-3, `check-pm-orchestration-block.mjs` 호출 절차). "provider 분기 신설" 계획은 이전 라운드에서 이미 철회된 채로 유지(단일 절차). |
| `malgn-agent/skills/project-standards/scripts/check-pm-orchestration-block.mjs` | **신설.** `lib/find-pm-block-path.mjs`를 import해 경로 계산을 위임하고, 마커 읽기/쓰기 지시문 생성(구 `askInstallNudge()`류)을 얹는다. 파일을 쓰지 않는다(§4-4). |

**표 안 비고(§4-2 관련)**: PM 블록 `@import` 삽입 로직의 "추가/미추가" 판단이 문서 라운드마다 바뀐 이유를 명확히 해둔다 — ①오전(STATUS.md 폐기안): 훅이 통째로 없어지므로 스캐폴딩이 대신 삽입해야 했다(추가). ②직전 라운드(STATUS.md만 원복): PM 블록 훅도 함께 부활한다고 오판해 "훅이 처리하니 불필요"로 썼다(미추가, **이 판단은 틀렸다** — 아래 ③에서 정정됨). ③이번 라운드(decision `547c67be`): PM 블록 훅은 다시 제거되므로 스캐폴딩이 다시 삽입해야 한다(추가, 최종 확정).

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
4. STATUS.md는 .gitignore에 등록되어 git에 커밋되지 않는다(개인 로컬 캐시) — 팀과 공유할 내용은 malgnai-hub(work_record/decision_record/issue_record)에 남긴다.
5. PM 행동규율(@import)이 걸려 있다 — 다음 세션(또는 재시작) 시 외부 파일 승인 다이얼로그가 뜰 수 있다, 반드시 승인할 것. 나중에 마켓플레이스 별칭 변경 등으로 재확인이 필요하면 project-standards 스킬에 "PM 행동규율 다시 확인해줘"로 요청한다(매 세션 자동 점검 아님).
6. 구조 잡히면 .claude/doc-drift.json 의 checks 채우고 `pnpm run check-docs`(문서 드리프트 + PM 블록 @import 상태를 함께 점검 — 자동 세션 점검은 STATUS.md/doc-drift만 해당, PM 블록은 수동 점검만 있음)
```

## 9. 정직 명시 / 후속 조치

- 이 문서는 같은 경로의 오전 버전("STATUS.md 폐기 + 훅 제거")을 덮어써서 대체한다 — 옛 내용은 git log로 조회 가능하다. 이후 같은 날 두 차례 더 개정됐다(PM 블록 훅 재제거 — decision `547c67be`, STATUS.md gitignore 전환 — decision `00173a38`) — 이 파일이 그 세 차례 개정을 모두 흡수한 최종본이다.
- `docs/decision/pm-orchestration-block-import-design.md`의 포인터 노트는 이 세션에서 두 번 수정됐다(1차: 전체 대체 표기 → 제거, 2차: "SessionStart 상시감시 레이어만 대체, @import 삽입 자체는 유효"로 정확화) — 현재 버전이 최종이다.
- STATUS.md 1000토큰 상한을 기계적으로 강제할 도구가 아직 없다(§2, §6 Tier 2) — 당분간은 PM의 자기 규율(§3 안내문)에 의존한다.
- `project_get_context` 응답 스키마는 여전히 미검증이다(malgnai-hub 도구가 이번 세션에 연결되어 있지 않아 실측 불가) — L1이 다시 선택적이 되면서 리스크는 줄었지만 완전히 사라진 것은 아니다.
- `repository_key`를 git remote 슬러그 기반으로 바꾸는 권장안(§1)은 실제 `project-standards/SKILL.md` 개정까지는 이번 세션에서 하지 않는다(Tier 2 후속).
- **이미 STATUS.md를 커밋해버린 기존 프로젝트의 정리(`git rm --cached STATUS.md` 등 마이그레이션)는 이번 결정의 범위 밖이다**(§1-b) — `new-project.mjs`(신규 스캐폴딩)에만 적용되며, 기존 커밋 이력에서 STATUS.md를 제거하는 절차는 이번 문서에서 설계하지 않는다.
- PM 블록 온디맨드 스킬의 `check-pm-orchestration-block.mjs` 정확한 CLI 인터페이스(예: `--report` 플래그 여부)는 이번 문서가 확정하지 않는다(§4-4) — trainer 구현 시 결정.
