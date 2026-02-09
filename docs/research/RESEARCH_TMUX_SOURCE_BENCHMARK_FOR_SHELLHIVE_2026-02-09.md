# Shellhive 분할 UX 개선을 위한 tmux 소스 벤치마크 연구 보고서 (2026-02-09)

- 작성일: 2026-02-09
- 작성 브랜치: `feature/tmux-benchmark-research`
- 분석 대상 저장소: `https://github.com/tmux/tmux`
- 분석 기준 커밋: `615c27c11789948df2db09e113e882f82dfb3e1c` (2026-02-02)
- 연구 목적: tmux의 패널/레이아웃 설계를 소스코드 단위로 이해하고, Shellhive의 화면 분할·탭·패널 UX를 개선할 실질 기능을 우선순위로 도출

---

## 1. 요약 결론

tmux는 "패널 조작 명령(Command Primitive) + 레이아웃 엔진(Layout Engine) + 옵션 기반 UX(Options) + 오버레이 상호작용(Overlay)"의 4축으로 분할 UX를 안정적으로 구성한다.  
Shellhive는 이미 split tree, 리사이즈, 스왑/병합, 미니맵 기반의 좋은 기반을 갖췄고, 다음 단계는 tmux 방식의 아래 4개를 우선 이식하는 것이 효율적이다.

1. `display-panes` 스타일의 "패널 번호 오버레이 선택 모드"
2. `break/join/move-pane`에 해당하는 "패널 분리/재결합 워크플로우"
3. `synchronize-panes`에 해당하는 "동시 입력 브로드캐스트 모드"
4. `main-pane-width/height`, `tiled-layout-max-columns` 같은 "정책형 레이아웃 옵션"

---

## 2. 분석 방법

tmux 소스에서 분할·레이아웃 관련 축을 아래 순서로 추적했다.

1. 패널 생성/조작 명령 계층
2. 레이아웃 알고리즘/직렬화 계층
3. 키바인딩 및 UI 오버레이 상호작용 계층
4. 옵션 테이블 기반 커스터마이징 계층

비교 대상 Shellhive는 다음 파일을 기준으로 현재 기능을 확인했다.

- `src/app.js`
- `src/style.css`
- `index.html`

---

## 3. tmux 핵심 설계 (소스 근거)

## 3.1 패널 조작 명령이 세분화되어 있음

tmux는 split만 있는 구조가 아니라, "분리(break) / 결합(join, move) / 교환(swap) / 회전(rotate)"을 명령 단위로 독립 제공한다.

- split: `cmd-split-window.c:38`, `cmd-split-window.c:120`
- break: `cmd-break-pane.c:33`, `cmd-break-pane.c:98`
- join/move: `cmd-join-pane.c:34`, `cmd-join-pane.c:48`, `cmd-join-pane.c:138`
- swap: `cmd-swap-pane.c:31`, `cmd-swap-pane.c:64`, `cmd-swap-pane.c:69`
- rotate: `cmd-rotate-window.c:30`, `cmd-rotate-window.c:57`

의미:

1. 사용자가 "레이아웃 편집"을 세밀한 동작으로 수행 가능
2. 명령 단위가 분리되어 자동화/단축키 확장이 쉬움

## 3.2 레이아웃 엔진이 독립 계층으로 분리됨

tmux는 레이아웃 프리셋과 트리 구조 조작을 명확히 분리한다.

- 프리셋 목록: `layout-set.c:43`~`layout-set.c:49`
- 프리셋 선택/순회: `cmd-select-layout.c:95`~`cmd-select-layout.c:123`
- 균등 분배(spread): `cmd-select-layout.c:103`~`cmd-select-layout.c:106`, `layout.c:1162`
- 타일 열 제한 옵션 사용: `layout-set.c:601`

의미:

1. UI가 달라도 같은 엔진을 재사용 가능
2. 프리셋 + 사용자 커스텀(문자열 레이아웃) 공존

## 3.3 레이아웃 상태를 직렬화/파싱 가능

- 레이아웃 덤프: `layout-custom.c:61`
- 체크섬 포함 문자열: `layout-custom.c:69`
- 레이아웃 파싱/검증: `layout-custom.c:157`~`layout-custom.c:173`

의미:

1. 레이아웃 공유/복구 안정성 높음
2. 잘못된 상태에 대한 방어 로직(체크섬/검증) 보유

