# 토큰 사용량 수집 API 스펙 — malgnai-public 구현용 (2026-08-19)

- 작성: architect, claude-plugins 세션. malgnai-public(project_id `693caed1-0d3d-4819-b787-75baa829bb80`) 저장소의 실제 구현은 이 세션 범위 밖이며, 이 문서는 그 구현을 위임하기 위한 자기완결적 스펙이다.
- 짝문서(클라이언트 설계): `docs/architecture/token-usage-collection-design-2026-08-19.md`(이하 "수집 설계 문서") — 이 문서의 모든 필드는 그 문서 §1과 동일하다.
- 전제: 이 저장소가 이미 구현/승인한 `docs/decision/malgnai-hub-oauth-device-auth-design.md`(🟢 Green, Round 2)의 `device_tokens` 인프라(Bearer + SHA-256 해시 검증, `mcp/device-auth.js`, pair-init/pair-approve/pair-status)를 그대로 재사용한다. **이 스펙은 그 인프라가 이미 존재한다는 가정 위에서 작성됐다** — malgnai-public 구현 시점에 `device_tokens` 테이블/`mcp/device-auth.js`가 실제로 이 문서가 서술한 형태로 존재하는지 먼저 확인할 것(§8).
- 등급: Sensitive(전 직원 인증 자격증명 + 개인 작업 패턴 데이터).

---

## 1. 개요

백그라운드 리포터(`bin/report-usage.mjs`, 클라이언트 측 — 수집 설계 문서 §2)가 1시간마다 각 PC에서 그날의 토큰 사용량을 재집계해 이 API로 upsert한다. 두 엔드포인트로 나눈다:

