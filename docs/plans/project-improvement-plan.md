# Shellhive 프로젝트 개선 계획

> 문서 버전: 2026-03-01 v3
> 상태: 확정
> 통합 브랜치: `feature/next-improvements`
> 최종 목표: `feature/next-improvements` → PR → `main` 병합

---

## 1. 개요

Shellhive 프로젝트의 완성도 분석(56%) 및 PR #4 머지 검토 결과를 반영한 종합 개선 계획이다. **프로그램 자체의 개발 내용**에 집중하며, CI/CD·린트 자동화 등 품질 인프라는 추후 별도 진행한다.

### 현재 상태

| 항목 | `feature/next-improvements` | 보안 하드닝 브랜치 (PR #4) |
|------|---------------------------|--------------------------|
| `app.js` | 7,265줄 (단일 모놀리스) | 7,997줄 (보안 패치 + 포맷 변경) |
| Rust 모듈 | 9개 (main, pty, project, settings, snippet, git, sharing, ai, claude) | 동일 + 입력 검증 강화 |
| IPC 핸들러 | 48개 등록 + 6개 미등록 (`claude` 4개, `ai` 2개) | 동일 |
| 테스트 | 27 JS (유효 커버리지 낮음) + 12 Rust | 동일 |
| 보안 하드닝 | 미적용 | 경로 검증, XSS 이스케이프, 브랜치명 검증 적용 |

### 핵심 발견 사항 (코드베이스 분석)

1. **`claude.rs`, `ai.rs` 미등록**: `main.rs`에 `mod` 선언 없음 → 6개 `#[tauri::command]` 함수가 Tauri IPC에서 완전히 도달 불가. 프론트엔드의 `invoke("check_claude_installed")` 등 호출이 항상 실패
2. **PTY 보안 공백**: `pty.rs:46` 셸 실행 파일 무검증, `pty.rs:71` 작업 디렉토리 무검증, `pty.rs:74-78` 환경변수 키/값 무검증
3. **테스트 허위 커버리지**: `session.test.js`, `settings.test.js`가 `app.js`를 import하지 않고 인라인 정의를 테스트 → 실제 코드 커버리지 0%
4. **Git 명령 5개 미사용**: `git_branches`, `git_log`, `git_checkout`, `git_discard`, `get_snippet` — 백엔드 등록됐으나 프론트엔드 UI 없음
5. **CSP 취약**: `tauri.conf.json`에 `'unsafe-inline'` + `'unsafe-eval'` → XSS 방어 무력화

### 실행 현황 (2026-03-02)

- ✅ **Phase 1 완료**
  - PR #6 `security/merge-pr4-hardening` → `feature/next-improvements` 병합
- ✅ **Phase 2 완료**
  - 2-1 PR #7 `security/pty-shell-allowlist`
  - 2-2 PR #8 `security/pty-workdir-validation`
  - 2-3 PR #9 `security/git-filepath-validation`
  - 2-4 PR #10 `security/csp-hardening`
  - 2-5 PR #11 `security/git-css-allowlist`
  - 2-6 `session-id-validation`은 PR #4 통합분에 포함
  - 2-7 PR #17 `security/innerhtml-audit`
  - 2-8 PR #15 `security/tauri-capabilities`
  - 2-9 PR #12 `security/env-var-validation`
  - 2-10 PR #13 `security/claude-path-injection`
  - 후속 보강 PR #18 `fix(security color rendering)`
- ✅ **Phase 3 진행 중**
  - 3-1 PR #19 `cleanup/dead-ipc-commands`
  - 3-2 PR #20 `cleanup/unused-files`
  - 3-3 `cleanup/docs-sync` 진행 중 (AGENTS/문서 동기화)
- ⏳ **Phase 4~5 미착수**

---

## 2. 브랜치 전략

모든 작업은 `feature/next-improvements`를 부모 브랜치로 사용하며, 각 작업 단위는 독립 브랜치에서 개발 후 PR로 병합한다.

```
main
  └── feature/next-improvements (통합 브랜치)
        ├── security/merge-pr4-hardening         ← Phase 1
        ├── security/pty-shell-allowlist          ← Phase 2-1
        ├── security/pty-workdir-validation       ← Phase 2-2
        ├── security/git-filepath-validation      ← Phase 2-3
        ├── security/csp-hardening                ← Phase 2-4
        ├── security/git-css-allowlist            ← Phase 2-5
        ├── security/session-id-validation        ← Phase 2-6
        ├── security/innerhtml-audit              ← Phase 2-7
        ├── security/tauri-capabilities           ← Phase 2-8
        ├── security/env-var-validation           ← Phase 2-9
        ├── security/claude-path-injection        ← Phase 2-10
        ├── cleanup/dead-ipc-commands             ← Phase 3-1
        ├── cleanup/unused-files                  ← Phase 3-2
        ├── cleanup/docs-sync                     ← Phase 3-3
        ├── feat/module-design                    ← Phase 4-1
        ├── feat/state-eventbus                   ← Phase 4-2
        ├── feat/extract-shortcuts                ← Phase 4-3-a
        ├── feat/extract-settings                 ← Phase 4-3-b
        ├── feat/extract-modals                   ← Phase 4-3-c
        ├── feat/extract-git-panel                ← Phase 4-3-d
        ├── feat/extract-tab-manager              ← Phase 4-3-e
        ├── feat/extract-split-pane               ← Phase 4-3-f
        ├── feat/extract-terminal-session         ← Phase 4-3-g
        ├── feat/extract-error-explanations       ← Phase 4-3-h
        ├── feat/app-entrypoint-slim              ← Phase 4-4
        ├── feat/git-panel-ui-complete            ← Phase 5-1
        ├── feat/register-claude-ai-commands      ← Phase 5-2
        ├── feat/test-real-coverage               ← Phase 5-3
        └── feat/security-revalidation            ← Phase 5-4
```

### 브랜치 규칙

| 규칙 | 설명 |
|------|------|
| **브랜치 생성** | 항상 최신 `feature/next-improvements`에서 분기 |
| **PR 대상** | `feature/next-improvements`로 PR 생성 |
| **머지 방식** | Squash merge 또는 일반 merge (커밋 히스토리 보존) |
| **네이밍** | `security/*`, `cleanup/*`, `feat/*`, `docs/*` 접두사 사용 |
| **최종 통합** | 모든 Phase 완료 후 `feature/next-improvements` → `main` PR |

---

## 3. 원칙

1. **보안 우선 (Security First)**: 기능 추가보다 보안 취약점 해소를 우선한다
2. **점진적 분리 (Incremental Decomposition)**: 모듈 단위로 추출, 각 단계마다 기능 정상 동작 확인
3. **검증 가능한 변경 (Verifiable Changes)**: "동작할 것이다"가 아닌 "동작함을 확인했다" 기준
4. **역방향 호환성 유지**: 모듈 분리 과정에서 기존 IPC 인터페이스, 이벤트 이름, DOM 구조 유지
5. **프로그램 개발 집중**: CI/CD 자동화, 린트 설정 등 인프라는 추후 진행

---

## 4. 실행 단계

### Phase 1: 보안 하드닝 브랜치 통합

**브랜치**: `security/merge-pr4-hardening` → PR → `feature/next-improvements`
**목표**: PR #4의 보안 하드닝 작업을 `feature/next-improvements`에 병합하여 단일 코드베이스 확보
**예상 소요**: 1일

#### 1-1. PR #4 병합

- **작업 내용**:
  - `feature/next-improvements`에서 `security/merge-pr4-hardening` 브랜치 생성
  - `15539c1` (PR #4 머지 커밋)의 변경 사항을 cherry-pick 또는 merge
  - 충돌 해결: `change_log.md`, `app.js`, Rust 모듈 충돌 예상
  - PR #4에 포함된 9개 커밋의 변경 요약:
    - `0c87eda` — 프론트엔드 보안·접근성 하드닝 (`escapeHtmlAttr`, `textContent` 전환, ARIA 라벨)
    - `478a084` — 백엔드 입력 검증 (`canonicalize_project_path`, `ensure_registered_project_path`, `validate_branch_name`)
    - `5bc13f7` ~ `f5a093c` — 변경로그, 코드리뷰 후속, 포맷 정합화 6건
- **충돌 예상 지점**:
  - `docs/change_log/change_log.md`: 양쪽 독립 항목 추가 → 수동 병합 (양쪽 모두 유지)
  - `src/app.js`: PR #3(분할 패널)과 PR #4(보안 패치)가 동일 영역 수정 가능 → 세밀한 충돌 해결 필요
  - `.gitignore`: `.omx/` 추가 항목 → 단순 추가
- **인수 기준**:
  - `cargo build` 성공
  - `npm run build` 성공
  - `npm test` 27개 테스트 전체 통과
  - `cargo test` 전체 통과

#### 1-2. 병합 후 기능 스모크 테스트

- **작업 내용**:
  - `npm run tauri dev`로 앱 실행
  - 아래 8개 핵심 시나리오 수동 검증:

| # | 시나리오 | 확인 항목 |
|---|---------|----------|
| 1 | 터미널 생성 | 새 탭 생성 → 프롬프트 출력 → 명령 입력/응답 |
| 2 | 터미널 종료 | 탭 닫기 → PTY 프로세스 정리 확인 |
| 3 | 프로젝트 관리 | 추가 → 목록 표시 → 수정 → 삭제 |
| 4 | 분할 패널 | 수평/수직 분할 → 리사이즈 → 포커스 전환 → 병합 |
| 5 | Git 패널 | 열기 → 상태 확인 → 스테이징 → 커밋 |
| 6 | 스니펫 | 추가 → 실행 → 삭제 |
| 7 | 설정 | 테마 변경 → 저장 → 앱 재시작 후 유지 |
| 8 | 키보드 단축키 | `Ctrl+T` 새 탭, `Ctrl+W` 닫기, `Ctrl+\` 분할 |

- **인수 기준**:
  - 8개 시나리오 전체 정상 동작

---

### Phase 2: 보안 취약점 해소

**목표**: 코드베이스 분석에서 발견된 모든 보안 취약점을 해소한다
**예상 소요**: 5-7일
**선행 조건**: Phase 1 완료

> 각 항목은 독립 브랜치에서 작업하며, 병렬 진행 가능한 항목은 동시 작업한다.

#### 2-1. PTY 셸 실행 파일 허용 목록

**브랜치**: `security/pty-shell-allowlist` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/src/pty.rs`

- **현재 문제** (`pty.rs:46`):
  ```rust
  let shell_cmd = shell.unwrap_or_else(|| "cmd.exe".to_string());
  // → 프론트엔드에서 임의 실행 파일 경로를 전달 가능
  ```
- **구현 상세**:
  1. 허용 셸 목록 상수 정의:
     ```rust
     const ALLOWED_SHELLS: &[&str] = &["cmd.exe", "powershell.exe", "pwsh.exe"];
     ```
  2. `validate_shell(shell: &str) -> Result<String, String>` 함수 신규 작성:
     - 입력에서 파일명(basename)만 추출: `Path::new(shell).file_name()`
     - 대소문자 무시 비교로 허용 목록 대조
     - 허용 목록에 없으면 `Err("Shell not allowed: {shell}")` 반환
     - 허용된 경우 시스템 PATH에서 실제 경로 확인 (`which` 또는 `where` 명령 활용)
  3. `create_pty` 함수 수정 (`pty.rs:36-71`):
     - 기존: `let shell_cmd = shell.unwrap_or_else(|| "cmd.exe".to_string());`
     - 변경: `let shell_cmd = validate_shell(&shell.unwrap_or_else(|| "cmd.exe".to_string()))?;`
  4. 프로젝트 저장 시 셸 필드 검증 (`project.rs:171-180`):
     - `add_project`의 `shell: Option<String>` 인자에도 동일 검증 적용
     - `update_project`의 `shell: Option<String>` 업데이트 시에도 검증
- **테스트 작성** (`src-tauri/src/pty.rs` 내 `#[cfg(test)]`):
  ```rust
  #[test]
  fn test_validate_shell_allowed() {
      assert!(validate_shell("cmd.exe").is_ok());
      assert!(validate_shell("powershell.exe").is_ok());
      assert!(validate_shell("pwsh.exe").is_ok());
      assert!(validate_shell("CMD.EXE").is_ok()); // 대소문자 무시
  }

  #[test]
  fn test_validate_shell_rejected() {
      assert!(validate_shell("calc.exe").is_err());
      assert!(validate_shell("/bin/bash").is_err());
      assert!(validate_shell("C:\\malware\\evil.exe").is_err());
      assert!(validate_shell("cmd.exe && whoami").is_err());
  }

  #[test]
  fn test_validate_shell_path_traversal() {
      assert!(validate_shell("..\\..\\Windows\\System32\\cmd.exe").is_err());
      // basename은 cmd.exe지만 경로 조작이므로 거부
  }
  ```
- **인수 기준**:
  - `cmd.exe`, `powershell.exe`, `pwsh.exe`만 PTY 세션 생성 성공
  - 비허용 셸 요청 시 명확한 에러 메시지 반환
  - Rust 단위 테스트 5개 이상 통과
  - `cargo clippy -- -D warnings` 통과
  - 기존 PTY 관련 기능 회귀 없음

#### 2-2. PTY 작업 디렉토리 검증

**브랜치**: `security/pty-workdir-validation` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/src/pty.rs`

- **현재 문제** (`pty.rs:39, 71`):
  ```rust
  working_dir: String,   // 프론트엔드에서 직접 전달, 검증 없음
  cmd.cwd(&working_dir); // 그대로 사용
  ```
- **구현 상세**:
  1. `project.rs`의 `ensure_registered_project_path` 함수를 PTY 생성에 적용:
     ```rust
     // pty.rs create_pty 함수 내부, cmd.cwd() 호출 전:
     let validated_dir = crate::project::ensure_registered_project_path(&working_dir)?;
     cmd.cwd(&validated_dir);
     ```
  2. 경로 정규화 처리:
     - `std::fs::canonicalize(&working_dir)` 호출로 심볼릭 링크 해석
     - 정규화된 경로가 등록된 프로젝트 경로의 하위 디렉토리인지 확인
     - `..` 컴포넌트로 프로젝트 루트 밖 탈출 차단
  3. 예외 처리: 프로젝트 미등록 상태에서 기본 경로 사용 시:
     - 사용자 홈 디렉토리(`dirs::home_dir()`)는 명시적으로 허용:
       ```rust
       // 홈 디렉토리 예외 처리
       if let Some(home) = dirs::home_dir() {
           let canonical_home = std::fs::canonicalize(&home)
               .map_err(|e| format!("Failed to canonicalize home: {}", e))?;
           if canonical_dir == canonical_home {
               return Ok(working_dir.to_string());
           }
       }
       ```
     - 그 외 미등록 경로는 거부
- **테스트 작성**:
  ```rust
  #[test]
  fn test_workdir_registered_project_accepted() {
      // 등록된 프로젝트 경로에서 PTY 생성 성공 시나리오
  }

  #[test]
  fn test_workdir_unregistered_path_rejected() {
      // C:\Windows\System32 등 미등록 경로 거부
  }

  #[test]
  fn test_workdir_path_traversal_rejected() {
      // ../../etc 형태 거부
  }
  ```
- **인수 기준**:
  - 등록된 프로젝트 디렉토리에서 PTY 생성 성공
  - 미등록 경로에서 PTY 생성 시 에러 반환
  - 경로 순회 공격 차단 확인
  - Rust 단위 테스트 3개 이상 통과

#### 2-3. Git 파일 경로 프로젝트 루트 내 검증

**브랜치**: `security/git-filepath-validation` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/src/git.rs`

- **현재 문제** (`git.rs:203, 221, 283`):
  ```rust
  // git_stage(L203), git_unstage(L221), git_discard(L283)에서
  // files 인자를 그대로 git 명령에 전달, -- 구분자 없음
  let mut args = vec!["add"];
  let file_refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
  args.extend(file_refs);
  // → ../../etc/passwd 같은 경로 탈출 가능, 옵션 주입도 가능
  ```
- **구현 상세**:
  1. 공통 유틸리티 함수 신규 작성:
     ```rust
     /// 파일 경로가 프로젝트 루트 내에 있는지 검증
     fn validate_paths_within_project(
         project_root: &Path,
         files: &[String],
     ) -> Result<Vec<String>, String> {
         let canonical_root = std::fs::canonicalize(project_root)
             .map_err(|e| format!("Failed to canonicalize root: {}", e))?;

         let mut validated = Vec::new();
         for file in files {
             // 절대 경로 거부
             if Path::new(file).is_absolute() {
                 return Err(format!("Absolute path not allowed: {}", file));
             }
             // .. 컴포넌트 거부
             if file.contains("..") {
                 return Err(format!("Path traversal not allowed: {}", file));
             }
             // 널 바이트 거부
             if file.contains('\0') {
                 return Err(format!("Null byte in path not allowed"));
             }
             // 정규화 후 루트 내 포함 확인
             let full_path = canonical_root.join(file);
             if let Ok(canonical_file) = std::fs::canonicalize(&full_path) {
                 if !canonical_file.starts_with(&canonical_root) {
                     return Err(format!("Path escapes project root: {}", file));
                 }
             }
             validated.push(file.clone());
         }
         Ok(validated)
     }
     ```
  2. `git_stage` (`git.rs:203`) 수정:
     ```rust
     let validated_files = validate_paths_within_project(&validated_path, &files)?;
     let mut args = vec!["add", "--"]; // -- 추가로 옵션 주입도 방지
     // validated_files 사용
     ```
  3. `git_unstage` (`git.rs:221`) 동일 패턴 적용
  4. `git_discard` (`git.rs:283`) 동일 패턴 적용
  5. `git_commit` (`git.rs:239`) 메시지 길이 제한 추가:
     ```rust
     if message.len() > 10_000 {
         return Err("Commit message too long (max 10,000 chars)".to_string());
     }
     ```
  6. `git_log` (`git.rs:165`) 제한값 상한 설정:
     ```rust
     let safe_limit = limit.min(1000); // 최대 1000개
     ```
- **테스트 작성** (최소 7개):
  ```rust
  #[test] fn test_valid_relative_path() { /* "src/main.rs" → 통과 */ }
  #[test] fn test_path_traversal_rejected() { /* "../../etc/passwd" → 거부 */ }
  #[test] fn test_absolute_path_rejected() { /* "C:\\Windows\\..." → 거부 */ }
  #[test] fn test_null_byte_rejected() { /* "file\0.txt" → 거부 */ }
  #[test] fn test_multiple_files_mixed() { /* 유효+무효 혼합 → 첫 무효에서 중단 */ }
  #[test] fn test_commit_message_length_limit() { /* 10001자 → 거부 */ }
  #[test] fn test_git_log_limit_capped() { /* u32::MAX → 1000으로 제한 */ }
  ```
- **인수 기준**:
  - 프로젝트 내 파일에 대한 Git 명령 정상 동작
  - 경로 탈출 시도 전부 거부
  - 커밋 메시지 10,000자 초과 거부
  - Git 로그 조회 최대 1,000건 제한
  - Rust 단위 테스트 7개 이상 통과

#### 2-4. CSP 강화

**브랜치**: `security/csp-hardening` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/tauri.conf.json`, `index.html`

- **현재 문제** (`tauri.conf.json:27`):
  ```
  script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'
  ```
- **구현 상세**:
  1. **사전 조사**: xterm.js v5.3.0의 CSP 요구사항 확인
     - xterm.js는 WebGL/Canvas 렌더러 사용, `'unsafe-eval'` 불필요 확인
     - `'wasm-unsafe-eval'`은 WebAssembly 사용 시 필요 → 유지
  2. **인라인 스크립트 분리**:
     - `index.html`에 `<script>` 인라인 코드가 있는지 확인
     - 있다면 외부 `.js` 파일로 분리
     - Vite 빌드 시 자동 생성되는 인라인 스크립트 처리 확인
  3. **CSP 업데이트** (`tauri.conf.json`):
     ```json
     "security": {
       "csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: tauri: http://localhost:* ws://localhost:*; font-src 'self' data:; img-src 'self' data: blob:"
     }
     ```
     - `'unsafe-eval'` 제거
     - `'unsafe-inline'` (script-src)을 제거 시도
     - `'unsafe-inline'` (style-src)은 유지 (xterm.js 동적 스타일 필요)
  4. **Vite 호환성 확인**:
     - `npm run build` 후 번들된 HTML에 인라인 스크립트 존재 여부 확인
     - Vite의 `build.modulePreload` 설정 확인
     - 필요 시 `vite.config.js`에 CSP 관련 설정 추가
  5. **개발/프로덕션 CSP 구분**:
     - 개발 모드(`npm run tauri dev`): Vite HMR이 `ws://localhost:*`와 인라인 스크립트를 필요로 할 수 있으므로 개발 전용 CSP 완화 가능
     - 프로덕션 빌드(`npm run tauri build`): 최종 CSP는 반드시 `'unsafe-eval'` 제거 상태
     - `tauri.conf.json`의 CSP는 프로덕션 기준으로 설정하고, Vite dev server 프록시가 별도 처리
  6. **검증**:
     - `npm run tauri dev` 실행
     - DevTools Console에서 CSP 위반 메시지 0건 확인
     - xterm.js 터미널 렌더링, 입력, 리사이즈 정상 동작
     - 분할 패널 내 터미널 정상 동작
- **인수 기준**:
  - CSP에서 `'unsafe-eval'` 완전 제거
  - `'unsafe-inline'` (script-src) 제거 또는 nonce 기반 전환
  - DevTools 콘솔 CSP 위반 0건
  - xterm.js 전체 기능 정상 동작
  - `npm run build` 성공

#### 2-5. Git 상태 CSS 클래스 허용 목록

**브랜치**: `security/git-css-allowlist` → PR → `feature/next-improvements`
**대상 파일**: `src/app.js` (Git 패널 렌더링 영역)

- **현재 문제**: `file.status` 값이 검증 없이 CSS 클래스로 삽입됨
- **구현 상세**:
  1. 상태-클래스 매핑 객체 정의:
     ```javascript
     const GIT_STATUS_CLASS_MAP = {
       'M': 'modified',
       'A': 'added',
       'D': 'deleted',
       'R': 'renamed',
       'C': 'copied',
       '?': 'untracked',
       '!': 'ignored',
       'U': 'conflicted',
     };

     function getGitStatusClass(status) {
       return GIT_STATUS_CLASS_MAP[status] || 'unknown';
     }
     ```
  2. Git 패널 렌더링 함수에서 `file.status` 직접 삽입 → `getGitStatusClass(file.status)` 호출로 교체
  3. CSS에 `.git-status-unknown` 스타일 추가 (회색 등)
- **인수 기준**:
  - 미허용 상태값이 DOM 클래스로 삽입되지 않음
  - Git 패널 UI 정상 동작 (M, A, D, ?, U 상태 표시)

#### 2-6. 세션 ID 경로 순회 방지

**브랜치**: `security/session-id-validation` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/src/settings.rs`

- **현재 문제** (`settings.rs:106, 123, 187`):
  ```rust
  format!("{}.log", session_id)
  // → session_id가 "../../etc/passwd"이면 경로 탈출
  ```
- **구현 상세**:
  1. `validate_session_id` 함수 작성 (또는 기존 함수 보강):
     ```rust
     fn validate_session_id(id: &str) -> Result<(), String> {
         // 길이 제한 (1~128자)
         if id.is_empty() || id.len() > 128 {
             return Err("Session ID must be 1-128 characters".to_string());
         }
         // 허용 문자: 영숫자, 하이픈, 언더스코어
         if !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
             return Err(format!("Invalid session ID format: {}", id));
         }
         // 경로 구분자 명시적 거부
         if id.contains('/') || id.contains('\\') || id.contains("..") {
             return Err("Path characters not allowed in session ID".to_string());
         }
         Ok(())
     }
     ```
  2. `log_session_output`, `get_session_log`, `delete_session_log` 호출 시작부에 검증 추가
  3. `save_session_state`, `load_session_state`에도 동일 적용
- **테스트 작성**:
  ```rust
  #[test] fn test_valid_uuid_session_id() { /* "abc-123-def" → 통과 */ }
  #[test] fn test_path_traversal_session_id() { /* "../../etc/passwd" → 거부 */ }
  #[test] fn test_empty_session_id() { /* "" → 거부 */ }
  #[test] fn test_too_long_session_id() { /* 129자 → 거부 */ }
  ```
- **인수 기준**:
  - 유효한 세션 ID로 로그 저장/조회 정상 동작
  - 경로 순회 형태 세션 ID 거부
  - Rust 단위 테스트 4개 이상 통과

#### 2-7. innerHTML 사용 전수 감사

**브랜치**: `security/innerhtml-audit` → PR → `feature/next-improvements`
**대상 파일**: `src/app.js`, `src/history-panel.js`

- **작업 내용**:
  1. `app.js` 전체에서 `innerHTML` 할당 위치 전수 식별 (약 53개소 예상)
  2. 각 사이트를 3단계로 분류:
     | 등급 | 정의 | 조치 |
     |------|------|------|
     | **안전** | 리터럴 HTML만 사용, 사용자 입력 없음 | 기존 유지 |
     | **보호됨** | 사용자 입력이 `escapeHtml`/`escapeHtmlAttr`로 이스케이프됨 | 이스케이프 올바름 확인 |
     | **위험** | 사용자 입력이 이스케이프 없이 삽입됨 | `escapeHtml` 적용 또는 `textContent` 전환 |
  3. "위험" 등급 사이트 전부 수정:
     - 가능하면 `textContent` + `replaceChildren` 패턴으로 전환
     - 불가능한 경우(복잡한 HTML 구조) `escapeHtml`/`escapeHtmlAttr` 적용
  4. 감사 결과를 `docs/security/innerhtml-audit.md`에 문서화
- **산출물**: `docs/security/innerhtml-audit.md`
- **인수 기준**:
  - "위험" 등급 innerHTML 사이트 0건
  - 감사 결과 문서 완성
  - 프론트엔드 UI 회귀 없음

#### 2-8. Tauri 권한 범위 축소

**브랜치**: `security/tauri-capabilities` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/capabilities/default.json`

- **현재 문제**: `core:default`가 아직 포함되어 있어 불필요한 권한이 포함됨. 현재 `default.json`은 `core:default` + 개별 권한(`core:event:*`, `shell:allow-open`, `dialog:*`, `core:window:*`)이 혼재된 상태 → 핵심 변경은 `core:default`를 제거하고 필요한 개별 권한만 남기는 것
- **구현 상세**:
  1. 현재 앱이 실제 사용하는 Tauri API 목록 정리:
     - IPC invoke (자동 허용)
     - 이벤트 listen/emit (`core:event`)
     - 창 관리 (`core:window`)
     - 파일 대화상자 (`dialog:default`, `dialog:allow-open`)
     - OS 셸 열기 (`shell:allow-open`)
  2. `core:default`를 개별 권한으로 교체:
     ```json
     "permissions": [
       "core:event:default",
       "core:event:allow-listen",
       "core:event:allow-emit",
       "core:window:default",
       "core:window:allow-set-title",
       "shell:allow-open",
       "dialog:default",
       "dialog:allow-open"
     ]
     ```
  3. `shell:allow-open`에 스코프 제한 추가 (HTTPS URL만 허용):
     ```json
     {
       "identifier": "shell:allow-open",
       "allow": [{ "url": "https://*" }]
     }
     ```
  4. 앱 실행 후 모든 기능 테스트하여 누락된 권한 식별 → 최소한으로 추가
- **인수 기준**:
  - `core:default` 미사용
  - 최소 권한 원칙 적용 (명시적 나열만)
  - `shell:allow-open` URL 스코프 제한
  - 앱 전체 기능 정상 동작

#### 2-9. 환경변수 키/값 검증

**브랜치**: `security/env-var-validation` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/src/pty.rs`, `src-tauri/src/project.rs`

- **현재 문제**:
  - `pty.rs:74-78`: 환경변수 키/값을 프론트엔드에서 그대로 전달
  - `project.rs:410-443`: `.shellhive.env` 파일에 쓸 때 키 검증 없음
- **구현 상세**:
  1. 환경변수 키 검증 함수:
     ```rust
     fn validate_env_key(key: &str) -> Result<(), String> {
         if key.is_empty() || key.len() > 256 {
             return Err("Env key must be 1-256 characters".to_string());
         }
         // 허용: 영숫자, 언더스코어 (POSIX 표준)
         if !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
             return Err(format!("Invalid env key: {}", key));
         }
         // 위험 키 차단
         const BLOCKED_KEYS: &[&str] = &["PATH", "PATHEXT", "COMSPEC", "SHELL",
             "LD_PRELOAD", "LD_LIBRARY_PATH", "DYLD_INSERT_LIBRARIES"];
         if BLOCKED_KEYS.contains(&key.to_uppercase().as_str()) {
             return Err(format!("Blocked env key: {}", key));
         }
         Ok(())
     }
     ```
  2. 환경변수 값 검증:
     ```rust
     fn validate_env_value(value: &str) -> Result<(), String> {
         if value.len() > 4096 {
             return Err("Env value too long (max 4096)".to_string());
         }
         if value.contains('\0') || value.contains('\n') || value.contains('\r') {
             return Err("Env value contains invalid characters".to_string());
         }
         Ok(())
     }
     ```
  3. `create_pty`의 `env_vars` 처리에 검증 적용
  4. `save_project_env`의 키/값 쓰기에 검증 적용
- **테스트 작성** (6개):
  ```rust
  #[test] fn test_valid_env_key() {}
  #[test] fn test_env_key_with_equals_rejected() {}
  #[test] fn test_env_key_path_blocked() {}
  #[test] fn test_env_value_newline_rejected() {}
  #[test] fn test_env_value_too_long_rejected() {}
  #[test] fn test_env_value_null_byte_rejected() {}
  ```
- **인수 기준**:
  - 정상 환경변수 설정/사용 동작 유지
  - 위험 키(PATH, COMSPEC 등) 차단
  - 특수 문자 포함 값 거부
  - Rust 단위 테스트 6개 이상 통과

#### 2-10. Claude 모듈 경로 주입 방지

**브랜치**: `security/claude-path-injection` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/src/claude.rs`

