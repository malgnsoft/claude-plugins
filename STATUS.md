---
provider: malgnai-mcp
project_id: e3c8eba1-7016-4c40-81fc-7d15cdcefd75
---

# STATUS — claude-plugins
_최종 갱신: 2026-08-10 (PM 블록 @import 전환 완료 + v1.2.0 배포 + 직원 토큰사용 진단 스크립트 bin/analyze-usage.mjs 신설)_

> **claude-plugins** = 클로드코드 플러그인
> **새 세션은 이 파일(라이브 상태) + `CLAUDE.md`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-mcp `get_current_context`, 깊은 문서는 `docs/README.md`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

## 🟢 현재 상태
- **malgn-agent v1.2.0** (agents 21·skills 34+1리뷰대기·knowledge 49·hooks 4). 2026-08-07 방법론 rubric 기반 전면 재구축(v1.0) 이후 지속 개정 중. `/plugin marketplace add hopegiver/claude-plugins` → `/plugin install malgn-agent@malgnsoft-plugins` **실제 설치·업데이트 사이클을 로컬 재현으로 검증 완료**(마켓플레이스 clone 갱신 → plugin.json 버전 bump → `claude plugin update` → 새 캐시 반영까지 end-to-end 확인). 단, userConfig 디바이스토큰 입력·malgnai-hub 실제 MCP 호출은 아직 미검증.
- 이 착수 이전 기준선: `malgn-agent` 플러그인 1차 구현(marketplace.json에 등록됨). `malgn-danny`는 폐기, `malgn-djkim`/`malgn-dotype`은 아직 미착수.

