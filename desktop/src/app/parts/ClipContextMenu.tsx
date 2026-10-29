import { Copy, RefreshCw, Scissors, Trash2 } from 'lucide-react';
import type { CommandAvailability } from '../../shortcuts/registry';

export function ClipContextMenu({ position, canEdit, selectedCount, onReplace, availabilityFor, tip, shortcutText, onRun }: {
  position: { x: number; y: number };
  canEdit: boolean;
  selectedCount: number;
  onReplace: () => void;
  availabilityFor: (id: string) => CommandAvailability;
  tip: (id: string, label: string) => string;
  shortcutText: (id: string) => string;
  onRun: (id: string) => void;
}) {
  return (
    <div
      className="clip-context-menu"
      style={{ left: Math.max(10, Math.min(position.x, window.innerWidth - 252)), top: Math.max(10, Math.min(position.y, window.innerHeight - 232)) }}
      role="menu"
      aria-label="Clip actions"
    >
      <span className="context-menu-heading">Clip actions</span>
      <button role="menuitem" disabled={!canEdit || selectedCount !== 1} title={selectedCount === 1 ? 'Replace this scene photo or video and keep its timing, text, and looks' : 'Select one clip to replace its media'} onClick={onReplace}><RefreshCw size={14} /><span>Replace media…</span><kbd>—</kbd></button>
      <span className="context-menu-divider" aria-hidden="true" />
      {[
        { id: 'clip.split', label: 'Split at playhead', icon: <Scissors size={14} /> },
        { id: 'clip.duplicate', label: selectedCount > 1 ? `Duplicate ${selectedCount} clips` : 'Duplicate clip', icon: <Copy size={14} /> },
        { id: 'clip.ripple_delete', label: selectedCount > 1 ? `Ripple delete ${selectedCount} clips` : 'Ripple delete', icon: <Trash2 size={14} /> },
        { id: 'clip.delete', label: selectedCount > 1 ? `Delete ${selectedCount} clips` : 'Delete clip', icon: <Trash2 size={14} /> },
      ].map(action => {
        const state = availabilityFor(action.id);
        return <button
          key={action.id}
          role="menuitem"
          disabled={state.disabled}
          title={state.disabled ? state.reason : tip(action.id, action.label)}
          onClick={() => onRun(action.id)}
        >
          {action.icon}<span>{action.label}{state.disabled && state.reason ? <small className="context-reason">{state.reason}</small> : null}</span><kbd>{shortcutText(action.id)}</kbd>
        </button>;
      })}
    </div>
  );
}
