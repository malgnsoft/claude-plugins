# 리뷰 보고서 — knowledge/ 죽은 스킬명 참조 1:1 치환

- **target_id**: `knowledge-dead-skill-refs`
- **라운드**: 1차 (최초 리뷰)
- **일자**: 2026-08-22
- **대상**: 워킹트리 미커밋 diff `git diff -- malgn-agent/knowledge/` (베이스 = 현재 HEAD) — 4파일 15줄
- **등급 판정**: **Standard** — 대상이 4파일·15줄, 순수 문자열 삽입, 로직/절차 변경 0. 다만 전 직원 배포 제품이고 `knowledge/`는 다수 에이전트가 참조하는 공용 자산이므로 발산형 1명을 생략하지 않고 포함(Standard는 발산형 생략 가능이나 자발적 포함).
- **종합 판정**: 🟢 **Green** — Critical 0 / Major 0 / Minor 0 / Nit 0. 🔵 Rethink 1건은 이 diff의 결함이 아니라 **재발 방지 백로그**(변경 동결 준수).

---

## 0. 페르소나 패널 — 재사용/신규 판정

| 페르소나 | 유형 | 재사용/신규 | 사유 |
|---|---|---|---|
| `personas/persona-semantic-force-preservation-auditor.md` | 수렴 | **재사용** | INDEX.md 역할개념 "삭제·치환 리팩터링 후 규칙의 경계·강제력이 조용히 약해지지 않았는지 원문과 한 줄씩 대조하는 의미강도 감사관" — 이번 위임의 합격선("참조 실재가 아니라 문장이 여전히 참인가", 시점 정합·지시 대상 보존)과 정확히 동형. 6대 요소 본문 무수정, "적용 이력"만 append. §5 참고파일이 직전 라운드(lesson-id-removal) 대상에 고정돼 있어 **역할개념 수준으로만** 적용(INDEX 2026-08-10 RV-002 선례 동일). |
| `personas/persona-dead-reference-scope-challenger.md` | **발산** | **재사용** | INDEX.md 역할개념 "문제 스코프를 형태로 정의한 것이 실제 판정 기준(조회 가능성)과 어긋나지 않는지, 제외 조항의 단정을 실측으로 반증하는 발산형" — 이번 위임 항목3(누락·과잉)과 동형. 이번 라운드의 "형태 기준"은 8-hex id가 아니라 **"`domain-` 접두를 붙일 이름"**이라는 치환 방향이며, 같은 구조의 간극(반대 방향 개명·`common-` 접두·knowledge 파일명 동명이인)을 실측 반증 대상으로 삼음. 6대 요소 무수정, "적용 이력" append. |

**신규 페르소나 0건.** 신규 생성을 검토했으나(`persona-spec-implementation-conformance-auditor.md`는 "명세 조항 1:1 대조"라 이번엔 명세 문서가 없어 부적합, `persona-doc-table-source-consistency-auditor.md`는 "요약 표 vs 정본"이라 부분 근접하나 이번 대상은 표가 아닌 산문 참조) 위 2개로 이번 라운드의 리스크 표면이 전부 덮여 새 파일을 만들지 않음.

**화면 리뷰 없음** — 대상이 `.md` 문서 4개로 UI 산출물이 아님(생략 사유 명시).

---

## 1. 검증 방법 (요약)

PM이 이미 기계 확인한 "참조 실재 여부"는 재확인하지 않았다. 대신:

