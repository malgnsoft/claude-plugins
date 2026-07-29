# 맑은AI Knowledge Base

에이전트별 학습 자료 중앙 저장소. 각 에이전트 MD 파일에서 Read 도구로 참조합니다.

## 폴더 구조

| 폴더 | 대상 에이전트 | 내용 |
|------|-------------|------|
| `common/` | 전체 | 프로젝트 관리, 품질 검토 |
| `leadership/` | coo, orchestrator | 팀 구성 패턴, 파이프라인 관리 |
| `planning/` | planner, researcher | 요구사항 분석, 시장조사 |
| `design/` | ux-designer, visual-designer | UX 설계, 비주얼 디자인 시스템 |
| `architecture/` | architect | 시스템 설계 패턴, API 설계 |
| `backend/` | backend-dev | Hono/D1 구현 패턴, DAO |
| `frontend/` | frontend-dev | vue-zero 패턴, Bootstrap 5 |
| `quality/` | qa-engineer | 테스트 설계, Vitest 패턴 |
| `review/` | reviewer | 페르소나 6대 요소, 패널 운영, 재사용 페르소나 자산 |
| `proposal/` | rfp-analyst, capture-strategist, writer, reviewer | 제안/입찰 방법론(Shipley), 공공조달 실무, Compliance Matrix, 제안 집필 원칙 |
| `security/` | security | OWASP Top 10, 보안 체크리스트 |
| `devops/` | devops | Docker, Cloudflare, CI/CD |
| `writing/` | writer | 문서 작성 가이드 |
| `presentation/` | presenter | Marp, 슬라이드 설계 |
| `marketing/` | marketer | 마케팅 전략(STP/4P), 퍼널, 디지털 광고 채널(구글·네이버) |
| `finance/` | finance | 예산·수익성·재무 모델링, 투자 검토(NPV/IRR) |
| `localization/` | localizer | 직역 금지·관용구 판단법, 로케일별 관용 차이, 레퍼런스 제품 대조법 |

## 파일 목록

### common/
- `project-management.md` — progress.md 표준, 품질 체크리스트, 리스크 관리, ADR
- `verifiable-output-and-honesty.md` — 검증 가능한 산출물·정직 보고 원칙, 산출물 게이트, 자기검증/수령 검증 (전체 공통)
- `beyond-mediocre-output.md` — 평범 vs 우수 산출물 판별 골격(5가지 냄새/4가지 표지/자가검증), 역할별 특화 연결 (전체 공통, trainer 모드 7 진단 잣대)
- `cross-validation-and-collaboration.md` — 상호 협력·교차검증 원칙: 결정 권한(최상위 사용자/최종 COO), 트리거 기반 의견 청취, 의견 충돌 처리 (전체 공통)

### review/
- `reviewer-personas.md` — (2026-07-23 핵심 절차는 `skills/reviewer-persona-panel-standard/SKILL.md`로 이관) 발산형 페르소나 배경, 선택 강화 패턴 A/B/C, 문서·설계서 다차수 검증 패턴 D~G
- `screenshot-capture-guide.md` — 화면 캡처 표준(Playwright), capture-all.js 템플릿, 캡처 상태 체크리스트

### proposal/
- `shipley-proposal-process.md` — (2026-07-24 라이프사이클·Bid/No-Bid·Win Theme/Discriminator/Ghosting·Storyboard·컬러팀 리뷰 본문은 `skills/shipley-proposal-methodology/SKILL.md`로 이관) 배경·출처만 남음
- `korea-public-procurement.md` — 나라장터/조달청, 협상에 의한 계약, 기술:가격 배점·과락, 평가표 구조, **실격·감점 요인**, 필수서류·봉투분리·예가, 사업수행계획서 구성
- `compliance-matrix-template.md` — (2026-07-23 표·작성법·체크리스트 본문은 `skills/compliance-matrix-template/SKILL.md`로 이관) 배경·출처만 남음
- `proposal-writing-principles.md` — 평가자 관점 집필(claim-proof, Action Caption, 평가항목별 증거 정렬), Executive Summary, 공공 사업수행계획서 vs 기업 ROI 제안

