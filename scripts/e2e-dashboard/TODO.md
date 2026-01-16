# E2E 대시보드 수정 TODO

## 완료된 작업

### 1. 막대 차트 대기 값 버그 수정
- **파일**: `public/index.html:1904`
- **문제**: `waiting || pending` 사용 시 `waiting=0`이면 `pending`(보류+대기 합계)이 표시됨
- **수정**: `waiting ?? 0`으로 변경하여 0도 정상 값으로 처리
- **상태**: ✅ 완료

---

## 남은 작업

### 2. 그룹 모달 UI 용어 불일치 수정
현재 `pending`(보류+대기 합계)을 "대기"로 표시하는 곳들이 있음

| 위치 | 현재 코드 | 문제 |
|------|----------|------|
| 2259-2260 | `${group.stats.pending}` → "대기" | pending은 보류+대기 합계 |
| 1696 | `대기: ${group.stats.pending}` | 동일 |
| 2275 | `대기 <span>${group.stats.pending}</span>` | 동일 |
| 1615 | `<span class="group-stat pending">${group.stats.pending}</span>` | 라벨 없음 |

**수정 옵션:**
- **A안**: `pending` → `waiting`으로 변경 (대기만 표시)
- **B안**: 라벨을 "대기" → "보류/대기"로 변경 (합계 표시 유지)
- **C안**: 보류와 대기를 분리하여 각각 표시

### 3. 상단 통계 카드 용어 수정
- **파일**: `public/index.html:1277-1279`
- **현재**: `pending`을 "보류"로 표시
- **문제**: 실제로는 보류+대기 합계인데 "보류"라고만 표시

```html
<!-- 현재 -->
<div class="stat-card pending">
  <div class="value" id="statPending"></div>
  <div class="label">보류</div>
</div>
```

**수정 옵션:**
- "보류" → "보류/대기" 또는 "미완료"로 변경

---

## 용어 정의

| 필드 | 의미 | 조건 |
|------|------|------|
| `pending_hold` | 보류 | `result.status === 'pending'` |
| `waiting` | 대기 | result가 없거나 다른 status |
| `pending` | 보류+대기 합계 | `pending_hold + waiting` (레거시) |

---

## 테스트 케이스

수정 후 다음 케이스 확인 필요:

1. **보류만 있는 경우**: pending_hold=3, waiting=0
   - 기대: 보류 막대=3, 대기 막대=0

2. **대기만 있는 경우**: pending_hold=0, waiting=3
   - 기대: 보류 막대=0, 대기 막대=3

3. **둘 다 있는 경우**: pending_hold=2, waiting=3
   - 기대: 보류 막대=2, 대기 막대=3
