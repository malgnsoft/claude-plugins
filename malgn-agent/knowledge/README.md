# 맑은AI Knowledge Base

에이전트별 학습 자료 중앙 저장소. 각 에이전트 MD 파일에서 Read 도구로 참조합니다.

**참조 경로 규약**: 이 폴더는 설치된 플러그인 안에 있고, 에이전트는 대개 사용자 프로젝트를 cwd로 돕니다. 그래서 에이전트·스킬 본문에서 여기 파일을 가리킬 때는 맨 상대경로(`knowledge/...`)가 아니라 **플러그인 루트 변수를 앞에 붙인 형태**로 적습니다 — 맨이름 CLAUDE_PLUGIN_ROOT를 달러+중괄호로 감싸 `knowledge/<도메인>/<파일>` 앞에 둡니다. 정본 규약과 예외(소스 clone을 고치는 경우 등)는 `skills/common-output-storage-and-path-management` §1-2에 있습니다. 단, **이 폴더 안의 문서에서는 그 변수가 치환되지 않으므로**(knowledge 파일은 플러그인 컴포넌트로 로드되지 않습니다) 여기서는 "플러그인 루트 기준 `knowledge/...`"처럼 말로 적습니다.

## 폴더 구조

| 폴더 | 대상 에이전트 | 내용 |
|------|-------------|------|
| `common/` | 전체 | 정직 보고, 산출물 품질, 교차검증 |
| `leadership/` | pm, trainer | 팀 구성 패턴, 리스크·에스컬레이션, 보고 통합, 에이전트 훈련 가이드 |
| `planning/` | planner, researcher | 요구사항 분석, 시장조사 |
| `design/` | ux-designer, visual-designer, security(마스킹 기준만) | UX 설계, HTML 브랜드 스타일가이드, 퍼블리싱 스타일가이드 템플릿, 화면 개인정보 마스킹 기준 |
| `architecture/` | architect | 시스템 설계 패턴, API 설계 |
| `backend/` | backend-dev | Hono/D1 구현 패턴, DAO |
| `frontend/` | frontend-dev | vue-zero 패턴, Bootstrap 5 |
| `quality/` | qa-engineer | 테스트 설계, Vitest 패턴 |
| `review/` | reviewer | 발산형 페르소나 배경, 다차수 검증 심화 패턴 |
| `proposal/` | rfp-analyst, capture-strategist, writer, reviewer | 제안/입찰 방법론(Shipley), 공공조달 실무, Compliance Matrix, 제안 집필 원칙 |
| `devops/` | devops | Docker, Cloudflare, CI/CD |
| `writing/` | writer | 문서 작성 가이드 |
| `presentation/` | presenter | Marp, 슬라이드 설계 |
| `marketing/` | marketer | 마케팅 전략(STP/4P), 퍼널, 디지털 광고 채널(구글·네이버) |
| `finance/` | finance | 예산·수익성·재무 모델링, 투자 검토(NPV/IRR) |
| `localization/` | localizer | 직역 금지·관용구 판단법, 로케일별 관용 차이, 레퍼런스 제품 대조법 |

## 파일 목록

### common/
- `verifiable-output-and-honesty.md` — 검증 가능한 산출물·정직 보고 원칙, 산출물 게이트, 자기검증/수령 검증 (전체 공통, 실행 체크리스트는 `skills/common-verifiable-output-and-honesty`)
- `beyond-mediocre-output.md` — 평범 vs 우수 산출물 판별 골격(5가지 냄새/4가지 표지/자가검증), 역할별 특화 연결 (전체 공통, evaluator 진단 잣대)
- `cross-validation-and-collaboration.md` — 상호 협력·교차검증 원칙: 결정 권한, 트리거 기반 의견 청취, 의견 충돌 처리 (전체 공통, `agents/pm.md` 실참조)
- `agent-common-principles.md` — 에이전트 MD가 자기 "핵심 원칙" 첫 줄에서 참조하는 공통 원칙의 배경("왜")만 남음, 실행 체크리스트는 각 대응 skill 정본 참조
- (권한 정책 준수 — 우회 판별 기준·반례·판별 질문·행동 순서 전부 `skills/common-permission-policy-compliance/SKILL.md`가 정본)
- `screen-reuse-consistency-verification.md` — 화면 재사용/재렌더 시 시각적 일관성 diff 절차 (설계→구현→리뷰 공통)

