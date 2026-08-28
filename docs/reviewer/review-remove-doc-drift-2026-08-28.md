# doc-drift 기능 전체 제거 리뷰 보고서

리뷰 페르소나 패널(5인, 전원 재사용): `persona-spec-implementation-conformance-auditor.md` · `persona-semantic-force-preservation-auditor.md` · `persona-hook-execution-safety-verifier.md` · `persona-field-executability-officer.md` · `persona-dead-reference-scope-challenger.md`(발산)
리뷰 대상: 워크트리 `scratchpad/wt-docdrift`, 브랜치 `remove/doc-drift-feature`, 베이스 `22651f2`, **미커밋 워킹트리 상태** (17파일 +90/−875)
target_id: `remove-doc-drift-feature` — **최초 리뷰(풀패널)**
리스크 범주: 전역 자동실행 자산(SessionStart 훅 + 전 직원 배포 플러그인 코드 + 스캐폴더)
작업 등급: Refactor
리뷰 일자: 2026-08-28
종합 판정: 🟡 **Amber** (Critical 0 / Major 1 / Minor 4 / Nit 3 / Rethink 2 · 기각 4)

## 요약 (2분 규칙)

제거 자체는 깨끗하다 — `computeDrift`·`checkPmBlockInline`·매니페스트 개념의 잔존 참조가 제품 본문·저장소 스크립트·CI 어디에도 **0건**이고(git grep 실증), 존속시키기로 한 PM 관리 구역 메커니즘은 스캐폴딩 실행과 점검기 실행 + 양성 대조군으로 **온전함을 실행으로 확인**했다. 검사 3종(check-docs 3/3 · check-assets ERROR 0 · node --check 8/8) 전부 통과한다.

다만 배포 차단급 지적이 1건 있다: **스캐폴더가 새 프로젝트마다 심는 관리 구역 안내주석이 그 프로젝트에 존재하지 않는 명령(`pnpm run check-docs`)을 재동기화 절차로 지시한다.** PM은 이를 "고치면 전 직원 프로젝트가 일제히 `stale-wording`이 된다"는 이유로 별건 보류했으나, **그 전제는 사실이 아니다** — 안내주석 줄은 본문 비교 대상에서 제외되어 있고, 실제로 문구를 바꿔 돌려본 결과 판정은 `ok` 그대로였다(RV-001). 보류 근거가 무너졌으므로 이번 라운드에서 함께 고칠 것을 권고한다.

---

## 페르소나 재사용 판정 (산출물 게이트)

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 역할개념 열을 스크리닝했다. **신규 0건 — 5개 전부 재사용.**

| 페르소나 파일 | 유형 | 재사용/신규 | 사유 (INDEX 대조 근거) |
|---|---|---|---|
| `persona-spec-implementation-conformance-auditor.md` | 수렴 | **재사용** | INDEX 역할개념 "명세를 계약서, 커밋을 납품물로 놓고 조항 1:1 대조"가 이번 핵심질문 1·2(제거가 완전한가/과잉인가)와 동형 |
| `persona-semantic-force-preservation-auditor.md` | 수렴 | **재사용** | "삭제·치환 리팩터링 후 규칙의 강제력이 조용히 약해지지 않았는가"가 핵심질문 3(§6 재작성이 공허한 권고인가)과 정확히 동형 |
| `persona-hook-execution-safety-verifier.md` | 수렴 | **재사용** | "전역 자동실행 코드가 자기보고가 아니라 실제 실행 결과로 안전한가" — 이번 리스크 범주(SessionStart 훅·스캐폴더)와 동일 표면 |
| `persona-field-executability-officer.md` | 수렴 | **재사용** | "지금 당장 실행 가능한 구체 절차인가" — 제거 후 남은 §6·§9 절차의 실행가능성 판정 |
| `persona-dead-reference-scope-challenger.md` | 발산 | **재사용** | "스코프를 형태로 정의한 것과 목적 기준(조회·실행 가능성)의 간극" — 이번 라운드가 "doc-drift라는 이름"으로 스코프를 잡은 것과 "드리프트를 잡는다는 목적"의 간극이 정확히 그 표면. 다른 발산형 후보(`persona-zero-based-redesigner`·`persona-process-mechanism-zero-based-challenger`)보다 적합 |