1. **치환 순도 증명** — 각 파일의 HEAD판과 워킹트리판 양쪽에 `sed 's/domain-//g'`를 적용해 `diff`. 4파일 전부 **완전 동일**(exit 0). 즉 `domain-` 문자열 삽입 외에 **단 1바이트도 바뀌지 않았음**이 기계적으로 증명됨. 삽입 건수 README +8 / system-design-patterns +5 / publishing-style-guide-template +1 / compliance-matrix-template +2 = **16건**(trainer 보고와 일치).
2. **시점 정합** — 각 치환 문장이 *언제 작성됐는지*를 `git log --follow` + `git show <commit>:<file>`로 특정하고, 개명 커밋 시각(2026-08-07 23:52:47 +0900, 커밋 제목 `malgn-agent v1.0.0: 방법론 rubric 기반 전면 재구축`)과 대조.
3. **지시 대상 보존** — 치환 후 문장이 주장하는 사실(참조 관계·절 존재)을 실물 grep으로 검증.
4. **스코프 반증(발산형)** — 같은 개명 라운드의 *반대 방향* 개명, `common-` 접두 개명, knowledge 파일명 동명이인을 각각 grep으로 반증 시도.
5. **재유입 게이트 실측** — `scripts/validate-agent-assets.mjs` 코드 구조 직독 + `pnpm run check-assets` 실행.

---

## 2. 지적 사항

**Critical 0 · Major 0 · Minor 0 · Nit 0.**

이 diff가 만든 결함은 발견되지 않았다.

---

## 3. PM이 지정한 3개 검토 항목 — 판정과 근거

### 항목 1. 시점 정합 (과거 시점 서술 안의 이름을 현재 이름으로 바꾼 것이 문장을 거짓으로 만드는가) → **결함 아님**

개명은 **2026-08-07 23:52:47 +0900의 단일 커밋**(제목 `malgn-agent v1.0.0: 방법론 rubric 기반 전면 재구축`, 이하 "개명 커밋")에서 8종 전부 일어났다. 대상 15줄을 작성 시점 기준으로 두 부류로 나눠 각각 판정했다.

**(a) 개명 커밋 *안에서* 작성된 6줄 — 시점 불일치 자체가 없음 (강한 무해)**

- `malgn-agent/knowledge/architecture/system-design-patterns.md:4,5,14,18,19` (5줄)
- `malgn-agent/knowledge/design/publishing-style-guide-template.md:5` (1줄)

근거: 개명 커밋 **직전 커밋**(2026-08-07 20:16:23 +0900, 제목 `Rename malgn-dev plugin to malgn-agent`, 이하 "직전 커밋") 시점의 `system-design-patterns.md`를 `git show`로 꺼내 보면 `# 시스템 설계 패턴` + 본문 표로, **"이관됨" 헤더 자체가 존재하지 않는다**. 같은 방식으로 publishing 파일의 "감사 재검토" 문단도 **직전 커밋에는 0건, 개명 커밋에 존재**. 즉 이 6줄은 **개명을 수행한 바로 그 커밋에서 신규 작성**됐고, 작성 시점에 스킬 이름은 이미 `domain-*`이었다. 저자가 같은 커밋 안에서 구 이름을 적은 단순 오기이며, 이번 치환은 **저자 의도를 복원**한 것이다. 시점 정합 이슈 없음.

**(b) 개명 *이전에* 작성된 9줄 — 문서 자신의 기존 관례와 일치 (무해)**

- `malgn-agent/knowledge/README.md:46,48,73,75,80,91,101` (7줄, 최종 형태가 확정된 시점 = 직전 커밋 2026-08-07 20:16 = 개명 3시간 36분 전)
- `malgn-agent/knowledge/proposal/compliance-matrix-template.md:3,15` (2줄, 동일 — 직전 커밋)

이 9줄은 "(2026-07-23/24 … 본문은 `skills/X`로 이관)" 형태라 원리적으로는 "그날 그 이름이었다"는 오독 여지가 있다. 그러나 **이 diff가 손대지 않은 기존 줄이 이미 같은 관례를 쓰고 있다**:

- `README.md:97` — `` (서버리스/엣지 … 이관됨 — `skills/domain-serverless-edge-api-security/SKILL.md`, 2026-07-23. …) `` ← **2026-07-23 날짜 + `domain-` 현행명**, 이번 diff 대상 아님(HEAD에 이미 존재).

즉 이 README는 "날짜 = 이관 사건 시점 / 이름 = 현재 소재지"라는 표기 관례를 이미 확립하고 있었고, 이번 치환은 **7줄을 그 관례에 맞춰 정렬**한 것이다. 오히려 치환 전이 문서 내부 비일관 상태였다. 별도 조치 불요.

