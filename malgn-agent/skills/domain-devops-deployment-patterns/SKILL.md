---
name: domain-devops-deployment-patterns
description: 배포 표준 — Docker 이미지 최적화, CI/CD 파이프라인, 헬스체크, 로깅 규약. 배포·Docker·CI/CD·쿠버네티스·헬스체크·로깅·모니터링·릴리스 작업 시 사용.
---

# DevOps Deployment Patterns

프로덕션 배포와 운영을 위한 DevOps 표준 패턴입니다. 모든 서비스는 이 규칙을 따라 배포·운영되어야 합니다.

## 핵심 패턴

### 1. Docker 이미지 최적화 (Image Optimization)

**원칙**: 이미지 크기를 최소화하고, 보안 및 레이어 캐시 효율성을 극대화합니다.

**구현 규칙**:
- [ ] 멀티스테이지 빌드 사용 (빌드 도구 제거하여 크기 축소)
- [ ] 베이스 이미지는 경량 버전 사용 (alpine, distroless)
- [ ] 레이어 순서: 자주 변경되는 것을 맨 아래 (캐시 효율 극대화)
- [ ] 불필요한 파일(.git, node_modules, .env) 제외 (.dockerignore)
- [ ] RUN 명령어는 && 연결로 레이어 수 최소화
- [ ] 이미지 크기 목표: Node.js 앱 <100MB, Python 앱 <200MB
- [ ] 정기적 이미지 스캔 (취약점 검사)

**Dockerfile 예**:
```dockerfile
# ✅ 권장: 멀티스테이지 빌드
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --production && npm cache clean --force

FROM node:18-alpine
WORKDIR /app
# 런타임에 필요한 산출물만 builder에서 복사 (빌드 전용 파일·소스·devDeps는 가져오지 않음)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s CMD node /app/health-check.js
CMD ["node", "dist/index.js"]

# ❌ 피할 것: 모든 파일 포함
# COPY . .  # 빌드 도구, 소스 코드 포함 → 이미지 크기 증가
```

**체크리스트**:
- [ ] 베이스 이미지가 경량(alpine, distroless)인가?
- [ ] 멀티스테이지 빌드 사용하는가?
- [ ] .dockerignore 파일에 불필요한 파일 제외하는가?
- [ ] RUN 명령어가 레이어 수 최소화하는가?
- [ ] 이미지 크기가 목표 범위 내인가? (`docker images` 확인)

**보안 강화 체크리스트 (Infra Security)**:
- [ ] 컨테이너를 root 사용자로 실행하지 않는가? (`USER` 지시자로 비루트 사용자 지정)
- [ ] 불필요한 시스템 패키지가 포함되어 있지 않은가? (공격 표면 최소화)
- [ ] .dockerignore에 민감 파일(.env, 인증서, SSH 키, .git 등)이 포함되어 있는가?
- [ ] .env 파일이 .gitignore에 포함되어 커밋되지 않는가?
- [ ] 시크릿(API 키, DB 비밀번호 등)이 코드·Dockerfile·이미지 레이어에 하드코딩되어 있지 않은가? (Docker secrets, 런타임 환경변수 주입, Vault 등으로 대체)
- [ ] .env.example에는 실제 값이 아니라 설명/플레이스홀더만 있는가?

**비루트 실행 Dockerfile 예**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
  && chown -R appuser:appgroup /app
USER appuser   # root 대신 비루트 사용자로 실행 — 컨테이너 탈출 시 호스트 피해 최소화
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

### 2. CI/CD 파이프라인 (Pipeline Standards)

**원칙**: 자동화된 빌드·테스트·배포로 품질을 일관되게 유지하고, 인적 오류를 최소화합니다.

**구현 규칙**:
- [ ] 모든 커밋은 자동 테스트 실행 (단위 테스트, 통합 테스트)
- [ ] PR 병합 전 코드 리뷰 + 테스트 통과 필수
- [ ] 높은 심각도 보안 스캔 이슈는 PR 병합 차단
- [ ] 배포 단계: 빌드 → 테스트 → 보안 스캔 → 이미지 푸시 → 배포
- [ ] 롤백 계획 자동화 (배포 실패 시 이전 버전 복구)
- [ ] 배포 승인 프로세스 (main 브랜치만 프로덕션 배포)
- [ ] 배포 로그 중앙 수집 (ELK, CloudWatch 등)

**파이프라인 단계**:
```yaml
# .github/workflows/deploy.yml 예
name: CI/CD Pipeline
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install & Test
        run: npm ci && npm run test
      - name: Security Scan
        run: npm audit --audit-level=high
      - name: Build Image
        run: docker build -t app:${{ github.sha }} .
      - name: Push Image
        run: docker push app:${{ github.sha }}
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: kubectl set image deployment/app app=app:${{ github.sha }}
      - name: Wait for Rollout
        run: kubectl rollout status deployment/app
```

**체크리스트**:
- [ ] PR은 자동 테스트 통과해야 병합 가능한가?
- [ ] 보안 스캔이 CI/CD에 포함되는가?
- [ ] 배포는 main 브랜치만 허용하는가?
- [ ] 롤백 절차가 자동화되었는가?
- [ ] 배포 이력(언제, 누가, 어떤 버전)이 기록되는가?

