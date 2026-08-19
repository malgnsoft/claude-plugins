# 리뷰 보고서: 토큰 사용량 자동 수집 에이전트 — 실제 구현(코드) 배포 직전 최종 검증

- **날짜**: 2026-08-19
- **target_id**: `token-usage-collection-design-2026-08-19` (3차 — 앞선 1·2차는 설계 문서만 검증, **이번이 실제 코드의 첫 검증이자 배포 직전 최종 게이트**)
- **등급**: Sensitive (전 직원 PC 무인 자동실행 + malgnai-hub 원격 전송, 비가역 대량 배포)
- **위임자**: PM (사용자가 "최종 완료되면 버전업하고 배포해줘"를 사전 승인, 이 검증에서 문제 없으면 바로 배포로 이어짐)
- **⚠️ 정직 보고**: 1·2차(설계 문서) 라운드의 `docs/reviewer/review-*.md` 산출물 파일을 이 저장소에서 찾지 못했다(`find` 결과 0건). INDEX.md·페르소나 파일들의 "적용 이력"은 1·2차가 실제로 진행됐음을 시사하지만(malgnai-hub decision `01m0c9ck8ytw1psj0y6wh9w91f` 등 인용), 그 라운드의 보고서 파일 자체는 이 리뷰 시점 기준 저장소에 없다 — 이번 3차 보고서가 이 target에 대한 유일하게 실재하는 리뷰 산출물 파일이다. (이 문제는 이번 라운드가 만든 것이 아니라 과거 세션의 산출물 게이트 누락으로 보이며, 이번 보고서 작성으로 시정한다.)

## 페르소나 구성 — 재사용/신규 표 (산출물 게이트)

| 페르소나 | 유형 | 재사용/신규 | 사유 |
|---|---|---|---|
| `persona-hub-schema-routing-consistency-auditor.md` | 수렴 | 재사용(3차) | "설계 주장을 실제 코드로 실측 대조"라는 역할개념이 정확히 일치. 이번엔 대상이 "설계 문서의 API 계약 서술"에서 "실제 구현된 `report-usage.mjs`의 payload 생성 코드"로 바뀌었을 뿐 검증 방법론은 동일 |
| `persona-privacy-leakage-auditor.md` | 수렴 | 재사용(3차) | "이 산출물이 실제로 무엇을 유출하는가"를 코드로 확인하는 역할개념 그대로 적용. 신규 발견(서로게이트 절단 버그)은 방법론 확장이지 새 역할개념 아님 |
| `persona-script-skill-consistency-auditor.md` | 수렴 | 재사용(3차) | "문서 서술 vs 코드 실측 1:1 대조"라는 역할개념이 SKILL.md/knowledge ↔ 실제 `bin/*.mjs` 대조에 그대로 적용 |
| `persona-telemetry-collection-necessity-challenger.md` | 발산 | 재사용(3차) | 근본 질문("자동 hourly 무인 전송이 애초에 필요한가")이 1·2차에서 미해소로 남았고, 이번 라운드는 그 질문에 답할 마지막 배포 전 기회 — 실제 구현(전체 재스캔 성장 구조)이 새 근거를 추가함 |
| `persona-unattended-agent-runtime-safety-auditor.md` | 수렴 | **신규** | 기존 `persona-hook-execution-safety-verifier.md`는 "Claude Code 세션 내 훅 상태기계" 전용으로 6대 요소가 그 대상에 고정되어 있어 재사용 불가. "OS 스케줄러가 세션 밖에서 몇 년간 무인 구동하는 프로세스의 크래시 복원력·진단채널·자원 성장"은 설계 문서 라운드에는 존재할 수 없었던 코드 레벨 전용 새 리스크 표면 — 신규 생성이 타당 |

INDEX.md 갱신 완료(`docs/reviewer/personas/INDEX.md`): 4개 재사용 파일의 "최근 재사용" 열 갱신 + 각 파일 "적용 이력"에 3차 항목 추가, 신규 1건 행 추가 + 라운드 노트 추가.

## 대상 파일 (전부 Read로 직접 확인)

