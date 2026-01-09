# QA Agents - 테스트 자동화 파이프라인

QA 시나리오 생성부터 E2E 테스트 실행까지 자동화하는 에이전트 시스템입니다.

## 목차

- [아키텍처 개요](#아키텍처-개요)
- [에이전트 구성](#에이전트-구성)
- [스킬 (Slash Commands)](#스킬-slash-commands)
- [MCP 서버](#mcp-서버)
- [디렉토리 구조](#디렉토리-구조)
- [사용법](#사용법)
- [설정](#설정)

---

## 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         QA Pipeline Architecture                         │
└─────────────────────────────────────────────────────────────────────────┘

사용자 요청: "QA 시나리오 만들어줘" 또는 /qa-scenario
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  _orchestrator (qa-director)                                  [Sonnet]  │
│  ────────────────────────────────────────────────────────────────────── │
│  • 파이프라인 전체 조율                                                  │
│  • 서브에이전트 순차 호출                                                │
│  • 각 단계 완료 검증                                                     │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ├──────────────────┬──────────────────┬──────────────────┐
         ▼                  ▼                  ▼                  ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ step1           │ │ step2           │ │ step3           │ │ step4           │
│ doc-collector   │ │ code-analyzer   │ │ scenario-writer │ │ e2e-tester      │
│ [Sonnet]        │ │ [Sonnet]        │ │ [Opus]          │ │ [Sonnet]        │
│                 │ │                 │ │                 │ │                 │
│ • 문서 수집     │ │ • BE/FE 분석    │ │ • 시나리오 작성 │ │ • E2E 테스트    │
│ • 변환 검증     │ │ • API 엔드포인트│ │ • TC 생성       │ │ • Playwright    │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
         │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            MCP Servers                                   │
├─────────────────┬─────────────────┬─────────────────┬───────────────────┤
│ qa-pipeline     │ doc-converter   │ playwright      │ atlassian         │
│ (로컬)          │ (로컬)          │ (npx)           │ (SSE)             │
└─────────────────┴─────────────────┴─────────────────┴───────────────────┘
```

---

## 에이전트 구성

### 메인 에이전트

| 에이전트 | 파일 | 모델 | 역할 |
|----------|------|------|------|
| **qa-director** | `_orchestrator.md` | **Sonnet** | 파이프라인 총괄, 순차 호출, 상태 관리 |

### 서브에이전트

| 단계 | 에이전트 | 파일 | 모델 | 역할 |
|------|----------|------|------|------|
| Step 1 | doc-collector | `step1-doc-collector.md` | **Sonnet** | 참조 문서 수집 (Confluence, Swagger, Figma) |
| Step 2 | code-analyzer | `step2-code-analyzer.md` | **Sonnet** | BE/FE 소스코드 분석, API 엔드포인트 추출 |
| Step 3 | scenario-writer | `step3-scenario-writer.md` | **Opus** | 테스트 시나리오 문서 작성 |
| Step 4a | backend-tester | `step4-backend-tester.md` | **Sonnet** | API 테스트 코드 생성 (Jest + Supertest) |
| Step 4b | e2e-tester | `step4-e2e-tester.md` | **Sonnet** | E2E 테스트 실행 (Playwright) |

### 보조 에이전트

| 에이전트 | 파일 | 모델 | 역할 |
|----------|------|------|------|
| demo-recorder | `demo-recorder.md` | Sonnet | 데모 영상 레코딩 |
| demo-script-generator | `demo-script-generator.md` | Sonnet | 데모 스크립트 생성 |

### 모델 선택 기준

```yaml
Opus 사용 (step3만):
  - 고품질 시나리오 문서 생성
  - TC 품질 및 커버리지 판단
  - 복잡한 도메인 이해 필요

Sonnet 사용 (나머지 전체):
  - 파이프라인 조율 (순차 호출, 상태 관리)
  - 문서 수집/변환 (반복 작업)
  - 코드 분석 (패턴 매칭)
  - 테스트 코드 생성
  - 빠른 응답, 비용 효율
```

---

## 스킬 (Slash Commands)

### `/qa-scenario`

QA 시나리오 생성 파이프라인을 시작합니다.

```bash
# 일반 모드 - 웹 폼으로 상세 설정
/qa-scenario

# 자동 모드 - git diff 기반 자동 분석
/qa-scenario --auto
```

**출력물:**
- `docs/qa/latest/config.json` - 설정 파일
- `docs/qa/latest/references/` - 수집된 참조 문서
- `docs/qa/latest/analysis/` - 코드 분석 결과
- `docs/qa/latest/scenarios/` - 테스트 시나리오

### `/api-test`

시나리오 기반 API 테스트 코드를 생성하고 실행합니다.

```bash
# 전체 API 테스트
/api-test

# 특정 기능 테스트
/api-test auth
/api-test users
```

**사전 조건:** `/qa-scenario` 완료 필수

### `/e2e-test`

시나리오 기반 E2E 테스트를 실행합니다.

```bash
# 전체 E2E 테스트
/e2e-test

# 특정 기능 테스트
/e2e-test login
/e2e-test menu-management
```

**사전 조건:** `/qa-scenario` 완료 필수

---

## MCP 서버

### 로컬 MCP (직접 빌드)

| MCP | 경로 | 주요 도구 |
|-----|------|----------|
| **qa-pipeline** | `mcp-servers/qa-pipeline/` | `qa_load_config`, `qa_verify_scenario`, `e2e_generate_code`, `e2e_check_auth` |
| **doc-converter** | `mcp-servers/doc-converter/` | `convert_pdf_to_md`, `convert_docx_to_md`, `format_markdown` |

### External MCP (npx)

| MCP | 명령 | 주요 도구 | 용도 |
|-----|------|----------|------|
| **playwright** | `npx @playwright/mcp@latest` | `browser_navigate`, `browser_click`, `browser_snapshot` | Web E2E 테스트 |
| **appium-mcp** | `npx -y appium-mcp@latest` | `appium_start_session`, `appium_tap` | 모바일 앱 테스트 |
| **swagger-mcp** | `npx -y @anthropic-community/swagger-mcp-server` | `load_swagger`, `list_endpoints` | API 명세 분석 |
| **figma** | `npx -y figma-developer-mcp --stdio` | `get_figma_data`, `get_components` | UI 디자인 참조 |
| **atlassian** | SSE: `https://mcp.atlassian.com/v1/sse` | `confluence_get_page`, `jira_get_issue` | Confluence/Jira 연동 |

### qa-pipeline MCP 도구 상세

#### QA 파이프라인 도구

| 도구 | 설명 |
|------|------|
| `qa_load_config` | 설정 파일 로드 및 검증 |
| `qa_update_step` | 파이프라인 단계 상태 업데이트 |
| `qa_get_progress` | 현재 진행 상태 조회 |
| `qa_extract_metadata` | 원본 문서 메타데이터 추출 |
| `qa_verify_conversion` | 문서 변환 품질 검증 (LLM 포함) |
| `qa_verify_documents` | 수집된 문서 완전성 검증 |
| `qa_verify_scenario` | 시나리오 품질 검증 |
| `qa_get_summary` | 파이프라인 실행 요약 |

#### E2E 테스트 도구

| 도구 | 설명 |
|------|------|
| `e2e_check_auth` | 저장된 인증 상태 유효성 확인 |
| `e2e_parse_scenario` | E2E 시나리오 파싱 |
| `e2e_generate_code` | 시나리오 → Playwright 코드 자동 생성 |
| `e2e_match_selector` | 스냅샷 기반 셀렉터 매칭 |
| `e2e_update_result` | 개별 TC 결과 기록 |
| `e2e_create_report` | 테스트 결과 리포트 생성 |

---

## 디렉토리 구조

### 에이전트/스킬 위치

```
~/.claude/
├── shared-agents/
│   ├── agents/
│   │   └── qa/
│   │       ├── _orchestrator.md        # 메인 오케스트레이터
│   │       ├── step1-doc-collector.md  # 문서 수집
│   │       ├── step2-code-analyzer.md  # 코드 분석
│   │       ├── step3-scenario-writer.md # 시나리오 작성
│   │       ├── step4-backend-tester.md # API 테스트
│   │       ├── step4-e2e-tester.md     # E2E 테스트
│   │       └── archived/               # 구버전 보관
│   │
│   ├── skills/
│   │   ├── qa-scenario/SKILL.md
│   │   ├── api-test/SKILL.md
│   │   └── e2e-test/SKILL.md
│   │
│   ├── mcp-servers/
│   │   ├── qa-pipeline/
│   │   └── doc-converter/
│   │
│   └── scripts/
│       └── qa-input-form/              # 웹 폼 UI
│
├── agents -> shared-agents/agents      # 심볼릭 링크
└── skills -> shared-agents/skills      # 심볼릭 링크
```

### 프로젝트 출력물 구조

```
{project}/docs/qa/
├── latest/                     ← 현재 실행 결과 (심볼릭 링크)
│   ├── config.json             # 설정 파일
│   ├── references/             # 수집된 참조 문서
│   │   ├── prd/
│   │   ├── api/
│   │   ├── design/
│   │   └── policy/
│   ├── analysis/               # 코드 분석 결과
│   │   ├── be-analysis.md
│   │   ├── fe-analysis.md
│   │   └── test-targets.json
│   ├── scenarios/              # 테스트 시나리오
│   │   ├── {feature}-api.md
│   │   └── {feature}-e2e.md
│   ├── reports/                # 테스트 결과 리포트
│   │   ├── api-report-{date}.md
│   │   └── e2e-report-{date}.md
│   └── screenshots/            # E2E 스크린샷
│
├── 2026-01-09T14-30-52/        ← 히스토리 (run_id)
├── 2026-01-08T09-15-30/
└── ...
```

---

## 사용법

### 1. 설치

```bash
# 최초 설치
cd shared-claude-agents
./install.sh

# MCP 업데이트 (모든 계정에 적용)
./update-mcp.sh
```

### 2. QA 시나리오 생성

```bash
# Claude Code에서
/qa-scenario
```

웹 폼이 열리면:
1. 프로젝트 경로 입력 (BE/FE)
2. 참조 문서 URL 입력 (Confluence, Swagger 등)
3. 테스트 범위 선택
4. "시나리오 생성 시작" 클릭

### 3. 테스트 실행

```bash
# API 테스트
/api-test

# E2E 테스트
/e2e-test
```

### 4. 자동 모드 (CI/CD 통합용)

```bash
# git diff 기반 자동 분석
/qa-scenario --auto
```

---

## 설정

### config.json 구조

```json
{
  "run_id": "2026-01-09T14-30-52",
  "project": {
    "name": "my-project",
    "type": "monorepo",
    "fe_path": "/path/to/frontend",
    "be_path": "/path/to/backend",
    "framework": "vue2"
  },
  "target": {
    "type": "full_project",
    "features": [
      {
        "name": "login",
        "routes": ["/login", "/auth/callback"],
        "priority": "P0"
      }
    ]
  },
  "documents": {
    "prd": ["https://confluence.example.com/pages/123"],
    "api": ["https://api.example.com/swagger"],
    "design": [],
    "policy": []
  },
  "auth": {
    "type": "keycloak",
    "username": "test@example.com",
    "password": "****"
  },
  "test_server": {
    "fe_url": "https://dev.example.com",
    "be_url": "https://api-dev.example.com"
  }
}
```

### 인증 설정

```yaml
auth.type 옵션:
  - keycloak: Keycloak SSO (자동 로그인, OTP만 수동)
  - jwt: JWT 토큰 직접 사용
  - basic: Basic Auth
  - none: 인증 없음
```

---

## E2E 테스트 자동화

### 로그인 자동화

`e2e_generate_code`로 생성되는 코드에는 자동 로그인이 포함됩니다:

1. **저장된 인증 확인**: `playwright/.auth/user.json` 체크
2. **만료/없으면 자동 로그인**: Keycloak 페이지 감지 → username/password 자동 입력
3. **OTP만 수동**: 2분 대기 후 자동 진행
4. **인증 상태 저장**: 다음 테스트에서 재사용

### E2E 시나리오 액션 형식

시나리오 문서에서 사용하는 액션 테이블:

```markdown
| # | 액션 | 설명 |
|---|------|------|
| 1 | navigate: /admin/menus | 페이지 이동 |
| 2 | wait: [data-testid="table"] visible | 로딩 대기 |
| 3 | click: [data-testid="add-btn"] | 버튼 클릭 |
| 4 | fill: [data-testid="name"] -> "테스트" | 입력 |
| 5 | select: [data-testid="type"] -> "옵션A" | 드롭다운 선택 |
| 6 | assert: .toast-success visible | 검증 |
| 7 | screenshot: after-save | 스크린샷 |
```

---

## 검증 체계

### 파이프라인 검증

| 단계 | 검증 도구 | 검증 항목 |
|------|----------|----------|
| 설정 | `qa_load_config` | 필수 필드, 경로 존재 |
| 문서 수집 | `qa_verify_documents` | 수집 완료, 변환 품질 |
| 시나리오 | `qa_verify_scenario` | 필수 섹션, TC 개수, 우선순위 |

### 시나리오 검증 기준

```yaml
필수_섹션:
  - 개요 (Overview)
  - 참조 문서 (References)
  - 테스트 시나리오 (Test Scenarios)

TC_요구사항:
  - 최소 5개 이상
  - P0 (Critical) 최소 1개
  - TC ID 형식: TC-{FEATURE}-{TYPE}-{NNN}

실패시:
  - step3-scenario-writer 재호출
  - 누락 항목 보완 요청
```

---

## 트러블슈팅

### MCP가 보이지 않음

```bash
# 모든 계정에 MCP 재등록
cd ~/.claude/shared-agents
./update-mcp.sh

# Claude Code 재시작
```

### 인증 실패

```bash
# 저장된 인증 삭제 후 재로그인
rm -rf {project}/playwright/.auth/
```

### 시나리오 검증 실패

- TC 개수가 5개 미만인지 확인
- P0 케이스가 있는지 확인
- TC ID 형식이 올바른지 확인 (`TC-{FEATURE}-{TYPE}-{NNN}`)

---

## 관련 문서

- [MCP 공식 문서](https://modelcontextprotocol.io/)
- [Playwright 문서](https://playwright.dev/)
- [Atlassian MCP](https://mcp.atlassian.com/)

---

## 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-09 | 2.0 | run_id 폴더 방식, E2E 로그인 자동화, 전체 구조 리팩토링 |
| 2026-01-08 | 1.0 | 초기 버전 |
