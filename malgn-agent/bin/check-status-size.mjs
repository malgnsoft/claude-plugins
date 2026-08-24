#!/usr/bin/env node
/**
 * check-status-size.mjs
 *
 * Skill `project-standards` §3이 요구하는 STATUS.md 바이트 상한(기본 3,000B)을 기계적으로 판정한다.
 * SessionStart 훅이 매 세션 STATUS.md를 주입하므로, 여기서 늘어난 1줄은 앞으로 열리는 모든 세션에
 * 곱해져 물린다. 토큰은 세션에서 셀 수 없지만 바이트는 셀 수 있어 상한을 바이트로 잡는다
 * (한글은 UTF-8 3바이트/글자이고 토큰당 1글자를 넘지 않으므로, 3,000B면 전부 한글이어도 1,000토큰 안에 들어온다).
 *
 * 훅에도 자체 상한이 있지만(hooks/sessionstart-context.mjs: 기본 12,000B를 넘으면 줄 경계에서 잘라
 * 앞부분만 주입) 그것은 폭주를 막는 안전선이지 목표가 아니다. 이 스크립트의 3,000B가 지켜야 할 선이고,
 * 훅 상한에 걸릴 만큼 커졌다면 이미 한참 늦은 상태다.
 *
 * STATUS.md는 `.gitignore` 대상(직원별 로컬 캐시)이라 CI가 대신 잡아주지 못한다 — 고친 사람이
 * 그 자리에서 이 스크립트를 돌리는 것이 유일한 게이트다.
 *
 * 순수 Node.js 내장 모듈만 사용 — 의존성 설치 없이 실행된다(bin/analyze-usage.mjs와 동일 스타일,
 * macOS/Windows 동일 동작). 검사 대상은 **현재 작업 디렉터리(cwd)의 STATUS.md**이므로 어느 프로젝트
 * 루트에서 실행해도 그 프로젝트를 검사한다.
 *
 * 사용법:
 *   node check-status-size.mjs [projectRoot] [--limit N] [--require] [--format text|json]
 *
 * 인자·옵션:
 *   projectRoot    STATUS.md가 있는 프로젝트 루트. 기본값 process.cwd().
 *   --limit N      바이트 상한. 기본 3000. 환경변수 STATUS_SIZE_GATE_BYTES로도 지정 가능(옵션이 우선).
 *                  훅의 주입 절단 상한(MALGN_STATUS_MAX_BYTES)과는 다른 값이다 — 이름을 비슷하게 두면
 *                  서로 바꿔 설정해도 아무도 눈치채지 못하므로 접두어와 낱말을 모두 다르게 잡는다.
 *   --require      STATUS.md가 없을 때도 실패(exit 1)로 취급한다. 기본은 SKIP(exit 0).
 *   --format       text(기본) | json — json은 판정 결과를 그대로 출력해 후속 자동화에서 파싱한다.
 *
 * 종료 코드:
 *   0  OK(상한 이내) 또는 SKIP(STATUS.md 없음, --require 미지정)
 *   1  상한 초과, 또는 --require 지정 상태에서 STATUS.md 없음
 *   2  사용법 오류 / 파일을 읽을 수 없음(권한·디렉터리 등 ENOENT 이외의 오류)
 *
 * STATUS.md가 없는 환경을 실패가 아니라 SKIP으로 두는 이유: STATUS.md는 `.gitignore` 대상이라
 * 새 클론·CI·아직 초기화되지 않은 폴더에는 정상적으로 존재하지 않는다. 그런 곳에서 실패로 처리하면
 * "상한 초과"라는 exit 1의 의미가 흐려져 게이트로 못 쓴다. 다만 파일이 없다는 사실 자체는 잘못된
 * 디렉터리에서 실행했다는 신호일 수 있으므로 SKIP 메시지에 실제로 찾아본 절대경로를 찍고,
 * 반드시 존재해야 하는 자리(스캐폴딩 검증 등)에서는 `--require`로 실패로 승격할 수 있게 한다.
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_LIMIT = 3000;

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function printHelp() {
  const SELF = `node "${process.argv[1]}"`;
  console.log(`STATUS.md 크기 게이트 (기본 상한 ${DEFAULT_LIMIT}B)

사용법:
  ${SELF} [projectRoot] [--limit N] [--require] [--format text|json]

  projectRoot    STATUS.md가 있는 프로젝트 루트 (기본: 현재 작업 디렉터리)
  --limit N      바이트 상한 (기본 ${DEFAULT_LIMIT}, 환경변수 STATUS_SIZE_GATE_BYTES도 인식)
  --require      STATUS.md가 없으면 실패로 취급 (기본은 SKIP)
  --format       text | json (기본 text)

종료 코드: 0=OK/SKIP, 1=상한 초과, 2=사용법·읽기 오류`);
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = {
    root: null,
    limit: null,
    require: false,
    format: 'text',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--limit': {
        const v = Number(argv[++i]);
        if (!Number.isFinite(v) || v <= 0) fail(`--limit 값이 올바르지 않다: ${argv[i]}`);
        opts.limit = v;
        break;
      }
      case '--require':
        opts.require = true;
        break;
      case '--format': {
        const v = argv[++i];
        if (v !== 'text' && v !== 'json') fail(`알 수 없는 --format 값: ${v} (text|json만 허용)`);
        opts.format = v;
        break;
      }
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith('-')) fail(`알 수 없는 옵션: ${a}`);
        if (opts.root !== null) fail(`projectRoot는 하나만 지정한다: ${a}`);
        opts.root = a;
    }
  }

  if (opts.limit === null) {
    const envLimit = Number(process.env.STATUS_SIZE_GATE_BYTES);
    opts.limit = Number.isFinite(envLimit) && envLimit > 0 ? envLimit : DEFAULT_LIMIT;
  }
  opts.root = path.resolve(opts.root ?? process.cwd());
  return opts;
}

// ── 본문 통계 ─────────────────────────────────────────────────────────────

/** 상한 초과 시 어디를 줄일지 보이도록 `##` 섹션별 바이트를 큰 순서로 뽑는다. */
function sectionSizes(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = { title: '(머리말)', bytes: 0 };
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current.bytes > 0) sections.push(current);
      current = { title: line.replace(/^#+\s*/, '').trim(), bytes: 0 };
    }
    current.bytes += Buffer.byteLength(line, 'utf-8') + 1; // 개행 1B 포함
  }
  if (current.bytes > 0) sections.push(current);
  return sections.sort((a, b) => b.bytes - a.bytes);
}

