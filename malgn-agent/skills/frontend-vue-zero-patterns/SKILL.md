---
name: frontend-vue-zero-patterns
description: Vue-Zero 플랫폼 특화 패턴 — 인증 리소스의 객체 URL(Blob) 처리, import 없는 전역 유틸 노출, Options API, utils.js 활용 규칙. vue-zero 프로젝트에서 Vue 컴포넌트 작업 시 사용.
---

# Vue-Zero Platform Patterns

Vue-Zero 플랫폼 기반 프로젝트에서 반드시 따라야 할 필수 패턴과 규칙입니다. 새로운 컴포넌트·유틸리티 작성 전에 이 가이드를 확인하세요.

## 핵심 패턴

### 1. 객체 URL 패턴 (인증이 걸린 이미지·파일)

**원칙**: 인증이 필요한 바이너리는 `fetch`로 직접 받아 `URL.createObjectURL(blob)`로 임시 URL을 만들어 물리고, 다 쓰면 즉시 해제합니다.

**왜 필요한가**: API 호출은 `Authorization: Bearer <토큰>` 헤더로 인증하는데, `<img src>`·`<video src>`·`<a href>`는 브라우저가 알아서 요청을 보내는 자리라 **커스텀 헤더를 실을 수 없습니다.** 인증이 걸린 API URL을 이 속성에 그냥 넣으면 토큰 없이 요청이 나가 **401**이 됩니다. 그래서 헤더를 붙일 수 있는 `fetch`로 받아 온 Blob을 임시 URL로 바꿔 물려야 합니다.

**언제 쓰지 않는가**: `/assets/images/logo.png` 같은 **정적·비인증 자산은 그냥 `<img src="/assets/images/logo.png">`로 씁니다.** 애초에 토큰이 필요 없으므로 이 패턴을 쓰면 코드만 늘고 브라우저 캐시도 못 쓰게 됩니다. 판단 기준은 "파일이냐 이미지냐"가 아니라 **"그 URL이 인증을 요구하느냐"**입니다.

또 하나 정당한 경우가 있습니다 — **브라우저에서 만들어 낸 데이터**(CSV 내보내기 등)는 받아올 서버 URL 자체가 없으므로, 객체 URL로 만들어 `<a download>`에 넘깁니다.

**구현 규칙**:
- [ ] 인증 API 바이너리는 `fetch`(+`Authorization` 헤더) 헬퍼로 받는다 — API URL을 `src`/`href`에 직접 넣지 않는다
- [ ] Blob 확보 후 `URL.createObjectURL(blob)` 호출
- [ ] 컴포넌트 언마운트·화면 전환·다운로드 완료 시 `URL.revokeObjectURL(url)` 호출
- [ ] 객체 URL은 전역이 아니라 컴포넌트 `data`에 저장
- [ ] 정적 자산에는 적용하지 않는다

**구현 예**:
```javascript
// ✅ 인증이 걸린 영상 스트림 — 헤더를 실을 수 있는 fetch로 받아 객체 URL로 재생
export default {
  data() {
    return { videoUrl: null };
  },
  methods: {
    async playVideo() {
      // useApiBlob: 토큰을 헤더에 붙여 fetch하고 { blob, filename, error }를 반환하는 utils.js 헬퍼
      const { blob, error } = await useApiBlob(`/api/lectures/${this.lid}/stream`);
      if (error) { this.error = error; return; }
      this.videoUrl = URL.createObjectURL(blob);
    }
  },
  beforeUnmount() {
    if (this.videoUrl) URL.revokeObjectURL(this.videoUrl);  // 해제 필수
  }
};

// ❌ 401이 난다: 브라우저가 이 요청에 Authorization 헤더를 붙이지 않는다
// <video :src="`/api/lectures/${lid}/stream`">

// ❌ 불필요: 정적 자산은 인증이 없으므로 그대로 쓴다
// <img :src="staticLogoBlobUrl">   →   <img src="/assets/images/logo.png">

// ❌ 피할 것: 전역 window에 저장 (해제 시점을 잃어 메모리 누수)
window.blobUrl = URL.createObjectURL(blob);
```

---

### 2. 전역 유틸 노출 패턴 (import 없이 공유하기)

**원칙**: 페이지에서 `import`가 작동하지 않으므로, 공유 유틸은 `utils.js`에 **`export` 없이** 선언하고 `index.html`이 이를 **일반 `<script>`로 로드**합니다. 일반 스크립트의 최상위 `function` 선언은 그대로 전역이 되므로 페이지가 바로 호출합니다.

