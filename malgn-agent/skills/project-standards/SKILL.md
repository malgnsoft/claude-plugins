---
name: project-standards
description: 맑은소프트 프로젝트 운영 표준 — 패키지 매니저(pnpm 전용), 프로젝트 구조(~/workspace/<이름>/ 독립 프로젝트), STATUS.md/CLAUDE.md/docs 3층 부트스트랩, 드리프트 가드, 신규 프로젝트 스캐폴딩, 기존 폴더 초기화/동기화. 새 프로젝트를 시작하거나, 사용자가 이미 만들어 둔 폴더 안에서 "초기화 해줘/이 프로젝트 초기화"라고 요청하거나, 프로젝트 구조/진행 상태 관리 방식을 판단할 때 사용.
---

# Malgn Project Standards

## 정의

맑은소프트 전 프로젝트가 공통으로 따르는 운영 표준. "최소 토큰으로 항상 정확한 이해"를 목표로, 진행 상태·문서·패키지 관리 방식을 통일한다.

## 1. 패키지 매니저 — pnpm 전용

- 모든 프로젝트에서 **pnpm**을 사용한다 (npm/yarn 금지).
- `pnpm install`, `pnpm add`, `pnpm dlx`, `pnpm run`, 새 프로젝트는 `pnpm create` 사용.
- 락파일은 `pnpm-lock.yaml`만 유지한다. `package-lock.json` / `yarn.lock` 생성 금지.

## 2. 프로젝트 구조

- 모든 프로젝트는 `~/workspace/<프로젝트명>/` 아래에 둔다.
- 각 프로젝트는 **독립적**이다 — 자체 `package.json`과 `pnpm-lock.yaml`을 가진다.
- 공유 루트 락파일이나 `pnpm-workspace.yaml`을 쓰는 pnpm 모노레포는 만들지 않는다.

## 3. 진행 상태 = 루트 `STATUS.md` (단일 소스)

- 착수 전 읽는다.
- 파일 최상단에 `---`로 감싼 진짜 YAML frontmatter를 1-depth 평면 키로 둔다(스킬/에이전트 MD와 동일한 관례 — 기계 파싱 가능하도록 HTML 주석·중첩 대신 이 형식을 쓴다). 필드명은 malgnai-hub MCP 도구 파라미터명과 그대로 맞춰 복붙 가능하게 한다:
  ```yaml
  ---
  provider: malgnai-hub
  project_id: # malgnai-hub 도구 호출의 projectId 입력값 (project_bootstrap 응답으로 채워짐)
  repository_key: # project_bootstrap 재호출 입력값 — project_id를 모를 때 이걸로 다시 발급받는다
  ---
  ```
  - `provider`는 이 프로젝트가 어느 MCP 서버(malgnai-hub 또는 로컬 malgnai-mcp)에 연동됐는지 표시 — 어느 MCP 서버의 도구를 써야 하는지 세션이 바로 판별할 수 있게 한다.
  - `project_bootstrap`이 `project_id`/`repository_key`를 채운다(malgnai-hub 연동 시). frontmatter 다음 줄부터 `# STATUS — <이름>` 본문이 이어진다.
  - **`project_id` 비고**: `project_id`는 `(user_id, repository_id)` 조합으로 직원별로 다르게 발급되는 값이라, 다른 직원이 같은 STATUS.md를 열어보면 자신의 실제 값과 다른 project_id를 보게 된다 — 그러므로 **남의 STATUS.md에 적힌 project_id를 그대로 도구 호출에 쓰지 않는다.** 기록·조회 도구(`work_record`/`decision_record`/`issue_record`/`wbs_*`/`project_get_context`/`project_search_history`)는 모두 `projectId`를 받으므로, 자기 값을 모르면 `project_bootstrap`(입력은 `repositoryKey`)을 다시 호출해 발급받는다.
  - **`repository_id`/`web_url`은 STATUS.md에 저장하지 않는다** — 내부 DB id·화면 링크는 실사용 가치가 낮다고 판단해 필드에서 제외했다.
  - **토큰/시크릿은 여기 넣지 않는다**: 인증은 프로젝트 단위가 아니라 플러그인 설치 시 입력한 `device_token`(사용자 단위, `userConfig`에 저장)으로 처리된다. STATUS.md는 git에 커밋되지 않는 개인 로컬 캐시다(`.gitignore` 등록) — 토큰/시크릿을 넣지 않는 이유는 이제 "커밋되는 파일이라서"가 아니라 단순히 STATUS.md의 책임범위가 아니기 때문이다(인증은 여전히 `device_token`이 전담).
  - **git 추적 제외**: `new-project.mjs`가 스캐폴딩 시 `.gitignore`에 `STATUS.md`를 등록한다 — `project_id`가 `(user_id, repository_id)` 조합으로 직원별로 다르게 발급되는 값이라, 팀 공유 파일(git 커밋)로 두면 "직원별로 다른 값"과 "팀 전체가 공유하는 파일" 사이에 구조적 불일치가 생긴다. STATUS.md를 개인 로컬 캐시로 전환하면 이 문제 자체가 사라진다.
