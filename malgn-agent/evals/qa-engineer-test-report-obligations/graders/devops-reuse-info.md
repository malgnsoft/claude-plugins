---
type: regex
target: { source: file, path: tests/test-report.md }
pattern: '^(?=[\s\S]*커밋)(?=[\s\S]*외부\s*API)'
weight: 1
---

하류 인계 의무. qa-engineer.md는 test-report.md에 "devops 재사용 정보: 테스트 시점 커밋 해시,
실행한 핵심 시나리오 ID 목록, 목업 처리한 외부 API 목록"을 요구한다. 이 정보가 없으면 devops가
"무엇을 어느 시점 코드로 검증한 결과인지" 알 수 없어 배포 판단에 재사용하지 못한다.
