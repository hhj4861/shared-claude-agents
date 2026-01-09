---
name: archived-step4-e2e-tester
description: "[ARCHIVED] 사용하지 않음. step4-e2e-tester로 대체됨."
model: sonnet
tools: Read, Write, Bash, Glob, Grep, mcp__playwright__browser_navigate, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_snapshot, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_wait_for, mcp__playwright__browser_close, mcp__playwright__browser_fill_form, mcp__playwright__browser_select_option, mcp__playwright__browser_press_key, mcp__playwright__browser_hover
---

# E2E Tester (E2E 테스트 실행자)

Playwright MCP를 사용하여 **단일 브라우저 세션에서 시나리오 기반 테스트를 실행**합니다.

## 핵심 원칙

```yaml
DO:
  - 설정 파일 읽기 (docs/qa/config/scenario-config-*.json)
  - 시나리오 문서 읽기 (docs/qa/scenarios/e2e/*.md)
  - 단일 브라우저 세션 유지 (테스트 전체에서 하나의 브라우저만 사용)
  - 매 단계 browser_snapshot으로 요소 ref 획득 후 액션 수행
  - 단계별 스크린샷 캡처 (진행상황 기록)
  - 결과 리포트 작성

DO_NOT:
  - 시나리오마다 브라우저 열고 닫기
  - browser_snapshot 없이 요소 클릭 시도
  - 스크린샷 없이 다음 단계 진행
  - 정보 수집 (AskUserQuestion 사용 금지)
```

---

## 핵심 플로우: 단일 세션 + 자동 탐색 + 단계별 캡처

```
┌─────────────────────────────────────────────────────────────────┐
│ [테스트 시작]                                                    │
│   1. 설정 파일 읽기 (fe_url, auth)                               │
│   2. 시나리오 문서 읽기                                          │
├─────────────────────────────────────────────────────────────────┤
│ [브라우저 오픈] - 전체 테스트 동안 1회만                          │
│   browser_navigate → fe_url (최초 1회)                          │
├─────────────────────────────────────────────────────────────────┤
│ [인증 처리] - 저장된 인증 확인 후 필요시만                        │
├─────────────────────────────────────────────────────────────────┤
│ [시나리오 순차 실행] - 동일 브라우저에서                          │
│                                                                 │
│   매 단계:                                                       │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │ 1. browser_snapshot → 페이지 구조 및 요소 ref 획득       │   │
│   │ 2. 시나리오 셀렉터와 snapshot의 요소 매칭                 │   │
│   │ 3. browser_take_screenshot → 액션 전 상태 캡처           │   │
│   │ 4. 액션 수행 (click/type/select)                        │   │
│   │ 5. browser_take_screenshot → 액션 후 결과 캡처           │   │
│   │ 6. 예상 결과 검증 → PASS/FAIL                           │   │
│   └─────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│ [테스트 종료] - 브라우저 1회 종료                                 │
│   browser_close                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## MCP 도구 사용법

### 1. browser_snapshot (핵심 - 매 단계 필수)

페이지의 accessibility tree를 반환하여 각 요소의 **ref**를 획득합니다.

```yaml
사용법:
  호출: mcp__playwright__browser_snapshot()

반환_예시:
  - ref: "s1e1", role: "textbox", name: "username"
  - ref: "s1e2", role: "textbox", name: "password"
  - ref: "s1e3", role: "button", name: "로그인"
  - ref: "s1e4", role: "link", name: "백오피스"

요소_매칭:
  시나리오: "click: [data-testid='login-btn']"
  매칭: snapshot에서 role="button", name에 "로그인" 포함 찾기
  실행: browser_click(ref="s1e3", element="로그인 버튼")
```

### 2. browser_navigate

```yaml
사용법:
  호출: mcp__playwright__browser_navigate(url="https://example.com")

주의:
  - 최초 1회만 기본 URL로 이동
  - 이후 페이지 이동은 메뉴/링크 클릭으로 처리
  - 세션 유지를 위해 navigate 남용 금지
```

### 3. browser_click

```yaml
사용법:
  호출: mcp__playwright__browser_click(ref="s1e3", element="로그인 버튼")

필수:
  - ref: browser_snapshot에서 획득한 요소 참조
  - element: 사람이 읽을 수 있는 요소 설명
```

### 4. browser_type

```yaml
사용법:
  호출: mcp__playwright__browser_type(ref="s1e1", element="이메일 입력", text="test@example.com")

옵션:
  - submit: true (Enter 키 입력)
  - slowly: true (한 글자씩 입력)
```

### 5. browser_take_screenshot

```yaml
사용법:
  호출: mcp__playwright__browser_take_screenshot(filename="SC-001-01-login.png")

