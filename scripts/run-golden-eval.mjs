#!/usr/bin/env node
// 골든 태스크 벤치마크 실행기 (저장소 전용 — 마켓플레이스로 배포되지 않는다).
//
// `claude plugin eval`을 이 저장소의 규약에 맞춰 감싼다. 맨손으로 부르면 안 되는 이유:
//   1) 결과가 malgn-agent/evals/results/ 안에 쌓인다 = 배포 트리 오염
//   2) HTML 리포트가 claude.ai에 자동 발행된다(계정이 지원하면 기본 동작)
//   3) 비용 상한·임계값·runs가 매번 달라져 시계열 비교가 깨진다
//
// 이 스크립트는 세션 시작 시 자동 실행되지 않는다. 사람이 `pnpm run eval:golden`으로만 부른다.
//
// 전제: `claude plugin eval`은 얼리액세스 기능이라 조직 단위 승인이 필요하다.
//       승인 전에는 아래 실행이 claude 자신의 안내 메시지와 함께 실패한다(정상 동작).
//       승인은 Anthropic에 정식으로 요청한다. `--dry-run`도 같은 게이트를 지난다.
//
// 사용:
//   pnpm run eval:golden                       # 기본값으로 전체 케이스
//   pnpm run eval:golden -- --case architect-* # 케이스 필터
//   pnpm run eval:golden -- --ablation with-without   # 플러그인 없는 baseline과 대조
//   pnpm run eval:golden -- --runs 1 --max-cost-usd 10 # 1회만 (약 $8 · 33분)
//   pnpm run eval:golden -- --dry-run          # 케이스 파일 파싱만 검증(에이전트 실행 없음)

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_DIR = path.join(REPO, 'malgn-agent');
const OUT_ROOT = path.join(REPO, 'docs', 'evaluation', 'golden-task');
const HISTORY = path.join(OUT_ROOT, 'history.jsonl');

// ── 비용/판정 기본값 (근거는 docs/architecture/golden-task-benchmark.md §5) ──────────
// ⚠ 실측: architect 케이스 1회 = 약 $7.8 · 33분. 기본값(runs 2)으로 한 번 돌리면 약 $16 · 1시간이다.
//    PR마다 돌리는 도구가 아니라 릴리스 게이트 주기로 돌리는 도구다.
// `--max-cost-usd`는 기본값으로 걸지 않는다. 하네스 자체 기본값도 없다(`--help`가 "Optional
// hard cost ceiling"이라고만 적고 다른 옵션과 달리 default를 표기하지 않는다) → 미지정이면 무제한이다.
// 상한을 걸면 걸린 런에서 유료 그레이더(llm/baseline)만 건너뛰어지고 무료 그레이더는 그대로 채점되므로,
// 케이스마다 정확히 1개인 가중치 2짜리 llm 그레이더가 통째로 빠져 전 케이스가 임계값 아래로 내려앉는다.
// 즉 예산 사고가 품질 회귀와 구분되지 않는다. 이 도구는 릴리스 게이트 주기로 드물게 돌리는 도구라
// 상한으로 얻을 것보다 가짜 경보로 잃을 것이 크다. 상한이 필요하면 사람이 `-- --max-cost-usd N`으로 준다.
// 실행 전 비용 인지는 GOLDEN_EVAL_I_ACCEPT_COST 옵트인 가드가 담당한다.
const DEFAULTS = {
  runs: '2',
  threshold: '0.9',
  ablation: 'none',
  model: 'sonnet',         // 부모 세션 모델 고정. 서브에이전트 모델은 각 에이전트 MD가 정한다.
  'judge-model': 'sonnet', // 하네스 기본(haiku)은 2만자대 한글 설계문서에서 오탐을 냈다 — 설계문서 §5 참조
};
// 케이스가 요구하는 도구 중 운영자 승인이 필요한 것.
// 주의: 이 목록은 보안 경계가 아니라 "케이스가 쓰겠다고 선언한 것을 열어주는" 스위치다.
// 케이스가 선언하지 않은 도구도 이 목록에 없이 자식 세션에서 실행될 수 있다(실측).
// 즉 케이스를 돌리는 것은 그 플러그인을 설치하는 것과 같은 신뢰 결정이다.
// Bash는 그 구멍에 기대지 않고 명시적으로 선언·승인한다 — 테스트를 실제로 실행하는 것이
// 케이스의 표제 의무인데, 하네스가 그 구멍을 막으면 의무가 조용히 측정 불능이 되기 때문이다.
const ALLOW_TOOLS = ['Write', 'Bash'];

