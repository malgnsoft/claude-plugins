#!/usr/bin/env node
/**
 * diff-env-keys.mjs
 *
 * 프로젝트 루트 아래를 재귀적으로 훑어 `.env.example`(및 `.env.sample`/`.env.template`류
 * "예제" 파일)을 모두 찾고, 각 파일과 짝이 되는 실제 `.env` 파일의 키 목록을 대조한다.
 * "예제엔 있는데 .env엔 없는 키" / "반대로 .env에만 있는 키" / "키는 있지만 값이 비어있는 경우"를
 * 사람이 눈으로 목록을 대조하지 않고 정확히 잡아낸다.
 *
 * 순수 Node.js 내장 모듈만 사용 — 의존성 설치 없이 `node diff-env-keys.mjs` 로 실행된다.
 * macOS/Linux/Windows 동일 동작 (path.join/path.sep로 구분자 처리).
 *
 * 모노레포/멀티서비스 구조 대응: `.env.example`이 여러 디렉터리에 흩어져 있어도
 * 재귀 탐색으로 전부 찾아 각각 자기 디렉터리의 `.env`와 짝지어 대조한다.
 * `node_modules`, `.git` 은 탐색에서 제외한다.
 *
 * 사용법:
 *   node diff-env-keys.mjs [projectRoot] [--help]
 *
 * 인자:
 *   projectRoot  탐색을 시작할 프로젝트 루트 경로. 생략하면 process.cwd().
 *
 * 종료 코드:
 *   0  예제 파일이 없거나, 모든 예제-실제 파일 쌍에서 누락/빈값 키가 없음
 *   1  하나 이상의 예제 파일에 대응하는 .env가 없거나, 누락/빈값 키가 발견됨
 *   2  인자 오류 등 실행 자체가 실패한 경우
 */

import fs from 'node:fs';
import path from 'node:path';

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { root: process.cwd() };
  const positionals = [];
  for (const a of argv) {
    if (a === '--help' || a === '-h') {
      printHelp();
      process.exit(0);
    } else if (a.startsWith('--')) {
      console.error(`알 수 없는 옵션: ${a} (--help 참고)`);
      process.exit(2);
    } else {
      positionals.push(a);
    }
  }
  if (positionals.length > 0) opts.root = positionals[0];
  return opts;
}

function printHelp() {
  const SELF = `node "${process.argv[1]}"`
  console.log(`사용법: ${SELF} [projectRoot] [--help]

  projectRoot  탐색을 시작할 프로젝트 루트 경로 (생략 시 현재 디렉터리)

.env.example(.env.sample / .env.template류 포함)을 재귀적으로 찾아
각 디렉터리의 실제 .env 파일과 키 목록을 대조합니다 (node_modules, .git 제외).

종료 코드: 0=이상 없음, 1=누락/빈값/파일없음 발견, 2=실행 오류`);
}

// ── 탐색 ───────────────────────────────────────────────────────────────────

const EXCLUDED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.wrangler']);

// ".env.example" / ".env.sample" / ".env.template" / ".env.local.example" 등을 매치.
// ".env" 로 시작하고 "example"/"sample"/"template" 로 끝나는 파일.
const EXAMPLE_FILE_RE = /^\.env(?:\.[\w-]+)*\.(example|sample|template)$/i;

/** 예제 파일명에서 대응하는 실제 .env 파일명을 유도한다.
 *  .env.example -> .env
 *  .env.local.example -> .env.local
 *  .env.production.sample -> .env.production
 */
function deriveRealEnvName(exampleName) {
  return exampleName.replace(/\.(example|sample|template)$/i, '');
}

