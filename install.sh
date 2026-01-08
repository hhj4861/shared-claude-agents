#!/bin/bash
#
# Shared Claude Agents - Install Script
#
# 이 스크립트는 공유 에이전트를 설치하고 SessionStart hook을 설정합니다.
# 또한 MCP 서버를 빌드하고 Claude Code 설정을 자동으로 구성합니다.
# 기존 에이전트가 있으면 보호하고, 충돌 시 사용자에게 선택권을 제공합니다.
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
AGENTS_LINK="$HOME/.claude/agents"
SETTINGS_FILE="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_SERVERS_DIR="$SCRIPT_DIR/mcp-servers"

echo ""
echo "=========================================="
echo "  Shared Claude Agents Installer"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# Step 0: Node.js 버전 확인 (MCP 서버용)
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[0/7]${NC} Checking Node.js version..."

if ! command -v node &> /dev/null; then
    echo -e "       ${YELLOW}Warning:${NC} Node.js not found. MCP servers will not be built."
    echo -e "       Install Node.js 18+ to use MCP servers: https://nodejs.org/"
    BUILD_MCP=false
else
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "       ${YELLOW}Warning:${NC} Node.js 18+ required for MCP servers. (current: $(node -v))"
        BUILD_MCP=false
    else
        echo -e "       ${GREEN}Node.js $(node -v) found${NC}"
        BUILD_MCP=true
    fi
fi
echo ""

# 1. 현재 위치가 표준 위치가 아니면 복사/이동
if [ "$SCRIPT_DIR" != "$SHARED_DIR" ]; then
    echo -e "${YELLOW}[1/7]${NC} Installing to $SHARED_DIR..."

    # 기존 디렉토리가 있으면 백업
    if [ -d "$SHARED_DIR" ]; then
        BACKUP_DIR="$SHARED_DIR.backup.$(date +%Y%m%d%H%M%S)"
        echo "       Backing up existing to $BACKUP_DIR"
        mv "$SHARED_DIR" "$BACKUP_DIR"
    fi

    mkdir -p "$(dirname "$SHARED_DIR")"
    cp -r "$SCRIPT_DIR" "$SHARED_DIR"
    echo -e "       ${GREEN}Done${NC}"
else
    echo -e "${GREEN}[1/7]${NC} Already in standard location"
fi

# 2. 기존 에이전트 확인 및 보호
echo -e "${YELLOW}[2/7]${NC} Checking existing agents..."

