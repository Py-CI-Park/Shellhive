import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createErrorExplanationController } from '../error-explanations.js';
import { invokeMock } from './setup.js';

function createController() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const state = {
    sessions: new Map([
      ['session-1', {
        container,
        ptySessionId: 'pty-1'
      }]
    ])
  };

  const debug = vi.fn();
  const showToast = vi.fn();

  const escapeHtml = (value) => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const controller = createErrorExplanationController({
    state,
    invoke: (...args) => invokeMock(...args),
    debug,
    showToast,
    escapeHtml,
    escapeHtmlAttr: escapeHtml
  });

  return { controller, container, showToast };
}

describe('error-explanations module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    invokeMock.mockReset();
  });

  it('should detect known error patterns', () => {
    const { controller } = createController();

    const detected = controller.detectErrorPattern('npm ERR! code EACCES');

    expect(detected).toBeTruthy();
    expect(detected.pattern).toBe('npm ERR!');
  });

  it('should render explanation panel for detected errors', () => {
    const { controller, container } = createController();

    controller.showErrorExplanation('session-1', 'No such file or directory', 'No such file or directory: foo');

    const panel = container.querySelector('.error-explanation');
    expect(panel).toBeTruthy();
    expect(panel.textContent).toContain('해결 방법');
    expect(panel.textContent).toContain('에러 설명');
  });

  it('should execute suggested command when apply button is clicked', async () => {
    invokeMock.mockResolvedValue(null);
    const { controller, container, showToast } = createController();

    controller.showErrorExplanation('session-1', 'No such file or directory', 'No such file or directory: foo');

    const applyButton = container.querySelector('.error-explanation__apply');
    expect(applyButton).toBeTruthy();

    applyButton.click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(invokeMock).toHaveBeenCalledWith('write_pty', {
      sessionId: 'pty-1',
      data: 'ls\r'
    });
    expect(showToast).toHaveBeenCalled();
  });
});
