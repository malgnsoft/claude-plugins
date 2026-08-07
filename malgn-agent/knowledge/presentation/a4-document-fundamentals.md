# A4 세로형 문서 레이아웃 기본

## 개요

A4 세로형(세로 방향, 297mm H × 210mm W) 인쇄 문서는 **슬라이드(1280×720, 가로 16:9)와 완전 다른 제약과 원칙**을 따른다. 
이 문서는 HTML→PDF 변환 시 필요한 기술적 기초(페이지 크기, 여백, 콘텐츠 배치, CSS 최적화)와 그 배경(왜 그렇게 설계했는가)을 정리한다.

**이 문서 vs Skill**: 실행 절차·측정/검증 스크립트·PDF 변환 명령은 Skill `a4-vertical-layout`이 정본이다. 이 문서는 배경 지식(치수·여백 산식, 그리디 채택 이유, 함정의 원인)만 다루며, Skill과 겹치는 절차 항목은 스텁 처리해 Skill을 가리킨다(2026-08-07 감사 패턴4 이관절차③ 정정).

---

## 1. 페이지 물리 치수와 인쇄 표준

### A4 표준 (ISO 216)
```
물리 크기:     297mm (높이) × 210mm (너비)
해상도:       96 DPI (웹), 300 DPI (인쇄)
@96 DPI:      1122px (높이) × 794px (너비)
@300 DPI:     3508px × 2480px
```

### 웹 HTML의 페이지 크기 설정
```css
@page {
  size: A4;          /* 또는 size: 210mm 297mm */
  margin: 0;         /* 브라우저 기본 여백 제거 */
}

/* 또는 명시적 픽셀 */
@page {
  size: 794px 1122px;
  margin: 0;
}
```

**중요**: 페이지 여백은 CSS `@page`가 아니라 **`.page` 컨테이너의 padding**으로 관리한다 (이유: 여백 안 러닝 헤더/푸터 배치).

---

## 2. 여백 & 가용 높이 설계

### 표준 여백 (맑은소프트 기준)
```
상단:   18~20mm (러닝 헤더 공간)
좌우:   18mm
하단:   18mm   (러닝 푸터 공간)
```

### 가용 높이 계산
```
물리 페이지:    297mm
- 상단여백:      20mm
- 하단여백:      18mm
─────────────────────
콘텐츠 가용:    259mm (~980px @96dpi)
```

**설계 원칙**: 콘텐츠는 이 259mm 안에만 배치. 이를 초과하면 페이지가 늘어나 다음 물리 페이지로 밀려 시각적으로 깨진다.

### 절대배치 러닝 요소 배치
```css
.page {
  width: 210mm;
  height: 297mm;
  position: relative;
  overflow: hidden;        /* 흘러넘은 콘텐츠 숨김 */
  page-break-after: always;
}

.rh {  /* 러닝 헤더 */
  position: absolute;
  top: 9mm;
  left: 18mm;
  right: 18mm;
  height: ~5mm;
  border-bottom: 1px solid #E2E8F2;
  padding-bottom: 3mm;
}

.rf {  /* 러닝 푸터 */
  position: absolute;
  bottom: 9mm;
  left: 18mm;
  right: 18mm;
  height: ~5mm;
  border-top: 1px solid #E2E8F2;
  padding-top: 3mm;
}

.content {
  padding-top: 6mm;
  padding-bottom: 6mm;
  /* 여기에 실제 콘텐츠 배치 */
}
```

**함정**: 절대배치 요소(`.rh`, `.rf`)는 **부모(`.page`)가 확장되면 함께 끌려간다**. 
즉, 콘텐츠가 297mm를 초과하고 `.page`가 늘어나면, `.rf`도 맨 아래로 따라가므로 **겉보기엔 안 잘린 것처럼 보인다**. 
따라서 "`.rf`가 보이니까 여백이 있다"고 판정하면 안 되고, **`.page` 요소 자체의 실제 높이를 직접 측정**해야 한다.

---

## 3. 콘텐츠 배치 전략: 그리디 vs. 균등분배

### 그리디 최대채움 (Greedy Maximum Fill)
```
앞 페이지부터 가용높이(259mm)까지 최대로 채운다.
다음 블록이 안 들어가면 다음 페이지로 넘긴다.
예) 페이지1: 245mm | 페이지2: 198mm | 페이지3: 92mm
```

**장점**: 총 페이지 수 최소화, "기술서적" 느낌(빈틈없음)
**단점**: 페이지마다 높이 편차 큼

