# 계층 구조와 DAO — Route → Service → DAO 분기

이 스킬 색인(SKILL.md)의 "계층 구조 선택" 절이 가리키는 본문이다. **DAO를 둘지 말지, 이미 있는 DAO를 어떻게 쓸지 판단할 때만** 읽으면 된다 — 매 라우트 구현에 필요한 Hono/에러/인증/성능 패턴과 프레임워크 레벨 우수 패턴 A~F는 색인에 그대로 있다.

## Route → Service 계층 분리 (①형)

출처: 실서비스 백엔드 코드에서 역추출한 우수 패턴.

inline 핸들러에 비즈니스 로직을 다 넣는 형태(색인의 "기본 라우트 구조" 예시)는 작은 앱엔 괜찮지만, 규모가 커지면 라우트가 비대해지고 테스트가 어렵다. 이 형태는 **얇은 라우트(입력 정규화·인가) + 클래스 기반 서비스(비즈니스 로직)**로 깔끔히 분리한다.

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
