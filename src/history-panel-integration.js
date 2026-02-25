/**
 * History Panel Integration Guide
 *
 * app.js에 다음 코드를 추가하세요:
 */

// ===== 1. Import 추가 (파일 상단, import 섹션에) =====
/*
import { createHistoryPanel, showHistoryPanel, hideHistoryPanel } from './history-panel.js';
*/

// ===== 2. 초기화 함수에 추가 (initialize 함수 또는 setupEventListeners 함수에) =====
/*
// History panel 생성
createHistoryPanel(commandHistory, state, showToast, escapeHtml);
*/

// ===== 3. handleKeyboardShortcuts 함수에 Ctrl+R 단축키 추가 =====
/*
function handleKeyboardShortcuts(e) {
  // 기존 Ctrl+F 코드 아래에 추가
  if (e.ctrlKey && e.key === 'f') {
    e.preventDefault();
    showTerminalSearch();
    return;
  }

  // ===== 여기에 추가 =====
  if (e.ctrlKey && e.key === 'r') {
    e.preventDefault();
    showHistoryPanel(commandHistory, state, escapeHtml);
    return;
  }
  // ===== 추가 끝 =====

  if (e.ctrlKey && e.key === 't') {
    e.preventDefault();
    createSession();
    return;
  }
  // ... 나머지 코드
}
*/

// ===== 4. Escape 키 핸들러에 hideHistoryPanel 추가 =====
/*
// 기존 keydown 이벤트 리스너에서:
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    [addProjectModal, addSnippetModal, settingsModal, envVarsModal].forEach(m => {
      if (m) m.classList.remove('modal--visible');
    });
    hideHistoryPanel(); // ===== 이 줄 추가 =====
    return;
  }
  // ... 나머지 코드
});
*/

// ===== 통합 예제 코드 =====

// app.js 파일 상단에 추가할 import
export const importStatement = `
import { createHistoryPanel, showHistoryPanel, hideHistoryPanel } from './history-panel.js';
`;

// initialize 함수 또는 setupEventListeners에 추가
export const initHistoryPanel = `
// History panel 생성
createHistoryPanel(commandHistory, state, showToast, escapeHtml);
commandHistory.load(); // localStorage에서 히스토리 로드
`;

// handleKeyboardShortcuts 함수에 추가
export const ctrlRHandler = `
if (e.ctrlKey && e.key === 'r') {
  e.preventDefault();
  showHistoryPanel(commandHistory, state, escapeHtml);
  return;
}
`;

// Escape 핸들러에 추가
export const escapeHandler = `
hideHistoryPanel();
`;
