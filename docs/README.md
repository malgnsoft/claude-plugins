# docs/ 문서 지도 (에이전트 진입점)

> 무엇을 어디서 읽을지 여기서 먼저 확인. 현 상태의 정답은 항상 코드 + `/STATUS.md`.

## 🧭 먼저 읽을 것
1. `/STATUS.md` — 현재 진행 상태(단일 소스)
2. `/CLAUDE.md` — 개요·구조·규칙
3. malgnai-hub `project_get_context`/`project_search_history` — 검색 가능한 결정/이슈/메모리(projectId는 STATUS.md 상단 `project_id`)

## 📂 폴더
- `anthropic/` — Claude Code/Platform 공식 문서 마크다운 원문 미러 23건(에이전트·스킬·훅·플러그인·레퍼런스). 사양 확인은 모델 기억이나 검색 요약이 아니라 여기 원문으로 한다. 갱신 `pnpm run sync-docs`(변경 확인만 `sync-docs:check`)
- `architecture/` — 설계·명세
- `analysis/` — 노하우·구조 분석
- `evaluation/` — 평가·감사 스펙 리포트
- `guides/` — 현행 운영/개발 가이드. 단 `guides/agent-development-methodology.md`는 v0.1 초안 보존본이며 판정 기준 정본이 아니다(정본은 `methodology/` 참조)
- `methodology/` — malgn-agent 에이전트 개발방법론(rubric)·전수감사·결정로그·최종검증보고서(2026-08-07). 신규 agent/skill/knowledge 작성 시 `agent-development-methodology.md`가 판정 기준
- `refactor/` — 리팩터링 스펙·사유서
- `reviewer/` — 리뷰 페르소나 정의·리뷰 보고서
- `roadmap/` — 미채택/보류 설계 메모(배포판 malgn-agent에는 미포함)
- `decision/` — 이 저장소 자신의 운영 결정 아카이브
- `archive/` — 루트 `STATUS.md` 에서 덜어낸 지나간 라운드 이력(원문 그대로). STATUS.md 는 L0 오리엔테이션 크기로 유지하고, 이력은 여기로 옮긴다

> **참고:** 자동 드리프트 가드는 현재 없다. 구조가 바뀌면 이 지도를 손으로 갱신하고 `pnpm run check-docs`로 결과를 확인한다.
