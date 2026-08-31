# 리뷰 보고서 — 골든 태스크 벤치마크 신규 도입

- **target_id**: `golden-task-benchmark-20260901` (신규 · 1차 최초 리뷰)
- **등급**: Exploration (새 시스템, 이 저장소에 처음 도입되는 컨벤션) → 발산형 포함 풀패널
- **대상 워크트리**: `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-a836b847eac1cc426`
- **대상 상태**: **전부 미커밋**(untracked/unstaged). 브랜치 `worktree-agent-a836b847eac1cc426`(HEAD `33a2b70`, main `df6a07b`보다 뒤처짐)
- **일자**: 2026-09-01
- **종합 판정**: 🔴 **Red** — Critical 1건(문서화된 사용법 전부가 조용히 무력화됨)

| 심각도 | 건수 |
|---|---:|
| 🔴 Critical | 1 |
| 🟠 Major | 8 |
| 🟡 Minor | 5 |
| ⚪ Nit | 3 |
| 🔵 Rethink | 2 |
| 기각 | 4 (+ 강등 1) |

---

## 0. 페르소나 재사용 판정

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 역할개념을 스크리닝했다. **신규 0건 — 5개 전부 재사용**(6대 요소 본문 무수정, "적용 이력"만 append). 5개 모두 §5 참고파일이 직전 라운드 대상에 고정돼 있어 **역할개념 수준으로만** 적용(2026-08-10 RV-002 선례와 동일 처리).

| 페르소나 | 유형 | 재사용/신규 | 사유 (역할개념 동형성) |
|---|---|---|---|
| `persona-script-skill-consistency-auditor.md` | 수렴 | **재사용** | "문서가 서술하는 옵션·임계값·근거 ↔ 코드 구현 1:1 대조" = 설계문서 §5 기본값표 ↔ `run-golden-eval.mjs` DEFAULTS ↔ 실행기록 3자 대조 |
| `persona-harness-spec-factchecker.md` | 수렴 | **재사용** | "제3자 하네스 사양 주장 ↔ 공식 원문 줄 단위 대조" = §0 「하네스 사실관계」 8행 검증 |
| `persona-ops-maintainability-realist.md` | 수렴 | **재사용** | "6개월 뒤에도 살아있는가" = R1 우회 제거 추적·기준선 버전 관리 |
| `persona-privacy-leakage-auditor.md` | 수렴 | **재사용** | "중앙 저장소에 그대로 공유되면 무엇이 새는가" = 공개 저장소 게시·타 직원 오발동(개인정보 → 공개 채널 유출로 확장 적용) |
| `persona-process-mechanism-zero-based-challenger.md` | **발산** | **재사용** | "도입한 메커니즘이 문제 크기에 비례하는가, 더 단순한 개입으로 같은 효과를 낼 수 있는가" = "회당 $16 LLM 벤치마크 vs $0 정적검사" |

발산형 후보 중 `persona-zero-based-redesigner.md`·`persona-mechanism-zero-based-challenger.md`는 각각 "훅+스킬 조합", "다중 레이어 구조"라는 이전 라운드 기제에 고정돼 있어 이번의 새 표면("측정 장치의 비용 대비 판별력")과 겹치지 않아 선택하지 않았다.

---

## 1. PM이 지정한 실물 대조 항목 — 결과

| # | 확인 항목 | 결과 | 근거(직접 실행) |
|---|---|---|---|
| 1 | 금지 범위(`agents/`·`skills/`·`knowledge/`·`hooks/`) 무변경 | ✅ **준수** | `git diff --stat $(git merge-base HEAD main)` → tracked 변경은 `.gitignore`·`docs/README.md`·`package.json` 3개뿐. untracked는 `docs/`·`scripts/`·`malgn-agent/evals/`. 4개 금지 디렉터리 아래 변경 0건 |
| 2 | origin push 여부 | ✅ **미push** | `git ls-remote --heads origin` → `refs/heads/main` **단 1개**. 워크트리 브랜치 없음 |
| 3 | `pnpm run check-assets` | ✅ **ERROR 0** (WARN 14 · INFO 7), exit 0 | 워크트리에서 직접 실행 |
| 3 | `pnpm run check-docs` | ✅ **3/3 통과** (agents 21 / skills 40 / knowledge 41 실측 일치), exit 0 | 워크트리에서 직접 실행 |
| 4 | 골든 태스크 ↔ `architect.md` 대응 | ✅ **지어낸 기준 없음** | 아래 §2 |
| 5 | 설계문서 사실 주장 표본 검증 | ⚠️ **수치는 전건 일치, 기본값 근거는 미검증 외삽** | 아래 §3 |
| 6 | 비용 통제 기본값의 정합 | ⚠️ **산수는 맞으나 전제가 미확인** | 아래 M-6 |

---

## 2. 골든 태스크 ↔ `architect.md` 대응 검증 (PM 항목 4)

`malgn-agent/agents/architect.md`를 직접 읽고 그레이더 12개를 한 줄씩 대조했다. **근거 없이 지어낸 채점 기준은 없다.**