- **현재 문제** (`claude.rs:99-103`):
  ```rust
  Some(path) => format!("cd /d \"{}\" && claude\r", path),
  // → path에 " 또는 && 포함 시 셸 명령 주입
  ```
- **구현 상세**:
  1. 경로 검증 적용:
     ```rust
     pub fn get_claude_start_command(project_path: Option<String>) -> String {
         match project_path {
             Some(path) => {
                 // 경로 정규화 및 검증
                 let validated = match std::fs::canonicalize(&path) {
                     Ok(p) if p.is_dir() => p,
                     _ => return "claude\r".to_string(),
                 };
                 // 셸 메타문자 검증
                 let path_str = validated.to_string_lossy();
                 if path_str.contains('"') || path_str.contains('&')
                     || path_str.contains('|') || path_str.contains(';') {
                     return "claude\r".to_string();
                 }
                 format!("cd /d \"{}\" && claude\r", path_str)
             }
             None => "claude\r".to_string(),
         }
     }
     ```
  2. `execute_claude_command` (`claude.rs:79-86`):
     - 이 함수는 현재 미등록 상태이며, 등록 여부는 Phase 3에서 결정
     - 등록 시: 인자 화이트리스트 적용 (허용 서브커맨드만)
     - 미등록 유지 시: 데드 코드로 Phase 3에서 제거
