# 스크린샷 캡처 가이드 (Playwright)

화면 리뷰를 위해 산출물(웹앱)의 전 페이지·상태를 자동 캡처하는 표준. reviewer가 화면 리뷰 시 이 스크립트를 실행해 이미지를 모으고, 그 이미지를 Read로 보며 리뷰한다.

> **하드 게이트 (생략 불가):** UI/앱 화면을 리뷰·평가·개선하면서 **실제 렌더링된 화면을 보지 않는 것은 리뷰 실패다.** "화면 캡처 0개"로 UI/UX 리뷰를 보고하지 않는다. 로컬 서버를 띄울 수 없는 등 불가피하게 화면을 못 봤다면, 보고서에 **"화면 미확인 — 코드 기반 추정"임을 명시**한다 (안 본 것을 본 것처럼 쓰지 않는다). 캡처 이미지는 곧 리뷰의 근거 산출물이며, 보고서의 시각적 판단은 이 이미지로 뒷받침되어야 한다.

> **역할 분담**
> - **캡처는 별도 에이전트가 아니다.** 결정론적 기능이므로 reviewer(또는 frontend-dev)가 스크립트로 실행한다.
> - **스크립트 작성**: 프로젝트 시작 시 frontend-dev 또는 reviewer가 이 템플릿을 복사해 `bin/capture-all.js`로 만든다 (라우트·셀렉터는 프로젝트에 맞게 수정).
> - **실행**: reviewer가 `node bin/capture-all.js`로 실행 → `docs/screenshots/`에 저장 → Read로 참조.

---

## 확립된 관례 (malgnuniv / malgnhrd 공통)

| 항목 | 표준 |
|------|------|
| 엔진 | Playwright `chromium`, `headless: true` |
| 뷰포트 | 데스크톱 `1440×900`, 모바일 `390×844` |
| 대상 서버 | 로컬 정적 서버 (`http://127.0.0.1:550x`) — **사전 기동 필요** |
| 저장 위치 | `docs/screenshots/{역할 또는 영역}/{이름}.png` |
| 캡처 방식 | `fullPage: true` |
| 권한 처리 | localStorage에 role/token 주입 (`addInitScript` 또는 로그인 후 주입) |
| 구조 | 섹션/스텝 배열 정의 → CLI 인자로 부분 실행 |
| 안정화 | `shot()` 직전 `waitForTimeout`, 네비게이션 후 `networkidle` 대기 |
| 방어 | `isVisible().catch(() => false)` 가드 — 없는 요소는 건너뜀(에러로 중단 X) |

파일명 규칙: 순번 + 설명 (`01_dashboard.png`, `02_courses_list.png`) 또는 `{역할}/{번호-한글설명}.png`. 순서가 드러나게.

---

## 표준 템플릿 (ESM)

