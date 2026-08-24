---
name: common-output-storage-and-path-management
description: 전 에이전트 인프라 규칙 — 산출물 추적성 확보, 경로 명시·저장 위계로 회수 불가 손실 방지. 파일 저장 위치·경로 관리 시, 그리고 플러그인 번들 `bin/` 스크립트를 실행하는 커맨드 규약(§1-1 정본)이나 `knowledge/` 등 플러그인 자원을 가리키는 참조 규약(§1-2 정본)이 필요할 때, 또는 그 실행·열기가 실패했을 때 사용.
---

# Output Storage and Path Management

## 정의

모든 에이전트의 산출물(코드, 문서, 검증 결과, 의사결정)이 정해진 위계에 저장되고, 절대 경로로 기록되어 추적 가능한 상태를 유지하는 인프라 표준.

## 핵심 원칙

### 1. 저장소 위계 (계층별 용도)

```
~/workspace/[프로젝트]/
  ├─ STATUS.md                → 진행 상태 단일 소스 (착수 전 읽고, 끝내기 전 갱신)
  ├─ CLAUDE.md                → 구조·규칙 (부트스트랩 3층: STATUS.md+CLAUDE.md → project_get_context → docs/README.md)
  │
  ├─ docs/                    → 프로젝트 공식 문서 (장기 보존)
  │   ├─ README.md            → 문서 지도(진입점) — "무엇을 어디서 읽을지" 안내, 통독 금지
  │   ├─ product-principles.md
  │   ├─ [도메인]/            → 주제별 가이드
  │   └─ archive/             → 폐기된 이전 문서 (참조용)
  │
  ├─ output/                  → 최종 산출물 (배포용)
  │   ├─ *.html / *.pdf       → 발표/배포 파일
  │   └─ reports/             → 의사결정/검증 보고서
  │
  ├─ [src/, src-*/...]        → 프로젝트 소스 (git 추적)
  │
  └─ .claude/
      ├─ doc-drift.json       → 문서-코드 검증 매니페스트
      ├─ settings.json        → 프로젝트별 환경 설정
      └─ memory/              → 에이전트 세션별 메모리
          └─ MEMORY.md

${CLAUDE_PLUGIN_ROOT}/            → malgn-agent 플러그인이 제공하는 공유 자원 (설치된 모든 프로젝트에서 공통, 개인 디렉터리 아님)
  ├─ skills/                  → 공유 에이전트 스킬 라이브러리
  │   └─ common-*.md
  │
  ├─ knowledge/               → 공유 참고자료/기반
  │   ├─ [도메인]/
  │   └─ design/              → 전역 디자인 시스템
  │
  └─ agents/                  → 에이전트 역할 정의
      ├─ pm.md               → PM 페르소나
      ├─ architect.md
      ├─ reviewer.md
      └─ ...

~/.claude/CLAUDE.md           → (참고, 선택적) 사용자 개인 전역 설정 — 플러그인과 별개로 사용자별 1개만 존재하는 진짜 개인 파일. 위 세 경로(skills/knowledge/agents)와 달리 플러그인이 제공하는 자원이 아니므로 같은 목록에 동일 취급하지 않는다.
```

### 1-1. 플러그인 루트 변수 — 어디서 치환되는가

