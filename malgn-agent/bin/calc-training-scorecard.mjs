#!/usr/bin/env node
/**
 * calc-training-scorecard.mjs
 *
 * `skills/domain-training-scorecard-eval/scoring-procedure.md`의 Training Scorecard
 * 최종 점수(가중합) / 실전 성공률(%) / 전월 대비 threshold 판정을
 * 결정론적으로 계산한다.
 *
 * 이 스크립트가 하지 않는 것 (LLM 판단 영역 — 스크립트로 대체하지 않는다):
 *   - 기본수행 7개 항목 각각이 몇 점인지 (정성 채점)
 *   - Eval Set 각 역량이 Pass/Partial/Fail인지 (정성 판정)
 *   - 비용 효율 감점 사유(전체 통독/반복 재확인/전체 재작성)가 몇 건 발생했는지 관찰·판단
 * 이 스크립트가 하는 것 (결정론적 산식 — 재계산 오류를 없애기 위해 스크립트로 고정):
 *   - 기본수행 7개 항목 합산 (배점 상한 검증 포함)
 *   - Eval Set Pass=100/Partial=50/Fail=0 환산 후 평균
 *   - 실전 성공률 = 1차승인건수 / 전체위임건수 × 100
 *   - 비용 효율 = 100 - (통독×10 + 반복재확인×5 + 전체재작성×15), 하한 0
 *   - 최종 점수 = 기본수행×0.6 + EvalSet×0.25 + 성공률×0.1 + 비용×0.05
 *   - 전월 대비 변화폭과 상승(+5↑)/정체(±5 이내)/하락(-5↓) 판정
 *
 * 순수 Node.js 내장 모듈만 사용 — 의존성 설치 없이 `node calc-training-scorecard.mjs` 로 실행된다.
 *
 * 사용법:
 *   node calc-training-scorecard.mjs --input <파일.json>
 *   cat scorecard.json | node calc-training-scorecard.mjs
 *   node calc-training-scorecard.mjs --input <파일.json> --format json
 *   node calc-training-scorecard.mjs --input <파일.json> --threshold 5
 *
 * 옵션:
 *   --input FILE   입력 JSON 파일 경로. 생략하면 stdin에서 읽는다.
 *   --format F     text(기본, 사람이 읽기 쉬운 리포트) | json(프로그램용 원시 결과)
 *   --threshold N  전월 대비 상승/정체/하락 판정 기준(점). 기본 5 (SKILL.md 정의값).
 *   --help, -h     도움말
 *
 * 입력 JSON 스키마 (단일 에이전트 1건):
 * {
 *   "agent": "architect",              // 필수. 에이전트 이름
 *   "period": "2026-08",               // 선택. 평가 기간 라벨
 *   "basicPerformance": {              // 필수. 기본수행 60% — 7항목, 각 배점 상한 이내 정수/실수
 *     "requirementUnderstanding": 12,  // 요구사항 이해 (배점 15)
 *     "scopeManagement": 10,           // 변경범위 관리 (배점 15)
 *     "accuracy": 20,                  // 정확도 (배점 25)
 *     "verificationQuality": 15,       // 검증 품질 (배점 20)
 *     "riskAwareness": 8,              // 리스크 인지 (배점 10)
 *     "reportClarity": 9,              // 보고 명료성 (배점 10)
 *     "outputEfficiency": 4            // 산출 효율 (배점 5)
 *   },
 *   "evalSet": ["pass", "pass", "partial", "fail", "pass"],  // 필수. 역량별 판정(대소문자 무관)
 *                                       // 객체 배열도 허용: [{"capability":"...", "result":"pass"}, ...]
 *   "successRate": {                   // 필수. 실전 성공률 10%
 *     "approvedFirstTry": 8,           // 1차승인건수
 *     "totalDelegated": 10             // 전체위임건수
 *   },
 *   "costEfficiency": {                // 필수. 비용 효율 5% (감점 사유 건수, 없으면 0)
 *     "fullRereadCount": 1,            // 불필요한 전체 통독 (-10/건)
 *     "repeatedConfirmCount": 2,       // 반복 재확인·재질문 (-5/건)
 *     "fullRewriteCount": 0            // evaluator 반려로 인한 전체 재작성 (-15/건)
 *   },
 *   "previousScore": 75                // 선택. 지난 회차 최종 점수 (전월 대비 판정용)
 * }
 *
 * 여러 에이전트를 한 번에 계산하려면 최상위를 배열로 감싸거나
 * { "agents": [ {...}, {...} ] } 형태로 넣는다 — 각 항목 스키마는 위와 동일.
 */

