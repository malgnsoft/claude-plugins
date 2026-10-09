#!/usr/bin/env node
/**
 * malgnai-hub 인증 헤더 helper (plugin.json mcpServers.malgnai-hub.headersHelper 진입점).
 *
 * Claude Code가 MCP 연결마다 이 스크립트를 실행하고, stdout의 JSON을 HTTP 헤더로 쓴다.
 * 이 스크립트는 토큰을 저장·생성하지 않는다. 맑은에이전트 앱 실행파일을
 * `<exe> --hub-auth-header`로 호출해 그 결과를 검증한 뒤 그대로 전달할 뿐이다.
 *
 * 계약
 * - stdout: 성공했을 때만 `{"Authorization":"Bearer mhd_…"}` 한 줄. 실패하면 아무것도 쓰지 않는다.
 * - stderr: 실패·경고 안내 한 줄(`malgn-agent: <CODE>: <안내>`). 토큰(mhd_…)은 절대 싣지 않는다.
 * - 종료코드: 성공 0, 실패 1.
 * - 의존성: Node 내장 모듈만. 셸을 거치지 않는다.
 *
 * 같이 바꿔야 하는 값(하나만 바꾸면 CLI가 14로 토큰을 내주지 않거나 검증이 어긋난다):
 * - HUB_ORIGIN / HUB_MCP_PATH: plugin.json의 mcpServers.malgnai-hub.url, 앱 cli_mode의 audience 판정
 * - TOKEN_RE / 마스킹 정규식: 서버 토큰 접두사 `mhd_`와 길이(43자)
 * - CLI 종료코드 표(10~14) 안내 문구: 앱 CLI 계약
 * - 8초 타임아웃: Claude Code helper 한도 10초 안에서 CLI 자체 5초 데드라인과 두 겹으로 막는 값
 */
import { spawn } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { homedir as osHomedir } from 'node:os';
import { basename, dirname, isAbsolute, join, win32 } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HUB_ORIGIN = 'https://malgnai-hub.apiserver.kr';
export const HUB_MCP_PATH = '/mcp';
export const TIMEOUT_MS = 8000;
export const STDOUT_LIMIT = 4096;
export const TOKEN_RE = /^Bearer mhd_[A-Za-z0-9_-]{43}$/;
const MASK_RE = /mhd_[A-Za-z0-9_-]+/g;
const BEARER_MASK_RE = /Bearer\s+\S+/gi;

const MSG = {
  NOT_INSTALLED: '맑은에이전트 앱이 설치되어 있지 않습니다. 앱을 설치하고 허브에 연결하세요.',
  WRONG_AUDIENCE: '허브가 아닌 서버에는 토큰을 제공하지 않습니다. MCP 설정의 headersHelper를 확인하세요.',
  TIMEOUT: '맑은에이전트 앱 응답이 8초 안에 오지 않았습니다. 앱을 한 번 실행한 뒤 다시 시도하세요.',
  SPAWN_FAILED: '맑은에이전트 앱을 실행하지 못했습니다. 앱을 다시 설치하거나 실행해 보세요.',
  BAD_OUTPUT: '맑은에이전트 앱이 올바른 인증 헤더를 돌려주지 않았습니다. 앱을 최신 버전으로 업데이트하세요.',
  OVERRIDE: '개발 오버라이드(MALGN_AGENT_EXE) 사용 중',
};
// CLI 종료코드 → 안내(앱이 stderr를 비워 둔 경우의 대체 문구)
const CODE_MSG = {
  1: ['INTERNAL', '맑은에이전트 CLI 내부 오류'],
  10: ['NOT_CONNECTED', '맑은에이전트 앱에서 허브에 연결하세요.'],
  11: ['EXPIRED', '허브 토큰이 만료되었습니다. 맑은에이전트 앱에서 다시 연결하세요.'],
  12: ['KEYCHAIN_ERROR', '키체인에서 토큰을 읽지 못했습니다. 맑은에이전트 앱을 한 번 실행해 접근을 허용하세요.'],
  13: ['CORRUPT', '저장된 허브 연결 정보가 손상되었습니다. 앱에서 다시 연결하세요.'],
  14: ['WRONG_AUDIENCE', MSG.WRONG_AUDIENCE],
};

