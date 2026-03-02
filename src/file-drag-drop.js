export function createFileDragDropController({
  invoke,
  debug,
  showToast,
  getActiveSession,
  getContainer = () => document.getElementById('terminalContainer')
}) {
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlightDropZone(e) {
    if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      getContainer()?.classList.add('terminal-container--drop-active');
    }
  }

  function unhighlightDropZone() {
    getContainer()?.classList.remove('terminal-container--drop-active');
  }

  async function handleFileDrop(e) {
    const session = getActiveSession();
    if (!session || !session.ptySessionId) {
      showToast('활성 터미널 세션이 없습니다', 'warning');
      return;
    }

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    if (files.length === 1) {
      const file = files[0];
      try {
        const metadata = await invoke('get_file_metadata', { path: file.path });
        if (metadata.is_dir) {
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
      }
    }

    const paths = [];
    for (let i = 0; i < files.length; i++) {
      let path = files[i].path;
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

  function setupFileDragDrop() {
    const container = getContainer();
    if (!container) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      container.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      container.addEventListener(eventName, highlightDropZone, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      container.addEventListener(eventName, unhighlightDropZone, false);
    });

    container.addEventListener('drop', handleFileDrop, false);
  }

  return {
    setupFileDragDrop,
    preventDefaults,
    highlightDropZone,
    unhighlightDropZone,
    handleFileDrop
  };
}
