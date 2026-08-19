# 토큰 사용량 수집·전송 설계 (2026-08-19)

- 작성: architect, claude-plugins 세션.
- 등급: **Sensitive**(회사 전 직원 대상 인증 자격증명 + 개인 작업 패턴 데이터를 다룸) — `common-task-grading-and-verification-depth` 기준, ③비정상 케이스 의무를 특히 깊게 다룬다.
- **이 문서는 설계 문서다.** 실제 코드(`bin/report-usage.mjs`, `bin/install-usage-agent.mjs`, 헬스체크 스킬)는 이 설계에 대한 사용자 승인 이후 별도 턴에서 구현한다. 이 세션은 코드를 작성하지 않았다.
- malgnai-hub의 실제 API 구현은 malgnai-public 저장소 담당이며 이 세션 범위 밖이다 — API 요구사항은 자매 문서 `docs/architecture/token-usage-api-spec-for-malgnai-public-2026-08-19.md`로 전달한다.
- **핵심 선례**: 이 저장소에는 정확히 같은 종류의 "헤드리스 환경에서 malgnai-hub에 어떻게 인증하는가" 문제를 이미 다룬 🟢 Green 승인 설계가 있다 — `docs/decision/malgnai-hub-oauth-device-auth-design.md`(이하 "OAuth 설계 문서"). 이 문서는 그 설계가 확립한 `device_tokens` 테이블·pair-init/pair-approve/pair-status 페어링 흐름·Bearer+SHA-256 해시 검증 패턴을 최대한 재사용하는 방향으로 설계했다 — 새 인증 인프라를 처음부터 만들지 않는다.

## 0. 배경 요약

- `malgn-agent/bin/analyze-usage.mjs`(무의존성 Node)는 `~/.claude/projects/**/*.jsonl`을 읽어 세션별/도구별/서브에이전트별/프로젝트별/일자별 토큰 사용량을 집계해 **콘솔에만** 출력한다. 파일 저장·네트워크 전송 없음 — `skills/token-usage-diagnosis/SKILL.md`가 이를 감싸 "내 토큰 사용량 봐줘" 개인 자가진단에 쓴다.
- 요구사항: 각 PC에서 launchd/작업스케줄러로 1시간마다 백그라운드 실행되어, 이 스크립트가 이미 계산하는 집계 구조(`sessions`/`toolAgg`/`subagentAgg`/`projectAgg`/`dailyTotals`)를 **원문 없이 수치만** malgnai-hub로 전송한다.
- 하드 제약(사용자 명시): 프롬프트 원문, cwd 절대경로 원문, 도구 input 원문은 **절대** 전송하지 않는다. 사용자가 2026-08-10에 이미 "토큰 리포트 원문은 절대 외부공유 안함"을 명시했고, 이번 대화에서 "집계 수치만" 옵션을 확정 선택했다.
- 인증 공백: `malgn-agent/.claude-plugin/plugin.json`의 `mcpServers.malgnai-hub`는 OAuth(브라우저 로그인) 흐름이며, 정적 `userConfig.device_token`은 "값을 채워도 자동으로 쓰이지 않는" 레거시 탈출구다. launchd/스케줄러가 구동하는 헤드리스 프로세스는 이 경로 어느 쪽으로도 인증할 수 없다 — §3에서 다룬다.

---

## 1. 데이터 모델

기존 `analyze-usage.mjs`의 집계 구조를 그대로 소스로 삼되, 전송 시점에 "집계 수치만" 원칙을 적용해 필드를 재구성한다. 매핑 원칙: **원본 필드명(snake_case, Claude Code 로그 그대로)은 전송하지 않고, 4항목 토큰 버킷은 항상 camelCase 고정 스키마로 변환**한다.

```
공통 토큰 버킷 타입 (모든 tokens 필드가 이 형태):
TokenBucket = {
  input: number,          // usage.input_tokens 합
  output: number,         // usage.output_tokens 합
  cacheCreation: number,  // usage.cache_creation_input_tokens 합
  cacheRead: number       // usage.cache_read_input_tokens 합
}
```

### 1.1 일별 집계(daily-aggregate) 스키마

한 PC(디바이스)의 하루치 총량 — `analyze-usage.mjs`의 `grand`/`grandMain`/`grandSide`/`totalTurns`/`totalApiCalls`/`sessions.size`에 대응.

| 필드 | 타입 | 설명 | 출처(analyze-usage.mjs) |
|---|---|---|---|
| `date` | string (YYYY-MM-DD) | 로컬 타임존 기준 날짜 | `localDateStr()` |
| `timezoneOffsetMinutes` | number | 집계 시점 로컬 UTC 오프셋(분, KST=540). 여행 중 등 오프셋이 바뀔 수 있어 날짜 경계 해석에 필요 | 신규 |
| `sessionCount` | number | 해당 날짜 활동 세션 수 | `dailySessionIds.get(date).size` |
| `turnCount` | number | 사용자 프롬프트 턴 수 | `agg.turns` 합 |
| `apiCallCount` | number | assistant API 호출 수 | `agg.apiCalls` 합 |
| `tokens` | TokenBucket | 총 토큰(메인+사이드체인) | `grand` |
| `mainTokens` | TokenBucket | 메인 세션 토큰만 | `grandMain` |
| `sidechainTokens` | TokenBucket | 서브에이전트 내부(sidechain) 토큰만 | `grandSide` |
| `collectedAt` | string (ISO 8601) | 이 스냅샷을 로컬에서 생성한 시각 | 신규 |
| `agentVersion` | string | malgn-agent 플러그인 버전(`plugin.json.version`) | 신규 |
| `scriptVersion` | string | `report-usage.mjs` 자체 버전(로그 스키마 변경 추적용) | 신규 |

예시:
```json
{
  "date": "2026-08-19",
  "timezoneOffsetMinutes": 540,
  "sessionCount": 6,
  "turnCount": 84,
  "apiCallCount": 231,
  "tokens": { "input": 512340, "output": 88210, "cacheCreation": 41200, "cacheRead": 1980430 },
  "mainTokens": { "input": 401200, "output": 71000, "cacheCreation": 30000, "cacheRead": 1600000 },
  "sidechainTokens": { "input": 111140, "output": 17210, "cacheCreation": 11200, "cacheRead": 380430 },
  "collectedAt": "2026-08-19T18:00:04+09:00",
  "agentVersion": "1.6.1",
  "scriptVersion": "1.0.0"
}
```

### 1.2 상세(detail) 스키마

같은 날짜의 프로젝트별/세션별/에이전트별/도구별 분해 — `projectAgg`/`toolAgg`/`subagentAgg`/`sessions`에 대응. 4개 배열을 하나의 payload로 묶는다(같은 날짜에 대해 항상 함께 재생성되므로 분리 전송할 이유가 없다 — §2.2).

