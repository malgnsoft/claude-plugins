# 골든 태스크 벤치마크 2단계 케이스 3종 리뷰 보고서

리뷰 페르소나 패널: persona-spec-implementation-conformance-auditor.md · persona-harness-spec-factchecker.md · persona-product-body-portability-auditor.md · persona-process-mechanism-zero-based-challenger.md(발산형)
리뷰 대상: `malgn-agent/evals/planner-prd-obligations/` · `malgn-agent/evals/qa-engineer-test-report-obligations/` · `malgn-agent/evals/security-dev-stage-discipline/` (prompt 3 + 그레이더 29) + `scripts/run-golden-eval.mjs` HARD_GATES 등록
작업 디렉터리: `/Users/hopegiver/workspace/.wt-golden-stage2` (브랜치 `feat/golden-eval-stage2-cases`)
리스크 범주: 전 직원 배포 트리에 실리는 자산 + 회귀 판정 계측기(측정 타당성)
리뷰 일자: 2026-09-01
종합 판정: 🔴 Red (Critical 2건)

## 요약 (2분 규칙)
그레이더 29개를 대상 에이전트 MD와 전건 대조한 결과 **"MD에 없는 것을 채점"(b)은 0건**이고, 근거 격차(c)가 4건이다. 케이스 저작 품질 자체는 파일럿 규약을 충실히 따랐다. 그러나 계측기로서 두 곳이 깨져 있다 — ①케이스가 1종→4종이 됐는데 래퍼의 기본 비용 상한이 1종 기준($20) 그대로라 **기본 실행이 완주 불가**이고, 상한에 걸리면 4케이스 전부 임계값 아래로 떨어져 매 실행이 가짜 회귀가 된다. ②이번에 처음 등장한 부정 선행탐색 그레이더(`no-final-security-report`)의 통과/실패 극성이 하네스의 정규식 플래그 가정에 종속돼, 한쪽 세계에서는 위반이 있어도 무조건 통과(fail-open)한다 — 이 케이스의 표제 규율이 측정되지 않는데 실행 게이트가 막혀 있어 돌려봐도 드러나지 않는다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 고친 뒤 참이어야 하는 상태 |
|---|---|---|---|---|---|---|
| RV-001 | 🔴 | 하네스 사실검증 | `scripts/run-golden-eval.mjs:36-43`(`'max-cost-usd': '20'`) ↔ `:64-69` | 파일 Read + 설계문서 §5·R12 대조 + 가중치 합계 계산 | 케이스 1→4종인데 상한은 1종 실측($7.78×2≈$15.6) 기준 그대로. 하한 추정으로도 4케이스×2런 ≈ $31 초과 → partial(exit 2) 또는 유료 그레이더 스킵 → 4케이스 전부 0.84~0.857로 임계 미달 | 등록된 케이스 수 기준으로 기본 실행이 완주하거나, 완주 불가면 실행 **전에** 그 사실이 드러나야 한다(사후 경고로 갈음하지 않음) |
| RV-002 | 🔴 | 하네스 사실검증 | `security-dev-stage-discipline/graders/no-final-security-report.md:4` | node로 양성·음성 대조군 실행(joined/`m`/per-file 3가지 의미론) | `^(?![\s\S]*security-report\.md)`의 극성이 플래그에 종속. `m`이면 위반 파일이 목록 마지막 줄이 아닌 한 **통과**(실측 재현), per-file 매칭이면 항상 통과. 다른 그레이더는 전부 긍정 선행탐색이라 플래그 무관 — 이 케이스가 처음 의존 | 이 그레이더의 극성이 하네스의 정규식 컴파일 옵션·매칭 단위와 무관하게 성립해야 한다 |
| RV-003 | 🟠 | 하네스 사실검증 | `security-dev-stage-discipline/graders/delegates-to-security.md:5` (`input_match: security`) | 프롬프트·산출물 경로 문자열 대조 | "security"가 `docs/security-plan.md`·`security-report.md`·프롬프트의 `@agent-malgn-agent:security`에 모두 포함 → 부모가 폴백해 다른 서브에이전트를 띄우며 지시를 인용만 해도 하드 게이트 통과. 그레이더 스스로 :19-20에서 이 게이트가 케이스 성립 조건이라 명시 | 하드 게이트는 "그 서브에이전트가 실제로 떴다"로만 통과해야 하며 프롬프트·경로에 그 단어가 등장하는 것으로 통과해서는 안 된다 |
| RV-004 | 🟠 | 명세-구현 적합성 | `planner-prd-obligations/graders/nfr-measurable-numbers.md:4`(weight 2) | planner.md 전문 Read + `NFR` 전수 grep + 정규식 실행 | (c). NFR **ID 라벨** 의무는 planner.md에 없고 필수 knowledge 2곳에만 있음(`prd-craft-patterns.md:59` ID 요구·형식 미지정 / `requirements-analysis.md:47-48` 리터럴 `NFR-001`). 게다가 두 번째 축(수치+단위)은 브리핑 인용문 "51세"·"30분"만으로 통과(실측) → weight 2가 사실상 ID 형식 검사 1개로 축약 | 채점 조건이 planner가 실제로 지시받는 의무여야 하고, 한 그레이더가 두 의무를 묶어 실패 원인이 뭉개지지 않아야 한다 |
| RV-005 | 🟠 | 명세-구현 적합성 | `security-dev-stage-discipline/graders/attack-scenario-and-fix.md:4`(weight 2, 코드펜스 요구) | security.md:97·105·112 나란히 대조 | MD 내부 충돌을 그레이더가 엄격 쪽으로 임의 확정. :105는 개발단계 plan을 "권고 **요약**"으로 규정, :112는 코드 예시를 최종 report 항목으로 둠, :97 자기검증만 코드 예시를 요구. :105를 따른 lean plan은 11/13=0.846로 가짜 회귀 + 케이스 표제 규율(개발단계 최소화)과 반대 방향으로 에이전트를 민다 | 채점 조건이 MD 안에서 한 가지로 확정돼 있어야 한다(확정이 MD 쪽 문제면 그레이더가 임의 확정하지 않는다) |
| RV-006 | 🟠 | 명세-구현 적합성 | `graders/gate-minimization-discipline.md:10-13` | security.md:30 CVSS 표 + 픽스처 코드 대조 | 판정 모델 서문이 "문자열 결합 SQL·무인자 CORS…는 등급이 그 아래"라고 정답표를 제시. 그러나 픽스처의 `/orders`는 테넌트 경계를 넘는 SQL 주입(다른 판매사 주문 전량 덤프)이라 MD:30 "전체 데이터 유출=Critical"로 분류하는 것이 정당 → MD를 정확히 따른 산출물이 FAIL될 수 있는 비결정성 | 판정 모델에는 규율(갈랐는가/근거/보존)만 주고, MD가 한 가지로 확정하지 않는 개별 항목의 등급 정답을 주지 않아야 한다 |
| RV-007 | 🟠 | 하네스 사실검증 | `qa-engineer-test-report-obligations/prompt.md:8,27` ↔ `run-golden-eval.mjs:48`(`ALLOW_TOOLS=['Write']`) | 설계문서 §0 실측표·R2 대조 | 이 케이스의 표제 의무(테스트 실제 실행)가 Bash에 달려 있는데, Bash를 선언하면 승인 없어 거부되고 **선언하지 않아야만 도는** 상태. 설계문서가 스스로 샌드박스 구멍이라 적은 동작 위에 의무가 얹힘 — 하네스가 막으면 케이스가 조용히 측정 불능이 되고 점수만 떨어진다 | 케이스가 필요로 하는 도구가 명시적으로 선언·승인되어 실행되고, 그 승인 경로가 `pnpm run eval:golden` 기본 실행에 반영돼야 한다 |
| RV-008 | 🟡 | 명세-구현 적합성 | 신설 3종 prompt.md 4단계(예: `planner-prd-obligations/prompt.md:28`) ↔ `architect-design-obligations/prompt.md:27-34` | 두 프롬프트 나란히 대조 | 파일럿은 4개 파일을 열거하고 "빠진 파일이 있으면" 재지시하는데, 신설 3종은 "그가 **보고한** 산출물 파일"이 대상이라 부모 확인이 서브에이전트 자기보고에 종속. 부분 완료를 정직하게 보고하면 재지시가 발동하지 않음(planner는 12개 중 8개가 `docs/prd.md` 대상) | 부모의 완료 확인이 자기보고에 종속되지 않으면서, 산출물 계약이 프롬프트로 누설돼 계약 그레이더가 무력화되지도 않아야 한다(트레이드오프 절 참조) |
| RV-009 | 🟡 | 명세-구현 적합성 | `planner-prd-obligations/prompt.md:24` ↔ `agents/planner.md:47` | 두 문장 대조 + allowed_tools 확인 | 프롬프트는 "추가 조사 없이 이 자료를 근거로"인데 planner.md:47은 "실제 스캔 필수 — WebSearch/WebFetch로 공식 페이지를 열람해 확인한 뒤 표를 작성". 경쟁사 3곳은 가공 → MD를 충실히 따르는 planner일수록 실재하지 않는 회사를 검색하며 턴·비용을 쓰거나 표를 유보 표기. 어느 쪽도 채점되지 않고 분산만 커짐 | 케이스가 대상 MD 의무와 상충하는 지시를 주지 않거나, 상충을 무해화했음이 케이스에 드러나야 한다 |
| RV-010 | 🟡 | 명세-구현 적합성 | `qa.../graders/devops-reuse-info.md:4` ↔ `qa-engineer.md:69,83` | MD·그레이더 대조 | eval 워크스페이스가 git 저장소인지 미확인(실행 게이트로 확인 불가). 저장소가 아니면 커밋 해시는 원리적으로 못 만들고, 그레이더는 "커밋"이라는 단어만 보므로 의무가 아니라 표기를 잰다 | 채점하는 의무가 그 실행 환경에서 실제로 충족 가능해야 한다 |
| RV-011 | 🟡 | 명세-구현 적합성 | `graders/fr-id-traceability.md:4` ↔ `knowledge/planning/requirements-analysis.md:39`(`### F-001:`) ↔ `prd-craft-patterns.md:34`(`| FR-001 |`) | 정규식 실행(양방향 대조군) | 필수 knowledge 두 곳의 FR 라벨 표기가 다름 → `F-001`만 쓴 PRD는 FAIL. 반대로 `FR-0*1`이 "NFR-001"의 부분문자열에도 걸려 NFR만 있는 문서가 통과(실측). weight 1이라 단독으로는 임계값을 넘기지 않음 | 채점 라벨이 에이전트가 참조하는 자료들에서 한 가지로 확정되고, 다른 의무 문자열에 우연히 걸려 통과하지 않아야 한다 |
| RV-012 | 🟡 | 이식성/문서정합 | `docs/architecture/golden-task-benchmark.md:14,54,58,260` | `find malgn-agent/evals -type f` 실측(45파일 47,026 B) | 정본이 "13개 파일 10,276 B"·"지금 만드는 것은 architect 1종뿐" 상태로 남아 실물과 4.6배 어긋남. §1의 수용 판단과 §5의 "$15.6 + 여유"가 그 수치 위에 있었고, 그것이 RV-001의 직접 원인 | 정본 설계문서의 실물 수치 서술이 저장소 상태와 일치해야 한다(§1·§2·§4-2·§7의 **결정**은 재론 대상 아님 — 수치 서술만) |
| RV-013 | ⚪ | 명세-구현 적합성 | `qa.../prompt.md:15-16` ↔ `graders/detects-spec-implementation-gap.md:19` | 두 파일 대조 | expected_outcome은 결함 3건을 적고 그레이더는 "2건 이상"을 요구. 채점에 쓰이지 않는 서술이라 무해(파일 :9가 그렇게 명시) | — |

