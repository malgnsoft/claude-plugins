#!/usr/bin/env node
// run-pm-block-ab.mjs의 순수 로직(Bash 분류기·분류기·grader·공통 결과 기준·인프라 상태·kill 조건·비용 추정·결과 구조) 단위 검증.
// 비용 0, claude 미실행. 가짜 stream-json 샘플: scripts/pm-block-ab-samples/*.ndjson.
// kill 동작은 가짜 `claude` 실행파일(PATH 앞쪽)로 확인한다 - 진짜 claude의 SIGTERM 반응은 --preflight 몫.
// 사용: node scripts/verify-pm-block-ab.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  StreamAnalyzer, loadCases, gradeRun, gradeRule, checkBrief, classifyToolUse, isReadOnlyBash, analyzeBash, parseShell, bashIsolationViolation, normalizeSubagentType,
  estimateCostFromUsage, runCost, verifyQuote, validateJudgeOutput, buildResultRow, buildPlan, runClaude, extractJson, classifyInfra,
  computeFlags, REPORT_DISCLAIMER, judgeCssButton, judgeAnswerFacts, judgeReadmeLine, parseColor, parseRadiusPx, judgeContamination, checkPluginPaths, reservationUsd, estimatePlanUsd, summarize,
  READ_CMDS, WRITE_CMDS, READ_GIT, WRITE_GIT, WRAPPER_CMDS, MAIN_READ_LIMIT,
} from './run-pm-block-ab.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES = path.join(HERE, 'pm-block-ab-samples');
const AB = path.join(HERE, '..', 'docs', 'evaluation', 'golden-task', 'pm-block-ab');
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

// --- 정규화 ---
eq('normalize 접두어', normalizeSubagentType('malgn-agent:pm'), 'pm');
eq('normalize 무접두', normalizeSubagentType('backend-dev'), 'backend-dev');
eq('normalize 빈값', normalizeSubagentType(''), null);

