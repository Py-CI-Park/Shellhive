export function createTabManagerController({
  state,
  SESSION_STATUS,
  SESSION_STATUS_LABELS,
  getSessionStatusClass,
  getSafeTabColor,
  ensureSplitPaneHeader,
  renderSplitMinimap,
  activateSession,
  createSession,
  clearPaneDropIndicators,
  TAB_COLORS,
  escapeHtml,
  escapeHtmlAttr,
  escapeDataAttr,
  debug
}) {
  function getStatusIcon(status) {
    switch (status) {
      case SESSION_STATUS.CONNECTING: return '●';
      case SESSION_STATUS.RUNNING: return '●';
      case SESSION_STATUS.EXITED: return '○';
      default: return '○';
    }
  }

  function getStatusLabel(status) {
    return SESSION_STATUS_LABELS[status] || '상태 미확인';
  }

  function getCompactPathLabel(pathValue) {
    if (!pathValue) return '로컬 셸';

    const normalized = String(pathValue).replace(/\//g, '\\');
    const parts = normalized.split('\\').filter(Boolean);
    if (parts.length <= 2) return normalized;
    return `...\\${parts.slice(-2).join('\\')}`;
  }

  function getSplitPaneSubtitle(session) {
    if (!session) return '상태 미확인';
    return `${getStatusLabel(session.status)} · ${getCompactPathLabel(session.projectPath)}`;
  }

  function updateTabStatus(sessionId, status) {
    const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!tab) return;

    const statusElement = tab.querySelector('.tab__status');
    const safeStatus = getSessionStatusClass(status);
    if (statusElement) {
      statusElement.textContent = getStatusIcon(safeStatus);
      statusElement.className = `tab__status tab__status--${safeStatus}`;
    }

    if (state.splitMode) {
      const session = state.sessions.get(sessionId);
      if (session) {
        ensureSplitPaneHeader(session);
      }
      renderSplitMinimap();
    }
  }

  function showTabSearch() {
    state.tabSearchVisible = true;

    let searchEl = document.getElementById('tabSearch');
    if (!searchEl) {
      searchEl = document.createElement('div');
      searchEl.id = 'tabSearch';
      searchEl.className = 'tab-search';
      searchEl.innerHTML = `
        <input type="text" class="tab-search__input" id="tabSearchInput" placeholder="Search tabs..." autocomplete="off">
        <div class="tab-search__results" id="tabSearchResults"></div>
      `;
      document.querySelector('.main').insertBefore(searchEl, document.querySelector('.tabs'));

      const input = document.getElementById('tabSearchInput');
      input.addEventListener('input', (e) => filterTabsByQuery(e.target.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          hideTabSearch();
        } else if (e.key === 'Enter') {
          const firstResult = document.querySelector('.tab-search__result');
          if (firstResult) {
            activateSession(firstResult.dataset.sessionId);
            hideTabSearch();
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const results = document.querySelectorAll('.tab-search__result');
          if (results.length > 0) {
            results[0].focus();
          }
        }
      });
    }

    searchEl.classList.add('tab-search--visible');
    const input = document.getElementById('tabSearchInput');
    input.focus();
    input.value = '';
    filterTabsByQuery('');

    debug('Tab search opened');
  }

  function hideTabSearch() {
    state.tabSearchVisible = false;
    const searchEl = document.getElementById('tabSearch');
    if (searchEl) {
      searchEl.classList.remove('tab-search--visible');
    }

    debug('Tab search closed');
  }

  function filterTabsByQuery(query) {
    const resultsEl = document.getElementById('tabSearchResults');
    if (!resultsEl) return;

    const lowerQuery = query.toLowerCase();
    const matches = [];

    state.sessions.forEach((session) => {
      if (!query || session.name.toLowerCase().includes(lowerQuery)) {
        matches.push(session);
      }
    });

    resultsEl.innerHTML = matches.map((session) => {
      const statusClass = getSessionStatusClass(session.status);
      const safeColor = getSafeTabColor(session.color);
      return `
      <div class="tab-search__result" data-session-id="${escapeDataAttr(session.id)}" tabindex="0">
        <span class="tab-search__result-status tab__status--${statusClass}">${getStatusIcon(statusClass)}</span>
        <span class="tab-search__result-name">${escapeHtml(session.name)}</span>
        ${session.pinned ? '<span class="tab-search__result-pin">📌</span>' : ''}
        ${safeColor ? `<span class="tab-search__result-color" style="background-color: ${escapeHtmlAttr(safeColor)}"></span>` : ''}
      </div>
    `;
    }).join('');

    resultsEl.querySelectorAll('.tab-search__result').forEach((result) => {
      result.addEventListener('click', () => {
        activateSession(result.dataset.sessionId);
        hideTabSearch();
      });

      result.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          activateSession(result.dataset.sessionId);
          hideTabSearch();
        } else if (e.key === 'Escape') {
          hideTabSearch();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const next = result.nextElementSibling;
          if (next) next.focus();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prev = result.previousElementSibling;
          if (prev) {
            prev.focus();
          } else {
            document.getElementById('tabSearchInput').focus();
          }
        }
      });
    });
  }

  function switchToNextTab() {
    const sessionIds = Array.from(state.sessions.keys());
    if (sessionIds.length === 0) return;
    const currentIndex = sessionIds.indexOf(state.activeSessionId);
    activateSession(sessionIds[(currentIndex + 1) % sessionIds.length]);
  }

  function switchToPreviousTab() {
    const sessionIds = Array.from(state.sessions.keys());
    if (sessionIds.length === 0) return;
    const currentIndex = sessionIds.indexOf(state.activeSessionId);
    activateSession(sessionIds[currentIndex === 0 ? sessionIds.length - 1 : currentIndex - 1]);
  }

  function switchToTabByIndex(index) {
    const sessionIds = Array.from(state.sessions.keys());
    if (index >= 0 && index < sessionIds.length) {
      activateSession(sessionIds[index]);
    }
  }

  function handleTabDragStart(e) {
    state.draggedTab = e.currentTarget;
    e.currentTarget.classList.add('tab--dragging');
    e.dataTransfer.effectAllowed = 'move';
    const sessionId = e.currentTarget.dataset.sessionId;
    if (sessionId) {
      e.dataTransfer.setData('text/plain', sessionId);
    }
  }

  function handleTabDragEnter(e) {
    if (e.currentTarget !== state.draggedTab) {
      e.currentTarget.classList.add('tab--drop-target');
    }
  }

  function handleTabDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleTabDragLeave(e) {
    e.currentTarget.classList.remove('tab--drop-target');
  }

  function handleTabDrop(e) {
    e.stopPropagation();
    const tabsList = document.getElementById('tabsList');
    if (!tabsList) return false;

    if (state.draggedTab !== e.currentTarget) {
      const allTabs = Array.from(tabsList.children);
      const draggedIndex = allTabs.indexOf(state.draggedTab);
      const targetIndex = allTabs.indexOf(e.currentTarget);
      if (draggedIndex < targetIndex) {
        tabsList.insertBefore(state.draggedTab, e.currentTarget.nextSibling);
      } else {
        tabsList.insertBefore(state.draggedTab, e.currentTarget);
      }
    }
    e.currentTarget.classList.remove('tab--drop-target');
    return false;
  }

  function handleTabDragEnd(e) {
    e.currentTarget.classList.remove('tab--dragging');
    document.querySelectorAll('.tab--drop-target').forEach(tab => {
      tab.classList.remove('tab--drop-target');
    });
    clearPaneDropIndicators();
    state.draggedTab = null;
  }

  function setTabColor(sessionId, color) {
    const session = state.sessions.get(sessionId);
    if (!session) return;

    const safeColor = getSafeTabColor(color);
    session.color = safeColor;

    const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (tab) {
      if (safeColor) {
        tab.style.borderTopColor = safeColor;
        tab.classList.add('tab--colored');
      } else {
        tab.style.borderTopColor = '';
        tab.classList.remove('tab--colored');
      }
    }

    debug('Tab color set:', sessionId, safeColor);
  }

  function showColorPickerMenu(e, sessionId, parentMenu) {
    const existingPicker = document.getElementById('colorPickerMenu');
    if (existingPicker) existingPicker.remove();

    const colorPicker = document.createElement('div');
    colorPicker.id = 'colorPickerMenu';
    colorPicker.className = 'context-menu context-menu--submenu';

    const parentRect = parentMenu.getBoundingClientRect();
    colorPicker.style.left = `${parentRect.right}px`;
    colorPicker.style.top = `${e.clientY}px`;

    const colorSwatches = TAB_COLORS.map(color => {
      if (color.value === null) {
        return `<div class="context-menu__item" data-color="null">
          <span class="context-menu__color-swatch context-menu__color-swatch--none"></span>
          <span>${escapeHtml(color.name)}</span>
        </div>`;
      }
      return `<div class="context-menu__item" data-color="${escapeDataAttr(color.value)}">
        <span class="context-menu__color-swatch" style="background-color: ${escapeHtmlAttr(color.value)}"></span>
        <span>${escapeHtml(color.name)}</span>
      </div>`;
    }).join('');

    colorPicker.innerHTML = colorSwatches;

    colorPicker.addEventListener('click', (event) => {
      const colorValue = event.target.closest('.context-menu__item')?.dataset.color;
      if (colorValue !== undefined) {
        setTabColor(sessionId, colorValue === 'null' ? null : colorValue);
        parentMenu.remove();
        colorPicker.remove();
      }
    });

    document.body.appendChild(colorPicker);

    setTimeout(() => {
      const closeColorPicker = (event) => {
        if (!colorPicker.contains(event.target) && !parentMenu.contains(event.target)) {
          colorPicker.remove();
          document.removeEventListener('click', closeColorPicker);
        }
      };
      document.addEventListener('click', closeColorPicker);
    }, 0);
  }

  function togglePinTab(sessionId) {
    const session = state.sessions.get(sessionId);
    if (!session) return;

    session.pinned = !session.pinned;

    const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (tab) {
      tab.classList.toggle('tab--pinned', session.pinned);
      if (session.pinned) {
        const tabsList = document.getElementById('tabsList');
        const firstUnpinnedTab = tabsList?.querySelector('.tab:not(.tab--pinned):not(.tab-group)');
        if (firstUnpinnedTab) {
          tabsList.insertBefore(tab, firstUnpinnedTab);
        }
      }
    }

    debug('Tab pinned state toggled:', sessionId, session.pinned);
  }

  function storeClosedTabInfo(session) {
    const closedTab = {
      name: session.name,
      projectId: session.projectId,
      projectPath: session.projectPath,
      projectName: session.projectName,
      closedAt: new Date()
    };

    state.closedTabs.unshift(closedTab);
    if (state.closedTabs.length > 10) {
      state.closedTabs.pop();
    }

    debug('Closed tab stored:', closedTab.name);
  }

  async function restoreLastClosedTab() {
    if (state.closedTabs.length === 0) {
      debug('No closed tabs to restore');
      return;
    }

    const closedTab = state.closedTabs.shift();
    if (closedTab.projectPath) {
      await createSession(closedTab.name, closedTab.projectPath, closedTab.projectId);
    } else {
      await createSession(closedTab.name);
    }

    debug('Restored tab:', closedTab.name);
  }

  return {
    getStatusIcon,
    getStatusLabel,
    getCompactPathLabel,
    getSplitPaneSubtitle,
    updateTabStatus,
    showTabSearch,
    hideTabSearch,
    filterTabsByQuery,
    switchToNextTab,
    switchToPreviousTab,
    switchToTabByIndex,
    handleTabDragStart,
    handleTabDragEnter,
    handleTabDragOver,
    handleTabDragLeave,
    handleTabDrop,
    handleTabDragEnd,
    setTabColor,
    showColorPickerMenu,
    togglePinTab,
    storeClosedTabInfo,
    restoreLastClosedTab
  };
}
