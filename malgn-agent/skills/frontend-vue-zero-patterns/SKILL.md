---
name: frontend-vue-zero-patterns
description: Vue-Zero 플랫폼 특화 패턴 — Blob URL, window 전역 등록, Options API, utils.js 활용 규칙. vue-zero 프로젝트에서 Vue 컴포넌트 작업 시 사용.
---

# Vue-Zero Platform Patterns

Vue-Zero 플랫폼 기반 프로젝트에서 반드시 따라야 할 필수 패턴과 규칙입니다. 새로운 컴포넌트·유틸리티 작성 전에 이 가이드를 확인하세요.

## 핵심 패턴

### 1. Blob URL 패턴 (이미지/파일 다운로드)

**원칙**: 동적으로 생성된 이미지나 파일은 Blob URL로 관리하며, 메모리 누수를 방지하기 위해 사용 후 즉시 해제합니다.

**구현 규칙**:
- [ ] Blob 생성 후 `URL.createObjectURL(blob)` 호출
- [ ] 이미지 src 또는 다운로드 링크 href에 할당
- [ ] 컴포넌트 언마운트 또는 파일 다운로드 완료 시 `URL.revokeObjectURL(url)` 호출
- [ ] Blob URL은 전역 변수가 아니라 컴포넌트 data/ref에 저장

**구현 예**:
```javascript
// ✅ 권장 패턴
export default {
  data() {
    return { blobUrl: null };
  },
  methods: {
    async generateImage() {
      const blob = await this.createImageBlob();
      this.blobUrl = URL.createObjectURL(blob);
      // src에 this.blobUrl 할당
    }
  },
  beforeUnmount() {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
  }
};

// ❌ 피할 것: 전역 window에 저장
window.blobUrl = URL.createObjectURL(blob); // 메모리 누수 위험
```

---

### 2. Window 전역 등록 패턴 (공유 유틸 노출)

**원칙**: 페이지에서 `import`가 작동하지 않으므로, 공유 유틸은 등록 스크립트에서 `window`에 올려 페이지가 `window.*`로 직접 호출합니다.

**구현 규칙**:
- [ ] 유틸 본체는 `app/assets/js/utils.js`에 작성
- [ ] 등록 시점은 `app/assets/js/index.js` 한 곳으로 고정 (빌드 스텝이 없으므로 `main.js`·`App.vue`는 존재하지 않음)
- [ ] 등록된 함수는 JSDoc 주석으로 용도·입출력 타입 명시
- [ ] 페이지에서는 `import` 없이 `window.함수명`으로 호출

**구현 예**:
```javascript
// app/assets/js/index.js — 등록 스크립트
import { formatDate, rotateImage } from './utils.js'

/**
 * 날짜 포맷팅 — 'YYYY-MM-DD' 문자열 반환
 * @see utils.js
 */
window.formatDate = formatDate

/**
 * 이미지 회전 — (File, 0|90|180|270) => Promise<Blob>
 * @see utils.js
 */
window.rotateImage = rotateImage

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
      const rotated = await window.rotateImage(
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
// utils.js
/**
 * 이미지 Blob을 회전
 * @param {Blob} imageBlob - 원본 이미지
 * @param {number} angle - 회전 각도(0, 90, 180, 270)
 * @returns {Promise<Blob>} 회전된 이미지 Blob
 * @throws {Error} 지원하지 않는 각도
 */
export async function rotateImageBlob(imageBlob, angle) {
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
export function formatDate(date, options = {}) {
  const { locale = 'en-US' } = options;
  return new Intl.DateTimeFormat(locale).format(date);
}

/**
 * 토큰 저장 (localStorage 접근도 utils.js에 둔다)
 * @param {string} token
 */
export function setToken(token) {
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

### 파일 처리 기능 추가 시

- [ ] Blob 생성 후 URL.createObjectURL() 호출하는가?
- [ ] 컴포넌트 언마운트 시 URL.revokeObjectURL() 호출하는가?
- [ ] Blob URL을 window 전역이 아닌 컴포넌트 data에 저장하는가?

### window 전역 API 등록 시

- [ ] 유틸 본체를 `app/assets/js/utils.js`에 두었는가?
- [ ] 등록을 `app/assets/js/index.js`에서 하는가?
- [ ] 페이지에서 `import` 없이 `window.함수명`으로 호출하는가?
- [ ] 각 함수에 JSDoc 주석으로 용도·입출력 타입 명시하는가?

### 컴포넌트 재사용성 검증

- [ ] Props로 모든 설정 가능한가?
- [ ] 상태 변경은 emit으로 처리하는가?
- [ ] 글로벌 상태에 직접 의존하지 않는가?
- [ ] Slot으로 템플릿 유연성 제공하는가?

---

**참고**: Vue-Zero는 lightweight 플랫폼입니다. 복잡한 상태 관리는 가능한 피하고, Props/emit 기반 단방향 데이터 흐름을 유지하세요.