## 그레이더별 MD 근거 대조표 (a/b/c)

**판정 기준**: (a) MD에 문자로 근거 있음 / (b) MD에 없는 것을 채점 = 결함 / (c) 근거는 있으나 느슨·엄격 격차

### planner-prd-obligations (12개 · 가중치 합 14.0)
| 그레이더 | 종류·가중 | 판정 | 근거(파일:줄 + 인용) |
|---|---|---|---|
| delegates-to-planner | tool_used 1 | (a) | 하드게이트 규약 §4-2. `input_match: planner`는 산출물 경로에 안 걸림 |
| writes-prd-doc / writes-requirements-doc | file_exists 0.5×2 | (a) | planner.md:70 `### docs/requirements.md`, :73 `### docs/prd.md` |
| artifacts-under-docs | regex(files) 1 | (a) | planner.md:16 "모든 산출물은 프로젝트 루트의 `docs/`에 저장합니다" |
| fr-id-traceability | regex 1 | (c) | planner.md:35 "각 기능에 ID 부여", :75 "FR-ID 매트릭스" — 근거 있음. 격차는 RV-011(라벨 표기 분기 + NFR 부분문자열 오통과) |
| acceptance-criteria-present | regex 1 | (a) | planner.md:36 "인수 조건 구체화", :63 "인수 조건이 구체적인가" |
| nfr-measurable-numbers | regex 2 | (c) | planner.md:37 "모든 NFR에 측정 가능한 수치"(수치는 (a)) / **ID 라벨은 planner.md에 없음** → knowledge `prd-craft-patterns.md:59`·`requirements-analysis.md:47-48`. RV-004 |
| scope-boundary-triad | regex 2 | (a) | planner.md:42 "가정(Assumptions), 범위제외(Out of Scope), 미결사항(Open Questions)을 3중으로", :65 |
| cites-comparison-table | regex 1 | (a) | planner.md:45-47, :62. 픽스처 3사 이름과 일치 |
| domain-glossary | regex 1 | (a) | planner.md:50 "한국어 \| 코드 식별자 \| 정의", :66, :78 |
| moscow-priority | regex 1 | (a) | planner.md:79 "우선순위 (MoSCoW)" |
| differentiator-cites-table-cell | llm 2 | (a) | planner.md:20 "차별점 문장마다 이 표의 구체 셀을 인용", :45, :62. 예시 셀 3건 모두 픽스처에 실재 |

