# 가로형 슬라이드 채움 기법

**이 문서 vs `a4-document-fundamentals.md`**: 이 문서는 **가로형(16:9, 1280×720) 슬라이드**의 콘텐츠 채움 기법을 다룬다. `a4-document-fundamentals.md`는 **세로 인쇄물(A4 297×210mm)** 전용이며 서로 다른 제약(고정 여러 페이지로 콘텐츠를 분배 vs 고정 1장 안에서 콘텐츠를 채움)을 다룬다 — 가로덱 작업에 세로형 문서 절차(`a4-vertical-layout`)를 적용하지 않는다.

## 배경 — 왜 별도 채움 기법이 필요한가

가로형 슬라이드는 1장(section)의 높이가 고정(720px)인 반면 슬라이드마다 콘텐츠 양은 들쭉날쭉하다. 콘텐츠가 적은 슬라이드는 상단에만 몰려 하단이 허전해지고, 많은 슬라이드는 넘친다(overflow). "적당히 여백을 준다" 식 손감각 조정은 슬라이드마다 다시 판단하게 되어 덱 전체의 일관성이 깨진다 — 아래 3개 기법을 기본값으로 삼는다.

## 1. flex 균등확장으로 세로 공간을 채운다

콘텐츠 블록 수가 슬라이드마다 다를 때, 각 블록에 고정 `height`를 주지 않고 `flex: 1`(또는 `flex-grow: 1`)로 컨테이너 전체 높이를 균등 분배한다.

```css
.slide-body { display: flex; flex-direction: column; height: 100%; }
.slide-body > .block { flex: 1; display: flex; flex-direction: column; justify-content: center; }
```

블록이 2개면 각 50%, 3개면 각 33%로 자동 분배되어 슬라이드마다 손으로 높이를 재지 않아도 된다.

## 2. `justify-content: space-between` 지양

카드/블록을 여러 개 배치할 때 `justify-content: space-between`을 쓰면 **블록 사이 간격이 콘텐츠 개수에 따라 불균등하게 벌어진다** — 블록이 2개면 간격이 극단적으로 커지고, 4개면 촘촘해진다. 콘텐츠 개수가 유동적인 재사용 슬라이드 템플릿에서 이 불균형이 특히 두드러진다.

**대안**: `gap`(고정값) + `flex: 1`(또는 `justify-content: flex-start`)로 간격을 고정하고, 남는 공간은 블록 크기로 흡수시킨다.

```css
/* 지양 */
.row { display: flex; justify-content: space-between; }

/* 권장 */
.row { display: flex; gap: 24px; }
.row > .item { flex: 1; }
```

## 3. 스코프 클래스 단위 폰트 조정 — 전역 폰트 변경 금지

슬라이드 하나에 텍스트가 유독 많아 넘칠 때, `html-스타일가이드-가로형.html` 정본의 전역 `--font-size-*` 토큰을 직접 낮추지 않는다. 전역 토큰을 바꾸면 그 값을 참조하는 **다른 모든 슬라이드**의 폰트가 함께 줄어들어 덱 전체의 타이포 위계가 무너진다.

**대안**: 해당 슬라이드(또는 블록)에만 스코프된 클래스를 추가해 그 안에서만 폰트를 조정한다.

```css
/* 특정 슬라이드에만 스코프 — 전역 토큰은 건드리지 않음 */
.slide-12 .block { font-size: 0.9em; line-height: 1.35; }
/* 또는 블록 단위 */
.dense-content { font-size: var(--font-size-sm); }
```

전역 토큰(`:root`의 `--font-size-*`)은 스타일가이드의 단일 소스로 유지하고, 개별 슬라이드 예외는 반드시 그 슬라이드에만 닿는 선택자로 좁힌다.

## 실행 체크리스트

- [ ] 슬라이드별 블록 수가 다른 템플릿을 재사용하는가? → flex 균등확장을 적용했는가?
- [ ] `justify-content: space-between`을 썼다면, 블록 개수가 바뀔 때도 간격이 자연스러운지 확인했는가?
- [ ] 폰트를 줄였다면 스코프 선택자(`.slide-N`, 전용 클래스)로 한정했는가, 전역 `--font-size-*`를 건드리지 않았는가?
- [ ] `grep -n '\-\-font-size' out.html`로 전역 토큰 변경 여부를 재확인했는가?

## 관련 자료

- `knowledge/presentation/slide-design-guide.md` — 슬라이드 구성 원칙·스토리텔링·평범한 덱 탈출 기법(콘텐츠 관점, 이 문서는 CSS 채움 기법 관점)
- `knowledge/design/html-style-guide/html-스타일가이드-가로형.html` — 가로형 CSS 토큰 정본
- Skill `a4-vertical-layout` — 세로 인쇄물 전용 절차(이 문서와 역할이 다름, 혼동 금지)