/** stderr 한 줄로 만든다: 토큰 마스킹, 제어문자 제거, 길이 제한. */
export function sanitizeLine(text) {
  const first = String(text ?? '').split(/\r?\n/).find((l) => l.trim()) ?? '';
  return first
    .replace(MASK_RE, 'mhd_***')
    .replace(BEARER_MASK_RE, 'Bearer ***')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .trim()
    .slice(0, 300);
}

/**
 * 대상 서버(audience) 확인. 환경변수가 없으면 허용(사람이 터미널에서 직접 실행하는 경우).
 * 있으면 origin·path가 허브 /mcp와 정확히 같고 query·fragment·userinfo가 없을 때만 허용한다(fail-closed).
 */
export function checkAudience(rawUrl) {
  if (rawUrl === undefined) return true;
  if (typeof rawUrl !== 'string' || /[?#]/.test(rawUrl)) return false;
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return false;
  }
  return (
    u.origin === HUB_ORIGIN &&
    u.pathname === HUB_MCP_PATH &&
    u.search === '' &&
    u.hash === '' &&
    u.username === '' &&
    u.password === ''
  );
}

/** POSIX 쓰기 권한 검사: 일반 파일, 소유자 현재 uid 또는 root, group/other 쓰기 비트 없음. 상위 2단계 디렉터리도 같은 기준. */
function posixSafe(file, uid) {
  try {
    const f = lstatSync(file);
    if (!f.isFile() || f.isSymbolicLink()) return false;
    const targets = [f];
    let dir = dirname(file);
    for (let i = 0; i < 2; i++) {
      const d = lstatSync(dir);
      if (d.isSymbolicLink() || !d.isDirectory()) return false;
      targets.push(d);
      dir = dirname(dir);
    }
    return targets.every((s) => (s.uid === uid || s.uid === 0) && (s.mode & 0o022) === 0);
  } catch {
    return false;
  }
}

function acceptable(candidate, platform, uid) {
  if (typeof candidate !== 'string' || !candidate) return false;
  const abs = platform === 'win32' ? win32.isAbsolute(candidate) : isAbsolute(candidate);
  if (!abs) return false;
  const name = platform === 'win32' ? win32.basename(candidate) : basename(candidate);
  if (name !== (platform === 'win32' ? 'malgn-agent.exe' : 'malgn-agent')) return false;
  if (platform === 'win32') {
    // Windows는 currentUser 설치라 쓰기 권한 검사를 두지 않는다. 존재 여부만 본다.
    try {
      return lstatSync(candidate).isFile();
    } catch {
      return false;
    }
  }
  return posixSafe(candidate, uid);
}

/**
 * 앱 실행파일 탐색. 순서: ① MALGN_AGENT_EXE ② locator 파일 ③ 기본경로.
 * 반환: { exe, warnings } — 못 찾으면 exe가 null.
 */
export function findExe({
  env = process.env,
  platform = process.platform,
  homedir = osHomedir(),
  uid = typeof process.getuid === 'function' ? process.getuid() : -1,
} = {}) {
  const warnings = [];
  const ok = (c) => acceptable(c, platform, uid);

  const override = env.MALGN_AGENT_EXE;
  if (override && ok(override)) {
    warnings.push(MSG.OVERRIDE);
    return { exe: override, warnings };
  }

  let locator = null;
  if (platform === 'darwin') locator = join(homedir, 'Library', 'Application Support', 'com.malgnsoft.agent', 'cli-path.json');
  else if (platform === 'win32' && env.APPDATA) locator = win32.join(env.APPDATA, 'com.malgnsoft.agent', 'cli-path.json');
  if (locator) {
    try {
      const exe = JSON.parse(readFileSync(locator, 'utf8'))?.exe;
      if (ok(exe)) return { exe, warnings };
    } catch {
      /* locator 없음·손상: 다음 후보로 */
    }
  }

  const defaults = [];
  if (platform === 'darwin') {
    defaults.push(
      '/Applications/malgn-agent.app/Contents/MacOS/malgn-agent',
      join(homedir, 'Applications', 'malgn-agent.app', 'Contents', 'MacOS', 'malgn-agent'),
    );
  } else if (platform === 'win32' && env.LOCALAPPDATA) {
    defaults.push(win32.join(env.LOCALAPPDATA, 'malgn-agent', 'malgn-agent.exe'));
  }
  for (const c of defaults) if (ok(c)) return { exe: c, warnings };
  return { exe: null, warnings };
}

/** 앱 실행. stdout 4KB 상한, timeoutMs 초과 시 강제 종료. 셸을 거치지 않는다. */
export function runExe(exe, { env = process.env, timeoutMs = TIMEOUT_MS } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(exe, ['--hub-auth-header'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        env,
      });
    } catch {
      resolve({ kind: 'spawn_error' });
      return;
    }
    let out = '';
    let err = '';
    let settled = false;
    let overflow = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // 손자 프로세스가 파이프를 붙잡고 있어도 래퍼가 끝나도록 스트림을 끊고 분리한다.
      child.stdout.destroy();
      child.stderr.destroy();
      child.unref();
      resolve(r);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ kind: 'timeout' });
    }, timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      out += d;
      if (Buffer.byteLength(out) > STDOUT_LIMIT) {
        overflow = true;
        child.kill('SIGKILL');
        finish({ kind: 'overflow' });
      }
    });
    child.stderr.on('data', (d) => {
      if (err.length < 2048) err += d;
    });
    child.on('error', () => finish({ kind: 'spawn_error' }));
    child.on('close', (code) => {
      if (overflow) return;
      finish({ kind: 'exit', code, stdout: out, stderr: err });
    });
  });
}

