#!/usr/bin/env node
// PM block A/B 골든 테스트 실행기 (저장소 전용, 마켓플레이스로 배포되지 않는다).
//
// 이 비교가 답하는 질문: "v1.8.50 묶음(훅 외 파일 포함)을 현 배포본 대신 낼 것인가".
// 훅 단독 효과를 묻는 실험이 아니다(그 질문은 변형 C = A 트리 + B 훅만, 후속).
// 변형 A = 현재 배포본, 변형 B = 보류 브랜치(기본 hold/v1.8.50). 둘 다 `git archive <ref> malgn-agent`로
// 동결 복사한 트리를 --plugin-dir로 로드한다(워킹트리 직접 사용 금지).
//
// 판정 기준표(결과를 보기 전에 동결): docs/evaluation/golden-task/pm-block-ab/rubric.md
// 기존 scripts/run-golden-eval-manual.mjs는 건드리지 않고 규약만 재사용한다
// (stdin 프롬프트, stream-json 파싱, *_I_ACCEPT_COST 옵트인, --dry-run, caseSha).
//
// 사용:
//   node scripts/run-pm-block-ab.mjs --dry-run                       # 비용 0
//   PM_BLOCK_AB_I_ACCEPT_COST=1 node scripts/run-pm-block-ab.mjs --preflight   # 유료(사용자 승인 후 PM이 실행)
//   PM_BLOCK_AB_I_ACCEPT_COST=1 node scripts/run-pm-block-ab.mjs --variant both --reps 2
// 단위 검증(비용 0): node scripts/verify-pm-block-ab.mjs

import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const AB_DIR = path.join(REPO, 'docs', 'evaluation', 'golden-task', 'pm-block-ab');
const CASES_DIR = path.join(AB_DIR, 'cases');
const FIXTURE_DIR = path.join(AB_DIR, 'fixture');
const RUBRIC_PATH = path.join(AB_DIR, 'rubric.md');
// results.jsonl은 의도적으로 runs/ 밖(커밋 대상)이다: 실행 1회당 요약 1줄이라 작고 결과 재현·감사에 필요하다.
// 원본 transcript는 커다랗고 gitignore된 runs/ 아래에만 둔다. batchId 필드로 실행 묶음을 구분한다.
const RESULTS_PATH = path.join(AB_DIR, 'results.jsonl');
const RUNS_ROOT = path.join(REPO, 'docs', 'evaluation', 'golden-task', 'runs');

export const VARIANT_REFS = { A: '8008bdb', B: 'hold/v1.8.50' };
// 훅 본문 마커(변형 정체성 확인용). A: 현재 배포본 문구, B: 보류 브랜치 문구.
export const HOOK_MARKERS = { A: 'Micro(오탈자·단순조회·1줄 수정)만', B: '①읽기' };
// B 훅은 메인 세션의 직접 읽기를 "사용자 요청 1건당 한두 번"으로 제한한다. 이를 넘으면 main_read_heavy.
export const MAIN_READ_LIMIT = 2;
export const JUDGE_MIN_QUOTE = 8;

// 비용 추정용 단가(USD / 1M 토큰). kill된 실행은 total_cost_usd가 없어 stream usage로 추정한다.
// 가정값이다 - 현재 sonnet 별칭의 실제 단가로 검증되지 않았다. 정산 금액이 아니다.
export const PRICE_PER_MTOK = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };
export const JUDGE_EST_USD = 0.2; // 판정자 1회 비용 가정(미실측)

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const SOFT_READ_TOOLS = new Set(['Skill', 'ToolSearch', 'TodoWrite']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const AGENT_TOOLS = new Set(['Agent', 'Task']);

// ---------- Bash 분류기 (따옴표 인지) ----------
// 원칙: 쓰기 신호가 확인될 때만 write(결정적 행동). 읽기 확정은 read. 나머지는 unknown(기록만, 실행을 끊지 않는다).

// 따옴표 안의 | ; & < > 는 연산자가 아니다. 반환: {segs:[{tokens, redirectWrite}], subst}
export function parseShell(cmd) {
  const segs = [];
  let toks = [];
  let cur = '';
  let has = false;
  let redirectWrite = false;
  let subst = false;
  let q = null;
  const pushTok = () => { if (has) toks.push(cur); cur = ''; has = false; };
  const pushSeg = () => {
    pushTok();
    if (toks.length || redirectWrite) segs.push({ tokens: toks, redirectWrite });
    toks = [];
    redirectWrite = false;
  };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q === "'") { if (c === "'") q = null; else cur += c; continue; }
    if (q === '"') {
      if (c === '"') q = null;
      else if (c === '\\' && i + 1 < cmd.length) cur += cmd[++i];
      else if ((c === '$' && cmd[i + 1] === '(') || c === '`') { subst = true; cur += c; }
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') { q = c; has = true; continue; }
    if (c === '\\' && i + 1 < cmd.length) { cur += cmd[++i]; has = true; continue; }
    if (c === '`' || (c === '$' && cmd[i + 1] === '(')) { subst = true; cur += c; has = true; continue; }
    if (c === '\n') { pushSeg(); continue; }
    if (/\s/.test(c)) { pushTok(); continue; }
    if (c === ';') { pushSeg(); continue; }
    if (c === '|') { if (cmd[i + 1] === '|' || cmd[i + 1] === '&') i++; pushSeg(); continue; }
    if (c === '&') {
      if (cmd[i + 1] === '>') continue; // &> 는 다음 반복에서 > 로 처리
      if (cmd[i + 1] === '&') i++;
      pushSeg();
      continue;
    }
    if (c === '<') { if (cmd[i + 1] === '<') { subst = true; i++; } continue; }
    if (c === '>') {
      if (/^\d+$/.test(cur) && has) { cur = ''; has = false; } // 2>... 의 fd 번호
      let j = i;
      while (cmd[j] === '>') j++;
      if (cmd[j] === '&') { // >&2, >&- : 무해
        j++;
        while (/[\d-]/.test(cmd[j] ?? '')) j++;
        i = j - 1;
        continue;
      }
      while (cmd[j] === ' ') j++;
      const m = cmd.slice(j).match(/^(\S+)/);
      if (m && m[1] === '/dev/null') { i = j + m[1].length - 1; continue; }
      redirectWrite = true;
      i = j - 1;
      continue;
    }
    cur += c;
    has = true;
  }
  pushSeg();
  return { segs, subst };
}

export const READ_CMDS = new Set([
  'cd', 'ls', 'cat', 'head', 'tail', 'wc', 'rg', 'grep', 'egrep', 'fgrep', 'pwd', 'stat', 'file', 'tree', 'echo', 'printf',
  'sort', 'uniq', 'awk', 'jq', 'diff', 'cmp', 'cut', 'tr', 'column', 'basename', 'dirname', 'realpath', 'which', 'date',
  'true', 'false', 'test', '[', 'expr', 'env', 'du', 'df', 'nl', 'tac', 'rev', 'fold', 'md5sum', 'shasum', 'sha256sum', 'less', 'more',
]);
export const WRITE_CMDS = new Set(['rm', 'rmdir', 'mv', 'cp', 'mkdir', 'touch', 'tee', 'chmod', 'chown', 'ln', 'install', 'truncate', 'dd', 'patch', 'rsync', 'unlink']);
export const READ_GIT = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'ls-files', 'blame', 'describe', 'shortlog', 'ls-tree', 'cat-file', 'rev-list', 'grep', 'reflog', 'name-rev', 'diff-tree', 'merge-base', 'show-ref', 'for-each-ref', 'whatchanged', 'version', 'help']);
export const WRITE_GIT = new Set(['commit', 'checkout', 'switch', 'merge', 'rebase', 'reset', 'add', 'rm', 'mv', 'restore', 'cherry-pick', 'revert', 'clean', 'apply', 'push', 'pull', 'fetch', 'init', 'clone', 'am', 'format-patch', 'submodule']);
const PKG_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'pip', 'pip3', 'brew', 'apt', 'apt-get', 'gem', 'cargo']);
export const PKG_WRITE_SUBS = new Set(['install', 'i', 'add', 'remove', 'rm', 'uninstall', 'update', 'upgrade', 'ci', 'link', 'dedupe', 'init', 'create', 'unlink']);

function splitEnv(tokens) {
  const t = tokens.slice();
  while (t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0])) t.shift();
  return t;
}

// git 전역 옵션(-C x, -c k=v, --no-pager 등)을 건너뛰고 {sub, args}를 돌려준다.
export function gitInfo(tokens) {
  let i = 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '-C' || t === '-c' || t === '--git-dir' || t === '--work-tree' || t === '--namespace') { i += 2; continue; }
    if (t.startsWith('-')) { i++; continue; }
    break;
  }
  return { sub: tokens[i] ?? null, args: tokens.slice(i + 1) };
}

const GIT_BRANCH_READ_FLAGS = /^-(a|r|v|vv|l|-list|-show-current|-all|-remotes|-contains|-merged|-no-merged)$/;

