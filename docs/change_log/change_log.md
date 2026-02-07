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

### 2026-02-07

#### test(split-tab): 분할/탭/프로젝트 트리 회귀 테스트 확장

**커밋**: `working-tree`

##### 추가됨 (Added)

- `src/__tests__/split-layout.e2e.test.js`
  - 탭을 분할 패널에 드롭 배치하는 시나리오 검증 추가
  - `beforeunload` 시 `save_session_state` payload에 `tab_layouts`가 포함되는지 검증 추가
- `src/__tests__/phase5-regression.e2e.test.js`
  - 프로젝트 하위 CMD 트리 렌더링/활성 상태 갱신 검증 추가

##### 수정됨 (Fixed)

- `src/app.js`
  - 세션 상태 저장 시 현재 활성 분할 레이아웃(`splitRoot`)을 `tab_layouts`에 포함하도록 보강
  - 분할 상태를 저장 직전 스냅샷으로 반영해 재실행 복원 신뢰성 향상

##### 검증 (Verification)

- `npm run lint`
- `npm run test -- --run` (4 files, 15 tests)
- `cargo check`

#### perf(split): 분할 리사이즈 렌더 배칭 및 디버그 노이즈 정리

**커밋**: `working-tree`

##### 변경됨 (Changed)

- `src/app.js`
  - 분할 리사이즈 시 `mousemove`마다 즉시 전체 레이아웃 렌더링하던 경로를 `requestAnimationFrame` 배칭으로 변경
    - `scheduleSplitRender()` 추가
    - 상태에 `splitRenderRaf` 핸들 저장
    - `mouseup`에서 마지막 렌더를 보장하여 비율 반영 누락 방지
  - 분할 관련 과도한 `console.log` 출력 제거
    - `initSplitMode`, `splitHorizontal`, `splitActivePane`, `renderSplitLayout`, `setupSplitToolbar`
  - 디버그 출력은 공용 `debug()` 경로만 사용하도록 정리

##### 효과

- 분할 바 드래그 중 렌더 호출 폭주 완화
- 콘솔 노이즈 감소로 실제 경고/오류 식별성 개선

##### 검증 (Verification)

- `npm run lint`
- `npm run test -- --run`
- `cargo check`

#### feat(project-cmd-tree): 프로젝트 하위 CMD 트리 뷰 및 세션 제어 추가

**커밋**: `working-tree`

##### 추가됨 (Added)

- `src/app.js`
  - 프로젝트 목록 항목에 하위 CMD 트리 컨테이너 추가
  - 프로젝트 하위 세션 렌더러 `renderProjectCmdTrees()` 구현
    - 프로젝트별 활성 세션 목록 표시
    - 현재 활성 세션 강조
    - 트리 항목 클릭 시 세션 활성화
    - 트리 항목 내 닫기 버튼으로 세션 종료
  - 프로젝트 항목 클릭 핸들러 보강
    - 트리/필터/환경변수/삭제 버튼 클릭 시 신규 세션 생성 오동작 방지
  - 세션 라이프사이클 연동
    - `linkSessionToProject`, `unlinkSessionFromProject`, `activateSession`에서 트리 즉시 갱신
- `src/style.css`
  - 프로젝트 하위 CMD 트리 UI 스타일 추가
    - `.sidebar__cmd-tree*`
    - `.sidebar__cmd-item*`
    - `.sidebar__cmd-status*`
    - `.sidebar__cmd-close`

##### 검증 (Verification)

- `npm run lint`
- `npm run test -- --run`
- `cargo check`

#### feat(split-dnd): 탭을 분할 패널로 직접 배치하는 드롭 동작 구현

**커밋**: `working-tree`

##### 추가됨 (Added)

- `src/app.js`
  - 탭 드래그 시작 시 `sessionId`를 `dataTransfer`에 기록
  - 분할 패널(leaf)에서 탭 드롭을 처리하는 핸들러 추가
    - 드롭 위치 감지: `left`, `right`, `top`, `bottom`, `center`
    - 가장자리 드롭 시 대상 패널을 기준으로 분할 트리 재구성
    - 중앙 드롭 시 해당 세션 활성화 처리
  - 분할 패널 드롭 전용 유틸 함수 추가
    - `getPaneDropPosition`
    - `setPaneDropIndicator`
    - `clearPaneDropIndicators`
    - `moveSessionToSplitPane`