import fs from 'node:fs';
import path from 'node:path';

// ── 상수 (SKILL.md §Phase 1 "3) 총점 계산" 정본) ───────────────────────────

const WEIGHTS = Object.freeze({
  basicPerformance: 0.6,
  evalSet: 0.25,
  successRate: 0.1,
  costEfficiency: 0.05,
});

// 기본수행 7항목 배점 상한 (합계 100) — SKILL.md §Phase1 "a) 기본수행 60%" 표
const BASIC_ITEMS = [
  { key: 'requirementUnderstanding', label: '요구사항 이해', max: 15 },
  { key: 'scopeManagement', label: '변경범위 관리', max: 15 },
  { key: 'accuracy', label: '정확도', max: 25 },
  { key: 'verificationQuality', label: '검증 품질', max: 20 },
  { key: 'riskAwareness', label: '리스크 인지', max: 10 },
  { key: 'reportClarity', label: '보고 명료성', max: 10 },
  { key: 'outputEfficiency', label: '산출 효율', max: 5 },
];

const EVAL_SCORE_MAP = { pass: 100, partial: 50, fail: 0 };

const COST_PENALTY = Object.freeze({
  fullRereadCount: 10,
  repeatedConfirmCount: 5,
  fullRewriteCount: 15,
});

const DEFAULT_THRESHOLD = 5;

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { input: null, format: 'text', threshold: DEFAULT_THRESHOLD };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--input':
        opts.input = argv[++i] ?? null;
        break;
      case '--format': {
        const v = argv[++i];
        if (v !== 'text' && v !== 'json') {
          console.error(`--format 은 text 또는 json 만 허용됩니다 (입력값: ${v})`);
          process.exit(1);
        }
        opts.format = v;
        break;
      }
      case '--threshold': {
        const v = Number(argv[++i]);
        if (!Number.isFinite(v) || v < 0) {
          console.error('--threshold 는 0 이상의 숫자여야 합니다.');
          process.exit(1);
        }
        opts.threshold = v;
        break;
      }
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`알 수 없는 옵션: ${a} (--help 참고)`);
        process.exit(1);
    }
  }
  return opts;
}

function printHelp() {
  const SELF = `node "${process.argv[1]}"`
  console.log(`사용법: ${SELF} [--input FILE] [--format text|json] [--threshold N]

  --input FILE   입력 JSON 파일 경로 (생략 시 stdin에서 읽음)
  --format F     text(기본, 사람이 읽는 리포트) | json(원시 계산 결과)
  --threshold N  전월 대비 상승/정체/하락 판정 기준(점). 기본 ${DEFAULT_THRESHOLD}

입력 JSON 스키마는 이 파일 상단 주석을 참고하세요.
스코어카드 배점·산식 정본은 skills/domain-training-scorecard-eval/scoring-procedure.md 입니다.
`);
}

// ── 입력 읽기 ───────────────────────────────────────────────────────────────

function readInput(inputPath) {
  let raw;
  if (inputPath) {
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
      console.error(`입력 파일을 찾을 수 없습니다: ${resolved}`);
      process.exit(1);
    }
    raw = fs.readFileSync(resolved, 'utf8');
  } else {
    try {
      raw = fs.readFileSync(0, 'utf8'); // stdin
    } catch {
      console.error('입력이 없습니다. --input FILE 을 지정하거나 stdin으로 JSON을 파이프하세요. (--help 참고)');
      process.exit(1);
    }
  }
  if (!raw || !raw.trim()) {
    console.error('입력이 비어 있습니다.');
    process.exit(1);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`입력 JSON 파싱 실패: ${err.message}`);
    process.exit(1);
  }
}

