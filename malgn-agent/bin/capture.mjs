#!/usr/bin/env node
/**
 * capture.mjs — 화면 검증용 스크린샷 캡처 스크립트 (skills/common-screen-verification-and-capture 동반 도구).
 *
 * 사전 조건 (프로젝트 루트에서 1회):
 *   pnpm add -D playwright && pnpm exec playwright install chromium
 *
 * 이 스크립트는 playwright(전체 설치, playwright-core 아님)를 사용하며, 실행 시점의
 * 현재 작업 디렉토리(cwd = 프로젝트 루트)에 설치된 playwright를 찾는다. 반드시
 * playwright가 설치된 프로젝트 루트에서 실행할 것 — 이 파일(bin/capture.mjs) 자신의
 * 위치(malgn-agent 플러그인 안)에는 playwright를 두지 않는다.
 *
 * 사용:
 *   node <malgn-agent 플러그인 경로>/bin/capture.mjs <url> [output.png] [옵션...]
 *
 * 옵션:
 *   --full              전체 페이지 캡처(스크롤 영역 포함). 미지정 시 뷰포트 영역만.
 *   --vp <WxH>          뷰포트 크기 지정(예: 1280x800). 미지정 시 기본 1280x800.
 *   --wait <ms|셀렉터>   캡처 전 대기. 숫자면 ms 대기, 문자열이면 그 셀렉터가
 *                        나타날 때까지(visible) 대기.
 *   --click <셀렉터>     지정한 요소를 클릭한 뒤(클릭 후 UI 반응 대기 300ms) 캡처.
 *                        --wait와 함께 쓰면 "대기 → 클릭 → 캡처" 순서로 적용된다.
 *   --sel <셀렉터>       페이지 전체가 아니라 지정한 요소 하나만 캡처.
 *   --dark              다크모드 강제(prefers-color-scheme: dark 에뮬레이션).
 *   --responsive [목록]  여러 뷰포트를 순회하며 각각 캡처. 목록 생략 시 기본값
 *                        375x667,768x1024,1440x900(모바일/태블릿/데스크톱).
 *                        출력 파일명에 "-<W>x<H>" 접미사가 자동으로 붙는다.
 *   -h, --help          이 사용법을 출력.
 *
 * output을 생략하면 URL과 타임스탬프로 파일명을 자동 생성해 cwd에 저장한다.
 *
 * 예시:
 *   node bin/capture.mjs http://localhost:3000
 *   node bin/capture.mjs http://localhost:3000 out.png --full
 *   node bin/capture.mjs http://localhost:3000 out.png --vp 1440x900 --dark
 *   node bin/capture.mjs http://localhost:3000 out.png --wait 1000 --click "#open-modal" --sel ".modal"
 *   node bin/capture.mjs http://localhost:3000 out.png --responsive
 *   node bin/capture.mjs http://localhost:3000 out.png --responsive 360x800,1024x768
 */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const DEFAULT_VIEWPORT = { width: 1280, height: 800 }
const DEFAULT_RESPONSIVE = '375x667,768x1024,1440x900'

function printUsage() {
  console.error(
    [
      '사용법: capture.mjs <url> [output.png] [옵션...]',
      '',
      '옵션:',
      '  --full                전체 페이지 캡처',
      '  --vp <WxH>            뷰포트 크기 (예: 1280x800, 기본값)',
      '  --wait <ms|셀렉터>     캡처 전 대기(ms 숫자 또는 셀렉터)',
      '  --click <셀렉터>       클릭 후 캡처',
      '  --sel <셀렉터>         특정 셀렉터만 캡처',
      '  --dark                다크모드 강제',
      '  --responsive [목록]    여러 뷰포트 순회 캡처 (기본: ' + DEFAULT_RESPONSIVE + ')',
      '',
      '사전 조건: pnpm add -D playwright && pnpm exec playwright install chromium (프로젝트 루트에서 1회)',
    ].join('\n'),
  )
}

