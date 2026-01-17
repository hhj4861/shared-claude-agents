#!/bin/bash
#
# Shared Claude Agents - Install Script (Modular Version)
#
# 이 스크립트는 글로벌 설치만 하면 됩니다.
# 설치 후 어떤 프로젝트에서든 Claude를 시작하면 자동으로:
#   1. 프로젝트 감지 및 설정 (.claude/, 심볼릭 링크 등)
#   2. 프로젝트 분석 및 컨텍스트 생성
#   3. 맞춤형 서브에이전트 동적 생성
#
# 사용법:
#   ./install.sh                    # 글로벌 설치 (이것만 하면 됨!)
#   ./install.sh /path/to/project   # (선택) 특정 프로젝트 미리 설정
#

set -e

# =============================================================================
# 설정 변수 (Configuration)
# =============================================================================
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly NC='\033[0m'

readonly SHARED_DIR="${SHARED_AGENTS_DIR:-$HOME/.claude/shared-agents}"
readonly AGENTS_LINK="$HOME/.claude/agents"
readonly SETTINGS_FILE="$HOME/.claude/settings.json"
readonly SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
readonly MCP_SERVERS_DIR="$SCRIPT_DIR/mcp-servers"

PROJECT_PATH="$1"
BUILD_MCP=false

# 자동 승인 도구 목록
MCP_ALLOWED_TOOLS=(
    "Read" "Write" "Edit(docs/qa/**)" "WebFetch" "Task"
    "mcp__qa-pipeline__*" "mcp__doc-converter__*" "mcp__puppeteer-browser__*"
    "mcp__atlassian__*" "mcp__playwright__*" "mcp__appium-mcp__*"
    "mcp__swagger-mcp__*" "mcp__figma__*"
    "Skill(e2e-test:*)" "Skill(api-test:*)" "Skill(qa-scenario:*)"
    "Bash(node:*)" "Bash(npm:*)" "Bash(npx:*)" "Bash(git status:*)"
    "Bash(git diff:*)" "Bash(ls:*)" "Bash(pwd)" "Bash(find:*)"
    "Bash(mkdir:*)" "Bash(cat:*)" "Bash(cat >:*)" "Bash(chmod:*)"
    "Bash(gemini:*)" "Bash(claude-code task:*)" "Bash(mcp task:*)"
    "Bash(*/e2e-dashboard/start.sh:*)" "Bash(*/e2e-dashboard/sync.sh:*)"
    "Bash(./sync.sh:*)" "Bash(SYNC=*)" "Bash(\$SYNC:*)"
    "Bash(curl:*)" "Bash(python3:*)"
    "Bash(lsof:*)" "Bash(pkill:*)" "Bash(xargs kill -9)"
)

# =============================================================================
# 유틸리티 함수 (Utility Functions)
# =============================================================================

log_step() {
    local step=$1
    local total=$2
    local message=$3
    echo -e "${YELLOW}[$step/$total]${NC} $message"
}

log_success() {
    echo -e "       ${GREEN}$1${NC}"
}

log_warning() {
    echo -e "       ${YELLOW}$1${NC}"
}

log_error() {
    echo -e "       ${RED}$1${NC}"
}

create_symlink() {
    local source=$1
    local target=$2
    local name=$3

    if [ -L "$target" ]; then
        rm "$target"
    elif [ -e "$target" ]; then
        local backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
        mv "$target" "$backup"
        log_warning "Backed up: $(basename $backup)"
    fi
    ln -s "$source" "$target"
    log_success "✓ $name → Symlink"
}

# =============================================================================
# Step 0: Node.js 버전 확인
# =============================================================================
check_nodejs() {
    log_step 0 7 "Checking Node.js version..."

    if ! command -v node &> /dev/null; then
        log_warning "Warning: Node.js not found. MCP servers will not be built."
        log_warning "Install Node.js 18+ to use MCP servers: https://nodejs.org/"
        BUILD_MCP=false
    else
        local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            log_warning "Warning: Node.js 18+ required for MCP servers. (current: $(node -v))"
            BUILD_MCP=false
        else
            log_success "Node.js $(node -v) found"
            BUILD_MCP=true
        fi
    fi
    echo ""
}

