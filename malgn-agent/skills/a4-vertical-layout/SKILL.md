---
name: a4-vertical-layout
description: A4 세로형(210×297mm) HTML/PDF 인쇄 문서 페이지 배치 절차 — 스타일가이드 정본 복사, 블록별 렌더 높이 실측, 그리디 알고리즘 페이지 분배, 오버플로 검증 루프, 페이지 번호/헤더·푸터 일관성 검사, PDF 변환 1회. presenter가 A4 세로형 문서를 생성할 때 작업 시작 전 반드시 따른다(가로형 슬라이드에는 적용하지 않음).
---

# A4 세로형 HTML 문서 페이지 배치 Skill

**When to Use**: A4 세로형 인쇄 문서(210mm×297mm)의 HTML/PDF를 생성할 때. 슬라이드(가로형) 아님.

**Inputs**:
- 원본 마크다운 또는 콘텐츠 블록들 (섹션, 단락, 표, 코드 등)
- 각 블록의 예상 높이 정보 또는 직접 측정 필요

**Outputs**:
- 각 `.page` 요소가 정확히 297mm(±0.5mm)를 채우는 최종 HTML
- 페이지별 오버플로 0, 여백 균일 (챕터 전환 제외)

**사전 조건(브라우저 구동)**: 이 스킬의 단계 2·4는 실제 렌더 높이를 측정하기 위해 headless
Chromium을 구동한다. `skills/common-screen-verification-and-capture`와 동일한 표준 설치를 그대로
따른다 — 대상 프로젝트 루트에서 1회:
```bash
pnpm add -D playwright && pnpm exec playwright install chromium
```
이 스킬이 필요로 하는 것은 화면 캡처가 아니라 **블록별 렌더 높이 측정**이라 `bin/capture.mjs`를
그대로 재사용하지는 않는다(성격이 다른 스크립트). 대신 아래 단계 2·4의 측정/검증 스크립트를
`playwright`(전체 설치, `playwright-core` 아님) 표준 import로 그때그때 작성해 실행한다 — 과거
버전의 `require('playwright-core')` 인라인 패턴(package.json 미선언 상태로 전역 캐시에 의존)은
더 이상 쓰지 않는다.

---

## 절차

### 단계 1: 세로형 스타일가이드 정본 Read & 복사
**체크리스트**:
- [ ] `${CLAUDE_PLUGIN_ROOT}/knowledge/design/html-style-guide/html-스타일가이드-세로형.html` Read
- [ ] `:root{...}` 토큰 블록 전체 복사 (색상, 폰트, 변수명 **그대로**)
- [ ] `.page`, `.rh`, `.rf`, `.content` 기본 클래스 CSS 복사
- [ ] `h2.chap`, `h3`, `.box`, `.blist`, `.table` 등 콘텐츠 클래스 복사
- [ ] **자체 변수명/색상 추가하지 않음** (드리프트 방지)
- [ ] 표지/러닝 헤더에 로고가 들어가는 문서라면 `${CLAUDE_PLUGIN_ROOT}/knowledge/design/html-style-guide/맑은_로고.png`(정본)를 출력 폴더로 복사해 `<img src="맑은_로고.png">`로 삽입 — CSS 합성 로고(`class="mark"`) 절대 금지(presenter.md "브랜드 로고 처리" 규칙과 동일)

**Why**: 정본 토큰을 그대로 쓰지 않으면 "스타일가이드를 참조하라"는 지시를 따르지 않은 것과 같고, 이후 색상 변경, 브랜드 업그레이드 시 이 문서가 업데이트되지 않는 좀비 파일이 된다.

---

### 단계 2: HTML 구조 설계 (페이지 분할 계획)
**절차**:
1. **원본 콘텐츠 단위 파악**: 마크다운을 섹션(h2)과 소섹션(h3)으로 나눈다.
   - 각 섹션의 시작점, 길이 기록
   - 표, 코드블록, 이미지 등 원자 블록(자를 수 없는 요소) 식별

