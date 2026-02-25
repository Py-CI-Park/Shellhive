# 빌드/테스트 완료 알림 기능 구현

## 개요
터미널에서 빌드나 테스트 명령이 완료되면 시스템 알림을 통해 사용자에게 결과를 통지하는 기능을 구현했습니다.

## 구현 날짜
2026-02-03

## 구현 내용

### 1. 의존성 추가

#### Rust (src-tauri/Cargo.toml)
```toml
tauri-plugin-notification = "2"
```

#### JavaScript (package.json)
```json
"@tauri-apps/plugin-notification": "^2.3.3"
```

### 2. Rust 백엔드 수정

#### src-tauri/src/main.rs
- `tauri-plugin-notification` 플러그인 등록
- `get_file_metadata` 명령 핸들러 추가 (드래그 앤 드롭 기능용)

#### src-tauri/src/settings.rs
- `Settings` 구조체에 `enable_notifications: bool` 필드 추가
- 기본값: `true` (알림 활성화)

### 3. 프론트엔드 구현 (src/app.js)

#### 알림 함수
```javascript
async function sendSystemNotification(title, body)
```
- 권한 확인 및 요청
- 쿨다운 메커니즘 (3초) - 중복 알림 방지
- 설정 확인 (`state.settings.enableNotifications`)

#### 패턴 감지 함수
```javascript
function checkForNotificationPatterns(output)
```

지원하는 명령어 패턴:

| 명령어 | 성공 패턴 | 실패 패턴 |
|--------|----------|----------|
| `npm test` | `\d+ passing`, `Tests:\s+\d+ passed` | `\d+ failing`, `Tests:\s+\d+ failed` |
| `npm run build` | `built in \d+`, `Build completed` | `Build failed`, `ERROR in` |
| `cargo build` | `Finished .* target\(s\) in` | `error\[E\d+\]`, `could not compile` |
| `cargo test` | `test result: ok\.` | `test result: FAILED` |

#### PTY 출력 리스너에 패턴 감지 연동
```javascript
unlistenPtyData = await listen(`pty-data:${ptySessionId}`, (event) => {
  terminal.write(event.payload);
  if (state.settings.enableLogging || state.settings.enable_logging) {
    logSessionOutput(ptySessionId, event.payload);
  }

  // 빌드/테스트 완료 패턴 감지
  checkForNotificationPatterns(event.payload);
});
```

### 4. 설정 UI (index.html)

새로운 설정 섹션 추가:
```html
<div class="settings-section">
  <h3 class="settings-section__title">Notifications</h3>

  <div class="form-group form-group--checkbox">
    <input type="checkbox" id="settingsEnableNotifications" checked>
    <label for="settingsEnableNotifications">Enable build/test notifications</label>
  </div>

  <p class="settings-help">Get system notifications when builds or tests complete</p>
</div>
```

### 5. State 관리

#### 초기 상태
```javascript
state.settings = {
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'Consolas',
  enableLogging: true,
  enableNotifications: true,  // 추가됨
  locale: 'ko',
}
```

#### 설정 저장/로드
- `showSettingsModal()` - 알림 설정 로드
- `saveSettings()` - `enable_notifications` 필드 포함하여 저장

## 주요 특징

### 1. 중복 알림 방지
- 3초 쿨다운 메커니즘
- 동일한 `title:body` 조합은 3초 이내 재전송 차단

### 2. ANSI 이스케이프 코드 제거
```javascript
const cleanOutput = output.replace(/\x1b\[[0-9;]*m/g, '');
```
터미널 색상 코드를 제거하여 정확한 패턴 매칭 수행

### 3. 권한 관리
- 첫 알림 시 자동으로 권한 요청
- 권한 거부 시 조용히 실패 (에러 발생하지 않음)

### 4. 설정 연동
- 사용자가 Settings 모달에서 알림 on/off 토글 가능
- 설정은 영구 저장되어 재시작 시에도 유지

## 테스트 방법

### 1. npm 테스트
```bash
npm test
```
- 테스트 통과 시: "Tests Passed" 알림
- 테스트 실패 시: "Tests Failed" 알림

### 2. npm 빌드
```bash
npm run build
```
- 빌드 성공 시: "Build Completed" 알림
- 빌드 실패 시: "Build Failed" 알림

### 3. Cargo 빌드
```bash
cargo build
```
- 빌드 성공 시: "Build Completed" 알림 (Cargo 메시지)
- 빌드 실패 시: "Build Failed" 알림

### 4. Cargo 테스트
```bash
cargo test
```
- 테스트 통과 시: "Tests Passed" 알림 (Rust 메시지)
- 테스트 실패 시: "Tests Failed" 알림

## 빌드 확인

### Rust 백엔드
```bash
cd src-tauri
cargo check
```
결과: ✅ 컴파일 성공 (warning 1개 - 사용되지 않는 구조체, 무해함)

### 프론트엔드
```bash
npm run build
```
결과: ✅ 빌드 성공

## 파일 변경 목록

### 수정된 파일
1. `src-tauri/Cargo.toml` - notification 플러그인 추가
2. `src-tauri/src/main.rs` - 플러그인 초기화 및 명령 핸들러 추가
3. `src-tauri/src/settings.rs` - Settings 구조체에 enable_notifications 필드 추가
4. `src/app.js` - 알림 함수 및 패턴 감지 로직 추가
5. `index.html` - 알림 설정 UI 추가
6. `package.json` - notification 플러그인 의존성 추가

### 새로 생성된 파일
- 없음

## 알려진 제한사항

1. Windows 10 1809 이상에서만 작동 (Tauri 알림 플러그인 제약)
2. 패턴 매칭은 영문 출력 기준 (다국어 빌드 도구 메시지는 추가 패턴 필요)
3. 실시간 스트림 처리로 인해 매우 긴 출력의 경우 패턴이 여러 청크로 나뉠 수 있음

## 향후 개선 방안

1. 사용자 정의 패턴 추가 기능
2. 알림 사운드 선택 옵션
3. 알림 우선순위 설정 (성공만, 실패만, 모두)
4. 빌드 시간 측정 및 알림에 표시
5. 다국어 빌드 도구 메시지 지원 확대

## 참고 문서

- [Tauri Notification Plugin](https://v2.tauri.app/plugin/notification/)
- [Windows Notification API](https://learn.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/windows-push-notification-services--wns--overview)
