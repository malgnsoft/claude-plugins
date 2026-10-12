// malgn-agent/bin/hub-auth-header.mjs 단위·프로세스 테스트 (node:test). 실행: pnpm run test:hub-auth
// 앱 실행파일은 가짜 스텁 스크립트로 대체한다. 실제 토큰은 쓰지 않고 형식만 맞춘 더미 값을 쓴다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkAudience, findExe, parseHeader, run, sanitizeLine } from '../malgn-agent/bin/hub-auth-header.mjs';

const WRAPPER = new URL('../malgn-agent/bin/hub-auth-header.mjs', import.meta.url).pathname;
const HUB_URL = 'https://malgnai-hub.apiserver.kr/mcp';
const DUMMY = 'mhd_' + 'A'.repeat(43); // 형식만 맞춘 더미
const GOOD_JSON = JSON.stringify({ Authorization: `Bearer ${DUMMY}` });
const posix = process.platform !== 'win32';

/** 임시 홈 아래 .../a/b/malgn-agent 스텁을 만든다(상위 2단계가 모두 내 소유 0700/0755). */
function sandbox(body, { mode = 0o755 } = {}) {
  const home = mkdtempSync(join(tmpdir(), 'hah-'));
  const dir = join(home, 'a', 'b');
  mkdirSync(dir, { recursive: true });
  const exe = join(dir, 'malgn-agent');
  const marker = join(home, 'ran');
  writeFileSync(exe, `#!/bin/sh\ntouch "${marker}"\n${body}\n`);
  chmodSync(exe, mode);
  return { home, exe, marker, cleanup: () => rmSync(home, { recursive: true, force: true }) };
}
const envFor = (s, extra = {}) => ({ PATH: process.env.PATH, MALGN_AGENT_EXE: s.exe, CLAUDE_CODE_MCP_SERVER_URL: HUB_URL, ...extra });
const printf = (s) => `printf '%s' '${s}'`;

test('audience: 허브 /mcp만 통과, 변형·비정상은 거부', () => {
  assert.equal(checkAudience(undefined), true);
  assert.equal(checkAudience(HUB_URL), true);
  assert.equal(checkAudience('https://MALGNAI-HUB.apiserver.kr:443/mcp'), true);
  for (const bad of [
    '', 'REDACTED', 'https://malgnai-hub.apiserver.kr/mcp/', 'https://malgnai-hub.apiserver.kr/MCP',
    'https://malgnai-hub.apiserver.kr/mcp/x', 'https://malgnai-hub.apiserver.kr/mcp?a=1', 'https://malgnai-hub.apiserver.kr/mcp?',
    'https://malgnai-hub.apiserver.kr/mcp#x', 'https://malgnai-hub.apiserver.kr:8443/mcp', 'http://malgnai-hub.apiserver.kr/mcp',
    'https://evil.example/mcp', 'https://malgnai-hub.apiserver.kr.evil.example/mcp', 'https://user:pw@malgnai-hub.apiserver.kr/mcp',
    'https://malgnai-hub.apiserver.kr/REDACTED', 'not a url',
  ]) assert.equal(checkAudience(bad), false, bad);
});

test('parseHeader: 키 1개·토큰 형식만 허용', () => {
  assert.equal(parseHeader(GOOD_JSON), `Bearer ${DUMMY}`);
  assert.equal(parseHeader(JSON.stringify({ Authorization: `Bearer ${DUMMY}`, X: '1' })), null);
  assert.equal(parseHeader(JSON.stringify({ authorization: `Bearer ${DUMMY}` })), null);
  assert.equal(parseHeader(JSON.stringify({ Authorization: `Bearer ${DUMMY}x` })), null);
  assert.equal(parseHeader(JSON.stringify({ Authorization: 'Bearer mhd_short' })), null);
  assert.equal(parseHeader(JSON.stringify({ Authorization: 'Basic abc' })), null);
  assert.equal(parseHeader('not json'), null);
  assert.equal(parseHeader('[]'), null);
  assert.equal(parseHeader(''), null);
});

test('sanitizeLine: 토큰·Bearer 마스킹, 첫 줄만, 제어문자 제거', () => {
  const s = sanitizeLine(`\n앞 ${DUMMY} Bearer abc.def\x07 끝\n두번째 ${DUMMY}`);
  assert.ok(!s.includes(DUMMY) && !s.includes('abc.def') && !s.includes('두번째'));
  assert.match(s, /mhd_\*\*\*/);
});

test('성공: 헤더 JSON 한 줄만 stdout, 토큰이 stderr에 없음', { skip: !posix }, async () => {
  const s = sandbox(printf(GOOD_JSON));
  try {
    const r = await run({ env: envFor(s), homedir: s.home });
    assert.equal(r.code, 0);
    assert.equal(r.stdout, GOOD_JSON + '\n');
    assert.ok(!r.stderr.join('\n').includes(DUMMY));
    assert.ok(r.stderr.some((l) => l.includes('MALGN_AGENT_EXE')), '오버라이드 경고 한 줄');
  } finally { s.cleanup(); }
});