## ✅ 최근 완료
- **PM 블록 전파방식 @import 우선+훅 드리프트가드 전환 완료 + v1.2.0 배포 (2026-08-10, WBS `524b6650` 완료, decision `c0cea472`, commit `04e5819`)**: architect 설계(`docs/decision/pm-orchestration-block-import-design.md`) → backend-dev 구현(`pm-orchestration-nudge.mjs`: `findMalgnAgentBlockPath`/`readExternalImportState`/`AMBIGUOUS` 센티널 신설) → reviewer 3인 페르소나 풀패널이 8개 시나리오 직접 실행검증(GO-with-fix, Critical 0/Major 1[문서만]/Rethink 1) → PM이 Major(설계문서 §4 `AMBIGUOUS` 분기 누락 — 반영 안 하면 향후 리팩터 시 Symbol→string TypeError로 안전망까지 침묵실패) 즉시 반영. `hooks.json` 무변경·`sync-strategy.md` 이력보존 실측 확인. 산출물: `docs/reviewer/review-pm-import-implementation-2026-08-10.md`. 이 저장소 자신의 CLAUDE.md는 구버전 마커(`installed:v1`, import줄 없음) 상태라 다음 세션에 훅이 자동으로 `@import` 마이그레이션을 유도함(별도 조치 불필요). Rethink(발산 페르소나 — 3중 레이어 대신 하이브리드 요약문 재조명)는 다음 개정 후보로 보류.
- **직원 토큰 과다사용 진단 도구 → malgn-agent 정식 스킬로 전환 (2026-08-10, decision `9d9e03f8`, memory `4436b26a`, commit `1f4e0ee` on branch `trainer/token-usage-diagnosis-skill-20260810`)**: 처음엔 저장소 운영용 1회성 스크립트(root `bin/`, 직원 미배포)로 시작 → 각 직원 로컬 로그는 그 PC에서만 읽을 수 있어 구조적으로 셀프서비스 도구가 될 수 있다고 판단, `malgn-agent/bin/analyze-usage.mjs`로 이동 + 이를 감싸는 스킬 `token-usage-diagnosis`(무접두어, pm.md만 참조) 신설 — trainer 작성, "스크립트가 계산한 수치만 신뢰하고 숫자·원인을 새로 지어내지 않는다" 제약 명시. Claude Code 로컬 세션 JSONL(`~/.claude/projects/**/*.jsonl`)의 usage 필드를 직접 분석(중앙 OTel 로그의 duration_ms보다 정밀), 무의존성이라 Windows/macOS 동일 실행. **전 직원 배포 대상이라 reviewer 검증 전 단계** — main 미병합.
- **claude-plugins 자체 CLAUDE.md에 PM 블록 설치 + 넛지→AskUserQuestion→Edit 플로우 실사용 검증 (2026-08-10, decision `0eb2b270`)**: 사용자에게 훅 동작(hooks.json 3개, SessionStart 2단계, 마커 기반 installed/declined 상태전이) 설명 후 AskUserQuestion으로 설치 동의 확인 → `installed:v1` 마커 추가. 로컬 재현이 아닌 **실제 세션에서의 최초 실사용 검증**.
- **PM 오케스트레이션 블록: 복사 방식 → 훅 상시주입 방식 전환 + v1.1.0 배포 (2026-08-10, decision `5da7f043`, commit `7b9a197`+`5e466c0`)**: CLAUDE.md엔 동의/버전 마커만 남기고 훅이 매 세션 `pm-orchestration-block.md`를 디스크에서 읽어 상시 주입 — stale copy가 구조적으로 발생 불가. architect 설계 → reviewer 검증(GO-with-fix, Major 2건: 구버전마커 미인식·전환시 마커잔존) → backend-dev 수정 반영 확인. **plugin.json 버전을 안 올리면 이미 설치한 사용자에게 반영 안 되는 걸 로컬 재현으로 발견**해 1.0.0→1.1.0 bump 및 실제 배포까지 검증 완료. 산출물 `docs/decision/pm-orchestration-block-sync-strategy.md`, `docs/reviewer/review-pm-orchestration-block-sync-2026-08-10.md`.
- **⚠️ 위 훅 상시주입 방식이 재검토로 회귀(regression)로 판명 (2026-08-10, decision `3d237511`)**: 사용자가 "2026-08-09 결정(CLAUDE.md 직접기재, 정체성 지속성 근거)을 재검토 없이 되돌린 것 아니냐"고 지적. reviewer(페르소나+웹검색)·trainer 교차검토 결과 회귀는 실재(훅 additionalContext는 대화 히스토리 쪽이라 장시간 세션에서 compaction 시 탈락 위험, CLAUDE.md 본문/@import는 시스템프롬프트 편입이라 그 위험이 없음) — 다만 처방은 reviewer(하이브리드: 핵심지시문 직접기재+상세본문 훅주입) vs trainer(@import 우선+드리프트가드로 경로리스크 보완) 로 갈림. **사용자가 trainer안 채택** → architect에게 @import 전환 설계 위임(WBS `524b6650`). 산출물 `docs/reviewer/review-pm-block-propagation-mechanism-2026-08-10.md`.
- **frontend-dev.md vue-zero 기본값 분리 (2026-08-10, decision `2980f316`, commit `7675776`)**: 실제 프레임워크 판별 규칙 신설 + vue-zero 특유 규칙 조건화 + CDN 로드 섹션 추가.
- **agents/*.md 스킬 참조 표기 이름만으로 통일 (2026-08-10, decision `4adb2750`, commit `a3c2c1b`)**: 10개 파일에서 경로 병기 제거.
- **PM 행동규율 블록 내용 개정 (2026-08-09, decision `5015781d`, commit `aa32bcc`)**: 판단품질 포인터 1개 추가 + 압축(634자→603자).

## 🚧 진행 중 / 다음
- **병행 후속 후보(비차단)**: `verifiable-output-and-honesty` skill description에 PM/메인세션 named audience 추가 — trainer 검토 권고. PM 블록 전파방식 3중 레이어 대신 하이브리드(요약문 물리기재) 재조명 — reviewer 발산형 페르소나 제기, 다음 개정 사이클 후보.
- **미검증**: malgnai-hub userConfig 디바이스토큰 입력 플로우 + 실제 MCP 호출 정상 동작(설치 메커니즘 자체는 검증 완료, 이 부분만 남음).
- `malgn-djkim`, `malgn-dotype` — 빈 디렉토리만 생성됨, 각 담당자가 채운 뒤 marketplace.json에 등록 필요

## ⛔ 막힌 것 / 열린 이슈
- 없음 (오늘 이슈 2건 모두 해소: `7d2bcdd6`/`80c297cd`)
