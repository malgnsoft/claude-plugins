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

> **정확성 보증:** 새 세션 시작 시 드리프트 가드가 `.claude/doc-drift.json`으로 문서↔코드를 대조. 수동 `pnpm run check-docs`.
