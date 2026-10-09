#!/usr/bin/env node
// PM block A/B 골든 테스트 실행기 (저장소 전용, 마켓플레이스로 배포되지 않는다).
//
// 측정 대상: 메인 세션(sonnet)이 SessionStart 훅(hooks/pm-orchestration-block.md)의 영향 아래
// 요청을 분석해 올바르게 위임하는가. 변형 A = 현재 배포본, 변형 B = 보류 브랜치(기본 hold/v1.8.50).
// 둘 다 `git archive <ref> malgn-agent`로 동결 복사한 트리를 --plugin-dir로 로드한다(워킹트리 직접 사용 금지).
// ⚠️ 이 비교는 "훅 단독 효과"가 아니라 "B 묶음(훅 외 파일도 다름) 대 현 배포본"이다.
//
// 판정 기준표(결과를 보기 전에 동결): docs/evaluation/golden-task/pm-block-ab/rubric.md
// 기존 scripts/run-golden-eval-manual.mjs는 건드리지 않고 규약만 재사용한다
// (stdin 프롬프트, stream-json 파싱, *_I_ACCEPT_COST 옵트인, --dry-run, caseSha).
//
// 사용:
//   node scripts/run-pm-block-ab.mjs --dry-run                       # 비용 0: 케이스·변형 복사·훅 문구·픽스처 점검
//   PM_BLOCK_AB_I_ACCEPT_COST=1 node scripts/run-pm-block-ab.mjs --preflight   # 약 $0.3 (사용자 승인 후 PM이 실행)
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
const RESULTS_PATH = path.join(AB_DIR, 'results.jsonl');
const RUNS_ROOT = path.join(REPO, 'docs', 'evaluation', 'golden-task', 'runs');

export const VARIANT_REFS = { A: '8008bdb', B: 'hold/v1.8.50' };
// 훅 본문 마커(변형 정체성 확인용). A: 현재 배포본 문구, B: 보류 브랜치 문구.
export const HOOK_MARKERS = { A: 'Micro(오탈자·단순조회·1줄 수정)만', B: '①읽기' };

// 비용 추정용 단가(USD / 1M 토큰). kill된 실행은 total_cost_usd가 없어 stream usage로 추정한다.
// 가정값이다 - 현재 sonnet 별칭의 실제 단가로 검증되지 않았다. 정산 금액이 아니다.
export const PRICE_PER_MTOK = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.3 };

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const SOFT_READ_TOOLS = new Set(['Skill', 'ToolSearch', 'TodoWrite']);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const AGENT_TOOLS = new Set(['Agent', 'Task']);

// ---------- 순수 로직(단위 검증 대상) ----------

export function normalizeSubagentType(t) {
  if (typeof t !== 'string' || !t.trim()) return null;
  return t.trim().replace(/^malgn-agent:/, '');
}

const READONLY_CMDS = new Set(['cd', 'ls', 'cat', 'head', 'tail', 'wc', 'rg', 'grep', 'pwd', 'stat', 'file', 'tree']);
const READONLY_GIT = new Set(['status', 'log', 'diff', 'show', 'rev-parse', 'ls-files', 'blame', 'describe']);

