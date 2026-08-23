#!/usr/bin/env node
/**
 * report-usage.mjs
 *
 * Claude Code 로컬 세션 로그(~/.claude/projects/**\/*.jsonl)를 세션별로 집계해
 * malgnai-hub(POST /api/sessions)로 전송하는 실행 스크립트. 매시간 launchd/schtasks로
 * 자동 실행되는 것을 전제로 한다 (install-usage-agent.mjs 참고).
 *
 * 집계 대상 선정과 전송값의 의미가 서로 다르다는 점이 핵심이다:
 *  - "이번에 보낼 세션"은 최근에 활동이 있었던 세션만 고른다 (since 커트오프).
 *  - 하지만 그 세션의 각 값(토큰/도구호출 수 등)은 항상 "그 세션의 처음부터 지금까지 누적 총합"이다.
 *    서버가 id = sha256(device_id + ':' + claude_session_id) 로 upsert하며 "최종 누적값"으로
 *    덮어쓰기 때문에, 증분이 아니라 매번 전체 누적값을 보내야 한다 (재전송 = 멱등, 안전).
 *
 * 순수 Node 내장모듈만 사용. analyze-usage.mjs는 절대 건드리지 않으며(콘솔 전용 계약 유지),
 * 필요한 파싱 로직은 이 파일에 독립적으로 재구현한다.
 *
 * 사용법:
 *   node report-usage.mjs [--since <ISO시각|일수>] [--dry-run]
 *
 *   --since <값>  이 시각(또는 N일 전) 이후 활동이 있었던 세션만 대상으로 한다.
 *                 생략하면 마지막 성공 전송 시각(없으면 오늘 0시, 로컬 타임존) 이후로 자동 계산되며,
 *                 catch-up 최대 30일로 clamp된다 (PC가 며칠 꺼져 있었어도 다음 실행이 자동 복구).
 *   --dry-run     실제 전송 없이 세션별 payload를 콘솔에 출력만 한다 (device_token 없어도 실행 가능).
 *
 * 개인정보 하드 제약:
 *  - summary 필드는 첫 사용자 프롬프트를 120자로 truncate한 "세션 제목"만 전송한다
 *    (2026-08-19 사용자 최종 결정). 그 이상의 프롬프트 전문은 전송하지 않는다.
 *  - cwd 원문 절대경로는 payload 어디에도 넣지 않는다 (repository_key는 git remote owner/repo만)
 *  - 도구 input 원문은 절대 전송하지 않는다
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';

import {
  resolveApiBase,
  resolvePluginVersion,
  readCredentials,
  readLastRun,
  writeLastRun,
  deriveRepositoryKey,
  requestJson,
  nowIso,
} from './usage-agent-lib.mjs';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { since: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--since':
        opts.since = argv[++i] ?? null;
        break;
      case '--dry-run':
        opts.dryRun = true;
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
  const SELF = `node "${process.argv[1]}"`
  console.log(`사용법: ${SELF} [--since <ISO시각|일수>] [--dry-run]

  --since <값>  이 시각(ISO 8601) 또는 N일 전 이후 활동이 있었던 세션만 대상으로 함.
                생략 시 마지막 성공 전송 이후(없으면 오늘 0시)부터 자동 계산, 최대 30일 catch-up.
  --dry-run     실제 전송 없이 payload만 콘솔에 출력 (device_token 불필요).

전송 결과는 ~/.claude/malgnai-hub/usage-agent-last-run.json 에 기록됩니다.`);
}

function parseSince(value) {
  if (value == null) return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const days = Number(value);
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// ── jsonl 파싱 (analyze-usage.mjs와 별개의 독립 구현 — 그 파일은 수정하지 않는다) ──

function findJsonlFiles(baseDir) {
  const results = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) results.push(full);
    }
  }
  walk(baseDir);
  return results;
}

function isHumanPromptContent(content) {
  if (content == null) return false;
  if (typeof content === 'string') return content.trim().length > 0;
  if (Array.isArray(content)) {
    if (content.length === 0) return false;
    return content.some((block) => block && block.type !== 'tool_result');
  }
  return false;
}

function extractToolUseBlocks(content) {
  if (!Array.isArray(content)) return [];
  return content.filter((b) => b && b.type === 'tool_use');
}

/** 세션 제목용 — 첫 사용자 프롬프트 텍스트만 뽑아 공백 정규화 (analyze-usage.mjs의 extractHumanPromptText와 동일 로직). */
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
  return (raw || '').replace(/\s+/g, ' ').trim();
}

