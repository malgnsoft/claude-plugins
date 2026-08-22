# malgn-agent 전수 감사 보고서

- 기준 문서: `docs/methodology/agent-development-methodology.md` (agent-development-methodology rubric)
- 감사 대상: agents 21 / skills 35 / knowledge 59(전수 61종 중 이번 배치 감사 대상) / hooks 4파일 = 총 119개
- 감사 방식: 배치별(agents-1~3, skills-1~5, knowledge-1~6, hooks) 원시 판정을 통합
- 본 보고서는 3단계(재작성) 착수를 위한 통합 진단 보고서이며, 개별 판정의 최종 확정이 아니라 **PM/architect/evaluator가 §10.2 절차로 확정해야 할 결정 필요 사항**을 함께 정리한다.

---

## 1. 요약 통계

### 1.1 전체 합계 (119개)

| 판정 | 개수 | 비율 |
|---|---:|---:|
| keep | 24 | 20.2% |
| minor_revise | 59 | 49.6% |
| rewrite | 25 | 21.0% |
| retire | 7 | 5.9% |
| merge_candidate | 4 | 3.4% |
| **합계** | **119** | 100% |

### 1.2 카테고리별

| 카테고리 | 총계 | keep | minor_revise | rewrite | retire | merge_candidate |
|---|---:|---:|---:|---:|---:|---:|
| agents | 21 | 0 | 18 | 3 | 0 | 0 |
| skills | 35 | 5 | 24 | 5 | 0 | 1 |
| knowledge | 59 | 16 | 16 | 17 | 7 | 3 |
| hooks | 4 | 3 | 1 | 0 | 0 | 0 |

**해석**
- **agents는 keep이 0개** — 21개 전량이 최소 minor_revise 이상. 이는 전사 공통 결함(§9.8 항목4, 'COO' 잔존)이 20/21개에 퍼져 있고, 그 자체가 minor_revise의 자동 사유가 되기 때문. 심각도 자체(구조·경로실재)로 rewrite까지 간 것은 3개(evaluator/pm/trainer, 이른바 "오케스트레이션 트랙")뿐.
- **hooks는 사실상 전부 건강함**(3 keep + 1 minor_revise) — 4개 계층 중 유일하게 rewrite/retire가 0개인 카테고리.
- **knowledge가 retire(7)·merge_candidate(3) 대부분을 차지** — Skill로의 "이관"이 README상으로만 선언되고 실제로는 본문이 복제된 채 방치된 사례(§1.3 이관 절차 ③ 미이행)가 반복적으로 발견됨.

---

## 2. retire·merge_candidate 목록과 근거

### 2.1 retire 대상 (7개, 전부 knowledge)

| 파일 | 근거 | 처리 제안 |
|---|---|---|
| `knowledge/backend/api-implementation-patterns.md` | `skills/backend-api-implementation-patterns/SKILL.md`와 427줄 vs 431줄 수준의 사실상 전체 중복. README는 "이관됨"이라 서술하나 실물은 그대로 남음(§1.3 절차③ 위반, §5.2 드리프트) | 전량 폐기. Skill 쪽에 이미 흡수 완료 — 스텁조차 남길 고유 콘텐츠 없음 |
| `knowledge/common/global-skill-architecture.md` | 존재하지 않는 스킬명(`common-deep-research` 등)·개인 `~/.claude/skills/` 경로를 정본처럼 서술(§7.4-G, §9.4 위반). 이 문서의 L1/L2/L3 거버넌스 모델 자체가 이미 채택된 §4.2 3단 접두어 체계로 완전 대체됨 | 폐기. 후속 필요사항은 rubric §4.2에 이미 흡수됨 |
| `knowledge/common/project-level-skill-definition-standard.md` | 개인 경로(`~/.claude/knowledge/proposals/...`) 잔존 + '프로젝트별 스킬' 계층 개념이 이 플러그인 어디에도 실제 사용되지 않음(§1.1 4계층 모델 밖의 미조정 개인 이식) | 폐기(단, "프로젝트 전용 스킬" 개념이 로드맵상 필요한지는 §6 open_questions 참조 후 결정) |
| `knowledge/common/skill-discovery-and-reuse-guide.md` | global-skill-architecture.md와 동일 계열 드리프트(존재하지 않는 스킬명·개인 경로), '신규 스킬 결정 트리'는 rubric §2.2~§2.4가 이미 더 정교하게 대체(superseded) | 폐기. global-skill-architecture.md와 사실상 서로의 merge 대상이었던 쌍이나, 둘 다 rubric 본문으로 완전 대체되어 병합할 가치 없이 폐기 |
| `knowledge/leadership/agent-skill-definitions.md` | 존재하지 않는 `skill_score`/`exp_score` 체계 전제, 19명 기준 배점표(실제 21명과 불일치), 미번들 스크립트(`bin/skill-definitions.js`) 산출물을 정본처럼 제시 | 폐기. 정량 스코어 체계 자체를 부활시킬지는 §6 결정 필요 사항 참조 |
| `knowledge/leadership/agent-skill-status-2026.md` | 미번들 스크립트(`bin/sync-agents.js`) 실행 결과라는 스냅샷을 실물처럼 제시, 19명 기준 현황표가 21명과 불일치, README 미등재·고아 문서 | 폐기 |
| `knowledge/leadership/agent-training-guide-draft.md` | 최종본 `agent-training-guide.md`와 목차·본문 거의 동일한 초안. 최종본이 이미 존재하므로 별도 자산 유지 근거 없음. 개인 경로(`~/.claude/agents_backup_...`)도 잔존 | 폐기. 최종본(`agent-training-guide.md`)은 별도로 rewrite 대상(§3 참조) |

