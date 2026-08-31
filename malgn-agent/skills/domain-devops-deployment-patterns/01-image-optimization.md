# 1. Docker 이미지 최적화 (Image Optimization)

> Skill `domain-devops-deployment-patterns` §1의 본문이다. 색인(SKILL.md)의 §1 항목이 이 파일을 가리킨다.

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
