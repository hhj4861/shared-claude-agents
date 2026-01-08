# Shared Claude Agents

팀 내 공통으로 사용하는 Claude Code 에이전트, 스킬, 표준 문서를 관리하는 저장소입니다.

## 구조

```
shared-claude-agents/
├── agents/                    # 에이전트 정의
│   ├── architecture/          # 아키텍처팀
│   │   └── _orchestrator.md   # 아키텍트 리드
│   ├── development/           # 개발팀
│   │   ├── _orchestrator.md   # 개발팀 리드
│   │   ├── frontend-dev.md    # 프론트엔드 개발자
│   │   ├── backend-dev.md     # 백엔드 개발자
│   │   └── tech-architect.md  # 기술 아키텍트
│   ├── qa/                    # QA팀
│   │   └── _orchestrator.md   # QA 디렉터
│   └── devops/                # DevOps팀
│       └── _orchestrator.md   # DevOps 디렉터
│
├── standards/                 # 표준 문서
│   ├── development/           # 개발 표준
│   │   ├── tech-stack-defaults.md
│   │   └── testing.md
│   ├── architecture/          # 아키텍처 표준
│   │   └── architecture-patterns.md
│   ├── qa/                    # QA 표준
│   │   └── qa-testing-strategy.md
│   └── devops/                # DevOps 표준
│       └── ci-cd.md
│
├── skills/                    # 스킬 정의
│   ├── commit.md              # /commit 스킬
│   └── review-pr.md           # /review-pr 스킬
│
├── scripts/                   # 유틸리티 스크립트
│   └── init-project.sh        # 프로젝트 초기화
│
├── RULES.md                   # 팀 공통 규칙
├── install.sh                 # 설치 스크립트
└── README.md                  # 이 문서
```

## 설치

### 1. 저장소 클론

```bash
git clone <repository-url> ~/.claude/shared-agents
cd ~/.claude/shared-agents
```

### 2. 설치 스크립트 실행

```bash
./install.sh
```

설치 스크립트가 수행하는 작업:
- `~/.claude/agents` 심볼릭 링크 생성
- `~/.claude/standards` 심볼릭 링크 생성
- `~/.claude/skills` 심볼릭 링크 생성
- `~/.claude/RULES.md` 심볼릭 링크 생성
- SessionStart hook 설정 (자동 업데이트)

### 3. 기존 에이전트가 있는 경우

설치 스크립트가 다음 옵션을 제공합니다:

1. **Backup and replace**: 기존 에이전트 백업 후 공유 에이전트로 교체 (권장)
2. **Merge**: 기존 에이전트 유지, 새 에이전트만 추가
3. **Keep existing**: 기존 에이전트 유지, 설치 취소

## 프로젝트별 설정

### 새 프로젝트에 연동

```bash
./scripts/init-project.sh ~/projects/my-app
```

이 스크립트가 수행하는 작업:
- `.claude/agents` 심볼릭 링크 생성
- (선택) standards, skills, rules 연동
- (선택) 프로젝트 구조 분석 및 최적화 제안
- (선택) .gitignore에 .claude/ 추가

### 프로젝트별 에이전트 오버라이드

프로젝트 특화 에이전트가 필요한 경우:

```bash
# 프로젝트 디렉토리에서
mkdir -p .claude/agents/development/
cp ~/.claude/shared-agents/agents/development/frontend-dev.md .claude/agents/development/
# 복사한 파일을 프로젝트에 맞게 수정
```

프로젝트 레벨 에이전트가 공유 에이전트보다 우선합니다.

## 동작 방식

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code 세션 시작                                       │
│         │                                                   │
│         ▼                                                   │
│  SessionStart Hook 실행                                      │
│  └─ git pull (shared-agents 자동 업데이트)                   │
│         │                                                   │
│         ▼                                                   │
│  에이전트 로드 (우선순위)                                     │
│  1. .claude/agents/ (프로젝트) ← Override                   │
│  2. ~/.claude/agents/ (전역)   ← 기본값                     │
└─────────────────────────────────────────────────────────────┘
```

## 에이전트 사용법

### 개발

```bash
> 개발 시작해줘
> 프론트엔드 개발해줘
> 백엔드 API 만들어줘
> 환경 설정해줘
```

### 아키텍처

```bash
> 아키텍처 설계해줘
> 시스템 구조 잡아줘
```

### QA

```bash
> QA해줘
> 테스트해줘
> E2E 테스트 실행해줘
```

### DevOps

```bash
> 배포 파이프라인 구축해줘
> CI/CD 설정해줘
```

## 에이전트 목록

| 에이전트 | 설명 | 호출 명령 |
|---------|------|----------|
| dev-lead | 개발팀 총괄 | "개발 시작해줘" |
| frontend-dev | 프론트엔드 개발 | "프론트엔드 개발해줘" |
| backend-dev | 백엔드 개발 | "백엔드 만들어줘" |
| tech-architect | 기술 환경 설정 | "환경 설정해줘" |
| architect-lead | 아키텍처 설계 | "아키텍처 설계해줘" |
| qa-director | QA 테스트 | "QA해줘" |
| devops-director | CI/CD 구축 | "배포 파이프라인 구축해줘" |

## 스킬 사용법

```bash
/commit              # 변경사항 커밋
/review-pr 123       # PR 리뷰
```

## 표준 문서

| 문서 | 내용 |
|------|------|
| tech-stack-defaults.md | 기본 기술 스택 |
| testing.md | 테스트 표준 |
| architecture-patterns.md | 아키텍처 패턴 |
| qa-testing-strategy.md | QA 테스트 전략 |
| ci-cd.md | CI/CD 표준 |

## 자동 업데이트

SessionStart hook이 설정되어 있으면, Claude Code 세션 시작 시 자동으로 `git pull`을 실행합니다.

```json
// ~/.claude/settings.json
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

## 기여 가이드

1. 새 에이전트 추가 시 `agents/{team}/` 폴더에 생성
2. 에이전트 파일은 frontmatter (name, description, model, tools) 필수
3. 표준 문서는 `standards/{category}/`에 생성
4. 변경 후 테스트 수행
5. PR 생성 및 리뷰 요청

## 문제 해결

### 에이전트가 인식되지 않는 경우

```bash
# 심볼릭 링크 확인
ls -la ~/.claude/

# 심볼릭 링크 재생성
ln -sf ~/.claude/shared-agents/agents ~/.claude/agents
```

### 자동 업데이트가 안 되는 경우

```bash
# settings.json 확인
cat ~/.claude/settings.json

# 수동 업데이트
cd ~/.claude/shared-agents && git pull
```

## 라이선스

Internal Use Only - 팀 내부 사용 전용
