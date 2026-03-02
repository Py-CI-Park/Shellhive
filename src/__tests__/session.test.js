import { describe, it, expect } from 'vitest';
import { SESSION_STATUS, TabGroup } from '../state.js';

describe('Session Management', () => {
  describe('Session Status', () => {
    it('should have correct status constants', () => {
      expect(SESSION_STATUS.CONNECTING).toBe('connecting');
      expect(SESSION_STATUS.RUNNING).toBe('running');
      expect(SESSION_STATUS.EXITED).toBe('exited');
    });
  });

  describe('TabGroup', () => {
    it('should create a tab group with default options', () => {
      const group = new TabGroup('group-1', 'Test Group');

      expect(group.id).toBe('group-1');
      expect(group.name).toBe('Test Group');
      expect(group.color).toBe('#0e639c');
      expect(group.collapsed).toBe(false);
      expect(group.isEmpty()).toBe(true);
    });

    it('should add and remove tabs correctly', () => {
      const group = new TabGroup('group-1', 'Test Group');

      group.addTab('session-1');
      group.addTab('session-2');

      expect(group.size).toBe(2);
      expect(group.isEmpty()).toBe(false);

      group.removeTab('session-1');
      expect(group.size).toBe(1);
    });
  });
});