- `src/style.css`
  - 분할 패널 드롭 가이드 시각화 스타일 추가
    - `.terminal-wrapper--drop-target`
    - `.terminal-wrapper--drop-left/right/top/bottom/center`

##### 검증 (Verification)

- `npm run lint`
- `npm run test -- --run`
- `cargo check`

#### fix(session-state): 분할 레이아웃 저장 계약(tab_layouts) 복구

**커밋**: `working-tree`

##### 수정됨 (Fixed)

- `src-tauri/src/settings.rs`
  - `SessionState`에 `tab_layouts` 필드 추가 (`HashMap<String, TabLayoutState>`)
  - 분할 트리 직렬화 구조체 추가
    - `SplitNodeState` (`type`, `ratio`, `sessionId`, `children`)
    - `TabLayoutState` (`splitMode`, `splitRoot`)
  - `SessionState`에 `#[serde(default)]` 적용으로 구버전 상태 파일 로드 호환성 강화
- `src/app.js`
  - 세션 복원 시 `tab_groups`/`sessions`를 배열 여부 검증 후 처리
  - `tab_layouts` 복원 시 camelCase/snake_case 키를 모두 허용
    - `splitRoot` 또는 `split_root`
    - `splitMode` 또는 `split_mode`
  - 결과적으로 탭별 분할 레이아웃이 저장 후 재실행에서 유실되지 않도록 복원 경로 안정화

##### 검증 (Verification)

- `npm run lint`
- `npm run test -- --run`
- `cargo check`

#### docs(research): GUI 분할/탭 개선 연구 문서 스펙 동기화

**커밋**: `working-tree`

##### 문서화됨 (Documentation)

- `docs/research/RESEARCH_GUI_SPLIT_TAB_ENHANCEMENT_2026-02-07.md`
  - 제품 설명의 AI 중심 표현을 현재 운영 정책(비AI 코어 중심)과 일치하도록 정리
  - 사용자 시나리오 1을 AI 도구 비교에서 일반 CLI 병렬 작업 시나리오로 교체
  - 단축키 표를 현재 코드 동작과 정렬
    - 수직 분할: `Ctrl+Shift+\\` -> `Ctrl+Shift+E`
    - 패널 이동: `Alt+화살표` -> `Ctrl+Alt+화살표`
  - 결론 섹션의 가치 설명을 AI 특화 문구에서 일반 CLI 워크플로우 특화로 수정

#### fix(ui): AI/Claude GUI 제거 및 탭 최대 제한 해제

**커밋**: `working-tree`

##### 수정됨 (Fixed)

- `index.html`
  - 사이드바 Claude Code 섹션 제거(`.sidebar__claude`, `#claudeBtn`, `#claudeStatus`)
  - 하단 AI 입력바 제거(`#aiInputBar`, `#aiModeToggle`, `#aiInput`, `#aiSendBtn`, `#aiHelpBtn`)
  - AI 미리보기/도움말 모달 제거(`#aiPreviewModal`, `#aiHelpModal` 및 하위 버튼)
- `src/app.js`
  - 세션 최대치 상수(`MAX_SESSIONS`) 및 생성/분할 시 제한 검사 제거
  - `Ctrl+Shift+C` Claude 시작 단축키 제거
  - Claude 버튼 클릭 이벤트 바인딩 제거
  - 사용자 노출 문구 `AI 에러 설명` -> `에러 설명`으로 변경
- `src/__tests__/phase5-regression.e2e.test.js`
  - AI UI 회귀 검증 기준을 "비노출(display:none)"에서 "요소 제거(null)"로 갱신

##### 검증 (Verification)

- `npm run lint`
- `npm run test -- --run`
- `cargo check`

#### test(regression): 5단계 정합화 회귀 테스트 추가

**커밋**: `working-tree`

##### 추가됨 (Added)

- `src/__tests__/phase5-regression.e2e.test.js` 추가
  - AI UI 기본 비노출(Claude 섹션/AI 입력바) 검증
  - Git 패널의 새 커맨드 경로(`git_status`, `git_stage`) 검증
  - 블록 모드 설정 적용 시 wrapper/overlay 반영 검증
- `src/__tests__/setup.js`의 설정 mock을 현재 스키마에 맞게 확장

#### docs(alignment): 5단계 문서/QA 정합화 완료

**커밋**: `working-tree`

##### 문서화됨 (Documentation)

- `IMPLEMENTATION_COMPLETE.md`
  - 현행 릴리즈 기준으로 이력 문서(Archived) 상태로 정정
  - "현재 운영 기능"과 "과거 구현 기록"을 명확히 분리
