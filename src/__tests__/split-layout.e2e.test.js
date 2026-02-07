import fs from 'node:fs';
import path from 'node:path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { invokeMock, listenMock, dialogOpenMock } from './setup.js';

async function waitFor(predicate, timeoutMs = 5000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('Timed out waiting for condition');
}

function loadIndexHtml() {
  const indexPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // app.js is imported explicitly in the test to keep module loading deterministic.
  return html.replace(
    /<script type="module" src="\/src\/app\.js"><\/script>/,
    ''
  );
}

function createDndEvent(type, baseTransfer = null, options = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const store = {};
  const dataTransfer = baseTransfer || {
    effectAllowed: 'move',
    dropEffect: 'move',
    types: [],
    setData(key, value) {
      store[key] = value;
      this.types = Object.keys(store);
    },
    getData(key) {
      return store[key] || '';
    }
  };

  Object.defineProperty(event, 'dataTransfer', {
    configurable: true,
    value: dataTransfer
  });

  Object.defineProperty(event, 'clientX', {
    configurable: true,
    value: options.clientX ?? 0
  });

  Object.defineProperty(event, 'clientY', {
    configurable: true,
    value: options.clientY ?? 0
  });

  return event;
}

describe('Split Layout E2E', () => {
  let logSpy;

  beforeEach(() => {
    invokeMock.mockClear();
    listenMock.mockClear();
    dialogOpenMock.mockClear();
    vi.resetModules();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    document.documentElement.innerHTML = loadIndexHtml();
  });

  afterEach(() => {
    logSpy?.mockRestore();
  });

  it('splits terminal layout when horizontal split button is clicked', async () => {
    await import('../app.js');

    if (document.readyState === 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    await waitFor(() => document.querySelectorAll('.tab').length >= 1);

    const splitButton = document.getElementById('splitHorizontalBtn');
    expect(splitButton).toBeTruthy();
    splitButton.click();

    await waitFor(() => !!document.querySelector('#terminalContainer .split-container'));

    const terminalContainer = document.getElementById('terminalContainer');
    expect(terminalContainer.classList.contains('terminal-container--split')).toBe(true);
    expect(terminalContainer.querySelectorAll('.split-pane').length).toBe(2);
    expect(terminalContainer.querySelectorAll('.terminal-wrapper--split').length).toBeGreaterThanOrEqual(2);

    const createPtyCalls = invokeMock.mock.calls.filter(([command]) => command === 'create_pty');
    expect(createPtyCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('supports dragging a tab into a split pane drop zone', async () => {
    await import('../app.js');

    if (document.readyState === 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    await waitFor(() => document.querySelectorAll('.tab').length >= 1);

    document.getElementById('newTabBtn').click();
    await waitFor(() => document.querySelectorAll('.tab').length >= 2);

    const tabs = Array.from(document.querySelectorAll('.tab'));
    const tabToDrag = tabs[1];
    const draggedSessionId = tabToDrag.dataset.sessionId;
    tabs[0].click();

    document.getElementById('splitHorizontalBtn').click();
    await waitFor(() => document.querySelectorAll('#terminalContainer .terminal-wrapper--split').length >= 2);

    const targetPane = document.querySelector('#terminalContainer .terminal-wrapper--split');
    const dragStartEvent = createDndEvent('dragstart');
    tabToDrag.dispatchEvent(dragStartEvent);

    const dragOverEvent = createDndEvent('dragover', dragStartEvent.dataTransfer, { clientX: 1, clientY: 0 });
    targetPane.dispatchEvent(dragOverEvent);
    const dropEvent = createDndEvent('drop', dragStartEvent.dataTransfer, { clientX: 1, clientY: 0 });
    targetPane.dispatchEvent(dropEvent);
    tabToDrag.dispatchEvent(createDndEvent('dragend', dragStartEvent.dataTransfer));

    await waitFor(() => {
      const draggedWrapper = document.getElementById(`terminal-${draggedSessionId}`);
      return draggedWrapper?.classList.contains('terminal-wrapper--split');
    });
    expect(document.querySelector('.terminal-wrapper--drop-target')).toBeNull();
  });

  it('persists tab_layouts when saving session state', async () => {
    await import('../app.js');

    if (document.readyState === 'loading') {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }

    await waitFor(() => document.querySelectorAll('.tab').length >= 1);
    document.getElementById('splitHorizontalBtn').click();
    await waitFor(() => document.querySelectorAll('#terminalContainer .split-container').length >= 1);

    window.dispatchEvent(new Event('beforeunload'));

    await waitFor(() => invokeMock.mock.calls.some(([command]) => command === 'save_session_state'));

    const saveCall = invokeMock.mock.calls.filter(([command]) => command === 'save_session_state').at(-1);
    const sessionState = saveCall[1].state;

    expect(sessionState.tab_layouts).toBeTruthy();
    expect(Object.keys(sessionState.tab_layouts).length).toBeGreaterThanOrEqual(1);
  });
});