- `malgn-agent/bin/usage-agent-lib.mjs`, `pair-usage-device.mjs`, `report-usage.mjs`, `install-usage-agent.mjs` (전체)
- `malgn-agent/skills/usage-agent-healthcheck/SKILL.md`, `malgn-agent/knowledge/architecture/usage-collection-agent-architecture.md`
- `malgn-agent/knowledge/README.md` / `agents/pm.md` / `agents/architect.md`의 보강 diff 부분
- 대조 기준(malgnai-public, 로컬 실재): `server/api/sessions.js`, `server/api/devices.js`, `server/dao/sessions.js`, `server/dao/device-pairings.js`, `server/dao/device-tokens.js`(간접), `mcp/device-auth.js`, `server/lib/usage-daily.js`, `migrations/0011_slim_sessions_usage_daily.sql`, `migrations/0012_add_turns_api_calls.sql`, `docs/schema.sql`(summary CHECK 부분)

## 종합 판정: 🟡 Amber — 경미 수정 후 배포 권장

**Critical 0건 · Major 1건 · Minor 3건 · Nit 1건 · Rethink 1건.** Critical이 없어 Red는 아니다. API 계약·개인정보 하드 제약·인증/페어링 흐름·멱등성 4대 핵심 항목은 전부 코드 실측으로 PASS 확인했다. 다만 **Windows 진단 공백(Major)** 은 전 직원 PC 중 상당수가 Windows일 가능성을 고려하면 "배포 후 언젠가 고친다"보다 "배포 전 또는 배포 직후 즉시" 처리를 권고한다 — 수정 비용이 낮고(schtasks 호출 인자에 리다이렉션 한 줄 추가 수준), 무인 실행 특성상 이 공백이 실제로 필요해지는 시점(누군가의 PC에서 조용히 멈췄을 때)엔 이미 늦다.

## 지적 사항

