#!/usr/bin/env node
/**
 * check-pm-orchestration-block.mjs — PM 행동규율 CLAUDE.md 관리 구역(managed region) 온디맨드
 * 재확인/재동기화 점검.
 *
 * project-standards 스킬 §9 "PM 행동규율 블록 재확인/재설치 — 온디맨드" 절차가 호출한다.
 * 트리거는 사용자의 명시적 요청뿐이다("PM 행동규율 다시 확인해줘" 류) — 매 세션 자동 실행이
 * 아니다.
 *
 * 기본은 읽기 전용이다. cwd의 CLAUDE.md를 읽어 §9-1 상태 어휘(13개, `no-claude-md` 포함)로 판정하고, 사람이 읽을 수
 * 있는 안내문을 stdout에 JSON으로 출력한다. `--write` 플래그가 있을 때만 실제로 CLAUDE.md를
 * 고친다 — 자동 경로(SessionStart 훅 없음)에는 쓰기가 없다는 불변식은 유지된다. 그 실질을 지키는
 * 것은 "코드가 파일을 쓰지 않는다"는 글자 그대로의 문장이 아니라 "사용자가 명시적으로 요청하지
 * 않으면 쓰지 않는다"는 것이다.
 *
 * 경로 계산·구역 파싱(readBlockFile/extractManagedRegion/renderManagedBlock/bodyMatches/
 * findStrayBodyCopy 등)은 ../../../hooks/lib/find-pm-block-path.mjs 로 위임한다 — 이 스크립트와
 * bin/new-project.mjs 두 소비자가 완전히 동일한 알고리즘을 공유해야 판정과 설치 결과가 항상
 * 일치한다.
 *
 * 사용:
 *   node "${CLAUDE_PLUGIN_ROOT}/skills/project-standards/scripts/check-pm-orchestration-block.mjs" [cwd] [--write] [--upgrade-to <n>]
 *   node "${CLAUDE_PLUGIN_ROOT}/skills/project-standards/scripts/check-pm-orchestration-block.mjs" [cwd] [--decline]
 *       (이 변수는 스킬·에이전트 본문과 훅 커맨드에서 치환되고, 이 파일을 Read로 열면 문자 그대로다 — 셸 변수가 아니다.
 *        커맨드 정본은 Skill project-standards §9 참조)
 *
 * --decline(§7-E, installed → declined 역전환): 관리 구역을 통째로 제거하고 그 자리에 declined
 * 마커 한 줄만 남긴다. 경계가 불확실한 상태(malformed-region/duplicate-body/unmanaged-body/
 * no-marker/block-unreadable)에서는 거부한다. 이미 declined면 아무것도 하지 않고 멱등 보고한다.
 * --write와 동시에 줄 수 없다(사용자의 명시적 거절 의사와 재동기화 요청은 서로 다른 행동이다).
 */
import { readFileSync, writeFileSync, renameSync, lstatSync } from 'node:fs'
import { join } from 'node:path'
import {
  IMPORT_LINE_RE,
  readBlockFile,
  extractManagedRegion,
  renderManagedBlock,
  bodyMatches,
  findStrayBodyCopy,
  maskFencedAndInlineCode,
} from '../../../hooks/lib/find-pm-block-path.mjs'

function print(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n')
}

// ---- 인자 파싱 ----
const rawArgs = process.argv.slice(2)
let cwd = process.cwd()
let doWrite = false
let doDecline = false
let upgradeTo = null
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i]
  if (a === '--write') { doWrite = true; continue }
  if (a === '--decline') { doDecline = true; continue }
  if (a === '--upgrade-to') { upgradeTo = Number(rawArgs[++i]); continue }
  if (!a.startsWith('-')) { cwd = a; continue }
}

if (doWrite && doDecline) {
  print({ status: 'invalid-args', message: '--write와 --decline은 함께 줄 수 없다 — 재동기화와 거절은 서로 다른 요청이므로 하나만 지정하라.' })
  process.exit(1)
}

const claudeMdPath = join(cwd, 'CLAUDE.md')

