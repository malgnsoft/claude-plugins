---
name: domain-backend-api-implementation-patterns
description: 'Hono 라우트/D1 쿼리/에러 처리/JWT·RBAC/N+1 방지/페이징 등 기본 구현 패턴 + Route→Service→DAO 계층 분리, DAO 도입 판단 기준, 인증 게이트·역할 가드·응답봉투 일원화 등 실서비스 코드에서 역추출한 검증 패턴. backend-dev/qa-engineer가 Hono API를 구현·검토할 때 사용한다. 보안 요구사항 체크리스트 자체는 Skill `domain-backend-api-security`를 별도 참조 — 이 스킬은 그 요구사항을 코드로 옮기는 방법을 다룬다.'
---

# 백엔드 API 구현 패턴

**이 파일은 색인이자 본문이다.** 매 라우트 구현에 걸리는 것(Hono 기본 패턴·에러 처리·인증/인가·성능 최적화·프레임워크 레벨 우수 패턴 A~F)은 여기 그대로 있다. 프로젝트당 한 번만 하는 판단인 **계층 구조·DAO 분기**는 아래 "계층 구조 선택" 절이 가리키는 같은 디렉터리의 파일에 있으니, 그 판단을 할 때만 Read한다.

## Hono 프레임워크 패턴

### 기본 라우트 구조
```javascript
import { Hono } from 'hono'

const app = new Hono()

// 미들웨어
app.use('*', async (c, next) => {
  // 공통 처리
  await next()
})

// CRUD 라우트
app.get('/api/items', async (c) => {
  const { page = 1, limit = 20 } = c.req.query()
  // 목록 조회
})

app.get('/api/items/:id', async (c) => {
  const { id } = c.req.param()
  // 상세 조회
})

app.post('/api/items', async (c) => {
  const body = await c.req.json()
  // 생성
  return c.json(result, 201)
})

app.put('/api/items/:id', async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json()
  // 수정
})

app.delete('/api/items/:id', async (c) => {
  const { id } = c.req.param()
  // 삭제
  return c.body(null, 204)
})
```

### D1 (Cloudflare SQLite) 패턴
```javascript
// 쿼리 실행
const { results } = await c.env.DB.prepare(
  'SELECT * FROM items WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
).bind(status, limit, offset).all()

// 삽입
const result = await c.env.DB.prepare(
  'INSERT INTO items (id, name, status) VALUES (?, ?, ?)'
).bind(id, name, status).run()

// 트랜잭션 (D1 batch)
await c.env.DB.batch([
  c.env.DB.prepare('UPDATE items SET status = ? WHERE id = ?').bind('done', id),
  c.env.DB.prepare('INSERT INTO logs (action, item_id) VALUES (?, ?)').bind('complete', id),
])
```

## 에러 처리 패턴

### 일관된 에러 응답
```javascript
// 에러 헬퍼
function errorResponse(c, status, code, message) {
  return c.json({ error: { code, message } }, status)
}

// 사용
app.get('/api/items/:id', async (c) => {
  const item = await getItem(c.env.DB, id)
  if (!item) return errorResponse(c, 404, 'NOT_FOUND', '항목을 찾을 수 없습니다')
  return c.json({ data: item })
})

// 전역 에러 핸들러
app.onError((err, c) => {
  console.error(err)
  return errorResponse(c, 500, 'INTERNAL_ERROR', '서버 오류가 발생했습니다')
})
```

## 인증/인가 패턴

### JWT 인증
```javascript
import { jwt } from 'hono/jwt'

// JWT 미들웨어
app.use('/api/*', jwt({ secret: 'your-secret' }))

// 페이로드 접근
app.get('/api/me', (c) => {
  const payload = c.get('jwtPayload')
  return c.json({ user: payload })
})
```

### RBAC (Role-Based Access Control)
```javascript
function requireRole(...roles) {
  return async (c, next) => {
    const payload = c.get('jwtPayload')
    if (!roles.includes(payload.role)) {
      return errorResponse(c, 403, 'FORBIDDEN', '권한이 없습니다')
    }
    await next()
  }
}

app.delete('/api/users/:id', requireRole('admin'), async (c) => {
  // 관리자만 접근 가능
})
```

## 성능 최적화

### N+1 쿼리 방지
```javascript
// BAD: N+1
for (const user of users) {
  user.posts = await db.prepare('SELECT * FROM posts WHERE user_id = ?').bind(user.id).all()
}

// GOOD: JOIN 또는 IN
const posts = await db.prepare(
  `SELECT * FROM posts WHERE user_id IN (${users.map(() => '?').join(',')})`
).bind(...users.map(u => u.id)).all()
```