| 엔드포인트 | 목적 | 조회 권한 정책이 다른 이유 |
|---|---|---|
| `POST /api/usage/daily-aggregate` | 하루 총량(세션수/턴수/API호출수/토큰) | 개인 식별 위험이 낮음(그 날 활동했다는 사실 수준) — 조직 집계(전사 대시보드 등)에 상대적으로 자유롭게 활용 가능 |
| `POST /api/usage/detail` | 프로젝트별/도구별/서브에이전트별/**세션별** 분해 | 세션별 상세는 시간대별 활동 타임라인 재구성이 가능해 조회를 본인+감사로그 남는 관리자로 제한해야 함(§6) |

두 엔드포인트를 분리한 이유는 이 authz 차등 정책을 걸 수 있는 최소 단위이기 때문이다 — 합쳐서 하나의 엔드포인트로 만들면 "총량은 넓게 공개, 상세는 좁게 제한"이라는 정책을 한 응답 안에서 필드 단위로 걸어야 해 authz 로직이 더 복잡해진다.

---

## 2. 인증

- **방식**: 기존 `/mcp`와 동일한 **device Bearer 토큰** 검증(`mcp/device-auth.js` 로직 재사용 — JWT 웹 세션 인증이 아니다). `Authorization: Bearer <raw device token>` 헤더 → SHA-256 해시 → `device_tokens.token_hash` 조회 → `status='active'` 및 `expires_at`이 없거나 미래인지 확인.
- **스코프 검증(신규 요구사항)**: 기존 `/mcp` 인증과 달리, 이 두 엔드포인트는 **추가로** `device_tokens.scopes`에 `usage:write`가 포함돼 있는지 검증해야 한다. MCP 전용으로 발급된 토큰(scopes에 `usage:write`가 없는 기존 토큰)은 이 엔드포인트를 호출할 수 없어야 한다(최소 권한 원칙 — 수집 설계 문서 §3.2).
  - **직렬화 포맷(실측 확정, Round 2 리뷰)**: `device_tokens.scopes`는 **콤마구분 평문 문자열**이다 — JSON 배열 문자열이 아니다. 근거: `malgnai-public/migrations/0001_init_v1_schema.sql:172`의 `scopes TEXT NOT NULL DEFAULT 'project.read,project.write,telemetry.write'`. 따라서 스코프 검증 로직은 `scopes.split(',').includes('usage:write')` 형태로 구현한다(JSON.parse 사용 금지 — 이전 초안의 "JSON 배열 문자열 가정"은 폐기).
  - **구현 착수 전 필수 확인 사항(실측 확정, Round 2 리뷰)**:
    1. `server/dao/device-tokens.js`의 `insert()`는 현재 `scopes` 파라미터를 받지 않고 항상 DB `DEFAULT`(`'project.read,project.write,telemetry.write'`)를 그대로 쓴다. `purpose="usage_report"` 페어링(§9)으로 발급되는 토큰에 `usage:write`를 넣으려면, malgnai-public 구현 단계에서 **`insert()` 시그니처를 확장**해 호출자가 `scopes` 값을 지정할 수 있게 해야 한다 — 이 확장 없이는 이 스펙의 스코프 체계 자체가 성립하지 않는다.
    2. `mcp/device-auth.js`의 `deviceAuthMiddleware`는 현재 `scopes` 컬럼을 파싱하거나 검증하는 로직이 전혀 없다(토큰 유효성만 확인하고 그대로 통과시킨다). 즉 이 스펙이 요구하는 `usage:write` 스코프 체크는 기존 코드 재사용이 아니라 **완전 신규 구현**이다 — "기존 device-auth 로직 재사용"이라는 표현(§8 등)은 Bearer 해시 검증 부분에 한정되며, 스코프 검증까지 자동으로 딸려오는 것이 아님에 유의.
- **실패 응답**:
  - 토큰 자체가 무효(해시 불일치/미존재/revoked/만료): `401 { "error": { "code": "UNAUTHORIZED", "message": "invalid or expired device token" } }` — 기존 `/mcp` 401 응답과 동일 포맷(`server/index.js` 기존 관례).
  - 토큰은 유효하나 `usage:write` 스코프 없음: `403 { "error": { "code": "FORBIDDEN_SCOPE", "message": "device token does not have usage:write scope" } }`

---

## 3. `POST /api/usage/daily-aggregate`

디바이스(=인증된 Bearer 토큰)의 특정 날짜 총량을 upsert한다.

### 요청

```
POST /api/usage/daily-aggregate
Authorization: Bearer <device token>
Content-Type: application/json
```

```json
{
  "date": "2026-08-19",
  "timezoneOffsetMinutes": 540,
  "sessionCount": 6,
  "turnCount": 84,
  "apiCallCount": 231,
  "tokens": { "input": 512340, "output": 88210, "cacheCreation": 41200, "cacheRead": 1980430 },
  "mainTokens": { "input": 401200, "output": 71000, "cacheCreation": 30000, "cacheRead": 1600000 },
  "sidechainTokens": { "input": 111140, "output": 17210, "cacheCreation": 11200, "cacheRead": 380430 },
  "collectedAt": "2026-08-19T18:00:04+09:00",
  "agentVersion": "1.6.1",
  "scriptVersion": "1.0.0"
}
```

### 검증 규칙

| 필드 | 규칙 |
|---|---|
| `date` | 필수. `YYYY-MM-DD` 정규식(`^\d{4}-\d{2}-\d{2}$`). 미래 날짜(서버 UTC 오늘+1 초과)는 거부(클라이언트 시계 오류 방어) |
| `timezoneOffsetMinutes` | 필수. 정수, `-720`~`840` 범위(UTC-12~UTC+14) |
| `sessionCount`/`turnCount`/`apiCallCount` | 필수. 0 이상 정수 |
| `tokens`/`mainTokens`/`sidechainTokens` | 필수. 각각 `{input,output,cacheCreation,cacheRead}` 4필드 모두 존재, 0 이상 정수. `mainTokens`+`sidechainTokens`의 각 필드 합이 `tokens`의 해당 필드와 정확히 일치해야 함(불일치 시 `400 INVALID_TOKEN_BREAKDOWN`) |
| `collectedAt` | 필수. ISO 8601. 서버 수신 시각과 24시간 이상 차이나면 `400`으로 거부하지 않고 저장은 하되 경고 로그만 남김(시계 오차는 흔하므로 거부 사유로 삼지 않음 — 수집 설계 문서 §6과 일관되게 클라이언트를 최대한 관용) |
| `agentVersion`/`scriptVersion` | 선택. 없으면 `null` 저장 |

### 응답 — 성공 (200)

```json
{
  "ok": true,
  "date": "2026-08-19",
  "deviceId": "dvc_01j...",
  "upserted": true
}
```

### 에러 응답

| 상황 | 상태 | 바디 |
|---|---|---|
| 스키마 검증 실패 | 400 | `{ "error": { "code": "VALIDATION_ERROR", "message": "<필드별 사유>" } }` |
| 인증 실패 | 401 | §2 참고 |
| 스코프 없음 | 403 | §2 참고 |
| 레이트리밋 초과 | 429 | §7 |
| 서버 오류 | 500 | `{ "error": { "code": "INTERNAL_ERROR", "message": "unexpected error" } }` |

### 권한 규칙

이 엔드포인트는 **쓰기 전용**이다(같은 디바이스가 자기 자신의 날짜 데이터를 upsert). 다른 디바이스의 데이터를 대신 쓸 방법이 없다 — `deviceId`는 요청 바디가 아니라 인증된 Bearer 토큰에서 서버가 derive한다(요청 바디에 `deviceId` 필드를 받지 않는다 — 클라이언트가 다른 디바이스 ID를 사칭해 보낼 수 있는 경로를 원천 차단).

### Upsert 시맨틱

- Upsert 키: `(device_id, date)` — 동일 디바이스가 같은 날짜를 다시 보내면 **덮어쓴다**(마지막으로 받은 값이 최종값). 수집 설계 문서 §2.3의 "그날 전체 재집계 후 upsert" 설계와 정합 — 클라이언트는 재시도 시 항상 그날 전체를 다시 계산해서 보내므로, 서버는 항상 최신 요청을 신뢰하면 된다(멱등).
- 동일 요청이 정확히 같은 값으로 중복 도착해도(네트워크 재시도 등) 결과는 동일 — 별도 dedup 키(예: idempotency-key 헤더) 불필요. 값 자체가 항상 "그 날짜의 최종 스냅샷"이라는 시맨틱이 멱등성을 구조적으로 보장한다.

---

## 4. `POST /api/usage/detail`

디바이스의 특정 날짜 상세 분해(프로젝트별/도구별/서브에이전트별/세션별)를 upsert한다.

### 요청

```
POST /api/usage/detail
Authorization: Bearer <device token>
Content-Type: application/json
```

```json
{
  "date": "2026-08-19",
  "timezoneOffsetMinutes": 540,
  "byProject": [
    { "projectKey": "8f2a91c4b7d3e001", "projectLabel": "claude-plugins", "sessionCount": 4, "turnCount": 60, "apiCallCount": 150, "tokens": { "input": 300000, "output": 50000, "cacheCreation": 20000, "cacheRead": 1200000 } }
  ],
  "byTool": [
    { "tool": "Read", "callCount": 120, "tokens": { "input": 45000, "output": 0, "cacheCreation": 0, "cacheRead": 300000 } }
  ],
  "bySubagent": [
    { "label": "architect", "delegationCount": 3, "tokens": { "input": 9000, "output": 3000, "cacheCreation": 300, "cacheRead": 6000 } }
  ],
  "bySession": [
    {
      "sessionKey": "3c9e7a1b0f2d4568",
      "projectKey": "8f2a91c4b7d3e001",
      "startedAt": "2026-08-19T09:02:11+09:00",
      "endedAt": "2026-08-19T11:47:33+09:00",
      "turnCount": 22,
      "apiCallCount": 68,
      "tokens": { "input": 90000, "output": 15000, "cacheCreation": 6000, "cacheRead": 400000 },
      "mainTokens": { "input": 70000, "output": 12000, "cacheCreation": 4000, "cacheRead": 300000 },
      "sidechainTokens": { "input": 20000, "output": 3000, "cacheCreation": 2000, "cacheRead": 100000 }
    }
  ],
  "collectedAt": "2026-08-19T18:00:05+09:00"
}
```

### 검증 규칙

| 필드 | 규칙 |
|---|---|
| `date`/`timezoneOffsetMinutes`/`collectedAt` | §3과 동일 |
| `byProject[].projectKey` | 필수, `^[0-9a-f]{16}$`(16자 hex — 수집 설계 문서 §1.3의 SHA-256 앞 16자) |
| `byProject[].projectLabel` | 필수, 문자열, 길이 1~100자. **경로 구분자(`/`, `\`) 포함 시 거부**(`400 INVALID_PROJECT_LABEL`) — basename이어야 하며 실수로 전체 경로가 들어오는 것을 서버 측에서도 방어(클라이언트 버그에 대한 심층 방어, §6과 같은 정신) |
| `byTool[].tool` | 필수, 문자열, 길이 1~100자 |
| `bySubagent[].label` | 필수, 문자열, 길이 1~100자 |
| `bySession[].sessionKey` | 필수, `^[0-9a-f]{16}$` |
| `bySession[].startedAt`/`endedAt` | 필수, ISO 8601, `endedAt >= startedAt` |
| 각 배열의 `count`류 필드 | 0 이상 정수 |
| `tokens` 계열 | §3과 동일(4필드 모두 0 이상 정수) |
| 배열 크기 상한 | `byProject`/`byTool`/`bySubagent`/`bySession` 각 최대 500개 원소. 초과 시 `400 PAYLOAD_TOO_LARGE_ARRAY`(비정상적으로 큰 배열은 버그나 남용 신호로 간주) |
| 전체 바디 크기 | 1MB 초과 시 `413 { "error": { "code": "PAYLOAD_TOO_LARGE", "message": "request body exceeds 1MB" } }` |

### 응답 — 성공 (200)

```json
{ "ok": true, "date": "2026-08-19", "deviceId": "dvc_01j...", "upserted": true }
```

### 에러 응답

§3과 동일한 에러 코드 체계(`VALIDATION_ERROR`/`UNAUTHORIZED`/`FORBIDDEN_SCOPE`/`PAYLOAD_TOO_LARGE`(+`_ARRAY`)/`RATE_LIMITED`/`INTERNAL_ERROR`).

### 권한 규칙

- 쓰기: §3과 동일(자기 디바이스만, Bearer에서 derive).
- **읽기(향후 API, 이번 스펙 범위 밖이지만 제약은 지금 명시)**: `bySession`을 포함한 상세를 조회하는 GET API는 이번 스펙에서 설계하지 않는다(요구사항에 없음, 스코프 확대 방지). 다만 **향후 그 API를 설계할 때 반드시 지켜야 할 제약**을 여기 못박는다 — 수집 설계 문서 §7의 근거를 그대로 계승:
  - 기본값: 요청자의 JWT `user_id`가 소유한 디바이스의 데이터만 조회 가능(본인 것만).
  - 관리자가 타인의 `bySession` 상세를 조회하는 것은 예외 동작으로 취급하고, 기존 `audit_logs.action` enum의 `admin.cross_user_view`(OAuth 설계 문서 §3.4에 이미 존재)를 그대로 재사용해 감사 로그를 남겨야 한다 — 이 액션을 위한 새 enum 값을 추가할 필요는 없다.
  - `daily-aggregate`와 `byProject`/`byTool`/`bySubagent`(세션 단위가 아닌 집계)는 조직 차원 대시보드(예: 전사 도구별 사용량 랭킹) 용도로 상대적으로 넓게 조회를 허용해도 된다 — 다만 이 경우도 개인별로 분해해서 보여줄지, 조직 전체로 합산해서만 보여줄지는 이 스펙이 결정하지 않는다(후속 설계 필요).

---

## 5. 공통 에러 응답 형식

모든 엔드포인트가 동일한 봉투를 쓴다(기존 `/mcp` 401 응답과 동일 관례 — `server/index.js` 기존 코드 참고):

```json
{ "error": { "code": "<SCREAMING_SNAKE_CASE>", "message": "<사람이 읽을 수 있는 설명, 영어/한글 무관>" } }
```

| code | HTTP 상태 | 의미 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 요청 바디 필드 검증 실패 |
| `INVALID_TOKEN_BREAKDOWN` | 400 | `mainTokens`+`sidechainTokens` ≠ `tokens` |
| `INVALID_PROJECT_LABEL` | 400 | `projectLabel`에 경로 구분자 포함 |
| `PAYLOAD_TOO_LARGE_ARRAY` | 400 | 배열 원소 500개 초과 |
| `UNAUTHORIZED` | 401 | Bearer 토큰 무효/만료/미제공 |
| `FORBIDDEN_SCOPE` | 403 | 토큰은 유효하나 `usage:write` 스코프 없음 |
| `PAYLOAD_TOO_LARGE` | 413 | 바디 1MB 초과 |
| `RATE_LIMITED` | 429 | §7 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

---

## 6. Upsert 시맨틱 (재확인)

- 두 엔드포인트 모두 `(device_id, date)`가 자연키다. 같은 디바이스·같은 날짜로 재전송하면 **전체 덮어쓰기**(부분 병합 아님) — 클라이언트가 항상 그날 전체를 재계산해서 보내는 설계(수집 설계 문서 §2.3)이므로, 부분 병합 로직은 오히려 오래된 부분값과 새 부분값이 섞이는 버그를 유발할 수 있어 채택하지 않는다.
- 최초 삽입인지 갱신인지는 클라이언트가 알 필요 없다 — 응답의 `upserted: true`는 항상 고정값(구분 정보 불필요, 클라이언트가 이 값으로 분기하지 않음).
- `daily-aggregate`와 `detail`은 각각 독립적으로 upsert된다 — 한쪽만 먼저 성공하고 다른 쪽이 실패해도 문제없다(수집 설계 문서 §2.2의 "날짜별 순차 커밋"과 정합: 다음 실행이 그 날짜를 다시 통째로 재전송하면 두 엔드포인트 모두 최신 상태로 수렴한다).

---

## 7. 레이트리밋

- **기준**: 디바이스(Bearer 토큰) 단위, 분당 최대 20회 요청(두 엔드포인트 합산). 정상 동작(1시간에 daily-aggregate+detail 각 1회, catch-up 시 최대 30일치 = 60회를 몇 분에 나눠 보냄)을 여유 있게 커버하면서 오작동(예: 락 파일 버그로 무한 루프 도는 스크립트)을 막는 값.
- **catch-up 대량 전송 고려**: 수집 설계 문서 §2.3의 catch-up window(최대 30일)로 인해 한 회차에서 최대 60건(30일 × 2엔드포인트) 요청이 몰릴 수 있다 — 분당 20회 제한이면 이 60건은 약 3분에 걸쳐 분산돼야 한다. 클라이언트(`report-usage.mjs`)는 날짜별 순차 처리이므로 자연히 시간이 걸리지만, **서버가 429를 반환하면 클라이언트는 수집 설계 문서 §6대로 `Retry-After`를 존중**해야 한다 — 이 문서와 클라이언트 설계 문서가 서로 어긋나지 않게 정합성을 맞췄다.
- **응답 헤더**: `429` 응답에 `Retry-After`(초 단위 정수) 헤더 포함 필수.
- **초과 시 응답**: `429 { "error": { "code": "RATE_LIMITED", "message": "too many requests, retry after N seconds" } }`

---

## 8. 라우팅/미들웨어 배선 요구사항 (실측 확정, Round 2 리뷰)

**이 절은 OAuth 설계 문서 Round 1 리뷰에서 발견된 Critical 결함(신규 엔드포인트가 `wrangler.jsonc`/미들웨어 배선 누락으로 실제로는 도달 불가능했던 사고)과 동일한 실수를 반복하지 않기 위해 명시한다. Round 2 리뷰에서 malgnai-public 코드를 실측해 아래와 같이 확정했다 — "구현 시점에 결정"이 아니라 지금 확정한다.**

1. **문제 확인**: `/api/usage/daily-aggregate`, `/api/usage/detail`은 device Bearer 인증(§2)이어야 하며 JWT 웹 세션 인증 대상이 아니다. 그런데 malgnai-public은 `server/index.js:20-21`에서 `webApp.use('/api/*', jwtAuthMiddleware)`를 전역 부착하고 있어, 이 두 경로도 그대로 두면 device Bearer 요청이 이 미들웨어에 걸려 도달하지 못한다. 또한 `server/middleware/jwt-auth.js`의 `PUBLIC_PATHS`는 접두사 패턴이 아니라 **정확 문자열 `Set`**이라, `/api/usage/daily-aggregate`·`/api/usage/detail`을 단순히 그 목록에 추가하는 것만으로는 인증 자체가 사라질 뿐(무인증) device Bearer 검증이 걸리지 않는다 — 무인증이 아니라 "다른 방식의 인증"이 필요하다.
2. **옵션 비교와 권고**:

   | | (a) `PUBLIC_PATHS`에 추가 + 라우터 자체 인증(**권고**) | (b) webApp(Hono) 밖으로 완전 분리 |
   |---|---|---|
   | 내용 | `/api/usage/daily-aggregate`, `/api/usage/detail`을 `PUBLIC_PATHS`(정확 문자열 `Set`)에 추가해 전역 `jwtAuthMiddleware`를 우회시키고, 대신 해당 라우터 핸들러(또는 이 두 경로 전용 미들웨어)에서 `mcp/device-auth.js`의 `deviceAuthMiddleware` 로직(Bearer 해시 검증)을 재사용해 자체 인증 + `usage:write` 스코프 체크(§2)를 수행한다 | `/mcp`처럼 `server/index.js`의 최상위 분기(`server/index.js:66-84`, `/mcp*`를 webApp 밖에서 별도 처리하는 지점)에서 `/api/usage/*`도 완전히 갈라내 독립 핸들러로 처리한다 |
   | 선택 이유 | **기존 선례가 있다** — `/api/oauth/token`이 이미 정확히 이 패턴(`PUBLIC_PATHS` 우회 + 라우트 자체 인증 로직)을 쓰고 있다. 새 구조를 만들지 않고 검증된 관례를 그대로 확장하는 것이라 리스크가 낮고, `/api/*` 라우터가 제공하는 공통 미들웨어(로깅, CORS 등)는 그대로 유지되는 이점도 있다 | `/mcp`가 이미 이 패턴이라는 점에서 선례는 있으나, `/api/usage/*`는 REST 스타일 JSON 엔드포인트(§3·§4)라 `/mcp`의 JSON-RPC 처리 구조와 성격이 달라 그대로 옮기면 오히려 `/api/*` 공통 처리(에러 포맷 등)를 별도로 재구현해야 할 가능성 |
   | 포기한 것 | `PUBLIC_PATHS`라는 이름이 "인증 없음"을 뜻하는 목록에 "실은 다른 인증이 걸려있는" 경로를 추가하는 것이라 코드를 처음 보는 사람에게는 혼동 소지(`/api/oauth/token`도 이미 같은 혼동을 안고 있으므로 신규 리스크는 아님) | `/api/*` 라우터의 기존 공통 처리와 분리되어 유지보수 지점이 하나 더 늘어남 |
   | 감당 방안 | `PUBLIC_PATHS` 정의부 주석에 "이름과 달리 자체 인증이 걸린 경로 포함(`/api/oauth/token`, `/api/usage/*` 참고)"을 명시해 혼동을 문서로 방어 | 이번 스펙에서는 채택하지 않으므로 해당 없음 |

   **권고안: (a).** Reviewer도 기존 `/api/oauth/token` 선례가 있는 (a)를 더 유력하게 봤다.
3. **wrangler 배선 — 확인 완료, 추가 조치 불필요**: `wrangler.jsonc:41`의 `assets.run_worker_first`는 이미 `["/api/*", "/mcp*", "/.well-known/oauth-*"]`로 설정돼 있다. `/api/usage/*`는 `/api/*` 패턴에 이미 포함되므로 Worker에 도달하는 데 wrangler 설정 변경이 필요 없다 — 배선 문제는 전적으로 §8-1의 `jwtAuthMiddleware`/`PUBLIC_PATHS` 쪽에 있으며, 그 해법은 §8-2에서 확정했다.

---

## 9. 기존 `pair-init`/`pair-approve` 확장 요구사항

수집 설계 문서 §3.3이 요구하는 것 — 이 세션이 malgnai-public 코드를 직접 수정하지 않으므로 요구사항만 명시한다:

1. `POST /api/devices/pair-init` 요청 바디에 선택적 `purpose` 필드 추가 지원(예: `"usage_report"`, 없으면 기존 기본값 `"mcp"`로 간주해 하위호환 유지).
2. `purpose="usage_report"`로 시작된 페어링이 `pair-approve`로 승인될 때, 생성되는 `device_tokens` 행의 `scopes`를 콤마구분 평문 문자열 `"usage:write"`로 채운다(§2 정정 사항과 동일 포맷 — JSON 배열 아님). 기존 MCP 페어링은 계속 현재 DB DEFAULT 관례값(`project.read,project.write,telemetry.write`) 유지.
3. 웹 `/keys` 화면(기기 목록)에서 `purpose`/`scopes`에 따라 "MCP 연결" vs "사용량 리포터"로 용도를 구분 표시 — 사용자가 폐기(`DELETE /api/devices/:id`, 기존 엔드포인트 그대로 재사용) 대상을 헷갈리지 않게 한다.
4. 승인 화면(pair-approve 웹 UI)에 `purpose="usage_report"`인 경우 "이 PC가 malgnai-hub에 토큰 사용량 집계 수치를 주기적으로 전송하도록 승인합니다"같은 설명 문구를 노출해, MCP 연결 승인과 시각적으로 구분되게 한다(사용자가 무엇을 승인하는지 명확히 인지하도록 — 컨센트 화면 정확성은 OAuth 설계 문서 §6이 이미 다룬 것과 같은 원칙).

---

## 10. 스키마 마이그레이션 제안

**번호(실측, Round 2 리뷰)**: 이 세션 시점 `malgnai-public/migrations/` 최신 파일은 `0010_projects_own_repository_key.sql`이므로 다음 번호는 `0011`로 확정 가능하다. 다만 이 설계 승인부터 malgnai-public 구현 착수까지 시차가 있을 수 있고 그 사이 다른 마이그레이션이 먼저 추가될 수 있으므로, **착수 시점에 `migrations/` 디렉터리를 다시 확인해 실제 다음 번호로 재확정할 것** — 아래 파일명의 `0011`은 이 문서 작성 시점 기준 확정값이지 영구 고정값이 아니다.

```sql
-- migrations/0011_usage_reports.sql (번호는 착수 시점 재확인 후 확정)

-- 일별 총량 — (device_id, date) 자연키, 타입 있는 컬럼으로 저장해 향후 조직 집계 SQL 쿼리를 쉽게 한다.
CREATE TABLE usage_daily_aggregates (
  id TEXT PRIMARY KEY,                    -- ULID, 기존 관례(device_tokens 등)와 일관
  device_id TEXT NOT NULL,                -- device_tokens.id 참조 (FK는 D1 제약상 강제 안 될 수 있음 — 관례 확인 필요)
  user_id TEXT NOT NULL,                  -- device_tokens.user_id를 upsert 시점에 함께 저장(조인 없이 authz 판단 가능하게, §4 권한규칙)
  date TEXT NOT NULL,                     -- YYYY-MM-DD
  timezone_offset_minutes INTEGER NOT NULL,
  session_count INTEGER NOT NULL,
  turn_count INTEGER NOT NULL,
  api_call_count INTEGER NOT NULL,
  tokens_input INTEGER NOT NULL,
  tokens_output INTEGER NOT NULL,
  tokens_cache_creation INTEGER NOT NULL,
  tokens_cache_read INTEGER NOT NULL,
  main_tokens_input INTEGER NOT NULL,
  main_tokens_output INTEGER NOT NULL,
  main_tokens_cache_creation INTEGER NOT NULL,
  main_tokens_cache_read INTEGER NOT NULL,
  sidechain_tokens_input INTEGER NOT NULL,
  sidechain_tokens_output INTEGER NOT NULL,
  sidechain_tokens_cache_creation INTEGER NOT NULL,
  sidechain_tokens_cache_read INTEGER NOT NULL,
  agent_version TEXT,
  script_version TEXT,
  collected_at TEXT NOT NULL,             -- 클라이언트 생성 시각(참고용)
  updated_at TEXT NOT NULL,               -- 서버 upsert 시각(진짜 최신성 판단은 이 컬럼 기준)
  UNIQUE(device_id, date)                 -- upsert 자연키(§6) — INSERT ... ON CONFLICT(device_id, date) DO UPDATE 로 구현
);
CREATE INDEX idx_usage_daily_device_date ON usage_daily_aggregates(device_id, date DESC);  -- 특정 디바이스의 최근 추이 조회
CREATE INDEX idx_usage_daily_user_date ON usage_daily_aggregates(user_id, date DESC);      -- "내 전체 디바이스 합산" 조회(멀티 PC 사용자)
CREATE INDEX idx_usage_daily_date ON usage_daily_aggregates(date);                          -- 조직 전체 일별 집계(관리자 대시보드) — 날짜 단독 GROUP BY

-- 상세 — byProject/byTool/bySubagent/bySession 4개 배열을 정규화하지 않고 JSON 컬럼으로 저장한다.
-- 근거: 이미 클라이언트가 사전 집계해서 보내는 데이터라 서버 측 추가 SQL 집계 요구가 낮고(수집 설계 문서 §1),
-- 기존 audit_logs.metadata_json과 동일한 관례(정규화 대신 JSON 블롭)를 재사용해 신규 테이블 4개를 만들지 않는다.
-- 향후 "전사 도구별 랭킹"처럼 서버측 SQL 집계가 실제로 필요해지면 그 시점에 byTool만 별도 정규화 테이블로 분리하는
-- 재검토를 하되, 지금은 확인되지 않은 요구에 미리 대비하지 않는다(과설계 방지, 수집 설계 문서 §2.3과 동일 원칙).
CREATE TABLE usage_daily_details (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date TEXT NOT NULL,
  timezone_offset_minutes INTEGER NOT NULL,
  by_project_json TEXT NOT NULL,          -- ProjectDetail[] (수집 설계 문서 §1.2)
  by_tool_json TEXT NOT NULL,             -- ToolDetail[]
  by_subagent_json TEXT NOT NULL,         -- SubagentDetail[]
  by_session_json TEXT NOT NULL,          -- SessionDetail[] — §4 권한규칙상 가장 민감한 컬럼, 조회 API 설계 시 이 컬럼만 별도 authz 필요
  collected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(device_id, date)
);
CREATE INDEX idx_usage_detail_device_date ON usage_daily_details(device_id, date DESC);
CREATE INDEX idx_usage_detail_user_date ON usage_daily_details(user_id, date DESC);

-- device_tokens.scopes 활용 — 신규 컬럼 불필요(기존 컬럼 재사용, §2/§9).
-- 신규 audit_logs.action 불필요 — 기존 admin.cross_user_view(OAuth 설계 문서 §3.4)를 향후 조회 API에서 재사용.
```

**FK 제약에 대한 확인 필요**: 위 SQL은 `device_id`/`user_id`에 명시적 `REFERENCES` 절을 넣지 않았다 — OAuth 설계 문서가 실측한 기존 `device_tokens` 테이블도 "FK 없음, ULID PK" 관례였다(§0 인용: "`device_tokens`(... FK 없음, ULID PK)"). 이 저장소의 기존 관례를 따라 FK를 생략했으나, malgnai-public 구현 시점에 이 관례가 바뀌었을 수 있으니 확인할 것.

**참고 각주(실측, Round 2 리뷰)**: `device_tokens.scopes`의 기존 DEFAULT(`'project.read,project.write,telemetry.write'`)에는 이미 `telemetry.write`라는 스코프 문자열이 존재한다 — 그런데 코드베이스 grep 결과 이 값을 실제로 체크하는 코드는 0건이다(사실상 미사용 명칭). 이 스펙은 신규 명칭 `usage:write`를 채택했지만, malgnai-public 구현 시 기존 `telemetry.write`를 재사용할지(명칭 일관성) 아니면 `usage:write`로 새로 도입할지(의미가 더 명확)는 짧게 검토해볼 만하다 — 강제 사항은 아니며, 이 스펙의 나머지 계약(엔드포인트/요청/응답)에는 영향 없다.

---

## 11. 이번 스펙 범위 밖(향후 별도 설계 필요)

- **읽기(GET/조회) API**: 개인 대시보드, 관리자 전사 집계 화면 등은 이번 라운드 요구사항에 없어 설계하지 않았다. 다만 §4 권한 규칙에 이 미래 API가 지켜야 할 authz 제약(본인 우선, 관리자 cross-user는 `admin.cross_user_view` 감사로그 필수)을 못박아 뒀다 — 나중에 이 API를 설계하는 사람이 이 제약을 무시하고 설계하지 않도록.
- **`/keys` 화면의 "사용량 리포터" 표시 UI**: §9-3에서 요구사항만 명시, 실제 화면 설계(`app/pages/keys.vue` 변경)는 이 문서가 다루지 않는다.
- **레이트리밋의 실제 구현 메커니즘**(Cloudflare Workers KV 기반 카운터인지, Durable Object인지 등)은 malgnai-public의 기존 인프라 관례를 따르도록 위임한다 — 이 문서는 정책(§7의 임계치)만 정의한다.
