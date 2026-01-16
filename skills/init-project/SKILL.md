---
name: init-project
description: 현재 프로젝트를 분석하고 적합한 에이전트/스킬/설정을 자동 구성합니다.
args: "[--force] [--minimal]"
---

# Init Project Skill

프로젝트 구조를 분석하여 Claude Code 환경을 자동 설정합니다.

## 실행 방법

**project-setup 에이전트로 위임합니다.**

```javascript
Task({
  subagent_type: "project-setup",
  prompt: `
    현재 디렉토리: ${process.cwd()}
    옵션: ${args || "기본"}

    프로젝트를 분석하고 Claude Code 환경을 설정해주세요.
  `
})
```

## 옵션

| 옵션 | 설명 |
|------|------|
| `--force` | 기존 설정 덮어쓰기 |
| `--minimal` | 최소 설정만 (CLAUDE.md만 생성) |

## 수행 작업

1. **프로젝트 분석**
   - package.json, build.gradle, requirements.txt 등 감지
   - 프레임워크 판별 (React, Vue, Spring, FastAPI 등)
   - 모노레포 여부 확인

2. **에이전트 선택 및 복사**
   - 프레임워크에 맞는 개발 에이전트
   - QA 관련 에이전트 (필요시)

3. **스킬 복사**
   - /commit, /review-pr (기본)
   - 프로젝트 특화 스킬 (선택)

4. **CLAUDE.md 생성**
   - 프로젝트 구조 반영
   - 사용 가능한 에이전트/스킬 문서화

## 출력 구조

```
{project}/
├── CLAUDE.md                    # 프로젝트 설정 (신규/업데이트)
└── .claude/
    ├── agents/                  # 프로젝트 전용 에이전트
    │   ├── frontend-dev.md
    │   └── backend-dev.md
    └── settings.local.json      # 로컬 설정 (선택)
```

## 지원 프로젝트 타입

| 타입 | 감지 기준 | 복사되는 에이전트 |
|------|----------|-----------------|
| React/Vue/Angular | package.json + framework | frontend-dev |
| Node.js/Express/Fastify | package.json + server | backend-dev |
| Spring Boot | build.gradle/pom.xml | backend-dev (java) |
| Python/FastAPI/Django | requirements.txt/pyproject.toml | backend-dev (python) |
| Monorepo | pnpm-workspace/lerna/nx | frontend-dev + backend-dev |
| Unknown | - | 기본 설정만 |
