#!/usr/bin/env node
/**
 * check-install-reachability.mjs — "설치본에서 이 인용이 실제로 열리는가" 게이트
 *
 * 기존 정적검사(validate-agent-assets.mjs)는 **형태**로 오염을 정의한다(8자리 hex·26자 ULID grep).
 * 형태 검사가 0건인 트리에서도 목적 기준("설치 직원이 이 근거를 열 수 있는가")으로 훑으면
 * 조회 불가 인용이 남는다 — 실측 사례: 훅 소스가 설치본에 없는 `docs/anthropic/hooks/hooks.md`를
 * 라인 번호까지 박아 인용했고, 그 미러 파일이 재동기화되며 라인 핀이 이미 어긋나 있었다.
 *
 * 이 스크립트는 그 목적 기준을 기계로 집행한다: `malgn-agent/**` 본문에서 경로형 토큰을 뽑아
 * **설치본 루트(= malgn-agent/ 디렉터리) 기준으로 해소**하고, 해소되지 않으면 보고한다.
 *
 * 배포 스코프(실측 근거: ~/.claude/plugins/cache/<marketplace>/malgn-agent/<ver>/ 실물 대조):
 *   번들됨   — malgn-agent/ 아래 전부(.claude-plugin·agents·bin·hooks·knowledge·skills·templates
 *              ·README.md·CHANGELOG.md·LICENSE). 설치본 루트가 곧 이 디렉터리다.
 *   번들 안 됨 — 저장소 루트의 docs/·scripts/·CLAUDE.md·STATUS.md·package.json·marketplace.json.
 *
 * 판정은 **인용한 파일 자신이 어느 스코프에 있는지**에 따라 달라진다:
 *   번들 파일 → 저장소 전용 경로 인용  = ERROR (설치 직원이 열 수 없다)
 *   저장소 전용 파일 → 저장소 전용 경로 인용 = 정상 (둘 다 clone 안에 있다)
 * 현재 스캔 범위가 malgn-agent/ 뿐이라 후자는 실제로 나오지 않지만, 범위를 넓혀도
 * 규칙이 성립하도록 zoneOf()로 일반화해 둔다.
 *
 * 사용법:
 *   node scripts/check-install-reachability.mjs [--repo PATH] [--plugin malgn-agent]
 *                                              [--format text|json] [--strict]
 *
 * 종료 코드: ERROR 1건 이상이면 1, --strict일 때 WARN만 있어도 1, 그 외 0.
 *            (validate-agent-assets.mjs와 동일 관례)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── 배포 스코프 ──────────────────────────────────────────────────────
// 설치본 루트에 실제로 올라가는 최상위 이름. 이 목록은 추측이 아니라 설치 캐시 실물이다.
const BUNDLED_TOP = new Set([
  '.claude-plugin', 'agents', 'bin', 'hooks', 'knowledge', 'skills', 'templates',
  'README.md', 'CHANGELOG.md', 'LICENSE',
]);
// 경로 토큰의 "닻"으로 인정하는 최상위 세그먼트. 여기 없는 것으로 시작하는 문자열은
// 애초에 경로 인용으로 보지 않는다(`git status` 같은 일반 예시가 여기서 전부 탈락한다).
const PLUGIN_ANCHORS = ['agents', 'bin', 'hooks', 'knowledge', 'skills', 'templates'];
const REPO_ONLY_ANCHORS = ['docs', 'scripts'];

// ── 화이트리스트 ─────────────────────────────────────────────────────
// (1) 사용자 프로젝트 상대경로 — 설치사 직원이 **자기 프로젝트에 만드는** 산출물 자리다.
//     `docs/`는 형태만으로는 "이 저장소의 docs"와 "설치 직원 프로젝트의 docs"가 구분되지 않는다.
//     실제로 두 뜻이 같은 문자열로 쓰인다(`docs/README.md`는 제품이 모든 프로젝트에 만들라고
//     지시하는 지도이면서 이 저장소에도 실재한다). 그래서 형태가 아니라 **제품이 그 자리를
//     산출물 자리로 정의했는가**로 가른다:
//       · 아래 접두어들 — 에이전트가 사용자 프로젝트에 만드는 디렉터리
//       · `docs/<파일>.<확장자>` 깊이 2 — 제품 표준 산출물 파일(prd.md·architecture.md·
//         product-principles.md·README.md 등)이 전부 이 자리에 온다
//     이 둘을 뺀 나머지 `docs/` 하위(깊이 3+의 비표준 경로)는 사용자 프로젝트 자리가 아니므로
//     "이 저장소의 문서"이거나 "다른 저장소의 문서"다 — 둘 다 설치 직원이 못 연다.
// 목록은 추측이 아니라 실측으로 만든다: `grep -rhoE 'docs/[a-z0-9_-]+/' malgn-agent/{agents,skills,knowledge}`로
// 실제 쓰이는 하위 자리를 전수 열거한 뒤, 그중 **에이전트가 사용자 프로젝트에 만드는 자리**만 남긴다.
// (같은 조사에서 나온 `docs/specs/`는 남기지 않는다 — 제품이 정의한 산출물 자리가 아니라
//  다른 프로젝트 저장소의 명세 경로를 출처로 단 것이라, 그것이 바로 이 검사가 잡아야 할 대상이다.)
const USER_PROJECT_PREFIXES = [
  'docs/reviewer/', 'docs/screenshots/', 'docs/shots/', 'docs/archive/', 'docs/design/',
  'docs/proposal/', 'docs/finance/', 'docs/marketing/', 'docs/architecture/',
  'docs/e2e/', 'docs/wireframes/',
];
const USER_PROJECT_TOP_DOC = /^docs\/[\p{L}\p{N}_*~.-]+\.[A-Za-z0-9]{1,6}$/u;
// (2) 공개 URL — 설치 직원이 브라우저로 열 수 있다. 애초에 경로 토큰 정규식이 스킴을 요구하지
//     않으므로 URL 안의 path 부분이 잡히지 않게 매칭 전에 URL을 지운다.
// 스킴이 없는 맨 도메인 표기(`code.claude.com/docs/en/sub-agents`)도 URL이다 — 실측으로 잡혔다.
const URL_RE = /(?:https?:\/\/|www\.|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|io|net|dev|kr|ai)\/)[^\s`'")\]]*/g;