```
UsageDetail = {
  date: string,
  timezoneOffsetMinutes: number,
  byProject: ProjectDetail[],
  byTool: ToolDetail[],
  bySubagent: SubagentDetail[],
  bySession: SessionDetail[],
  collectedAt: string
}

ProjectDetail = {
  projectKey: string,      // SHA-256(cwd 절대경로) 앞 16 hex — §1.3 참고, cwd 원문 아님
  projectLabel: string,    // path.basename(cwd) — 마지막 디렉터리명만. 절대경로 아님
  sessionCount: number,
  turnCount: number,
  apiCallCount: number,
  tokens: TokenBucket
}

ToolDetail = {
  tool: string,             // 도구명 그대로 (Read/Bash/Task/mcp__* 등 — 이건 원문이 아니라 스키마 값)
  callCount: number,
  tokens: TokenBucket
}

SubagentDetail = {
  label: string,            // subagent_type 또는 description. description은 자유텍스트라 §1.3에서 별도 처리
  delegationCount: number,
  tokens: TokenBucket
}

SessionDetail = {
  sessionKey: string,       // SHA-256(sessionId) 앞 16 hex — sessionId 원문 대신(§7 근거)
  projectKey: string,       // ProjectDetail.projectKey와 조인 가능
  startedAt: string,        // ISO 8601
  endedAt: string,
  turnCount: number,
  apiCallCount: number,
  tokens: TokenBucket,
  mainTokens: TokenBucket,
  sidechainTokens: TokenBucket
}
```

예시(발췌):
```json
{
  "date": "2026-08-19",
  "timezoneOffsetMinutes": 540,
  "byProject": [
    { "projectKey": "8f2a91c4b7d3e001", "projectLabel": "claude-plugins", "sessionCount": 4, "turnCount": 60, "apiCallCount": 150, "tokens": { "input": 300000, "output": 50000, "cacheCreation": 20000, "cacheRead": 1200000 } }
  ],
  "byTool": [
    { "tool": "Read", "callCount": 120, "tokens": { "input": 45000, "output": 0, "cacheCreation": 0, "cacheRead": 300000 } },
    { "tool": "Task", "callCount": 8, "tokens": { "input": 12000, "output": 4000, "cacheCreation": 500, "cacheRead": 8000 } }
  ],
  "bySubagent": [
    { "label": "architect", "delegationCount": 3, "tokens": { "input": 9000, "output": 3000, "cacheCreation": 300, "cacheRead": 6000 } }
  ],
  "bySession": [
    {
      "sessionKey": "3c9e7a1b0f2d4568",
      "projectKey": "8f2a91c4b7d3e001",
      "startedAt": "2026-08-19T09:02:11+09:00",
      "endedAt": "2026-08-19T11:47:33+09:00",
      "turnCount": 22,
      "apiCallCount": 68,
      "tokens": { "input": 90000, "output": 15000, "cacheCreation": 6000, "cacheRead": 400000 },
      "mainTokens": { "input": 70000, "output": 12000, "cacheCreation": 4000, "cacheRead": 300000 },
      "sidechainTokens": { "input": 20000, "output": 3000, "cacheCreation": 2000, "cacheRead": 100000 }
    }
  ],
  "collectedAt": "2026-08-19T18:00:05+09:00"
}
```

### 1.3 개인정보/집계전용 원칙의 필드 단위 강제 방법

| 원문 필드(analyze-usage.mjs 내부) | 처리 방법 | 근거 |
|---|---|---|
| `agg.cwd`(절대경로, 예: `/Users/hopegiver/workspace/claude-plugins`) | **전송 안 함.** 대신 `projectKey = sha256(cwd).slice(0,16)` + `projectLabel = path.basename(cwd)`만 전송 | 절대경로에는 OS 사용자명(`/Users/hopegiver/...`)이 그대로 들어 있어 그 자체로 개인식별정보다. `basename`은 프로젝트/레포지토리명일 뿐 개인정보가 아니며, 사용자가 이번 대화에서 명시적으로 제시한 두 옵션(해시 또는 마지막 디렉터리명) 중 **둘 다 채택**한다 — `projectKey`는 안정적 그룹핑 키(동일 폴더명이 다른 절대경로에서 충돌하는 것을 방지), `projectLabel`은 사람이 읽을 수 있는 표시용. `projectKey` 단독으로는 원문 역산이 불가능(해시)하고, `projectLabel`은 처음부터 원문이 아니므로 원칙을 어기지 않는다. **잔여 리스크(완전히 해소되지 않음, Round 2 리뷰 지적)**: 이 "원문이 아니므로 안전하다"는 단정은 두 경우에 깨진다 — (a) cwd가 홈 디렉터리 자체인 세션(예: `/Users/hopegiver`에서 직접 Claude Code를 실행한 경우)이면 `basename(cwd)`가 OS 사용자명 그 자체가 되어 그대로 개인식별정보로 전송된다. (b) 프로젝트 폴더명 자체가 고객사명·기밀 프로젝트 코드네임 등 민감 정보를 담을 수 있어, 회사 전체가 검색 가능한 malgnai-hub에 그 문자열이 그대로 누적되는 것은 "집계 수치만 보낸다"는 원칙의 정신에 어긋날 수 있다. 이 리스크는 구조적으로 완전히 제거하기 어려우므로(프로젝트 폴더명 자체를 아예 안 보내면 §1.2의 표시용 라벨 가치를 잃는다) **문서로 명시**해 두고, 최소한 다음 권고안을 구현 단계에서 검토할 것을 남긴다: `report-usage.mjs`가 `projectLabel`을 만들 때 `os.userInfo().username`과 일치하면(=cwd가 홈 자체) `"(홈 디렉터리)"` 같은 고정 라벨로 마스킹하는 방어 로직 추가(강제 사항 아님, 권고 수준). (b)의 고객사명·코드네임 문제는 자동 판별이 어려워 기술적 마스킹 대신, 설치 안내 문구에 "민감한 프로젝트 폴더명은 별도로 유의"를 남기는 정도가 현실적 완화책이다. |
| `agg.firstPrompt` / `agg.lastPrompt`(원문 프롬프트 요약, 최대 90자) | **필드 자체를 스키마에 만들지 않는다.** §1.2의 `SessionDetail`에 프롬프트 관련 필드가 없다 | 하드 요구사항. `analyze-usage.mjs`는 콘솔 전용 도구라 이 필드를 남겨도 안전하지만, 전송용 스키마는 애초에 이 필드를 정의하지 않아 실수로라도 채워 보낼 코드 경로 자체가 없다. |
| `toolCallCounts`의 `inputPreview`(도구 input `JSON.stringify` 후 120자 truncate — Bash 명령 전문, Edit/Write의 content 일부 등 원문 노출) | **전송 안 함.** `ToolDetail`은 `tool`+`callCount`+`tokens`만 가진다 — "반복 호출 패턴" 섹션 자체를 상세 스키마에 포함하지 않는다 | `SKILL.md`가 이미 "이 표도 노출면"이라고 경고한 항목. 반복호출 탐지는 로컬 콘솔 진단(`analyze-usage.mjs`)의 전용 기능으로 남기고 원격 전송 스키마에는 아예 이식하지 않는다. |
| `subagentAgg`의 `label`(=`subagent_type` 또는 자유텍스트 `description`) | `description`은 사용자가 Task 호출 시 자유롭게 쓰는 문구라 원문성이 있다. **`subagent_type`이 있으면 그것만 사용, 없을 때만 `description`을 그대로 쓰지 않고 `"(무명 위임)"` 같은 고정 라벨로 대체** | `subagent_type`(예: `architect`, `qa-engineer`)은 에이전트 종류를 나타내는 통제된 값이라 원문 우려가 없다. `description`은 자유텍스트이므로, 이것만 있는 케이스는 실제 문구 대신 정형 라벨로 익명화한다. |
| `sessionId`(UUID, 그 자체는 텍스트 콘텐츠 없음) | 원문 UUID 대신 `sessionKey = sha256(sessionId).slice(0,16)` | UUID 자체엔 노출될 "내용"이 없지만, 방어심층(defense-in-depth) 차원에서 한 겹 더 해시한다 — 로컬 `.jsonl` 원본 파일에 접근 가능한 사람과 malgnai-hub 접근 가능한 사람이 겹칠 경우 두 데이터를 대조하는 것을 한 단계 더 어렵게 한다. 비용이 거의 없는 조치이므로 채택(§7에서 더 자세히 논의). |
| `projectAgg`의 캐시 히트율 등 파생 지표 | 전송(수치이므로 원칙 위반 아님) | — |

