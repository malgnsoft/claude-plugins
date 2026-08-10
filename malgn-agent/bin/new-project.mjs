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
 *   node <malgn-agent 플러그인 경로>/bin/new-project.mjs <project-name> ["한 줄 설명"]
 *     → ~/workspace/<project-name>/ 을 새로 만들어 스탬프한다 (이미 있으면 중단).
 *   node <malgn-agent 플러그인 경로>/bin/new-project.mjs --here ["한 줄 설명"]
 *     → 사용자가 이미 만들어 둔 현재 디렉토리(cwd)에 스탬프한다.
 *       STATUS.md가 이미 있으면 "이미 초기화됨"으로 보고 중단한다(동기화는 malgnai-hub project_bootstrap 사용).
 *       그 외 기존 파일(package.json 등)은 덮어쓰지 않고 건너뛴다.
 *   (참고: bin/ 은 PATH에 자동 등록되지 않는다 — 항상 위처럼 node로 전체 경로를 지정해 호출한다)
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

const useHere = process.argv[2] === '--here'
const rawName = useHere ? undefined : process.argv[2]
const desc = process.argv[3] || '<한 줄 설명>'

if (!useHere && (!rawName || /[\/\\]/.test(rawName))) {
  console.error('사용법: new-project.mjs <project-name> ["한 줄 설명"]  |  new-project.mjs --here ["한 줄 설명"] (malgn-agent 플러그인의 bin/new-project.mjs)')
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

const files = {
  'STATUS.md': `---
provider: malgnai-hub
project_id: # 참고용 표시값 — 실제 도구 호출엔 repository_key만 사용됨(project_bootstrap 응답으로 채워짐)
repository_key:
---

# STATUS — ${name}
_최종 갱신: ${today} (초기 생성)_

> **${name}** = ${desc}
> **새 세션은 이 파일(라이브 상태) + \`CLAUDE.md\`(구조·규칙)면 오리엔테이션 충분.** 구조 상세는 malgnai-hub \`project_get_context\`, 깊은 문서는 \`docs/README.md\`. 상황 파악하려고 코드/docs 통독 금지.
> 이 파일이 진행 상태의 **단일 소스**다. 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신.

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
      'malgnsoft-plugins': { source: { source: 'github', repo: 'hopegiver/claude-plugins' } },
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

if (!existsSync(join(root, '.git'))) {
  try { execSync('git init -q', { cwd: root }) } catch {}
}

console.log(`✅ 표준 뼈대 생성: ${root}`)
if (skipped.length) console.log(`   건너뜀(이미 존재해 덮어쓰지 않음): ${skipped.join(', ')}`)
console.log('   STATUS.md · CLAUDE.md · docs/README.md · .claude/doc-drift.json · .claude/settings.json · package.json 중 신규 생성분 (+git init)')
console.log('\n다음 단계:')
console.log(useHere ? '  1. pnpm install' : `  1. cd ${root} && pnpm install`)
console.log('  2. malgnai-hub project_bootstrap 호출 → 응답 중 provider/project_id/repositoryKey 3개를 STATUS.md 상단 YAML frontmatter의 동일한 이름 필드에 채워 넣는다(repository_id/web_url은 응답에 포함되어도 저장하지 않는다).')
console.log('  3. STATUS.md는 1000토큰 이내로 유지하고, 재작성은 6가지 트리거(중요 작업 완료/WBS 단계변경/중요 설계결정/blocker 발생·해결/세션종료/context compact 직전)로 제한한다 — 평범한 진행 중에는 건드리지 않는다.')
console.log('  4. 구조 잡히면 .claude/doc-drift.json 의 checks 채우고 `pnpm run check-docs`')
