# 결함 소품 정정 라운드 (`trainer/backlog-defects-round-20260901`) 리뷰 보고서

리뷰 페르소나 패널: `persona-harness-spec-factchecker.md`(수렴/정확성) · `persona-product-body-portability-auditor.md`(수렴/이식성) · `persona-dead-reference-scope-challenger.md`(발산)
리뷰 대상: 워크트리 `/Users/hopegiver/workspace/claude-plugins/.claude/worktrees/agent-a49f1486c8ac2bf6a`, `git diff 0f7fb17..3764cc1` (7파일 +25/-18)
target_id: `backlog-defects-round-20260901` (PM 위임에 target_id·직전 리뷰 경로·리스크 범주가 없어 **최초 리뷰**로 처리, 등급 Standard)
리스크 범주: 전역 자동실행 자산(`hooks/sessionstart-context.mjs`) + 상시 로드 제품 본문(`agents/`·`skills/`·`knowledge/`)
리뷰 일자: 2026-09-01
종합 판정: 🟡 **Amber** (Critical 0 / Major 1 / Minor 2 / Nit 2 / Rethink 2)

## 요약 (2분 규칙)
trainer가 보고한 7건은 **전부 실물로 확인됐고**, 주장 중 검증 가능한 것은 모두 사실이었다 — `check-links` ERROR 6→0(WARN 9 불변, 회귀 없음), 새로 심은 하네스 인용 4건은 미러 원문과 문자 단위로 일치하며 앵커 4개도 전부 실재하는 heading이다. 스코프 이탈 0건, 식별자·이력 신규 유입 0건.
다만 **같은 파일 안에서 같은 클래스의 죽은 인용 2건을 놓쳤다** — `hooks/sessionstart-context.mjs:79`의 `hooks.md:892`와 `:183`의 `hooks.md:852`는 경로 접두어가 없다는 이유로 린터에 안 걸릴 뿐, 실제로는 둘 다 드리프트한 잘못된 줄번호다(🟠 RV-01). 이 라운드가 고친 것과 정확히 같은 병이 같은 파일에 남았다.

## 페르소나 재사용 판정 (산출물 게이트)

| 페르소나 | 재사용/신규 | 유형 | 사유 (INDEX.md 대조 근거) |
|---|---|---|---|
| `persona-harness-spec-factchecker.md` | **재사용** | 수렴 | INDEX.md 행 "우리 문서가 옮겨 적은 제3자 하네스 사양 주장이 공식문서 원문과 줄 단위로 일치하는지 대조하는 사실검증관" — A-2 인용 검증과 역할개념 동일. 6대 요소 무수정, 적용이력만 append |
| `persona-product-body-portability-auditor.md` | **재사용** | 수렴 | INDEX.md 행 "설치 직원이 조회할 수 없는 근거가 제품 본문에 새로 유입됐는지 목적 기준으로 감사하는 이식성 감사관" — `NOT_BUNDLED_CITATION`·날짜 도장 잔존 판정과 동일 |
| `persona-dead-reference-scope-challenger.md` | **재사용** | 발산 | INDEX.md 행 "문제 스코프를 '형태'로 정의한 것이 실제 판정 기준(조회 가능성)과 어긋나지 않는지 반증하는 발산형" — 이번 "죽은 안내판" 스코프 정의와 정확히 같은 표면 |

신규 페르소나 **0개**. INDEX.md 33행 전량의 "역할개념(1줄)" 열을 스크리닝해 위 3개 외 더 적합한 행이 없음을 확인했고, 3개 행의 "최근 재사용" 열을 갱신했다.
PM은 "1~2명"을 요청했으나 3명으로 운영했다 — 발산형 슬롯 1명을 추가한 것이며, 3명 모두 **재사용**이라 신규 작성 비용은 0이다.

## 지적 사항 (통합)