- **크기 상한: 3,000바이트 이내로 유지한다.** 토큰으로 상한을 잡으면 세션에서 셀 수 없어 지킬 수단이 없다 — 바이트는 셀 수 있다. 한글은 UTF-8 3바이트/글자이고 토큰당 1글자를 넘지 않으므로, 3,000바이트면 전부 한글이어도 1,000토큰 안에 들어온다(ASCII가 섞이면 더 여유가 생긴다). **고친 직후 그 자리에서 검사 스크립트를 돌린다** — STATUS.md는 `.gitignore` 대상이라 CI가 대신 잡아주지 못한다. 압축 규율(완료 섹션 5~7개 유지)을 지켜도 이 상한은 쉽게 넘기므로 더 타이트하게 조인다:
  - **검사:** `node "${CLAUDE_PLUGIN_ROOT}/bin/check-status-size.mjs"` — 현재 작업 디렉터리의 STATUS.md를 재서, 상한을 넘으면 exit 1과 함께 몇 바이트를 줄여야 하는지·어느 `##` 섹션이 큰지 찍는다(다른 프로젝트 루트는 인자로 경로를 넘긴다). STATUS.md가 없으면 SKIP(exit 0)이고, 반드시 있어야 하는 자리에서는 `--require`로 실패로 승격한다. 바이트를 손으로 세지 않는다 — OS별로 명령이 갈리고(`wc -c` / PowerShell `(Get-Item ...).Length`), 상한과의 비교·초과분 계산을 사람이 떠안게 된다.
  - **관리 규칙:** 완료 항목은 1줄 요약만 남긴다(malgnai-hub `work_record` 이력으로 상세 조회가 가능하므로 id는 적지 않는다 — 적으면 그 자체가 매 세션 주입되는 상시 비용이 된다), 완료 섹션은 최근 **3~5개**만 유지(5~7개에서 축소). 헤더 라인은 매번 통째로 교체(과거 세션 "직전:" 체이닝 금지).
  - "진행 중(🚧)" 섹션도 append하지 않는다 — 단계가 바뀔 때마다 현재 상태로 즉시 재압축한다.
- **재작성은 다음 6가지 상황으로 제한한다** — 그 외 평범한 진행 중에는 STATUS.md를 건드리지 않는다:
  ①중요한 작업 완료 ②WBS 단계 변경 ③중요한 설계 결정 ④blocker 발생/해결 ⑤세션 종료 ⑥context compact 직전.
  그 외에는 malgnai-hub `work_record`/`decision_record`/`issue_record`에만 기록하고 STATUS.md는 그대로 둔다 — STATUS.md는 "현재 스냅숏"이지 "매 턴 로그"가 아니다. ("상태가 바뀌면 끝내기 전 갱신"처럼 두면 사실상 매 턴 갱신하는 관성이 생기므로, 이 6가지로 명시 제한한다.)
- 장기 이력은 malgnai-hub `project_search_history`로 조회 — STATUS.md는 **지금 돌아가는 것·다음 것·열린 이슈만** 담는다.

## 4. 문서 지도 = `docs/README.md`

- 배경·설계·이력은 이 지도를 거쳐 필요한 문서만 찾아 읽는다.
- **docs 통독 금지** — 지도에서 필요한 것만 골라 읽는다.

## 5. 새 세션 부트스트랩 (3층)

1. **L0 자동주입:** `STATUS.md` + `CLAUDE.md` — 대부분의 경우 이것만으로 충분.
2. **L1 선택적 호출:** 텍스트 검색이 필요하거나 다중 프로젝트 범위 필터링이 필요할 때만 malgnai-hub `project_get_context` 호출. 불필요한 호출은 토큰 낭비.
3. **L2 깊은 작업 시:** `docs/README.md` 지도를 거쳐 필요한 문서만.

**현 상황 파악을 위해 코드·docs를 통독하지 않는다** (토큰 낭비 + 옛 정보 오독 위험). L0(`STATUS.md`) 자체의 재작성 트리거는 §3의 6가지로 제한된다 — 매 턴 갱신 관성으로 되돌아가지 않는다.

CLAUDE.md **본문에 어떤 내용을 남기고 무엇을 다른 자리로 내보낼지**(배치 결정·크기 규율·비파괴 리팩터링)는 Skill `claude-md-architecture`가 정본이다. 반대로 CLAUDE.md에 **무엇을 스탬프하고 어떤 배선을 넣는지**는 이 스킬 소관이다 — 스캐폴딩 뼈대(§7), 구조 서술의 드리프트 검증 계약(§6), PM 행동규율 블록 `@import`의 삽입·점검(§9).