### 균등분배 (Dynamic Programming)
```
모든 페이지가 가능한 한 같은 높이로 채워진다.
예) 페이지1: 180mm | 페이지2: 180mm | 페이지3: 180mm
```

**장점**: 보기에 균형 있음, 페이지별 "여유" 명확
**단점**: 총 페이지 수 증가, 알고리즘 복잡도

### 맑은소프트의 선택: 그리디
- 기술/교과서 스타일 문서 → **그리디**
- 명함/안내장 스타일 문서 → **균등분배** (사용자 명시 시만)

> 역사: 초기에 균등분배를 시도했으나, 사용자가 "페이지마다 60~70%만 채워져 답답하다"고 재차 거부. 이후 그리디로 변경해 승인받았다.

---

## 4. 콘텐츠 블록의 렌더 높이 측정

### 왜 측정해야 하나?
- CSS `height:auto` 상태에서는 브라우저가 콘텐츠에 맞춰 높이를 계산
- 마크다운 → HTML로 변환할 때 각 블록(문단, 표, 코드)의 최종 높이를 알 수 없음
- 폰트, 라인높이, 마진 등이 복합작용해 예측이 어려움

### 측정 방법

**절차·스크립트는 Skill `a4-vertical-layout` 단계 2에 정본으로 있다** — `playwright`(전체 설치) 표준 import로 `.content > *` 각 블록의 `boundingBox()`를 측정한다. 이 문서에는 절차를 다시 싣지 않는다(2026-08-07 감사 패턴4 이관절차③ 정정 — 구 버전은 `require('playwright-core')` 인라인 방식을 실었으나 이는 package.json 미선언 상태로 전역 캐시에 의존하는 §7.4 위반 패턴이라 삭제했다. D8 결정에 따라 표준 설치(`pnpm add -D playwright && pnpm exec playwright install chromium`)로 대체됨).

### 해상도별 px↔mm 변환
```
@96 DPI (웹 기본):
  1mm = 3.78px
  1px = 0.265mm
  
@300 DPI (인쇄):
  1mm = 11.81px
  1px = 0.085mm
```

---

## 5. 페이지 오버플로와 검증

### 오버플로 정의
콘텐츠가 페이지 높이(297mm)를 초과하는 상태. CSS `overflow:hidden`으로 숨겨지지만, PDF/인쇄 시 깨진다.

### 검증 방법과 수정 루프

**절차·스크립트는 Skill `a4-vertical-layout` 단계 4에 정본으로 있다** — `.page` 각 요소의 실측 높이를 297mm(=~1122.5px @96dpi)와 비교하고, 오버플로 페이지는 마지막 블록 1개를 다음 페이지로 옮긴 뒤 캐시버스팅 재측정을 반복한다. 이 문서에는 절차를 다시 싣지 않는다(2026-08-07 감사 패턴4 이관절차③ 정정).

---

## 6. 소제목 고아 방지 (Widow Control)

### 문제
```
┌─────────────────────┐
│ (이전 콘텐츠)        │
│                     │
├─────────────────────┤ ← 페이지 끝
│ ### 소제목          │ ← 혼자 남은 소제목
└─────────────────────┘

┌─────────────────────┐
│ (소제목의 본문)      │ ← 다음 페이지로 밀림
└─────────────────────┘
```

### 해결책: 백오프 (Backoff)
```
소제목이 페이지 끝에 혼자 남고 
본문이 다음 페이지로 밀리면,
소제목까지 함께 다음 페이지로 이동.
```

**구현**:
```javascript
// 1차 그리디 분배 후
const pages = document.querySelectorAll('.page');
for (const p of pages) {
  const lastChild = p.querySelector('.content > :last-child');
  if (lastChild && lastChild.tagName === 'H3') {
    // 다음 페이지의 첫 요소로 이동
    const nextPage = p.nextElementSibling;
    if (nextPage) {
      nextPage.querySelector('.content').prepend(lastChild);
    }
  }
}
```

---

## 7. 표·코드블록: 원자 블록 처리

### 정의
페이지 중간에서 자를 수 없는 콘텐츠. 표 행, 코드 한 줄이 분리되면 의미가 깨진다.

### 규칙
```
표 / 코드블록 / 이미지 → 페이지 중간에서 자르지 않는다
특정 페이지에 안 들어가면 → 통째로 다음 페이지로 이동
```

### CSS 지원
```css
table, .codeblock, figure {
  page-break-inside: avoid;  /* 페이지 중간 자르기 금지 */
  break-inside: avoid;       /* 현대 브라우저 표준 */
}
```

