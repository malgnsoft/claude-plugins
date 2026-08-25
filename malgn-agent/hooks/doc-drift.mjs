#!/usr/bin/env node
/**
 * doc-drift.mjs — 전역 제네릭 문서-코드 드리프트 체커 (프로젝트 무관).
 *
 * 프로젝트 루트의 `.claude/doc-drift.json` 매니페스트를 읽어, 각 check 의 expected(문서가
 * 주장하는 값)를 코드에서 실측한 값과 대조한다. 문서가 코드와 조용히 썩는 것을 방지 —
 * "최소 토큰으로 항상 정확한 이해"의 정확성 보증 장치.
 *
 * 매니페스트 형식 (.claude/doc-drift.json):
 *   { "checks": [
 *       { "label": "API 파일", "expected": 13, "glob": "server/api/*.js" },
 *       { "label": "DB 테이블", "expected": 20, "file": "server/dao/init.js", "regex": "CREATE TABLE IF NOT EXISTS \\w+" },
 *       { "label": "페이지",   "expected": 15, "jsonLength": "app/pages/pages.json" },
 *       { "label": "러너",     "expected": 7,  "homeGlob": "Library/LaunchAgents/com.malgnai.*.plist" }
 *   ] }
 *
 * 측정 프리미티브(코드가 진실):
 *   glob      — cwd 기준 "dir/패턴(*포함)" 파일 수. `**`(임의 깊이의 하위 디렉토리 재귀)도 지원한다.
 *             `**` 재귀는 `node_modules`·`.git`·`.venv`·`__pycache__`·`.parcel-cache`·`.next`·
 *             `.nuxt`·`.turbo`·`.svelte-kit`·`.cache`·`.output`(PRUNED_DIR_NAMES, `:53` 부근) 이름의
 *             디렉토리에는 진입하지 않는다 — 글롭 루트 안에 이 이름의 하위 디렉토리가 있으면,
 *             설령 그 안에 패턴과 매치되는 파일이 있어도 집계되지 않는다.
 *   homeGlob  — $HOME 기준 glob (러너·전역에이전트 등 프로젝트 밖). `**`도 동일하게 지원.
 *   jsonLength— JSON 파일 파싱 후 배열 길이(또는 객체 키 수)
 *   file+regex— 파일 내 정규식 전역 매치 수
 *   측정 불가(경로 없음/다른 호스트) → 해당 check skip(드리프트 아님).
 *
 * checks가 빈 배열이면(스캐폴딩 직후 등) computeDrift()는 `empty: true`를 반환한다 — "검사해서
 * 이상 없음"과 "아직 아무것도 검사하지 않음"은 다른 상태이므로, 매니페스트를 채우기 전까지는
 * 통과(✅)로 보고하지 않는다.
 *
 * 사용: node "${CLAUDE_PLUGIN_ROOT}/hooks/doc-drift.mjs" [projectDir]   (기본 cwd)
 *       (이 변수는 스킬·에이전트 본문과 훅 커맨드에서 치환되고, 이 파일을 Read로 열면 문자 그대로다 — 셸 변수가 아니다)
 * 재사용: import { computeDrift } from '.../doc-drift.mjs'
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { findMalgnAgentBlockPath, AMBIGUOUS, expandHome } from './lib/find-pm-block-path.mjs'

function globSegmentRe(seg) {
  return new RegExp('^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
}

// 순환 심볼릭 링크나 과도하게 깊은 트리(오타로 프로젝트 루트에 `**`를 건 경우 등)에서 재귀가
// 멈추지 않는 것을 막는 안전장치. 매니페스트가 가리키는 통상적인 서브트리(예: server/api/**)
// 깊이를 넉넉히 넘는 값이라 정상 사용에는 영향이 없다.
const GLOB_RECURSION_DEPTH_CAP = 12

// `**` 재귀나 트레일링 `**`의 전량 카운트가 절대 진입하지 않는, 이름 자체가 도구 산출물임을
// 뜻하는 디렉토리로만 한정한다. 이런 트리는 글롭 루트 **안에** 존재할 때 깊거나 커서 깊이상한에
// 먼저 걸려, 같은 루트 아래 패턴이 실제로 매치하는 얕은 결과까지 무관하게 통째로 null(skip)
// 처리해버린다(실측: 글롭 루트 `app` 아래 `app/node_modules/...`가 깊이상한을 넘으면
// `app/**/*.ts` 정답 2도 함께 skip — node_modules가 글롭 루트의 형제일 뿐이면 애초에 방문되지
// 않으므로 이 결함이 재현되지 않는다). 여기 걸러낸 디렉토리는 진입 자체를 안 하므로 기여분이
// "미확인"이 아니라 확정 0으로 취급된다 — 이 상한 뒤에도 걸러지지 않은(=진짜 매치 후보일 수
// 있는) 서브트리가 깊이상한을 넘기면 여전히 null로 남는다.
//
// `dist`·`build`·`out`·`coverage`·`vendor`는 의도적으로 제외했다 — 이 이름들은 빌드 산출물이
// 아니라 소스 하위 디렉토리 이름으로도 흔히 쓰여, 걸러내면 그 안의 실제 매치 대상 파일이
// 조용히 과소집계된다(예: `app/dist/foo.js`가 실제 소스, `x/build/only.ts`가 유일한 정답인 경우
// 등). 반면 여기 남긴 이름들은 실측상 전부 `node_modules` 하위 산출물이거나(`.cache` 등) 소스일
// 여지가 없는 도구 전용 디렉토리(`.git`·`__pycache__` 등)라 안전하다.
const PRUNED_DIR_NAMES = new Set([
  'node_modules', '.git', '.venv', '__pycache__', '.parcel-cache',
  '.next', '.nuxt', '.turbo', '.svelte-kit', '.cache', '.output',
])

/**
 * `**`가 포함된 glob 패턴을 실제로 재귀 지원한다. 예전에는 `**`가 dirname()/basename()으로
 * 쪼개질 때 존재하지 않는 리터럴 디렉토리 `**`로 해석돼 항상 measure 실패 → skip 처리됐다
 * (드리프트가 있어도 "측정 불가"로 조용히 넘어가 눈에 띄지 않았다). 이제는 `**`를 "0개 이상의
 * 하위 디렉토리"로 실제로 펼쳐서 센다.
 *
 * 루트(첫 와일드카드 세그먼트 이전의 리터럴 경로)가 존재하지 않으면 기존 규약과 동일하게
 * null(측정 불가 → skip)을 반환한다 — 재귀 매칭 결과 0건인 것과는 다른 상태다(후자는 진짜
 * 드리프트일 수 있는 정상 측정치 0).
 *
 * 연속된 `**`(예: `src/**\/**\/*.ts`)는 하나로 접는다 — 접지 않으면 같은 하위 트리를 두 '**'
 * 분기가 각각 따로 밟아 파일이 중복으로 세어진다. 접은 뒤에는 `src/**\/*.ts`와 동일해진다.
 *
 * 깊이 상한(GLOB_RECURSION_DEPTH_CAP)에 걸려 일부 경로를 못 센 경우는 부분 카운트를 그대로
 * 반환하지 않고 null(측정 불가)로 취급한다 — 안 그러면 "일부만 세고 잘린 값"이 정상 측정치처럼
 * 보여 거짓 드리프트(또는 거짓 통과)를 만든다.
 */
