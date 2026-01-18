# TODO

> 마지막 업데이트: 2026-01-18

## 진행 현황

| 상태 | 개수 |
|------|------|
| 완료 | 9 |
| 진행중 | 0 |
| 대기 | 4 |

---

## 대기

### [TASK-010] 에이전트 간 의존성 문서화 `#docs` `#architecture`
- **우선순위**: 중간
- **설명**: 에이전트 간 호출 관계 다이어그램 생성
- **관련 파일**: `docs/architecture/`

### [TASK-011] 프로젝트 최적화 테스트 `#test` `#optimization`
- **우선순위**: 중간
- **설명**: 실제 외부 프로젝트에 에이전트 최적화 적용 테스트
- **내용**:
  - [ ] agent-generator로 새 프로젝트 에이전트 생성 테스트
  - [ ] code-convention-guide로 컨벤션 생성 테스트
  - [ ] project-profiler로 프로젝트 분석 테스트

### [TASK-012] MCP 서버 통합 테스트 `#test` `#mcp`
- **우선순위**: 낮음
- **설명**: qa-pipeline, doc-converter MCP 서버 동작 검증

### [TASK-013] E2E 테스터 에이전트 추가 `#feature` `#qa`
- **우선순위**: 낮음
- **설명**: step4-e2e-tester.md 에이전트 생성 (현재 backend-tester만 존재)

---

## 완료 (최근)

- [x] [TASK-009] Hook 스크립트 설정 완료 - Task 도구 포함 (2026-01-18)
- [x] [TASK-008] Maintenance 에이전트 그룹핑 (2026-01-18)
- [x] [TASK-007] 파일명 변경 (config-sync → config-synchronizer, project-setup → project-initializer) (2026-01-18)
- [x] [TASK-006] 에이전트 네이밍 규칙 문서 작성 (2026-01-18)
- [x] [TASK-005] _orchestrator 파일명 변경 (*-director로) (2026-01-18)
- [x] [TASK-004] code-convention-guide 에이전트 생성 (2026-01-18)
- [x] [TASK-003] demo 에이전트 분리 (qa → demo) (2026-01-18)
- [x] [TASK-002] parallel-insight-tracker 에이전트 생성 (2026-01-18)
- [x] [TASK-001] task-tracker 필수 에이전트 등록 (2026-01-18)