/** 디렉터리를 재귀 순회하며 예제 파일의 절대경로를 모두 수집 */
function findExampleFiles(baseDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return; // 권한 문제 등은 조용히 건너뛴다
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (entry.isFile() && EXAMPLE_FILE_RE.test(entry.name)) {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  walk(baseDir);
  return results;
}

// ── 키 파싱 ──────────────────────────────────────────────────────────────

/** .env류 파일을 읽어 Map<key, { hasValue: boolean }> 반환. 주석(#)/빈 줄/export 접두는 무시. */
function parseEnvKeys(filePath) {
  const map = new Map();
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2];
    // 앞뒤 따옴표 제거 후 빈 값 판정
    value = value.trim().replace(/^['"]|['"]$/g, '');
    map.set(key, { hasValue: value.length > 0 });
  }
  return map;
}

// ── 메인 ────────────────────────────────────────────────────────────────

function run() {
  const opts = parseArgs(process.argv.slice(2));

  const root = path.resolve(opts.root);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.error(`프로젝트 루트를 찾을 수 없습니다 (디렉터리 아님): ${root}`);
    process.exit(2);
  }

  const exampleFiles = findExampleFiles(root);

  console.log(`# .env 키 대조 리포트`);
  console.log();
  console.log(`- 탐색 루트: ${root}`);
  console.log(`- 발견된 예제 파일 수: ${exampleFiles.length}`);
  console.log();

  if (exampleFiles.length === 0) {
    console.log(`.env.example(류) 파일을 찾지 못했습니다 — 대조할 대상이 없습니다.`);
    process.exit(0);
  }

  let hasProblem = false;

  for (const examplePath of exampleFiles) {
    const dir = path.dirname(examplePath);
    const exampleName = path.basename(examplePath);
    const realName = deriveRealEnvName(exampleName);
    const realPath = path.join(dir, realName);
    const relExample = path.relative(root, examplePath) || exampleName;
    const relReal = path.relative(root, realPath) || realName;

    console.log(`## ${relExample} ↔ ${relReal}`);
    console.log();

    let exampleKeys;
    try {
      exampleKeys = parseEnvKeys(examplePath);
    } catch (err) {
      console.log(`  예제 파일을 읽지 못했습니다: ${err.message}`);
      hasProblem = true;
      console.log();
      continue;
    }

    if (exampleKeys.size === 0) {
      console.log(`  예제 파일에 키가 하나도 없습니다 (빈 파일이거나 주석만 존재) — 대조 생략.`);
      console.log();
      continue;
    }

    if (!fs.existsSync(realPath)) {
      hasProblem = true;
      console.log(`  ❌ 실제 파일 없음: ${relReal}`);
      console.log(`     예제의 키 ${exampleKeys.size}개가 전부 미확인 상태입니다: ${[...exampleKeys.keys()].join(', ')}`);
      console.log();
      continue;
    }

    let realKeys;
    try {
      realKeys = parseEnvKeys(realPath);
    } catch (err) {
      console.log(`  실제 .env 파일을 읽지 못했습니다: ${err.message}`);
      hasProblem = true;
      console.log();
      continue;
    }

    const missing = []; // 예제엔 있는데 .env엔 없는 키
    const empty = []; // .env에 키는 있지만 값이 비어있는 경우
    for (const key of exampleKeys.keys()) {
      if (!realKeys.has(key)) {
        missing.push(key);
      } else if (!realKeys.get(key).hasValue) {
        empty.push(key);
      }
    }
    const extra = [...realKeys.keys()].filter((k) => !exampleKeys.has(k)); // .env에만 있는 키

    if (missing.length === 0 && empty.length === 0) {
      console.log(`  ✅ 누락 없음 (예제 키 ${exampleKeys.size}개 모두 값과 함께 존재)`);
    } else {
      hasProblem = true;
      if (missing.length > 0) {
        console.log(`  ❌ 누락 (예제엔 있는데 .env엔 없음, ${missing.length}개): ${missing.join(', ')}`);
      }
      if (empty.length > 0) {
        console.log(`  ⚠️  값 비어있음 (.env에 키는 있으나 값 없음, ${empty.length}개): ${empty.join(', ')}`);
      }
    }

    if (extra.length > 0) {
      console.log(`  ℹ️  참고: .env에만 있고 예제엔 없는 키 (${extra.length}개, 문제 아님): ${extra.join(', ')}`);
    }

    console.log();
  }

  if (hasProblem) {
    console.log(`결과: 확인이 필요한 항목이 있습니다 (누락/빈값/파일없음). 위 ❌/⚠️ 항목을 게이트 근거에 반영하세요.`);
    process.exit(1);
  } else {
    console.log(`결과: 모든 예제-실제 .env 쌍에서 누락 없음.`);
    process.exit(0);
  }
}

run();