- `docs/research/feature-improvement-roadmap-2024.md`
  - 2026-02-07 운영 주석 추가 (AI 기능 보류)
  - 우선순위 조정(비AI 코어 안정화 우선) 반영
  - 결론 섹션을 현행 운영 정책에 맞게 업데이트
- `docs/qa/run-release-split-manual-checklist.md`
  - TC-07 "AI 기능 비노출 확인" 추가
- `docs/qa/run-release-split-qa-log-2026-02-06.md`
  - TC-07 항목 및 리스크 범위(TC-02~TC-07) 업데이트
- `docs/review/merge-review-547a7b2-vs-3f49650.md`
  - 단계별 개발 진행 현황을 2차 기준으로 갱신
  - 5단계 완료 및 잔여(수동 QA) 항목 명시

---

#### fix(git-panel): 프론트-백엔드 Git 커맨드명 정합성 수정

**커밋**: `working-tree`

##### 수정됨 (Fixed)

- Git 패널 `invoke` 호출명을 백엔드 Tauri 커맨드에 맞게 정렬
  - `get_git_status` -> `git_status`
  - `git_stage_all` -> `git_stage` (파일 배열 전달)
  - `git_stage_file` -> `git_stage` (단건 배열)
  - `git_unstage_file` -> `git_unstage` (단건 배열)
- Stage All 동작에서 패널 체크박스 기준 파일 목록을 수집하여 전달하도록 개선

#### feat(settings): 설정 스키마 확장 및 블록 모드 저장/복원 연결

**커밋**: `working-tree`

##### 변경됨 (Changed)

- 백엔드 `Settings` 모델 확장 (`src-tauri/src/settings.rs`)
  - `enable_notifications`
  - `enable_snippet_suggestions`
  - `snippet_suggestion_threshold`
  - `enable_block_mode`
  - `enable_ai_features`
- 구버전 설정 파일 호환을 위해 `#[serde(default)]` 적용
- 임계값(`snippet_suggestion_threshold`) 유효 범위 검증(2~10) 추가
- 프론트 설정 로드/저장 경로를 단일 스키마 기준으로 정리
- 설정 모달의 블록 모드 체크박스를 실제 상태와 양방향 연결
- 세션별 블록 컨테이너 연결 및 블록 모드 on/off 즉시 반영 로직 추가

#### changed(ai-scope): 현재 릴리즈에서 AI 기능 경로 비활성화

**커밋**: `working-tree`

##### 변경됨 (Changed)

- 프론트에서 AI 기능 플래그를 기본 비활성 상태로 강제
- Claude 섹션/AI 입력바/AI 모달 비노출 처리
- AI 관련 이벤트 리스너/단축키는 활성 조건에서만 등록
- 백엔드 `invoke_handler`에서 `claude::*`, `ai::*` 커맨드 등록 제거 (`src-tauri/src/main.rs`)

#### docs(review): 단계별 개발 진행 현황(1차) 반영

**커밋**: `working-tree`

##### 문서화됨 (Documentation)

- `docs/review/merge-review-547a7b2-vs-3f49650.md`에 단계별 개발 진행 현황(완료/잔여 단계) 및 1차 재검증 결과 추가

---

#### docs(review): 주요 이슈 해결안 및 AI 제외 실행계획 상세화

**커밋**: `working-tree`

##### 문서화됨 (Documentation)

- `docs/review/merge-review-547a7b2-vs-3f49650.md` 고도화
  - 4장(주요 이슈)을 "문제 요약 → 해결 전략 → 상세 수정 항목 → 검증 계획 → 완료 기준" 구조로 재작성
  - Git 패널 오동작 해결을 위한 프론트/백엔드 커맨드 정합화 매핑표 추가
  - 설정 스키마 불일치 해결을 위한 `Settings` 확장 필드, 마이그레이션, 검증 시나리오 추가
  - 문서-코드 정합성 회복을 위한 상태 표준화(`완료/부분 구현/프로토타입/미구현`) 기준 정의
  - 5장에 AI 기능 제외를 실제 반영하기 위한 단계별 실행계획(Phase A~D), WBS, 리스크 대응, Release Gate를 상세 추가

---

### 2026-02-06

#### docs(review): 547a7b2 머지 결과 vs 3f49650 로드맵 구현 정합성 검토 보고서 추가

**커밋**: `working-tree`

