# AGENTS.md - Shellhive AI 개발 가이드

> 이 문서는 AI 에이전트가 Shellhive 프로젝트를 이해하고 효과적으로 개발을 지원하기 위한 가이드입니다.

---

## 프로젝트 개요

**Shellhive**는 여러 AI CLI 도구(Claude Code 등)를 하나의 통합 인터페이스에서 관리하는 Tauri 기반 데스크톱 애플리케이션입니다.

### 핵심 목표

1. **통합 관리**: 여러 프로젝트의 AI CLI 세션을 단일 앱에서 관리
2. **완벽한 터미널 호환**: PTY를 통한 100% cmd/powershell 동작 지원
3. **경량화**: 10~15MB 크기의 가벼운 데스크톱 앱

### 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| 프레임워크 | Tauri | v2 |
| 프론트엔드 | Vanilla JS + xterm.js | - |
| 백엔드 | Rust | 1.83+ |
| 터미널 | portable-pty + xterm.js | - |
| 데이터 | JSON 파일 기반 | - |

---

## 아키텍처 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    Shellhive Application                     │
├─────────────────────────────────────────────────────────────┤
│  Frontend (WebView)                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │   UI 컴포넌트  │  │  xterm.js    │  │  Tauri IPC Client   │ │
│  │  - 사이드바   │  │  - 터미널 렌더 │  │  - invoke()         │ │
│  │  - 탭바      │  │  - 입력 처리   │  │  - listen()         │ │
│  │  - 설정      │  │  - ANSI 해석   │  │                     │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  Backend (Rust + Tauri)                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  PTY Manager │  │  Project Mgr  │  │  Tauri Commands     │ │
│  │  - 생성/삭제  │  │  - CRUD       │  │  - pty_create       │ │
│  │  - 입출력 처리│  │  - JSON 저장  │  │  - pty_write        │ │
│  │  - 세션 관리  │  │  - 경로 검증   │  │  - project_list     │ │
│  └─────────────┘  └──────────────┘  └─────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│  System Layer                                                │
│  ┌─────────────┐  ┌──────────────┐                          │
│  │  ConPTY     │  │  File System  │                          │
│  │  (Windows)  │  │  (JSON 설정)   │                          │
│  └─────────────┘  └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 디렉토리 구조 및 파일 역할

```
shellhive/
├── src-tauri/                      # [Rust 백엔드]
│   ├── src/
│   │   ├── main.rs                 # Tauri 앱 초기화, 커맨드 등록
│   │   ├── pty.rs                  # PTY 생성/관리, 입출력 처리
│   │   ├── project.rs              # 프로젝트 CRUD, JSON 직렬화
│   │   └── lib.rs                  # 모듈 익스포트
│   ├── Cargo.toml                  # Rust 의존성 정의
│   └── tauri.conf.json             # Tauri 앱 설정 (창, 권한, 번들)
│
├── src/                            # [웹 프론트엔드]
│   ├── index.html                  # 메인 HTML (레이아웃 구조)
│   ├── app.js                      # 앱 로직, xterm.js 관리
│   ├── components/                 # UI 컴포넌트
│   │   ├── sidebar.js              # 프로젝트 목록 사이드바
│   │   ├── tabs.js                 # 탭 바 관리
│   │   └── terminal.js             # xterm.js 래퍼
│   ├── style.css                   # 메인 스타일시트
│   └── assets/                     # 정적 리소스
│       └── icons/                  # 앱 아이콘
│
├── docs/                           # [문서]
│   └── dev-guide.md                # 상세 개발 가이드
│
├── package.json                    # Node.js 의존성
├── AGENTS.md                       # AI 에이전트 개발 가이드 (이 파일)
├── CLAUDE.md                       # Claude Code 설정
└── README.md                       # 프로젝트 소개
```

---

## 개발 규칙 및 컨벤션

### 코드 스타일

| 영역 | 규칙 |
|------|------|
| **Rust** | `rustfmt` 기본 설정, `clippy` 경고 0 유지 |
| **JavaScript** | ES6+, 세미콜론 사용, 2스페이스 들여쓰기 |
| **CSS** | BEM 명명 규칙 권장 |
| **커밋** | 한글 커밋 메시지 사용 |

### 파일 명명 규칙

- Rust: `snake_case.rs`
- JavaScript: `kebab-case.js` 또는 `camelCase.js`
- 컴포넌트: `ComponentName.js`

### Git 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 안정화된 릴리즈 버전 |
| `develop` | 개발 통합 브랜치 |
| `feature/*` | 기능 개발 |
| `bugfix/*` | 버그 수정 |
| `docs/*` | 문서 작업 |

### 변경 로그 작성 가이드

모든 커밋은 [변경 로그](docs/change_log/change_log.md)에 기록되어야 합니다.

**작성 규칙:**

1. 커밋 후 `docs/change_log/change_log.md` 파일 업데이트
2. 날짜별로 그룹화하여 기록
3. 커밋 해시 포함
4. 카테고리 분류: Added, Changed, Fixed, Documentation, Security

