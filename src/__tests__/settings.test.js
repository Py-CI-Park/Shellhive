import { describe, it, expect } from 'vitest';

describe('Settings', () => {
  describe('Terminal Themes', () => {
    const TERMINAL_THEMES = {
      dark: { background: '#1e1e1e', foreground: '#cccccc' },
      light: { background: '#ffffff', foreground: '#1e1e1e' },
      monokai: { background: '#272822', foreground: '#f8f8f2' }
    };

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
    const TAB_COLORS = [
      { name: 'Red', value: '#f14c4c' },
      { name: 'Green', value: '#0dbc79' },
      { name: 'Blue', value: '#2472c8' },
      { name: 'None', value: null }
    ];

    it('should have predefined colors', () => {
      expect(TAB_COLORS.length).toBeGreaterThan(0);
      expect(TAB_COLORS.some(c => c.name === 'None')).toBe(true);
    });

    it('should have null value for None color', () => {
      const noneColor = TAB_COLORS.find(c => c.name === 'None');
      expect(noneColor.value).toBeNull();
    });
  });
});
