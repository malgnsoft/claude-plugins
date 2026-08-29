#!/usr/bin/env node
// Stop hook: 세션 종료 시 malgnai-hub 기록 여부를 자가 점검하도록 리마인드.
// hook은 세션 내용을 알 수 없으므로, "기록할 거리가 있었다면 남겼는지" 스스로 확인하라는
// 지침을 주입한다. 기록할 게 없던 세션이면 무시하면 된다(노이즈 최소화).
//
// 무한 루프 방지: Stop hook이 또 다른 Stop을 유발하지 않도록 stop_hook_active를 확인한다.
//
// 휴리스틱(2026-07-03 추가): 매 턴마다 무조건 리마인더를 띄우면 단순 질의응답까지
// 전부 추가 턴을 강제해 과하다는 지적(대표)을 받아 도입. transcript_path로 "이번 턴"
// 범위(마지막 진짜 사용자 메시지 이후)의 tool_use만 훑어 판단한다:
//   - 이미 malgnai-hub 기록 도구를 썼다 → 리마인더 불필요(스킵)
//   - Edit/Write/Bash/Agent/Workflow 등 실질 작업 도구를 썼는데 기록은 안 했다 → 리마인더 필요
//   - Read/Grep 등 조회성 도구만 썼거나 아무 도구도 안 썼다 → 트리비얼로 간주(스킵)
// 파싱 실패/불확실하면 항상 안전한 쪽(리마인더 표시)으로 폴백한다 — 기록 누락 방지가
// 노이즈 감소보다 우선.

const fs = require("fs");

const WRITE_TOOL_RE = /^(Edit|Write|NotebookEdit|Bash|PowerShell|Agent|Workflow)$/;

// 기록 도구 판정은 "접두어 무관"이어야 한다 (2026-08-24 수리).
// MCP 도구의 실제 이름은 `mcp__<서버등록명>__<도구명>` 이고, 서버등록명은 설치 형태마다 다르다:
//   - 플러그인 설치(이 제품의 표준 경로) → mcp__plugin_malgn-agent_malgnai-hub__decision_record
//   - .mcp.json 등에 직접 등록          → mcp__<사용자가 정한 이름>__decision_record
// 종전 정규식은 `mcp__malgnai-hub__…` 한 형태만 봤기 때문에 플러그인 설치본에서 단 한 번도
// 매치되지 않았고("이미 기록했으면 스킵" 억제가 통째로 죽어 있었다), 방금 기록을 남긴 턴에도
// 리마인더가 떴다. 그래서 접두어는 와일드카드로 두고 **도구명(뒷부분)으로만** 판정한다.
const RECORD_VERBS = "decision_record|issue_record|issue_resolve|work_record";
const MCP_RECORD_TOOL_RE = new RegExp("^mcp__[\\w.-]+__(?:" + RECORD_VERBS + ")$");

// 리마인더 본문이 안내하는 이름도 "그 설치본에 실재하는 이름"이어야 한다 — 접두어 없는 이름을
// 그대로 따라 부르면 도구를 못 찾는다. 트랜스크립트 원문에서 실제 쓰인 접두어를 학습하고,
// 학습에 실패하면 이 제품의 표준 설치 경로(플러그인) 이름으로 폴백한다.
const DEFAULT_TOOL_PREFIX = "mcp__plugin_malgn-agent_malgnai-hub__";
// 학습 앵커는 **서버 등록명(`malgnai-hub`)**이지 도구명이 아니다. 도구명으로 접두어를 학습하면
// issue_resolve·work_record 처럼 구 provider(malgnai-mcp)와 겹치는 이름 때문에 엉뚱한 서버의
// 접두어를 물어온다 — 그 서버엔 decision_record 가 없어서, 결국 "없는 도구 이름"을 안내하게 된다
// (2026-08-24 A/B 중 실제로 재현됨). 그래서 hub 서버명이 박힌 이름만 학습하고, 못 찾으면
// 이 제품의 표준 설치(플러그인) 이름으로 폴백한다.
const PREFIX_FROM_HUB_RE = /"(mcp__[\w.-]*malgnai-hub__)\w+"/;

function detectToolPrefix(raw) {
  if (typeof raw !== "string") return DEFAULT_TOOL_PREFIX;
  const m = raw.match(PREFIX_FROM_HUB_RE);
  return m ? m[1] : DEFAULT_TOOL_PREFIX;
}

