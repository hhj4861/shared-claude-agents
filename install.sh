#!/bin/bash
#
# Shared Claude Agents - Install Script
#
# 이 스크립트는 공유 에이전트를 설치하고 SessionStart hook을 설정합니다.
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

echo ""
echo "=========================================="
echo "  Shared Claude Agents Installer"
echo "=========================================="
echo ""

# 1. 현재 위치가 표준 위치가 아니면 복사/이동
if [ "$SCRIPT_DIR" != "$SHARED_DIR" ]; then
    echo -e "${YELLOW}[1/5]${NC} Installing to $SHARED_DIR..."

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
    echo -e "${GREEN}[1/5]${NC} Already in standard location"
fi

# 2. 기존 에이전트 확인 및 보호
echo -e "${YELLOW}[2/5]${NC} Checking existing agents..."

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
echo -e "${YELLOW}[3/5]${NC} Creating symlink..."

ln -s "$SHARED_DIR/agents" "$AGENTS_LINK"
echo -e "       ${GREEN}Linked:${NC} $AGENTS_LINK -> $SHARED_DIR/agents"

# 4. Standards/Skills/Rules 심볼릭 링크 (있으면)
echo -e "${YELLOW}[4/5]${NC} Linking additional resources..."

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
echo -e "${YELLOW}[5/5]${NC} Configuring SessionStart hook..."

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

# 완료
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}================================================${NC}"
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
echo "Project-level setup:"
echo "  ./scripts/init-project.sh <project-name>"
echo ""
