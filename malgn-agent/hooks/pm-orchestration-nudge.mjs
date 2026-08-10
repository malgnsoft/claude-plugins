#!/usr/bin/env node
/**
 * pm-orchestration-nudge.mjs — 전역 SessionStart 훅, PM 행동규율 블록 설치/최신화 안내 (모든 프로젝트 공통).
 *
 * cwd 의 CLAUDE.md 에서 상태 마커를 정규식으로 파싱한다:
 *   - 무마커            : 아직 물어본 적 없음 → AskUserQuestion 넛지
 *   - installed:vX      : 설치 동의함 → 매 세션 pm-orchestration-block.md 본문을 조용히 상시 주입
 *     (구버전 마커 `pm-orchestration:vX`도 하위호환으로 installed 취급 — "installed:" 리터럴이 없던 리팩터 이전 형태)
 *   - declined:vX       : 거절함 → block.md 의 현재 버전 N 이 X 보다 크면(=의무 내용 개정) 1회 재넛지, 아니면 무동작
 *
 * 설계 원칙(2026-08-10 architect 검토, docs/decision/pm-orchestration-block-sync-strategy.md):
 * CLAUDE.md 에는 "마커만" 남기고 블록 **본문은 절대 복사하지 않는다**. 본문은 항상 이 훅이 매 세션
 * pm-orchestration-block.md 에서 직접 읽어 주입하므로, 플러그인 쪽 원문이 개정되면 다음 세션부터 자동으로
 * 최신 내용이 반영된다 — CLAUDE.md 안에 stale copy 가 생길 여지 자체가 없다.
 *
 * 이 훅 스크립트 자신은 어떤 파일도 절대 쓰지 않는다(동의 없는 자동 파일수정 방지 — 확정 안전장치, 변경 금지).
 * CLAUDE.md 가 없거나 어떤 오류가 나도 세션을 막지 않는다.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// CLAUDE.md 안의 상태 마커: <!-- malgn-agent:pm-orchestration:installed:v1 --> / :declined:v1
// 하위호환: 이번 리팩터 이전에 설치된 구버전 마커는 "installed:" 리터럴 없이 그냥 <!-- malgn-agent:pm-orchestration:v1 --> 형태다.
// (installed|declined): 부분을 옵션으로 두어 구버전도 매치하고, state 미캡처 시 'installed'로 취급한다.
const STATE_MARKER_RE = /<!--\s*malgn-agent:pm-orchestration:(?:(installed|declined):)?v(\d+)\s*-->/
// pm-orchestration-block.md 안의 버전 마커(그 파일이 버전의 단일 소스): <!-- malgn-agent:pm-orchestration:version:1 -->
const BLOCK_VERSION_RE = /<!--\s*malgn-agent:pm-orchestration:version:(\d+)\s*-->/

function emit(ctx) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx || '' },
  }))
}

function readBlockFile() {
  const raw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), 'pm-orchestration-block.md'),
    'utf8'
  )
  const m = raw.match(BLOCK_VERSION_RE)
  if (!m) return null
  const version = Number(m[1])
  // 본문 = 버전 마커가 있는 줄 다음부터 (그 위의 버전규칙 설명 주석, 마커 줄 자체는 제외)
  const markerLineEnd = raw.indexOf('\n', m.index)
  const body = (markerLineEnd === -1 ? '' : raw.slice(markerLineEnd + 1)).trim()
  return { version, body }
}

function installMarkerFor(version) {
  return `<!-- malgn-agent:pm-orchestration:installed:v${version} -->`
}
function declinedMarkerFor(version) {
  return `<!-- malgn-agent:pm-orchestration:declined:v${version} -->`
}

function askInstallNudge(block, { reinstall } = {}) {
  const blockSection = block
    ? '아래는 현재 블록의 본문이다(참고용 — CLAUDE.md에는 절대 복사하지 말 것, 마커 한 줄만 남긴다):\n\n' +
      '```markdown\n' + block.body + '\n```\n\n'
    : '(블록 파일을 읽지 못했다 — 배포 누락일 수 있다. 이번 세션에서는 설치를 진행하지 말고 이 사실만 사용자에게 알린다.)\n\n'

  const intro = reinstall
    ? `이 프로젝트는 이전에 malgn-agent PM 행동규율 설치를 거절했다(v${reinstall.oldVersion}). ` +
      `이후 블록의 의무 내용이 v${reinstall.newVersion}으로 개정되었다 — 재확인이 필요하다.\n` +
      '이번 세션에서 아직 재확인을 묻지 않았다면, AskUserQuestion으로 설치 여부를 다시 확인할 것:\n\n'
    : '이 프로젝트의 CLAUDE.md에는 아직 malgn-agent PM 행동규율 마커가 설치돼 있지 않다.\n' +
      '이번 세션에서 아직 사용자에게 물어보지 않았다면, AskUserQuestion으로 설치 여부를 확인할 것:\n\n'

  const version = block ? block.version : (reinstall ? reinstall.newVersion : 1)

  return (
    intro +
    blockSection +
    '  - "예": CLAUDE.md에 malgn-agent:pm-orchestration 관련 마커가 이미 있으면(구버전 `:vN` 형태든, `installed:vN`/`declined:vN` 형태든 무엇이든 상관없이) Edit 도구로 그 마커를 제거하고, 아래 마커 한 줄로 교체한다(본문 전문은 복사하지 않는다):\n' +
    `    \`${installMarkerFor(version)}\`\n` +
    '  - "아니오": CLAUDE.md에 malgn-agent:pm-orchestration 관련 마커가 이미 있으면(구버전/installed/declined 어떤 형태든) Edit 도구로 그 마커를 제거하고, 아래 거절 마커로 교체한다:\n' +
    `    \`${declinedMarkerFor(version)}\`\n` +
    '이미 이번 세션에서 물어봤다면 다시 묻지 말 것.'
  )
}

try {
  const cwd = process.cwd()
  let claudeMd = ''
  try { claudeMd = readFileSync(join(cwd, 'CLAUDE.md'), 'utf8') } catch {}

  const stateMatch = claudeMd.match(STATE_MARKER_RE)

  if (!stateMatch) {
    // 무마커: 아직 물어본 적 없음 → 넛지
    let block = null
    try { block = readBlockFile() } catch {}
    emit(askInstallNudge(block))
  } else {
    const [, stateCaptured, versionStr] = stateMatch
    const state = stateCaptured || 'installed' // 구버전 마커(:vN, "installed:" 리터럴 없음)는 installed로 취급
    const markedVersion = Number(versionStr)

    if (state === 'installed') {
      // 설치 동의됨: 조용히 매 세션 최신 본문을 상시 주입 (재넛지·버전 비교 없음)
      let block = null
      try { block = readBlockFile() } catch {}
      if (!block) {
        emit('')
      } else {
        emit(
          '다음은 malgn-agent 플러그인의 PM 행동 규율이다(이 프로젝트가 설치를 동의함 — 매 세션 플러그인 최신 내용을 읽어와 적용한다):\n\n' +
          block.body
        )
      }
    } else {
      // declined: 블록이 그 이후 개정되었으면(현재 버전 > 거절 당시 버전) 1회 재넛지
      let block = null
      try { block = readBlockFile() } catch {}
      if (block && block.version > markedVersion) {
        emit(askInstallNudge(block, { reinstall: { oldVersion: markedVersion, newVersion: block.version } }))
      } else {
        emit('')
      }
    }
  }
} catch {
  emit('')
}
