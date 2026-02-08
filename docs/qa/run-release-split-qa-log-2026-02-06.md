# run-release.bat 분할 기능 QA 로그 (2026-02-08)

## 1. 문서 정보

- 작성일: 2026-02-08
- 브랜치: `feature/gui-split-tab-enhancement`
- 기준 문서: `docs/qa/run-release-split-manual-checklist.md`
- 관련 개선 커밋:
  - `2ec2ca9` (`run-release.bat` 실행 경로 고정)
  - `3bf59a0` (분할 미니맵/레이아웃 갤러리/헤더 강화)

## 2. 사전 점검 결과

### 2.1 Release 실행 스모크

- 실행 명령: `cmd /c run-release.bat`
- 실행 조건: 저장소 외부 경로(`C:\`) 기준 호출 포함
- 결과: `Pass`
- 비고:
  - 실행 경로와 무관하게 앱 기동 확인
  - 점검 과정에서 생성된 `shellhive.exe` 프로세스는 종료 정리 완료

### 2.2 자동 검증

- `npm run lint`: `Pass`
- `npm run test -- --run`: `Pass` (4 files, 22 tests)
- `cargo check --manifest-path src-tauri/Cargo.toml`: `Pass`

## 3. 체크리스트 실행 상태

| TC ID | 항목 | 상태 | 비고 |
|---|---|---|---|
| TC-01 | Release 실행 및 경로 독립 확인 | Pass | 배치 실행 경로 이슈 수정 반영 확인 |
| TC-02 | 기본 분할(오른쪽) | Pass (자동) | `split-layout.e2e` 회귀 통과 |
| TC-03 | 가로/세로 분할 | Pass (자동) | 버튼/레이아웃 생성 검증 통과 |
| TC-04 | 분할 상태 유지 전환 | Pass (자동) | pane 클릭 후 분할 유지 검증 통과 |
| TC-05 | 분할 병합/종료 | Pass (자동) | 병합 버튼 시나리오 검증 통과 |
| TC-06 | 레이아웃 프리셋(드롭다운) | Pass (자동) | 선택/적용 후 4분할 생성 검증 통과 |
| TC-07 | 레이아웃 갤러리 모달 | Pass (자동) | 갤러리 카드 선택/적용 시나리오 검증 통과 |
| TC-08 | 분할 미니맵 동작 | Pass (자동) | 미니맵 leaf 클릭 포커스 전환 검증 통과 |
| TC-09 | 패널 헤더 상태/경로 표시 | Pass (자동) | 서브타이틀(상태·경로) 렌더링 검증 통과 |
| TC-10 | AI UI 비노출 정책 | Pending (수동) | Release GUI 수동 점검 필요 |

## 4. 리스크 및 후속 액션

- 남은 리스크:
  - TC-10(비AI UI 완전 비노출)은 실제 Release GUI에서 수동 확인이 필요함
- 후속 권장:
  1. 실제 사용자 환경(Windows 10/11 각 1회)에서 TC-10 수동 검증 수행
  2. 수동 검증 증빙(스크린샷)을 본 문서에 첨부
  3. 수동 검증 완료 시 상태를 `Pass`로 갱신하고 Release Gate 확정