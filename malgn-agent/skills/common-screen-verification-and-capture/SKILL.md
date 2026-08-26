---
name: common-screen-verification-and-capture
description: 화면 검증·캡처 표준 — UI 산출물을 실제 렌더링해 스크린샷 근거로 확인한다(뷰포트·날짜 메타 포함). 플러그인 번들 스크립트 `bin/capture.mjs`(Playwright 기반)로 캡처하고, 위험도(critical/standard/trivial)에 따라 캡처 깊이를 달리해 캡처 남발 없이 정확도를 확보한다. frontend-dev/reviewer/ux-designer/visual-designer/qa-engineer가 화면을 확인·캡처·검증할 때 사용한다.
---

# Screen Verification and Capture Skill

## Definition
표준화된 화면 캡처와 검증 체계로 시각적 산출물의 정확성을 보증하는 기술.
- **대상 에이전트:** frontend-dev, reviewer, ux-designer, visual-designer, qa-engineer
- **핵심 목표:** 정적 상태, 인터랙션 상태, 에러 시나리오, 권한별 뷰를 일관되게 캡처하고 검증

## 캡처 도구: `bin/capture.mjs`

**프로젝트마다 캡처 스크립트를 새로 만들지 말고 플러그인 번들 스크립트를 쓴다.** (과거 서술이던 전역 `shot` CLI·`~/.claude/tools/`는 이 배포 환경에 실재하지 않는 개인 전역 설정 잔존이었다 — 폐기. `bin/capture-all.js`·`bin/capture-nav.js`처럼 프로젝트마다 캡처 스크립트를 새로 작성하던 방식도 여전히 폐기 대상이다.)

**사전 조건(캡처 대상 프로젝트 루트에서 1회)**: `pnpm add -D playwright && pnpm exec playwright install chromium`. `capture.mjs` 자신은 malgn-agent 플러그인 안에 있고 playwright는 대상 프로젝트에 설치되므로, 반드시 그 프로젝트 루트(cwd)에서 실행한다.

```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs" <url> [output.png] [옵션...]
```

> 이 커맨드가 실패하거나(특히 `MODULE_NOT_FOUND`) 새 실행 지시를 쓸 때의 규약 — 따옴표, 이 변수가 치환되는 자리와 안 되는 자리, 맨 명령어를 쓰지 않는 이유 — 은 Skill `common-output-storage-and-path-management` §1-1이 정본이다.

- `--full` 전체 페이지 캡처(스크롤 영역 포함) / `--vp WxH` 뷰포트 지정(기본 1280x800)
- `--responsive [목록]` 여러 뷰포트를 순회 캡처(목록 생략 시 기본 `375x667,768x1024,1440x900` = 모바일/태블릿/데스크톱), 파일명에 `-WxH` 접미사 자동 부여
- `--wait <ms|셀렉터>` 캡처 전 대기(숫자면 ms, 문자열이면 그 셀렉터가 보일 때까지)
- `--click <셀렉터>` 클릭 후(300ms 대기) 캡처 — 드로어 열기·탭 전환 등 인터랙션 상태 확인. `--wait`와 함께 쓰면 "대기→클릭→캡처" 순서로 적용
- `--sel <셀렉터>` 페이지 전체가 아니라 특정 요소 하나만 캡처
- `--dark` 다크모드 강제(prefers-color-scheme: dark 에뮬레이션)

output을 생략하면 URL+타임스탬프로 파일명을 자동 생성해 cwd에 저장한다.

예:
```bash
node "${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs" http://localhost:9000 docs/shots/dashboard.png --full
node "${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs" http://localhost:9000/projects out.png --wait ".project-card" --responsive
node "${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs" http://localhost:9000 sidebar.png --sel "#sidebar"   # 요소 단위 before/after
```

**capture.mjs가 지원하지 않는 것(정직하게 명시 — 과거 `shot` 서술을 그대로 옮기지 않는다)**: `-o` 출력 플래그(대신 두 번째 위치 인자가 output), `--console`(콘솔·페이지 에러 출력), `--header`(커스텀 헤더/토큰 API), 로그인 세션의 자동 저장·재사용. 이런 것이 필요하면 억지로 capture.mjs를 확장하지 않고, 프로젝트 안에 별도 Playwright 스크립트를 짜거나 아래 "인증이 필요한 화면" 절의 E2E 표준을 쓴다.

