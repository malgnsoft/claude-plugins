# knowledge/skills 중복 정리 (trainer 초안) 리뷰 보고서

리뷰 페르소나 패널: `persona-spec-implementation-conformance-auditor.md` · `persona-semantic-force-preservation-auditor.md` · `persona-product-body-portability-auditor.md` · `persona-dead-reference-scope-challenger.md`(발산) · `persona-mechanism-zero-based-challenger.md`(발산)
리뷰 대상: 워크트리 `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-a3752a24aa863005e`, 브랜치 `trainer/knowledge-skill-dedup-20260831`, 커밋 `abaeef0`(base `38ce18c` = origin/main), 16파일 +60/−182
target_id: `knowledge-skill-dedup-20260831` (PM 위임에 target_id 없어 리뷰어가 브랜치명 기준 부여)
리스크 범주: 전 직원 배포 제품 본문 — 조건부 비용 자산(knowledge)의 영구 삭제
리뷰 일자: 2026-08-31
종합 판정: 🟡 **Amber** (Critical 0 / Major 2 / Minor 3 / Nit 2 / Rethink 2)

## 요약 (2분 규칙)
trainer 자체보고 7항 중 **1·4·5·6·7은 원문·실행으로 전건 참**이었고, 위임 수용기준 5항도 모두 착지했다(스크립트 2종 직접 실행 + base 워크트리에서 기준선 WARN 17 재측정해 동일 확인, `scripts/` diff 0, `malgn-agent/` 내 죽은 참조 0건). 특히 "M-2는 이미 `329a495`에서 해소됐으니 손대지 않았다"는 주장은 커밋·줄수(89줄)·본문으로 확인된 정확한 판단이며, PM 위임서 쪽이 낡은 전제를 갖고 있었다. **병합을 막을 Critical은 없다.** 다만 병합 전 처리해야 할 Major 2건이 있다 — ①플러그인 버전이 이미 릴리스된 `1.8.17` 그대로라 이 변경이 설치본에 도달하지 않는다, ②CLAUDE.md에 새로 박은 판정 규칙이 이번 라운드 자신의 삭제 판정을 설명하지 못해 다음 라운드의 왕복을 부른다.

## 페르소나 재사용 판정 (산출물 게이트)

착수 전 `docs/reviewer/personas/INDEX.md`를 Read해 역할개념 열을 스크리닝했다. **신규 0건 — 5개 전부 재사용**(6대 요소 본문 무수정, 각 파일 "적용 이력"에만 이번 라운드 1항 append).

| 페르소나 | 유형 | 판정 | 사유(INDEX 역할개념 ↔ 이번 라운드) |
|---|---|---|---|
| persona-spec-implementation-conformance-auditor.md | 수렴 | **재사용** | "명세를 계약서, 커밋을 납품물로 놓고 조항 1:1 대조" ↔ 위임 수용기준 5항 + 자체보고 7항의 착지 대조와 동형 |
| persona-semantic-force-preservation-auditor.md | 수렴 | **재사용** | "삭제·치환 후 규칙의 경계·강제력이 조용히 약해지지 않았는지 원문과 한 줄씩 대조" ↔ 이번 라운드의 본질(삭제 원문 → 스킬 흡수)과 정확히 동형 |
| persona-product-body-portability-auditor.md | 수렴 | **재사용** | "설치 직원이 조회할 수 없는 근거의 유입을 목적 기준으로 감사" ↔ 흡수 문단의 이력·식별자 유입 검사 + 도달 축(버전) |
| persona-dead-reference-scope-challenger.md | 발산 | **재사용** | "스코프를 형태로 정의한 것이 실제 판정 기준과 어긋나지 않는지, 제외 조항의 단정을 실측으로 반증" ↔ 참조처 grep 스코프(docs/ 성격 구분)·삭제 판정 기준의 형태 vs 목적 |
| persona-mechanism-zero-based-challenger.md | 발산 | **재사용** | "다중 레이어가 정말 필요한가, 단일 채널로 같은 효과가 나는가" ↔ 이 페르소나가 직전 라운드 R-2로 제기한 이중 레이어 문제의 **실행분**이 이번 대상 |

## trainer 자체보고 7항 검증 (claimed ≠ verified)

