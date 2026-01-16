#!/bin/bash
# E2E Dashboard Sync Helper
# Usage:
#   ./sync.sh start <tcId> <name>
#   ./sync.sh step <tcId> <stepIndex> <status> [message]
#   ./sync.sh complete <tcId> <status> [message] [videoPath]

DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3847}"

# 상태값 정규화: pass->passed, fail->failed
normalize_status() {
  case "$1" in
    pass) echo "passed" ;;
    fail) echo "failed" ;;
    *) echo "$1" ;;
  esac
}

case "$1" in
  start)
    curl -s -X POST "$DASHBOARD_URL/api/tc/start" \
      -H "Content-Type: application/json" \
      -d "{\"tcId\":\"$2\",\"name\":\"$3\"}"
    ;;
  step)
    STATUS=$(normalize_status "$4")
    curl -s -X POST "$DASHBOARD_URL/api/tc/step" \
      -H "Content-Type: application/json" \
      -d "{\"tcId\":\"$2\",\"stepIndex\":$3,\"status\":\"$STATUS\",\"message\":\"$5\"}"
    ;;
  complete)
    STATUS=$(normalize_status "$3")
    VIDEO_PATH="$5"
    if [ -n "$VIDEO_PATH" ]; then
      curl -s -X POST "$DASHBOARD_URL/api/tc/complete" \
        -H "Content-Type: application/json" \
        -d "{\"tcId\":\"$2\",\"status\":\"$STATUS\",\"message\":\"$4\",\"videoPath\":\"$VIDEO_PATH\"}"
    else
      curl -s -X POST "$DASHBOARD_URL/api/tc/complete" \
        -H "Content-Type: application/json" \
        -d "{\"tcId\":\"$2\",\"status\":\"$STATUS\",\"message\":\"$4\"}"
    fi
    ;;
  reset)
    curl -s -X POST "$DASHBOARD_URL/api/reset"
    ;;
  summary)
    # 전체 요약 및 미진행 TC 조회
    curl -s "$DASHBOARD_URL/api/summary" | jq '{
      total, passed, failed, pending_hold, skip, waiting,
      passRate,
      nextWaitingTC: .nextWaitingTC.tcId,
      waitingCount: (.waitingTCs | length),
      waitingTCs: [.waitingTCs[0:5][] | "\(.tcId): \(.name)"]
    }'
    ;;
  waiting)
    # 미진행 TC 목록만 조회
    curl -s "$DASHBOARD_URL/api/summary" | jq -r '.waitingTCs[] | "\(.tcId)\t\(.name)"'
    ;;
  next)
    # 다음 미진행 TC 조회
    curl -s "$DASHBOARD_URL/api/summary" | jq -r '.nextWaitingTC | "\(.tcId): \(.name)"'
    ;;
  pending)
    # 보류 TC 목록 조회
    curl -s "$DASHBOARD_URL/api/summary" | jq -r '.pendingTCs[] | "\(.tcId)\t\(.message)"'
    ;;
  skip)
    # Skip(건너뜀) TC 목록 조회
    curl -s "$DASHBOARD_URL/api/summary" | jq -r '.skipTCs[] | "\(.tcId)\t\(.name)"'
    ;;
  incomplete)
    # 미완료 TC 전체 조회 (pending + skip + waiting)
    echo "=== 보류 (pending) ==="
    curl -s "$DASHBOARD_URL/api/summary" | jq -r '.pendingTCs[] | "  \(.tcId): \(.message)"'
    echo ""
    echo "=== 건너뜀 (skip) ==="
    curl -s "$DASHBOARD_URL/api/summary" | jq -r '.skipTCs[] | "  \(.tcId): \(.name)"'
    echo ""
    echo "=== 미진행 (waiting) ==="
    curl -s "$DASHBOARD_URL/api/summary" | jq -r '.waitingTCs[] | "  \(.tcId): \(.name)"'
    ;;
  *)
    echo "Usage: $0 {start|step|complete|reset|summary|waiting|next|pending|skip|incomplete} [args...]"
    echo ""
    echo "Commands:"
    echo "  start <tcId> [name]      - TC 시작"
    echo "  step <tcId> <idx> <status> [msg] - 스텝 완료"
    echo "  complete <tcId> <status> [msg] [videoPath] - TC 완료"
    echo "  reset                    - 상태 초기화"
    echo "  summary                  - 전체 요약"
    echo "  waiting                  - 미진행 TC 목록"
    echo "  next                     - 다음 미진행 TC"
    echo "  pending                  - 보류(hold) TC 목록"
    echo "  skip                     - 건너뜀(skip) TC 목록"
    echo "  incomplete               - 미완료 TC 전체 (pending+skip+waiting)"
    exit 1
    ;;
esac
