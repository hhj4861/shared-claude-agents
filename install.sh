#!/bin/bash
#
# Shared Claude Agents - Install Script
#
# 이 스크립트는 공유 에이전트를 설치하고 SessionStart hook을 설정합니다.
#

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 경로 설정
SHARED_DIR="$HOME/.claude/shared-agents"
AGENTS_LINK="$HOME/.claude/agents"
SETTINGS_FILE="$HOME/.claude/settings.json"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "=========================================="
echo "  Shared Claude Agents Installer"
echo "=========================================="
echo ""

# 1. 현재 위치가 표준 위치가 아니면 복사/이동
if [ "$SCRIPT_DIR" != "$SHARED_DIR" ]; then
    echo -e "${YELLOW}[1/4]${NC} Installing to $SHARED_DIR..."

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
    echo -e "${GREEN}[1/4]${NC} Already in standard location"
fi

# 2. Symlink 생성
echo -e "${YELLOW}[2/4]${NC} Creating symlink..."

if [ -L "$AGENTS_LINK" ]; then
    rm "$AGENTS_LINK"
    echo "       Removed existing symlink"
elif [ -d "$AGENTS_LINK" ]; then
    BACKUP_DIR="$AGENTS_LINK.backup.$(date +%Y%m%d%H%M%S)"
    echo -e "       ${YELLOW}Warning:${NC} Existing agents folder found"
    echo "       Backing up to $BACKUP_DIR"
    mv "$AGENTS_LINK" "$BACKUP_DIR"
fi

ln -s "$SHARED_DIR/agents" "$AGENTS_LINK"
echo -e "       ${GREEN}Linked:${NC} $AGENTS_LINK -> $SHARED_DIR/agents"

# 3. SessionStart Hook 설정
echo -e "${YELLOW}[3/4]${NC} Configuring SessionStart hook..."

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

# 4. 완료
echo -e "${YELLOW}[4/4]${NC} Verifying installation..."
echo ""

if [ -L "$AGENTS_LINK" ] && [ -d "$SHARED_DIR/agents" ]; then
    echo -e "${GREEN}Installation complete!${NC}"
    echo ""
    echo "Installed agents:"
    ls -1 "$SHARED_DIR/agents" | while read dir; do
        echo "  - $dir"
    done
    echo ""
    echo "Usage:"
    echo "  - Agents are now available in all Claude Code projects"
    echo "  - On session start, agents auto-update via git pull"
    echo "  - Override in project: .claude/agents/<name>/"
    echo ""
else
    echo -e "${RED}Installation failed. Please check manually.${NC}"
    exit 1
fi
