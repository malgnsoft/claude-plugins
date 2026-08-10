# 리뷰 페르소나 인덱스

새 페르소나를 만들기 전, 이 표에서 역할개념이 이미 있는지 먼저 확인한다. 겹치면 신규 파일을 만들지 않고 기존 파일을 재사용한다(Skill `reviewer-persona-panel-standard` §0 참조).

"역할개념(1줄)" 열은 각 페르소나 파일의 정체성/관심사 본문에서 라운드 서사를 뺀 핵심 질문만 적는다. 이 열끼리 의미가 겹치면 그게 곧 "동일 역할개념"이라는 신호다.

| 파일 | 역할개념(1줄) | 유형 | 최초 생성 | 최근 재사용(target_id/라운드) |
|---|---|---|---|---|
| persona-skeptical-verification-architect.md | 설계 문서 내부 근거가 독립적 증거인지 의심하는 회의적 검증가 | 수렴 | 2026-08-09 | pm-orchestration-block-propagation / 1~2차 |
| persona-ops-maintainability-realist.md | "6개월 후에도 살아있는가"를 묻는 운영 현실주의자 | 수렴 | 2026-08-09 | pm-orchestration-block-propagation / 1~2차 |
| persona-zero-based-redesigner.md | 구조 자체(훅+스킬 조합)가 최선인지, 더 단순하고 이미 검증된 대안이 있는지 의심하는 발산형 | 발산 | 2026-08-09 | pm-orchestration-block-propagation / 1~2차 |
| persona-hook-execution-safety-verifier.md | 전역 자동실행 코드가 자기보고가 아니라 실제 실행 결과(다양한 상태 재현)로 안전한지 검증하는 실행 안전성 검증가 | 수렴 | 2026-08-10 | pm-orchestration-block-propagation / 3차 |
| persona-mechanism-zero-based-challenger.md | 여러 요구사항을 만족시키려 겹겹이 쌓은 다중 레이어 구조가 정말 필요한지, 더 단순한 단일 채널로 같은 효과를 낼 수 있는지 의심하는 발산형 | 발산 | 2026-08-10 | pm-orchestration-block-propagation / 3차 |
| persona-ops-drift-realist.md | 전사 배포 후 다양한 로컬 환경에서 새로 인정된 리스크 상태(승인대기·거절 등)가 사용자에게 감지 가능한가(조용한 열화로 남지 않는가)를 묻는 운영 현실주의자 | 수렴 | 2026-08-10 | pm-orchestration-block-propagation / 3차 |
| persona-field-executability-officer.md | 지시를 읽고 지금 당장 실행 가능한 구체 절차인지(막연한 "확인하세요" 선언에 그치지 않는지) 보는 현장 실행가능성 검사관 | 수렴 | 2026-08-10 | frontend-dev-vue-zero-scope / 1차 |
| persona-frontend-scope-consistency-auditor.md | 규칙을 조건부로 좁히는 리팩터링이 모든 절에 예외 없이 전부 반영됐는지(부분 조건화가 남아 새지 않는지) 감사하는 정합성 감사관 | 수렴 | 2026-08-10 | frontend-dev-vue-zero-scope / 1차 |
| persona-vue-zero-regression-guardian.md | 다른 사용자/스택 배려를 명분으로 자신이 의존하는 기존 규칙이 실수로 깎이거나 도달 불가능해지지 않는지 보는 현직 사용자 관점의 회귀 파수꾼 | 수렴 | 2026-08-10 | frontend-dev-vue-zero-scope / 1차 |
| persona-zero-based-md-restructurer.md | 조건부 태그를 문서 곳곳에 흩뿌리는 구조 자체가 대상(스택 등)이 늘어나도 유지보수 가능한지 의심하는 정보구조 설계자(발산형) | 발산 | 2026-08-10 | frontend-dev-vue-zero-scope / 1차 |
| persona-privacy-leakage-auditor.md | 이 산출물이 회사 채널·중앙 저장소에 그대로 공유되면 무엇이 새는지 실제로 확인하는 개인정보·유출 감사관 | 수렴 | 2026-08-10 | token-usage-diagnosis-skill / 1차 |
| persona-script-skill-consistency-auditor.md | 문서가 서술하는 약속(옵션·임계값·근거)과 코드 구현이 실제로 정확히 일치하는지 한 줄씩 대조하는 정합성 감사관 | 수렴 | 2026-08-10 | token-usage-diagnosis-skill / 1차 |
| persona-self-service-scope-challenger.md | 조직 차원 문제로 시작한 조사가 개인용 셀프서비스 도구로 축소(scope reduction)된 것은 아닌지 의심하는 발산형 | 발산 | 2026-08-10 | token-usage-diagnosis-skill / 1차 |
| persona-verifiable-claim-discipline-auditor.md | claimed(해석)와 verified(스크립트 산출)의 구분이 문서 전 지점에서 실제로 지켜지는지(계산하지 않은 숫자를 지어내지 않는지) 보는 검증가능성 감사관 | 수렴 | 2026-08-10 | token-usage-diagnosis-skill / 1차 |
| persona-enforcement-gap-auditor.md | 원칙 문장이 체크리스트/영속 필드로 강제 가능한지, 아니면 자기판단에 맡겨진 서술인지 가르는 강제력 격차 감사관 | 수렴 | 2026-08-10 | reviewer-repeat-review-reduction / 1차 |
| persona-mechanism-longevity-realist.md | 새 프로세스 장치(INDEX.md 등)가 다음 라운드·동시세션 환경에서도 실제로 유지되는가를 묻는 운영 현실주의자 | 수렴 | 2026-08-10 | reviewer-repeat-review-reduction / 1차 |
| persona-process-mechanism-zero-based-challenger.md | 도입한 메커니즘 전체가 문제 크기에 비례하는지, 더 단순한 개입(링크 필수 포함 등)으로 같은 효과를 낼 수 있는지 의심하는 발산형 | 발산 | 2026-08-10 | reviewer-repeat-review-reduction / 1차 |

