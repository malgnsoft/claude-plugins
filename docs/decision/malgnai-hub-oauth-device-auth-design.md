# malgnai-hub MCP 인증 — OAuth 2.1(PKCE) 전환 설계

- 작성: architect (2026-08-11), claude-plugins 세션에서 작성.
- **⚠️ 이 문서는 설계 초안이다.** malgnai-public(project_id `693caed1-0d3d-4819-b787-75baa829bb80`) 저장소의 실제 서버 구현은 **이 세션의 범위 밖**이며, 별도로 그 프로젝트에 위임/조율이 필요하다. 이 세션은 claude-plugins(project_id `e3c8eba1-7016-4c40-81fc-7d15cdcefd75`) 소속이라 malgnai-public 저장소를 직접 구현 범위로 삼지 않는다. 아래 §9의 malgnai-public측 파일 목록은 "이렇게 바뀌어야 한다"는 설계 지시이지, 이 세션이 직접 수정했다는 뜻이 아니다.
- 근거: 사용자(대표)가 현재 device_token 수동 복붙 절차("웹에서 발급 → `.mcp.json`에서 토큰만 추출 → `/plugin install`의 `userConfig.device_token` 프롬프트에 붙여넣기")가 직원들에게 어렵다고 판단, OAuth 전환 설계 착수를 결정.
- 실제 코드를 직접 읽고 작성했다(요약을 그대로 믿지 않음) — 인용 근거는 각 절에 파일 경로로 명시.
- **[개정 2026-08-11] reviewer 풀패널 검증 결과 🔴 Red(Critical 1건·Major 4건) → 전면 개정.** 통합 보고서: `docs/reviewer/review-malgnai-hub-oauth-device-auth-design-2026-08-11.md`. 개정 변경분은 본문에 "(개정: ...)" 표시로 남긴다.
- **⚠️ 이 개정판의 핵심 변화(먼저 읽을 것)**: 초안이 DCR(RFC 7591) 채택 근거로 삼은 "`plugin.json`의 `mcpServers` 스키마에 client_id를 넣을 자리가 없다"는 전제가 **부정확했다** — Claude Code 공식 문서(`code.claude.com/docs/en/mcp`)로 재확인한 결과 `mcpServers.<name>.oauth.clientId` 필드가 실존한다. **1차 권고안을 사전등록 client_id 방식으로 교체**하고 DCR은 Tier 0 스파이크 실패 시의 폴백(Tier 2)으로 격하했다(§1.2). 또한 `wrangler.jsonc`의 `run_worker_first` 미갱신으로 신규 엔드포인트가 실제로 도달 불가능했던 Critical 결함을 §3.2에서 수정했다.

## 0. 현재 구현 요약 (실제 코드 확인 결과)

- **디바이스 페어링 흐름**(`server/api/devices.js`): `POST /api/devices/pair-init`(무인증, `device_pairings` pending 생성) → 사용자가 `/keys` 화면에서 `POST /api/devices/pair-approve`(JWT 인증, `device_tokens` 1행 생성) → 플러그인이 `GET /api/devices/pair-status`(무인증 폴링)로 승인 시 **단 1회** raw `device_token`을 받는다. 이 세 엔드포인트가 `jwt-auth.js`의 `PUBLIC_PATHS`에서 인증을 완전히 면제받는 것은 pair-init/pair-status 두 개뿐이다(pair-approve는 JWT 필요).
- **`/mcp` 인증**(`mcp/device-auth.js` + `server/index.js`): Bearer 헤더 → SHA-256 해시 → `device_tokens.token_hash` 조회. `status='active'`이고 `expires_at`이 없거나 미래면 통과. 현재 발급되는 `device_tokens`는 `expires_at`이 항상 NULL(무기한) — `insert()`(`server/dao/device-tokens.js`)가 그 컬럼을 아예 받지 않는다.
- **웹 화면**(`app/pages/keys.vue`): "새 인증키 발급" 버튼 → pair-init/pair-approve/pair-status를 연속 호출 → 완성된 `.mcp.json`(전체 JSON, `Authorization: Bearer <token>` 포함)을 1회 모달에 노출, 복사/다운로드. **사용자가 이 JSON에서 토큰 값만 손으로 추출**해 Claude Code `/plugin install` 프롬프트(`userConfig.device_token`)에 붙여넣는 지점이 이번에 없애려는 수작업이다.
- **플러그인 쪽**(`malgn-agent/.claude-plugin/plugin.json`): `userConfig.device_token`(sensitive, required) + `mcpServers.malgnai-hub.headers.Authorization: "Bearer ${user_config.device_token}"` — 정적 헤더, MCP 표준 OAuth 흐름을 전혀 타지 않는다.
- **웹 로그인 세션**(`server/api/auth.js`, `app/pages/login.vue`, `app/assets/js/utils.js`): JWT(HS256, `jose`, 4h) + opaque refresh token(30일, 회전형+재사용탐지+10초 grace window, `server/lib/tokens.js`/`server/dao/refresh-tokens.js`). 클라이언트는 `localStorage.token`/`localStorage.refresh_token`에 저장. `login.vue`는 이미 `?redirect=` 쿼리로 로그인 후 임의 경로 복귀를 지원한다 — OAuth authorize 화면이 "로그인 필요 시 되돌아오기"에 그대로 재사용 가능한 기존 메커니즘이다.
- **스키마**(`migrations/0001_init_v1_schema.sql`): `device_tokens`(id/user_id/device_id/device_name/token_hash/scopes/status/expires_at/last_used_at/created_at/revoked_at, FK 없음, ULID PK), `device_pairings`(pairing_code PK 평문, TTL 10분), `refresh_tokens`(+ `migrations/0002`의 `revoke_reason` 컬럼: `rotated`/`logout`/`reuse_detected`), `audit_logs`(action은 CHECK로 고정 enum: `user.role_changed`/`device_token.issued`/`device_token.revoked`/`admin.cross_user_view`).
- **이전 검토 이력**: `docs/architecture.md`(로컬 전용, git 미추적)와 STATUS.md에 "계정관리 라운드 배포... MCP 인증 OAuth 도입은 이번엔 보류"(decision `bfc11390`), "OAuth 병행 도입은 claude.ai 원격 연동 요구가 실제로 생기면 재검토"라는 기록이 이미 있다 — 이번 요청이 그 재검토 시점이다.
- **암호 유틸**(`server/lib/tokens.js`): PBKDF2(비밀번호), opaque token(`crypto.getRandomValues` 32바이트 → base64url, refresh/device 공용), `sha256Hex`, `jose` 기반 JWT. Cloudflare Workers 런타임 제약으로 Web Crypto만 사용 — PKCE 검증(SHA-256)도 동일하게 `crypto.subtle`로 구현 가능.

## 1. MCP OAuth 2.1(PKCE) 표준 흐름과 이 상황에 맞는 판단

### 1.1 표준 흐름 요약

```
Claude Code(플러그인)                    malgnai-hub
      │  1. GET /mcp (무인증 시도)              │
      ├────────────────────────────────────────►│
      │  ◄── 401 + WWW-Authenticate: Bearer      │
      │       resource_metadata="https://.../    │
      │       .well-known/oauth-protected-resource"
      │                                          │
      │  2. GET /.well-known/oauth-protected-resource
      ├────────────────────────────────────────►│  { resource, authorization_servers:[...] }
      │  3. GET /.well-known/oauth-authorization-server
      ├────────────────────────────────────────►│  { authorization_endpoint, token_endpoint,
      │                                          │    registration_endpoint, code_challenge_
      │                                          │    methods_supported:["S256"], ... }
      │  4. (client_id 없으면) POST /oauth/register (DCR, RFC7591)
      ├────────────────────────────────────────►│  { client_id, ... } (client_secret 없음—public client)
      │  5. 로컬 루프백 리스너 기동 + code_verifier/
      │     code_challenge(S256) 생성 + state 생성
      │  6. 시스템 브라우저 오픈 → GET /oauth/authorize?
      │     response_type=code&client_id=...&redirect_uri=
      │     http://127.0.0.1:<port>/callback&state=...&
      │     code_challenge=...&code_challenge_method=S256
      │                                          │  (사람이 브라우저에서 로그인/동의)
      │  7. 302 redirect_uri?code=...&state=...  │
      │◄─────────────────────────────────────────┤  (로컬 루프백으로 code 수신)
      │  8. POST /oauth/token                    │
      │     grant_type=authorization_code&code=...│
      │     &code_verifier=...&redirect_uri=...  │
      ├────────────────────────────────────────►│  PKCE 검증(S256(code_verifier)==code_challenge)
      │  ◄── { access_token, refresh_token,      │
      │        expires_in, token_type:"Bearer" } │
      │  9. 이후 /mcp 호출은 Authorization:      │
      │     Bearer <access_token>. 만료 임박 시  │
      │     POST /oauth/token(grant_type=        │
      │     refresh_token)으로 조용히 갱신.       │
```

