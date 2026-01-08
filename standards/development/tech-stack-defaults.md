# 기본 기술 스택 가이드

팀 공통 기술 스택 표준입니다.

## 프론트엔드

| 항목 | 기술 | 버전 | 비고 |
|------|------|------|------|
| Framework | Next.js (App Router) | 14+ | React 18+ |
| Language | TypeScript | 5.x | strict mode |
| Styling | Tailwind CSS | 3.x | - |
| UI Components | shadcn/ui | latest | Radix UI 기반 |
| State | Zustand | 4.x | 필요시만 |
| Forms | React Hook Form + Zod | - | 유효성 검사 |
| Icons | Lucide React | latest | - |

## 백엔드

| 항목 | 기술 | 버전 | 비고 |
|------|------|------|------|
| Runtime | Next.js API Routes | - | Node.js 18+ |
| Database | Supabase | - | PostgreSQL |
| Auth | Supabase Auth | - | Row Level Security |
| Storage | Supabase Storage | - | 파일 업로드 |
| Validation | Zod | 3.x | 스키마 검증 |

## 인프라 (Free Tier 우선)

| 서비스 | Provider | Free Tier 한도 |
|--------|----------|---------------|
| Hosting | Vercel | 100GB 대역폭/월 |
| Database | Supabase | 500MB, 50K MAU |
| Storage | Supabase | 1GB |
| Analytics | Vercel | 기본 제공 |

## 개발 도구

| 도구 | 용도 |
|------|------|
| pnpm | 패키지 매니저 |
| Vitest | 단위 테스트 |
| Playwright | E2E 테스트 |
| ESLint | 코드 린팅 |
| Prettier | 코드 포맷팅 |

## 초기화 명령어

```bash
# Next.js 프로젝트 생성
pnpm create next-app@latest my-app \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd my-app

# shadcn/ui 설정
pnpm dlx shadcn-ui@latest init

# 기본 컴포넌트 추가
pnpm dlx shadcn-ui@latest add button card input form

# 추가 의존성
pnpm add zustand @supabase/supabase-js @supabase/ssr zod
pnpm add react-hook-form @hookform/resolvers
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
```

## 환경 변수

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 기술 선택 원칙

1. **검증된 기술**: 새로운 기술보다 안정성 우선
2. **Free Tier 활용**: 초기 비용 최소화
3. **풀스택 TypeScript**: 프론트/백엔드 일관성
4. **관리형 서비스**: 인프라 부담 최소화
5. **단순성**: 오버엔지니어링 금지