## 3.4 오버레이 기반 패널 선택 UX가 정교함 (`display-panes`)

- 명령 엔트리: `cmd-display-panes.c:35`
- 패널 번호 렌더링: `cmd-display-panes.c:59`, `cmd-display-panes.c:121`
- 키 입력으로 패널 선택: `cmd-display-panes.c:224`~`cmd-display-panes.c:247`
- overlay attach: `cmd-display-panes.c:299`~`cmd-display-panes.c:306`

의미:

1. "패널이 많을 때" 탐색 비용을 크게 줄임
2. 마우스 없이도 빠른 점프 가능

## 3.5 옵션 기반 UX 커스터마이징이 깊음

- 메인 패널 크기: `options-table.c:1196`, `options-table.c:1204`
- 패널 테두리 상태/포맷: `options-table.c:1288`, `options-table.c:1314`
- 동시 입력: `options-table.c:1421`
- display-panes 색상/시간: `options-table.c:633`, `options-table.c:640`, `options-table.c:647`
- tiled 최대 열: `options-table.c:1428`

의미:

1. 기능 자체보다 "운영 정책"을 옵션화
2. 사용자 편차를 코드 분기 없이 수용

## 3.6 기본 키맵이 "분할 운영" 중심으로 설계됨

- 분할: `key-bindings.c:357`, `key-bindings.c:360`
- 번호 표시: `key-bindings.c:399`
- 줌: `key-bindings.c:405`
- 스왑 상하: `key-bindings.c:406`, `key-bindings.c:407`
- 레이아웃 직접 선택(M-1..7): `key-bindings.c:414`~`key-bindings.c:420`

의미:

1. 기능 발견성보다 "속도"를 우선
2. 반복 작업을 짧은 키 시퀀스로 수렴

---

## 4. Shellhive 현재 상태 요약 (비교 기준)

Shellhive는 이미 아래를 제공한다.

1. split tree 기반 렌더링: `src/app.js:4436`
2. 수평/수직 분할 + 기본분할: `src/app.js:4170`, `src/app.js:4179`, `src/app.js:4188`
3. 드래그 리사이즈: `src/app.js:4562`
4. 패널 병합/교환/최대화: `src/app.js:4642`, `src/app.js:4697`, `src/app.js:4336`
5. 레이아웃 프리셋 선택: `src/app.js:5002`
6. split 미니맵: `src/app.js:4851`, `index.html:80`, `src/style.css:405`
7. split 툴바 상태 관리: `src/app.js:4883`, `index.html:47`

즉, "기초 분할 기능"은 이미 충분하고, 다음 단계는 tmux처럼 "운영 밀도"를 올리는 기능이 맞다.

---

## 5. 벤치마크 개선안 (우선순위)

## 5.1 P0: 패널 번호 오버레이 선택 모드 (`display-panes`형)

### 제안

1. 단축키 입력 시 각 pane에 숫자/문자 라벨 오버레이 표시
2. 숫자 키 입력으로 즉시 활성 pane 전환
3. 일정 시간 후 자동 종료, 옵션으로 시간/색상 설정

### tmux 근거

- `cmd-display-panes.c:35`, `cmd-display-panes.c:224`, `cmd-display-panes.c:299`
- `options-table.c:633`, `options-table.c:640`, `options-table.c:647`

### Shellhive 적용 위치

- 오버레이 렌더: `src/app.js` split 렌더 계층 근처 (`renderSplitLayout`, `renderSplitNode`)
- 스타일: `src/style.css`
- 옵션: `src-tauri/src/settings.rs` + 프론트 설정 모달

---

## 5.2 P0: pane 분리/재결합 (break / join / move-pane형)

### 제안

1. `Break Pane`: 현재 split pane을 새 탭(새 윈도우 그룹)으로 분리
2. `Join Pane`: 다른 탭 pane을 현재 split tree로 결합
3. `Move Pane`: 결합 후 원본에서 제거되는 이동 모드

### tmux 근거

- `cmd-break-pane.c:33`, `cmd-break-pane.c:98`
- `cmd-join-pane.c:34`, `cmd-join-pane.c:48`, `cmd-join-pane.c:138`

### 기대효과

1. "탭 단위 관리"와 "분할 단위 작업" 사이 왕복 비용 감소
2. VSCode 터미널 UX와 더 유사한 작업 흐름