function classifySegment(seg) {
  if (seg.redirectWrite) return 'write';
  const t = splitEnv(seg.tokens);
  if (!t.length) return 'read';
  const head = t[0].replace(/^.*\//, '');
  if (head === 'time' || head === 'command' || head === 'nohup') return classifySegment({ tokens: t.slice(1), redirectWrite: false });
  if (WRITE_CMDS.has(head)) return 'write';
  if (head === 'sed' || head === 'perl') return t.some((x) => /^-[a-zA-Z]*i/.test(x) || x === '--in-place') ? 'write' : head === 'sed' ? 'read' : 'unknown';
  if (head === 'awk' && t.some((x) => x === 'inplace')) return 'write';
  if (head === 'find') {
    if (t.includes('-delete')) return 'write';
    if (t.some((x) => ['-exec', '-execdir', '-ok', '-okdir'].includes(x))) return 'unknown';
    return 'read';
  }
  if (head === 'git') {
    const { sub, args } = gitInfo(t);
    if (!sub) return 'read';
    if (READ_GIT.has(sub)) return 'read';
    if (sub === 'branch') return args.every((a) => GIT_BRANCH_READ_FLAGS.test(a)) || args.some((a) => a === '-l' || a === '--list') ? 'read' : 'write';
    if (sub === 'tag') return args.length === 0 || args.includes('-l') || args.includes('--list') ? 'read' : 'write';
    if (sub === 'stash') return ['list', 'show'].includes(args[0]) ? 'read' : 'write';
    if (sub === 'remote') return args.length === 0 || args.every((a) => a === '-v' || a === 'show' || a === 'get-url') ? 'read' : 'write';
    if (sub === 'worktree') return args[0] === 'list' ? 'read' : 'write';
    if (sub === 'config') return args.some((a) => ['--get', '--get-all', '--list', '-l'].includes(a)) ? 'read' : 'unknown';
    if (WRITE_GIT.has(sub)) return 'write';
    return 'unknown';
  }
  if (PKG_MANAGERS.has(head)) {
    const sub = t.slice(1).find((x) => !x.startsWith('-'));
    return PKG_WRITE_SUBS.has(sub) ? 'write' : 'unknown'; // npm test / pnpm run ... 은 불명
  }
  if (head === 'curl') return t.some((x) => ['-o', '-O', '--output', '--remote-name'].includes(x)) ? 'write' : 'unknown';
  if (READ_CMDS.has(head)) return 'read';
  return 'unknown';
}

// 반환: {level:'read'|'write'|'unknown'}. 쓰기 신호가 하나라도 확인되면 write.
export function analyzeBash(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return { level: 'unknown', segs: [] };
  const { segs, subst } = parseShell(cmd);
  const levels = segs.map(classifySegment);
  let level = 'read';
  if (levels.includes('write')) level = 'write';
  else if (subst || levels.includes('unknown') || !segs.length) level = 'unknown';
  return { level, segs };
}

export function isReadOnlyBash(cmd) {
  return analyzeBash(cmd).level === 'read';
}

export function bashIsolationViolation(cmd, cwd) {
  if (typeof cmd !== 'string') return null;
  for (const seg of parseShell(cmd).segs) {
    const t = splitEnv(seg.tokens);
    if (!t.length) continue;
    const head = t[0].replace(/^.*\//, '');
    if (head === 'git') {
      const { sub, args } = gitInfo(t);
      if (sub === 'worktree' && args[0] === 'add') return 'git worktree add';
      if (sub === 'checkout' && args.some((a) => a === '-b' || a === '-B')) return 'git checkout -b';
      if (sub === 'switch' && args.some((a) => a === '-c' || a === '-C' || a === '--create')) return 'git switch -c';
      if (sub === 'branch') {
        const pos = args.filter((a) => !a.startsWith('-'));
        if (pos.length && !args.some((a) => a === '-l' || a === '--list')) return 'git branch <name>';
      }
    }
    if (head === 'mkdir') {
      const p = t.slice(1).find((x) => !x.startsWith('-'));
      if (p && (p.startsWith('..') || p.startsWith('~') || (path.isAbsolute(p) && cwd && !p.startsWith(cwd)))) return 'mkdir outside cwd';
    }
  }
  return null;
}

// ---------- 도구 호출 분류 ----------

export function normalizeSubagentType(t) {
  if (typeof t !== 'string' || !t.trim()) return null;
  return t.trim().replace(/^malgn-agent:/, '');
}

// tool_use 하나를 분류한다. kind: read | decisive | neutral
export function classifyToolUse(tu) {
  const name = tu?.name;
  const input = tu?.input ?? {};
  if (AGENT_TOOLS.has(name)) {
    const type = normalizeSubagentType(input.subagent_type);
    return { kind: 'decisive', action: `Agent:${type ?? '(none)'}`, tool: name, subagentType: type, rawSubagentType: input.subagent_type ?? null, isolation: input.isolation ?? null };
  }
  if (EDIT_TOOLS.has(name)) return { kind: 'decisive', action: 'main_edit', tool: name };
  if (name === 'EnterWorktree') return { kind: 'decisive', action: 'EnterWorktree', tool: name };
  if (name === 'Bash') {
    const { level } = analyzeBash(input.command);
    if (level === 'read') return { kind: 'read', action: 'read', tool: name };
    if (level === 'unknown') return { kind: 'read', action: 'read', tool: name, counted: false, unknownBash: true };
    return { kind: 'decisive', action: 'main_edit', tool: name, bash: true };
  }
  if (READ_TOOLS.has(name)) return { kind: 'read', action: 'read', tool: name };
  if (SOFT_READ_TOOLS.has(name)) return { kind: 'read', action: 'read', tool: name, counted: false };
  return { kind: 'neutral', action: 'neutral', tool: name };
}

// ---------- 스트림 분석기 ----------
// stream-json을 한 줄씩 먹는다. kill 조건 판단까지 포함한다.
export class StreamAnalyzer {
  constructor(runMode) {
    this.runMode = runMode; // kill_on_decisive | run_to_end_kill_on_violation | none
    this.init = null;
    this.hookResponses = [];
    this.mainToolUses = [];
    this.firstDecisive = null; // {classified, input}
    this.readCount = 0;
    this.readsBeforeDecisive = null;
    this.agentCount = 0;
    this.mutatingCount = 0;
    this.askUserCount = 0;
    this.neutralTools = [];
    this.unknownBash = [];
    this.skillsLoaded = [];
    this.skillsBeforeDecisive = [];
    this.usageById = new Map();
    this.result = null;
    this.mainText = [];
    this.violation = null;
    this.bashViolations = [];
    this.cwd = null;
  }

  feed(line) {
    if (!line || !line.trim()) return;
    let obj;
    try { obj = JSON.parse(line); } catch { return; }
    if (obj.type === 'system' && obj.subtype === 'init') {
      this.init = { tools: obj.tools ?? [], model: obj.model ?? null, plugins: obj.plugins ?? null, cwd: obj.cwd ?? null };
      this.cwd = obj.cwd ?? this.cwd;
    } else if (obj.type === 'system' && obj.subtype === 'hook_response') {
      const isStart = obj.hook_event === 'SessionStart' || /SessionStart/.test(String(obj.hook_name ?? ''));
      if (isStart) this.hookResponses.push(JSON.stringify(obj));
    } else if (obj.type === 'assistant') {
      const msg = obj.message ?? {};
      if (msg.id && msg.usage) {
        const prev = this.usageById.get(msg.id) ?? {};
        const u = msg.usage;
        const m = (k) => Math.max(prev[k] ?? 0, u[k] ?? 0);
        this.usageById.set(msg.id, {
          input_tokens: m('input_tokens'),
          output_tokens: m('output_tokens'),
          cache_creation_input_tokens: m('cache_creation_input_tokens'),
          cache_read_input_tokens: m('cache_read_input_tokens'),
        });
      }
      const isMain = !obj.parent_tool_use_id;
      for (const item of msg.content ?? []) {
        if (!isMain) continue;
        if (item.type === 'text' && item.text) this.mainText.push(item.text);
        if (item.type !== 'tool_use') continue;
        const tu = { name: item.name, input: item.input };
        this.mainToolUses.push(tu);
        const cls = classifyToolUse(tu);
        if (cls.kind === 'read' && cls.counted !== false) this.readCount++;
        if (cls.unknownBash) this.unknownBash.push(String(item.input?.command ?? '').slice(0, 200));
        if (cls.tool === 'Skill') {
          const s = String(item.input?.skill ?? item.input?.name ?? '?');
          this.skillsLoaded.push(s);
          if (!this.firstDecisive) this.skillsBeforeDecisive.push(s);
        }
        if (cls.kind === 'neutral') {
          this.neutralTools.push(cls.tool);
          if (cls.tool === 'AskUserQuestion') this.askUserCount++;
        }
        if (cls.kind === 'decisive') {
          if (cls.action.startsWith('Agent:')) this.agentCount++;
          if (cls.action === 'main_edit') this.mutatingCount++;
          if (cls.bash) {
            const v = bashIsolationViolation(tu.input?.command, this.cwd);
            if (v) this.bashViolations.push(v);
          }
          if (!this.firstDecisive) {
            this.firstDecisive = { classified: cls, input: item.input };
            this.readsBeforeDecisive = this.readCount;
          }
          if (this.runMode === 'run_to_end_kill_on_violation' && !this.violation) {
            if (cls.action.startsWith('Agent:') || cls.action === 'main_edit') this.violation = cls.action;
          }
        }
      }
    } else if (obj.type === 'result') {
      this.result = obj;
    }
  }

  // 지금 프로세스를 종료해야 하는가. 이유 문자열 또는 null.
  killReason() {
    if (this.runMode === 'kill_on_decisive' && this.firstDecisive) return 'decisive';
    if (this.runMode === 'run_to_end_kill_on_violation' && this.violation) return 'violation';
    return null;
  }

  get firstAction() {
    return this.firstDecisive ? this.firstDecisive.classified.action : 'no_action';
  }

  // 메인이 직접 읽은 횟수가 한도를 넘었는가(B 훅의 "한두 번" 제한 기준). 첫 결정적 행동 전/후 무관하게 전체.
  get mainReadHeavy() {
    return this.readCount > MAIN_READ_LIMIT;
  }

  get usageTotals() {
    const t = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    for (const u of this.usageById.values()) for (const k of Object.keys(t)) t[k] += u[k] ?? 0;
    return t;
  }

  get resultText() {
    return (this.result?.result ?? this.mainText.join('\n')).trim();
  }

  // 최종 텍스트가 질문으로 끝났거나 AskUserQuestion을 썼는가(확인 질문만 하고 끝난 실행 구분용).
  get askedClarification() {
    return this.askUserCount > 0 || /[?？]\s*$/.test(this.resultText);
  }
}

export function estimateCostFromUsage(t) {
  const p = PRICE_PER_MTOK;
  return (
    ((t.input_tokens ?? 0) * p.input + (t.output_tokens ?? 0) * p.output + (t.cache_creation_input_tokens ?? 0) * p.cacheWrite + (t.cache_read_input_tokens ?? 0) * p.cacheRead) / 1e6
  );
}

export function runCost(analyzer) {
  const actual = analyzer.result?.total_cost_usd;
  if (typeof actual === 'number') return { costUsd: actual, costSource: 'result.total_cost_usd' };
  return { costUsd: estimateCostFromUsage(analyzer.usageTotals), costSource: 'estimated_from_usage' };
}

// ---------- 인프라 상태 (행동 판정과 분리) ----------
// status: ok | timeout | kill_failed | budget_exceeded | error. ok가 아니면 행동 판정에서 제외(INCONCLUSIVE)하고 별도 집계.
export function classifyInfra(analyzer, proc) {
  if (proc.killedBy === 'timeout') return { status: 'timeout', detail: '타임아웃으로 종료' };
  if (proc.killEscalated) return { status: 'kill_failed', detail: 'SIGTERM으로 종료되지 않아 SIGKILL 필요' };
  if (proc.killedBy) return { status: 'ok', detail: null }; // 의도된 kill(decisive/violation)
  const r = analyzer.result;
  if (!r) return { status: 'error', detail: `result 없음 (exit ${proc.code}, signal ${proc.signal})` };
  if (r.is_error || (r.subtype && r.subtype !== 'success')) {
    return { status: /budget/i.test(String(r.subtype ?? '')) || /budget/i.test(String(r.result ?? '')) ? 'budget_exceeded' : 'error', detail: String(r.subtype ?? 'is_error') };
  }
  if (proc.code !== 0 && proc.code !== null) return { status: 'error', detail: `exit ${proc.code}` };
  return { status: 'ok', detail: null };
}

// ---------- 지시서(brief) 결정적 검사 ----------
function matchesAll(text, spec) {
  // spec: 문자열(정규식) 또는 [대안1, 대안2](OR). 전체 배열은 AND.
  return spec.map((s) => {
    const alts = Array.isArray(s) ? s : [s];
    const hit = alts.find((a) => new RegExp(a, 'i').test(text));
    return { spec: alts, passed: hit !== undefined, matched: hit ?? null };
  });
}

export function checkBrief(caseDef, briefText) {
  if (!caseDef.brief || typeof briefText !== 'string') return null;
  const checks = matchesAll(briefText, caseDef.brief.all ?? []);
  let constraint = null;
  if (caseDef.brief.constraint) {
    constraint = { name: caseDef.brief.constraint.name, passed: new RegExp(caseDef.brief.constraint.regex, 'i').test(briefText) };
  }
  const regexPass = checks.every((c) => c.passed) && (constraint ? constraint.passed : true);
  return { regexPass, checks, constraint, promptLen: briefText.length };
}

// ---------- 공통 결과 기준 (훅 규칙과 무관한 결정적 판정) ----------

export function parseColor(s) {
  if (typeof s !== 'string') return null;
  const v = s.trim().toLowerCase();
  let m = v.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  m = v.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  m = v.match(/hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/);
  if (m) {
    const h = +m[1] / 360, s2 = +m[2] / 100, l = +m[3] / 100;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return l - s2 * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
  }
  return null;
}

export function toHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

export function parseRadiusPx(v) {
  if (typeof v !== 'string') return null;
  const nums = [...v.matchAll(/([\d.]+)\s*(px|rem|em|%)?/g)];
  if (!nums.length) return null;
  return Math.max(...nums.map((n) => {
    const x = parseFloat(n[1]);
    if (n[2] === 'rem' || n[2] === 'em') return x * 16;
    if (n[2] === '%') return x * 10; // 50% 는 사실상 완전 원형
    return x;
  }));
}

function ruleBody(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(`(?:^|[}\\s,])${esc}\\s*\\{([^}]*)\\}`));
  if (!m) return null;
  const decl = {};
  for (const d of m[1].split(';')) {
    const i = d.indexOf(':');
    if (i > 0) decl[d.slice(0, i).trim().toLowerCase()] = d.slice(i + 1).trim();
  }
  return decl;
}

function stripBtnPrimaryRules(css) {
  return css.replace(/\.btn-primary[^{]*\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
}

export function parseChangedFiles(porcelainLines) {
  return porcelainLines.map((l) => l.slice(3).trim().replace(/^"|"$/g, '')).filter(Boolean);
}

// 시나리오 3 공통 기준: .btn-primary만 변경, 배경이 더 연함, border-radius 증가, 다른 파일/규칙 무변경.
export function judgeCssButton({ beforeCss, afterCss, changedFiles }) {
  const failures = [];
  const files = parseChangedFiles(changedFiles ?? []);
  const others = files.filter((f) => f !== 'public/css/app.css');
  if (others.length) failures.push('other_files_changed');
  let needsHuman = false;
  const b = ruleBody(beforeCss, '.btn-primary');
  const a = ruleBody(afterCss ?? '', '.btn-primary');
  const details = { changedFiles: files };
  if (!a) {
    failures.push('btn_primary_rule_missing');
  } else {
    const bgB = parseColor(b?.['background-color'] ?? b?.background ?? '');
    const bgA = parseColor(a['background-color'] ?? a.background ?? '');
    const rB = parseRadiusPx(b?.['border-radius']);
    const rA = parseRadiusPx(a['border-radius']);
    details.before = { bg: b?.background ?? b?.['background-color'] ?? null, radiusPx: rB };
    details.after = { bg: a.background ?? a['background-color'] ?? null, radiusPx: rA };
    if (!bgA || !bgB) {
      needsHuman = true;
      failures.push('color_unparseable');
    } else {
      const hb = toHsl(bgB), ha = toHsl(bgA);
      const lighter = ha.l >= hb.l + 0.05 || (ha.s <= hb.s - 0.15 && ha.l >= hb.l);
      details.lightness = { before: Number(hb.l.toFixed(3)), after: Number(ha.l.toFixed(3)) };
      if (!lighter) failures.push('not_lighter');
    }
    if (rA === null || rB === null || !(rA > rB)) failures.push('radius_not_increased');
  }
  if (stripBtnPrimaryRules(beforeCss) !== stripBtnPrimaryRules(afterCss ?? '')) failures.push('other_css_changed');
  return { kind: 'css-button', pass: failures.length === 0, failures, needsHuman, details };
}

// 시나리오 7 공통 기준: 답변에 세 파일이 모두 언급되고 작업 폴더 무변경.
export function judgeAnswerFiles({ text, required, changedFiles }) {
  const failures = [];
  for (const f of required) if (!String(text ?? '').includes(f)) failures.push(`missing_${f}`);
  if ((changedFiles ?? []).length) failures.push('workdir_changed');
  return { kind: 'answer-files', pass: failures.length === 0, failures, needsHuman: false, details: { required } };
}

// 시나리오 8 공통 기준: README.md의 대상 문장 1줄만 바뀌고 나머지 줄·파일은 그대로.
export function judgeReadmeLine({ before, after, changedFiles, targetLine }) {
  const failures = [];
  const files = parseChangedFiles(changedFiles ?? []);
  if (files.some((f) => f !== 'README.md')) failures.push('other_files_changed');
  const lb = before.split('\n');
  const la = (after ?? '').split('\n');
  if (lb.length !== la.length) {
    failures.push('line_count_changed');
  } else {
    const diff = lb.map((l, i) => (l === la[i] ? -1 : i)).filter((i) => i >= 0);
    if (diff.length === 0) failures.push('target_line_unchanged');
    else if (diff.length > 1 || lb[diff[0]] !== targetLine) failures.push('other_lines_changed');
  }
  return { kind: 'readme-line', pass: failures.length === 0, failures, needsHuman: false, details: { targetLine } };
}

// ---------- 판정 ----------
function pickLabel(labels, action) {
  if (labels[action]) return labels[action];
  if (action.startsWith('Agent:') && labels['Agent:*']) return labels['Agent:*'];
  return `unexpected_${action}`;
}

// 훅 규칙 준수 판정(보조 지표 또는 회귀 검사). 반환: {verdict: PASS|TOLERATED|FAIL, label, notes[]}
export function gradeRule(caseDef, variant, analyzer, ctx = {}) {
  const exp = caseDef.expect[variant] ?? caseDef.expect.all;
  const fa = analyzer.firstAction;
  const notes = [];
  const fd = analyzer.firstDecisive;

  if (caseDef.hard) {
    const bad = analyzer.agentCount > caseDef.hard.maxAgent || analyzer.mutatingCount > caseDef.hard.maxMutating || (ctx.workdirChanged ?? []).length > 0;
    if (bad) {
      const act = analyzer.agentCount > caseDef.hard.maxAgent ? 'Agent:*' : 'main_edit';
      return { verdict: 'FAIL', label: exp.labels[act] ?? 'hard_violation', notes: [`agent=${analyzer.agentCount} mutating=${analyzer.mutatingCount} workdirChanged=${(ctx.workdirChanged ?? []).length}`] };
    }
    if (!analyzer.resultText) return { verdict: 'FAIL', label: 'no_answer', notes: ['답변 텍스트 없음'] };
    return { verdict: 'PASS', label: null, notes: [`agent=0 mutating=0 reads=${analyzer.readCount}`] };
  }

  if (caseDef.isolation) {
    if (analyzer.bashViolations.length) return { verdict: 'FAIL', label: 'isolation_bypass', notes: analyzer.bashViolations };
    const tokens = [fa];
    if (fd?.classified.action.startsWith('Agent:') && fd.classified.isolation === 'worktree') tokens.push('Agent:isolation_worktree');
    if (tokens.some((t) => exp.pass.includes(t))) return { verdict: 'PASS', label: null, notes };
    return { verdict: 'FAIL', label: fa === 'no_action' ? (analyzer.askedClarification ? 'asked_clarification' : 'no_isolation_action') : pickLabel(exp.labels, fa), notes };
  }

  if (caseDef.edit && fa === 'main_edit') {
    const { file, oldContains, newContains } = caseDef.edit;
    const inp = fd.input ?? {};
    let ok = false;
    if (fd.classified.bash) {
      const cmd = String(inp.command ?? '');
      ok = cmd.includes(file) && cmd.includes(oldContains) && analyzeBash(cmd).level === 'write';
    } else {
      const target = String(inp.file_path ?? inp.notebook_path ?? '');
      const onTarget = path.basename(target) === file;
      if (inp.old_string !== undefined) ok = onTarget && String(inp.old_string).includes(oldContains) && String(inp.new_string ?? '').includes(newContains);
      else ok = onTarget; // Write(전체 덮어쓰기)는 대상 파일이면 통과로 보고 기록
      if (!onTarget) notes.push(`대상 파일 불일치: ${target}`);
    }
    if (!ok) return { verdict: 'FAIL', label: 'wrong_file', notes };
  }

  if (exp.readLimit !== undefined && fa === 'no_action' && analyzer.readCount > exp.readLimit) {
    return { verdict: 'FAIL', label: 'main_read_heavy', notes: [`직접 읽기 ${analyzer.readCount}회 > 한도 ${exp.readLimit}`] };
  }
  if (exp.pass.includes(fa)) return { verdict: 'PASS', label: null, notes };
  if (exp.tolerated?.includes(fa)) return { verdict: 'TOLERATED', label: 'tolerated_over_delegation', notes };
  if (fa === 'no_action') return { verdict: 'FAIL', label: analyzer.askedClarification ? 'asked_clarification' : 'no_action', notes };
  return { verdict: 'FAIL', label: pickLabel(exp.labels, fa), notes };
}

// 최종 판정. 인프라 실패는 INCONCLUSIVE로 빼고, verdictBasis가 outcome인 시나리오는 공통 결과 기준이 판정이다.
export function gradeRun(caseDef, variant, analyzer, ctx = {}) {
  if (ctx.infra && ctx.infra.status !== 'ok') {
    return { verdict: 'INCONCLUSIVE', label: ctx.infra.status, notes: [ctx.infra.detail].filter(Boolean), ruleAdherence: null };
  }
  const rule = gradeRule(caseDef, variant, analyzer, ctx);
  if (caseDef.verdictBasis === 'outcome') {
    const o = ctx.outcome;
    if (!o) return { verdict: 'INCONCLUSIVE', label: 'outcome_unavailable', notes: [], ruleAdherence: rule };
    return { verdict: o.pass ? 'PASS' : 'FAIL', label: o.pass ? null : o.failures[0], notes: o.failures, ruleAdherence: rule };
  }
  return { ...rule, ruleAdherence: null };
}

// ---------- 판정자 (지시서 품질) ----------
// 인용 검증: PASS 인용은 지시서 부분문자열(공백 정규화만 허용)이고 최소 길이 이상이어야 유효.
export function verifyQuote(brief, quote, minLen = JUDGE_MIN_QUOTE) {
  if (typeof quote !== 'string') return false;
  const q = quote.trim();
  if (q.length < minLen) return false;
  if (brief.includes(q)) return true;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return norm(brief).includes(norm(q));
}

export const JUDGE_ITEMS = ['a', 'b', 'c', 'd', 'e'];

// 판정자 JSON({items:{a:{verdict,quote|missing}}})을 검증한다. PASS는 유효 인용 필수, FAIL은 인용 불요('missing' 설명만).
export function validateJudgeOutput(parsed, brief, regexPass) {
  const items = {};
  for (const k of JUDGE_ITEMS) {
    const it = parsed?.items?.[k];
    const verdict = it && /^(PASS|FAIL)$/i.test(String(it.verdict)) ? String(it.verdict).toUpperCase() : null;
    if (verdict === 'FAIL') {
      items[k] = { verdict: 'FAIL', quote: null, quoteValid: null, missing: it.missing ?? null };
    } else if (verdict === 'PASS') {
      const quoteValid = verifyQuote(brief, it.quote);
      items[k] = { verdict: quoteValid ? 'PASS' : 'INVALID', quote: it.quote ?? null, quoteValid };
    } else {
      items[k] = { verdict: 'INVALID', quote: it?.quote ?? null, quoteValid: false };
    }
  }
  let needsHuman = false;
  if (items.a.verdict === 'INVALID' || items.c.verdict === 'INVALID') needsHuman = true; // 인용 조작·형식 불량은 사람 검토로
  else if (typeof regexPass === 'boolean') {
    const judgePass = items.a.verdict === 'PASS' && items.c.verdict === 'PASS';
    needsHuman = judgePass !== regexPass;
  }
  return { items, needsHuman };
}

export function extractJson(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

// 판정자 스트림 격리 검사: SessionStart hook_response가 1건이라도 있거나 플러그인이 로드됐으면 오염.
export function judgeContamination(analyzer) {
  const reasons = [];
  if (analyzer.hookResponses.length > 0) reasons.push(`SessionStart hook_response ${analyzer.hookResponses.length}건`);
  const pl = analyzer.init?.plugins;
  if (Array.isArray(pl) ? pl.length > 0 : pl && typeof pl === 'object' && Object.keys(pl).length > 0) reasons.push('플러그인 로드됨');
  return { contaminated: reasons.length > 0, reasons };
}

// 플러그인 경로 검사(분석기 init 기준). 형태를 모르면 'unverifiable'.
export function checkPluginPaths(init, pluginDir) {
  const pl = init?.plugins;
  if (!Array.isArray(pl)) return { status: 'unverifiable', detail: 'init.plugins 없음/형태 불명' };
  const entries = pl.map((p) => (typeof p === 'string' ? { name: p, path: p } : p));
  const mal = entries.filter((e) => /malgn-agent/.test(`${e.name ?? ''}${e.path ?? ''}`));
  if (!mal.length) return { status: 'no_malgn_agent', detail: 'malgn-agent 플러그인이 init.plugins에 없다' };
  const bad = mal.filter((e) => e.path && !String(e.path).startsWith(path.dirname(pluginDir)));
  if (bad.length) return { status: 'mismatch', detail: `동결 사본 밖 경로: ${bad.map((e) => e.path).join(', ')}` };
  return { status: 'ok', detail: null };
}

// 실행 한 건을 results.jsonl 한 줄 구조로 만든다.
export function buildResultRow({ batchId, runId, variant, refs, caseDef, caseSha, rep, model, judgeModel, analyzer, grade, brief, proc, infra, outcome, workdirChanged, transcript, startedAt, pluginCheck }) {
  const { costUsd, costSource } = runCost(analyzer);
  const fd = analyzer.firstDecisive?.classified ?? null;
  return {
    batchId,
    runId,
    startedAt,
    variant,
    ref: refs[variant].ref,
    sha: refs[variant].sha,
    caseId: caseDef.id,
    caseSha,
    rep,
    model,
    judgeModel,
    status: infra.status,
    statusDetail: infra.detail,
    firstAction: analyzer.firstAction,
    firstActionDetail: fd ? { tool: fd.tool, subagentType: fd.subagentType ?? null, rawSubagentType: fd.rawSubagentType ?? null, isolation: fd.isolation ?? null } : null,
    verdict: grade.verdict,
    label: grade.label,
    notes: grade.notes,
    ruleAdherence: grade.ruleAdherence ?? null,
    outcome: outcome ?? null,
    counts: { agent: analyzer.agentCount, mutating: analyzer.mutatingCount, read: analyzer.readCount, readsBeforeDecisive: analyzer.readsBeforeDecisive },
    mainReadHeavy: analyzer.mainReadHeavy,
    clarify: { askUserQuestionCalls: analyzer.askUserCount, endedWithQuestion: /[?？]\s*$/.test(analyzer.resultText) },
    skillsLoaded: analyzer.skillsLoaded,
    skillsBeforeDecisive: analyzer.skillsBeforeDecisive,
    neutralTools: analyzer.neutralTools,
    unknownBash: analyzer.unknownBash,
    answerMentionsDiscount: caseDef.record?.includes('answerMentions:할인') ? /할인/.test(analyzer.resultText) : null,
    brief,
    judge: null,
    needsHuman: Boolean(outcome?.needsHuman),
    killedBy: proc.killedBy,
    killLatencyMs: proc.killLatencyMs ?? null,
    killEscalated: Boolean(proc.killEscalated),
    timedOut: proc.killedBy === 'timeout',
    exitCode: proc.code,
    signal: proc.signal,
    hookSessionStartCount: analyzer.hookResponses.length,
    initHasAgent: analyzer.init ? analyzer.init.tools.some((t) => AGENT_TOOLS.has(t)) : null,
    initHasEnterWorktree: analyzer.init ? analyzer.init.tools.includes('EnterWorktree') : null,
    pluginCheck: pluginCheck ?? null,
    usage: analyzer.usageTotals,
    costUsd: Number(costUsd.toFixed(4)),
    costSource,
    durationMs: proc.wallMs,
    workdirChanged,
    transcript,
    excluded: null,
  };
}

// ---------- 입출력(비용 발생 경로 포함) ----------

// 정리 대상 임시 폴더와 실행 중 자식 프로세스. 예외·Ctrl-C에서도 남지 않게 한다.
const tmpDirs = new Set();
const activeChildren = new Set();
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.add(d);
  return d;
}
function rmTmp(d) {
  fs.rmSync(d, { recursive: true, force: true });
  tmpDirs.delete(d);
}
function installCleanup() {
  const cleanup = () => {
    for (const c of activeChildren) { try { c.kill('SIGKILL'); } catch { /* 이미 종료 */ } }
    for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 베스트에포트 */ } }
  };
  process.on('exit', cleanup);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { cleanup(); process.exit(130); });
}

