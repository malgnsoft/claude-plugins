#!/usr/bin/env node
/**
 * usage-agent-lib.mjs
 *
 * report-usage.mjs / pair-usage-device.mjs / install-usage-agent.mjs 가 공유하는
 * 순수 Node 내장모듈 전용 헬퍼. 이 파일 자체는 단독 실행되지 않는다.
 *
 * 의존성 설치 없이 동작해야 하므로 fs/path/os/crypto/https/child_process/url
 * 내장 모듈만 사용한다 (macOS/Linux/Windows 동일 동작).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import https from 'node:https';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HUB_DIR = path.join(os.homedir(), '.claude', 'malgnai-hub');
export const CREDENTIALS_PATH = path.join(HUB_DIR, 'usage-agent-credentials.json');
export const LAST_RUN_PATH = path.join(HUB_DIR, 'usage-agent-last-run.json');

// bin/ 과 .claude-plugin/ 은 항상 malgn-agent 루트의 형제 디렉터리다 (설치 위치가 바뀌어도 유지되는 상대 구조).
const PLUGIN_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_JSON_PATH = path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json');

// plugin.json 읽기 실패 시에도 완전히 멈추지 않게 하는 최후 폴백값.
// 정상 설치라면 항상 plugin.json의 mcpServers.malgnai-hub.url 오리진을 그대로 읽어 쓴다.
const FALLBACK_API_ORIGIN = 'https://malgnai-hub.apiserver.kr';
const FALLBACK_PLUGIN_VERSION = '0.0.0';

let cachedPluginJson = null;
function readPluginJson() {
  if (cachedPluginJson) return cachedPluginJson;
  try {
    const raw = fs.readFileSync(PLUGIN_JSON_PATH, 'utf8');
    cachedPluginJson = JSON.parse(raw);
  } catch (err) {
    cachedPluginJson = {};
  }
  return cachedPluginJson;
}

/** plugin.json의 mcpServers.malgnai-hub.url과 동일 오리진 (예: https://malgnai-hub.apiserver.kr) */
export function resolveApiBase() {
  const pj = readPluginJson();
  const mcpUrl = pj && pj.mcpServers && pj.mcpServers['malgnai-hub'] && pj.mcpServers['malgnai-hub'].url;
  if (typeof mcpUrl === 'string' && mcpUrl.length > 0) {
    try {
      const u = new URL(mcpUrl);
      return `${u.protocol}//${u.host}`;
    } catch (err) {
      // fallthrough to fallback
    }
  }
  return FALLBACK_API_ORIGIN;
}

export function resolvePluginVersion() {
  const pj = readPluginJson();
  return typeof pj.version === 'string' && pj.version ? pj.version : FALLBACK_PLUGIN_VERSION;
}

export function ensureHubDir() {
  fs.mkdirSync(HUB_DIR, { recursive: true });
}

function chmod600(filePath) {
  if (process.platform === 'win32') return; // Windows는 OS 기본 사용자 권한에 맡긴다 (POSIX chmod 개념 없음)
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (err) {
    // 권한 변경 실패는 치명적이지 않음 — 조용히 무시
  }
}

export function readJsonFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function writeJsonFileSecure(filePath, obj) {
  ensureHubDir();
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  chmod600(filePath);
}

export function readCredentials() {
  return readJsonFile(CREDENTIALS_PATH);
}

export function writeCredentials(obj) {
  writeJsonFileSecure(CREDENTIALS_PATH, obj);
}

export function readLastRun() {
  return readJsonFile(LAST_RUN_PATH);
}

export function writeLastRun(obj) {
  writeJsonFileSecure(LAST_RUN_PATH, obj);
}

/**
 * 안정적인 device_id: 호스트명+플랫폼+아키텍처+홈경로 해시.
 * 매번 새로 만들지 않도록 credentials 파일에 저장해두고 재사용해야 한다 (호출부 책임).
 */
export function generateDeviceId() {
  const raw = `${os.hostname()}::${process.platform}::${process.arch}::${os.homedir()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export function generateDeviceName() {
  let user = 'unknown';
  try {
    user = os.userInfo().username || 'unknown';
  } catch (err) {
    // ignore — 일부 컨테이너/제한 환경에서 userInfo가 실패할 수 있음
  }
  return `${user}@${os.hostname()} (${process.platform})`;
}

/** https 전용 최소 JSON 요청 헬퍼 (내장 https 모듈만 사용, fetch 가용성에 의존하지 않음) */
export function requestJson(method, urlStr, { headers = {}, body = null, timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let u;
    try {
      u = new URL(urlStr);
    } catch (err) {
      reject(err);
      return;
    }
    const payload = body != null ? Buffer.from(JSON.stringify(body), 'utf8') : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = String(payload.length);
    }
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || 443,
        path: `${u.pathname}${u.search}`,
        headers: reqHeaders,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          if (text) {
            try {
              json = JSON.parse(text);
            } catch (err) {
              json = null;
            }
          }
          resolve({ status: res.statusCode || 0, json, text });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy(new Error(`요청 타임아웃 (${timeoutMs}ms): ${urlStr}`));
    });
    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * cwd(로컬 절대경로 원문)를 절대 노출하지 않고 git origin에서 "owner/repo"만 추출한다.
 * git 원격이 없거나 명령이 실패하면 undefined를 돌려주며, 호출부는 이 경우 repository_key를 생략해야 한다.
 */
export function deriveRepositoryKey(cwd) {
  if (!cwd) return undefined;
  try {
    const url = execFileSync('git', ['-C', cwd, 'remote', 'get-url', 'origin'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
      encoding: 'utf8',
    }).trim();
    if (!url) return undefined;
    // git@host:owner/repo.git 또는 https://host/owner/repo.git 형태에서 마지막 두 path segment만 추출.
    // 정밀한 normalize(대소문자/트레일링슬래시 등)는 서버(malgnai-public normalizeRepositoryKey)가 담당한다.
    const m = url.match(/[:/]([^/:]+)\/([^/]+?)(\.git)?\/?$/);
    if (!m) return undefined;
    const owner = m[1];
    const repo = m[2];
    if (!owner || !repo) return undefined;
    return `${owner}/${repo}`;
  } catch (err) {
    return undefined; // git 미설치, 원격 없음, non-git 디렉터리 등 — 조용히 생략
  }
}

/** OS 기본 브라우저로 URL 열기 시도. 실패해도 예외를 던지지 않고 false만 반환 (호출부가 콘솔 출력으로 대체) */
export function openUrlInBrowser(urlStr) {
  const platform = process.platform;
  try {
    let cmd;
    let args;
    if (platform === 'darwin') {
      cmd = 'open';
      args = [urlStr];
    } else if (platform === 'win32') {
      cmd = 'cmd';
      args = ['/c', 'start', '""', urlStr];
    } else {
      cmd = 'xdg-open';
      args = [urlStr];
    }
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true, windowsHide: true });
    child.unref();
    return true;
  } catch (err) {
    return false;
  }
}

export function nowIso() {
  return new Date().toISOString();
}