(위 표준 흐름의 4번 단계 "`(client_id 없으면)` POST /oauth/register"는 이 설계에서는 **일어나지 않는다** — malgn-agent가 `oauth.clientId`를 사전등록 값으로 항상 갖고 있으므로 4번을 건너뛰고 곧장 5번으로 진행한다(§1.2). 이 단계가 실제로 실행되는 것은 Tier 2 DCR 폴백이 채택된 경우뿐이다.)

### 1.2 사전 등록 client_id(1차 권고, 개정) vs DCR(RFC 7591, 폴백으로 격하) — 판단

**결정 변경(2026-08-11 개정): 사전 등록 고정 client_id를 1차 권고안으로 채택한다. DCR은 아래 Tier 0 스파이크가 실패할 경우에만 구현하는 Tier 2 폴백이다.**

초안(v1)은 "`plugin.json`의 `mcpServers` 선언에 client_id를 지정할 필드가 없다"를 근거로 DCR을 채택했다. reviewer 풀패널이 이 전제 자체를 문제 삼았고(지적#4), 재조사 결과 **전제가 부정확했다** — Claude Code 공식 문서(`code.claude.com/docs/en/mcp`, "Use pre-configured OAuth credentials" 절, 2026-08-11 확인)에 다음 스키마가 명시돼 있다:

```json
{
  "mcpServers": {
    "malgnai-hub": {
      "type": "http",
      "url": "https://malgnai-hub.apiserver.kr/mcp",
      "oauth": { "clientId": "<사전 발급한 고정 client_id>" }
    }
  }
}
```

`client_secret` 없이 `oauth.clientId`만 지정하면 공식 문서가 "public OAuth client" 취급을 명시한다("If the server uses a public OAuth client with no secret, use only `--client-id`") — 이 설계의 전제(PKCE 전용, client_secret 미발급, §1.3)와 정확히 맞아떨어진다. 검토한 대안과 트레이드오프:

| | 사전 등록 client_id(**채택**) | DCR(RFC 7591, Tier 2 폴백) |
|---|---|---|
| 채택 이유 | `oauth.clientId`가 실존 필드로 확인됨(위 공식 문서). client_id는 비밀이 아니므로 `plugin.json`에 평문으로 커밋해도 안전하다. `POST /oauth/register`·`oauth_clients` 테이블·등록남용 방어·정리배치(초안 §7 Tier2)가 **통째로 불필요**해진다 — 초안 리뷰 지적#2(컨센트 화면 client_name 스푸핑/피싱)의 공격면이 구조적으로 사라진다: client_name을 무인증 등록 요청에서 받는 게 아니라 서버가 하드코딩한 단일 매핑(`{ <고정 client_id>: "맑은소프트 malgn-agent 플러그인" }`)에서만 조회하므로 위조가 불가능하다. |
| 포기한 것 | client_id를 바꾸려면 malgn-agent 마켓플레이스에 새 버전을 배포해야 한다(즉시 반영 불가). |
| 감당 방안 | 이 저장소는 이미 빈번한 버전 bump 이력(v1.0→v1.3.0)이 있어 배포 자체의 실비용은 낮다. 서버는 신뢰 client_id를 env var(`TRUSTED_MALGN_AGENT_CLIENT_ID`)로 관리해 코드 배포 없이 값 교체가 가능하게 한다 — 로테이션이 필요해지면(유출·조직개편 등) 마켓플레이스 마이너 버전 배포 + env var 갱신으로 대응. 구버전 플러그인 사용자는 갱신 전까지 OAuth 로그인 실패 — 이 경우에 한해 §4.2의 레거시 `userConfig.device_token` 탈출구가 실제로 쓰인다. |
| DCR을 완전히 제거하지 않고 Tier 2 폴백으로 남기는 이유 | 재조사 중 marketplace 배포 plugin.json 특유의 미해결 이슈(`anthropics/claude-ai-mcp#359` "Marketplace-synced plugin drops `oauth.clientId` from bundled `.mcp.json`")를 발견했다 — **plugin.json 경유(마켓플레이스 설치)일 때도 `oauth.clientId`가 실제로 로컬 설정에 보존되는지는 우리 환경에서 실측해야 확정된다.** 이 경로가 막히면 DCR이 유일한 대안이므로 설계에서 완전히 들어내지 않고 Tier 2로 남긴다(§7 Tier 2, §3.4 조건부 스키마). |

**Tier 0 검증 스파이크(구현 착수 전 필수 게이트로 승격 — 리뷰 지적#4, prose 권고에서 §7 Tier 0 표로 격상)**:
1. malgnai-public에 discovery 2종(`GET /.well-known/oauth-*`) + `POST /api/oauth/token`(스텁) + `GET /oauth/authorize`(스텁 페이지)만 먼저 배포.
2. `malgn-agent/.claude-plugin/plugin.json`에 `oauth.clientId`(테스트용 임시 값)를 넣고 **실제 `/plugin install` 마켓플레이스 경로**로 설치 → `claude mcp get malgnai-hub`로 `oauth.clientId`가 로컬 설정에 실제로 반영됐는지 확인(`#359` 재현 여부 1차 확인 — 이번 재조사에서 가장 근거가 얕은 지점이라 최우선 검증 대상).
3. `/mcp` 401 → `/mcp` 또는 `claude mcp login malgnai-hub` → 브라우저가 실제로 열리고 DCR 없이 authorize 요청에 사전등록 client_id가 실리는지 확인.
4. 3이 실패하면(DCR을 강제로 시도하는 등, 공식 문서에 함께 보고된 `#67258`/`#38102`류 증상) → 즉시 DCR 폴백(Tier 2)으로 전환, `POST /api/oauth/register`·`oauth_clients` 구현 착수.
5. (참고) `--callback-port` 플래그로 콜백 포트를 고정하면 §1.3의 redirect_uri 매칭이 더 단순해진다(포트까지 고정 가능) — Tier 0에서 함께 확인하되 채택 여부는 §1.3 정책을 바꾸지 않는다(포트 무시 매칭이 더 견고함).

이 스파이크는 §7 "Tier 0 — 구현 착수 전 필수 게이트" 표로 별도 승격한다(prose 권고로만 남지 않도록). 이 문서는 MCP 표준 스펙과 Claude Code 공식 문서 근거로 설계했지만, Claude Code의 실제 클라이언트 동작(특히 marketplace 배포 경로)까지는 이번 세션에서 실기동 검증하지 못했다(정직 명시, §9).

### 1.3 redirect_uri(로컬 루프백) 검증 규칙

RFC 8252 §7.3(네이티브 앱 OAuth) 및 MCP Authorization spec은 루프백 리다이렉트에 대해 **포트는 요청 시점에 임의로 달라질 수 있으므로 서버가 포트를 무시하고 매칭해야 한다**고 명시한다(OS가 매 실행마다 빈 포트를 골라주는 구조 때문). 따라서:
- 스킴은 `http`(https 아님, 루프백이라 TLS 불필요) 고정.
- 호스트는 `127.0.0.1` / `localhost` / `::1` 중 하나만 허용.
- 포트는 **비교하지 않는다**(와일드카드).
- path는 DCR 등록 시 저장된 값과 정확히 일치해야 한다.
- authorize 요청의 `redirect_uri`와 token 교환 요청의 `redirect_uri`는 **문자열 그대로 동일**해야 한다(OAuth 2.1 필수 요구 — 포트 무시 규칙은 "등록된 redirect_uri와 요청 redirect_uri 비교"에만 적용되고, "authorize 시 redirect_uri와 token 시 redirect_uri 비교"는 정확히 같은 문자열이어야 함).

## 2. 전체 아키텍처 개요

```
                         ┌─────────────────────────────────────────┐
                         │   malgnai-hub Worker (server/index.js)  │
  브라우저 ──GET /oauth/──►  (static asset, Nuxt SPA 라우트로 폴백  │
  authorize(사람이 클릭)   │   — 신규 Worker 라우팅 불필요, 기존     │
                         │   assets.not_found_handling=SPA로 이미  │
                         │   커버됨)                                │
                         │        │                                │
                         │        ▼ (fetch, JWT 필요)                │
                         │  /api/oauth/authorize-context (신규)     │
                         │  /api/oauth/consent            (신규)     │
                         │        │ 둘 다 webApp(JWT 미들웨어) 안    │
                         │                                          │
  Claude Code(플러그인) ──►  /.well-known/oauth-protected-resource   │  wrangler.jsonc
        HTTP client      │  /.well-known/oauth-authorization-server │  run_worker_first에
                         │  (well-known 2종만 절대경로 유지 — spec  │  well-known 패턴 추가
                         │   요구, §3.2)                            │  필요(§3.2, 개정)
                         │  /api/oauth/token  (신규, 무인증)         │  기존 /api/* 규칙
                         │  [/api/oauth/register — Tier 2 폴백,     │  재사용, wrangler.jsonc
                         │   DCR 채택 시에만, §1.2]                 │  추가 변경 불필요
                         │        │                                 │
                         │        ▼                                 │
                         │  device_tokens(확장) /                    │
                         │  oauth_authorization_codes(신규) /        │
                         │  oauth_refresh_tokens(신규)                │
                         │  [oauth_clients — Tier 2 폴백 전용, §3.4] │
                         │        │                                 │
  Claude Code ──Bearer───►  /mcp → device-auth.js (변경 없음,       │
                access_   │  기존 device_token 검증 로직 그대로     │
                token     │  재사용 — access_token도 device_tokens  │
                         │  .token_hash로 저장되는 opaque 값이므로) │
                         └─────────────────────────────────────────┘
```

핵심 설계 원칙: **`/mcp`의 인증 검증 코드(`mcp/device-auth.js`)는 한 줄도 바꾸지 않는다.** OAuth access_token은 형식상 opaque token이고 `device_tokens.token_hash`에 저장되는 것은 기존과 동일 — "이 Bearer 값이 어떤 발급 경로로 나왔는지"는 `/mcp` 인증 시점에서 구분할 필요가 없다. 이 덕분에 기존 device_token 방식과 완전히 무충돌로 공존한다(§7).

## 3. malgnai-public(서버) 측 설계

### 3.1 신규 엔드포인트 (개정: 경로/조건부 표시 — §1.2·§3.2 반영)

| 엔드포인트 | 인증 | 설명 |
|---|---|---|
| `GET /.well-known/oauth-protected-resource` | 무인증 | RFC 9728. `/mcp`의 리소스 메타데이터 — `{ resource, authorization_servers }`. **절대경로 고정(spec) — `wrangler.jsonc` run_worker_first에 추가 필요(§3.2)** |
| `GET /.well-known/oauth-authorization-server` | 무인증 | RFC 8414. AS 메타데이터 — endpoint 목록(모두 `/api/oauth/*`, §3.2), `code_challenge_methods_supported:["S256"]`(plain 미지원), `token_endpoint_auth_methods_supported:["none"]`. **사전등록 client_id 경로(Tier 0 통과 시) 응답에는 `registration_endpoint`를 생략**해 DCR 미지원임을 명시한다 — Tier 2(DCR 폴백) 구현 시에만 이 필드를 추가. 위와 동일하게 절대경로 고정. |
| `POST /api/oauth/token` (경로 변경: `/oauth/token`→`/api/oauth/token`, §3.2) | 무인증(PKCE/refresh_token 자체가 인증) | `grant_type=authorization_code`(code+code_verifier 검증) 또는 `grant_type=refresh_token`(회전+재사용탐지, §3.6). 요청의 `client_id`가 사전등록 값(env var `TRUSTED_MALGN_AGENT_CLIENT_ID`)과 일치하는지 먼저 검증 — 불일치 시 `{ "error": "invalid_client" }`(400). `device_tokens` 행을 생성/갱신하고 access_token(raw)+refresh_token(raw)을 반환. |
| `GET /oauth/authorize` | Nuxt SPA 라우트(신규 페이지) | 사람이 브라우저로 여는 화면. 로그인 안 되어 있으면 `/login?redirect=...`로(기존 메커니즘 재사용, §3.3). 로그인 되어 있으면 동의 화면. 변경 없음 — `assets.not_found_handling=SPA`로 이미 커버(§3.2). |
| `POST /api/oauth/authorize-context` | JWT(webApp 자동) | consent 화면이 표시할 `client_name`/`redirect_uri` 검증 결과를 조회. `client_id`는 사전등록 값과 일치하는지만 검증하고, `client_name`은 **서버 하드코딩 매핑**(`oauth-trusted-clients.js`)에서 조회해 응답 — DB나 요청 바디에서 가져오지 않으므로 컨센트 피싱 불가(리뷰 지적#2 해소, §6). `redirect_uri`가 §1.3 루프백 정책을 벗어나면 `{ "error": "invalid_redirect_uri" }`(400, 리뷰 지적#6 반영). |
| `POST /api/oauth/consent` | JWT(webApp 자동) | 사용자가 "허용" 클릭 시 호출. `oauth_authorization_codes` 1행 생성, 프런트가 그 응답의 `redirect_uri?code=...&state=...`로 `window.location`을 이동시킨다. |
| `POST /api/oauth/register` — **Tier 2 폴백, 조건부** (경로 변경: `/oauth/register`→`/api/oauth/register`, §3.2) | 무인증 | RFC 7591 DCR. **Tier 0 스파이크(§1.2)가 사전등록 client_id 경로 실패를 확인한 경우에만 구현**. `{ client_name, redirect_uris:[...] }` → `{ client_id, client_id_issued_at, token_endpoint_auth_method:"none", redirect_uris }`. client_secret 미발급(RFC 8252). redirect_uri가 루프백이 아니면 등록 자체를 `{ "error": "invalid_redirect_uri" }`(400)로 거부. |

### 3.2 라우팅 배선 — `wrangler.jsonc` 변경 필수 (개정: Critical 지적#1 반영, 최소 침습 유지)

**리뷰에서 확인된 사실(malgnai-public 실측 재검증 완료, `wrangler.jsonc:36`)**: `assets.run_worker_first`는 `["/api/*", "/mcp*"]`뿐이다. Cloudflare Workers 정적자산 라우팅은 이 목록에 없는 경로를 **Worker `fetch()` 실행보다 먼저** 가로챈다 — 매칭되는 정적 파일이 없으면 `not_found_handling: "single-page-application"`이 즉시 개입해 `index.html`을 200으로 반환한다(Cloudflare 공식 문서: "All other requests either serve an asset that matches or serve the index.html fallback, **without ever hitting this code**"). 즉 초안이 아래에 제시한 `server/index.js` 조건문은 코드 자체는 정확하지만, `run_worker_first`가 함께 갱신되지 않으면 **discovery(`.well-known/*`)·토큰교환(`/oauth/token`) 요청이 전부 JSON 대신 HTML을 받아 Claude Code의 OAuth 파싱이 조용히 깨진다.**

**트레이드오프 — `run_worker_first`에 몇 개까지 추가할 것인가**:

| 옵션 | 내용 | 판단 |
|---|---|---|
| A. 신규 경로 전부(well-known 2개 + `/oauth/register` + `/oauth/token`)를 `run_worker_first`에 그대로 추가 | 초안 §3.2 원안 그대로, wrangler.jsonc에 4개 패턴 추가 | 기각(부분) — `/oauth/register`·`/oauth/token`은 OAuth/MCP 스펙상 절대경로가 아니다. 클라이언트는 이 위치를 AS metadata 문서(`registration_endpoint`/`token_endpoint` 필드, RFC 8414)로 전달받으므로 서버가 원하는 임의 경로를 쓸 수 있다. 이 둘까지 `run_worker_first`에 얹으면 라우팅 예외 목록만 불필요하게 넓어진다. |
| B. `.well-known/oauth-*`만 `run_worker_first`에 추가, `/oauth/token`·`/oauth/register`는 `/api/oauth/token`·`/api/oauth/register`로 옮겨 **기존 `/api/*` 규칙을 재사용**(**채택**) | `.well-known/oauth-protected-resource`/`.well-known/oauth-authorization-server`는 RFC 8615(Well-Known URIs)상 **절대경로가 스펙 그 자체**이므로 `/api/` 밑으로 옮기면 표준 위반이다 — 이 둘만은 `run_worker_first`에 명시적으로 추가할 수밖에 없다(트레이드오프 감당: wrangler.jsonc 변경이 불가피). 반면 token/register/authorize-context/consent는 metadata 문서가 위치를 알려주는 값이라 `/api/oauth/*`로 옮겨도 스펙 위반이 아니며, 이미 존재하는 `/api/*` 라우팅 규칙에 자연히 편입돼 **wrangler.jsonc 변경 범위가 well-known 한 줄로 최소화**된다. | **채택 근거**: 표준 준수가 강제되는 부분(well-known)만 명시적 예외로 남기고, 나머지는 기존 규칙에 편입시키는 것이 최소 침습이자 단일 정본 원칙에도 부합한다(라우팅 예외 목록이 새로 늘지 않음). |

**변경 1 — `wrangler.jsonc`**(§7 Tier 1 목록에 신규 추가, 리뷰 지적#1):

```jsonc
"assets": {
  "directory": "./app",
  "binding": "ASSETS",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/api/*", "/mcp*", "/.well-known/oauth-*"]
}
```

**변경 2 — `server/index.js`**(옵션 B 반영 — bare 경로 분기 없이 well-known만 추가):

```js
if (url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/.well-known/oauth-')) {
  return webApp.fetch(request, env, ctx)
}
```

`/api/oauth/token`·`/api/oauth/register`·`/api/oauth/authorize-context`·`/api/oauth/consent`는 이미 `/api` 접두사이므로 이 조건에 별도 분기 없이 자동 포함된다.

`GET /oauth/authorize`는 **이 조건에 넣지 않는다**(변경 없음) — 정적 자산 서빙 경로로 자연히 떨어지고 `not_found_handling: "single-page-application"`이 Nuxt 클라이언트 라우팅으로 폴백한다. 새 페이지(`app/pages/oauth/authorize.vue`)를 추가하는 것만으로 라우팅이 해결된다.

**`PUBLIC_PATHS` 갱신 필요 — 초안의 판단이 이 개정으로 무효화됨**: `webApp` 안에 등록되는 신규 라우트 중 `/.well-known/*`는 `webApp.use('/api/*', jwtAuthMiddleware)`의 패턴 밖이라 애초에 이 미들웨어를 타지 않는다(그대로 무인증). 그러나 `/api/oauth/token`·`/api/oauth/register`는 **옵션 B에 따라 `/api/*` 패턴 안으로 옮겼으므로** `jwtAuthMiddleware`가 걸릴 수 있다 — 이 둘은 설계상 무인증이어야 하므로(§3.1) **`jwt-auth.js`의 `PUBLIC_PATHS`에 `/api/oauth/token`, `/api/oauth/register`를 명시적으로 추가해야 한다.** (초안은 "PUBLIC_PATHS 수정 불필요"라고 판단했는데, 이는 엔드포인트를 `/api/` 밖에 뒀을 때만 성립하던 결론이라 이 개정으로 무효화된다.) `/api/oauth/authorize-context`·`/api/oauth/consent`는 그대로 JWT 게이트가 걸리길 원하므로 `PUBLIC_PATHS`에 추가하지 않는다.

`/mcp` 401 응답(`server/index.js` 60~67행)에 `WWW-Authenticate` 헤더 추가(변경 없음):

```js
if (!authed.ok) {
  return new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: authed.reason } }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'WWW-Authenticate': `Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource', request.url)}"`
    }
  })
}
```

### 3.3 기존 JWT 웹 세션 재사용 — "이미 로그인됨" 단축 경로

`login.vue`가 이미 `?redirect=` 쿼리(경로가 `/`로 시작하면 그대로 신뢰)를 지원한다(§0). `oauth/authorize.vue`의 로직:

```
1. 쿼리 파싱: client_id, redirect_uri, state, code_challenge, code_challenge_method, scope
2. localStorage.token 존재 + decodeJwtPayload(token).exp가 미래인지 확인(login.vue의 hasValidToken()과 동일 로직 재사용)
3. 유효하지 않으면 router.replace(`/login?redirect=${encodeURIComponent(현재 전체 경로+쿼리)}`)
   → 로그인 성공 후 login.vue가 그대로 이 경로로 복귀 → 다시 1번부터
