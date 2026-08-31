#!/usr/bin/env node
/**
 * sessionstart-context.mjs — 전역 SessionStart 훅 컨텍스트 프로바이더 (모든 프로젝트 공통).
 *
 * 이 파일은 두 가지 독립된 모드로 실행된다(hooks.json이 SessionStart 한 이벤트에 이 스크립트를
 * 서로 다른 인자로 **두 번** 등록한다 — 별도 프로세스 두 개, 각자 자기 stdout JSON을 낸다):
 *
 *   1) 기본 모드(인자 없음): cwd 의 STATUS.md — 라이브 상태 단일 소스. **상한 안에서만** 주입한다(아래).
 *   2) `--pm-block` 모드: 이 플러그인의 형제 파일 `pm-orchestration-block.md`(PM 행동 규율) 본문을
 *      그대로 주입한다. STATUS.md 와 완전히 분리된 별도 hookSpecificOutput.additionalContext 값으로
 *      낸다 — 이유는 아래 "PM 블록 모드" 절 참조.
 *
 * 두 모드 모두 어떤 오류도 세션을 막지 않는다 — SessionStart 는 애초에 블로킹 불가 이벤트다.
 * 훅 레퍼런스의 exit code 2 표가 SessionStart 행을 "Can block? No / Shows stderr to user only"로,
 * JSON 출력 표가 "Context only ... No blocking or decision control"로 명시한다:
 *   https://code.claude.com/docs/en/hooks#exit-code-2-behavior-per-event
 *   https://code.claude.com/docs/en/hooks#decision-control
 * 다만 "규율이 통째로 사라진 채 세션이 정상으로 보이는" 상태는 조용히 넘기지 않고
 * systemMessage 로 사람에게 알린다(PM 블록 모드, 아래).
 *
 * ── STATUS.md 주입량 상한 (2026-08-24 추가) ───────────────────────────────────
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
 *   - 상한이 안 맞는 프로젝트는 MALGN_STATUS_MAX_BYTES 환경변수로 조정한다(0 = 바이트 상한만
 *     무제한). 문자 안전 임계값(STATUS_CHAR_SAFE_LIMIT, 아래)은 플랫폼 훅 출력 캡(10,000자)
 *     자체에서 오는 별개 제약이라 이 환경변수로는 못 끈다 — 0으로 둬도 문자 캡에는 여전히 걸린다.
 *
 * ── PM 블록 모드: 왜 STATUS.md 와 같은 값에 합치지 않는가 ─────────────────────
 * 훅이 반환하는 출력 문자열(additionalContext 포함)은 "값 하나"당 10,000자에서 캡되고, 넘으면
 * 에러가 아니라 파일로 저장되고 미리보기+경로로 조용히 대체된다 — 레퍼런스 원문:
 * "Hook output strings, including `additionalContext`, `systemMessage`, and plain stdout, are
 *  capped at 10,000 characters. Output that exceeds this limit is saved to a file and replaced
 *  with a preview and file path"(https://code.claude.com/docs/en/hooks#json-output).
 * STATUS.md 는 (위 상한 로직에도 불구하고) ASCII 위주면 12,000바이트가 10,000문자를
 * 넘을 수 있고, PM 블록과 같은 문자열에 이어붙이면 STATUS.md 쪽 분량이 PM 블록의 생존(잘림 여부)을
 * 좌우하게 된다 — 규율이 상태 메모 크기에 인질로 잡히는 구조는 받아들일 수 없다.
 * 레퍼런스가 "When several hooks return `additionalContext` for the same event, Claude receives
 * all of the values"라고 명시하므로(https://code.claude.com/docs/en/hooks#add-context-for-claude),
 * PM 블록을 **별도 hooks.json 항목**(별도 프로세스, 별도 stdout JSON)으로 분리하면
 * 두 값이 각자 독립적으로 10,000자 캡을 받는다 — PM 블록 자신의
 * 분량(실측 1,221자)만 그 캡 안에 들면 STATUS.md 가 아무리 커도 PM 블록은 절대 잘리지 않는다.
 * 이 구조적 분리가 PM_BLOCK_SAFE_LIMIT 보다 먼저 오는 1차 방어선이다.
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_MAX_BYTES = 12000

function maxBytes() {
  const raw = process.env.MALGN_STATUS_MAX_BYTES
  if (raw === undefined || raw === '') return DEFAULT_MAX_BYTES
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MAX_BYTES // 오설정은 기본값으로 — 세션을 막지 않는다
  return n // 0 = 바이트 상한만 무제한(종전 동작). 문자 안전 임계값은 별개 — 위 헤더 주석 참조.
}

const bytes = (s) => Buffer.byteLength(s, 'utf8')

function emit(ctx, systemMessage) {
  const out = {
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: ctx || '' },
  }
  if (systemMessage) out.systemMessage = systemMessage
  process.stdout.write(JSON.stringify(out))
}

// ── PM 블록 모드 ────────────────────────────────────────────────────────────
// 훅 출력 캡(10,000자, hooks.md:892) 안에서 배너까지 여유 있게 담기 위한 안전 임계값. 10,000
// 그 자체를 쓰지 않는 이유는 배너 텍스트를 더했을 때 본문 경계를 넘기지 않기 위해서다 — 본문은
// 어떤 경우에도 자르지 않는다(넘치면 배너를 먼저 버린다. 그래도 넘치면 본문 자체가 문제다, 아래).
const PM_BLOCK_SAFE_LIMIT = 9500

// ── STATUS.md 모드: 바이트 상한 + 문자 안전 임계값 통합 절단 ────────────────
// 예전에는 바이트 상한(옛 clip())으로 먼저 자르고, 그 결과 완성된 헤더 문자열을 문자 안전
// 임계값으로 다시 잘랐다(2단계). 두 절단이 동시에 걸리면 완성된 안내 문구("N줄 중 M줄만
// 들어왔다", "offset N부터 읽어라")가 1단계(바이트) 시점의 숫자를 그대로 인용한 채 2단계
// (문자)에서 뒷부분이 통째로 잘려나갈 수 있었다 — 안내 문구가 주장하는 줄 수와 실제 주입된
// 줄 수가 어긋나고, 심하면 "여기서 잘렸다" 꼬리말 자체가 사라지는 회귀였다.
// 그래서 두 상한을 한 루프로 합친다: 후보 keptLines 를 바꿔가며 그 후보로 완성한 최종
// 메시지 전체(배너+본문+꼬리말)를 매번 다시 만들고, 바이트 상한과 문자 안전 임계값을 모두
// 만족하는 가장 큰 keptLines 를 찾는다(아래 buildStatusHead). 안내 문구 안의 숫자는 항상 그
// 최종 메시지 자신을 근거로 계산되므로 두 상한이 동시에 걸려도 절대 어긋날 수 없다.
// 문자 안전 임계값이 10,000(플랫폼 훅 출력 캡)이 아니라 여유를 둔 값인 이유는 PM_BLOCK_SAFE_LIMIT
// 절 참조와 동일하다 — 안내 문구·배너 텍스트를 더해도 캡을 넘지 않기 위해서다.
const STATUS_CHAR_SAFE_LIMIT = PM_BLOCK_SAFE_LIMIT

const STATUS_BANNER = '프로젝트 진행 상태 (STATUS.md) — 세션 시작 시 자동 주입됨. 사용자가 부르면 이 내용을 먼저 요약해 보고할 것:'
const kb = (n) => (n / 1024).toFixed(1) + 'KB'

/** lines 중 keptLines 개만 남겼다고 가정하고 그 시점 기준으로 최종 head/userMsg를 완성한다. */
function buildStatusMessage(lines, totalBytes, totalLines, keptLines, byteLimit) {
  const text = lines.slice(0, keptLines).join('\n')
  const keptBytes = bytes(text)
  if (keptLines >= totalLines) {
    return { head: STATUS_BANNER + '\n\n' + text, userMsg: '', keptBytes }
  }
  const head =
    STATUS_BANNER + '\n\n' +
    '⚠️ **이 STATUS.md 는 잘려서 주입됐다** — 전체 ' + totalBytes + 'B(' + kb(totalBytes) + ', ' + totalLines + '줄) 중 ' +
    '앞 ' + keptBytes + 'B(' + kb(keptBytes) + ', ' + keptLines + '줄)만 들어왔다(바이트 상한 ' + byteLimit + 'B, 문자 안전 임계값 ' + STATUS_CHAR_SAFE_LIMIT + '자).\n' +
    '아래 내용이 파일의 전부라고 가정하지 마라. 뒷부분이 필요하면 `Read` 로 `STATUS.md` 를 ' +
    'offset ' + (keptLines + 1) + ' 부터 직접 열어라. 근본 해법은 파일을 줄이는 것이다 — ' +
    '지나간 라운드 이력·완료 항목은 `docs/archive/` 로 옮기고 STATUS.md 에는 그 위치만 남긴다.\n\n' +
    text +
    '\n\n⚠️ **여기서 잘렸다** (' + keptLines + '/' + totalLines + '줄). 이 아래는 주입되지 않았다.'
  const userMsg =
    'STATUS.md 가 커서 잘라서 주입했다: ' + kb(totalBytes) + ' 중 앞 ' + kb(keptBytes) + '만 주입 ' +
    '(' + keptLines + '/' + totalLines + '줄, 바이트 상한 ' + byteLimit + 'B / 문자 안전 임계값 ' + STATUS_CHAR_SAFE_LIMIT + '자). ' +
    '지나간 이력을 docs/archive/ 로 옮겨 STATUS.md 를 L0 크기로 줄이는 것을 권한다. ' +
    '상한 조정은 MALGN_STATUS_MAX_BYTES 환경변수(문자 안전 임계값은 플랫폼 훅 출력 캡에서 오는 별개 제약이라 이 환경변수로는 못 끈다).'
  return { head, userMsg, keptBytes }
}

