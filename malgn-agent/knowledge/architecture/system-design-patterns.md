# 시스템 설계 패턴 (배경)

> **본문의 정본은 두 Skill이다**:
> - 아키텍처 패턴 비교·C4 모델·API 설계 원칙(REST 규칙·응답형식·HTTP 상태코드)·데이터 모델링(ERD 표기·공통 필드·인덱스 전략·DB 설계 깊이 4가지)·분산·동기화 패턴(멱등 인입/아웃박스/폴링 커서/배포 토폴로지/키 인증)·Google API Design Guide → `skills/domain-architecture-patterns-reference/SKILL.md`
> - 우수 설계 재사용 기법 A~G(추적성 사슬/도메인 경계/상태 머신/권한 매트릭스/트레이드오프 표/비정상 케이스 인라인/문서 분할) → 기존 `skills/domain-system-design-principles/SKILL.md`와 완전 중복이라 이 파일에는 없다

이 문서에는 절차가 바뀌어도 남는 배경(출처)만 남긴다.

## 배경·출처

- **아키텍처/API/DB 참조 패턴**: 일반 설계 참조 자료. 분산·동기화 패턴 절은 "로컬 PC들이 중앙 서버로 push하고 모바일에서 모니터링" 류 설계에서 반복되는 약점(데이터 유실·중복·시계오차)을 다룬다. DB 설계 깊이 4가지도 테이블·컬럼만 나열하고 근거·제약·성능 전략이 빠지는 사례에 대응한다.
- **우수 설계 재사용 기법 A~G**: 실제 프로젝트 산출물 진단에서 역추출한 기법이다. 우수 설계에도 흔히 빠지는 관점(동시성/TOCTOU·관측가능성·장애복구·재시도-멱등키)은 `domain-system-design-principles`의 "③ 비정상 케이스 의무 — 자주 빠지는 것들"에 반영돼 있다.

## 관련 문서

- 아키텍처 패턴·C4·REST API·ERD·분산동기화 실행형 콘텐츠: `skills/domain-architecture-patterns-reference/SKILL.md`
- 4대 설계 의무·7대 재사용 기법 체크리스트: `skills/domain-system-design-principles/SKILL.md`
