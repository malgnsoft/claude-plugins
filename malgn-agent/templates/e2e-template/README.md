# e2e-template

`skills/common-screen-verification-and-capture`의 동반 스캐폴드다. E2E 테스트(반복·자동 회귀용)를
처음부터 짜지 않고 이 템플릿을 프로젝트에 복사해 시작하기 위한 최소 세트.

이 디렉터리 자체는 실행되지 않는다 — **프로젝트 repo 안으로 복사한 뒤** 그 프로젝트의
실제 로그인 폼·URL에 맞게 고쳐 쓰는 예시(참조용 스캐폴드)다.

## 담긴 것

- `auth.setup.js` — Playwright 표준 `storageState` 인증 setup 예시. 로그인을 1회만 수행해
  세션을 **프로젝트 로컬 파일**(`.auth/user.json`)에 저장하고, 이후 모든 테스트가 그 세션을
  재사용한다(테스트마다 로그인 반복 없음). storageState는 항상 프로젝트 안에만 저장되며,
  이 템플릿은 어떤 전역 경로도 전제하지 않는다.

## 사용법

1. 프로젝트 루트에서 의존성 설치 (1회):
   ```bash
   pnpm add -D @playwright/test
   pnpm exec playwright install chromium
   ```

2. `auth.setup.js`를 프로젝트의 E2E 테스트 디렉터리로 복사:
   ```bash
   mkdir -p e2e
   cp <malgn-agent 플러그인 경로>/templates/e2e-template/auth.setup.js e2e/auth.setup.js
   ```

3. `e2e/auth.setup.js` 안의 "프로젝트에 맞게 고칠 곳"을 실제 로그인 폼 셀렉터·성공 판정
   조건으로 교체한다. `BASE_URL`/`E2E_USER`/`E2E_PASS`는 환경변수로 주입한다(코드에 자격증명
   하드코딩 금지).

4. 프로젝트의 `playwright.config.js`에 setup project를 등록하고, 인증이 필요한 테스트
   project가 그 storageState를 의존하게 한다:
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

5. `.gitignore`에 세션 파일 경로를 추가한다(자격증명이 담긴 세션을 커밋하지 않기 위함):
   ```
   e2e/.auth/
   ```

6. 실행:
   ```bash
   pnpm exec playwright test
   ```
   `setup` project가 먼저 돌아 `e2e/.auth/user.json`을 만들고, 이를 의존하는 다른
   project들이 이미 로그인된 상태로 테스트를 시작한다.

## `capture.mjs`와의 관계

`bin/capture.mjs`(→ `skills/common-screen-verification-and-capture`)는 **즉석·수동 확인용**
1회성 스크린샷 CLI다 — 개발 중 "지금 이 화면이 의도대로 보이나"를 빠르게 확인할 때 쓴다.
이 템플릿(`e2e-template`)은 **반복·자동 회귀용** E2E 테스트 스위트를 위한 것으로, 성격이
다르다:

| | `capture.mjs`(화면 검증) | `e2e-template`(E2E 테스트) |
|---|---|---|
| 성격 | 즉석·수동, 1회성 | 반복·자동 회귀 |
| 위치 | `malgn-agent/bin/`(공용 스크립트) | 프로젝트 repo 안(`e2e/`, 코드와 함께 버전관리) |
| 실행 주체 | 사람이 필요할 때 직접 실행 | CI가 매번 자동 실행 |
| 인증 | 현재 자체 로그인/세션 재사용 기능 없음 | `auth.setup.js`로 `storageState` 표준 재사용 |

두 도구는 **같은 `playwright` 계열 패키지**를 쓴다는 점만 공유하고(둘 다 프로젝트 로컬에
설치해 실행 — 전역 설치를 전제하지 않음), 서로 자동으로 연동되지는 않는다. `capture.mjs`로
인증이 필요한 화면을 찍어야 하면, 지금은 다음 중 하나를 택한다:

- 그 화면을 이 템플릿 기반 E2E 테스트 안에서 `page.screenshot()`으로 함께 캡처한다(가장 간단).
- 또는 `auth.setup.js`가 저장한 `e2e/.auth/user.json`은 Playwright 표준 storageState
  JSON 포맷이므로, 별도 스크립트에서 `browser.newContext({ storageState: '<그 경로>' })`로
  직접 로드해 재사용할 수 있다 — 단 `capture.mjs`가 현재 이 옵션을 플래그로 내장하고 있지는
  않다(향후 확장 시 이 표준 포맷을 그대로 소비하면 된다).