function parseVp(str) {
  const m = /^(\d+)x(\d+)$/i.exec(String(str).trim())
  if (!m) {
    console.error(`--vp/--responsive 형식 오류: "${str}" (예: 1280x800)`)
    process.exit(1)
  }
  return { width: Number(m[1]), height: Number(m[2]) }
}

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printUsage()
    process.exit(argv.length === 0 ? 1 : 0)
  }

  const url = argv[0]
  if (!/^https?:\/\//i.test(url)) {
    console.error(`url은 http(s)://로 시작해야 합니다: ${url}`)
    process.exit(1)
  }

  let rest = argv.slice(1)
  let output
  if (rest[0] && !rest[0].startsWith('--')) {
    output = rest[0]
    rest = rest.slice(1)
  }

  const flags = { full: false, vp: null, wait: null, click: null, sel: null, dark: false, responsive: null }

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    switch (a) {
      case '--full':
        flags.full = true
        break
      case '--dark':
        flags.dark = true
        break
      case '--vp':
        flags.vp = rest[++i]
        if (!flags.vp) { console.error('--vp 값이 필요합니다 (예: --vp 1280x800)'); process.exit(1) }
        break
      case '--wait':
        flags.wait = rest[++i]
        if (flags.wait === undefined) { console.error('--wait 값이 필요합니다 (예: --wait 1000 또는 --wait "#el")'); process.exit(1) }
        break
      case '--click':
        flags.click = rest[++i]
        if (!flags.click) { console.error('--click 값(셀렉터)이 필요합니다'); process.exit(1) }
        break
      case '--sel':
        flags.sel = rest[++i]
        if (!flags.sel) { console.error('--sel 값(셀렉터)이 필요합니다'); process.exit(1) }
        break
      case '--responsive':
        flags.responsive = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : DEFAULT_RESPONSIVE
        break
      default:
        console.error(`알 수 없는 옵션: ${a}`)
        printUsage()
        process.exit(1)
    }
  }

  return { url, output, flags }
}

function defaultOutputBase(url) {
  const clean = url
    .replace(/^https?:\/\//i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  const ts = new Date().toISOString().replace(/[:.]/g, '-')
  return `capture-${clean || 'page'}-${ts}`
}

function baseNoExt(p) {
  return /\.(png|jpe?g)$/i.test(p) ? p.replace(/\.(png|jpe?g)$/i, '') : p
}

function ensurePng(p) {
  return /\.(png|jpe?g)$/i.test(p) ? p : `${p}.png`
}

async function loadPlaywright() {
  // 1차: 일반적인 ESM 해석(스크립트가 프로젝트 node_modules 체인 안에 있을 때)
  try {
    return await import('playwright')
  } catch {
    // 계속 진행 — cwd 기준 해석을 시도한다
  }
  // 2차: cwd(프로젝트 루트)를 기준으로 playwright를 명시 해석한다.
  // capture.mjs 자신은 malgn-agent 플러그인 안에 있어 자신의 node_modules 체인에는
  // playwright가 없는 것이 정상이다 — 반드시 설치된 프로젝트 루트에서 실행해야 한다.
  try {
    const require = createRequire(pathToFileURL(join(process.cwd(), 'package.json')).href)
    const resolved = require.resolve('playwright')
    return await import(pathToFileURL(resolved).href)
  } catch {
    console.error(
      [
        'playwright를 찾을 수 없습니다.',
        '사전 조건: 프로젝트 루트에서 아래를 1회 실행하세요.',
        '  pnpm add -D playwright && pnpm exec playwright install chromium',
        `그 다음 이 스크립트를 그 프로젝트 루트(현재 cwd: ${process.cwd()})에서 다시 실행하세요.`,
      ].join('\n'),
    )
    process.exit(1)
  }
}

async function captureOne({ browser, url, output, viewport, flags }) {
  const context = await browser.newContext({
    viewport,
    colorScheme: flags.dark ? 'dark' : 'light',
  })
  const page = await context.newPage()

  try {
    await page.goto(url, { waitUntil: 'networkidle' })

    if (flags.wait) {
      if (/^\d+$/.test(flags.wait)) {
        await page.waitForTimeout(Number(flags.wait))
      } else {
        await page.waitForSelector(flags.wait, { state: 'visible' })
      }
    }

    if (flags.click) {
      await page.click(flags.click)
      await page.waitForTimeout(300) // 클릭 후 UI 반응(전환·애니메이션) 대기
    }

    const dir = dirname(output)
    if (dir && dir !== '.') mkdirSync(dir, { recursive: true })

    if (flags.sel) {
      const el = await page.waitForSelector(flags.sel, { state: 'visible' })
      await el.screenshot({ path: output })
    } else {
      await page.screenshot({ path: output, fullPage: flags.full })
    }
  } finally {
    await context.close()
  }
}

async function main() {
  const { url, output, flags } = parseArgs(process.argv.slice(2))
  const { chromium } = await loadPlaywright()

  const browser = await chromium.launch()
  try {
    if (flags.responsive) {
      const viewports = flags.responsive.split(',').map(parseVp)
      const base = baseNoExt(output || defaultOutputBase(url))
      const results = []
      for (const vp of viewports) {
        const file = `${base}-${vp.width}x${vp.height}.png`
        await captureOne({ browser, url, output: file, viewport: vp, flags })
        results.push(file)
      }
      console.log(`✅ ${results.length}개 뷰포트 캡처 완료:`)
      for (const f of results) console.log(`   ${f}`)
    } else {
      const viewport = flags.vp ? parseVp(flags.vp) : DEFAULT_VIEWPORT
      const file = ensurePng(output || defaultOutputBase(url))
      await captureOne({ browser, url, output: file, viewport, flags })
      console.log(`✅ 캡처 완료: ${file}`)
    }
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('캡처 실패:', err?.message || err)
  process.exit(1)
})
