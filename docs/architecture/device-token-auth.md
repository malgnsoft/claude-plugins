# 기기 단위 장기 토큰 인증 (포인터)

malgnai-hub MCP 인증을 OAuth 세션 재인증에서 "맑은에이전트 앱이 관리하는 기기 토큰(최대 365일) + `headersHelper`"로 바꾸는 3저장소 공통 설계의 정본은 아래 한 곳이다. 본문을 여기에 복제하지 않는다.

- 정본: `malgn-vscode` 저장소 `docs/design/device-token-auth.md` (브랜치 `feat/device-token-auth`)
- 이 저장소 관련 절: §8(plugin.json `oauth` 제거 → `headersHelper`, `bin/hub-auth-header.mjs` 계약), §8.3(headersHelper 실측 실패 시 대안), §9 [P] 변경 파일 목록, §15 E1·E12 실측
- 상태: 설계 초안(미구현·미승인). plugin.json은 실측 E1 통과 전 변경하지 않는다.
