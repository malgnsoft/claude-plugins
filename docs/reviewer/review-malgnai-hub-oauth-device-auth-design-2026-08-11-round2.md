# malgnai-hub OAuth 2.1(PKCE) 인증 전환 설계 — 재검토 보고서 (Round 2, Incremental)

리뷰 대상: `/Users/hopegiver/workspace/claude-plugins/docs/decision/malgnai-hub-oauth-device-auth-design.md` (514줄, architect 개정판)
1차 리뷰: `docs/reviewer/review-malgnai-hub-oauth-device-auth-design-2026-08-11.md` (🔴 Red, Critical 1건·Major 4건)
리뷰 페르소나 패널(1차 재사용, 신규 작성 없음 — 증분 모드): `docs/reviewer/personas/persona-mcp-oauth-security-auditor.md`, `persona-mcp-oauth-feasibility-realist.md`, `persona-hub-schema-routing-consistency-auditor.md`, `persona-cross-repo-handoff-executability-auditor.md`, `persona-auth-flow-zero-based-challenger.md`(발산형)
리뷰 방식: **증분(Incremental)** — 1차 지적 5건(Critical 1·Major 4)의 해소 여부 재검증에 집중. 이미 1차에서 다룬 범위(PKCE/redirect_uri 정책의 RFC 정합성, 스키마 재사용 판단 등)는 재논증하지 않음.
리뷰 일자: 2026-08-11
등급: Sensitive(회사 전 직원 인증 체계) — 유지

## 종합 판정: 🟢 **Green**

1차 Critical 1건·Major 4건 **전부 실측·근거 재확인으로 해소 확인**. 신규로 🟡 Minor 2건 발견(설계 구조를 흔들지 않는 문구·문서위생 수준) — 구현 착수를 막을 사유 아님.

## 1차 지적 재검증 결과