## 6. 정확성 보증 — 드리프트 가드

- 프로젝트에 `.claude/doc-drift.json` 매니페스트가 있으면, 문서 서술(파일 수·테이블·라우트 수 등)을 코드 실측과 대조해 **어긋날 때만 경고**한다(일치 시 0토큰).
- 수동 확인: `pnpm run check-docs`
- CLAUDE.md에 구조를 서술할 때는 반드시 이 매니페스트로 검증 가능하게 쓴다(수치는 doc-drift.json에 등록). 검증에 걸지 못하는 구조 서술은 반드시 코드와 갈라지므로, 매니페스트에 걸 수 없고 판단(책임·이유·함정)도 담지 않은 나열이라면 CLAUDE.md에 적지 않는다 — **무엇을 서술로 남기고 무엇을 지울지의 판정은 Skill `claude-md-architecture` §1이 정본이고, 이 §6은 남기기로 한 것을 낡지 않게 거는 방법이다.**

## 7. 신규 프로젝트 생성 — 표준 스캐폴드

새 프로젝트는 임의로 디렉토리를 만들지 말고, 이 플러그인이 제공하는 스캐폴더를 사용한다:

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/new-project.mjs" <프로젝트명> ["한 줄 설명"]
```

> 이 커맨드가 실패하거나(특히 `MODULE_NOT_FOUND`) 새 실행 지시를 쓸 때의 규약 — 따옴표, 이 변수가 치환되는 자리와 안 되는 자리, 맨 명령어를 쓰지 않는 이유 — 은 Skill `common-output-storage-and-path-management` §1-1이 정본이다.

`~/workspace/<이름>/`에 다음을 스탬프하고 git init까지 수행한다:
- `STATUS.md` — 부트스트랩 포인터를 포함한 라이브 상태 단일 소스
- `CLAUDE.md` — 부트스트랩 3층 계약 + 구조(빈 뼈대) + 드리프트 안내
- `docs/README.md` — 문서 지도(진입점)
- `.claude/doc-drift.json` — 드리프트 매니페스트(빈 checks)
- `package.json` — pnpm, `type: module`, `check-docs` 스크립트

스캐폴딩 후에는 malgnai-hub `project_bootstrap`을 호출해 `repositoryKey`를 발급받고(첫 호출 시 자동 프로비저닝 — 별도 project_create 불필요), `STATUS.md` 상단 YAML frontmatter의 `provider`/`project_id`/`repository_key` 필드를 채운다.

## 8. 기존 폴더 초기화 — "초기화 해줘"

사용자가 폴더를 직접 만들고(또는 이미 코드가 있는 폴더) 그 안에서 "초기화 해줘"라고 요청하면, `~/workspace/<이름>/`을 새로 만드는 절차(§7)가 아니라 아래 in-place 절차를 따른다.

1. **현재 상태 판별**: cwd에 `STATUS.md`가 있는지 확인.
   - **있으면 → 이미 초기화됨.** 새로 스탬프하지 않는다. 상단 YAML frontmatter의 `project_id`가 비어 있으면 malgnai-hub `project_bootstrap`을 호출해 동기화하고 frontmatter 필드를 채운다. 이미 채워져 있으면 `project_get_context`로 최신 상태만 확인하고 그대로 진행한다.
   - **없으면 → 아래 신규 초기화로 진행.**
2. **신규 초기화(in-place)**:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/bin/new-project.mjs" --here ["한 줄 설명"]
   ```
   - cwd에 STATUS.md/CLAUDE.md/docs/README.md/.claude/doc-drift.json/package.json 중 **없는 파일만** 스탬프한다. 이미 코드가 있는 폴더(기존 `package.json` 등)라도 기존 파일은 덮어쓰지 않고 건너뛴다 — 실행 후 출력의 "건너뜀" 목록을 사용자에게 보고한다.
   - `.git`이 없으면 `git init`까지 수행한다.
   - 홈 디렉토리 자체에서는 실행되지 않는다(안전장치).
3. **pnpm install** 실행 (package.json이 새로 생겼거나 이미 있던 경우 모두).
4. **malgnai-hub `project_bootstrap` 호출**로 프로젝트를 동기화한다. `repositoryKey`는 폴더명 기반으로 제안하고 사용자 확인 후 확정한다. 반환된 `project_id`/`repositoryKey`를 `STATUS.md` 상단 YAML frontmatter의 `project_id`/`repository_key`에 채운다.
5. 결과를 요약 보고한다: 새로 만든 파일 / 건너뛴(기존 유지) 파일 / malgnai-hub 연동 결과.

