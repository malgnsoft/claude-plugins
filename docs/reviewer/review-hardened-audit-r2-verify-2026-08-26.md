# hardened-audit-r2 수정분 독립 재검증 보고서 (2차)

- **target_id**: `hardened-audit-r2` (동일 대상 재검토, 2차)
- **직전 리뷰**: 라운드1 7트랙 통합본 `scratchpad/round1-consolidated-findings.md` + knowledge 트랙 보고서 `scratchpad/review-hardened-audit-knowledge-2026-08-26.md`
- **리스크 범주**: 전역 자동실행 자산(전 직원 배포 플러그인 제품 본문)
- **대상**: `audit-hardened-r2` 브랜치 `365871b..ba308c7` (3커밋 / 34파일 / +139 −119)
- **등급**: Sensitive — 풀패널
- **화면 리뷰**: 해당 없음(문서·설정 자산만, UI 산출물 없음) — `docs/screenshots/` 캡처 **생략함, 사유: 렌더링 대상 없음**

---

## 종합 판정: 🟡 **Amber**

Critical(A-1) **해소 확인**. 라운드1 채택 항목 대부분이 실물 대조로 착지했고 식별자·이력 재유입 0건, `check-assets` ERROR 0(WARN 18 · INFO 2, 기준선 동일). 다만 **같은 커밋이 손댄 파일 안에 같은 규칙의 짝 문장을 남겨 새 모순을 만든 회귀 1건(Major)** 과 **동일 결함 클래스의 미스윕 1건(Major)** 이 있어 Green이 아니다.

| 구분 | 건수 |
|---|---|
| 🔴 Critical | 0 |
| 🟠 Major | 2 (회귀 1 · 신규발견 1) |
| 🟡 Minor | 6 |
| ⚪ Nit | 2 |
| 🔵 Rethink | 2 |
| 기각/강등 | 3 |

---

## 0. 페르소나 재사용 판정 (산출물 게이트)

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 "역할개념(1줄)" 열을 스크리닝함. **신규 페르소나 0건 — 6개 전부 재사용**(6대 요소 본문 무수정, §5 참고파일이 직전 라운드 대상에 고정돼 있어 **역할개념 수준으로만** 적용 — INDEX 2026-08-10 RV-002 선례와 동일).

| 페르소나 | 유형 | 재사용/신규 | 사유(이번 라운드에서 맡은 질문) |
|---|---|---|---|
| `persona-spec-implementation-conformance-auditor.md` | 수렴 | **재사용** | 라운드1 지적을 계약서, 이 3커밋을 납품물로 놓고 조항 1:1 착지 대조 |
| `persona-script-skill-consistency-auditor.md` | 수렴 | **재사용** | 새 문안이 단정한 사실 ↔ 실물(HTML·스크립트 usage·pm.md 행·SKILL 헤딩) 실측 대조 |
| `persona-semantic-force-preservation-auditor.md` | 수렴 | **재사용** | 치환·재작성 후 규칙 경계가 조용히 바뀌지 않았는가(병렬 실행 스코프 한정어, ROI 병기) |
| `persona-field-executability-officer.md` | 수렴 | **재사용** | 고친 지시를 지금 그대로 실행할 수 있는가(Dockerfile, `--days 1`, 경로 참조) |
| `persona-harness-spec-factchecker.md` | 수렴 | **재사용** | 외부 사양 단정(Cloudflare 수치 3건)을 공식문서 원문으로 재대조 |
| `persona-dead-reference-scope-challenger.md` | **발산** | **재사용** | 수정 스코프를 "라운드1이 적어준 라인번호"(형태)로 잡은 것과 "같은 결함 클래스"(목적) 사이의 간극 |

> **모드 판정**: 재검토 3요소 모두 위임에 실려 있음. 풀패널 강제 승격 조건 중 "직전 Major 미해결"은 미해당(직전 지적이 곧 이번 수리 대상). 다만 33파일 일괄 수정이라는 **새 리스크 표면(회귀)** 이 있어 축소가 아닌 **증분(B) 모드 + 풀패널**로 진행했다.
>
> **프로세스 결손(정직 보고)**: PM 위임의 "어떤 파일도 수정하지 마라" 지시에 따라 **각 페르소나 파일의 "적용 이력" append와 INDEX.md 행 갱신을 하지 않았다.** `reviewer-persona-panel-standard` §0이 요구하는 절차이나 위임 금지사항이 우선한다고 판단했다 — PM이 이 라운드를 닫을 때 별도 반영이 필요하다.

---

## 1. 해소 확인 — 라운드1 지적이 실제로 사라졌는가

### 1-1. Critical A-1 (vue-zero 스킬 ↔ 정본 4중 모순) — ✅ **해소**

두 파일을 나란히 열어 라인 단위로 직접 대조함(수정자 보고 미신뢰).

