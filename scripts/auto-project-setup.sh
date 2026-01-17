#!/bin/bash
#
# auto-project-setup.sh
#
# 글로벌 SessionStart hook에서 실행됩니다.
# 어떤 프로젝트에서든 Claude를 시작하면 자동으로:
# 1. shared-agents 최신화 (git pull)
# 2. 프로젝트 감지
# 3. 공통 가이드 심볼릭 링크 (RULES.md, standards/ 만)
# 4. 프로젝트 컨텍스트 상태 안내
#
# [v2 아키텍처]
# - agents/: 최적화 생성 (심볼릭 링크 X) → agent-generator가 처리
# - skills/: 최적화 생성 (심볼릭 링크 X) → agent-generator가 처리
# - RULES.md, standards/: 심볼릭 링크 (공통 불변)
#
# 사용법:
#   auto-project-setup.sh           # 기본 모드 (기존 설정 유지)
#   auto-project-setup.sh --merge   # 병합 모드 (기존 설정과 병합 + 에이전트 최적화)
#

SHARED_DIR="$HOME/.claude/shared-agents"
CURRENT_DIR="$(pwd)"

# 색상 정의
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

# 플래그 파싱
MERGE_MODE=false
for arg in "$@"; do
    case $arg in
        --merge)
            MERGE_MODE=true
            shift
            ;;
    esac
done

# 1. shared-agents 최신화
cd "$SHARED_DIR" && git pull -q 2>/dev/null || true
cd "$CURRENT_DIR"

# 프로젝트 루트인지 확인 (빌드 파일 존재 여부)
is_project_root() {
    [ -d ".git" ] || \
    [ -f "package.json" ] || \
    [ -f "build.gradle" ] || \
    [ -f "build.gradle.kts" ] || \
    [ -f "pom.xml" ] || \
    [ -f "requirements.txt" ] || \
    [ -f "pyproject.toml" ] || \
    [ -f "go.mod" ] || \
    [ -f "Cargo.toml" ] || \
    [ -f "Gemfile" ] || \
    [ -f "composer.json" ]
}

# shared-agents 디렉토리가 있는지 확인
if [ ! -d "$SHARED_DIR" ]; then
    exit 0
fi

# 프로젝트 루트가 아니면 종료
if ! is_project_root; then
    exit 0
fi

# shared-agents 자체에서는 실행 안 함
if [[ "$CURRENT_DIR" == "$SHARED_DIR"* ]]; then
    exit 0
fi

# 2. .claude 디렉토리 자동 생성 및 심볼릭 링크 설정
setup_symlink() {
    local name=$1
    local source=$2
    local target=$3

    if [ -L "$target" ]; then
        # 심볼릭 링크가 유효한지 확인 (대상이 존재하는지)
        if [ -e "$target" ]; then
            # 유효한 링크면 패스
            return 0
        else
            # 유효하지 않은 링크 (broken symlink) → 삭제 후 새로 만들기
            rm "$target" 2>/dev/null
        fi
    elif [ -e "$target" ]; then
        # 실제 파일/폴더면 패스 (사용자 커스텀 존중)
        return 0
    fi

    # 소스가 존재하면 심볼릭 링크 생성
    if [ -e "$source" ]; then
        ln -s "$source" "$target" 2>/dev/null
    fi
}