> 5개 모두 §5 참고파일이 직전 라운드 대상에 고정돼 있어 **역할개념 수준으로만** 적용했다(INDEX 2026-08-10 재사용 시도 실패 기록 선례와 동일 처리).
>
> ✅ **[라운드 종결 부기 — 2026-08-28 이행 완료]** 아래 미이행 사항은 PM이 워크트리 수정 제약을 해제한 뒤 반영했다: 5개 페르소나 파일에 이번 라운드 "적용 이력"을 append하고 `INDEX.md`의 "최근 재사용" 열 5행 + 라운드 기록을 갱신함.
>
> ⚠️ **(리뷰 시점 기록) 미이행 (정직 보고)**: 각 페르소나 파일의 "적용 이력" append와 `INDEX.md` "최근 재사용" 갱신을 **하지 않았다.** PM 위임이 "이 워크트리에서 파일을 수정하지 마라"를 명시했기 때문이다. 이 5건의 이력 갱신은 PM이 본 라운드를 닫을 때 별도로 반영해야 한다(누락 시 다음 라운드에서 같은 페르소나가 "신규"로 재생성될 위험 — 회전문 안티패턴).

## 변경 파일 대조 — 기대 범위 이탈 0

`git status --short` + `git diff --stat 22651f2` 실측 17파일 전부가 위임서의 기대 범위와 일치한다. 범위 밖 파일 **0건**.

```
 M .github/workflows/validate-plugin.yml     M CLAUDE.md
 M malgn-agent/CHANGELOG.md                  M malgn-agent/bin/check-output-conventions.mjs
 M malgn-agent/bin/new-project.mjs           D malgn-agent/hooks/doc-drift.mjs
 M malgn-agent/hooks/lib/find-pm-block-path.mjs   M malgn-agent/hooks/sessionstart-context.mjs
 M malgn-agent/skills/claude-md-architecture/SKILL.md
 M malgn-agent/skills/common-output-storage-and-path-management/SKILL.md
 M malgn-agent/skills/project-orchestration/SKILL.md
 M malgn-agent/skills/project-standards/SKILL.md
 M malgn-agent/skills/project-standards/scripts/check-pm-orchestration-block.mjs
 M package.json                              D scripts/check-doc-drift-spec.mjs
 M scripts/check-docs.mjs                    M scripts/validate-agent-assets.mjs
```

## 실행 검증 결과 (전부 직접 실행, 출력 인용)

