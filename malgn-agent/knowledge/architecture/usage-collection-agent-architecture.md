# 토큰 사용량 자동 수집 에이전트 아키텍처

> owner: trainer

> 이 문서의 사실 정본은 구현체 `malgn-agent/bin/{usage-agent-lib,pair-usage-device,report-usage,install-usage-agent}.mjs`다 — 필드명·엔드포인트·동작이 이 문서와 어긋나면 코드가 맞다.

이 문서는 나중에 이 기능을 유지보수하거나 비슷한 백그라운드 텔레메트리 파이프라인을 또 만들 사람이 "왜 이렇게 돼 있지"를 빠르게 파악하도록 돕는다.

## 1. 전체 그림 — 로컬 스크립트 4개의 역할 분담

```
usage-agent-lib.mjs   (공용 헬퍼, 단독 실행 안 됨)
   ├─ credentials/last-run 파일 IO (~/.claude/malgnai-hub/*.json, chmod 600)
   ├─ https 요청 헬퍼 (fetch 대신 node:https 내장모듈 — 무의존성 원칙)
   └─ git remote 기반 repository_key 추출 (cwd 원문 대신 "owner/repo"만)
        ▲                ▲                        ▲
        │                │                        │
pair-usage-device.mjs   report-usage.mjs      install-usage-agent.mjs
(1회성, 사람 개입)        (매시간 자동 실행)      (OS 스케줄러 등록/해제)
```

- **`pair-usage-device.mjs`**: malgnai-hub와 3단계 페어링(`POST /api/devices/pair-init` 무인증 → 사람이 브라우저로 승인 → `GET /api/devices/pair-status` 폴링)을 거쳐 `device_token`을 1회 발급받는다. 재실행해도 이미 토큰이 있으면 스킵(`--force`로 강제 재페어링).
- **`report-usage.mjs`**: `~/.claude/projects/**/*.jsonl`을 세션 단위로 **처음부터 지금까지 누적** 재집계하고, "최근 활동이 있었던 세션"만 골라 `POST /api/sessions`로 전송한다. 매시간 자동 실행이 전제.
- **`install-usage-agent.mjs`**: `report-usage.mjs`가 매시간 자동 실행되도록 macOS는 launchd(`~/Library/LaunchAgents/com.malgnsoft.usage-agent.plist`, `StartInterval 3600`), Windows는 `schtasks`(작업명 `MalgnsoftUsageAgent`, `/SC HOURLY /MO 1`)에 등록한다. 페어링이 안 되어 있으면 `pair-usage-device.mjs`를 먼저 실행한다.

## 2. malgnai-hub 계약 — `POST /api/sessions`

전송 엔드포인트는 **하나뿐**이다(`/api/sessions`). 세션(=Claude Code `claude_session_id`) 단위로, 서버가 `id = sha256(device_id + ':' + claude_session_id)`로 **upsert**한다 — 그래서 매 실행이 그 세션의 "처음부터 지금까지 누적 총합"을 다시 계산해 보내야 하며(증분이 아님), 같은 payload를 재전송해도 최종 상태가 항상 같다(멱등, 안전).

payload 필드(실제 코드 `buildPayload()` 기준):

| 필드 | 값 |
|---|---|
| `claude_session_id` | 세션 ID 원문 그대로(**해시하지 않음** — 아래 §4 참고) |
| `started_at`/`ended_at`/`duration_seconds` | 세션 첫/마지막 로그 타임스탬프 |
| `repository_key` | git remote origin에서 추출한 `"owner/repo"`(없으면 필드 생략 → 서버가 project_id NULL 처리) |
| `plugin_version` | `plugin.json`의 malgn-agent 버전 |
| `model` | 그 세션에서 가장 많이 쓰인 모델 |
| `input_tokens`/`output_tokens`/`cache_read_tokens`/`cache_write_tokens` | 누적 토큰 |
| `turns`/`api_calls` | 사용자 프롬프트 수 / usage 필드가 있는 assistant 라인 수 |
| `tool_calls`/`tool_errors` | 도구 호출 수 / `tool_result.is_error===true` 카운트 |
| `retries`/`commits` | 항상 `0`(로그에 재시도·커밋 개념이 없어 근사 없이 상수 전송 — 과도한 엔지니어링 회피) |
| `files_read`/`files_changed` | Read 호출 수 / Edit·Write 호출 수 |
| `summary` | 첫 사용자 프롬프트를 120자로 truncate한 "세션 제목"(§3 예외) |

인증은 `Authorization: Bearer <device_token>` — device_token은 pairing 시 발급된 값 그대로이며, **scope 개념이 없다**(§5).

## 3. 핵심 결정 요약 — 왜 이렇게 설계됐나

- **집계 수치만 전송한다**: 프롬프트 원문, cwd 절대경로 원문, 도구 input 원문은 payload 어디에도 없다. `repository_key`도 절대경로가 아니라 git remote의 `owner/repo`만 추출.
- **`summary`는 유일한 예외**: 첫 사용자 프롬프트를 120자로 truncate해 전송한다. "세션ID만으론 무슨 세션인지 식별 불가"하다는 지적에 따른 국소 예외이며, 프롬프트 전문이나 도구 input 원문은 이 예외를 확장하지 않는다.
- **에이전트/도구별 상세분해는 서버로 가지 않는다**: `analyze-usage.mjs`(로컬 콘솔 진단, `token-usage-diagnosis` 스킬 전담)는 도구별·서브에이전트별·프로젝트별 표를 만들지만, `report-usage.mjs`는 그런 분해를 만들지 않고 세션 단위 총합만 보낸다. "반복 호출 패턴"처럼 도구 input 일부를 노출하는 표는 애초에 원격 전송 스키마에 존재하지 않는다.
- **`turns`/`api_calls`는 malgnai-public migration 0012로 추가됐다**: 이 두 필드는 처음부터 스키마에 있던 것이 아니라, 서버 쪽 `sessions`/`usage_daily` 테이블에 컬럼이 추가되면서 전송 바디에 채워 넣게 됐다(둘 다 optional, NOT NULL DEFAULT 0, 음수는 서버가 0으로 clamp).