/** 성공 stdout 검증: 키가 정확히 Authorization 하나이고 값이 토큰 형식이어야 한다. */
export function parseHeader(stdout) {
  let obj;
  try {
    obj = JSON.parse(stdout);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== 'Authorization') return null;
  if (typeof obj.Authorization !== 'string' || !TOKEN_RE.test(obj.Authorization)) return null;
  return obj.Authorization;
}

const line = (code, msg) => `malgn-agent: ${code}: ${msg}`;

/** 전체 흐름. 부수효과 없이 { code, stdout, stderr[] }를 돌려준다(출력은 호출자가 한다). */
export async function run(opts = {}) {
  const env = opts.env ?? process.env;
  const stderr = [];
  const fail = (c, m) => ({ code: 1, stdout: '', stderr: [...stderr, line(c, m)] });

  // 0. audience 사전 차단 — 앱을 실행하기 전에 한다.
  if (!checkAudience(env.CLAUDE_CODE_MCP_SERVER_URL)) return fail('WRONG_AUDIENCE', MSG.WRONG_AUDIENCE);

  // 1. 실행파일 탐색
  const { exe, warnings } = findExe({ env, platform: opts.platform, homedir: opts.homedir, uid: opts.uid });
  for (const w of warnings) stderr.push(line('WARN', w));
  if (!exe) return fail('NOT_INSTALLED', MSG.NOT_INSTALLED);

  // 2. 실행
  const r = await runExe(exe, { env, timeoutMs: opts.timeoutMs ?? TIMEOUT_MS });
  if (r.kind === 'timeout') return fail('TIMEOUT', MSG.TIMEOUT);
  if (r.kind === 'spawn_error') return fail('SPAWN_FAILED', MSG.SPAWN_FAILED);
  if (r.kind === 'overflow') return fail('BAD_OUTPUT', MSG.BAD_OUTPUT);

  const appLine = sanitizeLine(r.stderr);

  // 3. 성공
  if (r.code === 0) {
    const auth = parseHeader(r.stdout);
    if (auth) {
      if (appLine) stderr.push(appLine.startsWith('malgn-agent:') ? appLine : `malgn-agent: ${appLine}`);
      return { code: 0, stdout: JSON.stringify({ Authorization: auth }) + '\n', stderr };
    }
    return fail('BAD_OUTPUT', MSG.BAD_OUTPUT);
  }

  // 4. 실패: 앱의 안내 첫 줄을 전달하고, 없으면 종료코드 표로 대체한다. stdout은 비운다.
  if (appLine) {
    stderr.push(appLine.startsWith('malgn-agent:') ? appLine : `malgn-agent: ${appLine}`);
    return { code: 1, stdout: '', stderr };
  }
  const [c, m] = CODE_MSG[r.code] ?? ['INTERNAL', CODE_MSG[1][1]];
  return fail(c, m);
}

function isMain() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
  }
}

if (isMain()) {
  const res = await run();
  for (const l of res.stderr) process.stderr.write(l + '\n');
  if (res.stdout) process.stdout.write(res.stdout);
  process.exitCode = res.code;
}
