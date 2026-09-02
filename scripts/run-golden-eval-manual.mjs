#!/usr/bin/env node
// 골든 태스크 벤치마크 — 수동 실행기 (저장소 전용, 마켓플레이스로 배포되지 않는다).
//
// `claude plugin eval`은 얼리액세스 게이트로 막혀 있어(조직 미승인) `pnpm run eval:golden`이
// 돌지 않는다. 이 스크립트는 그 얼리액세스 기능을 우회하지 않는다 — 대신 malgn-agent/evals/
// 아래 케이스 정의(prompt.md + graders/*.md)를 그대로 읽어 `claude -p`로 직접 실행하고,
// 이 스크립트가 직접 채점한다. 케이스 정의(=측정 기준)는 공식 하네스와 동일하다.
//
// 근거로 확인한 것: `claude plugin eval`은 OS 샌드박스가 아니라 "격리된 claude -p 세션 +
// 선언형 그레이더 채점"의 조합이다(docs/architecture/golden-task-benchmark.md §0). 그 조합을
// 이 스크립트가 직접 구현한다.
//
// 이 스크립트가 못 흉내내는 것 (공식 하네스와의 차이):
//   - 매 run마다 완전히 새 CLAUDE_CONFIG_DIR/HOME까지 격리하지는 않는다.
//     대신 매 run 새 임시 작업 디렉터리 + `--strict-mcp-config`(운영자 계정 MCP 커넥터 차단)로 근사한다.
//     → 오히려 공식 하네스의 알려진 결함(R2: 운영자 claude.ai 커넥터가 자식 세션에 노출)은 없다.
//   - case.yaml의 mocks/scaffold_script는 파싱하지 않는다. 이 저장소의 케이스는 둘 다 쓰지 않아 무해하다.
//   - 공식 aggregate-result.json/HTML 리포트, claude.ai 발행 기능은 없다.
//   - 결과는 공식 history.jsonl과 수집 방식이 달라 같은 줄로 비교하지 않는다 → manual-history.jsonl에 따로 쌓는다.
//
// 사용:
//   node scripts/run-golden-eval-manual.mjs --dry-run                # 케이스·그레이더 파싱만 검증 (비용 0)
//   GOLDEN_EVAL_MANUAL_I_ACCEPT_COST=1 node scripts/run-golden-eval-manual.mjs
//   ... -- --case architect-design-obligations --runs 1 --model sonnet --judge-model sonnet --keep
//   ... -- --arm without   # 플러그인 없이(architect 서브에이전트 없이) 같은 케이스 실행 — ablation 대조군

import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_DIR = path.join(REPO, 'malgn-agent');
const EVALS_DIR = path.join(PLUGIN_DIR, 'evals');
const OUT_ROOT = path.join(REPO, 'docs', 'evaluation', 'golden-task');
const MANUAL_HISTORY = path.join(OUT_ROOT, 'manual-history.jsonl');

// 이 그레이더가 실패하면 가중 점수와 무관하게 그 회차는 FAIL이다. 근거는 §4-2.
// 공식 스크립트(scripts/run-golden-eval.mjs)의 HARD_GATES와 **내용까지 같아야 한다** —
// 얼리액세스 승인 전에는 이 수동 러너가 케이스를 실제로 돌리는 유일한 경로라, 여기에
// 등록이 빠진 케이스는 위임이 죽어도 통과로 집계된다. 케이스를 추가할 때 두 파일을 함께 고친다.
const HARD_GATES = {
  'architect-design-obligations': ['delegates-to-architect'],
  'planner-prd-obligations': ['delegates-to-planner'],
  'qa-engineer-test-report-obligations': ['delegates-to-qa-engineer'],
  'security-dev-stage-discipline': ['delegates-to-security'],
};

function parseArgs(argv) {
  const opts = {
    case: 'architect-design-obligations',
    runs: 1,
    model: 'sonnet',
    judgeModel: 'sonnet',
    maxBudgetUsd: 12,
    threshold: 0.9,
    keep: false,
    dryRun: false,
    arm: 'with',
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--keep') opts.keep = true;
    else if (a === '--case') opts.case = argv[++i];
    else if (a === '--runs') opts.runs = Number(argv[++i]);
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--judge-model') opts.judgeModel = argv[++i];
    else if (a === '--max-budget-usd') opts.maxBudgetUsd = Number(argv[++i]);
    else if (a === '--threshold') opts.threshold = Number(argv[++i]);
    else if (a === '--arm') opts.arm = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(
        'usage: node scripts/run-golden-eval-manual.mjs [--case name] [--runs N] ' +
          '[--model m] [--judge-model m] [--max-budget-usd N] [--threshold N] [--arm with|without] [--keep] [--dry-run]',
      );
      process.exit(0);
    }
  }
  if (!['with', 'without'].includes(opts.arm)) throw new Error(`--arm은 with|without만 가능: ${opts.arm}`);
  return opts;
}

