#!/bin/bash
# Parallel Insight Tracker Hook
# 메인 에이전트와 병렬로 실행되어 이슈/수정사항을 수집하고 에이전트 최적화 제안

# 백그라운드에서 실행 (메인 작업 차단 방지)
{
  # 환경 변수
  PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
  INSIGHT_DIR="$PROJECT_DIR/.claude/insight-tracker"
  TODAY=$(date +%Y-%m-%d)
  NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # 디렉토리 생성
  mkdir -p "$INSIGHT_DIR/issues" "$INSIGHT_DIR/routing" "$INSIGHT_DIR/analysis" "$INSIGHT_DIR/suggestions"

  # stdin에서 hook 데이터 읽기
  INPUT=$(cat)

  # jq 존재 확인
  if ! command -v jq &> /dev/null; then
    exit 0
  fi

  # JSON 파싱
  TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
  TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input // {}')
  TOOL_RESULT=$(echo "$INPUT" | jq -r '.tool_result // empty' 2>/dev/null | head -c 2000)

  # 이슈 키워드 패턴
  ISSUE_KEYWORDS="error|에러|오류|버그|bug|fix|수정|타임아웃|timeout|slow|느림|문제|issue|exception|fail|failed"

  # 기술 스택 감지 패턴
  TECH_PATTERNS="redis|postgres|mysql|mongodb|nextjs|react|vue|fastapi|django|spring|docker|kubernetes|k8s|aws|gcp"

  # 이슈 파일 경로
  ISSUES_FILE="$INSIGHT_DIR/issues/$TODAY.json"
  ROUTING_FILE="$INSIGHT_DIR/routing/$TODAY.json"
  ANALYSIS_FILE="$INSIGHT_DIR/analysis/$TODAY.json"
  SUGGESTIONS_FILE="$INSIGHT_DIR/suggestions/$TODAY.json"
  SUMMARY_FILE="$INSIGHT_DIR/summary.md"
  PENDING_FILE="$INSIGHT_DIR/pending-optimizations.json"

  # issues 파일 초기화
  init_issues_file() {
    if [ ! -f "$ISSUES_FILE" ]; then
      echo '{"date":"'"$TODAY"'","issues":[]}' > "$ISSUES_FILE"
    fi
  }

  # routing 파일 초기화
  init_routing_file() {
    if [ ! -f "$ROUTING_FILE" ]; then
      echo '{"date":"'"$TODAY"'","routingDecisions":[]}' > "$ROUTING_FILE"
    fi
  }

  # 이슈 감지 및 추가
  detect_and_add_issue() {
    local file_path=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty')
    local command=$(echo "$TOOL_INPUT" | jq -r '.command // empty')
    local content="$TOOL_RESULT"

    # 이슈 키워드 검사
    if echo "$content $file_path $command" | grep -iE "$ISSUE_KEYWORDS" > /dev/null 2>&1; then
      # 기술 스택 감지
      local tech_stack=""
      for tech in $(echo "$TECH_PATTERNS" | tr '|' '\n'); do
        if echo "$content $file_path $command" | grep -i "$tech" > /dev/null 2>&1; then
          if [ -z "$tech_stack" ]; then
            tech_stack="\"$tech\""
          else
            tech_stack="$tech_stack,\"$tech\""
          fi
        fi
      done
      [ -z "$tech_stack" ] && tech_stack='"general"'

      # 도메인 추론
      local domain="general"
      if echo "$file_path" | grep -E "(api|backend|server|service)" > /dev/null 2>&1; then
        domain="backend"
      elif echo "$file_path" | grep -E "(frontend|ui|component|page)" > /dev/null 2>&1; then
        domain="frontend"
      elif echo "$file_path" | grep -E "(infra|deploy|docker|k8s)" > /dev/null 2>&1; then
        domain="infrastructure"
      elif echo "$file_path" | grep -E "(test|spec|e2e)" > /dev/null 2>&1; then
        domain="qa"
      fi

      # 이슈 유형 추론
      local issue_type="unknown"
      if echo "$content" | grep -iE "bug|버그|오류|error" > /dev/null 2>&1; then
        issue_type="bug"
      elif echo "$content" | grep -iE "timeout|타임아웃|slow|느림|성능" > /dev/null 2>&1; then
        issue_type="performance"
      elif echo "$content" | grep -iE "config|설정|env|환경" > /dev/null 2>&1; then
        issue_type="configuration"
      elif echo "$content" | grep -iE "refactor|리팩토링|구조|architecture" > /dev/null 2>&1; then
        issue_type="architecture"
      fi

      # 이슈 ID 생성
      local issue_count=$(jq '.issues | length' "$ISSUES_FILE" 2>/dev/null || echo "0")
      local issue_id=$(printf "ISS-%03d" $((issue_count + 1)))

      # 요약 생성 (첫 100자)
      local summary=$(echo "$content" | head -c 100 | tr '\n' ' ' | sed 's/"/\\"/g')

      # 이슈 추가
      local new_issue=$(cat << EOJSON
{
  "id": "$issue_id",
  "timestamp": "$NOW",
  "type": "$issue_type",
  "severity": "medium",
  "domain": "$domain",
  "techStack": [$tech_stack],
  "summary": "$summary",
  "details": {
    "tool": "$TOOL_NAME",
    "filePath": "$file_path",
    "command": "$command"
  }
}
EOJSON
)

      # JSON 파일에 추가
      local temp_file=$(mktemp)
      jq --argjson newIssue "$new_issue" '.issues += [$newIssue]' "$ISSUES_FILE" > "$temp_file" && mv "$temp_file" "$ISSUES_FILE"

      # 라우팅 분석 호출
      analyze_routing "$issue_id" "$domain" "$tech_stack"
    fi
  }

  # 라우팅 분석
  analyze_routing() {
    local issue_id="$1"
    local domain="$2"
    local tech_stack="$3"

    init_routing_file

    # agent-registry.json 참조 시도
    local registry_file="$PROJECT_DIR/.claude/agent-registry.json"

    # 도메인별 기본 에이전트 매핑
    local candidate_agent=""
    local match_score=0.7

    case "$domain" in
      "backend")
        candidate_agent="backend-dev"
        match_score=0.85
        ;;
      "frontend")
        candidate_agent="frontend-dev"
        match_score=0.85
        ;;
      "infrastructure")
        candidate_agent="devops-specialist"
        match_score=0.80
        ;;
      "qa")
        candidate_agent="qa-director"
        match_score=0.80
        ;;
      *)
        candidate_agent="dev-lead"
        match_score=0.60
        ;;
    esac

    # 라우팅 결정 추가
    local routing_decision=$(cat << EOJSON
{
  "issueId": "$issue_id",
  "analysis": {
    "domain": "$domain",
    "techStack": [$tech_stack]
  },
  "selectedAgent": "$candidate_agent",
  "matchScore": $match_score,
  "confidence": "medium",
  "timestamp": "$NOW"
}
EOJSON
)

    local temp_file=$(mktemp)
    jq --argjson decision "$routing_decision" '.routingDecisions += [$decision]' "$ROUTING_FILE" > "$temp_file" && mv "$temp_file" "$ROUTING_FILE"

    # 에이전트 반영 여부 확인
    check_agent_reflection "$issue_id" "$candidate_agent" "$domain" "$tech_stack"
  }

  # 에이전트 반영 여부 확인
  check_agent_reflection() {
    local issue_id="$1"
    local agent_name="$2"
    local domain="$3"
    local tech_stack="$4"

    # analysis 파일 초기화
    if [ ! -f "$ANALYSIS_FILE" ]; then
      echo '{"date":"'"$TODAY"'","analyses":[]}' > "$ANALYSIS_FILE"
    fi

    # 에이전트 파일 찾기
    local agent_file=""
    for search_path in \
      "$PROJECT_DIR/.claude/agents"/*/"$agent_name.md" \
      "$PROJECT_DIR/.claude/project-agents/$agent_name.md" \
      "$PROJECT_DIR/agents"/*/"$agent_name.md"; do
      if [ -f "$search_path" ]; then
        agent_file="$search_path"
        break
      fi
    done

    # SHARED_AGENTS_PATH 환경변수에서도 찾기
    if [ -z "$agent_file" ] && [ -n "$SHARED_AGENTS_PATH" ]; then
      for search_path in "$SHARED_AGENTS_PATH/agents"/*/"$agent_name.md"; do
        if [ -f "$search_path" ]; then
          agent_file="$search_path"
          break
        fi
      done
    fi

    local reflection_status="unknown"
    local reason="에이전트 파일을 찾을 수 없음"
    local recommendation=""

    if [ -n "$agent_file" ] && [ -f "$agent_file" ]; then
      # 에이전트 파일에서 tech_stack 키워드 검색
      local tech_found=false
      for tech in $(echo "$tech_stack" | tr -d '[]"' | tr ',' '\n'); do
        if grep -i "$tech" "$agent_file" > /dev/null 2>&1; then
          tech_found=true
          break
        fi
      done

      if [ "$tech_found" = true ]; then
        reflection_status="reflected"
        reason="에이전트에 해당 기술 스택 관련 지침 존재"
      else
        reflection_status="not_reflected"
        reason="에이전트에 해당 기술 스택 관련 지침 없음"
        recommendation="해당 기술 스택 관련 지침 추가 필요"

        # 최적화 제안 생성
        generate_suggestion "$issue_id" "$agent_name" "$agent_file" "$tech_stack" "$domain"
      fi
    else
      reflection_status="not_reflected"
      reason="담당 에이전트 없음"
      recommendation="도메인 전문 에이전트 생성 검토"
    fi

    # 분석 결과 추가
    local analysis=$(cat << EOJSON
{
  "issueId": "$issue_id",
  "agentName": "$agent_name",
  "agentFile": "$agent_file",
  "reflectionStatus": "$reflection_status",
  "reason": "$reason",
  "recommendation": "$recommendation",
  "timestamp": "$NOW"
}
EOJSON
)

    local temp_file=$(mktemp)
    jq --argjson analysis "$analysis" '.analyses += [$analysis]' "$ANALYSIS_FILE" > "$temp_file" && mv "$temp_file" "$ANALYSIS_FILE"
  }

  # 최적화 제안 생성
  generate_suggestion() {
    local issue_id="$1"
    local agent_name="$2"
    local agent_file="$3"
    local tech_stack="$4"
    local domain="$5"

    # suggestions 파일 초기화
    if [ ! -f "$SUGGESTIONS_FILE" ]; then
      echo '{"date":"'"$TODAY"'","suggestions":[]}' > "$SUGGESTIONS_FILE"
    fi

    # 제안 ID 생성
    local sug_count=$(jq '.suggestions | length' "$SUGGESTIONS_FILE" 2>/dev/null || echo "0")
    local sug_id=$(printf "SUG-%03d" $((sug_count + 1)))

    # 기술 스택 이름 정리
    local tech_name=$(echo "$tech_stack" | tr -d '[]"' | tr ',' ' ' | head -c 20)

    local suggestion=$(cat << EOJSON
{
  "id": "$sug_id",
  "issueId": "$issue_id",
  "type": "agent_update",
  "priority": "medium",
  "target": {
    "agent": "$agent_name",
    "file": "$agent_file"
  },
  "suggestion": {
    "action": "add_section",
    "description": "$tech_name 관련 지침 추가 필요",
    "domain": "$domain"
  },
  "status": "pending",
  "createdAt": "$NOW"
}
EOJSON
)

    local temp_file=$(mktemp)
    jq --argjson sug "$suggestion" '.suggestions += [$sug]' "$SUGGESTIONS_FILE" > "$temp_file" && mv "$temp_file" "$SUGGESTIONS_FILE"

    # pending-optimizations.json 업데이트
    update_pending_optimizations "$sug_id" "$suggestion"
  }

  # pending-optimizations.json 업데이트
  update_pending_optimizations() {
    local sug_id="$1"
    local suggestion="$2"

    if [ ! -f "$PENDING_FILE" ]; then
      echo '{"pendingOptimizations":[]}' > "$PENDING_FILE"
    fi

    local temp_file=$(mktemp)
    jq --argjson sug "$suggestion" '.pendingOptimizations += [$sug]' "$PENDING_FILE" > "$temp_file" && mv "$temp_file" "$PENDING_FILE"
  }

  # 일일 요약 업데이트
  update_summary() {
    local issue_count=$(jq '.issues | length' "$ISSUES_FILE" 2>/dev/null || echo "0")
    local sug_count=$(jq '.suggestions | length' "$SUGGESTIONS_FILE" 2>/dev/null || echo "0")

    cat > "$SUMMARY_FILE" << EOSUMMARY
# Insight Tracker 일일 요약

> 날짜: $TODAY
> 마지막 업데이트: $NOW
> 수집된 이슈: $issue_count건
> 최적화 제안: $sug_count건

---

## 오늘 발견된 이슈

$(jq -r '.issues[] | "### \(.id): \(.summary)\n- **도메인**: \(.domain)\n- **기술 스택**: \(.techStack | join(", "))\n- **유형**: \(.type)\n"' "$ISSUES_FILE" 2>/dev/null || echo "(없음)")

---

## 최적화 제안

$(jq -r '.suggestions[] | "### \(.id): \(.suggestion.description)\n- **대상 에이전트**: \(.target.agent)\n- **우선순위**: \(.priority)\n- **상태**: \(.status)\n"' "$SUGGESTIONS_FILE" 2>/dev/null || echo "(없음)")

---

## 적용 방법

\`\`\`bash
# 특정 제안 적용
"에이전트 최적화 적용해줘 SUG-001"

# 모든 대기 중인 최적화 적용
"대기 중인 최적화 모두 적용해줘"
\`\`\`
EOSUMMARY
  }

  # 메인 로직
  init_issues_file

  case "$TOOL_NAME" in
    "Edit"|"Write"|"Bash")
      detect_and_add_issue
      update_summary
      ;;
    *)
      # 다른 도구는 무시
      ;;
  esac

} &

# 즉시 성공 반환 (백그라운드 실행이므로)
exit 0
