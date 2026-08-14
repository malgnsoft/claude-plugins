# 맑은AI Knowledge Base

에이전트별 학습 자료 중앙 저장소. 각 에이전트 MD 파일에서 Read 도구로 참조합니다.

## 폴더 구조

| 폴더 | 대상 에이전트 | 내용 |
|------|-------------|------|
| `common/` | 전체 | 프로젝트 관리, 품질 검토 |
| `leadership/` | pm | 팀 구성 패턴, 파이프라인 관리 |
| `planning/` | planner, researcher | 요구사항 분석, 시장조사 |
| `design/` | ux-designer, visual-designer, security(마스킹 기준만) | UX 설계, 비주얼 디자인 시스템, 화면 개인정보 마스킹 기준 |
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
- `project-management.md` — STATUS.md 상태 추적 원칙(포맷 정본은 `skills/project-standards`), 품질 체크리스트, 리스크 관리, ADR
- `project-folder-structure.md` — 프로젝트 폴더 트리 표준(STATUS.md 단일 소스 기준)
- `verifiable-output-and-honesty.md` — 검증 가능한 산출물·정직 보고 원칙, 산출물 게이트, 자기검증/수령 검증 (전체 공통, 실행 체크리스트는 `skills/common-verifiable-output-and-honesty`)
- `beyond-mediocre-output.md` — 평범 vs 우수 산출물 판별 골격(5가지 냄새/4가지 표지/자가검증), 역할별 특화 연결 (전체 공통, evaluator 진단 잣대)
- `cross-validation-and-collaboration.md` — 상호 협력·교차검증 원칙: 결정 권한, 트리거 기반 의견 청취, 의견 충돌 처리 (전체 공통)
- `agent-common-principles.md` — 21개 에이전트 공통 원칙의 배경("왜")만 남음, 실행 체크리스트는 각 대응 skill 정본 참조
- `permission-policy-compliance.md` — 권한 정책 준수 배경(deny 규칙 우회 금지 사고사례), 실행 체크리스트는 `skills/common-permission-policy-compliance`
- `token-efficient-collaboration.md` — (본문은 `skills/common-token-efficient-collaboration`로 이관) 신설 배경만 남음
- `screen-reuse-consistency-verification.md` — 화면 재사용/재렌더 시 시각적 일관성 diff 절차 (설계→구현→리뷰 공통)
- `skill-vs-knowledge-boundary.md` — Skill/Knowledge 경계 판정 원칙의 배경·기원 자료(실무 정본은 방법론 rubric §1.1/§1.3/§2.2)

### review/
- `reviewer-personas.md` — (2026-07-23 핵심 절차는 `skills/reviewer-persona-panel-standard/SKILL.md`로 이관) 발산형 페르소나 배경, 선택 강화 패턴 A/B/C, 문서·설계서 다차수 검증 패턴 D~G
- `screenshot-capture-guide.md` — (2026-08-07 절차 본문은 `skills/common-screen-verification-and-capture`로 이관) 하드 게이트 원칙 + 상태별 캡처 체크리스트만 남음

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
- `agent-md-format-standard.md` — [폐기된 구버전 archive, 2026-08-07] 구 7섹션 포맷 — 참조 금지. MD 골격 정본은 `docs/methodology/agent-development-methodology.md` §3.1
- `agent-training-guide.md` — 에이전트 훈련 시스템 전체 가이드(9가지 훈련 모드, 스킬/경험 점수 체계, knowledge 관리 체계, 학습 이력 기록 절차)
- `autonomous-iteration-philosophy.md` — 자율 반복 상한(3~5회)·수확체감 우선 종료조건, 일일 토큰 예산 게이트와 한도 초과 시 대표 보고 절차 (`agents/pm.md` 실참조)
- `coo-rule-rationale.md` — PM 핵심 운영 규칙의 근거 모음(orchestrator 흡수, 집필 위임 원칙, 공유 가정 주입, 경로 릴레이 순차 위임) — 각 규칙이 유래한 실제 사고 사례 포함 (`agents/pm.md` 실참조)
- `progress-status-templates.md` — `progress.md`/`STATUS.md` 표준 템플릿, STATUS.md 비대화 방지 아카이빙·헤더 교체 규칙
- `judgment-independence-patterns.md` — 판정 독립성 설계 3요소(선기대치 자술/blind 판정/합격에만 서명) 참고 노트, 타 AI 조직 사례 재정리. evaluator 판정 체크리스트 개선 논의의 참고 자료(2026-08-13 djkim 노하우 접목, evaluator.md 자체는 미수정)

