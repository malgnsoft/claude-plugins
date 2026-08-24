# 테스트 가이드

## 테스트 설계 기법

### 경계값 분석
- 최소값, 최소값-1, 최소값+1
- 최대값, 최대값-1, 최대값+1
- 빈 값, null, undefined

### 동등 분할
- 유효한 입력 그룹에서 대표값 1개
- 무효한 입력 그룹에서 대표값 1개

### 상태 전이
- 각 상태에서 가능한 전이를 모두 테스트
- 불가능한 전이도 시도하여 에러 처리 확인

## Vitest 패턴

### 기본 테스트
```javascript
import { describe, it, expect, beforeEach } from 'vitest'

describe('ItemService', () => {
  let service

  beforeEach(() => {
    service = new ItemService()
  })

  it('should create an item', () => {
    const item = service.create({ name: 'test' })
    expect(item).toHaveProperty('id')
    expect(item.name).toBe('test')
  })

  it('should throw on empty name', () => {
    expect(() => service.create({ name: '' }))
      .toThrow('이름은 필수입니다')
  })
})
```

### API 통합 테스트
```javascript
import { describe, it, expect } from 'vitest'

describe('GET /api/items', () => {
  it('should return items list', async () => {
    const res = await app.request('/api/items')
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(Array.isArray(data)).toBe(true)
  })

  it('should support pagination', async () => {
    const res = await app.request('/api/items?page=1&limit=5')
    const { data, meta } = await res.json()
    expect(data.length).toBeLessThanOrEqual(5)
    expect(meta).toHaveProperty('total')
  })
})
```

### Mock/Stub 패턴
```javascript
import { vi } from 'vitest'

// 함수 모킹
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: [] })
})

// 모듈 모킹
vi.mock('./db', () => ({
  query: vi.fn().mockResolvedValue([])
}))
```

## 테스트 보고서 형식

```markdown
# 테스트 보고서

실행일: YYYY-MM-DD
환경: Node.js XX, Vitest X.X

## 요약
- 전체: N개
- 통과: M개 ✓
- 실패: K개 ✗
- 스킵: J개 ⊘
- 커버리지: XX%

## 테스트 결과

### 단위 테스트
| 테스트 | 결과 | 비고 |
|--------|------|------|
| ItemService.create | ✓ | |
| ItemService.validate | ✓ | |

### API 테스트
| 엔드포인트 | 메서드 | 결과 | 비고 |
|-----------|--------|------|------|
| /api/items | GET | ✓ | |
| /api/items | POST | ✓ | |

## 수정된 버그
- [파일:라인] 설명 → 수정 내용
```

## E2E 테스트 (Playwright)

```javascript
import { test, expect } from '@playwright/test'

test('사용자 로그인 흐름', async ({ page }) => {
  await page.goto('/login')
  await page.fill('#email', 'test@example.com')
  await page.fill('#password', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('h1')).toContainText('대시보드')
})
```

---

## 커버리지 함정: "401/400만 찍는 테스트"는 통과해도 빈 깡통이다

출처: coaching 프로젝트 테스트 진단. 실제 코드를 진단해 얻은 교훈.

### 진단으로 발견한 실제 패턴 (안티패턴)
coaching의 `test/routes/*.test.js`는 12개 라우트 파일 전부가 **인증 없이 접근 → 401**, **필수 필드 누락 → 400** 두 가지만 반복 검증했다. `rbac.test.js`는 모든 보호 엔드포인트에 대해 401을 전수 검증(좋은 패턴)했지만, 그 외에는:

- ❌ **인증된 happy path가 0개** — 로그인 성공 → 200, 토큰으로 목록 조회 → 200 같은 "실제로 동작하는가" 테스트가 단 하나도 없음.
- ❌ **RBAC 403(권한 분리) 검증이 0개** — `sessions.js`는 `role !== 'coach'`면 403을 던지지만(세션 시작), coachee가 그 엔드포인트를 호출했을 때 403이 나는지 검증하는 테스트가 없음. 401(미인증)만 봤지 403(인가 실패)은 안 봄.
- ❌ **비즈니스 규칙 검증이 0개** — `sessionService.createSession`에 풍부한 규칙이 있는데(session_type 화이트리스트, duration 30~90분 경계, 과거 날짜 차단, 배정 코치 확인, 시간 충돌 409) **이 중 무엇도 테스트되지 않음**. 가장 깨지기 쉬운 핵심 로직이 무방비.

> 핵심 통찰: **401/400 테스트는 미들웨어와 라우트 입구만 본다. 정작 버그가 사는 곳은 그 안쪽(Service의 분기·경계·상태 전이)인데 거기엔 테스트가 닿지 않는다.** 라우트 개수만큼 it()이 많아 "커버리지 넓어 보이는 착시"가 생긴다.

