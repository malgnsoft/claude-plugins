#!/usr/bin/env node
/**
 * validate-agent-assets.mjs — malgn-agent Agent/Skill 자산 정적 검증기
 *
 * 검사 대상: <plugin>/agents/*.md 의 YAML frontmatter, <plugin>/skills/<name>/SKILL.md 의 YAML frontmatter,
 * 그리고 그 본문이 참조하는 Skill/Knowledge 경로.
 *
 * 사용법:
 *   node scripts/validate-agent-assets.mjs [--plugin malgn-agent] [--format text|json] [--strict]
 *
 * 종료 코드: ERROR 1건 이상이면 1, --strict일 때 WARN만 있어도 1, 그 외 0.
 *            INFO는 종료 코드에 영향을 주지 않는다(사라지지 않게 출력만 한다).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Claude Code 공식 subagent frontmatter 필드 (2026-08-20, code.claude.com/docs/en/sub-agents 기준)
const AGENT_KNOWN_FIELDS = new Set([
  'name', 'description', 'tools', 'disallowedTools', 'model', 'permissionMode',
  'maxTurns', 'skills', 'mcpServers', 'hooks', 'memory', 'background', 'effort',
  'isolation', 'color', 'initialPrompt',
]);
// plugin subagent에서 무시되는 필드 (공식 문서 명시)
const AGENT_IGNORED_IN_PLUGIN = new Set(['permissionMode', 'mcpServers', 'hooks']);
const AGENT_FIELD_TYPES = {
  name: 'string', description: 'string', model: 'string', permissionMode: 'string',
  effort: 'string', isolation: 'string', color: 'string', initialPrompt: 'string',
  memory: 'string', background: 'boolean', maxTurns: 'number',
  tools: 'string|array', disallowedTools: 'string|array', skills: 'array',
};
const VALID_MODEL = /^(sonnet|opus|haiku|fable|inherit|claude-[a-z0-9.\-]+)$/;
const VALID_EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const VALID_MEMORY = new Set(['user', 'project', 'local']);

// 컨텍스트 예산 (SPEC §2.1 권고). 초과는 ERROR가 아니라 "왜 항상 로드돼야 하는가" 설명을 요구하는 WARN.
//
// ⚠️ 이 검사는 "파일이 크다"를 결함으로 보지 않는다. CLAUDE.md "에이전트 업그레이드 원칙"에 따라
// 1순위는 성능이고 사이즈 축소는 수단일 뿐이다 — 지울 수 있는 것은 성능에 기여하지 않는 것
// (중복 서술·죽은 참조·미실행 절차)뿐이며, 줄 수 감소 자체는 개선 근거가 아니다.
// 따라서 이 검사가 잡는 것은 초과 자체가 아니라 **아무도 근거를 적지 않은 초과**다.
const META_AGENTS = new Set(['pm', 'trainer', 'evaluator', 'reviewer']);
const BUDGET_META_KB = 15;
const BUDGET_SPECIALIST_KB = 10;
const BUDGET_SKILL_KB = 25;

// 예산 초과 사유서 레지스트리 — 사유서가 실재하고 그 문서가 변호하는 크기 안에 있으면
// WARN이 아니라 INFO로 남긴다. "지워서 조용해지는" 대신 "근거를 적어 조용해지는" 경로를 연다.
// (이 저장소는 이미 사유서 관행을 채택했는데 린터만 그것을 몰라 WARN이 영구히 남았고,
//  그 영구 WARN이 다음 라운드마다 재감축 논쟁을 되살렸다 — reviewer RT-1 지적, 우선순위 High.)
//
// 사유서 경로를 제품 파일(agents/*.md frontmatter)에 두지 않고 이 저장소 전용 린터에 두는 이유:
// docs/refactor/는 플러그인 번들에 포함되지 않아 설치 직원의 에이전트 MD에 그 경로를 박으면
// 이식성 위반이다(v3-03b-frontend-reviewer-slimming-plan.md의 D1 발견가능성 항 결론).
//
// bytes = 그 사유서가 실측으로 "변호한다"고 명시한 크기. 이 숫자를 넘어서 자라면 면제가 아니라
// 드리프트로 잡아 사유서 갱신을 요구한다(면제가 형식적 면죄부가 되지 않게 하는 장치).
//
// 2026-08-22 현재 등록 0건이다. 이전에 등록돼 있던 사유서 4건(pm·trainer·frontend-dev·reviewer)은
// 슬리밍 라운드 폐기·배포본 원복 때 docs/refactor/에서 함께 삭제됐고, 그 문서들이 변호하던 크기는
// 원복으로 사라진 슬림본의 실측치다(현 배포본은 pm +9.0KB · frontend-dev +4.4KB · reviewer +3.6KB로
// 그 변호분을 이미 넘었다). 복구했다면 실재하지 않는 본문을 변호하는 문서가 되므로 등록을 지웠다 —
// 해당 4개는 BUDGET_UNJUSTIFIED(근거 없는 초과)로 정직하게 남는다. 기제 자체는 유지한다.
const BUDGET_RATIONALE = {};
// 사유서가 변호하는 크기에서 이만큼까지는 드리프트로 보지 않는다(오탈자·1줄 규칙 수정 여유).
const RATIONALE_DRIFT_TOLERANCE_B = 512;

const AGENT_BUDGET_REMEDY =
  '상시 비용이다(호출마다 전량 로드). 성능에 기여하지 않는 것(중복 서술·죽은 참조·미실행 절차)이 있으면 그것만 제거하고, ' +
  '자리가 틀린 상세는 Skill/Knowledge로 옮기며, 전부 기여한다면 docs/refactor/에 예산 초과 사유서를 쓰고 이 스크립트의 ' +
  'BUDGET_RATIONALE에 등록한다. 줄 수를 줄이는 것 자체는 이 WARN의 해소 근거가 아니다.';
const SKILL_BUDGET_REMEDY =
  '조건부 비용이다(invoke 시에만 로드) — 상시 비용보다 부담이 작으므로 분량 자체는 결함이 아니다. ' +
  '참고자료 성격의 단락만 knowledge/로 옮기고, 발동해야 하는 절차 본문이면 그대로 두고 사유서를 쓴다.'

const DESCRIPTION_MIN = 40;
const DESCRIPTION_MAX = 1024;

const findings = [];
function report(level, code, file, message) {
  findings.push({ level, code, file, message });
}
const error = (...a) => report('ERROR', ...a);
const warn = (...a) => report('WARN', ...a);
const info = (...a) => report('INFO', ...a);

/**
 * 컨텍스트 예산 판정. 크기를 결함으로 보지 않고 "근거 없는 초과"만 잡는다.
 * key는 플러그인명을 뺀 안정 경로('agents/pm.md' · 'skills/<dir>/SKILL.md').
 */
