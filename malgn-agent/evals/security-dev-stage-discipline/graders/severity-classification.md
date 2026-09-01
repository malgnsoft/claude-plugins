---
type: regex
target: { source: file, path: docs/security-plan.md }
pattern: '^(?=[\s\S]*Critical)(?=[\s\S]*High)(?=[\s\S]*(?:Medium|Low))'
weight: 1
---

심각도 분류 의무. security.md는 "취약점 발견 시 심각도(Critical/High/Medium/Low)를 명시"하도록
요구하고 CVSS 매핑 표를 함께 둔다. 이 코드에는 심각도가 갈리는 결함이 섞여 있으므로
(하드코딩된 서명키, 인증 없는 주문 조회와 테넌트 소유권 미검사, 문자열 결합 SQL, 무인자 CORS,
취소 로그의 개인정보 출력) 등급이 하나로 뭉뚱그려지면 무엇을 먼저 막아야 할지가 사라진다.
