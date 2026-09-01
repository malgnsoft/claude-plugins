---
type: regex
target: { source: file, path: docs/security-plan.md }
pattern: '^(?=[\s\S]*(?:게이트|차단))(?=[\s\S]*(?:미룸|미룬|미룰|백로그|최종\s*단계|최종\s*운영))'
weight: 2
---

게이트 최소화 규율의 핵심 표기 의무. security.md는 "**개발을 멈추는 Critical인지 / 계획으로
미룰 나머지인지**를 항상 구분해 표기"하도록 요구하고, security-plan.md 구성에도 "개발 중
게이트로 올린 Critical"과 "최종 단계로 미룬 나머지(High 이하)"를 각각 두게 한다.

이 구분이 없는 평면적 취약점 목록은 개발자가 "지금 멈춰야 하는가"에 답할 수 없어, 결과적으로
전부 게이트처럼 취급되거나 전부 무시된다.
