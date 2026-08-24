# Anthropic 공식 문서 로컬 미러

Claude Code / Agent Skills 공식 문서의 **마크다운 원문**을 그대로 받아 저장한 폴더다.
malgn-agent가 얹혀 있는 사양(agent·skill·hook·plugin)이 바뀌면 우리 자산도 같이 틀어지므로,
"모델 기억"이나 "웹 검색 요약"이 아니라 **그 시점의 원문**을 저장소에 박아두고 diff로 변화를 본다.

## 규칙

- **직접 편집 금지.** 이 폴더는 읽기 전용 미러다. 우리 해석·정리는 `docs/` 다른 폴더나 `malgn-agent/knowledge/`에 쓴다.
- **원문 무가공 보존.** 파일 앞에 출처 헤더를 덧붙이지 않는다 — 헤더를 넣으면 매 갱신 diff가 오염된다. 출처·해시·수집시각은 전부 `MANIFEST.json`에 있다.
- **인용할 땐 파일 경로 + 섹션명으로.** 예: `docs/anthropic/plugins/plugins-reference.md` §Standard plugin layout.

## 갱신

```bash
pnpm run sync-docs:check   # 원격이 바뀌었는지만 확인(파일 미수정, 변경 있으면 exit 1)
pnpm run sync-docs         # 실제 다운로드 + MANIFEST.json 갱신
node scripts/sync-anthropic-docs.mjs --only hooks,skills   # 특정 그룹/슬러그만
```

갱신 후에는 `git diff docs/anthropic/`으로 **무엇이 바뀌었는지 먼저 읽고**, 그 변화가 우리
agents/skills/hooks에 영향을 주는지 판단한 뒤 커밋한다. 문서 미러 갱신과 우리 자산 수정은 별도 커밋으로 나눈다.

### 버전은 어떻게 판정하나

공식 문서에는 버전 번호가 없다. 그래서 2단으로 판정한다:

1. **조건부 요청** — 이전 수집 때 받은 `ETag` / `Last-Modified`를 `If-None-Match` / `If-Modified-Since`로 보낸다. 서버가 `304`면 본문 전송 없이 "변경 없음" 확정.
2. **본문 sha256 비교** — 200이 와도 해시가 이전과 같으면 변경 없음으로 처리(CDN이 헤더만 갱신하는 경우 대비).

`MANIFEST.json`의 각 항목에 `sha256` / `previousSha256` / `fetchedAt` / `lastCheckedAt`이 남으므로,
"언제 받은 판본인지"와 "직전 판본 대비 바뀌었는지"를 파일 밖에서 추적할 수 있다.

`index/llms-*.txt`는 공식 문서 **전체 목록**이다. 여기 diff에 새 항목이 잡히면 = Anthropic이 새 문서를 냈다는 뜻이니,
필요하면 `scripts/sync-anthropic-docs.mjs`의 `SOURCES` 배열에 추가한다.

## 구성

| 그룹 | 파일 | 우리에게 무엇의 근거인가 |
|---|---|---|
| `claude-code/` | `features-overview.md` | CLAUDE.md·Skill·subagent·hook·MCP·plugin 중 무엇으로 만들지 선택 기준 |
| | `claude-directory.md` | `.claude` 디렉토리 — 어떤 파일이 어디서 로드되는지 |
| | `memory.md` | CLAUDE.md 계층·auto memory |
| | `context-window.md` | 무엇이 자동 로드되고 토큰을 얼마나 먹는지 (우리 "토큰 예산" 규율의 근거) |
| `skills/` | `skills.md` | Claude Code 스킬 생성·배포·번들 스킬 |
| | `skills-overview.md` | Agent Skills 아키텍처, progressive disclosure 원리 |
| | `skills-best-practices.md` | **스킬 작성 정본** — name/description 규약, 번들 리소스(`references/`·`scripts/`) 구조 |
| `agents/` | `sub-agents.md` | **서브에이전트 정본** — frontmatter 스키마, 도구 제한 |
| | `agents.md` | subagent / agent view / agent team / workflow 비교 |
| | `agent-teams.md` | 세션 간 협업·메시징 |
| | `workflows.md` | 동적 워크플로 오케스트레이션 |
| `hooks/` | `hooks.md` | **훅 정본** — 이벤트별 입출력 JSON 스키마, exit code, async/HTTP 훅 |
| | `hooks-guide.md` | 훅 실전 가이드·트러블슈팅 |
| `plugins/` | `plugins.md` | 플러그인 제작 |
| | `plugins-reference.md` | **플러그인 정본** — `plugin.json` 스키마, 표준 디렉토리 레이아웃, `${CLAUDE_PLUGIN_ROOT}` 경로 규칙 |
| | `plugin-marketplaces.md` | 마켓플레이스 제작·배포 (이 저장소 자체의 형태) |
| | `plugin-dependencies.md` | 플러그인 의존성 버전 제약 |
| `reference/` | `settings.md` | settings.json 전체 키·환경변수 |
| | `commands.md` | 내장 명령·번들 스킬 목록 |
| | `mcp.md` | MCP 연결 규격 (malgnai-hub 연동의 상위 사양) |
| | `glossary.md` | 용어 정의 |
| `index/` | `llms-claude-code.txt` | Claude Code 전체 문서 인덱스(신규 문서 감시용) |
| | `llms-platform.txt` | Claude Platform(API) 전체 문서 인덱스 |