// ── 실행 ──────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2));
const target = path.join(opts.root, 'STATUS.md');

let buf;
try {
  buf = fs.readFileSync(target);
} catch (err) {
  if (err && err.code === 'ENOENT') {
    // STATUS.md는 .gitignore 대상(직원별 로컬 파일)이다. 없는 환경(새 클론·CI·미초기화 폴더)에서는
    // 검사할 대상이 없는 것이지 실패가 아니다. 다만 경로를 찍어 "엉뚱한 디렉터리에서 실행"을 구분한다.
    // --require가 켜져 있으면 "없음"이 곧 실패다 — 종료코드만 1로 바꾸고 화면에는 SKIP이라고
    // 적으면 읽는 사람이 통과로 오해한다. 표기와 종료코드를 같이 뒤집는다.
    const status = opts.require ? 'fail' : 'skip';
    if (opts.format === 'json') {
      console.log(JSON.stringify({ status, path: target, reason: 'STATUS.md 없음' }, null, 2));
    } else if (opts.require) {
      console.error(`FAIL  STATUS.md 없음 — 반드시 있어야 하는 자리다`);
      console.error(`      찾아본 경로: ${target}`);
      console.error(`      실행 위치(cwd)가 맞는지, 프로젝트가 초기화됐는지 확인할 것.`);
    } else {
      console.log(`SKIP  STATUS.md 없음 — 검사 대상 없음`);
      console.log(`      찾아본 경로: ${target}`);
      console.log(`      이 프로젝트에 STATUS.md가 있어야 한다면 실행 위치(cwd)를 확인할 것.`);
    }
    process.exit(opts.require ? 1 : 0);
  }
  // 권한 없음·디렉터리임 등은 "대상 없음"과 다르다 — 조용히 통과시키지 않는다.
  if (opts.format === 'json') {
    console.log(JSON.stringify({ status: 'error', path: target, reason: String(err && err.message) }, null, 2));
  } else {
    console.error(`ERROR STATUS.md를 읽을 수 없다 — ${target}`);
    console.error(`      ${err && err.message}`);
  }
  process.exit(2);
}

const bytes = buf.length;
const text = buf.toString('utf-8');
const limit = opts.limit;
const over = bytes > limit;
const lineCount = text.split('\n').length;
const hangul = (text.match(/[가-힣]/g) || []).length;
const pct = Math.round((bytes / limit) * 100);

if (opts.format === 'json') {
  console.log(JSON.stringify({
    status: over ? 'fail' : 'ok',
    path: target,
    bytes,
    limit,
    percent: pct,
    lines: lineCount,
    hangul,
    overBy: over ? bytes - limit : 0,
    headroom: over ? 0 : limit - bytes,
    largestSections: over ? sectionSizes(text).slice(0, 5) : [],
  }, null, 2));
  process.exit(over ? 1 : 0);
}

const detail = `${bytes}B / ${limit}B (${pct}%) · ${lineCount}줄 · 한글 ${hangul}자`;

if (over) {
  console.error(`FAIL  STATUS.md 크기 상한 초과 — ${detail}`);
  console.error(`      ${bytes - limit}B를 줄여야 한다. 새 내용을 깎지 말고 오래된 항목을 docs/archive/나`);
  console.error(`      malgnai-hub 이력(work_record 등)으로 내보내 자리를 만든다.`);
  const top = sectionSizes(text).slice(0, 3);
  if (top.length) {
    console.error(`      큰 섹션 순: ${top.map((s) => `${s.title} ${s.bytes}B`).join(' · ')}`);
  }
  console.error(`      규칙 정본: Skill \`project-standards\` §3`);
  process.exit(1);
}

console.log(`OK    STATUS.md ${detail} · 여유 ${limit - bytes}B`);
