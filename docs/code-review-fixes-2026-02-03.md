# 코드 리뷰 이슈 수정 보고서

> **작성일**: 2026-02-03
> **대상 파일**: `src/app.js`
> **수정된 이슈**: CRITICAL 1개, HIGH 3개

---

## 목차

1. [개요](#1-개요)
2. [수정된 이슈 상세](#2-수정된-이슈-상세)
3. [테스트 및 검증](#3-테스트-및-검증)
4. [향후 개선 사항](#4-향후-개선-사항)

---

## 1. 개요

### 1.1 수정 배경

Split Pane 기능 구현 후 진행된 코드 리뷰에서 보안 취약점과 안정성 이슈가 발견되어 즉시 수정을 진행했습니다.

### 1.2 수정 요약

| 우선순위 | 이슈 | 위치 | 상태 |
|---------|------|------|------|
| CRITICAL | XSS 취약점 | showToast (라인 23) | ✅ 수정 완료 |
| HIGH | 상태 불일치 | saveTabLayout (라인 2333) | ✅ 수정 완료 |
| HIGH | Null 체크 누락 | toggleMaximize (라인 1983) | ✅ 수정 완료 |
| HIGH | Race Condition | splitActivePane (라인 2027) | ✅ 수정 완료 |

---

## 2. 수정된 이슈 상세

### 2.1 CRITICAL: XSS 취약점 in showToast

#### 문제점

사용자 입력 메시지가 HTML 이스케이프 없이 직접 innerHTML에 삽입되어 XSS 공격에 취약했습니다.

```javascript
// 수정 전 (취약한 코드)
toast.innerHTML = `
  <span class="toast__icon">${type === 'error' ? '⚠' : type === 'success' ? '✓' : 'ℹ'}</span>
  <span class="toast__message">${message}</span>
  <button class="toast__close">&times;</button>
`;
```

**공격 시나리오**:
```javascript
showToast('<img src=x onerror="alert(document.cookie)">');
// → 악의적 스크립트 실행 가능
```

#### 수정 내용

`escapeHtml()` 함수를 사용하여 메시지를 안전하게 이스케이프:

```javascript
// 수정 후 (안전한 코드)
toast.innerHTML = `
  <span class="toast__icon">${type === 'error' ? '⚠' : type === 'success' ? '✓' : 'ℹ'}</span>
  <span class="toast__message">${escapeHtml(message)}</span>
  <button class="toast__close">&times;</button>
`;
```

#### 보안 효과

- XSS 공격 벡터 차단
- 특수 문자 자동 이스케이프 (`<`, `>`, `&`, `"`, `'`)
- 사용자 입력 안전성 보장

---

### 2.2 HIGH: State Inconsistency in saveTabLayout

#### 문제점

`saveTabLayout()` 함수가 `splitRoot` 객체를 직접 참조로 저장하여 다른 탭 작업 시 공유 객체 문제가 발생했습니다.

```javascript
// 수정 전 (참조 공유 문제)
function saveTabLayout(sessionId) {
  if (sessionId && state.splitMode && state.splitRoot) {
    state.tabLayouts.set(sessionId, {
      splitRoot: state.splitRoot,  // 얕은 복사 - 참조 공유!
      splitMode: state.splitMode
    });
  }
}
```

**문제 시나리오**:
```
1. Tab A에서 Split 레이아웃 생성 → saveTabLayout(A) 호출
2. Tab B로 전환 → Split 수정
3. Tab A로 복귀 → Tab B의 수정사항이 Tab A에도 반영됨 (의도하지 않음)
```

#### 수정 내용

Deep clone을 통한 독립적인 레이아웃 저장:

```javascript
// 수정 후 (깊은 복사)
function saveTabLayout(sessionId) {
  if (sessionId && state.splitMode && state.splitRoot) {
    // Deep clone via serialize/deserialize to avoid shared reference issues
    const clonedRoot = deserializeSplitTree(serializeSplitTree(state.splitRoot));
    state.tabLayouts.set(sessionId, {
      splitRoot: clonedRoot,
      splitMode: state.splitMode
    });
  }
}
```

#### 기술적 세부사항

**직렬화/역직렬화 방식 사용 이유**:
- 기존에 구현된 `serializeSplitTree()`, `deserializeSplitTree()` 함수 재사용
- 이진 트리 구조를 완전히 복제
- `SplitNode` 클래스 인스턴스도 올바르게 재생성

**대안 방식과 비교**:
- `JSON.parse(JSON.stringify())`: 클래스 메서드 손실
- `structuredClone()`: 브라우저 호환성 이슈
- ✅ **serialize/deserialize**: 타입 안전성 보장

---

### 2.3 HIGH: Missing Null Check in toggleMaximize

#### 문제점

`sessionId` 파라미터가 `null`일 때 체크하지 않고 바로 `splitMode` 검사로 진입하여 예상치 못한 동작 발생:

```javascript
// 수정 전 (null 체크 누락)
function toggleMaximize(sessionId = state.activeSessionId) {
  if (!state.splitMode || !state.splitRoot) {
    showToast('분할 모드에서만 사용 가능합니다', 'warning');
    return;
  }
  // sessionId가 null인 경우 처리되지 않음
```

**문제 시나리오**:
```
1. 모든 탭을 닫음 → state.activeSessionId = null
2. toggleMaximize() 호출 (예: 키보드 단축키)
3. sessionId = null로 진행
4. state.maximizedSession === null 조건 통과
5. renderMaximizedView(null) 호출 → 에러 발생
```

#### 수정 내용

함수 초기에 `sessionId` null 체크 추가:

```javascript
// 수정 후 (null 체크 추가)
function toggleMaximize(sessionId = state.activeSessionId) {
  if (!sessionId) {
    showToast('활성 세션이 없습니다', 'warning');
    return;
  }
  if (!state.splitMode || !state.splitRoot) {
    showToast('분할 모드에서만 사용 가능합니다', 'warning');
    return;
  }
  // 이후 로직 안전하게 진행
```

#### 방어적 프로그래밍 개선

- 함수 입력값 검증 강화
- 사용자에게 명확한 에러 메시지 제공
- 예외 상황에서 안전하게 종료

---

### 2.4 HIGH: Race Condition in splitActivePane

#### 문제점

비동기 함수 `splitActivePane()`이 동시에 여러 번 호출될 때 충돌 발생:

```javascript
// 수정 전 (동시성 제어 없음)
async function splitActivePane(direction) {
  if (!state.activeSessionId) return;

  // Check session limit
  if (state.sessions.size >= MAX_SESSIONS) {
    showToast(`최대 세션 수(${MAX_SESSIONS}개)에 도달했습니다`, 'warning');
    return;
  }

  const leafNode = findLeafNode(state.splitRoot, state.activeSessionId);
  if (!leafNode) return;

  const newSession = await createSession(...);  // 비동기!

  // 여기서 다른 호출이 동시에 진행되면 트리 구조 손상 가능
  leafNode.split(direction, newSession.id);
  renderSplitLayout();
}
```

**경쟁 조건 시나리오**:
```
Time  | Call 1                    | Call 2
------|---------------------------|---------------------------
T0    | splitActivePane() 시작    |
T1    | createSession() 대기 중   | splitActivePane() 시작
T2    | createSession() 대기 중   | createSession() 대기 중
T3    | leafNode.split() 실행     | leafNode.split() 실행
T4    | → 트리 구조 손상!         | → 트리 구조 손상!
```

#### 수정 내용

`splitInProgress` 플래그를 통한 동시성 제어:

```javascript
// state 객체에 플래그 추가
const state = {
  // ... 기존 필드들
  splitInProgress: false,  // 분할 작업 진행 중 플래그
};

// 수정 후 (동시성 제어 추가)
async function splitActivePane(direction) {
  if (!state.activeSessionId) return;

  // Prevent race condition - only one split operation at a time
  if (state.splitInProgress) return;
  state.splitInProgress = true;

  try {
    // 기존 로직 모두 try 블록 안에서 실행
    if (state.sessions.size >= MAX_SESSIONS) {
      showToast(`최대 세션 수(${MAX_SESSIONS}개)에 도달했습니다`, 'warning');
      return;
    }

    const leafNode = findLeafNode(state.splitRoot, state.activeSessionId);
    if (!leafNode) return;

    const session = state.sessions.get(state.activeSessionId);
    const newSession = await createSession(
      `${session.name} (split)`,
      session.projectPath,
      session.projectId
    );

    if (!newSession) return;

    leafNode.split(direction, newSession.id);
    renderSplitLayout();

    showToast(`화면 ${direction === 'horizontal' ? '가로' : '세로'} 분할`, 'success', 2000);
  } finally {
    state.splitInProgress = false;  // 성공/실패 관계없이 항상 해제
  }
}
```

#### 동시성 제어 상세

**Guard 패턴**:
- 진입 시 플래그 체크 → 이미 실행 중이면 즉시 반환
- 실행 시작 전 플래그 설정
- `finally` 블록에서 반드시 플래그 해제 (예외 발생해도)

**장점**:
- 동시 호출 차단
- 트리 구조 무결성 보장
- 메모리 누수 방지 (항상 finally에서 해제)

**사용자 경험**:
- 빠른 연속 클릭 시 중복 실행 방지
- 의도하지 않은 다중 분할 방지

---

## 3. 테스트 및 검증

### 3.1 수정 전후 비교

| 테스트 케이스 | 수정 전 | 수정 후 |
|--------------|---------|---------|
| XSS 메시지 입력 | ❌ 스크립트 실행됨 | ✅ 안전하게 이스케이프 |
| 탭 간 레이아웃 독립성 | ❌ 공유 참조 문제 | ✅ 완전히 독립된 복사본 |
| 세션 없이 최대화 | ❌ 에러 발생 | ✅ 경고 메시지 표시 |
| 빠른 연속 분할 | ❌ 트리 구조 손상 | ✅ 하나씩 순차 처리 |

### 3.2 검증 방법

#### XSS 테스트
```javascript
// 수정 후 테스트
showToast('<script>alert("XSS")</script>');
// 결과: 스크립트가 실행되지 않고 텍스트로 표시됨
```

#### 레이아웃 독립성 테스트
```
1. Tab A 생성 → 가로 분할
2. saveTabLayout(A) 호출
3. Tab B로 전환 → 세로 분할
4. Tab A로 복귀
5. 확인: Tab A는 가로 분할 상태 유지 (✅)
```

#### Race Condition 테스트
```javascript
// 빠른 연속 호출 시뮬레이션
splitActivePane('horizontal');
splitActivePane('vertical');  // 즉시 반환
splitActivePane('horizontal'); // 즉시 반환
// 결과: 첫 번째 호출만 실행됨 (✅)
```

---

## 4. 향후 개선 사항

### 4.1 보안 강화

- [ ] 모든 사용자 입력 지점에 대한 XSS 감사
- [ ] Content Security Policy (CSP) 적용 고려
- [ ] 입력 검증 라이브러리 도입 (DOMPurify 등)

### 4.2 상태 관리 개선

- [ ] Immutable 데이터 구조 도입 (Immer.js 등)
- [ ] 상태 변경 추적 로깅
- [ ] Redux/Zustand 같은 상태 관리 라이브러리 검토

### 4.3 동시성 제어

- [ ] 다른 비동기 함수들에도 동시성 제어 적용
- [ ] 전역 큐 시스템 구현 검토
- [ ] 작업 취소 기능 추가

### 4.4 테스트 자동화

- [ ] Unit Test 작성 (Jest)
- [ ] E2E 테스트 작성 (Playwright)
- [ ] CI/CD 파이프라인에 테스트 통합

---

## 5. 결론

### 5.1 수정 효과

- **보안 향상**: XSS 취약점 제거로 사용자 데이터 보호
- **안정성 증가**: Race condition 및 null 참조 에러 방지
- **데이터 무결성**: 탭별 레이아웃 독립성 보장

### 5.2 코드 품질 평가

| 항목 | 수정 전 | 수정 후 |
|------|---------|---------|
| 보안 | ⚠️ 취약점 존재 | ✅ XSS 차단 |
| 안정성 | ⚠️ Race condition | ✅ 동시성 제어 |
| 데이터 무결성 | ⚠️ 참조 공유 | ✅ Deep clone |
| 에러 처리 | ⚠️ Null 체크 누락 | ✅ 방어적 프로그래밍 |

### 5.3 기술 부채 감소

이번 수정으로 다음과 같은 기술 부채가 해결되었습니다:

1. **보안 부채**: XSS 취약점 제거
2. **설계 부채**: 상태 관리 개선 (Deep clone 도입)
3. **구현 부채**: Race condition 해결
4. **테스트 부채**: 검증 방법 수립

---

## 참고 자료

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [JavaScript Concurrency Patterns](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
- [Defensive Programming](https://en.wikipedia.org/wiki/Defensive_programming)
- [Deep Clone vs Shallow Clone](https://developer.mozilla.org/en-US/docs/Glossary/Deep_copy)

---

*이 문서는 2026-02-03 코드 리뷰에서 발견된 이슈들의 수정 내역을 기록합니다.*
