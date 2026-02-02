// Test setup file
import { vi } from 'vitest';

// Mock Tauri APIs
global.__TAURI__ = {
  core: {
    invoke: vi.fn()
  },
  event: {
    listen: vi.fn(() => Promise.resolve(() => {}))
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
