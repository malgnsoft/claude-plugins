---
name: domain-devops-deployment-patterns
description: 배포 표준 — Docker 이미지 최적화, 컨테이너 인프라 보안 하드닝(비루트 실행·시크릿 미하드코딩·.dockerignore), CI/CD 파이프라인, 헬스체크(livez/readyz), 로깅·모니터링 규약, 배포 전략(Blue-Green·Canary·Rolling·자동 롤백). 배포·Docker·컨테이너 하드닝·CI/CD·쿠버네티스·헬스체크·로깅·모니터링·릴리스·무중단 배포·롤백 작업 시 사용.
---

# DevOps Deployment Patterns

프로덕션 배포와 운영을 위한 DevOps 표준 패턴입니다. 모든 서비스는 이 규칙을 따라 배포·운영되어야 합니다.

**이 파일은 색인이다.** 절 번호는 그대로다 — 다른 문서가 §1·§2처럼 가리키는 절은 전부 이 파일의 같은 번호에 있다. 다만 다섯 절은 배포 수명주기의 서로 다른 시점(이미지 빌드 / 파이프라인 구성 / 엔드포인트 구현 / 관측 구성 / 롤아웃)에 필요하므로, 여기에는 "무엇이 들어 있고 언제 여는가"만 두고 본문을 같은 디렉터리의 절별 파일로 내보냈다. 한 번의 작업에 필요한 절은 대개 한둘이므로, 전체를 안고 가지 말고 **그 작업에 해당하는 절의 파일만 Read한다**.

- **요약만 보고 그 절의 규칙을 적용하지 않는다.** 각 절의 한 줄 요약은 "무엇을 열지" 고르라고 있는 것이지 구현 규칙·체크리스트·예시를 대신하지 않는다.
- 아래 "적용 체크리스트"는 절별 파일을 열지 않아도 매 배포에 걸리는 최종 확인 목록이라 색인에 남긴다 — 여기서 걸리는 항목이 있으면 해당 절의 파일을 연다.

## 핵심 패턴

### 1. Docker 이미지 최적화 (Image Optimization)

멀티스테이지 빌드·경량 베이스·레이어 캐시·이미지 크기 목표, 그리고 **보안 강화 체크리스트(Infra Security)** — 비루트 실행(`USER`), .dockerignore 민감파일 제외, 시크릿 하드코딩 금지, .env.example 규약 + 비루트 Dockerfile 예시. **Dockerfile을 쓰거나 컨테이너 하드닝을 점검할 때** `${CLAUDE_PLUGIN_ROOT}/skills/domain-devops-deployment-patterns/01-image-optimization.md`를 Read한다.

### 2. CI/CD 파이프라인 (Pipeline Standards)

자동 테스트·코드리뷰·보안 스캔 차단 기준·배포 단계 순서·롤백 자동화·배포 승인·로그 중앙 수집 + GitHub Actions 워크플로 예시와 체크리스트. **파이프라인을 만들거나 고칠 때** `${CLAUDE_PLUGIN_ROOT}/skills/domain-devops-deployment-patterns/02-cicd-pipeline.md`를 Read한다.

### 3. 헬스 체크 & 준비성 검사 (Health Check & Readiness)

Liveness(`/livez`, 프로세스 생존만)와 Readiness(`/readyz`, 의존성 검사)의 분리 원칙 — liveness에 DB·외부 API를 넣는 안티패턴 포함 + 구현 예시, 쿠버네티스 probe 설정, 체크리스트. **헬스체크 엔드포인트나 probe를 구현·설정할 때** `${CLAUDE_PLUGIN_ROOT}/skills/domain-devops-deployment-patterns/03-health-check.md`를 Read한다.

### 4. 로깅 & 모니터링 (Logging & Observability)

구조화 JSON 로그·로그 레벨·요청 ID·중앙 로깅·메트릭 수집·알림 규칙·보존 기간·민감 데이터 마스킹 + Winston 로깅과 Prometheus 메트릭 예시, 체크리스트. **로깅·관측을 구성할 때** `${CLAUDE_PLUGIN_ROOT}/skills/domain-devops-deployment-patterns/04-logging-monitoring.md`를 Read한다.

### 5. 배포 전략 & 롤아웃 (Deployment Strategy)

Blue-Green/Canary/Rolling 선택 기준, 마이그레이션 검증·자동 롤백·배포 창·배포 후 5분 모니터링 + 쿠버네티스 RollingUpdate와 Flagger Canary 설정 예시, 체크리스트. **릴리스 방식을 정하거나 롤아웃·롤백을 설계할 때** `${CLAUDE_PLUGIN_ROOT}/skills/domain-devops-deployment-patterns/05-deployment-strategy.md`를 Read한다.

## 적용 체크리스트

### 이미지 빌드 시

- [ ] Dockerfile에 멀티스테이지 빌드 사용?
- [ ] 경량 베이스 이미지(alpine) 사용?
- [ ] .dockerignore 파일에 불필요한 파일 제외?
- [ ] 이미지 크기 목표 달성? (<100MB for Node.js)
- [ ] 컨테이너가 비root 사용자로 실행되는가?
- [ ] .env가 .gitignore에 포함되고 시크릿이 하드코딩되어 있지 않은가?

### CI/CD 파이프라인 설정

- [ ] 모든 커밋에 자동 테스트 실행?
- [ ] 보안 스캔 포함?
- [ ] 높은 심각도 이슈는 PR 병합 차단?
- [ ] 배포는 main 브랜치만?

### 배포 전

- [ ] 헬스 체크 엔드포인트 구현?
- [ ] 로깅/모니터링 설정?
- [ ] 롤백 계획 수립?
- [ ] 배포 승인 프로세스 검토?

### 배포 후

- [ ] 초기 5분 메트릭 모니터링?
- [ ] 에러율/응답시간 정상?
- [ ] 배포 이력 기록?

---

**참고**: 이 패턴은 Kubernetes 및 Docker 기반 환경을 가정합니다. 온프레미스/다른 플랫폼의 경우 조정이 필요합니다.