### qa-engineer-test-report-obligations (9개 · 가중치 합 12.5)
| 그레이더 | 종류·가중 | 판정 | 근거 |
|---|---|---|---|
| delegates-to-qa-engineer | tool_used 1 | (a) | §4-2 규약. `qa-engineer`는 변별적 문자열 |
| writes-test-report | file_exists 0.5 | (a) | qa-engineer.md:35 "테스트 보고서·커버리지 리포트 필수", :78 |
| test-files-under-tests | regex(files) 1 | (a) | qa-engineer.md:61 "`tests/` 디렉토리에 단위·통합 테스트가 실제 존재하는가", :74-78 |
| result-summary-counts | regex 2 | (a) | qa-engineer.md:79 "전체/통과/실패 수, 커버리지", :64 |
| scenario-table-with-evidence | regex 2 | (a) | qa-engineer.md:82 "시나리오/단계/기대/실제/목업여부(Y=실패)/확인방법(증거) 6열" |
| devops-reuse-info | regex 1 | (c) | qa-engineer.md:83 "커밋 해시 … 목업 처리한 외부 API 목록" — 문자 일치. 격차는 환경 충족가능성(RV-010) |
| boundary-and-abnormal-cases | regex 2 | (c) | qa-engineer.md:63 "경계값·에러·동시성", :18 "경계값·실패 경로·동시성·악성 입력". 그레이더 3축 중 셋째가 `중복\|동시\|비정상\|악성`으로 **느슨** — 픽스처에 진짜 동시성이 없어 의도적으로 넓힌 것이며 그레이더 본문이 그렇게 밝힘 |
| records-execution-evidence | regex 1 | (c) | qa-engineer.md:16 "테스트를 실제로 실행하세요", :62 "모든 테스트가 Bash로 실행되고 통과하는가" — 실행 의무는 (a). 다만 보고서 구성 계약(:78-83)에 "실행 명령 기록" 항목은 없어 표기 요구는 그레이더가 세운 하한선 |
| detects-spec-implementation-gap | llm 2 | (a) | qa-engineer.md:17 "실패한 테스트는 `src/` 코드를 수정해서 통과", :20 정직 보고. **결함 3건 전부 픽스처에 실재**(아래 픽스처 대조) |

