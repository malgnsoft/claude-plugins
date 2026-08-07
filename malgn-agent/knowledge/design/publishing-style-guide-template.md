# 퍼블리싱 스타일가이드 템플릿 (전역 기본형)

> 2026-07-23 대표+7에이전트 교차토론 합의. 목적: 프로젝트마다 버튼/테이블/탭 규격이 세션별로 달라지는 문제를 막는다. **백지에서 새로 만들지 않는다** — 이 템플릿을 프로젝트 `design/publishing-style-guide.md`(또는 `docs/publishing-style-guide.md`)로 복사한 뒤 값만 채운다.
>
> **(2026-08-07 감사 재검토, 방법론 rubric §1.3 문체판정)**: audit-report.md 패턴4가 이 문서를 "미이관"으로 지목했으나, 이 문서는 (다른 패턴4 대상들과 달리) 스스로 "본문은 Skill로 이관됨"이라고 주장한 적이 없다 — 실제로 이 콘텐츠에 대응하는 Skill은 이 플러그인에 존재하지 않는다(`grep -rl` 확인). §1.3 문체 판정("왜"를 빼도 뜻이 통하면 Skill)을 적용하면 본문 대부분이 절차형(복사→채우기 지시)이라 Skill 후보 성격이 있으나, 신규 Skill 신설은 rubric §2.2 판정 트리 + 별도 decision(D12 선례: `proposal-writing-principles.md` 이관 시 신설 여부를 전용 결정 항목으로 분리한 사례)이 필요한 범위이므로 이 재검토에서는 실행하지 않는다. 현재 Knowledge 배치는 frontend-dev.md·reference-benchmarking-standard가 정확한 경로(`knowledge/design/publishing-style-guide-template.md`)로 참조 중이며 README.md에도 정합하게 등재되어 있어 즉시 조치가 필요한 결함은 없다 — Skill 승격 여부만 별도 결정 대기.

## 사용 절차

1. frontend-dev가 화면 구현 착수 전 이 템플릿을 프로젝트 경로로 복사한다.
2. 아래 각 섹션의 `{{ }}` 자리표시자만 프로젝트 값으로 채운다. 구조(버튼 3사이즈, 테이블/카드 기본형, 탭 2종) 자체는 바꾸지 않는다 — 바꿔야 할 근거가 있으면 visual-designer 확인 후 변경.
3. 이후 모든 화면 구현은 이 문서를 참조하고, 문서에 없는 새 패턴이 필요하면 **먼저 이 문서를 갱신한 뒤** 구현한다(구현 후 사후 기록 금지 — 드리프트 방지).

## 버튼 (3 사이즈 고정)

| 사이즈 | 용도 | 높이 | 좌우 패딩 | 폰트크기 |
|---|---|---|---|---|
| sm | 테이블 행 내 액션, 보조 버튼 | `{{ sm-height }}` | `{{ sm-padding }}` | `{{ sm-font }}` |
| md | 폼 제출, 일반 CTA (기본값) | `{{ md-height }}` | `{{ md-padding }}` | `{{ md-font }}` |
| lg | 랜딩/온보딩 주요 CTA | `{{ lg-height }}` | `{{ lg-padding }}` | `{{ lg-font }}` |

1차 액션(Primary)과 2차 액션(Secondary/Ghost)의 색상·테두리 규칙: `{{ primary-vs-secondary-rule }}`

## 테이블 기본형

- 행 높이: `{{ row-height }}`
- 헤더 스타일: `{{ header-style }}`
- 정렬 아이콘/hover 규칙: `{{ sort-hover-rule }}`
- 빈 상태·에러 상태 표기: `{{ empty-error-row }}`

## 카드 기본형

- 패딩: `{{ card-padding }}`
- 그림자/테두리: `{{ card-elevation }}`
- 헤더/본문/액션 영역 구분: `{{ card-layout }}`

## 탭 (2종 고정)

| 종류 | 용도 |
|---|---|
| Underline 탭 | 콘텐츠 카테고리 전환 (기본값) |
| Pill 탭 | 필터·짧은 옵션 전환 |

각 종류의 active/inactive 스타일: `{{ tab-active-style }}`

## visual-designer 투입 시 매핑 연동

visual-designer가 경량 산출물(팔레트+시맨틱컬러+대비검증표)을 만든 프로젝트는, 이 문서의 색상·크기 값이 `design/design-system.md`의 우선순위→font-weight/size, 밀도→spacing scale 매핑표에서 도출된 값과 일치해야 한다. 두 문서 값이 어긋나면 design-system.md를 정본으로 이 문서를 갱신한다.

## 채운 예시 (참고용 — 그대로 복사 금지, 값은 프로젝트마다 재확정)

**(2026-07-23 추가, lesson `ad097fa7`)** `{{ }}` 자리표시자만 나열되면 실제 값을 언제/누가 채우는지 애매해질 수 있어, Bootstrap 5 기반 관리자 UI 프로젝트를 가정한 채운 예시 1세트를 아래에 남긴다. 이 값 자체가 표준은 아니다 — 프로젝트별로 재확정한다.

| 사이즈 | 용도 | 높이 | 좌우 패딩 | 폰트크기 |
|---|---|---|---|---|
| sm | 테이블 행 내 액션, 보조 버튼 | 28px | 10px | 12px |
| md | 폼 제출, 일반 CTA (기본값) | 38px | 16px | 14px |
| lg | 랜딩/온보딩 주요 CTA | 48px | 24px | 16px |

- 1차 액션(Primary)과 2차 액션(Secondary/Ghost) 규칙 예시: Primary=배경 채움(브랜드 컬러)+흰 텍스트, Secondary=테두리만(1px, 브랜드 컬러)+투명 배경, Ghost=테두리 없음+텍스트만(hover 시 연한 배경).
- 테이블 기본형 예시: 행 높이 44px, 헤더는 연회색 배경(#F5F6F8)+굵은 12px, 정렬 아이콘은 hover 시에만 노출, 빈 상태는 표 중앙에 아이콘+안내문구 1줄, 에러 상태는 표 상단에 인라인 배너.
- 카드 기본형 예시: 패딩 20px, 그림자 `0 1px 3px rgba(0,0,0,0.08)`, 헤더(제목+액션)/본문/하단액션 3단 구분.
- 탭 예시: Underline 탭 active=브랜드 컬러 밑줄 2px+굵은 텍스트, Pill 탭 active=브랜드 컬러 배경+흰 텍스트, 둘 다 inactive는 회색 텍스트.
