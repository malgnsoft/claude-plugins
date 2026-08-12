#!/usr/bin/env node
/**
 * check-edge-api-security.mjs
 *
 * Skill `domain-serverless-edge-api-security` §7 8단계 체크리스트를
 * 결정론적으로 자동 실행하는 스캐너. Cloudflare Workers·Hono·D1·MCP 스택 전용.
 *
 * 순수 Node.js 내장 모듈만 사용 — 의존성 설치 없이 바로 실행된다.
 * macOS/Linux/Windows 동일 동작 (path.join/path.sep 기준, git 명령은 있으면 쓰고 없으면 건너뜀).
 *
 * 사용법:
 *   node check-edge-api-security.mjs [projectRoot]
 *
 * 인자:
 *   projectRoot   점검 대상 프로젝트 루트 경로. 생략 시 process.cwd().
 *
 * 이 스크립트가 하는 일 / 하지 않는 일:
 *   - 8단계 각각의 "후보"를 정확한 grep 패턴·구조 대조로 찾아낸다 (결정론적).
 *   - 그레이 영역(의도적 public 엔드포인트 등)은 "확인 필요"로만 표시한다.
 *   - 최종 위험도 판단(Critical/High/Med/Low)과 악용 체인 서술은 하지 않는다 —
 *     그건 이 스크립트를 실행한 에이전트(LLM)가 §7-8 단계에서 코드를 직접 읽고 수행한다.
 *
 * 콘솔 출력만 지원한다(파일 저장 옵션 없음) — 필요하면 셸 리다이렉트를 직접 사용할 것.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { root: process.cwd() };
  for (const a of argv) {
    if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (!a.startsWith('-')) {
      opts.root = path.resolve(a);
    }
  }
  return opts;
}

function printHelp() {
  console.log(`사용법: node check-edge-api-security.mjs [projectRoot]

  projectRoot   점검 대상 프로젝트 루트 (생략 시 현재 디렉터리)

Cloudflare Workers·Hono·D1·MCP 스택 전용 API 보안 점검 스캐너.
Skill domain-serverless-edge-api-security §7의 8단계를 자동 실행해
후보 목록을 출력한다. 최종 위험도 판단은 사람/에이전트가 직접 한다.
`);
}

// ── 파일 수집 ──────────────────────────────────────────────────────────────

const EXCLUDE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.wrangler', 'coverage',
  '.next', '.turbo', '.output', 'out',
]);
const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts']);
const SQL_EXT = new Set(['.sql']);
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2MB 초과 파일은 건너뜀 (번들/생성물 방어)

function collectFiles(root) {
  const files = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // 권한 문제 등은 조용히 건너뜀
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.') && !['.dev.vars', '.env', '.gitignore'].includes(entry.name)) {
        // 숨김 디렉터리는 스킵하되, 시크릿/무시설정 관련 파일 자체는 아래에서 별도 취급
        if (entry.isDirectory() && EXCLUDE_DIRS.has(entry.name)) continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (CODE_EXT.has(ext) || SQL_EXT.has(ext) || entry.name === '.dev.vars' || entry.name === '.env' || entry.name === '.gitignore') {
          let stat;
          try { stat = fs.statSync(full); } catch { continue; }
          if (stat.size > MAX_FILE_BYTES) continue;
          files.push({ abs: full, rel: path.relative(root, full) });
        }
      }
    }
  }
  walk(root);
  return files;
}

function readAll(files) {
  return files.map((f) => {
    let content = '';
    try { content = fs.readFileSync(f.abs, 'utf8'); } catch { /* ignore */ }
    return { ...f, content };
  });
}

// ── 유틸 ───────────────────────────────────────────────────────────────────

function lineAt(content, index) {
  return content.slice(0, index).split('\n').length;
}

/** openIndex가 가리키는 여는 괄호(open)부터 균형 잡힌 닫는 괄호까지 부분 문자열을 반환.
 *  문자열('/"/`)·이스케이프 내부의 괄호는 무시한다. 못 찾으면 null. */
