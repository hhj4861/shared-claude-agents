#!/bin/bash
#
# check-project-context.sh
#
# 세션 시작 시 프로젝트 컨텍스트 존재 여부를 확인합니다.
# 없으면 프로파일링을 권장하는 메시지를 출력합니다.
#

# 현재 디렉토리 기준 프로젝트 컨텍스트 확인
PROJECT_CONTEXT=".claude/project-context.md"
PROJECT_AGENTS=".claude/project-agents"
AGENT_REGISTRY=".claude/agent-registry.json"

# 색상 정의
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# Git 저장소인지 확인 (프로젝트 루트 판단용)
is_project_root() {
    [ -d ".git" ] || [ -f "package.json" ] || [ -f "build.gradle" ] || [ -f "pom.xml" ] || [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || [ -f "go.mod" ] || [ -f "Cargo.toml" ]
}

# 프로젝트 루트가 아니면 종료
if ! is_project_root; then
    exit 0
fi

echo ""

# 프로젝트 컨텍스트 존재 여부 확인
if [ ! -f "$PROJECT_CONTEXT" ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  📋 프로젝트 컨텍스트가 없습니다${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  이 프로젝트를 분석하여 최적화된 환경을 구성할 수 있습니다."
    echo ""
    echo -e "  ${CYAN}다음 명령어로 프로젝트를 분석하세요:${NC}"
    echo -e "    \"프로젝트 분석해줘\""
    echo -e "    또는 /profile"
    echo ""
    echo -e "  ${GREEN}분석하면:${NC}"
    echo -e "    ✓ 프로젝트 목적/방향성 이해"
    echo -e "    ✓ 기술 스택 및 도메인 파악"
    echo -e "    ✓ 맞춤형 서브에이전트 자동 생성"
    echo ""
else
    # 컨텍스트 존재 시 간단한 상태 표시
    LAST_ANALYZED=$(grep -m1 "마지막 분석" "$PROJECT_CONTEXT" 2>/dev/null | sed 's/.*: //')

    if [ -n "$LAST_ANALYZED" ]; then
        echo -e "${GREEN}✓ 프로젝트 컨텍스트 로드됨${NC} (분석: $LAST_ANALYZED)"
    else
        echo -e "${GREEN}✓ 프로젝트 컨텍스트 로드됨${NC}"
    fi

    # 동적 에이전트 수 표시
    if [ -d "$PROJECT_AGENTS" ]; then
        AGENT_COUNT=$(ls -1 "$PROJECT_AGENTS"/*.md 2>/dev/null | wc -l | tr -d ' ')
        if [ "$AGENT_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓ 프로젝트 전용 에이전트: ${AGENT_COUNT}개${NC}"
        fi
    fi

    # 진행중인 계획 확인
    if [ -d "docs/plans" ]; then
        ACTIVE_PLANS=$(grep -l "🔄 진행중" docs/plans/*.md 2>/dev/null | wc -l | tr -d ' ')
        if [ "$ACTIVE_PLANS" -gt 0 ]; then
            echo -e "${YELLOW}📋 진행중인 구현 계획: ${ACTIVE_PLANS}개${NC}"
            echo -e "   \"계획 상태 보여줘\"로 확인하세요"
        fi
    fi

    echo ""
fi
