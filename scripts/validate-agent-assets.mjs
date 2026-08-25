#!/usr/bin/env node
/**
 * validate-agent-assets.mjs — malgn-agent Agent/Skill 자산 정적 검증기
 *
 * 검사 대상: <plugin>/agents/*.md 의 YAML frontmatter, <plugin>/skills/<name>/SKILL.md 의 YAML frontmatter,
 * 그리고 agents·skills·knowledge **세 영역 본문 모두**가 참조하는 Skill/Knowledge/Agent/bin 경로.
 * 여기에 더해 제품 전 영역(bin·hooks 포함)의 조회 불가 식별자 인용과,
 * 번들 스크립트 도달 경로(추측형 플레이스홀더·맨 명령어 실행 지시)를 잡는다.
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
// 이전에 등록돼 있던 사유서 4건(pm·trainer·frontend-dev·reviewer)은
// 슬리밍 라운드 폐기·배포본 원복 때 docs/refactor/에서 함께 삭제됐고, 그 문서들이 변호하던 크기는
// 원복으로 사라진 슬림본의 실측치다(현 배포본은 pm +9.0KB · frontend-dev +4.4KB · reviewer +3.6KB로
// 그 변호분을 이미 넘었다). 복구했다면 실재하지 않는 본문을 변호하는 문서가 되므로 등록을 지웠다 —
// 해당 4개는 BUDGET_UNJUSTIFIED(근거 없는 초과)로 정직하게 남는다. 기제 자체는 유지한다.
const BUDGET_RATIONALE = {
  // PM 행동규율 블록이 @import에서 CLAUDE.md 인라인 관리 구역으로 바뀌면서 §9 판정 절차가 커졌다.
  // 늘어난 분량이 전부 "남의 CLAUDE.md를 고치기 전에 거쳐야 하는 거부 조건·동의 게이트"라 감축 대상이 아니다.
  'skills/project-standards/SKILL.md': {
    doc: 'docs/refactor/project-standards-skill-budget-rationale.md',
    bytes: 29286,
  },
  // 승인된 결함 5건(agent-md-defects-20260825) + reviewer 재검증 라운드에서 나온 잔여 연쇄 수정.
  // 늘어난 내용은 전부 실행 지시(스크립트 사용범위 분리·판정 회차 기록 의무·hub 필수 필드)라 압축 대상이
  // 아니다 — 근거: docs/refactor/evaluator-budget-rationale.md.
  'agents/evaluator.md': {
    doc: 'docs/refactor/evaluator-budget-rationale.md',
    bytes: 18633,
  },
};
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

// 살아있는 포인터가 아닌 줄은 참조 검사에서 건너뛴다. 다만 "건너뛸 것"과 "확인해야 할 것"을
// 가르는 기준은 **그 문장이 대상의 실재를 주장하는가**이지, 과거형이라는 사실이 아니다.
//
//   (a) "구 X는 폐기됐다 / 삭제됨 / 더 이상 없다"  → 대상이 없다고 문장이 말한다        → 건너뛴다
//   (b) "이 플러그인에 미번들 / 미포함"            → 없는 게 정상이라고 문장이 말한다    → 건너뛴다
//   (c) "본문은 skills/X로 이관/흡수/병합됐다"     → **X가 있다고 문장이 주장한다**      → 확인한다
//
// (c)를 (a)와 같이 묶어 건너뛴 것이 실제 사고의 원인이었다: 스킬 개명 라운드 뒤 knowledge의
// 죽은 스킬 참조 16건 중 대부분이 "…로 이관됨" 줄에 있었고, 그 줄을 통째로 건너뛰는 바람에
// 약 2주간 ERROR 0 초록불 아래에서 생존했다. 이사 간 곳을 적은 안내판이야말로 유효해야 한다.
const RETIREMENT_NOTE = /(폐기|retire|deprecat|삭제됨|없어졌|더 이상|미번들|미포함|번들되지 않)/i;

// 이사 안내판 줄. 한 줄 안에 **떠난 곳(없어도 되는 것)**과 **이사 간 곳(있어야 하는 것)**이
// 함께 적히므로, 줄을 통째로 건너뛰거나 통째로 검사하는 것 둘 다 틀린다.
//   "구 `knowledge/a.md`에서 흡수" → a.md는 없는 게 정상  (떠난 곳)
//   "본문은 `skills/b/SKILL.md`로 이관" → b는 있어야 한다  (이사 간 곳)
// 가르는 방향은 "이사 간 곳을 알아보기"가 아니라 **"떠난 곳을 알아보기"**다. 목적지 표기는
// 형태가 여러 갈래라("…로 이관", "… → X", "…skill로 이관됨 — X, 2026-07-23") 목적지만
// 화이트리스트로 잡으면 그때마다 새 형태가 검사망을 빠져나간다. 반면 떠난 곳은 한국어에서
// 표지가 좁다 — 앞의 "구", 뒤의 "에서/는/의 본문". 좁은 쪽을 제외 목록으로 삼는다.
const RELOCATION_NOTE = /(이관|흡수|병합|통합)/;
const RELOCATION_SRC_BEFORE = /(?:^|[\s(])구\s*`?$/;                     // "구 `knowledge/a.md`에서 흡수"
const RELOCATION_SRC_AFTER = /^`?\s*(?:에서|는|은|의\s*(?:본문|내용))/;    // "…`a.md`는 이 skill로 이관"

// 줄 단위로 참조를 뽑되, 이력 서술 줄은 건너뛴다.
// 주석은 다음 줄로 접히는 일이 흔하므로(인용문·표 밖 서술) 바로 다음 줄까지 함께 본다 —
// 실제로 "…이 스크립트는 이 플러그인에 / 번들되지 않음" 형태로 접혀 있었다.
//
// includeFenced: 펜스 안까지 본다. 기본은 제외지만(펜스는 예시·템플릿), **복사·실행
// 커맨드 자체가 참조 지점인 자원**은 그 커맨드가 ```bash 펜스 안에 살기 때문에 제외하면
// 가장 깨지기 쉬운 자리를 통째로 못 본다(§checkBundledResourceRefs).
function* liveReferences(body, re, { includeFenced = false } = {}) {
  const lines = (includeFenced ? body : stripFencedCode(body)).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (RETIREMENT_NOTE.test(line)) continue;
    const next = lines[i + 1];
    if (next !== undefined && next.trim() !== '' && RETIREMENT_NOTE.test(next)) continue;
    const relocation = RELOCATION_NOTE.test(line);
    for (const m of line.matchAll(re)) {
      if (relocation) {
        const before = line.slice(0, m.index);
        const after = line.slice(m.index + m[0].length);
        if (RELOCATION_SRC_BEFORE.test(before) || RELOCATION_SRC_AFTER.test(after)) continue;
      }
      yield m;
    }
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
// 백틱 안 경로 앞에 `${CLAUDE_PLUGIN_ROOT}/` 접두가 붙어도(읽는 이가 그대로 Read하는 실제 참조
// 표기) 잡아야 한다 — 접두 유무와 무관하게 지목 대상은 같은 파일이다. 접두는 캡처하지 않는다
// (target은 pluginRoot 기준 상대경로여야 disclaiming 셋과 비교가 맞는다).
const CANONICAL_CLAIM = /정본[^\n]{0,40}?(?:Skill\s+`([a-z0-9:\-]+)`|`(?:\$\{CLAUDE_PLUGIN_ROOT\}\/)?((?:agents|skills|knowledge)\/[A-Za-z0-9_\-/.]+\.md)`)/g;
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
// 참조와 § 사이는 공백(또는 "의"·쉼표)만 허용한다. 간격을 넓게 잡으면 한 문장 안의 무관한
// 절번호가 앞의 파일명과 잘못 짝지어진다 — 실제로 "`…/SKILL.md`로 이관) 배경만 남음 — §1.3"에서
// 방법론 rubric의 §1.3이 그 SKILL.md의 절로 오인돼 없는 절 ERROR가 났다.
// 백틱 안 경로 앞에 `${CLAUDE_PLUGIN_ROOT}/` 접두가 붙어도 같은 대상을 가리키므로 매칭한다
// (CANONICAL_CLAIM과 동일 판단 — 접두는 캡처하지 않아 targetRel이 pluginRoot 기준 상대경로로 남는다).
const ANCHOR_REF = /(?:`(?:\$\{CLAUDE_PLUGIN_ROOT\}\/)?((?:knowledge|agents|skills)\/[A-Za-z0-9_\-/.]+\.md)`|Skill\s+`([a-z0-9:\-]+)`)[ \t]{0,3}(?:의|,)?[ \t]{0,3}§\s*([0-9]+(?:\.[0-9]+)?)/g;

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

// ── 번들 자원 경로 참조 (skills/*/scripts/* · templates/*) ────────────
// 제품 본문은 bin/·knowledge/ 말고도 두 종류의 번들 자원을 가리킨다:
//   · `skills/<스킬>/scripts/<이름>.mjs` — 스킬이 실행하라고 지시하는 자기 디렉터리의 스크립트
//   · `templates/<이름>/…`              — 프로젝트로 복사해 쓰라고 지시하는 스캐폴드
// 둘 다 실재 검사를 받지 않아, 파일을 옮기거나 이름을 바꿔도 초록불이 그대로 남았다. 그러면
// 파손은 설치 직원의 세션에서 "그런 파일 없음"으로 처음 드러난다 — bin/ 참조에서 이미 겪은
// 파손 유형이라 같은 규약(경로를 뽑아 pluginRoot 기준으로 실재 확인 → ERROR)으로 확장한다.
// 심각도를 ERROR로 두는 근거도 그 규약이다: REF_BIN_MISSING·REF_KNOWLEDGE_MISSING·
// REF_AGENT_MISSING 셋 다 "참조 대상이 없다"를 ERROR로 잡는다(WARN은 CI 종료 코드에
// 영향을 주지 않아, 죽은 포인터가 초록불 아래에서 배포된다).
//
// **펜스 안까지 본다.** 다른 참조 검사는 펜스를 예시로 보고 제외하지만, 이 두 자원은
// 복사·실행 커맨드가 곧 참조 지점이고 그 커맨드는 ```bash 펜스 안에 산다(실측: 스킬의 정본
// 실행 지시가 펜스 안에만 있었다). 플레이스홀더 검사가 "사용 예시가 바로 그 자리"라며 펜스를
// 포함하는 것과 같은 판단이다.
//
// **단순 지칭도 잡는다** — 실행 지시만 골라내는 것은 표기 **형태** 검사
// (BARE_SCRIPT_COMMAND)의 방침이고, 그 경계는 산문까지 명령으로 오인하지 않기 위한 것이다.
// 실재 검사는 산문이든 커맨드든 똑같이 죽은 포인터가 되므로 bin/·knowledge/ 실재 검사와
// 같이 전량 본다(두 방침은 대상이 달라 모순이 아니다).
const BUNDLED_RESOURCE_REFS = [
  {
    code: 'REF_SKILL_SCRIPT_MISSING',
    what: '스킬 번들 스크립트',
    re: /\bskills\/[a-z0-9-]+\/scripts\/[A-Za-z0-9_.-]+\.(?:mjs|cjs|js)/g,
  },
  {
    // 디렉터리 참조("templates/e2e-template/")도 대상이다 — 복사 지시의 절반이 디렉터리를 가리킨다.
    code: 'REF_TEMPLATE_MISSING',
    what: '템플릿 스캐폴드',
    re: /\btemplates\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]*)*/g,
  },
];