> 참고(결함 아님, 기존 상태): `README.md:80`은 이관일을 2026-07-24로, 실물 `system-design-patterns.md:7`은 2026-08-07로 적어 서로 다르다. 이는 실물 파일이 스스로 그 불일치를 명시적으로 설명하고 있으며(`README.md`는 2026-07-24부터 "이관 완료"로 서술했으나 실물은 그때 갱신되지 않았다는 서술) 이번 diff와 무관한 선재 상태다.

### 항목 2. 지시 대상 보존 → **결함 아님 (전건 실물 검증)**

한 줄에 두 이름이 있던 곳과 산문 안 맨몸 이름을 개별 검증했다.

| 위치 | 유형 | 검증 결과 |
|---|---|---|
| `README.md:80` | **한 줄 두 이름** (`domain-architecture-patterns-reference` + `domain-system-design-principles`) | 둘 다 치환 — **대칭**. 한쪽만 바뀐 비대칭 없음. |
| `system-design-patterns.md:4,5` | 헤더 두 불릿, 각 1개 | 대칭 |
| `system-design-patterns.md:14` | **산문 안 맨몸 이름**(`skills/` 경로 없이 `` `domain-system-design-principles`의 "③ 비정상 케이스 의무 — 자주 빠지는 것들"에 반영돼 있다 ``) | 주장 사실 검증 완료: `domain-system-design-principles/SKILL.md:46`에 `### ③ 비정상 케이스 의무`, `:59`에 `**자주 빠지는 것들**:` 실재. 인용 절 이름까지 참임. |
| `publishing-style-guide-template.md:5` | **산문 안 맨몸 이름**(`frontend-dev.md·domain-reference-benchmarking-standard가 정확한 경로로 참조 중`) | 주장 사실 검증 완료: `skills/domain-reference-benchmarking-standard/SKILL.md:30`이 `knowledge/design/publishing-style-guide-template.md`를 명시 참조, `agents/frontend-dev.md:26,27,125`도 동일 경로 참조. 치환 후 문장이 여전히 참. |
| `compliance-matrix-template.md:3,15` | Skill 백틱 표기 2곳 | 대칭. 같은 파일 `:14`의 `` Skill `reviewer-persona-panel-standard` ``는 **접두어가 없는 것이 정답**이라 손대지 않음 — 올바른 판별. |

### 항목 3. 누락·과잉 → **결함 아님 (반증 4건 전부 실패 = 통과)**

발산형이 "치환 방향을 형태(=`domain-` 붙일 이름 8종)로 정의한 것"의 사각지대를 4가지로 가정하고 각각 반증을 시도했으나, **전부 실패(=결함 없음)**했다.

1. **과잉 — knowledge 파일명 동명이인을 잘못 바꿨는가?** → 없음. `README.md:48`은 같은 줄 안에서 불릿 키 `` `compliance-matrix-template.md` ``(knowledge 파일)는 **그대로 두고** `` `skills/domain-compliance-matrix-template/SKILL.md` ``(스킬 경로)만 바꿨다. `system-design-patterns.md`·`visual-design-system.md`·`testing-guide.md`·`shipley-proposal-process.md` 불릿 키도 전부 보존.
2. **누락 — 다른 파일에 같은 스킬을 가리키는 구 이름이 남았는가?** → 없음. `grep -rnoE '(^|[^-a-z])(8종)' malgn-agent/knowledge/` 잔여 4건은 전부 `` `compliance-matrix-template.md` ``(=knowledge 파일, `shipley-proposal-process.md:112`, `korea-public-procurement.md:65`, `proposal-writing-principles.md:81`, `README.md:48`)로 **바꾸면 안 되는 것들**이다.
3. **반대 방향 개명 누락** — 같은 개명 커밋은 `domain-frontend-vue-zero-patterns → frontend-vue-zero-patterns`, `malgn-project-standards → project-standards`처럼 접두를 **떼는** 개명도 했다. 치환 방향을 "붙이기"로만 잡았다면 이쪽이 남았을 것 → `grep -rnoE 'domain-frontend-vue-zero-patterns|malgn-project-standards' malgn-agent/knowledge/` **0건**.
4. **`common-` 접두 개명 누락** — 같은 개명 커밋의 `common-*` 3종(+기존 6종)도 동일 위험 → grep 결과 18건 히트는 전부 `knowledge/common/*.md` **파일 경로**(예: `` `verifiable-output-and-honesty.md` ``, `knowledge/common/beyond-mediocre-output.md`)이고, 실제 스킬 참조 자리(`README.md:32,36,37`)는 **이미 `skills/common-*`로 정확**했다.

