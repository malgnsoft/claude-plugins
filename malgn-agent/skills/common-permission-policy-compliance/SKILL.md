---
name: common-permission-policy-compliance
description: 권한 정책 준수 및 우회 방지 프레임워크. 보안 경계를 인식하고 정책 위반 없이 합법적 대안으로 작업을 진행하는 기술. backend-dev/devops/frontend-dev/qa-engineer/security가 권한 거부·경계 상황에 부딪힐 때 사용.
---

# Permission Policy Compliance Skill

## Definition
권한 정책 준수 및 우회 방지 프레임워크. 보안 경계를 인식하고 정책 위반 없이 합법적 대안으로 작업을 진행하는 기술.
- **대상 에이전트:** backend-dev, devops, frontend-dev, qa-engineer, security
- **핵심 목표:** 권한 거부 시 정식 대안 모색 또는 명확한 보고로 작업 진행 또는 중단 결정

## Core Principles

### 1. 권한 우회 금지 (Zero Tolerance)
- **명령 우회 금지:** `sudo`, `--no-verify`, `--force`, `--skip-*` 등 권한 게이트를 우회하는 플래그 사용 금지
- **정책 무력화 금지:** `.gitignore` 무시, 환경변수 억지 설정, 빌드 스킵, 테스트 스킵 금지
- **감지 회피 금지:** 권한 체크를 속이거나 로그를 숨기려는 시도 금지
- **결과:** 모든 우회 시도는 사용자 명시 지시가 있어도 거절하고 보고

### 2. POSIX 표준 대안 사용
- **symlink 제약:** 심볼릭 링크 생성 거부 → `cp -r` 또는 상대 경로로 해결
- **파일 시스템 접근:** 제한된 경로 → 공개 디렉토리(홈, 프로젝트) 또는 scratchpad 사용
- **프로세스 제어:** 종료 거부 → `--timeout` 옵션, 스핀락 대기, 로그 분석으로 진행 상황 감시
- **원칙:** 표준 도구 + 표준 플래그만 사용

### 3. 권한 Deny 시 의사결정 트리
```
명령 실행
  ├─ 성공 → 계속
  └─ Permission Denied
      └─ POSIX 대안 존재? (예: symlink→cp, sudo→별도 권한 요청)
          ├─ YES → 대안 제시 + 작업 진행
          └─ NO → 작업 필수 여부?
              ├─ 필수(승인 필요) → AskUserQuestion으로 즉시 확인 요청 + 응답 대기 (malgnai-hub에는 웹 승인 큐 없음, 세션 내 직접 확인만 가능)
              └─ 선택(생략 가능) → 건너뜀 (영향도 확인)
```

### 4. 정책 위반 감지와 보고
- **조용한 실패 금지:** 권한 에러를 무시하거나 우회하지 말 것 (감지 실패 = 보안 위협)
- **투명 보고:** 권한 거부 이유, 시도한 대안, 필요한 승인을 명확히 기록
- **근거 제시:** 에러 메시지, 정책 문서, 대안의 제약사항을 인용
- **기록:** malgnai-hub `issue_record` (권한 장애물). 승인 필요 작업은 AskUserQuestion으로 직접 확인 (malgnai-hub v1에는 command_add 같은 웹 승인 큐 도구가 없음)

### 5. 사전 계획과 검증
- **사전 체크:** 작업 시작 전 필요한 권한 목록 작성
- **권한 테스트:** 핵심 단계에서 권한 확인 (중반에 실패하는 것 방지)
- **폴백 계획:** 각 권한 거부 시 대체 전략 준비
- **감사 추적:** 어떤 권한으로 무엇을 했는지 로그 남기기

## Compliance Checklist

### Pre-Execution Planning
- [ ] 작업에 필요한 권한 목록 작성 (파일 접근, 프로세스 제어, 네트워크 등)
- [ ] 각 권한에 대한 POSIX 표준 대안 미리 확인
- [ ] 프로젝트 정책 문서 검토 (권한 규칙, 승인 절차)
- [ ] 관련 환경변수, 플래그, 라이센스 제약 확인

### Command Execution Discipline
- [ ] 강제 플래그(`--force`, `--skip-*`, `-f`) 사용 금지
- [ ] 관리자 권한(`sudo`, `sudo -E`) 요청 금지
- [ ] 정책 무력화(`--no-verify`, `--no-gpg-sign`, `-c` 억지 설정) 금지
- [ ] 감지 회피(리다이렉트 to `/dev/null`, 조용한 모드) 금지