### 2.2 merge_candidate 대상 (4개)

| 파일 | 흡수 대상(제안) | 근거 |
|---|---|---|
| `skills/backend-security-audit/SKILL.md` | `skills/backend-api-implementation-patterns/SKILL.md`(구현패턴) + `skills/domain-backend-api-security/SKILL.md`(원론) | site_id 멀티테넌시, error.name→상태코드, requireRole/requireExecutive 역할가드가 backend-api-implementation-patterns의 F/D/B절과 실질 중복. 게다가 site_id/requireRole 등이 malgnai 프로젝트 1개의 고유 관례일 가능성(coaching 프로젝트는 company_id 사용) — **먼저 회사 표준 여부를 확인**(§6 결정 필요 사항 참조)한 뒤, 표준이면 두 스킬에 일반화 흡수하고 이 파일은 폐기, 프로젝트 특수사례면 전체 폐기(§2.2) |
| `knowledge/architecture/vue-zero-architecture.md` | `knowledge/frontend/vue-zero-patterns.md`(패턴 상세) 또는 그 역방향 — **먼저 규칙 정본을 확정**해야 함 | 두 파일이 정면 모순(`window.*` 경유 허용 vs composables 절대 금지)되며, 어느 쪽이 "규칙 정본"이고 어느 쪽이 "패턴 상세"인지 상호 배제 문구가 없음. 또한 이 파일 자체가 architect 전담 폴더(architecture/)에 있으면서 내용은 전부 frontend-dev의 Vue 구현 세부사항이라 폴더-대상 매핑도 어긋남(§5.1) |
| `knowledge/leadership/team-composition-patterns.md` | `knowledge/leadership/coo-rule-rationale.md`(항목4 "경로 릴레이") | '경로 릴레이: 사슬 전체를 한 번에 위임하지 말 것' 절이 coo-rule-rationale.md 항목4와 동일 사고사례·동일 3가지 이점 문구로 중복. 사고사례는 coo-rule-rationale.md를 권위자로, 팀구성표·키워드매핑표 등 고유 부분만 이 파일에 남기고 참조 1줄로 정리 |
| `knowledge/security/owasp-security-checklist.md` | `domain-backend-api-security`(A01/A03) + `domain-security-audit-checklist`(A02/A09) + `domain-devops-deployment-patterns`(인프라/Docker 섹션) 3개 스킬로 섹션별 분산 흡수 | 전체가 순수 체크리스트(§1.3상 Skill 성격)이며 4개 보안류 스킬과 항목·코드예시 수준까지 실질 중복(80%+). 다만 단일 대상이 아니라 여러 스킬에 걸쳐 겹쳐 있어 "분산 병합"이 필요 — 최종 분배는 architect/evaluator 확인 필요(§6 참조). A07(Vue v-html XSS) 섹션만 4개 스킬 어디에도 없는 유일한 신규 내용이므로 반드시 보존 |

---

## 3. rewrite 대상의 공통 실패 패턴 (25개)

25개 rewrite 대상(agents 3 + skills 5 + knowledge 17)을 관통하는 반복 위반 절은 다음 순서로 빈도가 높다. **3단계 재작성 시 이 순서대로 교정 우선순위를 둔다.**