**검증 방법**: `report-usage.mjs`가 만드는 payload 객체의 타입을 위 스키마로 고정하고(TypeScript까진 안 가더라도 JSDoc `@typedef` 또는 스키마 검증 함수로), **원본 `sessions`/`agg` 객체를 그대로 `JSON.stringify`해서 보내는 코드 경로를 원천적으로 만들지 않는다** — 반드시 "변환 함수(`toDailyAggregatePayload()`, `toDetailPayload()`)"를 거치게 하고, 이 변환 함수의 출력에 `cwd`/`firstPrompt`/`lastPrompt`/`inputPreview` 키가 존재하지 않음을 단위 테스트로 고정한다(구현 단계에서 반드시 추가할 테스트로 이 설계 문서에 못박아 둔다).

---

## 2. 로컬 수집 스크립트 설계

### 2.1 기존 `analyze-usage.mjs`와의 관계 — 공용 lib 추출(신규 스크립트로 분리, 채택)

| | A. `analyze-usage.mjs`를 확장해 네트워크 전송 기능 추가 | B. 별도 스크립트(`bin/report-usage.mjs`) + 공용 집계 lib 추출(**채택**) |
|---|---|---|
| 내용 | 기존 스크립트에 `--send` 같은 플래그를 추가해 같은 파일이 콘솔 출력도 하고 전송도 함 | `bin/lib/usage-aggregate-core.mjs`(신규, 순수 집계 함수만 — `findJsonlFiles`/`newSessionAgg`/`addTokens`/도구·서브에이전트·프로젝트 집계 루프)를 추출해 `analyze-usage.mjs`와 `report-usage.mjs` 양쪽이 import. `analyze-usage.mjs`는 리포트 포맷팅+콘솔 출력만, `report-usage.mjs`는 payload 변환+HTTP 전송만 담당 |
| 선택 이유 | — | (1) **사용자의 명시적 선례 지시**: 이 사용자는 2026-08-10에 "개인 토큰진단 리포트는 절대 공유 안 함, malgnai-mcp/auto-memory에 내용 기록 금지"를 이미 명시했고, `SKILL.md`도 "이 스크립트는 콘솔 출력만 지원한다(파일 저장 옵션 없음)"는 신뢰 계약을 사용자에게 걸어뒀다. 이 계약을 유지하는 유일한 방법은 `analyze-usage.mjs`에 네트워크 코드를 **전혀** 섞지 않는 것이다 — 플래그 하나로 전송 여부가 갈리는 구조는 "이 도구는 로컬에만 있다"는 신뢰를 코드 레벨에서 더 이상 보장하지 못하게 만든다(사람이 실수로 `--send`를 붙이거나, 향후 누군가 기본값을 바꿀 위험). (2) 단일 책임: 대화형 진단 도구와 무인 백그라운드 전송 데몬은 실행 트리거·에러 처리·로깅 요구사항이 근본적으로 다르다(§6). |
| 포기한 것 | — | 두 파일이 공용 lib에 의존하므로 집계 로직 변경 시 두 진입점 모두 영향을 받는다(다만 이건 로직 중복보다 훨씬 안전한 결합이다) |
| 감당 방안 | — | `usage-aggregate-core.mjs`는 순수 함수(부수효과 없음: console.log·fs write·network 호출 금지)로 엄격히 제한 — 리포트 포맷팅(마크다운 표 생성)은 `analyze-usage.mjs`에만, payload 변환(§1.3 익명화)은 `report-usage.mjs`에만 남겨 lib 자체는 "옵션 파싱→jsonl 스캔→집계 Map 반환"까지만 한다. 이 경계를 지키면 `analyze-usage.mjs`의 기존 동작(콘솔 전용, 옵션 `--days`/`--project`/`--top`)은 리팩터링 후에도 100% 동일해야 한다(구현 시 회귀 테스트 기준). |

### 2.2 `report-usage.mjs` 실행 흐름

```
1. 로컬 상태 파일 읽기: ~/.claude/malgnai-hub/usage-report-state.json
   { lastSyncedDate: "2026-08-18", lastSuccessAt: "...", lastError: null }
   (없으면 최초 실행 — lastSyncedDate = 오늘-7일 정도로 초기화, §2.3 catch-up 참고)

2. 오늘 날짜(로컬)와 lastSyncedDate+1 사이의 날짜 목록 계산
   (§2.3의 "그날 전체 재집계 후 upsert" + catch-up window)

3. 자격증명 로드: ~/.claude/malgnai-hub/usage-agent-credentials.json (§3.4)
   없거나 만료 임박(예: 14일 이내)이면 로그에 경고 남기고, 없으면 즉시 종료(exit 1, 헬스체크가 감지)

4. 날짜별로:
   a. usage-aggregate-core.mjs로 해당 날짜 전체를 jsonl에서 재집계
   b. toDailyAggregatePayload() / toDetailPayload()로 변환(§1.3 원칙 적용)
   c. POST /api/usage/daily-aggregate, POST /api/usage/detail (순차, 재시도 포함 — §6)
   d. 둘 다 성공하면 lastSyncedDate = 그 날짜로 갱신 후 상태 파일 즉시 저장(부분 성공 시 다음 실행에서 그 날짜부터 재시도 — 멱등)

5. 로그 파일에 실행 결과 1줄 기록(§4.3의 로그 경로, 헬스체크가 파싱)
```

