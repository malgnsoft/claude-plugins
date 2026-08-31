# malgn-agent

맑은소프트 전 직원용 클로드코드(Claude Code) 플러그인입니다.
사내 공통 운영 표준과 함께, 기획부터 배포까지 각 역할을 맡는 전문 에이전트 21종,
노하우 스킬 40종, 참고자료(knowledge) 41종을 한 번에 설치합니다.

- **마켓플레이스**: `malgnsoft-plugins` (https://github.com/malgnsoft/claude-plugins)
- **문의**: dev@malgnsoft.com

---

## 설치

클로드코드를 실행한 뒤, 아래 두 명령을 차례로 입력합니다.

```
claude plugin marketplace add malgnsoft/claude-plugins
claude plugin install malgn-agent@malgnsoft-plugins
```

설치 중 **malgnai-hub 디바이스 토큰**을 묻는 화면이 나오면 **아무것도 입력하지 말고
Enter만 누르세요.** 정상 설치에서는 비워두는 것이 맞습니다(아래
[malgnai-hub 연결](#malgnai-hub-연결) 참고).

설치가 끝나면 **클로드코드를 재시작**해야 적용됩니다.

설치 확인:

```
claude plugin list
```

목록에 `malgn-agent`가 보이고 활성화되어 있으면 완료입니다.

---

## 무엇이 들어 있나

### 에이전트 21종 (`agents/`)

요청을 분석해 필요한 팀을 꾸리고 작업을 나눠주는 **PM 오케스트레이터**가 중심입니다.
보통은 PM에게 말을 걸면 나머지 에이전트가 알아서 호출되고, 필요하면 특정 에이전트를
직접 지목할 수도 있습니다.

| 분류 | 에이전트 |
| --- | --- |
| 총괄 | `pm` |
| 기획·설계 | `planner`, `architect`, `ux-designer`, `visual-designer` |
| 구현 | `backend-dev`, `frontend-dev` |
| 품질·보안 | `qa-engineer`, `reviewer`, `security` |
| 배포·운영 | `devops` |
| 제안·수주 | `rfp-analyst`, `capture-strategist`, `writer`, `presenter` |
| 비즈니스 | `marketer`, `finance`, `researcher` |
| 다국어 | `localizer` |
| 에이전트 관리 | `trainer`, `evaluator` |

### 스킬 40종 (`skills/`)

특정 작업에 들어갈 때 자동으로 불려오는 실행 절차서입니다. 이름 앞의 접두어가
적용 범위를 나타냅니다.

- **`common-*`** — 모든 에이전트가 상시 참조하는 공통 규율
  (산출물 품질 기준, 검증 깊이 판정, 근거 기반 보고, 경로·저장 규칙 등)
- **`domain-*`** — 도메인 전문 절차
  (아키텍처 패턴, 백엔드 구현·보안, 테스트 설계, 배포 패턴, 제안 방법론,
  디자인 토큰 체계, 리서치·인용 기준 등)
- **접두어 없음** — 특정 에이전트나 상황 전용
  (`project-standards`, `project-orchestration`, `token-usage-diagnosis`,
  `usage-agent-healthcheck`, `frontend-vue-zero-patterns` 등)

### 참고자료 41종 (`knowledge/`)

에이전트가 필요할 때만 찾아 읽는 심화 자료입니다. 도메인별로 나뉘어 있으며
(`architecture`, `backend`, `frontend`, `design`, `devops`, `quality`, `review`,
`planning`, `proposal`, `marketing`, `finance`, `writing`, `presentation`,
`localization`, `leadership`, `common`), 진입점은 `knowledge/README.md`입니다.

### 훅 (`hooks/`)

- **SessionStart** — 세션을 시작할 때 두 가지를 자동으로 넣어줍니다.
  - **PM 행동 규율** — 요청을 어떤 등급으로 보고 언제 전문 에이전트에게 맡길지, 무엇을
    확인해야 "완료"로 인정하는지 같은 공통 진행 방식입니다. 프로젝트마다 따로 적어 둘
    필요 없이 이 플러그인이 매 세션 넣어주며, 내용이 개정되면 `/plugin update`로
    플러그인을 갱신한 다음 세션부터 최신 내용이 들어옵니다. 그래서 시키지 않은 규칙이
    들어와 있는 것처럼 보일 수 있는데, 이 훅이 넣은 것입니다. 원문은
    `hooks/pm-orchestration-block.md`에서 볼 수 있습니다.
    - **메인 세션에만 들어갑니다.** 전문 에이전트에게 일을 맡기면 그 에이전트는 이 규율을
      받지 않습니다 — 일부러 그렇게 두었습니다(위임을 받아 일하는 쪽까지 "위임하라"는
      문장을 받으면 그 일을 또 넘기려 합니다). 모든 에이전트가 알아야 할 규칙은 프로젝트
      `CLAUDE.md`에 적으세요. 거기 적은 것은 서브에이전트에도 실립니다.
    - 이 규율만 따로 끄는 설정은 없습니다. 대신 프로젝트 `CLAUDE.md`(또는 `STATUS.md`)에
      그 프로젝트의 역할·진행 방식을 정해 두면 그쪽이 이 규율보다 우선합니다 —
      프로젝트마다 다르게 가고 싶을 때 쓰는 방법입니다. 플러그인 전체를 끄면
      (`/plugin disable`) 규율도 함께 꺼지지만 `STATUS.md` 주입·에이전트·스킬도 같이
      꺼집니다.
  - **프로젝트의 `STATUS.md`** — 매번 "지금 상황이 어떻지?"를 설명하지 않아도 됩니다.
    파일이 크면 앞부분만 넣고 잘랐다는 사실을 함께 알려줍니다(기본 상한 12,000바이트).
- **Stop** — 세션을 마칠 때 malgnai-hub에 결정·이슈·작업을 기록했는지 확인시켜 줍니다.

### 번들 스크립트 (`bin/`)

대부분 외부 패키지 설치 없이 Node 내장 모듈만으로 도는 스크립트라 Windows·macOS에서
똑같이 실행됩니다(`capture.mjs`는 예외 — Playwright가 필요하며 없으면 설치 안내와 함께
종료합니다).

| 스크립트 | 하는 일 |
| --- | --- |
| `analyze-usage.mjs` / `report-usage.mjs` / `pair-usage-device.mjs` / `install-usage-agent.mjs` / `usage-agent-lib.mjs` | 내 클로드코드 토큰 사용량 집계·진단과 자동 보고 에이전트 설치 |
| `new-project.mjs` | 사내 표준 구조로 새 프로젝트 스캐폴딩 |
| `capture.mjs` | Playwright로 화면 캡처(구현 결과 눈으로 확인용) |
| `check-edge-api-security.mjs` | Cloudflare Workers·Hono·D1 스택의 인증·CORS 취약 후보 탐지 |
| `check-output-conventions.mjs` / `check-wbs-warnings.mjs` / `diff-env-keys.mjs` | 산출물 규약·WBS·환경변수 키 점검 |
| `check-status-size.mjs` | `STATUS.md`가 3,000바이트 상한 안에 있는지 검사(초과하면 줄여야 할 양과 큰 섹션을 알려줌) |
| `calc-training-scorecard.mjs` | 에이전트 산출물 평가 점수 계산 |

### 템플릿 (`templates/`)

- `e2e-template/` — Playwright `storageState` 인증을 쓰는 E2E 테스트 표준 스캐폴드.

---

## 업데이트

마켓플레이스를 새로 받아온 뒤 플러그인을 갱신합니다.

```
claude plugin marketplace update malgnsoft-plugins
claude plugin update malgn-agent
```

**업데이트 후에는 클로드코드를 재시작해야 적용됩니다.**

> 새 버전이 있는데도 갱신되지 않는 것 같으면 `claude plugin list`에서 현재 설치된 버전을
> 확인하고, 그래도 그대로면 dev@malgnsoft.com으로 알려주세요.

---

## malgnai-hub 연결

`malgn-agent`는 사내 공용 프로젝트 메모리인 **malgnai-hub**에 원격 MCP로 붙습니다.
프로젝트의 결정·이슈·작업 이력이 여기에 쌓이기 때문에, 새 세션에서도 맥락을 다시
설명할 필요가 없습니다.

### 로그인 방법 (OAuth)

인증은 **OAuth 로그인**으로 이뤄집니다. 별도로 토큰을 발급받아 붙여넣을 필요가 없습니다.

1. 플러그인 설치 후 클로드코드를 재시작합니다.
2. malgnai-hub 도구를 처음 쓰는 시점에 브라우저로 로그인 창이 열립니다.
3. 사내 계정으로 로그인하고 접근을 승인하면 연결이 끝납니다.

연결 상태는 `claude mcp list`로 확인할 수 있습니다.

### 디바이스 토큰 항목은 무엇인가요?

설치할 때 보이는 `malgnai-hub 디바이스 토큰(레거시, 선택)` 항목은 **사내망 방화벽이나
헤드리스 환경처럼 OAuth 브라우저 로그인이 아예 열리지 않는 예외 상황**을 위해 남겨둔
탈출구입니다.

- 정상적인 설치라면 **비워두세요.**
- 값을 채워 넣어도 자동으로 사용되지 않습니다.
- OAuth 로그인이 열리지 않는다면 값을 임의로 넣지 말고 dev@malgnsoft.com으로 문의하세요.

---

## 자주 겪는 문제

| 증상 | 확인할 것 |
| --- | --- |
| 설치했는데 에이전트가 안 보임 | 클로드코드를 재시작했는지, `claude plugin list`에서 활성화 상태인지 확인 |
| 업데이트해도 그대로임 | `claude plugin marketplace update`를 먼저 실행했는지 확인 후 재시작 |
| malgnai-hub 도구가 실패함 | `claude mcp list`에서 연결·로그인 상태 확인. 로그인 창이 안 열리면 문의 |
| 토큰 사용량이 보고되지 않음 | 클로드코드에서 "토큰 수집 에이전트 제대로 돌고 있어?"라고 물어보면 점검해 줍니다 |

---

## 라이선스

맑은소프트 사내 이용 라이선스입니다. 자세한 내용은 [`LICENSE`](./LICENSE)를 참고하세요.
소스 저장소가 공개 GitHub에 있더라도 오픈소스로 공개된 것이 아니며, 사외 배포에는
사전 서면 동의가 필요합니다.

변경 이력은 [`CHANGELOG.md`](./CHANGELOG.md)에 있습니다.