### 패턴 1 — §7.4/§7.6 "경로 실재 대조" 위반: 번들되지 않은 도구·문서를 실행 가능한 것처럼 서술 (최다·최우선)
- 해당: `agents/evaluator.md`, `agents/trainer.md`, `skills/agent-upskill`, `skills/screen-verification-and-capture`, `skills/topic-learning`, `skills/training-scorecard-eval`, `knowledge/leadership/agent-training-guide.md`, `knowledge/leadership/agent-skill-definitions.md`(retire), `knowledge/leadership/agent-skill-status-2026.md`(retire), `knowledge/quality/e2e-testing-guide.md`
- 공통 원인: `promote-agent.mjs`/`promote-skill.mjs`/`promote-knowledge.mjs`/`bin/sync-agents.js`/`docs/guides/agent-design-reference/*`/`~/.claude/tools/`(전역 `shot` CLI, Playwright 인프라) 등 저장소 저자의 **개인 로컬 인프라**를 "번들 안 됨" 각주 없이 정본 절차처럼 서술.
- 교정 우선순위 1위 이유: 이 패턴이 "핵심 3종(pm/evaluator/trainer) 중 2개 이상 실행 불가"라는 §9.7 트리거를 이미 발동시켜, **개별 패치가 아니라 "오케스트레이션 트랙" 전체 재작성**을 강제하고 있음(§4 참조).

### 패턴 2 — §9.8 항목4/§9.1: 'COO' 페르소나 잔존 (전사 확산, 최다 발생 건수)
- 해당: 거의 전 카테고리(agents 20/21, skills의 malgnai-discussion-culture/pre-deployment-verification-gate, knowledge의 coo-rule-rationale/i18n-terminology-audit-guide/reviewer-personas 등)
- 공통 원인: 이 저장소 자신의 로컬 운영 페르소나('대니/COO')와 배포 제품(malgn-agent)의 실제 오케스트레이터('pm.md')를 구분하지 않고 이식.
- 다만 minor_revise 대상(단순 표기 치환) vs rewrite 대상(malgnai-discussion-culture처럼 섹션 구조 전체가 COO 전제로 짜인 경우)은 구분해서 처리해야 함 — 단순 grep 치환으로 안 되는 파일만 이 패턴으로 카운트.

### 패턴 3 — §5.1/§9.4 이식성 위반: 개인 절대경로(`~/.claude/...`)를 정본 경로로 서술
- 해당: `skills/agent-upskill`, `knowledge/common/*`(agent-common-principles/project-folder-structure/token-efficient-collaboration/trainer-mode-10-curriculum-design 등), `knowledge/leadership/agent-training-guide.md`, `knowledge/presentation/a4-document-fundamentals.md`(참조 위반), `skills/topic-learning`
- 고객 배포 환경에는 존재하지 않는 저자 개인 환경 경로 — 조용히 깨지는 유형(회귀 테스트로 못 잡음).

### 패턴 4 — §1.3 이관 절차 ③ 미이행: "본문은 Skill로 이관됨"이라고 README/본문이 주장하나 실물은 완전 복제로 남음
- 해당: `knowledge/architecture/system-design-patterns.md`, `knowledge/design/visual-design-system.md`, `knowledge/proposal/shipley-proposal-process.md`, `knowledge/quality/testing-guide.md`, `knowledge/presentation/a4-document-fundamentals.md`, `knowledge/presentation/publishing-style-guide-template.md`(미이관), `knowledge/writing/document-writing-guide.md`(agents/writer.md와 중복)
- 문서-실물 드리프트가 knowledge 카테고리에 체계적으로 퍼져 있음(§9.7 "카테고리 내 30%" 조건 초과 가능성 — §6 결정 필요 사항 참조).

### 패턴 5 — §1.3 문체판정: '왜' 없는 순수 명령형 콘텐츠가 Knowledge 계층을 잘못 차지
- 해당: `knowledge/common/agent-common-principles.md`, `knowledge/common/project-folder-structure.md`, `knowledge/common/project-management.md`, `knowledge/common/token-efficient-collaboration.md`, `knowledge/quality/e2e-testing-guide.md`, `knowledge/proposal/proposal-writing-principles.md`
- 이 패턴은 대부분 §2.2 신설 판정 트리를 적용하면 Skill 후보 — 재작성 시 "Skill로 승격 + 배경만 Knowledge에 스텁"이 정답 방향.