> **알려진 중복 역할개념 (§4.2 적용 이력 예시로 처리됨, 병합·삭제는 이번 스코프 밖)**:
> - `persona-ops-drift-realist.md` ≈ `persona-ops-maintainability-realist.md` — 둘 다 "6개월 후에도 살아있는가/사용자에게 감지 가능한가"를 묻는 운영 현실주의자.
> - `persona-mechanism-zero-based-challenger.md` ≈ `persona-zero-based-redesigner.md` — 둘 다 "구조 자체가 최선인가, 대안이 있는가"를 묻는 발산형.
>
> 새 리뷰에서 이 역할개념이 다시 필요하면 신규 파일을 만들지 말고 `persona-ops-maintainability-realist.md`/`persona-zero-based-redesigner.md`(먼저 생성된 쪽)를 재사용하고, 해당 파일 "적용 이력"에 항목만 추가한다.

> **재사용 시도 실패 기록 (2026-08-10, reviewer-repeat-review-reduction 1차 리뷰)**: 위 표의 "역할개념(1줄)"만 보면 `persona-skeptical-verification-architect.md`/`persona-ops-maintainability-realist.md`/`persona-zero-based-redesigner.md`가 이번 리뷰(reviewer 자체 프로세스 설계 검토)와 개념적으로 겹쳐 보여 재사용을 시도했으나, 세 파일 모두 "정체성/관심사/평가기준/참고파일"(6대 요소 본문)이 이전 라운드 대상(`pm-main-agent-methodology.md`, "훅+스킬 조합" 등)에 구체적으로 고정돼 있어(§0 "역할개념 고정" 규칙이 소급 적용 안 됨) 문자 그대로 재사용하면 엉뚱한 대상을 리뷰하게 됨 — 그대로 재사용하지 않고 신규 페르소나로 처리함(상세 근거: `docs/reviewer/review-reviewer-repeat-review-reduction-2026-08-10.md` RV-002). **후속 필요**: 위 3개 파일의 6대 요소 본문을 역할개념 수준으로 일반화하는 소급 정리(trainer 후속 과제).

## 유지 책임

페르소나 파일을 새로 만들거나 재사용할 때마다 reviewer가 이 표의 해당 행을 갱신한다(신규면 행 추가, 재사용이면 "최근 재사용" 열만 갱신).
