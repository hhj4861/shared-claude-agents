#!/bin/bash
#
# Shared Claude Agents - Install Script
#
# 이 스크립트는 공유 에이전트를 설치하고 SessionStart hook을 설정합니다.
# 또한 MCP 서버를 빌드하고 Claude Code 설정을 자동으로 구성합니다.
# 기존 에이전트가 있으면 보호하고, 충돌 시 사용자에게 선택권을 제공합니다.
#
# 사용법:
#   ./install.sh                    # 글로벌 설치만
#   ./install.sh /path/to/project   # 글로벌 설치 + 프로젝트 설정
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 경로 설정
SHARED_DIR="$HOME/.claude/shared-agents"
AGENTS_LINK="$HOME/.claude/agents"
SETTINGS_FILE="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_SERVERS_DIR="$SCRIPT_DIR/mcp-servers"

# 프로젝트 경로 (인자로 받음)
PROJECT_PATH="$1"

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

# 1. 현재 위치가 표준 위치가 아니면 심볼릭 링크 생성
if [ "$SCRIPT_DIR" != "$SHARED_DIR" ]; then
    echo -e "${YELLOW}[1/7]${NC} Linking to $SHARED_DIR..."

    # 기존 디렉토리/링크가 있으면 처리
    if [ -L "$SHARED_DIR" ]; then
        # 이미 심볼릭 링크면 삭제
        echo "       Removing existing symlink..."
        rm "$SHARED_DIR"
    elif [ -d "$SHARED_DIR" ]; then
        # 실제 디렉토리면 백업
        BACKUP_DIR="$SHARED_DIR.backup.$(date +%Y%m%d%H%M%S)"
        echo "       Backing up existing to $BACKUP_DIR"
        mv "$SHARED_DIR" "$BACKUP_DIR"
    fi

    mkdir -p "$(dirname "$SHARED_DIR")"
    ln -s "$SCRIPT_DIR" "$SHARED_DIR"
    echo -e "       ${GREEN}Linked:${NC} $SHARED_DIR -> $SCRIPT_DIR"
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

# Scripts (qa-input-form 등)
if [ -d "$SHARED_DIR/scripts" ]; then
    if [ -L "$HOME/.claude/scripts" ]; then
        rm "$HOME/.claude/scripts"
    fi
    if [ ! -d "$HOME/.claude/scripts" ]; then
        ln -s "$SHARED_DIR/scripts" "$HOME/.claude/scripts"
        echo -e "       ${GREEN}Linked:${NC} scripts"

        # qa-input-form 의존성 설치
        if [ "$BUILD_MCP" = true ] && [ -d "$SHARED_DIR/scripts/qa-input-form" ]; then
            echo -e "       Installing qa-input-form dependencies..."
            cd "$SHARED_DIR/scripts/qa-input-form"
            npm install --silent 2>/dev/null || npm install
            cd "$SCRIPT_DIR"
            echo -e "       ${GREEN}✅ qa-input-form ready${NC}"
        fi

        # e2e-dashboard 의존성 설치
        if [ "$BUILD_MCP" = true ] && [ -d "$SHARED_DIR/scripts/e2e-dashboard" ]; then
            echo -e "       Installing e2e-dashboard dependencies..."
            cd "$SHARED_DIR/scripts/e2e-dashboard"
            npm install --silent 2>/dev/null || npm install
            cd "$SCRIPT_DIR"
            echo -e "       ${GREEN}✅ e2e-dashboard ready${NC}"
        fi
    fi
fi

echo -e "       ${GREEN}Done${NC}"

# 5. SessionStart Hook 및 MCP 권한 설정
echo -e "${YELLOW}[5/7]${NC} Configuring SessionStart hook and MCP permissions..."

HOOK_COMMAND="cd \"\$HOME/.claude/shared-agents\" && git pull -q 2>/dev/null || true"

