import { describe, it, expect } from 'vitest';
import { TERMINAL_THEMES } from '../state.js';
import { TAB_COLORS } from '../ui-constants.js';

describe('Settings', () => {
  describe('Terminal Themes', () => {
    it('should have dark theme', () => {
      expect(TERMINAL_THEMES.dark).toBeDefined();
      expect(TERMINAL_THEMES.dark.background).toBe('#1e1e1e');
    });

    it('should have light theme', () => {
      expect(TERMINAL_THEMES.light).toBeDefined();
      expect(TERMINAL_THEMES.light.background).toBe('#ffffff');
    });

    it('should have monokai theme', () => {
      expect(TERMINAL_THEMES.monokai).toBeDefined();
      expect(TERMINAL_THEMES.monokai.background).toBe('#272822');
    });
  });

  describe('Tab Colors', () => {
    it('should have predefined colors', () => {
      expect(TAB_COLORS.length).toBeGreaterThan(0);
      expect(TAB_COLORS.some((c) => c.name === 'None')).toBe(true);
    });

    it('should have null value for None color', () => {
      const noneColor = TAB_COLORS.find((c) => c.name === 'None');
      expect(noneColor?.value).toBeNull();
    });
  });
});
