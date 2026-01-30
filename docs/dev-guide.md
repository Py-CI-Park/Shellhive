# Shellhive 개발 가이드

> **프로젝트 목표**: 여러 AI CLI 프로젝트(Claude Code 등)를 동시에 실행하고 관리하는 GUI 데스크톱 애플리케이션 개발
>
> **프로젝트명**: Shellhive

---

## 1. 프로젝트 개요

### 1.1 해결하려는 문제

- CMD 창을 개별적으로 관리해야 하는 번거로움
- 프로젝트 폴더까지 매번 이동 후 Claude Code 실행의 불편함
- 여러 AI CLI 세션을 동시에 운영할 때 창 전환의 어려움

### 1.2 핵심 기능

| 기능 | 설명 |
|------|------|
| **프로젝트 등록** | 프로젝트 경로와 별칭을 미리 등록, 클릭 한 번으로 실행 |
| **멀티 세션 관리** | 여러 Claude Code 세션을 탭 기반으로 관리 |
| **내장 터미널** | 실제 cmd.exe/powershell.exe를 PTY로 연결하여 100% 동일 동작 |
| **세션 모니터링** | 각 세션 상태 표시 (실행 중, 대기, 완료) |

### 1.3 UI 레이아웃 설계

```
┌─────────────────────────────────────────────────────────────────┐
│  AI CLI Manager                                    ─ □ ×        │
├─────────────┬───────────────────────────────────────────────────┤
│ 📁 Projects │  [fatigue-analysis]  [stock-algo]  [newsletter] + │
│             ├───────────────────────────────────────────────────┤
│ ▶ fatigue   │  $ claude                                         │
│   stock     │                                                   │
│   newsletter│  ╭─────────────────────────────────────────────╮  │
│   ─────────│  │ What would you like to work on?             │  │
│ + 새 프로젝트│  │                                             │  │
│             │  │ > VBA 매크로 수정해줘                        │  │
│             │  ╰─────────────────────────────────────────────╯  │
│             │                                                   │
│ ⚙️ 설정     │  ─────────────────────────────────────────────── │
│             │  [입력창]                              [Send ▶]  │
└─────────────┴───────────────────────────────────────────────────┘
```

---

## 2. 기술 스택

### 2.1 선정 기술: Tauri + xterm.js

| 항목 | 선택 | 이유 |
|------|------|------|
| **프레임워크** | Tauri v2 | 경량 (10~15MB), 빠른 성능, 네이티브 통합 |
| **터미널 라이브러리** | xterm.js | VS Code가 사용하는 성숙한 터미널 임베딩 솔루션 |
| **프론트엔드** | Vanilla JS + HTML/CSS | 단순함, 추가 빌드 도구 불필요 |
| **백엔드** | Rust | PTY 생성 및 프로세스 관리 |
| **데이터 저장** | JSON | 프로젝트 설정 저장 |

### 2.2 기술 스택 비교 (참고)

| 옵션 | 스택 | 빌드 크기 | 장점 | 단점 |
|------|------|-----------|------|------|
| **Tauri** | Rust + JS | 10~15MB | 가볍고 빠름 | Rust 학습 필요 |
| Electron | JS/TS | 150MB+ | 성숙한 생태계 | 무거움 |
| Python PyQt | Python | 50MB+ | 익숙한 언어 | 배포 복잡 |
| C# WPF | .NET | 30MB+ | Windows 네이티브 | Windows 전용 |

### 2.3 작동 원리: PTY (Pseudo Terminal)

```
┌─────────────────┐
│  AI CLI Manager │
│  (Tauri 앱)     │
└────────┬────────┘
         │ PTY 연결
         ▼
┌─────────────────┐
│   cmd.exe       │  ← 진짜 cmd 프로세스
│   (숨김 상태)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  claude.exe     │  ← Claude Code 실제 실행
└─────────────────┘
```

**PTY 연결의 장점:**

- `cd`, `dir`, `cls` 등 모든 cmd 명령어 동작
- 환경변수, PATH 전부 인식
- Claude Code의 인터랙티브 모드 완벽 지원
- 색상, 커서 이동, 입력 대기 등 ANSI 제어 전부 동작
- `Ctrl+C` 인터럽트 정상 작동

---

## 3. 개발 환경 설정

### 3.1 필수 설치 항목

#### 3.1.1 Node.js (LTS 버전)

**다운로드:** https://nodejs.org/

- **버전:** 22.x LTS 권장
- 설치 시 **"Add to PATH"** 체크 확인

**설치 확인:**
```powershell
node --version
# 출력 예: v22.x.x
```

#### 3.1.2 Rust

**방법 1: winget 사용 (권장)**
```powershell
winget install Rustlang.Rustup
```

**방법 2: 수동 설치**

https://rustup.rs/ 에서 `rustup-init.exe` 다운로드 후 실행

**설치 후 설정:**
```powershell
rustup default stable
rustup update
```

**설치 확인:**
```powershell
rustc --version
# 출력 예: rustc 1.83.x

cargo --version
# 출력 예: cargo 1.83.x
```

#### 3.1.3 Windows 빌드 도구

Visual Studio Build Tools 필요:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools
```

설치 시 **"C++ 빌드 도구"** 워크로드 선택 필수

포함 항목:
- MSVC v143 - VS 2022 C++ x64/x86 빌드 도구
- Windows 11 SDK
- C++ CMake tools for Windows

#### 3.1.4 Tauri CLI

```powershell
cargo install tauri-cli
```

### 3.2 환경 설정 확인 체크리스트

새 PowerShell 창에서 실행:

```powershell
# Node.js 확인
node --version