- **jsonl 재스캔 비용**: `usage-aggregate-core.mjs`는 날짜 필터를 `--days N`(오늘부터 N일 역산) 대신 **임의의 시작일~종료일 범위**를 받도록 확장한다(기존 `analyze-usage.mjs`의 `cutoffStr` 계산 로직을 일반화 — 이 확장이 `analyze-usage.mjs`의 기존 `--days` 동작에 영향을 주지 않아야 한다, §2.1의 회귀 기준).
- **동시 실행 방지**: 같은 PC에서 launchd/스케줄러가 이전 실행이 아직 안 끝났는데 다음 실행을 또 띄우는 경우(네트워크가 느려 실행이 길어진 경우 등)를 막기 위해 PID 락 파일(`~/.claude/malgnai-hub/usage-report.lock`)을 쓴다 — 락을 못 얻으면 조용히 종료(exit 0, 로그에 "이전 실행 진행 중" 1줄만 남김. 에러 취급 안 함).

### 2.3 증분 집계 vs 재집계+upsert — 권고: **그날 전체 재집계 후 upsert**

| | A. 증분 집계(직전 전송 이후 신규 로그 라인만) | B. 그날 전체 재집계 후 upsert(**채택**) |
|---|---|---|
| 내용 | jsonl 파일별 마지막으로 읽은 바이트 오프셋을 로컬에 체크포인트로 저장, 매 실행마다 그 이후 신규 라인만 파싱해 로컬에 누적된 "오늘 합계"에 더한 뒤 전송 | 매 실행마다 "오늘"(및 밀린 날짜) 전체를 처음부터 다시 스캔·집계해서 서버에 그대로 upsert(덮어쓰기) |
| 선택 이유 | — | (1) `analyze-usage.mjs`가 이미 "매번 처음부터 전체 스캔"하는 단순 설계 철학이다 — 무의존성·상태없음(stateless)이 이 도구군의 기존 정체성이고, 이를 깨는 것은 이 프로젝트의 architect 원칙(단순함이 기본값, 없는 요구에 대비한 복잡성은 부채)에 반한다. (2) **자연스러운 멱등성**: 재집계+upsert는 같은 날짜를 몇 번 다시 보내도 최종 상태가 항상 같다(③비정상 케이스 의무의 멱등성을 설계 자체가 만족). (3) **자연스러운 장애 복구**: 네트워크가 몇 시간~며칠 끊겨도, 복구 후 첫 실행이 밀린 날짜들을 그대로 재집계해 순차 전송하면 별도의 로컬 큐 없이 복구된다(§2.2 4번 loop, §6). 증분 방식은 체크포인트 파일이 손상되거나 jsonl 파일이 로테이션/삭제되는 경우 복구 로직을 별도로 설계해야 한다. |
| 포기한 것 | — | 하루가 진행될수록(세션이 쌓일수록) 매시간 재스캔하는 바이트 수가 커진다 — 무거운 사용자는 하루치 jsonl이 수십MB에 달할 수 있음 |
| 감당 방안 | — | 1시간 주기 실행에서 수십MB 텍스트 라인 스캔은 통상 수백ms~수 초 수준(Node.js `readline` 스트리밍, `analyze-usage.mjs`가 이미 이 방식으로 `--days 30`까지도 커버해 왔음)이라 실사용에서 문제 되지 않을 것으로 판단한다. **다만** 향후 실측에서 "오늘" 스캔 대상 jsonl 총 바이트가 예: 50MB를 넘는 경우가 관측되면, 그 시점에 증분 방식(A)으로 전환을 재검토한다 — 지금은 확인되지 않은 성능 문제에 미리 대비하지 않는다(과설계 방지). |

**catch-up window 상한**: `lastSyncedDate`와 오늘 사이가 예: 30일을 초과하면(노트북을 오래 꺼둔 경우 등) 30일 이전 날짜는 건너뛰고 로그에 "30일 초과 구간은 재전송하지 않음" 경고만 남긴다 — 무한정 과거를 훑는 것을 방지(레이트리밋·리소스 보호, API 스펙 문서 §7과 정합).

---

## 3. 인증 전략

### 3.1 배경 — 기존 OAuth 설계와의 관계

`docs/decision/malgnai-hub-oauth-device-auth-design.md`(🟢 Green, Round 2 승인)가 확립한 것:
- `device_tokens` 테이블(`id/user_id/device_id/device_name/token_hash(SHA-256)/scopes/status/expires_at/last_used_at/created_at/revoked_at`) — Bearer 토큰을 원문 저장하지 않고 해시로만 검증.
- `mcp/device-auth.js`: `Authorization: Bearer <token>` → SHA-256 해시 → `device_tokens.token_hash` 조회 → `status='active'`면 통과.
- `POST /api/devices/pair-init`(무인증) → 사람이 웹에서 `POST /api/devices/pair-approve`(JWT 인증, 승인) → `GET /api/devices/pair-status`(무인증 폴링) → 클라이언트가 **1회** raw 토큰 수신. 이 흐름은 **정확히 "브라우저 로그인은 최초 1회, 이후는 헤드리스"라는 이번 요구사항과 동일한 문제를 이미 풀어놓은 패턴**이다.

이 설계는 이 페어링 흐름을 **그대로 재사용**하되, 새로 발급되는 토큰의 `scopes`를 이 신규 목적 전용으로 좁힌다(§3.2).

### 3.2 대안 비교: 기존 MCP 자격증명 재사용 vs 전용 스코프 토큰 신규 발급