let claudeMd
try {
  claudeMd = readFileSync(claudeMdPath, 'utf8')
} catch {
  print({ status: 'no-claude-md', message: `${claudeMdPath} 를 찾을 수 없다 — 이 cwd는 점검 대상이 아니다.` })
  process.exit(0)
}

// ---- EOL/EOF 성질 관찰(§8-4, §8-5) — 쓸 때 그대로 보존한다 ----
function detectEol(text) {
  const idx = text.indexOf('\n')
  return idx > 0 && text[idx - 1] === '\r' ? '\r\n' : '\n'
}
const originalEol = detectEol(claudeMd)
const originalHadTrailingNewline = claudeMd.endsWith('\n')

function toEol(text, eol) {
  const lf = text.replace(/\r\n/g, '\n')
  return eol === '\r\n' ? lf.replace(/\n/g, '\r\n') : lf
}

// ---- 1. 구역 구조 판정(§8-1 유일성 불변식) — 블록을 읽지 못해도 이건 항상 판단 가능 ----
const region = extractManagedRegion(claudeMd)

if (region.kind === 'malformed') {
  print({
    status: 'malformed-region',
    message: `관리 구역 유일성 위반(시작 마커 ${region.startCount}개, 종료 마커 ${region.endCount}개${region.reason ? `, ${region.reason}` : ''}).`,
    nextAction: '구역 범위를 추정해 자동 교체하지 않는다 — 사람이 직접 CLAUDE.md를 열어 마커를 정리한다.',
    write: doWrite ? { attempted: true, result: 'rejected', reason: 'malformed-region' } : undefined,
    decline: doDecline ? { attempted: true, result: 'rejected', reason: 'malformed-region' } : undefined,
  })
  process.exit(1)
}

// ---- 2. 블록 원본 읽기 ----
let block = null
try { block = readBlockFile() } catch { block = null }

if (!block) {
  print({
    status: 'block-unreadable',
    message: 'pm-orchestration-block.md를 읽지 못했다(배포 누락 가능성) — 신선도 확인 불가.',
    regionKind: region.kind,
    nextAction: '규율 자체는 이미 CLAUDE.md에 있으면 계속 작동한다. 플러그인 설치 상태를 확인하라.',
    write: doWrite ? { attempted: true, result: 'rejected', reason: 'block-unreadable' } : undefined,
    decline: doDecline ? { attempted: true, result: 'rejected', reason: 'block-unreadable' } : undefined,
  })
  process.exit(0)
}

// ---- 3. 구역 밖 사본(겹침) 검사 — 상태·마커 유무와 무관하게 항상 수행 ----
const excludeRange = region.kind === 'region' ? { start: region.regionStartIndex, end: region.regionEndIndex } : null
const stray = findStrayBodyCopy(claudeMd, block.body, excludeRange)

if (stray.found && region.kind === 'no-start') {
  print({
    status: 'unmanaged-body',
    message: `마커는 없지만 블록 본문과 겹치는 구간이 있다(줄 ${stray.startLine}-${stray.endLine}, ${stray.matchedLines}줄 일치).`,
    overlap: stray,
    nextAction: '아무것도 깨지지 않았다 — 본문은 이미 있고 규율은 작동한다. 원하면 관리 구역으로 감싸는 것을 제안만 한다(자동 쓰지 않음).',
    write: doWrite ? { attempted: true, result: 'rejected', reason: 'unmanaged-body' } : undefined,
    decline: doDecline ? { attempted: true, result: 'rejected', reason: 'unmanaged-body' } : undefined,
  })
  process.exit(0)
}

if (stray.found && region.kind !== 'no-start') {
  // "종료 마커를 손으로 지운 파일"(시작1·종료0, 본문 있음)도 regionKind:'no-region'으로 여기 걸린다
  // (legacy-no-body 경로를 살리면서 쓰기는 동일하게 거부하므로 이 분류를 유지한다). 이 경우는 진짜
  // 손인라인 중복과 원인이 다르므로 안내를 구분한다.
  const isMissingEndMarker = region.kind === 'no-region'
  print({
    status: 'duplicate-body',
    message: `관리 구역 밖에 블록 본문과 겹치는 구간이 있다(줄 ${stray.startLine}-${stray.endLine}, ${stray.matchedLines}줄 일치).`,
    overlap: stray,
    regionKind: region.kind,
    nextAction: '쓰지 않는다 — 겹친 줄 범위를 사람이 확인한 뒤 정리한다(잘못 감싸면 사용자 문장을 삼킨다).'
      + (isMissingEndMarker ? ' 종료 마커가 없으면 마커 복구가 먼저일 수 있다 — 진짜 손인라인 중복과 원인이 다르다.' : ''),
    write: doWrite ? { attempted: true, result: 'rejected', reason: 'duplicate-body' } : undefined,
    decline: doDecline ? { attempted: true, result: 'rejected', reason: 'duplicate-body' } : undefined,
  })
  process.exit(1)
}