### 페이징
```javascript
// Offset 기반 (간단, 대량 데이터에서 느림)
const offset = (page - 1) * limit
const items = await db.prepare('SELECT * FROM items LIMIT ? OFFSET ?').bind(limit, offset).all()

// 커서 기반 (대량 데이터에 적합)
const items = await db.prepare(
  'SELECT * FROM items WHERE id > ? ORDER BY id LIMIT ?'
).bind(cursor, limit).all()
```

## 프레임워크 레벨 우수 패턴 A~F (실서비스 검증, DAO/Service 무관)

출처: 멀티테넌시 실서비스 Hono 코드. 계층 선택과 무관하게 **모든 Hono 프로젝트에 적용할 수 있는 검증된 패턴**이다 — 아래 "계층 구조 선택"에서 ①형을 고르든 ②형을 고르든 그대로 적용한다.

**A. 공개 경로 화이트리스트 + 전역 인증 게이트 (`index.js`).** 라우트마다 인증 미들웨어를 붙이는 대신, `app.use('*')`에서 `PUBLIC_PATHS`(`/health`, `/docs`, `/auth` 등)만 통과시키고 나머지 전체에 `authMiddleware`를 강제한다. "인증 깜빡 누락"을 구조적으로 차단 — 새 라우트는 별도 조치 없이 기본 보호된다.

```javascript
const PUBLIC_PATHS = ['/health', '/docs', '/openapi.json', '/auth'];
app.use('*', async (c, next) => {
  if (PUBLIC_PATHS.some(p => c.req.path.startsWith(p))) return await next();
  return await authMiddleware(c, next);   // 기본값 = 보호. 열려면 명시적으로 화이트리스트.
});
```

**B. 역할 가드 미들웨어 팩토리 (`middleware/auth.js`).** 인증(authMiddleware)이 JWT를 풀어 `c.set('userRoles', ...)`로 컨텍스트에 심고, 인가는 `requireRole(checkFn, msg)` 팩토리로 선언적으로 라우트에 붙인다. 라우트 본문에서 권한을 if문으로 흩뿌리지 않는다.

```javascript
export const requireRole = (checkFn, message = '권한이 없습니다') => async (c, next) => {
  if (!checkFn(c.get('userRoles') || [])) {
    const e = new Error(message); e.name = 'ForbiddenError'; throw e;
  }
  await next();
};
export const requireExecutive = requireRole(r => r.some(x => ['EXECUTIVE','CEO'].includes(x)), '임원 권한이 필요합니다');
// 라우트: goals.post('/company', requireExecutive, async (c) => { ... })  ← 선언적 인가
```

**C. 검증 헬퍼를 라우트 상단에 모아 입력 검증을 라우트에서 끝낸다 (`routes/goals.js`).** `validateRequired/validateString/validateDate/validateNumber/validateId`를 파일 상단에 두고, 핸들러는 이를 호출만 한다. **검증은 라우트(경계)에서, 비즈니스 규칙은 service에서** — 깨질 입력을 제일 바깥에서 친다. 검증 실패는 `validationError(msg)` 헬퍼로 `ValidationError`를 throw → 전역 매핑이 400으로.

```javascript
goals.post('/my', async (c) => {
  const body = await c.req.json();
  validateRequired(body.title, 'title');  validateString(body.title, 'title', 200);
  validateRequired(body.dueDate, 'dueDate'); validateDate(body.dueDate, 'dueDate');
  if (body.startDate >= body.dueDate) validationError('dueDate는 startDate 이후여야 합니다');
  if (!Number.isInteger(body.weight) || body.weight < 0 || body.weight > 100)
    validationError('weight는 0~100 사이의 정수여야 합니다');
  // ... 검증 통과한 body만 service로
});
```

**D. 응답/에러/throw 규약 일원화 (`utils/db.js` + `middleware/errorHandler.js`).**
- **응답 봉투 통일**: 성공은 `c.json({ data })`(목록·단건 공통), 생성은 `, 201`. 프론트가 항상 `res.data`만 읽으면 된다.
- **명명된 에러 throw 헬퍼**: `notFound()/validationError()/forbiddenError()`가 `error.name`을 세팅해 throw. service·route 어디서든 같은 헬퍼 사용 → 단일 `errorHandler`가 `errorMap`으로 상태코드 변환(분산 throw → 일원화).

```javascript
// utils/db.js
export function throwError(name, message) { const e = new Error(message); e.name = name; throw e; }
export function notFound(m='리소스를 찾을 수 없습니다'){ throwError('NotFoundError', m); }
export function validationError(m){ throwError('ValidationError', m); }
// errorHandler.js
const errorMap = { ValidationError:{status:400}, UnauthorizedError:{status:401}, ForbiddenError:{status:403}, NotFoundError:{status:404} };
```

