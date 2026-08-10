#!/usr/bin/env node
/**
 * pm-orchestration-nudge.mjs — 전역 SessionStart 훅, PM 행동규율 블록 설치/최신화 안내 (모든 프로젝트 공통).
 *
 * cwd 의 CLAUDE.md 에서 상태 마커를 정규식으로 파싱한다:
 *   - 무마커            : 아직 물어본 적 없음 → AskUserQuestion 넛지
 *   - installed:vX      : 설치 동의함 → 아래 §installed 4가지 케이스로 분기
 *     (구버전 마커 `pm-orchestration:vX`도 하위호환으로 installed 취급 — "installed:" 리터럴이 없던 리팩터 이전 형태)
 *   - declined:vX       : 거절함 → block.md 의 현재 버전 N 이 X 보다 크면(=의무 내용 개정) 1회 재넛지, 아니면 무동작
 *
 * 설계 원칙(2026-08-10 architect, docs/decision/pm-orchestration-block-import-design.md —
 * 같은 날 오전 docs/decision/pm-orchestration-block-sync-strategy.md 의 "훅 상시주입 단독" 안을 대체):
 * `@import` 우선 + 훅 상시주입을 안전망 겸 드리프트 가드로 쓰는 이중 레이어.
 *
 * installed 상태의 CLAUDE.md 는 마커 줄 다음 줄에
 *   @<malgn-agent 플러그인 절대경로>/hooks/pm-orchestration-block.md
 * import 줄을 둔다(설계 §3). 이 import 가 "확실히 살아있다"고 판정될 때, 즉 아래 세 조건이 모두 참일 때에만
 * 훅은 emit('') 로 본문 주입을 끈다(@import 가 이미 CLAUDE.md 로드 시점에 본문을 컨텍스트에 올렸으므로 중복 주입 방지):
 *   (a) CLAUDE.md 에 import 줄이 있고,
 *   (b) 그 경로가 findMalgnAgentBlockPath() 로 지금 다시 계산한 실제 설치 경로와 정확히 일치하고(=드리프트 없음),
 *   (c) ~/.claude.json 의 projects[cwd].hasClaudeMdExternalIncludesApproved 가 true 일 때(=외부 import 승인됨).
 * 그 외 모든 경우 — import 줄 없음(구버전 설치)/경로 드리프트/파일을 어디서도 못 찾음/파일은 찾았지만 아직
 * 미승인 — 은 기존과 동일하게 훅이 additionalContext 로 pm-orchestration-block.md 본문 전체를 계속 주입한다.
 * 이 하나의 불변식이 롤백 안전성의 근거다: @import 가 어떤 이유로든 깨져 있어도 최악의 경우 오늘과 동일한
 * 수준(훅 상시주입)으로 남을 뿐, 그 이하로 떨어지지 않는다.
 *
 * 이 훅 스크립트 자신은 어떤 파일도 절대 쓰지 않는다(동의 없는 자동 파일수정 방지 — 확정 안전장치, 변경 금지).
 * 마커/import 줄을 실제로 쓰는 것은 전부 이 훅이 emit 하는 지시문을 읽은 별도 Claude 세션이 Edit 도구로
 * 수행한다 — 이 스크립트는 감시·안내만 한다.
 * findMalgnAgentBlockPath()/readExternalImportState() 는 모두 try/catch 로 감싸 실패 시 안전한 기본값
 * (null / {approved:false, warningShown:false}) 으로 폴백한다. CLAUDE.md 가 없거나 어떤 오류가 나도
 * 세션을 막지 않는다.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

// CLAUDE.md 안의 상태 마커: <!-- malgn-agent:pm-orchestration:installed:v1 --> / :declined:v1
// 하위호환: 이번 리팩터 이전에 설치된 구버전 마커는 "installed:" 리터럴 없이 그냥 <!-- malgn-agent:pm-orchestration:v1 --> 형태다.
// (installed|declined): 부분을 옵션으로 두어 구버전도 매치하고, state 미캡처 시 'installed'로 취급한다.
const STATE_MARKER_RE = /<!--\s*malgn-agent:pm-orchestration:(?:(installed|declined):)?v(\d+)\s*-->/
// pm-orchestration-block.md 안의 버전 마커(그 파일이 버전의 단일 소스): <!-- malgn-agent:pm-orchestration:version:1 -->
const BLOCK_VERSION_RE = /<!--\s*malgn-agent:pm-orchestration:version:(\d+)\s*-->/
// CLAUDE.md 안의 기존 @import 줄 탐지(설계 §9-1 그대로).
const IMPORT_LINE_RE = /^@(.+pm-orchestration-block\.md)\s*$/m

// findMalgnAgentBlockPath() 가 "2개 이상 매치인데 enabledPlugins 로도 하나로 특정 못 함" 상태를 나타내는 내부 전용
// 센티널. 어떤 실제 경로 문자열과도 절대 같을 수 없으므로 안전하게 구분된다(파일에 쓰이거나 직렬화되지 않음).
const AMBIGUOUS = Symbol('ambiguous-malgn-agent-marketplace-match')

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

/**
 * 설계 §2 알고리즘 그대로: 마켓플레이스 로컬 별칭을 몰라도 파일시스템을 직접 스캔해
 * malgn-agent 플러그인의 pm-orchestration-block.md 실제 위치를 찾는다(정적 하드코딩 금지).
 * 0개 → null, 1개 → 그 경로, 2개 이상 → enabledPlugins 의 "malgn-agent@<별칭>" 키로 소거,
 * 그래도 모호하면 AMBIGUOUS.
 */