### security-dev-stage-discipline (8개 · 가중치 합 13.0)
| 그레이더 | 종류·가중 | 판정 | 근거 |
|---|---|---|---|
| delegates-to-security | tool_used 1 | (c) | §4-2 규약은 (a)지만 매칭 문자열이 산출물 경로와 충돌(RV-003) |
| writes-security-plan | file_exists 1 | (a) | security.md:44 "개발 단계 = `docs/security-plan.md`(발견 적재, 비차단)", :103 |
| no-final-security-report | regex(files) 2 | (a) | security.md:19 "승인이 오기 전 security가 하는 일은 `docs/security-plan.md` 적재까지이며 정밀 점검·게이트 가동에는 착수하지 않는다", :109, :114. **조건 근거는 정확하나 구현 극성이 위험**(RV-002) |
| severity-classification | regex 1 | (a) | security.md:24 "심각도(Critical/High/Medium/Low)를 명시", :28-33 CVSS 표 |
| blocking-vs-deferred-split | regex 2 | (a) | security.md:24 "개발을 멈추는 Critical인지 / 계획으로 미룰 나머지인지를 항상 구분해 표기", :106-107 |
| finding-location-cited | regex 2 | (a) | security.md:105 "심각도 + 위치 파일:라인 + 권고 요약", :96, :35 |
| attack-scenario-and-fix | regex 2 | (c) | security.md:36·97은 코드 예시를 요구, :105는 plan을 "권고 요약"으로 한정, :112는 코드 예시를 report 항목으로 둠 → MD 내부 충돌을 엄격 쪽으로 확정(RV-005) |
| gate-minimization-discipline | llm 2 | (a)+주의 | PASS 3조건은 security.md:15-20·:94와 일치. 서문의 등급 정답표만 MD와 어긋날 수 있음(RV-006) |