---

## 공식 `references/`와 우리 `knowledge/`는 같은 것인가

**아니다. 겹치는 목적은 하나뿐이고, 스코프·소유권·도달 경로가 다르다.**

### 공식 `references/` — 스킬 하나에 딸린 하위 폴더

`skills-best-practices.md` §Progressive disclosure patterns 기준으로, 스킬 디렉토리는 이런 모양이다:

```text
skills/pdf-processing/
├── SKILL.md          # 진입점. 트리거되면 본문 전체가 컨텍스트에 로드된다
├── references/       # SKILL.md가 경로로 지목할 때만 읽힌다 (토큰 0 → 필요 시 로드)
│   └── forms.md
└── scripts/          # 읽지 않고 실행한다
    └── fill_form.py
```

핵심은 **progressive disclosure**다. SKILL.md 본문은 500줄 이하로 유지하고, 상세는 `references/`로 밀어낸 뒤
본문에서 경로로 지목한다. 지목되기 전까지 그 파일들은 파일시스템에만 있고 토큰을 전혀 쓰지 않는다.

- **소유권**: 그 스킬 전용. 다른 스킬이 남의 `references/`를 읽는 건 설계상 의도가 아니다.
- **도달 경로**: 스킬이 발동 → SKILL.md 로드 → 본문에 적힌 경로를 보고 그 파일만 읽음.
- **공식 표기**: 문서 예시에 `references/`와 `reference/`가 섞여 나온다. 강제 이름이 아니라 관례다(번들 스킬들은 `references/`를 쓴다).

### 우리 `knowledge/` — 플러그인 루트의 공유 지식 베이스

`malgn-agent/knowledge/`는 도메인별(`backend/`, `review/`, `proposal/` …)로 나뉜 자료를 두고,
**여러 에이전트 MD가 각자 Read로 참조**한다.

- **소유권**: 플러그인 전역. 한 문서를 여러 에이전트가 공유하는 게 정상이다.
- **도달 경로**: 에이전트 MD(또는 스킬)에 적힌 경로 → Read.
- **공식 규약인가**: **아니다.** `plugins-reference.md` §File locations reference가 인정하는 플러그인 구성요소는
  `skills/` `commands/` `agents/` `workflows/` `output-styles/` `themes/` `hooks/` `monitors/` `bin/` `.mcp.json` `.lsp.json` `settings.json`뿐이고 `knowledge/`는 없다.
  다만 플러그인 루트의 평범한 파일이라 Read로는 문제없이 읽히므로, **동작하는 비표준 확장**이다.

### 정리

| | 공식 `references/` | 우리 `knowledge/` |
|---|---|---|
| 위치 | 스킬 디렉토리 **안** | 플러그인 **루트** |
| 스코프 | 그 스킬 하나 | 플러그인 전역, 에이전트 간 공유 |
| 누가 읽나 | 그 스킬이 발동한 세션 | 여러 에이전트 MD·스킬 |
| 로드 시점 | SKILL.md가 경로를 지목할 때 | 에이전트 MD가 경로를 지목할 때 |
| 목적 | progressive disclosure (본문 슬리밍) | progressive disclosure **+ 자산 공유·중복 제거** |
| 공식 규약 | 예 (best-practices 문서) | 아니오 (우리 확장) |

**공통점은 "본문 밖으로 상세를 빼서 필요할 때만 읽게 한다"는 progressive disclosure 하나.**
차이는 스코프다 — `references/`는 스킬 1개 전용, `knowledge/`는 N개 에이전트 공유.

### 실무 판단 기준

- 자료가 **스킬 하나에서만** 쓰인다 → 그 스킬의 `references/`로. (공식 관례에 맞고, 스킬이 자기완결적이 된다)
- 자료를 **여러 에이전트/스킬이 공유**한다 → `knowledge/`에. (공식 관례엔 없지만 중복을 막는 게 더 중요하다)
- 헷갈리면 참조 에이전트 수로 가른다 — 우리 스킬 명명 규칙(`common-*` / `domain-*` / 무접두어)이 이미 쓰는 기준과 같다.