// (3) 저장소 자신의 문서를 인용해도 되는 파일(저장소 전용 스코프). 스캔 범위를 넓힐 때 쓴다.
function zoneOf(repoRelPath, plugin) {
  const p = repoRelPath.replace(/\\/g, '/');
  if (p === plugin || p.startsWith(`${plugin}/`)) return 'BUNDLED';
  return 'REPO_ONLY';
}

// ── 오탐 차단 ────────────────────────────────────────────────────────
// 플레이스홀더 표기. 토큰 안에 있으면 물론이고, 토큰이 이 문자 **직전에서 끊긴 경우**도
// 잘린 플레이스홀더이므로 버린다 — `knowledge/lessons/[프로젝트명].md`가 `knowledge/lessons/`로
// 잘려 "없는 디렉터리"로 오탐되는 것이 실제로 관측된 형태다.
const PLACEHOLDER_CHARS = /[[\]<>{}⟨⟩…]/;
// 대상이 없는 것이 정상이라고 문장 스스로 말하는 줄. **두 범주를 한 정규식에 섞으면 안 된다** —
// 뜻이 다르고, 따라서 처리도 달라야 한다:
//
//   (a) 진짜 폐기  — 우리 자산에서 소멸했다. 아무 환경에도 없다.
//       예: "프로젝트별 `bin/capture-all.js` … 는 더 이상 쓰지 않는다"
//       → 대상이 없는 것은 맞지만 **경로 형태로 적어둔 것 자체가 문제**다(다음 사람이 열어본다).
//         WARN으로 남겨 산문 표기로 바꾸게 한다.
//
//   (b) 미번들   — 이 플러그인에 안 들어갈 뿐, **읽는 사람의 운영 환경에는 있을 수 있다.**
//       예: "`bin/sync-agents.js`(이 스크립트는 이 플러그인에 번들되지 않음 — 운영 프로젝트에
//            구축되어 있다면 그 경로를 사용)"
//       → 경로를 적는 것이 **맞다**. 그 경로로 가야 찾을 수 있다. 지적하면 오탐이다.
//
// 두 범주를 한 정규식으로 묶었더니 (b)가 (a)와 같이 걸려, 리뷰가 이미 "그 문장이 스스로
// 미포함을 밝히고 있다"며 명시 기각한 항목을 이 스크립트가 다시 잡았다. 범주를 갈라 둔다.
const NOT_BUNDLED_NOTE = /(미번들|미포함|번들되지 않|포함되지 않|이 플러그인에는|운영 환경이면|구축되어 있다면|존재하지 않는다|no matches)/i;
const RETIRED_NOTE = /(폐기|폐지|retire|deprecat|삭제됨|없어졌|더 이상)/i;

