---
provider: malgnai-mcp
project_id: e3c8eba1-7016-4c40-81fc-7d15cdcefd75
---

# STATUS — claude-plugins
_최종 갱신: 2026-08-07_

> **claude-plugins** = 클로드코드 플러그인
> **새 세션은 이 파일(라이브 상태) + `CLAUDE.md`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-mcp `get_current_context`, 깊은 문서는 `docs/README.md`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

## 🟢 현재 상태
- **malgn-agent 전면 재구축 완료 (2026-08-07, 사용자 지시로 주말간 무확인 자율 진행 → 전 7단계 완주)**. 방법론 수립→전수감사→결정확정(D1~D15)→전면재구축→독립재검증(PASS)→Before/After 비교보고서·직원가이드 HTML 슬라이드 발행까지 하루 안에 완료. 산출물: `docs/methodology/`(방법론 rubric v1.0·감사보고서·결정로그·최종검증보고서), `docs/methodology/deliverables/`(슬라이드 2종, Artifact 발행 완료). malgn-agent v2.0 = agents 21·skills 34·knowledge 49·hooks 4.
- 이 착수 이전 기준선: `malgn-agent` 플러그인 1차 구현(marketplace.json에 등록됨). `malgn-danny`는 폐기, `malgn-djkim`/`malgn-dotype`은 아직 미착수.

## ✅ 최근 완료
- **malgn-agent 전면 재구축 v2.0 완료 (2026-08-07, 핵심 decision `171380f7`/`e9e5f924`/`b58d1fd8`/`10d4f378`)**: 방법론 rubric 수립→119개 파일 전수감사→D1~D15 결정확정→전면재구축(agents/skills/knowledge/hooks 전체)→독립 재검증 PASS→비교보고서·사용가이드 슬라이드 발행. 상세 이력은 `decision_list`로 조회(오늘자 decision 다수), 산출물은 `docs/methodology/`
- **오케스트레이션 트랙(pm/evaluator/trainer) 재설계**: 승격 파이프라인을 실행 불가능하던 개인도구 의존에서 git PR 기반 절차로 전면 교체
- **agents 21개 COO→PM 전사 치환 + 보안스킬 재편 + screen-verification 도구 재작성 + knowledge 정리(retire7/merge2/rewrite9) + 스킬 15종 명명규칙 재정비** 모두 완료, 최종 COO/개인경로/미번들도구 실질 잔존 0건
- `malgn-dev` → `malgn-agent` 리네임 (2026-08-07)
- "초기화 해줘" 인플레이스 초기화 지원 + STATUS.md YAML frontmatter 전환 (2026-07-29, decision `018f6481`)

## 🚧 진행 중 / 다음
- **다음 세션 시작점**: malgn-agent v2.0(agents 21·skills 34·knowledge 49·hooks 4)은 완성됐으나 **실제 클로드코드 세션에서 설치 검증은 아직 안 됨** — `/plugin marketplace add hopegiver/claude-plugins` → `/plugin install malgn-agent@malgnsoft-plugins`로 실제 로드되는지, userConfig 디바이스토큰 프롬프트·malgnai-hub 실제 호출이 정상 동작하는지 확인 필요
- git 커밋/푸시 여부 확인 필요 — 오늘 재구축한 방대한 변경분이 아직 커밋되지 않았을 수 있음(세션 종료 전 `git status`로 확인)
- `malgn-djkim`, `malgn-dotype` — 빈 디렉토리만 생성됨, 각 담당자가 채운 뒤 marketplace.json에 등록 필요

## ⛔ 막힌 것 / 열린 이슈
- 없음 (오늘 재구축으로 기존 열린 이슈 3건 모두 해소: `929edddc`/`c3ef5744`/`f1913b79`)