- **테스트 작성**:
  ```rust
  #[test] fn test_claude_command_normal_path() {}
  #[test] fn test_claude_command_path_with_quotes() { /* 거부 */ }
  #[test] fn test_claude_command_path_with_ampersand() { /* 거부 */ }
  #[test] fn test_claude_command_no_path() { /* "claude\r" 반환 */ }
  ```
- **인수 기준**:
  - 정상 경로에서 Claude 시작 명령 정상 생성
  - 셸 메타문자 포함 경로 거부
  - Rust 단위 테스트 4개 이상 통과

---

### Phase 3: 코드 정리

**목표**: 데드 코드 제거, 미등록 IPC 해결, 문서 현행화
**예상 소요**: 2-3일
**선행 조건**: Phase 2 완료

#### 3-1. 미등록 IPC 명령 해결

**브랜치**: `cleanup/dead-ipc-commands` → PR → `feature/next-improvements`
**대상 파일**: `src-tauri/src/main.rs`, `src-tauri/src/claude.rs`, `src-tauri/src/ai.rs`

- **현재 문제**: `claude.rs` 4개, `ai.rs` 2개 `#[tauri::command]` 함수가 `main.rs`에 `mod` 선언도 `invoke_handler` 등록도 없음
- **구현 상세**:
  1. **결정 기준 분석**:

     | 명령 | 프론트엔드 호출 | 보안 상태 | 결정 |
     |------|---------------|----------|------|
     | `check_claude_installed` | `app.js:5990` | 저위험 (읽기) | 등록 |
     | `get_claude_version` | 미사용 | 저위험 | 제거 (단, 내부 헬퍼 `get_claude_version_internal()`은 유지) |
     | `execute_claude_command` | 미사용 | **고위험** (임의 명령) | **제거** |
     | `get_claude_start_command` | `app.js:6080` | Phase 2-10 패치 | 등록 |
     | `translate_natural_language` | `app.js:6529` | 중위험 (외부 패턴) | 조건부 등록 |
     | `get_ai_patterns` | `app.js:6623` | 저위험 (읽기) | 등록 |

  2. `main.rs`에 모듈 선언 추가:
     ```rust
     mod claude;
     mod ai;
     ```
  3. `invoke_handler`에 선택된 명령 등록:
     ```rust
     .invoke_handler(tauri::generate_handler![
         // ... 기존 48개 ...
         claude::check_claude_installed,
         claude::get_claude_start_command,
         ai::translate_natural_language,
         ai::get_ai_patterns,
     ])
     ```
  4. `execute_claude_command` 함수 제거 (`claude.rs:79-94`)
  5. `get_claude_version` 공개 래퍼 함수 제거 (`claude.rs:54-58`, 내부 헬퍼 `get_claude_version_internal()` L61-74는 유지)
  6. `cargo build` + `cargo clippy -- -D warnings` 성공 확인
