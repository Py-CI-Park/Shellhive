# Shellhive 탭 관리 기능 강화 연구 보고서

- **작성일**: 2026-02-01
- **작성자**: Claude Code (Architect Agent)
- **연구 대상**: 탭 필터링, 분할 뷰, 그룹화, 고급 탭 관리

---

## 요약

Shellhive의 현재 탭 관리 시스템은 기본적인 탭 생성/삭제/전환/드래그앤드롭 재정렬 기능을 갖추고 있으나, 프로젝트-탭 연결 관계, 분할 뷰, 탭 그룹화, 고급 탭 관리 기능이 부재합니다. 본 보고서는 4가지 핵심 기능 영역에 대한 상세 설계와 구현 로드맵을 제시합니다.

---

## 1. 현재 구현 분석

### 1.1 현재 탭 시스템 구조

**파일 위치**: `src/app.js`

| 구성 요소 | 현재 구현 | 위치 (라인) |
|----------|----------|------------|
| 세션 상태 관리 | `state.sessions` Map | 94-108 |
| 탭 생성 | `createTab(session)` | 572-609 |
| 탭 활성화 | `activateSession(id)` | 630-652 |
| 탭 닫기 | `closeSession(id)` | 654-687 |
| 드래그앤드롭 | `handleTabDrag*` 함수들 | 694-738 |
| 컨텍스트 메뉴 | `showTabContextMenu()` | 740-776 |
| 키보드 단축키 | `handleKeyboardShortcuts()` | 791-822 |

### 1.2 현재 세션 데이터 구조

```javascript
const session = {
  id,                    // 고유 ID (session-1, session-2...)
  name: sessionName,     // 탭 표시 이름
  terminal,              // xterm.js 인스턴스
  fitAddon,              // FitAddon 인스턴스
  wrapper,               // DOM wrapper element
  ptySessionId,          // Rust PTY 세션 ID
  unlistenPtyData,       // PTY 이벤트 리스너
  unlistenPtyExit,       // PTY 종료 리스너
  unlistenPtyError,      // PTY 에러 리스너
  status,                // connecting/running/exited
  projectName,           // 프로젝트 이름 (있을 경우)
};
```

### 1.3 현재 HTML 구조

```html
<div class="tabs" id="tabsContainer">
  <div class="tabs__list" id="tabsList"></div>
  <button class="tabs__new-btn" id="newTabBtn">+</button>
</div>
<div class="terminal-container" id="terminalContainer"></div>
```

### 1.4 현재 프로젝트-탭 관계의 문제점

| 문제 | 설명 |
|------|------|
| 1:N 관계 추적 없음 | 프로젝트에 몇 개의 탭이 있는지 알 수 없음 |
| 프로젝트별 필터링 불가 | 특정 프로젝트의 탭만 표시 불가능 |
| 역추적 어려움 | 탭에서 원본 프로젝트 ID 역추적 불가 (projectName만 저장) |

---

## 2. 기능별 상세 설계

---

### 2.1 프로젝트별 탭 필터링/뷰

#### 2.1.1 요구사항

| 기능 | 설명 |
|-----|-----|
| 프로젝트 선택 시 필터링 | 사이드바 프로젝트 클릭 시 해당 프로젝트의 탭만 표시 |
| 전체 보기 토글 | 모든 탭 보기 ↔ 프로젝트별 뷰 전환 |
| 연결 관계 관리 | 프로젝트 ID와 탭 ID 매핑 |

#### 2.1.2 데이터 구조 변경

**세션 확장**:
```javascript
const session = {
  // ... 기존 필드
  projectId: null,           // 연결된 프로젝트 ID (없으면 null)
  projectPath: null,         // 프로젝트 경로 (빠른 조회용)
};
```

**새로운 상태 필드**:
```javascript
const state = {
  // ... 기존 필드
  activeProjectFilter: null, // null이면 전체 보기, 값이 있으면 해당 프로젝트만
  projectTabMap: new Map(),  // projectId -> Set<sessionId> 매핑
};
```

#### 2.1.3 UI 설계