function countGlobRecursive(baseDir, pattern) {
  const segments = pattern.split('/').filter((seg, i, arr) => !(seg === '**' && arr[i - 1] === '**'))
  const firstWildcardIdx = segments.findIndex((s) => s.includes('*'))
  const literalPrefix = firstWildcardIdx === -1 ? segments.slice(0, -1) : segments.slice(0, firstWildcardIdx)
  const rootDir = literalPrefix.length ? join(baseDir, ...literalPrefix) : baseDir
  if (!existsSync(rootDir)) return null

  let count = 0
  let truncated = false

  // '**'가 패턴의 마지막 세그먼트일 때: 표준 glob 의미론상 `dir/**`는 dir 이하 모든 파일(임의
  // 깊이)과 일치한다. walk()의 일반 분기(다음 세그먼트로 넘어가며 '**'를 소비)로는 "다음 세그먼트가
  // 없다"는 이 경우를 셀 수 없으므로(segIdx+1이 배열 끝을 넘어가 즉시 종료됨) 별도로 전량을 센다.
  function countAllFiles(dir, depth) {
    if (depth > GLOB_RECURSION_DEPTH_CAP) { truncated = true; return }
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.isFile()) count++
      else if (e.isDirectory() && !PRUNED_DIR_NAMES.has(e.name)) countAllFiles(join(dir, e.name), depth + 1)
    }
  }

  function walk(curDir, segIdx, depth) {
    if (depth > GLOB_RECURSION_DEPTH_CAP) { truncated = true; return }
    const seg = segments[segIdx]
    if (seg === undefined) return
    let entries
    try { entries = readdirSync(curDir, { withFileTypes: true }) } catch { return }
    if (seg === '**') {
      if (segIdx === segments.length - 1) { countAllFiles(curDir, depth); return }
      walk(curDir, segIdx + 1, depth)              // '**'가 0개 디렉토리를 소비하는 경우
      for (const e of entries) {
        if (e.isDirectory() && !PRUNED_DIR_NAMES.has(e.name)) walk(join(curDir, e.name), segIdx, depth + 1) // 1개 더 내려가며 '**' 유지
      }
      return
    }
    const re = globSegmentRe(seg)
    const isLast = segIdx === segments.length - 1
    for (const e of entries) {
      if (!re.test(e.name)) continue
      if (isLast) { if (e.isFile()) count++ }
      else if (e.isDirectory()) walk(join(curDir, e.name), segIdx + 1, depth + 1)
    }
  }
  walk(rootDir, literalPrefix.length, 0)
  return truncated ? null : count
}

