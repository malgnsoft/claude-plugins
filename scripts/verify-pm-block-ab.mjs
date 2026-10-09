#!/usr/bin/env node
// run-pm-block-ab.mjs의 순수 로직(분류기·grader·kill 조건·비용 추정·결과 구조) 단위 검증. 비용 0, claude 미실행.
// 가짜 stream-json 샘플: scripts/pm-block-ab-samples/*.ndjson. kill 동작은 가짜 `claude` 실행파일(PATH 앞쪽)로 확인한다.
// 사용: node scripts/verify-pm-block-ab.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  StreamAnalyzer, loadCases, gradeRun, checkBrief, classifyToolUse, isReadOnlyBash, normalizeSubagentType,
  estimateCostFromUsage, runCost, verifyQuote, validateJudgeOutput, buildResultRow, buildPlan, runClaude, extractJson,
} from './run-pm-block-ab.mjs';

const SAMPLES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pm-block-ab-samples');
const cases = Object.fromEntries(loadCases().map((c) => [c.id.slice(0, 2), c]));
let pass = 0;
let fail = 0;
const t = (name, cond, extra = '') => {
  if (cond) pass++; else { fail++; console.error(`FAIL: ${name} ${extra}`); }
};
const eq = (name, got, want) => t(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

function analyze(sample, runMode) {
  const an = new StreamAnalyzer(runMode);
  for (const line of fs.readFileSync(path.join(SAMPLES, sample + '.ndjson'), 'utf8').split('\n')) an.feed(line);
  return an;
}

// --- 정규화·Bash 분류 ---
eq('normalize 접두어', normalizeSubagentType('malgn-agent:pm'), 'pm');
eq('normalize 무접두', normalizeSubagentType('backend-dev'), 'backend-dev');
eq('normalize 빈값', normalizeSubagentType(''), null);
for (const c of ['ls -la', 'cat README.md', 'git status --short && git branch --show-current', 'git log --oneline | head -5', 'rg foo src', 'cd src && ls', 'git diff HEAD~1', 'git branch -a', 'find . -name "*.js"']) t(`읽기성: ${c}`, isReadOnlyBash(c));
for (const c of ["sed -i '' 's/a/b/' x", 'echo hi > f', 'git branch feature/x', 'git checkout -b x', 'mkdir -p ../x', 'rm -rf x', 'find . -delete', 'cat a | tee b', 'ls $(pwd)', 'node x.js', '']) t(`변경성/불명: ${c}`, !isReadOnlyBash(c));
eq('Read는 read', classifyToolUse({ name: 'Read', input: {} }).kind, 'read');
eq('Skill은 read', classifyToolUse({ name: 'Skill', input: {} }).kind, 'read');
eq('AskUserQuestion은 neutral', classifyToolUse({ name: 'AskUserQuestion', input: {} }).kind, 'neutral');
eq('Agent 정규화', classifyToolUse({ name: 'Agent', input: { subagent_type: 'malgn-agent:pm' } }).action, 'Agent:pm');
eq('Agent type 생략', classifyToolUse({ name: 'Agent', input: {} }).action, 'Agent:(none)');

// --- 시나리오 1 ---
let an = analyze('s01-main-edit-readme', 'kill_on_decisive');
eq('s01 first', an.firstAction, 'main_edit');
eq('s01 kill', an.killReason(), 'decisive');
eq('s01 hook 2건', an.hookResponses.length, 2);
eq('s01 grade A', gradeRun(cases['01'], 'A', an).verdict, 'PASS');
eq('s01 grade B', gradeRun(cases['01'], 'B', an).verdict, 'PASS');
an = analyze('s13-edit-wrong-file', 'kill_on_decisive');
eq('s13 wrong_file', gradeRun(cases['01'], 'A', an).label, 'wrong_file');
an = analyze('s14-sed-bash-readme', 'kill_on_decisive');
eq('s14 sed bash PASS', gradeRun(cases['01'], 'A', an).verdict, 'PASS');
an = analyze('s02-agent-pm', 'kill_on_decisive');
eq('s02 pm in case1 심각', gradeRun(cases['01'], 'A', an).label, 'severe_misroute_pm');
an = analyze('s03-agent-backend-good', 'kill_on_decisive');
eq('s03 backend in case1 과잉', gradeRun(cases['01'], 'A', an).label, 'over_delegation');

// --- 시나리오 2 ---
an = analyze('s05-explain-clean', 'run_to_end_kill_on_violation');
eq('s05 kill 없음', an.killReason(), null);
eq('s05 PASS', gradeRun(cases['02'], 'A', an).verdict, 'PASS');
eq('s05 reads', an.readCount, 2);
eq('s05 first', an.firstAction, 'no_action');
eq('s05 실제 비용 사용', runCost(an).costSource, 'result.total_cost_usd');
an = analyze('s06-explain-violation-agent', 'run_to_end_kill_on_violation');
eq('s06 violation kill', an.killReason(), 'violation');
eq('s06 FAIL', gradeRun(cases['02'], 'B', an).verdict, 'FAIL');
eq('s06 label', gradeRun(cases['02'], 'B', an).label, 'delegated_a_lookup');
an = analyze('s01-main-edit-readme', 'run_to_end_kill_on_violation');
eq('s01 in case2 mutating FAIL', gradeRun(cases['02'], 'A', an).label, 'mutating_action');

// --- 시나리오 3: 변형별 기대 + 서브에이전트 잡음 무시 ---
an = analyze('s07-subagent-noise-then-frontend', 'kill_on_decisive');
eq('s07 first(서브에이전트 Edit 무시)', an.firstAction, 'Agent:frontend-dev');
eq('s07 mutating 0', an.mutatingCount, 0);
eq('s07 A=TOLERATED', gradeRun(cases['03'], 'A', an).verdict, 'TOLERATED');
eq('s07 B=PASS', gradeRun(cases['03'], 'B', an).verdict, 'PASS');
const b3 = checkBrief(cases['03'], an.firstDecisive.input.prompt);
eq('s07 brief regex', b3.regexPass, true);
an = analyze('s01-main-edit-readme', 'kill_on_decisive');
eq('main_edit in case3 A=PASS', gradeRun(cases['03'], 'A', an).verdict, 'PASS');
eq('main_edit in case3 B=main_edit_violation', gradeRun(cases['03'], 'B', an).label, 'main_edit_violation');
an = analyze('s02-agent-pm', 'kill_on_decisive');
eq('pm in case3 A', gradeRun(cases['03'], 'A', an).label, 'misroute_pm');
eq('pm in case3 B', gradeRun(cases['03'], 'B', an).label, 'misroute_pm');

// --- 시나리오 4: type 정확 비교, 요청 문구 인용 헛통과 방지, 극성 ---
an = analyze('s03-agent-backend-good', 'kill_on_decisive');
eq('s03 case4 PASS', gradeRun(cases['04'], 'A', an).verdict, 'PASS');
const b4 = checkBrief(cases['04'], an.firstDecisive.input.prompt);
eq('s03 brief regex + 극성', [b4.regexPass, b4.constraint.passed], [true, true]);
an = analyze('s04-agent-wrong-type-quote', 'kill_on_decisive');
eq('s04 지시서에 backend-dev 언급돼도 type이 general-purpose면 FAIL', gradeRun(cases['04'], 'B', an).verdict, 'FAIL');
eq('s04 label', gradeRun(cases['04'], 'B', an).label, 'wrong_agent');
const b4w = checkBrief(cases['04'], an.firstDecisive.input.prompt);
eq('s04 극성 반대("건드려도 된다") 제약 불통과', b4w.constraint.passed, false);
eq('s04 regexPass false', b4w.regexPass, false);

// --- 시나리오 5 ---
an = analyze('s02-agent-pm', 'kill_on_decisive');
eq('s02 case5 PASS', gradeRun(cases['05'], 'A', an).verdict, 'PASS');
eq('s02 brief5', checkBrief(cases['05'], an.firstDecisive.input.prompt).regexPass, true);
an = analyze('s03-agent-backend-good', 'kill_on_decisive');
eq('backend in case5 under_routing', gradeRun(cases['05'], 'A', an).label, 'under_routing');
an = analyze('s01-main-edit-readme', 'kill_on_decisive');
eq('main_edit in case5 under_routing', gradeRun(cases['05'], 'B', an).label, 'under_routing');
an = analyze('s11-no-action-question', 'kill_on_decisive');
eq('no_action in case5', gradeRun(cases['05'], 'A', an).label, 'no_action');
eq('no_action kill 없음', an.killReason(), null);

// --- 시나리오 6 ---
an = analyze('s08-bash-worktree-add', 'kill_on_decisive');
eq('s08 첫 읽기성 Bash 건너뛰고 변경성 Bash가 first', an.firstAction, 'main_edit');
eq('s08 isolation_bypass', gradeRun(cases['06'], 'A', an).label, 'isolation_bypass');
an = analyze('s09-enter-worktree', 'kill_on_decisive');
eq('s09 PASS', gradeRun(cases['06'], 'A', an).verdict, 'PASS');
eq('s09 init has EnterWorktree', an.init.tools.includes('EnterWorktree'), true);
an = analyze('s10-agent-isolation-worktree', 'kill_on_decisive');
eq('s10 PASS', gradeRun(cases['06'], 'B', an).verdict, 'PASS');

// --- 비용 추정: 같은 message id 블록 중복은 최댓값만 ---
an = analyze('s12-killed-usage-multi-block', 'kill_on_decisive');
eq('s12 usage 중복 제거', an.usageTotals, { input_tokens: 100, output_tokens: 400, cache_creation_input_tokens: 30000, cache_read_input_tokens: 1000 });
const est = estimateCostFromUsage(an.usageTotals);
t('s12 추정비용 계산', Math.abs(est - (100 * 3 + 400 * 15 + 30000 * 3.75 + 1000 * 0.3) / 1e6) < 1e-9);
eq('s12 costSource', runCost(an).costSource, 'estimated_from_usage');

// --- 판정자 인용 검증 ---
const brief = '.btn-primary 버튼 색을 연하게, 모서리를\n  더 둥글게 (public/css/app.css).';
t('인용 정확', verifyQuote(brief, '.btn-primary 버튼 색을 연하게'));
t('인용 공백 정규화', verifyQuote(brief, '모서리를 더 둥글게'));
t('인용 지어낸 문장 무효', !verifyQuote(brief, '반드시 테스트를 실행한다'));
t('인용 빈값 무효', !verifyQuote(brief, ''));
const good = { items: Object.fromEntries('abcde'.split('').map((k) => [k, { verdict: 'PASS', quote: '버튼 색을 연하게' }])) };
let v = validateJudgeOutput(good, brief, true);
eq('판정 일치 -> needs_human 아님', v.needsHuman, false);
v = validateJudgeOutput(good, brief, false);
eq('regex FAIL vs 판정자 a,c PASS -> needs_human', v.needsHuman, true);
const bad = JSON.parse(JSON.stringify(good));
bad.items.a = { verdict: 'PASS', quote: '지어낸 인용' };
v = validateJudgeOutput(bad, brief, true);
eq('가짜 인용 -> INVALID', v.items.a.verdict, 'INVALID');
eq('INVALID는 needs_human 판단에서 제외', v.needsHuman, false);
const failC = JSON.parse(JSON.stringify(good));
failC.items.c = { verdict: 'FAIL', quote: '버튼 색을 연하게' };
eq('regex PASS vs 판정자 c FAIL -> needs_human', validateJudgeOutput(failC, brief, true).needsHuman, true);
eq('extractJson 코드펜스', extractJson('```json\n{"items":{}}\n```'), { items: {} });

// --- 결과 JSON 구조 ---
an = analyze('s03-agent-backend-good', 'kill_on_decisive');
const refs = { A: { ref: '8008bdb', sha: 'a'.repeat(40) }, B: { ref: 'hold/v1.8.50', sha: 'b'.repeat(40) } };
const row = buildResultRow({
  runId: 'A-04-r1', variant: 'A', refs, caseDef: cases['04'], caseSha: 'x', rep: 1, model: 'sonnet', judgeModel: 'fable', analyzer: an,
  grade: gradeRun(cases['04'], 'A', an), brief: checkBrief(cases['04'], an.firstDecisive.input.prompt),
  proc: { killedBy: 'decisive', killLatencyMs: 40, code: null, signal: 'SIGTERM', wallMs: 1234 }, workdirChanged: [], transcript: 'x.ndjson', startedAt: 'now',
});
for (const k of ['runId', 'variant', 'ref', 'sha', 'caseId', 'caseSha', 'rep', 'model', 'firstAction', 'firstActionDetail', 'verdict', 'label', 'counts', 'brief', 'judge', 'needsHuman', 'killedBy', 'hookSessionStartCount', 'initHasAgent', 'initHasEnterWorktree', 'usage', 'costUsd', 'costSource', 'transcript']) t(`row.${k} 존재`, k in row);
eq('row sha 전체 기록', row.sha.length, 40);
eq('row firstActionDetail', row.firstActionDetail.subagentType, 'backend-dev');
eq('row JSON 직렬화 왕복', JSON.parse(JSON.stringify(row)).runId, 'A-04-r1');

// --- 실행 순서 교대 ---
const plan = buildPlan([cases['01'], cases['02']], ['A', 'B'], 2);
eq('plan 길이', plan.length, 8);
eq('plan 교대', plan.slice(0, 4).map((p) => p.variant).join(''), 'ABBA');
t('plan A/B 각 4회', plan.filter((p) => p.variant === 'A').length === 4);

// --- kill 동작(가짜 claude): 결정적 행동 줄 직후 SIGTERM, 이후 줄 처리 안 함 ---
const fakeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-claude-'));
const sample = path.join(SAMPLES, 's03-agent-backend-good.ndjson');
fs.writeFileSync(path.join(fakeDir, 'claude'), `#!/bin/sh\ncat >/dev/null &\nwhile IFS= read -r line; do printf '%s\\n' "$line"; sleep 0.2; done < "${sample}"\nsleep 60\n`, { mode: 0o755 });
const oldPath = process.env.PATH;
process.env.PATH = `${fakeDir}:${oldPath}`;
const kan = new StreamAnalyzer('kill_on_decisive');
const t0 = Date.now();
const proc = await runClaude({ promptText: 'x', model: 'sonnet', cwd: fakeDir, pluginDir: null, maxBudgetUsd: 1, timeoutMs: 20000, analyzer: kan });
eq('kill: killedBy decisive', proc.killedBy, 'decisive');
t('kill: 신호로 종료(SIGTERM)', proc.signal === 'SIGTERM', `signal=${proc.signal} code=${proc.code}`);
t('kill: 60초 sleep을 기다리지 않음', Date.now() - t0 < 10000, `${Date.now() - t0}ms`);
eq('kill: first Agent:backend-dev', kan.firstAction, 'Agent:backend-dev');
// 타임아웃 경로
const sleepy = new StreamAnalyzer('none');
const proc2 = await runClaude({ promptText: 'x', model: 'sonnet', cwd: fakeDir, pluginDir: null, maxBudgetUsd: 1, timeoutMs: 800, analyzer: sleepy });
eq('timeout: killedBy', proc2.killedBy, 'timeout');
process.env.PATH = oldPath;
fs.rmSync(fakeDir, { recursive: true, force: true });

console.log(`\n단위 검증: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
