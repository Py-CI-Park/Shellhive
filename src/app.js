import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

// State
const state = {
  sessions: new Map(),
  activeSessionId: null,
  sessionCounter: 0,
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

// Project management functions
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
    <li class="sidebar__item" data-project-id="${p.id}" data-path="${p.path}">
      <span class="sidebar__item-icon">📁</span>
      <span class="sidebar__item-name">${p.name}</span>
      <button class="sidebar__item-delete" data-project-id="${p.id}">×</button>
    </li>
  `).join('');

  // Add event listeners to project items
  document.querySelectorAll('.sidebar__item').forEach(item => {
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
    alert(`프로젝트 추가 실패: ${error}`);
  }
}

async function removeProject(id) {
  try {
    await invoke('remove_project', { id });
    await loadProjects();
  } catch (error) {
    console.error('Failed to remove project:', error);
    alert(`프로젝트 삭제 실패: ${error}`);
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

// Create terminal session
async function createSession(name = null, workingDir = null) {
  const id = `session-${++state.sessionCounter}`;
  const sessionName = name || `Terminal ${state.sessionCounter}`;

  // Create terminal wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-wrapper';
  wrapper.id = `terminal-${id}`;
  terminalContainer.appendChild(wrapper);

  // Initialize xterm.js
  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: 'block',
    fontSize: 14,
    fontFamily: 'Consolas, "Courier New", monospace',
    theme: {
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
  terminal.writeln('\x1b[1;36m╔═══════════════════════════════════════╗\x1b[0m');
  terminal.writeln('\x1b[1;36m║        Welcome to Shellhive!          ║\x1b[0m');
  terminal.writeln('\x1b[1;36m╚═══════════════════════════════════════╝\x1b[0m');
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

    terminal.writeln('\x1b[32m✓ PTY connected\x1b[0m');
    terminal.writeln('');

    // Listen for PTY output
    unlistenPtyData = await listen(`pty-data:${ptySessionId}`, (event) => {
      terminal.write(event.payload);
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
    terminal.writeln('\x1b[31m✗ Failed to connect to PTY\x1b[0m');
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
  };
  state.sessions.set(id, session);

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

// Create tab element
function createTab(session) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.sessionId = session.id;

  tab.innerHTML = `
    <span class="tab__title">${session.name}</span>
    <button class="tab__close">×</button>
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

  tabsList.appendChild(tab);
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

// Event listeners
newTabBtn.addEventListener('click', () => {
  createSession();
});

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
    alert('프로젝트 이름을 입력해주세요.');
    return;
  }

  if (!path) {
    alert('프로젝트 경로를 입력해주세요.');
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
      title: '프로젝트 폴더 선택',
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

// Close modal when clicking outside
addProjectModal.addEventListener('click', (e) => {
  if (e.target === addProjectModal) {
    hideAddProjectModal();
  }
});

// Close modal with ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && addProjectModal.classList.contains('modal--visible')) {
    hideAddProjectModal();
  }
});

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadProjects();
  createSession('Terminal 1');
});