/**
 * 하드 게이트 — 여기 적힌 그레이더가 **한 번이라도** 실패하면 가중 점수와 무관하게 FAIL(exit 1)이다.
 *
 * 왜 가중치로 하지 않는가: 하네스의 채점은 가중합뿐이고 "이건 필수" 표시가 없다.
 * `delegates-to-architect`(가중치 1)를 잃어도 13/14 = 0.929로 threshold 0.9를 넘는다 —
 * 즉 **위임이 죽고 부모가 직접 설계해도 Green이 나온다.** 그러면 이 케이스는 architect가 아니라
 * 부모 세션을 채점한 것이 되어 측정 자체가 무의미해진다.
 * 가중치를 키워 해결하려면 4 이상이 필요한데(그래야 runs 2 평균에서도 걸린다),
 * 그건 "위임 성공"이 4대 의무 두 개만큼 중요하다는 뜻이 되어 점수 의미가 왜곡된다.
 * 그래서 점수 체계는 그대로 두고 **채점 후처리로 분리**한다.
 *
 * `arm: with-only` 그레이더는 ablation 실행에서 `scored: false`가 되지만,
 * 하드 게이트 판정은 `scored`와 무관하게 `passed`만 본다.
 */
const HARD_GATES = {
  'architect-design-obligations': ['delegates-to-architect'],
  'planner-prd-obligations': ['delegates-to-planner'],
  'qa-engineer-test-report-obligations': ['delegates-to-qa-engineer'],
  'security-dev-stage-discipline': ['delegates-to-security'],
};

// ── 인자 파싱: 사용자가 준 플래그가 기본값을 덮어쓴다 ─────────────────────────────
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
// `pnpm run eval:golden -- --runs 3`의 `--`는 pnpm이 벗겨주지 않고 그대로 넘어온다.
// 그대로 두면 `claude`에 전달돼 "옵션 파싱 종료" 기호로 해석되고, 그 뒤에 붙는
// `--allow-tools Write`까지 전부 무시된다. 여기서 걷어낸다.
const passthrough = argv.filter((a) => a !== '--dry-run' && a !== '--');
const given = new Set(
  passthrough.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--(no-)?/, '').split('=')[0]),
);

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
// 결과를 읽어들일 경로. 사용자가 --output-dir로 덮어쓰면 그 경로를 따라가야 한다
// (안 그러면 override 시 회귀 이력이 조용히 기록되지 않는다).
let outDir = path.join(OUT_ROOT, 'runs', stamp);
{
  const i = passthrough.findIndex((a) => a === '--output-dir' || a.startsWith('--output-dir='));
  if (i >= 0) {
    const raw = passthrough[i].includes('=')
      ? passthrough[i].slice('--output-dir='.length)
      : passthrough[i + 1];
    if (raw) outDir = path.resolve(REPO, raw);
  }
}

const args = ['plugin', 'eval', './malgn-agent'];
for (const [flag, value] of Object.entries(DEFAULTS)) {
  if (!given.has(flag)) args.push(`--${flag}`, value);
}
if (!given.has('publish') && !given.has('publish-report')) args.push('--no-publish');
if (!given.has('output-dir')) args.push('--output-dir', outDir);
if (dryRun) args.push('--case', '__dry_run_no_case__');
args.push(...passthrough);
// variadic 플래그는 뒤따르는 인자를 삼키므로 항상 마지막에 둔다.
if (!given.has('allow-tools') && !dryRun) args.push('--allow-tools', ...ALLOW_TOOLS);

// ── 오발동 가드 ────────────────────────────────────────────────────────────────
// 이 저장소는 마켓플레이스 클론 대상이라 `scripts/`·`package.json`이 전 직원 PC에 내려간다.
// 무심코 `pnpm run eval:golden`을 친 직원의 **자기 계정에** 비용이 청구되므로,
// 비용을 알고 있다는 명시적 옵트인을 요구한다. `--dry-run`은 비용이 0이라 면제.
if (!dryRun && process.env.GOLDEN_EVAL_I_ACCEPT_COST !== '1') {
  console.error(
    '골든 태스크 벤치마크는 유료 실행이다.\n' +
      `  예상: 케이스당 약 $7.8 · 33분 × runs(현재 ${given.has('runs') ? '사용자 지정' : DEFAULTS.runs}회)\n` +
      '  비용은 이 명령을 실행한 사람의 계정에 청구된다.\n\n' +
      '  실행하려면: GOLDEN_EVAL_I_ACCEPT_COST=1 pnpm run eval:golden\n' +
      '  비용 없이 케이스 파일만 검증하려면: pnpm run eval:golden --dry-run',
  );
  process.exit(1);
}

// `claude plugin eval`은 얼리액세스 기능이라 조직 단위로 승인돼야 동작한다.
// 이 조직은 아직 승인 전이므로 아래 실행은 claude 자신의 안내 메시지와 함께 실패한다.
// 승인은 Anthropic에 정식으로 요청해서 받는다 — 우회하지 않는다.
console.log(`$ claude ${args.join(' ')}`);
const res = spawnSync('claude', args, { cwd: REPO, stdio: 'inherit' });
if (res.error) {
  console.error(`claude 실행 실패: ${res.error.message}`);
  process.exit(1);
}

