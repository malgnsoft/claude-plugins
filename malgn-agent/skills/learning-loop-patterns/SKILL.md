---
name: learning-loop-patterns
description: 작업 전 Knowledge 확인 → 작업 중 의사결정 기록 → 작업 후 교훈 자산화로 이어지는 태스크 단위 3단계 실행 플레이북. "학습 루프 돌려", "재발 방지 체크리스트", "교훈 자산화" 요청 시 사용.
---

# Learning Loop Patterns Skill

## Definition
작업 전 지식 확인과 작업 후 교훈 기록의 폐쇄 루프로 팀 지식을 자산화하는 기술. 반복되는 문제를 사전에 회피하고, 실행 경험을 체계적으로 축적하여 생산성을 높인다.
- **대상 에이전트:** backend-dev, frontend-dev, qa-engineer, capture-strategist 등 실행 무거운(태스크 단위 산출물을 만드는) 에이전트
- **핵심 목표:** "작업 전 knowledge 확인" → "작업 실행" → "작업 후 교훈 기록" 폐쇄 루프 자동화
- **역할 구분:** malgnai-hub 기록 규칙 자체(issue_record/decision_record/work_record를 언제·어떻게 쓰는지)는 `common-learning-loop-knowledge-management` 스킬을 참조하라. 이 문서는 그 위에서 동작하는 **태스크 단위 실행 플레이북**(Pre/Mid/Post-Execution 체크리스트와 구체 예시)을 다룬다.

## Core Principles

### 1. 작업 전 Knowledge 확인 (Pre-Execution)
- **목적:** 이전 경험·학습·해결책을 현재 작업에 활용하여 시간 절약 + 실수 회피
- **타이밍:** 주요 기능 개발, 버그 수정, 신규 기술 도입 **직전**
- **확인 범위:**
  - 같은 도메인의 이전 작업 (`project_search_history` 키워드: 기능명, 기술명, 문제명)
  - 공통 도구·패턴 (테스트 전략, 배포 프로세스, 권한 정책)
  - 프로젝트별 교훈·주의사항 (STATUS.md, 프로젝트별 learning 파일)
- **결과:** "이전에 XXX 문제를 겪었으므로, 이번에는 YYY 접근법 사용" 근거 제시

### 2. 작업 중 의사결정 기록 (Mid-Execution)
- **기록 대상:**
  - 경로 선택 (여러 해결책 중 선택한 이유)
  - 기술적 장애물 (예상치 못한 문제, 해결 방법)
  - 설계 트레이드오프 (속도 vs. 안정성, 단순함 vs. 기능)
  - 외부 제약 (정책, 권한, 환경 제약에 대한 대응)
- **도구:** 코드 주석, 커밋 메시지, PR 설명, malgnai-hub `decision_record`

### 3. 작업 후 교훈 기록 (Post-Execution)
- **기록할 내용:**
  - **문제 해결 기록:** 동일한 문제를 다시 만나면 참고할 수 있는 단계별 해결책
  - **성공 패턴:** "이 기술/도구/접근법은 OOO 상황에서 효과적" (근거: 파일, 성능 메트릭)
  - **실패 패턴:** "XXX를 하면 안 됨. 이유는 YYY" (재발방지)
  - **도메인 지식:** "이 기능 개발할 때 주의할 점"
  - **환경·정책 업데이트:** 새로운 규칙, 제약, 권한, 승인 절차
- **저장 위치:**
  - 프로젝트별 `docs/training-report-<주제>.md` (구체적, 재사용 가능)
  - malgnai-hub에는 별도 메모리 등록 도구가 없음 — 재사용 가능한 교훈은 `decision_record`의 `reason`/`impact`(결정형) 또는 `work_record`의 `result`/`nextAction`(작업형)에 녹여 기록한다
  - 프로젝트 `STATUS.md` (진행 상태 갱신)

### 4. 교훈의 자산화 (Knowledge Asset)
- **정보 구조:**
  - 상황(Context): 언제 문제가 발생했는가? (프로젝트, 기능, 환경)
  - 문제(Problem): 구체적인 증상, 에러 메시지
  - 해결책(Solution): 단계별 해결 방법, 코드 예시
  - 예방(Prevention): 향후 같은 문제 피하기 위한 체크리스트
  - 참고(Reference): 관련 파일, 커밋, PR 링크
