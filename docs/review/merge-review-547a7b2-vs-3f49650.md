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

## 4. 주요 이슈 (심각도 순)

### 4.1 높음: Git 패널 즉시 오동작

- 원인: 프론트의 `invoke` 명령명이 백엔드 Tauri 커맨드명과 다릅니다.
- 영향: Git 패널 핵심 기능(상태 조회, 스테이징)이 런타임에서 실패합니다.
- 근거
  - 프론트: `src/app.js:6298`, `src/app.js:6387`, `src/app.js:6457`
  - 백엔드 등록: `src-tauri/src/main.rs:91`
  - 실제 구현명: `src-tauri/src/git.rs:58`, `src-tauri/src/git.rs:203`, `src-tauri/src/git.rs:221`

### 4.2 높음: 설정 스키마 불일치로 일부 기능 설정 비영속

- 원인: 프론트는 `enable_notifications`, `enable_snippet_suggestions` 등을 저장하지만, 백엔드 `Settings` 구조체는 해당 필드가 없습니다.
- 영향: 설정이 저장되지 않거나 재시작 시 유실됩니다.
- 근거
  - 프론트 저장: `src/app.js:5704`, `src/app.js:5706`
  - 백엔드 스키마: `src-tauri/src/settings.rs:8`

### 4.3 중간: 문서상 "구현 완료" 항목 중 실제 미구현/부분구현 존재

- 대표 항목: 빌드/테스트 시스템 알림, 스니펫 자동 생성, GPU 가속, 공유 스니펫 라이브러리
- 영향: 로드맵 신뢰도 하락, 릴리즈 범위 판단 오류 가능

## 5. 사용자 요청 반영: AI 기능 제외 권고안

### 5.1 현재 릴리즈에서 제외 권고 기능

- Claude Code 통합 UI/단축키/백엔드 커맨드
- 자연어 명령어 변환 바/도움말/프리뷰 모달
- AI 에러 설명 패널
- AI 기반 스니펫 자동 생성(현재도 실질 미구현 상태)

### 5.2 AI 제외 시 유지 권고 코어

- PTY/멀티세션/탭 분할/프로젝트 관리
- 환경 변수(.shellhive.env) 기능
- 기본 스니펫 CRUD
- 검색/히스토리/세션 저장복원

### 5.3 AI 제외와 함께 후순위(나중 개발) 권고 기능

- 실시간 터미널 공유(서버/전송계층 필요)
- 공유 스니펫 라이브러리(동기화/권한 설계 필요)
- GPU 가속 렌더링(WebGL/WebGPU 성능 검증 필요)
- 세션 녹화/재생 고도화(현재 로컬 기능은 유지 가능)

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