**기존 5필드 STATUS.md는 그대로 둬도 기능상 문제없다** — 어떤 도구도 `repository_id`/`web_url` 필드를 파싱하지 않는다(SessionStart 훅은 STATUS.md를 필드 단위가 아니라 파일 전체를 문자열로 주입한다). 억지로 지금 3필드로 정리할 필요는 없다 — 다음 갱신 시점에 자연스럽게 3필드로 옮겨가면 되고, 급하지 않다.

## 9. PM 행동규율 블록 재확인/재설치 — 온디맨드

**대상 상황**: 이미 스캐폴딩된 프로젝트에서 나중에 재확인/재설치가 필요할 때 — 마켓플레이스 별칭이 바뀌었거나, PM 블록 버전이 올라갔거나, 사용자가 처음에 거절했다가 나중에 설치하고 싶을 때.

**트리거: 사용자가 명시적으로 요청할 때만**(예: "PM 행동규율 다시 확인해줘", "마켓플레이스 옮겼는데 PM 블록 깨졌나 봐줘"). **매 세션 자동 실행이 아니다** — `new-project.mjs`가 스캐폴딩 시점 1회 `@import`를 삽입한 뒤(§7), 그 정적 배선을 매 세션 다시 확인하던 SessionStart 훅(구 `pm-orchestration-nudge.mjs`)은 제거됐다. 상시 감시가 없는 대신 이 온디맨드 절차와, `pnpm run check-docs`(수동 드리프트 점검, §6)가 안전망이다.

절차:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/project-standards/scripts/check-pm-orchestration-block.mjs" [cwd]
```

이 스크립트는 파일을 쓰지 않는다 — cwd의 CLAUDE.md를 읽어 현재 상태를 JSON으로 출력할 뿐이다. 실제 CLAUDE.md 수정은 이 결과를 읽은 세션이 아래 절차대로 Edit로 수행한다:

1. cwd의 CLAUDE.md에서 `<!-- malgn-agent:pm-orchestration:(installed|declined)?:?vN -->` 마커와 `@...pm-orchestration-block.md` import 줄 존재 여부를 확인한다(위 스크립트 `status` 필드로 판정: `no-marker`/`declined`/`legacy-no-import`/`ambiguous`/`plugin-missing`/`drift`/`ok`).
2. `no-marker`(마커 자체가 없음): 설치 여부를 사용자에게 확인해야 한다 — 이 절차를 PM이 직접 실행했다면 AskUserQuestion으로 묻고, 서브에이전트가 실행했다면(서브에이전트에는 AskUserQuestion 도구가 없다) 이 결과를 PM에게 반환해 PM이 묻게 한다.
3. `legacy-no-import`(installed인데 import 줄이 없음, 구버전) 또는 `drift`(경로가 실제 설치 위치와 다름): 스크립트가 제시한 `resolvedPath`로 Edit해 교정한다(사용자 재동의 불필요 — 콘텐츠 변경이 아니라 전달 방식/경로 교정일 뿐).
4. `declined`인데 사용자가 이번에 설치를 요청했다면 마커+import를 installed로 교체한다.
5. `ambiguous`/`plugin-missing`이면 CLAUDE.md를 건드리지 않고 그 사실을 사용자에게 알린다.

경로 계산 로직(`findMalgnAgentBlockPath()`/`AMBIGUOUS`/`readBlockFile()`)은 `hooks/lib/find-pm-block-path.mjs`가 단일 소스다 — 이 스크립트와 `new-project.mjs`, `hooks/doc-drift.mjs`(수동 드리프트 점검) 셋 모두 같은 모듈을 import해 동일한 알고리즘을 공유한다.

## 체크리스트

- [ ] 패키지 매니저로 pnpm만 쓰는가? (npm/yarn 흔적 없는가)
- [ ] 프로젝트가 `~/workspace/<이름>/` 아래 독립적으로 있는가?
- [ ] `STATUS.md`가 3,000바이트 이내인가? — `node "${CLAUDE_PLUGIN_ROOT}/bin/check-status-size.mjs" --require`가 OK여야 한다(`--require`를 빼면 STATUS.md가 없거나 엉뚱한 폴더에서 돌렸을 때 SKIP으로 통과해버린다). 완료 섹션은 3~5개로 정리되어 있는가? (재작성은 6가지 트리거 상황에서만 했는가?)
- [ ] `docs/README.md` 지도가 있고, docs를 통째로 읽지 않고 지도를 거쳐 필요한 것만 읽었는가?
- [ ] 구조 서술(CLAUDE.md)이 `.claude/doc-drift.json`으로 검증 가능한가?
- [ ] 새 프로젝트라면 `new-project.mjs`로 스캐폴딩했는가? (기존 폴더라면 `--here`로, STATUS.md가 이미 있다면 재스탬프 대신 `project_bootstrap` 동기화로)
