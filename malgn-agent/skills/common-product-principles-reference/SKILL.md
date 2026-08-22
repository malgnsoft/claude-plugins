---
name: common-product-principles-reference
description: 전 에이전트 필수 참조 — docs/product-principles.md로 모든 의사결정의 기저 확보, 일관성 유지. 제품 방향과 관련된 판단이 필요할 때 사용.
---

# Product Principles Reference

## 정의

모든 에이전트의 기술적·상업적·조직적 의사결정이 참조할 중심 문서. `docs/product-principles.md`는 이 프로젝트의 "기준"이며, 모든 판단은 이를 우선 확인 후 진행한다.

## 핵심 원칙

### 1. 모든 의사결정 전에 Product Principles 확인

**의사결정 흐름:**
1. **문제/요청** 수신
2. **Product Principles 읽기** (해당 섹션) — `docs/product-principles.md` 중 관련 부분
3. **기준 적용** — 원칙을 만족하는 선택지 탐색
4. **결정 기록** — malgnai-hub `decision_record`에 참조 원칙 명시

**체크:**
```
❌ "이게 좋을 것 같아서" (주관)
✅ "Product Principles의 '기술 스택 유지' 원칙에 따라 pnpm 사용 (대안: npm X)"
```

### 2. 원칙 불일치 시 명시적 Escalation

**Product Principles와 충돌하는 판단은:**
- malgnai-hub `issue_record`로 기록 (충돌 내용, 기술적 이유)
- 사용자 또는 상위 에이전트 승인 대기
- 임의로 원칙 위반 금지

**체크:**
```
❌ "원칙은 pnpm인데 npm이 낫다고 해서 사용"
✅ "원칙 충돌: pnpm vs npm (이유: 레거시 의존성). Issue #123 기록, 승인 대기"
```

### 3. 원칙 해석 불명확 시 명확화 요청

**Product Principles 문장이 애매하면:**
- malgnai-hub `decision_record`에 해석 기록
- "이 원칙을 이렇게 해석했다" 명시
- 필요 시 사용자 피드백 요청

**체크:**
```
❌ "애매한데 그냥 맘대로 해석"
✅ "원칙 '성능 우선'을 '초기 로딩 < 1초' 로 해석, decision #456 기록"
```

### 4. 원칙 갱신 제안 (일회성 ❌ → 루프 ✅)

**원칙이 지워지거나 맞지 않으면:**
- 임의로 변경 금지
- 원칙 개선 제안은 `decision_record`의 `reason`/`impact`에 기록한다(malgnai-hub에는 별도 지식 저장 도구가 없다)
- 다음 회고·갱신 사이클에 포함
- 학습 폐쇄 루프 형성

## 적용 체크리스트

### 각 에이전트 판단 시

- [ ] `docs/product-principles.md` 읽었는가? (관련 섹션)
- [ ] 이 판단이 원칙을 만족하는가?
- [ ] 원칙과 충돌하는가? → malgnai-hub issue_record
- [ ] 해석이 애매한가? → decision_record에 해석 기록

### 판단 기록 시 (malgnai-hub)

- [ ] 참조한 원칙 조항 명시?
- [ ] 충돌 여부 명확?
- [ ] 해석 또는 제안 기록?

### 루프 종료 (다음 회고)

- [ ] 기록된 issue/memory/decision 검토?
- [ ] 원칙 갱신/추가 필요한가?
- [ ] 회고 결과를 `docs/product-principles.md`에 반영?

## 참조 체크

**이 문서를 읽고 다음을 확인:**

- [ ] `docs/product-principles.md` 존재하는가?
- [ ] 최신 버전인가? (커밋 날짜 확인)
- [ ] 이 에이전트의 역량과 관련된 섹션은?

**원칙 부재 시:**
- 임의로 원칙 작성 금지
- 사용자 또는 제너럴 에이전트(PM)에 "원칙 부족" 보고
- 그 때까지는 "제너럴 판단력" 적용