| 그레이더 | 근거가 되는 `architect.md` 원문 | 대응 |
|---|---|---|
| `tradeoff-obligation` (w2) | L43 "형식: 선택 / 대안 / 선택 이유 / **포기한 것** / **감당 방안**" | 정확 (대안·포기·감당 3요소를 그대로 정규식화) |
| `uniqueness-obligation` (w2, llm) + `cites-comparison-table` (w1) | L45 "**어느 셀을 인용해** 기술적으로 무엇을 다르게 설계했는가" | 정확. 사실 판정(인용 유무)을 정규식으로 떼어낸 분리도 타당 |
| `abnormal-case-obligation` (w2) | L47 "외부 호출 **타임아웃**·실패 … **멱등성**" | 정확 |
| `api-completeness-obligation` (w2) | L49 "API마다 요청/응답 JSON 예시 + **에러 응답** + **권한 규칙** + **검증 규칙** 필수" | 정확 |
| `data-model-completeness-obligation` (w1) | L49 "DB 테이블마다 **인덱스** + 근거 + **제약(FK/UNIQUE/CHECK)** 필수" | 정확 |
| `writes-*-doc` ×4 (w0.5) | L78·82·85·89 산출물 4종 계약 | 정확 |
| `artifacts-under-docs` (w1) | L15 "모든 산출물은 프로젝트 루트의 `docs/`에 저장" | 정확 |
| `delegates-to-architect` (w1) | 케이스 자신의 위임 구조 | 타당하나 가중치가 문제 → **M-1** |

`prompt.md`의 PRD도 4대 의무를 발동시키도록 설계돼 있다(오프라인 큐잉·자동 동기화·테넌트 격리·5년 보관 → ②고유성, FR-03 "중복 전송·부분 실패" → ③멱등성). **케이스 저작 자체는 이 리뷰에서 가장 잘 된 부분이다.**

다만 채점 기준의 *강도*는 별개 문제다 — 정규식 6개가 실제로 보는 것은 "그 한글 단어가 파일 어딘가에 존재하는가"뿐이다(→ **M-2**, **RT-1**).

---

## 3. 설계문서 사실 주장 표본 검증 (PM 항목 5)

### ✅ 통과 — §5 실측 수치는 원본과 전건 일치

| 문서 주장 | 원본 대조 결과 |
|---|---|
| 1회차 0.08 / $0.52 | `runs/2026-08-31T19-43-39-018Z/aggregate-result.json` → score `0.07692…` / `costUsd 0.5213…` ✅ |
| 2회차 0.46 / $1.97 | 스크래치패드 `pilot2-out/aggregate-result.json` → score `0.4615…` / `costUsd 1.965…` ✅ |
| 3회차 1.00 / $7.78 / 1,988초 | `runs/2026-08-31T20-11-12-220Z/…` → score `1` / `costUsd 7.7796…` / `durationSeconds 1988` ✅ |
| 케이스 13파일 10,276 B | 실측 합계 **정확히 10,276 B** (prompt 5,292 + graders 4,984) ✅ |
| `plugin.json`에 `experimental.evals` 없음 → 컨텍스트 비용 0 | 실물 확인 ✅. `--help`도 "default dir: the manifest's `experimental.evals` value, else `evals/`"로 확인 |
| 서브에이전트 멘션 `@agent-<plugin>:<agent>` | `docs/anthropic/agents/sub-agents.md:792` 원문 일치 ✅ |
| `--publish-report`가 이미 기본값 / `--threshold` 기본 1.0 / `--runs` 기본 `case.runs ?? 3` / `--eval-dir`은 플러그인 아래만 | `claude plugin eval --help` 원문 **전건 일치** ✅ |
| `--help`는 게이트와 무관하게 나온다 | 내가 게이트 없이 `--help` 실행 성공으로 재확인 ✅ |

**이 문서의 수치 정직성은 강점이다.** 리뷰에서 가장 자주 깨지는 지점인데 깨끗하다.

### ⚠️ 미검증 — 출하 기본값 조합의 실행 기록은 0건

남아 있는 aggregate 3건 전부 `runsPerCase: 1` · `suite.threshold: 0.8`(1회차는 `judgeModel: haiku`)이다. 즉 **현재 출하되는 DEFAULTS(runs 2 · threshold 0.9 · max-cost 20 · judge sonnet) 조합으로 완주한 실행이 한 번도 없다.** → **M-6**

---

## 4. 지적 사항

### 🔴 C-1 (Critical) — `pnpm run eval:golden -- <플래그>` 형태의 **문서화된 사용법 전부**에서 사용자 플래그와 `--allow-tools Write`가 조용히 무시된다

**위치**: `scripts/run-golden-eval.mjs:47-49, 64, 66` / 문서화된 사용법 `scripts/run-golden-eval.mjs:12-16`, `docs/architecture/golden-task-benchmark.md:76, 142, 145`

**확인방법**: 3단계 실행 검증

1. 래퍼를 `pnpm run eval:golden -- --dry-run`으로 실행 → 스크립트가 출력한 실제 명령이 **`… --case __dry_run_no_case__ --`** 로 끝났다. `pnpm run`은 `--`를 벗기지 않고 argv에 그대로 넘긴다(`$ node scripts/run-golden-eval.mjs -- --dry-run`). L49의 필터는 `--dry-run`만 걸러내므로 `'--'`가 `passthrough`에 남아 `claude`에 전달된다.
2. 대조 프로브: `claude plugin eval ./malgn-agent --case __nope1__ -- --case __nope2__` → 에러 메시지가 **`__nope1__`**. 즉 `--` 뒤의 옵션은 파싱되지 않는다.
3. 확증 프로브: `claude plugin eval ./malgn-agent -- --case __nope3__` → `--case`가 통째로 무시되고 **실제 유료 실행이 시작됐다**(하네스가 `Ablation: defaulting to with-without … (2× runs)` 출력 후 케이스 로드). 즉시 강제 종료함(§7 정직 보고 참조).

**무엇이 깨지는가**: `passthrough`에 `'--'`가 들어가고(L49) `args.push(...passthrough)`(L64)가 그 뒤에 `--allow-tools Write`를 붙이므로(L66), `--`가 포함된 모든 호출에서

