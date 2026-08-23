---
name: usage-agent-healthcheck
description: 직원 PC에 설치된 토큰 사용량 자동 수집 에이전트(`bin/report-usage.mjs`가 launchd/schtasks로 매시간 실행되며 malgnai-hub `POST /api/sessions`로 전송)가 제대로 등록·페어링·전송되고 있는지 점검한다. 미설치 시 `install-usage-agent.mjs` 설치 안내, 등록/페어링/최근 전송 상태를 순서대로 확인해 원인을 안내하고, `--dry-run`으로 네트워크 전송 없이 안전하게 재현한다. "토큰 수집 에이전트 제대로 돌고 있어?", "사용량 보고 왜 안 되지?", "이거 아직 설치 안 했는데" 같은 요청이 오면 PM이 위임하거나, 어느 에이전트든 사용자가 직접 요청 시 바로 사용한다. 개인의 토큰 사용 패턴 자체를 분석하는 `token-usage-diagnosis`와는 대상이 다르다 — 이 스킬은 수집 파이프라인(에이전트) 자체의 배관이 건강한지만 본다.
---

# Usage Agent Healthcheck Skill

## Definition

맑은소프트 전 직원 PC에는 `~/.claude/projects/**/*.jsonl`(Claude Code 로컬 세션 로그)을 집계해 malgnai-hub로 매시간 자동 전송하는 백그라운드 에이전트가 설치된다(`bin/report-usage.mjs`, macOS는 launchd, Windows는 작업 스케줄러가 구동). 이 스킬은 그 파이프라인이 **한 직원 PC에서** 제대로 등록·페어링되어 있고 최근에 정상적으로 실행됐는지 확인하고, 문제가 있으면 원인별로 어떻게 고치는지 안내한다.

- **대상**: `token-usage-diagnosis`와 마찬가지로 특정 소수 에이전트 전용이 아니다. PM이 위임하거나(Micro 등급), 세션 중인 어느 에이전트든 사용자가 물으면 바로 실행한다.
- **역할 경계**: 이 스킬은 **수집 파이프라인 자체**(등록 여부·페어링 여부·최근 전송 성공 여부)를 점검한다. 수집된 데이터를 바탕으로 "내가 토큰을 왜 이렇게 많이 썼는지" 분석하는 것은 `token-usage-diagnosis`의 역할이다 — 둘은 서로 다른 질문에 답한다.
- **하지 않는 것**: 자동 재설치·재시도·알림 트리거를 만들지 않는다. 확인하고 원인을 안내하는 데서 끝난다 — 실제 설치/재설치/제거 명령 실행은 사용자 승인 하에 아래 안내된 명령을 그대로 실행하는 것뿐이다.

## 대상 파일 (모두 `${CLAUDE_PLUGIN_ROOT}/bin/`)

| 파일 | 역할 |
|---|---|
| `usage-agent-lib.mjs` | 공용 헬퍼(credentials/last-run 파일 IO, https 요청, git remote 기반 repository_key 추출). 단독 실행 안 됨 |
| `pair-usage-device.mjs` | malgnai-hub 디바이스 페어링(pair-init → 브라우저 승인 → pair-status 폴링) → `device_token` 저장 |
| `report-usage.mjs` | 세션 로그 집계 + malgnai-hub 전송 + 결과를 last-run 파일에 기록. 매시간 자동 실행되는 실제 작업 스크립트 |
| `install-usage-agent.mjs` | `report-usage.mjs`가 매시간 자동 실행되도록 OS 스케줄러(launchd/schtasks)에 등록/해제 |

이 4개 파일은 이미 완성·검증된 코드다 — 이 스킬은 이 파일들을 **읽지 않고 그대로 실행**만 한다. 수정하지 않는다.

## 설치 안내 (자연어 → 명령 매핑)

`token-usage-diagnosis`와 같은 패턴 — 사용자 표현을 명령으로 그대로 대응시킨다.

| 사용자 표현 예시 | 명령 |
|---|---|
| "아직 설치 안 했는데", "이거 어떻게 켜?" | `node ${CLAUDE_PLUGIN_ROOT}/bin/install-usage-agent.mjs` |
| "제대로 돌고 있어?", "잘 되고 있나 확인해줘" | 아래 "헬스체크 절차" 순서대로 실행 |
| "그만 보내고 싶어", "꺼줘" | `node ${CLAUDE_PLUGIN_ROOT}/bin/install-usage-agent.mjs --uninstall` |
| "새 PC로 옮겼어", "페어링부터 다시" | `node ${CLAUDE_PLUGIN_ROOT}/bin/pair-usage-device.mjs --force` 실행 후 `install-usage-agent.mjs` 재실행 |
| "전송 없이 확인만 해줘" | `node ${CLAUDE_PLUGIN_ROOT}/bin/report-usage.mjs --dry-run` |