function findMalgnAgentBlockPath() {
  const marketplacesDir = join(homedir(), '.claude', 'plugins', 'marketplaces')
  let entries = []
  try {
    entries = readdirSync(marketplacesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
  } catch {
    return null
  }

  const matches = []
  for (const alias of entries) {
    const candidate = join(marketplacesDir, alias, 'malgn-agent', 'hooks', 'pm-orchestration-block.md')
    if (existsSync(candidate)) matches.push({ alias, path: candidate })
  }

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0].path

  // 2개 이상: ~/.claude/settings.json + .claude/settings.json + .claude/settings.local.json 의
  // enabledPlugins 에서 "malgn-agent@<별칭>" 패턴을 찾아 그 별칭과 일치하는 경로를 우선 채택.
  const enabledAliases = new Set()
  const settingsPaths = [
    join(homedir(), '.claude', 'settings.json'),
    join(process.cwd(), '.claude', 'settings.json'),
    join(process.cwd(), '.claude', 'settings.local.json'),
  ]
  for (const p of settingsPaths) {
    try {
      const s = JSON.parse(readFileSync(p, 'utf8'))
      const enabled = s && s.enabledPlugins
      if (enabled && typeof enabled === 'object') {
        for (const key of Object.keys(enabled)) {
          if (!enabled[key]) continue
          const m = key.match(/^malgn-agent@(.+)$/)
          if (m) enabledAliases.add(m[1])
        }
      }
    } catch {}
  }

  const resolved = matches.filter((m) => enabledAliases.has(m.alias))
  if (resolved.length === 1) return resolved[0].path
  return AMBIGUOUS // 그래도 모호함 — 임의 선택 금지(§2)
}

/** ~/.claude.json 의 projects[cwd] 에서 external-import 승인 상태를 읽는다. 실패 시 안전한 기본값. */
function readExternalImportState(cwd) {
  try {
    const j = JSON.parse(readFileSync(join(homedir(), '.claude.json'), 'utf8'))
    const proj = j && j.projects && j.projects[cwd]
    return {
      approved: !!(proj && proj.hasClaudeMdExternalIncludesApproved),
      warningShown: !!(proj && proj.hasClaudeMdExternalIncludesWarningShown),
    }
  } catch {
    return { approved: false, warningShown: false }
  }
}

function fullBodyInjection(block) {
  return (
    '다음은 malgn-agent 플러그인의 PM 행동 규율이다(이 프로젝트가 설치를 동의함 — 매 세션 플러그인 최신 내용을 읽어와 적용한다):\n\n' +
    block.body
  )
}

