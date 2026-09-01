---
type: regex
target: files
pattern: '^(?=[\s\S]*tests/[^\n]*\.(?:mjs|cjs|js|ts))(?=[\s\S]*tests/test-report\.md)'
weight: 1
---

산출물 위치 계약. qa-engineer.md의 산출물 절은 `tests/` 디렉토리(단위·통합 테스트)와
`tests/test-report.md`를 지정하고, 자기 검증은 "`tests/` 디렉토리에 단위·통합 테스트가 실제
존재하는가"를 묻는다. 테스트 코드와 보고서가 약속된 자리에 함께 있는지 본다.
