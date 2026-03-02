# Shellhive 설치 및 실행 가이드

> Phase 6-9 업데이트 포함 (2024년 최신)

---

## 목차

1. [사전 요구사항](#1-사전-요구사항)
2. [설치 순서](#2-설치-순서)
3. [배치 파일 사용법](#3-배치-파일-사용법)
4. [Phase 6-9 새 기능](#4-phase-6-9-새-기능)
5. [키보드 단축키](#5-키보드-단축키)
6. [설정 파일 위치](#6-설정-파일-위치)
7. [문제 해결](#7-문제-해결)

---

## 1. 사전 요구사항

### 필수 소프트웨어

| 소프트웨어 | 최소 버전 | 다운로드 |
|-----------|----------|----------|
| Node.js | 18.x 이상 | https://nodejs.org/ |
| Rust | 1.70 이상 | https://rustup.rs/ |
| Windows | 10 1809 이상 | (ConPTY 지원 필요) |

### 버전 확인 방법

```powershell
# Node.js 버전 확인
node -v

# npm 버전 확인
npm -v

# Rust 버전 확인
cargo --version
```

---

## 2. 설치 순서

### 방법 1: 배치 파일 사용 (권장)

```
1. setup.bat 실행      → 의존성 설치 및 환경 검증
2. run-dev.bat 실행    → 개발 모드로 앱 실행
```

### 방법 2: 수동 설치

```powershell
# 1단계: 프로젝트 디렉토리로 이동
cd D:\Chanil_Park\Project\Programming\Shellhive

# 2단계: npm 의존성 설치
npm install

# 3단계: Rust 의존성 확인
cd src-tauri
cargo check
cd ..

# 4단계: 개발 모드 실행
npm run tauri dev
```

---

## 3. 배치 파일 사용법

### 파일 목록

| 배치 파일 | 용도 | 설명 |
|----------|------|------|
| `setup.bat` | 초기 설정 | 의존성 설치, 환경 검증, 린트 체크 |
| `run-dev.bat` | 개발 실행 | 핫 리로드 포함 개발 모드 |
| `build-release.bat` | 빌드 | 프로덕션 빌드 생성 |
| `run-release.bat` | 릴리스 실행 | 빌드된 실행 파일 실행 |
| `lint.bat` | 코드 검사 | ESLint로 코드 스타일 검사 |
| `lint-fix.bat` | 코드 수정 | ESLint 자동 수정 |
| `test.bat` | 테스트 | 단위 테스트 실행 |
| `test-watch.bat` | 테스트 워치 | 파일 변경 시 자동 테스트 |
| `test-coverage.bat` | 커버리지 | 테스트 커버리지 리포트 생성 |

### 실행 순서도

```
┌─────────────────────────────────────────────────────────────┐
│                    최초 설치 시                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   setup.bat  ──────────────────────────────────────────┐   │
│       │                                                 │   │
│       ├── Node.js 확인                                  │   │
│       ├── npm 확인                                      │   │
│       ├── Cargo(Rust) 확인                              │   │
│       ├── npm install (의존성 설치)                      │   │
│       ├── cargo check (Rust 의존성 확인)                 │   │
│       └── npm run lint (코드 스타일 검사)                │   │
│                                                         │   │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    개발 작업 시                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   run-dev.bat  ─── 개발 모드 실행 (핫 리로드)               │
│                                                             │
│   lint.bat     ─── 코드 스타일 검사                         │
│   lint-fix.bat ─── 코드 스타일 자동 수정                    │
│                                                             │
│   test.bat         ─── 테스트 실행                          │
│   test-watch.bat   ─── 테스트 워치 모드                     │
│   test-coverage.bat ── 커버리지 리포트                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    배포 시                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   build-release.bat ─── 프로덕션 빌드 생성                  │
│         │                                                   │
│         └── 결과: src-tauri/target/release/shellhive.exe   │
│                                                             │
│   run-release.bat ───── 빌드된 앱 실행                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 각 배치 파일 상세 설명

#### `setup.bat` - 초기 설정

```
실행: setup.bat 더블클릭

수행 작업:
1. Node.js, npm, Cargo 설치 여부 확인
2. 각 도구의 버전 표시
3. npm install로 JavaScript 의존성 설치
4. cargo check로 Rust 의존성 확인
5. ESLint로 코드 스타일 검사

소요 시간: 약 2-5분 (최초 실행 시)
```

#### `run-dev.bat` - 개발 모드

```
실행: run-dev.bat 더블클릭

특징:
- 핫 리로드 지원 (코드 수정 시 자동 반영)
- DevTools 자동 활성화
- 콘솔에서 로그 확인 가능

종료: Ctrl+C
```

#### `test.bat` - 테스트 실행

```
실행: test.bat 더블클릭

테스트 파일 위치: src/__tests__/*.test.js

현재 테스트 케이스:
- session.test.js (3개 테스트)
- settings.test.js (5개 테스트)
```

#### `test-coverage.bat` - 커버리지 리포트

```
실행: test-coverage.bat 더블클릭

리포트 생성 위치: coverage/index.html

실행 후 브라우저에서 리포트 열기 옵션 제공
```

---

## 4. Phase 6-9 새 기능

### Phase 6: 코드 품질 및 안정성

| 기능 | 설명 | 확인 방법 |
|------|------|----------|
| ESLint | 코드 스타일 자동 검사 | `lint.bat` 실행 |
| Vitest | 단위 테스트 프레임워크 | `test.bat` 실행 |
| 토스트 알림 | 에러/성공 메시지 표시 | 앱 실행 후 자동 확인 |
| 성능 최적화 | 세션 20개 제한, debounce | 자동 적용 |

### Phase 7: 핵심 기능 확장

| 기능 | 설명 | 사용법 |
|------|------|--------|
| 세션 저장/복원 | 앱 종료 시 상태 유지 | 자동 (30초마다 저장) |
| 터미널 검색 | 터미널 내 텍스트 검색 | `Ctrl+F` |
| 탭 이름 변경 | 탭 이름 커스터마이징 | 탭 더블클릭 |
| 추가 단축키 | 화면 지우기, 전체화면 | 아래 단축키 표 참조 |

### Phase 8: 고급 기능

| 기능 | 설명 | 사용법 |
|------|------|--------|
| 탭 분할 | 가로/세로 분할 뷰 | `Ctrl+Shift+D/E` |
| 파일 드래그 앤 드롭 | 파일 경로 자동 입력 | 파일을 터미널로 드래그 |
| 프로젝트 그룹화 | 카테고리별 정리 | 사이드바에서 관리 |

### Phase 9: 접근성 및 다국어

| 기능 | 설명 | 사용법 |
|------|------|--------|
| 접근성 | ARIA, 키보드 탐색 | 자동 적용 |
| 다국어 지원 | 한국어/영어 | 설정 → 언어 선택 |
| 고대비 테마 | 시각 접근성 | 설정 → 테마 → High Contrast |

---

## 5. 키보드 단축키

### 탭 관리

| 단축키 | 기능 |
|--------|------|
| `Ctrl+T` | 새 탭 열기 |
| `Ctrl+W` | 현재 탭 닫기 |
| `Ctrl+Tab` | 다음 탭으로 이동 |
| `Ctrl+Shift+Tab` | 이전 탭으로 이동 |
| `Ctrl+1` ~ `Ctrl+9` | n번째 탭으로 이동 |

### 터미널 조작

| 단축키 | 기능 |
|--------|------|
| `Ctrl+F` | 터미널 검색 열기 |
| `Ctrl+L` | 화면 지우기 |
| `Ctrl+K` | 스크롤백 버퍼 지우기 |
| `F11` | 전체화면 토글 |

### 분할 창

| 단축키 | 기능 |
|--------|------|
| `Ctrl+Shift+D` | 가로 분할 |
| `Ctrl+Shift+E` | 세로 분할 |

---

## 6. 설정 파일 위치

모든 설정은 `%APPDATA%\shellhive\` 디렉토리에 저장됩니다.

| 파일 | 경로 | 내용 |
|------|------|------|
| 앱 설정 | `settings.json` | 테마, 폰트, 언어 등 |
| 세션 상태 | `session-state.json` | 탭, 그룹, 창 상태 |
| 프로젝트 | `projects.json` | 프로젝트 목록 |
| 카테고리 | `categories.json` | 프로젝트 카테고리 |
| 스니펫 | `snippets.json` | 저장된 스니펫 |

### 설정 폴더 열기

```powershell
# Windows 탐색기에서 열기
explorer %APPDATA%\shellhive
```

---

## 7. 문제 해결

### 문제: "Node.js is not installed" 에러

**해결:**
1. https://nodejs.org/ 에서 Node.js LTS 버전 설치
2. 설치 후 새 터미널 창에서 `node -v` 확인
3. `setup.bat` 다시 실행

### 문제: "Cargo is not installed" 에러

**해결:**
1. https://rustup.rs/ 에서 Rust 설치
2. 설치 후 새 터미널 창에서 `cargo --version` 확인
3. `setup.bat` 다시 실행

### 문제: npm install 실패

**해결:**
```powershell
# npm 캐시 정리
npm cache clean --force

# node_modules 삭제 후 재설치
rmdir /s /q node_modules
npm install
```

### 문제: 테스트 실패

**해결:**
```powershell
# 의존성 재설치
npm ci

# 테스트 다시 실행
test.bat
```

### 문제: 빌드 실패

**해결:**
```powershell
# Rust 타겟 정리
cd src-tauri
cargo clean
cd ..

# 빌드 다시 실행
build-release.bat
```

### 문제: 앱 실행 시 ConPTY 에러

**원인:** Windows 10 1809 미만 버전

**해결:**
1. Windows 버전 확인: `winver` 실행
2. Windows 10 1809 이상으로 업데이트 필요

---

## 빠른 시작 체크리스트

```
□ Node.js 설치 확인 (node -v)
□ Rust 설치 확인 (cargo --version)
□ setup.bat 실행
□ run-dev.bat 실행
□ 앱 정상 실행 확인
```

---

## 추가 리소스

- [AGENTS.md](../AGENTS.md) - AI 에이전트 개발 가이드
- [change_log.md](change_log/change_log.md) - 변경 이력
- [Phase 6 구현 요약](phase6-implementation-summary.md) - Phase 6 상세
- [i18n 구현 요약](i18n_implementation_summary.md) - 다국어 지원 상세

---

*마지막 업데이트: 2024년*