// ── 경로 토큰 추출 ───────────────────────────────────────────────────
// 닻으로 시작하는 것만 잡는다. 앞에 `${CLAUDE_PLUGIN_ROOT}/`(설치본 절대경로로 치환되는 정본
// 표기) 또는 `malgn-agent/`(소스 clone을 고치는 대상 표기)가 붙을 수 있다.
// 선행 lookbehind가 필요하다 — 없으면 shebang `#!/usr/bin/env node`의 `bin/env`가 잡힌다(실측).
//
// 경로 문자 클래스는 **유니코드 문자를 포함해야 한다.** 이 제품의 번들 자산에는 한글 파일명이
// 실재하고(`knowledge/design/html-style-guide/html-스타일가이드-세로형.html`), 그중에는
// `${CLAUDE_PLUGIN_ROOT}` 접두가 붙은 **필수 Read 지시**도 있다 — 이 스크립트가 가장 지켜야 할
// 형태다. ASCII만 허용하면 그 인용이 `…/html-`에서 잘려 "확장자 없음"으로 조용히 폐기된다.
const ANCHOR_ALT = [...PLUGIN_ANCHORS, ...REPO_ONLY_ANCHORS].join('|');
const PATH_TOKEN_RE = new RegExp(
  String.raw`(?<![A-Za-z0-9_./~-])` +
  String.raw`(\$\{CLAUDE_PLUGIN_ROOT\}\/|malgn-agent\/)?` +
  String.raw`(?:${ANCHOR_ALT})\/[\p{L}\p{N}_.*~/-]*[\p{L}\p{N}_*~/-]` +
  String.raw`(?::(\d+))?`,
  'gu',
);

// 유니코드를 허용한 대가: 한국어는 파일명 뒤에 조사가 공백 없이 붙는다(`…/x.md를 읽는다`).
// 그대로 두면 토큰이 `x.md를`가 되어 확장자 판정에 실패하고, 유니코드를 허용한 의미가 없어진다.
// 그래서 **뒤에 붙은 한글 덩어리를 떼어냈을 때 확장자·글로브로 끝나는 경우에만** 떼어낸다 —
// 조건 없이 밀면 `html-스타일가이드-세로형`처럼 이름 자체가 한글로 끝나는 파일이 망가진다.
const TRAILING_HANGUL = /[가-힣]+$/;
function stripJosa(rel) {
  if (!TRAILING_HANGUL.test(rel)) return rel;
  const stripped = rel.replace(TRAILING_HANGUL, '');
  if (/\.[A-Za-z0-9]{1,6}$/.test(stripped) || stripped.endsWith('*') || stripped.endsWith('/')) return stripped;
  return rel;
}

