---
name: domain-backend-security-audit
description: 백엔드 보안 감사 체크리스트 — 인증, 인가, 입력 검증, DB 접근 제어, 멀티테넌시 규약. 보안 감시·보안 체크·보안 구현·권한 검증·데이터 보안 작업 시 사용. 프레임워크 무관 원론은 domain-backend-api-security를 별도 참조 — 이 스킬은 malgnai 구현 세부만 다루며 그와 중복되지 않는다.
---

# Backend Security Audit Skill (malgnai 스택 특화)

백엔드 API 보안의 **원론 체크리스트**(인증/인가 게이트, 입력검증, 레이트 제한, SQL주입, 크로스테넌시 일반형)는 **Skill: domain-backend-api-security**를 먼저 참조하십시오. 이 문서는 그 원론을 전제로, malgnai 실제 스택(Hono 프레임워크 · `site_id` 멀티테넌시 · `error.name` 기반 에러 매핑)에서만 나오는 구현 패턴과 차별점만 다룹니다(2026-07-23 중복 정리 — 원론 중복 서술 제거, 내용 손실 없음).

## malgnai 스택 구현 패턴 (Mandatory)

### ① 인증 게이트 (Hono 구현)
원론(화이트리스트 방식, PUBLIC_PATHS 개념)은 domain-backend-api-security 참조. malgnai 구현 방식:
- 미들웨어: `app.use('*', authMiddleware)` — Hono 전역 부착
- 예외: `PUBLIC_PATHS`에만 명시적으로 통과
- Refresh token 재발급 로직 존재 여부 확인

---

### ② 인가: 역할 기반 선언적 가드 (malgnai 네이밍 규약)
원론(권한 검증을 라우트에 흩뿌리지 말고 미들웨어 팩토리로 선언)은 domain-backend-api-security 참조. malgnai는 `requireRole()` / `requireExecutive()` 명명 규약으로 가드를 선언합니다.

**구현 패턴**:
```javascript
// ❌ 피해야 할 패턴
app.post('/admin/users', async (c) => {
  const user = c.get('currentUser');
  if (user.role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  // 비즈니스 로직...
});

// ✅ 권장 패턴
const requireAdmin = requireRole('admin');
app.post('/admin/users', requireAdmin, async (c) => {
  // 이미 admin임을 보증 — 라우트는 로직만
});
```

**체크리스트**:
- [ ] `requireRole()` / `requireExecutive()` 같은 가드 미들웨어가 정의되었는가?
- [ ] 라우트 본문에 권한 if문이 없는가? (미들웨어로만 선언)

---

### ③ 데이터 격리: `site_id` 멀티테넌시 + 상태 ENUM (malgnai 차별점)
**원칙**: 모든 데이터 접근은 테넌트 경계를 준수한다. (모든 SELECT/UPDATE/DELETE에 테넌트 필터 포함 등 원론 체크리스트는 domain-backend-api-security 참조)

**규약 1: 모든 WHERE에 `site_id` 필터 포함 (malgnai 테넌트 컬럼명)**
```javascript
// ❌ 위험: 테넌트 경계 무시
app.get('/tasks/:id', async (c) => {
  const task = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
  // 누구나 모든 task를 볼 수 있음 (IDOR 취약점)
});

// ✅ 안전: 테넌트별 격리
app.get('/tasks/:id', async (c) => {
  const siteId = c.get('siteId'); // 현재 사용자의 테넌트
  const task = await db.query(
    'SELECT * FROM tasks WHERE id = $1 AND site_id = $2', 
    [id, siteId]
  );
  // site_id 불일치 → 404 또는 접근 불가
});
```

**규약 2: 모든 쿼리는 파라미터화** — SQL Injection 방지 원론(문자열 연결 금지, Prepared Statement)은 domain-backend-api-security 참조. malgnai는 `$1, $2` 바인딩(Postgres 스타일)을 사용.