플러그인 `bin/`의 스크립트를 실행하라는 지시는 **malgn-agent 제품 본문(스킬·에이전트·knowledge·템플릿) 안에서는 항상 아래 한 가지 형태**로 적고, 그 줄을 **그대로 복사해 실행**한다. 경로는 반드시 큰따옴표로 감싼다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/<스크립트>.mjs" [인자...]
```

- **어디서 치환되는가 — 관측으로 확정한 목록(2026-08-23).** 치환은 *디렉터리*의 성질이 아니라 **하네스가 그 파일을 플러그인 컴포넌트로 로드할 때** 일어나는 일이다. 그래서 "이 폴더는 되고 저 폴더는 안 된다"가 아니라 "어떻게 읽히는가"로 갈린다.
  - **스킬 본문 — 치환된다**(마켓플레이스 설치본에서 관측). 산문·인라인 백틱·코드펜스·다이어그램 어디에 있든 치환된다.
  - **에이전트 본문 — 치환된다**(프로브 에이전트가 절대경로를 되돌려주는 것으로 관측).
  - **훅 커맨드(`hooks/hooks.json`) — 치환된다**(관측). 이 저장소의 SessionStart/Stop 훅이 이 형태로 등록돼 있고 오류 없이 실행된다. 같은 커맨드를 변수가 없는 셸에서 실행하면 `MODULE_NOT_FOUND`로 실패하므로, 훅이 성공한다는 것 자체가 치환의 증거다. **따라서 `hooks.json`의 이 변수는 정상이다 — "여긴 치환 안 되는 자리"로 오판해 절대경로로 바꾸지 마라. 바꾸면 설치된 전원의 SessionStart/Stop 훅이 깨진다.**
  - **MCP·LSP 서버 설정 — 미확인.** 공식문서는 치환된다고 적지만 이 저장소에서 관측하지 못했다. 확인 전에는 근거로 삼지 않는다.
  - **파일을 Read로 열었을 때 — 치환되지 않는다.** 컴포넌트 로드가 아니라 바이트를 그대로 읽는 것이기 때문이다. **같은 SKILL.md라도** Read로 열면 변수가 문자 그대로 보이고, 스킬로 로드되면 절대경로로 도착한다. 그래서 `knowledge/`·`templates/`·`bin/`처럼 컴포넌트로 로드되지 않는 파일에서는 이 변수가 **영원히 풀리지 않는다** — 그런 문서에는 커맨드를 두 벌로 싣지 말고 그 명령을 소유한 스킬을 가리킨다.
- **`${...}` 형태만 치환된다.** 맨이름 `CLAUDE_PLUGIN_ROOT`는 그대로 남는다(관측) — 이 문단이 변수 이름을 적을 수 있는 이유다. 거꾸로 제목·산문에서 변수를 *지칭*하려고 `${...}` 형태를 쓰면 그 자리에 긴 절대경로가 통째로 박혀 문장이 망가진다 — 지칭할 때는 맨이름으로 쓴다. 반대로 **그 자리에 실제 경로가 박히기를 원하는 곳**(실행 커맨드, 그리고 §1-2의 플러그인 자원 참조)에는 `${...}` 형태를 쓴다. 판별 기준은 위치(산문이냐 코드냐)가 아니라 의도다 — 변수를 *말하려는* 것인지, 파일을 *가리키려는* 것인지.
- **셸은 이 변수를 모른다.** Bash 툴 세션에는 정의돼 있지 않아, 변수 이름을 손으로 타이핑하면 `/bin/...`을 찾다가 `MODULE_NOT_FOUND`로 실패한다. 셸에서 풀려고 하지 말고, 본문에 채워져 도착한 절대경로를 그대로 쓴다.
- **큰따옴표는 선택이 아니다.** 치환값은 리터럴 절대경로라, 사용자 홈 경로에 공백이 있으면(`/Users/Gil Dong/...`) 무따옴표는 단어분리로 `MODULE_NOT_FOUND`가 난다(2026-08-23 공백 포함 경로로 재현: 무따옴표 실패 / 따옴표 성공). `hooks/hooks.json`이 같은 이유로 따옴표를 쓰고 있으니 제품 안에서 형태를 갈리게 두지 않는다.
- **맨 명령어로 실행하지 않는다.** 플러그인 `bin/`이 Bash 툴 PATH에 등재되긴 하지만 그렇게 적지 않는다. 이유는 넷이다 — ① 번들 스크립트 일부에 실행 비트가 없다(실측: PATH에 있어도 `capture.mjs`는 `not found`, `new-project.mjs`는 해소된다) ② 실행 비트가 git과 마켓플레이스 설치 파이프라인을 거쳐 보존되는지 미검증이다 ③ Windows에는 실행 비트 개념이 없는데 이 제품은 Windows/macOS 동일 실행을 표방한다 ④ PATH 등재는 "플러그인이 enabled인 동안"이라는 조건부다. 반면 위 정본 형태는 마켓플레이스 설치본에서 실증됐다.
- **치환값을 산출물에 옮겨 적지 않는다.** 치환값은 버전 고정 경로(`.../malgn-agent/<버전>/...`)이고 업데이트되면 사라진다(실측: 캐시에 13개 버전이 공존한다). 보고·기록에는 절대경로가 아니라 `bin/<스크립트>.mjs` 이름으로 적는다.
- **예외 — 스캐폴딩되어 외부로 나가는 코드.** `bin/new-project.mjs`가 만들어 주는 프로젝트는 플러그인 컴포넌트가 아니라 치환이 일어나지 않는다. 그 코드는 런타임 경로 탐색을 쓰는 것이 정상이며 이 규약 위반이 아니다.

### 1-2. 플러그인 자원 참조 규약 (knowledge/ 등)

에이전트·스킬 본문에서 플러그인 자원(`knowledge/`의 학습 자료·스타일가이드·로고)을 **열라고 지시할 때**는 `${CLAUDE_PLUGIN_ROOT}/knowledge/<도메인>/<파일>` 한 형태로 적는다. 에이전트는 사용자 프로젝트를 cwd로 돌기 때문에 맨 상대경로 `knowledge/...`는 그 프로젝트 안에서 찾다가 실패하고(2026-08-24 실측: 서브에이전트가 본문 그대로 Read해 `File does not exist`), "이 플러그인의"처럼 산문으로 위치를 가리켜도 마찬가지다 — 사람에게는 뜻이 통하지만 Read 도구에는 경로가 아니다.

같은 `knowledge/` 문자열이라도 목적이 다르면 형태가 다르다:

| 무엇을 하나 | 형태 |
|---|---|
| 설치된 플러그인 자원을 **읽는다** | `${CLAUDE_PLUGIN_ROOT}/knowledge/…` |
| malgn-agent 소스 clone을 **고친다**(README 등재·신규 작성) | `malgn-agent/knowledge/…` |
| 지금은 없는 옛 문서를 **언급한다** | 경로 없이 산문으로 |

둘째를 첫째 형태로 적으면 읽기 전용 설치본을 고치려 들고, 셋째를 경로로 적으면 죽은 참조가 된다.

- **knowledge 문서 자신은 이 변수를 못 쓴다**(§1-1: 컴포넌트로 로드되지 않아 영원히 안 풀린다). 그 안에서는 "플러그인 루트 기준 `knowledge/…`"라고 말로 적는다.
- **변수가 문자 그대로 보이면** 셸이나 Read에 그대로 넘기지 말고, 이미 로드된 스킬 본문 머리의 base directory에서 플러그인 루트를 얻어 이어붙인다.

### 2. 경로 명시 규칙

**모든 산출물은:**
- **절대 경로 사용** (상대 경로 ❌)
- **말 없이 기록** (구두 설명 ❌)
- **malgnai-hub에 포함** (파일명만 아니라 경로)

**체크:**
```
❌ "문서를 docs에 저장했습니다"
❌ "상대 경로: ../docs/review.md"
✅ "/absolute/path/to/workspace/my-proj/docs/review-2025-07-10.md"
```

**malgnai-hub 기록 시 경로 포함:**
```
work_record:
  status: "completed"
  title: "코드 검토 완료"
  summary: "..."
  artifacts: ["/absolute/path/to/review.md"]  ← 절대 경로 배열

