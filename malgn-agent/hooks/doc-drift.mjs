#!/usr/bin/env node
/**
 * doc-drift.mjs — 전역 제네릭 문서-코드 드리프트 체커 (프로젝트 무관).
 *
 * 프로젝트 루트의 `.claude/doc-drift.json` 매니페스트를 읽어, 각 check 의 expected(문서가
 * 주장하는 값)를 코드에서 실측한 값과 대조한다. 문서가 코드와 조용히 썩는 것을 방지 —
 * "최소 토큰으로 항상 정확한 이해"의 정확성 보증 장치.
 *
 * 매니페스트 형식 (.claude/doc-drift.json):
 *   { "checks": [
 *       { "label": "API 파일", "expected": 13, "glob": "server/api/*.js" },
 *       { "label": "DB 테이블", "expected": 20, "file": "server/dao/init.js", "regex": "CREATE TABLE IF NOT EXISTS \\w+" },
 *       { "label": "페이지",   "expected": 15, "jsonLength": "app/pages/pages.json" },
 *       { "label": "러너",     "expected": 7,  "homeGlob": "Library/LaunchAgents/com.malgnai.*.plist" },
 *       { "label": "라우트",   "glob": "server/api/**\/*.ts", "docFile": "CLAUDE.md", "docRegex": "라우트\\s+(\\d+)개" }
 *   ] }
 *
 * expected 의 두 조달 방식(택1, 체크 단위로 결정):
 *   1) 정적 `expected` 숫자 — 매니페스트 안에 값을 그대로 박아둔다(기존 방식, 하위호환 유지).
 *      이 값 자체는 코드가 아니라 매니페스트 작성자가 손으로 넣은 사본이라, 문서 원문이 바뀌어도
 *      매니페스트를 함께 고치는 걸 잊으면 감시기가 그 불일치를 구조적으로 볼 수 없다(문서=매니페스트
 *      사본, 실측=코드를 비교할 뿐 "문서 원문"은 애초에 읽지 않기 때문 — 이게 이 파일이 고쳐야 했던
 *      결함의 본질이었다).
 *   2) `docFile`+`docRegex` — expected 를 매니페스트에 박지 않고, **문서 원문에서 그 자리에 직접
 *      캡처**한다. `docRegex`는 정확히 하나의 캡처 그룹으로 숫자를 감싸야 한다(첫 매치의 그룹 1을
 *      정수로 파싱). 이러면 문서 문구가 바뀌는 순간 그 새 숫자가 바로 "문서가 주장하는 값"이 되므로,
 *      매니페스트를 손으로 동기화할 필요가 없다 — 매니페스트 자체 복제가 사라진다. `docFile`은
 *      프로젝트 루트 기준 상대경로 1개(현재는 파일 1개만 지원 — 같은 숫자를 언급하는 문서가 여러 곳에
 *      있어도 이 메커니즘은 그중 지정된 1곳만 감시한다. 나머지 문서는 이 자동 검사 밖이므로 별도로
 *      챙겨야 한다).
 *   문서 쪽이 측정 불가(`docFile` 못 읽음 / `docRegex` 매치 없음 / 캡처값이 숫자로 파싱 안 됨)이면,
 *   실측(glob 등)이 정상이어도 그 check 는 **skip 이 아니라 drift(실패)로 승격**된다 — `docFile`+
 *   `docRegex` 를 지정하는 행위 자체가 "이 문서를 감시하겠다"는 명시적 선언이라, 그 선언한 대상을
 *   못 읽는 것은 `homeGlob` 타호스트처럼 "애초에 측정 대상이 아님"과 성격이 다르다. "문서에서
 *   숫자를 못 찾음"이 다른 check 들이 전부 정상이라는 이유로 "드리프트 0(✅ 전체 통과)"으로 조용히
 *   위장되면 안 되기 때문이다. `docFile`/`docRegex` 를 아예 쓰지 않는 check(정적 `expected`,
 *   `homeGlob` 등)의 측정 불가는 여전히 정당한 skip 이다(§ 아래 "측정 불가" 단락, 성격이 다른
 *   별개 규칙).
 *
 * 측정 프리미티브(코드가 진실):
 *   glob      — cwd 기준 "dir/패턴(*포함)" 파일 수. `**`(임의 깊이의 하위 디렉토리 재귀)도 지원한다.
 *             `**`가 포함된 패턴의 재귀는(패턴 안의 일반 `*` 세그먼트를 통한 하강도 포함)
 *             `node_modules`·`.git`·`.venv`·`venv`·`__pycache__`·`.parcel-cache`·`.next`·
 *             `.nuxt`·`.turbo`·`.svelte-kit`·`.cache`·`.output`(PRUNED_DIR_NAMES) 이름의
 *             디렉토리에는 진입하지 않는다 — 글롭 루트 안에 이 이름의 하위 디렉토리가 있으면,
 *             설령 그 안에 패턴과 매치되는 파일이 있어도 집계되지 않는다. 단, 첫 와일드카드
 *             세그먼트보다 앞에 오는 연속 리터럴 프리픽스는 걸러지지 않는다(예: `app/venv/**\/*.py`는
 *             `app/venv`가 첫 `*` 이전의 연속 리터럴이라 글롭 루트(`join(baseDir, 'app', 'venv')`)를
 *             그대로 이루므로 `venv`가 정상 집계된다) — 이 프리픽스는 디렉토리 순회 없이 경로를
 *             바로 구성하므로 PRUNED_DIR_NAMES 체크 자체를 거치지 않는다. 반대로 와일드카드
 *             세그먼트보다 뒤에 오는 리터럴 세그먼트는 이 예외에 해당하지 않는다 — 예를 들어
 *             `*\/venv/**\/*.py`처럼 `venv` 앞에 `*`가 있으면 `venv`도 walk()의 일반 디렉토리 순회를
 *             거쳐 매치되므로, 이름이 리터럴이라도 PRUNED_DIR_NAMES에 있으면 그대로 걸러진다(정답이
 *             조용히 0으로 집계될 수 있다 — 이 이름들을 패턴에 리터럴로 썼더라도 와일드카드 뒤에
 *             두면 pruning을 피할 수 없다).
 *   homeGlob  — $HOME 기준 glob (러너·전역에이전트 등 프로젝트 밖). `**`도 동일하게 지원.
 *   jsonLength— JSON 파일 파싱 후 배열 길이(또는 객체 키 수)
 *   file+regex— 파일 내 정규식 전역 매치 수
 *   측정 불가(경로 없음/다른 호스트) → 해당 check skip(드리프트 아님, 개별 체크 단위 규칙). 다만
 *   매니페스트의 checks가 비어있지 않은데(스캐폴딩 직후의 empty:true와는 다른 상태) 그 안의
 *   **모든** check가 측정 불가면(하나라도 정상 측정됐으면 이 규칙 대상이 아니다) 매니페스트 자체가
 *   썩었을 가능성이 크다 — 전부 skip인데 통과(✅)로 보고되는 거짓 안전을 막기 위한 매니페스트 단위
 *   규칙이다. 이 판정을 쓰는 소비자는 둘이고, 실패 처리 강도를 의도적으로 다르게 둔다:
 *     · CLI(§ 실행 블록) — "⚠️ 모든 체크가 측정 불가" 경고를 내고 exit 1로 종료한다(사람이 직접
 *       실행하는 경로라 강하게 실패시킨다).
 *     · SessionStart 훅(sessionstart-context.mjs) — 같은 판정식으로 세션 컨텍스트에 경고 1줄만
 *       붙이고 세션은 그대로 진행시킨다(자동 실행 경로는 사람의 작업을 막지 않는 것이 원칙).
 *
 * checks가 빈 배열이면(스캐폴딩 직후 등) computeDrift()는 `empty: true`를 반환한다 — "검사해서
 * 이상 없음"과 "아직 아무것도 검사하지 않음"은 다른 상태이므로, 매니페스트를 채우기 전까지는
 * 통과(✅)로 보고하지 않는다.
 *
 * 사용: node "${CLAUDE_PLUGIN_ROOT}/hooks/doc-drift.mjs" [projectDir]   (기본 cwd)
 *       (이 변수는 스킬·에이전트 본문과 훅 커맨드에서 치환되고, 이 파일을 Read로 열면 문자 그대로다 — 셸 변수가 아니다)
 * 재사용: import { computeDrift } from '.../doc-drift.mjs'
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  IMPORT_LINE_RE,
  readBlockFile,
  extractManagedRegion,
  bodyMatches,
  findStrayBodyCopy,
  maskFencedAndInlineCode,
} from './lib/find-pm-block-path.mjs'

function globSegmentRe(seg) {
  return new RegExp('^' + seg.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
}

// 순환 심볼릭 링크나 과도하게 깊은 트리(오타로 프로젝트 루트에 `**`를 건 경우 등)에서 재귀가
// 멈추지 않는 것을 막는 안전장치. 매니페스트가 가리키는 통상적인 서브트리(예: server/api/**)
// 깊이를 넉넉히 넘는 값이라 정상 사용에는 영향이 없다.
const GLOB_RECURSION_DEPTH_CAP = 12

// `**` 재귀나 트레일링 `**`의 전량 카운트가 절대 진입하지 않는, 이름 자체가 도구 산출물임을
// 뜻하는 디렉토리로만 한정한다. 이런 트리는 글롭 루트 **안에** 존재할 때 깊거나 커서 깊이상한에
// 먼저 걸려, 같은 루트 아래 패턴이 실제로 매치하는 얕은 결과까지 무관하게 통째로 null(skip)
// 처리해버린다(실측: 글롭 루트 `app` 아래 `app/node_modules/...`가 깊이상한을 넘으면
// `app/**/*.ts` 정답 2도 함께 skip — node_modules가 글롭 루트의 형제일 뿐이면 애초에 방문되지
// 않으므로 이 결함이 재현되지 않는다). 여기 걸러낸 디렉토리는 진입 자체를 안 하므로 기여분이
// "미확인"이 아니라 확정 0으로 취급된다 — 이 상한 뒤에도 걸러지지 않은(=진짜 매치 후보일 수
// 있는) 서브트리가 깊이상한을 넘기면 여전히 null로 남는다.
//
// `dist`·`build`·`out`·`coverage`·`vendor`·`target`은 의도적으로 제외했다 — 이 이름들은 빌드
// 산출물이 아니라 소스 하위 디렉토리 이름으로도 흔히 쓰여, 걸러내면 그 안의 실제 매치 대상 파일이
// 조용히 과소집계된다(예: `app/dist/foo.js`가 실제 소스, `x/build/only.ts`가 유일한 정답인 경우
// 등). `target`도 Rust(cargo)·Java(Maven) 생태계에서는 빌드 산출물 디렉토리 관례지만, 그 자체는
// 도구 전용 이름이 아니라 흔한 일반 단어라 다른 언어·도메인에서 소스 하위 디렉토리 이름(과녁·
// 타겟팅 설정 등)으로 쓰일 여지를 배제할 수 없다 — 걸러내면 그런 프로젝트에서 조용히
// 과소집계되므로 dist/build 등과 같은 이유로 뺐다. 반면 여기 남긴 이름들은 실측상 전부
// `node_modules` 하위 산출물이거나(`.cache` 등) 소스일 여지가 없는 도구 전용 디렉토리
// (`.git`·`__pycache__`·Python 가상환경 관례인 `venv`/`.venv` 등)라 안전하다.
const PRUNED_DIR_NAMES = new Set([
  'node_modules', '.git', '.venv', 'venv', '__pycache__', '.parcel-cache',
  '.next', '.nuxt', '.turbo', '.svelte-kit', '.cache', '.output',
])

/**
 * `**`가 포함된 glob 패턴을 실제로 재귀 지원한다. 예전에는 `**`가 dirname()/basename()으로
 * 쪼개질 때 존재하지 않는 리터럴 디렉토리 `**`로 해석돼 항상 measure 실패 → skip 처리됐다
 * (드리프트가 있어도 "측정 불가"로 조용히 넘어가 눈에 띄지 않았다). 이제는 `**`를 "0개 이상의
 * 하위 디렉토리"로 실제로 펼쳐서 센다.
 *
 * 루트(첫 와일드카드 세그먼트 이전의 리터럴 경로)가 존재하지 않으면 기존 규약과 동일하게
 * null(측정 불가 → skip)을 반환한다 — 재귀 매칭 결과 0건인 것과는 다른 상태다(후자는 진짜
 * 드리프트일 수 있는 정상 측정치 0).
 *
 * 연속된 `**`(예: `src/**\/**\/*.ts`)는 하나로 접는다 — 접지 않으면 같은 하위 트리를 두 '**'
 * 분기가 각각 따로 밟아 파일이 중복으로 세어진다. 접은 뒤에는 `src/**\/*.ts`와 동일해진다.
 *
 * 깊이 상한(GLOB_RECURSION_DEPTH_CAP)에 걸려 일부 경로를 못 센 경우는 부분 카운트를 그대로
 * 반환하지 않고 null(측정 불가)로 취급한다 — 안 그러면 "일부만 세고 잘린 값"이 정상 측정치처럼
 * 보여 거짓 드리프트(또는 거짓 통과)를 만든다.
 */
