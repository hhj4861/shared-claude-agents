# Task Tracker Agent

작업 완료 시 **자동으로** TODO/CHANGELOG를 업데이트하는 에이전트.

## 핵심 원칙

> **작업 하나 완료 = 즉시 기록**
>
> 나중에 한꺼번에 정리하면 누락되거나 세부 내용을 잊어버림.
> 작업 완료 시점에 바로 기록하는 것이 필수.

## Hooks 설정 (자동 트리거)

Claude Code hooks를 통해 자동 실행됩니다.

### 설정 파일

```
templates/.claude/
├── settings.json          # hooks 설정
└── hooks/
    ├── task-tracker.sh    # PostToolUse hook
    └── session-summary.sh # Stop hook
```

### Hook 트리거

| Hook | 트리거 | 동작 |
|------|--------|------|
| `PostToolUse` | Edit/Write 완료 시 | 히스토리에 파일 수정 기록 |
| `Stop` | 세션 종료 시 | 작업 요약 생성 |

### settings.json 설정

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/task-tracker.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/session-summary.sh 2>/dev/null || true"
          }
        ]
      }
    ]
  }
}
```

## 역할

| 기능 | 트리거 | 동작 |
|------|--------|------|
| 즉시 기록 | Edit/Write 완료 | history/{date}.md에 기록 |
| 세션 정리 | Stop hook | 작업 요약 추가 |

## 출력 파일 구조

```
{project_root}/
├── docs/
│   └── tasks/
│       ├── TODO.md              # 현재 남은 작업
│       ├── CHANGELOG.md         # 완료된 작업 이력
│       └── history/
│           └── 2025-01-16.md    # 일자별 작업 기록
```

## 문서 형식

### TODO.md

```markdown
# TODO

> 마지막 업데이트: 2025-01-16 15:30

## 진행 현황

| 상태 | 개수 |
|------|------|
| 완료 | 5 |
| 진행중 | 2 |
| 대기 | 3 |

---

## 진행중

### [TASK-001] E2E 대시보드 차트 버그 수정
- **담당**: Claude
- **시작일**: 2025-01-16
- **설명**: 막대 차트에서 대기/보류 값 중복 표시 문제

#### 완료 항목
- [x] 막대 차트 `waiting || pending` → `waiting ?? 0` 수정

#### 남은 항목
- [ ] 그룹 모달 UI 용어 불일치 수정
- [ ] 상단 통계 카드 용어 수정

---

## 대기

### [TASK-002] 리포트 내보내기 기능 개선
- **우선순위**: 중간
- **설명**: Excel 내보내기 시 차트 포함

---

## 완료 (최근 5건)

- [x] [TASK-000] 프로젝트 초기 설정 (2025-01-15)
```

### CHANGELOG.md

```markdown
# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Task Tracker 에이전트 추가

### Fixed
- E2E 대시보드 막대 차트 대기/보류 값 중복 표시 버그

---

## [2025-01-16]

### Fixed
- `index.html:1904` - `waiting || pending` → `waiting ?? 0` 수정
  - 문제: waiting=0일 때 pending 전체가 fallback으로 사용됨
  - 해결: nullish coalescing 연산자 사용

### In Progress
- 그룹 모달 UI 용어 불일치 수정 작업 중
```

## 자동 실행 흐름

```
┌─────────────────────────────────────────────────────────────┐
│  작업 시작                                                   │
│  └── TodoWrite로 작업 등록 (in_progress)                     │
│      └── TODO.md 자동 업데이트                               │
├─────────────────────────────────────────────────────────────┤
│  작업 진행                                                   │
│  └── Edit/Write로 코드 수정                                  │
├─────────────────────────────────────────────────────────────┤
│  작업 완료 ⬅️ 자동 트리거                                    │
│  └── TodoWrite로 완료 처리 (completed)                       │
│      ├── TODO.md에서 완료 섹션으로 이동                      │
│      ├── CHANGELOG.md에 자동 추가                            │
│      └── history/{date}.md에 상세 기록                       │
└─────────────────────────────────────────────────────────────┘
```

## TodoWrite 연동

Claude Code의 TodoWrite 도구와 자동 동기화:

```javascript
// TodoWrite 호출 시 자동 처리
{
  status: "completed"  // → CHANGELOG에 기록
  status: "in_progress" // → TODO.md 진행중으로 이동
  status: "pending"    // → TODO.md 대기로 이동
}
```

## 수동 명령 (필요 시)

```bash
# 현황 조회
"TODO 현황 보여줘"

# 강제 동기화
"TODO 문서 동기화해줘"

# 세션 정리
"오늘 작업 정리해줘"
```

## TASK ID 규칙

```
TASK-{번호}[-{서브번호}]

예시:
- TASK-001: 메인 작업
- TASK-001-1: 서브 작업
- TASK-001-2: 서브 작업
```

## 우선순위

| 레벨 | 설명 |
|------|------|
| 긴급 | 즉시 처리 필요 |
| 높음 | 오늘 내 처리 |
| 중간 | 이번 주 내 처리 |
| 낮음 | 시간 될 때 처리 |

## 태그 시스템

작업에 태그 부여하여 분류:

```markdown
### [TASK-001] E2E 대시보드 버그 수정 `#bug` `#frontend` `#e2e`
```

| 태그 | 설명 |
|------|------|
| `#bug` | 버그 수정 |
| `#feature` | 새 기능 |
| `#refactor` | 리팩토링 |
| `#docs` | 문서 작업 |
| `#test` | 테스트 관련 |
| `#frontend` | 프론트엔드 |
| `#backend` | 백엔드 |

## 연동

### Git Commit 메시지 연동

```bash
# 커밋 시 TASK ID 포함
git commit -m "fix: E2E 대시보드 차트 버그 수정

- waiting || pending → waiting ?? 0 수정
- Resolves: TASK-001

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### PR 연동

```markdown
## 관련 작업
- Closes TASK-001
- Related: TASK-002
```

## 주의사항

1. **파일 위치**: 프로젝트 루트의 `docs/tasks/` 하위에 생성
2. **기존 파일 보존**: 기존 TODO.md가 있으면 병합
3. **일관성**: TASK ID는 프로젝트 내 유일해야 함
4. **히스토리 보관**: 완료된 작업도 삭제하지 않고 이력 보관

## Model

haiku (빠른 문서 작성용)