function parseArgs(argv) {
  const o = {
    variant: 'both', case: null, reps: 2, dryRun: false, preflight: false, keep: false,
    judgeModel: 'fable', model: 'sonnet', totalBudgetUsd: 20, maxBudgetUsd: 1.5, judgeMaxBudgetUsd: 1, timeoutSec: 240,
    includeOptional: false, noJudge: false, refA: VARIANT_REFS.A, refB: VARIANT_REFS.B, isolateSettings: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--variant') o.variant = next();
    else if (a === '--case') o.case = next();
    else if (a === '--reps') o.reps = Number(next());
    else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--preflight') o.preflight = true;
    else if (a === '--keep') o.keep = true;
    else if (a === '--judge-model') o.judgeModel = next();
    else if (a === '--model') o.model = next();
    else if (a === '--total-budget-usd') o.totalBudgetUsd = Number(next());
    else if (a === '--max-budget-usd') o.maxBudgetUsd = Number(next());
    else if (a === '--judge-max-budget-usd') o.judgeMaxBudgetUsd = Number(next());
    else if (a === '--timeout-sec') o.timeoutSec = Number(next());
    else if (a === '--include-optional') o.includeOptional = true;
    else if (a === '--no-judge') o.noJudge = true;
    else if (a === '--no-isolate-settings') o.isolateSettings = false;
    else if (a === '--ref-a') o.refA = next();
    else if (a === '--ref-b') o.refB = next();
    else if (a === '--help' || a === '-h') {
      console.log('usage: node scripts/run-pm-block-ab.mjs [--variant A|B|both] [--case id[,id]|all] [--reps N] [--dry-run] [--preflight] ' +
        '[--judge-model m] [--model m] [--total-budget-usd N] [--max-budget-usd N] [--judge-max-budget-usd N] [--timeout-sec N] ' +
        '[--include-optional] [--no-judge] [--no-isolate-settings] [--keep]');
      process.exit(0);
    } else throw new Error(`알 수 없는 옵션: ${a}`);
  }
  if (!['A', 'B', 'both'].includes(o.variant)) throw new Error(`--variant는 A|B|both: ${o.variant}`);
  if (!Number.isFinite(o.reps) || o.reps < 1) throw new Error('--reps는 1 이상 정수');
  return o;
}