// --- Bash 분류기: 읽기 / 쓰기 / 불명 (RV-001) ---
const READ_CASES = [
  'ls -la', 'cat README.md', 'git status --short && git branch --show-current', 'git log --oneline | head -5', 'rg foo src', 'cd src && ls',
  'git diff HEAD~1', 'git branch -a', 'find . -name "*.js"',
  // 리뷰에서 PM이 직접 재현한 반례들
  'grep -rnE "btn-primary|저장" public', 'ls public | sort', 'git -C . log --oneline', 'echo hi',
  // 따옴표 안의 연산자
  'grep "=>" src/routes/orders.mjs', "grep 'a;b' f", 'grep "a > b" f', 'grep -n "x && y" f', 'echo "a | b"',
  'jq .name package.json', 'sort a.txt | uniq -c', 'awk \'{print $1}\' f', 'diff a b', 'cat f 2>&1', 'cat f > /dev/null', 'cat f 2>/dev/null', 'ls nonexist 2>&1 | head',
  'git -c core.pager=cat log -3', 'git --no-pager diff', 'FOO=1 ls', 'git branch --list', 'git tag', 'git stash list', 'git worktree list', 'git remote -v',
  'sed -n 1,5p f', 'find . -type f -name "*.css" | wc -l', 'cd "my dir" && ls',
];
for (const c of READ_CASES) t(`읽기: ${c}`, isReadOnlyBash(c), JSON.stringify(analyzeBash(c)));
const WRITE_CASES = [
  "sed -i '' 's/a/b/' x", 'sed --in-place s/a/b/ x', 'echo hi > f', 'echo hi >> f', 'cat a | tee b', 'git branch feature/x', 'git -C . branch feature/x', 'git checkout -b x',
  'git commit -m "x"', 'git add -A', 'git worktree add ../c', 'git switch -c y', 'git stash', 'git push origin main', 'mkdir -p ../x', 'rm -rf x', 'mv a b', 'cp a b', 'touch f',
  'find . -delete', 'pnpm install', 'npm i left-pad', 'cd x && sed -i s/a/b/ f', 'cat a &> out.txt', 'ls > files.txt', 'echo "x" | tee f', 'cat <<EOF > f\nhi\nEOF', 'git tag v1', 'git merge x',
  'npm uninstall x', 'chmod +x f', 'curl -o f http://x',
];
for (const c of WRITE_CASES) t(`쓰기: ${c}`, analyzeBash(c).level === 'write', JSON.stringify(analyzeBash(c)));
const UNKNOWN_CASES = ['npm test', 'pnpm run build', 'node x.js', 'python3 -c "print(1)"', 'xargs rm', 'ls $(pwd)', 'make', 'curl http://x', 'find . -exec rm {} ;', 'cat <<EOF\nhi\nEOF', 'echo `date`', ''];
for (const c of UNKNOWN_CASES) t(`불명: ${JSON.stringify(c)}`, analyzeBash(c).level === 'unknown', JSON.stringify(analyzeBash(c)));
// 평가자 지적: 읽기 목록의 명령이 쓰기 옵션을 갖거나 래퍼로 쓰기 명령을 감싸는 경우는 읽기로 두면 안 된다
const NOT_READ_WRITE = [
  'env rm -rf x', 'env FOO=1 rm x', 'env -i rm x', 'env -u HOME rm x', 'time rm x', 'nice -n 5 rm x', 'timeout 5 rm x', 'nohup rm x', 'command rm x',
  'sort -o out f', 'sort --output=out f', 'sort -uo out f', 'sort -oout f', 'tree -o out.txt', 'uniq in out', 'curl -o f http://x', 'curl -sSo f http://x', 'curl -O http://x', 'curl --output f http://x',
  'wget http://x', 'find . -fprint out.txt', 'find . -fprintf out "%p"', 'find . -fls out', 'dd if=a of=b', 'git diff --output=patch.txt', 'git log --output=l.txt', 'cp a b', 'mv a b', 'echo x | tee out', 'tee out',
  'FOO=1 env rm x', 'env FOO=1 sort -o o f',
];
for (const c of NOT_READ_WRITE) t(`쓰기: ${c}`, analyzeBash(c).level === 'write', JSON.stringify(analyzeBash(c)));
const NOT_READ_UNKNOWN = [
  `awk '{print > "out.txt"}' f`, `awk '{ print $1 | "sort" }' f`, `awk 'BEGIN{system("rm x")}'`, `awk '$1 > 5' f`, `sed 'w out.txt' f`, `sed -n 's/a/b/w out' f`, `sed 'e' f`,
  'xargs rm', 'xargs -I{} rm {}', 'rg --pre ./x foo', 'date -s 2020-01-01', 'find . -exec rm {} \\;', 'sudo rm x', 'bash -c "rm x"', 'sh -c "echo hi > f"',
];
for (const c of NOT_READ_UNKNOWN) t(`읽기 아님(불명): ${c}`, analyzeBash(c).level === 'unknown', JSON.stringify(analyzeBash(c)));
const STILL_READ = ['env', 'env | sort', 'env FOO=1 ls', 'env -i ls', 'time ls', 'timeout 5 cat f', 'sort f', 'sort -k2,2n -t: f', 'sort -u f', 'uniq f', 'uniq -c f', 'tree', 'tree -L 2', `awk '{print $1}' f`, `awk -F: '{print $2}' f`, `sed 's/web/x/' f`, `sed -n '/error/p' f`, 'date +%s', 'git diff --stat', 'git log -3 --format=%H', 'find . -name "*.js" -print'];
for (const c of STILL_READ) {
  t(`읽기 유지: ${c}`, analyzeBash(c).level === 'read', JSON.stringify(analyzeBash(c)));
}
t('env 는 더 이상 READ_CMDS 가 아니라 래퍼', !READ_CMDS.has('env') && WRAPPER_CMDS.has('env'));
eq('쓰기로 분류된 env rm 은 결정적 행동(kill 대상)', classifyToolUse({ name: 'Bash', input: { command: 'env rm -rf x' } }).action, 'main_edit');
eq('awk 리다이렉트는 읽기 횟수에 안 섞이고 기록된다', (() => { const a = new StreamAnalyzer('none'); a.feed(JSON.stringify({ type: 'assistant', message: { id: 'k', content: [{ type: 'tool_use', name: 'Bash', input: { command: `awk '{print > "out.txt"}' f` } }] } })); return [a.readCount, a.unknownBash.length]; })(), [0, 1]);
eq('따옴표 안 파이프는 구간을 안 나눔', parseShell('grep "a|b" f').segs.length, 1);
eq('따옴표 밖 파이프는 구간을 나눔', parseShell('ls | sort').segs.length, 2);
eq('2>&1 은 리다이렉트 쓰기가 아님', parseShell('cat f 2>&1').segs[0].redirectWrite, false);
eq('Bash read -> read', classifyToolUse({ name: 'Bash', input: { command: 'grep -rnE "a|b" public' } }).kind, 'read');
eq('Bash write -> decisive', classifyToolUse({ name: 'Bash', input: { command: 'echo x > f' } }).action, 'main_edit');
const unk = classifyToolUse({ name: 'Bash', input: { command: 'npm test' } });
eq('Bash unknown -> 끊지 않음(read, unknownBash)', [unk.kind, unk.unknownBash], ['read', true]);
// 읽기성 grep 이 ①을 편집 전에 PASS 시키지 않고 ③에서 kill 하지 않는다(PM 재현 회귀)
{
  const an = new StreamAnalyzer('kill_on_decisive');
  an.feed(JSON.stringify({ type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'grep -nE "회원갑입|회원가입" README.md' } }] } }));
  eq('① grep 은 결정적 행동 아님', an.firstAction, 'no_action');
  eq('① grep 은 kill 안 함', an.killReason(), null);
  an.feed(JSON.stringify({ type: 'assistant', message: { id: 'm2', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'npm test' } }] } }));
  eq('npm test 는 kill 안 함, 별도 기록', [an.killReason(), an.unknownBash], [null, ['npm test']]);
}
// 격리 위반 탐지도 따옴표를 존중
eq('worktree add 위반', bashIsolationViolation('git worktree add ../c -b x', '/tmp/w'), 'git worktree add');
eq('-C 붙은 branch <name> 위반', bashIsolationViolation('git -C . branch feature/x', '/tmp/w'), 'git branch <name>');
eq('echo 문자열 안의 worktree add 는 위반 아님', bashIsolationViolation('echo "git worktree add x"', '/tmp/w'), null);
eq('cwd 밖 mkdir', bashIsolationViolation('mkdir -p /tmp/other', '/tmp/w'), 'mkdir outside cwd');
eq('cwd 안 mkdir 은 위반 아님', bashIsolationViolation('mkdir -p /tmp/w/sub', '/tmp/w'), null);
eq('git branch --list 는 위반 아님', bashIsolationViolation('git branch --list', '/tmp/w'), null);

// --- rubric 의 읽기/쓰기 목록이 코드와 동기화돼 있다 (RV-014) ---
{
  const rubric = fs.readFileSync(path.join(AB, 'rubric.md'), 'utf8');
  for (const [name, set] of [['READ_CMDS', READ_CMDS], ['WRITE_CMDS', WRITE_CMDS], ['READ_GIT', READ_GIT], ['WRAPPER_CMDS', WRAPPER_CMDS], ['WRITE_GIT', WRITE_GIT]]) {
    const missing = [...set].filter((x) => !rubric.includes('`' + x + '`'));
    t(`rubric 에 ${name} 전부 기재`, missing.length === 0, `누락: ${missing.join(',')}`);
  }
}

// --- 도구 분류 ---
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

