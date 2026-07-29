# Vue-Zero 프론트엔드 패턴

## vue-zero 핵심 규칙

1. **Options API만 사용** (setup/Composition API 금지)
2. **`<style scoped>` 금지** — 전역 CSS 사용
3. **script 블록에서 import 금지** (★ 규칙 5) — vue-zero는 script을 Blob URL로 변환하므로 상대경로 import 불가
4. **composables는 window.* 경유로만 사용** — script에서 직접 import 금지, composables/index.js에서 미리 window에 등록해 호출
5. 파일 추가/삭제 시 `pnpm run scan` 필요

### 규칙 5 상세: Blob URL 패턴 (★ 필수)

**문제**: vue-zero는 `.vue`의 `<script>` 블록을 **Blob URL**로 변환 후 `import()`로 실행합니다. Blob URL에는 기본 경로가 없어서 **상대 경로 `import`가 작동하지 않습니다.**

**❌ 절대 금지:**
```js
// script에서 import → "useAuth is not defined" 런타임 에러
import { useAuth } from '../composables/useAuth.js'
import { MOCK_DEALS } from '../../composables/mockData.js'

export default {
  created() {
    const { login } = useAuth()  // 에러 발생
  }
}
```

**✅ 올바른 방법:**
1. `composables/mockData.js`에서 export:
   ```js
   export const MOCK_DEALS = [...]
   export const MOCK_COMPANIES = [...]
   ```

2. `composables/index.js`에서 import 후 window 등록:
   ```js
   import { useAuth } from './useAuth.js'
   import { useCompanies } from './useCompanies.js'
   import { MOCK_DEALS } from './mockData.js'
   
   window.useAuth = useAuth
   window.useCompanies = useCompanies
   window.MOCK_DEALS = MOCK_DEALS
   ```

3. `.vue` 파일의 script에서 window.* 사용:
   ```js
   export default {
     data() {
       return {
         companies: [],
         deals: window.MOCK_DEALS,  // import 없이 사용
       }
     },
     methods: {
       async loadCompanies() {
         const { search } = window.useCompanies()  // window.* 경유
         this.companies = await search()
       }
     }
   }
   ```

**생성 템플릿 규칙**: .vue 파일 생성 시 script 블록에 절대 `import` 문을 넣으면 안 됩니다. 모든 함수/데이터는 `window.*` 형태로 호출합니다.

## Options API 컴포넌트 패턴

```html
<template>
  <div class="page-container">
    <h1>{{ title }}</h1>
    <div v-if="loading" class="text-center">
      <div class="spinner-border"></div>
    </div>
    <div v-else>
      <!-- 콘텐츠 -->
    </div>
  </div>
</template>

<script>
export default {
  name: 'PageName',
  data() {
    return {
      title: '페이지 제목',
      items: [],
      loading: false,
      error: null,
    }
  },
  computed: {
    filteredItems() {
      return this.items.filter(item => item.active)
    }
  },
  methods: {
    async fetchItems() {
      this.loading = true
      try {
        const res = await fetch('/api/items')
        this.items = (await res.json()).data
      } catch (e) {
        this.error = e.message
      } finally {
        this.loading = false
      }
    },
  },
  mounted() {
    this.fetchItems()
  }
}
</script>
```

## API 연동 패턴

### 기본 fetch 래퍼
```javascript
// utils.js에 추가
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) throw new Error(`API Error: ${res.status}`)
  if (res.status === 204) return null
  return res.json()
}
```

### CRUD 메서드 패턴
```javascript
methods: {
  async loadItems() {
    this.loading = true
    try {
      const { data } = await api('/api/items')
      this.items = data
    } finally {
      this.loading = false
    }
  },
  async createItem() {
    await api('/api/items', { method: 'POST', body: this.form })
    this.loadItems()
  },
  async deleteItem(id) {
    if (!confirm('삭제하시겠습니까?')) return
    await api(`/api/items/${id}`, { method: 'DELETE' })
    this.loadItems()
  }
}
```

## Bootstrap 5 활용 패턴

