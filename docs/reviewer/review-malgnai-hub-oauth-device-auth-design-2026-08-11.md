# malgnai-hub OAuth 2.1(PKCE) 인증 전환 설계 — 리뷰 보고서

리뷰 페르소나 패널: `docs/reviewer/personas/persona-mcp-oauth-security-auditor.md`, `persona-mcp-oauth-feasibility-realist.md`, `persona-hub-schema-routing-consistency-auditor.md`, `persona-cross-repo-handoff-executability-auditor.md`, `persona-auth-flow-zero-based-challenger.md`(발산형)
리뷰 대상: `/Users/hopegiver/workspace/claude-plugins/docs/decision/malgnai-hub-oauth-device-auth-design.md` (397줄, architect 작성)
리뷰 일자: 2026-08-11
등급: Sensitive(회사 전 직원 인증 체계) — 풀 패널(5명, 발산형 포함) 투입
종합 판정: 🔴 **Red** — Critical 1건 존재(실제 구현 시 핵심 엔드포인트가 조용히 동작하지 않음)

## 요약 (2분 규칙)
설계 문서 자체는 트레이드오프·비정상케이스·근거 인용 밀도가 높고 실제 코드(`server/index.js`, `device-auth.js`, `auth.js` 등)를 정확히 읽고 인용했다(전량 실측 대조로 확인). 그러나 **§3.2의 라우팅 변경만으로는 신규 OAuth 엔드포인트(`.well-known/*`, `/oauth/register`, `/oauth/token`)가 실제로 Worker 코드에 도달하지 않는다** — `wrangler.jsonc`의 `assets.run_worker_first`가 `["/api/*", "/mcp*"]`로 고정돼 있어(문서가 §3.2 바로 옆 문단에서 `/oauth/authorize`에 대해 이 설정을 정확히 분석해놓고도, 그 반대 방향인 신규 bare 경로에는 같은 논리를 적용하지 않았다), 이 설정을 함께 갱신하지 않으면 구현해도 Claude Code가 discovery 단계에서부터 JSON 대신 SPA index.html을 받는다(Critical). 그 외 DCR 컨센트 화면의 client_name 스푸핑(피싱) 리스크, 레거시 device_token 무기한 공존의 종료 계획 부재, DCR 채택의 핵심 전제("client_id 지정 필드 없음") 자체가 부정확할 가능성, malgnai-public 저장소 자신의 STATUS.md에 이 설계에 대한 포인터가 전혀 없어 다음 세션이 발견 못 할 위험 — 4건의 Major가 함께 발견됐다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 문제 | 개선안 |
|---|-------|------|------|------|--------|
| 1 | 🔴 | 스키마·라우팅 | 설계문서 §3.2 vs 실제 `malgnai-public/wrangler.jsonc:36` (`run_worker_first: ["/api/*", "/mcp*"]`) | §3.2가 `server/index.js`의 `fetch()` 조건에 `.well-known/oauth-*`·`/oauth/register`·`/oauth/token`을 추가하는 코드만 제시했는데, 이 세 경로는 `run_worker_first`에 없어 Cloudflare Workers 정적자산 라우팅이 Worker `fetch()` 실행보다 먼저 개입한다. 매칭되는 정적파일이 없으므로 `not_found_handling: "single-page-application"`이 즉시 개입해 **Worker 코드를 호출하지 않고** `index.html`을 200으로 반환한다(공식 문서: "All other requests either serve an asset that matches or serve the index.html fallback, without ever hitting this code" — Cloudflare Workers Docs). 결과적으로 discovery(`GET /.well-known/oauth-*`)·DCR(`POST /oauth/register`)·토큰교환(`POST /oauth/token`) 전부가 JSON 대신 HTML을 반환 — Claude Code의 OAuth discovery가 파싱 실패로 조용히 깨진다. 문서는 바로 위 문단(§3.2 두 번째 단락)에서 `/oauth/authorize`에 대해 이 정확한 메커니즘을 분석해놓고, 신규 bare API 경로에는 같은 분석을 적용하지 않았다. §7 Tier1 파일목록에도 `wrangler.jsonc` 수정이 빠져 있다. | `wrangler.jsonc`의 `assets.run_worker_first`에 `.well-known/oauth-*`·`/oauth/register`·`/oauth/token`(또는 이 넷을 포괄하는 패턴)을 추가하고, §7 Tier1 표에 `wrangler.jsonc` 수정 항목을 명시. Tier 0 스파이크(§1.2)에 이 라우팅 왕복 자체를 반드시 포함(curl로 discovery 엔드포인트가 실제로 JSON을 반환하는지 1차 검증). |
| 2 | 🟠 | 보안 | 설계문서 §1.2, §3.3 5단계, §6 | DCR(`POST /oauth/register`)은 무인증으로 임의 `client_name`을 받는다(§3.1 표). 이 값은 §3.3 5단계에서 동의 화면에 그대로 노출돼 사용자가 "허용" 여부를 판단하는 유일한 신뢰 신호가 된다. §1.2의 감당방안("실질적 인가 게이트는 authorize 단계 JWT 로그인+동의")은 "공격자가 토큰을 직접 훔치는 경로"만 막을 뿐, "사용자가 `client_name: '맑은소프트 공식 도구'` 같은 위장 이름을 진짜로 착각해 스스로 승인"하는 컨센트 피싱 경로는 다루지 않는다 — client_name이 검증되지 않은 자기신고 값이라는 사실 자체가 §6 보안 고려사항 목록에서 누락됨. | 동의 화면에 "이 클라이언트는 등록된 지 N분 전이며 아직 아무도 승인한 적 없습니다" 같은 신규/미검증 클라이언트 경고 배지 추가, 또는 §Rethink(아래)처럼 DCR 자체를 재검토. 최소한 §6에 이 리스크를 명시하고 사용자 교육(동의 화면 문구)으로 완화할 것. |
| 3 | 🟠 | 보안 | 설계문서 §5, §9 "레거시 발급 UI 폐기 시점" | §5는 "이행기 병행 허용"을 채택하며 `device_tokens.oauth_client_id IS NULL` 비율을 추적하겠다고 했지만, §9는 스스로 "구체적 폐기 기준(비율/기간)은 정하지 않았다"고 명시한다. 레거시 `device_token`은 `expires_at`이 영구 NULL(만료 없음)이고 회전·재사용탐지가 전혀 없다(`malgnai-public/server/dao/device-tokens.js:4-11` 확인) — OAuth 도입 후에도 이 무기한·무회전 경로가 "측정"만 되고 "종료일"은 없는 상태로 영구히 남을 수 있다. 사용자가 리뷰 요청 시 지목한 "약한 인증 경로가 영구히 남는 문제"가 설계상 해소되지 않는다. | §5에 구체적 종료 기준(예: "배포 후 60일 시점에 레거시 발급분에도 소급 `expires_at` 부여 + 재발급 유도 배너") 확정. 최소한 Tier2가 아니라 Tier1에 "종료 계획 수립"을 포함시켜 무기한 방치를 막을 것. |
| 4 | 🟠 | 실현가능성 | 설계문서 §1.2 (a), §9 | §1.2는 DCR 채택의 핵심 근거로 "`plugin.json`의 `mcpServers.malgnai-hub` 선언에 client_id를 지정할 필드가 없다"를 들었다(§9에서도 "검증 필요"로 셀프 플래그). 웹 검색으로 확인한 공개 정보(Anthropic 공식 MCP 문서·`anthropics/claude-code` GitHub Issue #67258 제목 "MCP OAuth with pre-configured **oauth.clientId**...")에 따르면, Claude Code의 MCP 서버 설정에는 `oauth.clientId`/`authServerMetadataUrl` 같은 사전등록 필드가 실제로 존재하는 것으로 보인다(다만 이 필드가 `.mcp.json`뿐 아니라 plugin 마켓플레이스 `plugin.json`에도 노출되는지는 로컬 malgn-agent 소스만으로 확정 불가 — 이 리뷰도 "확인 필요"로만 표기). 이 전제가 틀리면 DCR 채택 근거(§1.2 표의 기각 이유 (a))가 무너지고, `oauth_clients` 테이블·`POST /oauth/register`·등록남용 방어·정리배치(§6, §7 Tier2)라는 상당한 구현 범위가 애초에 불필요했을 수 있다. | Tier 0 스파이크(§1.2)에 "`oauth.clientId` 사전등록 경로가 실제로 동작하는지"를 discovery/DCR 자동화 검증과 같은 우선순위로 명시적으로 포함. 스파이크가 prose 권고로만 남지 않도록 §7에 "Tier 0 — 구현 착수 전 필수 게이트" 행을 별도로 추가. |
| 5 | 🟠 | 범위·이관 | malgnai-public `STATUS.md`(최종 갱신 2026-08-05, project_id `693caed1-...`) | 설계문서는 malgnai-public 저장소를 대상으로 §7 Tier1 표에 구체적 파일 목록(마이그레이션 3개, DAO 3개, lib 2개, 라우터 1개 등)을 남겼지만, **malgnai-public 자신의 STATUS.md에는 이 설계에 대한 어떤 포인터도 없다**(실측 확인: `grep -i oauth STATUS.md` 결과 기존 "MCP 인증 OAuth 도입은 이번엔 보류"(decision `bfc11390`) 문구만 있고 갱신 없음). malgnai-public의 부트스트랩 규율 자신이 "STATUS.md+CLAUDE.md면 오리엔테이션 충분, 코드/docs 통독 금지"를 명시하므로, 이 규율을 따르는 다음 세션은 이 설계 문서의 존재 자체를 구조적으로 알 수 없다. 게다가 malgnai-public의 `docs/`는 `.gitignore` 대상(로컬 전용)이라, 설계 문서가 이 문서가 실제로 놓인 claude-plugins 저장소와 malgnai-public 저장소는 완전히 분리된 두 세계다. | claude-plugins PM(이 세션)이 malgnai-public `STATUS.md`에 짧은 포인터 1줄("OAuth 전환 설계 존재, 경로: claude-plugins/docs/decision/malgnai-hub-oauth-device-auth-design.md, 재검토 필요")을 남기거나, malgnai-mcp `decision_add`(project_id `693caed1-0d3d-4819-b787-75baa829bb80`)로 같은 내용을 기록할 것. 이 실행 자체는 reviewer 역할 밖(비가역 아니지만 "실행"에 해당) — PM에게 권고로 전달. |
| 6 | 🟡 | 보안 | 설계문서 §1.3, §3.1 | 루프백 전용 redirect_uri 강제 요구가 §1.3/§6 prose에는 있지만, §3.1 엔드포인트 계약 표에 "외부 도메인 등록 시 어떤 에러코드로 거부하는지"가 명시돼 있지 않다. | §3.1 `POST /oauth/register` 행에 실패 시 에러 응답 형식(`invalid_redirect_uri` 등) 추가. |
| 7 | 🟡 | 스키마·라우팅 | 설계문서 §3.6 | 웹 refresh(`server/api/auth.js`)와 OAuth refresh(`oauth-refresh-tokens.js`)가 같은 회전+재사용탐지+10초 grace window 알고리즘을 공용 lib(`rotating-token.js`)로 쓰자는 제안은 타당하지만, 기존 `auth.js`를 이 lib로 리팩터링할지 여부를 "구현 시점 판단"으로 미뤄, 결과적으로 두 값(예: grace window 10초)이 물리적으로 다른 곳(기존 인라인 로직 vs 신규 lib 상수)에 남을 위험이 있다. TTL 값처럼(§3.6 "TTL 값 — 단일 정본") grace window도 단일 상수화 지침이 없다. | `REUSE_GRACE_MS`도 TTL 상수와 같은 방식으로 `server/lib/tokens.js`에 단일 정의, 기존 `auth.js`도 최소한 이 상수를 import하도록 지침 추가(전체 리팩터링은 Tier2로 미루더라도). |

## 페르소나별 관점

### [MCP OAuth 보안 감사관] — 판정: 🟠 Amber
PKCE(S256 전용)·redirect_uri 포트무시/문자열엄격비교 구분(§1.3)은 RFC 8252/OAuth 2.1 요구사항과 정확히 일치해 프로토콜 차원 방어는 탄탄하다. 그러나 "토큰 탈취를 막는 방어"와 "사용자가 속아서 스스로 승인하는 것을 막는 방어"는 다른 문제인데, DCR의 자기신고 `client_name`이 동의 화면의 유일한 신뢰 신호가 되는 구조(#2)와, 레거시 device_token의 무기한·무회전 공존에 종료계획이 없는 점(#3)은 실제 위협모델에서 놓친 축이다.

### [MCP 클라이언트 실현가능성 현실주의자] — 판정: 🟠 Amber
문서가 §9에서 스스로 "미검증"을 3가지나 정직하게 표시한 점은 높이 평가한다. 다만 그중 하나("client_id 지정 필드 없음")가 DCR 채택이라는 큰 구조적 결정의 유일한 정당화 근거였는데, 이 리뷰의 웹 조사로 그 전제 자체가 흔들릴 수 있다는 게 확인됐다(#4). Tier 0 스파이크가 실행을 막는 게이트가 아니라 prose 권고로만 남아있어, 다음 세션이 검증 없이 12개 이상 신규 파일 구현에 들어갈 프로세스적 위험이 있다.

### [malgnai-hub 스키마·라우팅 정합성 감사관] — 판정: 🔴 Red
스키마 설계(§3.4)·DAO 재사용 판단(§2)은 실제 코드(`device-auth.js`, `device-tokens.js`, `auth.js`)와 정확히 일치해 신뢰할 만하다. 그러나 이 신뢰가 오히려 함정이다 — §3.2의 라우팅 변경 코드 자체는 정확하지만 **그 코드가 실행될 조건**(`wrangler.jsonc`의 `run_worker_first`)을 갱신하지 않아, 신규 엔드포인트 6개 중 4개(`/.well-known/*` 2개, `/oauth/register`, `/oauth/token`)가 실제로는 도달 불가능하다(#1, Critical). 이 판정만으로 종합 RAG가 Red로 확정된다.

### [저장소 간 이관 실행가능성 감사관] — 판정: 🟠 Amber
§7 Tier1 malgnai-public 표 자체는 파일·역할·마이그레이션 번호까지 구체적이라 "다음 세션이 표만 보고 착수 가능한 수준"이라는 요구는 충족한다(문서 내용 품질은 통과). 그러나 그 표에 도달하는 경로가 없다(#5) — 아무리 잘 쓴 지시서라도 대상 저장소가 그 존재를 모르면 실행되지 않는다.

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|----------|----------|------------|----------------|
| 1 | DCR(무인증 등록 상시 오픈) + `oauth_clients` 테이블 + 등록남용 방어 + 정리배치(§7 Tier2) | Tier 0 스파이크에서 `oauth.clientId` 사전등록 경로(지적#4 근거) 검증을 최우선 수행하고, 동작하면 고정 client_id로 전환 — `oauth_clients` 테이블·`POST /oauth/register`·정리배치를 통째로 제거 | client_id는 비밀이 아니므로 `plugin.json`에 하드코딩해도 안전하고, 이 저장소는 이미 마켓플레이스 버전 배포 파이프라인(v1.0→v1.3.0, 빈번한 bump 이력)이 있어 §1.2가 사전등록안을 기각한 유일한 이유("배포해야 client_id를 바꿀 수 있어 유연성 낮음")의 실비용이 낮다. DCR 고유 리스크(#2 컨센트 피싱, 무한 등록 정리)가 구조적으로 사라진다 | 낮음 — 스파이크 범위 내 추가 검증 1건. 채택 시 오히려 구현 범위(신규 파일 수) 축소 |
| 2 | 레거시 `device_token` 무기한 공존, 폐기 기준 §9가 스스로 미정 | §5에 확정 종료일 기준 명시(예: "배포 후 60일 시점 소급 `expires_at` 부여 + 재발급 유도 배너"), OAuth 도입과 동시에 이행기 종료조건을 문서에 못박기 | "비율을 측정만 하고 계획은 없음"에서 "종료일이 있는 이행"으로 전환 — 보안 감사 시 "왜 아직도 무기한 토큰이 있냐"는 질문에 실제 답이 생긴다 | 낮음 — 컬럼 소급 UPDATE 마이그레이션 1건 + 배너 UI, 기존 OTel Collector 등 의존 소비자는 유예기간 내 전환 유도 |
| 3(참고, 채택 판단 아님) | 이미 존재하는 `pair-init`/`pair-approve`/`pair-status`(RFC 8628 디바이스 그랜트와 동형) | (검토했으나 기각) 이 흐름을 그대로 자동화하는 대안 | plugin.json이 설치 후 임의 스크립트를 실행할 수 없는 선언적 설정만 지원하므로, Claude Code의 "401+discovery 자동 브라우저 오픈"이라는 네이티브 자동화를 얻으려면 결국 표준 MCP OAuth 흐름이 필요하다 — 이 대안은 그 자동화를 얻지 못해 기각. OAuth 표준 채택 자체는 정당하다는 결론(위 #1은 그 안에서의 최소화 제언) | 해당 없음(기각안이므로 채택 비용 산정 대상 아님) |

## 트레이드오프 (페르소나 간 충돌)
- **보안 감사관 vs 실현가능성 현실주의자**: 보안 감사관은 DCR의 컨센트 피싱 리스크(#2)를 "동의화면 경고 배지"로 완화하자고 권고했지만, 실현가능성 현실주의자와 발산형은 애초에 DCR 자체를 사전등록 client_id로 대체하면 그 리스크가 구조적으로 사라진다고 본다 → 권고: Tier 0 스파이크에서 `oauth.clientId` 경로 검증을 최우선하고, 실패할 때만 DCR+동의화면 경고배지 조합으로 폴백.
- **스키마·라우팅 감사관(Red) vs 문서의 자체 자신감(§8 "④완결성")**: 문서는 §8에서 "신규 엔드포인트 6개 각각 인증방식·역할 명시"를 완결성 근거로 들었지만, 그중 4개가 실제로는 라우팅 설정 누락으로 도달 불가능하다 — "명세가 완결됐다"와 "그 명세가 실행 가능하다"는 다른 주장임을 이번 리뷰가 보여준다. 권고: 완결성 자기검증 항목에 "명세뿐 아니라 그 명세가 실제로 호출되는 경로까지 확인했는가"를 추가.

## 잘 된 점
- §0가 요약이 아니라 실제 코드(`device-auth.js`, `jwt-auth.js`, `device-tokens.js`, `tokens.js`, `login.vue`)를 직접 읽고 인용했다 — 이번 리뷰의 실측 대조(전량)에서 인용 내용이 전부 정확했다.
- §2 "핵심 설계 원칙: `/mcp`의 인증 검증 코드는 한 줄도 바꾸지 않는다"는 실제로 `device-auth.js`의 opaque bearer+해시저장 구조를 정확히 활용한 판단이며 실측으로도 성립한다.
- §1.3 redirect_uri 포트-무시(등록 매칭) vs 문자열-엄격(authorize↔token 비교)의 구분은 RFC 8252/OAuth 2.1을 정확히 반영한 드문 수준의 디테일이다.
- §3.6 refresh 회전+재사용탐지 로직의 공용 lib화 제안은 "두 트랙이 같은 버그를 각자 갖는" 회귀 패턴을 사전에 식별한 좋은 설계 판단이다.
- §6 "부수 발견"(기존 웹 refresh 재사용탐지가 audit_logs를 안 남긴다)을 이번 스코프 밖인데도 발견 즉시 기록한 태도는 실제 코드(`server/api/auth.js:59-67`, `auditLogsDao.record` 호출 없음)로 재확인해도 정확하다.
- §9에서 3가지 미검증 사실을 스스로 밝힌 정직성 — 이번 리뷰가 그 중 하나(client_id 필드 유무)의 근거가 흔들릴 수 있음을 추가로 찾아낼 수 있었던 것도 이 정직한 플래깅 덕분이다.

## 평가기준 충족 현황

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|------|------|-------|------|------|
| 신규 엔드포인트가 실제로 Worker 코드에 도달하는가 | 스키마·라우팅 | 필수 | ❌ | #1, `wrangler.jsonc` 미갱신 |
| PKCE/redirect_uri 검증이 RFC 요구사항과 일치하는가 | 보안 | 필수 | ✅ | §1.3, §3.5 |
| DCR이 컨센트 피싱까지 막는가 | 보안 | 필수 | ❌ | #2 |
| 레거시 인증 경로에 종료 계획이 있는가 | 보안 | 권장 | ❌ | #3 |
| Claude Code 실동작 미검증 상태가 게이팅됐는가 | 실현가능성 | 필수 | ❌ | #4, prose 권고 수준 |
| malgnai-public이 이 설계를 발견 가능한가 | 범위·이관 | 필수 | ❌ | #5 |
| §7 Tier1 표가 착수 가능한 구체성을 갖는가 | 범위·이관 | 필수 | ✅ | 내용 자체는 충분히 구체적 |
| 발산형 대안(사전등록 client_id)이 고려됐는가 | 구조 | 권장 | ⚠️ | §1.2에서 비교는 했으나 근거(a)가 부정확할 가능성 재검증 필요 |

## PM에게 권고
1. **재작업 필요(차단)**: #1(`wrangler.jsonc` run_worker_first 갱신 + §7 Tier1 반영)은 이 설계를 그대로 malgnai-public에 넘기면 구현해도 조용히 동작하지 않는 Critical — 문서 수정 후 재검토 필요.
2. **구현 착수 전 게이트로 승격**: #4(Tier 0 스파이크, 특히 `oauth.clientId` 사전등록 경로 검증)를 prose 권고에서 §7의 명시적 선행조건으로 승격 권고. 이 검증 결과에 따라 발산형 제언(Rethink #1, DCR 제거)의 채택 여부가 갈린다.
3. **문서 보완(병행 가능)**: #2(컨센트 화면 신뢰신호 보강), #3(레거시 종료 기준 확정), #6·#7(계약 명세 보강)은 구조를 뒤엎지 않는 범위에서 이번 개정에 함께 반영 권고.
4. **PM 직접 실행 필요(reviewer 역할 밖)**: #5 — malgnai-public `STATUS.md`에 이 설계 문서 포인터 1줄 추가 또는 malgnai-mcp `decision_add`(project_id `693caed1-0d3d-4819-b787-75baa829bb80`) 기록. reviewer는 이 실행을 하지 않았음(검증까지만, 실행은 PM 몫).
5. **생략한 것**: 이번 리뷰는 malgnai-public 서버 코드를 실제로 기동해 discovery 엔드포인트를 curl로 왕복시키는 실기동 검증까지는 하지 않았다(설계 문서 리뷰 단계이며 구현 코드가 아직 없음 — Tier 0 스파이크가 실제로 이 실기동 검증을 담당해야 함). `oauth.clientId`가 plugin 마켓플레이스 `plugin.json` 스키마에도 노출되는지는 웹 검색 근거로만 확인했고 Claude Code 자체 소스 코드는 열람하지 못했다(비공개/미보유) — "확인 필요"로 남긴다.
