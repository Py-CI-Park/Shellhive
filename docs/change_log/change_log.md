# Shellhive 변경 로그 (Change Log)

이 문서는 Shellhive 프로젝트의 주요 변경 사항을 기록합니다.

- 형식: [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)
- 버전 정책: [Semantic Versioning](https://semver.org/lang/ko/)
- 인코딩: UTF-8

---

## [Unreleased]

### 2026-02-09

#### docs(research): tmux 소스 기반 split/pane UX 벤치마크 보고서 추가

**커밋**: `fb13f79`

##### 문서화됨 (Documentation)

- `docs/research/RESEARCH_TMUX_SOURCE_BENCHMARK_FOR_SHELLHIVE_2026-02-09.md` 추가
- tmux 핵심 설계(overlay, break/join/move, synchronize, policy options)를 Shellhive 적용 관점으로 정리

#### feat(split-overlay): display-panes 스타일 패널 라벨 오버레이 및 설정 옵션 도입

**커밋**: `working-tree`

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

**커밋**: `working-tree`

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