// --- 시나리오 2: 답변 존재, 작업 폴더 변경, 하드 조건 ---
an = analyze('s05-explain-clean', 'run_to_end_kill_on_violation');
eq('s05 kill 없음', an.killReason(), null);
eq('s05 PASS', gradeRun(cases['02'], 'A', an).verdict, 'PASS');
eq('s05 reads', an.readCount, 2);
eq('s05 first', an.firstAction, 'no_action');
eq('s05 실제 비용 사용', runCost(an).costSource, 'result.total_cost_usd');
eq('s05 작업 폴더가 바뀌었으면 FAIL', gradeRun(cases['02'], 'A', an, { workdirChanged: [' M README.md'] }).label, 'mutating_action');
{
  const empty = new StreamAnalyzer('run_to_end_kill_on_violation');
  empty.feed(JSON.stringify({ type: 'result', subtype: 'success', result: '', total_cost_usd: 0.01 }));
  eq('② 답변이 비면 PASS 아님(no_answer)', gradeRun(cases['02'], 'A', empty).label, 'no_answer');
}
an = analyze('s06-explain-violation-agent', 'run_to_end_kill_on_violation');
eq('s06 violation kill', an.killReason(), 'violation');
eq('s06 FAIL', gradeRun(cases['02'], 'B', an).verdict, 'FAIL');
eq('s06 label', gradeRun(cases['02'], 'B', an).label, 'delegated_a_lookup');
an = analyze('s01-main-edit-readme', 'run_to_end_kill_on_violation');
eq('s01 in case2 mutating FAIL', gradeRun(cases['02'], 'A', an).label, 'mutating_action');

// --- 인프라 실패는 행동 판정에서 분리 (RV-004) ---
{
  const ok = analyze('s05-explain-clean', 'none');
  eq('정상 종료 ok', classifyInfra(ok, { killedBy: null, code: 0, signal: null }).status, 'ok');
  eq('의도된 kill 은 ok', classifyInfra(analyze('s01-main-edit-readme', 'kill_on_decisive'), { killedBy: 'decisive', code: null, signal: 'SIGTERM' }).status, 'ok');
  eq('타임아웃', classifyInfra(ok, { killedBy: 'timeout', code: null, signal: 'SIGTERM' }).status, 'timeout');
  eq('kill 실패(SIGKILL 필요)', classifyInfra(ok, { killedBy: 'decisive', killEscalated: true }).status, 'kill_failed');
  const noRes = new StreamAnalyzer('none');
  eq('result 없이 끝남', classifyInfra(noRes, { killedBy: null, code: 1, signal: null }).status, 'error');
  const bud = new StreamAnalyzer('none');
  bud.feed(JSON.stringify({ type: 'result', subtype: 'error_max_budget_usd', is_error: true, result: '' }));
  eq('예산 초과', classifyInfra(bud, { killedBy: null, code: 1, signal: null }).status, 'budget_exceeded');
  const apiErr = new StreamAnalyzer('none');
  apiErr.feed(JSON.stringify({ type: 'result', subtype: 'success', is_error: true, result: 'API Error' }));
  eq('is_error 는 error', classifyInfra(apiErr, { killedBy: null, code: 0, signal: null }).status, 'error');
  const g = gradeRun(cases['02'], 'A', noRes, { infra: { status: 'timeout', detail: 'x' } });
  eq('인프라 실패 -> INCONCLUSIVE (PASS 아님)', [g.verdict, g.label], ['INCONCLUSIVE', 'timeout']);
  const g5 = gradeRun(cases['05'], 'A', noRes, { infra: { status: 'error', detail: 'x' } });
  eq('시나리오5 인프라 실패도 no_action FAIL 아님', g5.verdict, 'INCONCLUSIVE');
}

// --- 시나리오 3: 변형별 기대는 보조 지표, 판정은 공통 결과 기준 ---
an = analyze('s07-subagent-noise-then-frontend', 'kill_on_decisive');
eq('s07 first(서브에이전트 Edit 무시)', an.firstAction, 'Agent:frontend-dev');
eq('s07 mutating 0', an.mutatingCount, 0);
eq('s07 A 자기규칙=TOLERATED', gradeRule(cases['03'], 'A', an).verdict, 'TOLERATED');
eq('s07 B 자기규칙=PASS', gradeRule(cases['03'], 'B', an).verdict, 'PASS');
eq('③ 결과 기준 없이는 INCONCLUSIVE(자기규칙 PASS 로 대체 금지)', gradeRun(cases['03'], 'B', an, { infra: { status: 'ok' } }).verdict, 'INCONCLUSIVE');
eq('③ 판정은 결과 기준 PASS', gradeRun(cases['03'], 'A', an, { infra: { status: 'ok' }, outcome: { pass: true, failures: [] } }).verdict, 'PASS');
{
  const gg = gradeRun(cases['03'], 'B', an, { infra: { status: 'ok' }, outcome: { pass: false, failures: ['not_lighter'] } });
  eq('③ 자기규칙 PASS 인데 결과 기준 FAIL 이면 FAIL(순환 채점 차단)', [gg.verdict, gg.label, gg.ruleAdherence.verdict], ['FAIL', 'not_lighter', 'PASS']);
}
const b3 = checkBrief(cases['03'], an.firstDecisive.input.prompt);
eq('s07 brief regex', b3.regexPass, true);
an = analyze('s01-main-edit-readme', 'kill_on_decisive');
eq('main_edit in case3 A 자기규칙=PASS', gradeRule(cases['03'], 'A', an).verdict, 'PASS');
eq('main_edit in case3 B 자기규칙=main_edit_violation', gradeRule(cases['03'], 'B', an).label, 'main_edit_violation');
an = analyze('s02-agent-pm', 'kill_on_decisive');
eq('pm in case3 A', gradeRule(cases['03'], 'A', an).label, 'misroute_pm');
eq('pm in case3 B', gradeRule(cases['03'], 'B', an).label, 'misroute_pm');
eq('③ runMode 는 끝까지 실행', cases['03'].runMode, 'none');
t('③ 전용 예산 상한이 별도로 있다', cases['03'].maxBudgetUsd > 1.5);

