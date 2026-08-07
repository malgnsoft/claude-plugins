---
name: domain-serverless-edge-api-security
description: Cloudflare Workers·Hono·D1·MCP 서버리스/엣지 스택 전용 API 보안 점검 절차 — 인증 5대 함정(전역 미들웨어 누락·개별부착 구조적 누락·fail-open·MCP 무인증 노출·IDOR), CORS reflect, 서버리스 DoS(비용 폭증) 벡터, §7 순서형 실행 체크리스트(스키마→미들웨어→Grep→fail-open→mcp/tools.js→bind→cors). backend-dev·security가 이 스택의 API를 구현·점검할 때 사용한다. OWASP 일반론은 domain-security-audit-checklist를 따로 참조 — 이 스킬은 그와 중복 없이 이 스택 특유의 함정만 다룬다.
---

# 서버리스/엣지 API 보안 점검 (Cloudflare Workers · Hono · D1 · MCP)

## 범위 — domain-security-audit-checklist와의 관계 (상호 배제)

이 스킬과 `domain-security-audit-checklist`는 중복 없이 상호 배타적인 범위를 다룬다.
- **OWASP 일반론**(의존성 취약점·SAST·일반 접근제어·암호화·로깅/모니터링 규약 등 스택 불문 공통 체크리스트)은 `domain-security-audit-checklist`를 따른다 — 이 스킬에서는 다루지 않는다.
- **이 스택(Cloudflare Workers·Hono·D1·MCP) 특유의 함정**(인증 5대 함정, CORS reflect, 서버리스 DoS 비용 폭증, MCP 무인증 노출 등)은 이 스킬이 전담한다 — `domain-security-audit-checklist`에는 없는 내용이다.

## 강한 보안 산출물의 조건

추상 항목("입력 검증을 하세요") 나열이 아니라:
- 이 코드의 **파일:라인을 인용**하고, 이 데이터가 왜 민감한지 시스템 맥락으로 설명한다(예: `claude_memories.content`에 CLAUDE.md 평문이 들어간다).
- "취약점이 있다"가 아니라 **악용 경로를 끝까지 추적**한다: 무인증(원인) → CORS reflect(증폭) → 어떤 데이터가 → 누구에게 → `curl` 한 줄로 재현(영향). 단일 결함이 아니라 **결함들의 결합(chain)**을 본다.
- happy path가 아니라 **운영 사고 시나리오**("시크릿을 깜빡 누락하면?", "items 배열을 무한정 보내면?")를 판단 근거로 쓴다.

## 1. 점검 시작 전 — "이 시스템이 다루는 데이터가 무엇인가"부터

심각도 판단의 출발점은 코드가 아니라 **데이터 민감도**다. 인증 누락 자체보다 *무엇이 노출되는가*가 등급을 결정한다.
- DB 스키마(`dao/init.js`)를 먼저 읽어 **민감 컬럼**을 식별한다: 평문 본문(`content`), 사용자 입력 원문(`first_prompt`/`last_prompt`), 비용/사용량, 시크릿성 값.
- "메타데이터 노출"과 "사용자 작업 내용·내부 문서 평문 노출"은 등급이 다르다. 후자는 거의 항상 Critical.

## 2. 인증/인가 — 이 스택의 5대 함정 (★ 가장 자주 터지는 영역)

### 함정 1: 전역 미들웨어 체인에 인증이 빠짐
Hono에서 `app.use('/api/*', cors())`만 걸고 인증 미들웨어를 안 붙이는 패턴이 흔하다. **`index.js`의 `app.use(...)`·`app.all(...)` 라인을 먼저 읽어 무엇이 전역으로 걸려 있나 확인**한다. `cors()`·스키마보장만 있고 `authMiddleware`/`apiKeyMiddleware`가 없으면 → 전 API 무인증(Critical).

### 함정 2: 라우트별 개별 부착 → 누락이 구조적으로 반복됨
미들웨어를 라우터 안에서 `router.post('/', apiKeyMiddleware, ...)`처럼 개별 부착하면, **반드시 일부 라우트에서 빠진다.** `Grep "apiKeyMiddleware|authMiddleware"`로 부착된 곳을 모두 찾고, **모든 비-GET 라우트와 대조**해 누락을 잡는다. 권고는 "빠진 데 붙이세요"가 아니라 **"메서드 기반 전역 정책으로 강제하세요"**(개별 부착은 재발한다).

### 함정 3: fail-open 미들웨어 (가장 교묘함)
```js
if (!expected) { await next(); return }   // 키 미설정 = 인증 통과
```
"키 없으면 통과" 패턴은 **운영에서 시크릿 한 번 누락하면 보안이 조용히 꺼진다.** 보안 컨트롤은 fail-closed여야 한다(키 없으면 통과가 아니라 거부). 미들웨어 본문을 반드시 읽어 이 분기가 있는지 확인 — 있으면 Critical/High.

