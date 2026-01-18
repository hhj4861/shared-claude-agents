#!/bin/bash
# Session Summary Hook
# Stop: 세션 종료 시 자동 실행
# 오늘 작업 요약 생성

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TODAY=$(date +%Y-%m-%d)
HISTORY_FILE="$PROJECT_DIR/docs/tasks/history/$TODAY.md"

# 히스토리 파일이 있으면 세션 종료 마커 추가
if [ -f "$HISTORY_FILE" ]; then
    echo "" >> "$HISTORY_FILE"
    echo "---" >> "$HISTORY_FILE"
    echo "" >> "$HISTORY_FILE"
    echo "## 세션 종료: $(date +%H:%M:%S)" >> "$HISTORY_FILE"
fi

exit 0
