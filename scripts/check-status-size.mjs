#!/usr/bin/env node
// STATUS.md 크기 게이트 — SessionStart 훅이 매 세션 통째로 주입하므로 상한을 둔다.
// 한글은 UTF-8 3바이트/글자이고 글자당 1토큰을 넘지 않으므로, 3,000B면 전부 한글이어도 1,000토큰 안에 들어온다.
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LIMIT = Number(process.env.STATUS_SIZE_GATE_BYTES || 3000);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(repoRoot, 'STATUS.md');

let bytes;
try {
  bytes = statSync(target).size;
} catch {
  // STATUS.md는 .gitignore 대상(각 PC 로컬 파일)이다. 없는 환경(CI·새 클론)에서는
  // 검사할 대상이 없는 것이지 실패가 아니다.
  console.log('SKIP  STATUS.md 없음 — 검사 대상 없음');
  process.exit(0);
}

const text = readFileSync(target, 'utf-8');
const hangul = (text.match(/[가-힣]/g) || []).length;
const pct = Math.round((bytes / LIMIT) * 100);
const detail = `${bytes}B / ${LIMIT}B (${pct}%) · ${text.split('\n').length}줄 · 한글 ${hangul}자`;

if (bytes > LIMIT) {
  console.error(`FAIL  STATUS.md 크기 상한 초과 — ${detail}`);
  console.error(`      ${bytes - LIMIT}B를 줄여야 한다. 새 내용을 깎지 말고 오래된 항목을 docs/archive/로 내보낼 것.`);
  console.error(`      규칙 정본: CLAUDE.md → "새 세션 부트스트랩"`);
  process.exit(1);
}

console.log(`OK    STATUS.md ${detail} · 여유 ${LIMIT - bytes}B`);
