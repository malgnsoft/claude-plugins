# E2E 테스트 가이드 (Playwright Test)

E2E 테스트는 **각 프로젝트 repo 안**에 둔다(코드와 함께 버전관리·CI). 즉석 화면 확인은 E2E가 아니라 플러그인 번들 스크립트 `bin/capture.mjs`를 쓴다(→ Skill `common-screen-verification-and-capture`). 이 둘을 혼동하지 않는다.

| | `capture.mjs`(화면 검증) | E2E 테스트 |
|---|---|---|
| 성격 | 즉석·수동, 1회성 확인 | 반복·자동 회귀 |
| 위치 | 플러그인 번들 `bin/`(공용 스크립트) | 프로젝트 repo 안(`e2e/`, 코드와 함께 버전관리) |
| 실행 | 개발 중 사람이 필요할 때 직접 | CI가 매번 자동 |
| 브라우저 설치 | 대상 프로젝트에 `playwright` 설치 필요 | 대상 프로젝트에 `@playwright/test` 설치 필요 |

두 도구 모두 **브라우저 바이너리를 전역 공유 캐시에 의존하지 않는다** — 각 프로젝트가 필요한 패키지를 스스로 설치한다. 예전에는 "전역 1곳에 이미 설치돼 있어 재설치 불필요"라는 전제가 있었지만, 이 전제는 신입 PC나 CI처럼 그 전역 설치가 없는 환경에서 조용히 깨진다. 지금은 프로젝트마다 아래 설치 단계를 예외 없이 1회 거친다.

## 처음부터 짜지 말고 스캐폴드 복사

재사용 스캐폴드: **`${CLAUDE_PLUGIN_ROOT}/templates/e2e-template/`** (담긴 파일: `auth.setup.js`, `README.md`)

> 위 `${CLAUDE_PLUGIN_ROOT}` 토큰은 **이 문서에서는 절대 풀리지 않는다.** 치환은 하네스가 파일을 플러그인 컴포넌트(스킬 본문·에이전트 본문·훅 커맨드)로 로드할 때만 일어나는데, knowledge 파일은 그렇게 로드되지 않고 Read로 읽히기 때문이다(셸 변수도 아니다). 실제로 실행할 때는 Skill `common-screen-verification-and-capture`(또는 `common-output-storage-and-path-management` §1-1)를 열어 거기 채워져 도착하는 절대경로를 쓴다.

```bash
# 1) 프로젝트 루트에서 러너 설치 (1회, 이 프로젝트 전용)
pnpm add -D @playwright/test
pnpm exec playwright install chromium

# 2) 인증 setup 스크립트를 프로젝트 e2e 디렉터리로 복사
mkdir -p e2e
cp "${CLAUDE_PLUGIN_ROOT}/templates/e2e-template/auth.setup.js" e2e/auth.setup.js
```

`e2e/auth.setup.js` 안의 "프로젝트에 맞게 고칠 곳"(로그인 폼 셀렉터, 로그인 성공 판정 조건)을 실제 값으로 교체한다. `BASE_URL`/`E2E_USER`/`E2E_PASS`는 환경변수로 주입한다(코드에 자격증명 하드코딩 금지).

프로젝트의 `playwright.config.js`에 setup project를 등록하고, 인증이 필요한 테스트 project가 그 storageState를 의존하게 한다:

```js
import { defineConfig } from '@playwright/test'
import { STORAGE_STATE } from './e2e/auth.setup.js'

export default defineConfig({
  testDir: './e2e',
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.js/ },
    {
      name: 'chromium',
      use: { storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
})
```

`.gitignore`에 세션 파일 경로를 추가한다(자격증명이 담긴 세션을 커밋하지 않기 위함):

```
e2e/.auth/
test-results/
```

실행:

```bash
BASE_URL=http://localhost:9000 pnpm exec playwright test
```

`setup` project가 먼저 돌아 `e2e/.auth/user.json`을 만들고, 이를 의존하는 다른 project들이 이미 로그인된 상태로 테스트를 시작한다. 전체 사용법·`capture.mjs`와의 관계 비교표는 `templates/e2e-template/README.md`를 참조.

## 인증은 프로젝트 로컬 storageState로 처리한다 (핵심)

E2E에서 로그인 코드를 매 테스트 새로 짜지 않는다. `e2e/auth.setup.js`가 테스트 전에 한 번만 돌아 로그인을 수행하고, 세션(쿠키+localStorage)을 **프로젝트 로컬 파일**(`e2e/.auth/user.json`)에 저장한다 — 전역 경로(`~/.claude/...` 등)는 어디에도 쓰지 않는다. 이후 테스트들은 이 파일을 재사용해 테스트마다 로그인을 반복하지 않는다.

이는 Playwright 표준 패턴(setup project → storageState 의존)을 그대로 따른 것으로, 인증 자산이 프로젝트 밖으로 새 나가지 않고 프로젝트를 지우면 세션도 함께 사라진다는 이점이 있다. `capture.mjs`는 현재 이 storageState를 자동으로 소비하는 옵션을 내장하고 있지 않다 — 인증이 필요한 화면을 즉석 캡처해야 하면 그 화면을 E2E 테스트 안에서 `page.screenshot()`으로 함께 캡처하거나, 별도 스크립트에서 `browser.newContext({ storageState: 'e2e/.auth/user.json' })`로 직접 로드해 재사용한다.

## 좋은 E2E의 기준
- **사용자 시나리오** 단위로 짠다(로그인→목록→상세→액션→결과 확인). 페이지 존재 확인만 하는 얕은 테스트는 지양.
- 셀렉터는 `getByRole`/`getByText`/`data-testid` 우선(클래스명 의존 최소화 — 스타일 변경에 안 깨지게).
- **실패 재현**: 프로젝트 `playwright.config.js`에 `trace: 'on-first-retry'`를 설정해 둔다. 실패 시 `npx playwright show-trace test-results/.../trace.zip`.
- 반응형이 중요하면 같은 config에 iPhone 등 mobile project를 추가해 함께 돌린다.
- 네트워크·비동기는 `await expect(...).toBeVisible()` 등 web-first assertion으로 자동 대기시킨다(임의 `waitForTimeout` 남발 금지).

## CI
- 프로젝트 `playwright.config.js`에 `retries: 2`(CI), `forbidOnly: !!process.env.CI`를 설정한다. 앱을 먼저 기동(`webServer` 옵션을 config에 추가하거나 CI 스텝에서 서버 실행 후 테스트).
- 브라우저 설치는 로컬과 동일하게 `pnpm exec playwright install chromium`을 CI 스텝에 명시한다(전역 공유 설치를 전제하지 않으므로 CI 환경에서도 이 스텝이 반드시 필요하다). 반복 실행 속도를 위해 `~/.cache/ms-playwright`(또는 CI 도구의 캐시 경로)를 CI 캐시 키에 넣는 것은 무방하나, 캐시가 없거나 무효화된 최초 실행에서도 이 install 스텝이 항상 성공해야 한다는 전제는 바뀌지 않는다.