## 4. 흔히 "당연히 있겠지"라고 기대하지만 실제로는 없는 것들

이런 파이프라인이면 으레 있으리라 기대하는 장치들이 여기엔 없다. 아래 표 오른쪽이 **코드 실측 정본**이다:

| 흔히 있으리라 기대하는 것 | 실제 구현 |
|---|---|
| `POST /api/usage/daily-aggregate` + `POST /api/usage/detail` 2개 엔드포인트, 날짜 단위 upsert | 엔드포인트 하나(`POST /api/sessions`), 세션 단위 upsert. **daily-aggregate 전용 엔드포인트 없음** — `usage_daily`는 서버가 세션 데이터로부터 자동 재집계하는 것으로 추정(별도 일별 전송 로직이 클라이언트에 없다) |
| `purpose="usage_report"` 파라미터로 전용 `usage:write` scope 토큰 발급 | `pair-usage-device.mjs`의 `pair-init` 바디는 `{device_id, device_name}`뿐 — **scope 개념 없이 범용 device_token을 그대로 사용**한다. MCP 인증과 별도 파일(`usage-agent-credentials.json`)에 저장한다는 "저장 위치 분리" 결정은 유지됐지만, "권한 범위 분리"는 구현되지 않았다 |
| `sessionId`를 `sessionKey = sha256(sessionId).slice(0,16)`로 해시해 전송(방어심층) | **해시하지 않는다** — `payload.claude_session_id = agg.sessionId`로 원문 UUID를 그대로 보낸다 |
| `projectKey = sha256(cwd).slice(0,16)` + `projectLabel = basename(cwd)` 이중 전송 | `repository_key`(git remote `owner/repo`) 하나만 전송. cwd 해시나 basename 라벨은 없음 |
| `expiresAt`(180일 TTL) + 만료 임박 헬스체크 항목 | credentials 파일에 `expiresAt` 필드 자체가 없다(`{device_id, device_name, device_token, paired_at}`만 저장) — **만료 개념이 구현에 없다**. 헬스체크 스킬(`skills/usage-agent-healthcheck`)도 이 실제 동작에 맞춰 만료 확인 항목을 넣지 않았다 |
| PID 락 파일(`usage-report.lock`)로 동시 실행 방지 | 코드에 락 파일 구현 없음 |
| 날짜별 상태 파일 `usage-report-state.json`(`lastSyncedDate` 등) | 실제 파일명·필드명이 다르다 — `usage-agent-last-run.json`(`last_run_at`/`last_success_at`/`since_used`/`sessions_considered`/`sent_success`/`sent_fail`/`last_error`) |
| Windows도 macOS와 동일하게 로그 파일 기록 | 실제로도 동일하게 기록한다 — `installWindows()`가 `cmd /c "... >> out.log 2>> err.log"`로 감싸 macOS와 동일하게 `usage-agent.out.log`/`.err.log`를 남긴다 |

**왜 이렇게 단순한가**: scope 분리·해시화·PID 락·상태파일 정교화는 "확인되지 않은 문제에 미리 대비하지 않는다(과설계 방지)"는 원칙에 따라 넣지 않은 것으로 보인다 — 이 문서는 코드에서 관찰되는 사실만 확정으로 적고, 그 사실의 이유는 추정임을 명시한다.

## 5. 유지보수 시 참고

- **재현 가능한 정본은 코드**: `bin/*.mjs` 4개 파일과 그 안의 주석(특히 `report-usage.mjs` 상단 주석의 "개인정보 하드 제약")이 실제 동작의 유일한 정본이다. 이 knowledge가 코드와 다르면 코드를 따른다.
- **비슷한 파이프라인을 또 만들 때**: 이 구현이 재사용한 패턴 — (1) 무의존성 Node 내장모듈만 사용(설치 없이 어디서나 실행), (2) 재집계+upsert로 멱등성 확보(증분 동기화의 체크포인트 손상 리스크 회피), (3) 실패해도 조용히 종료하고 다음 스케줄에 자연 복구(사용자를 방해하지 않는다는 `token-usage-diagnosis`와 동일한 "조용한 실패" 철학) — 는 유지할 가치가 있다. 반대로 위 §4의 "구현되지 않은 설계"들은 실제로 필요해지기 전까지는 다시 만들 필요가 없다는 신호로 읽을 수 있다(단, 이 판단 자체는 이 문서가 내리는 것이 아니라 다음 유지보수자가 실제 필요를 보고 판단할 사안이다).
- **헬스체크 스킬과의 관계**: `skills/usage-agent-healthcheck/SKILL.md`는 이 문서가 정리한 실제 구현(파일 경로·필드명·Windows 로그 부재 등)을 그대로 전제로 점검 절차를 짠다 — 두 문서 중 하나만 갱신하고 다른 쪽을 방치하면 드리프트가 생긴다.