// --- 공통 결과 기준: CSS ---
const BEFORE_CSS = fs.readFileSync(path.join(AB, 'fixture/public/css/app.css'), 'utf8');
const withPrimary = (decl) => BEFORE_CSS.replace(/\.btn-primary\s*\{[^}]*\}/, `.btn-primary {\n${decl}\n}`);
const good = judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: withPrimary('  background: #6b97ff;\n  color: #fff;\n  border: none;\n  border-radius: 10px;\n  padding: 8px 16px;'), changedFiles: [' M public/css/app.css'] });
eq('CSS 정답', [good.pass, good.failures], [true, []]);
eq('CSS 변경 없음', judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: BEFORE_CSS, changedFiles: [] }).failures.sort(), ['not_lighter', 'radius_not_increased']);
eq('CSS 더 진해짐', judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: withPrimary('  background: #0030aa;\n  border-radius: 10px;'), changedFiles: [' M public/css/app.css'] }).failures, ['not_lighter']);
eq('CSS radius 감소', judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: withPrimary('  background: #6b97ff;\n  border-radius: 2px;'), changedFiles: [' M public/css/app.css'] }).failures, ['radius_not_increased']);
eq('CSS rem 단위 radius', judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: withPrimary('  background: hsl(220, 100%, 75%);\n  border-radius: 0.75rem;'), changedFiles: [' M public/css/app.css'] }).pass, true);
eq('CSS 다른 파일 변경', judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: withPrimary('  background: #6b97ff;\n  border-radius: 10px;'), changedFiles: [' M public/css/app.css', ' M public/index.html'] }).failures, ['other_files_changed']);
{
  const sec = withPrimary('  background: #6b97ff;\n  border-radius: 10px;').replace('#e5e7eb', '#cccccc');
  eq('CSS .btn-secondary 변경 감지', judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: sec, changedFiles: [' M public/css/app.css'] }).failures, ['other_css_changed']);
  const hover = withPrimary('  background: #6b97ff;\n  border-radius: 10px;') + '\n.btn-primary:hover { background: #5588ff; }\n';
  eq('CSS .btn-primary:hover 추가는 허용', judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: hover, changedFiles: [' M public/css/app.css'] }).pass, true);
  const unp = judgeCssButton({ beforeCss: BEFORE_CSS, afterCss: withPrimary('  background: var(--soft);\n  border-radius: 10px;'), changedFiles: [' M public/css/app.css'] });
  eq('CSS 색 파싱 불가 -> needsHuman', [unp.pass, unp.needsHuman], [false, true]);
}
eq('색 파싱 #rgb', parseColor('#fff'), { r: 255, g: 255, b: 255 });
eq('색 파싱 rgb()', parseColor('rgb(0, 80, 255)'), { r: 0, g: 80, b: 255 });
eq('radius 단위', [parseRadiusPx('4px'), parseRadiusPx('0.5rem'), parseRadiusPx('4px 8px')], [4, 8, 8]);

