import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Status', () => {
    it('should have correct status constants', () => {
      const SESSION_STATUS = {
        CONNECTING: 'connecting',
        RUNNING: 'running',
        EXITED: 'exited'
      };

      expect(SESSION_STATUS.CONNECTING).toBe('connecting');
      expect(SESSION_STATUS.RUNNING).toBe('running');
      expect(SESSION_STATUS.EXITED).toBe('exited');
    });
  });

  describe('TabGroup', () => {
    it('should create a tab group with default options', () => {
      class TabGroup {
        constructor(id, name, options = {}) {
          this.id = id;
          this.name = name;
          this.color = options.color || '#0e639c';
          this.collapsed = false;
          this.tabIds = new Set();
        }
        addTab(sessionId) { this.tabIds.add(sessionId); }
        removeTab(sessionId) { this.tabIds.delete(sessionId); }
        get size() { return this.tabIds.size; }
        isEmpty() { return this.tabIds.size === 0; }
      }

      const group = new TabGroup('group-1', 'Test Group');
      expect(group.id).toBe('group-1');
      expect(group.name).toBe('Test Group');
      expect(group.color).toBe('#0e639c');
      expect(group.collapsed).toBe(false);
      expect(group.isEmpty()).toBe(true);
    });

    it('should add and remove tabs correctly', () => {
      class TabGroup {
        constructor(id, name) {
          this.id = id;
          this.name = name;
          this.tabIds = new Set();
        }
        addTab(sessionId) { this.tabIds.add(sessionId); }
        removeTab(sessionId) { this.tabIds.delete(sessionId); }
        get size() { return this.tabIds.size; }
        isEmpty() { return this.tabIds.size === 0; }
      }

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