// 이번 턴(마지막 진짜 사용자 메시지 이후)을 1회 스캔해 필요한 신호를 모아 반환한다.
//   alreadyRecorded : MCP 기록 도구(decision_record/issue_record/issue_resolve/work_record)를 이미 썼다
//   hasWriteSignal  : Edit/Write/Bash/Agent 등 실질 작업 도구를 썼다
//   toolPrefix      : 이 설치본에서 실제로 쓰이는 MCP 도구 접두어(리마인더 본문에 그대로 쓴다)
// 반환 null = 트랜스크립트 판단 불가(안전측 폴백 — 기록 리마인더는 표시).
function analyzeTurn(transcriptPath) {
  if (!transcriptPath) return null;
  let raw, lines;
  try {
    raw = fs.readFileSync(transcriptPath, "utf8");
    lines = raw.split("\n").filter(Boolean);
  } catch (_) {
    return null;
  }
  // 접두어 학습은 이번 턴이 아니라 트랜스크립트 전체에서 한다 — 리마인더가 뜨는 턴은
  // 정의상 기록 도구를 안 쓴 턴이라, 그 턴만 봐서는 접두어를 알 수 없다.
  const toolPrefix = detectToolPrefix(raw);

  let turnStart = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch (_) {
      continue;
    }
    if (obj.type === "user" && obj.message) {
      const content = obj.message.content;
      const isToolResultOnly =
        Array.isArray(content) && content.length > 0 && content.every((c) => c.type === "tool_result");
      if (!isToolResultOnly) {
        turnStart = i;
        break;
      }
    }
  }
  if (turnStart === -1) return null;

  let alreadyRecorded = false;
  let hasWriteSignal = false;
  for (let i = turnStart; i < lines.length; i++) {
    let obj;
    try {
      obj = JSON.parse(lines[i]);
    } catch (_) {
      continue;
    }
    if (obj.type !== "assistant" || !obj.message || !Array.isArray(obj.message.content)) continue;
    for (const block of obj.message.content) {
      if (!block) continue;
      if (block.type !== "tool_use" || typeof block.name !== "string") continue;
      if (MCP_RECORD_TOOL_RE.test(block.name)) alreadyRecorded = true;
      if (WRITE_TOOL_RE.test(block.name)) hasWriteSignal = true;
    }
  }

  return { alreadyRecorded, hasWriteSignal, toolPrefix };
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    // JSON.parse("null")은 예외 없이 null을 반환한다 — stdin이 문자열 "null"이면 parsed가
    // null이 되어 아래 payload.stop_hook_active 접근에서 TypeError가 나고, 그 TypeError는 이
    // catch가 삼켜 조용히 넘어가지만 payload는 null로 남는다. 뒤(analyzeTurn 호출부)에서
    // payload.transcript_path 접근 시 이 catch 밖이라 그대로 크래시한다. 그래서 파싱 직후
    // null/비객체(예: 숫자·문자열)를 걸러 항상 객체로 정규화한다 — 배열(`[]`)은 이미 object라
    // 그대로 둬도 안전(뒤 접근이 전부 undefined일 뿐 throw 없음).
    const parsed = input ? JSON.parse(input) : {};
    payload = parsed && typeof parsed === "object" ? parsed : {};
    if (payload.stop_hook_active) {
      process.exit(0); // 이미 Stop hook으로 재진입한 상태면 아무것도 안 함
    }
  } catch (_) {}

  // 무인 헤드리스 워커 예외: 자율 워커(예: malgnai poll-commands.js가 spawn하는 claude -p)는
  // "오직 지정된 JSON 하나만" 출력해야 한다(서버 파서가 그것만 먹는다).
  // 이 hook이 stop을 block하고 리마인더를 주입하면 모델이 추가 턴을 만들어
  // 그 후기 텍스트가 result 를 덮어써 JSON 계약이 깨진다(라이브 버그 원인).
  // 헤드리스 워커 spawn 쪽이 MALGNAI_HEADLESS_WORKER=1 을 심어주면 그걸로 예외처리한다
  // (특정 프로젝트 폴더명 하드코딩은 프로젝트가 바뀌면 매번 깨지므로 쓰지 않는다).
  if (process.env.MALGNAI_HEADLESS_WORKER === "1") {
    process.exit(0);
  }

  const a = analyzeTurn(payload.transcript_path);
  // 판단 불가(null) → 안전측(리마인더 표시)으로 폴백.
  const analysis = a || { alreadyRecorded: false, hasWriteSignal: true, toolPrefix: DEFAULT_TOOL_PREFIX };
  const T = analysis.toolPrefix || DEFAULT_TOOL_PREFIX;

  const needRecord = analysis.hasWriteSignal && !analysis.alreadyRecorded;
  if (!needRecord) {
    process.exit(0); // 불필요 → 트리비얼/이미 처리됨 → 노이즈 0
  }

  const reason = [
    "[malgnai-hub 기록 점검] 이번 작업에서 다음 중 발생한 게 있으면 종료 전에 malgnai-hub에 남겼는지 확인하라:",
    "- 방향·정책·기술선택 등 주요 결정 → " + T + "decision_record",
    "- 막힌 것·장애물·버그 → " + T + "issue_record (해결됐으면 " + T + "issue_resolve)",
    "- 의미 있는 작업 진행/완료/막힘 → " + T + "work_record (nextAction을 채워두면 다음 세션에 자동으로 이어짐)",
    "기록할 거리가 없던 세션(단순 조회·질문 응답 등)이면 이 메시지는 무시하라. STATUS.md는 별도로 이미 갱신했어야 한다.",
  ].join("\n");

  // 주입/리마인드만 한다 — 세션 종료를 막지 않는다(rubric §6 / §1.2 Q2 조건③:
  // "강제가 아니라 주입"). decision:"block"은 Stop hook을 재트리거해 추가 턴을
  // 강제하는 차단 메커니즘이므로 쓰지 않는다. systemMessage로 사용자에게만
  // 비차단으로 노출한다.
  //
  // 여기서 process.exit(0)을 쓰지 않는다: process.stdout이 파이프일 때(훅의 실제 stdout이
  // 그렇다) write()는 비동기라, exit()로 즉시 프로세스를 죽이면 플러시 전에 출력이 잘릴 수
  // 있다(파일 리다이렉트는 동기라 이 문제가 없어 실무에서는 안 드러난다). 형제 파일
  // sessionstart-context.mjs가 이미 같은 이유로 --pm-block 모드에서 이 패턴을 걷어냈다 — 자연
  // 종료 시점까지 stdout이 온전히 비워지게 두면, Node가 프로세스 종료 전에 표준출력을 드레인한다.
  process.stdout.write(
    JSON.stringify({
      systemMessage: reason,
    })
  );
});