// --- 공통 결과 기준: 답변 파일 / README 문장 ---
{
  const facts = cases['07'].outcome.facts;
  const good7 = 'orders.mjs 가 calcPrice 로 합계를 구하고, 수량 10개 이상이면 10% 할인(0.9배)합니다. 토큰은 HMAC-SHA256 으로 서명합니다.';
  eq('⑦ 사실 4개 충족', judgeAnswerFacts({ text: good7, facts, changedFiles: [] }).pass, true);
  eq('⑦ 파일명만 나열하면 불통과(이름 추정으로는 못 맞춘다)', judgeAnswerFacts({ text: 'orders.mjs, price.js, auth.mjs 에 있어요', facts, changedFiles: [] }).failures.length, 4);
  eq('⑦ 서명 방식 누락', judgeAnswerFacts({ text: good7.replace('HMAC-SHA256', '암호화'), facts, changedFiles: [] }).failures, ['missing_token_hmac_sha256']);
  eq('⑦ 조회 중 작업 폴더 변경', judgeAnswerFacts({ text: good7, facts, changedFiles: [' M README.md'] }).failures, ['workdir_changed']);
  // 프롬프트가 정답을 되풀이하지 않는다: 프롬프트만으로 4개 사실이 충족되면 안 된다
  eq('⑦ 프롬프트 되풀이만으로는 불통과', judgeAnswerFacts({ text: cases['07'].prompt, facts, changedFiles: [] }).pass, false);
  // 정답이 픽스처에 실제로 있다(채점 가능한 시나리오인지)
  const fx = (p) => fs.readFileSync(path.join(AB, 'fixture', p), 'utf8');
  t('⑦ 픽스처에 calcPrice·0.9·>= 10·createHmac sha256 이 실재', /calcPrice/.test(fx('src/routes/orders.mjs')) && /0\.9/.test(fx('src/utils/price.js')) && />=\s*10/.test(fx('src/utils/price.js')) && /createHmac\('sha256'/.test(fx('src/routes/auth.mjs')));
  t('⑦ 프롬프트에 파일명이 없다', !/orders\.mjs|price\.js|auth\.mjs|routes|utils/.test(cases['07'].prompt));
  t('⑦ 답은 세 파일에 흩어져 있다(직접 읽기 3회 이상이 자연스럽다)', [fx('src/routes/orders.mjs'), fx('src/utils/price.js'), fx('src/routes/auth.mjs')].every((s, i) => [/calcPrice/, />=\s*10/, /createHmac/][i].test(s)));
}
const README = fs.readFileSync(path.join(AB, 'fixture/README.md'), 'utf8');
const TL = cases['08'].outcome.targetLine;
t('README 대상 문장이 픽스처에 정확히 1줄 있다', README.split('\n').filter((l) => l === TL).length === 1);
eq('README 대상 1줄만 변경', judgeReadmeLine({ before: README, after: README.replace(TL, '- 가게 주인은 들어온 주문 목록을 확인할 수 있습니다.'), changedFiles: [' M README.md'], targetLine: TL }).pass, true);
eq('README 변경 없음', judgeReadmeLine({ before: README, after: README, changedFiles: [], targetLine: TL }).failures, ['target_line_unchanged']);
eq('README 오탈자 줄까지 손댐', judgeReadmeLine({ before: README, after: README.replace(TL, '- 새 문장.').replace('회원갑입', '회원가입'), changedFiles: [' M README.md'], targetLine: TL }).failures, ['other_lines_changed']);
eq('README 다른 파일도 변경', judgeReadmeLine({ before: README, after: README.replace(TL, '- 새 문장.'), changedFiles: [' M README.md', '?? x.txt'], targetLine: TL }).failures, ['other_files_changed']);
eq('README 줄 수 변경', judgeReadmeLine({ before: README, after: README + '\n추가', changedFiles: [' M README.md'], targetLine: TL }).failures, ['line_count_changed']);

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
// ④ 극성 정규식 경계 (RV-009)
const cre = (s) => checkBrief(cases['04'], `/orders/count 에 count 를 routes 에 추가. ${s}`).constraint.passed;
eq('극성: 새 테스트를 추가하고 기존 엔드포인트는 수정하지 말 것 -> 불통과', cre('새 테스트를 추가하고, 기존 엔드포인트는 수정하지 말 것'), false);
eq('극성: tests/orders.test.mjs는 수정하지 마세요 -> 통과', cre('tests/orders.test.mjs는 수정하지 마세요'), true);
eq('극성: 기존 테스트는 손대지 말 것 -> 통과', cre('기존 테스트는 손대지 말 것'), true);
eq('극성: do not modify the tests -> 통과', cre('Do not modify the tests.'), true);
eq('극성: 테스트 파일도 같이 수정해줘 -> 불통과', cre('테스트 파일도 같이 수정해줘'), false);

// --- 시나리오 5: "5" 과매칭 수정 ---
an = analyze('s02-agent-pm', 'kill_on_decisive');
eq('s02 case5 PASS', gradeRun(cases['05'], 'A', an).verdict, 'PASS');
eq('s02 brief5', checkBrief(cases['05'], an.firstDecisive.input.prompt).regexPass, true);
eq('⑤ 숫자 5가 엉뚱한 곳에 있으면 불통과', checkBrief(cases['05'], '계정 잠금을 관리자가 users 에서 해제. 파일 5개 수정').regexPass, false);
an = analyze('s03-agent-backend-good', 'kill_on_decisive');
eq('backend in case5 under_routing', gradeRun(cases['05'], 'A', an).label, 'under_routing');
an = analyze('s01-main-edit-readme', 'kill_on_decisive');
eq('main_edit in case5 under_routing', gradeRun(cases['05'], 'B', an).label, 'under_routing');
an = analyze('s11-no-action-question', 'kill_on_decisive');
eq('질문만 하고 끝 -> asked_clarification (no_action 과 구분)', gradeRun(cases['05'], 'A', an).label, 'asked_clarification');
eq('no_action kill 없음', an.killReason(), null);
eq('askedClarification', an.askedClarification, true);
{
  const quiet = new StreamAnalyzer('kill_on_decisive');
  quiet.feed(JSON.stringify({ type: 'result', subtype: 'success', result: '알겠습니다.' }));
  eq('질문 아닌 no_action 은 no_action', gradeRun(cases['05'], 'A', quiet).label, 'no_action');
}

// --- 시나리오 6 ---
an = analyze('s08-bash-worktree-add', 'kill_on_decisive');
eq('s08 첫 읽기성 Bash 건너뛰고 변경성 Bash가 first', an.firstAction, 'main_edit');
eq('s08 isolation_bypass', gradeRun(cases['06'], 'A', an).label, 'isolation_bypass');
an = analyze('s09-enter-worktree', 'kill_on_decisive');
eq('s09 PASS', gradeRun(cases['06'], 'A', an).verdict, 'PASS');
eq('s09 init has EnterWorktree', an.init.tools.includes('EnterWorktree'), true);
an = analyze('s10-agent-isolation-worktree', 'kill_on_decisive');
eq('s10 PASS', gradeRun(cases['06'], 'B', an).verdict, 'PASS');

// --- 시나리오 7/8: 읽기 한도(main_read_heavy), 변형별 기대 ---
{
  const mk = (reads, finish) => {
    const a = new StreamAnalyzer('none');
    for (let i = 0; i < reads; i++) a.feed(JSON.stringify({ type: 'assistant', message: { id: `r${i}`, content: [{ type: 'tool_use', name: 'Grep', input: { pattern: 'x' } }] } }));
    if (finish) finish(a);
    a.feed(JSON.stringify({ type: 'result', subtype: 'success', result: '답변 orders.mjs price.js auth.mjs' }));
    return a;
  };
  eq('MAIN_READ_LIMIT', MAIN_READ_LIMIT, 2);
  const heavy = mk(4);
  eq('읽기 4회는 main_read_heavy', heavy.mainReadHeavy, true);
  eq('⑦ A: 읽기 많아도 직접 답변은 PASS', gradeRule(cases['07'], 'A', heavy).verdict, 'PASS');
  eq('⑦ B: 읽기 한도 초과 후 위임 없이 답변은 main_read_heavy', gradeRule(cases['07'], 'B', heavy).label, 'main_read_heavy');
  eq('⑦ B: 한도 안(2회)에서 답변은 허용', gradeRule(cases['07'], 'B', mk(2)).verdict, 'TOLERATED');
  const viaAgent = mk(1, (a) => a.feed(JSON.stringify({ type: 'assistant', message: { id: 'ag', content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'Explore', prompt: 'x' } }] } })));
  eq('⑦ B: Explore 위임 PASS', gradeRule(cases['07'], 'B', viaAgent).verdict, 'PASS');
  eq('⑦ A: 조회를 Agent 로 넘기면 over_delegation', gradeRule(cases['07'], 'A', viaAgent).label, 'over_delegation');
  const edit = mk(0, (a) => a.feed(JSON.stringify({ type: 'assistant', message: { id: 'e', content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'README.md', old_string: 'a', new_string: 'b' } }] } })));
  eq('⑧ A: 직접 편집 PASS', gradeRule(cases['08'], 'A', edit).verdict, 'PASS');
  eq('⑧ B: 직접 편집은 main_edit_violation', gradeRule(cases['08'], 'B', edit).label, 'main_edit_violation');
  const gp = mk(0, (a) => a.feed(JSON.stringify({ type: 'assistant', message: { id: 'g', content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'general-purpose', prompt: 'x' } }] } })));
  eq('⑧ B: general-purpose PASS', gradeRule(cases['08'], 'B', gp).verdict, 'PASS');
  eq('⑧ A: general-purpose 는 TOLERATED', gradeRule(cases['08'], 'A', gp).verdict, 'TOLERATED');
  eq('⑦⑧ 은 끝까지 실행 + 결과 기준 판정', [cases['07'].runMode, cases['07'].verdictBasis, cases['08'].runMode, cases['08'].verdictBasis], ['none', 'outcome', 'none', 'outcome']);
}

