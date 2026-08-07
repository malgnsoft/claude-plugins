# 스크린샷 캡처 가이드 (배경)

> **본문(캡처 절차·CLI 플래그·상태별 체크리스트)은 `skills/common-screen-verification-and-capture`로 이관됨** (2026-08-07, §1.3 이관 절차 — D8 결정). 캡처 실행은 `malgn-agent/bin/capture.mjs`(신규 번들 스크립트, `--full/--vp/--wait/--click/--sel/--dark/--responsive`)를 쓴다 — 과거 이 문서에 있던 프로젝트별 `bin/capture-all.js`/`bin/capture-nav.js` 복사-커스터마이즈 템플릿과 전역 `shot` CLI 서술은 폐기됐다. 실행법은 `node <malgn-agent 경로>/bin/capture.mjs --help` 또는 스킬 SKILL.md 참조.

이 문서에는 절차가 바뀌어도 남는 배경(왜 이 규칙이 있는가)만 남긴다.

## 하드 게이트: "본 것"과 "안 본 것"을 구분한다

UI/앱 화면을 리뷰·평가·개선하면서 **실제 렌더링된 화면을 보지 않는 것은 리뷰 실패다.** "화면 캡처 0개"로 UI/UX 리뷰를 보고하지 않는다. 로컬 서버를 띄울 수 없는 등 불가피하게 화면을 못 봤다면, 보고서에 **"화면 미확인 — 코드 기반 추정"임을 명시**한다(안 본 것을 본 것처럼 쓰지 않는다). 캡처 이미지는 곧 리뷰의 근거 산출물이며, 보고서의 시각적 판단은 이 이미지로 뒷받침되어야 한다.

## 캡처는 별도 에이전트가 아니다

캡처는 결정론적 기능(스크립트 실행)이라 별도 전문 에이전트를 두지 않는다 — reviewer(또는 frontend-dev)가 `bin/capture.mjs`를 직접 실행해 이미지를 모으고, 그 이미지를 Read로 보며 판단한다. "캡처 담당 에이전트에게 위임" 패턴은 쓰지 않는다.

## 관련 문서

- 캡처 절차·CLI 플래그·위험도별(critical/standard/trivial) 캡처 깊이·상태별 체크리스트: `skills/common-screen-verification-and-capture/SKILL.md`
- E2E 회귀 테스트(반복·자동, `@playwright/test`): `knowledge/quality/e2e-testing-guide.md`