### Error Handling Protocol
- [ ] 권한 거부 에러 메시지 전체 캡처
- [ ] POSIX 표준 대안 검색:
  - [ ] 파일 시스템: `cp`, `mv`, `chmod` 등 표준 명령
  - [ ] 프로세스: `timeout`, `wait`, 로그 모니터링
  - [ ] 환경: 경로 변경, 임시 디렉토리(`$TMPDIR`, scratchpad)
- [ ] 대안 없으면 명시: "표준 도구로는 불가능 → 승인 필요"
- [ ] 선택사항이면 건너뛰기, 필수면 AskUserQuestion으로 직접 승인 요청

### Decision Documentation
- [ ] "접근 불가 → 대안 시도" 의사결정 로깅
- [ ] 대안 선택 이유 명시 (정책 준수, 보안, 표준성)
- [ ] 건너뜬 단계 및 영향도 기록 (선택사항 부재 시 문제 없음 확인)
- [ ] 승인 필요 작업 → AskUserQuestion으로 직접 확인 + 응답 대기 (malgnai-hub에는 해당 없음: 웹 승인 재개 기능 없음)

### Policy Violation Prevention
- [ ] 권한 게이트 무시 없음 (test 스킵, CI 건너뛰기 금지)
- [ ] 환경변수 억지 설정 없음 (예: `NODE_ENV=production` 무시)
- [ ] 빌드/배포 검증 단계 부재 금지
- [ ] 감사 로그 조작 없음

### Post-Execution Audit Trail
- [ ] 실행 권한 기록 (사용자, 타임스탬프, 세션 ID)
- [ ] 변경 사항 로그 (어떤 파일을 누가 수정했는지)
- [ ] 권한 거부 이력 (시도한 명령, 대체 경로)
- [ ] 승인 기록 (AskUserQuestion 확인 시점, 승인자)

### Escalation Path
- [ ] Tier 1: POSIX 표준 대안 존재 → 제시 + 진행
- [ ] Tier 2: 대안 없고 선택사항 → 건너뜀 (영향도 확인)
- [ ] Tier 3: 대안 없고 필수 → AskUserQuestion으로 직접 승인 요청 + 대기 (malgnai-hub에는 해당 없음: 웹 승인 재개 기능 없음)
- [ ] Tier 4: 승인 거부 → 작업 중단 + 대체 계획 수립

## Example Scenarios

### Scenario 1: sudo 권한 요청 (금지)
```
$ sudo systemctl restart nginx
[Permission Denied]

❌ DO NOT: sudo 사용 계속, 우회 명령 찾기
✓ DO: 표준 대안 → 프로젝트 권한 검토, 또는 명시된 사용자에 요청

→ AskUserQuestion: "시스템 서비스 재시작 권한 필요" (malgnai-hub에는 command_add 웹 승인 큐 없음, 세션 내 직접 확인)
→ 승인 받을 때까지 대기 또는 다른 테스트로 진행
```

### Scenario 2: --force 플래그 사용 (금지)
```
$ git push --force origin main
[Permission Denied]

❌ DO NOT: git push --force, --no-verify로 우회
✓ DO: 표준 git 워크플로우 → rebase/merge로 정리

→ 강제 푸시 대신 일반 푸시 시도, 또는 코드 리뷰 대기
```

### Scenario 3: 파일 접근 거부 (표준 대안)
```
$ ln -s /restricted/data data_link
[Permission Denied]

✓ DO: cp 사용 또는 경로 변경
$ cp -r /restricted/data ./local_data
또는
$ cd /project && cp -r ../data ./local_data

→ 표준 도구로 해결, 진행
```

### Scenario 4: 환경변수 억지 설정 (금지)
```
CI=false npm start  # 빌드 검증 우회 시도
[Permission Denied]

❌ DO NOT: CI 값 조작(예: CI=false), test 스킵
✓ DO: 정책 검증 단계 수행, 실패 이유 기록

→ 검증 실패 → issue_record 로깅 → 해결 또는 중단
```

## Integration Notes
- **pre-push 훅:** 강제 플래그 탐지 (git push 전 검증)
- **CI 정책:** 스킵된 단계 감지 (빌드 불완전성 경고)
- **감사 로그:** 모든 권한 거부 → malgnai-hub issue_record (추적 가능)
- **승인 워크플로우:** malgnai-hub 연동판에서는 해당 없음 (웹 승인 큐/재개 기능 없음) — AskUserQuestion으로 세션 내 직접 확인·승인 후 issue_record에 결과 기록