// ---- 4. 마커 없음(구역도 사본도 없음) ----
if (region.kind === 'no-start') {
  print({
    status: 'no-marker',
    message: '이 프로젝트 CLAUDE.md에는 아직 PM 행동규율 마커가 없다.',
    blockVersion: block.version,
    nextAction: '설치 여부를 사용자에게 물어야 한다(강제 설치 금지). "예": renderManagedBlock(블록버전, 본문) 결과를 CLAUDE.md에 삽입한다. "아니오": declined 마커만 삽입한다.',
    write: doWrite ? { attempted: true, result: 'rejected', reason: 'no-marker' } : undefined,
    decline: doDecline ? { attempted: true, result: 'rejected', reason: 'no-marker' } : undefined,
  })
  process.exit(0)
}

// ---- 5. declined ----
if (region.kind === 'declined') {
  const revisedSinceDecline = block.version > region.version
  print({
    status: 'declined',
    message: `이 프로젝트는 v${region.version}에서 PM 행동규율 설치를 거절했다.`,
    currentBlockVersion: block.version,
    revisedSinceDecline,
    nextAction: revisedSinceDecline
      ? `블록 내용이 v${region.version} → v${block.version}으로 개정되었다 — 재확인이 필요하다. 사용자가 이번에 설치를 요청하면(§9 트리거) declined 마커를 renderManagedBlock() 결과로 교체한다.`
      : '사용자가 이번에 설치를 요청하면(§9 트리거) declined 마커를 renderManagedBlock() 결과로 교체한다. 요청이 없으면 그대로 둔다.',
    write: doWrite ? { attempted: true, result: 'rejected', reason: 'declined' } : undefined,
    decline: doDecline ? { attempted: true, result: 'noop', reason: 'already-declined' } : undefined,
  })
  process.exit(0)
}