- 사용자가 준 override(`--runs 3`, `--ablation with-without`, `--publish-report`, `--case …`)가 **전부 무시**되고,
- **`--allow-tools Write` 권한 부여까지 유실**된다.

Write가 유실되면 하네스가 `grader "…" cannot pass with the granted tools`를 경고하며(내 프로브 C에서 3건 출력 확인) 산출물 0종 → 점수 ≈0.08이 나온다. **§7-1이 기록한 1회차 참사와 똑같은 증상이 $16을 쓰고 재현된다.**

영향 범위는 문서화된 사용법 전부다: 스크립트 헤더 L13 `--case`, L14 `--ablation with-without`, L15 `--runs 1 --max-cost-usd 10`, L16 `--dry-run`, §3 `-- --publish-report`, §5 릴리스 게이트 `-- --runs 3`, §5 Δ 실행 `-- --ablation with-without`. **인자 없는 `pnpm run eval:golden` 하나만 정상 동작한다.**

**왜 지금까지 안 걸렸나**: 실측 3회는 현재 DEFAULTS와 다른 값으로 돌았고(§3 ⚠️), 래퍼를 통한 override 경로가 한 번도 검증되지 않았다.

**개선안**: `const passthrough = argv.filter(a => a !== '--dry-run' && a !== '--');` (또는 `argv[0] === '--' ? argv.slice(1) : argv`). 고친 뒤 반드시 `--` 포함 호출로 실제 명령줄을 눈으로 확인할 것.

---

### 🟠 M-1 — 벤치마크의 **핵심 신호**가 임계값 경보 아래에 있다: 플러그인이 죽어도 Green이 나온다

**위치**: `graders/delegates-to-architect.md`(weight 1) / `prompt.md:24` / 설계문서 §5 threshold 행

**확인방법**: 가중치 실측 합계(aggregate `graders[].weight` 합 = **14.0**) + threshold 0.9 산수

- weight-1 그레이더 하나만 떨어지면 **13/14 = 0.9286 ≥ 0.9 → 통과**한다.
- `delegates-to-architect`(w1)는 "플러그인이 실제로 발화했는가"를 보는 **유일한** 지표다.
- 그런데 `prompt.md:24`에 폴백이 있다: *"위임할 수 있는 아키텍처 설계 서브에이전트가 이 세션에 없다면 그때는 네가 직접 설계해서 같은 산출물을 만든다."*
- 결과: 에이전트 이름이 바뀌거나 플러그인 로딩이 깨져 **위임이 완전히 죽어도**, 부모 세션이 직접 4종을 써서 나머지 13점을 받고 0.93으로 통과한다. 벤치마크가 측정하려던 대상이 사라졌는데 초록불이 켜진다.

§5의 threshold 근거는 "가중치 2짜리 의무 하나를 잃으면 0.857"만 계산했고, **weight-1 계층 전체(delegates·artifacts·data-model·cites 4종)가 무경보 구간**이라는 사실을 다루지 않는다.

**개선안**: `delegates-to-architect`를 점수에서 분리해 "실패 시 무조건 실패"인 하드 게이트로 두거나, 가중치를 2 이상으로 올린다(그러면 12/14=0.857로 떨어져 경보가 된다).

---

### 🟠 M-2 — 판별력이 한 번도 측정되지 않았다 (ablation 0회)

**위치**: 설계문서 §4 선정근거 1, §5 `--ablation` 행, §9 R7 / `run-golden-eval.mjs:36`

**확인방법**: 남은 aggregate 3건 전부 `suite.ablation: "none"` 실측 + 그레이더 정규식 원문 판독

§4는 "플러그인 유무 대조의 신호가 크다"고 단정하지만, 그것을 확인하는 유일한 수단(`--ablation with-without`)은 기본값에서 꺼져 있고 **한 번도 실행되지 않았다.**

그런데 그레이더 12개 중 6개는 사실상 키워드 존재 검사다. aggregate에 남은 통과 사유 원문:

```
api-completeness-obligation  | matched ^(?=[\s\S]*에러)(?=[\s\S]*권한)(?=[\s\S]*검증)
abnormal-case-obligation     | matched ^(?=[\s\S]*(?:타임아웃|timeout))(?=[\s\S]*멱등)
cites-comparison-table       | matched ^(?=[\s\S]*경쟁사)(?=[\s\S]*(?:비교표|차별점|세이프체크|인스펙션원))
```

PRD 원문이 프롬프트에 통째로 실려 있으므로("세이프체크"·"인스펙션원"·"멱등"은 요구사항에서 유도되는 단어다), 플러그인 없는 sonnet도 상당수를 통과할 개연성이 있다.

**결과: 점수 1.00이 "플러그인이 좋다"는 뜻인지 "케이스가 쉽다"는 뜻인지 구분할 수 없다.** R7은 "천장에 붙어 개선을 못 잡는다"만 인정하고, "회귀를 잡는지조차 미검증"이라는 더 근본적인 공백은 인정하지 않는다.

**개선안**: 채택 전 `--ablation with-without` **1회 실행이 사실상 이 자산의 존재 가치를 결정한다.** Δ가 작으면 그레이더를 조이는 것이 20종 확장보다 먼저다. (C-1을 고친 뒤에 실행할 것 — 안 고치면 `-- --ablation with-without`이 무시된다.)

---

### 🟠 M-3 — §9 R1의 **유일한 추적 장치가 실재하지 않는다** (PM 질문 1의 답)

**위치**: `docs/architecture/golden-task-benchmark.md:232` "…(추적: STATUS.md 백로그)"

