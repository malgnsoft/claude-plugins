---
created: 2026-08-12
author: reviewer
status: final
tags: [reviewer, standard, script-based-skills]
---

# 리뷰: script-based-skills-batch-20260812 (Standard 등급 약식 검증)

## 스코프 / 등급
- 대상: 브랜치 `trainer/script-based-skills-batch-20260812` (main=`ecb2964` 기준)
- 등급: **Standard (약식)** — PM 명시. 풀 페르소나 패널·발산형 미투입, 페르소나 1개 재사용.
- 범위: 5개 SKILL.md 개정 + 대응 `bin/*.mjs` 5개 신설. `git diff main..trainer/script-based-skills-batch-20260812 --stat` 확인 결과 정확히 10개 파일(SKILL.md 5 + bin/*.mjs 5) — 스코프 외 변경 없음.

## 페르소나 재사용/신규 표
| 페르소나 | 재사용/신규 | 사유 |
|---|---|---|
| persona-script-skill-consistency-auditor.md | 재사용 | INDEX.md에 이미 존재(token-usage-diagnosis-skill/1차 생성). "문서 서술(옵션·임계값·근거) ↔ 코드 구현 일치 여부"라는 역할개념이 이번 배치(SKILL.md ↔ bin/*.mjs 5쌍)에도 문자 그대로 적용 가능해 신규 작성 없이 재사용. 파일 하단 "적용 이력"에 이번 라운드 항목 추가, INDEX.md "최근 재사용" 열 갱신 완료. |

발산형 페르소나: Standard 등급 규정에 따라 생략(약식 리뷰, 발산형 생략 가능 조항 적용).

## 검증 절차 및 결과

### 1. 문법 + 실행 검증 (5/5 스크립트)
`node --check` 전원 통과. 전부 순수 Node 내장 모듈(`node:fs`/`node:path`/`node:child_process`)만 import — npm 의존성 없음(요구사항 4 충족).

| 스크립트 | `--check` | 실행 검증 |
|---|---|---|
| check-output-conventions.mjs | OK | 인자 없이 실행 → `docs/` 실스캔, 하드위반 26건/확인필요 1건 정상 출력. `--help`, `--strict`(exit 1) 동작 확인. |
| diff-env-keys.mjs | OK | `--help` 확인. 합성 monorepo(service-a/service-b, 누락 키·빈 값·정상 케이스 혼합)로 실행 → 누락/빈값/정상을 정확히 구분, exit code(0/1) 일치. |
| calc-training-scorecard.mjs | OK | `--help` 확인. SKILL.md 예시 JSON 그대로 실행 → 가중합 수동 재계산(78×0.6+70×0.25+80×0.1+80×0.05=76.3) 일치. 잘못된 입력(배점 상한 초과) 시 ValidationError로 명확히 거부, exit 1 확인. |
| check-wbs-warnings.mjs | OK | `--help` 확인. 8개 신호 중 6개를 유발하는 합성 WBS JSON으로 실행 → SKILL.md 체크리스트 표 8행과 1:1 대조, 판정 근거·심각도·exit code(High 존재 시 2) 모두 일치. `--previous` 미제공 시 "롤업 추락" 신호를 스킵하고 사유를 명시하는 것도 확인. |
| check-edge-api-security.mjs | OK | `--help` 확인. 합성 Hono 프로젝트(개별부착 누락 DELETE 라우트, fail-open 미들웨어, 무인증 /mcp 쓰기 도구, 동적 SQL, cors() 무인자, 민감 컬럼 스키마)를 만들어 실행 → **8단계 함정을 전부 정확히 탐지**(아래 5번 항목의 예외 1건 제외). |

### 2. SKILL.md 판단 영역 침범 여부 (요구사항 3)
5개 SKILL.md diff를 원문 대조한 결과, 전부 "결정론적 대조/집계는 스크립트, 정성 판단·최종 위험도·대응 결정은 사람/LLM"이라는 경계를 명시적으로 지키고 있음.
- `domain-serverless-edge-api-security`: description과 §7 본문에 "스크립트는 후보 탐지만, 최종 위험도 판단은 하지 않음"을 3곳(description, §7-2, §7-3)에서 반복 명시. STEP 8(원인→증폭 체인 서술)은 스크립트가 손대지 않고 콘솔 출력에서도 "이 단계는 자동화 대상이 아닙니다"로 명시.
- `domain-training-scorecard-eval`: "하위 정성 채점(0~100점 자체, Pass/Partial/Fail 판정, 감점 사유 관찰)은 그대로 evaluator의 판단 영역" — 스크립트는 그 결과값을 입력받아 집계만 함을 명문화. 실측(`calcBasicPerformance` 등)도 정성 점수를 받아 검증(상한 체크)·합산만 수행, 채점 로직 없음.
- `common-output-storage-and-path-management`: "스크립트가 '위반'이라 표시해도 최종 확정은 사람이 한다"를 본문 + 체크리스트 항목에 명시. 스크립트 자체도 출력 말미에 동일 문구 재출력.
- `domain-pre-deployment-verification-gate`: env key diff는 순수 결정론적 작업이라 판단 침범 소지 자체가 없음.
- `project-orchestration`: "PM은 스크립트 출력에서 걸린 항목만 골라 원인 조사·담당자 확인·재계획 같은 판단을 한다"로 경계 명시. issue_list/decision_list 교차 확인(비-WBS 소스)은 스크립트 범위 밖으로 명시적으로 제외.

판단 영역 침범 사례 없음.

### 3. 보안/평가 스크립트 false negative 정밀 점검 (요구사항 5)

**check-edge-api-security.mjs — 🟠 Major 발견**
STEP 4의 fail-open 탐지 정규식(`if\s*\(\s*!\s*([\w.]+)\s*\)\s*\{...\}`)이 **중괄호 블록 형태만** 매칭한다. 아래처럼 중괄호 없는 단일 문장 fail-open은 탐지하지 못함(합성 테스트로 재현 확인):
```js
export async function otherMiddleware(c, next) {
  if (!c.req.header('Authorization')) return next();  // ← 탐지 안 됨
  return next();
}
```
동일 파일 안에 중괄호 버전(`middleware/auth.js`)은 정상 탐지했으나, 이 브레이스리스(brace-less) 버전(`middleware/auth2.js`)은 STEP 4 출력에 전혀 나타나지 않음 — false negative 재현됨. fail-open은 인증 우회로 직결되는 가장 치명적인 패턴이라, 이 형태(JS에서 흔한 단축 리턴 스타일)를 놓치면 실사용 시 위험도가 있음. SKILL.md·스크립트 헤더 모두 "false positive/negative가 있을 수 있다"는 면책 문구는 있으나, 이 특정 갭은 흔한 코드 스타일이라 문서에 "브레이스 없는 단일문장 fail-open은 스크립트가 못 잡으니 §7-2에서 특히 수동으로 재확인"이라고 명시하는 편이 안전.
그 외 STEP 1~3, 5~7(개별부착 누락, 무인증 MCP 쓰기 도구, 동적 SQL 조합, cors() 무인자)은 합성 테스트에서 전부 정확히 탐지 — 실제 코드베이스(malgn-agent 자체, Hono 앱 아님)에 대해서도 오작동 없이 "해당 없음"류 메시지로 정상 처리됨.

**calc-training-scorecard.mjs — 특이사항 없음**
입력 검증(배점 상한, evalSet 판정값, successRate 정수/상한, costEfficiency 알 수 없는 키 거부)이 촘촘하고, 정성 채점 자체는 건드리지 않음. 가중합 산식도 SKILL.md 문구와 정확히 일치(수동 재계산 대조 완료).

### 4. 기타 관찰 (스코프 밖, 정보용)
`check-output-conventions.mjs`를 이 저장소 `docs/`에 실행했을 때 기존 `docs/reviewer/review-*.md` 13개가 "output/reports/ 경로 위계 위반"·"프론트매터 없음"으로 잡힘 — 이번 배치와 무관한 기존 드리프트이며 스크립트 결함이 아님(설계대로 정직하게 위반 후보를 잡아낸 것). PM/reviewer 운영진이 별도로 정리할지 판단 필요.

## 종합 판정: 🟡 Amber

Critical 없음. 배치 전체 설계 원칙(스크립트=결정론, 판단=LLM)은 5개 스킬 모두 일관되게 지켜졌고, 무의존성·문법·실행 검증도 전부 통과. 다만 보안 점검 스크립트(check-edge-api-security.mjs) STEP 4에서 실사용 빈도가 낮지 않은 코드 스타일(브레이스리스 단일문장 fail-open)에 대한 false negative가 실측으로 확인돼(🟠 Major) Green으로 올리지 않음. 병합 자체를 막을 정도는 아니나, STEP 4 정규식 보완 또는 최소한 SKILL.md/스크립트 출력에 이 한계를 명시하는 후속 커밋을 권고.

## 잘 된 점
- 5개 스킬 전부 "스크립트=결정론, 판단=사람/LLM" 경계가 설계뿐 아니라 코드·문서 양쪽에서 반복 명시됨(단순 선언이 아니라 실제로 판단 로직을 스크립트에 넣지 않음).
- 입력 검증(calc-training-scorecard.mjs)과 예외 처리(check-wbs-warnings.mjs의 필드 누락 시 "조용히 건너뜀" + skipped 로그)가 꼼꼼함.
- check-edge-api-security.mjs가 합성 취약 프로젝트에 대해 8개 함정 중 7개를 정확히 잡아낸 것은 실사용 가치가 실증됨.
- diff-env-keys.mjs가 모노레포(여러 .env.example) 케이스를 실제로 커버.

## PM 권고
1. check-edge-api-security.mjs STEP 4에 브레이스리스 `if (!x) return next();` 패턴 매칭 추가(또는 최소 "확인 필요" 경고를 STEP 4 자체가 아니라 SKILL.md에 한계 고지) — Major, 병합 전 또는 즉시 후속 커밋 권고.
2. 이번 배치 자체는 나머지 항목에서 병합 보류 사유 없음.