4. 유효하면 POST /api/oauth/authorize-context 호출(JWT 자동 첨부) — client_id가 사전등록 값(env var)과
   일치하는지 검증 + redirect_uri가 루프백 정책(§1.3)을 만족하는지 검증 + client_name은 서버 하드코딩
   매핑에서 조회해 응답(§3.4, §6 — DCR 폴백 채택 시에만 oauth_clients 테이블 조회로 전환)
5. 통과 시 동의 화면 렌더(기기 이름 입력 — 기존 keys.vue의 "기기 이름" 필드와 동일 UX를 여기로
   이관, §3.7) + "허용"/"취소" 버튼
6. "허용" → POST /api/oauth/consent({client_id, redirect_uri, code_challenge, code_challenge_method,
   scope, state, device_name}) → 응답의 redirect_uri로 location 이동
```

첫 로그인 사용자(신규 입사자 등)에게도 "로그인 → 자동으로 동의 화면 복귀"까지 한 번의 브라우저 흐름으로 끝난다 — 별도 세션 브릿지 코드가 필요 없다.

### 3.4 스키마 설계 — 신규 테이블 vs 기존 테이블 확장 (개정: 사전등록 client_id 채택에 따라 `oauth_clients` 조건부화)

**결론: 하이브리드 + 조건부 축소.** 프로토콜 고유 상태(코드/리프레시)는 새 테이블로, "발급된 토큰이 곧 하나의 승인된 디바이스"라는 기존 모델은 `device_tokens`를 그대로 확장해 재사용한다. **`oauth_clients` 테이블은 사전등록 client_id 경로(§1.2)에서는 불필요하다** — 신뢰할 client_id는 서버 env var(`TRUSTED_MALGN_AGENT_CLIENT_ID`) 단일 값이고, redirect_uri 검증도 DB 조회가 아니라 코드 상수 정책 함수로 처리한다(아래).

| 대안 | 내용 | 판단 |
|---|---|---|
| A. 완전 신규 병렬 테이블(`oauth_tokens` 등) | OAuth 발급분은 별도 테이블·별도 DAO로 완전히 분리 | 기각 — `GET /api/devices`(내 기기 목록)와 `DELETE /api/devices/:id`(폐기)가 두 테이블을 UNION 조회하고 두 갈래 revoke 로직을 유지해야 한다. `device_tokens`가 이미 `user_id/device_name/token_hash/status/expires_at/last_used_at`을 다 갖고 있어 새로 정의할 컬럼이 사실상 없는데도 테이블만 쪼개는 것은 순수 오버헤드다. |
| B. `device_tokens` 확장 + 프로토콜 전용 신규 테이블 2개(**채택**) | `device_tokens`는 "승인된 그랜트" 그대로 재사용(신규 컬럼 `oauth_client_id` nullable만 추가). `oauth_authorization_codes`/`oauth_refresh_tokens`는 기존 테이블에 대응 개념이 없으므로 신규. `oauth_clients`는 **만들지 않는다**(아래 redirect_uri 정책 비교 참고) | `/keys` 화면·revoke UX·`device-auth.js` 인증 로직을 전혀 건드리지 않고 그대로 재사용 가능. |

**redirect_uri 검증 — DB 테이블 vs 코드 상수 정책**:

| 방식 | 내용 | 판단 |
|---|---|---|
| DB(`oauth_clients.redirect_uris_json`) 조회 | DCR로 등록된 클라이언트별 redirect_uri 목록을 저장·조회 | Tier 2(DCR 폴백)에서만 필요 — 등록자가 임의로 redirect_uri를 지정할 수 있으므로 저장·검증이 의미 있다. |
| 코드 상수 정책(**채택, 사전등록 경로**) | `isValidLoopbackRedirect(uri)`: scheme=`http`, host∈`{127.0.0.1, localhost, ::1}`, path=`/callback` 고정, 포트 무시(§1.3) — DB 조회 없이 함수 하나로 검증 | 클라이언트가 단 하나(malgn-agent, 고정 client_id)뿐이므로 "등록된 redirect_uri 목록"이라는 개념 자체가 불필요하다 — 정책이 곧 유일한 클라이언트의 규약이다. |

```sql
-- migrations/0007_oauth_tokens.sql (신규, 예상 번호 — 0006까지 존재 확인함. 원안의
-- "0007_oauth_clients_and_tokens.sql"에서 oauth_clients를 제외 — Tier 2 폴백 채택 시
-- 별도 마이그레이션(0007b, 아래)으로 추가한다.)

