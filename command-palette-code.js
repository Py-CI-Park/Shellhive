// ===== Command Palette =====

// 커맨드 정의 (모든 앱 기능)
const COMMANDS = [
  { id: 'new-tab', name: '새 탭', shortcut: 'Ctrl+T', action: () => createSession() },
  { id: 'close-tab', name: '탭 닫기', shortcut: 'Ctrl+W', action: () => state.activeSessionId && closeSession(state.activeSessionId) },
  { id: 'restore-tab', name: '닫은 탭 복원', shortcut: 'Ctrl+Shift+T', action: () => restoreLastClosedTab() },
  { id: 'split-horizontal', name: '가로 분할', shortcut: 'Ctrl+Shift+D', action: () => splitHorizontal() },
  { id: 'split-vertical', name: '세로 분할', shortcut: 'Ctrl+Shift+E', action: () => splitVertical() },
  { id: 'toggle-maximize', name: '패널 최대화/복원', shortcut: 'Ctrl+Shift+M', action: () => toggleMaximize() },
  { id: 'search-terminal', name: '터미널 검색', shortcut: 'Ctrl+F', action: () => showTerminalSearch() },
  { id: 'search-tabs', name: '탭 검색', shortcut: 'Ctrl+Shift+F', action: () => showTabSearch() },
  { id: 'settings', name: '설정 열기', shortcut: 'Ctrl+,', action: () => showSettingsModal() },
  { id: 'add-project', name: '프로젝트 추가', shortcut: '', action: () => showAddProjectModal() },
  { id: 'add-snippet', name: '스니펫 추가', shortcut: '', action: () => showAddSnippetModal() },
  { id: 'toggle-recording', name: '녹화 시작/중지', shortcut: 'Ctrl+Shift+R', action: () => {
    if (recordingManager.isRecording()) {
      stopRecordingUI();
    } else {
      startRecordingUI();
    }
  }},
  { id: 'clear-screen', name: '화면 지우기', shortcut: 'Ctrl+L', action: () => clearTerminalScreen() },
  { id: 'clear-scrollback', name: '스크롤백 지우기', shortcut: 'Ctrl+K', action: () => clearTerminalScrollback() },
  { id: 'start-claude', name: 'Claude Code 시작', shortcut: 'Ctrl+Shift+C', action: () => startClaudeSession() },
  { id: 'fullscreen', name: '전체화면 전환', shortcut: 'F11', action: () => toggleFullscreen() },
  { id: 'next-tab', name: '다음 탭', shortcut: 'Ctrl+Tab', action: () => switchToNextTab() },
  { id: 'prev-tab', name: '이전 탭', shortcut: 'Ctrl+Shift+Tab', action: () => switchToPreviousTab() },
  { id: 'theme-dark', name: '테마: 다크', shortcut: '', action: () => changeTheme('dark') },
  { id: 'theme-light', name: '테마: 라이트', shortcut: '', action: () => changeTheme('light') },
  { id: 'theme-monokai', name: '테마: Monokai', shortcut: '', action: () => changeTheme('monokai') },
  { id: 'theme-high-contrast', name: '테마: 고대비', shortcut: '', action: () => changeTheme('high-contrast') },
];

// 최근 사용 명령어 추적
const recentCommands = [];
const MAX_RECENT_COMMANDS = 5;

// 커맨드 팔레트 상태
let commandPaletteState = {
  isVisible: false,
  selectedIndex: 0,
  filteredCommands: [...COMMANDS]
};

function showCommandPalette() {
  commandPaletteState.isVisible = true;
  commandPaletteState.selectedIndex = 0;

  // 최근 명령어를 먼저 표시
  const recentIds = new Set(recentCommands);
  const recentCmds = COMMANDS.filter(cmd => recentIds.has(cmd.id));
  const otherCmds = COMMANDS.filter(cmd => !recentIds.has(cmd.id));
  commandPaletteState.filteredCommands = [...recentCmds, ...otherCmds];

  renderCommandPalette();

  // 입력 필드에 포커스
  const input = document.querySelector('.command-palette__input');
  if (input) {
    input.focus();
  }
}

function hideCommandPalette() {
  commandPaletteState.isVisible = false;
  const palette = document.querySelector('.command-palette');
  if (palette) {
    palette.remove();
  }
}