| 검증 | 결과 |
|---|---|
| `pnpm run check-docs` | `OK agents: 문서=21 실측=21` / `OK skills: 문서=38 실측=38` / `OK knowledge: 문서=44 실측=44` → `개수 대조 3/3 통과`, **exit 0** |
| `pnpm run check-assets` | `--- 합계: ERROR 0 · WARN 18 · INFO 2 ---`, **exit 0** (WARN 18은 전부 기존 BUDGET_UNJUSTIFIED, 이번 변경과 무관) |
| `node .../check-pm-orchestration-block.mjs .` | `{"status": "ok", "message": "관리 구역이 유일하고 버전·본문 모두 최신 블록과 일치한다. 손댈 것 없음."}`, **exit 0** |
| `node --check` × 8 (변경 .mjs 7 + stop-mcp-reminder.cjs) | 전건 OK |
| `hooks.json` 참조 실재·로드 | `sessionstart-context.mjs`·`stop-mcp-reminder.cjs` 2종 모두 실재. 훅 직접 실행 → `{"hookSpecificOutput":{...,"additionalContext":"프로젝트 진행 상태 (STATUS.md) …"}}`, exit 0 (드리프트 경고 미부착 확인) |
| `new-project.mjs --here` 임시 실행(워크트리 밖 `scratchpad/np-test2`) | `STATUS.md · CLAUDE.md · docs/README.md · .claude/settings.json · package.json 중 신규 생성분 (+git init)` — `.claude/doc-drift.json` **미생성 확인**, PM 관리 구역 정상 삽입 확인, `package.json`에 `scripts` 키 없음 확인 |
| 잔존 grep `computeDrift\|doc-drift\|checkPmBlockInline` (이력 문서 제외) | `malgn-agent/CHANGELOG.md`만 매치(신규 제거 항목 + 지난 릴리스 항목). **제품 본문·스크립트·CI 잔존 0건** |
| `check-drift-spec\|check-doc-drift-spec` 잔존 | **0건** |
| `find . -name 'doc-drift*'` | **0건** |

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| RV-001 | 🟠 Major | 실행가능성 / 실행안전성 | `malgn-agent/hooks/lib/find-pm-block-path.mjs:44-45` (`MANAGED_REGION_NOTE`) → 렌더 지점 `:180` | ① 임시 디렉터리에 `new-project.mjs --here` 실제 실행 → 생성된 `CLAUDE.md` 6행에 `… 재동기화: pnpm run check-docs` 심김 확인 ② 그 프로젝트에서 `pnpm run check-docs` 실행 → `[ERR_PNPM_NO_SCRIPT] Missing script: check-docs` ③ `git grep 'check-docs' -- malgn-agent/`(CHANGELOG 제외) → 제품 본문에 남은 유일한 매치가 이 문자열 | 스캐폴더가 **모든 신규 프로젝트에 즉시 실패하는 명령을 재동기화 절차로 심는다.** 종전에는 스캐폴더가 `check-docs` 스크립트를 함께 만들어 이 지시가 실제로 동작했으나, 이번 제거로 스크립트만 사라지고 지시 문자열은 남았다 | `MANAGED_REGION_NOTE`의 `재동기화: pnpm run check-docs`를 실동작 경로로 교체(§9의 `check-pm-orchestration-block.mjs --write`, 또는 Rethink R-002의 스킬 지시 형태). **PM의 보류 근거는 성립하지 않는다 — 아래 반증 참조** |
| RV-002 | 🟡 Minor | 강제력 보존 | `CLAUDE.md:5`(재작성된 서술) · `scripts/check-docs.mjs` | 저장소 루트에서 `node .../check-pm-orchestration-block.mjs .` 수동 실행 → `ok`(기능 자체는 살아 있음). `.github/workflows/validate-plugin.yml:77` 주석으로 CI 미편입 확인 | 이 저장소가 자기 CLAUDE.md 인라인 구역 ↔ `hooks/pm-orchestration-block.md` 정본의 신선도 자동 대조를 잃었다. 블록 버전이 올라가면 이 저장소 CLAUDE.md는 조용히 `stale-version`이 되고 알려주는 장치가 없다 (질문 4B) | 수용 가능하나 **복구 비용이 낮다** — `scripts/check-docs.mjs`(PM 직접 편집 허용 영역)에서 개수 대조 뒤 `check-pm-orchestration-block.mjs`를 읽기전용으로 1회 spawn하고 종료코드를 합산하면 끝(약 8줄). `hooks/doc-drift.mjs` CLI를 되살리는 것이 아니라 존속 중인 점검기를 부르는 것이므로 이번 제거의 취지와 충돌하지 않는다 |
| RV-003 | 🟡 Minor | 명세-구현 적합성 | `malgn-agent/skills/common-output-storage-and-path-management/SKILL.md:74` | 해당 줄 Read + `new-project.mjs` 전문 확인(생성 코드 문자열 `checkDocsScript` 삭제됨) | "**예외 — 스캐폴딩되어 외부로 나가는 코드.** `bin/new-project.mjs`가 만들어 주는 프로젝트는 … 런타임 경로 탐색을 쓰는 것이 정상"이라는 예외 조항이 **가리키는 대상이 사라졌다.** 이번 제거로 new-project.mjs는 더 이상 실행 코드를 생성하지 않는다(데이터 파일만 씀). 같은 스킬의 디렉터리 트리에서 `doc-drift.json` 줄은 지웠으나 이 조항은 놓쳤다 | 조항 삭제 또는 "현재 생성물 없음"으로 축소. 남겨두면 다음 구현자가 "스캐폴더는 코드를 생성한다"고 오독한다 |
| RV-004 | 🟡 Minor | 죽은 참조 | `malgn-agent/hooks/lib/find-pm-block-path.mjs:262-266` | `git grep`으로 `MARKETPLACES_DIR_SEGMENTS`/`PLUGIN_DIR_NAME`/`findMalgnAgentBlockPath` 사용처 전수 확인 + base `22651f2`에서 동일 grep으로 사전 사멸 여부 분기 | 새 주석은 "이 두 상수가 레이아웃 규칙의 **단일 소유자**이며, 레이아웃이 바뀌면 이 두 상수만 고치면 된다"고 살아있는 유지보수 지시처럼 읽힌다. 실제로는 유일 소비자 `findMalgnAgentBlockPath()`가 **base에서 이미 소비처 0**이었고(설계문서 `docs/decision/pm-orchestration-block-inline-design.md:118`이 명시), 이번에 그 함수를 살려두던 마지막 명분(생성되는 check-docs가 두 상수를 쓴다)까지 사라져 **체인 전체가 도달 불가**가 됐다 | 이번 변경이 만든 결함은 아니므로 차단 사유 아님. 다만 주석을 "현재 소비처 없음(제거 백로그)"으로 정정하거나, 기존 백로그 항목(설계문서 §298의 `findMalgnAgentBlockPath`/`toHomeRelative`/`expandHome` 정리)에 두 상수를 합류시켜 한 번에 정리 |
| RV-005 | 🟡 Minor | 명세-구현 적합성 | `malgn-agent/skills/project-standards/SKILL.md:87-90`(§7) · `:109`(§8 1단계) | 스캐폴더 실제 실행 출력(`STATUS.md · CLAUDE.md · docs/README.md · .claude/settings.json · package.json` 5개) ↔ 문서 목록(4개) 대조 | 스탬프 목록에 `.claude/settings.json`이 빠져 있다 — 실측 5개, 문서 4개 (질문 4C) | **PM의 "기존 누락" 판정에는 동의하나, "이번 스코프 밖"에는 조건부 반대.** 이번 변경이 §7·§8의 **바로 그 목록 줄을 다시 썼다**(doc-drift.json 항목 삭제). 같은 줄을 열어놓고 인접 오류를 두면 이 파일을 다시 열 사유가 사라져 누락이 영구화된다 — 저장소 [변경이력 관리 원칙]("정본을 고칠 때 참조처를 같은 라운드에서 함께 정정")의 취지에 맞게 2줄 추가 권고. 차단 사유는 아니다 |
| RV-006 | ⚪ Nit | 명세-구현 적합성 | `malgn-agent/hooks/sessionstart-context.mjs:5-6` | 헤더 주석 Read | 항목 2)를 지운 뒤 `1)` 하나만 남은 번호 목록이 됐다 | 번호를 떼고 평문 한 줄로 |
| RV-007 | ⚪ Nit | 명세-구현 적합성 | `scripts/check-docs.mjs:124-126` | 파일 Read | `── 합산 ──` 구분 주석이 출력 1줄만 남기고 존치. "합산"할 대상이 하나뿐 | 주석 정리(무해) |
| RV-008 | ⚪ Nit | 문서 정합성 | `malgn-agent/CHANGELOG.md:16` | CHANGELOG 상단이 [Keep a Changelog] 준수를 명시(`:3-4`) | `[미출시]` 안에서 `### 제거`(Removed)가 `### 변경`(Changed)보다 앞에 온다. Keep a Changelog 권장 순서는 Added→Changed→Deprecated→Removed | 순서 교체(무해) |

