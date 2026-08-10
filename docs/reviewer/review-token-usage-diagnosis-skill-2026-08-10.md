# 리뷰 보고서: token-usage-diagnosis 스킬 (브랜치 `trainer/token-usage-diagnosis-skill-20260810`, 커밋 `1f4e0ee`)

- 리뷰 일자: 2026-08-10
- 리뷰 대상: `malgn-agent/bin/analyze-usage.mjs`, `malgn-agent/skills/token-usage-diagnosis/SKILL.md`, `malgn-agent/agents/pm.md`(1줄 백링크)
- 등급: PM 명시 등급 표기 없음 → 기본 Standard로 간주하되, "개인정보" 관련 발견(RV-003)이 있어 Sensitive 트리거 근접 — 풀패널(4인, 발산형 1인 포함)로 진행
- 페르소나: 4명 (`docs/reviewer/personas/persona-verifiable-claim-discipline-auditor.md`, `persona-script-skill-consistency-auditor.md`, `persona-privacy-leakage-auditor.md`, `persona-self-service-scope-challenger.md`[발산형])

## 종합 판정: 🟡 GO-with-fix

Critical 없음. Major 1건(RV-003, 개인정보/유출)이 병합 전 또는 병합 직후 즉시 반드시 고쳐야 할 문서 보강 사항이라 GO-with-fix로 판정한다. Major가 하나라도 있으면 기계적으로 Red가 되는 것은 코드 결함/기능 미동작 급일 때 기준이고, 이번 건은 **문서 보강만으로 닫히는 작은 수정**이라 판단해 Red(NO-GO)가 아니라 Amber(GO-with-fix)로 내린다 — 근거는 아래 RV-003 상세 참조.

## 실행/검증 사실관계 (했음/안 했음 정확히 표기)

- `git show 1f4e0ee`로 diff 전문 확인함 — PM이 이미 확인한 스코프(3파일, 무관 변경 없음)와 일치 재확인.
- `node malgn-agent/bin/analyze-usage.mjs --days 1 --top 3`, `--project`, `--out`, `--help` 각각 실제 로컬 세션 로그(48개 세션, 3560개 jsonl 파일)로 실행해 출력 구조를 실물 확인함.
- `grep -rl "token-usage-diagnosis" malgn-agent/agents/*.md` 실행해 참조 에이전트 수 실측함(결과: pm.md 1개).
- `agent-development-methodology.md` §2.4/§4.2, `agents/trainer.md`(해당 표 부재 확인) 대조함.
- reviewer는 코드를 직접 수정하지 않았음(역할 경계대로). 병합·실행 액션도 하지 않았음 — dry-run 검증만 수행.
- Windows 경로 처리는 코드만 읽고 실제 Windows 환경 실행은 하지 않음(macOS만 실행) — **미검증으로 명시**.
- 크리덴셜이 실제로 새는 사례는 로컬 데이터에 존재하지 않아 실증하지 못함 — RV-003은 **구조적 위험**(코드 경로 확인 + 실제 실행으로 메커니즘 자체는 검증)이지 "실제 유출 사고 재현"은 아님, 이 구분을 명시함.

## 이슈 목록