# settings.json 병합 함수
merge_settings() {
    local template="$SHARED_DIR/templates/.claude/settings.json"
    local target=".claude/settings.json"

    if [ ! -f "$template" ]; then
        return 0
    fi

    if [ ! -f "$target" ]; then
        cp "$template" "$target"
        echo -e "  ${GREEN}✓${NC} settings.json 생성됨"
        return 0
    fi

    # jq가 있으면 병합
    if command -v jq &> /dev/null; then
        # permissions.allow 병합
        local template_perms=$(jq -r '.permissions.allow // []' "$template" 2>/dev/null)
        local target_perms=$(jq -r '.permissions.allow // []' "$target" 2>/dev/null)

        # 병합된 설정 생성
        local merged=$(jq -s '
            .[0] as $template | .[1] as $target |
            $target * {
                permissions: {
                    allow: (($target.permissions.allow // []) + ($template.permissions.allow // []) | unique)
                }
            }
        ' "$template" "$target")

        echo "$merged" > "$target"
        echo -e "  ${GREEN}✓${NC} settings.json 병합됨 (permissions.allow 추가)"
    else
        echo -e "  ${YELLOW}⚠️${NC} jq 없음 - settings.json 수동 병합 필요"
    fi
}

# .claude 디렉토리가 없으면 생성
if [ ! -d ".claude" ]; then
    mkdir -p ".claude"
fi

# 필수 디렉토리 생성
mkdir -p ".claude/agents" 2>/dev/null      # 최적화 생성될 에이전트용
mkdir -p ".claude/skills" 2>/dev/null      # 최적화 생성될 스킬용
mkdir -p ".claude/project-agents" 2>/dev/null  # 도메인 전문 에이전트용
mkdir -p "docs/plans" 2>/dev/null

# [v2] 공통 가이드만 심볼릭 링크 (불변 컨텐츠)
# agents, skills는 최적화 생성되므로 링크하지 않음
setup_symlink "standards" "$SHARED_DIR/standards" ".claude/standards"
setup_symlink "RULES.md" "$SHARED_DIR/RULES.md" ".claude/RULES.md"

# scripts는 유틸리티이므로 링크 유지
setup_symlink "scripts" "$SHARED_DIR/scripts" ".claude/scripts"

# hooks 디렉토리 설정 (없으면 복사)
HOOKS_TEMPLATE="$SHARED_DIR/templates/.claude/hooks"
if [ -d "$HOOKS_TEMPLATE" ] && [ ! -d ".claude/hooks" ]; then
    mkdir -p ".claude/hooks"
    cp -r "$HOOKS_TEMPLATE"/* ".claude/hooks/" 2>/dev/null
    chmod +x ".claude/hooks"/*.sh 2>/dev/null || true
fi

# settings.json 처리
SETTINGS_TEMPLATE="$SHARED_DIR/templates/.claude/settings.json"
if [ "$MERGE_MODE" = true ]; then
    # 병합 모드: 기존 설정과 병합
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  🔄 병합 모드${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    merge_settings
else
    # 기본 모드: 없으면 복사
    if [ -f "$SETTINGS_TEMPLATE" ] && [ ! -f ".claude/settings.json" ]; then
        cp "$SETTINGS_TEMPLATE" ".claude/settings.json"
    fi
fi

# CLAUDE.md 심볼릭 링크 (없으면)
CLAUDE_TEMPLATE="$SHARED_DIR/templates/CLAUDE.project.md"
if [ -f "$CLAUDE_TEMPLATE" ] && [ ! -f "CLAUDE.md" ] && [ ! -L "CLAUDE.md" ]; then
    ln -s "$CLAUDE_TEMPLATE" "CLAUDE.md" 2>/dev/null
fi

# 병합 모드일 때 에이전트 최적화 안내
if [ "$MERGE_MODE" = true ]; then
    echo ""
    echo -e "  ${GREEN}✓${NC} 기본 설정 병합 완료"
    echo ""
    echo -e "  ${YELLOW}📋 에이전트 최적화를 진행하려면:${NC}"
    echo -e "     Claude 세션에서 ${CYAN}\"에이전트 최적화해줘\"${NC} 라고 말씀하세요."
    echo ""
    echo -e "  ${GREEN}최적화 내용:${NC}"
    echo -e "    ✓ 기존 에이전트와 새 에이전트 비교"
    echo -e "    ✓ 중복 에이전트 병합"
    echo -e "    ✓ 에이전트 그룹핑 (도메인/역할별)"
    echo -e "    ✓ agent-registry.json 생성"
    echo ""
    exit 0
fi

# 3. 프로젝트 컨텍스트 상태 출력 (기본 모드)
echo ""

PROJECT_CONTEXT=".claude/project-context.md"
PROJECT_AGENTS=".claude/project-agents"

if [ ! -f "$PROJECT_CONTEXT" ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  📋 프로젝트 컨텍스트가 없습니다${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  이 프로젝트를 분석하면 맞춤형 환경이 구성됩니다."
    echo ""
    echo -e "  ${CYAN}\"프로젝트 분석해줘\"${NC} 라고 말씀하세요."
    echo ""
    echo -e "  ${GREEN}분석하면:${NC}"
    echo -e "    ✓ 프로젝트 목적/방향성 이해"
    echo -e "    ✓ 기술 스택 및 도메인 파악"
    echo -e "    ✓ 프로젝트 맞춤 에이전트 최적화 생성"
    echo -e "    ✓ 연관 스킬 최적화 생성"
    echo ""
else
    # 컨텍스트 존재 시
    LAST_ANALYZED=$(grep -m1 "마지막 분석" "$PROJECT_CONTEXT" 2>/dev/null | sed 's/.*: //' | head -1)

    if [ -n "$LAST_ANALYZED" ]; then
        echo -e "${GREEN}✓ 프로젝트 컨텍스트 로드됨${NC} (분석: $LAST_ANALYZED)"
    else
        echo -e "${GREEN}✓ 프로젝트 컨텍스트 로드됨${NC}"
    fi

    # 최적화된 에이전트 수 표시
    OPTIMIZED_AGENTS=".claude/agents"
    if [ -d "$OPTIMIZED_AGENTS" ]; then
        AGENT_COUNT=$(find "$OPTIMIZED_AGENTS" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$AGENT_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓ 최적화된 에이전트: ${AGENT_COUNT}개${NC}"
        fi
    fi

    # 최적화된 스킬 수 표시
    OPTIMIZED_SKILLS=".claude/skills"
    if [ -d "$OPTIMIZED_SKILLS" ]; then
        SKILL_COUNT=$(find "$OPTIMIZED_SKILLS" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        if [ "$SKILL_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓ 최적화된 스킬: ${SKILL_COUNT}개${NC}"
        fi
    fi

    # 도메인 전문 에이전트 수 표시
    if [ -d "$PROJECT_AGENTS" ]; then
        DOMAIN_AGENT_COUNT=$(ls -1 "$PROJECT_AGENTS"/*.md 2>/dev/null | wc -l | tr -d ' ')
        if [ "$DOMAIN_AGENT_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓ 도메인 전문 에이전트: ${DOMAIN_AGENT_COUNT}개${NC}"
        fi
    fi

    # 진행중인 계획 확인
    if [ -d "docs/plans" ]; then
        ACTIVE_PLANS=$(grep -l "🔄 진행중" docs/plans/*.md 2>/dev/null | wc -l | tr -d ' ')
        if [ "$ACTIVE_PLANS" -gt 0 ]; then
            echo -e "${YELLOW}📋 진행중인 구현 계획: ${ACTIVE_PLANS}개${NC}"
            # 계획 파일명 표시
            for plan in $(grep -l "🔄 진행중" docs/plans/*.md 2>/dev/null | head -3); do
                plan_name=$(basename "$plan" .md | sed 's/^[0-9-]*//')
                echo -e "   - $plan_name"
            done
        fi
    fi

    echo ""
fi
