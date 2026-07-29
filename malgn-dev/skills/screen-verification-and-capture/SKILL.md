---
name: screen-verification-and-capture
description: 화면 검증·캡처 표준 — UI 산출물을 실제 렌더링해 스크린샷 근거로 확인한다(뷰포트·날짜 메타 포함). 전역 `shot` CLI로 캡처하고, 위험도(critical/standard/trivial)에 따라 캡처 깊이를 달리해 캡처 남발 없이 정확도를 확보한다. frontend-dev/reviewer/ux-designer/visual-designer/qa-engineer가 화면을 확인·캡처·검증할 때 사용한다.
---

# Screen Verification and Capture Skill

## Definition
표준화된 화면 캡처와 검증 체계로 시각적 산출물의 정확성을 보증하는 기술.
- **대상 에이전트:** frontend-dev, reviewer, ux-designer, visual-designer, qa-engineer
- **핵심 목표:** 정적 상태, 인터랙션 상태, 에러 시나리오, 권한별 뷰를 일관되게 캡처하고 검증

## 전역 `shot` 도구

**프로젝트마다 캡처 스크립트를 새로 만들지 말고 전역 명령 `shot`을 쓴다.** (과거의 `bin/capture-all.js`·`bin/capture-nav.js`를 프로젝트마다 작성하던 방식은 폐기.)

Playwright + 헤드리스 Chromium은 이미 전역 1곳(`~/.claude/tools/`)에 설치돼 있고, 브라우저 바이너리는 `~/Library/Caches/ms-playwright` OS 공유 캐시를 쓴다 → 프로젝트마다 재설치·재작성 불필요. `shot`은 PATH에 있으므로 어느 프로젝트 디렉터리에서든 바로 호출된다.

```bash
shot <url> [옵션]
```
- `-o <path>` 출력 파일(기본 `./shot-<ts>.png`)
- `--full` 전체 페이지 / `--vp 1440x900` 뷰포트 / `--responsive` 데스크톱+태블릿+모바일 3종 동시
- `--wait ".selector"` 또는 `--wait 1500`(ms) 렌더 대기
- `--click ".selector"` 촬영 전 클릭(드로어 열기·탭 전환·메뉴 이동 등 인터랙션, 여러 번 가능)
- `--sel "#el"` 특정 요소만 / `--dark` 다크모드 / `--console` 콘솔·페이지 에러 출력
- `--header "Authorization: Bearer ..."` 토큰 API

예:
```bash
shot http://localhost:9000 --full -o docs/shots/dashboard.png
shot http://localhost:9000/projects --wait ".project-card" --responsive
shot http://localhost:9000 --sel "#sidebar" -o sidebar.png     # 요소 단위 before/after
```

### 인증이 필요한 화면
1. **인증 레시피(완전 자동, 권장)** — `~/.claude/tools/auth/<host>.recipe.mjs`가 있으면 `shot`이 캡처 직전 자동 실행해 세션을 신선하게 만든다(토큰 만료·수동 로그인 없음). 프로젝트에 레시피가 없으면 필요 시 만든다(로컬 개발 검증 전용).
2. **수동 저장(레시피 없을 때)** — `shot login <url>` 실행 → 뜬 브라우저에서 로그인 → 자동 감지(또는 Enter) → 세션이 `~/.claude/tools/auth/<host>.json`에 저장되고 이후 `shot <url>`에 자동 적용된다.

관리: `shot auth ls`(목록), `shot auth rm <host>`(삭제). host는 도메인+포트로 구분되어 프로젝트끼리 인증이 섞이지 않는다.

## Core Principles

### 1. 뷰포트 표준화
- **데스크톱:** 1920×1080 (또는 프로젝트 명시 기본값)
- **모바일:** 375×667 (iPhone SE) + 추가 필요 시 태블릿 768×1024
- `shot --responsive`로 3종 동시 캡처 → 일관된 해상도
- 장비/브라우저 간 렌더링 편차 문서화 (유연성·표준)

### 2. 캡처 상태 분류
- **정적 상태:** 초기 로드, 데이터 표시, 기본 UI 레이아웃
- **인터랙션 상태:** 호버, 포커스, 클릭 후, 로딩 중, 에러 표시, 성공 알림 — `--click`으로 드로어 열기·탭 전환 후 상태 캡처
- **권한별 뷰:** 미인증, 기본 사용자, 관리자, 감사자 등 역할별 화면 차이
- **에러 시나리오:** 네트워크 실패, 유효성 검사 실패, 서버 에러, 경계 입력

### 3. 캡처 깊이 — 위험도별로 다르게 (빈도보다 정확도)
캡처를 매 스텝 균일하게 반복하면 실효성 없이 토큰만 쓴다. 빈도 대신 위험도로 깊이를 조절한다(2026-07-23 대표+7에이전트 교차토론 합의):

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
- **근거 남기기:** "Screenshot A (로그인 상태, 1920×1080, 2025-02-10)" 형식으로 실행 조건 기록
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
- 캡처만으로 끝내지 말고 **실제 이미지를 열어 눈으로 확인**한다. "동작 확인함/반영됨"은 이미지를 본 뒤에만 보고한다(`common/verifiable-output-and-honesty.md`).
- **같은 URL에서 클라이언트 상태만 바뀌는 화면(탭·모달·아코디언 등)을 여러 장 캡처했다면, 파일들이 실제로 다른 내용인지 대조한다** — 파일명이 다르다고 내용도 다르다고 가정하지 않는다. `--click`이 실제로 적용됐는지 의심되면 `md5 file1.png file2.png ...`로 동일 여부를 기계적으로 확인하거나, 최소 1~2개 쌍을 직접 열어 눈으로 비교한다. 실제 사고: frontend-dev가 admin 화면 4개 탭을 "각각 검증했다"며 제출한 스크린샷 4장이 전부 픽셀 단위로 동일한 화면이었음(탭 클릭이 캡처에 반영되지 않음, 기능 자체는 정상이었으나 검증 산출물이 검증되지 않은 것과 같았음, lesson `f15fd34c`).
- **인터랙션이 본질인 UI**(탭·드로어·클릭 이동·active 표시·모바일 메뉴)는 정적 캡처만으로 "확인했다"고 하지 않는다. 다단계 흐름·반복·회귀가 필요하면 E2E 테스트로 승격한다(→ `quality/e2e-testing-guide.md`).
- 검증이 권한 규칙에 막히면 우회하지 말고 정직 보고한다(`common/permission-policy-compliance.md`).

## 화면 검증 vs E2E 테스트 — 구분
- **`shot`(화면 검증)**: 즉석·수동 확인용. 개발 중 "지금 이 화면이 의도대로 보이나". 전역 도구, 산출물은 이미지.
- **E2E 테스트**: 반복·자동 회귀용. 각 프로젝트 repo 안에 `@playwright/test`로 둔다(코드와 함께 버전관리·CI). 브라우저 공유 캐시와 `shot`의 인증(storageState/레시피)을 그대로 재사용한다. 스캐폴드: `~/.claude/tools/e2e-template/` (→ `quality/e2e-testing-guide.md`).

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
