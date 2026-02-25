# 탭 분할 화면 (Split Pane) 기능 연구 보고서

> **작성일**: 2024년
> **버전**: Phase 8.1
> **상태**: 구현 완료 (개선 가능)

---

## 목차

1. [개요](#1-개요)
2. [현재 구현 분석](#2-현재-구현-분석)
3. [아키텍처 설계](#3-아키텍처-설계)
4. [핵심 알고리즘](#4-핵심-알고리즘)
5. [사용자 인터페이스](#5-사용자-인터페이스)
6. [기술적 도전과 해결책](#6-기술적-도전과-해결책)
7. [유사 애플리케이션 비교](#7-유사-애플리케이션-비교)
8. [개선 제안](#8-개선-제안)
9. [결론](#9-결론)

---

## 1. 개요

### 1.1 기능 정의

**탭 분할 화면(Split Pane)**은 하나의 화면에서 여러 터미널 세션을 동시에 표시하고 제어할 수 있는 기능입니다.

### 1.2 사용 목적

| 사용 사례 | 설명 |
|----------|------|
| 로그 모니터링 | 한쪽에서 서버 실행, 다른쪽에서 로그 tail |
| 빌드 & 테스트 | 한쪽에서 빌드, 다른쪽에서 테스트 실행 |
| 프론트/백엔드 동시 개발 | 프론트엔드와 백엔드 서버 동시 실행 |
| 파일 비교 | 두 디렉토리 동시 탐색 |
| SSH 다중 접속 | 여러 서버 동시 관리 |

### 1.3 핵심 요구사항

1. **가로/세로 분할**: 화면을 수평 또는 수직으로 분할
2. **다중 분할**: 2개 이상의 창으로 분할 가능
3. **크기 조절**: 드래그로 분할 비율 조정
4. **독립 제어**: 각 터미널이 독립적으로 동작
5. **포커스 관리**: 활성 창 시각적 표시

---

## 2. 현재 구현 분석

### 2.1 구현된 기능

| 기능 | 상태 | 설명 |
|------|------|------|
| 가로 분할 | ✅ 완료 | `Ctrl+Shift+D` |
| 세로 분할 | ✅ 완료 | `Ctrl+Shift+E` |
| 드래그 크기 조절 | ✅ 완료 | 마우스 드래그로 비율 조정 |
| 다중 분할 | ✅ 완료 | 무제한 재귀 분할 |
| 활성 창 표시 | ✅ 완료 | 테두리 강조 |
| 분할 창 닫기 | ✅ 완료 | 탭 닫기 시 자동 처리 |

### 2.2 파일 구조

```
src/
├── app.js
│   ├── class SplitNode        # 분할 트리 노드
│   ├── initSplitMode()        # 분할 모드 초기화
│   ├── splitHorizontal()      # 가로 분할
│   ├── splitVertical()        # 세로 분할
│   ├── splitActivePane()      # 활성 창 분할
│   ├── findLeafNode()         # 리프 노드 검색
│   ├── renderSplitLayout()    # 레이아웃 렌더링
│   ├── renderSplitNode()      # 노드 렌더링 (재귀)
│   ├── startSplitResize()     # 크기 조절 시작
│   ├── closeSplitPane()       # 분할 창 닫기
│   └── removeLeafNode()       # 리프 노드 제거
│
└── style.css
    ├── .terminal-container--split
    ├── .split-container
    ├── .split-container--horizontal
    ├── .split-container--vertical
    ├── .split-pane
    ├── .terminal-wrapper--split
    └── .split-resizer
```

### 2.3 상태 관리

```javascript
const state = {
  splitMode: false,           // 분할 모드 활성화 여부
  splitRoot: null,            // SplitNode 트리 루트
  activeSessionId: null,      // 현재 활성 세션
  sessions: new Map(),        // 모든 세션 데이터
};
```

---

## 3. 아키텍처 설계

### 3.1 이진 트리 구조

분할 레이아웃은 **이진 트리(Binary Tree)** 구조로 관리됩니다.

```
                    [Root]
                   /      \
            [Horizontal]   [Leaf: Session3]
               /    \
    [Leaf: Session1]  [Leaf: Session2]
```

**시각적 표현:**
```
┌─────────────────────────────────┬─────────────────────────────────┐
│                                 │                                 │
│         Session 1               │                                 │
│                                 │                                 │
├─────────────────────────────────┤         Session 3               │
│                                 │                                 │
│         Session 2               │                                 │
│                                 │                                 │
└─────────────────────────────────┴─────────────────────────────────┘
```

### 3.2 SplitNode 클래스

```javascript
class SplitNode {
  constructor(type = 'leaf', sessionId = null) {
    this.type = type;           // 'horizontal' | 'vertical' | 'leaf'
    this.ratio = 0.5;           // 분할 비율 (0.0 ~ 1.0)
    this.children = null;       // [SplitNode, SplitNode] 또는 null
    this.sessionId = sessionId; // 리프 노드만 해당
  }

  isLeaf() {
    return this.type === 'leaf';
  }

  split(direction, newSessionId) {
    // 리프 노드를 분기 노드로 변환
    const oldSessionId = this.sessionId;
    this.type = direction;
    this.sessionId = null;
    this.children = [
      new SplitNode('leaf', oldSessionId),
      new SplitNode('leaf', newSessionId)
    ];
    return this.children[1];
  }
}
```

### 3.3 노드 타입

| 타입 | 설명 | children | sessionId |
|------|------|----------|-----------|
| `leaf` | 터미널을 포함하는 말단 노드 | `null` | 세션 ID |
| `horizontal` | 가로 분할 (위/아래) | `[child1, child2]` | `null` |
| `vertical` | 세로 분할 (좌/우) | `[child1, child2]` | `null` |

---

## 4. 핵심 알고리즘

### 4.1 분할 알고리즘

```
입력: 활성 세션 ID, 분할 방향 (horizontal/vertical)
출력: 새로운 분할 레이아웃

1. 현재 splitRoot에서 activeSessionId를 가진 리프 노드 검색
2. 새 터미널 세션 생성
3. 찾은 리프 노드를 분기 노드로 변환:
   - type을 'leaf'에서 direction으로 변경
   - sessionId를 null로 설정
   - children에 [기존세션노드, 새세션노드] 할당
4. 레이아웃 다시 렌더링
```

**시간 복잡도**: O(n) - n은 분할 수

### 4.2 리프 노드 검색 (DFS)

```javascript
function findLeafNode(node, sessionId) {
  if (!node) return null;

  // 리프 노드인 경우
  if (node.isLeaf()) {
    return node.sessionId === sessionId ? node : null;
  }

  // 분기 노드인 경우 - 자식 탐색
  return findLeafNode(node.children[0], sessionId) ||
         findLeafNode(node.children[1], sessionId);
}
```

### 4.3 레이아웃 렌더링 (재귀)

```javascript
function renderSplitNode(node) {
  // 베이스 케이스: 리프 노드
  if (node.isLeaf()) {
    const session = state.sessions.get(node.sessionId);
    session.wrapper.classList.add('terminal-wrapper--split');
    return session.wrapper;
  }

  // 재귀 케이스: 분기 노드
  const container = document.createElement('div');
  container.className = `split-container split-container--${node.type}`;

  const pane1 = document.createElement('div');
  pane1.style.flex = node.ratio;
  pane1.appendChild(renderSplitNode(node.children[0]));

  const resizer = createResizer(node);

  const pane2 = document.createElement('div');
  pane2.style.flex = 1 - node.ratio;
  pane2.appendChild(renderSplitNode(node.children[1]));

  container.append(pane1, resizer, pane2);
  return container;
}
```

### 4.4 노드 제거 알고리즘

```
입력: 삭제할 세션 ID
출력: 정리된 트리

1. 삭제할 세션을 가진 리프 노드 찾기
2. 부모 노드의 다른 자식(형제 노드) 찾기
3. 부모 노드를 형제 노드로 교체:
   - 형제가 리프면: 부모를 리프로 변환
   - 형제가 분기면: 부모를 형제 구조로 교체
4. 루트가 리프 하나만 남으면 분할 모드 종료
```

---

## 5. 사용자 인터페이스

### 5.1 단축키

| 단축키 | 동작 |
|--------|------|
| `Ctrl+Shift+D` | 가로 분할 (위/아래) |
| `Ctrl+Shift+E` | 세로 분할 (좌/우) |
| `Ctrl+W` | 현재 창 닫기 |

### 5.2 마우스 인터랙션

| 동작 | 결과 |
|------|------|
| 분할선 드래그 | 창 크기 비율 조정 (10%~90%) |
| 창 클릭 | 해당 터미널 활성화 |

### 5.3 컨텍스트 메뉴

```
우클릭 메뉴:
├── Split Horizontal (가로 분할)
├── Split Vertical (세로 분할)
└── ...
```

### 5.4 시각적 피드백

```css
/* 활성 창 테두리 강조 */
.terminal-wrapper--split.terminal-wrapper--active {
  border-color: var(--accent);  /* 파란색 테두리 */
}

/* 분할선 호버 효과 */
.split-resizer:hover {
  background: var(--accent);    /* 파란색으로 변경 */
}
```

---

## 6. 기술적 도전과 해결책

### 6.1 터미널 크기 조정

**문제**: 분할 시 xterm.js 터미널이 새 크기에 맞지 않음

**해결**:
```javascript
// 레이아웃 변경 후 모든 터미널 fit 호출
setTimeout(() => {
  state.sessions.forEach(session => {
    session.fitAddon.fit();
  });
}, 100);  // DOM 업데이트 대기
```

### 6.2 세션 수 제한

**문제**: 무한 분할로 인한 리소스 고갈

**해결**:
```javascript
const MAX_SESSIONS = 20;

if (state.sessions.size >= MAX_SESSIONS) {
  showToast(`최대 세션 수(${MAX_SESSIONS}개)에 도달했습니다`, 'warning');
  return;
}
```

### 6.3 DOM 재사용

**문제**: 레이아웃 변경 시 터미널 DOM 재생성으로 인한 상태 손실

**해결**:
- 터미널 wrapper DOM을 `state.sessions`에 보관
- 레이아웃 변경 시 DOM을 이동만 하고 재생성하지 않음
- `session.wrapper`를 직접 새 위치에 appendChild

### 6.4 크기 조절 제한

**문제**: 너무 작은 창으로 분할 시 사용 불가

**해결**:
```javascript
// 최소/최대 비율 제한
node.ratio = Math.max(0.1, Math.min(0.9, newRatio));
```

```css
/* 최소 크기 보장 */
.split-pane {
  min-height: 50px;
  min-width: 50px;
}
```

---

## 7. 유사 애플리케이션 비교

### 7.1 기능 비교표

| 기능 | Shellhive | VS Code | Windows Terminal | iTerm2 | tmux |
|------|-----------|---------|------------------|--------|------|
| 가로 분할 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 세로 분할 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 다중 분할 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 드래그 크기 조절 | ✅ | ✅ | ✅ | ✅ | ❌ |
| 레이아웃 저장 | ❌ | ✅ | ❌ | ✅ | ✅ |
| 탭+분할 조합 | ⚠️ | ✅ | ✅ | ✅ | ✅ |
| 창 교환 | ❌ | ✅ | ❌ | ✅ | ✅ |
| 창 최대화 토글 | ❌ | ✅ | ❌ | ✅ | ✅ |
| 분할 잠금 | ❌ | ❌ | ❌ | ✅ | ❌ |
| 브로드캐스트 입력 | ❌ | ❌ | ❌ | ✅ | ✅ |

### 7.2 구현 방식 비교

| 앱 | 기술 스택 | 트리 구조 | 상태 관리 |
|-----|----------|----------|----------|
| **Shellhive** | Tauri + xterm.js | 이진 트리 (JS 클래스) | JavaScript 객체 |
| **VS Code** | Electron + xterm.js | 이진 트리 (TypeScript) | Redux-like |
| **Windows Terminal** | UWP/WinUI | 트리 구조 (C++) | WinRT 상태 |
| **iTerm2** | Cocoa (macOS) | N-ary 트리 (Obj-C) | NSDocument |
| **tmux** | C (Terminal Multiplexer) | 리스트 기반 | 서버 프로세스 |

---

## 8. 개선 제안

### 8.1 단기 개선 (우선순위 높음)

#### 8.1.1 레이아웃 저장/복원

```javascript
// 제안: 레이아웃 직렬화
function serializeSplitTree(node) {
  if (node.isLeaf()) {
    return { type: 'leaf', sessionId: node.sessionId };
  }
  return {
    type: node.type,
    ratio: node.ratio,
    children: [
      serializeSplitTree(node.children[0]),
      serializeSplitTree(node.children[1])
    ]
  };
}

// 세션 복원 시 레이아웃도 복원
```

#### 8.1.2 창 포커스 순환

```javascript
// 제안: Ctrl+방향키로 창 이동
function focusNextPane(direction) {
  const leaves = getAllLeafNodes(state.splitRoot);
  const currentIndex = leaves.findIndex(
    n => n.sessionId === state.activeSessionId
  );
  // direction에 따라 다음 창 계산
}
```

#### 8.1.3 탭과 분할 독립 관리

현재는 탭 전환 시 분할 상태가 유지되지 않습니다.

```javascript
// 제안: 각 탭이 자체 분할 레이아웃 보유
const state = {
  tabLayouts: new Map(),  // tabId -> SplitNode
};
```

### 8.2 중기 개선 (기능 확장)

#### 8.2.1 창 교환 (Swap)

```javascript
// 제안: 두 창의 위치 교환
function swapPanes(sessionId1, sessionId2) {
  const node1 = findLeafNode(state.splitRoot, sessionId1);
  const node2 = findLeafNode(state.splitRoot, sessionId2);
  [node1.sessionId, node2.sessionId] = [node2.sessionId, node1.sessionId];
  renderSplitLayout();
}
```

#### 8.2.2 창 최대화 토글

```javascript
// 제안: 특정 창 일시적 최대화
let maximizedSession = null;

function toggleMaximize(sessionId) {
  if (maximizedSession === sessionId) {
    maximizedSession = null;
    renderSplitLayout();
  } else {
    maximizedSession = sessionId;
    renderMaximizedView(sessionId);
  }
}
```

#### 8.2.3 분할 프리셋

```javascript
// 제안: 일반적인 레이아웃 프리셋
const LAYOUT_PRESETS = {
  'two-columns': { type: 'vertical', ratio: 0.5 },
  'two-rows': { type: 'horizontal', ratio: 0.5 },
  'three-columns': { /* ... */ },
  'main-sidebar': { type: 'vertical', ratio: 0.7 },
  'grid-2x2': { /* ... */ },
};

function applyLayoutPreset(presetName) {
  // 프리셋에 맞게 분할 자동 생성
}
```

### 8.3 장기 개선 (고급 기능)

#### 8.3.1 브로드캐스트 입력

```javascript
// 제안: 모든 창에 동시 입력
let broadcastMode = false;

function toggleBroadcast() {
  broadcastMode = !broadcastMode;
}

// 입력 처리 시
if (broadcastMode) {
  state.sessions.forEach(session => {
    session.pty.write(input);
  });
}
```

#### 8.3.2 드래그 앤 드롭으로 창 이동

```javascript
// 제안: 창을 드래그하여 다른 위치로 이동
wrapper.draggable = true;
wrapper.addEventListener('dragstart', onPaneDragStart);
wrapper.addEventListener('drop', onPaneDrop);
```

#### 8.3.3 분할 동기화 스크롤

```javascript
// 제안: 여러 창의 스크롤 동기화 (로그 비교용)
function syncScroll(sourceId) {
  const sourceTerminal = state.sessions.get(sourceId).terminal;
  const scrollRatio = sourceTerminal.buffer.viewportY /
                      sourceTerminal.buffer.length;

  linkedSessions.forEach(sessionId => {
    const terminal = state.sessions.get(sessionId).terminal;
    terminal.scrollToLine(Math.floor(terminal.buffer.length * scrollRatio));
  });
}
```

---

## 9. 결론

### 9.1 현재 상태 평가

| 항목 | 점수 | 설명 |
|------|------|------|
| 기본 기능 | 9/10 | 핵심 분할 기능 모두 구현 |
| 사용성 | 7/10 | 단축키 지원, 직관적 UI |
| 안정성 | 8/10 | 메모리 관리, 세션 제한 |
| 확장성 | 6/10 | 트리 구조로 확장 용이하나 추가 기능 필요 |

### 9.2 개선 우선순위

1. **탭별 분할 레이아웃 독립** - 사용성 대폭 향상
2. **레이아웃 저장/복원** - 세션 복구 시 필수
3. **창 포커스 순환** - 키보드 전용 사용자 편의
4. **분할 프리셋** - 빠른 레이아웃 설정

### 9.3 결론

Shellhive의 현재 Split Pane 구현은 **이진 트리 기반의 견고한 아키텍처**를 갖추고 있으며, 기본적인 분할 기능은 완전히 동작합니다.

VS Code, Windows Terminal 등 주요 터미널 에뮬레이터와 비교했을 때 핵심 기능은 동등하지만, **레이아웃 저장**, **탭별 독립 분할**, **브로드캐스트 입력** 등의 고급 기능은 향후 개선이 필요합니다.

제안된 개선사항을 단계적으로 적용하면 iTerm2나 tmux 수준의 분할 기능을 달성할 수 있을 것으로 예상됩니다.

---

## 참고 자료

- [xterm.js 공식 문서](https://xtermjs.org/)
- [VS Code Terminal 소스코드](https://github.com/microsoft/vscode)
- [Windows Terminal 소스코드](https://github.com/microsoft/terminal)
- [iTerm2 분할 문서](https://iterm2.com/documentation-one-page.html)
- [tmux man page](https://man7.org/linux/man-pages/man1/tmux.1.html)

---

*이 문서는 Shellhive 프로젝트의 Split Pane 기능에 대한 기술 연구 보고서입니다.*