---

## 4. 🔵 Rethink (발산형) — 결함 아님 · 재발 방지 백로그

### RT-001. 정적 검사기가 `knowledge/` **본문**을 참조 원천으로 스캔하지 않는다 — 이번 16건이 ERROR 0으로 살아남은 구조적 이유

**현재 구조 (실측):** `scripts/validate-agent-assets.mjs`는
- `:368-380` "Knowledge 인벤토리" — knowledge 파일을 **참조 대상(target) 집합으로만** 수집
- `:386-501` "Agent 검사" — agent 본문에서 `REF_SKILL_MISSING`/`REF_KNOWLEDGE_MISSING` 검사
- `:503-529` "Skill 본문의 참조 검증" — skill 본문에서 동일 검사

→ **knowledge 본문을 원천으로 도는 루프가 없다.** `REF_SKILL_MISSING`은 agents·skills 본문에서만 발생한다. knowledge 55개 파일은 참조를 *받기만* 하고 *내보내는* 참조는 아무도 안 본다.

**무엇이 어긋났는가:** 이 diff 직전 상태에서 `pnpm run check-assets`는 **ERROR 0 · WARN 18**을 보고했다. 죽은 스킬 참조 16건이 실재하는데도 그렇다. 즉 검사기가 "참조 정합성을 본다"고 이름 걸고 있으면서 코퍼스의 한 축을 통째로 비워두고 있고, 그 결과 2026-08-07 개명 이후 **약 2주간 16건이 초록불 밑에서 생존**했다. `knowledge/README.md`는 55개 지식 문서의 진입점이라 에이전트가 실제로 읽는 경로다.

**대안 구조:** `:503-529`의 Skill 본문 검사 루프를 knowledge 파일 집합에 그대로 한 번 더 적용한다(같은 `liveReferences(body, /Skill\s+`([a-z0-9:\-]+)`/)` + `skills/<name>` 경로 패턴). 새 규칙·새 정규식 설계가 필요 없다.

**비용 라벨 (근거 있음, 미확인 추정치 아님):** **저비용.** 근거 — ① 필요한 3요소(`skillDirNames`, `knowledgeFiles` 절대경로 순회, `liveReferences` 헬퍼)가 `main()` 안에 **이미 전부 존재**함을 코드 직독으로 확인. ② 추가 코드는 기존 루프의 복제 수준. ③ 이 스크립트는 `scripts/` 소속으로 **배포 대상이 아니며**(저장소 전용), CLAUDE.md상 PM이 직접 편집 가능한 영역이라 trainer 위임 경계도 건드리지 않는다.

**결함/개선 분류:** 판정 기준("지금 무엇이 깨져 있는가")을 적용하면 *검사기의 커버리지 공백*은 지금 깨져 있는 것에 가깝다. 다만 **이번 diff가 만든 것이 아니고**, 지금 이 순간 제품 산출물이 잘못 동작하지도 않는다(16건은 이 diff로 해소). 따라서 **이번 라운드 채택 대상이 아니라 백로그**로 이관한다 — 변경 동결 원칙의 "이렇게 하면 더 좋아진다" 쪽으로 분류. **다만 게이트 없이 병합하면 다음 개명 라운드에서 같은 사고가 반복된다**는 점은 명시적으로 기록해 둔다.

---

## 5. 트레이드오프

이번 라운드에서 페르소나 간 의견 충돌 없음. 유일하게 갈릴 수 있었던 지점(항목 1의 시점 정합)은 "역사 기록 보존" vs "포인터 유효성"의 트레이드오프였으나, `README.md:97`이라는 **문서 자신의 선례**가 이미 후자를 택하고 있어 충돌이 해소됐다.