| | A. 플러그인이 이미 갖고 있는 MCP 인증 정보를 재사용 | B. 전용 `usage:write` 스코프 토큰을 별도 발급(**채택**) |
|---|---|---|
| 내용 | `mcpServers.malgnai-hub`의 OAuth access_token(또는 레거시 `userConfig.device_token`)을 `report-usage.mjs`가 어떻게든 읽어서 그대로 사용 | 백그라운드 리포터 전용 디바이스 페어링을 별도로 1회 수행해 새 `device_tokens` 행(용도 전용 scope)을 발급받아 별도 파일에 저장 |
| 선택 이유 | — | (1) **의존 대상이 불안정하다**: OAuth access_token은 Claude Code CLI의 내부 OAuth 클라이언트가 관리하는 캐시(정확한 저장 위치·포맷이 malgn-agent 저장소 문서 어디에도 확정돼 있지 않고, OAuth 설계 문서 §9도 "Claude Code의 실제 OAuth 클라이언트 동작이 부분 검증됐다"고 정직하게 명시)에 있다 — 독립 실행되는 Node 스크립트가 이를 안정적으로 읽는다는 보장이 없고, Claude Code 자체 업데이트로 저장 방식이 바뀌면 조용히 깨진다. (2) 레거시 `userConfig.device_token`은 OAuth 전환 이후 "값을 채워도 자동으로 쓰이지 않는" 선택적 필드라 사용자 다수가 값을 갖고 있지 않을 것으로 예상된다(설치 프롬프트가 `required: false`로 완화됨, OAuth 설계 문서 §4.2). (3) **최소 권한 원칙**: MCP 자격증명은 malgnai-hub의 `decision_record`/`issue_record`/`work_record`/`wbs_*` 등 프로젝트 메모리 전체에 대한 읽기·쓰기 권한을 가진 광범위한 토큰이다. 텔레메트리 전송만 하면 되는 백그라운드 데몬이 이 토큰을 로컬 파일로 들고 있으면, 그 파일이 유출됐을 때의 피해 범위(blast radius)가 "사용량 수치 오염"이 아니라 "회사 프로젝트 메모리 전체 조작"으로 커진다. 전용 스코프 토큰은 유출돼도 `usage:write`만 가능해 피해가 국소화된다. |
| 포기한 것 | — | 사용자가 설치 시 1회 추가 페어링(브라우저 승인)을 더 거쳐야 한다 — MCP 로그인과 별개의 승인 클릭 1회 |
| 감당 방안 | — | §4.3의 설치 스크립트가 이 1회 페어링을 자동화(브라우저를 자동으로 열고 폴링까지 처리)해 사용자 체감 수고를 "링크 클릭 1번"으로 최소화한다. |

### 3.3 토큰 발급 흐름 — 기존 pair-init/pair-approve/pair-status 확장

```
report-usage.mjs 설치 스크립트(bin/install-usage-agent.mjs, 미구현)가 최초 1회 실행:

1. POST /api/devices/pair-init { deviceName: "<hostname>-usage-agent", purpose: "usage_report" }
   (신규 파라미터 purpose — 기존 MCP 페어링과 구분, §3.4/API 스펙 문서 §9)
   → { pairingCode, approveUrl }
2. approveUrl을 로컬 기본 브라우저로 자동 오픈(안 되면 콘솔에 URL 출력, 사용자가 직접 열기)
3. 사용자가 malgnai-hub에 로그인된 상태에서 approveUrl 접속 → "이 PC를 사용량 리포터로 승인" 화면 확인 후 승인 클릭
   → 서버가 POST /api/devices/pair-approve 호출(웹 화면이 대신 호출, JWT 인증) → scopes="usage:write"(콤마구분 문자열, API 스펙 §2와 동일 포맷)로 device_tokens 1행 생성
4. install-usage-agent.mjs는 GET /api/devices/pair-status를 폴링(기존 메커니즘 그대로)
   → 승인 완료 시 raw 토큰 1회 수신
5. §3.4 위치에 저장 + launchd/schtasks 등록(§4)
```

기존 pair-approve 화면(`/keys`)에 이 목적("사용량 리포터")을 구분해 보여주려면 malgnai-public 쪽에 `purpose` 파라미터 처리가 필요하다 — API 스펙 문서 §9에 요구사항으로 명시했다.

### 3.4 토큰 저장 위치·권한

| 항목 | 값 | 근거 |
|---|---|---|
| 경로(macOS/Linux) | `~/.claude/malgnai-hub/usage-agent-credentials.json` | `~/.claude/`는 이미 Claude Code 생태계의 확립된 개인 설정 위치(`~/.claude/projects`와 동일 상위 디렉터리) — 새로운 최상위 디렉터리를 만들지 않고 기존 관례에 편입 |
| 경로(Windows) | `%USERPROFILE%\.claude\malgnai-hub\usage-agent-credentials.json` | 동일 |
| 파일 권한(POSIX) | `chmod 600`(소유자만 읽기/쓰기) — 파일 생성 시 스크립트가 직접 설정 | 다른 로컬 사용자 계정으로부터 토큰 원문 보호 |
| 파일 권한(Windows) | 별도 ACL 조작 불필요 — `%USERPROFILE%` 하위는 NTFS 기본 권한상 이미 해당 사용자 계정 전용 | 불필요한 복잡성 회피(단순함이 기본값) — 다만 공유 PC(여러 직원이 같은 Windows 계정 공유) 환경이면 이 가정이 깨진다는 점을 설치 스크립트 안내 문구에 명시 권고 |
| 내용 | `{ "token": "<raw>", "deviceId": "...", "issuedAt": "...", "expiresAt": "...", "scopes": "usage:write" }` | `expiresAt`을 로컬에도 보관해 §5 헬스체크가 만료 임박을 자체 판단 가능하게 함. `scopes`는 콤마구분 문자열(API 스펙 §2와 동일 포맷, JSON 배열 아님) |
| MCP 자격증명과의 분리 | 완전히 별도 파일·별도 디바이스 행(§3.2) | 재사용하지 않는다는 결정의 직접 귀결 |

### 3.5 로테이션·폐기

- **만료(expires_at)**: 무기한 발급하지 않는다. **180일** TTL 권고 — OAuth 설계 문서 §5가 레거시 device_token 종료 계획에서 이미 "180일" 소급 만료를 기준값으로 쓴 전례가 있어 이 프로젝트 안에서 일관된 수명주기 값이 된다(단일 정본 원칙 — 두 설계가 서로 다른 만료 관례를 갖지 않도록).
- **자동 갱신 없음(설계 단순화)**: OAuth의 refresh_token 회전 같은 자동 갱신 메커니즘은 이번 설계에 넣지 않는다 — 브라우저 상호작용 없이 만료 직전 자동 재발급하려면 refresh 로직이 필요한데, 텔레메트리 전송 목적에 그 복잡성(회전+재사용탐지+grace window)을 도입하는 것은 과설계다. 대신: 만료 14일 전부터 로컬 로그·헬스체크에 경고를 남기고(§5), 사용자가 설치 스크립트를 다시 실행(재페어링)하면 새 토큰으로 교체된다.
- **폐기(revoke)**: 신규 엔드포인트 불필요 — 기존 `DELETE /api/devices/:id`(웹 `/keys` 화면의 기기 목록)가 이미 `device_tokens.status='revoked'`로 전환하는 기능을 갖고 있다(OAuth 설계 문서 §3.7). 사용량 리포터 토큰도 이 화면의 기기 목록에 "사용량 리포터" 용도로 표시되게 하면(§9 API 스펙 요구사항), 사용자가 다른 MCP 기기와 동일한 UX로 폐기할 수 있다 — 새 UI를 만들 필요가 없다.
- **로테이션 트리거**: OAuth 설계 문서 §5의 D+60/D+90 패턴을 참고해, 이 설계도 "측정만 하고 계획 없음"이 되지 않도록 명시한다 — 배포 후 180일 시점에 만료 도래분이 몰리므로, 설치 스크립트/헬스체크 쪽에 만료 임박 알림을 반드시 넣는다(§5 체크 항목에 포함, 구현 필수 조건으로 명시).