| ID | 심각도 | 위치 | 내용 | 제기 페르소나 |
|---|---|---|---|---|
| RV-001 | 🟡 Minor | `bin/analyze-usage.mjs` 410행 주석("// 5. 캐시 활용도")·397~414행 | 코드 내부 섹션 번호가 4→(5, 헤더 없이 인라인)→6으로 스킵된다. 실제 출력엔 "## 5." 헤더가 없고 캐시 히트율 문장이 총량요약 표 바로 아래 무번호로 붙는다. 기능상 문제는 없으나(SKILL.md도 이를 "총량요약, 캐시히트율"로 무번호 서술해 실제와 일치) 코드 유지보수 시 번호 재정렬 시점에 혼동 소지 | script-skill-consistency-auditor |
| RV-002 | 🟡 Minor | `skills/token-usage-diagnosis/SKILL.md` 12행 vs 명명 근거(커밋 메시지) | "특정 소수 전문 에이전트 전용이 아니다... 어느 에이전트든 사용자가 직접 요청 시 바로 사용"이라는 설계 의도와 "참조 에이전트 1개(pm.md)라 무접두어"라는 명명 근거 사이에 표면적 긴장이 있다. 단, `agent-development-methodology.md` §4.2 재확인 결과 이 스킬은 예외버킷(에이전트 "운영방식 규칙"류 + trainer.md "1순위 공통 스킬" 표 등재) 두 조건 중 어느 것도 충족하지 않아(도메인 진단 도구이고, 그 표 자체가 현재 trainer.md에 없음) **현재 규칙상 무접두어 판정은 기술적으로 정확**하다. 다만 backend-dev/qa-engineer 등 다른 에이전트 MD에는 이 스킬에 대한 언급이 전혀 없어, 그 에이전트로 활동 중인 세션에서는 사용자가 물어도 "학습자료"에서 발견할 경로가 없다(Skill 도구의 description 자동매칭에만 전적으로 의존) | self-service-scope-challenger, script-skill-consistency-auditor |
| RV-003 | 🟠 Major | `bin/analyze-usage.mjs` 323~336행(toolCallCounts 수집), 486~497행(반복호출 표 렌더링) / `skills/token-usage-diagnosis/SKILL.md` 105행("개인정보 유의") | "반복 호출 패턴" 표는 `JSON.stringify(tool_use.input)`을 120자까지 truncate해 그대로 노출한다. Read 도구는 file_path뿐이라 안전하지만 Bash(명령어 전문)·Edit/Write(content·new_string 일부)·WebFetch(쿼리스트링에 토큰 포함 가능) 등은 동일 입력이 세션 내 2회 이상 반복될 때 그 원문 일부가 리포트에 그대로 찍힌다. 실제 로컬 로그로 실행해 이 표가 실제로 도구 input을 echo하는 것을 확인했다(이번 표본에는 Read만 걸려 file_path만 노출됐지만, 메커니즘 자체는 코드로 확정 — Bash/Edit/Write가 반복되면 동일하게 노출된다). SKILL.md의 유일한 개인정보 경고(105행)는 "cwd"만 언급하고 이 노출면은 다루지 않는다. 추가로 pm.md의 malgnai-hub 기록 관행(`work_record`/`decision_record`에 리포트 내용을 그대로 남기는 습관)과 결합하면, 원래 로컬 1회성이던 데이터가 회사 전체가 검색 가능한 중앙 저장소로 전파될 경로가 있는데 SKILL.md가 이를 경고하지 않는다 | privacy-leakage-auditor |
| RV-004 | ⚪ Nit | `bin/analyze-usage.mjs` 556행(topSessionShare 가드 `sessionList.length > 1`), 589행(sidechainShare 가드 `grandMain.input + grandMain.cacheCreate > 0`) | SKILL.md 29행이 효율화 가이드 6개 조건을 요약하며 이 두 가드 조건은 언급하지 않는다. 기능에 영향 없는 사소한 생략 | script-skill-consistency-auditor |
| RV-005 | 🟡 Minor(정보) | PM Micro 등급 판단 | "조회"라는 Micro 정의에 부합하는지 검토한 결과, SKILL.md의 강한 제약(원인 단정 금지·고정 우선순위 목록·claimed/verified 태깅 예시)이 PM의 판단 재량을 사실상 기계적 실행으로 좁혀놓아 Micro 등급 자체는 타당하다고 판정. 다만 RV-003이 고쳐지기 전까지는 PM이 원문을 그대로 malgnai-hub에 기록하지 않도록 별도 주의가 필요(= RV-003의 하위 항목, 별도 이슈로 분리하지 않음) | self-service-scope-challenger |

## 페르소나별 관점

### 검증가능성·주장규율 감사관 (verifiable-claim-discipline-auditor)
SKILL.md의 "결과 해석 원칙"(51~55행)·"우선순위 부여"(69~76행)·"Example Usage"(87~100행) 세 절을 스크립트 526~604행의 실제 효율화 가이드 텍스트와 문장 단위로 대조했다. 새는 지점을 찾지 못했다 — "우선순위 부여" 절은 "스크립트는 항목 간 순서를 매기지 않으므로 이 순서는 스킬의 해석 판단이다"라고 스스로 명시해 claimed임을 숨기지 않고, Example Usage의 claimed 태그 문장("컨텍스트를 자주 리셋했을 가능성이 있습니다")도 스크립트의 원 제안문(528~531행, "~하고 있지 않은지 점검하세요")을 사실 단정이 아니라 가능성으로 재진술한 것이라 과장이 없다. "효율화 가이드가 비어있을 때"(57~59행)도 억지로 콘텐츠를 채우라는 유도 없이 스크립트의 정확한 문구("관측된 데이터 범위에서는...")를 그대로 인용하라고만 지시한다. **이 절은 이번 리뷰에서 가장 잘 설계된 부분**이라고 판단한다. 결함 없음(Critical/Major 없음).