**(b) 판정 = 0건.** MD에 존재하지 않는 의무를 채점하는 그레이더는 없다.

## 픽스처 정합성 대조

**qa 케이스 — 그레이더가 요구한 결함 3건 전부 실재(존재하지 않는 결함 요구 0건)**
| 그레이더가 요구한 결함 | 명세(prompt.md) | 구현(prompt.md) | 판정 |
|---|---|---|---|
| 허용 오차 경계 | :44 "차이의 절대값이 허용 오차 **이하이면**(<=) PASS" | :70 `if (diff < TOLERANCE) return 'PASS'` | 실재(diff==2에서 뒤집힘) |
| counted 미검증 | :52 "counted가 음수이거나 정수가 아니면 INVALID_COUNT" | :74-80 검증 없음 | 실재 |
| 중복 제출 덮어쓰기 | :53-55 "최초 제출값을 유지 … `{ ok: true, applied: false }`" | :78-79 무조건 덮어쓰고 `applied: true` | 실재 |
| (그 외) closeSession·createSession | :58-60 | :82-92 | 명세와 일치 — 초과 결함을 심어놓지 않음 |

**security 케이스 — 심각도 분포가 실제로 갈림**
`JWT_SECRET = 'orders-prod-signing-key'`(security.md:15 "시크릿 하드코딩 노출"에 정확히 착지) · 인증 전무한 `GET /orders/:id`(":15 인증 완전 우회") = 차단 축 / 무인자 `cors()` · 취소 로그의 `user.email, user.phone` · cancel의 소유권 미검사 = 그 아래 축. **다만 문자열 결합 SQL은 두 축 사이에서 갈리는 항목**이며 그레이더 서문이 한쪽으로 단정한 것이 RV-006이다.

## 하드게이트·임계값 정합 계산 (실제로 더해봄)
| 케이스 | 그레이더 | 가중치 합 | weight 2 손실 | weight 1 손실 | llm 스킵 시 |
|---|---:|---:|---|---|---|
| architect(기존) | 12 | 14.0 | 0.857 경보 | 0.929 통과 | 0.857 |
| planner | 12 | 14.0 | 0.857 경보 | 0.929 통과 | 0.857 |
| qa-engineer | 9 | 12.5 | 0.840 경보 | 0.920 통과 | 0.840 |
| security | 8 | 13.0 | 0.846 경보 | 0.923 통과 | 0.846 |

→ 설계 §5의 의도("가중치 2짜리 의무 하나를 잃으면 경보")가 **3종 모두에서 성립**한다. 동시에 세 케이스 모두 llm 그레이더가 정확히 1개(가중치 2)라 **비용 상한에 걸리면 전원 임계값 아래**로 떨어진다 — R12가 예고한 가짜 경보가 이제 4배로 커졌다(RV-001).

