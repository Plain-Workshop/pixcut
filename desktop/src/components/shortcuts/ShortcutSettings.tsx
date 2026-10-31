import { conflictCount, t } from '../../i18n';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Download, RotateCcw, Search, Upload, X } from 'lucide-react';
import {
  CATEGORY_ORDER,
  COMMANDS,
  COMMAND_IDS,
  PRESET_LABELS,
  bindingFromEvent,
  canonicalizeBinding,
  conflictsFor,
  contextLabel,
  defaultBindingFor,
  defaultShortcutSettings,
  findConflicts,
  formatBinding,
  isReservedBinding,
  parseShortcutSettings,
  presetSettings,
  type PresetId,
  type ShortcutPlatform,
  type ShortcutSettings as ShortcutSettingsData,
} from '../../shortcuts/registry';

type Feedback = { tone: 'ok' | 'error'; text: string } | null;
type PendingConflict = { commandId: string; binding: string; others: string[] } | null;
type Preset = Exclude<PresetId, 'custom'>;

const PRESETS: Preset[] = ['pixcut', 'premiere', 'resolve'];

export function ShortcutSettings({
  settings,
  platform,
  onApply,
  onDirtyChange,
  onClose,
}: {
  settings: ShortcutSettingsData;
  platform: ShortcutPlatform;
  onApply: (settings: ShortcutSettingsData) => boolean;
  onDirtyChange: (dirty: boolean) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [query, setQuery] = useState('');
  const [recording, setRecording] = useState<string | null>(null);
  const [conflict, setConflict] = useState<PendingConflict>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const dirty = draft.preset !== settings.preset || COMMAND_IDS.some(id => (draft.bindings[id] ?? '') !== (settings.bindings[id] ?? ''));

  useEffect(() => { setDraft(settings); setConflict(null); setRecording(null); }, [settings]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const groups = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = COMMANDS.filter(command => {
      const haystack = [
        command.label,
        command.description,
        command.category,
        command.id,
        contextLabel(command.context),
        formatBinding(draft.bindings[command.id] ?? '', platform),
        formatBinding(defaultBindingFor(command.id, platform), platform),
        ...command.synonyms,
      ].join(' ').toLowerCase();
      return tokens.every(token => haystack.includes(token));
    });
    return CATEGORY_ORDER
      .map(category => ({ category, commands: matches.filter(command => command.category === category) }))
      .filter(group => group.commands.length);
  }, [query, draft.bindings, platform]);
  const conflictCommand = conflict ? COMMANDS.find(command => command.id === conflict.commandId) : undefined;

  function loadPreset(preset: Preset) {
    setDraft(presetSettings(preset, platform));
    setConflict(null);
    setFeedback({ tone: 'ok', text: `${PRESET_LABELS[preset]} loaded. Review the bindings, then Apply.` });
  }

  function resetCommand(id: string) {
    setDraft(current => ({ ...current, preset: 'custom', bindings: { ...current.bindings, [id]: defaultBindingFor(id, platform) } }));
    setConflict(null);
    setFeedback({ tone: 'ok', text: 'Shortcut reset to its PixCut default.' });
  }

  function clearCommand(id: string) {
    setDraft(current => ({ ...current, preset: 'custom', bindings: { ...current.bindings, [id]: '' } }));
    setConflict(null);
  }

  function resetAll() {
    setDraft(defaultShortcutSettings(platform));
    setConflict(null);
    setFeedback({ tone: 'ok', text: 'All shortcuts reset to PixCut Default. Select Apply to keep them.' });
  }

  function commit(commandId: string, binding: string) {
    setDraft(current => ({ ...current, preset: 'custom', bindings: { ...current.bindings, [commandId]: binding } }));
    setConflict(null);
  }

  function record(event: KeyboardEvent<HTMLButtonElement>, commandId: string) {
    if (recording !== commandId) return;
    if (event.key === 'Tab') { setRecording(null); return; }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setRecording(null);
      return;
    }
    const binding = bindingFromEvent(event.nativeEvent, platform);
    if (!binding) {
      event.preventDefault();
      event.stopPropagation();
      setFeedback({ tone: 'ok', text: 'Keep holding the modifier and press another key.' });
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (isReservedBinding(binding, platform)) {
      setRecording(null);
      setFeedback({ tone: 'error', text: `${formatBinding(binding, platform)} is reserved by the operating system. Choose another combination.` });
      return;
    }
    const others = conflictsFor(draft.bindings, commandId, binding).map(command => command.id);
    setRecording(null);
    if (others.length) {
      setConflict({ commandId, binding, others });
      setFeedback(null);
      return;
    }
    commit(commandId, binding);
    setFeedback({ tone: 'ok', text: `${formatBinding(binding, platform)} assigned. Select Apply to keep it.` });
  }

  function replaceOtherBindings() {
    if (!conflict) return;
    const { commandId, binding, others } = conflict;
    setDraft(current => {
      const bindings = { ...current.bindings };
      for (const other of others) bindings[other] = '';
      bindings[commandId] = binding;
      return { ...current, preset: 'custom', bindings };
    });
    setConflict(null);
    setFeedback({ tone: 'ok', text: `Replaced the conflicting binding with ${formatBinding(binding, platform)}.` });
  }

  function apply() {
    const parsed = parseShortcutSettings({ ...draft, schema_version: 1 }, platform, true);
    if (!parsed.settings) {
      setFeedback({ tone: 'error', text: parsed.error ?? 'These shortcuts could not be applied.' });
      return;
    }
    const conflicts = findConflicts(parsed.settings.bindings);
    if (conflicts.length) {
      setFeedback({ tone: 'error', text: t('Resolve {conflicts} before applying.', { conflicts: conflictCount(conflicts.length) }) });
      return;
    }
    const applied = onApply(parsed.settings);
    setFeedback(applied
      ? { tone: 'ok', text: 'Shortcuts applied. Tooltips, menus, help, and the command palette now use your keys.' }
      : { tone: 'error', text: 'Shortcuts could not be saved on this device. Your previous bindings are still active.' });
  }

  async function importJson(event: ChangeEvent<HTMLInputElement>) {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 1_000_000) throw new Error('Shortcut file is larger than 1 MB.');
      const parsed = parseShortcutSettings(JSON.parse(await file.text()), platform, true);
      if (!parsed.settings) throw new Error(parsed.error ?? 'Invalid shortcut file.');
      setDraft(parsed.settings);
      setConflict(null);
      setFeedback({ tone: 'ok', text: `Imported ${PRESET_LABELS[parsed.settings.preset]}. Review the bindings, then Apply.` });
    } catch (error) {
      setFeedback({ tone: 'error', text: `Import failed: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      event.target.value = '';
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pixcut-shortcuts.json';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setFeedback({ tone: 'ok', text: 'Shortcut JSON exported. Keep it with your local PixCut settings.' });
  }

  return <div className="shortcut-settings">
    <input ref={importInput} type="file" hidden accept=".json,application/json" onChange={event => void importJson(event)} />
    <div className="shortcut-toolbar">
      <label className="shortcut-search">
        <Search size={15} />
        <input
          autoFocus
          aria-label={t('Search shortcuts to customize')}
          placeholder={t('Search actions, synonyms, or keys…')}
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      <div className="shortcut-toolbar-actions">
        <button className="button" onClick={() => importInput.current?.click()}><Upload size={14} /> Import JSON</button>
        <button className="button" onClick={exportJson}><Download size={14} /> Export JSON</button>
        <button className="button" onClick={resetAll}><RotateCcw size={14} /> Reset all</button>
      </div>
    </div>

    <div className="preset-row" role="group" aria-label={t('Shortcut presets')}>
      <span>{t('Preset')}</span>
      {PRESETS.map(preset => <button key={preset} className={`preset-chip ${draft.preset === preset ? 'active' : ''}`} aria-pressed={draft.preset === preset} onClick={() => loadPreset(preset)}>{PRESET_LABELS[preset]}</button>)}
      {draft.preset === 'custom' && <span className="preset-chip custom">{t('Custom edits')}</span>}
    </div>

    {conflict && <div className="shortcut-conflict" role="alert">
      <strong>{t('That shortcut is already in use.')}</strong>
      <p><kbd>{formatBinding(conflict.binding, platform)}</kbd> would be shared by:</p>
      <ul>
        <li><b>{conflictCommand?.label}</b><span className={`scope-badge ${conflictCommand?.context ?? 'global'}`}>{contextLabel(conflictCommand?.context ?? 'global')}</span><span className="shortcut-new-tag">New</span></li>
        {conflict.others.map(id => {
          const command = COMMANDS.find(item => item.id === id);
          return <li key={id}><b>{command?.label}</b><span className={`scope-badge ${command?.context ?? 'global'}`}>{contextLabel(command?.context ?? 'global')}</span></li>;
        })}
      </ul>
      <p className="shortcut-conflict-note">These commands use overlapping scopes, so “keep both” is unavailable. Replace the existing binding or cancel.</p>
      <div className="shortcut-conflict-actions">
        <button className="button primary" onClick={replaceOtherBindings}>{t('Replace other binding')}</button>
        <button className="button" onClick={() => setConflict(null)}>{t('Cancel')}</button>
      </div>
    </div>}

    {feedback && <div className={`shortcut-feedback ${feedback.tone}`} role="status" aria-live="polite">{feedback.text}</div>}

    <div className="shortcut-settings-list">
      <div className="shortcut-setting-head" aria-hidden="true">
        <span>{t('Action')}</span><span>{t('Assigned keys')}</span><span>{t('Scope')}</span><span>{t('Default')}</span><span>{t('Edit')}</span>
      </div>
      {groups.map(group => <section className="shortcut-settings-group" key={group.category}>
        <h3>{group.category}</h3>
        {group.commands.map(command => {
          const binding = draft.bindings[command.id] ?? '';
          const fallback = defaultBindingFor(command.id, platform);
          const isDefault = canonicalizeBinding(binding) === canonicalizeBinding(fallback);
          return <div className="shortcut-setting-row" key={command.id}>
            <div className="shortcut-setting-info">
              <strong>{command.label}</strong>
              <small>{command.description}</small>
            </div>
            <button
              className={`binding-button ${recording === command.id ? 'recording' : ''} ${binding ? '' : 'unassigned'}`}
              aria-label={t('Record shortcut for {label}', { label: command.label })}
              aria-pressed={recording === command.id}
              title={recording === command.id ? 'Press the keys you want, or Esc to cancel' : 'Click, then press the keys you want'}
              onBlur={() => { if (recording === command.id) setRecording(null); }}
              onClick={() => { setRecording(recording === command.id ? null : command.id); setFeedback(null); }}
              onKeyDown={event => record(event, command.id)}
            >
              {recording === command.id ? <span className="recording-label"><span className="recording-dot" />{t('Press keys · Esc to cancel')}</span> : formatBinding(binding, platform)}
            </button>
            <span className={`scope-badge ${command.context}`}>{contextLabel(command.context)}</span>
            <kbd className="shortcut-default">{formatBinding(fallback, platform)}</kbd>
            <div className="shortcut-row-actions">
              <button className="text-button" title={t('Reset {label} to its default shortcut', { label: command.label })} disabled={isDefault} onClick={() => resetCommand(command.id)}><RotateCcw size={12} /> Reset</button>
              <button className="text-button" title={t('Clear the shortcut for {label}', { label: command.label })} disabled={!binding} onClick={() => clearCommand(command.id)}><X size={12} /> Clear</button>
            </div>
          </div>;
        })}
      </section>)}
      {!groups.length && <div className="shortcut-empty">
        <Search size={24} />
        <strong>No shortcut matches “{query}”.</strong>
        <span>{t('Try a command name or a synonym such as “cut” or “preview”.')}</span>
      </div>}
    </div>

    <p className="shortcut-reserved">{platform === 'macos' ? '⌘Q, ⌘W, ⌘H, ⌘Tab, ⌘Space, and ⌘⌥Esc stay reserved by macOS and are rejected when recording or importing.' : 'Alt+Tab, Alt+F4, Ctrl+Esc, and the Windows/Meta key combinations stay reserved by your OS and are rejected when recording or importing.'} Imported JSON is validated locally; conflicting bindings are also rejected.</p>

    <div className="shortcut-settings-footer">
      <span className={`shortcut-dirty ${dirty ? 'dirty' : ''}`}><span className="status-dot" />{dirty ? 'Unapplied changes' : 'All changes applied'}</span>
      <div>
        <button className="button" onClick={onClose}>{t('Cancel')}</button>
        <button className="button primary" disabled={!dirty || Boolean(conflict)} onClick={apply}>{t('Apply shortcuts')}</button>
      </div>
    </div>
  </div>;
}
