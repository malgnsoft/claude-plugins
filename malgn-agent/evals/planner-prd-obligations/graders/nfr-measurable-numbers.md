---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*NFR-0*1)(?=[\s\S]*\d+\s*(?:ms|밀리초|초|분|시간|%|건|명|개소|MB|GB))'
weight: 2
---

비기능 요구사항 의무. planner.md는 "보안/성능/가용성/접근성 등 카테고리별, **모든 NFR에
측정 가능한 수치**"를 요구한다. NFR이 ID 체계로 정리되어 있고 그 서술에 단위가 붙은 수치가
실제로 들어 있는지 본다. "빨라야 한다"류 무수치 서술만 있으면 통과하지 못한다.
