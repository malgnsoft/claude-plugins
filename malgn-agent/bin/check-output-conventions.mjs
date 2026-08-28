#!/usr/bin/env node
/**
 * check-output-conventions.mjs
 *
 * Skill `common-output-storage-and-path-management`(SKILL.md)이 서술하는 산출물 관례 —
 * ①파일명 규칙 `[영역]-[주제]-YYYY-MM-DD[.버전].md` ②헤더 메타데이터(created/author/status)
 * ③저장 위계(영역별 기대 디렉터리) ④archived- 접두어 규칙 — 을 정규식/파일시스템 검사로
 * 1차 스캔해 위반 후보를 리포트한다.
 *
 * 이 스크립트는 결정론적으로 판정 가능한 항목만 "위반"으로 표시한다. 의도적 예외일 수
 * 있는 애매한 케이스(예: 날짜 없는 도메인 가이드 문서)는 아예 검사 대상에서 제외하거나
 * "확인 필요"로만 표시하고, 최종 판단은 사람이 한다.
 *
 * 순수 Node.js 내장 모듈만 사용 — 의존성 설치 없이 `node check-output-conventions.mjs` 로 실행된다.
 *
 * 사용법:
 *   node check-output-conventions.mjs [targetDir] [--root <path>] [--strict]
 *
 * 인자:
 *   targetDir    스캔할 디렉터리 (프로젝트 루트 기준 상대경로). 기본값 "docs".
 *   --root PATH  프로젝트 루트 경로. 기본값 process.cwd().
 *   --strict     하드 위반이 1건이라도 있으면 exit code 1 (CI 게이트용). 기본은 항상 exit 0.
 *
 * 콘솔 출력만 지원한다(파일 저장 옵션 없음) — 필요하면 셸 리다이렉트를 직접 사용할 것.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { targetDir: 'docs', root: process.cwd(), strict: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--root':
        opts.root = argv[++i] ?? opts.root;
        break;
      case '--strict':
        opts.strict = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (a.startsWith('--')) {
          console.error(`알 수 없는 옵션: ${a} (--help 참고)`);
          process.exit(1);
        }
        positional.push(a);
    }
  }
  if (positional.length > 0) opts.targetDir = positional[0];
  return opts;
}

function printHelp() {
  const SELF = `node "${process.argv[1]}"`
  console.log(`사용법: ${SELF} [targetDir] [--root <path>] [--strict]

  targetDir    스캔할 디렉터리 (프로젝트 루트 기준 상대경로, 기본값 "docs")
  --root PATH  프로젝트 루트 경로 (기본값: 현재 작업 디렉터리)
  --strict     하드 위반이 1건이라도 있으면 exit code 1 (CI 게이트용)

Skill \`common-output-storage-and-path-management\`의 파일명/헤더/경로위계/archived- 규칙을
1차 스캔한다. 판단이 애매한 케이스는 "확인 필요"로만 표시하며, 최종 판단은 사람이 한다.
`);
}

// ── 파일 시스템 유틸 ─────────────────────────────────────────────────────

const EXCLUDED_DIR_NAMES = new Set(['.git', 'node_modules', 'dist', 'build', 'coverage', '.next', '.DS_Store']);

const EXEMPT_BASENAMES = new Set([
  'readme.md',
  'index.md',
  'claude.md',
  'status.md',
  'memory.md',
  'license',
  'license.md',
  'changelog.md',
  'product-principles.md',
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  '.gitignore',
  '.ds_store',
  'settings.json',
  'settings.local.json',
  'marketplace.json',
  'plugin.json',
]);

function findAllFiles(baseDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return; // 권한 문제 등은 조용히 건너뛴다
    }
    for (const entry of entries) {
      if (EXCLUDED_DIR_NAMES.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        results.push(full);
      }
    }
  }
  walk(baseDir);
  return results;
}

// ── 규칙: 알려진 "영역" 접두어와 기대 저장 위치 (SKILL.md §3 표 그대로) ──────

const AREA_RULES = {
  decision: { dirs: ['docs', path.join('output', 'reports')], label: 'docs/ 또는 output/reports/' },
  review: { dirs: [path.join('output', 'reports')], label: 'output/reports/' },
  'training-report': { dirs: ['docs'], label: 'docs/' },
  scratch: { dirs: ['scratchpad'], label: 'scratchpad/ (세션 후 삭제 대상)' },
};

const DATE_RE = /\d{4}-\d{2}-\d{2}/;
const MALFORMED_DATE_RE = /(?:^|[^0-9])(\d{4}[_.]\d{2}[_.]\d{2}|\d{2}-\d{2}-\d{4}|\d{8})(?:[^0-9]|$)/;
const BAD_GENERIC_NAME_RE = /^(final|final-final|temp|untitled|new|copy|사본|새파일|test)\d*\.md$/i;
const NUMERIC_ONLY_NAME_RE = /^\d+\.md$/;
const STANDARD_PATTERN_RE = /^[a-z0-9]+(?:-[a-z0-9]+)+-\d{4}-\d{2}-\d{2}(\.\d+)?\.md$/;
const ARCHIVED_PATTERN_RE = /^archived-.+-\d{4}-\d{2}-\d{2}(\.\d+)?\.md$/i;

function isArchivePath(relPath) {
  return relPath.split(path.sep).some((seg) => seg.toLowerCase() === 'archive' || seg.toLowerCase() === 'archives');
}

function firstSegment(basename) {
  const m = basename.match(/^([a-z][a-z0-9]*)-/i);
  return m ? m[1].toLowerCase() : null;
}

/** basename이 알려진 영역 접두어(decision-/review-/training-report-/scratch-)로 시작하는지.
 *  'training-report'처럼 하이픈 포함 접두어도 매칭한다. */