### RV-001 보강 — PM 보류 근거(알려진 공백 A)의 실증 반증

PM은 "문자열을 바꾸면 이미 설치된 전 직원 프로젝트의 CLAUDE.md 마커가 일제히 `stale-wording`으로 판정돼 재동기화 프롬프트가 쏟아진다"를 보류 사유로 들었다. **코드와 실행 양쪽으로 반증된다.**

- **코드 근거**: `find-pm-block-path.mjs:142-148` — 관리 구역의 비교 대상 본문은 *1행(시작마커) + 2행(안내주석) 다음부터* 종료마커 전까지로 잘린다(`const bodyStart = Math.min(line2.lineEnd, endLine.lineStart)`). 즉 **안내주석 줄은 `body`에 포함되지 않는다.** 신선도 판정은 `bodyMatches(region.body, block.body)`(`:195`)이므로 안내주석 변경은 판정에 관여할 수 없다.
- **실행 근거 (양성 대조군 포함)**: 스캐폴딩된 임시 프로젝트에서
  - 안내주석의 `재동기화: pnpm run check-docs` → `재동기화: 전혀 다른 문구 XYZ`로 변경 후 점검 → `{"status": "ok", …손댈 것 없음.}`
  - (대조군) 블록 **본문** 한 문장만 축약 후 점검 → `{"status": "stale-wording", …}`
  → 검사기가 살아 있음을 확인한 상태에서 안내주석 변경이 판정에 영향 없음이 확인된다.
- **결론**: 파급이 없으므로 별건 사람 승인을 기다릴 이유가 없다. 오히려 **그대로 두는 쪽이 더 위험하다** — 신규 프로젝트가 생길 때마다 즉시 실패하는 명령이 계속 심기고, 그 지시를 따르는 세션은 "플러그인이 깨졌나"를 먼저 의심하게 된다.
- 단, `MANAGED_REGION_NOTE`를 바꿔도 **이미 설치된 프로젝트의 안내주석은 자동으로 갱신되지 않는다**(`--write` 시에만 재렌더). 그건 수용 가능한 상태다 — 기존 프로젝트에는 애초에 `check-docs` 스크립트가 실제로 있었을 수 있고, 없더라도 사용자가 명시 요청할 때 갱신된다.

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 명세-구현 적합성 | `check-pm-orchestration-block.mjs:10`의 `§6 상태 어휘` → `§9-1 상태 어휘` 변경이 존재하지 않는 절을 가리킨다 | **기각** | `project-standards/SKILL.md:155`(§9 절차 1번)이 13개 상태 어휘를 실제로 나열하고, 같은 파일 `:167`이 이미 `§9-4` 표기를 쓴다. 종전의 `§6`이 오기였고 이번 변경이 그것을 바로잡은 것 |
| 실행안전성 | 존속 대상인 PM 관리 구역 메커니즘이 손상됐다 | **기각** | 스캐폴딩 실제 실행(구역 정상 삽입) + 점검기 3상태 실행(`ok` / 안내주석 변조 시 `ok` / 본문 변조 시 `stale-wording`)으로 판정 로직·상태 어휘·`--write` 게이트 모두 온전함 확인. import 목록도 `IMPORT_LINE_RE·readBlockFile·extractManagedRegion·renderManagedBlock·bodyMatches·findStrayBodyCopy·maskFencedAndInlineCode`로 base와 동일 |
| 강제력 보존 | CHANGELOG `[미출시] ### 변경`의 기존 항목(doc-drift.mjs 주석 예시 교체)을 삭제한 것은 이력 삭제다 | **기각** | 그 항목은 아직 배포되지 않은 상태였고, 서술 대상 파일 자체가 이번에 삭제됐다. 존치하면 없는 파일의 주석을 고쳤다는 릴리스 노트가 나간다 |
| 죽은 참조 | `scripts/validate-agent-assets.mjs:1194`의 주석 예시 교체(`join(dirname(...), 'doc-drift.mjs')` → `path.join(SCRIPT_DIR, 'report-usage.mjs')`)가 실재하지 않는 코드를 인용한다 | **기각** | `git grep`으로 `malgn-agent/bin/install-usage-agent.mjs:31`에 그 형태가 실재함을 확인 |

