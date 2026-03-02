# innerHTML 사용 전수 감사 보고서

> 작성일: 2026-03-02  
> 대상 브랜치: `security/innerhtml-audit`  
> 범위: `src/app.js`, `src/history-panel.js`

## 1) 감사 기준

`innerHTML`/`insertAdjacentHTML` 사용 지점을 아래 3단계로 분류했다.

| 등급 | 정의 | 조치 |
|---|---|---|
| 안전 | 리터럴 문자열만 삽입 | 유지 |
| 보호됨 | 동적 값이 `escapeHtml`/`escapeHtmlAttr`/`escapeDataAttr` 또는 DOM API 후속 대입으로 보호 | 유지 |
| 위험 | 이스케이프 없이 사용자 제어 값이 직접 삽입 | 즉시 수정 |

## 2) 감사 결과

- 점검 지점: `src/app.js`의 `innerHTML`/`insertAdjacentHTML` 53개소 + `src/history-panel.js` 주요 동적 렌더 구간
- 위험 등급: **0건**
- 보호됨: 다수 (프로젝트/스니펫/세션/탭/Git 패널 렌더링)
- 안전: 리터럴 UI 템플릿/빈 문자열 초기화 구간

## 3) 이번 수정으로 보강한 항목

1. `data-*` 속성값 공통 이스케이프 함수 추가
   - `escapeDataAttr(value)` 도입
   - 스니펫/프로젝트/세션/녹화목록/검색결과의 `data-*` 주입 경로에 적용

2. 세션 상태 클래스 화이트리스트 적용
   - `getSessionStatusClass(status)` 도입
   - 탭/사이드바/분할 헤더/미니맵 상태 클래스 렌더링에 반영

3. 탭 색상값 화이트리스트 적용
   - `getSafeTabColor(color)` 도입 (`TAB_COLORS` 기준)
   - 인라인 style 색상 주입 경로 보호

4. 단순 문자열 아이콘 렌더 경로 개선
   - `sharingIcon.innerHTML = '🔗'` → `textContent` 전환

## 4) 결론

- 본 감사 시점 기준 `innerHTML` 경로에서 **직접 주입형 위험 패턴은 확인되지 않았다.**
- 남은 `innerHTML` 사용은 리터럴 템플릿 렌더링 또는 보호 함수/후속 DOM 값 대입 기반으로 동작한다.
- 추후 Phase 4 모듈화 이후 동일 기준으로 재감사(Phase 5-4) 수행 필요.