/** keptLines 로 자른 결과가 바이트 상한(byteLimit, 0=무제한)과 문자 상한(charLimit)을 모두 만족하는가. */
function fitsBoth(lines, totalBytes, totalLines, keptLines, byteLimit, charLimit) {
  const contentBytes = bytes(lines.slice(0, keptLines).join('\n'))
  if (byteLimit !== 0 && contentBytes > byteLimit) return false
  return buildStatusMessage(lines, totalBytes, totalLines, keptLines, byteLimit).head.length <= charLimit
}

/**
 * STATUS.md 주입 메시지를 만든다. 바이트 상한과 문자 안전 임계값을 동시에 만족하는 가장 큰
 * keptLines 를 이진 탐색으로 찾는다 — keptLines 가 늘수록 바이트·문자 사용량은 절대 줄지
 * 않으므로(각 줄 길이 ≥ 0) fitsBoth 는 keptLines 에 대해 단조(참 구간 뒤에 거짓 구간)다.
 * 조용히 자르지 않는다: 최선의 keptLines(0이어도)로 만든 메시지를 있는 그대로 낸다.
 */
function buildStatusHead(status, byteLimit, charLimit) {
  const totalBytes = bytes(status)
  const lines = status.split('\n')
  const totalLines = lines.length

  if (fitsBoth(lines, totalBytes, totalLines, totalLines, byteLimit, charLimit)) {
    return buildStatusMessage(lines, totalBytes, totalLines, totalLines, byteLimit)
  }

  let lo = 0
  let hi = totalLines - 1
  let best = 0
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (fitsBoth(lines, totalBytes, totalLines, mid, byteLimit, charLimit)) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return buildStatusMessage(lines, totalBytes, totalLines, best, byteLimit)
}

