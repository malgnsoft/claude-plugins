---
provider: malgnai-mcp
project_id: e3c8eba1-7016-4c40-81fc-7d15cdcefd75
---

# STATUS — claude-plugins
_최종 갱신: 2026-08-10 (PM 블록 훅 상시주입 전환 + v1.1.0 배포검증)_

> **claude-plugins** = 클로드코드 플러그인
> **새 세션은 이 파일(라이브 상태) + `CLAUDE.md`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-mcp `get_current_context`, 깊은 문서는 `docs/README.md`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

## 🟢 현재 상태
- **malgn-agent v1.1.0** (agents 21·skills 34·knowledge 49·hooks 4). 2026-08-07 방법론 rubric 기반 전면 재구축(v1.0) 이후 지속 개정 중. `/plugin marketplace add hopegiver/claude-plugins` → `/plugin install malgn-agent@malgnsoft-plugins` **실제 설치·업데이트 사이클을 로컬 재현으로 검증 완료**(마켓플레이스 clone 갱신 → plugin.json 버전 bump → `claude plugin update` → 새 캐시 반영까지 end-to-end 확인). 단, userConfig 디바이스토큰 입력·malgnai-hub 실제 MCP 호출은 아직 미검증.
- 이 착수 이전 기준선: `malgn-agent` 플러그인 1차 구현(marketplace.json에 등록됨). `malgn-danny`는 폐기, `malgn-djkim`/`malgn-dotype`은 아직 미착수.

## ✅ 최근 완료
- **PM 오케스트레이션 블록: 복사 방식 → 훅 상시주입 방식 전환 + v1.1.0 배포 (2026-08-10, decision `5da7f043`, commit `7b9a197`+`5e466c0`)**: CLAUDE.md엔 동의/버전 마커만 남기고 훅이 매 세션 `pm-orchestration-block.md`를 디스크에서 읽어 상시 주입 — stale copy가 구조적으로 발생 불가. architect 설계 → reviewer 검증(GO-with-fix, Major 2건: 구버전마커 미인식·전환시 마커잔존) → backend-dev 수정 반영 확인. **plugin.json 버전을 안 올리면 이미 설치한 사용자에게 반영 안 되는 걸 로컬 재현으로 발견**해 1.0.0→1.1.0 bump 및 실제 배포까지 검증 완료. 산출물 `docs/decision/pm-orchestration-block-sync-strategy.md`, `docs/reviewer/review-pm-orchestration-block-sync-2026-08-10.md`.
- **frontend-dev.md vue-zero 기본값 분리 (2026-08-10, decision `2980f316`, commit `7675776`)**: 실제 프레임워크 판별 규칙 신설 + vue-zero 특유 규칙 조건화 + CDN 로드 섹션 추가.
- **agents/*.md 스킬 참조 표기 이름만으로 통일 (2026-08-10, decision `4adb2750`, commit `a3c2c1b`)**: 10개 파일에서 경로 병기 제거.
- **PM 행동규율 블록 내용 개정 (2026-08-09, decision `5015781d`, commit `aa32bcc`)**: 판단품질 포인터 1개 추가 + 압축(634자→603자).
- **malgn-agent 전면 재구축 v2.0 (2026-08-07)**: 방법론 rubric 수립→전수감사→D1~D15 결정확정→재구축→독립검증 PASS. 상세는 `decision_list`, 산출물은 `docs/methodology/`.

## 🚧 진행 중 / 다음
- **병행 후속 후보(비차단)**: `verifiable-output-and-honesty` skill description에 PM/메인세션 named audience 추가 — trainer 검토 권고.
- **미검증**: malgnai-hub userConfig 디바이스토큰 입력 플로우 + 실제 MCP 호출 정상 동작(설치 메커니즘 자체는 검증 완료, 이 부분만 남음).
- `malgn-djkim`, `malgn-dotype` — 빈 디렉토리만 생성됨, 각 담당자가 채운 뒤 marketplace.json에 등록 필요

## ⛔ 막힌 것 / 열린 이슈
- 없음 (오늘 이슈 2건 모두 해소: `7d2bcdd6`/`80c297cd`)
