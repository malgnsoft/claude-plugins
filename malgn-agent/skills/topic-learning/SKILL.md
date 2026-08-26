---
name: topic-learning
description: 주제 기반 학습 — 기술/패턴 주제로 가이드 작성 후 관련 에이전트 MD에 반영(trainer 모드 3). "학습시켜줘", "주제 학습" 요청 시 사용.
---

# Topic Learning Skill (모드 3)

"Docker 보안", "API 설계 패턴", "마이크로서비스" 같은 **주제**를 중심으로 최신 자료를 수집하고, 관련 에이전트들의 역량을 일괄 강화하는 모드입니다.

## 실행 흐름

### 1단계: 주제 정의 및 범위 (15분)

사용자 요청에서 주제 추출:
- **주제**: "Docker 보안" / "React 성능 최적화" / "토큰 효율" 등
- **범위**: 어느 에이전트들이 관련되는가?
  - "Docker 보안" → devops, backend-dev, security
  - "React 성능 최적화" → frontend-dev, qa-engineer
  - "토큰 효율" → 모든 에이전트 (공통)

### 2단계: 최신 자료 수집 (1시간)

**WebSearch** (3~5개 출처):
- 주제 관련 최신 기술 블로그, 공식 문서, 모범 사례
- 핵심 개념 추출 (예: Docker 보안 → image scanning, secrets management, network policies)

**필터링**:
- 2024년 이후 (최신성)
- 업계 표준 (Docker Official, NIST, OWASP 등 신뢰 가능)
- 실전 예시 포함 (개념만 있는 자료 제외)

### 3단계: Knowledge 파일 작성 (1시간)

`malgn-agent/knowledge/[도메인]/[주제]-YYYY-MM-DD.md`(설치 조직의 malgn-agent 소스 경로 기준 — 개인 홈 디렉토리가 아니라 이 플러그인 자신의 knowledge 폴더):

**구조**:
```
# Docker 보안 가이드

## 개요
- 필요 이유 (언제, 왜 이 주제가 중요한가)
- 핵심 개념 3~5개

## 핵심 패턴
1. Image Scanning (정적 분석)
   - 도구: Trivy, Harbor
   - 체크리스트
   - 예시 코드/명령어

2. Secrets Management
   - 도구: Docker Secrets, Vault
   - 안티패턴
   - 예시

3. Network Policies
   - 개념: 컨테이너 간 통신 제한
   - 구현: iptables 레벨
   - 체크리스트

## 에이전트별 적용 (다음 섹션)
- **devops**: Dockerfile 보안 스캔 통합
- **backend-dev**: Secret 관리 정책
- **qa-engineer**: 보안 테스트 케이스

## 참고 자료
- [출처 1] 링크
- [출처 2] 링크
```

작성 후 `malgn-agent/knowledge/README.md`의 폴더-대상 매핑 표에 등재한다(신규 도메인 폴더면 필수).

### 4단계: 에이전트 MD에 반영 (1시간)

주제와 관련된 각 에이전트 MD에 **참조 링크 + 체크리스트** 추가:

**예시 (devops.md "배포 보안" 섹션)**:
```
### Docker 보안 (2024-07-15)
[Docker 배포 가이드](${CLAUDE_PLUGIN_ROOT}/knowledge/devops/docker-cloudflare-guide.md) 참고.

**필수 체크리스트**:
- [ ] Dockerfile에 image scan 단계 포함
- [ ] Secrets는 환경변수 또는 Vault로만 전달
- [ ] Runtime security policy 정의 (AppArmor/SELinux)
```

**예시 (backend-dev.md "데이터 보안" 섹션)**:
```
### 민감정보 관리
[Docker 배포 가이드의 "환경변수·시크릿"](${CLAUDE_PLUGIN_ROOT}/knowledge/devops/docker-cloudflare-guide.md) 참고.
```