### 처방: 인가·비즈니스 규칙·상태 전이까지 내려가라

테스트 피라미드를 **인증 계층별 / 역할별 / 규칙별**로 의도적으로 설계한다.

| 계층 | 무엇을 검증 | 예시 |
|------|------------|------|
| ① 인증 (401) | 미인증 차단 | 토큰 없이 → 401 (rbac.test.js 패턴, 이미 잘 함) |
| ② **인가 (403)** | **잘못된 역할 차단** | coachee가 `POST /sessions/:id/start` → 403 |
| ③ 입력검증 (400) | 라우트 입구 방어 | 필수 필드 누락 → 400 |
| ④ **happy path (200/201)** | **실제 동작** | operator 로그인 → 200, 토큰으로 세션 생성 → 201 |
| ⑤ **비즈니스 규칙 (409/400/403)** | **Service 분기** | 과거 날짜 예약 → 400, 시간 충돌 → 409, 배정 안 된 코치 → 403 |
| ⑥ **상태 전이** | 불가능한 전이 차단 | completed 세션을 다시 start → 에러 |

### 인증된 요청 테스트 헬퍼 (Cloudflare Workers / Vitest)
401만 찍던 테스트를 happy path로 끌어올리는 핵심은 **실제 토큰을 발급해 Authorization 헤더를 붙이는 헬퍼**다.

```javascript
import { env, SELF } from 'cloudflare:test';
import { AuthService } from '../../src/services/authService.js';

// 역할별 JWT를 즉석 발급 (DB seeding과 함께 사용)
async function tokenFor({ id, email, role, company_id }) {
  const auth = new AuthService(env);
  return auth.generateAccessToken({ id, email, role, company_id });
}

function authed(token, opts = {}) {
  return {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
  };
}

describe('Sessions — 인가 & 비즈니스 규칙', () => {
  it('coachee가 세션 시작 시 403 (코치 전용)', async () => {
    const t = await tokenFor({ id: 99, email: 'cee@x.com', role: 'coachee', company_id: 1 });
    const res = await SELF.fetch('http://localhost/api/v1/sessions/1/start', authed(t, { method: 'POST' }));
    expect(res.status).toBe(403);   // ← 401이 아니라 403을 본다
  });

  it('과거 날짜 예약 시 400', async () => {
    const t = await tokenFor({ id: 50, email: 'cee@x.com', role: 'coachee', company_id: 1 });
    const res = await SELF.fetch('http://localhost/api/v1/sessions', authed(t, {
      method: 'POST',
      body: JSON.stringify({ coach_id: 1, scheduled_date: '2020-01-01', scheduled_start_time: '10:00', session_type: 'video' }),
    }));
    expect(res.status).toBe(400);
  });
});
```

### Service 단위 테스트로 비즈니스 규칙 경계를 직접 친다
라우트를 거치지 않고 Service를 직접 호출하면 분기·경계값을 싸고 정밀하게 검증할 수 있다 (authService.test.js가 hashPassword/verifyPassword에서 이미 잘 한 방식 — 이 방식을 sessionService 등 도메인 규칙으로 확장하라).

```javascript
describe('SessionService.createSession — 경계값', () => {
  const svc = new SessionService(env);
  it.each([
    ['video', 50, true],
    ['chat', 30, true],     // 최소 경계
    ['chat', 90, true],     // 최대 경계
    ['video', 29, false],   // 최소-1 → ValidationError
    ['video', 91, false],   // 최대+1 → ValidationError
    ['phone', 50, false],   // 화이트리스트 밖 → ValidationError
  ])('type=%s duration=%s → valid=%s', async (type, dur, ok) => {
    const call = svc.createSession({ coach_id: 1, scheduled_date: futureDate(), scheduled_start_time: '10:00', session_type: type, duration_minutes: dur }, 1, 1);
    if (ok) await expect(call).resolves.toBeDefined();
    else await expect(call).rejects.toThrow();
  });
});
```

### 진단 체크리스트 (테스트 보고서에 커버리지로 명시)
- [ ] 보호 엔드포인트 전수 401 검증이 있는가 (rbac 전수 테스트)
- [ ] **역할 분리 403**을 역할별로 검증했는가 (coachee→coach전용, coach→operator전용)
- [ ] **인증된 happy path**가 주요 흐름마다 있는가 (로그인→200, CRUD 201/200)
- [ ] Service의 **모든 분기/throw 지점**에 대응 테스트가 있는가 (코드의 `error.name=...` 줄 수 ≈ 테스트 수)
- [ ] **경계값**(min/min-1/max/max+1)과 **상태 전이 불가**(completed→start) 케이스가 있는가
- [ ] it() 개수가 아니라 **"검증한 코드 분기 비율"**로 커버리지를 보고하는가
