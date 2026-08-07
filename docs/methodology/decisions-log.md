# malgn-agent 전수 감사 — 결정 로그 (D1~D15)

**이 문서는 감사보고서(`docs/methodology/audit-report.md`) §6의 최종 확정판이다. 3단계 재작성 착수 시 §6의 잠정권고가 아니라 이 문서를 따른다.**

- 확정일: 2026-08-07
- 대상 rubric: `docs/methodology/agent-development-methodology.md`
- 근거 감사: `docs/methodology/audit-report.md` §6 (D1~D15)
- 총 15건 중 14건은 세션이 rubric·실물 파일(agents/skills/knowledge)을 직접 Read/grep으로 재검증한 뒤 감사자의 잠정 권고를 채택/기각/절충했다. D7은 `malgn-agent/skills/`에 감사가 지목한 Cloudflare 계열 스킬(agents-sdk/durable-objects/wrangler 등)이 실제로 존재하지 않음을 직접 확인해 "스택 충돌 없음 — 감사 오류"로 별도 해소했다.

---

## D1. 'COO→PM' 치환의 등급 판정

**결정**: 파일 경로(위치) 기준의 밝은 선(bright-line) 규칙으로 판정한다 — 21개 에이전트 중 'COO' 표기가 '## 역할 경계' 절 내부(호출/경계/에스컬레이션 필드)에 있으면 그 절 변경은 §7.1 고정규칙에 따라 항상 Sensitive이며, §9.7의 '국소 패치(Standard)' 판정은 적용되지 않는다. 감사자의 잠정 권고(단순 호칭 치환은 Standard, devops.md/security.md처럼 정책 문장이 바뀌는 경우만 개별 Sensitive)는 기각한다.