### review/
- `reviewer-personas.md` — (절차 본문 정본은 `skills/reviewer-persona-panel-standard/SKILL.md`) 발산형 페르소나를 강제하는 배경, 선택 강화 패턴 A/B/C, 문서·설계서 다차수 검증 패턴 D~G만 남음
- (스크린샷 캡처 — 하드 게이트 원칙·캡처 절차·CLI 플래그·상태별 체크리스트 전부 `skills/common-screen-verification-and-capture/SKILL.md`가 정본)

### proposal/
- (Shipley 라이프사이클·Bid/No-Bid·Win Theme/Discriminator/Ghosting·Storyboard·컬러팀 리뷰 정본은 knowledge가 아니라 `skills/domain-shipley-proposal-methodology/SKILL.md`. 출처 표기도 그 스킬 안에 있다)
- `korea-public-procurement.md` — 나라장터/조달청, 협상에 의한 계약, 기술:가격 배점·과락, 평가표 구조, **실격·감점 요인**, 필수서류·봉투분리·예가, 사업수행계획서 구성
- (Compliance Matrix 표·작성법·실격방지 체크리스트 정본은 knowledge가 아니라 `skills/domain-compliance-matrix-template/SKILL.md`)
- `proposal-writing-principles.md` — 평가자 관점 집필(claim-proof, Action Caption, 평가항목별 증거 정렬), Executive Summary, 공공 사업수행계획서 vs 기업 ROI 제안

### leadership/
- `team-composition-patterns.md` — 업무 유형별 팀 구성, 위임 모델, 복합 요청 처리, Goal Drift 방지
- `risk-escalation-guide.md` — 리스크 식별 체크리스트, 4가지 대응 전략(회피/완화/전가/수용), 에스컬레이션 기준/형식 (`agents/pm.md` 실참조)
- `reporting-integration-guide.md` — 산출물 통합 절차, 최종 보고 템플릿, RAG 상태, 2분 규칙 (`agents/pm.md` 실참조)
- `retrospective-framework.md` — Start/Stop/Continue + SWOT 회고, 교훈 문서화, 에이전트 성과 추적
- `agent-training-guide.md` — 에이전트 훈련 시스템의 배경·철학, MD 표준 포맷, 스킬/경험 점수 체계, knowledge 관리 체계, 학습 이력 기록 절차. 에이전트 MD 골격 정본은 이 문서 §2.2의 9단 골격이다(부록은 요약). 모드별 실행 절차는 담지 않고 정본 스킬만 가리킨다 (`agents/trainer.md` 실참조)
- `autonomous-iteration-philosophy.md` — 자율 반복 상한(3~5회)·수확체감 우선 종료조건, 일일 토큰 예산 게이트와 한도 초과 시 대표 보고 절차 (`agents/pm.md` 실참조)
- `coo-rule-rationale.md` — PM 핵심 운영 규칙의 근거 모음(orchestrator 흡수, 집필 위임 원칙, 공유 가정 주입, 경로 릴레이 순차 위임) — 각 규칙이 유래한 실제 사고 사례 포함 (`agents/pm.md` 실참조)
- (STATUS.md 표준 포맷·크기 상한·아카이빙·헤더 교체 규칙 정본은 knowledge가 아니라 `skills/project-standards` §3)
- `judgment-independence-patterns.md` — 판정 독립성 설계 3요소(선기대치 자술/blind 판정/합격에만 서명) 참고 노트, 타 AI 조직 사례 재정리. evaluator 판정 체크리스트를 설계·보강할 때 참고
- `pm-verification-field-notes.md` — PM이 보고와 실물을 직접 대조할 때 검증이 헛도는 함정 모음(로그인 성공의 정의, 보고서 curl 예시 재사용, 인증 API 검증 수단 선택, 개발서버 포트 충돌, 로그 반복 에러 오탐, 점수의 측정 스코프) (`agents/pm.md` 실참조)