/**
 * pm-orchestration-block.md 원문에서 본문만 추출한다. 파일 맨 앞에 있는 HTML 주석 줄
 * (`<!-- ... -->` 한 줄짜리, 예: 버전 규칙 설명·버전 마커)을 몇 개가 있든(0개·1개·2개) 건너뛰고
 * 그 다음부터를 본문으로 본다. 그 파일 자신의 버전 마커 존재 여부에 의존하지 않는다 — 이 파일이
 * 버전 마커를 갖고 있어도, 나중에 없어져도 똑같이 동작해야 한다("주석이 있든 없든 본문만
 * 주입된다").
 */
function extractPmBlockBody(raw) {
  const lines = raw.split('\n')
  let i = 0
  while (i < lines.length && /^<!--.*-->\s*$/.test(lines[i])) i++
  return lines.slice(i).join('\n').trim()
}

function runPmBlockMode() {
  const blockPath = join(dirname(fileURLToPath(import.meta.url)), 'pm-orchestration-block.md')
  let raw = ''
  try {
    raw = readFileSync(blockPath, 'utf8')
  } catch {
    // 파일을 못 읽음 — 규율이 통째로 사라진 채 세션이 정상으로 보이는 상태가 된다. SessionStart는
    // 블로킹 불가하므로(hooks.md:852) 세션을 막을 수는 없지만, 조용히 넘어가지 않고 사람에게는
    // 알린다.
    emit('', 'PM 행동규율(hooks/pm-orchestration-block.md)을 읽지 못했다 — 이번 세션에는 규율이 주입되지 않았다. 플러그인 설치본이 손상됐을 수 있다.')
    return
  }

  const body = extractPmBlockBody(raw)
  if (!body) {
    emit('', 'PM 행동규율(hooks/pm-orchestration-block.md) 본문이 비어 있다 — 이번 세션에는 규율이 주입되지 않았다.')
    return
  }

  const banner = 'PM 행동 규율 — 세션 시작 시 자동 주입됨(정본: 이 플러그인의 hooks/pm-orchestration-block.md):\n\n'
  let ctx = banner + body
  if (ctx.length > PM_BLOCK_SAFE_LIMIT) {
    // 배너를 포함하면 안전 임계값을 넘긴다 — 배너를 버린다(본문은 손대지 않는다).
    ctx = body
  }
  if (ctx.length > PM_BLOCK_SAFE_LIMIT) {
    // 배너 없이도 본문 자체가 안전 임계값을 넘는다 — 코드로는 플랫폼 캡(10,000자)을 피할 수
    // 없다. 조용히 넘기지 않고 사람에게 알린다. 그래도 본문은 있는 그대로 낸다(잘라서 반쪽짜리
    // 규율을 주입하느니, 있는 그대로 내고 위험을 알리는 편이 낫다 — 실제 잘림·강등 여부는
    // 플랫폼이 결정한다).
    emit(ctx, `PM 행동규율 본문이 ${ctx.length}자로 안전 임계값(${PM_BLOCK_SAFE_LIMIT}자)을 넘었다 — 훅 출력 캡(10,000자)에 근접해 일부 세션에서 잘리거나 파일로 강등될 위험이 있다. hooks/pm-orchestration-block.md 본문을 줄여야 한다.`)
    return
  }
  emit(ctx)
}