/** 세션 제목 — 첫 사용자 프롬프트를 120자로 truncate (malgnai-public sessions.summary CHECK(length<=120)와 동일 캡).
 *  Array.from으로 코드포인트 단위로 잘라 서로게이트 페어(이모지 등) 중간이 깨지지 않게 한다(단순 string.slice는
 *  UTF-16 코드유닛 단위라 서로게이트 페어를 반으로 자를 수 있음 — reviewer 지적, 2026-08-19). */
const SUMMARY_MAX_LEN = 120;
function truncateSummary(text) {
  if (!text) return null;
  const chars = Array.from(text);
  if (chars.length <= SUMMARY_MAX_LEN) return text;
  return chars.slice(0, SUMMARY_MAX_LEN - 1).join('') + '…';
}

function newAgg(sessionId) {
  return {
    sessionId,
    cwd: null,
    firstTs: null,
    lastTs: null,
    tokens: { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 },
    firstPrompt: null, // 세션 제목용 — 첫 사용자 프롬프트 텍스트(120자로 잘라 summary에 사용)
    turns: 0, // 사용자 프롬프트 수 (참고: analyze-usage.mjs의 agg.turns와 동일 계산 로직)
    apiCalls: 0, // usage 필드가 있는 assistant 라인 수 (참고: agg.apiCalls와 동일 계산 로직)
    toolCalls: 0,
    toolErrors: 0,
    filesRead: 0,
    filesChanged: 0,
    modelCounts: new Map(),
  };
}

/** 전체 로그를 스트리밍하며 세션별 "처음부터 지금까지 누적" 집계를 만든다 (날짜로 라인을 잘라내지 않는다). */
async function aggregateAllSessions(projectsDir) {
  const files = findJsonlFiles(projectsDir);
  const sessions = new Map();

  for (const file of files) {
    let stream;
    try {
      stream = fs.createReadStream(file, { encoding: 'utf8' });
    } catch (err) {
      continue;
    }
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const rawLine of rl) {
      const line = rawLine.trim();
      if (!line) continue;

      let obj;
      try {
        obj = JSON.parse(line);
      } catch (err) {
        continue;
      }
      if (!obj || typeof obj !== 'object') continue;

      const ts = obj.timestamp ? new Date(obj.timestamp) : null;
      if (!ts || Number.isNaN(ts.getTime())) continue;

      const sessionId = obj.sessionId || `(no-session:${path.basename(file)})`;
      let agg = sessions.get(sessionId);
      if (!agg) {
        agg = newAgg(sessionId);
        sessions.set(sessionId, agg);
      }

      const cwd = typeof obj.cwd === 'string' ? obj.cwd : null;
      if (cwd && !agg.cwd) agg.cwd = cwd;
      if (!agg.firstTs || ts < agg.firstTs) agg.firstTs = ts;
      if (!agg.lastTs || ts > agg.lastTs) agg.lastTs = ts;

      if (obj.type === 'user') {
        const content = obj.message && obj.message.content !== undefined ? obj.message.content : obj.content;
        if (isHumanPromptContent(content)) {
          agg.turns++;
          if (agg.firstPrompt === null) {
            const text = extractHumanPromptText(content);
            if (text) agg.firstPrompt = text;
          }
        }
        // tool_result의 is_error 플래그로 tool_errors 집계 (재시도 개념은 로그에 없어 별도 추정하지 않음)
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block && block.type === 'tool_result' && block.is_error === true) agg.toolErrors++;
          }
        }
        continue;
      }

      if (obj.type === 'assistant') {
        const usage = obj.message && obj.message.usage;
        if (!usage || typeof usage !== 'object') continue;

        agg.tokens.input += usage.input_tokens || 0;
        agg.tokens.output += usage.output_tokens || 0;
        agg.tokens.cacheCreate += usage.cache_creation_input_tokens || 0;
        agg.tokens.cacheRead += usage.cache_read_input_tokens || 0;
        agg.apiCalls++;

        const model = obj.message && typeof obj.message.model === 'string' ? obj.message.model : null;
        if (model) agg.modelCounts.set(model, (agg.modelCounts.get(model) || 0) + 1);

        const content = obj.message && obj.message.content;
        const toolBlocks = extractToolUseBlocks(content);
        agg.toolCalls += toolBlocks.length;
        for (const block of toolBlocks) {
          if (block.name === 'Read') agg.filesRead++;
          else if (block.name === 'Edit' || block.name === 'Write') agg.filesChanged++;
        }
      }
      // system / attachment 등은 집계 대상 아님
    }
  }

  return sessions;
}

