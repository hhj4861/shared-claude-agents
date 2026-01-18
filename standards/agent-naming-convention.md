# Agent Naming Convention

에이전트 생성 시 반드시 따라야 하는 네이밍 규칙입니다.

## 핵심 원칙

> **"파일명만 보고 에이전트의 역할을 즉시 파악할 수 있어야 한다"**

```
┌─────────────────────────────────────────────────────────────────┐
│  BAD                              │  GOOD                       │
├───────────────────────────────────┼─────────────────────────────┤
│  _orchestrator.md                 │  qa-director.md             │
│  helper.md                        │  api-test-runner.md         │
│  util-agent.md                    │  config-validator.md        │
│  my-agent.md                      │  payment-flow-tester.md     │
│  processor.md                     │  scenario-writer.md         │
└───────────────────────────────────┴─────────────────────────────┘
```

---

## 1. 파일명 형식

### 1.1 기본 형식

```
{역할/도메인}-{행위자}.md
```

| 구성 요소 | 설명 | 예시 |
|-----------|------|------|
| 역할/도메인 | 에이전트가 담당하는 영역 | `backend`, `qa`, `payment`, `redis` |
| 행위자 | 에이전트가 수행하는 동작/역할 | `dev`, `tester`, `analyzer`, `validator` |

### 1.2 예시

```
backend-dev.md          # 백엔드 개발자
frontend-dev.md         # 프론트엔드 개발자
qa-director.md          # QA 총괄 디렉터
code-analyzer.md        # 코드 분석기
payment-tester.md       # 결제 테스터
redis-optimizer.md      # Redis 최적화
```

---

## 2. 행위자(Suffix) 표준

### 2.1 역할별 Suffix

| Suffix | 역할 | 사용 예시 |
|--------|------|----------|
| `-dev` | 코드 작성/개발 | `backend-dev`, `frontend-dev` |
| `-architect` | 설계/아키텍처 | `system-architect`, `data-architect` |
| `-designer` | 상세 설계 | `system-designer`, `api-designer` |
| `-director` | 오케스트레이터/총괄 | `qa-director`, `dev-director` |
| `-lead` | 팀 리드/조율자 | `dev-lead`, `qa-lead` |
| `-analyzer` | 분석 수행 | `code-analyzer`, `log-analyzer` |
| `-tester` | 테스트 수행 | `api-tester`, `e2e-tester`, `payment-tester` |
| `-validator` | 검증/확인 | `schema-validator`, `workflow-validator` |
| `-writer` | 문서/코드 생성 | `scenario-writer`, `report-writer` |
| `-generator` | 자동 생성 | `agent-generator`, `test-generator` |
| `-optimizer` | 최적화 | `agent-optimizer`, `redis-optimizer` |
| `-tracker` | 추적/모니터링 | `task-tracker`, `insight-tracker` |
| `-collector` | 수집 | `doc-collector`, `metric-collector` |
| `-profiler` | 프로파일링/분석 | `project-profiler`, `perf-profiler` |
| `-runner` | 실행기 | `test-runner`, `build-runner` |
| `-reviewer` | 검토/리뷰 | `scenario-reviewer`, `code-reviewer` |
| `-refiner` | 개선/정제 | `scenario-refiner`, `prompt-refiner` |
| `-specialist` | 도메인 전문가 | `payment-specialist`, `security-specialist` |
| `-assistant` | 지원/보조 | `dev-assistant`, `debug-assistant` |

### 2.2 금지 Suffix

```yaml
금지:
  - -helper      # 너무 모호함 → 구체적인 역할명 사용
  - -util        # 너무 모호함 → 구체적인 기능명 사용
  - -handler     # 무엇을 handle 하는지 불명확
  - -manager     # 무엇을 manage 하는지 불명확
  - -processor   # 무엇을 process 하는지 불명확
  - -service     # 에이전트가 아닌 서비스처럼 들림
```

---

## 3. 파이프라인 에이전트 네이밍

순차적으로 실행되는 파이프라인 에이전트는 단계 번호를 포함합니다.

### 3.1 형식

```
step{N}-{역할}.md
step{N}.{sub}-{역할}.md   # 하위 단계
```

### 3.2 예시

```
/qa/pipeline/
├── step1-doc-collector.md       # Step 1: 문서 수집
├── step2-project-detector.md    # Step 2: 프로젝트 감지
├── step3-code-analyzer.md       # Step 3: 코드 분석
├── step4-scenario-writer.md     # Step 4: 시나리오 작성
├── step4.1-scenario-reviewer.md # Step 4.1: 시나리오 검토
├── step4.2-scenario-refiner.md  # Step 4.2: 시나리오 개선
└── step5-api-tester.md          # Step 5: API 테스트
```

### 3.3 규칙

```yaml
번호_규칙:
  - 정수: 주요 단계 (step1, step2, step3...)
  - 소수점: 하위 단계 (step3.1, step3.2...)
  - 건너뛰기 금지: step1, step2, step4 (X) → step1, step2, step3 (O)

이름_규칙:
  - 동사형: collector, analyzer, writer, tester 등
  - 명확한 행위 표현
```

---

## 4. 카테고리별 네이밍