function matchKnownArea(basename) {
  const lower = basename.toLowerCase();
  for (const area of Object.keys(AREA_RULES)) {
    if (lower.startsWith(area + '-')) return area;
  }
  return null;
}

// ── 헤더 메타데이터 파싱 ─────────────────────────────────────────────────

/** 파일 앞부분에서 YAML 프론트매터 블록(--- ... ---)을 찾아 존재하는 키 집합을 반환.
 *  프론트매터가 없으면 null. */
function parseFrontmatterKeys(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    return { found: false, keys: new Set(), error: String(err && err.message) };
  }
  const lines = content.split('\n');
  if (lines[0] == null || lines[0].trim() !== '---') return { found: false, keys: new Set() };
  const keys = new Set();
  let closed = false;
  for (let i = 1; i < lines.length && i < 200; i++) {
    const line = lines[i];
    if (line.trim() === '---') {
      closed = true;
      break;
    }
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/);
    if (m) keys.add(m[1].toLowerCase());
  }
  return { found: closed, keys };
}

// ── 메인 스캔 ────────────────────────────────────────────────────────────

function scan(rootAbs, targetRel) {
  const targetAbs = path.resolve(rootAbs, targetRel);
  const result = {
    targetAbs,
    scanned: 0,
    skippedExempt: 0,
    violations: [], // { relPath, category, detail }
    needsReview: [], // { relPath, category, detail }
  };

  if (!fs.existsSync(targetAbs)) {
    result.missingTargetDir = true;
    return result;
  }

  const files = findAllFiles(targetAbs);

  for (const abs of files) {
    const relPath = path.relative(rootAbs, abs);
    const basename = path.basename(abs);
    const basenameLower = basename.toLowerCase();
    const ext = path.extname(basename).toLowerCase();

    if (EXEMPT_BASENAMES.has(basenameLower)) {
      result.skippedExempt++;
      continue;
    }

    result.scanned++;

    const archiveScope = isArchivePath(relPath);

    // ── archived- 접두어 규칙 (§5) ──────────────────────────────
    if (archiveScope && ext === '.md') {
      if (!basenameLower.startsWith('archived-')) {
        result.violations.push({
          relPath,
          category: 'archived-접두어',
          detail: `archive 디렉터리 안에 있지만 파일명이 "archived-"로 시작하지 않음 (SKILL §5)`,
        });
      } else if (!ARCHIVED_PATTERN_RE.test(basename)) {
        result.needsReview.push({
          relPath,
          category: 'archived-접두어',
          detail: `"archived-" 접두어는 있으나 "archived-[설명]-YYYY-MM-DD.md" 형식과 정확히 일치하지 않음 — 확인 필요`,
        });
      }
    }
    if (!archiveScope && basenameLower.startsWith('archived-')) {
      result.violations.push({
        relPath,
        category: 'archived-접두어',
        detail: `파일명이 "archived-"로 시작하지만 archive 디렉터리 밖에 위치함 (docs/archive/ 등으로 이동 필요, SKILL §5)`,
      });
    }

    // ── 파일명 규칙 (§3) — 알려진 영역 접두어(decision-/review-/training-report-/scratch-)에만 적용 ──
    if (ext === '.md' && !archiveScope) {
      const area = matchKnownArea(basename);
      if (area) {
        if (!STANDARD_PATTERN_RE.test(basename)) {
          if (!DATE_RE.test(basename) && MALFORMED_DATE_RE.test(basename)) {
            result.violations.push({
              relPath,
              category: '파일명 규칙',
              detail: `"${area}-" 영역 파일이지만 날짜 형식이 YYYY-MM-DD가 아님 (SKILL §3)`,
            });
          } else if (!DATE_RE.test(basename)) {
            result.violations.push({
              relPath,
              category: '파일명 규칙',
              detail: `"${area}-" 영역 파일이지만 YYYY-MM-DD 날짜가 없음 (형식: [영역]-[주제]-YYYY-MM-DD.md, SKILL §3)`,
            });
          } else {
            result.needsReview.push({
              relPath,
              category: '파일명 규칙',
              detail: `"${area}-" 영역 파일이고 날짜는 있으나 표준 패턴과 완전히 일치하지 않음 — 확인 필요`,
            });
          }
        }
      } else if (BAD_GENERIC_NAME_RE.test(basename) || NUMERIC_ONLY_NAME_RE.test(basename)) {
        result.violations.push({
          relPath,
          category: '파일명 규칙',
          detail: `관례적으로 비권장되는 파일명(final/temp/untitled/copy/숫자만 등) — 의미있는 [영역]-[주제]-YYYY-MM-DD.md 형식 권장 (SKILL §3)`,
        });
      } else if (/\s/.test(basename)) {
        result.violations.push({
          relPath,
          category: '파일명 규칙',
          detail: `파일명에 공백 포함 — kebab-case 권장 (SKILL §3)`,
        });
      }
      // 그 외(알려진 영역 접두어 없고, 날짜도 없는 일반 도메인 문서 등)는 이 스킬의 날짜규칙
      // 적용 대상이 불명확하므로 검사하지 않는다 (예: docs/[도메인]/guide.md).
    }

    // ── 경로 위계 (§1, §3 표) — 알려진 영역 접두어 파일만 ──────────────
    if (ext === '.md' && !archiveScope) {
      const area = matchKnownArea(basename);
      if (area) {
        const rule = AREA_RULES[area];
        const relDirSegs = path.dirname(relPath).split(path.sep);
        const matches = rule.dirs.some((d) => relDirSegs.includes(d.split(path.sep)[0]) && relPath.includes(d + path.sep));
        // scratch-*.md 가 scratchpad/ 밖에 있으면 위반, decision-*.md가 docs/나 output/reports/ 밖이면 위반 등
        if (!matches) {
          result.violations.push({
            relPath,
            category: '경로 위계',
            detail: `"${area}-" 파일은 ${rule.label} 아래에 있어야 함 (SKILL §1, §3)`,
          });
        }
      }
    }

    // ── 헤더 메타데이터 (§4) — 알려진 영역 접두어 파일 + output/reports/ 하위 .md ──
    if (ext === '.md') {
      const area = matchKnownArea(basename);
      const underReports = relPath.split(path.sep).includes('reports');
      if (area || archiveScope || underReports) {
        const fm = parseFrontmatterKeys(abs);
        if (!fm.found) {
          result.violations.push({
            relPath,
            category: '헤더 메타데이터',
            detail: `YAML 프론트매터(--- ... ---) 블록이 없음 — created/author/status 누락 (SKILL §4)`,
          });
        } else {
          const missingRequired = ['created', 'author', 'status'].filter((k) => !fm.keys.has(k));
          if (missingRequired.length > 0) {
            result.violations.push({
              relPath,
              category: '헤더 메타데이터',
              detail: `프론트매터에 필수 키 누락: ${missingRequired.join(', ')} (SKILL §4)`,
            });
          }
          if (!fm.keys.has('related_files') && !fm.keys.has('tags')) {
            result.needsReview.push({
              relPath,
              category: '헤더 메타데이터',
              detail: `related_files/tags 모두 없음 — 관련 파일이 정말 없는 의도적 경우인지 확인 필요`,
            });
          }
        }
      }
    }

    // ── scratch- 파일 잔존 (§3) — 세션 종료 후 삭제 대상이라 존재 자체는 확인 필요 ──
    if (ext === '.md' && basenameLower.startsWith('scratch-')) {
      result.needsReview.push({
        relPath,
        category: 'scratch 잔존',
        detail: `scratch- 파일은 세션 후 삭제 대상 (SKILL §3) — 아직 필요한 세션 중인지, 삭제 누락인지 확인 필요`,
      });
    }
  }

  return result;
}