| # | trainer 주장 | 판정 | 확인방법·근거 |
|---|---|---|---|
| 1 | M-2는 이전 커밋 `329a495`에서 이미 해소, `reviewer-personas.md` 미수정 | ✅ **참** | `git log -- .../reviewer-personas.md` → 최신 변경이 `329a495`, `git diff 38ce18c HEAD -- <파일>` 공백. 현재 89줄(직전 리뷰가 인용한 `:243-255`가 존재할 수 없음). 본문 Read → 6대요소·심각도표·보고서형식 사본 전부 제거, `:5`가 포괄 면책("서술이 다르면 스킬이 우선한다")으로 교체돼 M-2 개선안 ①②를 **둘 다** 충족 |
| 2 | 삭제 3건 + 배경 흡수 | ✅ 참(누락 1건 — m-1) | `git show 38ce18c:<3파일>` 원문 ↔ 흡수처 4곳 문장 대조. 아래 "삭제 3건 흡수 대조" 표 |
| 3 | 축소 3곳 | ✅ 참, 소실 없음(예시 1건 — m-3) | 아래 "축소 3곳 손실 대조" 표 |
| 4 | `agents/trainer.md:151` 소속 관계 오류 정정 | ✅ **참** | `grep -n "전제조건\|반례\|판별 질문\|4부" skills/common-learning-loop-knowledge-management/SKILL.md` → **0건**(옛 서술이 거짓). `skills/reflect-lessons/SKILL.md:66` "## 교훈 승격 게이트"(전제조건/반례 등) · `skills/project-retrospective/SKILL.md:36-52` "4부 구조로 정리 (필수)" 실재 → 새 서술이 참 |
| 5 | 유지 판정 3건, 겹치는 본문 없음 | ✅ **참** | 3쌍 헤딩 전수 대조 + 본문 Read. `beyond-mediocre-output.md`(41줄: 5가지 냄새/4가지 표지/자가검증/역할별 적용) vs 동명 SKILL(99줄: 4대 원칙/체크리스트/품질신호) — 공통 소제목 0. `verifiable-output-and-honesty.md`(90줄, 원칙 1~4+수령검증) vs SKILL(173줄, Core Principles 5+Checklist+Example) — 공통 소제목 0. `agent-common-principles.md`(27줄, 전부 "왜"만). 인용 근거 2건도 실재 확인: `docs/architecture/agent-development-methodology.md:70`(§3.4 "경계가 정확히 지켜진 모범 사례") · `docs/methodology/audit-report.md:105`("정답 예시(모범 사례)로 명시 지정") |
| 6 | check-assets ERROR 0·WARN 17(기준선 동일), check-docs 3/3 | ✅ **참** | HEAD에서 직접 실행 → `ERROR 0 · WARN 17 · INFO 1`, `check-docs 3/3`. **기준선은 주장을 믿지 않고 재측정** — `38ce18c` detached 워크트리를 새로 만들어 같은 validator 실행 → `ERROR 0 · WARN 17 · INFO 1` 동일. WARN 17은 전부 ABS_PATH 1 + BUDGET_UNJUSTIFIED 16으로 이번 변경과 무관 |
| 7 | `knowledge/README.md:143` owner/최종검토일(M-3) "확인 필요" | ✅ **이미 해소됨** | `sed -n '130,155p' knowledge/README.md` → "신규 knowledge 문서는 `owner` 메타 라인을 포함한다… **검토 날짜는 적지 않는다** — 제품 본문은 '지금 무엇이 참인가'만 담고, 언제 손봤는지는 git 이력의 몫이다". M-3 개선안 (a)안이 `329a495`에서 이미 적용됨. **추가 조치 불필요** |

### 삭제 3건 — 흡수 대조

| 삭제 파일 | 원문에 있던 것 | 흡수처 | 판정 |
|---|---|---|---|
| `knowledge/architecture/system-design-patterns.md`(17줄) | 배경 2문단(분산·동기화 절의 대응 대상 / 7대 기법 A~G의 역추출 출처) | `skills/domain-architecture-patterns-reference/SKILL.md:8` · `skills/domain-system-design-principles/SKILL.md:249` | ✅ 거의 축자 이관. `:249`의 "위 7대 재사용 기법(A~G)"은 같은 파일 87~211행에 실재(A 추적성 사슬 ~ G 문서 분할)해 죽은 지시어 아님 |
| `knowledge/review/screenshot-capture-guide.md`(18줄) | 하드게이트 원칙 + "캡처는 별도 에이전트가 아니다" + E2E 포인터 | `skills/common-screen-verification-and-capture/SKILL.md:13-17` | ✅ 두 문단 축자 이관. E2E 포인터는 같은 스킬 기존 본문(`:161`)에 이미 존재 |
| `knowledge/common/permission-policy-compliance.md`(27줄) | 핵심원칙 / 판별기준 / **막혔을 때 행동 순서 3단계** / 반례 3 / 판별질문 | `skills/common-permission-policy-compliance/SKILL.md:15-23` | ⚠️ 판별기준·반례·판별질문은 이관. **행동 순서 2·3단계는 미이관**(m-1) |