### planning/
- `requirements-analysis.md` — 요구사항 도출 프로세스, PRD 템플릿, 사용자 스토리
- `prd-craft-patterns.md` — 상용 수준 PRD 고급 기법 (분할 전략, FR-ID 추적성, 인수조건, 시나리오 6요소, 범위 경계 3중, 도메인 용어 사전). coaching 우수 사례 역추출
- `market-research.md` — TAM/SAM/SOM, Porter 5 Forces, SWOT, 기술 비교 기준
- `business-brief-patterns.md` — 전략 브리프 고급 기법 (벤치마킹 포지셔닝, 시장규모 현실 인식, 수익 산식, Why now, 해자 정당화, 리스크↔대응). coaching 우수 사례 역추출
- `twenty-questions-convergence.md` — 스무고개 수렴 기법: AI가 질문자가 되어 `(N/20)` 서술형 질문 1개씩 탐색→전환(전제 뒤집기 강제 1회)→수렴 진행. planner가 요구사항이 불명확한 상황(신규 브랜드/제품 기획 등)에서 참고 (`agents/planner.md` 실참조)

### design/
- `ux-design-guide.md` — 사용자 흐름, 와이어프레임 표기, IA, 인터랙션, 접근성
- (색상·타이포·간격·그림자·컴포넌트 스타일 + admin SaaS 토큰 패턴 정본은 knowledge가 아니라 `skills/domain-visual-design-token-system/SKILL.md`)
- `html-style-guide/html-스타일가이드-가로형.html`, `html-스타일가이드-세로형.html` — 맑은소프트 HTML 문서/슬라이드 브랜드 스타일가이드 정본(CSS 토큰·클래스 어휘의 단일 소스). presenter/writer가 HTML/PDF 문서 제작 시 Read. 가로형=16:9 슬라이드, 세로형=A4 인쇄 문서.
- (레퍼런스 벤치마킹 스크린샷 대조 표준 정본은 knowledge가 아니라 `skills/domain-reference-benchmarking-standard/SKILL.md`. frontend-dev/visual-designer/ux-designer 공용)
- `publishing-style-guide-template.md` — 퍼블리싱 스타일가이드 전역 기본 템플릿(버튼 3사이즈·테이블/카드 기본형·탭 2종), 프로젝트별로 값만 채움. frontend-dev 주 사용
- `personal-data-masking-standards.md` — 화면(UI) 단위 개인정보 마스킹 기준(이름/휴대폰/이메일/주민번호/계좌/카드/주소 필드별 노출 자릿수 수치), 마스킹 해제 정책, 화면 설계 체크리스트. security·ux-designer 공용

### architecture/
- (C4모델·아키텍처패턴·REST API·데이터모델링·분산동기화 정본은 `skills/domain-architecture-patterns-reference/SKILL.md`, 우수설계 4대의무·7대기법 A~G는 `skills/domain-system-design-principles/SKILL.md`)
- `vue-zero-architecture.md` — vue-zero 플랫폼 **규칙 정본**(Composables 절대 금지, 페이지별 단일 `.vue` 파일, `utils.js` 중앙화+`window.*` 등록). `frontend/vue-zero-patterns.md`(패턴 상세)와 역할 분담, 모순 시 이 문서 우선. 실제 참조 대상은 frontend-dev다(폴더는 architecture/이지만 읽는 쪽은 frontend-dev)
- `usage-collection-agent-architecture.md` — 토큰 사용량 자동 수집 에이전트(`bin/{usage-agent-lib,pair-usage-device,report-usage,install-usage-agent}.mjs`) 아키텍처 요약: 4개 스크립트 역할분담, malgnai-hub `POST /api/sessions` 계약, 핵심 설계결정(집계 수치만 전송·summary 120자 예외·turns/api_calls는 migration 0012), **설계 문서 대비 실제 구현이 단순화된 지점**(daily-aggregate 엔드포인트 없음/scope 없는 범용 device_token/세션ID 비해시 등) 명시. `skills/usage-agent-healthcheck`와 짝

