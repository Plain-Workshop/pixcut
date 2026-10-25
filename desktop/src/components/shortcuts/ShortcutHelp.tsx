import { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import {
  CATEGORY_ORDER,
  COMMANDS,
  PRESET_LABELS,
  contextLabel,
  formatBinding,
  type ShortcutPlatform,
  type ShortcutSettings,
} from '../../shortcuts/registry';

export function ShortcutHelp({
  settings,
  platform,
  onOpenSettings,
}: {
  settings: ShortcutSettings;
  platform: ShortcutPlatform;
  onOpenSettings: () => void;
}) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = COMMANDS.filter(command => {
      const binding = settings.bindings[command.id] ?? '';
      const haystack = [
        command.label,
        command.description,
        command.category,
        command.id,
        contextLabel(command.context),
        binding,
        formatBinding(binding, platform),
        ...command.synonyms,
      ].join(' ').toLowerCase();
      return tokens.every(token => haystack.includes(token));
    });
    return CATEGORY_ORDER
      .map(category => ({ category, commands: matches.filter(command => command.category === category) }))
      .filter(group => group.commands.length);
  }, [query, settings, platform]);
  const count = groups.reduce((sum, group) => sum + group.commands.length, 0);

  return <div className="shortcut-help">
    <h2 id="modal-title">Keyboard shortcuts</h2>
    <p>Find any action by name, synonym, or key. Binding hints across PixCut update as soon as you change them.</p>
    <div className="shortcut-help-toolbar">
      <label className="shortcut-search">
        <Search size={15} />
        <input
          autoFocus
          aria-label="Search shortcuts"
          placeholder="Search shortcuts, actions, or keys…"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      <span className="shortcut-help-meta">{count} commands · {PRESET_LABELS[settings.preset]}</span>
    </div>
    <div className="shortcut-groups">
      {groups.map(group => <section className="shortcut-group" key={group.category}>
        <h3>{group.category}</h3>
        {group.commands.map(command => <div className="shortcut-command" key={command.id}>
          <div className="shortcut-command-copy">
            <strong>{command.label}</strong>
            <small>{command.description}</small>
          </div>
          <span className={`scope-badge ${command.context}`}>{contextLabel(command.context)}</span>
          <kbd className={settings.bindings[command.id] ? '' : 'unassigned'}>{formatBinding(settings.bindings[command.id] ?? '', platform)}</kbd>
        </div>)}
      </section>)}
      {!groups.length && <div className="shortcut-empty">
        <Search size={24} />
        <strong>No shortcut matches “{query}”.</strong>
        <span>Try “playback”, “timeline”, or “save”.</span>
      </div>}
    </div>
    <div className="shortcut-help-footer">
      <span className="shortcut-help-tip">Press <kbd>{formatBinding(settings.bindings['help.shortcuts'] ?? '', platform)}</kbd> while editing — but not while typing in a field — to reopen this reference.</span>
      <button className="text-button" onClick={onOpenSettings}>Customize shortcuts <ArrowRight size={14} /></button>
    </div>
  </div>;
}