- **인수 기준**:
  - `#[tauri::command]` 함수 중 `invoke_handler`에 미등록인 것 0개
  - 프론트엔드 `invoke()` 호출이 정상 응답
  - 고위험 `execute_claude_command` 완전 제거
  - `cargo build` + `cargo clippy -- -D warnings` 통과

#### 3-2. 불필요 파일 제거

**브랜치**: `cleanup/unused-files` → PR → `feature/next-improvements`

- **대상 파일 조사 및 처리**:

  | 파일 | 상태 | 조치 |
  |------|------|------|
  | `src/app.js.backup` | 이전 버전 백업, 보안 취약 패턴 포함 | **삭제** |
  | `src/history-panel-integration.js` | 86줄, 통합 가이드 (런타임 미사용) | `docs/guides/`로 이동 또는 삭제 |
  | `command-palette-code.js` | 프로젝트 루트의 미통합 초안 | `docs/drafts/`로 이동 또는 삭제 |

- **추가 확인 작업**:
  1. `index.html`에서 각 JS 파일의 `<script>` 참조 확인
  2. `app.js`에서 `import` 또는 동적 로드 확인
  3. Vite 빌드 로그에서 사용된 entry/chunk 확인
- **.gitignore 업데이트**:
  ```
  *.backup
  ```
