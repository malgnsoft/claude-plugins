/**
 * auth.setup.js — Playwright 표준 인증 setup 예시.
 *
 * @playwright/test의 "setup project" 패턴이다: 실제 테스트보다 먼저 1회 실행되어
 * 로그인을 수행하고, 로그인된 세션(쿠키 + localStorage)을 storageState로
 * **프로젝트 로컬 파일**에 저장한다. 이후 테스트들은 이 파일을 재사용해
 * 테스트마다 매번 로그인을 반복하지 않는다.
 *
 * storageState는 절대 전역 경로(예: ~/.claude/... 등)에 저장하지 않는다 —
 * 이 파일 아래 `.auth/`처럼 항상 프로젝트 안에 둔다(자격증명이 프로젝트 밖으로
 * 새 나가지 않게 하고, 프로젝트를 지우면 세션도 함께 사라지게 하기 위함).
 *
 * 사전 조건 (프로젝트 루트에서 1회):
 *   pnpm add -D @playwright/test
 *   pnpm exec playwright install chromium
 *
 * 사용법: 이 파일을 프로젝트의 e2e 테스트 디렉터리(예: `e2e/auth.setup.js`)로
 * 복사한 뒤, 아래 "프로젝트에 맞게 고칠 곳"만 실제 로그인 폼에 맞춰 수정한다.
 * playwright.config.js에 setup project로 등록하는 방법은 이 템플릿의
 * README.md를 참조.
 */
import { test as setup, expect } from '@playwright/test'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// storageState 저장 위치 — 항상 이 파일 기준 프로젝트 로컬 경로.
// playwright.config.js의 각 project에서 이 상수를 import해 use.storageState로 그대로 쓴다.
export const STORAGE_STATE = join(__dirname, '.auth', 'user.json')

// 실제 값은 환경변수로 주입(기본값은 로컬 개발용 예시일 뿐, 커밋하지 않는다).
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_USER = process.env.E2E_USER || 'test@example.com'
const TEST_PASS = process.env.E2E_PASS || 'change-me'

setup('authenticate', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)

  // ↓↓↓ 프로젝트에 맞게 고칠 곳 1: 실제 로그인 폼 셀렉터로 교체 ↓↓↓
  await page.getByLabel('이메일').fill(TEST_USER)
  await page.getByLabel('비밀번호').fill(TEST_PASS)
  await page.getByRole('button', { name: '로그인' }).click()

  // ↓↓↓ 프로젝트에 맞게 고칠 곳 2: 로그인 성공을 판정할 요소/URL로 교체 ↓↓↓
  // (대시보드 진입, 사용자 메뉴 노출 등 "확실히 로그인됐다"고 볼 수 있는 조건)
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()

  // 로그인된 세션을 프로젝트 로컬 파일로 저장 — 이후 다른 테스트가 이 파일을 재사용한다.
  await page.context().storageState({ path: STORAGE_STATE })
})
