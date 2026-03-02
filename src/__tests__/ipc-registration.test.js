import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const testDir = path.dirname(new URL(import.meta.url).pathname);

function readFile(relPath) {
  const root = path.resolve(testDir, '..', '..');
  return fs.readFileSync(path.join(root, relPath), 'utf-8');
}

function extractInvokeCommands(source) {
  const commands = new Set();
  const regex = /invoke\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(source)) !== null) {
    commands.add(match[1]);
  }
  return commands;
}

function extractRegisteredCommands(mainRs) {
  const match = mainRs.match(/generate_handler!\[(.*?)\]\)/s);
  if (!match) return new Set();

  const handlers = match[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split('::').pop());

  return new Set(handlers);
}

describe('IPC registration consistency', () => {
  it('should keep Claude/AI commands registered in main.rs', () => {
    const appJs = readFile('src/app.js');
    const mainRs = readFile('src-tauri/src/main.rs');

    const invoked = extractInvokeCommands(appJs);
    const registered = extractRegisteredCommands(mainRs);

    const required = [
      'check_claude_installed',
      'get_claude_start_command',
      'translate_natural_language',
      'get_ai_patterns'
    ];

    required.forEach((command) => {
      expect(invoked.has(command)).toBe(true);
      expect(registered.has(command)).toBe(true);
    });
  });
});