**구현 규칙**:
- [ ] 유틸 본체는 `app/assets/js/utils.js`에 작성 (빌드 스텝이 없으므로 `main.js`·`App.vue`는 존재하지 않음)
- [ ] `utils.js`에 **`export`를 쓰지 않는다** — 모듈이 아닌 스크립트에서 `export`는 `SyntaxError`라 파일 전체가 실행되지 않는다
- [ ] `index.html`에서 `type="module"` **없이** `<script src="/assets/js/utils.js">`로 로드 (모듈로 로드하면 선언이 모듈 안에 갇혀 페이지에서 안 보인다)
- [ ] 별도의 등록 전용 파일을 만들지 않는다
- [ ] 각 함수에 JSDoc 주석으로 용도·입출력 타입 명시
- [ ] 페이지에서는 `import` 없이 함수명으로 직접 호출

**구현 예**:
```javascript
// app/assets/js/utils.js — export 없이 선언한다
/**
 * 날짜 포맷팅 — 'YYYY-MM-DD' 문자열 반환
 */
function formatDate(date) { /* ... */ }

/**
 * 이미지 회전 — (File, 0|90|180|270) => Promise<Blob>
 */
async function rotateImage(file, angle) { /* ... */ }
```

```html
<!-- index.html — type="module" 없이 로드 -->
<script src="/assets/js/utils.js"></script>
```

페이지에서는 `formatDate(...)`로 바로 부릅니다. `window.formatDate(...)`도 동일하게 동작하니(일반 스크립트의 `function` 선언은 `window` 속성이기도 함) 프로젝트에서 쓰던 표기에 맞추면 됩니다.

**함수가 아닌 값을 공유할 때**: `const`·`let`으로 선언한 값(상수 매핑, `Vue.ref()` 공유 상태)은 이름으로는 보이지만 `window` 속성이 되지는 않습니다. `window.이름`으로 접근할 계획이라면 `utils.js` **맨 끝에서** 명시적으로 등록합니다.

```javascript
// utils.js 맨 끝 — window 접근이 필요한 것만
window.DEAL_STAGE_LABELS = DEAL_STAGE_LABELS
window.authUser = authUser
```

```javascript
// ❌ 피할 것: 페이지 .vue 안에서 utils.js를 import
// import { formatDate } from '../assets/js/utils.js'  // 작동하지 않음
```

---

### 3. Options API 구조 규칙 (Vue 컴포넌트)

**원칙**: 복잡한 상태 로직을 가진 컴포넌트는 Options API를 사용하며, 계층 구조를 명확히 합니다.

**구현 규칙**:
- [ ] 컴포넌트 섹션 순서: `template` → `script` (props, data, computed, methods, lifecycle) → `style`
- [ ] `data()`는 객체 반환 함수로 정의, 모든 필드 초기화
- [ ] `computed`는 의존성 추적용이고, side effect 없는 순수 로직만 포함
- [ ] `methods`는 사용자 상호작용/이벤트 핸들러 중심
- [ ] `watch`는 깊은 감시가 필요한 경우만, handler와 함께 명시
- [ ] 라이프사이클 훅(`created`, `mounted`, `unmounted`) 순서대로 정의

**구현 예**:
```vue
<template>
  <div class="image-editor">
    <img v-if="processedImageUrl" :src="processedImageUrl" />
    <button @click="rotateImage">회전</button>
  </div>
</template>

<script>
export default {
  name: 'ImageEditor',
  props: {
    sourceFile: File
  },
  data() {
    return {
      angle: 0,
      processedImageUrl: null,
      isProcessing: false
    };
  },
  computed: {
    isRotated() {
      return this.angle !== 0;
    }
  },
  methods: {
    async rotateImage() {
      this.isProcessing = true;
      // utils.js의 전역 함수를 import 없이 호출 (window.rotateImage로 써도 동일)
      const rotated = await rotateImage(
        this.sourceFile,
        this.angle
      );
      this.processedImageUrl = URL.createObjectURL(rotated);
      this.isProcessing = false;
    }
  },
  created() {
    // 초기화 로직
  },
  beforeUnmount() {
    if (this.processedImageUrl) {
      URL.revokeObjectURL(this.processedImageUrl);
    }
  }
};
</script>

<style>
/* 전역 CSS (scoped 금지) */
.image-editor {
  padding: 1rem;
}
</style>
```

---

### 4. Utils.js 활용 규칙 (공유 유틸리티)

**원칙**: 여러 페이지가 공유하는 로직은 `app/assets/js/utils.js` **한 파일에만** 작성합니다. 유틸 파일을 성격별로 쪼개지 않습니다.

**구현 규칙**:
- [ ] 공유 로직은 파일 성격을 가리지 않고 `utils.js`에 모음 — API 래퍼(`useApi`), 포맷팅, 검증, 상수·매핑, `localStorage` 접근까지 포함
- [ ] 계산만 하는 함수는 순수 함수로 유지(입력에만 의존)하되, API·저장소 접근 함수는 side effect가 있는 게 정상
- [ ] 함수 시그니처: JSDoc 주석으로 입출력 타입 명시
- [ ] 매개변수는 최대 3개 이하 (많으면 객체로 그룹화)
- [ ] `useApi`처럼 호출 측이 화면에 에러를 표시해야 하는 함수는 throw 대신 `{ data, error }`를 반환
- [ ] 비동기 함수(파일 처리, API 호출)는 `async/await` 사용