function checkContextBudget(rel, key, bytes, budgetKb, remedy) {
  const kb = bytes / 1024;
  const r = BUDGET_RATIONALE[key];
  if (kb <= budgetKb) return;              // 예산 이내 — 볼 것 없음
  if (!r) {
    warn('BUDGET_UNJUSTIFIED', rel, `${kb.toFixed(1)} KB — 권고 예산 ${budgetKb} KB 초과, 사유서 없음. ${remedy}`);
    return;
  }
  if (!fs.existsSync(path.join(REPO_ROOT, r.doc))) {
    warn('BUDGET_RATIONALE_MISSING', rel, `${kb.toFixed(1)} KB — 사유서 ${r.doc}가 실재하지 않는다(면제 근거 소멸). 사유서를 복구하거나 BUDGET_RATIONALE 등록을 지운다.`);
    return;
  }
  if (bytes > r.bytes + RATIONALE_DRIFT_TOLERANCE_B) {
    warn('BUDGET_RATIONALE_DRIFT', rel, `${kb.toFixed(1)} KB — 사유서 ${r.doc}가 변호하는 ${(r.bytes / 1024).toFixed(1)} KB를 ${bytes - r.bytes} B 초과. **줄이라는 뜻이 아니라** 사유서를 실측 갱신하라는 뜻이다.`);
    return;
  }
  info('BUDGET_RATIONALE_OK', rel, `${kb.toFixed(1)} KB — 권고 ${budgetKb} KB 초과이나 사유서 있음(${r.doc}, 변호 ${(r.bytes / 1024).toFixed(1)} KB). 결함 아님 — 재감축 대상으로 올리기 전에 그 문서를 먼저 읽는다.`);
}

