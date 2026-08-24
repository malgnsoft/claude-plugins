/**
 * find-pm-block-path.mjs — malgn-agent pm-orchestration-block.md 실제 설치 경로를 찾는 공용 유틸.
 *
 * 원래 hooks/pm-orchestration-nudge.mjs(SessionStart 훅, 2026-08-11 삭제됨)에 있던 로직을
 * **변경 없이 그대로** 옮겼다(docs/decision/malgnai-hub-project-bootstrap-redesign.md §4-4).
 * 유일한 차이는 pm-orchestration-block.md 를 찾는 상대경로 기준점뿐이다 — 원본은 hooks/ 안에
 * 있어 같은 디렉토리를 봤지만, 이 파일은 hooks/lib/ 로 한 단계 옮겨졌으므로 부모 디렉토리를 본다
 * (findMalgnAgentBlockPath() 자체의 마켓플레이스 글롭스캔 로직은 원본과 완전히 동일하다).
 *
 * 세 소비자가 이 모듈을 공유한다:
 *   1. bin/new-project.mjs — 스캐폴딩 시점 1회 @import 삽입(§4-2)
 *   2. skills/project-standards/scripts/check-pm-orchestration-block.mjs — 온디맨드 재확인(§4-3)
 *   3. hooks/doc-drift.mjs — `pnpm run check-docs` 수동 드리프트 점검(§4-5)
 *
 * 이 모듈 자신은 SessionStart 훅이 아니다 — 어떤 이벤트에도 자동으로 실행되지 않는다. import 되지
 * 않으면 아무 일도 하지 않는다(§4-1 "자동 없음, 온디맨드만" 원칙).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

// CLAUDE.md 안의 상태 마커: <!-- malgn-agent:pm-orchestration:installed:v1 --> / :declined:v1
// 하위호환: 이 리팩터 이전에 설치된 구버전 마커는 "installed:" 리터럴 없이 그냥
// <!-- malgn-agent:pm-orchestration:v1 --> 형태다. (installed|declined): 부분을 옵션으로 두어
// 구버전도 매치하고, state 미캡처 시 'installed'로 취급한다(소비자 쪽 책임).
export const STATE_MARKER_RE = /<!--\s*malgn-agent:pm-orchestration:(?:(installed|declined):)?v(\d+)\s*-->/
// pm-orchestration-block.md 안의 버전 마커(그 파일이 버전의 단일 소스): <!-- malgn-agent:pm-orchestration:version:1 -->
export const BLOCK_VERSION_RE = /<!--\s*malgn-agent:pm-orchestration:version:(\d+)\s*-->/
// CLAUDE.md 안의 기존 @import 줄 탐지.
export const IMPORT_LINE_RE = /^@(.+pm-orchestration-block\.md)\s*$/m

// findMalgnAgentBlockPath() 가 "2개 이상 매치인데 enabledPlugins 로도 하나로 특정 못 함" 상태를 나타내는 내부 전용
// 센티널. 어떤 실제 경로 문자열과도 절대 같을 수 없으므로 안전하게 구분된다(파일에 쓰이거나 직렬화되지 않음).
export const AMBIGUOUS = Symbol('ambiguous-malgn-agent-marketplace-match')

/**
 * 마켓플레이스 설치 레이아웃(실측): ~/.claude/plugins/marketplaces/<별칭>/malgn-agent/...
 * 별칭 디렉토리 **바로 아래**에 플러그인 디렉토리가 온다 — 중간에 plugins/ 세그먼트가 없다.
 * (다른 마켓플레이스는 plugins/ 를 한 단계 더 두기도 하므로 눈대중으로 유추하지 말 것.)
 *
 * 이 두 상수가 그 레이아웃 규칙의 **단일 소유자**다. bin/new-project.mjs가 스캐폴딩하는 프로젝트의
 * check-docs 스크립트는 플러그인 밖에서 도는 독립 코드라 이 모듈을 import할 수 없지만, 사본을 따로
 * 관리하지는 않는다 — new-project.mjs가 스캐폴딩 시점에 이 상수들로 그 코드를 생성하므로 값을
 * 바꾸면 생성물도 같이 바뀐다. 생성 코드의 JS 리터럴에 그대로 박히므로 따옴표·역슬래시를 넣지 말 것.
 */
export const MARKETPLACES_DIR_SEGMENTS = ['.claude', 'plugins', 'marketplaces']
export const PLUGIN_DIR_NAME = 'malgn-agent'

/**
 * 절대경로를 홈 디렉토리 상대(`~/...`) 형태로 바꾼다. 마켓플레이스 clone은 항상
 * `<홈>/.claude/plugins/marketplaces/...` 아래에 있으므로, 스캐폴딩 시점에 절대경로를 그대로
 * 박으면 그 경로에 박힌 홈 디렉토리가 스캐폴딩한 사람 것으로 고정된다 — 프로젝트가 다른 PC로
 * 옮겨지면 존재하지 않는 남의 홈 디렉토리를 가리키게 된다. Claude Code의 `@import` 문법은
 * `@~/...` 형태를 공식 지원하므로(현재 PC의 홈으로 매번 다시 해석된다), 홈 디렉토리 밑의 경로는
 * `~/...`로 바꿔 심는다. 홈 디렉토리 밖에 있는 비정상 설치 위치는 변환할 수 없으므로 그대로 둔다
 * (그 경우는 애초에 이식성을 보장할 수 없는 상황이다).
 */
export function toHomeRelative(absPath) {
  const home = homedir()
  if (absPath === home) return '~'
  const prefix = home.endsWith(sep) ? home : home + sep
  if (!absPath.startsWith(prefix)) return absPath
  return '~/' + absPath.slice(prefix.length).split(sep).join('/')
}

/** toHomeRelative()의 역변환. `~` 또는 `~/...`로 시작하는 경로를 현재 PC의 절대경로로 편다.
 * 그 외(이미 절대경로 등)는 그대로 반환한다 — 옛 방식(절대경로 하드코딩)으로 설치된 CLAUDE.md와도
 * 호환되어야 드리프트 비교가 두 형식 모두에서 올바르게 동작한다. */
export function expandHome(p) {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), ...p.slice(2).split('/'))
  return p
}

export function readBlockFile() {
  const raw = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'pm-orchestration-block.md'),
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

/**
 * 마켓플레이스 로컬 별칭을 몰라도 파일시스템을 직접 스캔해 malgn-agent 플러그인의
 * pm-orchestration-block.md 실제 위치를 찾는다(정적 하드코딩 금지).
 * 0개 → null, 1개 → 그 경로, 2개 이상 → enabledPlugins 의 "malgn-agent@<별칭>" 키로 소거,
 * 그래도 모호하면 AMBIGUOUS.
 */
export function findMalgnAgentBlockPath() {
  const marketplacesDir = join(homedir(), ...MARKETPLACES_DIR_SEGMENTS)
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
    const candidate = join(marketplacesDir, alias, PLUGIN_DIR_NAME, 'hooks', 'pm-orchestration-block.md')
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
  return AMBIGUOUS // 그래도 모호함 — 임의 선택 금지
}
