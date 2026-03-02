export function initializeDomElementsRegistry({
  elements,
  debug,
  documentRef = document
}) {
  const refs = {
    tabsList: documentRef.getElementById('tabsList'),
    terminalContainer: documentRef.getElementById('terminalContainer'),
    newTabBtn: documentRef.getElementById('newTabBtn'),
    projectList: documentRef.getElementById('projectList'),
    addProjectBtn: documentRef.getElementById('addProjectBtn'),
    addProjectModal: documentRef.getElementById('addProjectModal'),
    closeAddProjectModal: documentRef.getElementById('closeAddProjectModal'),
    cancelAddProject: documentRef.getElementById('cancelAddProject'),
    confirmAddProject: documentRef.getElementById('confirmAddProject'),
    projectNameInput: documentRef.getElementById('projectName'),
    projectPathInput: documentRef.getElementById('projectPath'),
    browsePathBtn: documentRef.getElementById('browsePathBtn'),
    snippetList: documentRef.getElementById('snippetList'),
    addSnippetBtn: documentRef.getElementById('addSnippetBtn'),
    addSnippetModal: documentRef.getElementById('addSnippetModal'),
    closeAddSnippetModal: documentRef.getElementById('closeAddSnippetModal'),
    cancelAddSnippet: documentRef.getElementById('cancelAddSnippet'),
    confirmAddSnippet: documentRef.getElementById('confirmAddSnippet'),
    snippetNameInput: documentRef.getElementById('snippetName'),
    snippetCommandInput: documentRef.getElementById('snippetCommand'),
    settingsBtn: documentRef.getElementById('settingsBtn'),
    settingsModal: documentRef.getElementById('settingsModal'),
    closeSettingsModal: documentRef.getElementById('closeSettingsModal'),
    cancelSettings: documentRef.getElementById('cancelSettings'),
    saveSettingsBtn: documentRef.getElementById('saveSettings'),
    settingsTheme: documentRef.getElementById('settingsTheme'),
    settingsFontSize: documentRef.getElementById('settingsFontSize'),
    fontSizeValue: documentRef.getElementById('fontSizeValue'),
    settingsFontFamily: documentRef.getElementById('settingsFontFamily'),
    settingsEnableLogging: documentRef.getElementById('settingsEnableLogging'),
    settingsEnableNotifications: documentRef.getElementById('settingsEnableNotifications'),
    settingsBlockMode: documentRef.getElementById('settingsBlockMode'),
    clearLogsBtn: documentRef.getElementById('clearLogsBtn')
  };

  Object.assign(elements, refs);
  debug('DOM elements initialized');
  return refs;
}