**근거**: §7.1 '[등급 무관 고정 규칙]'은 원문에 '위 표의 결과와 무관하게 즉시 Sensitive로 고정'하고 'Standard로 잘못 낮게 판정될 여지 자체를 없앤다'고 설계 의도를 명시한다. §9.7의 '적용 단위' 표(§7.3)는 이 트리거 케이스(역할경계/위임모델 절 변경)를 위한 행 자체가 없는 rubric 누락이었다(D10과 같은 성격의 결함) — §7.3 표에 해당 행을 신설했다. 실제 파일(agents/*.md 20개 전체)을 Read로 전수 확인한 결과, 감사자가 전제한 'devops.md·security.md만 정책이 얽혀 있다'는 전제는 사실과 다르다 — 최소 7개 이상(reviewer/evaluator/trainer/researcher/marketer/frontend-dev 등)이 역할경계 절 안에서 COO에 승인·실행·에스컬레이션 권한을 명시 부여하고 있었다. '문구의 무게'로 매번 판단하는 기준은 §4.3(모호성 제거) 위반이자 §7.1 고정규칙이 막으려던 '과소판정 재량'을 다시 열어준다.

**적용 단위**: 배치 1회가 아니라 파일당 1회 풀패널(단, 전 파일 동일 체크리스트 재사용으로 세션당 소요 최소화). §7.1 [D1 결정] 체크리스트: ①승인/실행/에스컬레이션 권한 서술이 pm.md 실제 권한 범위와 일치하는지 ②호출 시점·조건 서술이 pm.md 기준으로 유효한지.

**실행항목**:
- agents 카테고리 20/21 파일의 '## 역할 경계' 절 COO→PM 치환을 파일당 1회 reviewer 풀패널로 재작업(위 체크리스트 공통 재사용).
- D2(§9.7 30% 카테고리 임계값)는 D1에 의해 '실제 초과(20/21≈95%)'로 연쇄 확정 → agents 카테고리를 §9.7 '트랙 전체 재작성(Refactor·카테고리 단위)'으로 승격, architect 대안설계(대조 기준표 수립 한정) + reviewer 풀패널 2회(착수/완료) 적용. 범위는 '호출자 명칭 정정 + 위임모델 합치 대조'로 한정(전면 재설계 아님).
- §7.3 '역할 경계·위임 모델 절 내부 치환' 행 신설 및 §7.1·§9.7 상호 참조가 병행 편집과 충돌 없이 안착했는지 통독 검수.
- malgnai-mcp `decision_add`(importance 4~5)로 기록.

**rubric 개정**: 반영 완료 — §7.1 '[D1 정정]' 문단(고정 규칙이 §9.7 국소패치보다 항상 우선, 판정 기준은 위치이지 문구 무게가 아님을 명문화), §7.3 '적용 단위' 표에 '역할 경계·위임 모델 절 내부 치환' 행 신설 + 근거 문단 추가.

---

## D2. §9.7 "카테고리 내 30% 이상 Sensitive" 임계값의 agents 카테고리 실제 초과 여부

**결정**: 실제로 초과되었다 — 감사자의 잠정 권고('표기 결함만으로는 미발동')를 기각한다. agents 카테고리는 §9.7 '트랙 전체 재작성(Refactor·카테고리 단위)' 대상으로 확정한다. 단, 범위는 '전면 재설계'가 아니라 '호출자 명칭 정정 + 승인권한/소관 서술이 실제 pm.md 위임모델과 합치하는지 파일별 1회 대조'로 한정(architect 대안설계는 이 대조 기준표 수립에 한정).

**근거**: `grep -rli 'COO|대니|Danny' malgn-agent/agents/*.md` → 21개 전원 검출, pm.md 자신은 '호출자: 사용자'로 정상이므로 실질 잔존은 20/21(≈95%) — 감사보고서 인용 수치와 일치. COO 언급 위치가 대부분 '## 역할 경계' 섹션 내부의 '호출(자)'·'경계'·'에스컬레이션' 필드 안임을 실측 확인(capture-strategist/finance/planner/presenter/ux-designer/writer 등 포함). §7.1 '[등급 무관 고정 규칙]'(위치 기준 Sensitive)과 §9.7 표 행1 '국소 패치'(같은 대상에 Standard)가 동일 대상에 상충 판정을 내리는 실제 rubric 상충을 발견해 §7.1에 우선순위 해소 규칙을 Edit로 추가했다(D1 세션과 독립적으로 동일 결론에 수렴, 중복 없이 하나로 정리). 이 규칙을 적용하면 20/21(≈95%)이 30%(7/21) 임계값을 크게 초과한다. 다만 트리거 발동이 곧 전면 재설계를 뜻하지 않는다 — 절대다수는 순수 호칭 치환이고, 소수(evaluator/trainer/reviewer/backend-dev/frontend-dev/devops/security/qa-engineer/localizer/marketer/researcher/architect/rfp-analyst)만 승인권한·소관·통제권 서술이 얽혀 개별 합치 확인이 필요하다.

**실행항목**:
- evaluator에게 agents 21개 전 파일 rubric A~G 정식 채점 위임 → 카테고리별 fail 비율을 malgnai-hub `decision_add`(importance 4~5)로 공식 등록.
- architect 참여로 'COO→pm.md 치환 시 위임모델 합치 대조 기준표' 초안 작성 → 20개 파일 일괄 적용.
- trainer가 기준표로 20개 파일 배치 치환(순수 치환은 배치 1회) 후, 승인권한 서술이 있는 파일(위 13개)은 개별 Sensitive 검증(reviewer 풀패널)으로 별도 처리.
- reviewer 풀패널 2회(§7.3: 트랙 착수 1회 + 완료 1회) 및 재작성 전 결함목록 대비 해소 여부 재대조(§7.4).
- D1/D2 결론이 §7.1 문단에 중복 없이 정리됐는지 최종 diff 재확인.

**rubric 개정**: 반영 완료 — §7.1 '[D1 정정]'·'[D2 정정]' 두 하위 불릿 및 §9.7 하단 '[D2 해소]' 교차참조 문단(§7.1을 정본으로 지정, 중복 서술 회피).

---

## D3. pm.md 재작성 범위 — 단독 파일 vs 오케스트레이션 트랙 전체

**결정**: 오케스트레이션 트랙 전체를 재작성한다. 스코프는 감사자의 잠정권고(4개 스킬)도, 1차 반박안(4개 스킬+reflect-lessons, project-retrospective 분리)도 아니다. 최종 확정 스코프는 `pm.md`·`evaluator.md`·`trainer.md` + 이 3개가 직접 인용하는 5개 스킬(`agent-upskill`·`project-retrospective`·`topic-learning`·`reflect-lessons`·`training-scorecard-eval`) = 총 8개 파일(약 1,017줄). `screen-verification-and-capture`는 인용 0건으로 명시 제외해 기존 D8/`c3ef5744` 트랙으로 유지한다.

**근거**: `agents/{pm,evaluator,trainer}.md` 전문 Read + grep으로 직접 검증. evaluator.md는 학습자료 3건 전부·승격 실행 절 전체가 `promote-agent.mjs`/`promote-skill.mjs`/`promote-knowledge.mjs`/`bin/record-eval.mjs`/`bin/design-review.mjs`/`bin/promote-check.mjs` 등 미실재 도구를 전제하고(find 0건), pm.md도 63행에서 evaluator에게 같은 도구로 위임한다 — pm.md 단독 재작성은 위임 수신처가 깨진 채 남아 무의미하다. §9.7의 스코프 정의(직접 인용 경로) 자체는 정확했으나 예시 목록이 불완전했다 — grep 재확인 결과 `project-retrospective`(모드3)·`topic-learning`(모드4)도 정확히 동일 인용 패턴으로 직접 인용됨을 확인, 이를 §9.7에 확정 목록으로 명문화했다. 스코프 판정(인용 여부)과 결함 심각도 판정(재작성 분량)을 같은 판단으로 섞으면 안 된다는 원칙도 §9.7에 신설했다(2차 반박안이 이 둘을 섞어 project-retrospective를 스코프에서 격하시킨 내적 비일관을 발견). `screen-verification-and-capture` 제외는 grep 0건으로 재확인, STATUS.md `c3ef5744`·감사보고서 §5와도 이미 분리 관리 중.

**실행항목**:
- STATUS.md 이슈 `929edddc`의 범위 서술을 8개 파일로 갱신, `decision_add`(importance 5)로 근거 기록.
- architect에게 '승격 파이프라인을 배포형 단일 플러그인 모델에 맞게 대체할 대안 설계'를 §7.2 Refactor 게이트로 선행 위임(git 기반 PR 모델 등 검토).
- trainer 초안 작성 시 project-retrospective는 경미한 검증만 배정(이미 malgnai-hub 각주 완비, promote-*.mjs 미인용), evaluator.md/trainer.md/reflect-lessons에 재작성 리소스 집중.
- trainer.md 모드10(`/trainer-curriculum-gen`, 존재하지 않는 스킬) 처리방향(삭제 vs 로드맵 각주)을 architect 대안설계 단계에서 결정.
- reviewer 풀패널 트랙당 착수 1회+완료 1회(§7.3), `screen-verification-and-capture`는 D8/`c3ef5744` 트랙으로 별도 유지.

**rubric 개정**: 반영 완료 — §9.7 '핵심 3종 조건의 범위' 문단에서 불완전한 예시 나열 제거, '[D3 해소, 2026-08-07]' 문단 신설(인용 여부만으로 스코프 확정, 확정 목록 5개 스킬 명문화 + 재확인용 grep 커맨드 명시). audit-report.md D3 항목도 '[확정, 2026-08-07]'로 갱신.

---

## D4. reviewer/ux-designer/visual-designer의 tools 미지정 — 기본 세트로 좁힐지 Bash 명시 추가할지

**결정**: 3개 에이전트 모두 `tools`를 `Read, Grep, Glob, Write, Bash, WebFetch, WebSearch`로 명시한다(rfp-analyst와 동일 패턴: 기본 분석/집필 세트 + Bash 예외 추가, Edit는 제외). 이 결정은 D8의 최종 선택과 무관하게 유효하다.

**근거**: 세 에이전트 MD 본문 모두 "직접 캡처 실행"을 핵심 원칙으로 명시(reviewer.md:70, ux-designer.md:15/21, visual-designer.md:15) — 위임이 아니라 본인이 셸 명령을 실행하는 구조다. §3.3 원칙 4단계 절차 적용: 산출물이 문서/디자인시스템 파일 생성 → 기본 세트에서 출발 → 기본 세트에 없는 Bash가 실제 필요(화면 캡처) → 최소한만 추가 + 사유 1줄, localizer/rfp-analyst 선례와 동일 패턴. Edit는 불필요(신규 파일 Write가 산출물, 기존 코드 수정은 frontend-dev 영역으로 스스로 명시). D8과의 결합도 재검토했으나 D8이 어느 옵션을 택하든 "셸에서 무언가를 실행해야 한다"는 사실 자체는 바뀌지 않아 D4는 D8을 기다릴 필요 없이 독립 결정 가능.

**실행항목**: 4순위 배치 작업 시 반영(이번 세션은 결정만 확정, 실물 파일은 D8 실행 시 함께 처리) — `tools: Read, Grep, Glob, Write, Bash, WebFetch, WebSearch` 추가, '핵심 원칙'에 Bash 부여 사유 1줄 명시.

**rubric 개정**: 불필요(rubric 자체 오류 없음, §3.3 그대로 적용).

---

## D5. common-*/domain-* 명명 규칙(§4.2) 카운트 방법 — grep 직접 인용 수 vs 인프라 예외

**결정**: 감사자의 잠정 권고(전 에이전트 인프라 규칙 예외 버킷 인정)를 채택하되, 자기선언 루프홀을 막기 위해 조건을 좁혔다. 예외는 (a) description이 도메인지식이 아니라 에이전트 운영방식 자체를 규정 AND (b) `agents/trainer.md`의 "1순위 공통 스킬" 표에 이미 등재 — 두 조건 모두 충족할 때만 grep 카운트 대신 그 표 등재 여부로 접두어를 판정한다. `domain-*`에는 이 예외를 적용하지 않는다.

**근거**: common-* 6개 중 grep 인용 5 미만인 4개(`common-beyond-mediocre-output` 3, `common-learning-loop-knowledge-management` 1, `common-output-storage-and-path-management` 1, `common-product-principles-reference` 1) 모두 trainer.md "1순위 공통 스킬" 표에 등재돼 있음을 확인. architect.md 등 다수는 스킬을 경로로 전혀 인용하지 않음(Skill 도구 자동매칭 설계) — grep -rl이 "실제 사용 범위"가 아니라 "우연히 문자열이 박혔는가"만 재는 방법론적 결함을 확인했다. 두 스킬의 SKILL.md 본문을 직접 읽어 도메인 지식이 아닌 전 에이전트 운영 인프라 규칙임을 확인. 다만 예외를 description 자기선언만으로 인정하면 게이밍이 가능해 trainer.md 등재라는 제3자 검증 가능한 레지스트리 조건을 추가했다. 나머지 2개(task-grading grep 7, token-efficient grep 18)는 예외 없이도 임계값 충족.

**실행항목**: 차기 감사/재작성 착수 시 D6(보안 스킬 4종 재편)에서 domain-security-audit-checklist·domain-serverless-edge-api-security의 접두어를 별도 재검토; trainer.md '1순위 공통 스킬' 표에 향후 신규 등재가 발생하면 그 자체를 §4.2 관점에서 검토 대상으로 취급(등재가 접두어를 자동 승격시키지 않음).

**rubric 개정**: 반영 완료 — §4.2에 '카운트 방법과 예외(전 에이전트 인프라 규칙 버킷)' 단락 추가.

---

## D6. 보안 스킬 4종(domain-backend-api-security / backend-security-audit / domain-security-audit-checklist / domain-serverless-edge-api-security) 재편

**결정**: 감사자의 원안('site_id가 회사표준이면 흡수, 아니면 backend-security-audit 전체 폐기')과 1차 제안('backend-security-audit 폐기') 모두 기각. **backend-security-audit은 폐기하지 않고 유지**한다.

1. §2.3 인용 오류를 실제 선례 쌍(`domain-backend-api-security`↔`backend-security-audit`)으로 정정.
2. backend-security-audit은 domain-backend-api-security와 중복이 아니라 이미 의도대로 작동 중인 '원론/malgnai 구현형' 분리.
3. 실제 미해결 중복은 4종 세트 밖 — `backend-api-implementation-patterns.md`의 A/B/F절과 코드 수준까지 겹친다. 이 파일의 description('보안 전용 체크리스트는 domain-backend-api-security를 별도 참조')이 자기모순 — 'backend-security-audit을 별도 참조'로 정정 필요.
4. `backend-dev.md:49-52` 오표기 확인(헤더는 domain-backend-api-security를 가리키나 본문은 backend-api-implementation-patterns 내용) — grep 참조 카운트를 무효화하는 실제 사례.
5. backend-security-audit 자신도 §4.2 접두어 규칙 위반(실참조 2개인데 domain- 접두어 없음) — `domain-backend-security-audit`로 재명명 필요(후속 구현 태스크).
6. domain- 접두어 최종 판정: domain-backend-api-security 유지, domain-serverless-edge-api-security 유지+backend-dev.md 신규 참조 추가, domain-security-audit-checklist 유지(devops.md 참조 추가 여부는 보유자 확인 후 확정).
7. D13(owasp-security-checklist.md 분산 병합)의 기존 분배안은 이 재편으로 수정 없이 유효.

**근거**: `domain-backend-api-security/SKILL.md:167`과 `backend-security-audit/SKILL.md`(8,13,21,48,69,258,281행)에 양방향 '원론↔구현형' 참조 문장과 '2026-07-23 중복 정리' 편집 이력이 실존 — 1차 제안의 '상호배제 문구가 전혀 없다'는 핵심 전제가 사실과 반대였다. 1차 제안이 대조한 대상(PUBLIC_PATHS/requireRole/site_id/error.name)은 실제로 `backend-api-implementation-patterns.md`였다. `backend-api-implementation-patterns.md`의 description이 자신의 A~F절(명백한 보안 콘텐츠)과 모순됨을 직접 확인. 1차 제안의 'site_id가 2개 프로젝트에서 검증됐다'는 결론은 과대해석으로 확인돼 확신도를 낮췄다. 감사자의 이분법('표준이면 흡수, 아니면 전체 폐기')이 구조패턴과 리터럴 컬럼명을 뭉뚱그렸다는 1차 제안의 비판은 타당해 그대로 채택.

**실행항목**: `backend-api-implementation-patterns.md` description 정정; `backend-dev.md:49-52` Skill 포인터를 `backend-api-implementation-patterns`로 교체 + 학습자료 추가; `backend-security-audit` → `domain-backend-security-audit` 재명명(디렉터리·frontmatter·전 참조처 갱신, trainer/architect 위임); `domain-serverless-edge-api-security`를 backend-dev.md 학습자료에 신규 참조 추가; `domain-security-audit-checklist` ↔ `domain-serverless-edge-api-security` 역방향 네거티브 스코프 문구 추가; `domain-security-audit-checklist`의 devops.md 연관성을 devops 보유자에게 확인 후 참조 추가 여부 확정; D13 분산 병합은 본 재편과 무충돌로 기존안대로 진행.

**rubric 개정**: 불필요(§2.3 인용 오류 정정은 이미 반영 완료 — docs/methodology/agent-development-methodology.md:122).

---

## D7. domain-devops-deployment-patterns 스택 전제와 Cloudflare 계열 스킬 간 정합

**결정**: 스택 충돌 없음 — 감사 오류. `malgn-agent/skills/` 실물 확인 결과, 감사가 지목한 Cloudflare 계열 스킬(agents-sdk/durable-objects/wrangler 등)은 malgn-agent 플러그인 안에 존재하지 않는다(다른 플러그인/세션 범위의 스킬을 감사자가 혼동). domain-devops-deployment-patterns의 Docker/K8s 전제는 그대로 유지하고 추가 조치 불필요.

**근거**: 세션에서 `malgn-agent/skills/`에 Cloudflare 계열 스킬이 전혀 없음을 직접 확인.

**실행항목**: 없음.

**rubric 개정**: 불필요.

---

## D8. screen-verification-and-capture 도구 인프라 — 번들할지, 프로젝트별 절차로 재작성할지 (known-issue c3ef5744)

**결정**: 채택 — 옵션 b+(경량 캡처 스크립트 번들 + 프로젝트별 Playwright 표준 설치 + storageState 인증 수렴). 감사자의 원안(옵션 a: 전역 인프라 그대로 번들)은 기각.

1. `skills/screen-verification-and-capture/SKILL.md` 재작성 — 전역 `shot` CLI 서술 제거, `malgn-agent/bin/capture.mjs`(신규 번들) 호출로 교체(핵심 플래그만 재현).
2. 스크립트는 `malgn-agent/bin/capture.mjs`로 신설(new-project.mjs 관례 재사용).
3. 브라우저 엔진은 `pnpm add -D playwright && pnpm exec playwright install chromium` 프로젝트별 1회 설치로 표준화.
4. 인증 재사용은 Playwright 표준 `storageState`(`auth.setup.js`)로 단일화(기존 `shot login`/레시피/개인 캐시 경로 복제 안 함).
5. `malgn-agent/templates/e2e-template/`로 스캐폴드 완전 번들 — 감사 §5(137행)가 이미 지시한 배치임을 확인(1차 제안의 "감사가 언급 안 함"은 오류로 정정).
6. `a4-vertical-layout/SKILL.md`의 `require('playwright-core')` 인라인 방식은 §7.4-4 위반 상태 — 더 이상 선례로 인용하지 않고 표준 설치 패턴으로 정리.
7. D4(tools 필드)는 반박이 맞음 — 3개 에이전트는 §3.3-1 화이트리스트 대상이 아니므로 기본 세트로 좁힌 뒤 Bash만 사유 명시 재추가.
8. D3 — `screen-verification-and-capture`는 pm/evaluator/trainer 어디에도 인용되지 않음(grep 0건 재확인), D3는 D8을 기다리지 않고 독립 착수 가능.

**근거**: `~/.claude/tools/`, `~/.claude/tools/auth/<host>.json` 서술이 저장소에 실재하지 않음(§7.4 경로 실재 게이트 실패). `a4-vertical-layout`의 playwright-core 선례 자체가 §7.4-4 위반 상태(package.json 미선언, `find . -iname package.json` → 루트 1개, dependencies 없음). `agents/*.md` 21개 중 reviewer/ux-designer/visual-designer/frontend-dev/qa-engineer 5개 모두 `tools:` 필드 없음, 화이트리스트(9개)엔 앞 3개가 없음을 확인 — 1차 제안의 "변경 불필요"는 틀림. `audit-report.md` 119행의 "pm/evaluator/trainer가 직접 인용"은 grep 0건으로 오류 확인. 추가 발견: `knowledge/quality/e2e-testing-guide.md:19`의 "전역 공유 캐시" 서술이 신규 환경(신입 PC, CI)에서 조용히 깨지는 암묵 의존 결함 — 재작성 시 `pnpm exec playwright install chromium` 명시 단계 추가 필요.

**실행항목**: `skills/screen-verification-and-capture/SKILL.md` 재작성; `malgn-agent/bin/capture.mjs` 신규 작성(`--full/--vp/--wait/--click/--sel/--dark/--responsive`); `knowledge/quality/e2e-testing-guide.md` 재작성(템플릿 번들 경로 교체 + `playwright install chromium` 명시); `knowledge/review/screenshot-capture-guide.md` 재작성 또는 스텁화; `a4-vertical-layout/SKILL.md` 의존성 정리; `reviewer.md`/`ux-designer.md`/`visual-designer.md` tools 필드 좁힘(D4 실행); `frontend-dev.md`/`qa-engineer.md`는 무변경; 6개 파일 변경은 §7.4 회귀 점검 통과 후 reviewer 풀패널; STATUS.md `c3ef5744` 결정 완료로 갱신 + WBS 등록; `decision_add`(importance 4).

**rubric 개정**: 불필요(rubric 자체 결함 없음, 발견 사항은 모두 실물 파일 위반 상태이거나 audit-report 서술 오류).

---

## D9. malgnai-discussion-culture — 이 저장소 자신의 내부 문화 문서(retire)인가, 제품 범용 패턴(rewrite)인가

**결정**: retire — `skills/malgnai-discussion-culture`를 malgn-agent 배포판에서 폐기하고, 본문을 이 저장소(claude-plugins) 자신의 `docs/decision`(또는 `docs/history`)류로 이관한다. 물리적 집행(스킬 이관 + `pm.md` 12~22·30행 참조 제거)은 지금 단독 실행하지 않고, 이미 발동된 오케스트레이션 트랙 재작성(D3, issue `929edddc`)에 편입해 함께 처리한다.

**근거**: §2.2 명문 위반 — 264~288행 "실제 사용 사례"가 제목부터 "에이전트 평가 시스템 기획 (이 회의)"로 이 저장소 자신의 evaluator DB 스키마 논의를 그대로 옮긴 1회성 특수 사례다(§2.2: 1회성 특수 사례는 Knowledge에도 넣지 않는다, 하물며 Skill은 더 엄격해야 한다). "습관화 마일스톤" 표(1개월→3개월→6개월→자율순환)는 점진적 인간 조직 학습곡선 전제라 LLM 에이전트 맥락에 개념 자체가 이식 불가능(어휘 치환과 질이 다른 문제). 재사용 가치가 있는 알맹이(5원칙 체크리스트+decision_record 포맷)는 이미 `pm.md` 12~22·30행에 완전히 인라인 자급자족돼 있어 재명명·유지해도 신규 중복만 생긴다. 저자 자신의 Q&A(292~301행)도 "우선 malgnai 내부 기획부터 정착, 확대는 추후"라고 스코프를 자인한다. §2.4('1개 참조=무접두어 재명명')를 적용하지 않는 이유: §2.4는 "유지할 스킬의 이름을 어떻게 붙일지"를 정하는 절이지, §2.2 위반이나 완전 중복 콘텐츠까지 무조건 유지시키는 규정이 아니다 — "유지할지 말지"는 §2.2·중복판정(§2.3/§1.3)이 별도로 결정한다.

**등급/집행 시퀀싱**: pm.md의 이 절은 "## 핵심 원칙" 안에 있어 §7.1의 고정규칙(즉시 Sensitive) 대상은 아니지만, §9.7 오케스트레이션 트랙 범위(pm.md가 직접 인용하는 스킬 경로)에 정확히 포함된다. 이 트랙은 issue `929edddc`로 이미 발동 상태이므로, 처분(retire)은 지금 확정하되 물리적 집행은 트랙 재작성과 묶어 한 번의 reviewer 풀패널 사이클로 처리한다(§7.3 적용단위 표 "트랙당 총 2회"와 정합, 같은 파일 같은 절을 두 번 리뷰하는 비효율 방지).

**D9 범위 밖 별도 이슈**: `pm.md` 12행 "토론 문화 (malgnai 핵심, 비협상)"의 "malgnai" 문구 잔존은 이 결정과 별개로 issue_add 대상.

**실행항목**:
- `decision_add`(importance 4~5, issue `929edddc`에 링크): D9=retire 확정 — §2.2 위반·습관화 마일스톤의 구조적 비이식성·pm.md와의 완전 중복을 근거로 명시, §2.4 미적용 사유를 명문으로 남긴다.
- 물리적 집행(스킬 본문 → docs/decision류 이관 스텁 + pm.md 12~22·30행 참조 제거/대체)은 오케스트레이션 트랙 재작성(D3, issue `929edddc`) 착수 시 함께 처리.
- `pm.md` 12행 'malgnai 핵심' 문구의 회사명 프레이밍 잔존을 D9과 별개의 issue_add로 등록.

**rubric 개정**: 반영 완료 — §2.4 "malgn-agent 내부 스킬 세분화(강등/재명명)" 절에 "[D9 해소]" 불릿 추가: "이 절의 참조 수 기준 재명명 규칙은 콘텐츠 자체가 §2.2·중복판정을 이미 통과한 스킬에만 적용되는 '유지 시 명명' 규칙이다 — 참조 에이전트가 1개라는 사실만으로 §2.2 위반 콘텐츠나 완전 중복 콘텐츠까지 자동 재명명·유지 대상이 되지 않는다. '유지 여부'는 §2.2/중복판정이 우선 결정한다." (원 결정문은 §10.2 절차(reviewer 풀패널)를 거친 뒤 반영을 권고했으나, PM의 명시 지시로 이번 결정 로그 확정과 함께 즉시 반영했다.)

---

## D10. §9.3/§9.1 malgnai-hub 도구명 표 내부 모순

**결정**: §9.1이 정확하고 §9.3의 괄호 예시가 오기임을 확인 — §9.3을 정정 완료. malgnai-mcp 전용 도구명은 `decision_add`/`issue_add`/`activity_log`/`lesson_add`/`memory_add`이고, `decision_record`/`issue_record`/`work_record`는 malgnai-hub(제품) 쪽 도구명이다.

**근거**: 이번 세션 malgnai-mcp deferred tool 목록(system-reminder)을 직접 확인 — `decision_add`, `issue_add`, `activity_log`, `lesson_add`, `lesson_list`, `lesson_classify`, `memory_add`, `memory_search`, `command_add`, `wbs_*`, `project_autonomy_*`, `project_status_set`, `get_current_context`. `work_record`/`decision_record`/`issue_record`는 이 목록에 없음. 실제 산출물 `malgn-agent/agents/pm.md`(42, 62, 64, 65, 144, 197-199, 253행)를 Read로 확인 — `decision_record`/`issue_record`/`work_record`를 malgnai-hub 도구로 일관되게 사용 중이며 §9.1 표와 정확히 정합. §9.3 원문은 "malgnai-mcp 전용 도구명(... work_record, decision_record, issue_record 등)"이라 적어 §9.1 표와 정면 상충했다.

**실행항목**: audit-report.md D10 항목을 '정정 완료'로 상태 업데이트(선택); §9.6 F항목·부록B 'Skill 대상' 체크리스트가 §9.3 정정 반영을 전제로 재수행되도록, skills 35개+knowledge 61개 전수 감사 시 정정된 §9.3 fail 조건 기준으로 grep 재실행.

**rubric 개정**: 반영 완료 — §9.3 괄호 예시를 실제 malgnai-mcp 도구명으로 정정 + hub 쪽 이름과 혼동 방지 각주 추가.

---

## D11. Skill/Knowledge 완전 중복 3건(shipley/software-test-design/visual-design-token-system)의 원본-사본 관계

**결정**: 3건 모두 Knowledge가 원본, Skill이 후속 재구성본으로 확정한다. Skill을 '절차 정본'으로 유지하고, 대응 Knowledge 3파일(`knowledge/proposal/shipley-proposal-process.md`, `knowledge/quality/testing-guide.md`, `knowledge/design/visual-design-system.md`)을 §1.3 이관 절차 그대로 스텁으로 축약한다.

**근거**: 감사자의 잠정 권고(git log로 원본 특정)는 이 저장소에서 실행 불가능함을 직접 확인 — `git log --all --oneline`이 커밋 2개뿐이고 6개 파일 전부 동일한 'Initial marketplace' 단일 커밋에서 한꺼번에 추가되어 git 이력으로 선후를 가릴 수 없다. 원 소스(`~/.claude/{skills,knowledge}`)도 git 저장소가 아니다. 대신 원 소스 디렉토리의 파일시스템 mtime을 근거로 썼다 — 3쌍 모두 예외 없이 Knowledge가 2026-06-25, Skill이 2026-07-24로 정확히 한 달 앞서 작성됨을 확인. 내용 대조로 '완전 중복' 주장도 검증(shipley 14줄 diff, visual-design-token 6줄 diff, testing-guide 27줄 diff) — 세 경우 모두 Skill이 Knowledge의 상위 호환이라는 점이 mtime 증거와 정확히 부합한다. 참조 무결성 확인: agents/skills 전체에서 이 3개 Knowledge 파일을 직접 참조하는 곳이 없음(grep 0건) — 스텁화해도 §1.3 ④ 부담 없음.

**실행항목**: `knowledge/proposal/shipley-proposal-process.md`, `knowledge/quality/testing-guide.md`, `knowledge/design/visual-design-system.md`를 "(2026-08-07 본문은 skills/X로 이관) 배경만 남음" 스텁으로 축약(§7.1등급상 Standard급 편집, grep -rl 참조 무결성 재확인 후 진행); audit-report.md D11 절의 '잠정 권고(git log)' 문구가 이 저장소에서 실행 불가능한 방법이었음을 후속 기록에 남길 것.

**rubric 개정**: 불필요(audit-report 서술 오류였지 rubric 조항의 오류가 아님).

---

## D12. proposal-writing-principles.md 이관 시 신규 Skill 신설 여부

**결정**: domain- 접두어의 신규 Skill 신설. 이름: `domain-proposal-writing-principles`. 실제 참조(필요) 에이전트는 writer + reviewer 2개 — §2.4 구간표(2~4개=domain-)에 따라 확정. rfp-analyst·capture-strategist는 실사용 근거 없어 참조에서 제외.

**근거**: writer.md는 이미 "필수" 학습자료로 직접 참조 중(118행). reviewer.md는 직접 참조는 없지만 실사용 필요성이 확인된다 — shipley-proposal-methodology의 Pink/Red Team 채점 기준이 proposal-writing-principles.md §8(복붙 테스트·형용사 사냥·평가표 역추적·So-what 점검)을 각주로 지목하고 있어 원문 직접 참조가 필요하다고 판단. rfp-analyst.md는 Compliance Matrix·배점 분석 범위로 집필·설득 기법과 겹치지 않음(불필요). capture-strategist.md는 Win Theme·Ghosting 정의가 이미 shipley-proposal-methodology §3에 자체 서술돼 있고, 본문 자체가 "본문에 심는 것은 writer의 작업"이라 명시(불필요). rubric §2.2/§2.4 자체의 오류는 발견하지 못함(사실관계 확인 문제였음).

**실행항목**: `skills/domain-proposal-writing-principles/SKILL.md` 신설(명령형 절차로 이관); `knowledge/proposal/proposal-writing-principles.md`는 배경+출처 스텁으로 축소(D11 처리 방향과 통일); `agents/writer.md:118`의 knowledge 직접 참조를 신규 Skill 참조로 교체; `agents/reviewer.md` 학습자료에 신규 Skill을 '필수(제안서 컬러팀 리뷰 시)'로 추가; SKILL.md description에 rfp-analyst/capture-strategist는 대상이 아님을 명시하는 네거티브 스코프 문구 포함; 이관 후 §1.3 이관절차③ 준수 여부를 reviewer/evaluator가 재검증.

**rubric 개정**: 불필요.

---

## D13. owasp-security-checklist.md 분산 병합의 구체 분배안

**결정**: 분산 병합 확정 — A01(CORS 신규 추가 포함)/A03→domain-backend-api-security §1/§4, A02→domain-security-audit-checklist §4, A09(에러 스택트레이스 노출 신규 추가 포함)→§5, 인프라(Docker/환경변수, 전량 신규)→domain-devops-deployment-patterns §1. A07(Vue v-html XSS)은 감사자가 제시한 두 후보(domain-frontend-vue-zero-patterns/domain-backend-api-security) 모두 기각하고 **domain-security-audit-checklist**로 확정.

**근거**: 4개 대상 skill의 SKILL.md 실물을 전문 Read하고 owasp-security-checklist.md 전문(120줄)과 섹션별 대조 — A01/A03/A02/A09/인프라는 코드예시·체크리스트 문구 수준까지 이미 실질 중복(§2.3 80% 기준 충족)이라 감사자 초안을 그대로 확정했다. 단 A01의 CORS, A09의 에러 스택트레이스, 인프라 전체는 대상 스킬에 없는 순수 신규 내용이라 "흡수"가 아닌 "신규 추가"임을 구분 명시(병합 실행자가 순삭하지 않도록). A07은 `agents/security.md` §"코드 보안 리뷰"(45-48행)가 이미 domain-security-audit-checklist를 XSS 패턴 검사의 authoritative pointer로 명시하고 있는데 실제 콘텐츠가 0건인 기존 드리프트를 발견 — 이 드리프트를 해소하는 배치가 신규 포인터보다 우선. rubric §2.3의 "중복 판정 절차"는 1:1 병합만 다루고 "분산 병합" 세부 절차가 없는 공백이 발견됐다(D13 쟁점 자체가 지적한 공백).

**실행항목**: trainer 위임 — A01(CORS 신규 포함)/A03을 domain-backend-api-security §1/§4에 병합; A02를 domain-security-audit-checklist §4에, A09(신규 포함)를 §5에 병합; 인프라 섹션(전부 신규)을 domain-devops-deployment-patterns §1에 병합; A07을 domain-security-audit-checklist에 신규 섹션 추가. 병합 완료 후 `knowledge/security/owasp-security-checklist.md` 원본 폐기 및 evaluator/reviewer 검증 체인 실행. 별도 후속(D13 범위 밖): `agents/security.md` line46의 'SQL Injection' 패턴 검사 소속 문구 정정 필요(trainer 경로); line55 '인프라 보안' 참조처 불일치는 3순위 보안 스킬 군집 재편 시 함께 정리.

**rubric 개정**: 반영 완료 — §2.3에 "5. [D13 해소] 분산 병합(Distributed Merge) 절차" 신설: (a) 섹션 단위로 §2.3 1~4번 절차를 개별 적용 (b) 기존 agent-MD pointer 확인 후 드리프트 해소를 신규 포인터보다 우선 (c) 60% 미만 잔여 섹션은 §2.2 신설 판정 트리로 별도 처리.

---

## D14. Agent MD ↔ Knowledge 내용 중복 시 정본 방향

**결정**: 기본값은 Knowledge 정본화 + Agent MD 압축(감사자 잠정 권고 채택). 단 예외 범위를 "§3.1 골격 필수 섹션(핵심원칙/역할경계/전제조건/자기검증/산출물/학습자료 + 실측 21/21 전원 보유한 스킬 상세)"으로 명확히 하고, 그 경우 섹션 완전 삭제 대신 3~5줄 요약+Knowledge 위임으로 압축한다.

**근거**: rubric §3.2 판정규칙은 문언 그대로 "호출조건·역할경계 모순"에만 적용되고 "내용 중복"에는 기준이 없음(오류가 아니라 실제 공백). writer.md와 `knowledge/writing/document-writing-guide.md`를 나란히 읽어 대조한 결과, 감사자가 예로 든 "스킬 상세 필수 섹션 예외"가 이미 정확히 이 파일 쌍에서 구현돼 있음을 실증(Agent=4줄 압축 나열의 "평범함 탈출 4대 기법", Knowledge=26줄 배경·예시). 판정 기준 신설이라는 정책적 성격상 즉시 rubric Edit보다 §10.2 절차(reviewer 풀패널)를 거치는 것이 원래 규율과 일관된다고 판단했었다.

**실행항목**: `decision_add`(importance=4)로 D14 최종 결정문 기록; reviewer 풀패널 승인 후 rubric에 반영(원 결정문 방향) — 단 PM의 명시 지시로 이번 결정 로그 확정과 함께 즉시 반영 완료(아래 참조); trainer/evaluator가 §9.7 감사 체크리스트에 이 판정 예시(writer.md↔document-writing-guide.md)를 pass 사례로 추가; 다른 20개 agent MD도 동일 기준으로 재점검할지 별도 Standard 작업으로 큐잉.

**rubric 개정**: 반영 완료 — §3.2 뒤에 "### 3.2-bis [D14 해소] 판정 규칙 — Agent MD ↔ Knowledge 내용 중복" 신설(기본값/예외/판정 예시 3단 구성). (원 결정문은 §10.2 절차를 먼저 거치도록 권고했으나, PM의 명시 지시로 이번 결정 로그 확정과 함께 즉시 반영했다.)

---

## D15. 개인화된 프로젝트 표준(pnpm 규칙 등)의 중앙화 여부

**결정**: 현행 유지 — 파일 수정 불필요. devops.md·frontend-dev.md에는 "pnpm 전용/npm·yarn 금지" 같은 기본 정책의 인라인 서술이 실제로는 존재하지 않으므로, "malgn-project-standards로 참조 통일" 이관 작업 자체가 적용될 대상(중복 텍스트)이 없다. 감사보고서 D15의 "개별 인라인 서술 중"이라는 전제는 실물 대조 결과 부정확했다. 예방적 원칙만 명문화: 향후 두 파일에 pnpm 기본 정책 문장이 추가되면 인라인 작성 금지, `skills/malgn-project-standards` 참조 1줄로 대체하고 에이전트 고유 이슈만 인라인 유지.

**근거**: `agents/devops.md`의 pnpm 관련 항목 정확히 2건 — 둘 다 devops 고유의 CI/버전 이슈(lesson `f62affed`, `0e97bdee`/`77753fe7`)이며 "pnpm을 쓴다"는 기본 정책 문장 자체는 없음. `agents/frontend-dev.md`의 pnpm 언급 3건(14/74/100행)은 전부 `pnpm run dev` 실행 커맨드 사용례일 뿐 정책 서술이 아님. `grep -rln pnpm agents/*.md` 결과 이 두 파일뿐 — 숨은 중복 없음. `skills/malgn-project-standards/SKILL.md` §1이 이미 정본 정책 보유. `grep -rl malgn-project-standards agents/ skills/ knowledge/` 결과 참조는 pm.md 1개뿐 — §2.4/§4.2 임계값(1개=무접두어)과 현재 파일명(접두어 없음)이 이미 정합.

**실행항목**: 조치 없음(현행 유지); 가드레일 원칙만 팀 공지: pnpm 기본 정책을 향후 어느 에이전트 MD에 추가할 때는 인라인 서술 대신 `skills/malgn-project-standards` 참조 1줄로 작성하고, 그 에이전트 고유 이슈(CI 버전 스큐 등)만 인라인 유지; 만약 향후 devops.md/frontend-dev.md에 참조를 명시 추가하기로 결정하면, 참조 에이전트 수가 1→3이 되어 §2.4/§4.2 임계값상 domain-* 접두어 재명명(`skills/domain-project-standards` 등)이 함께 필요함을 별도 결정 항목으로 다룰 것.

**rubric 개정**: 불필요.

---

## 부록 — rubric에 실제로 반영된 개정 항목 목록

| 결정 | 반영 절 | 반영 시점 |
|---|---|---|
| D1 | §7.1 '[D1 정정]' 문단, §7.3 '역할 경계·위임 모델 절 내부 치환' 행 신설 | 선행 세션에서 반영 완료(이 세션에서 확인) |
| D2 | §7.1 '[D2 정정]' 문단, §9.7 '[D2 해소]' 교차참조 문단 | 선행 세션에서 반영 완료(이 세션에서 확인) |
| D3 | §9.7 '핵심 3종 조건의 범위' 문단 재작성 + '[D3 해소]' 문단 신설, audit-report.md D3 '[확정]' 갱신 | 선행 세션에서 반영 완료(이 세션에서 확인) |
| D5 | §4.2 '카운트 방법과 예외' 단락 신설 | 선행 세션에서 반영 완료(이 세션에서 확인) |
| D6 | §2.3 상호 배제 문구 선례 인용 정정 | 선행 세션에서 반영 완료(이 세션에서 확인) |
| D9 | §2.4 "[D9 해소]" 불릿 신설 | **이 세션에서 신규 반영** |
| D10 | §9.3 괄호 예시 정정 + 혼동 방지 각주 | 선행 세션에서 반영 완료(이 세션에서 확인) |
| D13 | §2.3 "5. [D13 해소] 분산 병합 절차" 신설 | **이 세션에서 신규 반영** |
| D14 | §3.2 뒤 "### 3.2-bis [D14 해소]" 신설 | **이 세션에서 신규 반영** |

D4/D7/D8/D11/D12/D15는 rubric 개정 불필요로 확정(위 각 항목 참조). audit-report.md §6 헤딩 아래에 "이 절의 잠정 권고는 모두 확정되었다 — 최종 결정은 docs/methodology/decisions-log.md 참조." 안내 문구를 추가했다.
