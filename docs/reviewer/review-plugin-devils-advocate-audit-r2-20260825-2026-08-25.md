# 리뷰 보고서 — malgn-agent 전수 감사 (악마의 변호인단 2라운드)

- **target_id**: `plugin-devils-advocate-audit-r2-20260825` (신규 = 최초 리뷰)
- **대상**: `malgn-agent/` 전체 — agents 21 · skills 38 · knowledge 44(+`README.md`) · hooks 2종 · bin 13 · `plugin.json`
- **기준 커밋**: 로컬 `main` HEAD `6f6bd22` (origin/main보다 앞섬)
- **등급**: Sensitive/Exploration 전수 감사 → **풀패널(발산형 포함) 6인**
- **일자**: 2026-08-25
- **직전 라운드**: `plugin-devils-advocate-audit-20260825`(배포본 v1.8.6 `788a2c8` 기준, 보고서 파일 없음 — 텍스트 반환. 근거는 `docs/reviewer/personas/INDEX.md` 해당 항목)

---

## 종합 판정: 🟡 **Amber**

| 심각도 | 건수 |
|---|---|
| 🔴 Critical | **0** |
| 🟠 Major | **5** |
| 🟡 Minor | 8 |
| ⚪ Nit | 2 |
| 🔵 Rethink | 2 |
| 기각·강등 | 5 |

Critical 0이므로 Red는 아니다. 다만 Major 5건 중 1건(RV-001)은 **직전 라운드에서 이미 지적됐던 항목의 재발**이고, 2건(RV-002·RV-003)은 **에이전트가 매 호출마다 읽는 본문 안의 정면 모순**이라 Green으로 볼 수 없다.

---

## 페르소나 패널 — 재사용/신규 표 (산출물 게이트)

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 역할개념 열만 스크리닝했다. **신규 0건 — 6개 전부 재사용**(직전 전수 감사와 동일 패널).

| 페르소나 | 유형 | 재사용/신규 | 사유 |
|---|---|---|---|
| `persona-product-body-portability-auditor.md` | 수렴 | **재사용** | 역할개념("설치 직원이 조회할 수 없는 근거가 제품 본문에 유입됐는가")이 이번 스코프의 식별자·이력 재스캔과 동일 |
| `persona-spec-implementation-conformance-auditor.md` | 수렴 | **재사용** | "선언(개수·규약) ↔ 실물 1:1 대조"가 이번 개수·frontmatter·등재 감사와 동일 |
| `persona-script-skill-consistency-auditor.md` | 수렴 | **재사용** | "문서 단정 ↔ 코드 실측 한 줄씩"이 README/SKILL ↔ `bin/` 대조와 동일 |
| `persona-field-executability-officer.md` | 수렴 | **재사용** | "지시대로 지금 실행 가능한가"가 hub 도구·INDEX 부재 검사와 동일 |
| `persona-hook-execution-safety-verifier.md` | 수렴 | **재사용** | "자기보고가 아니라 실기동 결과로"가 훅 픽스처 재현과 동일 |
| `persona-dead-reference-scope-challenger.md` | **발산** | **재사용** | "탐지 조건을 형태로 잡은 것과 목적 기준의 간극"이 이번 드리프트 가드·접두어 게이트 표면과 동형 |

> 6개 모두 §5 참고파일이 직전 라운드 대상에 고정돼 있어 **역할개념 수준으로만** 적용했다(2026-08-10 RV-002 선례와 동일 처리). 각 파일 "적용 이력"에 이번 라운드 항목을 append했고 INDEX 표의 "최근 재사용" 열을 갱신했다.

---

## 🟠 Major

### RV-001 — 배포 도달 미확보: v1.8.10 이후 제품 수정 6커밋이 버전 bump 없이 누적 【재발】
- **위치**: `malgn-agent/.claude-plugin/plugin.json`(version `1.8.10`) · `.claude-plugin/marketplace.json`(`1.8.10`) · `malgn-agent/CHANGELOG.md`(최상단 `## [1.8.10]`)
- **문제**: 릴리스 커밋 `aacd384`(v1.8.10) **이후** `malgn-agent/` 제품 파일 7개(evaluator.md·pm.md·trainer.md·qa-engineer.md·localizer.md·agent-upskill/SKILL.md·topic-learning/SKILL.md)를 고친 커밋 6건이 main에 쌓였으나, 세 곳 어디에도 버전 bump·CHANGELOG 항목이 없다. `/plugin update`는 `plugin.json`의 version 변화로 갱신을 감지하므로, 지금 상태로 push해도 **이미 1.8.10을 받은 직원에게는 오늘 고친 6건이 도달하지 않는다.**
- **확인방법**: `git log --oneline aacd384..HEAD -- malgn-agent/` → 6커밋 / `git diff --stat aacd384..HEAD -- malgn-agent/` → 7파일 +36/−26 / `git diff --stat aacd384..HEAD -- malgn-agent/.claude-plugin/plugin.json .claude-plugin/marketplace.json malgn-agent/CHANGELOG.md` → **빈 출력**
- **재발 여부**: **재발**. 직전 `reviewer-audit-fixes-20260825` 라운드 Minor ③(“CHANGELOG·버전 bump 부재로 `/plugin update` 도달 미확보”), 그 전 `backlog-terminology-fix` 라운드와 동일 양상.
- **분류**: 결함