function countGlob(baseDir, pattern) {
  if (pattern.includes('**')) return countGlobRecursive(baseDir, pattern)
  const dir = join(baseDir, dirname(pattern))
  const fnPat = basename(pattern)
  const re = globSegmentRe(fnPat)
  try { return readdirSync(dir).filter((f) => re.test(f)).length } catch { return null }
}

function measure(check, cwd) {
  try {
    if (check.glob) return countGlob(cwd, check.glob)
    if (check.homeGlob) return countGlob(homedir(), check.homeGlob)
    if (check.jsonLength) {
      const j = JSON.parse(readFileSync(join(cwd, check.jsonLength), 'utf8'))
      if (Array.isArray(j)) return j.length
      if (j && typeof j === 'object') return Object.keys(j).length
      return null
    }
    if (check.file && check.regex) {
      const s = readFileSync(join(cwd, check.file), 'utf8')
      return (s.match(new RegExp(check.regex, 'g')) || []).length
    }
  } catch { return null }
  return null
}

/**
 * cwd 프로젝트의 매니페스트로 드리프트 계산. 매니페스트 없으면 null(=체크 대상 아님).
 * checks가 빈 배열이면(스캐폴딩 직후 등 아직 아무도 채우지 않은 상태) `empty: true`를 반환한다 —
 * 이 경우 drift/skipped 모두 빈 배열이라 "검사해서 이상 없음"과 구분되지 않았고, 그 결과
 * 호출부가 실제로는 아무것도 측정하지 않았는데 통과(✅)로 보고했다. `empty` 플래그로 호출부가
 * 그 둘을 구분해 보고할 수 있게 한다.
 */
export function computeDrift(cwd = process.cwd()) {
  let manifest
  try { manifest = JSON.parse(readFileSync(join(cwd, '.claude', 'doc-drift.json'), 'utf8')) } catch { return null }
  const checks = Array.isArray(manifest.checks) ? manifest.checks : []
  const results = [], drift = [], skipped = []
  for (const c of checks) {
    const actual = measure(c, cwd)
    if (actual == null) { skipped.push(c.label); continue }
    results.push({ label: c.label, expected: c.expected, actual })
    if (actual !== c.expected) drift.push(`${c.label}: 문서=${c.expected} ↔ 실측=${actual}`)
  }
  return { results, drift, skipped, empty: checks.length === 0 }
}

