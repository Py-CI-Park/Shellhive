# Shellhive 보안 재검증 보고서 (Phase 5-4)

> 작성일: 2026-03-02
> 대상 브랜치: `feature/next-improvements`
> 기준 계획: `docs/plans/project-improvement-plan.md` Phase 5-4

---

## 1) 검증 범위

1. Phase 2 보안 하드닝 항목의 핵심 설정/코드 유지 여부
2. Phase 4 모듈 분리 이후 보안 관련 회귀 여부(특히 DOM 렌더링/IPC)
3. 빌드/테스트 기반 기본 회귀 검증

---

## 2) 검증 결과 요약

| 항목 | 결과 | 근거 |
|------|------|------|
| CSP `unsafe-eval` 제거 유지 | ✅ | `tauri.conf.json`의 `script-src 'self' 'wasm-unsafe-eval'` 확인 |
| `core:default` 제거 유지 | ✅ | `src-tauri/capabilities/default.json`에서 `core:default` 미존재 |
| `shell:allow-open` HTTPS 스코프 유지 | ✅ | capabilities에 `{ "url": "https://*" }` 스코프 확인 |
| Claude/AI IPC 등록 일치성 | ✅ | `ipc-registration.test.js` 통과 (`check_claude_installed`, `get_claude_start_command`, `translate_natural_language`, `get_ai_patterns`) |
| Git 패널 보안 처리(escape/confirm/discard 경로) | ✅ | `git-panel.js` 분리 후 escape 함수 주입 및 discard 확인 다이얼로그 유지 |
| `innerHTML` 전수 감사 상태 | ⚠️ 유지 관찰 필요 | `app.js/git-panel.js/error-explanations.js`에 여전히 다수 `innerHTML` 사용. 기존 감사 문서 기준 보호 경로(escape 적용) 유지 여부를 지속 점검 필요 |
| 프론트엔드 빌드/테스트 | ✅ | `npm run build`, `npm test -- --run` 통과 |
| Rust 빌드/테스트 | ⚠️ 환경 제약 | `pkg-config`/GTK 계열 라이브러리 부재로 본 환경에서 검증 불가 |

---

## 3) 상세 확인

### 3.1 CSP

현재 값:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' ipc: tauri: http://localhost:* ws://localhost:*; font-src 'self' data:; img-src 'self' data: blob:
```

- `script-src`에 `'unsafe-eval'`, `'unsafe-inline'` 없음
- 기존 하드닝 목표 유지됨

### 3.2 Tauri Capability

- `core:default` 미사용 유지
- 이벤트/윈도우/다이얼로그 권한 명시화 유지
- `shell:allow-open` URL 범위가 HTTPS로 제한됨

### 3.3 모듈 분리 후 보안 회귀 점검

- `git-panel.js`, `error-explanations.js` 분리 후에도 escape 유틸 주입 기반 렌더링 유지
- Git discard는 확인 대화상자(`showConfirmDialog`)를 거친 후 실행
- IPC 등록/호출 일치성은 자동 테스트(`ipc-registration.test.js`)로 지속 확인

### 3.4 테스트 검증

실행 결과:

- `npm run build` ✅
- `npm test -- --run` ✅ (8 files, 36 tests)

Rust 검증은 환경 제약으로 실패:

- 원인: `pkg-config` 및 GTK 계열 시스템 라이브러리 미설치
- 영향: Rust 보안 테스트의 본 환경 내 자동 검증 불가

---

## 4) 후속 권장사항

1. **innerHTML 재감사 자동화**: 릴리즈 전 `innerHTML` 사용 지점과 escape 적용 여부를 체크리스트로 재검증
2. **Rust CI 환경 보완**: Windows/적절한 Linux 이미지에서 `cargo test` 자동화하여 보안 회귀 검출 강화
3. **모듈 분리 지속 시 보안 게이트 유지**: 새 모듈 추가 시 escape/allowlist 검증 규칙을 PR 템플릿에 명시

---

## 5) 결론

본 검증 시점(2026-03-02) 기준으로, Phase 2에서 반영한 핵심 보안 하드닝(CSP, capability 최소화, IPC 등록 정합성)은 유지되고 있으며, Phase 4 모듈 분리 과정에서도 중대한 신규 보안 회귀는 확인되지 않았다. 다만 `innerHTML` 사용 영역은 구조상 여전히 존재하므로 지속적인 감사가 필요하다.