## 페르소나별 관점

### [명세-구현 적합성 감사관] — 판정: 🟡 Amber
위임서의 제거 명세 5항목(`computeDrift` / `checkPmBlockInline` / 매니페스트 개념 / 스캐폴딩 / 사양대조 검사)을 계약서로 놓고 diff를 납품물로 1:1 대조했다. **5항 전건 착지, 잔존 참조 0.** CHANGELOG `### 제거` 항목의 5개 하위 서술도 실물과 정확히 일치하며(스캐폴더 3종·훅 경고 3종·CLI·`checkPmBlockInline`), "관리 구역 메커니즘은 그대로 있다"는 단정도 실행으로 참임을 확인했다. `claude-md-architecture` 역참조 4곳(§1 판정 3문 27행 / §4 크기규율 68행 / §6 진단 89행 / 체크리스트 110행)이 CHANGELOG 서술과 헤딩 위치(11/57/83/106)로 정확히 대응한다.
남은 불일치 2건은 **인접 서술의 미정정**이다 — RV-003(고아 예외 조항), RV-005(스탬프 목록 4 vs 5).

### [의미강도 보존 감사관] — 판정: 🟡 Amber
핵심질문 3("§6 재작성이 공허한 권고인가")에 대한 답: **공허하지 않다, 다만 강제력은 실제로 내려갔고 그 사실을 문서가 숨기지 않는다.**
- 새 §6은 4개 불릿 전부가 행위 지시다 — ①세는 대상 병기(`routes/ 12개`가 아니라 `server/routes/*.ts 12개`) ②셀 수 없으면 안 적음 ③구조를 바꾼 작업 안에서 함께 고침 ④마감 시 `ls`/`grep` 대조. 특히 ①은 검증 가능한 형태이고(문장에 경로 패턴이 있나 없나로 판정 가능), ③은 시점을 못 박아 "나중에"를 차단한다. 옛 §6의 실질 강제력이 얼마였는지도 옛 문면이 자백하고 있었다 — "스캐폴더가 만드는 매니페스트는 `checks`가 **빈 배열**", "매니페스트를 채우기 전까지 이 가드는 꺼져 있는 것과 같다". 꺼진 가드를 실행 가능한 규율로 바꾼 것은 강도 하락이 아니라 교환이다.
- 강도가 **실제로** 내려간 곳은 두 군데다: `project-orchestration` §6(문서지도 드리프트 — "자동 가드가 못 잡는다"→"알려주는 장치는 없다", 사실 서술로 정확)과 `project-standards` §9("상시 감시가 없으므로 이 온디맨드 절차가 **유일한** 안전망"). 둘 다 축소를 숨기지 않고 명시했다 — 정직 보고 기준 통과.
- 제품 본문 이력 금지 준수: 재작성된 §6·§9·§1 어디에도 "예전엔 매니페스트가 있었다" 류 서술이 없다. 식별자(hex·ULID·커밋해시) 신규 유입도 0.

### [훅 실행 안전성 검증가] — 판정: 🟢 Green
전역 자동실행 자산 3종을 자기보고가 아니라 **실행**으로 확인했다.
- SessionStart 훅: `hooks.json` → `sessionstart-context.mjs` 실재, 빈 stdin으로 실행 시 `additionalContext: ""` 정상 종료(exit 0), STATUS.md 있는 디렉터리에서 실행 시 본문 주입 정상. 삭제된 `await import(doc-drift.mjs)` 경로가 사라져 **Windows `ERR_UNSUPPORTED_ESM_URL_SCHEME` 우회 코드가 통째로 불필요해진 것은 순이득**이다(실패 가능 지점 1개 감소).
- 스캐폴더: 실제 실행 → 5파일 + git init 정상, `.claude/doc-drift.json` 미생성, PM 관리 구역 v3 정상 삽입, 완료 안내 6번 항목(doc-drift 채우기) 정상 제거.
- 점검기: 3상태 재현으로 판정 로직 무손상 확인.
**단, 스캐폴더 산출물의 내용은 안전하지 않다** — 생성된 CLAUDE.md가 실패하는 명령을 담는다(RV-001). 실행 자체는 안전하나 산출물이 오지시다.

