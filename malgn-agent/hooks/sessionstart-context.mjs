#!/usr/bin/env node
/**
 * sessionstart-context.mjs — 전역 SessionStart 훅 컨텍스트 프로바이더 (모든 프로젝트 공통).
 *
 * 새 세션에 L0 컨텍스트를 주입한다:
 *   1) cwd 의 STATUS.md (있으면) — 라이브 상태 단일 소스. **상한 안에서만** 주입한다(아래).
 *
 * STATUS.md 가 없는 프로젝트면 빈 컨텍스트(무해). 어떤 오류도 세션을 막지 않는다.
 *
 * ── 주입량 상한 (2026-08-24 추가) ─────────────────────────────────────────────
 * 이 훅은 전 직원의 **모든 프로젝트, 모든 세션**에 걸리므로 비용이 곱해진다. 그런데 종전에는
 * STATUS.md 를 크기 무관하게 통째로 넣었다 — 실측으로 61,369B(약 1.5만 토큰)가 한 번에 들어간
 * 세션이 있었다. 이건 L0 오리엔테이션(현 운영 모드·열린 것·다음 행동)에 필요한 양을 한참 넘고,
 * 컨텍스트가 길수록 정확도가 떨어진다(context rot). 그래서 상한을 두고 **앞부분만** 넣는다.
 *
 *   - 왜 앞부분인가: STATUS.md 규약(이 제품의 skills/project-standards §3)이 최신 상태를 위에,
 *     지나간 라운드 이력을 아래에 쌓게 한다. 앞부분이 곧 L0 신호다.
 *   - 왜 요약이 아닌가: 훅은 모델이 아니라 node 프로세스다. 여기서 "요약"은 결국 임의 절단인데,
 *     절단을 요약이라 부르면 무엇이 빠졌는지 아무도 모른다. 자른 사실을 그대로 말하는 편이 정직하다.
 *   - **조용히 자르지 않는다**: 잘렸을 때는 (a) 주입 본문 맨 앞과 잘린 지점에 경고를 넣어 모델이
 *     알게 하고 (b) systemMessage 로 사람에게도 보여준다. 남은 부분을 어떻게 읽는지도 같이 준다.
 *   - 줄 경계에서 자른다: 바이트 중간을 자르면 한글이 깨지고 표·코드펜스가 반쪽 난다.
 *   - 상한이 안 맞는 프로젝트는 MALGN_STATUS_MAX_BYTES 환경변수로 조정한다(0 = 무제한).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DEFAULT_MAX_BYTES = 12000

function maxBytes() {
  const raw = process.env.MALGN_STATUS_MAX_BYTES
  if (raw === undefined || raw === '') return DEFAULT_MAX_BYTES
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_BYTES // 오설정은 기본값으로 — 세션을 막지 않는다
  return n // 0 = 무제한(종전 동작)
}

const bytes = (s) => Buffer.byteLength(s, 'utf8')

/** 상한 이내가 되도록 줄 단위로 앞에서부터 담는다. { text, truncated, keptBytes, totalBytes, keptLines, totalLines } */
function clip(status, limit) {
  const total = bytes(status)
  const lines = status.split('\n')
  if (limit === 0 || total <= limit) {
    return { text: status, truncated: false, keptBytes: total, totalBytes: total, keptLines: lines.length, totalLines: lines.length }
  }
  const kept = []
  let used = 0
  for (const line of lines) {
    const cost = bytes(line) + 1 // 줄바꿈 1바이트
    if (used + cost > limit) break
    kept.push(line)
    used += cost
  }
  return {
    text: kept.join('\n'),
    truncated: true,
    keptBytes: used,
    totalBytes: total,
    keptLines: kept.length,
    totalLines: lines.length,
  }
}

function emit(ctx, systemMessage) {
  const out = {
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx || '' },
  }
  if (systemMessage) out.systemMessage = systemMessage
  process.stdout.write(JSON.stringify(out))
}

try {
  const cwd = process.cwd()
  let status = ''
  try { status = readFileSync(join(cwd, 'STATUS.md'), 'utf8') } catch {}

  let head = ''
  let userMsg = ''
  if (status) {
    const c = clip(status, maxBytes())
    const banner = '프로젝트 진행 상태 (STATUS.md) — 세션 시작 시 자동 주입됨. 사용자가 부르면 이 내용을 먼저 요약해 보고할 것:'
    if (!c.truncated) {
      head = banner + '\n\n' + c.text
    } else {
      const kb = (n) => (n / 1024).toFixed(1) + 'KB'
      head =
        banner + '\n\n' +
        '⚠️ **이 STATUS.md 는 잘려서 주입됐다** — 전체 ' + c.totalBytes + 'B(' + kb(c.totalBytes) + ', ' + c.totalLines + '줄) 중 ' +
        '앞 ' + c.keptBytes + 'B(' + kb(c.keptBytes) + ', ' + c.keptLines + '줄)만 들어왔다(주입 상한 ' + maxBytes() + 'B).\n' +
        '아래 내용이 파일의 전부라고 가정하지 마라. 뒷부분이 필요하면 `Read` 로 `STATUS.md` 를 ' +
        'offset ' + (c.keptLines + 1) + ' 부터 직접 열어라. 근본 해법은 파일을 줄이는 것이다 — ' +
        '지나간 라운드 이력·완료 항목은 `docs/archive/` 로 옮기고 STATUS.md 에는 그 위치만 남긴다.\n\n' +
        c.text +
        '\n\n⚠️ **여기서 잘렸다** (' + c.keptLines + '/' + c.totalLines + '줄). 이 아래는 주입되지 않았다.'
      userMsg =
        'STATUS.md 가 커서 잘라서 주입했다: ' + kb(c.totalBytes) + ' 중 앞 ' + kb(c.keptBytes) + '만 주입 ' +
        '(' + c.keptLines + '/' + c.totalLines + '줄, 상한 ' + maxBytes() + 'B). ' +
        '지나간 이력을 docs/archive/ 로 옮겨 STATUS.md 를 L0 크기로 줄이는 것을 권한다. ' +
        '상한 조정은 MALGN_STATUS_MAX_BYTES 환경변수.'
    }
  }
  emit(head, userMsg)
} catch {
  emit('')
}
