#!/bin/bash
# Session Summary Hook
# Stop hook으로 세션 종료 시 작업 요약 및 학습 내용 저장

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TASKS_DIR="$PROJECT_DIR/docs/tasks"
HISTORY_DIR="$TASKS_DIR/history"
LEARNED_CONTEXT="$PROJECT_DIR/.claude/learned-context.md"
LEARNED_TEMPLATE="$HOME/.claude/shared-agents/templates/learned-context.template.md"
TODAY=$(date +%Y-%m-%d)
NOW=$(date +"%Y-%m-%d %H:%M")
HISTORY_FILE="$HISTORY_DIR/$TODAY.md"

# 1. 오늘 히스토리가 있으면 요약 추가
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

# 2. learned-context.md 초기화 (없으면 템플릿에서 생성)
if [ ! -f "$LEARNED_CONTEXT" ] && [ -f "$LEARNED_TEMPLATE" ]; then
  mkdir -p "$(dirname "$LEARNED_CONTEXT")"
  cp "$LEARNED_TEMPLATE" "$LEARNED_CONTEXT"
  # 생성일 설정
  sed -i '' "s/{생성일}/$NOW/" "$LEARNED_CONTEXT" 2>/dev/null || \
  sed -i "s/{생성일}/$NOW/" "$LEARNED_CONTEXT" 2>/dev/null
fi

# 3. learned-context.md 메타데이터 업데이트
if [ -f "$LEARNED_CONTEXT" ]; then
  # last_updated 업데이트
  sed -i '' "s/last_updated:.*/last_updated: \"$NOW\"/" "$LEARNED_CONTEXT" 2>/dev/null || \
  sed -i "s/last_updated:.*/last_updated: \"$NOW\"/" "$LEARNED_CONTEXT" 2>/dev/null

  # session_count 증가
  if grep -q "session_count:" "$LEARNED_CONTEXT" 2>/dev/null; then
    CURRENT_COUNT=$(grep "session_count:" "$LEARNED_CONTEXT" | grep -o '[0-9]*' | head -1)
    NEW_COUNT=$((CURRENT_COUNT + 1))
    sed -i '' "s/session_count:.*/session_count: $NEW_COUNT/" "$LEARNED_CONTEXT" 2>/dev/null || \
    sed -i "s/session_count:.*/session_count: $NEW_COUNT/" "$LEARNED_CONTEXT" 2>/dev/null
  fi
fi

# 4. 세션 종료 알림 출력 (Claude가 읽을 수 있도록)
if [ -f "$LEARNED_CONTEXT" ]; then
  echo ""
  echo "📚 세션 종료 - 학습 내용을 저장하려면:"
  echo "   다음 세션에서 'session-learner' 에이전트가 자동으로 처리합니다."
  echo ""
fi

exit 0