# =============================================================================
# Step 1: 표준 위치 링크
# =============================================================================
link_to_standard_location() {
    if [ "$SCRIPT_DIR" != "$SHARED_DIR" ]; then
        log_step 1 7 "Linking to $SHARED_DIR..."

        if [ -L "$SHARED_DIR" ]; then
            echo "       Removing existing symlink..."
            rm "$SHARED_DIR"
        elif [ -d "$SHARED_DIR" ]; then
            local backup="$SHARED_DIR.backup.$(date +%Y%m%d%H%M%S)"
            echo "       Backing up existing to $backup"
            mv "$SHARED_DIR" "$backup"
        fi

        mkdir -p "$(dirname "$SHARED_DIR")"
        ln -s "$SCRIPT_DIR" "$SHARED_DIR"
        log_success "Linked: $SHARED_DIR -> $SCRIPT_DIR"
    else
        echo -e "${GREEN}[1/7]${NC} Already in standard location"
    fi
}

# =============================================================================
# Step 2: 기존 에이전트 확인 및 처리
# =============================================================================
handle_existing_agents() {
    log_step 2 7 "Checking existing agents..."

    if [ -d "$AGENTS_LINK" ] && [ ! -L "$AGENTS_LINK" ]; then
        log_warning "Warning: Existing agents folder found at $AGENTS_LINK"
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
                local backup="$AGENTS_LINK.backup.$(date +%Y%m%d%H%M%S)"
                echo -e "       Backing up existing to $backup"
                mv "$AGENTS_LINK" "$backup"
                ;;
            2)
                echo -e "       Merging agents..."
                for dir in "$SHARED_DIR/agents"/*/; do
                    local dirname=$(basename "$dir")
                    if [ -d "$AGENTS_LINK/$dirname" ]; then
                        log_warning "Skipping $dirname (already exists)"
                    else
                        cp -r "$dir" "$AGENTS_LINK/"
                        log_success "Added $dirname"
                    fi
                done
                log_success "Merge complete"
                echo ""
                echo "       Note: Shared agents were added to existing folder."
                echo "       Auto-update hook will NOT be configured for merged setup."
                exit 0
                ;;
            3)
                log_warning "Skipping agent installation"
                exit 0
                ;;
            *)
                log_error "Invalid option. Aborting."
                exit 1
                ;;
        esac
    elif [ -L "$AGENTS_LINK" ]; then
        echo "       Existing symlink found. Removing..."
        rm "$AGENTS_LINK"
    fi

    log_success "Done"
}

# =============================================================================
# Step 3: 에이전트 심볼릭 링크 생성
# =============================================================================
create_agents_symlink() {
    log_step 3 7 "Creating symlink..."
    ln -s "$SHARED_DIR/agents" "$AGENTS_LINK"
    log_success "Linked: $AGENTS_LINK -> $SHARED_DIR/agents"
}

# =============================================================================
# Step 4: 추가 리소스 링크 (standards, skills, rules, scripts)
# =============================================================================
link_additional_resources() {
    log_step 4 7 "Linking additional resources..."

    # Standards
    if [ -d "$SHARED_DIR/standards" ]; then
        [ -L "$HOME/.claude/standards" ] && rm "$HOME/.claude/standards"
        [ ! -d "$HOME/.claude/standards" ] && {
            ln -s "$SHARED_DIR/standards" "$HOME/.claude/standards"
            log_success "Linked: standards"
        }
    fi

    # Skills
    if [ -d "$SHARED_DIR/skills" ]; then
        [ -L "$HOME/.claude/skills" ] && rm "$HOME/.claude/skills"
        [ ! -d "$HOME/.claude/skills" ] && {
            ln -s "$SHARED_DIR/skills" "$HOME/.claude/skills"
            log_success "Linked: skills"
        }
    fi

    # Rules
    if [ -f "$SHARED_DIR/RULES.md" ]; then
        [ -L "$HOME/.claude/RULES.md" ] && rm "$HOME/.claude/RULES.md"
        [ ! -f "$HOME/.claude/RULES.md" ] && {
            ln -s "$SHARED_DIR/RULES.md" "$HOME/.claude/RULES.md"
            log_success "Linked: RULES.md"
        }
    fi

    # Scripts
    if [ -d "$SHARED_DIR/scripts" ]; then
        [ -L "$HOME/.claude/scripts" ] && rm "$HOME/.claude/scripts"
        if [ ! -d "$HOME/.claude/scripts" ]; then
            ln -s "$SHARED_DIR/scripts" "$HOME/.claude/scripts"
            log_success "Linked: scripts"
            install_script_dependencies
        fi
    fi

    log_success "Done"
}

install_script_dependencies() {
    if [ "$BUILD_MCP" = true ]; then
        # qa-input-form
        if [ -d "$SHARED_DIR/scripts/qa-input-form" ]; then
            echo -e "       Installing qa-input-form dependencies..."
            (cd "$SHARED_DIR/scripts/qa-input-form" && npm install --silent 2>/dev/null || npm install)
            log_success "✅ qa-input-form ready"
        fi

        # e2e-dashboard
        if [ -d "$SHARED_DIR/scripts/e2e-dashboard" ]; then
            echo -e "       Installing e2e-dashboard dependencies..."
            (cd "$SHARED_DIR/scripts/e2e-dashboard" && npm install --silent 2>/dev/null || npm install)
            log_success "✅ e2e-dashboard ready"
        fi
    fi
}

# =============================================================================
# Step 5: SessionStart Hook 및 MCP 권한 설정
# =============================================================================
configure_hooks_and_permissions() {
    log_step 5 7 "Configuring SessionStart hook and MCP permissions..."

    local hook_command="bash \"\$HOME/.claude/shared-agents/scripts/auto-project-setup.sh\" 2>/dev/null || true"

    # settings.json 생성
    [ ! -f "$SETTINGS_FILE" ] && echo '{}' > "$SETTINGS_FILE"

    if command -v jq &> /dev/null; then
        configure_with_jq "$hook_command"
    else
        show_manual_config "$hook_command"
    fi
}

configure_with_jq() {
    local hook_command=$1

    # Hook 설정
    local updated=$(jq --arg cmd "$hook_command" '
        .hooks.SessionStart //= [] |
        if (.hooks.SessionStart | map(select(.hooks[0].command == $cmd)) | length) == 0
        then .hooks.SessionStart += [{"hooks": [{"type": "command", "command": $cmd}]}]
        else .
        end
    ' "$SETTINGS_FILE")
    echo "$updated" > "$SETTINGS_FILE"
    log_success "Hook configured"

    # 권한 설정
    local allow_json=$(printf '%s\n' "${MCP_ALLOWED_TOOLS[@]}" | jq -R . | jq -s .)
    updated=$(jq --argjson allow "$allow_json" '
        .permissions.allow //= [] |
        .permissions.allow = (.permissions.allow + $allow | unique)
    ' "$SETTINGS_FILE")
    echo "$updated" > "$SETTINGS_FILE"
    log_success "MCP permissions configured (auto-approve enabled)"
}

show_manual_config() {
    local hook_command=$1
    log_warning "jq not found. Please add manually to $SETTINGS_FILE:"
    echo ""
    echo '  "permissions": { "allow": ['
    for tool in "${MCP_ALLOWED_TOOLS[@]}"; do
        echo "    \"$tool\","
    done
    echo '  ]},'
    echo '  "hooks": { "SessionStart": [{ "hooks": [{ "type": "command",'
    echo "    \"command\": \"$hook_command\""
    echo '  }]}]}'
}

# =============================================================================
# Step 6: MCP 서버 빌드 및 등록
# =============================================================================
build_and_register_mcp_servers() {
    log_step 6 7 "Building MCP servers..."

    if [ "$BUILD_MCP" = true ] && [ -d "$MCP_SERVERS_DIR" ]; then
        build_local_mcp_servers
        register_external_mcp_servers
    else
        if [ "$BUILD_MCP" = false ]; then
            log_warning "⚠️  Skipped (Node.js 18+ required)"
        else
            log_warning "⚠️  No MCP servers found"
        fi
    fi
    echo ""
}

build_local_mcp_servers() {
    local servers_built=()

    for server_dir in "$MCP_SERVERS_DIR"/*/; do
        [ ! -d "$server_dir" ] && continue

        local server_name=$(basename "$server_dir")
        [ ! -f "$server_dir/package.json" ] && continue

        echo -e "       📦 Building $server_name..."
        (cd "$server_dir" && npm install --silent 2>/dev/null || npm install)
        (cd "$server_dir" && npm run build --silent 2>/dev/null || npm run build)

        if [ -f "$server_dir/dist/index.js" ]; then
            log_success "✅ $server_name built successfully"
            servers_built+=("$server_name")
        else
            log_error "❌ $server_name build failed"
        fi
    done

    # 빌드된 서버 등록
    if [ ${#servers_built[@]} -gt 0 ] && command -v claude &> /dev/null; then
        echo ""
        echo -e "       Registering MCP servers with Claude Code..."
        for server_name in "${servers_built[@]}"; do
            local server_path="$SHARED_DIR/mcp-servers/$server_name/dist/index.js"
            claude mcp remove -s user "$server_name" 2>/dev/null || true
            if claude mcp add -s user "$server_name" node "$server_path" 2>/dev/null; then
                log_success "✅ $server_name registered"
            else
                log_warning "⚠️  $server_name registration failed"
            fi
        done
    fi
}

register_external_mcp_servers() {
    echo ""
    echo -e "       Registering external MCP servers..."

    if ! command -v claude &> /dev/null; then
        log_warning "⚠️  'claude' command not found. Please register manually."
        return
    fi

    # Playwright
    register_mcp_server "playwright" "npx @playwright/mcp@latest" "Web E2E testing"

    # Appium
    register_mcp_server "appium-mcp" "-- npx -y appium-mcp@latest" "Mobile app testing"

    # Swagger
    register_mcp_server "swagger-mcp" "-- npx -y @anthropic-community/swagger-mcp-server" "API spec analysis"

    # Figma
    register_mcp_server "figma" "-- npx -y figma-developer-mcp --stdio" "UI design"

    # Atlassian (SSE transport)
    claude mcp remove -s user atlassian 2>/dev/null || true
    if claude mcp add -s user --transport sse atlassian https://mcp.atlassian.com/v1/sse 2>/dev/null; then
        log_success "✅ atlassian registered (Confluence/Jira)"
        log_warning "📌 OAuth 인증 필요: Claude Code 재시작 후 /mcp → atlassian 선택하여 인증"
    else
        log_warning "⚠️  atlassian registration failed"
    fi
}

register_mcp_server() {
    local name=$1
    local command=$2
    local description=$3

    claude mcp remove -s user "$name" 2>/dev/null || true
    if claude mcp add -s user $name $command 2>/dev/null; then
        log_success "✅ $name registered ($description)"
    else
        log_warning "⚠️  $name registration failed"
    fi
}

# =============================================================================
# Step 7: 프로젝트 설정 (선택)
# =============================================================================
setup_project() {
    if [ -z "$PROJECT_PATH" ]; then
        echo -e "${GREEN}[7/7]${NC} Skipped (no project path provided)"
        return
    fi

    # 절대 경로 변환
    [[ "$PROJECT_PATH" != /* ]] && PROJECT_PATH="$(pwd)/$PROJECT_PATH"

    # 프로젝트 폴더 확인
    if [ ! -d "$PROJECT_PATH" ]; then
        log_warning "Warning: $PROJECT_PATH does not exist"
        read -p "Create the folder? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            mkdir -p "$PROJECT_PATH"
            log_success "Created: $PROJECT_PATH"
        else
            log_error "Skipping project setup."
            return
        fi
    fi

    log_step 7 7 "(선택) Pre-setting project: $PROJECT_PATH"
    echo ""

    setup_project_directories
    setup_project_symlinks
    setup_project_hooks
    setup_project_settings
    setup_project_claude_md

    echo ""
    echo -e "${GREEN}Pre-setup complete for: $PROJECT_PATH${NC}"
    echo -e "  (참고: 이 설정 없이도 자동으로 됩니다)"
    echo ""
}

setup_project_directories() {
    mkdir -p "$PROJECT_PATH/.claude"
    mkdir -p "$PROJECT_PATH/.claude/project-agents"
    log_success "✓ project-agents directory created"

    mkdir -p "$PROJECT_PATH/docs/plans"
    log_success "✓ docs/plans directory created"
}

setup_project_symlinks() {
    create_symlink "$SHARED_DIR/agents" "$PROJECT_PATH/.claude/agents" "agents"
    create_symlink "$SHARED_DIR/skills" "$PROJECT_PATH/.claude/skills" "skills"
    create_symlink "$SHARED_DIR/scripts" "$PROJECT_PATH/.claude/scripts" "scripts"
    [ -d "$SHARED_DIR/standards" ] && create_symlink "$SHARED_DIR/standards" "$PROJECT_PATH/.claude/standards" "standards"
    [ -f "$SHARED_DIR/RULES.md" ] && create_symlink "$SHARED_DIR/RULES.md" "$PROJECT_PATH/.claude/RULES.md" "RULES.md"
}

setup_project_hooks() {
    local hooks_template="$SHARED_DIR/templates/.claude/hooks"
    if [ -d "$hooks_template" ]; then
        mkdir -p "$PROJECT_PATH/.claude/hooks"
        cp -r "$hooks_template"/* "$PROJECT_PATH/.claude/hooks/"
        chmod +x "$PROJECT_PATH/.claude/hooks"/*.sh 2>/dev/null || true
        log_success "✓ hooks configured (auto-profiling + task-tracker)"
    fi
}

setup_project_settings() {
    local project_settings="$PROJECT_PATH/.claude/settings.json"
    local hooks_settings="$SHARED_DIR/templates/.claude/settings.json"

    if [ -f "$hooks_settings" ]; then
        if [ ! -f "$project_settings" ]; then
            cp "$hooks_settings" "$project_settings"
            log_success "✓ settings.json created with hooks"
        elif command -v jq &> /dev/null; then
            local merged=$(jq -s '.[0] * .[1]' "$project_settings" "$hooks_settings")
            echo "$merged" > "$project_settings"
            log_success "✓ settings.json merged with hooks"
        fi
    fi

    # settings.local.json (MCP 권한)
    local local_settings="$PROJECT_PATH/.claude/settings.local.json"
    [ ! -f "$local_settings" ] && echo '{}' > "$local_settings"

    if command -v jq &> /dev/null; then
        local allow_json=$(printf '%s\n' "${MCP_ALLOWED_TOOLS[@]}" | jq -R . | jq -s .)
        local updated=$(jq --argjson allow "$allow_json" '
            .permissions.allow //= [] |
            .permissions.allow = (.permissions.allow + $allow | unique)
        ' "$local_settings")
        echo "$updated" > "$local_settings"
        log_success "✓ settings.local.json configured"
    fi
}

setup_project_claude_md() {
    local template="$SHARED_DIR/templates/CLAUDE.project.md"
    local target="$PROJECT_PATH/CLAUDE.md"

    if [ -L "$target" ]; then
        rm "$target"
        ln -s "$template" "$target"
        log_success "✓ CLAUDE.md updated (symlink)"
    elif [ -f "$target" ]; then
        local backup="${target}.backup.$(date +%Y%m%d%H%M%S)"
        mv "$target" "$backup"
        ln -s "$template" "$target"
        log_success "✓ CLAUDE.md → symlink (backup: $(basename $backup))"
    else
        ln -s "$template" "$target"
        log_success "✓ CLAUDE.md created (symlink)"
    fi
}

# =============================================================================
# 설치 완료 요약
# =============================================================================
print_summary() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  자동 프로젝트 설정 활성화됨${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  이제 ${GREEN}어떤 프로젝트에서든${NC} Claude를 시작하면:"
    echo ""
    echo -e "    ${GREEN}1.${NC} 자동으로 프로젝트 감지"
    echo -e "    ${GREEN}2.${NC} 필요한 설정 자동 생성 (.claude/, 심볼릭 링크 등)"
    echo -e "    ${GREEN}3.${NC} 프로젝트 컨텍스트 없으면 자동 분석 시작"
    echo -e "    ${GREEN}4.${NC} 맞춤형 서브에이전트 자동 생성"
    echo ""
    echo -e "  ${YELLOW}프로젝트별 install.sh 실행이 필요 없습니다!${NC}"
    echo ""
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  Installation complete!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""

    print_installed_agents
    print_mcp_servers
    print_usage_info
}

print_installed_agents() {
    echo "Installed agents:"
    ls -1 "$SHARED_DIR/agents" 2>/dev/null | while read dir; do
        echo "  - $dir"
    done
    echo ""
}

print_mcp_servers() {
    echo "Installed MCP servers:"

    if [ -d "$SHARED_DIR/mcp-servers" ]; then
        for server_dir in "$SHARED_DIR/mcp-servers"/*/; do
            [ ! -d "$server_dir" ] && continue
            local server_name=$(basename "$server_dir")
            if [ -f "$server_dir/dist/index.js" ]; then
                echo -e "  ${GREEN}✅${NC} $server_name (local)"
            else
                echo -e "  ${YELLOW}⚠️${NC}  $server_name (not built)"
            fi
        done
    fi

    echo -e "  ${GREEN}✅${NC} playwright (Web E2E)"
    echo -e "  ${GREEN}✅${NC} appium-mcp (Mobile App)"
    echo -e "  ${GREEN}✅${NC} swagger-mcp (API Spec)"
    echo -e "  ${GREEN}✅${NC} figma (UI Design)"
    echo -e "  ${GREEN}✅${NC} atlassian (Confluence/Jira)"
    echo ""
}

print_usage_info() {
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
}

# =============================================================================
# 메인 함수
# =============================================================================
main() {
    echo ""
    echo "=========================================="
    echo "  Shared Claude Agents Installer"
    echo "=========================================="
    echo ""

    check_nodejs
    link_to_standard_location
    handle_existing_agents
    create_agents_symlink
    link_additional_resources
    configure_hooks_and_permissions
    build_and_register_mcp_servers
    setup_project
    print_summary
}

# 스크립트 실행
main "$@"
