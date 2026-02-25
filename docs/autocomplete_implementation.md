# 자동완성/제안 기능 구현 문서

## 개요
Shellhive 터미널 앱에 실시간 명령어 자동완성 및 제안 기능을 구현했습니다.

## 구현 날짜
2026-02-03

## 주요 기능

### 1. 자동완성 데이터 소스
- **기본 명령어**: git, npm, docker, cargo, python 등 30+ 명령어
- **서브커맨드**: git (status, add, commit 등), npm (install, run 등)
- **히스토리 기반**: 사용자의 과거 명령어에서 제안
- **프로젝트별 필터링**: 현재 프로젝트 컨텍스트 반영

### 2. 자동완성 트리거
- **Tab 키**: 현재 입력에 대한 제안 표시 및 선택
- **실시간 입력**: 타이핑하면 자동으로 제안 업데이트
- **방향키**: ↑/↓로 제안 항목 선택
- **Escape**: 제안 팝업 닫기

### 3. 제안 우선순위
1. 즐겨찾기 명령어 (⭐)
2. 사용 빈도가 높은 명령어 (사용 횟수 표시)
3. 히스토리 매칭 (📜)
4. 기본 명령어 및 서브커맨드 (💡)

## 파일 변경 사항

### src/app.js

#### 1. Autocomplete 모듈 추가 (236-336번째 줄)
```javascript
const autocomplete = {
  baseCommands: [...],      // 기본 명령어 목록
  gitCommands: [...],       // git 서브커맨드
  npmCommands: [...],       // npm 서브커맨드
  dockerCommands: [...],    // docker 서브커맨드
  cargoCommands: [...],     // cargo 서브커맨드

  getSuggestions(input, projectId) {
    // 히스토리 + 기본 명령어 혼합 제안
    // 중복 제거 및 우선순위 정렬
  }
};
```

#### 2. State 확장 (530-535번째 줄)
```javascript
state = {
  ...
  autocompleteVisible: false,     // 팝업 표시 여부
  autocompleteQuery: '',          // 현재 쿼리
  autocompleteSelected: 0,        // 선택된 인덱스
  autocompleteSuggestions: [],    // 제안 목록
  currentLineBuffer: '',          // 현재 줄 버퍼
};
```

#### 3. Terminal onData 핸들러 수정 (1680-1738번째 줄)
- Tab 키로 제안 적용
- ↑/↓ 방향키로 선택 이동
- Escape로 팝업 닫기
- Enter 시 히스토리에 명령어 추가
- 실시간으로 currentLineBuffer 추적

#### 4. Autocomplete 함수 추가 (2730-2863번째 줄)
- `showAutocomplete(suggestions, sessionId)`: 팝업 표시
- `hideAutocomplete()`: 팝업 숨김
- `moveAutocompleteSelection(direction)`: 선택 이동
- `applyAutocompleteSuggestion(sessionId, index)`: 제안 적용
- `updateAutocomplete(input, sessionId)`: 제안 업데이트

### src/style.css

#### Autocomplete 팝업 스타일 추가 (2401-2509번째 줄)
```css
.autocomplete-popup {
  position: absolute;
  bottom: 100%;              /* 터미널 상단에 표시 */
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.autocomplete-popup__item {
  display: flex;
  padding: 8px 12px;
  cursor: pointer;
}

.autocomplete-popup__item--selected {
  background: var(--accent);  /* 선택된 항목 강조 */
  color: white;
}

.autocomplete-popup__command {
  flex: 1;
  font-family: 'Consolas', 'Monaco', monospace;
}

.autocomplete-popup__source {
  font-size: 14px;            /* 아이콘 (⭐📜💡) */
}

.autocomplete-popup__count {
  font-size: 11px;            /* 사용 횟수 표시 */
  background: rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}
```

#### 테마별 스타일
- **Dark 테마**: 기본 다크 배경
- **Light 테마**: 밝은 배경, 연한 그림자
- **Monokai 테마**: Monokai 색상 팔레트
- **High Contrast 테마**: 고대비, 굵은 테두리

## 사용 방법

### 기본 사용
1. 터미널에서 명령어 입력 시작
2. 자동으로 제안 팝업 표시
3. Tab 키로 선택된 제안 적용
4. ↑/↓ 방향키로 다른 제안 선택
5. Escape로 팝업 닫기

### 히스토리 기반 제안
- 자주 사용하는 명령어가 자동으로 상위에 표시
- 프로젝트별로 별도 히스토리 관리
- 즐겨찾기 명령어 우선 표시

### 서브커맨드 제안
```bash
git [Tab]     → git status, git add, git commit 등 제안
npm [Tab]     → npm install, npm run, npm test 등 제안
docker [Tab]  → docker run, docker build, docker ps 등 제안
cargo [Tab]   → cargo build, cargo run, cargo test 등 제안
```

## 기술적 세부사항

### 입력 추적 메커니즘
- `terminal.onData()` 이벤트에서 모든 키 입력 감지
- `currentLineBuffer`로 현재 줄 상태 추적
- Enter/Ctrl+C 시 버퍼 초기화
- Backspace 시 버퍼에서 문자 제거

### 제안 알고리즘
1. 히스토리에서 접두사 매칭 (최대 5개)
2. 첫 단어가 기본 명령어와 매칭되면 추가
3. 두 번째 단어부터는 서브커맨드 매칭
4. 중복 제거 (히스토리 우선)
5. 우선순위 정렬: 즐겨찾기 > 사용 빈도 > 알파벳순

### 성능 최적화
- 최대 10개 제안만 표시
- 빈 입력 시 즉시 팝업 숨김
- 제안이 없으면 팝업 표시 안 함

## 향후 개선 가능 사항

### 1. 파일 경로 자동완성
- 현재 디렉토리 파일/폴더 제안
- Tab 키로 경로 탐색

### 2. 옵션 플래그 제안
- git commit -m, npm install --save-dev 등
- 명령어별 옵션 데이터베이스

### 3. AI 기반 제안
- 자연어 패턴 학습
- 컨텍스트 인식 제안

### 4. 원격 제안
- SSH 호스트 자동완성
- Git 리모트 브랜치 제안

## 테스트 시나리오

### 시나리오 1: 기본 명령어 제안
1. 터미널에서 "gi" 입력
2. "git" 제안 표시 확인
3. Tab 키로 적용 확인

### 시나리오 2: 히스토리 제안
1. "git status" 명령어 실행 (3회 이상)
2. 다음 세션에서 "git" 입력
3. "git status"가 상위에 표시되는지 확인

### 시나리오 3: 서브커맨드 제안
1. "git st" 입력
2. "git status", "git stash" 제안 확인
3. 방향키로 선택 이동 확인

### 시나리오 4: 프로젝트별 히스토리
1. 프로젝트 A에서 "npm run dev" 실행
2. 프로젝트 B에서 "npm" 입력
3. 프로젝트 A의 히스토리가 표시되지 않는지 확인

## 관련 이슈
- Phase 4.2: 자동완성/제안 기능 구현

## 작성자
Claude Code (Sisyphus-Junior Agent)

## 참고
- Command History Manager: src/app.js 133-236번째 줄
- Terminal Themes: src/app.js 265-359번째 줄
- History Panel: index.html 94-116번째 줄