### backend/
- `search-strategy-vector-vs-fulltext.md` — 벡터 검색 vs Full-text 검색 선택 기준(한글/다국어 쿼리 시 임베딩 모델 언어지원 전제조건, 하이브리드 지향, 데이터규모별 인덱스 재평가), kb-draft 375건 POC 실측 근거

### frontend/
- `vue-zero-patterns.md` — (규칙 정본은 `architecture/vue-zero-architecture.md`, 이 문서는 패턴 상세만) Options API 컴포넌트 예시, API 연동, Bootstrap 5, 모달, 접근성, 범용 UX 교훈, malgnuniv/malgnsales/malgnhrd 실전 패턴 (`agents/frontend-dev.md` 실참조)

### quality/
- (경계값분석·동등분할·상태전이 기법 + Vitest/E2E 패턴·보고서 형식·커버리지 함정 처방 정본은 knowledge가 아니라 `skills/domain-software-test-design-techniques/SKILL.md`)
- `e2e-testing-guide.md` — E2E 테스트(Playwright Test) vs 즉석 화면 검증(`bin/capture.mjs`) 역할 구분, `templates/e2e-template/` 스캐폴드 복사 절차, 프로젝트별 브라우저 설치·인증 setup 가이드
- `intent-fit-vs-correctness-split.md` — "기획의도 부합성 vs 동작정확성" 축 분리 개념 노트. qa-engineer가 검수 체크리스트를 짤 때, reviewer가 통합 보고서에서 지적을 조치 경로별로 분류할 때 참고 (`agents/qa-engineer.md`·`agents/reviewer.md` 실참조)

### security/ — 폴더 없음 (전량 skill로 이관)
- (OWASP Top 10 체크리스트는 knowledge가 아니라 skill에 분산돼 있다 — A01/A03→`skills/domain-backend-api-security` §1/§4, A02→`skills/domain-security-audit-checklist` §4·A09→같은 스킬 §5·A07→같은 스킬 §6, 인프라(Docker/환경변수)→`skills/domain-devops-deployment-patterns` §1, 심각도 CVSS 매핑→`agents/security.md` "핵심 원칙")
- (서버리스/엣지(Cloudflare Workers·Hono·D1·MCP) 스택 특화 점검 절차 정본은 knowledge가 아니라 `skills/domain-serverless-edge-api-security/SKILL.md`. backend-dev/security 공용)

### devops/
- `docker-cloudflare-guide.md` — Dockerfile, docker-compose, Workers, CI/CD, 12-Factor
- (배포 전 로컬 검증 게이트 정본은 knowledge가 아니라 `skills/domain-pre-deployment-verification-gate/SKILL.md`)

### writing/
- `document-writing-guide.md` — 제안서/보고서/기술문서 구조, 톤 조절, Mermaid

### presentation/
- `slide-design-guide.md` — Marp 문법, 슬라이드 원칙, 테마, 스토리텔링
- `a4-document-fundamentals.md` — A4 세로형 문서 기술 배경(페이지 크기·여백·렌더 측정 원리)
- `horizontal-slide-filling-techniques.md` — 가로형(16:9) 슬라이드 콘텐츠 채움 기법(flex 균등확장, `justify-content:space-between` 지양, 스코프 클래스 단위 폰트 조정). `a4-document-fundamentals.md`(세로 인쇄물)와 역할 다름
- (A4 세로형 단계별 절차서 정본은 knowledge가 아니라 `skills/a4-vertical-layout/SKILL.md`)