function countGlobRecursive(baseDir, pattern) {
  const segments = pattern.split('/').filter((seg, i, arr) => !(seg === '**' && arr[i - 1] === '**'))
  const firstWildcardIdx = segments.findIndex((s) => s.includes('*'))
  const literalPrefix = firstWildcardIdx === -1 ? segments.slice(0, -1) : segments.slice(0, firstWildcardIdx)
  const rootDir = literalPrefix.length ? join(baseDir, ...literalPrefix) : baseDir
  if (!existsSync(rootDir)) return null

  let count = 0
  let truncated = false

  // '**'가 패턴의 마지막 세그먼트일 때: 표준 glob 의미론상 `dir/**`는 dir 이하 모든 파일(임의
  // 깊이)과 일치한다. walk()의 일반 분기(다음 세그먼트로 넘어가며 '**'를 소비)로는 "다음 세그먼트가
  // 없다"는 이 경우를 셀 수 없으므로(segIdx+1이 배열 끝을 넘어가 즉시 종료됨) 별도로 전량을 센다.
  function countAllFiles(dir, depth) {
    if (depth > GLOB_RECURSION_DEPTH_CAP) { truncated = true; return }
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.isFile()) count++
      else if (e.isDirectory() && !PRUNED_DIR_NAMES.has(e.name)) countAllFiles(join(dir, e.name), depth + 1)
    }
  }

  function walk(curDir, segIdx, depth) {
    if (depth > GLOB_RECURSION_DEPTH_CAP) { truncated = true; return }
    const seg = segments[segIdx]
    if (seg === undefined) return
    let entries
    try { entries = readdirSync(curDir, { withFileTypes: true }) } catch { return }
    if (seg === '**') {
      if (segIdx === segments.length - 1) { countAllFiles(curDir, depth); return }
      walk(curDir, segIdx + 1, depth)              // '**'가 0개 디렉토리를 소비하는 경우
      for (const e of entries) {
        if (e.isDirectory() && !PRUNED_DIR_NAMES.has(e.name)) walk(join(curDir, e.name), segIdx, depth + 1) // 1개 더 내려가며 '**' 유지
      }
      return
    }
    const re = globSegmentRe(seg)
    const isLast = segIdx === segments.length - 1
    for (const e of entries) {
      if (!re.test(e.name)) continue
      if (isLast) { if (e.isFile()) count++ }
      // `seg === '**'` 분기와 동일하게 PRUNED_DIR_NAMES는 여기서도 걸러야 한다 — 이 분기는
      // 일반 세그먼트(예: `*`)가 매치한 디렉토리로 재귀하는 경로라, 패턴에 `**`가 섞여 있으면
      // (예: `app/*/**/*.ts`) 이 분기를 거쳐서도 node_modules 등 산출물 디렉토리 안으로 내려갈 수
      // 있다. 여기만 안 걸러내면 같은 walk() 안에서 분기별로 pruning 동작이 달라져 일관성이 깨진다.
      else if (e.isDirectory() && !PRUNED_DIR_NAMES.has(e.name)) walk(join(curDir, e.name), segIdx + 1, depth + 1)
    }
  }
  walk(rootDir, literalPrefix.length, 0)
  return truncated ? null : count
}

