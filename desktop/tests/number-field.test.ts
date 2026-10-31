import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RangeField, formatNumber, stepValue } from '../src/components/inspector/NumberField';

describe('stepping a typed value', () => {
  it('steps by the step, ten times as far with Shift and a tenth with Alt', () => {
    expect(stepValue(50, 1, 1, 0, 100)).toBe(51);
    expect(stepValue(50, -1, 1, 0, 100, { shift: true })).toBe(40);
    expect(stepValue(1, 1, 0.5, 0, 10, { alt: true })).toBeCloseTo(1.05, 6);
  });
  it('clamps to the range and stays on the step grid', () => {
    expect(stepValue(95, 1, 1, 0, 100, { shift: true })).toBe(100);
    expect(stepValue(3, -1, 5, 0, 100, { shift: true })).toBe(0);
    expect(stepValue(0.7, 1, 0.1, 0, 2)).toBeCloseTo(0.8, 6);
  });
  it('formats without float noise', () => {
    expect(formatNumber(0.30000000000000004)).toBe('0.3');
    expect(formatNumber(12)).toBe('12');
  });
});

describe('RangeField', () => {
  const noop = () => {};
  const html = (props: Partial<Parameters<typeof RangeField>[0]> = {}) => renderToStaticMarkup(createElement(RangeField, { label: 'Volume', value: 40, min: 0, max: 100, step: 1, unit: '%', onChange: noop, onCommit: noop, ...props }));
  it('renders a slider and a typed value that agree', () => {
    const markup = html();
    expect(markup).toContain('type="range"');
    expect(markup).toContain('type="number"');
    expect(markup).toMatch(/aria-label="Volume slider"/);
    expect(markup).toMatch(/aria-label="Volume"/);
    expect(markup).toContain('>%<');
  });
  it('keeps an explicit slider name so screen readers hear the same label as before', () => {
    expect(html({ sliderLabel: 'Audio volume' })).toContain('aria-label="Audio volume"');
  });
  it('clamps a value outside the range on the slider and disables both controls together', () => {
    expect(html({ value: 250 })).toContain('value="100"');
    const disabled = html({ disabled: true });
    expect((disabled.match(/disabled=""/g) ?? []).length).toBe(2);
  });
});
