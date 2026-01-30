import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

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

// DOM Elements
const tabsList = document.getElementById('tabsList');
const terminalContainer = document.getElementById('terminalContainer');
const newTabBtn = document.getElementById('newTabBtn');
const projectList = document.getElementById('projectList');
const addProjectBtn = document.getElementById('addProjectBtn');
const addProjectModal = document.getElementById('addProjectModal');
const closeAddProjectModal = document.getElementById('closeAddProjectModal');
const cancelAddProject = document.getElementById('cancelAddProject');
const confirmAddProject = document.getElementById('confirmAddProject');
const projectNameInput = document.getElementById('projectName');
const projectPathInput = document.getElementById('projectPath');
const browsePathBtn = document.getElementById('browsePathBtn');

// Snippet elements
const snippetList = document.getElementById('snippetList');
const addSnippetBtn = document.getElementById('addSnippetBtn');
const addSnippetModal = document.getElementById('addSnippetModal');
const closeAddSnippetModal = document.getElementById('closeAddSnippetModal');
const cancelAddSnippet = document.getElementById('cancelAddSnippet');
const confirmAddSnippet = document.getElementById('confirmAddSnippet');
const snippetNameInput = document.getElementById('snippetName');
const snippetCommandInput = document.getElementById('snippetCommand');

// Settings elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const cancelSettings = document.getElementById('cancelSettings');
const saveSettingsBtn = document.getElementById('saveSettings');
const settingsTheme = document.getElementById('settingsTheme');
const settingsFontSize = document.getElementById('settingsFontSize');
const fontSizeValue = document.getElementById('fontSizeValue');
const settingsFontFamily = document.getElementById('settingsFontFamily');
const settingsEnableLogging = document.getElementById('settingsEnableLogging');
const clearLogsBtn = document.getElementById('clearLogsBtn');

// ===== Settings Functions =====

async function loadSettings() {
  try {
    const settings = await invoke('get_settings');
    state.settings = settings;
    applyTheme(settings.theme);
    return settings;
  } catch (error) {
    console.error('Failed to load settings:', error);
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
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert(`Failed to save settings: ${error}`);
  }
}

function applyTheme(theme) {
  // Remove existing theme classes
  document.documentElement.classList.remove('theme-light', 'theme-monokai');

  // Apply new theme class
  if (theme === 'light') {
    document.documentElement.classList.add('theme-light');
  } else if (theme === 'monokai') {
    document.documentElement.classList.add('theme-monokai');
  }
  // 'dark' is default, no class needed
}

function updateTerminalSettings(terminal, settings) {
  const theme = TERMINAL_THEMES[settings.theme] || TERMINAL_THEMES.dark;
  terminal.options.theme = theme;
  terminal.options.fontSize = settings.fontSize;
  terminal.options.fontFamily = `${settings.fontFamily}, "Courier New", monospace`;
}

function showSettingsModal() {
  settingsModal.classList.add('modal--visible');

  // Populate current settings
  settingsTheme.value = state.settings.theme;
  settingsFontSize.value = state.settings.fontSize;
  fontSizeValue.textContent = `${state.settings.fontSize}px`;
  settingsFontFamily.value = state.settings.fontFamily;
  settingsEnableLogging.checked = state.settings.enableLogging;
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
    console.error('Failed to load snippets:', error);
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

  // Add event listeners to snippet items
  document.querySelectorAll('#snippetList .sidebar__item').forEach(item => {
    const snippetId = item.dataset.snippetId;
    const command = item.dataset.command;

    // Click on snippet to execute in current terminal
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('sidebar__item-delete')) {
        executeSnippet(command);
      }
    });

    // Delete button
    const deleteBtn = item.querySelector('.sidebar__item-delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeSnippet(snippetId);
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
    console.error('Failed to add snippet:', error);
    alert(`Failed to add snippet: ${error}`);
  }
}

async function removeSnippet(id) {
  try {
    await invoke('remove_snippet', { id });
    await loadSnippets();
  } catch (error) {
    console.error('Failed to remove snippet:', error);
    alert(`Failed to remove snippet: ${error}`);
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
    // Write the command followed by Enter
    await invoke('write_pty', {
      sessionId: session.ptySessionId,
      data: command + '\r'
    });
  } catch (error) {
    console.error('Failed to execute snippet:', error);
    alert(`Failed to execute snippet: ${error}`);
  }
}