| # | 1차 심각도 | 1차 지적 요지 | 개정판 근거 | 재검증 결과 |
|---|-----------|--------------|-------------|------------|
| 1 | 🔴 Critical | `wrangler.jsonc` `run_worker_first` 미갱신으로 신규 엔드포인트 4개가 Worker에 도달 못함 | §3.2, 실측: `wrangler.jsonc:41`이 실제로 `["/api/*", "/mcp*"]`임을 재확인(파일 직접 읽음). 개정판은 `.well-known/oauth-*`만 `run_worker_first`에 추가(옵션 B 채택)하고, `/oauth/token`·`/oauth/register`는 `/api/oauth/*`로 옮겨 기존 `/api/*` 규칙에 편입 | **해소**. RFC 8615(Well-Known URIs)는 `.well-known` 절대경로를 스펙으로 강제하지만, RFC 8414(AS Metadata)의 `token_endpoint`/`registration_endpoint`는 메타데이터 문서가 실제 URL을 알려주는 값이라 임의 경로 이동이 스펙 위반이 아니다 — 옵션 B의 구분은 정확. `/api/*`에 `jwtAuthMiddleware`가 걸린다는 것(`server/index.js:20` 실측 확인, `webApp.use('/api/*', jwtAuthMiddleware)`)까지 파악해 `PUBLIC_PATHS`(`server/middleware/jwt-auth.js`, 실측: `Set` 기반 정확일치 방식)에 `/api/oauth/token`·`/api/oauth/register` 추가를 §3.2에 명시하고 §7 Tier1 파일목록(479행)에도 반영 — 라우팅 앞뒤가 실제 코드와 정확히 맞물린다. `/oauth/authorize`(브라우저 GET, HTML 기대)는 SPA fallback 그대로 두는 것이 오히려 맞는 설계라는 판단도 타당. |
| 2 | 🟠 Major | DCR의 자기신고 `client_name`이 동의화면의 유일한 신뢰신호 — 컨센트 피싱 | §1.2(DCR을 Tier 2 폴백으로 격하) + §6(client_name을 `oauth-trusted-clients.js` 서버 하드코딩 매핑에서만 조회, DB/요청바디 미사용) + DCR 폴백 채택 시 경고배지 의무화 재확인 | **해소**. 사전등록 경로(1차안)에서는 자기신고 client_name 자체가 존재하지 않아 공격면이 구조적으로 제거됨. DCR 폴백 경로에도 "반드시 함께 구현" 조건으로 경고배지가 남아있어, 1차 권고(배지 추가 또는 DCR 재검토)를 사실상 둘 다 반영. |
| 3 | 🟠 Major | 레거시 device_token 무기한 공존, 종료 기준이 §9에서 스스로 "미정"이라고 명시 | §5: D+60 시점 OAuth 경유 비율 SQL 쿼리 + 60%↑/↓ 분기별 구체 액션(버튼 숨김, 소급 `expires_at=created_at+180일` UPDATE, 배너), D+90 재측정 | **해소**. "측정만 하고 계획 없음"에서 "숫자 임계치+구체 실행(UI 변경, 마이그레이션, 배너 문구)이 있는 트리거"로 전환됐고, Tier2가 아니라 Tier1에 "종료 계획 등록"까지 포함(§7). |
| 4 | 🟠 Major | DCR 채택 근거("client_id 필드 없음")가 부정확할 가능성, Tier 0 스파이크가 prose 권고 수준에 머묾 | §1.2: 1차안을 사전등록 `oauth.clientId`로 교체(공식 문서 근거), §7에 "Tier 0 — 구현 착수 전 필수 게이트" 표(4행, 통과기준/실패시 폴백 명시) 신설 | **해소, 단 새 확인사항 있음(아래 N1)**. `oauth.clientId` 필드 실존은 이번 재검토에서 `code.claude.com/docs/en/mcp`를 직접 열람해 재확인(`claude mcp add-json`의 `oauth:{"clientId":...}` 스키마, "public OAuth client는 `--client-id`만 사용" 문구 원문 확인). 플러그인 인라인 `mcpServers`(즉 `plugin.json`)는 문서상 "user-configured servers와 동일하게 동작"이라고 명시돼 있어 방향은 맞다. Tier 0 게이트가 prose에서 표로 승격되고 각 행에 실패 시 폴백이 명시된 것도 확인 — 구현 착수 전 실행가능한 체크리스트로 기능한다. |
| 5 | 🟠 Major | malgnai-public STATUS.md에 이 설계 문서 포인터가 없어 다음 세션이 발견 불가 | malgnai-public STATUS.md 직접 열람 | **해소**. `STATUS.md:35`(🚧 차단 없는 백로그 섹션)에 08-11 항목으로 실제 추가됨 — 문서 경로, 1차 리뷰 결과, 핵심 변경 요지(wrangler.jsonc 갱신 필요, oauth.clientId 1차 채택, Tier 0 게이트), 이전 결정 `bfc11390` 참조까지 포함해 다음 세션이 이 항목만으로 재구성 가능한 수준. 단 §N2(아래) 참고. |

## 신규 발견 (이번 재검토에서 새로 확인된 사항)

| # | 심각도 | 위치 | 문제 | 근거 | 개선안 |
|---|-------|------|------|------|--------|
| N1 | 🟡 Minor | §1.2 91행, §4.1 412행 | "`anthropics/claude-ai-mcp#359`... malgn-agent가 **정확히 이 배포 경로**(마켓플레이스 → `/plugin install`)를 쓰므로"라는 문구가 과잉확신이다. GitHub 이슈 #359를 직접 열람한 결과, 이 버그는 **Claude Desktop의 "Plugin marketplace"(claude.ai admin 콘솔 → GitHub Sync)** 경로에서 보고된 것이지, malgn-agent가 실제로 쓰는 **Claude Code CLI의 `.claude-plugin/marketplace.json` 기반 `/plugin install`**과 제품·동기화 메커니즘이 동일하다는 근거는 이슈 원문에 없다(원문: "A plugin published through a GitHub-based plugin marketplace (claude.ai admin → Plugin marketplace → Sync from GitHub)..."). 유사 사례로 참고할 가치는 있으나 "정확히 이 배포 경로"라는 단정은 부정확하다. | WebFetch로 이슈 #359 원문 직접 확인(claude.ai admin 콘솔 경로 명시, Claude Desktop 대상). `code.claude.com/docs/en/mcp`도 직접 열람: 플러그인 인라인 `mcpServers`는 "user-configured servers와 동일 동작"이라고만 명시, marketplace 동기화 시 oauth 블록 보존 여부는 문서에 명시 없음(Claude Code CLI 마켓플레이스 고유의 검증되지 않은 지점). | §1.2/§4.1의 "정확히 이 배포 경로를 쓰므로"를 "유사한 배포 경로(마켓플레이스 GitHub 동기화)에서 보고된 사례로, Claude Code CLI 플러그인 마켓플레이스에도 동일 문제가 재현될지는 미확인"으로 완화. **설계 구조 자체(Tier 0 스파이크로 실기동 검증)는 이미 이 불확실성을 정확히 감당하고 있어 변경 불필요** — 문구만 수정 권고. |
| N2 | 🟡 Minor(Nit) | malgnai-public `STATUS.md:2` | 08-11 백로그 항목(35행)이 실제로 추가됐지만, 파일 최상단 헤더(`_최종 갱신: 2026-08-05 — ...`)는 갱신되지 않은 채 남아있다 — 이 프로젝트 자신의 STATUS.md 규율("헤더 라인은 매번 통째로 교체, 과거 세션 체이닝 금지")과 어긋난다. | `STATUS.md` 1~2행 직접 확인 | 헤더 한 줄을 08-11 기준으로 갱신(예: "OAuth 전환 설계 이관 대기 항목 추가"를 헤더 요약에 반영). trivial 수정이라 PM이 직접 처리 가능. |

