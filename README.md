# Shared Claude Agents

팀 내 공통으로 사용하는 Claude Code 에이전트, 스킬, 표준 문서를 관리하는 저장소입니다.

## 구조

```
shared-claude-agents/
├── agents/                    # 에이전트 정의
│   ├── architecture/          # 아키텍처팀
│   │   └── architect-director.md  # 아키텍트 리드
│   ├── development/           # 개발팀
│   │   ├── dev-director.md    # 개발팀 리드
│   │   ├── frontend-dev.md    # 프론트엔드 개발자
│   │   ├── backend-dev.md     # 백엔드 개발자
│   │   └── tech-architect.md  # 기술 아키텍트
│   ├── qa/                    # QA팀
│   │   ├── qa-director.md     # QA 디렉터 (파이프라인 총괄)
│   │   ├── step1-doc-collector.md     # 문서 수집
│   │   ├── step1.5-project-detector.md # 프로젝트 구조 분석
│   │   ├── step2-code-analyzer.md     # 코드 분석
│   │   ├── step3-scenario-writer.md   # 시나리오 작성
│   │   ├── step3.5-scenario-reviewer.md # 시나리오 검토 (Gemini)
│   │   ├── step3.6-scenario-refiner.md  # 시나리오 보완
│   │   └── step4-backend-tester.md    # 백엔드 테스터
│   ├── demo/                  # 데모팀
│   │   ├── demo-recorder.md           # 시연 영상 생성
│   │   └── demo-script-generator.md   # 녹화 스크립트 생성
│   ├── maintenance/           # 유지보수
│   │   ├── setup/             # 설정 관련
│   │   │   ├── project-profiler.md    # 프로젝트 심층 분석
│   │   │   └── project-initializer.md # 프로젝트 초기화
│   │   ├── agents/            # 에이전트 관리
│   │   │   ├── agent-generator.md     # 동적 에이전트 생성
│   │   │   └── agent-optimizer.md     # 에이전트 최적화
│   │   ├── tracking/          # 추적 관련
│   │   │   ├── task-tracker.md        # 작업 완료/TODO 추적
│   │   │   ├── parallel-insight-tracker.md # 인사이트 추적
│   │   │   └── session-learner.md     # 세션 학습 자동 저장
│   │   ├── conventions/       # 컨벤션 관련
│   │   │   └── code-convention-guide.md # 코드 컨벤션 가이드
│   │   └── tools/             # 유틸리티
│   │       ├── implementation-planner.md # 구현 계획 수립
│   │       ├── config-synchronizer.md # 설정 파일 동기화
│   │       ├── workflow-validator.md  # 워크플로우 검증
│   │       └── todo-summarizer.md     # TODO 요약
│   └── devops/                # DevOps팀
│       └── devops-director.md # DevOps 디렉터
│
├── mcp-servers/               # MCP 서버
│   ├── qa-pipeline/           # QA 파이프라인 MCP
│   │   └── src/index.ts       # 분석/시나리오 생성 도구
│   └── doc-converter/         # 문서 변환 MCP
│       └── src/index.ts       # PDF/이미지→마크다운 변환
│
├── standards/                 # 표준 문서
│   ├── development/           # 개발 표준
│   ├── architecture/          # 아키텍처 표준
│   ├── qa/                    # QA 표준
│   └── devops/                # DevOps 표준
│
├── skills/                    # 스킬 정의
│   ├── qa-scenario/           # QA 시나리오 생성
│   ├── api-test/              # API 테스트 실행
│   ├── e2e-test/              # E2E 테스트 실행
│   ├── commit/                # Git 커밋
│   └── review-pr/             # PR 리뷰
│
├── scripts/                   # 유틸리티 스크립트
│   ├── e2e-dashboard/         # E2E 테스트 대시보드
│   └── qa-input-form/         # QA 설정 입력 폼
│
├── mcp-servers/               # MCP 서버
│   └── puppeteer-browser/     # Puppeteer 브라우저 자동화
│
├── RULES.md                   # 팀 공통 규칙
├── install.sh                 # 설치 스크립트
└── README.md                  # 이 문서
```

## 설치

### install.sh 역할

> **install.sh는 최초 1회만 실행합니다.** 이후 모든 프로젝트 설정은 Hook이 자동으로 처리합니다.

