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

**`STATUS.md`는 3,000바이트(≈1,000토큰) 이하로 유지한다 (2026-08-24 사용자 지시, 항구 규칙).**
SessionStart 훅이 이 파일을 **매 세션 통째로 주입**하므로, 여기서 늘어난 1줄은 앞으로 열리는 모든 세션에 곱해져 물린다. **STATUS.md를 고친 직후 `pnpm run check-status`를 돌린다**(3,000B 초과 시 exit 1). 이 파일은 `.gitignore` 대상이라 CI가 대신 잡아주지 못하므로, 고친 사람이 그 자리에서 확인하는 것 말고는 게이트가 없다.
- **바이트를 쓰는 이유**: 토큰은 세션에서 셀 수 없다. 한글은 UTF-8 3바이트/글자이고 글자당 1토큰을 넘지 않으므로, 3,000B면 전부 한글이어도 1,000토큰 안에 들어온다(ASCII는 바이트당 더 싸므로 섞일수록 여유가 생긴다).
- **여기에 두는 것**: 현 운영 모드 한 줄 · 지금 열려 있는 작업 · 열린 이슈 제목 · 백로그 제목 · 다음 행동.
- **여기에 두지 않는 것**: 규칙(→ 이 `CLAUDE.md`) · 지나간 라운드 서술(→ `docs/archive/`) · 결정·이슈 원문(→ malgnai-hub). 항목은 **제목 한 줄 + 포인터**로 적고 상세는 링크 뒤에 둔다.
- 상한을 넘기면 새 내용을 줄이는 게 아니라 **오래된 항목을 아카이브로 내보내** 자리를 만든다.

**필수 규율:** ①진행 상태는 `STATUS.md` 단일 소스(끝내기 전 갱신). ②주요 결정/이슈/교훈은 malgnai-hub에 기록(`decision_record`/`issue_record`/`work_record`). ③구조를 바꾸면 `.claude/doc-drift.json`과 아래 서술을 함께 갱신.