---

## 5.3 P1: 동시 입력 브로드캐스트 (`synchronize-panes`형)

### 제안

1. 현재 split tree(또는 선택된 pane 그룹)에 동일 입력 전송
2. 상태 배지/헤더 경고로 오작동 방지
3. 기본 OFF + 명시 토글

### tmux 근거

- `options-table.c:1421`

### Shellhive 적용 아이디어

1. `terminal.onData` 입력 처리 지점에서 fan-out
2. 대상 pane 필터(동일 프로젝트만, visible pane만 등) 옵션화

---

## 5.4 P1: 정책형 레이아웃 옵션

### 제안

1. `main-pane-width`/`main-pane-height` 유사 옵션 추가
2. `tiled-layout-max-columns` 유사 옵션 추가
3. `split preset` 적용 시 옵션 우선 반영

### tmux 근거

- `options-table.c:1196`, `options-table.c:1204`, `options-table.c:1428`
- `layout-set.c:601`

### 기대효과

1. 사용자별 "선호 레이아웃" 재현성 강화
2. 대형 모니터/다중 세션에서 가독성 개선

---

## 5.5 P1: 균등화/회전 조작 강화

### 제안

1. 현재 pane 기준 균등 분배(한 레벨 또는 상위 레벨 탐색)
2. pane 순환 회전(rotate) 단축키 제공

### tmux 근거

- 균등화: `cmd-select-layout.c:103`, `layout.c:1162`
- 회전: `cmd-rotate-window.c:30`

### Shellhive 적용

1. `SplitNode` 순환 함수와 `renderSplitLayout()` 재사용 가능

---

## 5.6 P2: 레이아웃 직렬화 안정성 강화 (체크섬/검증)

### 제안

1. 현재 JSON 저장(`tabLayouts`)은 유지
2. 추가로 체크섬/검증 정보를 포함해 손상 복구 로직 추가

### tmux 근거

- `layout-custom.c:69`, `layout-custom.c:157`

---

## 6. 단계별 실행 로드맵 (실행 가능 수준)

## Phase A (1~1.5주): 오버레이 선택 + 균등화

1. Pane 번호 오버레이 렌더/입력 선택
2. display duration/colour 설정 옵션
3. 균등 분배 명령 추가

검증:

1. 키입력 선택 E2E
2. 2~9 pane에서 성능/가독성 확인

## Phase B (1.5~2주): break/join/move

1. pane 분리(새 탭 생성) 구현
2. pane 결합/이동 구현
3. 컨텍스트 메뉴 + 명령 팔레트 + 단축키 연결

검증:

1. source/target 동일 케이스 방어
2. split tree 무결성 테스트

## Phase C (1주): synchronize 입력

1. broadcast 모드 토글
2. 시각적 경고(헤더/툴바/토스트)
3. 대상 범위 옵션(모든 pane, 같은 프로젝트 pane)

검증:

1. 단일 입력 fan-out 정확성
2. 실수 방지 UX(토글 상태 표시) 확인

## Phase D (1주): 정책형 레이아웃 옵션

1. main pane size 옵션
2. tiled max columns 옵션
3. 프리셋 적용 파이프라인 통합

검증:

1. 설정 저장/복원
2. preset 적용 결과 스냅샷 테스트

---

## 7. 리스크와 대응

1. 리스크: 조작 모드 증가로 UI 복잡도 상승  
대응: 기본 모드는 단순 유지, 고급 기능은 Command Palette 중심 노출

2. 리스크: split tree 상태 불일치(특히 break/join/move)  
대응: 트리 조작 유닛테스트 + 시나리오 E2E 테스트 동시 강화

3. 리스크: 입력 브로드캐스트 오조작  
대응: 기본 OFF, 상태 색상 강조, 1회 확인 옵션 제공

---

## 8. 최종 권고

현재 Shellhive는 "분할 자체"는 이미 경쟁력 있다.  
다음 개발 사이클에서는 tmux의 핵심 강점인 "빠른 조작(오버레이/키맵) + 패널 이동성(break/join/move) + 운영 옵션화"를 우선 이식하는 것이 가장 높은 ROI를 낸다.

권장 착수 순서:

1. `display-panes`형 번호 오버레이
2. break/join/move-pane
3. synchronize-panes
4. main/tiled 정책 옵션