### RV-002 — 16개 에이전트가 첫 줄에서 읽는 공통 문서가 존재하지 않는 pm.md 정책을 인용
- **위치**: `malgn-agent/knowledge/common/agent-common-principles.md:9`
- **문면**: “위임 시점에 이미 위험도가 판정되어 있고(`pm.md`의 위임 정책 — risk_level medium 이하는 PM이 직접 결정, high만 사람 승인)”
- **문제**: `malgn-agent/agents/pm.md:69`가 **정반대로 못박고 있다** — “등급은 … 5등급(Micro/Standard/Sensitive/Exploration/Refactor)만 쓴다 — risk_level(low/medium/high) 같은 별도 위험도 체계는 이 표에 없다.” 또 `skills/common-task-grading-and-verification-depth/SKILL.md:8`은 “risk_level(… 자율엔진 내부 개념, malgnai-hub 연동판에는 해당 없음)”이라 명시한다. 즉 이 문장은 **없는 정책을, 그 정책이 없다고 선언한 문서를 근거로 인용한다.** 이 파일은 21종 중 16종이 자기 “핵심 원칙” 첫 줄에서 참조하는 상시 경유 문서라 파급이 크다.
- **확인방법**: `grep -rn "risk_level" malgn-agent/` 전수(3파일 5건 전량 열람) / `grep -rl "agent-common-principles" malgn-agent/agents/*.md | wc -l` → 16
- **재발 여부**: 신규 검출(직전 감사 미검출). 도입 시점은 오늘 라운드가 아니라 `b902405`(플러그인 개명 시점)로 확인 — 장기 잔존 모순.
- **분류**: 결함

### RV-003 — `work_record`의 주인이 한 표 안에서 둘로 갈리고, 하위 스킬 3종이 서로 반대로 지시 【오늘 라운드 잔여】
- **위치**: `malgn-agent/agents/trainer.md:50-51`(책임 구분 요약 표) · `skills/agent-upskill/SKILL.md:21` · `skills/reflect-lessons/SKILL.md:86` · `skills/topic-learning/SKILL.md:109,117`
- **문제**: trainer.md 표에 `work_record`가 두 행으로 등장한다 — 「학습 이력 기록(`agent_learning_record`+`work_record`)」→ **Trainer ✅ 필수**, 「프로젝트 단위 기록(`work_record`, 필요 시 `issue_record`)」→ **PM ✅ 필수**. 같은 도구인데 두 주인이고, **둘을 가르는 판별 기준이 어디에도 없다.** 그 결과 하위 스킬이 갈렸다:
  - 모드 1 `agent-upskill/SKILL.md:21` — “학습 기록 → **trainer가** malgnai-hub `work_record`(…)”
  - 모드 4 `reflect-lessons/SKILL.md:86` — 산출물에 “malgnai-hub 기록(`work_record` + `agent_learning_record`)” (trainer 책임)
  - 모드 3 `topic-learning/SKILL.md:109` — “trainer는 이 스킬을 완료해도 **프로젝트 단위 기록을 직접 남기지 않는다** — … PM이 `work_record`(status='completed')를 남긴다”
  같은 에이전트가 모드에 따라 같은 도구의 주인이 바뀌는데 그 사유가 적혀 있지 않다. `trainer.md:114` 자기검증은 “`work_record` … 둘 다 trainer 본인 책임”이라 모드 3과 정면 충돌한다.
- **확인방법**: 4파일 원문 Read + `git diff aacd384..HEAD -- malgn-agent/skills/` — 오늘 커밋 `1a84ba0`/`29bd03b`가 `agent-upskill`과 `topic-learning`을 **서로 반대 방향으로** 같은 시리즈에서 수정한 것 확인
- **재발 여부**: 신규(오늘 “판정 회차 기록 주체 일원화” 라운드의 파생 잔여). `decision_record` 주체 일원화 자체는 evaluator로 전건 정합함을 확인했다(아래 “잘 된 점” 참조) — 갈린 것은 `work_record`다.
- **분류**: 결함

### RV-004 — 실재하는 hub 도구 `agent_score_record`가 제품 전체에서 0회 참조 → 점수 조회 경로가 영구 공집합
- **위치**: 미참조(부재) / 반대편 지시: `knowledge/README.md:134` · `knowledge/leadership/team-composition-patterns.md:86` · `skills/reflect-lessons/SKILL.md:17,78` · `agents/trainer.md:80,149` / 요구 지점: `knowledge/leadership/agent-training-guide.md` §6.4
- **문제**: hub 스키마에 `agent_score_record`(agentName·overallScore 0~100·dimensionScores·evaluatorNote·improvementNote)가 실재하고, 읽는 쪽 `agent_get_context`는 `scoreHistoryLimit`으로 **“점수 추이”를 조회한다고 제품 4곳이 지시한다.** 그런데 **쓰는 쪽을 지시하는 문장이 제품 본문 전체에 단 한 줄도 없다.** evaluator는 Scorecard 4축 채점을 하고도 `decision_record.reason`에 “점수 요약표”를 산문으로 넣으라고만 지시받는다(`agents/evaluator.md:128`). 결과: ① 점수 추이는 아무도 쓰지 않으므로 영원히 비어 있고, ② `agent-training-guide.md` §6.4가 학습 보고서에 요구하는 **“이전 점수 [스킬/100, 경험/100, 최종/100]”의 출처가 존재하지 않으며**, ③ §6.1은 점수를 `agent_learning_record`의 **title 문자열**(“… (+1점)”)로 적게 해 수치가 질의 불가 형태로 묻힌다.
- **확인방법**: `grep -rn "agent_score_record" malgn-agent/` → **0건** / `ToolSearch`로 `agent_score_record`·`agent_get_context` 스키마 원문 확인(둘 다 실재, 필드 1:1 대응) / `agent-training-guide.md:395-445` 열람
- **재발 여부**: 신규 검출
- **분류**: 결함(실행 불가 지시 + 죽은 조회 경로). 수리 자체는 “명백한 개선” 범주 — 도구가 실재하고 매핑이 1:1이다.

