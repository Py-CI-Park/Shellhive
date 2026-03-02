import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTabManagerController } from '../tab-manager.js';

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
    sessions: new Map()
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
});