**구현 예**:
```javascript
// utils.js — 전부 export 없이 선언한다
/**
 * 이미지 Blob을 회전
 * @param {Blob} imageBlob - 원본 이미지
 * @param {number} angle - 회전 각도(0, 90, 180, 270)
 * @returns {Promise<Blob>} 회전된 이미지 Blob
 * @throws {Error} 지원하지 않는 각도
 */
async function rotateImageBlob(imageBlob, angle) {
  if (![0, 90, 180, 270].includes(angle)) {
    throw new Error(`Invalid angle: ${angle}`);
  }
  // 실제 회전 로직
  return rotatedBlob;
}

/**
 * 날짜 포맷팅 (순수 함수)
 * @param {Date} date
 * @param {Object} options - { locale: 'ko-KR', ... }
 * @returns {string} 포맷된 날짜
 */
function formatDate(date, options = {}) {
  const { locale = 'en-US' } = options;
  return new Intl.DateTimeFormat(locale).format(date);
}

/**
 * 토큰 저장 (localStorage 접근도 utils.js에 둔다)
 * @param {string} token
 */
function setToken(token) {
  localStorage.setItem('token', token);
}

// ❌ 피할 것: 유틸을 성격별 파일로 쪼개기
// browserUtils.js / apiUtils.js 등을 따로 만들지 않는다 — utils.js 한 곳에 모은다
```

---

### 5. 컴포넌트 재사용성 패턴

**원칙**: Props로 모든 설정을 받고, 상태 변경은 emit으로 부모에게 위임합니다.

**구현 규칙**:
- [ ] 컴포넌트는 프레젠테이션(UI)과 로직(business) 분리
- [ ] Props는 타입과 기본값 명시 (`type`, `default` 포함)
- [ ] 상태 변경은 `this.$emit('update:fieldName', newValue)` 또는 `v-model` 사용
- [ ] 자식 컴포넌트는 글로벌 상태(Vuex, Pinia)에 직접 접근 금지
- [ ] Slot을 활용해 템플릿 유연성 확보

**구현 예**:
```vue
<script>
export default {
  props: {
    modelValue: { type: File, required: true },
    maxSize: { type: Number, default: 10 * 1024 * 1024 }, // 10MB
    allowedTypes: { type: Array, default: () => ['image/jpeg', 'image/png'] }
  },
  methods: {
    async handleFileUpload(file) {
      if (file.size > this.maxSize) {
        this.$emit('error', 'File too large');
        return;
      }
      this.$emit('update:modelValue', file);
    }
  }
};
</script>
```

## 적용 체크리스트

### 새 컴포넌트 작성 전

- [ ] Vue-Zero 기본 구조(template-script-style 순서) 따랐는가?
- [ ] Props, data, computed, methods 섹션 분리되었는가?
- [ ] 공유 로직은 `utils.js` 한 곳에 작성하는가?

### 파일·이미지 처리 기능 추가 시

- [ ] 그 URL이 인증을 요구하는가? (아니면 객체 URL 없이 `src`에 직접 넣는다)
- [ ] 인증이 필요하면 `fetch` 헬퍼로 받아 URL.createObjectURL() 호출하는가?
- [ ] 컴포넌트 언마운트·다운로드 완료 시 URL.revokeObjectURL() 호출하는가?
- [ ] 객체 URL을 window 전역이 아닌 컴포넌트 data에 저장하는가?

### 전역 유틸 추가 시

- [ ] 유틸 본체를 `app/assets/js/utils.js`에 두었는가?
- [ ] `utils.js`에 `export`가 하나도 없는가?
- [ ] `index.html`에서 `type="module"` 없는 `<script>`로 로드하는가?
- [ ] 페이지에서 `import` 없이 함수명으로 호출하는가?
- [ ] 함수가 아닌 값을 `window.*`로 쓸 거라면 `utils.js` 끝에서 등록했는가?
- [ ] 각 함수에 JSDoc 주석으로 용도·입출력 타입 명시하는가?

### 컴포넌트 재사용성 검증

- [ ] Props로 모든 설정 가능한가?
- [ ] 상태 변경은 emit으로 처리하는가?
- [ ] 글로벌 상태에 직접 의존하지 않는가?
- [ ] Slot으로 템플릿 유연성 제공하는가?

---

**참고**: Vue-Zero는 lightweight 플랫폼입니다. 복잡한 상태 관리는 가능한 피하고, Props/emit 기반 단방향 데이터 흐름을 유지하세요.
