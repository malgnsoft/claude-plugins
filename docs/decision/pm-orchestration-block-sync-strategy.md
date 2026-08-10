# PM 오케스트레이션 블록 최신화 전략 — 설계 검토

> **[대체됨]** 이 결정은 `docs/decision/pm-orchestration-block-import-design.md`(2026-08-10)로 대체됨 — `@import` 우선안 채택. 아래 본문은 이력 보존을 위해 그대로 둔다.

- 작성: architect (2026-08-10)
- 대상 코드: `malgn-agent/hooks/pm-orchestration-nudge.mjs`, `pm-orchestration-block.md`, `hooks.json`
- 배경: 대상 프로젝트 CLAUDE.md에 블록 **내용을 복사**해 넣는 현 방식은 plugin 쪽 원문이 개정될 때마다 이미 설치된 프로젝트에 stale copy가 영구히 남는다. 버전 마커가 없어 재넛지도 안 된다.

## 로컬 실증으로 확인한 사실

| 항목 | 확인 결과 |
|---|---|
| 마켓플레이스 clone 경로 | `~/.claude/plugins/marketplaces/malgnsoft-plugins/...` — 버전 번호 없음, 세션 시작 후 백그라운드 `git pull`로 자동 갱신(공식 문서) |
| 로컬 디렉토리명 결정자 | `marketplace.json`의 **`name` 필드**(`malgnsoft-plugins`) — git repo 이름(`claude-plugins`)이 아님. 실제 설치로 확인 |
| 플러그인 런타임 캐시 경로 | `~/.claude/plugins/cache/malgnsoft-plugins/malgn-agent/1.0.0/...` — **버전 번호 포함**, `plugin.json`의 `version` 필드 기준(참고: `marketplace.json`의 plugin 엔트리 버전 `0.3.0`과 불일치 — 별건 이슈, 이번 결정과 무관하니 별도 확인 권고) |
| `${CLAUDE_PLUGIN_ROOT}` | `hooks.json`의 `command`에서는 정상 해석됨(실행 중 프로세스가 caches 경로를 안다). CLAUDE.md `@import` 문법에서는 지원 문서 없음 — 리터럴 경로만 가능 |
| `extraKnownMarketplaces`/`enabledPlugins` | `~/.claude/settings.json`에 실물 스키마 확인: `extraKnownMarketplaces.<name>.source.{source,repo}` + `enabledPlugins."<plugin>@<marketplace>": true` |

## 옵션별 평가

**(a) 복사+동의 유지 + 버전 마커**
- 장점: 자기완결적(마켓플레이스 미등록·오프라인·플러그인 삭제 후에도 CLAUDE.md만으로 동작), 구현 변경 최소.
- 단점: 근본 문제 미해결 — 매 개정마다 재넛지가 필요하고, 재넛지 전까지는 구조적으로 stale. "재넛지 피로"가 누적되면 결국 사용자가 대충 수락/거절하게 됨.

**(b) `@import`로 마켓플레이스 clone 경로 참조**
- 장점: 컨텐츠 복사가 완전히 사라짐 — 참조되는 순간 항상 최신(마켓플레이스 pull 주기 내).
- 치명적 실패 모드: 로컬 마켓플레이스 이름은 기본적으로 `marketplace.json`의 `name`으로 결정되지만, 사용자가 커스텀 별칭으로 등록하거나 사내 미러를 다른 이름으로 등록하면 **하드코딩된 리터럴 경로가 깨진다**(위 표에서 확인된 대로 `@import`는 환경변수를 지원하지 않아 우회 불가). 마켓플레이스가 아예 미등록이면 `@import`는 조용히 실패(파일 없음) — 오늘의 넛지처럼 "미설치 상태를 사용자에게 알리는" 안전장치가 사라져, 표준이 조용히 빠진 채로 세션이 진행될 위험이 있다. 외부 경로 참조라 최초 1회 승인 다이얼로그도 필요.

**(c) `extraKnownMarketplaces`/`enabledPlugins`로 플러그인 자동설치**
- 이것은 "PM 블록 최신화" 문제가 아니라 **"플러그인 자체를 팀 전체에 배포"** 문제를 푸는 별도 축이다. 신뢰(trust) 시점에 팀원에게 마켓플레이스+플러그인 설치를 자동 프롬프트하는 공식 경로로, malgn-agent 도입 마찰을 낮추는 데는 유효하지만 이것만으로는 대상 프로젝트 CLAUDE.md에 PM 행동규율이 반영되지 않는다 — 플러그인이 켜져 있어야 훅이 도는데, 그 훅이 지금처럼 "CLAUDE.md에 복사"를 계속한다면 (a)의 stale 문제가 그대로 남는다.

