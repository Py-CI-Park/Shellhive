import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShortcutsController } from '../shortcuts.js';

function createActions() {
  return {
    createSession: vi.fn(),
    closeActiveSession: vi.fn(),
    restoreLastClosedTab: vi.fn(),
    splitDefault: vi.fn(),
    splitHorizontal: vi.fn(),
    splitVertical: vi.fn(),
    focusLayoutPresetSelector: vi.fn(),
    openLayoutGalleryModal: vi.fn(),
    getLayoutPresetValue: vi.fn(() => null),
    mergePane: vi.fn(),
    toggleMaximize: vi.fn(),
    showTerminalSearch: vi.fn(),
    showTabSearch: vi.fn(),
    showSettingsModal: vi.fn(),
    showAddProjectModal: vi.fn(),
    showAddSnippetModal: vi.fn(),
    toggleRecording: vi.fn(),
    clearTerminalScreen: vi.fn(),
    clearTerminalScrollback: vi.fn(),
    toggleFullscreen: vi.fn(),
    showHistoryPanel: vi.fn(),
    toggleGitPanel: vi.fn(),
    switchToNextTab: vi.fn(),
    switchToPreviousTab: vi.fn(),
    switchToTabByIndex: vi.fn(),
    focusPaneByDirection: vi.fn(),
    changeTheme: vi.fn()
  };
}

function createController(actions) {
  return createShortcutsController({
    escapeHtml: (value) => String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;'),
    showToast: vi.fn(),
    debug: vi.fn(),
    actions
  });
}

describe('shortcuts module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should handle Ctrl+T and trigger createSession', () => {
    const actions = createActions();
    const controller = createController(actions);

    const event = {
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      key: 't',
      code: 'KeyT',
      preventDefault: vi.fn()
    };

    controller.handleKeyboardShortcuts(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(actions.createSession).toHaveBeenCalledTimes(1);
  });

  it('should open command palette and execute selected command', () => {
    const actions = createActions();
    const controller = createController(actions);

    controller.handleKeyboardShortcuts({
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      key: 'P',
      code: 'KeyP',
      preventDefault: vi.fn()
    });

    const palette = document.querySelector('.command-palette');
    expect(palette).toBeTruthy();

    const input = document.querySelector('.command-palette__input');
    input.value = '새탭';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(actions.createSession).toHaveBeenCalled();
  });

  it('should route layout gallery shortcut with selected preset', () => {
    const actions = createActions();
    actions.getLayoutPresetValue.mockReturnValue('grid');
    const controller = createController(actions);

    controller.handleKeyboardShortcuts({
      ctrlKey: true,
      shiftKey: true,
      altKey: false,
      key: 'L',
      code: 'KeyL',
      preventDefault: vi.fn()
    });

    expect(actions.openLayoutGalleryModal).toHaveBeenCalledWith('grid');
  });

  it('should prioritize Ctrl+R for history panel', () => {
    const actions = createActions();
    const controller = createController(actions);

    controller.handleKeyboardShortcuts({
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      key: 'r',
      code: 'KeyR',
      preventDefault: vi.fn()
    });

    expect(actions.showHistoryPanel).toHaveBeenCalledTimes(1);
    expect(actions.toggleRecording).not.toHaveBeenCalled();
  });
});
