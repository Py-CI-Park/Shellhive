export function createTerminalManagerController({
  state,
  debug,
  showToast,
  getAllLeafNodes,
  activateSession
}) {
  function clearTerminalScreen() {
    const session = state.sessions.get(state.activeSessionId);
    if (!session) return;

    session.terminal.write('\x1b[2J\x1b[H');
    debug('Terminal screen cleared');
  }

  function clearTerminalScrollback() {
    const session = state.sessions.get(state.activeSessionId);
    if (!session) return;

    session.terminal.clear();
    debug('Terminal scrollback cleared');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        debug('Fullscreen error:', err);
        showToast('전체화면 전환에 실패했습니다', 'error');
      });
    } else {
      document.exitFullscreen();
    }
  }

  function focusPaneByDirection(direction) {
    if (!state.splitMode || !state.splitRoot) return;

    const leaves = getAllLeafNodes(state.splitRoot);
    if (leaves.length <= 1) return;

    const currentIndex = leaves.findIndex(n => n.sessionId === state.activeSessionId);
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'right' || direction === 'down') {
      nextIndex = (currentIndex + 1) % leaves.length;
    } else {
      nextIndex = (currentIndex - 1 + leaves.length) % leaves.length;
    }

    activateSession(leaves[nextIndex].sessionId, { preserveSplitLayout: true });
  }

  return {
    clearTerminalScreen,
    clearTerminalScrollback,
    toggleFullscreen,
    focusPaneByDirection
  };
}