2. **각 블록의 렌더 높이 측정** (매우 중요):
   ```javascript
   // 사전 조건: pnpm add -D playwright && pnpm exec playwright install chromium (프로젝트 루트에서 1회)
   // 사용 도구: playwright (전체 설치, headless Chromium) — playwright-core 인라인 require 금지
   import { chromium } from 'playwright';

   const browser = await chromium.launch();
   const page = await browser.newPage();
   await page.goto('file:///absolute/path/to/output/draft.html?v=' + Date.now());
   const blocks = await page.locator('.content > *').all();
   for (const block of blocks) {
     const box = await block.boundingBox();
     console.log(`Block: ${box.height}px (~${(box.height/37.8).toFixed(1)}mm)`);
   }
   await browser.close();
   ```
   - 파일 경로에 `?v=<timestamp>` 캐시버스팅 필수 (Chrome이 stale HTML 캐시함)
   - 모든 폰트가 로드될 때까지 대기 (네트워크 폰트 사용 시)

3. **페이지별 콘텐츠 분배 계획 (그리디 알고리즘)**:
   - 가용 높이: 297mm - 상단여백(18-20mm) - 하단여백(18mm) = **약 260mm**
   - 앞 페이지부터 260mm까지 최대로 채운다
   - 다음 블록이 남은 공간에 들어가지 않으면 다음 페이지로
   - 예외: 소제목(h3)이 페이지 맨 끝에 혼자 남으면 본문과 함께 다음 페이지로 백오프

**Anti-pattern**: "느낌"으로 페이지를 나눔 → 40~60% 여백 과다 발생

---

### 단계 3: 초안 HTML 조립
**절차**:
1. `.page` 섹션으로 콘텐츠 감싸기:
   ```html
   <section class="page">
     <div class="rh">
       <span class="rh-brand">문서 제목</span>
       <span>발행 정보</span>
     </div>
     <div class="content">
       <!-- 실제 콘텐츠 블록들 -->
       <h2 class="chap">챕터 제목</h2>
       <h3>소섹션</h3>
       <p>...</p>
     </div>
     <div class="rf">
       <span>챕터명</span>
       <span>페이지 번호</span>
     </div>
   </section>
   ```

2. **CSS 주의**:
   - `.page{width:210mm; height:297mm; position:relative; overflow:hidden; page-break-after:always}`
   - `.content{flex:1; display:flex; flex-direction:column}` — 콘텐츠가 최대한 수직으로 펼쳐짐
   - `.rh`, `.rf{position:absolute}` — 각각 상단/하단 고정

3. **페이지 번호 자동화** (선택):
   ```html
   <script>
   const pages = document.querySelectorAll('.page');
   pages.forEach((p, i) => {
     p.querySelector('.rf span:last-child').textContent = i + 1;
   });
   </script>
   ```

---

### 단계 4: 렌더 높이 검증 & 오버플로 수정 루프
**검증 스크립트**:
```javascript
// 사전 조건: pnpm add -D playwright && pnpm exec playwright install chromium (프로젝트 루트에서 1회)
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('file:///path/to/final.html?v=' + Date.now());

const pages = await page.locator('.page').all();
let maxHeight = 0;
for (let i = 0; i < pages.length; i++) {
  const box = await pages[i].boundingBox();
  const heightMm = (box.height / 37.8).toFixed(1);
  console.log(`Page ${i}: ${heightMm}mm`);
  if (box.height > 1122.5) { // 297mm @96dpi
    console.warn(`⚠ 오버플로 발생! 다음 블록을 이 페이지에서 빼세요.`);
  }
  maxHeight = Math.max(maxHeight, box.height);
}
await browser.close();
```

**오버플로 발견 시 대응**:
1. 오버플로난 페이지의 마지막 블록 1개를 다음 페이지로 이동
2. HTML 재저장
3. 검증 스크립트 재실행 (다시 캐시버스팅 쿼리스트링 붙인 후)
4. 모든 페이지가 297mm 이하가 될 때까지 반복

**여백 검사** (선택):
- 각 페이지의 충전율이 75~97% 범위 내인가?
- 충전율 = (실제높이 / 260mm) × 100%
- 너무 낮으면(50% 이하) 콘텐츠 배분을 다시 검토

---