// ---- 6. 레거시(구역 없음, installed 마커만) — legacy-import / legacy-no-body ----
if (region.kind === 'no-region') {
  const maskedClaudeMd = maskFencedAndInlineCode(claudeMd)
  const hasImportLine = IMPORT_LINE_RE.test(maskedClaudeMd)
  const status = hasImportLine ? 'legacy-import' : 'legacy-no-body'
  const needsConsent = region.version < block.version

  const writeResult = (() => {
    if (!doWrite) return undefined
    if (needsConsent && upgradeTo !== block.version) {
      return { attempted: true, result: 'rejected', reason: 'needs-version-consent', markedVersion: region.version, blockVersion: block.version, hint: `--upgrade-to ${block.version} 을 명시해야 진행한다.` }
    }
    try {
      const targetVersion = block.version // 항상 최신 블록 버전으로 교체(동의를 받았거나, 애초에 동의 불필요)
      const rendered = renderManagedBlock(targetVersion, block.body)
      // 1) 마커 줄(installed:vN)을 renderManagedBlock() 결과로 먼저 교체한다(있던 자리에서, §3
      //    "위치를 옮기지 않는다"). region.markerLineStart/markerLineEnd는 원본 claudeMd 기준
      //    오프셋이므로, 이 치환은 반드시 원본에 대해서만 수행한다 — 뒤에 오는 @import 제거를
      //    먼저 하면 오프셋이 밀려 이 교체가 엉뚱한 위치를 자른다.
      const markerLineStart = region.markerLineStart
      const markerLineEnd = region.markerLineEnd
      let working = claudeMd.slice(0, markerLineStart) + rendered + '\n' + claudeMd.slice(markerLineEnd)

      // 2) 코드펜스 밖 @import 잔존 줄 전부 제거(레거시 잔재, §7-A-1).
      working = stripStrayImportLines(working)
      const newContent = working

      performAtomicWrite(claudeMdPath, claudeMd, newContent, originalEol, originalHadTrailingNewline)
      return { attempted: true, result: 'written', migratedFrom: status, upgradedFrom: region.version, upgradedTo: targetVersion }
    } catch (e) {
      return { attempted: true, result: 'error', message: String(e && e.message || e) }
    }
  })()

  // --decline(§7-E): 레거시 상태(구역이 아직 없고 마커 줄뿐)에서도 거절로 되돌릴 수 있어야 한다.
  // 지울 구역 본문 자체는 없으므로(no-region) removedRegion은 마커 줄만 담는다 — 같은 호출 안에서
  // 함께 지워지는 잔존 @import 줄(재구성 가능한 플러그인 보일러플레이트)은 포함하지 않는다.
  const declineResult = doDecline ? declineFromMarkerOnly(region) : undefined

  print({
    status,
    message: status === 'legacy-import'
      ? `installed(v${region.version}) 마커 + @import 줄 — 마이그레이션 대상.`
      : `installed(v${region.version}) 마커만 있고 구역이 없다 — 마이그레이션 대상.`,
    markedVersion: region.version,
    blockVersion: block.version,
    needsVersionConsent: needsConsent,
    nextAction: needsConsent
      ? `버전이 v${region.version} → v${block.version}으로 바뀐다 — 자동 승격하지 않는다. 사람이 확인한 뒤 --upgrade-to ${block.version} 을 명시해 --write 를 다시 호출한다.`
      : '--write 로 관리 구역을 삽입하고 잔존 @import 줄을 제거할 수 있다(콘텐츠 변경 아님, 전달 방식만 바뀜 — 재동의 불필요). 거절하려면 --decline.',
    write: writeResult,
    decline: declineResult,
  })
  const succeeded = (writeResult && writeResult.result === 'written') || (declineResult && declineResult.result === 'declined')
  process.exit(succeeded ? 0 : 1)
}

// ---- 7. 정상 구역(region.kind === 'region') ----
if (region.version > block.version) {
  const declineResult = doDecline ? declineFromRegion(region) : undefined
  print({
    status: 'plugin-outdated',
    message: `설치된 마커 버전(v${region.version})이 플러그인 블록 버전(v${block.version})보다 높다 — 다운그레이드 금지.`,
    nextAction: '아무것도 하지 않는다. 플러그인 업데이트를 안내한다. 거절하려면 --decline(다운그레이드와 무관 — 본문 대체가 아니라 제거이므로 허용된다).',
    write: doWrite ? { attempted: true, result: 'rejected', reason: 'plugin-outdated' } : undefined,
    decline: declineResult,
  })
  process.exit(0)
}

if (region.version < block.version) {
  const upgradeCmd = `node "\${CLAUDE_PLUGIN_ROOT}/skills/project-standards/scripts/check-pm-orchestration-block.mjs" ${cwd} --write --upgrade-to ${block.version}`
  let writeResult
  if (doWrite) {
    if (upgradeTo !== block.version) {
      writeResult = { attempted: true, result: 'rejected', reason: 'needs-version-consent', markedVersion: region.version, blockVersion: block.version, hint: `--upgrade-to ${block.version} 을 명시해야 진행한다.` }
    } else {
      try {
        const rendered = renderManagedBlock(block.version, block.body)
        const before = claudeMd.slice(0, region.regionStartIndex)
        const after = claudeMd.slice(region.regionEndIndex)
        // §8-8 되돌리기: 교체 전 구역 원문을 stdout에 인쇄해 복구 가능성을 확보한다.
        const removedRegion = claudeMd.slice(region.regionStartIndex, region.regionEndIndex)
        const newContent = before + rendered + '\n' + after
        performAtomicWrite(claudeMdPath, claudeMd, newContent, originalEol, originalHadTrailingNewline)
        writeResult = { attempted: true, result: 'written', upgradedFrom: region.version, upgradedTo: block.version, removedRegion }
      } catch (e) {
        writeResult = { attempted: true, result: 'error', message: String(e && e.message || e) }
      }
    }
  }
  const declineResult = doDecline ? declineFromRegion(region) : undefined
  print({
    status: 'stale-version',
    message: `마커 버전(v${region.version}) < 블록 버전(v${block.version}) — 재동기화 필요(사람 확인 필요).`,
    upgradeCommand: upgradeCmd,
    nextAction: `${upgradeCmd} 로 --upgrade-to를 명시해 재실행한다. 재동기화 대신 거절하려면 --decline.`,
    write: writeResult,
    decline: declineResult,
  })
  const succeeded = (writeResult && writeResult.result === 'written') || (declineResult && declineResult.result === 'declined')
  process.exit(succeeded ? 0 : 1)
}