function parseArgs(argv) {
  const opts = { plugin: 'malgn-agent', format: 'text', strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--plugin') opts.plugin = argv[++i];
    else if (a === '--format') opts.format = argv[++i];
    else if (a === '--strict') opts.strict = true;
    else if (a === '--help' || a === '-h') {
      console.log('usage: node scripts/validate-agent-assets.mjs [--plugin NAME] [--format text|json] [--strict]');
      process.exit(0);
    }
  }
  return opts;
}

function readFrontmatter(absPath, relPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) {
    error('NO_FRONTMATTER', relPath, 'YAML frontmatter 블록(--- ... ---)이 없다');
    return { data: null, body: raw, bytes: Buffer.byteLength(raw) };
  }
  let data;
  try {
    data = yamlLoad(m[1]);
  } catch (e) {
    error('YAML_PARSE', relPath, `frontmatter YAML 파싱 실패: ${e.message.split('\n')[0]}`);
    return { data: null, body: raw.slice(m[0].length), bytes: Buffer.byteLength(raw) };
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    error('YAML_SHAPE', relPath, 'frontmatter가 key: value 매핑이 아니다');
    return { data: null, body: raw.slice(m[0].length), bytes: Buffer.byteLength(raw) };
  }
  return { data, body: raw.slice(m[0].length), bytes: Buffer.byteLength(raw) };
}

// 참조 검사 전처리: 펜스 코드블록은 예시·템플릿이므로 참조 대상에서 제외한다.
function stripFencedCode(body) {
  return body.replace(/^```[\s\S]*?^```/gm, '');
}

// "구 X …폐기/이관/병합/retire" 형태의 과거 이력 서술은 살아있는 포인터가 아니다.
const RETIREMENT_NOTE = /(폐기|이관|retire|deprecat|흡수|분산 병합|삭제됨|없어졌|더 이상)/i;

// 줄 단위로 참조를 뽑되, 이력 서술 줄은 건너뛴다.
function* liveReferences(body, re) {
  for (const line of stripFencedCode(body).split(/\r?\n/)) {
    if (RETIREMENT_NOTE.test(line)) continue;
    for (const m of line.matchAll(re)) yield m;
  }
}

// ── 정본(canonical) 선언 검사 ────────────────────────────────────────
// v3 라운드에서 확인된 실패 3건이 전부 "대상 내용을 안 읽고 위치·형태만으로 정본 지위를 부여한" 것이었다:
//   ① 파일 크기가 비슷하다 → 중복이다      (C-4, revert됨)
//   ② 여러 파일에 같은 문구가 있다 → 중복이다 (C-1, 추정 14KB가 실제 4KB)
//   ③ 저기 표가 있다 → 저기가 정본이다      (M-1, 지목된 표가 스스로 "정본 아님"을 선언)
// 셋 다 기계 검사로 잡을 수 있다. "X가 정본"이라 주장하는 곳과, 스스로 "정본이 아니다"라고
// 선언하는 곳을 함께 수집해 모순·순환을 찾는다.

// "(정본: Skill `x`)" / "정본: agents/x.md" / "canonical: ..." 형태의 정본 지목
const CANONICAL_CLAIM = /정본[^\n]{0,40}?(?:Skill\s+`([a-z0-9:\-]+)`|`((?:agents|skills|knowledge)\/[A-Za-z0-9_\-/.]+\.md)`)/g;
// 스스로 정본이 아님을 선언하는 문장
const CANONICAL_DISCLAIMER = /(진실의 원천이 아니|정본이 아니|참고용 요약이지|source of truth가 아니)/;

function collectCanonicalDisclaimers(pluginRoot) {
  const disclaiming = new Set(); // 정본임을 부인한 파일의 plugin-relative 경로
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.md')) continue;
      const text = fs.readFileSync(p, 'utf8');
      if (CANONICAL_DISCLAIMER.test(text)) {
        disclaiming.add(path.relative(pluginRoot, p).replace(/\\/g, '/'));
      }
    }
  };
  for (const sub of ['agents', 'skills', 'knowledge']) {
    const d = path.join(pluginRoot, sub);
    if (fs.existsSync(d)) walk(d);
  }
  return disclaiming;
}

