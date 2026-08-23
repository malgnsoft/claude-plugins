---
name: domain-reference-benchmarking-standard
description: 레퍼런스 벤치마킹 착수전/완성후 스크린샷 대조 산출물 표준 — GDWEB/dbcut/Awwwards(관리자 화면은 ThemeForest)에서 참고 화면을 착수 전에 캡처하고, 완성 후 결과 스크린샷과 나란히 대조 문서(before/after)로 남긴다. frontend-dev·ux-designer·visual-designer가 화면 설계/구현 착수 전 레퍼런스를 참고하고, 그 반영 여부를 evaluator가 눈으로 판정할 수 있는 근거를 남길 때 사용한다.
---

# 레퍼런스 벤치마킹 표준 (frontend-dev / visual-designer / ux-designer 공용)

## 왜 텍스트 서술이 아니라 스크린샷 대조인가

"참고 URL 3개 + 차용 요소 서술" 방식은 결과물을 완성한 뒤 그럴듯한 레퍼런스를 사후에 끼워 맞추는 사후 정당화(post-hoc rationalization) 위험이 있어 폐기됐다. 착수 전 스크린샷을 먼저 남기면 "이 레퍼런스를 보고 시작했다"는 시점이 고정되어 사후 조작이 불가능해진다.

## 참고 사이트

- **국내**: GDWEB(gdweb.co.kr), dbcut(dbcut.com)
- **해외**: Awwwards(awwwards.com)
- **관리자(Admin) UI**: ThemeForest(themeforest.net) 고품질 admin 템플릿

화면 성격(공개 마케팅 화면 vs 관리자 화면)에 맞는 카테고리를 고른다. 관리자/기능 중심 화면에 Awwwards류 실험적 레퍼런스를 강요하지 않는다.

## 산출물 형식 (evaluator 판정 대상)

1. **착수 전**: 참고할 레퍼런스 화면 스크린샷 1~3장을 `docs/design/reference/<화면명>-before-ref.png` 등으로 저장. 캡처 도구(`bin/capture.mjs`)는 로컬 렌더링 전용이 아니라 외부 URL도 그대로 지원한다(예: `node "${CLAUDE_PLUGIN_ROOT}/bin/capture.mjs" https://gdweb.co.kr/... docs/design/reference/xxx-before-ref.png`) — 별도 도구가 필요하다고 오인하지 않는다(상세: Skill `common-screen-verification-and-capture`).

2. **완성 후**: 구현/설계 결과 스크린샷을 `docs/design/reference/<화면명>-after.png`로 저장.
3. 두 이미지를 나란히 배치한 대조 문서(`docs/design/reference/<화면명>-benchmark.md`)에 `![before](...)  ![after](...)` 형태로 삽입. evaluator는 이 파일을 열어 실제로 참고 흔적이 결과물에 반영됐는지 눈으로 판정한다 — 텍스트 주장만으로는 통과되지 않는다.

> 이 커맨드가 실패하거나(특히 `MODULE_NOT_FOUND`) 새 실행 지시를 쓸 때의 규약 — 따옴표, 이 변수가 치환되는 자리와 안 되는 자리, 맨 명령어를 쓰지 않는 이유 — 은 Skill `common-output-storage-and-path-management` §1-1이 정본이다.

## 역할별 참조 관점 (동일 레퍼런스, 다른 시선)

- **ux-designer**: 레이아웃, 정보 밀도, 동선(사용자가 화면 안에서 이동하는 순서)을 본다. 색·타이포 디테일은 보지 않는다.
- **visual-designer**: 비주얼 디테일 — 여백, 아이콘 크기/위치, 색 사용, 타이포 위계를 본다. 레이아웃 구조 자체는 ux-designer 산출물을 존중한다.
- **frontend-dev**: 착수 전 판단 단계에서 레퍼런스를 참고하되(visual-designer 투입 조건 판단 시 근거로 사용), 실제 퍼블리싱 규격은 프로젝트 `publishing-style-guide.md`(→ 이 플러그인의 `knowledge/design/publishing-style-guide-template.md`)를 우선 따른다.

## Admin-SaaS 벤치마킹 시 밀도/위계 체크리스트

관리자 화면 레퍼런스를 볼 때 아래 6개 항목을 구체적으로 짚는다(막연히 "깔끔하다"로 끝내지 않는다). **담당 표기 필수**: 숫자/치수(px·비율 등) 관찰은 visual-designer 전담이다 — ux-designer는 "숫자/치수는 visual-designer 권한" 규칙(ux-designer.md)과 충돌하므로 이 항목들을 직접 관찰하지 않는다(2026-07-24 정정).

- [ ] **(visual-designer)** 행 높이·패딩 비율 (테이블/리스트 한 행이 몇 px, 좌우 패딩과의 비율)
- [ ] **(visual-designer)** 1차 액션과 2차 액션의 시각적 대비 (버튼 색·크기 차이)
- [ ] **(visual-designer)** 배지(badge)/상태 라벨의 색상·크기 통일성
- [ ] **(ux-designer)** 사이드바 축소(collapsed) 상태의 처리 방식 — 구조/동선 판단만, 크기 수치는 관찰하지 않음
- [ ] **(양쪽, 관점 분리)** 빈 상태(empty state) 디자인 — ux-designer는 메시지·CTA 유무/동선, visual-designer는 시각적 톤·아이콘 크기
- [ ] **(양쪽, 관점 분리)** 에러 상태 디자인 — ux-designer는 복구 경로 유무, visual-designer는 시각적 톤·강조 방식

## evaluator 판정 기준 (참고)

- before-ref/after 스크린샷 쌍이 실제로 존재하는가 (ls로 확인 가능)
- after 스크린샷이 before-ref의 구체 요소(레이아웃 or 비주얼 디테일)를 실제로 반영했는가 — 육안 대조
- admin 화면이면 위 6개 체크리스트가 개별 항목으로 언급됐는가(뭉뚱그린 총평 금지)
