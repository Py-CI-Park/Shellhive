# run-release.bat 분할 기능 QA 로그 (2026-02-06)

## 1. 실행 메타 정보

- 문서 작성일: 2026-02-06
- 대상 브랜치: `feature/roadmap-phase1-4`
- 대상 파일:
  - `src/app.js`
  - `src/ui-constants.js`
  - `.eslintrc.json`
- 관련 이슈 커밋:
  - `94be2a6a718ce54fd8f892656ecc56c561fd5a1a`
  - `36ab98d93c01e2c6ae4a32f574304e4c64957068`

## 2. 사전 점검 결과

### 2.1 릴리즈 실행 스크립트 점검

- 명령: `cmd /c run-release.bat`
- 확인 결과:
  - `src-tauri/target/release/shellhive.exe` 존재 확인 (`True`)
  - 스크립트 호출 종료코드는 `1`로 관찰됨(비대화형 CLI 환경)
  - 종료코드와 별개로 `shellhive` 프로세스 기동 확인
  - 점검 종료 후 테스트 프로세스 강제 종료

판정: `Pass with note` (기동 경로는 정상, 스크립트 종료코드 해석은 수동 환경에서 추가 확인 필요)

### 2.2 자동 회귀 검증

- `npm run lint`: `Pass`
- `npm run test`: (아래 4절에서 재실행 기록)
- `npm run build`: (아래 4절에서 재실행 기록)
- 분할 E2E 테스트 파일: `src/__tests__/split-layout.e2e.test.js`

## 3. 수동 시나리오 실행 로그

체크리스트 기준 문서: `docs/qa/run-release-split-manual-checklist.md`

| TC ID | 항목 | 결과 | 비고 |
|---|---|---|---|
| TC-01 | 릴리즈 실행 확인 | Pass | 스크립트 실행 후 앱 프로세스 기동 확인 |
| TC-02 | 가로 분할 클릭 동작 | Pending | CLI 환경 특성상 GUI 클릭 수동검증 미실행 |
| TC-03 | 세로 분할 클릭 동작 | Pending | CLI 환경 특성상 GUI 클릭 수동검증 미실행 |
| TC-04 | 연속/중첩 분할 | Pending | 수동 시나리오 필요 |
| TC-05 | 분할 닫기 복귀 | Pending | 수동 시나리오 필요 |
| TC-06 | 탭 전환/복원 회귀 | Pending | 수동 시나리오 필요 |

## 4. 품질 게이트 실행 기록

### 4.1 Lint

- 명령: `npm run lint`
- 결과: `Pass`

### 4.2 Unit/E2E Test

- 명령: `npm run test`
- 결과: `Pass`
- 비고: `split-layout.e2e.test.js` 포함

### 4.3 Build

- 명령: `npm run build`
- 결과: `Pass`

## 5. 리스크 및 후속 액션

- 현재 리스크:
  - `run-release.bat` 기반 실제 GUI 클릭 수동검증(TC-02~TC-06) 증빙이 아직 없음
- 후속 액션:
  1. 동일 체크리스트로 로컬 수동 테스트 실행
  2. 각 TC별 스크린샷/영상 경로 첨부
  3. 실패 항목 발생 시 결함 템플릿으로 즉시 이슈 등록
