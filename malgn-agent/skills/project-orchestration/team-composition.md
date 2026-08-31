# §3. 팀 구성 원칙

> Skill `project-orchestration` §3의 본문이다. 색인은 `skills/project-orchestration/SKILL.md`에 있다(이 파일을 열라고 지시한 그 파일이며 이미 로드돼 있다).
> 이 파일에서는 `CLAUDE_PLUGIN_ROOT` 변수가 치환되지 않는다 — 플러그인 자원을 실제로 열거나 실행하는 지시는 색인 쪽에 둔다.

- **업무 유형 → 최소 팀 구성** (과다팀 금지). 웹개발: planner→architect→ux-designer→backend/frontend-dev→qa-engineer→devops (각 단계별 reviewer 검증). **ux-designer는 화면이 하나 신설되거나 기존 화면의 기능이 변경/추가되면 기본 투입**한다(예외는 Skill `common-task-grading-and-verification-depth`의 Micro 등급뿐 — 단순 문구·CSS·오타 수정 등). visual-designer는 ux-designer 산출물의 판단에 따라 조건부 투입된다(상세: §3.5). 단일 엔드포인트/필드 수준의 소규모 변경(설계 변경 없이 기존 아키텍처 내 필드 추가 등)은 architect/planner 단계를 생략하고 backend-dev→frontend-dev→qa-engineer로 축소한다. 신규 아키텍처 결정이 필요할 때만 architect를 포함한다.
- **보안 단계 배치**: 개발·구현 중에는 security를 게이트로 돌리지 않는다 — 보안 리뷰가 게이트를 양산해 개발을 막는 것을 방지. security는 개발 중 "아주 심각한 Critical"만 즉시 올리고 나머지는 `docs/security-plan.md`에 적재만 한다. **정밀 보안 점검·보안계획 실행은 배포 직전 최종 운영 테스트 단계에서, 사용자 승인(Sensitive/Refactor급 상당 — malgnai-hub 연동판에서는 세션 내 `AskUserQuestion` 등으로 직접 확인) 후에만** 착수한다(security.md 운영 정책과 정합).
- **권위자 매핑**: architecture=architect, requirements/prd=planner, src=backend/frontend-dev, 문서=writer, 발표=presenter, 리뷰=reviewer, 에이전트MD/knowledge 초안=trainer, 전역 자산(에이전트/스킬/knowledge) 채점·판정·승격=evaluator.
- **전역 자산 승격 트랙에서만: evaluator·reviewer를 항상 병렬로 소집한다**. 적용 범위는 malgn-agent 전역 자산(에이전트/스킬/knowledge)의 trainer 초안 → 판정 → 승격 흐름뿐이다 — 일반 웹/앱·제안서 등 프로젝트 산출물의 검증은 reviewer 단독이고 evaluator는 부르지 않는다(evaluator는 전역 자산 승격 파이프라인에만 국한된다). 이 트랙 안에서 둘은 같은 초안을 서로 다른 관점으로 본다: reviewer는 산출물 자체의 결함·품질을, evaluator는 등급 기준 충족과 승격 가능 여부를 판정한다. 한쪽 결과가 다른 쪽의 입력이 아니라 순서를 강제할 이유가 없으므로, 순차로 돌려 대기 시간을 두 배로 만들지 말고 같은 턴에 동시에 소집한다. 두 결과가 엇갈리면 그 차이 자체를 판단 재료로 쓴다(먼저 온 쪽 결론으로 나중 쪽을 미리 재단하지 않는다).
- **공유 가정 주입**: 여러 에이전트가 같은 수치(마진율·CAC)를 쓸 때, 위임 전에 PM이 값을 고정해 동일하게 주입.
