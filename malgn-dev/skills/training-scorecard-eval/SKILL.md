---
name: training-scorecard-eval
description: 에이전트 산출물 평가 + 피드백 통합 — Scorecard 채점 + 즉시 MD 개선안 제시(trainer 모드 7). "에이전트 평가", "산출물 진단" 요청 시 사용.
---

# Training Scorecard Evaluation Skill (모드 7)

산출물 기반 에이전트 진단. **평가와 피드백을 한 턴에 통합** — Scorecard 채점 후 약점별 MD 개선안을 즉시 제시하고, Trainer가 MD에 반영합니다.

## 핵심: 평가 + 피드백 통합 (한 턴에 처리)

**Before (분리)**: 평가 → 분석 → (1주 후) → 피드백 → 개선 (피드백 지연)
**After (통합)**: 평가 + 분석 + 즉시 개선안 제시 → Trainer가 MD에 반영 (같은 턴에 처리)

→ **피드백 루프 단축 + 에이전트가 빨리 배움**

---

## 실행 흐름 (4~5시간)

### Phase 1: 산출물 수집 + Scorecard 채점 (2~3시간)

**1) 산출물 수집** (30분):
- 대상 에이전트의 최근 산출물 3~5개 (최근 2주~1개월)
  - **reviewer**: `docs/reviewer/review-*.md`
  - **architect**: `docs/*-design.md`, `agent-design/*.md`
  - **ux-designer**: `docs/ux-*.md`, `design/`
  - **backend-dev**: 코드 구현 + PR 리뷰
  - **qa-engineer**: 테스트 보고서

**2) Scorecard 채점** (2시간):
- **기본수행 60%** (7항목, 0~100점): 요구사항 이해, 변경범위, 정확도, 검증, 리스크, 보고, 비용 효율
  - 참조: `docs/training-design-scorecard-eval.md#부록-a`
- **Eval Set 25%** (Pass/Partial/Fail): 특정 능력 검증
  - 참조: `docs/training-design-scorecard-eval.md#부록-b`
- **실전 성공률 10%**: 지난 1개월 첫 시도 성공률
- **비용 효율 5%**: 토큰 낭비 패턴

**3) 총점 계산**:
```
최종 점수 = (기본수행 × 0.6) + (Eval Set × 0.25) + (성공률 × 0.1) + (비용 × 0.05)
```

### Phase 2: 약점 분석 + 즉시 피드백 (2시간, 같은 턴에)

**1) 지난달 대비 변화 추적**:
- **상승** (+5점 이상): 좋은 사례 정리
- **정체** (±5점 이내): 현상유지
- **하락** (-5점 이상): 근본 원인 분석

**2) 항목별 약점 진단**:
- 어디서 떨어졌는가? (예: "검증 품질이 18점 떨어짐")
- 왜인가? (예: "테스트 케이스 복잡도 증가, 커버리지 목표 재설정 필요")

**3) 즉시 개선안 제시** (Trainer가 MD에 반영할):
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

**월별 report 파일** (Trainer가 작성):
- `~/.claude/knowledge/training/scorecard-report-YYYY-MM-DD.md`

**구조**:
```markdown
# Scorecard Report — 2026-07

## 평가 대상
- reviewer (3건), architect (3건), backend-dev (2건), qa-engineer (2건)

## 점수 요약
| 에이전트 | 지난달 | 이번달 | 변화 | 상태 |
|---------|-------|-------|------|------|
| reviewer | 78 | 82 | +4 | ✅ 상향 |
| architect | 75 | 68 | -7 | 🔴 하락 |
| backend-dev | 82 | 80 | -2 | ✓ 정상 |
| qa-engineer | 70 | 72 | +2 | ✓ 정상 |

## 주요 약점 & 개선안 (Trainer가 MD에 반영함)

### 1. architect (68점, -7점 ↓)
**약점**: "변경범위 정의 불명확" (90점 → 72점)
**개선안** (architect.md에 추가):
- Work Order 분석 체크리스트 추가
- "변경 영향도 매트릭스" 템플릿 추가

### 2. reviewer (82점, +4점 ↑)
**상승 요인**: 마지막달 지시사항 잘 적용됨
**권고**: 현재 지침 유지

## Trainer 액션 (다음 1주)
- [ ] architect.md "Work Order" 섹션 보강 (체크리스트 + 템플릿)
- [ ] reviewer.md 현재 기법 문서화 (사례 추가)
- [ ] backend-dev.md "구현 검증" 섹션 생성 (필요시)

## 다음 평가 일정
- 재평가 대상: architect (3주 후)
- 정기 평가: 전체 (1개월 후)
```

## 책임 구분

| 역할 | 작업 |
|------|------|
| **Trainer (Skill)** | 산출물 수집 → Scorecard 채점 → 약점 분석 → 개선안 작성 → MD 반영 |
| **COO** | Skill 완료 후 STATUS.md 갱신, malgnai-hub `work_record` 기록 |

## 효율 규칙

- **총 소요시간**: 월 5~7시간
  - Phase 1: 2~3시간 (산출물 수집 + 채점)
  - Phase 2: 2시간 (분석 + 개선안, 같은 턴에 진행)
  - Trainer 반영: 1~2시간 (MD 수정)
  
- **빈도**: 월 1회 정기 또는 필요시 임시

- **Eval 재평가**: 문제 에이전트는 2~3주 후 재평가 (개선 효과 확인)

- **산출물**: 파일 저장 후 경로 + 개선안 3~4개만 대화로 반환

## 참고

- Scorecard 상세: `docs/training-design-scorecard-eval.md`
- Phase 로드맵: `docs/training-design-scorecard-eval.md#부록-d`
- 키워드 점수는 보조 지표만 사용 (Scorecard가 주평가)
