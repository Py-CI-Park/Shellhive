// Test setup file
import { vi } from 'vitest';

let ptyCounter = 0;
export const invokeMock = vi.fn(async (command) => {
  switch (command) {
  case 'get_settings':
    return {
      theme: 'dark',
      font_size: 14,
      font_family: 'Consolas',
      enable_logging: true,
      enable_notifications: true,
      locale: 'ko'
    };
  case 'list_categories':
  case 'list_projects':
  case 'list_snippets':
  case 'list_session_logs':
    return [];
  case 'check_claude_installed':
    return false;
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
    return null;
  default:
    return null;
  }
});

export const listenMock = vi.fn(async () => () => {});
export const dialogOpenMock = vi.fn(async () => null);

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args) => invokeMock(...args)
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: (...args) => listenMock(...args)
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: (...args) => dialogOpenMock(...args)
}));

// Mock Tauri APIs
global.__TAURI__ = {
  core: {
    invoke: invokeMock
  },
  event: {
    listen: listenMock
  }
};

// Mock xterm
vi.mock('xterm', () => ({
  Terminal: vi.fn(() => ({
    open: vi.fn(),
    write: vi.fn(),
    writeln: vi.fn(),
    onData: vi.fn(),
    dispose: vi.fn(),
    loadAddon: vi.fn(),
    focus: vi.fn(),
    paste: vi.fn(),
    clear: vi.fn(),
    selectAll: vi.fn(),
    getSelection: vi.fn(() => ''),
    cols: 120,
    rows: 30,
    options: {}
  }))
}));

vi.mock('xterm-addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn()
  }))
}));

vi.mock('xterm-addon-web-links', () => ({
  WebLinksAddon: vi.fn()
}));

vi.mock('xterm-addon-search', () => ({
  SearchAddon: vi.fn(() => ({
    findNext: vi.fn(() => false),
    findPrevious: vi.fn(() => false),
    clearDecorations: vi.fn()
  }))
}));