decision_record:
  title: "pnpm 모노레포 폐기"
  decision: "pnpm 모노레포 폐기하고 멀티레포로 전환"
  reason: "... (관련 파일: /absolute/path/to/decision.md, /absolute/path/to/archive/monorepo-v1.md)"  ← ref_files 필드 없음, reason/impact 텍스트에 경로 포함

issue_record:
  title: "타임아웃 버그"
  summary: "... (관련 파일: /absolute/path/to/logs/timeout-trace.txt)"  ← related_file 필드 없음, summary 텍스트에 경로 포함
```

### 3. 파일 이름 규칙

**형식: `[영역]-[주제]-YYYY-MM-DD[.버전].md`**

| 영역 | 예시 | 보관 |
|------|------|------|
| 의사결정 | `decision-pnpm-monorepo-2025-07-10.md` | docs/ 또는 output/reports/ |
| 검증/리뷰 | `review-code-auth-2025-07-10.md` | output/reports/ |
| 학습/교훈 | `training-report-pnpm-setup-2025-07-10.md` | docs/ |
| 임시 분석 | `scratch-perf-analysis-2025-07-10.md` | scratchpad/ (세션 후 삭제) |

**체크:**
```
❌ review.md, 1.md, final-final.md
✅ review-auth-module-2025-07-10.md
```

### 4. 추적성 확보 (경로 ↔ 메타데이터)

**모든 파일마다 헤더에 메타데이터:**

```markdown
---
created: 2025-07-10T14:32:00Z
author: architect (session-abc123)
status: FINAL | DRAFT | ARCHIVED
related_files:
  - /absolute/path/to/related1.md
  - /absolute/path/to/related2.md