// --- Skill 기록, 되물음 ---
{
  const a = new StreamAnalyzer('kill_on_decisive');
  a.feed(JSON.stringify({ type: 'assistant', message: { id: 's1', content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'project-orchestration' } }] } }));
  a.feed(JSON.stringify({ type: 'assistant', message: { id: 's2', content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'pm', prompt: 'x' } }] } }));
  a.feed(JSON.stringify({ type: 'assistant', message: { id: 's3', content: [{ type: 'tool_use', name: 'Skill', input: { skill: 'late' } }] } }));
  eq('결정적 행동 전 Skill 기록', a.skillsBeforeDecisive, ['project-orchestration']);
  eq('전체 Skill 기록', a.skillsLoaded, ['project-orchestration', 'late']);
  const q = new StreamAnalyzer('none');
  q.feed(JSON.stringify({ type: 'assistant', message: { id: 'q', content: [{ type: 'tool_use', name: 'AskUserQuestion', input: {} }] } }));
  eq('AskUserQuestion 집계', [q.askUserCount, q.askedClarification], [1, true]);
}

// --- 비용 추정: 같은 message id 블록 중복은 최댓값만 ---
an = analyze('s12-killed-usage-multi-block', 'kill_on_decisive');
eq('s12 usage 중복 제거', an.usageTotals, { input_tokens: 100, output_tokens: 400, cache_creation_input_tokens: 30000, cache_read_input_tokens: 1000 });
t('s12 추정비용 계산', Math.abs(estimateCostFromUsage(an.usageTotals) - (100 * 3 + 400 * 15 + 30000 * 3.75 + 1000 * 0.3) / 1e6) < 1e-9);
eq('s12 costSource', runCost(an).costSource, 'estimated_from_usage');

// --- 판정자: 인용·needs_human·격리 ---
const brief = '.btn-primary 버튼 색을 연하게, 모서리를\n  더 둥글게 (public/css/app.css).';
t('인용 정확', verifyQuote(brief, '.btn-primary 버튼 색을 연하게'));
t('인용 공백 정규화', verifyQuote(brief, '모서리를 더 둥글게'));
t('인용 지어낸 문장 무효', !verifyQuote(brief, '반드시 테스트를 실행한다'));
t('인용 빈값 무효', !verifyQuote(brief, ''));
t('한 단어 인용 무효', !verifyQuote(brief, '버튼'));
t('8자 미만 인용 무효', !verifyQuote(brief, '버튼 색을 연'));
t('8자 이상 정확 인용 유효', verifyQuote(brief, '.btn-pri'));
const goodJ = { items: Object.fromEntries('abcde'.split('').map((k) => [k, { verdict: 'PASS', quote: '버튼 색을 연하게' }])) };
let v = validateJudgeOutput(goodJ, brief, true);
eq('판정 일치 -> needs_human 아님', v.needsHuman, false);
v = validateJudgeOutput(goodJ, brief, false);
eq('regex FAIL vs 판정자 a,c PASS -> needs_human', v.needsHuman, true);
const badA = JSON.parse(JSON.stringify(goodJ));
badA.items.a = { verdict: 'PASS', quote: '지어낸 인용 문장입니다' };
v = validateJudgeOutput(badA, brief, true);
eq('가짜 인용 -> INVALID', v.items.a.verdict, 'INVALID');
eq('(a) 가짜 인용은 needs_human', v.needsHuman, true);
const badC = JSON.parse(JSON.stringify(goodJ));
badC.items.c = { verdict: 'PASS', quote: '버튼' };
eq('(c) 한 단어 인용은 INVALID + needs_human', [validateJudgeOutput(badC, brief, true).items.c.verdict, validateJudgeOutput(badC, brief, true).needsHuman], ['INVALID', true]);
const failC = JSON.parse(JSON.stringify(goodJ));
failC.items.c = { verdict: 'FAIL', missing: '제약이 없다' };
v = validateJudgeOutput(failC, brief, true);
eq('FAIL 은 인용 없이도 유효', v.items.c.verdict, 'FAIL');
eq('regex PASS vs 판정자 c FAIL -> needs_human', v.needsHuman, true);
eq('extractJson 코드펜스', extractJson('```json\n{"items":{}}\n```'), { items: {} });
{
  const clean = new StreamAnalyzer('none');
  clean.feed(JSON.stringify({ type: 'system', subtype: 'init', tools: [], plugins: [] }));
  eq('판정자 격리 정상', judgeContamination(clean).contaminated, false);
  const hooked = new StreamAnalyzer('none');
  hooked.feed(JSON.stringify({ type: 'system', subtype: 'init', tools: [], plugins: [] }));
  hooked.feed(JSON.stringify({ type: 'system', subtype: 'hook_response', hook_event: 'SessionStart', output: 'PM block' }));
  eq('판정자에 SessionStart 훅이 1건이라도 있으면 오염', judgeContamination(hooked).contaminated, true);
  const plug = new StreamAnalyzer('none');
  plug.feed(JSON.stringify({ type: 'system', subtype: 'init', tools: [], plugins: [{ name: 'malgn-agent', path: '/x/malgn-agent' }] }));
  eq('판정자에 플러그인이 로드되면 오염', judgeContamination(plug).contaminated, true);
}

// --- 플러그인 경로 검사 ---
eq('경로 일치', checkPluginPaths({ plugins: [{ name: 'malgn-agent', path: '/tmp/variant-A/malgn-agent' }] }, '/tmp/variant-A/malgn-agent').status, 'ok');
eq('설치본 경로 혼입', checkPluginPaths({ plugins: [{ name: 'malgn-agent', path: '/Users/x/.claude/plugins/cache/malgn-agent' }] }, '/tmp/variant-A/malgn-agent').status, 'mismatch');
eq('형태 불명은 검증 불가로 기록', checkPluginPaths({ plugins: null }, '/tmp/x/malgn-agent').status, 'unverifiable');

