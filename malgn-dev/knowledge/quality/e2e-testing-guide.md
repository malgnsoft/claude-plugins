# E2E 테스트 가이드 (Playwright Test)

E2E 테스트는 **각 프로젝트 repo 안**에 둔다(코드와 함께 버전관리·CI). 즉석 화면 확인은 E2E가 아니라 전역 `shot`을 쓴다(→ Skill `screen-verification-and-capture`). 이 둘을 혼동하지 않는다.

| | `shot`(화면 검증) | E2E 테스트 |
|---|---|---|
| 성격 | 즉석·수동 확인 | 반복·자동 회귀 |
| 위치 | 전역 1곳 | 프로젝트 repo 안 |
| 실행 | 개발 중 눈으로 | CI 자동 |

## 처음부터 짜지 말고 스캐폴드 복사

재사용 스캐폴드: **`~/.claude/tools/e2e-template/`**

```bash
# 프로젝트 루트에서
cp -r ~/.claude/tools/e2e-template/e2e ./e2e
cp ~/.claude/tools/e2e-template/playwright.config.js ./playwright.config.js
pnpm add -D @playwright/test          # 러너(브라우저는 전역 공유 캐시 사용)
BASE_URL=http://localhost:9000 pnpm exec playwright test
```

`.gitignore`: `e2e/.auth/`, `e2e/.report/`, `test-results/`

## 인증은 전역 shot 인증을 재사용한다 (핵심)

E2E에서 로그인 코드를 새로 짜지 않는다. `e2e/auth.setup.js`가 테스트 전에 한 번 돌아 인증 세션을 만든다(우선순위):
1. `~/.claude/tools/auth/<host>.recipe.mjs` → 신선 발급(완전자동, 권장)
2. `~/.claude/tools/auth/<host>.json` → `shot login`으로 저장한 세션 재사용
3. 둘 다 없으면 비로그인 → 먼저 `shot login <url>` 하거나 레시피 작성

이는 Playwright 표준 패턴(setup project → storageState 의존)과 동일하며, `shot`의 인증 자산을 그대로 물려받는 구조다. (실측: setup이 recipe로 발급 → 인증된 화면 테스트 통과 확인)

## 좋은 E2E의 기준
- **사용자 시나리오** 단위로 짠다(로그인→목록→상세→액션→결과 확인). 페이지 존재 확인만 하는 얕은 테스트는 지양.
- 셀렉터는 `getByRole`/`getByText`/`data-testid` 우선(클래스명 의존 최소화 — 스타일 변경에 안 깨지게).
- **실패 재현**: config에 `trace: 'on-first-retry'`. 실패 시 `npx playwright show-trace test-results/.../trace.zip`.
- 반응형이 중요하면 config의 mobile project 주석을 해제해 iPhone 뷰포트로도 돌린다.
- 네트워크·비동기는 `await expect(...).toBeVisible()` 등 web-first assertion으로 자동 대기시킨다(임의 `waitForTimeout` 남발 금지).

## CI
- `retries: 2`(CI), `forbidOnly`가 config에 이미 설정됨. 앱을 먼저 기동(`webServer` 옵션을 config에 추가하거나 CI 스텝에서 서버 실행 후 테스트).
- 브라우저 설치는 `pnpm exec playwright install chromium`(CI 캐시 권장).
