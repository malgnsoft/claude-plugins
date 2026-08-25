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
 *   1. bin/new-project.mjs — 스캐폴딩 시점 1회 관리 구역 삽입(§4-2)
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
// CLAUDE.md 안의 기존 @import 줄 탐지(마이그레이션 창 동안 "제거할 잔재" 탐지용으로 유지).
export const IMPORT_LINE_RE = /^@(.+pm-orchestration-block\.md)\s*$/m

// 관리 구역(managed region) 종료 마커. 시작 마커(STATE_MARKER_RE)와 짝을 이룬다. 상태·버전을
// 담지 않는다(두 곳에 버전이 있으면 반드시 갈라진다 — docs/decision/pm-orchestration-block-inline-design.md §3).
export const END_MARKER_TEXT = '<!-- malgn-agent:pm-orchestration:end -->'
export const END_MARKER_RE = /<!--\s*malgn-agent:pm-orchestration:end\s*-->/

// 마커 접두 문자열. renderManagedBlock()의 안전 게이트(본문에 이 문자열이 있으면 구역 경계가
// 잘못 잡히므로 거부)와, 유일성 카운팅용 전역 정규식을 마커 패턴에서 파생시키는 데 쓴다.
// 패턴 문자열 자체는 STATE_MARKER_RE/END_MARKER_RE 두 곳에만 있고(기존 export, 변경 없음),
// 이 상수는 그 리터럴 문자열의 "부분 문자열 포함 검사"용이라 정규식 소스 중복이 아니다.
export const MARKER_PREFIX = 'malgn-agent:pm-orchestration:'

// 관리 구역 2행(사람 유지보수자용 안내 주석)의 고정 문안. renderManagedBlock()의 단일 소유.
export const MANAGED_REGION_NOTE =
  '이 구역(아래 end 마커까지)은 malgn-agent가 관리한다. 손으로 고치지 말고, 다르게 하려면 구역 밖에 적는다. 재동기화: pnpm run check-docs'

/**
 * STATE_MARKER_RE/END_MARKER_RE는 g 플래그가 없어 "몇 개 있는가"를 셀 수 없다(마지막 매치 하나만
 * 잡음). 구역 유일성 검사(§8-1)에는 개수가 필요하므로, 같은 source에서 파생한 전역 정규식을 여기
 * 한 곳에서만 만든다 — 패턴 문자열을 다시 타이핑하는 사본은 만들지 않는다.
 */
export function globalStateMarkerRe() {
  return new RegExp(STATE_MARKER_RE.source, 'g')
}
export function globalEndMarkerRe() {
  return new RegExp(END_MARKER_RE.source, 'g')
}

/**
 * 코드펜스(```...```)와 인라인 코드 스팬(`...`) 안의 내용을 같은 길이의 'x'로 지운다(줄 수·각 줄
 * 길이·개행 위치는 그대로 유지). 플랫폼이 그 안을 파싱하지 않으므로(공식 사양) 그 안의 `@...` 줄이나
 * 마커 문자열은 배선이 아니라 "설명용 인용"이다 — 지우거나 구역 경계로 오인하면 안 된다(§8-3).
 * 길이를 보존하므로 마스킹된 텍스트에서 찾은 match.index는 원본 텍스트의 같은 위치를 그대로 가리킨다.
 */
export function maskFencedAndInlineCode(text) {
  const lines = text.split('\n')
  const out = []
  let inFence = false
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      out.push(line.replace(/\S/g, 'x'))
      continue
    }
    if (inFence) {
      out.push(line.replace(/\S/g, 'x'))
      continue
    }
    out.push(line.replace(/`[^`]*`/g, (m) => m.replace(/[^`]/g, 'x')))
  }
  return out.join('\n')
}

// content 안의 index가 속한 줄의 [시작오프셋, 개행 포함 끝오프셋) 범위. 끝오프셋은 그 줄에 개행이
// 있으면 개행 바로 다음(=다음 줄 시작), 없으면(파일 끝) content.length.
function lineSpan(content, index) {
  const lineStart = index <= 0 ? 0 : content.lastIndexOf('\n', index - 1) + 1
  const nl = content.indexOf('\n', index)
  const lineEnd = nl === -1 ? content.length : nl + 1
  return { lineStart, lineEnd }
}

