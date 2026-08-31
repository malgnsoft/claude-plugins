---
name: domain-training-scorecard-eval
description: 에이전트 산출물 평가 + 피드백 통합 — Scorecard 채점(기본수행/Eval Set/실전성공률/비용효율)과 약점별 MD 개선안 제시를 한 턴에 처리한다. evaluator가 실행하고 trainer가 MD 반영을 이어받는다. "에이전트 평가해줘", "산출물 진단", "이 에이전트 점수 낮네" 요청 시 사용.
---

# Training Scorecard Evaluation Skill

산출물 기반 에이전트 진단. **평가와 피드백을 한 턴에 통합** — Scorecard 채점 후 약점별 MD 개선안을 즉시 제시하고, 실제 MD 반영은 evaluator→trainer 인계 절차(각 에이전트 MD 참조)로 이어집니다.

> 소관: 이 스킬은 `evaluator`가 실행한다(역할 경계 상세는 `agents/trainer.md`/`agents/evaluator.md` 참조, 여기서 중복 서술하지 않는다). trainer는 evaluator가 작성한 개선안을 실제 MD/knowledge 파일에 반영하는 마지막 단계만 수행한다.

## 핵심: 평가 + 피드백 통합 (한 턴에 처리)

**Before (분리)**: 평가 → 분석 → (1주 후) → 피드백 → 개선 (피드백 지연)
**After (통합)**: 평가 + 분석 + 즉시 개선안 제시 → trainer가 MD에 반영 (같은 사이클에 처리)

→ **피드백 루프 단축 + 에이전트가 빨리 배움**

---

## 실행 흐름 (4~5시간)

### Phase 1: 산출물 수집 + Scorecard 채점 (2~3시간)

**1) 산출물 수집** (30분):
- 대상 에이전트의 최근 산출물 3~5개 (최근 2주~1개월)
  - **reviewer**: `docs/reviewer/review-*.md`
  - **architect**: `docs/*-design.md`, `agent-design/*.md`
  - **ux-designer**: `docs/ux-*.md`, `docs/design/`
  - **backend-dev**: 코드 구현 + PR 리뷰
  - **qa-engineer**: 테스트 보고서

**2) Scorecard 채점** (2시간) — 아래 4개 구성요소를 각각 0~100점으로 채점한다(외부 문서 참조 없이 이 절만으로 채점 가능해야 한다):

**a) 기본수행 60%** — 7항목 가중합(합계 100점):

| 항목 | 배점 | 판정 질문 |
|---|---|---|
| 요구사항 이해 | 15 | 위임 의도·범위를 정확히 파악했는가 |
| 변경범위 관리 | 15 | 요청 범위를 벗어나거나 과소 대응하지 않았는가 |
| 정확도 | 25 | 사실·수치·인용 근거가 실물과 대조 가능한가 |
| 검증 품질 | 20 | 등급(Skill `common-task-grading-and-verification-depth`의 5등급)에 맞는 자기검증·실사용 테스트를 수행했는가 |
| 리스크 인지 | 10 | 비가역·대외영향·권한경계를 스스로 식별해 에스컬레이션했는가 |
| 보고 명료성 | 10 | claimed/verified를 구분하고 미검증 항목을 정직하게 보고했는가 |
| 산출 효율 | 5 | 등급 대비 과잉설계·과잉검증 없이 규모가 적정한가 |

> "산출 효율"(이 항목)과 아래 "비용 효율 5%"(전체 4번째 구성요소)는 서로 다른 지표다 — 전자는 **산출물 자체**의 적정 규모, 후자는 **토큰/시간 소비 패턴**이다. 채점 시 혼동하지 않는다.