tags: [auth, security, decision]
---
```

**체크:**
- [ ] 파일 생성 시간 기록?
- [ ] 작성자/세션ID 포함?
- [ ] 상태 명시? (최종/초안/폐기)
- [ ] 관련 파일 경로 상호 참조?

### 5. 폐기 및 아카이빙 규칙

**더 이상 유효하지 않은 파일:**
- **docs/archive/** 이동 (완전 삭제 ❌)
- 파일명 앞에 `archived-` 접두어 추가
- 원본 경로는 archived-*.md에 기록

**체크:**
```
❌ 파일 완전 삭제
✅ docs/archive/archived-monorepo-design-v1-2025-07-10.md
   (헤더에 "폐기 사유: 구조 변경, 참고용으로만 보존")
```

## 검증 절차 — 스크립트 1차 스캔 후 사람이 위반 후보만 확인

파일명 패턴(§3)·헤더 메타데이터(§4)·경로 위계(§1, §3 표)·`archived-` 접두어(§5)는 전부
정규식/파일시스템 검사로 결정론적으로 판정 가능하다. 이 네 항목은 사람이 파일을 하나씩
열어 눈으로 확인하지 말고, 먼저 `bin/check-output-conventions.mjs`로
1차 스캔한 뒤 위반 후보만 확인한다.

```bash
# 프로젝트 루트에서 docs/ 를 스캔 (기본값)
node "${CLAUDE_PLUGIN_ROOT}/bin/check-output-conventions.mjs"

# 다른 디렉터리를 지정하거나 루트를 명시
node "${CLAUDE_PLUGIN_ROOT}/bin/check-output-conventions.mjs" docs --root /absolute/path/to/project

# CI/게이트용: 하드 위반이 1건이라도 있으면 exit code 1
node "${CLAUDE_PLUGIN_ROOT}/bin/check-output-conventions.mjs" --strict
```

의존성 없는 Node 내장 모듈만 사용한다(`bin/analyze-usage.mjs`와 동일 스타일). 출력은 두 그룹으로
나뉜다:

- **하드 위반**: 정규식/파일시스템으로 명확히 결정되는 것만(예: `decision-` 파일에 날짜 없음,
  `review-` 파일이 `output/reports/` 밖에 있음, `archive/` 안인데 `archived-` 접두어 없음,
  프론트매터에 `created`/`author`/`status` 누락). 스크립트가 "위반"이라 표시해도 최종 확정은
  사람이 한다.
- **확인 필요**: 의도적 예외일 수 있는 애매한 케이스(예: `related_files`/`tags` 둘 다 없음 —
  관련 파일이 정말 없는 경우일 수 있음, `scratch-` 파일이 아직 세션 진행 중이라 남아있는 경우).
  자동으로 위반 처리하지 않는다.

알려진 영역 접두어(`decision-`/`review-`/`training-report-`/`scratch-`)가 없고 날짜도 없는
일반 도메인 문서(예: `docs/[도메인]/guide.md`)는 이 스킬의 날짜 규칙 적용 대상이 불명확하므로
스캔 대상에서 제외한다 — 오탐(false positive)을 늘리지 않기 위함이다.

## 적용 체크리스트

### 산출물 생성 전

- [ ] 이 파일이 docs/? output/? .claude/? ~/ 중 어디에 속하는가?
- [ ] 폴더 구조가 위계 규칙을 따르는가?

### 파일 저장 시

- [ ] `check-output-conventions.mjs` 1차 스캔 결과에 이 파일 관련 위반이 없는가?
- [ ] 절대 경로로 저장? (상대 경로 ❌)
- [ ] 파일명 규칙 따른가? ([영역]-[주제]-YYYY-MM-DD)
- [ ] 헤더 메타데이터 포함? (created, author, status, tags)
- [ ] 관련 파일 상호 참조?

### 기록 시 (malgnai-hub)

- [ ] work_record/decision_record/issue_record에 절대 경로 포함?
- [ ] 파일명만 아니라 전체 경로?
- [ ] 관련 파일이 여러 개면 work_record의 artifacts 배열로 (decision_record/issue_record는 별도 필드가 없어 reason/summary 텍스트에 나열)?

### 폐기 시

- [ ] 완전 삭제 금지, docs/archive/ 이동?
- [ ] archived- 접두어 추가?
- [ ] 폐기 사유와 원본 경로 기록?
- [ ] `check-output-conventions.mjs`로 `archived-` 접두어·경로 위반 재스캔?
