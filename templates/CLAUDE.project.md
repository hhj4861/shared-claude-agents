# Project Instructions

이 파일은 shared-claude-agents에서 자동 동기화됩니다.
수정하지 마세요. 수정이 필요하면 shared-claude-agents/templates/CLAUDE.project.md를 수정하세요.

---

## 사용 가능한 Skills

| 명령 | 설명 |
|------|------|
| `/qa-scenario` | QA 테스트 시나리오 생성 |
| `/qa-scenario --auto` | 질문 없이 자동 생성 |
| `/qa-scenario --from step2` | step2(코드 분석)부터 시작 |
| `/qa-scenario --from step3` | step3(시나리오 작성)만 실행 |
| `/api-test` | API 테스트 실행 |
| `/e2e-test` | E2E 테스트 실행 |
| `/e2e-test TC-001` | 특정 TC만 실행 |
| `/commit` | Git 커밋 생성 |
| `/review-pr` | PR 리뷰 |

---

## QA 관련 요청 라우팅 (MANDATORY)

**QA, 테스트, 시나리오 관련 요청은 qa-director 오케스트레이터가 처리합니다.**

```yaml
라우팅_규칙:
  E2E_테스트:
    키워드: [E2E, e2e, 브라우저, UI 테스트, 화면 테스트]
    라우팅: qa-director → step4-e2e-tester

  API_테스트:
    키워드: [API, api, 백엔드 테스트]
    라우팅: qa-director → step4-backend-tester

  시나리오_생성:
    키워드: [시나리오, QA 시나리오, 테스트 케이스]
    라우팅: qa-director → step1 → step2 → step3
```

### 슬래시 명령어 라우팅

| 명령 | 라우팅 경로 |
|------|------------|
| `/e2e-test` | qa-director → step4-e2e-tester |
| `/api-test` | qa-director → step4-backend-tester |
| `/qa-scenario` | qa-director → 파이프라인 |

---

## 사용 가능한 Agents

| 에이전트 | 역할 |
|---------|------|
| `qa-director` | QA 파이프라인 총괄 오케스트레이터 |
| `step1-doc-collector` | 문서 수집 (Confluence, Swagger 등) |
| `step1.5-project-detector` | 프로젝트 구조 분석 (프레임워크, 패턴 감지) |
| `step2-code-analyzer` | 소스코드 분석 (API, 라우트, 컴포넌트) |
| `step3-scenario-writer` | 테스트 시나리오 작성 |
| `step3.5-scenario-reviewer` | 시나리오 외부 검토 (Gemini CLI) |
| `step3.6-scenario-refiner` | 리뷰 피드백 반영, 시나리오 보완 |
| `step4-e2e-tester` | E2E 브라우저 테스트 실행 |
| `step4-backend-tester` | API 테스트 실행 |
| `frontend-dev` | 프론트엔드 개발 |
| `backend-dev` | 백엔드 개발 |
| `dev-lead` | 개발팀 리드 |
| `config-sync` | 설정 파일 동기화 (유지보수) |
| `task-tracker` | 작업 완료/TODO 문서화 (유지보수) |
| `project-setup` | 프로젝트 컨텍스트 분석 및 환경 설정 |

---

## QA 파이프라인 구조

```
/qa-scenario 실행 시:

Step 0: 설정 입력 (웹 폼)
    │
    ▼
Step 1: 문서 수집 (step1-doc-collector)
    │   - Confluence PRD
    │   - API 명세서
    │   - 정책 문서
    │
    ▼
Step 1.5: 프로젝트 구조 분석 (step1.5-project-detector) ⭐
    │   - 빌드파일 감지 (build.gradle, package.json 등)
    │   - 프레임워크 판별 (Spring, Vue, React 등)
    │   - 동적 패턴 생성
    │
    ▼
Step 2: 코드 분석 (step2-code-analyzer)
    │   - project-structure.json 기반 분석
    │   - BE API 엔드포인트
    │   - FE 라우트, 컴포넌트
    │   - UI 컴포넌트 (체크박스, 입력폼 등)
    │
    ▼
Step 3: 시나리오 작성 (step3-scenario-writer)
    │   - API 테스트 시나리오
    │   - E2E 테스트 시나리오
    │
    ▼
Step 3.5: 시나리오 검토 (step3.5-scenario-reviewer) [선택]
    │   - Gemini CLI로 교차 검토
    │   - 커버리지, 중복, 품질 분석
    │   - gemini 없으면 자동 스킵
    │
    ▼
Step 3.6: 시나리오 보완 (step3.6-scenario-refiner) [선택]
    │   - 리뷰 피드백 반영
    │   - 누락 시나리오 추가
    │   - 중복/불필요 항목 제거
    │   - 리뷰 없으면 자동 스킵
    │
    ▼
결과: docs/qa/latest/scenarios/
```

---

## E2E 테스트 실행

```
/e2e-test 실행 시:

1. 대시보드 시나리오 로드
2. Playwright MCP로 브라우저 조작
3. 각 TC/스텝 진행 상황 대시보드 동기화
4. 결과 리포트 생성
```

**사전 조건:**
- `/qa-scenario`로 시나리오 생성 완료
- 테스트 서버 실행 중
- E2E 대시보드 실행 중 (`npm start` in scripts/e2e-dashboard)

---

## 자연어 요청 예시

| 요청 | 처리 |
|------|------|
| "E2E 테스트 해줘" | qa-director → step4-e2e-tester |
| "API 테스트 실행해" | qa-director → step4-backend-tester |
| "QA 시나리오 만들어줘" | qa-director → 파이프라인 |
| "step2부터 시나리오 다시 만들어줘" | qa-director → step2 → step3 |
| "TC-001만 테스트해줘" | qa-director → step4-e2e-tester (TC-001) |
| "설정 동기화해줘" | config-sync |

---

## 유지보수

### 설정 파일 동기화

에이전트/스킬/MCP 변경 시 관련 파일 동기화:

```bash
"설정 동기화해줘"
"config sync 해줘"
```

**동기화 대상:**
- `templates/CLAUDE.project.md` - 이 파일
- `install.sh` - 설치 스크립트
- `agents/qa/README.md` - QA 문서
