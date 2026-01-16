---
name: api-test
description: API 테스트 실행. qa-director를 통해 step4-backend-tester가 실행된다.
args: "[--auto] [TC-ID]"
---

# API Test Skill

## 실행 방법

**qa-director 오케스트레이터로 위임합니다.**

```javascript
// 일반 모드
Task({
  subagent_type: "qa-director",
  prompt: "API 테스트 실행해줘"
})

// 자동 모드 - 질문 없이 자동 진행
Task({
  subagent_type: "qa-director",
  prompt: "API 테스트 실행해줘 --auto"
})

// 특정 TC만 실행
Task({
  subagent_type: "qa-director",
  prompt: "API 테스트 실행해줘 TC-API-001"
})
```

## 실행 모드

| 모드 | 명령 | 설명 |
|------|------|------|
| 일반 | `/api-test` | 확인 후 테스트 실행 |
| 자동 | `/api-test --auto` | 질문 없이 자동 실행 |
| 특정 TC | `/api-test TC-001` | 해당 TC만 실행 |

## 사전 조건

- `docs/qa/latest/config.json` 존재
- `docs/qa/latest/scenarios/*api*.md` 시나리오 존재
- 없으면 `/qa-scenario`로 먼저 생성

## 사용 예시

```
/api-test
/api-test --auto
/api-test TC-API-001
"API 테스트 실행해줘"
"백엔드 테스트 해줘"
```
