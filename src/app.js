import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

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
};

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
  },
  snippets: [],
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

    // Update all existing terminals
    state.sessions.forEach((session) => {
      updateTerminalSettings(session.terminal, settings);
    });
    debug('Settings saved');
  } catch (error) {
    debug('Failed to save settings:', error);
    alert(`Failed to save settings: ${error}`);
  }
}

function applyTheme(theme) {
  document.documentElement.classList.remove('theme-light', 'theme-monokai');
  if (theme === 'light') {
    document.documentElement.classList.add('theme-light');
  } else if (theme === 'monokai') {
    document.documentElement.classList.add('theme-monokai');
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
}

function hideSettingsModal() {
  settingsModal.classList.remove('modal--visible');
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
    <li class="sidebar__item" data-snippet-id="${s.id}" data-command="${escapeHtml(s.command)}" data-tooltip="${escapeHtml(s.command)}">
      <span class="sidebar__item-icon">></span>
      <span class="sidebar__item-name">${escapeHtml(s.name)}</span>
      <button class="sidebar__item-delete" data-snippet-id="${s.id}">&times;</button>
    </li>
  `).join('');

  document.querySelectorAll('#snippetList .sidebar__item').forEach(item => {
    const command = item.dataset.command;
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
  } catch (error) {
    debug('Failed to add snippet:', error);
    alert(`Failed to add snippet: ${error}`);
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
    alert('No active terminal session');
    return;
  }
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.ptySessionId) {
    alert('Terminal session is not connected');
    return;
  }
  try {
    await invoke('write_pty', {
      sessionId: session.ptySessionId,
      data: command + '\r'
    });
  } catch (error) {
    debug('Failed to execute snippet:', error);
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
  projectList.innerHTML = projects.map(p => `
    <li class="sidebar__item" data-project-id="${p.id}" data-path="${escapeHtml(p.path)}">
      <span class="sidebar__item-icon">📁</span>
      <span class="sidebar__item-name">${escapeHtml(p.name)}</span>
      <button class="sidebar__item-delete" data-project-id="${p.id}">&times;</button>
    </li>
  `).join('');

  document.querySelectorAll('#projectList .sidebar__item').forEach(item => {
    const projectPath = item.dataset.path;
    const projectName = item.querySelector('.sidebar__item-name').textContent;
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('sidebar__item-delete')) {
        createSessionInDirectory(projectPath, projectName);
      }
    });
    const deleteBtn = item.querySelector('.sidebar__item-delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeProject(deleteBtn.dataset.projectId);
    });
  });
}

async function addProject(name, path) {
  try {
    await invoke('add_project', { name, path, shell: null });
    await loadProjects();
  } catch (error) {
    debug('Failed to add project:', error);
    alert(`Failed to add project: ${error}`);
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

async function createSession(name = null, workingDir = null) {
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

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);

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

    // Create PTY with default shell
    ptySessionId = await invoke('create_pty', {
      workingDir: dir,
      shell: null,
    });
    debug('PTY session created:', ptySessionId);

    terminal.writeln('\x1b[32mPTY connected!\x1b[0m');
    terminal.writeln('');

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
  }

  // Store session
  const session = {
    id,
    name: sessionName,
    terminal,
    fitAddon,
    wrapper,
    ptySessionId,
    unlistenPtyData,
    unlistenPtyExit,
    status: ptySessionId ? SESSION_STATUS.RUNNING : SESSION_STATUS.EXITED,
    projectName: name,
  };
  state.sessions.set(id, session);

  // Create tab
  createTab(session);

  // Activate session
  activateSession(id);

  // Handle resize
  const resizeHandler = () => {
    if (state.activeSessionId === id) {
      fitAddon.fit();
    }
  };
  window.addEventListener('resize', resizeHandler);
  session.resizeHandler = resizeHandler;

  return session;
}

let logBuffer = {};
let logTimeouts = {};

function logSessionOutput(sessionId, data) {
  if (!logBuffer[sessionId]) {
    logBuffer[sessionId] = '';
  }
  logBuffer[sessionId] += data;

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
  setTimeout(() => {
    session.fitAddon.fit();
    session.terminal.focus();
  }, 50);
}

async function closeSession(id) {
  const session = state.sessions.get(id);
  if (!session) return;

  if (session.ptySessionId) {
    try {
      await invoke('kill_pty', { sessionId: session.ptySessionId });
    } catch (error) {
      debug('Failed to kill PTY:', error);
    }
  }

  if (session.unlistenPtyData) session.unlistenPtyData();
  if (session.unlistenPtyExit) session.unlistenPtyExit();
  if (session.resizeHandler) window.removeEventListener('resize', session.resizeHandler);

  session.terminal.dispose();
  session.wrapper.remove();

  const tab = document.querySelector(`[data-session-id="${id}"]`);
  if (tab) tab.remove();

  state.sessions.delete(id);

  if (state.activeSessionId === id) {
    const remaining = Array.from(state.sessions.keys());
    if (remaining.length > 0) {
      activateSession(remaining[remaining.length - 1]);
    } else {
      state.activeSessionId = null;
    }
  }
}

async function createSessionInDirectory(path, projectName) {
  await createSession(`${projectName}`, path);
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
  menu.innerHTML = `
    <div class="context-menu__item" data-action="duplicate">Duplicate</div>
    <div class="context-menu__item" data-action="close">Close</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="close-others">Close Other Tabs</div>
  `;

  menu.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;
    switch (action) {
      case 'duplicate': await duplicateSession(sessionId); break;
      case 'close': await closeSession(sessionId); break;
      case 'close-others': await closeOtherSessions(sessionId); break;
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

function handleKeyboardShortcuts(e) {
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    createSession();
    return;
  }
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (state.activeSessionId) closeSession(state.activeSessionId);
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
      alert(`Failed to open folder dialog: ${error}`);
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
    await saveSettings({
      theme: settingsTheme.value,
      font_size: parseInt(settingsFontSize.value),
      font_family: settingsFontFamily.value,
      enable_logging: settingsEnableLogging.checked,
    });
    hideSettingsModal();
  });

  clearLogsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to delete all session logs?')) {
      try {
        const count = await invoke('clear_all_logs');
        alert(`Deleted ${count} log files.`);
      } catch (error) {
        debug('Failed to clear logs:', error);
        alert(`Failed to clear logs: ${error}`);
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

  debug('Event listeners setup complete');
}

// ===== Initialize =====
async function initialize() {
  debug('Initializing Shellhive...');
  debug('Tauri available:', typeof window.__TAURI__ !== 'undefined');

  initializeDOMElements();
  setupEventListeners();

  try {
    await loadSettings();
    await loadProjects();
    await loadSnippets();
  } catch (error) {
    debug('Error loading data:', error);
  }

  // Create initial terminal session
  createSession('Terminal 1');

  debug('Shellhive initialized successfully');
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