### 패턴 6 — §7.4 모순 판정: 신구 문서가 반대 방향을 가리키는데 상하위 관계가 정리되지 않음
- 해당: `knowledge/common/project-folder-structure.md`(progress.md vs STATUS.md), `knowledge/common/project-management.md`(동일), `knowledge/design/ux-design-guide.md`(폐기된 캡처 방식 vs screen-verification-and-capture), `knowledge/review/screenshot-capture-guide.md`(동일 계열, capture-all.js 부활 서술)
- 최신/상위 규칙(STATUS.md 표준, screen-verification-and-capture 표준)으로 일괄 정정 필요.

---

## 4. keep/minor_revise 대상 중 재작성본에도 반드시 보존해야 할 장점

| 자산 | 보존해야 할 이유 |
|---|---|
| `agents/architect.md`의 §3.1 골격 + 트레이드오프 5슬롯 형식 | rubric §4.3이 직접 인용하는 모호성 제거 모범 사례. 오케스트레이션 트랙 재작성 시 이 슬롯 형식을 pm.md의 위임 패킷에도 이식할 것 |
| `agents/backend-dev.md`·`agents/rfp-analyst.md`·`agents/capture-strategist.md`의 '역할 경계'에 인접 에이전트를 이름으로 명시하는 관행(§3.2③) | devops/finance는 이 관행이 빠져 있어 minor_revise 사유가 됨 — 21개 전체에 일관 적용 필요 |
| `agents/frontend-dev.md`·`agents/qa-engineer.md`의 사실 확인형 자기검증 체크리스트(스크린샷 md5 비교, git diff 대조 등) | §3.2⑤ 모범 — 재작성 시 evaluator.md의 자기검증 절에도 이 수준의 구체성을 이식 |
| `agents/qa-engineer.md`의 "자율 실행 가능 판단 유형을 정확히 2개 유형으로 한정, 자동 확장 금지" | §4.3 열린 수량어 제거 모범 사례 |
| `skills/system-design-principles`의 트레이드오프 5슬롯("선택/대안/선택 이유/포기한 것/감당 방안") | rubric §4.3 자체가 인용하는 원본 정본 — 재작성 전반에서 참조 표준으로 유지 |
| `skills/common-beyond-mediocre-output` + `knowledge/common/beyond-mediocre-output.md` 쌍 | rubric 부록A가 "정답 예시(모범 사례)"로 명시 지정 — Skill/Knowledge 경계가 완벽히 유지된 유일한 완전체 사례. 다른 파일 이관 작업의 참조 템플릿으로 사용 |
| `skills/malgn-project-standards` | 개인경로 0건, malgnai-hub 도구명 100% 정합, if-then 조건표 — 신규/재작성 스킬의 정본 템플릿으로 삼을 것 |
| `hooks/session-context.mjs` | §6 "무해 시 0비용" 조건의 정본 예시(rubric 본문이 직접 인용) — 신설 훅 설계 시 이 파일의 try/catch 전면 래핑 + 조건부 no-op 패턴을 표준으로 삼을 것 |
| `hooks/doc-drift.mjs`의 매니페스트 없으면 null 반환 설계 | 동일하게 "무해 시 0비용" 표준 |
| `knowledge/finance/financial-analysis-guide.md`의 "가정 명시 원칙"(가정/산식/출처 3요소) | §4.3 슬롯형 지시의 재무 도메인 적용 모범 — knowledge 재작성 시 표준 문체로 참조 |
| `knowledge/planning/prd-craft-patterns.md`·`business-brief-patterns.md`의 "기초(Knowledge) + 고급기법(Knowledge)" 페어링 컨벤션 | 순환참조 없이 역할 분담이 검증된 유일한 완전 성공 사례 — 다른 도메인(예: proposal, design)의 knowledge 재편 시 이 컨벤션을 따를 것 |
| `skills/reviewer-persona-panel-standard`의 페르소나 6대 필수요소 + 심각도 RAG 분류 | rubric §7.3이 요구하는 절차를 스킬 레벨에서 이미 정확히 선구현 — 오케스트레이션 트랙 재작성 시 evaluator.md 자기검증 절에도 동일 구조 이식 검토 |
| `skills/domain-serverless-edge-api-security`의 "원인→증폭→데이터→영향→재현→권고" 체인 요구 + 파일:라인 인용 원칙 | 이번 skills 배치 중 최고 품질로 평가됨 — 보안 스킬 군집 재편 시 이 문서를 문체 표준으로 삼을 것 |

---

## 5. 3단계(재작성) 착수 우선순위

