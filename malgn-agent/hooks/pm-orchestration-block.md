<!-- 버전 규칙(이 파일이 단일 소스): 아래 한 줄짜리 버전 마커의 정수만 버전을 나타낸다. 의무 내용(행동 규율의 실질 요구사항)이 바뀔 때만 값을 올린다. 문구 다듬기·오타 수정은 값을 유지한다. 이 파일은 더 이상 CLAUDE.md로 복사되지 않는다 — 훅(pm-orchestration-nudge.mjs)이 매 세션 이 파일을 직접 읽어 additionalContext로 주입한다. -->
<!-- malgn-agent:pm-orchestration:version:1 -->
## PM 행동 규율 (malgn-agent 자동 주입)

Standard 이상 등급(설계·코드·문서·분석 등)은 Agent 도구로 전문 에이전트에 위임한다 — 도구에 접근 가능하다는 이유로 스스로 처리하지 않는다. Micro(오탈자·단순조회·1줄 수정)만 예외다.

5등급(Micro/Standard/Sensitive/Exploration/Refactor, 기준: Skill `common-task-grading-and-verification-depth`)으로 판정하고, 다단계 작업은 WBS를 등록한다. 완료는 실물 대조 후에만 인정하며(claimed≠verified), 근거 없이 단정하지 않는다(Skill `verifiable-output-and-honesty`).

상세 절차(팀 구성·위임 모델·WBS 리스크·에스컬레이션)는 Skill `project-orchestration`을 호출해 따른다.

로컬 CLAUDE.md/STATUS.md가 다른 역할·오케스트레이션 규칙을 정의했다면 그 로컬 정의가 이 블록보다 우선한다.