export function isReadOnlyBash(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return false;
  const c = cmd.replace(/2>&1/g, '').replace(/2>\/dev\/null/g, '');
  if (/[<>]/.test(c) || /\$\(|`/.test(c)) return false;
  const segs = c.split(/\|\||&&|;|\|/).map((s) => s.trim()).filter(Boolean);
  if (!segs.length) return false;
  return segs.every((seg) => {
    const tok = seg.split(/\s+/);
    const head = tok[0];
    if (READONLY_CMDS.has(head)) return true;
    if (head === 'find') return !/\s-(delete|exec|ok|execdir)\b/.test(seg);
    if (head === 'sed') return !/\s-[a-zA-Z]*i/.test(seg) && !/--in-place/.test(seg);
    if (head === 'git') {
      const sub = tok.slice(1).find((t) => !t.startsWith('-'));
      if (READONLY_GIT.has(sub)) return true;
      if (sub === 'branch') {
        const rest = tok.slice(tok.indexOf('branch') + 1);
        return rest.every((t) => /^-(a|r|v|vv|l|-list|-show-current|-all|-remotes)$/.test(t));
      }
      return false;
    }
    return false;
  });
}

// tool_use 하나를 분류한다. kind: read | decisive | neutral
export function classifyToolUse(tu) {
  const name = tu?.name;
  const input = tu?.input ?? {};
  if (AGENT_TOOLS.has(name)) {
    const type = normalizeSubagentType(input.subagent_type);
    return {
      kind: 'decisive',
      action: `Agent:${type ?? '(none)'}`,
      tool: name,
      subagentType: type,
      rawSubagentType: input.subagent_type ?? null,
      isolation: input.isolation ?? null,
    };
  }
  if (EDIT_TOOLS.has(name)) return { kind: 'decisive', action: 'main_edit', tool: name };
  if (name === 'EnterWorktree') return { kind: 'decisive', action: 'EnterWorktree', tool: name };
  if (name === 'Bash') {
    if (isReadOnlyBash(input.command)) return { kind: 'read', action: 'read', tool: name };
    return { kind: 'decisive', action: 'main_edit', tool: name, bash: true };
  }
  if (READ_TOOLS.has(name)) return { kind: 'read', action: 'read', tool: name, counted: true };
  if (SOFT_READ_TOOLS.has(name)) return { kind: 'read', action: 'read', tool: name, counted: false };
  return { kind: 'neutral', action: 'neutral', tool: name };
}

export function bashIsolationViolation(cmd, cwd) {
  if (typeof cmd !== 'string') return null;
  if (/\bgit\s+worktree\s+add\b/.test(cmd)) return 'git worktree add';
  if (/\bgit\s+checkout\s+-[bB]\b/.test(cmd)) return 'git checkout -b';
  if (/\bgit\s+switch\s+-[cC]\b/.test(cmd)) return 'git switch -c';
  const br = cmd.match(/\bgit\s+branch\s+((?:-\S+\s+)*)([^\s-][^\s;&|]*)/);
  if (br) return 'git branch <name>';
  const mk = cmd.match(/\bmkdir\s+(?:-\S+\s+)*(\S+)/);
  if (mk) {
    const p = mk[1].replace(/^["']|["']$/g, '');
    const outside = p.startsWith('..') || p.startsWith('~') || (path.isAbsolute(p) && cwd && !p.startsWith(cwd));
    if (outside) return 'mkdir outside cwd';
  }
  return null;
}

// stream-json을 한 줄씩 먹는 분석기. kill 조건 판단까지 포함한다.
export class StreamAnalyzer {
  constructor(runMode) {
    this.runMode = runMode; // kill_on_decisive | run_to_end_kill_on_violation | none
    this.init = null;
    this.hookResponses = [];
    this.mainToolUses = [];
    this.firstDecisive = null; // {classified, input}
    this.readCount = 0;
    this.agentCount = 0;
    this.mutatingCount = 0;
    this.neutralTools = [];
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
        if (cls.kind === 'read' && cls.counted !== false && cls.tool !== 'Skill') this.readCount++;
        if (cls.kind === 'neutral') this.neutralTools.push(cls.tool);
        if (cls.kind === 'decisive') {
          if (cls.action.startsWith('Agent:')) this.agentCount++;
          if (cls.action === 'main_edit') this.mutatingCount++;
          if (cls.bash) {
            const v = bashIsolationViolation(tu.input?.command, this.cwd);
            if (v) this.bashViolations.push(v);
          }
          if (!this.firstDecisive) this.firstDecisive = { classified: cls, input: item.input };
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

  get usageTotals() {
    const t = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
    for (const u of this.usageById.values()) for (const k of Object.keys(t)) t[k] += u[k] ?? 0;
    return t;
  }

  get resultText() {
    return (this.result?.result ?? this.mainText.join('\n')).trim();
  }
}

export function estimateCostFromUsage(t) {
  const p = PRICE_PER_MTOK;
  return (
    ((t.input_tokens ?? 0) * p.input +
      (t.output_tokens ?? 0) * p.output +
      (t.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (t.cache_read_input_tokens ?? 0) * p.cacheRead) /
    1e6
  );
}

export function runCost(analyzer) {
  const actual = analyzer.result?.total_cost_usd;
  if (typeof actual === 'number') return { costUsd: actual, costSource: 'result.total_cost_usd' };
  return { costUsd: estimateCostFromUsage(analyzer.usageTotals), costSource: 'estimated_from_usage' };
}

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
    constraint = { name: caseDef.brief.constraint.name, passed: new RegExp(caseDef.brief.constraint.regex).test(briefText) };
  }
  const regexPass = checks.every((c) => c.passed) && (constraint ? constraint.passed : true);
  return { regexPass, checks, constraint, promptLen: briefText.length };
}

function pickLabel(labels, action) {
  if (labels[action]) return labels[action];
  if (action.startsWith('Agent:') && labels['Agent:*']) return labels['Agent:*'];
  return `unexpected_${action}`;
}

// 첫 행동과 케이스 기대로 판정한다. 반환: {verdict: PASS|TOLERATED|FAIL, label, notes[]}
export function gradeRun(caseDef, variant, analyzer) {
  const exp = caseDef.expect[variant] ?? caseDef.expect.all;
  const fa = analyzer.firstAction;
  const notes = [];
  const fd = analyzer.firstDecisive;

  if (caseDef.hard) {
    const bad = analyzer.agentCount > caseDef.hard.maxAgent || analyzer.mutatingCount > caseDef.hard.maxMutating;
    if (bad) {
      const act = analyzer.agentCount > caseDef.hard.maxAgent ? 'Agent:*' : 'main_edit';
      return { verdict: 'FAIL', label: exp.labels[act] ?? 'hard_violation', notes: [`agent=${analyzer.agentCount} mutating=${analyzer.mutatingCount}`] };
    }
    return { verdict: 'PASS', label: null, notes: [`agent=0 mutating=0 reads=${analyzer.readCount}`] };
  }

  if (caseDef.isolation) {
    if (analyzer.bashViolations.length) return { verdict: 'FAIL', label: 'isolation_bypass', notes: analyzer.bashViolations };
    const tokens = [fa];
    if (fd?.classified.action.startsWith('Agent:') && fd.classified.isolation === 'worktree') tokens.push('Agent:isolation_worktree');
    if (tokens.some((t) => exp.pass.includes(t))) return { verdict: 'PASS', label: null, notes };
    return { verdict: 'FAIL', label: fa === 'no_action' ? 'no_isolation_action' : pickLabel(exp.labels, fa), notes };
  }

  if (caseDef.edit && fa === 'main_edit') {
    const { file, oldContains, newContains } = caseDef.edit;
    const inp = fd.input ?? {};
    let ok = false;
    if (fd.classified.bash) {
      const cmd = String(inp.command ?? '');
      ok = cmd.includes(file) && cmd.includes(oldContains);
    } else {
      const target = String(inp.file_path ?? inp.notebook_path ?? '');
      const onTarget = path.basename(target) === file;
      if (inp.old_string !== undefined) ok = onTarget && String(inp.old_string).includes(oldContains) && String(inp.new_string ?? '').includes(newContains);
      else ok = onTarget; // Write(전체 덮어쓰기)는 대상 파일이면 통과로 보고 기록
      if (!onTarget) notes.push(`대상 파일 불일치: ${target}`);
    }
    if (!ok) return { verdict: 'FAIL', label: 'wrong_file', notes };
  }

  if (exp.pass.includes(fa)) return { verdict: 'PASS', label: null, notes };
  if (exp.tolerated?.includes(fa)) return { verdict: 'TOLERATED', label: 'tolerated_over_delegation', notes };
  return { verdict: 'FAIL', label: fa === 'no_action' ? 'no_action' : pickLabel(exp.labels, fa), notes };
}

// 판정자 인용 검증: 인용이 지시서 부분문자열(공백 정규화만 허용)이어야 유효.
export function verifyQuote(brief, quote) {
  if (typeof quote !== 'string' || !quote.trim()) return false;
  if (brief.includes(quote)) return true;
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  return norm(brief).includes(norm(quote));
}

export const JUDGE_ITEMS = ['a', 'b', 'c', 'd', 'e'];

// 판정자 JSON 출력({items:{a:{verdict,quote},...}})을 검증해 정리한다.
export function validateJudgeOutput(parsed, brief, regexPass) {
  const items = {};
  for (const k of JUDGE_ITEMS) {
    const it = parsed?.items?.[k];
    const verdict = it && /^(PASS|FAIL)$/i.test(String(it.verdict)) ? String(it.verdict).toUpperCase() : null;
    const quoteValid = it ? verifyQuote(brief, it.quote) : false;
    items[k] = { verdict: verdict && quoteValid ? verdict : 'INVALID', rawVerdict: verdict, quote: it?.quote ?? null, quoteValid };
  }
  let needsHuman = false;
  if (typeof regexPass === 'boolean') {
    const ac = items.a.verdict !== 'INVALID' && items.c.verdict !== 'INVALID';
    if (ac) {
      const judgePass = items.a.verdict === 'PASS' && items.c.verdict === 'PASS';
      needsHuman = judgePass !== regexPass;
    }
  }
  return { items, needsHuman };
}

export function extractJson(text) {
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

// 실행 한 건을 results.jsonl 한 줄 구조로 만든다.
export function buildResultRow({ runId, variant, refs, caseDef, caseSha, rep, model, judgeModel, analyzer, grade, brief, proc, workdirChanged, transcript, startedAt }) {
  const { costUsd, costSource } = runCost(analyzer);
  const fd = analyzer.firstDecisive?.classified ?? null;
  return {
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
    firstAction: analyzer.firstAction,
    firstActionDetail: fd ? { tool: fd.tool, subagentType: fd.subagentType ?? null, rawSubagentType: fd.rawSubagentType ?? null, isolation: fd.isolation ?? null } : null,
    verdict: grade.verdict,
    label: grade.label,
    notes: grade.notes,
    counts: { agent: analyzer.agentCount, mutating: analyzer.mutatingCount, read: analyzer.readCount },
    neutralTools: analyzer.neutralTools,
    answerMentionsDiscount: caseDef.record?.includes('answerMentions:할인') ? /할인/.test(analyzer.resultText) : null,
    brief,
    judge: null,
    needsHuman: false,
    killedBy: proc.killedBy,
    killLatencyMs: proc.killLatencyMs ?? null,
    timedOut: proc.killedBy === 'timeout',
    exitCode: proc.code,
    signal: proc.signal,
    hookSessionStartCount: analyzer.hookResponses.length,
    initHasAgent: analyzer.init ? analyzer.init.tools.some((t) => AGENT_TOOLS.has(t)) : null,
    initHasEnterWorktree: analyzer.init ? analyzer.init.tools.includes('EnterWorktree') : null,
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

function parseArgs(argv) {
  const o = {
    variant: 'both', case: null, reps: 2, dryRun: false, preflight: false, keep: false,
    judgeModel: 'fable', model: 'sonnet', totalBudgetUsd: 20, maxBudgetUsd: 1.5, timeoutSec: 240,
    includeOptional: false, noJudge: false, refA: VARIANT_REFS.A, refB: VARIANT_REFS.B,
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
    else if (a === '--timeout-sec') o.timeoutSec = Number(next());
    else if (a === '--include-optional') o.includeOptional = true;
    else if (a === '--no-judge') o.noJudge = true;
    else if (a === '--ref-a') o.refA = next();
    else if (a === '--ref-b') o.refB = next();
    else if (a === '--help' || a === '-h') {
      console.log('usage: node scripts/run-pm-block-ab.mjs [--variant A|B|both] [--case id[,id]|all] [--reps N] [--dry-run] [--preflight] ' +
        '[--judge-model m] [--model m] [--total-budget-usd N] [--max-budget-usd N] [--timeout-sec N] [--include-optional] [--no-judge] [--keep]');
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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-block-ab-run-'));
  fs.cpSync(FIXTURE_DIR, dir, { recursive: true });
  const run = (args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`workdir git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout;
  };
  run(['init', '-q']);
  run(['add', '-A']);
  run(['-c', 'user.name=ab', '-c', 'user.email=ab@example.invalid', 'commit', '-q', '-m', 'fixture']);
  return { dir, status: () => run(['status', '--porcelain']).trim() };
}

// claude 실행 + 증분 파싱 + 조건 충족 시 SIGTERM.
export function runClaude({ promptText, model, cwd, pluginDir, maxBudgetUsd, timeoutMs, analyzer, extraArgs = [] }) {
  return new Promise((resolve, reject) => {
    const args = ['--print', '--model', model, '--output-format', 'stream-json', '--verbose', '--strict-mcp-config', '--max-budget-usd', String(maxBudgetUsd)];
    if (pluginDir) args.push('--plugin-dir', pluginDir);
    args.push(...extraArgs);
    const t0 = Date.now();
    const child = spawn('claude', args, { cwd, env: { ...process.env, MALGNAI_HEADLESS_WORKER: '1' } });
    let stdout = '';
    let stderr = '';
    let buf = '';
    let killedBy = null;
    let killedAt = null;
    const kill = (why) => {
      if (killedBy) return;
      killedBy = why;
      killedAt = Date.now();
      child.kill('SIGTERM');
      setTimeout(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }, 5000).unref();
    };
    const timer = setTimeout(() => kill('timeout'), timeoutMs);
    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      buf += s;
      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 1);
        analyzer.feed(line);
        const why = analyzer.killReason();
        if (why) kill(why);
      }
    });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (buf.trim()) analyzer.feed(buf);
      resolve({ code, signal, stdout, stderr, killedBy, killLatencyMs: killedAt ? Date.now() - killedAt : null, wallMs: Date.now() - t0 });
    });
    child.stdin.write(promptText);
    child.stdin.end();
  });
}

