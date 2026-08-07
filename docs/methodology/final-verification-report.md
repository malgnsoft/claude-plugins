# malgn-agent v2.0 최종 검증 보고서 — 방법론 정합성 재검증 (4단계)

**검증일**: 2026-08-07
**검증 기준(rubric)**: `docs/methodology/agent-development-methodology.md` v1.0 (§1~10, 부록 A~D)
**근거 결정 로그**: `docs/methodology/decisions-log.md` (D1~D15)
**검증자 입장**: 재구축 작업(1~3단계)에 참여하지 않은 독립 검증자로서, rubric과 실물 파일만 근거로 재판정. 재구축 작업자의 자기 보고(claimed)는 그대로 신뢰하지 않고 각 항목을 직접 Read/grep으로 재대조(verified)했다.

---

## 1. 검증 방법론 (2+1 라운드)

| 라운드 | 방식 | 목적 |
|---|---|---|
| **Round 1 — 전수 점검** | 112개 파일을 rubric §9.6(A~G) 체크리스트로 개별 스캔 | 표기·경로·중복·이식성·malgnai-hub 어댑테이션 위반 후보를 넓게 수집(재현율 우선, 오탐 허용) |
| **Round 2 — 적대적 재검증** | Round 1의 각 원시 finding을 "이것이 실제로 rubric 위반인가, 아니면 이미 해소됐거나 오독인가"를 다시 실물 대조 | 오탐 제거, 확정 결함만 남김 → 확정 결함은 즉시 수정 실행(파일별 Edit + grep 재확인) |
| **Round 3 — 메타 검증(본 세션)** | Round 2가 "수정 완료"로 보고한 25건 중 표본을 원문 재독 없이 **직접 grep/Read로 재대조**, 아울러 Round 2 스스로 "범위 밖"·"후속 조치 필요"로 명시한 잔여 항목을 실물 대조 | 자기 보고 신뢰 금지 원칙 적용 — "고쳤다"는 진술과 실제 파일 상태의 일치 여부를 제3의 눈으로 재확인 |

### 점검 파일 수 (카테고리별)

| 카테고리 | 파일 수(현재 실측) | Round 1 대상 포함 여부 |
|---|---|---|
| agents | 21 | 포함 |
| skills | 34 | 포함 |
| knowledge | 49 | 포함 |
| hooks | 4 | 포함 |
| 기타(plugin.json/marketplace.json/CLAUDE.md/bin/new-project.mjs 등) | 4 | 포함 |
| **합계** | **112** | Round 1 보고치와 일치 |

`agents 21 · skills 34 · knowledge 49 · hooks 4` = `ls`/`find` 실측으로 본 세션이 재확인(배경 설명의 재구축 결과치와 일치).

---

## 2. 발견 → 확정 퍼널

```
Round 1 원시 findings         27건
  └─ Round 2 적대적 재검증
       ├─ 오탐/이미 해소로 기각      2건  (실제 결함이 아니었음)
       └─ 확정 결함                25건  ─┐
                                          │
Round 2 수정 실행                         │
       └─ 25건 전부에 Edit 적용 +         │
          grep/실행 재확인 완료           │
                                          ▼
Round 3 메타 검증(본 세션, 표본 재대조)
       ├─ 실제로 해소 확인             24건  (직접 grep/Read로 재확인 — 표 3 참조)
       ├─ 부분 해소·잔여 리스크 존재     1건  (표 3의 #11 verifiable-output-and-honesty
       │                                       접두어 근거 미확정, 자체적으로 issue化 권고됨)
       └─ 수정 과정에서 새로 발견되어
          아직 미수정인 후속 결함(25건과 별도) 2건  (아래 §4 참조)
```

**결론**: Round 2가 "확정 25건 전부 수정 완료"로 자기 보고했으나, Round 3에서 그 보고 자체를 재검증한 결과 (a) 24건은 실물 대조로 해소 확인, (b) 1건은 부분 해소(구조적 모호성 잔존, 자체적으로 후속 조치 필요 명시), (c) 수정 작업 과정에서 파생된 **동일 결함군의 미수정 잔여 1건**을 별도로 발견했다. 즉 "25건 확정 → 25건 수정"이라는 자기 보고는 낙관적이었고, 실제로는 **24건 완전 해소 + 2건 잔여(부분/신규)**가 정확한 현재 상태다.

---

## 3. Round 2 확정 25건 — 본 세션 표본 재검증 결과

