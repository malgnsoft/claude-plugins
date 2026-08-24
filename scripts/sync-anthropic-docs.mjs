#!/usr/bin/env node
/**
 * sync-anthropic-docs.mjs — Anthropic 공식 문서(마크다운 원본) 로컬 미러 동기화.
 *
 * 왜 필요한가: agent/skill/hook/plugin 사양은 Anthropic이 자주 갱신하는데, 우리 malgn-agent는
 * 그 사양 위에 얹혀 있다. 모델 기억이나 웹 검색 요약이 아니라 "그 시점의 공식 원문"을 저장소에
 * 박아두고, 갱신되면 diff로 무엇이 바뀌었는지 눈으로 확인하기 위한 도구다.
 *
 * 사용법:
 *   node scripts/sync-anthropic-docs.mjs           # 다운로드 + 파일/매니페스트 갱신
 *   node scripts/sync-anthropic-docs.mjs --check   # 원격 변경 여부만 확인(파일 미수정, 변경 시 exit 1)
 *   node scripts/sync-anthropic-docs.mjs --only hooks,skills   # 특정 슬러그만
 *
 * 버전 판정: 공식 문서에 버전 번호가 없으므로 (1) HTTP ETag/Last-Modified 조건부 요청,
 * (2) 본문 sha256 비교 2단으로 "실제 내용이 바뀌었는지"를 판정한다. 304 또는 동일 해시면 unchanged.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'anthropic');
const MANIFEST_PATH = path.join(OUT_DIR, 'MANIFEST.json');

const CC = 'https://code.claude.com/docs/en';
const PF = 'https://platform.claude.com/docs/en';

/**
 * 큐레이션 원칙: malgn-agent(에이전트·스킬·훅·knowledge·마켓플레이스 플러그인)를 만들 때
 * 실제로 사양을 확인하게 되는 문서만 담는다. Claude Code 전체 문서 미러가 아니다.
 */
const SOURCES = [
  // --- 확장 지점 개요 ---
  { slug: 'features-overview', group: 'claude-code', url: `${CC}/features-overview.md`, note: 'CLAUDE.md/Skill/subagent/hook/MCP/plugin 중 무엇을 쓸지 선택 기준' },
  { slug: 'claude-directory', group: 'claude-code', url: `${CC}/claude-directory.md`, note: '.claude 디렉토리 구조 — 어떤 파일이 어디서 로드되는지' },
  { slug: 'memory', group: 'claude-code', url: `${CC}/memory.md`, note: 'CLAUDE.md 계층·auto memory' },
  { slug: 'context-window', group: 'claude-code', url: `${CC}/context-window.md`, note: '무엇이 자동 로드되고 얼마를 먹는지 — 토큰 예산 설계 근거' },

  // --- Skills ---
  { slug: 'skills', group: 'skills', url: `${CC}/skills.md`, note: 'Claude Code 스킬 — 생성·배포·번들 스킬' },
  { slug: 'skills-overview', group: 'skills', url: `${PF}/agents-and-tools/agent-skills/overview.md`, note: 'Agent Skills 아키텍처 — progressive disclosure 원리' },
  { slug: 'skills-best-practices', group: 'skills', url: `${PF}/agents-and-tools/agent-skills/best-practices.md`, note: '스킬 작성 베스트프랙티스 — name/description·번들 리소스(references/·scripts/) 규약' },

  // --- Subagents / 병렬 실행 ---
  { slug: 'sub-agents', group: 'agents', url: `${CC}/sub-agents.md`, note: '커스텀 서브에이전트 정의 — frontmatter 스키마·도구 제한' },
  { slug: 'agents', group: 'agents', url: `${CC}/agents.md`, note: 'subagent/agent view/agent team/workflow 비교' },
  { slug: 'agent-teams', group: 'agents', url: `${CC}/agent-teams.md`, note: '세션 간 협업·메시징' },
  { slug: 'workflows', group: 'agents', url: `${CC}/workflows.md`, note: '동적 워크플로 오케스트레이션' },

  // --- Hooks ---
  { slug: 'hooks', group: 'hooks', url: `${CC}/hooks.md`, note: '훅 레퍼런스(정본) — 이벤트별 입출력 JSON 스키마·exit code' },
  { slug: 'hooks-guide', group: 'hooks', url: `${CC}/hooks-guide.md`, note: '훅 실전 가이드·트러블슈팅' },

  // --- Plugins / Marketplace (이 저장소의 배포 형태) ---
  { slug: 'plugins', group: 'plugins', url: `${CC}/plugins.md`, note: '플러그인 제작' },
  { slug: 'plugins-reference', group: 'plugins', url: `${CC}/plugins-reference.md`, note: '플러그인 레퍼런스(정본) — plugin.json/marketplace.json 스키마' },
  { slug: 'plugin-marketplaces', group: 'plugins', url: `${CC}/plugin-marketplaces.md`, note: '마켓플레이스 제작·배포' },
  { slug: 'plugin-dependencies', group: 'plugins', url: `${CC}/plugin-dependencies.md`, note: '플러그인 의존성 버전 제약' },

  // --- Reference ---
  { slug: 'settings', group: 'reference', url: `${CC}/settings.md`, note: 'settings.json 전체 키·환경변수' },
  { slug: 'commands', group: 'reference', url: `${CC}/commands.md`, note: '내장 명령·번들 스킬 목록' },
  { slug: 'mcp', group: 'reference', url: `${CC}/mcp.md`, note: 'MCP 연결 — malgnai-hub 연동 사양의 상위 규격' },
  { slug: 'glossary', group: 'reference', url: `${CC}/glossary.md`, note: '용어 정의' },

  // --- 인덱스(신규 문서 등장 감시용) ---
  { slug: 'llms-index-claude-code', group: 'index', url: 'https://code.claude.com/docs/llms.txt', file: 'llms-claude-code.txt', note: 'Claude Code 전체 문서 인덱스 — 새 문서가 생기면 여기 diff에 잡힌다' },
  { slug: 'llms-index-platform', group: 'index', url: 'https://docs.claude.com/llms.txt', file: 'llms-platform.txt', note: 'Claude Platform(API) 전체 문서 인덱스' },
];