## 트레이드오프 재확인
1차 보고서의 "보안 감사관 vs 실현가능성 현실주의자" 트레이드오프(Tier 0에서 `oauth.clientId` 우선 검증, 실패 시에만 DCR+경고배지 폴백)는 개정판이 정확히 그 순서로 채택했다 — 재논쟁 불필요.

## 잘 된 점 (1차 대비 추가)
- 개정판이 "명세 완결성 ≠ 실행 가능성"이라는 1차 리뷰의 핵심 교훈을 §8 ④에 자기검증 항목으로 역으로 편입시킨 점 — 단순히 지적을 고친 것을 넘어 재발방지 규칙화.
- Tier 0 게이트 표(§7)의 각 행이 "통과 기준"과 "실패 시" 폴백을 1:1로 명시해, 다음 세션이 판단 없이 그대로 실행 가능한 체크리스트가 됐다.
- §3.2 옵션 A/B 트레이드오프 표가 "왜 well-known만 예외로 남기고 나머지는 기존 규칙에 편입시켰는지"를 스펙 근거(RFC 8615 vs RFC 8414)로 명확히 구분 — 라우팅 예외를 최소화하려는 판단이 스펙적으로도 정확했다.

## 생략한 것 / 이번 재검토가 하지 않은 것
- 1차 리뷰와 동일하게, malgnai-public 서버를 실제로 기동해 discovery 엔드포인트를 curl로 왕복시키는 실기동 검증은 **여전히 하지 않았다**(Tier 0 스파이크가 담당할 몫, 아직 구현 착수 전 설계 문서 단계).
- 1차에서 이미 🟢로 통과 판정된 항목(PKCE/redirect_uri RFC 정합성, `device_tokens` 재사용 판단, refresh 회전 로직)은 이번 재검토에서 재논증하지 않았다(증분 모드 원칙).
- Claude Code CLI 플러그인 마켓플레이스(`.claude-plugin/marketplace.json`)에서 `oauth.clientId`가 실제로 보존되는지는 웹 문서 열람만으로는 확정 불가 — Tier 0 1순위 항목 그대로 유효(N1과 별개로, 이 실기동 미검증 자체는 이미 설계가 알고 있고 정확히 게이트로 다루고 있음).

## PM에게 권고
1. **구현 착수 가능**: Critical/Major 5건 전부 실측 재확인으로 해소됨 — 이 설계 문서를 malgnai-public 측에 위임해 Tier 0 스파이크부터 착수해도 좋다.
2. **경미한 문구 수정(병행 가능, 차단 아님)**: N1(§1.2·§4.1의 "정확히 이 배포 경로" 문구 완화), N2(malgnai-public STATUS.md 헤더 갱신) — 둘 다 trivial, PM 직접 처리 가능.
3. **실행 여부**: 이번 재검토는 문서 수정을 하지 않았다(reviewer 역할 밖 — 검증까지만). N1·N2 반영은 PM 또는 architect 재위임 몫.