**b) Eval Set 25%** — 특정 능력 검증(Pass/Partial/Fail):
- 구성: 대상 에이전트의 핵심 역량 3~5개를 선정하고, 역량마다 최근 산출물 또는 즉석 시나리오 1건을 판정한다.
- 판정 기준: **Pass**(요구·형식·검증 기준 모두 충족)=100, **Partial**(형식은 맞으나 일부 기준 미충족)=50, **Fail**(트리거 실패 또는 결과물이 요구와 무관)=0.
- 환산: 항목별 점수의 평균 = Eval Set 점수.

**c) 실전 성공률 10%**:
- 지난 1개월 위임 건 중 재작업(전체 반려 후 재위임) 없이 1차 승인된 비율.
- `성공률(%) = 1차승인건수 / 전체위임건수 × 100`

**d) 비용 효율 5%** — 토큰 낭비 패턴, 100점에서 감점:
- 불필요한 전체 코드베이스/문서 통독 1회당 -10
- 이미 확인된 사실의 반복 재확인·재질문 1회당 -5
- evaluator 반려로 인한 산출물 전체 재작성 1회당 -15
- 최저 0점(하한)

**3) 총점 계산 — 반드시 스크립트로 (암산 금지)**:

집계·가중합·threshold 비교는 전부 결정론적 산식이다. 위 a)~d)에서 낸 정성 점수(0~100 하위점수, Pass/Partial/Fail 판정, 감점 사유 건수)만 LLM이 판단하고, 그 값을 `bin/calc-training-scorecard.mjs`(의존성 없는 Node 내장 스크립트, `bin/analyze-usage.mjs`와 동일 패턴)에 JSON으로 넘겨 최종 점수·성공률·전월 대비 판정을 계산한다 — **암산으로 가중합을 다시 계산하지 않는다.**

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs" --input scorecard.json
# 또는
echo '{ ...JSON... }' | node "${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs"
```

> 이 커맨드가 실패하거나(특히 `MODULE_NOT_FOUND`) 새 실행 지시를 쓸 때의 규약 — 따옴표, 이 변수가 치환되는 자리와 안 되는 자리, 맨 명령어를 쓰지 않는 이유 — 은 Skill `common-output-storage-and-path-management` §1-1이 정본이다.

입력 JSON에 채워 넣는 값 (`previousScore`를 뺀 나머지는 전부 이 단계에서 LLM이 채점/관찰한 정성 판단 결과):
```json
{
  "agent": "architect",
  "period": "2026-08",
  "basicPerformance": {
    "requirementUnderstanding": 12,
    "scopeManagement": 10,
    "accuracy": 20,
    "verificationQuality": 15,
    "riskAwareness": 8,
    "reportClarity": 9,
    "outputEfficiency": 4
  },
  "evalSet": ["pass", "pass", "partial", "fail", "pass"],
  "successRate": { "approvedFirstTry": 8, "totalDelegated": 10 },
  "costEfficiency": { "fullRereadCount": 1, "repeatedConfirmCount": 2, "fullRewriteCount": 0 },
  "previousScore": 75
}
```

`previousScore`만은 이 단계에서 판단하거나 추정하지 않는다 — malgnai-hub `agent_get_context`(`agentName`, `scoreHistoryLimit`)로 그 에이전트의 점수 이력을 조회해 **이 에이전트(`agentName`)의 회사 전체 최신 기록인 `latestScore.overallScore`**를 그대로 넣는다(응답 최상위는 `{agentName, latestScore, scoreHistory, recentLearnings}`이라 `overallScore`는 `latestScore` 객체 안에 있다). 다른 평가자가 남긴 회차일 수 있으며, 그것이 정상이다 — 이 지표는 개인별이 아니라 `agentName` 단위 공용이다. 조회 결과에 점수 이력이 없으면(첫 채점 등) 이 필드를 생략한다 — 스크립트가 `N/A(전월 점수 없음)`으로 처리한다.

스크립트가 결정론적으로 계산해 출력하는 것:
- 기본수행 7항목 합산(배점 상한 검증 포함) → 기본수행 점수
- Eval Set Pass=100/Partial=50/Fail=0 환산 후 평균 → Eval Set 점수
- 실전 성공률 = 1차승인건수 / 전체위임건수 × 100
- 비용 효율 = 100 - (통독×10 + 반복재확인×5 + 전체재작성×15), 하한 0
- 최종 점수 = 기본수행×0.6 + EvalSet×0.25 + 성공률×0.1 + 비용×0.05
- 전월 대비 diff와 상승(+threshold 이상)/정체(±threshold 이내)/하락(-threshold 이하) 판정(기본 threshold=5점, `--threshold N`으로 조정 가능)

여러 에이전트를 한 번에 계산하려면 입력을 배열(또는 `{"agents":[...]}`)로 감싸면 스크립트가 각 에이전트 리포트 + 요약표(에이전트|지난회|이번회|변화|상태)까지 함께 출력한다. 상세 입력 스키마·옵션은 `node "${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs" --help` 또는 스크립트 상단 주석 참고.

배점표(a~d)와 산식 자체의 정본은 이 SKILL.md이고, 스크립트는 그 산식을 그대로 코드로 고정한 것일 뿐이다 — 산식을 바꾸려면 SKILL.md와 스크립트 상수(`WEIGHTS`/`BASIC_ITEMS`/`EVAL_SCORE_MAP`/`COST_PENALTY`/`DEFAULT_THRESHOLD`)를 함께 갱신한다.

### Phase 2: 약점 분석 + 즉시 피드백 (2시간, 같은 턴에)

**1) 지난달 대비 변화 추적**:
- Phase 1에서 `calc-training-scorecard.mjs` 실행 결과에 이미 diff·상태(상승/정체/하락)가 포함돼 있다 — 여기서 다시 계산하지 않고 그 출력을 그대로 사용한다.
- **상승** (+5점 이상): 좋은 사례 정리
- **정체** (±5점 이내): 현상유지
- **하락** (-5점 이상): 근본 원인 분석

**2) 항목별 약점 진단**:
- 어디서 떨어졌는가? (예: "검증 품질이 18점 떨어짐")
- 왜인가? (예: "테스트 케이스 복잡도 증가, 커버리지 목표 재설정 필요")

**3) 즉시 개선안 제시** (trainer가 MD에 반영할):
```
약점: 검증 품질 ↓ (78점 → 60점, -18점)

