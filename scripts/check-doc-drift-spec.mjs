#!/usr/bin/env node
/**
 * check-doc-drift-spec.mjs — `malgn-agent/hooks/doc-drift.mjs` 헤더(사양 정본)와 실제 동작을
 * 기계가 대조한다. 저장소 전용 검사다(플러그인 번들에 포함되지 않는다).
 *
 * 왜 필요한가: `skills/project-standards/SKILL.md`가 doc-drift.mjs **상단 주석**을 "전체 사양의
 * 정본"으로 지정한다. 사양이 실행 코드와 같은 파일에 있으면, 아래쪽 코드만 고치고 위쪽 주석을
 * 놓친 커밋에서 사양과 구현이 한 파일 안에서 조용히 갈라진다. 사람 눈에만 맡기면 그 갈라짐이
 * 리뷰를 통과한다 — 문서-코드 드리프트를 잡는 것이 본업인 파일이 정작 자기 사양의 드리프트는
 * 아무도 안 잡는 자기모순이라, 그 대조를 여기서 실행으로 고정한다.
 *
 * 기대값을 이 스크립트에 박아두지 않는다 — **헤더에서 파싱해** 실행 결과와 맞춘다. 그래서
 * 헤더를 사실과 다르게 고치면(경고 문면 변경·exit 코드 변경·소비자 누락·죽은 앵커) 이 검사가
 * 곧바로 실패한다.
 *
 * 검사 2종:
 *   [헤더 정합] 헤더가 단정한 소비자 목록·앵커가 코드 실물과 일치하는가
 *     - 헤더 "측정 불가" 단락이 지목한 소비자 = 판정식을 실제로 구현한 hooks/*.mjs 전부와 일치
 *     - `(§ 이름)` 형태의 내부 앵커가 실재하는 섹션 마커(`// ===== § 이름 =====`)를 가리킴
 *       (`(§ 아래 "..." 단락)`·`(§ 상단 docstring)` 같은 산문형 위치 지시와 `§6`(외부 문서 절
 *        번호)은 섹션 앵커가 아니므로 대상이 아니다)
 *   [런타임 픽스처] 헤더가 단정한 동작이 실제 실행에서 재현되는가 — 픽스처 2종
 *     - 전량 측정불가: 헤더가 인용한 경고 문면 출력 + 헤더가 단정한 exit 코드
 *     - 부분 측정: 하나라도 측정되면 그 규칙 대상이 아니다 → 경고 없음 + exit 0
 *
 * 사용법: node scripts/check-doc-drift-spec.mjs
 * 종료 코드: 전부 통과 0, 하나라도 실패 1.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS_DIR = path.join(REPO_ROOT, 'malgn-agent', 'hooks');
const TARGET = path.join(HOOKS_DIR, 'doc-drift.mjs');

const results = [];
const pass = (name, detail) => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

const src = fs.readFileSync(TARGET, 'utf8');

// ── 헤더(사양 정본) 파싱 ────────────────────────────────────────────
const headerMatch = src.match(/^#!.*\n\/\*\*([\s\S]*?)\*\//);
if (!headerMatch) {
  console.error('FAIL [header-parse] doc-drift.mjs 상단 블록 주석(사양 정본)을 찾지 못했다.');
  process.exit(1);
}
const header = headerMatch[1];

// "측정 불가" 단락 — 이 판정의 사양이 적힌 자리. 단락 끝은 빈 주석줄(` *`) 또는 헤더 끝.
const paraStart = header.indexOf('측정 불가(경로 없음');
if (paraStart < 0) {
  console.error('FAIL [header-parse] 헤더에서 "측정 불가(경로 없음..." 단락을 찾지 못했다 — 사양 정본의 해당 규칙이 사라졌거나 문구가 바뀌었다.');
  process.exit(1);
}
const paraEndMatch = /\n[ \t]*\*[ \t]*\n/.exec(header.slice(paraStart));
const para = paraEndMatch
  ? header.slice(paraStart, paraStart + paraEndMatch.index)
  : header.slice(paraStart);

// 헤더가 인용한 경고 문면(⚠️로 시작하는 큰따옴표 문자열)과 종료 코드.
const quoted = [...para.matchAll(/"(⚠️[^"]*)"/g)].map((m) => m[1]);
const exitMatch = para.match(/exit\s+(\d+)\s*로 종료/);
if (quoted.length !== 1 || !exitMatch) {
  console.error(`FAIL [header-parse] 단락에서 경고 문면(큰따옴표 안 ⚠️ 문자열 1개)과 종료 코드("exit N로 종료")를 읽지 못했다 — 인용 ${quoted.length}건, 종료코드 ${exitMatch ? exitMatch[1] : '없음'}.`);
  process.exit(1);
}
const specWarning = quoted[0];
const specExitCode = Number(exitMatch[1]);

// ── 검사 1: 헤더 정합 (소비자 열거 + 앵커 실재) ──────────────────────
// 판정식을 실제로 구현한 파일 = "checks 비어있지 않음 + results 0건 + skipped 1건 이상"을 모두
// 코드로 쓴 hooks/*.mjs. 헤더가 이 목록과 어긋나면(하나만 적거나 없는 파일을 적으면) 실패.
const hookFiles = fs.readdirSync(HOOKS_DIR).filter((f) => f.endsWith('.mjs'));
const implementers = hookFiles.filter((f) => {
  const s = fs.readFileSync(path.join(HOOKS_DIR, f), 'utf8');
  return /results\.length\s*===\s*0/.test(s) && /skipped\.length\s*>\s*0/.test(s);
});
const otherImplementers = implementers.filter((f) => f !== 'doc-drift.mjs');
const mentioned = new Set([...para.matchAll(/([A-Za-z0-9._-]+\.mjs)/g)].map((m) => m[1]));

const missingConsumers = otherImplementers.filter((f) => !mentioned.has(f));
const staleConsumers = [...mentioned].filter((f) => !implementers.includes(f));
if (!implementers.includes('doc-drift.mjs')) {
  fail('소비자 열거', 'doc-drift.mjs 자신이 판정식을 구현하지 않는다 — 사양과 코드 배치가 근본적으로 달라졌다. 이 검사의 전제를 재확인하라.');
} else if (missingConsumers.length || staleConsumers.length) {
  fail('소비자 열거', [
    missingConsumers.length ? `헤더가 빠뜨린 소비자: ${missingConsumers.join(', ')}(판정식을 실제로 구현한다)` : '',
    staleConsumers.length ? `헤더가 지목했으나 판정식이 없는 파일: ${staleConsumers.join(', ')}` : '',
  ].filter(Boolean).join(' / '));
} else {
  pass('소비자 열거', `CLI(doc-drift.mjs) + ${otherImplementers.join(', ') || '(없음)'} — 헤더 서술과 구현이 일치`);
}

// 섹션 앵커: `(§ 이름)` 참조는 `// ===== § 이름 =====` 마커로 실재해야 한다.
// 산문형 위치 지시(아래/위/상단/하단으로 시작하거나 따옴표를 포함)는 섹션 앵커가 아니다.
const anchorRefs = [...src.matchAll(/\(§\s+([^)"]+)\)/g)]
  .map((m) => m[1].trim())
  .filter((n) => !/^(아래|위|상단|하단)/.test(n));
const declaredAnchors = [...src.matchAll(/^\/\/\s*=+\s*§\s*([^=]+?)\s*=+\s*$/gm)].map((m) => m[1].trim());
const deadAnchors = [...new Set(anchorRefs)].filter((n) => !declaredAnchors.includes(n));
if (anchorRefs.length === 0) {
  pass('앵커 실재', '섹션 앵커 참조 없음');
} else if (deadAnchors.length) {
  fail('앵커 실재', `가리키는 섹션이 파일에 없다: ${deadAnchors.map((n) => `§ ${n}`).join(', ')} — 선언된 섹션: ${declaredAnchors.length ? declaredAnchors.map((n) => `§ ${n}`).join(', ') : '(없음)'}`);
} else {
  pass('앵커 실재', `${[...new Set(anchorRefs)].map((n) => `§ ${n}`).join(', ')} 전부 섹션 마커로 실재`);
}

// ── 검사 2: 런타임 픽스처 2종 ────────────────────────────────────────
function runFixture(name, files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-drift-spec-'));
  try {
    for (const [rel, body] of Object.entries(files)) {
      const abs = path.join(dir, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, body);
    }
    const r = spawnSync(process.execPath, [TARGET, dir], { encoding: 'utf8' });
    return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const f1 = runFixture('전량 측정불가', {
  '.claude/doc-drift.json': JSON.stringify({
    checks: [
      { label: 'A', expected: 1, glob: 'nosuch-dir/*.js' },
      { label: 'B', expected: 1, file: 'nosuch-file.js', regex: 'x' },
    ],
  }),
});
if (f1.code === specExitCode && f1.out.includes(specWarning)) {
  pass('픽스처① 전량 측정불가', `exit ${f1.code} + 헤더가 인용한 경고 문면 출력 — 헤더 서술대로`);
} else {
  fail('픽스처① 전량 측정불가', `헤더는 "${specWarning}" 경고 + exit ${specExitCode}를 단정하는데, 실제는 exit ${f1.code} / 경고 문면 ${f1.out.includes(specWarning) ? '출력됨' : '없음'}. 출력:\n${f1.out.trim()}`);
}

const f2 = runFixture('부분 측정', {
  'data.json': '[1,2,3]',
  '.claude/doc-drift.json': JSON.stringify({
    checks: [
      { label: 'A', expected: 1, glob: 'nosuch-dir/*.js' },
      { label: 'B', expected: 3, jsonLength: 'data.json' },
    ],
  }),
});
if (f2.code === 0 && !f2.out.includes(specWarning) && f2.out.includes('✅ B: 문서=3 실측=3')) {
  pass('픽스처② 부분 측정', 'exit 0 + 전량 측정불가 경고 없음 — "하나라도 정상 측정됐으면 이 규칙 대상이 아니다"대로');
} else {
  fail('픽스처② 부분 측정', `헤더는 하나라도 측정되면 이 규칙 대상이 아니라고 단정하는데, 실제는 exit ${f2.code} / 전량측정불가 경고 ${f2.out.includes(specWarning) ? '출력됨' : '없음'}. 출력:\n${f2.out.trim()}`);
}

// ── 리포트 ──────────────────────────────────────────────────────────
console.log('\n=== doc-drift 사양(헤더) ↔ 동작 대조 ===');
console.log(`대상: malgn-agent/hooks/doc-drift.mjs (헤더에서 읽은 기대값: 경고 "${specWarning}" · exit ${specExitCode})\n`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} [${r.name}] ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n--- 합계: PASS ${results.length - failed} · FAIL ${failed} ---`);
process.exit(failed ? 1 : 0);