`install-usage-agent.mjs`는 옵션 없이 실행하면 **페어링이 안 되어 있을 때 자동으로 `pair-usage-device.mjs`부터 실행**한다(브라우저가 열리고 사람의 승인 클릭이 필요하므로, 반드시 사람이 있는 터미널에서 실행해야 한다 — TTY 없는 자동화 파이프라인에서 실행하지 않는다). 이미 페어링되어 있으면 그 단계는 건너뛰고 스케줄러 등록만 진행한다.

## 헬스체크 절차

순서대로 확인한다. 앞 단계에서 이미 문제가 발견됐다면 뒤 단계는 참고용으로만 확인해도 된다.

### 1. OS별 등록 상태 확인

- **macOS**:
  ```bash
  launchctl list | grep com.malgnsoft.usage-agent
  ```
  결과가 없으면 미등록. 있으면 `com.malgnsoft.usage-agent` 라벨과 함께 PID(실행 중이면)/마지막 종료 코드가 보인다.
- **Windows**:
  ```
  schtasks /query /tn MalgnsoftUsageAgent
  ```
  작업이 없으면 "지정된 작업 이름을 찾을 수 없습니다" 류 에러가 뜬다 — 미등록으로 판단.

### 2. 페어링 여부 확인 — credentials 파일

```bash
ls -la ~/.claude/malgnai-hub/usage-agent-credentials.json
```

파일이 없으면 페어링이 안 된 상태다. 있으면 **내용 전체를 출력하지 말고** `device_id`와 `paired_at`만 확인한다(`device_token` 원문은 노출 금지 — 아래 "개인정보 유의" 참고):

```bash
node -e "const c=JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/malgnai-hub/usage-agent-credentials.json','utf8')); console.log('device_id:', c.device_id, '/ paired_at:', c.paired_at, '/ token 존재:', !!c.device_token)"
```

### 3. 마지막 실행 결과 확인 — last-run 파일

```bash
cat ~/.claude/malgnai-hub/usage-agent-last-run.json
```

`report-usage.mjs`가 매 실행 후 기록하는 실제 필드(코드 기준, 추측 아님):

| 필드 | 의미 |
|---|---|
| `last_run_at` | 이 실행이 언제 돌았는지(ISO 8601). **지금과 1~2시간 이상 차이나면** 스케줄러가 최근에 안 돌았다는 신호 |
| `last_success_at` | 마지막으로 "완전히 성공"(대상 세션 0건이거나 실패 0건)한 시각. 실패가 하나라도 있으면 이 값이 갱신되지 않고 다음 실행이 같은 지점부터 재시도한다 |
| `since_used` | 이번 실행이 어느 시점 이후 세션을 대상으로 삼았는지 |
| `sessions_considered` | 이번에 전송 대상으로 고른 세션 수 |
| `sent_success` / `sent_fail` | 전송 성공/실패 건수 |
| `last_error` | 실패가 있었다면 그 상세(`{sessionId, status, error}` 형태). 페어링이 안 된 상태로 실행됐다면 문자열 `"not_paired"` |

`last_run_at`이 최근이고 `sent_fail`이 0이면 정상. `last_error`가 `"not_paired"`면 2번 단계로, 그 외 값이면 4번 단계(에러 로그)로 넘어간다.

### 4. 에러 로그 확인 (macOS/Windows 공통)

```bash
# macOS
tail -30 ~/.claude/malgnai-hub/usage-agent.err.log
# Windows(PowerShell)
Get-Content "$env:USERPROFILE\.claude\malgnai-hub\usage-agent.err.log" -Tail 30
```

두 OS 모두 `install-usage-agent.mjs`가 stdout/stderr를 `~/.claude/malgnai-hub/usage-agent.out.log`/`.err.log`로 리다이렉트한다(macOS는 launchd plist의 `StandardOutPath`/`StandardErrorPath`, Windows는 `schtasks` 등록 시 `cmd /c ... >> out.log 2>> err.log`로 감싸는 방식 — 2026-08-19 reviewer 지적 F-01 반영). 이 로그가 비어있는데도 문제가 의심되면 3번 단계의 `last_error` 필드와 아래 5번 단계의 `--dry-run` 재현으로 넘어간다.

### 5. 수동 재현 (필요시)

```bash
node ${CLAUDE_PLUGIN_ROOT}/bin/report-usage.mjs --dry-run
```

`--dry-run`은 **실제 전송 없이** 대상 세션별 payload를 콘솔에 그대로 출력한다. `device_token`이 없어도 실행할 수 있다(페어링 여부와 무관하게 집계 로직 자체가 도는지 확인 가능) — 네트워크 전송이 일어나지 않으므로 안전하게 여러 번 실행해도 된다.

## 자주 있는 문제 진단