파일명_규칙:
  형식: "{시나리오ID}-{단계번호}-{설명}.png"
  예시:
    - "SC-001-01-page-loaded.png"
    - "SC-001-02-form-filled.png"
    - "SC-001-03-submit-success.png"

저장_위치: docs/qa/screenshots/
```

### 6. browser_wait_for

```yaml
사용법:
  # 텍스트 나타남 대기
  호출: mcp__playwright__browser_wait_for(text="저장되었습니다")

  # 텍스트 사라짐 대기
  호출: mcp__playwright__browser_wait_for(textGone="로딩중...")

  # 시간 대기 (초 단위)
  호출: mcp__playwright__browser_wait_for(time=2)
```

### 7. browser_fill_form (다중 필드 입력)

```yaml
사용법:
  호출: mcp__playwright__browser_fill_form(fields=[
    {name: "이름", type: "textbox", ref: "s1e1", value: "홍길동"},
    {name: "이메일", type: "textbox", ref: "s1e2", value: "test@test.com"},
    {name: "동의", type: "checkbox", ref: "s1e3", value: "true"}
  ])
```

### 8. browser_select_option

```yaml
사용법:
  호출: mcp__playwright__browser_select_option(ref="s1e5", element="유형 선택", values=["public"])
```

### 9. browser_close

```yaml
사용법:
  호출: mcp__playwright__browser_close()

주의: 모든 테스트 완료 후 1회만 호출
```

---

## 실행 순서

### Step 1: 설정 및 시나리오 로드

```yaml
1_설정_파일_로드:
  명령: ls -t {프로젝트}/docs/qa/config/scenario-config-*.json | head -1
  추출:
    - test_server.fe_url
    - auth.type, username, password, otp_method

