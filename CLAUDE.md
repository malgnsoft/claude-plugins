# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

<!-- 구조 드리프트 대조: .claude/doc-drift.json + `pnpm run check-docs`. 전역 SessionStart 훅이 세션 시작 시 자동 경고. -->

## 새 세션 부트스트랩 (읽기 순서 = 토큰 예산)
새 세션은 **자동 주입되는 `STATUS.md` + 이 `CLAUDE.md` 두 개면 오리엔테이션이 끝난다.** 현 상황 파악하려고 코드/docs를 통독하지 말 것.
- **L0 (자동 주입):** `STATUS.md`(라이브 상태) + `CLAUDE.md`(안정 구조·규칙). → 시작에 충분.
- **L1 (필요 시 pull):** malgnai-mcp `get_current_context` / `decision_list` / `memory_search`.
- **L2 (깊은 작업만):** `docs/README.md` 지도 → 필요한 문서만.

**필수 규율:** ①진행 상태는 `STATUS.md` 단일 소스(끝내기 전 갱신). ②주요 결정/이슈/교훈은 malgnai-mcp에 기록. ③구조를 바꾸면 `.claude/doc-drift.json`과 아래 서술을 함께 갱신.

## Project Overview
claude-plugins — 맑은소프트 직원 배포용 클로드코드 플러그인 마켓플레이스.
GitHub: https://github.com/hopegiver/claude-plugins (이 저장소 자체가 마켓플레이스 주소).
핵심 플러그인은 `malgn-dev`(공통 표준+범용 에이전트 21종+PM 오케스트레이터+노하우 스킬/knowledge+malgnai-hub 연동). `malgn-djkim`, `malgn-dotype` 등 개인/팀별 플러그인도 이 저장소 하위에 추가될 예정.

## Tech Stack
- Claude Code 플러그인 마켓플레이스 (`.claude-plugin/marketplace.json` + 플러그인별 `.claude-plugin/plugin.json`)

## Commands
```bash
pnpm run check-docs    # 구조 서술 ↔ 코드 실측 드리프트 대조
```

## Architecture
- 루트 `.claude-plugin/marketplace.json` — 마켓플레이스 정의(`malgnsoft-plugins`), 플러그인 목록: `malgn-dev` (단일, `malgn-danny`는 폐기됨)
- `malgn-dev/` — 맑은소프트 개발 에이전트 플러그인, 사실상 마켓플레이스의 핵심 (v0.3.0)
  - `.claude-plugin/plugin.json` — `mcpServers.malgnai-hub`(원격 HTTP, `https://malgnai-hub.apiserver.kr/mcp`) + `userConfig.device_token`(설치 시 개인 토큰 입력받아 `${user_config.device_token}`로 Authorization 헤더에 주입)
  - `agents/` 총 21개 — 전역 `~/.claude/agents/`에서 이식한 20개(architect/backend-dev/frontend-dev/qa-engineer 등) + `pm.md`(신규 작성: coo.md/대니 페르소나를 이름·회사전체권한 프레이밍 제거하고 범용 프로젝트 PM 오케스트레이터로 일반화 — malgnai-hub 툴링·WBS·위임/검증 원칙은 그대로 보존)
  - `skills/` 총 35종 — `malgn-project-standards`(신규 작성: pnpm/프로젝트구조/STATUS.md 3층 부트스트랩/드리프트 가드) + 전역 `~/.claude/skills/`에서 이식한 사용자 직접 저술 노하우 34종(common-*, learning-loop-patterns, domain-*, architecture-patterns-reference, system-design-principles, shipley-proposal-methodology, screen-verification-and-capture 등). Cloudflare 벤더 문서 번들 스킬(cloudflare, turnstile-spin, agents-sdk, durable-objects, sandbox-sdk, web-perf, workers-best-practices, wrangler, cloudflare-*, 총 375+파일)은 "내 노하우와 성격이 다르다"는 사용자 판단으로 제외
  - `knowledge/` 총 61개(신규 이식) — 전역 `~/.claude/knowledge/`에서 이식(architecture/backend/common/design/devops/finance/frontend/leadership/localization/marketing/planning/presentation/proposal/quality/review/security/writing). `.lessons-removed-2026-07-16/`(폐기된 개인 교훈 아카이브, 31개)는 배포 부적합 판단으로 제외
  - `bin/new-project.mjs` — 신규 프로젝트 표준 스캐폴더 (사용법 안내를 플러그인 상대 경로로 일반화)
  - `hooks/hooks.json` + `session-context.mjs`(SessionStart) + `hook-stop-mcp-reminder.cjs`(Stop) + `doc-drift.mjs` — `${CLAUDE_PLUGIN_ROOT}` 기준 포터블화
  - ✅ agents/skills/hooks의 malgnai-mcp→malgnai-hub 도구명 어댑테이션 완료(decision_record/issue_record/work_record/project_get_context/project_search_history/wbs_*/project_bootstrap). malgnai-hub에 대응 없는 기능(command_add 승인큐/project_autonomy/lesson_*/memory_add)은 "해당 없음" 명시 처리
  - 🚧 개인 절대경로(`/Users/hopegiver/...`)·`~/.claude/...` 참조·저자 개인화 내용을 일반화하는 포터빌리티 패스 진행 중(agents/skills/knowledge 전체 대상, 백그라운드 에이전트 다수 병렬)
- `malgn-djkim/`, `malgn-dotype/` — 빈 플레이스홀더 디렉토리만 존재, marketplace.json에 아직 미등록
- (플러그인이 추가될 때마다 marketplace.json 목록과 .claude/doc-drift.json 갱신)
