# Shellhive 변경 로그 (Change Log)

이 문서는 Shellhive 프로젝트의 모든 변경 사항을 기록합니다.

형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며,
버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/)을 준수합니다.

---

## 버전 관리 가이드

- 모든 커밋은 이 문서에 기록되어야 합니다
- 커밋 해시, 날짜, 변경 내용을 포함합니다
- 카테고리: Added, Changed, Fixed, Documentation, Security

---

## [Unreleased]

### 2026-02-03

#### fix(security): 코드 리뷰 이슈 수정 (CRITICAL + HIGH)

##### 수정됨 (Fixed)

- **CRITICAL: XSS 취약점 제거** (`src/app.js` - showToast 함수, 라인 23)
  - `showToast()` 함수에서 메시지를 `escapeHtml()`로 감싸 XSS 공격 차단
  - 사용자 입력이 HTML로 직접 삽입되는 보안 취약점 해결
  - 특수 문자 자동 이스케이프 (`<`, `>`, `&`, `"`, `'`)

- **HIGH: 상태 불일치 문제 해결** (`src/app.js` - saveTabLayout 함수, 라인 2333)
  - `saveTabLayout()`에서 Deep clone 구현
  - `serializeSplitTree()` + `deserializeSplitTree()` 조합으로 완전한 복사본 생성
  - 탭 간 레이아웃 공유 참조 문제 해결

- **HIGH: Null 체크 추가** (`src/app.js` - toggleMaximize 함수, 라인 1983)
  - `toggleMaximize()` 함수에 sessionId null 체크 추가
  - 활성 세션이 없을 때 명확한 경고 메시지 표시
  - 예상치 못한 에러 방지

- **HIGH: Race Condition 해결** (`src/app.js` - splitActivePane 함수, 라인 2027)
  - `state.splitInProgress` 플래그 추가
  - try/finally 블록으로 동시성 제어 구현
  - 빠른 연속 분할 작업 시 트리 구조 손상 방지

##### 문서 (Documentation)

- **코드 리뷰 수정 보고서 추가** (`docs/code-review-fixes-2026-02-03.md`)
  - 4개 이슈 상세 설명 (문제점, 수정 내용, 기술적 세부사항)
  - 테스트 및 검증 방법
  - 향후 개선 사항 제안

---

### 2026-02-02

#### feat(i18n): 다국어 지원 (Phase 9.2)

##### 추가됨 (Added)

- **i18n 모듈 구현** (`src/i18n/index.js`)
  - 한국어(ko), 영어(en) 번역 딕셔너리
  - `setLocale()`, `getLocale()`, `t()`, `getAvailableLocales()` 함수
  - 플레이스홀더 치환 기능 (`{name}`, `{count}` 등)

- **Settings 구조체에 locale 필드 추가** (`src-tauri/src/settings.rs`)
  - `locale: String` 필드 추가
  - 기본값: "ko" (한국어)
  - locale 유효성 검증 추가 (en, ko)

- **설정 UI에 언어 선택 옵션 추가** (`index.html`)
  - Language 드롭다운 메뉴 (English, 한국어)

##### 변경됨 (Changed)

- **app.js 다국어 지원 통합**
  - i18n 모듈 import
  - state.settings에 locale 필드 추가
  - `showSettingsModal()`: locale 선택기 값 설정
  - `saveSettings()`: locale 저장 및 적용
  - `loadSettings()`: 앱 시작 시 locale 적용

##### 문서 (Documentation)

- **i18n 구현 요약 문서 추가** (`docs/i18n_implementation_summary.md`)
  - 구현 개요 및 파일 목록
  - 번역 키 카테고리 설명
  - 사용 예제 및 향후 개선사항

---

## [0.1.0] - 2026-02-01 (develop)

### 개요

Shellhive의 첫 번째 개발 버전으로, Phase 1~5까지의 모든 핵심 기능이 구현되었습니다.

- **Phase 1**: Tauri v2 프로젝트 초기화 및 xterm.js 통합
- **Phase 2**: Windows ConPTY를 통한 PTY 연동
- **Phase 3**: 프로젝트 관리 UI 및 CRUD 기능
- **Phase 4**: 멀티 세션 탭 관리
- **Phase 5**: 스니펫, 설정, 로깅, 키보드 단축키

---

### 2026-02-01

#### feat(tabs): 탭 관리 기능 Phase 1, 2, 3 전체 구현

**커밋**: `859cdaf`

##### 추가됨 (Added)

- **Phase 1: 탭 상태 표시 강화**
  - 탭별 상태 아이콘 (연결 중 `*`, 실행 중 `●`, 종료됨 `-`)
  - 컨텍스트 메뉴 (복제, 닫기, 다른 탭 모두 닫기)
  - 프로젝트 이름 기반 탭 제목

- **Phase 2: 드래그 앤 드롭**
  - HTML5 Drag & Drop API 기반 탭 순서 변경
  - 드래그 중 시각적 피드백 (드래그 오버 스타일)
  - 드롭 시 탭 순서 즉시 반영

