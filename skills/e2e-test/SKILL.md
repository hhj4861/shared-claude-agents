---
name: e2e-test
description: E2E 테스트 실행. 시나리오 기반으로 브라우저 테스트를 실행한다.
---

# E2E Test Skill

메인 에이전트가 직접 Playwright MCP로 E2E 테스트를 실행합니다.

## 사용법

```bash
/e2e-test                    # 전체 TC 순차 실행 (기본)
/e2e-test --list             # TC 그룹 목록 조회 (테스트 실행 안함)
/e2e-test TC-AUTH-E2E-001    # 특정 TC만 실행
/e2e-test TC-001~003         # TC-001부터 TC-003까지 실행
/e2e-test @CORE              # CORE 그룹만 실행 (TC-CORE-E2E-*)
/e2e-test @AUTH              # AUTH 그룹만 실행 (TC-AUTH-E2E-*)
/e2e-test @CLIENT,MENU       # 여러 그룹 실행 (TC-CLIENT-E2E-*, TC-MENU-E2E-*)
```

### --list 옵션 (그룹 목록 조회)

`/e2e-test --list` 실행 시:
1. 시나리오 파일에서 TC 그룹 추출
2. 각 그룹별 TC 수 표시
3. 테스트는 실행하지 않음

```bash
# 시나리오 파일에서 그룹 목록 추출
grep -oE 'TC-[A-Z]+-E2E' docs/qa/latest/scenarios/e2e-scenarios.md | \
  sed 's/-E2E$//' | sed 's/^TC-//' | sort | uniq -c | sort -rn
```

**출력 예시:**
```
사용 가능한 TC 그룹:
  @CORE    (8 TC)  - 핵심 기능 검증
  @AUTH    (3 TC)  - 인증 시나리오
  @CLIENT  (5 TC)  - 클라이언트 관리
  @MENU    (6 TC)  - 메뉴 관리
  @EDGE    (12 TC) - 엣지 케이스

사용법: /e2e-test @CORE 또는 /e2e-test @AUTH,CLIENT
```

### 그룹 필터링 규칙

`@그룹명` 형식으로 특정 그룹만 필터링:
- TC ID 패턴: `TC-{GROUP}-E2E-{번호}`
- **대소문자 구분 없음**: `@core`, `@CORE`, `@Core` 모두 동일
- `@CORE` → TC-CORE-E2E-* 모든 TC 실행
- `@auth` → TC-AUTH-E2E-* 모든 TC 실행
- `@client,menu` → TC-CLIENT-E2E-*, TC-MENU-E2E-* 모두 실행

**자연어 요청도 동일하게 처리:**
- "CORE 그룹 e2e 테스트" → `@CORE`와 동일
- "AUTH, CLIENT 테스트해줘" → `@AUTH,CLIENT`와 동일

## 실행 규칙

### 금지 사항
- Task로 step4-e2e-tester 호출하지 마라 (메인에서 직접 실행!)
- 사용자에게 질문하지 마라 (자동 진행)
- 대시보드 시나리오 로드 없이 테스트 시작하지 마라
- TC 순서 건너뛰지 마라 (TC-001 완료 후 TC-002)
- 스텝 순서 건너뛰지 마라 (스텝1 완료 후 스텝2)
- 중간에 리포트 작성하지 마라 (모든 TC 완료 후 1회만)

### 필수 사항
- 메인 에이전트가 직접 Playwright MCP 도구 사용
- 대시보드 API로 실시간 진행 상황 전송
- 인자 없으면 전체 TC 순서대로 실행
- 특정 TC 지정 시 해당 TC만 실행
- **모든 스텝 완료 처리 필수** (아래 상세 규칙 참조)

### 스텝 완료 처리 규칙 (CRITICAL)

**TC 완료 시 반드시 해당 TC의 모든 스텝을 완료 처리해야 함!**