// ── 리포트 출력 ──────────────────────────────────────────────────────────

function groupByCategory(items) {
  const map = new Map();
  for (const item of items) {
    if (!map.has(item.category)) map.set(item.category, []);
    map.get(item.category).push(item);
  }
  return map;
}

function printSection(title, items) {
  console.log(`## ${title} (${items.length}건)`);
  console.log();
  if (items.length === 0) {
    console.log('없음.');
    console.log();
    return;
  }
  const grouped = groupByCategory(items);
  for (const [category, entries] of grouped) {
    console.log(`### ${category} (${entries.length}건)`);
    for (const e of entries) {
      console.log(`- \`${e.relPath}\` — ${e.detail}`);
    }
    console.log();
  }
}

function run() {
  const opts = parseArgs(process.argv.slice(2));
  const rootAbs = path.resolve(opts.root);

  console.log(`# 산출물 저장 관례 스캔 리포트`);
  console.log();
  console.log(`- 스캔 대상: ${path.join(rootAbs, opts.targetDir)}`);
  console.log(`- 기준 스킬: common-output-storage-and-path-management (SKILL.md §1~§5)`);
  console.log();

  const result = scan(rootAbs, opts.targetDir);

  if (result.missingTargetDir) {
    console.log(`대상 디렉터리가 존재하지 않습니다: ${result.targetAbs}`);
    process.exit(0);
  }

  console.log(`- 검사한 파일 수: ${result.scanned} (예외 처리로 건너뜀: ${result.skippedExempt})`);
  console.log(`- 하드 위반: ${result.violations.length}건`);
  console.log(`- 확인 필요(애매한 케이스): ${result.needsReview.length}건`);
  console.log();

  printSection('하드 위반 (정규식/파일시스템으로 결정론적 판정)', result.violations);
  printSection('확인 필요 (사람 판단 필요 — 의도적 예외 가능성)', result.needsReview);

  console.log(`## 사용 안내`);
  console.log();
  console.log(
    `이 리포트는 1차 기계 스캔 결과다. "하드 위반"만 실제 위반으로 확정하지 말고, ` +
      `표시된 각 항목이 SKILL.md 규칙과 실제로 어긋나는지 사람이 최종 확인한다. ` +
      `"확인 필요" 항목은 의도적 예외(예: 관련 파일이 정말 없음, 아직 세션 진행 중)일 수 있어 ` +
      `자동으로 위반 처리하지 않는다.`
  );

  if (opts.strict && result.violations.length > 0) {
    process.exitCode = 1;
  }
}

run();