### 스크립트-스킬 정합성 감사관 (script-skill-consistency-auditor)
옵션(`--days`/`--project`/`--top`/`--out`) 4개 전부 실제 실행으로 재현했고 SKILL.md 서술과 정확히 일치했다(기본값 `days=1`/`top=5`/`apiTop=10` 포함). 출력 섹션 순서·조건부 노출(일자별 추이는 dailyTotals.size>1일 때만)도 코드·SKILL.md·실행결과 세 지점이 모두 일치했다. 효율화 가이드 6개 임계값(50%/2건 이상/15회/40%/5개+2턴/30%)도 코드 상수와 SKILL.md 서술이 정확히 일치했다. 유일한 흠은 RV-001(코드 내부 섹션 번호 스킵, 인지적 사소함)과 RV-004(가드 조건 두 개 미서술, 기능 무관)다. 명명 근거는 grep 재현 결과(pm.md 1개)와 커밋 메시지 주장이 일치했고, §4.2 예외버킷 두 조건 모두 미충족을 확인해 현재 규칙상 무접두어 판정이 기술적으로 옳다고 결론지었다(RV-002로 긴장만 별도 기록).

### 개인정보·유출 감사관 (privacy-leakage-auditor)
가장 중요한 발견(RV-003)을 냈다. cwd 노출은 SKILL.md가 이미 다루고 있어 "충분한가"만 판단하면 됐는데, 코드를 읽다가 "반복 호출 패턴" 표가 도구 input 원문을 echo한다는 별도 노출면을 찾았고, 실제 로컬 데이터로 실행해 그 표가 실제로 input을 그대로 찍는 것을 확인했다. cwd보다 이쪽이 더 심각하다고 본다 — cwd는 "어느 프로젝트에서 일했는지"만 드러내지만, 도구 input 원문은 코드 스니펫·명령어·URL 쿼리스트링(토큰 포함 가능)을 직접 노출할 수 있다. SKILL.md가 "다른 사람과 공유 전 알린다" 정도로만 다루는 게 cwd 하나에는 충분해도, 이 두 번째 노출면 자체를 언급조차 하지 않는 것은 불충분하다고 판단한다. 추가로 pm.md의 malgnai-hub 기록 습관과 결합하면 로컬 1회성 데이터가 중앙 저장소로 전파될 수 있다는 점도 SKILL.md에 없다.

### 셀프서비스 스코프 제로베이스 도전자 (self-service-scope-challenger) [발산형]

🔵 Rethink — "직원 토큰 과다사용 문제 조사"에서 출발했는데 산출물은 "개인이 자기 것만 보는 셀프 진단 도구"로 끝났다. SKILL.md 13행이 이 한계를 정직하게 명시하고 있어 숨긴 결함은 아니지만("구조적 한계... 팀/조직 전체 집계나 타인과의 비교는 이 도구로 할 수 없다"), 원래 동기가 조직 차원 문제였다는 점을 감안하면 이 산출물은 "1단계(개인 자각)"만 만들고 멈춘 것으로 봐야 한다. 대안 구조를 다음과 같이 제시한다:

| 현재 구조 | 제안 구조(2단계 확장, 선택적) | 왜 더 나은가 | 예상 비용·리스크 |
|---|---|---|---|
| 각 직원이 개인 세션에서만 진단 실행, 결과는 로컬/개인 대화에만 남음. 조직 차원 집계 불가 | 직원이 진단을 실행한 뒤 **본인 동의 하에** cwd·도구input을 제거한 요약 수치(총 토큰/캐시히트율/효율화가이드 항목명만)만 팀 채널 또는 malgnai-hub에 옵트인 기록하는 절차를 SKILL.md에 별도 절로 추가 | 원래 동기(조직 차원 과다사용 파악)에 실제로 답할 수 있게 됨. 개인정보 노출(RV-003)과도 충돌하지 않음 — 수치만 공유하고 cwd/tool-input 원문은 애초에 공유 대상에서 제외 | 추가 설계·구현 필요(이번 커밋 범위 밖). "옵트인" 강제 방법이 없으면 실제 집계율이 낮아 유명무실할 위험. 이번 병합을 막을 이유는 아니며, 별도 후속 스킬/기능으로 제안 |

