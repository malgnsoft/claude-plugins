---
provider: malgnai-mcp
project_id: e3c8eba1-7016-4c40-81fc-7d15cdcefd75
---

# STATUS — claude-plugins
_최종 갱신: 2026-08-11 (malgnai-hub 부트스트랩 재설계 — evaluator 게이트 PASS, PR #4 오픈, Sensitive 등급이라 merge는 사람 승인 대기)_

> **claude-plugins** = 클로드코드 플러그인
> **새 세션은 이 파일(라이브 상태) + `CLAUDE.md`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-mcp `get_current_context`, 깊은 문서는 `docs/README.md`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

## 🟢 현재 상태
- **malgn-agent v1.2.3** (agents 21·skills 35·knowledge 49·hooks 4). 2026-08-07 방법론 rubric 기반 전면 재구축(v1.0) 이후 지속 개정 중. `/plugin marketplace add hopegiver/claude-plugins` → `/plugin install malgn-agent@malgnsoft-plugins` **실제 설치·업데이트 사이클을 로컬 재현으로 검증 완료**(마켓플레이스 clone 갱신 → plugin.json 버전 bump → `claude plugin update` → 새 캐시 반영까지 end-to-end 확인). 단, userConfig 디바이스토큰 입력·malgnai-hub 실제 MCP 호출은 아직 미검증.
- 이 착수 이전 기준선: `malgn-agent` 플러그인 1차 구현(marketplace.json에 등록됨). `malgn-danny`는 폐기, `malgn-djkim`/`malgn-dotype`은 아직 미착수.

## ✅ 최근 완료
- **malgnai-hub 대상 프로젝트 부트스트랩 재설계 — "STATUS.md 폐기" 시도 후 원복, "저비용화"로 최종 확정 (2026-08-11, decision `b6797f0f`→`7890dc69`로 원복, issue `22789b9e`, memory `4a0c1ee9`/`d7b95c77`/`23682461`)**: 세션당 STATUS.md 2회 중복주입 낭비(전역 개인훅+플러그인훅) 실측을 계기로 architect가 "STATUS.md 폐기+SessionStart 훅 제거"안을 설계했으나, 사용자가 "없을 때 손해가 더 크다"고 재평가해 전면 원복 — STATUS.md 유지, 대신 ①YAML 3필드(provider/project_id/repository_key)로 축소 ②1000토큰 캡 ③재작성 트리거 6가지로 제한(중요완료/WBS변경/설계결정/blocker/세션종료/compact직전)로 "저비용화". malgnai-hub 실서버 소스(`~/workspace/malgnai-public`) 직접 검증으로 "project_id는 직원별로 다르게 발급되며 어떤 도구도 입력파라미터로 안 받는다, repositoryKey가 진짜 공유 식별자"라는 사실도 확인. 원인이었던 "개인 전역 훅 중복"(`~/.claude/settings.json`의 `session-context.mjs`) 자체는 이번 결정으로 해소되지 않음 — 삭제는 사용자 지시로 보류, 당분간 중복 허용. 설계문서(`docs/decision/malgnai-hub-project-bootstrap-redesign.md`, 워크트리 `agent-a1fba4b8d23d957bf`) 완료, Tier 1 구현(`new-project.mjs`/`project-standards/SKILL.md`/`pm.md`)은 trainer에게 위임해 진행 중.
- **token-usage-diagnosis 3축 집계(도구별/서브에이전트별/프로젝트별) + 세션별 프롬프트 요약 → v1.2.3 배포 완료 (2026-08-11, decision `17093efb`/`f32e557a`/`16551511`, PR [#3](https://github.com/hopegiver/claude-plugins/pull/3))**: trainer 구현 → reviewer 4페르소나 풀패널 GO(Major였던 프롬프트노출은 `--out` 옵션 제거+캐비어트 최소복원으로 해소) → evaluator 독립 재검증 PASS+merge+bump. Minor 3건·Rethink 1건은 non-blocking 백로그.
- **git worktree 격리, 동시세션 브랜치공유 문제의 실질 해결책으로 실증 (2026-08-10, issue `004b8d98`resolved, memory `304c066d`)**: 서브에이전트 브랜치 작업 위임 시 `isolation:"worktree"` 적용 → main 워킹디렉터리 오염 없이 커밋이 공유 브랜치에 정상 반영됨 확인. **앞으로 기존 브랜치 위 후속 작업 위임 시 기본 적용.**
- **⚠️ 동시 세션의 공유 작업디렉터리로 인한 evaluator 게이트 우회 발생 → 즉시 해소 (2026-08-10, issue `15e78319`resolved, memory `415bace4`)**: 미검증 스킬 초안이 잠시 origin/main·v1.2.0에 배포됐다가 즉시 수정 PR 머지로 노출 창 닫음. 근본 원인은 위 worktree 격리로 해결.
- **직원 토큰 과다사용 진단 도구 → malgn-agent 정식 스킬 `token-usage-diagnosis` 최초 배포 (2026-08-10, decision `9d9e03f8`/`1afa8aca`/`241e3ee0`, PR [#1](https://github.com/hopegiver/claude-plugins/pull/1), v1.2.1)**: 셀프서비스 자가진단 도구(`malgn-agent/bin/analyze-usage.mjs`, 무의존성 Node)로 설계, 명명은 무접두어.
- **PM 블록 전파방식 @import 우선+훅 드리프트가드 전환 완료 + v1.2.0 배포 (2026-08-10, WBS `524b6650` 완료, decision `c0cea472`, commit `04e5819`)**: reviewer 3인 풀패널 8개 시나리오 실행검증(GO-with-fix). 산출물 `docs/reviewer/review-pm-import-implementation-2026-08-10.md`.
- **claude-plugins 자체 CLAUDE.md에 PM 블록 설치 + 넛지→AskUserQuestion→Edit 플로우 실사용 검증 (2026-08-10, decision `0eb2b270`)**.

## 🚧 진행 중 / 다음
- **⏸️ malgnai-hub 부트스트랩 재설계 — evaluator 게이트 PASS, PR [#4](https://github.com/hopegiver/claude-plugins/pull/4) 오픈, merge는 사람 승인 대기 (2026-08-11, decision `b9ada430`)**: 워크트리 `agent-a1fba4b8d23d957bf`(`d1d44a1`→`90f750b`, plugin.json v1.2.3→v1.3.0 bump 포함). evaluator가 독립 재검증(`sessionstart-context.mjs` 불변식 빈 diff 확인, `hooks.json`에서 `pm-orchestration-nudge.mjs` 제거 확인, `node --check` 4개 스크립트 통과, 이식성/malgnai-hub 도구명 정합 확인) 후 PR을 생성했다 — 판정 체크리스트 전부 PASS, Critical/Major 0건. **단, reviewer 최종 리뷰가 이 변경을 "Sensitive 상당(회사 전체 배포용 스캐폴딩+훅 구조 변경)"으로 등급 판정**했으므로 evaluator가 스스로 merge하지 않고 PR body에 경고를 남긴 뒤 반환했다 — **다음 단계는 사람이 PR #4를 승인(Approve+Merge)하는 것**. Tier 2 백로그(비차단, merge 이후 별도 세션): knowledge 문서 "5~7개" 잔존 표현(RV2-02), pm.md Micro등급 문구 재확인(RV2-03), STATUS.md 쪽에도 "훅 완전제거" 패턴 적용 검토(발산형 Rethink), repositoryKey를 git remote 슬러그 기반으로 개정. 개인 전역 훅(`~/.claude/settings.json`의 `session-context.mjs`) 삭제는 사용자 지시로 보류.
- **병행 후속 후보(비차단)**: `verifiable-output-and-honesty` skill description에 PM/메인세션 named audience 추가 — trainer 검토 권고. PM 블록 전파방식 3중 레이어 대신 하이브리드(요약문 물리기재) 재조명 — reviewer 발산형 페르소나 제기, 다음 개정 사이클 후보. token-usage-diagnosis Minor 3건(RV-102~104)·Rethink 1건(RV-108, 서브에이전트 집계 sidechain 실비용 미반영) — 다음 개정 사이클 후보.
- **미검증**: malgnai-hub userConfig 디바이스토큰 입력 플로우 + 실제 MCP 호출 정상 동작(설치 메커니즘 자체는 검증 완료, 이 부분만 남음).
- `malgn-djkim`, `malgn-dotype` — 빈 디렉토리만 생성됨, 각 담당자가 채운 뒤 marketplace.json에 등록 필요

## ⛔ 막힌 것 / 열린 이슈
- 없음 (오늘 이슈 2건 모두 해소: `7d2bcdd6`/`80c297cd`)
