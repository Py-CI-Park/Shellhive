# Phase 7.1: 세션 저장/복원 구현 완료

## 개요

세션 상태 지속성 기능을 구현하여 애플리케이션 종료 시 세션을 자동으로 저장하고, 시작 시 복원하는 기능을 추가했습니다.

## 구현 내용

### 1. Backend (Rust)

#### src-tauri/src/settings.rs

새로운 구조체 추가:

- **SessionInfo**: 개별 세션 정보 (id, name, working_dir, project_id, pinned, color)
- **TabGroupInfo**: 탭 그룹 정보 (id, name, color, collapsed, tab_ids, project_id)
- **WindowState**: 창 상태 (width, height, x, y, maximized)
- **SessionState**: 전체 세션 상태 (sessions, active_session_id, tab_groups, window_state)

새로운 커맨드 추가:

```rust
#[tauri::command]
pub async fn save_session_state(state: SessionState) -> Result<(), String>

#[tauri::command]
pub async fn load_session_state() -> Result<SessionState, String>
```

저장 위치: `%APPDATA%\shellhive\session-state.json`

#### src-tauri/src/main.rs

- `save_session_state`, `load_session_state` 커맨드 등록

### 2. Frontend (JavaScript)

#### src/app.js

새로운 함수 추가:

1. **saveSessionState()**
   - 모든 활성 세션의 상태를 수집
   - 탭 그룹 정보 수집
   - 창 크기 정보 수집
   - Rust 백엔드로 전송하여 저장

2. **loadSessionState()**
   - Rust 백엔드에서 저장된 세션 상태 로드
   - 에러 처리 포함

3. **restoreSessionState()**
   - 저장된 세션 상태를 기반으로 세션 복원
   - 탭 그룹 먼저 복원
   - 각 세션의 이름, 경로, 프로젝트, 핀 상태, 색상 복원
   - UI 업데이트 (핀, 색상)
   - 마지막 활성 세션 활성화

### 3. 자동 저장 메커니즘

#### setupEventListeners()에 추가:

1. **beforeunload 이벤트**
   ```javascript
   window.addEventListener('beforeunload', () => {
     saveSessionState();
   });
   ```
   - 창 닫기 전 세션 상태 저장

2. **자동 저장 (30초 간격)**
   ```javascript
   setInterval(() => {
     if (state.sessions.size > 0) {
       saveSessionState();
     }
   }, 30000);
   ```
   - 30초마다 자동으로 세션 상태 저장
   - 데이터 손실 방지

### 4. 초기화 로직 변경

#### initialize() 함수 수정:

**변경 전:**
```javascript
createSession('Terminal 1');
```

**변경 후:**
```javascript
await restoreSessionState();
```

- 앱 시작 시 저장된 세션 자동 복원
- 저장된 세션이 없으면 기본 세션 생성

## 저장되는 정보

### 세션 정보
- 세션 ID
- 세션 이름
- 작업 디렉토리
- 프로젝트 ID
- 핀 상태
- 탭 색상

### 탭 그룹 정보
- 그룹 ID
- 그룹 이름
- 그룹 색상
- 접힘 상태
- 포함된 탭 ID 목록
- 프로젝트 ID

### 창 상태
- 너비/높이
- 위치 (x, y)
- 최대화 상태

## 동작 방식

### 저장 시나리오

1. **수동 저장**: 없음 (자동으로만 동작)
2. **자동 저장**:
   - 창 닫기 시 (beforeunload)
   - 30초마다 자동 (setInterval)

### 복원 시나리오

1. **앱 시작 시**:
   - `session-state.json` 파일 존재 확인
   - 존재하면 → 저장된 세션 복원
   - 없으면 → 기본 세션 생성 ("Terminal 1")

2. **복원 순서**:
   1. 탭 그룹 복원
   2. 각 세션 생성 및 설정 적용
   3. 탭 그룹 렌더링
   4. 마지막 활성 세션 활성화
   5. 성공 토스트 표시

## 파일 변경 사항

```
src-tauri/src/settings.rs  +85 lines
src-tauri/src/main.rs      +2 lines
src/app.js                 +120 lines (새 함수 + 이벤트 리스너)
```

## 빌드 검증

```bash
cd src-tauri && cargo check
✓ Finished `dev` profile [unoptimized + debuginfo] target(s) in 3.47s
```

- 컴파일 에러 없음
- 경고: unused `PtySession` (기존 이슈, 무관)

## 테스트 방법

1. **앱 실행**
   ```bash
   npm run tauri dev
   ```

2. **세션 생성 및 커스터마이징**
   - 여러 탭 생성
   - 탭 이름 변경
   - 탭 핀 설정
   - 탭 색상 설정
   - 탭 그룹 생성

3. **앱 종료**
   - 창 닫기 → 자동 저장 발생

4. **앱 재시작**
   - 이전 세션 자동 복원 확인
   - "이전 세션이 복원되었습니다" 토스트 확인

5. **저장 파일 확인**
   ```
   %APPDATA%\shellhive\session-state.json
   ```

## 주의사항

1. **PTY 세션은 복원되지 않음**
   - 세션 메타데이터만 복원 (이름, 색상, 핀 등)
   - 새로운 PTY 프로세스가 생성됨
   - 이전 명령어 히스토리는 복원되지 않음

2. **작업 디렉토리 복원**
   - 프로젝트 경로가 있으면 해당 경로로 복원
   - 없으면 기본 홈 디렉토리

3. **자동 저장 주기**
   - 30초마다 자동 저장
   - 너무 잦은 저장은 성능에 영향을 줄 수 있음
   - 필요시 간격 조정 가능

## 향후 개선 사항

1. **터미널 히스토리 복원**
   - 스크롤백 버퍼 저장/복원
   - 명령어 히스토리 복원

2. **창 위치/크기 복원**
   - 현재 구조체는 있지만 미사용
   - Tauri 창 API 연동 필요

3. **세션 백업**
   - 여러 버전 백업
   - 복원 실패 시 이전 버전으로 롤백

4. **선택적 복원**
   - 사용자가 복원 여부 선택
   - 특정 세션만 복원

## 결론

✅ Phase 7.1 완료
- 세션 상태 저장/복원 기능 구현
- 자동 저장 메커니즘 추가
- 앱 시작 시 자동 복원
- 빌드 검증 완료