##### 문서화됨 (Documentation)

- `docs/review/merge-review-547a7b2-vs-3f49650.md` 추가
  - 기준 문서(`3f49650`) 대비 머지 결과(`547a7b2`) 기능 매트릭스 작성
  - 항목별 판정: 완료/부분 구현/미구현/오동작
  - 핵심 리스크 정리
    - Git 패널 프론트/백엔드 커맨드명 불일치
    - 설정 스키마 불일치(프론트 저장 키와 백엔드 구조체 필드 차이)
  - 요청사항 반영: AI 기능 제외 전제의 우선순위 재편 및 후순위 기능 제안
  - 실행 검증 결과(`eslint`, `vitest`, `cargo check`) 포함

---

#### refactor(lint): app.js 정리 및 ESLint 규칙 재활성화

**커밋**: `working-tree`

##### 변경됨 (Changed)

- `src/app.js` 미사용 코드 정리
  - 중복 AI 변환 함수 블록 제거
  - 미사용 카테고리/사이드바 유틸 함수 제거
  - 미사용 변수/콜백 인자 정리
- `BlockManager` 생명주기 연결
  - 세션 생성 시 등록, 종료 시 해제
  - 입력 이벤트 처리 경로 연결
- UI 상수 분리
  - `src/ui-constants.js` 신설
  - `LAYOUT_PRESETS`, `TAB_COLORS`를 모듈로 이동
- ESLint 규칙 복구
  - `.eslintrc.json`에서 `no-unused-vars`, `indent`를 `error`로 재활성화
  - `_` 접두 인자/변수 무시 패턴 추가
- 테스트 코드 정리
  - `src/__tests__/setup.js` 들여쓰기 정리
  - `src/__tests__/session.test.js` 미사용 인자 제거

#### docs(qa): run-release 분할 수동 점검 문서/로그 추가

**커밋**: `working-tree`

##### 문서화됨 (Documentation)

- `docs/qa/run-release-split-manual-checklist.md` 추가
  - 가로/세로 분할 중심의 수동 시나리오(TC-01~TC-06) 정의
  - 사전 준비, 합격 기준, 결함 기록 템플릿 포함
- `docs/qa/run-release-split-qa-log-2026-02-06.md` 추가
  - `run-release.bat` 기동 점검 결과 기록
  - 수동 검증 진행 상태 및 후속 액션 기록

### 2026-02-06

#### fix(split): 릴리즈 모드 분할 레이아웃 미표시 원인 수정

**커밋**: `working-tree`

##### 수정됨 (Fixed)

- `splitActivePane()`에서 분할용 세션 생성 시 자동 탭 전환을 비활성화하여 `splitMode/splitRoot`가 초기화되는 문제 해결 (`src/app.js`)
- 분할 직후 활성 세션을 새 pane으로 지정하고 레이아웃 렌더를 보장 (`src/app.js`)
- Split Toolbar 프리셋 키 불일치 수정
  - `two-column` -> `two-columns`
  - `two-row` -> `two-rows`
  - `grid` -> `grid-2x2`
  - `three-column` -> `three-columns`

#### test(split): 분할 레이아웃 통합 테스트 추가

**커밋**: `working-tree`

##### 추가됨 (Added)

- jsdom 환경에서 `index.html + app.js`를 로드한 뒤 분할 버튼 클릭 시 split DOM이 생성되는 통합 테스트 추가 (`src/__tests__/split-layout.e2e.test.js`)
- Tauri API/xterm 모듈 mocking 확장 (`src/__tests__/setup.js`)

#### chore(quality): lint/clippy 차단 이슈 정리

**커밋**: `working-tree`

##### 변경됨 (Changed)

- `settingsBackup` 누락 선언, history panel `showToast` 스코프 오류 해결 (`src/app.js`, `src/history-panel.js`)
- `no-control-regex`/불필요 escape 관련 lint 에러 정리 (`src/app.js`)
- Rust clippy `-D warnings` 대응
  - `ShellType` 기본 구현 derive 전환 (`src-tauri/src/ai.rs`)
  - 로그 확장자 검사/정렬 클로저 개선 (`src-tauri/src/settings.rs`)
  - 미사용 `PtySession` 구조체 제거 (`src-tauri/src/pty.rs`)
- ESLint 들여쓰기 규칙 충돌 완화를 위해 `indent` 룰 비활성화 (`.eslintrc.json`)

---

### 2026-02-03