```
잘못된 예시 (❌):
  TC에 5개 스텝이 있는데 2개만 완료 처리
  → 대시보드에서 TC는 passed지만 스텝 3,4,5가 회색으로 표시됨

올바른 예시 (✅):
  TC에 5개 스텝이 있으면 5개 모두 완료 처리
  → 대시보드에서 TC도 passed, 모든 스텝도 녹색으로 표시됨
```

**스텝 완료 처리 방법:**

1. **TC 시작 전 스텝 수 확인**
```bash
# API로 해당 TC의 스텝 수 확인
curl -s http://localhost:3847/api/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
tc = next((s for s in d['scenarios'] if s['tcId']=='TC-XXX-E2E-001'), None)
print(f'스텝 수: {len(tc[\"steps\"])}')
for i, step in enumerate(tc['steps']):
    print(f'  {i}: {step}')
"
```

2. **각 브라우저 액션마다 해당 스텝 완료 처리**
```bash
# 브라우저 액션 실행 후 즉시
$SYNC step "TC-XXX-E2E-001" 0 "passed"  # 스텝 0 완료
$SYNC step "TC-XXX-E2E-001" 1 "passed"  # 스텝 1 완료
# ... 모든 스텝 완료 ...
$SYNC step "TC-XXX-E2E-001" 4 "passed"  # 마지막 스텝 완료
```

3. **모든 스텝 완료 후 TC 완료 처리**
```bash
$SYNC complete "TC-XXX-E2E-001" "passed"
```

**스텝 수와 브라우저 액션 수가 다를 경우:**

시나리오 스텝 수 > 실제 브라우저 액션 수인 경우:
- 실제 액션 완료 후 나머지 스텝도 모두 passed 처리
- 예: 시나리오 5스텝, 실제 액션 3개 → 스텝 0,1,2 액션 후 완료, 스텝 3,4도 passed 처리

## 실행 순서

### 0단계: 환경 준비 (필수!)

**0-1. 프로젝트 config.json 읽기 (CRITICAL!):**

반드시 Read tool로 `{프로젝트경로}/docs/qa/latest/config.json` 읽기:

```
현재 프로젝트 경로 기준:
  → /Users/admin/Desktop/workSpace/socar-backoffice-portal-frontend/docs/qa/latest/config.json
```

**config.json 필수 항목:**
```json
{
  "fe_path": "/path/to/frontend",      // 프로젝트 경로
  "test_server": {
    "fe_url": "https://...",           // 테스트 대상 URL (★ 필수)
    "slow_mo": 0,
    "headless": false
  },
  "auth": {
    "type": "keycloak",                // 인증 방식
    "keycloak_url": "https://...",     // Keycloak URL
    "username": "user@example.com",    // 로그인 ID (★ 필수)
    "password": "password",            // 로그인 PW (★ 필수)
    "otp_method": "manual"             // OTP 방식: manual = 사용자 입력 대기
  }
}
```

**0-2. 변수 설정:**

config에서 읽은 값으로 변수 설정:
- `TEST_URL` ← config.test_server.fe_url (테스트 시작 URL)
- `AUTH_USER` ← config.auth.username
- `AUTH_PASS` ← config.auth.password
- `OTP_METHOD` ← config.auth.otp_method
- `PROJECT_PATH` ← config.fe_path
- `SCENARIO_PATH` ← `{PROJECT_PATH}/docs/qa/latest/scenarios/e2e-scenarios.md`
- `AUTH_FILE` ← `{PROJECT_PATH}/docs/qa/latest/playwright/.auth/user.json`

**0-3. 대시보드 자동 시작 + 브라우저 오픈 (MANDATORY!):**

⚠️ **매 테스트 실행 시 반드시 대시보드를 시작해야 함!**

```bash
# 대시보드 시작 스크립트 실행 (대시보드 + 브라우저 동시 오픈)
# Bash tool 사용! run_in_background: true 옵션 필수!
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/start.sh "{SCENARIO_PATH}"
```