-- 인가 코드 — 단 1회, 60초 TTL. pairing_code와 동일하게 평문 PK(코드 단독으로는 토큰을 못
-- 얻는다 — code_verifier가 반드시 같이 필요하므로 pairing_code처럼 해시하지 않는 것과 같은 근거).
CREATE TABLE oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,           -- 사전등록 경로에서는 항상 TRUSTED_MALGN_AGENT_CLIENT_ID와 동일한 값
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,        -- 문자열 그대로 저장, token 교환 시 정확히 일치해야 함(§1.3)
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256' CHECK(code_challenge_method = 'S256'),  -- plain 미지원(OAuth 2.1)
  scope TEXT,
  device_name TEXT,                  -- 동의 화면에서 입력받은 기기 이름 → 토큰 발급 시 device_tokens.device_name으로 이관
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','consumed')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);  -- 만료분 정리 배치용

-- OAuth 리프레시 토큰 — refresh_tokens(웹 세션용)와 동일한 회전+재사용탐지+grace window
-- 알고리즘을 쓰지만 대상이 "웹 로그인 세션"이 아니라 "디바이스 그랜트(device_tokens 1행)"라
-- 별도 테이블로 둔다(§3.6에서 로직은 공용 lib로 추출해 중복은 피한다).
CREATE TABLE oauth_refresh_tokens (
  id TEXT PRIMARY KEY,
  device_token_id TEXT NOT NULL,     -- device_tokens.id — 이 리프레시 토큰이 갱신 대상으로 삼는 그랜트
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','rotated','revoked')),
  revoke_reason TEXT CHECK(revoke_reason IS NULL OR revoke_reason IN ('rotated','device_revoked','reuse_detected')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_oauth_refresh_device ON oauth_refresh_tokens(device_token_id, status);  -- 디바이스 폐기 시 연쇄 revoke(§3.7)용
```

```sql
-- migrations/0007b_oauth_clients_dcr_fallback.sql (조건부 — Tier 0 스파이크가 사전등록
-- client_id 경로 실패를 확인했을 때만 적용한다. 번호는 착수 시점 최신 번호+1로 확정.
-- §1.2/§7 Tier 2 — DCR 폴백 채택 시에만 구현.)
CREATE TABLE oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT,
  redirect_uris_json TEXT NOT NULL,
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none' CHECK(token_endpoint_auth_method = 'none'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX idx_oauth_clients_created ON oauth_clients(created_at DESC);  -- 관리자 정리 배치용
```

```sql
-- migrations/0008_device_tokens_oauth_client.sql
ALTER TABLE device_tokens ADD COLUMN oauth_client_id TEXT;  -- NULL=기존 pair-approve 발급분(레거시),
  -- 값 있음=OAuth 발급분(사전등록 경로에서는 항상 TRUSTED_MALGN_AGENT_CLIENT_ID 값이 들어간다 —
  -- 여러 client_id를 구분하는 용도라기보다 "OAuth 경유임을 표시하는 태그" 역할, §5 D+60 종료계획에서
  -- 이 컬럼의 IS NULL 비율을 그대로 활용한다)
```

```sql
-- migrations/0009_audit_logs_oauth_actions.sql
-- SQLite/D1은 CHECK 제약을 ALTER로 못 바꾸므로 표준 절차(신규 테이블 생성→복사→교체)로 enum 확장.
-- oauth_client.registered는 사전등록 경로(1차)에서는 발생하지 않는 액션이지만, 이 CHECK 확장 자체가
-- 테이블 재생성(비용 있음)이라 Tier 2(DCR 폴백) 채택 시 또 한 번의 재생성 마이그레이션을 피하려고
-- 지금 미리 enum에 포함해둔다(안 쓰이면 그냥 0건으로 남는다 — 방어적 포함, 비용 대비 안전).
CREATE TABLE audit_logs_new (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN (
    'user.role_changed',
    'device_token.issued','device_token.revoked',
    'admin.cross_user_view',
    'oauth_client.registered',
    'oauth_refresh_token.reuse_detected'
  )),
  target_type TEXT, target_id TEXT, metadata_json TEXT, created_at TEXT NOT NULL
);
INSERT INTO audit_logs_new SELECT * FROM audit_logs;
DROP TABLE audit_logs;
ALTER TABLE audit_logs_new RENAME TO audit_logs;
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id, created_at DESC);
```

`device_token.issued`/`device_token.revoked`는 **새 액션을 추가하지 않고 그대로 재사용**한다 — OAuth 코드 교환으로 `device_tokens` 행이 새로 만들어지는 것은 개념적으로 기존 "디바이스 승인"과 동일 사건이다. `metadata_json`에 `{ via: 'oauth', client_id }`를 실어 기존 pair-approve 발급분과 구분한다(§8).

### 3.5 PKCE 검증

`server/lib/tokens.js`에 추가:

```js
export async function verifyPkceS256(codeVerifier, codeChallenge) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64UrlEncode(new Uint8Array(digest)) === codeChallenge   // 기존 base64UrlEncode 재사용
}
```
`code_verifier` 길이(43~128자, RFC 7636 §4.1)와 허용 문자셋(`[A-Za-z0-9\-._~]`)도 토큰 교환 시점에 검증한다(비정상 케이스: 형식이 어긋나면 `invalid_grant`).

**redirect_uri 정책 함수(신규, §3.4에서 결정한 "DB 대신 코드 상수" 방식)**:

```js
// server/lib/oauth-redirect-uri.js (신규)
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
export function isValidLoopbackRedirect(rawUri) {
  const u = new URL(rawUri)
  return u.protocol === 'http:' && LOOPBACK_HOSTS.has(u.hostname) && u.pathname === '/callback'
  // 포트는 비교하지 않는다(§1.3) — OS가 매 실행마다 빈 포트를 고르므로.
}
```
검증 실패 시(등록·authorize·token 세 지점 모두 동일 함수 사용): `{ "error": "invalid_redirect_uri", "error_description": "redirect_uri must be http://127.0.0.1|localhost|::1/callback" }`(400, 리뷰 지적#6 반영).

### 3.6 refresh 정책 — 회전+재사용탐지 로직의 공용화

기존 `refresh_tokens`(웹 세션)의 회전+재사용탐지+10초 grace window 로직(`server/api/auth.js` `POST /refresh`, 사내 private malgnai 프로젝트에서 검증된 패턴)은 이미 정확하고 실전 검증됐다 — OAuth 리프레시(`oauth_refresh_tokens`)에도 **동일 알고리즘이 필요**하다. 이 시점에 코드를 복붙하면 두 트랙이 같은 버그를 각자 갖게 될 위험이 생긴다(트랙 A를 고쳐도 트랙 B는 그대로 남는 회귀 패턴). architect 자체 원칙(재사용 시 공용 lib 추출)에 따라:

```js
// server/lib/rotating-token.js (신규) — 회전형 opaque 토큰의 발급/회전/재사용탐지를 테이블 비의존적으로 구현
// rows: {findByHash, markRotated, revokeAll} 형태의 DAO 함수를 주입받아 refresh_tokens/oauth_refresh_tokens 양쪽에서 재사용.
export async function rotateOrDetectReuse(dao, db, rawToken, { graceMs = 10_000 } = {}) { ... }
```

`server/dao/refresh-tokens.js`(웹)와 신규 `server/dao/oauth-refresh-tokens.js`(디바이스)는 각자 테이블 이름·컬럼만 다른 얇은 DAO로 남기고, 회전/grace-window 판단 자체는 `rotating-token.js` 하나로 통일한다. **이번 설계가 확정하지 않는 것**: 기존 `server/api/auth.js`의 인라인 로직을 이 공용 lib를 쓰도록 리팩터링할지(회귀 위험 있는 기존 코드 변경) 여부는 구현 시점에 별도 판단 — 최소한 **신규 코드(oauth-refresh-tokens.js)는 처음부터 공용 lib를 쓰게** 설계한다.

**TTL 값 — 단일 정본**: 액세스 토큰(=`device_tokens.token_hash` 값의 만료) 1시간, OAuth 리프레시 토큰 90일. 이 두 값은 `server/lib/tokens.js`에 `OAUTH_ACCESS_TOKEN_TTL_SECONDS`/`OAUTH_REFRESH_TOKEN_TTL_SECONDS` 상수로 **한 곳에만** 정의하고, `server/api/oauth.js`(토큰 발급/갱신 시 사용)와 `docs/api.md`(표기용, 값이 바뀌면 같이 갱신)만 이 상수를 참조하게 한다 — 두 값이 여러 파일에 따로 박히지 않도록 구현 시 지킬 것.

**grace window 상수도 동일 원칙 적용(개정: 리뷰 지적#7 반영)**: `rotateOrDetectReuse()`의 `graceMs` 기본값(10초)을 함수 인자 기본값으로만 두지 않고, `server/lib/tokens.js`에 `REUSE_GRACE_MS = 10_000`으로 TTL 상수와 같은 방식으로 정의한다. 신규 `oauth-refresh-tokens.js`는 이 상수를 import해서 쓰고, 기존 `server/api/auth.js`의 인라인 10초 값도 **전체 리팩터링(공용 lib 전환)은 Tier2로 미루더라도 이 상수만은 지금 import하도록 최소 수정**한다 — 그래야 두 트랙의 grace window 값이 물리적으로 한 곳에서만 정의된다.

리프레시 실패(재사용탐지) 시: 해당 `device_token_id`의 `device_tokens.status`를 `revoked`로 바꾸고(탈취 의심 디바이스는 웹 세션과 달리 "유저 전체"가 아니라 **그 디바이스 하나만** 폐기 — 다른 디바이스까지 강제 로그아웃시키는 것은 과잉 대응이다), `audit_logs`에 `oauth_refresh_token.reuse_detected` 기록.

### 3.7 device_tokens 폐기와의 연동

`DELETE /api/devices/:id`(기존, 변경 없음)가 `status='revoked'`로 바꾸면:
- `/mcp` 인증은 다음 호출부터 즉시 차단(기존 로직 그대로, 변경 불필요).
- **추가 필요**: 이 시점에 연결된 `oauth_refresh_tokens`(있다면, `device_token_id`로 조회)도 `status='revoked', revoke_reason='device_revoked'`로 함께 폐기해야 한다 — 안 하면 access token 만료(1시간) 후에도 refresh_token만으로 계속 새 access_token을 받아갈 수 있는 구멍이 생긴다(비정상 케이스 의무). `server/dao/device-tokens.js`의 `revoke()` 또는 `server/api/devices.js`의 DELETE 핸들러에서 `oauth-refresh-tokens.js`의 `revokeByDeviceTokenId()`를 함께 호출하도록 구현.

## 4. malgn-agent(클라이언트) 측 설계

### 4.1 `plugin.json` 변경안 (개정: `oauth.clientId` 필드 반영, 리뷰 지적#4)

```jsonc
{
  // ...
  "mcpServers": {
    "malgnai-hub": {
      "type": "http",
      "url": "https://malgnai-hub.apiserver.kr/mcp",
      "oauth": {
        "clientId": "<Tier 0 스파이크에서 생성할 고정 client_id — 서버 env var
                      TRUSTED_MALGN_AGENT_CLIENT_ID와 동일 값이어야 함, §1.2>"
      }
      // headers.Authorization 정적 헤더 제거 — 401 + WWW-Authenticate 응답을 받으면
      // Claude Code가 oauth.clientId를 사용해 DCR 없이 OAuth discovery→authorize→브라우저
      // 로그인 흐름을 자동 수행한다(Claude Code 공식 문서로 필드 실존 확인, §1.2 — 다만
      // marketplace 배포 경로에서 이 필드가 실제로 보존되는지는 Tier 0에서 재검증 필요, §9).
    }
  }
  // userConfig.device_token 처리는 §4.2 참고 — 완전 제거가 아니라 유지 권고.
}
```

**주의(Tier 0 핵심 리스크, §1.2 재인용)**: `anthropics/claude-ai-mcp#359`는 "marketplace-synced plugin drops `oauth.clientId` from bundled `.mcp.json`"을 보고한다 — malgn-agent도 같은 마켓플레이스 배포 경로(`/plugin install`)를 쓰지만, 이 이슈 원문은 Claude Desktop 관리자 콘솔의 GitHub Sync 마켓플레이스에 대한 리포트로 Claude Code CLI 마켓플레이스와 동일 경로인지는 확인되지 않았다 — 유사 리스크로 참고만 하고 Tier 0에서 우리 환경 직접 재현 여부를 확정한다. 이 버그가 우리 환경에서도 재현되면 위 `oauth.clientId`가 로컬 설정에 반영되지 않아 사전등록 경로가 무력화된다. Tier 0 스파이크 1순위 확인 항목.