### 레이아웃
```html
<!-- 반응형 그리드 -->
<div class="row g-3">
  <div class="col-12 col-md-6 col-lg-4" v-for="item in items">
    <div class="card h-100">
      <div class="card-body">{{ item.name }}</div>
    </div>
  </div>
</div>
```

### 상태 표시
```html
<!-- 로딩 -->
<div class="d-flex justify-content-center p-5">
  <div class="spinner-border text-primary"></div>
</div>

<!-- 빈 상태 -->
<div class="text-center text-muted py-5">
  <i class="bi bi-inbox fs-1"></i>
  <p class="mt-2">데이터가 없습니다</p>
</div>

<!-- 에러 -->
<div class="alert alert-danger">{{ error }}</div>

<!-- 토스트 알림 -->
<div class="toast-container position-fixed top-0 end-0 p-3">
  <div class="toast show" v-if="toast">
    <div class="toast-body">{{ toast }}</div>
  </div>
</div>
```

### 모달 패턴
```html
<div class="modal fade" ref="modal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">제목</h5>
        <button class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <!-- 폼 -->
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-bs-dismiss="modal">취소</button>
        <button class="btn btn-primary" @click="save">저장</button>
      </div>
    </div>
  </div>
</div>
```

## 접근성 기본

```html
<!-- 시맨틱 HTML -->
<nav aria-label="메인 네비게이션">
<main role="main">
<button aria-label="닫기" @click="close">
  <i class="bi bi-x"></i>
</button>

<!-- 폼 접근성 -->
<label for="email">이메일</label>
<input id="email" type="email" aria-describedby="emailHelp">
<div id="emailHelp" class="form-text">이메일을 입력하세요</div>
```

---

## 범용 UX 교훈 (프레임워크 무관, vue-zero 문법)

출처: 범용 UX 교훈. 어떤 프레임워크에서도 통하는 프론트 구현 원칙을 vue-zero(단일 `.vue` SFC, Options API)로 정리한다.

### ① 에러를 `console.error`로 삼키지 말 것 — `error` 상태를 화면에 노출
로더가 실패할 때 `console.error`만 찍고 끝내면, API가 죽었을 때 화면은 **빈 0/빈 목록만 영원히** 보여준다(사용자는 로딩 중인지 고장인지 모른다). `data()`에 반드시 `error` 필드를 두고 catch에서 화면에 띄운다.

```html
<script>
export default {
  data() { return { summary: null, loading: true, error: null } },
  async mounted() { await this.loadDashboard() },
  methods: {
    async loadDashboard() {
      this.loading = true
      this.error = null
      const { data, error } = await useApi('/api/dashboard')   // utils.js의 useApi
      if (error) { this.error = error; this.loading = false; return }
      this.summary = data
      this.loading = false
    }
  }
}
</script>
```
```html
<div v-if="loading" class="text-center py-5"><div class="spinner-border"></div></div>
<div v-else-if="error" class="alert alert-danger">
  {{ error }}
  <button class="btn btn-sm btn-outline-secondary ms-2" @click="loadDashboard">다시 시도</button>
</div>
<div v-else><!-- 콘텐츠 --></div>
```

### ② 로딩·빈·에러 3상태를 항상 화면에 반영
happy path만 그리면 안 된다. 한 데이터 로더는 **로딩 / 빈(결과 0건) / 에러**를 모두 화면에 표현한다. 빈 상태는 단순 "데이터 없음"이 아니라 다음 행동(추가 버튼 등)으로 이어주는 게 좋다.

### ③ 사용자 피드백은 `alert()`가 아니라 토스트/배너로
`alert()`는 브라우저 흐름을 끊고 디자인과 따로 논다. 성공/실패 모두 인라인 토스트나 배너로 통일한다. vue-zero에서 가장 가벼운 토스트 패턴:

