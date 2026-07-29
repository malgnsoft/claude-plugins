# STATUS — claude-plugins
_최종 갱신: 2026-07-28 (초기 생성)_
<!-- malgnai-mcp project_id: e3c8eba1-7016-4c40-81fc-7d15cdcefd75 -->

> **claude-plugins** = 클로드코드 플러그인
> **새 세션은 이 파일(라이브 상태) + `CLAUDE.md`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-mcp `get_current_context`, 깊은 문서는 `docs/README.md`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

## 🟢 현재 상태
- 맑은소프트 직원 배포용 클로드코드 플러그인 마켓플레이스 저장소. `malgn-core` 플러그인 1차 구현 완료(marketplace.json에 등록됨). `malgn-danny`, `malgn-djkim`은 아직 미착수.

## ✅ 최근 완료
- **malgn-dev 포터빌리티/일반화 대규모 정리 완료 (2026-07-28)**: `agents`(21, pm.md 포함) + `skills`(35) + 신규 이식된 `knowledge`(61, 전역 `~/.claude/knowledge/`에서 이식, 폐기된 `.lessons-removed-*` 제외) 전체에서 `/Users/hopegiver` 하드코딩 절대경로·저자 개인 프로젝트 전용 경로·"대니/Danny/맑은AI 총괄 COO" 브랜딩을 제거. 최종 grep 재검증: `/Users/hopegiver` 0건, 대니/COO 브랜딩 0건. 총 123개 파일. bin/new-project.mjs·hooks/doc-drift.mjs의 사용법 안내와 check-docs 스크립트(구 issue `e678ad75`)도 플러그인 상대 경로·graceful fallback으로 직접 수정
- **coo.md → pm.md 일반화 + malgn-danny 폐기 (decision `2ccd5cb9`)**: 대니/COO 페르소나·회사전체 게이트웨이 프레이밍을 걷어낸 범용 PM 오케스트레이터를 `malgn-dev/agents/pm.md`로 내장, 별도 `malgn-danny` 플러그인은 삭제하고 marketplace.json에서 제거(마켓플레이스=malgn-dev 단일 플러그인 체제)
- **`malgn-core`→`malgn-dev` 리스코핑 + malgnai-hub 연동 (decision `fbfcd2d5`)**: 전역 에이전트 20종 이관, malgnai-hub(`https://malgnai-hub.apiserver.kr/mcp`) 원격 MCP + `userConfig.device_token` 등록. malgnai-mcp→malgnai-hub 도구명 전면 교체(decision_record/issue_record/work_record/project_get_context/project_search_history), 대응 없는 기능은 "해당 없음" 명시
- malgn-dev에 hook 2종 번들링(SessionStart/Stop), `${CLAUDE_PLUGIN_ROOT}` 기준 포터블화

## 🚧 진행 중 / 다음
- 설치 검증: 실제 클로드코드 세션에서 `/plugin marketplace add <이 저장소 경로>` → `/plugin install malgn-dev@malgnsoft-plugins`로 로드 확인 필요 (아직 미검증), userConfig 디바이스토큰 프롬프트·malgnai-hub 실제 호출도 미검증
- `malgn-djkim`, `malgn-dotype` — 빈 디렉토리만 생성됨. 각 담당자가 채운 뒤 marketplace.json에 등록 필요(빈 디렉토리는 git 미추적)
- 저장소를 GitHub `hopegiver/claude-plugins`에 push해야 `/plugin marketplace add hopegiver/claude-plugins`가 실제로 동작함 — 아직 원격 push 안 됨(로컬 전용)

## ⛔ 막힌 것 / 열린 이슈
- **[high] trainer.md/evaluator.md의 에이전트 승격 파이프라인 도구가 malgn-dev에 미번들** — `bin/promote-*.mjs`, `record-eval.mjs`, `design-review.mjs` 등이 저자 개인 메타 저장소에만 존재. 단순 경로 수정이 아니라 회사 전체용 승격 워크플로우 재설계 필요 — issue `929edddc`
- **[medium] `screen-verification-and-capture` 스킬 + `knowledge/quality/e2e-testing-guide.md`가 개인 설치 `shot` CLI·`~/.claude/tools/` 인프라 전제** — 다른 직원 컴퓨터엔 없음, 도구 번들/설치절차 문서화/스킬 재작성 중 결정 필요 — issue `c3ef5744`
- **[low] `agent-upskill` 스킬의 결과물 저장 위치 애매**(직원 개인 knowledge vs 플러그인 공유 knowledge) — issue `f1913b79`
- new-project.mjs의 `package.json` check-docs가 개인 홈 경로 의존이던 문제는 graceful fallback으로 완화했으나(구 issue `e678ad75`) PATH 안정적 진입점 설계는 여전히 남음
- `global-skill-architecture.md`/`skill-discovery-and-reuse-guide.md`의 예시 스킬 카탈로그가 실제 번들 스킬과 불일치(cosmetic, 낮은 우선순위)