```yaml
install.sh (1회):
  - 글로벌 심볼릭 링크 생성 (~/.claude/agents, skills, scripts)
  - MCP 서버 빌드 및 등록
  - SessionStart Hook 등록
  - MCP 권한 자동 설정

Hook (자동):
  - 프로젝트 감지 및 설정 (.claude/ 자동 생성)
  - 프로젝트 분석 여부 질문
  - 맞춤형 에이전트 동적 생성
```

### 1. 저장소 클론

```bash
git clone <repository-url> ~/.claude/shared-agents
cd ~/.claude/shared-agents
```

### 2. 설치 스크립트 실행 (1회)

```bash
# 글로벌 설치 (이것만 실행하면 됨!)
./install.sh

# (선택) 특정 프로젝트 미리 설정
./install.sh /path/to/project
```

설치 스크립트가 수행하는 작업:
- `~/.claude/agents` 심볼릭 링크 생성
- `~/.claude/standards` 심볼릭 링크 생성
- `~/.claude/skills` 심볼릭 링크 생성
- `~/.claude/scripts` 심볼릭 링크 생성
- `~/.claude/RULES.md` 심볼릭 링크 생성
- SessionStart hook 설정 (자동 업데이트)
- **MCP 권한 자동 설정** (질의 없이 자동 진행)
- (프로젝트 경로 지정 시) 프로젝트별 설정 생성

### 3. MCP 권한 자동 설정

