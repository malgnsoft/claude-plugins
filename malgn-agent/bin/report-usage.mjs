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
 *  - summary는 그 truncate 전에 반드시 scrubSecrets()를 거친다 — 첫 프롬프트에 API 키/토큰/
 *    비밀번호/Bearer 토큰/사용자 홈 절대경로(실명 계정명 노출)가 원문 그대로 섞여 있을 수 있어,
 *    그 값들을 패턴 마스킹한 뒤에만 truncate·전송한다. buildPayload() 단 한 지점에서만 배선하고
 *    (§ scrubSecrets 참고), 스크럽이 실패(예외)하면 그 레코드는 절대 원문 그대로 내보내지 않고
 *    세션 자체를 건너뛴다(안전 실패 — run()의 payload 생성 try/catch 참고).
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

// ── summary 전송 직전 스크러빙 (단일 지점) ─────────────────────────────────
// summary는 사용자가 코드/에러 로그/설정 조각을 그대로 붙여넣은 프롬프트일 수 있어, 아래 패턴에
// 해당하는 크리덴셜류와 사용자 홈 절대경로(실명 계정명 노출)를 전송 전에 마스킹한다.
// - 각 패턴은 "흔한 일반 단어를 오탐하지 않을 만큼 충분히 구체적인 형태"만 골랐다(과잉 마스킹으로
//   세션 제목이 통째로 의미 없어지는 것을 피하기 위함) — 단, kv-secret/hex32 두 패턴은 보안을
//   우선해 약간의 과잉 마스킹(예: 무해한 커밋해시·MD5가 같이 가려짐)을 감수한다. summary는 통계
//   집계에 쓰이는 필드가 아니라 사람이 읽는 "세션 제목"이므로 그 정도 손실은 안전 이득에 비해 작다.
const SECRET_PATTERNS = [
  // sk-... 류 (OpenAI/Anthropic API 키 형태). 최소 16자 이상만 대상으로 해 "sk-and-go" 같은 짧은
  // 단어 조합을 오탐하지 않는다.
  { name: 'sk-key', re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  // AWS Access Key ID (형태가 고정적이라 오탐 위험이 거의 없음)
  { name: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  // GitHub 개인 액세스 토큰류 (ghp_/gho_/ghu_/ghs_/ghr_/github_pat_ 접두사 고정)
  { name: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  // Slack 토큰 (xoxb-/xoxp-/xoxa-/xoxr-/xoxs- 접두사 고정)
  { name: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  // JWT: header.payload.signature (base64url 세그먼트 3개, 각 10자 이상) — "ey"로 시작하는 헤더는
  // JSON을 base64url 인코딩한 JWT의 사실상 불변 지문이라 오탐이 극히 드물다.
  { name: 'jwt', re: /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  // Authorization: Bearer <token> — "Bearer" 키워드 자체가 명시적 신호
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._-]{8,}\b/gi },
  // api_key/secret/token/password/passwd/pwd/access_key 같은 크리덴셜 변수명 뒤에 '=' 또는 ':'로
  // 실제 값이 붙는 형태만 마스킹한다(변수명은 남기고 값만 지움 — "token: " 같은 라벨 자체는 통계적
  // 신호로 남겨도 안전하다).
  // `.env`/셸 export 관용 표기(AWS_SECRET_ACCESS_KEY=, DB_PASSWORD=, STAGING_TOKEN= 등)를 잡기
  // 위해 키워드 앞뒤에 `_`/`-`로 이어붙는 대문자 스네이크 세그먼트를 옵션으로 허용한다 — `\b`는
  // `_`·영숫자 사이에서 성립하지 않아(둘 다 word 문자) 원래 패턴은 접두어가 붙은 키를 전혀
  // 못 잡았다(예: `AWS_SECRET_ACCESS_KEY=`에서 `SECRET` 앞의 `_`가 경계를 깨 매치 실패, 값 뒤에
  // 붙는 `_ACCESS_KEY`도 키워드와 `=` 사이를 갈라놔 매치 실패). 전체 시작 위치는 여전히 `\b`로
  // 고정해 진짜 알파벳/숫자 바로 뒤에 낀 경우(false negative 확대 없음)만 넓힌다.
  // 값의 끝은 "어떤 문자가 허용되는가"가 아니라 "어디서 값이 구조적으로 끝나는가"로 판정한다 —
  // 따옴표로 감싸인 값은 닫는 따옴표까지(내부에 공백·특수문자가 있어도 전부 값), 따옴표가 없으면
  // 공백이 나오기 전까지의 비공백 문자열 전체(\S+)를 값으로 본다. 값 문자클래스를 특수문자 목록으로
  // 나열하는 방식은 실제 비밀번호에 흔한 `@!#$%^&*` 등이 하나라도 빠지면 그 지점에서 매치가
  // 끊겨 선두 특수문자는 매치 자체가 실패하고(예: `P@ssw0rd`) 중간 특수문자는 꼬리가 그대로
  // 새는(예: `abc123!@#tail` → `abc123`만 마스킹) 결함으로 이어졌다. 값 뒤에 공백으로 분리된
  // 후속 문장(사람이 쓴 산문)은 \S+가 공백에서 멈추므로 보존된다.
  {
    name: 'kv-secret',
    re: /\b(?:[A-Za-z0-9]+[_-])*(?:api[_-]?key|secret|token|passwd|password|pwd|access[_-]?key)(?:[_-][A-Za-z0-9]+)*\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|\S+)/gi,
  },
  // 32자 이상 연속된 hex 문자열(세션 시크릿/해시류 흔한 형태). 커밋해시(7~12자)보다 길게 잡아
  // 짧은 참조 문자열은 건드리지 않는다.
  { name: 'hex32', re: /\b[a-f0-9]{32,}\b/gi },
];

/** 사용자 홈 절대경로(실명 계정명 노출)를 마스킹한다.
 *  1) 이 스크립트를 실행 중인 계정의 실제 홈 경로(os.homedir())를 최우선으로 정확히 치환한다.
 *  2) 다른 사람의 로그/에러 메시지를 붙여넣은 경우 등, 이 계정 홈이 아닌 일반적인 `/Users/<name>`·
 *     `/home/<name>`·`C:\Users\<name>` 형태도 방어적으로 마스킹한다(계정명만 지우고 구조는 남김). */
function maskHomePaths(text) {
  let out = text;
  const home = os.homedir();
  if (home && home.length > 3) {
    out = out.split(home).join('~');
  }
  out = out.replace(/\/(Users|home)\/([^/\s'"]+)/g, '/$1/~');
  out = out.replace(/[A-Za-z]:\\Users\\([^\\\s'"]+)/g, 'C:\\Users\\~');
  return out;
}

/** summary로 나갈 문자열에서 크리덴셜류와 홈 절대경로를 마스킹한다. buildPayload() 안에서만
 *  호출되는 단일 지점 — 다른 코드 경로가 summary를 만들더라도 이 함수를 거치지 않으면 절대
 *  payload.summary에 값을 넣지 않는다(호출부 규율, buildPayload 참고).
 *  실패(예외) 시에는 절대 원문을 그대로 반환하지 않고 그대로 throw한다 — 호출부(run())가 이
 *  세션 전체를 건너뛰게 해 "마스킹 실패인데 조용히 원문이 전송"되는 경로를 원천 차단한다. */
function scrubSecrets(text) {
  if (!text) return text;
  if (typeof text !== 'string') throw new TypeError('scrubSecrets: 문자열이 아닌 입력');
  let out = text;
  for (const { re } of SECRET_PATTERNS) {
    out = out.replace(re, '[REDACTED]');
  }
  out = maskHomePaths(out);
  return out;
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
  // scrubSecrets()를 truncate보다 먼저 거친다 — truncate가 먼저면 120자 경계에서 시크릿 패턴이
  // 중간에 잘려 정규식이 더는 매치하지 못한 채(예: sk-키의 뒷부분만 잘려나간 상태) 앞쪽 조각이
  // 그대로 전송될 수 있다. 전체 원문에 대해 먼저 마스킹한 뒤 마지막에 120자로 자른다.
  payload.summary = truncateSummary(scrubSecrets(agg.firstPrompt));

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
    // payload 생성(내부에서 scrubSecrets 실행)을 전송 시도와 분리된 try/catch로 감싼다 — 스크럽이
    // 예외를 던지면(마스킹 실패) 이 세션은 원문 그대로도, 마스킹 없이도 절대 내보내지 않고
    // 안전하게 건너뛴다(fail closed). 다른 세션의 전송에는 영향을 주지 않는다.
    let payload;
    try {
      payload = buildPayload(agg, pluginVersion, repoKeyFor);
    } catch (err) {
      const msg = `payload 생성 실패(summary 마스킹 등) — 이 세션은 전송하지 않고 건너뜁니다: ${err && err.message ? err.message : String(err)}`;
      if (opts.dryRun) {
        console.error(`[dry-run] ${agg.sessionId}: ${msg}`);
      } else {
        sentFail++;
        failures.push({ sessionId: agg.sessionId, error: msg });
      }
      continue;
    }

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