- **인수 기준**:
  - 런타임에 로드되지 않는 JS 파일 0개 (테스트 제외)
  - `npm run build` 성공
  - 빌드 결과물에 불필요 파일 미포함

#### 3-3. 문서 현행화

**브랜치**: `cleanup/docs-sync` → PR → `feature/next-improvements`
**대상 파일**: `AGENTS.md`, `docs/change_log/change_log.md`

- **AGENTS.md 수정 항목**:
  1. `src/components/` 디렉토리 참조 제거 (실제 미존재)
  2. `lib.rs` 참조 제거 (실제 미존재)
  3. IPC 명령 목록을 실제 코드와 동기화:
     - 현재 등록: 48개 (Phase 3-1 이후 52개)
     - 각 명령의 모듈, 인자, 반환 타입 기술
  4. Phase 5 이후 추가된 기능 문서화:
     - 분할 패널 시스템 (break/join/move, sync, overlay, layout policy)
     - Git 통합 (status, stage, unstage, commit, push, pull)
     - 세션 공유 (sharing 모듈)
     - 다국어 지원 (i18n)
     - 레이아웃 프리셋 (grid, main-sidebar 등)
  5. 프론트엔드 파일 목록 현행화:
     - `src/app.js` — 메인 애플리케이션 (7,265줄, Phase 1 병합 후 약 7,997줄 예상)
     - `src/history-panel.js` — 히스토리 패널 (393줄)
     - `src/i18n/index.js` — 다국어 (240줄)
     - `src/ui-constants.js` — UI 상수 (37줄)
- **변경 로그 업데이트**:
  - Phase 1~3 작업 내역을 날짜별로 기록
- **인수 기준**:
  - AGENTS.md에 실제 존재하지 않는 파일/디렉토리 참조 0건
  - IPC 명령 목록이 실제 코드와 100% 일치
  - 변경 로그에 모든 Phase 작업 기록

---

### Phase 4: 프론트엔드 아키텍처 개선 (app.js 모듈화)

**목표**: `app.js` 모놀리스(현재 7,265줄, Phase 1 병합 후 약 7,997줄)를 10+ ES 모듈로 분리
**예상 소요**: 7-10일
**선행 조건**: Phase 3 완료

> **참고**: 이 Phase는 가장 큰 작업이며, 각 모듈 추출을 독립 브랜치로 진행한다. 순서가 중요 — 의존성이 적은 모듈부터 추출한다.

#### 4-1. 모듈 경계 설계 문서

**브랜치**: `feat/module-design` → PR → `feature/next-improvements`