function extractBalanced(str, openIndex, open = '(', close = ')') {
  let depth = 0;
  let inStr = null; // '\'' | '"' | '`' | null
  for (let i = openIndex; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return { text: str.slice(openIndex, i + 1), end: i };
    }
  }
  return null;
}

/** 균형 잡힌 괄호 안 내용을 최상위 콤마로 분리 (중첩 괄호/문자열 내부 콤마는 무시) */
function splitTopLevelArgs(inner) {
  const args = [];
  let depth = 0;
  let inStr = null;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (inStr) {
      cur += ch;
      if (ch === '\\') { cur += inner[++i] ?? ''; continue; }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') { inStr = ch; cur += ch; continue; }
    if ('([{'.includes(ch)) { depth++; cur += ch; continue; }
    if (')]}'.includes(ch)) { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function isStringLiteral(s) {
  return /^['"`]/.test(s.trim());
}

function stripQuotes(s) {
  const t = s.trim();
  return t.replace(/^['"`]|['"`]$/g, '');
}

const section = (title) => `\n${'─'.repeat(70)}\n${title}\n${'─'.repeat(70)}`;

// ── STEP 1: dao/init.js 스키마 → 민감 컬럼 식별 ─────────────────────────────

const SENSITIVE_KEYWORDS = [
  'content', 'prompt', 'password', 'secret', 'token', 'apikey', 'api_key',
  'email', 'phone', 'address', 'ssn', 'credit', 'card', 'memo', 'comment',
  'message', 'body', 'bio', 'raw', 'plain', 'cost', 'amount', 'usage',
  'session', 'note', 'first_prompt', 'last_prompt', 'ip', 'auth',
];

function step1_schema(files) {
  const out = [];
  const schemaFiles = files.filter(
    (f) => /dao[\\/]init\.(js|ts)$/i.test(f.rel) || /schema\.(js|ts|sql)$/i.test(f.rel) || /CREATE\s+TABLE/i.test(f.content)
  );
  if (schemaFiles.length === 0) {
    out.push('스키마 파일(CREATE TABLE 포함)을 찾지 못했습니다 — 수동으로 dao/init.js 등을 확인하세요.');
    return out;
  }
  for (const f of schemaFiles) {
    const re = /CREATE\s+TABLE[^(]*\(/gi;
    let m;
    while ((m = re.exec(f.content))) {
      const openIdx = m.index + m[0].length - 1;
      const block = extractBalanced(f.content, openIdx);
      if (!block) continue;
      const tableNameMatch = f.content.slice(m.index, openIdx).match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/i);
      const tableName = tableNameMatch ? tableNameMatch[1] : '(테이블명 미상)';
      const cols = [];
      for (const rawLine of block.text.split(',')) {
        const colMatch = rawLine.trim().match(/^[`"']?(\w+)[`"']?\s+(TEXT|INTEGER|REAL|BLOB|VARCHAR|CHAR|BOOLEAN|DATETIME|TIMESTAMP|NUMERIC)/i);
        if (colMatch) cols.push(colMatch[1]);
      }
      const sensitive = cols.filter((c) => SENSITIVE_KEYWORDS.some((kw) => c.toLowerCase().includes(kw)));
      out.push(`[${f.rel}:${lineAt(f.content, m.index)}] 테이블 \`${tableName}\` — 컬럼 ${cols.length}개 중 민감 후보 ${sensitive.length}개`);
      if (sensitive.length > 0) {
        out.push(`    민감 후보(확인 필요): ${sensitive.join(', ')}`);
      }
    }
  }
  return out;
}

// ── STEP 2: 전역 미들웨어 체인 (index.js) — 인증 유무, /mcp 보호 유무 ────────

const AUTH_NAME_RE = /middleware|auth|apikey|api_key|jwt|bearer|verify|guard|requireauth/i;
// app/router 등 라우터로 보이는 식별자만 대상으로 삼는다 — stmt.all() 같은 무관한 메서드(Promise/Array 등)
// 호출을 오탐하지 않기 위한 최소 필터. 완전한 파서가 아니므로 여전히 false positive/negative 여지는 있다.
const ROUTER_OBJ_RE = /router|app|api|route/i;

function step2_globalMiddleware(files) {
  const out = [];
  const entryFiles = files.filter((f) => /new\s+Hono\s*\(/.test(f.content));
  if (entryFiles.length === 0) {
    out.push('Hono 엔트리 파일(`new Hono(...)` 포함)을 찾지 못했습니다 — index.js 위치를 수동 확인하세요.');
    return out;
  }
  for (const f of entryFiles) {
    const useRe = /\b([a-zA-Z_$][\w$]*)\.(use|all|route)\s*\(/g;
    let m;
    let sawGlobalAuth = false;
    let mcpLine = null;
    let mcpProtected = null;
    let mcpViaRoute = false;
    let anyCall = false;
    while ((m = useRe.exec(f.content))) {
      if (!ROUTER_OBJ_RE.test(m[1])) continue; // stmt.all() 등 라우터 무관 메서드 호출 배제
      anyCall = true;
      const openIdx = m.index + m[0].length - 1;
      const call = extractBalanced(f.content, openIdx);
      if (!call) continue;
      const args = splitTopLevelArgs(call.text.slice(1, -1));
      const ln = lineAt(f.content, m.index);
      const argsPreview = args.map((a) => a.length > 40 ? a.slice(0, 40) + '…' : a).join(', ');
      const hasAuthArg = args.some((a) => AUTH_NAME_RE.test(a));
      out.push(`[${f.rel}:${ln}] ${m[1]}.${m[2]}(${argsPreview})${hasAuthArg ? '  ← 인증 관련 인자 감지' : ''}`);
      if (m[2] !== 'route') {
        if (hasAuthArg && args.some((a) => isStringLiteral(a) && /\*|\/api/i.test(stripQuotes(a)))) {
          sawGlobalAuth = true;
        } else if (hasAuthArg && !isStringLiteral(args[0] || '')) {
          // app.use(middleware) 형태(경로 생략, 전역 적용)
          sawGlobalAuth = true;
        }
      }
      if (args.some((a) => isStringLiteral(a) && stripQuotes(a).includes('/mcp'))) {
        mcpLine = ln;
        mcpProtected = hasAuthArg;
        mcpViaRoute = m[2] === 'route';
      }
    }
    if (!anyCall) continue; // 이 파일은 `new Hono()`만 있고 전역 use/all/route 호출은 없음 — 하위 라우터 정의 파일일 뿐, 요약 생략
    out.push(`  → 전역 인증 미들웨어 감지: ${sawGlobalAuth ? '있음' : '❌ 없음/미확인 — 확인 필요'}`);
    if (mcpLine != null) {
      if (mcpViaRoute) {
        out.push(`  → /mcp가 .route()로 서브 라우터 마운트됨 (line ${mcpLine}) — 이 호출 자체엔 인증 인자가 없음(Hono route()는 원래 안 받음). 하위 라우터(mcp/tools.js) 또는 이 라인 앞의 전역 use()가 실제로 /mcp를 커버하는지 별도 확인 필요.`);
      } else {
        out.push(`  → /mcp 관련 use/all 발견 (line ${mcpLine}): 인증 인자 ${mcpProtected ? '있음' : '❌ 없음 — 확인 필요'}`);
      }
    } else {
      out.push('  → 이 파일에서 /mcp 관련 use/all/route 호출을 찾지 못함 — mcp 라우트 마운트 위치를 별도 확인하세요.');
    }
  }
  return out;
}

// ── STEP 3: 라우트별 미들웨어 부착 Grep → 비-GET 라우트와 대조 ───────────────

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'all'];

function step3_routeMiddlewareDiff(files) {
  const out = [];
  const unprotectedNonGet = [];
  const protectedCount = { count: 0 };
  const routeFiles = files.filter((f) => HTTP_METHODS.some((m) => new RegExp(`\\.${m}\\s*\\(`).test(f.content)));

  for (const f of routeFiles) {
    const callRe = new RegExp(`\\b([a-zA-Z_$][\\w$]*)\\.(${HTTP_METHODS.join('|')})\\s*\\(`, 'g');
    let m;
    while ((m = callRe.exec(f.content))) {
      const objName = m[1];
      const method = m[2];
      if (!ROUTER_OBJ_RE.test(objName)) continue; // axios.get() 등 노이즈 배제
      const openIdx = m.index + m[0].length - 1;
      const call = extractBalanced(f.content, openIdx);
      if (!call) continue;
      const args = splitTopLevelArgs(call.text.slice(1, -1));
      if (args.length === 0 || !isStringLiteral(args[0])) continue; // 첫 인자가 경로 문자열이 아니면 라우트 아님
      const routePath = stripQuotes(args[0]);
      const middlewareArgs = args.slice(1, -1); // 마지막은 대개 핸들러
      const hasAuth = middlewareArgs.some((a) => AUTH_NAME_RE.test(a));
      const ln = lineAt(f.content, m.index);
      if (hasAuth) {
        protectedCount.count++;
      } else if (method !== 'get') {
        unprotectedNonGet.push(`[${f.rel}:${ln}] ${objName}.${method}('${routePath}') — 인증 미들웨어 인자 없음`);
      } else {
        out.push(`[${f.rel}:${ln}] ${objName}.get('${routePath}') — 미들웨어 없음 (GET, 확인 필요: 의도적 public 읽기인지)`);
      }
    }
  }

  out.unshift(`인증 미들웨어 부착된 라우트: ${protectedCount.count}건`);
  if (unprotectedNonGet.length > 0) {
    out.push('❌ 인증 미들웨어 없는 비-GET(쓰기 가능) 라우트 — 우선 확인 대상:');
    out.push(...unprotectedNonGet.map((s) => '  ' + s));
  } else {
    out.push('비-GET 라우트 중 미들웨어 없이 등록된 곳은 발견되지 않음(패턴 매칭 기준).');
  }
  return out;
}

// ── STEP 4: fail-open 분기 / JWT alg 검증 ───────────────────────────────────

function step4_failOpenAndJwt(files) {
  const out = [];
  const authFiles = files.filter(
    (f) => /middleware/i.test(f.rel) || /auth/i.test(f.rel) || /Middleware\s*=|function\s+\w*[Mm]iddleware/.test(f.content)
  );
  if (authFiles.length === 0) {
    out.push('미들웨어/인증 관련 파일을 찾지 못했습니다 — middleware/auth.js 등을 수동 확인하세요.');
  }
  // 중괄호 블록형: if (!x) { ... next() ... }
  const failOpenBraceRe = /if\s*\(\s*!\s*([\w.]+)\s*\)\s*\{([^{}]{0,300}?)\}/gs;
  // 브레이스리스 단일문장형: if (!x) return next(); / if (!x) next(); / if (!x) await next();
  // 음의 전방탐색으로 '{'로 시작하는 블록형과는 겹치지 않게 하고, ';'까지를 한 문장으로 본다
  // (세미콜론·개행·중괄호가 나오기 전까지만 허용해 이후 문장까지 잘못 삼키지 않는다).
  const failOpenInlineRe = /if\s*\(\s*!\s*([\w.]+)\s*\)\s*(?!\{)([^;\n{}]{0,150});/g;
  for (const f of authFiles) {
    let m;
    while ((m = failOpenBraceRe.exec(f.content))) {
      if (/\bnext\s*\(\s*\)/.test(m[2])) {
        const ln = lineAt(f.content, m.index);
        out.push(`❌ [${f.rel}:${ln}] fail-open 후보: if (!${m[1]}) { …next()… } — 조건 미충족 시 인증 없이 통과. 확인 필요.`);
      }
    }
    failOpenInlineRe.lastIndex = 0;
    while ((m = failOpenInlineRe.exec(f.content))) {
      if (/\bnext\s*\(\s*\)/.test(m[2])) {
        const ln = lineAt(f.content, m.index);
        const stmt = m[2].trim();
        out.push(`❌ [${f.rel}:${ln}] fail-open 후보(브레이스리스): if (!${m[1]}) ${stmt}; — 조건 미충족 시 인증 없이 통과. 확인 필요.`);
      }
    }
  }
  const jwtFiles = files.filter((f) => /crypto\.subtle|jsonwebtoken|jwt/i.test(f.content) && /verify/i.test(f.content));
  for (const f of jwtFiles) {
    const hasAlgCheck = /\balg\b/i.test(f.content);
    out.push(`[${f.rel}] JWT 검증 코드 발견 — alg 필드 검증 참조: ${hasAlgCheck ? '있음(확인 필요: 화이트리스트 검증인지)' : '❌ 없음 — alg 혼동/none 공격 취약 가능, 확인 필요'}`);
  }
  if (jwtFiles.length === 0) out.push('JWT 자체 검증 코드(crypto.subtle/jsonwebtoken + verify)를 찾지 못함 — 해당 없음이거나 다른 방식.');
  return out;
}

// ── STEP 5: mcp/tools.js 무인증 노출 쓰기 도구 식별 ─────────────────────────

const WRITE_TOOL_RE = /_?(create|update|delete|remove|add|set|log|record|write|insert)\b|^(create|update|delete|remove|add|set)/i;

function step5_mcpTools(files, mcpProtectedHint) {
  const out = [];
  const toolFiles = files.filter(
    (f) => /mcp[\\/].*tools?\.(js|ts)$/i.test(f.rel) || /registerTool|server\.tool\s*\(|\.tool\s*\(/.test(f.content)
  );
  if (toolFiles.length === 0) {
    out.push('mcp/tools.js(또는 registerTool/server.tool 패턴)를 찾지 못했습니다 — MCP 서버 미사용이거나 다른 경로.');
    return out;
  }
  for (const f of toolFiles) {
    const toolRe = /\.(?:registerTool|tool)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let m;
    const names = [];
    while ((m = toolRe.exec(f.content))) names.push(m[1]);
    if (names.length === 0) continue;
    const writeTools = names.filter((n) => WRITE_TOOL_RE.test(n));
    const readTools = names.filter((n) => !WRITE_TOOL_RE.test(n));
    out.push(`[${f.rel}] 등록 도구 ${names.length}개 — 쓰기 후보 ${writeTools.length}개, 읽기 후보 ${readTools.length}개`);
    if (writeTools.length > 0) {
      const risk = mcpProtectedHint === false ? '❌ (§2에서 /mcp 무인증으로 판정됨 — 원격 데이터 조작 가능, 우선 확인)' : '(확인 필요)';
      out.push(`  쓰기 도구 ${risk}: ${writeTools.join(', ')}`);
    }
    if (readTools.length > 0) out.push(`  읽기 도구(참고): ${readTools.join(', ')}`);
  }
  return out;
}

// ── STEP 6: DAO bind 파라미터화 확인 / 동적 컬럼명 ──────────────────────────

function step6_sqlBinding(files) {
  const out = [];
  let safeCount = 0;
  const suspects = [];
  const prepareRe = /\.prepare\s*\(/g;
  for (const f of files) {
    let m;
    prepareRe.lastIndex = 0;
    while ((m = prepareRe.exec(f.content))) {
      const openIdx = m.index + '.prepare'.length;
      const call = extractBalanced(f.content, openIdx);
      if (!call) continue;
      const sql = call.text.slice(1, -1);
      const ln = lineAt(f.content, m.index);
      const isTemplate = /^`/.test(sql.trim());
      const hasInterp = /\$\{/.test(sql);
      const followedByBind = f.content.slice(call.end, call.end + 60).includes('.bind(');
      if (isTemplate && hasInterp) {
        suspects.push(`❌ [${f.rel}:${ln}] .prepare(템플릿 리터럴 + \${...} 삽입) — 동적 컬럼/테이블명 후보, 확인 필요`);
      } else if (followedByBind) {
        safeCount++;
      } else {
        out.push(`[${f.rel}:${ln}] .prepare() 발견, .bind() 미확인 (인자 없는 쿼리이거나 다른 실행 방식일 수 있음)`);
      }
    }
    // 문자열 결합으로 SQL을 조립하는 패턴 (템플릿 밖에서 + 연산)
    const concatRe = /(SELECT|INSERT|UPDATE|DELETE)[^;'"`]{0,80}['"`]\s*\+\s*\w+/gi;
    let cm;
    while ((cm = concatRe.exec(f.content))) {
      suspects.push(`❌ [${f.rel}:${lineAt(f.content, cm.index)}] 문자열 '+' 결합으로 SQL 조립 후보 — SQLi 확인 필요`);
    }
  }
  out.unshift(`bind() 파라미터화 확인된 prepare() 호출: ${safeCount}건 (양호 후보)`);
  out.push(...suspects);
  if (suspects.length === 0) out.push('동적 컬럼명 조립·문자열 결합 SQL 후보는 발견되지 않음(패턴 매칭 기준) — SQLi보다 인증 부재를 우선 점검.');
  return out;
}

// ── STEP 7: cors() 무인자 / sync 루프 상한 / rate limit / .dev.vars 추적 ────

function step7_corsAndDos(files, root) {
  const out = [];

  // cors() 무인자
  for (const f of files) {
    const re = /\bcors\s*\(\s*\)/g;
    let m;
    while ((m = re.exec(f.content))) {
      out.push(`❌ [${f.rel}:${lineAt(f.content, m.index)}] cors() 무인자 호출 — Origin reflect(사실상 *) 위험, 확인 필요`);
    }
  }

  // for-of + await ...run() 루프 (상한 검증 여부는 근처 300자 내 .length 비교로 근사 확인)
  const loopRe = /for\s*\(\s*(?:const|let)\s+\w+\s+of\s+([\w.]+)\s*\)\s*\{([^{}]{0,400}?await\s+[\w.]+\.run\s*\()/gs;
  for (const f of files) {
    let m;
    loopRe.lastIndex = 0;
    while ((m = loopRe.exec(f.content))) {
      const ln = lineAt(f.content, m.index);
      const before = f.content.slice(Math.max(0, m.index - 300), m.index);
      const hasLenCheck = /\.length\s*[<>]=?\s*\d+|MAX[_A-Z]*\s*[<>=]/i.test(before);
      out.push(`[${f.rel}:${ln}] for-of + await ${m[1]}... run() 루프 — 상한 검증 ${hasLenCheck ? '근처에서 발견됨(확인 필요)' : '❌ 미발견, 확인 필요: db.batch() 또는 length 상한 권고'}`);
    }
  }

  // rate limiting 존재 여부 (프로젝트 전체 스캔)
  const hasRateLimit = files.some((f) => /rate.?limit/i.test(f.content));
  out.push(hasRateLimit ? 'rate limiting 관련 코드 발견됨 — 실제 적용 범위 확인 필요.' : '❌ 프로젝트 전체에서 rate limiting 관련 코드 미발견 — 확인 필요.');

  // .dev.vars / .env git 추적 여부
  const secretFiles = files.filter((f) => path.basename(f.rel) === '.dev.vars' || path.basename(f.rel) === '.env');
  if (secretFiles.length === 0) {
    out.push('.dev.vars/.env 파일이 프로젝트 내에 없음(정상 — 시크릿은 Workers Secret으로 주입되는 구조일 수 있음).');
  } else {
    let tracked = [];
    try {
      const lsFiles = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
      const trackedSet = new Set(lsFiles.split('\n').filter(Boolean));
      tracked = secretFiles.filter((f) => trackedSet.has(f.rel.split(path.sep).join('/')));
    } catch {
      out.push('git 명령 실행 불가(git 미설치 또는 git 저장소 아님) — .dev.vars/.env git 추적 여부는 수동으로 `git ls-files`로 확인하세요.');
    }
    if (tracked.length > 0) {
      out.push(`❌ [Critical 후보] git으로 추적되는 시크릿 파일 발견: ${tracked.map((f) => f.rel).join(', ')}`);
    } else {
      out.push(`.dev.vars/.env 파일 ${secretFiles.length}개 발견, git 추적은 안 되는 것으로 확인(또는 확인 불가 — 위 메시지 참고).`);
    }
  }

  return out;
}

// ── 메인 ───────────────────────────────────────────────────────────────────

function main() {
  const { root } = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`프로젝트 루트를 찾을 수 없습니다: ${root}`);
    process.exit(1);
  }

  console.log(`# 서버리스/엣지 API 보안 점검 스캔 결과\n`);
  console.log(`대상: ${root}`);
  console.log(`스캔 시각: ${new Date().toLocaleString('ko-KR', { hour12: false })}`);

  const rawFiles = collectFiles(root);
  if (rawFiles.length === 0) {
    console.log('\n대상 코드 파일(.js/.mjs/.cjs/.ts/.sql)을 찾지 못했습니다. 경로를 확인하세요.');
    process.exit(1);
  }
  const files = readAll(rawFiles);
  console.log(`스캔 파일 수: ${files.length}개\n`);

  console.log(section('STEP 1. 스키마 → 민감 컬럼 식별 (dao/init.js 등)'));
  step1_schema(files).forEach((l) => console.log(l));

  console.log(section('STEP 2. 전역 미들웨어 체인 (index.js) — 인증 유무, /mcp 보호 유무'));
  const step2Lines = step2_globalMiddleware(files);
  step2Lines.forEach((l) => console.log(l));
  const mcpProtectedHint = step2Lines.some((l) => l.includes('/mcp') && l.includes('있음'))
    ? true
    : step2Lines.some((l) => l.includes('/mcp') && l.includes('없음'))
    ? false
    : null;

  console.log(section('STEP 3. 라우트별 미들웨어 부착 Grep → 비-GET 라우트 대조'));
  step3_routeMiddlewareDiff(files).forEach((l) => console.log(l));

  console.log(section('STEP 4. fail-open 분기 / JWT alg 검증'));
  step4_failOpenAndJwt(files).forEach((l) => console.log(l));

  console.log(section('STEP 5. mcp/tools.js 무인증 노출 쓰기 도구 식별'));
  step5_mcpTools(files, mcpProtectedHint).forEach((l) => console.log(l));

  console.log(section('STEP 6. DAO bind() 파라미터화 / 동적 컬럼명·SQL 결합'));
  step6_sqlBinding(files).forEach((l) => console.log(l));

  console.log(section('STEP 7. cors() 무인자 / sync 루프 상한 / rate limit / .dev.vars 추적'));
  step7_corsAndDos(files, root).forEach((l) => console.log(l));

  console.log(section('STEP 8. (수동) 원인→증폭→데이터→영향→재현→권고 체인 작성'));
  console.log('이 단계는 자동화 대상이 아닙니다. 위 STEP 1~7에서 나온 각 "확인 필요"/❌ 후보를');
  console.log('실제 코드로 열어 확인한 뒤, 단일 결함이 아니라 결함들의 결합(chain)으로 서술하세요.');
  console.log('예: 함정1(무인증) → CORS reflect(증폭) → 어떤 데이터가 → 누구에게 → curl 재현 → 권고.');

  console.log('\n' + '─'.repeat(70));
  console.log('주의: 이 스크립트는 정규식/구조 기반 후보 탐지기입니다. "❌"/"확인 필요" 표시는');
  console.log('전부 그레이 영역 후보이며 최종 위험도 판단은 하지 않습니다. False positive/negative가');
  console.log('있을 수 있으므로 반드시 실제 코드를 열어 확인한 뒤 보고서에 반영하세요.');
}

main();