| # | 심각도 | 위치 | 문제 | 근거 | 개선안 | 담당 페르소나 |
|---|---|---|---|---|---|---|
| F-01 | 🟠 Major | `malgn-agent/bin/install-usage-agent.mjs` L130-144 `installWindows()` | `schtasks /create`에 stdout/stderr 리다이렉션이 전혀 없다. macOS는 `installMac()`이 plist에 `StandardOutPath`/`StandardErrorPath`(L93-96)를 지정해 `usage-agent.out.log`/`.err.log`를 남기지만 Windows 대응 로직이 없다 | 코드 실측(두 함수 나란히 대조). `report-usage.mjs`가 크래시(예: 스트림 에러가 최상위 `run().catch()`까지 도달)하면 `writeLastRun()` 자체가 호출되지 않아 `usage-agent-last-run.json`도 갱신 안 됨 → Windows에서는 "죽었다"와 "그냥 안 돌았다"를 구분할 방법이 없음 | `installWindows()`의 `/tr` 인자를 `cmd /c "\"<node>\" \"<script>\" >> \"<out.log>\" 2>>\"<err.log>\""` 형태로 감싸거나, node 실행을 감싸는 `.cmd` 래퍼 스크립트를 만들어 리다이렉션. 비용이 낮으니 배포 전 처리 권고 | unattended-agent-runtime-safety-auditor |
| F-02 | 🟡 Minor | `malgn-agent/bin/report-usage.mjs` L152-157 `truncateSummary()` | `text.slice(0, 119) + '…'`가 서로게이트 페어(이모지 등 BMP 밖 문자) 중간을 자르면 손상된(lone surrogate) 문자가 payload.summary에 실려 전송됨 — 실제 재현 확인(스크래치패드 스크립트로 `\ud83d…` 형태 손상 확인) | 직접 재현: 118자+이모지 2개(총 122 UTF-16 코드유닛) 문자열을 truncateSummary에 넣으면 `slice(0,119)`가 이모지 첫 서로게이트에서 잘려 lone surrogate가 남음 | 개인정보 유출은 아니고 세션 제목 표시 손상(Minor)일 뿐. `Array.from(text).slice(0, N).join('')` 방식(코드포인트 단위 truncate)으로 교체 권고 — 배포를 막을 사유는 아니고 후속 패치로 처리 가능 | privacy-leakage-auditor |
| F-03 | 🟡 Minor | `malgn-agent/bin/report-usage.mjs` `aggregateAllSessions()`(L178-262) + `install-usage-agent.mjs`(PID 락 없음) | 매 실행마다 `~/.claude/projects/**/*.jsonl` **전체**를 처음부터 재귀 탐색+재파싱(체크포인트/오프셋 없음). 동시 실행 방지(PID 락)도 없음 | 코드 실측 + `knowledge/architecture/usage-collection-agent-architecture.md` §5가 이미 "PID 락 파일 구현 없음"을 문서화된 의도적 단순화로 기록. 서버 upsert는 멱등이라(sessions.js `upsertFinal` ON CONFLICT) 동시 실행이 데이터 손상으로 이어지진 않음 | 지금(로그량 적은 day-1)은 문제 없음. 로그가 누적되는 몇 개월 후 실행시간이 스케줄 간격(1시간)에 근접/초과하면 CPU·배터리 부담 및 겹침 실행 빈도가 늘어날 수 있음 — "특정 조건(단일 실행 시간 초과 등)에서 재검토" 조건부 백로그로 추적 권고. 배포를 막을 사유 아님 | unattended-agent-runtime-safety-auditor |
| F-04 | ⚪ Nit | `malgn-agent/bin/pair-usage-device.mjs` L140-143 | 클라이언트가 `body.status === 'rejected' \|\| 'denied'`를 처리하지만, malgnai-public 실제 `device_pairings` 상태값은 `pending`/`approved`/`expired` 3종뿐(거절 엔드포인트 자체가 없음 — `grep -rn "reject\|denied" server/`로 확인, UI CSS 클래스 1건 외 무관) | grep 실측 | 현재는 도달 불가능한 방어적 죽은 코드일 뿐, 해가 없음. 정리 우선순위 낮음(Nit) | hub-schema-routing-consistency-auditor |
| F-05 | 🔵 Rethink | 전체 아키텍처 | "자동 hourly + 매번 전체 로그 재스캔"이라는 구조가, 로그가 누적될수록 스스로 비용이 커지는 설계라는 사실이 이번 코드 검증(F-03)으로 새로 확인됨 — 1·2차에서 미해소로 남았던 "수동 옵트인이 더 단순하지 않은가"라는 근본 질문에 힘을 싣는 추가 근거 | F-03과 동일 근거 + persona-telemetry-collection-necessity-challenger.md 적용 이력(1~3차) | 배포를 막을 사유는 아님(현재 규모에서 실질 비용 낮음). 다음 개정 사이클에서 (A) 수동 옵트인 sync 또는 (B) 파일 오프셋 기반 증분 파싱 중 하나를 재검토 권고 | telemetry-collection-necessity-challenger |

## 항목별 검증 결과 (PM 위임 1~7번 요청 대응)

### 1. API 계약 정확성 — ✅ PASS
`report-usage.mjs`의 `buildPayload()`가 만드는 payload 필드 전부(`claude_session_id`/`started_at`/`ended_at`/`duration_seconds`/`repository_key`/`plugin_version`/`model`/`input_tokens`/`output_tokens`/`cache_read_tokens`/`cache_write_tokens`/`turns`/`api_calls`/`tool_calls`/`tool_errors`/`retries`/`files_read`/`files_changed`/`commits`/`summary`)를 malgnai-public 실제 `server/api/sessions.js`(검증 로직)·`server/dao/sessions.js`(`upsertFinal` INSERT 컬럼 목록)·`migrations/0011`·`migrations/0012`와 필드명 단위로 전수 대조 — **불일치 0건**. `turns`/`api_calls`는 migration 0012로 `sessions`/`usage_daily` 양쪽에 `INTEGER NOT NULL DEFAULT 0`로 실제 배포됐고, 클라이언트도 `Math.max(0, ...)`로 음수 방지 후 동일 필드명으로 전송한다.

