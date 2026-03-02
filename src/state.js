import { TAB_COLORS } from './ui-constants.js';

export const SESSION_STATUS = Object.freeze({
  CONNECTING: 'connecting',
  RUNNING: 'running',
  EXITED: 'exited'
});

export const SESSION_STATUS_LABELS = Object.freeze({
  connecting: '연결 중',
  running: '실행 중',
  exited: '종료됨'
});

export const TERMINAL_THEMES = Object.freeze({
  dark: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#ffffff',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff'
  },
  light: {
    background: '#ffffff',
    foreground: '#1e1e1e',
    cursor: '#000000',
    cursorAccent: '#ffffff',
    selectionBackground: '#add6ff',
    black: '#000000',
    red: '#cd3131',
    green: '#008000',
    yellow: '#795e25',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5'
  },
  monokai: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    cursorAccent: '#272822',
    selectionBackground: '#49483e',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5'
  },
  'high-contrast': {
    background: '#000000',
    foreground: '#ffffff',
    cursor: '#00ff00',
    cursorAccent: '#000000',
    selectionBackground: '#00ffff',
    black: '#000000',
    red: '#ff0000',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0000ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
    brightBlack: '#808080',
    brightRed: '#ff0000',
    brightGreen: '#00ff00',
    brightYellow: '#ffff00',
    brightBlue: '#0000ff',
    brightMagenta: '#ff00ff',
    brightCyan: '#00ffff',
    brightWhite: '#ffffff'
  }
});

export class TabGroup {
  constructor(id, name, options = {}) {
    this.id = id;
    this.name = name;
    this.color = options.color || '#0e639c';
    this.collapsed = false;
    this.tabIds = new Set();
    this.projectId = options.projectId || null;
    this.isAutoGroup = options.isAutoGroup || false;
  }

  addTab(sessionId) {
    this.tabIds.add(sessionId);
  }

  removeTab(sessionId) {
    this.tabIds.delete(sessionId);
  }

  get size() {
    return this.tabIds.size;
  }

  isEmpty() {
    return this.tabIds.size === 0;
  }
}

export class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(eventName, listener) {
    if (!eventName || typeof listener !== 'function') {
      return () => {};
    }

    const listeners = this.listeners.get(eventName) || new Set();
    listeners.add(listener);
    this.listeners.set(eventName, listeners);

    return () => this.off(eventName, listener);
  }

  off(eventName, listener) {
    const listeners = this.listeners.get(eventName);
    if (!listeners) return;

    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(eventName);
    }
  }

  emit(eventName, payload) {
    const listeners = this.listeners.get(eventName);
    if (!listeners || listeners.size === 0) {
      return;
    }

    for (const listener of listeners) {
      try {
        listener(payload);
      } catch (error) {
        console.error('[Shellhive][EventBus] listener error:', error);
      }
    }
  }

  clear(eventName) {
    if (typeof eventName === 'string') {
      this.listeners.delete(eventName);
      return;
    }
    this.listeners.clear();
  }
}

const DEFAULT_SETTINGS = Object.freeze({
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
});

const DEFAULT_TAB_COLOR_VALUES = TAB_COLORS
  .map((color) => (typeof color.value === 'string' ? color.value.trim() : null))
  .filter(Boolean);

export function createDefaultState() {
  return {
    sessions: new Map(),
    activeSessionId: null,
    sessionCounter: 0,
    draggedTab: null,
    dropTarget: null,
    settings: { ...DEFAULT_SETTINGS },
    blockManagers: new Map(),
    snippets: [],
    projects: [],
    categories: [],
    activeProjectFilter: null,
    projectTabMap: new Map(),
    tabGroups: new Map(),
    tabToGroup: new Map(),
    autoGroupByProject: true,
    groupCounter: 0,
    closedTabs: [],
    tabSearchVisible: false,
    tabSearchQuery: '',
    searchVisible: false,
    searchQuery: '',
    splitRoot: null,
    splitMode: false,
    tabLayouts: new Map(),
    swapTargetSession: null,
    maximizedSession: null,
    splitInProgress: false,
    splitRenderRaf: null,
    splitMinimapVisible: true,
    selectedLayoutPreset: null,
    autocompleteVisible: false,
    autocompleteQuery: '',
    autocompleteSelected: 0,
    autocompleteSuggestions: [],
    currentLineBuffer: '',
    gitPanelVisible: false,
    currentGitPath: null,
    allowedTabColorValues: new Set(DEFAULT_TAB_COLOR_VALUES)
  };
}

export const state = createDefaultState();

export function resetState(target = state) {
  const defaults = createDefaultState();

  Object.keys(target).forEach((key) => {
    delete target[key];
  });
  Object.assign(target, defaults);

  return target;
}

export const elements = {};

export const eventBus = new EventBus();