test('성공 + 앱 경고(stderr)는 전달하되 토큰은 마스킹', { skip: !posix }, async () => {
  const s = sandbox(`echo "갱신 임박 ${DUMMY}" >&2\n${printf(GOOD_JSON)}`);
  try {
    const r = await run({ env: envFor(s), homedir: s.home });
    assert.equal(r.code, 0);
    assert.ok(r.stderr.join('\n').includes('갱신 임박'));
    assert.ok(!r.stderr.join('\n').includes(DUMMY));
  } finally { s.cleanup(); }
});

test('비정상 stdout(깨진 JSON·추가 키·잘못된 형식)은 실패, stdout 비움', { skip: !posix }, async () => {
  for (const body of [printf('garbage'), printf(JSON.stringify({ Authorization: `Bearer ${DUMMY}`, extra: 1 })), printf('{"Authorization":"Bearer mhd_x"}'), 'exit 0']) {
    const s = sandbox(body);
    try {
      const r = await run({ env: envFor(s), homedir: s.home });
      assert.equal(r.code, 1, body);
      assert.equal(r.stdout, '');
      assert.match(r.stderr.at(-1), /BAD_OUTPUT/);
    } finally { s.cleanup(); }
  }
});

test('종료코드 10~14·1: 앱 stderr가 있으면 전달, 없으면 표 문구, stdout 비움', { skip: !posix }, async () => {
  const table = { 10: '앱에서 허브에 연결하세요', 11: '만료', 12: '키체인', 13: '손상', 14: '허브가 아닌 서버', 1: '내부 오류', 77: '내부 오류' };
  for (const [code, needle] of Object.entries(table)) {
    const s = sandbox(`${printf(GOOD_JSON)}\nexit ${code}`); // 실패인데 stdout에 토큰을 써도 전달하면 안 된다
    try {
      const r = await run({ env: envFor(s), homedir: s.home });
      assert.equal(r.code, 1);
      assert.equal(r.stdout, '', `code ${code}`);
      assert.ok(r.stderr.at(-1).includes(needle), `code ${code}: ${r.stderr.at(-1)}`);
    } finally { s.cleanup(); }
  }
  const s = sandbox(`echo "malgn-agent: NOT_CONNECTED: 앱 안내 원문 ${DUMMY}" >&2\nexit 10`);
  try {
    const r = await run({ env: envFor(s), homedir: s.home });
    assert.equal(r.stderr.at(-1), 'malgn-agent: NOT_CONNECTED: 앱 안내 원문 mhd_***');
  } finally { s.cleanup(); }
});

test('audience 불일치: 스텁이 실행되지 않고 안내 후 exit 1', { skip: !posix }, async () => {
  for (const url of ['https://evil.example/mcp', 'https://malgnai-hub.apiserver.kr/mcp/x', '', 'REDACTED']) {
    const s = sandbox(printf(GOOD_JSON));
    try {
      const r = await run({ env: envFor(s, { CLAUDE_CODE_MCP_SERVER_URL: url }), homedir: s.home });
      assert.equal(r.code, 1);
      assert.equal(r.stdout, '');
      assert.match(r.stderr.at(-1), /WRONG_AUDIENCE/);
      assert.equal(existsSync(s.marker), false, `스텁이 실행됨: ${url}`);
    } finally { s.cleanup(); }
  }
});

test('타임아웃: 응답 없는 스텁은 강제 종료되고 exit 1', { skip: !posix }, async () => {
  const s = sandbox('sleep 30');
  try {
    const t0 = Date.now();
    const r = await run({ env: envFor(s), homedir: s.home, timeoutMs: 400 });
    assert.ok(Date.now() - t0 < 3000);
    assert.equal(r.code, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr.at(-1), /TIMEOUT/);
  } finally { s.cleanup(); }
});

test('stdout 4KB 초과는 실패 처리', { skip: !posix }, async () => {
  const s = sandbox(`head -c 9000 /dev/zero | tr '\\0' 'A'\nsleep 5`);
  try {
    const r = await run({ env: envFor(s), homedir: s.home, timeoutMs: 3000 });
    assert.equal(r.code, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr.at(-1), /BAD_OUTPUT/);
  } finally { s.cleanup(); }
});

