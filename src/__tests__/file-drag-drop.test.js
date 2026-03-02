import { describe, expect, it, vi } from 'vitest';
import { createFileDragDropController } from '../file-drag-drop.js';

function createFiles(paths) {
  return paths.map((path) => ({ path }));
}

describe('file-drag-drop module', () => {
  it('should show warning when no active session', async () => {
    const invoke = vi.fn(async () => null);
    const showToast = vi.fn();
    const controller = createFileDragDropController({
      invoke,
      debug: vi.fn(),
      showToast,
      getActiveSession: () => null,
      getContainer: () => document.createElement('div')
    });

    await controller.handleFileDrop({
      dataTransfer: { files: createFiles(['C:/a.txt']) }
    });

    expect(showToast).toHaveBeenCalledWith('활성 터미널 세션이 없습니다', 'warning');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('should write cd command for single directory drop', async () => {
    const invoke = vi.fn(async (command) => {
      if (command === 'get_file_metadata') {
        return { is_dir: true };
      }
      return null;
    });
    const controller = createFileDragDropController({
      invoke,
      debug: vi.fn(),
      showToast: vi.fn(),
      getActiveSession: () => ({ ptySessionId: 'pty-1' }),
      getContainer: () => document.createElement('div')
    });

    await controller.handleFileDrop({
      dataTransfer: { files: createFiles(['C:/My Folder']) }
    });

    expect(invoke).toHaveBeenCalledWith('write_pty', {
      sessionId: 'pty-1',
      data: 'cd "C:/My Folder"'
    });
  });

  it('should write quoted file paths for multi file drop', async () => {
    const invoke = vi.fn(async () => ({ is_dir: false }));
    const controller = createFileDragDropController({
      invoke,
      debug: vi.fn(),
      showToast: vi.fn(),
      getActiveSession: () => ({ ptySessionId: 'pty-2' }),
      getContainer: () => document.createElement('div')
    });

    await controller.handleFileDrop({
      dataTransfer: {
        files: createFiles(['C:/a.txt', 'C:/My Dir/b.txt'])
      }
    });

    expect(invoke).toHaveBeenCalledWith('write_pty', {
      sessionId: 'pty-2',
      data: 'C:/a.txt "C:/My Dir/b.txt"'
    });
  });

  it('should set and clear drop highlight class', () => {
    const container = document.createElement('div');
    container.id = 'terminalContainer';
    document.body.appendChild(container);

    const controller = createFileDragDropController({
      invoke: vi.fn(async () => null),
      debug: vi.fn(),
      showToast: vi.fn(),
      getActiveSession: () => ({ ptySessionId: 'pty-3' }),
      getContainer: () => container
    });

    controller.highlightDropZone({
      dataTransfer: {
        types: ['Files'],
        dropEffect: 'none'
      }
    });
    expect(container.classList.contains('terminal-container--drop-active')).toBe(true);

    controller.unhighlightDropZone();
    expect(container.classList.contains('terminal-container--drop-active')).toBe(false);
  });
});