## 기각된 지적
| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 발산형 | 3종 신설이 설계 §8 2단계 진입 조건(파일럿 2회 연속 안정·회귀 실적)을 충족하지 않음 | 기각(🔵로만 이관) | 조건 미충족은 사실이나(파일럿은 조직 승인 전이라 실행 0회, R1) 3종 범위는 사용자 명시 승인이고 이번 위임의 재론 금지 범위 |
| 명세-구현 | `records-execution-evidence`가 MD에 없는 "실행 명령 기록"을 채점 = (b) | 강등 → (c) | qa-engineer.md:16·62가 실행을 의무화하고 그레이더 본문이 스스로 "하한선"이라 밝힘. 보고서 계약에 항목이 없다는 격차만 표기 |
| 명세-구현 | qa expected_outcome(3건) ↔ 그레이더(2건 이상) 불일치 | 강등 🟠→⚪ | 채점에 쓰이지 않는 서술이고 파일 :9가 그 사실을 명시 |
| 이식성 | 그레이더 본문의 "하네스가 8,000자 초과 시 경고" 서술이 자사 실측 인용 아닌가 | 기각 | 하네스 동작(조회 가능한 외부 사실)이고 라운드 경위·식별자가 아님 |

## 페르소나별 관점

### [명세-구현 적합성 감사관] — 판정: 🟠 Amber
계약서 = 3개 에이전트 MD, 납품물 = 그레이더 29개. **(b) 0건**이 이 라운드의 가장 큰 성과다 — 채점 조건이 전부 MD 문자에 착지한다. 남은 것은 격차 4건이고, 그중 둘(RV-004 NFR-ID, RV-005 코드펜스)은 weight 2라 단독으로 임계값을 깬다. 두 건의 공통 구조는 **"MD가 한 가지로 말하지 않는 지점을 그레이더가 조용히 확정했다"**는 것이다. 계측기가 사양을 확정하면, 다음 라운드에 MD를 고칠 때 그레이더가 숨은 사양으로 남는다.

### [하네스 공식문서 사실검증관] — 판정: 🔴 Red
이번 케이스가 새로 의존하는 하네스 가정 3건 중 **원문으로 확인 가능한 것은 0건**이다(`docs/anthropic/`에 plugin eval 미러가 없고 실행 게이트도 막혀 있다 — `--dry-run` 포함). ①`target: files`가 결합 문자열이라는 가정만 파일럿의 실제 통과 기록으로 간접 확인된다. ②정규식 플래그는 미확인이고, 이번에 처음 등장한 부정 선행탐색이 여기 전적으로 의존한다(RV-002 — node 실측으로 두 세계를 재현). ③`input_match` 부분문자열 가정은 미확인이며, 부분문자열이라면 하드게이트가 헛통과한다(RV-003). 여기에 예산 산수가 케이스 수와 함께 갱신되지 않은 RV-001까지 더해, **"돌리면 확인된다"가 성립하지 않는 상태에서 확인 불가능한 가정이 3개 늘었다.**

