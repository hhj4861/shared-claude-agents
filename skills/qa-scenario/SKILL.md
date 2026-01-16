---
name: qa-scenario
description: QA 시나리오 생성. qa-director를 통해 step1→step1.5→step2→step3→step3.5가 순차 실행된다.
args: "[--auto] [--from stepN]"
---

# QA Scenario Skill

## 실행 방법

**qa-director 오케스트레이터로 위임합니다.**

```javascript
// 일반 모드 - 웹 폼으로 설정 입력
Task({
  subagent_type: "qa-director",
  prompt: "QA 시나리오 만들어줘"
})

// 자동 모드 - 현재 디렉토리 기준 자동 분석
Task({
  subagent_type: "qa-director",
  prompt: "QA 시나리오 만들어줘 --auto"
})

// step2부터 시작 (step1 스킵)
Task({
  subagent_type: "qa-director",
  prompt: "QA 시나리오 만들어줘 --from step2"
})
```

## 실행 모드

| 모드 | 명령 | 설명 |
|------|------|------|
| 일반 | `/qa-scenario` | 웹 폼으로 상세 설정 입력 (전체 파이프라인) |
| 자동 | `/qa-scenario --auto` | 질문 없이 git diff 기반 자동 분석 |
| step2부터 | `/qa-scenario --from step2` | 문서 수집 스킵, step1.5(프로젝트 구조)부터 시작 |
| step3부터 | `/qa-scenario --from step3` | 시나리오 작성만 실행 |

## 파이프라인 단계

```
Step 1:   문서 수집 (step1-doc-collector)
Step 1.5: 프로젝트 구조 분석 (step1.5-project-detector)
Step 2:   코드 분석 (step2-code-analyzer)
Step 3:   시나리오 작성 (step3-scenario-writer)
Step 3.5: 시나리오 외부 검토 (step3.5-scenario-reviewer) [선택적]
          → Gemini CLI로 교차 검토 (없으면 스킵)
Step 3.6: 시나리오 보완 (step3.6-scenario-refiner) 🆕 [선택적]
          → 리뷰 피드백 반영, 누락 추가/중복 제거
```

## 다음 단계

시나리오 생성 완료 후:
- `/api-test` - API 테스트 실행
- `/e2e-test` - E2E 테스트 실행
