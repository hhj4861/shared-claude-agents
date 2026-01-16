---
name: e2e-test
description: E2E 테스트 실행. 시나리오 기반으로 브라우저 테스트를 실행한다.
args: "[--auto] [--list] [TC-ID] [@GROUP]"
---

# E2E Test Skill

메인 에이전트가 직접 Playwright MCP로 E2E 테스트를 실행합니다.

## ⚠️ 핵심 규칙: SYNC + MCP 필수!

### 🔄 TC 완료 시 이중 동기화 (필수!)

TC 완료 시 **대시보드 sync.sh**와 **MCP 도구**를 모두 호출해야 합니다:

```bash
# 1️⃣ 대시보드 동기화 (sync.sh)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh complete "TC-ID" pass "메시지"

# 2️⃣ MCP 상태 파일 동기화 (병렬 호출!)
mcp__qa-pipeline__e2e_update_result(
  project_path: "/Users/admin/Desktop/workSpace/socar-backoffice-portal-frontend",
  tc_id: "TC-ID",
  status: "pass"  # pass | fail | skip
)
```

**⚠️ 둘 다 호출해야 완전한 동기화!**
- sync.sh만 호출 → 대시보드 UI만 업데이트
- MCP만 호출 → 상태 파일만 업데이트
- **둘 다 호출 → 완전한 동기화 ✅**

### sync.sh 사용법

```bash
# ❌ 금지: 변수 사용 (권한 프롬프트 발생!)
SYNC="..."
$SYNC step ...

# ✅ 필수: 직접 경로 사용 (권한 프롬프트 없음)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh start "TC-ID" "테스트명"
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-ID" 0 pass "메시지"
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh complete "TC-ID" pass "메시지"
```

**❌ 금지:**
- Playwright만 호출하고 sync 안함
- `$SYNC` 변수 사용 (매번 권한 프롬프트 발생)
- 스텝 인덱스 건너뛰기 (0, 1, 3 처럼 2 누락)
- **sync.sh만 호출하고 MCP 호출 안함**

**✅ 필수:**
- 직접 경로로 sync.sh 호출
- Playwright 호출 직후 해당 스텝 sync
- 시나리오 스텝 순서대로 0, 1, 2, 3... 순차 호출
- **TC 완료 시 sync.sh + MCP 도구 둘 다 호출**

## 🚨 CRITICAL: 스텝 1:1 매칭 필수!

**시나리오에 정의된 스텝과 sync 호출이 1:1로 매칭되어야 합니다!**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🚨 스텝 누락/불일치 시 발생하는 문제:                                     │
│                                                                         │
│  ❌ 잘못된 예:                                                          │
│  - 시나리오: 9개 스텝 → sync: 8개 호출 (1개 누락)                        │
│  - 시나리오 스텝3: "타입 드롭다운" → sync 메시지: "URL 입력" (내용 불일치)  │
│  - sync step 호출: 0, 1, 2, 4, 5 (3번 스텝 인덱스 누락)                  │
│                                                                         │
│  ✅ 올바른 예:                                                          │
│  - 시나리오: 9개 스텝 → sync: 9개 호출 (완전 일치)                        │
│  - 각 스텝 인덱스와 내용이 시나리오와 1:1 매칭                            │
│  - sync step 호출: 0, 1, 2, 3, 4, 5, 6, 7, 8 (순차적)                   │
└─────────────────────────────────────────────────────────────────────────┘

스텝 매칭 체크리스트 (매 TC마다):
  1. 먼저 대시보드에서 해당 TC의 스텝 목록 확인
  2. 각 Playwright 액션이 어떤 스텝에 해당하는지 매칭
  3. 스텝 인덱스 0부터 순차적으로 sync step 호출
  4. 스텝 내용(메시지)도 시나리오 스텝명과 일치하도록 작성
  5. 모든 스텝 완료 후 complete 호출
```

### 스텝별 sync 호출 예시 (직접 경로 사용!)

```bash
# TC 시작
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh start "TC-MENU-E2E-003" "아이템 메뉴 생성"

# 스텝 0: /adminMenu
mcp__playwright__browser_navigate("/adminMenu")
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-MENU-E2E-003" 0 pass "/adminMenu 페이지 이동"

# 스텝 1: 클라이언트 드롭다운
mcp__playwright__browser_click(...)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-MENU-E2E-003" 1 pass "클라이언트 선택"

# ... 스텝 2, 3, 4, 5, 6, 7, 8 모두 순차 호출 ...

# TC 완료 (모든 스텝 sync 후!) - 이중 동기화 필수!
# 1️⃣ 대시보드
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh complete "TC-MENU-E2E-003" pass "아이템 메뉴 생성 완료"

# 2️⃣ MCP (병렬 호출!)
mcp__qa-pipeline__e2e_update_result(
  project_path: "/Users/admin/Desktop/workSpace/socar-backoffice-portal-frontend",
  tc_id: "TC-MENU-E2E-003",
  status: "pass"
)
```

### 상태 값 구분

| 상태 | 언제 사용 | 예시 |
|------|----------|------|
| `passed` | 테스트 성공 | 모든 스텝 정상 통과 |
| `failed` | 테스트 실패 | 요소 못 찾음, assertion 실패 |
| `skip` | 테스트 건너뜀 | 사전조건 미충족, 환경 문제 |

**주의:**
- `skip`을 `passed`로 처리하면 안 됨!
- `failed`도 정확히 `failed`로 보고해야 함!
- 대시보드에서 pass/fail/skip 통계가 정확해야 함!

## 사용법

```bash
/e2e-test                    # 전체 TC 순차 실행 (기본)
/e2e-test --auto             # 질문 없이 자동 실행
/e2e-test --list             # TC 그룹 목록 조회 (테스트 실행 안함)
/e2e-test TC-AUTH-E2E-001    # 특정 TC만 실행
/e2e-test TC-001~003         # TC-001부터 TC-003까지 실행
/e2e-test @CORE              # CORE 그룹만 실행 (TC-CORE-E2E-*)
/e2e-test @AUTH              # AUTH 그룹만 실행 (TC-AUTH-E2E-*)
/e2e-test @CLIENT,MENU       # 여러 그룹 실행 (TC-CLIENT-E2E-*, TC-MENU-E2E-*)
/e2e-test --auto @CORE       # 자동 모드로 CORE 그룹만 실행

# 재테스트 명령어 ⭐
/e2e-test --retry            # 재테스트 대상 전체 (미진행 + 보류 + 실패)
/e2e-test --pending          # 미진행(waiting) TC만 실행
/e2e-test --incomplete       # 보류(pending/완성도 낮음) TC만 재실행
/e2e-test --failed           # 실패(failed) TC만 재실행
/e2e-test --retry @MENU      # MENU 그룹 내 재테스트 대상만 실행
/e2e-test --failed @AUTH     # AUTH 그룹 내 실패 TC만 재실행

