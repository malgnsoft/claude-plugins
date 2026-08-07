---
name: common-verifiable-output-and-honesty
description: 검증 가능한 증거 기반의 투명한 보고 기준. "주장(claimed)"과 "확인(verified)"을 명확히 구분하고 미확인 부분을 명시하며 모든 근거를 파일·라인으로 인용. frontend-dev/qa-engineer/reviewer/ux-designer/visual-designer가 작업 결과를 보고할 때 사용.
---

# Verifiable Output and Honesty Skill

## Definition
검증 가능한 증거 기반의 투명한 보고 기준. "주장(claimed)"과 "확인(verified)"을 명확히 구분하고, 미확인 부분을 명시하며, 모든 근거를 파일·라인으로 인용하는 신뢰성 표준.
- **대상 에이전트:** frontend-dev, qa-engineer, reviewer, ux-designer, visual-designer
- **핵심 목표:** 산출물의 정확성과 추적성을 보증하고, 독자가 주장을 재검증 가능하게 만들기

## Core Principles

### 1. Claimed vs. Verified 명확한 구분
- **Claimed:** 코드 검토(grep, 정적 분석), 사양 서술, 설계 문서 기반
- **Verified:** 실제 실행(테스트, 수동 테스트), 라이브 환경 관찰, 엔드투엔드 동작 확인
- **표기법:** "이 기능은 X를 지원한다 (코드: lib.js:45)" vs. "(테스트 실행 결과) X 동작 확인됨"
- **혼동 금지:** "XXX에 나쁜 점이 없어 보인다" 같은 모호한 표현 금지

### 2. 미확인 부분 명시 (적극적 공시)
- **확인하지 않은 것:** "이 부분은 검토하지 않았습니다", "다음 라운드에서 확인 예정"
- **검증 불가 영역:** "프로덕션 환경에서 실제 부하 테스트는 실행하지 않았음", "모바일 Safari는 수동 테스트 미실행"
- **경계 입력:** "다음 시나리오는 테스트하지 않았습니다: [리스트]"
- **책임 명확화:** "내가 확인한 범위는 Y입니다. Z는 다른 팀의 책임입니다"

### 3. 근거 제시 (Cite Everything)
- **파일 인용:** `src/auth.js:42-56` 형식 (범위 명시)
- **테스트 인용:** `__tests__/auth.test.js:L120` (구체적 테스트 케이스)
- **스크린샷 인용:** `docs/screenshots/login-error.png` + 메타데이터 (뷰포트, 날짜)
- **실행 로그 인용:** CI 빌드 링크, 테스트 실패 로그, 성능 메트릭
- **외부 사양 인용:** RFC, 사양 문서 URL, 커밋 해시

### 4. 투명성 규칙
- **한계 명시:** "이 검토는 정적 분석만 포함합니다", "성능 테스트는 미실시"
- **가정 기술:** "이 분석은 X OS에서 실행하고 Y 브라우저를 가정합니다"
- **샘플 크기:** "10개 테스트 케이스를 통과했습니다" (100% 테스트가 아님을 암시)
- **시간 제약:** "2시간 검토로 발견한 항목입니다. 깊은 감사는 별도 작업이 필요합니다"

### 5. 독자 중심의 재검증 가능성
- **직접 접근:** "다음 링크에서 직접 확인할 수 있습니다" (실행 환경, 로그, 코드)
- **단계별 복제:** "이 문제는 1) 브라우저 콘솔에서 X 실행 → 2) Y 확인 으로 재현됩니다"
- **메타데이터:** 날짜, 버전, 환경(OS, 브라우저, Node 버전), 테스트 조건
- **반박 대비:** 주장이 틀렸을 시 독자가 어디서 에러를 찾을 수 있도록 안내

## Verification Checklist

### Pre-Reporting Preparation
- [ ] 검증 범위 명시 (무엇을 테스트했고, 무엇을 하지 않았는지)
- [ ] 검증 방법 문서화 (수동/자동, 도구, 환경)
- [ ] 검증 시점 기록 (언제 테스트했는지, 코드 버전)
- [ ] 검증 환경 명시 (OS, 브라우저, 네트워크, 시간대)

### Claimed Evidence Collection
- [ ] 코드 구조 분석 (파일·라인 명시)
  - [ ] 함수 서명, 파라미터, 반환값 인용
  - [ ] 로직 흐름, 조건문, 에러 처리 인용
- [ ] 정적 분석 (linter, type checker 결과)
  - [ ] 타입 에러 없음, 구문 에러 없음 (도구명·버전)
  - [ ] 미사용 코드, 좀비 임포트 (그렙 결과)
- [ ] 설계 문서 대조
  - [ ] "사양에 따르면 X이고, 코드는 Y입니다" (링크 인용)

### Verified Execution Evidence
- [ ] 단위 테스트 실행 결과 (통과율, 커버리지, CI 링크)
- [ ] 통합 테스트 실행 결과 (엔드투엔드 동작)
- [ ] 수동 테스트 결과 (스크린샷, 비디오, 체크리스트)
  - [ ] 각 스크린샷에 뷰포트·날짜·상태 기록
  - [ ] 상호작용 시퀀스 기술 (클릭 → 로딩 → 결과)
- [ ] 성능 테스트 (응답 시간, 메모리 사용, 로드 테스트)
  - [ ] 도구명, 파라미터, 샘플 크기, 결과 링크

### Unverified Scope Documentation
- [ ] "다음은 테스트하지 않았습니다" 명시:
  - [ ] 특정 브라우저/OS/기기
  - [ ] 특정 네트워크 조건 (오프라인, 느린 연결)
  - [ ] 특정 사용자 역할 (관리자, 감사자 등)
  - [ ] 특정 데이터 크기 (매우 큰 파일, 수백만 레코드)