// 지목의 "방향"을 구분해야 한다. 다음 둘은 정반대인데 문자열만 보면 비슷하다:
//   (A) "정본: Skill `x`"                      → x가 정본이라는 지목      ← 검사 대상
//   (B) "정본은 이 절 — Skill `x` 표는 요약"    → x를 요약으로 강등하는 서술 ← 오탐이면 안 됨
// (B)를 (A)로 오인하면 올바르게 정리된 파일이 ERROR로 잡히고, 그러면 이 린터는 무시당한다.
// "정본은 이 절이 **아닙니다**" 같은 부정문은 자기선언이 아니다(오히려 부인이다) — 제외한다.
// 간격에 부정어가 끼면 자기선언이 아니다 — "이 절이 아닙니다 … 정본: X"는 오히려 X를 정본으로 지목한다.
// 주의: 한국어 활용상 어간이 아니→아닙(아닙니다)으로 바뀌어 "아니" 2글자가 안 나타난다. 활용형을 모두 넣는다.
const NEG = '아니|아닙|아님|아냐';
const SELF_CANONICAL = new RegExp(
  `(정본은?\\s*(이|여기)\\s*(절|문서|파일)(?![^\\n]{0,10}(?:${NEG}))` +
  `|이\\s*(절|문서|파일)이\\s*(?:(?!${NEG})[^\\n]){0,20}정본(?![^\\n]{0,10}(?:${NEG})))`,
);
const TARGET_DEMOTED = /^[^\n]{0,30}?(표는|는|은)\s*요약/;

function checkCanonicalClaims(relPath, body, disclaiming, skillDirNames) {
  for (const line of stripFencedCode(body).split(/\r?\n/)) {
    if (RETIREMENT_NOTE.test(line)) continue;
    // (B) 자기선언 줄 — 이 줄의 다른 자산 언급은 강등 대상이지 정본 지목이 아니다.
    if (SELF_CANONICAL.test(line)) continue;
    for (const m of line.matchAll(CANONICAL_CLAIM)) {
      // 지목 직후가 "…는 요약"이면 강등 서술이다.
      if (TARGET_DEMOTED.test(line.slice(m.index + m[0].length))) continue;
      const skillName = m[1] ? (m[1].includes(':') ? m[1].split(':').pop() : m[1]) : null;
      const target = skillName
        ? (skillDirNames.includes(skillName) ? `skills/${skillName}/SKILL.md` : null)
        : m[2];
      if (!target) continue;
      if (disclaiming.has(target)) {
        error('CANONICAL_CIRCULAR', relPath,
          `정본으로 지목한 '${target}'이 자기 본문에서 "정본이 아니다"라고 선언한다 — 정본이 확정되지 않는다`);
      }
    }
  }
}

// ── § 앵커 검사 ──────────────────────────────────────────────────────
// 파일 존재만 확인하면 "파일은 맞는데 그 안에 그 절이 없는" 참조를 통과시킨다.
// 실제 사고: devops.md가 docker-cloudflare-guide.md §7을 pnpm 스큐 상세로 인용했는데
// 그 파일엔 §6까지만 있었고(dangling), 뒤에 §7이 전혀 다른 주제로 신설되면서
// "없는 포인터"가 "틀린 곳을 가리키는 포인터"가 됐다 — 후자가 더 나쁘다.
// 없으면 못 찾았다고 인지하지만, 있으면 읽고 정답인 줄 안다.