### marketing/
- `marketing-strategy-guide.md` — STP/4P, 퍼널(AARRR), 채널 믹스(PESO), 캠페인 기획 절차, KPI/ROAS 산식, 마케팅 보고서 구조
- `digital-ad-channels.md` — Google Ads/GA4/SEO, 네이버 검색광고·스마트스토어·블로그/플레이스 구조·과금·연동(API/태그), 실행 계획서 템플릿, 집행 승인 게이트

### finance/
- `financial-analysis-guide.md` — 예산 추정, BEP/ROI/NPV/IRR 산식과 예시, 단위경제(LTV/CAC), 민감도 분석, 가정 명시 원칙, 재무 보고서 구조
- `financial-model-templates.md` — 가정 표, 추정 P&L·현금흐름 템플릿, 런웨이, 시나리오 요약, 모델링 체크리스트

### localization/
- `i18n-terminology-audit-guide.md` — 직역 금지·관용구 우선 판단법, 레퍼런스 제품 대조법, 로케일별 관용 차이, 용어 감사 절차, 용어집 관리 (localizer.md 본문 원칙을 압축·구조화)

### lessons/ — 폴더 없음 (회고·교훈은 malgnai-hub에 기록한다)
- 이 저장소에 `lessons/` 폴더는 **존재하지 않는다.** 프로젝트 회고를 `knowledge/lessons/[프로젝트명].md` 파일로 쌓는 모델이 아니다 — 아래 "학습 루프"도 이 전제로 쓰여 있다.
- 회고·교훈의 기록처는 malgnai-hub다. 절차와 본문 템플릿 정본은 `leadership/retrospective-framework.md`의 "3단계: 교훈 문서화".

## 학습 루프

원시 교훈·회고는 이 저장소의 파일이 아니라 **malgnai-hub**에 쌓인다. `knowledge/`는 여러 프로젝트에서 반복 확인돼 정제된 학습 자료만 놓이는 곳이다.

```
프로젝트 시작 → hub에서 과거 이력 조회 → 작업 → 완료 → 회고를 hub에 기록
                     ↑                                        │
                     └──── 반복되는 교훈만 knowledge로 승격 ────┘
```

모든 에이전트는:
- **작업 전**: malgnai-hub `project_search_history`(projectId + 검색어, `types`로 decision/issue/work 선별)로 같은 프로젝트의 과거 결정·이슈·작업 이력을 확인한다. 특정 에이전트의 과거 학습 이력·점수 추이가 필요하면 `agent_get_context`(agentName).
- **작업 후**: 새로 배운 패턴·실수를 hub에 남긴다 — 결정·판단형은 `decision_record`, 작업·절차형은 `work_record`, 특정 에이전트의 역량이면 `agent_learning_record`.

PM은 프로젝트 완료 시:
- 회고를 hub에 기록한다(절차·본문 템플릿 정본: `leadership/retrospective-framework.md` "3단계: 교훈 문서화").
- 여러 프로젝트에 걸쳐 반복되는 교훈이면 knowledge 파일 보강을 trainer에 위임한다.

## 학습 자료 추가 방법

1. 해당 폴더에 `.md` 파일 추가 — **신규 knowledge 문서는 파일 최상단(제목 바로 아래)에 `owner`(작성 에이전트 이름) 메타 라인을 포함한다**(예: `> owner: trainer`). 기존 문서에는 소급 적용하지 않는다 — 신설되는 문서부터 적용한다. 검토 날짜는 적지 않는다 — 제품 본문은 "지금 무엇이 참인가"만 담고, 언제 손봤는지는 git 이력의 몫이다.
2. 이 README.md에 항목 추가
3. 관련 에이전트 MD의 `## 학습 자료` 섹션에 경로 추가