**확인방법**: 실물 조회 2곳

- 워크트리에 `STATUS.md` **없음**(`.gitignore` 대상).
- 메인 워킹트리 `/Users/hopegiver/workspace/claude-plugins/STATUS.md`(2,236 B, 오늘 05:35 갱신) 전문에 `골든`·`golden`·`eval`·(게이트 변수명 — 공개 저장소라 여기 적지 않는다)·`벤치마크` **0건**. 📋 백로그 섹션 5개 항목 어디에도 없다.

**판정**: PM 질문 1("충분히 눈에 띄게 표시돼 있는가")에 대해 — **코드/문서 가시성은 충분하다.** `run-golden-eval.mjs:69-71`의 ⚠️ 주석 3줄과 :74의 매 실행 콘솔 경고(내 dry-run 실행에서 실제 출력 확인), §9 R1 표 항목이 모두 제자리에 있다. **그러나 추적은 미구현이다.** CLAUDE.md 부트스트랩 규약상 새 세션이 L0에서 읽는 것은 `STATUS.md` + `CLAUDE.md` 둘뿐이고, 우회 제거 과제는 그 둘 어디에도 없다. **설계문서 §9와 코드 주석은 그 파일을 여는 사람만 본다 — 그리고 그 파일을 여는 이유는 이미 이 벤치마크를 만지고 있을 때뿐이다.**

**개선안**: `STATUS.md` 📋 백로그에 1줄(현재 2,236/3,000 B라 여유 있음). 그리고 "정식 얼리액세스 신청"의 **소유자와 시점**을 함께 적을 것 — 지금은 누가 신청하는지가 어디에도 없다.

---

### 🟠 M-4 — 공개 저장소에 벤더 내부 게이트 우회 플래그가 평문 게시된다 (PM 질문 2 — 미언급 위험)

**위치**: `docs/architecture/golden-task-benchmark.md:30, 232` / `scripts/run-golden-eval.mjs:73, 75`

**확인방법**: `gh repo view malgnsoft/claude-plugins --json visibility,isPrivate` → **`{"isPrivate": false, "visibility": "PUBLIC"}`**

R1은 "정식 승인 전 임시 조치"라는 **사내 사용** 관점만 다룬다. 그러나 이 저장소는 공개다 — 커밋되는 순간 제3자(Anthropic)의 비공개 내부 게이트 변수 이름이 검색 가능한 공개 소스에 게시되고, "이 회사가 자사 게이트를 우회하는 래퍼를 배포한다"는 기록이 남는다. 이건 로컬에서 값을 쓰는 것과 **성질이 다른 별개 리스크**이며, 설계문서 어디에도 없다.

PM 지시상 "우회 자체를 없애라"는 채택되지 않는 지적이므로 그건 제기하지 않는다. 제기하는 것은 **공개 게시가 사용자 승인 범위에 포함됐는지 확인되지 않았다**는 점이다.

**개선안**: 플래그 이름을 커밋 파일에서 빼고(래퍼는 `process.env`에 이미 있을 때만 쓰도록 하고, 값 자체는 미커밋 로컬 파일이나 사내 채널로 공유), 문서는 "비공개 내부 게이트 변수"로 서술. 최소한 이 결정을 사용자에게 **별건으로** 다시 확인할 것.

> **[해소됨]** 사용자에게 별건 보고 후 **"해당 코드만 깃에서 제거"** 결정. 우회 코드와 변수 이름을
> `scripts/run-golden-eval.mjs`·설계문서에서 전부 제거했고, 이 보고서 §1의 검색어 나열에 있던
> 리터럴도 함께 뺐다. 이제 승인 전에는 `claude`가 자기 안내 메시지와 함께 실패한다(우회 없음).
> 커밋 이력 전수 검색(`git log --all -S`) 결과 이 문자열이 이력에 들어간 적은 **0건**이다.

---

### 🟠 M-5 — `pnpm run eval:golden`이 가드 없이 등록돼, 클론한 임의의 직원이 자기 계정으로 오발동시킬 수 있다 (PM 질문 2 — 미언급 위험)

**위치**: `package.json:12` / `docs/README.md:14`(신규 광고) / `docs/architecture/golden-task-benchmark.md:179`

**확인방법**: 설계문서 §6:179가 스스로 *"이 저장소는 `/plugin marketplace add`의 **클론 대상**이라 `docs/`도 통째로 내려간다"*고 적는다. `scripts/`·`package.json`도 같이 내려간다.

무심코 `pnpm run eval:golden`을 친 직원에게 벌어지는 일:

1. 기본값 기준 **약 $16 · 1시간**이 **그 직원 계정에** 청구된다(경고는 실행이 이미 시작된 뒤에 출력된다).
2. 조직이 의도적으로 닫아둔 얼리액세스 게이트가 **그 직원 이름으로** 우회된다.
3. R2대로 자식 세션 도구 목록에 **그 직원의 claude.ai 커넥터(Gmail·Drive·Calendar)**가 등록된다.

R2는 *"외부에서 받은 케이스는 이 래퍼로 돌리지 않는다"* — 즉 **우리가 남의 케이스를 돌리는 것**만 다룬다. **남이 우리 케이스를 돌리는 것**은 어디에도 없다. 현재 가드는 0이다(확인 프롬프트·옵트인 플래그·유지보수자 확인 전부 없음).

**개선안**: 실행 전 명시 옵트인(`GOLDEN_EVAL_I_ACCEPT_COST=1` 또는 대화형 확인) + 첫 줄에 예상 비용·시간 출력 후 짧은 대기. 또는 `package.json` 등록을 빼고 `node scripts/run-golden-eval.mjs`로만 부르게 한다(발견성 자체를 낮춤).