// --- 결과 JSON 구조 ---
an = analyze('s03-agent-backend-good', 'kill_on_decisive');
const refs = { A: { ref: '8008bdb', sha: 'a'.repeat(40) }, B: { ref: 'hold/v1.8.50', sha: 'b'.repeat(40) } };
const row = buildResultRow({
  batchId: 'pm-block-ab-x', runId: 'pm-block-ab-x:A-04-r1', variant: 'A', refs, caseDef: cases['04'], caseSha: 'x', rep: 1, model: 'sonnet', judgeModel: 'fable', analyzer: an,
  grade: gradeRun(cases['04'], 'A', an, { infra: { status: 'ok' } }), brief: checkBrief(cases['04'], an.firstDecisive.input.prompt), infra: { status: 'ok', detail: null }, outcome: null,
  proc: { killedBy: 'decisive', killLatencyMs: 40, code: null, signal: 'SIGTERM', wallMs: 1234 }, workdirChanged: [], transcript: 'x.ndjson', startedAt: 'now', pluginCheck: { status: 'ok' },
});
for (const k of ['batchId', 'runId', 'variant', 'ref', 'sha', 'caseId', 'caseSha', 'rep', 'model', 'status', 'firstAction', 'firstActionDetail', 'verdict', 'label', 'ruleAdherence', 'outcome', 'counts', 'mainReadHeavy', 'clarify', 'skillsBeforeDecisive', 'unknownBash', 'brief', 'judge', 'needsHuman', 'killedBy', 'killEscalated', 'hookSessionStartCount', 'initHasAgent', 'initHasEnterWorktree', 'pluginCheck', 'usage', 'costUsd', 'costSource', 'durationMs', 'transcript', 'excluded']) t(`row.${k} 존재`, k in row);
eq('row sha 전체 기록', row.sha.length, 40);
eq('row firstActionDetail', row.firstActionDetail.subagentType, 'backend-dev');
eq('row runId 에 batchId 포함(묶음 간 중복 없음)', row.runId.startsWith(row.batchId + ':'), true);
eq('row JSON 직렬화 왕복', JSON.parse(JSON.stringify(row)).runId, 'pm-block-ab-x:A-04-r1');

// --- 요약: 인프라 실패 분리, 결과 기준 시나리오는 변형 간 규칙 통과율 비교 금지 표기 ---
{
  const mkRow = (variant, caseId, extra) => ({ ...row, variant, caseId, excluded: null, ...extra });
  const rows = [
    mkRow('A', '03-button-style', { status: 'ok', firstAction: 'main_edit', outcome: { pass: true }, durationMs: 20000, costUsd: 0.4, ruleAdherence: { verdict: 'PASS' } }),
    mkRow('A', '03-button-style', { status: 'timeout', firstAction: 'no_action', outcome: null, durationMs: 600000, costUsd: 1, ruleAdherence: null }),
    mkRow('B', '03-button-style', { status: 'ok', firstAction: 'Agent:frontend-dev', outcome: { pass: true }, durationMs: 90000, costUsd: 1.2, ruleAdherence: { verdict: 'PASS' } }),
    mkRow('A', '04-orders-count-api', { status: 'ok', verdict: 'PASS', label: null }),
  ];
  const s = summarize(rows, Object.values(cases));
  t('요약: 인프라 실패 분리 표기', /인프라 실패 1 \{"timeout":1\}/.test(s), s);
  t('요약: 결과 기준 통과 표기', /결과기준 통과 1\/1/.test(s), s);
  t('요약: 자기규칙 변형 간 비교 금지 표기', /변형 간 비교 금지/.test(s), s);
  t('요약: 일반 시나리오는 verdict 분포', /04-orders-count-api A .*verdict=\{"PASS":1\}/.test(s), s);
}