test('앱 미설치: 안내 문구, exit 1', async () => {
  const home = mkdtempSync(join(tmpdir(), 'hah-'));
  try {
    const r = await run({ env: { CLAUDE_CODE_MCP_SERVER_URL: HUB_URL }, homedir: home, platform: 'linux' });
    assert.equal(r.code, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr.at(-1), /설치되어 있지 않습니다/);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('탐색 순서: 환경변수 > locator > 기본경로, 부적합 후보는 건너뜀', { skip: !posix }, () => {
  const a = sandbox('exit 0');
  const b = sandbox('exit 0');
  try {
    // locator(macOS 규칙)는 b를 가리킨다. platform을 darwin으로 가장해 locator 경로를 쓴다.
    const locDir = join(b.home, 'Library', 'Application Support', 'com.malgnsoft.agent');
    mkdirSync(locDir, { recursive: true });
    writeFileSync(join(locDir, 'cli-path.json'), JSON.stringify({ exe: b.exe, version: '0.0.0' }));
    const base = { platform: 'darwin', homedir: b.home };
    assert.equal(findExe({ ...base, env: { MALGN_AGENT_EXE: a.exe } }).exe, a.exe); // 1순위
    const viaLocator = findExe({ ...base, env: {} });
    assert.equal(viaLocator.exe, b.exe); // 2순위
    assert.deepEqual(viaLocator.warnings, []);
    // 환경변수가 부적합(상대경로·파일명 불일치)이면 locator로 넘어간다
    assert.equal(findExe({ ...base, env: { MALGN_AGENT_EXE: 'malgn-agent' } }).exe, b.exe);
    assert.equal(findExe({ ...base, env: { MALGN_AGENT_EXE: join(a.home, 'a', 'b', 'other') } }).exe, b.exe);
    // locator가 손상되면 기본경로(~/Applications)로
    writeFileSync(join(locDir, 'cli-path.json'), '{broken');
    const appDir = join(b.home, 'Applications', 'malgn-agent.app', 'Contents', 'MacOS');
    mkdirSync(appDir, { recursive: true });
    const def = join(appDir, 'malgn-agent');
    writeFileSync(def, '#!/bin/sh\n');
    chmodSync(def, 0o755);
    assert.equal(findExe({ ...base, env: {} }).exe, def); // 3순위
  } finally { a.cleanup(); b.cleanup(); }
});

test('쓰기 권한 검사(m4): group/other 쓰기 가능·심볼릭 링크·상위 디렉터리 쓰기 가능 후보는 건너뜀', { skip: !posix }, () => {
  const mk = (fn) => { const s = sandbox('exit 0'); fn(s); const r = findExe({ env: { MALGN_AGENT_EXE: s.exe }, platform: 'linux', homedir: s.home }); s.cleanup(); return r; };
  assert.equal(mk(() => {}).exe !== null, true, '정상 후보는 통과');
  assert.equal(mk((s) => chmodSync(s.exe, 0o775)).exe, null, 'group 쓰기');
  assert.equal(mk((s) => chmodSync(s.exe, 0o757)).exe, null, 'other 쓰기');
  assert.equal(mk((s) => chmodSync(join(s.exe, '..'), 0o777)).exe, null, '부모 디렉터리 other 쓰기');
  assert.equal(mk((s) => chmodSync(join(s.exe, '..', '..'), 0o775)).exe, null, '조부모 디렉터리 group 쓰기');
  const s = sandbox('exit 0');
  try {
    const real = join(s.home, 'a', 'b', 'real');
    writeFileSync(real, '#!/bin/sh\n'); chmodSync(real, 0o755);
    const link = join(s.home, 'a', 'b', 'x');
    mkdirSync(link, { recursive: true });
    const lnk = join(link, 'malgn-agent');
    symlinkSync(real, lnk);
    assert.equal(findExe({ env: { MALGN_AGENT_EXE: lnk }, platform: 'linux', homedir: s.home }).exe, null, '심볼릭 링크');
  } finally { s.cleanup(); }
});

test('프로세스 수준: 실패 시 stdout 비어 있음·exit 1, 성공 시 JSON 한 줄·exit 0', { skip: !posix }, () => {
  const ok = sandbox(printf(GOOD_JSON));
  const ng = sandbox('exit 10');
  const wa = sandbox(printf(GOOD_JSON));
  try {
    const r1 = spawnSync(process.execPath, [WRAPPER], { env: envFor(ok), encoding: 'utf8' });
    assert.equal(r1.status, 0);
    assert.equal(r1.stdout, GOOD_JSON + '\n');
    assert.ok(!r1.stderr.includes(DUMMY));
    const r2 = spawnSync(process.execPath, [WRAPPER], { env: envFor(ng), encoding: 'utf8' });
    assert.equal(r2.status, 1);
    assert.equal(r2.stdout, '');
    assert.match(r2.stderr, /NOT_CONNECTED: 맑은에이전트 앱에서 허브에 연결하세요/);
    const r3 = spawnSync(process.execPath, [WRAPPER], { env: envFor(wa, { CLAUDE_CODE_MCP_SERVER_URL: 'https://evil.example/mcp' }), encoding: 'utf8' });
    assert.equal(r3.status, 1);
    assert.equal(r3.stdout, '');
    assert.equal(existsSync(wa.marker), false);
  } finally { ok.cleanup(); ng.cleanup(); wa.cleanup(); }
});
