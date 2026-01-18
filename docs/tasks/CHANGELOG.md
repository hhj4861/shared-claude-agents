# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Planned
- 에이전트 간 의존성 다이어그램
- E2E 테스터 에이전트 추가
- 실제 프로젝트에 최적화 테스트

---

## [2026-01-18] - 에이전트 네이밍 및 그룹핑 대규모 리팩토링

### Added (후반)
- `.claude/hooks/` 디렉토리 및 Hook 스크립트 (이 프로젝트용)
  - `task-tracker.sh` - Edit|Write|Task 완료 시 기록
  - `session-summary.sh` - 세션 종료 시 요약
  - `parallel-insight-tracker.sh` - 이슈 패턴 백그라운드 감지
- `.claude/settings.json` - Hook 설정 (Task 도구 포함)
- `docs/tasks/` - 작업 추적 문서 구조 (TODO.md, CHANGELOG.md, history/)

### Added (초반)
- `standards/agent-naming-convention.md` - 에이전트 네이밍 규칙 문서
- `agents/maintenance/conventions/code-convention-guide.md` - 코드 컨벤션 가이드 에이전트
- `agents/maintenance/tracking/parallel-insight-tracker.md` - 병렬 인사이트 추적 에이전트
- `agents/demo/` - 데모 에이전트 디렉토리 분리
- `docs/tasks/` - 작업 추적 문서 구조

### Changed
- **에이전트 파일명 변경** (_orchestrator → *-director)
  - `qa/_orchestrator.md` → `qa/qa-director.md`
  - `development/_orchestrator.md` → `development/dev-director.md`
  - `devops/_orchestrator.md` → `devops/devops-director.md`
  - `architecture/_orchestrator.md` → `architecture/architect-director.md`

- **Maintenance 에이전트 그룹핑** (11개 → 5개 하위 폴더)
  ```
  maintenance/
  ├── setup/          # project-profiler, project-initializer
  ├── agents/         # agent-generator, agent-optimizer
  ├── tracking/       # task-tracker, parallel-insight-tracker, session-learner
  ├── conventions/    # code-convention-guide
  └── tools/          # implementation-planner, config-synchronizer, workflow-validator, todo-summarizer
  ```

- **파일명 개선**
  - `config-sync.md` → `config-synchronizer.md` (동사형 일관성)
  - `project-setup.md` → `project-initializer.md` (행위자 명확화)

- **데모 에이전트 분리**
  - `qa/demo-recorder.md` → `demo/demo-recorder.md`
  - `qa/demo-script-generator.md` → `demo/demo-script-generator.md`

### Updated
- `templates/agent-skill-mapping.yaml` - 새 경로 반영 (32개 에이전트)
- `README.md` - 디렉토리 구조 업데이트
- `agents/maintenance/agents/agent-generator.md` - 필수 에이전트 정책에 새 에이전트 추가

### Fixed
- 모든 `_orchestrator` 참조를 `*-director`로 일괄 변경
  - agent-skill-mapping.yaml
  - README.md
  - config-synchronizer.md
  - agent-generator.md

---

## [이전 버전]

### 주요 에이전트 목록 (32개)

| 카테고리 | 에이전트 |
|----------|----------|
| architecture (5) | architect-director, data-architect, feasibility-analyst, mcp-strategist, system-designer |
| development (4) | dev-director, backend-dev, frontend-dev, tech-architect |
| qa (8) | qa-director, step1~step4 파이프라인 |
| devops (1) | devops-director |
| demo (2) | demo-recorder, demo-script-generator |
| maintenance (12) | setup(2), agents(2), tracking(3), conventions(1), tools(4) |