/**
 * CLAUDE.md 본문에서 관리 구역(managed region)의 유일성·경계를 판정한다(§3·§6·§8-1).
 * 마커 카운팅·매치는 코드펜스/코드스팬을 가린 텍스트(maskFencedAndInlineCode)에 대해 수행하고,
 * match.index는 마스킹이 길이를 보존하므로 원본 content에 그대로 쓸 수 있다.
 *
 * 반환 kind:
 *   'no-start'  — 시작 마커도 종료 마커도 없음
 *   'malformed' — 유일성 위반: 시작 마커 ≠ 1개, 또는 종료 마커 > 1개, 또는(시작·종료 각 1개일 때)
 *                 종료가 시작보다 앞이거나 declined 상태인데 종료 마커가 있음(구조적으로 있을 수 없음)
 *   'declined'  — 시작 마커 1개(declined) + 종료 마커 0개
 *   'no-region' — 시작 마커 1개(installed, 구버전 마커 포함) + 종료 마커 0개(레거시 — @import 또는 무본문)
 *   'region'    — 시작 마커 1개 + 종료 마커 1개, 시작 < 종료, declined 아님 — 정상 구역
 */
export function extractManagedRegion(content) {
  const masked = maskFencedAndInlineCode(content)
  const starts = [...masked.matchAll(globalStateMarkerRe())]
  const ends = [...masked.matchAll(globalEndMarkerRe())]

  if (starts.length === 0) {
    if (ends.length === 0) return { kind: 'no-start' }
    return { kind: 'malformed', startCount: 0, endCount: ends.length }
  }
  if (starts.length > 1 || ends.length > 1) {
    return { kind: 'malformed', startCount: starts.length, endCount: ends.length }
  }

  const start = starts[0]
  const state = start[1] || 'installed' // 구버전 마커(:vN, "installed:" 리터럴 없음)는 installed로 취급
  const version = Number(start[2])
  const startLine = lineSpan(content, start.index)

  if (ends.length === 0) {
    if (state === 'declined') {
      return { kind: 'declined', version, markerLineStart: startLine.lineStart, markerLineEnd: startLine.lineEnd }
    }
    return { kind: 'no-region', state, version, markerLineStart: startLine.lineStart, markerLineEnd: startLine.lineEnd }
  }

  const end = ends[0]
  if (end.index < start.index || state === 'declined') {
    return {
      kind: 'malformed',
      startCount: 1,
      endCount: 1,
      reason: end.index < start.index ? 'end-before-start' : 'declined-with-end-marker',
    }
  }

  const endLine = lineSpan(content, end.index)
  // 본문 = 1행(시작마커) + 2행(안내주석) 다음부터, 종료마커 줄 시작 전까지(§3).
  const line1 = lineSpan(content, start.index)
  const noteLineProbe = line1.lineEnd < content.length ? line1.lineEnd : content.length
  const line2 = lineSpan(content, noteLineProbe)
  const bodyStart = Math.min(line2.lineEnd, endLine.lineStart)
  const rawBody = content.slice(bodyStart, endLine.lineStart)
  const body = rawBody.trim()

  return {
    kind: 'region',
    state,
    version,
    body,
    regionStartIndex: startLine.lineStart,
    regionEndIndex: endLine.lineEnd,
  }
}

/**
 * 관리 구역 표기 텍스트의 단일 조립자(§3). 시작마커+안내주석+본문+종료마커를 조립해 반환한다
 * (끝에 트레일링 개행 없음 — 삽입 위치의 개행은 호출자가 책임진다, §8-4).
 * 안전 게이트(§3 "본문 인라인 전 안전 게이트") 중 하나라도 걸리면 던지고 아무것도 만들지 않는다.
 */
export function renderManagedBlock(version, body) {
  if (typeof version !== 'number' || !Number.isFinite(version) || version <= 0) {
    throw new Error('renderManagedBlock: 유효한 버전 번호가 필요하다')
  }
  if (!body || typeof body !== 'string' || !body.trim()) {
    throw new Error('renderManagedBlock: 본문이 비었거나 없다(readBlockFile()이 null일 가능성) — 삽입을 거부한다')
  }
  const masked = maskFencedAndInlineCode(body)
  if (/^@/m.test(masked)) {
    throw new Error('renderManagedBlock: 본문에 코드펜스 밖 `@`로 시작하는 줄이 있다 — 새 import로 오인될 수 있어 삽입을 거부한다')
  }
  if (masked.includes(MARKER_PREFIX)) {
    throw new Error(`renderManagedBlock: 본문에 "${MARKER_PREFIX}" 문자열이 있다 — 구역 마커와 충돌해 경계가 잘못 잡힐 수 있어 삽입을 거부한다`)
  }
  const startMarker = `<!-- malgn-agent:pm-orchestration:installed:v${version} -->`
  const note = `<!-- ${MANAGED_REGION_NOTE} -->`
  return `${startMarker}\n${note}\n${body.trim()}\n${END_MARKER_TEXT}`
}

