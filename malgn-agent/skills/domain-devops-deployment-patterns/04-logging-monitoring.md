# 4. 로깅 & 모니터링 (Logging & Observability)

> Skill `domain-devops-deployment-patterns` §4의 본문이다. 색인(SKILL.md)의 §4 항목이 이 파일을 가리킨다.

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
