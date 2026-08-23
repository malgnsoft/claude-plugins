#!/usr/bin/env node
/**
 * new-project.mjs — 신규 프로젝트 표준 스캐폴더.
 *
 * 프로젝트 운영 표준 뼈대를 스탬프한다:
 *   STATUS.md            — 라이브 상태 단일 소스 (부트스트랩 포인터 포함)
 *   CLAUDE.md            — 부트스트랩 3층 계약 + 구조(빈 뼈대) + 드리프트 안내
 *   docs/README.md       — 문서 지도(진입점)
 *   .claude/doc-drift.json — 드리프트 매니페스트(빈 checks, 채우는 법 안내)
 *   .claude/settings.json — malgn-agent 마켓플레이스+플러그인 자동 신뢰 등록(팀원 온보딩 마찰 감소)
 *   package.json         — pnpm, type=module, check-docs 스크립트
 * 그리고 git init.
 *
 * 사용:
 *   node ${CLAUDE_PLUGIN_ROOT}/bin/new-project.mjs <project-name> ["한 줄 설명"]
 *     → ~/workspace/<project-name>/ 을 새로 만들어 스탬프한다 (이미 있으면 중단).
 *   node ${CLAUDE_PLUGIN_ROOT}/bin/new-project.mjs --here ["한 줄 설명"]
 *     → 사용자가 이미 만들어 둔 현재 디렉토리(cwd)에 스탬프한다.
 *       STATUS.md가 이미 있으면 "이미 초기화됨"으로 보고 중단한다(동기화는 malgnai-hub project_bootstrap 사용).
 *       그 외 기존 파일(package.json 등)은 덮어쓰지 않고 건너뛴다.
 *   (${CLAUDE_PLUGIN_ROOT}는 스킬·에이전트 본문과 훅 커맨드에서 치환되고, 이 파일을 Read로 열면 문자 그대로다 — 셸 변수가 아니다.
 *    맨 명령어 `new-project.mjs ...`로도 부르지 않는다: 플러그인 bin/ 이 Bash 툴의 PATH에
 *    등재되긴 하지만 실행 비트가 없는 번들 스크립트가 있어 permission denied 로 실패한다.
 *    커맨드 정본은 Skill project-standards §7 참조.)
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, appendFileSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/**
 * PM 행동규율(@import) 참조 로드 — 스캐폴딩 시점 1회(docs/decision/malgnai-hub-project-bootstrap-redesign.md §4-2).
 * new-project.mjs는 PM이 마켓플레이스 clone 경로에서 직접 실행하므로(${CLAUDE_PLUGIN_ROOT} 방식이 아님),
 * import.meta.url 자체가 이미 정답 경로다 — 별도 글롭 스캔이 필요 없다.
 */
function loadPmOrchestrationBlockRef() {
  try {
    const blockPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'hooks', 'pm-orchestration-block.md')
    const raw = readFileSync(blockPath, 'utf8')
    const m = raw.match(/<!--\s*malgn-agent:pm-orchestration:version:(\d+)\s*-->/)
    if (!m) return null
    return { path: blockPath, version: Number(m[1]) }
  } catch { return null }
}
const pmBlock = loadPmOrchestrationBlockRef()
if (!pmBlock) {
  console.warn('⚠️  pm-orchestration-block.md를 찾을 수 없어 PM 행동규율 @import를 스캐폴딩에 포함하지 못했습니다(배포 누락 가능성) — 스캐폴딩은 계속 진행합니다.')
}

const useHere = process.argv[2] === '--here'
const rawName = useHere ? undefined : process.argv[2]
const desc = process.argv[3] || '<한 줄 설명>'

if (!useHere && (!rawName || /[\/\\]/.test(rawName))) {
  const SELF = `node "${process.argv[1]}"`
  console.error(`사용법: ${SELF} <project-name> ["한 줄 설명"]\n       ${SELF} --here ["한 줄 설명"]`)
  process.exit(1)
}

const root = useHere ? process.cwd() : join(homedir(), 'workspace', rawName)
const name = useHere ? basename(root) : rawName

if (useHere && root === homedir()) {
  console.error('홈 디렉토리에서는 --here를 실행할 수 없습니다. 프로젝트 폴더 안에서 실행하세요.')
  process.exit(1)
}
if (!useHere && existsSync(root)) { console.error(`이미 존재: ${root} — 중단.`); process.exit(1) }
if (useHere && existsSync(join(root, 'STATUS.md'))) {
  console.error(`이미 초기화된 프로젝트입니다 (STATUS.md 존재): ${root}\n동기화가 필요하면 malgnai-hub project_bootstrap을 바로 호출하세요.`)
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)

mkdirSync(join(root, 'docs'), { recursive: true })
mkdirSync(join(root, '.claude'), { recursive: true })

