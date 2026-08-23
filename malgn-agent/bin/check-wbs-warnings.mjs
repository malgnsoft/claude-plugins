#!/usr/bin/env node
/**
 * check-wbs-warnings.mjs
 *
 * skills/project-orchestration/SKILL.md §2 "조기 경고 휴리스틱 체크리스트"(8개 신호)를
 * WBS 구조화 데이터(wbs_list 응답과 동일한 JSON 배열)에 대해 기계적으로 판정한다.
 * PM이 매번 표를 눈으로 대조하는 대신, 이 스크립트로 신호를 잡아낸 뒤 원인 조사·대응 판단만 사람이 한다.
 *
 * 순수 Node.js 내장 모듈만 사용 — 의존성 설치 없이 `node check-wbs-warnings.mjs` 로 실행된다.
 * (malgn-agent/bin/analyze-usage.mjs와 동일한 무의존성·크로스플랫폼 스타일)
 *
 * 입력 JSON은 wbs_list 툴 응답과 같은 배열 구조를 가정한다. 각 항목(item)이 가질 수 있는 필드:
 *   id, title, status('planned'|'in_progress'|'delayed'|'done'), progress(0-100, 리프만),
 *   computed_progress(0-100, 그룹 롤업), bucket, parent_id, start_date, end_date,
 *   updated_at(ISO), completed_date, assignee_agent_name
 * 모든 필드는 선택(optional) — 특정 신호 판정에 필요한 필드가 없는 항목은 그 신호만 조용히 건너뛴다.
 *
 * 사용법:
 *   node check-wbs-warnings.mjs --current curr.json
 *   node check-wbs-warnings.mjs --current curr.json --previous prev.json
 *   cat curr.json | node check-wbs-warnings.mjs                      (stdin, --current 생략 시)
 *   node check-wbs-warnings.mjs --current curr.json --today 2026-08-12 --format json
 *
 * 옵션:
 *   --current FILE   현재 스냅샷 JSON 경로. 생략하면 stdin에서 읽는다.
 *   --previous FILE  이전 스냅샷 JSON 경로. "롤업 추락"(computed_progress 5%p 하락) 신호는 이 옵션이
 *                    있을 때만 판정한다 — 없으면 해당 신호는 건너뛰고 리포트에 이유를 남긴다.
 *   --today DATE     기준일(YYYY-MM-DD). 생략하면 오늘(로컬 타임존).
 *   --format FORMAT  text(기본, 콘솔 리포트) | json(findings 배열 그대로 출력, 후속 자동화용)
 *
 * 종료 코드: High 심각도 신호가 하나라도 있으면 2, Medium/Low만 있으면 1, 없으면 0.
 * (issue_record 등 후속 자동화에서 exit code로 즉시 분기 가능하도록)
 */

import fs from 'node:fs';

