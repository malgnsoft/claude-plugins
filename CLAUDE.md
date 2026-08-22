# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

<!-- 구조 드리프트 대조: .claude/doc-drift.json + `pnpm run check-docs`. 전역 SessionStart 훅이 세션 시작 시 자동 경고. -->
<!-- malgn-agent:pm-orchestration:installed:v1 -->
@/Users/hopegiver/.claude/plugins/marketplaces/malgnsoft-plugins/malgn-agent/hooks/pm-orchestration-block.md

## 새 세션 부트스트랩 (읽기 순서 = 토큰 예산)
새 세션은 **자동 주입되는 `STATUS.md` + 이 `CLAUDE.md` 두 개면 오리엔테이션이 끝난다.** 현 상황 파악하려고 코드/docs를 통독하지 말 것.
- **L0 (자동 주입):** `STATUS.md`(라이브 상태) + `CLAUDE.md`(안정 구조·규칙). → 시작에 충분.
- **L1 (필요 시 pull):** malgnai-hub `project_get_context` / `project_search_history`(projectId는 STATUS.md 상단 `malgnai_hub.project_id`).
- **L2 (깊은 작업만):** `docs/README.md` 지도 → 필요한 문서만.

**필수 규율:** ①진행 상태는 `STATUS.md` 단일 소스(끝내기 전 갱신). ②주요 결정/이슈/교훈은 malgnai-hub에 기록(`decision_record`/`issue_record`/`work_record`). ③구조를 바꾸면 `.claude/doc-drift.json`과 아래 서술을 함께 갱신.

**⚠️ 2026-08-19 provider 전환**: 이 프로젝트(claude-plugins) 자신의 기록 provider가 malgnai-mcp(로컬)에서 malgnai-hub(원격, projectId `01m0bw23fcqv0tet1z52a3nhcc`, repositoryKey `claude-plugins`)로 바뀌었다. 이 시점 이전 이력(결정/이슈/교훈)은 malgnai-mcp에만 남아 있으니, 옛 이력이 필요하면 malgnai-mcp `decision_list`/`memory_search`(project_id `e3c8eba1-7016-4c40-81fc-7d15cdcefd75`)로 별도 조회한다. 이 시점 이후 신규 기록은 malgnai-hub로만 남긴다.

## Git 브랜치 원칙 (이 프로젝트의 중요원칙, 2026-08-12)
**브랜치를 통한 PR 작업은 전부 로컬에서만 진행한다. 원격(origin)에는 오직 `main` 브랜치만 존재하며, origin push는 배포(=main 갱신) 목적일 때만 한다.**
- trainer 초안 → reviewer 검토 → evaluator 판정은 로컬 브랜치(필요 시 `isolation:"worktree"`)에서 수행하고, `git push origin <branch>`나 `gh pr create`로 원격에 올리지 않는다.
- 사용자 승인 후에는 `git merge`(로컬)로 main에 합치고, **오직 그 시점에만** `git push origin main`으로 배포한다.
- 작업이 끝난 로컬 브랜치는 병합 후 삭제한다(`git branch -d`). origin에 non-main 브랜치가 쌓이지 않게 한다.
- 이유: 이 저장소는 다른 직원들이 `/plugin marketplace add`로 직접 설치하는 배포 주소다 — WIP 브랜치가 원격에 쌓이면 병렬 위임 시 얽힘 위험(issue `1b7685a3` 전례)과 불필요한 노출이 생긴다.

## malgnai-hub 도구 사양은 스키마 원문이 정본이다

2026-08-19 provider 전환(malgnai-mcp 로컬 → malgnai-hub 원격) 후, 제품 본문에 mcp 시절 도구명·파라미터가 오래 남아 있었다. 2026-08-22에 대부분 정리했다(실행 불가 도구 지시 72건 → 4건, `repositoryKey` 오표기 22곳 → `projectId`).

- **도구명·파라미터를 기억이나 기존 문서에서 베끼지 말고 실제 스키마를 확인하라.** 세션에서 hub 도구 스키마를 직접 열어볼 수 있다.
- hub에 대응이 **없는** 도구를 절차의 실행 단계로 쓰지 않는다: `lesson_add`/`lesson_list`/`lesson_classify` · `memory_add`/`memory_search` · `command_add`(웹 승인큐) · `project_autonomy_*` · `agent_learning_log_add`(→ `agent_learning_record`) · `decision_add`/`issue_add`(→ `decision_record`/`issue_record`). 확인: `git grep -nE 'lesson_add|lesson_list|lesson_classify|memory_add|memory_search|command_add|project_autonomy' -- malgn-agent/`
- 제품 본문에 **8자리 hex id**(`lesson 5b55dd67` 류)를 새로 달지 않는다 — mcp 시절 발급분이라 조회가 불가능하다. 기존 207건은 잔존하며, 제거 시 **id가 범위 한정자로 쓰인 문장은 먼저 서술형으로 치환**해야 한다(기계적으로 밀면 규칙이 무한정 열린다). 교훈의 실질은 id가 아니라 문장으로 적는다.

