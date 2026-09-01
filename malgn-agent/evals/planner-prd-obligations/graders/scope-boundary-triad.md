---
type: regex
target: { source: file, path: docs/prd.md }
pattern: '^(?=[\s\S]*가정)(?=[\s\S]*(?:범위\s*제외|제외|Out of [Ss]cope))(?=[\s\S]*(?:미결|Open [Qq]uestion))'
weight: 2
---

범위 경계 의무. planner.md는 가정(Assumptions)·범위제외(Out of Scope)·미결사항(Open Questions)을
**3중으로** 명시해 누락이 아닌 의도된 결정임을 증명하라고 요구한다. 셋 중 하나라도 빠지면
"적지 않은 것이 누락인지 결정인지" 구분되지 않으므로 세 축이 모두 있어야 통과한다.
