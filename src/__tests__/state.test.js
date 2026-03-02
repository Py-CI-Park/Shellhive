import { describe, it, expect, beforeEach } from 'vitest';
import {
  state,
  elements,
  eventBus,
  resetState,
  createDefaultState,
  TabGroup,
  SESSION_STATUS,
  TERMINAL_THEMES
} from '../state.js';

describe('state module', () => {
  beforeEach(() => {
    resetState();
    eventBus.clear();
    Object.keys(elements).forEach((key) => delete elements[key]);
  });

  it('should expose session status constants', () => {
    expect(SESSION_STATUS.CONNECTING).toBe('connecting');
    expect(SESSION_STATUS.RUNNING).toBe('running');
    expect(SESSION_STATUS.EXITED).toBe('exited');
  });

  it('should include default themes', () => {
    expect(TERMINAL_THEMES.dark).toBeDefined();
    expect(TERMINAL_THEMES.light).toBeDefined();
    expect(TERMINAL_THEMES.monokai).toBeDefined();
  });

  it('should initialize default state', () => {
    const defaults = createDefaultState();

    expect(defaults.sessions).toBeInstanceOf(Map);
    expect(defaults.activeSessionId).toBeNull();
    expect(defaults.settings.theme).toBe('dark');
    expect(defaults.allowedTabColorValues).toBeInstanceOf(Set);
  });

  it('should reset mutable state values', () => {
    state.activeSessionId = 'session-1';
    state.settings.theme = 'light';
    state.sessions.set('session-1', { id: 'session-1' });

    resetState();

    expect(state.activeSessionId).toBeNull();
    expect(state.settings.theme).toBe('dark');
    expect(state.sessions.size).toBe(0);
  });

  it('should manage tab group entries', () => {
    const group = new TabGroup('group-1', '테스트 그룹');
    expect(group.isEmpty()).toBe(true);

    group.addTab('session-1');
    group.addTab('session-2');
    expect(group.size).toBe(2);

    group.removeTab('session-1');
    expect(group.size).toBe(1);
  });

  it('should emit event bus payloads to listeners', () => {
    const payloads = [];
    const unsubscribe = eventBus.on('session:created', (payload) => {
      payloads.push(payload);
    });

    eventBus.emit('session:created', { sessionId: 's-1' });
    unsubscribe();
    eventBus.emit('session:created', { sessionId: 's-2' });

    expect(payloads).toEqual([{ sessionId: 's-1' }]);
  });

  it('should clear listeners by event and globally', () => {
    const calls = [];

    eventBus.on('settings:updated', () => calls.push('updated'));
    eventBus.on('settings:loaded', () => calls.push('loaded'));

    eventBus.clear('settings:updated');
    eventBus.emit('settings:updated');
    eventBus.emit('settings:loaded');

    eventBus.clear();
    eventBus.emit('settings:loaded');

    expect(calls).toEqual(['loaded']);
  });
});
