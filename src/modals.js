export function createModalController({ escapeHtml }) {
  function showConfirmDialog(title, message) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'confirm-dialog-overlay';
      overlay.innerHTML = `
        <div class="confirm-dialog">
          <div class="confirm-dialog__header">
            <h3 class="confirm-dialog__title">${escapeHtml(title)}</h3>
          </div>
          <div class="confirm-dialog__body">
            <p class="confirm-dialog__message">${escapeHtml(message)}</p>
          </div>
          <div class="confirm-dialog__footer">
            <button class="btn btn--secondary confirm-dialog__cancel">취소</button>
            <button class="btn btn--danger confirm-dialog__confirm">삭제</button>
          </div>
        </div>
      `;

      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          closeDialog(false);
        }
      };

      const closeDialog = (result) => {
        document.removeEventListener('keydown', handleKeydown);
        overlay.classList.add('confirm-dialog-overlay--hiding');
        setTimeout(() => overlay.remove(), 200);
        resolve(result);
      };

      overlay.querySelector('.confirm-dialog__cancel').addEventListener('click', () => closeDialog(false));
      overlay.querySelector('.confirm-dialog__confirm').addEventListener('click', () => closeDialog(true));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closeDialog(false);
        }
      });

      document.addEventListener('keydown', handleKeydown);
      document.body.appendChild(overlay);
      overlay.querySelector('.confirm-dialog__cancel').focus();
    });
  }

  function setupModalOverlayClose(modalTargets) {
    modalTargets.forEach((modal) => {
      if (!modal) return;

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('modal--visible');
        }
      });
    });
  }

  function closeVisibleModals(modalTargets) {
    modalTargets.forEach((modal) => {
      if (modal) {
        modal.classList.remove('modal--visible');
      }
    });
  }

  return {
    showConfirmDialog,
    setupModalOverlayClose,
    closeVisibleModals
  };
}
