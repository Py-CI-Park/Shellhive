const ERROR_EXPLANATIONS = {
  'command not found': {
    cause: '명령어가 설치되지 않았거나 시스템 PATH에 없습니다.',
    solutions: [
      '명령어를 설치하세요 (예: npm install -g <package>)',
      'PATH 환경 변수를 확인하세요',
      '명령어 철자가 올바른지 확인하세요'
    ],
    command: null
  },
  'Permission denied': {
    cause: '파일이나 폴더에 대한 접근 권한이 없습니다.',
    solutions: [
      '관리자 권한으로 터미널을 실행하세요',
      'chmod 명령어로 파일 권한을 변경하세요',
      '파일 소유자를 확인하고 필요시 chown으로 변경하세요'
    ],
    command: null
  },
  'No such file or directory': {
    cause: '지정한 파일이나 디렉토리가 존재하지 않습니다.',
    solutions: [
      '파일 경로가 올바른지 확인하세요',
      'ls 명령어로 현재 디렉토리의 내용을 확인하세요',
      '상대 경로 대신 절대 경로를 사용해보세요'
    ],
    command: 'ls'
  },
  'error[E': {
    cause: 'Rust 컴파일 오류가 발생했습니다.',
    solutions: [
      '오류 메시지를 자세히 읽고 문제가 있는 코드를 확인하세요',
      'cargo check 명령어로 자세한 오류 정보를 확인하세요',
      'Rust 문서나 컴파일러 제안을 참고하세요'
    ],
    command: 'cargo check'
  },
  'npm ERR!': {
    cause: 'npm 명령 실행 중 오류가 발생했습니다.',
    solutions: [
      'node_modules 폴더와 package-lock.json을 삭제 후 다시 설치하세요',
      'npm cache clean --force로 캐시를 정리하세요',
      'npm 버전을 업데이트하세요'
    ],
    command: 'npm cache clean --force'
  },
  SyntaxError: {
    cause: 'JavaScript 문법 오류가 있습니다.',
    solutions: [
      '오류 메시지의 줄 번호와 파일을 확인하세요',
      '괄호, 중괄호, 따옴표가 올바르게 닫혔는지 확인하세요',
      '최신 JavaScript 문법을 사용 중이라면 Babel 설정을 확인하세요'
    ],
    command: null
  },
  TypeError: {
    cause: 'JavaScript 타입 관련 오류가 발생했습니다.',
    solutions: [
      '변수가 undefined나 null이 아닌지 확인하세요',
      '함수 호출 시 올바른 인자를 전달했는지 확인하세요',
      'TypeScript를 사용 중이라면 타입 정의를 확인하세요'
    ],
    command: null
  },
  ENOENT: {
    cause: '파일 시스템에서 요청한 항목을 찾을 수 없습니다.',
    solutions: [
      '파일이나 디렉토리 경로가 올바른지 확인하세요',
      '필요한 파일이 생성되었는지 확인하세요',
      '프로젝트 루트 디렉토리에서 실행 중인지 확인하세요'
    ],
    command: null
  },
  EACCES: {
    cause: '파일 접근 권한이 거부되었습니다.',
    solutions: [
      '관리자 권한으로 실행하세요',
      '파일/폴더 권한을 확인하고 필요시 변경하세요',
      'sudo를 사용하여 실행하세요 (Linux/Mac)'
    ],
    command: null
  }
};

const ERROR_EXPLANATION_COOLDOWN_MS = 5000;

export function createErrorExplanationController({
  state,
  invoke,
  debug,
  showToast,
  escapeHtml,
  escapeHtmlAttr
}) {
  const cooldownMap = new Map();

  function showErrorExplanation(sessionId, errorPattern, errorText) {
    const session = state.sessions.get(sessionId);
    if (!session) return;

    const now = Date.now();
    const cooldownKey = `${sessionId}:${errorPattern}`;
    const lastExplanation = cooldownMap.get(cooldownKey);

    if (lastExplanation && now - lastExplanation < ERROR_EXPLANATION_COOLDOWN_MS) {
      debug('Error explanation cooldown active, skipping:', errorPattern);
      return;
    }

    const explanation = ERROR_EXPLANATIONS[errorPattern];
    if (!explanation) return;

    const existingPanel = session.container.querySelector('.error-explanation');
    if (existingPanel) {
      existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.className = 'error-explanation';

    const solutionsHtml = explanation.solutions
      .map((solution) => `<li>${escapeHtml(solution)}</li>`)
      .join('');

    panel.innerHTML = `
      <div class="error-explanation__header">
        <span class="error-explanation__icon">💡</span>
        <span class="error-explanation__title">에러 설명</span>
        <button class="error-explanation__close" aria-label="닫기">&times;</button>
      </div>
      <div class="error-explanation__content">
        <div class="error-explanation__error">
          <strong>에러:</strong> ${escapeHtml(errorText.trim().substring(0, 100))}${errorText.length > 100 ? '...' : ''}
        </div>
        <div class="error-explanation__cause">
          <strong>원인:</strong> ${escapeHtml(explanation.cause)}
        </div>
        <div class="error-explanation__solutions">
          <strong>해결 방법:</strong>
          <ul>${solutionsHtml}</ul>
        </div>
        ${explanation.command ? `
          <button class="error-explanation__apply" data-command="${escapeHtmlAttr(explanation.command)}">
            해결 명령어 실행: ${escapeHtml(explanation.command)}
          </button>
        ` : ''}
      </div>
    `;

    panel.querySelector('.error-explanation__close').addEventListener('click', () => {
      panel.classList.add('error-explanation--hiding');
      setTimeout(() => panel.remove(), 300);
    });

    const applyButton = panel.querySelector('.error-explanation__apply');
    if (applyButton) {
      applyButton.addEventListener('click', async () => {
        const command = applyButton.dataset.command;
        if (command && session.ptySessionId) {
          try {
            await invoke('write_pty', {
              sessionId: session.ptySessionId,
              data: command + '\r'
            });
            panel.classList.add('error-explanation--hiding');
            setTimeout(() => panel.remove(), 300);
            showToast('명령어가 실행되었습니다', 'success', 2000);
          } catch (error) {
            debug('Failed to execute command:', error);
            showToast('명령어 실행 실패', 'error');
          }
        }
      });
    }

    session.container.appendChild(panel);
    cooldownMap.set(cooldownKey, now);
    debug('Error explanation shown:', errorPattern);
  }

  function detectErrorPattern(text) {
    // eslint-disable-next-line no-control-regex
    const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');

    for (const pattern in ERROR_EXPLANATIONS) {
      if (cleanText.includes(pattern)) {
        return { pattern, text: cleanText };
      }
    }

    return null;
  }

  return {
    showErrorExplanation,
    detectErrorPattern
  };
}