### [현장 실행가능성 검사관] — 판정: 🟠 (RV-001 소유 관점)
"지금 당장 이 지시대로 치면 되는가"만 물었다.
- ✅ §9 절차: `node "${CLAUDE_PLUGIN_ROOT}/skills/project-standards/scripts/check-pm-orchestration-block.mjs" [cwd]` — 실제로 쳐서 동작 확인.
- ✅ §6 마감 대조: `ls`/`grep`은 어디서나 실행 가능하고, "세는 대상 병기" 규칙이 그 명령을 재구성할 수 있게 해준다.
- ❌ **관리 구역 안내주석의 `재동기화: pnpm run check-docs`** — 신규 스캐폴딩 프로젝트에서 그대로 치면 `[ERR_PNPM_NO_SCRIPT]`. 이 저장소에서 치면 자산 개수만 세고 PM 블록은 아예 보지 않는다. **두 환경 어디에서도 "재동기화"를 수행하지 않는다.**
- ⚠️ §6 4번("마감·정리 시점에는 실측 대조한다")은 트리거가 사람의 자각에 달렸다 — 실행 가능하되 실행될 보장이 없다. 이 관점에서 RV-002(저장소 자동 점검 복구)의 가치가 커진다.

### [죽은 참조 스코프 도전자 — 발산형] — 판정: 🔵 (아래 Rethink 섹션)
제거 스코프가 "**doc-drift라는 이름을 가진 것**"(형태)으로 잡혔고 "**문서가 코드와 갈라지는 것을 막는다**"(목적)로 잡히지 않았다. 그 결과 이름에 doc-drift가 없는 잔존물이 남았다 — 관리 구역 안내주석의 `check-docs` 문자열(RV-001), 스캐폴딩 예외 조항(RV-003), 두 레이아웃 상수(RV-004). 셋 다 grep 키워드 `doc-drift`에 걸리지 않는다. 이는 이 페르소나가 이전 라운드에서 지적한 것과 같은 실패 양상이다.

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| R-001 | §6이 "수치 옆에 **세는 대상**을 적어라"까지만 요구한다(`server/routes/*.ts 12개`). 대조하려면 사람이 매번 명령을 재구성해야 한다 | 수치 옆에 **세는 명령 자체**를 백틱으로 적게 한다 — 예: ``server/routes/*.ts 12개 (`ls server/routes/*.ts \| wc -l`)``. 그리고 이 저장소에서 실제로 살아남은 형태(`scripts/check-docs.mjs`가 문서 원문을 정규식으로 캡처해 실측과 비교, 21/38/44를 오늘도 통과)를 §6의 "그 다음 단계" 참고 패턴으로 명시 | 이번 제거가 증명한 것은 "드리프트 대조가 무가치하다"가 아니라 "**범용 매니페스트 DSL**이 무가치하다"이다 — 매니페스트는 `checks:[]`로 꺼진 채 방치됐지만, 같은 목적의 저장소 전용 스크립트는 이 라운드 리뷰에서도 실제로 돌아 3/3을 판정했다. 명령을 문장에 박으면 도구도 매니페스트도 훅도 없이 복붙 1회로 대조가 끝난다 | SKILL §6에 1~2줄 + 예시 1개. **낮음.** 변경동결 하에서는 백로그 |
| R-002 | 관리 구역 안내주석이 **재동기화 명령 문자열**을 사용자 CLAUDE.md에 사본으로 심는다 | 안내주석은 명령을 담지 않고 소유자만 가리킨다 — 예: `… 다르게 하려면 구역 밖에 적는다. 재동기화는 malgn-agent의 project-standards 스킬에 요청한다` | 이번 사고의 근본 원인은 "명령 이름이 바뀔 수 있는데 그 사본이 전 직원 파일에 흩어져 있다"는 구조다. 스킬 이름은 명령보다 안정적이고, 실제 커맨드는 §9가 단일 소유한다 — 커맨드가 또 바뀌어도 심긴 사본을 고칠 일이 없어진다. 마침 RV-001 수정이 같은 한 줄을 건드리므로 **추가 비용 0에 가깝다** | `MANAGED_REGION_NOTE` 1줄. **낮음.** 기존 설치본 안내주석은 `--write` 전까지 옛 문구 유지(판정에 영향 없음 — RV-001 반증 참조) |

## 트레이드오프 (페르소나 간 충돌)

- **훅 실행 안전성 검증가(🟢) ↔ 현장 실행가능성 검사관(🟠) — RV-001의 등급.** 전자는 "세션을 막지도, 데이터를 잃지도 않으니 Minor"라 보고, 후자는 "배포되는 스캐폴더가 100% 실패하는 명령을 심는 것은 Major"라 본다.
  → **권고: Major 유지.** ①영향 대상이 앞으로 생기는 **모든** 신규 프로젝트라 결정론적이고 ②PM이 유일하게 댔던 보류 근거가 실증으로 무너졌으며 ③수정 비용이 1줄이다. 세 조건이 겹치면 "돌아가는 데 지장 없다"는 근거로 미룰 이유가 없다.
- **의미강도 보존 감사관 ↔ 죽은 참조 스코프 도전자 — §6 재작성의 평가.** 전자는 "꺼져 있던 가드를 실행 가능한 규율로 교환했으니 순이득"으로 보고, 후자는 "대조를 사람 자각에 맡긴 것은 곧 안 하게 된다는 뜻"이라 본다.
  → **권고: 이번 라운드는 전자 채택(현행 §6 승인), 후자는 R-001 백로그로.** 새 §6은 옛 §6보다 명백히 덜 공허하다(옛 문면이 스스로 "가드는 꺼져 있는 것과 같다"고 적고 있었다). 강제 장치 추가는 개선이지 결함 수정이 아니므로 변경동결 원칙상 백로그가 맞다.
- **RV-005의 스코프.** PM은 "기존 누락이므로 스코프 밖", 명세-구현 감사관은 "같은 줄을 다시 쓴 라운드에서 함께 고쳐야 영구화를 막는다".
  → **권고: 함께 수정하되 차단하지 않음.** 2줄 추가이고 이미 열린 hunk다. 미이행 시 백로그에 명시적으로 남겨 다음 라운드가 재발견 비용을 치르지 않게 한다.

## 잘 된 점 (유지할 패턴)

1. **제거 잔존 0을 실제로 달성했다.** 훅·CLI·스캐폴더·스킬 4곳 + CI 주석 + 저장소 스크립트 + `package.json` 스크립트 2개 + 린터 면제 목록까지 전부 따라갔다. `git grep computeDrift|doc-drift|checkPmBlockInline` 결과가 CHANGELOG 단독인 것은 대규모 제거에서 드문 완성도다.
2. **CHANGELOG `### 제거` 항목이 검증 가능하게 쓰였다.** 없어진 것을 5개 하위 항목으로 열거하고, **존속하는 것을 별도 문단으로 못박았다**("관리 구역 메커니즘 자체는 그대로 있습니다"). 리뷰어가 대조할 대상을 저자가 먼저 제시한 형태 — 이 패턴을 다음 제거 라운드의 기준으로 삼을 만하다.
3. **제거 사유를 "안 쓰니까"가 아니라 실패 양상으로 적었다** — "스캐폴더가 만드는 매니페스트는 `checks`가 빈 배열이고 그 상태가 그대로 유지된다", "잴 수 있는 것이 파일 개수와 정규식 매치 수로 한정돼 실제로 자주 낡는 서술형 안내는 애초에 대상이 아니었다". 다음에 같은 아이디어가 재제안될 때 이 문단이 판단 근거가 된다.
4. **축소된 안전망을 숨기지 않았다.** §9 "상시 감시가 없으므로 이 온디맨드 절차가 유일한 안전망", `project-orchestration` §6 "알려주는 장치는 없다", 루트 CLAUDE.md "손으로 맞춘다(자동 대조 없음)" — 세 곳 모두 손실을 명시했다.
5. **삭제가 아니라 대체를 선택했다.** §6을 지우고 끝내지 않고 실행 가능한 4개 지시로 재작성했으며, 그 §6을 인용하던 3개 문서(`claude-md-architecture` 4곳 · `project-orchestration` 1곳 · 같은 SKILL 체크리스트)를 같은 라운드에서 함께 정정했다 — 저장소 [변경이력 관리 원칙]의 모범 적용.
6. **오기 1건을 덤으로 고쳤다** — `check-pm-orchestration-block.mjs` 헤더의 `§6 상태 어휘`(틀림) → `§9-1`(맞음).

## 평가기준 충족 현황

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|---|---|---|---|---|
| 제거 대상 5항목 전건 착지 | 명세-구현 | 필수 | ✅ | git grep 잔존 0 |
| 죽은 참조·죽은 명령 0 | 죽은 참조 | 필수 | ❌ | RV-001(안내주석), RV-003(고아 조항), RV-004(도달불가 상수) |
| 존속 대상(PM 관리 구역) 무손상 | 실행안전성 | 필수 | ✅ | 3상태 실행 재현 |
| `--write`·상태 어휘 13개 불변 | 실행안전성 | 필수 | ✅ | import 목록·§9 1번 대조 |
| 스캐폴더 나머지 산출물 온전 | 실행안전성 | 필수 | ✅ | 5파일 + git init 실행 확인 |
| 정적 게이트 통과(check-docs/check-assets/node --check) | 명세-구현 | 필수 | ✅ | 3/3 · ERROR 0 · 8/8 |
| 남은 §6이 실행 가능한 지시 | 실행가능성 | 필수 | ✅ | 4불릿 전부 행위 지시 |
| §6 역참조 4개 문서 정합 | 명세-구현 | 필수 | ✅ | 헤딩 위치까지 대조 |
| 제품 본문 이력·식별자 신규 유입 0 | 의미강도 | 필수 | ✅ | 재작성 문단 전수 확인 |
| 문서-구현 목록 일치 | 명세-구현 | 권장 | ❌ | RV-005(스탬프 4 vs 5) |
| 안내주석 명령 실행 가능 | 실행가능성 | 필수 | ❌ | RV-001 |
| Windows 동작 | 실행안전성 | 권장 | ⬜ | **미검증 — 아래 생략 명시** |

## 생략한 관점·검증 (정직 보고)

- **화면 캡처 없음** — 대상이 CLI/스크립트/문서라 UI가 없다. `docs/screenshots/` 산출물 없음이 정상.
- **Windows 실행 미검증** — macOS(darwin 25.5.0)에서만 실행했다. 다만 이번 변경은 Windows 전용 분기(`pathToFileURL` 우회)를 **제거**하는 방향이라 신규 플랫폼 리스크는 낮다고 판단한다(추정 — 실측 아님).
- **`--write` / `--decline` 경로 미실행** — 점검기의 읽기전용 경로와 상태 판정만 실행 재현했다. 이번 diff가 그 두 경로의 로직을 건드리지 않았고(헤더 주석만 변경) `git diff`로 확인했기 때문이다.
- **페르소나 파일 "적용 이력" append 및 `INDEX.md` 갱신** — 리뷰 시점에는 워크트리 파일 수정 금지 지시로 미이행. **라운드 종결 부기(2026-08-28)로 이행 완료.** 위 재사용 판정 표 참조.
- **실행 액션 없음** — 이 리뷰에서 커밋·푸시·PR 생성·병합·배포를 **하지 않았다.** 워크트리 내 유일한 파일 생성은 이 보고서 1건이며, 검증용 임시 프로젝트는 워크트리 **밖** `scratchpad/np-test2`에 만들었다.

## PM에게 권고

**판정 🟡 Amber — Critical 0. 아래 1건 수정 후 진행 가능.**

1. **[수정 후 진행] RV-001** — `MANAGED_REGION_NOTE`의 재동기화 명령 정정. **"알려진 공백 A"의 보류 판단은 철회를 권고한다.** 보류 근거였던 `stale-wording` 파급은 실증으로 존재하지 않는다(코드 근거 `find-pm-block-path.mjs:142-148` + 양성 대조군 포함 실행 재현). 별건 사람 승인을 기다릴 실익이 없고, 방치하면 신규 프로젝트마다 실패하는 지시가 계속 심긴다. 문안은 R-002(스킬 지시 형태)를 함께 검토하면 같은 한 줄로 재발까지 막는다. 대상이 제품 코드이므로 담당 에이전트에 위임한다(PM 직접 수정 금지 영역).
2. **[함께 처리 권고, 비차단] RV-003 · RV-005** — 각각 1~2줄. 이미 열린 hunk의 인접 오류라 지금이 가장 싸다. RV-005는 PM의 "기존 누락" 판정에는 동의하되 "이번 스코프 밖"에는 조건부 반대(사유는 표 참조).
3. **[판단 요청] RV-002 = 알려진 공백 B** — 공백 수용 자체는 **타당하다**(점검기는 살아 있고 온디맨드로 부를 수 있다). 다만 복구가 `scripts/check-docs.mjs` 약 8줄이고 PM 직접 편집 허용 영역이라, 수용보다 복구가 싸다고 본다. 결정은 PM 몫.
4. **[백로그]** RV-004(죽은 코드 체인 일괄 정리 — 기존 백로그와 병합) · RV-006~008(Nit) · R-001(§6에 세는 명령 병기) · R-002(안내주석 구조).
5. **[본 라운드 종결 시 필수]** 위 5개 페르소나의 "적용 이력" append + `INDEX.md` "최근 재사용" 갱신. 누락하면 다음 라운드가 같은 역할개념을 신규로 다시 만든다.