### 2. 개인정보 하드 제약 준수 — ✅ PASS (Minor 1건, F-02)
cwd 원문·도구 input 원문은 payload 어디에도 없음을 코드로 확인(전송 함수가 `agg.cwd`를 `deriveRepositoryKey()`에만 넘기고 payload에 직접 넣지 않음). `summary`는 `extractHumanPromptText()`(공백 정규화만, 원문 편집 없음) → `truncateSummary()`(120자 캡) 경로로만 만들어지며, 두 함수 다 실제로 존재하고 정확히 그 순서로 호출된다. **F-02(서로게이트 절단)** 만 Minor로 발견 — 표시 손상이지 정보 유출은 아님.

### 3. 인증/페어링 흐름 정확성 — ✅ PASS
`pair-usage-device.mjs`의 3단계(pair-init 무인증 → 브라우저 승인 → pair-status 폴링)가 malgnai-public `devices.js`의 `pair-init`(`{device_id, device_name}` 바디, `pairing_code`/`pairing_url`/`expires_in` 응답)·`pair-approve`·`pair-status`(raw_token 1회 노출 후 `consumeRawToken`으로 즉시 폐기) 계약과 정확히 일치. `expires_in` 기본값(서버 `PAIRING_TTL_SECONDS=600`, 클라이언트 폴백 `600`)도 일치. `device_token` 저장은 `writeJsonFileSecure()`가 `fs.writeFileSync(..., {mode: 0o600})` + 별도 `chmod600()` 이중 적용(POSIX만, Windows는 명시적으로 스킵) — 코드로 확인.

### 4. 멱등성/재전송 안전성 — ✅ PASS
`aggregateAllSessions()`가 매 실행마다 전체 로그를 처음부터 다시 읽어 세션별 "누적 총합"을 만들고(`newAgg`가 매번 0에서 시작, 델타 없음), `candidates` 필터링은 "이번에 보고할 세션 선정"에만 쓰이며 전송값 자체는 항상 전체 누적임을 코드로 확인. 서버 `sessions.js`의 `id = sha256(device_id:claude_session_id)` UPSERT(`ON CONFLICT DO UPDATE`)와 결합해 재전송이 실제로 멱등함을 재확인.

### 5. Windows 로깅 공백 — 🟠 Major 판정 (F-01)
"단순함 우선"으로 넘기기엔 무인 실행 환경에서 실질적 진단 불능을 초래하는 결함으로 판단. `usage-agent-last-run.json`은 정상 흐름(네트워크 실패·not_paired 등)에서는 충분한 정보(에러 메시지 포함)를 담지만, 크래시가 최상위 `run().catch()` 도달 전 발생하면 last-run.json 자체가 갱신되지 않아 이 파일만으로는 Windows 헬스체크가 불완전하다. 다만 SKILL.md가 이 공백을 정확히 알고 문서화했고("`last_run_at`이 오래되면 재설치" 폴백 경로 존재), 수정 비용이 낮아 Red까지 갈 사유는 아니라고 판단.

### 6. SKILL.md/knowledge 사실 정확성 — ✅ PASS
`launchctl list | grep com.malgnsoft.usage-agent`, `schtasks /query /tn MalgnsoftUsageAgent`, `~/.claude/malgnai-hub/usage-agent-credentials.json`/`usage-agent-last-run.json` 경로, last-run.json 필드 6개(`last_run_at`/`last_success_at`/`since_used`/`sessions_considered`/`sent_success`/`sent_fail`·`last_error`) 전부 실제 코드와 일치. credentials 파일 원문 노출 지시 없음(2번 단계가 boolean만 확인하도록 명시). **`claude_session_id`를 해시 없이 원문 UUID로 전송하는 것에 대해 knowledge 문서 §4가 "문제"가 아니라 "설계 대비 단순화 지점"으로 중립 서술**하고 있음을 확인 — PM 위임이 우려한 "잘못된 문제 프레이밍"은 발견되지 않음(정상).

### 7. 일반 코드 품질/안전성 — Minor 2건(F-03), Nit 1건(F-04)
예외 처리는 전반적으로 방어적(JSON 파싱 실패·네트워크 에러·git 미설치·userInfo 실패 등 개별 try/catch로 흡수). 남은 리스크는 F-01(Windows 로깅)·F-03(무제한 재스캔 성장 + PID 락 부재)로 이미 표에 반영.