function countGlob(baseDir, pattern) {
  if (pattern.includes('**')) return countGlobRecursive(baseDir, pattern)
  const dir = join(baseDir, dirname(pattern))
  const fnPat = basename(pattern)
  const re = globSegmentRe(fnPat)
  try { return readdirSync(dir).filter((f) => re.test(f)).length } catch { return null }
}

function measure(check, cwd) {
  try {
    if (check.glob) return countGlob(cwd, check.glob)
    if (check.homeGlob) return countGlob(homedir(), check.homeGlob)
    if (check.jsonLength) {
      const j = JSON.parse(readFileSync(join(cwd, check.jsonLength), 'utf8'))
      if (Array.isArray(j)) return j.length
      if (j && typeof j === 'object') return Object.keys(j).length
      return null
    }
    if (check.file && check.regex) {
      const s = readFileSync(join(cwd, check.file), 'utf8')
      return (s.match(new RegExp(check.regex, 'g')) || []).length
    }
  } catch { return null }
  return null
}

/**
 * docFile+docRegex 체크의 "문서가 주장하는 값"을 문서 원문에서 직접 캡처한다(정적 `expected`
 * 사본 대신). docRegex 는 전역(`g`) 매치가 아니라 **첫 매치**만 쓴다 — 이 자리는 "문서 서술이 지금
 * 뭐라고 말하고 있는가" 한 곳을 가리키는 것이지, 파일 전체에서 같은 패턴이 몇 번 나오는지 세는
 * `file+regex` 측정 프리미티브(개수 세기 용도)와는 목적이 다르다.
 *
 * 아래 세 실패 모드를 전부 null(측정 불가)로 통일한다 — 하나라도 정상 처리하면 "문서 쪽이 조용히
 * 드리프트 0으로 위장"되는 원래 결함이 형태만 바꿔 재발한다:
 *   - docFile 을 못 읽음(경로 오타, 파일 삭제 등)
 *   - docRegex 가 매치하지 않음(문서 문구가 바뀌어 패턴이 더 이상 안 맞음)
 *   - 캡처 그룹 1이 정수로 파싱되지 않음(그룹을 숫자가 아닌 걸 감싸게 잘못 씀)
 */
