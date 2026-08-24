---
name: domain-security-audit-checklist
description: 라우트 한 건이 아니라 프로젝트 전체의 보안 태세를 주기적으로(월·분기·연간) 훑을 때 여는 감사 체크리스트 — 의존성 취약점 스캔, SAST·하드코딩 시크릿 스캔, 계정·권한 매트릭스 정리, 전송/저장 암호화, 로깅·모니터링·에러 노출, XSS 방지(OWASP A02/A07/A09 흡수). security가 정기 감사·릴리스 전 태세 점검을 할 때 사용한다.
---

# Security Audit Checklist

**언제 이 문서를 여는가**: 개별 엔드포인트가 아니라 **프로젝트 전체**를 대상으로 정기 감사를 돌릴 때, 또는 릴리스 전 태세를 한 번 훑을 때. 신규 기능이나 의존성 추가 시에도 확인하세요.

라우트 한 건의 인증·입력검증·테넌시는 Skill `domain-backend-api-security`가 다룹니다.

## 핵심 감사 항목

### 1. 의존성 취약점 관리 (Dependency Vulnerability Management)

**원칙**: 모든 외부 라이브러리의 보안 취약점을 지속적으로 모니터링하고, 즉시 패치합니다.

**구현 규칙**:
- [ ] 패키지 매니저 보안 스캔 정기 실시 (`npm audit`, `pnpm audit`)
- [ ] CI/CD 파이프라인에 의존성 검사 자동화 포함
- [ ] 심각한 취약점(CVSS >= 7.0)은 48시간 내 패치
- [ ] 보안 업데이트에 한해 마이너/패치 버전 자동 업그레이드 적용
- [ ] 프로덕션은 락파일 사용(`package-lock.json` 또는 `pnpm-lock.yaml`) 필수
- [ ] 아웃데이트된 의존성은 월 1회 이상 검토

**체크 명령어**:
```bash
# pnpm 기반 프로젝트
pnpm audit

# npm
npm audit

# 보안 감사 도구 (GitHub Advanced Security 등)
# .github/workflows/security-audit.yml 설정
```

**안티패턴**:
```bash
# ❌ 피할 것: 취약점 무시
npm audit --audit-level moderate # 낮은 수준만 검사

# ✅ 권장: 높은 기준으로 검사
npm audit --audit-level high
```

---

### 2. 정적 분석(SAST) & 코드 스캔

**원칙**: 배포 전에 정적 분석으로 코드 결함과 보안 패턴 위반을 자동 탐지합니다.

**구현 규칙**:
- [ ] 소스 코드 정적 분석 도구 적용 (예: SonarQube, Semgrep, ESLint security plugin)
- [ ] 하드코딩된 비밀(토큰, 키) 스캔 활성화
- [ ] 코드 커버리지 기준 설정 (최소 80%)
- [ ] 높은 심각도 이슈는 PR 병합 차단
- [ ] 정기적 SAST 리포트 검토 (월 1회 이상)
- [ ] false positive 제외 규칙 명확히 문서화

**체크리스트**:
- [ ] ESLint + security plugin 설정 (.eslintrc)
- [ ] 코드 리뷰는 보안 관점도 포함하는가?
- [ ] CI/CD에 보안 검사 단계 포함되어 있는가?
- [ ] 크리티컬 이슈 수정 기한이 정의되어 있는가?

**설정 예**:
```javascript
// .eslintrc.js
module.exports = {
  extends: ['eslint:recommended'],
  plugins: ['security'],
  rules: {
    'security/detect-unsafe-regex': 'error',
    'security/detect-non-literal-regexp': 'warn',
    'security/detect-eval-with-expression': 'error'
  }
};
```

---

### 3. 접근 제어 & 권한 관리 (Access Control)

**원칙**: 최소 권한 원칙(Principle of Least Privilege)에 따라 사용자·서비스·리소스의 접근을 제한합니다.

**구현 규칙**:
- [ ] 역할 기반 접근 제어(RBAC) 정의 및 문서화 (어드민, 사용자, 게스트 등)
- [ ] 데이터베이스 사용자는 필요한 권한만 부여 (SELECT/INSERT/UPDATE만, DROP/ALTER 제한)
- [ ] API 엔드포인트별 권한 요구사항 명시 (라우트 문서에)
- [ ] 서비스 계정(CI/CD, 배치 작업)은 별도 권한 세트 사용
- [ ] 정기적 권한 감시: 사용하지 않는 계정 제거 (분기 1회)
- [ ] 초대/권한 부여는 감사 로그에 기록

**체크리스트**:
- [ ] 역할×리소스 권한 매트릭스가 정의되었는가?
- [ ] DB 계정 권한이 최소화되었는가?
- [ ] 서비스 계정이 분리되었는가? (CI/CD ≠ 배치 작업)
- [ ] 권한 변경 이력이 기록되는가?
- [ ] 불활성 계정 정리 절차가 있는가?