# 특정 이력 기반 재테스트 ⭐⭐
/e2e-test --history 2026-01-15T07-09-32_latest.json --failed  # 특정 이력의 실패 TC만 재실행
/e2e-test --history 2026-01-15T07-09-32_latest.json --retry   # 특정 이력의 재테스트 대상 실행
```

## 실행 모드

| 모드 | 명령 | 설명 |
|------|------|------|
| 일반 | `/e2e-test` | 확인 후 전체 테스트 실행 |
| 자동 | `/e2e-test --auto` | 질문 없이 자동 실행 |
| 목록 | `/e2e-test --list` | TC 그룹 목록만 조회 |
| 특정 TC | `/e2e-test TC-001` | 해당 TC만 실행 |
| 그룹 | `/e2e-test @CORE` | 해당 그룹만 실행 |
| **재테스트** | `/e2e-test --retry` | 미진행+보류+실패 TC 실행 |
| **미진행** | `/e2e-test --pending` | 미진행(waiting) TC만 실행 |
| **보류** | `/e2e-test --incomplete` | 보류(완성도 낮음) TC만 재실행 |
| **실패** | `/e2e-test --failed` | 실패 TC만 재실행 |
| **이력 지정** | `/e2e-test --history xxx.json` | 특정 이력 파일 기반으로 실행 |

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

### 재테스트 옵션 (--retry, --pending, --incomplete, --failed)

대시보드 `/api/summary`에서 재테스트 대상 TC를 조회하여 실행합니다.

```bash
# 1. 재테스트 대상 조회
SUMMARY=$(curl -s http://localhost:3847/api/summary)

# 2. 각 분류별 TC 목록 확인
echo "$SUMMARY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('📋 재테스트 대상 현황:')
print(f'  - 미진행 (waiting):  {len(d.get(\"waitingTCs\", []))}개')
print(f'  - 보류 (incomplete): {len(d.get(\"pendingTCs\", []))}개')
print(f'  - 실패 (failed):     {len(d.get(\"failedTCs\", []))}개')
print(f'  - 건너뜀 (skip):     {len(d.get(\"skipTCs\", []))}개')
"
```

**재테스트 분류:**

| 옵션 | API 필드 | 대상 | 설명 |
|------|----------|------|------|
| `--retry` | 전체 | waiting + pending + failed | 모든 재테스트 대상 |
| `--pending` | `waitingTCs` | 미진행 TC | 아직 테스트 시도 안 함 |
| `--incomplete` | `pendingTCs` | 보류 TC | 완성도 50% 미만으로 pending 처리됨 |
| `--failed` | `failedTCs` | 실패 TC | 테스트 실패 |

**재테스트 실행 흐름:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  /e2e-test --retry 실행 흐름                                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. /api/summary 호출하여 재테스트 대상 조회                              │
│     → waitingTCs, pendingTCs, failedTCs 목록 획득                       │
│                                                                         │
│  2. 대상 TC 목록 표시 및 사용자 확인                                      │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ "재테스트 대상 TC:                                          │     │
│     │  - 미진행: TC-MENU-E2E-004, TC-MENU-E2E-005                │     │
│     │  - 보류:   TC-CLIENT-E2E-002 (완성도 33%)                  │     │
│     │  - 실패:   TC-AUTH-E2E-003                                 │     │
│     │                                                             │     │
│     │ 총 4개 TC를 재테스트합니다. 진행할까요?"                     │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  3. TC 순서대로 재실행                                                   │
│     → 기존 passed TC는 유지, 대상 TC만 실행                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🔧 보류(Pending) TC 사유 확인 및 시나리오 업데이트

재테스트 요청 시, 보류된 TC들의 **사유(message)**를 먼저 확인해야 합니다.
보류 사유에 따라 시나리오 업데이트가 필요할 수 있습니다.

**보류 사유 확인:**
```bash
# 보류 TC 목록 및 사유 조회
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh pending

# 전체 미완료 TC 조회 (pending + skip + waiting)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh incomplete
```

**사유별 처리 방법:**

| 보류 사유 | 처리 방법 |
|----------|----------|
| "API 직접 호출 필요" | 시나리오를 `api_delete`, `api_post` 액션으로 업데이트 |
| "제한된 권한 계정 필요" | 별도 계정 준비 또는 API 토큰 방식으로 변경 |
| "특수 환경 필요" | 사전조건에 환경 설정 스텝 추가 |
| "데이터 사전 준비 필요" | 시나리오에 데이터 생성 스텝 추가 |

**시나리오 업데이트 흐름:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  보류 TC 재테스트 전 시나리오 업데이트 흐름                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. sync.sh pending 으로 보류 사유 확인                                  │
│                                                                         │
│  2. 사유 분석:                                                          │
│     - "API 직접 호출 필요" → 시나리오 액션을 api_xxx로 변경               │
│     - "권한 계정 필요" → 사전조건 추가 또는 API 방식으로 변경              │
│                                                                         │
│  3. 시나리오 파일 수정 (e2e-scenarios.md)                                │
│     - 액션 타입 변경: (API 직접 호출) → api_delete, api_post             │
│     - page.request.delete(), page.request.post() 사용 명시              │
│                                                                         │
│  4. 대시보드 시나리오 리로드                                              │
│     curl -X POST "http://localhost:3847/api/load-scenarios" ...         │
│                                                                         │
│  5. 재테스트 실행                                                        │
│     /e2e-test --incomplete                                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**시나리오 업데이트 예시 (API 호출 방식):**

```markdown
# 변경 전 (보류됨)
| 4 | (API 직접 호출) | DELETE /v1/menus/{삭제된ID} | - | API 호출 |

# 변경 후 (실행 가능)
| 4 | api_delete | /v1/menus/{menuId} | 이전 스텝에서 획득한 menuId | page.request.delete() |
| 5 | assert | 응답 상태 | 404 또는 400 | 에러 응답 확인 |
```

**Playwright API 호출 방식:**
```javascript
// 브라우저 컨텍스트 내에서 API 호출 (인증 쿠키 자동 포함)
const response = await page.request.delete(`/v1/menus/${menuId}`);
const status = response.status();  // 404 또는 400 예상
```

**그룹 필터링과 조합:**

```bash
# MENU 그룹 내 실패 TC만 재실행
/e2e-test --failed @MENU

# AUTH, CLIENT 그룹 내 미진행 TC만 실행
/e2e-test --pending @AUTH,CLIENT

# 모든 그룹의 보류(완성도 낮음) TC 재실행
/e2e-test --incomplete
```

**재테스트 TC 필터링 로직:**

```python
# /api/summary 응답에서 재테스트 대상 추출
def get_retry_candidates(summary, mode, groups=None):
    candidates = []

    if mode == 'retry':  # 전체
        candidates = summary['waitingTCs'] + summary['pendingTCs'] + summary['failedTCs']
    elif mode == 'pending':  # 미진행
        candidates = summary['waitingTCs']
    elif mode == 'incomplete':  # 보류
        candidates = summary['pendingTCs']
    elif mode == 'failed':  # 실패
        candidates = summary['failedTCs']

    # 그룹 필터링
    if groups:
        group_list = [g.upper() for g in groups.split(',')]
        candidates = [tc for tc in candidates
                      if any(f'TC-{g}-E2E' in tc['tcId'] for g in group_list)]

    return candidates
```

### --history 옵션 (특정 이력 기반 테스트) ⭐⭐

대시보드에서 과거 이력을 선택한 후 해당 이력 기반으로 재테스트할 때 사용합니다.

**사용 시나리오:**
1. 대시보드에서 과거 이력 확인 (`http://localhost:3847/?restored=xxx`)
2. 해당 이력의 실패 TC만 재실행하고 싶을 때
3. `/e2e-test --history xxx.json --failed` 실행

**이력 파일명 확인:**
```bash
# history/ 폴더에서 이력 파일 목록 확인
ls -la /Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/history/

# 또는 대시보드 API로 확인
curl -s http://localhost:3847/api/history | python3 -c "
import sys,json
histories = json.load(sys.stdin)['histories']
for h in histories[:5]:
    print(f'{h[\"filename\"]}: {h[\"summary\"][\"passed\"]}P/{h[\"summary\"][\"failed\"]}F')"
```

**--history와 --failed/--retry 조합:**
```bash
# 특정 이력의 실패 TC만 재실행
/e2e-test --history 2026-01-15T07-09-32_latest.json --failed

# 특정 이력의 미진행+실패 TC 재실행
/e2e-test --history 2026-01-15T07-09-32_latest.json --retry

# 특정 이력 + 특정 그룹
/e2e-test --history 2026-01-15T07-09-32_latest.json --failed @MENU
```

**동작 원리:**
1. `--history xxx.json` → 대시보드 시작 시 `HISTORY_FILE=xxx.json` 환경변수 설정
2. 대시보드가 해당 이력 파일에서 결과 복원
3. `--failed` → 복원된 이력에서 실패 TC 목록 조회
4. 해당 TC만 재실행

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

### 그룹 필터링 + 이력 복원 조합 (CRITICAL)

`/e2e-test @MENU` 실행 시 이전 이력이 있으면 **그룹 내 미완료 TC만 실행**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  /e2e-test @MENU 실행 흐름                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 대시보드 시작 및 이전 이력 자동 복원                                  │
│     → 서버가 history/ 폴더에서 최근 이력 로드                            │
│                                                                         │
│  2. 이전 결과 확인 (MENU 그룹 기준으로 표시)                              │
│     → "MENU 그룹: 완료 5개 (PASS: 4, FAIL: 1), 미완료 3개"              │
│                                                                         │
│  3. 사용자에게 선택 질문:                                                │
│     ┌─────────────────────────────────────────────────────────────┐     │
│     │ "이전 MENU 그룹 테스트 이력이 있습니다.                      │     │
│     │  - 완료: 5개 (PASS: 4, FAIL: 1)                             │     │
│     │  - 미완료: 3개                                              │     │
│     │                                                             │     │
│     │ 어떻게 진행할까요?"                                         │     │
│     │                                                             │     │
│     │ 1. "이어서 진행" - MENU 그룹 중 미완료 TC만 실행             │     │
│     │ 2. "MENU 그룹만 초기화" - MENU 그룹 결과만 리셋 후 전체 실행 │     │
│     │ 3. "전체 초기화" - 모든 그룹 리셋 후 MENU만 실행             │     │
│     └─────────────────────────────────────────────────────────────┘     │
│                                                                         │
│  4. 선택에 따른 처리:                                                    │
│                                                                         │
│     "이어서 진행":                                                       │
│       - /api/summary에서 MENU 그룹 TC 상태 확인                          │
│       - TC-MENU-E2E-* 중 status가 없는(미완료) TC만 실행                 │
│       - 기존 passed/failed 결과 유지                                     │
│                                                                         │
│     "MENU 그룹만 초기화":                                                │
│       - TC-MENU-E2E-* 결과만 초기화 (다른 그룹 유지)                     │
│       - curl -X POST http://localhost:3847/api/reset-group              │
│         -d '{"group": "MENU"}'                                          │
│       - TC-MENU-E2E-* 전체 실행                                         │
│                                                                         │
│     "전체 초기화":                                                       │
│       - curl -X POST http://localhost:3847/api/reset                    │
│       - TC-MENU-E2E-* 전체 실행                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**예시: MENU 그룹 이어서 테스트**

```
이전 상태:
  TC-MENU-E2E-001: passed  → 스킵
  TC-MENU-E2E-002: passed  → 스킵
  TC-MENU-E2E-003: failed  → 스킵 (재실행 원하면 /e2e-test TC-MENU-E2E-003)
  TC-MENU-E2E-004: -       → 실행 ⭐
  TC-MENU-E2E-005: -       → 실행 ⭐

/e2e-test @MENU "이어서 진행" 선택 시:
  → TC-MENU-E2E-004, TC-MENU-E2E-005만 실행
  → 기존 001~003 결과는 그대로 유지
```

**실패한 TC 재실행:**

```bash
# 특정 TC만 재실행 (결과 덮어쓰기)
/e2e-test TC-MENU-E2E-003

# MENU 그룹 중 실패한 TC만 재실행
/e2e-test --failed @MENU

# 모든 그룹의 실패 TC 재실행
/e2e-test --failed



# 미진행 + 보류 + 실패 전체 재테스트
/e2e-test --retry

# 보류(완성도 낮음) TC만 재실행
/e2e-test --incomplete
```

## 실행 규칙

### 금지 사항
- Task로 step4-e2e-tester 호출하지 마라 (메인에서 직접 실행!)
- 사용자에게 질문하지 마라 (자동 진행)
- 대시보드 시나리오 로드 없이 테스트 시작하지 마라
- TC 순서 건너뛰지 마라 (TC-001 완료 후 TC-002)
- 스텝 순서 건너뛰지 마라 (스텝1 완료 후 스텝2)
- 중간에 리포트 작성하지 마라 (모든 TC 완료 후 1회만)
- **Playwright 액션만 호출하고 $SYNC 안하는 것 금지!** ❌

### ⛔ 임의 스킵 금지 (CRITICAL!)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🚨 에이전트가 임의로 TC를 스킵하는 것을 절대 금지!                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ❌ 절대 금지:                                                          │
│  - pending TC 사유를 보고 "실행 불가"라고 임의 판단하여 스킵              │
│  - 브라우저를 띄우지 않고 TC 결과 결정                                   │
│  - 사용자 확인 없이 TC 건너뛰기                                         │
│  - "특수 조건 필요"라는 이유로 시도도 안 하고 스킵                        │
│                                                                         │
│  ✅ --retry/--incomplete 실행 시 필수 절차:                              │
│  1. 무조건 0-0단계(브라우저 정리)부터 시작                               │
│  2. pending 사유 확인 → 시나리오 업데이트 시도                           │
│  3. 업데이트 불가 시 → AskUserQuestion으로 사용자에게 질문               │
│  4. 사용자 승인 없이 절대 스킵 금지                                      │
│                                                                         │
│  ✅ 스킵 허용 조건 (이 경우에만!):                                       │
│  - 사용자가 명시적으로 "스킵해" 또는 "건너뛰어"라고 요청                  │
│  - AskUserQuestion 결과로 "스킵" 선택받음                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 필수 사항
- 메인 에이전트가 직접 Playwright MCP 도구 사용
- **⚠️ 모든 Playwright 액션 후 즉시 $SYNC step 호출!** (가장 중요!)
- 대시보드 API로 실시간 진행 상황 전송
- 인자 없으면 전체 TC 순서대로 실행
- 특정 TC 지정 시 해당 TC만 실행
- **모든 스텝 완료 처리 필수** (아래 상세 규칙 참조)

### SYNC 필수 패턴 (CRITICAL!)

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ 모든 Playwright 액션 후 반드시 $SYNC step 호출!              │
├─────────────────────────────────────────────────────────────────┤
│  올바른 패턴 ✅:                                                 │
│    mcp__playwright__browser_click(...)                          │
│    $SYNC step "TC-XXX" 0 "passed"  ← 즉시 호출!                 │
│                                                                 │
│  잘못된 패턴 ❌:                                                 │
│    mcp__playwright__browser_click(...)                          │
│    mcp__playwright__browser_type(...)  ← SYNC 없이 다음 액션    │
│    $SYNC step "TC-XXX" 0 "passed"      ← 나중에 한번에 호출     │
└─────────────────────────────────────────────────────────────────┘
```

### 🚨 스텝 완료 규칙 (MANDATORY - 반드시 준수!)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠️ TC 완료 전 모든 스텝을 100% 수행해야 함!                                   │
│                                                                             │
│  ❌ 금지: 스텝 일부만 수행하고 passed 처리                                     │
│  ✅ 필수: 정의된 모든 스텝을 순서대로 수행                                     │
│                                                                             │
│  서버가 스텝 완료율을 검증합니다:                                             │
│  - 50% 미만 완료 시 → 자동으로 pending 처리됨                                │
│  - 100% 완료 시에만 → passed 인정                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**TC 실행 필수 절차 (4단계):**

#### 1️⃣ TC 시작 전: 스텝 목록 확인 (MANDATORY!)

**반드시 해당 TC의 전체 스텝을 먼저 확인하고 시작해야 함!**

```bash
# API로 해당 TC의 스텝 수와 내용 확인
TC_ID="TC-XXX-E2E-001"
curl -s http://localhost:3847/api/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
tc = next((s for s in d['scenarios'] if s['tcId']=='${TC_ID}'), None)
if tc:
    print(f'📋 {tc[\"tcId\"]}: {tc[\"name\"]}')
    print(f'📌 스텝 수: {len(tc[\"steps\"])}개')
    print('─' * 50)
    for i, step in enumerate(tc['steps']):
        print(f'  [{i}] {step}')
"
```

**확인해야 할 것:**
- 총 스텝 수 (예: 6개)
- 각 스텝의 내용 (어떤 액션을 해야 하는지)

#### 2️⃣ TC 시작
```bash
$SYNC start "$TC_ID" "테스트명"
```

#### 3️⃣ 각 스텝 순서대로 실행 (모든 스텝 필수!)

**스텝 N개면 반드시 N개 모두 실행해야 함!**

```bash
# 예: 6개 스텝인 경우 → 반드시 6개 모두 실행

# 스텝 0
mcp__playwright__browser_navigate(url)
$SYNC step "$TC_ID" 0 "passed"

# 스텝 1
mcp__playwright__browser_snapshot()
$SYNC step "$TC_ID" 1 "passed"

# 스텝 2
mcp__playwright__browser_click(element, ref)
$SYNC step "$TC_ID" 2 "passed"

# 스텝 3 ← 스킵하면 안됨!
mcp__playwright__browser_XXX(...)
$SYNC step "$TC_ID" 3 "passed"

# 스텝 4 ← 스킵하면 안됨!
mcp__playwright__browser_XXX(...)
$SYNC step "$TC_ID" 4 "passed"

# 스텝 5 ← 마지막 스텝도 반드시 실행!
mcp__playwright__browser_XXX(...)
$SYNC step "$TC_ID" 5 "passed"
```

#### 4️⃣ TC 완료 (모든 스텝 완료 후에만!)
```bash
$SYNC complete "$TC_ID" "passed"
```

---

**❌ 잘못된 예시 (서버가 자동으로 pending 처리함):**

```
TC: 6개 스텝 정의됨
실행: 스텝 0, 1만 수행 후 "passed" 시도
결과: → 서버가 자동으로 "pending" 처리 (33% 완료)
로그: [STEP-INCOMPLETE] TC-UI-E2E-004: passed → pending (33% 완료)
```

**✅ 올바른 예시:**

```
TC: 6개 스텝 정의됨
실행: 스텝 0, 1, 2, 3, 4, 5 모두 수행
결과: → "passed" 인정 (100% 완료)
```

---

**시나리오 스텝과 브라우저 액션 매핑:**

시나리오에 정의된 각 스텝을 브라우저 액션으로 변환:

| 시나리오 스텝 | 브라우저 액션 |
|-------------|-------------|
| 페이지 이동 | `browser_navigate(url)` |
| 테이블 로드 대기 | `browser_wait_for(time)` 또는 `browser_snapshot()` |
| 버튼 클릭 | `browser_click(element, ref)` |
| 텍스트 입력 | `browser_type(element, ref, text)` |
| 드롭다운 선택 | `browser_select_option(element, ref, values)` |
| 체크박스 토글 | `browser_click(element, ref)` |
| 상태 검증 | `browser_snapshot()` 후 결과 확인 |

**스텝 내용을 정확히 해석하여 실행해야 함!**

예시 - TC-UI-E2E-004 (체크박스 토글):
```
스텝 0: "/backofficeClient/1" → browser_navigate(url)
스텝 1: "체크박스 초기 상태" → browser_snapshot() + 상태 확인
스텝 2: "umaActivityYn 체크박스" → 해당 체크박스 찾기
스텝 3: "체크박스 상태 변경" → browser_click(체크박스) + 상태 변경 확인
스텝 4: "umaActivityYn 체크박스" → 다시 체크박스 클릭
스텝 5: "원래 상태로 복구" → 원래 상태로 돌아왔는지 확인
```

## 실행 순서

### 0단계: 환경 준비 (필수!)

**0-0. 기존 Playwright 브라우저 프로세스 정리 (MANDATORY!):**

⚠️ **테스트 시작 전 Playwright MCP가 사용하는 브라우저만 종료!**

**중요:** 사용자의 일반 Chrome 브라우저는 종료하지 않음! Playwright MCP 전용 브라우저만 정리합니다.

```bash
# Playwright MCP 브라우저만 종료 (일반 Chrome은 유지!)
pkill -9 -f "ms-playwright" 2>/dev/null || true
pkill -9 -f "mcp-chrome" 2>/dev/null || true

# Playwright lock 파일 제거
rm -rf /Users/admin/Library/Caches/ms-playwright/mcp-chrome-*/SingletonLock 2>/dev/null || true
rm -rf /Users/admin/Library/Caches/ms-playwright/mcp-chrome-*/SingletonSocket 2>/dev/null || true

sleep 2
echo "Playwright browser cleanup complete"
```

**❌ 금지 (일반 Chrome도 종료됨):**
```bash
pkill -9 -f "Chrome"  # 모든 Chrome 종료 - 사용하지 마라!
```

**이 단계를 건너뛰면:**
- "Browser is already in use" 오류 발생
- Playwright 명령 실행 실패
- 테스트 중단

---

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
- `VIDEO_DIR` ← `{PROJECT_PATH}/docs/qa/latest/videos/`

**0-2-1. 실패 영상 녹화 설정 (CRITICAL!):**

⚠️ **테스트 실패 시 자동으로 영상을 저장하여 디버깅에 활용!**

```javascript
// 브라우저 컨텍스트 생성 시 영상 녹화 활성화
const VIDEO_DIR = `${PROJECT_PATH}/docs/qa/latest/videos/`;

// 디렉토리 생성
mcp__playwright__browser_run_code({
  code: `async (page) => {
    const fs = require('fs');
    if (!fs.existsSync('${VIDEO_DIR}')) {
      fs.mkdirSync('${VIDEO_DIR}', { recursive: true });
    }
    return 'Video directory ready';
  }`
})
```

**영상 녹화 동작:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  실패 영상 녹화 흐름                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. TC 시작 시 → 영상 녹화 시작                                          │
│     mcp__playwright__browser_run_code로 녹화 컨텍스트 생성               │
│                                                                         │
│  2. TC 실행 중 → 모든 액션이 녹화됨                                       │
│                                                                         │
│  3. TC 완료 시 결과에 따라:                                               │
│     ┌─────────────────┬─────────────────────────────────────┐           │
│     │ passed          │ → 영상 파일 삭제 (저장 공간 절약)     │           │
│     │ failed          │ → 영상 파일 보존 + 대시보드 링크 전송 │           │
│     │ skip            │ → 영상 파일 삭제                      │           │
│     └─────────────────┴─────────────────────────────────────┘           │
│                                                                         │
│  저장 경로: docs/qa/latest/videos/TC-XXX-E2E-001_failed.webm            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**TC별 영상 녹화 코드:**

```javascript
// TC 시작 시 - 영상 녹화 시작
const videoPath = `${VIDEO_DIR}${TC_ID}_recording.webm`;

mcp__playwright__browser_run_code({
  code: `async (page) => {
    // 현재 컨텍스트에서 영상 경로 저장
    page._tcVideoPath = '${videoPath}';
    page._tcId = '${TC_ID}';
    return 'Recording started for ${TC_ID}';
  }`
})

// TC 완료 시 - 결과에 따라 영상 처리
mcp__playwright__browser_run_code({
  code: `async (page) => {
    const fs = require('fs');
    const path = require('path');
    const video = page.video();

    if (video) {
      const tempPath = await video.path();
      const tcId = page._tcId || 'unknown';
      const status = '${STATUS}';  // passed, failed, skip

      if (status === 'failed') {
        // 실패 시 영상 보존
        const finalPath = '${VIDEO_DIR}' + tcId + '_failed.webm';
        fs.renameSync(tempPath, finalPath);
        return JSON.stringify({ saved: true, path: finalPath });
      } else {
        // 성공/스킵 시 영상 삭제
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        return JSON.stringify({ saved: false, deleted: true });
      }
    }
    return JSON.stringify({ saved: false, noVideo: true });
  }`
})
```

**대시보드에 실패 영상 링크 전송:**

```bash
# TC 실패 시 영상 경로를 대시보드에 전송
$SYNC complete "$TC_ID" "failed" "에러 메시지" "$VIDEO_PATH"
```

**0-3. 대시보드 확인 및 시작 (MANDATORY!):**

⚠️ **대시보드가 이미 실행 중이면 재시작하지 않음! (사용자 선택 이력 유지)**

```bash
# 1. 대시보드 실행 여부 확인
DASHBOARD_RUNNING=$(curl -s http://localhost:3847/api/state 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('scenarios',[])))" 2>/dev/null || echo "0")

if [ "$DASHBOARD_RUNNING" -gt 0 ]; then
  # ✅ 대시보드가 이미 실행 중 → 현재 상태 유지 (사용자 선택 이력 보존)
  echo "✅ 대시보드 이미 실행 중 - 현재 이력 유지"
  curl -s http://localhost:3847/api/summary | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'  현재 상태: {d[\"passed\"]}P/{d[\"failed\"]}F/{d[\"total\"]}T')"
else
  # ❌ 대시보드 미실행 → 새로 시작
  echo "🚀 대시보드 시작 중..."

  # 기존 프로세스 정리 (혹시 좀비 프로세스가 있을 경우)
  lsof -ti:3847 | xargs kill -9 2>/dev/null || true

  # 대시보드 시작 (SCENARIO_PATH 환경변수 필수!)
  cd /Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard && \
  SCENARIO_PATH="{SCENARIO_PATH}" npm start > /tmp/e2e-dashboard.log 2>&1 &

  # 대시보드 준비 대기 (3초)
  sleep 3
fi

# 시나리오 로드 확인
curl -s http://localhost:3847/api/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'✅ 시나리오 {len(d[\"scenarios\"])}개 로드됨')
print(f'   그룹: {sorted(set(s[\"group\"] for s in d[\"scenarios\"]))}')"
```

**⚠️ 핵심: 대시보드 재시작 조건**
- ✅ 대시보드 실행 중 → **재시작 안 함** (사용자가 선택한 이력 유지!)
- ❌ 대시보드 미실행 → 새로 시작 (최신 이력 자동 복원)

**사용자 워크플로우:**
1. 대시보드에서 과거 이력 선택 (`http://localhost:3847/?restored=xxx`)
2. `/e2e-test --failed` 실행
3. 대시보드가 재시작되지 않고 **선택한 이력 기준**으로 실패 TC 재실행

**--history 옵션 (대시보드 미실행 시 특정 이력 지정):**
```bash
# 대시보드가 실행 중이 아닐 때 특정 이력으로 시작
cd /Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard && \
SCENARIO_PATH="{SCENARIO_PATH}" HISTORY_FILE="{HISTORY_FILENAME}" npm start > /tmp/e2e-dashboard.log 2>&1 &
```

대시보드가 자동으로:
1. 시나리오 파일 파싱 및 로드
2. 최신 이력 자동 복원 (또는 `HISTORY_FILE` 지정 시 해당 이력)
3. 브라우저 창 오픈

**대시보드가 실행되지 않으면:**
- 테스트 진행 상황이 실시간으로 표시되지 않음
- 그룹별 결과 차트 클릭으로 상세 정보 확인 불가
- 테스트 완료 후 결과 확인이 어려움

**0-3-1. 이전 테스트 이력 확인 및 자동 복원 (MANDATORY!):**

⚠️ **대시보드 시작 시 서버가 자동으로 이전 이력을 복원합니다!**

```bash
# 현재 상태 확인 (서버가 history/에서 자동 복원)
SUMMARY=$(curl -s http://localhost:3847/api/summary)
PASSED=$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('passed', 0))")
FAILED=$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failed', 0))")
TOTAL=$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total', 0))")
COMPLETED=$((PASSED + FAILED))
```

**이력 복원 동작:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  대시보드 시작 시 자동 이력 복원                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. 서버가 history/ 폴더에서 최근 이력 자동 로드                          │
│  2. 동일한 시나리오 파일(TC ID 매칭)이면 결과 복원                         │
│  3. 이미 passed/failed인 TC는 해당 상태 유지                              │
│                                                                         │
│  ⚠️ 별도 API 호출 불필요! 서버가 자동으로 처리함                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**3. 전체 테스트 vs 그룹 테스트 분기 (CRITICAL!):**

```yaml
전체_테스트: "/e2e-test" (인자 없음)
  - 이전 이력 있으면 → 사용자에게 선택 질문
  - 옵션: "이어서 진행" / "처음부터 새로 시작"

그룹_테스트: "/e2e-test @MENU" (그룹 지정)
  - 이전 이력 자동 유지 (질문 없이!)
  - 해당 그룹의 미완료 TC만 실행
  - 다른 그룹 결과는 그대로 보존

특정_TC: "/e2e-test TC-XXX-001"
  - 이전 이력 자동 유지
  - 해당 TC만 실행 (결과 덮어쓰기)
```

**그룹 테스트 시 질문 필요 여부:**

| 명령 | 이력 질문 | 동작 |
|------|---------|------|
| `/e2e-test` | ✅ 질문 | 전체 실행, 이어서/새로 선택 |
| `/e2e-test --auto` | ❌ 질문 없음 | 미완료 TC 자동 이어서 |
| `/e2e-test @MENU` | ❌ 질문 없음 | MENU 그룹 미완료만 자동 실행 |
| `/e2e-test TC-001` | ❌ 질문 없음 | 해당 TC만 실행 |

**전체 테스트일 때만 사용자에게 선택 질문 (AskUserQuestion 사용):**

이전 결과가 복원되었고 `/e2e-test` (인자 없음) 실행 시:
```
"이전 테스트 이력이 있습니다.
- 완료: {COMPLETED}개 (PASS: {PASSED}, FAIL: {FAILED})
- 미완료: {PENDING}개

어떻게 진행할까요?"

옵션:
1. "이어서 진행" - 미완료 TC부터 실행 (기존 결과 유지)
2. "처음부터 새로 시작" - 모든 결과 초기화 후 TC-001부터 실행
```

**선택에 따른 처리:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  사용자 선택에 따른 처리                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  "이어서 진행" 선택:                                                     │
│    - 현재 상태 그대로 유지                                               │
│    - 미완료 TC만 순서대로 실행                                           │
│    - TC 완료 시마다 자동 저장 (서버에서 history/ 폴더에 저장)            │
│                                                                         │
│  "처음부터 새로 시작" 선택:                                              │
│    - curl -X POST http://localhost:3847/api/reset 호출                  │
│    - 새 이력으로 시작 (기존 이력은 history/에 보존됨)                    │
│    - TC-001부터 순서대로 실행                                            │
│    - TC 완료 시마다 자동 저장                                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**자동 저장 (서버 측에서 처리):**
- TC 완료(`/api/tc/complete`) 호출 시 서버가 자동으로 `history/` 폴더에 JSON 저장
- 브라우저 재시작, 서버 재시작해도 이력 유지
- 다음 테스트 시작 시 자동으로 최근 이력 복원

**이어서 테스트 실행 규칙:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  이어서 테스트 시 TC 실행 판단                                           │
├─────────────────────────────────────────────────────────────────────────┤
│  1. /api/summary 호출하여 현재 상태 확인                                 │
│  2. results[tcId].status 확인:                                          │
│     - "passed" → 스킵 (이미 완료)                                       │
│     - "failed" → 스킵 (이미 완료, 실패로 기록됨)                         │
│     - undefined → 실행 (미완료)                                         │
│     - "running" → 실행 (이전에 중단됨)                                   │
│  3. 미완료 TC만 순서대로 실행                                            │
└─────────────────────────────────────────────────────────────────────────┘
```

**예시:**

전체 5개 TC 중 2개 완료(passed), 1개 실패(failed), 2개 미완료:
```
TC-001: passed  → 스킵
TC-002: passed  → 스킵
TC-003: failed  → 스킵 (재실행 원하면 /e2e-test TC-003 으로 명시)
TC-004: -       → 실행 ⭐
TC-005: -       → 실행 ⭐
```

**0-3-2. SYNC 변수 설정 (로그인 전 필수!):**

⚠️ **로그인/브라우저 액션 전에 반드시 SYNC 변수를 설정해야 함!**

```bash
# SYNC 변수 설정 (테스트 시작 전 1회)
SYNC="/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh"

# 대시보드 연결 확인
curl -s http://localhost:3847/api/state > /dev/null && echo "Dashboard connected" || echo "Dashboard not running!"
```

**이 단계를 건너뛰면:**
- 테스트 진행 상황이 대시보드에 반영되지 않음
- 로그인 과정도 추적 불가

---

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

### 2단계: 브라우저 테스트 실행 (자동 SYNC 통합!)

## 🚨 CRITICAL: TC 실행 흐름 (반드시 이 순서로!)

**⚠️ TC 실행 시 반드시 직접 경로 사용! ($SYNC 변수 금지)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔴 TC 실행 템플릿 (MANDATORY - 이 순서 반드시 준수!)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  0️⃣ TC 시작 전 - 스텝 목록 확인 (CRITICAL!)                                 │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │ curl -s http://localhost:3847/api/state | python3 -c "          │     │
│     │   import sys,json                                               │     │
│     │   d=json.load(sys.stdin)                                        │     │
│     │   tc=[s for s in d['scenarios'] if s['tcId']=='TC-XXX'][0]      │     │
│     │   for i,step in enumerate(tc['steps']): print(f'{i}: {step}')"  │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│     → 스텝 개수와 내용 확인 후 1:1 매칭 계획 수립                             │
│                                                                             │
│  1️⃣ TC 시작 - sync start 호출 (직접 경로!)                                  │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │ /Users/.../sync.sh start "TC-XXX" "테스트명"                     │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  2️⃣ 각 스텝 실행 - Playwright 후 즉시 sync step (인덱스 순차!)              │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │ mcp__playwright__browser_XXX(...)                                │     │
│     │ /Users/.../sync.sh step "TC-XXX" 0 pass "스텝0 설명"            │     │
│     │ ...                                                              │     │
│     │ /Users/.../sync.sh step "TC-XXX" N pass "스텝N 설명"            │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│     → 스텝 0부터 N까지 순차적으로 호출 (건너뛰기 금지!)                       │
│                                                                             │
│  3️⃣ TC 완료 - sync complete 호출 (모든 스텝 완료 후!)                       │
│     ┌─────────────────────────────────────────────────────────────────┐     │
│     │ /Users/.../sync.sh complete "TC-XXX" "pass|fail|skip"           │     │
│     └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ❌ $SYNC 변수 사용 금지! (권한 프롬프트 발생)

```bash
# ❌ 금지! 매번 권한 질의 발생
SYNC="/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh"
$SYNC start ...
$SYNC step ...

# ✅ 필수! 직접 경로 사용 (권한 질의 없음)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh start ...
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step ...
```

### TC 실행 예시 (직접 경로 사용!)

```bash
# ========================================
# TC-MENU-E2E-001: 메뉴 목록 조회 (5 스텝)
# ========================================

# 0️⃣ 스텝 목록 확인 (TC 시작 전 필수!)
curl -s http://localhost:3847/api/state | python3 -c "
import sys,json
d=json.load(sys.stdin)
tc=[s for s in d['scenarios'] if s['tcId']=='TC-MENU-E2E-001'][0]
print(f\"TC: {tc['tcId']} - {tc['name']}\")
print(f\"스텝 수: {len(tc['steps'])}\")
for i,step in enumerate(tc['steps']): print(f'  {i}: {step}')"

# 출력 예시:
# TC: TC-MENU-E2E-001 - 메뉴 목록 조회
# 스텝 수: 5
#   0: /adminMenu
#   1: 클라이언트 드롭다운
#   2: 클라이언트 선택
#   3: 메뉴 트리 로드
#   4: 메뉴 아이템 표시

# 1️⃣ TC 시작
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh start "TC-MENU-E2E-001" "메뉴 목록 조회"

# 2️⃣ 스텝 0: /adminMenu
mcp__playwright__browser_navigate("/adminMenu")
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-MENU-E2E-001" 0 pass "/adminMenu 페이지 이동"

# 2️⃣ 스텝 1: 클라이언트 드롭다운
mcp__playwright__browser_snapshot()
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-MENU-E2E-001" 1 pass "클라이언트 드롭다운 확인"

# 2️⃣ 스텝 2: 클라이언트 선택
mcp__playwright__browser_select_option(...)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-MENU-E2E-001" 2 pass "테크표준화 백오피스 선택"

# 2️⃣ 스텝 3: 메뉴 트리 로드
mcp__playwright__browser_wait_for({time: 2})
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-MENU-E2E-001" 3 pass "메뉴 트리 로드 완료"

# 2️⃣ 스텝 4: 메뉴 아이템 표시
mcp__playwright__browser_snapshot()
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-MENU-E2E-001" 4 pass "메뉴 아이템 표시 확인"

# 3️⃣ TC 완료 (5개 스텝 모두 완료 후!)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh complete "TC-MENU-E2E-001" pass "메뉴 목록 조회 성공"
```

### ❌ 금지 패턴 vs ✅ 필수 패턴

```
❌ 잘못된 패턴 1 (대시보드 동기화 안됨):
   mcp__playwright__browser_navigate(...)
   mcp__playwright__browser_click(...)
   mcp__playwright__browser_type(...)
   # sync 호출 없음 → 대시보드에 아무것도 안 나옴!

❌ 잘못된 패턴 2 ($SYNC 변수 사용 - 권한 프롬프트 발생):
   SYNC="..."
   $SYNC start ...   # 매번 권한 질의!
   $SYNC step ...    # 매번 권한 질의!

❌ 잘못된 패턴 3 (스텝 누락/불일치):
   시나리오: 9개 스텝
   sync step: 0, 1, 2, 4, 5, 6, 7, 8 호출  # 스텝 3 누락!
   또는: sync step 메시지가 시나리오 스텝명과 불일치

✅ 올바른 패턴 (직접 경로 + 스텝 1:1 매칭):
   /Users/.../sync.sh start "TC-001" "테스트명"    ← 직접 경로!
   mcp__playwright__browser_navigate(...)
   /Users/.../sync.sh step "TC-001" 0 pass "..."  ← 스텝 0
   mcp__playwright__browser_click(...)
   /Users/.../sync.sh step "TC-001" 1 pass "..."  ← 스텝 1
   mcp__playwright__browser_type(...)
   /Users/.../sync.sh step "TC-001" 2 pass "..."  ← 스텝 2
   /Users/.../sync.sh complete "TC-001" pass "..."
```

### 실패 처리

```bash
# 스텝 실패 시 (직접 경로 사용!)
mcp__playwright__browser_click(...)  # 실패!
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh step "TC-001" 2 fail "요소 찾기 실패"

# TC 실패로 완료
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh complete "TC-001" fail "스텝 2에서 실패"
```

### 스킵 처리

```bash
# 사전조건 미충족으로 스킵 (직접 경로 사용!)
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh start "TC-001" "테스트명"
/Users/admin/Desktop/workSpace/shared-claude-agents/scripts/e2e-dashboard/sync.sh complete "TC-001" skip "사전조건 미충족"
```

### 3단계: 결과 리포트

모든 TC 완료 후 `mcp__qa-pipeline__e2e_create_report` 호출

### 4단계: Jira 티켓 생성 (실패 TC가 있는 경우)

**⚠️ 모든 TC 완료 후 실패 건이 있으면 Jira 티켓을 생성합니다.**

#### 4-1. 실패 TC 확인

```bash
# 대시보드 API로 요약 조회
SUMMARY=$(curl -s http://localhost:3847/api/summary)

# 실패 TC 수 확인
FAILED_COUNT=$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('failed', 0))")

# 실패 TC가 있으면 Jira 티켓 생성 진행
if [ "$FAILED_COUNT" -gt 0 ]; then
    echo "실패한 TC: $FAILED_COUNT 건"
fi
```

#### 4-2. Jira 설정 질문 (1회만)

실패 TC가 있으면 AskUserQuestion으로 Jira 설정 질문:

```
"실패한 TC {N}건에 대해 Jira 티켓을 생성합니다.

1. 상위 이슈 키를 입력해주세요 (예: SYSTAN-155):
   - 하위 작업(Sub-task)으로 생성됩니다
   - 프로젝트 키는 자동 추출됩니다 (SYSTAN-155 → SYSTAN)

2. 또는 프로젝트 키만 입력 (예: QA):
   - 독립 Bug 이슈로 생성됩니다"

옵션:
- 상위 이슈 키 입력 (예: SYSTAN-155) → Sub-task로 생성
- 프로젝트 키만 입력 (예: QA) → Bug로 생성
- 티켓 생성 건너뛰기
```

**입력값 판단:**
- `SYSTAN-155` 형식 (프로젝트-번호) → 하위 작업으로 생성
- `SYSTAN` 형식 (프로젝트만) → 독립 Bug로 생성

#### 4-3. 티켓 생성 (Atlassian MCP 사용)

각 실패 TC에 대해 `mcp__atlassian__createJiraIssue` 호출:

**A. 하위 작업으로 생성 (상위 이슈 지정 시):**

```javascript
// 입력: "SYSTAN-155" → 하위 작업으로 생성
mcp__atlassian__createJiraIssue({
  projectKey: "SYSTAN",                // 자동 추출 (SYSTAN-155 → SYSTAN)
  parent: "SYSTAN-155",                // 상위 이슈 키 ⭐
  summary: "[E2E] TC-AUTH-E2E-001: Keycloak 로그인 성공 - 실패",
  description: `## 테스트 정보
- TC ID: TC-AUTH-E2E-001
- TC 이름: Keycloak 로그인 성공
- 그룹: 인증 시나리오
- 실행 시간: ${new Date().toISOString()}

## 실패 원인
로그인 버튼 클릭 실패 - ref 매칭 실패

## 실패한 스텝
| # | 스텝 | 상태 | 메시지 |
|---|------|------|--------|
| 3 | 로그인 버튼 클릭 | FAILED | ref_15 요소를 찾을 수 없음 |

## 개선 방안
- 셀렉터 설명을 더 구체적으로 수정
- browser_snapshot()으로 실제 요소 확인

## 관련 정보
- 대시보드: http://localhost:3847
- 시나리오: docs/qa/latest/scenarios/e2e-scenarios.md`,
  issueType: "Sub-task",               // 하위 작업 ⭐
  labels: ["e2e-test", "automated"]
})
```

**B. 독립 Bug로 생성 (프로젝트 키만 입력 시):**

```javascript
// 입력: "QA" → 독립 Bug 이슈로 생성
mcp__atlassian__createJiraIssue({
  projectKey: "QA",
  summary: "[E2E] TC-AUTH-E2E-001: Keycloak 로그인 성공 - 실패",
  description: "...",
  issueType: "Bug",
  labels: ["e2e-test", "automated"]
})
```

#### 4-4. 티켓 생성 결과 보고

```
✅ Jira 티켓 생성 완료:
- QA-123: [E2E] TC-AUTH-E2E-001: Keycloak 로그인 성공 - 실패
- QA-124: [E2E] TC-CLIENT-E2E-003: 클라이언트 등록 - 실패
- QA-125: [E2E] TC-MENU-E2E-002: 메뉴 삭제 - 실패
```

#### 4-5. 보류(Pending) TC 티켓 생성 (1개 티켓에 리스트업)

**⚠️ 보류된 TC가 있으면 1개의 통합 티켓에 모든 보류 TC를 리스트업합니다.**

```bash
# 보류 TC 확인
PENDING_COUNT=$(echo "$SUMMARY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('pending_hold', 0))")

# 보류 TC가 있으면 티켓 생성
if [ "$PENDING_COUNT" -gt 0 ]; then
    echo "보류된 TC: $PENDING_COUNT 건"
fi
```

**보류 TC 티켓 생성 (Atlassian MCP 사용):**

```javascript
// 보류된 TC 목록 조회
const pendingTCs = summary.pendingTCs; // [{tcId, name, message}, ...]

// 보류 TC가 있으면 1개 티켓에 전체 리스트업
if (pendingTCs.length > 0) {
  // 테이블 형식으로 보류 TC 목록 생성
  const pendingTable = pendingTCs.map(tc =>
    `| ${tc.tcId} | ${tc.name} | ${tc.message || '추가 테스트 데이터/환경 필요'} |`
  ).join('\n');

  mcp__atlassian__createJiraIssue({
    projectKey: "SYSTAN",                // 사용자 입력 또는 자동 추출
    parent: "SYSTAN-155",                // 상위 이슈 (실패 TC와 동일)
    summary: `[E2E] 보류된 테스트 케이스 목록 (${pendingTCs.length}건)`,
    description: `## 보류된 TC 목록 (${pendingTCs.length}건)

보류된 테스트 케이스입니다. 추가 테스트 데이터나 환경 준비가 필요합니다.

| TC ID | TC 이름 | 보류 사유 |
|-------|--------|----------|
${pendingTable}

## 조치 사항
- 위 보류 사유를 확인하고 필요한 테스트 데이터/환경 준비
- 준비 완료 후 \`/e2e-test --incomplete\` 명령으로 재테스트

## 관련 정보
- 대시보드: http://localhost:3847
- 시나리오: docs/qa/latest/scenarios/e2e-scenarios.md
- 보류 TC 조회: \`sync.sh pending\``,
    issueType: "Sub-task",               // 하위 작업
    labels: ["e2e-test", "pending", "automated"]
  })
}
```

**티켓 생성 예시:**

```
✅ 보류 TC 티켓 생성 완료:
- SYSTAN-200: [E2E] 보류된 테스트 케이스 목록 (29건)
  - TC-CORE-E2E-004: 다중 리소스 매핑된 메뉴 + 부분 권한 계정 필요
  - TC-CORE-E2E-006: personalInfoHandleYn=true인 리소스 테스트 데이터 필요
  - TC-AUTH-E2E-002: 쿠키/세션 삭제 후 incognito 세션 테스트 필요
  - ... (총 29건)
```

**실패 TC + 보류 TC 티켓 생성 요약:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Jira 티켓 자동 생성 요약                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  실패 TC (각각 개별 티켓):                                               │
│    - 5개 실패 → 5개 Bug/Sub-task 티켓 생성                              │
│    - 각 티켓에 실패 원인, 스텝 정보, 개선 방안 포함                       │
│                                                                         │
│  보류 TC (1개 통합 티켓):                                                │
│    - 29개 보류 → 1개 Sub-task 티켓에 전체 리스트업                       │
│    - 테이블 형식으로 TC ID, 이름, 보류 사유 정리                          │
│                                                                         │
│  총 생성 티켓: 실패 N개 + 보류 1개 = N+1개                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 사전 조건

- Atlassian MCP 설정 완료 (`claude mcp add -s user --transport sse atlassian https://mcp.atlassian.com/v1/sse`)
- OAuth 인증 완료 (Claude Code 재시작 후 `/mcp` → atlassian 선택)

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

이어서 테스트 (이전 결과 복원됨):
  → /api/check-trigger 또는 /api/summary 조회
  → results[tcId].status가 "passed" 또는 "failed"인 TC는 스킵
  → 미완료 TC만 순서대로 실행
  → TC-001(passed) → 스킵, TC-002(failed) → 스킵, TC-003(-) → 실행
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
