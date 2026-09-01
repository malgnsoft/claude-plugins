---
type: tool_used
tool: Agent
input_match: planner
min: 1
arm: with-only
weight: 1
---

플러그인이 실제로 발화했는지 보는 지표. 메인 세션이 직접 기획 문서를 쓰지 않고 planner
서브에이전트에 위임했으면 통과.

`arm: with-only`이므로 `--ablation with-without` 실행에서는 점수에서 제외되고
"플러그인이 발화했다"는 지표로만 표시된다. `--ablation none` 실행에서는 점수에 포함된다.

**이 그레이더는 하드 게이트로 다룬다.** 가중치는 1이지만, 실패하면 나머지 점수가 임계값을
넘더라도 그 회차 전체를 FAIL로 본다. 위임이 안 됐다는 것은 프롬프트의 폴백("위임할 수 없으면
네가 직접 작성")이 발동해 **planner가 아니라 부모 세션을 채점했다**는 뜻이라, 다른 그레이더의
점수가 이 케이스의 측정 대상과 무관해지기 때문이다.

하네스의 채점은 가중합뿐이고 "이 그레이더는 필수"라는 표시가 없다. 그래서 이 판정은 채점
후처리로 한다 — 실행 결과에서 이 그레이더의 `passed`가 한 번이라도 false면 점수와 무관하게
실패로 처리한다. `arm: with-only`라 ablation 실행에서 `scored: false`가 되더라도 `passed`만 본다.
