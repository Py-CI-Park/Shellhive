import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';

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

// Create terminal session
function createSession(name = null) {
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

  // Handle input (will be connected to PTY later)
  terminal.onData((data) => {
    // Echo for now (will be replaced with PTY communication)
    terminal.write(data);
  });

  // Store session
  const session = {
    id,
    name: sessionName,
    terminal,
    fitAddon,
    wrapper,
  };
  state.sessions.set(id, session);

  // Create tab
  createTab(session);

  // Activate session
  activateSession(id);

  // Handle resize
  window.addEventListener('resize', () => {
    if (state.activeSessionId === id) {
      fitAddon.fit();
    }
  });

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
function closeSession(id) {
  const session = state.sessions.get(id);
  if (!session) return;

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

// Event listeners
newTabBtn.addEventListener('click', () => {
  createSession();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  createSession('Terminal 1');
});
