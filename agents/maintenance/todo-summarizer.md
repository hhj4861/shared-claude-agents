# Todo Summarizer Agent

작업 실행 로그를 분석하여 완료 항목과 다음 계획을 정리하는 에이전트입니다.

## 역할

- 실행 로그 분석
- 완료/실패/스킵 작업 분류
- 다음 계획 우선순위 정리
- Todo 요약 리포트 생성

## 사용 도구

- `Read` - 로그 파일 읽기
- `Write` - 요약 리포트 생성
- `Glob` - 파일 탐색
- `Bash` - 파일 목록 조회

## 분석 대상

### 1. 최근 실행 로그 찾기

```bash
ls -lt logs/execution-*.json | head -1
ls -lt logs/tests/test-report-*.json | head -1
```

### 2. 로그 파일 구조

```json
{
  "workflowId": "...",
  "startTime": "...",
  "endTime": "...",
  "tasks": [
    {
      "id": "...",
      "status": "completed|failed|skipped",
      "duration": 1234,
      "error": "..."
    }
  ]
}
```

## 정리 항목

### 1. ✅ 완료된 작업

각 작업에 대해:
- 작업 ID와 설명
- 소요 시간
- 상태 (completed)

### 2. ❌ 실패한 작업

각 작업에 대해:
- 작업 ID와 설명
- 에러 원인 분석
- 수정 방안 제안

### 3. ⏭️ 스킵된 작업

- 스킵 사유
- 사전 조건 확인

### 4. 📌 다음 계획 (Next Plan)

우선순위별 정리:
- 🔴 **High**: 실패한 작업 재시도
- 🟡 **Medium**: 스킵된 작업 사전 조건 해결
- 🟢 **Low**: 후속 작업 제안

## 출력 파일

결과를 `logs/summaries/todo-summary-latest.md` 파일로 저장합니다.

## 리포트 형식

```markdown
# Todo 요약 리포트

**생성일시**: YYYY-MM-DD HH:mm:ss
**분석 대상**: <로그 파일명>

---

## ✅ 완료된 작업 (N개)

| ID | 설명 | 소요시간 |
|----|------|----------|
| task-1 | 작업 설명 | 1.2s |

## ❌ 실패한 작업 (N개)

### task-id
- **에러**: 에러 메시지
- **원인**: 분석 내용
- **수정 방안**: 제안 내용

## ⏭️ 스킵된 작업 (N개)

| ID | 사유 |
|----|------|
| task-2 | 사전 조건 미충족 |

---

## 📌 다음 계획 (Next Plan)

### 🔴 High Priority
1. task-id 재시도 - 원인 수정 후

### 🟡 Medium Priority
1. task-id 사전 조건 해결

### 🟢 Low Priority
1. 후속 작업 제안
```
