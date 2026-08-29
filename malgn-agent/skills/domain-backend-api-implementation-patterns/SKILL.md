---
name: domain-backend-api-implementation-patterns
description: 'Hono 라우트/D1 쿼리/에러 처리/JWT·RBAC/N+1 방지/페이징 등 기본 구현 패턴 + Route→Service→DAO 계층 분리, DAO 도입 판단 기준, 인증 게이트·역할 가드·응답봉투 일원화 등 실서비스 코드에서 역추출한 검증 패턴. backend-dev/qa-engineer가 Hono API를 구현·검토할 때 사용한다. 보안 요구사항 체크리스트 자체는 Skill `domain-backend-api-security`를 별도 참조 — 이 스킬은 그 요구사항을 코드로 옮기는 방법을 다룬다.'
---

# 백엔드 API 구현 패턴

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

## Route → Service 계층 분리 (①형)

출처: 실서비스 백엔드 코드에서 역추출한 우수 패턴.

inline 핸들러에 비즈니스 로직을 다 넣는 위 예시(상단 "기본 라우트 구조")는 작은 앱엔 괜찮지만, 규모가 커지면 라우트가 비대해지고 테스트가 어렵다. 이 형태는 **얇은 라우트(입력 정규화·인가) + 클래스 기반 서비스(비즈니스 로직)**로 깔끔히 분리한다.

### 1) 클래스 기반 서비스 + `constructor(env)` 바인딩 주입
서비스는 `env`(바인딩 모음)를 생성자로 받아 보관한다. DB 커넥션은 `env`에서 꺼내 쓰고 `finally`로 반드시 정리한다.

```javascript
// src/services/sessionService.js
import { Client } from 'pg';

export class SessionService {
  constructor(env) { this.env = env; }          // ← 바인딩 주입

  async getClient() {
    const client = new Client(this.env.HYPERDRIVE.connectionString);
    await client.connect();
    return client;
  }

  async createSession(data, coacheeId, companyId) {
    // 1. 입력 검증 — 깨질 곳을 먼저 친다
    if (!['video', 'chat'].includes(data.session_type)) {
      const e = new Error('세션 유형은 video 또는 chat이어야 합니다'); e.name = 'ValidationError'; throw e;
    }
    if (data.duration_minutes < 30 || data.duration_minutes > 90) {
      const e = new Error('세션 길이는 30~90분이어야 합니다'); e.name = 'ValidationError'; throw e;
    }
    const client = await this.getClient();
    try {
      // 2. 권한/전제 확인 (배정된 코치인가)
      // 3. 충돌 검사 (같은 시간대 예약 → ConflictError)
      // 4. INSERT ... RETURNING
      return result.rows[0];
    } finally {
      await client.end();                         // ← 커넥션 누수 방지
    }
  }
}
```

### 2) 라우트는 얇게 — 인가와 입력 정규화만
라우트는 비즈니스 로직을 갖지 않는다. `c.get('userRole')` 등 컨텍스트로 **역할별 인가**를 처리하고, 서비스에 넘길 인자를 정규화한 뒤 호출만 한다.

```javascript
// src/routes/sessions.js
router.post('/', async (c) => {
  const role = c.get('userRole');
  const userId = c.get('userId');
  const body = await c.req.json();
  let coacheeId;

  if (role === 'coachee')      coacheeId = userId;             // 본인 = 코치이
  else if (role === 'coach')  { coacheeId = body.coachee_id; body.coach_id = userId; }
  else if (role === 'operator') coacheeId = body.coachee_id;   // 양쪽 지정 필요
  else { const e = new Error('권한이 없습니다'); e.name = 'ForbiddenError'; throw e; }

  const service = new SessionService(c.env);
  const result = await service.createSession(body, coacheeId, c.get('companyId'));
  return c.json({ data: result }, 201);
});
```

### 3) `error.name` 기반 전역 에러 매핑 (분산 throw → 일원화)
서비스 어디서든 `error.name`만 세팅해 throw하면, **단일 errorHandler가 상태코드로 변환**한다. 라우트마다 try/catch를 반복하지 않는다.