#### feat(ai): AI 자연어 명령어 변환 기능 완료 (Phase 2.1)

##### 추가됨 (Added)

- **AI 상태 관리** (`src/app.js`)
  - `state.aiModeEnabled` - AI 모드 활성화 상태
  - `state.aiPreviewVisible` - AI 미리보기 팝업 표시 상태
  - `state.aiOriginalInput` - AI 변환 전 원본 입력
  - `state.aiTranslatedCommand` - AI 변환된 명령어

- **AI 모드 함수** (`src/app.js`)
  - `toggleAiMode()` - AI 모드 켜기/끄기
  - `translateNaturalLanguage(input)` - 자연어를 쉘 명령어로 변환
  - `showAiPreview(original, result)` - 변환 미리보기 표시
  - `hideAiPreview()` - 미리보기 숨기기
  - `acceptAiTranslation()` - 변환된 명령어 실행
  - `rejectAiTranslation()` - 변환 취소

- **AI 국제화 지원** (`src/i18n/index.js`)
  - `ai.modeEnable` / `ai.modeDisable` - AI 모드 토글 툴팁
  - `ai.modeEnabled` / `ai.modeDisabled` - AI 모드 상태 메시지
  - `ai.commandAccepted` / `ai.commandFailed` - 명령어 실행 결과
  - 한글/영어 완전 번역 지원

- **Rust 백엔드 통합** (`src-tauri/src/ai.rs`)
  - 기존 `translate_natural_language` 명령어 활용
  - 30+ 패턴 규칙 지원 (한글/영어)
  - PowerShell, CMD, Bash, Zsh 쉘 타입별 변환
  - 신뢰도(confidence) 및 대체 제안(alternatives) 제공

- **지원 패턴 예시**
  - 파일 찾기: "js 파일 찾아줘" → `Get-ChildItem -Recurse -Filter "*.js"`
  - 폴더 생성: "test 폴더 만들어줘" → `New-Item -ItemType Directory -Name "test"`
  - Git 명령: "git 상태 보여줘" → `git status`
  - 큰 파일 검색: "큰 파일 10개 찾아줘" → 정렬된 대용량 파일 목록
  - 포트 확인: "포트 8080 확인" → `Get-NetTCPConnection -LocalPort 8080`

##### 개선됨 (Changed)

- **DOM 요소 초기화** (`src/app.js`)
  - AI 관련 DOM 요소 변수 추가
  - `aiModeToggleBtn`, `aiPreviewPopup`, `aiPreviewOriginal`, `aiPreviewTranslated`
  - `aiPreviewAccept`, `aiPreviewReject`

##### 문서화 (Documentation)

- **구현 문서 추가** (`docs/phase_2_1_ai_implementation.md`)
  - 전체 구현 내용 상세 정리
  - 지원 패턴 예시
  - 빌드 검증 결과
  - 사용 방법 가이드

##### 검증됨 (Verified)

- ✅ Frontend 빌드 성공 (`npm run build`)
- ✅ Rust 빌드 성공 (`cargo build --release`)
- ✅ 번들 크기: 417.07 KB (gzip: 108.95 KB)
- ✅ Ctrl+Space 키보드 단축키 동작
- ✅ 한글/영어 자연어 처리
- ✅ 쉘 타입별 명령어 변환

---

### 2026-02-03

#### feat(search): 터미널 고급 검색 기능 구현

##### 추가됨 (Added)

- **검색 옵션 버튼** (`src/app.js`)
  - 대소문자 구분 (Case Sensitive) - Alt+C 단축키
  - 전체 단어 일치 (Whole Word) - Alt+W 단축키
  - 정규식 사용 (Regex) - Alt+R 단축키
  - 전체 세션 검색 (All Sessions) - Alt+A 단축키
  - 활성화 상태 시각적 표시

- **전체 세션 검색 기능** (`src/app.js`)
  - 모든 열린 터미널 세션에서 동시 검색
  - 세션별 그룹화된 결과 표시
  - 줄 번호와 미리보기 텍스트 제공
  - 결과 클릭 시 해당 세션으로 이동 및 하이라이트
  - 세션당 최대 10개 결과, 초과 시 "more" 표시

- **정규식 검색 지원** (`src/app.js`)
  - xterm SearchAddon의 regex 옵션 활용
  - 정규식 오류 시 Toast 알림 표시
  - 대소문자 구분 옵션과 연동