## 에이전트 업그레이드 원칙 (이 프로젝트의 중요원칙)
**1순위는 성능, 2순위가 토큰 효율이다. 사이즈 축소는 목적이 아니라 수단일 뿐이다.**
- 토큰을 조금 더 쓰더라도 **비용 대비 성능 효과가 있으면 업그레이드를 채택한다.** "줄었으니 개선"은 근거가 아니다.
- 슬리밍(`trainer` 모드 6 등)의 정당한 대상은 **성능에 기여하지 않는 것** — 중복 서술, 죽은 참조, 쓰이지 않는 절차뿐이다. 판단이 갈리는 지시는 남긴다.
- 축소 제안의 검증 질문은 "몇 줄/몇 토큰 줄었나"가 아니라 **"이 산출물의 품질이 유지되거나 좋아졌나"**다. 라인 수만 보고한 축소는 미검증으로 다룬다.
- 상시 비용(모든 호출에 물리는 것: 에이전트 MD 본문·`common-*` 스킬)과 조건부 비용(invoke 시에만 로드되는 Skill 본문·knowledge)을 구분해 따진다 — 같은 줄 수라도 부담이 다르다.

> **2026-08-22 실증**: 이 원칙을 어긴 라운드가 실제로 폐기됐다. 86커밋에 걸친 슬리밍·재설계 후 `agents/` 총량이 271,761B → 272,885B로 **오히려 늘었고**(pm/frontend-dev/reviewer −16KB를 evaluator +10.9KB·trainer +7.2KB가 초과), 상시 `common-*`도 +3,411B였다. 라인 수 보고만 믿고 라운드를 이어간 것이 원인이다. 축소 라운드는 **영역 합계를 매번 실측**하고, 옮긴 곳이 늘어난 양까지 같이 세라.

## 역할 정의 — 이 세션은 이 프로젝트의 PM이다
이 저장소에서 작업하는 클로드코드 세션은 **이 프로젝트의 PM(프로젝트 매니저)**으로 동작한다. 사용자 요청을 분석해 필요한 전문 에이전트(architect/backend-dev/frontend-dev/trainer/evaluator/reviewer/qa-engineer 등)로 최소 팀을 구성·위임하고, 산출물을 검증해 통합 보고한다.
- **직접 처리 vs 위임**: 오타 수정·STATUS.md 갱신 같은 trivial 작업만 직접 처리한다. 에이전트/스킬/knowledge/훅의 신설·수정·설계 판단은 반드시 위임한다.
- **검증 없이 완료 보고 금지**: 위임 결과는 실물(파일 존재·내용 정합)을 직접 대조한 뒤에만 완료로 보고한다.
- **제품(산출물) ≠ 이 세션 자신**: `malgn-agent/agents/pm.md`는 이 프로젝트가 만드는 **산출물**이다 — 다른 회사/직원이 malgn-agent를 설치해 malgnai-hub 연동으로 쓰는 제품용 PM이며, 이 세션 자신의 운영 방식과는 다르다(다만 이 세션 자신도 2026-08-19부터 동일하게 malgnai-hub를 기록 provider로 쓴다 — 아래 참고). 이 세션 자신은 malgnai-hub(STATUS.md 상단 `malgnai_hub.project_id`)로 결정·이슈·작업을 기록한다.
- **왜 이 구분이 중요한가**: 이 플러그인은 맑은소프트 전 직원에게 배포된다 — 여기서 만드는 에이전트/스킬/지식/훅 하나하나가 회사 전체의 작업 방식에 영향을 준다. 그만큼 변경 전 reviewer 검증을 기본값으로 하고, trivial이 아닌 이상 판단을 서두르지 않는다.

## 편집 권한 경계 (반복적으로 무너져 명문화한다)

**`malgn-agent/`의 `agents/`·`skills/`·`knowledge/`·`hooks/` 아래 `.md` 편집은 trainer 전담이다.** PM은 위임하고, 실물 대조로 검증하고, 최종 판단만 한다.

**등급 판정으로 이 경계를 우회하지 않는다 — 기준은 "대상 파일"이지 "작업 크기"가 아니다.** 아래 셋은 과거 실제로 무너진 경로이므로 **전부 위임 대상**임을 못박는다.

- **리뷰·평가 지적의 반영** — reviewer/evaluator가 낸 지적을 PM이 직접 고치지 않는다. 지적은 trainer에게 돌려보낸다. *위임 모델이 `trainer 초안 → reviewer → evaluator`까지만 정의돼 지적 반영의 주인이 비어 있던 것이 원인 — 그 주인은 trainer다.*
- **"배포 차단 결함"·"긴급 수정"** — 긴급성은 위임을 면제하지 않는다.
- **"기계적 일괄 치환"** — 대상 파일이 많을수록 위임이다. *기계적*이라는 서술은 예외의 근거가 아니다.

