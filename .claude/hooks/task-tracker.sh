#!/bin/bash
# Task Tracker Hook
# PostToolUse: Edit|Write|Task 완료 시 자동 실행
# 작업 기록을 docs/tasks/history/{date}.md에 추가

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TODAY=$(date +%Y-%m-%d)
HISTORY_DIR="$PROJECT_DIR/docs/tasks/history"
HISTORY_FILE="$HISTORY_DIR/$TODAY.md"

# 히스토리 디렉토리 확인
mkdir -p "$HISTORY_DIR"

# 파일이 없으면 헤더 추가
if [ ! -f "$HISTORY_FILE" ]; then
    cat > "$HISTORY_FILE" << EOF
# $TODAY 작업 기록

## 파일 변경 기록

| 시간 | 도구 | 파일 |
|------|------|------|
EOF
fi

# 환경변수에서 정보 추출
TOOL_NAME="${TOOL_NAME:-unknown}"
FILE_PATH="${FILE_PATH:-unknown}"
TIMESTAMP=$(date +%H:%M:%S)

# 기록 추가 (Edit/Write인 경우에만)
if [[ "$TOOL_NAME" == "Edit" || "$TOOL_NAME" == "Write" ]]; then
    echo "| $TIMESTAMP | $TOOL_NAME | \`$FILE_PATH\` |" >> "$HISTORY_FILE"
fi

exit 0