| # | 심각도 | 관점 | 위치 | 확인방법 | 문제 | 개선안 |
|---|---|---|---|---|---|---|
| RV-01 | 🟠 Major | 정확성·이식성 | `malgn-agent/hooks/sessionstart-context.mjs:79`, `:183` | 두 줄 Read + 미러 `docs/anthropic/hooks/hooks.md` 해당 행 대조 + `grep -rnoE '\b[a-z-]+\.md:[0-9]+' malgn-agent/` 전수 | 같은 파일 안에 `hooks.md:892`·`hooks.md:852`가 남아 있고 **둘 다 이미 드리프트했다** — 10,000자 캡 문장은 현재 `:913`, SessionStart 행은 `:871`이고 `:852`는 exit-code-2 표의 **헤더 행**이다. 이 라운드가 고친 A-2와 동일 클래스인데 경로 접두어(`docs/`)가 없어 린터 `REPO_ONLY_ANCHORS` 판정을 통과했다(`scripts/check-install-reachability.mjs:301-313`) | A-2와 같은 처방 적용 — 줄번호를 지우고 원문 인용 또는 앵커 URL로. 최소 조치로는 `:79` "훅 출력 캡(10,000자, `hooks.md:892`)" → "훅 출력 캡(10,000자, 훅 레퍼런스 JSON 출력 절)", `:183` "블로킹 불가하므로(`hooks.md:852`)" → "블로킹 불가하므로(exit code 2 표: SessionStart = Can block? No)" |
| RV-02 | 🟡 Minor | 정확성 | `malgn-agent/agents/trainer.md:114` | 세 변경 파일 Read + `grep -rn "persona-\[관점\]\|persona-<관점>\|persona-\*" malgn-agent/` | 같은 커밋이 `persona-[관점].md`(SKILL.md:13, reviewer-personas.md:11·12)와 `persona-<관점>.md`(trainer.md:114) 두 표기를 동시에 심었다. 저장소 표준은 대괄호(reviewer.md:84·124도 대괄호). 린터의 `PLACEHOLDER_CHARS`(`check-install-reachability.mjs:86`)는 `[]`·`<>` 둘 다 허용하므로 꺾쇠는 **강제된 선택이 아니다** — 같은 라운드가 만든 표기 드리프트 | trainer.md:114를 `persona-[관점].md`로 통일 |
| RV-03 | 🟡 Minor | 정확성 | `malgn-agent/agents/evaluator.md:128` | 해당 줄 Read + 정본 `:132-135` 대조 | RV-104 3분할 후에도 3번째 질문 "PR 없이 판정만 한 회차도 예외가 아니며, 남기지 못했으면…"의 **"예외가 아니며"가 무엇의 예외인지 모호**하다. 바로 앞 문장이 `agent_score_record`라 "PR 없는 회차에도 점수기록이 필요"로 오독될 수 있으나, 정본(`:133`)은 이것이 `decision_record` 의무의 무예외 범위임을 명시한다 | "PR 없이 판정만 한 회차에도 위 `decision_record`는 예외가 없다 — 남기지 못했으면 그 사실과 내용을 반환문에 실었는가?"처럼 지시대상을 명시 |
| RV-04 | ⚪ Nit | 정확성 | `malgn-agent/skills/domain-training-scorecard-eval/scoring-procedure.md:71` | 변경 전후 문장 Read | 삽입으로 한 문장 안 괄호가 3중으로 겹쳐 가독성이 떨어진다. 같은 커밋의 RV-104가 "괄호 다항 문장의 어색함"을 푸는 작업인데 방향이 반대다 | 괄호를 문장 뒤 별도 한 줄로 분리 |
| RV-05 | ⚪ Nit | 정확성 | `record-parameters.md:24`, `scoring-procedure.md:71` | hub 도구 스키마 원문 로드(`agent_get_context`) | 스키마상 `scoreHistoryLimit`은 **optional**(min 1 / max 50)이고 `latestScore`는 `scoreHistory`와 별개 최상위 필드다 — 즉 파라미터를 아예 생략해도 `latestScore`는 온다. "1이면 충분하다"는 틀리지 않으나 필수처럼 읽힐 여지가 있다(스키마 설명 기준 판정, 실호출 미검증) | "생략해도 되며, 명시한다면 최소값 1로 충분하다" 정도로 |

