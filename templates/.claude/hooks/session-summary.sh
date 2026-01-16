#!/bin/bash
# Session Summary Hook
# Stop hook으로 세션 종료 시 작업 요약 생성

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TASKS_DIR="$PROJECT_DIR/docs/tasks"
HISTORY_DIR="$TASKS_DIR/history"
TODAY=$(date +%Y-%m-%d)
HISTORY_FILE="$HISTORY_DIR/$TODAY.md"

# 오늘 히스토리가 있으면 요약 추가
if [ -f "$HISTORY_FILE" ]; then
  # 이미 요약이 있는지 확인
  if ! grep -q "## 세션 요약" "$HISTORY_FILE" 2>/dev/null; then
    # 작업 수 카운트
    EDIT_COUNT=$(grep -c "파일 수정:" "$HISTORY_FILE" 2>/dev/null || echo "0")

    if [ "$EDIT_COUNT" -gt 0 ]; then
      echo "" >> "$HISTORY_FILE"
      echo "---" >> "$HISTORY_FILE"
      echo "## 세션 요약" >> "$HISTORY_FILE"
      echo "- 파일 수정: ${EDIT_COUNT}건" >> "$HISTORY_FILE"
    fi
  fi
fi

exit 0