### 인증이 필요한 화면
`capture.mjs`는 로그인 세션을 자동으로 저장·재사용하지 않는다(전역 레시피·전역 인증 캐시 없음). 인증이 필요한 화면은 `${CLAUDE_PLUGIN_ROOT}/templates/e2e-template/`의 Playwright 표준 `storageState` 방식을 그 프로젝트의 인증 재사용 표준으로 채택한다:

1. `${CLAUDE_PLUGIN_ROOT}/templates/e2e-template/auth.setup.js`를 프로젝트의 `e2e/` 디렉터리로 복사하고 실제 로그인 폼 셀렉터·성공 판정 조건으로 고친다(`${CLAUDE_PLUGIN_ROOT}/templates/e2e-template/README.md`의 6단계 참조).
2. 로그인을 1회만 수행해 세션을 프로젝트 로컬 `e2e/.auth/user.json`에 저장한다(전역 경로 아님 — 프로젝트끼리 세션이 섞이지 않는다).
3. 인증이 필요한 화면을 검증할 때는 그 화면을 이 storageState 기반 E2E 테스트 안에서 `page.screenshot()`으로 함께 캡처하거나, 별도 스크립트에서 `browser.newContext({ storageState: 'e2e/.auth/user.json' })`으로 그 세션을 직접 로드해 재사용한다. `capture.mjs` 자신은 이 옵션을 플래그로 내장하지 않는다 — 향후 확장 시 이 표준 포맷을 그대로 소비하면 된다(지금은 없음, 과장 금지).

관리: 세션 파일(`e2e/.auth/`)은 `.gitignore`에 등록해 커밋하지 않는다. 프로젝트 격리는 전역 캐시가 아니라 각 프로젝트 repo 경로 자체가 보장한다.

## Core Principles

### 1. 뷰포트 표준화
- **데스크톱:** 1440×900 (`--responsive`의 데스크톱 기본값. 뷰포트를 직접 지정하는 `--vp`의 기본값은 1280×800이다. 프로젝트가 다른 값을 명시하면 그쪽을 쓴다)
- **모바일:** 375×667 (iPhone SE) + 추가 필요 시 태블릿 768×1024
- `node "${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs" <url> <output.png> --responsive`로 3종 동시 캡처 → 일관된 해상도(파일명에 `-WxH`가 자동으로 붙는다). **url은 생략할 수 없다** — 빼고 실행하면 그 자리에서 종료된다.
- 장비/브라우저 간 렌더링 편차 문서화 (유연성·표준)

### 2. 캡처 상태 분류
- **정적 상태:** 초기 로드, 데이터 표시, 기본 UI 레이아웃
- **인터랙션 상태:** 호버, 포커스, 클릭 후, 로딩 중, 에러 표시, 성공 알림 — `--click`으로 드로어 열기·탭 전환 후 상태 캡처
- **권한별 뷰:** 미인증, 기본 사용자, 관리자, 감사자 등 역할별 화면 차이
- **에러 시나리오:** 네트워크 실패, 유효성 검사 실패, 서버 에러, 경계 입력

### 3. 캡처 깊이 — 위험도별로 다르게 (빈도보다 정확도)
캡처를 매 스텝 균일하게 반복하면 실효성 없이 토큰만 쓴다. 빈도 대신 위험도로 깊이를 조절한다:

- **critical**(결제·인증·삭제 등 되돌리기 어렵거나 사고 시 파급이 큰 화면): 상태 전이마다 캡처(성공/실패/진행중 각각) + 아래 "Full Checklist" 전 항목 확인.
- **standard**(일반 CRUD·목록·상세 화면): 완성 시점 1회만 + 아래 "경량 체크리스트" 4항목만 확인. critical의 전체 체크리스트를 매번 돌리지 않는다 — 캡처 횟수는 줄이되 항목당 오버헤드도 같이 줄여야 순감소가 된다.
- **trivial**(문구 수정, 색상 미세조정 등): 캡처 생략 가능.

경량 체크리스트를 쓸 때도 "확인함" 한 줄로 뭉뚱그리지 말고, 각 항목의 확인 결과를 텍스트로 명시적으로 짚는다(예: "레이아웃: 카드 3열 정상 / 여백: 헤더-본문 간격 24px 균일 / 필수요소: 필터·페이지네이션 모두 노출 / 반응형: 모바일에서 카드 1열로 정상 전환").