### 0순위 — 오케스트레이션 트랙 (병렬 착수 불가, 반드시 먼저 범위 확정)
**대상**: `agents/pm.md` + `agents/evaluator.md` + `agents/trainer.md` (+ 이들이 직접 인용하는 skills: `agent-upskill`, `topic-learning`, `training-scorecard-eval`, `screen-verification-and-capture`)

이유: §9.7 조건("핵심 3종 중 2개 이상 실행 불가 지시")이 evaluator.md·trainer.md의 §7.6 결함으로 **이미 발동된 상태**임을 rubric 본문이 직접 선언한다. 이 트랙을 손대지 않고 다른 카테고리부터 착수하면, 오케스트레이터 자신이 깨진 채로 나머지 재작성 결과를 위임·검증하는 모순이 생긴다. architect 참여 하에 트랙 단위로 한 번에 설계해야 하며(§7.2 Refactor 게이트), pm.md의 개인 경로 학습자료 목록(§9.4 fail)부터 정정한 뒤 evaluator/trainer의 §7.6 결함(미번들 스크립트 인용)을 도구 번들 여부 결정(§6 참조)과 함께 처리한다.

### 1순위 — knowledge 카테고리 정리 (retire 7 + merge_candidate 3 먼저 처리)
이유: retire/merge_candidate는 "재작성"이 아니라 "삭제/흡수"이므로 작업량이 가장 적으면서, 나머지 knowledge rewrite 대상(17개)이 참조할 폴더 구조·중복 여부를 먼저 정리해야 rewrite 작업이 두 번 손대지 않는다. 특히 §1.3 이관 절차 미이행 4건(system-design-patterns/visual-design-system/shipley-proposal-process/testing-guide)은 대응 Skill이 이미 완성되어 있어 **Knowledge 쪽을 스텁화하는 것만으로 즉시 종료** 가능한 저비용·고효과 작업이다.

### 2순위 — 전사 공통 패치 배치 (§9.8 항목4, 'COO'→'PM' 치환)
이유: grep 1회로 전량 특정 가능한 국소 패치 성격이나, 영향 범위가 agents 20개 + skills 2개 + knowledge 3개 이상으로 전 카테고리에 퍼져 있어 **한 번의 배치 작업으로 처리하는 것이 가장 효율적**이다(§9.7 국소 패치 vs Sensitive 풀패널 여부는 §6 결정 필요 사항 1번 참조). 0순위 트랙 작업과 내용이 겹치는 pm.md/evaluator.md/trainer.md는 이 배치에서 제외하고 0순위 작업에 흡수한다.

### 3순위 — 보안 스킬 군집 재편 (domain-backend-api-security / backend-security-audit / domain-security-audit-checklist / domain-serverless-edge-api-security 4종 + owasp-security-checklist.md)
이유: merge_candidate(backend-security-audit, owasp-security-checklist)와 명명 규칙 위반(§4.2 접두어 불일치)이 이 군집에 몰려 있고, 개별 파일 단위로는 판정이 서로 얽혀 있어(§6 결정 필요 사항 다수) **군집 전체를 한 번에 재설계**해야 한다.

### 4순위 — 나머지 카테고리별 minor_revise 일괄 처리
- agents 18개: §3.2③(역할 경계 인접 에이전트 명시) 누락분(devops/finance)과 §3.3(tools 필드 명시) 미비분(planner/presenter/researcher/reviewer/ux-designer/visual-designer/writer)을 각각 배치로 묶어 처리.
- skills 24개 + knowledge 16개: §4.2 명명 규칙 위반(접두어 불일치)이 압도적으로 많으므로, 35개 스킬 전체를 grep -rl로 재실측한 뒤 명명 배치를 별도 1회 작업으로 처리(§6 결정 필요 사항 5번 선행 필요).

### 5순위 — screen-verification-and-capture 계열 도구 인프라 결정 이후 재작성
이유: `skills/screen-verification-and-capture`(rewrite) + `knowledge/quality/e2e-testing-guide.md`(rewrite) + `knowledge/review/screenshot-capture-guide.md`(rewrite)가 모두 동일 known-issue(`c3ef5744`)에 묶여 있고, "도구를 번들할지 vs 절차를 다시 쓸지"라는 선행 결정(§6 결정 필요 사항 8번)이 나지 않으면 세 파일을 재작성해도 다시 깨진다. 결정 후 3개 파일을 한 배치로 재작성.

---

## 6. 결정 필요 사항 (open_questions 통합 재구성)

