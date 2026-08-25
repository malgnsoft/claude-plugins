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

`previousScore`만은 이 단계에서 판단하거나 추정하지 않는다 — malgnai-hub `agent_get_context`(`agentName`, `scoreHistoryLimit`)로 그 에이전트의 점수 이력을 조회해 **최신 기록의 `overallScore`**를 그대로 넣는다. 조회 결과에 점수 이력이 없으면(첫 채점 등) 이 필드를 생략한다 — 스크립트가 `N/A(전월 점수 없음)`으로 처리한다.

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

1. **malgnai-hub `decision_record`**(evaluator가 기록):
   - `reason` 필드에 점수 요약표(에이전트별 지난회↔이번회 점수·변화·상태)와 주요 약점 진단을 채운다.
   - `impact` 필드에 "다음 액션" bullet 목록(어떤 MD를 어떻게 고칠지, 재평가 일정)을 채운다.
   - `importance`는 습관적으로 3을 쓰지 않고 판단한다 — 하락폭이 크거나 대상 MD의 "역할 경계"/권한 서술에 영향을 주는 개선안이면 4~5, 일반적인 섹션 보강이면 2~3.
2. **malgnai-hub `agent_score_record`**(evaluator가 기록, 채점을 한 회차에만): 대상 에이전트 1명당 1건을 남긴다. 1번의 산문 요약만으로는 다음 회차가 "지난회 점수"를 구조화된 형태로 조회할 수 없어 위 점수 요약표(지난회↔이번회·변화)를 채우지 못한다.
   - 필수 3개 — `agentName`, `overallScore`(Phase 1의 3) 총점 계산에서 스크립트가 산출한 가중 총점, 0~100), `idempotencyKey`(회차 규칙은 `agents/evaluator.md`의 판정 회차 기록을 상속한다).
   - `dimensionScores`: 구성요소 4개(기본수행/Eval Set/실전 성공률/비용 효율) 또는 기본수행 7항목 점수. `evaluatorNote`: 약점 진단. `improvementNote`: 개선안. `projectId`: 채점 계기가 된 프로젝트.
   - 점수 이력의 소유권은 **호출한 사용자 + 에이전트명**이다 — 개인 스코프 기록이지 조직 공통 평균이 아니므로 다른 사람의 점수와 합산해 해석하지 않는다.
3. **개선안 실행**: 실제 MD/knowledge 파일 반영은 이 스킬의 범위가 아니다 — evaluator→trainer 인계 절차를 그대로 따른다(등급별 git 반영·merge 조건은 `agents/evaluator.md`에 이미 정의돼 있으므로 여기서 중복 서술하지 않는다).

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
