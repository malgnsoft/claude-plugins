---
name: domain-visual-design-token-system
description: 색상 체계·타이포그래피·간격·그림자·컴포넌트 스타일의 디자인 토큰 템플릿 + admin SaaS CSS 변수화 우수 사례(coaching 프로젝트 역추출). frontend-dev/ux-designer/visual-designer가 디자인 시스템·CSS 변수 체계를 설계·구현할 때 사용한다.
---

# 비주얼 디자인 시스템 가이드

## 색상 체계 설계

### 구조
```
Primary     — 브랜드 메인 색상 (CTA, 강조)
Secondary   — 보조 색상 (부가 요소)
Neutral     — 텍스트, 배경, 보더 (Gray 스케일)
Semantic    — 상태 표시
  ├── Success  #28a745 (초록)
  ├── Warning  #ffc107 (노랑)
  ├── Danger   #dc3545 (빨강)
  └── Info     #17a2b8 (파랑)
```

### 색상 선택 원칙
- Primary는 로고/브랜드에서 추출
- 대비 비율: 일반 텍스트 4.5:1, 대형 텍스트 3:1
- 다크 모드 고려: HSL로 정의하면 밝기 조절 용이

### CSS 변수 정의 패턴
```css
:root {
  --color-primary: #4A90D9;
  --color-primary-light: #6BA5E7;
  --color-primary-dark: #3A7BC8;
  --color-text: #212529;
  --color-text-muted: #6c757d;
  --color-bg: #ffffff;
  --color-bg-secondary: #f8f9fa;
  --color-border: #dee2e6;
}
```

## 타이포그래피

### 폰트 스케일 (1.25 비율)
| 레벨 | 크기 | 용도 |
|------|------|------|
| h1 | 2.5rem (40px) | 페이지 제목 |
| h2 | 2rem (32px) | 섹션 제목 |
| h3 | 1.5rem (24px) | 하위 섹션 |
| h4 | 1.25rem (20px) | 카드 제목 |
| body | 1rem (16px) | 본문 |
| small | 0.875rem (14px) | 보조 텍스트 |
| caption | 0.75rem (12px) | 캡션 |

### 행간/자간
- 본문 행간: 1.5~1.6
- 제목 행간: 1.2~1.3
- 자간: 기본값 유지 (한글은 좁은 자간 피하기)

### 한글 폰트 추천
- Pretendard (무료, 가변폰트)
- Noto Sans KR (구글 폰트)
- Spoqa Han Sans Neo (무료)

## 간격 체계

### 4px 기반 스케일
```
--spacing-1: 0.25rem  (4px)
--spacing-2: 0.5rem   (8px)
--spacing-3: 1rem     (16px)
--spacing-4: 1.5rem   (24px)
--spacing-5: 2rem     (32px)
--spacing-6: 3rem     (48px)
--spacing-7: 4rem     (64px)
```

## 그림자/모서리

### 그림자 단계
```css
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.1);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
--shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
```

### Border Radius
```css
--radius-sm: 0.25rem;   /* 버튼, 입력 */
--radius-md: 0.5rem;    /* 카드 */
--radius-lg: 1rem;      /* 모달, 큰 컨테이너 */
--radius-full: 9999px;  /* 아바타, 태그 */
```

## 컴포넌트 스타일 가이드

### 버튼 상태
| 상태 | 변화 |
|------|------|
| Default | 기본 색상 |
| Hover | 밝기 -10% |
| Active | 밝기 -20% |
| Disabled | opacity 0.5, cursor not-allowed |
| Loading | 스피너 + 텍스트 유지 |

### 입력 필드 상태
| 상태 | 보더 색상 |
|------|----------|
| Default | --color-border |
| Focus | --color-primary |
| Error | --color-danger |
| Disabled | 배경 회색 |

---

## 토큰화된 admin SaaS CSS 시스템 (산출물 역추출)

> 출처: coaching 프로젝트 `style-guide.md` + `public/css/base.css` (Bootstrap 5 기반 admin SaaS). "Bootstrap 최대 활용 + 커스텀 최소화 + CSS 변수 토큰화"로 일관성과 유지보수성을 동시에 잡은 모범 사례다. visual-designer가 구현 단계 CSS/디자인 시스템을 만들 때 이 골격을 출발점으로 삼는다.

### 1. 디자인 토큰을 `:root` CSS 변수로 (단일 출처)
색·간격·레이아웃 치수를 모두 `:root` 변수로 선언하고, 컴포넌트는 변수만 참조한다. 색을 바꿀 때 한 곳만 고치면 전체 반영(브랜드 커스터마이징 FR과 직결).
```css
:root {
  --primary-color: #6366f1;   /* 인디고 — 무난한 파랑 탈피, SaaS다운 선택 */
  --danger-color: #ef4444;
  --gray-50 ~ --gray-900;     /* 9단계 회색 스케일 (Tailwind류) */
  --header-height: 64px;
  --sidebar-width: 260px;
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / .1), 0 4px 6px -4px rgb(0 0 0 / .1);
}
```
- **회색 9단계 스케일**: 텍스트(gray-900/700/600/500)·보더(gray-200/300)·배경(gray-50/100)을 단계로 분리 → 위계가 자동으로 산다.
- **레이아웃 치수도 토큰화**(header 64px, sidebar 260px): 오버레이/오프셋 계산이 `calc(-1 * var(--sidebar-width))`로 일관.