## 기각된 지적

| 관점 | 지적 요지 | 처리 | 사유 |
|---|---|---|---|
| 이식성 | `hooks/sessionstart-context.mjs:21` "(2026-08-24 추가)" 날짜 도장이 항구 규칙 [이력 금지] 위반 | **기각** | 두 근거 모두 성립: ⓐ 규칙 선언 스코프가 "`agents/`·`skills/`·`knowledge/` 본문"이라 `hooks/`가 포함되지 않고, ⓑ 이번 커밋이 그 줄을 편집하지 않았으므로 "기존 잔존분 = 변경 동결 백로그"에 해당(CLAUDE.md [적용 범위]). trainer의 스코프 밖 판정은 타당하다 |
| 이식성 | 새 주석의 외부 URL 4개가 페르소나 [권장] 기준(2개 이하)을 초과 | **기각** | 4개가 각각 다른 사양 주장 1건씩을 뒷받침하고, "인용문 원문 + 공개 URL/앵커"는 린터 자신이 제시한 처방(`check-install-reachability.mjs:312`)이다 |
| 정확성 | `hooks/sessionstart-context.mjs:51` "분량(실측 1,221자)"이 자사 실측치 유출 | **기각** | 이번 diff의 추가줄이 아니라 재줄바꿈된 context 라인이다(`git diff -U0` 확인). 선재 항목이라 이번 라운드 스코프 밖 |
| 정확성 | trainer가 잔존 날짜 도장을 "`:18`"로 보고했는데 실제 파일에서는 `:21` | **강등(Nit 미만, 보고서 본문 미등재)** | 자기 커밋이 앞에 3줄을 추가해 밀린 것으로, base 기준으로는 정확하다. 산출물 결함이 아니라 보고 문구의 기준선 표기 문제 |

## 페르소나별 관점

### [하네스 공식문서 사실검증관] — 판정: 🟠 Amber
사양 주장 대조표 — `원문 미확인` 0건, 수치 불일치 0건(신규 인용 한정):

| # | 우리 문장 (`sessionstart-context.mjs`) | 미러 원문 (`docs/anthropic/hooks/hooks.md`) | 판정 |
|---|---|---|---|
| 1 | `:14` "exit code 2 표가 SessionStart 행을 Can block? No / Shows stderr to user only로" | `:871` `` | `SessionStart` | No | Shows stderr to user only | `` | 일치 |
| 2 | `:15` "JSON 출력 표가 Context only … No blocking or decision control로" | `:1024` "Context only … No blocking or decision control" | 일치 |
| 3 | `:41-43` "Hook output strings, including `additionalContext`, `systemMessage`, and plain stdout, are capped at 10,000 characters. Output that exceeds this limit is saved to a file and replaced with a preview and file path" | `:913` 동일 문장(뒤 `[Output limits]` 참조절만 절단, 의미 손실 없음) | 일치 |
| 4 | `:47-48` "When several hooks return `additionalContext` for the same event, Claude receives all of the values" | `:993` 동일 문장 | 일치 |

앵커 4개 전부 실재 heading으로 확인: `#exit-code-2-behavior-per-event`(`:848`) · `#decision-control`(`:1007`) · `#json-output`(`:903`) · `#add-context-for-claude`(`:970`). base URL `https://code.claude.com/docs/en/hooks`는 `scripts/sync-anthropic-docs.mjs:28`의 미러 원천과 동일 도메인·경로.
trainer의 "줄번호가 이미 다 드리프트해 있었다"는 주장도 **실측 확인**: 892→913, 971→993, 1001→1024, 852는 이제 표 헤더행. 즉 A-2는 정당한 결함 수정이었다.
평가기준 합격선(미확인 0 / 수치 불일치 0)은 신규 인용에 대해 통과. Amber 판정 사유는 오직 RV-01(잔존 2건).

