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
});