// §5 "찾아서 전부 제거 후 새로 쓴다" 절차 중 1단계(경로 탐색)를 사람이 읽는 지시문으로 표현한 것.
// 이 훅(코드)과 별도 Claude 세션(도구 호출) 양쪽이 "동일한 절차"로 경로를 계산해야 드리프트 판정과
// 설치 결과가 항상 일치한다(설계 §2 서두).
function findBlockPathInstructionSteps() {
  return (
    '`~/.claude/plugins/marketplaces/*/malgn-agent/hooks/pm-orchestration-block.md` 를 Bash `find` 또는 Glob 도구로 글롭 스캔한다. ' +
    '0개면 설치를 진행하지 말고 마켓플레이스 미등록 사실만 사용자에게 알린다. 2개 이상이면 `~/.claude/settings.json`·`.claude/settings.json`·`.claude/settings.local.json` 의 ' +
    '`enabledPlugins` 에서 `malgn-agent@<별칭>` 키를 찾아 그 별칭과 일치하는 경로를 쓴다. 그래도 모호하면 사용자에게 되묻는다.'
  )
}

const REMOVE_OLD_MARKERS_STEP =
  'CLAUDE.md 전체에서 `<!-- malgn-agent:pm-orchestration:(installed|declined)?:?v\\d+ -->` 형태의 줄(구버전 포함)과, ' +
  '`@`로 시작하며 `pm-orchestration-block.md`로 끝나는 줄을 모두 찾아 제거한다(몇 개가 있든, 어디에 있든).'

function askInstallNudge(block, { reinstall } = {}) {
  const blockSection = block
    ? '아래는 현재 블록의 본문이다(참고용 — CLAUDE.md에는 절대 복사하지 말 것, 마커 줄 + import 줄만 남긴다):\n\n' +
      '```markdown\n' + block.body + '\n```\n\n'
    : '(블록 파일을 읽지 못했다 — 배포 누락일 수 있다. 이번 세션에서는 설치를 진행하지 말고 이 사실만 사용자에게 알린다.)\n\n'

  const intro = reinstall
    ? `이 프로젝트는 이전에 malgn-agent PM 행동규율 설치를 거절했다(v${reinstall.oldVersion}). ` +
      `이후 블록의 의무 내용이 v${reinstall.newVersion}으로 개정되었다 — 재확인이 필요하다.\n` +
      '이번 세션에서 아직 재확인을 묻지 않았다면, AskUserQuestion으로 설치 여부를 다시 확인할 것 ' +
      '(거절 상태에서도 옛 import 줄이 우연히 남아있을 수 있으므로, 아래 "예"/"아니오" 절차 모두 마커 줄 + import 줄을 함께 정리한다):\n\n'
    : '이 프로젝트의 CLAUDE.md에는 아직 malgn-agent PM 행동규율 마커가 설치돼 있지 않다.\n' +
      '이번 세션에서 아직 사용자에게 물어보지 않았다면, AskUserQuestion으로 설치 여부를 확인할 것:\n\n'

  const version = block ? block.version : (reinstall ? reinstall.newVersion : 1)

  return (
    intro +
    blockSection +
    '  - "예": 아래 절차를 그대로 따른다(기존에 구버전 마커/거절 마커/import 줄이 남아있든 없든 동일하게 적용 — 재발 방지를 위해 매번 "찾아서 전부 제거 후 새로 쓴다"):\n' +
    `    1. ${findBlockPathInstructionSteps()}\n` +
    `    2. ${REMOVE_OLD_MARKERS_STEP}\n` +
    `    3. 그 자리(또는 그런 줄이 없었으면 파일 끝)에 아래 두 줄을 정확히 이 순서로 삽입한다: 마커 줄, 그다음 줄에 1단계에서 찾은 절대경로의 @import 줄.\n` +
    `       \`${installMarkerFor(version)}\`\n` +
    '       `@<1단계에서 찾은 절대경로>`\n' +
    '    4. 사용자에게 알린다: "다음 세션(또는 이번 세션 재시작)에 이 경로에 대한 외부 파일 승인 다이얼로그가 뜰 수 있다 — 반드시 승인해야 규율이 실제로 적용된다. 거절하면 이 프로젝트에서는 조용히 계속 비활성 상태가 되며, 그 경우에도 매 세션 훅이 안전망으로 규율 본문을 계속 주입하니 기능 자체가 사라지지는 않는다."\n' +
    '  - "아니오": 1단계(경로 탐색)는 생략한다.\n' +
    `    1. ${REMOVE_OLD_MARKERS_STEP}\n` +
    '    2. 그 자리(또는 그런 줄이 없었으면 파일 끝)에 아래 거절 마커 한 줄만 삽입한다(import 줄은 넣지 않는다):\n' +
    `       \`${declinedMarkerFor(version)}\`\n` +
    '이미 이번 세션에서 물어봤다면 다시 묻지 말 것.'
  )
}

