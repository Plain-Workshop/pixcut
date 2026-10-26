import { ArrowDown, ArrowUp, ChevronsDown, ChevronsUp } from 'lucide-react';
import type { StackMove } from '../elements/stack';

/**
 * Four-way layer order control shared by text layers and element overlays.
 * `position` counts from the bottom of the stack (1 = behind everything).
 */
export function StackOrder({ position, total, disabled, onMove }: { position: number; total: number; disabled?: boolean; onMove: (move: StackMove) => void }) {
  const single = total < 2;
  return <div className="stack-order">
    <div className="stack-order-head"><span>Layer order</span><small>{single ? 'Only layer' : `${position} of ${total} · back to front`}</small></div>
    <div className="stack-order-buttons" role="group" aria-label="Layer order">
      <button type="button" className="button" disabled={disabled || single || position <= 1} onClick={() => onMove('back')} title="Send behind every other layer" aria-label="Send to back"><ChevronsDown size={14} /></button>
      <button type="button" className="button" disabled={disabled || single || position <= 1} onClick={() => onMove('backward')} title="Move one layer down" aria-label="Move layer down"><ArrowDown size={14} /></button>
      <button type="button" className="button" disabled={disabled || single || position >= total} onClick={() => onMove('forward')} title="Move one layer up" aria-label="Move layer up"><ArrowUp size={14} /></button>
      <button type="button" className="button" disabled={disabled || single || position >= total} onClick={() => onMove('front')} title="Bring in front of every other layer" aria-label="Bring to front"><ChevronsUp size={14} /></button>
    </div>
  </div>;
}
