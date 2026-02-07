# 547a7b2 Merge 구현 검토 보고서

## 1. 검토 개요

- 검토 대상 머지: `547a7b2dce551de48ff842223e4162e45386c25b`
- 기준 문서 커밋: `3f4965048ca948c052059325bec1971ea36f84fc` (`docs/research/feature-improvement-roadmap-2024.md`)
- 검토 일시: 2026-02-06
- 검토 기준
  - 기준 문서의 로드맵(Phase 1~4) 대비 실제 코드 구현 여부
  - 사용자 요청사항: AI 기능은 현재 릴리즈 범위에서 제외
  - 동작 검증: `npm run lint`, `npm run test -- --run`, `cargo check`

## 2. 결론 요약

- 결론 1: `ed0dddf`에서 주장한 "Phase 1-4 전체 구현 완료"는 과장된 표현입니다.
- 결론 2: 기능 추가량은 크지만, 최소 1개 오동작(깃 패널), 다수 부분 구현/미구현이 존재합니다.
- 결론 3: 현재 방향(비AI 중심) 기준으로는 AI/협업 고급 기능을 범위에서 제외하고 코어 안정화가 우선입니다.

## 3. 로드맵 항목별 구현 대조

| 구분 | 항목 | 판정 | 근거 |
|---|---|---|---|
| 3.1.1 | Block-Based 출력 | 부분 구현 | 블록 엔진은 존재 (`src/app.js:930`), 활성 조건은 `state.settings.enableBlockMode`만 확인 (`src/app.js:2226`)하지만 설정 UI 값 연결/저장이 없음 (`index.html:347`, `src/app.js:5699`) |
| 3.1.2 | GPU 가속 렌더링 | 미구현 | WebGL/WebGPU/WebglAddon 코드 확인 불가(코드 검색 결과 없음), xterm 기본 구성만 사용 (`src/app.js:1`) |
| 3.1.3 | 실시간 설정 변경 | 완료 | 설정 변경 즉시 프리뷰 적용 (`src/app.js:5670`, `src/app.js:5675`, `src/app.js:5681`) |
| 3.1.4 | 고급 검색 | 완료 | 정규식/대소문자/전체 세션 검색 UI 및 로직 존재 (`src/app.js:3115`, `src/app.js:3143`, `src/app.js:3479`) |
| 3.2.1 | Git 시각화 통합 | 오동작 | 프론트 호출명(`get_git_status`, `git_stage_all`, `git_stage_file`)과 백엔드 등록명(`git_status`, `git_stage`, `git_unstage`) 불일치 (`src/app.js:6298`, `src/app.js:6387`, `src-tauri/src/main.rs:91`, `src-tauri/src/git.rs:58`) |
| 3.2.2 | 커맨드 팔레트 | 완료 | 단축키/명령 실행 UI 구현 (`src/app.js:5068`, `src/app.js:4823`) |
| 3.2.3 | 자동완성/제안 | 완료 | 자동완성 팝업 및 선택/적용 로직 구현 (`src/app.js:3345`, `src/app.js:3414`) |
| 3.2.4 | 프로젝트별 환경 변수 | 완료 | `.shellhive.env` 로드/저장 및 PTY 주입 구현 (`src-tauri/src/project.rs:303`, `src-tauri/src/project.rs:347`, `src-tauri/src/pty.rs:74`) |
| 3.2.5 | 빌드/테스트 완료 알림 | 미구현 | 설정 항목/저장 키는 존재 (`index.html:318`, `src/app.js:5704`)하지만 실제 시스템 알림 API 사용 코드 없음 |
| 3.3.1 | 스크린 리더 지원 | 부분 구현 | ARIA 라벨 일부 추가 (`src/app.js:5578`, `index.html:96`)만 확인됨. 스크린리더 동작 보강(라이브 리전, 키보드 포커스 흐름 등) 부재 |
| 3.3.2 | 명령어 히스토리 검색 UI | 완료 | 별도 패널/검색/필터 구현 (`index.html:206`, `src/app.js:6470`) |
| 3.3.3 | 드래그 앤 드롭 파일 경로 | 완료 | 드롭 이벤트 처리 및 경로 입력 구현 (`src/app.js:5434`, `src/app.js:5449`, `src/app.js:5479`) |
| 3.4.1 | Claude Code 통합 | 완료 | 설치 확인/시작 명령 생성/단축키 연결 (`src-tauri/src/claude.rs:18`, `src-tauri/src/claude.rs:99`, `src/app.js:5172`) |
| 3.4.2 | 자연어 명령어 변환 | 완료(규칙 기반) | 자연어 변환 커맨드 구현 (`src-tauri/src/ai.rs:35`, `src/app.js:5795`) |
| 3.4.3 | AI 에러 설명 | 부분 구현 | 정적 패턴 DB 기반 설명 패널 구현 (`src/app.js:45`, `src/app.js:135`), 외부 AI 추론 연동 아님 |
| 3.4.4 | 스니펫 자동 생성 | 미구현 | 스타일/설정 UI 흔적은 있으나 실제 제안 카드 생성/저장 흐름 코드 부재 (`src/style.css:1834`, `src/app.js:1319`) |
| 3.5.1 | 실시간 터미널 공유 | 부분 구현 | 공유코드 발급 상태 관리만 구현 (`src-tauri/src/sharing.rs:49`), 실시간 스트림 전송/수신 채널 구현 없음 |
| 3.5.2 | 세션 녹화/재생 | 완료 | 녹화/재생/내보내기 구현 (`src/app.js:334`, `src/app.js:3640`, `src/app.js:3863`) |
| 3.5.3 | 공유 스니펫 라이브러리 | 미구현 | 스니펫은 로컬 JSON CRUD만 구현 (`src-tauri/src/snippet.rs:14`, `src-tauri/src/snippet.rs:60`) |