/**
 * checkPmBlockImport() — CLAUDE.md 의 PM 행동규율 `@import` 줄이 실제 malgn-agent 설치 경로와
 * 여전히 일치하는지 수동 점검한다(docs/decision/malgnai-hub-project-bootstrap-redesign.md §4-5).
 *
 * SessionStart 훅(자동)은 없앴지만, `pnpm run check-docs`로 수동 확인은 남겨둬 `@import`가 조용히
 * 깨졌을 때(마켓플레이스 별칭 변경, external-import 승인 거절 후 방치 등) 감지할 방법을 하나는
 * 남긴다. import 줄 자체가 없으면(미설치 상태 — 이 저장소 자신 포함) 점검 대상이 아니므로 null을
 * 반환해 조용히 스킵한다 — 강제 설치를 유도하지 않는다.
 */
export function checkPmBlockImport(cwd = process.cwd()) {
  let claudeMd
  try { claudeMd = readFileSync(join(cwd, 'CLAUDE.md'), 'utf8') } catch { return null }
  const IMPORT_LINE_RE = /^@(.+pm-orchestration-block\.md)\s*$/m
  const m = claudeMd.match(IMPORT_LINE_RE)
  if (!m) return null // import 줄 자체가 없으면(미설치 상태 — 이 저장소 자신 포함) 점검 대상 아님, 강제하지 않는다
  let resolved
  try { resolved = findMalgnAgentBlockPath() } catch { resolved = null }
  if (resolved === AMBIGUOUS) return { status: 'ambiguous', message: 'malgn-agent 마켓플레이스 후보가 2개 이상이라 경로를 하나로 특정할 수 없다.' }
  if (!resolved) return { status: 'plugin-missing', message: 'malgn-agent 플러그인 원본을 찾을 수 없다(마켓플레이스 제거/미등록 가능성).' }
  // import 줄은 `~/...`(홈 상대, 이식 가능한 형태) 또는 옛 방식의 절대경로 둘 다일 수 있다.
  // expandHome()으로 현재 PC 기준 절대경로로 편 뒤 비교해야 `~/...`로 정상 설치된 경우를
  // 드리프트로 오판하지 않는다.
  if (expandHome(m[1]) !== resolved) return { status: 'drift', message: `import 경로(${m[1]}) != 현재 설치 경로(${resolved}) — Edit로 교정 필요.` }
  return { status: 'ok' }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cwd = process.argv[2] || process.cwd()
  const r = computeDrift(cwd)
  if (!r) { console.log('(.claude/doc-drift.json 없음 — 드리프트 체크 대상 아님)'); }
  else if (r.empty) {
    // checks가 비어 있으면 results/drift/skipped 모두 빈 배열이라, 아래 "✅ 문서가 코드와 일치"와
    // 겉으로 구분이 안 됐다 — 실제로는 아무것도 측정하지 않았을 뿐인데 통과처럼 보였다.
    console.log('  ℹ️ .claude/doc-drift.json의 checks가 비어 있다 — 아직 아무것도 검사하지 않았다(통과가 아니다). 매니페스트를 채우면 실제 대조가 시작된다.')
  } else {
    for (const x of r.results) console.log(`  ${x.actual === x.expected ? '✅' : '⚠️'} ${x.label}: 문서=${x.expected} 실측=${x.actual}`)
    if (r.skipped.length) console.log('  (skip, 측정불가:', r.skipped.join(', ') + ')')
  }

  // PM 행동규율 @import 드리프트는 doc-drift.json 매니페스트 유무와 무관하게 항상 점검한다
  // (§4-5) — 단, sessionstart-context.mjs 는 computeDrift() 만 import 해서 쓰므로 이 CLI 블록
  // 자체가 여기 있다는 사실만으로 "자동 세션 점검엔 포함 안 됨"이 구조적으로 보장된다.
  const pmCheck = checkPmBlockImport(cwd)
  if (pmCheck) {
    console.log(pmCheck.status === 'ok' ? '  ✅ PM 행동규율 @import 정상' : `  ⚠️ PM 행동규율 @import: ${pmCheck.message}`)
  }

  const hasDrift = !!(r && r.drift.length)
  const hasPmIssue = !!(pmCheck && pmCheck.status !== 'ok')
  if (hasDrift) console.log('\n⚠️ 문서 드리프트 — 매니페스트 expected 와 문서 서술을 실측에 맞춰 갱신하라.')
  if (!hasDrift && !hasPmIssue && r && !r.empty) console.log('\n✅ 문서가 코드와 일치.')
  process.exit(hasDrift || hasPmIssue ? 1 : 0)
}
