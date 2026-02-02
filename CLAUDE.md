# CLAUDE.md - Shellhive 프로젝트 Claude Code 설정

> 이 파일은 Claude Code가 Shellhive 프로젝트를 이해하고 효과적으로 지원하기 위한 설정입니다.

---

## 프로젝트 개요

**Shellhive**는 여러 AI CLI 도구(Claude Code 등)를 하나의 통합 인터페이스에서 관리하는 Tauri v2 기반 데스크톱 애플리케이션입니다.

### 핵심 정보

| 항목 | 값 |
|------|-----|
| 프로젝트 유형 | Tauri v2 데스크톱 앱 |
| 프론트엔드 | Vanilla JS + xterm.js |
| 백엔드 | Rust |
| 플랫폼 | Windows (ConPTY 사용) |

---

## 개발 가이드 참조

**중요**: 상세한 아키텍처, 디렉토리 구조, 개발 규칙은 반드시 아래 문서를 참조하세요:

👉 **[AGENTS.md](./AGENTS.md)** - AI 에이전트 개발 종합 가이드

AGENTS.md에는 다음 내용이 포함되어 있습니다:
- 프로젝트 아키텍처 다이어그램
- 디렉토리 구조 및 파일 역할
- 개발 규칙 및 코드 컨벤션
- 핵심 모듈별 상세 가이드
- 개발 단계별 작업 내용
- 주의사항 및 FAQ

---

## 빠른 명령어

### 개발

```powershell
# 개발 모드 실행
npm run tauri dev

# Rust 코드만 빌드
cd src-tauri && cargo build

# 프론트엔드 의존성 설치
npm install
```

### 빌드

```powershell
# 프로덕션 빌드
npm run tauri build

# 결과물 위치
# src-tauri/target/release/shellhive.exe
```

### 코드 품질

```powershell
# Rust 포맷팅
cd src-tauri && cargo fmt

# Rust 린트
cd src-tauri && cargo clippy
```

---

## 현재 개발 상태

- [x] Phase 0: 프로젝트 초기화 및 문서 작성
- [x] Phase 1: 기본 Tauri 구조 + xterm.js 통합
- [x] Phase 2: PTY 연동
- [x] Phase 3: 프로젝트 관리 UI
- [x] Phase 4: 멀티 세션 탭
- [x] Phase 5: 고급 기능

> 상세 변경 내역: [변경 로그](docs/change_log/change_log.md)

---

## 주요 의존성

### Rust (Cargo.toml)

```toml
tauri = "2"
portable-pty = "0.8"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
```

### JavaScript (package.json)

```json
{
  "@tauri-apps/api": "^2",
  "xterm": "^5.3.0",
  "xterm-addon-fit": "^0.8.0"
}
```

---

## 코딩 규칙 요약

1. **Rust**: `rustfmt` + `clippy` 준수
2. **JavaScript**: ES6+, 세미콜론 사용
3. **커밋**: 한글 메시지
4. **브랜치**: `feature/*`, `bugfix/*`, `docs/*`
5. **변경 로그**: 커밋 시 [change_log.md](docs/change_log/change_log.md) 업데이트 필수

---

## 주의사항

- Windows 10 1809 이상 필요 (ConPTY)
- PTY 출력은 비동기 스트림으로 처리
- 터미널 인코딩은 UTF-8 (chcp 65001)

---

*자세한 내용은 [AGENTS.md](./AGENTS.md)를 참조하세요.*