```html
<script>
export default {
  data() { return { toast: '' } },
  methods: {
    showToast(msg) { this.toast = msg; setTimeout(() => { this.toast = '' }, 3000) }
  }
}
</script>
<!-- 템플릿 -->
<div v-if="toast" class="toast-container position-fixed bottom-0 start-50 translate-middle-x p-3">
  <div class="toast show"><div class="toast-body">{{ toast }}</div></div>
</div>
```
`confirm()`도 마찬가지로, 위험한 동작(삭제·일괄변경)은 인라인 확인 모달로 대체하는 편이 디자인 일관성과 접근성에 낫다.

### ④ 파생 값은 `data`에 중복 저장하지 말고 `computed`로
필터링·정렬·합계·요약처럼 다른 상태에서 계산되는 값은 `computed`로 뽑는다. `data`에 별도 저장하면 원본이 바뀔 때 동기화 버그가 난다. (목록 필터·페이지네이션·요약 카드가 대표 예)

### ⑤ 한 화면의 모달 제어 방식을 통일
한 화면에서 어떤 모달은 `v-if` 플래그로, 어떤 건 `bootstrap.Modal` 인스턴스로 제어하면 코드가 제각각이 되고 닫을 때 백드롭이 남는 버그가 난다. **vue-zero에서는 `v-if` 플래그 + 직접 오버레이 마크업으로 통일하는 것을 권장**(아래 "vue-zero 실전 패턴"의 모달 절 참조). 부트스트랩 JS 모달을 쓸 거면 화면 전체에서 그 방식 하나로 통일하고, 닫을 때 인스턴스 정리(`getInstance(el)?.hide()`)까지 책임진다.

### ⑥ 분류로 묶는 화면 — 분류의 "변동성·권위 출처"를 먼저 판별해 group-by와 명시 등록 중 맞는 쪽을 고른다 (malgnai agents.vue, 2026-06-22)
탭·팀·카테고리·섹션처럼 **데이터를 분류별로 묶어 그리는 화면**에는 두 가지 정반대 접근이 있고, **어느 쪽이 옳은지는 분류 집합의 성격으로 갈린다.** 한쪽을 무조건 규칙으로 삼지 말고 아래 기준으로 판단한다.

**(A) 데이터에서 group-by로 도출** — 분류가 **자주 추가·변동**되고, 분류 집합의 **권위 출처가 데이터 자체**일 때. (malgnai의 team이 이 경우: 팀이 수시로 생기고 team 값 자체가 권위라, group-by가 옳았다.) 이때 코드에 박은 분류 목록을 순회하며 `.filter(matches)`로 그리면, 그 목록에 없는 새 분류의 데이터가 **통째로 렌더링에서 누락**된다 — 데이터·DB가 다 정상인데 화면에만 안 나와 진단이 오래 걸린다(malgnai에서 새 팀 3개가 통째로 사라짐). 받아온 데이터의 분류 값으로 직접 group-by 하고, 표시용 라벨/아이콘/순서만 메타 맵으로 두며 **메타에 없는 분류는 ID 그대로라도 표시**해 누락을 막는다. 새 분류가 생겨도 화면 코드를 고칠 필요가 없다.

**(B) 분류를 명시적으로 등록·고정** — 분류 집합이 **닫혀 있어야 하거나**(권한 등급, 결제/주문 상태, 워크플로 단계 등), 순서·표시·검증이 **계약처럼 보장**돼야 하거나, **등록 안 된 임의 값이 들어오면 버그로 취급해 막아야** 할 때. 이 경우엔 "등록 안 된 값이 화면에 떠버리는 것" 자체가 결함이므로 **group-by가 오히려 틀리다.** 분류를 코드/스키마에 명시 등록하고, 미등록 값은 경고·차단(또는 "기타"로 격리)한다. 닫힌 enum을 데이터에서 자동 도출하면 오타나 잘못된 값이 조용히 새 카테고리로 둔갑한다.

> 판별 질문: **"이 분류 집합은 누가 정하며, 닫혀 있어야 하는가?"** 데이터를 넣는 쪽이 자유롭게 늘리고 그게 정상이면 (A). 코드/도메인이 미리 합의한 닫힌 집합이고 그 밖의 값은 오류면 (B). 애매하면 "미등록 값이 화면에 떠도 되는가, 막아야 하는가"로 가른다.