if (process.argv.includes('--pm-block')) {
  // 여기서 process.exit(0)을 쓰지 않는다: process.stdout이 파이프일 때(훅의 실제 stdout이 그렇다)
  // write()는 비동기라, exit()로 즉시 프로세스를 죽이면 플러시 전에 출력이 잘릴 수 있다(파일
  // 리다이렉트는 동기라 이 문제가 없어 실무에서는 안 드러난다 — 하필 "본문이 너무 크다"고 경고할
  // 때 그 경고 자체가 잘려 나가는 경로였다). 대신 아래 STATUS.md 모드를 else로 묶어 자연 종료
  // 시점까지 stdout이 온전히 비워지게 한다 — Node는 프로세스가 자연 종료될 때 표준출력을 드레인한
  // 뒤에 끝난다.
  try {
    runPmBlockMode()
  } catch {
    emit('', 'PM 행동규율 주입 중 알 수 없는 오류가 발생했다 — 이번 세션에는 규율이 주입되지 않았을 수 있다.')
  }
} else {
  // ── STATUS.md 모드(기본, 인자 없음) ────────────────────────────────────────
  try {
    const cwd = process.cwd()
    let status = ''
    try { status = readFileSync(join(cwd, 'STATUS.md'), 'utf8') } catch {}

    let head = ''
    let userMsg = ''
    if (status) {
      const result = buildStatusHead(status, maxBytes(), STATUS_CHAR_SAFE_LIMIT)
      head = result.head
      userMsg = result.userMsg
    }
    emit(head, userMsg)
  } catch {
    emit('')
  }
}