### 축소 3곳 — 손실 대조

| 축소 대상 | 제거된 것 | 대체 정본에 실재하는가 |
|---|---|---|
| `agent-training-guide.md` 5장(88→20줄) | 모드 빠른참조표(트리거·소요시간) / 모드1 8단계 / 전원 순회 6단계 / 모드6 5단계 / §5.7 6단계 + 산출물 위치표 | ✅ 트리거·소요시간 → `agents/trainer.md:70-77` 표 / 모드1 8단계 → `skills/agent-upskill/SKILL.md:14-21` / 모드5·6 절차+"비파괴·교훈 수 보존" → `agents/trainer.md:92-100` / 산출물 위치표 → `skills/domain-training-scorecard-eval/SKILL.md:22-27`(더 상세). 제거된 `node bin/sync-agents.js`는 **미번들 죽은 참조**여서 제거가 오히려 개선. 남은 5장 참조 4곳(`:7`,`:47`,`:300`,`:374`) 전부 "5장"으로 통일돼 dangling 앵커 0 |
| `agent-training-guide.md` §4.3 | 4부 구조 코드블록 + 교정 사례 2줄 | ⚠️ 구조는 `reflect-lessons:66-74`·`project-retrospective:36-52`에 실재. **교정 사례(group-by 대비)는 어디에도 없음**(m-3) |
| `docker-cloudflare-guide.md` | 이미지 최적화 5원칙 | ✅ 5원칙 전건 `skills/domain-devops-deployment-patterns/SKILL.md`에 실재(alpine `:18`, 멀티스테이지 `:17`, .dockerignore `:20`, **레이어 캐싱 `:19`+`:30`**, non-root `:58`). pnpm 고유 함정 2건은 knowledge에 보존 — 경계가 정확 |

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| M-1 | 🟠 | 이식성/도달 | `malgn-agent/.claude-plugin/plugin.json:4` · `.claude-plugin/marketplace.json:13` | `git show 38ce18c:.../plugin.json` ↔ HEAD 대조, `git log --oneline`에서 `8a8ac7f release: v1.8.17` 확인 | 두 파일 모두 `1.8.17`로 base와 동일한데, `1.8.17`은 **이미 릴리스된 버전**이다. 이 커밋은 plugin.json의 `description`(knowledge 43→40)까지 고치면서 `version`은 올리지 않았다. 이대로 main 병합·push하면 `/plugin update`가 변경을 감지하지 못해 설치본에는 삭제된 3개 knowledge 파일이 그대로 남는다 — CLAUDE.md Architecture의 명문 규칙("버전은 plugin.json과 같이 올린다 — 어긋나면 `/plugin update`가 변경을 감지하지 못한다") 위반 | 병합 시 `plugin.json`·`marketplace.json` 버전을 함께 `1.8.18`로 올린다. `.claude-plugin/`은 PM 편집 영역이므로 trainer 반려 없이 PM이 병합 커밋에서 처리 가능 |
| M-2 | 🟠 | 규칙 정합성 / 왕복 방지 | `CLAUDE.md:125`(신규 문구) ↔ 삭제된 `knowledge/architecture/system-design-patterns.md` | 신규 규칙 문면을 삭제 대상 3건·유지 대상 3건에 각각 대입해 판정 재현 시도 | 이번 라운드가 CLAUDE.md에 새로 박은 판정 규칙은 "knowledge에는 **스킬과 본문이 겹치지 않는 것**(배경·도메인 레퍼런스·역추출 사례)만 둔다"이다. 그런데 삭제된 `system-design-patterns.md`는 **본문이 겹치지 않는 순수 배경**이었다(그래서 스킬로 흡수해야 했다). 이 규칙을 문자대로 적용하면 그 파일은 **유지** 판정이 나온다 — 규칙이 자기 라운드의 삭제 판정을 재현하지 못한다. 실제 적용된 기준은 "배경이 스킬 상단 2~3줄로 흡수 가능한 분량이면 흡수 후 삭제, 한 문서 분량의 독립 렌즈면 유지"였는데 이게 어디에도 안 적혔다. 다음 라운드가 문면대로 판단해 스텁을 되살리면 CLAUDE.md "변경이력 관리 원칙"이 금지하는 왕복이 난다 | `CLAUDE.md:125`를 실제 기준으로 다시 쓴다. 예: "절차·체크리스트 정본은 skills/. knowledge에는 **그 파일을 여는 에이전트가 스킬만 읽어서는 얻지 못하는 것**(한 문서 분량의 독립 렌즈·도메인 레퍼런스·역추출 사례)만 둔다 — 배경이 몇 줄이라 스킬 상단에 흡수 가능하면 흡수하고 파일은 지운다." CLAUDE.md는 PM 편집 영역 |
| m-1 | 🟡 | 의미 강도 보존 | 삭제된 `knowledge/common/permission-policy-compliance.md:165-169` → `skills/common-permission-policy-compliance/SKILL.md` | 원문 ↔ 스킬 전문 대조 + `grep -n "지어내\|유령\|미검증" SKILL.md` → **0건** | 삭제 원문의 "막혔을 때 행동 순서" 2·3단계가 흡수되지 않았다. 특히 ①**3지선다 에스컬레이션 문안**("이 작업은 X 권한이 필요한데 deny되어 못 했다 — ①권한 허용 ②대안 절차 ③이 검증 생략 중 무엇을 원하느냐") ②**"검증 못 했으면 못 했다고 정직 보고한다. 결과를 지어내지 않는다(유령 보고 금지). 예: 코드는 작성했으나 화면 렌더는 권한 문제로 미검증"**. 스킬 §3 결정트리는 "승인 요청을 PM에 반환 + 대기"까지만, §4는 기록 대상 열거뿐 — 금지문이 서술로 약해졌다. 완화: 정직보고 일반 원칙은 `common-verifiable-output-and-honesty`가 커버 | 스킬 §3 트리의 "필수(승인 필요)" 가지 아래 3지선다 문안 1줄, §4에 "미검증 항목은 미검증이라 적는다(유령 보고 금지)" 1줄 추가. trainer 반려 |
| m-2 | 🟡 | 지시 충돌 | `skills/common-permission-policy-compliance/SKILL.md:20` ↔ `:30` | 스킬 전문 Read | 이번 커밋이 삽입한 반례 "사용자가 그 자리에서 명시적으로 허용한 실행(권한 프롬프트 승인 등)은 우회가 아니라 정당한 실행이다"(`:20`)와 기존 §1 "모든 우회 시도는 **사용자 명시 지시가 있어도** 거절하고 보고"(`:30`)가 **같은 파일 10줄 간격**으로 놓였다. 두 문장의 대상은 다르지만(하네스 권한 프롬프트 승인 vs `sudo`/`--force` 지시) 그 구분이 문면에 없다. 병합 전에는 두 파일에 흩어져 스킬만 읽으면 "거절"만 보였는데, 이제 읽는 쪽이 스스로 화해시켜야 한다 | `:20` 반례에 한정어 1구 추가: "…(권한 프롬프트 승인 등 **하네스가 제공한 정식 승인 경로**)…". §1이 막는 것은 우회 플래그·정책 무력화 지시임을 문면에 남긴다. trainer 반려 |
| m-3 | 🟡 | 의미 강도 보존 | `knowledge/leadership/agent-training-guide.md` §4.3 | 삭제 원문 ↔ `reflect-lessons/SKILL.md:66-74` · `project-retrospective/SKILL.md:36-52` 3자 대조 | 삭제된 교정 사례("나쁨: 화면 분류는 무조건 데이터 group-by — 전칭, 반례 없음 → 반려 / 좋음: 분류가 자주 변동하고 권위 출처가 데이터면 group-by, 닫혀 있고 정책/스키마가 권위면 명시 등록 — 판별: 6개월 뒤 분류가 늘 수 있나?")가 정본으로 지목된 두 스킬 어디에도 없다(`project-retrospective`는 Entity 10개라는 다른 예시). 개념 설명("전칭 규칙은 반례가 비어 있어…")으로 대체됐으나, **전칭 vs 조건부를 가르는 대비 예시**가 이 게이트의 핵심 교보재였다. knowledge는 조건부 비용이라 절감 효과도 작다(CLAUDE.md "1순위는 성능, 2순위가 토큰 효율") | 사례 2줄을 §4.3에 되살리거나, 정본인 `reflect-lessons` "교훈 승격 게이트"로 옮긴다. trainer 반려(낮은 우선순위) |
| n-1 | ⚪ | 배치 | `skills/domain-system-design-principles/SKILL.md:249` | 파일 구조 확인 | 흡수한 배경 문단이 "## 참고 자료" 섹션의 참조 불릿 **아래** blockquote로 붙어 있어, 설명 대상인 기법 A~G 본문(`:87-211`)과 멀다. "위 7대 재사용 기법(A~G)"의 "위"가 160줄 위를 가리킨다 | `:87` "## 우수 설계 7대 재사용 기법" 바로 아래로 이동 |
| n-2 | ⚪ | 병합 운영 | `CLAUDE.md` | 메인 워킹트리 `git status`(세션 시작 스냅샷)에 `M CLAUDE.md` | 병행 세션이 메인 워킹트리에서 `CLAUDE.md`를 미커밋 수정 중이다(hooks 서술 어순 차이 확인). 이 브랜치도 `CLAUDE.md:125`를 고쳐 같은 파일에서 만난다 | 병합 전 `git status`·`git diff` 재확인 후, CLAUDE.md "공유 워크트리 merge 전 브랜치 확인" 원칙대로 격리 워크트리에서 병합 |

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 죽은참조 스코프(발산) | `docs/architecture/agent-development-methodology.md:63`이 "원 Knowledge 파일은 **삭제하지 않는다**(연혁 추적성)"고 명시하는데 이번 커밋이 3건을 삭제 → 살아있는 절차 문서와 충돌하는 🟠 | **기각** | 해당 파일 헤더가 "맑은소프트 에이전트 개발방법론 (**초안 A안 v0.1**) / 지위: 초안"이고, `docs/README.md:15`가 "v0.1 초안 보존본이며 **어느 쪽도 판정 기준 정본이 아니다**"라고 명시 → 사료. 참조처 정정 대상 아님 |
| 의미강도 | `docker-cloudflare-guide.md`에서 삭제된 5원칙 중 "레이어 캐싱 활용(package.json 먼저 COPY)"이 스킬에 없다 | **기각** | `skills/domain-devops-deployment-patterns/SKILL.md:19`("레이어 순서: 자주 변경되는 것을 맨 아래 — 캐시 효율 극대화") + `:30`(`COPY package*.json ./`)로 실재. grep 패턴을 "레이어 캐싱" 축자로만 잡은 내 검색 오류 |
| 정합성 | 이번 커밋이 이미지 최적화 정본으로 지목한 `domain-devops-deployment-patterns/SKILL.md:30`의 예시가 `COPY package*.json ./`인데, 이는 knowledge에 남긴 pnpm 함정 설명이 "`pnpm-lock.yaml`을 담지 못해 `--frozen-lockfile`이 실패한다"고 경고하는 바로 그 패턴이다 | **⚪로 강등 + 백로그** | 지적 자체는 참(두 파일을 나란히 열어 확인). 그러나 해당 스킬 본문은 이번 diff 스코프 밖이고(이 커밋은 `:8` 1줄만 추가), 원인은 pnpm 전제가 아닌 범용 예시라는 점 — 별건 결함으로 백로그 |
| 이중레이어(발산) | R-2가 지목한 "포인터 문서 12개" 중 3개만 처리한 부분 착수다 | **기각** | 실측 반증: 25줄 이하 knowledge 파일 0건(유일한 22줄 `intent-fit-vs-correctness-split.md`는 독립 본문), "정본은 skills" 문구를 가진 8건 전부 독립 본문 보유, `KNOWLEDGE_ORPHAN` 0건. 나머지는 이전 라운드들(61→55→44→43)에서 이미 처리됨 — 이번 라운드로 정리가 **사실상 완료** |