// ── 회귀 추적: 원본 결과는 커밋하지 않고, 한 줄 요약만 history.jsonl에 남긴다 ────────

/** 하드 게이트(HARD_GATES)가 하나라도 깨졌는가 — 깨지면 점수와 무관하게 exit 1. */
let hardGateFailed = false;

/**
 * 케이스 정의(프롬프트 + 그레이더)의 지문. 케이스를 고치면 값이 바뀐다.
 * 이 값이 다른 회차끼리는 점수를 비교하지 않는다 — 채점표가 달라졌다는 뜻이다.
 */
function caseSha(caseName) {
  const dir = path.join(PLUGIN_DIR, 'evals', caseName);
  if (!fs.existsSync(dir)) return null;
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

const aggregatePath = path.join(outDir, 'aggregate-result.json');
if (!dryRun && fs.existsSync(aggregatePath)) {
  const doc = JSON.parse(fs.readFileSync(aggregatePath, 'utf8'));
  const pluginVersion = JSON.parse(
    fs.readFileSync(path.join(PLUGIN_DIR, '.claude-plugin', 'plugin.json'), 'utf8'),
  ).version;
  const row = {
    startedAt: doc.startedAt,
    pluginVersion,
    claudeVersion: doc.claudeVersion,
    model: doc.suite?.modelOverride ?? null,
    judgeModel: doc.suite?.judgeModel ?? null,
    ablation: doc.suite?.ablation ?? null,
    threshold: doc.suite?.threshold ?? null,
    // 케이스가 선언한 runs가 아니라 실제로 돈 횟수(--runs override 반영).
    runsPerCase: doc.cases?.[0]?.arms?.with?.length ?? doc.cases?.[0]?.runsPerCase ?? null,
    partial: doc.partial === true,
    partialReason: doc.partialReason ?? null,
    // 비용 상한에 걸리면 유료 그레이더(llm)가 건너뛰어지고 그만큼 점수가 깎인다.
    // 그건 회귀가 아니라 예산 사고다 — 추세에서 제외해야 하므로 표시해 둔다.
    skippedPaidGraders: (doc.cases ?? []).some((c) =>
      (c.arms?.with ?? []).some((r) => r.skippedPaidGraders === true),
    ),
    costUsd: Number((doc.costUsd ?? 0).toFixed(4)),
    overallScore: doc.aggregates?.overallScore ?? null,
    cases: (doc.cases ?? []).map((c) => ({
      name: c.name,
      caseSha: caseSha(c.name),
      score: c.aggregates?.score ?? null,
      passRate: c.aggregates?.passRate ?? null,
      scoreWithout: c.aggregates?.scoreWithout ?? null,
      failedGraders: [
        ...new Set(
          (c.arms?.with ?? [])
            .flatMap((r) => r.graders ?? [])
            .filter((g) => g.scored !== false && !g.passed)
            .map((g) => g.name),
        ),
      ],
      // 하드 게이트는 scored 여부와 무관하게 passed만 본다(§4-1 참조).
      hardGateFailures: [
        ...new Set(
          (c.arms?.with ?? [])
            .flatMap((r) => r.graders ?? [])
            .filter((g) => (HARD_GATES[c.name] ?? []).includes(g.name) && !g.passed)
            .map((g) => g.name),
        ),
      ],
    })),
    runDir: path.relative(REPO, outDir),
  };
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  fs.appendFileSync(HISTORY, JSON.stringify(row) + '\n');

  if (row.partial || row.skippedPaidGraders) {
    console.warn(
      `\n⚠️  이 회차는 추세 비교에서 제외한다` +
        `${row.partialReason ? ` (partial: ${row.partialReason})` : ''}` +
        `${row.skippedPaidGraders ? ' (비용 상한으로 유료 그레이더 건너뜀 — 점수 하락은 회귀가 아니다)' : ''}.`,
    );
  }

  for (const c of row.cases) {
    if (c.hardGateFailures.length > 0) {
      console.error(
        `\n✗ 하드 게이트 실패 — "${c.name}": ${c.hardGateFailures.join(', ')}\n` +
          `  점수(${c.score})가 임계값을 넘더라도 이 실행은 FAIL이다.\n` +
          `  이 그레이더가 떨어졌다는 것은 대상 에이전트에 위임되지 않았다는 뜻이고,\n` +
          `  그러면 나머지 점수는 그 에이전트가 아니라 부모 세션을 채점한 값이라 신뢰할 수 없다.`,
      );
      hardGateFailed = true;
    }
  }
  console.log(`\n회귀 이력 1줄 추가: ${path.relative(REPO, HISTORY)}`);
  console.log(`원본 결과(커밋 대상 아님): ${path.relative(REPO, outDir)}`);
}

// 하네스가 0을 돌려줘도 하드 게이트가 깨졌으면 실패로 끝낸다.
process.exit(hardGateFailed ? 1 : (res.status ?? 1));