이 절의 잠정 권고는 모두 확정되었다 — 최종 결정은 docs/methodology/decisions-log.md 참조.

각 항목은 원 배치의 open_questions를 통합한 것이며, **잠정 권고안은 감사자 관점의 제안일 뿐 최종 결정이 아니다.** PM/architect/evaluator가 §10.2 절차로 확정할 것.

### D1. 'COO→PM' 치환의 등급 판정 (§7.1 vs §9.7)
**쟁점**: 21개 에이전트(및 skills/knowledge 파생분)의 '호출자: COO' 표기 치환이 §9.7 "국소 패치(Standard)"인지, 아니면 §7.1 고정규칙("역할 경계·위임 모델 절 변경은 등급무관 즉시 Sensitive")에 걸려 파일별 풀패널 검증이 필요한지 rubric 문면이 상충한다.
**잠정 권고**: 순수 호칭 치환(예: "호출자: COO" → "호출자: pm.md")은 Standard 배치 처리, 그러나 devops.md·security.md처럼 치환과 함께 **정책 문장 자체의 재검토**(승인 게이트, 위임 범위)가 필요한 경우는 개별 Sensitive 검증으로 분리한다. 즉 "표기만" vs "정책 포함" 두 트랙으로 나눠 처리.

### D2. §9.7 "카테고리 내 30% 이상 Sensitive" 임계값이 agents 카테고리에서 실제로 초과되었는가
**쟁점**: 20/21개 에이전트에 COO 잔존이 발견됐으나, 이것만으로 "카테고리 전체 재작성" 트리거가 성립하는지는 전량 확정 판정 이후에만 알 수 있다.
**잠정 권고**: COO 잔존 자체는 경미한 표기 결함(D1의 "표기만" 트랙)이므로 이것만으로 카테고리 임계값을 발동시키지 않는다. 임계값 판단은 구조적 결함(§3.1 골격 위반, §7.4/§7.6 경로 실재)만으로 별도 집계할 것.

### D3. pm.md 재작성 범위 — 단독 파일인가, 오케스트레이션 트랙 전체인가
**[확정, 2026-08-07]** 트랙 전체. pm.md 단독 재작성은 evaluator/trainer의 미해결 §7.6 결함(승격 파이프라인 promote-*.mjs 등 미실재 도구 전제)을 방치해 무의미하다 — pm.md 자신도 63행에서 같은 `promote-*.mjs --confirm`을 정본처럼 인용하므로 pm.md 혼자 고쳐도 위임 수신처가 깨진 채로 남는다.

**확정 스코프(rubric §9.7 D3 해소 반영)**: `pm.md` + `evaluator.md` + `trainer.md` + 5개 스킬(`agent-upskill`/`project-retrospective`/`topic-learning`/`reflect-lessons`/`training-scorecard-eval`) = 총 8개 파일(≈1,017줄). 스코프 판정은 인용 여부만으로 한다(그 파일 자체 결함 경중으로 스코프에서 뺀 뒤 별도 "경량 재확인"으로 격하하지 않는다) — `reflect-lessons`(promote-*.mjs 독자 인용)뿐 아니라 `project-retrospective`도 trainer.md가 동일하게 직접 인용하므로 스코프 멤버다(단, 실측 결과 이미 malgnai-hub 각주가 전체에 붙어 있고 promote-*.mjs 인용이 없어 실제 재작성 분량은 8개 중 가장 적을 것으로 예상 — 트랙에서 빼는 것과 "손댈 게 적다"는 것은 다른 판단이다). `screen-verification-and-capture`는 pm/evaluator/trainer 어디에도 인용되지 않아(grep 0건) 이 스코프에서 명시 제외하고 기존 D8/`c3ef5744`(§5) 트랙으로 유지한다.

**착수 순서**: architect가 evaluator/trainer의 "승격 파이프라인"을 배포형 단일 플러그인 모델(전역/로컬 구분 없음)에 맞는 대체 모델(예: git 기반 "reviewer 검증 통과 → PR 반영")로 먼저 대안 설계(§7.2 Refactor 게이트) → trainer가 8개 파일 초안(파일별 분량은 실제 결함에 비례, project-retrospective는 경미) → evaluator/reviewer 풀패널(트랙당 착수 1회+완료 1회, §7.3). 부수 결정: `trainer.md` 모드10(`/trainer-curriculum-gen`, 저장소 전체에 실재하지 않는 스킬)을 이번에 삭제할지 로드맵으로 남기되 59행 빠른참조표에 즉시 각주를 붙일지도 이 착수 단계에서 함께 결정한다.

