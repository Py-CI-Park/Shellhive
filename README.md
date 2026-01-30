# Shellhive

> 여러 AI CLI 프로젝트를 동시에 실행하고 관리하는 GUI 데스크톱 애플리케이션

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange.svg)

---

## 개요

**Shellhive**는 Claude Code와 같은 AI CLI 도구들을 하나의 통합 인터페이스에서 관리할 수 있는 데스크톱 애플리케이션입니다. 여러 프로젝트를 탭 기반으로 관리하고, 각 프로젝트 폴더에서 독립적인 터미널 세션을 실행합니다.

### 해결하려는 문제

- CMD 창을 개별적으로 관리해야 하는 번거로움
- 프로젝트 폴더까지 매번 이동 후 AI CLI 실행의 불편함
- 여러 AI CLI 세션을 동시에 운영할 때 창 전환의 어려움

### 핵심 기능

| 기능 | 설명 |
|------|------|
| **프로젝트 등록** | 프로젝트 경로와 별칭을 미리 등록, 클릭 한 번으로 실행 |
| **멀티 세션 관리** | 여러 AI CLI 세션을 탭 기반으로 관리 |
| **내장 터미널** | cmd.exe/powershell.exe를 PTY로 연결하여 100% 동일 동작 |
| **세션 모니터링** | 각 세션 상태 표시 (실행 중, 대기, 완료) |

---

## 기술 스택

| 항목 | 선택 | 이유 |
|------|------|------|
| **프레임워크** | Tauri v2 | 경량 (10~15MB), 빠른 성능, 네이티브 통합 |
| **터미널 라이브러리** | xterm.js | VS Code가 사용하는 성숙한 터미널 솔루션 |
| **프론트엔드** | Vanilla JS + HTML/CSS | 단순함, 추가 빌드 도구 불필요 |
| **백엔드** | Rust | PTY 생성 및 프로세스 관리 |
| **데이터 저장** | JSON | 프로젝트 설정 저장 |

---

## 프로젝트 구조

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
├── docs/                       # 문서
│   └── dev-guide.md            # 상세 개발 가이드
├── package.json                # Node.js 의존성
├── AGENTS.md                   # AI 에이전트 개발 가이드
├── CLAUDE.md                   # Claude Code 설정
└── README.md
```

---

## 개발 환경 설정

### 필수 요구사항

- **Node.js** 22.x LTS
- **Rust** 1.83+
- **Visual Studio Build Tools** (C++ 빌드 도구)
- **Windows 10 1809+** (ConPTY 지원)

### 설치 방법

```powershell
# 1. 저장소 클론
git clone https://github.com/your-username/shellhive.git
cd shellhive

# 2. Node.js 의존성 설치
npm install

# 3. 개발 모드 실행
npm run tauri dev
```

### 빌드

```powershell
# 프로덕션 빌드
npm run tauri build

# 결과물: src-tauri/target/release/shellhive.exe
```

---

## UI 레이아웃

```
┌─────────────────────────────────────────────────────────────────┐
│  Shellhive                                          ─ □ ×       │
├─────────────┬───────────────────────────────────────────────────┤
│ 📁 Projects │  [project-1]  [project-2]  [project-3]  +         │
│             ├───────────────────────────────────────────────────┤
│ ▶ project-1 │  $ claude                                         │
│   project-2 │                                                   │
│   project-3 │  ╭─────────────────────────────────────────────╮  │
│   ─────────│  │ What would you like to work on?             │  │
│ + 새 프로젝트│  │                                             │  │
│             │  │ >                                            │  │
│             │  ╰─────────────────────────────────────────────╯  │
│             │                                                   │
│ ⚙️ 설정     │  ─────────────────────────────────────────────── │
│             │  [입력창]                              [Send ▶]  │
└─────────────┴───────────────────────────────────────────────────┘
```

---

## 개발 로드맵

- [x] **Phase 0**: 프로젝트 초기화 및 문서 작성
- [x] **Phase 1**: 기본 Tauri 구조 + xterm.js 통합
- [x] **Phase 2**: PTY 연동 (Rust portable-pty)
- [x] **Phase 3**: 프로젝트 관리 UI
- [x] **Phase 4**: 멀티 세션 탭 구현
- [x] **Phase 5**: 고급 기능 (단축키, 스니펫, 로그)

상세 개발 가이드는 [docs/dev-guide.md](docs/dev-guide.md)를 참조하세요.

---

## 기여 방법

1. Fork 후 feature 브랜치 생성 (`git checkout -b feature/amazing-feature`)
2. 변경사항 커밋 (`git commit -m 'Add amazing feature'`)
3. 브랜치 Push (`git push origin feature/amazing-feature`)
4. Pull Request 생성

---

## 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참조하세요.

---

## 참고 자료

- [Tauri v2 공식 문서](https://v2.tauri.app/)
- [xterm.js 공식 문서](https://xtermjs.org/)
- [portable-pty 문서](https://docs.rs/portable-pty/)