### [제품 본문 이식성 감사관] — 판정: 🟢 Green
| 패턴 | 히트(추가줄) | 판정 |
|---|---|---|
| `\b[0-9a-f]{8}\b` · 26자 ULID | 0 | 신규 유입 없음 |
| `v\d+\.\d+\.\d+` · `20\d\d-\d\d-\d\d` · 이전엔/예전엔/직전 라운드/이관/폐기 | 0 | 신규 유입 없음 |
| `docs/`·`scripts/` 저장소 전용 경로 인용 | -3 (제거) | **순개선** |

`git diff -U0`의 `+` 줄만 대상으로 grep했다. 이번 라운드는 이식성을 **깎지 않았고 오히려 개선**했다 — 번들되지 않는 `docs/anthropic/...` 인용 3건이 설치 직원도 열 수 있는 공개 URL로 교체됐고, `knowledge/review/persona-*.md`(소스 clone 표기·글로브)가 `${CLAUDE_PLUGIN_ROOT}/knowledge/review/`(설치본에서 치환되는 규약 형태, §1-2 준수)로 바뀌었다.
정독 2회차에서 grep에 안 잡히는 유출(자사 상황 서술)도 확인하지 못했다.

### [죽은 참조 스코프 도전자] — 판정: 발산형(RAG 미부여), 반증 1건 성공
아래 Rethink 섹션 참조.

## 구조적 제언 (Rethink) — 발산형 페르소나 🔵

| # | 현재 구조 | 제안 구조 | 왜 더 나은가 | 예상 비용/리스크 |
|---|---|---|---|---|
| RT-01 | 죽은 인용 탐지 스코프가 **형태**로 정의돼 있다 — `REPO_ONLY_ANCHORS`(`docs/`·`scripts/` 접두어)에 걸리는 토큰만 `NOT_BUNDLED_CITATION`으로 판정한다(`scripts/check-install-reachability.mjs:301-313`) | 판정면을 **목적**으로 옮긴다: "번들되지 않는 문서를 `<파일>.md:<줄번호>` 형태로 가리키는가". 접두어 유무와 무관하게 미러 파일명(`hooks.md`·`memory.md`·`sub-agents.md` 등 `docs/anthropic/**` 실물 파일명 집합)이 줄번호와 함께 등장하면 ERROR | 형태 기준이 놓친 실탐 2건이 실제로 생존 중임을 실측으로 반증했다(RV-01). 게다가 이 2건은 **린터가 ERROR 0을 찍어 "괜찮다"는 도장까지 받은** 상태다 — 같은 라운드가 반복될 경로가 열려 있다 | **저비용**(근거: 해당 판정 분기와 `LOOKS_LIKE_FILE` 정규식이 `:142`에 이미 실재하고, 미러 파일명 집합은 `sync-anthropic-docs.mjs:35`의 `SOURCES` 배열에서 그대로 조달 가능 — 두 파일을 열어 확인함). **변경 동결 기준으로는 "개선"이라 백로그 대상** |
| RT-02 | "죽은 안내판" 수리가 글로브(`persona-*.md`)를 디렉터리(`knowledge/review/`)로 낮춰 린터를 통과시켰다 | (a) 현 수정 유지 + (b) 안내판이 여전히 "빈손"인 상태를 사람이 알 수 있게, 승격 자산이 0개일 때만 참인 사실 서술을 되살리거나 린터가 "확장점 디렉터리는 비어 있을 수 있음"을 알게 한다 | 종전 문장은 "**현재 승격된 자산은 없다**"고 사실을 말했고 reviewer는 그걸 읽고 넘어갈 수 있었다. 새 문장은 "디렉터리를 열어 확인한다"로 바뀌어, 실제로 열어보면 `reviewer-personas.md` 하나뿐이라 **매 리뷰마다 같은 빈손을 다시 확인하는 절차**가 생겼다(정보 이득 0). 즉 린터 ERROR는 사라졌으나 안내판을 따라간 사람의 결과는 그대로다 | **트레이드오프 있음** — 되살린 사실 서술은 승격이 일어나면 곧바로 거짓이 되는 드리프트면이라, trainer가 뺀 판단에도 근거가 있다. **대안 "안내판 3개 삭제"는 부적합**: `agents/trainer.md:68`·`:72`가 그 디렉터리를 모드 5 자산화 목적지로 명시하고 있어 고아 참조가 된다(두 줄을 실제로 열어 확인). 결론적으로 **현 수정이 최선에 가깝다** — 남는 것은 RT-01뿐 |