---

### 🟠 M-6 — 출하 기본값 조합은 미검증 외삽이고, `--max-cost-usd 20`은 가짜 회귀 경보를 만든다

**위치**: 설계문서 §5 기본값 표 / `run-golden-eval.mjs:32-39`

**확인방법**: aggregate 3건의 `suite` 실측 + `claude plugin eval --help` 원문 대조

1. **미실행**: 남은 기록 전부 `runsPerCase 1` · `threshold 0.8`. 현재 DEFAULTS 조합 실행 기록 **0건**.
2. **threshold 산수의 전제가 미확인**: §5는 *"runs 2 평균이 (1.00+0.857)/2=0.93으로 오경보를 막는다"*고 하는데, 이는 **하네스가 run 평균을 threshold와 비교한다**는 가정이다. `--help`는 `Exit 1 if any case score is below this threshold`라고만 하고 case score가 평균인지 최소인지 명시하지 않는다. runs 1 기록뿐이라 실측으로 확정할 수 없다. (산수 자체는 검산 통과: 12/14 = 0.857, (1+0.857)/2 = 0.9285.)
3. **비용 상한이 가짜 경보를 만든다**: `--help` 원문 —
   > *"Overrun is bounded to one agent run — when that run breaches, **paid graders (llm/baseline) are skipped** while free graders still score it."*

   즉 $20을 스치면 유일한 llm 그레이더 `uniqueness-obligation`(w2)이 빠져 **12/14 = 0.857 < 0.9** → threshold 실패로도 나타난다. 예상 $15.6 대비 여유가 1.28배뿐인데(1회차 $0.52 ↔ 3회차 $7.78로 회차 간 편차가 15배였다), **비용 초과가 곧 "회귀 발생"으로 보이는** 연쇄를 §5는 적지 않았다("부분 결과를 남기고 exit 2"까지만).
4. `--help`는 덧붙여 *"Runs are already bounded by max_turns and timeout_seconds — only set this when you need a strict budget"*라며 이 플래그의 기본 설정을 권하지 않는다.

**개선안**: 채택 전 기본값 그대로 1회 완주(M-2의 ablation 실행과 합칠 수 있다) → threshold 집계 방식을 실측으로 확정 → max-cost 상향하거나, 상한 히트 시 history 행을 `partial`로 확실히 표시하고 **threshold 판정과 분리**한다.

---

### 🟠 M-7 — `history.jsonl`이 append-only 원장이 아니다 (실행 1건의 행이 없다)

**위치**: `docs/evaluation/golden-task/history.jsonl` / 설계문서 §6:159, :175-176

**확인방법**: `runs/` 실물과 원장 대조

- `runs/`에 래퍼 타임스탬프 형식(`new Date().toISOString().replace(/[:.]/g,'-')`)과 **정확히 일치하는** 디렉터리 2개: `2026-08-31T19-43-39-018Z`, `2026-08-31T20-11-12-220Z`.
- `history.jsonl`은 **1줄**(20-11만).
- 19-43은 래퍼의 `--output-dir` 규칙이 만든 경로에 있는데 대응 행이 없다.

§6:175는 *"1·2회차는 caseSha를 붙일 수 없고, 붙이면 거짓이 된다"*로 부재를 정당화한다. 그러나 래퍼의 `caseSha()`(L91-109)는 **실행 시점의 케이스 디렉터리**를 해싱하므로 그때 append됐다면 당시 sha가 정확히 기록된다. 게다가 §6:170-173이 이미 *"caseSha가 다른 회차끼리는 점수를 비교하지 않는다"*는 규율을 갖고 있어, 남겨두는 편이 설계 의도에 부합한다.

원장이 사후 수기 편집됐거나 그 시점 래퍼에 적재 블록이 없었다 — 어느 쪽이든 **"실행 1회 = 1줄"이라는 §6의 불변량이 첫 두 회차부터 깨져 있고**, 무결성을 담보하는 장치가 없다.

**개선안**: §6에 "행은 삭제하지 않는다"를 명문화하거나, 실제로 지운 이유를 문서가 설명하게 한다. 최소한 현재 상태(디렉터리 2 : 행 1)와 §6 서술이 일치해야 한다.

---

### 🟠 M-8 — 판정 모델 교체(haiku→sonnet)의 근거가 단일표본·교락 비교다

**위치**: 설계문서 §7-2, §5 `--judge-model` 행

**확인방법**: 3회차 aggregate의 `uniqueness-obligation` 판정 사유 원문

```
judge votes: PASS PASS PASS — note: long file (40072 chars);
llm judges are noisy on long inputs, prefer a regex grader for large artifacts
```

- 두 관측은 **판정 모델과 대상 문서가 동시에 다르다**(2회차 21,465자 vs 3회차 40,072자). "haiku가 문제였고 sonnet이 해결했다"는 인과 주장을 지지하지 못한다.
- 통과 문서가 오히려 **1.9배 더 길다**. 하네스는 그 통과 판정에도 여전히 long-input 노이즈 경고를 붙였다.
- 같은 라운드에 `cites-comparison-table` 정규식 그레이더가 추가돼(11 → 12 그레이더, w13 → w14) 교란 변수가 하나 더 늘었다.

**개선안**: "sonnet이 해결했다"를 "정규식 분리 + judge 상향을 함께 넣었고 그 뒤 1회 통과했다(단일표본, 문서 길이는 오히려 증가)"로 서술 강도를 낮추고, §9에 "llm 그레이더 안정성 미검증"을 R 항목으로 추가한다.

