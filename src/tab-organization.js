export function createTabOrganizationController({
  state,
  TabGroup,
  getSafeTabColor,
  getSessionStatusClass,
  getStatusIcon,
  escapeHtml,
  escapeHtmlAttr,
  escapeDataAttr,
  activateSession,
  closeSession,
  startTabRename,
  showTabContextMenu,
  handleTabDragStart,
  handleTabDragEnter,
  handleTabDragOver,
  handleTabDragLeave,
  handleTabDrop,
  handleTabDragEnd
}) {
  function createTabGroup(name, tabIds = [], options = {}) {
    const id = `group-${++state.groupCounter}`;
    const group = new TabGroup(id, name, options);

    tabIds.forEach((sessionId) => {
      group.addTab(sessionId);
      state.tabToGroup.set(sessionId, id);
    });

    state.tabGroups.set(id, group);
    renderTabGroups();
    return group;
  }

  function addTabToGroup(sessionId, groupId) {
    const currentGroupId = state.tabToGroup.get(sessionId);
    if (currentGroupId) {
      removeTabFromGroup(sessionId, false);
    }

    const group = state.tabGroups.get(groupId);
    if (!group) return;

    group.addTab(sessionId);
    state.tabToGroup.set(sessionId, groupId);
    renderTabGroups();
  }

  function removeTabFromGroup(sessionId, rerender = true) {
    const groupId = state.tabToGroup.get(sessionId);
    if (!groupId) return;

    const group = state.tabGroups.get(groupId);
    if (group) {
      group.removeTab(sessionId);
      state.tabToGroup.delete(sessionId);

      if (group.isEmpty() && group.isAutoGroup) {
        state.tabGroups.delete(groupId);
      }
    }

    if (rerender) {
      renderTabGroups();
    }
  }

  function toggleGroupCollapse(groupId) {
    const group = state.tabGroups.get(groupId);
    if (!group) return;

    group.collapsed = !group.collapsed;
    renderTabGroups();
  }

  function autoGroupSessionByProject(sessionId, projectId, projectName) {
    if (!state.autoGroupByProject || !projectId) return;

    let existingGroupId = null;
    state.tabGroups.forEach((group, id) => {
      if (group.projectId === projectId) {
        existingGroupId = id;
      }
    });

    if (existingGroupId) {
      addTabToGroup(sessionId, existingGroupId);
      return;
    }

    createTabGroup(projectName || 'Project', [sessionId], {
      projectId,
      isAutoGroup: true,
      color: getProjectColor(projectId)
    });
  }

  function getProjectColor(projectId) {
    const colors = ['#0e639c', '#6a9955', '#ce9178', '#dcdcaa', '#9cdcfe', '#c586c0', '#4ec9b0'];
    const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  function renderTabGroups() {
    const tabsList = document.getElementById('tabsList');
    if (!tabsList) return;

    tabsList.innerHTML = '';

    const groupedSessionIds = new Set(state.tabToGroup.keys());
    const ungroupedSessions = [];

    state.sessions.forEach((session, sessionId) => {
      if (!groupedSessionIds.has(sessionId)) {
        ungroupedSessions.push(session);
      }
    });

    const pinnedSessions = ungroupedSessions.filter((session) => session.pinned);
    const unpinnedSessions = ungroupedSessions.filter((session) => !session.pinned);

    state.tabGroups.forEach((group) => {
      const groupElement = createGroupElement(group);
      tabsList.appendChild(groupElement);
    });

    pinnedSessions.forEach((session) => {
      const tab = createTabElement(session);
      tabsList.appendChild(tab);
    });

    unpinnedSessions.forEach((session) => {
      const tab = createTabElement(session);
      tabsList.appendChild(tab);
    });

    renderFilteredTabs();
  }

  function createGroupElement(group) {
    const groupEl = document.createElement('div');
    groupEl.className = `tab-group ${group.collapsed ? 'tab-group--collapsed' : ''}`;
    groupEl.dataset.groupId = group.id;

    const header = document.createElement('div');
    header.className = 'tab-group__header';
    header.style.borderLeftColor = getSafeTabColor(group.color) || '#0e639c';
    header.innerHTML = `
      <span class="tab-group__collapse">${group.collapsed ? '▶' : '▼'}</span>
      <span class="tab-group__name">${escapeHtml(group.name)}</span>
      <span class="tab-group__count">${group.size}</span>
    `;

    header.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleGroupCollapse(group.id);
    });

    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'tab-group__tabs';

    if (!group.collapsed) {
      group.tabIds.forEach((sessionId) => {
        const session = state.sessions.get(sessionId);
        if (!session) return;
        const tab = createTabElement(session, true);
        tabsContainer.appendChild(tab);
      });
    }

    groupEl.appendChild(header);
    groupEl.appendChild(tabsContainer);

    return groupEl;
  }

  function createTabElement(session, isGrouped = false) {
    const tab = document.createElement('div');
    tab.className = `tab ${isGrouped ? 'tab--grouped' : ''}`;
    tab.dataset.sessionId = session.id;
    tab.draggable = true;

    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', session.id === state.activeSessionId ? 'true' : 'false');
    tab.setAttribute('tabindex', session.id === state.activeSessionId ? '0' : '-1');

    if (session.id === state.activeSessionId) {
      tab.classList.add('tab--active');
    }

    if (session.pinned) {
      tab.classList.add('tab--pinned');
    }

    const safeColor = getSafeTabColor(session.color);
    if (safeColor) {
      tab.style.borderTopColor = safeColor;
      tab.classList.add('tab--colored');
    }

    const statusClass = getSessionStatusClass(session.status);
    const statusIcon = getStatusIcon(statusClass);
    tab.innerHTML = `
      <span class="tab__status tab__status--${statusClass}">${statusIcon}</span>
      <span class="tab__title">${escapeHtml(session.name)}</span>
      <button class="tab__close">&times;</button>
    `;

    tab.addEventListener('click', (event) => {
      if (!event.target.classList.contains('tab__close')) {
        activateSession(session.id);
      }
    });

    tab.addEventListener('dblclick', (event) => {
      if (!event.target.classList.contains('tab__close')) {
        event.preventDefault();
        startTabRename(session.id);
      }
    });

    const closeButton = tab.querySelector('.tab__close');
    closeButton.setAttribute('aria-label', `${session.name} 탭 닫기`);
    closeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      closeSession(session.id);
    });

    tab.addEventListener('dragstart', handleTabDragStart);
    tab.addEventListener('dragenter', handleTabDragEnter);
    tab.addEventListener('dragover', handleTabDragOver);
    tab.addEventListener('dragleave', handleTabDragLeave);
    tab.addEventListener('drop', handleTabDrop);
    tab.addEventListener('dragend', handleTabDragEnd);

    tab.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      showTabContextMenu(event, session.id);
    });

    return tab;
  }

  function setProjectFilter(projectId) {
    state.activeProjectFilter = projectId;
    renderFilteredTabs();
    updateFilterIndicator();
    updateProjectFilterButtons();
  }

  function clearProjectFilter() {
    state.activeProjectFilter = null;
    renderFilteredTabs();
    updateFilterIndicator();
    updateProjectFilterButtons();
  }

  function renderFilteredTabs() {
    const tabs = document.querySelectorAll('.tab');
    const groups = document.querySelectorAll('.tab-group');

    tabs.forEach((tab) => {
      const sessionId = tab.dataset.sessionId;
      const session = state.sessions.get(sessionId);
      if (!state.activeProjectFilter) {
        tab.style.display = '';
      } else if (session && session.projectId === state.activeProjectFilter) {
        tab.style.display = '';
      } else {
        tab.style.display = 'none';
      }
    });

    groups.forEach((groupEl) => {
      const groupId = groupEl.dataset.groupId;
      const group = state.tabGroups.get(groupId);
      if (!group) return;

      if (!state.activeProjectFilter) {
        groupEl.style.display = '';
      } else if (group.projectId === state.activeProjectFilter) {
        groupEl.style.display = '';
      } else {
        groupEl.style.display = 'none';
      }
    });
  }

  function linkSessionToProject(sessionId, projectId) {
    if (!projectId) return;
    if (!state.projectTabMap.has(projectId)) {
      state.projectTabMap.set(projectId, new Set());
    }

    state.projectTabMap.get(projectId).add(sessionId);
    updateProjectTabCount(projectId);
    renderProjectCmdTrees();
  }

  function unlinkSessionFromProject(sessionId) {
    const session = state.sessions.get(sessionId);
    if (session && session.projectId) {
      const projectId = session.projectId;
      const tabSet = state.projectTabMap.get(projectId);
      if (tabSet) {
        tabSet.delete(sessionId);
        updateProjectTabCount(projectId);
      }
    }
    renderProjectCmdTrees();
  }

  function updateProjectTabCount(projectId) {
    const projectItem = document.querySelector(`[data-project-id="${projectId}"]`);
    if (!projectItem) return;

    const tabSet = state.projectTabMap.get(projectId);
    const count = tabSet ? tabSet.size : 0;

    let badge = projectItem.querySelector('.sidebar__item-tab-count');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'sidebar__item-tab-count';
        projectItem.insertBefore(badge, projectItem.querySelector('.sidebar__item-filter'));
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  }

  function updateFilterIndicator() {
    let indicator = document.querySelector('.tabs__filter-indicator');
    if (state.activeProjectFilter) {
      const projectItem = document.querySelector(`[data-project-id="${state.activeProjectFilter}"]`);
      const projectName = projectItem
        ? projectItem.querySelector('.sidebar__item-name').textContent
        : 'Project';

      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'tabs__filter-indicator';
        indicator.innerHTML = `
          <span class="tabs__filter-text">Filtered: <strong></strong></span>
          <button class="tabs__filter-clear" aria-label="필터 해제">&times;</button>
        `;
        indicator.querySelector('.tabs__filter-clear').addEventListener('click', clearProjectFilter);
        const tabsContainer = document.getElementById('tabsContainer');
        tabsContainer.insertBefore(indicator, tabsContainer.firstChild);
      }

      indicator.querySelector('strong').textContent = projectName;
    } else if (indicator) {
      indicator.remove();
    }
  }

  function updateProjectFilterButtons() {
    document.querySelectorAll('.sidebar__item-filter').forEach((button) => {
      const projectId = button.dataset.projectId;
      if (state.activeProjectFilter === projectId) {
        button.classList.add('sidebar__item-filter--active');
      } else {
        button.classList.remove('sidebar__item-filter--active');
      }
    });
  }

  function renderProjectCmdTrees() {
    document.querySelectorAll('[data-project-cmd-tree]').forEach((treeEl) => {
      const projectId = treeEl.dataset.projectCmdTree;
      const sessionSet = state.projectTabMap.get(projectId);
      const sessionIds = sessionSet ? Array.from(sessionSet) : [];
      const sessions = sessionIds
        .map((sessionId) => state.sessions.get(sessionId))
        .filter(Boolean);

      if (sessions.length === 0) {
        treeEl.innerHTML = '';
        treeEl.classList.remove('sidebar__cmd-tree--visible');
        return;
      }

      const cmdItems = sessions.map((session) => {
        const activeClass = session.id === state.activeSessionId ? ' sidebar__cmd-item--active' : '';
        const statusClass = `sidebar__cmd-status--${getSessionStatusClass(session.status)}`;
        const sessionIdAttr = escapeDataAttr(session.id);
        return `
          <div class="sidebar__cmd-item${activeClass}" data-session-id="${sessionIdAttr}" title="${escapeHtmlAttr(session.name)}">
            <span class="sidebar__cmd-status ${statusClass}">${getStatusIcon(getSessionStatusClass(session.status))}</span>
            <span class="sidebar__cmd-name">${escapeHtml(session.name)}</span>
            <button class="sidebar__cmd-close" data-session-id="${sessionIdAttr}" aria-label="세션 닫기">&times;</button>
          </div>
        `;
      }).join('');

      treeEl.innerHTML = `
        <div class="sidebar__cmd-tree-header">CMD ${sessions.length}</div>
        <div class="sidebar__cmd-tree-list">${cmdItems}</div>
      `;
      treeEl.classList.add('sidebar__cmd-tree--visible');
    });

    document.querySelectorAll('.sidebar__cmd-item').forEach((item) => {
      item.onclick = (event) => {
        if (event.target.closest('.sidebar__cmd-close')) return;
        event.stopPropagation();
        const { sessionId } = item.dataset;
        if (sessionId && state.sessions.has(sessionId)) {
          activateSession(sessionId);
        }
      };
    });

    document.querySelectorAll('.sidebar__cmd-close').forEach((button) => {
      button.onclick = (event) => {
        event.stopPropagation();
        const { sessionId } = button.dataset;
        if (sessionId && state.sessions.has(sessionId)) {
          closeSession(sessionId);
        }
      };
    });
  }

  return {
    createTabGroup,
    addTabToGroup,
    removeTabFromGroup,
    toggleGroupCollapse,
    autoGroupSessionByProject,
    getProjectColor,
    renderTabGroups,
    createGroupElement,
    createTabElement,
    setProjectFilter,
    clearProjectFilter,
    renderFilteredTabs,
    linkSessionToProject,
    unlinkSessionFromProject,
    updateProjectTabCount,
    updateFilterIndicator,
    updateProjectFilterButtons,
    renderProjectCmdTrees
  };
}