export function loadCases() {
  return fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort().map((f) => {
    const def = JSON.parse(fs.readFileSync(path.join(CASES_DIR, f), 'utf8'));
    for (const k of ['id', 'prompt', 'runMode', 'expect']) if (!def[k]) throw new Error(`${f}: ${k} 없음`);
    if (!['kill_on_decisive', 'run_to_end_kill_on_violation', 'none'].includes(def.runMode)) throw new Error(`${f}: runMode 이상`);
    if (!def.expect.all && !(def.expect.A && def.expect.B)) throw new Error(`${f}: expect.all 또는 A+B 필요`);
    if (def.verdictBasis === 'outcome' && !def.outcome?.kind) throw new Error(`${f}: verdictBasis=outcome이면 outcome.kind 필요`);
    if (def.verdictBasis === 'outcome' && def.runMode !== 'none') throw new Error(`${f}: outcome 판정 시나리오는 끝까지 실행(runMode none)이어야 한다`);
    def._file = f;
    return def;
  });
}

function walkFiles(dir) {
  const out = [];
  const w = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) w(p); else out.push(p);
    }
  };
  w(dir);
  return out;
}

function caseSha(caseDef) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(path.join(CASES_DIR, caseDef._file)));
  for (const f of walkFiles(FIXTURE_DIR)) { h.update(path.relative(FIXTURE_DIR, f)); h.update(fs.readFileSync(f)); }
  h.update(fs.readFileSync(RUBRIC_PATH));
  return h.digest('hex').slice(0, 12);
}