---

### 🟡 Minor

| # | 지적 | 위치 / 확인방법 | 개선안 |
|---|---|---|---|
| **m-1** | **실행 근거(trace)가 보존되지 않는다.** §0·§7의 핵심 관측(비동기 위임, 미선언 Bash 실행, 커넥터 등록)은 전부 trace에서 읽은 것인데 원본이 소멸했다 | aggregate의 `tracePath` = `/private/var/folders/…/claude-eval-m0XGYY/out/trace.jsonl`, `ls` 실패(부재). §6:181은 "다시 실행하면 된다"고 하나 재실행 $16·비결정적이라 같은 trace가 안 나온다 | 최소한 R2 같은 **보안 관측**은 발췌를 설계문서에 인용하거나 `--verbose --debug-file`로 보존 |
| **m-2** | `prompt.md`의 `expected_outcome` frontmatter를 하네스가 쓰지 않는 것으로 보인다 | 파싱된 case 객체 키 = `name, dir, source, promptMarkdown, runsPerCase, timeoutSeconds, maxTurns, graders, arms, aggregates` — expect* 없음. `--help`에도 없음(`tags`는 `--tag`로 실재 확인) | 사람이 읽는 주석임을 명시해 "하네스가 채점에 쓴다"는 오해 방지 |
| **m-3** | **변경 동결 원칙과의 관계가 문서에 없다.** 이 라운드는 배포 트리에 13파일 10,276 B를 얹는 **신설**이라 CLAUDE.md [변경 동결 원칙]의 "보류 대상(신설·구조 변경)"에 정면 해당 | `CLAUDE.md` 변경 동결 절 ↔ 설계문서 §9 전문(면제 근거 0건) | Exploration 등급 + 사용자 승인으로 진행 중인 것으로 보이나, §9에 "변경 동결 예외 — 승인 근거" 행을 남겨 다음 세션이 재론하지 않게 할 것 |
| **m-4** | CLAUDE.md Architecture의 `scripts/` 서술에 신규 `run-golden-eval.mjs`·`docs/evaluation/golden-task/` 미반영 | `check-docs`는 agents/skills/knowledge 개수만 보므로 못 잡는다. **단** `check-links`·`check-status`·`check-mcp-tools`도 이미 누락돼 있어 이번 라운드만의 결함은 아님(기존 드리프트에 1건 추가) | `scripts/` 나열을 한 번에 정리 |
| **m-5** | history 기준선 행의 `pluginVersion`이 `1.8.20`인데 이 브랜치가 main(v1.8.23)보다 뒤처져 있다 | `git merge-base HEAD main` = `33a2b70`, main = `df6a07b`. 병합 후 이 행은 실제 릴리스 버전과 어긋난 채 추세의 원점이 된다 — §6:184 "pluginVersion이 다른 줄끼리 비교할 때 먼저 의심한다" 규율과 충돌하는 **첫 데이터포인트** | 리베이스 후 기본값으로 1회 재실행해 기준선을 다시 잡을 것(M-2·M-6 실행과 합칠 수 있음) |

### ⚪ Nit

- **n-1** `.gitignore` 파일 끝 개행 없음(`\ No newline at end of file`) — 다음 편집자가 마지막 줄에 이어붙이면 `malgn-agent/evals/results/` 패턴이 깨진다.
- **n-2** 래퍼가 `aggregate-result.json`을 직접 파싱하는데, 하네스는 `--json [path]`라는 공식 출력 경로를 제공한다(`--help`). 파일 레이아웃 변경에 덜 취약한 쪽은 후자.
- **n-3** `--dry-run --tag golden` 조합에서 `--case` 센티넬과 `--tag`가 AND인지 OR인지 미확인 — OR이면 유료 실행이 시작된다. C-1 수정 시 함께 정리할 것.

---

## 5. 🔵 Rethink (발산형 페르소나)

### RT-1 — 회당 $16·1시간짜리 LLM 벤치마크가 이 문제에 비례하는가

| | 내용 |
|---|---|
| **현재 구조** | PRD 인라인 대형 케이스 1건 → 서브에이전트 33분 실행 → 문서 4종 생성 → 그 문서에 한글 키워드가 있는지 정규식으로 확인 |
| **관찰** | 그레이더 12개 중 6개가 실제로 판정하는 것은 "'에러/권한/검증/인덱스/UNIQUE/대안/포기/감당/타임아웃/멱등/경쟁사' 같은 단어가 파일 어딘가에 있는가"다. 이 판정을 얻는 데 $7.78과 33분의 에이전트 실행이 든다 |
| **대안 A — 의무별 소형 케이스로 분할** | "이 PRD의 인증 부분만 api-spec 한 조각으로 설계해라" 식 5~8분·$1~2짜리 케이스 4개. 4대 의무를 **각각 독립 측정**하고, 깨지면 어느 의무인지 바로 나온다(현재는 14점 중 2점 손실로 뭉개짐). **§9 R8이 이미 "케이스를 쪼개는 쪽을 먼저 검토"라고 적어놨는데, §8 로드맵은 반대로 이 대형 케이스 위에 20종을 더 쌓는다 — 순서가 뒤집혀 있다** |
| **대안 B — 에이전트를 안 돌리는 층을 먼저** | 이 저장소가 실제로 겪은 회귀는 INDEX 이력·CHANGELOG 기준 "MD 안 참조가 죽었다", "규칙이 두 곳으로 갈라졌다", "hub에 없는 도구명을 절차가 부른다" 류다 — 전부 `check-assets`·`check-links`가 $0으로 잡는다. **"architect가 4대 의무를 갑자기 잊는" 회귀는 이 저장소 이력에 전례가 없다.** 즉 $16 벤치마크가 겨냥한 유형은 아직 한 번도 발생하지 않았고, 반복 발생한 유형은 이미 무료로 잡히고 있다 |
| **왜 그래도 남길 만한가** | (B)는 "MD가 문법적으로 온전한가"만 보고 "MD가 **행동**을 바꾸는가"는 못 본다. 그 질문에 답할 수 있는 유일한 장치가 ablation Δ다. **그런데 그 Δ가 이번에 한 번도 측정되지 않았다(M-2).** 그러니 이 자산의 존재 가치를 정하는 실험은 아직 안 한 셈이고, 채택 판단은 그 1회 실행 뒤로 미루는 것이 맞다 |
| **비용·리스크** | (A) 케이스 재저작 반나절 + `caseSha` 리셋(추세 원점 재설정 — **지금은 데이터가 1행뿐이라 손실 0. 바꿀 거면 지금이 최적기다**). (B) 추가 비용 0(이미 있음) |