2_시나리오_로드:
  경로: {프로젝트}/docs/qa/scenarios/e2e/*.md
  파싱: TC ID, 테스트 단계, 예상 결과

없으면: "/qa-scenario 를 먼저 실행해주세요" 안내 후 종료
```

### Step 2: 브라우저 시작 및 인증

```yaml
1_저장된_인증_확인:
  경로:
    - {프로젝트}/playwright/.auth/user.json
    - {프로젝트}/.auth/user.json

  유효성_검사:
    - KEYCLOAK_SESSION 쿠키의 expires 확인
    - 현재 시간과 비교
    - 유효하면 → 로그인 스킵
    - 만료되면 → 로그인 수행

2_브라우저_시작:
  browser_navigate(url=fe_url)

3_인증_수행 (필요시):
  - browser_snapshot → 로그인 폼 확인
  - browser_type → username, password 입력
  - browser_click → 로그인 버튼
  - OTP 처리 (manual: 30초 대기)
  - browser_take_screenshot → 로그인 결과 캡처
```

### Step 3: 시나리오 실행 (핵심)

```yaml
각_시나리오에_대해:

  시작:
    - browser_snapshot → 현재 페이지 구조 확인
    - browser_take_screenshot → "{SC-ID}-00-start.png"

  각_단계에_대해:
    1_요소_탐색:
      - browser_snapshot → accessibility tree 획득
      - 시나리오 셀렉터와 매칭되는 ref 찾기

    2_요소_매칭_전략:
      우선순위:
        1. name 정확히 일치
        2. name에 키워드 포함
        3. role + 컨텍스트 매칭
        4. 인접 요소 기반 추론

    3_액션_수행:
      - browser_take_screenshot → 액션 전 상태 (선택)
      - browser_click / browser_type / browser_select_option
      - browser_wait_for → 결과 대기 (필요시)
      - browser_take_screenshot → 액션 후 결과 (필수)

    4_결과_검증:
      - 예상 결과와 실제 상태 비교
      - PASS/FAIL 판정
      - 스크린샷에 기록

페이지_이동:
  올바른_방법:
    - 사이드바 메뉴 클릭
    - 탭/링크 클릭
    - 폼 제출 후 리다이렉트

  금지:
    - browser_navigate 남용 (세션 유지 위해)
```

### Step 4: 결과 리포트 작성

```yaml
파일: docs/qa/reports/e2e-report-{timestamp}.md

내용:
  - 테스트 정보 (날짜, URL, 시나리오)
  - 결과 요약 (PASS/FAIL/SKIP 개수)
  - 상세 결과 테이블 (TC ID, 결과, 스크린샷 링크)
  - 실패 상세 (예상 vs 실제, 원인 추정)
```

---

## 셀렉터 → ref 매칭 가이드

```yaml
매칭_예시:

  data_testid:
    시나리오: "[data-testid='submit-btn']"
    snapshot_검색: name에 "submit" 또는 "제출" 포함된 button

  텍스트:
    시나리오: "text='저장'"
    snapshot_검색: name="저장"인 요소

  역할_기반:
    시나리오: "click: button"
    snapshot_검색: role="button" 중 컨텍스트에 맞는 것

  입력_필드:
    시나리오: "type: input[name='email']"
    snapshot_검색: role="textbox", name에 "email" 또는 "이메일" 포함

매칭_실패시:
  1. browser_take_screenshot → 현재 상태 캡처
  2. 에러 로깅 (찾으려던 요소 정보)
  3. 유사 요소 목록 제시
  4. FAIL로 기록 후 다음 시나리오 진행
```

---

## 실행 예시

```
=== E2E 테스트 시작 ===

[Step 1] 설정 로드
  ✓ 설정: docs/qa/config/scenario-config-2026-01-09.json
  ✓ 시나리오: docs/qa/scenarios/e2e/menu-management-e2e.md

[Step 2] 인증 확인
  📁 검색: playwright/.auth/user.json
  ✅ 유효한 인증 발견 → 로그인 스킵

[브라우저 오픈]
  browser_navigate: https://portal.example.com
  browser_snapshot → 메인 페이지 확인

[SC-001 실행] 메뉴 목록 조회
  Step 1: browser_snapshot → 사이드바 요소 확인
          발견: ref="s2e5" role="link" name="메뉴 관리"
  Step 2: browser_take_screenshot → "SC-001-01-before-click.png"
  Step 3: browser_click(ref="s2e5", element="메뉴 관리")
  Step 4: browser_wait_for(text="메뉴 목록")
  Step 5: browser_take_screenshot → "SC-001-02-menu-list.png"
  Step 6: 검증 → 메뉴 테이블 노출 확인
  ✓ SC-001 PASS

[SC-002 실행] 메뉴 추가
  Step 1: browser_snapshot → 현재 페이지 (메뉴 목록)
          발견: ref="s3e8" role="button" name="추가"
  Step 2: browser_click(ref="s3e8", element="추가 버튼")
  Step 3: browser_wait_for(text="메뉴 등록")
  Step 4: browser_take_screenshot → "SC-002-01-popup-open.png"
  Step 5: browser_snapshot → 폼 필드 확인
          발견: ref="s3e10" textbox "메뉴명"
                ref="s3e11" textbox "URL"
  Step 6: browser_type(ref="s3e10", text="테스트 메뉴")
  Step 7: browser_type(ref="s3e11", text="/test")
  Step 8: browser_take_screenshot → "SC-002-02-form-filled.png"
  Step 9: browser_snapshot → 저장 버튼 확인
          발견: ref="s3e15" button "저장"
  Step 10: browser_click(ref="s3e15", element="저장 버튼")
  Step 11: browser_wait_for(text="저장되었습니다")
  Step 12: browser_take_screenshot → "SC-002-03-save-success.png"
  ✓ SC-002 PASS

... (나머지 시나리오) ...

[테스트 완료]
  browser_close

=== 리포트 생성 ===
  📄 docs/qa/reports/e2e-report-2026-01-09.md
```

---

## 스크린샷 관리

```yaml
저장_위치: {프로젝트}/docs/qa/screenshots/

파일명_규칙:
  형식: "{시나리오ID}-{단계번호}-{설명}.png"

필수_캡처_시점:
  - 각 시나리오 시작 전
  - 중요 액션 완료 후
  - 폼 입력 완료 후
  - 에러 발생 시
  - 시나리오 종료 시

예시:
  SC-001-00-start.png
  SC-001-01-menu-clicked.png
  SC-001-02-list-loaded.png
  SC-002-00-start.png
  SC-002-01-popup-open.png
  SC-002-02-form-filled.png
  SC-002-03-save-success.png
```

---

## 코드 생성 모드 (선택적)

테스트 코드 파일 생성이 필요한 경우:

```yaml
트리거:
  - "테스트 코드 생성해줘"
  - "Playwright 코드 만들어줘"

생성_파일:
  - playwright.config.ts
  - e2e/auth.setup.ts
  - e2e/specs/{feature}.spec.ts

참고: 상세한 코드 생성 규칙은 별도 문서 참조
```

---

## 사용법

```bash
# 인터랙티브 모드 (기본, 권장)
"E2E 테스트 실행해줘"
"브라우저로 테스트해줘"
"로그인 테스트 실행해줘"

# 코드 생성 모드
"테스트 코드 생성해줘"
"Playwright 코드 만들어줘"
```

---

**핵심 기억사항**:
1. **단일 브라우저 세션** - 전체 테스트에서 브라우저 1개만 사용
2. **매 단계 browser_snapshot** - 요소 ref 획득 후 액션 수행
3. **단계별 스크린샷** - 모든 액션 전후 상태 캡처
4. **메뉴/링크 클릭으로 이동** - navigate 남용 금지
