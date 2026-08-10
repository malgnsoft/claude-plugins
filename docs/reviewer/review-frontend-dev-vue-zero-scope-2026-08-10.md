# frontend-dev.md / vue-zero-architecture.md 프레임워크 스코프 조건화 리뷰 보고서

리뷰 페르소나 패널: `docs/reviewer/personas/persona-frontend-scope-consistency-auditor.md`, `docs/reviewer/personas/persona-vue-zero-regression-guardian.md`, `docs/reviewer/personas/persona-field-executability-officer.md`, `docs/reviewer/personas/persona-zero-based-md-restructurer.md`(발산형)
리뷰 대상: `malgn-agent/agents/frontend-dev.md`, `malgn-agent/knowledge/architecture/vue-zero-architecture.md` (미커밋 working tree diff)
리뷰 일자: 2026-08-10
종합 판정: 🟡 **Amber** (Major 2건, Critical 없음 — 수정 후 재검토 권장)

## 요약 (2분 규칙)
전체 방향(vue-zero를 기본 프레임워크로 가정하던 문제를 조건화로 해소)은 옳고, 6곳 중 5곳(핵심원칙·API연동패턴·Blob URL패턴·자기검증 2건·학습자료 2건)은 조건화가 정확·일관됩니다. 다만 **"반응형·상태 관리" 절의 본문(Bootstrap 5·props/emit)이 조건화 누락으로 여전히 전 프레임워크 공통 규칙처럼 읽히고**, **신설 프레임워크 판별 규칙이 CDN 로드 방식인 vue-zero 자체를 탐지하는 방법을 빠뜨려** 이번 변경의 핵심 목적을 정확히 절반만 달성했습니다. CDN URL(`https://unpkg.com/vue-zero-ai/dist/vue-zero.js`)은 WebFetch로 실측해 실재하는 유효한 JS 번들임을 확인했습니다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 문제 | 개선안 |
|---|-------|------|------|------|--------|
| 1 | 🟠 Major | 정합성/회귀위험 | `malgn-agent/agents/frontend-dev.md:65-68` | "### 반응형·상태 관리" 절에서 ℹ️ 안내줄만 `vue-zero 프로젝트인 경우`로 조건화되고, 그 아래 본문("**Bootstrap 5 그리드**... 상태관리: props/emit 단방향...")은 조건 없이 남아 모든 프레임워크에 적용되는 일반 규칙처럼 읽힘. `emit`은 Vue 고유 API로 React/Next.js에는 대응 개념이 callback prop이며 용어가 안 맞고, Bootstrap 5도 knowledge/README.md:15("frontend/ \| frontend-dev \| vue-zero 패턴, Bootstrap 5")상 vue-zero 지식 묶음으로 분류돼 있어 다른 스택에 일반화하기 부적절. 이번 diff의 핵심 목적(vue-zero 기본 가정 제거)이 이 절에서만 절반만 적용됨 | 헤더 자체를 `### 반응형·상태 관리 (vue-zero 프로젝트인 경우)`로 바꾸거나, line 56 "Nuxt/Next.js 프로젝트인 경우" 절 패턴을 따라 이 절 바로 아래에 "Nuxt/Next.js는 프로젝트 CSS 프레임워크·React의 controlled prop+callback 패턴을 따르세요" 1줄을 추가해 완전히 대칭 조건화 |
| 2 | 🟠 Major | 실행가능성 | `malgn-agent/agents/frontend-dev.md:13` | 신설 프레임워크 판별 규칙이 `package.json`의 dependencies(`nuxt`, `next` 등)를 1차 신호로 제시하지만, 같은 diff의 vue-zero-architecture.md 신설 섹션(9-13행)에 따르면 vue-zero는 `<script src="...">` CDN 로드 방식이라 npm 의존성으로 package.json에 나타나지 않을 수 있음. 판별 규칙의 예시가 Nuxt/Next만 커버하고 vue-zero(가장 실사용 중인 케이스)의 CDN 특성을 반영하지 못해, 판별 절차와 신설 CDN 사실이 서로 안 맞물림 | line 13에 "vue-zero는 npm 의존성이 아니라 `index.html` 등의 CDN `<script src=".../vue-zero.js">` 존재 여부로 식별합니다(package.json에 나타나지 않을 수 있음)"를 추가해 판별 방법과 CDN 섹션을 연결 |
| 3 | 🟡 Minor | 정합성 | `malgn-agent/agents/frontend-dev.md:117` | "필수"였던 vue-zero-architecture.md가 "참고(상황별 확인)"로 재배치되면서 실제 vue-zero 프로젝트에서도 우선순위가 낮게 읽힐 여지(단, 같은 절의 기존 "[상황: ...]" 태그 컨벤션과 형식은 일치해 큰 위험은 아님) | "[상황: 프로젝트가 실제로 vue-zero로 판별된 경우 — 이 경우엔 사실상 필수]"처럼 조건 충족 시의 강제력을 한 마디 보강 (선택) |