**사이드바 프로젝트 항목 수정**:
```html
<li class="sidebar__item" data-project-id="...">
  <span class="sidebar__item-icon">📁</span>
  <span class="sidebar__item-name">프로젝트명</span>
  <span class="sidebar__item-tab-count">(3)</span>  <!-- 탭 개수 표시 -->
  <button class="sidebar__item-filter" title="이 프로젝트만 보기">🔍</button>
  <button class="sidebar__item-delete">&times;</button>
</li>
```

**탭 바 필터 인디케이터**:
```html
<div class="tabs">
  <div class="tabs__filter-indicator" id="filterIndicator">
    <span>📁 MyProject</span>
    <button class="tabs__clear-filter" title="전체 보기">&times;</button>
  </div>
  <div class="tabs__list" id="tabsList"></div>
  <button class="tabs__new-btn" id="newTabBtn">+</button>
</div>
```

#### 2.1.4 핵심 함수 설계

```javascript
// 프로젝트 필터 적용
function setProjectFilter(projectId) {
  state.activeProjectFilter = projectId;
  renderFilteredTabs();
  updateFilterIndicator();
}

// 필터 해제 (전체 보기)
function clearProjectFilter() {
  state.activeProjectFilter = null;
  renderFilteredTabs();
  updateFilterIndicator();
}

// 필터링된 탭 렌더링
function renderFilteredTabs() {
  const allTabs = document.querySelectorAll('.tab');
  allTabs.forEach(tab => {
    const sessionId = tab.dataset.sessionId;
    const session = state.sessions.get(sessionId);

    if (state.activeProjectFilter === null) {
      tab.style.display = '';
    } else {
      tab.style.display =
        session.projectId === state.activeProjectFilter ? '' : 'none';
    }
  });
}

// 프로젝트-탭 매핑 업데이트
function linkSessionToProject(sessionId, projectId) {
  const session = state.sessions.get(sessionId);
  if (session) {
    session.projectId = projectId;
  }

  if (!state.projectTabMap.has(projectId)) {
    state.projectTabMap.set(projectId, new Set());
  }
  state.projectTabMap.get(projectId).add(sessionId);
  updateProjectTabCount(projectId);
}
```

---

### 2.2 탭 분할 (Split View)

#### 2.2.1 요구사항

| 기능 | 설명 |
|-----|-----|
| 수평/수직 분할 | 현재 터미널을 2개로 분할 |
| 드래그앤드롭 분할 | 탭을 터미널 영역 가장자리로 드래그하여 분할 |
| 분할 크기 조절 | 드래그로 분할 비율 조정 |
| 분할 해제 | 분할 영역 닫기/통합 |

#### 2.2.2 아키텍처: 재귀적 트리 구조

```
SplitContainer
├── type: 'horizontal' | 'vertical' | 'leaf'
├── ratio: 0.5 (분할 비율)
├── children: [SplitContainer, SplitContainer] | null
└── sessionId: string | null (leaf인 경우)
```

**예시 - 3개 터미널 분할**:
```
┌─────────────────────────────────────┐
│           horizontal                │
│  ┌─────────────┬───────────────────┐│
│  │   leaf      │    vertical       ││
│  │  session-1  │  ┌─────────────┐  ││
│  │             │  │   leaf      │  ││
│  │             │  │  session-2  │  ││
│  │             │  ├─────────────┤  ││
│  │             │  │   leaf      │  ││
│  │             │  │  session-3  │  ││
│  │             │  └─────────────┘  ││
│  └─────────────┴───────────────────┘│
└─────────────────────────────────────┘
```

#### 2.2.3 데이터 구조

```javascript
// 분할 노드 클래스
class SplitNode {
  constructor(type, sessionId = null) {
    this.id = generateId();
    this.type = type;       // 'horizontal', 'vertical', 'leaf'
    this.ratio = 0.5;       // 분할 비율
    this.children = null;   // [SplitNode, SplitNode] 또는 null
    this.sessionId = sessionId;  // leaf인 경우 세션 ID
    this.parent = null;     // 부모 노드 참조
  }
}

// 상태 확장
const state = {
  // ... 기존 필드
  splitRoot: null,          // 루트 SplitNode
  activeSplitLeaf: null,    // 현재 활성화된 leaf 노드 ID
};
```

#### 2.2.4 HTML 구조 변경

