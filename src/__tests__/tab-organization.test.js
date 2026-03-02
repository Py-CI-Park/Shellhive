import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabOrganizationController } from '../tab-organization.js';
import { TabGroup } from '../state.js';

function createController(options = {}) {
  const state = {
    groupCounter: 0,
    tabGroups: new Map(),
    tabToGroup: new Map(),
    sessions: new Map(),
    activeSessionId: null,
    autoGroupByProject: true,
    activeProjectFilter: null,
    projectTabMap: new Map()
  };

  const deps = {
    state,
    TabGroup,
    getSafeTabColor: (color) => (typeof color === 'string' ? color : null),
    getSessionStatusClass: (status) => (status || 'exited'),
    getStatusIcon: (status) => (status === 'running' ? '●' : '○'),
    escapeHtml: (value) => String(value),
    escapeHtmlAttr: (value) => String(value),
    escapeDataAttr: (value) => String(value),
    activateSession: vi.fn(),
    closeSession: vi.fn(),
    startTabRename: vi.fn(),
    showTabContextMenu: vi.fn(),
    handleTabDragStart: vi.fn(),
    handleTabDragEnter: vi.fn(),
    handleTabDragOver: vi.fn(),
    handleTabDragLeave: vi.fn(),
    handleTabDrop: vi.fn(),
    handleTabDragEnd: vi.fn(),
    ...options
  };

  return {
    controller: createTabOrganizationController(deps),
    state,
    deps
  };
}

describe('tab-organization module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should create tab groups and auto-group sessions by project', () => {
    const { controller, state } = createController();

    state.sessions.set('s1', { id: 's1', name: 'Alpha', status: 'running', pinned: false, projectId: 'p1' });
    state.sessions.set('s2', { id: 's2', name: 'Beta', status: 'running', pinned: false, projectId: 'p1' });

    document.body.innerHTML = '<div id="tabsList"></div>';

    controller.autoGroupSessionByProject('s1', 'p1', 'Project One');
    controller.autoGroupSessionByProject('s2', 'p1', 'Project One');

    expect(state.tabGroups.size).toBe(1);
    const [group] = state.tabGroups.values();
    expect(group.size).toBe(2);
    expect(state.tabToGroup.get('s1')).toBe(group.id);
    expect(state.tabToGroup.get('s2')).toBe(group.id);
  });

  it('should remove empty auto group when last tab is removed', () => {
    const { controller, state } = createController();

    state.sessions.set('s1', { id: 's1', name: 'Alpha', status: 'running', pinned: false });
    document.body.innerHTML = '<div id="tabsList"></div>';

    const group = controller.createTabGroup('Group', ['s1'], { isAutoGroup: true });
    expect(state.tabGroups.has(group.id)).toBe(true);

    controller.removeTabFromGroup('s1');

    expect(state.tabGroups.has(group.id)).toBe(false);
    expect(state.tabToGroup.has('s1')).toBe(false);
  });

  it('should render grouped and ungrouped tabs', () => {
    const { controller, state } = createController();

    state.sessions.set('s1', { id: 's1', name: 'Grouped', status: 'running', pinned: false });
    state.sessions.set('s2', { id: 's2', name: 'Ungrouped', status: 'exited', pinned: false });

    document.body.innerHTML = '<div id="tabsList"></div>';
    controller.createTabGroup('My Group', ['s1']);
    controller.renderTabGroups();

    expect(document.querySelector('.tab-group')).not.toBeNull();
    expect(document.querySelector('[data-group-id] .tab[data-session-id="s1"]')).not.toBeNull();
    expect(document.querySelector('.tab[data-session-id="s2"]')).not.toBeNull();
  });

  it('should avoid duplicate tabs on repeated grouped renders', () => {
    const { controller, state } = createController();

    state.sessions.set('s1', { id: 's1', name: 'Grouped', status: 'running', pinned: false, projectId: 'p1' });
    state.sessions.set('s2', { id: 's2', name: 'Ungrouped', status: 'exited', pinned: false, projectId: 'p2' });

    document.body.innerHTML = '<div id="tabsList"></div>';
    controller.createTabGroup('My Group', ['s1'], { projectId: 'p1' });

    controller.renderTabGroups();
    controller.renderTabGroups();

    expect(document.querySelectorAll('.tab[data-session-id="s1"]').length).toBe(1);
    expect(document.querySelectorAll('.tab[data-session-id="s2"]').length).toBe(1);
  });

  it('should apply and clear project filter with indicator', () => {
    const { controller, state } = createController();

    state.sessions.set('s1', { id: 's1', name: 'A', status: 'running', pinned: false, projectId: 'p1' });
    state.sessions.set('s2', { id: 's2', name: 'B', status: 'running', pinned: false, projectId: 'p2' });

    document.body.innerHTML = `
      <div id="tabsContainer"><div id="tabsList"></div></div>
      <div class="sidebar__item" data-project-id="p1">
        <span class="sidebar__item-name">Project One</span>
        <button class="sidebar__item-filter" data-project-id="p1"></button>
      </div>
      <div class="sidebar__item" data-project-id="p2">
        <span class="sidebar__item-name">Project Two</span>
        <button class="sidebar__item-filter" data-project-id="p2"></button>
      </div>
    `;

    controller.renderTabGroups();
    controller.setProjectFilter('p1');

    expect(state.activeProjectFilter).toBe('p1');
    expect(document.querySelector('.tab[data-session-id="s1"]').style.display).toBe('');
    expect(document.querySelector('.tab[data-session-id="s2"]').style.display).toBe('none');
    expect(document.querySelector('.tabs__filter-indicator strong').textContent).toBe('Project One');

    document.querySelector('.tabs__filter-clear').click();
    expect(state.activeProjectFilter).toBeNull();
    expect(document.querySelector('.tab[data-session-id="s2"]').style.display).toBe('');
  });

  it('should render project cmd trees and bind activate/close handlers', () => {
    const { controller, state, deps } = createController();

    state.sessions.set('s1', { id: 's1', name: 'Main', status: 'running' });
    state.projectTabMap.set('p1', new Set(['s1']));

    document.body.innerHTML = '<div data-project-cmd-tree="p1"></div>';

    controller.renderProjectCmdTrees();

    const cmdItem = document.querySelector('.sidebar__cmd-item');
    const closeBtn = document.querySelector('.sidebar__cmd-close');
    expect(cmdItem).not.toBeNull();
    expect(closeBtn).not.toBeNull();

    cmdItem.click();
    expect(deps.activateSession).toHaveBeenCalledWith('s1');

    closeBtn.click();
    expect(deps.closeSession).toHaveBeenCalledWith('s1');
  });
});
