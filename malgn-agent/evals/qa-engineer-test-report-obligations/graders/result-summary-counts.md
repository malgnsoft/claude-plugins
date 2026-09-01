---
type: regex
target: { source: file, path: tests/test-report.md }
pattern: '^(?=[\s\S]*통과)(?=[\s\S]*실패)(?=[\s\S]*커버리지)'
weight: 2
---

결과 요약 의무. qa-engineer.md는 test-report.md에 "테스트 결과 요약 (전체/통과/실패 수,
커버리지)"를 요구하고, 자기 검증에서도 같은 항목을 다시 확인한다. 통과·실패 수와 커버리지가
빠지면 "몇 개를 무엇으로 확인했는지"가 남지 않아 다음 회차와 대조할 수 없다.
