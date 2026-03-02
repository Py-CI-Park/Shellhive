# AGENTS.md - Shellhive AI 개발 가이드

> 이 문서는 Shellhive 저장소에서 작업하는 AI 에이전트를 위한 최신 개발 지침입니다.

---

## 프로젝트 개요

**Shellhive**는 여러 AI CLI 도구(Claude Code 등)를 하나의 Tauri 데스크톱 앱에서 관리하는 통합 터미널 워크스페이스입니다.

### 핵심 목표

1. **통합 관리**: 여러 프로젝트의 AI CLI 세션을 단일 앱에서 관리
2. **터미널 호환성**: PTY 기반으로 cmd/powershell 동작을 최대한 그대로 제공
3. **경량 데스크톱 앱**: 유지보수 가능한 구조와 작은 배포 크기 지향

### 기술 스택

| 영역 | 기술 | 비고 |
|------|------|------|
| 프레임워크 | Tauri | v2 |
| 프론트엔드 | Vanilla JS + xterm.js | Vite 번들 |
| 백엔드 | Rust | Tauri command 기반 IPC |
| 터미널 | portable-pty + xterm.js | PTY 세션 관리 |
| 데이터 | JSON 파일 기반 | 설정/프로젝트/스니펫/로그 |

---

## 현재 아키텍처 (2026-03-02 기준)

```
Shellhive
├─ Frontend (WebView)
│  ├─ src/app.js (대형 엔트리 파일, 점진 모듈화 진행 중)
│  ├─ src/history-panel.js
│  ├─ src/i18n/index.js
│  ├─ src/ui-constants.js
│  └─ src/style.css
├─ Backend (Rust + Tauri)
│  ├─ pty.rs
│  ├─ project.rs
│  ├─ settings.rs
│  ├─ snippet.rs
│  ├─ git.rs
│  ├─ sharing.rs
│  ├─ claude.rs
│  └─ ai.rs
└─ IPC
   └─ main.rs invoke_handler 등록 커맨드 52개
```

---

## 디렉토리 구조 (실제 반영)

