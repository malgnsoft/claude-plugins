---
name: domain-backend-api-security
description: 백엔드 API 엔드포인트 한 건을 설계·구현·리뷰할 때 여는 보안 체크리스트(스택 무관) — 인증/인가 게이트, IDOR 소유권 검사, CORS 화이트리스트, 4계층 입력검증(라우트·서비스·DB제약·에러), 레이트 제한, SQL/NoSQL/명령어 인젝션, 멀티테넌시 격리, 외부 호출 안전성. architect·backend-dev·security가 라우트 단위로 작업할 때 사용한다. Cloudflare Workers·D1·MCP 코드베이스라면 domain-serverless-edge-api-security를 먼저 연다.
---

# Backend API Security Checklist

**언제 이 문서를 여는가**: API 엔드포인트를 새로 만들거나, 기존 라우트를 고치거나, 특정 라우트의 보안을 리뷰할 때. 프레임워크·런타임을 가리지 않는 원론 체크리스트다.

아래 §1~§6은 요청이 들어와 응답이 나가는 경로 순서대로 배열되어 있다: 인증/인가 게이트 → 입력검증 → 레이트 제한 → 인젝션 → 테넌시 → 외부 호출.

## 핵심 규칙

### 1. 인증 & 인가 게이트 (Authentication & Authorization)

**원칙**: 모든 API는 기본적으로 보호되어야 하며, 공개 엔드포인트만 명시적으로 예외 처리합니다.

**체크리스트**:
- [ ] 모든 보호 필요 엔드포인트에 JWT/OAuth 토큰 검증 미들웨어 적용?
- [ ] 공개 엔드포인트(로그인, 회원가입, 헬스체크)만 `PUBLIC_PATHS` 배열에 명시?
- [ ] 토큰 만료/무효화 시 401 응답 반환하는가?
- [ ] 역할별 권한(RBAC) 미들웨어가 라우트마다 붙어있는가?
- [ ] 권한 없음 요청에 403 Forbidden 반환하는가?
- [ ] 권한 검증 로직이 비즈니스 로직과 분리되어 있는가?
- [ ] Refresh token 재발급 경로가 있다면 그 경로 자체도 검증·만료 처리되는가?

**안티패턴**:
```javascript
// ❌ 피할 것: 매 라우트마다 권한 검사
app.get('/admin/users', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  // 로직...
});

// ✅ 권장: 미들웨어로 선언
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
  next();
};
app.get('/admin/users', requireAdmin, handler);
```

> 인증 게이트를 전역 미들웨어 1곳에 걸고 화이트리스트로만 여는 구현, 역할 가드 팩토리(`requireRole()` 등)의 실제 코드는 Skill `domain-backend-api-implementation-patterns` §A·§B가 정본이다. 이 문서는 "무엇을 만족해야 하는가"만 다룬다.

**IDOR (Insecure Direct Object Reference) — OWASP A01 병합**:
- [ ] 리소스 조회/수정 API가 URL의 ID값만으로 접근을 허용하지 않고, 요청자가 그 리소스의 소유자/권한자인지 확인하는가? (다른 사용자의 리소스에 ID 값만 바꿔 접근 가능하면 IDOR 취약점)

```javascript
// ❌ 위험: 소유권 확인 없이 ID로 바로 조회 (IDOR)
app.get('/api/items/:id', async (c) => {
  const item = await getItem(id)
  return c.json(item) // 다른 사용자의 item도 그대로 반환됨
})

// ✅ 권장: 소유권 확인 후 반환
app.get('/api/items/:id', async (c) => {
  const item = await getItem(id)
  if (item.userId !== c.get('jwtPayload').sub) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  return c.json(item)
})
```
(§5 크로스테넌시 격리와 역할 분담: §5는 테넌트 경계, 이 항목은 동일 테넌트 내 리소스 소유권 경계를 다룹니다.)

**CORS 설정 — OWASP A01 병합 (신규: 기존 체크리스트에 없던 항목)**

원칙: CORS는 기본적으로 닫혀 있어야 하며, 허용 오리진은 화이트리스트로 명시합니다.

- [ ] `Access-Control-Allow-Origin`이 `*`(전체 허용)로 설정되어 있지 않은가?
- [ ] 인증정보(쿠키/Authorization 헤더)를 포함하는 요청에서 `Access-Control-Allow-Credentials: true`와 와일드카드 오리진을 동시에 쓰지 않는가?
- [ ] 허용 오리진이 환경변수/화이트리스트 배열로 명시 관리되는가?
- [ ] preflight(OPTIONS) 응답이 허용 메서드/헤더를 필요한 범위로만 제한하는가?

