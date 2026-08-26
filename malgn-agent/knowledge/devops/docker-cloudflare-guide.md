# Docker & Cloudflare 배포 가이드

## Dockerfile 멀티스테이지 패턴

### Node.js 앱
```dockerfile
# Build stage
FROM node:20-alpine AS builder
RUN corepack enable          # node 이미지에 pnpm이 깔려 있지 않다 — 없으면 `pnpm: not found`
WORKDIR /app
COPY package.json pnpm-lock.yaml ./   # `package*.json` 글롭은 pnpm-lock.yaml을 담지 못해 --frozen-lockfile이 실패한다
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/index.js"]
```

### 이미지 최적화 원칙
1. alpine 기반 이미지 사용
2. 멀티스테이지 빌드 (빌드 도구 제외)
3. .dockerignore로 불필요 파일 제외
4. 레이어 캐싱 활용 (package.json 먼저 COPY)
5. non-root 사용자로 실행

## docker-compose 패턴

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: mydb
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  db_data:
```

## Cloudflare Workers 배포

### wrangler.toml 구성
```toml
name = "my-app"
main = "src/index.js"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "xxx"

[vars]
ENVIRONMENT = "production"
```

### 배포 명령어
```bash
# 로컬 개발
pnpm dlx wrangler dev

# 배포
pnpm dlx wrangler deploy

# D1 마이그레이션
pnpm dlx wrangler d1 execute my-db --file=./schema.sql

# 시크릿 설정
pnpm dlx wrangler secret put API_KEY
```

### Workers 제약사항
- CPU 시간: 무료 10ms, 유료 30초
- 메모리: 128MB
- 번들 크기(압축 후): 무료 3MB, 유료 10MB
- D1(무료): 읽기 5백만 행/일, 쓰기 10만/일
- 서브리퀘스트: 50개/요청(무료), 10,000개/요청(유료)

> 수치는 Cloudflare가 예고 없이 상향/변경한다. 인용 전 공식 문서(`developers.cloudflare.com/workers/platform/limits/`, `developers.cloudflare.com/d1/platform/pricing/`) 원문을 열어 대조한다.

## CI/CD (GitHub Actions)

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: pnpm install --frozen-lockfile
      - run: pnpm test
      - run: pnpm dlx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CF_API_TOKEN }}
```

## .env 관리

### .env.example 형식
```bash
# 데이터베이스
DATABASE_URL=          # PostgreSQL 연결 문자열

# 인증
JWT_SECRET=            # JWT 서명 키 (최소 32자)
SESSION_SECRET=        # 세션 암호화 키

# 외부 서비스
API_KEY=               # 외부 API 키
```

### 12-Factor App 원칙
1. 설정을 환경변수로 관리
2. 코드와 설정을 분리
3. 환경별 설정 파일 (dev/staging/prod)
4. 시크릿은 절대 코드에 포함하지 않음

---

## Cloudflare Workers/D1 운영 방법론 (실전 — malgnai 런북에서 추출)

> 위 §"Cloudflare Workers 배포"는 명령어 나열이라 happy path에 그친다. 실제 배포·운영에서 사고가 나는 지점은 아래 운영 패턴이다. (사례 근거: malgnai 프로젝트 — Hono + Workers + D1 + ASSETS, 제로빌드)

### 1. 배포 전 반드시 확인할 4대 함정
- **`database_id`가 placeholder인지 확인.** `"local"`/`"xxx"` 같은 값이면 `wrangler dev`는 되지만 `wrangler deploy`해도 **원격 D1에 안 붙는다**. 최초 1회 `wrangler d1 create <db>` → 출력 UUID로 교체.
- **빌드 산출물 생성 단계(scan/build)가 배포에 선행하는지.** 제로빌드(vue-zero 등)는 레지스트리 갱신 스크립트(`pnpm run scan`)가 라우트/컴포넌트 인덱스를 만든다. 누락하면 라우트 빠진 채 배포됨. CI에도 이 단계를 넣을 것.
- **ASSETS 바인딩 + SPA fallback 경로.** `assets = { directory, binding }` + 마지막 핸들러의 404→index.html 폴백을 확인. 정적자산 깨짐의 원인.
- **Workers Builds(GitHub 연동 CI)가 활성화돼 있는지.** 활성화된 프로젝트는 `git push`(대상 브랜치)가 곧 배포 트리거다 — "로컬/브랜치 작업이라 안전"이라고 가정하지 말고, push 전 대시보드에서 어느 브랜치가 Builds에 연결돼 있는지 확인한다.