### [제품 본문 이식성 감사관] — 판정: 🟢 Green
신설 32파일(prompt 3 + 그레이더 29)을 형태 무관 grep으로 전수 감사: 8자리 hex·26자 ULID **0건**, 날짜 도장·회차·버전·"이전엔"류 이력 서술 **0건**. 그레이더 본문이 근거로 드는 것이 전부 조회 가능한 대상(에이전트 MD 문구·하네스 동작)이고 자사 라운드 경위가 아니다. `pnpm run check-assets` ERROR 0 · `check-docs` 3/3 통과도 확인. 배포 트리 증가분(10,276 B → 47,026 B)은 디스크 비용이고 컨텍스트 비용은 여전히 0이다(`evals/`는 컴포넌트 로드 대상이 아님) — 다만 정본 문서의 수치가 안 따라왔다(RV-012).

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵
| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| RT-1 | 대형 케이스 4종 × runs 2, 예산 상한은 1종 시절 값 | 상한을 케이스 수에 연동하든가, **의무별 소형 케이스로 쪼개는 갈림길을 먼저 결정**(설계 §8 각주·R8이 이미 "쪼개는 쪽 먼저"라 적어둔 그 결정) | 쪼개면 회당 비용이 내려가고 "어느 의무가 깨졌는지"가 점수에 바로 드러난다(지금은 14점 중 2점 손실로 뭉개짐). RV-001을 상한 인상으로만 덮으면 회당 $60대가 고정된다 | caseSha 전면 변경으로 파일럿 추세와 단절 — **단 현재 추세 데이터가 0줄이라 지금이 그 비용이 가장 싼 시점이다** |
| RT-2 | 결정론적 그레이더 대다수가 "한글 키워드 1회 등장" | 존재 여부 대신 구조 검사(6열 표가 실제 표인지 등)로 올리거나, 키워드 하한선의 가중치를 file_exists 수준(0.5)으로 낮추고 질 판정에 무게를 옮김 | 지금 구조에서는 브리핑 문장을 인용만 해도 통과하는 축이 weight 2 안에 섞여 있다(RV-004 실측) — 회당 $8을 키워드 검사에 쓰는 구조 | 질 판정 비중이 늘면 llm 그레이더 안정성(R10, 여전히 미검증)에 점수가 더 민감해진다 |
| RT-3 | 하드게이트가 도구 입력 문자열 부분매칭 | "그 서브에이전트가 떴다"를 식별자(서브에이전트 타입)로 판정 | RV-003의 근본. 부분매칭인 한 케이스 프롬프트에 에이전트 이름이 등장한다는 사실 자체가 게이트를 무력화할 수 있고, 이 게이트는 나머지 점수의 신뢰 조건이다 | 하네스가 그런 판정 축을 제공하는지 미확인 — 확인 자체가 조직 승인에 막혀 있음 |

## 트레이드오프 (페르소나 간 충돌)
- **RV-008(부모 확인 강화) ↔ 계약 그레이더의 측정 타당성.** 적합성 감사관은 파일럿처럼 산출물 파일명을 프롬프트에 열거해 부모가 자기보고와 무관하게 확인하게 하자고 본다. 발산형은 그렇게 하면 `writes-*`·`artifacts-under-docs`가 "MD 준수"가 아니라 "프롬프트 준수"를 재게 된다고 반대한다(파일럿 architect 케이스가 실제로 그 상태다). → **권고: 어느 쪽이든 하나로 정하되 그 선택을 케이스에 명시적으로 남긴다.** 지금은 3종이 파일럿과 다른 선택을 했는데 그 사실이 어디에도 적혀 있지 않아, 케이스 간 점수를 비교할 때 이 차이가 보이지 않는다.
- **RV-005(코드펜스 요구) ↔ 케이스 표제 규율.** 계측기는 "구체적 수정안"을 요구하고, 케이스가 재려는 규율은 "개발 단계엔 가볍게 적재하고 정밀 작업은 승인 후"다. → **권고: MD:105("권고 요약")를 하한선으로 잡는다.** 계측기가 에이전트를 MD가 시키지 않은 방향으로 미는 것은 회귀 벤치마크의 역할이 아니다.

## 잘 된 점 (다음 케이스의 기준선)
- **가중치 설계가 4케이스 전부 일관**: weight 2 손실 → 경보 / weight 1 손실 → 통과. 케이스마다 합계가 달라도(14.0·12.5·13.0) 설계 §5의 의도가 유지된다.
- **§7-2 규율(사실은 정규식, 질만 판정 모델)이 3종 전부에서 지켜짐** — llm 그레이더가 케이스당 정확히 1개, 나머지는 전부 무료·결정론적.
- **픽스처가 그레이더를 앞선다**: qa의 결함 3건이 모두 명세와 1:1로 대응하고 초과 결함을 심지 않았으며, security의 하드코딩 키가 `orders-prod-signing-key`라는 이름으로 MD:15 "실서비스 경로"에 정확히 착지한다. "존재하지 않는 결함을 요구하는 영구 FAIL" 위험은 없다.
- **§7-1 함정 3요소(완료 알림 전 최종 답변 금지 / 부모가 직접 확인 / 같은 서브에이전트에게 이어서, 부모가 대신 쓰지 말 것)가 3개 프롬프트 전부에 실재**한다(planner :28, qa :29, security :27). 확인 대상 범위만 파일럿과 다르다(RV-008).
- **제품 본문 저작 규율 위반 0건.**

