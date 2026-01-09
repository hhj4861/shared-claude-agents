---
name: qa-scenario
description: QA 시나리오 생성. 웹 폼으로 정보 수집 후 테스트 시나리오 문서를 자동 생성한다.
args: "[--auto]"
---

# QA Scenario Skill

## 실행 모드

### 1. 일반 모드: `/qa-scenario`

웹 폼을 통해 상세 설정 입력:

```bash
node ~/.claude/scripts/qa-input-form/index.js
```

### 2. 자동 모드: `/qa-scenario --auto`

**질문 없이 자동 진행.** 현재 프로젝트 기준으로 분석:

```yaml
auto_mode:
  project_path: 현재 작업 디렉토리 (pwd)
  target: git diff로 변경된 파일 분석
  documents: 없음 (코드 기반 분석)
  questions: 치명적 오류만 보고, 나머지 자동 진행
```

---

## 모드별 동작

### 일반 모드 (`/qa-scenario`)

1. **웹 폼 실행** (MANDATORY)
   ```bash
   node ~/.claude/scripts/qa-input-form/index.js
   ```
2. 사용자가 폼에서 설정 입력
3. config_path 반환 후 파이프라인 진행

### 자동 모드 (`/qa-scenario --auto`)

1. **설정 자동 생성:**
   ```bash
   # 현재 디렉토리를 프로젝트로 사용
   PROJECT_PATH=$(pwd)

   # git diff로 변경 파일 분석
   git diff --name-only HEAD~5
   ```

2. **자동 설정 파일 생성:**
   - `project_path`: 현재 디렉토리
   - `target`: 변경된 파일 기반 추론
   - `documents`: 빈 배열 (코드 분석만)

3. **질문 없이 진행:**
   - 경고는 로그로만 출력
   - 치명적 오류만 중단
   - 나머지는 best-effort로 진행

---

## 자동 모드 설정 생성 예시

```javascript
// --auto 모드에서 자동 생성되는 config
{
  "project": {
    "name": "auto-detected",
    "fe_path": "${pwd}",
    "be_path": null
  },
  "target": {
    "type": "git_diff",
    "scope": "HEAD~5"
  },
  "documents": [],
  "options": {
    "auto_mode": true,
    "skip_questions": true,
    "stop_on_critical_only": true
  }
}
```

---

## 워크플로우

```
/qa-scenario           → 웹 폼 → 상세 설정 → 파이프라인
/qa-scenario --auto    → 자동 설정 → 파이프라인 (질문 없음)
```

---

## 다음 단계

시나리오 생성 완료 후:
- `/api-test` - API 테스트 코드 생성 및 실행
- `/e2e-test` - E2E 테스트 코드 생성 및 실행
