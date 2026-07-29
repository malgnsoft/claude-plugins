# Vue-Zero 아키텍처 규칙

vue-zero는 단일 `.vue` SFC(Single File Component) 기반의 간결한 아키텍처를 따릅니다. 아래 세 가지 핵심 규칙을 반드시 준수해야 합니다.

## 핵심 규칙 3가지

### 1. Composables 절대 금지

**원칙**: Vue Composition API의 Composables를 사용하면 안 됩니다. 모든 로직은 각 페이지 Vue 파일 내에서 Options API로 구성합니다.

**이유**:
- vue-zero는 파일 자동 스캔 기반의 단순 라우터를 사용하므로, Composables의 재사용 로직은 불필요한 복잡성을 더합니다
- 각 페이지가 자기 로직을 완전히 담도록 설계되어, 컴포넌트 간 의존도를 최소화합니다
- 유지보수할 때 페이지 파일 하나만 열어도 그 화면의 모든 로직이 명확하게 보입니다

**안티패턴 (절대 금지)**:
```javascript
// ❌ composables/useUser.js
export function useUser() {
  const user = ref(null)
  const loading = ref(false)
  
  async function fetchUser() {
    loading.value = true
    // ...
  }
  return { user, loading, fetchUser }
}

// ❌ pages/profile.vue에서 import
import { useUser } from '../composables/useUser.js'
export default {
  setup() {
    const { user, loading, fetchUser } = useUser()  // ❌ 절대 금지
  }
}
```

**올바른 패턴**:
```javascript
// ✅ pages/profile.vue
export default {
  data() {
    return {
      user: null,
      loading: false,
    }
  },
  methods: {
    async fetchUser() {
      this.loading = true
      const { data, error } = await window.useApi('/api/user')
      if (error) { this.error = error; return }
      this.user = data
      this.loading = false
    }
  },
  mounted() {
    this.fetchUser()
  }
}
```

### 2. 각 페이지별 Vue 파일에서 모든 로직 구성

**원칙**: 하나의 페이지는 하나의 `.vue` 파일로 작성하며, 그 파일이 그 페이지의 모든 로직(data, methods, computed, lifecycle)을 담습니다.

**구조**:
```
app/pages/
├── index.vue                    # 홈 페이지
├── users/
│   ├── index.vue               # 사용자 목록
│   └── [id].vue                # 사용자 상세
├── companies/
│   ├── index.vue               # 고객사 목록
│   ├── [id].vue                # 고객사 상세
│   └── new.vue                 # 고객사 생성
└── settings/
    └── index.vue               # 설정
```

**각 페이지 파일의 구성**:
```html
<template>
  <div class="page-container">
    <!-- 페이지 마크업 -->
  </div>
</template>

<script>
export default {
  // 페이지 메타 정보
  title: '사용자 관리',
  layout: 'app',
  requiresAuth: true,
  
  // 로컬 상태
  data() {
    return {
      users: [],
      loading: false,
      error: null,
      filter: '',
      sortBy: 'name'
    }
  },
  
  // 파생 상태
  computed: {
    filteredUsers() {
      return this.users
        .filter(u => u.name.includes(this.filter))
        .sort((a, b) => a[this.sortBy] > b[this.sortBy] ? 1 : -1)
    }
  },
  
  // 페이지 로직
  methods: {
    async loadUsers() {
      this.loading = true
      const { data, error } = await window.useApi('/api/users')
      if (error) { this.error = error; this.loading = false; return }
      this.users = data
      this.loading = false
    },
    
    deleteUser(id) {
      if (!confirm('정말 삭제하시겠습니까?')) return
      // 삭제 로직
    }
  },
  
  // 생명주기
  mounted() {
    this.loadUsers()
  }
}
</script>

<style>
/* 전역 CSS (scoped 금지) */
.page-container {
  padding: 1rem;
}
</style>
```

