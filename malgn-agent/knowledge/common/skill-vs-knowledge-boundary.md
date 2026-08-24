# Skill과 Knowledge의 경계 정의

> **지위**: 이 문서는 Skill/Knowledge 판정의 **배경·기원 자료**다. 실무 판정 기준은
> `agents/evaluator.md`의 판정 체크리스트와 `agents/trainer.md`의 매체 판단 원칙을 정본으로 쓴다.
> §4의 "Trainer 모드 10" 제안은 미채택 로드맵이다. 이 문서가 서술하는
> "Trainer 모드 1~9" 번호 체계는 현재 `agents/trainer.md`의 실제 모드 구성(1~6)과 다르다 —
> 모드 번호는 참고하지 말고 `agents/trainer.md`를 정본으로 볼 것.

## 1. 정의

### Skill (실행형)
- **본질:** 해야 할 행동, 피해야 할 행동, 체크리스트 형태
- **형식:** 명령형 (must/must not), 절차적, 조건부 실행
- **목표:** 빠른 참조와 즉시 적용 (읽기 3-5분)
- **구성:** 하면 안 되는 것(금지) + 체크리스트 + 한두 줄 설명
- **예시:**
  - "커밋 전에 `pnpm run check-docs` 실행할 것"
  - "새 프로젝트 생성은 플러그인 번들 `bin/new-project.mjs` 사용"
  - "pnpm-workspace.yaml을 만들지 말 것"

### Knowledge (학습형)
- **본질:** 왜 그 규칙이 필요한가, 사고사례와 반례, 트레이드오프
- **형식:** 설명형 (배경·이유·상황), 맥락 기반
- **목표:** 깊은 이해와 상황 판단 능력 (읽기 15-30분)
- **구성:** 역사적 배경 + 반례·사고사례 + 트레이드오프 + 예외 상황
- **예시:**
  - "왜 doc-drift.json이 필요한가? — 대규모 프로젝트에서 문서가 코드와 어긋나는 문제의 사례"
  - "pnpm 모노레포를 피하는 이유 — 의존성 충돌, 테스트 격리 어려움, 배포 복잡성"
  - "STATUS.md를 단일 소스로 유지하는 이유 — 여러 도구에서 상태 동기화 문제 해결"

---

## 2. 경계 규칙 (5가지)

### 규칙 1: 문체와 목적으로 구분
- **Skill이 할 말:** "반드시 X를 하지 말 것", "Y를 실행하기 전에 Z를 확인할 것", "다음 단계를 따를 것"
- **Knowledge가 할 말:** "왜 X를 하지 말아야 하는가", "Y를 실행했을 때 어떤 문제가 발생했는가", "Z와 W 중 어느 것이 더 나은가"
- **판정법:** 글을 읽은 개발자가 "아, 그럼 이렇게 해야겠네"라고 생각 → Skill / "아, 그래서 이런 규칙이구나"라고 깨달음 → Knowledge

### 규칙 2: 단방향 링크만 허용
- **Skill → Knowledge 링크 가능** (Skill에서 "왜냐하면 이 Knowledge 참조")
- **Knowledge → Skill 링크 금지** (Knowledge는 Skill을 "증명"하지 않음)
- **이유:** Skill은 불변의 실행 규칙이고, Knowledge는 맥락·사례·판단이 포함되므로 양방향 의존성은 순환 참조 유발

### 규칙 3: Skill의 참조 깊이는 2단계 이내
- **깊이 0:** Skill 자신
- **깊이 1:** 다른 Skill 또는 Knowledge 직접 참조 (예: "X Skill 참조")
- **깊이 2:** 참조된 Skill/Knowledge가 또 다른 것을 참조 (한 번의 간접 참조만 허용)
- **깊이 3 이상 금지:** 체인이 길어지면 개발자가 따라가기 어려워짐
- **구체적 예시:**
  ```
  좋음:
  Skill A → (직접) Knowledge X ✓
  Skill A → (직접) Skill B → (한 단계) Knowledge Y ✓
  
  나쁨:
  Skill A → Skill B → Skill C → Knowledge Z ✗ (3단계)
  ```