```javascript
// ❌ 위험: 모든 오리진 허용 + 자격증명 동시 허용
app.use('*', cors({ origin: '*', credentials: true }))

// ✅ 권장: 화이트리스트 오리진만 허용
const ALLOWED_ORIGINS = ['https://app.example.com']
app.use('*', cors({
  origin: (origin) => ALLOWED_ORIGINS.includes(origin) ? origin : null,
  credentials: true
}))
```

---

### 2. 입력 검증 — 4계층 방어 (Input Validation)

**원칙**: 모든 사용자 입력은 신뢰할 수 없으며, 화이트리스트 방식으로 검증합니다. 검증은 한 곳이 아니라 **라우트(경계) → 비즈니스 로직 → DB 제약 → 에러 처리** 4계층으로 겹쳐 둡니다. 앞 계층이 뚫려도 뒤 계층이 막고, 마지막 계층은 위반을 조용히 삼키지 않고 드러냅니다.

#### 2-1. 라우트 수준 (경계 방어)

**원칙**: 외부 입력은 라우트에서만 받고, 경계에서 검증을 끝낸다.

**체크리스트**:
- [ ] 모든 쿼리 파라미터/바디 입력에 타입 검증 적용? (길이, 포맷, 범위)
- [ ] 필수 필드 누락 검사?
- [ ] 문자열 길이 제한 (XSS·버퍼오버플로우 방지)?
- [ ] 숫자 범위 검사 / 날짜 형식 검증 / ID 타입 검증(UUID·숫자)?
- [ ] 문자열 입력은 HTML/특수문자 이스케이프 처리하는가?
- [ ] JSON 스키마 검증(예: Joi, Zod) 또는 검증 헬퍼(`validateRequired`/`validateString`/`validateNumber`/`validateDate`)를 사용하는가?
- [ ] 파일 업로드는 MIME 타입과 파일 크기 제한이 있는가?

**안티패턴**:
```javascript
// ❌ 위험: 검증 없음
app.post('/api/users', (req, res) => {
  const user = User.create(req.body); // 모든 입력 수용
});

// ✅ 권장: 스키마 검증
const schema = Joi.object({ email: Joi.string().email().required() });
app.post('/api/users', (req, res) => {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).send(error);
  const user = User.create(value);
});
```

#### 2-2. 비즈니스 로직 수준 (도메인 규칙)

**원칙**: 도메인 고유 규칙은 service에서 검증하고, 실패는 도메인 에러로 throw한다. 형식만 맞는 입력이 규칙을 깨뜨리는 경로를 여기서 막는다.

**체크리스트**:
- [ ] 유일성 검사(예: 이메일 중복)?
- [ ] 권한 기반 리소스 접근 검사? (§1 IDOR과 짝을 이룸)
- [ ] 상태 전이 규칙 검증 (예: DRAFT 상태만 편집 가능)?
- [ ] 외래키 참조 존재 확인?

```javascript
class UserService {
  async create(email, age) {
    const existing = await this.userDao.findByEmail(email);
    if (existing) {
      const e = new Error('Email already in use');
      e.name = 'ConflictError'; // errorHandler → 409
      throw e;
    }
    if (age < 18) {
      const e = new Error('Must be 18 or older');
      e.name = 'ValidationError'; // errorHandler → 400
      throw e;
    }
    return this.userDao.insert({ email, age });
  }
}
```

#### 2-3. DB 수준 (마지막 방어선)

**원칙**: 애플리케이션 검증이 실패해도 DB가 보호한다. 코드 경로가 하나 늘어날 때마다 검증을 빠뜨릴 수 있지만, 제약조건은 모든 경로에 동일하게 걸린다.

**체크리스트**:
- [ ] UNIQUE 제약으로 중복 방지?
- [ ] NOT NULL 제약으로 필수 필드 보호?
- [ ] CHECK 제약으로 값 범위/형식 제한?
- [ ] FK 제약으로 참조 무결성 보호?
- [ ] 기본값(DEFAULT)으로 안전한 초기 상태 설정?

```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,  -- 중복 방지
  age SMALLINT NOT NULL CHECK (age >= 18),  -- 범위 제한
  site_id BIGINT NOT NULL REFERENCES sites(id),  -- 참조 무결성
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED'))
);
```

#### 2-4. 에러 처리 (조용한 실패 방지)

**원칙**: 위반이 발생하면 명확한 에러로 응답한다. 검증에 걸린 요청이 200으로 빠져나가면 앞의 세 계층이 무의미해진다.