### 함정 4: MCP 엔드포인트(`/mcp`) 무인증 노출 — 우리 스택 특유 ★★
`/mcp`는 **외부 MCP 클라이언트가 붙을 수 있는 공개 엔드포인트**다. 점검 필수 항목:
- `index.js`에서 `/mcp` 라우트에 인증 미들웨어가 선행하는가? (대개 빠져 있다)
- `mcp/tools.js`(또는 `registerTools`)에 등록된 도구 중 **쓰기 도구**(`*_create`/`*_update`/`*_log`)가 무인증으로 노출되는가? 읽기만이 아니라 **원격 데이터 조작·위조**가 가능해진다.
- stateless 설계(`sessionIdGenerator: undefined`)면 세션 토큰조차 없으므로, 헤더 기반 인증(`X-API-Key` 또는 `Authorization: Bearer`)이 유일한 방어선이다.
- 권고: `/mcp`에 인증 미들웨어 선행 + 무인증 시 쓰기 도구 미등록(읽기/쓰기 도구 분리 등록).

### 함정 5: 소유권(owner/tenant) 부재 → IDOR
스키마에 owner/user_id 컬럼이 없고 쿼리가 `WHERE id = ?`만이면, 인증을 추가해도 **인증 주체 누구나 모든 리소스 접근**. 단일 사용자 전제라도 인증 도입 시 함께 `WHERE owner_id = ?`로 못박을 것을 권고.

## 3. SQL 인젝션 — D1/prepared statement 점검 포인트

D1은 `prepare().bind()` 파라미터화를 제공하므로 **대부분 안전**하다. 그래도 확인할 것:
- 동적 `WHERE` 조립(`activities.js`/`feedbacks.js` 패턴)이 **컬럼명을 고정 문자열로 두고 값만 플레이스홀더**로 쓰는가? (컬럼명을 사용자 입력으로 받으면 위험) → 고정이면 안전, 명시적으로 "양호"로 보고.
- 테이블/컬럼명을 문자열 결합하는 곳이 없는가(`Grep` for backtick 템플릿 + `SELECT`/`INSERT`).
- **결론:** 이 스택에서 진짜 위험은 SQLi가 아니라 인증 부재다. SQLi가 깨끗하면 "양호 사항"으로 명시해 보고서의 신뢰도를 높인다(근거 있는 단정).

## 4. CORS — `cors()` 무인자의 함정

Hono `cors()`를 인자 없이 쓰면 `Access-Control-Allow-Origin`을 요청 Origin으로 reflect(사실상 `*`). **무인증(함정 1)과 결합되면 임의 웹사이트 JS가 피해자 브라우저로 API를 호출해 응답을 읽는다.** 단독으로는 Med지만 무인증과 묶이면 High. 권고: `cors({ origin: [화이트리스트], credentials: true })`.

## 5. 자원 고갈 / DoS 벡터 (서버리스 비용 특유)

서버리스는 요청당 과금이라 **DoS = 비용 폭증**이다.
- sync류 엔드포인트의 `for (item of items) await stmt.run()` 패턴: `items.length` 상한이 없으면 단일 요청이 D1에 무한 쓰기. 상한 검증 + `db.batch()` 권고.
- rate limiting / `Content-Length` 상한 부재. Cloudflare Rate Limiting 또는 Workers 토큰버킷 권고.
- 무인증과 결합 시 등급 상향.

## 6. 시크릿/JWT 점검

- `.dev.vars`·`.env`가 `.gitignore`에 있고 git 추적 안 되는지 확인(`git ls-files`). 평문 약한 값이라도 로컬 전용이면 Med, 운영에 흘러가면 High.
- 직접 구현한 JWT 검증(`crypto.subtle`)은 **헤더 `alg`를 검증하는지** 확인(alg 혼동/`none` 공격 방지). 만료(`exp`)·서명 검증 둘 다 있는지.
- 운영 시크릿은 고엔트로피(32+ bytes 랜덤) + Workers Secret 주입, 로컬/운영 분리.

## 7. 점검 체크리스트 (이 스택 전용, 순서대로)

1. `dao/init.js` 스키마 → 민감 컬럼 식별 (등급 기준 확보)
2. `index.js` 전역 미들웨어 체인 → 인증 유무, `/mcp` 라우트 보호 유무
3. `Grep "Middleware"` → 부착 위치 전수 → 비-GET 라우트와 대조해 누락 잡기
4. `middleware/auth.js` → fail-open 분기 / JWT alg 검증 확인
5. `mcp/tools.js` → 무인증 노출 쓰기 도구 식별
6. 전 DAO → bind 파라미터화 확인(SQLi 양호 근거), 동적 컬럼명 유무
7. `cors()` 설정, sync 루프 상한, rate limit, `.dev.vars` 추적 여부
8. 각 발견을 **원인→증폭→데이터→영향→재현→권고** 체인으로 기술. 단일 결함의 결합 효과를 반드시 평가.