- [ ] "다음은 검토 범위 밖입니다" 명시:
  - [ ] 보안 감사 (다른 팀)
  - [ ] 접근성 완벽 준수 (WCAG 전체)
  - [ ] 성능 최적화 (심화 분석 필요)

### Citation Standards
- [ ] 모든 주장에 출처 연결
  - [ ] 코드: `src/file.js:lineNumber` 또는 `git show abc1234:src/file.js`
  - [ ] 테스트: `__tests__/file.test.js:L45-L60 (테스트명)`
  - [ ] 스크린샷: `docs/screenshots/path/file.png (viewport, date, condition)`
  - [ ] 로그/메트릭: CI URL, JSON 구조화 데이터, 타임스탬프
- [ ] 외부 참조 (약자 사용 금지)
  - [ ] 전체 URL 기입 또는 "다음 링크에서 확인 가능"
  - [ ] RFC, 표준 문서명 + 절수
  - [ ] 공식 가이드 vs. 커뮤니티 자료 구분

### Assumption and Limitation Disclosure
- [ ] "다음을 가정합니다" 명시:
  - [ ] 환경: "Node 18+, Chrome 100+를 가정"
  - [ ] 행동: "일반적인 사용 시나리오만 테스트"
  - [ ] 기간: "2시간의 휴리스틱 검토 기반"
- [ ] "다음은 알 수 없습니다" 명시:
  - [ ] 프로덕션 성능, 실제 사용 패턴
  - [ ] 엣지 케이스 (충분하지 않은 시간으로 모든 시나리오 테스트 불가)
  - [ ] 미래 유지보수성 (현재 코드 구조만 판단)

### Measurement and Quantification
- [ ] 수치화 (모호한 표현 금지):
  - [ ] ❌ "성능이 개선되었다" → ✓ "응답 시간 500ms → 200ms (60% 개선)"
  - [ ] ❌ "대부분의 테스트 통과" → ✓ "45/50 테스트 통과 (90%)"
  - [ ] ❌ "꽤 복잡하다" → ✓ "순환 복잡도 12 (권장값 10 초과)"
- [ ] 통계 신뢰도:
  - [ ] 샘플 크기: "20개 샘플 기반" (충분한가?)
  - [ ] 신뢰 구간: "95% 신뢰도, ±5% 오차 범위"
  - [ ] 반복 횟수: "3회 반복 테스트"

### Contradiction and Conflict Resolution
- [ ] 이전 검증과 충돌하면 명시:
  - [ ] "이전 검토에서 X를 확인했으나, 이번에 Y로 변경됨"
  - [ ] "코드와 테스트가 불일치합니다 (코드: A, 테스트: B)"
- [ ] 근거 간 모순:
  - [ ] "정적 분석(linter)은 에러 없음이나, 실행 시 런타임 에러 발생"
  - [ ] 원인 분석 + 권장 해결책 제시

### Accountability and Ownership
- [ ] 검증자 명시:
  - [ ] "나(frontend-dev)는 UI 계층만 검증했습니다"
  - [ ] "다음은 backend-dev가 검증해야 합니다"
- [ ] 책임 경계:
  - [ ] "보안 감사는 security 팀의 책임입니다. 이 검토는 기능 동작만 포함"
  - [ ] "성능 최적화는 별도 task입니다"
- [ ] 피드백 루프:
  - [ ] "발견 사항에 대한 확인 부탁드립니다"
  - [ ] "다음 라운드에서 검증할 항목"

## Example Report Structure

```markdown
# Code Review: Auth Module (src/auth.js)

## Summary
- **Scope:** 기능 동작, 코드 품질 (정적 분석)
- **Status:** ✓ Verified & Claimed
- **Time:** 2025-02-10, 1.5 hours
- **Code Version:** commit a1b2c3d
- **Environment:** Node 18.12, Chrome 120, macOS 14

## Verified Results
✓ 단위 테스트: 45/45 통과, 커버리지 92% (CI: [link])
✓ 타입체크: 에러 0건 (tsc --noEmit)
✓ 수동 테스트: 로그인→대시보드 플로우 작동 확인 (screenshot: docs/screenshots/login-flow.png, viewport 1440x900, 2025-02-10)

## Claimed Evidence
- 에러 처리: try-catch 패턴 (src/auth.js:78-92, line 85에서 JWT 검증)
- 타입 안정성: TypeScript strict mode (src/auth.js 전체, checkJs 기반, @types/node 업데이트)

## Unverified
- ❌ Safari 브라우저 테스트 (시간 부족)
- ❌ 관리자 권한 시나리오 (권한 부족)
- ❌ 프로덕션 성능 로드 테스트

## Limitations
- 검토는 일반적인 사용 경로만 포함
- 보안 감사는 security 팀의 책임 (별도 task)

## Recommendations
1. Safari에서 수동 테스트 필요 (QA 팀)
2. 대규모 데이터 로드 시 성능 프로파일링 필요
```

## Integration Notes
- **PR 리뷰:** 모든 finding에 코드 라인 링크 포함
- **테스트 리포트:** CI 대시보드 링크, 실패 원인 분석
- **버그 리포트:** 재현 단계, 환경, 스크린샷, 예상/실제 결과 명시
- **학습 기록:** malgnai-hub v1에는 memory_add 같은 별도 지식 저장 도구가 없음 — 검증 과정에서 얻은 재사용 가능한 체크리스트는 `work_record`의 result/nextAction 필드에 녹여 기록