function readFrontmatter(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) throw new Error(`frontmatter 없음: ${absPath}`);
  return { meta: yamlLoad(m[1]) || {}, body: m[2] };
}

function loadCase(caseName) {
  const dir = path.join(EVALS_DIR, caseName);
  if (!fs.existsSync(dir)) throw new Error(`케이스 없음: ${dir}`);
  const { meta, body } = readFrontmatter(path.join(dir, 'prompt.md'));
  const gradersDir = path.join(dir, 'graders');
  const graders = fs
    .readdirSync(gradersDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const { meta: gmeta, body: gbody } = readFrontmatter(path.join(gradersDir, f));
      return { name: f.replace(/\.md$/, ''), ...gmeta, rubric: gbody.trim() };
    });
  return { name: caseName, meta, promptBody: body.trim(), graders };
}

// 공식 스크립트와 동일한 지문 로직 — 케이스(프롬프트+그레이더)를 고치면 값이 바뀐다.
// 이 값이 다른 회차끼리는 manual-history.jsonl에서도 점수를 비교하지 않는다.
function caseSha(caseName) {
  const dir = path.join(EVALS_DIR, caseName);
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dir);
  const h = crypto.createHash('sha256');
  for (const f of files) {
    h.update(path.relative(dir, f));
    h.update(fs.readFileSync(f));
  }
  return h.digest('hex').slice(0, 12);
}

function findFilesByBasename(root, basename) {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === basename) found.push(p);
    }
  };
  if (fs.existsSync(root)) walk(root);
  return found;
}

function listAllFiles(root) {
  const found = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else found.push(path.relative(root, p));
    }
  };
  if (fs.existsSync(root)) walk(root);
  return found;
}

// `claude -p`를 직접 호출한다. 프롬프트는 stdin으로 넘긴다 — 위치인자로 넘기면
// 뒤따르는 가변인자 플래그(`--allowedTools`)가 프롬프트를 도구 이름으로 삼켜버릴 수 있다.
function runClaude({ promptText, model, allowedTools, cwd, timeoutMs, maxBudgetUsd, pluginDir }) {
  return new Promise((resolve, reject) => {
    const args = [
      '--print',
      '--model', model,
      '--output-format', 'stream-json',
      '--verbose',
      '--strict-mcp-config',
      '--max-budget-usd', String(maxBudgetUsd),
    ];
    if (pluginDir) args.push('--plugin-dir', pluginDir);
    if (allowedTools?.length) args.push('--allowedTools', ...allowedTools);
    const child = spawn('claude', args, { cwd, timeout: timeoutMs });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
    child.stdin.write(promptText);
    child.stdin.end();
  });
}

// stream-json NDJSON에서 tool_use 호출과 최종 result(비용·시간·본문)를 뽑는다.
// 실측 확인(2026-09-01, claude-code CLI): assistant 메시지의 content[] 항목 중
// type: 'tool_use'가 {name, input}을 담고, type: 'result' 메시지가 total_cost_usd/duration_ms/result를 담는다.
function parseStream(stdout) {
  const toolUses = [];
  let result = null;
  for (const line of stdout.split('\n')) {
    if (!line.trim()) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    if (obj.type === 'assistant') {
      for (const item of obj.message?.content ?? []) {
        if (item.type === 'tool_use') toolUses.push({ name: item.name, input: item.input });
      }
    } else if (obj.type === 'result') {
      result = obj;
    }
  }
  return { toolUses, result };
}