PM Micro 등급 판단 자체는 타당하다고 본다(RV-005) — SKILL.md의 강한 가드레일이 PM의 재량을 기계적 실행 수준으로 좁혀놓았기 때문이다. 명명 긴장(RV-002)도 규칙 위반은 아니라고 본다.

## 트레이드오프 (페르소나 간 의견 차이)

- **명명(RV-002)**: script-skill-consistency-auditor는 "현재 규칙상 문제 없음"으로 정리했고, self-service-scope-challenger는 "설계 의도와 측정 방식의 긴장은 실재한다"고 봤다 — 둘 다 맞다. 규칙 위반은 아니지만(GO를 막을 사유 아님), PM이 향후 다른 에이전트 MD에 이 스킬 언급이 쌓이면 §4.2 일반 규칙에 따라 domain-*로 재평가해야 한다는 점만 기억해두면 된다.
- **Major 판정 강도**: privacy-leakage-auditor는 RV-003을 "병합을 막을 수도 있는 수준"으로 보고 싶어했으나, verifiable-claim-discipline-auditor·script-skill-consistency-auditor는 "문서 보강만으로 닫히는 수정"이라 GO-with-fix가 맞다고 봤다. 최종 통합 판단은 후자를 따랐다(코드 재설계 불요, SKILL.md 문구 추가로 해소 가능하다는 근거).

## 잘된 점

- 무의존성 순수 Node 스크립트로 설치 장벽이 없다 — 실제 실행에서 별도 `pnpm install` 없이 즉시 동작함을 확인.
- claimed/verified 구분을 "선언"에 그치지 않고 Example Usage에서 실제 문장으로 시연한 것(SKILL.md 94~99행)이 이 저장소의 다른 스킬들과 비교해도 모범적이다.
- SKILL.md가 스스로의 구조적 한계(개인 로그만 볼 수 있음, 비용 추정 안 함)를 숨기지 않고 정직하게 명시한 점(13·31·78~81행).
- 스크립트-문서 정합성이 매우 높다 — 옵션 4개, 출력 섹션 순서, 효율화 가이드 임계값 6개 전부 실행 재현으로 일치 확인됨. 드물게 "문서가 코드를 정확히 서술"하는 사례.
- SKILL.md 106행("로그 스키마 변경 시" 절)처럼 향후 유지보수 트리거를 미리 문서화해둔 점.

## 생략한 부분 (정직 고지)

- Windows 환경에서의 실제 실행은 하지 않음(macOS에서만 검증). `path.join`/`os.homedir()` 사용은 코드 리뷰로만 확인.
- 실제 크리덴셜이 새는 사고 재현은 하지 않음(로컬 데이터에 그런 사례가 없어 실증 불가) — RV-003은 코드 경로+실행 메커니즘 확인까지만 한 구조적 위험 판정이다.
- `docs/screenshots/` 캡처는 해당 없음(UI 산출물이 아니라 CLI/문서 산출물이라 스킬 요구사항의 "화면 캡처" 항목 자체가 적용 대상 아님).
- 5번째 관점("PM Micro 등급 직접처리")은 별도 페르소나를 신설하지 않고 self-service-scope-challenger에 포함시켰다 — 별도 판정이 필요하다고 판단되면 후속 요청 바람.

## PM 권고

1. **병합 전 필수(RV-003 해소)**: `SKILL.md` "개인정보 유의" 절(105행)에 다음 두 가지를 추가 — (a) "반복 호출 패턴" 표가 도구 input 원문(명령어·코드 스니펫·URL 등)을 노출할 수 있음을 명시, (b) 리포트 원문을 malgnai-hub `work_record`/`decision_record`에 그대로 기록하지 말고 요약 수치만 남기라는 원칙 추가. 이건 trainer에게 짧은 후속 커밋으로 위임 가능한 수준(코드 변경 불요, 문서 2~3문장 추가).
2. RV-001·RV-002·RV-004는 병합을 막을 사유 아님 — 다음 정비 사이클에 함께 처리해도 무방.
3. RV-005(Micro 등급)는 현재 판단 유지 권고, 단 RV-003 반영 후.
4. self-service-scope-challenger의 🔵 Rethink(조직 차원 집계 확장안)는 이번 커밋 범위 밖 별도 제안으로 채택 여부를 PM이 판단 — 지금 당장 착수를 요구하는 것은 아님.
