---
type: regex
target: files
pattern: '^(?=[\s\S]*docs/architecture\.md)(?=[\s\S]*docs/tech-stack\.md)(?=[\s\S]*docs/api-spec\.md)(?=[\s\S]*docs/data-model\.md)'
weight: 1
---

4종이 흩어지지 않고 전부 프로젝트 루트의 `docs/` 아래에 저장되었는가
(architect.md "문서 저장 위치" 원칙).
