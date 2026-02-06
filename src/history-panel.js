// ===== Command History Panel =====
// 명령어 히스토리 검색 UI 모듈

let historyPanelState = {
  selectedIndex: 0,
  filteredItems: [],
  filterMode: 'all' // 'all' or 'favorites'
};
let historyPanelToast = null;

// Create history panel UI
export function createHistoryPanel(commandHistory, state, showToast, escapeHtml) {
  historyPanelToast = showToast;

  const panel = document.createElement('div');
  panel.id = 'historyPanel';
  panel.className = 'history-panel';
  panel.innerHTML = `
    <div class="history-panel__container">
      <div class="history-panel__header">
        <h3 class="history-panel__title">명령어 히스토리</h3>
        <button class="history-panel__close" title="닫기">&times;</button>
      </div>
      <input
        type="text"
        class="history-panel__search"
        placeholder="명령어 검색... (Ctrl+R)"
        autocomplete="off"
      />
      <div class="history-panel__filters">
        <button class="history-panel__filter history-panel__filter--active" data-filter="all">
          전체
        </button>
        <button class="history-panel__filter" data-filter="favorites">
          즐겨찾기
        </button>
      </div>
      <div class="history-panel__list"></div>
      <div class="history-panel__footer">
        <span class="history-panel__count">0개 항목</span>
        <div class="history-panel__shortcuts">
          <kbd>↑↓</kbd> 이동
          <kbd>Enter</kbd> 실행
          <kbd>Esc</kbd> 닫기
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  // Event listeners
  const closeBtn = panel.querySelector('.history-panel__close');
  const searchInput = panel.querySelector('.history-panel__search');
  const filterBtns = panel.querySelectorAll('.history-panel__filter');

  closeBtn.addEventListener('click', () => hideHistoryPanel());
  searchInput.addEventListener('input', (e) => handleHistorySearch(e, commandHistory, state, escapeHtml));

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('history-panel__filter--active'));
      btn.classList.add('history-panel__filter--active');
      historyPanelState.filterMode = btn.dataset.filter;
      updateHistoryList(searchInput.value, commandHistory, state, escapeHtml);
    });
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', (e) => handleHistoryKeydown(e, commandHistory, state));

  // Click outside to close
  panel.addEventListener('click', (e) => {
    if (e.target === panel) {
      hideHistoryPanel();
    }
  });

  return panel;
}

// Show history panel
export function showHistoryPanel(commandHistory, state, escapeHtml) {
  let panel = document.getElementById('historyPanel');

  if (!panel) {
    // Panel이 없으면 app.js에서 먼저 createHistoryPanel을 호출해야 함
    console.error('History panel not created. Call createHistoryPanel first.');
    return;
  }

  historyPanelState.selectedIndex = 0;
  historyPanelState.filterMode = 'all';

  // Reset filters
  const filterBtns = panel.querySelectorAll('.history-panel__filter');
  filterBtns.forEach(btn => {
    if (btn.dataset.filter === 'all') {
      btn.classList.add('history-panel__filter--active');
    } else {
      btn.classList.remove('history-panel__filter--active');
    }
  });

  // Update list
  updateHistoryList('', commandHistory, state, escapeHtml);

  // Show panel
  panel.classList.add('history-panel--visible');

  // Focus search input
  const searchInput = panel.querySelector('.history-panel__search');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
}

// Hide history panel
export function hideHistoryPanel() {
  const panel = document.getElementById('historyPanel');
  if (panel) {
    panel.classList.remove('history-panel--visible');
  }
}

// Handle history search input
function handleHistorySearch(e, commandHistory, state, escapeHtml) {
  updateHistoryList(e.target.value, commandHistory, state, escapeHtml);
}

// Update history list
function updateHistoryList(query = '', commandHistory, state, escapeHtml) {
  const panel = document.getElementById('historyPanel');
  if (!panel) return;

  const listEl = panel.querySelector('.history-panel__list');
  const countEl = panel.querySelector('.history-panel__count');

  // Get filtered items
  let items = [];
  const currentProjectId = state.activeSessionId ?
    state.sessions.get(state.activeSessionId)?.projectId : null;

  if (historyPanelState.filterMode === 'favorites') {
    items = commandHistory.getFavorites(currentProjectId);
  } else {
    items = commandHistory.history.filter(h => {
      const matchesProject = currentProjectId === null || h.projectId === currentProjectId;
      return matchesProject;
    });
  }

  // Apply search filter
  if (query.trim()) {
    const lowerQuery = query.toLowerCase();
    items = items.filter(h => h.command.toLowerCase().includes(lowerQuery));
  }

  historyPanelState.filteredItems = items;
  historyPanelState.selectedIndex = 0;

  // Update count
  countEl.textContent = `${items.length}개 항목`;

  // Render list
  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="history-panel__empty">
        <div class="history-panel__empty-icon">🔍</div>
        <p>${query.trim() ? '검색 결과가 없습니다' : '명령어 히스토리가 비어있습니다'}</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = items.map((item, index) => `
    <div class="history-item ${index === 0 ? 'history-item--selected' : ''}"
         data-index="${index}"
         data-command="${escapeHtml(item.command)}"
         data-project-id="${item.projectId || ''}">
      <div class="history-item__command">${escapeHtml(item.command)}</div>
      <div class="history-item__meta">
        <span class="history-item__time">${formatRelativeTime(item.timestamp)}</span>
        ${item.projectId ? `<span class="history-item__project">${getProjectName(item.projectId, state)}</span>` : ''}
        ${item.useCount > 1 ? `<span class="history-item__count">×${item.useCount}</span>` : ''}
      </div>
      <button class="history-item__favorite ${item.favorite ? 'history-item__favorite--active' : ''}"
              title="즐겨찾기">
        ${item.favorite ? '★' : '☆'}
      </button>
      <button class="history-item__run" title="실행">▶</button>
      <button class="history-item__delete" title="삭제">×</button>
    </div>
  `).join('');

  // Add event listeners to items
  listEl.querySelectorAll('.history-item').forEach((el, index) => {
    el.addEventListener('click', (e) => {
      if (!e.target.closest('.history-item__favorite') &&
          !e.target.closest('.history-item__delete') &&
          !e.target.closest('.history-item__run')) {
        selectHistoryItem(index);
      }
    });

    el.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.history-item__favorite') &&
          !e.target.closest('.history-item__delete')) {
        executeHistoryItem(index, state);
      }
    });
  });

  // Favorite buttons
  listEl.querySelectorAll('.history-item__favorite').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHistoryFavorite(index, commandHistory, escapeHtml, state);
    });
  });

  // Run buttons
  listEl.querySelectorAll('.history-item__run').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      executeHistoryItem(index, state);
    });
  });

  // Delete buttons
  listEl.querySelectorAll('.history-item__delete').forEach((btn, index) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryItem(index, commandHistory, escapeHtml, state);
    });
  });
}

// Handle keyboard navigation in history panel
function handleHistoryKeydown(e, commandHistory, state) {
  if (e.key === 'Escape') {
    e.preventDefault();
    hideHistoryPanel();
    return;
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectHistoryItem(historyPanelState.selectedIndex + 1);
    return;
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectHistoryItem(historyPanelState.selectedIndex - 1);
    return;
  }

  if (e.key === 'Enter') {
    e.preventDefault();
    executeHistoryItem(historyPanelState.selectedIndex, state);
    return;
  }
}

// Select history item by index
function selectHistoryItem(index) {
  const items = historyPanelState.filteredItems;
  if (items.length === 0) return;

  // Wrap around
  if (index < 0) index = items.length - 1;
  if (index >= items.length) index = 0;

  historyPanelState.selectedIndex = index;

  // Update UI
  const listEl = document.querySelector('.history-panel__list');
  if (!listEl) return;

  const itemEls = listEl.querySelectorAll('.history-item');
  itemEls.forEach((el, i) => {
    if (i === index) {
      el.classList.add('history-item--selected');
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      el.classList.remove('history-item--selected');
    }
  });
}

// Execute history item
function executeHistoryItem(index, state) {
  const items = historyPanelState.filteredItems;
  if (index < 0 || index >= items.length) return;

  const item = items[index];

  // Send command to active terminal
  if (state.activeSessionId) {
    const session = state.sessions.get(state.activeSessionId);
    if (session && session.terminal) {
      // Type command into terminal
      session.terminal.paste(item.command);

      // Optionally auto-execute (send Enter)
      // session.terminal.paste('\n');

      hideHistoryPanel();
      session.terminal.focus();
    }
  }
}

// Toggle history item favorite
function toggleHistoryFavorite(index, commandHistory, escapeHtml, state) {
  const items = historyPanelState.filteredItems;
  if (index < 0 || index >= items.length) return;

  const item = items[index];
  commandHistory.toggleFavorite(item.command, item.projectId);

  // Refresh list
  const searchInput = document.querySelector('.history-panel__search');
  updateHistoryList(searchInput ? searchInput.value : '', commandHistory, state, escapeHtml);
}

// Delete history item
function deleteHistoryItem(index, commandHistory, escapeHtml, state) {
  const items = historyPanelState.filteredItems;
  if (index < 0 || index >= items.length) return;

  const item = items[index];
  commandHistory.delete(item.command, item.projectId);

  // Refresh list
  const searchInput = document.querySelector('.history-panel__search');
  updateHistoryList(searchInput ? searchInput.value : '', commandHistory, state, escapeHtml);

  if (typeof historyPanelToast === 'function') {
    historyPanelToast('명령어를 삭제했습니다', 'success');
  }
}

// Format relative time (5분 전, 1시간 전, etc.)
function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  // Format as date if older than 7 days
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

// Get project name by ID
function getProjectName(projectId, state) {
  const project = state.projects.find(p => p.id === projectId);
  return project ? project.name : 'Unknown';
}
