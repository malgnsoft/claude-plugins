// Sensitive 도메인 목록 드리프트 검사(순수 함수). validate-agent-assets.mjs가 호출하고
// verify-sensitive-domain-drift.mjs가 단위 검증한다.
//
// 정본: skills/common-task-grading-and-verification-depth/SKILL.md 판정표 Sensitive 행의 첫 기준 칸
//       ("DB·권한·인증·배포·결제·개인정보·대량데이터 (…)" 중 괄호 앞 ·-목록).
// 비교 대상: 제품 본문 .md에서 "Sensitive" 바로 뒤(같은 줄, 30자 이내)에 오는 ·-목록 —
//       ① 괄호형  Sensitive 등급(A·B·C)  /  Sensitive 행(A·B·C)
//       ② 맨몸형  Sensitive A·B·C
// 오탐 방어: 후보는 (a) 같은 줄에서 "Sensitive" 뒤에 붙어야 하고 (b) ·로 나뉜 항목이 3개 이상이며
//       (c) 항목 중 정본 도메인과 겹치는 것이 3개 이상일 때만 "같은 계열 목록"으로 본다.
//       reviewer.md의 '리스크 범주'·blast radius 예시는 줄에 Sensitive가 없거나 겹침이 3 미만이라 걸리지 않고,
//       qa-engineer.md의 "Sensitive=정상+예외+권한·데이터·롤백"은 겹침 1이라 걸리지 않는다.
// 한계: 겹침이 3 미만으로 좁아진 사본(예: 2개만 남김)은 "다른 목록"과 구분되지 않아 잡지 못한다.

export const CANON_PATH = 'skills/common-task-grading-and-verification-depth/SKILL.md';

/** 판정표 Sensitive 행에서 도메인 배열을 뽑는다. 실패하면 null. */
export function parseCanonicalDomains(skillText) {
  const row = skillText.split('\n').find((l) => /^\|\s*Sensitive\s*\|/.test(l));
  if (!row) return null;
  const cell = (row.split('|')[2] ?? '').trim(); // [0]='' [1]=등급 [2]=기준
  const head = cell.split(/\s*\(/)[0].trim();
  const items = head.split('·').map((s) => s.trim()).filter(Boolean);
  if (items.length < 3 || items.some((s) => /\s/.test(s))) return null;
  return items;
}

const ITEM = '[^\\s·()|,;/=+]+';
const LIST = `${ITEM}(?:·${ITEM}){2,}`;
const PAREN_RE = new RegExp(`Sensitive[^()\\n|·]{0,30}?\\(\\s*(${LIST})\\s*\\)`, 'g');
const BARE_RE = new RegExp(`Sensitive(?:\\s*등급|\\s*행)?[\\s:]+(${LIST})`, 'g');

/** 한 줄에서 후보 목록(문자열 배열)을 모두 뽑는다. */
export function findSensitiveLists(line) {
  const out = [];
  for (const re of [PAREN_RE, BARE_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) out.push(m[1].split('·'));
  }
  return out;
}

/** 정본과 집합이 다른지. 같은 계열(겹침>=3)이 아니면 null(비교 대상 아님). */
export function diffAgainstCanon(items, canon) {
  const set = new Set(canon);
  const overlap = items.filter((i) => set.has(i)).length;
  if (items.length < 3 || overlap < 3) return null;
  const have = new Set(items);
  const missing = canon.filter((c) => !have.has(c));
  const extra = items.filter((i) => !set.has(i));
  if (!missing.length && !extra.length) return null;
  return { missing, extra };
}

/** 본문 하나를 검사해 [{line, items, missing, extra}] 반환. 펜스 코드블록도 포함(예시도 사본이다). */
export function scanText(text, canon) {
  const hits = [];
  text.split('\n').forEach((line, idx) => {
    if (!line.includes('Sensitive')) return;
    for (const items of findSensitiveLists(line)) {
      const d = diffAgainstCanon(items, canon);
      if (d) hits.push({ line: idx + 1, items, ...d });
    }
  });
  return hits;
}