function pickModel(modelCounts) {
  let best = null;
  let bestCount = -1;
  for (const [m, c] of modelCounts) {
    if (c > bestCount) {
      best = m;
      bestCount = c;
    }
  }
  return best || undefined;
}

function buildPayload(agg, pluginVersion, repoKeyFor) {
  const payload = {
    claude_session_id: agg.sessionId,
    started_at: agg.firstTs.toISOString(),
  };
  if (agg.lastTs) payload.ended_at = agg.lastTs.toISOString();
  if (agg.firstTs && agg.lastTs) {
    payload.duration_seconds = Math.max(0, Math.round((agg.lastTs.getTime() - agg.firstTs.getTime()) / 1000));
  }

  const repoKey = repoKeyFor(agg.cwd);
  if (repoKey) payload.repository_key = repoKey; // git 원격 없으면 생략 → 서버가 project_id NULL 처리

  payload.plugin_version = pluginVersion;

  const model = pickModel(agg.modelCounts);
  if (model) payload.model = model;

  payload.input_tokens = Math.round(agg.tokens.input);
  payload.output_tokens = Math.round(agg.tokens.output);
  payload.cache_read_tokens = Math.round(agg.tokens.cacheRead);
  payload.cache_write_tokens = Math.round(agg.tokens.cacheCreate);

  // turns/api_calls: malgnai-public migration 0012로 sessions/usage_daily에 컬럼이 추가되어
  // 이제 전송 바디에 채워 넣는다 (둘 다 optional·NOT NULL DEFAULT 0, 음수는 서버가 0으로 clamp).
  payload.turns = Math.max(0, agg.turns);
  payload.api_calls = Math.max(0, agg.apiCalls);

  payload.tool_calls = agg.toolCalls;
  payload.tool_errors = agg.toolErrors;
  payload.retries = 0; // 로그에 "재시도" 개념이 없어 근사치 없이 항상 0 전송 (근사/생략)
  payload.files_read = agg.filesRead;
  payload.files_changed = agg.filesChanged;
  payload.commits = 0; // git commit 탐지는 과도한 엔지니어링이라 생략, 항상 0 전송 (근사/생략)
  // 세션 제목: 첫 사용자 프롬프트를 120자로 truncate해 전송 (2026-08-19 사용자 최종 결정 —
  // "세션ID만으론 무슨 세션인지 식별 불가" 지적에 따른 국소 예외).
  // 프롬프트 전문/도구 input 원문은 여전히 전송하지 않는다.
  payload.summary = truncateSummary(agg.firstPrompt);

  return payload;
}

