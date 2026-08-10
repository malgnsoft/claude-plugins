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
 *   glob      — cwd 기준 "dir/패턴(*포함)" 파일 수
 *   homeGlob  — $HOME 기준 glob (러너·전역에이전트 등 프로젝트 밖)
 *   jsonLength— JSON 파일 파싱 후 배열 길이(또는 객체 키 수)
 *   file+regex— 파일 내 정규식 전역 매치 수
 *   측정 불가(경로 없음/다른 호스트) → 해당 check skip(드리프트 아님).
 *
 * 사용: node <malgn-agent 플러그인 경로>/hooks/doc-drift.mjs [projectDir]   (기본 cwd)
 * 재사용: import { computeDrift } from '.../doc-drift.mjs'
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { findMalgnAgentBlockPath, AMBIGUOUS } from './lib/find-pm-block-path.mjs'

function countGlob(baseDir, pattern) {
  const dir = join(baseDir, dirname(pattern))
  const fnPat = basename(pattern)
  const re = new RegExp('^' + fnPat.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
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

/** cwd 프로젝트의 매니페스트로 드리프트 계산. 매니페스트 없으면 null(=체크 대상 아님). */
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
  return { results, drift, skipped }
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
  if (resolved !== m[1]) return { status: 'drift', message: `import 경로(${m[1]}) != 현재 설치 경로(${resolved}) — Edit로 교정 필요.` }
  return { status: 'ok' }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cwd = process.argv[2] || process.cwd()
  const r = computeDrift(cwd)
  if (!r) { console.log('(.claude/doc-drift.json 없음 — 드리프트 체크 대상 아님)'); }
  else {
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
  if (!hasDrift && r) console.log('\n✅ 문서가 코드와 일치.')
  process.exit(hasDrift || hasPmIssue ? 1 : 0)
}