| 라운드1 지적 | 수정 후 스킬 | 정본 | 판정 |
|---|---|---|---|
| (a) `<style scoped>` | `SKILL.md:141-146` `<style>` + `/* 전역 CSS (scoped 금지) */` | `vue-zero-architecture.md:153-158` 동일 문면 | ✅ 일치 |
| (b) `window.formatDate=`를 ❌로 낙인 | `SKILL.md:66` `window.formatDate = formatDate` 를 **권장 형태**로 제시 | `vue-zero-architecture.md:240-244` 동일 절차 | ✅ 일치 |
| (c) `browserUtils.js` 분리 강요 | `SKILL.md:153,156,200-201` "utils.js 한 파일에만, 성격별로 쪼개지 않는다" + `setToken` 예시 | `vue-zero-architecture.md:168,177` (`localStorage` 접근도 utils.js 소속) | ✅ 일치 |
| (d) `main.js`/`App.vue`에서 초기화 | `SKILL.md:53,255-257` "`app/assets/js/index.js` 한 곳으로 고정 (빌드 스텝이 없으므로 main.js·App.vue는 존재하지 않음)" | `vue-zero-architecture.md:15,240` · `:82-93` 파일 트리 | ✅ 일치 |

교차 확인: `knowledge/frontend/vue-zero-patterns.md:367`("② `<style scoped>` 금지 / ③ 유틸은 `utils.js`(import 불가)")과도 충돌 없음 — 스킬의 `import`는 페이지가 아니라 등록 스크립트(`index.js`) 안이며, 정본 `:242`가 같은 위치에서 같은 `import`를 쓴다.

**잔여 1건**은 아래 NF-03(정본 쪽 결함)으로 분리.

### 1-2. Major / Minor / D 항목 착지표

