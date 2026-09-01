#!/usr/bin/env node
/**
 * analyze-usage.mjs
 *
 * Claude Code 로컬 세션 로그(~/.claude/projects/**\/*.jsonl)를 분석해
 * 토큰 사용량 진단 + 효율화 가이드를 콘솔/마크다운으로 출력한다.
 *
 * 순수 Node.js 내장 모듈만 사용 — 의존성 설치 없이 `node analyze-usage.mjs` 로 실행된다.
 * macOS/Linux/Windows 동일 동작 (os.homedir() 기준 경로, path.join으로 구분자 처리).
 *
 * 사용법:
 *   node analyze-usage.mjs [--days N] [--project <cwd 부분일치>] [--top N]
 *
 * 옵션:
 *   --days N     기본 1. 로컬 타임존 기준 최근 N일(오늘 포함)을 집계.
 *   --project S  cwd에 S가 부분 포함된 세션만 집계 (필터 없으면 전체).
 *   --top N      세션/API호출/도구별/서브에이전트별/프로젝트별 순위에서 상위 몇 건을 보여줄지.
 *                기본 5 (API 호출 Top만 기본 10, 세션 Top의 2배).
 *
 * 콘솔 출력만 지원한다(파일 저장 옵션 없음) — 필요하면 셸 리다이렉트를 직접 사용할 것.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { days: 1, project: null, top: 5, apiTop: 10 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--days': {
        const v = Number(argv[++i]);
        if (Number.isFinite(v) && v > 0) opts.days = Math.floor(v);
        break;
      }
      case '--project':
        opts.project = argv[++i] ?? null;
        break;
      case '--top': {
        const v = Number(argv[++i]);
        if (Number.isFinite(v) && v > 0) {
          opts.top = Math.floor(v);
          opts.apiTop = Math.floor(v) * 2; // API Top N은 관례상 세션 Top의 2배(기본 5→10) 유지
        }
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
  console.log(`사용법: ${SELF} [--days N] [--project <cwd 부분일치>] [--top N]

  --days N     최근 N일 집계 (기본 1 = 오늘, 로컬 타임존 기준)
  --project S  cwd에 S가 포함된 세션만 집계
  --top N      세션/도구별/서브에이전트별/프로젝트별 순위 Top N (기본 5, API 호출 Top은 자동으로 그 2배)

콘솔 출력만 지원합니다 (파일 저장 옵션 없음).
`);
}

// ── 유틸 ───────────────────────────────────────────────────────────────────

/** 로컬 타임존 기준 YYYY-MM-DD 문자열 (en-CA 로케일이 ISO 형식을 보장) */
function localDateStr(d) {
  return d.toLocaleDateString('en-CA');
}

function localTimeStr(d) {
  return d.toLocaleString('ko-KR', { hour12: false });
}

function fmt(n) {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString('ko-KR');
}

function pct(n) {
  if (!Number.isFinite(n)) return '0.0%';
  return (n * 100).toFixed(1) + '%';
}

function shortId(id) {
  if (!id) return '(unknown)';
  return String(id).slice(0, 8);
}

function truncate(s, n) {
  if (s == null) return '';
  const str = typeof s === 'string' ? s : JSON.stringify(s);
  return str.length > n ? str.slice(0, n) + '…' : str;
}

/** 디렉터리를 재귀적으로 순회하며 .jsonl 파일 경로를 모두 수집 */
function findJsonlFiles(baseDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      // 권한 문제 등은 조용히 건너뛴다
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(full);
      }
    }
  }
  walk(baseDir);
  return results;
}

/** user 라인의 content가 "사람이 입력한 프롬프트"인지 판별 (tool_result만 있으면 아님) */
function isHumanPromptContent(content) {
  if (content == null) return false;
  if (typeof content === 'string') return content.trim().length > 0;
  if (Array.isArray(content)) {
    if (content.length === 0) return false;
    // 전부 tool_result 블록이면 사람이 입력한 턴이 아니다
    return content.some((block) => block && block.type !== 'tool_result');
  }
  return false;
}

/** user 라인 content에서 사람이 입력한 프롬프트의 텍스트만 뽑아 공백 정규화한 한 줄로 변환 */
function extractHumanPromptText(content) {
  let raw;
  if (typeof content === 'string') {
    raw = content;
  } else if (Array.isArray(content)) {
    raw = content
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join(' ');
  } else {
    raw = '';
  }
  raw = (raw || '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
  return raw || '(텍스트 없음)'; // 이미지/파일첨부 등 텍스트 블록이 없는 경우
}

/** assistant 라인 content에서 tool_use 블록 이름들을 추출 */
function extractToolUseNames(content) {
  if (!Array.isArray(content)) return [];
  return content
    .filter((b) => b && b.type === 'tool_use' && typeof b.name === 'string')
    .map((b) => b.name);
}

function extractToolUseBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b && b.type === 'tool_use');
}

// ── 메인 집계 상태 ──────────────────────────────────────────────────────────

