# CI/CD 표준 가이드

## GitHub Actions 기본 워크플로우

### ci.yml

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-test:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Lint
        run: pnpm lint

      - name: Type check
        run: pnpm typecheck

      - name: Unit tests
        run: pnpm test

      - name: Build
        run: pnpm build

  e2e-test:
    runs-on: ubuntu-latest
    needs: lint-and-test

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps

      - name: Run E2E tests
        run: pnpm test:e2e

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## 배포 워크플로우

### Vercel 자동 배포

```yaml
# Vercel이 자동으로 처리 (vercel.json 설정)
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "develop": true
    }
  }
}
```

### 수동 배포 (필요시)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: lint-and-test

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

## 환경별 배포 전략

| 환경 | 브랜치 | 배포 방식 | URL |
|------|--------|----------|-----|
| Development | develop | 자동 | dev.example.vercel.app |
| Staging | main | 자동 | staging.example.vercel.app |
| Production | main (태그) | 수동 승인 | example.com |

## 환경 변수 관리

### Vercel 환경 변수

```yaml
Development:
  NEXT_PUBLIC_SUPABASE_URL: (dev project url)
  NEXT_PUBLIC_SUPABASE_ANON_KEY: (dev anon key)

Production:
  NEXT_PUBLIC_SUPABASE_URL: (prod project url)
  NEXT_PUBLIC_SUPABASE_ANON_KEY: (prod anon key)
```

### GitHub Secrets

```yaml
Repository Secrets:
  VERCEL_TOKEN: (Vercel API 토큰)
  VERCEL_ORG_ID: (Vercel 조직 ID)
  VERCEL_PROJECT_ID: (Vercel 프로젝트 ID)
```

## package.json 스크립트

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## 배포 체크리스트

### 배포 전

```
□ 모든 CI 테스트 통과
□ 코드 리뷰 완료
□ 환경 변수 확인
□ 마이그레이션 스크립트 준비 (필요시)
□ 롤백 계획 수립
```

### 배포 후

```
□ 스모크 테스트 수행
□ 에러 로그 모니터링
□ 성능 메트릭 확인
□ 사용자 피드백 수집
```

## 롤백 전략

### Vercel 롤백

```bash
# 이전 배포로 롤백
vercel rollback [deployment-url]

# 또는 Vercel 대시보드에서 "Promote to Production"
```

### 데이터베이스 롤백

```sql
-- Supabase 마이그레이션 롤백
-- migrations/rollback/[timestamp].sql 실행
```

## 모니터링

### 기본 모니터링 (Free Tier)

| 서비스 | 모니터링 항목 |
|--------|-------------|
| Vercel Analytics | Web Vitals, 페이지 뷰 |
| Supabase Dashboard | DB 사용량, API 호출 |
| GitHub Actions | 빌드 성공률 |

### 알림 설정

```yaml
# Slack 알림 (GitHub Actions)
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```
