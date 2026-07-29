---
name: topic-learning
description: 주제 기반 학습 — 기술/패턴 주제로 가이드 작성 후 관련 에이전트 MD에 반영(trainer 모드 4). "학습시켜줘", "주제 학습" 요청 시 사용.
---

# Topic Learning Skill (모드 4)

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

`~/.claude/knowledge/[도메인]/[주제]-YYYY-MM-DD.md`:

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

### 4단계: 에이전트 MD에 반영 (1시간)

주제와 관련된 각 에이전트 MD에 **참조 링크 + 체크리스트** 추가:

**예시 (devops.md "배포 보안" 섹션)**:
```
### Docker 보안 (2024-07-15)
[Docker 보안 가이드](~/.claude/knowledge/devops/docker-security-2024-07-15.md) 참고.

**필수 체크리스트**:
- [ ] Dockerfile에 image scan 단계 포함
- [ ] Secrets는 환경변수 또는 Vault로만 전달
- [ ] Runtime security policy 정의 (AppArmor/SELinux)
```

**예시 (backend-dev.md "데이터 보안" 섹션)**:
```
### 민감정보 관리
[Docker 보안 가이드의 "Secrets Management"](~/.claude/knowledge/devops/docker-security-2024-07-15.md#secrets-management) 섹션 참고.
```

### 5단계: 학습 기록 (선택)

Trainer가 이 스킬을 완료하면:
- 작성한 Knowledge 파일 경로
- 업데이트한 에이전트 MD 목록

## 산출물

- `~/.claude/knowledge/[도메인]/[주제]-YYYY-MM-DD.md` — 주제 가이드 (2~4KB)
- 각 에이전트 MD 업데이트 (참조 링크 + 체크리스트)

## 효율 규칙

- **트리거**: 팀이 "이 주제 학습 필요해" 요청할 때
- **빈도**: 분기 1~2회 (비정기, 필요시)
- **범위**: 주제당 3~5개 에이전트만 (과도한 업데이트 방지)
- **산출**: 파일 저장 후 경로 + 핵심 3~4개 개념 반환