// --- installed 상태의 4가지 케이스별 안내문(설계 §4) ---

function migrateToImportInstruction(resolvedPath, version) {
  if (!resolvedPath || resolvedPath === AMBIGUOUS) {
    const why = resolvedPath === AMBIGUOUS
      ? '마켓플레이스 후보가 2개 이상이고 enabledPlugins 설정으로도 하나로 특정할 수 없다.'
      : '마켓플레이스가 미등록이거나 삭제된 상태로 보인다.'
    return (
      '\n\n[전달 방식 업그레이드 보류] 이 프로젝트는 구버전 방식(마커만 있고 @import 줄 없음)으로 설치되어 있다. ' +
      `원래는 이번 세션에 @import 줄을 자동으로 추가해야 하지만, 지금은 malgn-agent 플러그인 원본 파일 경로를 확실히 찾을 수 없다(${why}) ` +
      '— 잘못된 경로를 쓰지 않기 위해 이번 세션에는 CLAUDE.md를 건드리지 않는다. ' +
      '사용자 재동의는 필요 없다(이미 동의한 내용의 전달 방식만 바뀌는 것) — 위 본문은 이번 세션에도 훅이 안전망으로 그대로 규율로 주입한다.'
    )
  }
  return (
    '\n\n[전달 방식 업그레이드 — 사용자 재동의 불필요] 이 프로젝트는 구버전 방식(마커만 있고 @import 줄 없음)으로 설치되어 있다. ' +
    '이미 동의한 내용에 대한 전달 방식 변경일 뿐이므로 다시 묻지 않고, 이번 세션에 아래 절차로 CLAUDE.md를 @import 방식으로 업그레이드할 것:\n' +
    `1. ${REMOVE_OLD_MARKERS_STEP}\n` +
    `2. 그 자리(또는 없었으면 파일 끝)에 아래 두 줄을 정확히 이 순서로 삽입한다:\n   \`${installMarkerFor(version)}\`\n   \`@${resolvedPath}\`\n` +
    '3. 사용자에게 알린다: "다음 세션(또는 재시작)에 외부 파일 승인 다이얼로그가 뜰 수 있다 — 반드시 승인해야 한다. 거절해도 매 세션 훅이 안전망으로 규율 본문을 계속 주입하니 기능은 유지된다."'
  )
}

function rewriteImportInstruction(resolvedPath) {
  return (
    '\n\n[경로 드리프트 감지] CLAUDE.md의 @import 줄이 가리키는 경로가 현재 실제 malgn-agent 설치 경로와 다르다' +
    '(마켓플레이스 별칭이 바뀌었거나 오설치됐을 수 있다). 이번 세션에 Edit 도구로 CLAUDE.md의 기존 @import 줄만 아래로 교체할 것(마커 줄은 그대로 둔다, 사용자 재동의 불필요 — 경로 교정일 뿐):\n' +
    `   \`@${resolvedPath}\``
  )
}

function warnPluginMissingInstruction() {
  return (
    '\n\n[플러그인 원본 파일을 찾을 수 없음] CLAUDE.md에는 @import 줄이 있지만, ' +
    '`~/.claude/plugins/marketplaces/*/malgn-agent/hooks/pm-orchestration-block.md` 글롭 스캔 결과 매치가 0개다 — ' +
    'malgn-agent 마켓플레이스가 제거되었거나 미등록 상태일 수 있다. @import는 존재하지 않는 파일을 조용히 스킵하므로 세션은 막히지 않지만, ' +
    '위 본문은 이번 세션 훅이 안전망으로 직접 주입한 것이다. CLAUDE.md의 import 줄을 임의로 지우지 말고, 사용자에게 마켓플레이스 재등록이 필요할 수 있음을 알릴 것.'
  )
}

