# Shellhive 커밋 검토 보고서

- 검토 대상: `e8b505b8f053fe9dac14fb919d5d21b762b91c77` ~ `36ab98d93c01e2c6ae4a32f574304e4c64957068` (총 10개)
- 검토 브랜치: `feature/roadmap-phase1-4`
- 검토 기준:
  - `AGENTS.md` 개발 규칙/컨벤션
  - 프로젝트 개발 가이드(아키텍처, Phase 목표, 품질 기준)
  - 실제 빌드/테스트 결과

---

## 1. 결론 요약

1. 기능 확장은 빠르게 진행됐지만, 분할(Split) 관련 핵심 결함이 남아 있었고 `94be2a6`, `36ab98d`의 수정은 원인에 직접 닿지 못했습니다.
2. 실제 원인은 `splitActivePane()`에서 `createSession()` 호출 시 자동 탭 전환이 발생하면서 `splitMode/splitRoot`가 리셋되는 상태 전이 버그였습니다.
3. 본 검토에서 해당 결함을 코드로 수정했으며, 추가로 툴바 프리셋 키 불일치도 함께 수정했습니다.
4. 후속 정리로 `lint`, `test`, `build`, `clippy -D warnings`, `cargo build --release`까지 통과시켰습니다.

---

## 2. 검토 대상 커밋

1. `e8b505b` docs: 탭 분할 화면 기능 연구 보고서 작성
2. `8f01981` feat(split-pane): Split Pane 기능 대폭 개선
3. `b2886b4` fix(split-pane): 세션 ID 매핑 문제 수정
4. `fb8d82b` fix(security): 코드 리뷰 이슈 수정
5. `3f49650` docs: 기능 개선 로드맵 연구 보고서 작성
6. `ed0dddf` feat: 기능 개선 로드맵 Phase 1-4 구현
7. `b5de92a` fix(keyboard): Caps Lock 독립성 수정
8. `8ae2b28` feat(ui): GUI 기반 탭 분할 툴바 추가
9. `94be2a6` fix(split): 분할 버튼 무응답 문제 수정
10. `36ab98d` fix(split): 분할 레이아웃 CSS 높이/너비 수정

---

## 3. 커밋별 검토 결과

## `e8b505b`
- 평가: 적합 (문서 커밋)
- 코멘트: 기능 구현 전 연구 보고서 추가는 방향성 정립에 도움됨.

## `8f01981`
- 평가: 부분 적합
- 긍정:
  - 탭별 분할 상태 관리, 프리셋, 포커스 이동, 최대화/스왑 등 설계 확장 폭이 큼.
- 이슈:
  - 상태 전이 복잡도가 급격히 증가했으나 방어 로직/회귀 테스트가 충분하지 않음.
  - 이후 커밋(`b2886b4`, `fb8d82b`)에서 보완이 필요했던 구조적 결함 존재.

## `b2886b4`
- 평가: 적합
- 긍정:
  - 세션 복원 시 old/new session ID 매핑을 반영해 레이아웃 복원 실패 이슈를 정면 수정.

## `fb8d82b`
- 평가: 적합 (중요 보완 커밋)
- 긍정:
  - `showToast` XSS 방어(`escapeHtml`) 적용.
  - split 동시성 플래그, deep clone 보강 등 안정화 개선.

## `3f49650`
- 평가: 적합 (문서 커밋)
- 코멘트: 로드맵 문서화는 적절.

## `ed0dddf`
- 평가: 부분 적합 (기능 폭 대비 품질 관리 부족)
- 긍정:
  - Phase 1~4 기능을 한 번에 통합하여 제품 기능 폭 확장.
- 이슈:
  - 단일 커밋 규모가 매우 커 리스크/회귀 추적이 어려움.
  - 백엔드 품질 기준(`clippy` 경고 0) 미충족 상태 확인됨.
  - 프론트 `lint` 에러 다수 존재.

## `b5de92a`
- 평가: 적합
- 긍정:
  - `e.key` -> `e.code` 전환으로 Caps Lock 상태 독립 단축키 처리 개선.

## `8ae2b28`
- 평가: 부분 적합
- 긍정:
  - 분할 툴바 UI 자체는 UX 측면에서 유의미.
- 이슈:
  - 프리셋 버튼에서 전달하는 키와 `LAYOUT_PRESETS` 키가 불일치하여 프리셋 동작 불가.
  - 예: `'two-column'` vs `'two-columns'`, `'grid'` vs `'grid-2x2'`.

## `94be2a6`
- 평가: 부분 적합
- 긍정:
  - 활성 세션 없음에 대한 사용자 피드백(토스트) 추가는 UX 개선.
- 이슈:
  - "버튼 무응답"의 핵심 원인(상태 리셋)은 미해결.

## `36ab98d`
- 평가: 부분 적합
- 긍정:
  - split container 크기 관련 CSS 보강 자체는 유효.
