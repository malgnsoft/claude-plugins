---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*(?:[Mm]o[Ss][Cc]o[Ww]|Must))'
weight: 1
---

우선순위 의무. planner.md의 prd.md 산출물 계약은 "우선순위 (MoSCoW)"를 구성 요소로 지정한다.
기능이 우선순위 없이 평평하게 나열되면 무엇을 먼저 만들지가 설계·개발 단계로 넘어가버린다.