### RV-005 — `doc-drift.mjs` CLI가 “전부 측정불가”일 때도 ✅ 통과를 출력한다(거짓 통과)
- **위치**: `malgn-agent/hooks/doc-drift.mjs:305` — `if (!hasDrift && !hasPmIssue && r && !r.empty) console.log('\n✅ 문서가 코드와 일치.')`
- **문제**: `r.skipped.length`를 조건에 넣지 않아, 매니페스트의 모든 체크가 측정불가(glob 루트 부재·깊이 상한 절단 → `measure()`가 null)여도 **“(skip, 측정불가: …)” 바로 다음 줄에 “✅ 문서가 코드와 일치.”가 붙고 exit 0**이다. 같은 파일 주석(`:189-193`)이 `empty` 플래그를 만든 이유로 “호출부가 실제로는 아무것도 측정하지 않았는데 통과(✅)로 보고했다”를 들고 있는데, **그 결함이 `skipped` 경로에 그대로 남아 있다.**
- **확인방법**: 임시 프로젝트(`.claude/doc-drift.json` = `{"checks":[{"label":"agents","expected":21,"glob":"nonexistent-dir/**/*.md"}]}`)에서 `node .../doc-drift.mjs` 실행 → 출력 `(skip, 측정불가: agents)` + `✅ 문서가 코드와 일치.` + `exit=0` 재현
- **재발 여부**: 신규 검출(직전 `doc-drift-prune-gaps` / `doc-drift-truncation-fix` 라운드 모두 이 분기는 다루지 않음)
- **분류**: 결함

---

## 🟡 Minor

### RV-006 — SessionStart 훅이 `skipped`·`empty`를 무시해 세션에 아무 신호도 보내지 않음
- **위치**: `malgn-agent/hooks/sessionstart-context.mjs:88-93` — `if (r && r.drift.length)`만 검사
- **문제**: `computeDrift()`는 `{results, drift, skipped, empty}`를 반환하고 CLI 쪽은 셋 다 처리하는데, **전 직원 모든 세션에 자동 실행되는 이 소비자만 `drift`만 본다.** 매니페스트가 측정 불가 상태로 썩어도 세션에는 침묵 → 사용자가 알 방법이 없다.
- **확인방법**: 위 RV-005와 같은 임시 프로젝트에서 훅 실행 → `additionalContext`에 드리프트 경고 0바이트. `checks:[]` 케이스도 동일(CLI는 ℹ️ 안내 출력).
- **분류**: 결함. 단 “토큰 0” 설계 의도와 트레이드오프가 있어 Major로 올리지 않음(아래 트레이드오프 참조).

### RV-007 — `README.md`의 무의존성 단정이 같은 절 표의 `capture.mjs`와 충돌
- **위치**: `malgn-agent/README.md:86` vs `:93`
- **문면**: “외부 패키지 설치 없이 Node 내장 모듈만으로 도는 스크립트라 Windows·macOS에서 똑같이 실행됩니다.” — 그러나 7줄 아래 표에 `capture.mjs | Playwright로 화면 캡처`가 있고, `bin/capture.mjs:159`는 `await import('playwright')`, 실패 시 “`pnpm add -D playwright && pnpm exec playwright install chromium`”을 안내하고 `exit 1`한다.
- **확인방법**: `README.md:80-100` 열람 / `bin/capture.mjs:150-190` 열람 / `grep "^import\|require(" bin/check-edge-api-security.mjs` → 그쪽은 내장 모듈만(단정 참)
- **참고**: `skills/common-screen-verification-and-capture/SKILL.md:17`은 사전조건을 정확히 적고 있다 — 틀린 곳은 README 한 줄뿐이다.
- **분류**: 결함(사실 오류)