### 결과
- 챕터 마지막 페이지가 작아 보일 수 있다 (표가 다음 페이지로 넘어감)
- 이는 **정상** — 원자성 유지가 콘텐츠 정합성보다 우선

---

## 8. CSS 최적화 & 브라우저 호환성

### Print 미디어 쿼리
```css
@media print {
  body { margin: 0; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  
  /* 하이라이트·그림자는 인쇄 시 흐려질 수 있음 */
  .box { box-shadow: none; }
}

@media screen {
  /* 화면 프리뷰용 스타일 */
  .page { margin: 10mm auto; box-shadow: 0 4px 28px rgba(0,0,0,0.32); }
}
```

### 폰트 로딩
```css
@import url('https://fonts.googleapis.com/css2?family=...');

/* 또는 로컬 폰트 */
@font-face {
  font-family: 'Pretendard';
  src: url('/fonts/Pretendard-Regular.woff2') format('woff2');
}
```

**주의**: 웹폰트가 로드되지 않으면 텍스트 레이아웃이 달라진다. 헤드리스 브라우저 사용 시 `--virtual-time-budget=10000`으로 폰트 로드 대기.

### 색상 & 대비
```css
/* 인쇄 친화적 색상 */
--brand: #1E5EFF;      /* 웹 화면에서 선명, 인쇄에서도 가시 */
--navy: #0B1F3A;
--ink: #0E1726;
--canvas: #F6F8FC;     /* 잉크 절약 라이트 그레이 */

/* 회피할 색상 */
/* --brand: #FF1493 (인쇄 시 번짐), #FFFF00 (인쇄 시 흰색 가까움) */
```

---

## 9. PDF 변환 체인

### Step 1: HTML → 화면 렌더링
```
브라우저 렌더 엔진 → DOM + CSS 계산 → 픽셀 배치
(이 단계에서 페이지 구조 확정)
```

### Step 2: 화면 → PDF 벡터
```
Chrome headless: 
  --headless --print-to-pdf
  
결과: 벡터 PDF (텍스트 선택 가능, 용량 작음, ~100KB)

또는 스크린샷 조립:
  각 .slide screenshot → base64 → 임시 HTML → PDF
  
결과: 래스터 PDF (텍스트 미선택, 용량 큼, ~5MB for 16p)
```

### Step 3: PDF → 검증

**명령·절차는 Skill `a4-vertical-layout` 단계 7에 정본으로 있다**(`pdfinfo`로 페이지 수 확인, `pdftoppm`으로 페이지 이미지화 후 눈으로 스캔). 이 문서에는 절차를 다시 싣지 않는다(2026-08-07 감사 패턴4 이관절차③ 정정).

---

## 10. 자주 하는 실수와 재발방지

| 실수 | 원인 | 신호 | 해결 |
|------|------|------|------|
| 페이지마다 40~60% 여백 | 손으로 감 잡아 배분 | "페이지가 너무 비어 있다" | 각 블록 높이 실측 + 그리디 |
| 섹션 통째 삭제 | 페이지 길이 조정 압박 | 원본에는 있는데 PDF에는 없음 | 콘텐츠 손실 금지, 분배만 조정 |
| 페이지 번호 오류 | 수동 넘버링 | 페이지 1→3 누락, 1→1→2 중복 | 자동화 스크립트 사용 |
| `.rf` 위치로 여백 판정 | 절대배치 착시 | "여백이 충분해 보이는데" 실제 오버플로 | `.page` 높이 직접 측정 |
| 같은 URL 재로드, 캐시 hit | 브라우저 캐시 | 수정한 HTML이 이전 버전으로 렌더링 | `?v=<timestamp>` 캐시버스팅 |
| PDF 변환 후 재수정 루프 | HTML 미확정 | 스크린샷 재확인 반복 | HTML 완전 검증 후 PDF 1회만 |
| 균등분배 시도 | "페이지별 여백 고르게" 기대 | 모든 페이지 60~70% 채워짐 | 사용자 명시 없으면 그리디 |

---

## 참고 자료

- 플러그인 번들 `knowledge/design/html-style-guide/html-스타일가이드-세로형.html` — 정본 스타일 (토큰, 레이아웃 클래스)
- 플러그인 번들 Skill `a4-vertical-layout` — 단계별 절차 정본(측정·검증 스크립트, PDF 변환 명령은 이 Skill에만 있다)
- W3C CSS Paged Media: https://www.w3.org/TR/css-page-3/
- CSS Print 가이드: https://www.smashingmagazine.com/2015/01/designing-for-print-with-css/