### 4.2 `userConfig.device_token` 필드 — 유지 권고(제거 아님)

**결정: 필드는 남기되 `required: false`로 완화한다.** 완전 제거를 하지 않는 이유:
- OAuth 브라우저 흐름이 동작하지 않는 예외 상황(사내망에서 로컬 루프백 리스너가 방화벽에 막히는 경우, 헤드리스/서버형 실행 환경, **또는 위 `#359`류 버그로 `oauth.clientId`가 marketplace 배포 경로에서 드롭되는 경우**)의 **탈출구**로 기존 수동 발급 경로(`/keys` 화면 → pair-init/pair-approve/pair-status → `.mcp.json` 복붙)를 그대로 살려둔다(§7).
- `mcpServers.malgnai-hub.headers`에서 정적 Authorization 헤더를 뺐으므로, `userConfig.device_token`이 남아있어도 **자동으로는 쓰이지 않는다** — 이 값을 다시 쓰려면 헤더 선언을 되살려야 하므로, 이 필드는 "값을 입력했다"는 사실 자체가 동작에 영향을 주지 않는 순수 대기 상태가 된다. 즉 안전하게 남겨둘 수 있다.
- `required: true`를 유지하면 신규 설치 시 여전히 "값을 입력해야 진행되는" 프롬프트가 뜨므로(수동 절차 제거라는 목표에 위배), `required: false`로 바꿔 **아무것도 입력하지 않고 Enter만 쳐도 설치가 끝나게** 한다.