- **접근성:**
  - malgnai-hub `project_search_history` 키워드로 빠르게 찾기
  - 프로젝트별 README에 중요 교훈 요약
  - 온보딩 체크리스트에 "반드시 읽어야 할 학습 보고서" 링크

### 5. 피드백 루프 (Continuous Improvement)
- **관찰:** 같은 문제가 반복되면 교훈이 충분하지 않은 것
- **평가:** "이 교훈이 실제로 도움이 되었는가?" (피드백)
- **개선:** 교훈을 더 명확하게, 접근 가능하게 개선
- **폐쇄:** 새로운 발견 → 교훈 갱신 → 다시 공유

## Execution Checklist

### Pre-Execution Phase (작업 착수 전)

#### 1. Knowledge Search & Retrieval
- [ ] **malgnai-hub 이력 검색:**
  - `project_search_history` 키워드: 기능명 (예: "로그인", "결제")
  - `project_search_history` 키워드: 기술명 (예: "PostgreSQL", "Playwright")
  - `project_search_history` 키워드: 문제명 (예: "CORS 에러", "타이밍 이슈")
  - 결과 3-5개 읽고 적용 가능한 패턴 추출
- [ ] **프로젝트 STATUS.md 검토:**
  - "알려진 이슈" 섹션 (현재 프로젝트의 반복 문제)
  - "근본 원인 분석" 섹션 (이전에 해결한 깊은 문제)
- [ ] **프로젝트 docs/training-report-*.md 검색:**
  - 파일명 키워드로 관련 보고서 찾기
  - "예방" 섹션에서 체크리스트 추출
- [ ] **팀 공유 자산 확인:**
  - 이 플러그인의 관련 공용 스킬(skills/common-*, skills/domain-*)이 이미 이 절차를 다루는지 확인
  - 관련 knowledge/ 문서(에이전트 MD가 참조하는 경로)를 확인

#### 2. Risk Assessment with Lessons
- [ ] **이전 교훈에서 위험 확인:**
  - "이런 실수를 했는데 XX는 확인했나?" (주의사항 체크)
  - "이전에 XX 환경에서 문제가 있었으니, 이번에도 테스트하자"
- [ ] **예방 체크리스트 작성:**
  - malgnai-hub 이력 + STATUS.md 기반으로 "이 작업에서 피해야 할 것" 리스트
  - 예: "CORS 설정 변경 시마다 로컬+스테이징 환경에서 테스트"

#### 3. Learning Gap 식별
- [ ] **부족한 지식 확인:**
  - 이전 교훈이 없으면 "신규 도메인" 마크
  - 관련 문서/링크/튜토리얼 미리 수집
- [ ] **멘토링 요청 (필요 시):**
  - malgnai-hub `issue_record`: "XXX 분야 경험 부족, 멘토링 필요"
  - 진행 중 질문할 수 있도록 태그 / 링크 준비

### Execution Phase (작업 진행 중)

#### 4. Decision & Obstacle Logging
- [ ] **의사결정 기록:**
  - 여러 해결책 중 선택한 이유 (코드 주석, PR 설명)
  - 패턴: "XXX 접근법을 선택한 이유: YYY (성능 +5%, 복잡도 -3)"
- [ ] **장애물 기록:**
  - 예상치 못한 문제 (에러 메시지, 상황, 임시 해결책)
  - malgnai-hub `issue_record`: "XXX 문제 발생, YYY로 우회 (근본 해결 필요)"
- [ ] **외부 제약 대응:**
  - 권한 부족 → `common-permission-policy-compliance` 따르기 + 기록
  - 정책 제약 → 제약 사항을 `issue_record`로 남기고 확인·승인 요청을 PM에 반환(사용자 확인은 PM이 한다)

#### 5. Experiment & Validation
- [ ] **테스트 + 기록:**
  - 어떤 입력으로 어떤 결과가 나왔는지 기록
  - 패턴: "테스트 A (입력 X) → 결과 Y (예상 Z와 불일치, 원인 미파악)"