function showAddSnippetModal() {
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
    renderProjectList(projects);
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
}

function renderProjectList(projects) {
  projectList.innerHTML = projects.map(p => `
    <li class="sidebar__item" data-project-id="${p.id}" data-path="${escapeHtml(p.path)}">
      <span class="sidebar__item-icon">folder</span>
      <span class="sidebar__item-name">${escapeHtml(p.name)}</span>
      <button class="sidebar__item-delete" data-project-id="${p.id}">&times;</button>
    </li>
  `).join('');

  // Add event listeners to project items
  document.querySelectorAll('#projectList .sidebar__item').forEach(item => {
    const projectId = item.dataset.projectId;
    const projectPath = item.dataset.path;
    const projectName = item.querySelector('.sidebar__item-name').textContent;

    // Click on project to open terminal in that directory
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('sidebar__item-delete')) {
        createSessionInDirectory(projectPath, projectName);
      }
    });

    // Delete button
    const deleteBtn = item.querySelector('.sidebar__item-delete');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await removeProject(projectId);
    });
  });
}

async function addProject(name, path) {
  try {
    await invoke('add_project', { name, path, shell: null });
    await loadProjects();
  } catch (error) {
    console.error('Failed to add project:', error);
    alert(`Failed to add project: ${error}`);
  }
}

async function removeProject(id) {
  try {
    await invoke('remove_project', { id });
    await loadProjects();
  } catch (error) {
    console.error('Failed to remove project:', error);
    alert(`Failed to remove project: ${error}`);
  }
}

// Modal management
function showAddProjectModal() {
  addProjectModal.classList.add('modal--visible');
  projectNameInput.value = '';
  projectPathInput.value = '';
  projectNameInput.focus();
}

function hideAddProjectModal() {
  addProjectModal.classList.remove('modal--visible');
}

// ===== Session Functions =====

