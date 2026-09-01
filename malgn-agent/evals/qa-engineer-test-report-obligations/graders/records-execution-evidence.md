---
type: regex
target: { source: file, path: tests/test-report.md }
pattern: '^(?=[\s\S]*(?:node\s+--test|npm\s+test|pnpm\s+test|vitest|jest))'
weight: 1
---

실행 증거 의무. qa-engineer.md는 "**테스트를 실제로 실행하세요.** 코드 작성만으로는
불완전합니다"를 핵심 원칙으로 두고, 자기 검증에서 "모든 테스트가 Bash로 실행되고 통과하는가"를
묻는다. 보고서에 실행한 명령이 남아 있는지로 그 하한선을 본다 — 실행 명령이 없으면 결과 수치가
실행에서 나온 것인지 작성자가 적어 넣은 것인지 구분되지 않는다.
