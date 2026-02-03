import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

import { t, setLocale, getLocale, getAvailableLocales } from './i18n/index.js';

// Toast notification system
const toastContainer = document.createElement('div');
toastContainer.id = 'toastContainer';
toastContainer.className = 'toast-container';
document.body.appendChild(toastContainer);

function showToast(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `
    <span class="toast__icon">${type === 'error' ? '⚠' : type === 'success' ? '✓' : 'ℹ'}</span>
    <span class="toast__message">${escapeHtml(message)}</span>
    <button class="toast__close">&times;</button>
  `;

  toast.querySelector('.toast__close').addEventListener('click', () => {
    toast.classList.add('toast--hiding');
    setTimeout(() => toast.remove(), 300);
  });

  toastContainer.appendChild(toast);

  // Auto-remove after duration
  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.add('toast--hiding');
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// Confirm dialog
function showConfirmDialog(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-dialog-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <div class="confirm-dialog__header">
          <h3 class="confirm-dialog__title">${escapeHtml(title)}</h3>
        </div>
        <div class="confirm-dialog__body">
          <p class="confirm-dialog__message">${escapeHtml(message)}</p>
        </div>
        <div class="confirm-dialog__footer">
          <button class="btn btn--secondary confirm-dialog__cancel">취소</button>
          <button class="btn btn--danger confirm-dialog__confirm">삭제</button>
        </div>
      </div>
    `;

    const closeDialog = (result) => {
      overlay.classList.add('confirm-dialog-overlay--hiding');
      setTimeout(() => overlay.remove(), 200);
      resolve(result);
    };

    overlay.querySelector('.confirm-dialog__cancel').addEventListener('click', () => closeDialog(false));
    overlay.querySelector('.confirm-dialog__confirm').addEventListener('click', () => closeDialog(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeDialog(false);
    });

    // ESC key to cancel
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeDialog(false);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    document.body.appendChild(overlay);
    overlay.querySelector('.confirm-dialog__cancel').focus();
  });
}

// Debug logging
function debug(...args) {
  console.log('[Shellhive]', ...args);
}

// Session status constants
const SESSION_STATUS = {
  CONNECTING: 'connecting',
  RUNNING: 'running',
  EXITED: 'exited'
};

// Performance constants
const MAX_SESSIONS = 20;

// TabGroup class for organizing tabs
class TabGroup {
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

// Split pane management
class SplitNode {
  constructor(type = 'leaf', sessionId = null) {
    this.type = type; // 'horizontal', 'vertical', 'leaf'
    this.ratio = 0.5;
    this.children = null; // [SplitNode, SplitNode] for non-leaf
    this.sessionId = sessionId; // for leaf nodes only
  }

  isLeaf() {
    return this.type === 'leaf';
  }

  split(direction, newSessionId) {
    if (!this.isLeaf()) return null;

    const oldSessionId = this.sessionId;
    this.type = direction; // 'horizontal' or 'vertical'
    this.sessionId = null;
    this.children = [
      new SplitNode('leaf', oldSessionId),
      new SplitNode('leaf', newSessionId)
    ];
    return this.children[1];
  }
}

// Terminal themes
const TERMINAL_THEMES = {
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
    brightWhite: '#ffffff',
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
    brightWhite: '#a5a5a5',
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
    brightWhite: '#f9f8f5',
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
    brightWhite: '#ffffff',
  },
};

// Layout presets for split views
const LAYOUT_PRESETS = {
  'two-columns': {
    name: '2열 (좌/우)',
    icon: '⬛⬛',
    create: () => ({ type: 'vertical', ratio: 0.5, count: 2 })
  },
  'two-rows': {
    name: '2행 (상/하)',
    icon: '⬛\n⬛',
    create: () => ({ type: 'horizontal', ratio: 0.5, count: 2 })
  },
  'three-columns': {
    name: '3열',
    icon: '⬛⬛⬛',
    create: () => ({ type: 'vertical', ratio: 0.33, count: 3 })
  },
  'main-sidebar': {
    name: '메인 + 사이드바',
    icon: '⬛▐',
    create: () => ({ type: 'vertical', ratio: 0.7, count: 2 })
  },
  'grid-2x2': {
    name: '2x2 그리드',
    icon: '⬛⬛\n⬛⬛',
    create: () => ({ type: 'grid', rows: 2, cols: 2 })
  }
};

// Available tab colors
const TAB_COLORS = [
  { name: 'Red', value: '#f14c4c' },
  { name: 'Orange', value: '#cca700' },
  { name: 'Yellow', value: '#e5e510' },
  { name: 'Green', value: '#0dbc79' },
  { name: 'Blue', value: '#2472c8' },
  { name: 'Purple', value: '#bc3fbc' },
  { name: 'None', value: null }
];

// State
const state = {
  sessions: new Map(),
  activeSessionId: null,
  sessionCounter: 0,
  draggedTab: null,
  dropTarget: null,
  settings: {
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'Consolas',
    enableLogging: true,
    locale: 'ko',
  },
  snippets: [],
  categories: [],             // Project categories
  activeProjectFilter: null,
  projectTabMap: new Map(),
  tabGroups: new Map(),       // Map<groupId, TabGroup>
  tabToGroup: new Map(),      // Map<sessionId, groupId>
  autoGroupByProject: true,   // Auto-group tabs by project
  groupCounter: 0,            // Counter for generating group IDs
  closedTabs: [],             // Store last 10 closed tabs
  tabSearchVisible: false,    // Tab search overlay state
  tabSearchQuery: '',         // Current search query
  searchVisible: false,       // Terminal search visible state
  searchQuery: '',            // Terminal search query
  splitRoot: null,            // SplitNode root for active layout
  splitMode: false,           // Whether split mode is active
  tabLayouts: new Map(),      // Map<sessionId, { splitRoot, splitMode }> - per-tab layouts
  swapTargetSession: null,    // Swap target session ID
  maximizedSession: null,     // Maximized session ID (for split mode)
  splitInProgress: false,     // Prevent race condition in splitActivePane
};

// Sidebar collapse state
const sidebarState = {
  projectsCollapsed: false,
  snippetsCollapsed: false
};

// DOM Elements - will be initialized after DOM loads
let tabsList, terminalContainer, newTabBtn, projectList, addProjectBtn;
let addProjectModal, closeAddProjectModal, cancelAddProject, confirmAddProject;
let projectNameInput, projectPathInput, browsePathBtn;
let snippetList, addSnippetBtn, addSnippetModal, closeAddSnippetModal;
let cancelAddSnippet, confirmAddSnippet, snippetNameInput, snippetCommandInput;
let settingsBtn, settingsModal, closeSettingsModal, cancelSettings, saveSettingsBtn;
let settingsTheme, settingsFontSize, fontSizeValue, settingsFontFamily;
let settingsEnableLogging, clearLogsBtn;

// ===== Settings Functions =====

async function loadSettings() {
  try {
    const settings = await invoke('get_settings');
    debug('Settings loaded:', settings);
    state.settings = settings;
    applyTheme(settings.theme);

    // Apply locale setting
    if (settings.locale) {
      setLocale(settings.locale);
      state.settings.locale = settings.locale;
    }

    return settings;
  } catch (error) {
    debug('Failed to load settings:', error);
    return state.settings;
  }
}

async function saveSettings(settings) {
  try {
    await invoke('save_settings', { settings });
    state.settings = settings;
    applyTheme(settings.theme);

    // Apply locale setting
    if (settings.locale) {
      setLocale(settings.locale);
    }

    // Update all existing terminals
    state.sessions.forEach((session) => {
      updateTerminalSettings(session.terminal, settings);
    });
    debug('Settings saved');
    showToast('설정이 저장되었습니다', 'success');
  } catch (error) {
    debug('Failed to save settings:', error);
    showToast(`설정 저장 실패: ${error}`, 'error');
  }
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
  terminal.options.fontSize = settings.fontSize || settings.font_size || 14;
  terminal.options.fontFamily = `${settings.fontFamily || settings.font_family || 'Consolas'}, "Courier New", monospace`;
}

function showSettingsModal() {
  debug('Opening settings modal');
  settingsModal.classList.add('modal--visible');
  settingsTheme.value = state.settings.theme;
  settingsFontSize.value = state.settings.fontSize || state.settings.font_size || 14;
  fontSizeValue.textContent = `${settingsFontSize.value}px`;
  settingsFontFamily.value = state.settings.fontFamily || state.settings.font_family || 'Consolas';
  settingsEnableLogging.checked = state.settings.enableLogging ?? state.settings.enable_logging ?? true;

  const settingsLocale = document.getElementById('settingsLocale');
  if (settingsLocale) {
    settingsLocale.value = state.settings.locale || 'ko';
  }
}

function hideSettingsModal() {
  settingsModal.classList.remove('modal--visible');
}

// ===== Session State Persistence =====

// Serialize split tree to JSON
function serializeSplitTree(node) {
  if (!node) return null;
  if (node.isLeaf()) {
    return {
      type: 'leaf',
      sessionId: node.sessionId
    };
  }
  return {
    type: node.type,
    ratio: node.ratio,
    children: [
      serializeSplitTree(node.children[0]),
      serializeSplitTree(node.children[1])
    ]
  };
}

// Deserialize split tree from JSON
function deserializeSplitTree(data) {
  if (!data) return null;
  const node = new SplitNode(data.type, data.sessionId || null);
  if (data.type !== 'leaf') {
    node.ratio = data.ratio || 0.5;
    node.children = [
      deserializeSplitTree(data.children[0]),
      deserializeSplitTree(data.children[1])
    ];
  }
  return node;
}

// Helper function to update session IDs in a split tree using the ID mapping
function updateSessionIdsInTree(node, idMap) {
  if (!node) return null;

  // Deserialize first
  const deserializedNode = deserializeSplitTree(node);

  // Recursively update session IDs
  function updateNode(n) {
    if (!n) return null;

    if (n.type === 'leaf') {
      // Update leaf node's session ID
      if (n.sessionId && idMap.has(n.sessionId)) {
        n.sessionId = idMap.get(n.sessionId);
      }
    } else {
      // Recursively update children
      if (n.children) {
        n.children.forEach(child => updateNode(child));
      }
    }
    return n;
  }

  return updateNode(deserializedNode);
}

async function saveSessionState() {
  try {
    const sessions = [];
    state.sessions.forEach((session, id) => {
      sessions.push({
        id: session.id,
        name: session.name,
        working_dir: session.projectPath || null,
        project_id: session.projectId || null,
        pinned: session.pinned || false,
        color: session.color || null,
      });
    });

    const tabGroups = [];
    state.tabGroups.forEach((group, id) => {
      tabGroups.push({
        id: group.id,
        name: group.name,
        color: group.color,
        collapsed: group.collapsed,
        tab_ids: Array.from(group.tabIds),
        project_id: group.projectId || null,
      });
    });

    // Serialize tab layouts (split configurations)
    const tabLayoutsObj = {};
    state.tabLayouts.forEach((layout, sessionId) => {
      tabLayoutsObj[sessionId] = {
        splitMode: layout.splitMode,
        splitRoot: serializeSplitTree(layout.splitRoot)
      };
    });

    const sessionState = {
      sessions,
      active_session_id: state.activeSessionId,
      tab_groups: tabGroups,
      tab_layouts: tabLayoutsObj,
      window_state: {
        width: window.innerWidth,
        height: window.innerHeight,
        x: null,
        y: null,
        maximized: false,
      },
    };

    await invoke('save_session_state', { state: sessionState });
    debug('Session state saved');
  } catch (error) {
    debug('Failed to save session state:', error);
  }
}

async function loadSessionState() {
  try {
    const sessionState = await invoke('load_session_state');
    debug('Session state loaded:', sessionState);
    return sessionState;
  } catch (error) {
    debug('Failed to load session state:', error);
    return null;
  }
}

async function restoreSessionState() {
  const sessionState = await loadSessionState();
  if (!sessionState || sessionState.sessions.length === 0) {
    // No saved state, create default session
    await createSession('Terminal 1');
    return;
  }

  // Restore tab groups first
  for (const groupInfo of sessionState.tab_groups) {
    const group = new TabGroup(groupInfo.id, groupInfo.name, {
      color: groupInfo.color,
      projectId: groupInfo.project_id,
    });
    group.collapsed = groupInfo.collapsed;
    state.tabGroups.set(groupInfo.id, group);

    // Update group counter
    const groupNum = parseInt(groupInfo.id.replace('group-', ''));
    if (groupNum >= state.groupCounter) {
      state.groupCounter = groupNum + 1;
    }
  }

  // Restore sessions - track old ID to new ID mapping
  const sessionIdMap = new Map(); // oldId -> newId

  for (const sessionInfo of sessionState.sessions) {
    const session = await createSession(
      sessionInfo.name,
      sessionInfo.working_dir,
      sessionInfo.project_id
    );

    if (session) {
      // Map old session ID to new session ID
      sessionIdMap.set(sessionInfo.id, session.id);

      session.pinned = sessionInfo.pinned;
      session.color = sessionInfo.color;

      // Update tab UI for pinned/color
      const tab = document.querySelector(`[data-session-id="${session.id}"]`);
      if (tab) {
        if (session.pinned) tab.classList.add('tab--pinned');
        if (session.color) {
          tab.style.borderTopColor = session.color;
          tab.classList.add('tab--colored');
        }
      }
    }
  }

  // Re-render tab groups
  renderTabGroups();

  // Restore tab layouts (split configurations) with session ID mapping
  if (sessionState.tab_layouts) {
    Object.entries(sessionState.tab_layouts).forEach(([oldSessionId, layoutData]) => {
      const newSessionId = sessionIdMap.get(oldSessionId);
      if (newSessionId && state.sessions.has(newSessionId)) {
        // Update session IDs in the split tree
        const updatedSplitRoot = updateSessionIdsInTree(layoutData.splitRoot, sessionIdMap);
        state.tabLayouts.set(newSessionId, {
          splitMode: layoutData.splitMode,
          splitRoot: updatedSplitRoot
        });
      }
    });
  }

  // Activate last active session
  if (sessionState.active_session_id) {
    const sessionIds = Array.from(state.sessions.keys());
    if (sessionIds.length > 0) {
      activateSession(sessionIds[sessionIds.length - 1]);
    }
  }

  showToast('이전 세션이 복원되었습니다', 'success');
}

// ===== Snippet Functions =====

async function loadSnippets() {
  try {
    const snippets = await invoke('list_snippets');
    state.snippets = snippets;
    renderSnippetList(snippets);
  } catch (error) {
    debug('Failed to load snippets:', error);
  }
}

function renderSnippetList(snippets) {
  snippetList.innerHTML = snippets.map(s => `
    <li class="sidebar__item" data-snippet-id="${s.id}" data-command='${JSON.stringify(s.command)}' data-tooltip="${escapeHtml(s.command)}">
      <span class="sidebar__item-icon">></span>
      <span class="sidebar__item-name">${escapeHtml(s.name)}</span>
      <button class="sidebar__item-delete" data-snippet-id="${s.id}">&times;</button>
    </li>
  `).join('');

  document.querySelectorAll('#snippetList .sidebar__item').forEach(item => {
    const command = JSON.parse(item.dataset.command);
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('sidebar__item-delete')) {
        executeSnippet(command);
      }
    });
    const deleteBtn = item.querySelector('.sidebar__item-delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeSnippet(deleteBtn.dataset.snippetId);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function addSnippet(name, command) {
  try {
    await invoke('add_snippet', { name, command });
    await loadSnippets();
    showToast('스니펫이 추가되었습니다', 'success');
  } catch (error) {
    debug('Failed to add snippet:', error);
    showToast(`스니펫 추가 실패: ${error}`, 'error');
  }
}

async function removeSnippet(id) {
  try {
    await invoke('remove_snippet', { id });
    await loadSnippets();
  } catch (error) {
    debug('Failed to remove snippet:', error);
  }
}

async function executeSnippet(command) {
  if (!state.activeSessionId) {
    showToast('활성 터미널 세션이 없습니다', 'warning');
    return;
  }
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.ptySessionId) {
    showToast('터미널 세션이 연결되지 않았습니다', 'warning');
    return;
  }
  try {
    await invoke('write_pty', {
      sessionId: session.ptySessionId,
      data: command + '\r'
    });
  } catch (error) {
    debug('Failed to execute snippet:', error);
    showToast(`스니펫 실행 실패: ${error}`, 'error');
  }
}

function showAddSnippetModal() {
  debug('Opening add snippet modal');
  addSnippetModal.classList.add('modal--visible');
  snippetNameInput.value = '';
  snippetCommandInput.value = '';
  snippetNameInput.focus();
}

function hideAddSnippetModal() {
  addSnippetModal.classList.remove('modal--visible');
}

// ===== Category Functions =====

async function loadCategories() {
  try {
    const categories = await invoke('list_categories');
    state.categories = categories;
    await loadProjects();
  } catch (error) {
    debug('Failed to load categories:', error);
  }
}

async function addCategory(name, color = null) {
  try {
    await invoke('add_category', { name, color });
    await loadCategories();
    showToast(`카테고리 '${name}' 추가됨`, 'success');
  } catch (error) {
    showToast(`카테고리 추가 실패: ${error}`, 'error');
  }
}

async function removeCategory(id) {
  try {
    await invoke('remove_category', { id });
    await loadCategories();
  } catch (error) {
    showToast(`카테고리 삭제 실패: ${error}`, 'error');
  }
}

async function setProjectCategory(projectId, categoryId) {
  try {
    await invoke('set_project_category', { projectId, categoryId });
    await loadProjects();
  } catch (error) {
    showToast(`카테고리 설정 실패: ${error}`, 'error');
  }
}

// ===== Project Functions =====

async function loadProjects() {
  try {
    const projects = await invoke('list_projects');
    debug('Projects loaded:', projects.length);
    renderProjectList(projects);
  } catch (error) {
    debug('Failed to load projects:', error);
  }
}

function renderProjectList(projects) {
  // Group projects by category
  const categorized = new Map();
  categorized.set(null, []); // Uncategorized

  state.categories.forEach(cat => {
    categorized.set(cat.id, []);
  });

  projects.forEach(p => {
    const catId = p.category_id || null;
    if (categorized.has(catId)) {
      categorized.get(catId).push(p);
    } else {
      categorized.get(null).push(p);
    }
  });

  let html = '';

  // Render categorized projects
  state.categories.forEach(cat => {
    const catProjects = categorized.get(cat.id);
    if (catProjects && catProjects.length > 0) {
      html += `
        <li class="sidebar__category" data-category-id="${cat.id}">
          <div class="sidebar__category-header" style="border-left-color: ${cat.color || 'var(--accent)'}">
            <span class="sidebar__category-name">${escapeHtml(cat.name)}</span>
            <span class="sidebar__category-count">${catProjects.length}</span>
          </div>
          <ul class="sidebar__category-items">
            ${renderProjectItems(catProjects)}
          </ul>
        </li>
      `;
    }
  });

  // Render uncategorized projects
  const uncategorized = categorized.get(null);
  if (uncategorized && uncategorized.length > 0) {
    html += renderProjectItems(uncategorized);
  }

  projectList.innerHTML = html;
  setupProjectListeners();
}

function renderProjectItems(projects) {
  return projects.map(p => `
    <li class="sidebar__item" data-project-id="${p.id}" data-path='${JSON.stringify(p.path)}'>
      <span class="sidebar__item-icon">📁</span>
      <span class="sidebar__item-name">${escapeHtml(p.name)}</span>
      <button class="sidebar__item-filter" data-project-id="${p.id}" title="Filter tabs">🔍</button>
      <button class="sidebar__item-delete" data-project-id="${p.id}">&times;</button>
    </li>
  `).join('');
}

function setupProjectListeners() {
  document.querySelectorAll('#projectList .sidebar__item').forEach(item => {
    const projectId = item.dataset.projectId;
    const projectPath = JSON.parse(item.dataset.path);
    const projectName = item.querySelector('.sidebar__item-name').textContent;

    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('sidebar__item-delete') &&
          !e.target.classList.contains('sidebar__item-filter')) {
        createSessionInDirectory(projectPath, projectName, projectId);
      }
    });

    const filterBtn = item.querySelector('.sidebar__item-filter');
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.activeProjectFilter === projectId) {
        clearProjectFilter();
      } else {
        setProjectFilter(projectId);
      }
    });

    const deleteBtn = item.querySelector('.sidebar__item-delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await showConfirmDialog(
        '프로젝트 삭제',
        `"${projectName}" 프로젝트를 삭제하시겠습니까?`
      );
      if (confirmed) {
        await removeProject(deleteBtn.dataset.projectId);
        showToast('프로젝트가 삭제되었습니다', 'success');
      }
    });

    updateProjectTabCount(projectId);
  });
}

async function addProject(name, path) {
  try {
    await invoke('add_project', { name, path, shell: null });
    await loadProjects();
    showToast('프로젝트가 추가되었습니다', 'success');
  } catch (error) {
    debug('Failed to add project:', error);
    showToast(`프로젝트 추가 실패: ${error}`, 'error');
  }
}

async function removeProject(id) {
  try {
    await invoke('remove_project', { id });
    await loadProjects();
  } catch (error) {
    debug('Failed to remove project:', error);
  }
}

function showAddProjectModal() {
  debug('Opening add project modal');
  addProjectModal.classList.add('modal--visible');
  projectNameInput.value = '';
  projectPathInput.value = '';
  projectNameInput.focus();
}

function hideAddProjectModal() {
  addProjectModal.classList.remove('modal--visible');
}

// ===== Session Functions =====

async function createSession(name = null, workingDir = null, projectId = null) {
  // Check session limit
  if (state.sessions.size >= MAX_SESSIONS) {
    showToast(`최대 세션 수(${MAX_SESSIONS}개)에 도달했습니다. 기존 세션을 닫아주세요.`, 'warning');
    return null;
  }

  const id = `session-${++state.sessionCounter}`;
  const sessionName = name || `Terminal ${state.sessionCounter}`;
  debug('Creating session:', id, sessionName);

  // Create terminal wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-wrapper';
  wrapper.id = `terminal-${id}`;
  terminalContainer.appendChild(wrapper);

  // Get theme for terminal
  const theme = TERMINAL_THEMES[state.settings.theme] || TERMINAL_THEMES.dark;
  const fontSize = state.settings.fontSize || state.settings.font_size || 14;
  const fontFamily = state.settings.fontFamily || state.settings.font_family || 'Consolas';

  // Initialize xterm.js
  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: fontSize,
    fontFamily: `${fontFamily}, "Courier New", monospace`,
    theme: theme,
    allowTransparency: false,
    scrollback: 5000,
    convertEol: true,
    windowsMode: true,
  });

  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();
  const searchAddon = new SearchAddon();

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);
  terminal.loadAddon(searchAddon);

  terminal.open(wrapper);

  // Delay fit to ensure proper sizing
  setTimeout(() => fitAddon.fit(), 100);

  // Welcome message
  terminal.writeln('\x1b[1;36m========================================\x1b[0m');
  terminal.writeln('\x1b[1;36m       Welcome to Shellhive!           \x1b[0m');
  terminal.writeln('\x1b[1;36m========================================\x1b[0m');
  terminal.writeln('');

  // Create PTY session
  let ptySessionId = null;
  let unlistenPtyData = null;
  let unlistenPtyExit = null;
  let unlistenPtyError = null;

  // PTY reconnection logic
  const MAX_RECONNECT_ATTEMPTS = 3;
  let reconnectAttempts = 0;

  async function tryConnectPty(sessionId, workingDir, terminal) {
    const delays = [1000, 2000, 4000]; // exponential backoff

    while (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      try {
        const ptySessionId = await invoke('create_pty', {
          workingDir: workingDir,
          shell: null,
        });
        return ptySessionId;
      } catch (error) {
        reconnectAttempts++;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          throw error;
        }
        terminal.writeln(`\x1b[33mConnection failed. Retrying... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})\x1b[0m`);
        showToast(`PTY 연결 재시도 중... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`, 'warning');
        await new Promise(resolve => setTimeout(resolve, delays[reconnectAttempts - 1]));
      }
    }
  }

  try {
    // Use provided working directory or get user home directory
    let dir = workingDir;
    if (!dir) {
      try {
        dir = await invoke('get_home_dir');
      } catch (e) {
        dir = 'C:\\';
        debug('Using fallback directory:', dir);
      }
    }
    debug('Working directory:', dir);

    terminal.writeln(`\x1b[90mConnecting to PTY in ${dir}...\x1b[0m`);

    // Create PTY with reconnection support
    ptySessionId = await tryConnectPty(id, dir, terminal);
    debug('PTY session created:', ptySessionId);

    terminal.writeln('\x1b[32mPTY connected!\x1b[0m');
    terminal.writeln('');
    showToast('터미널 세션이 성공적으로 연결되었습니다', 'success', 2000);

    // Send initial size to PTY
    setTimeout(async () => {
      fitAddon.fit();
      const { cols, rows } = terminal;
      try {
        await invoke('resize_pty', {
          sessionId: ptySessionId,
          cols,
          rows
        });
        debug('Initial PTY size set to', cols, 'x', rows);
      } catch (error) {
        debug('Failed to set initial PTY size:', error);
      }
    }, 150);

    // Listen for PTY output
    unlistenPtyData = await listen(`pty-data:${ptySessionId}`, (event) => {
      terminal.write(event.payload);
      if (state.settings.enableLogging || state.settings.enable_logging) {
        logSessionOutput(ptySessionId, event.payload);
      }
    });
    debug('PTY data listener registered');

    // Listen for PTY exit
    unlistenPtyExit = await listen(`pty-exit:${ptySessionId}`, () => {
      debug('PTY exit event received');
      const session = state.sessions.get(id);
      if (session) {
        session.status = SESSION_STATUS.EXITED;
        updateTabStatus(id, SESSION_STATUS.EXITED);
        terminal.writeln('\r\n\x1b[33mProcess exited.\x1b[0m');
      }
    });

    // Listen for PTY errors
    unlistenPtyError = await listen(`pty-error:${ptySessionId}`, (event) => {
      debug('PTY error received:', event.payload);
      terminal.writeln(`\r\n\x1b[31m[PTY Error] ${event.payload}\x1b[0m`);

      // Update session status
      const session = state.sessions.get(id);
      if (session) {
        session.status = SESSION_STATUS.EXITED;
        updateTabStatus(id, SESSION_STATUS.EXITED);
      }
    });
    debug('PTY error listener registered');

    // Handle terminal input - send to PTY
    terminal.onData(async (data) => {
      if (ptySessionId) {
        try {
          await invoke('write_pty', { sessionId: ptySessionId, data });
        } catch (error) {
          debug('Failed to write to PTY:', error);
        }
      }
    });
    debug('Terminal input handler registered');

  } catch (error) {
    terminal.writeln('\x1b[31mFailed to connect to PTY\x1b[0m');
    terminal.writeln(`\x1b[31m  ${error}\x1b[0m`);
    terminal.writeln('');
    terminal.writeln('\x1b[33mPlease check if the application has proper permissions.\x1b[0m');
    debug('PTY creation failed:', error);
    showToast(`PTY 연결 실패: ${error}`, 'error', 5000);
  }

  // Store session
  const session = {
    id,
    name: sessionName,
    terminal,
    fitAddon,
    searchAddon,
    wrapper,
    ptySessionId,
    unlistenPtyData,
    unlistenPtyExit,
    unlistenPtyError,
    status: ptySessionId ? SESSION_STATUS.RUNNING : SESSION_STATUS.EXITED,
    projectName: name,
    projectId: projectId,
    projectPath: workingDir,
    pinned: false,    // Phase 3: Tab pinning
    color: null,      // Phase 3: Tab color
  };
  state.sessions.set(id, session);

  // Link session to project
  if (projectId) {
    linkSessionToProject(id, projectId);
    // Auto-group by project if enabled
    autoGroupSessionByProject(id, projectId, name);
  }

  // Create tab
  createTab(session);

  // Activate session
  activateSession(id);

  // Handle resize with debouncing
  let resizeTimeout = null;
  const resizeHandler = () => {
    if (state.activeSessionId === id) {
      fitAddon.fit();

      // Debounce PTY resize calls
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      resizeTimeout = setTimeout(async () => {
        const session = state.sessions.get(id);
        if (session && session.ptySessionId && session.status === SESSION_STATUS.RUNNING) {
          const { cols, rows } = terminal;
          try {
            await invoke('resize_pty', {
              sessionId: session.ptySessionId,
              cols,
              rows
            });
            debug('PTY resized to', cols, 'x', rows);
          } catch (error) {
            debug('Failed to resize PTY:', error);
          }
        }
      }, 100);  // 100ms debounce
    }
  };
  window.addEventListener('resize', resizeHandler);
  session.resizeHandler = resizeHandler;

  return session;
}

let logBuffer = {};
let logTimeouts = {};

// Limit log buffer size per session
const MAX_LOG_BUFFER_SIZE = 10000; // characters

function logSessionOutput(sessionId, data) {
  if (!logBuffer[sessionId]) {
    logBuffer[sessionId] = '';
  }

  logBuffer[sessionId] += data;

  // Truncate if too large
  if (logBuffer[sessionId].length > MAX_LOG_BUFFER_SIZE) {
    logBuffer[sessionId] = logBuffer[sessionId].slice(-MAX_LOG_BUFFER_SIZE);
  }

  if (logTimeouts[sessionId]) {
    clearTimeout(logTimeouts[sessionId]);
  }

  logTimeouts[sessionId] = setTimeout(async () => {
    const buffer = logBuffer[sessionId];
    logBuffer[sessionId] = '';
    try {
      await invoke('log_session_output', { sessionId, data: buffer });
    } catch (error) {
      debug('Failed to log session output:', error);
    }
  }, 500);
}

function createTab(session) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.sessionId = session.id;
  tab.draggable = true;

  const statusIcon = getStatusIcon(session.status);
  tab.innerHTML = `
    <span class="tab__status tab__status--${session.status}">${statusIcon}</span>
    <span class="tab__title">${escapeHtml(session.name)}</span>
    <button class="tab__close">&times;</button>
  `;

  tab.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab__close')) {
      activateSession(session.id);
    }
  });

  // Double-click to rename
  tab.addEventListener('dblclick', (e) => {
    if (!e.target.classList.contains('tab__close')) {
      e.preventDefault();
      startTabRename(session.id);
    }
  });

  tab.querySelector('.tab__close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeSession(session.id);
  });

  tab.addEventListener('dragstart', handleTabDragStart);
  tab.addEventListener('dragenter', handleTabDragEnter);
  tab.addEventListener('dragover', handleTabDragOver);
  tab.addEventListener('dragleave', handleTabDragLeave);
  tab.addEventListener('drop', handleTabDrop);
  tab.addEventListener('dragend', handleTabDragEnd);

  tab.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showTabContextMenu(e, session.id);
  });

  tabsList.appendChild(tab);
}

function getStatusIcon(status) {
  switch (status) {
  case SESSION_STATUS.CONNECTING: return '●';
  case SESSION_STATUS.RUNNING: return '●';
  case SESSION_STATUS.EXITED: return '○';
  default: return '○';
  }
}

function updateTabStatus(sessionId, status) {
  const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
  if (!tab) return;
  const statusElement = tab.querySelector('.tab__status');
  if (statusElement) {
    statusElement.textContent = getStatusIcon(status);
    statusElement.className = `tab__status tab__status--${status}`;
  }
}

function activateSession(id) {
  const session = state.sessions.get(id);
  if (!session) return;

  // Cancel any pending swap operation
  if (state.swapTargetSession) {
    const prevSession = state.sessions.get(state.swapTargetSession);
    if (prevSession) {
      prevSession.wrapper.classList.remove('terminal-wrapper--swap-source');
    }
    state.swapTargetSession = null;
  }

  // Save current tab's layout before switching
  if (state.activeSessionId && state.activeSessionId !== id) {
    saveTabLayout(state.activeSessionId);
  }

  state.sessions.forEach((s) => {
    s.wrapper.classList.remove('terminal-wrapper--active');
  });
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.remove('tab--active');
  });

  session.wrapper.classList.add('terminal-wrapper--active');
  const tab = document.querySelector(`[data-session-id="${id}"]`);
  if (tab) {
    tab.classList.add('tab--active');
  }

  state.activeSessionId = id;

  // Restore new tab's layout after switching
  restoreTabLayout(id);

  setTimeout(() => {
    session.fitAddon.fit();
    session.terminal.focus();
  }, 50);
}

async function closeSession(id) {
  const session = state.sessions.get(id);
  if (!session) return;

  // Handle split pane closure
  if (state.splitMode) {
    closeSplitPane(id);
  }

  // Phase 3: Store closed tab info for restoration (but not for pinned tabs)
  if (!session.pinned) {
    storeClosedTabInfo(session);
  }

  // Remove from group
  removeTabFromGroup(id);

  // Unlink from project
  unlinkSessionFromProject(id);

  if (session.ptySessionId) {
    try {
      await invoke('kill_pty', { sessionId: session.ptySessionId });
    } catch (error) {
      debug('Failed to kill PTY:', error);
    }
  }

  if (session.unlistenPtyData) session.unlistenPtyData();
  if (session.unlistenPtyExit) session.unlistenPtyExit();
  if (session.unlistenPtyError) session.unlistenPtyError();
  if (session.resizeHandler) window.removeEventListener('resize', session.resizeHandler);

  session.terminal.dispose();
  session.wrapper.remove();

  const tab = document.querySelector(`[data-session-id="${id}"]`);
  if (tab) tab.remove();

  state.sessions.delete(id);

  // Remove layout data for closed tab
  state.tabLayouts.delete(id);

  if (state.activeSessionId === id) {
    const remaining = Array.from(state.sessions.keys());
    if (remaining.length > 0) {
      activateSession(remaining[remaining.length - 1]);
    } else {
      state.activeSessionId = null;
    }
  }
}

async function createSessionInDirectory(path, projectName, projectId = null) {
  await createSession(`${projectName}`, path, projectId);
}

// Tab drag and drop handlers
function handleTabDragStart(e) {
  state.draggedTab = e.currentTarget;
  e.currentTarget.classList.add('tab--dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleTabDragEnter(e) {
  if (e.currentTarget !== state.draggedTab) {
    e.currentTarget.classList.add('tab--drop-target');
  }
}

function handleTabDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleTabDragLeave(e) {
  e.currentTarget.classList.remove('tab--drop-target');
}

function handleTabDrop(e) {
  e.stopPropagation();
  if (state.draggedTab !== e.currentTarget) {
    const allTabs = Array.from(tabsList.children);
    const draggedIndex = allTabs.indexOf(state.draggedTab);
    const targetIndex = allTabs.indexOf(e.currentTarget);
    if (draggedIndex < targetIndex) {
      tabsList.insertBefore(state.draggedTab, e.currentTarget.nextSibling);
    } else {
      tabsList.insertBefore(state.draggedTab, e.currentTarget);
    }
  }
  e.currentTarget.classList.remove('tab--drop-target');
  return false;
}

function handleTabDragEnd(e) {
  e.currentTarget.classList.remove('tab--dragging');
  document.querySelectorAll('.tab--drop-target').forEach(tab => {
    tab.classList.remove('tab--drop-target');
  });
  state.draggedTab = null;
}

function showTabContextMenu(e, sessionId) {
  const existingMenu = document.getElementById('tabContextMenu');
  if (existingMenu) existingMenu.remove();

  const menu = document.createElement('div');
  menu.id = 'tabContextMenu';
  menu.className = 'context-menu';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;

  const session = state.sessions.get(sessionId);
  const isInGroup = state.tabToGroup.has(sessionId);
  const isPinned = session ? session.pinned : false;

  menu.innerHTML = `
    <div class="context-menu__item" data-action="duplicate">Duplicate</div>
    <div class="context-menu__item" data-action="rename">Rename Tab</div>
    <div class="context-menu__item" data-action="${isPinned ? 'unpin' : 'pin'}">${isPinned ? 'Unpin Tab' : 'Pin Tab'}</div>
    <div class="context-menu__item" data-action="set-color">Set Color ▶</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="close">Close</div>
    <div class="context-menu__item" data-action="close-others">Close Other Tabs</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="restore-closed">Restore Last Closed Tab</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="create-group">Create Group from Tab</div>
    ${isInGroup ? '<div class="context-menu__item" data-action="remove-from-group">Remove from Group</div>' : ''}
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="split-horizontal">Split Horizontal</div>
    <div class="context-menu__item" data-action="split-vertical">Split Vertical</div>
    ${state.splitMode ? '<div class="context-menu__item" data-action="swap-position">Swap Position</div>' : ''}
    ${state.splitMode ? `<div class="context-menu__item" data-action="toggle-maximize">${state.maximizedSession === sessionId ? 'Restore Pane' : 'Maximize Pane'}</div>` : ''}
    <div class="context-menu__item context-menu__item--submenu" data-action="layout-presets">
      Layout Presets ▶
      <div class="context-menu__submenu">
        ${Object.entries(LAYOUT_PRESETS).map(([key, preset]) =>
    `<div class="context-menu__item" data-preset="${key}">${preset.name}</div>`
  ).join('')}
      </div>
    </div>
  `;

  menu.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    const preset = e.target.dataset.preset;

    // Handle preset click
    if (preset) {
      activateSession(sessionId);
      await applyLayoutPreset(preset);
      menu.remove();
      return;
    }

    if (!action) return;

    if (action === 'set-color') {
      // Don't close menu, show color picker submenu
      showColorPickerMenu(e, sessionId, menu);
      return;
    }

    if (action === 'layout-presets') {
      // Don't close menu for submenu parent
      return;
    }

    switch (action) {
    case 'duplicate': await duplicateSession(sessionId); break;
    case 'rename': startTabRename(sessionId); break;
    case 'pin': togglePinTab(sessionId); break;
    case 'unpin': togglePinTab(sessionId); break;
    case 'close': await closeSession(sessionId); break;
    case 'close-others': await closeOtherSessions(sessionId); break;
    case 'restore-closed': await restoreLastClosedTab(); break;
    case 'create-group': {
      const groupName = prompt('Enter group name:');
      if (groupName) createTabGroup(groupName, [sessionId]);
      break;
    }
    case 'remove-from-group': removeTabFromGroup(sessionId); break;
    case 'split-horizontal':
      activateSession(sessionId);
      splitHorizontal();
      break;
    case 'split-vertical':
      activateSession(sessionId);
      splitVertical();
      break;
    case 'swap-position':
      startSwapMode(sessionId);
      break;
    case 'toggle-maximize':
      toggleMaximize(sessionId);
      break;
    }
    menu.remove();
  });

  document.body.appendChild(menu);

  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

async function duplicateSession(sessionId) {
  const session = state.sessions.get(sessionId);
  if (!session) return;
  await createSession(session.projectName || `Terminal ${state.sessionCounter + 1}`);
}

async function closeOtherSessions(keepSessionId) {
  const sessionsToClose = Array.from(state.sessions.keys()).filter(id => id !== keepSessionId);
  for (const id of sessionsToClose) {
    await closeSession(id);
  }
}

// ===== Tab Rename Functions =====

function startTabRename(sessionId) {
  const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
  if (!tab) return;

  const session = state.sessions.get(sessionId);
  if (!session) return;

  const titleEl = tab.querySelector('.tab__title');
  const currentName = session.name;

  // Create inline input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'tab__rename-input';
  input.value = currentName;

  // Replace title with input
  titleEl.style.display = 'none';
  tab.insertBefore(input, titleEl.nextSibling);

  input.focus();
  input.select();

  function finishRename(save = true) {
    const newName = input.value.trim();

    if (save && newName && newName !== currentName) {
      session.name = newName;
      titleEl.textContent = newName;
      debug('Tab renamed:', sessionId, newName);
      showToast(`탭 이름 변경: ${newName}`, 'success', 2000);
    }

    input.remove();
    titleEl.style.display = '';
  }

  input.addEventListener('blur', () => finishRename(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finishRename(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finishRename(false);
    }
    e.stopPropagation();
  });

  // Prevent tab click from activating while renaming
  input.addEventListener('click', (e) => e.stopPropagation());
}

// ===== Phase 3: Advanced Tab Management Functions =====

// Toggle pin state of a tab
function togglePinTab(sessionId) {
  const session = state.sessions.get(sessionId);
  if (!session) return;

  session.pinned = !session.pinned;

  // Update tab UI
  const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
  if (tab) {
    tab.classList.toggle('tab--pinned', session.pinned);

    // Move pinned tabs to the front
    if (session.pinned) {
      const tabsList = document.getElementById('tabsList');
      const firstUnpinnedTab = tabsList.querySelector('.tab:not(.tab--pinned):not(.tab-group)');
      if (firstUnpinnedTab) {
        tabsList.insertBefore(tab, firstUnpinnedTab);
      }
    }
  }

  debug('Tab pinned state toggled:', sessionId, session.pinned);
}

// Set tab color
function setTabColor(sessionId, color) {
  const session = state.sessions.get(sessionId);
  if (!session) return;

  session.color = color;

  // Update tab UI
  const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
  if (tab) {
    if (color) {
      tab.style.borderTopColor = color;
      tab.classList.add('tab--colored');
    } else {
      tab.style.borderTopColor = '';
      tab.classList.remove('tab--colored');
    }
  }

  debug('Tab color set:', sessionId, color);
}

// Show color picker submenu in context menu
function showColorPickerMenu(e, sessionId, parentMenu) {
  // Remove existing color picker if any
  const existingPicker = document.getElementById('colorPickerMenu');
  if (existingPicker) existingPicker.remove();

  const colorPicker = document.createElement('div');
  colorPicker.id = 'colorPickerMenu';
  colorPicker.className = 'context-menu context-menu--submenu';

  const parentRect = parentMenu.getBoundingClientRect();
  colorPicker.style.left = `${parentRect.right}px`;
  colorPicker.style.top = `${e.clientY}px`;

  const colorSwatches = TAB_COLORS.map(color => {
    if (color.value === null) {
      return `<div class="context-menu__item" data-color="null">
        <span class="context-menu__color-swatch context-menu__color-swatch--none"></span>
        <span>${color.name}</span>
      </div>`;
    }
    return `<div class="context-menu__item" data-color="${color.value}">
      <span class="context-menu__color-swatch" style="background-color: ${color.value}"></span>
      <span>${color.name}</span>
    </div>`;
  }).join('');

  colorPicker.innerHTML = colorSwatches;

  colorPicker.addEventListener('click', (e) => {
    const colorValue = e.target.closest('.context-menu__item')?.dataset.color;
    if (colorValue !== undefined) {
      setTabColor(sessionId, colorValue === 'null' ? null : colorValue);
      parentMenu.remove();
      colorPicker.remove();
    }
  });

  document.body.appendChild(colorPicker);

  // Remove when clicking outside
  setTimeout(() => {
    const closeColorPicker = (e) => {
      if (!colorPicker.contains(e.target) && !parentMenu.contains(e.target)) {
        colorPicker.remove();
        document.removeEventListener('click', closeColorPicker);
      }
    };
    document.addEventListener('click', closeColorPicker);
  }, 0);
}

// Store info about closed tab
function storeClosedTabInfo(session) {
  const closedTab = {
    name: session.name,
    projectId: session.projectId,
    projectPath: session.projectPath,
    projectName: session.projectName,
    closedAt: new Date()
  };

  state.closedTabs.unshift(closedTab);

  // Keep only last 10
  if (state.closedTabs.length > 10) {
    state.closedTabs.pop();
  }

  debug('Closed tab stored:', closedTab.name);
}

// Restore the last closed tab
async function restoreLastClosedTab() {
  if (state.closedTabs.length === 0) {
    debug('No closed tabs to restore');
    return;
  }

  const closedTab = state.closedTabs.shift();

  // Recreate session
  if (closedTab.projectPath) {
    await createSession(closedTab.name, closedTab.projectPath, closedTab.projectId);
  } else {
    await createSession(closedTab.name);
  }

  debug('Restored tab:', closedTab.name);
}

// Show tab search overlay
function showTabSearch() {
  state.tabSearchVisible = true;

  let searchEl = document.getElementById('tabSearch');
  if (!searchEl) {
    searchEl = document.createElement('div');
    searchEl.id = 'tabSearch';
    searchEl.className = 'tab-search';
    searchEl.innerHTML = `
      <input type="text" class="tab-search__input" id="tabSearchInput" placeholder="Search tabs..." autocomplete="off">
      <div class="tab-search__results" id="tabSearchResults"></div>
    `;
    document.querySelector('.main').insertBefore(searchEl, document.querySelector('.tabs'));

    const input = document.getElementById('tabSearchInput');
    input.addEventListener('input', (e) => filterTabsByQuery(e.target.value));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideTabSearch();
      } else if (e.key === 'Enter') {
        const firstResult = document.querySelector('.tab-search__result');
        if (firstResult) {
          activateSession(firstResult.dataset.sessionId);
          hideTabSearch();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const results = document.querySelectorAll('.tab-search__result');
        if (results.length > 0) {
          results[0].focus();
        }
      }
    });
  }

  searchEl.classList.add('tab-search--visible');
  const input = document.getElementById('tabSearchInput');
  input.focus();
  input.value = '';
  filterTabsByQuery('');

  debug('Tab search opened');
}

// Hide tab search overlay
function hideTabSearch() {
  state.tabSearchVisible = false;
  const searchEl = document.getElementById('tabSearch');
  if (searchEl) {
    searchEl.classList.remove('tab-search--visible');
  }

  debug('Tab search closed');
}

// Filter tabs by search query
function filterTabsByQuery(query) {
  const resultsEl = document.getElementById('tabSearchResults');
  if (!resultsEl) return;

  const lowerQuery = query.toLowerCase();
  const matches = [];

  state.sessions.forEach((session, sessionId) => {
    if (!query || session.name.toLowerCase().includes(lowerQuery)) {
      matches.push(session);
    }
  });

  resultsEl.innerHTML = matches.map(session => `
    <div class="tab-search__result" data-session-id="${session.id}" tabindex="0">
      <span class="tab-search__result-status tab__status--${session.status}">${getStatusIcon(session.status)}</span>
      <span class="tab-search__result-name">${escapeHtml(session.name)}</span>
      ${session.pinned ? '<span class="tab-search__result-pin">📌</span>' : ''}
      ${session.color ? `<span class="tab-search__result-color" style="background-color: ${session.color}"></span>` : ''}
    </div>
  `).join('');

  // Add click and keyboard handlers
  resultsEl.querySelectorAll('.tab-search__result').forEach((result, index) => {
    result.addEventListener('click', () => {
      activateSession(result.dataset.sessionId);
      hideTabSearch();
    });

    result.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        activateSession(result.dataset.sessionId);
        hideTabSearch();
      } else if (e.key === 'Escape') {
        hideTabSearch();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = result.nextElementSibling;
        if (next) next.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = result.previousElementSibling;
        if (prev) {
          prev.focus();
        } else {
          document.getElementById('tabSearchInput').focus();
        }
      }
    });
  });
}

// ===== Terminal Search Functions =====

function showTerminalSearch() {
  state.searchVisible = true;

  let searchBar = document.getElementById('terminalSearchBar');
  if (!searchBar) {
    searchBar = document.createElement('div');
    searchBar.id = 'terminalSearchBar';
    searchBar.className = 'terminal-search';
    searchBar.innerHTML = `
      <input type="text" class="terminal-search__input" id="terminalSearchInput" placeholder="검색..." autocomplete="off">
      <span class="terminal-search__count" id="terminalSearchCount"></span>
      <button class="terminal-search__btn" id="terminalSearchPrev" title="이전 (Shift+Enter)">▲</button>
      <button class="terminal-search__btn" id="terminalSearchNext" title="다음 (Enter)">▼</button>
      <button class="terminal-search__close" id="terminalSearchClose">&times;</button>
    `;

    const terminalContainer = document.getElementById('terminalContainer');
    terminalContainer.insertBefore(searchBar, terminalContainer.firstChild);

    const input = document.getElementById('terminalSearchInput');
    const prevBtn = document.getElementById('terminalSearchPrev');
    const nextBtn = document.getElementById('terminalSearchNext');
    const closeBtn = document.getElementById('terminalSearchClose');

    input.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      performTerminalSearch(e.target.value);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          searchTerminalPrevious();
        } else {
          searchTerminalNext();
        }
      } else if (e.key === 'Escape') {
        hideTerminalSearch();
      }
    });

    prevBtn.addEventListener('click', () => searchTerminalPrevious());
    nextBtn.addEventListener('click', () => searchTerminalNext());
    closeBtn.addEventListener('click', () => hideTerminalSearch());
  }

  searchBar.classList.add('terminal-search--visible');
  const input = document.getElementById('terminalSearchInput');
  input.focus();
  input.select();
}

function hideTerminalSearch() {
  state.searchVisible = false;
  const searchBar = document.getElementById('terminalSearchBar');
  if (searchBar) {
    searchBar.classList.remove('terminal-search--visible');
  }

  // Clear search highlights
  const session = state.sessions.get(state.activeSessionId);
  if (session && session.searchAddon) {
    session.searchAddon.clearDecorations();
  }

  // Return focus to terminal
  if (state.activeSessionId) {
    const session = state.sessions.get(state.activeSessionId);
    if (session) {
      session.terminal.focus();
    }
  }
}

function performTerminalSearch(query) {
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.searchAddon) return;

  if (!query) {
    session.searchAddon.clearDecorations();
    updateSearchCount(0, 0);
    return;
  }

  session.searchAddon.findNext(query, {
    caseSensitive: false,
    wholeWord: false,
    regex: false,
    decorations: {
      matchBackground: '#515c6a',
      activeMatchBackground: '#515c6a',
      matchBorder: '#74879f',
      activeMatchColorOverviewRuler: '#515c6a',
      matchOverviewRuler: '#515c6a'
    }
  });
}

function searchTerminalNext() {
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.searchAddon || !state.searchQuery) return;
  session.searchAddon.findNext(state.searchQuery);
}

function searchTerminalPrevious() {
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.searchAddon || !state.searchQuery) return;
  session.searchAddon.findPrevious(state.searchQuery);
}

function updateSearchCount(current, total) {
  const countEl = document.getElementById('terminalSearchCount');
  if (countEl) {
    countEl.textContent = total > 0 ? `${current}/${total}` : '';
  }
}

// ===== Split Pane Functions =====

function initSplitMode() {
  if (!state.activeSessionId) return;

  state.splitMode = true;
  state.splitRoot = new SplitNode('leaf', state.activeSessionId);
  renderSplitLayout();
}

function splitHorizontal() {
  if (!state.splitMode) initSplitMode();
  splitActivePane('horizontal');
}

function splitVertical() {
  if (!state.splitMode) initSplitMode();
  splitActivePane('vertical');
}

// Toggle maximize for a split pane
function toggleMaximize(sessionId = state.activeSessionId) {
  if (!sessionId) {
    showToast('활성 세션이 없습니다', 'warning');
    return;
  }
  if (!state.splitMode || !state.splitRoot) {
    showToast('분할 모드에서만 사용 가능합니다', 'warning');
    return;
  }

  if (state.maximizedSession === sessionId) {
    // Restore original layout
    state.maximizedSession = null;
    renderSplitLayout();
    showToast('창 최대화 해제', 'info', 1500);
  } else {
    // Maximize
    state.maximizedSession = sessionId;
    renderMaximizedView(sessionId);
    showToast('창 최대화 (다시 누르면 복원)', 'info', 2000);
  }
}

// Render maximized view for a session
function renderMaximizedView(sessionId) {
  const container = document.getElementById('terminalContainer');
  const session = state.sessions.get(sessionId);

  if (!session) return;

  // Hide all sessions except the maximized one
  state.sessions.forEach((s, id) => {
    s.wrapper.style.display = id === sessionId ? 'block' : 'none';
    s.wrapper.classList.remove('terminal-wrapper--split');
  });

  container.innerHTML = '';
  container.className = 'terminal-container terminal-container--maximized';
  container.appendChild(session.wrapper);

  // Fit terminal after render
  setTimeout(() => session.fitAddon.fit(), 50);
}

async function splitActivePane(direction) {
  if (!state.activeSessionId) return;

  // Prevent race condition - only one split operation at a time
  if (state.splitInProgress) return;
  state.splitInProgress = true;

  try {
    // Check session limit
    if (state.sessions.size >= MAX_SESSIONS) {
      showToast(`최대 세션 수(${MAX_SESSIONS}개)에 도달했습니다`, 'warning');
      return;
    }

    // Find the leaf node containing the active session
    const leafNode = findLeafNode(state.splitRoot, state.activeSessionId);
    if (!leafNode) return;

    // Create a new session for the split
    const session = state.sessions.get(state.activeSessionId);
    const newSession = await createSession(
      `${session.name} (split)`,
      session.projectPath,
      session.projectId
    );

    if (!newSession) return;

    // Split the leaf node
    leafNode.split(direction, newSession.id);

    // Render the new layout
    renderSplitLayout();

    showToast(`화면 ${direction === 'horizontal' ? '가로' : '세로'} 분할`, 'success', 2000);
  } finally {
    state.splitInProgress = false;
  }
}

function findLeafNode(node, sessionId) {
  if (!node) return null;
  if (node.isLeaf()) {
    return node.sessionId === sessionId ? node : null;
  }
  return findLeafNode(node.children[0], sessionId) ||
         findLeafNode(node.children[1], sessionId);
}

function renderSplitLayout() {
  const container = document.getElementById('terminalContainer');
  if (!state.splitMode || !state.splitRoot) {
    // Reset to normal mode
    container.innerHTML = '';
    container.className = 'terminal-container';

    state.sessions.forEach((session) => {
      container.appendChild(session.wrapper);
      session.wrapper.classList.remove('terminal-wrapper--split');
    });
    return;
  }

  // If there's a maximized session, render maximized view
  if (state.maximizedSession) {
    renderMaximizedView(state.maximizedSession);
    return;
  }

  container.innerHTML = '';
  container.className = 'terminal-container terminal-container--split';

  const layoutEl = renderSplitNode(state.splitRoot);
  container.appendChild(layoutEl);

  // Fit all terminals
  setTimeout(() => {
    state.sessions.forEach(session => {
      session.fitAddon.fit();
    });
  }, 100);
}

function renderSplitNode(node) {
  if (node.isLeaf()) {
    const session = state.sessions.get(node.sessionId);
    if (!session) return document.createElement('div');

    session.wrapper.classList.add('terminal-wrapper--split');
    session.wrapper.classList.toggle('terminal-wrapper--active',
      node.sessionId === state.activeSessionId);

    // Add click handler for focus or swap
    session.wrapper.onclick = () => {
      if (state.swapTargetSession) {
        completeSwap(node.sessionId);
      } else {
        activateSession(node.sessionId);
      }
    };

    return session.wrapper;
  }

  const container = document.createElement('div');
  container.className = `split-container split-container--${node.type}`;

  const pane1 = document.createElement('div');
  pane1.className = 'split-pane';
  pane1.style.flex = node.ratio;
  pane1.appendChild(renderSplitNode(node.children[0]));

  const resizer = document.createElement('div');
  resizer.className = `split-resizer split-resizer--${node.type}`;
  resizer.addEventListener('mousedown', (e) => startSplitResize(e, node));

  const pane2 = document.createElement('div');
  pane2.className = 'split-pane';
  pane2.style.flex = 1 - node.ratio;
  pane2.appendChild(renderSplitNode(node.children[1]));

  container.appendChild(pane1);
  container.appendChild(resizer);
  container.appendChild(pane2);

  return container;
}

function startSplitResize(e, node) {
  e.preventDefault();

  const container = e.target.parentElement;
  const isHorizontal = node.type === 'horizontal';
  const startPos = isHorizontal ? e.clientY : e.clientX;
  const containerSize = isHorizontal ? container.offsetHeight : container.offsetWidth;
  const startRatio = node.ratio;

  function onMouseMove(e) {
    const currentPos = isHorizontal ? e.clientY : e.clientX;
    const delta = (currentPos - startPos) / containerSize;
    node.ratio = Math.max(0.1, Math.min(0.9, startRatio + delta));
    renderSplitLayout();
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function closeSplitPane(sessionId) {
  if (!state.splitMode || !state.splitRoot) return false;

  // Find and remove the leaf node
  const removed = removeLeafNode(state.splitRoot, sessionId, null);

  if (removed) {
    // Check if we should exit split mode
    if (state.splitRoot.isLeaf()) {
      state.splitMode = false;
      state.splitRoot = null;
    }
    renderSplitLayout();
    return true;
  }

  return false;
}

function removeLeafNode(node, sessionId, parent) {
  if (!node) return false;

  if (node.isLeaf()) {
    return node.sessionId === sessionId;
  }

  // Check children
  for (let i = 0; i < 2; i++) {
    if (node.children[i].isLeaf() && node.children[i].sessionId === sessionId) {
      // Replace this node with the other child
      const otherChild = node.children[1 - i];
      node.type = otherChild.type;
      node.sessionId = otherChild.sessionId;
      node.children = otherChild.children;
      node.ratio = otherChild.ratio;
      return true;
    }
  }

  return removeLeafNode(node.children[0], sessionId, node) ||
         removeLeafNode(node.children[1], sessionId, node);
}

function exitSplitMode() {
  state.splitMode = false;
  state.splitRoot = null;
  renderSplitLayout();
}

// Swap two panes
function swapPanes(sessionId1, sessionId2) {
  if (!state.splitMode || !state.splitRoot) return;

  const node1 = findLeafNode(state.splitRoot, sessionId1);
  const node2 = findLeafNode(state.splitRoot, sessionId2);

  if (!node1 || !node2) return;

  // Swap session IDs
  const temp = node1.sessionId;
  node1.sessionId = node2.sessionId;
  node2.sessionId = temp;

  renderSplitLayout();
  showToast('창 위치가 교환되었습니다', 'success', 2000);
}

// Start swap mode
function startSwapMode(sessionId) {
  if (!state.splitMode) {
    showToast('분할 모드에서만 사용 가능합니다', 'warning');
    return;
  }
  state.swapTargetSession = sessionId;
  // Add visual feedback to source pane
  const session = state.sessions.get(sessionId);
  if (session) {
    session.wrapper.classList.add('terminal-wrapper--swap-source');
  }
  showToast('교환할 창을 클릭하세요', 'info');
}

// Complete swap operation
function completeSwap(sessionId) {
  if (state.swapTargetSession && state.swapTargetSession !== sessionId) {
    // Remove visual feedback from source pane
    const sourceSession = state.sessions.get(state.swapTargetSession);
    if (sourceSession) {
      sourceSession.wrapper.classList.remove('terminal-wrapper--swap-source');
    }
    swapPanes(state.swapTargetSession, sessionId);
  }
  state.swapTargetSession = null;
}

// Get all leaf nodes from split tree
function getAllLeafNodes(node) {
  if (!node) return [];
  if (node.isLeaf()) return [node];
  return [
    ...getAllLeafNodes(node.children[0]),
    ...getAllLeafNodes(node.children[1])
  ];
}

// Apply a layout preset
async function applyLayoutPreset(presetKey) {
  const preset = LAYOUT_PRESETS[presetKey];
  if (!preset) return;

  const config = preset.create();

  // Current active session is the base
  if (!state.activeSessionId) return;

  // Reset existing split
  exitSplitMode();

  // Create layout based on preset type
  if (config.type === 'grid') {
    await createGridLayout(config.rows, config.cols);
  } else {
    await createLinearLayout(config.type, config.count, config.ratio);
  }
}

// Create linear split layout (horizontal or vertical)
async function createLinearLayout(direction, count, ratio) {
  initSplitMode();
  for (let i = 1; i < count; i++) {
    await splitActivePane(direction);
  }
}

// Create grid layout (rows x cols)
async function createGridLayout(rows, cols) {
  // First split horizontally for rows
  initSplitMode();
  for (let i = 1; i < rows; i++) {
    await splitActivePane('horizontal');
  }

  // Then split each row vertically for cols
  const leaves = getAllLeafNodes(state.splitRoot);
  for (const leaf of leaves) {
    state.activeSessionId = leaf.sessionId;
    for (let j = 1; j < cols; j++) {
      await splitActivePane('vertical');
    }
  }
}

// Save current tab's layout to tabLayouts
function saveTabLayout(sessionId) {
  if (sessionId && state.splitMode && state.splitRoot) {
    // Deep clone via serialize/deserialize to avoid shared reference issues
    const clonedRoot = deserializeSplitTree(serializeSplitTree(state.splitRoot));
    state.tabLayouts.set(sessionId, {
      splitRoot: clonedRoot,
      splitMode: state.splitMode
    });
  }
}

// Restore tab's layout from tabLayouts
function restoreTabLayout(sessionId) {
  const layout = state.tabLayouts.get(sessionId);
  if (layout) {
    state.splitRoot = layout.splitRoot;
    state.splitMode = layout.splitMode;
  } else {
    state.splitRoot = null;
    state.splitMode = false;
  }
  renderSplitLayout();
}

// ===== Tab Grouping Functions =====

// Create a new tab group
function createTabGroup(name, tabIds = [], options = {}) {
  const id = `group-${++state.groupCounter}`;
  const group = new TabGroup(id, name, options);

  tabIds.forEach(sessionId => {
    group.addTab(sessionId);
    state.tabToGroup.set(sessionId, id);
  });

  state.tabGroups.set(id, group);
  renderTabGroups();
  return group;
}

// Add a tab to an existing group
function addTabToGroup(sessionId, groupId) {
  // Remove from current group if exists
  const currentGroupId = state.tabToGroup.get(sessionId);
  if (currentGroupId) {
    removeTabFromGroup(sessionId, false);
  }

  const group = state.tabGroups.get(groupId);
  if (group) {
    group.addTab(sessionId);
    state.tabToGroup.set(sessionId, groupId);
    renderTabGroups();
  }
}

// Remove a tab from its group
function removeTabFromGroup(sessionId, rerender = true) {
  const groupId = state.tabToGroup.get(sessionId);
  if (!groupId) return;

  const group = state.tabGroups.get(groupId);
  if (group) {
    group.removeTab(sessionId);
    state.tabToGroup.delete(sessionId);

    // Remove empty auto-groups
    if (group.isEmpty() && group.isAutoGroup) {
      state.tabGroups.delete(groupId);
    }
  }

  if (rerender) renderTabGroups();
}

// Toggle group collapse state
function toggleGroupCollapse(groupId) {
  const group = state.tabGroups.get(groupId);
  if (group) {
    group.collapsed = !group.collapsed;
    renderTabGroups();
  }
}

// Auto-group a session by its project
function autoGroupSessionByProject(sessionId, projectId, projectName) {
  if (!state.autoGroupByProject || !projectId) return;

  // Find existing group for this project
  let existingGroupId = null;
  state.tabGroups.forEach((group, id) => {
    if (group.projectId === projectId) {
      existingGroupId = id;
    }
  });

  if (existingGroupId) {
    addTabToGroup(sessionId, existingGroupId);
  } else {
    // Create new group for this project
    createTabGroup(projectName || 'Project', [sessionId], {
      projectId: projectId,
      isAutoGroup: true,
      color: getProjectColor(projectId)
    });
  }
}

// Get a consistent color for a project
function getProjectColor(projectId) {
  const colors = ['#0e639c', '#6a9955', '#ce9178', '#dcdcaa', '#9cdcfe', '#c586c0', '#4ec9b0'];
  const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// Delete a tab group (ungroups all tabs)
function deleteTabGroup(groupId) {
  const group = state.tabGroups.get(groupId);
  if (!group) return;

  group.tabIds.forEach(sessionId => {
    state.tabToGroup.delete(sessionId);
  });

  state.tabGroups.delete(groupId);
  renderTabGroups();
}

// Render tabs with grouping support
function renderTabGroups() {
  const tabsList = document.getElementById('tabsList');
  if (!tabsList) return;

  // Clear current tabs
  tabsList.innerHTML = '';

  // Get grouped and ungrouped tabs
  const groupedSessionIds = new Set(state.tabToGroup.keys());
  const ungroupedSessions = [];

  state.sessions.forEach((session, sessionId) => {
    if (!groupedSessionIds.has(sessionId)) {
      ungroupedSessions.push(session);
    }
  });

  // Phase 3: Separate pinned and unpinned ungrouped tabs
  const pinnedSessions = ungroupedSessions.filter(s => s.pinned);
  const unpinnedSessions = ungroupedSessions.filter(s => !s.pinned);

  // Render groups first
  state.tabGroups.forEach((group, groupId) => {
    const groupElement = createGroupElement(group);
    tabsList.appendChild(groupElement);
  });

  // Phase 3: Render pinned tabs first (at the front)
  pinnedSessions.forEach(session => {
    const tab = createTabElement(session);
    tabsList.appendChild(tab);
  });

  // Render unpinned tabs
  unpinnedSessions.forEach(session => {
    const tab = createTabElement(session);
    tabsList.appendChild(tab);
  });

  // Apply filter if active
  renderFilteredTabs();
}

// Create group container element
function createGroupElement(group) {
  const groupEl = document.createElement('div');
  groupEl.className = `tab-group ${group.collapsed ? 'tab-group--collapsed' : ''}`;
  groupEl.dataset.groupId = group.id;

  // Group header
  const header = document.createElement('div');
  header.className = 'tab-group__header';
  header.style.borderLeftColor = group.color;
  header.innerHTML = `
    <span class="tab-group__collapse">${group.collapsed ? '▶' : '▼'}</span>
    <span class="tab-group__name">${escapeHtml(group.name)}</span>
    <span class="tab-group__count">${group.size}</span>
  `;

  header.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleGroupCollapse(group.id);
  });

  // Group tabs container
  const tabsContainer = document.createElement('div');
  tabsContainer.className = 'tab-group__tabs';

  if (!group.collapsed) {
    group.tabIds.forEach(sessionId => {
      const session = state.sessions.get(sessionId);
      if (session) {
        const tab = createTabElement(session, true);
        tabsContainer.appendChild(tab);
      }
    });
  }

  groupEl.appendChild(header);
  groupEl.appendChild(tabsContainer);

  return groupEl;
}

// Create tab element (extracted from createTab for reuse)
function createTabElement(session, isGrouped = false) {
  const tab = document.createElement('div');
  tab.className = `tab ${isGrouped ? 'tab--grouped' : ''}`;
  tab.dataset.sessionId = session.id;
  tab.draggable = true;

  // Accessibility attributes
  tab.setAttribute('role', 'tab');
  tab.setAttribute('aria-selected', session.id === state.activeSessionId ? 'true' : 'false');
  tab.setAttribute('tabindex', session.id === state.activeSessionId ? '0' : '-1');

  if (session.id === state.activeSessionId) {
    tab.classList.add('tab--active');
  }

  // Phase 3: Add pinned state
  if (session.pinned) {
    tab.classList.add('tab--pinned');
  }

  // Phase 3: Add color indicator if session has color
  if (session.color) {
    tab.style.borderTopColor = session.color;
    tab.classList.add('tab--colored');
  }

  const statusIcon = getStatusIcon(session.status);
  tab.innerHTML = `
    <span class="tab__status tab__status--${session.status}">${statusIcon}</span>
    <span class="tab__title">${escapeHtml(session.name)}</span>
    <button class="tab__close">&times;</button>
  `;

  tab.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab__close')) {
      activateSession(session.id);
    }
  });

  // Double-click to rename
  tab.addEventListener('dblclick', (e) => {
    if (!e.target.classList.contains('tab__close')) {
      e.preventDefault();
      startTabRename(session.id);
    }
  });

  tab.querySelector('.tab__close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeSession(session.id);
  });

  // Drag handlers
  tab.addEventListener('dragstart', handleTabDragStart);
  tab.addEventListener('dragenter', handleTabDragEnter);
  tab.addEventListener('dragover', handleTabDragOver);
  tab.addEventListener('dragleave', handleTabDragLeave);
  tab.addEventListener('drop', handleTabDrop);
  tab.addEventListener('dragend', handleTabDragEnd);

  tab.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showTabContextMenu(e, session.id);
  });

  return tab;
}

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Toggle sidebar section collapse
function toggleSidebarSection(section) {
  sidebarState[section + 'Collapsed'] = !sidebarState[section + 'Collapsed'];
  const sectionEl = document.querySelector(`.sidebar__${section}`);
  const list = sectionEl.querySelector('.sidebar__list');
  const header = sectionEl.querySelector('.sidebar__section-header');

  if (sidebarState[section + 'Collapsed']) {
    list.style.display = 'none';
    header.classList.add('sidebar__section-header--collapsed');
  } else {
    list.style.display = '';
    header.classList.remove('sidebar__section-header--collapsed');
  }
}

// ===== Project Filtering Functions =====

function setProjectFilter(projectId) {
  state.activeProjectFilter = projectId;
  renderFilteredTabs();
  updateFilterIndicator();
  updateProjectFilterButtons();
}

function clearProjectFilter() {
  state.activeProjectFilter = null;
  renderFilteredTabs();
  updateFilterIndicator();
  updateProjectFilterButtons();
}

function renderFilteredTabs() {
  const tabs = document.querySelectorAll('.tab');
  const groups = document.querySelectorAll('.tab-group');

  tabs.forEach(tab => {
    const sessionId = tab.dataset.sessionId;
    const session = state.sessions.get(sessionId);
    if (!state.activeProjectFilter) {
      tab.style.display = '';
    } else if (session && session.projectId === state.activeProjectFilter) {
      tab.style.display = '';
    } else {
      tab.style.display = 'none';
    }
  });

  // Handle group visibility
  groups.forEach(groupEl => {
    const groupId = groupEl.dataset.groupId;
    const group = state.tabGroups.get(groupId);
    if (!group) return;

    if (!state.activeProjectFilter) {
      groupEl.style.display = '';
    } else if (group.projectId === state.activeProjectFilter) {
      groupEl.style.display = '';
    } else {
      groupEl.style.display = 'none';
    }
  });
}

function linkSessionToProject(sessionId, projectId) {
  if (!projectId) return;
  if (!state.projectTabMap.has(projectId)) {
    state.projectTabMap.set(projectId, new Set());
  }
  state.projectTabMap.get(projectId).add(sessionId);
  updateProjectTabCount(projectId);
}

function unlinkSessionFromProject(sessionId) {
  const session = state.sessions.get(sessionId);
  if (session && session.projectId) {
    const projectId = session.projectId;
    const tabSet = state.projectTabMap.get(projectId);
    if (tabSet) {
      tabSet.delete(sessionId);
      updateProjectTabCount(projectId);
    }
  }
}

function updateProjectTabCount(projectId) {
  const projectItem = document.querySelector(`[data-project-id="${projectId}"]`);
  if (!projectItem) return;

  const tabSet = state.projectTabMap.get(projectId);
  const count = tabSet ? tabSet.size : 0;

  let badge = projectItem.querySelector('.sidebar__item-tab-count');
  if (count > 0) {
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'sidebar__item-tab-count';
      projectItem.insertBefore(badge, projectItem.querySelector('.sidebar__item-filter'));
    }
    badge.textContent = count;
  } else if (badge) {
    badge.remove();
  }
}

function updateFilterIndicator() {
  let indicator = document.querySelector('.tabs__filter-indicator');
  if (state.activeProjectFilter) {
    const projectItem = document.querySelector(`[data-project-id="${state.activeProjectFilter}"]`);
    const projectName = projectItem ? projectItem.querySelector('.sidebar__item-name').textContent : 'Project';

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'tabs__filter-indicator';
      indicator.innerHTML = `
        <span class="tabs__filter-text">Filtered: <strong></strong></span>
        <button class="tabs__filter-clear">&times;</button>
      `;
      indicator.querySelector('.tabs__filter-clear').addEventListener('click', clearProjectFilter);
      const tabsContainer = document.getElementById('tabsContainer');
      tabsContainer.insertBefore(indicator, tabsContainer.firstChild);
    }
    indicator.querySelector('strong').textContent = projectName;
  } else if (indicator) {
    indicator.remove();
  }
}

function updateProjectFilterButtons() {
  document.querySelectorAll('.sidebar__item-filter').forEach(btn => {
    const projectId = btn.dataset.projectId;
    if (state.activeProjectFilter === projectId) {
      btn.classList.add('sidebar__item-filter--active');
    } else {
      btn.classList.remove('sidebar__item-filter--active');
    }
  });
}

function handleKeyboardShortcuts(e) {
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    showTerminalSearch();
    return;
  }
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    createSession();
    return;
  }
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (state.activeSessionId) {
      const session = state.sessions.get(state.activeSessionId);
      // Phase 3: Don't close pinned tabs with Ctrl+W
      if (session && !session.pinned) {
        closeSession(state.activeSessionId);
      }
    }
    return;
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'T') {
    e.preventDefault();
    // Phase 3: Restore last closed tab (Ctrl+Shift+T)
    restoreLastClosedTab();
    return;
  }
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    // Phase 3: Show tab search (Ctrl+Shift+F)
    showTabSearch();
    return;
  }
  // Ctrl+Shift+D - Horizontal split
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    splitHorizontal();
    return;
  }
  // Ctrl+Shift+E - Vertical split
  if (e.ctrlKey && e.shiftKey && e.key === 'E') {
    e.preventDefault();
    splitVertical();
    return;
  }
  // Ctrl+Shift+M - Toggle maximize pane
  if (e.ctrlKey && e.shiftKey && e.key === 'M') {
    e.preventDefault();
    toggleMaximize();
    return;
  }
  if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    switchToNextTab();
    return;
  }
  if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    switchToPreviousTab();
    return;
  }
  if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    switchToTabByIndex(parseInt(e.key) - 1);
    return;
  }
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault();
    showSettingsModal();
    return;
  }

  // Phase 7.4: Additional keyboard shortcuts

  // Ctrl+L - Clear terminal screen
  if (e.ctrlKey && e.key === 'l') {
    e.preventDefault();
    clearTerminalScreen();
    return;
  }

  // Ctrl+K - Clear scrollback buffer
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    clearTerminalScrollback();
    return;
  }

  // F11 - Toggle fullscreen
  if (e.key === 'F11') {
    e.preventDefault();
    toggleFullscreen();
    return;
  }

  // Ctrl+Alt+Arrow - Focus pane by direction
  if (e.ctrlKey && e.altKey) {
    switch (e.key) {
    case 'ArrowLeft':
      e.preventDefault();
      focusPaneByDirection('left');
      return;
    case 'ArrowRight':
      e.preventDefault();
      focusPaneByDirection('right');
      return;
    case 'ArrowUp':
      e.preventDefault();
      focusPaneByDirection('up');
      return;
    case 'ArrowDown':
      e.preventDefault();
      focusPaneByDirection('down');
      return;
    }
  }
}

// ===== Terminal Clear Functions =====

function clearTerminalScreen() {
  const session = state.sessions.get(state.activeSessionId);
  if (!session) return;

  // Send clear screen escape sequence (like running 'clear' or 'cls')
  session.terminal.write('\x1b[2J\x1b[H');
  debug('Terminal screen cleared');
}

function clearTerminalScrollback() {
  const session = state.sessions.get(state.activeSessionId);
  if (!session) return;

  // Clear the scrollback buffer
  session.terminal.clear();
  debug('Terminal scrollback cleared');
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      debug('Fullscreen error:', err);
      showToast('전체화면 전환에 실패했습니다', 'error');
    });
  } else {
    document.exitFullscreen();
  }
}

// Focus pane by direction (for split mode navigation)
function focusPaneByDirection(direction) {
  if (!state.splitMode || !state.splitRoot) return;

  const leaves = getAllLeafNodes(state.splitRoot);
  if (leaves.length <= 1) return;

  const currentIndex = leaves.findIndex(n => n.sessionId === state.activeSessionId);
  if (currentIndex === -1) return;

  let nextIndex;
  if (direction === 'right' || direction === 'down') {
    nextIndex = (currentIndex + 1) % leaves.length;
  } else {
    nextIndex = (currentIndex - 1 + leaves.length) % leaves.length;
  }

  activateSession(leaves[nextIndex].sessionId);
}

// Get keyboard shortcuts info
function getKeyboardShortcuts() {
  return [
    { keys: 'Ctrl+T', action: '새 탭' },
    { keys: 'Ctrl+W', action: '탭 닫기' },
    { keys: 'Ctrl+Tab', action: '다음 탭' },
    { keys: 'Ctrl+Shift+Tab', action: '이전 탭' },
    { keys: 'Ctrl+1-9', action: '탭 전환' },
    { keys: 'Ctrl+Shift+T', action: '마지막 닫은 탭 복원' },
    { keys: 'Ctrl+Shift+F', action: '탭 검색' },
    { keys: 'Ctrl+Shift+D', action: '가로 분할' },
    { keys: 'Ctrl+Shift+E', action: '세로 분할' },
    { keys: 'Ctrl+Shift+M', action: '현재 창 최대화 토글' },
    { keys: 'Ctrl+Alt+Arrow', action: '분할 창 포커스 이동' },
    { keys: 'Ctrl+F', action: '터미널 검색' },
    { keys: 'Ctrl+L', action: '화면 지우기' },
    { keys: 'Ctrl+K', action: '스크롤백 지우기' },
    { keys: 'Ctrl+,', action: '설정' },
    { keys: 'F11', action: '전체화면 토글' },
  ];
}

function switchToNextTab() {
  const sessionIds = Array.from(state.sessions.keys());
  if (sessionIds.length === 0) return;
  const currentIndex = sessionIds.indexOf(state.activeSessionId);
  activateSession(sessionIds[(currentIndex + 1) % sessionIds.length]);
}

function switchToPreviousTab() {
  const sessionIds = Array.from(state.sessions.keys());
  if (sessionIds.length === 0) return;
  const currentIndex = sessionIds.indexOf(state.activeSessionId);
  activateSession(sessionIds[currentIndex === 0 ? sessionIds.length - 1 : currentIndex - 1]);
}

function switchToTabByIndex(index) {
  const sessionIds = Array.from(state.sessions.keys());
  if (index >= 0 && index < sessionIds.length) {
    activateSession(sessionIds[index]);
  }
}

// ===== File Drag and Drop Functions =====

function setupFileDragDrop() {
  const container = document.getElementById('terminalContainer');

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, preventDefaults, false);
    document.body.addEventListener(eventName, preventDefaults, false);
  });

  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    container.addEventListener(eventName, highlightDropZone, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    container.addEventListener(eventName, unhighlightDropZone, false);
  });

  // Handle dropped files
  container.addEventListener('drop', handleFileDrop, false);
}

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlightDropZone(e) {
  // Only highlight if dragging files
  if (e.dataTransfer.types.includes('Files')) {
    document.getElementById('terminalContainer').classList.add('terminal-container--drop-active');
  }
}

function unhighlightDropZone(e) {
  document.getElementById('terminalContainer').classList.remove('terminal-container--drop-active');
}

async function handleFileDrop(e) {
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.ptySessionId) {
    showToast('활성 터미널 세션이 없습니다', 'warning');
    return;
  }

  const files = e.dataTransfer.files;
  if (files.length === 0) return;

  // Build path string (quote paths with spaces)
  const paths = [];
  for (let i = 0; i < files.length; i++) {
    let path = files[i].path;
    // Quote path if it contains spaces
    if (path.includes(' ')) {
      path = `"${path}"`;
    }
    paths.push(path);
  }

  const pathString = paths.join(' ');

  try {
    await invoke('write_pty', {
      sessionId: session.ptySessionId,
      data: pathString
    });

    showToast(`${files.length}개 파일 경로 입력됨`, 'success', 2000);
    debug('File paths inserted:', pathString);
  } catch (error) {
    debug('Failed to insert file paths:', error);
    showToast('파일 경로 입력 실패', 'error');
  }
}

// ===== Initialize DOM Elements =====
function initializeDOMElements() {
  tabsList = document.getElementById('tabsList');
  terminalContainer = document.getElementById('terminalContainer');
  newTabBtn = document.getElementById('newTabBtn');
  projectList = document.getElementById('projectList');
  addProjectBtn = document.getElementById('addProjectBtn');
  addProjectModal = document.getElementById('addProjectModal');
  closeAddProjectModal = document.getElementById('closeAddProjectModal');
  cancelAddProject = document.getElementById('cancelAddProject');
  confirmAddProject = document.getElementById('confirmAddProject');
  projectNameInput = document.getElementById('projectName');
  projectPathInput = document.getElementById('projectPath');
  browsePathBtn = document.getElementById('browsePathBtn');
  snippetList = document.getElementById('snippetList');
  addSnippetBtn = document.getElementById('addSnippetBtn');
  addSnippetModal = document.getElementById('addSnippetModal');
  closeAddSnippetModal = document.getElementById('closeAddSnippetModal');
  cancelAddSnippet = document.getElementById('cancelAddSnippet');
  confirmAddSnippet = document.getElementById('confirmAddSnippet');
  snippetNameInput = document.getElementById('snippetName');
  snippetCommandInput = document.getElementById('snippetCommand');
  settingsBtn = document.getElementById('settingsBtn');
  settingsModal = document.getElementById('settingsModal');
  closeSettingsModal = document.getElementById('closeSettingsModal');
  cancelSettings = document.getElementById('cancelSettings');
  saveSettingsBtn = document.getElementById('saveSettings');
  settingsTheme = document.getElementById('settingsTheme');
  settingsFontSize = document.getElementById('settingsFontSize');
  fontSizeValue = document.getElementById('fontSizeValue');
  settingsFontFamily = document.getElementById('settingsFontFamily');
  settingsEnableLogging = document.getElementById('settingsEnableLogging');
  clearLogsBtn = document.getElementById('clearLogsBtn');

  debug('DOM elements initialized');
}

// ===== Accessibility Functions =====
function setupAccessibility() {
  // Set up ARIA roles and labels
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.setAttribute('role', 'navigation');
    sidebar.setAttribute('aria-label', '사이드바 네비게이션');
  }

  const tabsList = document.getElementById('tabsList');
  if (tabsList) {
    tabsList.setAttribute('role', 'tablist');
    tabsList.setAttribute('aria-label', '터미널 탭 목록');
  }

  const terminalContainer = document.getElementById('terminalContainer');
  if (terminalContainer) {
    terminalContainer.setAttribute('role', 'main');
    terminalContainer.setAttribute('aria-label', '터미널 영역');
  }

  const projectList = document.getElementById('projectList');
  if (projectList) {
    projectList.setAttribute('role', 'list');
    projectList.setAttribute('aria-label', '프로젝트 목록');
  }

  const snippetList = document.getElementById('snippetList');
  if (snippetList) {
    snippetList.setAttribute('role', 'list');
    snippetList.setAttribute('aria-label', '스니펫 목록');
  }

  debug('Accessibility setup complete');
}

// ===== Setup Event Listeners =====
function setupEventListeners() {
  newTabBtn.addEventListener('click', () => createSession());

  addProjectBtn.addEventListener('click', () => showAddProjectModal());
  closeAddProjectModal.addEventListener('click', () => hideAddProjectModal());
  cancelAddProject.addEventListener('click', () => hideAddProjectModal());

  confirmAddProject.addEventListener('click', async () => {
    const name = projectNameInput.value.trim();
    const path = projectPathInput.value.trim();
    if (!name) { alert('Please enter a project name.'); return; }
    if (!path) { alert('Please enter a project path.'); return; }
    await addProject(name, path);
    hideAddProjectModal();
  });

  browsePathBtn.addEventListener('click', async () => {
    debug('Browse button clicked');
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Folder',
      });
      debug('Selected folder:', selected);
      if (selected) {
        projectPathInput.value = selected;
        if (!projectNameInput.value.trim()) {
          projectNameInput.value = selected.split(/[\\/]/).pop();
        }
      }
    } catch (error) {
      debug('Failed to open folder dialog:', error);
      showToast(`폴더 선택 실패: ${error}`, 'error');
    }
  });

  addSnippetBtn.addEventListener('click', () => showAddSnippetModal());
  closeAddSnippetModal.addEventListener('click', () => hideAddSnippetModal());
  cancelAddSnippet.addEventListener('click', () => hideAddSnippetModal());

  confirmAddSnippet.addEventListener('click', async () => {
    const name = snippetNameInput.value.trim();
    const command = snippetCommandInput.value.trim();
    if (!name) { alert('Please enter a snippet name.'); return; }
    if (!command) { alert('Please enter a command.'); return; }
    await addSnippet(name, command);
    hideAddSnippetModal();
  });

  settingsBtn.addEventListener('click', () => showSettingsModal());
  closeSettingsModal.addEventListener('click', () => hideSettingsModal());
  cancelSettings.addEventListener('click', () => hideSettingsModal());

  settingsFontSize.addEventListener('input', (e) => {
    fontSizeValue.textContent = `${e.target.value}px`;
  });

  saveSettingsBtn.addEventListener('click', async () => {
    const settingsLocale = document.getElementById('settingsLocale');
    await saveSettings({
      theme: settingsTheme.value,
      font_size: parseInt(settingsFontSize.value),
      font_family: settingsFontFamily.value,
      enable_logging: settingsEnableLogging.checked,
      locale: settingsLocale?.value || 'ko',
    });
    hideSettingsModal();
  });

  clearLogsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all session logs?')) {
      try {
        const count = await invoke('clear_all_logs');
        showToast(`${count}개의 로그 파일이 삭제되었습니다`, 'success');
      } catch (error) {
        debug('Failed to clear logs:', error);
        showToast(`로그 삭제 실패: ${error}`, 'error');
      }
    }
  });

  // Close modals when clicking outside
  [addProjectModal, addSnippetModal, settingsModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('modal--visible');
    });
  });

  // Keyboard events
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      [addProjectModal, addSnippetModal, settingsModal].forEach(m => m.classList.remove('modal--visible'));
      return;
    }
    if (
      addProjectModal.classList.contains('modal--visible') ||
      addSnippetModal.classList.contains('modal--visible') ||
      settingsModal.classList.contains('modal--visible') ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
    ) return;
    handleKeyboardShortcuts(e);
  });

  // Save session state before window closes
  window.addEventListener('beforeunload', () => {
    saveSessionState();
  });

  // Auto-save every 30 seconds
  setInterval(() => {
    if (state.sessions.size > 0) {
      saveSessionState();
    }
  }, 30000);

  debug('Event listeners setup complete');
}

// ===== Initialize =====
async function initialize() {
  debug('Initializing Shellhive...');
  debug('Tauri available:', typeof window.__TAURI__ !== 'undefined');

  initializeDOMElements();
  setupEventListeners();
  setupAccessibility();
  setupFileDragDrop();

  try {
    await loadSettings();
    await loadCategories();
    await loadSnippets();
  } catch (error) {
    debug('Error loading data:', error);
  }

  // Restore previous session state or create new
  await restoreSessionState();

  debug('Shellhive initialized successfully');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
