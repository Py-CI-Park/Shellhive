# i18n Implementation Summary

## Overview
Implemented internationalization (i18n) support for Shellhive with Korean (ko) and English (en) language options.

## Files Modified/Created

### Created Files
1. **src/i18n/index.js** - Main i18n module
   - Translation dictionaries for Korean and English
   - `setLocale(locale)` - Set current language
   - `getLocale()` - Get current language
   - `t(key, params)` - Translate key with optional parameters
   - `getAvailableLocales()` - Get list of supported languages

### Modified Files

#### 1. src-tauri/src/settings.rs
- Added `locale: String` field to `Settings` struct
- Updated `Default::default()` to set default locale to "ko"
- Added locale validation in `save_settings()` command

#### 2. index.html
- Added language selector dropdown in settings modal
```html
<div class="form-group">
  <label for="settingsLocale">Language</label>
  <select id="settingsLocale" class="form-select">
    <option value="en">English</option>
    <option value="ko">한국어</option>
  </select>
</div>
```

#### 3. src/app.js
- Imported i18n functions: `t, setLocale, getLocale, getAvailableLocales`
- Added `locale: 'ko'` to state.settings object
- Updated `showSettingsModal()` to populate locale selector
- Updated `saveSettingsBtn` event handler to include locale
- Updated `loadSettings()` to apply locale on app startup
- Updated `saveSettings()` to apply locale when settings are saved

## Translation Keys

### Categories
- **General**: app.title, app.welcome
- **Sidebar**: projects, snippets, settings, buttons
- **Tabs**: tab actions (new, close, rename, pin, split, etc.)
- **Terminal**: connection status, search
- **Settings**: appearance, theme, font, language, logging
- **Modals**: add project, add snippet dialogs
- **Messages**: session restored, max sessions, tab renamed, etc.
- **Errors**: various error messages
- **Colors**: color names (red, orange, yellow, green, blue, purple)
- **Themes**: theme names (dark, light, monokai, high-contrast)

## Usage Example

```javascript
// Simple translation
const title = t('app.title'); // "Shellhive"

// Translation with parameters
const msg = t('msg.filesInserted', { count: 5 });
// English: "5 file path(s) inserted"
// Korean: "5개 파일 경로 입력됨"

// Change language
setLocale('en'); // Switch to English
setLocale('ko'); // Switch to Korean

// Get current language
const current = getLocale(); // "ko" or "en"
```

## Default Language
- **Default**: Korean (ko)
- Automatically applied on app startup
- Persisted in settings.json

## Settings Storage
The locale preference is saved in:
```
%APPDATA%/shellhive/settings.json
```

Example:
```json
{
  "theme": "dark",
  "font_size": 14,
  "font_family": "Consolas",
  "enable_logging": true,
  "locale": "ko"
}
```

## Future Enhancements
1. Add more languages (Japanese, Chinese, Spanish, etc.)
2. Implement dynamic UI text updates without page reload
3. Add date/time formatting based on locale
4. Support RTL languages (Arabic, Hebrew)
5. Add language-specific fonts
6. Implement plural forms handling
7. Add context-specific translations
