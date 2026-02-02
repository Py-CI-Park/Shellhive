// i18n - Internationalization support

const translations = {
  en: {
    // General
    'app.title': 'Shellhive',
    'app.welcome': 'Welcome to Shellhive!',

    // Sidebar
    'sidebar.projects': 'PROJECTS',
    'sidebar.snippets': 'SNIPPETS',
    'sidebar.settings': 'Settings',
    'sidebar.addProject': 'Add Project',
    'sidebar.addSnippet': 'Add Snippet',

    // Tabs
    'tab.newTab': 'New Tab',
    'tab.close': 'Close',
    'tab.duplicate': 'Duplicate',
    'tab.rename': 'Rename Tab',
    'tab.pin': 'Pin Tab',
    'tab.unpin': 'Unpin Tab',
    'tab.setColor': 'Set Color',
    'tab.closeOthers': 'Close Other Tabs',
    'tab.restoreClosed': 'Restore Last Closed Tab',
    'tab.createGroup': 'Create Group from Tab',
    'tab.removeFromGroup': 'Remove from Group',
    'tab.splitHorizontal': 'Split Horizontal',
    'tab.splitVertical': 'Split Vertical',

    // Terminal
    'terminal.connecting': 'Connecting to PTY...',
    'terminal.connected': 'PTY connected!',
    'terminal.failed': 'Failed to connect to PTY',
    'terminal.exited': 'Process exited.',
    'terminal.search': 'Search...',

    // Settings
    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.fontSize': 'Font Size',
    'settings.fontFamily': 'Font Family',
    'settings.language': 'Language',
    'settings.logging': 'Logging',
    'settings.enableLogging': 'Enable session logging',
    'settings.clearLogs': 'Clear All Logs',
    'settings.save': 'Save',
    'settings.cancel': 'Cancel',

    // Modals
    'modal.addProject.title': 'Add Project',
    'modal.addProject.name': 'Project Name',
    'modal.addProject.path': 'Project Path',
    'modal.addProject.browse': 'Browse',
    'modal.addProject.confirm': 'Add',

    'modal.addSnippet.title': 'Add Snippet',
    'modal.addSnippet.name': 'Snippet Name',
    'modal.addSnippet.command': 'Command',
    'modal.addSnippet.confirm': 'Add',

    // Messages
    'msg.sessionRestored': 'Previous session restored',
    'msg.maxSessions': 'Maximum sessions reached ({count}). Please close existing sessions.',
    'msg.tabRenamed': 'Tab renamed: {name}',
    'msg.filesInserted': '{count} file path(s) inserted',
    'msg.categoryAdded': "Category '{name}' added",
    'msg.splitPane': '{direction} split',
    'msg.horizontal': 'Horizontal',
    'msg.vertical': 'Vertical',

    // Errors
    'error.addProject': 'Failed to add project: {error}',
    'error.addSnippet': 'Failed to add snippet: {error}',
    'error.saveSettings': 'Failed to save settings: {error}',
    'error.noActiveSession': 'No active terminal session',
    'error.sessionNotConnected': 'Terminal session is not connected',
    'error.folderSelect': 'Failed to select folder: {error}',
    'error.fullscreen': 'Failed to enter fullscreen',

    // Colors
    'color.red': 'Red',
    'color.orange': 'Orange',
    'color.yellow': 'Yellow',
    'color.green': 'Green',
    'color.blue': 'Blue',
    'color.purple': 'Purple',
    'color.none': 'None',

    // Themes
    'theme.dark': 'Dark',
    'theme.light': 'Light',
    'theme.monokai': 'Monokai',
    'theme.highContrast': 'High Contrast',
  },

  ko: {
    // General
    'app.title': 'Shellhive',
    'app.welcome': 'Shellhive에 오신 것을 환영합니다!',

    // Sidebar
    'sidebar.projects': '프로젝트',
    'sidebar.snippets': '스니펫',
    'sidebar.settings': '설정',
    'sidebar.addProject': '프로젝트 추가',
    'sidebar.addSnippet': '스니펫 추가',

    // Tabs
    'tab.newTab': '새 탭',
    'tab.close': '닫기',
    'tab.duplicate': '복제',
    'tab.rename': '탭 이름 변경',
    'tab.pin': '탭 고정',
    'tab.unpin': '탭 고정 해제',
    'tab.setColor': '색상 설정',
    'tab.closeOthers': '다른 탭 닫기',
    'tab.restoreClosed': '마지막 닫은 탭 복원',
    'tab.createGroup': '탭에서 그룹 만들기',
    'tab.removeFromGroup': '그룹에서 제거',
    'tab.splitHorizontal': '가로 분할',
    'tab.splitVertical': '세로 분할',

    // Terminal
    'terminal.connecting': 'PTY 연결 중...',
    'terminal.connected': 'PTY 연결됨!',
    'terminal.failed': 'PTY 연결 실패',
    'terminal.exited': '프로세스가 종료되었습니다.',
    'terminal.search': '검색...',

    // Settings
    'settings.title': '설정',
    'settings.appearance': '외관',
    'settings.theme': '테마',
    'settings.fontSize': '글꼴 크기',
    'settings.fontFamily': '글꼴',
    'settings.language': '언어',
    'settings.logging': '로깅',
    'settings.enableLogging': '세션 로깅 활성화',
    'settings.clearLogs': '모든 로그 삭제',
    'settings.save': '저장',
    'settings.cancel': '취소',

    // Modals
    'modal.addProject.title': '프로젝트 추가',
    'modal.addProject.name': '프로젝트 이름',
    'modal.addProject.path': '프로젝트 경로',
    'modal.addProject.browse': '찾아보기',
    'modal.addProject.confirm': '추가',

    'modal.addSnippet.title': '스니펫 추가',
    'modal.addSnippet.name': '스니펫 이름',
    'modal.addSnippet.command': '명령어',
    'modal.addSnippet.confirm': '추가',

    // Messages
    'msg.sessionRestored': '이전 세션이 복원되었습니다',
    'msg.maxSessions': '최대 세션 수({count}개)에 도달했습니다. 기존 세션을 닫아주세요.',
    'msg.tabRenamed': '탭 이름 변경: {name}',
    'msg.filesInserted': '{count}개 파일 경로 입력됨',
    'msg.categoryAdded': "카테고리 '{name}' 추가됨",
    'msg.splitPane': '화면 {direction} 분할',
    'msg.horizontal': '가로',
    'msg.vertical': '세로',

    // Errors
    'error.addProject': '프로젝트 추가 실패: {error}',
    'error.addSnippet': '스니펫 추가 실패: {error}',
    'error.saveSettings': '설정 저장 실패: {error}',
    'error.noActiveSession': '활성 터미널 세션이 없습니다',
    'error.sessionNotConnected': '터미널 세션이 연결되지 않았습니다',
    'error.folderSelect': '폴더 선택 실패: {error}',
    'error.fullscreen': '전체화면 전환 실패',

    // Colors
    'color.red': '빨강',
    'color.orange': '주황',
    'color.yellow': '노랑',
    'color.green': '초록',
    'color.blue': '파랑',
    'color.purple': '보라',
    'color.none': '없음',

    // Themes
    'theme.dark': '다크',
    'theme.light': '라이트',
    'theme.monokai': '모노카이',
    'theme.highContrast': '고대비',
  }
};

let currentLocale = 'ko'; // Default to Korean

export function setLocale(locale) {
  if (translations[locale]) {
    currentLocale = locale;
    document.documentElement.lang = locale;
    return true;
  }
  return false;
}

export function getLocale() {
  return currentLocale;
}

export function t(key, params = {}) {
  const translation = translations[currentLocale]?.[key] || translations['en']?.[key] || key;

  // Replace placeholders like {name} with actual values
  return translation.replace(/\{(\w+)\}/g, (match, paramName) => {
    return params[paramName] !== undefined ? params[paramName] : match;
  });
}

export function getAvailableLocales() {
  return [
    { code: 'en', name: 'English' },
    { code: 'ko', name: '한국어' }
  ];
}

export default { setLocale, getLocale, t, getAvailableLocales };
