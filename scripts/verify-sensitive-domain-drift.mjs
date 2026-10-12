#!/usr/bin/env node
// sensitive-domain-drift.mjs 단위 검증. 비용 0. 사용: node scripts/verify-sensitive-domain-drift.mjs
import { parseCanonicalDomains, findSensitiveLists, diffAgainstCanon, scanText } from './sensitive-domain-drift.mjs';

let pass = 0;
let fail = 0;
const t = (name, cond, extra = '') => { if (cond) pass++; else { fail++; console.error(`FAIL: ${name} ${extra}`); } };
const eq = (name, got, want) => t(name, JSON.stringify(got) === JSON.stringify(want), `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);

const CANON = ['DB', '권한', '인증', '배포', '결제', '개인정보', '대량데이터'];
const TABLE = '| 등급 | 기준 |\n|---|---|\n| Standard | 일반 |\n| Sensitive | DB·권한·인증·배포·결제·개인정보·대량데이터 (노출 범위에 따라 조정) | 위임 |\n';

// 정본 파싱
eq('canon parse', parseCanonicalDomains(TABLE), CANON);
eq('canon: 행 없음', parseCanonicalDomains('| Standard | x |'), null);
eq('canon: 목록 2개뿐이면 실패', parseCanonicalDomains('| Sensitive | DB·권한 |'), null);
eq('canon: 공백 낀 항목이면 실패', parseCanonicalDomains('| Sensitive | 일반 문장입니다 |'), null);
eq('canon: 빈 입력', parseCanonicalDomains(''), null);

const scan = (s) => scanText(s, CANON);

// 동일 / 순서만 다름 / 공백 -> 통과
eq('same paren', scan('Sensitive 등급(DB·권한·인증·배포·결제·개인정보·대량데이터) 작업'), []);
eq('order differs = same', scan('Sensitive 등급(대량데이터·결제·DB·개인정보·배포·권한·인증)'), []);
eq('hook style 행(...)', scan('판정표 Sensitive 행(DB·권한·인증·배포·결제·개인정보·대량데이터)을 본다'), []);
eq('bare same', scan('Sensitive DB·권한·인증·배포·결제·개인정보·대량데이터 면'), []);

// 좁아짐(실제 사본 두 줄)
const a = scan('- [ ] Sensitive 등급(DB·권한·인증·배포·결제·개인정보) 설계면 ③비정상');
t('narrowed detected', a.length === 1 && a[0].line === 1);
eq('narrowed missing', a[0]?.missing, ['대량데이터']);
eq('narrowed extra', a[0]?.extra, []);
// 넓어짐
const b = scan('Sensitive 등급(DB·권한·인증·배포·결제·개인정보·대량데이터·감사로그)');
eq('widened extra', b[0]?.extra, ['감사로그']);
eq('widened missing', b[0]?.missing, []);
// 맨몸 좁아짐, 여러 줄 줄번호
const c = scan('가\n나\nSensitive: DB·권한·인증·배포');
t('bare narrowed line 3', c.length === 1 && c[0].line === 3);
// 한 줄에 둘
eq('two on one line', scan('Sensitive 행(DB·권한·인증) 그리고 Sensitive 등급(DB·권한·인증·배포·결제·개인정보·대량데이터)').length, 1);
// 교체(같은 개수, 다른 항목)
const d = scan('Sensitive 등급(DB·권한·인증·배포·결제·개인정보·로그)');
t('swap detected', d.length === 1 && d[0].missing[0] === '대량데이터' && d[0].extra[0] === '로그');

// 목록 없음 -> 비교 대상 아님
eq('no list', scan('Sensitive 등급이면 풀패널을 부른다'), []);
eq('no Sensitive word', scan('DB·권한·인증·배포(리스크 범주)'), []);
eq('empty', scan(''), []);

// 오탐 후보
eq('qa-engineer line', scan('(Micro=눈검증 / Standard=정상흐름+주요예외1개 / Sensitive=정상+예외+권한·데이터·롤백 확인 — 상세: Skill `x`)'), []);
eq('reviewer risk categories', scan('리스크 범주: 보안·데이터 유실·성능·접근성·인증 (Sensitive는 풀패널)'), []);
eq('blast radius examples', scan('blast radius 예시: 인증·결제·배포·개인정보·대량데이터 변경'), []);
eq('Sensitive far from list', scan('Sensitive 등급 작업에서는 매우 길고 긴 설명이 이어진 다음에야 (DB·권한·인증·배포·결제·개인정보) 가 나온다'), []);
eq('Sensitive, unrelated list (overlap<3)', scan('Sensitive 등급(보안·성능·접근성·인증)'), []);
eq('Sensitive/Refactor slash', scan('Sensitive/Refactor 등급 산출물은 풀패널'), []);
eq('2 items only = not a list', scan('Sensitive(DB·권한) 작업'), []);

// 순수 함수 직접
eq('findSensitiveLists paren', findSensitiveLists('Sensitive 등급(A·B·C)'), [['A', 'B', 'C']]);
eq('diff null when <3 overlap', diffAgainstCanon(['DB', '권한', 'x'], CANON), null);
eq('diff null when identical', diffAgainstCanon([...CANON].reverse(), CANON), null);

console.log(`verify-sensitive-domain-drift: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
