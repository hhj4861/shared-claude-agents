---
name: e2e-test
description: E2E 테스트 실행. 시나리오 기반으로 테스트 코드를 생성하고 브라우저 테스트를 실행한다.
---

# E2E Test Skill

E2E 테스트 코드를 생성하고 실행하는 스킬입니다.

## 사용법

```
/e2e-test
/e2e-test {feature}
```

## 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 설정 파일 읽기                                                │
│    docs/qa/latest/config.json                                   │
│    → test_server.fe_url, auth 정보 추출                         │
├─────────────────────────────────────────────────────────────────┤
│ 2. 시나리오 문서 읽기                                            │
│    docs/qa/latest/scenarios/*-e2e.md                            │
│    → 시나리오 없으면 "/qa-scenario" 안내 후 종료                 │
├─────────────────────────────────────────────────────────────────┤
│ 3. 테스트 코드 생성 (시나리오 기반)                              │
│    → {fe_path}/e2e/specs/{feature}.spec.ts                      │
│    → Playwright 테스트 코드 자동 생성                            │
├─────────────────────────────────────────────────────────────────┤
│ 4. 인증 처리                                                     │
│    auth.type에 따라 로그인 수행                                  │
│    - keycloak: 브라우저 로그인 자동화                            │
│    - jwt: 토큰 주입                                              │
│    - none: 바로 테스트                                           │
├─────────────────────────────────────────────────────────────────┤
│ 5. 브라우저 테스트 실행                                          │
│    → Playwright MCP로 실제 브라우저 테스트                       │
│    → 스크린샷 캡처                                               │
├─────────────────────────────────────────────────────────────────┤
│ 6. 결과 리포트 작성                                              │
│    docs/qa/latest/reports/e2e-report-{timestamp}.md             │
└─────────────────────────────────────────────────────────────────┘
```

## 생성되는 테스트 코드 예시

```typescript
// e2e/specs/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('로그인 기능', () => {
  test('TC-LOGIN-E2E-001: 정상 로그인', async ({ page }) => {
    // 시나리오 기반 자동 생성
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-btn"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  });

  test('TC-LOGIN-E2E-002: 잘못된 비밀번호', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'wrong');
    await page.click('[data-testid="submit-btn"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});
```

## 산출물

### 테스트 코드
```
{fe_path}/e2e/specs/
├── {feature}.spec.ts
└── auth.spec.ts
```

### 스크린샷
```
{project}/docs/qa/latest/screenshots/
├── {feature}-{step}-{timestamp}.png
```

### 결과 리포트
```
{project}/docs/qa/latest/reports/e2e-report-{timestamp}.md
```

## 사전 조건

1. `/qa-scenario`로 시나리오 생성 완료
2. 테스트 서버 실행 중 (test_server.fe_url)
3. Playwright MCP 설정 완료

## 예시

```bash
# 전체 E2E 테스트
/e2e-test

# 특정 기능 테스트
/e2e-test login
/e2e-test checkout
```