function measureDocExpected(check, cwd) {
  try {
    const s = readFileSync(join(cwd, check.docFile), 'utf8')
    const m = s.match(new RegExp(check.docRegex))
    if (!m || m[1] === undefined) return null
    const n = Number.parseInt(m[1], 10)
    return Number.isFinite(n) ? n : null
  } catch { return null }
}

/**
 * cwd 프로젝트의 매니페스트로 드리프트 계산. 매니페스트 파일 자체가 없으면 null(=체크 대상 아님,
 * 정상 no-op). checks가 빈 배열이면(스캐폴딩 직후 등 아직 아무도 채우지 않은 상태) `empty: true`를
 * 반환한다 — 이 경우 drift/skipped 모두 빈 배열이라 "검사해서 이상 없음"과 구분되지 않았고, 그 결과
 * 호출부가 실제로는 아무것도 측정하지 않았는데 통과(✅)로 보고했다. `empty` 플래그로 호출부가
 * 그 둘을 구분해 보고할 수 있게 한다.
 *
 * "파일이 없음"과 "파일은 있지만 JSON 파싱 실패"는 절대 같은 값(null)으로 섞지 않는다 — 예전에는
 * 두 경우 모두 catch에서 null을 반환해, 매니페스트가 깨져도 "체크 대상 아님"과 구분이 안 됐다(RV류
 * 결함 — 손상이 부재로 위장돼 드리프트 검사가 꺼진 채 조용히 "통과"로 보고됨). 파싱 실패는
 * `corrupted: true`를 담은 별도 결과 객체로 반환한다. results/skipped/empty 필드는 그대로 채워
 * 넣어(skipped에 파싱 실패 사유 1건, empty:false) 이 반환값을 그대로 소비하는 기존 호출부
 * (sessionstart-context.mjs — "전부 측정 불가" 분기)가 별도 수정 없이도 자동으로 이 상태를
 * 감지해 세션 컨텍스트에 경고를 얹게 한다. 단, 그 훅은 세션을 막지 않는 것이 원칙이라 계속 진행할
 * 뿐이고, "조용히 통과하지 않는다"는 요구는 CLI 실행 블록(§ 실행 블록)의 exit code로 강하게 만족한다
 * — 사람이 실행하는 CLI 경로와 자동 실행되는 훅 경로의 실패 처리 강도를 의도적으로 다르게 둔다.
 */