### 단계 5: 페이지 번호·러닝 헤더/푸터 일관성 검사
**체크리스트**:
- [ ] 모든 페이지의 `.rh` 내용 일관성 (타이틀, 발행정보 일관)
- [ ] 페이지 번호 연속성: 1, 2, 3, ... N (누락/중복 없음)
- [ ] 챕터 전환 페이지의 `.rh` 텍스트 (새 챕터명 반영했나?)
- [ ] 표지(page cover)는 `.rf` 숨김 (page-break-after:auto)

---

### 단계 6: 서식 & 원본 충실도 검사
**체크리스트**:
- [ ] 원본 마크다운의 모든 섹션 포함 (섹션 삭제 없음)
- [ ] 테이블, 코드블록, 인용, 리스트 등 포맷 보존
- [ ] 강조(bold/italic), 하이라이트 박스 구별 명확
- [ ] 이미지/다이어그램 포함 (있는 경우)

**Anti-pattern**: 페이지를 짧게 만들기 위해 섹션 통째로 삭제

---

### 단계 7: PDF 변환 (1회만)
**도구**: Chrome headless 또는 브라우저 "인쇄 → PDF로 저장"
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --headless \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf="output.pdf" \
  "file:///path/to/final.html"
```

**검증** (1회만):
```bash
pdfinfo output.pdf  # 페이지 수 확인
pdftoppm -png -r 100 output.pdf /tmp/page  # 각 페이지 이미지화
# 이미지를 눈으로 스캔: 빈 페이지, 잘림, 페이지번호 연속성
```

**문제 발견 시**:
- HTML에서 원인 고치고 PDF 재생성 (HTML 단계 고정 후 1회만)
- 변환 도구 고장나면 브라우저 "인쇄 → PDF로 저장" 폴백 (항상 동작)

---

## 체크리스트 (최종)

**제작 전**:
- [ ] 세로형 스타일가이드 Read & 토큰/클래스 복사 완료
- [ ] 원본 콘텐츠 전수 파악 (섹션·블록 단위)
- [ ] 각 블록 렌더 높이 측정 완료

**제작 중**:
- [ ] 그리디 분배로 페이지 분할 계획 수립
- [ ] `.page` 구조로 HTML 조립
- [ ] 캐시버스팅 쿼리스트링 붙임

**제작 후**:
- [ ] 모든 페이지 높이 ≤ 297mm (오버플로 0)
- [ ] 페이지 번호 연속성 확인
- [ ] 원본 섹션 손실 0
- [ ] PDF 변환 1회 수행, 페이지 수·무결성 확인

---

## 자주 하는 실수

| 실수 | 원인 | 해결 |
|------|------|------|
| 페이지마다 40~60% 여백 | 손으로 감 잡아 배분 | 각 블록 높이 실측 후 그리디 적용 |
| 섹션 무분별 삭제 | 페이지 길이 조정 압박 | 콘텐츠 손실은 불가, 분배만 조정 |
| 페이지 번호 누락/중복 | 수동 넘버링 | 자동화 스크립트 사용 |
| `.rf` 위치로 여백 판정 | 절대배치 착시 | `.page` 실제 높이로만 판정 |
| PDF 변환 후 재수정 루프 | HTML 미확정 상태에서 PDF 변환 | HTML 완전 검증 후 PDF 1회 변환 |

---

## 참고

- (원본 사고 분석·4부 교훈은 이 스킬의 단계 3~4에 이미 흡수됨)
- `${CLAUDE_PLUGIN_ROOT}/knowledge/design/html-style-guide/html-스타일가이드-세로형.html` — 정본 스타일
- `${CLAUDE_PLUGIN_ROOT}/knowledge/presentation/a4-document-fundamentals.md` — 기술 배경 (페이지 크기·여백·렌더 측정 원리)
- `presenter.md` "세로형(A4) 페이지 채움 게이트" 섹션
- `skills/common-screen-verification-and-capture` — 화면 캡처가 필요하면(디자인 검토용 스크린샷 등) 이 스킬을 참조. 이 스킬(a4-vertical-layout)의 렌더 높이 측정과는 목적이 다르지만 브라우저 구동 사전 조건(`pnpm add -D playwright && pnpm exec playwright install chromium`)은 동일하다.