```javascript
// src/middleware/errorHandler.js — app.onError(errorHandler)로 등록
const MAP = { ValidationError: 400, UnauthorizedError: 401, ForbiddenError: 403, NotFoundError: 404, ConflictError: 409 };
export const errorHandler = (err, c) =>
  c.json({ error: err.name || 'InternalError', message: err.message }, MAP[err.name] || 500);
```

### 4) 역할 기반 데이터 격리 (멀티테넌시): WHERE를 동적으로 좁힌다
목록 쿼리는 `company_id`로 테넌트를 격리하고, **role에 따라 추가 WHERE를 덧붙여** 코치는 자기 세션만, 코치이는 자기 것만 보게 한다. 파라미터 인덱스(`$N`)를 증가시키며 바인딩.

```javascript
let where = ['s.company_id = $1'];
const values = [companyId]; let i = 2;
if (role === 'coach')        { where.push(`s.coach_id = $${i++}`);   values.push(userId); }
else if (role === 'coachee') { where.push(`s.coachee_id = $${i++}`); values.push(userId); }
// operator는 추가 제약 없음 (회사 전체 조회)
```

### 5) 알려진 약점 — 다중 쓰기에 트랜잭션이 없다 (개선 포인트)
실서비스 진단 사례에서 `AuthService.register`는 `users UPDATE` + `invite_tokens UPDATE`를 **각각 실행**했다(트랜잭션 없음). 첫 쿼리 성공 후 둘째에서 실패하면 데이터가 어긋난다. **여러 행을 함께 바꾸는 작업은 `BEGIN/COMMIT`(pg) 또는 `db.batch`(D1)로 원자화**해야 한다 — backend-dev의 "트랜잭션 경계" 의무. happy path만 보면 놓치기 쉬운 부분.

```javascript
const client = await this.getClient();
try {
  await client.query('BEGIN');
  await client.query('UPDATE users SET ... WHERE id = $1', [uid]);
  await client.query('UPDATE invite_tokens SET status = $1 WHERE id = $2', ['accepted', iid]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK'); throw e;
} finally { await client.end(); }
```

## 계층 구조 분기 가이드: DAO 유무에 따라

출처: DAO 계층을 둔 실서비스 백엔드(HTTP API + MCP 도구 공존) 코드 진단. 위 ①형을 부정하는 게 아니라, **프로젝트 구조에 맞춰 둘 중 하나를 고르는 분기**다.

백엔드 계층 구조는 프로젝트에 따라 둘 중 하나다:
- **① Route → Service → DB**: 서비스 클래스가 비즈니스 로직과 SQL을 함께 가진다. 위 "Route → Service 계층 분리" 절이 이 형태다. DB 접근 지점이 적고 단일 진입(HTTP)만 있을 때 충분하다.
- **② Route → Service → DAO → DB**: **DB 접근을 DAO 계층으로 분리**한다. DAO가 있으면 **SQL은 DAO에만 두고, Service/Route는 비즈니스 로직·입력정규화·응답 조립만** 담당한다. (라우트가 얇으면 Service 단계 없이 Route → DAO → DB로 바로 가도 된다 — 핵심은 *SQL이 DAO 밖으로 새지 않는 것*이다.)

### 판단 기준: 언제 DAO를 두나
- 같은 테이블 쿼리를 **여러 진입점**(HTTP API + MCP 도구 + 배치/동기화 스크립트)이 공유 → **DAO 필수**.
- 쿼리가 한 곳에서만 쓰이고 앱이 작다 → ① 서비스에 인라인해도 무방. 나중에 진입점이 늘면 ②로 추출.

### DAO 계층의 이점 (실서비스 코드 근거)
- **쿼리 중앙화·재사용**: MCP 도구 진입점(`server/mcp/tools.js`)이 `ProjectsDao`/`TasksDao` 등을 **API 라우트와 동일하게 import해 재사용**한다. MCP 도구와 HTTP API가 같은 쿼리·같은 멱등성 보장을 공유 → SQL을 두 번 쓰지 않는다.
- **불변식이 한 곳에**: 멱등 upsert(`tasks.js`의 `INSERT ... ON CONFLICT(id) DO UPDATE`)가 DAO 안에 있어, API로 오든 MCP로 오든 동일하게 중복 방지가 적용된다. 라우트마다 재구현하지 않는다.
- **테스트 격리**: DAO는 `constructor(db)`로 DB 핸들만 주입받으므로(`new ProjectsDao(c.env.DB)`), 테스트에서 가짜 DB를 넣어 SQL 로직만 단위 검증할 수 있다. 라우트(Hono context)와 분리.

