# Shellhive GUI 화면 분할 및 탭 관리 기능 대대적 개선 연구 보고서

- **작성일**: 2026-02-07
- **작성자**: Claude Code (Architect Agent)
- **브랜치**: `feature/gui-split-tab-enhancement`
- **연구 목적**: 탭 기능, 화면 분할 기능 등 대대적인 개선 업데이트

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [현재 시스템 분석](#2-현재-시스템-분석)
3. [참조 프로그램 분석](#3-참조-프로그램-분석)
4. [개선 요구사항 정의](#4-개선-요구사항-정의)
5. [아키텍처 설계](#5-아키텍처-설계)
6. [상세 개발 계획](#6-상세-개발-계획)
7. [UI/UX 설계](#7-uiux-설계)
8. [기술적 구현 방안](#8-기술적-구현-방안)
9. [일정 및 마일스톤](#9-일정-및-마일스톤)
10. [리스크 및 대응 방안](#10-리스크-및-대응-방안)

---

## 1. 프로젝트 개요

### 1.1 배경

Shellhive는 여러 CLI 프로젝트를 동시에 실행하고 관리하는 GUI 데스크톱 애플리케이션입니다. 현재까지 Phase 1~5가 완료되어 기본적인 탭 관리, 프로젝트 관리, 스니펫, 설정, 키보드 단축키 기능이 구현되어 있습니다.

### 1.2 개선 목표

사용자가 요청한 핵심 개선 사항:

| 번호 | 요구사항 | 설명 |
|------|----------|------|
| 1 | **화면 분할 인터페이스** | 메인 GUI를 먼저 화면 분할할 수 있는 인터페이스 |
| 2 | **CMD 배치 및 관리** | 화면을 누르고 CMD를 배치, 선택, 이동할 수 있는 기능 |
| 3 | **프로젝트 하위 CMD 관리** | 현재 프로젝트 하위에 새로 생긴 CMD를 관리 |
| 4 | **탭 기능 대대적 개선** | 탭 그룹화, 필터링, 고급 관리 기능 |
| 5 | **참조 프로그램 기반 UX 개선** | solhun CLI Manager 및 기타 터미널 프로그램 참조 |

### 1.3 프로젝트 범위

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Shellhive 2.0 Vision                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      메인 레이아웃                             │  │
│  │  ┌──────────┬────────────────────────────────────────────────┐│  │
│  │  │          │ ┌──────────────────────────────────────────────┤│  │
│  │  │   사이드  │ │  탭 바 (그룹화, 필터링, 핀 고정)              ││  │
│  │  │   바     │ ├──────────────────────────────────────────────┤│  │
│  │  │          │ │                                              ││  │
│  │  │ • 프로젝트│ │  ┌──────────────┬───────────────────────────┤│  │
│  │  │ • 워크트리│ │  │  Terminal 1  │  Terminal 2               ││  │
│  │  │ • 탭 그룹 │ │  │              │                           ││  │
│  │  │ • 스니펫 │ │  │  (CMD 1)     │  (CMD 2)                  ││  │
│  │  │ • 설정   │ │  │              ├───────────────────────────┤│  │
│  │  │          │ │  │              │  Terminal 3               ││  │
│  │  │          │ │  │              │  (CMD 3)                  ││  │
│  │  │          │ │  └──────────────┴───────────────────────────┤│  │
│  │  └──────────┴────────────────────────────────────────────────┘│  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. 현재 시스템 분석

### 2.1 기술 스택

| 계층 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Tauri | v2 |
| 터미널 | xterm.js | ^5.3.0 |
| 프론트엔드 | Vanilla JS | ES6+ |
| 백엔드 | Rust | 1.83+ |
| PTY | portable-pty | 0.8 |

### 2.2 현재 탭/세션 시스템 구조

**파일 위치**: `src/app.js`

```javascript
// 현재 세션 데이터 구조 (app.js 라인 94-108)
const session = {
  id,                    // 고유 ID (session-1, session-2...)
  name: sessionName,     // 탭 표시 이름
  terminal,              // xterm.js 인스턴스
  fitAddon,              // FitAddon 인스턴스
  wrapper,               // DOM wrapper element
  ptySessionId,          // Rust PTY 세션 ID
  status,                // connecting/running/exited
  projectName,           // 프로젝트 이름 (있을 경우)
  projectId,             // 연결된 프로젝트 ID
};
```

### 2.3 현재 구현된 기능

| 기능 영역 | 구현 상태 | 위치 |
|-----------|----------|------|
| 세션 상태 관리 | ✅ 완료 | app.js 94-108 |
| 탭 생성 | ✅ 완료 | createTab() 572-609 |
| 탭 활성화 | ✅ 완료 | activateSession() 630-652 |
| 탭 닫기 | ✅ 완료 | closeSession() 654-687 |
| 드래그앤드롭 | ✅ 완료 | handleTabDrag* 694-738 |
| 컨텍스트 메뉴 | ✅ 완료 | showTabContextMenu() 740-776 |
| 키보드 단축키 | ✅ 완료 | handleKeyboardShortcuts() 791-822 |
| TabGroup 클래스 | ✅ 완료 | TabGroup 298-324 |

### 2.4 현재 시스템의 한계

| 문제 | 설명 | 영향 |
|------|------|------|
| 단일 터미널 뷰 | 한 번에 하나의 터미널만 표시 | 멀티태스킹 어려움 |
| 프로젝트-탭 1:N 추적 없음 | 프로젝트에 몇 개의 탭이 있는지 파악 불가 | 관리 어려움 |
| 화면 분할 없음 | VS Code/Windows Terminal 스타일 분할 불가 | 생산성 저하 |
| 하위 CMD 관리 없음 | 프로젝트 내 다중 CMD 세션 관리 불가 | AI CLI 워크플로우 제한 |

---

## 3. 참조 프로그램 분석

### 3.1 solhun CLI Manager (https://www.solhun.com)

**프로그램 개요**: Claude Code, Codex CLI, Gemini CLI 등 AI CLI 도구를 위한 관리 프로그램

#### 핵심 기능 분석

| 기능 | 설명 | Shellhive 적용성 |
|------|------|-----------------|
| **Worktree Manager** | Git worktree로 병렬 AI 에이전트 워크플로우 관리 | ⭐⭐⭐ 높음 |
| **Git & GitHub 통합** | Git 히스토리 시각화, 에이전트 실수 발견, 롤백 | ⭐⭐ 중간 |
| **Port Manager** | 여러 프로젝트의 포트 추적/관리 | ⭐⭐ 중간 |
| **Terminal Templates** | 명령어/에이전트 구성 템플릿 저장/재사용 | ⭐⭐⭐ 높음 (스니펫 확장) |
| **Playground** | 샌드박스 환경에서 AI 에이전트 테스트 | ⭐ 낮음 (장기 목표) |

#### UI/UX 특징

- **다크 모드 기반** 현대적 디자인
- **왼쪽 사이드바** 네비게이션
- **멀티 패널** 레이아웃
- **단축키 기반** 빠른 작업

### 3.2 Windows Terminal

| 기능 | 구현 방식 | Shellhive 적용 |
|------|----------|---------------|
| **분할 패널** | Alt+Shift+D (수평), Alt+Shift+- (수직) | ⭐⭐⭐ 필수 |
| **패널 크기 조절** | Alt+Shift+화살표 | ⭐⭐⭐ 필수 |
| **패널 이동** | Alt+화살표 | ⭐⭐⭐ 필수 |
| **탭 색상** | 사용자 지정 가능 | ⭐⭐ 중간 |
| **프로필 기반** | JSON 설정 | ⭐⭐ 중간 |

### 3.3 iTerm2 (macOS 참조)

| 기능 | 구현 방식 | Shellhive 적용 |
|------|----------|---------------|
| **분할** | Cmd+D (수직), Cmd+Shift+D (수평) | ⭐⭐⭐ 필수 |
| **패널 네비게이션** | Cmd+Opt+화살표 | ⭐⭐⭐ 필수 |
| **패널 최대화** | Cmd+Shift+Enter | ⭐⭐⭐ 유용 |
| **드래그 재배치** | Cmd+Alt+Shift+드래그 | ⭐⭐ 중간 |
| **Arrangement 저장** | 전체 레이아웃 저장/복원 | ⭐⭐⭐ 높음 |

### 3.4 Tmux (터미널 멀티플렉서)

| 기능 | 구현 방식 | Shellhive 적용 |
|------|----------|---------------|
| **창/패널 구분** | Window > Pane 계층 | ⭐⭐⭐ 높음 |
| **세션 관리** | attach/detach | ⭐⭐ 중간 |
| **분할** | Ctrl+b % (수직), Ctrl+b " (수평) | 참조용 |
| **패널 레이아웃** | 미리 정의된 레이아웃 | ⭐⭐ 중간 |

### 3.5 VS Code 터미널

| 기능 | 구현 방식 | Shellhive 적용 |
|------|----------|---------------|
| **분할** | 재귀적 트리, Ctrl+Shift+5 | ⭐⭐⭐ 최우선 참조 |
| **그룹** | 분할로 대체 | ⭐⭐ 중간 |
| **터미널 색상** | 터미널별 아이콘 색상 | ⭐⭐ 중간 |
| **드롭다운** | 터미널 선택 | ⭐⭐ 중간 |

### 3.6 참조 프로그램 종합 분석

```
┌───────────────────────────────────────────────────────────────────────────┐
│                    참조 프로그램 기능 비교 매트릭스                         │
├──────────────────┬─────────┬─────────┬────────┬─────────┬────────────────┤
│ 기능              │ solhun  │ Win Term│ iTerm2 │ Tmux   │ VS Code       │
├──────────────────┼─────────┼─────────┼────────┼─────────┼────────────────┤
│ 화면 분할         │ ⭐⭐⭐  │ ⭐⭐⭐ │ ⭐⭐⭐ │ ⭐⭐⭐ │ ⭐⭐⭐        │
│ 분할 크기 조절    │ ⭐⭐    │ ⭐⭐⭐ │ ⭐⭐⭐ │ ⭐⭐   │ ⭐⭐⭐        │
│ 탭 그룹/필터     │ ⭐⭐⭐  │ ⭐⭐   │ ⭐⭐   │ ⭐⭐⭐ │ ⭐⭐          │
│ 레이아웃 저장    │ ⭐⭐⭐  │ ⭐⭐   │ ⭐⭐⭐ │ ⭐⭐⭐ │ ⭐⭐          │
│ 프로젝트 관리    │ ⭐⭐⭐  │ ⭐     │ ⭐     │ ⭐     │ ⭐⭐⭐        │
│ 템플릿/스니펫    │ ⭐⭐⭐  │ ⭐⭐   │ ⭐⭐   │ ⭐     │ ⭐⭐          │
│ AI CLI 특화     │ ⭐⭐⭐  │ ⭐     │ ⭐     │ ⭐     │ ⭐            │
└──────────────────┴─────────┴─────────┴────────┴─────────┴────────────────┘

⭐⭐⭐ = 매우 우수  ⭐⭐ = 보통  ⭐ = 기본
```

---

## 4. 개선 요구사항 정의

### 4.1 핵심 요구사항

#### REQ-01: 화면 분할 시스템

```
요구사항 ID: REQ-01
우선순위: P0 (필수)
설명: 터미널 영역을 수평/수직으로 자유롭게 분할

기능 요구사항:
- FR-01-01: 현재 터미널을 수평으로 분할
- FR-01-02: 현재 터미널을 수직으로 분할
- FR-01-03: 분할 비율을 드래그로 조절
- FR-01-04: 분할된 패널 간 포커스 이동
- FR-01-05: 분할된 패널 닫기/통합
- FR-01-06: 무한 중첩 분할 지원

비기능 요구사항:
- NFR-01-01: 분할 후 리사이즈 반응 속도 < 16ms (60fps)
- NFR-01-02: 최대 10개 동시 분할 지원
```

#### REQ-02: CMD 배치 및 관리

```
요구사항 ID: REQ-02
우선순위: P0 (필수)
설명: 분할된 화면에 CMD(터미널) 배치, 선택, 이동

기능 요구사항:
- FR-02-01: 빈 분할 영역에 새 CMD 생성
- FR-02-02: 기존 CMD를 다른 분할 영역으로 드래그 이동
- FR-02-03: 분할 영역 클릭으로 CMD 선택/활성화
- FR-02-04: 탭에서 분할 영역으로 드래그하여 배치
- FR-02-05: 분할 영역 경계 드래그로 CMD 크기 조절
```

#### REQ-03: 프로젝트 하위 CMD 관리

```
요구사항 ID: REQ-03
우선순위: P1 (중요)
설명: 프로젝트별 다중 CMD 세션을 계층적으로 관리

기능 요구사항:
- FR-03-01: 프로젝트별 CMD 세션 그룹화
- FR-03-02: 사이드바에서 프로젝트-CMD 트리 뷰 표시
- FR-03-03: 프로젝트 필터 적용 시 해당 CMD만 표시
- FR-03-04: 프로젝트에 새 CMD 추가
- FR-03-05: CMD와 프로젝트 연결/해제
```

#### REQ-04: 탭 기능 대대적 개선

```
요구사항 ID: REQ-04
우선순위: P1 (중요)
설명: 기존 탭 시스템의 확장 및 개선

기능 요구사항:
- FR-04-01: 탭 그룹화 (자동/수동)
- FR-04-02: 탭 핀 고정
- FR-04-03: 탭 색상 지정
- FR-04-04: 탭 검색/필터링
- FR-04-05: 최근 닫은 탭 복원(Ctrl+Shift+T)
- FR-04-06: 탭 그룹 접기/펼치기
```

#### REQ-05: 레이아웃 저장 및 복원

```
요구사항 ID: REQ-05
우선순위: P2 (유용)
설명: 현재 화면 분할 레이아웃을 저장하고 복원

기능 요구사항:
- FR-05-01: 현재 레이아웃을 이름으로 저장
- FR-05-02: 저장된 레이아웃 목록 관리
- FR-05-03: 저장된 레이아웃 적용
- FR-05-04: 앱 종료 시 마지막 레이아웃 자동 저장
- FR-05-05: 레이아웃 내보내기/가져오기
```

### 4.2 사용자 시나리오

#### 시나리오 1: 프로젝트 내 병렬 CLI 작업

```
사용자: "프로젝트 A에서 테스트 서버와 로그 모니터링을 동시에 실행하고 싶다"

동작:
1. 프로젝트 A 클릭 → 첫 번째 터미널 생성
2. Ctrl+Shift+D → 화면 수평 분할
3. 새 분할 영역에 자동으로 같은 프로젝트 경로로 터미널 생성
4. 왼쪽에서 `npm run dev` 실행, 오른쪽에서 `npm run test:watch` 실행
5. Ctrl+Alt+화살표로 패널 간 빠른 전환
```

#### 시나리오 2: 멀티 프로젝트 모니터링

```
사용자: "3개 프로젝트의 터미널을 한 화면에서 모니터링하고 싶다"

동작:
1. 화면을 2x2 그리드로 분할 (수평→수직 분할 2회)
2. 각 패널에 다른 프로젝트 터미널 배치
3. 탭 그룹으로 "모니터링 뷰" 저장
4. 필요시 레이아웃 복원
```

---

## 5. 아키텍처 설계

### 5.1 분할 시스템 아키텍처: 재귀적 트리 구조

VS Code와 Windows Terminal에서 사용하는 검증된 패턴을 채택합니다.

```
                           SplitContainer (Root)
                                  │
                    ┌─────────────┼─────────────┐
                    │                            │
              SplitNode                    SplitNode
              (type: horizontal)          (type: leaf)
                    │                     sessionId: "session-3"
          ┌─────────┴─────────┐
          │                    │
     SplitNode           SplitNode
    (type: leaf)        (type: leaf)
   sessionId: "s-1"    sessionId: "s-2"
```

### 5.2 데이터 구조 설계

```javascript
// 분할 노드 클래스
class SplitNode {
  constructor(type, sessionId = null) {
    this.id = generateId('split');
    this.type = type;           // 'horizontal', 'vertical', 'leaf'
    this.ratio = 0.5;           // 분할 비율 (0.1 ~ 0.9)
    this.children = null;       // [SplitNode, SplitNode] 또는 null
    this.sessionId = sessionId; // leaf인 경우 세션 ID
    this.parent = null;         // 부모 노드 참조
  }
}

// 레이아웃 상태
const layoutState = {
  splitRoot: null,              // 루트 SplitNode
  activeSplitLeafId: null,      // 현재 활성화된 leaf 노드 ID
  layouts: new Map(),           // 저장된 레이아웃 (name -> serializedTree)
};

// 확장된 세션 구조
const session = {
  // ... 기존 필드
  projectId: null,              // 연결된 프로젝트 ID
  projectPath: null,            // 프로젝트 경로
  pinned: false,                // 핀 고정 여부
  color: null,                  // 탭 색상
  groupId: null,                // 속한 그룹 ID
  splitNodeId: null,            // 배치된 분할 노드 ID
};

// 탭 그룹 클래스 (기존 확장)
class TabGroup {
  constructor(id, name, options = {}) {
    this.id = id;
    this.name = name;
    this.color = options.color || getRandomGroupColor();
    this.collapsed = false;
    this.tabIds = new Set();
    this.projectId = options.projectId || null;
    this.isAutoGroup = options.isAutoGroup || false;
  }
}
```

### 5.3 모듈 구조

```
src/
├── app.js                      # 메인 애플리케이션 (기존)
├── split/
│   ├── SplitManager.js         # 분할 관리 핵심 로직
│   ├── SplitNode.js            # 분할 노드 클래스
│   ├── SplitRenderer.js        # DOM 렌더링
│   └── SplitResizer.js         # 리사이저 드래그 처리
├── tab/
│   ├── TabManager.js           # 탭 관리 확장
│   ├── TabGroup.js             # 탭 그룹 클래스
│   └── TabRenderer.js          # 탭 렌더링
├── layout/
│   ├── LayoutManager.js        # 레이아웃 저장/복원
│   └── LayoutSerializer.js     # 레이아웃 직렬화
└── project/
    └── ProjectTreeManager.js   # 프로젝트-CMD 트리 관리
```

### 5.4 이벤트 흐름

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Event Flow                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  User Action          →  Event Handler  →  State Update  →  Render  │
│                                                                      │
│  ┌──────────────────┐                                               │
│  │ Ctrl+Shift+D     │ → splitPane('horizontal') → updateTree() →   │
│  │ (수평 분할)       │                             renderSplit()   │
│  └──────────────────┘                                               │
│                                                                      │
│  ┌──────────────────┐                                               │
│  │ 리사이저 드래그   │ → resizeSplit(nodeId,ratio) → updateRatio()→│
│  │                  │                                renderSplit() │
│  └──────────────────┘                                               │
│                                                                      │
│  ┌──────────────────┐                                               │
│  │ 탭→패널 드래그   │ → moveSessionToSplit(sid,nid)→ updateTree()→ │
│  │                  │                                renderAll()   │
│  └──────────────────┘                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. 상세 개발 계획

### Phase 6-1: 화면 분할 기반 시스템 (2주)

#### Week 1: 핵심 분할 엔진

| 작업 | 설명 | 예상 시간 |
|------|------|----------|
| SplitNode 클래스 구현 | 재귀적 트리 노드 | 4h |
| SplitManager 구현 | 분할 생성/삭제/조회 | 8h |
| DOM 렌더러 구현 | 트리→DOM 변환 | 8h |
| CSS 스타일링 | 분할 패널 스타일 | 4h |

**마일스톤 1**: 기본 분할 기능 동작

#### Week 2: 분할 상호작용

| 작업 | 설명 | 예상 시간 |
|------|------|----------|
| 리사이저 드래그 | 분할 비율 조절 | 8h |
| 키보드 단축키 | 분할/이동/닫기 | 4h |
| 패널 포커스 관리 | 활성 패널 하이라이트 | 4h |
| 터미널 fit 연동 | 패널 크기 변경 시 터미널 리사이즈 | 8h |

**마일스톤 2**: 완전한 분할 상호작용

### Phase 6-2: CMD 배치 및 이동 (1.5주)

| 작업 | 설명 | 예상 시간 |
|------|------|----------|
| 탭→패널 드래그 | 탭을 분할 영역으로 드래그 | 8h |
| 패널↔패널 이동 | 터미널을 다른 패널로 이동 | 6h |
| 드롭 존 표시 | 드래그 시 드롭 가능 영역 하이라이트 | 6h |
| 패널 병합 | 인접 패널 통합 | 4h |
| 빈 패널 관리 | 세션 없는 패널 처리 | 4h |

**마일스톤 3**: CMD 배치/이동 완료

### Phase 6-3: 탭 기능 대대적 개선 (1.5주)

| 작업 | 설명 | 예상 시간 |
|------|------|----------|
| 탭 그룹화 UI | 그룹 헤더, 접기/펼치기 | 8h |
| 자동 그룹화 | 프로젝트별 자동 그룹 | 4h |
| 탭 핀 고정 | 핀 탭 렌더링 및 동작 | 4h |
| 탭 색상 | 색상 선택 UI | 4h |
| 탭 검색 | 검색 입력 및 필터링 | 4h |
| 닫은 탭 복원 | Ctrl+Shift+T 구현 | 4h |

**마일스톤 4**: 향상된 탭 관리 완료

### Phase 6-4: 프로젝트-CMD 관리 (1주)

| 작업 | 설명 | 예상 시간 |
|------|------|----------|
| 프로젝트-세션 매핑 | projectTabMap 구현 | 4h |
| 사이드바 트리 뷰 | 프로젝트→CMD 계층 표시 | 8h |
| 프로젝트 필터 | 프로젝트별 탭/패널 필터링 | 4h |
| 탭 카운트 표시 | 프로젝트별 활성 탭 수 | 2h |

**마일스톤 5**: 프로젝트-CMD 통합 완료

### Phase 6-5: 레이아웃 저장/복원 (1주)

| 작업 | 설명 | 예상 시간 |
|------|------|----------|
| 레이아웃 직렬화 | 트리→JSON 변환 | 4h |
| 저장 UI | 레이아웃 이름 지정, 저장 | 4h |
| 레이아웃 목록 | 저장된 레이아웃 관리 UI | 4h |
| 복원 로직 | JSON→트리 재구성 | 6h |
| 자동 저장 | 앱 종료 시 상태 저장 | 4h |

**마일스톤 6**: 레이아웃 관리 완료

---

## 7. UI/UX 설계

### 7.1 분할 패널 UI

```css
/* 분할 컨테이너 */
.split-container {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

/* 분할 패널 */
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

/* 분할 영역 */
.split-pane__child {
  overflow: hidden;
  min-width: 100px;
  min-height: 100px;
  position: relative;
}

/* 리사이저 */
.split-pane__resizer {
  background: var(--border-color);
  flex-shrink: 0;
  z-index: 10;
  transition: background 0.2s ease;
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
  background: var(--accent-color);
}

/* 활성 패널 표시 */
.split-pane__child--active {
  box-shadow: inset 0 0 0 2px var(--accent-color);
}
```

### 7.2 탭 그룹 UI

```html
<!-- 그룹화된 탭 구조 -->
<div class="tabs__list" id="tabsList">
  <!-- 그룹 -->
  <div class="tab-group" data-group-id="group-1" style="--group-color: #61afef">
    <div class="tab-group__header">
      <button class="tab-group__toggle">▼</button>
      <span class="tab-group__name">Project A</span>
      <span class="tab-group__count">(3)</span>
      <button class="tab-group__menu">⋯</button>
    </div>
    <div class="tab-group__tabs">
      <div class="tab tab--grouped" data-session-id="session-1">...</div>
      <div class="tab tab--grouped" data-session-id="session-2">...</div>
    </div>
  </div>
  
  <!-- 그룹 없는 탭 -->
  <div class="tab" data-session-id="session-4">...</div>
</div>
```

### 7.3 키보드 단축키

| 단축키 | 기능 | 우선순위 |
|--------|------|----------|
| `Ctrl+Shift+D` | 수평 분할 | P0 |
| `Ctrl+Shift+E` | 수직 분할 | P0 |
| `Ctrl+Alt+화살표` | 패널 이동 | P0 |
| `Ctrl+Shift+W` | 현재 패널 닫기 | P0 |
| `Ctrl+Shift+Enter` | 패널 최대화/복원 | P1 |
| `Ctrl+Shift+T` | 닫은 탭 복원 | P1 |
| `Ctrl+Shift+F` | 탭 검색 | P2 |
| `Ctrl+Shift+S` | 레이아웃 저장 | P2 |

### 7.4 드롭 존 시각화

```
탭을 분할 영역 가장자리로 드래그 시:

┌───────────────────────────────────────┐
│     ▲ (상단 드롭 존 - 수평 분할 위)   │
├───────────────────────────────────────┤
│ ◀  │                           │ ▶   │
│    │     현재 터미널 내용        │    │
│ 좌측│                          │우측 │
│ 드롭│                          │드롭 │
│ 존  │                          │ 존  │
├───────────────────────────────────────┤
│     ▼ (하단 드롭 존 - 수평 분할 아래) │
└───────────────────────────────────────┘
```

---

## 8. 기술적 구현 방안

### 8.1 분할 트리 렌더링 알고리즘

```javascript
/**
 * SplitNode 트리를 DOM으로 렌더링
 */
function renderSplitTree(node, container) {
  if (!node) return;
  
  if (node.type === 'leaf') {
    // 리프 노드: 터미널 컨테이너 렌더링
    const wrapper = createTerminalWrapper(node.sessionId);
    container.appendChild(wrapper);
    
    // 터미널 fit 실행
    const session = state.sessions.get(node.sessionId);
    if (session && session.fitAddon) {
      requestAnimationFrame(() => session.fitAddon.fit());
    }
  } else {
    // 분할 노드: 컨테이너 + 자식들 렌더링
    const pane = document.createElement('div');
    pane.className = `split-pane split-pane--${node.type}`;
    pane.dataset.splitId = node.id;
    
    // 첫 번째 자식
    const child1 = document.createElement('div');
    child1.className = 'split-pane__child split-pane__child--first';
    child1.style.flex = node.ratio;
    renderSplitTree(node.children[0], child1);
    pane.appendChild(child1);
    
    // 리사이저
    const resizer = document.createElement('div');
    resizer.className = `split-pane__resizer split-pane__resizer--${node.type}`;
    resizer.dataset.splitId = node.id;
    setupResizer(resizer, node);
    pane.appendChild(resizer);
    
    // 두 번째 자식
    const child2 = document.createElement('div');
    child2.className = 'split-pane__child split-pane__child--second';
    child2.style.flex = 1 - node.ratio;
    renderSplitTree(node.children[1], child2);
    pane.appendChild(child2);
    
    container.appendChild(pane);
  }
}
```

### 8.2 리사이저 드래그 처리

```javascript
function setupResizer(resizerElement, splitNode) {
  let startPos = 0;
  let startRatio = splitNode.ratio;
  
  const onMouseDown = (e) => {
    e.preventDefault();
    resizerElement.classList.add('split-pane__resizer--active');
    
    const isHorizontal = splitNode.type === 'horizontal';
    startPos = isHorizontal ? e.clientX : e.clientY;
    startRatio = splitNode.ratio;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
  
  const onMouseMove = (e) => {
    const pane = resizerElement.parentElement;
    const rect = pane.getBoundingClientRect();
    const isHorizontal = splitNode.type === 'horizontal';
    
    const currentPos = isHorizontal ? e.clientX : e.clientY;
    const totalSize = isHorizontal ? rect.width : rect.height;
    const delta = currentPos - startPos;
    
    const newRatio = Math.max(0.1, Math.min(0.9, 
      startRatio + (delta / totalSize)
    ));
    
    splitNode.ratio = newRatio;
    updateSplitStyles(splitNode);
  };
  
  const onMouseUp = () => {
    resizerElement.classList.remove('split-pane__resizer--active');
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };
  
  resizerElement.addEventListener('mousedown', onMouseDown);
}
```

### 8.3 레이아웃 직렬화

```javascript
function serializeSplitTree(node) {
  if (!node) return null;
  
  return {
    id: node.id,
    type: node.type,
    ratio: node.ratio,
    sessionId: node.sessionId,
    children: node.children 
      ? node.children.map(child => serializeSplitTree(child))
      : null
  };
}

function deserializeSplitTree(data, parent = null) {
  if (!data) return null;
  
  const node = new SplitNode(data.type, data.sessionId);
  node.id = data.id;
  node.ratio = data.ratio;
  node.parent = parent;
  
  if (data.children) {
    node.children = data.children.map(child => 
      deserializeSplitTree(child, node)
    );
  }
  
  return node;
}
```

### 8.4 성능 최적화 전략

| 영역 | 잠재적 문제 | 해결책 |
|------|-----------|--------|
| 많은 터미널 | 메모리 증가 | 비활성 터미널 버퍼 크기 제한 |
| 분할 렌더링 | 레이아웃 재계산 비용 | requestAnimationFrame 배칭 |
| 리사이즈 | 빈번한 fit() 호출 | throttle/debounce 적용 |
| 드래그 | 많은 이벤트 발생 | requestAnimationFrame 기반 처리 |

---

## 9. 일정 및 마일스톤

### 9.1 전체 일정

```
Week 1-2  : Phase 6-1 (화면 분할 기반 시스템)
Week 3    : Phase 6-2 (CMD 배치 및 이동)
Week 4    : Phase 6-3 (탭 기능 대대적 개선)
Week 5    : Phase 6-4 (프로젝트-CMD 관리)
Week 6    : Phase 6-5 (레이아웃 저장/복원)
Week 7    : 통합 테스트 및 버그 수정
Week 8    : 문서화 및 릴리즈 준비
```

### 9.2 마일스톤 체크리스트

| # | 마일스톤 | 완료 기준 | 목표일 |
|---|----------|----------|--------|
| M1 | 기본 분할 기능 | 수평/수직 분할 동작 | Week 1 |
| M2 | 분할 상호작용 | 리사이저, 키보드 단축키 | Week 2 |
| M3 | CMD 배치/이동 | 드래그앤드롭 완료 | Week 3 |
| M4 | 향상된 탭 관리 | 그룹화, 핀 고정, 검색 | Week 4 |
| M5 | 프로젝트-CMD 통합 | 트리 뷰, 필터링 | Week 5 |
| M6 | 레이아웃 관리 | 저장/복원 완료 | Week 6 |
| M7 | 릴리즈 준비 | 테스트 통과, 문서 완료 | Week 8 |

---

## 10. 리스크 및 대응 방안

### 10.1 기술적 리스크

| 리스크 | 가능성 | 영향 | 대응 방안 |
|--------|--------|------|----------|
| 분할 렌더링 성능 저하 | 중간 | 높음 | 가상화, 지연 렌더링 적용 |
| xterm.js 리사이즈 이슈 | 높음 | 중간 | ResizeObserver 사용, debounce 적용 |
| 드래그앤드롭 브라우저 호환성 | 낮음 | 중간 | Tauri WebView 타겟팅, 폴리필 고려 |
| 상태 관리 복잡도 증가 | 높음 | 중간 | 모듈화, 명확한 이벤트 흐름 설계 |

### 10.2 일정 리스크

| 리스크 | 가능성 | 영향 | 대응 방안 |
|--------|--------|------|----------|
| 분할 시스템 구현 지연 | 중간 | 높음 | Phase 6-1에 버퍼 1주 포함 |
| 통합 테스트 이슈 발견 | 높음 | 중간 | 단계별 테스트, CI 구축 |

### 10.3 대응 전략

1. **점진적 구현**: 각 기능을 독립적으로 개발하고 통합
2. **프로토타입 우선**: 핵심 분할 기능 먼저 검증
3. **기존 코드 보존**: 기존 탭 시스템과 병행 운영 가능하도록 설계
4. **롤백 계획**: 문제 발생 시 이전 버전으로 복귀 가능

---

## 11. 결론

### 11.1 핵심 가치

이번 개선을 통해 Shellhive는 다음과 같은 가치를 제공합니다:

1. **생산성 향상**: 화면 분할로 여러 터미널 동시 작업
2. **워크플로우 최적화**: 프로젝트-CMD 계층적 관리
3. **유연성**: 사용자 맞춤형 레이아웃 저장/복원
4. **CLI 워크플로우 특화**: 병렬 터미널 작업 시나리오 지원

### 11.2 다음 단계

1. ✅ 새 브랜치 생성 (`feature/gui-split-tab-enhancement`)
2. ✅ 연구 보고서 작성 (본 문서)
3. ⬜ Phase 6-1 개발 착수
4. ⬜ 각 마일스톤별 PR 및 코드 리뷰

---

*연구자: Claude Code (Architect Agent)*  
*작성일: 2026-02-07*  
*버전: 1.0*
