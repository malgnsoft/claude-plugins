# 3. 헬스 체크 & 준비성 검사 (Health Check & Readiness)

> Skill `domain-devops-deployment-patterns` §3의 본문이다. 색인(SKILL.md)의 §3 항목이 이 파일을 가리킨다.

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