```html
<!-- 새 구조 -->
<div class="split-container" id="splitContainer">
  <div class="split-pane split-pane--horizontal" data-split-id="root">
    <div class="split-pane__child split-pane__child--first" style="flex: 0.5">
      <div class="terminal-wrapper terminal-wrapper--active" id="terminal-session-1">
        <!-- xterm.js -->
      </div>
    </div>
    <div class="split-pane__resizer split-pane__resizer--horizontal"></div>
    <div class="split-pane__child split-pane__child--second" style="flex: 0.5">
      <div class="terminal-wrapper" id="terminal-session-2">
        <!-- xterm.js -->
      </div>
    </div>
  </div>
</div>
```

#### 2.2.5 CSS 설계

```css
.split-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.split-pane {
  display: flex;
  width: 100%;
  height: 100%;
}

.split-pane--horizontal {
  flex-direction: row;
}

.split-pane--vertical {
  flex-direction: column;
}

.split-pane__child {
  overflow: hidden;
  min-width: 100px;
  min-height: 100px;
}

.split-pane__resizer {
  background: var(--border);
  flex-shrink: 0;
  transition: background 0.2s;
}

.split-pane__resizer--horizontal {
  width: 4px;
  cursor: col-resize;
}

.split-pane__resizer--vertical {
  height: 4px;
  cursor: row-resize;
}

.split-pane__resizer:hover,
.split-pane__resizer--active {
  background: var(--accent);
}
```

#### 2.2.6 핵심 함수 설계

```javascript
// 분할 생성
function splitPane(direction, targetSessionId) {
  const leafNode = findLeafBySessionId(targetSessionId);
  if (!leafNode) return;

  // 새 세션 생성
  const newSession = await createSession();

  // 기존 leaf를 split 노드로 변환
  const newSplit = new SplitNode(direction);
  newSplit.children = [
    new SplitNode('leaf', targetSessionId),
    new SplitNode('leaf', newSession.id)
  ];

  // 트리 업데이트
  replaceNode(leafNode, newSplit);
  renderSplitTree();

  return newSession;
}

// 분할 영역 닫기
function closeSplitPane(sessionId) {
  const leafNode = findLeafBySessionId(sessionId);
  if (!leafNode || !leafNode.parent) return;

  const parent = leafNode.parent;
  const sibling = parent.children.find(c => c !== leafNode);

  // 부모를 형제 노드로 대체
  replaceNode(parent, sibling);

  // 세션 정리
  closeSession(sessionId);
  renderSplitTree();
}

// 분할 비율 조정
function resizeSplit(splitId, newRatio) {
  const node = findNodeById(splitId);
  if (node && node.type !== 'leaf') {
    node.ratio = Math.max(0.1, Math.min(0.9, newRatio));
    renderSplitTree();
  }
}
```

---

### 2.3 탭 그룹화

#### 2.3.1 요구사항

| 기능 | 설명 |
|-----|-----|
| 프로젝트별 자동 그룹 | 같은 프로젝트의 탭 자동 그룹화 |
| 수동 그룹 생성 | 사용자 정의 그룹 생성 |
| 그룹 접기/펼치기 | 그룹 내 탭 숨기기/표시 |
| 그룹 색상 | 시각적 구분을 위한 색상 지정 |

#### 2.3.2 데이터 구조

```javascript
// 탭 그룹 정의
class TabGroup {
  constructor(name, color = null) {
    this.id = generateId();
    this.name = name;
    this.color = color || getRandomGroupColor();
    this.collapsed = false;
    this.tabIds = new Set();      // 포함된 탭 ID들
    this.projectId = null;        // 프로젝트 기반 그룹인 경우
    this.isAutoGroup = false;     // 자동 생성 그룹 여부
  }
}

// 상태 확장
const state = {
  // ... 기존 필드
  tabGroups: new Map(),           // groupId -> TabGroup
  tabToGroup: new Map(),          // sessionId -> groupId
  autoGroupByProject: true,       // 프로젝트별 자동 그룹화 활성화
};

// 그룹 색상 팔레트
const GROUP_COLORS = [
  '#e06c75', // red
  '#e5c07b', // yellow
  '#98c379', // green
  '#61afef', // blue
  '#c678dd', // purple
  '#56b6c2', // cyan
  '#d19a66', // orange
];
```