// region.version === block.version — 본문 실물 대조
if (bodyMatches(region.body, block.body)) {
  const declineResult = doDecline ? declineFromRegion(region) : undefined
  print({ status: 'ok', message: '관리 구역이 유일하고 버전·본문 모두 최신 블록과 일치한다. 손댈 것 없음.', decline: declineResult })
  process.exit(0)
}

// stale-wording — 버전은 같은데 문구만 다름
let writeResult
if (doWrite) {
  try {
    const rendered = renderManagedBlock(block.version, block.body)
    const before = claudeMd.slice(0, region.regionStartIndex)
    const after = claudeMd.slice(region.regionEndIndex)
    // §8-8 되돌리기: 교체 전 구역 원문을 stdout에 인쇄해 복구 가능성을 확보한다. 이 경로가
    // reviewer M1 재현 시나리오(unmanaged-body를 감싼 뒤 재동기화)에서 사용자 문장이 사라지는
    // 지점이다 — 여기서 인쇄해야 트랜스크립트에 남는다.
    const removedRegion = claudeMd.slice(region.regionStartIndex, region.regionEndIndex)
    const newContent = before + rendered + '\n' + after
    performAtomicWrite(claudeMdPath, claudeMd, newContent, originalEol, originalHadTrailingNewline)
    writeResult = { attempted: true, result: 'written', resynced: true, removedRegion }
  } catch (e) {
    writeResult = { attempted: true, result: 'error', message: String(e && e.message || e) }
  }
}
const declineResult = doDecline ? declineFromRegion(region) : undefined
print({
  status: 'stale-wording',
  message: '버전은 일치하지만 본문 실물이 다르다(의무는 동일 — 문구만 낡음).',
  nextAction: '원하면 --write 로 재동기화한다(사람 확인 불필요, 의무 변경 아님). 거절하려면 --decline.',
  write: writeResult,
  decline: declineResult,
})
process.exit(0)

// ---- --decline 헬퍼(§7-E, M2) ----
// 코드펜스 밖 잔존 @import 줄을 전부 제거한다(§7-E-3, §7-A-1과 동일 로직 — 매 회 처음부터 다시
// 스캔하므로 앞선 치환으로 위치가 밀려도 안전하다). --write(레거시 마이그레이션)와 --decline이
// 공유하는 유일한 조립 지점이다.
function stripStrayImportLines(text) {
  let working = text
  while (true) {
    const maskedNow = maskFencedAndInlineCode(working)
    const m = maskedNow.match(IMPORT_LINE_RE)
    if (!m) break
    const lineStart = working.lastIndexOf('\n', m.index - 1) + 1
    const nl = working.indexOf('\n', m.index)
    const lineEnd = nl === -1 ? working.length : nl + 1
    working = working.slice(0, lineStart) + working.slice(lineEnd)
  }
  return working
}

// region.kind === 'region'(시작+종료 마커, 본문 있음)에서 구역 전체를 제거하고 declined 마커
// 한 줄만 남긴다. 제거한 구역 원문을 removedRegion으로 반환한다(§8-8과 동일하게 stdout 인쇄용).
function declineFromRegion(region) {
  try {
    const declinedMarker = `<!-- malgn-agent:pm-orchestration:declined:v${block.version} -->`
    const removedRegion = claudeMd.slice(region.regionStartIndex, region.regionEndIndex)
    let working = claudeMd.slice(0, region.regionStartIndex) + declinedMarker + '\n' + claudeMd.slice(region.regionEndIndex)
    working = stripStrayImportLines(working)
    performAtomicWrite(claudeMdPath, claudeMd, working, originalEol, originalHadTrailingNewline)
    return { attempted: true, result: 'declined', removedRegion }
  } catch (e) {
    return { attempted: true, result: 'error', message: String(e && e.message || e) }
  }
}

