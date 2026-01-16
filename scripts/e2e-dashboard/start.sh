#!/bin/bash
# E2E Dashboard Auto-Start Script
# Usage: ./start.sh [scenario_path]
#
# 기능:
# 1. 기존 대시보드 프로세스 종료
# 2. 대시보드 서버 시작
# 3. 대시보드 브라우저 창 오픈
# 4. 시나리오 파일 로드 (선택)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3847}"
PORT="${PORT:-3847}"
SCENARIO_PATH="$1"

echo "=== E2E Dashboard Auto-Start ==="

# 1. 기존 프로세스 종료
echo "[1/4] 기존 대시보드 프로세스 확인..."
EXISTING_PID=$(lsof -ti :$PORT 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
  echo "      기존 프로세스 종료 (PID: $EXISTING_PID)"
  kill -9 $EXISTING_PID 2>/dev/null
  sleep 1
fi

# 2. 대시보드 서버 시작 (백그라운드)
echo "[2/4] 대시보드 서버 시작..."
cd "$SCRIPT_DIR"
NO_OPEN=1 node index.js &
DASHBOARD_PID=$!
echo "      서버 시작됨 (PID: $DASHBOARD_PID)"

# 서버 준비 대기
sleep 2

# 3. 대시보드 브라우저 창 오픈
echo "[3/4] 대시보드 브라우저 오픈..."
if [ "$(uname)" == "Darwin" ]; then
  open "$DASHBOARD_URL"
elif [ "$(uname)" == "Linux" ]; then
  xdg-open "$DASHBOARD_URL" 2>/dev/null || echo "      브라우저 수동 오픈 필요: $DASHBOARD_URL"
else
  start "$DASHBOARD_URL" 2>/dev/null || echo "      브라우저 수동 오픈 필요: $DASHBOARD_URL"
fi

# 4. 시나리오 로드 (경로가 제공된 경우)
if [ -n "$SCENARIO_PATH" ] && [ -f "$SCENARIO_PATH" ]; then
  echo "[4/4] 시나리오 로드: $SCENARIO_PATH"
  sleep 1
  RESULT=$(curl -s -X POST "$DASHBOARD_URL/api/load-scenarios" \
    -H "Content-Type: application/json" \
    -d "{\"scenarioPath\":\"$SCENARIO_PATH\"}")

  COUNT=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count', 0))" 2>/dev/null || echo "0")
  echo "      $COUNT 개 시나리오 로드 완료"
else
  echo "[4/4] 시나리오 파일 없음 (나중에 수동 로드)"
fi

echo ""
echo "=== 대시보드 준비 완료 ==="
echo "URL: $DASHBOARD_URL"
echo "PID: $DASHBOARD_PID"
echo ""