// pmBlock이 있을 때만 CLAUDE.md에 마커+@import 두 줄을 삽입한다(§4-2). 없으면(배포 누락 등) 건너뛴다 —
// 스캐폴딩 자체를 실패시키지 않는다(위 콘솔 경고로 이미 알렸다).
const pmBlockSection = pmBlock
  ? `\n<!-- malgn-agent:pm-orchestration:installed:v${pmBlock.version} -->\n@${pmBlock.path}\n`
  : ''

const files = {
  'STATUS.md': `---
provider: malgnai-hub
project_id: # malgnai-hub 도구 호출의 projectId 입력값 (project_bootstrap 응답으로 채워짐)
repository_key: # project_bootstrap 재호출 입력값 — project_id를 모를 때 이걸로 다시 발급받는다
---

# STATUS — ${name}
_최종 갱신: ${today} (초기 생성)_

> **${name}** = ${desc}
> **새 세션은 이 파일(라이브 상태) + \`CLAUDE.md\`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-hub \`project_get_context\`, 깊은 문서는 \`docs/README.md\`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 재작성 규율(6가지 트리거로 제한)은 \`CLAUDE.md\` 참조 — 평범한 진행 중에는 건드리지 않는다.

## 🟢 현재 상태
- (프로젝트 시작 — 초기 상태)

## ✅ 최근 완료
- _(없음)_

## 🚧 진행 중 / 다음
- (첫 목표를 여기에)

## ⛔ 막힌 것 / 열린 이슈
- _(없음)_
`,

  'CLAUDE.md': `# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

<!-- 구조 드리프트 대조: .claude/doc-drift.json + \`pnpm run check-docs\`. 전역 SessionStart 훅이 세션 시작 시 자동 경고. -->
${pmBlockSection}
## 새 세션 부트스트랩 (읽기 순서 = 토큰 예산)
- **L0 (자동 주입):** \`STATUS.md\`(라이브 상태, 1000토큰 이내 유지) + 이 \`CLAUDE.md\`(구조·규칙). → 대부분의 경우 이것만으로 충분.
- **L1 (필요할 때만 호출):** malgnai-hub \`project_get_context\`(project_id) 등 — L0로 충분하면 호출하지 않는다. 불필요한 호출은 토큰 낭비.
- **L2 (깊은 작업만):** \`docs/README.md\` 지도 → 필요한 문서만.

**STATUS.md 재작성은 다음 6가지 상황으로 제한한다** — 그 외 평범한 진행 중에는 건드리지 않는다:
①중요한 작업 완료 ②WBS 단계 변경 ③중요한 설계 결정 ④blocker 발생/해결 ⑤세션 종료 ⑥context compact 직전.
그 외에는 malgnai-hub \`work_record\`/\`decision_record\`/\`issue_record\`에만 기록하고 STATUS.md는 그대로 둔다 — STATUS.md는 "현재 스냅숏"이지 "매 턴 로그"가 아니다.

**필수 규율:** ①주요 결정/이슈/교훈은 malgnai-hub에 기록. ②구조를 바꾸면 \`.claude/doc-drift.json\`과 아래 서술을 함께 갱신.

## Project Overview
${name} — ${desc}

## Tech Stack
- (채우기)

## Commands
\`\`\`bash
pnpm run check-docs    # 구조 서술 ↔ 코드 실측 드리프트 대조
\`\`\`

## Architecture
- (구조를 여기 서술하고, 검증 가능한 수치는 .claude/doc-drift.json 에 등록)
`,

  'docs/README.md': `# docs/ 문서 지도 (에이전트 진입점)

> 무엇을 어디서 읽을지 여기서 먼저 확인. 현 상태의 정답은 항상 코드 + \`/STATUS.md\`.

## 🧭 먼저 읽을 것
1. \`/STATUS.md\` — 현재 진행 상태(단일 소스)
2. \`/CLAUDE.md\` — 개요·구조·규칙
3. malgnai-hub \`project_get_context\` — 검색 가능한 결정/이슈/작업 이력

## 📂 폴더
- \`vision/\` — 아이디어·비전
- \`architecture/\` — 설계·명세
- \`guides/\` — 현행 운영/개발 가이드
- \`history/\` — 회고·리뷰·작업이력

> **정확성 보증:** 새 세션 시작 시 드리프트 가드가 \`.claude/doc-drift.json\`으로 문서↔코드를 대조. 수동 \`pnpm run check-docs\`.
`,

  '.claude/doc-drift.json': JSON.stringify({
    _help: '문서 서술이 코드와 어긋나는지 자동 대조. label/expected 와 측정법(glob|homeGlob|jsonLength|file+regex) 지정. 예시는 malgn-agent 플러그인 knowledge/ 문서나 다른 프로젝트의 .claude/doc-drift.json 참고.',
    checks: [],
  }, null, 2) + '\n',

  '.claude/settings.json': JSON.stringify({
    extraKnownMarketplaces: {
      'malgnsoft-plugins': { source: { source: 'github', repo: 'malgnsoft/claude-plugins' } },
    },
    enabledPlugins: {
      'malgn-agent@malgnsoft-plugins': true,
    },
  }, null, 2) + '\n',

  'package.json': JSON.stringify({
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      'check-docs': "node -e \"const fs=require('fs'),os=require('os'),path=require('path');const home=os.homedir();let found=null;const mp=path.join(home,'.claude','plugins','marketplaces');if(fs.existsSync(mp)){for(const d of fs.readdirSync(mp)){const c=path.join(mp,d,'plugins','malgn-agent','hooks','doc-drift.mjs');if(fs.existsSync(c)){found=c;break}}}if(!found){const legacy=path.join(home,'.claude','hooks','doc-drift.mjs');if(fs.existsSync(legacy))found=legacy}if(found){require('child_process').execSync('node '+JSON.stringify(found),{stdio:'inherit'})}else{console.log('doc-drift.mjs를 찾지 못했습니다. malgn-agent 플러그인의 SessionStart 훅이 세션 시작 시 이미 자동으로 드리프트를 검사하니, 수동 확인이 필요하면 그 세션에서 요청하세요.')}\"",
    },
  }, null, 2) + '\n',
}

