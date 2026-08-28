#!/usr/bin/env node
/**
 * check-docs.mjs — 이 저장소(claude-plugins) 전용 문서 정합 게이트. 플러그인 번들에 포함되지 않는다.
 *
 * `pnpm run check-docs`의 진입점이며 두 가지를 이어서 돌린다:
 *   1) malgn-agent 자산 개수(agents·skills·knowledge) ↔ 루트 `CLAUDE.md` 서술 대조 — 이 스크립트가 직접 수행
 *   2) PM 행동규율 관리 구역(managed region) 정합성 — 배포 CLI(`malgn-agent/hooks/doc-drift.mjs`)에 위임 실행
 * 둘을 **모두** 실행하고 하나라도 실패하면 exit 1이다(`&&` 체인처럼 앞이 실패했다고 뒤를 건너뛰지 않는다).
 *
 * 왜 1)을 여기서 직접 세는가: 이 검사는 이 저장소에만 의미가 있다. 예전에는 저장소 루트
 * `.claude/doc-drift.json` 매니페스트에 세 규칙을 담아 배포 CLI가 대신 돌렸는데, 그러면 범용 도구가
 * 자기 소스 저장소 전용 규칙을 들고 있게 되고 배포 파일(헤더 예시)까지 이 저장소 고유 값으로 물든다.
 * 검사 내용은 그대로 두고 소유권만 저장소 쪽으로 옮긴 것이다 — 새 기능이 아니다(자동 수정도 없다).
 * 설치 프로젝트에서는 `.claude/doc-drift.json` 매니페스트가 여전히 정상 경로다. 이 저장소만 자기 자산
 * 개수를 여기서 센다.
 *
 * 판정 규약:
 *   - 문서에서 해당 서술을 **찾지 못하면 스킵이 아니라 실패**다. 세겠다고 선언해 놓고 대상을 못 읽는
 *     것을 통과로 보고하면, 문구가 바뀌는 순간 감시가 꺼진 줄 모르고 영원히 초록불이 된다.
 *   - 같은 패턴이 문서에 여러 번 나오면 **전량 대조**한다(`matchAll`). 낡은 사본 한 줄이 조용히
 *     통과하지 못하게 한다.
 *   - 세는 대상 디렉토리 자체가 없으면 0으로 세지 않고 실패다("없다"와 "0개다"는 다른 상태다).
 *
 * 사용법: node scripts/check-docs.mjs   (cwd 무관 — 경로는 이 파일 위치 기준 절대경로로 잡는다)
 * 종료 코드: 개수 대조 전부 통과 + 배포 CLI exit 0 → 0, 하나라도 실패 → 1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ROOT = path.join(REPO_ROOT, 'malgn-agent');
const DOC_REL = 'CLAUDE.md';
const DRIFT_CLI_REL = path.join('malgn-agent', 'hooks', 'doc-drift.mjs');

// ── 실측(코드가 진실) ────────────────────────────────────────────────
// 상호참조: 설치자가 읽는 문서(`malgn-agent/README.md`·`plugin.json`·`marketplace.json`)의 같은 개수
// 표기는 `scripts/validate-agent-assets.mjs`의 `COUNT_CLAIMS`가 대조한다(대상 문서가 다를 뿐 세는
// 규칙은 같아야 한다). **세는 규칙을 바꾸면 그 파일과 이 파일을 함께 고친다.**

/** 디렉토리 엔트리 — 디렉토리 자체가 없거나 못 읽으면 null(= 실측 불가, 0이 아니다). */
function entriesOf(absDir) {
  try {
    return fs.readdirSync(absDir, { withFileTypes: true });
  } catch {
    return null;
  }
}

/** agents = `malgn-agent/agents/` 바로 아래 `*.md` 파일 수(하위 디렉토리는 세지 않는다). */
function countAgents() {
  const entries = entriesOf(path.join(PLUGIN_ROOT, 'agents'));
  if (!entries) return null;
  return entries.filter((e) => e.isFile() && e.name.endsWith('.md')).length;
}

/** skills = `malgn-agent/skills/<dir>/SKILL.md`가 실재하는 디렉토리 수(SKILL.md 없는 디렉토리는 스킬이 아니다). */
function countSkills() {
  const skillsDir = path.join(PLUGIN_ROOT, 'skills');
  const entries = entriesOf(skillsDir);
  if (!entries) return null;
  return entries.filter((e) => e.isDirectory() && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md'))).length;
}

/**
 * knowledge = `malgn-agent/knowledge/` 이하 `*.md` **재귀 전수 − 진입점 `knowledge/README.md`**.
 *
 * 규칙 통일 메모: 예전 매니페스트는 glob `knowledge/*\/**\/*.md`로 **하위 디렉토리만** 셌다. 지금
 * 규칙은 "전수 − 진입점"이라 세는 방식이 다르다(최상위 `.md`가 README 하나뿐인 오늘은 결과가 45−1=44로
 * 같지만, 최상위에 다른 문서가 생기면 갈라진다). 이 규칙은 `scripts/validate-agent-assets.mjs`의
 * `COUNT_CLAIMS`(knowledge 전수에서 `knowledge/README.md`만 제외)와 **통일한 것**이다 — 한 저장소
 * 안에서 같은 자산을 두 규칙으로 세지 않기 위해서다.
 */
function countKnowledge() {
  const root = path.join(PLUGIN_ROOT, 'knowledge');
  if (!entriesOf(root)) return null;
  let total = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (e.isFile() && e.name.endsWith('.md')) total += 1;
    }
  };
  walk(root);
  return total - (fs.existsSync(path.join(root, 'README.md')) ? 1 : 0);
}

