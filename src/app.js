import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import 'xterm/css/xterm.css';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';

import { setLocale } from './i18n/index.js';
import { createHistoryPanel, showHistoryPanel } from './history-panel.js';
import { LAYOUT_PRESETS, TAB_COLORS } from './ui-constants.js';
import { createGitPanelController } from './git-panel.js';
import { createErrorExplanationController } from './error-explanations.js';
import { createModalController } from './modals.js';
import { createSettingsController } from './settings.js';
import { createShortcutsController } from './shortcuts.js';
import { createSessionManagerController } from './session-manager.js';
import { SplitNode, serializeSplitTree, deserializeSplitTree, updateSessionIdsInTree } from './split-pane.js';
import { createTabManagerController } from './tab-manager.js';
import { initializeDomElementsRegistry } from './dom-elements.js';
import { createTerminalManagerController } from './terminal-manager.js';
import {
  state,
  elements,
  TabGroup,
  TERMINAL_THEMES,
  SESSION_STATUS,
  SESSION_STATUS_LABELS,
  eventBus
} from './state.js';

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
    <button class="toast__close" aria-label="알림 닫기">&times;</button>
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

const { showConfirmDialog, setupModalOverlayClose, closeVisibleModals } = createModalController({
  escapeHtml
});

const { showErrorExplanation, detectErrorPattern } = createErrorExplanationController({
  state,
  invoke,
  debug,
  showToast,
  escapeHtml,
  escapeHtmlAttr
});

const DEBUG_LOG_ENABLED = (() => {
  if (import.meta.env?.DEV) return true;
  try {
    return localStorage.getItem('shellhive:debug') === '1';
  } catch (_) {
    return false;
  }
})();

// Debug logging
function debug(...args) {
  if (!DEBUG_LOG_ENABLED) return;
  console.log('[Shellhive]', ...args);
}

const SAFE_SESSION_STATUSES = new Set(Object.values(SESSION_STATUS));

const ALLOWED_TAB_COLOR_VALUES = state.allowedTabColorValues;

function getSessionStatusClass(status) {
  if (typeof status !== 'string') return SESSION_STATUS.EXITED;
  return SAFE_SESSION_STATUSES.has(status) ? status : SESSION_STATUS.EXITED;
}

function getSafeTabColor(color) {
  if (typeof color !== 'string') return null;
  const normalized = color.trim();
  return ALLOWED_TAB_COLOR_VALUES.has(normalized) ? normalized : null;
}

const LAYOUT_PRESET_TITLES = Object.freeze({
  'two-columns': '2열',
  'two-rows': '2행',
  'grid-2x2': '2x2 그리드',
  'three-columns': '3열',
  'main-sidebar': '메인 + 사이드'
});

const LAYOUT_PRESET_DESCRIPTIONS = Object.freeze({
  'two-columns': '좌우 2분할',
  'two-rows': '상하 2분할',
  'grid-2x2': '균등 4분할',
  'three-columns': '좌우 3분할',
  'main-sidebar': '메인 작업 + 보조 패널'
});

// ===== Command Block System (Warp-style) =====
// Note: CommandBlock class is defined below with BlockManager (line ~900+)

// ===== Session Recording System =====

class SessionRecording {
  constructor(sessionId) {
    this.id = `recording-${Date.now()}`;
    this.sessionId = sessionId;
    this.events = []; // {timestamp, type, data}
    this.startTime = null;
    this.endTime = null;
    this.metadata = {
      title: '',
      cols: 80,
      rows: 24,
      shell: 'powershell'
    };
  }

  start(cols = 80, rows = 24) {
    this.startTime = Date.now();
    this.metadata.cols = cols;
    this.metadata.rows = rows;
    this.events = [];
  }

  addEvent(type, data) {
    if (!this.startTime) return;
    const timestamp = Date.now() - this.startTime;
    this.events.push({ timestamp, type, data });
  }

  stop() {
    this.endTime = Date.now();
  }

  getDuration() {
    if (!this.startTime) return 0;
    const end = this.endTime || Date.now();
    return end - this.startTime;
  }

  // Export to asciinema v2 format
  export() {
    const header = {
      version: 2,
      width: this.metadata.cols,
      height: this.metadata.rows,
      timestamp: Math.floor(this.startTime / 1000),
      title: this.metadata.title || 'Shellhive Recording',
      env: {
        SHELL: this.metadata.shell,
        TERM: 'xterm-256color'
      }
    };

    // Convert events to asciinema format: [time, type, data]
    const events = this.events
      .filter(e => e.type === 'output')
      .map(e => [e.timestamp / 1000, 'o', e.data]);

    return { header, events };
  }

  // Export as JSON string (asciinema format)
  exportAsString() {
    const { header, events } = this.export();
    let result = JSON.stringify(header) + '\n';
    events.forEach(e => {
      result += JSON.stringify(e) + '\n';
    });
    return result;
  }

  // Save to localStorage
  save() {
    const recordings = SessionRecording.loadAll();
    const existingIndex = recordings.findIndex(r => r.id === this.id);

    const data = {
      id: this.id,
      sessionId: this.sessionId,
      events: this.events,
      startTime: this.startTime,
      endTime: this.endTime,
      metadata: this.metadata
    };

    if (existingIndex >= 0) {
      recordings[existingIndex] = data;
    } else {
      recordings.unshift(data);
    }

    // Keep only last 20 recordings
    const trimmed = recordings.slice(0, 20);

    try {
      localStorage.setItem('shellhive-recordings', JSON.stringify(trimmed));
    } catch (error) {
      debug('Failed to save recording:', error);
    }
  }

  // Load all recordings from localStorage
  static loadAll() {
    try {
      const data = localStorage.getItem('shellhive-recordings');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      debug('Failed to load recordings:', error);
      return [];
    }
  }

  // Load a specific recording
  static load(id) {
    const recordings = SessionRecording.loadAll();
    const data = recordings.find(r => r.id === id);
    if (!data) return null;

    const recording = new SessionRecording(data.sessionId);
    recording.id = data.id;
    recording.events = data.events;
    recording.startTime = data.startTime;
    recording.endTime = data.endTime;
    recording.metadata = data.metadata;
    return recording;
  }

  // Delete a recording
  static delete(id) {
    const recordings = SessionRecording.loadAll();
    const filtered = recordings.filter(r => r.id !== id);
    try {
      localStorage.setItem('shellhive-recordings', JSON.stringify(filtered));
    } catch (error) {
      debug('Failed to delete recording:', error);
    }
  }
}

// Recording Player for playback
class RecordingPlayer {
  constructor(terminal, recording) {
    this.terminal = terminal;
    this.recording = recording;
    this.currentIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.speed = 1;
    this.timeoutId = null;
    this.startTime = 0;
    this.pausedAt = 0;
    this.onProgress = null;
    this.onComplete = null;
    this.onStateChange = null;
  }

  play() {
    if (this.isPlaying && !this.isPaused) return;

    if (this.isPaused) {
      // Resume from pause
      this.isPaused = false;
      this.startTime = Date.now() - this.pausedAt;
    } else {
      // Start fresh
      this.terminal.clear();
      this.currentIndex = 0;
      this.startTime = Date.now();
    }

    this.isPlaying = true;
    if (this.onStateChange) this.onStateChange('playing');
    this.scheduleNextEvent();
  }

  pause() {
    if (!this.isPlaying || this.isPaused) return;

    this.isPaused = true;
    this.pausedAt = Date.now() - this.startTime;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.onStateChange) this.onStateChange('paused');
  }

  stop() {
    this.isPlaying = false;
    this.isPaused = false;
    this.currentIndex = 0;
    this.pausedAt = 0;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.onStateChange) this.onStateChange('stopped');
  }

  seek(timeMs) {
    const wasPlaying = this.isPlaying && !this.isPaused;
    this.stop();

    // Clear terminal and replay up to timeMs
    this.terminal.clear();

    const events = this.recording.events.filter(e => e.type === 'output');
    for (let i = 0; i < events.length; i++) {
      if (events[i].timestamp <= timeMs) {
        this.terminal.write(events[i].data);
        this.currentIndex = i + 1;
      } else {
        break;
      }
    }

    this.pausedAt = timeMs;

    if (wasPlaying) {
      this.isPaused = true;
      this.isPlaying = true;
      this.play();
    } else {
      this.isPaused = true;
      this.isPlaying = true;
      if (this.onStateChange) this.onStateChange('paused');
    }

    this.updateProgress();
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  scheduleNextEvent() {
    if (!this.isPlaying || this.isPaused) return;

    const events = this.recording.events.filter(e => e.type === 'output');

    if (this.currentIndex >= events.length) {
      this.isPlaying = false;
      if (this.onComplete) this.onComplete();
      if (this.onStateChange) this.onStateChange('completed');
      return;
    }

    const event = events[this.currentIndex];
    const elapsed = Date.now() - this.startTime;
    const targetTime = event.timestamp / this.speed;
    const delay = Math.max(0, targetTime - elapsed);

    this.timeoutId = setTimeout(() => {
      this.terminal.write(event.data);
      this.currentIndex++;
      this.updateProgress();
      this.scheduleNextEvent();
    }, delay);
  }

  updateProgress() {
    if (this.onProgress) {
      const duration = this.recording.getDuration();
      const events = this.recording.events.filter(e => e.type === 'output');
      const currentTime = this.currentIndex < events.length
        ? events[this.currentIndex]?.timestamp || 0
        : duration;
      this.onProgress(currentTime, duration);
    }
  }

  getCurrentTime() {
    if (this.isPaused) return this.pausedAt;
    if (!this.isPlaying) return 0;
    return Date.now() - this.startTime;
  }
}

// Recording state manager
const recordingManager = {
  activeRecording: null,
  activeSessionId: null,

  startRecording(sessionId) {
    const session = state.sessions.get(sessionId);
    if (!session) return null;

    this.activeRecording = new SessionRecording(sessionId);
    this.activeSessionId = sessionId;

    const { cols, rows } = session.terminal;
    this.activeRecording.start(cols, rows);
    this.activeRecording.metadata.title = session.name;

    debug('Recording started for session:', sessionId);
    return this.activeRecording;
  },

  addOutput(sessionId, data) {
    if (this.activeRecording && this.activeSessionId === sessionId) {
      this.activeRecording.addEvent('output', data);
    }
  },

  stopRecording() {
    if (!this.activeRecording) return null;

    this.activeRecording.stop();
    this.activeRecording.save();

    const recording = this.activeRecording;
    debug('Recording stopped. Duration:', recording.getDuration(), 'ms, Events:', recording.events.length);

    this.activeRecording = null;
    this.activeSessionId = null;

    return recording;
  },

  isRecording(sessionId = null) {
    if (sessionId) {
      return this.activeSessionId === sessionId;
    }
    return this.activeRecording !== null;
  }
};

// Command History Manager
const commandHistory = {
  history: [],
  maxSize: 1000,
  minUsageCount: 3,

  add(command, projectId = null) {
    if (!command || command.trim() === '') return;

    const trimmed = command.trim();
    const now = Date.now();

    // Check if command already exists
    const existing = this.history.find(h => h.command === trimmed && h.projectId === projectId);
    if (existing) {
      existing.lastUsed = now;
      existing.useCount = (existing.useCount || 1) + 1;
    } else {
      this.history.unshift({
        command: trimmed,
        projectId,
        timestamp: now,
        lastUsed: now,
        useCount: 1,
        favorite: false
      });
    }

    // Trim to max size
    if (this.history.length > this.maxSize) {
      this.history = this.history.slice(0, this.maxSize);
    }

    this.save();
  },

  search(query, projectId = null) {
    const lowerQuery = query.toLowerCase();
    return this.history.filter(h => {
      const matchesQuery = h.command.toLowerCase().includes(lowerQuery);
      const matchesProject = projectId === null || h.projectId === projectId;
      return matchesQuery && matchesProject;
    });
  },

  getFavorites(projectId = null) {
    return this.history.filter(h => {
      const isFavorite = h.favorite;
      const matchesProject = projectId === null || h.projectId === projectId;
      return isFavorite && matchesProject;
    });
  },

  getFrequent(limit = 10, projectId = null) {
    return this.history
      .filter(h => {
        const matchesProject = projectId === null || h.projectId === projectId;
        const meetsThreshold = (h.useCount || 1) >= this.minUsageCount;
        return matchesProject && meetsThreshold;
      })
      .sort((a, b) => (b.useCount || 1) - (a.useCount || 1))
      .slice(0, limit);
  },

  toggleFavorite(command, projectId = null) {
    const item = this.history.find(h => h.command === command && h.projectId === projectId);
    if (item) {
      item.favorite = !item.favorite;
      this.save();
      return item.favorite;
    }
    return false;
  },

  delete(command, projectId = null) {
    this.history = this.history.filter(h => !(h.command === command && h.projectId === projectId));
    this.save();
  },

  clear() {
    this.history = [];
    this.save();
  },

  save() {
    try {
      localStorage.setItem('shellhive-history', JSON.stringify(this.history));
    } catch (error) {
      debug('Failed to save command history:', error);
    }
  },

  load() {
    try {
      const data = localStorage.getItem('shellhive-history');
      if (data) {
        this.history = JSON.parse(data);
      }
    } catch (error) {
      debug('Failed to load command history:', error);
      this.history = [];
    }
  }
};

// Autocomplete Manager
const autocomplete = {
  baseCommands: [
    'git', 'npm', 'node', 'cd', 'ls', 'dir', 'mkdir', 'rm', 'cp', 'mv',
    'cat', 'echo', 'grep', 'find', 'curl', 'wget', 'ssh', 'scp',
    'docker', 'kubectl', 'python', 'pip', 'cargo', 'rustc', 'clear',
    'pwd', 'touch', 'code', 'vim', 'nano', 'make', 'gcc', 'g++',
    'java', 'javac', 'go', 'dotnet', 'yarn', 'pnpm', 'composer'
  ],

  gitCommands: [
    'status', 'add', 'commit', 'push', 'pull', 'fetch', 'branch',
    'checkout', 'merge', 'rebase', 'log', 'diff', 'stash', 'reset',
    'clone', 'init', 'remote', 'tag', 'show', 'cherry-pick'
  ],

  npmCommands: [
    'install', 'run', 'start', 'test', 'build', 'init', 'publish',
    'update', 'uninstall', 'list', 'outdated', 'audit', 'ci'
  ],

  dockerCommands: [
    'run', 'build', 'pull', 'push', 'ps', 'images', 'exec', 'logs',
    'stop', 'start', 'restart', 'rm', 'rmi', 'compose', 'network'
  ],

  cargoCommands: [
    'build', 'run', 'test', 'check', 'clean', 'doc', 'new', 'init',
    'add', 'update', 'publish', 'install', 'uninstall', 'bench'
  ],

  getSuggestions(input, projectId = null) {
    if (!input || input.trim() === '') {
      return [];
    }

    const trimmed = input.trim().toLowerCase();
    const suggestions = [];

    // History-based suggestions (highest priority)
    const historySuggestions = commandHistory.history
      .filter(h => {
        const matchesProject = projectId === null || h.projectId === projectId;
        const matchesInput = h.command.toLowerCase().startsWith(trimmed);
        return matchesProject && matchesInput;
      })
      .slice(0, 5)
      .map(h => ({
        command: h.command,
        source: 'history',
        useCount: h.useCount || 1,
        favorite: h.favorite || false
      }));

    suggestions.push(...historySuggestions);

    // Base command suggestions
    const words = trimmed.split(/\s+/);
    const firstWord = words[0];

    if (words.length === 1) {
      // Suggest base commands
      const baseMatches = this.baseCommands
        .filter(cmd => cmd.startsWith(firstWord))
        .map(cmd => ({ command: cmd, source: 'command' }));
      suggestions.push(...baseMatches);
    } else if (words.length >= 2) {
      // Suggest subcommands
      const baseCmd = firstWord;
      const subCmd = words[1];
      let subCommands = [];

      if (baseCmd === 'git') {
        subCommands = this.gitCommands;
      } else if (baseCmd === 'npm') {
        subCommands = this.npmCommands;
      } else if (baseCmd === 'docker') {
        subCommands = this.dockerCommands;
      } else if (baseCmd === 'cargo') {
        subCommands = this.cargoCommands;
      }

      const subMatches = subCommands
        .filter(cmd => cmd.startsWith(subCmd))
        .map(cmd => ({ command: `${baseCmd} ${cmd}`, source: 'command' }));
      suggestions.push(...subMatches);
    }

    // Remove duplicates (prefer history)
    const seen = new Set();
    const unique = suggestions.filter(s => {
      if (seen.has(s.command.toLowerCase())) {
        return false;
      }
      seen.add(s.command.toLowerCase());
      return true;
    });

    // Sort: favorites first, then by use count, then alphabetically
    return unique.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      if (a.useCount && b.useCount) {
        if (a.useCount !== b.useCount) return b.useCount - a.useCount;
      }
      return a.command.localeCompare(b.command);
    }).slice(0, 10); // Limit to 10 suggestions
  }
};