## 페르소나별 관점

### [명세-구현 적합성 감사관] — 판정: 🟡 Amber
계약서(위임 수용기준 5항 + 자체보고 7항) ↔ 납품물 1:1 대조에서 **미착지 1건(M-1 버전)**을 제외하면 전건 착지. ⑤`scripts/` 불가침은 `git diff --stat`에 해당 경로 0건으로 확인. ④는 주장을 믿지 않고 base 워크트리를 새로 만들어 기준선을 직접 재측정했다 — WARN 17 동일. 자체보고 1번("이미 해소돼 있었다")은 이 라운드에서 가장 검증 가치가 높은 주장이었는데, **참**이었을 뿐 아니라 PM 위임서의 낡은 전제를 실물로 반증한 좋은 판단이었다.

### [의미 강도 보존 감사관] — 판정: 🟡 Amber
6개 대상 파일의 삭제 전 원문을 전부 꺼내 흡수처와 문장 단위로 대조했다. 흡수 품질은 대체로 축자에 가까웠으나 **`permission-policy-compliance.md`에서만 강제력 있는 금지문 2개가 서술로 증발했다(m-1)**. 이 페르소나가 아니면 안 잡혔을 유형이다 — 파일 개수·줄 수·정적검사는 전부 통과 상태였다. 축소 3곳은 대체 정본에서 전건 회수 확인, 유일한 실질 소실은 §4.3 교정 사례(m-3)다.