---

## 4. launchd(macOS)/작업스케줄러(Windows) 등록 스크립트 설계

### 4.1 macOS launchd

- Label: `kr.malgnsoft.malgnai-hub.usage-report`
- plist 경로: `~/Library/LaunchAgents/kr.malgnsoft.malgnai-hub.usage-report.plist`(사용자 단위 LaunchAgent — LaunchDaemon이 아님. 이유: `~/.claude/`와 자격증명 파일이 사용자 홈 디렉터리에 있어 사용자 세션 컨텍스트로 실행돼야 접근 가능하다)
- 핵심 키:
  ```xml
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>node</string>
    <string><malgn-agent 플러그인 절대경로>/bin/report-usage.mjs</string>
  </array>
  <key>StartInterval</key>
  <integer>3600</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>~/Library/Logs/malgnai-hub/usage-report.log</string>
  <key>StandardErrorPath</key>
  <string>~/Library/Logs/malgnai-hub/usage-report.log</string>
  ```
- 등록: `launchctl bootstrap gui/$UID <plist경로>`(최신 launchd 권장 방식) — `launchctl load`(레거시)는 폴백으로만 언급.
- 해제: `launchctl bootout gui/$UID/kr.malgnsoft.malgnai-hub.usage-report`
- 재등록(업데이트 시): bootout → plist 갱신 → bootstrap.

### 4.2 Windows 작업 스케줄러

- 작업 이름: `MalgnaiHub-UsageReport`
- 등록:
  ```
  schtasks /Create /TN "MalgnaiHub-UsageReport" ^
    /TR "node \"<malgn-agent 플러그인 절대경로>\bin\report-usage.mjs\"" ^
    /SC MINUTE /MO 60 /RU %USERNAME% /RL LIMITED /F
  ```
  `/RU %USERNAME%`(현재 로그인 사용자 컨텍스트) — `SYSTEM` 계정으로 돌리면 `%USERPROFILE%\.claude`에 접근할 수 없으므로 반드시 사용자 컨텍스트 유지.
- 로그: `report-usage.mjs`가 직접 `%LOCALAPPDATA%\malgnai-hub\logs\usage-report.log`에 기록(schtasks 자체는 stdout 리다이렉트를 기본 지원하지 않으므로 스크립트가 자체 로깅 책임을 진다 — macOS와의 비대칭 지점, 구현 시 유의).
- 해제: `schtasks /Delete /TN "MalgnaiHub-UsageReport" /F`
- 재등록: Delete → Create.

### 4.3 설치/제거/재등록 커맨드 구조 (플랫폼 공통 진입점)

```
node bin/install-usage-agent.mjs install    # 페어링(§3.3) + launchd/schtasks 등록, OS 자동 판별
node bin/install-usage-agent.mjs uninstall  # 등록 해제 + 로컬 자격증명·상태파일 삭제(+ 원격 폐기 안내: /keys에서 직접 폐기하라고 안내, 원격 자동폐기는 하지 않음 — 네트워크 없이도 uninstall이 끝나야 하므로)
node bin/install-usage-agent.mjs status     # §5 헬스체크와 동일 로직 재사용 — "설치 여부/마지막 실행/마지막 전송 성공 여부" 요약 출력
node bin/install-usage-agent.mjs reinstall  # uninstall + install (페어링부터 재수행 — 자격증명 로테이션 겸용)
```

`install`/`uninstall`은 OS를 `process.platform`으로 판별해 §4.1/§4.2 중 해당 로직만 실행한다(단일 스크립트, 플랫폼별 분기 — 별도 스크립트 2개로 쪼개지 않는다: 사용자가 실행할 명령을 플랫폼별로 외울 필요가 없게 하는 것이 UX상 더 단순하다).

---

## 5. 헬스체크 스킬의 점검 항목 설계 (향후 스킬 구현 시 반영)

이번 세션은 스킬 파일 자체를 만들지 않는다 — 다음 스킬 구현 턴이 참고할 체크리스트만 여기 정의한다.

1. **등록 여부**: macOS `launchctl print gui/$UID/kr.malgnsoft.malgnai-hub.usage-report`(exit 0이면 등록됨) / Windows `schtasks /Query /TN "MalgnaiHub-UsageReport" /V /FO LIST`.
2. **최근 실행 여부**: launchd는 `launchctl print` 출력의 `last exit code`/`state`, 없으면 로그 파일(§4.1/§4.2)의 마지막 라인 타임스탬프가 "지금 - 1시간" 이내인지. Windows는 `schtasks /Query ... /V`의 "마지막 실행 시간"/"마지막 결과" 필드.
3. **마지막 전송 성공 여부**: 로그 파일의 마지막 성공 라인(예: `[2026-08-19T18:00:05+09:00] OK date=2026-08-19 daily+detail sent`)과 마지막 에러 라인을 구분해 파싱 — §6에서 정의할 로그 포맷을 헬스체크가 그대로 소비한다(로그 포맷은 구현 시 이 두 스킬이 같은 규약을 쓰도록 못박아야 함).
4. **자격증명 만료 임박**: `usage-agent-credentials.json`의 `expiresAt`이 14일 이내면 경고, 이미 지났으면 실패로 보고 + "재설치 필요" 안내(§3.5).
5. **상태 파일 지연**: `usage-report-state.json`의 `lastSyncedDate`가 오늘보다 2일 이상 뒤처져 있으면 경고(§2.3 catch-up이 정상 동작 중인지 간접 확인).
6. **락 파일 잔존**: `usage-report.lock`이 비정상적으로 오래(예: 1시간 이상) 남아있으면 "이전 실행이 비정상 종료됐을 가능성" 경고.

---

## 6. 실패 처리 정책