## 트레이드오프 (페르소나 간 충돌)
- **정확성 vs 이식성 (RV-01 처방)** — 사실검증관은 "줄번호를 정확한 값으로 갱신"을 원하고, 이식성 감사관은 "줄번호 자체가 설치 직원이 못 여는 근거이므로 지우고 원문 인용/앵커로"를 원한다. → **권고: 이식성 쪽.** 미러가 재동기화될 때마다 줄번호는 다시 썩는다는 것이 이번 라운드에서 실증됐다(892→913). A-2에 적용한 처방을 `:79`·`:183`에도 그대로 적용하는 것이 일관적이다.
- **RT-02의 사실 서술 복원 vs 드리프트 회피** — 발산형은 "빈손 사실을 명시"를, 이식성 감사관은 "상태 서술은 곧 이력이 되어 썩는다"를 든다. → **권고: 현 상태 유지.** 승격 자산이 생기면 자동으로 참이 되는 현재 문장이 드리프트 비용이 더 낮고, 정보 손실은 "디렉터리 한 번 열기"로 회복 가능한 수준이다.

## 잘 된 점
- **인용 처방이 모범적이다.** `NOT_BUNDLED_CITATION` 3건을 "지우기"가 아니라 "원문 문장 + 공개 URL 앵커"로 바꿨다 — 린터가 권고한 그대로이고, 4건 전부 원문과 문자 일치했다. 근거를 없애지 않으면서 이식성을 얻은 사례로, 다음 라운드의 기준으로 쓸 만하다.
- **스코프 이탈 0.** 선언한 7파일 = 실제 변경 7파일(`git diff --stat` 대조). 변경 동결 모드에서 요구되는 규율을 지켰다.
- **자기 불확실성을 숨기지 않았다.** RV-104에 대해 "원 지적과 동일 문장이라는 증명 불가"를 스스로 적었다. 이 정직 보고가 없었다면 이번 리뷰는 그 변경을 검증 대상으로도 인지하지 못했을 것이다.
- **회귀 없음.** `check-links` ERROR 6→0인데 WARN은 9→9로 불변, `check-assets` ERROR 0 유지. 에러 하나를 없애려고 다른 경고를 만들어내지 않았다.
- **`scoreHistoryLimit=1` 권고는 스키마 정합**(min 1, `latestScore`는 별개 최상위 필드). 기억이 아니라 실제 응답 구조에 맞춰 적었다.

## 평가기준 충족 현황
| 기준 | 관점 | 중요도 | 충족 | 비고 |
|---|---|---|---|---|
| 사양 주장 표에 `원문 미확인` 0건 | 정확성 | 필수 | ✅ | 신규 인용 4건 전부 원문 확인 |
| 원문과 수치 불일치 0건 | 정확성 | 필수 | ⚠️ | 신규 인용은 0건이나 잔존 2건 불일치(RV-01) |
| 조건절 탈락으로 적용범위가 넓어진 서술 없음 | 정확성 | 필수 | ✅ | 4건 모두 원문 범위 내 |
| 식별자 grep 0건(백틱 앵커 없이) | 이식성 | 필수 | ✅ | 추가줄 대상 0건 |
| 날짜·버전 패턴 0건 또는 규칙 내용임이 증명 | 이식성 | 필수 | ✅ | 추가줄 0건, 잔존분은 스코프 밖 판정 |
| 자사 실측치·배선 유출 0건 | 이식성 | 필수 | ✅ | 추가줄 0건 |
| `check-links`·`check-assets` ERROR 0 | 공통 | 필수 | ✅ | 워크트리에서 직접 재실행 |
| 발산형 대안 제시(대안 없는 부정 금지) | 발산 | 필수 | ✅ | RT-01·RT-02 모두 대안 구조 + 근거 있는 비용 라벨 |

