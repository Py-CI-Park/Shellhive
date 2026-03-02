export function createSettingsController({
  state,
  eventBus,
  invoke,
  debug,
  showToast,
  setLocale,
  commandHistory,
  TERMINAL_THEMES,
  getElements
}) {
  let settingsBackup = null;

  function normalizeSettings(settings) {
    return {
      theme: settings.theme || 'dark',
      fontSize: settings.font_size ?? 14,
      fontFamily: settings.font_family || 'Consolas',
      enableLogging: settings.enable_logging ?? true,
      enableNotifications: settings.enable_notifications ?? true,
      enableSnippetSuggestions: settings.enable_snippet_suggestions ?? true,
      snippetSuggestionThreshold: settings.snippet_suggestion_threshold ?? 3,
      enableBlockMode: settings.enable_block_mode ?? false,
      // AI 기능은 현재 릴리즈 범위에서 제외
      enableAiFeatures: false,
      locale: settings.locale || 'ko'
    };
  }

  function isAiFeaturesEnabled() {
    return state.settings.enableAiFeatures === true;
  }

  function applyAiFeatureVisibility() {
    const aiEnabled = isAiFeaturesEnabled();
    const claudeSection = document.querySelector('.sidebar__claude');
    const aiInputBar = document.getElementById('aiInputBar');
    const aiPreviewModal = document.getElementById('aiPreviewModal');
    const aiHelpModal = document.getElementById('aiHelpModal');

    if (claudeSection) {
      claudeSection.style.display = aiEnabled ? '' : 'none';
    }
    if (aiInputBar) {
      aiInputBar.style.display = aiEnabled ? '' : 'none';
    }
    if (aiPreviewModal) {
      aiPreviewModal.style.display = aiEnabled ? '' : 'none';
      if (!aiEnabled) {
        aiPreviewModal.classList.remove('modal--visible');
      }
    }
    if (aiHelpModal) {
      aiHelpModal.style.display = aiEnabled ? '' : 'none';
      if (!aiEnabled) {
        aiHelpModal.classList.remove('modal--visible');
      }
    }
  }

  function applyBlockModeToSessions(enableBlockMode) {
    state.sessions.forEach((session, sessionId) => {
      if (session.wrapper) {
        session.wrapper.classList.toggle('terminal-wrapper--block-mode', enableBlockMode);
      }
      if (session.blockContainer) {
        session.blockContainer.style.display = enableBlockMode ? 'block' : 'none';
      }
      const blockManager = state.blockManagers.get(sessionId);
      if (blockManager && session.blockContainer) {
        blockManager.setContainer(session.blockContainer);
      }
    });
  }

  function applyTheme(theme) {
    document.documentElement.classList.remove('theme-light', 'theme-monokai', 'theme-high-contrast');
    if (theme === 'light') {
      document.documentElement.classList.add('theme-light');
    } else if (theme === 'monokai') {
      document.documentElement.classList.add('theme-monokai');
    } else if (theme === 'high-contrast') {
      document.documentElement.classList.add('theme-high-contrast');
    }
  }

  function updateTerminalSettings(terminal, settings) {
    const theme = TERMINAL_THEMES[settings.theme] || TERMINAL_THEMES.dark;
    terminal.options.theme = theme;
    terminal.options.fontSize = settings.fontSize || 14;
    terminal.options.fontFamily = `${settings.fontFamily || 'Consolas'}, "Courier New", monospace`;
  }

  async function loadSettings() {
    try {
      const settings = await invoke('get_settings');
      debug('Settings loaded:', settings);
      state.settings = normalizeSettings(settings);

      applyTheme(state.settings.theme);

      if (state.settings.locale) {
        setLocale(state.settings.locale);
      }

      commandHistory.minUsageCount = state.settings.snippetSuggestionThreshold;
      applyAiFeatureVisibility();
      applyBlockModeToSessions(state.settings.enableBlockMode);
      eventBus.emit('settings:loaded', { settings: { ...state.settings } });

      return state.settings;
    } catch (error) {
      debug('Failed to load settings:', error);
      applyAiFeatureVisibility();
      return state.settings;
    }
  }

  async function saveSettings(settings) {
    try {
      const backendSettings = {
        theme: settings.theme,
        font_size: settings.fontSize,
        font_family: settings.fontFamily,
        enable_logging: settings.enableLogging,
        enable_notifications: settings.enableNotifications,
        enable_snippet_suggestions: settings.enableSnippetSuggestions,
        snippet_suggestion_threshold: settings.snippetSuggestionThreshold,
        enable_block_mode: settings.enableBlockMode,
        enable_ai_features: false,
        locale: settings.locale
      };
      await invoke('save_settings', { settings: backendSettings });
      state.settings = { ...settings };

      applyTheme(state.settings.theme);

      if (state.settings.locale) {
        setLocale(state.settings.locale);
      }

      state.sessions.forEach((session) => {
        updateTerminalSettings(session.terminal, state.settings);
      });

      commandHistory.minUsageCount = state.settings.snippetSuggestionThreshold;
      applyAiFeatureVisibility();
      applyBlockModeToSessions(state.settings.enableBlockMode);
      eventBus.emit('settings:updated', { settings: { ...state.settings } });

      debug('Settings saved');
      showToast('설정이 저장되었습니다', 'success');
    } catch (error) {
      debug('Failed to save settings:', error);
      showToast(`설정 저장 실패: ${error}`, 'error');
    }
  }

  function showSettingsModal() {
    debug('Opening settings modal');

    const {
      settingsModal,
      settingsTheme,
      settingsFontSize,
      fontSizeValue,
      settingsFontFamily,
      settingsEnableLogging,
      settingsEnableNotifications,
      settingsBlockMode
    } = getElements();

    settingsBackup = {
      theme: state.settings.theme,
      fontSize: state.settings.fontSize || 14,
      fontFamily: state.settings.fontFamily || 'Consolas',
      enableLogging: state.settings.enableLogging ?? true,
      enableNotifications: state.settings.enableNotifications ?? true,
      enableSnippetSuggestions: state.settings.enableSnippetSuggestions ?? true,
      snippetSuggestionThreshold: state.settings.snippetSuggestionThreshold || 3,
      enableBlockMode: state.settings.enableBlockMode ?? false,
      enableAiFeatures: state.settings.enableAiFeatures ?? false,
      locale: state.settings.locale || 'ko'
    };

    settingsModal.classList.add('modal--visible');
    settingsTheme.value = state.settings.theme;
    settingsFontSize.value = state.settings.fontSize || 14;
    fontSizeValue.textContent = `${settingsFontSize.value}px`;
    settingsFontFamily.value = state.settings.fontFamily || 'Consolas';
    settingsEnableLogging.checked = state.settings.enableLogging ?? true;
    settingsEnableNotifications.checked = state.settings.enableNotifications ?? true;
    if (settingsBlockMode) {
      settingsBlockMode.checked = state.settings.enableBlockMode ?? false;
    }

    const settingsLocale = document.getElementById('settingsLocale');
    if (settingsLocale) {
      settingsLocale.value = state.settings.locale || 'ko';
    }

    const settingsEnableSnippetSuggestions = document.getElementById('settingsEnableSnippetSuggestions');
    const settingsSnippetThreshold = document.getElementById('settingsSnippetThreshold');
    const snippetThresholdValue = document.getElementById('snippetThresholdValue');

    if (settingsEnableSnippetSuggestions) {
      settingsEnableSnippetSuggestions.checked = state.settings.enableSnippetSuggestions ?? true;
    }
    if (settingsSnippetThreshold) {
      const threshold = state.settings.snippetSuggestionThreshold || 3;
      settingsSnippetThreshold.value = threshold;
      if (snippetThresholdValue) {
        snippetThresholdValue.textContent = `${threshold} times`;
      }
    }
  }

  function hideSettingsModal() {
    const { settingsModal } = getElements();
    settingsModal.classList.remove('modal--visible');
    settingsBackup = null;
  }

  function cancelSettingsModal() {
    if (settingsBackup) {
      applyTheme(settingsBackup.theme);
      state.sessions.forEach((session) => {
        updateTerminalSettings(session.terminal, {
          theme: settingsBackup.theme,
          fontSize: settingsBackup.fontSize,
          fontFamily: settingsBackup.fontFamily
        });
      });
    }
    hideSettingsModal();
  }

  function previewSettings() {
    const { settingsTheme, settingsFontSize, settingsFontFamily } = getElements();

    const previewTheme = settingsTheme.value;
    const previewFontSize = parseInt(settingsFontSize.value);
    const previewFontFamily = settingsFontFamily.value;

    applyTheme(previewTheme);

    state.sessions.forEach((session) => {
      updateTerminalSettings(session.terminal, {
        theme: previewTheme,
        fontSize: previewFontSize,
        fontFamily: previewFontFamily
      });
    });
  }

  return {
    loadSettings,
    saveSettings,
    showSettingsModal,
    hideSettingsModal,
    cancelSettingsModal,
    previewSettings,
    updateTerminalSettings,
    applyTheme,
    isAiFeaturesEnabled,
    applyAiFeatureVisibility
  };
}