async function judgeWithLlm({ grader, fileContent, model }) {
  const prompt =
    `${grader.rubric}\n\n---문서 시작---\n${fileContent}\n---문서 끝---\n\n` +
    '반드시 첫 줄에 PASS 또는 FAIL만 답하라.';
  const { stdout } = await runClaude({
    promptText: prompt,
    model,
    allowedTools: [],
    cwd: os.tmpdir(),
    timeoutMs: 120_000,
    maxBudgetUsd: 1,
  });
  const { result } = parseStream(stdout);
  const text = (result?.result ?? '').trim();
  const verdict = /^PASS/i.test(text) ? 'PASS' : /^FAIL/i.test(text) ? 'FAIL' : 'UNKNOWN';
  return { verdict, passed: verdict === 'PASS', costUsd: result?.total_cost_usd ?? 0, raw: text };
}

async function gradeCase({ workdir, graders, toolUses, judgeModel }) {
  const graded = [];
  let judgeCost = 0;
  for (const g of graders) {
    let passed = false;
    let detail = '';
    if (g.type === 'file_exists') {
      const basename = g.path.replace(/^\*\*\//, '');
      const hits = findFilesByBasename(workdir, basename);
      passed = hits.length > 0;
      detail = hits.length ? path.relative(workdir, hits[0]) : '(없음)';
    } else if (g.type === 'tool_used') {
      const hits = toolUses.filter(
        (t) =>
          t.name === g.tool &&
          (!g.input_match || JSON.stringify(t.input ?? {}).toLowerCase().includes(String(g.input_match).toLowerCase())),
      );
      passed = hits.length >= (g.min ?? 1);
      detail = `${hits.length}회 호출`;
    } else if (g.type === 'regex' && g.target === 'files') {
      const listing = listAllFiles(workdir).join('\n');
      passed = new RegExp(g.pattern).test(listing);
      detail = passed ? '' : listing || '(생성된 파일 없음)';
    } else if (g.type === 'regex' && g.target?.source === 'file') {
      const filePath = path.join(workdir, g.target.path);
      if (fs.existsSync(filePath)) {
        passed = new RegExp(g.pattern).test(fs.readFileSync(filePath, 'utf8'));
      } else {
        detail = `파일 없음: ${g.target.path}`;
      }
    } else if (g.type === 'llm') {
      const filePath = path.join(workdir, g.focus.path);
      if (fs.existsSync(filePath)) {
        const verdict = await judgeWithLlm({ grader: g, fileContent: fs.readFileSync(filePath, 'utf8'), model: judgeModel });
        passed = verdict.passed;
        detail = verdict.raw.slice(0, 200);
        judgeCost += verdict.costUsd;
      } else {
        detail = `파일 없음: ${g.focus.path}`;
      }
    } else {
      detail = `미지원 grader type: ${g.type}`;
    }
    graded.push({ name: g.name, type: g.type, weight: g.weight ?? 1, passed, detail });
  }
  return { graded, judgeCost };
}

async function runOnce(kase, opts, runIndex) {
  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'golden-eval-manual-'));
  fs.mkdirSync(path.join(workdir, 'docs'), { recursive: true });
  console.log(`\n[run ${runIndex}, arm=${opts.arm}] workdir=${workdir}`);

  // arm: without → 플러그인을 아예 로드하지 않는다. architect 서브에이전트가 없으므로
  // 프롬프트 자체의 폴백("위임할 수 없으면 네가 직접 설계")이 발동한다 — 이게 대조군이다.
  const pluginDir = opts.arm === 'with' ? PLUGIN_DIR : null;
  // arm: with-only 그레이더(delegates-to-architect)는 플러그인이 없는 대조군에서 의미가 없다
  // (위임할 대상 자체가 없다) → 공식 하네스와 동일하게 without 실행에서는 채점·하드게이트에서 뺀다.
  const scorableGraders = opts.arm === 'with' ? kase.graders : kase.graders.filter((g) => g.arm !== 'with-only');

  const startedAt = new Date().toISOString();
  const timeoutMs = (kase.meta.timeout_seconds ?? 1800) * 1000;
  const { code, signal, stdout, stderr } = await runClaude({
    promptText: kase.promptBody,
    model: opts.model,
    allowedTools: kase.meta.allowed_tools ?? [],
    cwd: workdir,
    timeoutMs,
    maxBudgetUsd: opts.maxBudgetUsd,
    pluginDir,
  });
  const { toolUses, result } = parseStream(stdout);
  if (signal) console.warn(`  ⚠️ 프로세스가 시그널 ${signal}로 종료됨(타임아웃 가능성)`);
  if (code !== 0 && !result) {
    console.error(`  ✗ claude 실행 실패(exit ${code})`);
    console.error(stderr.slice(0, 2000));
  }

  const { graded, judgeCost } = await gradeCase({ workdir, graders: scorableGraders, toolUses, judgeModel: opts.judgeModel });

  const totalWeight = graded.reduce((s, g) => s + g.weight, 0);
  const earned = graded.reduce((s, g) => s + (g.passed ? g.weight : 0), 0);
  const score = totalWeight > 0 ? earned / totalWeight : 0;

  const hardGateNames = opts.arm === 'with' ? (HARD_GATES[kase.name] ?? []) : [];
  const hardGateFailures = graded.filter((g) => hardGateNames.includes(g.name) && !g.passed).map((g) => g.name);

  const costUsd = (result?.total_cost_usd ?? 0) + judgeCost;
  const durationMs = result?.duration_ms ?? null;

  console.log(
    `  score=${score.toFixed(3)} (${earned}/${totalWeight})  cost=$${costUsd.toFixed(3)}  ` +
      `duration=${durationMs ? Math.round(durationMs / 1000) + 's' : '?'}`,
  );
  for (const g of graded) {
    console.log(`   ${g.passed ? '✓' : '✗'} [${g.weight}] ${g.name}${g.detail ? ' — ' + g.detail : ''}`);
  }
  if (hardGateFailures.length) {
    console.error(`  ✗✗ 하드 게이트 실패: ${hardGateFailures.join(', ')} — 점수와 무관하게 이 회차는 FAIL`);
  }

  if (!opts.keep) fs.rmSync(workdir, { recursive: true, force: true });
  else console.log(`  작업 디렉터리 보존: ${workdir}`);

  return {
    startedAt,
    caseName: kase.name,
    caseSha: caseSha(kase.name),
    arm: opts.arm,
    model: opts.model,
    judgeModel: opts.judgeModel,
    score: Number(score.toFixed(4)),
    passed: score >= opts.threshold && hardGateFailures.length === 0,
    hardGateFailures,
    failedGraders: graded.filter((g) => !g.passed).map((g) => g.name),
    costUsd: Number(costUsd.toFixed(4)),
    durationMs,
    exitCode: code,
    timedOut: signal === 'SIGTERM',
    workdir: opts.keep ? workdir : null,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const kase = loadCase(opts.case);

  if (opts.dryRun) {
    const scorable = opts.arm === 'with' ? kase.graders : kase.graders.filter((g) => g.arm !== 'with-only');
    console.log(`케이스: ${kase.name} (arm=${opts.arm})`);
    console.log(
      `프롬프트 ${kase.promptBody.length}자, 그레이더 ${scorable.length}/${kase.graders.length}개, ` +
        `가중치 합 ${scorable.reduce((s, g) => s + (g.weight ?? 1), 0)}`,
    );
    for (const g of kase.graders) {
      const skipped = !scorable.includes(g) ? ' [without 대조군에서 제외]' : '';
      console.log(`  - ${g.name} (${g.type}, weight ${g.weight ?? 1})${skipped}`);
    }
    console.log('\n--dry-run이라 claude를 실행하지 않았다.');
    return;
  }

  if (process.env.GOLDEN_EVAL_MANUAL_I_ACCEPT_COST !== '1') {
    console.error(
      '이 실행은 유료다(claude -p 실제 호출, 공식 하네스와 비슷한 자릿수 — 케이스당 수 달러).\n' +
        '비용은 이 명령을 실행한 사람의 계정에 청구된다.\n\n' +
        '실행하려면: GOLDEN_EVAL_MANUAL_I_ACCEPT_COST=1 node scripts/run-golden-eval-manual.mjs\n' +
        '비용 없이 케이스 파싱만 보려면: node scripts/run-golden-eval-manual.mjs --dry-run',
    );
    process.exit(1);
  }

  const rows = [];
  for (let i = 1; i <= opts.runs; i++) {
    rows.push(await runOnce(kase, opts, i));
  }

  fs.mkdirSync(OUT_ROOT, { recursive: true });
  for (const row of rows) fs.appendFileSync(MANUAL_HISTORY, JSON.stringify(row) + '\n');
  console.log(`\n${rows.length}개 회차를 ${path.relative(REPO, MANUAL_HISTORY)}에 기록했다.`);
  console.log('⚠️ 이 파일은 공식 claude plugin eval의 history.jsonl과 수집 방식이 달라 직접 비교하지 않는다.');

  process.exit(rows.some((r) => !r.passed) ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