```javascript
#!/usr/bin/env node
/**
 * bin/capture-all.js — 전체 화면 캡처
 * 실행:  node bin/capture-all.js              # 전체
 *        node bin/capture-all.js admin        # 특정 영역만
 * 전제: 로컬 서버가 BASE 에서 실행 중이어야 함
 * 결과: docs/screenshots/{영역}/{이름}.png
 */
import { chromium } from 'playwright'
import { mkdirSync, rmSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const BASE = 'http://127.0.0.1:5500'          // 프로젝트 포트로 수정
const OUT  = join(ROOT, 'docs', 'screenshots')
const ARGS = process.argv.slice(2)

// ─── 헬퍼 ───
async function shot(page, folder, name) {
  await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, folder, `${name}.png`), fullPage: true })
  console.log(`  ✓ ${folder}/${name}.png`)
}
async function newCtx(browser, role, width = 1440, height = 900) {
  const ctx = await browser.newContext({ viewport: { width, height } })
  await ctx.addInitScript((r) => {              // 권한 주입 — 프로젝트 인증 방식에 맞게
    localStorage.setItem('role', r)
    localStorage.setItem('token', 'mock-token')
  }, role)
  return ctx
}
async function goto(page, path) {
  await page.goto(`${BASE}${path}`)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(400)
}
async function clickTab(page, text) {
  const t = page.locator('a.nav-link, .nav-tabs .nav-link').filter({ hasText: text }).first()
  if (await t.isVisible().catch(() => false)) { await t.click(); await page.waitForTimeout(500); return true }
  return false
}
async function clickBtn(page, text) {
  const b = page.locator('button').filter({ hasText: text }).first()
  if (await b.isVisible().catch(() => false)) { await b.scrollIntoViewIfNeeded(); await b.click(); await page.waitForTimeout(500); return true }
  return false
}
async function closeModal(page) { await page.keyboard.press('Escape'); await page.waitForTimeout(400) }

// ─── 섹션 정의 (프로젝트별로 작성) ───
const SECTIONS = [
  {
    key: 'public/login', folder: 'public', label: '[public] 로그인',
    async fn(browser) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      const page = await ctx.newPage()
      await goto(page, '/login')
      await shot(page, 'public', '01_login')
      await ctx.close()
    },
  },
  {
    key: 'admin/dashboard', folder: 'admin', label: '[admin] 대시보드',
    async fn(browser) {
      const ctx = await newCtx(browser, 'admin')
      const page = await ctx.newPage()
      await goto(page, '/admin')
      await shot(page, 'admin', '01_dashboard')
      await ctx.close()
    },
  },
  // … 페이지마다 추가. 탭/모달/필터 상태도 clickTab/clickBtn 후 shot()
]

// ─── 실행 ───
;(async () => {
  const toRun = ARGS.length
    ? SECTIONS.filter(s => ARGS.some(a => s.key.includes(a) || s.folder === a))
    : SECTIONS
  if (toRun.length === 0) {
    console.error('매칭 섹션 없음. 사용 가능 키:')
    SECTIONS.forEach(s => console.error('  ' + s.key)); process.exit(1)
  }
  if (ARGS.length === 0) rmSync(OUT, { recursive: true, force: true })
  for (const f of [...new Set(toRun.map(s => s.folder))]) mkdirSync(join(OUT, f), { recursive: true })

  const browser = await chromium.launch({ headless: true })
  for (const s of toRun) { console.log(s.label); await s.fn(browser) }
  await browser.close()

  let total = 0
  for (const f of [...new Set(toRun.map(s => s.folder))]) {
    const dir = join(OUT, f)
    if (existsSync(dir)) total += readdirSync(dir).filter(x => x.endsWith('.png')).length
  }
  console.log(`\n✅ 완료! ${total}장 → ${OUT}`)
})()
```

---

## 인터랙션 캡처 (클릭 이동·active·토글) — 정적 goto의 보완, 누락 빈발 지점

> 신설 사유 (2026-06-19 malgnai 2차): 캡처 스크립트가 각 라우트를 **직접 `goto`로만** 찍어, 사이드바/탭을 **클릭해 이동하는 화면**이 통째로 빠졌다. "모바일 탭이 줄넘침한다"고 지적하면서 정작 **그 탭을 누른 화면이 없는** 모순이 발생했다. **인터랙션이 본질인 UI(탭·드로어·필터·active 표시)는 정적 goto 캡처만으로는 리뷰가 반쪽이다.** 클릭 이동·active·토글 펼침을 처음부터 캡처 섹션으로 넣는다 (사용자에게 지적받은 뒤 보완하지 말고).