### RT-2 — `evals/`를 배포 트리 안에 두는 것이 유일한 선택지인가 (→ **자체 기각**, §1 판정 근거만 정정 권고)

| | 내용 |
|---|---|
| **현재 구조** | §1이 A/B/C 3안 중 A(배포 트리 안 `malgn-agent/evals/`) 채택, B(저장소 루트 `evals/`)는 "하네스가 플러그인 루트 아래만 받는다"로 **불가능** 처리 |
| **미검토 4안** | 케이스를 배포 플러그인이 아니라 **별도의 로컬 전용 얇은 플러그인**에 둔다. `--help`상 target은 "a path, a plugin name, or a `plugin@marketplace` id"이고 skills-dir 플러그인도 resolve된다 |
| **왜 성립하지 않는가** | 그 경우 malgn-agent가 `with` 암에 로드되려면 target이 malgn-agent여야 하는데, `--eval-dir`이 "Directory name (**below the plugin**)"이라 **케이스 위치와 대상 플러그인을 분리할 수 없다.** → 대안 기각, **A안 유지가 옳다** |
| **남는 권고** | §1의 판정 근거를 "B가 불가능"에서 "케이스 위치와 대상 플러그인을 분리할 수 없다"로 정확히 다시 쓸 것. 10,276 B는 실제로 감당 가능하고, §1의 "컨텍스트 비용 0" 논증은 `plugin.json`에 `experimental.evals`가 없음을 실물로 확인해 **성립한다** |

---

## 6. 기각된 지적

| 지적 후보 | 판정 | 사유 |
|---|---|---|
| `writes-*.md`의 `**/api-spec.md` 글롭이 너무 넓어 오탐 | **기각** | `artifacts-under-docs`(w1)가 `docs/` 하위 여부를 별도로 본다고 §4-1이 명시했고, 실제 aggregate에서 두 그레이더가 독립 채점됨. 의도된 분할 |
| eval 실행이 저장소 워킹트리를 오염시킨다(`docs/prd.md` 등) | **기각** | `ls` 실측 결과 `docs/{prd,requirements,architecture,tech-stack,api-spec,data-model}.md` 6개 전부 부재. 하네스가 temp 워크스페이스에서 돈다 |
| `.gitignore`가 `runs/`·`evals/results/`를 못 막는다 | **기각** | `git check-ignore -v`로 `.gitignore:11`·`:13` 매칭 확인, `git add -A --dry-run`에도 미포함 |
| §5의 비용·점수 수치가 부풀려졌다 | **기각** | 3회차 전부 원본 aggregate와 대조 — 전건 일치(§3). 오히려 이 문서의 강점 |
| **강등 1건**: "`--allow-tools`는 보안 경계가 아니다(미선언 Bash 실행)"를 Major 후보로 검토 | **Major → m-1로 강등·존치** | `--help`는 Bash를 gated tool로 명시하나, 이 관측의 근거 trace가 이미 소멸해 **재현 불가**. §0·R2가 이미 리스크를 명시하고 "우리 케이스만 돌린다"는 운영 규율로 대응 중이므로, 미확인 관측을 근거로 새 지적을 세우지 않고 근거 보존 문제(m-1)로만 남긴다 |

---

## 7. 정직 보고 — 이 리뷰가 한 일과 하지 않은 일

- **실행 액션 없음**: 커밋·병합·push·배포를 하지 않았다. 대상 산출물 파일은 하나도 수정하지 않았다.
- **내가 수정한 파일**: `docs/reviewer/personas/` 아래 페르소나 5개("적용 이력" append)와 `INDEX.md`(5행 "최근 재사용" 갱신 + 라운드 주석), 그리고 이 보고서. 전부 reviewer 소관 문서다.
- **⚠️ 내가 유발한 비용**: `--` 뒤 옵션 파싱을 검증하려고 실행한 3번째 프로브(`claude plugin eval ./malgn-agent -- --case __nope3__`)가 **의도치 않게 실제 유료 실행을 시작했다.** 약 3분 뒤 `pkill`로 종료했다(exit 144). 이것이 C-1의 확증 근거이자, 동시에 C-1이 얼마나 쉽게 발동하는지의 실증이다. 이 과정에서 배포 트리에 `malgn-agent/evals/results/`가 생성됐고 **내가 직접 삭제했다**(`.gitignore` 대상이라 커밋 위험은 없었음 — `git check-ignore`로 확인). 부분 청구가 발생했을 수 있다.
- **PM 승인 범위 내 우회 사용**: 위 프로브 3건과 `--dry-run` 1건에서 얼리액세스 게이트 우회 변수를 사용했다(PM이 이미 승인한 기제). 우회 자체를 확대하거나 다른 용도로 쓰지 않았다.
- **하지 않은 검증(생략 + 사유)**:
  - **ablation Δ 미측정** — M-2의 핵심 질문에 답하려면 회당 약 $16~31이 든다. PM 지시(§5 "전부 재실행할 필요 없다")에 따라 논리·근거 대조로만 판단했다. **이 실행은 PM이 채택 전에 반드시 해야 한다.**
  - **기본값(runs 2 / threshold 0.9) 완주 미실행** — 같은 비용 사유. M-6은 "실행 기록이 없다"는 사실 확인까지만이다.
  - **threshold가 run 평균인지 최소인지 미확정** — runs 1 기록뿐이고 `--help`가 명시하지 않아 실측 불가. M-6에 미확인으로 명시했다.
  - **UI/화면 리뷰 없음** — 대상에 화면이 없다(스크립트·문서·평가 케이스). `docs/screenshots/` 산출물 없음이 정상이다.
