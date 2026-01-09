#!/bin/bash
#
# Shared Claude Agents - MCP Server Update Script
#
# 모든 Claude 계정에 MCP 서버를 등록합니다.
# install.sh 전체를 실행하지 않고 MCP 서버만 재빌드하고 등록할 때 사용하세요.
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 경로 설정
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$HOME/.claude/shared-agents"
MCP_SERVERS_DIR="$SHARED_DIR/mcp-servers"

echo ""
echo "=========================================="
echo "  MCP Server Update (All Accounts)"
echo "=========================================="
echo ""

# -----------------------------------------------------------------------------
# Step 1: 소스 동기화
# -----------------------------------------------------------------------------
if [ "$SCRIPT_DIR" != "$SHARED_DIR" ]; then
    echo -e "${YELLOW}[1/4]${NC} Syncing to $SHARED_DIR..."

    if [ -d "$SHARED_DIR" ]; then
        rsync -av --delete "$SCRIPT_DIR/mcp-servers/" "$SHARED_DIR/mcp-servers/" 2>/dev/null || \
            cp -r "$SCRIPT_DIR/mcp-servers/"* "$SHARED_DIR/mcp-servers/"
        rsync -av --delete "$SCRIPT_DIR/agents/" "$SHARED_DIR/agents/" 2>/dev/null || \
            cp -r "$SCRIPT_DIR/agents/"* "$SHARED_DIR/agents/"
        if [ -d "$SCRIPT_DIR/scripts" ]; then
            rsync -av --delete "$SCRIPT_DIR/scripts/" "$SHARED_DIR/scripts/" 2>/dev/null || \
                cp -r "$SCRIPT_DIR/scripts/"* "$SHARED_DIR/scripts/"
        fi
        echo -e "       ${GREEN}Synced${NC}"
    else
        echo -e "       ${RED}Error: $SHARED_DIR not found. Run install.sh first.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}[1/4]${NC} Already in shared-agents location"
fi

# -----------------------------------------------------------------------------
# Step 2: Node.js 확인
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[2/4]${NC} Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo -e "       ${RED}Error: Node.js not found${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "       ${RED}Error: Node.js 18+ required (current: $(node -v))${NC}"
    exit 1
fi
echo -e "       ${GREEN}Node.js $(node -v)${NC}"

# -----------------------------------------------------------------------------
# Step 3: MCP 서버 빌드
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[3/4]${NC} Building MCP servers..."

MCP_SERVERS_BUILT=()

for server_dir in "$MCP_SERVERS_DIR"/*/; do
    if [ -d "$server_dir" ] && [ -f "$server_dir/package.json" ]; then
        server_name=$(basename "$server_dir")
        echo -e "       Building $server_name..."

        cd "$server_dir"
        if [ ! -d "node_modules" ]; then
            npm install --silent 2>/dev/null || npm install
        fi
        npm run build --silent 2>/dev/null || npm run build
        cd "$SCRIPT_DIR"

        if [ -f "$server_dir/dist/index.js" ]; then
            echo -e "       ${GREEN}  ✅ $server_name${NC}"
            MCP_SERVERS_BUILT+=("$server_name")
        else
            echo -e "       ${RED}  ❌ $server_name (build failed)${NC}"
        fi
    fi
done

# -----------------------------------------------------------------------------
# Step 4: 모든 계정에 MCP 등록
# -----------------------------------------------------------------------------
echo -e "${YELLOW}[4/4]${NC} Registering MCP servers to all accounts..."

# 모든 Claude 계정 폴더 찾기
CLAUDE_ACCOUNTS=()
for dir in "$HOME"/.claude-*/; do
    if [ -d "$dir" ] && [ -f "$dir/.claude.json" ]; then
        CLAUDE_ACCOUNTS+=("$dir")
    fi
done

# 기본 .claude 폴더도 체크 (설정 파일이 있으면)
if [ -f "$HOME/.claude.json" ]; then
    # 전역 설정 파일
    GLOBAL_CONFIG="$HOME/.claude.json"
fi

echo ""
echo "       Found accounts:"
for account_dir in "${CLAUDE_ACCOUNTS[@]}"; do
    account_name=$(basename "$account_dir")
    echo -e "         - $account_name"
done
if [ -n "$GLOBAL_CONFIG" ]; then
    echo -e "         - global (~/.claude.json)"
