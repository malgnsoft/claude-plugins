# 팀 구성 및 위임 패턴

## 업무 유형별 최적 팀 구성

### 1. 제안서/기획서 작성
```
researcher → planner → rfp-analyst → capture-strategist → writer → presenter
```
- researcher: 시장/경쟁사 조사, 데이터 수집
- planner: 조사 결과 기반 기획서 작성
- rfp-analyst: RFP 요구사항 분석·Compliance Matrix 작성 (제안서인 경우)
- capture-strategist: Bid/No-Bid·Win Theme·Storyboard 수립 (제안서인 경우)
- writer: 기획 내용을 제안서 형식으로 작성 (제안서면 rfp-analyst·capture-strategist 산출물을 필수 입력받음)
- presenter: 발표 자료 제작 (필요 시)

### 2. 웹/앱 개발
```
planner → architect → ux-designer → backend-dev → frontend-dev → qa-engineer → devops
```
- ux-designer는 화면이 하나 신설되거나 기존 화면의 기능이 변경/추가되면 기본 투입(예외는 Micro 등급뿐). visual-designer는 ux-designer 산출물의 판단에 따라 조건부 투입.
- 보안 중요 시: qa-engineer 후 security 추가

### 3. 디자인 프로젝트
```
researcher → ux-designer → visual-designer
```

### 4. 보고서/분석
```
researcher → writer → presenter
```

### 5. 보안 점검
```
security → writer
```

## 팀 구성 판단 기준

| 요청 키워드 | 필수 에이전트 | 선택 에이전트 |
|------------|-------------|-------------|
| "만들어줘", "개발" | planner, architect, backend-dev | frontend-dev, qa, devops |
| "분석", "조사" | researcher | writer, presenter |
| "제안서", "기획서" | researcher, planner, writer | presenter |
| "디자인", "UI" | ux-designer, visual-designer | frontend-dev |
| "보안", "점검" | security | writer |
| "발표", "PPT" | presenter | writer, researcher |
| "문서", "보고서" | writer | researcher |

## 에이전트 간 의존성

```
planner ──→ architect ──→ backend-dev ──→ qa-engineer
                │              │              │
                └──→ ux-designer ──→ visual-designer ──→ frontend-dev
                                                            │
                                                       qa-engineer ──→ security ──→ devops
```

## 재작업 판단 기준

- 산출물이 요구사항의 80% 미만 충족 → 재작업 지시
- 이전 단계 산출물과 불일치 → 해당 부분 수정 지시
- 최대 2회 재작업 후에도 미흡 → 직접 보완 후 다음 단계 진행

## 복합 요청 처리 패턴

하나의 요청에 여러 업무 유형이 혼합된 경우:

### 판단 절차
1. 요청을 독립적 하위 작업으로 분해
2. 각 하위 작업의 업무 유형 판별
3. 하위 작업 간 의존성 파악
4. 의존성이 없는 작업은 순차 배치로 그룹화
5. 의존성이 있는 작업은 선행 작업 완료 후 실행

### 예시: "경쟁사 분석 후 웹앱 만들어줘"
```
[그룹1] researcher → planner (조사+기획)
[그룹2] architect → backend-dev → frontend-dev → qa-engineer → devops (개발)
```

### 에이전트 역량 기반 동적 조정
- 특정 에이전트가 이전 프로젝트에서 저평가 → 산출물 검토를 더 엄격하게
- 에이전트 산출물이 2회 연속 재작업 → 해당 영역을 다른 에이전트에 분담 검토
- lessons/ 폴더의 과거 회고에서 에이전트별 강/약점 참조

## 위임 모델 (Supervisor-Worker)

PM은 Supervisor 역할로 아래 패턴을 따릅니다:
1. **작업 분해**: 사용자 요청을 에이전트 단위 작업으로 분해
2. **위임**: 각 에이전트에 입력 산출물과 기대 산출물을 명확히 전달
3. **검증**: 완료된 산출물이 기대 수준을 충족하는지 검토
4. **재위임/보완**: 미달 시 피드백과 함께 재작업 지시 (최대 2회)
5. **통합**: 모든 에이전트 산출물을 종합하여 최종 결과 생성

### 경로 릴레이: 사슬 전체를 한 번에 위임하지 말 것

다단계 사슬(A→B→C…) 위임 시 Supervisor가 매 단계 제어권을 회수하는 "경로 릴레이" 원칙 — 사고사례·근거는 `coo-rule-rationale.md` 항목4가 권위자다(2026-08-07, 중복 서술 정리). 실행 절차 요약은 `agents/pm.md`의 "경로 릴레이 순차" 항목 참조.

### Goal Drift 방지
- 각 에이전트 호출 시 원래 요구사항을 함께 전달
- 산출물 검토 시 원래 요구사항 대비 충족도를 명시적으로 확인
- 3단계 이상 진행 후 중간 점검: "원래 요청과 현재 방향이 일치하는가?"

## 병렬 실행 금지 이유

에이전트 간 산출물 의존성이 있으므로 반드시 순차 실행:
- 앞 에이전트의 산출물을 뒤 에이전트가 읽어야 함
- 병렬 실행 시 불일치/충돌 발생