function git(args) {
  const r = spawnSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${r.stderr}`);
  return r.stdout.trim();
}

// 변형 트리 동결 복사. 반환: { A:{ref,sha,dir,pluginDir}, B:{...} }
export function prepareVariants(refsByVariant, tmpRoot) {
  const out = {};
  for (const [v, ref] of Object.entries(refsByVariant)) {
    const sha = git(['rev-parse', '--verify', `${ref}^{commit}`]);
    const dir = path.join(tmpRoot, `variant-${v}`);
    fs.mkdirSync(dir, { recursive: true });
    const ar = spawnSync('git', ['archive', sha, 'malgn-agent'], { cwd: REPO, maxBuffer: 512 * 1024 * 1024 });
    if (ar.status !== 0) throw new Error(`git archive ${ref} 실패: ${ar.stderr}`);
    const tar = spawnSync('tar', ['-x', '-C', dir], { input: ar.stdout });
    if (tar.status !== 0) throw new Error(`tar 해제 실패: ${tar.stderr}`);
    const pluginDir = path.join(dir, 'malgn-agent');
    const hookPath = path.join(pluginDir, 'hooks', 'pm-orchestration-block.md');
    const hook = fs.existsSync(hookPath) ? fs.readFileSync(hookPath, 'utf8') : '';
    out[v] = { ref, sha, dir, pluginDir, hookBytes: hook.length, hookMarkerOk: hook.includes(HOOK_MARKERS[v]) };
  }
  return out;
}

function makeWorkdir() {
  const dir = mkTmp('pm-block-ab-run-');
  fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
  const run = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`workdir git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  run(['init', '-q']);
  run(['add', '-A']);
  run(['-c', 'user.name=ab', '-c', 'user.email=ab@example.invalid', 'commit', '-q', '-m', 'fixture']);
  return { dir, status: () => run(['status', '--porcelain']).split('\n').filter(Boolean) };
}