## 4. 주요 이슈 해결안 (심각도 순)

### 4.1 높음: Git 패널 즉시 오동작 해결안

#### 문제 요약

- 원인: 프론트의 `invoke` 명령명과 백엔드 Tauri 커맨드명이 불일치합니다.
- 영향: Git 상태 조회/스테이징/언스테이징 동작 실패.
- 근거
  - 프론트: `src/app.js:6298`, `src/app.js:6387`, `src/app.js:6457`
  - 백엔드 등록: `src-tauri/src/main.rs:91`
  - 실제 구현: `src-tauri/src/git.rs:58`, `src-tauri/src/git.rs:203`, `src-tauri/src/git.rs:221`

#### 해결 전략

- 전략 A(권장): 프론트 호출명을 백엔드 커맨드명에 맞춰 정합성 확보
- 전략 B(비권장): 백엔드에 프론트 호출명 alias 커맨드 추가
- 채택: 전략 A (중복 API 증가 방지, 유지보수 단순화)

#### 상세 수정 항목

| 위치 | 현재 | 수정 |
|---|---|---|
| `src/app.js` | `invoke('get_git_status', { path })` | `invoke('git_status', { path })` |
| `src/app.js` | `invoke('git_stage_all', { path })` | `invoke('git_stage', { path, files })` (전체 파일 배열 전달) |
| `src/app.js` | `invoke('git_stage_file', { path, file })` | `invoke('git_stage', { path, files: [file] })` |
| `src/app.js` | `invoke('git_unstage_file', { path, file })` | `invoke('git_unstage', { path, files: [file] })` |

#### 구현 주의사항

- `stage all`은 UI에 표시된 파일 목록에서 경로를 수집해 `files: string[]`로 전달.
- `git_status`의 `file.staged`와 체크박스 상태를 동기화하여 스테이징/언스테이징 토글 오류 방지.
- Git 저장소가 아닐 때 버튼 비활성화 유지(`is_repo=false` 처리).

#### 검증 계획

1. 수동 검증
   - `Ctrl+G`로 패널 열기
   - 상태 조회 성공 여부
   - 파일 단건 stage/unstage
   - stage all + commit + refresh
2. 자동 검증
   - 프론트 통합 테스트: invoke 호출명이 실제 커맨드명과 일치하는지 스파이 검증
   - Rust 단위 테스트: `git_stage`, `git_unstage` 빈 배열/복수 파일 케이스