**권한 매트릭스 예**:
```
| 리소스        | 게스트 | 사용자 | 어드민 |
|---------------|--------|--------|--------|
| 자기 데이터   | R      | RW     | RW     |
| 타사 데이터   | -      | -      | R      |
| 설정 변경     | -      | -      | RW     |
| 권한 관리     | -      | -      | RW     |
| 시스템 로그   | -      | -      | R      |
```

---

### 4. 암호화 & 민감 데이터 보호 (Encryption)

**원칙**: 전송 중(TLS)과 저장 상태(encryption at rest) 모두에서 민감 데이터를 암호화합니다.

**구현 규칙**:
- [ ] 모든 네트워크 통신은 HTTPS(TLS 1.2 이상) 사용 필수
- [ ] 데이터베이스 연결도 암호화 (예: `postgresql://user:pass@host/db?sslmode=require`)
- [ ] 비밀번호는 bcrypt/scrypt로 해싱 (평문 저장 금지)
- [ ] API 토큰/키는 환경변수 또는 비밀 관리 서비스에서 관리
- [ ] 민감 필드(SSN, 신용카드, 비밀번호)는 필드 레벨 암호화
- [ ] 로그에서 민감 데이터는 마스킹 (토큰, 비밀번호 노출 금지)
- [ ] 백업 데이터도 동일한 암호화 적용

**체크리스트**:
- [ ] HTTPS 인증서 유효기간 모니터링하는가?
- [ ] 비밀번호 저장 방식이 적절한가? (bcrypt 사용?)
- [ ] 환경 변수(.env)는 버전 관리에 포함되지 않는가?
- [ ] 로그에 토큰/키가 노출되지 않는가?
- [ ] 백업/복제본도 암호화되는가?
- [ ] JWT 시크릿이 코드에 하드코딩되어 있지 않은가? (환경변수/비밀 관리 서비스에서 로드하는가?) *(OWASP A02 흡수)*

**안티패턴**:
```javascript
// ❌ 피할 것: 평문 비밀번호
const hashedPassword = user.password; // 평문 저장

// ✅ 권장: bcrypt 해싱
import bcrypt from 'bcryptjs';
const hashedPassword = await bcrypt.hash(password, 10);
```

---

### 5. 로깅 & 모니터링 (Logging & Monitoring)

**원칙**: 모든 보안 관련 이벤트를 기록하고, 이상 탐지를 위해 지속적으로 모니터링합니다.

**구현 규칙**:
- [ ] 모든 인증/인가 시도(성공/실패) 기록
- [ ] 데이터 접근(특히 민감 데이터) 로그 기록
- [ ] 권한 변경, 계정 생성/삭제 기록
- [ ] 시스템 에러, 예외 상황 기록
- [ ] 로그는 중앙 집중식 저장소(ELK, CloudWatch 등)에 수집
- [ ] 로그 보존 기간: 최소 90일 (규제에 따라 1년 이상)
- [ ] 로그에는 민감 데이터(비밀번호, 토큰) 마스킹
- [ ] 실시간 알림: 로그인 실패 5회 이상, 권한 변경 등
- [ ] 서버 에러 응답에 스택 트레이스·내부 파일 경로·쿼리문이 노출되지 않는가? (클라이언트에는 일반화된 메시지만) *(OWASP A09 흡수)*

**로깅 레벨**:
- `ERROR`: 보안 위반, 인가 실패, 데이터 손상
- `WARN`: 비정상 활동 감지, 레이트 제한 도달
- `INFO`: 로그인/로그아웃, 권한 변경
- `DEBUG`: API 요청 상세 (개발 환경만)

**체크리스트**:
- [ ] 인증/인가 이벤트가 기록되는가?
- [ ] 중앙 로깅 시스템이 구성되었는가?
- [ ] 로그 보존 정책이 정의되었는가?
- [ ] 로그에 민감 데이터가 포함되지 않는가?
- [ ] 실시간 알림 규칙이 설정되었는가?
- [ ] 정기적 로그 검토 프로세스가 있는가?
- [ ] 에러 스택 트레이스가 클라이언트 응답에 노출되지 않는가? *(OWASP A09 흡수)*

**구현 예**:
```javascript
// 로깅 미들웨어
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // 민감 필드 마스킹
    const body = { ...req.body };
    if (body.password) body.password = '***';
    
    logger.info({
      timestamp: new Date(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.id,
      duration: Date.now() - start,
      body, // 민감 필드는 위에서 마스킹 처리됨
    });
  });
  next();
});
```