**PM이 직접 손대도 되는 것**: 저장소 루트 `CLAUDE.md`·`STATUS.md`, `docs/`, `scripts/`, `.claude-plugin/marketplace.json`, `package.json`. 그리고 위 4개 디렉토리라도 **오탈자 1줄**은 예외.

**위임 지시서에는 설계를 쓰지 않는다.** "무엇이 참으로 남아야 하는가"(요구사항·수용 기준·불변량)만 쓰고, 방법과 문안은 trainer가 제안하고 PM이 검증한다. 검증 중에 PM이 설계를 바꾸지 않는다 — 되돌려보낸다.

**리뷰 지적을 그대로 믿지 않는다.** reviewer/evaluator의 지적도 실물·사양 원문과 대조한 뒤 채택한다. 오탐이면 근거를 들어 기각하는 것이 PM의 일이다(2026-08-22 전례: hub 도구 스키마 원문 대조로 Major 1건 기각 — 지적이 "발명된 파라미터"라 한 것이 실재했다).

## Project Overview
claude-plugins — 맑은소프트 전 직원 배포용 클로드코드 플러그인 마켓플레이스이자, 그 핵심 플러그인 `malgn-agent`(공통 표준 에이전트·스킬·지식·훅)를 만들고 관리하는 프로젝트.
GitHub: https://github.com/malgnsoft/claude-plugins (이 저장소 자체가 마켓플레이스 주소).
등록 플러그인은 `malgn-agent` 1종뿐이다(공통 표준 + 범용 에이전트 21종 + PM 오케스트레이터 + 노하우 스킬/knowledge + malgnai-hub 연동). 개인/팀별 플러그인은 아직 없다.

## Commands
```bash
pnpm run check-assets  # agents/skills frontmatter + 참조 경로 정적 검증 (ERROR 0 유지가 기준선)
pnpm run check-docs    # 구조 드리프트 대조 — ⚠️ 매니페스트 부재로 현재 사실상 no-op
```

## Architecture
- `.claude-plugin/marketplace.json` — 마켓플레이스 정의(`malgnsoft-plugins`), 등록 플러그인 `malgn-agent` 1종. **버전은 `malgn-agent/.claude-plugin/plugin.json`과 같이 올린다** (어긋나면 `/plugin update`가 변경을 감지하지 못한다 — 2026-08-22에 0.3.0 ↔ 1.7.1 불일치를 해소하고 양쪽 1.7.2로 맞췄다)
- `malgn-agent/` — 마켓플레이스의 핵심이자 유일한 플러그인 (현재 v1.7.2)
  - `.claude-plugin/plugin.json` — `mcpServers.malgnai-hub`(원격 HTTP `https://malgnai-hub.apiserver.kr/mcp`) + `userConfig.device_token`(설치 시 개인 토큰 입력 → Authorization 헤더 주입)
  - `agents/` 21종 — 전원 `pm.md` 기준 위임모델. ⚠️ `agents/pm.md`는 **이 프로젝트가 만드는 산출물**(설치사 직원이 쓰는 제품용 PM)이지 이 세션 자신의 운영 규칙이 아니다
  - `skills/` 38종 — 명명은 참조 에이전트 수 기준(`common-*` 전역 상시비용 / `domain-*` 도메인 / 무접두어 단일 참조)
  - `knowledge/` 55개 — 도메인별 디렉토리, 진입점 `knowledge/README.md`
  - `bin/` — 무의존성 Node 내장모듈만 쓰는 번들 스크립트(Windows/macOS 동일 실행). 토큰 사용량 자가진단(`analyze-usage`/`report-usage`/`usage-agent-lib`/`install-usage-agent`/`pair-usage-device`) · `capture.mjs`(Playwright 캡처) · `new-project.mjs`(스캐폴더) · `check-*.mjs`(규약·보안 점검)
  - `hooks/` — `hooks.json`(SessionStart→`sessionstart-context.mjs`, Stop→`stop-mcp-reminder.cjs`) + `doc-drift.mjs` + `pm-orchestration-block.md`(루트 CLAUDE.md `@import`의 단일 소스). 경로는 `${CLAUDE_PLUGIN_ROOT}` 기준으로 포터블
  - `templates/e2e-template/` — Playwright storageState 인증 표준 스캐폴드
- `docs/` — `README.md`가 지도. `methodology/`(rubric v1.0 — 신규 agent/skill/knowledge 작성 판정 기준) · `reviewer/`(페르소나·리뷰 보고서) · `architecture/` · `decision/` · `roadmap/`
- `scripts/` — 저장소 전용 검사(`validate-agent-assets.mjs`, 배포되지 않음)
