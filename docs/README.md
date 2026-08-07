# docs/ 문서 지도 (에이전트 진입점)

> 무엇을 어디서 읽을지 여기서 먼저 확인. 현 상태의 정답은 항상 코드 + `/STATUS.md`.

## 🧭 먼저 읽을 것
1. `/STATUS.md` — 현재 진행 상태(단일 소스)
2. `/CLAUDE.md` — 개요·구조·규칙
3. malgnai-mcp `get_current_context` — 검색 가능한 결정/이슈/메모리

## 📂 폴더
- `vision/` — 아이디어·비전
- `architecture/` — 설계·명세
- `guides/` — 현행 운영/개발 가이드
- `history/` — 회고·리뷰·작업이력
- `methodology/` — malgn-agent 에이전트 개발방법론(rubric)·전수감사·결정로그·최종검증보고서(2026-08-07). 신규 agent/skill/knowledge 작성 시 `agent-development-methodology.md`가 판정 기준
- `roadmap/` — 미채택/보류 설계 메모(배포판 malgn-agent에는 미포함)
- `decision/` — 이 저장소 자신의 운영 결정 아카이브

> **정확성 보증:** 새 세션 시작 시 드리프트 가드가 `.claude/doc-drift.json`으로 문서↔코드를 대조. 수동 `pnpm run check-docs`.
