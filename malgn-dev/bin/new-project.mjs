#!/usr/bin/env node
/**
 * new-project.mjs — 신규 프로젝트 표준 스캐폴더.
 *
 * ~/workspace/<이름>/ 에 프로젝트 운영 표준 뼈대를 스탬프한다:
 *   STATUS.md            — 라이브 상태 단일 소스 (부트스트랩 포인터 포함)
 *   CLAUDE.md            — 부트스트랩 3층 계약 + 구조(빈 뼈대) + 드리프트 안내
 *   docs/README.md       — 문서 지도(진입점)
 *   .claude/doc-drift.json — 드리프트 매니페스트(빈 checks, 채우는 법 안내)
 *   package.json         — pnpm, type=module, check-docs 스크립트
 * 그리고 git init.
 *
 * 사용: node <malgn-dev 플러그인 경로>/bin/new-project.mjs <project-name> ["한 줄 설명"]
 *   (malgn-dev 플러그인이 활성화된 Claude Code 세션에서는 bin/ 이 PATH에 잡혀
 *    `new-project.mjs <project-name>`로 바로 실행 가능하다)
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { execSync } from 'node:child_process'

const name = process.argv[2]
const desc = process.argv[3] || '<한 줄 설명>'
if (!name || /[\/\\]/.test(name)) {
  console.error('사용법: new-project.mjs <project-name> ["한 줄 설명"] (malgn-dev 플러그인의 bin/new-project.mjs)')
  process.exit(1)
}
const root = join(homedir(), 'workspace', name)
if (existsSync(root)) { console.error(`이미 존재: ${root} — 중단.`); process.exit(1) }

const today = new Date().toISOString().slice(0, 10)

mkdirSync(join(root, 'docs'), { recursive: true })
mkdirSync(join(root, '.claude'), { recursive: true })

const files = {
  'STATUS.md': `# STATUS — ${name}
_최종 갱신: ${today} (초기 생성)_
<!-- malgnai_hub: (malgnai-hub project_bootstrap 후 자동 채워짐 — project_id, repository_id, repository_key, web_url) -->

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
새 세션은 **자동 주입되는 \`STATUS.md\` + 이 \`CLAUDE.md\` 두 개면 오리엔테이션이 끝난다.** 현 상황 파악하려고 코드/docs를 통독하지 말 것.
- **L0 (자동 주입):** \`STATUS.md\`(라이브 상태) + \`CLAUDE.md\`(안정 구조·규칙). → 시작에 충분.
- **L1 (필요 시 pull):** malgnai-hub \`project_get_context\` / \`project_search_history\`.
- **L2 (깊은 작업만):** \`docs/README.md\` 지도 → 필요한 문서만.

**필수 규율:** ①진행 상태는 \`STATUS.md\` 단일 소스(끝내기 전 갱신). ②주요 결정/이슈/교훈은 malgnai-hub에 기록. ③구조를 바꾸면 \`.claude/doc-drift.json\`과 아래 서술을 함께 갱신.

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
    _help: '문서 서술이 코드와 어긋나는지 자동 대조. label/expected 와 측정법(glob|homeGlob|jsonLength|file+regex) 지정. 예시는 malgn-dev 플러그인 knowledge/ 문서나 다른 프로젝트의 .claude/doc-drift.json 참고.',
    checks: [],
  }, null, 2) + '\n',

  'package.json': JSON.stringify({
    name,
    version: '0.1.0',
    private: true,
    type: 'module',
    scripts: {
      'check-docs': "node -e \"const fs=require('fs'),os=require('os'),p=os.homedir()+'/.claude/hooks/doc-drift.mjs';if(fs.existsSync(p)){require('child_process').execSync('node '+JSON.stringify(p),{stdio:'inherit'})}else{console.log('doc-drift.mjs를 로컬에서 찾지 못했습니다. malgn-dev 플러그인이 설치된 Claude Code 세션에서는 SessionStart마다 자동으로 드리프트를 검사하니, 수동 확인이 필요하면 그 세션에서 요청하세요.')}\"",
    },
  }, null, 2) + '\n',
}

for (const [rel, content] of Object.entries(files)) writeFileSync(join(root, rel), content)

try { execSync('git init -q', { cwd: root }) } catch {}

console.log(`✅ 표준 뼈대 생성: ${root}`)
console.log('   STATUS.md · CLAUDE.md · docs/README.md · .claude/doc-drift.json · package.json (+git init)')
console.log('\n다음 단계:')
console.log(`  1. cd ${root} && pnpm install`)
console.log('  2. malgnai-hub project_bootstrap 호출 → STATUS.md 헤더의 malgnai_hub: 주석이 자동으로 채워짐 (repositoryKey는 사람이 정하는 문자열, 별도 등록 단계 불필요)')
console.log('  3. 구조 잡히면 .claude/doc-drift.json 의 checks 채우고 `pnpm run check-docs`')
