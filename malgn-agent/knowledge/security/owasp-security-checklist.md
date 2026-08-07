# OWASP Top 10 보안 점검 체크리스트

## A01: Broken Access Control (접근 제어 실패)

### 점검 항목
- [ ] 인증 없이 보호된 API에 접근 가능한가?
- [ ] 다른 사용자의 리소스에 ID 변경만으로 접근 가능한가? (IDOR)
- [ ] 관리자 기능이 일반 사용자에게 노출되는가?
- [ ] CORS 설정이 과도하게 열려 있는가?

### 방어
```javascript
// IDOR 방지: 리소스 소유권 확인
app.get('/api/items/:id', async (c) => {
  const item = await getItem(id)
  if (item.userId !== c.get('jwtPayload').sub) {
    return c.json({ error: 'Forbidden' }, 403)
  }
})
```

## A02: Cryptographic Failures (암호화 실패)

### 점검 항목
- [ ] 비밀번호가 평문으로 저장되는가?
- [ ] HTTPS가 강제되는가?
- [ ] 민감 데이터가 로그에 노출되는가?
- [ ] JWT 시크릿이 하드코딩되어 있는가?

### 방어
```javascript
// 비밀번호 해싱 (bcrypt)
const hash = await bcrypt.hash(password, 10)
const valid = await bcrypt.compare(input, hash)
```

## A03: Injection (인젝션)

### 점검 항목
- [ ] SQL 쿼리에 사용자 입력이 직접 삽입되는가?
- [ ] 파라미터 바인딩을 사용하는가?
- [ ] 명령어 실행에 사용자 입력이 포함되는가?

### 방어
```javascript
// BAD: SQL Injection 취약
db.prepare(`SELECT * FROM users WHERE name = '${input}'`)

// GOOD: 파라미터 바인딩
db.prepare('SELECT * FROM users WHERE name = ?').bind(input)
```

## A07: XSS (Cross-Site Scripting)

### 점검 항목
- [ ] 사용자 입력이 HTML에 이스케이프 없이 출력되는가?
- [ ] Vue의 v-html이 사용자 입력에 사용되는가?
- [ ] Content-Security-Policy 헤더가 설정되어 있는가?

### 방어
```html
<!-- BAD: XSS 취약 -->
<div v-html="userInput"></div>

<!-- GOOD: 자동 이스케이프 -->
<div>{{ userInput }}</div>
```

## A09: Security Logging and Monitoring Failures

### 점검 항목
- [ ] 로그인 실패가 로깅되는가?
- [ ] 관리자 작업이 기록되는가?
- [ ] 에러 스택 트레이스가 클라이언트에 노출되는가?

## 보안 보고서 심각도 기준

| 심각도 | CVSS | 기준 |
|--------|------|------|
| Critical | 9.0~10.0 | 원격 코드 실행, 인증 우회, 전체 데이터 유출 |
| High | 7.0~8.9 | 권한 상승, 대량 데이터 접근, XSS |
| Medium | 4.0~6.9 | 정보 노출, CSRF, 제한적 접근 |
| Low | 0.1~3.9 | 정보 유출(버전 노출), 미사용 포트 |

## 보안 보고서 구조

```markdown
# 보안 점검 보고서

점검일: YYYY-MM-DD
대상: [프로젝트명]

## 요약
- 점검 범위: 코드 N개 파일, API M개 엔드포인트
- Critical: N개, High: N개, Medium: N개, Low: N개

## 취약점 목록

### [C-001] 취약점 제목 (Critical)
- **위치**: 파일명:라인번호
- **설명**: 상세 설명
- **영향**: 공격 시나리오
- **권고**: 수정 방법 (코드 예시 포함)

## 개선 권고사항
(우선순위별 정리)
```

## 인프라 보안 체크리스트

### Docker
- [ ] root 사용자로 실행하지 않는가?
- [ ] 불필요한 패키지가 포함되어 있지 않은가?
- [ ] .dockerignore에 민감 파일이 포함되어 있는가?

### 환경변수
- [ ] .env 파일이 .gitignore에 포함되어 있는가?
- [ ] 시크릿이 코드에 하드코딩되어 있지 않은가?
- [ ] .env.example에 실제 값이 아닌 설명만 있는가?