### D4. reviewer/ux-designer/visual-designer의 tools 미지정 — 기본 세트로 좁힐지 Bash를 명시 추가할지
**쟁점**: 세 에이전트가 `shot` CLI(screen-verification-and-capture)를 실제로 얼마나/어떻게 쓰는지 실사용 패턴 확인이 필요.
**잠정 권고**: D8(screen-verification-and-capture 도구 인프라 결정)과 묶어서 처리. 도구를 번들하기로 하면 Bash 명시 추가, 프로젝트별 절차로 대체하기로 하면 기본 세트로 좁히는 쪽이 자연스럽다.

### D5. common-*/domain-* 명명 규칙(§4.2)의 카운트 방법 — grep -rl 직접 인용 수 vs "자동 트리거 인프라" 예외
**쟁점**: `common-output-storage-and-path-management`·`common-product-principles-reference` 등은 grep 카운트로는 1개뿐이나, Skill은 description 매칭으로 자동 로드되는 설계라 명시적 인용이 적을 수 있다.
**잠정 권고**: "전 에이전트 인프라 규칙"류(다른 모든 에이전트의 행동 방식 자체를 규정하는 스킬)는 별도 예외 버킷으로 인정하고, 도메인 지식형 스킬만 grep 카운트 규칙을 엄격 적용한다. 이 예외 기준을 rubric §4.2에 명문화할 것을 권고.

### D6. 보안 스킬 4종(domain-backend-api-security / backend-security-audit / domain-security-audit-checklist / domain-serverless-edge-api-security) 재편
**쟁점**: rubric이 "상호배제 문구가 이미 있는 실제 선례"로 인용한 두 파일 간 배제 문구가 실측 결과 존재하지 않으며, backend-security-audit의 malgnai 고유 관례(site_id 등)가 회사 표준인지도 불명확.
**잠정 권고**: (1) 먼저 site_id/requireRole 패턴이 회사 표준인지 실제 프로젝트 표본(coaching은 company_id 사용) 재확인 → 표준이면 domain-backend-api-security에 흡수, 아니면 전체 폐기. (2) 4종 모두에 상호 배제 문구를 실제로 추가. (3) domain-security-audit-checklist·domain-serverless-edge-api-security의 참조 에이전트가 security.md 1개뿐이라 무접두어 후보인지, backend-dev.md 참조를 추가해 domain- 접두어를 유지할지는 이 군집 재편 시 함께 결정.

### D7. domain-devops-deployment-patterns의 스택 전제(Docker/K8s/Prometheus)와 Cloudflare Workers 계열 스킬 간 정합
**쟁점**: 같은 플러그인에 상충하는 두 배포 스택 전제가 공존.
**잠정 권고**: 맑은소프트의 실제 배포 표준 스택을 먼저 확인(이 감사만으로는 판정 불가) — devops.md/architect.md 보유자 확인 필요. 표준이 Cloudflare 중심이면 domain-devops-deployment-patterns를 Workers 기준으로 재작성, Docker/K8s가 실제 표준이면 반대로 Cloudflare 벤더 스킬 묶음의 위치를 재검토.

### D8. screen-verification-and-capture 도구 인프라 — 번들할지, 프로젝트별 절차로 재작성할지 (known-issue c3ef5744)
**쟁점**: `~/.claude/tools/`(전역 `shot` CLI, Playwright 인프라)가 이 플러그인에 번들되지 않아 배포 환경에서 실행 불가.
**잠정 권고**: 번들(옵션 a)은 플러그인 크기·유지보수 부담이 크므로, **프로젝트별 Playwright 직접 호출 스크립트로 재작성**(옵션 b)을 권고 — `a4-vertical-layout` 스킬이 이미 `playwright-core` require 방식으로 유사 패턴을 쓰고 있어 선례로 참조 가능. 단, playwright-core 의존성 자체도 package.json 미번들 문제가 있어(§7.4-4) 함께 정리 필요.

### D9. malgnai-discussion-culture — 이 저장소 자신의 내부 문화 문서(retire 후보)인가, 제품 범용 패턴(rewrite 대상)인가
**쟁점**: 본문 자체가 "우선 malgnai 내부 기획부터 정착시킨다"고 서술해 모순적.
**잠정 권고**: 제품 배포판(malgn-agent)에 남기려면 PM 중립적으로 전면 재작성(COO 표현 11회 전량 제거 + 섹션 구조 오케스트레이터 무관하게 재설계)해야 실익이 있다. 그럴 만한 우선순위가 아니라면 이 저장소 자신의 `docs/decision/`류 문서로 이관하고 malgn-agent에서는 제외(retire)하는 편이 비용 대비 합리적 — **retire 쪽에 무게를 둔 잠정 권고**.

