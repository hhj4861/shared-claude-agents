#!/bin/bash
#
# Quick Install - 최소 설치 (1회만 실행)
#
# 이 스크립트는 SessionStart hook만 설정합니다.
# 실행 후 어떤 프로젝트에서든 Claude를 시작하면 모든 것이 자동으로 설정됩니다.
#
# 사용법:
#   ./quick-install.sh
#
# 설치 후:
#   1. 아무 프로젝트에서 `claude` 실행
#   2. "안녕" 또는 아무 말 입력
#   3. 자동으로 프로젝트 분석 시작
#

set -e

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SHARED_DIR="$HOME/.claude/shared-agents"
SETTINGS_FILE="$HOME/.claude/settings.json"

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Quick Install - 자동 프로젝트 설정${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# 1. shared-agents 심볼릭 링크
echo -e "${YELLOW}[1/2]${NC} Setting up shared-agents link..."

if [ "$SCRIPT_DIR" != "$SHARED_DIR" ]; then
    mkdir -p "$(dirname "$SHARED_DIR")"

    if [ -L "$SHARED_DIR" ]; then
        rm "$SHARED_DIR"
    elif [ -d "$SHARED_DIR" ]; then
        BACKUP_DIR="$SHARED_DIR.backup.$(date +%Y%m%d%H%M%S)"
        mv "$SHARED_DIR" "$BACKUP_DIR"
        echo -e "       Backed up existing to: $BACKUP_DIR"
    fi

    ln -s "$SCRIPT_DIR" "$SHARED_DIR"
    echo -e "       ${GREEN}✓${NC} Linked: $SHARED_DIR → $SCRIPT_DIR"
else
    echo -e "       ${GREEN}✓${NC} Already in standard location"
fi

# 2. SessionStart hook 설정
echo -e "${YELLOW}[2/2]${NC} Configuring SessionStart hook..."

HOOK_COMMAND="bash \"\$HOME/.claude/shared-agents/scripts/auto-project-setup.sh\" 2>/dev/null || true"

# settings.json이 없으면 생성
if [ ! -f "$SETTINGS_FILE" ]; then
    mkdir -p "$(dirname "$SETTINGS_FILE")"
    echo '{}' > "$SETTINGS_FILE"
fi

# jq가 있으면 사용
if command -v jq &> /dev/null; then
    UPDATED=$(jq --arg cmd "$HOOK_COMMAND" '
        .hooks.SessionStart //= [] |
        if (.hooks.SessionStart | map(select(.hooks[0].command == $cmd)) | length) == 0
        then .hooks.SessionStart += [{"hooks": [{"type": "command", "command": $cmd}]}]
        else .
        end
    ' "$SETTINGS_FILE")
    echo "$UPDATED" > "$SETTINGS_FILE"
    echo -e "       ${GREEN}✓${NC} Hook configured"
else
    # jq 없으면 수동 안내
    echo -e "       ${YELLOW}jq not found. Please add manually to $SETTINGS_FILE:${NC}"
    echo ""
    cat << 'EOF'
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "bash \"$HOME/.claude/shared-agents/scripts/auto-project-setup.sh\" 2>/dev/null || true"
      }]
    }]
  }
}
EOF
    echo ""
    exit 1
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  설치 완료!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  이제 ${CYAN}어떤 프로젝트에서든${NC}:"
echo ""
echo -e "    ${GREEN}1.${NC} claude 실행"
echo -e "    ${GREEN}2.${NC} 아무 말이나 입력 (예: \"안녕\")"
echo -e "    ${GREEN}3.${NC} 자동으로 프로젝트 분석 시작"
echo ""
echo -e "  ${YELLOW}참고:${NC} MCP 서버가 필요하면 ./install.sh를 실행하세요."
echo ""