const args = process.argv.slice(2);
const CHECK_ONLY = args.includes('--check');
const onlyArg = args.find((a) => a.startsWith('--only'));
const ONLY = onlyArg
  ? (onlyArg.includes('=') ? onlyArg.split('=')[1] : args[args.indexOf(onlyArg) + 1] || '')
      .split(',').map((s) => s.trim()).filter(Boolean)
  : null;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) return { schema: 1, generatedAt: null, entries: {} };
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    return { schema: 1, generatedAt: null, entries: {} };
  }
}

async function fetchDoc(src, prev) {
  const headers = { 'user-agent': 'malgnsoft-claude-plugins-docsync/1.0' };
  // 조건부 요청: 서버가 304를 주면 본문 전송 없이 "변경 없음"이 확정된다.
  if (prev?.etag) headers['if-none-match'] = prev.etag;
  if (prev?.lastModified) headers['if-modified-since'] = prev.lastModified;

  const res = await fetch(src.url, { headers, redirect: 'follow' });
  if (res.status === 304) return { status: 304 };
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  return {
    status: res.status,
    text,
    etag: res.headers.get('etag'),
    lastModified: res.headers.get('last-modified'),
  };
}

function relPathFor(src) {
  const file = src.file || `${src.slug}.md`;
  return path.join('docs', 'anthropic', src.group, file);
}

async function main() {
  const manifest = await loadManifest();
  const targets = SOURCES.filter((s) => !ONLY || ONLY.includes(s.slug) || ONLY.includes(s.group));
  if (!targets.length) {
    console.error(`대상 없음. --only 값 확인: ${ONLY?.join(',')}`);
    process.exit(2);
  }

  const changed = [];
  const added = [];
  const unchanged = [];
  const failed = [];
  const nowIso = new Date().toISOString();

  for (const src of targets) {
    const prev = manifest.entries[src.slug];
    const rel = relPathFor(src);
    const abs = path.join(ROOT, rel);
    let result;
    try {
      result = await fetchDoc(src, prev);
    } catch (err) {
      failed.push({ slug: src.slug, error: err.message });
      console.error(`  ✗ ${src.slug}: ${err.message}`);
      continue;
    }

    // 304거나, 본문 해시가 이전과 같으면 변경 없음.
    if (result.status === 304 || (prev && sha256(result.text) === prev.sha256)) {
      unchanged.push(src.slug);
      if (!CHECK_ONLY && prev) {
        // 로컬 파일이 사라졌으면 304여도 복구가 필요하다.
        if (result.status !== 304 && !existsSync(abs)) {
          await mkdir(path.dirname(abs), { recursive: true });
          await writeFile(abs, result.text, 'utf8');
        }
        prev.lastCheckedAt = nowIso;
      }
      continue;
    }

    const hash = sha256(result.text);
    const lines = result.text.split('\n').length;
    const entry = {
      url: src.url,
      group: src.group,
      path: rel,
      note: src.note,
      sha256: hash,
      bytes: Buffer.byteLength(result.text, 'utf8'),
      lines,
      etag: result.etag || null,
      lastModified: result.lastModified || null,
      fetchedAt: nowIso,
      lastCheckedAt: nowIso,
      previousSha256: prev?.sha256 || null,
      previousFetchedAt: prev?.fetchedAt || null,
    };

    if (CHECK_ONLY) {
      (prev ? changed : added).push({ slug: src.slug, rel, prevBytes: prev?.bytes, bytes: entry.bytes });
      continue;
    }

    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, result.text, 'utf8');
    manifest.entries[src.slug] = entry;
    (prev ? changed : added).push({ slug: src.slug, rel, prevBytes: prev?.bytes, bytes: entry.bytes });
    console.log(`  ${prev ? '↻ 갱신' : '+ 신규'} ${src.slug} → ${rel} (${entry.lines}줄, ${entry.bytes}B)`);
  }

  if (!CHECK_ONLY) {
    manifest.schema = 1;
    manifest.generatedAt = nowIso;
    manifest.sourceCount = Object.keys(manifest.entries).length;
    await mkdir(OUT_DIR, { recursive: true });
    await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  }

  console.log('');
  console.log(`대상 ${targets.length}건 — 신규 ${added.length} / 갱신 ${changed.length} / 변경없음 ${unchanged.length} / 실패 ${failed.length}`);
  if (CHECK_ONLY && (added.length || changed.length)) {
    console.log('\n원격이 갱신됐다. 반영하려면:  node scripts/sync-anthropic-docs.mjs');
    for (const c of [...added, ...changed]) console.log(`  - ${c.slug} (${c.prevBytes ?? '신규'}B → ${c.bytes}B)`);
  }
  if (failed.length) process.exit(3);
  if (CHECK_ONLY && (added.length || changed.length)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(3);
});