### D10. §9.3/§9.1 malgnai-hub 도구명 표 내부 모순
**쟁점**: §9.1과 §9.3이 `work_record`/`decision_record`/`issue_record`를 서로 다른 계열(hub 정본 vs mcp 시그니처 예시)로 취급해 문면이 상충한다.
**잠정 권고**: 이번 세션에서 malgnai-mcp의 실제 deferred tool 목록(`decision_add`/`issue_add`/`activity_log` 등)을 직접 확인한 결과 §9.1(hub 도구명 = decision_record 등)이 정확하고 §9.3의 괄호 예시가 오기로 판단된다. §9.3 예시를 정정할 것을 권고.

### D11. Skill/Knowledge 완전 중복 3건(shipley/software-test-design/visual-design-token-system)의 원본-사본 관계
**쟁점**: SKILL.md와 대응 knowledge/*.md 중 어느 쪽이 원본이고 어느 쪽이 나중에 복제됐는지 grep만으로 특정 불가.
**잠정 권고**: git log로 각 파일의 최초 작성 커밋을 확인해 원본을 특정한 뒤, Skill 쪽을 "절차 정본"으로, Knowledge 쪽을 "배경+출처 스텁"으로 통일(다른 정상 사례들과 일관된 방향). 별도 조사 작업으로 착수할 것을 권고.

### D12. proposal-writing-principles.md 이관 시 신규 Skill 신설 여부
**쟁점**: 현재 writer.md만 참조(무접두어 후보)이나 제안팀 전체(rfp-analyst/capture-strategist/reviewer)가 실제로 필요로 하는지 미확인.
**잠정 권고**: 이관 전 이 3개 에이전트의 실사용 필요성을 확인 — 필요하면 domain- 접두어의 신규 Skill로, writer 전용이면 무접두어 Skill로 신설.

### D13. owasp-security-checklist.md 분산 병합의 구체 분배안
**쟁점**: 단일 Skill 흡수가 아니라 여러 스킬에 걸쳐 분산 병합해야 하는데 rubric에 이 경우의 절차가 명시되어 있지 않음.
**잠정 권고**: 2.2절 제안(A01/A03→domain-backend-api-security, A02/A09→domain-security-audit-checklist, 인프라→domain-devops-deployment-patterns)을 초안으로 architect/evaluator가 최종 확정. A07(Vue XSS)은 어느 곳에도 없으므로 domain-frontend-vue-zero-patterns 또는 domain-backend-api-security 중 한 곳에 신규 추가.

### D14. Agent MD(writer.md 등) vs Knowledge(document-writing-guide.md 등) 내용 중복 시 정본 방향
**쟁점**: rubric §3.2 판정규칙은 "역할 경계 모순"에만 적용되고 "내용 중복"에는 명시 기준이 없음.
**잠정 권고**: §1.1 "Agent는 짧아야 한다" 원칙에 따라 **Agent MD를 축약하고 Knowledge를 정본으로 유지**하는 방향을 기본값으로 권고(단, Agent MD의 해당 절이 §3.1 골격상 필수 섹션(예: '스킬 상세')인 경우 완전 삭제 대신 3~5줄 요약 + Knowledge 참조로 압축).

### D15. 개인화된 프로젝트 표준(pnpm 규칙 등)의 중앙화 여부
**쟁점**: `malgn-project-standards` 스킬 외에 devops.md·frontend-dev.md가 pnpm 규칙을 개별 인라인 서술 중 — 참조로 통일할지, 에이전트별 특유 이슈라 인라인이 맞는지.
**잠정 권고**: 공통 규칙(pnpm 사용 자체)은 malgn-project-standards 참조로 통일하고, 각 에이전트 특유의 이슈(CI 버전 스큐 등)만 인라인 유지 — 완전 이관보다는 "중복 최소화"가 목표.

---

*결정 필요 사항 총 15건(D1~D15). 이 중 D3(오케스트레이션 트랙 범위)·D8(도구 인프라)·D6(보안 스킬 재편)이 3단계 착수 순서에 직접 영향을 주므로 최우선 확정 필요.*