// Create terminal session
async function createSession(name = null, workingDir = null) {
  const id = `session-${++state.sessionCounter}`;
  const sessionName = name || `Terminal ${state.sessionCounter}`;

  // Create terminal wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-wrapper';
  wrapper.id = `terminal-${id}`;
  terminalContainer.appendChild(wrapper);

  // Get theme for terminal
  const theme = TERMINAL_THEMES[state.settings.theme] || TERMINAL_THEMES.dark;

  // Initialize xterm.js
  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: state.settings.fontSize,
    fontFamily: `${state.settings.fontFamily}, "Courier New", monospace`,
    theme: theme,
    allowTransparency: false,
    scrollback: 5000,
  });

  const fitAddon = new FitAddon();
  const webLinksAddon = new WebLinksAddon();

  terminal.loadAddon(fitAddon);
  terminal.loadAddon(webLinksAddon);

  terminal.open(wrapper);
  fitAddon.fit();

  // Welcome message
  terminal.writeln('\x1b[1;36m========================================\x1b[0m');
  terminal.writeln('\x1b[1;36m       Welcome to Shellhive!           \x1b[0m');
  terminal.writeln('\x1b[1;36m========================================\x1b[0m');
  terminal.writeln('');
  terminal.writeln('\x1b[90mConnecting to PTY...\x1b[0m');
  terminal.writeln('');

  // Create PTY session
  let ptySessionId;
  let unlistenPtyData;

  try {
    // Use provided working directory or get user home directory
    const dir = workingDir || await invoke('get_home_dir');

    // Create PTY with default shell
    ptySessionId = await invoke('create_pty', {
      workingDir: dir,
      shell: null,
    });

    terminal.writeln('\x1b[32mPTY connected\x1b[0m');
    terminal.writeln('');

    // Listen for PTY output
    unlistenPtyData = await listen(`pty-data:${ptySessionId}`, (event) => {
      terminal.write(event.payload);

      // Log output if enabled
      if (state.settings.enableLogging) {
        logSessionOutput(ptySessionId, event.payload);
      }
    });

    // Handle terminal input - send to PTY
    terminal.onData(async (data) => {
      try {
        await invoke('write_pty', { sessionId: ptySessionId, data });
      } catch (error) {
        console.error('Failed to write to PTY:', error);
      }
    });

  } catch (error) {
    terminal.writeln('\x1b[31mFailed to connect to PTY\x1b[0m');
    terminal.writeln(`\x1b[31m  ${error}\x1b[0m`);
    terminal.writeln('');
    console.error('PTY creation failed:', error);
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
    status: SESSION_STATUS.CONNECTING,
    projectName: name, // Store original project name for display
  };
  state.sessions.set(id, session);

  // Update status to running after PTY connects
  if (ptySessionId) {
    session.status = SESSION_STATUS.RUNNING;
    updateTabStatus(id, SESSION_STATUS.RUNNING);

    // Listen for PTY exit
    listen(`pty-exit:${ptySessionId}`, () => {
      session.status = SESSION_STATUS.EXITED;
      updateTabStatus(id, SESSION_STATUS.EXITED);
    });
  }

  // Create tab
  createTab(session);

  // Activate session
  activateSession(id);

  // Handle resize
  const resizeHandler = async () => {
    if (state.activeSessionId === id) {
      fitAddon.fit();

      // Update PTY size
      if (ptySessionId) {
        try {
          await invoke('resize_pty', {
            sessionId: ptySessionId,
            cols: terminal.cols,
            rows: terminal.rows,
          });
        } catch (error) {
          console.error('Failed to resize PTY:', error);
        }
      }
    }
  };

  window.addEventListener('resize', resizeHandler);
  session.resizeHandler = resizeHandler;

  // Initial resize notification to PTY
  if (ptySessionId) {
    try {
      await invoke('resize_pty', {
        sessionId: ptySessionId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    } catch (error) {
      console.error('Failed to set initial PTY size:', error);
    }
  }

  return session;
}

// Log session output (debounced)
let logBuffer = {};
let logTimeouts = {};

function logSessionOutput(sessionId, data) {
  if (!logBuffer[sessionId]) {
    logBuffer[sessionId] = '';
  }
  logBuffer[sessionId] += data;

  // Clear existing timeout
  if (logTimeouts[sessionId]) {
    clearTimeout(logTimeouts[sessionId]);
  }

  // Debounce: write to file after 500ms of no new data
  logTimeouts[sessionId] = setTimeout(async () => {
    const buffer = logBuffer[sessionId];
    logBuffer[sessionId] = '';

    try {
      await invoke('log_session_output', { sessionId, data: buffer });
    } catch (error) {
      console.error('Failed to log session output:', error);
    }
  }, 500);
}

// Create tab element
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

  // Click to activate
  tab.addEventListener('click', (e) => {
    if (!e.target.classList.contains('tab__close')) {
      activateSession(session.id);
    }
  });

  // Close button
  tab.querySelector('.tab__close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeSession(session.id);
  });

  // Drag and drop for tab reordering
  tab.addEventListener('dragstart', handleTabDragStart);
  tab.addEventListener('dragenter', handleTabDragEnter);
  tab.addEventListener('dragover', handleTabDragOver);
  tab.addEventListener('dragleave', handleTabDragLeave);
  tab.addEventListener('drop', handleTabDrop);
  tab.addEventListener('dragend', handleTabDragEnd);

  // Context menu
  tab.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showTabContextMenu(e, session.id);
  });

  tabsList.appendChild(tab);
}

// Get status icon for session
function getStatusIcon(status) {
  switch (status) {
    case SESSION_STATUS.CONNECTING:
      return '*';
    case SESSION_STATUS.RUNNING:
      return 'o';
    case SESSION_STATUS.EXITED:
      return '-';
    default:
      return '-';
  }
}

// Update tab status
function updateTabStatus(sessionId, status) {
  const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
  if (!tab) return;

  const statusElement = tab.querySelector('.tab__status');
  if (statusElement) {
    statusElement.textContent = getStatusIcon(status);
    statusElement.className = `tab__status tab__status--${status}`;
  }
}

// Activate session
function activateSession(id) {
  const session = state.sessions.get(id);
  if (!session) return;

  // Deactivate all
  state.sessions.forEach((s) => {
    s.wrapper.classList.remove('terminal-wrapper--active');
  });
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.remove('tab--active');
  });

  // Activate selected
  session.wrapper.classList.add('terminal-wrapper--active');
  const tab = document.querySelector(`[data-session-id="${id}"]`);
  if (tab) {
    tab.classList.add('tab--active');
  }

  state.activeSessionId = id;
  session.fitAddon.fit();
  session.terminal.focus();
}