**주의사항**:
- 한 파일 내에서 모든 상태·로직을 관리하므로, 파일 크기가 커질 수 있습니다 — 이는 정상입니다
- 페이지가 복잡해도 "로직을 composable로 분리"하지 마세요 — 그 대신 페이지 메서드를 논리 섹션으로 주석 분리합니다
- 공유 유틸 함수는 `utils.js`에만 둡니다 (다음 규칙 참조)

### 3. 공통 함수는 utils.js에서 관리

**원칙**: 여러 페이지에서 공유되는 유틸리티 함수는 **`utils.js`** 파일에만 작성합니다.

**위치**: `app/assets/js/utils.js`

**utils.js에 둬야 할 함수들**:
- API 래퍼 (예: `useApi(url, options)`)
- 데이터 포맷팅 (예: `formatDate(date)`, `formatCurrency(amount)`)
- 검증 (예: `validateEmail(email)`, `validateForm(data)`)
- 상수 및 매핑 (예: `USER_ROLES`, `STATUS_LABELS`)
- localStorage 접근 (예: `getUser()`, `setToken(token)`)

**우리가 사용 중인 `useApi` 함수**:
```javascript
// app/assets/js/utils.js (window에 등록됨)
async function useApi(url, options = {}) {
  const { method = 'GET', body } = options
  const headers = { 'Content-Type': 'application/json' }
  
  // 토큰 자동 첨부
  const token = localStorage.getItem('token')
  if (token) headers['Authorization'] = `Bearer ${token}`
  
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json().catch(() => null)
    
    // 에러를 throw하지 않고 { data, error } 반환
    if (!res.ok) {
      return { data: null, error: data?.message ?? `HTTP ${res.status}` }
    }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: '네트워크 오류' }
  }
}
```

**페이지에서 사용**:
```javascript
export default {
  data() {
    return { users: [], error: null }
  },
  methods: {
    async loadUsers() {
      // window.useApi를 import 없이 직접 호출
      const { data, error } = await window.useApi('/api/users')
      
      if (error) {
        this.error = error  // 화면에 에러 표시
        return
      }
      
      this.users = data
    }
  }
}
```

**utils.js에 함수 추가하는 절차**:

1. `app/assets/js/utils.js`에 함수 작성:
   ```javascript
   function formatDate(date) {
     return new Date(date).toLocaleDateString('ko-KR')
   }
   ```

2. `app/assets/js/index.js`에서 window에 등록:
   ```javascript
   import { formatDate } from './utils.js'
   window.formatDate = formatDate
   ```

3. 페이지에서 바로 사용:
   ```javascript
   export default {
     computed: {
       displayDate() {
         return window.formatDate(this.createdAt)  // ✅ import 없음
       }
     }
   }
   ```

## 아키텍처 체크리스트

vue-zero 프로젝트 착수 전:
- [ ] 새 기능을 composable로 분리할 생각을 했는가 → **하지 말 것**
- [ ] 페이지 파일이 여러 개로 쪼개져 있는가 → **하나의 페이지 = 하나의 `.vue` 파일로 통일**
- [ ] 여러 페이지가 쓸 함수를 composable로 만들었는가 → **`utils.js`에 옮길 것**
- [ ] utils.js 함수가 window에 등록돼 있는가 → `app/assets/js/index.js`에서 확인
- [ ] 신규 공유 로직 파일의 폴더 위치를 정할 때, 프로젝트 내 기존 폴더명 선례(예: `composables/`)를 그대로 따르지 않고 이 문서의 정책을 재확인해 결정했는가(lesson `4faba7fd`)?

## 관련 참고 자료

- 이 플러그인에 함께 번들된 `knowledge/frontend/vue-zero-patterns.md` — 범용 UX 교훈, 실전 패턴 (API 연동, 폼, 레이아웃)
- 프로젝트 `CLAUDE.md` — 규칙 5 "Blob URL 패턴" (왜 import가 작동 안 하는지)