```javascript
// (A) 변동·데이터 권위: group-by. 메타에 없는 분류는 ID로라도 노출(누락 방지)
const TEAM_META = { leadership: { label: '리더십팀', icon: 'bi-diagram-3', order: 1 } /* ... */ }
computed: {
  teams() {
    const groups = {}
    for (const a of this.agents) (groups[a.team] ??= []).push(a)
    return Object.entries(groups)
      .map(([id, members]) => ({
        id, members,
        label: TEAM_META[id]?.label ?? id,        // 라벨 없으면 ID 그대로 (누락 X)
        icon:  TEAM_META[id]?.icon  ?? 'bi-people',
        order: TEAM_META[id]?.order ?? 999,
      }))
      .sort((x, y) => x.order - y.order)
  }
}

// (B) 닫힌 집합·계약 고정: 명시 등록을 순회. 미등록 값은 막거나 격리
const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'done', 'cancelled']  // 닫힌 enum
computed: {
  columns() {
    const known = ORDER_STATUSES.map(s => ({ status: s, items: this.orders.filter(o => o.status === s) }))
    const stray = this.orders.filter(o => !ORDER_STATUSES.includes(o.status))
    if (stray.length) console.warn('미등록 주문 상태', stray.map(o => o.status))  // 결함 신호
    return known   // 미등록 상태는 컬럼으로 만들지 않는다(또는 "기타" 컬럼으로 격리)
  }
}
```
> 규모 주의(주로 A): 항목이 수만 건이면 클라이언트 group-by 비용을 따져 서버 집계를 검토한다.
> 과설계 주의(A를 골랐을 때): group-by 한 줄로 풀릴 일을 "전용 집계 API 신설"이나 "분류 마스터 테이블 추가"로 키우지 말 것(malgnai에서 실제로 `/api/teams`를 신설했다 걷어냄). 반대로 (B)가 맞는 화면이라면 분류를 명시 등록하는 것은 과설계가 아니라 필요한 계약이다.

### 체크리스트 (프론트 구현/리뷰 시)
- [ ] 모든 데이터 로더에 `loading`/`error`/빈 상태 3종이 화면에 반영되는가 (console.error로 삼키지 않음)
- [ ] 사용자 피드백이 `alert()`/`confirm()`이 아니라 디자인된 토스트/배너/인라인 모달인가
- [ ] 한 화면의 모달 제어 방식이 통일됐는가
- [ ] 파생 값은 `data` 중복 저장이 아니라 `computed`로 뽑는가
- [ ] 그룹핑 화면(팀·탭·카테고리·상태)에서 **분류의 변동성·권위 출처를 판별해 맞는 방식을 골랐는가** — 변동·데이터 권위면 group-by(미등록 분류도 노출), 닫힌 집합·계약 고정이면 명시 등록(미등록 값은 차단/격리)

---

## vue-zero 실전 패턴 (malgnuniv·malgnsales·malgnhrd 검증, 2026-06-20)

출처: 여러 차례 리뷰로 완성도가 높아진 실제 vue-zero 프로젝트 3종에서 역추출(모드 7). 모두 **단일 `.vue` SFC + Options API + 전역 CSS**다 (ViewLogic의 views/·logic 분리 없음). 권장 기준은 **malgnai 표준(composables 금지, 유틸은 `utils.js`)**이되, 세 프로젝트에서 공통 검증된 패턴만 뽑았다.

> 스택 주의: malgnuniv·malgnsales에는 `app/composables/` 폴더가 있으나 **malgnai CLAUDE.md는 composables 금지**다. 따라서 아래 "데이터 접근" 패턴은 composable 대신 `utils.js`의 `useApi`(또는 mock 함수)를 직접 호출하는 형태로 정규화했다.