### 5단계: 변경사항 커밋 (초안 작성까지 — 승격 실행은 evaluator 소관)

여기까지는 trainer가 malgn-agent 소스 clone에서 직접 파일을 Edit한 **초안 작성** 단계다. 반영을 전사에 실제로 퍼뜨리는 **승격 실행**(git push + PR + 등급별 merge)은 이 스킬의 범위가 아니라 evaluator가 담당한다:

```
1) trainer: git checkout -b trainer/topic-<주제>-<YYYYMMDD> (malgn-agent 소스 clone에서)
2) trainer: 3~4단계에서 만든 knowledge 파일 + 에이전트 MD 변경을 git commit까지만 수행
   (push/PR은 하지 않는다 — 초안 작성과 승격 실행을 분리 유지)
3) evaluator에게 인계: git diff로 변경 확인 → 판정 체크리스트 통과 시
   git push + gh pr create → 등급별 merge(Standard/Sensitive는 evaluator.md 절차를 따른다)
```

evaluator가 없거나 조직이 malgn-agent 소스를 git으로 관리하지 않는 경우, 이 3단계는 생략하고 변경 파일 목록만 사람에게 전달한다.

### 6단계: 학습 기록 + 완료 보고

기록 주체는 `agents/trainer.md` '## 역할 경계' 절의 "`work_record` 주인 판별"을 따른다 — 주어가 "내가 방금 한 실행"이면 trainer, "이 프로젝트가 어디까지 갔는가"면 PM, "에이전트의 역량·교훈"이면 `agent_learning_record`다.

- **trainer가 직접 남긴다**: 이 스킬에서 자신이 한 실행 1건을 `work_record`(projectId, status='completed', title, idempotencyKey + summary=학습 주제 + 대상 에이전트 목록, result=작성한 knowledge 파일 경로·업데이트한 에이전트 MD 목록, artifacts=브랜치명·변경 파일 경로)로 남긴다. PR URL은 5단계에서 evaluator가 열기 때문에 trainer는 알 수 없으므로 적지 않는다(모르는 값을 채우려 재확인하러 돌아가지 않는다). 이번 주제 학습으로 그 에이전트의 역량으로 남길 교훈이 생겼으면 `agent_learning_record`(agentName, type='experience')로 함께 남긴다 — 대상 에이전트가 여럿이면 에이전트별로 1건씩이다.
- **PM에게 인계한다**: 위와 같은 내용을 완료 보고로 넘긴다 — PM이 여러 에이전트 결과를 종합한 사이클 종결 `work_record`와 STATUS.md 반영을 맡고, 필요하면 PR URL을 거기서 보완한다.
- **evaluator 몫은 인계 대상이 아니다**: 5단계에서 evaluator가 낸 판정·승격 회차는 evaluator가 `decision_record`로 직접 남긴다(`agents/evaluator.md`의 '판정 회차 기록' 절).

## 산출물

- `malgn-agent/knowledge/[도메인]/[주제]-YYYY-MM-DD.md` — 주제 가이드 (2~4KB)
- 각 에이전트 MD 업데이트 (참조 링크 + 체크리스트)
- trainer 자신의 실행 `work_record` 1건 + 역량 교훈이 생긴 에이전트마다 `agent_learning_record` 1건 + PM에게 인계하는 완료 보고 1건(진단·보고 서사의 1차 정본은 PR body) — 사이클 종결 `work_record`와 STATUS.md 반영은 PM, 판정 회차 `decision_record`는 evaluator가 직접 남긴다(`agents/trainer.md` 역할 경계의 "`work_record` 주인 판별" 참조)

## 효율 규칙

- **트리거**: 팀이 "이 주제 학습 필요해" 요청할 때
- **빈도**: 분기 1~2회 (비정기, 필요시)
- **범위**: 주제당 3~5개 에이전트만 (과도한 업데이트 방지)
- **산출**: 파일 저장 후 경로 + 핵심 3~4개 개념 반환