### leadership/
- `team-composition-patterns.md` — 업무 유형별 팀 구성, 위임 모델, 복합 요청 처리, Goal Drift 방지
- `pipeline-management.md` — 5단계 파이프라인 체크포인트, 전환 조건, 병목 식별
- `risk-escalation-guide.md` — 리스크 식별 체크리스트, 4가지 대응 전략, 에스컬레이션 기준/형식
- `reporting-integration-guide.md` — 산출물 통합 절차, 최종/중간 보고 템플릿, RAG 상태, 2분 규칙
- `retrospective-framework.md` — Start/Stop/Continue + SWOT 회고, 교훈 문서화, 에이전트 성과 추적

### planning/
- `requirements-analysis.md` — 요구사항 도출 프로세스, PRD 템플릿, 사용자 스토리
- `prd-craft-patterns.md` — 상용 수준 PRD 고급 기법 (분할 전략, FR-ID 추적성, 인수조건, 시나리오 6요소, 범위 경계 3중, 도메인 용어 사전). coaching 우수 사례 역추출
- `market-research.md` — TAM/SAM/SOM, Porter 5 Forces, SWOT, 기술 비교 기준
- `business-brief-patterns.md` — 전략 브리프 고급 기법 (벤치마킹 포지셔닝, 시장규모 현실 인식, 수익 산식, Why now, 해자 정당화, 리스크↔대응). coaching 우수 사례 역추출

### design/
- `ux-design-guide.md` — 사용자 흐름, 와이어프레임 표기, IA, 인터랙션, 접근성
- `visual-design-system.md` — (2026-07-24 색상·타이포·간격·그림자·컴포넌트 스타일 + admin SaaS 토큰 패턴 본문은 `skills/visual-design-token-system/SKILL.md`로 이관) 배경·출처만 남음
- `html-style-guide/html-스타일가이드-가로형.html`, `html-스타일가이드-세로형.html` — 맑은소프트 HTML 문서/슬라이드 브랜드 스타일가이드 정본(2026-07~, CSS 토큰·클래스 어휘의 단일 소스). presenter/writer가 HTML/PDF 문서 제작 시 Read. 가로형=16:9 슬라이드, 세로형=A4 인쇄 문서. (2026-07-09 `claude-code-guide/docs/`에서 이전)
- (레퍼런스 벤치마킹 스크린샷 대조 표준은 knowledge가 아니라 skill로 이관됨 — `skills/reference-benchmarking-standard/SKILL.md`, 2026-07-23. frontend-dev/visual-designer/ux-designer 공용)
- `publishing-style-guide-template.md` — 퍼블리싱 스타일가이드 전역 기본 템플릿(버튼 3사이즈·테이블/카드 기본형·탭 2종), 프로젝트별로 값만 채움. frontend-dev 주 사용 (2026-07-23 합의)

### architecture/
- `system-design-patterns.md` — (2026-07-24 C4모델·아키텍처패턴·REST API·데이터모델링·분산동기화 본문은 `skills/architecture-patterns-reference/SKILL.md`로 이관, 우수설계 7대기법 A~G는 기존 `skills/system-design-principles/SKILL.md`와 중복이라 이관 제외) 배경·출처만 남음

### backend/
- `api-implementation-patterns.md` — (2026-07-24 Hono/D1/에러처리/JWT·RBAC 기본패턴 + Route→Service→DAO 계층분리·실서비스 검증패턴 본문은 `skills/backend-api-implementation-patterns/SKILL.md`로 이관) 배경·출처만 남음
- `search-strategy-vector-vs-fulltext.md` — 벡터 검색 vs Full-text 검색 선택 기준(한글/다국어 쿼리 시 임베딩 모델 언어지원 전제조건, 하이브리드 지향, 데이터규모별 인덱스 재평가), kb-draft 375건 POC 실측 근거 (2026-07-27 신설, lesson `5b55dd67`/`8fda7853`)

