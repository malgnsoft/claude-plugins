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

/**
 * `**`가 포함된 glob 패턴을 실제로 재귀 지원한다. 예전에는 `**`가 dirname()/basename()으로
 * 쪼개질 때 존재하지 않는 리터럴 디렉토리 `**`로 해석돼 항상 measure 실패 → skip 처리됐다
 * (드리프트가 있어도 "측정 불가"로 조용히 넘어가 눈에 띄지 않았다). 이제는 `**`를 "0개 이상의
 * 하위 디렉토리"로 실제로 펼쳐서 센다.
 *
 * 루트(첫 와일드카드 세그먼트 이전의 리터럴 경로)가 존재하지 않으면 기존 규약과 동일하게
 * null(측정 불가 → skip)을 반환한다 — 재귀 매칭 결과 0건인 것과는 다른 상태다(후자는 진짜
 * 드리프트일 수 있는 정상 측정치 0).
 */
function countGlobRecursive(baseDir, pattern) {
  const segments = pattern.split('/')
  const firstWildcardIdx = segments.findIndex((s) => s.includes('*'))
  const literalPrefix = firstWildcardIdx === -1 ? segments.slice(0, -1) : segments.slice(0, firstWildcardIdx)
  const rootDir = literalPrefix.length ? join(baseDir, ...literalPrefix) : baseDir
  if (!existsSync(rootDir)) return null

  let count = 0
  function walk(curDir, segIdx, depth) {
    if (depth > GLOB_RECURSION_DEPTH_CAP) return
    const seg = segments[segIdx]
    if (seg === undefined) return
    let entries
    try { entries = readdirSync(curDir, { withFileTypes: true }) } catch { return }
    if (seg === '**') {
      walk(curDir, segIdx + 1, depth)              // '**'가 0개 디렉토리를 소비하는 경우
      for (const e of entries) {
        if (e.isDirectory()) walk(join(curDir, e.name), segIdx, depth + 1) // 1개 더 내려가며 '**' 유지
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
  return count
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