**규약 3: 상태/타입 코드는 영문 고정 (표시는 함수로) — malgnai 고유 규약**
```javascript
// DB와 API
const status = 'ACTIVE'; // 영문 고정 ENUM
const session = {
  id: 1,
  status,
  statusLabel: statusLabel(status) // 표시용 "활성"은 함수로만
};

function statusLabel(status) {
  return {
    'ACTIVE': '활성',
    'PAUSED': '일시중단',
    'COMPLETED': '완료'
  }[status];
}
```

**체크리스트**:
- [ ] 모든 SELECT/UPDATE/DELETE에 테넌트(site_id/company_id) 필터가 있는가?
- [ ] 파라미터화 쿼리를 사용하는가? (string interpolation 금지)
- [ ] 상태 코드는 영문 ENUM인가? (한글은 표시층에서만)

---

## 4가지 입력 검증 위치별 체크리스트

### 라우트 수준 (경계 방어)
**원칙**: 외부 입력은 라우트에서만 받고, 경계에서 검증을 끝낸다.

**체크리스트**:
- [ ] 모든 쿼리·바디 파라미터에 검증 헬퍼 적용? (`validateRequired`, `validateString`, `validateNumber`, `validateDate` 등)
- [ ] 필수 필드 누락 검사?
- [ ] 문자열 길이 제한 (XSS·버퍼오버플로우 방지)?
- [ ] 숫자 범위 검사?
- [ ] 날짜 형식 검증?
- [ ] ID 타입 검증 (UUID·숫자)?

**구현 예시**:
```javascript
app.post('/users', async (c) => {
  const body = await c.req.json();
  const email = validateString(body.email, 'email', 1, 255);
  const age = validateNumber(body.age, 'age', 18, 120);
  const joinedAt = validateDate(body.joinedAt, 'joinedAt');
  
  // 검증 실패는 validationError() throws → 단일 errorHandler가 400 반환
  // 통과한 값만 service로 전달
  return userService.create({ email, age, joinedAt });
});
```

---

### 비즈니스 로직 수준 (도메인 규칙)
**원칙**: 도메인 고유 규칙은 service에서 검증하고, 실패는 도메인 에러로 throw한다.

**체크리스트**:
- [ ] 이메일 중복 검사?
- [ ] 권한 기반 리소스 접근 검사?
- [ ] 상태 전이 규칙 검증 (예: DRAFT 상태만 편집 가능)?
- [ ] 외래키 참조 존재 확인?

**구현 예시**:
```javascript
class UserService {
  async create(email, age) {
    // 이메일 중복 검사
    const existing = await this.userDao.findByEmail(email);
    if (existing) {
      const e = new Error('Email already in use');
      e.name = 'ConflictError'; // errorHandler → 409
      throw e;
    }
    
    // 나이 도메인 규칙
    if (age < 18) {
      const e = new Error('Must be 18 or older');
      e.name = 'ValidationError'; // errorHandler → 400
      throw e;
    }
    
    return this.userDao.insert({ email, age });
  }
}
```

---

### DB 수준 (마지막 방어선)
**원칙**: 애플리케이션 검증이 실패해도 DB가 보호한다.

**체크리스트**:
- [ ] UNIQUE 제약으로 중복 방지?
- [ ] NOT NULL 제약으로 필수 필드 보호?
- [ ] CHECK 제약으로 값 범위/형식 제한?
- [ ] FK 제약으로 참조 무결성 보호?
- [ ] 기본값(DEFAULT)으로 안전한 초기 상태 설정?

