# 아키텍처 패턴 가이드

## 핵심 원칙

1. **단순성 우선**: 복잡함은 버그를 부른다
2. **관심사 분리**: 레이어별 책임 명확화
3. **확장성 고려**: Stateless 설계
4. **테스트 가능성**: 의존성 주입

## 프로젝트 구조 (Next.js App Router)

```
project-name/
├── src/
│   ├── app/                        # App Router
│   │   ├── (auth)/                 # 인증 라우트 그룹
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   ├── (dashboard)/            # 대시보드 라우트 그룹
│   │   │   └── dashboard/page.tsx
│   │   ├── api/                    # API Routes
│   │   │   ├── auth/
│   │   │   └── users/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   │
│   ├── components/                 # 컴포넌트
│   │   ├── ui/                     # shadcn/ui 컴포넌트
│   │   ├── layout/                 # 레이아웃 컴포넌트
│   │   └── features/               # 기능별 컴포넌트
│   │       ├── auth/
│   │       └── dashboard/
│   │
│   ├── lib/                        # 유틸리티
│   │   ├── supabase/               # Supabase 클라이언트
│   │   ├── utils.ts                # cn() 등
│   │   └── validations/            # Zod 스키마
│   │
│   ├── stores/                     # Zustand 스토어
│   │
│   └── types/                      # TypeScript 타입
│
├── tests/                          # 테스트
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── public/                         # 정적 파일
├── .claude/                        # Claude Code 설정
├── .env.local                      # 환경 변수
└── package.json
```

## 레이어 구조

```
┌───────────────────────────────────────────────────────────────┐
│                     Presentation Layer                         │
│                                                                │
│   app/          components/ui/        components/features/     │
│   (라우트)       (UI 컴포넌트)         (기능 컴포넌트)          │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                     Application Layer                          │
│                                                                │
│   lib/validations/        stores/           API handlers       │
│   (입력 검증)             (상태 관리)       (비즈니스 로직)     │
└────────────────────────────┬──────────────────────────────────┘
                             │
                             ▼
┌───────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                        │
│                                                                │
│   lib/supabase/           External APIs     Third-party libs   │
│   (DB 접근)               (외부 서비스)      (라이브러리)       │
└───────────────────────────────────────────────────────────────┘
```

## 레이어 규칙

```yaml
규칙:
  - 상위 레이어만 하위 레이어에 의존
  - 순환 의존 금지
  - Infrastructure는 인터페이스를 통해 접근

예시:
  ✅ components/features/ → lib/supabase/
  ❌ lib/supabase/ → components/features/
```

## API 구조

```
app/api/
├── auth/
│   ├── login/route.ts      # POST /api/auth/login
│   ├── signup/route.ts     # POST /api/auth/signup
│   └── logout/route.ts     # POST /api/auth/logout
│
├── users/
│   ├── route.ts            # GET, POST /api/users
│   └── [id]/
│       └── route.ts        # GET, PUT, DELETE /api/users/:id
│
└── {resource}/
    └── route.ts
```

## 컴포넌트 구조

### UI 컴포넌트 (components/ui/)

- shadcn/ui 컴포넌트
- 스타일만 있고 로직 없음
- 재사용 가능한 기본 컴포넌트

### 기능 컴포넌트 (components/features/)

- 비즈니스 로직 포함
- 특정 기능에 종속
- 폼, 리스트, 카드 등

### 레이아웃 컴포넌트 (components/layout/)

- Header, Footer, Sidebar
- 페이지 레이아웃 구조

## 상태 관리 전략

```yaml
서버 상태:
  - React Query 또는 SWR (데이터 페칭)
  - 또는 Server Components 활용

클라이언트 상태:
  - Zustand (전역 상태)
  - useState/useReducer (로컬 상태)

폼 상태:
  - React Hook Form (폼 관리)
  - Zod (유효성 검사)
```

## 데이터 흐름

```
사용자 입력
    │
    ▼
┌─────────────────┐
│  Form (RHF)     │  ← Zod 유효성 검사
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Route      │  ← 비즈니스 로직
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase       │  ← 데이터 저장
└─────────────────┘
```

## 에러 처리 전략

```typescript
// 표준 에러 응답 형식
interface ErrorResponse {
  error: string
  details?: any[]
}

// HTTP 상태 코드
200: 성공 (GET, PUT)
201: 생성됨 (POST)
204: 내용 없음 (DELETE)
400: 잘못된 요청 (유효성 검사 실패)
401: 인증 필요
403: 권한 없음
404: 리소스 없음
500: 서버 오류
```

## 파일 명명 규칙

```
컴포넌트: kebab-case.tsx (login-form.tsx)
페이지: page.tsx (Next.js 규칙)
훅: use-{name}.ts (use-auth.ts)
유틸: {name}.ts (utils.ts)
타입: {name}.ts (user.ts)
테스트: {name}.test.ts
```