# 자동 승인 도구 목록 (MCP + 기본 도구 + QA 도구)
MCP_ALLOWED_TOOLS=(
    # 기본 도구
    "Read"
    "Write"
    "Edit(docs/qa/**)"
    "WebFetch"
    "Task"

    # MCP 서버 도구
    "mcp__qa-pipeline__*"
    "mcp__doc-converter__*"
    "mcp__puppeteer-browser__*"
    "mcp__atlassian__*"
    "mcp__playwright__*"
    "mcp__appium-mcp__*"
    "mcp__swagger-mcp__*"
    "mcp__figma__*"

    # QA 스킬 도구
    "Skill(e2e-test:*)"
    "Skill(api-test:*)"
    "Skill(qa-scenario:*)"

    # Bash 기본 명령
    "Bash(node:*)"
    "Bash(npm:*)"
    "Bash(npx:*)"
    "Bash(git status:*)"
    "Bash(git diff:*)"
    "Bash(ls:*)"
    "Bash(pwd)"
    "Bash(find:*)"
    "Bash(mkdir:*)"
    "Bash(cat:*)"
    "Bash(cat >:*)"
    "Bash(chmod:*)"

    # Claude Code 서브에이전트 자동 승인
    "Bash(claude-code task:*)"

    # QA E2E 대시보드 동기화 (sync.sh)
    "Bash(SYNC=*)"
    "Bash(\$SYNC:*)"
    "Bash(curl:*)"

    # 프로세스 관리
    "Bash(lsof:*)"
    "Bash(pkill:*)"
    "Bash(xargs kill -9)"
)

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
    echo -e "       ${GREEN}Hook configured${NC}"

    # permissions.allow 추가 (MCP 도구 자동 승인)
    ALLOW_JSON=$(printf '%s\n' "${MCP_ALLOWED_TOOLS[@]}" | jq -R . | jq -s .)
    UPDATED=$(jq --argjson allow "$ALLOW_JSON" '
        .permissions.allow //= [] |
        .permissions.allow = (.permissions.allow + $allow | unique)
    ' "$SETTINGS_FILE")
    echo "$UPDATED" > "$SETTINGS_FILE"
    echo -e "       ${GREEN}MCP permissions configured (auto-approve enabled)${NC}"
else
    echo -e "       ${YELLOW}jq not found. Please add manually to $SETTINGS_FILE:${NC}"
    echo ""
    echo '  "permissions": {'
    echo '    "allow": ['
    for tool in "${MCP_ALLOWED_TOOLS[@]}"; do
        echo "      \"$tool\","
    done
    echo '    ]'
    echo '  },'
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
        echo -e "       ${GREEN}✅ playwright registered (Web E2E testing)${NC}"
    else
        echo -e "       ${YELLOW}⚠️  playwright registration failed${NC}"
    fi

    # Appium MCP (공식 - 모바일 앱 테스트 Android/iOS)
    claude mcp remove -s user appium-mcp 2>/dev/null || true
    if claude mcp add -s user appium-mcp -- npx -y appium-mcp@latest 2>/dev/null; then
        echo -e "       ${GREEN}✅ appium-mcp registered (Mobile app testing)${NC}"
    else
        echo -e "       ${YELLOW}⚠️  appium-mcp registration failed${NC}"
    fi

    # Swagger/OpenAPI MCP (API 명세서 분석)
    claude mcp remove -s user swagger-mcp 2>/dev/null || true
    if claude mcp add -s user swagger-mcp -- npx -y @anthropic-community/swagger-mcp-server 2>/dev/null; then
        echo -e "       ${GREEN}✅ swagger-mcp registered (API spec analysis)${NC}"
    else
        echo -e "       ${YELLOW}⚠️  swagger-mcp registration failed${NC}"
    fi

    # Figma MCP (화면설계서)
    claude mcp remove -s user figma 2>/dev/null || true
    if claude mcp add -s user figma -- npx -y figma-developer-mcp --stdio 2>/dev/null; then
        echo -e "       ${GREEN}✅ figma registered (UI design)${NC}"
    else
        echo -e "       ${YELLOW}⚠️  figma registration failed (requires Figma Desktop)${NC}"
    fi

    # Atlassian MCP (Confluence/Jira - SSE transport)
    claude mcp remove -s user atlassian 2>/dev/null || true
    if claude mcp add -s user --transport sse atlassian https://mcp.atlassian.com/v1/sse 2>/dev/null; then
        echo -e "       ${GREEN}✅ atlassian registered (Confluence/Jira)${NC}"
        echo -e "       ${YELLOW}📌 OAuth 인증 필요: Claude Code 재시작 후 /mcp → atlassian 선택하여 인증${NC}"
    else
        echo -e "       ${YELLOW}⚠️  atlassian registration failed${NC}"
    fi
else
    echo -e "       ${YELLOW}⚠️  'claude' command not found. Please register external MCP servers manually:${NC}"
    echo -e "       claude mcp add -s user playwright npx @playwright/mcp@latest"
    echo -e "       claude mcp add -s user appium-mcp -- npx -y appium-mcp@latest"
    echo -e "       claude mcp add -s user swagger-mcp -- npx -y @anthropic-community/swagger-mcp-server"
    echo -e "       claude mcp add -s user figma -- npx -y figma-developer-mcp --stdio"
    echo -e "       claude mcp add -s user --transport sse atlassian https://mcp.atlassian.com/v1/sse"
fi

echo ""

# -----------------------------------------------------------------------------
# Step 7: 프로젝트 설정 (인자로 경로가 주어진 경우)
# -----------------------------------------------------------------------------
echo ""

# 프로젝트별 리소스 설정 함수
setup_project_resource() {
    local name=$1
    local source=$2
    local target=$3
    local is_dir=$4

    if [ -L "$target" ]; then
        rm "$target"
    elif [ -e "$target" ]; then
        BACKUP_PATH="${target}.backup.$(date +%Y%m%d%H%M%S)"
        mv "$target" "$BACKUP_PATH"
        echo -e "       ${YELLOW}Backed up:${NC} $(basename $BACKUP_PATH)"
    fi
    ln -s "$source" "$target"
    echo -e "       ${GREEN}✓${NC} $name → Symlink"
}

if [ -n "$PROJECT_PATH" ]; then
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
            echo -e "${RED}Skipping project setup.${NC}"
            PROJECT_PATH=""
        fi
    fi

    if [ -n "$PROJECT_PATH" ]; then
        echo -e "${YELLOW}[7/7]${NC} Setting up project: $PROJECT_PATH"
        echo ""

        # .claude 폴더 생성
        mkdir -p "$PROJECT_PATH/.claude"

        # 리소스 심볼릭 링크
        setup_project_resource "agents" "$SHARED_DIR/agents" "$PROJECT_PATH/.claude/agents" "dir"
        setup_project_resource "skills" "$SHARED_DIR/skills" "$PROJECT_PATH/.claude/skills" "dir"
        setup_project_resource "scripts" "$SHARED_DIR/scripts" "$PROJECT_PATH/.claude/scripts" "dir"
        [ -d "$SHARED_DIR/standards" ] && setup_project_resource "standards" "$SHARED_DIR/standards" "$PROJECT_PATH/.claude/standards" "dir"
        [ -f "$SHARED_DIR/RULES.md" ] && setup_project_resource "RULES.md" "$SHARED_DIR/RULES.md" "$PROJECT_PATH/.claude/RULES.md" "file"

        # settings.local.json 생성
        PROJECT_SETTINGS="$PROJECT_PATH/.claude/settings.local.json"
        if [ ! -f "$PROJECT_SETTINGS" ]; then
            echo '{}' > "$PROJECT_SETTINGS"
        fi

        if command -v jq &> /dev/null; then
            ALLOW_JSON=$(printf '%s\n' "${MCP_ALLOWED_TOOLS[@]}" | jq -R . | jq -s .)
            UPDATED=$(jq --argjson allow "$ALLOW_JSON" '
                .permissions.allow //= [] |
                .permissions.allow = (.permissions.allow + $allow | unique)
            ' "$PROJECT_SETTINGS")
            echo "$UPDATED" > "$PROJECT_SETTINGS"
            echo -e "       ${GREEN}✓${NC} settings.local.json configured"
        fi

        # CLAUDE.md 심볼릭 링크 (템플릿에서 동기화)
        CLAUDE_TEMPLATE="$SHARED_DIR/templates/CLAUDE.project.md"
        CLAUDE_TARGET="$PROJECT_PATH/CLAUDE.md"

        if [ -L "$CLAUDE_TARGET" ]; then
            # 이미 심볼릭 링크면 최신 템플릿으로 갱신
            rm "$CLAUDE_TARGET"
            ln -s "$CLAUDE_TEMPLATE" "$CLAUDE_TARGET"
            echo -e "       ${GREEN}✓${NC} CLAUDE.md updated (symlink)"
        elif [ -f "$CLAUDE_TARGET" ]; then
            # 기존 파일이 있으면 백업 후 심볼릭 링크
            BACKUP_PATH="${CLAUDE_TARGET}.backup.$(date +%Y%m%d%H%M%S)"
            mv "$CLAUDE_TARGET" "$BACKUP_PATH"
            ln -s "$CLAUDE_TEMPLATE" "$CLAUDE_TARGET"
            echo -e "       ${GREEN}✓${NC} CLAUDE.md → symlink (backup: $(basename $BACKUP_PATH))"
        else
            # 없으면 새로 심볼릭 링크
            ln -s "$CLAUDE_TEMPLATE" "$CLAUDE_TARGET"
            echo -e "       ${GREEN}✓${NC} CLAUDE.md created (symlink)"
        fi

        echo ""
        echo -e "${GREEN}Project setup complete!${NC}"
    fi
else
    echo -e "${GREEN}[7/7]${NC} Global installation complete!"
    echo ""
    echo "To set up a specific project, run:"
    echo -e "  ${CYAN}./install.sh /path/to/your/project${NC}"
fi

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
echo -e "  ${GREEN}✅${NC} playwright (Web E2E)"
echo -e "  ${GREEN}✅${NC} appium-mcp (Mobile App)"
echo -e "  ${GREEN}✅${NC} swagger-mcp (API Spec)"
echo -e "  ${GREEN}✅${NC} figma (UI Design)"
echo -e "  ${GREEN}✅${NC} atlassian (Confluence/Jira)"
echo ""

echo "Usage:"
echo "  - Agents are now available in all Claude Code projects"
echo "  - On session start, agents auto-update via git pull"
if [ -n "$PROJECT_PATH" ]; then
    echo ""
    echo -e "Project: ${CYAN}$PROJECT_PATH${NC}"
    echo "  cd $PROJECT_PATH && claude"
fi
echo ""
echo -e "${YELLOW}⚠️  Please restart Claude Code to use MCP servers${NC}"
echo ""