function ambiguousPathInstruction() {
  return (
    '\n\n[경로 확정 불가 — ambiguous] malgn-agent 플러그인 원본이 2개 이상의 마켓플레이스 경로에서 발견됐고, ' +
    'enabledPlugins 설정(~/.claude/settings.json, .claude/settings.json, .claude/settings.local.json)의 `malgn-agent@<별칭>` 키로도 하나로 특정할 수 없다. ' +
    '잘못된 경로로 덮어쓰지 않기 위해 이번 세션에는 CLAUDE.md의 @import 줄을 건드리지 않는다. ' +
    '사용자에게 이 모호함을 알리고, 필요하면 어느 마켓플레이스를 쓸지 직접 확인할 것.'
  )
}

function approvalReminderInstruction(warningShown) {
  return (
    '\n\n[외부 import 승인 대기] CLAUDE.md의 @import 줄과 실제 플러그인 경로가 일치하지만, ' +
    `이 프로젝트는 아직 외부 파일 import 승인이 안 된 상태다(~/.claude.json 의 hasClaudeMdExternalIncludesApproved=false, ` +
    `warningShown=${warningShown}). ` +
    '승인되면 다음 세션부터 이 본문이 CLAUDE.md 로드 시점에 직접 포함되어 /compact 이후에도 유지된다(정체성 지속성 이점). ' +
    '승인 전까지는 이 훅이 매 세션 안전망으로 위 본문을 계속 주입하므로 규율 자체는 이미 적용되고 있다. ' +
    '승인 다이얼로그가 뜨면 사용자에게 승인하라고 안내할 것(진행을 막을 필요는 없다 — 정보 제공 목적).'
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
      let block = null
      try { block = readBlockFile() } catch {}
      if (!block) {
        emit('')
      } else {
        const importMatch = claudeMd.match(IMPORT_LINE_RE)
        const importLine = importMatch ? importMatch[1] : null
        let resolvedPath = null
        try { resolvedPath = findMalgnAgentBlockPath() } catch { resolvedPath = null }

        // 4가지 케이스(설계 §4). 판정 순서는 각 분기의 의미를 정확히 반영하도록 다음 우선순위를 따른다:
        // ①import 줄 자체가 없으면(구버전) 다른 무엇보다 먼저 마이그레이션 유도 —
        //   resolvedPath 가 무엇이든(null/AMBIGUOUS/실경로) 이 케이스가 최우선.
        // ②import 줄은 있는데 resolvedPath 를 하나로 확정할 수 없으면(파일 못 찾음/ambiguous) 그 사실 자체를 알린다 —
        //   이 경우들을 먼저 걸러야 "경로가 다르니 rewrite하라"는 부정확한 지시(resolvedPath 가 null/심볼인 채로
        //   재작성 대상 경로처럼 취급되는 것)를 방지할 수 있다.
        // ③그 다음에야 "import 줄과 resolvedPath 둘 다 있는데 값이 다르다"를 순수 경로 드리프트로 판정한다.
        // ④마지막으로 값이 정확히 일치하면 외부 import 승인 여부를 확인한다.
        if (!importLine) {
          emit(fullBodyInjection(block) + migrateToImportInstruction(resolvedPath, block.version))
        } else if (resolvedPath === AMBIGUOUS) {
          emit(fullBodyInjection(block) + ambiguousPathInstruction())
        } else if (!resolvedPath) {
          emit(fullBodyInjection(block) + warnPluginMissingInstruction())
        } else if (importLine !== resolvedPath) {
          emit(fullBodyInjection(block) + rewriteImportInstruction(resolvedPath))
        } else {
          const { approved, warningShown } = readExternalImportState(cwd)
          if (approved) {
            emit('') // @import가 이미 컨텍스트에 본문을 올렸다 — 중복 주입 금지
          } else {
            emit(fullBodyInjection(block) + approvalReminderInstruction(warningShown))
          }
        }
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