- **점수·라벨 없음**: 이 리뷰는 완성도 점수를 매기지 않았다. 심각도 분류만 사용했다.

---

## 8. 잘 된 점 (다음 산출물의 기준)

1. **§5 실측 수치가 원본과 전건 일치한다.** 3회 실행의 비용·점수·시간·파일 바이트수까지 aggregate와 정확히 맞는다. 리뷰에서 가장 자주 깨지는 지점인데 깨끗하다.
2. **§0이 "`--help`가 나온다 ≠ 실행 가능"을 스스로 분리해 적었다.** 사양 확인 방법론이 정확하고, 내가 재확인해도 그대로였다.
3. **`caseSha` 도입** — "채점표를 느슨하게 고쳐 점수를 올리는" 자기기만 경로를 구조적으로 차단한다. 벤치마크 자산에서 가장 자주 빠지는 장치인데 처음부터 들어갔다.
4. **`--no-publish` 강제** — 하네스 기본이 claude.ai 발행임을 `--help` 원문으로 확인했다. 프로프라이어터리 라이선스 자산의 외부 발행을 래퍼가 기본값 수준에서 뒤집었다.
5. **`--ablation none` 고정** — 하네스 기본이 `with-without`(2× 비용)임을 내 프로브가 실증했다. 이걸 안 잠갔으면 회당 비용이 2배였다.
6. **`failedGraders` 추출 로직이 실제 데이터로 동작한다** — 실패 aggregate에 그대로 돌려보니 10건을 정확히 뽑았고 성공 건에서는 빈 배열. 필드명(`scored`/`passed`/`name`)이 추측이 아니라 맞았다. `runsPerCase`도 "케이스 선언값이 아니라 실제로 돈 횟수"를 고르는 폴백 순서가 실데이터에서 옳게 동작했다(case.runsPerCase 2 ↔ arms.with.length 1에서 1을 선택).
7. **§7이 자기 실패를 지우지 않고 남겼다** — 케이스 저작 함정 2건은 다음 케이스 저자에게 그대로 쓰인다.
8. **편집 권한 경계를 지켰다** — `agents/`·`skills/`·`knowledge/`·`hooks/` 아래 변경 0건. `malgn-agent/evals/`는 그 4개 목록에 없으므로 경계 위반이 아니다.

---

## 9. PM 권고

**병합 전 필수 (Critical/Major 차단)**

1. **C-1을 먼저 고친다.** `passthrough`에서 `'--'`를 제거. 이걸 안 고치면 아래 2·3의 실행 자체가 무의미하다(`-- --ablation …`이 무시된다).
2. **M-2 + M-6을 한 번의 실행으로 닫는다** — C-1 수정 후 `--ablation with-without` 1회. 이 실행이 (a) 판별력 Δ, (b) 기본값 조합 완주, (c) threshold 집계 방식, (d) 실제 회당 비용을 동시에 확정한다. **Δ가 작으면 §8 확장 로드맵보다 그레이더 강화가 먼저다.**
3. **M-1**: `delegates-to-architect`를 하드 게이트로 분리하거나 가중치를 2 이상으로. 지금은 플러그인이 죽어도 Green이 나온다.
4. **M-4**: 공개 저장소 게시가 사용자 승인 범위인지 **별건으로 재확인**. 승인 밖이면 플래그 이름을 커밋 파일에서 뺀다.
5. **M-5**: `pnpm run eval:golden`에 명시 옵트인 가드 추가.
6. **M-3**: `STATUS.md` 백로그에 우회 제거 1줄 + 정식 신청 소유자 명시.

**병합 시 함께**

7. M-7(원장 규율 명문화) · M-8(judge 교체 근거 강도 하향) · m-3(변경 동결 예외 근거 §9 등재) · m-5(리베이스 후 기준선 재취득) · n-1(`.gitignore` 개행).

**판단이 필요한 것**

8. **RT-1**: 데이터가 1행뿐인 지금이 케이스 분할(§9 R8)로 방향을 트는 유일한 무비용 시점이다. 2번 실행 결과를 보고 결정할 것.
9. **m-3**: 이 라운드 자체가 CLAUDE.md 변경 동결의 "신설" 항목에 해당한다. Exploration 등급 + 사용자 승인으로 진행 중인 것으로 보이지만, 그 근거가 문서에 없어 다음 세션이 재론할 수 있다.

**참고**: 이 산출물은 아직 커밋조차 되지 않은 워킹트리 상태다. 리뷰는 워킹트리 실물을 대상으로 했다.