// ── CLI 인자 파싱 ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { current: null, previous: null, today: null, format: 'text' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--current':
        opts.current = argv[++i] ?? null;
        break;
      case '--previous':
        opts.previous = argv[++i] ?? null;
        break;
      case '--today':
        opts.today = argv[++i] ?? null;
        break;
      case '--format': {
        const v = argv[++i];
        if (v === 'text' || v === 'json') opts.format = v;
        else {
          console.error(`알 수 없는 --format 값: ${v} (text|json만 허용)`);
          process.exit(1);
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
  console.log(`사용법: ${SELF} [--current FILE] [--previous FILE] [--today YYYY-MM-DD] [--format text|json]

  --current FILE   현재 WBS 스냅샷 JSON(wbs_list 응답 배열). 생략 시 stdin에서 읽음.
  --previous FILE  이전 스냅샷 JSON. "롤업 추락"(5%p 하락) 신호 판정에만 필요.
  --today DATE     기준일 YYYY-MM-DD (생략하면 오늘, 로컬 타임존).
  --format FORMAT  text(기본) | json

종료 코드: High 신호 존재 시 2, Medium/Low만 존재 시 1, 신호 없음 0.
`);
}

// ── 입력 로드 ──────────────────────────────────────────────────────────────

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function loadItems(filePath, label) {
  let raw;
  if (filePath) {
    if (!fs.existsSync(filePath)) {
      console.error(`${label} 파일을 찾을 수 없습니다: ${filePath}`);
      process.exit(1);
    }
    raw = fs.readFileSync(filePath, 'utf8');
  } else {
    raw = readStdinSync();
  }
  if (!raw || !raw.trim()) {
    console.error(`${label} 입력이 비어 있습니다.`);
    process.exit(1);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.error(`${label} JSON 파싱 실패: ${err.message}`);
    process.exit(1);
  }
  // wbs_list 응답이 { items: [...] } 형태로 감싸져 오는 경우도 허용
  const items = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : null;
  if (!items) {
    console.error(`${label} JSON은 배열이거나 { items: [...] } 형태여야 합니다.`);
    process.exit(1);
  }
  return items.filter((it) => {
    if (!it || it.id === undefined || it.id === null) {
      console.error(`경고: id 없는 ${label} 항목을 건너뜁니다.`, it);
      return false;
    }
    return true;
  });
}

// ── 날짜 유틸 ──────────────────────────────────────────────────────────────

/** ISO/날짜 문자열 → 로컬 자정 기준 Date (파싱 실패 시 null) */
function toDateOnly(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** b - a (일 단위, 정수) */
function daysDiff(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function localDateStr(d) {
  return d.toLocaleDateString('en-CA');
}

// ── 신호 판정 (SKILL.md §2 "조기 경고 휴리스틱 체크리스트" 8행 그대로) ─────

const SEVERITY_RANK = { High: 3, Medium: 2, Low: 1 };

function byId(items) {
  const m = new Map();
  for (const it of items) m.set(String(it.id), it);
  return m;
}

function childrenByParent(items) {
  const m = new Map();
  for (const it of items) {
    if (it.parent_id === undefined || it.parent_id === null) continue;
    const key = String(it.parent_id);
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(it);
  }
  return m;
}

function evaluate(currentItems, previousItems, today) {
  const findings = []; // { itemId, title, signal, severity, cause, action, detail }
  const skipped = []; // 신호 자체를 판정 불가로 건너뛴 사유 로그

  const curById = byId(currentItems);
  const childMap = childrenByParent(currentItems);
  const isGroup = (item) => (childMap.get(String(item.id)) || []).length > 0;

  const push = (item, signal, severity, cause, action, detail) => {
    findings.push({
      itemId: item.id,
      title: item.title ?? '(제목 없음)',
      signal,
      severity,
      cause,
      action,
      detail,
    });
  };

  for (const item of currentItems) {
    const status = item.status;
    const progress = typeof item.progress === 'number' ? item.progress : null;
    const updatedAt = toDateOnly(item.updated_at);
    const ageDays = updatedAt ? daysDiff(updatedAt, today) : null;
    const leaf = !isGroup(item);

    // 1. 진행 정체: progress=0 지속(3일 이상) — Medium
    if (progress === 0 && ageDays !== null && ageDays >= 3 && status !== 'done') {
      push(
        item,
        '진행 정체',
        'Medium',
        '담당자 미할당, 의존성 미해결, 요구사항 불명확',
        'wbs_update(assignee_agent_name) 확인 후 담당자 1:1 확인 필수',
        `progress=0, updated_at 이후 ${ageDays}일 경과(기준일 ${localDateStr(today)})`
      );
    }

    // 2. 착수 미확인: status='in_progress' && progress=0 > 1일 — Medium
    if (status === 'in_progress' && progress === 0 && ageDays !== null && ageDays >= 1) {
      push(
        item,
        '착수 미확인',
        'Medium',
        '상태 기록 누락, 또는 자동 착수 후 수동 미업데이트',
        '실제 진행 상태 재확인 + wbs_update로 status와 progress 동기화',
        `status=in_progress, progress=0, updated_at 이후 ${ageDays}일 경과`
      );
    }

    // 3. 임박 기한 위반: deadline <= today && progress < 100 — High
    const endDate = toDateOnly(item.end_date);
    if (endDate && progress !== null && progress < 100) {
      const daysToDeadline = daysDiff(today, endDate); // end_date - today
      if (daysToDeadline <= 0) {
        push(
          item,
          '임박 기한 위반',
          'High',
          '계획 종료일 경과 + 미완료',
          '즉시 에스컬레이션 + 일정 재계획',
          `end_date=${localDateStr(endDate)}, 기준일 대비 ${-daysToDeadline}일 경과, progress=${progress}`
        );
      } else if (daysToDeadline <= 3 && progress < 50) {
        // 4. 기한 박박: (end_date - today) <= 3일 && progress < 50% — Medium
        push(
          item,
          '기한 박박',
          'Medium',
          '잔여 기한 대비 진행률 부족',
          '가속화 협의, 스코프 축소 검토',
          `end_date까지 ${daysToDeadline}일 남음, progress=${progress}`
        );
      }
    }

    // 8. 상태 불일치: status ≠ inferred_status_from_progress — Low (리프만; 그룹은 rollup이 정상 신호이므로 제외)
    if (leaf && progress !== null && status) {
      const inferred = progress === 0 ? 'planned' : progress >= 100 ? 'done' : 'in_progress';
      if (status !== inferred && !(status === 'delayed' && inferred !== 'done')) {
        // status='delayed'는 지연이라는 별도 상태이지 progress 불일치로 볼 신호가 아니므로 제외.
        push(
          item,
          '상태 불일치',
          'Low',
          'progress로 역산한 상태와 실제 status가 다름',
          'wbs_update로 동기화 + 미래 기록 개선',
          `status=${status}, progress=${progress}(→ 추정 상태 ${inferred})`
        );
      }
    }
  }

  // 5. 크리티컬 패스: earliest_deadline인데 progress < 70% — High
  // 그룹 노드는 progress 필드 자체가 없어(§1: progress는 리프만) 후보에 넣으면 진짜 리프의 마감을
  // 가려버릴 수 있으므로, progress를 실제로 가진 리프 항목만 후보로 삼는다.
  const openWithDeadline = currentItems
    .filter((it) => it.status !== 'done' && typeof it.progress === 'number' && it.progress < 100)
    .map((it) => ({ item: it, endDate: toDateOnly(it.end_date) }))
    .filter((x) => x.endDate);
  if (openWithDeadline.length > 0) {
    const minTime = Math.min(...openWithDeadline.map((x) => x.endDate.getTime()));
    for (const { item, endDate } of openWithDeadline) {
      if (endDate.getTime() !== minTime) continue;
      const progress = typeof item.progress === 'number' ? item.progress : null;
      if (progress !== null && progress < 70) {
        push(
          item,
          '크리티컬 패스',
          'High',
          '전체 미완료 항목 중 가장 이른 마감인데 진행률이 낮음',
          '리소스 추가, 병렬화 재검토',
          `end_date=${localDateStr(endDate)}(전체 중 최단), progress=${progress}`
        );
      }
    }
  } else {
    skipped.push('크리티컬 패스: end_date가 있는 미완료 항목이 없어 판정 대상 없음');
  }

  // 6. 롤업 추락: parent.computed_progress ↓ 5%p (이전 스냅샷 필요) — Medium
  if (previousItems) {
    const prevById = byId(previousItems);
    for (const item of currentItems) {
      if (typeof item.computed_progress !== 'number') continue;
      const prev = prevById.get(String(item.id));
      if (!prev || typeof prev.computed_progress !== 'number') continue;
      const drop = prev.computed_progress - item.computed_progress;
      if (drop >= 5) {
        push(
          item,
          '롤업 추락',
          'Medium',
          '자식 항목 중 하나 이상이 완료→미완료로 되돌려지거나, 새 자식 항목이 progress=0으로 추가됨',
          'wbs_list(parent_id=<부모_id>)로 자식들을 재조회해 변화 요인 식별',
          `computed_progress: ${prev.computed_progress} → ${item.computed_progress} (${drop.toFixed(1)}%p 하락)`
        );
      }
    }
  } else {
    skipped.push('롤업 추락: --previous 미제공으로 이력 비교 불가 (이전 스냅샷 필요)');
  }

  // 7. 의존성 블로킹: parent.status='delayed' → children.start_date_passed — High
  for (const item of currentItems) {
    if (item.parent_id === undefined || item.parent_id === null) continue;
    const parent = curById.get(String(item.parent_id));
    if (!parent || parent.status !== 'delayed') continue;
    const startDate = toDateOnly(item.start_date);
    if (!startDate) continue;
    const passed = daysDiff(startDate, today) >= 0;
    const progress = typeof item.progress === 'number' ? item.progress : null;
    if (passed && item.status !== 'done' && progress !== 100) {
      push(
        item,
        '의존성 블로킹',
        'High',
        '상위 항목(parent)이 delayed라 자식이 실질적으로 시작 불가',
        '상위 항목 가속화 또는 의존성 제거 검토',
        `parent(${parent.id})=delayed, start_date=${localDateStr(startDate)} 경과, 현재 status=${item.status}`
      );
    }
  }

  findings.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  return { findings, skipped };
}

// ── 리포트 출력 ────────────────────────────────────────────────────────────

function printTextReport(findings, skipped, meta) {
  const lines = [];
  const push = (s = '') => lines.push(s);

  push(`# WBS 조기 경고 신호 판정 (skills/project-orchestration/SKILL.md §2 기준)`);
  push();
  push(`- 기준일: ${meta.todayStr}`);
  push(`- 현재 스냅샷 항목 수: ${meta.currentCount}`);
  push(`- 이전 스냅샷: ${meta.hasPrevious ? `제공됨(${meta.previousCount}건)` : '미제공'}`);
  push();

  if (findings.length === 0) {
    push(`위험 신호가 감지된 항목이 없습니다.`);
  } else {
    push(`## 위험 신호 (${findings.length}건, High → Medium → Low 순)`);
    push();
    push(`| 항목 ID | 제목 | 신호 | 심각도 | 근거 | 대응 |`);
    push(`|---|---|---|---|---|---|`);
    for (const f of findings) {
      push(
        `| ${f.itemId} | ${f.title} | ${f.signal} | ${f.severity} | ${f.detail} | ${f.action} |`
      );
    }
    push();
    const bySeverity = { High: 0, Medium: 0, Low: 0 };
    for (const f of findings) bySeverity[f.severity]++;
    push(`요약: High ${bySeverity.High}건 / Medium ${bySeverity.Medium}건 / Low ${bySeverity.Low}건`);
  }
  push();

  if (skipped.length > 0) {
    push(`## 판정 생략된 신호`);
    push();
    for (const s of skipped) push(`- ${s}`);
    push();
  }

  push(`> 이 리포트는 신호 판정까지만 수행한다. 원인 조사·담당자 확인·재계획 등 대응 판단은 PM이 한다(SKILL.md §2).`);

  console.log(lines.join('\n'));
}

// ── 메인 ───────────────────────────────────────────────────────────────────

function run() {
  const opts = parseArgs(process.argv.slice(2));

  const currentItems = loadItems(opts.current, opts.current ? '--current' : 'stdin(current)');
  const previousItems = opts.previous ? loadItems(opts.previous, '--previous') : null;

  const today = opts.today ? toDateOnly(opts.today) : toDateOnly(new Date());
  if (!today) {
    console.error(`--today 파싱 실패: ${opts.today}`);
    process.exit(1);
  }

  const { findings, skipped } = evaluate(currentItems, previousItems, today);

  if (opts.format === 'json') {
    console.log(
      JSON.stringify(
        {
          today: localDateStr(today),
          currentCount: currentItems.length,
          previousProvided: !!previousItems,
          findings,
          skipped,
        },
        null,
        2
      )
    );
  } else {
    printTextReport(findings, skipped, {
      todayStr: localDateStr(today),
      currentCount: currentItems.length,
      hasPrevious: !!previousItems,
      previousCount: previousItems ? previousItems.length : 0,
    });
  }

  const hasHigh = findings.some((f) => f.severity === 'High');
  const hasAny = findings.length > 0;
  process.exit(hasHigh ? 2 : hasAny ? 1 : 0);
}

run();