// 슬래시가 들어갔다고 다 경로가 아니다. 산문의 병렬 표기가 정확히 이 형태로 걸린다 —
// 실측된 오탐: `knowledge/MD`(knowledge 또는 MD) · `agents/skills/knowledge` · `hooks/policies`
// · `skills/X`(자리 표시자). 그래서 **파일임을 스스로 증명한 토큰만** 판정한다:
//   · 확장자로 끝나거나  · 글로브를 포함하거나  · 명시적으로 `/`로 끝나거나(디렉터리 표기)
//   · `docs/` 하위 깊이 3 이상(사용자 프로젝트 표준 자리가 아닌 구체 경로 — 산문일 확률이 낮다)
// 이 조건을 "경로 형태 판별"이 아니라 **"글쓴이가 파일을 가리켰다고 확신할 수 있는가"**로
// 잡는 것이 요점이다. 확신이 없으면 통과시킨다 — 오탐이 실탐을 덮으면 게이트가 무시당한다.
const LOOKS_LIKE_FILE = /\.[A-Za-z0-9]{1,6}$/;
function isJudgeablePath(rel, hadTrailingSlash) {
  if (hadTrailingSlash) return true;
  if (rel.includes('*')) return true;
  if (LOOKS_LIKE_FILE.test(rel)) return true;
  if (rel.startsWith('docs/') && rel.split('/').length >= 3) return true;
  return false;
}

