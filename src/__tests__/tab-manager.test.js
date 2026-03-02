import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabManagerController } from '../tab-manager.js';
import { TAB_COLORS } from '../ui-constants.js';

function createController(options = {}) {
  const SESSION_STATUS = {
    CONNECTING: 'connecting',
    RUNNING: 'running',
    EXITED: 'exited'
  };

  const state = {
    splitMode: false,
    tabSearchVisible: false,
    activeSessionId: null,
    sessions: new Map(),
    closedTabs: [],
    draggedTab: null
  };

  const deps = {
    state,
    SESSION_STATUS,
    SESSION_STATUS_LABELS: {
      connecting: '연결 중',
      running: '실행 중',
      exited: '종료됨'
    },
    getSessionStatusClass: (status) => ['connecting', 'running', 'exited'].includes(status) ? status : 'exited',
    getSafeTabColor: (color) => (typeof color === 'string' ? color : null),
    ensureSplitPaneHeader: vi.fn(),
    renderSplitMinimap: vi.fn(),
    activateSession: vi.fn(),
    createSession: vi.fn(),
    clearPaneDropIndicators: vi.fn(),
    TAB_COLORS,
    escapeHtml: (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
    escapeHtmlAttr: (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
    escapeDataAttr: (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'),
    debug: vi.fn(),
    ...options
  };

  return {
    controller: createTabManagerController(deps),
    deps,
    state
  };
}

describe('tab-manager module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should map status to icon and label', () => {
    const { controller } = createController();

    expect(controller.getStatusIcon('running')).toBe('●');
    expect(controller.getStatusIcon('exited')).toBe('○');
    expect(controller.getStatusLabel('running')).toBe('실행 중');
  });

  it('should compact long path label and build split subtitle', () => {
    const { controller } = createController();

    expect(controller.getCompactPathLabel('C:\\work\\repo\\shellhive')).toBe('...\\repo\\shellhive');
    expect(controller.getSplitPaneSubtitle({
      status: 'running',
      projectPath: 'C:\\work\\repo\\shellhive'
    })).toContain('실행 중');
  });

  it('should update tab status and notify split helpers in split mode', () => {
    const { controller, deps, state } = createController();

    document.body.innerHTML = `
      <div class="tab" data-session-id="s-1">
        <span class="tab__status"></span>
      </div>
    `;

    state.splitMode = true;
    state.sessions.set('s-1', { id: 's-1' });

    controller.updateTabStatus('s-1', 'running');

    const statusEl = document.querySelector('.tab__status');
    expect(statusEl.textContent).toBe('●');
    expect(statusEl.className).toContain('tab__status--running');
    expect(deps.ensureSplitPaneHeader).toHaveBeenCalled();
    expect(deps.renderSplitMinimap).toHaveBeenCalled();
  });

  it('should show tab search, filter results, and activate session by click', () => {
    const { controller, deps, state } = createController();
    state.sessions.set('s-1', { id: 's-1', name: 'alpha', status: 'running', pinned: false });
    state.sessions.set('s-2', { id: 's-2', name: 'beta', status: 'exited', pinned: true });

    document.body.innerHTML = `
      <div class="main">
        <div class="tabs"></div>
      </div>
    `;

    controller.showTabSearch();
    const input = document.getElementById('tabSearchInput');
    input.value = 'alp';
    input.dispatchEvent(new Event('input'));

    const results = document.querySelectorAll('.tab-search__result');
    expect(results.length).toBe(1);

    results[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(deps.activateSession).toHaveBeenCalledWith('s-1');
    expect(document.getElementById('tabSearch').classList.contains('tab-search--visible')).toBe(false);
  });

  it('should switch tabs by next/previous/index', () => {
    const { controller, deps, state } = createController();
    state.sessions.set('s-1', { id: 's-1' });
    state.sessions.set('s-2', { id: 's-2' });
    state.sessions.set('s-3', { id: 's-3' });
    state.activeSessionId = 's-1';

    controller.switchToNextTab();
    controller.switchToPreviousTab();
    controller.switchToTabByIndex(2);

    expect(deps.activateSession).toHaveBeenNthCalledWith(1, 's-2');
    expect(deps.activateSession).toHaveBeenNthCalledWith(2, 's-3');
    expect(deps.activateSession).toHaveBeenNthCalledWith(3, 's-3');
  });

  it('should toggle pin state and move tab before first unpinned tab', () => {
    const { controller, state } = createController();
    state.sessions.set('s-1', { id: 's-1', pinned: false });

    document.body.innerHTML = `
      <div id="tabsList">
        <div class="tab" data-session-id="s-1"></div>
        <div class="tab" data-session-id="s-2"></div>
      </div>
    `;

    controller.togglePinTab('s-1');

    const tab = document.querySelector('[data-session-id="s-1"]');
    expect(state.sessions.get('s-1')?.pinned).toBe(true);
    expect(tab.classList.contains('tab--pinned')).toBe(true);
  });

  it('should set tab color and clear color with null', () => {
    const { controller, state } = createController();
    state.sessions.set('s-1', { id: 's-1', color: null });

    document.body.innerHTML = `
      <div class="tab" data-session-id="s-1"></div>
    `;

    controller.setTabColor('s-1', '#f44336');
    let tab = document.querySelector('[data-session-id="s-1"]');
    expect(state.sessions.get('s-1')?.color).toBe('#f44336');
    expect(tab.classList.contains('tab--colored')).toBe(true);

    controller.setTabColor('s-1', null);
    tab = document.querySelector('[data-session-id="s-1"]');
    expect(state.sessions.get('s-1')?.color).toBeNull();
    expect(tab.classList.contains('tab--colored')).toBe(false);
  });

  it('should store and restore closed tab info', async () => {
    const { controller, state, deps } = createController();
    const session = {
      id: 's-1',
      name: 'terminal',
      projectId: 'p1',
      projectPath: '/tmp/p1',
      projectName: 'project-1'
    };

    controller.storeClosedTabInfo(session);
    expect(state.closedTabs.length).toBe(1);

    await controller.restoreLastClosedTab();
    expect(deps.createSession).toHaveBeenCalledWith('terminal', '/tmp/p1', 'p1');
    expect(state.closedTabs.length).toBe(0);
  });

  it('should reorder tabs on drop and clear drag state on drag end', () => {
    const { controller, deps, state } = createController();

    document.body.innerHTML = `
      <div id="tabsList">
        <div class="tab" data-session-id="s-1"></div>
        <div class="tab" data-session-id="s-2"></div>
      </div>
    `;

    const tabs = document.querySelectorAll('.tab');
    const dragEvent = {
      currentTarget: tabs[0],
      dataTransfer: {
        effectAllowed: '',
        dropEffect: '',
        setData: vi.fn()
      }
    };
    controller.handleTabDragStart(dragEvent);
    expect(state.draggedTab).toBe(tabs[0]);

    controller.handleTabDrop({
      currentTarget: tabs[1],
      stopPropagation: vi.fn()
    });

    controller.handleTabDragEnd({
      currentTarget: tabs[0]
    });
    expect(state.draggedTab).toBeNull();
    expect(deps.clearPaneDropIndicators).toHaveBeenCalled();
  });
});
