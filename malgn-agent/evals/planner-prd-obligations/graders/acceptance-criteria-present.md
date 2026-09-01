---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*인수\s*조건)'
weight: 1
---

인수 조건 구체화 의무의 결정론적 하한선. planner.md는 "로그인 가능"류 서술을 금지하고
실제 수치·UI 문구를 박아 개발자 추측을 제거한 인수 조건을 요구한다. 여기서는 인수 조건
항목이 PRD에 아예 존재하는지만 본다(구체성의 질은 이 그레이더가 판단하지 않는다).