- **작업 내용**:
  1. `app.js`의 모든 함수를 기능 영역별로 분류:

     | 모듈 | 줄 범위 (대략) | 함수 수 | 책임 |
     |------|-------------|--------|------|
     | `state.js` | 전역 변수 영역 | ~15 | 전역 상태, DOM 참조, 이벤트 버스 |
     | `terminal-manager.js` | L2312-2690 | ~20 | xterm.js 인스턴스 생성, 리사이즈, 포커스, 테마 |
     | `session-manager.js` | L2697-3110 | ~15 | PTY 세션 생명주기, IPC 통신, 로그 |
     | `tab-manager.js` | L3111-4694 | ~30 | 탭 CRUD, 전환, 드래그앤드롭, 탭 그룹, 검색 |
     | `split-pane.js` | L4695-5700 | ~40 | 분할 레이아웃, 리사이즈, 프리셋, overlay, sync |
     | `git-panel.js` | L7706-7932 | ~15 | Git UI, 상태 표시, 스테이징, 커밋 |
     | `settings.js` | L1420-1600 | ~10 | 설정 로드/저장, UI 바인딩 |
     | `modals.js` | 모달 관련 함수들 | ~10 | 모달 열기/닫기, 폼 처리 |
     | `shortcuts.js` | 단축키 관련 | ~10 | 키바인딩 등록, 처리 |
     | `error-explanations.js` | L6630-6800 | ~5 | AI 에러 설명, Claude 통합 |
     | `project-manager.js` | 프로젝트 관련 | ~15 | 프로젝트 CRUD, 카테고리, 환경변수 |
     | `snippets.js` | 스니펫 관련 | ~10 | 스니펫 CRUD, 실행 |
     | `sharing.js` | L7498-7700 | ~10 | 세션 공유 |
     | `command-palette.js` | 커맨드팔레트 | ~10 | 명령 등록, 검색, 실행 |

  2. 모듈 간 의존 관계 다이어그램 작성:
     ```
     state.js (최하위, 의존 없음)
       ↑
     terminal-manager.js ← session-manager.js
       ↑                      ↑
     tab-manager.js ──────────┘
       ↑
     split-pane.js
       ↑
     app.js (진입점, import만 수행)
     ```
  3. 순환 의존 방지를 위한 이벤트 버스 설계:
     ```javascript
     // state.js
     class EventBus {
       constructor() { this.listeners = new Map(); }
       on(event, callback) { ... }
       off(event, callback) { ... }
       emit(event, data) { ... }
     }
     export const eventBus = new EventBus();
     ```
  4. 모듈 간 통신 규칙:
     - 하위 모듈 → 상위 모듈: `import`로 직접 참조
     - 상위 모듈 → 하위 모듈: `eventBus.emit()`으로 간접 통신
     - 동일 계층 모듈 간: `eventBus`로만 통신 (순환 방지)
- **산출물**: `docs/plans/module-design.md`
- **인수 기준**:
  - 10개 이상 모듈 식별, 각 모듈 책임 명확 정의
  - 순환 의존 없는 의존 관계 다이어그램 완성
  - 이벤트 버스 인터페이스 설계 완료

#### 4-2. 공유 상태 및 이벤트 버스 추출

**브랜치**: `feat/state-eventbus` → PR → `feature/next-improvements`
**생성 파일**: `src/state.js` (신규)

- **작업 내용**:
  1. `state.js` 파일 생성:
     ```javascript
     // src/state.js
     // 전역 상태 관리 및 이벤트 버스

     /** @type {Object} 애플리케이션 전역 상태 */
     export const state = {
       sessions: {},
       activeSessionId: null,
       projects: [],
       categories: [],
       snippets: [],
       settings: {},
       terminals: {},
       splitLayouts: {},
       // ... app.js의 전역 state 객체 전체 이동
     };

     /** DOM 요소 참조 */
     export const elements = {};

     /** 이벤트 버스 */
     class EventBus { ... }
     export const eventBus = new EventBus();
     ```
  2. `app.js`에서 전역 `state` 객체, DOM 참조 변수를 `state.js`로 이동
  3. `app.js`에 `import { state, elements, eventBus } from './state.js';` 추가
  4. 모든 `state.xxx` 참조가 정상 동작하는지 확인
- **인수 기준**:
  - `state.js` 파일 독립 존재
  - `app.js`에서 state import로 참조
  - `npm run tauri dev`로 전체 기능 정상 동작
  - `npm run build` 성공
  - 브라우저 콘솔 에러 0건

#### 4-3. 모듈 순차 추출 (8회차)

각 추출은 독립 브랜치에서 수행. 추출 순서: 의존성 적은 것 → 많은 것.

> **병렬화 가능 구간**: 4-3-a(shortcuts)와 4-3-b(settings)는 상호 의존이 없으므로 동시 진행 가능. 4-3-d(git-panel)와 4-3-h(error-explanations)도 독립적이므로 병렬 가능. 단, 4-3-e(tab-manager) → 4-3-f(split-pane) → 4-3-g(terminal-session)은 의존 관계가 있으므로 순차 진행 필수.

##### 4-3-a. shortcuts.js 추출

**브랜치**: `feat/extract-shortcuts` → PR → `feature/next-improvements`

- `app.js`에서 키보드 단축키 관련 함수 추출
- 대상: 단축키 등록, 키 이벤트 처리, 커맨드 팔레트 단축키
- `import { state, eventBus } from './state.js'` 참조

##### 4-3-b. settings.js 추출

**브랜치**: `feat/extract-settings` → PR → `feature/next-improvements`

- `loadSettings()`, `saveSettings()`, 설정 UI 바인딩 추출
- 대상 줄: L1420-1600 및 설정 모달 관련 함수
- `invoke("get_settings")`, `invoke("save_settings")` IPC 호출 포함
- **순서 근거**: settings 모듈은 다른 모듈(modals 포함)이 의존하는 설정 값을 제공하므로 먼저 추출

##### 4-3-c. modals.js 추출

**브랜치**: `feat/extract-modals` → PR → `feature/next-improvements`

- 모달 다이얼로그 공통 로직 추출
- 대상: 모달 열기/닫기, 폼 처리, 확인 대화상자
- 프로젝트 추가 모달, 스니펫 모달, 설정 모달, 공유 모달 포함
- settings.js 추출 이후 진행 (설정 모달이 settings 모듈 참조)

##### 4-3-d. git-panel.js 추출

**브랜치**: `feat/extract-git-panel` → PR → `feature/next-improvements`

- Git 패널 UI 전체 추출
- 대상 줄: L7706-7932
- 대상 함수: `toggleGitPanel`, `refreshGitStatus`, `renderGitPanel`, `setupGitPanelListeners`
- Phase 2-5에서 적용한 CSS 허용 목록 포함

##### 4-3-e. tab-manager.js 추출

**브랜치**: `feat/extract-tab-manager` → PR → `feature/next-improvements`

- 탭 관리 전체 추출 (가장 큰 모듈 중 하나)
- 대상 줄: L3111-4694 (약 1,500줄)
- 대상 함수: 탭 생성, 전환, 닫기, 드래그앤드롭, 탭 그룹, 탭 검색
- `session-manager.js`와 이벤트 버스로 통신

##### 4-3-f. split-pane.js 추출

**브랜치**: `feat/extract-split-pane` → PR → `feature/next-improvements`

- 분할 패널 시스템 전체 추출 (가장 큰 모듈)
- 대상 줄: L4695-5700 (약 1,000줄)
- 대상 함수: `initSplitMode`, `splitActivePane`, `renderSplitLayout`, `renderSplitNode`, 리사이즈, 프리셋, overlay, sync, break/join/move
- `tab-manager.js`와 이벤트 버스로 통신

##### 4-3-g. terminal-manager.js + session-manager.js 추출

