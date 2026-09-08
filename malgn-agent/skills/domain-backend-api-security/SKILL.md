---
name: domain-backend-api-security
description: 백엔드 API 엔드포인트 한 건을 설계·구현·리뷰할 때 여는 보안 체크리스트(스택 무관) — 보안 구조적 결정(설계 단계에 확정)과 로직 강도(구현과 함께 점진 강화)를 가르는 분류 정본, 인증/인가 게이트, IDOR 소유권 검사, CORS 화이트리스트, 4계층 입력검증(라우트·서비스·DB제약·에러), 레이트 제한, SQL/NoSQL/명령어 인젝션, 멀티테넌시 격리, 외부 호출 안전성. architect·backend-dev·security가 라우트 단위로 작업할 때 사용한다. Cloudflare Workers·D1·MCP 코드베이스라면 domain-serverless-edge-api-security를 먼저 연다.
---

# Backend API Security Checklist

**언제 이 문서를 여는가**: API 엔드포인트를 새로 만들거나, 기존 라우트를 고치거나, 특정 라우트의 보안을 리뷰할 때. 프레임워크·런타임을 가리지 않는 원론 체크리스트다.

아래 §1~§6은 요청이 들어와 응답이 나가는 경로 순서대로 배열되어 있다: 인증/인가 게이트 → 입력검증 → 레이트 제한 → 인젝션 → 테넌시 → 외부 호출.

## 언제 정하는가 — 구조적 결정과 로직 강도

이 문서의 항목들은 **언제 정해야 하는가**로 두 종류로 갈린다. 그 구분이 없으면 양쪽으로 다 틀린다 — 되돌리기 비싼 결정을 구현 중에 즉흥으로 정하거나, 반대로 나중에 얼마든지 올릴 수 있는 항목 때문에 간단한 작업에까지 설계·리뷰·보안 점검이 조기에 붙어 처음부터 무거워진다. **어느 항목이 어느 쪽인가의 정본은 이 절이다** — 다른 문서는 이 목록을 복제하지 않고 여기를 가리킨다.

### (a) 구조적 결정 — 초기 설계(architect) 단계에서 확정한다

나중에 바꾸면 데이터 모델·전 라우트·이미 저장된 데이터까지 함께 손봐야 해서 재작업 비용이 크다. 설계 문서(`api-spec.md`·`data-model.md`)에 값이 정해져 있어야 하며, 구현 단계로 미루지 않는다.

- 인증 게이트를 **어디에 거는가**와 공개 경로(`PUBLIC_PATHS`)의 경계 — 무엇이 열려 있고 무엇이 닫혀 있는가 (§1)
- 인가의 **축** — 역할이라는 개념을 둘 것인가, 검사를 어느 계층에서 할 것인가 (§1)
- 소유권 필드(`user_id`/`owner_id`)와 테넌트 키 컬럼의 **존재** — 스키마에 이 컬럼이 없으면 나중에 IDOR 방어·테넌시 격리를 붙일 자리 자체가 없다 (§1 IDOR·§5)
- 자격증명 전달 방식(쿠키 vs Bearer)과 거기 딸린 CORS 자격증명 정책의 골격 (§1)
- 민감 데이터를 **어느 테이블에 어떤 형태로** 둘 것인가 — 평문/암호화, 마스킹 대상 분리

### (b) 로직 강도 — 기능 구현과 함께 점진적으로 강화한다

(a)로 정해진 게이트·모델은 그대로 두고 그 **안에서** 촘촘함만 조절하는 항목이다. 대부분 백엔드 내부 구현에 머물러 나중에 올려도 재작업 비용이 낮다. 처음부터 최대 강도로 올리지 않고 그 기능이 실제로 요구하는 수준에서 시작해, 필요해질 때 올린다.

- 이미 보호된 라우트 안에서의 역할 권한 세분화 (§1) — 단, 권한을 **넓혀** 새 주체가 접근하게 되면 경계 이동이므로 (a)다
- 입력검증 규칙의 촘촘함 — 길이·범위·포맷 조건 추가 (§2)
- 레이트 제한의 적용 범위와 임계값 (§3)
- 감사 로그 항목 추가
- 이미 소유권 필터가 걸린 경로에서의 IDOR 검사 정교화 (§1 IDOR)
- 에러 응답의 정보 노출 축소·재시도 지침 보강 (§2-4)
- 외부 호출의 타임아웃·백오프 값 조정 (§6)

### 갈릴 때의 판별 질문

**"이 변경이 '누가 무엇에 접근할 수 있는가'의 경계를 옮기는가?"** 옮기면 (a), 경계는 그대로 두고 그 안의 촘촘함만 바꾸면 (b)다.

- 소유권·테넌트 필터를 **처음 도입**하거나 제거·우회하는 것은 (b)가 아니라 (a)다. 이미 걸린 필터를 특정 경로에서 더 촘촘히 하는 것만 (b)다.
- 보호되던 라우트를 공개로 열거나 그 반대로 닫는 것은 (a)다 — 역할을 몇 개로 나누는가와는 다른 질문이다.
- **강도 조절 대상이 아닌 최소 요건**이 따로 있다: 파라미터화 쿼리(§4), fail-closed(키·설정이 없으면 통과가 아니라 거부), 비밀번호·토큰을 로그·응답에 싣지 않기. 이것들은 "나중에 강화"의 대상이 아니라 처음부터 지키는 것이며, 동시에 작업 등급을 올리는 요소도 아니다 — 구현을 제대로 하는 일의 일부다.

### 작업 등급·팀 구성에 미치는 영향

**(b) 항목만 걸린 변경은 그것만으로 작업 등급이 올라가지 않고, security 에이전트 호출을 강제하지도 않는다.** 저위험 작업이면 Standard(조건을 채우면 Fast Path) 그대로 두고 기능 구현과 함께 강화한다. 반대로 (a)에 해당하는 것을 신설·변경·제거·우회하면 인증·권한 도메인의 동작을 건드리는 것이므로 그대로 Sensitive다. **등급 판정 자체의 정본은 Skill `common-task-grading-and-verification-depth`이고**, 이 절은 그 판정에 넣을 재료((a)인가 (b)인가)만 제공한다.

| 작업 | 걸리는 항목 | 판정 |
|---|---|---|
| 소유권 개념이 없는 조회 API 응답에 필드 하나 추가 | (b)만 — 입력검증·레이트 제한을 더 조일 여지가 보이는 정도 | Standard(Fast Path 5조건 충족 시 Fast Path). 강도 항목은 별도로 적어두고 진행 |
| 이미 admin 전용인 라우트에 "자기 부서 레코드만" 조건을 더해 권한을 좁힘 | (b) 권한 세분화 | Standard. 반대로 권한을 넓혀 새 주체가 접근하게 되면 경계 이동이라 (a) → Sensitive |
| `WHERE id = ?`만 쓰던 조회에 소유권 필터를 처음 도입 | (a) 접근 경계 신설 | Sensitive |
| 결제 웹훅 수신 라우트 신설 | (a) 인증 게이트·소유권 매핑·멱등 처리를 새로 정함 + 결제 도메인 | Sensitive |
| 사내 전용 대시보드에 감사 로그 항목 추가 | (b)만 | Standard |

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

**참고**: 이 체크리스트는 OWASP Top 10(A01/A03 포함) 기반 백엔드 보안 가이드입니다.