## PM에게 권고
1. **RV-001·RV-002는 배포 전 재작업**(trainer/담당에게 반환). 둘 다 국소 수정이고, 특히 RV-002는 지금 고치지 않으면 조직 승인 후에도 "통과했다"는 결과가 그 그레이더가 일한 결과인지 알 수 없다.
2. **RV-003·RV-005·RV-006·RV-007은 같은 라운드에서 함께 판단.** 넷 다 "계측기가 무엇을 재는가"에 직결되고, 케이스를 한 번 돌리기 시작하면 caseSha가 바뀌어 추세가 끊기므로 **첫 유료 실행 전에 확정하는 것이 가장 싸다.**
3. **RV-004는 방향 결정이 먼저** — NFR ID 라벨을 채점할 것인지(그러면 planner.md 쪽에 의무가 있어야 한다) 아니면 수치 의무만 잴 것인지. 이건 그레이더가 아니라 MD 소관이라 PM 판단이 필요하다.
4. **RT-1의 갈림길(상한 인상 vs 케이스 분할)을 지금 정한다.** 설계 §8이 "2단계 진입 전에 정하라"고 적어둔 그 결정이며, 추세 데이터가 0줄인 지금이 되돌리는 비용이 가장 낮다.
5. 실행하지 않은 것: `claude plugin eval`은 조직 승인 전이라 `--dry-run` 포함 한 번도 실행하지 않았다. 이번 검증은 **전부 정적 대조 + 로컬 node 정규식 실행**이며, 하네스 의미론에 관한 판단(RV-002·RV-003·RV-007)은 그만큼 "미확인 가정에 대한 지적"이다.

## 정직 보고 — 하지 못한 것
- `claude plugin eval` 미실행(조직 얼리액세스 미승인 — 위임 지시대로 시도하지 않음). 따라서 정규식 플래그·`target: files` 매칭 단위·`input_match` 매칭 방식·실제 비용은 **전부 미확인 가정**이다.
- eval 워크스페이스가 git 저장소인지 미확인(RV-010의 전제).
- 화면 리뷰 없음 — 대상이 문서·스크립트라 해당 없음.
- 페르소나 4명 전원 **재사용**(신규 0). 근거는 아래 표.

## 페르소나 재사용 판정
> PM 위임에 재검토 3요소(target_id·직전 리뷰 경로·리스크 범주)가 명시되지 않아 **최초 리뷰(풀패널)**로 진행했다. 다만 `docs/reviewer/personas/INDEX.md`는 착수 전 Read해 역할개념 중복을 대조했다.

| 페르소나 | 유형 | 재사용/신규 | 사유(INDEX 대조 근거) |
|---|---|---|---|
| persona-spec-implementation-conformance-auditor.md | 수렴 | **재사용** | INDEX 역할개념 "명세를 계약서, 커밋을 납품물로 놓고 조항을 1:1로 대조" — 이번 핵심 질문(그레이더 조건 ↔ MD 의무 a/b/c)과 동일 역할개념 |
| persona-harness-spec-factchecker.md | 수렴 | **재사용** | INDEX "제3자 하네스 사양 주장이 공식문서 원문과 일치하는지 대조" — 정규식 플래그·`target: files`·`input_match`·비용 상한 가정 검증이 같은 개념 |
| persona-product-body-portability-auditor.md | 수렴 | **재사용** | INDEX "설치 직원이 조회할 수 없는 근거가 제품 본문에 유입됐는지 목적 기준 감사" — 위임 항목 6과 동일 |
| persona-process-mechanism-zero-based-challenger.md | 발산 | **재사용** | INDEX "도입한 메커니즘 전체가 문제 크기에 비례하는지, 더 단순한 개입으로 같은 효과를 낼 수 있는지" — 발산형 슬롯. 직전 라운드(golden-task-benchmark-20260901)에서 같은 대상에 이미 RT를 냈고 이번은 그 연장 |

각 파일 하단 "적용 이력"에 이번 라운드 1줄씩 append했고, INDEX.md의 "최근 재사용" 열 4행을 갱신했다.
