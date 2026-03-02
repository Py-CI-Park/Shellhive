import { invoke } from '@tauri-apps/api/core';

const GIT_STATUS_CLASS_MAP = Object.freeze({
  M: 'modified',
  A: 'added',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  '?': 'untracked',
  '!': 'ignored',
  U: 'conflicted'
});

export function createGitPanelController({
  state,
  eventBus,
  showToast,
  debug,
  showConfirmDialog,
  escapeHtml,
  escapeHtmlAttr
}) {
  function getGitStatusClass(status) {
    if (typeof status !== 'string') {
      return 'unknown';
    }
    return GIT_STATUS_CLASS_MAP[status] || 'unknown';
  }

  function formatCommitDate(date) {
    if (!date) return '';
    return escapeHtml(String(date));
  }

  function renderGitBranchOptions(branches, currentBranch) {
    if (!Array.isArray(branches) || branches.length === 0) {
      return `<option value="${escapeHtmlAttr(currentBranch || '')}" selected>${escapeHtml(currentBranch || 'HEAD')}</option>`;
    }

    const uniqueBranches = [];
    const seen = new Set();
    for (const branch of branches) {
      if (!branch || typeof branch.name !== 'string') continue;
      if (seen.has(branch.name)) continue;
      seen.add(branch.name);
      uniqueBranches.push(branch);
    }

    return uniqueBranches.map((branch) => {
      const branchName = branch.name;
      const isCurrent = branch.is_current || branchName === currentBranch;
      const remotePrefix = branch.is_remote ? '[remote] ' : '';
      return `<option value="${escapeHtmlAttr(branchName)}" ${isCurrent ? 'selected' : ''}>${escapeHtml(remotePrefix + branchName)}</option>`;
    }).join('');
  }

  function renderGitHistory(commits) {
    if (!Array.isArray(commits) || commits.length === 0) {
      return `
        <div class="git-panel__empty git-panel__empty--compact">
          <p>표시할 커밋이 없습니다</p>
        </div>
      `;
    }

    return `
      <ul class="git-panel__history-list">
        ${commits.map((commit) => `
          <li class="git-panel__history-item">
            <div class="git-panel__history-line">
              <code class="git-panel__history-hash">${escapeHtml(commit.hash || '-')}</code>
              <span class="git-panel__history-message" title="${escapeHtmlAttr(commit.message || '')}">${escapeHtml(commit.message || '(no message)')}</span>
            </div>
            <div class="git-panel__history-meta">
              <span>${escapeHtml(commit.author || 'unknown')}</span>
              <span>${formatCommitDate(commit.date)}</span>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  function renderGitPanel(panel, status, gitPath) {
    const files = status.files || [];
    const hasChanges = files.length > 0;
    const currentBranch = status.branch || 'HEAD';
    const branches = status.branches || [];
    const commits = status.commits || [];

    panel.innerHTML = `
      <div class="git-panel__branch">
        <span class="git-panel__branch-icon">⎇</span>
        <span class="git-panel__branch-name">${escapeHtml(currentBranch)}</span>
        <span class="git-panel__branch-sync">↑${Number(status.ahead || 0)} ↓${Number(status.behind || 0)}</span>
      </div>

      <div class="git-panel__section">
        <div class="git-panel__section-title">브랜치 전환</div>
        <div class="git-panel__branch-controls">
          <label class="git-panel__sr-only" for="gitBranchSelect">브랜치 선택</label>
          <select class="git-panel__branch-select" id="gitBranchSelect">
            ${renderGitBranchOptions(branches, currentBranch)}
          </select>
          <button class="git-panel__btn" id="gitCheckoutBtn">Checkout</button>
        </div>
      </div>

      <div class="git-panel__section">
        <div class="git-panel__section-title">최근 커밋 (최대 10개)</div>
        ${renderGitHistory(commits)}
      </div>

      ${hasChanges ? `
        <div class="git-panel__section">
          <div class="git-panel__section-title">변경 파일</div>
        </div>

        <div class="git-panel__files">
          ${files.map((file, index) => `
            <div class="git-panel__file" data-index="${index}">
              <input type="checkbox" class="git-panel__file-checkbox"
                     data-file="${escapeHtmlAttr(file.path)}"
                     ${file.staged ? 'checked' : ''} />
              <span class="git-panel__file-status git-panel__file-status--${getGitStatusClass(file.status)}">${escapeHtml(file.status || '?')}</span>
              <span class="git-panel__file-name" title="${escapeHtmlAttr(file.path)}">${escapeHtml(file.path)}</span>
              ${file.staged ? '' : `
                <button class="git-panel__file-discard"
                        data-file="${escapeHtmlAttr(file.path)}"
                        aria-label="${escapeHtmlAttr(`${file.path} 변경 폐기`)}">
                  Discard
                </button>
              `}
            </div>
          `).join('')}
        </div>

        <textarea class="git-panel__commit-input"
                  id="gitCommitMessage"
                  placeholder="커밋 메시지..."
                  rows="2"></textarea>

        <div class="git-panel__actions">
          <button class="git-panel__btn" id="gitStageAllBtn">Stage All</button>
          <button class="git-panel__btn git-panel__btn--primary" id="gitCommitBtn">Commit</button>
          <button class="git-panel__btn" id="gitPullBtn">Pull</button>
          <button class="git-panel__btn" id="gitPushBtn">Push</button>
        </div>
      ` : `
        <div class="git-panel__empty">
          <p>변경된 파일이 없습니다</p>
        </div>
        <div class="git-panel__actions">
          <button class="git-panel__btn" id="gitPullBtn">Pull</button>
          <button class="git-panel__btn" id="gitPushBtn">Push</button>
        </div>
      `}

      <div class="git-panel__actions" style="margin-top: 8px;">
        <button class="git-panel__btn" id="gitRefreshBtn">새로고침</button>
      </div>
    `;

    panel.dataset.currentBranch = currentBranch;
    setupGitPanelListeners(panel, gitPath);
  }

  function setupGitPanelListeners(panel, gitPath) {
    const refreshBtn = panel.querySelector('#gitRefreshBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => refreshGitStatus());
    }

    const branchSelect = panel.querySelector('#gitBranchSelect');
    const checkoutBtn = panel.querySelector('#gitCheckoutBtn');
    const runCheckout = async () => {
      if (!branchSelect) return;
      const selectedBranch = branchSelect.value;
      const currentBranch = panel.dataset.currentBranch || '';
      if (!selectedBranch) {
        showToast('브랜치를 선택하세요', 'warning');
        return;
      }
      if (selectedBranch === currentBranch) {
        showToast('이미 해당 브랜치를 사용 중입니다', 'info');
        return;
      }

      try {
        await invoke('git_checkout', { path: gitPath, branch: selectedBranch });
        showToast(`브랜치를 ${selectedBranch}(으)로 전환했습니다`, 'success');
        eventBus.emit('git:branch-checked-out', { path: gitPath, branch: selectedBranch });
        refreshGitStatus();
      } catch (error) {
        showToast('브랜치 전환 실패: ' + error, 'error');
      }
    };

    if (checkoutBtn) {
      checkoutBtn.addEventListener('click', runCheckout);
    }
    if (branchSelect) {
      branchSelect.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          runCheckout();
        }
      });
    }

    const stageAllBtn = panel.querySelector('#gitStageAllBtn');
    if (stageAllBtn) {
      stageAllBtn.addEventListener('click', async () => {
        try {
          const files = Array.from(panel.querySelectorAll('.git-panel__file-checkbox'))
            .map((checkbox) => checkbox.dataset.file)
            .filter(Boolean);
          if (files.length === 0) {
            showToast('스테이징할 파일이 없습니다', 'info');
            return;
          }
          await invoke('git_stage', { path: gitPath, files });
          showToast('모든 파일이 스테이징되었습니다', 'success');
          refreshGitStatus();
        } catch (error) {
          showToast('스테이징 실패: ' + error, 'error');
        }
      });
    }

    const commitBtn = panel.querySelector('#gitCommitBtn');
    if (commitBtn) {
      commitBtn.addEventListener('click', async () => {
        const messageInput = panel.querySelector('#gitCommitMessage');
        const message = messageInput ? messageInput.value.trim() : '';

        if (!message) {
          showToast('커밋 메시지를 입력하세요', 'warning');
          return;
        }

        try {
          await invoke('git_commit', { path: gitPath, message });
          showToast('커밋이 완료되었습니다', 'success');
          if (messageInput) messageInput.value = '';
          refreshGitStatus();
        } catch (error) {
          showToast('커밋 실패: ' + error, 'error');
        }
      });
    }

    const pullBtn = panel.querySelector('#gitPullBtn');
    if (pullBtn) {
      pullBtn.addEventListener('click', async () => {
        try {
          showToast('Pull 중...', 'info');
          await invoke('git_pull', { path: gitPath });
          showToast('Pull 완료', 'success');
          refreshGitStatus();
        } catch (error) {
          showToast('Pull 실패: ' + error, 'error');
        }
      });
    }

    const pushBtn = panel.querySelector('#gitPushBtn');
    if (pushBtn) {
      pushBtn.addEventListener('click', async () => {
        try {
          showToast('Push 중...', 'info');
          await invoke('git_push', { path: gitPath });
          showToast('Push 완료', 'success');
        } catch (error) {
          showToast('Push 실패: ' + error, 'error');
        }
      });
    }

    const discardButtons = panel.querySelectorAll('.git-panel__file-discard');
    discardButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        const filePath = button.dataset.file;
        if (!filePath) return;

        const confirmed = await showConfirmDialog(
          '변경 내용 폐기',
          `${filePath}의 변경 내용을 되돌릴까요? 이 작업은 되돌릴 수 없습니다.`
        );

        if (!confirmed) return;

        try {
          await invoke('git_discard', { path: gitPath, files: [filePath] });
          showToast(`변경을 폐기했습니다: ${filePath}`, 'success');
          eventBus.emit('git:file-discarded', { path: gitPath, file: filePath });
          refreshGitStatus();
        } catch (error) {
          showToast('변경 폐기 실패: ' + error, 'error');
        }
      });
    });

    const checkboxes = panel.querySelectorAll('.git-panel__file-checkbox');
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener('change', async (e) => {
        const filePath = e.target.dataset.file;
        const shouldStage = e.target.checked;

        try {
          if (shouldStage) {
            await invoke('git_stage', { path: gitPath, files: [filePath] });
          } else {
            await invoke('git_unstage', { path: gitPath, files: [filePath] });
          }
        } catch (error) {
          showToast(`파일 ${shouldStage ? '스테이징' : '언스테이징'} 실패: ` + error, 'error');
          e.target.checked = !shouldStage;
        }
      });
    });
  }

  async function refreshGitStatus() {
    const gitPanel = document.getElementById('gitPanel');
    if (!gitPanel) return;

    let gitPath = state.currentGitPath;

    if (!gitPath && state.activeSessionId) {
      const session = state.sessions.get(state.activeSessionId);
      if (session && session.projectPath) {
        gitPath = session.projectPath;
      }
    }

    if (!gitPath) {
      gitPanel.innerHTML = `
        <div class="git-panel__empty">
          <p>프로젝트 폴더를 선택하세요</p>
        </div>
      `;
      eventBus.emit('git:status-missing-path');
      return;
    }

    state.currentGitPath = gitPath;

    gitPanel.innerHTML = `
      <div class="git-panel__loading">
        Git 상태 확인 중...
      </div>
    `;

    try {
      const gitStatus = await invoke('git_status', { path: gitPath });

      if (!gitStatus.is_repo) {
        gitPanel.innerHTML = `
          <div class="git-panel__empty">
            <p>Git 저장소가 아닙니다</p>
          </div>
        `;
        eventBus.emit('git:status-updated', { path: gitPath, isRepo: false });
        return;
      }

      const [branches, commits] = await Promise.all([
        invoke('git_branches', { path: gitPath }).catch((error) => {
          debug('Failed to load branches:', error);
          return [];
        }),
        invoke('git_log', { path: gitPath, limit: 10 }).catch((error) => {
          debug('Failed to load git log:', error);
          return [];
        })
      ]);

      const gitViewModel = {
        ...gitStatus,
        branches: Array.isArray(branches) ? branches : [],
        commits: Array.isArray(commits) ? commits : []
      };

      eventBus.emit('git:status-updated', { path: gitPath, isRepo: true, status: gitViewModel });
      renderGitPanel(gitPanel, gitViewModel, gitPath);
    } catch (error) {
      debug('Git 상태 확인 실패:', error);
      eventBus.emit('git:status-error', { path: gitPath, error: error?.toString?.() ?? String(error) });
      gitPanel.innerHTML = `
        <div class="git-panel__error">
          Git 상태를 확인할 수 없습니다: ${escapeHtml(error.toString())}
        </div>
      `;
    }
  }

  function toggleGitPanel() {
    state.gitPanelVisible = !state.gitPanelVisible;
    const gitPanel = document.getElementById('gitPanel');
    eventBus.emit('git:panel-visibility-changed', { visible: state.gitPanelVisible });

    if (gitPanel) {
      gitPanel.style.display = state.gitPanelVisible ? 'block' : 'none';
      if (state.gitPanelVisible) {
        refreshGitStatus();
      }
    }
  }

  return {
    toggleGitPanel,
    refreshGitStatus
  };
}