#### 완료 기준(DoD)

- Git 패널 모든 버튼이 런타임 에러 없이 동작
- stage/unstage 후 즉시 상태 반영
- `lint/test/cargo check` 통과

---

### 4.2 높음: 설정 스키마 불일치 해결안

#### 문제 요약

- 프론트 저장 키와 백엔드 `Settings` 구조체 필드가 불일치하여 일부 설정이 영속 저장되지 않습니다.
- 근거
  - 프론트 저장: `src/app.js:5704`, `src/app.js:5706`, `index.html:347`
  - 백엔드 스키마: `src-tauri/src/settings.rs:8`

#### 해결 전략

- 단일 스키마 원칙 채택: 백엔드 `Settings`를 정식 소스 오브 트루스로 확장하고 프론트는 snake_case만 송수신.

#### 상세 수정 항목

1. 백엔드(`src-tauri/src/settings.rs`)
   - `Settings` 구조체에 다음 필드 추가
     - `enable_notifications: bool`
     - `enable_snippet_suggestions: bool`
     - `snippet_suggestion_threshold: u8`
     - `enable_block_mode: bool`
   - `Default` 구현에 기본값 반영
     - 알림: `true`
     - 스니펫 제안: `true`
     - 임계값: `3`
     - 블록 모드: `false`
   - `save_settings` 검증 로직 추가
     - `snippet_suggestion_threshold` 범위 검증(`2..=10`)
2. 프론트(`src/app.js`)
   - `loadSettings()/saveSettings()`에서 camelCase fallback 제거(단일 키 사용)
   - `settingsBlockMode` DOM을 실제 `state.settings.enable_block_mode`와 양방향 연결
   - `state.settings.enableBlockMode` 중복 필드 제거 또는 백엔드 키와 일치화
3. UI(`index.html`)
   - 기존 설정 항목은 유지하되, 저장/로드 시 실제로 반영되도록 이벤트 연결 보강

#### 데이터 마이그레이션 방안

- 기존 `settings.json`에 신규 필드가 없으면 `serde(default)`로 기본값 자동 주입.
- 파일 포맷 파손 방지를 위해 읽기 실패 시 백업(`settings.json.bak`) 후 기본값으로 재생성 고려.

#### 검증 계획

1. 설정 저장 후 앱 재시작 시 값 유지 확인
2. 블록 모드 on/off에 따라 출력 모드 즉시 변경 확인
3. 스니펫 임계값 변경 시 `commandHistory.minUsageCount` 동기화 확인

#### 완료 기준(DoD)

- 설정 항목이 저장/재시작 후 100% 재현
- 스키마 불일치 경고/오동작 제거

---

### 4.3 중간: 문서-코드 정합성 미스매치 해결안

#### 문제 요약

- "구현 완료"로 표기된 항목 중 실제는 미구현/부분구현이 존재합니다.
- 대상: 빌드/테스트 알림, 스니펫 자동 생성, GPU 가속, 공유 스니펫 라이브러리

#### 해결 전략

- 문서 상태 표기를 4단계로 표준화
  - `완료`
  - `부분 구현`
  - `프로토타입`
  - `미구현`
- 각 항목에 코드 근거 라인 + 테스트 근거를 의무 첨부

#### 상세 수정 항목

1. `IMPLEMENTATION_COMPLETE.md`
   - "전체 구현 완료" 표현 삭제
   - 항목별 실제 상태 재분류
2. `docs/research/feature-improvement-roadmap-2024.md`
   - 연구 문서 성격(제안/계획)과 구현 완료 문구를 명확히 분리
3. `docs/change_log/change_log.md`
   - 과장 표현이 있는 항목에 후속 정정 커밋 연결

#### 완료 기준(DoD)

- 핵심 문서 3종(`research`, `implementation`, `change_log`) 상태 표기 일관
- 릴리즈 판단 시 문서만 읽어도 현재 구현상태가 오해 없이 전달

## 5. AI 기능 제외 반영을 위한 상세 실행 계획

