import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import {
  COMMANDS,
  formatBinding,
  type CommandAvailability,
  type ShortcutPlatform,
} from '../../shortcuts/registry';

export function CommandPalette({
  platform,
  bindings,
  availability,
  onRun,
  onClose,
}: {
  platform: ShortcutPlatform;
  bindings: Record<string, string>;
  availability: Record<string, CommandAvailability>;
  onRun: (commandId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLButtonElement>(null);
  const results = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return COMMANDS.filter(command => {
      const binding = bindings[command.id] ?? '';
      const haystack = [command.label, command.description, command.category, command.id, binding, formatBinding(binding, platform), ...command.synonyms].join(' ').toLowerCase();
      return tokens.every(token => haystack.includes(token));
    });
  }, [query, bindings, platform]);
  const selected = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);

  function keydown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length) setActive(index => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length) setActive(index => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const command = results[selected];
      if (command && !availability[command.id]?.disabled) onRun(command.id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  }

  return <div className="command-palette">
    <label className="palette-search">
      <Search size={16} />
      <input
        autoFocus
        aria-label="Search commands"
        aria-controls="palette-results"
        aria-activedescendant={results[selected] ? `palette-command-${results[selected].id}` : undefined}
        placeholder="Search every action, synonym, or shortcut…"
        value={query}
        onChange={event => setQuery(event.target.value)}
        onKeyDown={keydown}
      />
      <kbd>{results.length}</kbd>
    </label>
    <div className="palette-results" id="palette-results" role="listbox" aria-label="Available commands">
      {results.map((command, index) => {
        const state = availability[command.id] ?? { disabled: false };
        const binding = bindings[command.id] ?? '';
        return <button
          key={command.id}
          id={`palette-command-${command.id}`}
          ref={index === selected ? activeRef : undefined}
          role="option"
          aria-selected={index === selected}
          className={`palette-item ${index === selected ? 'active' : ''}`}
          disabled={state.disabled}
          onMouseEnter={() => setActive(index)}
          onClick={() => onRun(command.id)}
        >
          <span className="palette-copy">
            <span className="palette-label">{command.label}<span className="palette-category">{command.category}</span></span>
            <span className="palette-description">{state.reason ?? command.description}</span>
          </span>
          <span className="palette-meta">
            <kbd>{formatBinding(binding, platform)}</kbd>
            {state.disabled && <span className="palette-disabled">Unavailable</span>}
          </span>
        </button>;
      })}
      {!results.length && <div className="palette-empty"><Search size={22} /><strong>No matching commands.</strong><span>Try “split”, “export”, or “undo”.</span></div>}
    </div>
    <div className="palette-footer">
      <span>Search works offline, by action name or synonym.</span>
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate <span className="footer-separator">·</span> <kbd>↵</kbd> run <span className="footer-separator">·</span> <kbd>esc</kbd> close</span>
    </div>
  </div>;
}