### 2. D1 스키마 적용 — 두 가지 패턴과 트레이드오프
| 패턴 | 방식 | 장점 | 함정 |
|---|---|---|---|
| **wrangler 마이그레이션** | `migrations_dir` + `.sql` + `d1 migrations apply` | 버전 추적, 롤백 이력 | 파일 관리 오버헤드 |
| **런타임 멱등 스키마** | 요청 시 `ensureSchema()`로 `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN` (malgnai 방식) | 마이그 파일 0개, 코드와 동기 | ① **첫 요청이 곧 마이그레이션**(배포 후 헬스체크로 워밍업 필수) ② try/catch가 에러를 삼켜 오타도 조용히 무시 → 로컬 빈 DB로 먼저 검증 ③ **ADD COLUMN만 가능**, 컬럼 삭제·타입변경·NOT NULL 추가는 불가(D1엔 DROP COLUMN 제약) |

런타임 스키마 디버깅:
```bash
wrangler d1 execute <db> --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
wrangler d1 execute <db> --remote --command "PRAGMA table_info(<table>)"   # 마이그 적용 확인
```

### 3. 헬스체크/관측 — Workers엔 /health가 기본 없다
- **실질 헬스 신호 = 핵심 엔드포인트 curl**: 정적(`GET /`→HTML), API(`GET /api/<요약>`→JSON, D1 읽기까지 검증), MCP/특수엔드포인트. API 200이면 런타임 스키마가 깔렸다는 신호이기도 함.
- **권장: D1 미의존 `/health` 엔드포인트를 스키마 미들웨어 *앞에* 추가.** 업타임 모니터가 매번 DB를 깨우지 않고 워커 생존만 체크(비용 1줄, 효과 명확).
- `wrangler tail <worker>` / `--status error`로 실시간 로그. 대시보드 Metrics(에러율·CPU·p99), D1(쿼리·행수·스토리지).

### 4. 롤백 — 이미지 태그가 없으므로 "이전 배포 재활성화"
- **코드 롤백(최우선·수 초)**: 대시보드 → Workers → Deployments → 직전 정상본 **Rollback**. 빌드 불필요, 가장 안전.
- 코드 경로: 직전 정상 커밋 체크아웃 → scan → deploy.
- **데이터 롤백(느림·위험)**: 런타임 스키마는 자동 롤백 안 됨(잘못 ADD된 컬럼은 남음). 절차 = ① 즉시 코드 롤백으로 출혈 정지 → ② `init.js`의 문제 마이그 제거/수정 후 재배포 → ③ 데이터 오염 시 `wrangler d1 export`(사전 백업)에서 복원. **파괴적 D1 변경 전엔 무조건 `d1 export` 백업.**
- **장애 분류표**: `/`만 깨짐→ASSETS/scan, `/api/*` 전부 500→ensureSchema/database_id, 일부만→특정 DAO, 첫 요청만 느림→콜드스타트+batch(정상).
- **롤백 후 시크릿 조작 금지(롤백 무효화 함정).** 코드 롤백(대시보드 Rollback 또는 `wrangler rollback`)으로 이전 배포를 되돌린 뒤 `wrangler secret put` 등 시크릿을 변경하면, 플랫폼이 롤백된 배포가 아니라 **로컬(최신) 소스로 재빌드해 재배포**한다 — 방금 롤백으로 치운 버그 있는 코드가 그대로 다시 나간다. 롤백 직후 시크릿 변경이 필요하면 먼저 코드를 롤백 대상 커밋으로 되돌린 뒤 시크릿을 만진다.

### 5. 시크릿/CI
- 시크릿은 `wrangler secret put`(프롬프트 입력 → 터미널 히스토리 안 남음), 코드에서 `c.env.X`. **`wrangler.toml`/`[vars]`엔 평문 금지**(git 커밋됨). 비밀 아닌 값만 `[vars]`.
- CI(GitHub Actions): `pnpm install --frozen-lockfile` → **scan/build** → test → `wrangler deploy`. 시크릿은 `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`를 GitHub Secrets로. **첫 배포 전 원격 D1 생성·`database_id` 교체가 선행돼야 CI 성공.**

> 사례 런북: malgnai 프로젝트의 배포 런북(그 프로젝트 실제 값 기반).

### 6. 로컬 DB 연결 — Hyperdrive local mode 우선 검토 (malgnuniv 사례)
- **`cloudflare:sockets` 직접 연결로 로컬 MySQL 등에 붙지 말 것.** 공식문서 명시 리스크: localhost 접속이 차단될 수 있다.
- **대안(공식 지원): Hyperdrive `localConnectionString`.** `wrangler.toml`에 실제 Cloudflare Hyperdrive 리소스를 만들지 않고도 로컬 개발용 연결 문자열을 지정할 수 있다:
  ```toml
  [[hyperdrive]]
  binding = "HYPERDRIVE"
  id = "local-placeholder"
  localConnectionString = "mysql://user:pass@localhost:3306/mydb"
  ```
- 코드는 `env.HYPERDRIVE.connectionString`만 참조하므로, 나중에 실제 Hyperdrive 리소스를 생성해 `id`만 교체하면 코드 변경 없이 원격 전환 가능.
- **mysql2 사용 시 필수 조건**: v3.13.0 이상 + `disableEval: true` 옵션.