function normalizeToList(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.agents)) return parsed.agents;
  if (parsed && typeof parsed === 'object') return [parsed];
  console.error('입력은 단일 스코어카드 객체, 배열, 또는 { "agents": [...] } 형태여야 합니다.');
  process.exit(1);
}

// ── 검증 + 계산 ─────────────────────────────────────────────────────────────

class ValidationError extends Error {}

function requireField(obj, key, label) {
  if (obj[key] === undefined || obj[key] === null) {
    throw new ValidationError(`필수 필드 누락: "${key}" (${label})`);
  }
  return obj[key];
}

function calcBasicPerformance(bp) {
  if (typeof bp !== 'object' || bp === null) {
    throw new ValidationError('basicPerformance 는 객체여야 합니다.');
  }
  const knownKeys = new Set(BASIC_ITEMS.map((i) => i.key));
  for (const k of Object.keys(bp)) {
    if (!knownKeys.has(k)) {
      throw new ValidationError(
        `basicPerformance 에 알 수 없는 키 "${k}" — 허용 키: ${[...knownKeys].join(', ')}`
      );
    }
  }
  const breakdown = [];
  let sum = 0;
  for (const item of BASIC_ITEMS) {
    const v = bp[item.key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new ValidationError(`basicPerformance.${item.key} 는 숫자여야 합니다 (배점 0~${item.max}).`);
    }
    if (v < 0 || v > item.max) {
      throw new ValidationError(
        `basicPerformance.${item.key} = ${v} 는 배점 상한(0~${item.max})을 벗어났습니다.`
      );
    }
    breakdown.push({ ...item, score: v });
    sum += v;
  }
  return { breakdown, total: round2(sum) };
}

function calcEvalSet(evalSet) {
  if (!Array.isArray(evalSet) || evalSet.length === 0) {
    throw new ValidationError('evalSet 은 최소 1개 이상의 판정을 담은 배열이어야 합니다.');
  }
  const results = evalSet.map((entry, idx) => {
    const raw = typeof entry === 'string' ? entry : entry && entry.result;
    const capability = typeof entry === 'object' && entry && entry.capability ? entry.capability : `역량 ${idx + 1}`;
    if (typeof raw !== 'string') {
      throw new ValidationError(`evalSet[${idx}] 판정값을 읽을 수 없습니다 (문자열 또는 {result: "pass|partial|fail"}).`);
    }
    const norm = raw.trim().toLowerCase();
    if (!(norm in EVAL_SCORE_MAP)) {
      throw new ValidationError(`evalSet[${idx}] = "${raw}" 는 pass/partial/fail 중 하나여야 합니다.`);
    }
    return { capability, result: norm, score: EVAL_SCORE_MAP[norm] };
  });
  const avg = results.reduce((s, r) => s + r.score, 0) / results.length;
  return { results, average: round2(avg) };
}

function calcSuccessRate(sr) {
  if (typeof sr !== 'object' || sr === null) {
    throw new ValidationError('successRate 는 객체여야 합니다 ({approvedFirstTry, totalDelegated}).');
  }
  const approved = requireField(sr, 'approvedFirstTry', '1차승인건수');
  const total = requireField(sr, 'totalDelegated', '전체위임건수');
  if (!Number.isInteger(approved) || approved < 0) {
    throw new ValidationError('successRate.approvedFirstTry 는 0 이상의 정수여야 합니다.');
  }
  if (!Number.isInteger(total) || total < 0) {
    throw new ValidationError('successRate.totalDelegated 는 0 이상의 정수여야 합니다.');
  }
  if (approved > total) {
    throw new ValidationError('successRate.approvedFirstTry 는 totalDelegated 를 초과할 수 없습니다.');
  }
  if (total === 0) {
    return { approved, total, percent: null, note: '위임 건수 0건 — 성공률 계산 불가(N/A), 가중합에는 0점으로 반영' };
  }
  return { approved, total, percent: round2((approved / total) * 100), note: null };
}