**예시:**
```markdown
#### fix: 버그 수정 설명

**커밋**: `abc1234`

##### 수정됨 (Fixed)

- 문제 설명 및 해결 내용
```

---

## 핵심 모듈 가이드

### 1. PTY 모듈 (`src-tauri/src/pty.rs`)

**역할**: Windows ConPTY를 통한 터미널 프로세스 관리

**주요 기능**:
- `create_pty(working_dir, shell)`: 새 PTY 세션 생성
- `write_pty(session_id, data)`: PTY에 입력 전송
- `resize_pty(session_id, cols, rows)`: 터미널 크기 조정
- `kill_pty(session_id)`: PTY 세션 종료

**사용 크레이트**: `portable-pty`

### 2. 프로젝트 관리자 (`src-tauri/src/project.rs`)

**역할**: 사용자 프로젝트 설정 CRUD

**데이터 구조**:
```rust
struct Project {
    id: String,
    name: String,
    path: PathBuf,
    shell: Option<String>,  // 기본값: cmd.exe
    created_at: DateTime,
}
```

**저장 위치**: `%APPDATA%/shellhive/projects.json`

### 3. 터미널 컴포넌트 (`src/components/terminal.js`)

**역할**: xterm.js 인스턴스 관리 및 Tauri IPC 연동

**주요 기능**:
- 터미널 생성 및 DOM 마운트
- 입력 이벤트 → Tauri 커맨드 전송
- Tauri 이벤트 수신 → 터미널 출력

---

## 개발 단계별 가이드

### Phase 1: 기본 구조

**목표**: Tauri + xterm.js 기본 통합

**작업 내용**:
1. `npm create tauri-app@latest` 프로젝트 생성
2. xterm.js 설치 및 기본 터미널 렌더링
3. Tauri 윈도우 설정 (크기, 제목)

**완료 기준**:
- 앱 실행 시 빈 터미널 창 표시
- 입력 시 xterm에 에코

### Phase 2: PTY 연동

**목표**: Rust PTY ↔ xterm.js 양방향 연결

**작업 내용**:
1. `portable-pty` 크레이트 추가
2. PTY 생성 Tauri 커맨드 구현
3. 비동기 출력 스트림 → Tauri 이벤트 전송
4. xterm 입력 → PTY 입력 파이프라인

**완료 기준**:
- 터미널에서 `dir`, `cd` 등 cmd 명령 실행 가능
- `claude` 명령 실행 시 정상 동작

### Phase 3: 프로젝트 관리

**목표**: 프로젝트 등록/실행 기능

**작업 내용**:
1. 프로젝트 데이터 모델 정의
2. JSON 저장/로드 로직
3. 사이드바 UI 구현
4. 프로젝트 클릭 → 해당 경로에서 터미널 실행

**완료 기준**:
- 프로젝트 추가/삭제/수정 가능
- 프로젝트 클릭 시 해당 폴더에서 터미널 시작

### Phase 4: 멀티 세션

**목표**: 탭 기반 다중 터미널

**작업 내용**:
1. 탭 UI 컴포넌트 구현
2. 세션별 PTY 인스턴스 관리
3. 탭 전환 시 터미널 컨텍스트 스위칭
4. 세션 상태 표시 (아이콘/색상)

**완료 기준**:
- 여러 탭에서 독립적인 터미널 세션 운영
- 탭 간 빠른 전환

### Phase 5: 고급 기능

**목표**: 사용성 개선

**작업 내용**:
1. 글로벌 단축키 (앱 토글)
2. 명령어 스니펫 저장
3. 세션 로그 자동 저장
4. 테마 커스터마이징

---

## 주의사항

### Windows 특이사항

1. **ConPTY 필수**: Windows 10 1809 이상 필요
2. **인코딩**: UTF-8 설정 필요 (`chcp 65001`)
3. **경로**: 백슬래시(`\`) 처리 주의

### 성능 최적화

1. **터미널 버퍼**: xterm.js 스크롤백 제한 권장 (5000줄)
2. **이벤트 배칭**: PTY 출력을 배칭하여 렌더링 최적화
3. **메모리 관리**: 종료된 세션의 PTY 핸들 즉시 해제

### 보안

1. 사용자 입력 경로 검증 필수
2. 셸 명령 인젝션 방지
3. 설정 파일 권한 확인

---

## 자주 묻는 질문 (FAQ)

**Q: PTY가 연결되지 않습니다**
A: Windows 버전 확인 (1809+), Visual Studio Build Tools 설치 확인

**Q: 한글이 깨집니다**
A: `chcp 65001` 실행 또는 터미널 폰트 확인

**Q: xterm 크기가 맞지 않습니다**
A: `FitAddon` 적용 및 윈도우 resize 이벤트 핸들링 확인

---

## 참고 리소스

- [Tauri v2 공식 문서](https://v2.tauri.app/)
- [xterm.js 공식 문서](https://xtermjs.org/)
- [portable-pty API](https://docs.rs/portable-pty/)
- [Windows ConPTY 가이드](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/)

---

*이 문서는 개발 진행에 따라 지속적으로 업데이트됩니다.*