if [ -d "$AGENTS_LINK" ] && [ ! -L "$AGENTS_LINK" ]; then
    echo -e "       ${YELLOW}Warning:${NC} Existing agents folder found at $AGENTS_LINK"
    echo ""
    echo "       How would you like to handle existing agents?"
    echo "       1) Backup and replace with shared agents (recommended)"
    echo "       2) Merge - copy shared agents, keep existing (may override)"
    echo "       3) Keep existing, skip installation"
    echo ""
    read -p "       Select option (1/2/3): " -n 1 -r AGENT_OPTION
    echo ""

    case $AGENT_OPTION in
        1)
            BACKUP_DIR="$AGENTS_LINK.backup.$(date +%Y%m%d%H%M%S)"
            echo -e "       Backing up existing to $BACKUP_DIR"
            mv "$AGENTS_LINK" "$BACKUP_DIR"
            ;;
        2)
            echo -e "       Merging agents..."
            # 기존 폴더 내 에이전트 유지, 새 에이전트만 복사
            for dir in "$SHARED_DIR/agents"/*/; do
                dirname=$(basename "$dir")
                if [ -d "$AGENTS_LINK/$dirname" ]; then
                    echo -e "       ${YELLOW}Skipping${NC} $dirname (already exists)"
                else
                    cp -r "$dir" "$AGENTS_LINK/"
                    echo -e "       ${GREEN}Added${NC} $dirname"
                fi
            done
            echo -e "       ${GREEN}Merge complete${NC}"
            echo ""
            echo "       Note: Shared agents were added to existing folder."
            echo "       Auto-update hook will NOT be configured for merged setup."
            exit 0
            ;;
        3)
            echo -e "       ${YELLOW}Skipping agent installation${NC}"
            exit 0
            ;;
        *)
            echo -e "       ${RED}Invalid option. Aborting.${NC}"
            exit 1
            ;;
    esac
elif [ -L "$AGENTS_LINK" ]; then
    echo "       Existing symlink found. Removing..."
    rm "$AGENTS_LINK"
fi

echo -e "       ${GREEN}Done${NC}"

# 3. Symlink 생성
echo -e "${YELLOW}[3/7]${NC} Creating symlink..."

ln -s "$SHARED_DIR/agents" "$AGENTS_LINK"
echo -e "       ${GREEN}Linked:${NC} $AGENTS_LINK -> $SHARED_DIR/agents"

# 4. Standards/Skills/Rules 심볼릭 링크 (있으면)
echo -e "${YELLOW}[4/7]${NC} Linking additional resources..."

# Standards
if [ -d "$SHARED_DIR/standards" ]; then
    if [ -L "$HOME/.claude/standards" ]; then
        rm "$HOME/.claude/standards"
    fi
    if [ ! -d "$HOME/.claude/standards" ]; then
        ln -s "$SHARED_DIR/standards" "$HOME/.claude/standards"
        echo -e "       ${GREEN}Linked:${NC} standards"
    fi
fi

# Skills
if [ -d "$SHARED_DIR/skills" ]; then
    if [ -L "$HOME/.claude/skills" ]; then
        rm "$HOME/.claude/skills"
    fi
    if [ ! -d "$HOME/.claude/skills" ]; then
        ln -s "$SHARED_DIR/skills" "$HOME/.claude/skills"
        echo -e "       ${GREEN}Linked:${NC} skills"
    fi
fi

# Rules
if [ -f "$SHARED_DIR/RULES.md" ]; then
    if [ -L "$HOME/.claude/RULES.md" ]; then
        rm "$HOME/.claude/RULES.md"
    fi
    if [ ! -f "$HOME/.claude/RULES.md" ]; then
        ln -s "$SHARED_DIR/RULES.md" "$HOME/.claude/RULES.md"
        echo -e "       ${GREEN}Linked:${NC} RULES.md"
    fi
fi

echo -e "       ${GREEN}Done${NC}"

# 5. SessionStart Hook 설정
echo -e "${YELLOW}[5/7]${NC} Configuring SessionStart hook..."

HOOK_COMMAND="cd \"\$HOME/.claude/shared-agents\" && git pull -q 2>/dev/null || true"

# settings.json이 없으면 생성
if [ ! -f "$SETTINGS_FILE" ]; then
    echo '{}' > "$SETTINGS_FILE"
fi

# jq가 있으면 사용, 없으면 수동 안내
if command -v jq &> /dev/null; then
    # hooks.SessionStart가 없으면 추가
    UPDATED=$(jq --arg cmd "$HOOK_COMMAND" '
        .hooks.SessionStart //= [] |
        if (.hooks.SessionStart | map(select(.hooks[0].command == $cmd)) | length) == 0
        then .hooks.SessionStart += [{"hooks": [{"type": "command", "command": $cmd}]}]
        else .
        end
    ' "$SETTINGS_FILE")
    echo "$UPDATED" > "$SETTINGS_FILE"
    echo -e "       ${GREEN}Hook configured automatically${NC}"
else
    echo -e "       ${YELLOW}jq not found. Please add manually to $SETTINGS_FILE:${NC}"
    echo ""
    echo '  "hooks": {'
    echo '    "SessionStart": [{'
    echo '      "hooks": [{'
    echo '        "type": "command",'
    echo "        \"command\": \"$HOOK_COMMAND\""
    echo '      }]'
    echo '    }]'
    echo '  }'
    echo ""
fi

# 6. MCP 서버 빌드 및 설정
echo -e "${YELLOW}[6/7]${NC} Building MCP servers..."

if [ "$BUILD_MCP" = true ] && [ -d "$MCP_SERVERS_DIR" ]; then
    MCP_SERVERS_BUILT=()

    for server_dir in "$MCP_SERVERS_DIR"/*/; do
        if [ -d "$server_dir" ]; then
            server_name=$(basename "$server_dir")

            if [ -f "$server_dir/package.json" ]; then
                echo -e "       📦 Building $server_name..."

                cd "$server_dir"
                npm install --silent 2>/dev/null || npm install
                npm run build --silent 2>/dev/null || npm run build
                cd "$SCRIPT_DIR"

                # dist/index.js가 있으면 설정에 추가
                if [ -f "$server_dir/dist/index.js" ]; then
                    echo -e "       ${GREEN}✅ $server_name built successfully${NC}"
                    MCP_SERVERS_BUILT+=("$server_name")
                else
                    echo -e "       ${RED}❌ $server_name build failed${NC}"
                fi
            fi
        fi
    done

    # claude mcp add 명령으로 MCP 서버 등록
    if [ ${#MCP_SERVERS_BUILT[@]} -gt 0 ]; then
        echo ""
        echo -e "       Registering MCP servers with Claude Code..."

        # claude 명령이 있는지 확인
        if command -v claude &> /dev/null; then
            for server_name in "${MCP_SERVERS_BUILT[@]}"; do
                SERVER_PATH="$SHARED_DIR/mcp-servers/$server_name/dist/index.js"

                # 기존 등록 제거 후 재등록 (오류 무시)
                claude mcp remove -s user "$server_name" 2>/dev/null || true

                # 전역으로 MCP 서버 등록
                if claude mcp add -s user "$server_name" node "$SERVER_PATH" 2>/dev/null; then
                    echo -e "       ${GREEN}✅ $server_name registered${NC}"
                else
                    echo -e "       ${YELLOW}⚠️  $server_name registration failed (try manually: claude mcp add -s user $server_name node $SERVER_PATH)${NC}"
                fi
            done
        else
            echo -e "       ${YELLOW}⚠️  'claude' command not found. Please register MCP servers manually:${NC}"
            for server_name in "${MCP_SERVERS_BUILT[@]}"; do
                echo -e "       claude mcp add -s user $server_name node $SHARED_DIR/mcp-servers/$server_name/dist/index.js"
            done
        fi
    fi
else
    if [ "$BUILD_MCP" = false ]; then
        echo -e "       ${YELLOW}⚠️  Skipped (Node.js 18+ required)${NC}"
    else
        echo -e "       ${YELLOW}⚠️  No MCP servers found${NC}"
    fi
fi

# External MCP 서버 등록 (npx 기반)
echo ""
echo -e "       Registering external MCP servers..."

if command -v claude &> /dev/null; then
    # Playwright MCP (Microsoft 공식 - 브라우저 자동화 및 E2E 테스트)
    claude mcp remove -s user playwright 2>/dev/null || true
    if claude mcp add -s user playwright npx @playwright/mcp@latest 2>/dev/null; then
        echo -e "       ${GREEN}✅ playwright registered (Microsoft official)${NC}"
    else
        echo -e "       ${YELLOW}⚠️  playwright registration failed (try manually: claude mcp add -s user playwright npx @playwright/mcp@latest)${NC}"
    fi
else
    echo -e "       ${YELLOW}⚠️  'claude' command not found. Please register external MCP servers manually:${NC}"
    echo -e "       claude mcp add -s user playwright npx @playwright/mcp@latest"
fi

echo ""

# 완료
# -----------------------------------------------------------------------------
# Step 7: 프로젝트 초기화 옵션
# -----------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}[7/7]${NC} Project initialization..."
echo ""
echo "Would you like to initialize projects with shared agents?"
echo "This will create .claude/ folder and link agents in your project."
echo ""
echo "Tip: For FE/BE separated projects, initialize both:"
echo "  - Frontend project: E2E tests (Playwright)"
echo "  - Backend project: API tests"
echo ""

# 프로젝트 초기화 함수
init_project() {
    local PROJECT_PATH="$1"
    local PROJECT_TYPE="$2"  # fe, be, or fullstack

    # 절대 경로로 변환
    if [[ "$PROJECT_PATH" != /* ]]; then
        PROJECT_PATH="$(pwd)/$PROJECT_PATH"
    fi

    if [ ! -d "$PROJECT_PATH" ]; then
        echo -e "       ${RED}Error:${NC} Project path does not exist: $PROJECT_PATH"
        return 1
    fi

    echo -e "       Initializing project ($PROJECT_TYPE): $PROJECT_PATH"

    # .claude 폴더 생성
    mkdir -p "$PROJECT_PATH/.claude"

    # agents 심볼릭 링크
    if [ -L "$PROJECT_PATH/.claude/agents" ]; then
        rm "$PROJECT_PATH/.claude/agents"
    fi
    if [ ! -d "$PROJECT_PATH/.claude/agents" ]; then
        ln -s "$SHARED_DIR/agents" "$PROJECT_PATH/.claude/agents"
        echo -e "       ${GREEN}✓${NC} Linked agents"
    fi

    # standards 심볼릭 링크
    if [ -L "$PROJECT_PATH/.claude/standards" ]; then
        rm "$PROJECT_PATH/.claude/standards"
    fi
    if [ ! -d "$PROJECT_PATH/.claude/standards" ]; then
        ln -s "$SHARED_DIR/standards" "$PROJECT_PATH/.claude/standards"
        echo -e "       ${GREEN}✓${NC} Linked standards"
    fi

    # skills 심볼릭 링크
    if [ -L "$PROJECT_PATH/.claude/skills" ]; then
        rm "$PROJECT_PATH/.claude/skills"
    fi
    if [ ! -d "$PROJECT_PATH/.claude/skills" ]; then
        ln -s "$SHARED_DIR/skills" "$PROJECT_PATH/.claude/skills"
        echo -e "       ${GREEN}✓${NC} Linked skills"
    fi

    # docs/qa/specs 복사 (테스트 시나리오 등)
    if [ -d "$SHARED_DIR/docs/qa/specs" ]; then
        mkdir -p "$PROJECT_PATH/docs/qa"
        if [ ! -d "$PROJECT_PATH/docs/qa/specs" ]; then
            cp -r "$SHARED_DIR/docs/qa/specs" "$PROJECT_PATH/docs/qa/"
            echo -e "       ${GREEN}✓${NC} Copied QA specs and test scenarios"
        else
            echo -e "       ${YELLOW}⚠️${NC}  docs/qa/specs already exists, skipped"
        fi
    fi

    # CLAUDE.md 생성 (타입별로 다르게)
    if [ ! -f "$PROJECT_PATH/CLAUDE.md" ]; then
        if [ "$PROJECT_TYPE" = "fe" ]; then
            cat > "$PROJECT_PATH/CLAUDE.md" << 'CLAUDEMD'
# Frontend Project Instructions

## Overview
이 프로젝트는 shared-claude-agents와 연동되어 있습니다. (Frontend)

## Available Agents
- **frontend-dev**: 프론트엔드 개발
- **e2e-tester**: E2E 테스트 실행 (Playwright)
- **qa-scenario-writer**: QA 시나리오 작성

## E2E Testing
- `docs/qa/specs/` 폴더에 테스트 시나리오가 있습니다.
- E2E 테스트 코드는 `e2e/` 폴더에 생성됩니다.

## Usage
```
"E2E 테스트 코드 작성해줘"
"UI 컴포넌트 개발해줘"
"테스트 시나리오 기반으로 Playwright 테스트 만들어줘"
```
CLAUDEMD
        elif [ "$PROJECT_TYPE" = "be" ]; then
            cat > "$PROJECT_PATH/CLAUDE.md" << 'CLAUDEMD'
# Backend Project Instructions

## Overview
이 프로젝트는 shared-claude-agents와 연동되어 있습니다. (Backend)

## Available Agents
- **backend-dev**: 백엔드 개발
- **backend-tester**: API 테스트
- **qa-scenario-writer**: QA 시나리오 작성

## API Testing
- `docs/qa/specs/` 폴더에 API 명세와 테스트 시나리오가 있습니다.
- API 테스트 코드는 `tests/` 또는 `src/test/` 폴더에 생성됩니다.

## Usage
```
"API 테스트 코드 작성해줘"
"테스트 시나리오 기반으로 API 테스트 만들어줘"
"백엔드 로직 개발해줘"
```
CLAUDEMD
        else
            cat > "$PROJECT_PATH/CLAUDE.md" << 'CLAUDEMD'
# Project Instructions

## Overview
이 프로젝트는 shared-claude-agents와 연동되어 있습니다.

## Available Agents
- **qa-scenario-writer**: QA 시나리오 작성
- **e2e-tester**: E2E 테스트 실행 (Playwright)
- **backend-tester**: API 테스트
- **frontend-dev**: 프론트엔드 개발
- **backend-dev**: 백엔드 개발

## Test Scenarios
- `docs/qa/specs/` 폴더에 테스트 시나리오가 있습니다.

## Usage
```
"테스트 시나리오 작성해줘"
"E2E 테스트 코드 작성해줘"
"API 테스트해줘"
```
CLAUDEMD
        fi
        echo -e "       ${GREEN}✓${NC} Created CLAUDE.md ($PROJECT_TYPE)"
    fi

    echo -e "       ${GREEN}✓${NC} Project initialized: $PROJECT_PATH"
    return 0
}

# 프로젝트 타입 선택
echo "Select project setup type:"
echo "  1) Single fullstack project"
echo "  2) Separate FE/BE projects"
echo "  3) Skip project initialization"
echo ""
read -p "Select option (1/2/3): " -n 1 -r SETUP_TYPE
echo ""

case $SETUP_TYPE in
    1)
        read -p "Enter project path: " PROJECT_PATH
        if [ -n "$PROJECT_PATH" ]; then
            init_project "$PROJECT_PATH" "fullstack"
        fi
        ;;
    2)
        echo ""
        read -p "Enter FRONTEND project path: " FE_PATH
        if [ -n "$FE_PATH" ]; then
            init_project "$FE_PATH" "fe"
        fi
        echo ""
        read -p "Enter BACKEND project path: " BE_PATH
        if [ -n "$BE_PATH" ]; then
            init_project "$BE_PATH" "be"
        fi
        ;;
    3)
        echo -e "       ${YELLOW}Skipped${NC} - No project specified"
        ;;
    *)
        echo -e "       ${YELLOW}Skipped${NC} - Invalid option"
        ;;
esac

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo "Installed agents:"
ls -1 "$SHARED_DIR/agents" 2>/dev/null | while read dir; do
    echo "  - $dir"
done
echo ""

# MCP 서버 목록
echo "Installed MCP servers:"

# 로컬 MCP 서버
if [ -d "$SHARED_DIR/mcp-servers" ]; then
    for server_dir in "$SHARED_DIR/mcp-servers"/*/; do
        if [ -d "$server_dir" ]; then
            server_name=$(basename "$server_dir")
            if [ -f "$server_dir/dist/index.js" ]; then
                echo -e "  ${GREEN}✅${NC} $server_name (local)"
            else
                echo -e "  ${YELLOW}⚠️${NC}  $server_name (not built)"
            fi
        fi
    done
fi

# External MCP 서버
echo -e "  ${GREEN}✅${NC} playwright (npx @playwright/mcp@latest)"
echo ""

echo "Usage:"
echo "  - Agents are now available in all Claude Code projects"
echo "  - On session start, agents auto-update via git pull"
echo "  - Override in project: .claude/agents/<name>/"
echo ""
echo "MCP Tools available after restart:"
echo "  - doc-converter: convert_pdf_to_md, convert_docx_to_md, check_spec_files"
echo "  - playwright: browser_navigate, browser_click, browser_snapshot, browser_take_screenshot, etc."
echo ""
echo "Project-level setup:"
echo "  ./scripts/init-project.sh <project-name>"
echo ""
echo -e "${YELLOW}⚠️  Please restart Claude Code to use MCP servers${NC}"
echo ""
