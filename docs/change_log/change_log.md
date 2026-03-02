# Shellhive 변경 로그 (Change Log)

이 문서는 Shellhive 프로젝트의 주요 변경 사항을 기록합니다.

- 형식: [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)
- 버전 정책: [Semantic Versioning](https://semver.org/lang/ko/)
- 인코딩: UTF-8

---

## [Unreleased]

### 2026-03-02

#### docs: 개선 계획 문서 PR 병합

**커밋**: `36002db`

##### 문서화됨 (Documentation)

- `docs/plans/project-improvement-plan.md`를 `feature/next-improvements`에 통합
- 코드베이스 전수 분석 기반 Phase/브랜치 전략 문서를 메인 개선 라인에 반영

#### security: Phase 1 보안 하드닝 통합

**커밋**: `81131f9`

##### 변경됨 (Changed)

- PR #4 보안 하드닝 변경을 `feature/next-improvements` 기반 라인에 통합
- 프론트엔드 XSS/접근성 보강(`escapeHtmlAttr`, `textContent` 기반 렌더링) 반영
- 백엔드 경로/입력 검증 강화(`ensure_registered_project_path`, branch name validation) 반영

#### feat(security): PTY 셸 허용 목록 검증 추가

**커밋**: `6e523fa`

##### 추가됨 (Added)

- `src-tauri/src/pty.rs`
  - 허용 셸 목록 상수(`cmd.exe`, `powershell.exe`, `pwsh.exe`) 도입
  - `validate_shell()` 구현으로 경로 기반 셸 실행/비허용 셸/경로 조작 입력 차단
  - `create_pty`에서 셸 검증을 강제
  - 셸 검증 단위 테스트 추가(허용/거부/경로 조작 케이스)
- `src-tauri/src/project.rs`
  - `add_project`, `update_project` 시 셸 값 검증 적용

##### 테스트 (Verification)

- `npm run build` ✅
- `npm test` ✅ (22 passed)
- `cargo test --manifest-path src-tauri/Cargo.toml test_validate_shell_allowed` ❌
  - 실행 환경에서 `pkg-config` 및 GTK 계열 시스템 라이브러리 부재로 Rust 빌드 단계 실패

#### feat(security): PTY 작업 디렉토리 검증 강화

**커밋**: `43f1d63`

##### 변경됨 (Changed)

- `src-tauri/src/pty.rs`
  - `validate_working_directory()` 추가
  - PTY 생성 시 작업 디렉토리를 정규화 후 검증하도록 변경
  - 등록된 프로젝트 경로 또는 그 하위 경로만 허용
  - 사용자 홈 디렉토리는 명시적 예외로 허용
- `src-tauri/src/project.rs`
  - `ensure_registered_project_path_or_subdir()` 추가
  - 등록 프로젝트 루트뿐 아니라 하위 디렉토리 검증을 지원

##### 테스트 (Verification)

- `npm run build` ✅
- `npm test` ✅ (22 passed)

#### feat(security): Git 파일 경로 검증 강화

**커밋**: `3ae1999`

##### 변경됨 (Changed)

- `src-tauri/src/git.rs`
  - `git_stage`, `git_unstage`, `git_discard`에 공통 파일 경로 검증 적용
  - 절대 경로/`..` 기반 경로 순회/옵션 형태(`-` 시작) 입력 차단
  - 레포지토리 루트 외부 경로 접근 차단 로직 추가
  - 파일 경로 검증 단위 테스트 4종 추가

##### 테스트 (Verification)

- `npm run build` ✅
- `npm test` ✅ (22 passed)

### 2026-03-01

#### docs: 프로젝트 개선 계획 v3 작성

**커밋**: `0e9f877`

##### 추가됨 (Added)

- **`docs/plans/project-improvement-plan.md`**: 프로젝트 개선 계획 v3
  - 코드베이스 전수 분석 기반 상세 계획 (보안 취약점, 데드 코드, 테스트 커버리지 등)
  - 5단계 Phase 구성: 보안 하드닝 통합 → 보안 취약점 해소(10개) → 코드 정리 → 모듈화 → 기능 완성
  - 브랜치 전략: 개별 작업 브랜치 → PR → `feature/next-improvements` → PR → `main`
  - 각 항목별 대상 파일, 줄 번호, 구현 코드, 테스트 케이스 명시
  - 품질 인프라 자동화는 추후 진행으로 분리
  - ADR-001 (Vite 기반 ESM), ADR-002 (Vitest) 포함

### 2026-02-24

#### feat(frontend-hardening): 프론트엔드 보안·접근성 하드닝 적용

**커밋**: `0c87eda`

##### 변경됨 (Changed)

- `src/app.js`
  - 스니펫/프로젝트 렌더링에서 `data-*`에 JSON 문자열을 직접 주입하던 구조를 상태 조회 방식으로 전환
  - 속성 컨텍스트용 `escapeHtmlAttr()`를 도입하고, `title`, `data-file` 등 속성 값 렌더링에 적용
  - 공유 코드 표시를 `innerHTML`에서 `textContent + replaceChildren`로 전환하여 DOM XSS 위험 제거
  - 토스트/스니펫/프로젝트/환경변수/필터/탭 닫기 버튼에 `aria-label` 보강
  - 카테고리 색상 렌더링을 data attribute + 런타임 검증(`normalizeCategoryColor`) 기반으로 변경
- `src/history-panel.js`
  - 동적 히스토리 패널에 `role="dialog"`, `aria-modal`, `aria-labelledby` 적용
  - 검색 입력 접근성 라벨(`aria-label`) 및 액션 버튼 접근성 라벨 보강
  - 히스토리 item의 프로젝트명/속성값 이스케이프 처리 강화
- `index.html`
  - 깨진 한글 `aria-label` 문자열 복구
  - 동적 생성 방식과 충돌하던 정적 History Panel 블록 제거

#### feat(backend-hardening): 백엔드 입력 검증 및 Git 권한 경계 강화

**커밋**: `478a084`

##### 변경됨 (Changed)

- `src-tauri/src/settings.rs`
  - `validate_session_id()` 추가
  - `log_session_output`, `get_session_log`, `delete_session_log` 호출 경로에서 세션 ID 검증 강제
- `src-tauri/src/project.rs`
  - `canonicalize_project_path()`, `ensure_registered_project_path()` 도입(등록 프로젝트 경로 강제)
  - `load_project_env`, `save_project_env`에서 등록된 프로젝트 경로만 허용
  - 카테고리 색상 입력값 `#RRGGBB` 형식 검증(`normalize_category_color`) 추가
- `src-tauri/src/git.rs`
  - Git 명령 전반에서 등록 프로젝트 경로 검증 적용
  - `git_checkout` 브랜치명 검증 로직 추가(`check-ref-format` + 옵션/개행/널 차단)
  - `git_stage`에 `git add -- <files>` 적용으로 인자 주입 위험 완화

#### docs(change-log): 2026-02-24 하드닝 작업 내역 문서화

**커밋**: `5bc13f7`

##### 문서화됨 (Documentation)

- `docs/change_log/change_log.md`
  - 프론트엔드/백엔드 하드닝 커밋 2건의 목적, 변경 파일, 핵심 개선 포인트를 날짜 기준으로 상세 기록
  - 검증 이력과 함께 릴리즈 추적이 가능하도록 변경 로그 구조 정리

#### fix(code-review-followup): 코드 리뷰 후 로깅/문서 품질 후속 정리

**커밋**: `6272ef1`

##### 변경됨 (Changed)

- `src/app.js`
  - `debug()`를 개발 모드 또는 `localStorage(shellhive:debug=1)`일 때만 출력하도록 제한
  - 운영 환경에서 불필요한 콘솔 로그 노이즈를 줄이고 로그 노출 범위를 축소
- `src/history-panel.js`
  - 패널 미생성 오류를 전용 리포트 함수로 처리하도록 변경
  - `console.error`는 개발 모드에서만 출력하고, 사용자에게는 토스트 기반 오류 안내를 사용
- `docs/change_log/change_log.md`
  - 줄바꿈(EOL) 일관성(LF) 정리로 불필요한 diff 발생 가능성 완화

##### 테스트 (Verification)

- `npm run -s lint`
- `npm test` (27 tests passed)
- `npm run -s build`
- `cargo fmt --all -- --check`
- `PATH=\"$HOME/.local/bin:$PATH\" cargo check --target x86_64-pc-windows-gnu`

#### chore(repo-hygiene): 문서/스크립트/코드 자산 포맷 정합화 1차

**커밋**: `49bb4f9`

##### 변경됨 (Changed)

- 문서군(README, AGENTS, CLAUDE, 구현/리서치/QA 문서, 변경로그) 텍스트 자산 정합화
- 운영 배치 스크립트(run/lint/test/setup/build) 포맷 통일
- `.gitignore`에 `.omx/` 추가로 로컬 오케스트레이션 상태 파일 추적 방지

#### chore(repo-hygiene): Tauri 백엔드/설정 자산 포맷 정합화 2차

**커밋**: `0d72d08`

##### 변경됨 (Changed)

- `src-tauri` Rust 모듈(`ai`, `claude`, `pty`, `sharing`, `main`) 및 빌드 자산 포맷 정리
- `tauri.conf.json`, capabilities, Android icon XML 등 설정/리소스 파일 정합화
- 기능 로직 변경 없이 코드 리뷰 가독성을 높이기 위한 표현 계층 정리

#### chore(repo-hygiene): 프론트엔드/UI/테스트 자산 포맷 정합화 3차

**커밋**: `b734a47`

##### 변경됨 (Changed)

- 프론트엔드 스크립트/스타일 자산(`src/style.css`, `src/i18n/index.js` 등) 포맷 통일
- E2E 회귀 테스트 파일 및 빌드 설정(`vite.config.js`, `package*.json`) 정합화
- 기능 변경 없이 이후 기능 PR에서 의미 있는 로직 변경이 분리되도록 정리

### 2026-02-12

#### fix(ops-scripts): 개발/릴리즈 실행 스크립트 충돌 처리 및 번들 식별자 경고 정비

**커밋**: `e4bb078`

##### 추가됨 (Added)

- `scripts/ensure-shellhive-dev-port.ps1`
  - `run-dev.bat` 실행 전 개발 포트(기본 1420) 점유 프로세스를 점검하는 가드 스크립트 추가
  - 동일 저장소에서 남아 있던 stale Vite 프로세스는 자동 종료
  - 타 프로젝트/타 프로세스 점유 시 PID 및 커맨드라인을 출력하고 안전하게 실패 처리

##### 변경됨 (Changed)

- `run-dev.bat`
  - 포트 가드 스크립트 호출 단계를 추가해 포트 충돌 시 원인을 즉시 안내하도록 개선
- `run-release.bat`
  - 리다이렉션 환경에서 불필요한 오류 문자열을 만들던 `timeout` 호출 제거
- `src-tauri/tauri.conf.json`
  - 번들 식별자를 `com.shellhive.desktop`로 변경하여 `.app` suffix 경고 제거

##### 테스트 (Verification)

- `npm run lint`
- `npm run test -- --run` (4 files, 27 tests)
- `npm run test:rust` (4 tests)
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `npm run build`
- `build-release.bat`
- `run-release.bat`
- `run-dev.bat` (포트 충돌/정상 기동 시나리오 점검)

### 2026-02-09

#### docs(research): tmux 소스 기반 split/pane UX 벤치마크 보고서 추가

**커밋**: `fb13f79`

##### 문서화됨 (Documentation)

- `docs/research/RESEARCH_TMUX_SOURCE_BENCHMARK_FOR_SHELLHIVE_2026-02-09.md` 추가
- tmux 핵심 설계(overlay, break/join/move, synchronize, policy options)를 Shellhive 적용 관점으로 정리

#### feat(split-overlay): display-panes 스타일 패널 라벨 오버레이 및 설정 옵션 도입

**커밋**: `83ed90c`

##### 추가됨 (Added)

- `index.html`
  - Split 툴바 `Labels` 버튼 추가 (`showPaneOverlayBtn`)
  - 설정 모달에 Split Overlay 섹션 추가
    - 표시 시간(`settingsPaneOverlayDuration`)
    - 라벨 색상(`settingsPaneOverlayColor`)
- `src/app.js`
  - 패널 라벨 오버레이 표시/숨김/자동종료 로직 추가
    - `showPaneOverlaySelection`, `hidePaneOverlaySelection`, `handlePaneOverlayInputKey`
  - `Ctrl+Shift+O` 단축키로 오버레이 토글
  - 컨텍스트 메뉴 `패널 라벨 표시` 추가
  - 분할 렌더 시 오버레이 라벨 DOM 렌더링 (`ensurePaneOverlayLabel`)
  - Command Palette 명령 추가 (`display-pane-overlay`)
- `src/style.css`
  - 오버레이 라벨 스타일 추가 (`.split-pane-overlay*`)
  - 설정 모달 color input 스타일 보강

##### 변경됨 (Changed)

- `src-tauri/src/settings.rs`
  - 설정 스키마 확장
    - `pane_overlay_duration_ms`
    - `pane_overlay_label_color`
  - 입력값 검증 추가(표시 시간 범위, `#RRGGBB` 색상 형식)
- `src/__tests__/setup.js`, `src/__tests__/phase5-regression.e2e.test.js`
  - 신규 설정 필드 mock 반영

##### 테스트 (Verification)

- `npm run lint`
- `npm run test -- --run` (4 files, 23 tests)
- `cargo check --manifest-path src-tauri/Cargo.toml`

#### feat(split-pane-workflow): break/join/move-pane 워크플로우 및 조작 경로 확장

**커밋**: `356a65e`

##### 추가됨 (Added)

- `index.html`
  - Split 툴바에 pane 전환/이동 워크플로우 컨트롤 추가
    - `Break` 버튼 (`breakPaneBtn`)
    - 소스 탭 선택 셀렉터 (`splitTransferSourceSelect`)
    - `Join` 버튼 (`joinPaneBtn`)
    - `Move` 버튼 (`movePaneBtn`)
- `src/app.js`
  - 활성 패널 분리 기능 추가 (`breakActivePaneToTab`)
  - 선택 소스 탭 결합/이동 기능 추가 (`joinSessionToActiveSplit`, `joinPaneFromSelection`, `movePaneFromSelection`)
  - 분할 컨텍스트 메뉴 확장
    - `활성 패널 분리 (Break)`
    - `현재 분할에 결합 (Join)`
    - `현재 분할로 이동 (Move)`
  - Command Palette 명령 확장
    - `break-pane`, `join-pane`, `move-pane`
  - 단축키 추가
    - `Ctrl+Shift+B` (Break)
    - `Ctrl+Shift+I` (Join)
    - `Ctrl+Shift+U` (Move)

##### 변경됨 (Changed)

- `src/app.js`
  - 툴바 상태 업데이트 로직에 소스 탭 옵션 동적 갱신 반영
  - 분할 레이아웃 스냅샷 동기화 유틸 추가 (`saveCurrentSplitLayoutForSessions`)
  - 이동 시 기존 저장 레이아웃에서 소스 세션 정리 로직 추가 (`removeSessionFromStoredSplitLayouts`)

##### 테스트 (Verification)

- `npm run lint`
- `npm run test -- --run` (4 files, 25 tests)
- `cargo check --manifest-path src-tauri/Cargo.toml`

#### feat(split-sync): 분할 동시 입력(synchronize-panes) 및 범위 옵션 추가

**커밋**: `7a98aad`

##### 추가됨 (Added)

- `index.html`
  - Split 툴바에 `Sync` 버튼 추가 (`syncPanesBtn`)
  - 설정 모달에 Split Sync Input 섹션 추가
    - 동시 입력 활성화 (`settingsSplitSyncInput`)
    - 대상 범위 선택 (`settingsSplitSyncScope`: 전체/동일 프로젝트)
- `src/app.js`
  - 동시 입력 핵심 로직 추가
    - `toggleSplitSyncInput`
    - `getSplitSyncTargetSessionIds`
    - `broadcastInputToSplitPanes`
  - 입력 파이프라인에서 분할 대상 브로드캐스트 수행
  - 단축키 `Ctrl+Shift+Y` 추가
  - Command Palette `toggle-sync-panes` 명령 추가
  - 컨텍스트 메뉴에 동시 입력 켜기/끄기 추가
  - 분할 헤더에 `SYNC / SYNC-P` 상태 배지 표시

##### 변경됨 (Changed)

- `src-tauri/src/settings.rs`
  - 설정 스키마 확장
    - `split_sync_input_enabled`
    - `split_sync_scope`
  - `split_sync_scope` 유효값 검증(`all`, `same-project`) 추가
- `src/style.css`
  - 분할 헤더 동시 입력 배지 스타일 추가 (`.split-pane-header__sync*`)
- `src/__tests__/setup.js`, `src/__tests__/phase5-regression.e2e.test.js`
  - 신규 설정 필드 mock 반영

##### 테스트 (Verification)

- `npm run lint`
- `npm run test -- --run` (4 files, 26 tests)
- `cargo check --manifest-path src-tauri/Cargo.toml`

#### feat(split-layout-policy): 정책형 분할 레이아웃 옵션(main 비율/타일 열 제한) 적용

**커밋**: `dc54d05`

##### 추가됨 (Added)

- `index.html`
  - 레이아웃 프리셋 셀렉터에 `Main + Sidebar` 옵션 추가
  - 설정 모달에 Split Layout Policy 섹션 추가
    - 메인 패널 비율(`settingsSplitMainPaneRatio`)
    - 타일 최대 열(`settingsSplitTiledMaxColumns`)
- `src/__tests__/split-layout.e2e.test.js`
  - 정책 옵션 저장 후 프리셋 결과를 검증하는 E2E 테스트 추가

##### 변경됨 (Changed)

- `src-tauri/src/settings.rs`
  - 설정 스키마 확장
    - `split_main_pane_ratio`
    - `split_tiled_max_columns`
  - 입력값 검증 추가(비율 `50..85`, 최대 열 `1..6`)
- `src/app.js`
  - 설정 정규화/저장/모달 바인딩에 신규 정책 필드 반영
  - 프리셋 적용 시 정책값 우선 적용
    - `main-sidebar` 첫 분할 비율 반영
    - `grid`/`three-columns` 계열 최대 열 제한 반영
  - 분할 생성 유틸 확장
    - `splitActivePane(direction, { ratio })`
    - `createLinearLayout(..., firstSplitRatio)`
    - `createGridLayout(..., totalCells)`
- `src/__tests__/setup.js`, `src/__tests__/phase5-regression.e2e.test.js`
  - 신규 설정 필드 mock 반영

##### 테스트 (Verification)

- `npm run lint`
- `npm run test -- --run` (4 files, 27 tests)
- `cargo check --manifest-path src-tauri/Cargo.toml`

### 2026-02-08

#### fix/build/release: 배포 안정화 및 split UX 개선

##### 수정됨 (Fixed)

- `c7907a8` release 빌드 실패 원인인 `index.html` 제어문자 제거
- `f98d52d` `run-release.bat` 경로/실행 안정화
- `886152c` 분할 헤더 오버랩 제거 및 split 툴바 리뉴얼

##### 변경됨 (Changed)

- `e9b35ad` 미니맵/레이아웃 갤러리/패널 헤더 강화

##### 문서화됨 (Documentation)

- `d38c758` run-release 분할 QA 체크리스트/로그 최신화

### 2026-02-07

#### split/탭 개선, AI GUI 제거, QA 보강

##### 추가됨 (Added)

- `ce14e6a` 프로젝트 하위 CMD 트리 뷰 도입
- `880289d` 탭을 분할 패널로 드롭 배치 기능
- `1af5c46` VSCode 스타일 합치기 중심 분할 UX 도입
- `d2fdb92` 기본 분할(Ctrl+\\) 도입

##### 변경됨 (Changed)

- `297d785` 분할 리사이즈 렌더 배칭 최적화
- `7693f5a` 분할 유지 동작/개발 스크립트/레이아웃 선택 UX 개선
- `086a633` `tab_layouts` 저장·복원 계약 복구

##### 수정됨 (Fixed)

- `f473fc6` AI GUI 제거 및 탭 최대 제한 해제
- `fadc8e3` Git 패널 정합성 복구 및 AI 비활성 릴리즈 경로 반영

##### 테스트/문서 (Test/Documentation)

- `13abbf7` split/탭/프로젝트 트리 회귀 테스트 확장
- `80cdbd0` AI 제외 기준 회귀 검증 및 문서 정합화
- `ac49f70` 머지 이슈 해결안/AI 제외 계획 상세화
- `b93a330` split/탭 연구 문서 스펙 동기화
- `8f10559` GUI split/tab 대대적 개선 연구 문서 작성

### 2026-02-06

#### merge 검토 및 릴리즈 split 복구

##### 수정됨 (Fixed)

- `6cdcccd` 릴리즈 분할 미표시 원인 해결 및 품질 게이트 복구
- `56ca2ba` `app.js` lint 정리 및 품질 규칙 복구

##### 문서화됨 (Documentation)

- `d707f1e` `547a7b2` 머지 구현 정합성 검토 보고서 작성

##### 기타 (Etc)

- `547a7b2` PR #2 머지

### 2026-02-04

#### GUI split 도입 및 안정화

##### 추가됨 (Added)

- `8ae2b28` GUI 기반 탭 분할 툴바 추가

##### 수정됨 (Fixed)

- `94be2a6` 분할 버튼 무응답 수정
- `36ab98d` 분할 레이아웃 CSS 높이/너비 문제 수정

### 2026-02-03

#### split-pane 대폭 개선 및 로드맵 구현

##### 추가됨 (Added)

- `8f01981` split-pane 기능 대폭 개선
- `ed0dddf` 기능 개선 로드맵 Phase 1~4 구현 완료

##### 수정됨 (Fixed)

- `b2886b4` split 세션 ID 매핑/레이아웃 복원 수정
- `fb8d82b` 보안/안정성 코드리뷰 이슈(CRITICAL/HIGH) 수정
- `b5de92a` 키보드 단축키 Caps Lock 독립성 수정

##### 문서화됨 (Documentation)

- `e8b505b` 탭 분할 화면 기능 연구 보고서
- `3f49650` Shellhive 기능 개선 로드맵 연구 보고서

### 2026-02-02

#### Phase 6~9 기능 확장 및 문서 정비

##### 추가됨 (Added)

- `4fed401` lint 설정(Phase 6.1)
- `e9d12e7` 테스트 프레임워크(Vitest, Phase 6.2)
- `ff18c27` 개발 의존성 정리
- `fae7f0b` Rust 백엔드 기능 확장
- `25976c5` 프론트엔드 기능 확장
- `077fe50` 다국어(i18n) 모듈 추가
- `079b30b` 개발/설치 배치 스크립트 정비
- `6d9cdeb` 프로젝트 삭제 확인 대화상자 추가

##### 수정됨 (Fixed)

- `46ecf90` 탭 그룹 레이아웃/클릭 이벤트 수정

##### 문서화됨 (Documentation)

- `42fc95f` 변경 로그/문서 체계 정리
- `6b80f1d` Phase 6~9 구현 문서 갱신

##### 기타 (Etc)

- `b10cee0` `.gitignore`에 `coverage` 추가
- `4dce9ab` PR #1 머지

### 2026-02-01

#### 탭 관리 강화 및 안정성 개선

##### 추가됨 (Added)

- `859cdaf` 탭 관리 기능 Phase 1~3 구현

##### 수정됨 (Fixed)

- `5099e35` 터미널 종료 버튼 동작 수정
- `79a7ac7` 코드리뷰 기반 주요 이슈 7건 수정

##### 문서화됨 (Documentation)

- `8718bb9` 코드 검토 보고서/검증 결과
- `f8c1373` 탭 관리 기능 강화 연구 문서
- `2a390d7` 업데이트 보고서 및 변경 로그 보강

### 2026-01-31

#### PTY 안정화 집중 수정

##### 수정됨 (Fixed)

- `885a90e` master PTY 핸들 유지로 입력 문제 해결
- `3652188` PTY Writer 관리 재설계
- `7b26f72` PTY 실시간 입출력 및 UI 이벤트 처리 개선
- `a9e5914` Tauri 권한/실행 환경 개선

### 2026-01-30

#### 초기 구축 (Phase 1~5)

##### 추가됨 (Added)

- `bbaea1f` Initial commit
- `f1699e9` 프로젝트 문서 구조 설정
- `abec1e3` Phase 1: Tauri v2 + xterm.js 통합
- `03cac16` Phase 2: Windows ConPTY PTY 연동
- `1e451d2` Phase 3: 프로젝트 관리 UI/기능
- `a00f037` Phase 4: 멀티 세션 탭 고급 기능
- `9e07b50` Phase 5: 스니펫/설정/로깅 기능

##### 문서화됨 (Documentation)

- `a540aa6` 개발 로드맵 체크리스트 완료 상태 업데이트

---

## [0.1.0] - 2026-02-01 (develop)

### 개요

Shellhive의 첫 개발 버전으로, Phase 1~5 핵심 기능이 반영되었습니다.

- 통합 터미널 세션 관리
- PTY 기반 실시간 입출력
- 프로젝트/탭/스니펫/설정 관리
- 로깅 및 기본 단축키 체계

---

## 변경 유형 가이드

- `Added`: 새로운 기능
- `Changed`: 기존 기능 변경
- `Fixed`: 버그 수정
- `Documentation`: 문서 변경
- `Security`: 보안 변경

---

*참고: 2026-02-09에 기존 `change_log.md`의 한글 깨짐(모지바케) 이력을 UTF-8 기준으로 복구/재구성했습니다.*