export function computeDrift(cwd = process.cwd()) {
  const manifestPath = join(cwd, '.claude', 'doc-drift.json')
  let raw
  try { raw = readFileSync(manifestPath, 'utf8') } catch { return null } // 파일 자체가 없음 — 체크 대상 아님
  let manifest
  try { manifest = JSON.parse(raw) } catch (err) {
    return { corrupted: true, error: err && err.message ? err.message : String(err), results: [], drift: [], skipped: ['(매니페스트 파싱 실패)'], empty: false }
  }
  const checks = Array.isArray(manifest.checks) ? manifest.checks : []
  const results = [], drift = [], skipped = []
  for (const c of checks) {
    const actual = measure(c, cwd)
    // docFile+docRegex 가 지정된 체크는 expected 를 문서 원문에서 캡처한다(§ 상단 docstring) —
    // 없으면 기존처럼 매니페스트의 정적 expected 값을 그대로 쓴다(하위호환).
    const usesDocCapture = !!(c.docFile && c.docRegex)
    const expected = usesDocCapture ? measureDocExpected(c, cwd) : c.expected
    // docFile+docRegex 지정은 "이 문서를 감시하겠다"는 명시적 선언이므로, 그 문서 쪽 값을 못
    // 읽으면(파일 없음/정규식 미매치/정수 파싱 실패) skip 이 아니라 drift(실패)로 승격한다. skip
    // 으로 두면 이 check 만 조용히 판정에서 빠지고 나머지 check 가 전부 정상이면 CLI 가
    // "✅ 문서가 코드와 일치"를 그대로 찍는다 — 문서 문구가 바뀌어 감시가 꺼진 상태를 통과로
    // 오인하는 결함. drift 로 밀어 넣으면 CLI·훅이 공유하는 기존 hasDrift 판정 경로(exit 1, 경고
    // 메시지)를 그대로 타므로 소비자(sessionstart-context.mjs)를 별도로 고칠 필요가 없다.
    // `docFile`/`docRegex` 를 안 쓰는 check(예: `homeGlob` 타호스트)는 usesDocCapture 가 false 라
    // 이 분기 대상이 아니므로 여전히 정당한 skip 으로 남는다.
    if (usesDocCapture && expected == null) {
      drift.push(`${c.label}: 문서 캡처 실패(docFile/docRegex 미매치 또는 정수 파싱 불가) — 실측=${actual == null ? '측정불가' : actual}`)
      continue
    }
    // 코드 쪽(actual)이 측정 불가면 skip — "측정 못 함"과 "측정했더니 일치/불일치"를 섞지 않는다.
    if (actual == null) { skipped.push(c.label); continue }
    results.push({ label: c.label, expected, actual })
    if (actual !== expected) drift.push(`${c.label}: 문서=${expected} ↔ 실측=${actual}`)
  }
  return { results, drift, skipped, empty: checks.length === 0, corrupted: false }
}

