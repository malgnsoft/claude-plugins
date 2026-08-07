---
name: common-output-storage-and-path-management
description: 전 에이전트 인프라 규칙 — 산출물 추적성 확보, 경로 명시·저장 위계로 회수 불가 손실 방지. 파일 저장 위치·경로 관리 시 사용.
---

# Output Storage and Path Management

## 정의

모든 에이전트의 산출물(코드, 문서, 검증 결과, 의사결정)이 정해진 위계에 저장되고, 절대 경로로 기록되어 추적 가능한 상태를 유지하는 인프라 표준.

## 핵심 원칙

### 1. 저장소 위계 (계층별 용도)

```
~/workspace/[프로젝트]/
  ├─ STATUS.md                → 진행 상태 단일 소스 (착수 전 읽고, 끝내기 전 갱신)
  ├─ CLAUDE.md                → 구조·규칙 (부트스트랩 3층: STATUS.md+CLAUDE.md → project_get_context → docs/README.md)
  │
  ├─ docs/                    → 프로젝트 공식 문서 (장기 보존)
  │   ├─ README.md            → 문서 지도(진입점) — "무엇을 어디서 읽을지" 안내, 통독 금지
  │   ├─ product-principles.md
  │   ├─ [도메인]/            → 주제별 가이드
  │   └─ archive/             → 폐기된 이전 문서 (참조용)
  │
  ├─ output/                  → 최종 산출물 (배포용)
  │   ├─ *.html / *.pdf       → 발표/배포 파일
  │   └─ reports/             → 의사결정/검증 보고서
  │
  ├─ [src/, src-*/...]        → 프로젝트 소스 (git 추적)
  │
  └─ .claude/
      ├─ doc-drift.json       → 문서-코드 검증 매니페스트
      ├─ settings.json        → 프로젝트별 환경 설정
      └─ memory/              → 에이전트 세션별 메모리
          └─ MEMORY.md

${CLAUDE_PLUGIN_ROOT}/            → malgn-agent 플러그인이 제공하는 공유 자원 (설치된 모든 프로젝트에서 공통, 개인 디렉터리 아님)
  ├─ skills/                  → 공유 에이전트 스킬 라이브러리
  │   └─ common-*.md
  │
  ├─ knowledge/               → 공유 참고자료/기반
  │   ├─ [도메인]/
  │   └─ design/              → 전역 디자인 시스템
  │
  └─ agents/                  → 에이전트 역할 정의
      ├─ pm.md               → PM 페르소나
      ├─ architect.md
      ├─ reviewer.md
      └─ ...

~/.claude/CLAUDE.md           → (참고, 선택적) 사용자 개인 전역 설정 — 플러그인과 별개로 사용자별 1개만 존재하는 진짜 개인 파일. 위 세 경로(skills/knowledge/agents)와 달리 플러그인이 제공하는 자원이 아니므로 같은 목록에 동일 취급하지 않는다.
```

**이 저장소(`claude-plugins`) 자신의 감사 산출물**: 이 스킬이 서술하는 위계는 malgn-agent를 설치한 각 프로젝트에 적용되는 일반 규칙이다. `claude-plugins` 저장소 자신의 방법론 감사·검증 산출물(예: 전수 감사 보고서)은 이 저장소의 `docs/history/audit-*.md`에 보관한다(판정 기준은 방법론 문서 §9.7).

### 2. 경로 명시 규칙

**모든 산출물은:**
- **절대 경로 사용** (상대 경로 ❌)
- **말 없이 기록** (구두 설명 ❌)
- **malgnai-hub에 포함** (파일명만 아니라 경로)

**체크:**
```
❌ "문서를 docs에 저장했습니다"
❌ "상대 경로: ../docs/review.md"
✅ "/absolute/path/to/workspace/my-proj/docs/review-2025-07-10.md"
```

**malgnai-hub 기록 시 경로 포함:**
```
work_record:
  status: "completed"
  title: "코드 검토 완료"
  summary: "..."
  artifacts: ["/absolute/path/to/review.md"]  ← 절대 경로 배열

decision_record:
  title: "pnpm 모노레포 폐기"
  decision: "pnpm 모노레포 폐기하고 멀티레포로 전환"
  reason: "... (관련 파일: /absolute/path/to/decision.md, /absolute/path/to/archive/monorepo-v1.md)"  ← ref_files 필드 없음, reason/impact 텍스트에 경로 포함

issue_record:
  title: "타임아웃 버그"
  summary: "... (관련 파일: /absolute/path/to/logs/timeout-trace.txt)"  ← related_file 필드 없음, summary 텍스트에 경로 포함
```

### 3. 파일 이름 규칙

**형식: `[영역]-[주제]-YYYY-MM-DD[.버전].md`**

| 영역 | 예시 | 보관 |
|------|------|------|
| 의사결정 | `decision-pnpm-monorepo-2025-07-10.md` | docs/ 또는 output/reports/ |
| 검증/리뷰 | `review-code-auth-2025-07-10.md` | output/reports/ |
| 학습/교훈 | `training-report-pnpm-setup-2025-07-10.md` | docs/ |
| 임시 분석 | `scratch-perf-analysis-2025-07-10.md` | scratchpad/ (세션 후 삭제) |

**체크:**
```
❌ review.md, 1.md, final-final.md
✅ review-auth-module-2025-07-10.md
```

### 4. 추적성 확보 (경로 ↔ 메타데이터)

**모든 파일마다 헤더에 메타데이터:**

```markdown
---
created: 2025-07-10T14:32:00Z
author: architect (session-abc123)
status: FINAL | DRAFT | ARCHIVED
related_files:
  - /absolute/path/to/related1.md
  - /absolute/path/to/related2.md
tags: [auth, security, decision]
---
```

**체크:**
- [ ] 파일 생성 시간 기록?
- [ ] 작성자/세션ID 포함?
- [ ] 상태 명시? (최종/초안/폐기)
- [ ] 관련 파일 경로 상호 참조?

### 5. 폐기 및 아카이빙 규칙

**더 이상 유효하지 않은 파일:**
- **docs/archive/** 이동 (완전 삭제 ❌)
- 파일명 앞에 `archived-` 접두어 추가
- 원본 경로는 archived-*.md에 기록

**체크:**
```
❌ 파일 완전 삭제
✅ docs/archive/archived-monorepo-design-v1-2025-07-10.md
   (헤더에 "폐기 사유: 구조 변경, 참고용으로만 보존")
```

## 적용 체크리스트

### 산출물 생성 전

- [ ] 이 파일이 docs/? output/? .claude/? ~/ 중 어디에 속하는가?
- [ ] 폴더 구조가 위계 규칙을 따르는가?

### 파일 저장 시

- [ ] 절대 경로로 저장? (상대 경로 ❌)
- [ ] 파일명 규칙 따른가? ([영역]-[주제]-YYYY-MM-DD)
- [ ] 헤더 메타데이터 포함? (created, author, status, tags)
- [ ] 관련 파일 상호 참조?

### 기록 시 (malgnai-hub)

- [ ] work_record/decision_record/issue_record에 절대 경로 포함?
- [ ] 파일명만 아니라 전체 경로?
- [ ] 관련 파일이 여러 개면 work_record의 artifacts 배열로 (decision_record/issue_record는 별도 필드가 없어 reason/summary 텍스트에 나열)?

### 폐기 시

- [ ] 완전 삭제 금지, docs/archive/ 이동?
- [ ] archived- 접두어 추가?
- [ ] 폐기 사유와 원본 경로 기록?