**브랜치**: `feat/extract-terminal-session` → PR → `feature/next-improvements`

- 터미널(xterm.js)과 PTY 세션 관리 추출
- 대상 줄: L2312-3110 (약 800줄)
- 대상 함수: `createSession`, `activateSession`, `closeSession`, `logSessionOutput`
- PTY IPC 호출 (`create_pty`, `write_pty`, `resize_pty`, `kill_pty`) 포함
- xterm.js 인스턴스 생성, fit addon, 테마 적용 포함

##### 4-3-h. error-explanations.js 추출

**브랜치**: `feat/extract-error-explanations` → PR → `feature/next-improvements`

- AI 에러 설명 및 Claude 통합 기능 추출
- 대상 함수: `checkClaudeInstalled`, `_startClaudeSession`, AI 관련 UI
- `isAiFeaturesEnabled`, `applyAiFeatureVisibility` 포함

**각 추출 단계의 공통 인수 기준**:
- 추출 모듈이 독립 `.js` 파일로 존재
- `app.js`에서 해당 코드 완전 제거
- `app.js`에 `import` 문 추가
- `npm run build` 성공
- `npm run tauri dev` 실행 후 해당 기능 정상 동작
- 브라우저 콘솔에 import/export 에러 0건

#### 4-4. app.js 진입점 축소

**브랜치**: `feat/app-entrypoint-slim` → PR → `feature/next-improvements`

- **작업 내용**:
  1. 모든 모듈 추출 완료 후 `app.js`에 남는 코드:
     ```javascript
     // src/app.js (진입점)
     import { state, elements, eventBus } from './state.js';
     import { initShortcuts } from './shortcuts.js';
     import { initModals } from './modals.js';
     import { initSettings } from './settings.js';
     import { initGitPanel } from './git-panel.js';
     import { initTabManager } from './tab-manager.js';
     import { initSplitPane } from './split-pane.js';
     import { initTerminalManager } from './terminal-manager.js';
     import { initSessionManager } from './session-manager.js';
     import { initErrorExplanations } from './error-explanations.js';
     import { initProjectManager } from './project-manager.js';
     import { initSnippets } from './snippets.js';
     import { initSharing } from './sharing.js';
     import { initCommandPalette } from './command-palette.js';

     document.addEventListener('DOMContentLoaded', async () => {
       initializeDOMElements();
       await loadSettings();
       // 모듈 초기화 순서
       initShortcuts();
       initModals();
       initTerminalManager();
       initSessionManager();
       initTabManager();
       initSplitPane();
       initGitPanel();
       initSettings();
       initProjectManager();
       initSnippets();
       initSharing();
       initErrorExplanations();
       initCommandPalette();
       // 초기 세션 생성
       await createInitialSession();
     });
     ```
  2. `initializeDOMElements` 함수도 `state.js`의 `elements` 객체 초기화로 이동 가능
- **인수 기준**:
  - `app.js` 200줄 이하
  - 14개 모듈 파일 독립 존재
  - `npm run build` 성공
  - 전체 기능 정상 동작

---

### Phase 5: 기능 완성 및 검증

**목표**: 미완성 기능 연결, 테스트 유효성 확보, 보안 재검증
**예상 소요**: 3-5일
**선행 조건**: Phase 4 완료

#### 5-1. Git 패널 UI 완성

**브랜치**: `feat/git-panel-ui-complete` → PR → `feature/next-improvements`

- **현재 문제**: 백엔드에 `git_branches`, `git_log`, `git_checkout`, `git_discard` 가 등록되어 있지만 프론트엔드 UI가 없음
- **구현 상세**:
  1. Git 패널에 **브랜치 관리** 섹션 추가:
     - 현재 브랜치 표시
     - 브랜치 목록 드롭다운 (`git_branches` IPC 호출)
     - 브랜치 전환 기능 (`git_checkout` IPC 호출)
  2. Git 패널에 **커밋 히스토리** 섹션 추가:
     - 최근 커밋 10개 목록 (`git_log` IPC 호출)
     - 커밋 해시, 메시지, 작성자, 날짜 표시
  3. Git 패널에 **변경 취소** 기능 추가:
     - 스테이지되지 않은 파일에 대해 "Discard" 버튼 (`git_discard` IPC 호출)
     - 확인 대화상자 표시 (비가역적 작업)
  4. CSS 스타일 추가:
     - 브랜치 선택 UI, 커밋 히스토리 목록, discard 버튼
  5. 키보드 접근성:
     - 브랜치 드롭다운 키보드 네비게이션
     - Discard 확인 대화상자 키보드 조작
- **인수 기준**:
  - 브랜치 목록 표시 및 전환 동작
  - 커밋 히스토리 10개 표시
  - 변경 취소 기능 동작 (확인 대화상자 포함)
  - 모든 기존 Git 기능 회귀 없음

#### 5-2. Claude/AI 모듈 IPC 연결 완성

**브랜치**: `feat/register-claude-ai-commands` → PR → `feature/next-improvements`

- **현재 문제**: Phase 3-1에서 `mod` 선언 및 `invoke_handler` 등록 후, 프론트엔드 호출이 정상 연결되는지 확인 필요
- **구현 상세**:
  1. `check_claude_installed` 정상 동작 확인:
     - `app.js:5990` — Claude 설치 여부 체크
     - 미설치 시 UI에 적절한 안내 표시
  2. `get_claude_start_command` 정상 동작 확인:
     - `app.js:6080` — PTY에 Claude 시작 명령 전송
     - Phase 2-10 보안 패치 적용 상태
  3. `translate_natural_language` 동작 확인:
     - `app.js:6529` — 자연어 → 셸 명령 변환
     - AI 패턴 매칭 로직 정상 동작
  4. `get_ai_patterns` 동작 확인:
     - `app.js:6623` — AI 자동완성 패턴 로드
  5. AI 기능 토글 동작 확인:
     - `isAiFeaturesEnabled()` (L1374) — 설정에 따른 AI UI 표시/숨김
- **인수 기준**:
  - 프론트엔드 `invoke()` 호출이 `null`이 아닌 정상 응답 반환
  - Claude 미설치 시 적절한 폴백 동작
  - AI 기능 비활성화 시 관련 UI 숨김

#### 5-3. 테스트 유효성 확보

**브랜치**: `feat/test-real-coverage` → PR → `feature/next-improvements`

- **현재 문제**: `session.test.js`, `settings.test.js`가 인라인 정의를 테스트 → 실제 코드 커버리지 0%
- **구현 상세**:
  1. **기존 테스트 수정**:
     - `session.test.js`: 인라인 `SESSION_STATUS` → `import { SESSION_STATUS } from '../session-manager.js'` (Phase 4 모듈화 이후)
     - `settings.test.js`: 인라인 `TERMINAL_THEMES` → `import { TERMINAL_THEMES } from '../settings.js'`
  2. **Tauri IPC mock 유틸리티 개선** (`setup.js`):
     ```javascript
     // 현재: 모든 invoke를 빈 객체로 반환
     // 개선: 명령별 mock 데이터 반환
     const mockResponses = {
       'list_projects': () => [{ id: '1', name: 'Test', path: '/tmp/test' }],
       'get_settings': () => ({ theme: 'dark', fontSize: 14 }),
       'git_status': () => ({ files: [], branch: 'main' }),
       // ...
     };
     ```
  3. **모듈별 단위 테스트 신규 작성** (Phase 4 모듈화 기준):
     | 테스트 파일 | 대상 모듈 | 최소 테스트 수 |
     |------------|----------|-------------|
     | `state.test.js` | `state.js` | 5 (상태 초기화, 이벤트 버스 on/off/emit) |
     | `session-manager.test.js` | `session-manager.js` | 5 (생성, 활성화, 종료, 로그) |
     | `tab-manager.test.js` | `tab-manager.js` | 5 (생성, 전환, 닫기, 드래그앤드롭) |
     | `settings.test.js` | `settings.js` | 3 (로드, 저장, 기본값) |
     | `git-panel.test.js` | `git-panel.js` | 3 (상태 표시, 스테이징, CSS 허용목록) |
     | `shortcuts.test.js` | `shortcuts.js` | 3 (등록, 처리, 충돌) |
  4. **Rust 테스트 확충**:
     | 모듈 | 현재 테스트 | 신규 추가 | 합계 |
     |------|-----------|----------|------|
     | `pty.rs` | 2 (초기화만) | +5 (Phase 2에서 추가) | 7 |
     | `git.rs` | 0 | +7 (Phase 2에서 추가) | 7 |
     | `project.rs` | 0 | +5 (CRUD, 경로, 중복) | 5 |
     | `settings.rs` | 0 | +4 (Phase 2에서 추가) | 4 |
     | `snippet.rs` | 0 | +3 (CRUD) | 3 |
     | `claude.rs` | 3 | +4 (Phase 2에서 추가) | 7 |
     | `sharing.rs` | 2 | 0 | 2 |
     | `ai.rs` | 5 | 0 | 5 |