### DAO 작성 규약
- **클래스 + `constructor(db){ this.db = db }`**: 바인딩이 아니라 *DB 핸들 자체*를 주입(`c.env.DB`). 매 요청 새 인스턴스(`new XDao(c.env.DB)`)라 stateless에 안전.
- **메서드 = 쿼리 단위**: `findAll(filters)`, `findById(id)`, `create(data)`, `update(id, fields)`, `delete(id)`, 도메인 특화(`upsert`, `countByStatus`).
- **동적 WHERE는 DAO 안에서 조립**(`tasks.js findAll`: `conds`/`vals` 배열로 필터 누적 후 바인딩) — 라우트는 필터 값만 넘긴다.
- **부분 수정 머지도 DAO 책임**: `update`가 `findById`로 기존 행을 읽어 `fields.x ?? existing.x`로 머지 후 UPDATE → 라우트는 바뀐 필드만 전달.

```javascript
// server/dao/projects.js
export default class ProjectsDao {
  constructor(db) { this.db = db }
  async findAll(status, limit = 50, offset = 0) {
    const sql = status
      ? 'SELECT * FROM projects WHERE status=? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM projects ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    const binds = status ? [status, limit, offset] : [limit, offset]
    return (await this.db.prepare(sql).bind(...binds).all()).results
  }
  async findById(id) { return this.db.prepare('SELECT * FROM projects WHERE id=?').bind(id).first() }
  // create / update(부분머지) / delete / upsert / countByStatus ...
}

// server/api/projects.js — 라우트는 얇게: DAO 인스턴스화 + 호출 + 응답
router.get('/', async (c) => {
  const dao = new ProjectsDao(c.env.DB)        // SQL 없음
  return c.json({ projects: await dao.findAll(c.req.query('status')) })
})

// server/mcp/tools.js — 동일 DAO 재사용 (재구현 없음)
const projects = new ProjectsDao(db)
```

### ⚠️ 분기 시 흔한 실수
- DAO 프로젝트인데 **라우트/서비스에서 직접 `c.env.DB.prepare(...)` 호출** → DAO 우회. SQL은 반드시 DAO로. (한 곳이라도 새면 "MCP/배치가 같은 쿼리 재사용"이라는 이점이 깨진다.)
- 새 진입점(MCP 도구·동기화 스크립트)을 추가하며 쿼리를 **복붙** → DAO에 메서드를 추가해 공유하라.
- 코드 리뷰 시: 새 기능에 SQL이 등장하면 "이 프로젝트에 DAO 계층이 있나? 있다면 왜 DAO 밖에 있나"를 먼저 묻는다.

#### 프레임워크 레벨 우수 패턴 (실서비스 검증, DAO/Service 무관)

출처: 멀티테넌시 실서비스 Hono 코드. 계층 선택과 무관하게 **모든 Hono 프로젝트에 적용할 수 있는 검증된 패턴**이다.

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

## Service→DAO 진화 서사 — ①형으로 운영하며 겪은 한계

출처: 같은 Hono 스택을 **DAO 없이 `Route → Service → DB`(①형)** 으로 운영한 실서비스 코드 진단. 이 한계들 때문에 후속 프로젝트는 Service가 아니라 DAO(②형)로 시작했다. 그 진화의 "왜"를 코드 근거로 박제한다.

**①형이 Service에 SQL을 둔 형태.** 모든 서비스 메서드가 직접 커넥션을 열고 SQL을 박는다:

```javascript
// src/services/goalService.js — 모든 메서드가 이 보일러플레이트를 반복
async getKpiTags(siteId) {
  const client = await getClient(this.env);
  try {
    const { rows } = await client.query(
      `SELECT id, name, color FROM kpi_tags WHERE site_id = $1 ORDER BY id`, [siteId]);
    return toCamelCaseArray(rows);
  } finally { await client.end(); }        // ← getClient/try/finally가 메서드마다 반복
}
```