### RV-008 — `stop-mcp-reminder.cjs`가 stdin `null`에서 TypeError·exit 1
- **위치**: `malgn-agent/hooks/stop-mcp-reminder.cjs:128` — `const a = analyzeTurn(payload.transcript_path)`
- **문제**: `JSON.parse("null")`은 예외를 던지지 않고 `null`을 반환하므로 파싱 try/catch 폴백이 걸리지 않는다. 전역 Stop 훅이 stderr를 뱉으며 비정상 종료한다(세션 차단은 아님 — exit 2가 아니므로).
- **확인방법**: 8케이스 stdin 픽스처(`{}` / 빈문자열 / `not-json` / `{"stop_hook_active":true}` / 존재하지 않는 transcript_path / 존재하지 않는 cwd / `null` / `[]`) 실행 → `null`만 exit 1 + `TypeError: Cannot read properties of null`, 나머지 7건 exit 0
- **분류**: 결함(방어 공백). 실입력 가능성은 낮음.

### RV-009 — knowledge 개수 표기가 4곳에서 44/44/44/45로 갈림
- **위치**: `CLAUDE.md:146`(44) · `malgn-agent/README.md:5,71`(44) · `plugin.json` description(44) · `.claude/doc-drift.json` `expected: 45`
- **문제**: 실제 파일은 `README.md` 포함 45, 제외 44다. 매니페스트만 README를 포함해 세므로 `check-docs`가 “✅ knowledge: 문서=45 실측=45”를 출력하는데, **여기서 “문서=45”는 어떤 문서의 주장도 아니고 매니페스트에 복제해둔 숫자다.** 세 문서의 44는 이 가드가 검사하지 않는다.
- **확인방법**: `find malgn-agent/knowledge -name '*.md' ! -name README.md | wc -l` → 44 / 포함 시 45 / `doc-drift.mjs:203`가 `check.expected`를 “문서=”로 출력하는 코드 확인
- **분류**: 결함(표기 불일치) — 구조적 원인은 RT-001 참조

### RV-010 — `knowledge/README.md`의 설명이 “21개 에이전트 공통”인데 실제 참조는 16개
- **위치**: `malgn-agent/knowledge/README.md`(common/ 목록의 `agent-common-principles.md` 설명행) vs `knowledge/common/agent-common-principles.md:5`(“16개 이상의 에이전트 MD가 …참조한다”)
- **확인방법**: `grep -rl "agent-common-principles" malgn-agent/agents/*.md | wc -l` → **16**(미참조 5종: pm·trainer·evaluator·qa-engineer·security)
- **분류**: 결함(사실 오류, 경미)

### RV-011 — 파일명 없는 절 참조 “§1.2 U0/U1/U2 층위”가 어디에도 없음
- **위치**: `malgn-agent/knowledge/common/agent-common-principles.md:19`
- **문면**: “…비개발 직군까지 배포된다(§1.2 U0/U1/U2 층위).”
- **문제**: 어느 문서의 §1.2인지 적혀 있지 않고, `U0`/`U1`/`U2` 토큰은 저장소 전체에서 **이 줄 한 곳에만** 존재한다. 설치 직원이 따라갈 대상이 없는 죽은 참조.
- **확인방법**: `grep -rnE 'U0\b|U1\b|U2\b' malgn-agent/ --include='*.md'` → 1건(자기 자신)
- **분류**: 결함(죽은 참조)

### RV-012 — 제품 본문에 “설계는 이랬는데 구현은 달랐다”는 이력 서술 잔존
- **위치**: `malgn-agent/knowledge/architecture/usage-collection-agent-architecture.md:57`(및 `:5`의 출처 각주)
- **문면**: “설계 문서(`token-usage-collection-design-2026-08-19.md`)는 아래를 상정했지만, 실제 구현은 다르게 갔다.”
- **문제**: 참조 대상은 `:5`가 스스로 밝히듯 **플러그인에 번들되지 않는 저장소 전용 문서**다. 설치 직원은 열 수 없으므로 이 대비 서술은 근거가 되지 못하고, `CLAUDE.md` “제품 본문은 최신 상태만 담는다 — 이력을 남기지 않는다” 원칙의 “이관·폐기 경위” 항에 해당한다. 표 자체(코드 실측 정본)는 유효하므로 **대비 문장만** 대상이다.
- **확인방법**: 해당 파일 `:1-60` 열람 / `:5` 각주 문면 확인
- **분류**: 결함(원칙 위반). 단 “번들되지 않는다” 각주가 붙어 있어 완화 — Minor 유지.

### RV-013 — `reviewer.md`가 5곳에서 “반드시 Read”로 지시하는 INDEX.md의 부재 처리가 없음
- **위치**: `malgn-agent/agents/reviewer.md:36,58,61,62,118`
- **문제**: “새 페르소나를 작성하기 전, **반드시** `docs/reviewer/personas/INDEX.md`를 먼저 Read해…”, “INDEX.md에 새 행을 추가한다”, 자기검증 체크까지 전부 **파일이 이미 있다고 전제한다.** 신규 설치 조직에는 이 파일이 없으며(첫 리뷰가 곧 최초), 누가 어떤 형식으로 만드는지가 어디에도 없다. 첫 reviewer 실행이 “필수 절차 불이행”으로 자기검증을 통과할 수 없거나, 각자 다른 형식을 발명한다.
- **확인방법**: `grep -n "INDEX.md" malgn-agent/agents/reviewer.md` 전 5건 문맥 열람 / `Skill reviewer-persona-panel-standard` §0 참조 지시 확인
- **분류**: 결함(실행 가능성 공백). 신규 설치에서만 발현.

---