function renderCommandPalette() {
  // 기존 팔레트 제거
  const existing = document.querySelector('.command-palette');
  if (existing) {
    existing.remove();
  }

  // 팔레트 생성
  const palette = document.createElement('div');
  palette.className = 'command-palette';
  palette.innerHTML = `
    <div class="command-palette__container">
      <input type="text" class="command-palette__input" placeholder="명령어 검색..." />
      <div class="command-palette__list" role="listbox"></div>
    </div>
  `;

  document.body.appendChild(palette);

  // 이벤트 리스너 설정
  const input = palette.querySelector('.command-palette__input');
  const list = palette.querySelector('.command-palette__list');

  input.addEventListener('input', (e) => {
    filterCommands(e.target.value);
  });

  input.addEventListener('keydown', (e) => {
    handleCommandPaletteKeydown(e);
  });

  // 오버레이 클릭시 닫기
  palette.addEventListener('click', (e) => {
    if (e.target === palette) {
      hideCommandPalette();
    }
  });

  // 명령어 목록 렌더링
  renderCommandList();
}

function renderCommandList() {
  const list = document.querySelector('.command-palette__list');
  if (!list) return;

  list.innerHTML = '';

  commandPaletteState.filteredCommands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = 'command-palette__item';
    if (index === commandPaletteState.selectedIndex) {
      item.classList.add('command-palette__item--selected');
    }

    // 최근 사용 명령어 표시
    const isRecent = recentCommands.includes(cmd.id);

    item.innerHTML = `
      <div class="command-palette__item-content">
        ${isRecent ? '<span class="command-palette__recent-badge">최근</span>' : ''}
        <span class="command-palette__item-name">${escapeHtml(cmd.name)}</span>
      </div>
      ${cmd.shortcut ? `<span class="command-palette__item-shortcut">${escapeHtml(cmd.shortcut)}</span>` : ''}
    `;

    item.addEventListener('click', () => {
      executeCommand(cmd);
    });

    item.addEventListener('mouseenter', () => {
      commandPaletteState.selectedIndex = index;
      renderCommandList();
    });

    list.appendChild(item);
  });

  // 선택된 항목이 보이도록 스크롤
  const selectedItem = list.querySelector('.command-palette__item--selected');
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'nearest' });
  }
}

function filterCommands(query) {
  if (!query.trim()) {
    // 검색어가 없으면 최근 명령어를 먼저 표시
    const recentIds = new Set(recentCommands);
    const recentCmds = COMMANDS.filter(cmd => recentIds.has(cmd.id));
    const otherCmds = COMMANDS.filter(cmd => !recentIds.has(cmd.id));
    commandPaletteState.filteredCommands = [...recentCmds, ...otherCmds];
  } else {
    // Fuzzy match: 검색어의 각 문자가 순서대로 포함되어 있는지 확인
    const lowerQuery = query.toLowerCase();
    commandPaletteState.filteredCommands = COMMANDS.filter(cmd => {
      const lowerName = cmd.name.toLowerCase();
      let queryIndex = 0;

      for (let i = 0; i < lowerName.length && queryIndex < lowerQuery.length; i++) {
        if (lowerName[i] === lowerQuery[queryIndex]) {
          queryIndex++;
        }
      }

      return queryIndex === lowerQuery.length;
    });
  }

  commandPaletteState.selectedIndex = 0;
  renderCommandList();
}

function handleCommandPaletteKeydown(e) {
  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      hideCommandPalette();
      break;

    case 'ArrowDown':
      e.preventDefault();
      commandPaletteState.selectedIndex =
        (commandPaletteState.selectedIndex + 1) % commandPaletteState.filteredCommands.length;
      renderCommandList();
      break;

    case 'ArrowUp':
      e.preventDefault();
      commandPaletteState.selectedIndex =
        (commandPaletteState.selectedIndex - 1 + commandPaletteState.filteredCommands.length)
        % commandPaletteState.filteredCommands.length;
      renderCommandList();
      break;

    case 'Enter':
      e.preventDefault();
      const selectedCmd = commandPaletteState.filteredCommands[commandPaletteState.selectedIndex];
      if (selectedCmd) {
        executeCommand(selectedCmd);
      }
      break;
  }
}

function executeCommand(cmd) {
  try {
    cmd.action();

    // 최근 사용 명령어에 추가
    const index = recentCommands.indexOf(cmd.id);
    if (index > -1) {
      recentCommands.splice(index, 1);
    }
    recentCommands.unshift(cmd.id);
    if (recentCommands.length > MAX_RECENT_COMMANDS) {
      recentCommands.pop();
    }

    hideCommandPalette();
  } catch (error) {
    debug('Command execution error:', error);
    showToast(`명령 실행 실패: ${error.message}`, 'error');
  }
}

function changeTheme(theme) {
  // 테마 변경 함수
  const root = document.documentElement;
  root.className = `theme-${theme}`;

  // 설정에 저장
  if (typeof settingsTheme !== 'undefined' && settingsTheme) {
    settingsTheme.value = theme;
  }

  showToast(`테마가 ${theme}로 변경되었습니다`, 'success');
}