### 1. 페이지 객체는 메타 필드(`layout`/`title`/`requiresAuth`)를 export 상단에 선언
세 프로젝트 모두 페이지 `.vue`의 `export default`가 자기 레이아웃·타이틀·인증요건을 선언한다. vue-zero 라우터가 이를 읽어 레이아웃을 씌운다.
- 근거: `malgnsales/app/pages/companies/index.vue` (`layout: 'app', requiresAuth: true`), `malgnuniv/app/pages/admin/users.vue` (`layout: 'lms'`), `malgnhrd/app/pages/admin/courses/new.vue` (`layout: 'admin'`).
```html
<script>
export default {
  title: '고객사',
  layout: 'app',
  requiresAuth: true,
  data() { return { /* ... */ } }
}
</script>
```

### 2. 목록 페이지 = `data`(원본) + `computed`(필터·정렬·페이지) + 3상태 렌더
목록 화면의 표준 골격: 검색어/필터/정렬키는 `data`에, 그것들을 적용한 결과는 `computed`로 파생, 템플릿은 로딩/빈/콘텐츠 3분기. 페이지네이션도 `computed`(`totalPages`/`pagedItems`/`visiblePages`)로 끊는다.
- 근거: `malgnuniv/app/pages/admin/users.vue`의 `filteredUsers → sortedUsers → pagedUsers` 3단 computed 체인, 헤더 클릭 정렬(`setSort`), 페이지당 표시 토글. `malgnsales/.../companies/index.vue`의 `filteredCompanies`(검색·산업군·담당자·정렬 한 곳에서).
```html
<div v-if="loading" class="text-center py-5"><div class="spinner-border spinner-border-sm"></div></div>
<app-empty v-else-if="filteredItems.length === 0" message="등록된 항목이 없습니다.">
  <button class="btn btn-primary btn-sm mt-3" @click="openCreate">첫 항목 추가</button>
</app-empty>
<div v-else>
  <div v-for="item in pagedItems" :key="item.id" class="card mb-2">…</div>
</div>
```

### 3. 폼 페이지 = 단일 `form` 객체 + `validateForm()` + 필드별 인라인 에러
폼 상태는 `form: {}` 하나로 묶고, 제출 전 `validateForm()`이 `formErrors`를 채워 각 입력 아래 인라인으로 표시한다(브라우저 기본 검증/alert 의존 X). 동적 행(차시·항목 추가)은 `splice`로 추가/삭제하고 `:key`에 안정적 키(`_key` 카운터)를 쓴다.
- 근거: `malgnuniv/.../admin/users.vue`의 `validateForm()`+`formErrors`+`<div v-if="formErrors.name" class="text-danger small">`, `generatePassword()`(crypto). `malgnhrd/.../admin/courses/new.vue`의 `form.curriculum` 동적 행 + `_keyCounter`로 안정 키, `submit(status)`로 공개/초안 분기.
```html
<input v-model="form.name" type="text" class="form-control" :class="{ 'is-invalid': formErrors.name }">
<div v-if="formErrors.name" class="text-danger small mt-1">{{ formErrors.name }}</div>
```
> 주의: malgnhrd 폼의 검증 실패가 `alert()`로 처리된 부분은 위 "범용 UX 교훈 ③"에 따라 인라인 에러/토스트가 더 낫다(개선 포인트). 검증 로직 구조 자체는 좋은 패턴.

### 4. 공용 컴포넌트는 얇게: props/emit + slot, 로직 없음
재사용 컴포넌트(`AppModal`/`AppInput`/`AppButton`/`AppEmpty`)는 상태를 갖지 않고 props로 받아 slot으로 펼치며, 변경은 `emit('update:modelValue')`/`emit('close')`로 부모에 위임한다(단방향). `AppButton`처럼 변형(variant·size·loading)은 `computed`로 클래스 매핑.
- 근거: `malgnsales/app/components/AppModal.vue`(`:open`/`title`/`@close`, `teleport to="body"`+`transition`), `AppInput.vue`(`v-model` 위임+`error`), `AppButton.vue`(`variantClass`/`sizeClass` computed+loading 스피너), `AppEmpty.vue`(message+slot).
```html
<!-- AppModal: teleport + transition + v-if(open) + @click.self 닫기 -->
<teleport to="body">
  <transition name="modal">
    <div v-if="open" class="modal d-block" style="background:rgba(0,0,0,.4)" @click.self="$emit('close')">…</div>
  </transition>
</teleport>
```

