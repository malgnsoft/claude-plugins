# STATUS 지나간 라운드 — 2026-10

## v1.8.51 (배포됨)
훅 Sensitive→pm 한 문장(+297B, 골든 A/B ⑤ pm 0/4→4/4) + 판정표 일치 검사(check-assets). 효과는 ⑤ 하나만 유의, 조회 위임 증가는 배포 후 관찰. PM block A/B 테스트: `pnpm run eval:pm-block-ab`(유료·수동). 폐기한 "메인 위임 중심" 안(브랜치 삭제, 끝 커밋 e7fe231, 결과는 results.jsonl)·후보 증거는 `trainer/pm-block-cand{A,B}-20261012`. `feat/device-token-auth`는 v1.8.52로 병합됨(브랜치·워크트리 정리는 병행 세션 몫).
