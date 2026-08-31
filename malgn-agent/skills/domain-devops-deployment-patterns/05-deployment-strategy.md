# 5. 배포 전략 & 롤아웃 (Deployment Strategy)

> Skill `domain-devops-deployment-patterns` §5의 본문이다. 색인(SKILL.md)의 §5 항목이 이 파일을 가리킨다.

**원칙**: 무중단 배포로 서비스 가용성을 유지하고, 장애 시 빠른 롤백이 가능하게 합니다.

**배포 전략**:
- **Blue-Green**: 이전 버전(Blue)과 신규 버전(Green) 병행 운영 후 트래픽 전환
- **Canary**: 신규 버전으로 소수 트래픽(5~10%)만 먼저 전환하여 검증 후 확대
- **Rolling**: 순차적으로 팟 업데이트 (다운타임 없음)

**구현 규칙**:
- [ ] 기본 배포 전략: Rolling (다운타임 없음)
- [ ] 고위험 배포: Canary (작은 규모로 먼저 배포)
- [ ] 배포 전: 데이터베이스 마이그레이션 검증
- [ ] 롤백 자동화: 헬스 체크 실패 시 자동 롤백
- [ ] 배포 승인: 보안/운영 담당자 검토 필수
- [ ] 배포 창(Deployment Window): 업무 시간 외 배포 (또는 사전 공지)
- [ ] 배포 후 검증: 초기 5분 메트릭 모니터링

**쿠버네티스 Rolling 배포 예**:
```yaml
# deployment.yaml
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1       # 추가 팟 최대 1개
      maxUnavailable: 0 # 비활성 팟 최소 0개 (무중단)
  template:
    spec:
      containers:
      - name: app
        image: app:v1.2.3
        livenessProbe:
          httpGet:
            path: /livez
            port: 3000
          failureThreshold: 3
```

**Canary 배포 (Flagger 사용)**:
```yaml
apiVersion: flagger.app/v1beta1
kind: Canary
metadata:
  name: app
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: app
  service:
    port: 80
  progressDeadlineSeconds: 300
  analysis:
    interval: 1m
    threshold: 5           # 분석 실패 허용 횟수(초과 시 롤백)
    maxWeight: 50          # 카나리로 보낼 최대 트래픽 비중(%)
    stepWeight: 10         # 매 interval마다 올리는 트래픽 증가폭(%) → 10,20,30,40,50 후 승격
    metrics:
    - name: error-rate
      thresholdRange:
        max: 1
      interval: 1m
    - name: latency
      thresholdRange:
        max: 500
      interval: 1m
  skipAnalysis: false
```
> 가중치 증가는 Flagger에서 별도 `stages:` 필드가 아니라 `analysis.stepWeight`(+`stepWeights`로 불균등 단계도 가능)/`maxWeight`로 표현한다.

**체크리스트**:
- [ ] 배포 전략이 정의되었는가? (Rolling, Canary 등)
- [ ] 자동 롤백 조건이 설정되었는가?
- [ ] 데이터베이스 마이그레이션 검증 프로세스 있는가?
- [ ] 배포 후 모니터링 기간 정의되었는가?
- [ ] 롤백 테스트를 정기적으로 실시하는가?