| 라운드1 항목 | 확인방법 | 판정 |
|---|---|---|
| B-1 반려·판정 주체 evaluator→reviewer (5곳) | `agents/ux-designer.md:62,71` · `agents/planner.md:20` · `domain-reference-benchmarking-standard/SKILL.md:3,20,25,46` 원문 확인 | ✅ 착지 — **단 스윕 미완(RG-01·NF-01·NF-02)** |
| B-2 `rfp-analyst.md:26` pm.md 참조표 오인용 | 원문 확인 + `agents/pm.md:71-82` 표 대조 | ✅ 오인용 제거 — **부분 잔존(M-4)** |
| B-3 `presenter.md:26` 죽은 참조 | `skills/project-orchestration/SKILL.md:129`(## 3. 팀 구성 원칙) · `:132`("발표=presenter") 실재 확인 | ✅ 해소 |
| B-4 shipley 순환 죽은참조 | `domain-shipley-proposal-methodology/SKILL.md:96` 새 문면 + `agents/reviewer.md:142` 대조 | ✅ 해소(순환 끊김) |
| B-5 `</content>` 잔재 2건 | `grep -rn "</content>" malgn-agent/` → 3건 히트 전부 "잔재를 잡으라"는 **정상 서술**(pm.md:145, frontend-dev.md:26,91) | ✅ 해소 |
| B-6 devops livenessProbe 자기모순 | `domain-devops-deployment-patterns/SKILL.md:334` `/livez` ↔ `:137,165,180` 일치 | ✅ 해소 |
| B-7 devops description 신호 부재 | frontmatter `:3`에 하드닝·livez/readyz·배포전략 신호 추가, `check-assets` ERROR 0 | ✅ 해소 |
| C-1 "trainer 모드 7" | `grep -rn "모드 7" malgn-agent/` → **0건** | ✅ 전수 해소 |
| C-2 A4 치수 뒤집힘 | `a4-vertical-layout/SKILL.md:8` `210mm×297mm` | ✅ 해소 |
| C-3 ROI 이중차감 | `financial-analysis-guide.md:38` 기본형 정정 | ✅ 해소 — **병기 문장이 새 오류(RG-02)** |
| D 경로 규약 (맨 상대경로) | `grep -rnoE '`(knowledge|templates)/…`' skills/ agents/` → 정본 자신의 설명 1건 외 **0건** | ✅ 전수 해소 |
| D 없는 "memory" 기록종류 | `common-learning-loop…:77`·`common-product-principles…:79` → `issue_record`/`decision_record`/`agent_learning_record`/`work_record`, 전부 실재 도구 | ✅ 해소 |
| D 없는 "§2.4" 참조 | `learning-loop-patterns/SKILL.md:157` → `agents/trainer.md` 핵심 원칙 "신설 판정"(trainer.md:31 실재) | ✅ 해소 |
| D 절번호 순서 | 패널 SKILL `## 5.5`(:148, §5=:97 / §6=:189 사이) · 외부리서치 SKILL `### 5`(:70) → `### 5-1`(:83). `grep -rn "§2\.5"` 잔존참조 0건 | ✅ 해소 |
| D 토큰진단 호출주체 자기모순 | 두 스킬 description ↔ `token-usage-diagnosis:110` · `usage-agent-healthcheck:135` 모두 "PM이 Micro 등급으로 직접 처리"로 일치. `pm.md:28`("Micro만 직접 처리")과도 정합 | ✅ 해소 |
| D 실재하지 않는 토큰 조회 경로 | `autonomous-iteration-philosophy.md:66-72` → Skill 포인터. `bin/analyze-usage.mjs:15,68` `--days N`(기본 1 = 오늘) 실측 — "날짜 범위를 하루로 좁히면 당일 누적치" 서술이 실물과 일치 | ✅ 해소 |
| D Cloudflare 수치 3건 | **공식문서 WebFetch 재대조**: 번들 무료 3MB/유료 10MB(압축 후) ✅ · 서브리퀘스트 50 / 10,000 ✅ · D1 무료 읽기 5,000,000행/일 · 쓰기 100,000/일 ✅ — 3건 모두 정확 | ✅ 해소 |
| D playwright.config 전제 | `e2e-testing-guide.md:75-78,81` "config에 설정해 둔다/추가한다"로 전환 | ✅ 해소 |
| D 병렬 실행 금지 모순 | `team-composition-patterns.md:107-123` 재작성. `project-orchestration/SKILL.md:133`의 **"전역 자산 승격 트랙에서만"** 스코프 한정어가 보존됐고 `:169` 경로 릴레이·`:176`·`:183` 격리 규칙과도 일치 | ✅ 해소(강제력 보존) |
| D 페르소나 저장 위치 | `reviewer-personas.md:12` → 플러그인 번들 `knowledge/review/persona-*.md`, 패널 SKILL:13과 일치 | ✅ 해소 |
| D PM 직접편집 지시 | `retrospective-framework.md:75-88` trainer/evaluator 위임형으로 재작성. 인용한 `pm.md` 표 행("전역 자산(agents/skills/knowledge) 승격 실행 = PM 권한 밖, evaluator 전담")이 `pm.md:78`에 **문자 그대로 실재** | ✅ 해소 |
| D 로고 경로·"함정" 서술 | `slide-design-guide.md:185,189`. 번들 실물 대조: `html-스타일가이드-가로형.html` `class="mark"` **0건**, `맑은_로고.png` `<img>` 참조 `:55`·`:225`. `html-스타일가이드-세로형.html`은 로고 자체가 없음(합성 마크도 0건) — 새 문장의 "그대로 복사해 쓰면 규칙을 어기지 않는다"는 양쪽 모두에 참 | ✅ 해소 |
| D 마스킹 규칙-예시 불일치 2건 | `:21` 유선전화 "지역번호 노출+국번 전체 마스킹+뒤4 노출" ↔ `02-***-5678` ✅ / `:23` 계좌 "앞 3자리+뒤 4자리" ↔ `110-***-**5678` ✅ | ✅ 해소 |
| D Blob URL 설명 사슬 | `vue-zero-architecture.md:266-268` 본문에 이유 직접 기술 + 번들 밖 "프로젝트 CLAUDE.md 규칙 5" 링크 삭제 | ✅ 해소 |
| D `.slide`→`.page` | `a4-document-fundamentals.md:295` | ✅ 해소 |
| `CLAUDE.md` check-docs 서술 | `pnpm run check-docs` 실행 → `.claude/doc-drift.json` 실재, agents/skills/knowledge 3건 개수 대조 실제 수행(21/38/45 모두 ✅) | ✅ 사실오류 정정 확인 |

### 1-3. 미해소 (이번 커밋이 손대지 않음)

| # | 위치 | 라운드1 항목 | 상태 |
|---|---|---|---|
| M-1 | `agents/devops.md:72` | RV-H06 배포 하드게이트(`docs/security-report.md` 존재+Critical/High 해결)가 `security.md:19`(사용자 승인 전 미착수)와 충돌해 원리적 미충족 가능 | **미착수** — 파일 무변경 확인 |
| M-2 | `agents/localizer.md:18` | RV-H07 "어색하면 사용자에게 확인을 구합니다" — `AskUserQuestion` 없는 서브에이전트가 못 할 경로 | **미착수** — 파일 무변경 확인 |
| M-3 | `agents/security.md:19` | RV-H08 참조표 정상적용을 "예외"로 오표현 | **미착수** — 파일 무변경 확인 |

세 건 모두 커밋 메시지가 커버를 주장하지 않으므로 **의도적 스코프 밖**으로 보이나, 라운드1 통합본에는 채택 후보로 올라 있어 유실 방지를 위해 기록한다.

---

## 2. 회귀 — 고치면서 새로 심은 결함

### 🟠 RG-01 (Major) — 같은 규칙이 두 파일에서 서로 다른 주체를 지목하게 됨

- **위치**: `malgn-agent/knowledge/planning/prd-craft-patterns.md:116`
- **확인방법**: `grep -rn "evaluator" malgn-agent/` 전수 후 일반 산출물 문맥만 선별 → `agents/planner.md:20` 원문과 나란히 대조
- **문제**: B-1 스윕이 `agents/planner.md:20`의 "인용 없는 차별점 서술은 **evaluator** 반려 사유입니다"를 `reviewer`로 고쳤다. 그런데 **동일 규칙의 원문 격인** `prd-craft-patterns.md:116`("인용 없는 차별점 서술은 **evaluator** 반려 사유다")은 그대로다. 이 커밋은 **바로 그 파일의 `:3`을 수정하며 파일을 열었다**(모드 7 정정).
- **왜 깨졌나**: `evaluator.md:26`이 "웹/앱 개발·제안서 등 일반 프로젝트 산출물의 다관점 리뷰는 reviewer 소관 … 그 밖의 산출물 리뷰 요청이 오면 reviewer로 돌려보냅니다"라고 명시적으로 거부한다. PRD 차별점 표는 정확히 그 "일반 프로젝트 산출물"이다. 게이트를 지목받은 주체가 수행을 거부하므로 **아무도 반려하지 않는다.** 게다가 planner가 `planner.md`와 `prd-craft-patterns.md`를 함께 읽으면 두 문장이 서로 다른 주체를 지시한다.
- **재현**: `grep -rn "인용 없는 차별점" malgn-agent/`
- **개선안**: `:116`의 `evaluator` → `reviewer` (1단어).

### 🟡 RG-02 (Minor) — ROI 병기 문장이 새 사실 오류를 들여옴

- **위치**: `malgn-agent/knowledge/finance/financial-analysis-guide.md:39`
- **확인방법**: 원문 + `knowledge/finance/financial-model-templates.md:32` 정의 + 바로 아랫줄 `:40` Payback 정의 대조
- **문제**: 새로 붙인 문장이 "두 형태의 분자 정의가 다를 뿐 **결과는 같아야 하며**"라고 단정한다. 이는 `총회수액 − 투자액 = 순이익`일 때만 참인데, 같은 줄이 총회수액을 **"비용 차감 전"** 으로 정의하므로 운영비용이 빠지지 않아 두 값은 일치하지 않는다. 기간 정의도 어긋난다 — 형제 파일 `:32`가 순이익을 Net Income(연간 손익 라인)으로 두고, 바로 아랫줄 Payback이 "**연간** 순현금흐름"을 쓰는데, 총회수액은 통상 누적치다.
- **개선안**: "결과는 같아야 하며"를 삭제하거나 "같은 기간·같은 비용 기준으로 정의했을 때만 두 형태가 일치한다"로 조건화.

### 회귀 없음이 확인된 축

- **조회 불가 식별자 신규 유입 0건** — `git diff 365871b..HEAD -- malgn-agent/ | grep '^+' | grep -oE '\b[0-9a-f]{8}\b|\b01[0-9a-hjkmnp-tv-z]{24}\b'` → 출력 없음.
- **이력(날짜 도장·버전·라운드·경위) 신규 유입 0건** — 추가 라인 대상 `20[0-9]{2}-[0-9]{2}-[0-9]{2}|v1\.[0-9]|라운드|이전엔|기존에는|커밋` grep → 출력 없음.
- **툴 출력 잔재 0건** — `</content>` 전수 3건 모두 "잔재를 잡으라"는 정상 서술.
- **바뀐 참조 대상 전건 실재** — `test -e`로 10개 경로 확인(로고 PNG·스타일가이드 HTML·e2e 가이드·캡처 가이드·정직보고·권한정책·e2e 템플릿 2종·번들 스크립트 2종) 전부 OK. 섹션 참조(`project-orchestration` §3·권위자 매핑, `trainer.md` 신설 판정, `pm.md` 승격 실행 행, shipley 4축)도 원문에서 실재 확인.
- **정적 검사 기준선 유지** — `check-assets` ERROR 0 · WARN 18 · INFO 2(부모와 동일), `check-docs` 전항목 ✅.
- **파일 끝 손상 없음** — `</content>` 제거한 2파일 및 재작성한 `team-composition-patterns.md` 말미 정상 종료 확인.

---

## 3. 신규 발견 (라운드1이 놓친 같은 결함 클래스)

발산형 페르소나가 "수정 스코프를 라운드1이 적어준 **라인번호**로 잡았지, 결함 **클래스**로 잡지 않았다"는 가설로 재스캔한 결과.

### 🟠 NF-01 (Major) — `skills/domain-brand-naming/SKILL.md:71`

- **확인방법**: `grep -rn "evaluator" skills/` 후 일반 산출물 문맥 선별 → 대상 산출물 정의(`:68` `docs/design/brand-naming.md`, `:69` marketer/visual-designer 작성) 확인
- **문제**: `## evaluator 판정 기준 (참고)` — `domain-reference-benchmarking-standard/SKILL.md`의 **글자 그대로 같은 헤딩**은 이번 커밋이 `## reviewer 판정 기준 (참고)`로 고쳤는데 이쪽만 남았다. 브랜드 네이밍 산출물은 evaluator.md:26이 명시적으로 돌려보내는 "일반 프로젝트 산출물"이다.
- **재현**: `grep -rn "판정 기준 (참고)" malgn-agent/skills/`
- **개선안**: 헤딩 1줄 `evaluator` → `reviewer`.

### 🟡 NF-02 (Minor) — `agents/ux-designer.md:25`

- **확인방법**: 라운드1 통합본 RV-H01이 "ux-designer.md:79,92,**25**"로 세 곳을 지목했음을 확인 후 원문 대조
- **문제**: ":79, :92"(현 `:62`, `:71`)는 고쳐졌으나 `:25`의 "핵심 경험 설계는 표준 화면보다 **evaluator/reviewer** 검토를 한 단계 더 받습니다"는 그대로다. 지목된 3곳 중 1곳 미착지.
- **개선안**: `evaluator/reviewer` → `reviewer`.

### 🟡 NF-03 (Minor) — 정본 `vue-zero-architecture.md`의 `export` 누락 (A-1 (c) 잔여)

- **위치**: `knowledge/architecture/vue-zero-architecture.md:182`(`async function useApi`) · `:233-238`(`function formatDate`) ↔ `:240-244`(`import { formatDate } from './utils.js'`)
- **확인방법**: 정본 스니펫 3개를 나란히 읽고 ESM 시맨틱 대조
- **문제**: 정본을 그대로 따라 쓰면 `utils.js`가 아무것도 export하지 않는데 `index.js`가 named import를 하므로 `SyntaxError: does not provide an export named 'formatDate'`. **수정 후 스킬(`SKILL.md:173,187,196` `export function`)이 옳고 정본이 틀린 상태**라, A-1의 (c) 항목이 완전히 소멸하지는 않았다(고쳐야 할 쪽이 반대편으로 바뀌었을 뿐).
- **개선안**: 정본 `:182`·`:235`에 `export` 추가(2단어). *변경 동결 기준상 "지금 무엇이 깨져 있는가"에 답하므로 결함으로 분류.*

### 🟡 M-4 (Minor) — `rfp-analyst.md:26` 부분 잔존

- **확인방법**: 새 문면 + `agents/pm.md:65`("의사결정 권한: 최종 결정은 PM. 다른 에이전트는 의견·근거 제공만") 대조
- **문제**: 라운드1 RV-H02의 후반부(참조표 오인용)는 해소됐으나, "최종 Bid/No-Bid **판단**은 capture-strategist 소관"이라는 전반부 서술은 남아 `pm.md:65`와 여전히 긴장 관계다. 인용한 shipley 스킬 `:47`은 "capture-strategist가 **작성**"(4축 점수표+권고)이라고만 하지 최종 판단 주체를 정하지 않는다.
- **개선안**: "판단" → "4축 평가·권고 작성" 수준으로 좁히면 세 문서가 모두 정합.

---

## 4. 수정자가 올린 판단 지점 4건 — 판정

### ① B-1 주체를 `reviewer`로 통일 — ✅ **적절한 선택**

`agents/evaluator.md:26`이 "웹/앱 개발·제안서 등 일반 프로젝트 산출물의 다관점 리뷰는 reviewer 소관 … 그 밖의 산출물 리뷰 요청이 오면 reviewer로 돌려보냅니다"로 **명시적으로 거부**한다. 5곳의 대상 산출물(PRD 차별점 표, `wireframes.md` 3필드·`visual-designer 필요:` 필드, before/after 벤치마크 대조 문서)은 전부 그 정의에 정확히 들어간다. **PM 인수검증이 맞는 곳은 하나도 없다** — `pm.md:82`가 "일반 산출물 직접 작성"을 PM 권한 밖으로 두고, `pm.md:75`는 Standard 등급 승인을 "reviewer 약식 검증 확인 후"로 조건 짓기 때문에 PM은 reviewer 판정의 소비자이지 1차 판정자가 아니다.

- **다만 표현상 Nit(N-1)**: `pm.md` 권한 참조표 기준으로 "반려"(재작업 반환)는 PM의 행위이고 reviewer가 내는 것은 🔴 판정 + 권고다. "reviewer 반려 사유"보다 "reviewer 🔴 판정 사유"가 엄밀하지만, evaluator를 두는 것보다는 명백히 낫다.
- **실제 문제는 선택이 아니라 스윕 범위**다 → RG-01 · NF-01 · NF-02.

### ② C-3 ROI 기본형 + 병기 — 🟡 **기본형은 타당, 병기는 되레 혼동**

- **기본형 `순이익 ÷ 투자액 × 100%`**: 재무 표준상 타당하다. ROI의 표준 정의는 `Net Return ÷ Cost of Investment`이고, `순이익`(Net Income)은 이미 비용 차감 후 값이므로 분자에서 투자액을 또 빼면 실제 +20%가 −80%로 뒤집히는 라운드1 지적이 정확히 해소된다.
- **병기 변형 `(총회수액 − 투자액) ÷ 투자액`**: 형태 자체는 교과서적(Gain-based)이라 병기 아이디어는 나쁘지 않다. **문제는 병기에 붙인 단정이다** — "결과는 같아야 하며"가 무조건 참이 아니고(RG-02), 같은 줄이 총회수액을 "비용 차감 전"으로 정의해 스스로 반증한다. 병기를 유지하려면 그 한 구절만 조건화하면 되고, 유지하지 않겠다면 병기 줄 자체를 빼도 기본형만으로 충분하다.

### ③ `reviewer-personas.md` 처치(중복 제거 보류 + 권위 주장만 정정) — 🟡 **부분적으로만 막힌다**

위험이 **완전히는 막히지 않는다.** 근거 3가지:

1. **진입 경로가 헤더를 우회한다.** `agents/reviewer.md:91`이 "이 파일 **패턴 D~E** 참조"로 특정 절을 지목한다. 그렇게 진입한 독자는 `:1-9`의 새 권위 선언을 지나치고 `:204` 이후에 착지한다.
2. **중복 절이 현장에서 자족적으로 읽힌다.** `:243 ## 산출물 게이트 (보고 전 반드시 통과 — 생략 불가)`는 그 자리에 로컬 포인터가 없어, 헤더를 못 본 독자에게는 이것이 완전한 게이트로 보인다. 실제로 이 절에는 SKILL에만 있는 "재사용 판정 표" 항목이 없다.
3. **파일 밖 설명이 실물과 여전히 어긋난다.** `knowledge/README.md:40`과 `agents/reviewer.md:139`는 이 파일을 "발산형 페르소나 배경, 선택 강화 패턴 A~C, 다차수 검증 패턴 D~G"로만 소개하는데, 실물은 `:17` 6대 요소 · `:64` 심각도 분류 · `:80` 보고서 표준 형식 · `:126` 패널 운영 · `:145` 발산형 규칙 · `:231` 안티패턴 · `:243` 산출물 게이트를 **전량 중복 보유**한다. 라운드1 RV-007이 지적한 이 불일치는 그대로다.

**동결을 지키면서 가능한 저비용 보강이 남아 있다**(리팩터 아님): 중복 절 머리 3~4곳에 "정본은 Skill … — 이 절은 요약본" 1줄씩, 그리고 `README.md:40` 설명을 실물에 맞게 정정. 지금 처치는 "1행부터 읽는 독자"만 보호한다.

### ④ 경로 표기 이원화(스킬=변수형 / knowledge=산문형) — ✅ **정본과 정확히 일치**

정본 `skills/common-output-storage-and-path-management/SKILL.md` §1-2를 원문 확인함:

> 에이전트·스킬 본문에서 플러그인 자원을 열라고 지시할 때는 `${CLAUDE_PLUGIN_ROOT}/knowledge/<도메인>/<파일>` 한 형태로 적는다. … **knowledge 문서 자신은 이 변수를 못 쓴다**(§1-1: 컴포넌트로 로드되지 않아 영원히 안 풀린다). 그 안에서는 "플러그인 루트 기준 `knowledge/…`"라고 말로 적는다.

이번 수정은 정확히 이 분기를 따랐다 — 스킬 본문(`common-screen-verification-and-capture:43,153,155,156,160`)은 변수형, knowledge 문서(`reviewer-personas.md:12,53,247,250` · `ux-design-guide.md:126` · `slide-design-guide.md:185`)는 산문형. **전수 스캔에서 남은 맨 상대경로 0건**(정본 자신의 설명 인용 1건 제외). 이 판단 지점은 결함 없음.

---

## 5. 미검증으로 남았던 항목 — Dockerfile 정적 판정

`knowledge/devops/docker-cloudflare-guide.md:6-27`. **Docker 미설치로 `docker build` 재현 불가 — 아래는 정적 검토 결과이며 "빌드 성공"을 주장하지 않는다.**

| 요소 | 판정 |
|---|---|
| `COPY package.json pnpm-lock.yaml ./` (`:11`) | ✅ **해소**. `--frozen-lockfile`의 전제인 lockfile이 실제로 들어간다. 이전 `package*.json` 글롭은 `pnpm-lock.yaml`을 담지 못했다 |
| 프로덕션 스테이지(`:17-26`) | ✅ 문제 없음. `node dist/index.js`만 실행하므로 pnpm 불요, `addgroup/adduser` + `USER appuser` 비루트 정상 |
| `RUN corepack enable` (`:9`) | 🟡 **불완전 — 여전히 실패 가능**(아래) |

### 🟡 M-5 (Minor) — `corepack enable` 단독으로는 부족할 수 있다

- 라운드1 권고는 `RUN corepack enable && corepack prepare pnpm@<ver> --activate`였는데 **후반부가 빠졌다.**
- `corepack enable`은 `pnpm` 셰임(shim)만 만든다. 실제 pnpm 버전 결정은 `package.json`의 `packageManager` 필드에서 오는데, 이 가이드가 제시하는 예시에는 그 필드가 없고 문서 어디에도 그 전제가 적혀 있지 않다. 필드가 없으면 corepack은 기본 버전을 네트워크에서 내려받으며, **다운로드 확인 프롬프트를 띄우는 corepack 판본에서는 비대화형인 도커 빌드에서 그대로 멈추거나 실패한다.**
- 즉 `:9`의 주석("없으면 `pnpm: not found`")이 약속하는 "이제 pnpm이 있다"는 **보장되지 않는다.**
- **최소 조치 3안 중 택1**: ⓐ `corepack prepare pnpm@<ver> --activate` 복원 ⓑ `ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0` 추가 ⓒ "`package.json`에 `packageManager` 필드가 있어야 한다"는 전제를 주석에 명시.
- **정직 보고**: 프롬프트 발동 여부는 corepack/Node 판본에 따라 갈리며 이 환경에서 실행으로 확정하지 못했다. "여전히 실패한다"가 아니라 **"실패 가능성이 남아 있고, 라운드1 권고의 절반이 근거 없이 빠졌다"** 가 이번 판정이다.

---

## 6. 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 정합성 | `docker-cloudflare-guide.md:25` `HEALTHCHECK … /health`가 같은 라운드에 `/livez`로 통일된 `domain-devops-deployment-patterns/SKILL.md:334`와 어긋난다 | **강등 → ⚪ Nit(N-2)/백로그** | Docker `HEALTHCHECK`와 k8s `livenessProbe`는 다른 계층이고, `/health`는 `domain-backend-api-implementation-patterns:315` `PUBLIC_PATHS`·`docker-cloudflare-guide:181-183`에서도 일반 헬스 엔드포인트로 일관되게 쓰인다. 이 커밋이 만든 불일치가 아니라 사전 존재 |
| 사실검증 | `docker-cloudflare-guide.md:105` "CPU 시간: 무료 10ms, 유료 **30초**" — 공식문서는 유료 최대 5분(기본 30초) | **강등 → 백로그** | 이 커밋이 손대지 않은 줄이고, 라운드1이 "정확하므로 유지"로 이미 판정한 항목. "기본값"이라는 한정어 부재는 정밀도 문제이지 파손이 아님 |
| 실행가능성 | `learning-loop-patterns/SKILL.md:157`이 스킬 본문에서 `agents/trainer.md`를 맨 상대경로로 적어 §1-2 규약 위반 | **기각** | §1-2의 대상은 "`knowledge/`의 학습 자료·스타일가이드·로고"를 **열라고 지시할 때**다. 이 문장은 정본의 소재를 지칭하는 것이고, `domain-training-scorecard-eval:10,154,157,186` · `topic-learning:109,113,119` · `agent-upskill:20` 등 다수가 같은 형태를 쓰는 확립된 관례 |

---

## 7. 구조적 제언 (Rethink) — 발산형 🔵

| # | 현재 구조 | 제안 | 왜 더 나은가 | 비용/리스크 |
|---|---|---|---|---|
| R-1 | 수정 스코프를 **직전 리뷰가 적어준 파일:라인 목록**으로 정의한다. 이번 라운드가 그 방식의 한계를 그대로 보여줬다 — 같은 규칙 문장이 다른 파일에 복제돼 있으면(RG-01), 같은 헤딩이 형제 스킬에 있으면(NF-01), 지목 목록에 세 곳 중 두 곳만 적혀 있으면(NF-02) 전부 살아남는다 | 결함을 **클래스**로 정의하고 그 클래스의 **판별 grep 1줄**을 수정 지시에 함께 넘긴다(예: B-1이면 "`evaluator`가 일반 프로젝트 산출물의 판정·반려 주체로 등장하는 모든 자리 — `grep -rn evaluator agents/ skills/ knowledge/` 후 승격 파이프라인 문맥 제외"). 수정자가 그 grep 결과를 0건으로 만들었음을 보고하게 한다 | 라인번호 목록은 리뷰어의 **표본**이지 모집단이 아니다. 지금 구조는 표본을 모집단으로 오인하게 만들고, 그래서 같은 클래스 결함이 라운드를 넘어 살아남는다 — 이번에 3건이 그렇게 살아남았다 | 낮음. 위임 지시서 서식만 바뀐다. 리뷰어 쪽 추가 작업은 grep 1줄 |
| R-2 | "정본은 저쪽" 선언이 **파일 머리 한 곳**에만 있고, 정작 중복된 본문 절에는 아무 표시가 없다(`reviewer-personas.md`가 대표 사례 — 판단 지점 ③) | 중복 보유가 불가피한 절에는 **그 절 머리마다** 1줄 포인터를 단다. 파일 단위가 아니라 **절 단위**로 권위를 표시한다 | 문서는 처음부터 읽히지 않는다 — `reviewer.md:91`처럼 특정 절을 지목하는 진입 경로가 실재하므로, 파일 머리의 선언은 그 독자에게 도달하지 않는다. 절 단위 표시는 리팩터 없이 동결 원칙 안에서 가능하다 | 낮음. `reviewer-personas.md` 기준 3~4줄 추가. **다만 이 비용 추정은 유사 중복을 가진 다른 knowledge 파일을 전수 조사하지 않은 미확인 추정치다** |

---

## 8. 트레이드오프 (페르소나 간 충돌)

- **정합성 vs 변경 동결** — 정합성 감사관은 NF-03(정본 `export` 누락)을 "정본이 실행 불가 코드를 가르친다"며 즉시 수정 대상으로 보고, 동결 관점은 "이번 위임 스코프(스킬 수정)의 반대편 파일"이라며 보류를 주장했다.
  → **권고: 채택한다.** 2단어 수정이고, "지금 무엇이 깨져 있는가"에 답한다(정본대로 쓰면 `SyntaxError`). 동결 원칙의 채택 대상인 "실증 가능한 결함 / 1파일 국소 수정"에 정확히 해당한다.
- **실행가능성 vs 정직 보고** — 실행가능성 관점은 Dockerfile을 "여전히 실패한다"고 단정하려 했고, 검증 규율 관점은 "Docker를 못 돌렸으므로 단정할 수 없다"고 막았다.
  → **권고: 후자.** M-5를 "실패 가능성 + 라운드1 권고의 절반 누락"으로 기술하고, 단정하지 않았다. 다만 문서가 주석으로 "이제 pnpm이 있다"를 **약속하고 있으므로**, 그 약속의 근거를 확인할 수 없다는 사실 자체는 결함으로 남긴다.

---

## 9. 잘 된 점 (유지할 패턴)

- **스코프 한정어를 잃지 않고 재작성했다.** `team-composition-patterns.md`의 "병렬 실행 금지" 폐기는 강제력을 뒤집는 재작성인데도, `project-orchestration/SKILL.md:133`의 **"전역 자산 승격 트랙에서만"** 이라는 한정어를 그대로 옮겼다. 이런 재작성에서 한정어가 조용히 넓어지는 것이 흔한 사고인데 일어나지 않았다.
- **인용한 근거가 전부 실물에 있다.** `pm.md:78`의 승격 실행 행, `project-orchestration:129·132`, `trainer.md:31` 신설 판정, shipley `:47` — 새로 만든 참조 4건이 문자 그대로 실재한다. 라운드1 결함의 상당수가 "없는 섹션 인용"이었던 것과 대비된다.
- **외부 수치를 공식문서로 실제 대조했다.** Cloudflare 3건이 이번 재검증의 WebFetch 재확인에서도 전건 일치했다. 덧붙인 "수치는 예고 없이 바뀐다 — 인용 전 원문 대조" 단서는 같은 결함의 재발을 구조적으로 막는 장치다(라운드1이 `digital-ad-channels.md:3`을 모범으로 든 그 관행).
- **정직 보고가 지켜졌다.** Docker 재현 불가를 감추지 않고 PM 판단으로 올렸다. 이 보고서의 §5는 그 정직성 덕분에 작성될 수 있었다.
- **식별자·이력 재유입 0건**이 이번에도 유지됐다. 33파일을 손대는 커밋에서 이 축이 무너지지 않은 것은 유의미하다.

---

## 10. PM에게 권고

**병합 전 처리 (Major 2 — 전부 1단어/1줄)**
1. `knowledge/planning/prd-craft-patterns.md:116` `evaluator` → `reviewer` (RG-01)
2. `skills/domain-brand-naming/SKILL.md:71` 헤딩 `evaluator` → `reviewer` (NF-01)

**같은 라운드에 함께 넣기 권장 (Minor, 전부 국소)**
3. `knowledge/finance/financial-analysis-guide.md:39` "결과는 같아야 하며" 삭제 또는 조건화 (RG-02)
4. `agents/ux-designer.md:25` `evaluator/reviewer` → `reviewer` (NF-02)
5. `knowledge/architecture/vue-zero-architecture.md:182,235` `export` 추가 (NF-03)
6. `knowledge/devops/docker-cloudflare-guide.md:9` corepack 3안 중 택1 (M-5)
7. `agents/rfp-analyst.md:26` "최종 … 판단" → "4축 평가·권고 작성" (M-4)

**별도 판단이 필요한 것**
- M-1/M-2/M-3(devops·localizer·security 각 1줄)이 의도적 스코프 밖인지 확인. 아니라면 같은 trainer 위임에 합류.
- 판단 지점 ③의 저비용 보강(중복 절 머리 포인터 3~4줄 + `knowledge/README.md:40` 설명 정정) 채택 여부. 중복 제거 리팩터는 동결 유지에 동의하나, 이 보강은 리팩터가 아니다.
- 발산형 R-1(수정 지시에 클래스 판별 grep 동봉)은 이번 라운드에서 3건이 살아남은 직접 원인이므로 프로세스 개선 후보로 등재 권장.

**수행하지 않은 실행 (정직 보고)**
- 어떤 파일도 수정하지 않았다. git commit/push/merge 하지 않았다. 읽기·grep·`check-assets`/`check-docs` 실행·WebFetch 2건만 수행했다.
- 페르소나 파일 "적용 이력" append 및 `INDEX.md` 갱신을 **하지 않았다**(위임의 파일 수정 금지 지시 우선). PM 측 별도 반영 필요.