#### 2.3.3 UI 설계

```html
<!-- 그룹화된 탭 구조 -->
<div class="tabs__list" id="tabsList">
  <!-- 그룹 헤더 -->
  <div class="tab-group" data-group-id="group-1" style="--group-color: #61afef">
    <div class="tab-group__header">
      <button class="tab-group__toggle">▼</button>
      <span class="tab-group__name">MyProject</span>
      <span class="tab-group__count">(3)</span>
      <button class="tab-group__menu">⋯</button>
    </div>
    <div class="tab-group__tabs">
      <div class="tab tab--grouped" data-session-id="session-1">...</div>
      <div class="tab tab--grouped" data-session-id="session-2">...</div>
      <div class="tab tab--grouped" data-session-id="session-3">...</div>
    </div>
  </div>

  <!-- 그룹 없는 탭 -->
  <div class="tab" data-session-id="session-4">...</div>
</div>
```

#### 2.3.4 CSS 설계

```css
.tab-group {
  display: flex;
  flex-direction: column;
  border-left: 3px solid var(--group-color);
  margin-right: 4px;
}

.tab-group__header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--group-color) 20%, var(--bg-secondary));
  cursor: pointer;
  height: var(--tabs-height);
}

.tab-group__toggle {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 10px;
  transition: transform 0.2s;
}

.tab-group--collapsed .tab-group__toggle {
  transform: rotate(-90deg);
}

.tab-group__tabs {
  display: flex;
}

.tab-group--collapsed .tab-group__tabs {
  display: none;
}
```

#### 2.3.5 핵심 함수 설계

```javascript
// 그룹 생성
function createTabGroup(name, tabIds = [], options = {}) {
  const group = new TabGroup(name, options.color);
  group.projectId = options.projectId || null;
  group.isAutoGroup = options.isAutoGroup || false;

  tabIds.forEach(id => {
    group.tabIds.add(id);
    state.tabToGroup.set(id, group.id);
  });

  state.tabGroups.set(group.id, group);
  renderTabs();
  return group;
}

// 프로젝트별 자동 그룹화
function autoGroupByProject(sessionId, projectId) {
  if (!state.autoGroupByProject || !projectId) return;

  // 기존 프로젝트 그룹 찾기
  let existingGroup = null;
  state.tabGroups.forEach(group => {
    if (group.projectId === projectId && group.isAutoGroup) {
      existingGroup = group;
    }
  });

  if (existingGroup) {
    addTabToGroup(sessionId, existingGroup.id);
  } else {
    // 같은 프로젝트의 탭이 2개 이상이면 그룹 생성
    const projectTabs = getTabsByProjectId(projectId);
    if (projectTabs.length >= 2) {
      const project = getProjectById(projectId);
      createTabGroup(project.name, projectTabs, {
        projectId,
        isAutoGroup: true,
        color: getProjectColor(projectId)
      });
    }
  }
}

// 그룹 접기/펼치기
function toggleGroupCollapse(groupId) {
  const group = state.tabGroups.get(groupId);
  if (group) {
    group.collapsed = !group.collapsed;
    renderTabs();
  }
}
```

---

### 2.4 고급 탭 관리

#### 2.4.1 탭 핀 고정

**데이터 구조**:
```javascript
const session = {
  // ... 기존 필드
  pinned: false,
};
```

**기능**:
- 핀 고정된 탭은 항상 왼쪽에 위치
- 핀 탭은 작은 아이콘만 표시 (제목 숨김)
- 핀 탭은 Ctrl+W로 닫히지 않음

**CSS**:
```css
.tab--pinned {
  min-width: 40px;
  max-width: 40px;
}

.tab--pinned .tab__title {
  display: none;
}

.tab--pinned .tab__close {
  display: none;
}
```

#### 2.4.2 탭 색상 구분

```javascript
const session = {
  // ... 기존 필드
  color: null,  // hex color 또는 null
};
```

```css
.tab {
  border-top: 3px solid transparent;
}

.tab[data-color] {
  border-top-color: var(--tab-color);
}
```

#### 2.4.3 탭 검색/필터

```html
<div class="tabs">
  <div class="tabs__search" id="tabSearch">
    <input type="text" placeholder="탭 검색..." id="tabSearchInput">
    <button class="tabs__search-close">&times;</button>
  </div>
  <!-- ... -->
</div>
```