// 시나리오별 공통 결과 기준 계산(작업 폴더·답변 기준). 훅 규칙과 무관하다.
function computeOutcome(caseDef, workdir, changed, analyzer) {
  const kind = caseDef.outcome?.kind;
  if (!kind) return null;
  const read = (rel) => (fs.existsSync(path.join(workdir, rel)) ? fs.readFileSync(path.join(workdir, rel), 'utf8') : '');
  const orig = (rel) => fs.readFileSync(path.join(FIXTURE_DIR, rel), 'utf8');
  if (kind === 'css-button') return judgeCssButton({ beforeCss: orig('public/css/app.css'), afterCss: read('public/css/app.css'), changedFiles: changed });
  if (kind === 'answer-files') return judgeAnswerFiles({ text: analyzer.resultText, required: caseDef.outcome.requiredFiles, changedFiles: changed });
  if (kind === 'readme-line') return judgeReadmeLine({ before: orig('README.md'), after: read('README.md'), changedFiles: changed, targetLine: caseDef.outcome.targetLine });
  throw new Error(`알 수 없는 outcome.kind: ${kind}`);
}

// claude 실행 + 증분 파싱 + 조건 충족 시 SIGTERM. kill 이후 줄은 분석기에 넣지 않는다.
export function runClaude({ promptText, model, cwd, pluginDir, maxBudgetUsd, timeoutMs, analyzer, extraArgs = [], permissionMode = null }) {
  return new Promise((resolve, reject) => {
    const args = ['--print', '--model', model, '--output-format', 'stream-json', '--verbose', '--strict-mcp-config', '--max-budget-usd', String(maxBudgetUsd)];
    if (pluginDir) args.push('--plugin-dir', pluginDir);
    if (permissionMode) args.push('--permission-mode', permissionMode);
    args.push(...extraArgs);
    const t0 = Date.now();
    const child = spawn('claude', args, { cwd, env: { ...process.env, MALGNAI_HEADLESS_WORKER: '1' } });
    activeChildren.add(child);
    let stdout = '';
    let stderr = '';
    let buf = '';
    let killedBy = null;
    let killedAt = null;
    let killEscalated = false;
    const kill = (why) => {
      if (killedBy) return;
      killedBy = why;
      killedAt = Date.now();
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) { killEscalated = true; child.kill('SIGKILL'); }
      }, 5000).unref();
    };
    const timer = setTimeout(() => kill('timeout'), timeoutMs);
    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      if (killedBy) return; // kill 이후 줄은 분석에 반영하지 않는다
      buf += s;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        analyzer.feed(line);
        const why = analyzer.killReason();
        if (why) { kill(why); buf = ''; break; }
      }
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(timer); activeChildren.delete(child); reject(e); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      activeChildren.delete(child);
      if (buf.trim() && !killedBy) analyzer.feed(buf);
      resolve({ code, signal, stdout, stderr, killedBy, killEscalated, killLatencyMs: killedAt ? Date.now() - killedAt : null, wallMs: Date.now() - t0 });
    });
    child.stdin.write(promptText);
    child.stdin.end();
  });
}

// 판정자 호출. 플러그인을 싣지 않고 도구를 끈다. user 설정 소스를 빼서 설치본 훅이 주입되지 않게 하지만,
// --setting-sources는 조직 관리(managed) 설정과 --settings는 못 뺀다(docs/anthropic/plugins/plugins-reference.md의 설정 우선순위 절).
// 그래서 호출 결과 스트림에서 SessionStart hook_response/플러그인 로드를 직접 검사해 오염이면 그 판정을 무효로 한다.
export async function judgeBrief({ request, brief, model, runsDir, maxBudgetUsd = 1 }) {
  const prompt =
    '아래는 사용자의 원래 요청과, 다른 작업자에게 넘길 작업 지시서다. 지시서만 보고 항목별로 채점하라.\n' +
    '규칙: 각 항목은 PASS 또는 FAIL 중 하나. PASS이면 근거가 된 문장을 지시서에서 **원문 그대로 8자 이상** quote에 인용하라(지시서에 없거나 너무 짧은 인용은 그 항목 판정이 무효 처리된다). ' +
    'FAIL이면 인용하지 말고 missing에 지시서에 빠져 있거나 틀린 요소를 한 문장으로 적어라.\n' +
    '항목:\n' +
    '(a) 요구사항이 사용자 요청에 나온 대로 빠짐없이 들어 있다\n' +
    '(b) 완료 판정 기준이 1줄이라도 있다\n' +
    '(c) 금지 범위·제약이 극성(하라/하지 마라)까지 맞게 들어 있다 (요청에 제약이 없다면 지시서가 제약을 지어내지 않았는가)\n' +
    '(d) 대상 경로 또는 찾는 방법이 있다\n' +
    '(e) 수신자가 이 대화를 몰라도 실행 가능하다\n\n' +
    '출력은 JSON 한 개만: {"items":{"a":{"verdict":"PASS","quote":"..."},"b":{"verdict":"FAIL","missing":"..."},"c":{...},"d":{...},"e":{...}}}\n\n' +
    `---사용자 요청---\n${request}\n---지시서 시작---\n${brief}\n---지시서 끝---\n`;
  const analyzer = new StreamAnalyzer('none');
  const cwd = mkTmp('pm-block-ab-judge-');
  const proc = await runClaude({
    promptText: prompt, model, cwd, pluginDir: null, maxBudgetUsd, timeoutMs: 180_000, analyzer,
    extraArgs: ['--tools', '', '--setting-sources', 'project', '--disable-slash-commands', '--no-session-persistence'],
  });
  rmTmp(cwd);
  const contamination = judgeContamination(analyzer);
  const parsed = extractJson(analyzer.resultText);
  const { costUsd } = runCost(analyzer);
  const randId = crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(path.join(runsDir, 'judge'), { recursive: true });
  fs.writeFileSync(path.join(runsDir, 'judge', `${randId}.json`), JSON.stringify({ input: { request, brief }, rawOutput: analyzer.resultText, contamination }, null, 2));
  return { randId, parsed, costUsd, exitCode: proc.code, contamination, initTools: analyzer.init?.tools ?? null };
}

function requireConsent() {
  if (process.env.PM_BLOCK_AB_I_ACCEPT_COST !== '1') {
    console.error(
      '이 실행은 유료다(claude --print 실제 호출). 비용은 실행한 사람의 계정에 청구된다.\n\n' +
        '실행하려면: PM_BLOCK_AB_I_ACCEPT_COST=1 node scripts/run-pm-block-ab.mjs ...\n' +
        '비용 없이 점검만: node scripts/run-pm-block-ab.mjs --dry-run',
    );
    process.exit(1);
  }
}

function selectCases(all, opts) {
  if (opts.case && opts.case !== 'all') {
    return opts.case.split(',').map((w) => {
      const c = all.find((x) => x.id === w || x.id.startsWith(w));
      if (!c) throw new Error(`케이스 없음: ${w}`);
      return c;
    });
  }
  return all.filter((c) => opts.case === 'all' || opts.includeOptional || !c.optional);
}

// A/B 교대 순서. 시간대 편향을 줄이려고 (케이스, 반복) 단위로 먼저 도는 변형을 번갈아 둔다.
export function buildPlan(cases, variants, reps) {
  const plan = [];
  let flip = 0;
  for (let rep = 1; rep <= reps; rep++) {
    for (const c of cases) {
      const order = variants.length === 2 ? (flip++ % 2 === 0 ? ['A', 'B'] : ['B', 'A']) : variants;
      for (const v of order) plan.push({ variant: v, caseDef: c, rep });
    }
  }
  return plan;
}

// 실행 전 예약 금액: 시나리오 상한 + (판정자 대상이면) 판정자 상한. 누적 + 예약이 총예산을 넘으면 시작하지 않는다.
export function reservationUsd(caseDef, opts, judgeActive) {
  const runCap = caseDef.maxBudgetUsd ?? opts.maxBudgetUsd;
  return runCap + (caseDef.brief && judgeActive ? opts.judgeMaxBudgetUsd : 0);
}