**실행 체크리스트:**
1. ✅ Bash tool로 start.sh 실행 (run_in_background: true)
2. ✅ 2초 대기 후 대시보드 접속 확인 (http://localhost:3847)
3. ✅ 시나리오 로드 확인 (curl http://localhost:3847/api/state)

이 스크립트가 자동으로:
1. 기존 대시보드 프로세스 종료
2. 대시보드 서버 시작 (http://localhost:3847)
3. 대시보드 브라우저 창 오픈
4. 시나리오 파일 로드

**대시보드가 실행되지 않으면:**
- 테스트 진행 상황이 실시간으로 표시되지 않음
- 그룹별 결과 차트 클릭으로 상세 정보 확인 불가
- 테스트 완료 후 결과 확인이 어려움

**0-4. 인증 상태 확인 및 재사용 (JWT 체크):**

```
┌─────────────────────────────────────────────────────────────────┐
│  인증 플로우 (JWT 유효성 검사)                                   │
├─────────────────────────────────────────────────────────────────┤
│  1. MCP 도구로 auth 파일 유효성 확인:                            │
│     mcp__qa-pipeline__e2e_check_auth(project_path)              │
│                                                                 │
│  2. 결과에 따른 분기:                                            │
│     ┌─────────────────┬─────────────────────────────────────┐   │
│     │ valid: true     │ → 인증 재사용 (로그인 SKIP)          │   │
│     │                 │   browser_navigate(TEST_URL)        │   │
│     │                 │   → 바로 메인 대시보드 진입          │   │
│     ├─────────────────┼─────────────────────────────────────┤   │
│     │ valid: false    │ → 새로 로그인 필요                   │   │
│     │ (만료 또는 없음) │   로그인 → OTP → 인증 상태 저장      │   │
│     └─────────────────┴─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**인증 재사용 시 (valid: true):**
```javascript
// Playwright에서 저장된 인증 상태로 브라우저 시작
// 쿠키 + localStorage가 자동 복원되어 로그인 없이 접속 가능
mcp__playwright__browser_navigate(TEST_URL)
// → Keycloak 로그인 페이지 없이 바로 메인 대시보드 진입
```

**새 로그인 필요 시 (valid: false):**
로그인 완료 후 반드시 인증 상태 저장:
```javascript
// 로그인 성공 후 현재 브라우저 상태 저장
mcp__playwright__browser_run_code({
  code: `async (page) => {
    const context = page.context();
    await context.storageState({ path: '${AUTH_FILE}' });
    return 'Auth state saved';
  }`
})
```

**0-5. OTP 처리 (새 로그인 시에만):**

config.auth.otp_method에 따라:
- `manual`: OTP 입력 화면에서 사용자에게 OTP 입력 요청 후 대기
- `auto`: (향후 지원) 자동 OTP 처리

### 1단계: 대시보드 시나리오 확인

```bash
# 시나리오 로드 확인 (이미 start.sh에서 로드됨)
curl -s http://localhost:3847/api/state | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Loaded {len(d[\"scenarios\"])} scenarios')"
```

### 2단계: 브라우저 테스트 실행

각 TC마다:

1. **TC 시작 알림**
```bash
curl -X POST http://localhost:3847/api/tc/start -H "Content-Type: application/json" -d '{"tcId":"TC-XXX-E2E-001","name":"테스트명"}'
```

2. **브라우저 조작 (Playwright MCP)**
- `mcp__playwright__browser_navigate(url)` - 페이지 이동
- `mcp__playwright__browser_snapshot()` - DOM + ref 획득
- `mcp__playwright__browser_click(element, ref)` - 클릭
- `mcp__playwright__browser_type(element, ref, text)` - 입력

3. **각 스텝 완료 알림**
```bash
curl -X POST http://localhost:3847/api/tc/step -H "Content-Type: application/json" -d '{"tcId":"TC-XXX-E2E-001","stepIndex":0,"status":"passed"}'
```

4. **TC 완료 알림**
```bash
curl -X POST http://localhost:3847/api/tc/complete -H "Content-Type: application/json" -d '{"tcId":"TC-XXX-E2E-001","status":"passed"}'
```

5. **다음 TC로 이동** (순서 엄수!)

### 3단계: 결과 리포트

모든 TC 완료 후 `mcp__qa-pipeline__e2e_create_report` 호출

## 대시보드 동기화

### sync.sh 헬퍼 스크립트 (권장)

`/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh` 사용:

```bash
SYNC="/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh"

# TC 시작
$SYNC start "TC-AUTH-E2E-001" "Keycloak 로그인 성공"

# 스텝 완료 (0-indexed)
$SYNC step "TC-AUTH-E2E-001" 0 "passed"
$SYNC step "TC-AUTH-E2E-001" 1 "passed"
$SYNC step "TC-AUTH-E2E-001" 2 "running"  # 현재 진행 중

# TC 완료
$SYNC complete "TC-AUTH-E2E-001" "passed"

# 상태 초기화 (시나리오도 초기화됨, 주의!)
$SYNC reset
```

### 대시보드 API (직접 호출)

| API | 용도 |
|-----|------|
| POST /api/load-scenarios | 시나리오 로드 (테스트 전 1회) |
| POST /api/tc/start | TC 시작 |
| POST /api/tc/step | 스텝 완료 |
| POST /api/tc/complete | TC 완료 |
| POST /api/reset | 상태 초기화 |

### 실행 패턴 (필수!)

**각 Playwright 액션 후 반드시 대시보드 동기화:**

```
1. Playwright 액션 실행 (browser_click, browser_type 등)
2. 즉시 $SYNC step 호출로 대시보드 업데이트
3. 다음 스텝으로 이동
```

**예시:**
```bash
# 스텝 2: 이메일 입력
mcp__playwright__browser_type(element, ref, "user@example.com")
$SYNC step "TC-AUTH-E2E-001" 2 "passed"

# 스텝 3: 비밀번호 입력
mcp__playwright__browser_type(element, ref, "password123")
$SYNC step "TC-AUTH-E2E-001" 3 "passed"
```

## TC 실행 규칙

```
인자 없음 (/e2e-test):
  → 전체 TC 순서대로 실행
  → TC-001 → TC-002 → TC-003 → ...

특정 TC 지정 (/e2e-test TC-002):
  → 해당 TC만 실행
  → TC-002의 모든 스텝 순서대로

범위 지정 (/e2e-test TC-001~003):
  → TC-001, TC-002, TC-003 순서대로 실행
```

## 속도 개선 패턴

### 병렬 도구 호출 (권장)

**독립적인 작업은 병렬로 호출하여 속도 향상:**

1. **대시보드 동기화 + 다음 브라우저 액션 병렬 호출**
```
# 동시에 호출 (단일 메시지에 여러 tool call)
- Bash: $SYNC complete "TC-001" "passed" && $SYNC start "TC-002" "테스트명"
- mcp__playwright__browser_navigate(url)
```

2. **TC 전환 시 complete + start 체이닝**
```bash
$SYNC complete "TC-001" "passed" && $SYNC start "TC-002" "테스트명"
```

3. **대시보드 동기화 + ESC 키 병렬 호출**
```
# 팝업 닫기와 대시보드 업데이트 동시 실행
- Bash: $SYNC step "TC-001" 3 "passed"
- mcp__playwright__browser_press_key("Escape")
```

### snapshot 최소화

- 매 액션마다 snapshot 호출하지 않음
- 브라우저 액션 결과에서 반환되는 Page state 활용
- ref 값은 액션 결과에서 확인하여 재사용

### 주의사항

- TC 순서는 반드시 순차 실행 (TC-001 → TC-002 → TC-003)
- 스텝 순서도 순차 실행 (스텝1 → 스텝2 → 스텝3)
- 브라우저에서 테스트 동작을 확인할 수 있어야 함

## TC 그룹핑 규칙 (동적)

### TC ID 네이밍 컨벤션

```
TC-{GROUP}-E2E-{번호}

예시:
- TC-AUTH-E2E-001   → AUTH 그룹
- TC-ORDER-E2E-001  → ORDER 그룹
- TC-USER-E2E-001   → USER 그룹
```

그룹 코드는 프로젝트에 따라 자유롭게 정의 가능합니다.

### 시나리오 파일 구조 (그룹명 자동 추출)

```markdown
## 1. 인증 시나리오          ← "인증" 추출 → AUTH 그룹명
### TC-AUTH-E2E-001: Keycloak 로그인 성공
### TC-AUTH-E2E-002: 로그인 실패

## 2. 주문 관리              ← "주문" 추출 → ORDER 그룹명
### TC-ORDER-E2E-001: 주문 목록 조회
### TC-ORDER-E2E-002: 주문 등록
```

대시보드가 섹션 헤더에서 그룹명을 자동 추출합니다:
- `## 1. 인증 시나리오` → AUTH: "인증"
- `## 2. 주문 관리` → ORDER: "주문"

## 페이지 로드 타임아웃/재시도 규칙

### 메인 페이지 로드 실패 대응

페이지가 로딩 스피너만 보이고 리다이렉트가 안 되는 경우:

1. **3초 대기 후 체크**: `browser_wait_for(time=3)` 호출
2. **로그인 페이지 미도달 시 새로고침 또는 브라우저 재시작**:
   ```
   # 방법 1: 새로고침 시도
   mcp__playwright__browser_press_key("F5")

   # 방법 2: 브라우저 닫고 재시작
   mcp__playwright__browser_close()
   mcp__playwright__browser_navigate(url)
   ```
3. **최대 3회 재시도 후 실패 처리**

### 재시도 패턴 예시

```
navigate(url) → wait(3초) → snapshot 확인
  ↓ 로딩 스피너만 보임 (리다이렉트 안됨)
  → close() → navigate(url) → wait(3초) → snapshot 확인
  ↓ 여전히 실패
  → close() → navigate(url) (2차 재시도)
  ↓ 3회 실패 시 TC failed 처리
```

### 리다이렉트 성공 판단 기준

- URL이 `keycloak.socar.me` 로그인 페이지로 변경됨
- 또는 로그인 후 메인 대시보드 페이지 로드됨
- Page Snapshot에 `textbox "Username"` 등 로그인 폼 요소 존재

## Snapshot 기반 요소 매칭 규칙

### 시나리오 해석 (5-Column 형식)

시나리오의 테스트 스텝 테이블을 해석하는 방법:

```markdown
| # | 액션 | 요소 식별 | 입력값/기대값 | 예상 상태 변화 |
|---|------|----------|--------------|---------------|
| 1 | navigate | /adminMenu | - | 메뉴 관리 페이지 표시 |
| 2 | wait | 테이블 로딩 완료 | - | 스피너 사라짐 |
| 3 | click | "등록" 버튼 (상단 우측) | - | 등록 팝업 열림 |
| 4 | fill | "메뉴명" 라벨의 텍스트 필드 | "[E2E] 테스트" | 입력값 표시 |
| 5 | select | "유형" 드롭다운 | "관리자" | 옵션 선택됨 |
| 6 | click | "저장" 버튼 (팝업 하단) | - | 성공 토스트 표시 |
```

**각 컬럼 해석:**

| 컬럼 | 용도 | 사용법 |
|------|------|--------|
| 액션 | 실행할 브라우저 작업 | navigate, wait, click, fill, select, check, assert |
| 요소 식별 | snapshot에서 찾을 요소 설명 | 텍스트 + 위치/역할 힌트로 ref 매칭 |
| 입력값/기대값 | 입력할 값 또는 검증할 값 | fill/select의 값, assert의 기대값 |
| 예상 상태 변화 | 액션 후 검증할 상태 | snapshot으로 상태 변화 확인 |

### 요소 식별 → ref 매칭 전략

**시나리오의 "요소 식별" 설명을 snapshot의 ref로 매칭하는 방법:**

```yaml
매칭_우선순위:
  1. 버튼_텍스트_일치:
     시나리오: '"등록" 버튼'
     스냅샷: 'button "등록" [ref_15]'
     매칭: ref_15

  2. 라벨_연관_필드:
     시나리오: '"메뉴명" 라벨의 텍스트 필드'
     스냅샷: |
       text "메뉴명" [ref_20]
       textbox "" [ref_21]  ← 라벨 다음 textbox
     매칭: ref_21

  3. 위치_힌트_활용:
     시나리오: '"저장" 버튼 (팝업 하단)'
     스냅샷: |
       dialog "등록" [ref_30]
         ...
         button "취소" [ref_45]
         button "저장" [ref_46]  ← 팝업 내부의 저장
     매칭: ref_46 (dialog 내부 우선)

  4. 아이콘_버튼:
     시나리오: '"삭제" 버튼 (행 끝, 휴지통 아이콘)'
     스냅샷: 'button "" [ref_55] img "delete"' 또는 'button "삭제" [ref_55]'
     매칭: ref_55

  5. 드롭다운/콤보박스:
     시나리오: '"유형" 드롭다운'
     스냅샷: 'combobox "유형" [ref_60]'
     매칭: ref_60
```

### 액션별 실행 규칙

**시나리오의 "액션" 컬럼에 따른 Playwright MCP 호출:**

```yaml
navigate:
  시나리오: '| navigate | /adminMenu | - |'
  실행: mcp__playwright__browser_navigate(url=TEST_URL + "/adminMenu")
  후처리: browser_snapshot()으로 페이지 로드 확인

wait:
  시나리오: '| wait | 테이블 로딩 완료 | - |'
  실행: |
    browser_wait_for(time=2)  # 또는
    browser_snapshot() 후 테이블 요소 확인될 때까지 반복
  판단: 스피너 사라짐, 테이블 행 존재 확인

click:
  시나리오: '| click | "등록" 버튼 | - |'
  실행: |
    1. browser_snapshot()으로 현재 상태 확인
    2. "등록" 텍스트 가진 button 찾기 → ref 획득
    3. mcp__playwright__browser_click(element="등록 버튼", ref="ref_N")
  검증: "예상 상태 변화" 컬럼의 상태 확인 (팝업 열림 등)

fill:
  시나리오: '| fill | "메뉴명" 텍스트 필드 | "[E2E] 테스트" |'
  실행: |
    1. browser_snapshot()
    2. "메뉴명" 라벨 근처 textbox 찾기 → ref 획득
    3. mcp__playwright__browser_type(element="메뉴명 입력필드", ref="ref_M", text="[E2E] 테스트")

select:
  시나리오: '| select | "유형" 드롭다운 | "관리자" |'
  실행: |
    1. browser_snapshot()
    2. "유형" combobox 찾기 → ref 획득
    3. mcp__playwright__browser_click(element="유형 드롭다운", ref="ref_K")
    4. browser_snapshot()  # 옵션 목록 확인
    5. "관리자" option 클릭 → ref 획득 후 click

check:
  시나리오: '| check | "활성화" 체크박스 | true |'
  실행: |
    1. browser_snapshot()
    2. checkbox 요소 찾기 → ref 획득
    3. 현재 상태 확인 (checked 여부)
    4. 필요 시 browser_click(ref)

assert:
  시나리오: '| assert | 성공 메시지 | "저장되었습니다" |'
  실행: |
    1. browser_snapshot()
    2. 텍스트 "저장되었습니다" 존재 확인
    3. 없으면 테스트 실패 처리
```

### Snapshot 분석 패턴

**browser_snapshot() 결과에서 요소 찾기:**

```yaml
버튼_찾기:
  패턴: 'button "텍스트" [ref_N]'
  예시: |
    button "등록" [ref_15]
    button "취소" [ref_16]
    button "저장" [ref_17]

입력필드_찾기:
  패턴: 'textbox "placeholder" [ref_N]' 또는 'textbox "" [ref_N]'
  라벨연관: |
    text "메뉴명" [ref_20]
    textbox "" [ref_21]  ← ref_20 다음 textbox가 메뉴명 입력필드

드롭다운_찾기:
  패턴: 'combobox "라벨" [ref_N]' 또는 'listbox [ref_N]'
  옵션: 'option "텍스트" [ref_M]'

체크박스_찾기:
  패턴: 'checkbox "라벨" [ref_N]'
  상태: checked/unchecked 속성 확인

테이블_찾기:
  패턴: 'table [ref_N]' 또는 'grid [ref_N]'
  행: 'row [ref_M]'
  셀: 'cell "텍스트" [ref_K]' 또는 'gridcell [ref_K]'

모달/팝업_찾기:
  패턴: 'dialog "제목" [ref_N]'
  내부요소: dialog 하위의 button, textbox 등
```

### 다중 요소 처리 (CRITICAL)

**동일 텍스트의 요소가 여러 개일 때:**

```yaml
문제_상황:
  스냅샷: |
    button "저장" [ref_10]  ← 페이지 상단 저장
    dialog "등록" [ref_30]
      button "저장" [ref_46]  ← 팝업 내 저장

해결_전략:
  1. 컨텍스트_확인:
     - 시나리오: '"저장" 버튼 (팝업 하단)'
     - dialog 내부의 ref_46 선택

  2. 위치_힌트_해석:
     - "상단", "하단", "좌측", "우측" → 스냅샷 구조에서 위치 확인
     - "팝업 내", "모달 안" → dialog/modal 하위 요소 선택
     - "테이블 행 끝" → row 내 마지막 요소

  3. 역할_힌트_해석:
     - "메인 저장" vs "팝업 저장" → 계층 구조로 구분
     - "첫 번째", "두 번째" → 순서대로 선택
```

### 검증 (Assert) 패턴

**"예상 상태 변화" 컬럼 검증 방법:**

```yaml
텍스트_존재_확인:
  기대: "성공 메시지 표시"
  방법: browser_snapshot() 후 텍스트 검색
  실패조건: 해당 텍스트 없음

요소_표시_확인:
  기대: "등록 팝업 열림"
  방법: browser_snapshot() 후 dialog 존재 확인
  실패조건: dialog 요소 없음

요소_사라짐_확인:
  기대: "스피너 사라짐"
  방법: browser_snapshot() 후 spinner/loading 요소 없음 확인
  재시도: 최대 3회, 각 1초 대기

값_변경_확인:
  기대: "입력값 표시"
  방법: textbox의 value 속성 확인 (스냅샷에 포함됨)

URL_변경_확인:
  기대: "목록 페이지 이동"
  방법: browser_snapshot() 결과의 URL 확인
```

### 테스트 데이터 규칙

**시나리오의 입력값 해석:**

```yaml
prefix_규칙:
  - "[E2E]" 또는 "[TEST]" prefix 포함 시 그대로 사용
  - 테스트 완료 후 해당 데이터 삭제 가능

동적_값_처리:
  - "{{timestamp}}" → 현재 시간 (예: 20240115_143022)
  - "{{random}}" → 랜덤 문자열
  - "{{index}}" → 반복 시 인덱스

기존_데이터_보호:
  - "[E2E]" prefix 없는 데이터 삭제 금지
  - 일괄 삭제 시 반드시 prefix로 필터링 후 삭제
```

---

## 사전 조건

1. `/qa-scenario`로 시나리오 생성 완료
2. 테스트 서버 실행 중
3. 대시보드 자동 시작됨 (0단계에서 자동 실행)
