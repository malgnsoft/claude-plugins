---
name: malgn-project-standards
description: 맑은소프트 프로젝트 운영 표준 — 패키지 매니저(pnpm 전용), 프로젝트 구조(~/workspace/<이름>/ 독립 프로젝트), STATUS.md/CLAUDE.md/docs 3층 부트스트랩, 드리프트 가드, 신규 프로젝트 스캐폴딩. 새 프로젝트를 시작하거나, 프로젝트 구조/진행 상태 관리 방식을 판단할 때 사용.
---

# Malgn Project Standards

## 정의

맑은소프트 전 프로젝트가 공통으로 따르는 운영 표준. "최소 토큰으로 항상 정확한 이해"를 목표로, 진행 상태·문서·패키지 관리 방식을 통일한다.

## 1. 패키지 매니저 — pnpm 전용

- 모든 프로젝트에서 **pnpm**을 사용한다 (npm/yarn 금지).
- `pnpm install`, `pnpm add`, `pnpm dlx`, `pnpm run`, 새 프로젝트는 `pnpm create` 사용.
- 락파일은 `pnpm-lock.yaml`만 유지한다. `package-lock.json` / `yarn.lock` 생성 금지.

## 2. 프로젝트 구조

- 모든 프로젝트는 `~/workspace/<프로젝트명>/` 아래에 둔다.
- 각 프로젝트는 **독립적**이다 — 자체 `package.json`과 `pnpm-lock.yaml`을 가진다.
- 공유 루트 락파일이나 `pnpm-workspace.yaml`을 쓰는 pnpm 모노레포는 만들지 않는다.

## 3. 진행 상태 = 루트 `STATUS.md` (단일 소스)

- 착수 전 읽고, 상태가 바뀌면 끝내기 전 갱신한다.
- 상단에 한 줄 정체 + YAML frontmatter `malgnai_hub: {project_id, repository_id, repository_key, web_url}`(malgnai-hub 연동 시, `project_bootstrap`이 생성).
- **관리 규칙:** 완료 항목은 1줄 요약(+MCP id), 완료 섹션은 최근 5~7개만 유지. 헤더 라인은 매번 통째로 교체(과거 세션 "직전:" 체이닝 금지).
- 장기 이력은 malgnai-hub `project_search_history`로 조회 — STATUS.md는 **지금 돌아가는 것·다음 것·열린 이슈만** 담는다.

## 4. 문서 지도 = `docs/README.md`

- 배경·설계·이력은 이 지도를 거쳐 필요한 문서만 찾아 읽는다.
- **docs 통독 금지** — 지도에서 필요한 것만 골라 읽는다.

## 5. 새 세션 부트스트랩 (3층)

1. **L0 자동주입:** `STATUS.md` + `CLAUDE.md` — 대부분의 경우 이것만으로 충분.
2. **L1 선택적 호출:** 텍스트 검색이 필요하거나 다중 프로젝트 범위 필터링이 필요할 때만 malgnai-hub `project_get_context` 호출. 불필요한 호출은 토큰 낭비.
3. **L2 깊은 작업 시:** `docs/README.md` 지도를 거쳐 필요한 문서만.

**현 상황 파악을 위해 코드·docs를 통독하지 않는다** (토큰 낭비 + 옛 정보 오독 위험).

## 6. 정확성 보증 — 드리프트 가드

- 프로젝트에 `.claude/doc-drift.json` 매니페스트가 있으면, 문서 서술(파일 수·테이블·라우트 수 등)을 코드 실측과 대조해 **어긋날 때만 경고**한다(일치 시 0토큰).
- 수동 확인: `pnpm run check-docs`
- CLAUDE.md에 구조를 서술할 때는 반드시 이 매니페스트로 검증 가능하게 쓴다(수치는 doc-drift.json에 등록).

## 7. 신규 프로젝트 생성 — 표준 스캐폴드

새 프로젝트는 임의로 디렉토리를 만들지 말고, 이 플러그인이 제공하는 스캐폴더를 사용한다:

```bash
node <이 플러그인 경로>/bin/new-project.mjs <프로젝트명> ["한 줄 설명"]
```

`~/workspace/<이름>/`에 다음을 스탬프하고 git init까지 수행한다:
- `STATUS.md` — 부트스트랩 포인터를 포함한 라이브 상태 단일 소스
- `CLAUDE.md` — 부트스트랩 3층 계약 + 구조(빈 뼈대) + 드리프트 안내
- `docs/README.md` — 문서 지도(진입점)
- `.claude/doc-drift.json` — 드리프트 매니페스트(빈 checks)
- `package.json` — pnpm, `type: module`, `check-docs` 스크립트

스캐폴딩 후에는 malgnai-hub `project_bootstrap`을 호출해 `repositoryKey`를 발급받고(첫 호출 시 자동 프로비저닝 — 별도 project_create 불필요), `STATUS.md` 상단에 YAML frontmatter `malgnai_hub: {project_id, repository_id, repository_key, web_url}`을 채운다.

## 체크리스트

- [ ] 패키지 매니저로 pnpm만 쓰는가? (npm/yarn 흔적 없는가)
- [ ] 프로젝트가 `~/workspace/<이름>/` 아래 독립적으로 있는가?
- [ ] `STATUS.md`가 최신이고 완료 섹션이 5~7개로 정리되어 있는가?
- [ ] `docs/README.md` 지도가 있고, docs를 통째로 읽지 않고 지도를 거쳐 필요한 것만 읽었는가?
- [ ] 구조 서술(CLAUDE.md)이 `.claude/doc-drift.json`으로 검증 가능한가?
- [ ] 새 프로젝트라면 `new-project.mjs`로 스캐폴딩했는가?
