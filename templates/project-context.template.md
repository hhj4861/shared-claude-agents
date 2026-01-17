# Project Context

> 이 파일은 project-profiler에 의해 자동 생성됩니다.
> 수동 수정 가능하며, 수정된 내용은 다음 분석 시 병합됩니다.

**마지막 분석**: {{ANALYZED_AT}}
**분석 버전**: {{VERSION}}

---

## 1. 프로젝트 정체성

### 1.1 핵심 목적
{{PROJECT_PURPOSE}}

> 이 프로젝트는 왜 만들어졌는가?

### 1.2 현재 상태

| 항목 | 상태 |
|------|------|
| 단계 | {{PROJECT_STAGE}} |
| 성숙도 | {{MATURITY_LEVEL}} |
| 활성도 | {{ACTIVITY_LEVEL}} |

> 단계: 초기(MVP) / 성장 / 안정화 / 유지보수 / 레거시

### 1.3 방향성

**현재 구현 중인 것:**
{{CURRENT_FOCUS}}

**다음에 구현할 것 (로드맵/백로그 기반):**
{{ROADMAP}}

### 1.4 문제점 & 개선점

**기술 부채:**
{{TECH_DEBT}}

**알려진 이슈:**
{{KNOWN_ISSUES}}

**개선 필요 영역:**
{{IMPROVEMENT_AREAS}}

---

## 2. 기술 아키텍처

### 2.1 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Frontend | {{FE_FRAMEWORK}} | {{FE_VERSION}} |
| Backend | {{BE_FRAMEWORK}} | {{BE_VERSION}} |
| Database | {{DATABASE}} | {{DB_VERSION}} |
| Infrastructure | {{INFRA}} | - |

### 2.2 프로젝트 구조

```
{{PROJECT_STRUCTURE}}
```

### 2.3 핵심 패턴

| 패턴 | 적용 위치 | 설명 |
|------|----------|------|
{{PATTERNS}}

---

## 3. 도메인 모델

### 3.1 핵심 엔티티

| 엔티티 | 설명 | 위치 |
|--------|------|------|
{{ENTITIES}}

### 3.2 비즈니스 규칙

{{BUSINESS_RULES}}

### 3.3 도메인 용어집

| 용어 | 정의 | 컨텍스트 |
|------|------|----------|
{{GLOSSARY}}

---

## 4. 추천 에이전트

### 4.1 공통 에이전트 적합도

| 에이전트 | 적합도 | 이유 |
|----------|--------|------|
{{SHARED_AGENT_FIT}}

### 4.2 동적 생성 권장 에이전트

{{RECOMMENDED_AGENTS}}

> 이 에이전트들은 agent-generator에 의해 자동 생성됩니다.

---

## 5. MCP 요구사항

> 이 프로젝트에서 필요로 하는 MCP 서버 목록

### 5.1 필수 MCP

| MCP | 이유 | 설치 상태 | 설치 명령 |
|-----|------|----------|----------|
{{REQUIRED_MCP}}

### 5.2 권장 MCP

| MCP | 이유 | 설치 상태 | 설치 명령 |
|-----|------|----------|----------|
{{RECOMMENDED_MCP}}

### 5.3 선택 MCP

| MCP | 이유 | 설치 명령 |
|-----|------|----------|
{{OPTIONAL_MCP}}

> 설치 상태: ✅ 설치됨, ⚠️ 미설치, ❓ 미확인

---

## 6. 프로젝트 규칙 (자동 감지)

### 6.1 코드 컨벤션
{{CODE_CONVENTIONS}}

### 6.2 Git 워크플로우
{{GIT_WORKFLOW}}

### 6.3 테스트 전략
{{TEST_STRATEGY}}

---

## 7. 주요 파일 맵

| 역할 | 경로 | 설명 |
|------|------|------|
{{FILE_MAP}}

---

## 8. 세션 기록

> 각 세션에서 학습한 내용이 자동으로 추가됩니다.

### {{SESSION_DATE}}
{{SESSION_LEARNINGS}}

---

## 9. 메타데이터

```json
{
  "analyzedAt": "{{ANALYZED_AT}}",
  "version": "{{VERSION}}",
  "projectName": "{{PROJECT_NAME}}",
  "projectPath": "{{PROJECT_PATH}}",
  "lastModified": "{{LAST_MODIFIED}}"
}
```
