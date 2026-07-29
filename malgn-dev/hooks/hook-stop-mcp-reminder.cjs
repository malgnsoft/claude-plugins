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
//
// 참고: 이 파일은 원래 malgnai-mcp(로컬 MCP) 대상이었고 §9 원격 승인(command_add) 리마인더도
// 겸했으나, malgnai-hub(회사 공용 원격 MCP) v1에는 command_add/웹 승인 재개 기능이 없어
// 그 기능은 제거했다. 이 hook은 이제 기록(record) 리마인더만 담당한다.
const fs = require("fs");

const WRITE_TOOL_RE = /^(Edit|Write|NotebookEdit|Bash|Agent|Workflow)$/;
const MCP_RECORD_TOOL_RE = /^mcp__malgnai-hub__(decision_record|issue_record|issue_resolve|work_record)$/;

// 이번 턴(마지막 진짜 사용자 메시지 이후)을 1회 스캔해 필요한 신호를 모아 반환한다.
//   alreadyRecorded : MCP 기록 도구(decision_record/issue_record/issue_resolve/work_record)를 이미 썼다
//   hasWriteSignal  : Edit/Write/Bash/Agent 등 실질 작업 도구를 썼다
// 반환 null = 트랜스크립트 판단 불가(안전측 폴백 — 기록 리마인더는 표시).
function analyzeTurn(transcriptPath) {
  if (!transcriptPath) return null;
  let lines;
  try {
    lines = fs.readFileSync(transcriptPath, "utf8").split("\n").filter(Boolean);
  } catch (_) {
    return null;
  }

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

  return { alreadyRecorded, hasWriteSignal };
}

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    payload = input ? JSON.parse(input) : {};
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
  const analysis = a || { alreadyRecorded: false, hasWriteSignal: true };

  const needRecord = analysis.hasWriteSignal && !analysis.alreadyRecorded;
  if (!needRecord) {
    process.exit(0); // 불필요 → 트리비얼/이미 처리됨 → 노이즈 0
  }

  const reason = [
    "[malgnai-hub 기록 점검] 이번 작업에서 다음 중 발생한 게 있으면 종료 전에 malgnai-hub에 남겼는지 확인하라:",
    "- 방향·정책·기술선택 등 주요 결정 → mcp__malgnai-hub__decision_record",
    "- 막힌 것·장애물·버그 → mcp__malgnai-hub__issue_record (해결됐으면 issue_resolve)",
    "- 의미 있는 작업 진행/완료/막힘 → mcp__malgnai-hub__work_record (nextAction을 채워두면 다음 세션에 자동으로 이어짐)",
    "기록할 거리가 없던 세션(단순 조회·질문 응답 등)이면 이 메시지는 무시하라. STATUS.md는 별도로 이미 갱신했어야 한다.",
  ].join("\n");

  process.stdout.write(
    JSON.stringify({
      decision: "block",
      reason,
    })
  );
  process.exit(0);
});
