# 2. CI/CD 파이프라인 (Pipeline Standards)

> Skill `domain-devops-deployment-patterns` §2의 본문이다. 색인(SKILL.md)의 §2 항목이 이 파일을 가리킨다.

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