### planning/
- `requirements-analysis.md` — 요구사항 도출 프로세스, PRD 템플릿, 사용자 스토리
- `prd-craft-patterns.md` — 상용 수준 PRD 고급 기법 (분할 전략, FR-ID 추적성, 인수조건, 시나리오 6요소, 범위 경계 3중, 도메인 용어 사전). coaching 우수 사례 역추출
- `market-research.md` — TAM/SAM/SOM, Porter 5 Forces, SWOT, 기술 비교 기준
- `business-brief-patterns.md` — 전략 브리프 고급 기법 (벤치마킹 포지셔닝, 시장규모 현실 인식, 수익 산식, Why now, 해자 정당화, 리스크↔대응). coaching 우수 사례 역추출
- `twenty-questions-convergence.md` — 스무고개 수렴 기법: AI가 질문자가 되어 `(N/20)` 서술형 질문 1개씩 탐색→전환(전제 뒤집기 강제 1회)→수렴 진행. planner가 요구사항이 불명확한 상황(신규 브랜드/제품 기획 등)에서 참고 (2026-08-13 djkim 노하우 접목)

### design/
- `ux-design-guide.md` — 사용자 흐름, 와이어프레임 표기, IA, 인터랙션, 접근성
- `visual-design-system.md` — (2026-07-24 색상·타이포·간격·그림자·컴포넌트 스타일 + admin SaaS 토큰 패턴 본문은 `skills/visual-design-token-system/SKILL.md`로 이관) 배경·출처만 남음
- `html-style-guide/html-스타일가이드-가로형.html`, `html-스타일가이드-세로형.html` — 맑은소프트 HTML 문서/슬라이드 브랜드 스타일가이드 정본(2026-07~, CSS 토큰·클래스 어휘의 단일 소스). presenter/writer가 HTML/PDF 문서 제작 시 Read. 가로형=16:9 슬라이드, 세로형=A4 인쇄 문서. (2026-07-09 `claude-code-guide/docs/`에서 이전)
- (레퍼런스 벤치마킹 스크린샷 대조 표준은 knowledge가 아니라 skill로 이관됨 — `skills/reference-benchmarking-standard/SKILL.md`, 2026-07-23. frontend-dev/visual-designer/ux-designer 공용)
- `publishing-style-guide-template.md` — 퍼블리싱 스타일가이드 전역 기본 템플릿(버튼 3사이즈·테이블/카드 기본형·탭 2종), 프로젝트별로 값만 채움. frontend-dev 주 사용 (2026-07-23 합의)
- `personal-data-masking-standards.md` — 화면(UI) 단위 개인정보 마스킹 기준(이름/휴대폰/이메일/주민번호/계좌/카드/주소 필드별 노출 자릿수 수치), 마스킹 해제 정책, 화면 설계 체크리스트. security·ux-designer 공용 (2026-08-14 신설, djkim DOCS-화면설계서작성표준 §7 참고)

### architecture/
- `system-design-patterns.md` — (2026-07-24 C4모델·아키텍처패턴·REST API·데이터모델링·분산동기화 본문은 `skills/architecture-patterns-reference/SKILL.md`로 이관, 우수설계 7대기법 A~G는 기존 `skills/system-design-principles/SKILL.md`와 중복이라 이관 제외) 배경·출처만 남음
- `vue-zero-architecture.md` — vue-zero 플랫폼 **규칙 정본**(Composables 절대 금지, 페이지별 단일 `.vue` 파일, `utils.js` 중앙화+`window.*` 등록). `frontend/vue-zero-patterns.md`(패턴 상세)와 역할 분담, 모순 시 이 문서 우선(2026-08-07 확정). 실제 참조 대상은 frontend-dev(폴더는 architecture/이나 대상은 frontend — 물리적 이동은 별도 판단 필요, 감사보고서 merge_candidate 항목 참조)

### backend/
- `search-strategy-vector-vs-fulltext.md` — 벡터 검색 vs Full-text 검색 선택 기준(한글/다국어 쿼리 시 임베딩 모델 언어지원 전제조건, 하이브리드 지향, 데이터규모별 인덱스 재평가), kb-draft 375건 POC 실측 근거 (2026-07-27 신설, lesson `5b55dd67`/`8fda7853`)