| 증상 | 원인 확인 | 조치 |
|---|---|---|
| 1번 단계에서 등록 자체가 없음 | 미설치 | `node ${CLAUDE_PLUGIN_ROOT}/bin/install-usage-agent.mjs` 실행(사람 있는 터미널에서, 브라우저 승인 필요할 수 있음) |
| 2번 단계에서 credentials 파일 없음, 또는 3번의 `last_error`가 `"not_paired"` | 페어링 안 됨(등록만 되고 페어링 전 상태이거나, credentials 파일이 삭제됨) | `node ${CLAUDE_PLUGIN_ROOT}/bin/pair-usage-device.mjs` 실행 |
| 등록은 있는데(1번 정상) `last_run_at`이 아주 오래됨 | PC가 꺼져 있었거나 launchd/스케줄러가 죽었을 가능성 | 우선 PC가 최근 켜져 있었는지 확인. 켜져 있었는데도 오래됐다면 재설치로 등록을 다시 건다: `node ${CLAUDE_PLUGIN_ROOT}/bin/install-usage-agent.mjs`(아래 "재설치 안전성" 참고). PC가 꺼져 있었던 것뿐이라면 **자동 복구된다** — `report-usage.mjs`는 마지막 성공 시점 이후를 최대 30일까지 catch-up 하도록 `since` 커트오프를 계산하므로, 다음 정상 실행이 밀린 기간을 알아서 채운다 |
| `sent_fail > 0`, `last_error`에 네트워크/상태코드 에러 | malgnai-hub 서버 문제 또는 네트워크 단절 | 그 자체로는 별도 조치 불필요 — 실패한 세션은 `last_success_at`이 갱신되지 않으므로 **다음 실행이 자동으로 같은 지점부터 재시도**한다(재시도 로직이 코드에 내장돼 있음, 사람이 개입할 필요 없음). 반복적으로 실패하면 5번 단계로 원인을 더 들여다본다 |
| 페어링됐는데도 계속 `not_paired` 뜸 | credentials 파일은 있는데 `device_token` 필드가 비어있거나 손상 | credentials 파일을 지우고 `node ${CLAUDE_PLUGIN_ROOT}/bin/pair-usage-device.mjs`로 재페어링 |

### 재설치 안전성

`install-usage-agent.mjs`(옵션 없이)를 다시 실행해도 안전하다 — macOS `installMac()`은 기존 launchd 등록을 `launchctl unload`로 먼저 내리고(실패해도 무시) plist를 새로 쓴 뒤 다시 `load`한다. 페어링도 이미 `device_token`이 있으면 재페어링 없이 건너뛴다(`ensurePaired()`). 즉 "일단 다시 설치해봐"가 안전한 1차 대응이다.

`--uninstall`은 **OS 스케줄러 등록만 해제**한다(macOS: launchd unload+plist 삭제 / Windows: schtasks 삭제) — `~/.claude/malgnai-hub/`의 credentials·last-run 파일은 지우지 않는다. 완전히 정리하려면 그 디렉터리를 사용자가 직접 정리해야 한다는 점을 안내한다(이 스킬이 대신 지우지 않는다 — 자동 정리는 이 스킬의 범위 밖).

## 개인정보 유의

- **credentials 파일 내용을 그대로 출력하지 않는다.** `device_token` 원문은 malgnai-hub API 인증에 쓰이는 비밀값이다 — 헬스체크 결과에 절대 그대로 노출하지 않는다. 위 2번 단계 명령처럼 `device_id`/`paired_at`/토큰 존재 여부(boolean)까지만 확인한다.
- **에러 로그 원문을 무분별하게 전체 공유하지 않는다.** 4번 단계 로그에는 서버 응답 에러 메시지나 세션ID가 섞여 나올 수 있다 — 진단 목적으로 필요한 부분만 인용하고, 다른 사람과 공유하기 전에 내용을 한 번 확인한다(`token-usage-diagnosis`의 "malgnai-hub 등 중앙 저장소에 원문 그대로 기록 금지" 원칙과 같은 정신).
- last-run 파일(`usage-agent-last-run.json`)은 집계 건수·시각만 담고 있어 상대적으로 안전하지만, `last_error` 안에 세션ID가 들어갈 수 있으니 역시 원문 그대로 중앙 기록(work_record 등)에 옮기지 않는다 — 요약 결론만 남긴다.

## Integration Notes

- **PM(게이트웨이) 처리**: VSCode COO 게이트웨이로 들어온 "토큰 수집 에이전트 상태 확인" 요청은 PM이 Micro 등급으로 직접 처리한다(전문 에이전트 위임 불요) — `common-task-grading-and-verification-depth` 참고.
- **`token-usage-diagnosis`와의 관계**: 이 스킬은 수집 파이프라인의 배관(등록·페어링·전송)만 본다. "수집은 잘 되고 있는데 내가 토큰을 왜 이렇게 많이 썼는지"는 별개 질문이며 `token-usage-diagnosis`가 담당한다 — 필요하면 두 스킬을 이어서 안내한다.
- **아키텍처 배경**: 이 파이프라인이 왜 이렇게(4개 스크립트 분리, `POST /api/sessions` 단일 엔드포인트, device_token 인증 등) 설계됐는지는 이 스킬의 범위가 아니다 — `knowledge/architecture/usage-collection-agent-architecture.md`를 참고한다(유지보수·재설계 판단이 필요할 때).
