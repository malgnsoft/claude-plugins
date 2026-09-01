---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*(?<![A-Za-z])FR?-0*1)(?=[\s\S]*(?<![A-Za-z])FR?-0*2)'
weight: 1
---

FR-ID 추적성 의무. planner.md는 "각 기능에 ID 부여 → 설계·개발·QA까지 추적 가능하게 구성"과
"기능 요구사항 (FR-ID 매트릭스 + 인수 조건)"을 요구한다. 기능 요구사항이 자유 목록이 아니라
번호가 붙은 ID 체계로 정리되었는지를 최소 2건 이상의 FR-ID 존재로 본다.

**라벨 표기 두 갈래를 모두 받는다.** planner가 필수로 참조하는 자료들이 한 가지 표기로 통일돼
있지 않다 — `knowledge/planning/prd-craft-patterns.md`의 요구사항 표는 `FR-001`을 쓰고,
`knowledge/planning/requirements-analysis.md`의 PRD 골격은 `F-001`을 쓴다. 지시받은 대로 썼는데
채점에서 떨어지는 일이 없도록 `FR?-`로 둘 다 받는다.

**`NFR-001`에 걸리지 않게 앞을 막는다.** 앞에 영문자가 없어야 한다는 조건(`(?<![A-Za-z])`)이
없으면 `NFR-001`·`NFR-002`의 부분문자열로도 통과해, **기능 요구사항이 하나도 없고 비기능
요구사항만 있는 문서가 이 그레이더를 통과한다.** 비기능 요구사항 쪽은 `nfr-measurable-numbers`가
따로 잰다.