**체크리스트**:
- [ ] 모든 에러가 이름/타입으로 분류되고, 단일 에러 핸들러가 HTTP 상태코드로 변환하는가? (라우트마다 try/catch를 반복하지 않는다)
- [ ] 검증 실패가 400, 인증 실패가 401, 권한 실패가 403, 유일성 위반이 409로 각각 구분되어 나가는가?
- [ ] 민감한 정보(내부 쿼리·스택 트레이스·파일 경로)는 클라이언트 응답에서 숨기는가?
- [ ] 클라이언트는 재시도/처리 지침(429/503/5xx)을 명확히 받는가?

> `error.name` → 상태코드 매핑 테이블과 `notFound()/validationError()` 류 throw 헬퍼의 실제 구현은 Skill `domain-backend-api-implementation-patterns` §D가 정본이다.

---

### 3. 레이트 제한 (Rate Limiting)

**원칙**: 비정상적 사용을 방지하고 서비스 가용성을 보호합니다.

**체크리스트**:
- [ ] 로그인/비밀번호 리셋 같은 민감한 엔드포인트에 레이트 제한 적용? (예: 5회/분)
- [ ] 일반 API는 사용자당 레이트 제한이 설정되어 있는가? (예: 100회/시간)
- [ ] 429 Too Many Requests 응답에 Retry-After 헤더 포함하는가?
- [ ] 어드민/서비스 계정은 레이트 제한 예외 처리되는가?
- [ ] 레이트 제한 데이터는 Redis/메모리에 저장되는가?

**구현 예**:
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.get('/api/users', limiter, handler);
```

---

### 4. SQL 주입 & NoSQL 주입 방지 (Injection Prevention)

**원칙**: 동적 쿼리 작성을 금지하고, 준비문이나 ORM을 반드시 사용합니다.

**체크리스트**:
- [ ] SQL은 문자열 연결 대신 Prepared Statement 사용하는가?
- [ ] 모든 데이터베이스 라이브러리가 매개변수화된 쿼리를 지원하는가?
- [ ] NoSQL 쿼리에서 사용자 입력이 필터 객체로 직접 전달되지 않는가?
- [ ] 데이터베이스 사용자는 최소 권한(select/insert/update만) 가지는가?
- [ ] 백업 및 로그는 민감 데이터(비밀번호, 토큰) 마스킹 처리하는가?

**안티패턴**:
```javascript
// ❌ 위험: 문자열 연결
const user = await User.findOne(`SELECT * FROM users WHERE id = '${id}'`);

// ✅ 권장: Prepared Statement
const user = await User.findOne('SELECT * FROM users WHERE id = ?', [id]);
```

값만이 아니라 **테이블·컬럼명을 사용자 입력으로 조립하는 경로**도 함께 확인한다 — 플레이스홀더는 값에만 걸리므로, 정렬 컬럼·필터 컬럼은 화이트리스트 상수와 대조해야 안전하다.

**명령어 실행 인젝션 — OWASP A03 병합**:
- [ ] 셸 명령어 실행에 사용자 입력이 그대로 포함되지 않는가? (OS Command Injection)
- [ ] 외부 프로세스 호출이 필요하면 인자를 배열로 전달(셸 해석 우회)하고, 셸 문자열 조합을 쓰지 않는가?

```javascript
// ❌ 위험: 사용자 입력을 셸 명령에 직접 결합
exec(`convert ${filename} output.png`);

// ✅ 권장: 인자 배열로 전달, 셸 해석 없이 실행
execFile('convert', [filename, 'output.png']);
```

---

### 5. 크로스테넌시 데이터 격리 (Multi-Tenancy Isolation)

**원칙**: 모든 데이터 접근은 테넌트 경계를 준수합니다.

**체크리스트**:
- [ ] 모든 SELECT/UPDATE/DELETE 쿼리에 테넌트 필터(WHERE tenant_id = ?) 포함되는가?
- [ ] 사용자는 자신의 테넌트 데이터만 접근할 수 있도록 제한되는가?
- [ ] 조인 쿼리에서 테넌트 필터가 모든 테이블에 적용되는가?
- [ ] 테넌트 ID는 요청 인증 토큰에서 추출하지, 클라이언트 입력에서 받지 않는가?
- [ ] 설정/통계 같은 공유 데이터도 테넌트로 파티션되는가?
- [ ] 배치 작업은 테넌트별 필터링으로 실행되는가?

**안티패턴**:
```javascript
// ❌ 위험: 테넌트 필터 누락
app.get('/api/orders/:id', (req, res) => {
  const order = Order.findById(req.params.id); // 모든 테넌트 주문 노출
});