**경량 체크리스트 (standard용, 4항목):**
- [ ] 레이아웃이 깨지지 않았는가
- [ ] 여백/정렬이 의도대로인가
- [ ] 필수 요소(버튼·필터·페이지네이션 등)가 실제로 보이는가
- [ ] 반응형 3종(desktop/tablet/mobile)에서 문제없는가

### 4. 검증 프로세스
- **시각적 일관성:** 색상, 타이포그래피, 간격, 정렬, 아이콘이 설계 명세와 일치
- **기능 동작:** 상호작용 시 예상 상태 변화 (비활성화→활성화, 열림→닫힘, 로딩→완료)
- **접근성:** 포커스 순서, 라벨 가시성, 색상 대비, 스크린 리더 테스트
- **반응형:** 뷰포트 리사이징 시 깨짐 없음, 모바일·태블릿·데스크톱 일관성

### 5. 메타데이터와 추적성
- **캡처 정보:** 뷰포트, 날짜·시간, 브라우저/OS, 테스트 데이터(사용자 역할, 상태), URL/라우트
- **근거 남기기:** "Screenshot A (로그인 상태, 1440×900, 2025-02-10)" 형식으로 실행 조건 기록
- **변경 이력:** 이전 버전과의 비교 가능하도록 태그·커밋·날짜 연결

### 6. 저장 규칙
- **이미지 저장:** `docs/screenshots/<기능>/` 폴더 아래, 파일명은 명명 규칙을 따름
- **명명 규칙:** `<feature>-<state>-<viewport>-<timestamp>.png` (예: `login-error-mobile-20250210.png`)

## Full Checklist (critical 항목용)

### Pre-Capture
- [ ] 뷰포트 설정 확인 (데스크톱/모바일 명시)
- [ ] 테스트 데이터 준비 (사용자 역할, 상태, 입력값)
- [ ] 브라우저 DevTools 켜져 있지 않음 (캡처에 노이즈 방지)
- [ ] 타임존·언어 설정 확인 (날짜 형식, 로컬라이제이션)

### Static State Capture
- [ ] 초기 로드 상태 (스켈레톤, 플레이스홀더 포함)
- [ ] 데이터 표시 상태 (정상 데이터, 긴 텍스트 오버플로우 테스트)
- [ ] 빈 상태 (데이터 없음, 첫 사용)
- [ ] 레이아웃 정렬 (여백, 정렬, 하이어라키 일치)

### Interactive State Capture
- [ ] 호버 상태 (버튼, 링크, 카드 — 색상/스타일 변화)
- [ ] 포커스 상태 (키보드 네비게이션, 포커스 링 가시성)
- [ ] 클릭 후 상태 (눌림, 활성, 토글)
- [ ] 입력 필드 상태 (기본, 포커스 중, 입력됨, 유효성 실패)
- [ ] 로딩 상태 (로더 스피너, 진행률, 비활성화 상태)
- [ ] 알림/토스트 (성공, 경고, 에러 — 색상, 위치, 지속 시간)

### Error Scenario Capture
- [ ] 유효성 검사 실패 (입력 에러 메시지, 필드 강조)
- [ ] 네트워크 에러 (오프라인, 타임아웃, 연결 실패)
- [ ] 서버 에러 (500, 503, 요청 거부)
- [ ] 권한 거부 (403, 접근 불가 상태)
- [ ] 경계 입력 (매우 긴 텍스트, 특수문자, null/빈값)

### Permission-Based Capture
- [ ] 미인증 사용자 (로그인 전 뷰, 리다이렉트)
- [ ] 기본 권한 사용자 (read-only, 제한된 기능)
- [ ] 관리자 권한 (추가 메뉴, 설정 탭, 삭제 버튼)
- [ ] 감사자 권한 (보기 전용, 로그 접근)
- [ ] 역할별 숨겨진 요소 (권한 없으면 보이지 않음 확인)

### Responsiveness Verification
- [ ] 데스크톱 → 태블릿 리사이징 (깨짐, 스크롤 추가 여부)
- [ ] 태블릿 → 모바일 리사이징 (레이아웃 스택, 햄버거 메뉴 작동)
- [ ] 텍스트 리플로우 (행 깨짐, 오버플로우 없음)
- [ ] 이미지 스케일 (흐림 없음, 비율 유지)