- **Phase 3: 키보드 단축키**
  - `Ctrl+T`: 새 터미널 탭 생성
  - `Ctrl+W`: 현재 탭 닫기
  - `Ctrl+Tab` / `Ctrl+Shift+Tab`: 탭 전환
  - `Ctrl+1~9`: 특정 탭으로 직접 이동

---

#### docs: 탭 관리 기능 강화 연구 보고서 추가

**커밋**: `f8c1373`

##### 문서 (Documentation)

- `docs/research-tab-management-2026-02-01.md` - 탭 관리 기능 강화 연구 보고서
  - Phase 1~3 구현 계획 상세
  - 기술 스택 및 구현 방향

---

#### fix(pty): 터미널 종료 버튼 동작 수정

**커밋**: `5099e35`

##### 수정됨 (Fixed)

- **터미널 종료 버튼 동작 문제 해결**
  - 탭 닫기 버튼 클릭 시 PTY 세션이 정상 종료되도록 수정
  - 이벤트 버블링 방지 처리 추가

---

#### docs: 업데이트 보고서 및 변경 로그 추가

**커밋**: `2a390d7`

##### 문서 (Documentation)

- 업데이트 보고서 추가
- 변경 로그 문서 구조 설정

---

#### fix: 코드 검토 보고서 기반 7개 이슈 수정

**커밋**: `79a7ac7`

##### 수정됨 (Fixed)

- **[HIGH]** 스니펫/프로젝트 데이터 속성에서 HTML 엔티티 변환 문제 수정
  - `data-command`, `data-path`에 JSON.stringify 사용
  - 특수문자(`&`, `<`, `>`) 포함 명령어/경로 정상 실행

- **[HIGH]** PTY 프로세스 미종료 문제 수정
  - child 핸들 저장 및 `kill_pty`에서 명시적 종료 호출
  - 탭 종료 시 백그라운드 프로세스 잔존 방지

- **[MEDIUM]** 터미널 리사이즈가 PTY에 반영되지 않던 문제 수정
  - `resize_pty` 호출 추가 (100ms 디바운싱)
  - 초기 PTY 생성 시에도 크기 전달

- **[MEDIUM]** PTY 에러 이벤트 미구독 문제 수정
  - `pty-error` 이벤트 리스너 등록
  - 에러 발생 시 터미널에 빨간색 메시지 표시

- **[MEDIUM]** write_pty 전역 Mutex 락 범위 과다 문제 수정
  - writer를 `Arc<Mutex>`로 래핑하여 세션별 락 분리
  - 멀티 세션 동시 입력 시 블로킹 제거

##### 보안 (Security)

- **[LOW]** CSP(Content Security Policy) 정책 적용
  - `csp: null` → 적절한 보안 정책으로 변경
  - XSS 공격 방어 강화

##### 추가됨 (Added)

- **[LOW]** 기본 테스트 스캐폴딩 추가
  - Rust 단위 테스트 2개 (`test_pty_manager_creation`, `test_pty_manager_default`)
  - `npm run test:rust` 스크립트 추가

---

#### docs: 코드 검토 보고서 및 검증 결과 추가

**커밋**: `8718bb9`

##### 문서 (Documentation)

- `docs/review-report-develop-2026-02-01.md` - develop 브랜치 정적 코드 리뷰 보고서
- `docs/review-verification-2026-02-01.md` - 검토 보고서 검증 결과

---

### 2026-01-31

#### fix(pty): master PTY 핸들 유지로 터미널 입력 문제 해결

**커밋**: `885a90e`

##### 수정됨 (Fixed)

- **PTY 입력 불가 문제 해결**
  - master PTY 핸들이 조기 해제되는 문제 수정
  - 세션 수명 동안 핸들 유지하도록 구조 변경

---

#### fix: PTY 입력/출력 핵심 수정 - Writer 관리 재설계

**커밋**: `3652188`

##### 변경됨 (Changed)

- **PTY Writer 관리 구조 재설계**
  - 기존: 전역 락으로 인한 동시 입력 문제
  - 변경: 세션별 독립적인 Writer 인스턴스 관리
  - 멀티 세션 동시 입력 성능 개선

---

#### fix: PTY 실시간 입출력 및 UI 이벤트 처리 개선

**커밋**: `7b26f72`

##### 수정됨 (Fixed)

- **실시간 입출력 지연 문제 해결**
  - PTY 출력 버퍼링 최적화
  - Tauri 이벤트 발생 빈도 조정

- **UI 이벤트 처리 개선**
  - 터미널 포커스 관리 개선
  - 입력 이벤트 전달 안정화

---

#### fix: Tauri v2 권한 설정 및 프로젝트 실행 환경 개선

**커밋**: `a9e5914`

##### 수정됨 (Fixed)

- **Tauri v2 권한 설정 문제 해결**
  - `src-tauri/capabilities/default.json` 권한 설정 추가
  - 이벤트 리스너, 다이얼로그, 셸 권한 활성화