// "`knowledge/x/y.md` §7" / "Skill `x` §3.5" 형태에서 (대상, 절번호)를 뽑는다.
const ANCHOR_REF = /(?:`((?:knowledge|agents|skills)\/[A-Za-z0-9_\-/.]+\.md)`|Skill\s+`([a-z0-9:\-]+)`)[^\n`]{0,20}?§\s*([0-9]+(?:\.[0-9]+)?)/g;

function sectionNumbers(absPath) {
  const nums = new Set();
  for (const line of fs.readFileSync(absPath, 'utf8').split(/\r?\n/)) {
    // "## 3.5 제목" / "### 7. 제목" / "### 3) 제목" 전부 허용
    const m = line.match(/^#{2,4}\s+([0-9]+(?:\.[0-9]+)?)[.)\s]/);
    if (m) nums.add(m[1]);
  }
  return nums;
}

function checkAnchors(relPath, body, pluginRoot, skillDirNames, sectionCache) {
  for (const m of liveReferences(body, ANCHOR_REF)) {
    const skillName = m[2] ? (m[2].includes(':') ? m[2].split(':').pop() : m[2]) : null;
    const targetRel = skillName
      ? (skillDirNames.includes(skillName) ? `skills/${skillName}/SKILL.md` : null)
      : m[1];
    if (!targetRel) continue;
    const abs = path.join(pluginRoot, targetRel);
    if (!fs.existsSync(abs)) continue; // 파일 부재는 REF_* 검사가 따로 잡는다
    if (!sectionCache.has(targetRel)) sectionCache.set(targetRel, sectionNumbers(abs));
    const nums = sectionCache.get(targetRel);
    if (nums.size === 0) continue; // 번호 없는 문서는 검사 대상 아님
    const want = m[3];
    // §7이 요청됐는데 7도 7.x도 없으면 깨진 앵커
    const hit = nums.has(want) || [...nums].some((n) => n.startsWith(`${want}.`));
    if (!hit) {
      error('REF_ANCHOR_MISSING', relPath,
        `${targetRel} §${want}을 인용하나 그 문서에 해당 절이 없다 (있는 절: ${[...nums].sort().join(', ') || '없음'})`);
    }
  }
}

function typeMatches(value, spec) {
  return spec.split('|').some((t) => {
    if (t === 'array') return Array.isArray(value);
    if (t === 'string') return typeof value === 'string';
    if (t === 'boolean') return typeof value === 'boolean';
    if (t === 'number') return typeof value === 'number';
    return false;
  });
}

function checkDescription(relPath, description, kind) {
  if (typeof description !== 'string') return;
  const len = description.length;
  if (len < DESCRIPTION_MIN) {
    warn('DESC_WEAK', relPath, `description이 ${len}자로 너무 짧다 — 무엇을/언제 호출하는지(routing contract) 담기 어렵다`);
  }
  if (len > DESCRIPTION_MAX) {
    warn('DESC_LONG', relPath, `description이 ${len}자로 과도하게 길다(권고 ${DESCRIPTION_MAX}자 이하)`);
  }
  const hasTrigger = /(사용|호출|when |use |요청|시 |할 때|필요할)/.test(description);
  if (!hasTrigger) {
    warn('DESC_NO_TRIGGER', relPath, `${kind} description에 호출 조건(언제 쓰는지)이 없다 — routing 정확도가 떨어진다`);
  }
}

function scanAbsolutePaths(relPath, body) {
  const patterns = [
    { re: /\/Users\/[a-z0-9_.\-]+\//gi, label: 'macOS 개인 홈 절대경로' },
    { re: /C:\\\\?Users\\\\?[A-Za-z0-9_.\-]+/g, label: 'Windows 개인 홈 절대경로' },
    { re: /~\/\.claude\//g, label: '개인 전역 ~/.claude 경로(플러그인은 ${CLAUDE_PLUGIN_ROOT} 사용)' },
  ];
  for (const { re, label } of patterns) {
    const hits = [...body.matchAll(re)];
    if (hits.length) {
      warn('ABS_PATH', relPath, `${label} ${hits.length}건 (${[...new Set(hits.map((h) => h[0]))].slice(0, 3).join(', ')})`);
    }
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const pluginRoot = path.join(REPO_ROOT, opts.plugin);
  if (!fs.existsSync(pluginRoot)) {
    console.error(`plugin 디렉터리 없음: ${pluginRoot}`);
    process.exit(2);
  }

  // ── Skill 인벤토리 ────────────────────────────────────────────────
  const skillsDir = path.join(pluginRoot, 'skills');
  const skillNames = new Set();
  const skillDirNames = fs.existsSync(skillsDir)
    ? fs.readdirSync(skillsDir).filter((d) => fs.statSync(path.join(skillsDir, d)).isDirectory())
    : [];
  const skillNameToFile = new Map();
  const skillFiles = [];

  for (const dir of skillDirNames) {
    const abs = path.join(skillsDir, dir, 'SKILL.md');
    const rel = path.relative(REPO_ROOT, abs);
    if (!fs.existsSync(abs)) {
      error('SKILL_MISSING_MD', path.relative(REPO_ROOT, path.join(skillsDir, dir)), 'SKILL.md가 없다');
      continue;
    }
    const { data, body, bytes } = readFrontmatter(abs, rel);
    skillFiles.push({ dir, rel, abs, data, body, bytes });
    // 디렉터리명 자체가 호출 식별자다. frontmatter가 깨져도 참조 해석에서 연쇄 오탐이 나지 않도록 먼저 등록한다.
    skillNames.add(dir);
    if (!data) continue;

    if (typeof data.name === 'string') {
      if (skillNameToFile.has(data.name)) {
        error('SKILL_DUP_NAME', rel, `Skill name '${data.name}' 중복 (기존: ${skillNameToFile.get(data.name)})`);
      }
      skillNameToFile.set(data.name, rel);
      skillNames.add(data.name);
      if (data.name !== dir) {
        warn('SKILL_NAME_MISMATCH', rel, `frontmatter name '${data.name}' ≠ 디렉터리명 '${dir}' — 호출명은 디렉터리명 기준`);
      }
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.name)) {
        error('SKILL_BAD_NAME', rel, `Skill name '${data.name}'이 lowercase-hyphen 규칙 위반`);
      }
    }
    if (typeof data.description !== 'string' || !data.description.trim()) {
      error('SKILL_NO_DESC', rel, 'description 누락 — 모델이 언제 이 Skill을 쓸지 판단할 수 없다');
    } else {
      checkDescription(rel, data.description, 'Skill');
    }

    checkContextBudget(rel, `skills/${dir}/SKILL.md`, bytes, BUDGET_SKILL_KB, SKILL_BUDGET_REMEDY);
    scanAbsolutePaths(rel, body);
  }

  // ── Knowledge 인벤토리 ────────────────────────────────────────────
  const knowledgeDir = path.join(pluginRoot, 'knowledge');
  const knowledgeFiles = new Set();
  if (fs.existsSync(knowledgeDir)) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.md')) knowledgeFiles.add(path.relative(pluginRoot, p).replace(/\\/g, '/'));
      }
    };
    walk(knowledgeDir);
  }

  // 정본 부인 선언을 먼저 수집한다(순환 정본 검사용)
  const disclaiming = collectCanonicalDisclaimers(pluginRoot);
  const sectionCache = new Map();

  // ── Agent 검사 ────────────────────────────────────────────────────
  const agentsDir = path.join(pluginRoot, 'agents');
  const agentNameToFile = new Map();
  const agentFiles = fs.existsSync(agentsDir)
    ? fs.readdirSync(agentsDir).filter((f) => f.endsWith('.md')).sort()
    : [];
  const referencedSkills = new Set();
  const sizes = [];

  for (const file of agentFiles) {
    const abs = path.join(agentsDir, file);
    const rel = path.relative(REPO_ROOT, abs);
    const base = file.replace(/\.md$/, '');
    const { data, body, bytes } = readFrontmatter(abs, rel);
    sizes.push({ agent: base, bytes });
    if (!data) continue;

    // name
    if (typeof data.name !== 'string' || !data.name.trim()) {
      error('AGENT_NO_NAME', rel, 'name 누락');
    } else {
      if (agentNameToFile.has(data.name)) {
        error('AGENT_DUP_NAME', rel, `Agent name '${data.name}' 중복 (기존: ${agentNameToFile.get(data.name)})`);
      }
      agentNameToFile.set(data.name, rel);
      if (data.name.includes(':')) {
        error('AGENT_BAD_NAME', rel, `name에 ':' 사용 불가 (플러그인 스코프 예약, v2.1.218부터 에러)`);
      } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(data.name)) {
        error('AGENT_BAD_NAME', rel, `name '${data.name}'이 lowercase-hyphen 규칙 위반`);
      }
      if (data.name !== base) {
        warn('AGENT_NAME_MISMATCH', rel, `frontmatter name '${data.name}' ≠ 파일명 '${base}'`);
      }
    }

    // description
    if (typeof data.description !== 'string' || !data.description.trim()) {
      error('AGENT_NO_DESC', rel, 'description 누락 — PM/메인세션이 위임 대상을 고를 수 없다');
    } else {
      checkDescription(rel, data.description, 'Agent');
    }

    // unknown / ignored / typed fields
    for (const key of Object.keys(data)) {
      if (!AGENT_KNOWN_FIELDS.has(key)) {
        error('AGENT_UNKNOWN_FIELD', rel, `알 수 없는 frontmatter 필드 '${key}' (오타 가능성)`);
        continue;
      }
      if (AGENT_IGNORED_IN_PLUGIN.has(key)) {
        warn('AGENT_IGNORED_FIELD', rel, `'${key}'은 plugin subagent에서 무시된다(공식 문서) — 제거 권장`);
      }
      const spec = AGENT_FIELD_TYPES[key];
      if (spec && !typeMatches(data[key], spec)) {
        error('AGENT_FIELD_TYPE', rel, `필드 '${key}' 타입이 ${spec}이 아니다 (실제: ${Array.isArray(data[key]) ? 'array' : typeof data[key]})`);
      }
    }
    if (typeof data.model === 'string' && !VALID_MODEL.test(data.model)) {
      error('AGENT_BAD_MODEL', rel, `model '${data.model}'은 허용값(sonnet/opus/haiku/fable/inherit/claude-*)이 아니다`);
    }
    if (typeof data.effort === 'string' && !VALID_EFFORT.has(data.effort)) {
      error('AGENT_BAD_EFFORT', rel, `effort '${data.effort}'은 low/medium/high/xhigh/max 중 하나여야 한다`);
    }
    if (typeof data.memory === 'string' && !VALID_MEMORY.has(data.memory)) {
      error('AGENT_BAD_MEMORY', rel, `memory '${data.memory}'은 user/project/local 중 하나여야 한다`);
    }
    if (data.memory !== undefined) {
      warn('AGENT_MEMORY_ENABLED', rel, 'memory 활성화 — MCP 중앙 상태와 이중 source of truth 위험 (SPEC §8)');
    }

    // skills preload 참조 검증
    if (Array.isArray(data.skills)) {
      for (const s of data.skills) {
        if (typeof s !== 'string') { error('AGENT_SKILL_TYPE', rel, 'skills 항목이 문자열이 아니다'); continue; }
        const bare = s.includes(':') ? s.split(':').pop() : s;
        if (!skillNames.has(bare)) {
          error('AGENT_SKILL_MISSING', rel, `skills preload에 존재하지 않는 Skill '${s}'`);
        }
        referencedSkills.add(bare);
      }
      if (data.skills.length > 3) {
        warn('AGENT_SKILL_PRELOAD_MANY', rel, `skills preload ${data.skills.length}개 — startup 컨텍스트 비용. 상황별 Skill은 preload하지 않는다 (SPEC §7)`);
      }
    }

    // 본문 참조 검증: Skill `name` / knowledge/... 경로
    for (const m of liveReferences(body, /Skill\s+`([a-z0-9:\-]+)`/g)) {
      const bare = m[1].includes(':') ? m[1].split(':').pop() : m[1];
      referencedSkills.add(bare);
      if (!skillNames.has(bare)) {
        error('REF_SKILL_MISSING', rel, `본문이 참조하는 Skill '${m[1]}'이 존재하지 않는다`);
      }
    }
    for (const m of liveReferences(body, /\bknowledge\/[A-Za-z0-9_\-/]+\.md/g)) {
      const target = m[0].replace(/^.*?knowledge\//, 'knowledge/');
      if (!knowledgeFiles.has(target)) {
        error('REF_KNOWLEDGE_MISSING', rel, `본문이 참조하는 knowledge 파일이 없다: ${target}`);
      }
    }
    for (const m of liveReferences(body, /`(agents\/[a-z0-9\-]+\.md)`/g)) {
      if (!fs.existsSync(path.join(pluginRoot, m[1]))) {
        error('REF_AGENT_MISSING', rel, `본문이 참조하는 agent 파일이 없다: ${m[1]}`);
      }
    }
    for (const m of liveReferences(body, /`(?:malgn-agent\/)?(bin\/[a-z0-9\-.]+\.(?:mjs|cjs|js))`/g)) {
      if (!fs.existsSync(path.join(pluginRoot, m[1]))) {
        error('REF_BIN_MISSING', rel, `본문이 참조하는 스크립트가 없다: ${m[1]}`);
      }
    }

    checkCanonicalClaims(rel, body, disclaiming, skillDirNames);
    checkAnchors(rel, body, pluginRoot, skillDirNames, sectionCache);

    // 컨텍스트 예산 (상시 비용)
    checkContextBudget(rel, `agents/${base}.md`, bytes, META_AGENTS.has(base) ? BUDGET_META_KB : BUDGET_SPECIALIST_KB, AGENT_BUDGET_REMEDY);
    scanAbsolutePaths(rel, body);
  }

  // ── Skill 본문의 참조 검증 + orphan 탐지 ──────────────────────────
  for (const { rel, body } of skillFiles) {
    if (!body) continue;
    for (const m of liveReferences(body, /Skill\s+`([a-z0-9:\-]+)`/g)) {
      const bare = m[1].includes(':') ? m[1].split(':').pop() : m[1];
      if (!skillNames.has(bare)) {
        error('REF_SKILL_MISSING', rel, `본문이 참조하는 Skill '${m[1]}'이 존재하지 않는다`);
      }
    }
    for (const m of liveReferences(body, /\bknowledge\/[A-Za-z0-9_\-/]+\.md/g)) {
      const target = m[0].replace(/^.*?knowledge\//, 'knowledge/');
      if (!knowledgeFiles.has(target)) {
        error('REF_KNOWLEDGE_MISSING', rel, `본문이 참조하는 knowledge 파일이 없다: ${target}`);
      }
    }
    for (const m of liveReferences(body, /`(?:malgn-agent\/)?(bin\/[a-z0-9\-.]+\.(?:mjs|cjs|js))`/g)) {
      if (!fs.existsSync(path.join(pluginRoot, m[1]))) {
        error('REF_BIN_MISSING', rel, `본문이 참조하는 스크립트가 없다: ${m[1]}`);
      }
    }
  }

  for (const { rel, body } of skillFiles) {
    if (!body) continue;
    checkCanonicalClaims(rel, body, disclaiming, skillDirNames);
    checkAnchors(rel, body, pluginRoot, skillDirNames, sectionCache);
  }

  // orphan Skill: 어떤 agent도(frontmatter/본문 어디서도) 참조하지 않는 Skill
  // 슬래시 커맨드로 직접 쓰는 Skill도 있으므로 WARN.
  const allAgentBodies = agentFiles.map((f) => fs.readFileSync(path.join(agentsDir, f), 'utf8')).join('\n');
  const allSkillBodies = skillFiles.map((s) => s.body).join('\n');
  const haystack = allAgentBodies + allSkillBodies;
  for (const dir of skillDirNames) {
    if (referencedSkills.has(dir)) continue;
    if (haystack.includes(dir)) continue;
    warn('SKILL_ORPHAN', `${opts.plugin}/skills/${dir}/SKILL.md`, '어떤 Agent/Skill도 이 Skill을 참조하지 않는다 (사용자 직접 호출 전용이면 무시)');
  }

  // ── 리포트 ────────────────────────────────────────────────────────
  const errors = findings.filter((f) => f.level === 'ERROR');
  const warns = findings.filter((f) => f.level === 'WARN');
  const infos = findings.filter((f) => f.level === 'INFO');

  if (opts.format === 'json') {
    console.log(JSON.stringify({
      plugin: opts.plugin,
      counts: { agents: agentFiles.length, skills: skillDirNames.length, knowledge: knowledgeFiles.size },
      sizes: sizes.sort((a, b) => b.bytes - a.bytes),
      findings,
      summary: { errors: errors.length, warnings: warns.length, infos: infos.length },
    }, null, 2));
  } else {
    console.log(`\n=== malgn-agent asset lint (${opts.plugin}) ===`);
    console.log(`agents ${agentFiles.length} · skills ${skillDirNames.length} · knowledge ${knowledgeFiles.size}\n`);
    for (const f of [...errors, ...warns, ...infos]) {
      console.log(`${f.level.padEnd(5)} [${f.code}] ${f.file}\n      ${f.message}`);
    }
    console.log(`\n--- 합계: ERROR ${errors.length} · WARN ${warns.length} · INFO ${infos.length} ---`);
  }

  if (errors.length > 0) process.exit(1);
  if (opts.strict && warns.length > 0) process.exit(1);
  process.exit(0);
}

main();
