---
type: regex
target: { source: file, path: docs/architecture.md }
pattern: '^(?=[\s\S]*(?:타임아웃|timeout))(?=[\s\S]*멱등)'
weight: 2
---

③비정상 케이스 의무. 이 PRD는 오프라인 큐잉 후 재동기화(FR-03 "중복 전송·부분 실패
대응 필요")를 명시하므로 멱등성 설계가 빠지면 안 된다. 외부 호출 타임아웃과 멱등성이
아키텍처 문서에 실제로 설계되었는지 본다.