직접 `goto(/path)`는 "그 페이지가 어떻게 생겼나"는 보여주지만 "**사용자가 어떻게 거기 도달하나**"는 못 보여준다. 아래는 goto로는 절대 안 잡히는, 클릭/토글로만 드러나는 상태다:
- **사이드바/메뉴 클릭 순회** — 항목을 **click**해 이동하고, **active 표시(`.is-active` 등)가 올바른 항목에 붙는지** 캡처. (goto는 active 갱신 흐름을 건너뜀)
- **모바일 햄버거 드로어** — 햄버거를 **click→드로어 펼침** 상태를 캡처. 펼친 메뉴 자체가 리뷰 대상.
- **탭바 클릭 순회** — 상세 화면의 탭을 하나씩 click해 각 탭 본문 + **탭바 자체의 가로 스크롤/줄넘침/잘림 단서**를 캡처. (탭이 화면폭을 넘으면 "더 있다"는 시각 단서가 있는지가 리뷰 포인트)
- **드로어 닫힘/모달 토글** — 열고 찍고 닫고 찍어 토글 동작이 보이게.

표준 셀렉터/흐름은 `bin/capture-nav.js`(아래) 참조. **정적 캡처(capture-all.js)와 인터랙션 캡처(capture-nav.js)는 둘 다 돌린다** — 전자는 "각 화면", 후자는 "도달 흐름·active·토글".

### 재사용 자산: `bin/capture-nav.js` (클릭 기반 내비게이션 캡처)
실전 프로젝트에서 검증된 인터랙션 캡처 스크립트. capture-all.js를 복사하듯, 이 패턴을 복사해 셀렉터만 프로젝트에 맞게 고쳐 쓴다.
- **데스크톱**: 사이드바 항목을 label로 `click` 순회 → 이동 후 `.is-active` 텍스트와 URL을 대조해 active 정합성을 로그로 검증 + 캡처.
- **모바일**: 헤더 햄버거 `click`→드로어 펼침(`00_drawer_open`) → 드로어 안의 항목 `click`으로 이동 순회 → 상세 화면 탭바 `count`만큼 `click` 순회(탭 줄넘침/스크롤 단서 확인).
- 방어: 모든 요소에 `isVisible().catch(() => false)` 가드, 없으면 건너뜀. `desktop`/`mobile` 인자로 부분 실행.

## 캡처 시 빠뜨리기 쉬운 상태 (리뷰 가치가 높은 곳)

단순히 페이지 첫 화면만 찍으면 리뷰가 얕아진다. 아래 상태를 의도적으로 캡처한다:
- **권한별 화면** — 공개/사용자/관리자 등 역할마다 다른 뷰
- **탭 전환** — `.nav-tabs`의 각 탭 (정적 goto가 아니라 **클릭**으로 — 위 인터랙션 캡처 참조)
- **모달/패널** — 추가·편집·상세 모달 (열고 찍고 Escape로 닫기)
- **필터/검색 결과** — 필터 적용 전후, 검색어 입력 상태 (`page.fill()` 후 shot — 클라이언트 측 필터는 정적 캡처로 검증 불가)
- **빈 상태 / 에러 상태** — 데이터 없음, 로그인 실패, 404
- **반응형** — 모바일 뷰포트(`390×844`), 사이드바 열림
- **스크롤 하단** — 긴 페이지는 `window.scrollTo(0, document.body.scrollHeight)` 후 추가 촬영

## 안티패턴
- ❌ 하드 대기 없이 캡처 → 로딩 중 화면이 찍힘. `networkidle` + `waitForTimeout` 필수.
- ❌ 없는 요소 클릭으로 스크립트 중단 → `isVisible().catch(() => false)` 가드로 건너뛰게.
- ❌ 서버 미기동 상태로 실행 → 빈 화면. 실행 전 로컬 서버 기동 확인.
- ❌ 첫 화면만 캡처 → 위 "빠뜨리기 쉬운 상태"를 체크리스트로 활용.
- ❌ **정적 `goto`만으로 인터랙션 UI를 리뷰** → 클릭 이동·active·드로어/탭 토글이 통째로 빠진다. 탭/메뉴/드로어가 있는 UI는 capture-nav.js류 클릭 순회를 **함께** 돌린다. (캡처를 "했다"고 보고하려면 무엇을 **goto로** 찍었고 무엇을 **클릭으로** 찍었는지 구분해 적는다 — 정적 캡처를 "전체 화면 다 봤다"로 보고하지 않는다.)
