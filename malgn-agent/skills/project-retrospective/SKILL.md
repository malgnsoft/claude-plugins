---
name: project-retrospective
description: 프로젝트 완료 후 산출물·진행 이력을 분석하여 교훈 수집(trainer 모드 2). "프로젝트 회고", "lessons 만들어" 요청 시 사용.
---

# Project Retrospective Skill (모드 2)

프로젝트 완료 또는 마일스톤 달성 후, 산출물과 진행 기록을 분석하여 **에이전트별 성과**와 **재사용 가능한 교훈**을 추출합니다. (malgnai-mcp 환경: `lesson_add`로 캡처 — malgnai-hub v1에는 lesson_* 도구가 없어 해당 없음. malgnai-hub 연동판에서는 4단계에서 설명하는 대체 방식을 사용한다.)

## 실행 흐름

### 1단계: 프로젝트 산출물 수집 (30분)

대상 프로젝트의 최종 산출물:
- 코드/설계 산출물 (최종 커밋, 설계 문서)
- 에이전트 작업 기록 (malgnai-hub `work_record` 이력, 에이전트별 수행 내역)
- 진행 기록 (`STATUS.md`, 커밋 히스토리)
- 산출물 품질 (reviewer 평가, 테스트 커버리지, 배포 성공률)

### 2단계: 에이전트별 성과 분석 (1시간)

참여한 에이전트별로 분석:
- **architect**: 설계 완전성, 기술 선택의 적절성, 수정 사항
- **backend-dev**: 구현 품질, 버그 수정 횟수, 성능 최적화
- **frontend-dev**: UI 완성도, 사용성 피드백, 반복 수정
- **reviewer**: 평가 정확도, 지적 사항 반영률
- **qa-engineer**: 테스트 커버리지, 버그 발견 효율
- 기타 에이전트: 기여도 정리

**산출**: 에이전트별 "잘한 점 3개 + 어려웠던 점 2개"

### 3단계: 교훈 추출 (1시간)

에이전트별 분석에서 **일반화 가능한 교훈** 추출:

4부 구조로 정리 (필수):
1. **전제조건**: 언제/어떤 상황에 이 교훈이 필요한가?
2. **권장행동**: 구체적으로 무엇을 해야 하는가?
3. **반례**: 이것을 무시하면 어떻게 되는가?
4. **판별질문**: 다음 프로젝트에서 상황을 판단하는 질문

**예시**:
```
## 교훈: "설계 초기에 DB 스키마를 확정하지 않으면 구현 중 수정 폭증"

**전제조건**: 데이터 중심 백엔드 프로젝트 (웹/앱 개발)
**권장행동**: 
  1. 아키텍처 단계에서 core entity 3~5개 먼저 정의
  2. architect가 "스키마 먼저" 체크리스트 추가
  3. backend-dev 착수 전 스키마 리뷰 필수
**반례**: "일단 구현하고 나중에 정규화" → DB 마이그레이션 반복 + 배포 지연
**판별질문**: 이번 프로젝트에서 Entity 개수가 10개 이상인가? 네면 사전 설계 필수.
```

### 4단계: 교훈 기록 (30분)

**⚠️ malgnai-hub v1에는 lesson_* 도구가 없음 — 아래 `lesson_add` 캡처 절차는 malgnai-mcp(사내 전용) 환경에서만 동작하며, malgnai-hub 연동판에서는 해당 기능 없음.** malgnai-hub 연동판에서는 추출한 교훈 4~8개를 다음 방식으로 대체 기록한다:
- 결정/판단이 두드러진 교훈 → `mcp__malgnai-hub__decision_record`(repositoryKey, title, decision=권장행동, reason=전제조건+반례, impact=판별질문/영향, importance)
- 작업 진행형 교훈 → `mcp__malgnai-hub__work_record`(repositoryKey, status='completed', title, summary, result=4부 구조 요약, nextAction=다음 프로젝트에 적용할 행동)
- 구조화된 pending→classified 분류 큐 자체는 malgnai-hub에 없으므로, 분류·MD 반영이 필요하면 기록 직후 바로 해당 에이전트 MD에 반영하거나(`/reflect-lessons` 참고) 사람이 `docs/training-report-*.md`에서 확인할 수 있게 한다.

> malgnai-mcp 전용 원본 절차(참고용, malgnai-hub에서는 미동작): 추출한 교훈 4~8개를 각각 malgnai-mcp `lesson_add`로 캡처한다(2026-07-16부터 — 로컬 파일 작성 대신). 로컬 `~/.claude/knowledge/lessons/*.md` 파일은 더 이상 새로 작성하지 않는다 — malgnai `lessons` 테이블이 원시 학습 이력의 정본 pending 큐다.
> - `project_id`: 이 프로젝트의 malgnai project_id (STATUS.md 헤더 또는 `get_current_context`)
> - `type`: `experience`
> - `title`/`content`: 4부 구조(전제조건→권장 행동→반례→판별 질문) + 프로젝트 개요·에이전트별 성과 요약 근거 포함
> - `source`: 산출물/커밋/STATUS.md 등 근거 경로
> - `candidate_agents`: 2단계 성과 분석에서 나온 관련 에이전트 이름(쉼표 구분, 힌트일 뿐 확정 아님)

### 5단계: 여기서 MD를 직접 고치지 않는다

이 스킬은 **캡처까지만** 한다. 분류·에이전트 MD 반영은 **`/reflect-lessons`(모드4)가 전담**한다 — 캡처 지점이 여러 곳으로 늘어나 각자 반영까지 해버리면 중복·충돌이 생긴다. "학습 후 최종 정리"는 항상 한 곳(모드4)에서만. (malgnai-mcp 환경에서는 pending 종결이 `lesson_classify` 호출로 이루어졌으나, malgnai-hub v1에는 lesson_* 큐가 없어 이 종결 단계 자체가 해당 없음.)

## 산출물

- (malgnai-mcp 환경) malgnai `lessons` 테이블에 캡처된 pending 항목 id 목록 — malgnai-hub 연동판에서는 해당 없음
- (malgnai-hub 연동판) `decision_record`/`work_record`로 기록한 항목 id 목록
- (선택) 사람이 읽을 보고서가 따로 필요하면 프로젝트 루트의 `docs/training-report-[주제]-YYYY-MM-DD.md`에 프로젝트 개요·성과 요약을 남길 수 있다 — malgnai-hub 연동판에서 교훈 자체의 정본은 decision_record/work_record다.

## 효율 규칙

- **활용**: 다른 모드와 독립적 (프로젝트 완료 시 1회만)
- **기준**: 반례 검토 후만 캡처 (전칭 금지)
- **산출**: (malgnai-mcp) `lesson_add` 호출 후 캡처한 lesson id + 교훈 제목 3~4개만 대화로 반환 / (malgnai-hub) `decision_record`·`work_record` 호출 후 기록 id + 교훈 제목 3~4개만 대화로 반환