**구현 예시**:
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,  -- 중복 방지
  age SMALLINT NOT NULL CHECK (age >= 18),  -- 범위 제한
  site_id BIGINT NOT NULL REFERENCES sites(id),  -- 참조 무결성
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED'))
);
```

---

### 에러 처리 (조용한 실패 방지)
**원칙**: 위반이 발생하면 명확한 에러로 응답한다.

**체크리스트**:
- [ ] 모든 에러는 `error.name`으로 분류되는가?
- [ ] 단일 `errorHandler`가 `error.name` → HTTP 상태코드로 변환하는가?
- [ ] 민감한 정보(내부 쿼리·스택 트레이스)는 숨기는가?
- [ ] 클라이언트는 재시도/처리 지침(429/503/5xx)을 명확히 받는가?

**에러 매핑 예시**:
```javascript
const errorHandler = (err, c) => {
  const nameToStatus = {
    'ValidationError': 400,
    'UnauthorizedError': 401,
    'ForbiddenError': 403,
    'NotFoundError': 404,
    'ConflictError': 409,  // UNIQUE 위반 등
    'RateLimitError': 429,
    'ServiceUnavailable': 503
  };
  
  const status = nameToStatus[err.name] || 500;
  return c.json({ error: err.name, message: err.message }, status);
};
```

---

## 외부 호출 안전성 (API/LLM/결제 연동)

### 타임아웃 + 재시도 + 멱등성
**원칙**: 외부 호출은 항상 실패 가능성을 가정한다.

**체크리스트**:
- [ ] 모든 외부 호출에 타임아웃 설정? (예: 30초 이상은 위험)
- [ ] 실패 시 다시 시도하는가? (지수 백오프)
- [ ] 멱등키로 중복 방지? (결제·이메일·외부 API)
- [ ] 실패 상태를 DB에 기록하는가? (나중에 재시도/모니터링)

**구현 예시**:
```javascript
async sendEmail(userId, emailContent) {
  const idempotencyKey = `email_${userId}_${Date.now()}`;
  
  try {
    const result = await emailService.send({
      to: user.email,
      content: emailContent,
      idempotencyKey  // 중복 방지
    }, { timeout: 10000 });
    
    // 성공 기록
    await db.query(
      'INSERT INTO email_log (user_id, status, sent_at) VALUES ($1, $2, now())',
      [userId, 'sent']
    );
  } catch (error) {
    // 실패 기록 + 나중에 재시도
    await db.query(
      'INSERT INTO email_log (user_id, status, retry_count) VALUES ($1, $2, $3)',
      [userId, 'failed', 1]
    );
    
    // 재시도는 배치 작업에서 처리
    throw error;
  }
}
```

---

## 자가 검증 체크리스트 (코드 완성 후, malgnai 전용 확인 항목)

API 엔드포인트를 모두 구현한 후, 다음을 확인하세요. **인증/인가·입력검증·SQL주입·테넌시의 원론 체크리스트는 domain-backend-api-security의 "테스트 & 배포 전" 항목을 먼저 통과**하고, 아래는 malgnai 스택에서만 추가로 확인할 항목입니다.

### 인증/인가 (malgnai 네이밍)
- [ ] 모든 라우트가 `authMiddleware` 또는 `PUBLIC_PATHS`에 명시되는가?
- [ ] 권한 검증이 `requireRole()`/`requireExecutive()` 미들웨어로 되는가?

### 데이터 격리 (malgnai `site_id`)
- [ ] 모든 WHERE절에 `site_id` 필터가 있는가? (IDOR 테스트)
- [ ] 상태 코드가 영문 ENUM으로 고정되고, 한글 표시는 `statusLabel()` 류 함수로만 되는가?

### 외부 호출
- [ ] API 호출에 타임아웃이 있는가?
- [ ] 결제·이메일 같은 중요 작업에 멱등키가 있는가?
- [ ] 실패 상태가 DB에 기록되고, 재시도 로직이 있는가?

### 에러 처리
- [ ] 모든 에러가 `error.name` 기반으로 상태코드로 변환되는가?
- [ ] 스택 트레이스/DB 에러가 클라이언트에 노출되지 않는가?

---

## 참고 자료

- **Skill: domain-backend-api-security** — 인증/인가·입력검증·레이트제한·SQL주입·크로스테넌시 원론 체크리스트 (이 문서와 함께 사용)
- **Skill: domain-security-audit-checklist** — OWASP A02/A07/A09(암호화·XSS·로깅) 및 감사 전반 (구 knowledge/security/owasp-security-checklist.md, 2026-08-07 분산 병합·폐기)
- **Skill: domain-backend-api-implementation-patterns** — Hono 프레임워크 구현 패턴 전반 (구 knowledge/backend/api-implementation-patterns.md, 2026-08-07 감사 §2.1 retire — 본문은 이 스킬로 완전 흡수됨)
