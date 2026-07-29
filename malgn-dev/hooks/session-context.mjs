#!/usr/bin/env node
/**
 * session-context.mjs — 전역 SessionStart 훅 컨텍스트 프로바이더 (모든 프로젝트 공통).
 *
 * 새 세션에 L0 컨텍스트를 주입한다:
 *   1) cwd 의 STATUS.md (있으면) — 라이브 상태 단일 소스
 *   2) 문서 드리프트 경고 — .claude/doc-drift.json 이 있고 코드와 어긋날 때만
 *      (일치하면 아무것도 안 붙임 = 0토큰. 최소 토큰으로 정확성 보증.)
 *
 * STATUS.md 도 매니페스트도 없는 프로젝트면 빈 컨텍스트(무해). 어떤 오류도 세션을 막지 않는다.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function emit(ctx) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx || '' },
  }))
}

try {
  const cwd = process.cwd()
  let status = ''
  try { status = readFileSync(join(cwd, 'STATUS.md'), 'utf8') } catch {}

  let note = ''
  try {
    const { computeDrift } = await import(join(dirname(fileURLToPath(import.meta.url)), 'doc-drift.mjs'))
    const r = computeDrift(cwd)
    if (r && r.drift.length) {
      note = '\n\n⚠️ **문서 드리프트 감지** (문서가 코드와 불일치 — 코드가 진실):\n' +
        r.drift.map((d) => '  - ' + d).join('\n') +
        '\n오리엔테이션 시 실측값을 신뢰하고, 여유 될 때 `pnpm run check-docs` 후 문서를 갱신하라.'
    }
  } catch {}

  const head = status
    ? '프로젝트 진행 상태 (STATUS.md) — 세션 시작 시 자동 주입됨. 사용자가 부르면 이 내용을 먼저 요약해 보고할 것:\n\n' + status
    : ''
  emit(head + note)
} catch {
  emit('')
}