# Rust 확인
rustc --version
cargo --version

# Tauri CLI 확인
cargo tauri --version
```

모든 명령어가 버전 정보를 출력하면 환경 설정 완료.

---

## 4. 프로젝트 구조

### 4.1 디렉토리 구조

```
shellhive/
├── src-tauri/                  # Rust 백엔드
│   ├── src/
│   │   ├── main.rs             # 메인 엔트리포인트
│   │   ├── pty.rs              # PTY 관리 모듈
│   │   └── project.rs          # 프로젝트 설정 관리
│   ├── Cargo.toml              # Rust 의존성
│   └── tauri.conf.json         # Tauri 설정
├── src/                        # 웹 프론트엔드
│   ├── index.html              # 메인 HTML
│   ├── app.js                  # xterm.js 연동 및 UI 로직
│   ├── style.css               # 스타일시트
│   └── assets/                 # 아이콘 등 정적 파일
├── package.json                # Node.js 의존성
└── README.md
```

### 4.2 핵심 파일 설명

| 파일 | 역할 |
|------|------|
| `main.rs` | Tauri 앱 초기화, 이벤트 핸들링 |
| `pty.rs` | Windows PTY 생성, 입출력 처리 |
| `project.rs` | 프로젝트 CRUD, JSON 저장/로드 |
| `app.js` | xterm.js 인스턴스 관리, Tauri IPC 통신 |
| `tauri.conf.json` | 앱 이름, 창 크기, 권한 설정 |

---

## 5. 핵심 의존성

### 5.1 Rust (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["shell-open"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
portable-pty = "0.8"           # PTY 관리
tokio = { version = "1", features = ["full"] }
```

### 5.2 JavaScript (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2"
  }
}
```

### 5.3 의존성 설명

| 패키지 | 용도 |
|--------|------|
| `portable-pty` | 크로스 플랫폼 PTY 라이브러리 |
| `xterm` | 터미널 에뮬레이터 UI |
| `xterm-addon-fit` | 터미널 크기 자동 조정 |
| `xterm-addon-web-links` | URL 클릭 가능하게 처리 |

---

## 6. 개발 워크플로우

### 6.1 프로젝트 생성

```powershell
# 1. 프로젝트 디렉토리 생성
mkdir shellhive
cd shellhive

# 2. Tauri 프로젝트 초기화
npm create tauri-app@latest . -- --template vanilla

# 3. 추가 의존성 설치
npm install xterm xterm-addon-fit xterm-addon-web-links

# 4. Rust 의존성 추가 (src-tauri/Cargo.toml 수정 후)
cd src-tauri
cargo build
```

### 6.2 개발 모드 실행

```powershell
# 핫 리로드 개발 서버
npm run tauri dev
```

### 6.3 빌드 및 배포

```powershell
# 프로덕션 빌드
npm run tauri build

# 결과물 위치
# src-tauri/target/release/shellhive.exe
# src-tauri/target/release/bundle/msi/  (설치 파일)
```

---

## 7. 구현 로드맵

### Phase 1: 기본 구조 (1주차)

- [x] Tauri 프로젝트 초기화
- [x] 기본 윈도우 레이아웃 구성
- [x] xterm.js 통합 및 단일 터미널 동작 확인

### Phase 2: PTY 연동 (2주차)

- [x] Rust PTY 모듈 구현
- [x] cmd.exe 프로세스 생성 및 연결
- [x] 양방향 입출력 처리

### Phase 3: 프로젝트 관리 (3주차)

- [x] 프로젝트 등록/수정/삭제 UI
- [x] JSON 기반 설정 저장
- [x] 프로젝트 클릭 시 해당 폴더에서 터미널 실행

### Phase 4: 멀티 세션 (4주차)

- [x] 탭 기반 다중 터미널
- [x] 세션 상태 표시
- [x] 세션 간 빠른 전환 (단축키)

### Phase 5: 고급 기능 (5주차+)

- [x] 글로벌 단축키로 앱 토글
- [x] 명령어 스니펫 저장
- [x] 세션 로그 자동 저장
- [x] 테마 커스터마이징

---

## 8. 참고 자료

### 공식 문서

- **Tauri v2:** https://v2.tauri.app/
- **xterm.js:** https://xtermjs.org/
- **portable-pty:** https://docs.rs/portable-pty/

### 유사 프로젝트 참고

- **Warp Terminal:** https://www.warp.dev/
- **Hyper:** https://hyper.is/
- **Windows Terminal:** https://github.com/microsoft/terminal

---

## 9. 트러블슈팅

### 9.1 일반적인 문제

| 문제 | 해결 방법 |
|------|-----------|
| `cargo build` 실패 | Visual Studio Build Tools 설치 확인 |
| PTY 연결 안 됨 | Windows 10 1809 이상 필요 (ConPTY 지원) |
| 터미널 한글 깨짐 | UTF-8 인코딩 설정, `chcp 65001` |
| xterm 크기 안 맞음 | `FitAddon` 적용 및 resize 이벤트 처리 |

### 9.2 환경 변수 문제

PowerShell 실행 정책 문제 시:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 10. 버전 히스토리

| 버전 | 날짜 | 내용 |
|------|------|------|
| 0.1.0 | - | 초기 문서 작성 |

---

*문서 작성일: 2026-01-30*