export function estimatePlanUsd(plan, judgeActive) {
  return plan.reduce((s, p) => s + (p.caseDef.estUsd ?? 0.3) + (p.caseDef.brief && judgeActive ? JUDGE_EST_USD : 0), 0);
}

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// 조건(시나리오 x 변형)별 요약. 공통 결과 기준 시나리오는 첫 행동 분포·결과 통과·시간·비용만 보이고
// 변형별 기대 통과율(ruleAdherence)은 변형 간 비교 금지라고 표시한다. 인프라 실패는 따로 센다.
export function summarize(rows, cases = []) {
  const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
  const keys = [...new Set(rows.map((r) => `${r.caseId}|${r.variant}`))].sort();
  const lines = [];
  for (const k of keys) {
    const [caseId, variant] = k.split('|');
    const all = rows.filter((r) => `${r.caseId}|${r.variant}` === k && !r.excluded);
    const ok = all.filter((r) => r.status === 'ok');
    const infra = all.filter((r) => r.status !== 'ok');
    const count = (f, rs = ok) => { const m = {}; for (const r of rs) m[f(r)] = (m[f(r)] ?? 0) + 1; return JSON.stringify(m); };
    const isOutcome = byId[caseId]?.verdictBasis === 'outcome';
    let line = `${caseId} ${variant}  n=${all.length} (유효 ${ok.length}, 인프라 실패 ${infra.length}${infra.length ? ' ' + count((r) => r.status, infra) : ''})`;
    line += `  first=${count((r) => r.firstAction)}`;
    if (isOutcome) {
      const pass = ok.filter((r) => r.outcome?.pass).length;
      line += `  결과기준 통과 ${pass}/${ok.length}  중앙 시간 ${median(ok.map((r) => r.durationMs ?? 0)) !== null ? Math.round(median(ok.map((r) => r.durationMs ?? 0)) / 1000) + 's' : '-'}`;
      line += `  되물음 ${ok.reduce((s, r) => s + r.clarify.askUserQuestionCalls + (r.clarify.endedWithQuestion ? 1 : 0), 0)}회`;
      line += `  [보조: 자기규칙 ${count((r) => r.ruleAdherence?.verdict ?? '-')} - 변형 간 비교 금지]`;
    } else {
      line += `  verdict=${count((r) => r.verdict + (r.label ? ':' + r.label : ''))}`;
    }
    line += `  cost=$${all.reduce((s, r) => s + r.costUsd, 0).toFixed(3)}`;
    lines.push(line);
  }
  return lines.join('\n');
}

async function dryRun(opts) {
  const cases = loadCases();
  console.log(`케이스 ${cases.length}개 파싱 OK: ${cases.map((c) => c.id).join(', ')}`);
  for (const c of cases) {
    console.log(`  - ${c.id} runMode=${c.runMode} 판정기준=${c.verdictBasis ?? 'rule'} expect=${Object.keys(c.expect).join('/')} 상한=$${c.maxBudgetUsd ?? opts.maxBudgetUsd} 추정=$${c.estUsd ?? '?'} prompt=${c.prompt.length}자 caseSha=${caseSha(c)}`);
  }

  const files = walkFiles(FIXTURE_DIR).map((f) => path.relative(FIXTURE_DIR, f));
  const forbidden = files.filter((f) => /(^|\/)(CLAUDE\.md|STATUS\.md)$/i.test(f));
  const typoCount = walkFiles(FIXTURE_DIR).reduce((s, f) => s + (fs.readFileSync(f, 'utf8').match(/회원갑입/g) ?? []).length, 0);
  console.log(`픽스처 ${files.length}개 파일. 로컬 CLAUDE.md/STATUS.md: ${forbidden.length ? 'X 있음 ' + forbidden : '없음 OK'}. '회원갑입' 전체 ${typoCount}곳 ${typoCount === 1 ? 'OK' : 'X'}`);
  const w = makeWorkdir();
  console.log(`실행용 작업 폴더 복사+git init+1커밋 OK: status=${JSON.stringify(w.status())}`);
  rmTmp(w.dir);

  const tmpRoot = mkTmp('pm-block-ab-variants-');
  const variants = prepareVariants({ A: opts.refA, B: opts.refB }, tmpRoot);
  for (const [v, x] of Object.entries(variants)) {
    console.log(`변형 ${v}: ref=${x.ref} sha=${x.sha} 훅 ${x.hookBytes}B 마커("${HOOK_MARKERS[v]}") ${x.hookMarkerOk ? '있음 OK' : '없음 X'}`);
  }
  const diff = git(['diff', '--name-only', variants.A.sha, variants.B.sha, '--', 'malgn-agent']).split('\n').filter(Boolean);
  console.log(`A와 B의 malgn-agent 아래 차이 파일 ${diff.length}개 (훅 포함 여부: ${diff.includes('malgn-agent/hooks/pm-orchestration-block.md')})`);
  rmTmp(tmpRoot);

  const selected = selectCases(cases, opts);
  const vs = opts.variant === 'both' ? ['A', 'B'] : [opts.variant];
  const plan = buildPlan(selected, vs, opts.reps);
  const judgeActive = !opts.noJudge;
  console.log(`\n실행 계획 ${plan.length}회 (케이스 ${selected.length} x 변형 ${vs.length} x reps ${opts.reps}), 교대 순서 앞 8개: ` +
    plan.slice(0, 8).map((p) => `${p.variant}/${p.caseDef.id.slice(0, 2)}/r${p.rep}`).join(' '));
  const est = estimatePlanUsd(plan, judgeActive);
  const capSum = plan.reduce((s, p) => s + reservationUsd(p.caseDef, opts, judgeActive), 0);
  console.log(`비용(가정, 미실측): 기대 합계 $${est.toFixed(2)} (시나리오별 추정 + 판정자 건당 $${JUDGE_EST_USD}), 실행별 예약 상한 합 $${capSum.toFixed(2)}, 총예산 가드 $${opts.totalBudgetUsd} (누적+예약이 넘으면 시작하지 않음)`);
  console.log('\n--dry-run이라 claude를 실행하지 않았다. 분류기·grader·kill 조건 단위 검증: node scripts/verify-pm-block-ab.mjs');
}