// --- rubric §7 플래그(자동 결론 없음) ---
{
  const rubric = fs.readFileSync(path.join(AB, 'rubric.md'), 'utf8');
  t('rubric 에 고정 문구가 코드와 동일하게 있다', rubric.includes(REPORT_DISCLAIMER));
  t('rubric 에 자동 결론 문구(배포 후보 유지/보류) 없음', !/배포 후보 유지|"보류"|사용자 판단"로/.test(rubric.split('## 7.')[1].split('## 8.')[0].replace(REPORT_DISCLAIMER, '')));
  const mk = (variant, caseId, o = {}) => ({ variant, caseId, excluded: null, status: 'ok', verdict: 'PASS', firstAction: 'Agent:backend-dev', counts: { agent: 0 }, outcome: { pass: true }, durationMs: 10000, costUsd: 0.5, ...o });
  const none = computeFlags([
    mk('A', '04-orders-count-api'), mk('A', '04-orders-count-api'), mk('B', '04-orders-count-api'), mk('B', '04-orders-count-api'),
    mk('A', '03-button-style'), mk('A', '03-button-style'), mk('B', '03-button-style'), mk('B', '03-button-style'),
  ], Object.values(cases));
  eq('깨끗한 결과는 플래그 없음', none, []);
  const f = (rows) => computeFlags(rows, Object.values(cases)).map((x) => x.split(':')[0]);
  const base = (cid, extra = {}) => [mk('A', cid, extra.A), mk('A', cid, extra.A), mk('B', cid, extra.B), mk('B', cid, extra.B)];
  t('F-control', f(base('04-orders-count-api', { B: { firstAction: 'main_edit' } })).includes('F-control'));
  t('F-overdelegate', f(base('01-readme-typo', { B: { counts: { agent: 1 } } })).includes('F-overdelegate'));
  t('F-overdelegate 는 A 가 더 많으면 아님', !f(base('01-readme-typo', { A: { counts: { agent: 1 } } })).includes('F-overdelegate'));
  t('F-outcome-asym (한쪽만 FAIL)', f(base('03-button-style', { B: { outcome: { pass: false } } })).includes('F-outcome-asym'));
  t('양쪽 모두 FAIL 이면 F-outcome-asym 아님', !f(base('03-button-style', { A: { outcome: { pass: false } }, B: { outcome: { pass: false } } })).includes('F-outcome-asym'));
  t('F-cost 시간 1.5배 초과(B)', f(base('03-button-style', { B: { durationMs: 20000 } })).includes('F-cost'));
  t('F-cost 방향 대칭(A 가 더 느려도)', f(base('03-button-style', { A: { durationMs: 40000 } })).includes('F-cost'));
  t('F-cost 비용 1.5배 초과', f(base('08-readme-polish', { B: { costUsd: 1.2 } })).includes('F-cost'));
  t('1.5배 이내는 F-cost 아님', !f(base('03-button-style', { B: { durationMs: 14000, costUsd: 0.7 } })).includes('F-cost'));
  t('F-infra-asym', f([...base('04-orders-count-api'), mk('B', '04-orders-count-api', { status: 'timeout' })]).includes('F-infra-asym'));
  t('F-sample (인프라 실패로 유효 1회)', f([mk('A', '05-login-lockout'), mk('A', '05-login-lockout'), mk('B', '05-login-lockout'), mk('B', '05-login-lockout', { status: 'error' })]).includes('F-sample'));
  t('F-unstable (1/2)', f(base('05-login-lockout', { B: {} }).map((r, i) => (i === 3 ? { ...r, verdict: 'FAIL' } : r))).includes('F-unstable'));
  t('TOLERATED 는 PASS 와 같은 쪽이라 불안정 아님', !f(base('05-login-lockout').map((r, i) => (i === 1 ? { ...r, verdict: 'TOLERATED' } : r))).includes('F-unstable'));
  t('excluded 행은 플래그 계산에서 제외', f([...base('04-orders-count-api'), mk('B', '04-orders-count-api', { excluded: 'x', firstAction: 'main_edit' })]).length === 0);
}

// --- 실행 순서 교대, 예산 예약 ---
const plan = buildPlan([cases['01'], cases['02']], ['A', 'B'], 2);
eq('plan 길이', plan.length, 8);
eq('plan 교대', plan.slice(0, 4).map((p) => p.variant).join(''), 'ABBA');
t('plan A/B 각 4회', plan.filter((p) => p.variant === 'A').length === 4);
{
  const opts = { maxBudgetUsd: 1.5, judgeMaxBudgetUsd: 1 };
  eq('예약: 판정자 대상 케이스는 실행 상한 + 판정자 상한', reservationUsd(cases['04'], opts, true), 2.5);
  eq('예약: 판정자 비활성이면 실행 상한만', reservationUsd(cases['04'], opts, false), 1.5);
  eq('예약: ③ 전용 상한 + 판정자 상한', reservationUsd(cases['03'], opts, true), 4);
  eq('예약: 브리프 없는 케이스는 판정자 예약 없음', reservationUsd(cases['01'], opts, true), 1.5);
  const full = buildPlan(Object.values(cases).filter((c) => !c.optional), ['A', 'B'], 2);
  const est = estimatePlanUsd(full, true);
  t('기본 계획 기대 비용이 총예산 가드 안에 있다', est < 20, `est=${est}`);
}

// --- kill 동작(가짜 claude): 결정적 행동 줄 직후 SIGTERM, 이후 줄은 분석에 넣지 않음 ---
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
eq('kill: SIGKILL 불필요', proc.killEscalated, false);
eq('kill: 정상 종료는 infra ok', classifyInfra(kan, proc).status, 'ok');
// 한 청크로 들어온 여러 줄: kill 이후 줄(두 번째 결정적 행동)은 분석에 반영하지 않는다 (RV-017)
{
  const twoFile = path.join(fakeDir, 'two.ndjson');
  const L = (name, input, id) => JSON.stringify({ type: 'assistant', message: { id, content: [{ type: 'tool_use', name, input }] } });
  fs.writeFileSync(twoFile, [L('EnterWorktree', {}, 'm1'), L('Bash', { command: 'git checkout -b feature/coupon' }, 'm2')].join('\n') + '\n');
  fs.writeFileSync(path.join(fakeDir, 'claude'), `#!/bin/sh\ncat >/dev/null &\ncat "${twoFile}"\nsleep 60\n`, { mode: 0o755 });
  const a2 = new StreamAnalyzer('kill_on_decisive');
  const p2 = await runClaude({ promptText: 'x', model: 'sonnet', cwd: fakeDir, pluginDir: null, maxBudgetUsd: 1, timeoutMs: 20000, analyzer: a2 });
  eq('kill 이후 같은 청크의 줄은 무시: first', a2.firstAction, 'EnterWorktree');
  eq('kill 이후 줄 무시: bashViolations 0', a2.bashViolations.length, 0);
  eq('⑥ 첫 행동 EnterWorktree 는 뒤 줄에 뒤집히지 않는다', gradeRun(cases['06'], 'A', a2).verdict, 'PASS');
  eq('kill 사유', p2.killedBy, 'decisive');
}
// SIGTERM 을 무시하는 프로세스: SIGKILL 로 격상되고 kill_failed 로 분류
{
  const L = JSON.stringify({ type: 'assistant', message: { id: 'z', content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type: 'pm', prompt: 'x' } }] } });
  fs.writeFileSync(path.join(fakeDir, 'claude'), `#!/bin/sh\ntrap '' TERM\ncat >/dev/null &\nprintf '%s\\n' '${L}'\nwhile true; do sleep 1; done\n`, { mode: 0o755 });
  const a3 = new StreamAnalyzer('kill_on_decisive');
  const p3 = await runClaude({ promptText: 'x', model: 'sonnet', cwd: fakeDir, pluginDir: null, maxBudgetUsd: 1, timeoutMs: 30000, analyzer: a3 });
  eq('SIGTERM 무시 -> killEscalated', p3.killEscalated, true);
  eq('kill_failed 분류', classifyInfra(a3, p3).status, 'kill_failed');
  eq('kill_failed 는 INCONCLUSIVE', gradeRun(cases['05'], 'A', a3, { infra: classifyInfra(a3, p3) }).verdict, 'INCONCLUSIVE');
}
// 타임아웃 경로
fs.writeFileSync(path.join(fakeDir, 'claude'), `#!/bin/sh\ncat >/dev/null &\nsleep 60\n`, { mode: 0o755 });
const sleepy = new StreamAnalyzer('none');
const proc2 = await runClaude({ promptText: 'x', model: 'sonnet', cwd: fakeDir, pluginDir: null, maxBudgetUsd: 1, timeoutMs: 800, analyzer: sleepy });
eq('timeout: killedBy', proc2.killedBy, 'timeout');
eq('timeout: infra', classifyInfra(sleepy, proc2).status, 'timeout');
process.env.PATH = oldPath;
fs.rmSync(fakeDir, { recursive: true, force: true });

console.log(`\n단위 검증: 통과 ${pass} / 실패 ${fail}`);
process.exit(fail ? 1 : 0);
