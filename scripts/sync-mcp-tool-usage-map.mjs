#!/usr/bin/env node
/**
 * sync-mcp-tool-usage-map.mjs — agents/*.md·skills/<name>/SKILL.md의 malgnai-hub MCP 도구
 * 사용 실태 스냅샷 생성기.
 *
 * 왜 필요한가: agents/*.md 21개가 frontmatter `tools:`에서 malgnai-hub 도구를 대체로
 * 와일드카드(`mcp__plugin_malgn-agent_malgnai-hub__*`)로 부여받는데, 실제 본문이 그 중
 * 어떤 도구를 쓰라고 지시하는지는 파일마다 다르다. "권한은 열려 있는데 문서상 지시가
 * 없는 에이전트가 몇 개인가"를 손으로 표 만들지 않고 재실행 가능하게 스냅샷한다 — 나중에
 * 권한 축소(가드) 설계를 검토할 때 참고자료로 쓴다.
 *
 * skills/<name>/SKILL.md도 같은 이유로 대상이다 — 도구 호출 지시가 에이전트 본문이 아니라
 * 여러 에이전트가 로드하는 스킬 쪽에 있을 수 있다. 스킬은 도구 권한을 부여하는 주체가
 * 아니라 로드한 에이전트의 권한을 그대로 쓰므로, 나중에 tools: 를 좁히는 단계에서 이
 * 공백을 놓치면 "스킬이 도구를 쓰라고 시키는데 그 에이전트 frontmatter엔 권한이 없는"
 * 조합이 생길 수 있다 — 그 위험을 만들지 않기 위한 감사 확장이다.
 *
 * 이 스크립트는 게이트가 아니다. "직접 호출 vs 다른 에이전트가 쓴다고 설명만 함"을
 * 스크립트가 의미적으로 판별하지 않는다(기계적으로 신뢰할 수 없는 판단) — 어디에 어떤
 * 도구명이 등장하는지 파일:라인+컨텍스트만 뽑아 사람(또는 reviewer)이 읽고 판단하게 남긴다.
 * skills 쪽도 마찬가지로 SKILL.md 본문에 도구명이 등장하는지만 보고, 그 스킬을 실제
 * 어느 에이전트가 로드하는지(로드 조건은 description/트리거 서술에 있다)는 해석하지
 * 않는다 — 그 매핑은 이번 스크립트의 범위 밖이다.
 *
 * 사용법:
 *   node scripts/sync-mcp-tool-usage-map.mjs
 *
 * 출력: docs/architecture/mcp-tool-usage-map.md (덮어쓴다)
 * 종료 코드: 정상 생성 0, 파일 접근 등 에러 1 (심각도 판정용이 아니다 — 참고자료 생성기다)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as yamlLoad } from 'js-yaml';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN_ROOT = path.join(REPO_ROOT, 'malgn-agent');
const AGENTS_DIR = path.join(PLUGIN_ROOT, 'agents');
const SKILLS_DIR = path.join(PLUGIN_ROOT, 'skills');
const OUT_PATH = path.join(REPO_ROOT, 'docs', 'architecture', 'mcp-tool-usage-map.md');
const SCRIPT_REL = 'scripts/sync-mcp-tool-usage-map.mjs';

// malgnai-hub MCP 도구 14종(고정 목록). 늘어나면 여기만 갱신한다.
const HUB_TOOLS = [
  'agent_get_context',
  'agent_learning_record',
  'agent_score_record',
  'decision_record',
  'issue_record',
  'issue_resolve',
  'project_bootstrap',
  'project_get_context',
  'project_search_history',
  'wbs_add',
  'wbs_bulk_add',
  'wbs_list',
  'wbs_update',
  'work_record',
];
const MCP_PREFIX = 'mcp__plugin_malgn-agent_malgnai-hub__';
const WILDCARD = `${MCP_PREFIX}*`;

function fail(msg) {
  console.error(`[sync-mcp-tool-usage-map] ${msg}`);
  process.exit(1);
}

function readFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: null, body: raw, fmBlockLen: 0 };
  let data = null;
  try {
    data = yamlLoad(m[1]);
  } catch {
    data = null;
  }
  return { data, body: raw.slice(m[0].length), fmBlockLen: m[0].length };
}

function normalizeToolsField(tools) {
  if (Array.isArray(tools)) return tools.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tools === 'string') return tools.split(',').map((t) => t.trim()).filter(Boolean);
  return [];
}

function classifyFrontmatter(toolsList) {
  const hasWildcard = toolsList.includes(WILDCARD);
  const individual = toolsList
    .filter((t) => t.startsWith(MCP_PREFIX) && t !== WILDCARD)
    .map((t) => t.slice(MCP_PREFIX.length));
  if (hasWildcard) return { kind: 'wildcard', individual: [] };
  if (individual.length > 0) return { kind: 'individual', individual };
  return { kind: 'none', individual: [] };
}

// 본문(frontmatter 이후) 라인 오프셋 — 실제 파일 라인 번호로 보고하기 위함.
function bodyLineOffset(raw, fmBlockLen) {
  return (raw.slice(0, fmBlockLen).match(/\n/g) || []).length;
}

function sanitizeContext(text) {
  return text.replace(/`/g, "'").replace(/\s+/g, ' ').trim();
}

// (?<![A-Za-z0-9]) : 앞이 문자/숫자가 아니면 매치(밑줄은 허용 — mcp__..__wbs_add처럼
//   이중 밑줄 뒤에 오는 형태도 잡는다). (?![A-Za-z0-9_]) : 뒤는 문자/숫자/밑줄이면 제외
//   (wbs_add가 wbs_added류 더 긴 식별자의 접두로 오탐되는 것을 막는다).
function occurrenceRegex(name) {
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9])${esc}(?![A-Za-z0-9_])`, 'g');
}

// 한 파일의 본문(frontmatter 이후)에서 14종 도구 전부의 occurrence를 모아 matrix로 반환한다.
// agents·skills 공통 — 스캔 로직은 대상 디렉토리와 무관하게 동일하다.
function buildMatrix(body, lineOffset) {
  const matrix = {};
  for (const toolName of HUB_TOOLS) {
    matrix[toolName] = findOccurrences(body, lineOffset, toolName);
  }
  return matrix;
}

function readMdFile(absPath, label) {
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (e) {
    fail(`${label} 읽기 실패: ${e.message}`);
    return null;
  }
  const { data, body, fmBlockLen } = readFrontmatter(raw);
  const lineOffset = bodyLineOffset(raw, fmBlockLen);
  return { raw, data, body, lineOffset };
}

function findOccurrences(body, lineOffset, toolName) {
  const results = [];
  const lines = body.split(/\r?\n/);
  const re = occurrenceRegex(toolName);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line)) !== null) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(line.length, m.index + m[0].length + 40);
      const prefix = start > 0 ? '…' : '';
      const suffix = end < line.length ? '…' : '';
      results.push({
        line: lineOffset + i + 1,
        context: `${prefix}${sanitizeContext(line.slice(start, end))}${suffix}`,
      });
      if (re.lastIndex === m.index) re.lastIndex++; // 무한루프 방지(빈 매치는 없지만 방어적으로)
    }
  }
  return results;
}

function main() {
  if (!fs.existsSync(AGENTS_DIR)) fail(`agents 디렉토리가 없다: ${AGENTS_DIR}`);
  if (!fs.existsSync(SKILLS_DIR)) fail(`skills 디렉토리가 없다: ${SKILLS_DIR}`);

  const agentFiles = fs.readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b));

  if (agentFiles.length === 0) fail('agents/*.md 파일을 하나도 찾지 못했다');

  // skills/<이름>/SKILL.md — 디렉토리 하나당 SKILL.md 정확히 하나. 개수를 가정하지 않고
  // 실행 시점에 실제 디렉토리를 읽는다.
  const skillDirNames = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md')))
    .sort((a, b) => a.localeCompare(b));

  if (skillDirNames.length === 0) fail('skills/*/SKILL.md 파일을 하나도 찾지 못했다');

  // agentName -> { frontmatter: {kind, individual, raw}, matrix: { toolName: [ {line, context}, ... ] } }
  const perAgent = new Map();

  for (const fileName of agentFiles) {
    const agentName = fileName.replace(/\.md$/, '');
    const absPath = path.join(AGENTS_DIR, fileName);
    const parsed = readMdFile(absPath, fileName);
    if (!parsed) return;
    const { data, body, lineOffset } = parsed;
    const toolsList = normalizeToolsField(data && data.tools);
    const fm = classifyFrontmatter(toolsList);
    const matrix = buildMatrix(body, lineOffset);

    perAgent.set(agentName, {
      fileName,
      frontmatter: { ...fm, raw: toolsList.length ? toolsList.join(', ') : '(tools 필드 없음)' },
      matrix,
    });
  }

  const agentNames = [...perAgent.keys()].sort((a, b) => a.localeCompare(b));

  // skillName -> { relPath, matrix: { toolName: [ {line, context}, ... ] } }
  const perSkill = new Map();

  for (const skillName of skillDirNames) {
    const relPath = path.join('skills', skillName, 'SKILL.md').replace(/\\/g, '/');
    const absPath = path.join(SKILLS_DIR, skillName, 'SKILL.md');
    const parsed = readMdFile(absPath, relPath);
    if (!parsed) return;
    const { body, lineOffset } = parsed;
    const matrix = buildMatrix(body, lineOffset);
    perSkill.set(skillName, { relPath, matrix });
  }

  const skillNames = [...perSkill.keys()].sort((a, b) => a.localeCompare(b));

  // ── Markdown 조립 ────────────────────────────────────────────────
  const lines = [];
  lines.push('# malgnai-hub MCP 도구 사용 실태 맵');
  lines.push('');
  lines.push(`이 파일은 \`${SCRIPT_REL}\`가 생성한다 — 손으로 고치지 말고 스크립트를 다시 돌려라.`);
  lines.push('');
  lines.push('```bash');
  lines.push(`node ${SCRIPT_REL}`);
  lines.push('```');
  lines.push('');
  lines.push(
    '스크립트는 "어디에 어떤 도구명이 등장하는가"만 뽑는다. "이 에이전트가 직접 호출한다"와 ' +
    '"다른 에이전트가 쓴다고 설명만 한다"의 구분은 기계적으로 신뢰할 수 없어 시도하지 않는다 — ' +
    '상세 섹션의 컨텍스트를 사람이 읽고 판단한다.',
  );
  lines.push('');
  lines.push(
    'skills 스캔은 그 스킬을 실제로 어느 에이전트가 로드하는지와 무관하게 SKILL.md 본문에 ' +
    '도구명이 등장하는지만 본다 — 스킬이 로드되는 조건은 SKILL.md의 description/트리거 ' +
    '서술에 있고, 이 스크립트는 그 조건을 해석하거나 에이전트-스킬 매핑을 만들지 않는다.',
  );
  lines.push('');

  // 표1: frontmatter 요약
  lines.push('## 표 1 — 에이전트별 frontmatter `tools:` malgnai-hub 권한 요약');
  lines.push('');
  lines.push('| 에이전트 | frontmatter 판정 | 개별 나열 도구(있는 경우) |');
  lines.push('|---|---|---|');
  let nonWildcardCount = 0;
  for (const name of agentNames) {
    const { frontmatter } = perAgent.get(name);
    const label = frontmatter.kind === 'wildcard' ? '와일드카드(`*`)'
      : frontmatter.kind === 'individual' ? '개별 나열'
      : '없음';
    if (frontmatter.kind !== 'wildcard') nonWildcardCount++;
    const detail = frontmatter.kind === 'individual' ? frontmatter.individual.map((t) => `\`${t}\``).join(', ') : '-';
    lines.push(`| ${name} | ${label} | ${detail} |`);
  }
  lines.push('');

  // 표2: 에이전트 x 도구 매트릭스
  lines.push('## 표 2 — 에이전트 × 도구 본문 occurrence 매트릭스');
  lines.push('');
  lines.push('셀 값은 본문(frontmatter 이후)에서 그 도구명이 등장한 횟수다. `0`은 `-`로 표기한다.');
  lines.push('');
  const header = ['에이전트', ...HUB_TOOLS];
  lines.push(`| ${header.join(' | ')} |`);
  lines.push(`|${header.map(() => '---').join('|')}|`);
  let totalOccurrences = 0;
  for (const name of agentNames) {
    const { matrix } = perAgent.get(name);
    const cells = HUB_TOOLS.map((t) => {
      const n = matrix[t].length;
      totalOccurrences += n;
      return n > 0 ? String(n) : '-';
    });
    lines.push(`| ${name} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  // 표3: 스킬 x 도구 매트릭스
  lines.push('## 표 3 — 스킬 × 도구 SKILL.md 본문 occurrence 매트릭스');
  lines.push('');
  lines.push(
    '셀 값은 SKILL.md 본문(frontmatter 이후)에서 그 도구명이 등장한 횟수다. `0`은 `-`로 ' +
    '표기한다. 스킬은 도구 권한을 부여하는 주체가 아니라 이를 로드한 에이전트의 권한을 ' +
    '그대로 쓰므로 표1 같은 frontmatter 권한 요약은 없다.',
  );
  lines.push('');
  lines.push(`| 스킬 | ${HUB_TOOLS.join(' | ')} |`);
  lines.push(`|${header.map(() => '---').join('|')}|`);
  let totalSkillOccurrences = 0;
  const skillTotals = [];
  for (const name of skillNames) {
    const { matrix } = perSkill.get(name);
    let skillTotal = 0;
    const cells = HUB_TOOLS.map((t) => {
      const n = matrix[t].length;
      totalSkillOccurrences += n;
      skillTotal += n;
      return n > 0 ? String(n) : '-';
    });
    skillTotals.push({ name, total: skillTotal });
    lines.push(`| ${name} | ${cells.join(' | ')} |`);
  }
  lines.push('');

  // 상세 섹션 — agents
  lines.push('## 상세 (agents) — occurrence 1건 이상인 셀의 파일:라인 + 컨텍스트');
  lines.push('');
  let anyDetail = false;
  for (const name of agentNames) {
    const { fileName, matrix } = perAgent.get(name);
    const toolsWithHits = HUB_TOOLS.filter((t) => matrix[t].length > 0);
    if (toolsWithHits.length === 0) continue;
    anyDetail = true;
    lines.push(`### ${name}`);
    lines.push('');
    for (const toolName of toolsWithHits) {
      const hits = matrix[toolName];
      lines.push(`- \`${toolName}\` (${hits.length}건)`);
      for (const h of hits) {
        lines.push(`  - \`agents/${fileName}:${h.line}\` — ${h.context}`);
      }
    }
    lines.push('');
  }
  if (!anyDetail) {
    lines.push('(occurrence가 1건 이상인 셀이 없다)');
    lines.push('');
  }

  // 상세 섹션 — skills
  lines.push('## 상세 (skills) — occurrence 1건 이상인 셀의 파일:라인 + 컨텍스트');
  lines.push('');
  let anySkillDetail = false;
  for (const name of skillNames) {
    const { relPath, matrix } = perSkill.get(name);
    const toolsWithHits = HUB_TOOLS.filter((t) => matrix[t].length > 0);
    if (toolsWithHits.length === 0) continue;
    anySkillDetail = true;
    lines.push(`### ${name}`);
    lines.push('');
    for (const toolName of toolsWithHits) {
      const hits = matrix[toolName];
      lines.push(`- \`${toolName}\` (${hits.length}건)`);
      for (const h of hits) {
        lines.push(`  - \`${relPath}:${h.line}\` — ${h.context}`);
      }
    }
    lines.push('');
  }
  if (!anySkillDetail) {
    lines.push('(occurrence가 1건 이상인 셀이 없다)');
    lines.push('');
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, lines.join('\n'));

  const topSkills = skillTotals
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  console.log(`[sync-mcp-tool-usage-map] 생성 완료: ${path.relative(REPO_ROOT, OUT_PATH)}`);
  console.log(`  에이전트 ${agentNames.length}개 중 frontmatter가 와일드카드가 아닌 경우 ${nonWildcardCount}개`);
  console.log(`  agents 본문 occurrence 총합 ${totalOccurrences}건`);
  console.log(`  skills ${skillNames.length}개, SKILL.md 본문 occurrence 총합 ${totalSkillOccurrences}건`);
  if (topSkills.length) {
    console.log(`  상위 스킬: ${topSkills.map((s) => `${s.name}(${s.total})`).join(', ')}`);
  }
  process.exit(0);
}

main();
