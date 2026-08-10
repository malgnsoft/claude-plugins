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
 *   node analyze-usage.mjs [--days N] [--project <cwd 부분일치>] [--top N] [--out <md파일경로>]
 *
 * 옵션:
 *   --days N     기본 1. 로컬 타임존 기준 최근 N일(오늘 포함)을 집계.
 *   --project S  cwd에 S가 부분 포함된 세션만 집계 (필터 없으면 전체).
 *   --top N      세션/API호출 순위에서 상위 몇 건을 보여줄지. 기본 5 (API 호출 Top은 기본 10).
 *   --out PATH   같은 리포트를 마크다운 파일로도 저장.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { days: 1, project: null, top: 5, apiTop: 10, out: null };
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
      case '--out':
        opts.out = argv[++i] ?? null;
        break;
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
  console.log(`사용법: node analyze-usage.mjs [--days N] [--project <cwd 부분일치>] [--top N] [--out <md파일경로>]

  --days N     최근 N일 집계 (기본 1 = 오늘, 로컬 타임존 기준)
  --project S  cwd에 S가 포함된 세션만 집계
  --top N      세션 순위 Top N (기본 5, API 호출 Top은 자동으로 그 2배)
  --out PATH   결과를 마크다운 파일로도 저장
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
  let totalTurns = 0;
  let totalApiCalls = 0;
  let parseErrors = 0;
  let skippedByFilter = 0;

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
  push(`| 순위 | 세션ID | 프로젝트(cwd) | 시작~종료 | 총 토큰 | 턴 수 | API 호출 | 턴당 평균 API 호출 |`);
  push(`|---|---|---|---|---|---|---|---|`);
  sessionList.slice(0, opts.top).forEach((s, idx) => {
    const { agg, total, avgApiPerTurn } = s;
    const period = agg.firstTs && agg.lastTs ? `${localTimeStr(agg.firstTs)} ~ ${localTimeStr(agg.lastTs)}` : '(알 수 없음)';
    const avgStr = avgApiPerTurn === Infinity ? '∞ (턴 없이 API 호출)' : avgApiPerTurn.toFixed(1);
    push(
      `| ${idx + 1} | ${shortId(agg.sessionId)} | ${truncate(agg.cwd || '(unknown)', 40)} | ${period} | ${fmt(
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

  if (opts.out) {
    try {
      fs.writeFileSync(opts.out, report, 'utf8');
      console.log(`\n(마크다운 리포트 저장됨: ${path.resolve(opts.out)})`);
    } catch (err) {
      console.error(`\n마크다운 파일 저장 실패: ${err.message}`);
    }
  }
}

run().catch((err) => {
  console.error('분석 중 예기치 않은 오류가 발생했습니다:', err && err.message ? err.message : err);
  process.exit(1);
});
