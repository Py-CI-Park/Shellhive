import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSessionManagerController } from '../session-manager.js';

describe('session-manager module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should flush buffered output after interval', async () => {
    const invoke = vi.fn(async () => null);
    const { logSessionOutput } = createSessionManagerController({
      invoke,
      debug: vi.fn(),
      flushIntervalMs: 100
    });

    logSessionOutput('s-1', 'hello');
    await vi.advanceTimersByTimeAsync(100);

    expect(invoke).toHaveBeenCalledWith('log_session_output', {
      sessionId: 's-1',
      data: 'hello'
    });
  });

  it('should batch multiple writes into one flush', async () => {
    const invoke = vi.fn(async () => null);
    const { logSessionOutput } = createSessionManagerController({
      invoke,
      debug: vi.fn(),
      flushIntervalMs: 100
    });

    logSessionOutput('s-1', 'foo');
    logSessionOutput('s-1', 'bar');
    await vi.advanceTimersByTimeAsync(100);

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('log_session_output', {
      sessionId: 's-1',
      data: 'foobar'
    });
  });

  it('should truncate oversized log buffer', async () => {
    const invoke = vi.fn(async () => null);
    const { logSessionOutput } = createSessionManagerController({
      invoke,
      debug: vi.fn(),
      maxLogBufferSize: 5,
      flushIntervalMs: 100
    });

    logSessionOutput('s-1', '123456789');
    await vi.advanceTimersByTimeAsync(100);

    expect(invoke).toHaveBeenCalledWith('log_session_output', {
      sessionId: 's-1',
      data: '56789'
    });
  });

  it('should cancel pending flush when disposed', async () => {
    const invoke = vi.fn(async () => null);
    const { logSessionOutput, disposeSessionLogBuffer } = createSessionManagerController({
      invoke,
      debug: vi.fn(),
      flushIntervalMs: 100
    });

    logSessionOutput('s-1', 'keep');
    disposeSessionLogBuffer('s-1');
    await vi.advanceTimersByTimeAsync(100);

    expect(invoke).not.toHaveBeenCalled();
  });
});
