# Shared Claude Agents

팀 전체에서 공유하는 Claude Code 에이전트 모음입니다.

## 포함된 에이전트

| 부서 | 에이전트 | 설명 |
|------|---------|------|
| **development** | dev-lead | 개발 파이프라인 총괄 |
| | tech-architect | 기술 스택, 환경 설정 |
| | frontend-dev | UI, 페이지 구현 |
| | backend-dev | API, DB 연동 |
| **qa** | qa-director | QA 파이프라인 총괄 |
| | qa-scenario-writer | 시나리오 설계 |
| | qa-tester | 테스트 수행 |
| | browser-tester | 브라우저 테스트 |
| | demo-recorder | 데모 영상 생성 |
| **devops** | devops-director | CI/CD, 인프라 관리 |
| **architecture** | architect-lead | 아키텍처 파이프라인 총괄 |
| | feasibility-analyst | 기술 실현가능성 검토 |
| | system-designer | 시스템/API 설계 |
| | data-architect | 데이터 모델, ERD |
| | mcp-strategist | MCP 서버 설계 |

## 설치

```bash
# 1. Clone
git clone git@github.com:your-org/shared-claude-agents.git
cd shared-claude-agents

# 2. Install (1회만 실행)
./install.sh
```

설치 후:
- `~/.claude/shared-agents/` - 에이전트 저장 위치
- `~/.claude/agents/` - symlink (자동 생성)
- `~/.claude/settings.json` - SessionStart hook (자동 설정)

## 동작 방식

```
┌─────────────────────────────────────────────────────────┐
│  Claude Code 세션 시작                                   │
│         │                                               │
│         ▼                                               │
│  SessionStart Hook 실행                                  │
│  └─ git pull (shared-agents 자동 업데이트)               │
│         │                                               │
│         ▼                                               │
│  에이전트 로드 (우선순위)                                 │
│  1. .claude/agents/ (프로젝트) ← Override               │
│  2. ~/.claude/agents/ (전역)   ← 기본값                 │
└─────────────────────────────────────────────────────────┘
```

## 프로젝트별 오버라이드

특정 프로젝트에서 에이전트를 커스터마이징하려면:

```bash
# 프로젝트 디렉토리에서
mkdir -p .claude/agents/development

# 오버라이드할 에이전트만 생성
cat > .claude/agents/development/_orchestrator.md << 'EOF'
# Dev Lead (Project Override)

이 프로젝트 전용 설정...
EOF
```

프로젝트 레벨 에이전트가 전역 에이전트를 자동으로 override합니다.

## 업데이트

### 자동 업데이트
Claude Code 세션 시작 시 `git pull`이 자동 실행됩니다.

### 수동 업데이트
```bash
cd ~/.claude/shared-agents
git pull
```

## 에이전트 추가/수정

```bash
cd ~/.claude/shared-agents

# 에이전트 수정
vim agents/development/frontend-dev.md

# 커밋 & 푸시
git add .
git commit -m "Update frontend-dev agent"
git push
```

팀원들은 다음 세션 시작 시 자동으로 업데이트됩니다.

## 문제 해결

### symlink가 깨진 경우
```bash
cd ~/.claude/shared-agents
./install.sh
```

### Hook이 동작하지 않는 경우
`~/.claude/settings.json` 확인:
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "cd \"$HOME/.claude/shared-agents\" && git pull -q 2>/dev/null || true"
      }]
    }]
  }
}
```

### 특정 에이전트만 사용하고 싶은 경우
프로젝트에서 `.claude/agents/` 폴더를 만들고 필요한 에이전트만 복사하세요.
전역 에이전트는 무시됩니다.
