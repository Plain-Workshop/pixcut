import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { clamp } from '../preview/filters';

export function formatNumber(value: number) {
  return String(Number(value.toFixed(2)));
}

/** Steps a value by `direction` × step (×10 with Shift, ×0.1 with Alt), snapped to the step grid and clamped. */
export function stepValue(value: number, direction: 1 | -1, step: number, min: number, max: number, modifiers: { shift?: boolean; alt?: boolean } = {}) {
  const size = step * (modifiers.shift ? 10 : modifiers.alt ? 0.1 : 1);
  const next = Math.round((value + direction * size) / (size || 1)) * (size || 1);
  return clamp(Number(next.toFixed(6)), min, max);
}

type NumberProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
};

/** A typed value: Enter or blur commits, arrows step, Shift+arrow steps ten times as far, Alt+arrow a tenth. */
export function NumericField({ label, value, min, max, step, unit, disabled, onChange, onCommit }: NumberProps) {
  const [text, setText] = useState(formatNumber(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(formatNumber(value)); }, [value]);
  function change(raw: string) {
    setText(raw);
    if (raw.trim() === '' || raw === '-') return;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
  }
  function commit() {
    const parsed = text.trim() === '' || text === '-' ? Number.NaN : Number(text);
    const next = Number.isFinite(parsed) ? clamp(parsed, min, max) : value;
    setText(formatNumber(next));
    if (next !== value) onChange(next);
    onCommit();
  }
  return <span className="range-number-wrap">
    <input
      className="range-number"
      type="number"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={text}
      disabled={disabled}
      onFocus={() => { focused.current = true; }}
      onChange={event => change(event.target.value)}
      onBlur={() => { focused.current = false; commit(); }}
      onKeyDown={event => {
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); return; }
        if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && (event.shiftKey || event.altKey)) {
          event.preventDefault();
          const parsed = Number(text);
          const next = stepValue(Number.isFinite(parsed) ? parsed : value, event.key === 'ArrowUp' ? 1 : -1, step, min, max, { shift: event.shiftKey, alt: event.altKey });
          setText(formatNumber(next)); onChange(next);
        }
      }}
    />
    {unit && <span className="range-unit">{unit}</span>}
  </span>;
}

/** A slider with its typed value. Dragging calls `onChange`; releasing, leaving or typing Enter calls `onCommit`. */
export function RangeField({ label, sliderLabel, value, min, max, step, unit, disabled, onChange, onCommit }: NumberProps & { /** Accessible name of the slider; defaults to "<label> slider". */ sliderLabel?: string }) {
  return <div className={`range-field ${disabled ? 'disabled' : ''}`}>
    <div className="range-head">
      <span>{t(label)}</span>
      <NumericField label={label} value={value} min={min} max={max} step={step} unit={unit} disabled={disabled} onChange={onChange} onCommit={onCommit} />
    </div>
    <input
      type="range"
      aria-label={sliderLabel ?? `${t(label)} slider`}
      min={min}
      max={max}
      step={step}
      value={Math.min(max, Math.max(min, value))}
      disabled={disabled}
      onChange={event => onChange(Number(event.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      onBlur={onCommit}
    />
  </div>;
}