// region.kind === 'no-region'(마커 줄만 있고 종료 마커·본문 없음, legacy-import/legacy-no-body)에서
// 마커 줄만 declined 마커로 교체한다. 지울 본문 자체가 없으므로 removedRegion은 마커 줄만 담는다
// (M1 지시 — "신규 삽입은 이 필드를 생략하거나 null로 둬도 된다"와 동일한 이유로 사소하지만, 마커
// 줄 자체는 실제로 제거되므로 빈 문자열보다는 실물을 남긴다). 같은 호출 안에서 함께 지워지는 잔존
// @import 줄은 포함하지 않는다(재구성 가능한 플러그인 보일러플레이트).
function declineFromMarkerOnly(region) {
  try {
    const declinedMarker = `<!-- malgn-agent:pm-orchestration:declined:v${block.version} -->`
    const removedRegion = claudeMd.slice(region.markerLineStart, region.markerLineEnd)
    let working = claudeMd.slice(0, region.markerLineStart) + declinedMarker + '\n' + claudeMd.slice(region.markerLineEnd)
    working = stripStrayImportLines(working)
    performAtomicWrite(claudeMdPath, claudeMd, working, originalEol, originalHadTrailingNewline)
    return { attempted: true, result: 'declined', removedRegion }
  } catch (e) {
    return { attempted: true, result: 'error', message: String(e && e.message || e) }
  }
}

// ---- 쓰기 헬퍼(§8-6 원자적 쓰기, §8-7 쓰기 직전 재검증, §8-4 EOL/EOF 보존) ----
function performAtomicWrite(path, originalContent, newContentLf, eol, hadTrailingNewline) {
  // m3: CLAUDE.md가 심볼릭 링크면 거부한다 — renameSync 기반 원자적 쓰기가 링크를 일반 파일로
  // 갈아치우고 링크 원본 타깃은 낡은 채로 남는다. 자동으로 링크를 따라가거나 해소하지 않는다
  // (심볼릭 링크는 의도된 구성일 수 있다). lstatSync는 파일이 없으면 던지므로 그 경우는 자연스럽게
  // "파일을 찾을 수 없음" 에러로 위 §8-7 재검증과 동일하게 처리된다.
  let st
  try { st = lstatSync(path) } catch (e) { throw new Error(`쓰기 전 파일 상태 확인 실패: ${e.message}`) }
  if (st.isSymbolicLink()) {
    throw new Error(`${path} 는 심볼릭 링크다 — 쓰기를 거부한다(자동 해소하지 않음, 의도된 구성일 수 있다).`)
  }
  // §8-7: rename 직전 원본을 다시 읽어 처음 읽은 내용과 같은지 대조. 다르면 쓰지 않고 중단.
  let onDisk
  try { onDisk = readFileSync(path, 'utf8') } catch (e) { throw new Error(`쓰기 직전 재검증 실패(파일을 다시 읽을 수 없음): ${e.message}`) }
  if (onDisk !== originalContent) {
    throw new Error('쓰기 직전 재검증 실패 — 파일이 읽은 시점 이후 다른 곳에서 변경되었다(동시 수정 감지). 쓰지 않고 중단한다.')
  }
  // §8-4: 구역 밖 파일의 성질(끝 개행 유무)은 보존한다.
  let finalLf = newContentLf
  if (!hadTrailingNewline && finalLf.endsWith('\n')) finalLf = finalLf.slice(0, -1)
  if (hadTrailingNewline && !finalLf.endsWith('\n')) finalLf += '\n'
  const finalContent = toEol(finalLf, eol)

  // §8-6: 임시 파일 작성 후 rename(원자적).
  const tmp = `${path}.pm-block-tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, finalContent, 'utf8')
  renameSync(tmp, path)
}
