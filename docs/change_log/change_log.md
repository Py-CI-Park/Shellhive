# Shellhive 변경 로그

이 문서는 Shellhive 프로젝트의 주요 변경 사항을 기록합니다.

---

## [Unreleased]

### 2026-02-01 - 코드 검토 이슈 수정

**커밋**: `79a7ac7`

#### 수정됨 (Fixed)

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

#### 보안 (Security)

- **[LOW]** CSP(Content Security Policy) 정책 적용
  - `csp: null` → 적절한 보안 정책으로 변경
  - XSS 공격 방어 강화

#### 추가됨 (Added)

- **[LOW]** 기본 테스트 스캐폴딩 추가
  - Rust 단위 테스트 2개 (`test_pty_manager_creation`, `test_pty_manager_default`)
  - `npm run test:rust` 스크립트 추가

---

### 2026-02-01 - 코드 검토 보고서 추가

**커밋**: `8718bb9`

#### 문서 (Documentation)

- `docs/review-report-develop-2026-02-01.md` - develop 브랜치 정적 코드 리뷰 보고서
- `docs/review-verification-2026-02-01.md` - 검토 보고서 검증 결과

---

## 버전 히스토리

| 버전 | 날짜 | 주요 변경 |
|------|------|----------|
| 0.1.0 | 개발 중 | 초기 개발 버전 |

---

## 변경 유형 가이드

- **추가됨 (Added)**: 새로운 기능
- **변경됨 (Changed)**: 기존 기능 변경
- **사용 중단 (Deprecated)**: 곧 제거될 기능
- **제거됨 (Removed)**: 제거된 기능
- **수정됨 (Fixed)**: 버그 수정
- **보안 (Security)**: 보안 관련 변경
