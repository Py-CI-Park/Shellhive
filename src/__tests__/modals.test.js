import { beforeEach, describe, expect, it } from 'vitest';
import { createModalController } from '../modals.js';

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

describe('modals module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('should resolve true when confirm button is clicked', async () => {
    const { showConfirmDialog } = createModalController({ escapeHtml });
    const promise = showConfirmDialog('삭제 확인', '정말 삭제하시겠습니까?');

    const confirmButton = document.querySelector('.confirm-dialog__confirm');
    confirmButton.click();

    await expect(promise).resolves.toBe(true);
  });

  it('should resolve false when Escape key is pressed', async () => {
    const { showConfirmDialog } = createModalController({ escapeHtml });
    const promise = showConfirmDialog('삭제 확인', '취소 테스트');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    await expect(promise).resolves.toBe(false);
  });

  it('should close modal on overlay click and helper close call', () => {
    const modalOne = document.createElement('div');
    modalOne.className = 'modal modal--visible';
    const modalTwo = document.createElement('div');
    modalTwo.className = 'modal modal--visible';
    document.body.append(modalOne, modalTwo);

    const { setupModalOverlayClose, closeVisibleModals } = createModalController({ escapeHtml });
    setupModalOverlayClose([modalOne, modalTwo]);

    modalOne.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(modalOne.classList.contains('modal--visible')).toBe(false);

    closeVisibleModals([modalOne, modalTwo]);
    expect(modalTwo.classList.contains('modal--visible')).toBe(false);
  });
});