**기능**:
- Ctrl+Shift+F로 탭 검색 활성화
- 검색어에 매칭되는 탭만 표시
- 탭 이름, 프로젝트명, 현재 디렉토리 검색

```javascript
function filterTabs(query) {
  if (!query) {
    document.querySelectorAll('.tab').forEach(t => t.style.display = '');
    return;
  }

  const lowerQuery = query.toLowerCase();
  state.sessions.forEach((session, id) => {
    const tab = document.querySelector(`[data-session-id="${id}"]`);
    const matches =
      session.name.toLowerCase().includes(lowerQuery) ||
      (session.projectName || '').toLowerCase().includes(lowerQuery);

    tab.style.display = matches ? '' : 'none';
  });
}
```

#### 2.4.4 최근 닫은 탭 복원

```javascript
const state = {
  // ... 기존 필드
  closedTabs: [],           // 최근 닫은 탭 정보 (최대 10개)
};

// 닫은 탭 정보
const closedTabInfo = {
  name: '...',
  projectId: '...',
  projectPath: '...',
  closedAt: Date.now(),
};
```

**기능**:
- Ctrl+Shift+T로 마지막 닫은 탭 복원
- 컨텍스트 메뉴에서 "최근 닫은 탭" 서브메뉴

```javascript
async function closeSession(id) {
  const session = state.sessions.get(id);
  if (!session) return;

  // 복원 정보 저장
  state.closedTabs.unshift({
    name: session.name,
    projectId: session.projectId,
    projectPath: session.projectPath,
    closedAt: Date.now(),
  });
  if (state.closedTabs.length > 10) {
    state.closedTabs.pop();
  }

  // ... 기존 종료 로직
}

async function restoreLastClosedTab() {
  if (state.closedTabs.length === 0) return;

  const tabInfo = state.closedTabs.shift();
  await createSession(tabInfo.name, tabInfo.projectPath);
}
```

---

## 3. 기술적 고려사항 및 트레이드오프

### 3.1 분할 뷰 구현 방식 비교

| 방식 | 장점 | 단점 |
|-----|-----|-----|
| **재귀적 트리 (권장)** | 무한 분할 가능, 유연한 레이아웃 | 복잡한 구현, 상태 관리 어려움 |
| **고정 그리드** | 단순한 구현 | 레이아웃 제한, 확장성 낮음 |
| **CSS Grid** | 네이티브 레이아웃 | 동적 분할 어려움 |

**권장**: 재귀적 트리 구조 - VS Code, Windows Terminal과 동일한 접근

### 3.2 성능 고려사항

| 영역 | 잠재적 문제 | 해결책 |
|-----|-----------|--------|
| 다수의 터미널 | 메모리 증가 | 비활성 탭 터미널 버퍼 제한 |
| 분할 렌더링 | 레이아웃 재계산 비용 | requestAnimationFrame으로 배칭 |
| 그룹 렌더링 | 많은 그룹 시 DOM 증가 | 가상 스크롤링 고려 |
| PTY 세션 | 세션당 스레드 2개 | 세션 수 제한 (최대 20개) |

### 3.3 상태 영속화

```javascript
// 세션 상태 저장 (앱 종료 시)
const persistState = {
  sessions: Array.from(state.sessions.values()).map(s => ({
    name: s.name,
    projectId: s.projectId,
    projectPath: s.projectPath,
    pinned: s.pinned,
    color: s.color,
  })),
  tabGroups: Array.from(state.tabGroups.values()),
  splitLayout: serializeSplitTree(state.splitRoot),
  closedTabs: state.closedTabs,
};

// 저장 위치: %APPDATA%/shellhive/session-state.json
```

---

## 4. 구현 우선순위 및 로드맵

### Phase 1: 프로젝트별 탭 필터링 (1주)

| 항목 | 내용 |
|------|------|
| **난이도** | 낮음 |
| **영향** | 기존 코드 최소 변경 |
| **작업** | |

1. 세션에 projectId 필드 추가
2. 필터링 UI 및 로직 구현
3. 프로젝트 사이드바 탭 카운트 표시

### Phase 2: 탭 그룹화 (1.5주)