### frontend/
- `vue-zero-patterns.md` — Options API, API 연동, Bootstrap 5, 모달, 접근성

### quality/
- `testing-guide.md` — (2026-07-24 경계값분석·동등분할·상태전이 기법 + Vitest/E2E 패턴·보고서 형식·커버리지 함정 처방 본문은 `skills/software-test-design-techniques/SKILL.md`로 이관) 배경·출처만 남음

### security/
- `owasp-security-checklist.md` — OWASP Top 10, 방어 코드, 심각도 기준, 인프라 보안
- (서버리스/엣지(Cloudflare Workers·Hono·D1·MCP) 스택 특화 점검 절차는 knowledge가 아니라 skill로 이관됨 — `skills/domain-serverless-edge-api-security/SKILL.md`, 2026-07-23. backend-dev/security 공용)

### devops/
- `docker-cloudflare-guide.md` — Dockerfile, docker-compose, Workers, CI/CD, 12-Factor
- (배포 전 로컬 검증 게이트는 knowledge가 아니라 skill로 이관됨 — `skills/pre-deployment-verification-gate/SKILL.md`, 2026-07-23)

### writing/
- `document-writing-guide.md` — 제안서/보고서/기술문서 구조, 톤 조절, Mermaid

### presentation/
- `slide-design-guide.md` — Marp 문법, 슬라이드 원칙, 테마, 스토리텔링
- `a4-document-fundamentals.md` — A4 세로형 문서 기술 배경(페이지 크기·여백·렌더 측정 원리)
- (A4 세로형 단계별 절차서는 knowledge가 아니라 skill로 이관됨 — `skills/a4-vertical-layout/SKILL.md`, 2026-07-23)

### marketing/
- `marketing-strategy-guide.md` — STP/4P, 퍼널(AARRR), 채널 믹스(PESO), 캠페인 기획 절차, KPI/ROAS 산식, 마케팅 보고서 구조
- `digital-ad-channels.md` — Google Ads/GA4/SEO, 네이버 검색광고·스마트스토어·블로그/플레이스 구조·과금·연동(API/태그), 실행 계획서 템플릿, 집행 승인 게이트

### finance/
- `financial-analysis-guide.md` — 예산 추정, BEP/ROI/NPV/IRR 산식과 예시, 단위경제(LTV/CAC), 민감도 분석, 가정 명시 원칙, 재무 보고서 구조
- `financial-model-templates.md` — 가정 표, 추정 P&L·현금흐름 템플릿, 런웨이, 시나리오 요약, 모델링 체크리스트

### localization/
- `i18n-terminology-audit-guide.md` — 직역 금지·관용구 우선 판단법, 레퍼런스 제품 대조법, 로케일별 관용 차이, 용어 감사 절차, 용어집 관리 (localizer.md 본문 원칙을 압축·구조화, 2026-07-24 신설)

### lessons/
- 프로젝트 완료 후 회고 교훈이 축적되는 폴더
- COO가 프로젝트 완료 시 자동 생성
- 형식: `[프로젝트명].md` — 잘 된 점, 개선할 점, 새로 배운 것

## 학습 루프

```
프로젝트 시작 → lessons/ 확인 → 작업 수행 → 완료 → 회고 → knowledge 업데이트
                  ↑                                              │
                  └──────────────────────────────────────────────┘
```

모든 에이전트는:
- **작업 전**: `lessons/` 폴더에서 관련 프로젝트 교훈을 확인
- **작업 후**: 새로 배운 패턴이나 실수를 knowledge에 기록

COO는 프로젝트 완료 시:
- `lessons/[프로젝트명].md`에 회고 기록
- 기존 knowledge 파일 보강이 필요하면 업데이트

## 학습 자료 추가 방법

1. 해당 폴더에 `.md` 파일 추가
2. 이 README.md에 항목 추가
3. 관련 에이전트 MD의 `## 학습 자료` 섹션에 경로 추가