fi
echo ""

# jq 확인
if ! command -v jq &> /dev/null; then
    echo -e "       ${RED}Error: jq is required. Install with: brew install jq${NC}"
    exit 1
fi

# MCP 서버 JSON 생성 함수
generate_mcp_json() {
    local mcp_json='{'
    local first=true

    # 로컬 MCP 서버
    for server_name in "${MCP_SERVERS_BUILT[@]}"; do
        SERVER_PATH="$SHARED_DIR/mcp-servers/$server_name/dist/index.js"
        if [ "$first" = true ]; then
            first=false
        else
            mcp_json+=','
        fi
        mcp_json+="\"$server_name\":{\"type\":\"stdio\",\"command\":\"node\",\"args\":[\"$SERVER_PATH\"],\"env\":{}}"
    done

    # External MCP 서버
    # playwright
    [ "$first" = false ] && mcp_json+=',' || first=false
    mcp_json+='"playwright":{"type":"stdio","command":"npx","args":["@playwright/mcp@latest"],"env":{}}'

    # appium-mcp
    mcp_json+=',"appium-mcp":{"type":"stdio","command":"npx","args":["-y","appium-mcp@latest"],"env":{}}'

    # swagger-mcp
    mcp_json+=',"swagger-mcp":{"type":"stdio","command":"npx","args":["-y","@anthropic-community/swagger-mcp-server"],"env":{}}'

    # figma
    mcp_json+=',"figma":{"type":"stdio","command":"npx","args":["-y","figma-developer-mcp","--stdio"],"env":{}}'

    # atlassian (SSE)
    mcp_json+=',"atlassian":{"type":"sse","url":"https://mcp.atlassian.com/v1/sse"}'

    mcp_json+='}'
    echo "$mcp_json"
}

MCP_JSON=$(generate_mcp_json)

# 각 계정 설정 파일에 MCP 추가
for account_dir in "${CLAUDE_ACCOUNTS[@]}"; do
    account_name=$(basename "$account_dir")
    config_file="$account_dir/.claude.json"

    if [ -f "$config_file" ]; then
        echo -e "       Updating $account_name..."

        # 기존 mcpServers를 새 것으로 교체 (최상위 레벨)
        UPDATED=$(jq --argjson mcp "$MCP_JSON" '.mcpServers = $mcp' "$config_file")
        echo "$UPDATED" > "$config_file"

        echo -e "       ${GREEN}  ✅ $account_name${NC}"
    fi
done

# 전역 설정 파일도 업데이트 (있으면)
if [ -n "$GLOBAL_CONFIG" ] && [ -f "$GLOBAL_CONFIG" ]; then
    echo -e "       Updating global config..."
    UPDATED=$(jq --argjson mcp "$MCP_JSON" '.mcpServers = $mcp' "$GLOBAL_CONFIG")
    echo "$UPDATED" > "$GLOBAL_CONFIG"
    echo -e "       ${GREEN}  ✅ global${NC}"
fi

# -----------------------------------------------------------------------------
# 완료
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=========================================="
echo -e "  Update complete!"
echo -e "==========================================${NC}"
echo ""
echo "Registered MCP servers:"
echo ""
echo "  [Local]"
for server_name in "${MCP_SERVERS_BUILT[@]}"; do
    echo -e "    ${GREEN}✅${NC} $server_name"
done
echo ""
echo "  [External]"
echo -e "    ${GREEN}✅${NC} playwright (Web E2E)"
echo -e "    ${GREEN}✅${NC} appium-mcp (Mobile App)"
echo -e "    ${GREEN}✅${NC} swagger-mcp (API Spec)"
echo -e "    ${GREEN}✅${NC} figma (UI Design)"
echo -e "    ${GREEN}✅${NC} atlassian (Confluence/Jira)"
echo ""
echo "Updated accounts:"
for account_dir in "${CLAUDE_ACCOUNTS[@]}"; do
    account_name=$(basename "$account_dir")
    echo -e "    ${GREEN}✅${NC} $account_name"
done
if [ -n "$GLOBAL_CONFIG" ]; then
    echo -e "    ${GREEN}✅${NC} global"
fi
echo ""
echo -e "${YELLOW}⚠️  Please restart Claude Code to apply changes${NC}"
echo ""
