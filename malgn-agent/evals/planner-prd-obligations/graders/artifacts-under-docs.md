---
type: regex
target: files
pattern: '^(?=[\s\S]*docs/requirements\.md)(?=[\s\S]*docs/prd\.md)'
weight: 1
---

기획 산출물이 흩어지지 않고 전부 프로젝트 루트의 `docs/` 아래에 저장되었는가
(planner.md "문서 저장 위치" 원칙: 모든 산출물은 프로젝트 루트의 `docs/`에 저장한다).
