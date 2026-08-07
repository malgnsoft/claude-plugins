---
name: agent-upskill
description: 특정 에이전트 역량 강화 — MD/Knowledge 학습 자료 수집·추가(trainer 모드 1). "스킬업 시켜", "architect 학습시켜", "reviewer 보강" 같은 특정 에이전트 대상 역량강화 요청에 사용.
---

# Agent Upskill Skill (모드 1)

특정 에이전트의 취약 역량을 진단하고, WebSearch로 최신 자료를 수집하여 Knowledge와 MD를 보강합니다.

## 실행 흐름

1. **에이전트 MD 분석** → 현재 역량/섹션 파악
2. **취약 스킬 진단** → 3~5개 개선 대상 식별
3. **WebSearch** → 각 주제별 최신 자료 수집 (2~3개/주제)
4. **Knowledge 작성** → `~/.claude/knowledge/[도메인]/` 신규 파일 추가
5. **MD 보강** → 기존 에이전트 MD의 해당 섹션에 참조/체크리스트 추가
6. **학습 기록** → malgnai-hub `mcp__malgnai-hub__work_record`(repositoryKey, status: 'completed', title, summary, result 요약, artifacts)

## 보강 범위

**Knowledge 추가 규칙**:
- 범용 학습 자료 → `~/.claude/knowledge/[도메인]/`
- 프로젝트 문서 → `workspace/[프로젝트]/docs/`
- 기존 knowledge는 덮어쓰지 말고 추가만 (1:1 보존)

**MD 보강**:
- 해당 섹션에 참조 링크 추가
- 체크리스트 또는 사례 추가
- 근거 제시 (출처 URL)

## 산출물

- `~/.claude/knowledge/training/[에이전트명]-upskill-YYYY-MM-DD.md` — 학습 보고서
  - 진단 결과
  - 추가한 knowledge 파일 목록 + 요약
  - 보강한 MD 섹션
  - 스킬 변화 (Before/After 요약)
- malgnai-hub 기록: `mcp__malgnai-hub__work_record` 호출

## 효율 규칙

- 입력은 경로로, 필요한 구간만 Read (전체 읽기 금지)
- WebSearch는 도메인별 2~3개 결과만 깊이 있게
- 산출물은 파일 저장 후 경로+핵심 3개만 대화로 반환