// 경로 앞이 다른 디렉터리면(예: "docs/templates/x") 번들 자원이 아니라 저장소 밖 얘기다.
// 선행 세그먼트로 허용하는 것은 정본 표기 둘뿐이다: `${CLAUDE_PLUGIN_ROOT}/`(읽기·실행 대상)와
// `malgn-agent/`(이 저장소 소스를 고치는 대상). 규약 정본은 Skill
// `common-output-storage-and-path-management` §1-1·§1-2.
const BUNDLED_PREFIX_OK = /(?:CLAUDE_PLUGIN_ROOT\}|malgn-agent)\/$/;

function checkBundledResourceRefs(relPath, body, pluginRoot) {
  for (const { code, what, re } of BUNDLED_RESOURCE_REFS) {
    for (const m of liveReferences(body, re, { includeFenced: true })) {
      if (/[<…{]/.test(m[0])) continue; // 형태를 설명하는 자리 표시자는 대상이 아니다
      const before = m.input.slice(0, m.index);
      if (before.endsWith('/') && !BUNDLED_PREFIX_OK.test(before)) continue;
      if (fs.existsSync(path.join(pluginRoot, m[0]))) continue;
      error(code, relPath,
        `본문이 참조하는 ${what}가 없다: ${m[0]} — 옮겼거나 이름이 바뀌었으면 참조도 함께 고친다.`);
    }
  }
}

// ── hooks/... 참조 실재 검사 ─────────────────────────────────────────
// bin/의 스크립트는 REF_BIN_MISSING이 `` `bin/x.mjs` `` 형태의 참조 실재를 잡지만, hooks/의
// 파일은 대응하는 검사가 없었다. hooks 파일을 가리키는 표기는 실행 커맨드형
// (`${CLAUDE_PLUGIN_ROOT}/hooks/x.mjs` — hooks.json의 훅 커맨드 문자열, 스크립트의 "사용:" 안내)과
// 단순 지칭형(맨 backtick, `` `hooks/x.mjs` `` — bin/과 같은 관례)이 섞여 쓰인다. 실측상 후자가
// 더 많이 쓰이므로 하나만 잡으면 실효가 없다 — 둘 다 잡는다.
const CLAUDE_PLUGIN_HOOKS_REF = /\$\{CLAUDE_PLUGIN_ROOT\}\/hooks\/([A-Za-z0-9_.\-/]+\.(?:mjs|cjs|js|md|json))/g;
const BARE_HOOKS_REF = /`(?:malgn-agent\/)?(hooks\/[a-z0-9\-./]+\.(?:mjs|cjs|js|md|json))`/g;

function checkClaudePluginRootHooksRefs(relPath, body, pluginRoot) {
  for (const m of liveReferences(body, CLAUDE_PLUGIN_HOOKS_REF, { includeFenced: true })) {
    const target = m[1];
    if (!fs.existsSync(path.join(pluginRoot, 'hooks', target))) {
      error('REF_HOOKS_MISSING', relPath, `본문이 참조하는 hooks 파일이 없다: hooks/${target}`);
    }
  }
  for (const m of liveReferences(body, BARE_HOOKS_REF)) {
    if (!fs.existsSync(path.join(pluginRoot, m[1]))) {
      error('REF_HOOKS_MISSING', relPath, `본문이 참조하는 hooks 파일이 없다: ${m[1]}`);
    }
  }
}

// ── 본문 참조 검증 (agents·skills·knowledge 공통) ──────────────────────
// 세 영역은 같은 문법으로 서로를 가리키므로 검사도 하나여야 한다.
// knowledge를 참조 "원천"으로 돌리지 않았던 동안(인벤토리로만 수집하고 본문은 읽지 않았다),
// 스킬 개명 라운드 뒤 죽은 스킬 참조 16건이 ERROR 0 초록불 아래에서 약 2주간 생존했다.
// 참조 대상이면서 동시에 참조 원천인 영역을 한쪽으로만 다룬 것이 그 구멍이었다.
function checkBodyReferences(relPath, body, ctx) {
  const { skillNames, knowledgeFiles, pluginRoot, referencedSkills } = ctx;

  // 스킬을 가리키는 표기형은 두 가지다: ``Skill `name` `` 호출형과 `skills/name/SKILL.md` 경로형.
  // 개명 라운드에서 죽은 참조가 두 형태에 섞여 남았으므로 둘 다 본다.
  // (산문 속 맨몸 이름 — 백틱도 경로도 없는 형태 — 는 이 검사가 잡지 못한다. 개명 시에는
  //  표기형이 아니라 **이름**으로 grep해 재수집하는 절차가 여전히 필요하다.)
  const SKILL_REFS = [
    /Skill\s+`([a-z0-9:\-]+)`/g,
    /\bskills\/([a-z0-9\-]+)\/SKILL\.md/g,
  ];
  for (const re of SKILL_REFS) {
    for (const m of liveReferences(body, re)) {
      const bare = m[1].includes(':') ? m[1].split(':').pop() : m[1];
      if (referencedSkills) referencedSkills.add(bare);
      if (!skillNames.has(bare)) {
        error('REF_SKILL_MISSING', relPath, `본문이 참조하는 Skill '${m[1]}'이 존재하지 않는다`);
      }
    }
  }
  for (const m of liveReferences(body, /\bknowledge\/[A-Za-z0-9_\-/]+\.md/g)) {
    const target = m[0].replace(/^.*?knowledge\//, 'knowledge/');
    if (!knowledgeFiles.has(target)) {
      error('REF_KNOWLEDGE_MISSING', relPath, `본문이 참조하는 knowledge 파일이 없다: ${target}`);
    }
  }
  // ── 플러그인 자원 참조 형태 (2026-08-24 신설) ──────────────────────
  // 파일이 실재해도 경로 형태가 틀리면 열리지 않는다. 에이전트는 대개 사용자 프로젝트를 cwd로
  // 돌기 때문에 맨 상대경로 `knowledge/...`는 그 프로젝트 안에서 찾다가 실패한다(실측: 서브
  // 에이전트가 본문에 적힌 그대로 Read 해 `File does not exist`로 끝났다). "이 플러그인의
  // knowledge/..."처럼 산문으로 위치를 가리켜도 결과는 같다 — Read 도구에 산문은 경로가 아니다.
  // 그래서 부재(REF_KNOWLEDGE_MISSING)와 별개로 **형태**를 따로 본다: 부재 검사만으로는
  // "파일은 있는데 못 여는" 이 결함이 초록불을 그대로 통과한다(109건이 그렇게 살아 있었다).
  // knowledge 본문 자신은 제외한다 — 그 파일에서는 이 변수가 영원히 치환되지 않는다(§1-1).
  //
  // 이 **형태** 검사만은 산문에만 건다(부재 검사와 달리 대상 범위가 좁다). 기준은 확장자가
  // 아니라 "누가 이 문자열을 해소하는가"다:
  //   · 산문(agents·skills 본문, hooks/*.md) → **읽는 이**가 적힌 그대로 Read 한다. 맨
  //     상대경로면 cwd(사용자 프로젝트)에서 찾다가 실패한다 → 검사 대상.
  //   · 스크립트 소스(bin/·hooks/의 .mjs·.cjs) → **코드**가 자기 루트와 path.join으로 해소한다.
  //     거기 적힌 'knowledge/x.md'는 맨 상대경로인 것이 정상이라 오탐이 된다 → 제외.
  // hooks/*.md를 넣는 근거: pm-orchestration-block.md는 루트 CLAUDE.md의 관리 구역(managed
  // region)에 인라인되는 상시 주입물이라, 세션(cwd=사용자 프로젝트)이 읽는다는 점에서 agents
  // 본문과 조건이 똑같다.
  if (/(^|\/)(?:agents|skills)\//.test(relPath) || /(^|\/)hooks\/.*\.md$/.test(relPath)) {
    const FORM = /(?<!\$\{CLAUDE_PLUGIN_ROOT\}\/)(?<!malgn-agent\/)\bknowledge\/[A-Za-z0-9_-]+\/[^\s`)*|]*/g;
    for (const m of liveReferences(body, FORM)) {
      if (/[<…{]/.test(m[0])) continue; // 형태를 설명하는 자리 표시자는 대상이 아니다
      error('REF_KNOWLEDGE_UNREACHABLE', relPath,
        `knowledge 참조 '${m[0]}'가 맨 상대경로다 — 에이전트 cwd(사용자 프로젝트) 기준으로 해석돼 열리지 않는다. ` +
        '읽기 대상이면 `${CLAUDE_PLUGIN_ROOT}/knowledge/…`, malgn-agent 소스 clone을 고치는 대상이면 ' +
        '`malgn-agent/knowledge/…`로 적는다 (규약 정본: Skill `common-output-storage-and-path-management` §1-2).');
    }
  }
  // agents/ 참조는 knowledge/와 달리 두 형태를 다르게 다룬다. 맨 상대경로 `` `agents/x.md` ``는
  // "정본이 어디인지 알려주는 산문 인용"으로 이 저장소에서 계속 허용한다(스킬이 다른 에이전트의
  // 역할 경계를 실행 시점에 실제로 열어볼 필요 없이 인용만 하는 사례가 다수다) — 그래서 존재
  // 확인(REF_AGENT_MISSING)만 하고 knowledge식 "형태가 틀려서 못 연다" 에러는 걸지 않는다.
  // 반대로 `` `${CLAUDE_PLUGIN_ROOT}/agents/x.md` ``는 읽는 이가 그대로 Read하는 실제 참조이므로
  // 같은 존재 확인을 별도로 건다.
  for (const m of liveReferences(body, /`\$\{CLAUDE_PLUGIN_ROOT\}\/agents\/([a-z0-9\-]+\.md)`/g)) {
    if (!fs.existsSync(path.join(pluginRoot, 'agents', m[1]))) {
      error('REF_AGENT_MISSING', relPath, `본문이 참조하는 agent 파일이 없다: agents/${m[1]}`);
    }
  }
  for (const m of liveReferences(body, /`(agents\/[a-z0-9\-]+\.md)`/g)) {
    if (!fs.existsSync(path.join(pluginRoot, m[1]))) {
      error('REF_AGENT_MISSING', relPath, `본문이 참조하는 agent 파일이 없다: ${m[1]}`);
    }
  }
  for (const m of liveReferences(body, /`(?:malgn-agent\/)?(bin\/[a-z0-9\-.]+\.(?:mjs|cjs|js))`/g)) {
    if (!fs.existsSync(path.join(pluginRoot, m[1]))) {
      error('REF_BIN_MISSING', relPath, `본문이 참조하는 스크립트가 없다: ${m[1]}`);
    }
  }
  // `${CLAUDE_PLUGIN_ROOT}/hooks/...` 형태로 가리키는 hooks 파일의 실재를 확인한다(위 REF_BIN_MISSING과
  // 대응하는 검사가 hooks/에는 없었다).
  checkClaudePluginRootHooksRefs(relPath, body, pluginRoot);
  // bin/ 밖의 번들 자원(스킬 자기 scripts/·templates/)도 같은 규약으로 실재를 확인한다.
  checkBundledResourceRefs(relPath, body, pluginRoot);
}

// ── 조회 불가 식별자 검사 ────────────────────────────────────────────
// CLAUDE.md 항구 규칙: 제품 본문에 식별자를 근거로 달지 않는다. 설치 직원은 이 저장소의
// lesson/decision id도, hub ULID도, 커밋 해시도 열어볼 수 없다 — 근거 구실을 못 하는 각주다.
// 2026-08-22에 제품 전량 227건을 제거해 0건으로 만들었고, 이 검사는 그 0을 지키는 게이트다.
// (게이트 없이 지운 것은 다시 들어온다 — 224건이 실제로 그렇게 쌓였다.)
//
// **형태가 아니라 "인용으로 쓰였는가"를 잡는다.** 맨몸 8-hex를 전부 잡으면 날짜(20250210)·
// 상수(86400000)가 같이 걸려 오탐이 실탐을 덮고, 그러면 이 검사는 통째로 무시당한다.
// 아래 세 갈래로 좁힌 뒤 제거 직전 트리(224건 시점)를 양성 대조군으로 돌려 미포착 0건을 확인했다.
const ID_HEX = '[0-9a-f]{7,12}';
const ID_ULID = '01[0-9a-hjkmnp-tv-z]{24}';
const ID_CITE_KEYWORD = '(?:lesson|decision|issue|memory|commit|커밋|교훈|전례|사유서|기록)';
const ID_CITATION_PATTERNS = [
  // (A) 인용 키워드 + id — "lesson `5b55dd67`", "decision 912221a4", "커밋: `9ec5183`"
  new RegExp(`${ID_CITE_KEYWORD}s?\\s*[:#]?\\s*\`?(${ID_HEX}|${ID_ULID})\`?(?![0-9a-z])`, 'gi'),
  // (B) hub ULID는 키워드 없이 맨몸으로 나와도 조회 불가다 — 26자 base32는 오탐 여지가 사실상 없다
  new RegExp(`\\b(${ID_ULID})\\b`, 'g'),
  // (C) 백틱에 싸인 hex — "lesson `a`/`b`" 연쇄의 뒷항처럼 키워드가 앞에 없는 형태를 잡는다
  new RegExp('`(' + ID_HEX + ')`', 'g'),
];
// 독자가 "자기 프로젝트의 값"을 채워 넣도록 둔 템플릿 예시값은 조회 불가 인용이 아니다.
// (예: learning-loop 체크리스트의 `#123`(PR)과 나란히 있는 커밋 자리 표시자)
const ID_PLACEHOLDERS = new Set([
  'abc1234', 'abcd123', 'abc12345', 'a1b2c3d4', 'deadbeef', 'cafebabe', '1234567', '0123456',
]);

function checkUnresolvableIds(relPath, body) {
  // liveReferences를 쓰지 않는다 — "구 X는 폐기됨(lesson `…`)" 같은 이력 서술에도 id는 못 붙인다.
  // 날짜·경위·사유는 남기되 id만 뺀다는 것이 규칙이다.
  const seen = new Set();
  for (const line of stripFencedCode(body).split(/\r?\n/)) {
    for (const re of ID_CITATION_PATTERNS) {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) {
        const id = (m[1] || m[0]).toLowerCase();
        if (ID_PLACEHOLDERS.has(id) || seen.has(id)) continue;
        seen.add(id);
        error('UNRESOLVABLE_ID', relPath,
          `조회 불가 식별자 '${id}'를 근거로 인용한다 — 설치 직원은 열어볼 수 없다. ` +
          '교훈의 실질을 문장으로 쓰고 id만 뺀다(날짜·경위·사유는 남긴다). ' +
          '독자가 채워 넣는 템플릿 예시값이라면 ID_PLACEHOLDERS에 등록한다.');
      }
    }
  }
}

// ── 번들 스크립트 도달 경로 (2026-08-23 신설) ────────────────────────
// 번들 `bin/` 스크립트를 실행하라는 지시는 정본이 하나뿐이다:
//   node ${CLAUDE_PLUGIN_ROOT}/bin/<스크립트>.mjs
// 이 변수는 **스킬·에이전트 본문이 모델에 도달하기 전에** 플러그인 절대경로로 치환된다(실측 확인).
// 셸은 이 변수를 모른다 — Bash 툴 세션에서는 빈 문자열이므로 직접 타이핑하면 MODULE_NOT_FOUND다.
// 규약 전문은 skills/common-output-storage-and-path-management/SKILL.md §1-1이 정본이다.
//
// 여기서 잡는 두 가지 파손 형태:
//  (A) 추측형 플레이스홀더 — `<malgn-agent 플러그인 경로>` 류. 에이전트가 절대경로를 스스로
//      지어내야 하는데 그 방법을 알려주는 서술이 제품 어디에도 없었다(31곳 실재했다).
//  (B) 맨 명령어 실행 지시 — `capture.mjs --responsive` 류. 플러그인 bin/ 이 PATH에 등재되긴
//      하지만 번들 스크립트 일부에 실행 비트가 없어 permission denied 로 끝난다.
//
// **단순 지칭은 잡지 않는다.** "`bin/capture.mjs`로 캡처해 확인한다" 같은 산문이나 비교표의
// 파일 이름은 명령이 아니다. 실행 지시로 판정하는 자리는 둘뿐이다:
//   - `node` 바로 뒤에 온 경우          → 복사하면 그대로 실행된다
//   - 스크립트 이름 뒤에 플래그가 붙은 경우 → 완성된 커맨드 라인이다
// 이 경계를 넓히면 산문까지 걸려 오탐이 실탐을 덮고, 그러면 이 검사는 통째로 무시당한다.
const PLUGIN_WORD = /malgn-agent|플러그인|plugin/i;
const PATH_WORD = /경로|path|dir/i;
const ANGLE_TOKEN = /<[^<>\n]{1,60}>/g;

const INVOCATION_REMEDY =
  '정본은 `node "${CLAUDE_PLUGIN_ROOT}/bin/<스크립트>.mjs"` 하나다(따옴표 포함 — 공백이 든 ' +
  '홈 경로에서 무따옴표는 MODULE_NOT_FOUND로 실패한다). 이 변수는 스킬 본문·에이전트 본문·훅 ' +
  '커맨드에서 플러그인 절대경로로 치환된다(셸 변수가 아니다). 규약은 Skill ' +
  '`common-output-storage-and-path-management` §1-1 참조.';

// 스크립트 소스의 '선두 헤더 주석'(shebang 다음의 첫 블록 주석)만 떼어낸다.
// 그 자리는 셸에서 읽히는 CLI 인터페이스 문서라 플러그인 루트 변수가 해소되지 않아
// 맨 명령어 검사에서 제외한다. 나머지 본문(런타임에 인쇄되는 사용법 문자열 포함)은 검사한다.
function stripLeadingHeaderComment(body) {
  const m = /^(#![^\n]*\n)?\s*\/\*[\s\S]*?\*\//.exec(body);
  return m ? body.slice(m[0].length) : body;
}

function checkBundledScriptInvocation(relPath, body, bundledScripts, bareScanBody) {
  // 플레이스홀더는 코드펜스 안에도 있다(사용 예시가 바로 그 자리다) — stripFencedCode를 쓰지 않는다.
  for (const m of body.matchAll(ANGLE_TOKEN)) {
    const inner = m[0].slice(1, -1);
    if (PLUGIN_WORD.test(inner) && PATH_WORD.test(inner)) {
      error('PLUGIN_PATH_PLACEHOLDER', relPath,
        `추측을 요구하는 플러그인 경로 플레이스홀더 '${m[0]}' — 에이전트가 절대경로를 지어낼 방법이 없다. ` +
        INVOCATION_REMEDY);
    }
  }

  // 맨 명령어 검사 범위 — 2026-08-23 재측정으로 근거를 고쳤다.
  //
  // 처음엔 스크립트 소스(bin/·hooks/)를 통째로 제외하면서 그 이유를 "오탐 43건이 실탐 8건을
  // 덮는다"고 적었다. **그 근거는 틀렸다.** 제외 구역을 실제로 훑어보니 히트는 오탐 덩어리가
  // 아니라 두 종류였다: 스크립트 헤더 주석과 printUsage()가 인쇄하는 사용법 문자열.
  // 뒤엣것은 오탐이 아니라 실탐이다 — 에이전트가 --help로 실제로 읽고 그대로 따라 하는
  // 런타임 표면이라, 문서만 고치면 영영 사각에 남는다(43이라는 수 자체도 라인당 중복
  // 매치를 센 값이었다).
  //
  // 그래서 사용법 문자열 11건을 process.argv[1] 기반으로 먼저 고치고(스크립트가 자기
  // 절대경로를 런타임에 스스로 인쇄한다), 제외 범위를 **선두 헤더 주석 하나로** 좁혔다.
  // 이제 스크립트의 런타임 출력도 검사 대상이라, 사용법 문자열에 맨 명령어가 다시 들어오면
  // 게이트가 잡는다. 재측정 결과 남는 히트는 헤더 주석 26건(중복 포함, 고유 20줄)뿐이고
  // 전부 bin/*.mjs 선두 주석이다.
  //
  // 헤더 주석을 아직 제외하는 이유: 그 자리는 셸에서 읽히는 CLI 인터페이스 문서라
  // ${CLAUDE_PLUGIN_ROOT}가 해소되지 않는다. 지금 켜면 ERROR 20건이 한꺼번에 떠서
  // 게이트가 통째로 무시당한다. 헤더 12개 표기 통일은 별도 백로그 항목이다.
  if (!bareScanBody) return;
  body = bareScanBody;

  for (const name of bundledScripts) {
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // (B-1) `node` 바로 뒤 — 경로 없이(또는 설치 시점에 해소되지 않는 repo 상대경로로) 호출
    const afterNode = new RegExp('\\bnode\\s+`?(?:\\./)?(?:bin/|malgn-agent/bin/)?' + esc + '\\b', 'g');
    for (const m of body.matchAll(afterNode)) {
      if (/CLAUDE_PLUGIN_ROOT/.test(m[0])) continue;
      error('BARE_SCRIPT_COMMAND', relPath,
        `번들 스크립트를 경로 없이 실행하라고 지시한다: '${m[0].trim()}'. ` + INVOCATION_REMEDY);
    }
    // (B-2) 스크립트 이름 + 플래그 — 완성된 커맨드 라인인데 앞에 정본 경로가 없다
    const withFlag = new RegExp('(\\S*)' + esc + '(\\s+-{1,2}[A-Za-z])', 'g');
    for (const m of body.matchAll(withFlag)) {
      const prefix = m[1] || '';
      if (prefix.includes('CLAUDE_PLUGIN_ROOT')) continue;
      error('BARE_SCRIPT_COMMAND', relPath,
        `번들 스크립트 커맨드에 정본 경로가 없다: '${(prefix + name + m[2]).trim()}'. ` + INVOCATION_REMEDY);
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

// ── 도구 도달성 검사 ─────────────────────────────────────────────────
// 같은 사고가 두 번 났다: ① `Skill`이 12개 에이전트의 tools에서 빠져 스킬 참조 55건이 죽어
// 있었다 ② 그걸 고치는 라운드가 `AskUserQuestion`을 21종 전부에서 빠뜨려 사람 승인 게이트를
// 통째로 실행 불가로 만들었다. **두 번 다 이 린터는 ERROR 0 초록불이었다** — tools는 타입만
// 검사받고 "본문이 시키는 도구가 그 목록에 있는가"는 아무도 안 봤다.
//
// 유효 도구 이름 목록. 출처는 Claude Code가 서브에이전트 frontmatter `tools`에서 받는 이름들이다
// (세션의 도구 목록 · code.claude.com/docs/en/sub-agents). **버전에 따라 늘어난다.**
// 갱신 방법: 새 도구가 생기면 여기 추가한다. 모르는 이름을 ERROR로 단정하지 않는 이유가 이것이다 —
// 목록이 뒤처지면 멀쩡한 신규 도구가 결함으로 보고되므로, 미상은 WARN으로만 알린다.
const KNOWN_TOOLS = new Set([
  'Agent', 'Task', 'Bash', 'BashOutput', 'KillShell', 'Read', 'Edit', 'Write', 'NotebookEdit',
  'Glob', 'Grep', 'WebFetch', 'WebSearch', 'TodoWrite', 'AskUserQuestion', 'Skill', 'ToolSearch',
  'SlashCommand', 'ExitPlanMode', 'Artifact', 'Monitor', 'SendMessage', 'TaskStop',
  'EnterWorktree', 'ExitWorktree', 'ListMcpResources', 'ReadMcpResource',
]);

// 평범한 낱말과 겹치는 도구 이름. 실측된 오탐이 전부 여기서 나왔다 — 제목 `# Architect Agent`,
// `Agent MD 대상`, 영문구 "No Claim Without Artifact", 사용량 집계 설명의 `Task`.
// 이 이름들은 조사 조건을 통과해도 WARN까지만 올린다.
// 나머지(AskUserQuestion·TodoWrite·WebFetch…)는 합성 식별자라 산문에 우연히 나올 수 없으므로
// ERROR로 올린다. **이 구분이 필요한 이유**: CI는 check-assets를 --strict 없이 돌려 WARN이
// 종료 코드에 영향을 주지 않는다. 승인 게이트가 통째로 실행 불가가 된 사고를 WARN으로만 알리면
// 초록불이 그대로라 같은 사고가 또 배포된다.
const AMBIGUOUS_TOOL_WORDS = new Set([
  'Agent', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Skill', 'Artifact', 'Monitor',
]);

// 도구격 조사("…으로/로 한다", "… 도구를 사용")가 붙은 것만 지시로 본다. 위 오탐 넷은
// 모두 뒤에 조사가 없어 이 한 조건에서 걸러진다.
const TOOL_PARTICLE = '(?:으로|로|를\\s*(?:사용|활용|호출)|을\\s*(?:사용|활용|호출)|\\s*도구)';
// `Read/ls/Glob으로`처럼 사슬 끝에만 조사가 붙는 형태가 흔하므로 사슬 전체를 한 덩어리로 받는다.
const TOOL_TOKEN = '(?:`?[A-Za-z][A-Za-z]+`?)';
const TOOL_CHAIN = new RegExp('((?:' + TOOL_TOKEN + '\\s*[/,·]\\s*)*' + TOOL_TOKEN + ')' + TOOL_PARTICLE, 'g');

// 제3자 주어 필터. "**PM이** `AskUserQuestion`으로 승인받는다"는 그 에이전트에 대한 지시가
// 아니다 — 실측상 reviewer·marketer·devops·frontend-dev 본문의 언급이 전부 이 형태다.
// 도구 언급 **앞** 45자 안에 자기 아닌 주체의 주격("X이/가")이 있으면 그 문장의 행위자는 남이다.
function toolMentionIsThirdParty(line, idx, selfName, subjects) {
  const before = line.slice(Math.max(0, idx - 45), idx);
  for (const s of subjects) {
    if (s.toLowerCase() === selfName.toLowerCase()) continue;
    if (new RegExp('(?:^|[^A-Za-z가-힣])' + s + '(?:이|가)(?![A-Za-z가-힣])').test(before)) return s;
  }
  return null;
}

function checkToolReachability(relPath, selfName, data, body, subjects) {
  // tools 키가 없으면 "전체 도구 허용"이므로 도달 불가가 성립하지 않는다.
  if (typeof data.tools !== 'string' && !Array.isArray(data.tools)) return;
  const listed = (Array.isArray(data.tools) ? data.tools : data.tools.split(','))
    .map((s) => String(s).trim()).filter(Boolean);
  // 전체 허용 와일드카드가 있으면 도달 불가가 성립하지 않는다 — 이 가드가 없으면 모든 지시가
  // 도달 불가로 뜬다.
  if (listed.includes('*')) return;
  const allowed = new Set(listed);

  // (C) 오타 검사. mcp 도구는 원격 서버 소유라 여기서 실재를 알 수 없으므로 형태만 본다.
  for (const t of listed) {
    if (t.startsWith('mcp__') || t === '*') continue;
    if (!KNOWN_TOOLS.has(t)) {
      warn('AGENT_TOOL_UNKNOWN', relPath,
        `tools의 '${t}'가 알려진 도구 이름이 아니다 — 오타면 그 지시는 조용히 실행 불가가 된다. ` +
        '이름이 맞는데 이 WARN이 뜨면 신규 도구라는 뜻이니 이 스크립트의 KNOWN_TOOLS에 추가한다.');
    }
  }

  const lines = stripFencedCode(body).split(/\r?\n/);
  const reported = new Set();
  const flag = (tool, line, code, why) => {
    if (allowed.has(tool) || reported.has(tool + code)) return;
    reported.add(tool + code);
    const level = AMBIGUOUS_TOOL_WORDS.has(tool) && code !== 'AGENT_TOOL_SKILL_UNREACHABLE'
      ? warn : error;
    level(code, relPath,
      `본문이 '${tool}'을(를) ${why} tools 허용목록에 없다 — 그 지시는 실행 불가다. ` +
      `tools에 '${tool}'을 추가하거나, 그 지시를 본문에서 뺀다. (예: ${line.trim().slice(0, 90)})`);
  };

  for (const line of lines) {
    // (A) ``Skill `name` `` 참조형 → Skill 도구 필요. 정밀도가 가장 높아 ERROR로 올린다.
    //     주어 필터를 **걸지 않는다**: "PM이 위임 시 명시한 등급(참조: Skill `x`)"처럼 문장
    //     주어가 남이어도, 그 포인터를 여는 것은 이 본문을 읽는 에이전트 자신이다.
    const skillRef = /Skill\s+`[a-z0-9:-]+`/.exec(line);
    if (skillRef) flag('Skill', line, 'AGENT_TOOL_SKILL_UNREACHABLE', '호출하라고 지시하는데');

    // (B) 도구격 조사가 붙은 지시. 조사 휴리스틱이라 WARN으로 둔다.
    for (const m of line.matchAll(TOOL_CHAIN)) {
      for (const rawTok of m[1].split(/[/,·]/)) {
        const tool = rawTok.trim().replace(/`/g, '');
        if (!KNOWN_TOOLS.has(tool) || allowed.has(tool)) continue;
        if (toolMentionIsThirdParty(line, m.index, selfName, subjects)) continue;
        flag(tool, line, 'AGENT_TOOL_UNREACHABLE', '쓰라고 지시하는데');
      }
    }
  }

  // (A-2) frontmatter skills preload도 Skill 도구를 전제한다.
  if (Array.isArray(data.skills) && data.skills.length > 0 && !allowed.has('Skill')) {
    error('AGENT_TOOL_SKILL_UNREACHABLE', relPath,
      `skills preload가 ${data.skills.length}건인데 tools에 'Skill'이 없다 — preload된 Skill을 호출할 수 없다.`);
  }
}

// ── 이름 없이 서술로만 지시된 기동 ───────────────────────────────────
// 위 AGENT_TOOL_UNREACHABLE은 **도구 이름**을 앵커로 쓴다. 그래서 도구가 이름 없이 행위
// 서술로만 지시되는 자리를 통째로 못 본다. 이번 라운드에 그 유형이 세 곳 났고 전부 사람이
// 눈으로 찾았다 — "visual-designer를 호출해", "요청은 evaluator를 호출한다",
// "실제 서브에이전트 위임으로 재현". 셋 다 Agent 도구가 필요한데 그 에이전트엔 없었다.
// 누락 검사는 "무엇이 적혀 있나"가 아니라 "이 문장을 실행하려면 어떤 도구가 필요한가"로
// 물어야 한다.
//
// **WARN으로 둔다.** 의미 판정이라 오탐이 나올 수밖에 없고, 이 규칙의 값은 사람이
// check-assets를 돌릴 때 눈에 띄는 것이지 CI 차단이 아니다.
const SPAWN_GENERIC = ['하위 에이전트', '서브에이전트', '서브 에이전트', '전문 에이전트', '페르소나', '팀원', '풀패널', '풀 패널'];
const SPAWN_VERB = '(?:호출|소집|소환|투입|위임|기동|불러|띄우|spawn|invoke|subagent_type)';
// 억제 ① 금지문("재위임하지 않고", "직접 호출하지 않습니다") — 기동하지 말라는 문장이다.
const SPAWN_NEG = /(?:않고|않는다|않습니다|않으며|않은|말고|말라|금지|못한다|못하고|없이|불가|아니라|대신)/;
// 억제 ② 주어가 PM("evaluator 호출은 PM이 한다") — 그 에이전트에 대한 지시가 아니다.
const SPAWN_PM_SUBJ = /(?:^|[^A-Za-z가-힣])(?:PM|pm)(?:이|가|은|는|에게|에|의)(?![A-Za-z가-힣])/;
// 억제 ③ 기동이 아닌 것 — 보고·반환·라우팅.
const SPAWN_NONSPAWN = /(?:보고|돌려보|반환|넘긴|넘겨|이관|회신|전달|라우팅|요청한다|요청합니다|요청해|요청은)/;
// 억제 ④ 명사형·"…여부 판단" — 기동이 아니라 "누가 부르는가/부를 필요가 있는가"를 논하는 자리.
const SPAWN_NOUNFORM = /(?:호출자|호출 가능|위임받|위임은|투입 여부|필요 여부|여부 판단|판단 책임|여부는)/;
// 억제 ⑤ `**호출자**:` 라벨 줄 — 이 에이전트를 **누가 부르는지** 적는 자리라 기동 지시가 아니다.
//        (실측: 정상 트리 오탐 2건이 전부 이 형태였다 — qa-engineer·writer)
const SPAWN_CALLER_LABEL = /^\s*[-*]?\s*\**호출자\**/;

function checkSpawnWithoutAgentTool(relPath, selfName, data, body, agentNames) {
  if (typeof data.tools !== 'string' && !Array.isArray(data.tools)) return;
  const listed = (Array.isArray(data.tools) ? data.tools : data.tools.split(','))
    .map((s) => String(s).trim()).filter(Boolean);
  if (listed.includes('Agent') || listed.includes('*')) return;

  // 'pm'은 기동 대상에서 뺀다 — PM은 오케스트레이터라 남이 띄우지 않고, 본문 도처의
  // `pm.md` 참조가 낱말경계로도 걸러지지 않아 오탐만 만든다.
  const targets = [...agentNames.filter((n) => n !== 'pm' && n !== selfName), ...SPAWN_GENERIC];
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = stripFencedCode(body).split(/\r?\n/);
  const reported = new Set();

  for (const line of lines) {
    if (SPAWN_CALLER_LABEL.test(line)) continue;
    for (const t of targets) {
      // 낱말 경계 — 이게 없으면 `pnpm`의 pm처럼 부분일치가 쏟아진다(실측).
      const re = new RegExp('(?:^|[^A-Za-z0-9가-힣_-])' + esc(t) + '(?![A-Za-z0-9_-])', 'g');
      let m;
      while ((m = re.exec(line)) !== null) {
        const idx = m.index + m[0].length - t.length;
        const vm = new RegExp(SPAWN_VERB).exec(line.slice(idx + t.length, idx + t.length + 25));
        if (!vm) continue;
        const vAbs = idx + t.length + vm.index;
        // 금지 표지는 30자 밖에 있는 일이 흔해 문장 단위로 본다.
        const sentStart = Math.max(0, line.lastIndexOf('.', idx), line.lastIndexOf('—', idx));
        const sentence = line.slice(sentStart, Math.min(line.length, vAbs + 60));
        if (SPAWN_NOUNFORM.test(line.slice(Math.max(0, idx - 25), vAbs + 15))) continue;
        if (SPAWN_NEG.test(sentence)) continue;
        if (SPAWN_PM_SUBJ.test(line.slice(Math.max(0, vAbs - 45), vAbs + 25))) continue;
        if (SPAWN_NONSPAWN.test(line.slice(vAbs, vAbs + 40))) continue;
        if (reported.has(t)) continue;
        reported.add(t);
        warn('AGENT_SPAWN_WITHOUT_AGENT_TOOL', relPath,
          `'${t}'을(를) 직접 기동하라는 서술("…${t} ${vm[0]}…")인데 tools에 'Agent'가 없다 — 실행 불가다. ` +
          'PM 경유로 문장을 고치거나(권장), 정말 직접 띄워야 하면 tools에 Agent를 넣는다. ' +
          `(예: ${line.trim().slice(0, 90)})`);
      }
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
  // 인벤토리(참조 "대상")와 본문(참조 "원천")을 한 번에 모은다. knowledge는 둘 다이므로
  // 한쪽으로만 다루면 knowledge → 죽은 Skill 참조가 통째로 검사망 밖에 남는다.
  const knowledgeDir = path.join(pluginRoot, 'knowledge');
  const knowledgeFiles = new Set();
  const knowledgeBodies = [];
  if (fs.existsSync(knowledgeDir)) {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.md')) {
          knowledgeFiles.add(path.relative(pluginRoot, p).replace(/\\/g, '/'));
          knowledgeBodies.push({ rel: path.relative(REPO_ROOT, p), body: fs.readFileSync(p, 'utf8') });
        }
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
  // 제3자 주어 후보: 다른 에이전트 이름 + 사람/PM 호칭. 도구 지시의 행위자를 가르는 데 쓴다.
  const AGENT_BASENAMES = agentFiles.map((f) => f.replace(/\.md$/, ''));
  const TOOL_SUBJECTS = [...AGENT_BASENAMES, 'PM', '사용자', '사람'];
  const sizes = [];
  const refCtx = { skillNames, knowledgeFiles, pluginRoot, referencedSkills };

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

    // 본문이 시키는 도구가 tools 허용목록에 있는가(역방향 검사)
    checkToolReachability(rel, base, data, body, TOOL_SUBJECTS);
    checkSpawnWithoutAgentTool(rel, base, data, body, AGENT_BASENAMES);

    // 본문 참조 검증: Skill `name` / knowledge/... 경로
    checkBodyReferences(rel, body, refCtx);
    checkCanonicalClaims(rel, body, disclaiming, skillDirNames);
    checkAnchors(rel, body, pluginRoot, skillDirNames, sectionCache);
    checkUnresolvableIds(rel, body);

    // 컨텍스트 예산 (상시 비용)
    checkContextBudget(rel, `agents/${base}.md`, bytes, META_AGENTS.has(base) ? BUDGET_META_KB : BUDGET_SPECIALIST_KB, AGENT_BUDGET_REMEDY);
    scanAbsolutePaths(rel, body);
  }

  // ── Skill 본문의 참조 검증 ────────────────────────────────────────
  for (const { rel, body } of skillFiles) {
    if (!body) continue;
    checkBodyReferences(rel, body, refCtx);
    checkCanonicalClaims(rel, body, disclaiming, skillDirNames);
    checkAnchors(rel, body, pluginRoot, skillDirNames, sectionCache);
    checkUnresolvableIds(rel, body);
  }

  // ── Knowledge 본문의 참조 검증 ────────────────────────────────────
  // knowledge는 frontmatter 규약 대상이 아니므로 형식 검사는 하지 않는다. 그러나 참조는 한다 —
  // agents·skills와 똑같은 문법으로 Skill/knowledge/agent/bin을 가리키고, 그 포인터도 똑같이 썩는다.
  for (const { rel, body } of knowledgeBodies) {
    checkBodyReferences(rel, body, refCtx);
    checkCanonicalClaims(rel, body, disclaiming, skillDirNames);
    checkAnchors(rel, body, pluginRoot, skillDirNames, sectionCache);
    checkUnresolvableIds(rel, body);
  }

  // ── bin·hooks 소스의 조회 불가 식별자 + 참조 ───────────────────────
  // 본문(.md)만 훑으면 코드 주석에 남은 id가 그대로 통과한다 — 실제로 .md 224건을 다 지운 뒤에도
  // bin/report-usage.mjs 주석에 hub ULID 2건이 살아 있었다. 검사 범위는 형태가 아니라
  // "설치 직원이 조회할 수 있는가"로 잡는다.
  //
  // 참조 검사(checkBodyReferences)도 같이 건다 — 2026-08-24까지 이 두 디렉터리는 위 식별자
  // 검사만 받고 참조는 통째로 사각이었다. 그래서 hooks/pm-orchestration-block.md에 없는 Skill을
  // 심어도 ERROR 0으로 통과했다(같은 줄을 agents/pm.md에 심으면 REF_SKILL_MISSING이 났다).
  // 하필 그 파일이 루트 CLAUDE.md 관리 구역에 인라인되는 상시 주입물이라, 참조가 썩으면 매 세션
  // 전 직원에게 물린다 — 이 트리에서 사각이 가장 비싼 자리였다.
  //
  // 대상을 .md로 좁히지 않는다. 실측하니 bin/의 스크립트가 정본 Skill을 가리키는 포인터를
  // 6줄 갖고 있었고(헤더 주석 4건 + printUsage()가 실제로 인쇄하는 런타임 문자열 2건),
  // 개명 라운드에서 똑같이 썩는 자리다. 런타임 출력이 검사 대상이라는 것은 맨 명령어 검사가
  // 이미 세운 판단이다(§checkBundledScriptInvocation).
  // .json은 뺀다 — 기계 설정이라 참조 문법이 살지 않는다(실측: hooks.json 0건).
  //
  // 도입 시 실측: 새 ERROR 0건(오탐도 실탐도 없음), 기준선 ERROR 0 · WARN 18 유지.
  for (const sub of ['bin', 'hooks']) {
    const dir = path.join(pluginRoot, sub);
    if (!fs.existsSync(dir)) continue;
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (!/\.(mjs|cjs|js|md|json)$/.test(e.name)) continue;
        const rel = path.relative(REPO_ROOT, p);
        const raw = fs.readFileSync(p, 'utf8');
        checkUnresolvableIds(rel, raw);
        if (/\.(mjs|cjs|js|md)$/.test(e.name)) {
          checkBodyReferences(rel, raw, refCtx);
        } else {
          // .json(hooks.json)은 checkBodyReferences 대상 밖이다(기계 설정이라 대부분의 참조
          // 문법이 살지 않는다) — 그러나 hooks.json의 훅 커맨드 문자열은 실제로
          // `${CLAUDE_PLUGIN_ROOT}/hooks/...`로 훅 파일을 가리키므로 그 실재 확인만은 여기서 건다.
          checkClaudePluginRootHooksRefs(rel, raw, pluginRoot);
        }
      }
    };
    walk(dir);
  }

  // ── PM 행동규율 블록 본문 안전 게이트 (권고, 저장소 CI 단계) ───────────────
  // hooks/pm-orchestration-block.md 본문은 CLAUDE.md 관리 구역(managed region)에 그대로
  // 인라인된다(docs/decision/pm-orchestration-block-inline-design.md §3 "본문 인라인 전 안전
  // 게이트"). 그 게이트(renderManagedBlock())는 스캐폴딩·재동기화 실행 시점에야 던지므로,
  // trainer가 본문에 무심코 `^@` 줄이나 마커 접두 문자열을 넣어도 이 정적 검사 없이는 배포 전에
  // 드러나지 않는다. 검사 대상은 "본문"뿐이다 — 파일 자신의 버전 마커 줄(1~2행)은 그 문자열을
  // 정당하게 담고 있으므로 제외해야 한다(readBlockFile()과 동일한 방식으로 마커 줄 다음부터를
  // 본문으로 자른다).
  {
    const blockPath = path.join(pluginRoot, 'hooks', 'pm-orchestration-block.md');
    if (fs.existsSync(blockPath)) {
      const raw = fs.readFileSync(blockPath, 'utf8');
      const rel = path.relative(REPO_ROOT, blockPath);
      const versionMatch = raw.match(/<!--\s*malgn-agent:pm-orchestration:version:(\d+)\s*-->/);
      if (!versionMatch) {
        error('PM_BLOCK_NO_VERSION_MARKER', rel, '버전 마커(`<!-- malgn-agent:pm-orchestration:version:N -->`)를 찾을 수 없다 — readBlockFile()이 null을 반환해 신선도 비교가 불가능해진다.');
      } else {
        const markerLineEnd = raw.indexOf('\n', versionMatch.index);
        const body = (markerLineEnd === -1 ? '' : raw.slice(markerLineEnd + 1)).trim();
        if (/^@/m.test(body)) {
          error('PM_BLOCK_UNSAFE_BODY', rel, '본문(버전 마커 다음 줄부터)에 `@`로 시작하는 줄이 있다 — CLAUDE.md 관리 구역에 인라인되면 새 import 줄로 오인될 수 있다.');
        }
        if (body.includes('malgn-agent:pm-orchestration:')) {
          error('PM_BLOCK_UNSAFE_BODY', rel, '본문에 "malgn-agent:pm-orchestration:" 문자열이 있다 — 관리 구역 시작/종료 마커와 충돌해 구역 경계가 잘못 잡힐 수 있다.');
        }
      }
    }
  }

  // ── 번들 스크립트 도달 경로 (제품 전 트리) ────────────────────────
  // 순회 범위를 .md로 좁히지 않는다 — 플레이스홀더 31건 중 5건이 .mjs 헤더 주석에 있었고,
  // 코드 주석도 에이전트가 Read로 열어 그대로 따라 하는 문안이다.
  // 검사 대상 스크립트 이름은 실제 파일에서 뽑는다(하드코딩하면 새 스크립트가 검사망 밖에 남는다).
  const bundledScripts = new Set();
  {
    const collect = (d) => {
      if (!fs.existsSync(d)) return;
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) { collect(p); continue; }
        if (/\.(mjs|cjs|js)$/.test(e.name)) bundledScripts.add(e.name);
      }
    };
    collect(path.join(pluginRoot, 'bin'));
    for (const dir of skillDirNames) collect(path.join(skillsDir, dir, 'scripts'));
  }

  {
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name === '.git') continue;
          walk(p);
          continue;
        }
        if (!/\.(md|mjs|cjs|js)$/.test(e.name)) continue;
        const raw = fs.readFileSync(p, 'utf8');
        // 맨 명령어 검사 대상 본문:
        //  - .md(에이전트가 읽고 그대로 따라 하는 문서) → 전문
        //  - 스크립트 소스 → 선두 헤더 주석만 떼고 나머지 전부(= printUsage() 등 런타임 출력 포함)
        const bareScanBody = /\.md$/.test(e.name) ? raw : stripLeadingHeaderComment(raw);
        checkBundledScriptInvocation(
          path.relative(REPO_ROOT, p), raw, bundledScripts, bareScanBody);
      }
    };
    walk(pluginRoot);
  }

  // orphan Skill: 어떤 agent/skill/knowledge도(frontmatter/본문 어디서도) 참조하지 않는 Skill.
  // knowledge 본문도 건초더미에 넣는다 — knowledge에서만 불리는 Skill은 고아가 아니라
  // knowledge를 읽는 에이전트의 실제 진입 경로다.
  // 슬래시 커맨드로 직접 쓰는 Skill도 있으므로 WARN.
  const allAgentBodies = agentFiles.map((f) => fs.readFileSync(path.join(agentsDir, f), 'utf8')).join('\n');
  const allSkillBodies = skillFiles.map((s) => s.body).join('\n');
  const allKnowledgeBodies = knowledgeBodies.map((k) => k.body).join('\n');
  const haystack = allAgentBodies + allSkillBodies + allKnowledgeBodies;
  for (const dir of skillDirNames) {
    if (referencedSkills.has(dir)) continue;
    if (haystack.includes(dir)) continue;
    warn('SKILL_ORPHAN', `${opts.plugin}/skills/${dir}/SKILL.md`, '어떤 Agent/Skill/Knowledge도 이 Skill을 참조하지 않는다 (사용자 직접 호출 전용이면 무시)');
  }

  // ── 문서 개수 표기 ↔ 실물 대조 ────────────────────────────────────
  // 설치자가 읽는 문서(README·plugin.json·marketplace.json)의 "N종" 표기가 실물과
  // 어긋나는 드리프트를 잡는다. 자산을 통폐합해 놓고 문서를 못 따라가게 두면 설치자가
  // 읽는 첫 문장이 틀린 채로 배포된다 — 실제로 보안 스킬 4종 → 3종 통폐합 후 문서가
  // 38종에 머물러 릴리스 직전 리뷰에서야 잡힌 적이 있다.
  //
  // knowledge 기준치에 주의: 이 검사기의 인벤토리(knowledgeFiles)는 진입점
  // knowledge/README.md까지 포함한 .md 전수이지만, 문서가 세는 "참고자료 N종"은 그
  // 진입점을 뺀 수다. 세는 규칙을 코드에 못박아 두는 것이 이 검사의 핵심이다 —
  // 규칙이 어디에도 없으면 다음 사람이 55로 "고치는" 역방향 드리프트가 난다.
  const COUNT_CLAIMS = [
    { re: /에이전트\s*(\d+)\s*종/g, actual: agentFiles.length },
    { re: /스킬\s*(\d+)\s*종/g, actual: skillDirNames.length },
    {
      re: /(?:참고자료|knowledge)[^\d\n]{0,12}?(\d+)\s*종/g,
      actual: [...knowledgeFiles].filter((k) => k !== 'knowledge/README.md').length,
    },
  ];

  // CHANGELOG는 대상이 아니다 — 과거 릴리스 시점의 수를 적는 것이 정상이다.
  for (const docRel of [
    path.join(opts.plugin, 'README.md'),
    path.join(opts.plugin, '.claude-plugin', 'plugin.json'),
    path.join('.claude-plugin', 'marketplace.json'),
  ]) {
    const abs = path.join(REPO_ROOT, docRel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, 'utf8');
    for (const { re, actual } of COUNT_CLAIMS) {
      re.lastIndex = 0;
      for (const m of text.matchAll(re)) {
        if (Number(m[1]) === actual) continue;
        error(
          'DOC_COUNT_DRIFT',
          docRel.replace(/\\/g, '/'),
          `"${m[0].trim()}"라고 적혀 있으나 실물은 ${actual}이다. 문서를 실물에 맞추거나, ` +
            '세는 규칙 자체가 달라졌다면 이 스크립트의 COUNT_CLAIMS 기준을 함께 고친다.');
      }
    }
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