### frontend/
- `vue-zero-patterns.md` — (2026-08-07 규칙 정본은 `architecture/vue-zero-architecture.md`로 확정, 이 문서는 패턴 상세만) Options API 컴포넌트 예시, API 연동, Bootstrap 5, 모달, 접근성, 범용 UX 교훈, malgnuniv/malgnsales/malgnhrd 실전 패턴

### quality/
- `testing-guide.md` — (2026-07-24 경계값분석·동등분할·상태전이 기법 + Vitest/E2E 패턴·보고서 형식·커버리지 함정 처방 본문은 `skills/software-test-design-techniques/SKILL.md`로 이관) 배경·출처만 남음
- `e2e-testing-guide.md` — E2E 테스트(Playwright Test) vs 즉석 화면 검증(`bin/capture.mjs`) 역할 구분, `templates/e2e-template/` 스캐폴드 복사 절차, 프로젝트별 브라우저 설치·인증 setup 가이드
- `intent-fit-vs-correctness-split.md` — "기획의도 부합성 vs 동작정확성" 축 분리 개념 노트. qa-engineer/reviewer가 검수 체크리스트를 짤 때 참고 (2026-08-13 djkim 노하우 접목)

### security/
- (OWASP Top 10 체크리스트는 knowledge가 아니라 skill로 분산 이관됨, 2026-08-07 — A01/A03→`skills/domain-backend-api-security` §1/§4, A02/A07/A09→`skills/domain-security-audit-checklist` §4/§5/§6, 인프라(Docker/환경변수)→`skills/domain-devops-deployment-patterns` §1, 심각도 CVSS 매핑→`agents/security.md` "핵심 원칙")
- (서버리스/엣지(Cloudflare Workers·Hono·D1·MCP) 스택 특화 점검 절차는 knowledge가 아니라 skill로 이관됨 — `skills/domain-serverless-edge-api-security/SKILL.md`, 2026-07-23. backend-dev/security 공용)

### devops/
- `docker-cloudflare-guide.md` — Dockerfile, docker-compose, Workers, CI/CD, 12-Factor
- (배포 전 로컬 검증 게이트는 knowledge가 아니라 skill로 이관됨 — `skills/pre-deployment-verification-gate/SKILL.md`, 2026-07-23)

### writing/
- `document-writing-guide.md` — 제안서/보고서/기술문서 구조, 톤 조절, Mermaid

### presentation/
- `slide-design-guide.md` — Marp 문법, 슬라이드 원칙, 테마, 스토리텔링
- `a4-document-fundamentals.md` — A4 세로형 문서 기술 배경(페이지 크기·여백·렌더 측정 원리)
- `horizontal-slide-filling-techniques.md` — 가로형(16:9) 슬라이드 콘텐츠 채움 기법(flex 균등확장, `justify-content:space-between` 지양, 스코프 클래스 단위 폰트 조정). `a4-document-fundamentals.md`(세로 인쇄물)와 역할 다름 (2026-08-14 신설, djkim doc-authoring 참고)
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
- PM이 프로젝트 완료 시 자동 생성
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

PM은 프로젝트 완료 시:
- `lessons/[프로젝트명].md`에 회고 기록
- 기존 knowledge 파일 보강이 필요하면 업데이트

## 학습 자료 추가 방법

1. 해당 폴더에 `.md` 파일 추가 — **신규 knowledge 문서는 파일 최상단(제목 바로 아래)에 `owner`(작성 에이전트 이름)와 `최종검토일`(YYYY-MM-DD) 메타 라인을 포함한다**(예: `> owner: trainer · 최종검토일: 2026-08-14`). 기존 49개 문서에는 이번에 일괄 소급 적용하지 않는다 — 2026-08-14 이후 신설되는 문서부터 점진 적용한다(djkim `knowledge-curator` 노하우 접목, 파일럿 5건: `leadership/judgment-independence-patterns.md`, `planning/twenty-questions-convergence.md`, `quality/intent-fit-vs-correctness-split.md`, `presentation/horizontal-slide-filling-techniques.md`, `design/personal-data-masking-standards.md`).
2. 이 README.md에 항목 추가
3. 관련 에이전트 MD의 `## 학습 자료` 섹션에 경로 추가
