# NEW: Shortcut Customization and Command Architecture

## UX for Settings → Shortcuts
- Searchable list of commands; columns: Action / Assigned keys / Scope / Default / Edit.
- Built-in presets: **PixCut Default**, **Premiere-style**, **Resolve-style** (best-effort equivalent actions only), **Custom**.
- `Click to record shortcut`, capture keys with a clear visual indicator. Keyboard users can tab to record button; Esc cancels.
- On binding conflict show **both** commands and scopes. Offer `Replace other binding`, `Keep both if scopes don't overlap`, `Cancel` — never silently overwrite.
- Allow multiple bindings per command if supported; provide `Reset command`, `Reset all`, `Import JSON`, `Export JSON`.
- Unsaved edits should be clear: `Apply` and `Cancel`; optional Undo in editor. Do not discard without warning.
- Provide dedicated keyboard-only navigation and descriptive accessible names.
- Clearly identify reserved OS shortcuts and protected actions (e.g. native Cmd+Q) that are not remappable or require caution.

## Source of truth
Maintain a central typed command registry. Each command has ID, translated label/description, contexts, enabled predicate, undo policy, keyboard defaults, permissions, runtime handler. React buttons, menus, command palette, shortcuts and context menus dispatch the **same command ID**.

Example schema (illustrative):
```ts
interface EditorCommand {
  id: string;
  titleKey: string;
  descriptionKey: string;
  category: 'file'|'timeline'|'edit'|'playback'|'view'|'export';
  contexts: Array<'global'|'timeline'|'viewer'|'media-bin'|'text-edit'>;
  defaults: {windows?: string[]; macos?: string[]; linux?: string[]};
  isEnabled(ctx: CommandContext): boolean;
  execute(ctx: CommandContext, args?: unknown): Promise<void>;
}
```

## Processing policy
1. Native browser/OS text input and IME composition get priority.
2. Modal dialog receives relevant keys; `Esc` exits modal.
3. Focused panel resolves contextual keys.
4. Global app commands resolve last, if not suppressed.
5. Ignore keyboard autorepeat unless command explicitly supports it.
6. Disabled/locked selection must not mutate project state.
7. Commands modifying project go through Rust validated and undoable edit operations; UI-only commands remain in UI layer.

## Storage
- Store overrides in local app config, not in project files. Versioned schema with migrations and atomic writes.
- Example: `{schema_version:1, preset:'custom', bindings:{'clip.split':['Primary+B']}}`.
- Add ability to reset settings if config corrupted. Imports validated against schema, duplicates, reserved combinations, and current command IDs.
- Do not upload bindings or usage telemetry by default. Optional opt-in sync can come later.

## Command palette
- Ctrl/Cmd+K search by action/synonym/category, fuzzy-ranked. Keyboard: Up/Down, Enter, Esc.
- Return relevant commands: `Color adjustment`, `Set speed`, `Add fade`, `Split`, `Export`, `Open shortcut settings`.
- Executing a command should reveal correct panel or perform one undoable edit; no generative model dependency.
- Display disabled actions with explanation, and keyboard shortcut where assigned.

## First engineering slice
Registry -> key listener -> command execution -> dynamic tooltips -> help overlay -> persistence -> remapping UI -> profiles -> import/export.

## Quality gates
- Zero conflicting built-in bindings in an overlapping context.
- Keyboard event tests for Windows/macOS/Linux modifiers and IMEs.
- Remapped split key works in inspector and timeline tooltips immediately.
- Import rejects unknown prototype pollution keys and malformed payloads; local-only by default.
- Copy/paste text editing remains normal; shortcut editor never traps all keyboard focus.