install.sh가 `~/.claude/settings.json`에 다음 권한을 자동 추가합니다:

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit(docs/qa/**)",
      "WebFetch",
      "mcp__qa-pipeline__*",
      "mcp__doc-converter__*",
      "mcp__puppeteer-browser__*",
      "mcp__atlassian__*",
      "mcp__playwright__*",
      "mcp__appium-mcp__*",
      "mcp__swagger-mcp__*",
      "mcp__figma__*",
      "Bash(node:*)",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(ls:*)",
      "Bash(pwd)",
      "Bash(find:*)",
      "Bash(mkdir:*)",
      "Bash(gemini:*)"
    ]
  }
}
```

이 설정으로 QA 파이프라인 실행 시 **"Do you want to proceed?"** 질의 없이 자동 진행됩니다.

### 4. 기존 에이전트가 있는 경우

설치 스크립트가 다음 옵션을 제공합니다:

1. **Backup and replace**: 기존 에이전트 백업 후 공유 에이전트로 교체 (권장)
2. **Merge**: 기존 에이전트 유지, 새 에이전트만 추가
3. **Keep existing**: 기존 에이전트 유지, 설치 취소

## 프로젝트별 설정

### 새 프로젝트에 연동

```bash
# 방법 1: install.sh에 프로젝트 경로 전달 (권장)
./install.sh ~/projects/my-app

# 방법 2: 프로젝트 디렉토리에서 직접 실행
cd ~/projects/my-app
~/.claude/shared-agents/install.sh .
```

프로젝트 설정 시 수행하는 작업:
- `.claude/agents` 심볼릭 링크 생성
- `.claude/skills` 심볼릭 링크 생성
- `.claude/scripts` 심볼릭 링크 생성
- `.claude/settings.local.json`에 MCP 권한 설정
- `.gitignore`에 `.claude/` 추가

### 프로젝트별 에이전트 오버라이드

프로젝트 특화 에이전트가 필요한 경우:

```bash
# 프로젝트 디렉토리에서
mkdir -p .claude/agents/development/
cp ~/.claude/shared-agents/agents/development/frontend-dev.md .claude/agents/development/
# 복사한 파일을 프로젝트에 맞게 수정
```

프로젝트 레벨 에이전트가 공유 에이전트보다 우선합니다.

## 자동 프로젝트 프로파일링 (v2.1)

### 개요

새 프로젝트에서 Claude Code를 시작하면 **자동으로** 프로젝트를 분석하고 맞춤형 환경을 구성합니다.

```
┌─────────────────────────────────────────────────────────────┐
│  Claude 세션 시작                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SessionStart Hook → auto-project-setup.sh 실행             │
│  → .claude/project-context.md 존재 확인                     │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
          [없음]                          [있음]
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│  "프로젝트 분석해줘?"   │     │  컨텍스트 로드하여         │
│   1) 자동 (권장)        │     │  세션 시작                  │
│   2) 수동               │     └─────────────────────────────┘
│   3) 건너뛰기           │
└─────────────────────────┘
              │
              ▼ (자동 선택 시)
┌─────────────────────────────────────────────────────────────┐
│  project-profiler → 프로젝트 분석                           │
│  agent-generator → 맞춤형 에이전트 생성                     │
└─────────────────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│  .claude/project-context.md 생성                            │
│  .claude/project-agents/ 생성                               │
│  .claude/agent-registry.json 생성                           │
└─────────────────────────────────────────────────────────────┘
```

### Quick Install (권장)

최소한의 설정으로 자동 프로파일링을 활성화합니다.

```bash
# 1회만 실행하면 모든 프로젝트에서 자동 적용
~/.claude/shared-agents/scripts/quick-install.sh
```

이후 **모든 프로젝트**에서 Claude 세션 시작 시:
- 자동으로 프로젝트 감지
- 필요한 심볼릭 링크 자동 생성
- 프로젝트 분석 여부 질문

### 동적 에이전트 생성 (v2.1)

프로젝트 분석 시 기술 스택과 도메인에 맞는 에이전트를 **자동 탐지**하여 생성합니다.

| 유형 | 탐지 조건 | 생성되는 에이전트 |
|------|----------|------------------|
| **Tech-Stack** | package.json에 `next` | `nextjs-optimizer` |
| | requirements.txt에 `fastapi` | `fastapi-optimizer` |
| | 환경변수에 `UPSTASH_*` | `redis-optimizer` |
| | package.json에 `@tanstack/react-query` | `react-query-optimizer` |
| **Operations** | `backend/` + `frontend/` 동시 존재 | `dev-environment` |
| | `Dockerfile` 존재 | `deploy-manager` |
| | `.github/workflows/` 존재 | `ci-cd-guide` |
| **Domain Expert** | 코드에 `stock`, `investment` 키워드 | `investment-strategist` |
| | 코드에 `blog`, `content`, `wordpress` | `content-strategist` |
| | 코드에 `order`, `payment`, `cart` | `ecommerce-analyst` |

### 생성되는 파일

| 파일 | 설명 |
|------|------|
| `.claude/project-context.md` | 프로젝트 분석 결과 (목적, 기술스택, 도메인, 문제점) |
| `.claude/project-agents/` | 프로젝트 전용 동적 에이전트 |
| `.claude/agent-registry.json` | 에이전트 매핑 및 라우팅 규칙 |

### 기존 Claude Code 프로젝트와 병합

이미 Claude Code를 사용 중인 프로젝트에서:

```bash
# --merge 플래그로 기존 설정과 병합
~/.claude/shared-agents/scripts/auto-project-setup.sh --merge
```

병합 후 Claude 세션에서:
```bash
> 에이전트 최적화해줘
```

**최적화 내용:**
- 기존 에이전트와 공통 에이전트 비교
- 중복 에이전트 병합
- 에이전트 그룹핑 (qa/, dev/, maintenance/, domain/)
- `agent-registry.json` 생성

### 수동 실행

```bash
# 프로젝트 분석
> 프로젝트 분석해줘
> /profile

# 재분석 (기존 컨텍스트 덮어쓰기)
> 프로젝트 다시 분석해줘
> /profile --force

# 에이전트 생성
> 에이전트 생성해줘
> /generate-agent
```

### 프로파일링 에이전트

| 에이전트 | 설명 |
|----------|------|
| `project-profiler` | 프로젝트 심층 분석 (WHY, WHAT, HOW, DOMAIN, GAPS) |
| `agent-generator` | 에이전트/스킬 최적화 생성 |
| `agent-optimizer` | 에이전트 중복 제거, 병합, 그룹핑 |
| `implementation-planner` | 구현 계획 수립 및 추적 |

## QA 파이프라인

### 개요

QA 파이프라인은 다음 단계로 구성됩니다:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Step 1: 문서 수집 (doc-collector)                                   │
│   - Swagger, Figma, Confluence 등 외부 문서 수집                    │
│   - docs/qa/latest/references/ 에 저장                              │
├─────────────────────────────────────────────────────────────────────┤
│ Step 1.5: 프로젝트 구조 분석 (project-detector)                     │
│   - 빌드파일, 프레임워크 자동 감지                                  │
│   - project-structure.json 생성                                     │
├─────────────────────────────────────────────────────────────────────┤
│ Step 2: 코드 분석 (code-analyzer)                                   │
│   - Vue.js/React 컴포넌트 분석                                      │
│   - API 엔드포인트, 라우트, 폼 추출                                 │
│   - docs/qa/latest/analysis/ 에 저장                                │
├─────────────────────────────────────────────────────────────────────┤
│ Step 3: 시나리오 작성 (scenario-writer)                             │
│   - API 시나리오, E2E 시나리오 생성                                 │
│   - docs/qa/latest/scenarios/ 에 저장                               │
├─────────────────────────────────────────────────────────────────────┤
│ Step 3.5: 시나리오 검토 (scenario-reviewer) [선택]                  │
│   - Gemini CLI로 교차 검토                                          │
│   - 커버리지, 중복, 품질 분석                                       │
│   - gemini 없으면 자동 스킵                                         │
├─────────────────────────────────────────────────────────────────────┤
│ Step 3.6: 시나리오 보완 (scenario-refiner) [선택]                   │
│   - 리뷰 피드백 반영                                                │
│   - 누락 시나리오 추가, 중복 제거                                   │
│   - 리뷰 없으면 자동 스킵                                           │
├─────────────────────────────────────────────────────────────────────┤
│ Step 4: 테스트 실행 (backend-tester / e2e-tester)                   │
│   - 테스트 코드 생성 및 실행                                        │
│   - docs/qa/latest/tests/api/ 또는 docs/qa/latest/tests/e2e/        │
│   - docs/qa/latest/reports/ 에 결과 저장                            │
└─────────────────────────────────────────────────────────────────────┘
```

### QA 디렉토리 구조

모든 QA 관련 파일은 `docs/qa/latest/` 하위에 생성됩니다:

```
docs/qa/
├── latest/
│   ├── config.json              # QA 설정 파일
│   ├── test-targets.json        # 테스트 대상 정보
│   ├── references/              # 외부 문서 (Swagger, Figma 등)
│   ├── analysis/                # 코드 분석 결과
│   ├── scenarios/               # 테스트 시나리오
│   │   ├── *-api.md / *api*.md  # API 테스트 시나리오
│   │   └── *-e2e.md / *e2e*.md  # E2E 테스트 시나리오
│   ├── tests/                   # 생성된 테스트 코드
│   │   ├── api/                 # API 테스트 코드
│   │   └── e2e/                 # E2E 테스트 코드
│   ├── test-results/            # 테스트 결과
│   │   └── screenshots/         # E2E 테스트 스크린샷
│   └── reports/                 # 테스트 리포트
└── archived/                    # 아카이브된 이전 결과
```

### QA 스킬 사용법

```bash
/qa-scenario           # QA 시나리오 생성 (Step 1~3)
/qa-scenario --auto    # 자동 모드 (git diff 기반)
/api-test              # API 테스트 실행 (Step 4)
/e2e-test              # E2E 테스트 실행 (Step 4)
```

**모든 QA 요청은 qa-director 오케스트레이터가 처리합니다.**

스킬 호출 → qa-director → 해당 step 에이전트 순으로 실행됩니다.

### E2E 테스트 대시보드

테스트 진행 상황을 실시간으로 모니터링:

```bash
# 대시보드 실행 (브라우저 자동 오픈)
SCENARIO_PATH=docs/qa/latest/scenarios node ~/.claude/scripts/e2e-dashboard/index.js

# 브라우저 자동 오픈 비활성화
NO_OPEN=1 SCENARIO_PATH=docs/qa/latest/scenarios node ~/.claude/scripts/e2e-dashboard/index.js
```

대시보드 URL: http://localhost:3847

### MCP 서버

| MCP 서버 | 설명 |
|---------|------|
| qa-pipeline | QA 파이프라인 도구 (분석, 시나리오, 테스트 실행) |
| doc-converter | 문서 변환 (PDF/이미지 → 마크다운) |
| playwright | E2E 테스트 자동화 |
| puppeteer-browser | 브라우저 자동화 |
| atlassian | Confluence/Jira 연동 |
| swagger-mcp | Swagger API 문서 파싱 |
| figma | Figma 디자인 연동 |
| appium-mcp | 모바일 앱 테스트 |

## 에이전트 사용법

### 개발

```bash
> 개발 시작해줘
> 프론트엔드 개발해줘
> 백엔드 API 만들어줘
> 환경 설정해줘
```

### 아키텍처

```bash
> 아키텍처 설계해줘
> 시스템 구조 잡아줘
```

### QA

```bash
> QA해줘
> 테스트해줘
> E2E 테스트 실행해줘
> API 테스트 실행해줘
```

### DevOps

```bash
> 배포 파이프라인 구축해줘
> CI/CD 설정해줘
```

## 에이전트 목록

| 에이전트 | 설명 | 호출 명령 |
|---------|------|----------|
| dev-lead | 개발팀 총괄 | "개발 시작해줘" |
| frontend-dev | 프론트엔드 개발 | "프론트엔드 개발해줘" |
| backend-dev | 백엔드 개발 | "백엔드 만들어줘" |
| tech-architect | 기술 환경 설정 | "환경 설정해줘" |
| architect-lead | 아키텍처 설계 | "아키텍처 설계해줘" |
| qa-director | QA 테스트 총괄 (오케스트레이터) | "QA해줘", "테스트해줘" |
| step1-doc-collector | 문서 수집 | (qa-director가 호출) |
| step1.5-project-detector | 프로젝트 구조 분석 | (qa-director가 호출) |
| step2-code-analyzer | 코드 분석 | (qa-director가 호출) |
| step3-scenario-writer | 시나리오 작성 | (qa-director가 호출) |
| step3.5-scenario-reviewer | 시나리오 검토 (Gemini) | (qa-director가 호출) |
| step3.6-scenario-refiner | 시나리오 보완 | (qa-director가 호출) |
| step4-backend-tester | API 테스트 | (qa-director가 호출) |
| step4-e2e-tester | E2E 테스트 | (qa-director가 호출) |
| config-sync | 설정 파일 동기화 | "설정 동기화해줘" |
| project-profiler | 프로젝트 심층 분석 | "프로젝트 분석해줘" |
| agent-generator | 에이전트/스킬 생성 | "에이전트 생성해줘" |
| agent-optimizer | 에이전트 최적화 | "에이전트 최적화해줘" |
| implementation-planner | 구현 계획 수립 | (자동 사용) |
| devops-director | CI/CD 구축 | "배포 파이프라인 구축해줘" |

## 스킬 사용법

```bash
/qa-scenario         # QA 시나리오 생성
/api-test            # API 테스트 실행
/e2e-test            # E2E 테스트 실행
/commit              # 변경사항 커밋
/review-pr 123       # PR 리뷰
```

## MCP 서버

### Puppeteer Browser

브라우저 테스트 에이전트(`browser-tester`)에서 사용하는 MCP 서버입니다.

#### 설치

```bash
cd ~/.claude/shared-agents/mcp-servers/puppeteer-browser
npm install && npm run build
```

#### Claude Code 설정

`~/.claude/settings.json`에 추가:

```json
{
  "mcpServers": {
    "puppeteer": {
      "command": "node",
      "args": ["~/.claude/shared-agents/mcp-servers/puppeteer-browser/dist/index.js"]
    }
  }
}
```

#### 제공 도구

| 도구 | 설명 |
|------|------|
| puppeteer_launch | 브라우저 실행 |
| puppeteer_navigate | URL 이동 |
| puppeteer_click | 요소 클릭 |
| puppeteer_fill | 텍스트 입력 |
| puppeteer_screenshot | 스크린샷 캡처 |
| puppeteer_evaluate | JavaScript 실행 |

## 표준 문서

| 문서 | 내용 |
|------|------|
| tech-stack-defaults.md | 기본 기술 스택 |
| testing.md | 테스트 표준 |
| architecture-patterns.md | 아키텍처 패턴 |
| qa-testing-strategy.md | QA 테스트 전략 |
| ci-cd.md | CI/CD 표준 |

## 자동 업데이트

SessionStart hook이 설정되어 있으면, Claude Code 세션 시작 시 자동으로 `git pull`을 실행합니다.

```json
// ~/.claude/settings.json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "cd \"$HOME/.claude/shared-agents\" && git pull -q 2>/dev/null || true"
      }]
    }]
  }
}
```

## 권한 설정

### Edit 권한 제한

`Edit(docs/qa/**)`로 설정하면 QA 관련 디렉토리만 자동 편집 승인됩니다:

- `docs/qa/latest/scenarios/*.md` - 시나리오 파일
- `docs/qa/latest/tests/**` - 테스트 코드
- `docs/qa/latest/reports/*.md` - 리포트 파일

다른 디렉토리 파일 편집 시에는 사용자 확인이 필요합니다.

### 프로젝트별 권한 설정

프로젝트별로 다른 권한이 필요한 경우 `.claude/settings.local.json`을 수정합니다:

```json
{
  "permissions": {
    "allow": [
      "Edit(src/**)",
      "Bash(npm run build:*)"
    ]
  }
}
```

## 아키텍처

### 스킬과 에이전트 역할 분리

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  skills/*.md    │ →   │  *-director.md       │ →   │  step*-*.md         │
│  (진입점)        │     │  (라우팅/총괄)        │     │  (실행 로직)         │
└─────────────────┘     └──────────────────────┘     └─────────────────────┘
```

| 파일 | 역할 | 내용 |
|------|------|------|
| `skills/**/SKILL.md` | 진입점 | qa-director로 위임만 |
| `agents/qa/qa-director.md` | 라우팅 | 요청을 적절한 step 에이전트로 분배 |
| `agents/qa/step*-*.md` | 실행 로직 | 상세 실행 지침 |

### 설정 파일

QA 파이프라인은 `docs/qa/latest/config.json`을 설정 파일로 사용합니다.
- 모든 QA 에이전트는 이 파일에서 프로젝트 정보를 자동으로 읽습니다
- **사용자에게 프로젝트 경로를 묻지 않습니다**

## 기여 가이드

1. 새 에이전트 추가 시 `agents/{team}/` 폴더에 생성
2. 에이전트 파일은 frontmatter (name, description, model, tools) 필수
3. 표준 문서는 `standards/{category}/`에 생성
4. 변경 후 테스트 수행
5. PR 생성 및 리뷰 요청

## 문제 해결

### 에이전트가 인식되지 않는 경우

```bash
# 심볼릭 링크 확인
ls -la ~/.claude/

# 심볼릭 링크 재생성
ln -sf ~/.claude/shared-agents/agents ~/.claude/agents
```

### 자동 업데이트가 안 되는 경우

```bash
# settings.json 확인
cat ~/.claude/settings.json

# 수동 업데이트
cd ~/.claude/shared-agents && git pull
```

### MCP 도구 사용 시 권한 질의가 나오는 경우

```bash
# settings.json에 permissions.allow 확인
cat ~/.claude/settings.json | jq '.permissions.allow'

# 없으면 install.sh 재실행
cd ~/.claude/shared-agents && ./install.sh
```

### 프로젝트별 권한 질의가 나오는 경우

```bash
# settings.local.json 확인
cat .claude/settings.local.json

# 없으면 install.sh 재실행 (프로젝트 경로 전달)
~/.claude/shared-agents/install.sh .
```

## 유지보수

### 설정 파일 동기화 (config-sync)

에이전트, 스킬, MCP 서버 변경 시 관련 설정 파일들을 자동으로 동기화합니다.

**동기화 대상 파일:**
- `templates/CLAUDE.project.md` - 프로젝트 템플릿
- `install.sh` - 설치 스크립트, MCP 권한
- `agents/qa/README.md` - QA 문서
- `skills/*/SKILL.md` - 스킬 설명

**사용법:**
```bash
# Claude Code에서
"설정 동기화해줘"
"config sync 해줘"
```

**자동 동기화 트리거:**
- 새 에이전트 추가 시
- 새 스킬 추가 시
- MCP 서버 추가 시
- 파이프라인 단계 변경 시

## 라이선스

Internal Use Only - 팀 내부 사용 전용
