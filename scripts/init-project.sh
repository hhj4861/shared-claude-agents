#!/bin/bash
#
# init-project.sh - Deprecated, use install.sh instead
#
# 이 스크립트는 install.sh로 통합되었습니다.
# 호환성을 위해 install.sh를 호출합니다.
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INSTALL_SCRIPT="$SCRIPT_DIR/../install.sh"

if [ -z "$1" ]; then
    echo "Usage: $0 <project-path>"
    echo ""
    echo "Note: This script is deprecated. Use install.sh instead:"
    echo "  ./install.sh /path/to/project"
    exit 1
fi

echo "Note: init-project.sh is deprecated. Calling install.sh..."
echo ""

exec "$INSTALL_SCRIPT" "$1"