### 규칙 4: 내용의 재사용성과 특수성으로 구분
- **Skill:** 여러 프로젝트에 재사용 가능한 규칙 (예: pnpm 사용, git 커밋 체크리스트)
- **Knowledge:** 프로젝트별 또는 팀별 특정 사례와 교훈 (예: "우리 팀이 겪었던 MEMORY 동기화 문제")
- **경계선:** 만약 "이건 프로젝트 A에만 적용되지 않나?"라고 묻는다면 → 프로젝트별 MEMORY 또는 프로젝트 CLAUDE.md로 가야 함

### 규칙 5: Trainer 모드와의 매핑

> ⚠️ 아래 모드 번호(1~10)는 **실행 지시가 아니다.** 실제 모드는 1~6뿐이다(파일 상단 "지위" 참조). 아래는 분류 논리를 예시로 남겨둔 것이므로, 모드 번호가 아니라 **Skill/Knowledge 구분 논리**만 읽는다.

- **Skill:** Trainer 모드 1~7 (Prompt/Task/Code/Git/Security/Test/Deploy) — 각 모드는 해야 할 것과 하면 안 되는 것의 체크리스트
- **Knowledge:** Trainer 모드 8~9 (Lessons, Stories) — 사고사례, 트레이드오프, 역사적 배경
- **향후 모드 10 (Knowledge와 Skill 자동 분리 커리큘럼 생성):** Trainer가 문서를 읽고 자동으로 Skill과 Knowledge로 파싱해 학습 경로 생성

---

## 3. 에이전트 MD 구조 개선안

### 기존 구조 (문제점)
```markdown
## 스킬 상세
- 항목 1: 해야 할 것 / 하면 안 될 것 (절차)
- 항목 2: 왜 이렇게 해야 하는가 (배경·이유)
- 항목 3: 프로젝트별 사례 (특수성)
```
**문제:** 절차, 배경, 사례가 섞여 있어서 독자가 혼동하고, 재사용성과 유지보수가 어려움.

### 개선된 구조 (제안)
```markdown
## 스킬 참조
[링크 목록만]
- Skill: "프로젝트 구조" → <knowledge 루트>/common/project-folder-structure.md
- Skill: "패키지 매니저 선택" → <knowledge 루트>/common/package-manager-policy.md
- Knowledge: "왜 pnpm 모노레포를 피하는가" → <knowledge 루트>/common/monorepo-tradeoffs.md

## 학습 루프
1. Skill을 빠르게 참조 (3-5분)
2. 필요하면 Knowledge에서 배경 학습 (15-30분)
3. 프로젝트별 MEMORY에서 사고사례 확인 (선택)
4. Trainer 모드 실행해 자동 검증 (체크리스트 제공)
```

### 에이전트별 적용 예시

**PM CLAUDE.md:**
- Skill 참조: "위임 체크리스트", "승인 절차", "기록 규칙"
- Knowledge 링크: "왜 트리플 검증이 필요한가"(결정 근거 논증), "팀 역할 분배의 트레이드오프"

**Trainer 에이전트:**
- Skill 참조: Prompt/Task/Code 등 7가지 모드
- Knowledge 링크: "왜 이 모드들이 필요한가", "모드별 실패 사례"

**Code Reviewer:**
- Skill 참조: "리뷰 체크리스트", "코멘트 템플릿"
- Knowledge 링크: "코드 스타일 트레이드오프", "성능과 가독성의 균형"

---

## 4. (미채택 로드맵) Trainer 모드 10: Knowledge·Skill 자동 분리 커리큘럼 생성

이 문서를 작성하며 함께 제안됐던 아이디어(문서를 자동 분석해 Skill/Knowledge로 분류하고 학습 커리큘럼을
생성하는 모드)는 `agents/trainer.md`에 "로드맵, 미구현 — 별도 신설 판정 필요"로만 남기고 실제 모드로는
만들지 않는다.

---

## 5. 체크리스트: 새 지식/스킬 작성 시

### 이 문서가 Skill인지 Knowledge인지 판정하기

#### Q1: "해야 할 행동"을 설명하는가?
- YES → Skill 가능성 높음, Q2로
- NO → Knowledge 가능성 높음, Q4로

#### Q2: 문체가 명령형(must/must not)이고, 3-5분 안에 읽을 수 있는가?
- YES → **Skill** ✓
  - 파일 위치: `<knowledge 루트>/common/` 또는 프로젝트 `CLAUDE.md`
  - 템플릿: 체크리스트 + 금지 사항 + Knowledge 참조 1개
- NO → Q3로