| 상황 | 동작 |
|---|---|
| 네트워크 끊김(DNS/연결 실패) | 해당 회차는 실패 처리, 로그에 1줄 기록 후 조용히 종료(exit 1, 사용자에게 팝업 등 방해 없음). §2.3의 재집계+upsert 설계 덕분에 **별도 로컬 큐가 필요 없다** — 다음 정상 실행이 밀린 날짜까지 자동으로 다시 채운다(catch-up window 상한 30일, §2.3). |
| malgnai-hub 다운(5xx 응답) | 동일 — 실패 로그 후 조용히 종료. 같은 회차 내 짧은 재시도만 수행(아래) |
| 재시도 정책(회차 내) | 요청당 최대 2회 재시도, 백오프 5초/15초. 3회 모두 실패하면 그 날짜 전송을 포기하고 다음 정상 회차로 넘긴다(1시간 뒤 재집계로 자연 복구되므로 회차 내에서 무리하게 재시도하지 않는다 — 다음 launchd/스케줄러 트리거와 겹치는 것을 방지) |
| 인증 만료(401) | 재시도하지 않는다(토큰이 유효해지지 않으므로 재시도가 무의미) — 즉시 실패 로그 + "재설치 필요" 명시적 메시지, exit 1. §5 헬스체크가 이 상태를 감지해 사용자에게 알려주는 것이 주 채널(백그라운드 스크립트 자체는 조용히 실패만 함 — 사용자를 방해하지 않는다는 원칙, `token-usage-diagnosis` 스킬과 동일한 "조용한 실패" 철학 계승). |
| 레이트리밋(429) | 서버가 `Retry-After` 헤더를 주면 그 값만큼, 없으면 60초 대기 후 그 회차 내 1회만 재시도. 이후 실패면 다음 정상 회차로 위임(위와 동일 원칙) |
| payload 검증 실패(400, 예: 스키마 불일치) | 재시도 무의미 — 즉시 실패 로그(향후 사람이 볼 로그에 서버 에러 메시지 그대로 남김, 스키마 드리프트 디버깅용) + exit 1. 이 경우는 **스크립트 버전과 서버 API 버전 불일치**를 의심해야 하므로 로그에 `scriptVersion`/응답 에러 코드를 함께 남긴다(§1.1의 `scriptVersion` 필드가 여기서 쓰인다). |
| 동시 실행 충돌 | §2.2의 락 파일 — 조용히 skip, 에러 아님 |
| 로컬 jsonl 파싱 에러(일부 라인 손상) | `analyze-usage.mjs`의 기존 관례 그대로: 개별 라인 파싱 실패는 건너뛰고 카운트만 증가, 전체 실행은 중단하지 않음(기존 `parseErrors` 카운터 재사용) |

---

## 7. 세션별 상세 전송 여부·익명화 — 아키텍트 판단

**결론: 세션별 상세(bySession)는 포함한다(요구사항 3-b에 명시적으로 요청됨). 다만 다음 세 가지 완화 조치를 필수로 설계에 넣는다.**

이 판단의 근거를 순서대로 밝힌다.

1. **왜 완전히 뺄 수는 없는가**: 사용자가 이번 대화에서 "세션별" 분해를 명시적으로 요구했다(요구사항 3-b). 세션 단위 데이터가 없으면 "이 프로젝트에서 세션이 길게 이어지는지 파편화됐는지" 같은, `analyze-usage.mjs`가 로컬에서 이미 제공하는 진단 가치(§7 세션 파편화 분석 등)를 원격 집계에서 완전히 잃는다. 임의로 요구사항을 축소하는 것은 스코프 규율 위반이다.

2. **진짜 위험은 sessionId 원문이 아니라 "재구성 가능한 개인 활동 타임라인"이다**: sessionId(UUID)는 그 자체로 텍스트 콘텐츠가 없어 프롬프트 원문·cwd 원문과 성격이 다르다. 이 데이터의 실제 프라이버시 위험은 — 이미 디바이스 토큰이 `user_id`에 귀속돼 있어(§3.1 페어링 흐름 자체가 JWT 인증을 거치므로 malgnai-hub는 애초에 "누구 PC인지" 항상 안다) — **"이 사람이 화요일 09:02~11:47에 프로젝트 X에서 68회 API 호출을 했다"는 세밀한 시간대별 활동 패턴이, 그 사람 동의 없이 조회 가능한 형태로 중앙에 누적되는 것**이다. 이것이 사용자가 지적한 "원격 추적" 우려의 실체다.

3. **따라서 완화의 초점은 "무엇을 보내는가"가 아니라 "누가 조회할 수 있는가"에 둔다**: sessionId를 해시(§1.3)하는 것은 방어심층으로 유지하되(비용이 거의 없으므로), 이것만으로는 추적 우려를 해소하지 못한다(해시해도 시간대·프로젝트·소요시간 패턴은 그대로 보이기 때문). **진짜 완화책은 malgnai-hub API의 조회 권한 정책이다** — API 스펙 문서(자매 문서) §11에 다음을 하드 제약으로 명시했다:
   - `bySession` 레벨 상세는 **기본적으로 본인(그 디바이스를 페어링한 user_id)만 조회 가능**하다 — `token-usage-diagnosis` 스킬이 이미 확립한 "이 진단은 실행한 사람 자신만 본다"는 원칙을 원격 저장소에서도 그대로 유지한다.
   - 관리자 역할이 타인의 세션별 상세를 조회하려면 그 자체가 audit_logs에 남는 특별 동작이어야 한다(OAuth 설계 문서가 이미 `audit_logs.action` enum에 `admin.cross_user_view`를 갖고 있다 — **이 기존 액션을 재사용**할 것을 API 스펙에서 malgnai-public에 명시적으로 요구한다).
   - 일별 총량(daily-aggregate)과 프로젝트/도구/에이전트별 집계(byProject/byTool/bySubagent)는 세션 단위보다 재구성 위험이 낮으므로(활동을 "그 날 있었다" 수준으로만 보여줌), 조직 차원 집계(예: "이번 달 팀 전체 도구별 사용량")로 더 자유롭게 활용해도 된다고 판단한다 — 이 구분(세션 상세는 엄격, 총량/카테고리별 집계는 상대적으로 개방)이 이번 설계의 핵심 트레이드오프다.

4. **채택하지 않은 대안**: "타임스탬프를 시간 단위로 뭉개서 정밀도를 낮춘다"는 완화책도 검토했으나 채택하지 않았다 — 소요시간(`endedAt - startedAt`) 분석 가치를 깎아 먹는 데 비해, 이미 어차피 "그 날짜에 활동했다"는 사실 자체는 daily-aggregate로도 드러나므로 추가되는 프라이버시 이득이 작다고 판단했다(②의 진짜 위험은 시간 정밀도가 아니라 조회 권한이라는 판단과 일관). 다만 이 판단은 malgnai-public 구현 시 재검토 여지를 남긴다 — 조직에서 "정밀 타임스탬프까지는 과하다"는 의견이 나오면 `startedAt`/`endedAt`을 시(hour) 단위로 버킷팅하는 옵션을 추가하는 것은 이번 설계를 크게 흔들지 않는 후속 조정이다.