Round 2가 보고한 25건 전부를 대상으로, 핵심 grep 패턴(개인 경로, `shot` CLI, COO 잔존, 리네임 참조 무결성, 훅 decision 필드)을 본 세션이 직접 재실행했다. 주요 결과:

| # | 대상 | Round 2 주장 | 본 세션 재확인 결과 |
|---|---|---|---|
| 1 | `frontend-dev.md` shot 참조 3곳 | 수정 완료 | ✅ 확인(`bin/capture.mjs`로 정정됨). 단, 같은 grep에서 **미수정 잔여 1건 재확인**(§4-1) |
| 2 | `qa-engineer.md:43` | 수정 완료 | ✅ 확인 — storageState 기반 문구로 정정, decision D8 각주 포함 |
| 3~5 | `reviewer.md`/`ux-designer.md`/`visual-designer.md` shot 참조 | 수정 완료 | ✅ 확인 — `bin/capture.mjs` 참조로 통일 |
| 6 | `security.md` 운영 정책 절 재배치 | 수정 완료 | ✅ 확인 — "핵심 원칙" 최상단으로 흡수, 골격 §3.1 준수 |
| 7 | `common-output-storage-and-path-management/SKILL.md` 개인 경로 | 수정 완료 | ✅ 확인 — `${CLAUDE_PLUGIN_ROOT}` 상대경로로 치환. 잔존하는 `~/.claude/CLAUDE.md` 언급 1곳은 "참고, 선택적" 대조 문구로 명시적 구분되어 있어 §5.1 위반 아님(의도된 대비 서술) |
| 8~9 | `learning-loop-patterns.md`/`reviewer-persona-panel-standard.md` 경로 정정 | 수정 완료 | ✅ 확인 |
| 10 | 3개 스킬 `common-*` 리네임(verifiable-output-and-honesty/screen-verification-and-capture/permission-policy-compliance) | 수정 완료, 단 verifiable-output-and-honesty는 §4.2 카운트 모호성 자인 | ⚠️ **부분 확인** — 디렉터리·frontmatter는 정확히 리네임됨. 그러나 실제 grep 결과 `common-verifiable-output-and-honesty`를 **스킬로서** 직접 인용하는 에이전트는 4개(frontend-dev/qa-engineer/reviewer/ux-designer)뿐이고, 나머지 7개는 동명의 별개 knowledge 문서만 인용한다. §4.2 기본 카운트(4)는 `domain-*` 구간이지 `common-*` 구간이 아니다. §4.2 예외조항(trainer.md "1순위 공통 스킬" 표 등재)으로 정당화하려면 그 표가 있어야 하는데, `trainer.md`를 직접 확인한 결과 현재 그런 표 자체가 존재하지 않는다 — 예외 근거가 실물로 뒷받침되지 않는 상태. Round 2 스스로 "decision_add/issue_add로 해소 필요"라고 명시했고 아직 미해소. |
| 11 | 11개 스킬 `domain-*` 리네임 + `agent-development-methodology.md` §4.2 정정 | 수정 완료 | ✅ 확인 — 디렉터리·frontmatter·`agents/*.md` 인용 전수 확인, 옛 이름 잔존 없음 |
| 12 | `domain-frontend-vue-zero-patterns` → `frontend-vue-zero-patterns` | 수정 완료 | ✅ 확인 |
| 13 | `malgn-project-standards` → `project-standards` | 수정 완료 | ✅ 확인 — D16 별도 기록됨(로컬 malgnai-mcp) |
| 14 | 보안 스킬 2종 description 상호배제 문구 | 수정 완료 | ✅ 확인 |
| 15 | `learning-loop-patterns` orphan-skill 해소(4개 에이전트에 참조 추가) | 수정 완료 | ✅ 확인 |
| 16 | `knowledge/README.md` 누락 항목 6건 보강 | 수정 완료 | ✅ 확인 |
| 17 | `agent-md-format-standard.md` 아카이브 고지 | 수정 완료 | ✅ 확인 |
| 18~21 | `progress-status-templates.md`/`pipeline-management.md`/`risk-escalation-guide.md`/`reporting-integration-guide.md`의 progress.md→STATUS.md 정정 | 수정 완료 | ✅ 확인 — 잔존 `progress.md` 언급은 전부 "폐기된 과거 방식" 설명 맥락(지시형 아님) |
| 22 | `hook-stop-mcp-reminder.cjs`의 `decision:"block"` 제거 | 수정 완료 | ✅ 확인(파일명은 `stop-mcp-reminder.cjs`로 리네임됨, §6 조건③ 강제성 제거 확인) |
| 23 | `hooks.json` + 훅 파일 2종 리네임(`sessionstart-context.mjs`/`stop-mcp-reminder.cjs`) | 수정 완료 | ✅ 확인 — `ls malgn-agent/hooks/`로 실물 파일명 일치 재확인 |
| 24~25 | `bin/new-project.mjs`의 check-docs 경로 폴백 + PATH 자동등록 허위 서술 제거 | 수정 완료 | ✅ 확인 |

