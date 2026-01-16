#!/bin/bash
# Task Tracker Hook
# PostToolUse hook으로 작업 완료 시 자동으로 TODO/CHANGELOG 업데이트

set -e

# 프로젝트 루트
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
TASKS_DIR="$PROJECT_DIR/docs/tasks"
TODO_FILE="$TASKS_DIR/TODO.md"
CHANGELOG_FILE="$TASKS_DIR/CHANGELOG.md"
HISTORY_DIR="$TASKS_DIR/history"
TODAY=$(date +%Y-%m-%d)
NOW=$(date "+%Y-%m-%d %H:%M")

# stdin에서 hook 데이터 읽기
INPUT=$(cat)

# JSON 파싱 (jq 필요)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
TOOL_RESULT=$(echo "$INPUT" | jq -r '.tool_result // empty')

# 디렉토리 생성
mkdir -p "$TASKS_DIR" "$HISTORY_DIR"

# TODO.md 초기화 (없으면 생성)
init_todo() {
  if [ ! -f "$TODO_FILE" ]; then
    cat > "$TODO_FILE" << 'EOF'
# TODO

> 마지막 업데이트: ${NOW}

## 진행중

(없음)

## 대기

(없음)

## 완료 (최근)

(없음)
EOF
  fi
}

# CHANGELOG.md 초기화 (없으면 생성)
init_changelog() {
  if [ ! -f "$CHANGELOG_FILE" ]; then
    cat > "$CHANGELOG_FILE" << 'EOF'
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

### Changed

### Fixed

EOF
  fi
}

# 히스토리에 기록
log_history() {
  local action="$1"
  local detail="$2"
  local history_file="$HISTORY_DIR/$TODAY.md"

  if [ ! -f "$history_file" ]; then
    echo "# $TODAY 작업 기록" > "$history_file"
    echo "" >> "$history_file"
  fi

  echo "- [$NOW] $action: $detail" >> "$history_file"
}

# Edit/Write 도구 처리
handle_edit_write() {
  local file_path=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

  if [ -n "$file_path" ]; then
    # 상대 경로로 변환
    local rel_path="${file_path#$PROJECT_DIR/}"
    log_history "파일 수정" "$rel_path"
  fi
}

# 메인 로직
case "$TOOL_NAME" in
  "Edit"|"Write")
    init_changelog
    handle_edit_write
    ;;
  *)
    # 다른 도구는 무시
    ;;
esac

exit 0
