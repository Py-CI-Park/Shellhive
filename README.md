# Shellhive

> 여러 AI CLI 프로젝트를 동시에 실행하고 관리하는 GUI 데스크톱 애플리케이션

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange.svg)

---

## 📋 목차

- [개요](#개요)
- [빠른 시작](#빠른-시작)
- [주요 기능](#주요-기능)
- [사용 방법](#사용-방법)
- [개발 환경 설정](#개발-환경-설정)
- [프로젝트 구조](#프로젝트-구조)
- [기술 스택](#기술-스택)
- [개발 로드맵](#개발-로드맵)
- [문제 해결](#문제-해결)
- [기여 방법](#기여-방법)
- [라이선스](#라이선스)

---

## 개요

**Shellhive**는 Claude Code와 같은 AI CLI 도구들을 하나의 통합 인터페이스에서 관리할 수 있는 데스크톱 애플리케이션입니다. 여러 프로젝트를 탭 기반으로 관리하고, 각 프로젝트 폴더에서 독립적인 터미널 세션을 실행합니다.

### 해결하려는 문제

- ❌ CMD 창을 개별적으로 관리해야 하는 번거로움
- ❌ 프로젝트 폴더까지 매번 이동 후 AI CLI 실행의 불편함
- ❌ 여러 AI CLI 세션을 동시에 운영할 때 창 전환의 어려움
- ❌ 자주 사용하는 명령어를 반복 입력해야 하는 불편함

### ✅ Shellhive의 해결책

- ✅ **통합 인터페이스**: 모든 AI CLI 세션을 하나의 창에서 관리
- ✅ **프로젝트 북마크**: 원클릭으로 프로젝트별 터미널 실행
- ✅ **멀티 탭**: 여러 세션을 탭으로 관리, 빠른 전환
- ✅ **명령어 스니펫**: 자주 쓰는 명령어를 저장하고 클릭 한 번으로 실행

---

## 🚀 빠른 시작

### 방법 1: 사전 빌드된 실행 파일 사용 (권장)

1. **빌드하기**
   ```powershell
   # 저장소 클론 후
   .\build-release.bat
   ```

2. **실행하기**
   ```powershell
   .\run-release.bat
   ```

### 방법 2: 개발 모드로 실행

```powershell
# 개발 모드 (핫 리로드 지원)
.\run-dev.bat
```

---

## 🎯 주요 기능

### 1. 프로젝트 관리

| 기능 | 설명 |
|------|------|
| **프로젝트 등록** | 자주 사용하는 프로젝트 폴더를 등록하고 이름 지정 |
| **원클릭 실행** | 프로젝트 클릭 시 해당 폴더에서 터미널 자동 실행 |
| **폴더 브라우저** | 시스템 폴더 선택 다이얼로그로 쉽게 경로 지정 |

### 2. 멀티 세션 터미널

| 기능 | 설명 |
|------|------|
| **탭 기반 관리** | 여러 터미널 세션을 탭으로 구성 |
| **세션 상태 표시** | 연결 중(*), 실행 중(o), 종료됨(-) 상태 아이콘 |
| **드래그 앤 드롭** | 탭 순서를 자유롭게 변경 |
| **컨텍스트 메뉴** | 우클릭으로 복제, 닫기, 다른 탭 모두 닫기 |

### 3. 명령어 스니펫

| 기능 | 설명 |
|------|------|
| **스니펫 저장** | 자주 쓰는 명령어를 이름과 함께 저장 |
| **원클릭 실행** | 저장된 스니펫 클릭으로 현재 터미널에 즉시 실행 |
| **빠른 관리** | 추가/삭제 간편한 UI |

**예시 스니펫:**
- `git status` → "Git 상태 확인"
- `npm run dev` → "개발 서버 시작"
- `cargo build --release` → "릴리즈 빌드"

### 4. 테마 및 커스터마이징

| 설정 | 옵션 |
|------|------|
| **테마** | Dark (기본), Light, Monokai |
| **글꼴 크기** | 12px ~ 24px |
| **글꼴 종류** | Consolas, Courier New, Fira Code 등 |
| **로깅** | 세션 출력 자동 저장 (활성화/비활성화) |

### 5. 키보드 단축키

| 단축키 | 기능 |
|--------|------|
| `Ctrl+T` | 새 터미널 탭 생성 |
| `Ctrl+W` | 현재 탭 닫기 |
| `Ctrl+Tab` | 다음 탭으로 이동 |
| `Ctrl+Shift+Tab` | 이전 탭으로 이동 |
| `Ctrl+1~9` | 특정 탭으로 직접 이동 |
| `Ctrl+,` | 설정 열기 |
| `Ctrl+Shift+C` | 선택 텍스트 복사 |
| `Ctrl+Shift+V` | 붙여넣기 |

---

## 📖 사용 방법

### 1단계: 프로젝트 등록

1. 좌측 사이드바에서 **"+ 프로젝트 추가"** 클릭
2. **프로젝트 이름** 입력 (예: "My Web App")
3. **Browse** 버튼으로 프로젝트 폴더 선택
4. **확인** 클릭

### 2단계: 프로젝트에서 터미널 실행

1. 좌측 사이드바에서 등록한 프로젝트 클릭
2. 해당 폴더에서 자동으로 터미널 세션 시작
3. Claude Code 또는 원하는 CLI 도구 실행

```powershell
# 예시: Claude Code 실행
claude
```

### 3단계: 스니펫 활용

1. **"+ 스니펫 추가"** 클릭
2. 스니펫 이름과 명령어 입력
   - 이름: "Claude 시작"
   - 명령어: `claude`
3. 이후 스니펫 클릭으로 즉시 실행

### 4단계: 설정 커스터마이징

1. **⚙️ 설정** 버튼 클릭 (또는 `Ctrl+,`)
2. 테마, 글꼴, 로깅 옵션 설정
3. **저장** 클릭

---

## 🛠️ 개발 환경 설정

### 필수 요구사항

| 도구 | 버전 | 설명 |
|------|------|------|
| **Node.js** | 22.x LTS | JavaScript 런타임 |
| **Rust** | 1.83+ | 백엔드 컴파일러 |
| **Visual Studio Build Tools** | 2022 | C++ 빌드 도구 |
| **Windows** | 10 1809+ | ConPTY 지원 필수 |

### 설치 순서

#### 1. Node.js 설치

```powershell
# https://nodejs.org/ 에서 LTS 버전 다운로드
# 또는 winget 사용
winget install OpenJS.NodeJS.LTS
```

#### 2. Rust 설치

```powershell
# https://rustup.rs/ 에서 설치
# 또는 winget 사용
winget install Rustlang.Rustup
```

#### 3. Visual Studio Build Tools 설치

```powershell
# "C++를 사용한 데스크톱 개발" 워크로드 선택
winget install Microsoft.VisualStudio.2022.BuildTools
```

#### 4. 프로젝트 설정

```powershell
# 1. 저장소 클론
git clone https://github.com/your-username/shellhive.git
cd shellhive

# 2. Node.js 의존성 설치
npm install

# 3. 개발 모드 실행
.\run-dev.bat
```

### 개발 모드 vs 릴리즈 모드

| 모드 | 배치 파일 | 용도 | 특징 |
|------|-----------|------|------|
| **개발** | `run-dev.bat` | 개발 및 디버깅 | 핫 리로드, DevTools 자동 오픈 |
| **빌드** | `build-release.bat` | 프로덕션 빌드 생성 | 최적화된 실행 파일 생성 |
| **릴리즈** | `run-release.bat` | 빌드된 앱 실행 | 빠른 시작, 최적화됨 |

---

## 📁 프로젝트 구조

```
shellhive/
├── src-tauri/                      # Rust 백엔드
│   ├── src/
│   │   ├── main.rs                 # 메인 엔트리포인트, 플러그인 초기화
│   │   ├── pty.rs                  # PTY 세션 생성/관리 (portable-pty)
│   │   ├── project.rs              # 프로젝트 CRUD 작업
│   │   ├── snippet.rs              # 스니펫 CRUD 작업
│   │   └── settings.rs             # 설정 저장/로드, 로깅
│   ├── capabilities/
│   │   └── default.json            # Tauri 권한 설정
│   ├── Cargo.toml                  # Rust 의존성
│   └── tauri.conf.json             # Tauri 앱 설정
│
├── src/                            # 웹 프론트엔드
│   ├── index.html                  # 메인 HTML 레이아웃
│   ├── app.js                      # xterm.js 통합, UI 로직
│   └── style.css                   # 스타일시트
│
├── docs/                           # 문서
│   └── dev-guide.md                # 상세 개발 가이드
│
├── run-dev.bat                     # 개발 모드 실행 스크립트
├── run-release.bat                 # 릴리즈 모드 실행 스크립트
├── build-release.bat               # 릴리즈 빌드 스크립트
│
├── package.json                    # Node.js 의존성
├── AGENTS.md                       # AI 에이전트 개발 가이드
├── CLAUDE.md                       # Claude Code 설정
└── README.md                       # 이 파일
```

---

## 💻 기술 스택

| 계층 | 기술 | 이유 |
|------|------|------|
| **프레임워크** | Tauri v2 | 경량(10~15MB), Rust 기반 보안, 네이티브 통합 |
| **터미널** | xterm.js | VS Code 사용, 성숙한 에코시스템 |
| **프론트엔드** | Vanilla JS | 단순성, 빌드 도구 불필요 |
| **백엔드** | Rust | 안전성, 성능, PTY 제어 |
| **PTY** | portable-pty | Windows ConPTY 지원 |
| **데이터** | JSON 파일 | 프로젝트/스니펫/설정 영구 저장 |

### 주요 의존성

#### Rust (Cargo.toml)

```toml
[dependencies]
tauri = "2"
tauri-plugin-shell = "2"
tauri-plugin-dialog = "2"
portable-pty = "0.8"
serde = { version = "1", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
uuid = { version = "1", features = ["v4"] }
parking_lot = "0.12"
dirs = "5"
chrono = { version = "0.4", features = ["serde"] }
```

#### JavaScript (package.json)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-dialog": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0"
  }
}
```

---

## 🗺️ 개발 로드맵

| Phase | 상태 | 기능 |
|-------|------|------|
| **Phase 0** | ✅ 완료 | 프로젝트 초기화, 문서 작성 |
| **Phase 1** | ✅ 완료 | Tauri 기본 구조, xterm.js 통합 |
| **Phase 2** | ✅ 완료 | PTY 연동 (Windows ConPTY) |
| **Phase 3** | ✅ 완료 | 프로젝트 관리 UI 및 CRUD |
| **Phase 4** | ✅ 완료 | 멀티 세션 탭, 드래그 앤 드롭 |
| **Phase 5** | ✅ 완료 | 스니펫, 설정, 로깅, 키보드 단축키 |

상세 개발 내용은 [AGENTS.md](AGENTS.md)를 참조하세요.

---

## 📝 변경 로그

모든 변경 사항은 [변경 로그](docs/change_log/change_log.md)에서 확인할 수 있습니다.

개발에 참여하시는 경우, 커밋 시 변경 로그도 함께 업데이트해 주세요.

---

## 🔧 문제 해결

### 개발 모드 실행 시 오류

#### 1. "cargo not found" 오류

**증상:**
```
failed to run 'cargo metadata' command: program not found
```

**해결:**
```powershell
# Rust 재설치
winget install Rustlang.Rustup

# PATH에 Cargo 추가 확인
cargo --version
```

#### 2. "event.listen not allowed" 오류

**증상:**
```
event.listen not allowed. Permissions associated with this command: core:event:allow-listen
```

**해결:**
- `src-tauri/capabilities/default.json` 파일이 존재하는지 확인
- 최신 커밋으로 업데이트

#### 3. Browse 버튼 동작 안 함

**원인:** Tauri 권한 설정 누락

**해결:**
```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "dialog:allow-open"
  ]
}
```

### 터미널 관련

#### Ctrl+C가 복사 안 됨

**설명:** 터미널에서 `Ctrl+C`는 프로세스 중단 신호입니다.

**해결:** 복사는 `Ctrl+Shift+C`를 사용하세요.

| 동작 | 단축키 |
|------|--------|
| 복사 | `Ctrl+Shift+C` |
| 붙여넣기 | `Ctrl+Shift+V` |
| 프로세스 중단 | `Ctrl+C` |

---

## 🤝 기여 방법

### 1. Fork 및 브랜치 생성

```powershell
git checkout -b feature/amazing-feature
```

### 2. 변경사항 커밋

```powershell
git commit -m "feat: 놀라운 기능 추가"
```

### 3. Push 및 Pull Request

```powershell
git push origin feature/amazing-feature
```

### 커밋 메시지 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가
chore: 빌드 관련
```

---

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 📚 참고 자료

### 공식 문서

- [Tauri v2 공식 문서](https://v2.tauri.app/)
- [xterm.js 공식 문서](https://xtermjs.org/)
- [portable-pty 문서](https://docs.rs/portable-pty/)

### 관련 프로젝트

- [Claude Code](https://claude.ai/claude-code)
- [Windows Terminal](https://github.com/microsoft/terminal)
- [Hyper Terminal](https://hyper.is/)

### 개발 가이드

- [AGENTS.md](AGENTS.md) - AI 에이전트용 상세 개발 가이드
- [CLAUDE.md](CLAUDE.md) - Claude Code 설정
- [docs/dev-guide.md](docs/dev-guide.md) - 개발자 참고 문서

---

## 🙏 감사의 말

이 프로젝트는 다음 오픈소스 프로젝트의 도움을 받았습니다:

- **Tauri**: 경량 데스크톱 프레임워크
- **xterm.js**: 웹 기반 터미널 에뮬레이터
- **portable-pty**: 크로스 플랫폼 PTY 라이브러리
- **Rust Community**: 안정적이고 빠른 백엔드 언어

---

<p align="center">
  Made with ❤️ for AI CLI enthusiasts
</p>
