#!/bin/bash
# Parallel Insight Tracker Hook
# PostToolUse: Edit|Write|Bash|Task 완료 시 백그라운드 실행
# 이슈 패턴 감지 및 에이전트 최적화 제안

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
INSIGHT_DIR="$PROJECT_DIR/.claude/insights"
TODAY=$(date +%Y-%m-%d)
INSIGHT_FILE="$INSIGHT_DIR/$TODAY.json"

# 백그라운드에서 실행
{
    mkdir -p "$INSIGHT_DIR"

    # 환경변수에서 정보 추출
    TOOL_NAME="${TOOL_NAME:-unknown}"
    TOOL_OUTPUT="${TOOL_OUTPUT:-}"

    # 이슈 패턴 감지 키워드
    ERROR_PATTERNS="error|Error|ERROR|exception|Exception|failed|Failed|FAILED"
    WARNING_PATTERNS="warning|Warning|WARNING|deprecated|Deprecated"

    # 출력에서 이슈 감지
    if echo "$TOOL_OUTPUT" | grep -qE "$ERROR_PATTERNS"; then
        ISSUE_TYPE="error"
    elif echo "$TOOL_OUTPUT" | grep -qE "$WARNING_PATTERNS"; then
        ISSUE_TYPE="warning"
    else
        ISSUE_TYPE="none"
    fi

    # 이슈가 있으면 기록
    if [ "$ISSUE_TYPE" != "none" ]; then
        TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

        # JSON 형식으로 기록 (append)
        if [ ! -f "$INSIGHT_FILE" ]; then
            echo '{"insights":[]}' > "$INSIGHT_FILE"
        fi

        # 간단한 로그 파일에 추가
        echo "[$TIMESTAMP] $ISSUE_TYPE: $TOOL_NAME" >> "$INSIGHT_DIR/issues.log"
    fi
} &

exit 0
