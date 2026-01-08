# 테스트 표준 가이드

## 테스트 책임 분리

```
개발팀 (TDD)
├── Unit Tests (70%)
│   ├── 함수 테스트
│   ├── 컴포넌트 테스트
│   └── API 엔드포인트 테스트
│
QA팀
├── Integration Tests (20%)
│   ├── API 연동 테스트
│   └── DB 연동 테스트
│
└── E2E Tests (10%)
    └── 사용자 시나리오 테스트
```

## TDD 워크플로우

```
┌─────────────────────────────────────────────────────────────┐
│   🔴 RED: 실패하는 테스트 먼저 작성                          │
│      │                                                      │
│      ▼                                                      │
│   🟢 GREEN: 테스트를 통과하는 최소한의 코드 작성             │
│      │                                                      │
│      ▼                                                      │
│   🔵 REFACTOR: 코드 정리 (테스트는 계속 통과해야 함)         │
│      │                                                      │
│      └──────────────── 반복 ─────────────────────────────▶  │
└─────────────────────────────────────────────────────────────┘
```

## 테스트 파일 구조

```
tests/
├── unit/                     # 단위 테스트 (개발팀)
│   ├── components/           # 컴포넌트 테스트
│   │   ├── ui/
│   │   └── features/
│   ├── api/                  # API 테스트
│   │   ├── users.test.ts
│   │   └── auth.test.ts
│   ├── lib/                  # 유틸리티 테스트
│   └── hooks/                # 커스텀 훅 테스트
│
├── integration/              # 통합 테스트 (QA팀)
│   ├── api/                  # API 통합 테스트
│   └── db/                   # DB 통합 테스트
│
├── e2e/                      # E2E 테스트 (QA팀)
│   ├── auth.spec.ts
│   └── dashboard.spec.ts
│
└── helpers/                  # 테스트 헬퍼
    ├── setup.ts              # 테스트 환경 설정
    └── factories.ts          # 테스트 데이터 팩토리
```

## 단위 테스트 예시

### 컴포넌트 테스트

```tsx
// tests/unit/components/login-form.test.tsx
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { LoginForm } from "@/components/features/auth/login-form"

describe("LoginForm", () => {
  it("이메일과 비밀번호 입력 필드를 렌더링한다", () => {
    render(<LoginForm />)

    expect(screen.getByPlaceholderText("이메일")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("비밀번호")).toBeInTheDocument()
  })

  it("유효하지 않은 이메일 입력 시 에러 메시지 표시", async () => {
    render(<LoginForm />)

    await userEvent.type(screen.getByPlaceholderText("이메일"), "invalid-email")
    await userEvent.click(screen.getByRole("button", { name: "로그인" }))

    await waitFor(() => {
      expect(screen.getByText("유효한 이메일을 입력하세요")).toBeInTheDocument()
    })
  })
})
```

### API 테스트

```typescript
// tests/unit/api/users.test.ts
describe("POST /api/users", () => {
  it("유효한 데이터로 사용자 생성 시 201 반환", async () => {
    const response = await POST("/api/users", {
      body: { email: "test@example.com", name: "Test User" }
    })

    expect(response.status).toBe(201)
    expect(response.body.data).toHaveProperty("id")
  })

  it("이메일 누락 시 400 반환", async () => {
    const response = await POST("/api/users", {
      body: { name: "Test User" }
    })

    expect(response.status).toBe(400)
  })
})
```

## 테스트 설정

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/']
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
```

### tests/helpers/setup.ts

```typescript
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn()
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/'
}))
```

## 커버리지 목표

| 테스트 유형 | 최소 커버리지 |
|-------------|--------------|
| Unit Tests | 80% |
| Integration | 70% |
| E2E | 핵심 플로우 100% |

## 테스트 명명 규칙

```typescript
// 한글 사용 권장 (가독성)
describe("LoginForm", () => {
  it("이메일과 비밀번호 입력 필드를 렌더링한다", () => {})
  it("유효하지 않은 이메일 입력 시 에러 메시지를 표시한다", () => {})
  it("로그인 성공 시 대시보드로 이동한다", () => {})
})

// Given-When-Then 패턴
describe("LoginForm", () => {
  describe("유효하지 않은 이메일이 입력되었을 때", () => {
    it("에러 메시지를 표시한다", () => {})
  })
})
```

## 테스트 체크리스트

### 개발팀 (TDD)

```
□ 테스트 먼저 작성
□ 테스트가 실패하는지 확인 (Red)
□ 최소 코드로 통과 (Green)
□ 리팩토링 (Blue)
□ 단위 테스트 커버리지 80%+
```

### QA팀

```
□ Integration 테스트 시나리오 작성
□ E2E 테스트 시나리오 작성
□ P0 테스트 100% 자동화
□ P1 테스트 90%+ 자동화
```
