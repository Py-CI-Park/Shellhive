import { describe, expect, it, vi } from 'vitest';
import { createTerminalManagerController } from '../terminal-manager.js';

function createController(stateOverrides = {}) {
  const state = {
    sessions: new Map(),
    activeSessionId: null,
    splitMode: false,
    splitRoot: null,
    ...stateOverrides
  };

  const deps = {
    state,
    debug: vi.fn(),
    showToast: vi.fn(),
    getAllLeafNodes: vi.fn(() => []),
    activateSession: vi.fn()
  };

  return {
    controller: createTerminalManagerController(deps),
    deps,
    state
  };
}

describe('terminal-manager module', () => {
  it('should clear terminal screen with ANSI sequence', () => {
    const terminal = { write: vi.fn(), clear: vi.fn() };
    const { controller, state } = createController();
    state.activeSessionId = 's-1';
    state.sessions.set('s-1', { terminal });

    controller.clearTerminalScreen();

    expect(terminal.write).toHaveBeenCalledWith('\x1b[2J\x1b[H');
  });

  it('should clear terminal scrollback buffer', () => {
    const terminal = { write: vi.fn(), clear: vi.fn() };
    const { controller, state } = createController();
    state.activeSessionId = 's-1';
    state.sessions.set('s-1', { terminal });

    controller.clearTerminalScrollback();

    expect(terminal.clear).toHaveBeenCalledTimes(1);
  });

  it('should focus next split pane by direction', () => {
    const { controller, deps, state } = createController({
      splitMode: true,
      splitRoot: {}
    });
    state.activeSessionId = 's-1';
    deps.getAllLeafNodes.mockReturnValue([
      { sessionId: 's-1' },
      { sessionId: 's-2' },
      { sessionId: 's-3' }
    ]);

    controller.focusPaneByDirection('right');

    expect(deps.activateSession).toHaveBeenCalledWith('s-2', { preserveSplitLayout: true });
  });

  it('should request fullscreen when not in fullscreen mode', async () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true
    });
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true
    });

    const { controller } = createController();
    controller.toggleFullscreen();

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('should exit fullscreen when already in fullscreen mode', () => {
    const exitFullscreen = vi.fn();
    Object.defineProperty(document, 'exitFullscreen', {
      value: exitFullscreen,
      configurable: true
    });
    Object.defineProperty(document, 'fullscreenElement', {
      value: {},
      configurable: true
    });

    const { controller } = createController();
    controller.toggleFullscreen();

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });
});
