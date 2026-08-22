# 시스템 설계 패턴 (배경)

> **본문은 두 Skill로 이관됨** (2026-08-07, §1.3 이관 절차):
> - 아키텍처 패턴 비교·C4 모델·API 설계 원칙(REST 규칙·응답형식·HTTP 상태코드)·데이터 모델링(ERD 표기·공통 필드·인덱스 전략·DB 설계 깊이 4가지)·분산·동기화 패턴(멱등 인입/아웃박스/폴링 커서/배포 토폴로지/키 인증)·Google API Design Guide → `skills/domain-architecture-patterns-reference/SKILL.md`
> - 우수 설계 재사용 기법 A~G(추적성 사슬/도메인 경계/상태 머신/권한 매트릭스/트레이드오프 표/비정상 케이스 인라인/문서 분할) → 기존 `skills/domain-system-design-principles/SKILL.md`와 완전 중복이라 별도 이관 없이 이 파일에서 제거
>
> `knowledge/README.md`는 2026-07-24부터 이미 "이관 완료"로 서술했으나, 이 실물 파일은 그때 갱신되지 않고 전체 본문이 복제된 채 남아 있었다(2026-08-07 audit-report.md §3 패턴4·§1.3 이관절차③ 미이행 대조로 확인). 이번 편집으로 서술과 실물을 일치시킨다.

이 문서에는 절차가 바뀌어도 남는 배경(출처)만 남긴다.

## 배경·출처

- **아키텍처/API/DB 참조 패턴**: 일반 설계 참조 자료. 분산·동기화 패턴 절은 malgnai `central-monitoring.md` 산출물 진단(2026-06-20)에서 "로컬 PC들이 중앙 서버로 push하고 모바일에서 모니터링" 류 설계의 반복 약점(데이터 유실·중복·시계오차)을 역추출한 것이다. DB 설계 깊이 4가지도 같은 시기(2026-06-20) 별도 architect DB 산출물 진단(테이블·컬럼만 나열하고 근거·제약·성능 전략이 빠진 사례)에서 나왔다.
- **우수 설계 재사용 기법 A~G**: coaching(Coach Connect) 프로젝트의 실제 architect 산출물 진단(20·21 아키텍처, 30~34 DB, 40~46 API, 70~73 최종스펙, 2026-06-20)에서 역추출한 기법이다. 같은 진단에서 이 우수 설계에도 빠져 있던 관점(동시성/TOCTOU·관측가능성·장애복구·재시도-멱등키)도 확인되어 `domain-system-design-principles`의 "③ 비정상 케이스 의무 — 자주 빠지는 것들"에 반영돼 있다.

## 관련 문서

- 아키텍처 패턴·C4·REST API·ERD·분산동기화 실행형 콘텐츠: `skills/domain-architecture-patterns-reference/SKILL.md`
- 4대 설계 의무·7대 재사용 기법 체크리스트: `skills/domain-system-design-principles/SKILL.md`