async function preflight(opts) {
  requireConsent();
  installCleanup();
  const cases = loadCases();
  const probe = cases.find((c) => c.id.startsWith('04')); // 위임 지시서가 나오는 케이스로 kill·subagent_type 표기를 함께 본다
  const tmpRoot = mkTmp('pm-block-ab-variants-');
  const variants = prepareVariants({ A: opts.refA, B: opts.refB }, tmpRoot);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const runsDir = path.join(RUNS_ROOT, `pm-block-ab-preflight-${ts}`);
  fs.mkdirSync(runsDir, { recursive: true });
  const report = {};
  let ok = true;
  const fails = [];
  for (const v of ['A', 'B']) {
    const w = makeWorkdir();
    const an = new StreamAnalyzer(probe.runMode);
    const proc = await runClaude({
      promptText: probe.prompt, model: opts.model, cwd: w.dir, pluginDir: variants[v].pluginDir, maxBudgetUsd: 0.25,
      timeoutMs: opts.timeoutSec * 1000, analyzer: an, extraArgs: opts.isolateSettings ? ['--setting-sources', 'project'] : [],
    });
    fs.writeFileSync(path.join(runsDir, `preflight-${v}.ndjson`), proc.stdout);
    const hookText = an.hookResponses.join('\n');
    const r = {
      sha: variants[v].sha,
      hookSessionStartCount: an.hookResponses.length,
      hookCountOk: an.hookResponses.length === 2,
      hookMarker: HOOK_MARKERS[v],
      hookMarkerInStream: hookText.includes(HOOK_MARKERS[v]),
      initToolsHaveAgent: an.init ? an.init.tools.some((t) => AGENT_TOOLS.has(t)) : false,
      initToolsHaveEnterWorktree: an.init ? an.init.tools.includes('EnterWorktree') : null,
      initPlugins: an.init?.plugins ?? null,
      pluginCheck: checkPluginPaths(an.init, variants[v].pluginDir),
      firstAction: an.firstAction,
      rawSubagentType: an.firstDecisive?.classified.rawSubagentType ?? null,
      normalizedSubagentType: an.firstDecisive?.classified.subagentType ?? null,
      killedBy: proc.killedBy,
      killExercised: proc.killedBy === 'decisive',
      killLatencyMs: proc.killLatencyMs,
      killEscalated: proc.killEscalated,
      exit: { code: proc.code, signal: proc.signal },
      ...runCost(an),
    };
    report[v] = r;
    if (!r.hookCountOk) fails.push(`${v}: SessionStart hook_response ${r.hookSessionStartCount}건 (기대 2)${r.hookSessionStartCount === 4 ? ' - 설치된 마켓플레이스 사본 중복 주입 의심' : ''}`);
    if (!r.hookMarkerInStream) fails.push(`${v}: 훅 본문에 마커 없음`);
    if (!r.initToolsHaveAgent) fails.push(`${v}: init tools에 Agent/Task 없음 - 헤드리스에서 위임 불가면 ③~⑤ 측정 무효`);
    if (r.pluginCheck.status === 'mismatch') fails.push(`${v}: 플러그인 경로 불일치 ${r.pluginCheck.detail}`);
    if (proc.killEscalated) fails.push(`${v}: SIGTERM 실패(SIGKILL 필요)`);
    rmTmp(w.dir);
  }
  // 판정자 격리·모델 별칭·JSON 출력 확인 (아주 짧은 고정 입력 1회)
  if (!opts.noJudge) {
    const j = await judgeBrief({
      request: 'README에 오타가 있어. 고쳐줘.',
      brief: "README.md 에서 '회원갑입'을 '회원가입'으로 고쳐라. 다른 파일은 건드리지 마라. 완료되면 README.md 의 해당 줄만 바뀌었는지 확인하라.",
      model: opts.judgeModel, runsDir, maxBudgetUsd: 0.3,
    });
    const val = j.parsed ? validateJudgeOutput(j.parsed, "README.md 에서 '회원갑입'을 '회원가입'으로 고쳐라. 다른 파일은 건드리지 마라. 완료되면 README.md 의 해당 줄만 바뀌었는지 확인하라.", true) : null;
    report.judge = {
      model: opts.judgeModel,
      contaminated: j.contamination.contaminated,
      contaminationReasons: j.contamination.reasons,
      initTools: j.initTools,
      jsonParsed: Boolean(j.parsed),
      itemVerdicts: val ? Object.fromEntries(Object.entries(val.items).map(([k, x]) => [k, x.verdict])) : null,
      costUsd: j.costUsd,
      exitCode: j.exitCode,
    };
    if (j.contamination.contaminated) fails.push(`judge: 격리 실패 (${j.contamination.reasons.join('; ')})`);
    if (!j.parsed) fails.push(`judge: JSON 출력 파싱 실패 (모델 별칭 ${opts.judgeModel} 또는 --tools "" 거부 가능)`);
  }
  ok = fails.length === 0;
  fs.writeFileSync(path.join(runsDir, 'preflight.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(ok ? '\npreflight 통과 (hook 2건 + 마커 + Agent 도구 + 판정자 격리).' : `\npreflight 실패 - 본 실행 금지:\n - ${fails.join('\n - ')}`);
  if (!report.A.initToolsHaveEnterWorktree) console.log('참고: EnterWorktree가 init tools에 없다 -> 시나리오 6 제외.');
  rmTmp(tmpRoot);
  process.exit(ok ? 0 : 1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  installCleanup();
  if (opts.dryRun) return dryRun(opts);
  if (opts.preflight) return preflight(opts);
  requireConsent();

  const all = loadCases();
  const selected = selectCases(all, opts);
  const vs = opts.variant === 'both' ? ['A', 'B'] : [opts.variant];
  const tmpRoot = mkTmp('pm-block-ab-variants-');
  const variants = prepareVariants({ A: opts.refA, B: opts.refB }, tmpRoot);
  for (const v of vs) if (!variants[v].hookMarkerOk) throw new Error(`변형 ${v} 훅 마커 없음 - ref 확인 필요`);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const batchId = `pm-block-ab-${ts}`;
  const runsDir = path.join(RUNS_ROOT, batchId);
  fs.mkdirSync(runsDir, { recursive: true });
  const judgeMap = {};
  const rows = [];
  let spent = 0;
  let worktreeToolMissing = false;
  let judgeActive = !opts.noJudge;
  const plan = buildPlan(selected, vs, opts.reps);
  console.log(`계획 ${plan.length}회, 총 예산 $${opts.totalBudgetUsd}(누적+예약 기준), 기본 실행당 $${opts.maxBudgetUsd}, 판정자 건당 $${opts.judgeMaxBudgetUsd}. A=${variants.A.sha.slice(0, 12)} B=${variants.B.sha.slice(0, 12)}`);

  let n = 0;
  for (const step of plan) {
    n++;
    const { variant: v, caseDef, rep } = step;
    const reserve = reservationUsd(caseDef, opts, judgeActive);
    if (spent + reserve > opts.totalBudgetUsd) {
      console.warn(`총 예산 가드: 누적 $${spent.toFixed(2)} + 예약 $${reserve.toFixed(2)} > $${opts.totalBudgetUsd} - 남은 ${plan.length - n + 1}회 건너뜀`);
      break;
    }
    if (caseDef.requiresTools && worktreeToolMissing) { console.log(`[${n}/${plan.length}] ${caseDef.id} 제외(EnterWorktree 없음)`); continue; }
    const w = makeWorkdir();
    const an = new StreamAnalyzer(caseDef.runMode);
    const startedAt = new Date().toISOString();
    const runId = `${batchId}:${v}-${caseDef.id}-r${rep}`;
    const proc = await runClaude({
      promptText: caseDef.prompt, model: opts.model, cwd: w.dir, pluginDir: variants[v].pluginDir,
      maxBudgetUsd: caseDef.maxBudgetUsd ?? opts.maxBudgetUsd, timeoutMs: (caseDef.timeoutSec ?? opts.timeoutSec) * 1000, analyzer: an,
      permissionMode: caseDef.permissionMode ?? null, extraArgs: opts.isolateSettings ? ['--setting-sources', 'project'] : [],
    });
    const transcript = path.join(runsDir, `${v}-${caseDef.id}-r${rep}.ndjson`);
    fs.writeFileSync(transcript, proc.stdout);
    let changed = [];
    try { changed = w.status(); } catch { /* 폴더 상태 조회 실패는 기록만 생략 */ }
    const infra = classifyInfra(an, proc);
    const outcome = infra.status === 'ok' ? computeOutcome(caseDef, w.dir, changed, an) : null;
    const grade = gradeRun(caseDef, v, an, { infra, outcome, workdirChanged: changed });
    const fd = an.firstDecisive;
    const briefText = fd?.classified.action.startsWith('Agent:') ? String(fd.input?.prompt ?? '') : null;
    const brief = checkBrief(caseDef, briefText);
    const pluginCheck = checkPluginPaths(an.init, variants[v].pluginDir);
    const row = buildResultRow({
      batchId, runId, variant: v, refs: variants, caseDef, caseSha: caseSha(caseDef), rep, model: opts.model, judgeModel: opts.noJudge ? null : opts.judgeModel,
      analyzer: an, grade, brief, proc, infra, outcome, workdirChanged: changed, transcript: path.relative(REPO, transcript), startedAt, pluginCheck,
    });

    // 환경 이상: 오염된 행은 기록 전에 제외 표시한 뒤 중단한다.
    const anomalies = [];
    if (an.hookResponses.length !== 2) anomalies.push(`hook_response ${an.hookResponses.length}건(기대 2)`);
    if (an.init && !an.init.tools.some((t) => AGENT_TOOLS.has(t))) anomalies.push('init tools에 Agent/Task 없음');
    if (pluginCheck.status === 'mismatch') anomalies.push(`플러그인 경로 불일치: ${pluginCheck.detail}`);
    if (anomalies.length) row.excluded = `환경 이상: ${anomalies.join('; ')}`;
    if (caseDef.requiresTools && an.init && !caseDef.requiresTools.every((t) => an.init.tools.includes(t))) {
      row.excluded = `init tools에 ${caseDef.requiresTools.join(',')} 없음`;
      worktreeToolMissing = true;
    }

    if (briefText && judgeActive && !row.excluded && infra.status === 'ok') {
      const j = await judgeBrief({ request: caseDef.prompt, brief: briefText, model: opts.judgeModel, runsDir, maxBudgetUsd: opts.judgeMaxBudgetUsd });
      row.costUsd = Number((row.costUsd + j.costUsd).toFixed(4));
      judgeMap[j.randId] = { runId, variant: v, caseId: caseDef.id, rep };
      fs.writeFileSync(path.join(runsDir, 'judge-map.json'), JSON.stringify(judgeMap, null, 2));
      if (j.contamination.contaminated) {
        row.judge = { id: j.randId, contaminated: true, reasons: j.contamination.reasons, items: null };
        row.needsHuman = true;
        judgeActive = false; // 격리 실패: 이후 판정 중단(이미 낸 판정은 무효)
        console.error(`판정자 격리 실패(${j.contamination.reasons.join('; ')}) - 이 판정 무효, 이후 판정 중단`);
      } else {
        const val = j.parsed ? validateJudgeOutput(j.parsed, briefText, brief?.regexPass) : null;
        row.judge = val ? { id: j.randId, contaminated: false, items: val.items } : { id: j.randId, contaminated: false, items: null, error: 'judge 출력 파싱 실패' };
        row.needsHuman = row.needsHuman || (val ? val.needsHuman : true);
      }
    }
    spent += row.costUsd;
    rows.push(row);
    fs.appendFileSync(RESULTS_PATH, JSON.stringify(row) + '\n');
    rmTmp(w.dir);
    console.log(`[${n}/${plan.length}] ${runId}: status=${row.status} first=${row.firstAction} ${row.verdict}${row.label ? ':' + row.label : ''} killed=${row.killedBy ?? '-'} $${row.costUsd.toFixed(3)} (누적 $${spent.toFixed(2)})${row.excluded ? ' [제외: ' + row.excluded + ']' : ''}`);
    if (anomalies.length) {
      console.error(`환경 이상 - 측정 오염 가능, 중단: ${anomalies.join('; ')}`);
      break;
    }
  }
  rmTmp(tmpRoot);
  console.log('\n' + summarize(rows, all));
  console.log(`\n${rows.length}건을 ${path.relative(REPO, RESULTS_PATH)}에 기록(batchId=${batchId}). transcript: ${path.relative(REPO, runsDir)}`);
  console.log('주의: 이 비교는 훅 단독 효과가 아니라 B 묶음(훅 외 파일 포함) 대 현 배포본이다. kill된 실행의 비용은 usage 토큰 추정치다. 지시서 품질(b~e)은 B 훅 문구와 겹쳐 B가 앞서는 것이 설계상 당연하다 - 우열 근거로 쓰지 않는다.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