- **인수 기준**:
  - 모든 JS 테스트가 실제 모듈을 import하여 테스트
  - JS 테스트 총 50개 이상 (기존 27 + 신규 24+)
  - Rust 테스트 총 40개 이상 (기존 12 + 신규 28+)
  - `npm test` 전체 통과
  - `cargo test` 전체 통과

#### 5-4. 보안 재검증

**브랜치**: `feat/security-revalidation` → PR → `feature/next-improvements`

- **작업 내용**:
  1. Phase 2의 모든 보안 테스트를 모듈화된 코드에서 재실행
  2. `escapeHtml`, `escapeHtmlAttr`, CSS 허용 목록이 모듈 이동 후 정상 동작 확인
  3. innerHTML 감사 재실행 — 모듈 분리로 새로 생긴 innerHTML 사이트 확인
  4. CSP 위반 재확인 — 모듈 import로 인한 새로운 CSP 이슈 확인
  5. 보안 검증 결과를 `docs/security/revalidation-report.md`에 기록
- **인수 기준**:
  - Phase 2 보안 테스트 전체 통과 (수정 없이)
  - 모듈 분리로 인한 새로운 보안 이슈 0건
  - 재검증 보고서 완성

---

## 5. 추후 진행 (별도 계획)

아래 항목은 본 계획의 범위에서 제외하며, 별도 계획으로 추후 진행한다.

| 항목 | 설명 | 시점 |
|------|------|------|
| **CI/CD 파이프라인** | GitHub Actions 워크플로우, PR 자동 검사 | Phase 5 이후 |
| **린트 자동화** | ESLint ES module 설정, Prettier, pre-commit hooks | Phase 5 이후 |
| **코드 포맷 강제** | `cargo fmt --check`, `npm run lint` CI 통합 | CI/CD와 함께 |
| **테스트 커버리지 리포팅** | Vitest coverage, Rust tarpaulin/llvm-cov | CI/CD와 함께 |
| **자동 빌드/릴리즈** | Tauri 빌드, 인스톨러 생성, 서명 | 릴리즈 준비 시 |

---

## 6. 위험 요소 및 완화 방안

| 위험 요소 | 심각도 | 발생 가능성 | 완화 방안 |
|-----------|--------|------------|-----------|
| PR #4 병합 시 충돌 | 높음 | 중간 | `app.js` 충돌이 핵심. 세밀한 수동 병합 필요. 공통 조상(`aaf4b4c`)이 최근이므로 범위 제한적 |
| CSP 강화 후 xterm.js 동작 불가 | 높음 | 낮음 | xterm.js v5.3.0 CSP 호환성 사전 확인. `wasm-unsafe-eval` 유지. 문제 시 버전 업그레이드 |
| app.js 모듈 분리 중 기능 회귀 | 높음 | 중간 | 한 번에 하나의 모듈만 추출. 각 단계 후 8개 시나리오 스모크 테스트 수행 |
| 모듈 분리 후 Vite 번들 크기 증가 | 낮음 | 낮음 | Vite의 코드 분할이 자동 처리. 필요 시 수동 chunk 설정 |
| Phase 4 기간 초과 | 중간 | 중간 | 7-10일 보수적 추정. 의존성 적은 모듈 우선 추출로 조기 성과 확보 |
| 환경변수 검증으로 기존 사용 차단 | 중간 | 낮음 | 차단 키 목록을 보수적으로 설정. 사용자 피드백 후 조정 |

---

## 7. 전체 의존 관계 및 일정

```
Phase 1 (1일)
  └── Phase 2 (5-7일) ── 병렬 가능: 2-1~2-4 동시, 2-5~2-10 동시
        └── Phase 3 (2-3일) ── 병렬 가능: 3-1, 3-2, 3-3 동시
              └── Phase 4 (7-10일) ── 순차: 4-1 → 4-2 → 4-3-a~h → 4-4
                    └── Phase 5 (3-5일) ── 병렬 가능: 5-1, 5-2 동시 → 5-3 → 5-4
```

**총 예상 소요**: 18-26일 (순차 실행)

**병렬화 시 예상 소요**: 14-20일

| Phase | 순차 | 병렬화 |
|-------|------|--------|
| Phase 1 | 1일 | 1일 |
| Phase 2 | 5-7일 | 3-4일 (4개 + 6개 병렬 배치) |
| Phase 3 | 2-3일 | 1-2일 (3개 동시) |
| Phase 4 | 7-10일 | 7-10일 (순차 필수) |
| Phase 5 | 3-5일 | 2-4일 (부분 병렬) |

---

## 8. ADR (Architecture Decision Record)

### ADR-001: Vite 기반 ESM 모듈 분리

- **결정**: 기존 Vite 번들러를 유지하면서 ESM 모듈로 분리
- **주요 요인**: 프로젝트가 이미 Vite 사용 중 (`package.json`, `vite.config.js`, `tauri.conf.json`)
- **대안 검토**:
  - (A) Vite 제거 후 네이티브 ESM만: `import { Terminal } from 'xterm'` 같은 bare specifier가 번들러 없이 해석 불가 → 불가능
  - (B) Webpack 도입: Vite가 이미 있으므로 중복 → 불필요
- **선택 근거**: Vite가 ESM import를 네이티브로 해석, HMR과 코드 분할 제공
- **결과**: `type="module"` 유지, Vite dev server가 import 해석

### ADR-002: 테스트 프레임워크 — Vitest 유지

- **결정**: 기존 Vitest 설정 활용
- **주요 요인**: ESM 네이티브 지원, Jest 호환 API, 프로젝트에 이미 설정됨
- **선택 근거**: 27개 테스트가 이미 Vitest로 동작 중. 추가 설정 비용 최소
- **후속 조치**: Tauri IPC mock 유틸리티 개선 (Phase 5-3)

---

## 9. 최종 통합

모든 Phase 완료 후:

1. `feature/next-improvements` 브랜치에서 전체 통합 테스트 수행
2. `npm run build` + `cargo build` 성공 확인
3. `npm test` + `cargo test` 전체 통과 확인
4. 8개 시나리오 스모크 테스트 수행
5. 보안 재검증 보고서 확인
6. `feature/next-improvements` → `main` PR 생성
7. 코드 리뷰 후 머지

---

*본 문서는 프로젝트 완성도 분석(56%) 및 PR #4 머지 검토 결과를 기반으로 작성되었습니다.*
*품질 인프라 자동화(CI/CD, 린트, 커버리지 리포팅)는 추후 별도 계획으로 진행합니다.*
