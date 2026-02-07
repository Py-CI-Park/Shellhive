import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { invokeMock, listenMock, dialogOpenMock } from './setup.js';

async function waitFor(predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for condition');
}

function loadIndexHtml() {
  const indexPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  return html.replace(
    /<script type="module" src="\/src\/app\.js"><\/script>/,
    ''
  );
}

function createInvokeImplementation(overrides = {}) {
  const baseSettings = {
    theme: 'dark',
    font_size: 14,
    font_family: 'Consolas',
    enable_logging: true,
    enable_notifications: true,
    enable_snippet_suggestions: true,
    snippet_suggestion_threshold: 3,
    enable_block_mode: false,
    enable_ai_features: false,
    locale: 'ko'
  };
  let ptyCounter = 0;

  return async (command, _payload = {}) => {
    switch (command) {
      case 'get_settings':
        return { ...baseSettings, ...(overrides.settings || {}) };
      case 'list_categories':
        return overrides.categories || [];
      case 'list_projects':
        return overrides.projects || [];
      case 'list_snippets':
      case 'list_session_logs':
        return [];
      case 'load_session_state':
        return null;
      case 'get_home_dir':
        return 'C:\\';
      case 'create_pty':
        ptyCounter += 1;
        return `pty-${ptyCounter}`;
      case 'resize_pty':
      case 'write_pty':
      case 'save_session_state':
      case 'log_session_output':
      case 'git_stage':
      case 'git_unstage':
      case 'git_pull':
      case 'git_push':
      case 'git_commit':
        return null;
      case 'git_status':
        return overrides.gitStatus || {
          branch: 'main',
          files: [],
          ahead: 0,
          behind: 0,
          is_repo: true
        };
      default:
        return null;
    }
  };
}

describe('Phase5 Regression E2E', () => {
  let logSpy;

  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    dialogOpenMock.mockReset();
    vi.resetModules();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    document.documentElement.innerHTML = loadIndexHtml();
  });

  afterEach(() => {
    logSpy?.mockRestore();
  });

  it('removes AI UI in current release defaults', async () => {
    invokeMock.mockImplementation(createInvokeImplementation());
    await import('../app.js');

    if (document.readyState === 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    await waitFor(() => document.querySelectorAll('.tab').length >= 1);

    const claudeSection = document.querySelector('.sidebar__claude');
    const aiInputBar = document.getElementById('aiInputBar');

    expect(claudeSection).toBeNull();
    expect(aiInputBar).toBeNull();
  });

  it('uses renamed git commands and stages files via git_stage', async () => {
    invokeMock.mockImplementation(createInvokeImplementation({
      projects: [
        {
          id: 'p1',
          name: 'demo',
          path: 'C:\\repo',
          category_id: null
        }
      ],
      gitStatus: {
        branch: 'main',
        files: [
          { path: 'src/app.js', status: 'M', staged: false },
          { path: 'src/main.rs', status: 'A', staged: false }
        ],
        ahead: 0,
        behind: 0,
        is_repo: true
      }
    }));
    await import('../app.js');

    if (document.readyState === 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    await waitFor(() => document.querySelector('#projectList .sidebar__item'));
    document.querySelector('#projectList .sidebar__item').click();
    await waitFor(() => invokeMock.mock.calls.filter(([cmd]) => cmd === 'create_pty').length >= 2);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', ctrlKey: true, bubbles: true }));
    await waitFor(() => invokeMock.mock.calls.some(([cmd]) => cmd === 'git_status'));
    await waitFor(() => document.getElementById('gitStageAllBtn'));

    document.getElementById('gitStageAllBtn').click();
    await waitFor(() => invokeMock.mock.calls.some(([cmd]) => cmd === 'git_stage'));

    const gitStageCall = invokeMock.mock.calls.filter(([cmd]) => cmd === 'git_stage').at(-1);
    expect(gitStageCall[1].path).toBe('C:\\repo');
    expect(gitStageCall[1].files).toContain('src/app.js');
    expect(gitStageCall[1].files).toContain('src/main.rs');

    const removedCommands = ['get_git_status', 'git_stage_all', 'git_stage_file', 'git_unstage_file'];
    expect(invokeMock.mock.calls.some(([cmd]) => removedCommands.includes(cmd))).toBe(false);
  });

  it('applies block mode setting to terminal wrapper and overlay', async () => {
    invokeMock.mockImplementation(createInvokeImplementation({
      settings: {
        enable_block_mode: true
      }
    }));
    await import('../app.js');

    if (document.readyState === 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    await waitFor(() => document.querySelector('.terminal-wrapper'));
    const wrapper = document.querySelector('.terminal-wrapper');
    const blockContainer = wrapper.querySelector('.command-blocks-container');

    expect(wrapper.classList.contains('terminal-wrapper--block-mode')).toBe(true);
    expect(blockContainer).toBeTruthy();
    expect(blockContainer.style.display).toBe('block');
  });
});
