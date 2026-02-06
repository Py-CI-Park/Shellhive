# Snippet Auto-Generation Feature

## Overview
The snippet auto-generation feature automatically tracks frequently used commands and suggests saving them as snippets for easy reuse.

## Implementation Details

### 1. Command History Tracking (`src/app.js`)

#### Command History Object
```javascript
const commandHistory = {
  commands: new Map(), // Map<projectId, Map<command, {count, lastUsed, dismissed}>>
  maxSize: 1000,
  minUsageCount: 3, // Default minimum usage count for suggestions
  dismissedCommands: new Set(), // Commands user has dismissed

  // Methods:
  // - add(command, projectId): Track command usage
  // - getFrequent(projectId, minCount): Get frequently used commands
  // - checkForSuggestion(command, projectId): Check if should suggest
  // - dismissSuggestion(command): Mark command as dismissed
  // - save(): Persist to localStorage
  // - load(): Load from localStorage
}
```

#### Key Features
- Tracks command frequency per project
- Ignores short commands (< 5 characters)
- Prioritizes complex commands (with pipes, options)
- Persists data to localStorage
- Maximum 1000 commands per project

### 2. Terminal Input Integration

Command tracking is integrated into the terminal's `onData` event handler:

```javascript
terminal.onData(async (data) => {
  // Track commands when Enter is pressed
  if (data === '\r' || data === '\n') {
    if (currentCommand.trim().length > 0) {
      const session = state.sessions.get(id);
      const projectId = session?.project?.id || null;
      commandHistory.add(currentCommand, projectId);
      currentCommand = '';
    }
  }
  // ... handle other input events
});
```

### 3. Suggestion UI

When a command reaches the threshold (default: 3 uses), a suggestion card appears:

```javascript
function showSnippetSuggestion(command, count, projectId) {
  // Creates a floating suggestion card with:
  // - Command preview
  // - Usage count
  // - "Save as snippet" button
  // - "Dismiss" button
  // - Auto-dismiss after 10 seconds
}
```

#### UI Components
- **Position**: Fixed bottom-right corner
- **Animation**: Slide-in from right with fade
- **Auto-dismiss**: 10 seconds
- **Actions**: Save or Dismiss

### 4. Settings Integration

#### HTML (`index.html`)
```html
<div class="settings-section">
  <h3 class="settings-section__title">Snippet Auto-Generation</h3>

  <div class="form-group form-group--checkbox">
    <input type="checkbox" id="settingsEnableSnippetSuggestions" checked>
    <label for="settingsEnableSnippetSuggestions">Enable snippet suggestions</label>
  </div>

  <div class="form-group">
    <label for="settingsSnippetThreshold">Minimum usage count for suggestions</label>
    <input type="range" id="settingsSnippetThreshold" min="2" max="10" value="3">
    <span id="snippetThresholdValue">3 times</span>
  </div>
</div>
```

#### Settings State
```javascript
state.settings = {
  // ... other settings
  enableSnippetSuggestions: true,
  snippetSuggestionThreshold: 3,
}
```

### 5. CSS Styling (`src/style.css`)

```css
.snippet-suggestion {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 400px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  padding: 16px;
  z-index: 1000;
  animation: slideInRight 0.3s ease-out;
}
```

## User Flow

1. **User types a command** → Terminal tracks the command
2. **Command used 3+ times** → Suggestion appears
3. **User clicks "Save"** → Command saved as snippet with auto-generated name
4. **User clicks "Dismiss"** → Command marked as dismissed, won't suggest again
5. **Auto-dismiss** → Suggestion fades after 10 seconds if no action

## Auto-Generated Snippet Names

Snippet names are automatically generated based on the command:

- Simple command: `git status` → snippet name: `git`
- Command with options: `git push -u origin main` → snippet name: `git-custom`
- Command with pipes: `ls -la | grep test` → snippet name: `ls-custom`

## Data Persistence

### localStorage Structure
```json
{
  "commands": [
    {
      "projectId": "project-123",
      "commands": [
        ["git status", {"count": 5, "lastUsed": 1234567890, "dismissed": false}],
        ["npm test", {"count": 3, "lastUsed": 1234567899, "dismissed": false}]
      ]
    }
  ],
  "dismissed": ["command-that-was-dismissed"],
  "minUsageCount": 3
}
```

## Settings Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enableSnippetSuggestions` | boolean | `true` | Enable/disable auto-suggestions |
| `snippetSuggestionThreshold` | number | `3` | Minimum uses before suggesting (2-10) |

## Benefits

1. **Reduces repetition** - Save frequently used commands automatically
2. **Project-aware** - Tracks commands per project
3. **Smart filtering** - Ignores trivial commands, prioritizes complex ones
4. **Non-intrusive** - Suggestions are optional and auto-dismiss
5. **Persistent** - Command history survives app restarts

## Future Enhancements

- [ ] Pattern matching (e.g., `git push origin *` matches any branch)
- [ ] Command parameter templates (e.g., `git checkout {{branch}}`)
- [ ] Import/export command history
- [ ] AI-powered command categorization
- [ ] Suggest command optimizations