### 5.1 적용 원칙

- 원칙 1: 코드 삭제보다 "기능 플래그 기반 비활성화" 우선(향후 재도입 대비)
- 원칙 2: 사용자 노출(UI/단축키/메뉴)부터 먼저 제거
- 원칙 3: 런타임 호출 경로 차단 후, 최종적으로 백엔드 커맨드 등록 축소

### 5.2 범위 정의 (이번 스프린트)

#### 제외 범위(즉시)

- Claude Code 사이드바 섹션/버튼/단축키
- AI 입력 바/AI 도움말/AI 미리보기 모달
- AI 자연어 변환 실행 경로(`translate_natural_language`, `get_ai_patterns`)
- AI 에러 설명 패널

#### 유지 범위(즉시)

- PTY, 프로젝트, 탭/분할, 검색, 히스토리, 기본 스니펫 CRUD, 환경변수

#### 보류 범위(후순위)

- 협업 공유, GPU 가속, 공유 스니펫 라이브러리

### 5.3 단계별 실행 계획

#### Phase A - 기능 플래그 도입 (1일)

1. 백엔드 설정에 플래그 추가
   - `enable_ai_features: bool` (기본값 `false`)
2. 프론트 초기화 시 플래그 주입
   - `state.flags.enable_ai_features` 설정
3. 초기 가드
   - AI 관련 초기화 함수 진입 차단

수정 대상 파일
- `src-tauri/src/settings.rs`
- `src/app.js`

완료 기준
- AI 기능 플래그가 `false`일 때 AI 관련 이벤트 리스너가 등록되지 않음

#### Phase B - UI/단축키/명령 경로 비노출 (1일)

1. UI 비노출
   - `index.html`의 Claude 섹션, AI 입력 바, AI 모달 제거 또는 조건부 렌더
2. 단축키 제거
   - `Ctrl+Shift+C`, `Ctrl+Space` 등 AI 관련 키 매핑 제거
3. 커맨드 팔레트 정리
   - AI 메뉴 항목 제거

수정 대상 파일
- `index.html`
- `src/app.js`
- `src/style.css` (미사용 AI 스타일 정리)

완료 기준
- 화면/키보드/명령팔레트 어디에서도 AI 엔트리 노출 없음

#### Phase C - 백엔드 커맨드 등록 축소 (1일)

1. `main.rs` invoke handler에서 AI/Claude 커맨드 등록 제거
   - `claude::*`, `ai::*`
2. 미사용 모듈 경고/참조 정리

수정 대상 파일
- `src-tauri/src/main.rs`
- 필요 시 `src-tauri/src/claude.rs`, `src-tauri/src/ai.rs`(보존하되 미등록)

완료 기준
- 프론트에서 AI 커맨드 호출 시도가 없음
- 백엔드가 AI 커맨드 미등록 상태에서도 정상 구동

#### Phase D - 문서/테스트/QA 정합화 (1일)

1. 문서 정합화
   - 로드맵에 AI 기능 "보류" 명시
   - 구현 문서에서 AI 완료 표현 제거
2. 테스트 정합화
   - AI UI 의존 테스트 제거/수정
   - 핵심 회귀 테스트(PTY/탭/분할/프로젝트/Git) 보강
3. 릴리즈 QA 체크리스트 추가
   - "AI 노출 없음" 검증 항목 포함

수정 대상 파일
- `docs/research/feature-improvement-roadmap-2024.md`
- `IMPLEMENTATION_COMPLETE.md`
- `docs/change_log/change_log.md`
- `src/__tests__/*`
- `docs/qa/*`

완료 기준
- 문서, 코드, 테스트의 AI 범위 표현이 일치

### 5.4 작업 분해(WBS)