#### Q3: 설명이 길고, "왜"를 다루거나 사고사례가 있는가?
- YES → **Knowledge** ✓
  - 파일 위치: `<knowledge 루트>/common/` (일반) 또는 프로젝트 `MEMORY.md` (특수)
  - 템플릿: 배경 + 사고사례 + 트레이드오프 + 예외 상황
- NO → 다시 작성 필요 (너무 짧거나 불명확)

#### Q4: "왜 이렇게 해야 하는가"를 설명하는가?
- YES → **Knowledge** ✓ (위 Q3 참조)
- NO → 다시 작성 필요

#### Q5: 이것이 프로젝트별 특수 사례인가?
- YES (예: "프로젝트 A에서만...") → 프로젝트 `MEMORY.md` 또는 트레이닝 리포트
- NO (예: "모든 프로젝트에...") → `<knowledge 루트>/common/`

### 새 Skill 작성 템플릿
```markdown
## Skill: [제목]

### 체크리스트
- [ ] [금지 사항 1]
- [ ] [해야 할 것 1]
- [ ] [확인 단계 1]

### 한 줄 설명
[이 규칙을 왜 따르는지 한두 문장, 자세한 이유는 Knowledge 참조]

### 참조 Knowledge
- Knowledge: "[제목]" → [경로]
```

### 새 Knowledge 작성 템플릿
```markdown
## Knowledge: [제목]

### 배경
[왜 이 규칙이 생겼는가, 역사적 맥락]

### 사고사례
[우리 팀 또는 다른 팀이 겪었던 구체적인 실패 예시]

### 트레이드오프
- **장점:** [이 접근의 이점]
- **단점:** [이 접근의 비용]
- **선택:** [우리가 선택한 것과 이유]

### 예외 상황
[이 규칙이 적용되지 않는 경우, 또는 다르게 적용되는 경우]

### 참조 Skill
- Skill: "[제목]" → [경로]
```

---

## 6. 적용 예시

### 예시 1: pnpm 정책
**Skill (반드시 따를 것):**
```markdown
## Skill: pnpm 사용 강제

체크리스트:
- [ ] package.json에 "packageManager": "pnpm@버전" 지정
- [ ] npm/yarn 명령 사용 금지 (pnpm만 사용)
- [ ] package-lock.json / yarn.lock 생성 금지
- [ ] pnpm-workspace.yaml 생성 금지

참조 Knowledge: "왜 pnpm인가"
```

**Knowledge (이해해야 할 것):**
```markdown
## Knowledge: 왜 pnpm인가

배경:
- npm: 의존성 비효율 (중복 설치), 보안 취약점
- yarn: 모노레포 유도 (우리 정책 위반)
- pnpm: 디스크 효율, 보안, 모노레포 독립성 유지

사고사례:
- 팀원 A가 npm install로 작업 → 다른 환경에서 실패
- 팀원 B가 yarn berry로 전환 시도 → 모노레포 의존성 발생

선택: pnpm + 독립 프로젝트 구조
```

### 예시 2: 커밋 메시지
**Skill:**
```markdown
## Skill: 커밋 메시지 형식

체크리스트:
- [ ] 제목은 50자 이내
- [ ] Co-Authored-By 포함
- [ ] 명사형으로 시작 (add/fix/docs 등)

참조 Knowledge: "왜 일관된 커밋 형식이 필요한가"
```

**Knowledge:**
```markdown
## Knowledge: 왜 일관된 커밋 형식이 필요한가

배경: 깃 히스토리가 자산이 되려면 일관성 필수

사고사례:
- 형식 불일치 → 자동화 스크립트 실패 (릴리스, 체인지로그)
- 팀원마다 다른 형식 → 코드 리뷰 시 히스토리 추적 어려움

트레이드오프:
- 엄격한 규칙 vs 유연성
- 선택: 자동화 이득 > 유연성 비용
```

---

## 7. 다음 단계

1. **기존 문서 감시:** <knowledge 루트>/common/의 모든 문서가 Skill/Knowledge 중 하나로 명확한지 확인
2. **에이전트 MD 갱신:** PM, Trainer, Reviewer 각 CLAUDE.md를 새 구조로 개편
3. ~~Trainer 모드 10 개발~~ (미채택, 위 지위 안내 참조)
4. **MEMORY 정제:** 기존 사고사례를 Skill + Knowledge로 재구성
