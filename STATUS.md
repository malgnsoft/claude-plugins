---
provider: malgnai-mcp
project_id: e3c8eba1-7016-4c40-81fc-7d15cdcefd75
---

# STATUS — claude-plugins
_최종 갱신: 2026-08-10 (token-usage-diagnosis 스킬 v1.2.1 배포 완료 + 동시세션 게이트우회 이슈 해소)_

> **claude-plugins** = 클로드코드 플러그인
> **새 세션은 이 파일(라이브 상태) + `CLAUDE.md`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-mcp `get_current_context`, 깊은 문서는 `docs/README.md`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

## 🟢 현재 상태
- **malgn-agent v1.2.1** (agents 21·skills 35·knowledge 49·hooks 4). 2026-08-07 방법론 rubric 기반 전면 재구축(v1.0) 이후 지속 개정 중. `/plugin marketplace add hopegiver/claude-plugins` → `/plugin install malgn-agent@malgnsoft-plugins` **실제 설치·업데이트 사이클을 로컬 재현으로 검증 완료**(마켓플레이스 clone 갱신 → plugin.json 버전 bump → `claude plugin update` → 새 캐시 반영까지 end-to-end 확인). 단, userConfig 디바이스토큰 입력·malgnai-hub 실제 MCP 호출은 아직 미검증.
- 이 착수 이전 기준선: `malgn-agent` 플러그인 1차 구현(marketplace.json에 등록됨). `malgn-danny`는 폐기, `malgn-djkim`/`malgn-dotype`은 아직 미착수.

## ✅ 최근 완료
- **⚠️ 동시 세션의 공유 작업디렉터리로 인한 evaluator 게이트 우회 발생 → 즉시 해소 (2026-08-10, issue `15e78319`resolved, memory `415bace4`)**: trainer 서브에이전트가 브랜치 전환하는 사이 무관한 다른 세션(@import 작업)이 그 브랜치 위에서 커밋·push해, 미검증 스킬 초안(개인정보 경고 누락)이 그대로 origin/main·v1.2.0에 배포됨. 사용자 승인 하에 수정 PR 즉시 머지(merge commit `a9d7206`)로 노출 창 닫음, origin/main 실측 재확인 완료. **근본 원인(git working dir 공유) 미해결** — 후속: 에이전트 브랜치 작업 시 `git worktree` 격리 도입 검토.
- **직원 토큰 과다사용 진단 도구 → malgn-agent 정식 스킬 `token-usage-diagnosis` 배포 완료 (2026-08-10, decision `9d9e03f8`/`1afa8aca`/`241e3ee0`, PR [#1](https://github.com/hopegiver/claude-plugins/pull/1), v1.2.1)**: 각 직원 로컬 로그(`~/.claude/projects/**/*.jsonl`)는 그 PC에서만 읽을 수 있어 셀프서비스 자가진단 도구로 설계(`malgn-agent/bin/analyze-usage.mjs`, 무의존성 Node). trainer 작성 → reviewer 4인 페르소나 풀패널(GO-with-fix, Major 1건: 반복호출 표의 도구 input 원문 노출 위험) → trainer가 SKILL.md 경고문 보강으로 반영 → evaluator rubric 재검증(PASS) + git PR 승격 + v1.2.1 bump. 명명은 무접두어(참조 에이전트 pm.md 1개).
- **PM 블록 전파방식 @import 우선+훅 드리프트가드 전환 완료 + v1.2.0 배포 (2026-08-10, WBS `524b6650` 완료, decision `c0cea472`, commit `04e5819`)**: architect 설계 → backend-dev 구현(`pm-orchestration-nudge.mjs`) → reviewer 3인 풀패널 8개 시나리오 실행검증(GO-with-fix, Major 1건[문서만] 즉시 반영). 산출물 `docs/reviewer/review-pm-import-implementation-2026-08-10.md`.
- **claude-plugins 자체 CLAUDE.md에 PM 블록 설치 + 넛지→AskUserQuestion→Edit 플로우 실사용 검증 (2026-08-10, decision `0eb2b270`)**: hooks.json 3개·SessionStart 2단계·마커 기반 상태전이 설명 후 AskUserQuestion으로 설치 동의 → `installed:v1` 마커 추가.
- **PM 오케스트레이션 블록: 복사 방식 → 훅 상시주입 방식 전환 + v1.1.0 배포 (2026-08-10, decision `5da7f043`, commit `7b9a197`+`5e466c0`)**: 이후 @import 방식으로 재전환됨(위 항목 참고) — 이 결정은 중간 경유지였음.
- **⚠️ 위 훅 상시주입 방식이 재검토로 회귀(regression)로 판명 (2026-08-10, decision `3d237511`)**: reviewer·trainer 교차검토로 회귀 실재 확인 → architect에게 @import 전환 설계 위임(WBS `524b6650`, 위 항목에서 완료).

## 🚧 진행 중 / 다음
- **후속 필요**: 동시 세션이 같은 저장소를 쓸 때 git worktree로 작업디렉터리 격리(memory `415bace4`) — 브랜치 작업을 위임할 때 `isolation: "worktree"` 적용을 기본으로 검토.
- **병행 후속 후보(비차단)**: `verifiable-output-and-honesty` skill description에 PM/메인세션 named audience 추가 — trainer 검토 권고. PM 블록 전파방식 3중 레이어 대신 하이브리드(요약문 물리기재) 재조명 — reviewer 발산형 페르소나 제기, 다음 개정 사이클 후보.
- **미검증**: malgnai-hub userConfig 디바이스토큰 입력 플로우 + 실제 MCP 호출 정상 동작(설치 메커니즘 자체는 검증 완료, 이 부분만 남음).
- `malgn-djkim`, `malgn-dotype` — 빈 디렉토리만 생성됨, 각 담당자가 채운 뒤 marketplace.json에 등록 필요

## ⛔ 막힌 것 / 열린 이슈
- 없음 (오늘 이슈 2건 모두 해소: `7d2bcdd6`/`80c297cd`)
