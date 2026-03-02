# Shellhive 코드 업데이트 보고서

- **작성일**: 2026-02-01
- **작업 유형**: 코드 검토 이슈 수정
- **커밋**: `79a7ac7`
- **브랜치**: `develop`

---

## 1. 개요

`docs/review-report-develop-2026-02-01.md` 코드 검토 보고서에서 발견된 7개 이슈를 모두 수정 완료했습니다.

| 심각도 | 이슈 수 | 수정 완료 |
|--------|--------|----------|
| High | 2 | ✅ 2/2 |
| Medium | 3 | ✅ 3/3 |
| Low | 2 | ✅ 2/2 |
| **합계** | **7** | **✅ 7/7** |

---

## 2. 수정 내역

### 2.1 Phase 1: High 심각도

#### [HIGH-1] escapeHtml 데이터 속성 문제 수정

**파일**: `src/app.js`

| 위치 | 변경 전 | 변경 후 |
|------|--------|--------|
| Line 196 | `data-command="${escapeHtml(s.command)}"` | `data-command='${JSON.stringify(s.command)}'` |
| Line 204 | `const command = item.dataset.command;` | `const command = JSON.parse(item.dataset.command);` |
| Line 289 | `data-path="${escapeHtml(p.path)}"` | `data-path='${JSON.stringify(p.path)}'` |
| Line 297 | `const projectPath = item.dataset.path;` | `const projectPath = JSON.parse(item.dataset.path);` |

**효과**: `&`, `<`, `>` 등 특수문자가 포함된 명령어/경로가 정상 실행됨

---

#### [HIGH-2] PTY 프로세스 명시적 종료

**파일**: `src-tauri/src/pty.rs`

**변경 사항**:
1. `PtySessionData` 구조체에 `child` 필드 추가
   ```rust
   child: Arc<Mutex<Option<Box<dyn portable_pty::Child + Send>>>>
   ```

2. `create_pty`에서 child 핸들 저장
   ```rust
   let child_handle = Arc::new(Mutex::new(Some(child)));
   ```

3. `kill_pty`에서 명시적 종료
   ```rust
   if let Some(mut child) = session_data.child.lock().take() {
       let _ = child.kill();
   }
   ```

**효과**: 탭 종료 시 백그라운드 프로세스 잔존 방지

---

### 2.2 Phase 2: Medium 심각도

#### [MEDIUM-1] 터미널 리사이즈 PTY 반영

**파일**: `src/app.js`

**변경 사항**:
1. 초기 PTY 생성 시 크기 전달 (line 422-436)
2. `resizeHandler`에서 `resize_pty` 호출 (line 524-539)
3. 100ms 디바운싱 적용

**효과**: 창 크기 변경 시 터미널 출력 정렬 유지

---

#### [MEDIUM-2] PTY 에러 이벤트 구독

**파일**: `src/app.js`

**변경 사항**:
1. `pty-error` 이벤트 구독 추가 (line 458-470)
2. 에러 발생 시 터미널에 빨간색 메시지 표시
3. 세션 상태를 EXITED로 업데이트
4. `closeSession`에서 리스너 정리 (line 668)

**효과**: PTY 장애 발생 시 사용자 인지 가능

---

#### [MEDIUM-3] Mutex 락 범위 최소화

**파일**: `src-tauri/src/pty.rs`

**변경 사항**:
1. `writer`를 `Arc<Mutex<...>>`로 래핑 (line 21)
2. `write_pty` 함수 리팩토링 (line 186-211)
   - 전역 락: Arc 클론에만 사용 (마이크로초)
   - I/O 작업: 세션별 락으로 분리

**효과**: 멀티 세션 동시 입력 시 블로킹 제거

---

### 2.3 Phase 3: Low 심각도

#### [LOW-1] CSP 정책 적용

**파일**: `src-tauri/tauri.conf.json`

**변경 전**:
```json
"csp": null
```

**변경 후**:
```json
"csp": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: tauri: http://localhost:* ws://localhost:*; font-src 'self' data:; img-src 'self' data: blob:"
```

**효과**: XSS/플러그인 리스크 감소

---

#### [LOW-2] 테스트 스캐폴딩 추가

**파일**: `src-tauri/src/pty.rs`, `package.json`

**Rust 테스트** (line 264-279):
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_pty_manager_creation() { ... }
    #[test]
    fn test_pty_manager_default() { ... }
}
```

**package.json**:
```json
"test:rust": "cd src-tauri && cargo test"
```

**테스트 결과**: 2/2 통과

---

## 3. 검증 결과

| 항목 | 결과 |
|------|------|
| Frontend Build | ✅ SUCCESS |
| Backend Build | ✅ SUCCESS (1 warning - 무관) |
| Rust Tests | ✅ 2/2 PASSED |
| Architect Review | ✅ APPROVED |

---

## 4. 변경 파일 요약

| 파일 | 변경 라인 | 설명 |
|------|----------|------|
| `src/app.js` | +65 | escapeHtml, resize, error, 구독 |
| `src-tauri/src/pty.rs` | +80, -3 | child 핸들, Mutex 분리, 테스트 |
| `src-tauri/tauri.conf.json` | +1, -1 | CSP 정책 |
| `package.json` | +2 | 테스트 스크립트 |

---

## 5. 후속 작업 권장

| 우선순위 | 항목 | 상태 |
|----------|------|------|
| 1 | 미사용 `PtySession` 구조체 제거 | 선택 |
| 2 | 추가 단위 테스트 작성 | 선택 |
| 3 | E2E 테스트 도입 | 장기 |

---

*검증자: Claude Code (Architect Agent)*
*커밋: 79a7ac7*