async function run() {
  const opts = parseArgs(process.argv.slice(2));
  const apiBase = resolveApiBase();
  const pluginVersion = resolvePluginVersion();
  const lastRun = readLastRun();

  // since 커트오프 계산
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const maxLookback = new Date(now.getTime() - THIRTY_DAYS_MS);

  let sinceCutoff;
  if (opts.since) {
    const parsed = parseSince(opts.since);
    if (!parsed) {
      console.error(`--since 값을 해석할 수 없습니다: "${opts.since}" (ISO 8601 시각 또는 일수만 지원)`);
      process.exit(1);
    }
    sinceCutoff = parsed;
  } else if (lastRun && lastRun.last_success_at) {
    sinceCutoff = new Date(lastRun.last_success_at);
  } else {
    sinceCutoff = startOfToday;
  }
  if (sinceCutoff < maxLookback) sinceCutoff = maxLookback; // catch-up window 최대 30일

  const creds = readCredentials();
  if (!opts.dryRun && (!creds || !creds.device_token)) {
    console.error('페어링된 디바이스가 없습니다. 먼저 pair-usage-device.mjs 를 실행하세요.');
    writeLastRun({
      last_run_at: nowIso(),
      last_success_at: lastRun && lastRun.last_success_at ? lastRun.last_success_at : null,
      since_used: sinceCutoff.toISOString(),
      sessions_considered: 0,
      sent_success: 0,
      sent_fail: 0,
      last_error: 'not_paired',
    });
    process.exit(0); // launchd가 매시간 재시도하므로 non-zero로 소란 피우지 않는다
  }

  const projectsDir = path.join(os.homedir(), '.claude', 'projects');
  if (!fs.existsSync(projectsDir)) {
    console.log(`세션 로그 디렉터리가 없습니다: ${projectsDir} (보낼 것이 없습니다)`);
    if (!opts.dryRun) {
      writeLastRun({
        last_run_at: nowIso(),
        last_success_at: nowIso(), // 보낼 게 없는 것도 "이번 창은 완료"로 간주 — 다음 실행은 지금부터 이어감
        since_used: sinceCutoff.toISOString(),
        sessions_considered: 0,
        sent_success: 0,
        sent_fail: 0,
        last_error: null,
      });
    }
    return;
  }

  const sessions = await aggregateAllSessions(projectsDir);

  // 참고용 로컬 계산값(turns/api_calls)은 buildPayload 안에서 그대로 전송 바디에 포함된다 —
  // analyze-usage.mjs의 agg.turns/agg.apiCalls와 동일한 계산 로직을 이 파일에 독립 재구현한 것.
  const candidates = [];
  for (const agg of sessions.values()) {
    if (agg.apiCalls === 0) continue; // 실제 API 사용(토큰 소비) 없는 세션은 보고 대상 아님
    if (!agg.lastTs || agg.lastTs < sinceCutoff) continue; // 최근 활동 없는 세션은 이번 창에서 스킵
    candidates.push(agg);
  }

  const repoKeyCache = new Map();
  function repoKeyFor(cwd) {
    if (!cwd) return undefined;
    if (repoKeyCache.has(cwd)) return repoKeyCache.get(cwd);
    const key = deriveRepositoryKey(cwd);
    repoKeyCache.set(cwd, key);
    return key;
  }

  let sentSuccess = 0;
  let sentFail = 0;
  const failures = [];

  for (const agg of candidates) {
    const payload = buildPayload(agg, pluginVersion, repoKeyFor);

    if (opts.dryRun) {
      console.log(JSON.stringify(payload));
      continue;
    }

    try {
      const res = await requestJson('POST', `${apiBase}/api/sessions`, {
        headers: { Authorization: `Bearer ${creds.device_token}` },
        body: payload,
      });
      if (res.status === 200 && res.json && res.json.accepted) {
        sentSuccess++;
      } else {
        sentFail++;
        failures.push({
          sessionId: agg.sessionId,
          status: res.status,
          error: res.json && res.json.error ? res.json.error : res.text,
        });
      }
    } catch (err) {
      // 네트워크 에러/타임아웃 등: 조용히 스킵하고 다음 세션으로. 재시도 루프는 만들지 않는다
      // (launchd/schtasks가 다음 스케줄에서 자동으로 다시 시도한다).
      sentFail++;
      failures.push({ sessionId: agg.sessionId, error: err && err.message ? err.message : String(err) });
    }
  }

  if (opts.dryRun) {
    console.log(`[dry-run] 대상 세션 ${candidates.length}건 (전송 없음, since=${sinceCutoff.toISOString()})`);
    return;
  }

  // 이번 창을 "성공"으로 간주하는 조건: 보낼 게 없었거나(0건), 실패가 하나도 없었을 때만.
  // 일부라도 실패했다면 last_success_at을 갱신하지 않아 다음 실행이 같은 지점부터 다시 시도한다
  // (그래야 실패한 세션이 since 커트오프 이동으로 인해 누락되지 않는다 — 최대 30일 catch-up으로 clamp됨).
  const fullySucceeded = candidates.length === 0 || sentFail === 0;

  writeLastRun({
    last_run_at: nowIso(),
    last_success_at: fullySucceeded ? nowIso() : (lastRun && lastRun.last_success_at ? lastRun.last_success_at : null),
    since_used: sinceCutoff.toISOString(),
    sessions_considered: candidates.length,
    sent_success: sentSuccess,
    sent_fail: sentFail,
    last_error: failures.length > 0 ? failures[0] : null,
  });

  console.log(
    `대상 세션 ${candidates.length}건 중 성공 ${sentSuccess}건, 실패 ${sentFail}건 (since=${sinceCutoff.toISOString()})`
  );
  if (failures.length > 0) {
    console.log('실패 세션 상세(최대 10건):', JSON.stringify(failures.slice(0, 10)));
  }
}

run().catch((err) => {
  console.error('전송 중 예기치 않은 오류가 발생했습니다:', err && err.message ? err.message : err);
  process.exit(1);
});