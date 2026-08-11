---
provider: malgnai-mcp
project_id: e3c8eba1-7016-4c40-81fc-7d15cdcefd75
---

# STATUS — claude-plugins
_최종 갱신: 2026-08-11 (공통문서 반복-Read 방지 원칙, 병렬 다중 에이전트 케이스까지 확장 — PR #5 병합)_

> **claude-plugins** = 클로드코드 플러그인
> **새 세션은 이 파일(라이브 상태) + `CLAUDE.md`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-mcp `get_current_context`, 깊은 문서는 `docs/README.md`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

## 🟢 현재 상태
- **malgn-agent v1.3.0** (agents 21·skills 35·knowledge 49·hooks 4, 2026-08-11 PR [#4](https://github.com/hopegiver/claude-plugins/pull/4) 병합). 2026-08-07 방법론 rubric 기반 전면 재구축(v1.0) 이후 지속 개정 중. `/plugin marketplace add hopegiver/claude-plugins` → `/plugin install malgn-agent@malgnsoft-plugins` **실제 설치·업데이트 사이클을 로컬 재현으로 검증 완료**(마켓플레이스 clone 갱신 → plugin.json 버전 bump → `claude plugin update` → 새 캐시 반영까지 end-to-end 확인). 단, userConfig 디바이스토큰 입력·malgnai-hub 실제 MCP 호출은 아직 미검증.
- 이 착수 이전 기준선: `malgn-agent` 플러그인 1차 구현(marketplace.json에 등록됨). `malgn-danny`는 폐기, `malgn-djkim`/`malgn-dotype`은 아직 미착수.

## ✅ 최근 완료
- **공통문서 반복-Read 방지 원칙, 병렬 다중 에이전트 케이스까지 확장 — PR [#5](https://github.com/hopegiver/claude-plugins/pull/5) 병합 완료 (2026-08-11, decision `a13864a2`→`f5e131f4`, commit `e7852c7`)**: 계기는 사용자 제안 — PM이 여러 에이전트에게 같은 프로젝트 산출물 검토·토론을 위임할 때 각자 Read하지 말고 위임자가 1회 Read해 인라인 전달하면 낭비를 줄일 수 있다는 지적. 새 스킬 신설 대신 기존 `common-token-efficient-collaboration` §2("순회 대조 반복-Read 방지", 67.5% 실측 근거 보존)를 "병렬 다중 에이전트가 동일 대상 검토·토론" 케이스까지 포괄하도록 확장하고, `reviewer-persona-panel-standard` §2에 2줄 교차참조 추가(domain-shipley-proposal-methodology·project-orchestration은 조사 결과 기존 참조로 이미 커버돼 수정 불필요 판정). trainer 초안→PM 원문대조 검증→evaluator 게이트 PASS(Standard 등급, 자체 merge). WBS `84ce0298` 완료.
- **reviewer 반복 재검토 축소/증분 모드 도입 — main 병합 완료 (2026-08-11, commit `418a52c`, decision `32289d46`→`8ec95b89`)**: 계기는 사용자 지적 — 같은 기능 하루 3회 재수정 시마다 매번 풀패널+신규 페르소나가 돌아 토큰 낭비 실측. target_id 기반 동일대상 판정(4조건 AND) + Full/Incremental/Abridged 3단계 모드 + 페르소나 재사용 강제(INDEX.md 신설). architect 설계→trainer 반영→reviewer 풀패널 자기검증(🟡 Amber, Major 3건 — 특히 RV-001: 이 PR의 신규규칙이 기존 페르소나 3개에 소급 안 돼 배포 직후 첫 리뷰에서 같은 문제 재발)→RV-002/003 최소반영→사용자 승인→병합. RV-001/004/007은 비차단 후속과제로 아래 "진행 중/다음"에 이관. 산출물 `docs/decision/reviewer-repeat-review-reduction-design.md`, `docs/reviewer/review-reviewer-repeat-review-reduction-2026-08-10.md`.
- **malgnai-hub 대상 프로젝트 부트스트랩 재설계 → v1.3.0 배포 완료 (2026-08-11, PR [#4](https://github.com/hopegiver/claude-plugins/pull/4) 병합, decision `b6797f0f`→`7890dc69`원복→`42c571fb`병합완료, issue `22789b9e`)**: 계기는 세션당 STATUS.md 2회 중복주입 낭비 실측(전역개인훅+플러그인훅) — "STATUS.md 폐기+훅 제거"로 갔다가 "없을 때 손해가 더 크다"는 재평가로 전면 원복, 최종적으로 STATUS.md는 유지하되 ①3필드(provider/project_id/repository_key) ②1000토큰 캡 ③재작성 트리거 6가지 제한 ④git 추적 제외(개인 로컬 캐시화)로 "저비용화". PM 행동규율 블록(`pm-orchestration-block.md`)은 반대로 매세션 훅→스캐폴딩 1회+온디맨드 스킬로 전환(토론문화 원칙 1줄도 v1→v2로 추가). malgnai-hub 실서버 소스 직접 검증으로 "project_id는 직원별로 다름, repositoryKey가 진짜 공유 식별자"라는 사실 확인(재사용 가치 높은 교훈, memory `4a0c1ee9`/`d7b95c77`). architect 설계 2라운드→trainer 구현 2라운드→reviewer 2라운드(1차 Amber→2차 Green GO)→evaluator 게이트PASS+PR생성(Sensitive 등급이라 자체 merge 안 함)→사용자 승인→PM 병합, 전 과정 WBS `b5482423` 추적. 개인 전역 훅(`~/.claude/hooks/session-context.mjs`) 중복은 이번 범위 밖, 사용자 지시로 삭제 보류 중.
- **token-usage-diagnosis 3축 집계(도구별/서브에이전트별/프로젝트별) + 세션별 프롬프트 요약 → v1.2.3 배포 완료 (2026-08-11, decision `17093efb`/`f32e557a`/`16551511`, PR [#3](https://github.com/hopegiver/claude-plugins/pull/3))**: trainer 구현 → reviewer 4페르소나 풀패널 GO(Major였던 프롬프트노출은 `--out` 옵션 제거+캐비어트 최소복원으로 해소) → evaluator 독립 재검증 PASS+merge+bump. Minor 3건·Rethink 1건은 non-blocking 백로그.
- **git worktree 격리, 동시세션 브랜치공유 문제의 실질 해결책으로 실증 (2026-08-10, issue `004b8d98`resolved, memory `304c066d`)**: 서브에이전트 브랜치 작업 위임 시 `isolation:"worktree"` 적용 → main 워킹디렉터리 오염 없이 커밋이 공유 브랜치에 정상 반영됨 확인. **앞으로 기존 브랜치 위 후속 작업 위임 시 기본 적용.**
- **⚠️ 동시 세션의 공유 작업디렉터리로 인한 evaluator 게이트 우회 발생 → 즉시 해소 (2026-08-10, issue `15e78319`resolved, memory `415bace4`)**: 미검증 스킬 초안이 잠시 origin/main·v1.2.0에 배포됐다가 즉시 수정 PR 머지로 노출 창 닫음. 근본 원인은 위 worktree 격리로 해결.
- **직원 토큰 과다사용 진단 도구 → malgn-agent 정식 스킬 `token-usage-diagnosis` 최초 배포 (2026-08-10, decision `9d9e03f8`/`1afa8aca`/`241e3ee0`, PR [#1](https://github.com/hopegiver/claude-plugins/pull/1), v1.2.1)**: 셀프서비스 자가진단 도구(`malgn-agent/bin/analyze-usage.mjs`, 무의존성 Node)로 설계, 명명은 무접두어.
## 🚧 진행 중 / 다음
- **reviewer 반복재검토 축소 메커니즘 비차단 후속과제**: RV-001(기존 페르소나 3개 정체성 본문을 라운드 서사 없이 일반화 소급정리), RV-004(reviewer-persona-panel-standard SKILL.md §2.5 물리적 위치를 §2 직후로 이동 또는 §5.5로 재번호), RV-007(INDEX.md 동시편집 위험 — git worktree 격리와 묶어 검토). 다음에 동일 target_id(`reviewer-repeat-review-reduction`)로 재위임이 발생하면 축소/증분 모드가 설계대로 작동하는지 실전 재검증 필요(아직 시뮬레이션 검증만 됨).
- **병행 후속 후보(비차단)**: malgnai-hub 부트스트랩 Tier2 — knowledge 문서 "5~7개" 잔존 표현(RV2-02), pm.md Micro등급 문구 재확인(RV2-03), STATUS.md 쪽에도 PM블록처럼 "훅 완전제거" 패턴 적용 검토(reviewer 발산형 Rethink), repositoryKey를 git remote 슬러그 기반으로 개정, 개인 전역 훅(`~/.claude/hooks/session-context.mjs`) 삭제(사용자 지시로 보류 중). `verifiable-output-and-honesty` skill description에 PM/메인세션 named audience 추가 — trainer 검토 권고. PM 블록 전파방식 3중 레이어 대신 하이브리드(요약문 물리기재) 재조명 — reviewer 발산형 페르소나 제기, 다음 개정 사이클 후보. token-usage-diagnosis Minor 3건(RV-102~104)·Rethink 1건(RV-108, 서브에이전트 집계 sidechain 실비용 미반영) — 다음 개정 사이클 후보.
- **미검증**: malgnai-hub userConfig 디바이스토큰 입력 플로우 + 실제 MCP 호출 정상 동작(설치 메커니즘 자체는 검증 완료, 이 부분만 남음).
- `malgn-djkim`, `malgn-dotype` — 빈 디렉토리만 생성됨, 각 담당자가 채운 뒤 marketplace.json에 등록 필요

## ⛔ 막힌 것 / 열린 이슈
- 없음 (오늘 이슈 2건 모두 해소: `7d2bcdd6`/`80c297cd`)