**안티패턴** *(OWASP A09 흡수)*:
```javascript
// ❌ 피할 것: 에러 핸들러가 스택 트레이스·내부 정보를 그대로 클라이언트에 반환
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack }); // 내부 파일 경로·쿼리문 노출
});

// ✅ 권장: 서버 로그에는 상세 기록, 클라이언트에는 일반화된 메시지만
app.use((err, req, res, next) => {
  logger.error({ message: err.message, stack: err.stack, path: req.path });
  res.status(500).json({ error: 'Internal Server Error' });
});
```

---

### 6. XSS 방지 (Cross-Site Scripting) *(OWASP A07 흡수, 2026-08-07)*

**원칙**: 사용자 입력을 HTML/DOM에 반영할 때는 항상 이스케이프를 거치고, 신뢰할 수 없는 원문을 그대로 렌더링하지 않습니다.

**구현 규칙**:
- [ ] 사용자 입력을 HTML로 출력할 때 프레임워크의 자동 이스케이프 바인딩을 사용 (원문 삽입 금지)
- [ ] Vue의 `v-html`, React의 `dangerouslySetInnerHTML` 등 원문 HTML 삽입 API는 사용자 입력에 절대 사용하지 않음 — 불가피하면 DOMPurify 등으로 새니타이즈 후 사용
- [ ] `Content-Security-Policy` 헤더로 인라인 스크립트·외부 스크립트 출처를 제한
- [ ] 사용자 입력을 `eval`/`Function`/`setTimeout(string)` 등 문자열 실행 API에 전달하지 않음

**체크리스트**:
- [ ] 사용자 입력이 HTML에 이스케이프 없이 출력되는가?
- [ ] `v-html`/`dangerouslySetInnerHTML`이 사용자 입력에 사용되는가?
- [ ] `Content-Security-Policy` 헤더가 설정되어 있는가?
- [ ] 새니타이즈 라이브러리(DOMPurify 등) 없이 원문 HTML을 렌더링하는 경로가 있는가?

**안티패턴**:
```html
<!-- ❌ 피할 것: v-html에 사용자 입력을 그대로 삽입 (XSS 취약) -->
<div v-html="userInput"></div>

<!-- ✅ 권장: 텍스트 바인딩은 자동 이스케이프됨 -->
<div>{{ userInput }}</div>

<!-- 원문 HTML 렌더링이 불가피하면 새니타이즈 후 사용 -->
<div v-html="sanitizeHtml(userInput)"></div>
```

> Vue-Zero 프로젝트에서 `v-html`을 실제로 다루는 구현 세부사항은 Skill `frontend-vue-zero-patterns`를 참조하되, 이 XSS 방어 원칙 자체는 프레임워크 비특정 일반론이다.

## 적용 체크리스트

### 정기 감시 (월 1회)

- [ ] `pnpm audit` 또는 `npm audit` 실행하고 결과 검토
- [ ] 심각한 취약점 발견 시 패치 계획 수립
- [ ] SAST 리포트 확인 (SonarQube, Semgrep 등)
- [ ] 로그에서 이상 활동 패턴 검토 (실패한 로그인 등)
- [ ] 신규 화면·컴포넌트의 XSS 벡터(원문 HTML 삽입 API 사용 여부) 검토

### 분기 감시 (3개월 1회)

- [ ] 사용자/서비스 계정 권한 감시 (불필요한 권한 제거)
- [ ] DB 사용자 권한 검토 및 최소화
- [ ] API 엔드포인트 권한 문서 최신화
- [ ] TLS 인증서 유효기간 확인

### 연간 감시 (1년 1회)

- [ ] 전체 보안 태세 평가
- [ ] 신규 위협 트렌드 검토 및 정책 업데이트
- [ ] 백업 및 재해복구 계획 테스트
- [ ] 내/외부 보안 감사 고려

---

**참고**: 이 체크리스트는 NIST Cybersecurity Framework, CIS Controls, OWASP Top 10(A02 암호화 실패·A07 XSS·A09 로깅/모니터링 실패, 2026-08-07 `knowledge/security/owasp-security-checklist.md`에서 분산 병합)에 기반합니다. 프로젝트 규모와 규제 요건에 맞게 조정하세요.

**인접 문서**:
- **Skill `domain-backend-api-security`** — API 엔드포인트 한 건을 쓰거나 리뷰할 때(인증 게이트·4계층 입력검증·인젝션·테넌시).
- **Skill `domain-serverless-edge-api-security`** — Cloudflare Workers·Hono·D1·MCP 코드베이스를 점검할 때(인증 5대 함정·`cors()` reflect·요청당 과금 DoS).
- **Skill `domain-devops-deployment-patterns` §1** — Docker 이미지·환경변수 등 인프라 하드닝 자체는 이 스킬이 아니라 그쪽이 전담한다. 다만 위 §1(의존성 취약점)·§2(SAST)를 CI/CD 파이프라인에 붙이는 일은 devops와 맞닿는다.