**⚠️ 2026-08-19 provider 전환**: 이 프로젝트(claude-plugins) 자신의 기록 provider가 malgnai-mcp(로컬)에서 malgnai-hub(원격)로 바뀌었다. **projectId는 여기 적지 않는다 — `STATUS.md` 상단 `project_id`가 단일 소스다**(여기에 박아두면 드리프트한다: 실제로 이 자리에 적혀 있던 id는 실제 프로젝트와 달랐다). 이 시점 이전 이력(결정/이슈/교훈)은 malgnai-mcp에만 남아 있으니, 옛 이력이 필요하면 malgnai-mcp `decision_list`/`memory_search`(project_id `e3c8eba1-7016-4c40-81fc-7d15cdcefd75`)로 별도 조회한다. 이 시점 이후 신규 기록은 malgnai-hub로만 남긴다.

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
- **제품 본문에 식별자를 근거로 달지 않는다 (2026-08-22 사용자 지시, 항구 규칙).** 8자리 hex id(`lesson 5b55dd67` 류, mcp 발급분)든 26자 ULID(`01m0c9ck8y…`, hub 발급분)든 로컬 auto-memory 키든 실재하지 않는 커밋 해시든 마찬가지다 — 설치 직원은 어느 것도 열어볼 수 없다. **교훈의 실질은 id가 아니라 문장으로 적는다.** 사유는 남기되 id는 붙이지 않는다 — 날짜·경위 자체는 아래 [이력을 남기지 않는다] 규칙에 따라 제품 본문에서 뺀다.
  - 2026-08-22에 제품 전량 227건을 제거해 현재 **0건**이다(v1.7.3·v1.7.4, 명세 `docs/refactor/lesson-id-removal-spec.md`). 다시 유입되면 결함으로 다룬다.
  - 확인은 **백틱 앵커 없이** 한다 — 백틱을 앵커로 잡으면 코드 주석 안의 맨몸 id가 그대로 통과한다(2026-08-22 실증: `.md`를 다 지운 뒤에도 `bin/report-usage.mjs` 주석에 같은 ULID 2건이 살아 있었다):
    ```
    grep -rnoE '\b[0-9a-f]{8}\b|\b01[0-9a-hjkmnp-tv-z]{24}\b' malgn-agent/   # 형태 무관 — 오탐(날짜·상수)은 눈으로 걸러낸다
    grep -rnE 'commit `[0-9a-f]{7,12}`|memory `[^`]+`' malgn-agent/
    ```
  - 스코프는 **형태가 아니라 목적**으로 잡는다 — "설치 직원이 조회할 수 있는가". 형태(hex·백틱·확장자)는 검색어일 뿐이다. 무언가를 스코프에서 **제외할 때야말로** 근거를 실물로 확인한다(제외 항목은 "괜찮다"는 도장을 받고 아무도 다시 안 본다 — 실제로 `commit 13bcd60`이 그렇게 살아남았다).
  - 만약 id가 **범위 한정자**로 쓰인 문장을 지우게 되면 먼저 서술형으로 치환한다(기계적으로 밀면 규칙이 무한정 열린다).

## 제품 본문은 최신 상태만 담는다 — 이력을 남기지 않는다 (2026-08-24 사용자 지시, 항구 규칙)

**`malgn-agent/`의 `agents/`·`skills/`·`knowledge/` 본문은 "지금 무엇이 참인가"만 적는다. "언제 바뀌었나 / 예전엔 어땠나"는 적지 않는다.**
위 [식별자 금지] 규칙과 같은 이유의 확장이다 — 설치 직원은 우리 회의도, 우리 라운드도, 우리 커밋도 조회할 수 없다. 조회할 수 없는 근거는 근거가 아니고, 매 호출마다 물리는 상시 비용만 된다. 이력의 보관처는 `STATUS.md`·`docs/archive/`·malgnai-hub이지 제품 본문이 아니다.

**빼는 것 (이력)**
- 합의·결정 날짜 도장: `(2026-07-23 대표+7에이전트 교차토론 합의)`, `(2026-08-19 신설)`, `(2026-08-19 정정)`
- 이관·폐기 경위: `(… 본문은 skills/X로 이관) 배경만 남음`, `구 모드 7은 evaluator로 이관됐다`, `구 knowledge/…는 폐기`
- 버전·라운드·커밋 언급: `v1.7.x에서`, `직전 라운드에서`, 커밋 해시

**남기는 것**
- **규칙이 생긴 이유(실패 양상)는 남긴다 — 단, 시제를 현재형으로 바꾸고 날짜·주체·경위는 뺀다.** 이유를 지우면 에이전트가 규칙을 상황에 따라 흘려버린다.
  - ❌ `(2026-08-19 정정, 판단 주체 이전 — 이전엔 frontend-dev가 착수 직전 스스로 판단했으나 "안 부르면 계속 안 불려짐" 실패가 반복됐음)`
  - ✅ `(구현자가 착수 직전에 판단하면 안 부르고 넘어가는 일이 반복된다)`
- **형식 예시 안의 날짜는 이력이 아니다** — `review-auth-module-2025-07-10.md`(파일명 규칙), `Viewport 1440×900, 2025-02-10`(캡처 기록 양식) 등은 그대로 둔다. 날짜 모양이라고 기계적으로 밀면 예시가 망가진다.
- 외부 사실로서의 연도 표기(표준·규격 버전 등)는 대상이 아니다.

**적용 범위**: 앞으로 새로 쓰거나 고치는 본문에 즉시 적용한다. 기존 잔존분(2026-08-24 실측: 날짜 표기 255줄 = agents 48·skills 62·knowledge 145, 이관/폐기 경위 서술 109줄, 최다 밀집은 `knowledge/README.md`)은 **변경 동결 중이라 백로그**다 — 사용자 승인 후 trainer에게 위임한다.

## 에이전트 업그레이드 원칙 (이 프로젝트의 중요원칙)
**1순위는 성능, 2순위가 토큰 효율이다. 사이즈 축소는 목적이 아니라 수단일 뿐이다.**
- 토큰을 조금 더 쓰더라도 **비용 대비 성능 효과가 있으면 업그레이드를 채택한다.** "줄었으니 개선"은 근거가 아니다.
- 슬리밍(`trainer` 모드 6 등)의 정당한 대상은 **성능에 기여하지 않는 것** — 중복 서술, 죽은 참조, 쓰이지 않는 절차뿐이다. 판단이 갈리는 지시는 남긴다.
- 축소 제안의 검증 질문은 "몇 줄/몇 토큰 줄었나"가 아니라 **"이 산출물의 품질이 유지되거나 좋아졌나"**다. 라인 수만 보고한 축소는 미검증으로 다룬다.
- 상시 비용(모든 호출에 물리는 것: 에이전트 MD 본문·`common-*` 스킬)과 조건부 비용(invoke 시에만 로드되는 Skill 본문·knowledge)을 구분해 따진다 — 같은 줄 수라도 부담이 다르다.

> **2026-08-22 실증**: 이 원칙을 어긴 라운드가 실제로 폐기됐다. 86커밋에 걸친 슬리밍·재설계 후 `agents/` 총량이 271,761B → 272,885B로 **오히려 늘었고**(pm/frontend-dev/reviewer −16KB를 evaluator +10.9KB·trainer +7.2KB가 초과), 상시 `common-*`도 +3,411B였다. 라인 수 보고만 믿고 라운드를 이어간 것이 원인이다. 축소 라운드는 **영역 합계를 매번 실측**하고, 옮긴 곳이 늘어난 양까지 같이 세라.

## 변경 동결 원칙 — 배포 이후 (2026-08-22 사용자 지시, 당분간 유효)
**전 직원 배포(v1.7.2, `9ec5183`)가 끝났으므로 업데이트는 보수적으로 간다: 오류·결함 수정과 작은 수정으로 한정한다.**
- **채택 대상**: 실증 가능한 결함(재현 로그·실물 대조·정적검사 ERROR·깨진 참조·실행 불가 도구 호출), 오탈자, 사실 오류 정정, 1파일 국소 수정.
- **보류 대상**: 리팩터링·재설계·슬리밍 라운드·신규 에이전트/스킬 신설·구조 변경. 기각이 아니라 **백로그**에 적어두고 사용자 판단을 기다린다("좋은 아이디어니 지금 하자"로 스스로 승격하지 않는다).
- **판정 기준**: "지금 무엇이 깨져 있는가"에 답할 수 있으면 결함, "이렇게 하면 더 좋아진다"면 개선 → 후자는 보류.
- **면제되지 않는 것**: 위 [편집 권한 경계](#편집-권한-경계-반복적으로-무너져-명문화한다)와 reviewer 검증. 작다고 PM이 직접 `agents/`·`skills/`·`knowledge/`·`hooks/`를 고치지 않는다(오탈자 1줄 예외는 그대로).
- **이유**: 이미 배포된 코드라 변경 비용이 전 직원에게 외부화된다. 직전 라운드(86커밋)가 순효과 없음으로 폐기된 실증이 바로 위에 있다.

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


### 위임 운영 규칙
- **계획을 먼저 받는다.** 대상과 제약만 넘기면 전문 에이전트가 계획을 반환한다. 그 계획의 **채택은 사용자 또는 evaluator가 정한다 — PM 단독 결정 금지.** PM이 남기는 것: 의도 전달 · 실물 대조 검증 · 기록 · 순서.
- **검증 사이클 중 설계 변경 금지.** 아이디어는 적어두고 사이클을 닫은 뒤 판단한다. 크기 초과는 사유서로 끝내고 그 자리에서 고치지 않는다.
- **검증 강도는 등급 판정표를 따른다**(Skill `common-task-grading-and-verification-depth`). "문서만 바뀌었으니 패널 생략"은 **폐기된 규칙**이다 — 풀패널이 잡은 Critical 2건은 문서를 읽어서는 안 보이고 실행해야 보이는 결함이었다.
- **evaluator·reviewer는 항상 병렬.**
- **파일 목록·인용은 그 자리에서 grep·원문 재확인.** 기억을 재사용하면 지시서에 사실 오류가 섞인다.
- **목표 KB를 제시하지 않는다**(사유서로 대신). **지시가 틀렸으면 실행 말고 보고**하게 한다. 기제를 바꿨으면 **도달 증명** — 실제 사용자에게 닿는지 실행으로 보이고, 못 하면 못 했다고 적는다.

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
