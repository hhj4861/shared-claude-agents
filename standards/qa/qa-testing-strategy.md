# QA 테스트 전략 가이드

## 테스트 책임 분리

| 담당 | 테스트 유형 | 비율 | 도구 |
|------|------------|------|------|
| 개발팀 (TDD) | Unit Tests | 70% | Vitest, Jest |
| QA팀 | Integration Tests | 20% | Vitest, Supertest |
| QA팀 | E2E Tests | 10% | Playwright |

## 테스트 피라미드

```
          ┌─────────┐
          │   E2E   │  10% - 핵심 사용자 플로우     ← QA팀
          │Playwright│
         ─┴─────────┴─
        ┌─────────────┐
        │  Integration │  20% - API, DB 연동        ← QA팀
        │   Testing    │
       ─┴─────────────┴─
      ┌─────────────────┐
      │   Unit Tests    │  70% - 함수, 컴포넌트     ← 개발팀 (TDD)
      │   Vitest/Jest   │
     ─┴─────────────────┴─
```

## 테스트 우선순위

### P0 - Critical (100% 자동화 필수)

```yaml
범위:
  - 사용자 인증 플로우 (로그인/로그아웃)
  - 핵심 비즈니스 기능
  - 결제 플로우 (있을 경우)

특징:
  - 실패 시 서비스 불가
  - CI/CD 파이프라인에서 반드시 실행
  - 블로킹 테스트
```

### P1 - High (90% 자동화)

```yaml
범위:
  - 주요 사용자 기능
  - API 통합 테스트
  - 데이터 흐름 검증

특징:
  - 실패 시 주요 기능 장애
  - 배포 전 필수 확인
```

### P2 - Medium (70% 자동화)

```yaml
범위:
  - 보조 기능
  - 에러 핸들링
  - 엣지 케이스

특징:
  - 실패 시 부분 기능 장애
  - 주기적 실행
```

## Integration 테스트 시나리오

### API 통합 테스트

```typescript
// tests/integration/api/users.test.ts
describe("Users API Integration", () => {
  describe("POST /api/users", () => {
    it("새 사용자 생성 후 DB에 저장되었는지 확인", async () => {
      const response = await request(app)
        .post("/api/users")
        .send({ email: "test@example.com", name: "Test" })

      expect(response.status).toBe(201)

      // DB에서 실제로 생성되었는지 확인
      const user = await db.user.findUnique({
        where: { email: "test@example.com" }
      })
      expect(user).not.toBeNull()
    })
  })
})
```

### 인증 통합 테스트

```typescript
// tests/integration/auth/login.test.ts
describe("Auth Integration", () => {
  it("로그인 성공 시 세션이 생성된다", async () => {
    // 사용자 생성
    await createUser({ email: "test@example.com", password: "password123" })

    // 로그인
    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: "test@example.com", password: "password123" })

    expect(response.status).toBe(200)
    expect(response.headers["set-cookie"]).toBeDefined()
  })
})
```

## E2E 테스트 시나리오

### 로그인 플로우

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test.describe('인증 플로우', () => {
  test('사용자가 로그인하고 대시보드에 접근할 수 있다', async ({ page }) => {
    // Given: 로그인 페이지 접속
    await page.goto('/login')

    // When: 로그인 정보 입력
    await page.fill('[placeholder="이메일"]', 'test@example.com')
    await page.fill('[placeholder="비밀번호"]', 'password123')
    await page.click('button:has-text("로그인")')

    // Then: 대시보드로 이동
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('대시보드')
  })
})
```

### 핵심 비즈니스 플로우

```typescript
// tests/e2e/core-flow.spec.ts
test('사용자가 새 항목을 생성할 수 있다', async ({ page }) => {
  // 로그인 상태로 시작
  await loginAsUser(page)

  // 새 항목 생성 페이지로 이동
  await page.click('text=새로 만들기')

  // 폼 입력
  await page.fill('[name="title"]', '테스트 항목')
  await page.click('button:has-text("저장")')

  // 목록에서 확인
  await expect(page.locator('text=테스트 항목')).toBeVisible()
})
```

## 품질 게이트

### 릴리즈 기준

| 조건 | 필수 | 기준 |
|------|------|------|
| P0 테스트 통과 | 필수 | 100% |
| P1 테스트 통과 | 필수 | 95% |
| Critical 버그 | 필수 | 0개 |
| High 버그 | 필수 | 0개 |
| 전체 커버리지 | 권장 | 80% |
| Medium 버그 | 권장 | < 3개 |

### 판정 결과

```
✅ GO: 모든 필수 조건 충족
⚠️ CONDITIONAL: 필수 충족, 권장 미충족 (리스크 수용 시 릴리즈)
❌ NO-GO: 필수 조건 미충족
```

## QA 파이프라인

```
코드 변경
    │
    ▼
┌─────────────────┐
│  Unit Tests     │  ← 개발자 (TDD)
│  (npm test)     │
└────────┬────────┘
         │ 통과 시
         ▼
┌─────────────────┐
│  Integration    │  ← QA팀
│  Tests          │
└────────┬────────┘
         │ 통과 시
         ▼
┌─────────────────┐
│  E2E Tests      │  ← QA팀
│  (Playwright)   │
└────────┬────────┘
         │ 통과 시
         ▼
    품질 판정
    (GO/NO-GO)
```

## Playwright 설정

### playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```
