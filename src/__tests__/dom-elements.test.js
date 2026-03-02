import { describe, expect, it, vi } from 'vitest';
import { initializeDomElementsRegistry } from '../dom-elements.js';

describe('dom-elements module', () => {
  it('should register DOM references into elements map', () => {
    document.body.innerHTML = `
      <div id="tabsList"></div>
      <div id="terminalContainer"></div>
      <button id="newTabBtn"></button>
      <div id="projectList"></div>
      <button id="addProjectBtn"></button>
      <div id="addProjectModal"></div>
      <button id="closeAddProjectModal"></button>
      <button id="cancelAddProject"></button>
      <button id="confirmAddProject"></button>
      <input id="projectName" />
      <input id="projectPath" />
      <button id="browsePathBtn"></button>
      <div id="snippetList"></div>
      <button id="addSnippetBtn"></button>
      <div id="addSnippetModal"></div>
      <button id="closeAddSnippetModal"></button>
      <button id="cancelAddSnippet"></button>
      <button id="confirmAddSnippet"></button>
      <input id="snippetName" />
      <input id="snippetCommand" />
      <button id="settingsBtn"></button>
      <div id="settingsModal"></div>
      <button id="closeSettingsModal"></button>
      <button id="cancelSettings"></button>
      <button id="saveSettings"></button>
      <select id="settingsTheme"></select>
      <input id="settingsFontSize" />
      <span id="fontSizeValue"></span>
      <select id="settingsFontFamily"></select>
      <input id="settingsEnableLogging" />
      <input id="settingsEnableNotifications" />
      <input id="settingsBlockMode" />
      <button id="clearLogsBtn"></button>
    `;

    const elements = {};
    const debug = vi.fn();
    const refs = initializeDomElementsRegistry({ elements, debug });

    expect(refs.tabsList).toBe(document.getElementById('tabsList'));
    expect(refs.settingsModal).toBe(document.getElementById('settingsModal'));
    expect(elements.tabsList).toBe(refs.tabsList);
    expect(elements.clearLogsBtn).toBe(refs.clearLogsBtn);
    expect(debug).toHaveBeenCalledWith('DOM elements initialized');
  });

  it('should keep missing DOM references as null', () => {
    document.body.innerHTML = '<div id="tabsList"></div>';

    const refs = initializeDomElementsRegistry({
      elements: {},
      debug: vi.fn()
    });

    expect(refs.tabsList).toBeTruthy();
    expect(refs.settingsModal).toBeNull();
    expect(refs.clearLogsBtn).toBeNull();
  });
});