function newSessionAgg(sessionId) {
  return {
    sessionId,
    cwd: null,
    firstTs: null,
    lastTs: null,
    firstPrompt: null,
    lastPrompt: null,
    tokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
    mainTokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
    sidechainTokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
    turns: 0,
    apiCalls: 0,
    mainApiCalls: 0,
    sidechainApiCalls: 0,
    // 중복 호출 탐지용: key = tool명 + JSON.stringify(input)
    toolCallCounts: new Map(), // key -> { count, tool, inputPreview }
    lastToolName: null,
  };
}

function addTokens(bucket, usage) {
  bucket.input += usage.input_tokens || 0;
  bucket.output += usage.output_tokens || 0;
  bucket.cacheCreate += usage.cache_creation_input_tokens || 0;
  bucket.cacheRead += usage.cache_read_input_tokens || 0;
}

function tokenSum(bucket) {
  return bucket.input + bucket.output + bucket.cacheCreate + bucket.cacheRead;
}

function newBucket() {
  return { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
}

/** usage를 divisor로 균등 분할해 bucket에 누적 (한 API 호출에 도구가 여러 개면 나눠 귀속) */
function addSplitTokens(bucket, usage, divisor) {
  const d = divisor > 0 ? divisor : 1;
  bucket.input += (usage.input_tokens || 0) / d;
  bucket.output += (usage.output_tokens || 0) / d;
  bucket.cacheCreate += (usage.cache_creation_input_tokens || 0) / d;
  bucket.cacheRead += (usage.cache_read_input_tokens || 0) / d;
}

/** 정렬기준 합계: input + cache_creation + output (cache_read는 재사용이라 제외 — 기존 Top10 로직과 동일 스펙) */
function sortMetricOf(bucket) {
  return bucket.input + bucket.cacheCreate + bucket.output;
}

// 서브에이전트 위임에 쓰이는 도구명. 표준 Claude Code는 "Task", 이 조직의 커스텀 하네스는 "Agent"를 쓴다.
const SUBAGENT_TOOL_NAMES = new Set(['Task', 'Agent']);

async function run() {
  const opts = parseArgs(process.argv.slice(2));

  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) {
    console.error(`Claude Code 세션 로그 디렉터리를 찾을 수 없습니다: ${projectsDir}`);
    console.error('이 PC에서 Claude Code를 사용한 기록이 아직 없거나, 경로가 다를 수 있습니다.');
    process.exit(1);
  }

  const files = findJsonlFiles(projectsDir);
  if (files.length === 0) {
    console.error(`${projectsDir} 아래에서 .jsonl 세션 로그를 찾지 못했습니다.`);
    process.exit(1);
  }

  // 날짜 범위: 오늘(로컬) 포함 최근 opts.days일
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (opts.days - 1));
  const cutoffStr = localDateStr(cutoff);

  const sessions = new Map(); // sessionId -> agg
  const dailyTotals = new Map(); // dateStr -> total tokens (all 4 fields summed)
  const dailySessionIds = new Map(); // dateStr -> Set(sessionId) — 세션 파편화 분석용
  const apiCalls = []; // { ts, sessionId, cwd, tokens{...}, sortMetric, toolNames, isSidechain }
  const toolAgg = new Map(); // toolName -> { count, tokens: bucket }
  const subagentAgg = new Map(); // label(subagent_type||description) -> { count, tokens: bucket }
  let totalTurns = 0;
  let totalApiCalls = 0;
  let parseErrors = 0;
  let skippedByFilter = 0;
  // 서브에이전트 위임(Task/Agent) 호출 총건수와, 그 중 sidechain(서브에이전트 내부) 라인이 스스로 발행한
  // 건수. sidechain 라인이 Task/Agent를 또 호출했다는 것 자체가 곧 중첩 위임이므로, 이미 돌고 있는 이
  // 파싱 루프(위 dateStr/opts.project 필터를 이미 통과한 라인만 본다)에 카운터만 얹으면 된다 — 별도 파일
  // 스캔이 필요 없어 기간·프로젝트 스코프를 자동으로 물려받는다.
  let totalDelegationCount = 0;
  let nestedDelegationCount = 0;

  for (const file of files) {
    let stream;
    try {
      stream = fs.createReadStream(file, { encoding: 'utf8' });
    } catch (err) {
      continue; // 접근 불가 파일은 조용히 건너뛴다
    }
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) continue;

      let obj;
      try {
        obj = JSON.parse(line);
      } catch (err) {
        parseErrors++;
        continue;
      }

      if (!obj || typeof obj !== 'object') continue;

      const ts = obj.timestamp ? new Date(obj.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue; // 타임스탬프 없으면 날짜 집계 불가 → skip

      const dateStr = localDateStr(ts);
      if (dateStr < cutoffStr) continue; // 기간 밖

      const cwd = typeof obj.cwd === 'string' ? obj.cwd : null;
      if (opts.project && (!cwd || !cwd.includes(opts.project))) {
        skippedByFilter++;
        continue;
      }

      const sessionId = obj.sessionId || `(no-session:${path.basename(file)})`;
      let agg = sessions.get(sessionId);
      if (!agg) {
        agg = newSessionAgg(sessionId);
        sessions.set(sessionId, agg);
      }
      if (cwd && !agg.cwd) agg.cwd = cwd;
      if (!agg.firstTs || ts < agg.firstTs) agg.firstTs = ts;
      if (!agg.lastTs || ts > agg.lastTs) agg.lastTs = ts;

      const isSidechain = obj.isSidechain === true;

      if (obj.type === 'user') {
        const content = obj.message && obj.message.content !== undefined ? obj.message.content : obj.content;
        if (isHumanPromptContent(content)) {
          agg.turns++;
          totalTurns++;
          // 세션 식별용 프롬프트 요약은 최상위(non-sidechain) 턴만 대상으로 한다 —
          // sidechain(서브에이전트 내부) 턴까지 섞으면 "이 세션이 무슨 작업이었는지"가 흐려진다.
          if (!isSidechain) {
            const promptText = extractHumanPromptText(content);
            if (agg.firstPrompt === null) agg.firstPrompt = promptText;
            agg.lastPrompt = promptText;
          }
        }
        continue;
      }

      if (obj.type === 'assistant') {
        const usage = obj.message && obj.message.usage;
        if (!usage || typeof usage !== 'object') continue; // usage 없는 assistant 라인은 skip

        addTokens(agg.tokens, usage);
        addTokens(isSidechain ? agg.sidechainTokens : agg.mainTokens, usage);

        agg.apiCalls++;
        totalApiCalls++;
        if (isSidechain) agg.sidechainApiCalls++;
        else agg.mainApiCalls++;

        const dailyPrev = dailyTotals.get(dateStr) || 0;
        dailyTotals.set(
          dateStr,
          dailyPrev +
            (usage.input_tokens || 0) +
            (usage.output_tokens || 0) +
            (usage.cache_creation_input_tokens || 0) +
            (usage.cache_read_input_tokens || 0)
        );
        if (!dailySessionIds.has(dateStr)) dailySessionIds.set(dateStr, new Set());
        dailySessionIds.get(dateStr).add(sessionId);

        const content = obj.message && obj.message.content;
        const toolBlocks = extractToolUseBlocks(content);
        const toolNames = toolBlocks.map((b) => b.name);

        if (toolNames.length > 0) agg.lastToolName = toolNames[toolNames.length - 1];

        // 도구별 / 서브에이전트별 집계: 한 API 호출에 도구가 여러 개면 그 호출의 토큰을 도구 수만큼 균등 분할해 귀속한다.
        if (toolBlocks.length > 0) {
          const divisor = toolBlocks.length;
          for (const block of toolBlocks) {
            let tAgg = toolAgg.get(block.name);
            if (!tAgg) {
              tAgg = { count: 0, tokens: newBucket() };
              toolAgg.set(block.name, tAgg);
            }
            tAgg.count++;
            addSplitTokens(tAgg.tokens, usage, divisor);

            if (SUBAGENT_TOOL_NAMES.has(block.name)) {
              totalDelegationCount++;
              if (isSidechain) nestedDelegationCount++; // 서브에이전트 내부에서 또 위임 = 중첩

              const input = block.input || {};
              const label =
                (typeof input.subagent_type === 'string' && input.subagent_type.trim()) ||
                (typeof input.description === 'string' && input.description.trim()) ||
                '(subagent_type/description 없음)';
              let sAgg = subagentAgg.get(label);
              if (!sAgg) {
                sAgg = { count: 0, tokens: newBucket() };
                subagentAgg.set(label, sAgg);
              }
              sAgg.count++;
              addSplitTokens(sAgg.tokens, usage, divisor);
            }
          }
        } else {
          const key = '(텍스트 응답, 도구 없음)';
          let tAgg = toolAgg.get(key);
          if (!tAgg) {
            tAgg = { count: 0, tokens: newBucket() };
            toolAgg.set(key, tAgg);
          }
          tAgg.count++;
          addSplitTokens(tAgg.tokens, usage, 1);
        }

        // 개별 API 호출 비용 (스펙: input + cache_creation + output, cache_read 제외)
        const sortMetric =
          (usage.input_tokens || 0) + (usage.cache_creation_input_tokens || 0) + (usage.output_tokens || 0);

        apiCalls.push({
          ts,
          sessionId,
          cwd: agg.cwd,
          input: usage.input_tokens || 0,
          output: usage.output_tokens || 0,
          cacheCreate: usage.cache_creation_input_tokens || 0,
          cacheRead: usage.cache_read_input_tokens || 0,
          sortMetric,
          toolNames,
          precedingTool: toolNames.length === 0 ? agg.lastToolName : null,
          isSidechain,
        });

        // 중복 호출 탐지: 같은 세션 내 동일 tool + 동일 input
        for (const block of toolBlocks) {
          const key = `${block.name}::${JSON.stringify(block.input)}`;
          const prev = agg.toolCallCounts.get(key);
          if (prev) {
            prev.count++;
          } else {
            agg.toolCallCounts.set(key, {
              count: 1,
              tool: block.name,
              inputPreview: truncate(block.input, 120),
            });
          }
        }
        continue;
      }
      // system / attachment / queue-operation 등은 집계 대상 아님 (cwd/시각만 세션 범위에 반영됨)
    }
  }

  if (sessions.size === 0) {
    console.log(
      `조건에 맞는 데이터가 없습니다 (기간: 최근 ${opts.days}일${
        opts.project ? `, 프로젝트 필터: "${opts.project}"` : ''
      }).`
    );
    if (parseErrors > 0) console.log(`(참고: 파싱 실패 라인 ${parseErrors}건은 건너뛰었습니다.)`);
    return;
  }

  // ── 리포트 조립 ────────────────────────────────────────────────────────

  const lines = []; // 마크다운/콘솔 겸용 텍스트 라인 버퍼
  const push = (s = '') => lines.push(s);

  const rangeLabel =
    opts.days === 1 ? `오늘 (${cutoffStr})` : `최근 ${opts.days}일 (${cutoffStr} ~ ${localDateStr(now)})`;

  push(`# Claude Code 토큰 사용량 분석 리포트`);
  push();
  push(`- 집계 기간: ${rangeLabel}`);
  push(`- 프로젝트 필터: ${opts.project ? `"${opts.project}" (cwd 부분일치)` : '없음 (전체)'}`);
  push(`- 로그 소스: ${projectsDir}`);
  push(`- 스캔한 세션 파일 수: ${files.length}`);
  if (parseErrors > 0) push(`- 파싱 실패로 건너뛴 라인: ${parseErrors}건`);
  push();

  // 1. 총량 요약
  const grand = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
  const grandMain = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
  const grandSide = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
  for (const agg of sessions.values()) {
    grand.input += agg.tokens.input;
    grand.output += agg.tokens.output;
    grand.cacheCreate += agg.tokens.cacheCreate;
    grand.cacheRead += agg.tokens.cacheRead;
    grandMain.input += agg.mainTokens.input;
    grandMain.output += agg.mainTokens.output;
    grandMain.cacheCreate += agg.mainTokens.cacheCreate;
    grandMain.cacheRead += agg.mainTokens.cacheRead;
    grandSide.input += agg.sidechainTokens.input;
    grandSide.output += agg.sidechainTokens.output;
    grandSide.cacheCreate += agg.sidechainTokens.cacheCreate;
    grandSide.cacheRead += agg.sidechainTokens.cacheRead;
  }
  const grandTotal = tokenSum(grand);

  push(`## 1. 총량 요약`);
  push();
  push(`| 항목 | 값 |`);
  push(`|---|---|`);
  push(`| 세션 수 | ${sessions.size} |`);
  push(`| 턴(사용자 프롬프트) 수 | ${fmt(totalTurns)} |`);
  push(`| assistant API 호출 수 | ${fmt(totalApiCalls)} |`);
  push(`| input_tokens 합계 | ${fmt(grand.input)} |`);
  push(`| output_tokens 합계 | ${fmt(grand.output)} |`);
  push(`| cache_creation_input_tokens 합계 | ${fmt(grand.cacheCreate)} |`);
  push(`| cache_read_input_tokens 합계 | ${fmt(grand.cacheRead)} |`);
  push(`| **총 토큰 (4항목 합)** | **${fmt(grandTotal)}** |`);
  push(`| ↳ 메인 세션 비중 | ${fmt(tokenSum(grandMain))} (${pct(grandTotal ? tokenSum(grandMain) / grandTotal : 0)}) |`);
  push(
    `| ↳ 사이드체인(서브에이전트) 비중 | ${fmt(tokenSum(grandSide))} (${pct(
      grandTotal ? tokenSum(grandSide) / grandTotal : 0
    )}) |`
  );
  push();

  // 5. 캐시 활용도 (총량 기준)
  const cacheDenom = grand.input + grand.cacheCreate + grand.cacheRead;
  const cacheHitRate = cacheDenom > 0 ? grand.cacheRead / cacheDenom : null;
  push(`**캐시 히트율**: ${cacheHitRate === null ? '데이터 없음' : pct(cacheHitRate)} ` + `(cache_read / (input + cache_creation + cache_read))`);
  push();

  // 2. 일자별 추이
  if (dailyTotals.size > 1) {
    push(`## 2. 일자별 추이`);
    push();
    push(`| 날짜 | 총 토큰 | 세션 수 |`);
    push(`|---|---|---|`);
    const sortedDates = [...dailyTotals.keys()].sort();
    for (const d of sortedDates) {
      push(`| ${d} | ${fmt(dailyTotals.get(d))} | ${dailySessionIds.get(d)?.size ?? 0} |`);
    }
    push();
  }

  // 3. 세션별 순위
  const sessionList = [...sessions.values()].map((agg) => {
    const total = tokenSum(agg.tokens);
    const avgApiPerTurn = agg.turns > 0 ? agg.apiCalls / agg.turns : agg.apiCalls > 0 ? Infinity : 0;
    return { agg, total, avgApiPerTurn };
  });
  sessionList.sort((a, b) => b.total - a.total);

  push(`## 3. 세션별 토큰 소비 순위 (Top ${opts.top})`);
  push();
  push(
    `| 순위 | 세션ID | 프로젝트(cwd) | 첫 프롬프트 | 마지막 프롬프트 | 시작~종료 | 총 토큰 | 턴 수 | API 호출 | 턴당 평균 API 호출 |`
  );
  push(`|---|---|---|---|---|---|---|---|---|---|`);
  sessionList.slice(0, opts.top).forEach((s, idx) => {
    const { agg, total, avgApiPerTurn } = s;
    const period = agg.firstTs && agg.lastTs ? `${localTimeStr(agg.firstTs)} ~ ${localTimeStr(agg.lastTs)}` : '(알 수 없음)';
    const avgStr = avgApiPerTurn === Infinity ? '∞ (턴 없이 API 호출)' : avgApiPerTurn.toFixed(1);
    const firstPromptLabel = truncate(agg.firstPrompt || '(없음)', 90);
    const lastPromptLabel = truncate(agg.lastPrompt || '(없음)', 90);
    push(
      `| ${idx + 1} | ${shortId(agg.sessionId)} | ${truncate(agg.cwd || '(unknown)', 40)} | ${firstPromptLabel} | ${lastPromptLabel} | ${period} | ${fmt(
        total
      )} | ${agg.turns} | ${agg.apiCalls} | ${avgStr} |`
    );
  });
  push();

  // 4. 가장 비싼 개별 API 호출 Top N
  apiCalls.sort((a, b) => b.sortMetric - a.sortMetric);
  push(`## 4. 가장 비싼 개별 API 호출 Top ${opts.apiTop}`);
  push();
  push(`(정렬 기준: input + cache_creation + output 합산 토큰 — cache_read는 재사용 비용이라 제외)`);
  push();
  push(`| 순위 | 시각 | 세션ID | 프로젝트(cwd) | 유발 도구 | input | cache_creation | output | cache_read | 정렬기준 합계 |`);
  push(`|---|---|---|---|---|---|---|---|---|---|`);
  apiCalls.slice(0, opts.apiTop).forEach((c, idx) => {
    let toolLabel;
    if (c.toolNames.length > 0) toolLabel = c.toolNames.join(', ');
    else if (c.precedingTool) toolLabel = `텍스트 응답 (직전 도구: ${c.precedingTool})`;
    else toolLabel = '텍스트 응답';
    if (c.isSidechain) toolLabel += ' [sidechain]';
    push(
      `| ${idx + 1} | ${localTimeStr(c.ts)} | ${shortId(c.sessionId)} | ${truncate(c.cwd || '(unknown)', 30)} | ${toolLabel} | ${fmt(
        c.input
      )} | ${fmt(c.cacheCreate)} | ${fmt(c.output)} | ${fmt(c.cacheRead)} | ${fmt(c.sortMetric)} |`
    );
  });
  push();

  // 6. 중복/반복 패턴 탐지
  const repeatEntries = [];
  for (const agg of sessions.values()) {
    for (const [, info] of agg.toolCallCounts) {
      if (info.count >= 2) {
        repeatEntries.push({ sessionId: agg.sessionId, cwd: agg.cwd, ...info });
      }
    }
  }
  repeatEntries.sort((a, b) => b.count - a.count);

  push(`## 6. 반복 호출 패턴 (같은 세션 내 동일 도구 + 동일 입력 2회 이상)`);
  push();
  if (repeatEntries.length === 0) {
    push(`반복 호출로 탐지된 패턴이 없습니다.`);
  } else {
    push(`| 세션ID | 프로젝트(cwd) | 도구 | 입력(요약) | 반복 횟수 |`);
    push(`|---|---|---|---|---|`);
    repeatEntries.slice(0, 15).forEach((r) => {
      push(`| ${shortId(r.sessionId)} | ${truncate(r.cwd || '(unknown)', 30)} | ${r.tool} | ${r.inputPreview} | ${r.count} |`);
    });
    if (repeatEntries.length > 15) push(`(그 외 ${repeatEntries.length - 15}건 더 있음)`);
  }
  push();

  // 7. 세션 개수/파편화
  push(`## 7. 세션 파편화 분석`);
  push();
  if (dailySessionIds.size > 0) {
    push(`| 날짜 | 세션 수 | 세션당 평균 턴 수 | 세션당 평균 토큰 |`);
    push(`|---|---|---|---|`);
    const sortedDates = [...dailySessionIds.keys()].sort();
    for (const d of sortedDates) {
      const ids = dailySessionIds.get(d);
      let turnsSum = 0;
      let tokenSumForDay = dailyTotals.get(d) || 0;
      for (const id of ids) {
        const agg = sessions.get(id);
        if (agg) turnsSum += agg.turns;
      }
      const n = ids.size || 1;
      push(`| ${d} | ${ids.size} | ${(turnsSum / n).toFixed(1)} | ${fmt(tokenSumForDay / n)} |`);
    }
  } else {
    push(`분석할 세션이 없습니다.`);
  }
  push();

  // 8. 도구별 사용량
  const toolList = [...toolAgg.entries()]
    .map(([name, v]) => ({ name, count: v.count, tokens: v.tokens, sortMetric: sortMetricOf(v.tokens) }))
    .sort((a, b) => b.sortMetric - a.sortMetric);

  push(`## 8. 도구별 사용량 (Top ${opts.top})`);
  push();
  push(
    `(정렬 기준: input + cache_creation + output 합산 토큰 — cache_read는 재사용 비용이라 제외. ` +
      `한 API 호출에서 도구를 여러 개 동시 사용했다면 그 호출의 토큰을 도구 수만큼 균등 분할해 귀속합니다.)`
  );
  push();
  if (toolList.length === 0) {
    push(`집계된 도구 호출이 없습니다.`);
  } else {
    push(`| 순위 | 도구 | 호출 횟수 | input | cache_creation | output | cache_read | 정렬기준 합계 |`);
    push(`|---|---|---|---|---|---|---|---|`);
    toolList.slice(0, opts.top).forEach((t, idx) => {
      push(
        `| ${idx + 1} | ${t.name} | ${t.count} | ${fmt(t.tokens.input)} | ${fmt(t.tokens.cacheCreate)} | ${fmt(
          t.tokens.output
        )} | ${fmt(t.tokens.cacheRead)} | ${fmt(t.sortMetric)} |`
      );
    });
  }
  push();

  // 9. 서브에이전트별 위임 집계
  const subagentList = [...subagentAgg.entries()]
    .map(([label, v]) => ({ label, count: v.count, tokens: v.tokens, sortMetric: sortMetricOf(v.tokens) }))
    .sort((a, b) => b.sortMetric - a.sortMetric);

  push(`## 9. 서브에이전트별 위임 집계 (Task/Agent 도구, Top ${opts.top})`);
  push();
  if (subagentList.length === 0) {
    push(`서브에이전트 위임(Task/Agent 도구) 호출이 탐지되지 않았습니다.`);
  } else {
    push(
      `(표시된 토큰은 위임을 호출한 시점의 API 호출 토큰입니다 — 서브에이전트 내부 실행에서 실제로 소비된 토큰은 별도 ` +
        `sidechain으로 집계되며 여기에는 포함되지 않습니다. sidechain 총량 비중은 1번 섹션을 참고하세요.)`
    );
    push();
    push(`| 순위 | 서브에이전트(subagent_type/description) | 위임 횟수 | input | cache_creation | output | cache_read | 정렬기준 합계 |`);
    push(`|---|---|---|---|---|---|---|---|`);
    subagentList.slice(0, opts.top).forEach((s, idx) => {
      push(
        `| ${idx + 1} | ${truncate(s.label, 60)} | ${s.count} | ${fmt(s.tokens.input)} | ${fmt(
          s.tokens.cacheCreate
        )} | ${fmt(s.tokens.output)} | ${fmt(s.tokens.cacheRead)} | ${fmt(s.sortMetric)} |`
      );
    });
  }
  push();

  // 10. 프로젝트(cwd)별 집계
  const projectAgg = new Map(); // cwd -> { sessionIds: Set, tokens: bucket }
  for (const agg of sessions.values()) {
    const key = agg.cwd || '(unknown)';
    let pAgg = projectAgg.get(key);
    if (!pAgg) {
      pAgg = { sessionIds: new Set(), tokens: newBucket() };
      projectAgg.set(key, pAgg);
    }
    pAgg.sessionIds.add(agg.sessionId);
    pAgg.tokens.input += agg.tokens.input;
    pAgg.tokens.output += agg.tokens.output;
    pAgg.tokens.cacheCreate += agg.tokens.cacheCreate;
    pAgg.tokens.cacheRead += agg.tokens.cacheRead;
  }
  const projectList = [...projectAgg.entries()]
    .map(([cwd, v]) => {
      const total = tokenSum(v.tokens);
      const denom = v.tokens.input + v.tokens.cacheCreate + v.tokens.cacheRead;
      const hitRate = denom > 0 ? v.tokens.cacheRead / denom : null;
      return { cwd, total, sessionCount: v.sessionIds.size, hitRate };
    })
    .sort((a, b) => b.total - a.total);

  push(`## 10. 프로젝트(cwd)별 집계 (Top ${opts.top})`);
  push();
  push(`(개인정보 유의: cwd는 로컬 작업 디렉터리 절대경로입니다. 공유 전 SKILL.md의 "개인정보 유의" 안내를 참고하세요.)`);
  push();
  if (projectList.length === 0) {
    push(`집계된 프로젝트가 없습니다.`);
  } else {
    push(`| 순위 | 프로젝트(cwd) | 총 토큰 | 세션 수 | 캐시 히트율 |`);
    push(`|---|---|---|---|---|`);
    projectList.slice(0, opts.top).forEach((p, idx) => {
      push(
        `| ${idx + 1} | ${truncate(p.cwd, 50)} | ${fmt(p.total)} | ${p.sessionCount} | ${
          p.hitRate === null ? '데이터 없음' : pct(p.hitRate)
        } |`
      );
    });
  }
  push();

  // ── 효율화 가이드 (관측된 수치 기반 룰) ────────────────────────────────
  const guide = [];

  if (cacheHitRate !== null && cacheHitRate < 0.5) {
    guide.push(
      `- **캐시 히트율이 ${pct(cacheHitRate)}로 낮습니다.** 캐시가 재사용되지 않고 매번 컨텍스트를 새로 읽고 있다는 뜻입니다. ` +
        `/compact를 지나치게 자주 쓰거나, 서로 무관한 작업을 한 세션에서 이어가며 컨텍스트를 자주 리셋하고 있지 않은지 점검하세요. ` +
        `관련 없는 작업은 세션을 나눠서 시작하면 캐시 재사용률이 올라갑니다.`
    );
  }

  if (repeatEntries.length > 0) {
    const top = repeatEntries[0];
    guide.push(
      `- **동일 도구+입력 반복 호출이 ${repeatEntries.length}건 탐지되었습니다.** ` +
        `예: 세션 ${shortId(top.sessionId)}에서 ${top.tool}을(를) 동일 입력으로 ${top.count}회 호출했습니다. ` +
        `이미 읽은 파일을 다시 Read하거나 같은 Bash 커맨드를 재실행하는 대신, 직전 결과를 재활용하도록 지시하면 토큰 낭비를 줄일 수 있습니다.`
    );
  }

  const longChainSessions = sessionList.filter((s) => Number.isFinite(s.avgApiPerTurn) && s.avgApiPerTurn >= 15);
  if (longChainSessions.length > 0) {
    const worst = longChainSessions.sort((a, b) => b.avgApiPerTurn - a.avgApiPerTurn)[0];
    guide.push(
      `- **턴당 평균 API 호출 수가 지나치게 긴 세션이 ${longChainSessions.length}건 있습니다.** ` +
        `예: 세션 ${shortId(worst.agg.sessionId)}은 턴당 평균 ${worst.avgApiPerTurn.toFixed(1)}회의 API 호출이 발생했습니다. ` +
        `한 턴 안에서 tool 호출 체인이 길어질수록 컨텍스트가 누적되어 토큰이 기하급수적으로 커집니다. ` +
        `작업을 더 작은 단위로 쪼개거나 중간에 명시적으로 정리(요약/compact)하는 것을 고려하세요.`
    );
  }

  if (grandTotal > 0) {
    const topSessionShare = sessionList.length > 0 ? sessionList[0].total / grandTotal : 0;
    if (topSessionShare >= 0.4 && sessionList.length > 1) {
      guide.push(
        `- **단일 세션(${shortId(sessionList[0].agg.sessionId)})이 전체 토큰의 ${pct(topSessionShare)}를 차지합니다.** ` +
          `한 세션에서 컨텍스트를 과도하게 쌓아온 것으로 보입니다. 작업 단위를 나눠 여러 세션으로 분리하거나, 주기적으로 /compact나 세션 재시작을 통해 컨텍스트를 정리하세요.`
      );
    }
  }

  // 파편화(세션 多 + 세션당 턴 少) 감지: 활동일 중 세션 수가 5개 이상이고 세션당 평균 턴이 2 이하인 날
  const fragmentedDays = [];
  for (const [d, ids] of dailySessionIds) {
    if (ids.size >= 5) {
      let turnsSum = 0;
      for (const id of ids) {
        const agg = sessions.get(id);
        if (agg) turnsSum += agg.turns;
      }
      const avgTurns = turnsSum / ids.size;
      if (avgTurns <= 2) fragmentedDays.push({ date: d, sessionCount: ids.size, avgTurns });
    }
  }
  if (fragmentedDays.length > 0) {
    const worstDay = fragmentedDays[0];
    guide.push(
      `- **세션 파편화가 관측됩니다.** ${worstDay.date}에 세션이 ${worstDay.sessionCount}개나 생성됐는데 세션당 평균 턴은 ${worstDay.avgTurns.toFixed(
        1
      )}회에 불과합니다. ` +
        `작업을 시작할 때마다 새 세션으로 열고 있다면, 관련된 작업은 같은 세션에서 이어가는 편이 캐시를 재사용해 더 효율적입니다.`
    );
  }

  if (grandMain.input + grandMain.cacheCreate > 0) {
    const sidechainShare = grandTotal > 0 ? tokenSum(grandSide) / grandTotal : 0;
    if (sidechainShare >= 0.3) {
      guide.push(
        `- **사이드체인(서브에이전트/Task 호출) 비중이 ${pct(sidechainShare)}로 높습니다.** ` +
          `Task 도구로 서브에이전트를 과도하게 병렬/중첩 호출하고 있지 않은지 점검하세요.`
      );

      // 비중이 높다는 것만으로는 병리적 중첩 위임인지 정상적인 대형 단일 위임인지 구분되지 않는다.
      // totalDelegationCount/nestedDelegationCount는 위 파싱 루프에서 이미 걸린 기간·프로젝트 필터를
      // 그대로 물려받은 값이라 별도 스코프 보정이 필요 없다.
      if (nestedDelegationCount > 0) {
        guide.push(
          `- **실제 중첩 위임 ${nestedDelegationCount}건 발견** — 서브에이전트가 스스로 또 다른 서브에이전트를 호출한 사례가 ` +
            `확인됩니다(집계 기간: ${rangeLabel}). Task 체인이 여러 단계로 깊어지고 있는지 점검하세요.`
        );
      } else if (totalDelegationCount > 0) {
        guide.push(
          `- **집계 기간(${rangeLabel}) 내에서는 중첩 위임 근거가 없습니다.** ` +
            `확인된 위임 ${totalDelegationCount}건 모두 메인 세션이 직접 호출했을 뿐, ` +
            `서브에이전트가 스스로 또 위임한 사례는 없습니다. 중첩 위임이 아니라 개별 서브에이전트 호출 자체가 크고 복잡했을 가능성이 높습니다.`
        );
      } else if (opts.project) {
        // 사이드체인 토큰 비중은 높은데(>=0.3) 위임 호출(Task/Agent) 자체는 이 기간 안에서 관측되지 않은 경우다.
        // --project 필터가 걸려 있으면, 위임을 발행한 세션(부모)의 cwd와 그 위임으로 실행된 서브에이전트
        // 세션(자식)의 cwd가 서로 다를 수 있다(예: 워크트리로 격리된 서브에이전트) — 그 경우 자식의 sidechain
        // 라인만 필터를 통과하고 부모의 Task 호출 라인은 스코프 밖으로 걸러져, 사이드체인 토큰은 잡히는데
        // 그걸 발행한 위임 호출 자체는 관측되지 않을 수 있다. 이 스크립트는 실제로 그 비대칭이 이번 경우의
        // 원인인지까지는 알 수 없으므로(그 확인에는 --project 필터를 뺀 재실행이 필요하다) 원인을 확정하지
        // 않고, 필터가 걸려 있다는 사실과 확인 방법만 안내한다.
        guide.push(
          `- **중첩 여부 판별 불가.** 집계 기간(${rangeLabel}) 내에서 서브에이전트 위임 호출(Task/Agent)이 관측되지 않았습니다. ` +
            `\`--project "${opts.project}"\` 필터가 걸려 있습니다 — 위임을 발행한 세션의 cwd가 이 필터 문자열과 다르면(예: 워크트리로 ` +
            `격리된 서브에이전트와 그 위임을 발행한 세션이 서로 다른 cwd를 쓰는 경우) 그 Task 호출 라인만 스코프 밖으로 제외되어, ` +
            `사이드체인 토큰은 잡히는데 그걸 발행한 위임 호출은 관측되지 않을 수 있습니다. \`--project\` 없이(또는 다른 프로젝트 값으로) ` +
            `다시 실행해 위임 호출이 나타나는지 확인하세요. 중첩 여부를 판별할 수 없다는 뜻이며, 이를 "중첩 없음"으로 해석하지 마세요.`
        );
      } else {
        // 프로젝트 필터가 없는데도 위임 호출 자체가 관측되지 않는 경우 — 스크립트가 알 수 있는 구조적 원인이
        // 없으므로(시간창 확대로 해결된다는 보장도 없다) 원인을 지어내지 않고 판별 불가로만 안내한다.
        guide.push(
          `- **중첩 여부 판별 불가.** 집계 기간(${rangeLabel}) 내에서 서브에이전트 위임 호출(Task/Agent)이 관측되지 않았습니다. ` +
            `원인을 특정할 수 있는 데이터가 없습니다. 중첩 여부를 판별할 수 없다는 뜻이며, 이를 "중첩 없음"으로 해석하지 마세요.`
        );
      }
    }
  }

  push(`## 효율화 가이드`);
  push();
  if (guide.length === 0) {
    push(`관측된 데이터 범위에서는 뚜렷한 비효율 패턴이 발견되지 않았습니다.`);
  } else {
    for (const g of guide) push(g);
  }
  push();

  const report = lines.join('\n');
  console.log(report);
}

run().catch((err) => {
  console.error('분석 중 예기치 않은 오류가 발생했습니다:', err && err.message ? err.message : err);
  process.exit(1);
});