### 2. "Bootstrap 최대 활용, 커스텀 최소" 원칙 + 스타일 작성 위치 단일화
- 기본 컴포넌트(btn/card/table/modal/badge/pagination)는 Bootstrap 클래스 조합으로 해결, 커스텀 CSS는 base.css 한 파일에만. HTML 인라인 `<style>` 금지.
- 효과: frontend-dev가 어디를 고쳐야 할지 명확, 스타일 충돌·중복 최소화.
- **"자주 쓰는 Bootstrap 클래스 조합" 표**를 스타일 가이드에 둔다(행간격 `row g-3 mb-4`, 볼드 `fw-semibold`, 없는 값 `text-muted` 등) → 구현자 간 표현 통일.

### 3. 페이지 골격 표준화 (모든 페이지 동일 순서)
```
container-fluid
├ 1.페이지 헤더(필수)  ├ 2.통계 카드(선택)  ├ 3.필터(선택)
├ 4.로딩  ├ 5.빈 상태  ├ 6.메인(테이블/카드)  ├ 7.페이지네이션  ├ 8.모달
```
- 페이지 헤더: `.page-title`(1.75rem/700/gray-900) + `.page-subtitle`(0.875rem/gray-600). 간격은 CSS 아닌 유틸 클래스(`mb-4`)로만 — "기준 페이지" 파일을 지정해 일관성 강제.

### 4. 통계 카드 패턴 (그라디언트 아이콘 + 의미색)
KPI를 `.stat-card`(아이콘 + 라벨 + 큰 수치)로. **아이콘 배경에 135deg 그라디언트**, 의미별 색 변형표:

| 변형 | 그라디언트 | 용도 |
|---|---|---|
| primary | 인디고 #6366f1→#818cf8 | 주요 수치 |
| success | 초록 #10b981→#34d399 | 긍정/완료 |
| danger | 빨강 #ef4444→#f87171 | 경고/위험 |
| warning | 주황 #f59e0b→#fbbf24 | 주의/대기 |
| info | 파랑 #3b82f6→#60a5fa | 정보 |

수치는 2rem/700, hover 시 `translateY(-2px)` + 보더 강조 + 그림자 → 인터랙티브 느낌.

### 5. 테이블/필터/모달 디자인 패턴
- **테이블**: 카드 안에 `card-body p-0` + `table table-hover align-middle mb-0` + `thead.table-light`. `.card{overflow:hidden}`으로 테이블이 카드 모서리(radius)를 침범하지 않게. 단일 테이블 목록은 card-header 생략(page-header와 중복), 복수 테이블은 card-header로 구분.
- **이름 셀 아바타**: 이니셜 원형(`rounded-circle bg-primary bg-opacity-10` 36px) + 이름 → 이미지 없이도 시각적 식별.
- **필터**: 텍스트 검색은 라벨 없이 `input-group` + 돋보기 아이콘 / 셀렉트·날짜 필터는 라벨 표시. 카드 안에 `row g-3`.
- **모달**: `v-if`로 감싸고 `$nextTick` 후 `new bootstrap.Modal().show()`. 모바일 `modal-fullscreen-md-down`.

### 6. 상태/유형을 색으로 매핑하는 배지 함수 (코드로 못박기)
상태·감정·유형을 **JS 매핑 함수**로 색을 결정해 표현 통일:
```js
statusBadge(s){ return {scheduled:'bg-primary',completed:'bg-success',cancelled:'bg-secondary',no_show:'bg-danger'}[s]||'bg-secondary'; }
emotionBadge(e){ return {very_good:'bg-success',good:'bg-info',neutral:'bg-secondary',bad:'bg-warning text-dark',very_bad:'bg-danger'}[e]||'bg-secondary'; }
```
> 색만으로 정보 전달하지 않도록 텍스트 라벨을 함께(접근성). Progress Bar도 0-30 danger/31-70 warning/71-100 success로 달성률↔색 매핑.

### 7. 진입 화면(로그인)에 브랜드 그라디언트 집중
일반 페이지는 절제하되, 로그인/온보딩에 그라디언트 헤더·큰 그림자·둥근 모서리(radius 1.5rem)로 브랜드 인상을 준다. `.btn-login` hover에 `translateY(-2px)` + 컬러 그림자.

### 약점·보완 지점 (이 사례에서도 부족 — 다음엔 보강)
- **타이포 스케일 미명세**: 색·간격은 토큰화됐으나 폰트 크기 계층(h1~caption)은 페이지별로 흩어져 있고 토큰화 안 됨. `--font-size-*` 스케일을 :root에 추가할 것.
- **다크모드 부재**: 변수 기반이라 다크모드 도입은 쉬운 구조인데 `:root`에 light만 정의. `@media (prefers-color-scheme: dark)` 또는 `[data-theme]` 토큰 세트 미준비.
- **모션 토큰 없음**: transition이 `0.2s/0.3s`로 곳곳에 하드코딩. `--transition-fast/base` 토큰으로 통일하고 모션 의도(왜 이 속도)를 남기면 더 좋다.
- **색 선택 근거 약함**: 인디고·의미색 자체는 좋으나 "왜 이 색인가 + 대비비율"이 문서에 없음. 색마다 의도와 WCAG 대비를 명시할 것(visual-designer 핵심 원칙).