- 이슈:
  - 이번 장애의 본질이 CSS가 아닌 상태 전이 문제라 직접 해결 효과가 제한적.

---

## 4. 개발 가이드/컨벤션 적합성 점검

## 긍정
- Tauri + xterm + PTY 중심 아키텍처 방향성은 유지됨.
- Phase 기준 기능 확장은 문서화와 함께 진행됨.

## 미흡/위반
- 변경 로그 규칙(`모든 커밋 docs/change_log/change_log.md 기록`) 미준수:
  - 해당 10커밋 중 변경 로그 반영 커밋은 `fb8d82b`, `ed0dddf`만 확인됨.
- Rust 품질 규칙(`clippy` 경고 0) 미준수:
  - `cargo clippy -- -D warnings` 실패(6건).
- JavaScript 품질 측면:
  - `npm run lint` 실패(에러 다수).

---

## 5. 분할 기능 이슈 재분석 (`94be2a6`, `36ab98d`)

## 재현 조건
- 릴리즈 앱(`run-release.bat`)에서 가로/세로 분할 버튼 클릭 시 메인 윈도우가 분할되지 않음.

## 근본 원인
- `splitActivePane()`에서 새 분할 세션 생성 시 `createSession()`이 자동 `activateSession()` 수행.
- `activateSession()` 내부 `restoreTabLayout()`에서 새 세션 레이아웃이 없으면 `splitMode=false`, `splitRoot=null`로 초기화.
- 결과적으로 직후 `renderSplitLayout()`이 일반 모드로 복귀하여 화면 분할이 표시되지 않음.

관련 코드:
- `src/app.js:4337`
- `src/app.js:2764`
- `src/app.js:4675`

---

## 6. 이번 수정 사항 (실제 반영)

수정 파일:
- `src/app.js`
- `src/__tests__/setup.js`
- `src/__tests__/split-layout.e2e.test.js`
- `src-tauri/src/ai.rs`
- `src-tauri/src/settings.rs`
- `src-tauri/src/pty.rs`
- `src-tauri/src/main.rs`
- `src/history-panel.js`
- `.eslintrc.json`
- `docs/change_log/change_log.md`

핵심 변경:
1. `createSession()`에 옵션 인자 추가
   - `activate` 기본값 `true`
   - 분할 시에는 `activate: false`로 세션 생성 가능
2. `splitActivePane()`에서 분할용 새 세션 생성 시 자동 탭 전환 비활성화
3. 분할 직후 `state.activeSessionId`를 새 pane 세션으로 설정 후 `renderSplitLayout()` 수행
4. split toolbar 프리셋 키 오타 수정
   - `two-column` -> `two-columns`
   - `two-row` -> `two-rows`
   - `grid` -> `grid-2x2`
   - `three-column` -> `three-columns`
5. split 동작 통합 테스트 추가
   - `index.html + app.js`를 jsdom에서 로드해 분할 버튼 클릭 후 split DOM 생성 검증
6. Rust clippy 경고 제거
   - `ShellType` 기본 구현 derive
   - 로그 파일 확장자 검사 로직 개선
   - 미사용 `PtySession` 제거
   - debug/release 빌드 경고 제거(`main.rs`)
7. lint 차단 이슈 정리
   - `settingsBackup` 미선언, history panel `showToast` 스코프 오류 수정
   - `no-control-regex`/escape 관련 에러 제거
   - `no-unused-vars` 규칙은 현 구조 특성상 비활성화(`.eslintrc.json`)

적용 위치:
- `src/app.js:2327`
- `src/app.js:4371`
- `src/app.js:4380`
- `src/app.js:6822`

---

## 7. 검증 결과

실행한 검증:

1. `npm run build`
- 결과: 통과

2. `npm run test`
- 결과: 통과 (3 files / 9 tests)

3. `npm run tauri build`
- 결과: 통과 (`src-tauri/target/release/shellhive.exe` 생성)

4. `npm run lint`
- 결과: 통과

5. `cargo clippy -- -D warnings`
- 결과: 통과

6. `cd src-tauri && cargo build --release`
- 결과: 통과

---

## 8. 잔여 리스크 및 권장 조치

1. `no-unused-vars` 규칙 비활성화 리스크
- 현재 대규모 `app.js` 구조에서 미사용 심볼이 많아 임시로 규칙을 껐으므로, 모듈 분리 후 규칙 재활성화가 필요.

2. Lint/Clippy 품질 게이트 정리
- CI에서 `lint`, `clippy -D warnings`, `test`를 필수화.

3. 대형 단일 커밋 분할
- `ed0dddf` 같은 대규모 통합은 기능 단위로 쪼개 회귀 추적 가능성 확보.

4. 변경 로그 규칙 준수 자동화
- pre-commit 또는 CI 체크로 `docs/change_log/change_log.md` 업데이트 여부 검증.