- **프로젝트 실행 환경 개선**
  - 개발 모드 실행 스크립트 개선
  - 빌드 설정 최적화

---

### 2026-01-30

#### docs: 개발 로드맵 체크리스트 완료 상태로 업데이트

**커밋**: `a540aa6`

##### 문서 (Documentation)

- README.md 개발 로드맵 Phase 1~5 완료 상태로 업데이트
- 개발 진행 상황 반영

---

#### feat(phase5): 고급 기능 구현 - 스니펫, 설정, 로깅

**커밋**: `9e07b50`

##### 추가됨 (Added)

- **명령어 스니펫 기능**
  - 자주 사용하는 명령어 저장
  - 클릭 한 번으로 현재 터미널에 실행
  - 스니펫 추가/삭제 UI

- **설정 기능**
  - 테마 선택 (Dark, Light, Monokai)
  - 글꼴 크기 조정 (12px ~ 24px)
  - 글꼴 종류 선택

- **세션 로깅**
  - 터미널 출력 자동 저장 옵션
  - 로그 파일 위치: `%APPDATA%/shellhive/logs/`

- **키보드 단축키**
  - `Ctrl+,`: 설정 열기
  - `Ctrl+Shift+C`: 복사
  - `Ctrl+Shift+V`: 붙여넣기

---

#### feat(phase4): 멀티 세션 탭 고급 기능 구현

**커밋**: `a00f037`

##### 추가됨 (Added)

- **탭 기반 멀티 세션**
  - 여러 터미널 세션을 탭으로 관리
  - 탭별 독립적인 PTY 세션

- **세션 상태 표시**
  - 연결 중, 실행 중, 종료됨 상태 아이콘

- **탭 관리 기능**
  - 새 탭 생성/닫기
  - 탭 전환

---

#### feat(phase3): 프로젝트 관리 UI 및 기능 구현

**커밋**: `1e451d2`

##### 추가됨 (Added)

- **프로젝트 관리**
  - 프로젝트 추가/수정/삭제 CRUD
  - JSON 파일 기반 영구 저장 (`%APPDATA%/shellhive/projects.json`)

- **사이드바 UI**
  - 프로젝트 목록 표시
  - 프로젝트 클릭 시 해당 폴더에서 터미널 실행

- **폴더 브라우저**
  - Tauri Dialog 플러그인 연동
  - 시스템 폴더 선택 다이얼로그

---

#### feat(phase2): PTY 연동 구현 - Windows ConPTY 완전 통합

**커밋**: `03cac16`

##### 추가됨 (Added)

- **Windows ConPTY 통합**
  - `portable-pty` 크레이트 사용
  - PTY 세션 생성/관리/종료

- **Tauri 커맨드**
  - `create_pty`: PTY 세션 생성
  - `write_pty`: PTY에 입력 전송
  - `resize_pty`: 터미널 크기 조정
  - `kill_pty`: PTY 세션 종료

- **양방향 통신**
  - xterm.js 입력 → PTY 전송
  - PTY 출력 → Tauri 이벤트 → xterm.js 렌더링

---

#### feat(phase1): Tauri v2 프로젝트 초기화 및 xterm.js 통합

**커밋**: `abec1e3`

##### 추가됨 (Added)

- **Tauri v2 프로젝트 구조**
  - `src-tauri/`: Rust 백엔드
  - `src/`: 웹 프론트엔드

- **xterm.js 통합**
  - 터미널 렌더링 컴포넌트
  - FitAddon을 통한 자동 크기 조정
  - WebLinksAddon을 통한 URL 클릭 지원

- **기본 UI 레이아웃**
  - 사이드바 + 터미널 영역 구조
  - 다크 테마 기본 적용

---

#### docs: 프로젝트 초기 문서 구조 설정

**커밋**: `f1699e9`

##### 문서 (Documentation)

- `README.md` - 프로젝트 소개 및 사용법
- `AGENTS.md` - AI 에이전트 개발 가이드
- `CLAUDE.md` - Claude Code 설정
- `docs/dev-guide.md` - 개발자 가이드

---

#### Initial commit

**커밋**: `bbaea1f`

##### 추가됨 (Added)

- Git 저장소 초기화
- `.gitignore` 설정

---

## 버전 히스토리

| 버전 | 날짜 | 상태 | 주요 변경 |
|------|------|------|----------|
| 0.1.0 | 2026-02-01 | 개발 중 | Phase 1~5 구현, 핵심 기능 완료 |

---

## 변경 유형 가이드

| 유형 | 설명 |
|------|------|
| **추가됨 (Added)** | 새로운 기능 |
| **변경됨 (Changed)** | 기존 기능 변경 |
| **사용 중단 (Deprecated)** | 곧 제거될 기능 |
| **제거됨 (Removed)** | 제거된 기능 |
| **수정됨 (Fixed)** | 버그 수정 |
| **보안 (Security)** | 보안 관련 변경 |
| **문서 (Documentation)** | 문서 추가/수정 |

---

*이 문서는 개발 진행에 따라 지속적으로 업데이트됩니다.*