function calcCostEfficiency(ce) {
  const counts = {
    fullRereadCount: 0,
    repeatedConfirmCount: 0,
    fullRewriteCount: 0,
    ...(ce && typeof ce === 'object' ? ce : {}),
  };
  const knownKeys = new Set(Object.keys(COST_PENALTY));
  for (const k of Object.keys(ce || {})) {
    if (!knownKeys.has(k)) {
      throw new ValidationError(
        `costEfficiency 에 알 수 없는 키 "${k}" — 허용 키: ${[...knownKeys].join(', ')}`
      );
    }
  }
  let deduction = 0;
  const breakdown = [];
  for (const [key, penalty] of Object.entries(COST_PENALTY)) {
    const count = counts[key];
    if (!Number.isInteger(count) || count < 0) {
      throw new ValidationError(`costEfficiency.${key} 는 0 이상의 정수여야 합니다.`);
    }
    const d = count * penalty;
    deduction += d;
    breakdown.push({ key, count, penaltyEach: penalty, deduction: d });
  }
  const score = Math.max(0, round2(100 - deduction));
  return { breakdown, deduction: round2(deduction), score };
}

function judgeTrend(finalScore, previousScore, threshold) {
  if (previousScore === undefined || previousScore === null) {
    return { previousScore: null, diff: null, status: 'N/A(전월 점수 없음)' };
  }
  if (typeof previousScore !== 'number' || !Number.isFinite(previousScore)) {
    throw new ValidationError('previousScore 는 숫자여야 합니다.');
  }
  const diff = round2(finalScore - previousScore);
  let status;
  if (diff >= threshold) status = '상승';
  else if (diff <= -threshold) status = '하락';
  else status = '정체';
  return { previousScore, diff, status };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function calcOne(entry) {
  const agent = requireField(entry, 'agent', '에이전트 이름');
  const period = entry.period ?? null;

  const basic = calcBasicPerformance(requireField(entry, 'basicPerformance', '기본수행 60%'));
  const evalSet = calcEvalSet(requireField(entry, 'evalSet', 'Eval Set 25%'));
  const successRate = calcSuccessRate(requireField(entry, 'successRate', '실전 성공률 10%'));
  const cost = calcCostEfficiency(requireField(entry, 'costEfficiency', '비용 효율 5%'));

  const successRateForCalc = successRate.percent === null ? 0 : successRate.percent;

  const weightedParts = {
    basicPerformance: round2(basic.total * WEIGHTS.basicPerformance),
    evalSet: round2(evalSet.average * WEIGHTS.evalSet),
    successRate: round2(successRateForCalc * WEIGHTS.successRate),
    costEfficiency: round2(cost.score * WEIGHTS.costEfficiency),
  };
  const finalScore = round2(
    weightedParts.basicPerformance + weightedParts.evalSet + weightedParts.successRate + weightedParts.costEfficiency
  );

  return { agent, period, basic, evalSet, successRate, cost, weightedParts, finalScore, weights: WEIGHTS };
}

// ── 출력 ───────────────────────────────────────────────────────────────────

function printTextReport(result, threshold, previousScore) {
  const lines = [];
  const push = (s = '') => lines.push(s);

  push(`# Training Scorecard 계산 결과 — ${result.agent}${result.period ? ` (${result.period})` : ''}`);
  push();
  push(`## 기본수행 60% (합계 배점 100)`);
  push(`| 항목 | 배점 | 획득 |`);
  push(`|---|---|---|`);
  for (const b of result.basic.breakdown) {
    push(`| ${b.label} | ${b.max} | ${b.score} |`);
  }
  push(`| **합계** | **100** | **${result.basic.total}** |`);
  push();

  push(`## Eval Set 25%`);
  for (const r of result.evalSet.results) {
    push(`- ${r.capability}: ${r.result} → ${r.score}점`);
  }
  push(`- 평균: ${result.evalSet.average}점`);
  push();

  push(`## 실전 성공률 10%`);
  if (result.successRate.percent === null) {
    push(`- ${result.successRate.note}`);
  } else {
    push(`- ${result.successRate.approved} / ${result.successRate.total} × 100 = ${result.successRate.percent}%`);
  }
  push();

  push(`## 비용 효율 5%`);
  for (const b of result.cost.breakdown) {
    push(`- ${b.key}: ${b.count}건 × -${b.penaltyEach} = -${b.deduction}`);
  }
  push(`- 100 - ${result.cost.deduction} = ${result.cost.score}점 (하한 0)`);
  push();

  push(`## 최종 점수 (가중합)`);
  push(
    `기본수행(${result.basic.total} × ${result.weights.basicPerformance}) + ` +
      `EvalSet(${result.evalSet.average} × ${result.weights.evalSet}) + ` +
      `성공률(${result.successRate.percent === null ? 0 : result.successRate.percent} × ${result.weights.successRate}) + ` +
      `비용(${result.cost.score} × ${result.weights.costEfficiency})`
  );
  push(
    `= ${result.weightedParts.basicPerformance} + ${result.weightedParts.evalSet} + ` +
      `${result.weightedParts.successRate} + ${result.weightedParts.costEfficiency}`
  );
  push(`= **${result.finalScore}점**`);
  push();

  const trend = judgeTrend(result.finalScore, previousScore, threshold);
  push(`## 전월 대비 판정 (threshold ±${threshold}점)`);
  if (trend.previousScore === null) {
    push(`- ${trend.status}`);
  } else {
    push(`- 전월 ${trend.previousScore}점 → 이번달 ${result.finalScore}점 (${trend.diff >= 0 ? '+' : ''}${trend.diff}점)`);
    push(`- 판정: **${trend.status}**`);
  }
  push();

  return { text: lines.join('\n'), trend };
}

function run() {
  const opts = parseArgs(process.argv.slice(2));
  const parsed = readInput(opts.input);
  const list = normalizeToList(parsed);

  const results = [];
  for (const entry of list) {
    let result;
    try {
      result = calcOne(entry);
    } catch (err) {
      if (err instanceof ValidationError) {
        console.error(`입력 검증 실패 (agent: ${entry && entry.agent ? entry.agent : '알 수 없음'}): ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
    results.push({ entry, result });
  }

  if (opts.format === 'json') {
    const out = results.map(({ entry, result }) => ({
      ...result,
      trend: judgeTrend(result.finalScore, entry.previousScore, opts.threshold),
    }));
    console.log(JSON.stringify(out.length === 1 ? out[0] : out, null, 2));
    return;
  }

  const reportBlocks = [];
  const summaryRows = [];
  for (const { entry, result } of results) {
    const { text, trend } = printTextReport(result, opts.threshold, entry.previousScore);
    reportBlocks.push(text);
    summaryRows.push({ agent: result.agent, previous: trend.previousScore, final: result.finalScore, diff: trend.diff, status: trend.status });
  }

  console.log(reportBlocks.join('\n---\n\n'));

  if (summaryRows.length > 1) {
    console.log('## 요약표');
    console.log('| 에이전트 | 지난회 | 이번회 | 변화 | 상태 |');
    console.log('|---|---|---|---|---|');
    for (const r of summaryRows) {
      const prev = r.previous === null ? '-' : r.previous;
      const diff = r.diff === null ? '-' : `${r.diff >= 0 ? '+' : ''}${r.diff}`;
      console.log(`| ${r.agent} | ${prev} | ${r.final} | ${diff} | ${r.status} |`);
    }
  }
}

run();