async function judgeBrief({ request, brief, model, runsDir }) {
  const prompt =
    '아래는 사용자의 원래 요청과, 다른 작업자에게 넘길 작업 지시서다. 지시서만 보고 항목별로 채점하라.\n' +
    '규칙: 각 항목은 PASS 또는 FAIL 중 하나. 각 항목마다 지시서에서 판정 근거가 된 문장을 **원문 그대로** quote에 인용하라(지시서에 없는 문장이면 그 항목 판정은 무효 처리된다). ' +
    '근거가 될 문장이 아예 없어 FAIL이면 quote에는 가장 가까운 문장을 인용하라.\n' +
    '항목:\n' +
    '(a) 요구사항이 사용자 요청에 나온 대로 빠짐없이 들어 있다\n' +
    '(b) 완료 판정 기준이 1줄이라도 있다\n' +
    '(c) 금지 범위·제약이 극성(하라/하지 마라)까지 맞게 들어 있다 (요청에 제약이 없다면 지시서가 제약을 지어내지 않았는가)\n' +
    '(d) 대상 경로 또는 찾는 방법이 있다\n' +
    '(e) 수신자가 이 대화를 몰라도 실행 가능하다\n\n' +
    '출력은 JSON 한 개만: {"items":{"a":{"verdict":"PASS","quote":"..."},"b":{...},"c":{...},"d":{...},"e":{...}}}\n\n' +
    `---사용자 요청---\n${request}\n---지시서 시작---\n${brief}\n---지시서 끝---\n`;
  const analyzer = new StreamAnalyzer('none');
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-block-ab-judge-'));
  // 판정자에는 플러그인을 싣지 않고 도구를 끈다. user 설정 소스를 빼서 설치된 플러그인 훅이 주입되지 않게 한다(미검증 - 보고서 참조).
  const proc = await runClaude({
    promptText: prompt, model, cwd, pluginDir: null, maxBudgetUsd: 1, timeoutMs: 180_000, analyzer,
    extraArgs: ['--tools', '', '--setting-sources', 'project', '--disable-slash-commands', '--no-session-persistence'],
  });
  fs.rmSync(cwd, { recursive: true, force: true });
  const parsed = extractJson(analyzer.resultText);
  const { costUsd } = runCost(analyzer);
  const randId = crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(path.join(runsDir, 'judge'), { recursive: true });
  fs.writeFileSync(path.join(runsDir, 'judge', `${randId}.json`), JSON.stringify({ input: { request, brief }, rawOutput: analyzer.resultText }, null, 2));
  return { randId, parsed, costUsd, exitCode: proc.code };
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
    const want = opts.case.split(',');
    return want.map((w) => {
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

function summarize(rows) {
  const keys = [...new Set(rows.map((r) => `${r.caseId}|${r.variant}`))].sort();
  const lines = [];
  for (const k of keys) {
    const rs = rows.filter((r) => `${r.caseId}|${r.variant}` === k && !r.excluded);
    const count = (f) => { const m = {}; for (const r of rs) m[f(r)] = (m[f(r)] ?? 0) + 1; return JSON.stringify(m); };
    lines.push(`${k}  n=${rs.length}  first=${count((r) => r.firstAction)}  verdict=${count((r) => r.verdict + (r.label ? ':' + r.label : ''))}  cost=$${rs.reduce((s, r) => s + r.costUsd, 0).toFixed(3)}`);
  }
  return lines.join('\n');
}

async function dryRun(opts) {
  const cases = loadCases();
  console.log(`케이스 ${cases.length}개 파싱 OK: ${cases.map((c) => c.id).join(', ')}`);
  for (const c of cases) console.log(`  - ${c.id} runMode=${c.runMode} expect=${Object.keys(c.expect).join('/')} prompt=${c.prompt.length}자 caseSha=${caseSha(c)}`);

  const files = walkFiles(FIXTURE_DIR).map((f) => path.relative(FIXTURE_DIR, f));
  const forbidden = files.filter((f) => /(^|\/)(CLAUDE\.md|STATUS\.md)$/i.test(f));
  const readme = fs.readFileSync(path.join(FIXTURE_DIR, 'README.md'), 'utf8');
  const typoCount = walkFiles(FIXTURE_DIR).reduce((s, f) => s + (fs.readFileSync(f, 'utf8').match(/회원갑입/g) ?? []).length, 0);
  console.log(`픽스처 ${files.length}개 파일. 로컬 CLAUDE.md/STATUS.md: ${forbidden.length ? 'X 있음 ' + forbidden : '없음 OK'}. '회원갑입' 전체 ${typoCount}곳(README ${(readme.match(/회원갑입/g) ?? []).length}곳) ${typoCount === 1 ? 'OK' : 'X'}`);
  const w = makeWorkdir();
  console.log(`실행용 작업 폴더 복사+git init+1커밋 OK: status="${w.status()}" (${w.dir})`);
  fs.rmSync(w.dir, { recursive: true, force: true });

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-block-ab-variants-'));
  const variants = prepareVariants({ A: opts.refA, B: opts.refB }, tmpRoot);
  for (const [v, x] of Object.entries(variants)) {
    console.log(`변형 ${v}: ref=${x.ref} sha=${x.sha} 훅 ${x.hookBytes}B 마커("${HOOK_MARKERS[v]}") ${x.hookMarkerOk ? '있음 OK' : '없음 X'}`);
  }
  const diff = git(['diff', '--name-only', variants.A.sha, variants.B.sha, '--', 'malgn-agent']).split('\n').filter(Boolean);
  console.log(`A와 B의 malgn-agent 아래 차이 파일 ${diff.length}개 (훅 포함 여부: ${diff.includes('malgn-agent/hooks/pm-orchestration-block.md')})`);
  fs.rmSync(tmpRoot, { recursive: true, force: true });

  const selected = selectCases(cases, opts);
  const vs = opts.variant === 'both' ? ['A', 'B'] : [opts.variant];
  const plan = buildPlan(selected, vs, opts.reps);
  console.log(`\n실행 계획 ${plan.length}회 (케이스 ${selected.length} x 변형 ${vs.length} x reps ${opts.reps}), 교대 순서 앞 8개: ` +
    plan.slice(0, 8).map((p) => `${p.variant}/${p.caseDef.id.slice(0, 2)}/r${p.rep}`).join(' '));
  const ceiling = Math.min(opts.totalBudgetUsd, plan.length * opts.maxBudgetUsd);
  console.log(`비용: 상한 min(total-budget $${opts.totalBudgetUsd}, ${plan.length} x $${opts.maxBudgetUsd}) = $${ceiling.toFixed(2)}. ` +
    `기대치(가정): kill 실행 1건 약 $0.15(사전 확인된 preflight 규모 $0.3/2건 기준) + 판정자 호출, 시나리오 2는 더 길 수 있음 - 실측 전 추정.`);
  console.log('\n--dry-run이라 claude를 실행하지 않았다. 분류기·grader·kill 조건 단위 검증: node scripts/verify-pm-block-ab.mjs');
}

async function preflight(opts) {
  requireConsent();
  const cases = loadCases();
  const probe = cases.find((c) => c.id.startsWith('04')); // 위임 지시서가 나오는 케이스로 kill·subagent_type 표기를 함께 본다
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-block-ab-variants-'));
  const variants = prepareVariants({ A: opts.refA, B: opts.refB }, tmpRoot);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const runsDir = path.join(RUNS_ROOT, `pm-block-ab-preflight-${ts}`);
  fs.mkdirSync(runsDir, { recursive: true });
  const report = {};
  let ok = true;
  for (const v of ['A', 'B']) {
    const w = makeWorkdir();
    const an = new StreamAnalyzer(probe.runMode);
    const proc = await runClaude({ promptText: probe.prompt, model: opts.model, cwd: w.dir, pluginDir: variants[v].pluginDir, maxBudgetUsd: 0.25, timeoutMs: opts.timeoutSec * 1000, analyzer: an });
    fs.writeFileSync(path.join(runsDir, `preflight-${v}.ndjson`), proc.stdout);
    const hookText = an.hookResponses.join('\n');
    const r = {
      sha: variants[v].sha,
      hookSessionStartCount: an.hookResponses.length,
      hookCountOk: an.hookResponses.length === 2,
      hookMarker: HOOK_MARKERS[v],
      hookMarkerInStream: hookText.includes(HOOK_MARKERS[v]),
      initToolsHaveAgent: an.init ? an.init.tools.some((t) => AGENT_TOOLS.has(t)) : null,
      initToolsHaveEnterWorktree: an.init ? an.init.tools.includes('EnterWorktree') : null,
      firstAction: an.firstAction,
      rawSubagentType: an.firstDecisive?.classified.rawSubagentType ?? null,
      normalizedSubagentType: an.firstDecisive?.classified.subagentType ?? null,
      killedBy: proc.killedBy,
      killExercised: proc.killedBy === 'decisive',
      killLatencyMs: proc.killLatencyMs,
      exit: { code: proc.code, signal: proc.signal },
      ...runCost(an),
    };
    report[v] = r;
    if (!r.hookCountOk || !r.hookMarkerInStream) ok = false;
    if (an.hookResponses.length === 4) r.warning = '4건 - 설치된 마켓플레이스 사본의 훅이 중복 주입됨. 중단.';
    fs.rmSync(w.dir, { recursive: true, force: true });
  }
  fs.writeFileSync(path.join(runsDir, 'preflight.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  console.log(ok ? '\npreflight 통과 (hook 2건 + 마커 확인).' : '\npreflight 실패 - 본 실행 금지.');
  if (!report.A.initToolsHaveEnterWorktree) console.log('참고: EnterWorktree가 init tools에 없다 -> 시나리오 6 제외.');
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.dryRun) return dryRun(opts);
  if (opts.preflight) return preflight(opts);
  requireConsent();

  const all = loadCases();
  const selected = selectCases(all, opts);
  const vs = opts.variant === 'both' ? ['A', 'B'] : [opts.variant];
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-block-ab-variants-'));
  const variants = prepareVariants({ A: opts.refA, B: opts.refB }, tmpRoot);
  for (const v of vs) if (!variants[v].hookMarkerOk) throw new Error(`변형 ${v} 훅 마커 없음 - ref 확인 필요`);
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const runsDir = path.join(RUNS_ROOT, `pm-block-ab-${ts}`);
  fs.mkdirSync(runsDir, { recursive: true });
  const judgeMap = {};
  const rows = [];
  let spent = 0;
  let worktreeToolMissing = false;
  const plan = buildPlan(selected, vs, opts.reps);
  console.log(`계획 ${plan.length}회, 총 예산 $${opts.totalBudgetUsd}, 실행당 $${opts.maxBudgetUsd}. A=${variants.A.sha.slice(0, 12)} B=${variants.B.sha.slice(0, 12)}`);

  let n = 0;
  for (const step of plan) {
    n++;
    if (spent >= opts.totalBudgetUsd) { console.warn(`총 예산 $${opts.totalBudgetUsd} 도달($${spent.toFixed(2)}) - 남은 ${plan.length - n + 1}회 건너뜀`); break; }
    const { variant: v, caseDef, rep } = step;
    if (caseDef.requiresTools && worktreeToolMissing) { console.log(`[${n}/${plan.length}] ${caseDef.id} 제외(EnterWorktree 없음)`); continue; }
    const w = makeWorkdir();
    const an = new StreamAnalyzer(caseDef.runMode);
    const startedAt = new Date().toISOString();
    const runId = `${v}-${caseDef.id}-r${rep}`;
    const proc = await runClaude({ promptText: caseDef.prompt, model: opts.model, cwd: w.dir, pluginDir: variants[v].pluginDir, maxBudgetUsd: opts.maxBudgetUsd, timeoutMs: opts.timeoutSec * 1000, analyzer: an });
    const transcript = path.join(runsDir, `${runId}.ndjson`);
    fs.writeFileSync(transcript, proc.stdout);
    let changed = '';
    try { changed = w.status(); } catch { /* 폴더 상태 조회 실패는 기록만 생략 */ }
    const grade = gradeRun(caseDef, v, an);
    const fd = an.firstDecisive;
    const briefText = fd?.classified.action.startsWith('Agent:') ? String(fd.input?.prompt ?? '') : null;
    const brief = checkBrief(caseDef, briefText);
    const row = buildResultRow({
      runId, variant: v, refs: variants, caseDef, caseSha: caseSha(caseDef), rep, model: opts.model, judgeModel: opts.noJudge ? null : opts.judgeModel,
      analyzer: an, grade, brief, proc, workdirChanged: changed.split('\n').filter(Boolean), transcript: path.relative(REPO, transcript), startedAt,
    });
    if (caseDef.requiresTools && an.init && !caseDef.requiresTools.every((t) => an.init.tools.includes(t))) {
      row.excluded = `init tools에 ${caseDef.requiresTools.join(',')} 없음`;
      worktreeToolMissing = true;
    }
    if (briefText && !opts.noJudge) {
      const j = await judgeBrief({ request: caseDef.prompt, brief: briefText, model: opts.judgeModel, runsDir });
      const val = j.parsed ? validateJudgeOutput(j.parsed, briefText, brief?.regexPass) : null;
      row.judge = val ? { id: j.randId, items: val.items } : { id: j.randId, items: null, error: 'judge 출력 파싱 실패' };
      row.needsHuman = val ? val.needsHuman : true;
      row.costUsd = Number((row.costUsd + j.costUsd).toFixed(4));
      judgeMap[j.randId] = { runId, variant: v, caseId: caseDef.id, rep };
      fs.writeFileSync(path.join(runsDir, 'judge-map.json'), JSON.stringify(judgeMap, null, 2));
    }
    spent += row.costUsd;
    rows.push(row);
    fs.appendFileSync(RESULTS_PATH, JSON.stringify(row) + '\n');
    fs.rmSync(w.dir, { recursive: true, force: true });
    console.log(`[${n}/${plan.length}] ${runId}: first=${row.firstAction} ${row.verdict}${row.label ? ':' + row.label : ''} killed=${row.killedBy ?? '-'} $${row.costUsd.toFixed(3)} (누적 $${spent.toFixed(2)})`);
    if (an.hookResponses.length !== 2) {
      console.error(`SessionStart hook_response ${an.hookResponses.length}건(기대 2) - 설치 사본 중복 등 환경 이상. 측정 오염 가능, 중단.`);
      break;
    }
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  console.log('\n' + summarize(rows));
  console.log(`\n${rows.length}건을 ${path.relative(REPO, RESULTS_PATH)}에 기록. transcript: ${path.relative(REPO, runsDir)}`);
  console.log('주의: 이 비교는 훅 단독 효과가 아니라 B 묶음(훅 외 파일 포함) 대 현 배포본이다. kill된 실행의 비용은 usage 토큰 추정치다.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