### [제품 본문 이식성 감사관] — 판정: 🟠 Amber
새로 삽입된 4개 흡수 문단에 식별자·날짜 도장·라운드/커밋 언급 유입 **0건**(전부 현재형 서술) — CLAUDE.md 항구 규칙 준수. 그러나 이번 라운드는 "무엇이 새로 오염됐나"보다 **"설치 직원에게 닿는가"**가 결정적이었고, 거기서 M-1이 나왔다. 본문을 아무리 정확히 정리해도 버전이 안 올라가면 설치본에는 삭제된 파일이 그대로 남는다 — 도달하지 않은 정리는 정리가 아니다.

### [죽은 참조 스코프 도전자 — 발산] — 판정: 🔵 + 🟠(M-2)
"참조처 grep 0건" 단정을 반증하려 저장소 전체를 다시 훑었고, `malgn-agent/` 내 잔존 0건은 **참**으로 확인됐다. `docs/` 잔존 3파일은 성격 판정 끝에 사료로 확정해 내 자신의 Major 지적을 자진 기각했다. 대신 더 근본적인 것을 잡았다 — **스코프 정의 자체가 이번 라운드의 판정을 재현하지 못한다(M-2)**. 형태("포인터 전용인가")로 규칙을 적으면 다음 라운드가 그 형태에 안 걸리는 파일을 놓치거나, 반대로 지워야 할 것을 살려둔다.