// §6 상태 어휘 표의 종료코드(구조가 고정된 표라 값 자체를 여기서 다시 규정하지 않는다 — 이 맵은
// project-standards의 check-pm-orchestration-block.mjs가 process.exit()로 직접 구현한 것과 같은
// 표를 doc-drift.mjs 쪽에서도 참조하기 위한 사본이다. 표가 바뀌면 두 곳을 함께 고친다).
const PM_BLOCK_EXIT_CODE = {
  ok: 0,
  'stale-wording': 0,
  'stale-version': 1,
  'plugin-outdated': 0,
  'legacy-import': 1,
  'legacy-no-body': 1,
  'duplicate-body': 1,
  'unmanaged-body': 0,
  'malformed-region': 1,
  declined: 0,
  'no-marker': 0,
  'block-unreadable': 0,
}

/**
 * checkPmBlockInline() — CLAUDE.md 안 PM 행동규율 관리 구역(managed region)이 최신 블록과
 * 여전히 일치하는지 수동 점검한다(docs/decision/pm-orchestration-block-inline-design.md §6).
 *
 * SessionStart 훅(자동)은 없다. `pnpm run check-docs`로 수동 확인만 남겨둬 인라인 사본이 조용히
 * 낡았을 때(플러그인 버전이 올라갔는데 재동기화 안 함, 손편집으로 문구가 갈라짐 등) 감지할 방법을
 * 하나는 남긴다. 이 함수는 읽기 전용이다 — 파일을 고치지 않는다(쓰기는
 * skills/project-standards/scripts/check-pm-orchestration-block.mjs 의 --write 전담).
 *
 * 마커도 본문 사본도 전혀 없으면(미설치 상태 — 이 저장소 자신도 예전엔 여기 해당했다) null을
 * 반환해 조용히 스킵한다 — 강제 설치를 유도하지 않는다.
 */
