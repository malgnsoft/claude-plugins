---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*경쟁사)(?=[\s\S]*(?:스톡온|StockOn))(?=[\s\S]*(?:카운트업|CountUp))'
weight: 1
---

경쟁사 비교표 의무의 결정론적 하한선. planner.md는 "경쟁사 3~5곳을 선정해 핵심기능 유무를
행렬로 정리"하고 차별점 서술이 그 표의 셀을 인용하도록 요구한다. 여기서는 시장 스캔 자료의
실제 경쟁사가 PRD 안에 문자로 들어왔는지만 본다(인용의 질은 `differentiator-cites-table-cell`이 본다).

정규식으로 분리한 이유: 판정 모델은 긴 문서에서 노이즈가 커진다(하네스가 8,000자 초과 시
경고를 붙인다). 표가 있는가 같은 사실 판정은 판정 모델에 맡기지 않는다.