### [메커니즘 제로베이스 도전자 — 발산] — 판정: 🔵
직전 라운드에 내가 R-2로 제기한 이중 레이어의 실행분을 제로베이스로 재확인했다. 결론은 "더 지울 것이 남았다"가 아니라 **"정리는 끝났고, 이 상태를 지키는 장치가 없다"**다(아래 Rethink R-1).

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| R-1 | 이중 레이어 재유입을 막는 장치가 **산문 규칙 1줄**(CLAUDE.md:125)뿐. 직전 라운드 R-2의 (c)안("같은 소제목이 skill·knowledge 양쪽에 있으면 WARN")은 미실행이고, `validate-agent-assets.mjs` 검사코드 60종에 중복 탐지가 없다(`grep -oE "'[A-Z_]{4,}'"`로 전수 확인 — `KNOWLEDGE_ORPHAN`·`CANONICAL_CLAIM`은 있으나 중복은 없음) | `scripts/validate-agent-assets.mjs`에 저비용 WARN 1개: "knowledge 파일 본문이 40줄 미만이면서 '정본은 skills/…' 문구를 포함하면 스텁 후보". 소제목 전수 대조 같은 무거운 규칙이 아니라, 이번 라운드가 실제로 지운 것의 **형태 시그니처**만 잡는다 | 이번 정리는 사람이 3라운드에 걸쳐 손으로 했다. 기계 게이트가 없으면 다음 스킬 신설 때 또 스텁이 생기고, 발견은 다시 전수 감사 때다. 현재 스텁 0건이라 **도입 즉시 오탐 0** — 지금이 넣기 가장 싼 시점 | 작음. `scripts/`(PM 소관, 배포되지 않음) 파일 1개 +15줄. 리스크: 임계값 40줄은 자의적 → 오탐 시 WARN이라 차단 안 함 |
| R-2 | 판정 기준을 **형태**("포인터 전용 문서인가")로 적어 CLAUDE.md에 박았다. 그 문면이 이번 라운드 자신의 삭제 6건 중 일부를 설명하지 못한다(M-2) | 기준을 **목적**으로 재정의: "이 파일을 여는 에이전트가 대응 스킬만 읽어서는 못 얻는 것이 있는가?" YES면 유지, NO면 그 몇 줄을 스킬 상단으로 흡수하고 파일을 지운다 | 형태 기준은 새 형태가 나오면 무력해지고(스텁이 40줄로 살찌면 통과), 목적 기준은 판정자가 매번 같은 질문을 던지게 한다. CLAUDE.md가 이미 식별자 규칙에서 "스코프는 형태가 아니라 목적으로 잡는다"를 채택했으므로 **같은 문서 안의 두 규칙이 같은 논리를 쓰게 된다** | 작음. CLAUDE.md 1줄 교체(PM 소관). M-2와 같은 조치 |