---

## 6. 잘 된 점

1. **치환 순도 100%** — `sed 's/domain-//g'` 정규화 후 4파일 전부 HEAD와 바이트 동일. "줄 삭제·문안 재구성 없음"이라는 trainer 보고가 기계적으로 증명됐다. 이런 라운드에서 흔한 "김에 문장도 다듬기"가 0건.
2. **동명이인 판별이 정확** — knowledge 파일명과 스킬명이 의도적으로 어간을 공유하는 구조(`compliance-matrix-template.md` ↔ `domain-compliance-matrix-template`)에서, **같은 줄 안에** 바꿀 것과 두어야 할 것이 동시에 있는 케이스(`README.md:48`)를 정확히 갈랐다. 기계 치환이었다면 반드시 깨졌을 지점이다.
3. **접두어 없는 스킬을 건드리지 않음** — `reviewer-persona-panel-standard`(무접두어가 정답)를 `compliance-matrix-template.md:14`에서 그대로 두었다. 명명 규약(참조 에이전트 수 기준)을 이해한 치환.
4. **양방향·타접두어 사각지대에 잔여물 없음** — 반대 방향 개명 2종, `common-` 접두 9종 모두 잔여 0건.

---

## 7. PM 권고

- **병합 권고: 승인.** 이 diff는 변경 동결 원칙의 "실증 가능한 결함(깨진 참조) 수정"에 정확히 해당하고, 부작용 표면이 `domain-` 문자열 삽입 16건으로 닫혀 있음이 증명됐다. 추가 수정 요구 없음.
- **커밋 메시지 권고**: 개명 커밋(2026-08-07 v1.0.0 재구축)에서 `knowledge/`가 누락된 후속 정리임을 한 줄 남기면 다음 세션이 경위를 재추적하지 않는다.
- **백로그 1건 등록**: RT-001(검사기의 knowledge 본문 미스캔). 변경 동결 해제 시 우선 처리 후보 — 저비용이고, 미조치 시 다음 개명 라운드에서 동일 사고가 재발한다.
- **미수행 명시**: 이 리뷰는 **실행 액션을 일절 수행하지 않았다** — 파일 수정·커밋·병합·푸시 없음. 워킹트리는 리뷰 착수 시점과 동일하다(읽기 전용 검증 + `pnpm run check-assets` 실행만).

---

## 부록 A. 페르소나별 관점 원본

### A-1. 의미강도 보존 감사관 (수렴)
| ID | 심각도 | 위치 | 원문 → 치환문 | 의미 변화 판정 | 권고 |
|---|---|---|---|---|---|
| — | — | 15줄 전건 | `skills/X` → `skills/domain-X` (16건) | **변화 없음** — 행동 지시 강도·적용 조건·범위 한정자 전부 불변. 삭제된 살아있는 정보 0. 원문에 없던 사실 삽입 0(`sed` 정규화 diff로 증명). 매달린 수식어 0. | 조치 불요 |

특기: 이 페르소나가 가장 경계하는 "복제 규칙의 일부만 달라져 다음 세션이 그 차이를 의미로 오독" 패턴을 `README.md` 이관 표기 관례에서 점검한 결과, 치환은 비대칭을 **만든 것이 아니라 없앤 것**(`:97`과 정렬)이었다.

### A-2. 죽은 참조 스코프 도전자 (발산)
🔵 RT-001 (본문 §4). 그 외 반증 시도 4건은 §3 항목3에 기재 — 전부 반증 실패(=치환 스코프가 목적 기준과 어긋나지 않음).

발산형의 근본 질문 "치환이 애초에 옳은 해법인가"에 대한 답: **옳다.** 대안(구 이름 유지 + 별칭 문서화, 스킬 디렉토리에 심볼릭 별칭 추가)은 모두 이 라운드의 목적(설치 직원이 경로를 열 수 있게 하기)에 비해 구조가 과하고, 변경 동결 하에서 정당화되지 않는다.