// 문서 쪽 정규식은 캡처 그룹 1개(숫자)로 감싼다. `g` 플래그 필수 — 전량 대조를 위해서다.
const CHECKS = [
  { label: 'agents', what: 'malgn-agent/agents/ 의 *.md', measure: countAgents, re: /`agents\/`\s+(\d+)종/g },
  { label: 'skills', what: 'malgn-agent/skills/<dir>/SKILL.md', measure: countSkills, re: /`skills\/`\s+(\d+)종/g },
  { label: 'knowledge', what: 'malgn-agent/knowledge/ 이하 *.md 전수 − README', measure: countKnowledge, re: /`knowledge\/`\s+(\d+)개/g },
];

// ── 1) 개수 대조 ────────────────────────────────────────────────────
console.log('=== malgn-agent 자산 개수 ↔ CLAUDE.md 서술 대조 (이 저장소 전용) ===');

let docText = null;
let docReadError = null;
try {
  docText = fs.readFileSync(path.join(REPO_ROOT, DOC_REL), 'utf8');
} catch (err) {
  docReadError = err && err.message ? err.message : String(err);
}

let countFailures = 0;
if (docReadError !== null) {
  countFailures = CHECKS.length;
  console.log(`  FAIL ${DOC_REL}을 읽지 못했다: ${docReadError} — 개수 대조를 수행할 수 없다(통과로 볼 수 없다).`);
} else {
  for (const check of CHECKS) {
    const actual = check.measure();
    if (actual === null) {
      countFailures += 1;
      console.log(`  FAIL ${check.label}: 실측 불가 — ${check.what} 경로를 읽지 못했다(디렉토리 부재는 0이 아니다).`);
      continue;
    }
    check.re.lastIndex = 0;
    const claims = [...docText.matchAll(check.re)].map((m) => ({ text: m[0].trim(), value: Number.parseInt(m[1], 10) }));
    if (claims.length === 0) {
      countFailures += 1;
      console.log(`  FAIL ${check.label}: ${DOC_REL}에서 서술을 찾지 못했다(패턴 ${check.re.source}) — 실측=${actual}. 문서 문구가 바뀌었으면 이 스크립트의 패턴도 함께 고쳐라(스킵이 아니라 실패다).`);
      continue;
    }
    const bad = claims.filter((c) => c.value !== actual);
    if (bad.length) {
      countFailures += 1;
      console.log(`  FAIL ${check.label}: 실측=${actual} ↔ 문서=${bad.map((c) => `"${c.text}"`).join(', ')} (${DOC_REL}, 총 ${claims.length}건 중 ${bad.length}건 불일치)`);
    } else {
      console.log(`  OK   ${check.label}: 문서=${actual} 실측=${actual} (${DOC_REL}에서 ${claims.length}건 대조)`);
    }
  }
}

// ── 2) 배포 CLI 위임 실행 (PM 행동규율 관리 구역 점검) ────────────────
// 구분선이 필요한 이유: 이 저장소에는 `.claude/doc-drift.json`이 없으므로 아래 CLI는 매 실행
// "(.claude/doc-drift.json 없음 — 드리프트 체크 대상 아님)"을 찍는다. 구분선 없이 위 OK 3줄 바로
// 뒤에 붙으면 "방금 대조해 놓고 대조 대상이 아니라니?"로 읽힌다 — 두 출력은 서로 다른 검사다.
console.log(`\n── 여기부터는 배포 CLI(${DRIFT_CLI_REL.replace(/\\/g, '/')}) 출력 ──`);
console.log('   이 CLI가 이 저장소에서 맡는 일은 PM 행동규율 관리 구역 점검 하나다.');
console.log('   자산 개수 대조는 위에서 이 스크립트가 이미 마쳤다(이 저장소에 드리프트 매니페스트는 없다).');

const cliPath = path.join(REPO_ROOT, DRIFT_CLI_REL);
// 저장소 루트를 argv[2]로 **명시 전달**하고 cwd도 고정한다 — 하위 디렉토리나 저장소 밖에서
// `pnpm run check-docs`를 돌려도 CLI가 엉뚱한 곳의 CLAUDE.md를 보고 조용히 지나가지 않게 한다.
// 셸을 거치지 않는 spawnSync(process.execPath, ...)라 Windows에서도 동일하게 동작한다.
const cli = spawnSync(process.execPath, [cliPath, REPO_ROOT], { cwd: REPO_ROOT, stdio: 'inherit' });

let cliFailure = false;
let cliVerdict;
if (cli.error) {
  cliFailure = true;
  cliVerdict = `실행 실패(${cli.error.message})`;
} else if (cli.status === null) {
  cliFailure = true;
  cliVerdict = `시그널로 중단됨(${cli.signal})`;
} else {
  cliFailure = cli.status !== 0;
  cliVerdict = `exit ${cli.status}`;
}

// ── 합산 ────────────────────────────────────────────────────────────
console.log(
  `\n--- check-docs 합계: 개수 대조 ${CHECKS.length - countFailures}/${CHECKS.length} 통과 · 관리 구역 점검 ${cliVerdict} ---`,
);
process.exit(countFailures > 0 || cliFailure ? 1 : 0);
