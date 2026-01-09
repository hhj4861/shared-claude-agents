---
name: api-test
description: API 테스트 실행. 시나리오 기반으로 테스트 코드를 생성하고 API 테스트를 실행한다.
---

# API Test Skill

API 테스트 코드를 생성하고 실행하는 스킬입니다.

## 사용법

```
/api-test
/api-test {feature}
```

## 워크플로우

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. 설정 파일 읽기                                                │
│    docs/qa/latest/config.json                                   │
│    → test_server.be_url, auth 정보 추출                         │
├─────────────────────────────────────────────────────────────────┤
│ 2. 시나리오 문서 읽기                                            │
│    docs/qa/latest/scenarios/*-api.md                            │
│    → 시나리오 없으면 "/qa-scenario" 안내 후 종료                 │
├─────────────────────────────────────────────────────────────────┤
│ 3. 테스트 코드 생성 (시나리오 기반)                              │
│    → {be_path}/tests/api/{feature}.spec.ts                      │
│    → Jest + Supertest 코드 자동 생성                             │
├─────────────────────────────────────────────────────────────────┤
│ 4. 테스트 실행                                                   │
│    npm test 또는 프로젝트 테스트 명령 실행                       │
├─────────────────────────────────────────────────────────────────┤
│ 5. 결과 리포트 작성                                              │
│    docs/qa/latest/reports/api-report-{timestamp}.md             │
└─────────────────────────────────────────────────────────────────┘
```

## 생성되는 테스트 코드 예시

```typescript
// tests/api/auth.spec.ts
import request from 'supertest';

const BASE_URL = process.env.API_BASE_URL || 'https://api-dev.example.com';

describe('인증 API', () => {
  describe('TC-AUTH-API-001: 정상 로그인', () => {
    it('유효한 credentials로 토큰 발급', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
    });
  });

  describe('TC-AUTH-API-002: 잘못된 비밀번호', () => {
    it('401 Unauthorized 반환', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('TC-AUTH-API-003: 토큰 없이 보호된 API 접근', () => {
    it('401 Unauthorized 반환', async () => {
      const response = await request(BASE_URL)
        .get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });
  });
});
```

## 산출물

### 테스트 코드
```
{be_path}/tests/api/
├── {feature}.spec.ts
└── auth.spec.ts
```

### 결과 리포트
```
{project}/docs/qa/latest/reports/api-report-{timestamp}.md
```

## 테스트 실행 명령

```bash
# Node.js 프로젝트
npm test
npm test -- tests/api/{feature}.spec.ts

# Gradle (Java/Kotlin)
./gradlew test

# Maven
mvn test
```

## 사전 조건

1. `/qa-scenario`로 시나리오 생성 완료
2. 테스트 서버 실행 중 (test_server.be_url)

## 예시

```bash
# 전체 API 테스트
/api-test

# 특정 기능 테스트
/api-test auth
/api-test users
```