| ID | 작업 | 난이도 | 선행 작업 | 산출물 |
|---|---|---|---|---|
| W1 | settings 스키마 확장 + 플래그 추가 | 중 | 없음 | 빌드 통과 설정 모델 |
| W2 | AI UI 숨김/삭제 | 중 | W1 | AI 비노출 UI |
| W3 | AI 단축키/명령 팔레트 제거 | 중 | W2 | 입력 경로 차단 |
| W4 | 백엔드 AI invoke 등록 제거 | 하 | W3 | 런타임 경로 차단 |
| W5 | 문서 정합화 | 하 | W4 | 보고/가이드 문서 |
| W6 | 테스트/QA 반영 | 중 | W4 | 회귀 안전망 |

### 5.5 위험 요소 및 대응

1. 위험: AI 제거 중 공통 코드 훼손
   - 대응: 기능 플래그 + 점진 제거, 단계별 커밋 분리
2. 위험: 스타일 삭제 후 레이아웃 깨짐
   - 대응: `index.html` 구조 변경 후 스냅샷/수동 QA 병행
3. 위험: 문서와 실제 구현 불일치 재발
   - 대응: 변경로그 템플릿에 "코드 근거 라인" 필수화

### 5.6 최종 완료 기준 (Release Gate)

- 기능
  - AI 기능 UI/단축키/커맨드 경로 완전 비활성화
  - 코어 기능(PTY/탭/분할/프로젝트/스니펫/검색) 정상 동작
- 품질
  - `npm run lint`, `npm run test`, `cargo check` 통과
  - 수동 QA 체크리스트 100% 통과
- 문서
  - 로드맵/구현문서/변경로그 상태 일치

## 6. 권장 실행 순서

1. Git 패널 호출명 정합성 수정 또는 임시 비활성화
2. 설정 스키마 정합성 수정(프론트/백엔드 필드 통일)
3. AI UI/명령 경로를 빌드 옵션 또는 기능 플래그로 분리
4. 문서/변경로그에서 "완료" 표현을 "완료/부분/계획"으로 재정렬

## 7. 검증 결과

- `npm run lint`: 통과
- `npm run test -- --run`: 통과 (3 files, 9 tests)
- `cargo check`: 통과
- 주의: 위 검증은 정적/단위 중심이며, Git 패널 명령명 불일치 같은 런타임 통합 문제는 테스트에서 포착되지 않았습니다.

## 8. 단계별 개발 진행 현황 (2026-02-07 1차)

### 8.1 완료된 단계

1. 1단계 완료: Git 패널 커맨드 정합성 수정
   - `get_git_status` -> `git_status`
   - `git_stage_all` -> `git_stage(files[])`
   - `git_stage_file`/`git_unstage_file` -> `git_stage`/`git_unstage` 단건 배열 전달
   - 반영 파일: `src/app.js`
2. 2단계 완료: 설정 스키마 통합
   - `Settings` 확장: `enable_notifications`, `enable_snippet_suggestions`, `snippet_suggestion_threshold`, `enable_block_mode`, `enable_ai_features`
   - 구버전 설정 파일 호환: `#[serde(default)]` 적용
   - 블록 모드 체크박스 저장/복원 연결
   - 반영 파일: `src-tauri/src/settings.rs`, `src/app.js`
3. 3단계 완료: AI 기능 비활성화 기본 적용
   - 프론트에서 AI 기능 기본 `false` 고정
   - Claude 버튼/AI 입력바/AI 모달 비노출 처리
   - AI 관련 리스너/단축키는 `aiEnabled` 조건일 때만 등록
   - 반영 파일: `src/app.js`
4. 4단계 완료: 백엔드 AI invoke 경로 차단
   - `main.rs`에서 `claude::*`, `ai::*` 커맨드 등록 제거
   - 반영 파일: `src-tauri/src/main.rs`

### 8.2 남은 단계

1. 5단계 일부 남음: 문서/테스트/QA 정합화
   - AI 제외 기준으로 `IMPLEMENTATION_COMPLETE.md`, 로드맵 문서 상태 표기 정리
   - Git 패널 및 블록 모드 동작에 대한 회귀 테스트 추가
   - 수동 QA 체크리스트에 "AI 비노출" 항목 추가

### 8.3 1차 구현 후 재검증 결과

- `npm run lint`: 통과
- `npm run test -- --run`: 통과 (3 files, 9 tests)
- `cargo check`: 통과
