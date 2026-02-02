# i18n Test Cases

## Manual Testing Checklist

### 1. Settings UI Test
- [ ] Open Settings (Ctrl+,)
- [ ] Verify "Language" dropdown exists
- [ ] Verify default value is "한국어"
- [ ] Change to "English"
- [ ] Click "Save"
- [ ] Verify settings saved successfully

### 2. Locale Persistence Test
- [ ] Set language to "English"
- [ ] Close application
- [ ] Reopen application
- [ ] Open Settings
- [ ] Verify language is still "English"

### 3. Settings File Validation Test
- [ ] Check `%APPDATA%/shellhive/settings.json`
- [ ] Verify it contains `"locale": "en"` or `"locale": "ko"`
- [ ] Manually edit to invalid locale (e.g., "fr")
- [ ] Try to save settings
- [ ] Verify error message appears

### 4. Translation Function Test (Developer Console)
```javascript
// Test basic translation
console.log(t('app.title')); // Should output: "Shellhive"

// Test translation with parameters
console.log(t('msg.filesInserted', { count: 5 }));
// English: "5 file path(s) inserted"
// Korean: "5개 파일 경로 입력됨"

// Test locale switching
console.log(getLocale()); // Current locale
setLocale('en');
console.log(t('sidebar.projects')); // "PROJECTS"
setLocale('ko');
console.log(t('sidebar.projects')); // "프로젝트"
```

### 5. HTML lang Attribute Test
- [ ] Open DevTools
- [ ] Check `<html>` element
- [ ] Verify `lang` attribute changes when locale changes
- [ ] Korean: `<html lang="ko">`
- [ ] English: `<html lang="en">`

### 6. Available Locales Test
```javascript
const locales = getAvailableLocales();
console.log(locales);
// Expected output:
// [
//   { code: 'en', name: 'English' },
//   { code: 'ko', name: '한국어' }
// ]
```

## Automated Test Cases (Future)

### Unit Tests for i18n Module
```javascript
describe('i18n', () => {
  it('should return Korean translation by default', () => {
    expect(t('app.title')).toBe('Shellhive');
    expect(t('sidebar.projects')).toBe('프로젝트');
  });

  it('should switch to English when locale is changed', () => {
    setLocale('en');
    expect(t('sidebar.projects')).toBe('PROJECTS');
  });

  it('should replace placeholders correctly', () => {
    setLocale('en');
    expect(t('msg.filesInserted', { count: 3 })).toBe('3 file path(s) inserted');
    setLocale('ko');
    expect(t('msg.filesInserted', { count: 3 })).toBe('3개 파일 경로 입력됨');
  });

  it('should fallback to English for missing Korean translations', () => {
    setLocale('ko');
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('should update document lang attribute', () => {
    setLocale('en');
    expect(document.documentElement.lang).toBe('en');
    setLocale('ko');
    expect(document.documentElement.lang).toBe('ko');
  });
});
```

### Integration Tests
```javascript
describe('Settings Integration', () => {
  it('should persist locale to backend', async () => {
    await saveSettings({ locale: 'en', /* other settings */ });
    const settings = await loadSettings();
    expect(settings.locale).toBe('en');
  });

  it('should validate locale on save', async () => {
    await expect(
      saveSettings({ locale: 'invalid', /* other settings */ })
    ).rejects.toThrow('Invalid locale');
  });
});
```

## Known Issues
None currently.

## Future Improvements
1. Add unit tests for i18n module
2. Add integration tests for settings persistence
3. Implement dynamic UI updates without reload
4. Add more translation keys for UI elements
5. Support for RTL languages