// ✅ 권장: 테넌트 필터 포함
app.get('/api/orders/:id', (req, res) => {
  const order = Order.findOne({ id: req.params.id, tenantId: req.user.tenantId });
  if (!order) return res.status(404).send('Not found');
});
```

> 테넌트 키의 실제 컬럼명은 프로젝트마다 다르다(`site_id`·`company_id` 등). 컬럼명 규약과 코드 예시는 Skill `domain-backend-api-implementation-patterns` §F를 참조한다 — 이 문서는 "모든 접근 경로에 테넌트 필터가 걸려 있는가"라는 불변량만 요구한다.

---

### 6. 외부 호출 안전성 (API/LLM/결제 연동)

**원칙**: 외부 호출은 항상 실패 가능성을 가정한다. 응답이 오지 않는 호출은 요청 스레드·워커를 붙잡아 가용성 문제로 번지고, 재시도에 멱등성이 없으면 결제·발송이 중복된다.

**체크리스트**:
- [ ] 모든 외부 호출에 타임아웃 설정? (무제한 대기 금지)
- [ ] 실패 시 재시도하는가? (지수 백오프)
- [ ] 멱등키로 중복 방지? (결제·이메일·외부 API)
- [ ] 실패 상태를 DB에 기록하는가? (나중에 재시도/모니터링)
- [ ] 외부 응답을 그대로 신뢰해 저장·렌더링하지 않고 검증하는가?

```javascript
async sendEmail(userId, emailContent) {
  const idempotencyKey = `email_${userId}_${Date.now()}`;

  try {
    await emailService.send({
      to: user.email,
      content: emailContent,
      idempotencyKey  // 중복 방지
    }, { timeout: 10000 });

    await db.query(
      'INSERT INTO email_log (user_id, status, sent_at) VALUES ($1, $2, now())',
      [userId, 'sent']
    );
  } catch (error) {
    // 실패 기록 + 나중에 재시도 (재시도는 배치 작업에서 처리)
    await db.query(
      'INSERT INTO email_log (user_id, status, retry_count) VALUES ($1, $2, $3)',
      [userId, 'failed', 1]
    );
    throw error;
  }
}
```

## 적용 체크리스트

### API 라우트 작성 전

- [ ] 인증이 필요한 엔드포인트인가? (필요하면 미들웨어 추가)
- [ ] 역할별 권한 검사가 필요한가? (필요하면 역할 가드 미들웨어 추가)
- [ ] 입력 검증 스키마를 정의했는가?
- [ ] 테넌트 격리가 필요한 데이터인가? (필요하면 WHERE 절에 테넌트 필터 추가)

### 코드 작성 중

- [ ] 모든 입력에 검증 적용? (§2 4계층 중 어디까지 걸었는지 확인)
- [ ] SQL/NoSQL 쿼리가 매개변수화되어 있는가?
- [ ] 민감한 엔드포인트(로그인)에 레이트 제한 적용?
- [ ] 에러 메시지가 민감한 정보(DB 구조, 경로) 노출하지 않는가?
- [ ] 외부 호출에 타임아웃·멱등키가 있는가?

### 테스트 & 배포 전

- [ ] 인가 검사: 다른 사용자/테넌트 데이터 접근 시도 차단되는가? (IDOR 테스트)
- [ ] 입력 검증: 악의적 입력(XSS, SQL주입) 방어되는가?
- [ ] 레이트 제한: 과도한 요청 차단되는가?
- [ ] 감사 로그: 민감한 작업(권한 변경, 데이터 삭제) 기록되는가?
- [ ] 외부 호출 실패가 DB에 기록되고 재시도 경로가 있는가?

---

## 인접 문서

- **Skill `domain-backend-api-implementation-patterns`** — 위 요구사항을 Hono·D1·pg 스택에서 실제로 코딩하는 방법(전역 인증 게이트, 역할 가드 팩토리, 검증 헬퍼, `error.name` 매핑, 테넌트 컬럼 규약). 이 문서가 "무엇을", 그 문서가 "어떻게"를 맡는다.
- **Skill `domain-serverless-edge-api-security`** — Cloudflare Workers·D1·MCP 코드베이스를 점검할 때. 그 스택 특유의 인증 함정·`cors()` reflect·요청당 과금 DoS를 다룬다.
- **Skill `domain-security-audit-checklist`** — 라우트 한 건이 아니라 프로젝트 전체 태세를 주기적으로 훑을 때(의존성·SAST·계정 권한·암호화·로깅·XSS).

**참고**: 이 체크리스트는 OWASP Top 10(A01/A03 포함 — 구 OWASP 체크리스트 knowledge 문서에서 2026-08-07 분산 병합) 기반 백엔드 보안 가이드입니다. §2의 4계층 방어 구조와 §6 외부 호출 안전성은 2026-08-24 보안 스킬 정리에서 별도 문서로 갈라져 있던 것을 이 문서로 흡수한 것입니다.
