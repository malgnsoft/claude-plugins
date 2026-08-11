---
name: common-task-grading-and-verification-depth
description: 전 에이전트 공통 — 작업 등급(Trivial/Standard/Sensitive/Exploration/Refactor)에 따라 검증 강도를 맞춰 과소·과잉 검증을 방지. PM가 위임 전 검증 깊이를 판정하거나, 에이전트가 자기검증 수준을 정할 때 사용.
---

# 작업 등급 → 검증 강도 (전 에이전트 공통)

> ⚠️ risk_level(server/lib/autonomy.js — 자율엔진 내부 개념, malgnai-hub 연동판에는 해당 없음)과 축이 다르다 — 이름도 다르게 씀(등급명에 "Risk"를 쓰지 않음):
> risk_level = "자율엔진이 이 실행단위를 사람 승인 없이 굴려도 되는가"(집행 게이트, 워커가 사이클마다 매김).
> 이 문서의 등급 = "PM가 위임 전에, 에이전트가 검증을 얼마나 깊게 할지"(자기검증 깊이, 위임 시 1회 판정).
> 기계적으로 맞대응시키지 말 것 (Micro 등급 배포 설정 변경도 risk_level=high일 수 있고, Refactor 등급 리팩터링의 실행단위 risk_level은 low일 수 있다).

## 5등급 판정표

| 등급 | 기준 | 위임/직접처리 | 리뷰 깊이(reviewer) | QA 최소기준 | 캡처 깊이(common-screen-verification-and-capture 매핑) | 재검토 시 |
|---|---|---|---|---|---|---|
| Micro | 문구·CSS·단일파일 수정, 조회·오타 | PM 직접 처리 | 생략(원칙상 reviewer 미호출) | 눈검증 | trivial — 캡처 생략 가능 | - |
| Standard | 일반 기능·API·버그수정 | 위임 | 약식(페르소나 1~2, 발산형 생략 가능) | 정상흐름 + 주요 예외 1개 | standard — 완성시점 1회 + 경량체크리스트 4항목 | - |
| Sensitive | DB·권한·인증·배포·결제·개인정보·대량데이터 | 위임 + Impact Check 선행 | 풀패널(발산형 포함 2~4명) 필수 | 정상+예외+권한/데이터/롤백 확인 | critical — 상태전이마다 캡처 + Full Checklist | 동일 target_id 재검토는 축소/증분 모드 가능(§ 아래 참조) |
| Exploration | 원인분석·구조파악, 무엇을 고칠지 모름 | 위임(시간·산출물 제한) | 결론 검증만 | 없음 | trivial — 결론 검증만이라 캡처 불필요 | - |
| Refactor | 구조개선·중복제거(기능변화 없음) | 위임 + 변경 전후 기준 선행 | 풀패널 필수 | 기존 동작 동일성 확인 | standard — 동일성 확인 목적(UI 변경 수반 시 critical로 상향) | 동일 target_id 재검토는 축소/증분 모드 가능(§ 아래 참조) |

캡처 깊이의 상세 기준(체크리스트 항목·상태전이 캡처 방법 등)은 `common-screen-verification-and-capture` 스킬을 따른다.

## 빠른 판단

```
단일 파일, 실패해도 영향 작음 → Micro
여러 파일이지만 기능 범위 명확 → Standard
데이터/권한/배포/고객 영향 있음 → Sensitive
무엇을 고칠지 아직 모름 → Exploration
기능 변화 없이 구조만 바꿈 → Refactor
애매하면 무거운 쪽으로 기운다.
```

## 동일 대상 재검토 — 축소/증분 모드

Sensitive/Refactor 등급 산출물이 짧은 기간 내 여러 번 재수정돼 reviewer에 반복 위임되는 경우, 매번 풀패널을 새로 돌리지 않는다. PM은 위임 시 `target_id`(안정 슬러그)를 발급/재사용하고, reviewer는 다음 기준으로 모드를 판정한다.

**동일 대상 인정 조건 (모두 충족 필요)**: 동일 target_id + 직전 리뷰로부터 7일 이내 + 리스크 범주 불변(인증→배포처럼 도메인이 바뀌면 절대 동일 target_id 불가) + 리뷰 대상 파일 실질 중첩.

**풀패널 강제 승격 조건 (하나라도 해당하면 축소 불가)**: 직전 Critical/Major 미해결 존재 / 직전에 없던 새 실행경로·리스크 표면 다수 등장 / 다른 Sensitive 하위도메인 진입 / 재검토 4차 이상 누적 / PM·사용자의 명시적 풀패널 요청.

상세 절차(모드 3단계, 페르소나 재사용 방식, 보고서 템플릿)는 Skill `reviewer-persona-panel-standard`와 `agents/reviewer.md`를 따른다.

## 등급 표기 없을 때 기본값

Standard로 간주(안전측 기본값).