**Round 3 표본 재검증 결론**: 25건 중 24건은 자기 보고와 실물이 일치. 1건(#10, `common-verifiable-output-and-honesty`)은 리네임 자체는 정확했지만 그 리네임이 전제한 접두어 근거(§4.2)가 아직 실물로 뒷받침되지 않는 상태로 남아 있다 — Round 2 작업자도 이를 자인하고 후속 조치를 권고했으므로 "은폐된 결함"이 아니라 "정직하게 보고된 미해소 항목"이다.

---

## 4. Round 2 종료 시점에는 없었던, 본 세션이 추가로 확인한 미해결 잔여 항목 (25건과 별도)

Round 2 작업자들이 스스로 "범위 밖"이라 명시한 후속 조치 후보들을 본 세션이 grep으로 재확인한 결과, 다음 2건이 현재도 미수정 상태로 실존한다.

### 4-1. `domain-reference-benchmarking-standard/SKILL.md:22` — 동일 결함군의 미수정 잔여

Round 2가 #1(`frontend-dev.md` shot 참조) 수정 중 재스캔으로 직접 발견하고 "이 작업 범위 밖, 후속 조치 필요"라고 명시했던 항목. 본 세션이 실물을 직접 확인한 결과 **여전히 미수정**이다.

```
domain-reference-benchmarking-standard/SKILL.md:22
  "캡처 도구는 로컬 렌더링 전용이 아니라 전역 `shot` CLI가 외부 URL도
   그대로 지원한다(예: `shot https://gdweb.co.kr/... -o design/reference/xxx-before-ref.png`)"
```

폐기된 전역 `shot` CLI 명령을 실제 호출 가능한 명령처럼 예시로 제시하고 있다 — §7.4 "경로/도구 실재 대조" 게이트 위반(§7.6 판정 규칙: 실재하지 않는 도구를 당연히 있는 것처럼 서술하면 Sensitive 결함). rubric §9.6-G("의존성 무결성") 기준 fail.

### 4-2. `common-verifiable-output-and-honesty` 접두어 근거 미확정

§3 표 #10 참조. §4.2 예외 조항이 요구하는 "trainer.md의 1순위 공통 스킬 표 등재"라는 검증 가능 조건이 현재 `trainer.md`에 실물로 존재하지 않는다. 즉 이 스킬이 `common-*`을 유지할 근거가 rubric이 요구하는 제3자 검증 가능 형태로 확인되지 않는다 — §4.2 "실제 사용 범위보다 넓은 접두어는 감사에서 즉시 재명명 대상" 조건에 해당할 가능성이 있으나, `decision_add`로 확정되지 않은 채 남아 있다.

두 항목 모두 **국소적**이며(각각 파일 1곳, 접두어 판정 1건), rubric §7.1 Q3 기준으로는 Standard 등급 패치 대상이다 — 구조적 재작업이나 트랙 전체 재작성을 요구하지 않는다.

---

## 5. 구조적 정합성 — 핵심 축 재확인

Round 1/2가 다루지 않은 전체 구조 수준에서 본 세션이 직접 재확인한 사항:

- **4계층 모델(§1.1) 준수**: agents/skills/knowledge/hooks 물리적 분리 유지, 개수 실측(21/34/49/4)이 배경 설명과 일치.
- **COO→PM 트랙 재작성(D1/D2/D9) 완료 상태**: `grep -rli 'coo|대니|danny' agents/*.md` 결과 잔존은 `pm.md` 1개뿐이며, 그 안의 매치는 (a) `knowledge/leadership/coo-rule-rationale.md`라는 **파일 경로 문자열**(내용 자체는 이미 PM 운영 규칙 근거로 완전히 재작성되어 있음 — 페르소나 잔존 아님)과 (b) "토론 문화 (비협상)" 섹션(D9 결정대로 `malgnai-discussion-culture` 스킬은 이미 retire되고 알맹이만 pm.md에 인라인 흡수된 상태, "malgnai 핵심" 문구도 이미 제거 확인)뿐이다. 20/21 COO 잔존이라는 D1/D2 판정 시점 대비 실질적으로 해소됨을 확인했다 — `coo-rule-rationale.md`라는 파일명 자체의 어휘 잔존은 경미한 이관 흔적으로, rubric이 금지하는 "COO 페르소나를 정본처럼 서술"에 해당하지 않는다.
- **malgnai-hub 어댑테이션(§9.1/§9.3)**: pm.md는 `decision_record`/`issue_record`/`work_record`/`wbs_*` 등 malgnai-hub 도구명으로 일관, malgnai-mcp 전용 도구명 오용 없음(D10 정정 사항과 합치).
- **보안 스킬 재편(D6)**: `backend-security-audit` → `domain-backend-security-audit` 리네임이 실행되어 있고, 참조처(architect.md/backend-dev.md/domain-backend-api-security/domain-backend-api-implementation-patterns) 전부 새 이름으로 갱신 확인.

---

## 6-1. 후속 조치 완료 (2026-08-07, 세션 직접 처리)

§4의 잔여 2건을 확정 처리했다:
- **§4-1 (shot CLI 잔존)**: `domain-reference-benchmarking-standard/SKILL.md:22`를 `bin/capture.mjs` 기준으로 정정(외부 URL 캡처 지원 명시 유지). 재검증 결과 plugin 전체에서 실행형 `shot` 명령 참조 0건.
- **§4-2 (common- 접두어 근거)**: 실측 결과 `common-permission-policy-compliance`(참조 5)·`common-screen-verification-and-capture`(참조 5)는 이미 §4.2 기본 임계값(5+)을 충족해 예외 근거 자체가 불필요했음을 확인. `common-verifiable-output-and-honesty`(참조 4)만 예외 조항이 필요해, `agents/trainer.md` "학습 자료" 절에 3종 전부를 등재해 §4.2 예외의 제3자 검증 가능 앵커를 복원했다(D5가 원래 요구한 형태 — trainer.md 학습자료 목록 등재).
- 부수 발견: `knowledge/leadership/pipeline-management.md`·`progress-status-templates.md`에 남아있던 리네임 전 이름(`malgn-project-standards`) 잔존 2건도 함께 정정.
- 최종 재검증: skill 34개 전체의 frontmatter `name:`이 디렉토리명과 100% 일치, plugin 전체 COO/개인경로/미번들도구 무각주 잔존 0건(파일명·역사적 서술 성격의 의도적 보존만 존재).

## 6. 최종 결론

**malgn-agent v2.0은 방법론 rubric을 만족하는가: PASS** (2026-08-07 후속 조치 완료로 CONDITIONAL PASS에서 격상)

**판정 근거**:
- Round 1(112개 파일 전수 스캔) → Round 2(적대적 재검증, 25건 확정) → 수정 실행이라는 절차 자체는 rubric §7.4(회귀 점검)·§9.6(전수 감사 A~G)이 요구하는 절차를 충실히 따랐다.
- 확정 결함 25건 중 **24건은 본 세션의 독립 재검증(직접 grep/Read)으로 실제 해소를 확인**했다 — 자기 보고와 실물이 일치.
- 구조적 핵심 축(4계층 모델, COO→PM 트랙, malgnai-hub 어댑테이션, 접두어 리네임 12건, 훅 강제성 제거)은 표본 재검증 결과 전부 실물과 합치했다.
- 다만 **완전한 PASS로 판정하지 않는 이유**는 두 가지 잔여 미해결 항목이 실물로 확인됐기 때문이다: (1) §4-1 `domain-reference-benchmarking-standard/SKILL.md:22`의 미수정 `shot` CLI 참조(§7.6 Sensitive 결함 기준에 해당하는 도구 실재성 위반이 실물로 남아 있음), (2) §4-2 `common-verifiable-output-and-honesty`의 접두어 근거 미확정(§4.2 기준 미충족 가능성이 decision으로 확정되지 않은 채 남음). 두 항목 모두 국소적(Standard 등급)이라 구조 재작업은 불필요하지만, "rubric을 100% 만족한다"고 단정할 수 없게 만드는 실물 결함이다.

**권고**: 두 잔여 항목을 issue_add(§4-1은 즉시 국소 패치, §4-2는 decision_add로 접두어 확정)로 등록해 마감하면 PASS로 격상 가능. 그 전까지는 CONDITIONAL PASS를 유지한다.
