import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitPanelController } from '../git-panel.js';
import { invokeMock } from './setup.js';

function createDeps() {
  const state = {
    gitPanelVisible: false,
    currentGitPath: null,
    activeSessionId: null,
    sessions: new Map()
  };

  const events = [];
  const eventBus = {
    emit: vi.fn((eventName, payload) => {
      events.push({ eventName, payload });
    })
  };

  const showToast = vi.fn();
  const debug = vi.fn();
  const showConfirmDialog = vi.fn(async () => true);
  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const escapeHtmlAttr = escapeHtml;

  return {
    state,
    eventBus,
    showToast,
    debug,
    showConfirmDialog,
    escapeHtml,
    escapeHtmlAttr,
    events
  };
}

describe('git-panel module', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="gitPanel" style="display:none"></div>';
    invokeMock.mockReset();
  });

  it('should toggle panel visibility and emit event', async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === 'git_status') {
        return {
          is_repo: false,
          branch: 'main',
          files: []
        };
      }
      return [];
    });

    const deps = createDeps();
    const controller = createGitPanelController(deps);

    controller.toggleGitPanel();

    expect(deps.state.gitPanelVisible).toBe(true);
    expect(document.getElementById('gitPanel').style.display).toBe('block');
    expect(deps.eventBus.emit).toHaveBeenCalledWith('git:panel-visibility-changed', { visible: true });
  });

  it('should show empty state when git path is missing', async () => {
    const deps = createDeps();
    const controller = createGitPanelController(deps);

    await controller.refreshGitStatus();

    expect(document.getElementById('gitPanel').textContent).toContain('프로젝트 폴더를 선택하세요');
    expect(deps.eventBus.emit).toHaveBeenCalledWith('git:status-missing-path');
  });

  it('should render branch controls and history when repository is valid', async () => {
    invokeMock.mockImplementation(async (command) => {
      switch (command) {
        case 'git_status':
          return {
            is_repo: true,
            branch: 'main',
            ahead: 1,
            behind: 0,
            files: [
              { path: 'src/app.js', staged: false, status: 'M' }
            ]
          };
        case 'git_branches':
          return [
            { name: 'main', is_current: true },
            { name: 'feature/test', is_current: false }
          ];
        case 'git_log':
          return [
            {
              hash: 'abc1234',
              message: 'test commit',
              author: 'tester',
              date: '2026-03-02'
            }
          ];
        default:
          return null;
      }
    });

    const deps = createDeps();
    deps.state.currentGitPath = '/tmp/repo';

    const controller = createGitPanelController(deps);
    await controller.refreshGitStatus();

    const panel = document.getElementById('gitPanel');
    expect(panel.querySelector('#gitBranchSelect')).toBeTruthy();
    expect(panel.querySelector('#gitCheckoutBtn')).toBeTruthy();
    expect(panel.querySelector('.git-panel__history-item')).toBeTruthy();
    expect(panel.querySelector('.git-panel__file-discard')).toBeTruthy();
    expect(deps.eventBus.emit).toHaveBeenCalledWith(
      'git:status-updated',
      expect.objectContaining({ path: '/tmp/repo', isRepo: true })
    );
  });
});