## 권고안 — (a)의 동의 흐름 + (b)의 "항상 최신" 아이디어를 훅 내부로 흡수한 조합

핵심 통찰: `pm-orchestration-nudge.mjs`는 이미 매 SessionStart마다 `pm-orchestration-block.md`를 **디스크에서 읽어** `additionalContext`로 주입하고 있다(현재는 "아직 동의 전"일 때만). 이 메커니즘을 최종 상태로도 그대로 쓰면 `@import`의 경로 하드코딩 문제 자체가 발생하지 않는다 — 훅은 `${CLAUDE_PLUGIN_ROOT}` 기준 상대경로로 자기 옆의 `.md`를 읽을 뿐, 마켓플레이스 이름·클론 경로를 전혀 몰라도 된다.

**변경안**:
1. CLAUDE.md에는 **동의 여부 마커만** 남긴다(`installed` 또는 `declined:vN`) — 블록 **본문은 절대 복사하지 않는다**.
2. `installed` 마커가 있으면, 훅은 매 세션 `pm-orchestration-block.md`를 디스크에서 읽어 `additionalContext`로 주입한다(오늘 넛지 단계에서 이미 하는 동작을 동의 후에도 계속하는 것뿐). → 플러그인이 업데이트되면 다음 세션부터 자동으로 새 본문이 주입된다. 별도 재넛지·버전 비교 로직이 필요 없다 — "복사본이 없으므로 stale copy 자체가 존재할 수 없다."
3. `declined:vN`이 있는 프로젝트만, 블록 본문에 **breaking 변경**이 있을 때(MAJOR 버전 bump) 1회 재넛지한다. 이건 (a)의 버전 마커 아이디어를 "거절자 재확인" 용도로만 축소 적용하는 것 — 수락자에게는 애초에 버전 추적이 필요 없다.
4. (c) `extraKnownMarketplaces`/`enabledPlugins`는 별도 트랙으로 채택 권고 — `new-project.mjs` 스캐폴드에 프로젝트 `.claude/settings.json` 템플릿으로 넣어, 신규 프로젝트 trust 시 malgn-agent 설치 자체의 마찰을 줄인다. 이것과 위 1~3은 서로 배타적이지 않고 보완적이다.

이 조합의 실패 모드 대응:
- **마켓플레이스 미등록**: 영향 없음 — 훅이 플러그인 자체 파일을 읽으므로 마켓플레이스 상태와 무관. 플러그인이 애초에 비활성화된 경우엔 훅 자체가 안 돌아 주입이 없다(= 표준 미적용을 사용자가 인지 못 할 위험은 (b)와 동일하게 남음 — 다만 이는 "플러그인이 꺼져 있다"는 상태이므로 (c) 트랙의 auto-install로 완화).
- **마켓플레이스를 다른 이름으로 등록**: 영향 없음 — 훅은 마켓플레이스 이름을 참조하지 않는다.
- **오프라인/사내 미러**: 마켓플레이스 pull이 실패해도 로컬 캐시에 있는 마지막 버전으로 계속 동작(점진적 저하, 즉시 파손 없음) — (b)와 동일하게 안전.
- **플러그인 삭제 후에도 CLAUDE.md에 아무 내용도 안 남는 것이 문제인가**: (a)처럼 자기완결적 백업 카피가 없다는 게 유일한 트레이드오프다. 플러그인이 사라지면 PM 행동규율도 사라지는 게 "설치된 플러그인의 표준을 따른다"는 모델과 일관적이므로 허용 가능한 손실로 판단.

## 트레이드오프 요약 (①의무)
- 선택: 훅 상시주입 + 마커만 CLAUDE.md 잔존
- 대안: (a) 전체 복사, (b) `@import` 경로 참조
- 포기한 것: CLAUDE.md 단독으로도 표준 내용이 보존되는 자기완결성(플러그인 제거 시 동반 소실)
- 감당 방안: 이 손실은 "플러그인이 곧 표준의 소스"라는 모델 자체의 자연스러운 결과이며, (c) 자동설치 트랙으로 플러그인 부재 상태를 줄여 완화