향후(§7 판단에 따라) 완전 제거할 수도 있으나, 이번 설계는 "필드 유지 + 자동 미사용"까지만 확정한다.

## 5. 기존 device_token 방식과의 공존/마이그레이션 전략

| 대안 | 내용 | 판단 |
|---|---|---|
| A. 한꺼번에 cutover | 새 플러그인 버전 배포와 동시에 pair-init/pair-approve/pair-status 폐기, 기존 device_token 전부 무효화 | 기각 — 이미 발급되어 쓰이고 있는 device_token(예: OTel Collector의 `POST /api/sessions` 인증, `architecture.md` §7.2)까지 한꺼번에 끊긴다. 되돌릴 방법이 없는 비가역 작업이라 리스크가 크다. |
| B. 이행기 병행 허용(**채택**) | `/mcp` Bearer 검증은 OAuth 발급분과 레거시 발급분을 구분하지 않는다(§2에서 이미 구조적으로 그렇다 — 추가 구현 불필요). 이슈 경로(pair-init 등)도 당분간 그대로 둔다. | §2에서 확인했듯 `device-auth.js`를 전혀 안 건드려도 이미 병행이 성립한다 — "허용할지 말지"를 고민할 필요 없이 **구조상 자동으로 병행된다.** 결정할 것은 "레거시 발급 UI(`/keys`의 '새 인증키 발급' 버튼)를 언제 어떻게 줄이는가"뿐이다. |

