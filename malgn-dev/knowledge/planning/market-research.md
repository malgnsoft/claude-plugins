# 시장조사 및 리서치 가이드

> 시장조사를 "의사결정으로 이어지는 전략 브리프"로 끌어올리는 고급 기법(벤치마킹 포지셔닝, 시장규모 현실 인식, 수익 산식, 해자 정당화)은 `business-brief-patterns.md` 참조 — coaching 우수 사례에서 역추출.

## 조사 프레임워크

### 시장 분석 (TAM/SAM/SOM)
- **TAM** (Total Addressable Market): 전체 시장 규모
- **SAM** (Serviceable Addressable Market): 접근 가능한 시장
- **SOM** (Serviceable Obtainable Market): 실제 확보 가능한 시장

### Porter's 5 Forces
1. 기존 경쟁자 간 경쟁 강도
2. 신규 진입자 위협
3. 대체재 위협
4. 공급자 교섭력
5. 구매자 교섭력

### SWOT 분석
| | 긍정적 | 부정적 |
|---|--------|--------|
| 내부 | Strengths | Weaknesses |
| 외부 | Opportunities | Threats |

## 리서치 보고서 구조

```markdown
# [조사 주제]

조사일: YYYY-MM-DD

## 요약
(3~5줄 핵심 요약 — 결론을 먼저)

## 조사 배경
(왜 이 조사가 필요한가)

## 조사 방법
(어떤 소스를 활용했는가)

## 조사 결과
### 시장 현황
### 주요 플레이어
### 트렌드

## 분석
(데이터 해석, 인사이트)

## 결론 및 제언
(조사 결과 기반 권장사항)

## 출처
- [출처1](URL)
- [출처2](URL)
```

## 기술 조사 비교 기준

| 기준 | 평가 방법 |
|------|----------|
| 성숙도 | GitHub stars, 첫 릴리즈 일자, 메이저 버전 |
| 커뮤니티 | npm 주간 다운로드, Stack Overflow 질문 수 |
| 유지보수 | 최근 커밋, 이슈 응답 시간, 릴리즈 빈도 |
| 문서화 | 공식 문서 품질, 예제 코드 풍부함 |
| 성능 | 벤치마크 결과 |
| 학습 곡선 | API 복잡도, 보일러플레이트 양 |

## 검색 쿼리 최적화

- `"키워드" site:github.com` — GitHub에서 검색
- `"키워드" site:npmjs.com` — npm 패키지 검색
- `키워드 vs 대안 2024` — 비교 글 검색
- `키워드 benchmark performance` — 성능 비교
- `키워드 production case study` — 실제 사용 사례