| 항목 | 내용 |
|------|------|
| **난이도** | 중간 |
| **영향** | 탭 렌더링 로직 전면 개편 |
| **작업** | |

1. TabGroup 데이터 구조 구현
2. 그룹 UI 컴포넌트 구현
3. 자동 그룹화 로직
4. 그룹 드래그앤드롭

### Phase 3: 고급 탭 관리 (1주)

| 항목 | 내용 |
|------|------|
| **난이도** | 낮음 |
| **영향** | 독립적 기능들 |
| **작업** | |

1. 탭 핀 고정
2. 탭 색상
3. 탭 검색
4. 최근 닫은 탭 복원

### Phase 4: 탭 분할 (2주)

| 항목 | 내용 |
|------|------|
| **난이도** | 높음 |
| **영향** | 터미널 컨테이너 구조 전면 개편 |
| **작업** | |

1. SplitNode 트리 구조 구현
2. 분할 렌더링 엔진
3. 리사이저 드래그
4. 드롭 존 및 탭 드래그 분할

### 총 예상 기간: 5.5주

```
Week 1     : Phase 1 (필터링)
Week 2-3   : Phase 2 (그룹화)
Week 3-4   : Phase 3 (고급 관리)
Week 4-6   : Phase 4 (분할 뷰)
```

---

## 5. 참고 사례 분석

### 5.1 VS Code 터미널

| 기능 | 구현 방식 |
|-----|----------|
| 분할 | 재귀적 트리, Ctrl+Shift+5 |
| 탭 | 드롭다운 + 분할 그룹 표시 |
| 그룹 | 없음 (분할로 대체) |
| 색상 | 터미널별 아이콘 색상 |

### 5.2 Windows Terminal

| 기능 | 구현 방식 |
|-----|----------|
| 분할 | Alt+Shift+D (수평), Alt+Shift+- (수직) |
| 탭 | 상단 탭바, 색상 지정 가능 |
| 그룹 | 없음 |
| 프로필 | JSON 설정 기반 |

### 5.3 iTerm2 (macOS)

| 기능 | 구현 방식 |
|-----|----------|
| 분할 | Cmd+D/Shift+Cmd+D |
| 탭 | 상단 탭바, 색상/아이콘 |
| 그룹 | 없음 |
| 복원 | 세션 상태 완전 복원 |

### 5.4 Chrome 탭 그룹

| 기능 | 구현 방식 |
|-----|----------|
| 그룹 | 컬러 라벨, 이름, 접기 |
| 생성 | 드래그앤드롭 또는 컨텍스트 메뉴 |
| 자동 | 없음 (수동만) |

---

## 6. 결론 및 권장사항

### 6.1 우선순위 권장

| 순위 | 기능 | 이유 |
|-----|------|------|
| 1 | **프로젝트별 필터링** | 낮은 노력, 높은 가치. 즉시 워크플로우 개선 |
| 2 | **탭 그룹화** | 중간 노력, 높은 가치. 많은 탭 관리 시 필수 |
| 3 | **고급 탭 관리** | 낮은 노력, 중간 가치. 점진적 구현 가능 |
| 4 | **탭 분할** | 높은 노력, 중간 가치. Phase 5 이후 권장 |

### 6.2 구현 접근 방식

| 옵션 | 장점 | 단점 |
|------|------|------|
| **단계적 구현 (권장)** | 빠른 가치 전달, 낮은 리스크 | 일부 기능 간 통합 재작업 필요 |
| 전체 재설계 | 일관된 아키텍처 | 긴 개발 기간, 높은 리스크 |
| 외부 라이브러리 사용 | 빠른 구현 | 번들 크기 증가, 커스터마이징 제한 |

### 6.3 핵심 참조 파일

- `src/app.js:94-108` - 현재 state 구조
- `src/app.js:493-506` - 현재 session 객체
- `src/app.js:572-609` - createTab 함수
- `src/app.js:689-691` - 프로젝트-세션 연결
- `src/style.css:177-266` - 현재 탭 스타일
- `index.html:34-38` - 탭 컨테이너 구조
- `src-tauri/src/project.rs:6-13` - Project 구조체

---

*연구자: Claude Code (Architect Agent)*
*작성일: 2026-02-01*