**레거시 발급 UI 종료 계획 — 확정 트리거(개정: 리뷰 지적#3 반영, "측정만 하고 계획은 없음" 문제 해소)**:

즉시 제거하지 않는다. 대신 다음 트리거를 이 설계 문서 자체에 못박는다(문서화는 Tier 1, 실행은 트리거 도달 시 별도 착수 — 리뷰 권고대로 Tier2가 아니라 Tier1에 "종료 계획 수립"을 포함):

- **D+60(OAuth 기능 배포일 기준) 재검토 체크포인트**: `SELECT COUNT(*) FILTER(WHERE oauth_client_id IS NOT NULL) * 1.0 / COUNT(*) FROM device_tokens WHERE status='active'`로 OAuth 경유 비율을 측정.
  - **60% 이상**이면: (a) `/keys` 화면의 "새 인증키 발급" 버튼을 "고급 설정" 아코디언 뒤로 숨긴다(완전 제거 아님 — §4.2의 탈출구는 유지). (b) 그 시점 기준 `expires_at IS NULL`인 레거시 활성 토큰에 소급 `expires_at = created_at + 180일` UPDATE 마이그레이션을 적용하고, `/keys` 화면에 "이 인증키는 YYYY-MM-DD 만료 예정 — OAuth로 재발급 권장" 배너를 노출한다.
  - **60% 미만**이면: 전환하지 못한 소비자(예: `architecture.md` §7.2의 OTel Collector처럼 브라우저 OAuth 흐름 자체를 탈 수 없는 자동화 클라이언트)를 먼저 식별한다 — 이런 소비자는 "레거시 UI를 언젠가 폐기"하는 문제가 아니라 "레거시 발급 경로를 이런 비대화형 소비자 전용으로 좁히는" 별도 재검토로 전환한다. D+90에 재측정.
- 이 트리거는 구현 착수 시 malgnai-public STATUS.md 또는 malgnai-mcp `decision_add`에 "D+60 재검토 필요" 항목으로 반드시 등록한다 — 그래야 무기한·무회전 레거시 경로가 "측정만 되고 종료일은 없는" 상태로 방치되지 않는다(리뷰 지적#3이 지목한 핵심 문제).

## 6. 보안 고려사항 (개정: 사전등록 client_id 채택으로 컨센트 피싱 리스크 구조적 해소, 리뷰 지적#2)

- **client_id/client_name 신뢰 매핑 — 단일 정본**: `TRUSTED_MALGN_AGENT_CLIENT_ID`(env var, client_id 값)와 이에 대응하는 표시용 client_name("맑은소프트 malgn-agent 플러그인")은 `server/lib/oauth-trusted-clients.js`(신규, 상수 하나)에 **한 곳에만** 정의한다. `POST /api/oauth/authorize-context`는 이 매핑에서 client_name을 조회해 동의 화면에 보여준다 — 요청 바디나 DB의 사용자 입력값을 그대로 표시하지 않으므로, 초안이 안고 있던 **DCR 컨센트 피싱 리스크(임의 등록자가 "malgn-agent"를 사칭해 client_name을 등록하는 경로)가 구조적으로 사라진다**(리뷰 지적#2 해소 — DCR을 아예 안 쓰므로 자기신고 client_name 자체가 존재하지 않음). `plugin.json`의 `oauth.clientId`와 이 상수가 어긋나면 로그인 자체가 막히므로(안전 실패), **값 변경 시 malgnai-public과 malgn-agent 두 저장소를 함께 배포해야 한다**는 점을 배포 체크리스트에 남긴다.
- **redirect_uri 정책**: DB 조회가 아니라 코드 상수 정책 함수(`isValidLoopbackRedirect()`, §3.5)로 검증 — scheme=`http`, host∈`{127.0.0.1, localhost, ::1}`, path=`/callback` 고정, 포트는 무시(§1.3). 이 정책을 벗어나면 `invalid_redirect_uri`(§3.1). 외부 도메인 redirect_uri를 허용하면 인가 코드 탈취(open redirect) 경로가 생기므로 루프백 외에는 authorize/token 양쪽에서 항상 거부한다.
- **DCR 오남용 — Tier 2 폴백 채택 시에만 해당**: 사전등록 client_id 경로(§1.2)가 유지되는 한 이 리스크 자체가 존재하지 않는다. 만약 Tier 0 스파이크가 실패해 DCR 폴백을 실제로 구현하게 되면, 그 시점에 반드시 다음을 함께 구현한다: (a) 동의 화면에 "이 클라이언트는 등록된 지 N분 전이며 아직 아무도 승인한 적 없습니다" 같은 신규/미검증 클라이언트 경고 배지, (b) 오래된 미사용 `oauth_clients`(등록 후 일정 기간 내 토큰 발급 이력이 없는 것) 정리 배치(§7 Tier 2).
- **토큰 탈취/재사용 방지**: PKCE(S256만 허용, plain 거부)로 인가 코드 가로채기 방어. refresh_token 회전+재사용탐지(§3.6)로 탈취된 refresh_token 재사용 시 즉시 그 디바이스 무효화. access_token(=device_tokens.token_hash)은 원문을 저장하지 않고 SHA-256 해시만 저장(기존 관례 그대로).
- **audit_logs 확장**: 기존 `device_token.issued`/`device_token.revoked`를 OAuth 발급분에도 그대로 적용(§3.4) + 신규 `oauth_refresh_token.reuse_detected`(탈취 의심 시) 액션 추가. `oauth_client.registered`는 CHECK enum에 방어적으로 포함해뒀지만(§3.4) DCR 폴백을 실제로 구현하기 전까지는 발생하지 않는다.
- **부수 발견(기존 갭)**: `server/api/auth.js`의 웹 refresh 재사용탐지(`TOKEN_REUSED`) 분기는 현재 `audit_logs`에 아무것도 기록하지 않는다(코드 확인 완료 — `refreshTokensDao.revokeAllForUser`만 호출하고 `auditLogsDao.record` 호출이 없음). 이번 OAuth 설계에서 새로 만드는 `oauth_refresh_token.reuse_detected`와의 일관성을 위해, **기존 웹 refresh 경로에도 같은 감사 로그를 남기는 것을 함께 권고**한다(§7 Tier 2 — 이번 마이그레이션 범위 밖이지만 발견한 김에 기록).
- **State 파라미터**: CSRF 방지용 `state`는 클라이언트(Claude Code)가 생성·검증하는 값으로, 서버는 authorize 요청에서 받은 `state`를 redirect 시 그대로 되돌려주기만 하면 된다(서버가 별도로 저장/검증할 필요 없음 — RFC 6749 표준 책임 분담).

## 7. 영향받는 파일 전체 목록 (개정: Tier 0 게이트 신설, Tier 1/2 재배치 — 리뷰 지적#1·#4 반영)

### Tier 0 — 구현 착수 전 필수 게이트 (신규, prose 권고에서 승격 — 리뷰 지적#4)

| 항목 | 통과 기준 | 실패 시 |
|---|---|---|
| `oauth.clientId`가 marketplace 배포 `plugin.json` 경유로도 로컬 설정에 보존되는가(`anthropics/claude-ai-mcp#359` 재현 여부) | `/plugin install`로 설치 후 `claude mcp get malgnai-hub`에 `oauth.clientId`가 나타남 | §1.2 DCR 폴백(Tier 2)으로 전환 |
| discovery(`GET /.well-known/oauth-*`)가 wrangler.jsonc 갱신 후 실제로 JSON을 반환하는가(HTML 폴백 아님) | curl 왕복 확인(§3.2) | `run_worker_first` 재확인 |
| `/mcp` 401 → Claude Code가 자동으로 discovery→authorize→브라우저 오픈까지 수행하는가, DCR을 강제 시도하지 않는가(`#67258`/`#38102`류 증상 없음) | 실기동 확인 | DCR 폴백(Tier 2)으로 전환 또는 `claude mcp login malgnai-hub` 수동 안내로 완화 |
| `--callback-port` 고정 시 redirect_uri 매칭이 단순해지는가(참고) | 확인만, 채택 여부는 §1.3 유지 | 포트 무시 매칭(§1.3) 그대로 사용 |

이 표를 전부 통과해야 아래 Tier 1 구현에 착수한다. 실패 항목이 있으면 해당 행이 가리키는 폴백으로 전환 후 재착수.

### Tier 1 — 핵심 메커니즘 (malgnai-public, 이 세션 범위 밖 — 별도 위임 필요)

| 파일 | 변경 |
|---|---|
| **`wrangler.jsonc`** | **신규 항목(리뷰 지적#1) — `assets.run_worker_first`에 `/.well-known/oauth-*` 추가(§3.2)** |
| `migrations/0007_oauth_tokens.sql` | 신규 — `oauth_authorization_codes`/`oauth_refresh_tokens` (§3.4, `oauth_clients` 제외 — Tier 2로 이동) |
| `migrations/0008_device_tokens_oauth_client.sql` | 신규 — `device_tokens.oauth_client_id` 컬럼 추가 (§3.4) |
| `migrations/0009_audit_logs_oauth_actions.sql` | 신규 — `audit_logs.action` enum에 `oauth_client.registered`(방어적 포함)/`oauth_refresh_token.reuse_detected` 추가 (테이블 재생성 방식, §3.4) |
| `server/dao/oauth-authorization-codes.js` | 신규 — 코드 발급/조회/소비 |
| `server/dao/oauth-refresh-tokens.js` | 신규 — `rotating-token.js` 위에 얇게 구현 |
| `server/dao/device-tokens.js` | 수정 — `insert()`에 `oauth_client_id`/`expires_at` 반영, refresh 성공 시 `token_hash`/`expires_at` 갱신하는 `rotateToken()` 추가 |
| `server/lib/rotating-token.js` | 신규 — 회전+재사용탐지 공용 lib (§3.6) |
| `server/lib/tokens.js` | 수정 — `verifyPkceS256()`, `OAUTH_ACCESS_TOKEN_TTL_SECONDS`/`OAUTH_REFRESH_TOKEN_TTL_SECONDS`/`REUSE_GRACE_MS` 상수 추가(§3.6) |
| `server/lib/oauth-redirect-uri.js` | 신규 — `isValidLoopbackRedirect()` 코드 상수 정책(§3.5, §3.4 — DB 테이블 대신) |
| `server/lib/oauth-trusted-clients.js` | **신규(개정 추가)** — `TRUSTED_MALGN_AGENT_CLIENT_ID` ↔ client_name 단일 매핑(§6) |
| `server/api/oauth.js` | 신규 Hono 라우터 — discovery 2종 + `/api/oauth/token` + authorize-context + consent (§3.1, register 제외 — Tier 2) |
| `server/index.js` | 수정 — `/mcp` 401에 `WWW-Authenticate` 헤더 추가(§3.2), `/.well-known/oauth-*`를 `webApp`으로 라우팅하는 조건 추가 |
| **`server/middleware/jwt-auth.js`** | **신규 항목(개정 추가, §3.2)** — `PUBLIC_PATHS`에 `/api/oauth/token` 추가(§3.2 옵션 B로 인해 필요해짐 — 초안의 "수정 불필요" 판단 무효화) |
| `server/api/devices.js` | 수정 — `DELETE /:id`에서 연결된 `oauth_refresh_tokens` 연쇄 폐기 호출 추가(§3.7) |
| `app/pages/oauth/authorize.vue` | 신규 — 로그인 단축경로 + 동의 화면 (§3.3) |

**종료 계획 문서화(리뷰 지적#3 — Tier2가 아니라 Tier1에 포함)**: §5의 D+60 트리거를 malgnai-public STATUS.md 또는 malgnai-mcp `decision_add`에 등록하는 것까지 Tier 1 완료 조건에 포함한다(실행 자체는 D+60 도달 시).

### Tier 1 — 핵심 메커니즘 (malgn-agent, 이 저장소 — claude-plugins 범위 내)

| 파일 | 변경 |
|---|---|
| `malgn-agent/.claude-plugin/plugin.json` | `mcpServers.malgnai-hub.headers` 제거, `oauth.clientId` 추가(§4.1, 개정), `userConfig.device_token.required`를 `false`로 완화 (§4) |

### Tier 2 — 후속 검토 / DCR 폴백 조건부 (이번 문서에서 확정하지 않음)

- **DCR 폴백 전체(Tier 0 스파이크 실패 시에만 착수)**: `migrations/0007b_oauth_clients_dcr_fallback.sql`(`oauth_clients` 테이블, §3.4) + `server/dao/oauth-clients.js`(신규) + `POST /api/oauth/register`(§3.1) + 동의 화면 신규/미검증 클라이언트 경고 배지(§6) + 오래된 미사용 `oauth_clients` 정리 배치(§6) + 관리자용 `oauth_clients` 목록/폐기 웹 UI + DCR 요청 rate limiting(Cloudflare 레벨).
- `server/api/auth.js` 웹 refresh 재사용탐지 분기에 `audit_logs` 기록 추가(§6, 기존 갭 — OAuth와 별개로도 고쳐야 함).
- `server/api/auth.js`의 인라인 grace window 값을 `REUSE_GRACE_MS` 상수로 교체하는 전체 리팩터링(상수 자체는 Tier1에서 이미 통일, §3.6).
- `/keys` 화면의 "새 인증키 발급" 버튼 노출 정책 — D+60/D+90 트리거로 구체화됨(§5), 실행은 트리거 도달 시.
- `docs/architecture.md`/`docs/api.md`/`docs/schema.sql`(malgnai-public 로컬 전용, git 미추적) 정본 갱신 — 실제 구현 시 함께 반영 필요.

## 8. 4대 설계의무 자기검증 (개정)

- **①트레이드오프**: 사전등록 client_id vs DCR(§1.2, 이번 개정의 핵심 변경), wrangler.jsonc `run_worker_first` 옵션 A(전부 추가) vs 옵션 B(well-known만 추가+나머지 `/api/` 편입)(§3.2, 신규), redirect_uri 검증 DB vs 코드 상수 정책(§3.4, 신규), 스키마 확장 vs 신규 병렬 테이블(§3.4), cutover vs 병행(§5) — 다섯 곳에서 대안·선택이유·포기한 것·감당방안을 명시.
- **②프로젝트 고유성**: 이 설계의 핵심 차별점은 "`/mcp` 인증 검증 코드를 한 줄도 바꾸지 않고 OAuth를 얹는다"는 점(§2) — device_tokens가 이미 opaque bearer + 해시저장 구조였기 때문에 가능했던, 이 프로젝트의 기존 구조를 정확히 활용한 설계다. 범용 OAuth 튜토리얼을 그대로 복붙한 설계였다면 이 재사용 지점을 놓치고 병렬 인증 경로를 새로 만들었을 것이다.
- **③비정상 케이스**: PKCE 실패(§3.5), redirect_uri 정책 위반(`invalid_redirect_uri`, §3.4/§3.5), client_id 불일치(`invalid_client`, §3.1), 인가 코드 재사용/만료(§3.4 단일소비+60초 TTL), refresh 토큰 재사용탐지+grace window(§3.6), 디바이스 폐기 시 연쇄 refresh 무효화 누락 방지(§3.7), 레거시 인증 경로 무기한 방치(§5 D+60 트리거, 신규), marketplace 배포 경로에서 `oauth.clientId`가 드롭되는 경우의 탈출구(§4.2) 모두 설계에 포함.
- **④완결성**: 신규 엔드포인트 6개(§3.1) 각각 인증방식·역할 명시, 스키마 신규 테이블 전부 인덱스+근거+제약 포함(§3.4), 기존 테이블 확장분도 마이그레이션 SQL로 구체화. **개정 추가**: 완결성은 명세가 존재하는 것만으로 성립하지 않는다 — reviewer 풀패널이 지적했듯 "명세가 완결됐다"와 "그 명세가 실제로 호출되는 경로까지 확인했다"는 다른 주장이다. 이번 개정은 §3.2에서 `wrangler.jsonc` 실측 대조로 라우팅 도달 가능성까지 검증했다 — 이후 설계에서도 자기검증 항목에 "명세뿐 아니라 그 명세가 실제로 실행되는 경로까지 확인했는가"를 포함한다.

## 9. 미결/후속 과제 (정직 명시, 개정)

- **Claude Code의 실제 OAuth 클라이언트 동작이 부분 검증됐다.** (a) 401+WWW-Authenticate를 받아 자동으로 discovery→authorize→브라우저 오픈까지 수행하는지는 여전히 실기동 미검증 — Tier 0에서 확인. (b) `plugin.json`의 `mcpServers` 스키마가 client_id 필드를 지원하지 않는다는 초안의 전제는 **이번 개정에서 반증됐다** — `oauth.clientId` 필드가 공식 문서에 명시돼 있다(§1.2). 다만 **marketplace 배포 plugin.json 경유 시에도 이 필드가 보존되는지**(`anthropics/claude-ai-mcp#359` 사례)는 여전히 미검증 — Tier 0 1순위 항목. (c) client_id 캐싱 문제는 DCR 폴백에만 해당하며, 사전등록 경로에서는 client_id가 애초에 고정값이라 무관하다.
- **DCR 완전 지원 여부/다른 회사가 이 MCP를 붙일 가능성**: 사전등록 client_id를 1차 채택했으므로 malgn-agent 외 제3자 클라이언트는 애초에 이 서버에 연결할 방법이 없다(DCR 미노출, §3.1). 사내 전용을 벗어나 외부 파트너/다른 회사가 이 MCP에 붙는 시나리오가 생기면 Tier 2 DCR 폴백 구현 + client_id별 스코프 제한 + 관리자 승인형 등록 등 추가 설계가 필요하다 — 이번 문서는 다루지 않는다.
- **레거시 발급 UI(`/keys` "새 인증키 발급") 폐기 시점**: 이번 개정에서 §5에 D+60/D+90 구체적 트리거로 확정했다(리뷰 지적#3 해소) — 남은 것은 트리거 도달 시 실제 실행뿐.
- **관리자용 `oauth_clients` 관리 화면**: DCR 폴백 채택 시에만 필요(§7 Tier 2).
- **refresh 실패 시 Claude Code가 자동으로 재로그인 브라우저를 다시 띄우는지**: 클라이언트 구현에 달려 있어 서버 설계 문서인 이 문서가 보장할 수 없다.
- **malgnai-public STATUS.md 이관 포인터**: 이번 개정과 함께 `malgnai-public/STATUS.md`에 이 설계 문서에 대한 포인터를 추가했다(리뷰 지적#5 해소, claude-plugins PM 세션이 직접 실행).