**E. pg/Hyperdrive 운영 함정 — BIGSERIAL은 문자열로 온다, snake↔camel 경계 변환 (`utils/db.js`).** 실서비스에서 검증된 두 함정:
- **`toCamelCase()`가 `id`/`_id` 컬럼을 `Number()`로 강제 변환**한다. pg 드라이버는 BIGSERIAL/BIGINT를 *문자열*로 반환하므로(`"123" === 123` → false), 이 변환을 빼면 프론트 비교·키 매칭이 조용히 깨진다. DB 행을 API로 내보낼 때는 항상 `toCamelCase/toCamelCaseArray`를 거치거나 `Number()`로 감싼다.
- **DB는 snake_case, API는 camelCase** — 경계에서만 변환하고 내부는 각자 규약 유지.
- **⚠️ `Number()` 변환은 BIGINT인 id/`*_id`에만 — 컬럼명이 아니라 실제 DB 타입으로 판단.** 문자열로 오는 건 BIGINT(int8)뿐이고 INTEGER/SMALLINT는 이미 숫자다. 수동 row 매핑에서 `Number()`를 씌우기 전 컬럼의 실제 타입을 확인하라(`information_schema.columns` 또는 값 샘플). `id`/`_id`/`_by`로 끝나도 varchar일 수 있다(텍스트 PK·자유 태그·자유 텍스트). varchar/text에 `Number()`를 씌우면 NaN이 조용히 흘러간다 — 가능하면 수동 매핑 대신 `toCamelCase()`가 안전. **수정 후 실제 API 실호출로 NaN 부재를 확인**할 것(라우트 테스트가 그 필드를 단언 안 하면 게이트는 NaN을 못 잡는다).

**F. 멀티테넌시 필수 규약 (실서비스 금지 패턴).**
- **IDOR 방지**: 모든 조회/수정/삭제 WHERE에 `site_id`(테넌트 키)를 **반드시** 포함. `WHERE id=$1`만 쓰면 다른 테넌트 데이터 접근 가능 → `WHERE id=$1 AND site_id=$2`.
- **SQL 인젝션 금지**: 문자열 연결(`` `...${name}...` ``)로 쿼리 구성 절대 금지, 항상 파라미터화(`$1`).
- **상태/타입 코드는 영문**: DB·백·프론트 비교에 쓰는 코드값은 `'inProgress'`/`'completed'` 등 영문 고정, 한글은 화면 표시(`statusLabel()`)에서만.

이 A~F는 backend-dev의 기본 체크리스트로 쓴다 — 새 Hono 라우트/서비스를 만들 때 인증 게이트·역할 가드·입력검증 위치·응답봉투·id 타입·site_id를 빠짐없이 적용했는지 확인.

## 계층 구조 선택 — Route→Service / DAO 분기

**여기서 읽을 것은 "지금 이 판단이 필요한가"뿐이다.** 계층 구조는 프로젝트당 한 번 정하면 그 뒤로는 따라가기만 하므로, 매 라우트 구현에 필요한 내용이 아니다.

- **① Route → Service → DB**: 서비스 클래스가 비즈니스 로직과 SQL을 함께 가진다. 진입점이 HTTP 하나뿐이고 쿼리가 한 곳에서만 쓰이는 작은 앱에 정당하다.
- **② Route → Service → DAO → DB**: SQL을 DAO에만 둔다. 같은 테이블을 여러 진입점(HTTP API + MCP 도구 + 배치/cron)이 공유하면 **DAO 필수**.

**아래 중 하나에 해당하면** `${CLAUDE_PLUGIN_ROOT}/skills/domain-backend-api-implementation-patterns/layering-and-dao.md`를 Read한다:
- 새 프로젝트의 계층 구조를 정할 때(①/② 판단 기준, 진화 서사 — ①형으로 시작해 겪는 4가지 한계)
- 기존 코드에 DAO가 있어 작성 규약·금지 패턴을 확인할 때(`constructor(db)` 주입, 동적 WHERE 조립, DAO 우회 금지)
- 얇은 라우트 + 서비스 분리의 실제 코드 형태(바인딩 주입, `error.name` 전역 매핑, 역할 기반 WHERE 격리, 트랜잭션 경계)가 필요할 때

요약만 보고 판단하지 않는다 — 위 두 줄은 어느 쪽을 열지 고르라고 있는 것이지 판단 근거를 대신하지 않는다.