// ===== Block-Based Output (Warp-style) =====

// Generate unique block ID
let blockIdCounter = 0;
function generateBlockId() {
  return `block-${Date.now()}-${++blockIdCounter}`;
}

// CommandBlock class for Warp-style block output
class CommandBlock {
  constructor(command, timestamp = new Date()) {
    this.id = generateBlockId();
    this.command = command;
    this.timestamp = timestamp;
    this.output = [];
    this.exitCode = null;
    this.duration = null;
    this.startTime = Date.now();
    this.collapsed = false;
  }

  addOutput(data) {
    this.output.push(data);
  }

  complete(exitCode = 0) {
    this.exitCode = exitCode;
    this.duration = Date.now() - this.startTime;
  }

  getFormattedTime() {
    return this.timestamp.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  getFormattedDuration() {
    if (this.duration === null) return '';
    const seconds = Math.floor(this.duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  }

  isSuccess() {
    return this.exitCode === 0 || this.exitCode === null;
  }
}

// Block manager for each session
class BlockManager {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.blocks = [];
    this.currentBlock = null;
    this.outputBuffer = '';
    this.container = null;
    this.lastPromptTime = 0;
    // Common shell prompt patterns (Windows CMD, PowerShell, Bash, Zsh)
    this.promptPatterns = [
      /[A-Z]:\\[^>]*>\s*$/,                    // Windows CMD: C:\Users\name>
      /PS [A-Z]:\\[^>]*>\s*$/,                 // PowerShell: PS C:\Users\name>
      // eslint-disable-next-line no-useless-escape
      /\$\s*$/,                                 // Simple bash: $
      // eslint-disable-next-line no-useless-escape
      /[a-zA-Z0-9_-]+@[a-zA-Z0-9_-]+[:\s~][^$#]*[\$#]\s*$/, // user@host:~$
      />\s*$/,                                  // Simple prompt: >
      /\[[^\]]+\]\s*[$#]\s*$/,                // [user@host dir]$
    ];
    this.pendingCommand = null;
  }

  setContainer(container) {
    this.container = container;
  }

  // Detect if output contains a new prompt (command completed)
  detectPrompt(data) {
    // eslint-disable-next-line no-control-regex
    const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ''); // Remove ANSI codes
    for (const pattern of this.promptPatterns) {
      if (pattern.test(cleanData)) {
        return true;
      }
    }
    return false;
  }

  // Process user input (command entry)
  processUserInput(data) {
    if (data.includes('\r') || data.includes('\n')) {
      const command = this.pendingCommand ? this.pendingCommand.trim() : '';
      this.pendingCommand = null;
      if (command.length > 0) {
        // Complete previous block if exists
        if (this.currentBlock) {
          this.currentBlock.complete();
          this.renderBlock(this.currentBlock);
        }
        // Start new block
        this.currentBlock = new CommandBlock(command);
        this.blocks.push(this.currentBlock);
        this.outputBuffer = '';
      }
    } else {
      // Accumulate command input
      if (this.pendingCommand === null) {
        this.pendingCommand = '';
      }
      this.pendingCommand += data;
    }
  }

  // Process PTY output and manage blocks
  processOutput(data) {
    // Accumulate output
    this.outputBuffer += data;

    // Check for prompt pattern (indicates command completion)
    if (this.detectPrompt(this.outputBuffer)) {
      const now = Date.now();
      // Debounce prompt detection (avoid multiple triggers)
      if (now - this.lastPromptTime > 100) {
        this.lastPromptTime = now;

        // Complete current block if exists
        if (this.currentBlock) {
          // Extract output before the prompt
          // eslint-disable-next-line no-control-regex
          const cleanOutput = this.outputBuffer.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
          this.currentBlock.addOutput(cleanOutput);
          this.currentBlock.complete();
          this.renderBlock(this.currentBlock);
          this.currentBlock = null;
        }
        this.outputBuffer = '';
      }
    }
  }

  renderBlock(block) {
    if (!this.container) return;

    const existingBlock = this.container.querySelector(`[data-block-id="${block.id}"]`);
    if (existingBlock) {
      existingBlock.remove();
    }

    const blockEl = document.createElement('div');
    blockEl.className = 'command-block';
    blockEl.dataset.blockId = block.id;
    if (!block.isSuccess()) {
      blockEl.classList.add('command-block--error');
    }
    if (block.collapsed) {
      blockEl.classList.add('command-block--collapsed');
    }

    const statusIcon = block.exitCode === null ? '...' : (block.isSuccess() ? '✓' : '✗');
    const statusClass = block.exitCode === null ? 'pending' : (block.isSuccess() ? 'success' : 'error');

    // Clean output - remove ANSI codes for display
    const cleanOutput = block.output.join('')
      // eslint-disable-next-line no-control-regex
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();

    blockEl.innerHTML = `
      <div class="command-block__header">
        <button class="command-block__collapse" aria-label="접기/펼치기">
          <span class="command-block__collapse-icon">${block.collapsed ? '▶' : '▼'}</span>
        </button>
        <span class="command-block__prompt">$</span>
        <span class="command-block__command">${escapeHtml(block.command)}</span>
        <span class="command-block__time">${block.getFormattedTime()}</span>
        <button class="command-block__copy" aria-label="명령어 복사" title="Copy command">📋</button>
        <button class="command-block__rerun" aria-label="다시 실행" title="Re-run command">▶</button>
      </div>
      <div class="command-block__output">${cleanOutput ? `<pre>${escapeHtml(cleanOutput)}</pre>` : '<span class="command-block__no-output">(출력 없음)</span>'}</div>
      <div class="command-block__footer">
        <span class="command-block__status command-block__status--${statusClass}">${statusIcon}</span>
        ${block.duration !== null ? `<span class="command-block__duration">${block.getFormattedDuration()}</span>` : ''}
      </div>
    `;

    // Add event listeners
    const collapseBtn = blockEl.querySelector('.command-block__collapse');
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      block.collapsed = !block.collapsed;
      blockEl.classList.toggle('command-block--collapsed', block.collapsed);
      collapseBtn.querySelector('.command-block__collapse-icon').textContent = block.collapsed ? '▶' : '▼';
    });