## 트레이드오프 (페르소나 간 충돌)
- **의미강도 감사관(m-1·m-3 반려 요구) ↔ 제로베이스 도전자(정리는 끝났으니 사이클을 닫아라)**: 전자는 3줄 복원을 위해 trainer 재위임 사이클을 한 번 더 돌리자고 하고, 후자는 그 비용이 얻는 것보다 크다고 본다. → **권고: m-1만 반려에 포함하고 m-2·m-3은 같은 반려 건에 묶어 1회로 처리한다.** m-1은 "권한에 막혔을 때 무엇을 말할지"라는 **실행 문안**이라 없으면 에이전트가 그 자리에서 만들어내야 하고, m-2는 같은 파일 안의 충돌이라 방치하면 판단이 갈린다. m-3(교정 사례)은 개념 설명으로 대체돼 있어 단독으로는 사이클을 열 가치가 없다.
- **이식성 감사관(M-1 지금 올려라) ↔ 편집 권한 경계(trainer 전담)**: `.claude-plugin/`은 trainer 전담 4개 디렉토리(`agents`/`skills`/`knowledge`/`hooks`)에 **포함되지 않으므로** PM이 직접 처리 가능. → **권고: M-1은 trainer 반려 없이 PM이 병합 커밋에서 버전을 올린다.** M-2도 CLAUDE.md라 동일.

## 잘 된 점 (다음 산출물의 기준)
- **위임서의 낡은 전제를 실물로 반증하고 손대지 않은 판단**(자체보고 1번). "M-2 확정 지적을 처리하라"는 지시를 받고도 커밋 이력을 먼저 확인해 이미 해소됐음을 밝혔다. 지시대로 다시 손댔다면 CLAUDE.md가 금지하는 왕복이 됐을 것이다. **이것이 이 라운드의 최고 성과다.**
- **부수 발견의 정확성**(자체보고 4번). `trainer.md:151`이 `common-learning-loop-knowledge-management`에 교훈 게이트가 "포함"된다고 서술했으나 그 스킬에는 관련 문구가 **0건**이었다. 위임 범위 밖인데도 잡아 정정했고, 새 서술이 가리키는 두 스킬에는 실물이 있다.
- **경계를 살린 축소**. `docker-cloudflare-guide.md`에서 스택 무관 규칙만 걷어내고 **pnpm 고유 함정 2건(corepack 부재 시 `pnpm: not found`, `package*.json` 글롭이 `pnpm-lock.yaml`을 놓쳐 `--frozen-lockfile` 실패)은 보존**했다. "정본으로 몰기"와 "고유값 지키기"를 동시에 해낸 좋은 예다.
- **문서-실물 정합 유지**. `knowledge/README.md`의 파일 목록 ↔ 실물 40개가 **양방향 전건 일치**(README 미등재 0 / 실물 없는 언급 0). 삭제 항목을 괄호 서술로 바꿔 "왜 없는지"까지 남겼다.
- **죽은 참조 동반 정정**. `agents/reviewer.md`·`knowledge/design/ux-design-guide.md`·`skills/common-screen-verification-and-capture` 역참조를 같은 커밋에서 정리해 `REF_KNOWLEDGE_MISSING` 0 유지.

