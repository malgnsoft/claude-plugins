---
name: agent-upskill
description: 특정 에이전트 역량 강화 — MD/Knowledge 학습 자료 수집·추가(trainer 모드 1). "스킬업 시켜", "architect 학습시켜", "reviewer 보강" 같은 특정 에이전트 대상 역량강화 요청에 사용.
---

# Agent Upskill Skill (모드 1)

특정 에이전트의 취약 역량을 진단하고, WebSearch로 최신 자료를 수집하여 Knowledge와 MD를 보강합니다.

**전제**: 아래 4·7단계(git 브랜치·PR)는 조직이 malgn-agent 소스를 git으로 clone해 관리할 때만 작동한다. 없으면 4·7단계는 생략하고 5~6단계만 로컬 파일 Edit로 수행한 뒤 사람에게 반영을 맡긴다.

## 실행 흐름

1. **에이전트 MD 분석** → 현재 역량/섹션 파악
2. **취약 스킬 진단** → 3~5개 개선 대상 식별
3. **WebSearch** → 각 주제별 최신 자료 수집 (2~3개/주제)
4. **브랜치 생성** (trainer) → `git checkout -b trainer/<에이전트명>-upskill-YYYYMMDD` (malgn-agent 소스 clone에서)
5. **Knowledge 작성** (trainer, 4의 브랜치 위에서 Edit + `git commit`) → `malgn-agent/knowledge/[도메인]/` 신규 파일 추가
6. **MD 보강** (trainer, 같은 브랜치, Edit + `git commit`) → 기존 에이전트 MD의 해당 섹션에 참조/체크리스트 추가
7. **evaluator 판정 + PR** → `git diff main..<branch>`로 5~6의 변경 확인 → 판정 체크리스트(`agents/evaluator.md` 참조) PASS 시 `git push` + `gh pr create`(PR body는 아래 "PR 본문 템플릿"). FAIL이면 trainer에 파일:라인 지정 반려. 등급별 merge 조건은 `agents/evaluator.md` §승격 실행을 따른다(Standard=evaluator 단독 가능 여부는 조직 브랜치 보호 설정에 따름, Sensitive=사람 승인 필수)
8. **학습 기록** → trainer가 malgnai-hub `work_record`(projectId, status: 'completed', title, summary, result 요약, artifacts에 PR URL 포함). 판정 회차는 evaluator가 `decision_record`로 직접 남긴다(PR URL은 `impact`에 — `agents/evaluator.md`의 "판정 회차 기록" 절 참조). PM은 그 결과를 프로젝트 단위 `work_record`로 이력화한다

## 보강 범위

**Knowledge 추가 규칙**:
- 범용 학습 자료 → `malgn-agent/knowledge/[도메인]/` (git PR로 반영, `malgn-agent/knowledge/README.md` 등재 필수)
- 프로젝트 문서 → `workspace/[프로젝트]/docs/`
- 기존 knowledge는 덮어쓰지 말고 추가만 (1:1 보존)

**MD 보강**:
- 해당 섹션에 참조 링크 추가
- 체크리스트 또는 사례 추가
- 근거 제시 (출처 URL)

## 산출물

이 스킬의 산출물은 성격이 다른 두 가지로 나뉜다 — 하나로 뭉뚱그려 저장하지 않는다.

| 산출물 | 성격 | 저장 위치 |
|---|---|---|
| 실제 지식 콘텐츠(재사용 가능한 도메인 지식) | malgn-agent 자체의 일부가 되어야 할 자산 | **malgn-agent 플러그인 공유 knowledge**(`knowledge/<도메인>/`), 7단계 git PR로 반영. `malgn-agent/knowledge/README.md` 등재 필수 |
| "무엇을 왜 어떻게 보강했는가"의 진단·보고 서사(Before/After, 진단 결과) | 이 upskill 세션 자체의 1회성 작업 이력 — 재사용 지식이 아님 | **PR body**(아래 템플릿)가 1차 정본. 요약 1줄은 malgnai-hub `work_record`로 이력화 |

개인 knowledge 경로(`~/.claude/knowledge/...`)는 이 파이프라인에서 쓰지 않는다 — 배포 조직에는 그 경로가 없다.

**PR 본문 템플릿**:
```
## 진단 결과
- 대상 에이전트: <name>
- 취약 스킬/영역: <3~5개>

## Before/After
- Before: <기존 MD/Knowledge 상태 요약>
- After: <추가/보강한 내용 요약>

## 추가한 Knowledge
- knowledge/<도메인>/<파일>.md — <1줄 요약, 출처 URL>

## 보강한 MD 섹션
- agents/<name>.md #<섹션명> — <추가 내용 1줄>

## Test plan
- [ ] 판정 체크리스트 PASS (evaluator)
```

## 효율 규칙

- 입력은 경로로, 필요한 구간만 Read (전체 읽기 금지)
- WebSearch는 도메인별 2~3개 결과만 깊이 있게
- 산출물은 파일 저장 후 경로+핵심 3개만 대화로 반환
