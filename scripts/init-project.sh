#!/bin/bash
#
# init-project.sh - 프로젝트에 공유 에이전트 연동
#
# 사용법:
#   ./scripts/init-project.sh <project-path>
#   ./scripts/init-project.sh ~/projects/my-app
#
# 기능:
#   - 프로젝트에 .claude/ 디렉토리에 공유 리소스 복사
#   - Claude Code는 symlink를 따라가지 않으므로 실제 파일 복사
#   - agents, skills, scripts, standards, rules 연동
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 경로 설정
SHARED_DIR="$HOME/.claude/shared-agents"

# 사용법 출력
usage() {
    echo "Usage: $0 <project-path>"
    echo ""
    echo "Examples:"
    echo "  $0 ~/projects/my-app"
    echo "  $0 /path/to/project"
    echo ""
    echo "This script:"
    echo "  - Creates .claude/agents symlink to shared agents"
    echo "  - Optionally links standards, skills, rules"
    echo "  - Optionally analyzes project structure for optimization"
    exit 1
}

# 인자 확인
if [ -z "$1" ]; then
    echo -e "${RED}Error: Project path is required${NC}"
    usage
fi

PROJECT_PATH="$1"

# 절대 경로로 변환
if [[ "$PROJECT_PATH" != /* ]]; then
    PROJECT_PATH="$(pwd)/$PROJECT_PATH"
fi

# 프로젝트 폴더 존재 확인
if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${YELLOW}Warning: $PROJECT_PATH does not exist${NC}"
    read -p "Create the folder? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p "$PROJECT_PATH"
        echo -e "${GREEN}Created: $PROJECT_PATH${NC}"
    else
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
fi

# shared-agents 폴더 확인
if [ ! -d "$SHARED_DIR/agents" ]; then
    echo -e "${RED}Error: Shared agents not found at $SHARED_DIR${NC}"
    echo "Please run install.sh first."
    exit 1
fi

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Project Agent Setup${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Project: $PROJECT_PATH"
echo ""

# .claude 폴더 생성
mkdir -p "$PROJECT_PATH/.claude"

# 기존 에이전트 확인
if [ -d "$PROJECT_PATH/.claude/agents" ] && [ ! -L "$PROJECT_PATH/.claude/agents" ]; then
    echo -e "${YELLOW}Warning:${NC} Project already has .claude/agents folder"
    echo ""
    echo "Options:"
    echo "  1) Backup existing and link to shared agents"
    echo "  2) Keep existing agents (project-specific)"
    echo "  3) Cancel"
    echo ""
    read -p "Select option (1/2/3): " -n 1 -r AGENT_OPTION
    echo ""

    case $AGENT_OPTION in
        1)
            BACKUP_DIR="$PROJECT_PATH/.claude/agents.backup.$(date +%Y%m%d%H%M%S)"
            mv "$PROJECT_PATH/.claude/agents" "$BACKUP_DIR"
            echo -e "Backed up to: $BACKUP_DIR"
            ;;
        2)
            echo -e "${GREEN}Keeping existing project agents${NC}"
            echo "Shared agents will not be linked."
            SKIP_AGENTS=true
            ;;
        3)
            echo "Cancelled."
            exit 0
            ;;
    esac
fi

# 에이전트 심볼릭 링크 생성
if [ -z "$SKIP_AGENTS" ]; then
    if [ -L "$PROJECT_PATH/.claude/agents" ]; then
        rm "$PROJECT_PATH/.claude/agents"
    fi
    ln -s "$SHARED_DIR/agents" "$PROJECT_PATH/.claude/agents"
    echo -e "${GREEN}✓${NC} Linked agents"
fi

# 추가 리소스 연동 여부 확인
echo ""
echo "Would you like to link additional shared resources?"
echo ""
read -p "  Link standards? (y/n): " -n 1 -r LINK_STANDARDS
echo
read -p "  Link skills? (y/n): " -n 1 -r LINK_SKILLS
echo
read -p "  Link rules? (y/n): " -n 1 -r LINK_RULES
echo

# Standards 연동
if [[ $LINK_STANDARDS =~ ^[Yy]$ ]] && [ -d "$SHARED_DIR/standards" ]; then
    if [ -L "$PROJECT_PATH/.claude/standards" ]; then
        rm "$PROJECT_PATH/.claude/standards"
    fi
    if [ ! -d "$PROJECT_PATH/.claude/standards" ]; then
        ln -s "$SHARED_DIR/standards" "$PROJECT_PATH/.claude/standards"
        echo -e "${GREEN}✓${NC} Linked standards"
    fi
fi

# Skills 연동
if [[ $LINK_SKILLS =~ ^[Yy]$ ]] && [ -d "$SHARED_DIR/skills" ]; then
    if [ -L "$PROJECT_PATH/.claude/skills" ]; then
        rm "$PROJECT_PATH/.claude/skills"
    fi
    if [ ! -d "$PROJECT_PATH/.claude/skills" ]; then
        ln -s "$SHARED_DIR/skills" "$PROJECT_PATH/.claude/skills"
        echo -e "${GREEN}✓${NC} Linked skills"
    fi
fi

# Rules 연동
if [[ $LINK_RULES =~ ^[Yy]$ ]] && [ -f "$SHARED_DIR/RULES.md" ]; then
    if [ -L "$PROJECT_PATH/.claude/RULES.md" ]; then
        rm "$PROJECT_PATH/.claude/RULES.md"
    fi
    if [ ! -f "$PROJECT_PATH/.claude/RULES.md" ]; then
        ln -s "$SHARED_DIR/RULES.md" "$PROJECT_PATH/.claude/RULES.md"
        echo -e "${GREEN}✓${NC} Linked RULES.md"
    fi
fi

# 프로젝트 구조 분석 및 최적화 제안
echo ""
echo "Would you like to analyze project structure for agent optimization?"
read -p "(This helps customize agents for your project) (y/n): " -n 1 -r ANALYZE
echo

if [[ $ANALYZE =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "${BLUE}Analyzing project structure...${NC}"
    echo ""

    # 프로젝트 유형 감지
    PROJECT_TYPE="unknown"
    TECH_STACK=""

    if [ -f "$PROJECT_PATH/package.json" ]; then
        PROJECT_TYPE="node"
        if grep -q '"next"' "$PROJECT_PATH/package.json" 2>/dev/null; then
            TECH_STACK="Next.js"
        elif grep -q '"react"' "$PROJECT_PATH/package.json" 2>/dev/null; then
            TECH_STACK="React"
        elif grep -q '"vue"' "$PROJECT_PATH/package.json" 2>/dev/null; then
            TECH_STACK="Vue"
        fi
    elif [ -f "$PROJECT_PATH/pyproject.toml" ] || [ -f "$PROJECT_PATH/requirements.txt" ]; then
        PROJECT_TYPE="python"
        if [ -f "$PROJECT_PATH/app.py" ] || grep -q "streamlit" "$PROJECT_PATH/requirements.txt" 2>/dev/null; then
            TECH_STACK="Streamlit"
        elif grep -q "fastapi" "$PROJECT_PATH/requirements.txt" 2>/dev/null; then
            TECH_STACK="FastAPI"
        elif grep -q "django" "$PROJECT_PATH/requirements.txt" 2>/dev/null; then
            TECH_STACK="Django"
        fi
    elif [ -f "$PROJECT_PATH/go.mod" ]; then
        PROJECT_TYPE="go"
    elif [ -f "$PROJECT_PATH/Cargo.toml" ]; then
        PROJECT_TYPE="rust"
    fi

    echo "Detected project type: $PROJECT_TYPE"
    if [ -n "$TECH_STACK" ]; then
        echo "Detected framework: $TECH_STACK"
    fi

    # 최적화 제안
    echo ""
    echo -e "${YELLOW}Optimization suggestions:${NC}"
    echo ""

    case $PROJECT_TYPE in
        node)
            echo "  - frontend-dev agent is optimized for $TECH_STACK"
            echo "  - backend-dev agent supports Next.js API Routes"
            echo "  - Consider adding Supabase for database"
            ;;
        python)
            echo "  - For $TECH_STACK projects, consider:"
            echo "    - Using standard Python project structure"
            echo "    - Adding tests/ directory for TDD"
            ;;
        *)
            echo "  - Generic agents will be used"
            echo "  - Consider creating project-specific agent overrides"
            ;;
    esac

    echo ""
    echo "To create project-specific agent overrides:"
    echo "  mkdir -p .claude/agents/{team}/"
    echo "  cp ~/.claude/shared-agents/agents/{team}/_orchestrator.md .claude/agents/{team}/"
    echo "  # Edit the copied file with project-specific instructions"
fi

# .gitignore 업데이트 제안
if [ -f "$PROJECT_PATH/.gitignore" ]; then
    if ! grep -q ".claude/" "$PROJECT_PATH/.gitignore" 2>/dev/null; then
        echo ""
        read -p "Add .claude/ to .gitignore? (y/n): " -n 1 -r ADD_GITIGNORE
        echo
        if [[ $ADD_GITIGNORE =~ ^[Yy]$ ]]; then
            echo "" >> "$PROJECT_PATH/.gitignore"
            echo "# Claude Code" >> "$PROJECT_PATH/.gitignore"
            echo ".claude/" >> "$PROJECT_PATH/.gitignore"
            echo -e "${GREEN}✓${NC} Added .claude/ to .gitignore"
        fi
    fi
fi

# CLAUDE.md 생성 (없는 경우)
if [ ! -f "$PROJECT_PATH/CLAUDE.md" ]; then
    PROJECT_NAME=$(basename "$PROJECT_PATH")
    cat > "$PROJECT_PATH/CLAUDE.md" << EOF
# $PROJECT_NAME

## 사용 가능한 Skills

- \`/qa-scenario\` - QA 테스트 시나리오 생성
- \`/api-test\` - API 테스트 코드 생성 및 실행
- \`/e2e-test\` - E2E 테스트 코드 생성 및 실행
- \`/commit\` - Git 커밋 생성
- \`/review-pr\` - PR 리뷰

## 사용 가능한 Agents

- \`qa-director\` - QA 파이프라인 총괄
- \`frontend-dev\` - 프론트엔드 개발
- \`backend-dev\` - 백엔드 개발
EOF
    echo -e "${GREEN}✓${NC} Created CLAUDE.md"
fi

# 완료
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Project: $PROJECT_PATH"
echo ""
echo "Linked resources:"
ls -la "$PROJECT_PATH/.claude/" 2>/dev/null | grep "^l" | while read line; do
    echo "  $line"
done
echo ""
echo "Usage:"
echo "  cd $PROJECT_PATH"
echo "  claude"
echo '  > "개발 시작해줘"'
echo ""