## 페르소나별 관점

### [프레임워크 스코프 정합성 감사관] — 판정: 🟠 Amber
frontend-dev.md의 조건화 태그를 절 단위로 전수 대조한 결과 6개 조건화 대상 절 중 5개는 헤더·본문이 정확히 함께 조건화됐다(API 연동 패턴 `:44`, Blob URL 패턴 `:49`, 자기검증 `:92-93`, 학습자료 `:117,119`). 유일하게 "반응형·상태 관리"(`:65-68`)만 ℹ️ 안내줄만 조건화되고 본문이 새지 않고 그대로 남았다(지적 #1). knowledge/README.md·skill SKILL.md·knowledge/frontend/vue-zero-patterns.md는 이번 diff 범위 밖 대상이지만 대조한 결과 모순은 없다 — SKILL.md description은 이미 "vue-zero 프로젝트에서... 사용"으로 스코프가 좁혀져 있고(수정 불필요), knowledge/README.md의 "vue-zero 패턴, Bootstrap 5" 폴더 설명은 오히려 지적 #1의 근거를 강화한다(Bootstrap 5가 vue-zero 지식 묶음으로 분류돼 있다는 뜻이므로, frontend-dev.md 본문에서 무조건 노출하면 안 됨).

### [vue-zero 회귀 파수꾼] — 판정: 🟢 Green (지적 #2에 한해 조건부 우려)
lesson `3c632bee`(index.html 등록)와 `4faba7fd`(폴더 선례보다 정책 우선) 관련 서술은 diff 전후로 내용 손실 없이 그대로 보존됐고, `(vue-zero 프로젝트인 경우)` 태그만 앞에 붙었다 — 실질적 약화는 없다. vue-zero-architecture.md의 "핵심 규칙 3가지" 챕터는 신설 CDN 섹션이 그 앞에 삽입됐을 뿐 번호 체계(1/2/3)에 영향이 없다. 다만 지적 #2(판별 규칙이 CDN 로드 vue-zero를 놓칠 수 있음)가 현실화되면, 판별이 "기타"로 잘못 떨어져 vue-zero 프로젝트에서 vue-zero 규칙 자체가 통째로 스킵되는 회귀가 발생할 수 있다 — 이 점만 Amber로 본다.

### [현장 실행가능성 검사관] — 판정: 🟠 Amber
판별 규칙(`:13`)을 절차로 분해하면 "①package.json Read ②CLAUDE.md/architecture.md Read ③프레임워크 결론"까지는 구체적이나, ①단계 예시가 nuxt/next만 들어 vue-zero 케이스의 CDN 특성과 안 맞물린다(지적 #2). CDN URL은 WebFetch로 직접 접속해 확인했다 — `https://unpkg.com/vue-zero-ai/dist/vue-zero.js`는 실제로 유효한 JS 번들을 반환하며(VueZero 클래스, SFC 파싱, 라우터 구성 등 확인), 저자가 기억이 아니라 실재 리소스를 반영한 것으로 판단된다(잘된 점). Nuxt/Next.js 절(`:56-57`)은 세부 코드 패턴을 신설하지 않고 "프레임워크 공식 문서·프로젝트 기존 컨벤션을 따르라"로 위임했고 "과도한 신규 규칙 제정 금지"를 스스로 명시해 스코프 절제 원칙을 잘 지켰다.

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|----------|----------|------------|----------------|
| 1 | 프레임워크별 조건부 서술이 frontend-dev.md 안에 7군데(핵심원칙 1 + 스킬상세 2 + 전제조건 관련 판별규칙 1 + 자기검증 2 + 학습자료 2)로 흩어져 있고, 새 스택이 추가될 때마다 이 7군데를 전부 찾아 태그를 추가해야 함 | "## 프레임워크별 상세" 통합 하위 섹션을 신설해 `#### vue-zero`, `#### Nuxt`, `#### Next.js`로 묶고, 각 블록 안에 그 스택의 스킬 상세·자기검증 항목·학습자료 링크를 한 번에 배치. 핵심원칙에는 "판별 후 아래 프레임워크별 상세로 이동" 한 줄만 남김 | 신규 스택(React CSR, SvelteKit 등) 추가 시 문서 전체를 훑어 태그를 찾을 필요 없이 새 `####` 블록 하나만 추가하면 됨 — 지금 구조는 스택이 3개일 때도 이미 5곳 중 1곳(지적 #1)에서 새는 것을 이번 리뷰가 실증함 | diff 규모 커짐(전면 재구성), 기존에 이 절 제목을 참조하는 외부 문서(있다면)의 링크 깨짐 위험, 이번 PR 범위를 벗어나는 재작업 — **이번 PR은 지적 #1/#2 국소 수정으로 마무리하고, 이 재구조화는 별도 백로그 항목으로 분리 권고** |

## 트레이드오프 (페르소나 간 충돌)
- **정합성 감사관(국소 수정 선호) vs 제로베이스 재설계자(구조 통합 선호)**: 전자는 지적 #1을 그 자리에서 1~2줄만 고치면 충분하다고 본다. 후자는 지금 고쳐도 다음 스택 추가 때 또 같은 종류의 누락(부분 조건화)이 재발할 구조적 원인이 남는다고 본다. → **권고**: 이번 PR은 정합성 감사관 방식(지적 #1/#2 국소 수정)으로 GO-with-fix 처리하고, 재설계자의 통합 섹션 제안은 STATUS.md 백로그에 "frontend-dev.md 프레임워크 조건화 구조 재정비(3개 이상 스택 지원 시 필수)"로 남겨 규모가 실제로 커질 때 착수한다.

## 잘 된 점
- CDN URL(`https://unpkg.com/vue-zero-ai/dist/vue-zero.js`)을 WebFetch로 직접 확인 — 실재하는 유효한 VueZero 번들(SFC 파싱, 라우터, 페이지/레이아웃 클래스 포함)로, 외부 사실을 기억이 아니라 실측으로 반영했다.
- 조건화 대상 6곳 중 5곳(핵심원칙, API 연동 패턴, Blob URL 패턴, 자기검증 체크리스트 2건, 학습자료 2건)에서 헤더·본문이 함께 정확히 조건화됐다.
- lesson `3c632bee`/`4faba7fd` 내용이 삭제 없이 조건부 형태로 온전히 보존됐다 — 기존 vue-zero 사용자에게 실질적 규칙 손실이 없다.
- Nuxt/Next.js 신설 절이 세부 코드 패턴을 새로 제정하지 않고 "과도한 신규 규칙 제정 금지"를 스스로 명시해 스코프 절제 원칙을 지켰다.
- vue-zero-architecture.md의 CDN 로드 순서 설명("vue-zero.js 먼저 → .vue 파일·index.js 나중")이 frontend-dev.md의 기존 "빌드 스텝 없는 Vue CDN 프로젝트의 완료 기준 = index.html 등록까지" 서술과 자연스럽게 맞물린다.
- 신설 CDN 섹션의 위치(기존 "역할 분담(정본)" 문단과 "핵심 규칙 3가지" 사이)가 문서 흐름을 해치지 않고, 하위 챕터 번호 체계도 훼손하지 않았다.

## 평가기준 충족 현황

| 기준 | 관점 | 중요도 | 충족 | 비고 |
|------|------|-------|------|------|
| 헤더·본문 조건화 일치(6곳 전수) | 정합성 감사관 | 필수 | 부분 충족(5/6) | 지적 #1 |
| 필수 학습자료에 프레임워크 전용 항목 없음 | 정합성 감사관 | 필수 | 충족 | |
| lesson 3c632bee/4faba7fd 강제력 손실 없음 | 회귀 파수꾼 | 필수 | 충족 | |
| 판별 규칙의 오탐 시 회복 경로 존재 | 회귀 파수꾼 | 필수 | 부분 충족 | CLAUDE.md 병행확인이 안전망이나, package.json 예시가 vue-zero를 놓침(지적 #2) |
| 판별 절차의 구체성(무엇을 Read→무엇을 찾음→결론) | 실행가능성 검사관 | 필수 | 부분 충족 | 지적 #2 |
| CDN URL 실측 검증 | 실행가능성 검사관 | 필수 | 충족 | WebFetch로 확인 |
| Nuxt/Next.js 절의 스코프 절제 | 실행가능성 검사관 | 권장 | 충족 | |

## COO에게 권고
- **결론: GO-with-fix.** Critical은 없으며, 전체 방향과 대부분의 조건화는 정확합니다. 다만 아래 2건은 이번 변경의 목적(vue-zero 기본 가정 제거)을 절반만 달성하는 결함이라 병합 전 수정을 권고합니다.
  1. `malgn-agent/agents/frontend-dev.md:65-68` — "반응형·상태 관리" 절 본문(Bootstrap 5·props/emit)을 vue-zero 조건부로 명시하거나 Nuxt/Next 대응 문구를 대칭 추가.
  2. `malgn-agent/agents/frontend-dev.md:13` — 프레임워크 판별 규칙에 vue-zero의 CDN 로드 특성(package.json에 안 나타날 수 있음)을 명시.
  - #3(학습자료 문구 보강)은 선택 사항으로 이번 병합을 막지 않습니다.
- **백로그 제안(트레이드오프 참조)**: 프레임워크 조건화가 3개 이상 스택으로 늘어나면 frontend-dev.md를 "## 프레임워크별 상세" 통합 섹션 구조로 재편하는 안을 별도 과제로 검토 권고(발산형 페르소나 제언 #1).
- 이번 리뷰는 문서/에이전트 MD 리뷰로 화면 캡처 대상이 없어 `docs/screenshots/` 게이트는 해당 없음(스킵 사유: UI 산출물이 아님).
- 실행 액션(커밋/승격/배포 등)은 수행하지 않았습니다 — 리뷰 산출물만 작성했습니다.
