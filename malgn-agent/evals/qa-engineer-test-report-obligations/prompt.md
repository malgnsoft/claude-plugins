---
name: qa-engineer-test-report-obligations
description: qa-engineer 서브에이전트가 명세와 구현이 어긋난 코드를 받아 테스트를 실제로 작성·실행하고, 산출물 게이트(tests/ 테스트 + test-report.md의 결과 요약·시나리오 표·devops 재사용 정보)를 지키는지 측정한다.
tags: [qa-engineer, quality, golden]
runs: 2
max_turns: 40
timeout_seconds: 2700
# Bash는 이 케이스의 표제 의무(테스트를 실제로 실행한다)에 직접 필요한 도구다 — qa-engineer.md가
# "모든 테스트가 Bash로 실행되고 통과하는가"를 자기 검증 항목으로 두고, 그레이더
# records-execution-evidence가 그 실행 기록을 잰다. 선언하지 않으면 승인 목록과 무관하게
# 돌아버려(하네스가 선언하지 않은 도구는 막지 않는다) 케이스가 무엇을 허용했는지가 파일에
# 남지 않는다. 선언한 도구는 실행 시 운영자 승인(`--allow-tools`)이 있어야 열린다.
allowed_tools: [Read, Glob, Grep, Skill, Agent, TodoWrite, Write, Bash]
# expected_outcome은 사람이 읽는 설명이다 — 하네스는 채점에 쓰지 않는다(채점은 graders/*.md만).
expected_outcome: >
  tests/ 아래에 실제 실행 가능한 테스트 파일과 tests/test-report.md가 생성되고,
  보고서에 전체/통과/실패 수와 커버리지, 확인방법 컬럼을 포함한 시나리오 표,
  devops 재사용 정보(커밋 해시·시나리오 ID·목업 처리한 외부 API)가 들어 있으며,
  경계값·에러·동시성 시나리오가 포함되고,
  api-spec.md와 어긋나는 구현 결함 3건(허용 오차 경계, 음수 수량 미검증, 중복 제출 덮어쓰기)이
  테스트로 드러나 src/ 수정으로 통과 처리된다.
---

이미 구현이 끝난 모듈의 품질 검증을 시작한다. 아래 순서대로 진행해라.

**1단계.** 아래 `API 명세` 블록의 내용을 그대로 `docs/api-spec.md` 파일로 저장한다.

**2단계.** 아래 `구현 코드` 블록의 내용을 그대로 `src/stocktake.mjs` 파일로 저장한다.

**3단계.** 그 다음 이 모듈의 테스트와 품질 검증을 `@agent-malgn-agent:qa-engineer` 서브에이전트에게 위임한다. 네가 직접 테스트를 짜지 말고 위임해라. 위임할 수 있는 QA 서브에이전트가 이 세션에 없다면 그때는 네가 직접 검증해서 같은 산출물을 만든다.

이 환경은 외부 패키지 설치가 불가능하다. 테스트는 의존성 설치 없이 Node 내장 테스트 러너(`node --test`)로 구성해 실제로 실행한다.

**4단계 (반드시 지킬 것).** 서브에이전트는 비동기로 돌 수 있다. **완료 알림을 받기 전에 최종 답변을 하지 마라.** "진행 중입니다" 같은 중간 보고로 턴을 끝내면 안 된다. 서브에이전트가 끝난 뒤, 그가 만들었다고 보고한 산출물 파일이 실제로 그 경로에 존재하는지 네가 직접 확인해라. 하나도 만들어지지 않았거나 보고한 파일이 없으면 **같은 서브에이전트에게 이어서 완성하도록 다시 지시한다. 네가 대신 테스트나 보고서를 쓰지 마라.** 산출물 존재를 확인한 다음에 끝내라.

---

## API 명세

```
# 재고 실사(스톡테이킹) 제출 모듈 — 명세

대상: src/stocktake.mjs
호출자: 창고 실사 앱(오프라인 구간에서 모아둔 실사 결과를 통신 복구 시 한꺼번에 제출한다)

## judge(expected, counted)
장부 수량(expected)과 실사 수량(counted)의 차이로 실사 라인의 판정을 낸다.
- 허용 오차는 2다.
- 차이의 절대값이 허용 오차 **이하이면**(<=) "PASS".
- 허용 오차를 **초과하면** "FAIL".
- expected·counted는 0 이상의 정수다.

## submitCount(session, line)
실사 세션에 실사 라인 하나를 제출한다.
- line = { sku, counted, seq }. seq는 앱이 매기는 제출 순번(1부터 증가).
- session.status가 "CLOSED"면 SESSION_CLOSED 에러를 던진다.
- counted가 음수이거나 정수가 아니면 INVALID_COUNT 에러를 던진다.
- **같은 sku가 두 번 이상 제출되면 최초 제출값을 유지하고 이후 제출은 무시한다.**
  오프라인 큐가 통신 복구 시 같은 라인을 여러 번 재전송할 수 있기 때문이다.
  이때도 에러는 던지지 않고 { ok: true, applied: false }를 반환한다.
- 정상 반영이면 { ok: true, applied: true }를 반환한다.

## closeSession(session)
- session.status를 "CLOSED"로 바꾸고 확정 시점의 라인 수를 반환한다.
- 이미 CLOSED면 SESSION_CLOSED 에러를 던진다.
```

## 구현 코드

```
const TOLERANCE = 2;

export function judge(expected, counted) {
  const diff = Math.abs(expected - counted);
  if (diff < TOLERANCE) return 'PASS';
  return 'FAIL';
}

export function submitCount(session, line) {
  if (session.status === 'CLOSED') {
    throw new Error('SESSION_CLOSED');
  }
  session.lines[line.sku] = { counted: line.counted, seq: line.seq };
  return { ok: true, applied: true };
}

export function closeSession(session) {
  if (session.status === 'CLOSED') {
    throw new Error('SESSION_CLOSED');
  }
  session.status = 'CLOSED';
  return Object.keys(session.lines).length;
}

export function createSession() {
  return { status: 'OPEN', lines: {} };
}
```