## 평가기준 충족 현황

| 기준(위임 수용기준) | 관점 | 중요도 | 충족 | 비고 |
|---|---|---|---|---|
| ① 포인터 전용 문서 삭제 + 배경 스킬 흡수 | 적합성/의미강도 | 필수 | ⚠️ 부분 | 3건 삭제·흡수 완료, 흡수 누락 1건(m-1) |
| ② 본문 중복은 고유분만 남기고 삭제 | 적합성 | 필수 | ✅ | 축소 3곳, 대체 정본에서 전건 회수(예시 1건 제외) |
| ③ 참조처 전수 grep 정정 | 죽은참조 | 필수 | ✅ | `malgn-agent/` 잔존 0, `docs/` 잔존 3건은 사료로 판정 |
| ④ check-assets ERROR 0 / check-docs 통과 | 적합성 | 필수 | ✅ | 직접 실행 + base 기준선 재측정으로 동일 확인 |
| ⑤ `scripts/` 불가침 | 적합성 | 필수 | ✅ | diff 0건 |
| (불변량) 설치본 도달 | 이식성 | 필수 | ❌ | M-1 — 버전 미범프 |
| (불변량) 제품 본문 이력·식별자 무유입 | 이식성 | 필수 | ✅ | 신규 문단 4곳 전부 현재형, 유입 0 |
| (불변량) 규칙과 실행의 일치 | 죽은참조(발산) | 권장 | ❌ | M-2 — CLAUDE.md 신규 문면이 자기 판정 미재현 |

## PM에게 권고

1. **병합 가능 여부: 조건부 가능(🟡 Amber).** Critical 0건이고 수용기준 5항이 전건 착지했으므로 되돌릴 이유는 없다. 아래 2·3을 처리한 뒤 병합한다.
2. **PM이 직접 처리(trainer 반려 불필요 — `.claude-plugin/`·`CLAUDE.md`는 PM 편집 영역)**
   - **M-1**: 병합 커밋에서 `malgn-agent/.claude-plugin/plugin.json`·`.claude-plugin/marketplace.json`을 `1.8.18`로 함께 올린다. **이걸 빠뜨리면 이번 라운드 전체가 설치본에 도달하지 않는다.**
   - **M-2**: `CLAUDE.md:125`를 목적 기준 문안으로 교체(R-2와 동일 조치, 1줄).
3. **trainer에 반려(1회로 묶어서)** — m-1(권한 스킬에 에스컬레이션 3지선다 + 유령보고 금지 1줄 복원) · m-2(반례에 "하네스가 제공한 정식 승인 경로" 한정어) · n-1(흡수 문단 배치 이동). m-3은 같은 반려에 얹되 우선순위 낮음으로 표기.
4. **변경 동결 원칙 대조**: 이 라운드는 형식상 "구조 변경"이라 보류 대상으로 보이지만, 사용자가 "skill 정본 우선, knowledge 중복 삭제"를 **명시 지시**한 건이므로 동결 예외다. 다만 R-1(check-assets 게이트 신설)은 **지금 하자는 제안이 아니라 백로그 등재 제안**이다 — 효과가 명백하고 비용이 작아(scripts/ 1파일) 등재 범위에는 든다.
5. **병합 실행 시**: n-2대로 메인 워킹트리의 미커밋 `CLAUDE.md` 수정을 먼저 확인하고, 격리 워크트리에서 병합한다.
6. **본 리뷰가 하지 않은 것(정직 보고)**: UI/화면 리뷰 없음(대상이 전부 마크다운 문서 — 캡처 대상 없음). `docs/reviewer/screenshots/` 산출물 없음. 삭제 3파일 외 나머지 37개 knowledge와 38개 skills의 전수 중복 재감사는 이번 스코프 밖이며, 스텁 형태 시그니처(25줄 이하 / "정본은 skills" 문구) 기준의 표본 스캔만 수행했다.

---
> 실행 액션 없음 — 본 리뷰는 검증만 수행했다. 병합·버전 범프·커밋·push 어느 것도 실행하지 않았다(reviewer 권한 밖). 작업 중 생성한 임시 base 워크트리(`.../scratchpad/base`, `38ce18c` detached)는 검증 후 제거했다.