근본 원인:
- 복합 시나리오 테스트 케이스 수 부족 (목표 80% vs 실제 65%)
- 엣지 케이스 식별 체계 불명확

개선안:
1. qa-engineer.md "테스트 설계" 섹션에 "복합 시나리오 체크리스트" 추가
   - 시나리오 조합 행렬 (Pairwise Testing)
   - 엣지 케이스 판별 질문지
2. 테스트 커버리지 목표 명확화 (단위/통합/E2E별 구체 %)
3. 다음 평가 기준점: 70점 → 재평가 3주 후

다음 Scorecard에서 확인할 메트릭:
- 테스트 커버리지 (실제 수치)
- 첫 시도 성공률 (버그 비율)
```

---

## 산출물

Scorecard 결과는 **파일로 저장하지 않는다** — 이 스킬만을 위한 별도 report 파일 버킷을 신설하지 않고, 아래 세 채널로만 기록한다:

1. **malgnai-hub `decision_record`**(evaluator가 기록) — 필드별 상세는 아래 "판정 회차 기록 — 도구 파라미터 상세" 절이 정본이다.
2. **malgnai-hub `agent_score_record`**(evaluator가 기록, 채점을 한 회차에만): 대상 에이전트 1명당 1건을 남긴다. `decision_record`의 산문 요약만으로는 다음 회차가 "지난회 점수"를 구조화된 형태로 조회할 수 없어 점수 요약표(지난회↔이번회·변화)를 채우지 못한다. 필드별 상세는 같은 절 참조.
3. **개선안 실행**: 실제 MD/knowledge 파일 반영은 이 스킬의 범위가 아니다 — evaluator→trainer 인계 절차를 그대로 따른다(등급별 git 반영·merge 조건은 `agents/evaluator.md`에 이미 정의돼 있으므로 여기서 중복 서술하지 않는다).

## 판정 회차 기록 — 도구 파라미터 상세

**언제 여는가**: 게이트 판정을 냈거나 Scorecard 채점을 한 회차마다, evaluator가 hub에 기록을 남기기 직전. "기록을 남긴다"는 의무 자체와 그 예외 없음은 `agents/evaluator.md`가 정본이고, **여기는 각 필드에 무엇을 어떤 형식으로 넣는지**를 다룬다.

### `decision_record` (회차마다 1건 필수)

- `projectId`(필수): 대상 프로젝트 STATUS.md 상단의 `project_id` 값을 그대로 쓴다 — 추측하거나 새로 만들지 않는다. 값이 비어 있으면 같은 파일의 `repository_key`를 입력으로 `project_bootstrap`(파라미터명은 `repositoryKey`)을 호출해 재발급받아 쓴다. **STATUS.md 필드는 snake_case, 도구 파라미터는 camelCase**라 그대로 옮겨 쓰면 스키마 검증에서 거부된다.
- `title`(필수): `[판정] <대상> — PASS/FAIL`
- `decision`(필수): 판정 결과 + 대상 브랜치·파일 경로
- `reason`(필수): 체크리스트 항목별 판정 근거(FAIL이면 파일:라인). 채점을 했으면 점수 요약표(에이전트별 지난회↔이번회 점수·변화·상태)와 주요 약점 진단도 함께.
- `idempotencyKey`(필수): `eval-<대상 슬러그>-r<회차번호>`. 재판정은 회차번호를 올린다 — 회차를 안 올려 같은 키로 다시 부르면 재판정 기록이 dedupe로 사라지고, 회차 없이 매번 임의 키를 만들면 같은 판정이 중복으로 쌓인다.
- `impact`: 다음 액션(trainer 반려 항목·재평가 시점, PR을 열었으면 그 URL). 개선안이 있으면 "어떤 MD를 어떻게 고칠지" bullet 목록으로.
- `importance`: 등급 매핑 — Standard=2~3, Sensitive/Refactor=4~5. 습관적으로 3을 쓰지 않는다 — 하락폭이 크거나 대상 MD의 "역할 경계"·권한 서술에 영향을 주는 개선안이면 4~5.

### `agent_score_record` (채점을 한 회차에만, 대상 에이전트 1명당 1건)

- **필수 4개** — `agentName`, `overallScore`(Phase 1 '3) 총점 계산'에서 스크립트가 산출한 가중 총점, 0~100), `raterType`, `idempotencyKey`.
- `raterType`: evaluator의 채점 호출에서는 항상 `'evaluator'` 고정값으로 명시한다 — 필수값이라 빠뜨리면 호출 자체가 거부되고, 이 값일 때만 서버가 그 점수를 검증된 평가로 표시한다(검증 여부는 클라이언트가 지정하지 않는다).
- `idempotencyKey`: `score-<대상 슬러그>-<에이전트명>-r<회차번호>` — 위 `decision_record`의 회차 규칙에 **에이전트명을 더한** 형태를 쓰고 새 규칙을 만들지 않는다. 한 회차에 여러 에이전트를 함께 채점할 때 키에 에이전트명이 없으면 전부 같은 키가 되어 두 번째 이후 에이전트의 점수가 dedupe로 조용히 사라진다.
- `projectId`는 **이 도구의 파라미터가 아니다** — 넣지 않는다. 바로 위 `decision_record`의 필수 `projectId`와 혼동하지 않는다(점수는 프로젝트가 아니라 `agentName`에 귀속된다).
- `dimensionScores`: 구성요소 4개(기본수행/Eval Set/실전 성공률/비용 효율) 또는 기본수행 7항목 점수.
- `note`: 약점 진단과 개선안을 한 필드에 함께 담는다 — 진단만 적고 개선안을 빼면 다음 회차가 무엇을 고쳤어야 하는지 복원하지 못한다.

**이 기록은 쓰기 단독으로 완결되지 않는다.** 채점 착수 시 `agent_get_context`(`agentName`, `scoreHistoryLimit`)로 지난 회차 점수를 읽어 Scorecard 입력 JSON의 `previousScore`로 쓰는 것과 한 쌍이며, 한쪽만 하면 회차가 닫히지 않는다 — 쓰기만 하면 이번 회차가 추이를 비교하지 못하고, 읽기만 하면 다음 회차가 같은 자리에서 다시 막힌다. `previousScore`는 `bin/calc-training-scorecard.mjs`의 입력 필드이지 `agent_score_record`의 파라미터가 아니다. 점수 이력이 없어 읽지 못했으면 최초 회차임을 보고에 밝힌다.

**점수의 스코프**는 `agentName` 단위의 회사 공용 품질 지표다 — 에이전트 버전이 올라가도 같은 이름이면 같은 축에 쌓이고, 누가 호출했는지가 아니라 그 에이전트에 대한 기록이므로, 추이는 "내가 매긴 점수의 변화"가 아니라 "이 에이전트가 회사 전체에서 지금 어느 수준인가"로 읽는다. 다른 회차·다른 평가자가 남긴 점수와 같은 축에서 비교되므로, 한두 회차 표본만으로 그 에이전트의 역량을 단정하지 않는다.

**기록 채널은 hub 1개다** — 별도 판정 기록 파일은 만들지 않는다. 도구를 쓸 수 없으면 건너뛰지 말고 위 항목들을 다음 회차가 그대로 재개할 수 있는 수준으로 PM 반환문에 적고, 기록하지 못했다는 사실도 함께 밝힌다(공통 폴백: Skill `common-learning-loop-knowledge-management` "기록 도구를 쓸 수 없을 때").

## 판정 체크리스트 근거 해설

**언제 여는가**: `agents/evaluator.md` §2 판정 체크리스트를 적용하다 어떤 항목이 왜 그렇게 판정하라는 것인지 갈릴 때, 또는 그 체크리스트를 보강·설계할 때. **판정 문장·기준선 자체는 그 MD가 정본이고, 여기는 근거와 예시만 둔다** — 이 절을 읽지 않아도 판정은 성립해야 한다.

- **왜 판정 대상이 평면 경로 하나뿐인가**: malgn-agent는 조직이 git으로 clone해 그대로 배포하는 단일 소스다. 그래서 "로컬 훈련사본 vs 전역본"의 이중 구조나 `agents/<name>/manifest.json` 같은 에이전트별 하위 디렉토리가 애초에 존재하지 않는다 — manifest나 별도 동기화 상태를 신뢰할 대상이 없으므로 변경 범위는 `git diff`로만 확정한다.
- **왜 접두어 도달을 합산으로 세는가**: 스킬명 직접 히트만 세면 knowledge·MD 본문을 타고 깔리는 상시 비용이 통째로 빠진다. 예를 들어 `docs/product-principles.md`를 정본으로 지목하는 스킬은 `grep -rn product-principles agents/*.md`로 세야 실제 도달이 잡히고, 스킬명만 볼 때보다 넓게 나온다.
- **왜 검색어를 고정 문자열로 한정하는가**: 자연어 표현은 제각각이라 판정자마다 결과가 갈린다. 그리고 `WebSearch`·`Bash` 같은 빌트인 도구명은 전 에이전트가 기본 보유하므로 그 히트는 도달이 아니라 권한 선언이다 — 둘 다 검색어로 쓰면 도달 수가 실제와 무관해진다.
- **왜 기존 스킬은 구간이 어긋난 것만으로 반려하지 않는가**: 개명은 모든 참조 경로를 한꺼번에 끊는데 그렇게 해도 상시 비용은 그대로다. 그래서 접두어가 실제 비용을 과대·과소 표기할 때만 고칠 값어치가 있다.
- **왜 Knowledge→Skill 포인터 일부는 PASS인가**: 정본 선언·범위 표시·관련 자산 안내 셋은 모두 정본을 한 곳으로 못박는 **단방향** 포인터라 순환 참조를 오히려 막는다. FAIL이 되는 것은 같은 절차를 Knowledge 본문에도 실어둔 채 정본을 밝히지 않고 실행만 넘기는 줄 하나다 — 두 서술이 갈리면 어느 쪽이 참인지 판별할 수 없다.

**decision_record 기록 예시**(형식 참고용 — 파일이 아니라 그대로 도구 필드에 채워 넣는다):
```
reason:
## Scorecard 요약 — 2026-08
| 에이전트 | 지난달 | 이번달 | 변화 | 상태 |
|---------|-------|-------|------|------|
| reviewer | 78 | 82 | +4 | 상향 |
| architect | 75 | 68 | -7 | 하락 |
| backend-dev | 82 | 80 | -2 | 정상 |
| qa-engineer | 70 | 72 | +2 | 정상 |

### 주요 약점
1. architect (68점, -7) — "변경범위 관리" 15점 만점 중 6점: Work Order 분석 체크리스트 부재
2. reviewer (82점, +4) — 지난달 지침이 잘 적용됨, 유지 권고

impact:
- [ ] architect.md "역할 경계" 절에 "변경 영향도 매트릭스" 템플릿 추가 (evaluator→trainer 개선안 반영)
- [ ] reviewer.md 현재 지침 유지(변경 불필요)
- [ ] backend-dev.md "구현 검증" 섹션 보강 검토
- 재평가 대상: architect, 3주 후 / 정기 평가: 전체, 1개월 후
```

## 책임 구분

| 역할 | 작업 |
|------|------|
| **evaluator (이 Skill의 실행 주체)** | 산출물 수집 → Scorecard 채점 → 약점 분석 → 개선안 작성 → `decision_record` 기록 |
| **trainer** | evaluator가 넘긴 개선안을 대상 agent/skill/knowledge MD에 실제로 반영(git PR 절차는 `agents/evaluator.md` 참조) |
| **PM** | Scorecard 실행 전 작업 등급 판정(위임 시 1회), 완료 후 STATUS.md 1줄 갱신, 개선안이 Sensitive/Refactor급이면 사람 승인 확인 |

## 효율 규칙

- **총 소요시간**: 월 5~7시간
  - Phase 1: 2~3시간 (산출물 수집 + 채점)
  - Phase 2: 2시간 (분석 + 개선안, 같은 턴에 진행)
  - trainer 반영: 1~2시간 (MD 수정, 별도 사이클)

- **빈도**: 월 1회 정기 또는 필요시 임시

- **Eval 재평가**: 문제 에이전트는 2~3주 후 재평가 (개선 효과 확인)

- **산출물**: 대화에는 `decision_record` id + 개선안 3~4개만 요약해 반환(전문은 도구 필드에 있으므로 재출력하지 않는다)

## 참고

- 배점 기준·산출물 형식은 이 문서가 정본이다(외부 문서를 참조하지 않는다).
- 키워드 점수는 보조 지표만 사용(Scorecard가 주평가).
- **집계·가중합·threshold 판정은 암산이 아니라 `bin/calc-training-scorecard.mjs`로 계산한다**(위 "3) 총점 계산" 절 참고). 하위 정성 채점(0~100점 자체, Pass/Partial/Fail 판정, 감점 사유 관찰)은 그대로 evaluator의 판단 영역이다 — 스크립트는 그 결과를 입력받아 재계산 오류 없이 집계할 뿐 채점을 대신하지 않는다.