---

### 3. 헬스 체크 & 준비성 검사 (Health Check & Readiness)

**원칙**: 서비스 가용성을 지속적으로 감시하고, 장애를 조기에 탐지합니다.

**구현 규칙**:
- [ ] Liveness Probe: **프로세스 생존만** 확인 (의존성 검사 금지) — `GET /livez`, 매 30초
- [ ] Readiness Probe: 트래픽 수신 가능한지 = **의존성 상태** 검사 — `GET /readyz`, 매 10초
- [ ] ⚠️ liveness에 DB·외부 API 검사를 넣지 말 것 — 의존성 일시 장애로 파드가 불필요하게 재시작되는 안티패턴(재시작해도 DB는 낫지 않는다)
- [ ] 응답 코드: 정상 200, 비정상 503
- [ ] 타임아웃: 헬스 체크 5초, 재시도 3회
- [ ] 메트릭 노출 (Prometheus 포맷) (선택사항)

**헬스 체크 구현 예**:
```javascript
// health.js
// liveness: 이벤트 루프가 응답하는지만 본다. 의존성을 건드리지 않는다.
export function liveness() {
  return { status: 'ok', uptime: process.uptime() };
}

// readiness: 트래픽을 받을 준비가 됐는지 = 의존성이 살아있는지 검사한다.
export async function readiness() {
  try {
    await db.query('SELECT 1');                                             // DB 연결 확인
    await fetch('https://api.example.com/health', { signal: AbortSignal.timeout(2000) }); // 외부 서비스(2초)
    return { status: 'ok' };
  } catch (err) {
    console.error('Readiness check failed:', err);
    return { status: 'error', error: err.message };
  }
}

// server.js
app.get('/livez', (req, res) => res.status(200).json(liveness()));          // 항상 가볍게 200
app.get('/readyz', async (req, res) => {
  const result = await readiness();
  res.status(result.status === 'ok' ? 200 : 503).json(result);
});
```

**쿠버네티스 설정**:
```yaml
# deployment.yaml
spec:
  containers:
  - name: app
    livenessProbe:            # 프로세스가 살아있나 → /livez (의존성 무관)
      httpGet:
        path: /livez
        port: 3000
      initialDelaySeconds: 10
      periodSeconds: 30
      timeoutSeconds: 5
      failureThreshold: 3
    readinessProbe:           # 트래픽 받을 준비 됐나 → /readyz (의존성 검사)
      httpGet:
        path: /readyz
        port: 3000
      initialDelaySeconds: 5
      periodSeconds: 10
      timeoutSeconds: 3
      failureThreshold: 2
```

**체크리스트**:
- [ ] 헬스 체크 엔드포인트 구현되었는가?
- [ ] DB/외부 서비스 상태 확인 로직 포함하는가?
- [ ] Liveness/Readiness 설정이 적절한가?
- [ ] 헬스 체크 응답 시간이 빠른가? (<1초)
- [ ] 모니터링에서 헬스 체크 실패 알림 설정되었는가?

---

### 4. 로깅 & 모니터링 (Logging & Observability)

**원칙**: 모든 로그와 메트릭을 중앙에서 수집·분석하여 문제를 조기에 탐지합니다.

**구현 규칙**:
- [ ] 구조화된 로그 (JSON 포맷)
- [ ] 로그 레벨: ERROR > WARN > INFO > DEBUG
- [ ] 모든 요청: 요청 ID, 사용자 ID, 지연시간 기록
- [ ] 에러 로그: 스택 트레이스, 컨텍스트 정보 포함
- [ ] 중앙 로깅: ELK (Elasticsearch, Logstash, Kibana) 또는 CloudWatch
- [ ] 메트릭 수집: CPU, 메모리, 응답시간, 에러율 (Prometheus)
- [ ] 알림 규칙: 에러율 >5%, 응답시간 >500ms, 디스크 용량 >80%
- [ ] 로그 보존: 최소 90일 (규제에 따라 1년 이상)
- [ ] 민감 데이터(토큰, 비밀번호) 마스킹

**로깅 예**:
```javascript
// logger.js (Winston 사용)
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// 요청 로깅 미들웨어
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || generateId();
  const start = Date.now();
  res.on('finish', () => {
    logger.info({
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      userId: req.user?.id,
      duration: Date.now() - start
    });
  });
  next();
});

// 에러 로깅
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(500).json({ error: 'Internal Server Error' });
});
```

**메트릭 수집 (Prometheus)**:
```javascript
import promClient from 'prom-client';

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status_code']
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    httpRequestDuration
      .labels(req.method, req.route?.path, res.statusCode)
      .observe(duration);
  });
  next();
});
```

**체크리스트**:
- [ ] 구조화된 JSON 로그 사용하는가?
- [ ] 중앙 로깅 시스템 구성되었는가?
- [ ] 메트릭 수집(Prometheus, Datadog 등) 설정되었는가?
- [ ] 알림 규칙(Slack, PagerDuty) 설정되었는가?
- [ ] 로그/메트릭 보존 정책 정의되었는가?
- [ ] 민감 데이터 마스킹 적용되었는가?

---

### 5. 배포 전략 & 롤아웃 (Deployment Strategy)

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
            path: /health
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