// 스크립트 소스(.mjs/.cjs/.js)는 **주석 줄만** 본다. 코드 본문의 문자열
// (path.join(dir, 'knowledge') 등)은 런타임에 코드가 자기 루트로 해소하므로 인용이 아니다.
const COMMENT_LINE_RE = /^\s*(?:\/\/|\/\*|\*|#)/;

// 펜스 블록은 **지우지 않고 같은 줄 수의 개행으로 치환한다.** 통째로 지우면 그 뒤 모든 내용의
// 줄 번호가 앞당겨져, 보고한 위치를 열었을 때 전혀 다른 문단이 나온다(실측 −25 ~ −132행).
// 위치를 틀리게 알려주는 게이트는 안 잡는 게이트보다 나쁘다 — 사람이 그 자리를 열어보고
// "오탐이네" 하고 규칙 전체를 불신하게 된다.
function stripFencedCode(body) {
  return body.replace(/^```[\s\S]*?^```/gm, (m) => '\n'.repeat((m.match(/\n/g) || []).length));
}

const findings = [];
const report = (level, code, file, message) => findings.push({ level, code, file, message });
const error = (...a) => report('ERROR', ...a);
const warn = (...a) => report('WARN', ...a);

function parseArgs(argv) {
  const opts = { repo: DEFAULT_REPO_ROOT, plugin: 'malgn-agent', format: 'text', strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo') opts.repo = path.resolve(argv[++i]);
    else if (a === '--plugin') opts.plugin = argv[++i];
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--strict') opts.strict = true;
    else if (a === '--help' || a === '-h') {
      console.log('usage: node scripts/check-install-reachability.mjs [--repo PATH] [--plugin NAME] [--format text|json] [--strict]');
      process.exit(0);
    }
  }
  return opts;
}

// 글로브는 건너뛰지 않고 **해소한다.** `bin/*.mjs`는 실제로 여러 파일에 맞으므로 정상이고,
// `knowledge/review/persona-*.md`는 0개에 맞으므로 죽은 안내판이다 — 형태가 같아도 결과가 다르다.
// 글로브를 통째로 오탐 취급해 건너뛰면 후자가 영원히 안 잡힌다.
function globMatches(rootAbs, token) {
  const segs = token.split('/');
  const starIdx = segs.findIndex((s) => s.includes('*'));
  if (starIdx === -1) return null;
  if (segs.slice(starIdx + 1).some((s) => s.includes('*'))) return null; // 다중 와일드카드는 판정 보류
  const dirAbs = path.join(rootAbs, ...segs.slice(0, starIdx));
  if (!fs.existsSync(dirAbs) || !fs.statSync(dirAbs).isDirectory()) return 0;
  const pat = new RegExp('^' + segs[starIdx].split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  const hits = fs.readdirSync(dirAbs).filter((n) => pat.test(n));
  if (starIdx === segs.length - 1) return hits.length;
  return hits.filter((n) => fs.existsSync(path.join(dirAbs, n, ...segs.slice(starIdx + 1)))).length;
}

function existsAt(rootAbs, rel) {
  if (rel.includes('*')) {
    const n = globMatches(rootAbs, rel);
    return n === null ? true : n > 0; // 판정 보류는 통과시킨다(모르는 것을 결함으로 단정하지 않는다)
  }
  return fs.existsSync(path.join(rootAbs, rel));
}

function isUserProjectPath(rel) {
  const r = rel.endsWith('/') ? rel : `${rel}/`;
  if (USER_PROJECT_PREFIXES.some((p) => r.startsWith(p))) return true;
  return USER_PROJECT_TOP_DOC.test(rel);
}

function lineCount(abs) {
  return fs.readFileSync(abs, 'utf8').split('\n').length;
}

function scanFile(repoRoot, pluginRoot, repoRel, opts) {
  const abs = path.join(repoRoot, repoRel);
  const zone = zoneOf(repoRel, opts.plugin);
  const isScript = /\.(mjs|cjs|js)$/.test(repoRel);
  let text = fs.readFileSync(abs, 'utf8');
  if (!isScript) text = stripFencedCode(text);

  const lines = text.split(/\r?\n/);
  for (let ln = 0; ln < lines.length; ln++) {
    let line = lines[ln];
    if (isScript && !COMMENT_LINE_RE.test(line)) continue;
    line = line.replace(URL_RE, ' ');
    // 미번들 서술이 우선한다 — 두 표지가 한 줄에 같이 있으면 "읽는 이의 환경에는 있을 수 있다"는
    // 쪽이 이긴다. 있을 수 있는 것을 없다고 지적하는 오탐이, 표기 형태를 놓치는 미탐보다 비싸다.
    const notBundled = NOT_BUNDLED_NOTE.test(line);
    const retired = !notBundled && RETIRED_NOTE.test(line);

    PATH_TOKEN_RE.lastIndex = 0;
    for (const m of line.matchAll(PATH_TOKEN_RE)) {
      const prefix = m[1] || '';
      const pin = m[2] ? Number(m[2]) : null;
      let rel = m[0].slice(prefix.length).replace(/:\d+$/, '');
      const after = line.slice(m.index + m[0].length);

      // 잘린 플레이스홀더(`knowledge/lessons/[프로젝트명].md`)와 토큰 안의 플레이스홀더를 버린다.
      if (PLACEHOLDER_CHARS.test(rel)) continue;
      if (/^[[<{⟨]/.test(after)) continue;
      rel = stripJosa(rel);
      const hadTrailingSlash = rel.endsWith('/');
      if (hadTrailingSlash) rel = rel.slice(0, -1);
      if (!rel.includes('/')) continue;
      if (!isJudgeablePath(rel, hadTrailingSlash)) continue;

      const loc = `${repoRel}:${ln + 1}`;
      // 메시지에는 조사를 떼어낸 형태를 보여준다 — `x.md를`로 인용하면 사람이 파일명으로 오해한다.
      const whole = prefix + rel + (hadTrailingSlash ? '/' : '') + (pin !== null ? `:${pin}` : '');

      // ① `malgn-agent/` 접두 = 소스 clone 편집 대상 표기. 저장소에는 있어도 설치본 루트에는
      //    `malgn-agent/`라는 디렉터리가 없다 — 실행·읽기 대상을 이 형태로 적으면 설치본에서 못 연다.
      if (prefix.startsWith('malgn-agent/')) {
        if (existsAt(repoRoot, `${opts.plugin}/${rel}`)) {
          // 실행 대상(bin·hooks 스크립트)과 편집 대상(agents·skills·knowledge 본문)을 가른다.
          // 같은 표기라도 뜻이 정반대다: trainer가 "`malgn-agent/knowledge/`에 자산화한다"고 쓰는
          // 것은 소스 clone을 고치라는 정당한 지시이고, "`malgn-agent/bin/capture.mjs`로 캡처한다"는
          // 설치본에서 해석 불가한 실행 지시다. 기계는 이 의도를 못 읽으므로 **가능성이 높은 쪽만**
          // 따로 표시해 사람의 분류 부담을 줄인다.
          const exec = /^(bin|hooks)\//.test(rel);
          warn(exec ? 'SOURCE_CLONE_PREFIX_EXEC' : 'SOURCE_CLONE_PREFIX', loc,
            `'${whole}'는 소스 clone 기준 표기다 — 설치본 루트에는 '${opts.plugin}/' 디렉터리가 없어 열리지 않는다. ` +
            (exec
              ? '실행 대상을 이 형태로 적으면 설치본에서 해석되지 않는다 — `${CLAUDE_PLUGIN_ROOT}/…`로 적는다'
              : '이 저장소 소스를 고치는 대상이면 정상이다(trainer 등) — 읽기·실행 대상이면 `${CLAUDE_PLUGIN_ROOT}/…`로 고친다') +
            ' (규약 정본: Skill `common-output-storage-and-path-management` §1-2).');
        } else {
          error('INSTALL_PATH_MISSING', loc, `'${whole}'가 이 저장소에도 설치본에도 없다.`);
        }
        continue;
      }

      const top = rel.split('/')[0];

      // ② 플러그인 닻(agents/bin/hooks/knowledge/skills/templates) — 설치본 루트에서 해소돼야 한다.
      if (PLUGIN_ANCHORS.includes(top)) {
        if (existsAt(pluginRoot, rel)) {
          if (pin !== null) checkPin(pluginRoot, rel, pin, loc, whole);
          continue;
        }
        // 미번들 서술이면 지적하지 않는다 — 읽는 이의 운영 환경에는 그 경로로 실재할 수 있고,
        // 그렇다면 경로를 적어두는 것이 맞다.
        if (notBundled) continue;
        if (retired) {
          warn('RETIRED_PATH_CITED', loc,
            `'${whole}'는 실재하지 않고 같은 줄이 **폐기**를 서술한다(우리 자산에서 소멸). 대상이 없는 것은 정상이나 ` +
            '**경로 형태로 적어두면** 다음 사람이 그대로 열어본다 — 이름 없이 산문으로 적는다 ' +
            '(Skill `common-output-storage-and-path-management` §1-2). ' +
            '※ 폐기가 아니라 "이 플러그인에 미번들일 뿐 운영 환경에는 있을 수 있다"는 뜻이라면 문장에 그렇게 밝힌다 — 그러면 이 검사는 지나간다.');
        } else {
          error('INSTALL_PATH_MISSING', loc,
            `설치본 루트 기준으로 '${rel}'가 실재하지 않는다${rel.includes('*') ? ' (글로브 일치 0건)' : ''} — 이 안내판을 따라가면 빈손이다.`);
        }
        continue;
      }

      // ③ 저장소 전용 닻(docs/·scripts/) — 번들 파일이 인용하면 설치 직원이 열 수 없다.
      //    여기가 이 스크립트의 핵심 판정이다. 세 갈래로 갈린다:
      //      (a) 제품이 정의한 사용자 프로젝트 산출물 자리        → 정상(검사 대상 아님)
      //      (b) 이 저장소에 실재                                 → 번들 안 됨 = 설치 직원이 못 연다
      //      (c) 이 저장소에도 없고 사용자 자리도 아님             → 남의 저장소 경로
      if (REPO_ONLY_ANCHORS.includes(top)) {
        if (isUserProjectPath(rel)) continue;                    // (a)
        if (zone === 'REPO_ONLY') continue;                      // clone 안에서 clone을 가리킨다 — 정상
        if (existsAt(repoRoot, rel)) {                           // (b)
          error('NOT_BUNDLED_CITATION', loc,
            `'${whole}'는 이 저장소에만 있고 플러그인에 번들되지 않는다 — 설치 직원은 열 수 없다. ` +
            '근거를 없애지 말고 **썩지 않는 형태**로 바꾼다: 인용문 원문 + 공개 URL/앵커, 또는 문장으로 요약.');
          continue;
        }
        if (retired || notBundled) continue;
        warn('FOREIGN_REPO_CITATION', loc,                       // (c)
          `'${whole}'는 이 저장소에도 없고 제품이 정의한 사용자 프로젝트 산출물 자리도 아니다 — ` +
          '다른 저장소의 파일 경로로 보인다. 출처는 프로젝트명 수준까지만 남기고 파일 경로는 뺀다. ' +
          '사용자 프로젝트의 새 표준 자리라면 이 스크립트의 USER_PROJECT_PREFIXES에 등록한다.');
        continue;
      }
    }
  }
}

// 라인 핀은 대상 파일이 재동기화·편집되면 조용히 다른 행을 가리키게 된다. 범위를 벗어난 핀은
// 확실히 깨진 것이므로 ERROR로 잡는다(범위 안이지만 내용이 바뀐 드리프트는 기계로 못 잡는다).
function checkPin(rootAbs, rel, pin, loc, whole) {
  if (rel.includes('*')) return;
  const abs = path.join(rootAbs, rel);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return;
  const n = lineCount(abs);
  if (pin > n) {
    error('LINE_PIN_OUT_OF_RANGE', loc,
      `'${whole}'의 라인 핀이 대상 파일 범위를 벗어난다(총 ${n}행). 라인 번호 대신 인용문 원문·앵커로 적는다.`);
  }
}

function walk(dir, out, repoRoot) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      walk(p, out, repoRoot);
      continue;
    }
    if (!/\.(md|mjs|cjs|js)$/.test(e.name)) continue;
    // CHANGELOG는 과거 상태를 적는 정당한 이력 보관처다 — 죽은 경로가 남아 있는 것이 정상이다.
    if (e.name === 'CHANGELOG.md') continue;
    out.push(path.relative(repoRoot, p).replace(/\\/g, '/'));
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = opts.repo;
  const pluginRoot = path.join(repoRoot, opts.plugin);
  if (!fs.existsSync(pluginRoot)) {
    console.error(`플러그인 디렉터리가 없다: ${pluginRoot}`);
    process.exit(2);
  }

  // 설치본 루트 = 플러그인 디렉터리. 실제 배포 스코프와 어긋나면 판정 전체가 틀리므로 먼저 확인한다.
  const unexpected = fs.readdirSync(pluginRoot).filter((n) => !BUNDLED_TOP.has(n) && !n.startsWith('.'));
  if (unexpected.length) {
    warn('BUNDLE_SCOPE_DRIFT', `${opts.plugin}/`,
      `배포 스코프 목록(BUNDLED_TOP)에 없는 최상위 항목이 있다: ${unexpected.join(', ')} — ` +
      '설치 캐시 실물과 대조해 이 스크립트의 목록을 갱신한다.');
  }

  const files = [];
  walk(pluginRoot, files, repoRoot);
  for (const rel of files) scanFile(repoRoot, pluginRoot, rel, opts);

  const errors = findings.filter((f) => f.level === 'ERROR');
  const warns = findings.filter((f) => f.level === 'WARN');

  if (opts.format === 'json') {
    console.log(JSON.stringify({
      repo: repoRoot, plugin: opts.plugin, scanned: files.length,
      findings, summary: { errors: errors.length, warnings: warns.length },
    }, null, 2));
  } else {
    console.log(`\n=== install reachability (${opts.plugin} @ ${repoRoot}) ===`);
    console.log(`scanned ${files.length} files\n`);
    for (const f of [...errors, ...warns]) {
      console.log(`${f.level.padEnd(5)} [${f.code}] ${f.file}\n      ${f.message}`);
    }
    console.log(`\n--- 합계: ERROR ${errors.length} · WARN ${warns.length} ---`);
  }

  if (errors.length > 0) process.exit(1);
  if (opts.strict && warns.length > 0) process.exit(1);
  process.exit(0);
}

main();