// Close session
async function closeSession(id) {
  const session = state.sessions.get(id);
  if (!session) return;

  // Kill PTY if exists
  if (session.ptySessionId) {
    try {
      await invoke('kill_pty', { sessionId: session.ptySessionId });
    } catch (error) {
      console.error('Failed to kill PTY:', error);
    }
  }

  // Unlisten from PTY events
  if (session.unlistenPtyData) {
    session.unlistenPtyData();
  }

  // Remove resize handler
  if (session.resizeHandler) {
    window.removeEventListener('resize', session.resizeHandler);
  }

  // Dispose terminal
  session.terminal.dispose();
  session.wrapper.remove();

  // Remove tab
  const tab = document.querySelector(`[data-session-id="${id}"]`);
  if (tab) {
    tab.remove();
  }

  // Remove from state
  state.sessions.delete(id);

  // Activate another session if this was active
  if (state.activeSessionId === id) {
    const remaining = Array.from(state.sessions.keys());
    if (remaining.length > 0) {
      activateSession(remaining[remaining.length - 1]);
    } else {
      state.activeSessionId = null;
    }
  }
}

// Helper function to create session in specific directory
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
    state.dropTarget = e.currentTarget;
  }
}

function handleTabDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleTabDragLeave(e) {
  e.currentTarget.classList.remove('tab--drop-target');
}

function handleTabDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }

  if (state.draggedTab !== e.currentTarget) {
    // Reorder tabs
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
  state.dropTarget = null;
}

// Tab context menu
function showTabContextMenu(e, sessionId) {
  // Remove existing context menu
  const existingMenu = document.getElementById('tabContextMenu');
  if (existingMenu) {
    existingMenu.remove();
  }

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

  // Handle menu item clicks
  menu.addEventListener('click', async (e) => {
    const action = e.target.dataset.action;
    if (!action) return;

    switch (action) {
      case 'duplicate':
        await duplicateSession(sessionId);
        break;
      case 'close':
        await closeSession(sessionId);
        break;
      case 'close-others':
        await closeOtherSessions(sessionId);
        break;
    }

    menu.remove();
  });

  document.body.appendChild(menu);

  // Close menu when clicking outside
  const closeMenu = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => {
    document.addEventListener('click', closeMenu);
  }, 0);
}

// Duplicate session
async function duplicateSession(sessionId) {
  const session = state.sessions.get(sessionId);
  if (!session) return;

  // Get working directory from original session
  // For now, create a new session with the same project name
  await createSession(session.projectName || `Terminal ${state.sessionCounter + 1}`);
}

// Close other sessions
async function closeOtherSessions(keepSessionId) {
  const sessionsToClose = Array.from(state.sessions.keys()).filter(id => id !== keepSessionId);
  for (const id of sessionsToClose) {
    await closeSession(id);
  }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // Ctrl+T: New tab
  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    createSession();
    return;
  }

  // Ctrl+W: Close current tab
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (state.activeSessionId) {
      closeSession(state.activeSessionId);
    }
    return;
  }

  // Ctrl+Tab: Next tab
  if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
    e.preventDefault();
    switchToNextTab();
    return;
  }

  // Ctrl+Shift+Tab: Previous tab
  if (e.ctrlKey && e.key === 'Tab' && e.shiftKey) {
    e.preventDefault();
    switchToPreviousTab();
    return;
  }

  // Ctrl+1-9: Switch to specific tab
  if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
    e.preventDefault();
    const tabIndex = parseInt(e.key) - 1;
    switchToTabByIndex(tabIndex);
    return;
  }

  // Ctrl+,: Open settings
  if (e.ctrlKey && e.key === ',') {
    e.preventDefault();
    showSettingsModal();
    return;
  }
}

// Switch to next tab
function switchToNextTab() {
  const sessionIds = Array.from(state.sessions.keys());
  if (sessionIds.length === 0) return;

  const currentIndex = sessionIds.indexOf(state.activeSessionId);
  const nextIndex = (currentIndex + 1) % sessionIds.length;
  activateSession(sessionIds[nextIndex]);
}

// Switch to previous tab
function switchToPreviousTab() {
  const sessionIds = Array.from(state.sessions.keys());
  if (sessionIds.length === 0) return;

  const currentIndex = sessionIds.indexOf(state.activeSessionId);
  const prevIndex = currentIndex === 0 ? sessionIds.length - 1 : currentIndex - 1;
  activateSession(sessionIds[prevIndex]);
}

// Switch to tab by index
function switchToTabByIndex(index) {
  const sessionIds = Array.from(state.sessions.keys());
  if (index >= 0 && index < sessionIds.length) {
    activateSession(sessionIds[index]);
  }
}

