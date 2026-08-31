---
name: domain-training-scorecard-eval
description: 에이전트 산출물 평가 + 피드백 통합 — Scorecard 채점(기본수행/Eval Set/실전성공률/비용효율)과 약점별 MD 개선안 제시를 한 턴에 처리한다. evaluator가 실행하고 trainer가 MD 반영을 이어받는다. "에이전트 평가해줘", "산출물 진단", "이 에이전트 점수 낮네" 요청 시 사용.
---

# Training Scorecard Evaluation Skill

산출물 기반 에이전트 진단. **평가와 피드백을 한 턴에 통합** — Scorecard 채점 후 약점별 MD 개선안을 즉시 제시하고, 실제 MD 반영은 evaluator→trainer 인계 절차(각 에이전트 MD 참조)로 이어집니다.

> 소관: 이 스킬은 `evaluator`가 실행한다(역할 경계 상세는 `agents/trainer.md`/`agents/evaluator.md` 참조, 여기서 중복 서술하지 않는다). trainer는 evaluator가 작성한 개선안을 실제 MD/knowledge 파일에 반영하는 마지막 단계만 수행한다.

**이 파일은 색인이다.** 매번 걸리는 짧은 규율(소관·통합 원칙·총점 계산 커맨드·산출물 채널·책임 구분·효율 규칙)은 여기 그대로 있고, 특정 시점에만 필요한 절(채점 절차, 기록 파라미터, 판정 근거 해설)은 같은 디렉터리의 파일로 나뉘어 있다. 한 회차에 필요한 것은 대개 하나이므로 전체를 안고 가지 말고 **그 시점에 해당하는 파일만 Read한다**. 각 절에 적힌 한 줄 요약은 "무엇을 열지" 고르라고 있는 것이지 본문을 대신하지 않는다.

## 핵심: 평가 + 피드백 통합 (한 턴에 처리)

**Before (분리)**: 평가 → 분석 → (1주 후) → 피드백 → 개선 (피드백 지연)
**After (통합)**: 평가 + 분석 + 즉시 개선안 제시 → trainer가 MD에 반영 (같은 사이클에 처리)

→ **피드백 루프 단축 + 에이전트가 빨리 배움**

---

## 실행 흐름 (4~5시간)

- **Phase 1: 산출물 수집 + Scorecard 채점** (2~3시간) — 대상 에이전트의 최근 산출물 3~5개를 모으고, 기본수행 60%(7항목 배점표)·Eval Set 25%·실전 성공률 10%·비용 효율 5%를 채점한 뒤 스크립트로 총점을 낸다.
- **Phase 2: 약점 분석 + 즉시 피드백** (2시간, 같은 턴에) — 전월 대비 변화 추적, 항목별 약점 진단, trainer가 반영할 개선안 작성.

**채점 회차를 실제로 수행할 때** `${CLAUDE_PLUGIN_ROOT}/skills/domain-training-scorecard-eval/scoring-procedure.md`를 Read한다 — 배점표·판정 기준·입력 JSON 스키마·스크립트 출력 해석이 그 파일에만 있다. 배점 정본이 그쪽이므로, 기억으로 채점하지 않는다.

### 총점 계산 커맨드

집계·가중합·threshold 비교는 결정론적 산식이므로 **암산하지 않고 스크립트로 계산한다**. 정성 점수(0~100 하위점수, Pass/Partial/Fail, 감점 사유 건수)만 evaluator가 판단해 JSON으로 넘긴다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs" --input scorecard.json
# 또는
echo '{ ...JSON... }' | node "${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs"
# 전월 대비 상승/정체/하락 판정 기준(점)을 바꿀 때. 기본 5점
node "${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs" --input scorecard.json --threshold 3
# 입력 스키마·옵션 전체
node "${CLAUDE_PLUGIN_ROOT}/bin/calc-training-scorecard.mjs" --help
```

> 이 커맨드가 실패하거나(특히 `MODULE_NOT_FOUND`) 새 실행 지시를 쓸 때의 규약 — 따옴표, 이 변수가 치환되는 자리와 안 되는 자리, 맨 명령어를 쓰지 않는 이유 — 은 Skill `common-output-storage-and-path-management` §1-1이 정본이다.

---

## 산출물

Scorecard 결과는 **파일로 저장하지 않는다** — 이 스킬만을 위한 별도 report 파일 버킷을 신설하지 않고, 아래 세 채널로만 기록한다:

1. **malgnai-hub `decision_record`**(evaluator가 기록) — 필드별 상세는 아래 "판정 회차 기록" 절이 가리키는 파일이 정본이다.
2. **malgnai-hub `agent_score_record`**(evaluator가 기록, 채점을 한 회차에만): 대상 에이전트 1명당 1건을 남긴다. `decision_record`의 산문 요약만으로는 다음 회차가 "지난회 점수"를 구조화된 형태로 조회할 수 없어 점수 요약표(지난회↔이번회·변화)를 채우지 못한다. 필드별 상세는 같은 파일 참조.
3. **개선안 실행**: 실제 MD/knowledge 파일 반영은 이 스킬의 범위가 아니다 — evaluator→trainer 인계 절차를 그대로 따른다(등급별 git 반영·merge 조건은 `agents/evaluator.md`에 이미 정의돼 있으므로 여기서 중복 서술하지 않는다).

## 판정 회차 기록 — 도구 파라미터 상세

`decision_record`(회차마다 1건 필수)와 `agent_score_record`(채점 회차에만, 에이전트 1명당 1건)의 필드별 값·형식 — `projectId` 조달 방법, `idempotencyKey` 회차 규칙, `raterType` 고정값, `agent_score_record`에 `projectId`를 넣지 않는 이유, `previousScore` 읽기와의 한 쌍 관계, 점수 스코프, hub 미가용 시 폴백.

**hub에 기록을 남기기 직전에** `${CLAUDE_PLUGIN_ROOT}/skills/domain-training-scorecard-eval/record-parameters.md`를 Read한다 — 형식을 틀리면 호출이 거부되거나 기록이 dedupe로 조용히 사라진다.

## 판정 체크리스트 근거 해설

`agents/evaluator.md` §2 판정 체크리스트의 각 항목이 왜 그렇게 판정하라는 것인지에 대한 근거와 예시(평면 경로 판정 대상, 접두어 도달 합산, 고정 문자열 검색어, 기존 스킬 구간 어긋남, Knowledge→Skill 포인터 판정) + `decision_record` 기록 예시.

**체크리스트를 적용하다 판정이 갈릴 때만** `${CLAUDE_PLUGIN_ROOT}/skills/domain-training-scorecard-eval/checklist-rationale.md`를 Read한다 — 판정 문장·기준선 자체는 `agents/evaluator.md`가 정본이고 그 파일은 근거만 담으므로, 열지 않았다는 이유로 판정을 미루지 않는다.

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

- 배점 기준·산출물 형식의 정본은 이 스킬이다(외부 문서를 참조하지 않는다) — 배점표 본문은 위 "실행 흐름"이 가리키는 `scoring-procedure.md`에 있다.
- 키워드 점수는 보조 지표만 사용(Scorecard가 주평가).
- **집계·가중합·threshold 판정은 암산이 아니라 위 "총점 계산 커맨드"로 계산한다.** 하위 정성 채점(0~100점 자체, Pass/Partial/Fail 판정, 감점 사유 관찰)은 그대로 evaluator의 판단 영역이다 — 스크립트는 그 결과를 입력받아 재계산 오류 없이 집계할 뿐 채점을 대신하지 않는다.