/** 본문 비교 전 정규화: CRLF→LF, 줄 끝 공백 제거, 앞뒤 개행/공백 정리(§8-5). */
export function normalizeBodyForCompare(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim()
}

/** 정규화 후 두 본문이 같은지(§8-5). Windows 저장 한 번만으로 영구 stale-wording이 뜨지 않게 한다. */
export function bodyMatches(a, b) {
  return normalizeBodyForCompare(a) === normalizeBodyForCompare(b)
}

/**
 * 관리 구역 밖에 블록 본문과 겹치는 구간이 있는지 찾는다(§6 duplicate-body/unmanaged-body, §8-1
 * 유사도 게이트). 공백 줄을 제외하고 정규화한 뒤, 연속 3줄 이상 일치하는 첫 구간을 찾으면 즉시
 * 반환한다. excludeRange({start,end} 문자 오프셋)에 걸치는 줄은 스캔에서 제외한다 — 이미 구역
 * 안에 있는 본문 사본(그 자체가 목적)을 "겹침"으로 오탐하지 않기 위함이다.
 * 임계 3줄은 실측 기준이다(malgnai-public 손사본 15줄 중 13줄 일치 — 넉넉히 걸림, 우연한 한두 줄
 * 인용은 통과).
 *
 * claudeMdContent와 blockBody 양쪽 모두 스캔 전 maskFencedAndInlineCode()로 코드펜스/인라인 코드
 * 스팬을 가린다(extractManagedRegion()과 동일한 처리, §8-3) — 펜스 안에 설명용으로 인용된 블록
 * 본문은 배선이 아니므로 duplicate-body 오탐이 되면 안 된다. **한쪽만 마스킹하면 안 된다**:
 * blockBody 자신도 인라인 코드 스팬(예: `` `common-task-grading-and-verification-depth` ``)을
 * 여럿 포함하므로, claudeMdContent만 마스킹하면 그 줄들이 blockBody의 원문(마스킹 안 됨)과
 * 글자 그대로 달라져 **진짜 손인라인 전문(全文) 복사조차 겹침으로 잡히지 않는** 회귀가 생긴다 —
 * 두 인수를 대칭적으로 마스킹해야 실제 중복은 그대로 잡히고 펜스 안 인용만 걸러진다(실측: 이
 * 비대칭이 unmanaged-body 테스트 픽스처를 no-marker로 오판정함). 마스킹은 줄 수·각 줄 길이를
 * 보존하므로 excludeRange(claudeMdContent 기준 문자 오프셋)와 반환하는 lineNo(원본 파일 기준)는
 * 그대로 유효하다.
 */
export function findStrayBodyCopy(claudeMdContent, blockBody, excludeRange = null) {
  const normLine = (l) => l.replace(/\r$/, '').trim()
  const THRESHOLD = 3

  const maskedBlockBody = maskFencedAndInlineCode(blockBody)
  const blockFiltered = maskedBlockBody.split('\n').map(normLine).filter((l) => l !== '')

  const maskedClaudeMd = maskFencedAndInlineCode(claudeMdContent)
  const claudeLines = maskedClaudeMd.split('\n')
  let offset = 0
  const claudeFiltered = [] // { norm, lineNo(1-based) }
  for (let i = 0; i < claudeLines.length; i++) {
    const lineStart = offset
    offset += claudeLines[i].length + 1 // +1: 개행(마지막 줄이라도 근사치로 충분 — 배제 판정용)
    if (excludeRange && lineStart >= excludeRange.start && lineStart < excludeRange.end) continue
    const norm = normLine(claudeLines[i])
    if (norm !== '') claudeFiltered.push({ norm, lineNo: i + 1 })
  }

  for (let start = 0; start + THRESHOLD <= claudeFiltered.length; start++) {
    for (let bstart = 0; bstart + THRESHOLD <= blockFiltered.length; bstart++) {
      let len = 0
      while (
        start + len < claudeFiltered.length &&
        bstart + len < blockFiltered.length &&
        claudeFiltered[start + len].norm === blockFiltered[bstart + len]
      ) len++
      if (len >= THRESHOLD) {
        return { found: true, startLine: claudeFiltered[start].lineNo, endLine: claudeFiltered[start + len - 1].lineNo, matchedLines: len }
      }
    }
  }
  return { found: false }
}

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
