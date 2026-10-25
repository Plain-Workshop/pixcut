import { describe, expect, it } from 'vitest';
import {
  COMMANDS,
  COMMAND_IDS,
  bindingMatchesEvent,
  bindingFromEvent,
  canonicalizeBinding,
  defaultBindings,
  findConflicts,
  formatBinding,
  isReservedBinding,
  parseShortcutSettings,
  presetSettings,
  shortcutReference,
} from '../src/shortcuts/registry';

const event = (key: string, overrides: Partial<KeyboardEvent> = {}) => ({
  key,
  code: key === ' ' ? 'Space' : '',
  isComposing: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
}) as KeyboardEvent;

describe('shortcut registry', () => {
  it('keeps command ids and default bindings unique and conflict-free', () => {
    expect(new Set(COMMAND_IDS).size).toBe(COMMAND_IDS.length);
    for (const platform of ['macos', 'windows', 'linux'] as const) {
      expect(findConflicts(defaultBindings(platform))).toEqual([]);
      expect(findConflicts(presetSettings('premiere', platform).bindings)).toEqual([]);
      expect(findConflicts(presetSettings('resolve', platform).bindings)).toEqual([]);
    }
  });

  it('formats effective bindings for each platform', () => {
    expect(formatBinding('Mod+Shift+Z', 'macos')).toBe('⌘⇧Z');
    expect(formatBinding('Mod+Shift+Z', 'windows')).toBe('Ctrl+Shift+Z');
    expect(formatBinding('Delete', 'macos')).toBe('Del');
    expect(formatBinding('', 'macos')).toBe('Unassigned');
    expect(canonicalizeBinding('shift+cmd+z')).toBe('Mod+Shift+Z');
    expect(canonicalizeBinding('not-a-key')).toBeNull();
  });

  it('matches keyboard events without swallowing text or IME input', () => {
    expect(bindingMatchesEvent('Mod+K', event('k', { metaKey: true }), 'macos')).toBe(true);
    expect(bindingMatchesEvent('Mod+K', event('k'), 'macos')).toBe(false);
    expect(bindingMatchesEvent('Control+K', event('k', { ctrlKey: true }), 'macos')).toBe(true);
    expect(bindingMatchesEvent('?', event('?', { shiftKey: true }), 'macos')).toBe(true);
    expect(bindingMatchesEvent('Space', event(' ', { code: 'Space' }), 'macos')).toBe(true);
    expect(bindingMatchesEvent('Mod+K', event('k', { metaKey: true, isComposing: true }), 'macos')).toBe(false);
    expect(bindingFromEvent(event('+', { metaKey: true, shiftKey: true }), 'macos')).toBe('Mod+Plus');
    expect(bindingMatchesEvent('Mod+Plus', event('+', { metaKey: true, shiftKey: true }), 'macos')).toBe(true);
    expect(formatBinding('Mod+Plus', 'macos')).toBe('⌘+');
  });

  it('validates imported JSON and rejects conflicting or unknown commands', () => {
    const valid = presetSettings('pixcut', 'macos');
    expect(parseShortcutSettings(valid, 'macos').settings?.bindings['clip.split']).toBe('Mod+B');
    const conflict = parseShortcutSettings({ ...valid, bindings: { ...valid.bindings, 'clip.split': 'Mod+S' } }, 'macos');
    expect(conflict.settings).toBeUndefined();
    expect(conflict.error).toMatch(/assigned to both/);
    const unknown = parseShortcutSettings({ ...valid, bindings: { ...valid.bindings, 'made.up': 'Mod+U' } }, 'macos');
    expect(unknown.settings).toBeUndefined();
    expect(unknown.error).toMatch(/Unknown command/);
    const future = parseShortcutSettings({ ...valid, schema_version: 2 }, 'macos');
    expect(future.settings).toBeUndefined();
    expect(future.error).toMatch(/version/);
  });

  it('shows every command in references with the active binding', () => {
    expect(COMMANDS.length).toBeGreaterThanOrEqual(20);
    expect(COMMANDS.every(command => command.label && command.description && command.synonyms.length)).toBe(true);
    expect(shortcutReference(presetSettings('pixcut', 'macos'), 'macos')).toContain('⌘B');
  });

  it('rejects reserved OS shortcuts and keeps export off native minimize', () => {
    expect(isReservedBinding('Mod+Q', 'macos')).toBe(true);
    expect(isReservedBinding('Mod+W', 'macos')).toBe(true);
    expect(isReservedBinding('Mod+Shift+E', 'macos')).toBe(false);
    expect(defaultBindings('macos')['export.open']).toBe('Mod+Shift+E');
    expect(bindingMatchesEvent('Mod+Q', event('q', { metaKey: true }), 'macos')).toBe(false);
    const reserved = parseShortcutSettings({ ...presetSettings('pixcut', 'macos'), bindings: { ...defaultBindings('macos'), 'clip.split': 'Mod+Q' } }, 'macos');
    expect(reserved.settings).toBeUndefined();
    expect(reserved.error).toMatch(/reserved/);
  });
});