- **F3/Shift+F3 단축키** (`src/app.js`)
  - F3: 다음 검색 결과로 이동
  - Shift+F3: 이전 검색 결과로 이동
  - 기존 Enter/Shift+Enter와 병행 지원

- **검색 결과 패널 UI** (`src/app.js`, `src/style.css`)
  - 우측 상단 floating 패널
  - 세션별 그룹화 표시
  - 스크롤 가능한 결과 목록 (최대 500px 높이)
  - 결과 개수 표시

##### 변경됨 (Changed)

- **검색바 UI 확장** (`src/app.js`, `src/style.css`)
  - 옵션 버튼 그룹 추가 (4개 토글 버튼)
  - 버튼 활성화 상태 스타일 추가
  - 검색 결과 카운터 형식 개선 (예: "3/15")

- **검색 옵션 저장** (`src/app.js`)
  - `state.searchOptions` 객체로 옵션 상태 관리
  - 옵션 변경 시 실시간 재검색

##### 기술 구현

- **검색 옵션 처리** (`src/app.js`)
  - `performTerminalSearch()`: 단일 세션 검색 시 옵션 적용
  - `performAllSessionsSearch()`: 전체 세션 검색 구현
  - `escapeRegex()`: 정규식 특수문자 이스케이프
  - `showAllSessionsResults()`: 결과 패널 렌더링
  - `hideAllSessionsResults()`: 결과 패널 닫기

- **CSS 스타일** (`src/style.css`)
  - `.terminal-search__options`: 옵션 버튼 컨테이너
  - `.terminal-search__option`: 개별 옵션 버튼
  - `.terminal-search__option--active`: 활성화 상태 스타일
  - `.search-results-panel`: 결과 패널 레이아웃
  - `.search-results-panel__group`: 세션별 그룹
  - `.search-results-panel__item`: 개별 검색 결과

##### 사용자 경험

- **직관적인 옵션 토글**: 클릭으로 옵션 on/off
- **키보드 단축키**: Alt+C/W/R/A로 빠른 옵션 전환
- **실시간 결과 업데이트**: 옵션 변경 시 즉시 재검색
- **시각적 피드백**: 활성화된 옵션은 accent 색상으로 표시
- **정규식 오류 처리**: 잘못된 정규식 입력 시 Toast 알림

#### feat(snippets): 스니펫 자동 생성 기능 구현

##### 추가됨 (Added)

- **명령어 히스토리 추적 시스템** (`src/app.js`)
  - `commandHistory` 객체로 프로젝트별 명령어 사용 빈도 추적
  - localStorage 기반 영구 저장
  - 최대 1,000개 명령어 추적
  - 짧은 명령어(5자 미만) 자동 필터링
  - 복잡한 명령어(파이프, 옵션 포함) 우선 제안

- **자동 스니펫 제안 UI** (`src/app.js`)
  - 3회 이상 사용된 명령어 자동 제안
  - 우측 하단 floating 카드 형태
  - "스니펫으로 저장" / "무시" 버튼 제공
  - 10초 후 자동 사라짐
  - 슬라이드 애니메이션 적용

- **터미널 입력 통합** (`src/app.js`)
  - Enter 키 감지로 명령어 제출 시점 추적
  - Ctrl+C, Backspace 처리
  - 프로젝트별 명령어 분리 추적

- **설정 옵션 추가** (`index.html`, `src/app.js`)
  - "Enable snippet suggestions" 체크박스
  - 최소 사용 횟수 슬라이더 (2-10회)
  - 실시간 threshold 업데이트

- **CSS 스타일링** (`src/style.css`)
  - `.snippet-suggestion` 컴포넌트 스타일
  - 애니메이션 (slideInRight, fade out)
  - 테마별 색상 대응
  - 반응형 레이아웃

##### 변경됨 (Changed)

- **설정 객체 확장** (`src/app.js`)
  - `enableSnippetSuggestions` 필드 추가 (기본값: true)
  - `snippetSuggestionThreshold` 필드 추가 (기본값: 3)
  - snake_case ↔ camelCase 정규화 로직 추가

- **초기화 과정 업데이트** (`src/app.js`)
  - `commandHistory.load()` 호출 추가
  - 앱 시작 시 저장된 명령어 히스토리 복원

##### 문서 (Documentation)

- **기능 문서 추가** (`docs/features/snippet-auto-generation.md`)
  - 구현 세부사항
  - 사용자 플로우
  - 데이터 구조
  - 향후 개선 방향

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