### 5. 모달은 `v-if` 플래그 + 오버레이 마크업으로 통일 (부트스트랩 JS 모달 X)
세 프로젝트 모두 모달을 `bootstrap.Modal` 인스턴스가 아니라 **`v-if="showXxx"` + 직접 오버레이 div + `@click.self`로 바깥 클릭 닫기**로 제어한다. 부트스트랩 JS 모달 인스턴스를 안 쓰므로 `$nextTick`/`getInstance().hide()`/백드롭 잔존 문제가 원천 차단된다. 접근성은 `role="dialog" aria-modal="true" aria-labelledby` + 열 때 `$nextTick`으로 제목/닫기버튼에 `focus()`.
- 근거: `malgnuniv/.../admin/users.vue`(`.modal-overlay`+`@click.self`로 7개 모달, 슬라이드 패널은 `:class="{ open }"` 트랜지션, `openAddModal`에서 `$nextTick(focus)`), `malgnhrd/.../courses/new.vue`(`pickerOpen` 플래그 + `inset:0` 오버레이), `malgnsales`는 `AppModal` 컴포넌트로 동일 패턴 캡슐화.

### 6. 데이터 접근은 `utils.js`의 `useApi`로 — `{ data, error }` 튜플 반환
malgnuniv/malgnhrd의 `utils.js`는 동일한 `useApi(url, { method, body })`를 제공한다. **에러를 throw하지 않고 `{ data, error }`로 반환**해 호출부가 `if (error)`로 분기하게 한다(토큰 자동 첨부, `res.json().catch`로 빈 바디 방어). composable 대신 이 헬퍼를 직접 호출하는 것이 malgnai 표준에 맞는 정규형.
- 근거: `malgnuniv/app/assets/js/utils.js`·`malgnhrd/app/assets/js/utils.js`의 `useApi`(두 프로젝트 동일), `getLmsUser()`(localStorage 안전 파싱). malgnsales는 composable(`useCompanies`)로 같은 `{ data, error }` 계약을 쓰는데, malgnai 표준에서는 이 로직을 `utils.js` 함수로 옮긴다.
```javascript
// utils.js (import 없이 전역 사용)
async function useApi(url, options = {}) {
  const { method = 'GET', body } = options
  const headers = { 'Content-Type': 'application/json' }
  const token = localStorage.getItem('token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json().catch(() => null)
    if (!res.ok) return { data: null, error: data?.message ?? `HTTP ${res.status}` }
    return { data, error: null }
  } catch { return { data: null, error: '네트워크 오류가 발생했습니다.' } }
}
```

### 7. 레이아웃: 고정 사이드바 + 모바일 드로어(오버레이) + sticky 헤더 + `<slot />`
admin류 레이아웃은 데스크톱에서 `position:fixed` 사이드바 + spacer로 본문을 밀고, 모바일(`≤991.98px`)에서는 `transform:translateX(-100%)`로 숨겼다가 `:class="{ open }"`으로 슬라이드 인 + 반투명 오버레이로 닫는다. 본문은 sticky 헤더 + 스크롤 `<main><slot /></main>`. 전역 CSS는 컴포넌트 `<style>`(scoped 아님)에 두고 색/간격은 CSS 변수(`var(--color-*)`)로.
- 근거: `malgnuniv/app/layouts/admin.vue`(fixed 사이드바+spacer, `@media(max-width:991.98px)` 드로어, `isSidebarOpen` 토글+오버레이, `closeSidebarOnMobile`, sticky `.admin-header`, `<main><slot/></main>`).

> vue-zero 규칙 재확인: ① Options API만 ② `<style scoped>` 금지(전역 `<style>`은 가능) ③ 유틸은 `utils.js`(import 불가) ④ malgnai 표준은 composables 금지 ⑤ 파일 추가/삭제 시 `pnpm run scan`.
