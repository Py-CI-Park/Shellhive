export function createSessionManagerController({
  invoke,
  debug,
  maxLogBufferSize = 10000,
  flushIntervalMs = 500
}) {
  let logBuffer = {};
  let logTimeouts = {};

  async function flushLogBuffer(sessionId) {
    const buffer = logBuffer[sessionId];
    logBuffer[sessionId] = '';

    try {
      await invoke('log_session_output', { sessionId, data: buffer });
    } catch (error) {
      debug('Failed to log session output:', error);
    }
  }

  function logSessionOutput(sessionId, data) {
    if (!logBuffer[sessionId]) {
      logBuffer[sessionId] = '';
    }

    logBuffer[sessionId] += data;

    if (logBuffer[sessionId].length > maxLogBufferSize) {
      logBuffer[sessionId] = logBuffer[sessionId].slice(-maxLogBufferSize);
    }

    if (logTimeouts[sessionId]) {
      clearTimeout(logTimeouts[sessionId]);
    }

    logTimeouts[sessionId] = setTimeout(() => {
      flushLogBuffer(sessionId);
    }, flushIntervalMs);
  }

  function disposeSessionLogBuffer(sessionId) {
    if (logTimeouts[sessionId]) {
      clearTimeout(logTimeouts[sessionId]);
      delete logTimeouts[sessionId];
    }

    delete logBuffer[sessionId];
  }

  return {
    logSessionOutput,
    disposeSessionLogBuffer
  };
}