- [ ] **재현성 보증:**
  - 같은 결과를 반복할 수 있는가? (재현성 확인)
  - 실패하면 → 조건·환경 재기록

### Post-Execution Phase (작업 완료 후)

#### 6. Problem-Solution Pairing
- [ ] **해소된 이슈를 닫는다:** 이번 작업이 해소한 열린 이슈는 실물 대조 후 `issue_resolve`로 닫는다 — 내가 연 이슈가 아니어도 확인한 쪽이 닫는다. 여는 지시(#3·#4)만 돌면 이미 고쳐진 문제가 열린 채 쌓인다. 정본: Skill `common-learning-loop-knowledge-management` "이슈 종결(Close)"
- [ ] **발견한 각 문제마다 해결책 문서화:**
  - **Context:** "로그인 기능 개발, Ubuntu 22.04, Node 18.12"
  - **Problem:** "CORS 에러: Access-Control-Allow-Origin 미설정"
  - **Solution:** 
    ```
    1. backend/middleware/cors.js 수정
    2. process.env.ALLOWED_ORIGIN 확인
    3. 테스트: curl -H "Origin: http://localhost:3000" ...
    ```
  - **Prevention:** "매번 새 도메인 추가 시 CORS 체크리스트 실행"
  - **Reference:** 
    - 코드: `backend/middleware/cors.js:12-30`
    - PR: `#123`
    - 커밋: `abc1234`

#### 7. Knowledge Structuring & Storage
- [ ] **프로젝트 learning 보고서 작성 (필요 시):**
  - 파일: `docs/training-report-<기능또는문제>.md`
  - 크기: 500-1500 단어 (재사용 가능한 깊이)
  - 목차: Context → Problem → Solution → Prevention → Reference
- [ ] **malgnai-hub 기록:**
  - 별도 메모리 등록 도구는 없음 — 교훈을 형태에 맞춰 기존 기록에 편입
    - 결정형 교훈 → `decision_record(projectId, title, decision, reason, ...)`의 `reason`/`impact`에 녹여 기록
    - 작업형 교훈 → `work_record(projectId, status, title, summary, ...)`의 `result`/`nextAction`에 녹여 기록
- [ ] **STATUS.md 갱신:**
  - "알려진 이슈" 섹션에 신규 발견 추가
  - "근본 원인 분석" 섹션에 새로운 통찰 기록
  - "주의사항" 섹션에 예방 체크리스트 추가

#### 8. Pattern Generalization
- [ ] **일회성 해결책 → 재사용 가능 패턴 전환:**
  - "이 기술은 다른 기능에도 쓸 수 있을까?" (일반화)
  - 재사용 가능하면 → 공유 스킬/guide로 추상화
- [ ] **팀 공유:**
  - 중요 패턴 → 공용 스킬(`skills/common-*` 또는 `skills/domain-*`)로 추상화해 편입 — Skill로 신설할지 Knowledge로 둘지의 판정 기준은 `agents/trainer.md` 핵심 원칙의 "신설 판정"이 정본이다
  - 프로젝트 특수 → STATUS.md 또는 learning-report
  - 개인 참고 → malgnai-hub `decision_record`/`work_record`에 녹여 기록 (별도 메모리 도구 없음)

#### 9. Effectiveness Feedback
- [ ] **이전 교훈 유효성 평가:**
  - "이전에 배운 XXX 패턴이 이번에도 효과적이었나?"
  - YES: 관련 decision_record/work_record에 효과 확인됨을 갱신
  - NO: 관련 기록에 재검토 필요 표시
- [ ] **갭 분석:**
  - "이전 교훈으로 방지하지 못한 문제가 있나?"
  - 있으면 → 교훈 추가

### Continuous Loop (반복)

#### 10. Monitoring & Triggering
- [ ] **같은 문제 재발 감시:**
  - 같은 버그가 다시 나오면 → 교훈이 부족함을 의미
  - malgnai-hub `issue_record`로 "XX 문제 재발, 기존 교훈 불충분" 기록
  - 교훈 개선 또는 온보딩 강화 필요
- [ ] **학습 기회 감지:**
  - 새로운 기술 도입, 새로운 에러 → 곧 "새로운 교훈" 생성 기회
  - 타겟팅: "다음 유사 작업 때 참고할 체크리스트"

## Example Learning Loop

```markdown
### Pre-Execution: PDF 내보내기 기능 개발

1. **Memory Search:**
   - 검색: "PDF", "export"
   - 결과: "PDF 레이아웃 이슈 (learning-report-pdf-css.md)" 발견
   - 액션: "다음 주의사항 확인" → 
     - @page CSS 절대 필수
     - 페이지 번호 위치
     - 배경 이미지 인라인화

2. **STATUS.md 확인:**
   - "알려진 이슈": "Safari에서 @page margin 미지원"
   - 액션: "테스트 환경에서 Chrome만 검증, Safari는 수동 테스트 따로"

3. **예방 체크리스트:**
   - [ ] @page CSS @media print 구분해서 작성
   - [ ] page-break-after 테스트 (A4 경계 확인)
   - [ ] 이미지 크기 확인 (인쇄 시 블릿 안 됨)
   - [ ] Chrome + Firefox 테스트 (Safari 별도 task)

---

### Execution: PDF 내보내기 구현

**의사결정 기록:**
- 라이브러리: html2pdf vs. pdfkit vs. Puppeteer
- 선택: Puppeteer (이유: 기존 코드 호환성, CSS 지원)

**장애물:**
- 문제: 헤더/푸터 반복 시 페이지 번호 틀림
- 임시 해결: marginTop/marginBottom 수조정
- 근본 원인: Puppeteer 헤더 오프셋 버그 (미완료)

---

### Post-Execution: 교훈 기록

**파일:** `docs/training-report-pdf-export.md`

**Content:**
- Context: PDF 내보내기 기능, React 18, Puppeteer 13
- Problem: 페이지 경계에서 헤더/푸터 위치 오류
- Solution:
  1. Puppeteer marginTop 설정 (mm 단위)
  2. 테스트 데이터: 3페이지 이상 문서
  3. Chrome DevTools Print Preview에서 확인
- Prevention: 
  - [ ] Puppeteer 헤더 복수페이지 테스트 (항상)
  - [ ] 다음 버전 업그레이드 시 버그 상태 확인
- Reference: `src/export/pdf.js:45-60`, PR #456

**malgnai-hub 기록 (work_record):**
- `title`: "PDF 내보내기 헤더 오프셋 버그 대응"
- `status`: "completed"
- `result`: "PDF 헤더는 Puppeteer 13에서 복수페이지 시 오프셋 버그. 임시: margin 수동 조정"
- `nextAction`: "버전 14 출시 시 재테스트"

**STATUS.md 갱신:**
- "알려진 이슈" 추가: "PDF 헤더 오프셋 (Puppeteer 13, 임시 해결)"
- "주의사항" 추가: "PDF 내보내기 개발 시 체크리스트 참고"

---

### Feedback Loop: 다음 유사 작업

**3개월 후, 다른 팀이 PDF 리포트 기능 개발:**
1. project_search_history: "PDF" → 위 교훈 발견
2. "페이지 번호 오류 → 알려진 버그" 미리 알고 시작
3. 리소스 절약: 2-3시간 디버깅 회피
4. 추가 발견: "Puppeteer 14 업그레이드하면 버그 해결" → work_record로 후속 기록 갱신 ✓

```

## Integration Notes
- **프로젝트 온보딩:** STATUS.md 상단에 "꼭 읽어야 할 learning report" 링크 (3-5개)
- **스프린트 회고:** "이번 스프린트에서 새로운 교훈이 나왔나?" 체크
- **신입 교육:** malgnai-hub `project_search_history`로 "이 기술/기능의 이전 문제" 한눈에 파악
- **CI/CD:** 테스트 실패 시 관련 malgnai-hub 이력(project_search_history) 자동 제안 (AI 활용)
- **통합 지표:** "학습 루프 폐쇄율" = (기록된 교훈 수) / (발견된 문제 수) ≥ 80% 목표