**한계 1 — 같은 쿼리가 여러 service에 흩어진다 (재사용 불가).** 사용자 조회 SQL(`users LEFT JOIN departments LEFT JOIN teams ... WHERE u.email/u.id AND site_id`)이 `AuthService.login`과 `AuthService.refresh`에 **거의 동일하게 두 번** 복붙돼 있다. `user_roles` 조회(`SELECT role FROM user_roles WHERE user_id AND site_id`)도 두 곳에 중복. DAO가 있었다면 `UsersDao.findForAuth(email, siteId)` 하나로 끝났을 쿼리다. SQL이 service 메서드 안에 갇혀 있어 옆 service에서 부를 길이 없다.

**한계 2 — 다른 진입점(MCP/배치/스크립트)에서 재사용 불가.** SQL이 `GoalService`의 인스턴스 메서드(`this.env` 의존) 안에 있어, HTTP 라우트 밖(예: MCP 도구, 동기화 배치, cron)에서 같은 "팀 KPI 달성률 재계산" 로직을 쓰려면 service 전체를 인스턴스화하거나 SQL을 또 복붙해야 한다. ②형은 정확히 이 지점에서 막혀 DAO를 도입한 것이다(HTTP API와 MCP 도구가 같은 `ProjectsDao`를 공유).

**한계 3 — 테스트 격리가 어렵다.** `GoalService`는 `constructor(env)`로 *바인딩 묶음 전체*를 주입받고 메서드 안에서 `getClient(this.env)`로 커넥션을 연다. SQL만 단위 검증하려 해도 HTTP 컨텍스트·env 전체를 모킹해야 한다. DAO(`constructor(db)`: DB 핸들만 주입)였다면 가짜 DB 하나로 쿼리 로직만 떼어 검증할 수 있다.

**한계 4 — 트랜잭션/재계산 로직이 service에 매몰돼 비대해진다.** `goalService.js`는 1,700줄로, KPI 달성률 전파(`_recalcTeamKpiAchievement` → `_recalcCompanyKpiAchievement`)라는 **순수 데이터 로직**이 HTTP 관심사와 같은 파일에 섞여 있다. 이 전파 쿼리들은 개인목표 수정·KR 수정 등 여러 메서드에서 호출되는데, 데이터 계층으로 내려가지 못해 service 내부 private helper로만 공유된다(다른 진입점에서 못 씀).

**그래서 ②형에서 DAO로 분리했다.** 위 4가지(쿼리 산재·진입점 재사용 불가·테스트 격리·로직 매몰)가 모두 "SQL을 DAO로 내리면" 해소된다. ②형은 `ProjectsDao`/`TasksDao`를 API·MCP가 공유하고, 멱등 upsert를 DAO 한 곳에 두며, `constructor(db)`로 테스트를 격리한다(위 "DAO 계층의 이점" 절).

**결론 — 새 Hono 프로젝트 착수 규칙.**
> **진입점이 둘 이상(HTTP + MCP/배치/cron)이거나, 같은 테이블을 여러 곳에서 만지면 — 처음부터 DAO로 시작하라.** Service에 SQL을 인라인하는 ①형은 *진입점이 HTTP 하나뿐이고 쿼리가 한 곳에서만 쓰이는 작은 앱*에만 정당하다. "처음엔 작아서 Service에 다 넣었는데 나중에 MCP/재사용이 필요해지는" 경로는 매우 흔하므로, 조금이라도 재사용·다진입점 냄새가 보이면 DAO를 기본값으로 둔다. 이미 Service형으로 커진 코드라면, 중복되는 쿼리(위 사용자 조회처럼)부터 DAO 메서드로 추출하는 점진 리팩터가 안전하다.

## DAO 패턴
```javascript
// server/dao/items.js
export function createItemsDAO(db) {
  return {
    async list({ page = 1, limit = 20 } = {}) {
      const offset = (page - 1) * limit
      const { results } = await db.prepare(
        'SELECT * FROM items ORDER BY created_at DESC LIMIT ? OFFSET ?'
      ).bind(limit, offset).all()
      return results
    },
    async getById(id) {
      return db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first()
    },
    async create(data) {
      // ...
    },
    async update(id, data) {
      // ...
    },
    async delete(id) {
      // ...
    }
  }
}
```