## 잘된 점

- API 계약이 실제 배포된 malgnai-public 코드와 **전 필드 1:1 정확히 일치**한다 — 설계 문서 단계에서 이미 두 차례 검증했던 계약이 구현 단계에서도 흔들리지 않았다.
- 개인정보 하드 제약(cwd 원문·도구 input 원문 미전송)이 실제 코드로 지켜지고 있고, 설계 문서가 상정했던 더 위험한 필드(`projectLabel=basename(cwd)`)는 구현 단계에서 아예 빠졌다 — 노출면이 설계보다 오히려 줄었다.
- `knowledge/architecture/usage-collection-agent-architecture.md`가 "설계 문서와 실제 구현이 다르다"는 점을 숨기지 않고 표로 명시하며, 각 차이를 정확하고 중립적으로(버그로 오도하지 않고) 기록했다 — 유지보수자를 위한 좋은 정직성 사례.
- 실패 처리 철학("조용히 다음 세션으로, launchd/schtasks가 알아서 재시도")이 매시간·전사 규모라는 이 파이프라인의 특성에 잘 맞는다 — 사람 개입 없이도 자연 복구.
- 페어링 흐름의 raw_token 1회 노출 원칙이 클라이언트·서버 양쪽에서 정확히 대칭 구현됐다.

## 생략한 관점 / 못한 것 (정직 보고)

- **로컬 서버 실기동 검증 없음**: `report-usage.mjs`/`pair-usage-device.mjs`를 실제 malgnai-hub 서버에 대고 end-to-end로 돌려보지는 않았다(코드 대조로 계약 일치를 확인했을 뿐 실기동 왕복은 안 함). device_token 실물이 없어 이 세션에서 실행 불가 — 실기동은 첫 페어링 시 담당자가 직접 1회 확인 필요.
- **Windows 실기동 미검증**: `installWindows()`/`schtasks` 등록을 실제 Windows PC에서 실행해보지 않았다(이 개발 환경이 macOS). F-01 판단은 코드 정적 분석 기준.
- **부하/장기 성능 실측 없음**: F-03(전체 재스캔 성장)은 코드 구조 분석 기준 판단이며, 실제 대용량 로그(예: 수 GB `.claude/projects`)에서의 실행 시간을 측정하지는 않았다.
- **UI 리뷰 해당 없음**: 이번 대상은 백그라운드 스크립트+문서라 화면 캡처는 스코프 밖(생략 사유 명확).

## PM 권고

1. **F-01(Windows 로깅)은 배포 전 또는 배포 직후 즉시 패치를 권고**한다 — 비용이 낮고, 무인실행 환경에서 나중에 필요해지면 이미 늦은 종류의 결함이다. 다만 이것이 배포 자체를 막을 Critical은 아니므로, "지금 바로 5분짜리 패치 후 배포" 또는 "지금 배포하고 즉시 다음 커밋으로 패치" 둘 다 합리적 선택지다 — PM/사용자 판단에 맡긴다.
2. F-02(서로게이트 절단)·F-03(전체 재스캔 성장)·F-04(죽은 코드)는 배포를 막지 않고 백로그로 추적 가능.
3. F-05(Rethink)는 다음 개정 사이클 후보로 STATUS.md에 남기는 것을 권고 — 근본 질문("자동 hourly가 최선인가")이 세 번째 라운드에도 답해지지 않은 채 배포로 넘어가는 것이므로, 이 결정이 "재검토했지만 유지"가 아니라 "아직 답하지 않았다"는 사실을 기록으로 남겨야 다음 세션이 오인하지 않는다.
4. **실행 액션 관련**: 이 리뷰는 검증만 수행했고, 버전업(`plugin.json`)·`git push origin main` 등 배포 실행은 **하지 않았다**. reviewer 역할 경계(검증≠실행)에 따라 실제 배포는 PM(또는 사용자 승인에 따른 담당 에이전트)이 진행해야 한다.