const skipped = []
for (const [rel, content] of Object.entries(files)) {
  const dest = join(root, rel)
  if (existsSync(dest)) { skipped.push(rel); continue }
  writeFileSync(dest, content)
}

// STATUS.md를 git 추적에서 제외한다(§1-b) — 팀 공유 파일이 아니라 개인 로컬 캐시로 전환.
// .gitignore가 이미 있으면 append, 없으면 신규 생성. STATUS.md 항목만 추가하고 다른 항목은 건드리지 않는다.
const gitignorePath = join(root, '.gitignore')
const gitignoreEntry = 'STATUS.md'
let gitignoreTouched = false
try {
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, 'utf8') : ''
  const alreadyIgnored = existing.split('\n').some((line) => line.trim() === gitignoreEntry)
  if (!alreadyIgnored) {
    if (existing && !existing.endsWith('\n')) appendFileSync(gitignorePath, '\n')
    appendFileSync(gitignorePath, gitignoreEntry + '\n')
    gitignoreTouched = true
  }
} catch {}

if (!existsSync(join(root, '.git'))) {
  try { execSync('git init -q', { cwd: root }) } catch {}
}

console.log(`✅ 표준 뼈대 생성: ${root}`)
if (skipped.length) console.log(`   건너뜀(이미 존재해 덮어쓰지 않음): ${skipped.join(', ')}`)
console.log('   STATUS.md · CLAUDE.md · docs/README.md · .claude/doc-drift.json · .claude/settings.json · package.json 중 신규 생성분 (+git init)')
if (gitignoreTouched) console.log('   .gitignore에 STATUS.md 등록(git 추적 제외 — 개인 로컬 캐시)')
console.log('\n다음 단계:')
console.log(useHere ? '  1. pnpm install' : `  1. cd ${root} && pnpm install`)
console.log('  2. malgnai-hub project_bootstrap 호출 → 응답의 provider/project_id/repositoryKey를 STATUS.md frontmatter의 provider/project_id/repository_key에 채워 넣는다(repository_id/web_url은 응답에 포함되어도 저장하지 않는다).')
console.log('  3. STATUS.md는 1000토큰 이내로 유지하고, 재작성은 6가지 트리거(중요 작업 완료/WBS 단계변경/중요 설계결정/blocker 발생·해결/세션종료/context compact 직전)로 제한한다 — 평범한 진행 중에는 건드리지 않는다.')
console.log('  4. STATUS.md는 .gitignore에 등록되어 git에 커밋되지 않는다(개인 로컬 캐시) — 팀과 공유할 내용은 malgnai-hub(work_record/decision_record/issue_record)에 남긴다.')
console.log('  5. PM 행동규율(@import)이 걸려 있다 — 다음 세션(또는 재시작) 시 외부 파일 승인 다이얼로그가 뜰 수 있다, 반드시 승인할 것. 나중에 마켓플레이스 별칭 변경 등으로 재확인이 필요하면 project-standards 스킬에 "PM 행동규율 다시 확인해줘"로 요청한다(매 세션 자동 점검 아님).')
console.log('  6. 구조 잡히면 .claude/doc-drift.json 의 checks 채우고 `pnpm run check-docs`(문서 드리프트 + PM 블록 @import 상태를 함께 점검 — 자동 세션 점검은 STATUS.md/doc-drift만 해당, PM 블록은 수동 점검만 있음)')
