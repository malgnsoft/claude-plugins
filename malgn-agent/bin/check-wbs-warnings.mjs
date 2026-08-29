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
 * 입력 JSON은 wbs_list 툴 응답과 같은 배열 구조를 가정한다(실제 wbs_list 도구 호출로 확인한 필드명 — camelCase).
 * 각 항목(item)이 가질 수 있는 필드:
 *   id, title, status('planned'|'in_progress'|'delayed'|'done'), computedProgress(0-100 —
 *   리프 항목은 자신의 진행률, 그룹 항목은 자식 롤업 진행률을 담는다. wbs_list 응답에는 이 필드 하나만
 *   있고, 리프 전용 progress 필드는 별도로 존재하지 않는다), bucket, parentId, startDate, endDate,
 *   completedDate, assigneeAgentName
 * wbs_list 응답에는 최종수정시각(updated_at/updatedAt) 필드가 없다 — 이 필드가 있어야 판정 가능한
 * "진행 정체"·"착수 미확인" 신호는 구조적으로 판정 불가이며, 판정을 생략하고 리포트에 이유를 남긴다.
 * 모든 필드는 선택(optional) — 특정 신호 판정에 필요한 필드가 없는 항목은 그 신호만 조용히 건너뛴다.
 *
 * 필터된 스냅샷 경고: 이 스크립트는 --current 안의 parentId 관계만으로 그룹/리프를 판별한다
 * (isGroup). wbs_list(status=... / includeDone=false 등)로 필터링된 스냅샷을 넣으면 자식이
 * 전부 걸러진 그룹이 리프로 오판되어 "임박 기한 위반"·"기한 박박"·"크리티컬 패스"·"상태 불일치"에
 * 오탐이 날 수 있다. wbs_list 응답의 top-level summary.total은 필터와 무관하게 항상 프로젝트
 * 전체 개수를 반환하므로(items만 필터됨), summary.total !== items.length 로 필터 여부를 기계적으로
 * 탐지해 리포트 상단에 경고를 남긴다(신호를 죽이지는 않는다 — 사람이 판단할 근거만 추가한다).
 *
 * 사용법:
 *   node check-wbs-warnings.mjs --current curr.json
 *   node check-wbs-warnings.mjs --current curr.json --previous prev.json
 *   cat curr.json | node check-wbs-warnings.mjs                      (stdin, --current 생략 시)
 *   node check-wbs-warnings.mjs --current curr.json --today 2026-08-12 --format json
 *
 * 옵션:
 *   --current FILE   현재 스냅샷 JSON 경로. 생략하면 stdin에서 읽는다.
 *   --previous FILE  이전 스냅샷 JSON 경로. "롤업 추락"(computedProgress 5%p 하락) 신호는 이 옵션이
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
  const rawItems = Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : null;
  if (!rawItems) {
    console.error(`${label} JSON은 배열이거나 { items: [...] } 형태여야 합니다.`);
    process.exit(1);
  }
  // wbs_list는 status/parentId/includeDone 등으로 필터링해도 summary.total은 항상
  // 프로젝트 전체 개수를 반환한다(items만 필터됨) — summary.total !== 실제 items 개수면
  // 필터된 스냅샷이라는 뜻이다. 배열만 온 입력(래핑 없이 items만 붙여넣은 경우)은 summary가
  // 없으므로 필터 여부를 판단할 수 없다(filtered: null).
  const summaryTotal =
    !Array.isArray(data) && data && data.summary && typeof data.summary.total === 'number'
      ? data.summary.total
      : null;
  const filtered = summaryTotal === null ? null : summaryTotal !== rawItems.length;

  const items = rawItems.filter((it) => {
    if (!it || it.id === undefined || it.id === null) {
      console.error(`경고: id 없는 ${label} 항목을 건너뜁니다.`, it);
      return false;
    }
    return true;
  });
  return { items, filtered, summaryTotal, rawCount: rawItems.length };
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
    if (it.parentId === undefined || it.parentId === null) continue;
    const key = String(it.parentId);
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

  // 1·2. 진행 정체 / 착수 미확인: 둘 다 "최종수정시각 이후 N일 경과"가 판정 조건인데,
  // wbs_list 응답에는 최종수정시각 필드(updated_at/updatedAt)가 없다 — 대체 가능한 다른 필드도
  // 없으므로(startDate/endDate/completedDate는 최종수정시각을 의미하지 않는다) 이 두 신호는
  // 구조적으로 판정 불가다. 조용히 건너뛰지 않고 이유를 명시적으로 남긴다.
  skipped.push('진행 정체: wbs_list 응답에 최종수정시각(updated_at) 필드가 없어 판정 불가');
  skipped.push('착수 미확인: wbs_list 응답에 최종수정시각(updated_at) 필드가 없어 판정 불가');

  for (const item of currentItems) {
    const status = item.status;
    // wbs_list 응답은 리프 전용 progress 필드를 따로 주지 않는다 — computedProgress가
    // 리프에서는 자신의 진행률, 그룹에서는 롤업 진행률을 겸한다.
    const progress = typeof item.computedProgress === 'number' ? item.computedProgress : null;
    const leaf = !isGroup(item);

    // 3. 임박 기한 위반: deadline <= today && progress < 100 — High (그룹은 자식 마감이 실제 원인이므로 리프만 판정)
    const endDate = toDateOnly(item.endDate);
    if (leaf && endDate && progress !== null && progress < 100) {
      const daysToDeadline = daysDiff(today, endDate); // endDate - today
      if (daysToDeadline <= 0) {
        push(
          item,
          '임박 기한 위반',
          'High',
          '계획 종료일 경과 + 미완료',
          '즉시 에스컬레이션 + 일정 재계획',
          `endDate=${localDateStr(endDate)}, 기준일 대비 ${-daysToDeadline}일 경과, progress=${progress}`
        );
      } else if (daysToDeadline <= 3 && progress < 50) {
        // 4. 기한 박박: (endDate - today) <= 3일 && progress < 50% — Medium
        push(
          item,
          '기한 박박',
          'Medium',
          '잔여 기한 대비 진행률 부족',
          '가속화 협의, 스코프 축소 검토',
          `endDate까지 ${daysToDeadline}일 남음, progress=${progress}`
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
  // wbs_list 응답은 리프 전용 progress 필드를 따로 주지 않으므로(computedProgress가 리프/그룹
  // 겸용), 그룹 노드를 후보에서 배제하려면 필드 유무가 아니라 isGroup()으로 직접 걸러야 한다 —
  // 그룹의 마감을 후보로 넣으면 진짜 리프의 마감을 가려버릴 수 있다.
  const openWithDeadline = currentItems
    .filter(
      (it) =>
        !isGroup(it) &&
        it.status !== 'done' &&
        typeof it.computedProgress === 'number' &&
        it.computedProgress < 100
    )
    .map((it) => ({ item: it, endDate: toDateOnly(it.endDate) }))
    .filter((x) => x.endDate);
  if (openWithDeadline.length > 0) {
    const minTime = Math.min(...openWithDeadline.map((x) => x.endDate.getTime()));
    for (const { item, endDate } of openWithDeadline) {
      if (endDate.getTime() !== minTime) continue;
      const progress = typeof item.computedProgress === 'number' ? item.computedProgress : null;
      if (progress !== null && progress < 70) {
        push(
          item,
          '크리티컬 패스',
          'High',
          '전체 미완료 항목 중 가장 이른 마감인데 진행률이 낮음',
          '리소스 추가, 병렬화 재검토',
          `endDate=${localDateStr(endDate)}(전체 중 최단), progress=${progress}`
        );
      }
    }
  } else {
    skipped.push('크리티컬 패스: endDate가 있는 미완료 리프 항목이 없어 판정 대상 없음');
  }

  // 6. 롤업 추락: parent.computedProgress ↓ 5%p (이전 스냅샷 필요) — Medium
  if (previousItems) {
    const prevById = byId(previousItems);
    for (const item of currentItems) {
      if (typeof item.computedProgress !== 'number') continue;
      const prev = prevById.get(String(item.id));
      if (!prev || typeof prev.computedProgress !== 'number') continue;
      const drop = prev.computedProgress - item.computedProgress;
      if (drop >= 5) {
        push(
          item,
          '롤업 추락',
          'Medium',
          '자식 항목 중 하나 이상이 완료→미완료로 되돌려지거나, 새 자식 항목이 progress=0으로 추가됨',
          'wbs_list(parentId=<부모_id>)로 자식들을 재조회해 변화 요인 식별',
          `computedProgress: ${prev.computedProgress} → ${item.computedProgress} (${drop.toFixed(1)}%p 하락)`
        );
      }
    }
  } else {
    skipped.push('롤업 추락: --previous 미제공으로 이력 비교 불가 (이전 스냅샷 필요)');
  }

  // 7. 의존성 블로킹: parent.status='delayed' → children.startDate_passed — High
  for (const item of currentItems) {
    if (item.parentId === undefined || item.parentId === null) continue;
    const parent = curById.get(String(item.parentId));
    if (!parent || parent.status !== 'delayed') continue;
    const startDate = toDateOnly(item.startDate);
    if (!startDate) continue;
    const passed = daysDiff(startDate, today) >= 0;
    const progress = typeof item.computedProgress === 'number' ? item.computedProgress : null;
    if (passed && item.status !== 'done' && progress !== 100) {
      push(
        item,
        '의존성 블로킹',
        'High',
        '상위 항목(parent)이 delayed라 자식이 실질적으로 시작 불가',
        '상위 항목 가속화 또는 의존성 제거 검토',
        `parent(${parent.id})=delayed, startDate=${localDateStr(startDate)} 경과, 현재 status=${item.status}`
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

  if (meta.filteredWarning) {
    push(`## ⚠ 필터된 스냅샷 경고`);
    push();
    push(meta.filteredWarning);
    push();
  }

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

function buildFilteredWarning(currentLoad) {
  if (!currentLoad.filtered) return null;
  return (
    `--current 스냅샷이 필터된 것으로 보입니다(summary.total=${currentLoad.summaryTotal}, ` +
    `실제 items 개수=${currentLoad.rawCount}). 이 스크립트는 스냅샷 안의 parentId 관계만으로 ` +
    `그룹/리프를 판별하므로(isGroup), 자식이 전부 걸러진 그룹은 리프로 오판될 수 있습니다 — ` +
    `"임박 기한 위반"·"기한 박박"·"크리티컬 패스"·"상태 불일치" 신호에 오탐 가능성이 있습니다. ` +
    `가능하면 필터 없는 전체 스냅샷으로 재조회해 대조하세요.`
  );
}

function run() {
  const opts = parseArgs(process.argv.slice(2));

  const currentLoad = loadItems(opts.current, opts.current ? '--current' : 'stdin(current)');
  const currentItems = currentLoad.items;
  const previousLoad = opts.previous ? loadItems(opts.previous, '--previous') : null;
  const previousItems = previousLoad ? previousLoad.items : null;

  const today = opts.today ? toDateOnly(opts.today) : toDateOnly(new Date());
  if (!today) {
    console.error(`--today 파싱 실패: ${opts.today}`);
    process.exit(1);
  }

  const { findings, skipped } = evaluate(currentItems, previousItems, today);
  const filteredWarning = buildFilteredWarning(currentLoad);

  if (opts.format === 'json') {
    console.log(
      JSON.stringify(
        {
          today: localDateStr(today),
          currentCount: currentItems.length,
          previousProvided: !!previousItems,
          filteredSnapshotWarning: filteredWarning,
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
      filteredWarning,
    });
  }

  const hasHigh = findings.some((f) => f.severity === 'High');
  const hasAny = findings.length > 0;
  process.exit(hasHigh ? 2 : hasAny ? 1 : 0);
}

run();