## PM에게 권고

1. **RV-01(🟠)만 trainer에 반환해 이번 라운드 안에서 닫는다.** 같은 파일 `:79`·`:183` 두 줄이며, A-2와 동일한 처방(줄번호 제거 + 절 이름/앵커)을 적용하면 된다. 이 라운드의 목적이 "죽은 인용 정정"인데 같은 파일에 같은 병이 남는 것은 [변경이력 관리 원칙]이 경고하는 "정본만 고치고 참조처를 놓쳐 다음 라운드에 새 결함처럼 재등장"하는 경로다.
2. **RV-02·RV-03(🟡)은 같은 반환에 묶어도 좋다** — 각 1줄 국소 수정이고 변경 동결의 "오탈자·작은 수정" 범주다. RV-04·RV-05(⚪)는 판단에 맡긴다.
3. **RV-104 처리 판단에 대한 답**: trainer의 방식(패턴 재검색 → 후보 특정 → 증명 불가 명시)은 **자의적 재해석이 아니라 근거 있는 판단**이다. 지목한 `evaluator.md` 자기검증 "회차 기록" 줄은 실제로 "괄호 안 3항 나열 + 괄호 밖 술어와의 어색한 겹침"을 갖고 있어 원 지적의 서술과 형태가 부합한다. 다만 **결과물은 절반만 해결됐다**(RV-03 — 3분할 후에도 셋째 질문의 지시대상이 모호). 그리고 원 지적 대상이 확정되지 않은 채 본문을 고친 것은 변경 동결의 "지금 무엇이 깨져 있는가"에 정면으로 답하기 어려운 변경이므로, **앞으로는 "원문 대조 불가 지적은 본문을 고치지 않고 '대상 소실'로 닫은 뒤, 동일 패턴 전수 스캔 결과를 별도 이슈로 연다"**는 규칙을 두는 편이 낫다(RT-02 계열 제언, 백로그).
4. **날짜 도장 미수정은 정당하다** — 규칙 스코프(`hooks/` 미포함)와 [적용 범위](미편집 잔존분=백로그) 두 근거로 확인했다. 재작업 지시 불필요.
5. **RT-01(린터 판정면 확장)은 백로그로 이관한다** — 변경 동결 기준으로 "개선"이며, 다만 RV-01이 그 부재로 생긴 실탐이라는 점은 백로그 항목에 근거로 함께 적어두길 권한다. 비용 라벨 "저비용"은 관련 분기(`check-install-reachability.mjs:142`, `sync-anthropic-docs.mjs:35`)를 실제로 열어 확인한 값이지 추정치가 아니다.

## 생략한 것 (정직 보고)
- **화면 캡처 없음** — 대상이 전부 MD/mjs 텍스트라 UI 산출물이 없다. `docs/screenshots/` 근거는 이번 리뷰에 해당 사항 없음.
- **hub 도구 실호출 미수행** — `agent_get_context`는 스키마 원문만 로드해 대조했고 실제 호출로 응답 형태를 확인하지는 않았다(RV-05의 "생략해도 `latestScore`가 온다"는 스키마 설명 기준 판정).
- **RV-104의 원 지적 원문 미확보** — hub 이슈 원문을 조회하지 않고 PM 위임문에 인용된 요지("괄호 3항 문장 어색함")만으로 판정했다. 따라서 "원 지적과 동일 대상인가"는 여전히 미증명이며, 위 권고 3은 그 전제 위에 있다.
