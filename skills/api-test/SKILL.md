---
name: api-test
description: API 테스트 실행. qa-director를 통해 step4-backend-tester가 실행된다.
---

# API Test Skill

## 실행 방법

**qa-director 오케스트레이터로 위임합니다.**

```javascript
Task({
  subagent_type: "qa-director",
  prompt: "API 테스트 실행해줘"
})
```

## 사전 조건

- `docs/qa/latest/config.json` 존재
- `docs/qa/latest/scenarios/*api*.md` 시나리오 존재
- 없으면 `/qa-scenario`로 먼저 생성

## 사용 예시

```
/api-test
"API 테스트 실행해줘"
"백엔드 테스트 해줘"
```
