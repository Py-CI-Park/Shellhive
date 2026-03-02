import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsController } from '../settings.js';
import { TERMINAL_THEMES } from '../state.js';
import { TAB_COLORS } from '../ui-constants.js';

function createDom() {
  document.body.innerHTML = `
    <aside class="sidebar__claude"></aside>
    <div id="aiInputBar"></div>
    <div id="aiPreviewModal" class="modal"></div>
    <div id="aiHelpModal" class="modal"></div>
    <div id="settingsModal" class="modal"></div>
    <select id="settingsTheme">
      <option value="dark">dark</option>
      <option value="light">light</option>
      <option value="monokai">monokai</option>
      <option value="high-contrast">high-contrast</option>
    </select>
    <input id="settingsFontSize" value="14" />
    <span id="fontSizeValue"></span>
    <select id="settingsFontFamily">
      <option value="Consolas">Consolas</option>
      <option value="Fira Code">Fira Code</option>
    </select>
    <input id="settingsEnableLogging" type="checkbox" />
    <input id="settingsEnableNotifications" type="checkbox" />
    <input id="settingsBlockMode" type="checkbox" />
    <select id="settingsLocale">
      <option value="ko">ko</option>
      <option value="en">en</option>
    </select>
    <input id="settingsEnableSnippetSuggestions" type="checkbox" />
    <input id="settingsSnippetThreshold" value="3" />
    <span id="snippetThresholdValue"></span>
  `;
}

function createControllerDeps() {
  const state = {
    settings: {
      theme: 'dark',
      fontSize: 14,
      fontFamily: 'Consolas',
      enableLogging: true,
      enableNotifications: true,
      enableSnippetSuggestions: true,
      snippetSuggestionThreshold: 3,
      enableBlockMode: false,
      enableAiFeatures: false,
      locale: 'ko'
    },
    sessions: new Map(),
    blockManagers: new Map()
  };

  const eventBus = {
    emit: vi.fn()
  };

  const invoke = vi.fn(async (command) => {
    if (command === 'get_settings') {
      return {
        theme: 'monokai',
        font_size: 15,
        font_family: 'Fira Code',
        enable_logging: false,
        enable_notifications: true,
        enable_snippet_suggestions: false,
        snippet_suggestion_threshold: 7,
        enable_block_mode: true,
        enable_ai_features: false,
        locale: 'en'
      };
    }
    return null;
  });

  const deps = {
    state,
    eventBus,
    invoke,
    debug: vi.fn(),
    showToast: vi.fn(),
    setLocale: vi.fn(),
    commandHistory: { minUsageCount: 0 },
    TERMINAL_THEMES,
    getElements: () => ({
      settingsModal: document.getElementById('settingsModal'),
      settingsTheme: document.getElementById('settingsTheme'),
      settingsFontSize: document.getElementById('settingsFontSize'),
      fontSizeValue: document.getElementById('fontSizeValue'),
      settingsFontFamily: document.getElementById('settingsFontFamily'),
      settingsEnableLogging: document.getElementById('settingsEnableLogging'),
      settingsEnableNotifications: document.getElementById('settingsEnableNotifications'),
      settingsBlockMode: document.getElementById('settingsBlockMode')
    })
  };

  return { deps, invoke };
}

describe('settings module', () => {
  beforeEach(() => {
    createDom();
    document.documentElement.className = '';
  });

  it('should load settings from backend and emit settings:loaded', async () => {
    const { deps } = createControllerDeps();
    const controller = createSettingsController(deps);

    const settings = await controller.loadSettings();

    expect(settings.theme).toBe('monokai');
    expect(settings.fontSize).toBe(15);
    expect(settings.locale).toBe('en');
    expect(deps.commandHistory.minUsageCount).toBe(7);
    expect(deps.setLocale).toHaveBeenCalledWith('en');
    expect(deps.eventBus.emit).toHaveBeenCalledWith(
      'settings:loaded',
      expect.objectContaining({
        settings: expect.objectContaining({ theme: 'monokai', fontSize: 15 })
      })
    );
    expect(document.documentElement.classList.contains('theme-monokai')).toBe(true);
  });

  it('should save settings with snake_case payload and apply to terminals', async () => {
    const { deps, invoke } = createControllerDeps();
    const terminal = { options: {} };
    deps.state.sessions.set('s-1', { terminal });

    const controller = createSettingsController(deps);

    await controller.saveSettings({
      theme: 'light',
      fontSize: 18,
      fontFamily: 'Fira Code',
      enableLogging: false,
      enableNotifications: false,
      enableSnippetSuggestions: true,
      snippetSuggestionThreshold: 4,
      enableBlockMode: true,
      locale: 'ko'
    });

    expect(invoke).toHaveBeenCalledWith('save_settings', {
      settings: {
        theme: 'light',
        font_size: 18,
        font_family: 'Fira Code',
        enable_logging: false,
        enable_notifications: false,
        enable_snippet_suggestions: true,
        snippet_suggestion_threshold: 4,
        enable_block_mode: true,
        enable_ai_features: false,
        locale: 'ko'
      }
    });
    expect(terminal.options.fontSize).toBe(18);
    expect(deps.eventBus.emit).toHaveBeenCalledWith(
      'settings:updated',
      expect.objectContaining({ settings: expect.objectContaining({ theme: 'light' }) })
    );
  });

  it('should preview and cancel settings modal with session rollback', () => {
    const { deps } = createControllerDeps();
    const terminal = { options: { fontSize: 14, fontFamily: 'Consolas' } };
    deps.state.sessions.set('s-1', { terminal });

    const controller = createSettingsController(deps);

    controller.showSettingsModal();
    expect(document.getElementById('settingsModal').classList.contains('modal--visible')).toBe(true);

    document.getElementById('settingsTheme').value = 'light';
    document.getElementById('settingsFontSize').value = '16';
    document.getElementById('settingsFontFamily').value = 'Fira Code';

    controller.previewSettings();
    expect(terminal.options.fontSize).toBe(16);
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);

    controller.cancelSettingsModal();
    expect(document.getElementById('settingsModal').classList.contains('modal--visible')).toBe(false);
    expect(terminal.options.fontSize).toBe(14);
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
  });

  it('should expose predefined terminal themes', () => {
    expect(TERMINAL_THEMES.dark).toBeDefined();
    expect(TERMINAL_THEMES.light).toBeDefined();
    expect(TERMINAL_THEMES.monokai).toBeDefined();
  });

  it('should keep None tab color as null', () => {
    const noneColor = TAB_COLORS.find((color) => color.name === 'None');
    expect(noneColor?.value).toBeNull();
  });
});