export function checkPmBlockInline(cwd = process.cwd()) {
  let claudeMd
  try { claudeMd = readFileSync(join(cwd, 'CLAUDE.md'), 'utf8') } catch { return null }

  const region = extractManagedRegion(claudeMd)
  if (region.kind === 'malformed') {
    return { status: 'malformed-region', message: `관리 구역 유일성 위반(시작 마커 ${region.startCount}개, 종료 마커 ${region.endCount}개).` }
  }

  let block = null
  try { block = readBlockFile() } catch { block = null }
  if (!block) {
    return { status: 'block-unreadable', message: 'pm-orchestration-block.md를 읽지 못했다(배포 누락 가능성) — 신선도 확인 불가.' }
  }

  const excludeRange = region.kind === 'region' ? { start: region.regionStartIndex, end: region.regionEndIndex } : null
  const stray = findStrayBodyCopy(claudeMd, block.body, excludeRange)
  if (stray.found) {
    return region.kind === 'no-start'
      ? { status: 'unmanaged-body', message: `마커 없이 블록 본문과 겹치는 구간이 있다(줄 ${stray.startLine}-${stray.endLine}).` }
      : { status: 'duplicate-body', message: `관리 구역 밖에 블록 본문과 겹치는 구간이 있다(줄 ${stray.startLine}-${stray.endLine}) — Edit로 정리 필요.` }
  }

  if (region.kind === 'no-start') return null // 미설치 상태 — 점검 대상 아님, 강제하지 않는다
  if (region.kind === 'declined') return { status: 'declined', message: `v${region.version}에서 설치를 거절한 상태.` }
  if (region.kind === 'no-region') {
    // check-pm-orchestration-block.mjs 와 동일하게 코드펜스 밖 텍스트만으로 판정한다(§6 표 —
    // 두 소비자가 같은 CLAUDE.md에 다른 status를 내면 안 된다).
    const hasImportLine = IMPORT_LINE_RE.test(maskFencedAndInlineCode(claudeMd))
    return hasImportLine
      ? { status: 'legacy-import', message: `installed(v${region.version}) 마커 + @import 잔재 — 마이그레이션 필요.` }
      : { status: 'legacy-no-body', message: `installed(v${region.version}) 마커만 있고 구역 없음 — 마이그레이션 필요.` }
  }

  // region.kind === 'region'
  if (region.version > block.version) return { status: 'plugin-outdated', message: `설치본(v${region.version}) > 블록(v${block.version}) — 다운그레이드 금지, 조치 없음.` }
  if (region.version < block.version) return { status: 'stale-version', message: `마커 버전(v${region.version}) < 블록 버전(v${block.version}) — 재동기화 필요.` }
  if (!bodyMatches(region.body, block.body)) return { status: 'stale-wording', message: '버전은 같지만 본문 실물이 다르다(의무는 동일).' }
  return { status: 'ok' }
}

