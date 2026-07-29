# 팀 구성 및 위임 패턴

## 업무 유형별 최적 팀 구성

### 1. 제안서/기획서 작성
```
researcher → planner → writer → presenter
```
- researcher: 시장/경쟁사 조사, 데이터 수집
- planner: 조사 결과 기반 기획서 작성
- writer: 기획 내용을 제안서 형식으로 작성
- presenter: 발표 자료 제작 (필요 시)

### 2. 웹/앱 개발
```
planner → architect → backend-dev → frontend-dev → qa-engineer → devops
```
- 디자인 필요 시: planner 후 ux-designer → visual-designer 추가
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

다단계 사슬(A→B→C…)을 위임할 때, 사슬 전체를 한 번에 떠넘기고 결과만 기다리면 안 된다. Supervisor가 매 단계 제어권을 회수하는 "경로 릴레이"로 돈다:
1. A 호출 → A는 산출물을 **파일로 저장하고 경로 + 요약만 반환**
2. Supervisor가 반환을 받아(제어권 회수) **다음 에이전트 B를 직접 호출**하며 A의 경로를 입력으로 전달
3. 단계마다 반복. 각 단계 사이에 Supervisor가 항상 호출자로 존재

- **하위 에이전트끼리 직접 인계(SendMessage로 다음 주자 호출)에 의존하지 않는다.** Supervisor가 휴면(rest)하면 다음 주자가 바통을 넘길 상대가 사라져 사슬이 끊긴다(실측: 제안 파이프라인 드릴에서 PM 세션 휴면으로 인계 단절, 사람이 개입해 완주). **인계의 주체는 항상 Supervisor.**
- **이점:** 휴면으로 인한 사슬 단절 방지 + 매 단계 검증/재작업 게이트 행사 + 전문 대신 경로만 오가 토큰 절약.
- **병렬은 의존성으로 판단:** 서로 독립인 단계는 Supervisor가 직접 병렬 디스패치(하위끼리 인계 금지), 한쪽이 다른 쪽 입력이면 순차.

### Goal Drift 방지
- 각 에이전트 호출 시 원래 요구사항을 함께 전달
- 산출물 검토 시 원래 요구사항 대비 충족도를 명시적으로 확인
- 3단계 이상 진행 후 중간 점검: "원래 요청과 현재 방향이 일치하는가?"

## 병렬 실행 금지 이유

에이전트 간 산출물 의존성이 있으므로 반드시 순차 실행:
- 앞 에이전트의 산출물을 뒤 에이전트가 읽어야 함
- 병렬 실행 시 불일치/충돌 발생
