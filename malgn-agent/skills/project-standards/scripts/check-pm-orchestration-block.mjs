#!/usr/bin/env node
/**
 * check-pm-orchestration-block.mjs — PM 행동규율 블록(@import) 온디맨드 재확인/재설치 점검.
 *
 * project-standards 스킬 §9 "PM 행동규율 블록 재확인/재설치 — 온디맨드" 절차가 호출한다.
 * 트리거는 사용자의 명시적 요청뿐이다("PM 행동규율 다시 확인해줘" 류) — 매 세션 자동 실행이
 * 아니다. SessionStart 훅(구 pm-orchestration-nudge.mjs)이 하던 상시 감시는 이 스크립트로
 * "대체"된 것이 아니라 그냥 없앴다 — 이 스크립트는 사용자가 명시적으로 물었을 때만 실행되는
 * 완전히 다른 실행 모델이다(docs/decision/malgnai-hub-project-bootstrap-redesign.md §4-1, §4-3).
 *
 * 경로 계산(findMalgnAgentBlockPath/AMBIGUOUS/readBlockFile/마커 정규식)은
 * ../../../hooks/lib/find-pm-block-path.mjs 로 위임한다 — 세 소비자(이 스크립트,
 * bin/new-project.mjs, hooks/doc-drift.mjs)가 완전히 동일한 알고리즘을 공유해야 드리프트
 * 판정과 설치 결과가 항상 일치한다(§4-4).
 *
 * 이 스크립트는 어떤 파일도 쓰지 않는다. cwd의 CLAUDE.md를 읽어 현재 상태를 판정하고, 사람이
 * 읽을 수 있는 안내문(구 pm-orchestration-nudge.mjs 의 askInstallNudge() 등 안내문 생성 로직을
 * 온디맨드용으로 정리한 것)을 stdout에 출력할 뿐이다 — 실제 CLAUDE.md 수정(Edit)은 이 스크립트를
 * 호출한 Claude 세션이 SKILL.md §9 절차를 따라 직접 수행한다("훅/스크립트는 파일을 쓰지 않는다"
 * 불변식, 구 훅과 동일).
 *
 * 사용: node "${CLAUDE_PLUGIN_ROOT}/skills/project-standards/scripts/check-pm-orchestration-block.mjs" [cwd]
 *       (이 변수는 스킬·에이전트 본문과 훅 커맨드에서 치환되고, 이 파일을 Read로 열면 문자 그대로다 — 셸 변수가 아니다.
 *        커맨드 정본은 Skill project-standards §9 참조)
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  STATE_MARKER_RE,
  IMPORT_LINE_RE,
  AMBIGUOUS,
  readBlockFile,
  findMalgnAgentBlockPath,
} from '../../../hooks/lib/find-pm-block-path.mjs'

function installMarkerFor(version) {
  return `<!-- malgn-agent:pm-orchestration:installed:v${version} -->`
}
function declinedMarkerFor(version) {
  return `<!-- malgn-agent:pm-orchestration:declined:v${version} -->`
}

const REMOVE_OLD_MARKERS_STEP =
  'CLAUDE.md 전체에서 `<!-- malgn-agent:pm-orchestration:(installed|declined)?:?v\\d+ -->` 형태의 줄(구버전 포함)과, ' +
  '`@`로 시작하며 `pm-orchestration-block.md`로 끝나는 줄을 모두 찾아 제거한다(몇 개가 있든, 어디에 있든).'

function print(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n')
}

const cwd = process.argv[2] || process.cwd()
const claudeMdPath = join(cwd, 'CLAUDE.md')

let claudeMd
try {
  claudeMd = readFileSync(claudeMdPath, 'utf8')
} catch {
  print({
    status: 'no-claude-md',
    message: `${claudeMdPath} 를 찾을 수 없다 — 이 cwd는 점검 대상이 아니다.`,
  })
  process.exit(0)
}

let resolvedPath = null
try { resolvedPath = findMalgnAgentBlockPath() } catch { resolvedPath = null }
const resolvedPathLabel = resolvedPath === AMBIGUOUS ? 'AMBIGUOUS' : resolvedPath

let block = null
try { block = readBlockFile() } catch {}

const stateMatch = claudeMd.match(STATE_MARKER_RE)

// --- 1. 마커 자체가 없음 — 설치 여부를 사용자에게 물어야 한다(§9 2단계). ---
if (!stateMatch) {
  print({
    status: 'no-marker',
    message: '이 프로젝트 CLAUDE.md에는 아직 PM 행동규율 마커가 없다.',
    blockVersion: block ? block.version : null,
    resolvedPath: resolvedPathLabel,
    nextAction: block
      ? 'AskUserQuestion으로 설치 여부를 물을 것. "예": ' + REMOVE_OLD_MARKERS_STEP +
        ` 그 자리(또는 파일 끝)에 \`${installMarkerFor(block.version)}\` 줄과 그다음 줄에 ` +
        `\`@${resolvedPathLabel}\` 줄을 삽입한다(resolvedPath가 AMBIGUOUS/null이면 경로 확정 전까지 삽입하지 말고 사용자에게 알린다). ` +
        `"아니오": ${REMOVE_OLD_MARKERS_STEP} 그 자리에 \`${declinedMarkerFor(block.version)}\` 마커만 삽입한다(import 줄 없이).`
      : 'pm-orchestration-block.md를 읽지 못했다(배포 누락 가능성) — 이번에는 설치를 진행하지 말고 사용자에게 이 사실만 알린다.',
  })
  process.exit(0)
}

const [, stateCaptured, versionStr] = stateMatch
const state = stateCaptured || 'installed' // 구버전 마커(:vN, "installed:" 리터럴 없음)는 installed로 취급
const markedVersion = Number(versionStr)

// --- 2. declined 상태 — 사용자가 이번에 설치를 요청했을 때만 installed로 교체(§9 4단계). ---
if (state === 'declined') {
  const revisedSinceDecline = !!(block && block.version > markedVersion)
  print({
    status: 'declined',
    message: `이 프로젝트는 v${markedVersion}에서 PM 행동규율 설치를 거절했다.`,
    currentBlockVersion: block ? block.version : null,
    revisedSinceDecline,
    resolvedPath: resolvedPathLabel,
    nextAction: revisedSinceDecline
      ? `블록 내용이 v${markedVersion} → v${block.version}으로 개정되었다 — 재확인이 필요하다. 아직 이번 세션에 묻지 않았다면 AskUserQuestion으로 재설치 여부를 물을 것.`
      : '사용자가 이번에 설치를 요청하면(§9 트리거) declined 마커를 installed 마커+@import 줄로 교체한다. 요청이 없으면 그대로 둔다.',
  })
  process.exit(0)
}

// --- 3. installed 상태 — import 줄 존재/일치 여부로 4가지 케이스 분기(§9 3단계). ---
const importMatch = claudeMd.match(IMPORT_LINE_RE)
const importLine = importMatch ? importMatch[1] : null

if (!importLine) {
  print({
    status: 'legacy-no-import',
    message: `installed(v${markedVersion}) 마커는 있지만 @import 줄이 없다(구버전 설치, 마이그레이션 대상).`,
    resolvedPath: resolvedPathLabel,
    nextAction: resolvedPath && resolvedPath !== AMBIGUOUS
      ? `사용자 재동의 불필요(콘텐츠 변경 아님, 전달 방식만 바뀜) — findMalgnAgentBlockPath() 결과(${resolvedPath})로 마커 다음 줄에 ` +
        `\`@${resolvedPath}\` 를 추가한다.`
      : '경로를 확정할 수 없다(파일 없음 또는 ambiguous) — CLAUDE.md를 건드리지 말고 사용자에게 알린다.',
  })
} else if (resolvedPath === AMBIGUOUS) {
  print({
    status: 'ambiguous',
    message: '마켓플레이스 후보가 2개 이상이고 enabledPlugins로도 하나로 특정할 수 없다.',
    importLine,
    nextAction: '잘못된 경로로 덮어쓰지 않도록 CLAUDE.md를 건드리지 말고, 어느 마켓플레이스를 쓸지 사용자에게 직접 확인한다.',
  })
} else if (!resolvedPath) {
  print({
    status: 'plugin-missing',
    message: '@import 줄은 있지만 malgn-agent 플러그인 원본을 찾을 수 없다(마켓플레이스 미등록/제거 가능성).',
    importLine,
    nextAction: 'CLAUDE.md를 건드리지 말고 사용자에게 마켓플레이스 재등록이 필요할 수 있음을 알린다.',
  })
} else if (importLine !== resolvedPath) {
  print({
    status: 'drift',
    message: `import 경로(${importLine}) != 현재 설치 경로(${resolvedPath}).`,
    nextAction: `Edit로 CLAUDE.md의 기존 @import 줄만 `+`\`@${resolvedPath}\`` + `로 교체한다(마커 줄은 그대로 둔다, 사용자 재동의 불필요 — 경로 교정일 뿐).`,
  })
} else {
  print({
    status: 'ok',
    message: 'CLAUDE.md의 @import 경로가 현재 malgn-agent 설치 경로와 일치한다. 손댈 것 없음.',
    resolvedPath,
  })
}