```
shellhive/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── pty.rs
│   │   ├── project.rs
│   │   ├── settings.rs
│   │   ├── snippet.rs
│   │   ├── git.rs
│   │   ├── sharing.rs
│   │   ├── claude.rs
│   │   └── ai.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/default.json
│
├── src/
│   ├── app.js
│   ├── history-panel.js
│   ├── i18n/index.js
│   ├── ui-constants.js
│   ├── style.css
│   ├── sharing-styles.css
│   └── __tests__/
│
├── docs/
│   ├── plans/
│   ├── security/
│   ├── guides/
│   └── change_log/change_log.md
│
├── index.html
├── package.json
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

> 주의: `src/components/`, `src-tauri/src/lib.rs`는 현재 저장소에 없습니다.

---

## 개발 규칙 및 컨벤션

### 코드 스타일

| 영역 | 규칙 |
|------|------|
| Rust | `rustfmt` 기본 설정, 가능 시 `clippy` 경고 0 유지 |
| JavaScript | ES6+, 세미콜론 사용, 2스페이스 들여쓰기 |
| CSS | BEM 계열 네이밍 권장 |
| 커밋 메시지 | 한글 권장 |

### 브랜치 전략

| 브랜치 | 용도 |
|--------|------|
| `main` | 안정화 릴리즈 |
| `feature/next-improvements` | 현재 통합 개발 라인 |
| `security/*` | 보안 하드닝 |
| `cleanup/*` | 정리/문서/불필요 코드 제거 |
| `feat/*` | 기능 확장/리팩터링 |
| `docs/*` | 문서 작업 |

### 변경 로그 규칙

모든 커밋은 `docs/change_log/change_log.md`에 기록합니다.

1. 커밋 후 변경 로그 업데이트
2. 날짜별 그룹화
3. 커밋 해시 포함
4. 카테고리(Added/Changed/Fixed/Documentation/Security) 명시

---

## 백엔드 핵심 모듈

### 1) `pty.rs`
- PTY 생성/입출력/리사이즈/종료
- 셸 허용 목록, 작업 경로 검증, 환경변수 검증 적용됨

### 2) `project.rs`
- 프로젝트 CRUD, 카테고리, 프로젝트별 env 관리
- 등록 프로젝트 경로 검증 및 하위 경로 검증 유틸 제공

### 3) `settings.rs`
- 앱 설정 저장/로드
- 세션 로그 저장/조회/삭제, 세션 상태 저장/복원

### 4) `snippet.rs`
- 스니펫 CRUD

### 5) `git.rs`
- 상태/브랜치/로그/스테이지/언스테이지/커밋/푸시/풀/체크아웃/디스카드
- 파일 경로 검증, 브랜치명 검증 적용

### 6) `sharing.rs`
- 세션 공유 시작/종료/조회/검색/목록

### 7) `claude.rs`
- Claude 설치 여부 확인
- Claude 시작 명령 생성(경로 검증 포함)

### 8) `ai.rs`
- 자연어 명령 변환
- AI 패턴 조회

---

## IPC 커맨드 현황 (`main.rs`)

`invoke_handler` 등록 커맨드: **52개**

- 공통: `get_home_dir`, `get_file_metadata`
- PTY(4): `create_pty`, `write_pty`, `resize_pty`, `kill_pty`
- Project(13): `list_projects`, `add_project`, `remove_project`, `update_project`, `list_categories`, `add_category`, `remove_category`, `update_category`, `set_project_category`, `load_project_env`, `save_project_env`, `get_project_env_vars`, `update_project_env_vars`
- Snippet(5): `list_snippets`, `add_snippet`, `remove_snippet`, `get_snippet`, `update_snippet`
- Settings/Logs(9): `get_settings`, `save_settings`, `log_session_output`, `get_session_log`, `list_session_logs`, `delete_session_log`, `clear_all_logs`, `save_session_state`, `load_session_state`
- Git(10): `git_status`, `git_branches`, `git_log`, `git_stage`, `git_unstage`, `git_commit`, `git_push`, `git_pull`, `git_checkout`, `git_discard`
- Sharing(5): `start_session_sharing`, `stop_session_sharing`, `get_sharing_status`, `find_shared_session`, `list_shared_sessions`
- Claude/AI(4): `check_claude_installed`, `get_claude_start_command`, `translate_natural_language`, `get_ai_patterns`

---

## 프론트엔드 현황

- `src/app.js`가 주요 기능 대부분을 포함하는 모놀리스 구조
- 주요 기능:
  - 탭/세션/터미널 관리
  - 분할 패널(break/join/move, overlay, sync, layout preset)
  - Git 패널(상태/스테이징/커밋)
  - 설정/스니펫/프로젝트/공유/AI 보조 기능
- 개선 계획(`docs/plans/project-improvement-plan.md`)에 따라 단계적 모듈화 진행

---

## 개선 계획 진행 상태 (요약)

- Phase 1: ✅ 완료
- Phase 2: ✅ 완료 (2-1~2-10)
- Phase 3: ✅ 3-1, 3-2 완료 / 🔄 3-3 문서 동기화 진행
- Phase 4: ⏳ 모듈 설계/추출 예정
- Phase 5: ⏳ 기능 완성/검증 예정

---

## 개발 시 주의사항

### Windows 특이사항
1. ConPTY: Windows 10 1809 이상 필요
2. 인코딩: UTF-8 (`chcp 65001`) 고려
3. 경로: 백슬래시/슬래시 혼용 처리 주의

### 성능
1. xterm 스크롤백 제한 권장
2. PTY 출력 배칭/디바운싱 고려
3. 종료 세션 자원 즉시 해제

### 보안
1. 사용자 경로 입력은 항상 정규화/검증
2. 셸/환경변수/Git 인자 화이트리스트 기반 검증
3. DOM 렌더링 시 `innerHTML` 사용 최소화 + 이스케이프 적용

---

## 참고 리소스

- [Tauri v2 공식 문서](https://v2.tauri.app/)
- [xterm.js 공식 문서](https://xtermjs.org/)
- [portable-pty API](https://docs.rs/portable-pty/)
- [Windows ConPTY 가이드](https://devblogs.microsoft.com/commandline/windows-command-line-introducing-the-windows-pseudo-console-conpty/)

---

*이 문서는 프로젝트 상태 변화에 따라 지속 업데이트됩니다.*