// ===== § 실행 블록 =====
// 이 파일을 직접 실행했을 때만 도는 CLI 진입점이다(import 경로는 여기 오지 않는다). 위쪽 주석이
// `(§ 실행 블록)`으로 가리키는 자리이므로 이 마커 문구를 바꾸면 그 참조가 죽는다.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cwd = process.argv[2] || process.cwd()
  const r = computeDrift(cwd)
  if (!r) { console.log('(.claude/doc-drift.json 없음 — 드리프트 체크 대상 아님)'); }
  else if (r.corrupted) {
    // "없음"과 뚜렷이 다른 메시지 + 아래 exit code로 CLI를 실패시킨다 — 매니페스트 손상이
    // "체크 대상 아님"으로 조용히 위장되지 않게 한다(호출자가 반드시 알아채야 하는 상태).
    console.log(`  ⚠️ .claude/doc-drift.json 파싱 실패: ${r.error} — 매니페스트가 손상돼 드리프트 검사를 수행할 수 없다(파일을 고쳐라).`)
  }
  else if (r.empty) {
    // checks가 비어 있으면 results/drift/skipped 모두 빈 배열이라, 아래 "✅ 문서가 코드와 일치"와
    // 겉으로 구분이 안 됐다 — 실제로는 아무것도 측정하지 않았을 뿐인데 통과처럼 보였다.
    console.log('  ℹ️ .claude/doc-drift.json의 checks가 비어 있다 — 아직 아무것도 검사하지 않았다(통과가 아니다). 매니페스트를 채우면 실제 대조가 시작된다.')
  } else {
    for (const x of r.results) console.log(`  ${x.actual === x.expected ? '✅' : '⚠️'} ${x.label}: 문서=${x.expected} 실측=${x.actual}`)
    if (r.skipped.length) console.log('  (skip, 측정불가:', r.skipped.join(', ') + ')')
  }

  // PM 행동규율 관리 구역 드리프트는 doc-drift.json 매니페스트 유무와 무관하게 항상 점검한다 —
  // 단, sessionstart-context.mjs 는 computeDrift() 만 import 해서 쓰므로 이 CLI 블록 자체가 여기
  // 있다는 사실만으로 "자동 세션 점검엔 포함 안 됨"이 구조적으로 보장된다.
  const pmCheck = checkPmBlockInline(cwd)
  if (pmCheck) {
    console.log(pmCheck.status === 'ok' ? '  ✅ PM 행동규율 관리 구역 정상' : `  ⚠️ PM 행동규율(${pmCheck.status}): ${pmCheck.message}`)
  }

  const hasDrift = !!(r && r.drift.length)
  // §6 표의 종료코드를 따른다 — status !== 'ok' 라고 전부 실패가 아니다(예: unmanaged-body/
  // declined/no-marker/plugin-outdated/block-unreadable/stale-wording은 0).
  const hasPmIssue = !!(pmCheck && (PM_BLOCK_EXIT_CODE[pmCheck.status] ?? 1) !== 0)
  // checks가 비어있지 않은데(!r.empty) 측정된 결과가 하나도 없고(results 0건) 전부 skip이면,
  // "검사해서 이상 없음"이 아니라 "아무것도 측정하지 못함"이다 — ✅ 통과로 보고하면 매니페스트
  // 경로가 썩어도 영원히 거짓 통과가 난다(RV-005). 일부만 skip이고 나머지는 측정됐다면 그 측정된
  // 결과로 드리프트를 판단하는 것이 맞으므로 이 분기 대상이 아니다.
  // corrupted는 allUnmeasurable과 형태가 겹치지만(skipped 1건, results 0건) 원인이 다르므로
  // (glob/file 경로 문제 vs JSON 문법 자체가 깨짐) 메시지·exit code 판단에서 별도 분기로 뗀다 —
  // 겹친 채로 두면 사람이 "glob 경로를 점검하라"는 엉뚱한 안내를 받는다.
  const hasCorrupted = !!(r && r.corrupted)
  const allUnmeasurable = !!(r && !r.corrupted && !r.empty && r.results.length === 0 && r.skipped.length > 0)
  if (hasDrift) {
    console.log('\n⚠️ 문서 드리프트 — 매니페스트 expected 와 문서 서술을 실측에 맞춰 갱신하라.')
    // docFile+docRegex 캡처 실패로 승격된 항목은 위 per-check 루프(results 기반)에 안 찍히므로
    // (measureDocExpected가 null을 반환해 애초에 results에 안 들어감), 어떤 check가 실패했는지
    // 여기서 drift 배열을 그대로 나열해 눈에 띄게 만든다 — 일반 불일치(문서=X ↔ 실측=Y)도 같은
    // 배열에 있어 중복 표시되지만, 틀린 정보가 아니라 상세 재확인일 뿐이라 해가 없다.
    for (const d of r.drift) console.log('  - ' + d)
  }
  else if (hasCorrupted) console.log('\n⚠️ 매니페스트 손상 — 드리프트 검사가 비활성화된 상태다(통과로 볼 수 없다). .claude/doc-drift.json의 JSON 문법을 고쳐라.')
  else if (allUnmeasurable) console.log('\n⚠️ 모든 체크가 측정 불가 — 매니페스트의 glob/file 경로를 점검하라(통과로 볼 수 없다).')
  else if (!hasPmIssue && r && !r.empty) console.log('\n✅ 문서가 코드와 일치.')
  process.exit(hasDrift || hasPmIssue || allUnmeasurable || hasCorrupted ? 1 : 0)
}
