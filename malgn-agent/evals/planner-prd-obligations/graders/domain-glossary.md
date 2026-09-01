---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*용어)(?=[\s\S]*식별자)'
weight: 1
---

도메인 용어 사전 의무. planner.md는 "한국어 | 코드 식별자 | 정의 형태로 용어를 1:1 고정하여
기획·설계·개발·DB가 같은 용어를 씁니다"를 요구하고, 산출물 계약에도 이 사전을 prd.md 구성
요소로 못박는다. 용어 사전 항목과 코드 식별자 축이 실제로 존재하는지 본다.