### Accessibility Verification
- [ ] 포커스 순서 (논리적, 좌→우·위→아래)
- [ ] 포커스 표시 (명확한 포커스 링, 대비 충족)
- [ ] 라벨 연결 (폼 필드, 버튼 텍스트, aria-label)
- [ ] 색상만 사용 안 함 (에러는 아이콘+텍스트)
- [ ] 스크린 리더 테스트 (헤딩, 리스트, 버튼 읽음)

### Post-Capture Documentation
- [ ] 파일명 명확함 (기능, 상태, 뷰포트 포함)
- [ ] 메타데이터 기록 (뷰포트, 날짜, 테스트 사용자, URL)
- [ ] 변경 사항 주석 (이전 버전과 차이 명시)
- [ ] 캡처 위치 문서화 (PR, 스토리, 버그 리포트 링크)
- [ ] 이미지 최적화 (압축, 포맷 통일)

## 검증 원칙(정직 보고와 연결)
- 캡처만으로 끝내지 말고 **실제 이미지를 열어 눈으로 확인**한다. "동작 확인함/반영됨"은 이미지를 본 뒤에만 보고한다(`${CLAUDE_PLUGIN_ROOT}/knowledge/common/verifiable-output-and-honesty.md`).
- **같은 URL에서 클라이언트 상태만 바뀌는 화면(탭·모달·아코디언 등)을 여러 장 캡처했다면, 파일들이 실제로 다른 내용인지 대조한다** — 파일명이 다르다고 내용도 다르다고 가정하지 않는다. `--click`이 실제로 적용됐는지 의심되면 `md5 file1.png file2.png ...`로 동일 여부를 기계적으로 확인하거나, 최소 1~2개 쌍을 직접 열어 눈으로 비교한다. 실제 사고: frontend-dev가 admin 화면 4개 탭을 "각각 검증했다"며 제출한 스크린샷 4장이 전부 픽셀 단위로 동일한 화면이었음(탭 클릭이 캡처에 반영되지 않음, 기능 자체는 정상이었으나 검증 산출물이 검증되지 않은 것과 같았음).
- **인터랙션이 본질인 UI**(탭·드로어·클릭 이동·active 표시·모바일 메뉴)는 정적 캡처만으로 "확인했다"고 하지 않는다. 다단계 흐름·반복·회귀가 필요하면 E2E 테스트로 승격한다(→ `${CLAUDE_PLUGIN_ROOT}/knowledge/quality/e2e-testing-guide.md`).
- 검증이 권한 규칙에 막히면 우회하지 말고 정직 보고한다(`${CLAUDE_PLUGIN_ROOT}/knowledge/common/permission-policy-compliance.md`).

## 화면 검증 vs E2E 테스트 — 구분
- **`bin/capture.mjs`(화면 검증)**: 즉석·수동 확인용. 개발 중 "지금 이 화면이 의도대로 보이나". 플러그인 번들 스크립트, 산출물은 이미지.
- **E2E 테스트**: 반복·자동 회귀용. 각 프로젝트 repo 안에 `@playwright/test`로 둔다(코드와 함께 버전관리·CI, 프로젝트마다 독립 설치 — 전역 공유 캐시 전제 없음). 인증은 `${CLAUDE_PLUGIN_ROOT}/templates/e2e-template/`의 Playwright 표준 `storageState`를 그 프로젝트에 복사해 쓴다. 스캐폴드: `${CLAUDE_PLUGIN_ROOT}/templates/e2e-template/` (→ `${CLAUDE_PLUGIN_ROOT}/knowledge/quality/e2e-testing-guide.md`).

## Example Usage

```markdown
### Login Screen - Error State (Mobile)
**Viewport:** 375×667 | **Date:** 2025-02-10 | **User:** unauthenticated
**Condition:** Empty password field, submit clicked

![Login Error Mobile](../screenshots/login/login-error-mobile-20250210.png)

**Verification:**
- [x] Error message displayed in red below password field
- [x] "Submit" button remains enabled (allow retry)
- [x] Field text visible (no cutoff on 375px width)
- [x] Accessible: error message linked via aria-describedby
```

## Integration Notes
- **CI/CD:** 각 PR마다 자동 스크린샷 캡처 (Playwright/Chromatic 등)
- **기준선:** main 브랜치 스크린샷과 비교해 회귀 감지
- **리뷰 워크플로우:** reviewer 에이전트가 시각적 차이 승인 전 검증