5. **"왜 자동 hourly + 세션별 상세까지 포함하나"에 대한 사용자 근거(Round 2 리뷰 Rethink 대응)**: reviewer가 이 설계 전반의 방향(자동 hourly 전송, 세션 단위 granularity)에 대해 근본 재검토(Rethink) 질문을 제기했고, 사용자가 이번 대화에서 직접 근거를 밝혔다 — "세션의 내용은 들어가지 않는다. 세션 상세가 필요한 이유는 실제 에이전트와 도구의 효율적 사용여부를 체크하려면 해당 데이터의 수집과 분석이 필수적이다." 즉 `bySession`은 처음부터 프롬프트·도구 input 원문을 포함하지 않도록 설계돼 있고(§1.2/§1.3, 이 원칙은 이번 개정으로도 바뀌지 않는다), 세션 단위로 데이터를 쪼개는 이유는 프라이버시 완화가 목적이 아니라 **에이전트별/도구별 사용 효율 분석이 세션 경계 안에서 봐야 의미를 가지기 때문**이다(예: 특정 세션에서 특정 도구가 반복 호출되며 토큰을 과다 소모하는 패턴은 세션 단위로 묶어야만 드러난다 — 일별 총량이나 도구별 전체 합산만으로는 이런 패턴이 다른 세션의 정상적 사용과 뒤섞여 보이지 않는다). 자동 hourly 주기(§4)도 같은 목적에 종속된다 — 실시간에 가까운 주기로 축적돼야 "이번 주 이 프로젝트에서 에이전트 위임이 비효율적으로 반복됐는지"를 사후가 아니라 근접 시점에 진단할 수 있다. 이 사용자 근거는 §7의 조회 권한 제한(본인+감사로그 관리자)이라는 완화책과 상충하지 않는다 — 오히려 "누가 보는가"를 좁게 유지하는 한 "얼마나 세밀하게 보는가"는 분석 목적에 맞춰 유지해도 된다는 이 설계의 기존 논리(②·③번 항목)를 사용자가 직접 재확인해 준 것이다.

---

## 8. 4대 설계의무 자기검증

- **①트레이드오프**: §2.1(공용 lib 분리 vs 기존 스크립트 확장), §2.3(재집계+upsert vs 증분), §3.2(전용 토큰 신규발급 vs 기존 MCP 자격증명 재사용), §7(세션상세 포함+조회권한 제한 vs 시간정밀도 저하) — 네 곳에서 대안·선택이유·포기한 것·감당방안을 명시했다.
- **②프로젝트 고유성**: 이 설계 자체가 이 저장소의 기존 자산(`analyze-usage.mjs`의 집계 구조, OAuth 설계 문서의 `device_tokens`/페어링 흐름, `token-usage-diagnosis` 스킬의 "본인만 조회" 철학)을 재사용하는 것이 핵심이다 — 범용 텔레메트리 파이프라인을 처음부터 설계했다면 이 재사용 지점들을 놓치고 병렬 인프라를 새로 만들었을 것이다(OAuth 설계 문서 §8의 동일 자기검증 문구를 이 프로젝트의 반복되는 우수 패턴으로 계승).
- **③비정상 케이스**: 네트워크/서버 장애(§6), 인증 만료(§3.5·§6), 동시 실행(§2.2·§6), 부분 성공(§2.2의 날짜별 순차 커밋), 멱등성(§2.3 upsert 설계 자체), 레이트리밋(§6), jsonl 파싱 오류(§6) 모두 설계에 포함했다.
- **④완결성**: 두 스키마(daily-aggregate/detail) 모두 필드·타입·예시 JSON을 제공했고(§1), 개인정보 원칙을 필드 단위표로 강제 방법까지 명시했다(§1.3). API 자체의 요청/응답/에러/권한/검증 규칙은 자매 문서(API 스펙)가 완결성 체크를 담당한다.
- **Sensitive 등급 심화 확인**: 인증 자격증명의 저장 위치·권한·만료·폐기(§3.4·§3.5)와 조회 권한 정책(§7)을 표준 CRUD 수준보다 깊게 다뤘다 — 이 프로젝트가 이미 가진 Sensitive 등급 선례(OAuth 설계 문서, Round 2 reviewer 검증까지 거침)와 동일한 깊이를 목표로 했다.

---

## 9. 미결 사항 / malgnai-public 의존성 요약

- 이 문서의 §3~§7은 malgnai-public이 아래를 구현해야 실현된다 — 상세 요구사항은 자매 문서 `token-usage-api-spec-for-malgnai-public-2026-08-19.md` 참고:
  1. `pair-init`에 `purpose` 파라미터 추가(§3.3) 및 이에 따른 `scopes="usage:write"`(콤마구분 문자열) 발급.
  2. `POST /api/usage/daily-aggregate` / `POST /api/usage/detail` 엔드포인트(device Bearer 인증, `usage:write` 스코프 검증).
  3. `bySession` 조회 권한을 본인+감사로그 남는 관리자 조회로 제한하는 authz 정책(§7).
  4. `/keys` 기기 목록 화면에 "사용량 리포터" 용도 구분 표시(§3.5의 폐기 UX 재사용 전제).
- **라우팅 배선 — 실측 확정(Round 2 리뷰)**: `server/index.js:20-21`의 전역 `webApp.use('/api/*', jwtAuthMiddleware)`가 `/api/usage/*`도 그대로 덮어 device Bearer 요청이 도달하지 못하는 것을 실측으로 확인했다. 해법은 API 스펙 문서 §8에 확정했다 — `/api/oauth/token`이 이미 쓰고 있는 선례(정확 문자열 `PUBLIC_PATHS`에 추가 + 라우트 자체에서 `deviceAuthMiddleware` 로직 재사용)를 권고안으로 채택했다. `wrangler.jsonc:41`의 `run_worker_first`는 이미 `/api/*`를 포함해 별도 변경이 불필요함도 확인 완료.
- `device_tokens.scopes` 컬럼의 실제 직렬화 포맷은 **콤마구분 평문 문자열**로 실측 확정됐다(`migrations/0001_init_v1_schema.sql:172`) — API 스펙 문서 §2에 동일하게 반영. 다만 `server/dao/device-tokens.js`의 `insert()`가 `scopes` 파라미터를 받지 않는 점, `mcp/device-auth.js`가 스코프 검증 로직 자체를 갖고 있지 않은 점은 malgnai-public 구현 단계의 신규 작업으로 남아 있다(API 스펙 문서 §2 참고).
- Tier 0 스파이크(OAuth 설계 문서의 `oauth.clientId` 보존 여부 실기동 검증)와 이번 설계는 **독립적**이다 — 이번 백그라운드 리포터는 Claude Code의 MCP OAuth 클라이언트를 전혀 거치지 않고 자체 페어링 토큰을 쓰므로, Tier 0 스파이크 결과와 무관하게 착수 가능하다(다만 malgnai-public이 §3.1의 `device_tokens`/pair-* 인프라 자체를 먼저 갖추고 있어야 하며, 이는 OAuth 설계와 별개로 이미 존재하는 기존 기능이다).
