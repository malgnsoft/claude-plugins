---
type: regex
target: { source: file, path: docs/api-spec.md }
pattern: '^(?=[\s\S]*에러)(?=[\s\S]*권한)(?=[\s\S]*검증)'
weight: 2
---

④완결성 의무(API). architect.md는 "API마다 요청/응답 JSON 예시 + 에러 응답 + 권한 규칙 +
검증 규칙 필수"를 요구한다. 그중 문서 전체에서 기계적으로 확인 가능한 3항목
(에러 응답 · 권한 규칙 · 검증 규칙)의 존재를 본다.
