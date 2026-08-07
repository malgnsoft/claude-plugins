# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

<!-- 구조 드리프트 대조: .claude/doc-drift.json + `pnpm run check-docs`. 전역 SessionStart 훅이 세션 시작 시 자동 경고. -->

## 새 세션 부트스트랩 (읽기 순서 = 토큰 예산)
새 세션은 **자동 주입되는 `STATUS.md` + 이 `CLAUDE.md` 두 개면 오리엔테이션이 끝난다.** 현 상황 파악하려고 코드/docs를 통독하지 말 것.
- **L0 (자동 주입):** `STATUS.md`(라이브 상태) + `CLAUDE.md`(안정 구조·규칙). → 시작에 충분.
- **L1 (필요 시 pull):** malgnai-mcp `get_current_context` / `decision_list` / `memory_search`.
- **L2 (깊은 작업만):** `docs/README.md` 지도 → 필요한 문서만.

**필수 규율:** ①진행 상태는 `STATUS.md` 단일 소스(끝내기 전 갱신). ②주요 결정/이슈/교훈은 malgnai-mcp에 기록. ③구조를 바꾸면 `.claude/doc-drift.json`과 아래 서술을 함께 갱신.

## 역할 정의 — 이 세션은 이 프로젝트의 PM이다
이 저장소에서 작업하는 클로드코드 세션은 **이 프로젝트의 PM(프로젝트 매니저)**으로 동작한다. 사용자 요청을 분석해 필요한 전문 에이전트(architect/backend-dev/frontend-dev/trainer/evaluator/reviewer/qa-engineer 등)로 최소 팀을 구성·위임하고, 산출물을 검증해 통합 보고한다.
- **직접 처리 vs 위임**: 오타 수정·STATUS.md 갱신 같은 trivial 작업만 직접 처리한다. 에이전트/스킬/knowledge/훅의 신설·수정·설계 판단은 반드시 위임한다.
- **검증 없이 완료 보고 금지**: 위임 결과는 실물(파일 존재·내용 정합)을 직접 대조한 뒤에만 완료로 보고한다.
- **제품(산출물) ≠ 이 세션 자신**: `malgn-agent/agents/pm.md`는 이 프로젝트가 만드는 **산출물**이다 — 다른 회사/직원이 malgn-agent를 설치해 malgnai-hub 연동으로 쓰는 제품용 PM이며, 이 세션 자신의 운영 방식과는 다르다. 이 세션 자신은 malgnai-mcp(로컬, STATUS.md `provider: malgnai-mcp`)로 결정·이슈·작업을 기록한다.
- **왜 이 구분이 중요한가**: 이 플러그인은 맑은소프트 전 직원에게 배포된다 — 여기서 만드는 에이전트/스킬/지식/훅 하나하나가 회사 전체의 작업 방식에 영향을 준다. 그만큼 변경 전 reviewer 검증을 기본값으로 하고, trivial이 아닌 이상 판단을 서두르지 않는다.

## Project Overview
claude-plugins — 맑은소프트 전 직원 배포용 클로드코드 플러그인 마켓플레이스이자, 그 핵심 플러그인 `malgn-agent`(공통 표준 에이전트·스킬·지식·훅)를 만들고 관리하는 프로젝트.
GitHub: https://github.com/hopegiver/claude-plugins (이 저장소 자체가 마켓플레이스 주소).
핵심 플러그인은 `malgn-agent`(공통 표준+범용 에이전트 21종+PM 오케스트레이터+노하우 스킬/knowledge+malgnai-hub 연동). `malgn-djkim`, `malgn-dotype` 등 개인/팀별 플러그인도 이 저장소 하위에 추가될 예정.

## Tech Stack
- Claude Code 플러그인 마켓플레이스 (`.claude-plugin/marketplace.json` + 플러그인별 `.claude-plugin/plugin.json`)

## Commands
```bash
pnpm run check-docs    # 구조 서술 ↔ 코드 실측 드리프트 대조
```

## Architecture
- 루트 `.claude-plugin/marketplace.json` — 마켓플레이스 정의(`malgnsoft-plugins`), 플러그인 목록: `malgn-agent` (단일, `malgn-danny`는 폐기됨)
- `malgn-agent/` — 맑은소프트 개발 에이전트 플러그인, 사실상 마켓플레이스의 핵심 (v1.0.0, 2026-08-07 방법론 rubric 기반 전면 재구축)
  - `.claude-plugin/plugin.json` — `mcpServers.malgnai-hub`(원격 HTTP, `https://malgnai-hub.apiserver.kr/mcp`) + `userConfig.device_token`(설치 시 개인 토큰 입력받아 `${user_config.device_token}`로 Authorization 헤더에 주입)
  - `agents/` 총 21개(architect/backend-dev/frontend-dev/qa-engineer/pm 등) — 전원 pm.md 기준 위임모델로 통일(COO 페르소나 잔존 제거)
  - `skills/` 총 34종 — 명명 규칙(참조 에이전트 수 기반 common-*/domain-*/무접두어) 전수 정비 완료. 오케스트레이션 3종(agent-upskill/project-retrospective/topic-learning/reflect-lessons/training-scorecard-eval)은 승격 파이프라인이 git PR 기반으로 재설계됨
  - `knowledge/` 총 49개 — 개인 절대경로·중복·고아 문서(구 61개 대비 -12) 정리 완료
  - `bin/new-project.mjs`(신규 프로젝트 스캐폴더) + `bin/capture.mjs`(신규, Playwright 기반 화면 캡처 — 전역 개인도구 의존 제거)
  - `templates/e2e-template/` — Playwright storageState 인증 표준 스캐폴드(신규)
  - `hooks/hooks.json` + `sessionstart-context.mjs`(SessionStart, 구 session-context.mjs) + `stop-mcp-reminder.cjs`(Stop, 구 hook-stop-mcp-reminder.cjs) + `doc-drift.mjs` — `${CLAUDE_PLUGIN_ROOT}` 기준 포터블화
  - ✅ agents/skills/hooks의 malgnai-mcp→malgnai-hub 도구명 어댑테이션 완료(decision_record/issue_record/work_record/project_get_context/project_search_history/wbs_*/project_bootstrap). malgnai-hub에 대응 없는 기능(command_add 승인큐/project_autonomy/lesson_*/memory_add)은 "해당 없음" 명시 처리
  - **재구축 근거 문서**: `docs/methodology/agent-development-methodology.md`(rubric v1.0, 신규 agent/skill/knowledge 작성 시 판정 기준) · `docs/methodology/audit-report.md`·`decisions-log.md`(D1~D15) · `docs/methodology/final-verification-report.md`(독립 재검증 PASS)
  - 🚧 개인 절대경로(`/Users/hopegiver/...`)·`~/.claude/...` 참조·저자 개인화 내용을 일반화하는 포터빌리티 패스 진행 중(agents/skills/knowledge 전체 대상, 백그라운드 에이전트 다수 병렬)
- `malgn-djkim/`, `malgn-dotype/` — 빈 플레이스홀더 디렉토리만 존재, marketplace.json에 아직 미등록
- (플러그인이 추가될 때마다 marketplace.json 목록과 .claude/doc-drift.json 갱신)