    const copyBtn = blockEl.querySelector('.command-block__copy');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(block.command);
        showToast('명령어가 복사되었습니다', 'success', 2000);
      } catch (err) {
        debug('Failed to copy command:', err);
      }
    });

    const rerunBtn = blockEl.querySelector('.command-block__rerun');
    rerunBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const session = state.sessions.get(this.sessionId);
      if (session && session.ptySessionId) {
        invoke('write_pty', {
          sessionId: session.ptySessionId,
          data: block.command + '\r'
        });
      }
    });

    this.container.appendChild(blockEl);

    // Auto-scroll to bottom
    this.container.scrollTop = this.container.scrollHeight;
  }

  renderAllBlocks() {
    if (!this.container) return;
    this.container.innerHTML = '';
    for (const block of this.blocks) {
      if (block.exitCode !== null) {
        this.renderBlock(block);
      }
    }
  }

  clear() {
    this.blocks = [];
    this.currentBlock = null;
    this.outputBuffer = '';
    this.pendingCommand = null;
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

// DOM Elements - will be initialized after DOM loads
let tabsList, terminalContainer, newTabBtn, projectList, addProjectBtn;
let addProjectModal, closeAddProjectModal, cancelAddProject, confirmAddProject;
let projectNameInput, projectPathInput, browsePathBtn;
let snippetList, addSnippetBtn, addSnippetModal, closeAddSnippetModal;
let cancelAddSnippet, confirmAddSnippet, snippetNameInput, snippetCommandInput;
let settingsBtn, settingsModal, closeSettingsModal, cancelSettings, saveSettingsBtn;
let settingsTheme, settingsFontSize, fontSizeValue, settingsFontFamily;
let settingsEnableLogging, settingsEnableNotifications, settingsBlockMode, clearLogsBtn;

// ===== Settings Functions =====

function getSettingsElements() {
  return {
    settingsModal,
    settingsTheme,
    settingsFontSize,
    fontSizeValue,
    settingsFontFamily,
    settingsEnableLogging,
    settingsEnableNotifications,
    settingsBlockMode
  };
}

const {
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
} = createSettingsController({
  state,
  eventBus,
  invoke,
  debug,
  showToast,
  setLocale,
  commandHistory,
  TERMINAL_THEMES,
  getElements: getSettingsElements
});

function closeActiveSessionByShortcut() {
  if (!state.activeSessionId) return;

  const session = state.sessions.get(state.activeSessionId);
  if (session && !session.pinned) {
    closeSession(state.activeSessionId);
  }
}

function toggleRecordingByShortcut() {
  if (recordingManager.isRecording()) {
    stopRecordingUI();
  } else {
    startRecordingUI();
  }
}

function changeTheme(theme) {
  const root = document.documentElement;
  root.className = `theme-${theme}`;

  if (typeof settingsTheme !== 'undefined' && settingsTheme) {
    settingsTheme.value = theme;
  }

  showToast(`테마가 ${theme}로 변경되었습니다`, 'success');
}

const { handleKeyboardShortcuts } = createShortcutsController({
  escapeHtml,
  showToast,
  debug,
  actions: {
    createSession: () => createSession(),
    closeActiveSession: closeActiveSessionByShortcut,
    restoreLastClosedTab: () => restoreLastClosedTab(),
    splitDefault: () => splitDefault(),
    splitHorizontal: () => splitHorizontal(),
    splitVertical: () => splitVertical(),
    focusLayoutPresetSelector: () => focusLayoutPresetSelector(),
    openLayoutGalleryModal: (preset) => openLayoutGalleryModal(preset),
    getLayoutPresetValue: () => document.getElementById('layoutPresetSelect')?.value || null,
    mergePane: () => mergePane(),
    toggleMaximize: () => toggleMaximize(),
    showTerminalSearch: () => showTerminalSearch(),
    showTabSearch: () => showTabSearch(),
    showSettingsModal: () => showSettingsModal(),
    showAddProjectModal: () => showAddProjectModal(),
    showAddSnippetModal: () => showAddSnippetModal(),
    toggleRecording: toggleRecordingByShortcut,
    clearTerminalScreen: () => clearTerminalScreen(),
    clearTerminalScrollback: () => clearTerminalScrollback(),
    toggleFullscreen: () => toggleFullscreen(),
    showHistoryPanel: () => showHistoryPanel(commandHistory, state, escapeHtml),
    toggleGitPanel: () => toggleGitPanel(),
    switchToNextTab: () => switchToNextTab(),
    switchToPreviousTab: () => switchToPreviousTab(),
    switchToTabByIndex: (index) => switchToTabByIndex(index),
    focusPaneByDirection: (direction) => focusPaneByDirection(direction),
    changeTheme: (theme) => changeTheme(theme)
  }
});

const {
  getStatusIcon,
  getStatusLabel,
  getCompactPathLabel,
  getSplitPaneSubtitle,
  updateTabStatus,
  showTabSearch,
  hideTabSearch,
  filterTabsByQuery,
  switchToNextTab,
  switchToPreviousTab,
  switchToTabByIndex,
  handleTabDragStart,
  handleTabDragEnter,
  handleTabDragOver,
  handleTabDragLeave,
  handleTabDrop,
  handleTabDragEnd,
  setTabColor,
  showColorPickerMenu,
  togglePinTab,
  storeClosedTabInfo,
  restoreLastClosedTab
} = createTabManagerController({
  state,
  SESSION_STATUS,
  SESSION_STATUS_LABELS,
  getSessionStatusClass,
  getSafeTabColor,
  ensureSplitPaneHeader,
  renderSplitMinimap,
  activateSession,
  createSession,
  clearPaneDropIndicators,
  TAB_COLORS,
  escapeHtml,
  escapeHtmlAttr,
  escapeDataAttr,
  debug
});

const { logSessionOutput, disposeSessionLogBuffer } = createSessionManagerController({
  invoke,
  debug
});

const {
  clearTerminalScreen,
  clearTerminalScrollback,
  toggleFullscreen,
  focusPaneByDirection
} = createTerminalManagerController({
  state,
  debug,
  showToast,
  getAllLeafNodes,
  activateSession
});

// ===== Session State Persistence =====

async function saveSessionState() {
  try {
    const sessions = [];
    state.sessions.forEach((session) => {
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
    state.tabGroups.forEach((group) => {
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
    if (state.activeSessionId && state.splitMode && state.splitRoot) {
      tabLayoutsObj[state.activeSessionId] = {
        splitMode: true,
        splitRoot: serializeSplitTree(state.splitRoot)
      };
    }

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

  const tabGroupInfos = Array.isArray(sessionState.tab_groups) ? sessionState.tab_groups : [];
  const sessionInfos = Array.isArray(sessionState.sessions) ? sessionState.sessions : [];

  // Restore tab groups first
  for (const groupInfo of tabGroupInfos) {
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

  for (const sessionInfo of sessionInfos) {
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
  if (sessionState.tab_layouts && typeof sessionState.tab_layouts === 'object') {
    Object.entries(sessionState.tab_layouts).forEach(([oldSessionId, layoutData]) => {
      const newSessionId = sessionIdMap.get(oldSessionId);
      if (newSessionId && state.sessions.has(newSessionId)) {
        const splitRootData = layoutData.splitRoot ?? layoutData.split_root ?? null;
        const splitMode = layoutData.splitMode ?? layoutData.split_mode ?? false;

        // Update session IDs in the split tree
        const updatedSplitRoot = updateSessionIdsInTree(splitRootData, sessionIdMap);
        state.tabLayouts.set(newSessionId, {
          splitMode,
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
  const snippetById = new Map(snippets.map((snippet) => [snippet.id, snippet]));

  snippetList.innerHTML = snippets.map(s => `
    <li class="sidebar__item" data-snippet-id="${escapeDataAttr(s.id)}">
      <span class="sidebar__item-icon">></span>
      <span class="sidebar__item-name">${escapeHtml(s.name)}</span>
      <button class="sidebar__item-delete" data-snippet-id="${escapeDataAttr(s.id)}" aria-label="스니펫 삭제">&times;</button>
    </li>
  `).join('');

  document.querySelectorAll('#snippetList .sidebar__item').forEach(item => {
    const snippet = snippetById.get(item.dataset.snippetId);
    if (!snippet) return;
    item.dataset.tooltip = snippet.command;

    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('sidebar__item-delete')) {
        executeSnippet(snippet.command);
      }
    });
    const deleteBtn = item.querySelector('.sidebar__item-delete');
    deleteBtn.setAttribute('aria-label', `${snippet.name} 스니펫 삭제`);
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

function escapeHtmlAttr(text) {
  return escapeHtml(text)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeDataAttr(value) {
  return escapeHtmlAttr(String(value ?? ''));
}

function normalizeCategoryColor(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
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

// ===== Project Functions =====

async function loadProjects() {
  try {
    const projects = await invoke('list_projects');
    state.projects = projects;
    debug('Projects loaded:', projects.length);
    renderProjectList(projects);
  } catch (error) {
    debug('Failed to load projects:', error);
    state.projects = [];
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
        <li class="sidebar__category" data-category-id="${escapeDataAttr(cat.id)}">
          <div class="sidebar__category-header" data-category-color="${escapeHtmlAttr(cat.color || '')}">
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

  projectList.querySelectorAll('.sidebar__category-header').forEach((header) => {
    const color = normalizeCategoryColor(header.dataset.categoryColor);
    header.style.borderLeftColor = color || 'var(--accent)';
  });

  setupProjectListeners();
}

function renderProjectItems(projects) {
  return projects.map(p => `
    <li class="sidebar__item sidebar__item--project" data-project-id="${escapeDataAttr(p.id)}">
      <span class="sidebar__item-icon">📁</span>
      <span class="sidebar__item-name">${escapeHtml(p.name)}</span>
      <button class="sidebar__item-env" data-project-id="${escapeDataAttr(p.id)}" title="Environment Variables" aria-label="환경 변수 관리">⚙</button>
      <button class="sidebar__item-filter" data-project-id="${escapeDataAttr(p.id)}" title="Filter tabs" aria-label="탭 필터">🔍</button>
      <button class="sidebar__item-delete" data-project-id="${escapeDataAttr(p.id)}" aria-label="프로젝트 삭제">&times;</button>
      <div class="sidebar__cmd-tree" data-project-cmd-tree="${escapeDataAttr(p.id)}"></div>
    </li>
  `).join('');
}

function setupProjectListeners() {
  document.querySelectorAll('#projectList .sidebar__item').forEach(item => {
    const projectId = item.dataset.projectId;
    const project = state.projects.find((p) => p.id === projectId);
    if (!project) return;

    const projectPath = project.path;
    const projectName = project.name;

    item.addEventListener('click', (e) => {
      const blocked = e.target.closest('.sidebar__item-delete, .sidebar__item-filter, .sidebar__item-env, .sidebar__cmd-tree');
      if (blocked) return;
      createSessionInDirectory(projectPath, projectName, projectId);
    });

    const envBtn = item.querySelector('.sidebar__item-env');
    envBtn.setAttribute('aria-label', `${projectName} 환경 변수 관리`);
    envBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEnvVarsModal(projectPath);
    });

    const filterBtn = item.querySelector('.sidebar__item-filter');
    filterBtn.setAttribute('aria-label', `${projectName} 탭 필터`);
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.activeProjectFilter === projectId) {
        clearProjectFilter();
      } else {
        setProjectFilter(projectId);
      }
    });

    const deleteBtn = item.querySelector('.sidebar__item-delete');
    deleteBtn.setAttribute('aria-label', `${projectName} 프로젝트 삭제`);
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

  renderProjectCmdTrees();
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

// ===== Environment Variables Functions =====

let currentEnvVarsProjectPath = null;

async function showEnvVarsModal(projectPath) {
  currentEnvVarsProjectPath = projectPath;

  const modal = document.getElementById('envVarsModal');

  try {
    const envVars = await invoke('load_project_env', { projectPath });
    renderEnvVarsList(envVars);
  } catch (error) {
    debug('Failed to load env vars:', error);
    renderEnvVarsList({});
  }

  modal.classList.add('modal--visible');
}

function hideEnvVarsModal() {
  const modal = document.getElementById('envVarsModal');
  modal.classList.remove('modal--visible');
  currentEnvVarsProjectPath = null;
}

function renderEnvVarsList(envVars) {
  const envVarsList = document.getElementById('envVarsList');
  const entries = Object.entries(envVars);

  if (entries.length === 0) {
    envVarsList.innerHTML = '<div class="env-vars-empty">No environment variables defined. Click "Add Variable" to create one.</div>';
    return;
  }

  envVarsList.innerHTML = entries.map(([_key, _value], index) => `
    <div class="env-var-row" data-index="${index}">
      <input type="text" class="env-var-key" value="" placeholder="KEY">
      <input type="text" class="env-var-value" value="" placeholder="value">
      <button class="env-var-delete" title="Delete" aria-label="환경 변수 삭제">&times;</button>
    </div>
  `).join('');

  envVarsList.querySelectorAll('.env-var-row').forEach((row, index) => {
    const [key, value] = entries[index];
    const keyInput = row.querySelector('.env-var-key');
    const valueInput = row.querySelector('.env-var-value');
    keyInput.value = key;
    valueInput.value = value;
  });

  // Add delete listeners
  envVarsList.querySelectorAll('.env-var-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.target.closest('.env-var-row').remove();
      // Show empty message if no vars left
      if (envVarsList.querySelectorAll('.env-var-row').length === 0) {
        envVarsList.innerHTML = '<div class="env-vars-empty">No environment variables defined. Click "Add Variable" to create one.</div>';
      }
    });
  });
}

function addEnvVarRow() {
  const envVarsList = document.getElementById('envVarsList');

  // Remove empty message if present
  const emptyMsg = envVarsList.querySelector('.env-vars-empty');
  if (emptyMsg) {
    emptyMsg.remove();
  }

  const row = document.createElement('div');
  row.className = 'env-var-row';
  row.innerHTML = `
    <input type="text" class="env-var-key" value="" placeholder="KEY">
    <input type="text" class="env-var-value" value="" placeholder="value">
    <button class="env-var-delete" title="Delete" aria-label="환경 변수 삭제">&times;</button>
  `;

  row.querySelector('.env-var-delete').addEventListener('click', () => {
    row.remove();
    if (envVarsList.querySelectorAll('.env-var-row').length === 0) {
      envVarsList.innerHTML = '<div class="env-vars-empty">No environment variables defined. Click "Add Variable" to create one.</div>';
    }
  });

  envVarsList.appendChild(row);
  row.querySelector('.env-var-key').focus();
}

async function saveEnvVars() {
  if (!currentEnvVarsProjectPath) return;

  const envVarsList = document.getElementById('envVarsList');
  const rows = envVarsList.querySelectorAll('.env-var-row');
  const envVars = {};

  rows.forEach(row => {
    const key = row.querySelector('.env-var-key').value.trim();
    const value = row.querySelector('.env-var-value').value;
    if (key) {
      envVars[key] = value;
    }
  });

  try {
    await invoke('save_project_env', {
      projectPath: currentEnvVarsProjectPath,
      envVars
    });
    showToast('환경 변수가 저장되었습니다', 'success');
    hideEnvVarsModal();
  } catch (error) {
    debug('Failed to save env vars:', error);
    showToast(`환경 변수 저장 실패: ${error}`, 'error');
  }
}

async function getProjectEnvVars(projectPath) {
  try {
    return await invoke('load_project_env', { projectPath });
  } catch (error) {
    debug('Failed to load env vars for project:', error);
    return {};
  }
}

// ===== Session Functions =====

async function createSession(name = null, workingDir = null, projectId = null, options = {}) {
  const { activate = true } = options;

  const id = `session-${++state.sessionCounter}`;
  const sessionName = name || `Terminal ${state.sessionCounter}`;
  debug('Creating session:', id, sessionName);

  // Create terminal wrapper
  const wrapper = document.createElement('div');
  wrapper.className = 'terminal-wrapper';
  wrapper.id = `terminal-${id}`;
  terminalContainer.appendChild(wrapper);

  const blockContainer = document.createElement('div');
  blockContainer.className = 'command-blocks-container';
  blockContainer.style.display = state.settings.enableBlockMode ? 'block' : 'none';
  wrapper.appendChild(blockContainer);

  // Get theme for terminal
  const theme = TERMINAL_THEMES[state.settings.theme] || TERMINAL_THEMES.dark;
  const fontSize = state.settings.fontSize || 14;
  const fontFamily = state.settings.fontFamily || 'Consolas';

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

  async function tryConnectPty(sessionId, workingDir, terminal, envVars = null) {
    const delays = [1000, 2000, 4000]; // exponential backoff

    while (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      try {
        const ptySessionId = await invoke('create_pty', {
          workingDir: workingDir,
          shell: null,
          envVars: envVars,
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

    // Load environment variables if project has a working directory
    let envVars = null;
    if (workingDir) {
      try {
        envVars = await getProjectEnvVars(workingDir);
        if (Object.keys(envVars).length > 0) {
          debug('Loaded environment variables:', Object.keys(envVars).length);
          terminal.writeln(`\x1b[90mLoaded ${Object.keys(envVars).length} environment variable(s)\x1b[0m`);
        }
      } catch (e) {
        debug('Could not load env vars:', e);
      }
    }

    terminal.writeln(`\x1b[90mConnecting to PTY in ${dir}...\x1b[0m`);

    // Create PTY with reconnection support and env vars
    ptySessionId = await tryConnectPty(id, dir, terminal, envVars);
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
      if (state.settings.enableLogging) {
        logSessionOutput(ptySessionId, event.payload);
      }
      // Capture output for recording if active
      if (recordingManager.isRecording(id)) {
        recordingManager.addOutput(id, event.payload);
      }

      // Process block output if block mode is enabled
      if (state.settings.enableBlockMode) {
        const blockManager = state.blockManagers.get(id);
        if (blockManager) {
          blockManager.processOutput(event.payload);
        }
      }

      // Check for error patterns
      const errorDetection = detectErrorPattern(event.payload);
      if (errorDetection) {
        showErrorExplanation(id, errorDetection.pattern, errorDetection.text);
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
          // Handle special keys for autocomplete
          if (state.autocompleteVisible) {
            if (data === '\t') {
              // Tab - apply selected suggestion
              applyAutocompleteSuggestion(id);
              return;
            } else if (data === '\x1b[B') {
              // Arrow Down
              moveAutocompleteSelection('down');
              return;
            } else if (data === '\x1b[A') {
              // Arrow Up
              moveAutocompleteSelection('up');
              return;
            } else if (data === '\x1b') {
              // Escape
              hideAutocomplete();
              return;
            } else if (data === '\r') {
              // Enter - hide autocomplete and execute
              hideAutocomplete();
            }
          }

          // Track current line buffer for autocomplete
          if (data === '\r') {
            // Enter pressed - add to history and reset buffer
            if (state.currentLineBuffer.trim()) {
              const session = state.sessions.get(id);
              commandHistory.add(state.currentLineBuffer.trim(), session?.projectId);
            }
            state.currentLineBuffer = '';
            hideAutocomplete();
          } else if (data === '\x7f' || data === '\b') {
            // Backspace - remove last character
            if (state.currentLineBuffer.length > 0) {
              state.currentLineBuffer = state.currentLineBuffer.slice(0, -1);
              updateAutocomplete(state.currentLineBuffer, id);
            } else {
              hideAutocomplete();
            }
          } else if (data === '\x03') {
            // Ctrl+C - clear buffer
            state.currentLineBuffer = '';
            hideAutocomplete();
          } else if (data === '\t' && !state.autocompleteVisible) {
            // Tab without autocomplete - show suggestions
            if (state.currentLineBuffer.trim()) {
              updateAutocomplete(state.currentLineBuffer, id);
              return; // Don't send tab to terminal
            }
          } else if (data.length === 1 && data >= ' ' && data <= '~') {
            // Printable character
            state.currentLineBuffer += data;
            updateAutocomplete(state.currentLineBuffer, id);
          }

          const blockManager = state.blockManagers.get(id);
          if (blockManager) {
            blockManager.processUserInput(data);
          }

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
    blockContainer,
    pinned: false,    // Phase 3: Tab pinning
    color: null,      // Phase 3: Tab color
  };
  state.sessions.set(id, session);
  const blockManager = new BlockManager(id);
  blockManager.setContainer(blockContainer);
  state.blockManagers.set(id, blockManager);
  wrapper.classList.toggle('terminal-wrapper--block-mode', state.settings.enableBlockMode);
  eventBus.emit('session:created', {
    sessionId: id,
    projectId: session.projectId,
    status: session.status
  });

  // Link session to project
  if (projectId) {
    linkSessionToProject(id, projectId);
    // Auto-group by project if enabled
    autoGroupSessionByProject(id, projectId, name);
  }

  // Create tab
  createTab(session);

  // Activate session
  if (activate) {
    activateSession(id);
  }

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

function createTab(session) {
  const tab = document.createElement('div');
  tab.className = 'tab';
  tab.dataset.sessionId = session.id;
  tab.draggable = true;

  const statusClass = getSessionStatusClass(session.status);
  const statusIcon = getStatusIcon(statusClass);
  tab.innerHTML = `
    <span class="tab__status tab__status--${statusClass}">${statusIcon}</span>
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

  const closeButton = tab.querySelector('.tab__close');
  closeButton.setAttribute('aria-label', `${session.name} 탭 닫기`);
  closeButton.addEventListener('click', (e) => {
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

function activateSession(id, options = {}) {
  const { preserveSplitLayout = false } = options;
  const session = state.sessions.get(id);
  if (!session) return;
  const keepCurrentSplit = preserveSplitLayout && state.splitMode && !!state.splitRoot;

  // Cancel any pending swap operation
  if (state.swapTargetSession) {
    const prevSession = state.sessions.get(state.swapTargetSession);
    if (prevSession) {
      prevSession.wrapper.classList.remove('terminal-wrapper--swap-source');
    }
    state.swapTargetSession = null;
  }

  // Save current tab's layout before switching
  if (!keepCurrentSplit && state.activeSessionId && state.activeSessionId !== id) {
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
  eventBus.emit('session:activated', { sessionId: id });

  // Restore new tab's layout after switching
  if (keepCurrentSplit) {
    renderSplitLayout();
  } else {
    restoreTabLayout(id);
  }

  setTimeout(() => {
    session.fitAddon.fit();
    session.terminal.focus();
  }, 50);

  renderProjectCmdTrees();
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
  disposeSessionLogBuffer(id);

  const tab = document.querySelector(`[data-session-id="${id}"]`);
  if (tab) tab.remove();

  state.sessions.delete(id);
  state.blockManagers.delete(id);
  eventBus.emit('session:closed', { sessionId: id });

  // Claude 세션 정리
  onClaudeSessionClose(id);

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

  // 세션 공유 상태 확인
  const isSharing = session ? session.isSharing : false;

  menu.innerHTML = `
    <div class="context-menu__item" data-action="duplicate">Duplicate</div>
    <div class="context-menu__item" data-action="rename">Rename Tab</div>
    <div class="context-menu__item" data-action="${isPinned ? 'unpin' : 'pin'}">${isPinned ? 'Unpin Tab' : 'Pin Tab'}</div>
    <div class="context-menu__item" data-action="set-color">Set Color ▶</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="${isSharing ? 'stop-sharing' : 'start-sharing'}">${isSharing ? '공유 중지' : '세션 공유'}</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="close">Close</div>
    <div class="context-menu__item" data-action="close-others">Close Other Tabs</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="restore-closed">Restore Last Closed Tab</div>
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="create-group">Create Group from Tab</div>
    ${isInGroup ? '<div class="context-menu__item" data-action="remove-from-group">Remove from Group</div>' : ''}
    <div class="context-menu__separator"></div>
    <div class="context-menu__item" data-action="split-default">기본 분할 (오른쪽)</div>
    <div class="context-menu__item" data-action="split-horizontal">아래로 분할</div>
    <div class="context-menu__item" data-action="split-vertical">오른쪽 분할</div>
    ${state.splitMode ? '<div class="context-menu__item" data-action="merge-pane">창 합치기</div>' : ''}
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
      case 'start-sharing': showSharingModal(sessionId); break;
      case 'stop-sharing': await stopSharing(sessionId); break;
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
      case 'split-default':
        activateSession(sessionId);
        splitDefault();
        break;
      case 'split-vertical':
        activateSession(sessionId);
        splitVertical();
        break;
      case 'merge-pane':
        mergePane(sessionId);
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
      <div class="terminal-search__options">
        <button class="terminal-search__option" data-option="caseSensitive" title="대소문자 구분 (Alt+C)">Aa</button>
        <button class="terminal-search__option" data-option="wholeWord" title="전체 단어 일치 (Alt+W)">W</button>
        <button class="terminal-search__option" data-option="regex" title="정규식 사용 (Alt+R)">.*</button>
        <button class="terminal-search__option" data-option="searchAllSessions" title="전체 세션 검색 (Alt+A)">All</button>
      </div>
      <span class="terminal-search__count" id="terminalSearchCount"></span>
      <button class="terminal-search__btn" id="terminalSearchPrev" title="이전 (Shift+F3)">▲</button>
      <button class="terminal-search__btn" id="terminalSearchNext" title="다음 (F3)">▼</button>
      <button class="terminal-search__close" id="terminalSearchClose">&times;</button>
    `;

    const terminalContainer = document.getElementById('terminalContainer');
    terminalContainer.insertBefore(searchBar, terminalContainer.firstChild);

    const input = document.getElementById('terminalSearchInput');
    const prevBtn = document.getElementById('terminalSearchPrev');
    const nextBtn = document.getElementById('terminalSearchNext');
    const closeBtn = document.getElementById('terminalSearchClose');
    const optionButtons = searchBar.querySelectorAll('.terminal-search__option');

    // Initialize search options
    if (!state.searchOptions) {
      state.searchOptions = {
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        searchAllSessions: false,
      };
    }

    // Option button handlers
    optionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const option = btn.dataset.option;
        state.searchOptions[option] = !state.searchOptions[option];
        btn.classList.toggle('terminal-search__option--active', state.searchOptions[option]);

        // Re-perform search with new options
        if (state.searchQuery) {
          if (state.searchOptions.searchAllSessions) {
            performAllSessionsSearch(state.searchQuery);
          } else {
            performTerminalSearch(state.searchQuery);
          }
        }
      });
    });

    input.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchOptions.searchAllSessions) {
        performAllSessionsSearch(e.target.value);
      } else {
        performTerminalSearch(e.target.value);
      }
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
      } else if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          searchTerminalPrevious();
        } else {
          searchTerminalNext();
        }
      } else if (e.altKey) {
        // Alt+C: Case sensitive
        if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          optionButtons[0].click();
        }
        // Alt+W: Whole word
        else if (e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          optionButtons[1].click();
        }
        // Alt+R: Regex
        else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          optionButtons[2].click();
        }
        // Alt+A: All sessions
        else if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          optionButtons[3].click();
        }
      }
    });

    prevBtn.addEventListener('click', () => searchTerminalPrevious());
    nextBtn.addEventListener('click', () => searchTerminalNext());
    closeBtn.addEventListener('click', () => hideTerminalSearch());
  } else {
    // Update option button states if search bar already exists
    const optionButtons = searchBar.querySelectorAll('.terminal-search__option');
    optionButtons.forEach(btn => {
      const option = btn.dataset.option;
      btn.classList.toggle('terminal-search__option--active', state.searchOptions?.[option] || false);
    });
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

  // Hide all sessions results panel
  hideAllSessionsResults();

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

  const options = {
    caseSensitive: state.searchOptions?.caseSensitive || false,
    wholeWord: state.searchOptions?.wholeWord || false,
    regex: state.searchOptions?.regex || false,
    decorations: {
      matchBackground: '#515c6a',
      activeMatchBackground: '#74879f',
      matchBorder: '#74879f',
      activeMatchColorOverviewRuler: '#515c6a',
      matchOverviewRuler: '#515c6a'
    }
  };

  try {
    session.searchAddon.findNext(query, options);
  } catch (error) {
    // Handle regex errors
    if (state.searchOptions?.regex) {
      showToast('정규식 오류: ' + error.message, 'error', 3000);
      updateSearchCount(0, 0);
    }
  }
}

function searchTerminalNext() {
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.searchAddon || !state.searchQuery) return;

  const options = {
    caseSensitive: state.searchOptions?.caseSensitive || false,
    wholeWord: state.searchOptions?.wholeWord || false,
    regex: state.searchOptions?.regex || false,
  };

  try {
    session.searchAddon.findNext(state.searchQuery, options);
  } catch (error) {
    if (state.searchOptions?.regex) {
      showToast('정규식 오류: ' + error.message, 'error', 3000);
    }
  }
}

function searchTerminalPrevious() {
  const session = state.sessions.get(state.activeSessionId);
  if (!session || !session.searchAddon || !state.searchQuery) return;

  const options = {
    caseSensitive: state.searchOptions?.caseSensitive || false,
    wholeWord: state.searchOptions?.wholeWord || false,
    regex: state.searchOptions?.regex || false,
  };

  try {
    session.searchAddon.findPrevious(state.searchQuery, options);
  } catch (error) {
    if (state.searchOptions?.regex) {
      showToast('정규식 오류: ' + error.message, 'error', 3000);
    }
  }
}

function updateSearchCount(current, total) {
  const countEl = document.getElementById('terminalSearchCount');
  if (countEl) {
    countEl.textContent = total > 0 ? `${current}/${total}` : '';
  }
}

// ===== Autocomplete Functions =====

function showAutocomplete(suggestions, sessionId) {
  if (!suggestions || suggestions.length === 0) {
    hideAutocomplete();
    return;
  }

  state.autocompleteVisible = true;
  state.autocompleteSuggestions = suggestions;
  state.autocompleteSelected = 0;

  const session = state.sessions.get(sessionId);
  if (!session) return;

  let popup = session.wrapper.querySelector('.autocomplete-popup');
  if (!popup) {
    popup = document.createElement('div');
    popup.className = 'autocomplete-popup';
    session.wrapper.appendChild(popup);
  }

  popup.innerHTML = suggestions.map((s, index) => `
    <div class="autocomplete-popup__item ${index === 0 ? 'autocomplete-popup__item--selected' : ''}" data-index="${index}">
      <span class="autocomplete-popup__command">${escapeHtml(s.command)}</span>
      <span class="autocomplete-popup__source">${s.source === 'history' ? (s.favorite ? '⭐' : '📜') : '💡'}</span>
      ${s.useCount > 1 ? `<span class="autocomplete-popup__count">${s.useCount}×</span>` : ''}
    </div>
  `).join('');

  popup.style.display = 'block';

  // Add click handlers
  popup.querySelectorAll('.autocomplete-popup__item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      applyAutocompleteSuggestion(sessionId, index);
    });
  });
}

function hideAutocomplete() {
  state.autocompleteVisible = false;
  state.autocompleteSuggestions = [];
  state.autocompleteSelected = 0;

  // Remove all autocomplete popups
  document.querySelectorAll('.autocomplete-popup').forEach(popup => {
    popup.style.display = 'none';
  });
}

function moveAutocompleteSelection(direction) {
  if (!state.autocompleteVisible || state.autocompleteSuggestions.length === 0) return;

  const oldIndex = state.autocompleteSelected;
  if (direction === 'down') {
    state.autocompleteSelected = (state.autocompleteSelected + 1) % state.autocompleteSuggestions.length;
  } else if (direction === 'up') {
    state.autocompleteSelected = (state.autocompleteSelected - 1 + state.autocompleteSuggestions.length) % state.autocompleteSuggestions.length;
  }

  // Update UI
  const popup = document.querySelector('.autocomplete-popup');
  if (popup) {
    const items = popup.querySelectorAll('.autocomplete-popup__item');
    if (items[oldIndex]) {
      items[oldIndex].classList.remove('autocomplete-popup__item--selected');
    }
    if (items[state.autocompleteSelected]) {
      items[state.autocompleteSelected].classList.add('autocomplete-popup__item--selected');
      items[state.autocompleteSelected].scrollIntoView({ block: 'nearest' });
    }
  }
}

function applyAutocompleteSuggestion(sessionId, index = null) {
  if (!state.autocompleteVisible) return;

  const selectedIndex = index !== null ? index : state.autocompleteSelected;
  const suggestion = state.autocompleteSuggestions[selectedIndex];
  if (!suggestion) return;

  const session = state.sessions.get(sessionId);
  if (!session || !session.ptySessionId) return;

  // Clear current line and write suggestion
  const command = suggestion.command;

  // Send backspace to clear current input
  const backspaceCount = state.currentLineBuffer.length;
  for (let i = 0; i < backspaceCount; i++) {
    invoke('write_pty', { sessionId: session.ptySessionId, data: '\x7f' }).catch(e => {
      debug('Failed to send backspace:', e);
    });
  }

  // Write the suggested command
  invoke('write_pty', { sessionId: session.ptySessionId, data: command }).catch(e => {
    debug('Failed to write suggestion:', e);
  });

  state.currentLineBuffer = command;
  hideAutocomplete();
}

function updateAutocomplete(input, sessionId) {
  if (!input || input.trim() === '') {
    hideAutocomplete();
    return;
  }

  const session = state.sessions.get(sessionId);
  const projectId = session?.projectId || null;

  const suggestions = autocomplete.getSuggestions(input, projectId);

  if (suggestions.length > 0) {
    showAutocomplete(suggestions, sessionId);
  } else {
    hideAutocomplete();
  }
}

function performAllSessionsSearch(query) {
  if (!query) {
    hideAllSessionsResults();
    return;
  }

  const results = [];
  const options = {
    caseSensitive: state.searchOptions?.caseSensitive || false,
    wholeWord: state.searchOptions?.wholeWord || false,
    regex: state.searchOptions?.regex || false,
  };

  // Search in all sessions
  state.sessions.forEach((session, sessionId) => {
    if (!session.terminal || !session.terminal.buffer) return;

    const buffer = session.terminal.buffer.active;
    let searchPattern;

    if (options.regex) {
      try {
        searchPattern = new RegExp(query, options.caseSensitive ? 'g' : 'gi');
      } catch (e) {
        showToast('정규식 오류: ' + e.message, 'error', 3000);
        return;
      }
    }

    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (!line) continue;

      const lineText = line.translateToString(true);

      let matchFound = false;
      if (options.regex) {
        try {
          matchFound = searchPattern.test(lineText);
        } catch (e) {
          continue;
        }
      } else {
        const searchText = options.caseSensitive ? lineText : lineText.toLowerCase();
        const queryText = options.caseSensitive ? query : query.toLowerCase();

        if (options.wholeWord) {
          const regex = new RegExp(`\\b${escapeRegex(queryText)}\\b`, 'g');
          matchFound = regex.test(searchText);
        } else {
          matchFound = searchText.includes(queryText);
        }
      }

      if (matchFound) {
        results.push({
          sessionId: sessionId,
          sessionName: session.name,
          lineNumber: i + 1,
          lineText: lineText.trim(),
        });
      }
    }
  });

  showAllSessionsResults(results, query);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function showAllSessionsResults(results, query) {
  let resultsPanel = document.getElementById('searchResultsPanel');

  if (!resultsPanel) {
    resultsPanel = document.createElement('div');
    resultsPanel.id = 'searchResultsPanel';
    resultsPanel.className = 'search-results-panel';
    document.getElementById('terminalContainer').appendChild(resultsPanel);
  }

  if (results.length === 0) {
    resultsPanel.innerHTML = `
      <div class="search-results-panel__header">
        <span class="search-results-panel__title">검색 결과</span>
        <button class="search-results-panel__close" id="closeSearchResults">&times;</button>
      </div>
      <div class="search-results-panel__empty">검색 결과가 없습니다.</div>
    `;
  } else {
    const groupedResults = {};
    results.forEach(result => {
      if (!groupedResults[result.sessionId]) {
        groupedResults[result.sessionId] = {
          sessionName: result.sessionName,
          matches: []
        };
      }
      groupedResults[result.sessionId].matches.push(result);
    });

    const resultHtml = Object.keys(groupedResults).map(sessionId => {
      const group = groupedResults[sessionId];
      const matchesHtml = group.matches.slice(0, 10).map(match => `
        <div class="search-results-panel__item" data-session-id="${escapeDataAttr(match.sessionId)}" data-line="${match.lineNumber}">
          <span class="search-results-panel__line">Line ${match.lineNumber}</span>
          <span class="search-results-panel__text">${escapeHtml(match.lineText.substring(0, 100))}</span>
        </div>
      `).join('');

      return `
        <div class="search-results-panel__group">
          <div class="search-results-panel__group-header">${escapeHtml(group.sessionName)} (${group.matches.length})</div>
          ${matchesHtml}
          ${group.matches.length > 10 ? `<div class="search-results-panel__more">+${group.matches.length - 10} more...</div>` : ''}
        </div>
      `;
    }).join('');

    resultsPanel.innerHTML = `
      <div class="search-results-panel__header">
        <span class="search-results-panel__title">검색 결과: "${escapeHtml(query)}" (${results.length}건)</span>
        <button class="search-results-panel__close" id="closeSearchResults">&times;</button>
      </div>
      <div class="search-results-panel__content">
        ${resultHtml}
      </div>
    `;
  }

  resultsPanel.classList.add('search-results-panel--visible');

  // Add event listeners
  const closeBtn = document.getElementById('closeSearchResults');
  if (closeBtn) {
    closeBtn.addEventListener('click', hideAllSessionsResults);
  }

  resultsPanel.querySelectorAll('.search-results-panel__item').forEach(item => {
    item.addEventListener('click', () => {
      const sessionId = item.dataset.sessionId;
      const lineNumber = parseInt(item.dataset.line);

      // Switch to the session
      activateSession(sessionId);

      // Scroll to the line (approximation since xterm doesn't have direct line scrolling)
      const session = state.sessions.get(sessionId);
      if (session && session.terminal) {
        session.terminal.scrollToLine(Math.max(0, lineNumber - 5));
      }

      // Hide results panel
      hideAllSessionsResults();

      // Re-perform search in the current session to highlight
      if (state.searchQuery) {
        performTerminalSearch(state.searchQuery);
      }
    });
  });

  updateSearchCount(0, results.length);
}

function hideAllSessionsResults() {
  const resultsPanel = document.getElementById('searchResultsPanel');
  if (resultsPanel) {
    resultsPanel.classList.remove('search-results-panel--visible');
  }
}

// ===== Session Recording UI Functions =====

// Recording controls state
let playerModal = null;
let currentPlayer = null;

// Create recording controls UI
function createRecordingControls() {
  const controls = document.createElement('div');
  controls.id = 'recordingControls';
  controls.className = 'recording-controls';
  controls.innerHTML = `
    <button class="recording-controls__record" title="녹화 시작">
      <span class="recording-controls__icon">&#9679;</span>
    </button>
    <button class="recording-controls__stop" title="녹화 중지" style="display: none;">
      <span class="recording-controls__icon">&#9632;</span>
    </button>
    <span class="recording-controls__indicator" style="display: none;">
      <span class="recording-controls__dot"></span>
      녹화 중
      <span class="recording-controls__timer">0:00</span>
    </span>
    <button class="recording-controls__list" title="녹화 목록">
      <span class="recording-controls__icon">&#9776;</span>
    </button>
  `;

  // Insert into tabs container
  const tabsContainer = document.getElementById('tabsContainer');
  if (tabsContainer) {
    tabsContainer.appendChild(controls);
  }

  // Event listeners
  controls.querySelector('.recording-controls__record').addEventListener('click', startRecordingUI);
  controls.querySelector('.recording-controls__stop').addEventListener('click', stopRecordingUI);
  controls.querySelector('.recording-controls__list').addEventListener('click', showRecordingsList);

  return controls;
}

// Start recording UI
function startRecordingUI() {
  if (!state.activeSessionId) {
    showToast('활성 터미널 세션이 없습니다', 'warning');
    return;
  }

  if (recordingManager.isRecording()) {
    showToast('이미 녹화 중입니다', 'warning');
    return;
  }

  recordingManager.startRecording(state.activeSessionId);

  // Update UI
  const controls = document.getElementById('recordingControls');
  if (controls) {
    controls.querySelector('.recording-controls__record').style.display = 'none';
    controls.querySelector('.recording-controls__stop').style.display = 'inline-flex';
    controls.querySelector('.recording-controls__indicator').style.display = 'inline-flex';
    controls.classList.add('recording-controls--active');
  }

  // Start timer
  startRecordingTimer();

  showToast('녹화를 시작합니다', 'success');
}

// Recording timer
let recordingTimerInterval = null;

function startRecordingTimer() {
  const timerEl = document.querySelector('.recording-controls__timer');
  if (!timerEl) return;

  const startTime = Date.now();

  recordingTimerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    timerEl.textContent = formatTime(elapsed);
  }, 1000);
}

function stopRecordingTimer() {
  if (recordingTimerInterval) {
    clearInterval(recordingTimerInterval);
    recordingTimerInterval = null;
  }
}

// Stop recording UI
function stopRecordingUI() {
  const recording = recordingManager.stopRecording();

  stopRecordingTimer();

  // Update UI
  const controls = document.getElementById('recordingControls');
  if (controls) {
    controls.querySelector('.recording-controls__record').style.display = 'inline-flex';
    controls.querySelector('.recording-controls__stop').style.display = 'none';
    controls.querySelector('.recording-controls__indicator').style.display = 'none';
    controls.classList.remove('recording-controls--active');
  }

  if (recording) {
    const duration = formatTime(recording.getDuration());
    showToast(`녹화 완료 (${duration})`, 'success');

    // Prompt to name the recording
    const title = prompt('녹화 이름을 입력하세요:', recording.metadata.title);
    if (title) {
      recording.metadata.title = title;
      recording.save();
    }
  }
}

// Show recordings list modal
function showRecordingsList() {
  const recordings = SessionRecording.loadAll();

  // Create modal
  const modal = document.createElement('div');
  modal.id = 'recordingsListModal';
  modal.className = 'modal modal--visible';
  modal.innerHTML = `
    <div class="modal__content modal__content--wide">
      <div class="modal__header">
        <h2 class="modal__title">녹화 목록</h2>
        <button class="modal__close">&times;</button>
      </div>
      <div class="modal__body">
        ${recordings.length === 0 ? `
          <div class="recordings-list__empty">
            <p>저장된 녹화가 없습니다.</p>
            <p>터미널 세션을 녹화하려면 녹화 버튼을 클릭하세요.</p>
          </div>
        ` : `
          <div class="recordings-list">
            ${recordings.map(r => `
              <div class="recordings-list__item" data-recording-id="${escapeDataAttr(r.id)}">
                <div class="recordings-list__info">
                  <span class="recordings-list__title">${escapeHtml(r.metadata?.title || 'Untitled')}</span>
                  <span class="recordings-list__meta">
                    ${formatTime(r.endTime - r.startTime)} |
                    ${new Date(r.startTime).toLocaleString()}
                  </span>
                </div>
                <div class="recordings-list__actions">
                  <button class="btn btn--small btn--primary recordings-list__play" data-id="${escapeDataAttr(r.id)}">재생</button>
                  <button class="btn btn--small btn--secondary recordings-list__export" data-id="${escapeDataAttr(r.id)}">내보내기</button>
                  <button class="btn btn--small btn--danger recordings-list__delete" data-id="${escapeDataAttr(r.id)}">삭제</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  modal.querySelector('.modal__close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Play buttons
  modal.querySelectorAll('.recordings-list__play').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      modal.remove();
      openPlayerModal(id);
    });
  });

  // Export buttons
  modal.querySelectorAll('.recordings-list__export').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      exportRecording(id);
    });
  });

  // Delete buttons
  modal.querySelectorAll('.recordings-list__delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const confirmed = await showConfirmDialog('녹화 삭제', '이 녹화를 삭제하시겠습니까?');
      if (confirmed) {
        SessionRecording.delete(id);
        modal.remove();
        showRecordingsList();
        showToast('녹화가 삭제되었습니다', 'success');
      }
    });
  });
}

// Export recording as asciinema file
function exportRecording(id) {
  const recording = SessionRecording.load(id);
  if (!recording) {
    showToast('녹화를 찾을 수 없습니다', 'error');
    return;
  }

  const content = recording.exportAsString();
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${recording.metadata.title || 'recording'}.cast`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('녹화가 내보내졌습니다 (.cast 형식)', 'success');
}

// Open player modal
function openPlayerModal(recordingId) {
  const recording = SessionRecording.load(recordingId);
  if (!recording) {
    showToast('녹화를 찾을 수 없습니다', 'error');
    return;
  }

  // Create player modal
  playerModal = document.createElement('div');
  playerModal.id = 'playerModal';
  playerModal.className = 'player-modal';
  playerModal.innerHTML = `
    <div class="player-modal__header">
      <span class="player-modal__title">${escapeHtml(recording.metadata.title || '녹화 재생')}</span>
      <button class="player-modal__close">&times;</button>
    </div>
    <div class="player-modal__terminal" id="playerTerminal"></div>
    <div class="player-modal__controls">
      <button class="player-modal__play" title="재생">&#9654;</button>
      <button class="player-modal__pause" title="일시정지" style="display: none;">&#10074;&#10074;</button>
      <input class="player-modal__progress" type="range" min="0" max="${recording.getDuration()}" value="0" />
      <span class="player-modal__time">0:00 / ${formatTime(recording.getDuration())}</span>
      <div class="player-modal__speed-control">
        <button class="player-modal__speed" data-speed="0.5">0.5x</button>
        <button class="player-modal__speed player-modal__speed--active" data-speed="1">1x</button>
        <button class="player-modal__speed" data-speed="2">2x</button>
      </div>
      <button class="player-modal__export" title="내보내기">내보내기</button>
    </div>
  `;

  document.body.appendChild(playerModal);

  // Create player terminal
  const playerTerminalContainer = document.getElementById('playerTerminal');
  const theme = TERMINAL_THEMES[state.settings.theme] || TERMINAL_THEMES.dark;

  const playerTerminal = new Terminal({
    cursorBlink: false,
    fontSize: state.settings.fontSize || 14,
    fontFamily: `${state.settings.fontFamily || 'Consolas'}, "Courier New", monospace`,
    theme: theme,
    cols: recording.metadata.cols,
    rows: recording.metadata.rows,
    disableStdin: true,
    scrollback: 5000,
  });

  const fitAddon = new FitAddon();
  playerTerminal.loadAddon(fitAddon);
  playerTerminal.open(playerTerminalContainer);

  setTimeout(() => fitAddon.fit(), 100);

  // Create player
  currentPlayer = new RecordingPlayer(playerTerminal, recording);

  // Progress callback
  currentPlayer.onProgress = (currentTime, duration) => {
    const progressEl = playerModal.querySelector('.player-modal__progress');
    const timeEl = playerModal.querySelector('.player-modal__time');
    if (progressEl) progressEl.value = currentTime;
    if (timeEl) timeEl.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  };

  // State change callback
  currentPlayer.onStateChange = (newState) => {
    const playBtn = playerModal.querySelector('.player-modal__play');
    const pauseBtn = playerModal.querySelector('.player-modal__pause');

    if (newState === 'playing') {
      playBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-flex';
    } else {
      playBtn.style.display = 'inline-flex';
      pauseBtn.style.display = 'none';
    }
  };

  // Complete callback
  currentPlayer.onComplete = () => {
    showToast('재생이 완료되었습니다', 'info');
  };

  // Event listeners
  playerModal.querySelector('.player-modal__close').addEventListener('click', closePlayerModal);
  playerModal.querySelector('.player-modal__play').addEventListener('click', () => currentPlayer.play());
  playerModal.querySelector('.player-modal__pause').addEventListener('click', () => currentPlayer.pause());

  playerModal.querySelector('.player-modal__progress').addEventListener('input', (e) => {
    const timeMs = parseInt(e.target.value);
    currentPlayer.seek(timeMs);
  });

  playerModal.querySelectorAll('.player-modal__speed').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed);
      currentPlayer.setSpeed(speed);

      // Update active state
      playerModal.querySelectorAll('.player-modal__speed').forEach(b => b.classList.remove('player-modal__speed--active'));
      btn.classList.add('player-modal__speed--active');
    });
  });

  playerModal.querySelector('.player-modal__export').addEventListener('click', () => {
    exportRecording(recordingId);
  });

  // Keyboard shortcuts
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closePlayerModal();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (currentPlayer.isPlaying && !currentPlayer.isPaused) {
        currentPlayer.pause();
      } else {
        currentPlayer.play();
      }
    }
  };
  document.addEventListener('keydown', handleKeydown);
  playerModal._keydownHandler = handleKeydown;
}

// Close player modal
function closePlayerModal() {
  if (currentPlayer) {
    currentPlayer.stop();
    currentPlayer = null;
  }

  if (playerModal) {
    if (playerModal._keydownHandler) {
      document.removeEventListener('keydown', playerModal._keydownHandler);
    }
    playerModal.remove();
    playerModal = null;
  }
}

// Format time (ms) to mm:ss
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ===== Split Pane Functions =====

function initSplitMode() {
  if (!state.activeSessionId) return;

  state.splitMode = true;
  state.splitRoot = new SplitNode('leaf', state.activeSessionId);
  renderSplitLayout();
}

function splitHorizontal() {
  if (!state.activeSessionId) {
    showToast('먼저 터미널 세션을 생성하세요', 'warning');
    return;
  }
  if (!state.splitMode) initSplitMode();
  splitActivePane('horizontal');
}

function splitVertical() {
  if (!state.activeSessionId) {
    showToast('먼저 터미널 세션을 생성하세요', 'warning');
    return;
  }
  if (!state.splitMode) initSplitMode();
  splitActivePane('vertical');
}

function splitDefault() {
  splitVertical();
}

function focusLayoutPresetSelector() {
  const presetSelect = document.getElementById('layoutPresetSelect');
  if (!presetSelect) return;
  presetSelect.focus();
  showToast('레이아웃 프리셋을 선택하세요', 'info', 1200);
}

function getLayoutPresetName(presetKey) {
  const preset = LAYOUT_PRESETS[presetKey];
  if (!preset) return presetKey;
  return LAYOUT_PRESET_TITLES[presetKey] || preset.name || presetKey;
}

function getLayoutPresetDescription(presetKey) {
  return LAYOUT_PRESET_DESCRIPTIONS[presetKey] || '분할 레이아웃';
}

function createLayoutPreviewCell(extraClass = '') {
  const cell = document.createElement('span');
  cell.className = `layout-gallery__preview-cell ${extraClass}`.trim();
  return cell;
}

function createLayoutPreviewElement(presetKey) {
  const preview = document.createElement('div');
  preview.className = `layout-gallery__preview layout-gallery__preview--${presetKey}`;

  switch (presetKey) {
    case 'two-columns':
      preview.appendChild(createLayoutPreviewCell());
      preview.appendChild(createLayoutPreviewCell());
      break;
    case 'two-rows':
      preview.appendChild(createLayoutPreviewCell());
      preview.appendChild(createLayoutPreviewCell());
      break;
    case 'three-columns':
      preview.appendChild(createLayoutPreviewCell());
      preview.appendChild(createLayoutPreviewCell());
      preview.appendChild(createLayoutPreviewCell());
      break;
    case 'main-sidebar':
      preview.appendChild(createLayoutPreviewCell('layout-gallery__preview-cell--main'));
      preview.appendChild(createLayoutPreviewCell('layout-gallery__preview-cell--sidebar'));
      break;
    case 'grid-2x2':
    default:
      preview.appendChild(createLayoutPreviewCell());
      preview.appendChild(createLayoutPreviewCell());
      preview.appendChild(createLayoutPreviewCell());
      preview.appendChild(createLayoutPreviewCell());
      break;
  }

  return preview;
}

function renderLayoutGallery() {
  const list = document.getElementById('layoutGalleryList');
  const applyBtn = document.getElementById('applyLayoutGallery');
  if (!list) return;

  list.innerHTML = '';

  Object.keys(LAYOUT_PRESETS).forEach((presetKey) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'layout-gallery__card';
    if (state.selectedLayoutPreset === presetKey) {
      card.classList.add('layout-gallery__card--active');
    }
    card.dataset.preset = presetKey;

    const preview = createLayoutPreviewElement(presetKey);

    const title = document.createElement('h3');
    title.className = 'layout-gallery__card-title';
    title.textContent = getLayoutPresetName(presetKey);

    const description = document.createElement('p');
    description.className = 'layout-gallery__card-description';
    description.textContent = getLayoutPresetDescription(presetKey);

    card.appendChild(preview);
    card.appendChild(title);
    card.appendChild(description);

    card.addEventListener('click', () => {
      state.selectedLayoutPreset = presetKey;
      renderLayoutGallery();
    });

    card.addEventListener('dblclick', async () => {
      state.selectedLayoutPreset = presetKey;
      await applyLayoutGallerySelection();
    });

    list.appendChild(card);
  });

  if (applyBtn) {
    applyBtn.disabled = !state.selectedLayoutPreset;
  }
}

function openLayoutGalleryModal(defaultPreset = null) {
  if (!state.activeSessionId) {
    showToast('먼저 터미널 세션을 생성하세요', 'warning');
    return;
  }

  const modal = document.getElementById('layoutGalleryModal');
  const presetSelect = document.getElementById('layoutPresetSelect');
  if (!modal) return;

  const fallback = defaultPreset || presetSelect?.value || state.selectedLayoutPreset || 'two-columns';
  state.selectedLayoutPreset = LAYOUT_PRESETS[fallback] ? fallback : 'two-columns';
  renderLayoutGallery();
  modal.classList.add('modal--visible');
}

function closeLayoutGalleryModal() {
  const modal = document.getElementById('layoutGalleryModal');
  if (!modal) return;
  modal.classList.remove('modal--visible');
}

async function applyLayoutGallerySelection() {
  if (!state.selectedLayoutPreset) {
    showToast('레이아웃 프리셋을 먼저 선택하세요', 'warning', 1200);
    return;
  }

  await applyLayoutPreset(state.selectedLayoutPreset);

  const presetSelect = document.getElementById('layoutPresetSelect');
  if (presetSelect && LAYOUT_PRESETS[state.selectedLayoutPreset]) {
    presetSelect.value = state.selectedLayoutPreset;
  }

  closeLayoutGalleryModal();
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
  renderSplitMinimap();
  updateSplitToolbarState();

  // Fit terminal after render
  setTimeout(() => session.fitAddon.fit(), 50);
}

async function splitActivePane(direction) {
  if (!state.activeSessionId) return;

  // Prevent race condition - only one split operation at a time
  if (state.splitInProgress) return;
  state.splitInProgress = true;

  try {
    // Find the leaf node containing the active session
    const leafNode = findLeafNode(state.splitRoot, state.activeSessionId);
    if (!leafNode) return;

    // Create a new session for the split
    const session = state.sessions.get(state.activeSessionId);
    const newSession = await createSession(
      `${session.name} (split)`,
      session.projectPath,
      session.projectId,
      { activate: false }
    );

    if (!newSession) return;

    // Split the leaf node
    leafNode.split(direction, newSession.id);
    state.activeSessionId = newSession.id;

    // Render the new layout
    renderSplitLayout();
    newSession.terminal.focus();

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

function scheduleSplitRender() {
  if (state.splitRenderRaf) return;
  state.splitRenderRaf = requestAnimationFrame(() => {
    state.splitRenderRaf = null;
    renderSplitLayout();
  });
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
      removeSplitPaneHeader(session.wrapper);
    });
    renderSplitMinimap();
    updateSplitToolbarState();
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
  renderSplitMinimap();
  updateSplitToolbarState();

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
    ensureSplitPaneHeader(session);

    // Add click handler for focus or swap
    session.wrapper.onclick = () => {
      if (state.swapTargetSession) {
        completeSwap(node.sessionId);
      } else {
        activateSession(node.sessionId, { preserveSplitLayout: true });
      }
    };

    session.wrapper.ondragover = (e) => {
      const draggedSessionId = state.draggedTab?.dataset.sessionId || e.dataTransfer.getData('text/plain');
      if (!draggedSessionId || !state.sessions.has(draggedSessionId)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const dropPosition = getPaneDropPosition(session.wrapper, e);
      setPaneDropIndicator(session.wrapper, dropPosition);
    };

    session.wrapper.ondragleave = (e) => {
      if (!session.wrapper.contains(e.relatedTarget)) {
        clearPaneDropIndicators();
      }
    };

    session.wrapper.ondrop = (e) => {
      const draggedSessionId = state.draggedTab?.dataset.sessionId || e.dataTransfer.getData('text/plain');
      if (!draggedSessionId || !state.sessions.has(draggedSessionId)) return;
      e.preventDefault();
      e.stopPropagation();
      clearPaneDropIndicators();

      const dropPosition = getPaneDropPosition(session.wrapper, e);
      if (dropPosition === 'center') {
        const merged = mergePane(draggedSessionId, { fallbackSessionId: node.sessionId, silent: true });
        if (!merged) {
          activateSession(draggedSessionId, { preserveSplitLayout: true });
        } else {
          showToast('분할 창을 합쳤습니다', 'info', 1200);
        }
        return;
      }

      const moved = moveSessionToSplitPane(draggedSessionId, node.sessionId, dropPosition);
      if (moved) {
        showToast('탭을 분할 패널에 배치했습니다', 'success', 1200);
      } else {
        showToast('분할 패널 배치에 실패했습니다', 'warning', 1200);
      }
    };

    return session.wrapper;
  }

  const container = document.createElement('div');
  container.className = `split-container split-container--${node.type}`;

  const pane1 = document.createElement('div');
  pane1.className = 'split-pane';
  pane1.style.flex = `1 1 ${node.ratio * 100}%`;
  pane1.appendChild(renderSplitNode(node.children[0]));

  const resizer = document.createElement('div');
  resizer.className = `split-resizer split-resizer--${node.type}`;
  resizer.addEventListener('mousedown', (e) => startSplitResize(e, node));

  const pane2 = document.createElement('div');
  pane2.className = 'split-pane';
  pane2.style.flex = `1 1 ${(1 - node.ratio) * 100}%`;
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
    scheduleSplitRender();
  }

  function onMouseUp() {
    if (state.splitRenderRaf) {
      cancelAnimationFrame(state.splitRenderRaf);
      state.splitRenderRaf = null;
    }
    renderSplitLayout();
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
}

function closeSplitPane(sessionId) {
  if (!state.splitMode || !state.splitRoot) return false;

  // Find and remove the leaf node
  const removed = removeLeafNode(state.splitRoot, sessionId);

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

function removeLeafNode(node, sessionId) {
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

  return removeLeafNode(node.children[0], sessionId) ||
         removeLeafNode(node.children[1], sessionId);
}

function exitSplitMode() {
  state.maximizedSession = null;
  state.splitMode = false;
  state.splitRoot = null;
  renderSplitLayout();
}

function mergePane(sessionId = state.activeSessionId, options = {}) {
  const { fallbackSessionId = null, silent = false } = options;

  if (!state.splitMode || !state.splitRoot || !sessionId) {
    if (!silent) showToast('분할 모드에서만 사용할 수 있습니다', 'warning');
    return false;
  }

  const leaves = getAllLeafNodes(state.splitRoot);
  if (leaves.length <= 1) {
    if (!silent) showToast('합칠 수 있는 분할 창이 없습니다', 'info');
    return false;
  }

  const removed = removeLeafNode(state.splitRoot, sessionId);
  if (!removed) return false;

  if (state.maximizedSession === sessionId || !findLeafNode(state.splitRoot, state.maximizedSession)) {
    state.maximizedSession = null;
  }

  state.tabLayouts.delete(sessionId);

  const remainingLeaves = getAllLeafNodes(state.splitRoot);
  if (remainingLeaves.length === 0) {
    exitSplitMode();
    return true;
  }

  const preferred = fallbackSessionId && state.sessions.has(fallbackSessionId)
    ? fallbackSessionId
    : remainingLeaves[0].sessionId;
  state.activeSessionId = preferred;

  if (state.splitRoot.isLeaf()) {
    exitSplitMode();
  } else {
    renderSplitLayout();
  }
  renderTabGroups();

  const session = state.sessions.get(preferred);
  if (session) {
    session.wrapper.classList.add('terminal-wrapper--active');
    setTimeout(() => {
      session.fitAddon.fit();
      session.terminal.focus();
    }, 30);
  }

  if (!silent) showToast('활성 창을 합쳤습니다', 'success', 1200);
  return true;
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

function canMergePane(sessionId) {
  if (!state.splitMode || !state.splitRoot || !sessionId) return false;
  if (!findLeafNode(state.splitRoot, sessionId)) return false;
  return getAllLeafNodes(state.splitRoot).length > 1;
}

function removeSplitPaneHeader(wrapper) {
  if (!wrapper) return;
  wrapper.querySelector('.split-pane-header')?.remove();
}

function ensureSplitPaneHeader(session) {
  if (!session?.wrapper) return;

  let header = session.wrapper.querySelector('.split-pane-header');
  if (!header) {
    header = document.createElement('div');
    header.className = 'split-pane-header';
    header.innerHTML = `
      <span class="split-pane-header__status"></span>
      <div class="split-pane-header__meta">
        <span class="split-pane-header__title"></span>
        <span class="split-pane-header__subtitle"></span>
      </div>
    `;
  }
  if (session.wrapper.firstChild !== header) {
    session.wrapper.prepend(header);
  }

  const statusEl = header.querySelector('.split-pane-header__status');
  const titleEl = header.querySelector('.split-pane-header__title');
  const subtitleEl = header.querySelector('.split-pane-header__subtitle');

  if (statusEl) {
    const statusClass = getSessionStatusClass(session.status);
    statusEl.textContent = getStatusIcon(statusClass);
    statusEl.className = `split-pane-header__status split-pane-header__status--${statusClass}`;
    statusEl.title = getStatusLabel(session.status);
  }
  if (titleEl) {
    titleEl.textContent = session.name;
  }
  if (subtitleEl) {
    subtitleEl.textContent = getSplitPaneSubtitle(session);
    subtitleEl.title = session.projectPath || '로컬 셸';
  }
}

function getSplitBranchLabel(nodeType) {
  return nodeType === 'horizontal' ? '가로 분할' : '세로 분할';
}

function buildSplitMinimapNode(node, depth = 0) {
  if (!node) return document.createElement('div');

  if (node.isLeaf()) {
    const session = state.sessions.get(node.sessionId);
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'split-minimap__leaf';
    item.dataset.sessionId = session?.id || node.sessionId;
    item.style.setProperty('--depth', String(depth));
    if (node.sessionId === state.activeSessionId) {
      item.classList.add('split-minimap__leaf--active');
    }

    const icon = document.createElement('span');
    const statusClass = getSessionStatusClass(session?.status || SESSION_STATUS.EXITED);
    icon.className = `split-minimap__status split-minimap__status--${statusClass}`;
    icon.textContent = getStatusIcon(statusClass);

    const title = document.createElement('span');
    title.className = 'split-minimap__leaf-title';
    title.textContent = session?.name || node.sessionId;

    const subtitle = document.createElement('span');
    subtitle.className = 'split-minimap__leaf-subtitle';
    subtitle.textContent = getCompactPathLabel(session?.projectPath);

    item.appendChild(icon);
    item.appendChild(title);
    item.appendChild(subtitle);

    item.addEventListener('click', () => {
      if (session?.id) {
        activateSession(session.id, { preserveSplitLayout: true });
      }
    });

    return item;
  }

  const branch = document.createElement('div');
  branch.className = 'split-minimap__branch';
  branch.style.setProperty('--depth', String(depth));

  const branchLabel = document.createElement('div');
  branchLabel.className = 'split-minimap__branch-label';
  branchLabel.textContent = getSplitBranchLabel(node.type);

  const children = document.createElement('div');
  children.className = `split-minimap__branch-children split-minimap__branch-children--${node.type}`;
  children.appendChild(buildSplitMinimapNode(node.children[0], depth + 1));
  children.appendChild(buildSplitMinimapNode(node.children[1], depth + 1));

  branch.appendChild(branchLabel);
  branch.appendChild(children);
  return branch;
}

function renderSplitMinimap() {
  const panel = document.getElementById('splitMinimapPanel');
  const content = document.getElementById('splitMinimapContent');
  const toggleBtn = document.getElementById('toggleSplitMinimapBtn');
  if (!panel || !content) return;

  const shouldShow = state.splitMode && !!state.splitRoot && state.splitMinimapVisible;
  panel.classList.toggle('split-minimap--visible', shouldShow);
  if (toggleBtn) {
    toggleBtn.classList.toggle('split-toolbar__btn--active', shouldShow);
  }

  content.innerHTML = '';
  if (!state.splitMode || !state.splitRoot) {
    content.textContent = '분할 시 미니맵이 표시됩니다.';
    return;
  }

  if (!state.splitMinimapVisible) {
    content.textContent = '미니맵이 숨김 상태입니다.';
    return;
  }

  content.appendChild(buildSplitMinimapNode(state.splitRoot));
}

function setSplitMinimapVisibility(visible) {
  state.splitMinimapVisible = visible;
  renderSplitMinimap();
  updateSplitToolbarState();
}

function updateSplitToolbarState() {
  const hasActiveSession = Boolean(state.activeSessionId);
  const splitActive = state.splitMode && !!state.splitRoot;
  const canMergeActivePane = canMergePane(state.activeSessionId);

  [
    document.getElementById('splitDefaultBtn'),
    document.getElementById('splitHorizontalBtn'),
    document.getElementById('splitVerticalBtn'),
    document.getElementById('layoutPresetSelect'),
    document.getElementById('openLayoutGalleryBtn')
  ].forEach((control) => {
    if (control) {
      control.disabled = !hasActiveSession;
    }
  });

  const minimapBtn = document.getElementById('toggleSplitMinimapBtn');
  if (minimapBtn) {
    minimapBtn.disabled = !splitActive;
    minimapBtn.classList.toggle('split-toolbar__btn--active', splitActive && state.splitMinimapVisible);
  }

  const swapBtn = document.getElementById('swapPanesBtn');
  if (swapBtn) {
    swapBtn.disabled = !splitActive;
  }

  const mergeBtn = document.getElementById('mergePaneBtn');
  if (mergeBtn) {
    mergeBtn.disabled = !canMergeActivePane;
  }

  const maximizeBtn = document.getElementById('maximizePaneBtn');
  if (maximizeBtn) {
    maximizeBtn.disabled = !splitActive;
    maximizeBtn.classList.toggle(
      'split-toolbar__btn--active',
      splitActive && state.maximizedSession === state.activeSessionId
    );
  }

  const closeSplitBtn = document.getElementById('closeSplitBtn');
  if (closeSplitBtn) {
    closeSplitBtn.disabled = !splitActive;
  }
}

function getPaneDropPosition(wrapper, event) {
  const rect = wrapper.getBoundingClientRect();
  const xRatio = (event.clientX - rect.left) / Math.max(rect.width, 1);
  const yRatio = (event.clientY - rect.top) / Math.max(rect.height, 1);
  const threshold = 0.25;

  if (yRatio <= threshold) return 'top';
  if (yRatio >= 1 - threshold) return 'bottom';
  if (xRatio <= threshold) return 'left';
  if (xRatio >= 1 - threshold) return 'right';
  return 'center';
}

function clearPaneDropIndicators() {
  document.querySelectorAll('.terminal-wrapper--drop-target').forEach(el => {
    el.classList.remove(
      'terminal-wrapper--drop-target',
      'terminal-wrapper--drop-left',
      'terminal-wrapper--drop-right',
      'terminal-wrapper--drop-top',
      'terminal-wrapper--drop-bottom',
      'terminal-wrapper--drop-center'
    );
  });
}

function setPaneDropIndicator(wrapper, dropPosition) {
  clearPaneDropIndicators();
  wrapper.classList.add('terminal-wrapper--drop-target');
  wrapper.classList.add(`terminal-wrapper--drop-${dropPosition}`);
}

function moveSessionToSplitPane(draggedSessionId, targetSessionId, dropPosition) {
  if (!state.splitMode || !state.splitRoot) return false;
  if (draggedSessionId === targetSessionId) return false;

  const direction = (dropPosition === 'left' || dropPosition === 'right') ? 'vertical' : 'horizontal';
  const placeDraggedFirst = dropPosition === 'left' || dropPosition === 'top';

  if (findLeafNode(state.splitRoot, draggedSessionId)) {
    const removed = removeLeafNode(state.splitRoot, draggedSessionId);
    if (!removed) return false;
  }

  const targetNode = findLeafNode(state.splitRoot, targetSessionId);
  if (!targetNode || !targetNode.isLeaf()) return false;

  const oldSessionId = targetNode.sessionId;
  targetNode.type = direction;
  targetNode.sessionId = null;
  targetNode.ratio = 0.5;
  targetNode.children = placeDraggedFirst
    ? [new SplitNode('leaf', draggedSessionId), new SplitNode('leaf', oldSessionId)]
    : [new SplitNode('leaf', oldSessionId), new SplitNode('leaf', draggedSessionId)];

  state.activeSessionId = draggedSessionId;
  renderSplitLayout();
  return true;
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
  if (!state.activeSessionId) {
    showToast('먼저 터미널 세션을 생성하세요', 'warning');
    return;
  }

  const preset = LAYOUT_PRESETS[presetKey];
  if (!preset) return;

  const config = preset.create();

  // Current active session is the base

  // Reset existing split
  exitSplitMode();

  // Create layout based on preset type
  if (config.type === 'grid') {
    await createGridLayout(config.rows, config.cols);
  } else {
    await createLinearLayout(config.type, config.count);
  }
}

// Create linear split layout (horizontal or vertical)
async function createLinearLayout(direction, count) {
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
  state.tabGroups.forEach((group) => {
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
  header.style.borderLeftColor = getSafeTabColor(group.color) || '#0e639c';
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
  const safeColor = getSafeTabColor(session.color);
  if (safeColor) {
    tab.style.borderTopColor = safeColor;
    tab.classList.add('tab--colored');
  }

  const statusClass = getSessionStatusClass(session.status);
  const statusIcon = getStatusIcon(statusClass);
  tab.innerHTML = `
    <span class="tab__status tab__status--${statusClass}">${statusIcon}</span>
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
  renderProjectCmdTrees();
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
  renderProjectCmdTrees();
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
        <button class="tabs__filter-clear" aria-label="필터 해제">&times;</button>
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

function renderProjectCmdTrees() {
  document.querySelectorAll('[data-project-cmd-tree]').forEach((treeEl) => {
    const projectId = treeEl.dataset.projectCmdTree;
    const sessionSet = state.projectTabMap.get(projectId);
    const sessionIds = sessionSet ? Array.from(sessionSet) : [];
    const sessions = sessionIds
      .map((sessionId) => state.sessions.get(sessionId))
      .filter(Boolean);

    if (sessions.length === 0) {
      treeEl.innerHTML = '';
      treeEl.classList.remove('sidebar__cmd-tree--visible');
      return;
    }

    const cmdItems = sessions.map((session) => {
      const activeClass = session.id === state.activeSessionId ? ' sidebar__cmd-item--active' : '';
      const statusClass = `sidebar__cmd-status--${getSessionStatusClass(session.status)}`;
      const sessionIdAttr = escapeDataAttr(session.id);
      return `
        <div class="sidebar__cmd-item${activeClass}" data-session-id="${sessionIdAttr}" title="${escapeHtmlAttr(session.name)}">
          <span class="sidebar__cmd-status ${statusClass}">${getStatusIcon(getSessionStatusClass(session.status))}</span>
          <span class="sidebar__cmd-name">${escapeHtml(session.name)}</span>
          <button class="sidebar__cmd-close" data-session-id="${sessionIdAttr}" aria-label="세션 닫기">&times;</button>
        </div>
      `;
    }).join('');

    treeEl.innerHTML = `
      <div class="sidebar__cmd-tree-header">CMD ${sessions.length}</div>
      <div class="sidebar__cmd-tree-list">${cmdItems}</div>
    `;
    treeEl.classList.add('sidebar__cmd-tree--visible');
  });

  document.querySelectorAll('.sidebar__cmd-item').forEach((item) => {
    item.onclick = (e) => {
      if (e.target.closest('.sidebar__cmd-close')) return;
      e.stopPropagation();
      const { sessionId } = item.dataset;
      if (sessionId && state.sessions.has(sessionId)) {
        activateSession(sessionId);
      }
    };
  });

  document.querySelectorAll('.sidebar__cmd-close').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const { sessionId } = btn.dataset;
      if (sessionId && state.sessions.has(sessionId)) {
        closeSession(sessionId);
      }
    };
  });
}

// ===== Claude Code Integration =====

// Claude Code 상태
const claudeState = {
  installed: false,
  checking: false,
  version: null,
  activeSessions: new Set() // Claude 세션 ID 추적
};

// Claude Code 설치 확인
async function checkClaudeInstalled() {
  if (!isAiFeaturesEnabled()) {
    claudeState.installed = false;
    updateClaudeButton();
    return;
  }
  if (claudeState.checking) return;

  claudeState.checking = true;
  updateClaudeStatusIndicator('checking');

  try {
    const status = await invoke('check_claude_installed');
    claudeState.installed = status.installed;
    claudeState.version = status.version;

    updateClaudeStatusIndicator(status.installed ? 'installed' : 'not-installed');
    updateClaudeButton();

    debug('Claude Code status:', status);
  } catch (error) {
    debug('Failed to check Claude installation:', error);
    claudeState.installed = false;
    updateClaudeStatusIndicator('not-installed');
    updateClaudeButton();
  } finally {
    claudeState.checking = false;
  }
}

// Claude 상태 표시 업데이트
function updateClaudeStatusIndicator(status) {
  const indicator = document.getElementById('claudeStatus');
  if (!indicator) return;

  indicator.className = 'claude-status';
  indicator.classList.add(`claude-status--${status}`);

  const titles = {
    'checking': 'Claude Code 확인 중...',
    'installed': `Claude Code 설치됨 ${claudeState.version || ''}`.trim(),
    'not-installed': 'Claude Code 미설치'
  };

  indicator.title = titles[status] || 'Claude Code 상태';
}

// Claude 버튼 업데이트
function updateClaudeButton() {
  const claudeBtn = document.getElementById('claudeBtn');
  if (!claudeBtn) return;

  const hasActiveSessions = claudeState.activeSessions.size > 0;

  if (hasActiveSessions) {
    claudeBtn.classList.add('sidebar__claude-btn--running');
    claudeBtn.querySelector('.claude-text').textContent = `Claude (${claudeState.activeSessions.size})`;
  } else {
    claudeBtn.classList.remove('sidebar__claude-btn--running');
    claudeBtn.querySelector('.claude-text').textContent = 'Start Claude';
  }

  claudeBtn.disabled = !claudeState.installed;
}

// Claude 세션 시작
async function _startClaudeSession(projectPath = null) {
  if (!isAiFeaturesEnabled()) {
    showToast('현재 버전에서는 AI 기능이 비활성화되어 있습니다', 'info');
    return;
  }
  if (!claudeState.installed) {
    showToast('Claude Code가 설치되어 있지 않습니다', 'error');
    return;
  }

  try {
    // 새 세션 생성
    const sessionId = await createSession(projectPath);
    if (!sessionId) {
      showToast('세션 생성에 실패했습니다', 'error');
      return;
    }

    const session = state.sessions.get(sessionId);
    if (!session) return;

    // Claude 세션으로 표시
    session.isClaudeSession = true;
    claudeState.activeSessions.add(sessionId);

    // 탭에 Claude 표시 추가
    const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (tab) {
      tab.classList.add('tab--claude');
      const title = tab.querySelector('.tab__title');
      if (title) {
        title.textContent = '🤖 Claude Code';
      }
    }

    // Claude 명령어 시작
    const command = await invoke('get_claude_start_command', { projectPath });
    if (session.ptySessionId) {
      await invoke('write_pty', {
        sessionId: session.ptySessionId,
        data: command
      });
    }

    updateClaudeButton();
    showToast('Claude Code 세션이 시작되었습니다', 'success', 2000);

    debug('Claude session started:', sessionId);
  } catch (error) {
    debug('Failed to start Claude session:', error);
    showToast('Claude Code 시작에 실패했습니다', 'error');
  }
}

// Claude 세션 종료 시 처리
function onClaudeSessionClose(sessionId) {
  if (claudeState.activeSessions.has(sessionId)) {
    claudeState.activeSessions.delete(sessionId);
    updateClaudeButton();
    debug('Claude session closed:', sessionId);
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
    e.dataTransfer.dropEffect = 'copy';
    document.getElementById('terminalContainer').classList.add('terminal-container--drop-active');
  }
}

function unhighlightDropZone() {
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

  // Check if single directory was dropped
  if (files.length === 1) {
    const file = files[0];
    try {
      const metadata = await invoke('get_file_metadata', { path: file.path });
      if (metadata.is_dir) {
        // For directories, use cd command
        let path = file.path;
        if (path.includes(' ')) {
          path = `"${path}"`;
        }
        const cdCommand = `cd ${path}`;

        await invoke('write_pty', {
          sessionId: session.ptySessionId,
          data: cdCommand
        });

        showToast('폴더로 이동 명령 입력됨', 'success', 2000);
        debug('CD command inserted:', cdCommand);
        return;
      }
    } catch (error) {
      debug('Failed to get file metadata:', error);
      // Continue with normal file handling
    }
  }

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
  ({
    tabsList,
    terminalContainer,
    newTabBtn,
    projectList,
    addProjectBtn,
    addProjectModal,
    closeAddProjectModal,
    cancelAddProject,
    confirmAddProject,
    projectNameInput,
    projectPathInput,
    browsePathBtn,
    snippetList,
    addSnippetBtn,
    addSnippetModal,
    closeAddSnippetModal,
    cancelAddSnippet,
    confirmAddSnippet,
    snippetNameInput,
    snippetCommandInput,
    settingsBtn,
    settingsModal,
    closeSettingsModal,
    cancelSettings,
    saveSettingsBtn,
    settingsTheme,
    settingsFontSize,
    fontSizeValue,
    settingsFontFamily,
    settingsEnableLogging,
    settingsEnableNotifications,
    settingsBlockMode,
    clearLogsBtn
  } = initializeDomElementsRegistry({
    elements,
    debug
  }));
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
  closeSettingsModal.addEventListener('click', () => cancelSettingsModal());
  cancelSettings.addEventListener('click', () => cancelSettingsModal());

  // Real-time preview for theme changes
  settingsTheme.addEventListener('change', () => {
    previewSettings();
  });

  // Real-time preview for font size changes
  settingsFontSize.addEventListener('input', (e) => {
    fontSizeValue.textContent = `${e.target.value}px`;
    previewSettings();
  });

  // Real-time preview for font family changes
  settingsFontFamily.addEventListener('change', () => {
    previewSettings();
  });

  // Snippet threshold slider
  const settingsSnippetThreshold = document.getElementById('settingsSnippetThreshold');
  const snippetThresholdValue = document.getElementById('snippetThresholdValue');
  if (settingsSnippetThreshold && snippetThresholdValue) {
    settingsSnippetThreshold.addEventListener('input', (e) => {
      snippetThresholdValue.textContent = `${e.target.value} times`;
    });
  }

  saveSettingsBtn.addEventListener('click', async () => {
    const settingsLocale = document.getElementById('settingsLocale');
    const settingsEnableSnippetSuggestions = document.getElementById('settingsEnableSnippetSuggestions');
    const settingsSnippetThreshold = document.getElementById('settingsSnippetThreshold');

    await saveSettings({
      theme: settingsTheme.value,
      fontSize: parseInt(settingsFontSize.value),
      fontFamily: settingsFontFamily.value,
      enableLogging: settingsEnableLogging.checked,
      enableNotifications: settingsEnableNotifications.checked,
      enableBlockMode: settingsBlockMode?.checked ?? false,
      locale: settingsLocale?.value || 'ko',
      enableSnippetSuggestions: settingsEnableSnippetSuggestions?.checked ?? true,
      snippetSuggestionThreshold: settingsSnippetThreshold ? parseInt(settingsSnippetThreshold.value) : 3,
      enableAiFeatures: false,
    });

    // Update command history settings
    if (settingsSnippetThreshold) {
      commandHistory.minUsageCount = parseInt(settingsSnippetThreshold.value);
      commandHistory.save();
    }

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

  // Environment Variables Modal
  const envVarsModal = document.getElementById('envVarsModal');
  const closeEnvVarsModal = document.getElementById('closeEnvVarsModal');
  const cancelEnvVars = document.getElementById('cancelEnvVars');
  const saveEnvVarsBtn = document.getElementById('saveEnvVars');
  const addEnvVarBtn = document.getElementById('addEnvVarBtn');
  const layoutGalleryModal = document.getElementById('layoutGalleryModal');
  const closeLayoutGalleryBtn = document.getElementById('closeLayoutGalleryModal');
  const cancelLayoutGalleryBtn = document.getElementById('cancelLayoutGallery');
  const applyLayoutGalleryBtn = document.getElementById('applyLayoutGallery');

  if (closeEnvVarsModal) {
    closeEnvVarsModal.addEventListener('click', () => hideEnvVarsModal());
  }
  if (cancelEnvVars) {
    cancelEnvVars.addEventListener('click', () => hideEnvVarsModal());
  }
  if (saveEnvVarsBtn) {
    saveEnvVarsBtn.addEventListener('click', () => saveEnvVars());
  }
  if (addEnvVarBtn) {
    addEnvVarBtn.addEventListener('click', () => addEnvVarRow());
  }
  if (closeLayoutGalleryBtn) {
    closeLayoutGalleryBtn.addEventListener('click', () => closeLayoutGalleryModal());
  }
  if (cancelLayoutGalleryBtn) {
    cancelLayoutGalleryBtn.addEventListener('click', () => closeLayoutGalleryModal());
  }
  if (applyLayoutGalleryBtn) {
    applyLayoutGalleryBtn.addEventListener('click', async () => {
      await applyLayoutGallerySelection();
    });
  }

  // ===== AI Mode Setup =====
  const aiModeToggle = document.getElementById('aiModeToggle');
  const aiInputBar = document.getElementById('aiInputBar');
  const aiInput = document.getElementById('aiInput');
  const aiSendBtn = document.getElementById('aiSendBtn');
  const aiHelpBtn = document.getElementById('aiHelpBtn');
  const aiPreviewModal = document.getElementById('aiPreviewModal');
  const closeAiPreviewModal = document.getElementById('closeAiPreviewModal');
  const cancelAiPreview = document.getElementById('cancelAiPreview');
  const copyAiCommand = document.getElementById('copyAiCommand');
  const executeAiCommand = document.getElementById('executeAiCommand');
  const aiHelpModal = document.getElementById('aiHelpModal');
  const closeAiHelpModal = document.getElementById('closeAiHelpModal');
  const closeAiHelp = document.getElementById('closeAiHelp');

  const aiEnabled = isAiFeaturesEnabled();
  let aiModeActive = false;
  let currentAiTranslation = null;

  // AI 모드 토글
  if (aiEnabled && aiModeToggle) {
    aiModeToggle.addEventListener('click', () => {
      aiModeActive = !aiModeActive;
      aiModeToggle.classList.toggle('ai-input-bar__toggle--active', aiModeActive);
      aiInput.disabled = !aiModeActive;
      aiSendBtn.disabled = !aiModeActive;
      aiInputBar.classList.toggle('ai-input-bar--active', aiModeActive);

      if (aiModeActive) {
        aiInput.focus();
        showToast('AI 모드 활성화 (Ctrl+Space로 토글)', 'info', 2000);
      } else {
        showToast('AI 모드 비활성화', 'info', 2000);
      }
    });
  }

  // AI 명령어 변환
  async function translateCommand(text) {
    if (!text.trim()) {
      showToast('명령어를 입력해주세요', 'warning');
      return;
    }

    try {
      const result = await invoke('translate_natural_language', {
        text: text,
        shellType: 'powershell'
      });

      if (result.success) {
        currentAiTranslation = result;
        showAiPreview(text, result);
      } else {
        showToast(result.description || '명령어를 변환할 수 없습니다', 'warning');
        if (result.alternatives && result.alternatives.length > 0) {
          debug('제안:', result.alternatives);
        }
      }
    } catch (error) {
      debug('AI 변환 실패:', error);
      showToast(`변환 실패: ${error}`, 'error');
    }
  }

  // AI 프리뷰 모달 표시
  function showAiPreview(input, result) {
    document.getElementById('aiPreviewInput').textContent = input;
    document.getElementById('aiPreviewCommand').textContent = result.command || '';
    document.getElementById('aiPreviewDescription').textContent = result.description || '';

    const confidenceEl = document.getElementById('aiPreviewConfidence');
    if (result.confidence) {
      const percent = Math.round(result.confidence * 100);
      confidenceEl.textContent = `신뢰도: ${percent}%`;
      confidenceEl.style.color = percent >= 70 ? 'var(--accent)' : 'var(--text-secondary)';
    } else {
      confidenceEl.textContent = '';
    }

    const alternativesEl = document.getElementById('aiPreviewAlternatives');
    if (result.alternatives && result.alternatives.length > 0) {
      alternativesEl.innerHTML = '<strong>다른 제안:</strong><br>' +
        result.alternatives.map(alt => `<div>${escapeHtml(alt)}</div>`).join('');
    } else {
      alternativesEl.innerHTML = '';
    }

    aiPreviewModal.classList.add('modal--visible');
  }

  // AI 프리뷰 모달 닫기
  function hideAiPreview() {
    aiPreviewModal.classList.remove('modal--visible');
    currentAiTranslation = null;
  }

  // AI 명령어 실행
  async function executeAiTranslatedCommand() {
    if (!currentAiTranslation || !currentAiTranslation.command) return;

    const activeSession = Array.from(state.sessions.values()).find(s =>
      s.wrapper.classList.contains('terminal-wrapper--active')
    );

    if (!activeSession || !activeSession.ptySessionId) {
      showToast('활성 터미널 세션이 없습니다', 'error');
      return;
    }

    try {
      await invoke('write_pty', {
        sessionId: activeSession.ptySessionId,
        data: currentAiTranslation.command + '\r'
      });
      hideAiPreview();
      aiInput.value = '';
      showToast('명령어가 실행되었습니다', 'success', 2000);
    } catch (error) {
      debug('명령어 실행 실패:', error);
      showToast(`실행 실패: ${error}`, 'error');
    }
  }

  // AI 명령어 복사
  function copyAiTranslatedCommand() {
    if (!currentAiTranslation || !currentAiTranslation.command) return;

    navigator.clipboard.writeText(currentAiTranslation.command).then(() => {
      showToast('명령어가 복사되었습니다', 'success', 1500);
    }).catch(error => {
      debug('복사 실패:', error);
      showToast('복사 실패', 'error');
    });
  }

  // AI 도움말 표시
  async function showAiHelp() {
    try {
      const patterns = await invoke('get_ai_patterns');
      const patternsEl = document.getElementById('aiHelpPatterns');

      patternsEl.innerHTML = patterns.map(p => `
        <div class="ai-help__pattern">
          <h4 class="ai-help__pattern-name">${escapeHtml(p.name)}</h4>
          <p class="ai-help__pattern-examples">${escapeHtml(p.examples)}</p>
        </div>
      `).join('');

      aiHelpModal.classList.add('modal--visible');
    } catch (error) {
      debug('도움말 로드 실패:', error);
      showToast('도움말을 불러올 수 없습니다', 'error');
    }
  }

  // AI 이벤트 리스너
  if (aiEnabled && aiSendBtn) {
    aiSendBtn.addEventListener('click', () => {
      translateCommand(aiInput.value);
    });
  }

  if (aiEnabled && aiInput) {
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        translateCommand(aiInput.value);
      } else if (e.key === 'Escape') {
        aiInput.value = '';
        aiInput.blur();
      }
    });
  }

  if (aiEnabled && aiHelpBtn) {
    aiHelpBtn.addEventListener('click', showAiHelp);
  }

  if (aiEnabled && closeAiPreviewModal) {
    closeAiPreviewModal.addEventListener('click', hideAiPreview);
  }

  if (aiEnabled && cancelAiPreview) {
    cancelAiPreview.addEventListener('click', hideAiPreview);
  }

  if (aiEnabled && copyAiCommand) {
    copyAiCommand.addEventListener('click', copyAiTranslatedCommand);
  }

  if (aiEnabled && executeAiCommand) {
    executeAiCommand.addEventListener('click', executeAiTranslatedCommand);
  }

  if (aiEnabled && closeAiHelpModal) {
    closeAiHelpModal.addEventListener('click', () => {
      aiHelpModal.classList.remove('modal--visible');
    });
  }

  if (aiEnabled && closeAiHelp) {
    closeAiHelp.addEventListener('click', () => {
      aiHelpModal.classList.remove('modal--visible');
    });
  }

  const modalTargets = aiEnabled
    ? [addProjectModal, addSnippetModal, settingsModal, envVarsModal, layoutGalleryModal, aiPreviewModal, aiHelpModal]
    : [addProjectModal, addSnippetModal, settingsModal, envVarsModal, layoutGalleryModal];

  // Close modals when clicking outside
  setupModalOverlayClose(modalTargets);

  // Keyboard events
  document.addEventListener('keydown', (e) => {
    // Ctrl+Space: AI 모드 토글
    if (aiEnabled && e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      if (aiModeToggle) aiModeToggle.click();
      return;
    }

    if (e.key === 'Escape') {
      closeVisibleModals(modalTargets);
      return;
    }
    if (
      addProjectModal.classList.contains('modal--visible') ||
      addSnippetModal.classList.contains('modal--visible') ||
      settingsModal.classList.contains('modal--visible') ||
      (envVarsModal && envVarsModal.classList.contains('modal--visible')) ||
      (layoutGalleryModal && layoutGalleryModal.classList.contains('modal--visible')) ||
      (aiPreviewModal && aiPreviewModal.classList.contains('modal--visible')) ||
      (aiHelpModal && aiHelpModal.classList.contains('modal--visible')) ||
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
  commandHistory.load();

  try {
    await loadSettings();
  } catch (error) {
    debug('Error loading settings:', error);
  }

  setupEventListeners();
  setupAccessibility();
  setupFileDragDrop();
  createRecordingControls();
  initializeHistoryPanel();  // 히스토리 패널 초기화
  setupSplitToolbar();       // 분할 툴바 초기화
  renderSplitMinimap();

  try {
    await loadCategories();
    await loadSnippets();
    if (isAiFeaturesEnabled()) {
      await checkClaudeInstalled();
    }
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
// ===== Terminal Sharing Functions =====

// 공유 모달 표시
function showSharingModal(sessionId) {
  const session = state.sessions.get(sessionId);
  if (!session) return;

  // 기존 모달 제거
  const existingModal = document.getElementById('sharingModal');
  if (existingModal) existingModal.remove();

  // 모달 생성
  const modal = document.createElement('div');
  modal.id = 'sharingModal';
  modal.className = 'sharing-modal-overlay';
  modal.innerHTML = `
    <div class="sharing-modal">
      <div class="sharing-modal__header">
        <h3 class="sharing-modal__title">터미널 세션 공유</h3>
        <button class="sharing-modal__close" aria-label="닫기">&times;</button>
      </div>
      <div class="sharing-modal__body">
        <p class="sharing-modal__description">
          다른 사용자와 이 터미널 세션을 공유할 수 있습니다. 공유 코드를 전달하세요.
        </p>
        <div class="sharing-modal__code-container">
          <div class="sharing-modal__code" id="shareCode">
            <span class="sharing-modal__loading">공유 코드 생성 중...</span>
          </div>
          <button class="btn btn--primary sharing-modal__copy" id="copyShareCode" disabled>
            복사
          </button>
        </div>
        <div class="sharing-modal__info">
          <span class="sharing-modal__info-icon">ℹ️</span>
          <span>공유는 현재 세션에서만 활성화됩니다.</span>
        </div>
      </div>
      <div class="sharing-modal__footer">
        <button class="btn btn--secondary sharing-modal__cancel">취소</button>
        <button class="btn btn--danger sharing-modal__stop" id="stopSharingBtn" style="display: none;">
          공유 중지
        </button>
      </div>
    </div>
  `;

  // 닫기 버튼 이벤트
  const closeModal = () => {
    modal.classList.add('sharing-modal-overlay--hiding');
    setTimeout(() => modal.remove(), 200);
  };

  modal.querySelector('.sharing-modal__close').addEventListener('click', closeModal);
  modal.querySelector('.sharing-modal__cancel').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // ESC 키로 닫기
  const handleKeydown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleKeydown);
    }
  };
  document.addEventListener('keydown', handleKeydown);

  // 공유 중지 버튼
  modal.querySelector('#stopSharingBtn').addEventListener('click', async () => {
    await stopSharing(sessionId);
    closeModal();
  });

  document.body.appendChild(modal);

  // 공유 시작
  startSharing(sessionId);
}

// 세션 공유 시작
async function startSharing(sessionId) {
  const session = state.sessions.get(sessionId);
  if (!session) return;

  try {
    // 백엔드에 공유 시작 요청
    const shareCode = await invoke('start_session_sharing', {
      sessionId: sessionId,
      ownerId: null // 로컬 사용자
    });

    // 공유 코드 표시
    const codeElement = document.getElementById('shareCode');
    if (codeElement) {
      const codeSpan = document.createElement('span');
      codeSpan.className = 'sharing-modal__code-text';
      codeSpan.textContent = shareCode;
      codeElement.replaceChildren(codeSpan);
    }

    // 복사 버튼 활성화
    const copyButton = document.getElementById('copyShareCode');
    if (copyButton) {
      copyButton.disabled = false;
      copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(shareCode).then(() => {
          showToast('공유 코드가 클립보드에 복사되었습니다', 'success', 2000);
          copyButton.textContent = '복사됨!';
          setTimeout(() => {
            copyButton.textContent = '복사';
          }, 2000);
        }).catch((error) => {
          debug('Failed to copy share code:', error);
          showToast('복사 실패', 'error');
        });
      });
    }

    // 중지 버튼 표시
    const stopButton = document.getElementById('stopSharingBtn');
    if (stopButton) {
      stopButton.style.display = 'block';
    }

    // 세션에 공유 상태 저장
    session.isSharing = true;
    session.shareCode = shareCode;

    // 탭에 공유 중 표시
    updateTabSharingIndicator(sessionId, true);

    debug('Session sharing started:', sessionId, shareCode);
    showToast('세션 공유가 시작되었습니다', 'success', 2000);
  } catch (error) {
    debug('Failed to start sharing:', error);
    showToast('공유 시작 실패: ' + error, 'error');

    const codeElement = document.getElementById('shareCode');
    if (codeElement) {
      const errorSpan = document.createElement('span');
      errorSpan.className = 'sharing-modal__error';
      errorSpan.textContent = '공유 시작 실패';
      codeElement.replaceChildren(errorSpan);
    }
  }
}

// 세션 공유 중지
async function stopSharing(sessionId) {
  const session = state.sessions.get(sessionId);
  if (!session) return;

  try {
    // 백엔드에 공유 중지 요청
    const result = await invoke('stop_session_sharing', {
      sessionId: sessionId
    });

    if (result) {
      // 세션에서 공유 상태 제거
      session.isSharing = false;
      session.shareCode = null;

      // 탭에서 공유 중 표시 제거
      updateTabSharingIndicator(sessionId, false);

      debug('Session sharing stopped:', sessionId);
      showToast('세션 공유가 중지되었습니다', 'success', 2000);
    }
  } catch (error) {
    debug('Failed to stop sharing:', error);
    showToast('공유 중지 실패: ' + error, 'error');
  }
}

// 탭에 공유 중 표시 업데이트
function updateTabSharingIndicator(sessionId, isSharing) {
  const tab = document.querySelector(`[data-session-id="${sessionId}"]`);
  if (!tab) return;

  if (isSharing) {
    tab.classList.add('tab--sharing');

    // 공유 아이콘 추가 (status 아이콘 옆에)
    let sharingIcon = tab.querySelector('.tab__sharing-icon');
    if (!sharingIcon) {
      sharingIcon = document.createElement('span');
      sharingIcon.className = 'tab__sharing-icon';
      sharingIcon.textContent = '🔗';
      sharingIcon.title = '공유 중';

      const titleElement = tab.querySelector('.tab__title');
      if (titleElement) {
        titleElement.parentNode.insertBefore(sharingIcon, titleElement);
      }
    }
  } else {
    tab.classList.remove('tab--sharing');

    // 공유 아이콘 제거
    const sharingIcon = tab.querySelector('.tab__sharing-icon');
    if (sharingIcon) {
      sharingIcon.remove();
    }
  }
}

// ===== Git Panel Functions =====

const { toggleGitPanel, refreshGitStatus } = createGitPanelController({
  state,
  eventBus,
  showToast,
  debug,
  showConfirmDialog,
  escapeHtml,
  escapeHtmlAttr
});

// History 패널 초기화 (app.js에서 createHistoryPanel 호출)
function initializeHistoryPanel() {
  // history-panel.js에서 가져온 createHistoryPanel 호출
  createHistoryPanel(commandHistory, state, showToast, escapeHtml);
}

// Split Toolbar 초기화
function setupSplitToolbar() {
  // Split buttons
  document.getElementById('splitHorizontalBtn')?.addEventListener('click', splitHorizontal);
  document.getElementById('splitDefaultBtn')?.addEventListener('click', splitDefault);
  document.getElementById('splitVerticalBtn')?.addEventListener('click', splitVertical);

  const layoutPresetSelect = document.getElementById('layoutPresetSelect');
  layoutPresetSelect?.addEventListener('change', async (event) => {
    const preset = event.target?.value;
    if (!preset) return;
    await applyLayoutPreset(preset);
  });

  document.getElementById('openLayoutGalleryBtn')?.addEventListener('click', () => {
    const preset = layoutPresetSelect?.value || null;
    openLayoutGalleryModal(preset);
  });

  // Control buttons
  document.getElementById('swapPanesBtn')?.addEventListener('click', () => {
    if (state.activeSessionId) {
      startSwapMode(state.activeSessionId);
    }
  });
  document.getElementById('toggleSplitMinimapBtn')?.addEventListener('click', () => {
    setSplitMinimapVisibility(!state.splitMinimapVisible);
  });
  document.getElementById('mergePaneBtn')?.addEventListener('click', () => mergePane());
  document.getElementById('maximizePaneBtn')?.addEventListener('click', () => toggleMaximize());
  document.getElementById('closeSplitBtn')?.addEventListener('click', () => {
    exitSplitMode();
    showToast('분할 모드 종료', 'info');
  });

  updateSplitToolbarState();
  debug('Split toolbar setup complete');
}
