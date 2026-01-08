---
name: commit
description: Git 커밋 생성. 변경사항을 분석하고 적절한 커밋 메시지를 자동 생성한다.
---

# Commit Skill

Git 커밋을 생성하는 스킬입니다.

## 사용법

```
/commit
/commit -m "메시지"
```

## 워크플로우

1. **변경사항 분석**
   - `git status` 확인
   - `git diff --staged` 확인
   - 변경된 파일 목록 파악

2. **커밋 메시지 생성**
   - 변경사항을 분석하여 적절한 메시지 작성
   - Conventional Commits 형식 준수

3. **커밋 실행**
   - `git commit` 실행
   - 결과 확인

## 커밋 메시지 형식

```
<type>(<scope>): <subject>

<body>

🤖 Generated with Claude Code
```

### Type

| Type | 설명 |
|------|------|
| feat | 새로운 기능 |
| fix | 버그 수정 |
| docs | 문서 변경 |
| style | 코드 스타일 (포맷팅) |
| refactor | 리팩토링 |
| test | 테스트 추가/수정 |
| chore | 빌드, 설정 변경 |

### 예시

```
feat(auth): 로그인 폼 유효성 검사 추가

- 이메일 형식 검증
- 비밀번호 최소 길이 검증
- 에러 메시지 표시

🤖 Generated with Claude Code
```

## 옵션

- `-m "메시지"`: 커밋 메시지 직접 지정
- `--amend`: 마지막 커밋 수정 (주의 필요)

## 주의사항

- 민감 정보가 포함된 파일은 커밋하지 않음 (.env, credentials 등)
- 커밋 전 테스트 통과 확인 권장
- force push 금지 (main/master 브랜치)