## ⚪ Nit

### RV-014 — `usage-agent-healthcheck` 스킬이 Linux/cron 폴백과 세 번째 로그 파일명을 다루지 않음
- **위치**: `malgn-agent/bin/install-usage-agent.mjs:162-167`(`unsupportedLinux()` — `>> ~/.claude/malgnai-hub/usage-agent.log`) vs `skills/usage-agent-healthcheck/SKILL.md`(`cron`/`Linux` 토큰 **0건**, 로그는 `.out.log`/`.err.log`만 안내)
- **확인방법**: `grep -n "cron\|Linux" skills/usage-agent-healthcheck/SKILL.md` → 0건 / 스크립트 해당 함수 열람
- **완화**: 스크립트 자신이 “맑은소프트 직원 PC는 macOS/Windows 대상”이라 범위 밖임을 밝힘.

### RV-015 — `check-assets` WARN 18건이 상시 노이즈로 남아 새 WARN을 묻는다
- **위치**: `pnpm run check-assets` 출력(ERROR 0 · WARN 18 · INFO 2)
- **문제**: ABS_PATH WARN 4파일 9건은 **전수 확인 결과 전건 정당**하다(`~/.claude/projects/**/*.jsonl` 로그 경로, `~/.claude/malgnai-hub/` 크리덴셜 경로, “개인 전역 설정과 플러그인은 다르다”를 설명하는 문장 등 — 플러그인 자원을 가리키는 오용이 하나도 없음). 정당한 예외를 표시할 수단이 없어 영구 WARN으로 남고, BUDGET_UNJUSTIFIED 12건과 합쳐 18건이 기본 상태가 된다. `BUDGET_RATIONALE` 등록 경로가 이미 있는 예산 규칙과 달리 ABS_PATH에는 그런 통로가 없다.
- **확인방법**: `grep -rn '~/\.claude/' malgn-agent/skills/*/SKILL.md` 9건 전수 열람 + `check-assets` 출력 대조

---

## 🔵 Rethink (발산형 — `persona-dead-reference-scope-challenger`)

### RT-001 — 드리프트 가드가 “문서”를 읽지 않는다: 형태(복제된 숫자)와 목적(문서가 코드와 어긋나는가)의 간극
- **현재 구조**: `.claude/doc-drift.json`에 `expected` 숫자를 **복제 보관**하고, `computeDrift()`가 그것과 glob 실측을 비교해 `문서=N ↔ 실측=M`으로 보고한다.
- **무엇이 어긋났나(실측)**: “문서=”라는 라벨이 붙은 값은 어떤 문서에서도 읽어오지 않는다(`doc-drift.mjs:202-203`). 실제 문서 셋(`CLAUDE.md:146`·`README.md:5,71`·`plugin.json` description)은 44라 적고 있고 매니페스트만 45다 — **가드가 지키겠다는 대상이 이미 가드 밖에서 갈려 있으며 아무 신호도 나지 않는다.** 게다가 knowledge를 하나 늘리면 사람이 고쳐야 할 곳이 네 곳(문서 3 + 매니페스트 1)인데, 가드는 그중 **한 곳만** 강제한다. “문서가 코드와 어긋나는가”라는 목적에 대해 이 구조는 원리적으로 실패한다.
- **대안 구조**: `measure()`에 **이미 존재하는** `check.file` + `check.regex` 분기(`:179-182`)를 “매치 개수”가 아니라 “정규식 캡처그룹의 숫자 추출”로 확장하고, 매니페스트를 `{label, glob, docFile, docRegex}` 형태로 바꿔 **문서에서 직접 읽은 숫자 ↔ glob 실측**을 비교한다. 그러면 `expected` 복제가 사라지고(단일 소스), 문서 셋이 갈리면 그 자리에서 걸린다.
- **비용 라벨**: **저비용** — 근거: 해당 `file`+`regex` 분기가 이미 구현돼 있음을 원문으로 확인했고(`doc-drift.mjs:179-182`), 매니페스트 소비자는 `computeDrift()` 하나뿐(호출부 2곳: CLI `main()`, SessionStart 훅). 추정치 아님.
- **분류**: **명백한 개선**(지금 깨진 것은 RV-009 표기 불일치 쪽이고, 구조 교체는 개선) → 변경 동결 하 백로그

