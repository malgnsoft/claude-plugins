#!/usr/bin/env node
/**
 * pm-orchestration-nudge.mjs — 전역 SessionStart 훅, PM 행동규율 블록 설치 안내 (모든 프로젝트 공통).
 *
 * cwd 의 CLAUDE.md 에 malgn-agent PM 행동규율 블록이 설치돼 있는지 마커로 감지한다:
 *   - 설치됨: <!-- malgn-agent:pm-orchestration:v1 -->
 *   - 거절함: <!-- malgn-agent:pm-orchestration:declined:v1 -->
 * 둘 다 없으면, 모델에게 AskUserQuestion 으로 사용자에게 설치 여부를 물어보고
 * 답에 따라 Edit 으로 마커를 남기라는 절차 안내만 주입한다.
 *
 * 이 훅 스크립트 자신은 어떤 파일도 절대 쓰지 않는다(동의 없는 자동 파일수정 방지 — 확정 안전장치).
 * 블록의 실제 내용은 이 훅에 하드코딩하지 않고 같은 디렉토리의 pm-orchestration-block.md 에서 읽어온다.
 *
 * CLAUDE.md 가 없거나 어떤 오류가 나도 세션을 막지 않는다.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const INSTALLED_MARKER = '<!-- malgn-agent:pm-orchestration:v1 -->'
const DECLINED_MARKER = '<!-- malgn-agent:pm-orchestration:declined:v1 -->'

function emit(ctx) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx || '' },
  }))
}

try {
  const cwd = process.cwd()
  let claudeMd = ''
  try { claudeMd = readFileSync(join(cwd, 'CLAUDE.md'), 'utf8') } catch {}

  if (claudeMd.includes(INSTALLED_MARKER) || claudeMd.includes(DECLINED_MARKER)) {
    emit('')
  } else {
    let block = ''
    try {
      block = readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), 'pm-orchestration-block.md'),
        'utf8'
      )
    } catch {}

    const blockSection = block
      ? '아래는 설치할 블록의 정확한 전문이다 — 이 텍스트를 그대로(창작·요약·수정 없이) CLAUDE.md에 추가한다:\n\n' +
        '```markdown\n' + block + '\n```\n\n'
      : '(블록 파일을 읽지 못했다 — 배포 누락일 수 있다. 이번 세션에서는 설치를 진행하지 말고 이 사실만 사용자에게 알린다.)\n\n'

    emit(
      '이 프로젝트의 CLAUDE.md에는 아직 malgn-agent PM 행동규율 블록이 설치돼 있지 않다.\n' +
      '이번 세션에서 아직 사용자에게 물어보지 않았다면, AskUserQuestion으로 설치 여부를 확인할 것:\n\n' +
      blockSection +
      '  - "예": Edit 도구로 위 블록 전문을 CLAUDE.md에 그대로 추가한다(마커 포함, 텍스트 변형 금지).\n' +
      '  - "아니오": Edit 도구로 CLAUDE.md에 거절 마커만 남긴다: ' +
      `\`${DECLINED_MARKER}\`\n` +
      '이미 이번 세션에서 물어봤다면 다시 묻지 말 것.'
    )
  }
} catch {
  emit('')
}