// ===== Event Listeners =====

newTabBtn.addEventListener('click', () => {
  createSession();
});

// Project modal events
addProjectBtn.addEventListener('click', () => {
  showAddProjectModal();
});

closeAddProjectModal.addEventListener('click', () => {
  hideAddProjectModal();
});

cancelAddProject.addEventListener('click', () => {
  hideAddProjectModal();
});

confirmAddProject.addEventListener('click', async () => {
  const name = projectNameInput.value.trim();
  const path = projectPathInput.value.trim();

  if (!name) {
    alert('Please enter a project name.');
    return;
  }

  if (!path) {
    alert('Please enter a project path.');
    return;
  }

  await addProject(name, path);
  hideAddProjectModal();
});

browsePathBtn.addEventListener('click', async () => {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Project Folder',
    });

    if (selected) {
      projectPathInput.value = selected;

      // Auto-fill project name from folder name if empty
      if (!projectNameInput.value.trim()) {
        const folderName = selected.split(/[\\/]/).pop();
        projectNameInput.value = folderName;
      }
    }
  } catch (error) {
    console.error('Failed to open folder dialog:', error);
  }
});

// Snippet modal events
addSnippetBtn.addEventListener('click', () => {
  showAddSnippetModal();
});

closeAddSnippetModal.addEventListener('click', () => {
  hideAddSnippetModal();
});

cancelAddSnippet.addEventListener('click', () => {
  hideAddSnippetModal();
});

confirmAddSnippet.addEventListener('click', async () => {
  const name = snippetNameInput.value.trim();
  const command = snippetCommandInput.value.trim();

  if (!name) {
    alert('Please enter a snippet name.');
    return;
  }

  if (!command) {
    alert('Please enter a command.');
    return;
  }

  await addSnippet(name, command);
  hideAddSnippetModal();
});

// Settings modal events
settingsBtn.addEventListener('click', () => {
  showSettingsModal();
});

closeSettingsModal.addEventListener('click', () => {
  hideSettingsModal();
});

cancelSettings.addEventListener('click', () => {
  hideSettingsModal();
});

settingsFontSize.addEventListener('input', (e) => {
  fontSizeValue.textContent = `${e.target.value}px`;
});

saveSettingsBtn.addEventListener('click', async () => {
  const settings = {
    theme: settingsTheme.value,
    font_size: parseInt(settingsFontSize.value),
    font_family: settingsFontFamily.value,
    enable_logging: settingsEnableLogging.checked,
  };

  await saveSettings(settings);
  hideSettingsModal();
});

clearLogsBtn.addEventListener('click', async () => {
  if (confirm('Are you sure you want to delete all session logs?')) {
    try {
      const count = await invoke('clear_all_logs');
      alert(`Deleted ${count} log files.`);
    } catch (error) {
      console.error('Failed to clear logs:', error);
      alert(`Failed to clear logs: ${error}`);
    }
  }
});

// Close modals when clicking outside
addProjectModal.addEventListener('click', (e) => {
  if (e.target === addProjectModal) {
    hideAddProjectModal();
  }
});

addSnippetModal.addEventListener('click', (e) => {
  if (e.target === addSnippetModal) {
    hideAddSnippetModal();
  }
});

settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) {
    hideSettingsModal();
  }
});

// Close modals with ESC key and handle keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Close modals with ESC
  if (e.key === 'Escape') {
    if (addProjectModal.classList.contains('modal--visible')) {
      hideAddProjectModal();
      return;
    }
    if (addSnippetModal.classList.contains('modal--visible')) {
      hideAddSnippetModal();
      return;
    }
    if (settingsModal.classList.contains('modal--visible')) {
      hideSettingsModal();
      return;
    }
  }

  // Don't handle shortcuts when modal is open or when typing in input
  if (
    addProjectModal.classList.contains('modal--visible') ||
    addSnippetModal.classList.contains('modal--visible') ||
    settingsModal.classList.contains('modal--visible') ||
    e.target.tagName === 'INPUT' ||
    e.target.tagName === 'TEXTAREA' ||
    e.target.tagName === 'SELECT'
  ) {
    return;
  }

  handleKeyboardShortcuts(e);
});

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings first
  await loadSettings();

  // Load projects and snippets
  await loadProjects();
  await loadSnippets();

  // Create initial terminal session
  createSession('Terminal 1');
});