### RT-002 — evaluator 스킬 접두어 게이트: 형태(grep 히트 수) 대 목적(상시 비용) 간극 【직전 감사 지적 잔존】
- **현재 구조**: `agents/evaluator.md:60` — “접두어(common-/domain-/무접두어)가 실제 참조 에이전트 수 구간과 일치(`grep -rl <스킬명> agents/*.md` — 1개=무접두어, 2~4개=domain-, 5개 이상=common-)”
- **무엇이 어긋났나(실측)**: 게이트 자신의 명령으로 38종을 전수 재현하니 **6종 위반**이 그대로 남아 있다 — `common-beyond-mediocre-output`(3) · `common-output-storage-and-path-management`(1) · `common-product-principles-reference`(1) 은 미달, `learning-loop-patterns`(4) · `project-orchestration`(4) · `reflect-lessons`(2) 는 초과. 그런데 미달 3종은 개별 에이전트가 이름을 직접 적지 않고 `knowledge/common/agent-common-principles.md`(16개 에이전트 경유)를 통해 도달하므로 **비용 구조상으로는 진짜 공통**이다. 게이트를 문면대로 집행하면 파괴적 개명 6건이 필요한데 실제 부담은 하나도 바뀌지 않는다.
- **대안 구조**: 판정축을 “agents/*.md에서 이름이 몇 번 grep되는가”가 아니라 **“상시 비용인가 조건부 비용인가”**(에이전트 MD 본문에 상시 실리는가 / invoke 시에만 로드되는가)로 재정의하고, 경유 참조(knowledge 공통 문서를 통한 도달)를 계산에 포함한다.
- **비용 라벨**: **저비용(문면 1항 교체)** — 근거: 게이트가 `evaluator.md` 체크리스트 1줄이고 자동 집행 스크립트가 없음을 확인(`scripts/validate-agent-assets.mjs`에 접두어 규칙 없음).
- **재발 여부**: **잔존**(직전 전수 감사 Rethink, 미해소)
- **분류**: **막연한 개선 아님 / 명백한 개선** → 다만 개명 여부 판단이 필요하므로 백로그

---

## 이전 감사(v1.8.6 시점) 대비 회귀·재발 대조표

| 직전 감사 지목 항목 | 이번 상태 | 확인방법 |
|---|---|---|
| knowledge 고아(어떤 agents/skills/knowledge도 참조 안 함) | ✅ **해소 유지 — 0건** | 44개 전 파일에 대해 basename 역참조 스캔, 자기 자신 제외 |
| 스킬·knowledge 맨 상대경로 참조 | ✅ **해소 유지 — 0건** | `grep -rnE '(^|[^/{A-Za-z_}-])`?knowledge/…'`·`skills/…/SKILL.md` 및 `node …bin/*.mjs` 비변수형 전수 |
| 폐기 도구명(`lesson_*`/`memory_*`/`decision_add` 등)이 실행 단계로 지시됨 | ✅ **해소 유지 — 0건** | 전수 grep. 유일 히트는 `evaluator.md:52`의 **금지 목록 자체**(허용된 각주) |
| 식별자(8hex/ULID/커밋해시/메모리키) 제품 본문 유입 | ✅ **해소 유지 — 0건** | 백틱 없는 형태 무관 grep 2종. 히트 4건 전부 오탐(`86400000` 상수 · 캡처 파일명 예시 `20250210`×2 · 문서화된 가짜 해시 `a1b2c3d4`) |
| canonical(정본) 선언 중복 | ✅ **충돌 없음** | “X가 정본” 패턴 32건 집계 — 소유자별 1건씩, 같은 주제 다중 선언 없음 |
| hooks 실행 안전성 | 🟡 **부분 회귀 아님 / 신규 2건** | 픽스처 13케이스 실기동 → RV-005·RV-006·RV-008 |
| 스킬 접두어 게이트 6종 위반(직전 🔵 Rethink) | 🔴 **잔존 — 6종 그대로** | 게이트 자신의 명령으로 38종 전수 재현 |
| 버전 bump·CHANGELOG 누락으로 배포 미도달 | 🔴 **재발** | RV-001 |
| skills frontmatter name ↔ 디렉토리명 | ✅ 38/38 일치 | 전수 대조 |
| `knowledge/README.md` 등재 완전성 | ✅ 44/44 양방향 일치 | `comm` 양방향 0건 |
| 개수 선언(agents 21 / skills 38) | ✅ 일치 | `check-docs` + 실측 |

---

## 페르소나별 관점 요약

- **제품 본문 이식성 감사관** — 직전 라운드의 대청소(식별자·이력·맨경로)는 **전건 유지되고 있다**. 새로 잡은 건 “형태”가 달라 이전 grep에 안 걸리던 둘: 파일명 없는 절 참조(RV-011)와 번들 밖 문서와의 대비 서술(RV-012).
- **명세-구현 적합성 감사관** — 개수·frontmatter·등재는 이 저장소가 가장 잘 지키는 축이다(3개 축 전부 완전 일치). 갈린 것은 “숫자를 여러 곳에 복제해둔 것”(RV-009)과 “도구 소유권을 표로 정의했는데 그 표가 스스로 두 행으로 갈린 것”(RV-003).
- **문서-코드 정합성 감사관** — 단정 4건을 코드로 대조해 1건만 거짓이었다(RV-007). Windows 로그 리다이렉션처럼 “의심스러워 보이지만 실제로 구현된” 단정은 기각했다.
- **현장 실행가능성 검사관** — 가장 무거운 발견 둘. hub 도구가 있는데 아무도 안 쓰는 바람에 **읽기 지시가 영구 공집합을 읽게 되는 경로**(RV-004), 그리고 신규 설치에서 반드시 밟히는데 처리가 없는 INDEX 부재(RV-013).
- **훅 실행 안전성 검증가** — 자기보고가 아니라 13개 픽스처와 임시 프로젝트 재현으로만 판정했다. 파싱 방어는 대체로 견고하나 `null` 한 구멍(RV-008)이 있고, 더 중요한 건 **모듈 주석이 스스로 “거짓 통과를 막으려 만들었다”고 적은 플래그를 두 소비자 중 하나가 무시하고 다른 하나는 조건에서 빠뜨린 것**(RV-005·RV-006)이다.
- **죽은 참조 스코프 도전자(발산형)** — 이 저장소의 반복 패턴은 “탐지 조건을 형태로 잡고 목적과 어긋난 채 두는 것”이고, 이번에도 두 곳에서 같은 모양으로 나왔다(RT-001·RT-002). 직전 라운드가 같은 진단을 냈는데 하나는 그대로다.

---

## 트레이드오프 (페르소나 간 의견 갈림)

1. **RV-006 — 훅이 `skipped`를 보고해야 하는가 vs 토큰 0 설계**
   - 훅 실행 안전성 검증가: “측정 불가를 침묵으로 처리하면 가드가 죽은 줄 아무도 모른다 — Major.”
   - 운영 현실주의 관점(발산형이 대리 제기): “이 훅은 전 직원 모든 세션에 물린다. `drift` 없을 때 0바이트를 내는 것이 이 훅의 존재 이유다. `skipped`는 대개 매니페스트를 아직 안 채운 신규 프로젝트에서 나므로 상시 경고가 되면 곧 무시된다.”
   - **권고**: Minor로 확정하되, 보고하더라도 **매니페스트가 존재하는데 전부 측정불가일 때만**(신규 스캐폴딩의 `checks:[]`는 제외) 1줄 내보내는 방식. RV-005(CLI 거짓 통과)는 이 트레이드오프와 무관하게 그 자체로 고쳐야 한다.

2. **RV-004 — `agent_score_record` 도입이 변경 동결에 걸리는가**
   - 현장 실행가능성 검사관: “이건 개선이 아니라 결함이다 — 지금 `agent_get_context`의 점수 조회 지시와 §6.4의 ‘이전 점수’ 요구가 **실행 불가**다.”
   - 명세-구현 적합성 감사관: “도구 신규 도입은 절차 신설에 가깝다. 최소 수리는 ‘점수 추이 조회’ 문면을 실현 가능한 수준으로 낮추는 쪽일 수도 있다.”
   - **권고**: 두 갈래(도구 배선 추가 / 조회 지시 하향) 모두 trainer 위임 대상. **어느 쪽이든 지금은 깨져 있다**는 사실은 갈리지 않는다.

---

## 잘 된 점 (다음 산출물의 기준)

- **직전 감사의 대청소가 전건 유지됐다.** knowledge 고아 0, 맨 상대경로 0, 폐기 도구명 0, 식별자 유입 0 — 네 축 모두 전수 재스캔으로 확인했다. 정리 라운드가 “한 번 치우고 다시 쌓이는” 패턴을 이번엔 반복하지 않았다.
- **`knowledge/README.md` 등재가 44/44 양방향 완전 일치**한다. 파일 추가 시 등재까지 한다는 규율(`trainer.md` 자기검증 항목)이 실제로 작동한 증거다.
- **오늘 라운드의 본래 목표였던 `decision_record` 주체 일원화는 전건 정합하다.** evaluator·pm·trainer·agent-upskill·topic-learning 5파일을 전수 대조했고, “판정 회차 기록은 evaluator 하나”가 서로를 정확히 가리킨다(RV-003은 그 옆의 `work_record`가 갈린 것이지 이 축의 실패가 아니다).
- **`doc-drift.mjs`의 주석 품질이 높다.** glob `**` 접기, 깊이 상한 절단을 부분값 대신 null로 처리하는 이유, `empty` 플래그를 만든 이유가 전부 “무엇이 실패했는가”로 적혀 있다 — RV-005를 찾아낼 수 있었던 것도 그 주석이 판정 기준을 제공했기 때문이다.
- **`bin/capture.mjs`의 실패 메시지가 모범적이다.** playwright 부재 시 원인·해결 명령·현재 cwd까지 찍고 exit 1 한다(`:170-178`). RV-007은 README 한 줄의 문제이지 이 스크립트의 문제가 아니다.
- **`common-screen-verification-and-capture` 스킬이 “지원하지 않는 것”을 명시적으로 나열한다**(`:41`). 폐기된 전역 CLI 서술을 옮겨오지 않았다고 스스로 밝히는 정직 서술이다.

---

## 기각·강등된 지적 (삭제하지 않고 사유와 함께 남김)

| 후보 지적 | 판정 | 사유(확인방법) |
|---|---|---|
| SessionStart 훅이 `CLAUDE_PROJECT_DIR`를 무시하고 cwd의 STATUS.md를 읽는다 | **기각** | 설계상 cwd 기준이 정본. 파일 헤더 주석 `:6`이 “cwd 의 STATUS.md”라 명시하고 코드(`:77`)와 일치. 오작동 아님 |
| `agent-training-guide.md` §6.1·§6.3의 날짜(`2026-07-09`, `upskill-architect-2026-07-09`)가 이력 유입 | **기각** | 둘 다 **형식 예시**(hub 기록 title 양식 / idempotencyKey 명명 규칙). `CLAUDE.md` “형식 예시 안의 날짜는 이력이 아니다” 면제 조항에 정면 해당 |
| `usage-agent-healthcheck` SKILL의 “두 OS 모두 로그를 리다이렉트한다”는 Windows에서 거짓(schtasks에 리다이렉션 문법 없음) | **기각** | `install-usage-agent.mjs:137-139`가 `cmd /c "… >> out 2>> err"`로 감싸 실제 구현됨. 단정 참 |
| `agents/reviewer.md`가 인용한 “동일 대상 인정 조건(4조건)”이 스킬에 없다 | **기각** | `common-task-grading-and-verification-depth/SKILL.md:42`에 정확히 4개 실재(동일 target_id / 7일 이내 / 리스크 범주 불변 / 파일 실질 중첩) |
| `check-assets` ABS_PATH WARN 9건이 이식성 위반 | **강등(→ RV-015 Nit)** | 9건 전수 열람 결과 **전건 정당** — 모두 진짜 개인 전역 경로(세션 로그·크리덴셜)를 가리키며 플러그인 자원 오용 0건. 결함은 “위반”이 아니라 “정당한 예외를 표시할 수단이 없는 것” |

---

## 미확인·생략 범위 (정직 보고)

- **화면 리뷰 없음** — 이 대상에 UI가 없다. `docs/screenshots/` 산출물 없음이 정상.
- **`bin/` 13개 중 실행 검증은 3개**(`doc-drift.mjs`, 두 훅)에 그쳤다. `analyze-usage.mjs`·`report-usage.mjs`·`pair-usage-device.mjs`는 개인 로컬 로그·hub 네트워크 전송을 건드리므로 **의도적으로 실행하지 않았다**(사용자의 “토큰 리포트 비공유·비기록” 지시 준수). 정적 대조만 수행.
- **`agents/` 21종 본문의 전면 정독은 하지 않았다.** frontmatter 전수 + 교차참조 grep + 오늘 변경분 diff 정독으로 대체했다. 따라서 “각 에이전트 본문 내부의 논리 결함”은 이번 스코프에서 **미탐지 가능성이 남아 있다**.
- **`skills/` 38종 본문 정독도 하지 않았다.** frontmatter·참조·단정 문장 grep 기반이다.
- **hub 이슈 2건**(`backlog-topic-learning-minor3-20260825`, `backlog-tool-name-grep-scan-procedure-20260825`)의 **원문은 조회하지 않았다** — reviewer에 hub 조회 권한은 있으나 위임에 projectId가 없었다. 대신 두 이슈의 대상 파일(`skills/topic-learning/SKILL.md`, 도구명 스캔 절차 = `evaluator.md:52`)을 직접 열어 부작용 여부만 확인했고, **그 파생으로 RV-003을 검출했다.**
- **실행 액션 없음** — 이 리뷰에서 커밋·push·병합·배포·전역 승격을 **하나도 수행하지 않았다.** 파일 쓰기는 이 보고서와 페르소나 6개 “적용 이력” append, `docs/reviewer/personas/INDEX.md` 갱신뿐이며 전부 `docs/` 아래다. `malgn-agent/` 는 한 바이트도 건드리지 않았다.

---

## PM 권고

1. **RV-001(배포 도달)을 먼저 닫아라.** 다른 수리를 아무리 해도 버전이 안 오르면 직원 PC에 도달하지 않는다. 오늘 6커밋 + 이번 라운드에서 채택할 수리를 묶어 한 번에 bump하는 편이 낫다.
2. **RV-002·RV-003·RV-011·RV-012는 결함으로 분류돼 변경 동결 예외에 해당한다**(“지금 무엇이 깨져 있는가”에 답이 있음). 전부 `malgn-agent/knowledge/`·`agents/`·`skills/` 아래 `.md`라 **trainer 위임 대상**이다 — 지시서에는 “무엇이 참으로 남아야 하는가”만 적고 문안은 trainer가 제안하게 하라.
   - RV-003은 **문안 수정이 아니라 판별 기준 신설**이 필요하다(“학습 이력 `work_record`”와 “프로젝트 단위 `work_record`”를 무엇으로 가르는가). 기준을 PM이 정하지 말고 trainer 제안 → reviewer 검증으로 가라.
3. **RV-004는 판단이 갈린다**(위 트레이드오프 2). 도구 배선을 추가할지, 조회 지시를 하향할지 결정이 먼저다 — evaluator·trainer 양쪽 의견을 받고 결정하라.
4. **RV-005는 결함, RV-006은 트레이드오프**다. `hooks/` 아래 `.mjs`는 `.md`가 아니지만 편집 권한 경계상 PM 직접 수정 대상이 아니다 — 직전 두 라운드처럼 backend-dev 위임이 선례다.
5. **RT-001·RT-002는 명백한 개선이나 구조 변경**이라 백로그. 단 RT-001은 RV-009의 근본 원인이므로, RV-009를 문면 수정으로만 닫으면 같은 드리프트가 다시 난다는 점을 기록해 두라.
6. **RV-013(신규 설치의 INDEX 부재)은 우리 저장소에서는 절대 재현되지 않는다** — 우리에겐 파일이 이미 있다. 설치 조직에서만 터지므로 여기서 눈으로 검증할 방법이 없고, 그만큼 놓치기 쉽다는 점을 판단에 넣어라.
