# 작업 등급 판정 — Fast Path 도입 전/후 분류 대조표

이 문서는 등급 판정 기준 변경(파일 개수 → 위험·가역성, Standard 안의 Fast Path 경로, reviewer 조건부 호출, WBS 트리거 축소)이 **실제 작업 분류를 어떻게 바꾸는지** 대표 예시로 확인하기 위한 검증 산출물이다. 판정 기준의 정본은 Skill `common-task-grading-and-verification-depth`이며, 이 문서는 그 기준의 적용 예시일 뿐 기준 자체가 아니다.

## 요약

- **Fast Path 5조건**: ①요구사항 명확 ②새 아키텍처·제품 결정 불요 ③영향범위 국소 ④쉬운 rollback ⑤고위험 도메인 요소 없음. 모두 충족해야 하며 하나라도 어긋나면 일반 Standard.
- **고위험 도메인(⑤의 판정 목록)**: 인증 · 권한 · 결제 · 개인정보 · DB migration · 되돌릴 수 없는 데이터 변경 · 배포 인프라 · 외부 공개 API contract의 중대한 변경 · 외부 사용자에게 큰 영향을 주는 변경.
- **Fast Path에서 생략**: WBS · 상류 단계(planner/architect) · 별도 reviewer 호출. 담당 에이전트 1명 + 필요한 테스트 + PM의 diff·결과 확인으로 종료.
- **파일 개수는 등급의 축이 아니다** — 1파일 인증 변경이 5파일 문구 교체보다 위험하다.

## 대조표

| # | 작업 예시 | Before 등급/팀구성 | After 등급/팀구성 | 근거 |
|---|---|---|---|---|
| 1 | 기존 응답 DTO에 이미 저장 중인 필드 하나를 노출(스키마 변경 없음) | Standard — backend-dev→frontend-dev→qa-engineer 축소 체인 + reviewer 약식 + WBS 등록 | Standard **Fast Path** — backend-dev 1명, reviewer·WBS 생략 | 5조건 전부 충족. 기존 직렬화 패턴 그대로이고 revert 1회로 복구. 마이그레이션이 필요해지면 ⑤에 걸려 Sensitive로 올라간다 |
| 2 | 이미 있는 조회 API를 화면에 연결(인증·에러처리 기존 공통 계층 재사용) | Standard — frontend-dev + qa-engineer + reviewer 약식 | Standard **Fast Path** — frontend-dev 1명 | 새 설계 결정 없음, 화면 패턴 재사용, 국소·가역 |
| 3 | 입력 validation 규칙 추가(기존 검증 계층에 필드 규칙 1건) | Standard — backend-dev + reviewer 약식 + WBS | Standard **Fast Path** — backend-dev 1명 | 요구사항 명확(허용값이 정해져 있음), 기존 검증 패턴 재사용. 인증·권한 판단이 섞이면 ⑤ 위반 |
| 4 | 에러 처리 추가(기존 에러 응답 봉투·코드 체계 그대로 사용) | Standard — backend-dev + reviewer 약식 | Standard **Fast Path** — backend-dev 1명 | 기존 규약 적용일 뿐 새 결정 없음. 새 에러 코드 체계를 세우면 ②에 걸려 일반 Standard |
| 5 | 목록 화면에 버튼/조건부 표시 하나 추가(기존 화면·컴포넌트 패턴 재사용) | Standard — **ux-designer 기본 투입** + frontend-dev + qa-engineer + reviewer 약식 | Standard **Fast Path** — frontend-dev 1명(ux-designer 생략) | 화면 신설이 없고 동선·정보구조가 그대로라 ②를 넘는다. 화면이 새로 생기거나 동선이 바뀌면 ux-designer 투입 |
| 6 | 명백한 버그 수정(재현 로그 있고 원인 확정, 1~2줄) | Standard — 담당 dev + reviewer 약식 + WBS(탐색→수정→테스트 3단계로 읽혀 등록) | Standard **Fast Path** — 담당 dev 1명, WBS 생략 | 한 세션 단일 흐름이라 WBS 대상 아님. 원인이 아직 불확실하면 Exploration |
| 7 | 기존 로직의 작은 조건 변경(목록 기본 정렬 기준 1건) | Standard — 담당 dev + reviewer 약식 | Standard **Fast Path** — 담당 dev 1명 | 국소·가역. 정렬이 권한별로 달라지는 요구면 ⑤(권한)에 걸린다 |
| 8 | 2~5개 파일에 걸친 국소 수정(같은 기능의 상수·문구를 호출부까지 반영) | Standard — "여러 파일"이라 상향 압력, 다중 에이전트 체인 + reviewer 약식 | Standard **Fast Path** — 담당 dev 1명(인접 파일 함께 수정) | **파일 개수는 판정 축이 아니다.** 변경의 성격이 하나이고 영향이 그 기능 안에서 닫힌다 |
| 9 | (대조군) 로그인 세션 만료 시간 변경 — 코드 1파일 | Standard(단일 파일이라 가볍게 판정될 여지) | **Sensitive** — 위임 + Impact Check + reviewer 풀패널 + 사람 승인 | 인증 도메인이라 ⑤ 위반. 파일이 하나여도 Fast Path 대상이 아니다 |
| 10 | (대조군) 주문 테이블에 컬럼 추가 + 마이그레이션 실행 | Standard/Sensitive 사이에서 흔들림 | **Sensitive** — 풀패널 + 사람 승인 + 롤백 확인 | DB migration·비가역 데이터 변경이라 ⑤ 위반 |
| 11 | (대조군) 검색 필터 기능 신설 — 요구사항에 해석 여지가 있고 여러 모듈이 얽힘 | Standard — 풀 파이프라인 + reviewer 자동 호출 | **일반 Standard**(Fast Path 아님) — planner/담당 dev + qa-engineer, **reviewer 약식 호출**(트리거: 해석 여지·모듈 얽힘·회귀 위험) | ①②③ 불충족. Fast Path가 아닌 Standard에서도 reviewer는 트리거에 걸릴 때 호출된다 — 이 건은 걸린다 |

## 이 변경으로 줄어드는 것 / 줄지 않는 것

**줄어드는 것**: 1~8번 유형에서 상류 단계(planner/architect), ux-designer 기본 투입, reviewer 자동 호출, WBS 등록·갱신이 사라진다. 위임은 남지만 담당 1명으로 수렴한다.

**줄지 않는 것**: 9~10번 같은 고위험 도메인은 그대로 Sensitive이고 풀패널·사람 승인·롤백 확인이 유지된다. 11번처럼 해석 여지·회귀 위험이 있는 Standard도 reviewer를 부른다. 캡처 깊이(화면 성격이 정함)와 Sensitive의 노출 범위 축소 규칙, 동일 대상 재검토 규칙은 이번 변경의 대상이 아니다.
