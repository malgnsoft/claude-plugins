---
name: domain-backend-api-security
description: 백엔드 API 보안 체크리스트 — 인증/인가, 입력검증, 레이트 제한, SQL주입, 크로스테넌시 방지. API 보안 검토·입력검증·인가 검사·레이트 제한 작업 시 사용. malgnai 스택(Hono·site_id·error.name) 구현 특화 패턴은 domain-backend-security-audit을 별도 참조 — 이 스킬은 스택 비특정 원론만 다루며 그와 중복되지 않는다.
---

# Backend API Security Checklist

백엔드 API 개발 시 반드시 확인해야 할 보안 항목 체크리스트입니다. 모든 API 작업 전에 다음 규칙을 준수하십시오.

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

### 2. 입력 검증 (Input Validation)

**원칙**: 모든 사용자 입력은 신뢰할 수 없으며, 화이트리스트 방식으로 검증합니다.

**체크리스트**:
- [ ] 모든 쿼리 파라미터/바디 입력에 타입 검증 적용? (길이, 포맷, 범위)
- [ ] 문자열 입력은 HTML/특수문자 이스케이프 처리하는가?
- [ ] JSON 스키마 검증(예: Joi, Zod) 사용하는가?
- [ ] 파일 업로드는 MIME 타입과 파일 크기 제한이 있는가?
- [ ] SQL 쿼리는 항상 준비문(Prepared Statement) 사용하는가?
- [ ] NoSQL 쿼리는 필터링/정규식 검증으로 주입 방지하는가?

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

## 적용 체크리스트

### API 라우트 작성 전

- [ ] 인증이 필요한 엔드포인트인가? (필요하면 미들웨어 추가)
- [ ] 역할별 권한 검사가 필요한가? (필요하면 `requireRole()` 미들웨어 추가)
- [ ] 입력 검증 스키마를 정의했는가?
- [ ] 테넌트 격리가 필요한 데이터인가? (필요하면 WHERE 절에 `tenantId` 필터 추가)

### 코드 작성 중

- [ ] 모든 입력에 검증 적용?
- [ ] SQL/NoSQL 쿼리가 매개변수화되어 있는가?
- [ ] 민감한 엔드포인트(로그인)에 레이트 제한 적용?
- [ ] 에러 메시지가 민감한 정보(DB 구조, 경로) 노출하지 않는가?

### 테스트 & 배포 전

- [ ] 인가 검사: 다른 사용자/테넌트 데이터 접근 시도 차단되는가?
- [ ] 입력 검증: 악의적 입력(XSS, SQL주입) 방어되는가?
- [ ] 레이트 제한: 과도한 요청 차단되는가?
- [ ] 감사 로그: 민감한 작업(권한 변경, 데이터 삭제) 기록되는가?

---

**참고**: 이 체크리스트는 OWASP Top 10(A01/A03 포함, 2026-08-07 `knowledge/security/owasp-security-checklist.md`에서 분산 병합) 기반 백엔드 보안 가이드입니다. 정기적으로 보안 감사를 실시하고, 의존성 취약점을 모니터링하세요.

## 이 스킬의 범위 (원론 ↔ 구현형 분리 — 상호 배제)

이 문서는 **프레임워크 무관 원론** 체크리스트입니다. 특정 스택의 코드 규약(미들웨어 네이밍, 테넌트 컬럼명, 에러 매핑 방식 등)은 다루지 않습니다.

**malgnai 스택(Hono 프레임워크 · `site_id` 멀티테넌시 · `error.name` 기반 에러 매핑) 구현 특화 패턴은 이 문서의 범위가 아니며 Skill: domain-backend-security-audit을 참조하십시오.** `requireRole()`/`requireExecutive()` 네이밍 규약, `site_id` WHERE 필터 규약, 4위치별(라우트/비즈니스로직/DB/에러처리) 입력검증 구현, DB 제약조건 예시, 외부 호출(타임아웃/재시도/멱등성) 패턴은 domain-backend-security-audit이 전담합니다.

이 두 스킬은 **원론(본 문서) ↔ malgnai 구현형(domain-backend-security-audit)** 관계로 상호 배제되며 — 같은 항목을 양쪽에 중복 서술하지 않고, 함께 사용해 원론 체크를 먼저 통과한 뒤 malgnai 구현 세부를 확인합니다.