### 4.1 디렉토리 구조

```
agents/
├── architecture/       # 설계/아키텍처
│   ├── architect-director.md   # 아키텍처팀 총괄
│   ├── system-designer.md
│   ├── data-architect.md
│   ├── feasibility-analyst.md
│   └── mcp-strategist.md
│
├── development/        # 개발
│   ├── dev-director.md         # 개발팀 총괄
│   ├── backend-dev.md
│   ├── frontend-dev.md
│   └── tech-architect.md
│
├── qa/                 # QA/테스트
│   ├── qa-director.md          # QA 총괄
│   ├── step1-doc-collector.md
│   ├── step1.5-project-detector.md
│   ├── step2-code-analyzer.md
│   ├── step3-scenario-writer.md
│   ├── step3.5-scenario-reviewer.md
│   ├── step3.6-scenario-refiner.md
│   └── step4-backend-tester.md
│
├── devops/             # DevOps
│   └── devops-director.md
│
├── demo/               # 시연/데모
│   ├── demo-recorder.md
│   └── demo-script-generator.md
│
└── maintenance/        # 유지보수
    ├── setup/          # 설정 관련
    │   ├── project-profiler.md
    │   └── project-initializer.md
    │
    ├── agents/         # 에이전트 관리
    │   ├── agent-generator.md
    │   └── agent-optimizer.md
    │
    ├── tracking/       # 추적 관련
    │   ├── task-tracker.md
    │   ├── parallel-insight-tracker.md
    │   └── session-learner.md
    │
    ├── conventions/    # 컨벤션 관련
    │   └── code-convention-guide.md
    │
    └── tools/          # 유틸리티
        ├── implementation-planner.md
        ├── config-synchronizer.md
        ├── workflow-validator.md
        └── todo-summarizer.md
```

### 4.2 카테고리별 필수 에이전트

```yaml
architecture:
  필수: []
  선택: [system-designer, data-architect, feasibility-analyst]

development:
  필수: [dev-director]
  선택: [backend-dev, frontend-dev, tech-architect]

qa:
  필수: [qa-director]
  선택: [pipeline 에이전트들, e2e-tester, api-tester]

devops:
  필수: []
  선택: [devops-director, deploy-manager]

maintenance:
  필수: [project-profiler, task-tracker, insight-tracker]
  선택: [agent-generator, agent-optimizer, session-learner]
```

---

## 5. 도메인 전문 에이전트 네이밍

프로젝트 도메인에 특화된 에이전트는 도메인명을 prefix로 사용합니다.

### 5.1 형식

```
{도메인}-{역할}.md
```

### 5.2 예시

```
payment-tester.md       # 결제 도메인 테스터
order-validator.md      # 주문 상태 검증기
inventory-specialist.md # 재고 도메인 전문가
user-auth-tester.md     # 사용자 인증 테스터
```

### 5.3 도메인 prefix 예시

```yaml
비즈니스_도메인:
  - payment-    # 결제
  - order-      # 주문
  - user-       # 사용자
  - product-    # 상품
  - inventory-  # 재고
  - shipping-   # 배송

기술_도메인:
  - redis-      # Redis
  - postgres-   # PostgreSQL
  - nextjs-     # Next.js
  - fastapi-    # FastAPI
  - docker-     # Docker
```

---

## 6. 네이밍 체크리스트

에이전트 생성 전 확인해야 할 사항:

```
[ ] 1. 파일명만 보고 역할을 파악할 수 있는가?
[ ] 2. 표준 Suffix를 사용하는가?
[ ] 3. 금지된 Suffix를 피했는가?
[ ] 4. 소문자와 하이픈만 사용하는가?
[ ] 5. 약어가 있다면 널리 알려진 것인가?
[ ] 6. 유사한 에이전트와 이름이 충돌하지 않는가?
[ ] 7. 파이프라인이면 step 번호가 포함되어 있는가?
[ ] 8. 디렉토리 위치가 역할에 맞는가?
```

---

## 7. 이름 변경 가이드

기존 에이전트 이름을 변경할 때:

### 7.1 변경 절차

```yaml
1_백업:
  - 기존 파일 백업
  - agent-registry.json 백업

2_파일명_변경:
  - 새 이름으로 파일 복사
  - 내부 name 필드 업데이트
  - 구 파일 제거

3_참조_업데이트:
  - agent-registry.json 업데이트
  - 다른 에이전트의 basedOn 필드 업데이트
  - skills의 agent 참조 업데이트

4_검증:
  - 에이전트 호출 테스트
  - 연관 스킬 테스트
```

### 7.2 주요 변경 예시

```yaml
_orchestrator_변경:
  qa/_orchestrator.md → qa/qa-director.md
  development/_orchestrator.md → development/dev-director.md
  devops/_orchestrator.md → devops/devops-director.md
  architecture/_orchestrator.md → 제거 (필요 시 arch-director.md)
```

---

## 8. 연관 문서

- `agent-generator.md` - 에이전트 생성 시 이 규칙 자동 적용
- `agent-optimizer.md` - 기존 에이전트 네이밍 검증
- `agent-registry.schema.json` - 레지스트리 스키마

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2025-01-18 | 초기 버전 작성 |
