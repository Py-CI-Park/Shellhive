# Shellhive 개발 브랜치 코드 검토 보고서 (Develop)

- 작성일: 2026-02-01  
- 대상 브랜치: `develop` (로컬 기준 `origin/develop` 대비 10 커밋 ahead)  
- 검토 범위: 프론트엔드(`index.html`, `src/app.js`, `src/style.css`), 백엔드(`src-tauri/src/*`), 구성(`src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `package.json`, `Cargo.toml`)  
- 검토 방식: 정적 코드 리뷰 + 구조/기능 완성도 점검 (실행/테스트 미수행)  

---

## 1) Findings (심각도 순)

### High

1. **스니펫/프로젝트 실행 데이터가 HTML 엔티티로 변형될 위험**
   - 증상: `data-command`, `data-path`에 `escapeHtml()` 결과를 넣어 클릭 시 원본 명령/경로가 HTML 엔티티로 변환될 수 있음.  
   - 영향: `&`, `<`, `>` 등이 포함된 명령/경로가 실제 실행 시 깨질 가능성.  
   - 위치:
     - `src/app.js:195` (스니펫: `data-command="${escapeHtml(s.command)}"`)
     - `src/app.js:288` (프로젝트: `data-path="${escapeHtml(p.path)}"`)
   - 권고: `dataset`에는 **원본 문자열**을 저장하고, 표시 텍스트만 escape 처리.

2. **PTY 종료 시 실제 셸 프로세스가 종료되지 않을 가능성**
   - 증상: `kill_pty`가 세션 Map 제거만 수행해 child 프로세스 종료가 보장되지 않음.  
   - 영향: 탭을 닫아도 cmd/powershell이 백그라운드에 남을 수 있음(리소스 누수).  
   - 위치:
     - `src/app.js:600` (프론트: `kill_pty` 호출)
     - `src-tauri/src/pty.rs:223` (백엔드: 세션 제거만 수행)
   - 권고: `create_pty` 시 child 핸들을 저장하고, `kill_pty`에서 명시적으로 종료 처리.

---

### Medium

3. **터미널 리사이즈가 PTY에 반영되지 않음**
   - 증상: `fitAddon.fit()` 호출만 있고 `resize_pty` 호출 없음.  
   - 영향: 글꼴 크기/창 크기 변경 시 라인 정렬 깨짐 가능.  
   - 위치:
     - `src/app.js:483` (리사이즈 핸들러)
     - `src-tauri/src/pty.rs:197` (백엔드 resize API 제공)
   - 권고: `fitAddon.fit()` 이후 cols/rows를 계산해 `resize_pty` 호출.

4. **PTY 에러 이벤트 UI 미연결**
   - 증상: 백엔드에서 `pty-error:<id>` emit 하지만 프론트에서 구독하지 않음.  
   - 영향: PTY 장애 발생 시 사용자 인지/복구 어려움.  
   - 위치:
     - `src-tauri/src/pty.rs:143`
     - `src/app.js:421` (구독은 data/exit만 존재)
   - 권고: `pty-error` 구독 후 UI 메시지/로그 표시.

5. **전역 Mutex 범위가 너무 넓음**
   - 증상: `write_pty`가 전역 sessions 락을 잡은 상태로 write/flush 수행.  
   - 영향: 한 세션이 지연되면 다른 세션 입력이 블로킹될 수 있음.  
   - 위치: `src-tauri/src/pty.rs:173`
   - 권고: 세션별 락/채널 구조로 분리하거나 락 범위를 축소.

---

### Low

6. **CSP 비활성화**
   - 증상: `csp: null`로 보안 정책 해제.  
   - 영향: 배포 시 XSS/플러그인 리스크 상승.  
   - 위치: `src-tauri/tauri.conf.json:26`
   - 권고: 최소한의 CSP 템플릿 적용 후 필요한 예외만 허용.

7. **자동화 테스트/회귀 검증 부재**
   - 증상: 기본 테스트 스크립트 없음.  
   - 영향: 기능 증가 시 회귀 확인이 어려움.  
   - 위치: `package.json:5`, `src-tauri/Cargo.toml:1`
   - 권고: 최소 CRUD/PTY 시뮬레이션 테스트 도입.

---

## 2) 완성도 평가 (Phase 기준)

| Phase | 목표 | 상태 | 비고 |
|---|---|---|---|
| Phase 1 | Tauri + xterm 기본 통합 | 완료 | UI/터미널 렌더 완성 |
| Phase 2 | PTY 연동 | 완료 | ConPTY 기반 입출력 연결 |
| Phase 3 | 프로젝트 관리 | 완료 | CRUD + UI 연결 완료 |
| Phase 4 | 멀티 세션 | 완료 | 탭/드래그/컨텍스트 메뉴 |
| Phase 5 | 고급 기능 | 부분 완료 | 스니펫/설정/로깅 완료, 글로벌 단축키/세션 복원/로그 뷰어 미완 |

---

## 3) 구조/설계 품질

### 강점
- 모듈 분리 명확: `pty.rs`, `project.rs`, `snippet.rs`, `settings.rs`
- 프론트 UI/동작 구성 일관성: sidebar/tabs/modal 구조 안정적
- 세션/탭/단축키 기능이 사용자 흐름에 잘 맞음

### 개선 포인트
- 데이터 흐름 설계: `escapeHtml` 사용 위치 재검토 필요  
- PTY 라이프사이클 관리 미흡 (child 종료/세션 정리)  
- 확장성: 프로젝트별 shell 옵션 UI 연결 미완

---

## 4) 추천 기능 (우선순위)

1. **글로벌 단축키 기반 앱 토글**  
2. **세션 복원 (탭/경로/셸 상태 저장)**  
3. **스니펫 태그/그룹/변수 치환**  
4. **로그 뷰어 (검색/필터/내보내기/보존 정책)**  

---

## 5) 개선 제안 (구체 액션)

### UI/프론트
- `data-*`에는 원본 저장, 표시 텍스트만 escape  
- PTY 에러 이벤트 UI 표시  
- 리사이즈 시 `resize_pty` 호출  

### 백엔드
- `create_pty`에서 child 핸들 저장  
- `kill_pty`에서 child 프로세스 종료 처리  
- `write_pty` 락 범위 최소화  

### 보안/운영
- CSP 정책 적용  
- 최소 테스트 스캐폴딩 추가  

---

## 6) 범위/제약

- 실제 실행/테스트는 수행하지 않음  
- 정적 리뷰 및 코드 구조 기반 분석  
- runtime 환경(PTY, ConPTY, 권한) 문제는 포함되지 않음  

---

## 7) 다음 단계 추천

1. **High/Medium 이슈 수정 패치 적용**  
2. **PTY 리사이즈/종료/에러 처리까지 포함한 안정화**  
3. **간단한 회귀 테스트 스캐폴딩 도입**  

---

필요하시면 위 보고서를 바탕으로 **수정 패치 작업** 또는 **구체 구현 가이드**를 이어서 진행하겠습니다.
