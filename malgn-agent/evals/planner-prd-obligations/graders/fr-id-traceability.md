---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*FR-0*1)(?=[\s\S]*FR-0*2)'
weight: 1
---

FR-ID 추적성 의무. planner.md는 "각 기능에 ID 부여 → 설계·개발·QA까지 추적 가능하게 구성"과
"기능 요구사항 (FR-ID 매트릭스 + 인수 조건)"을 요구한다. 기능 요구사항이 자유 목록이 아니라
번호가 붙은 ID 체계로 정리되었는지를 최소 2건 이상의 FR-ID 존재로 본다.
