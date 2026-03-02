export function createShortcutsController({
  escapeHtml,
  showToast,
  debug,
  actions
}) {
  const COMMANDS = [
    { id: 'new-tab', name: '새 탭', shortcut: 'Ctrl+T', action: () => actions.createSession() },
    { id: 'close-tab', name: '탭 닫기', shortcut: 'Ctrl+W', action: () => actions.closeActiveSession() },
    { id: 'restore-tab', name: '닫은 탭 복원', shortcut: 'Ctrl+Shift+T', action: () => actions.restoreLastClosedTab() },
    { id: 'split-default', name: '기본 분할 (오른쪽)', shortcut: 'Ctrl+\\', action: () => actions.splitDefault() },
    { id: 'split-horizontal', name: '아래로 분할', shortcut: 'Ctrl+Shift+D', action: () => actions.splitHorizontal() },
    { id: 'split-vertical', name: '오른쪽 분할', shortcut: 'Ctrl+Shift+E', action: () => actions.splitVertical() },
    { id: 'layout-preset-selector', name: '레이아웃 선택기 열기', shortcut: 'Ctrl+Shift+S', action: () => actions.focusLayoutPresetSelector() },
    {
      id: 'layout-gallery',
      name: '레이아웃 갤러리 열기',
      shortcut: 'Ctrl+Shift+L',
      action: () => actions.openLayoutGalleryModal(actions.getLayoutPresetValue())
    },
    { id: 'merge-pane', name: '활성 창 합치기', shortcut: 'Ctrl+Shift+J', action: () => actions.mergePane() },
    { id: 'toggle-maximize', name: '패널 최대화/복원', shortcut: 'Ctrl+Shift+M', action: () => actions.toggleMaximize() },
    { id: 'search-terminal', name: '터미널 검색', shortcut: 'Ctrl+F', action: () => actions.showTerminalSearch() },
    { id: 'search-tabs', name: '탭 검색', shortcut: 'Ctrl+Shift+F', action: () => actions.showTabSearch() },
    { id: 'settings', name: '설정 열기', shortcut: 'Ctrl+,', action: () => actions.showSettingsModal() },
    { id: 'add-project', name: '프로젝트 추가', shortcut: '', action: () => actions.showAddProjectModal() },
    { id: 'add-snippet', name: '스니펫 추가', shortcut: '', action: () => actions.showAddSnippetModal() },
    { id: 'toggle-recording', name: '녹화 시작/중지', shortcut: 'Ctrl+Shift+R', action: () => actions.toggleRecording() },
    { id: 'clear-screen', name: '화면 지우기', shortcut: 'Ctrl+L', action: () => actions.clearTerminalScreen() },
    { id: 'clear-scrollback', name: '스크롤백 지우기', shortcut: 'Ctrl+K', action: () => actions.clearTerminalScrollback() },
    { id: 'fullscreen', name: '전체화면 전환', shortcut: 'F11', action: () => actions.toggleFullscreen() },
    { id: 'history', name: '명령어 히스토리', shortcut: 'Ctrl+R', action: () => actions.showHistoryPanel() },
    { id: 'git-panel', name: 'Git 패널 토글', shortcut: 'Ctrl+G', action: () => actions.toggleGitPanel() },
    { id: 'next-tab', name: '다음 탭', shortcut: 'Ctrl+Tab', action: () => actions.switchToNextTab() },
    { id: 'prev-tab', name: '이전 탭', shortcut: 'Ctrl+Shift+Tab', action: () => actions.switchToPreviousTab() },
    { id: 'theme-dark', name: '테마: 다크', shortcut: '', action: () => actions.changeTheme('dark') },
    { id: 'theme-light', name: '테마: 라이트', shortcut: '', action: () => actions.changeTheme('light') },
    { id: 'theme-monokai', name: '테마: Monokai', shortcut: '', action: () => actions.changeTheme('monokai') },
    { id: 'theme-high-contrast', name: '테마: 고대비', shortcut: '', action: () => actions.changeTheme('high-contrast') }
  ];

  const recentCommands = [];
  const MAX_RECENT_COMMANDS = 5;

  const commandPaletteState = {
    isVisible: false,
    selectedIndex: 0,
    filteredCommands: [...COMMANDS]
  };

  function showCommandPalette() {
    commandPaletteState.isVisible = true;
    commandPaletteState.selectedIndex = 0;

    const recentIds = new Set(recentCommands);
    const recentCmds = COMMANDS.filter(cmd => recentIds.has(cmd.id));
    const otherCmds = COMMANDS.filter(cmd => !recentIds.has(cmd.id));
    commandPaletteState.filteredCommands = [...recentCmds, ...otherCmds];

    renderCommandPalette();

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
    const existing = document.querySelector('.command-palette');
    if (existing) {
      existing.remove();
    }

    const palette = document.createElement('div');
    palette.className = 'command-palette';
    palette.innerHTML = `
      <div class="command-palette__container">
        <input type="text" class="command-palette__input" placeholder="명령어 검색..." />
        <div class="command-palette__list" role="listbox"></div>
      </div>
    `;

    document.body.appendChild(palette);

    const input = palette.querySelector('.command-palette__input');

    input.addEventListener('input', (e) => {
      filterCommands(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
      handleCommandPaletteKeydown(e);
    });

    palette.addEventListener('click', (e) => {
      if (e.target === palette) {
        hideCommandPalette();
      }
    });

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

    const selectedItem = list.querySelector('.command-palette__item--selected');
    if (selectedItem && typeof selectedItem.scrollIntoView === 'function') {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }

  function filterCommands(query) {
    if (!query.trim()) {
      const recentIds = new Set(recentCommands);
      const recentCmds = COMMANDS.filter(cmd => recentIds.has(cmd.id));
      const otherCmds = COMMANDS.filter(cmd => !recentIds.has(cmd.id));
      commandPaletteState.filteredCommands = [...recentCmds, ...otherCmds];
    } else {
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
        if (commandPaletteState.filteredCommands.length === 0) {
          return;
        }
        commandPaletteState.selectedIndex =
          (commandPaletteState.selectedIndex + 1) % commandPaletteState.filteredCommands.length;
        renderCommandList();
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (commandPaletteState.filteredCommands.length === 0) {
          return;
        }
        commandPaletteState.selectedIndex =
          (commandPaletteState.selectedIndex - 1 + commandPaletteState.filteredCommands.length)
          % commandPaletteState.filteredCommands.length;
        renderCommandList();
        break;

      case 'Enter':
        e.preventDefault();
        {
          const selectedCmd = commandPaletteState.filteredCommands[commandPaletteState.selectedIndex];
          if (selectedCmd) {
            executeCommand(selectedCmd);
          }
        }
        break;
    }
  }

  function executeCommand(cmd) {
    try {
      cmd.action();

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

  function handleKeyboardShortcuts(e) {
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyP') {
      e.preventDefault();
      showCommandPalette();
      return;
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      actions.showTerminalSearch();
      return;
    }
    if (e.ctrlKey && e.key === 't') {
      e.preventDefault();
      actions.createSession();
      return;
    }
    if (e.ctrlKey && e.key === 'w') {
      e.preventDefault();
      actions.closeActiveSession();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyT') {
      e.preventDefault();
      actions.restoreLastClosedTab();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyF') {
      e.preventDefault();
      actions.showTabSearch();
      return;
    }
    if (e.ctrlKey && !e.shiftKey && e.code === 'Backslash') {
      e.preventDefault();
      actions.splitDefault();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyS') {
      e.preventDefault();
      actions.focusLayoutPresetSelector();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') {
      e.preventDefault();
      actions.openLayoutGalleryModal(actions.getLayoutPresetValue());
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
      e.preventDefault();
      actions.splitHorizontal();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyE') {
      e.preventDefault();
      actions.splitVertical();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyJ') {
      e.preventDefault();
      actions.mergePane();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyR') {
      e.preventDefault();
      actions.toggleRecording();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyM') {
      e.preventDefault();
      actions.toggleMaximize();
      return;
    }
    if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      actions.switchToNextTab();
      return;
    }
    if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      actions.switchToPreviousTab();
      return;
    }
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      actions.switchToTabByIndex(parseInt(e.key, 10) - 1);
      return;
    }
    if (e.ctrlKey && e.key === ',') {
      e.preventDefault();
      actions.showSettingsModal();
      return;
    }
    if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      actions.clearTerminalScreen();
      return;
    }
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      actions.clearTerminalScrollback();
      return;
    }
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault();
      actions.showHistoryPanel();
      return;
    }
    if (e.ctrlKey && e.key === 'g') {
      e.preventDefault();
      actions.toggleGitPanel();
      return;
    }
    if (e.key === 'F11') {
      e.preventDefault();
      actions.toggleFullscreen();
      return;
    }

    if (e.ctrlKey && e.altKey) {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          actions.focusPaneByDirection('left');
          return;
        case 'ArrowRight':
          e.preventDefault();
          actions.focusPaneByDirection('right');
          return;
        case 'ArrowUp':
          e.preventDefault();
          actions.focusPaneByDirection('up');
          return;
        case 'ArrowDown':
          e.preventDefault();
          actions.focusPaneByDirection('down');
          return;
      }
    }
  }

  return {
    showCommandPalette,
    hideCommandPalette,
    handleKeyboardShortcuts
  };
}
