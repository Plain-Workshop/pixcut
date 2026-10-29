import { describe, expect, it } from 'vitest';
import { anchoredScroll, clampZoom, editPoints, formatRulerTime, nextEditPoint, rulerTicks, secondsAt, timelineMaxZoom, TRACK_CHROME_PX, TRACK_LABEL_PX } from '../src/components/timeline/ruler';
import { edit, emptyProject, type Scene } from '../src/stores/model';
import { defaultShortcutSettings, findConflicts, parseShortcutSettings } from '../src/shortcuts/registry';

const scene = (id: string, durationTicks: number): Scene => ({ id, name: id, image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' });

describe('ruler labels', () => {
  it('formats minutes, hours and frames', () => {
    expect(formatRulerTime(0, 30, false)).toBe('0:00');
    expect(formatRulerTime(75, 30, false)).toBe('1:15');
    expect(formatRulerTime(3725, 30, false)).toBe('1:02:05');
    expect(formatRulerTime(1.5, 30, true)).toBe('0:01:15');
    expect(formatRulerTime(2 - 1 / 30, 30, true)).toBe('0:01:29');
  });
});

describe('ruler ticks', () => {
  const all = { from: 0, to: Infinity };
  it('keeps labels readable and picks whole-second steps for long stories', () => {
    const ruler = rulerTicks(600, 1200, 30, all);
    expect(ruler.step).toBe(60);
    expect(ruler.major.map(tick => tick.label).slice(0, 3)).toEqual(['0:00', '1:00', '2:00']);
    expect(ruler.major).toHaveLength(11);
    expect(ruler.minor.length).toBeGreaterThan(0);
  });
  it('switches to frame labels when zoomed in far enough', () => {
    const ruler = rulerTicks(6, 6 * 30 * 16, 30, all);
    expect(ruler.step).toBeLessThan(1);
    expect(Math.round(ruler.step * 30)).toBe(5);
    expect(ruler.major[1].label).toBe('0:00:05');
  });
  it('only builds ticks for the visible window', () => {
    const ruler = rulerTicks(600, 600 * 30 * 16, 30, { from: 100, to: 101 });
    expect(ruler.major.length).toBeLessThan(10);
    expect(ruler.major[0].seconds).toBeGreaterThanOrEqual(99.9);
    expect(ruler.major.every(tick => tick.seconds <= 101 + 1e-9)).toBe(true);
  });
  it('returns nothing for an empty story or an unmeasured panel', () => {
    expect(rulerTicks(0, 1000, 30, all).major).toEqual([]);
    expect(rulerTicks(10, 0, 30, all).major).toEqual([]);
  });
});

describe('timeline zoom', () => {
  it('reaches frame level for long stories but never drops below the classic 6×', () => {
    expect(timelineMaxZoom(6, 30, 1400)).toBe(6);
    const deep = timelineMaxZoom(600, 30, 1400);
    expect(((1400 * deep) - TRACK_CHROME_PX) / (600 * 30)).toBeCloseTo(16, 5);
    expect(timelineMaxZoom(10 * 3600, 30, 1400) * 1400).toBeLessThanOrEqual(2_000_000 + 1);
  });
  it('clamps and tidies zoom values', () => {
    expect(clampZoom(0.1, 6)).toBe(0.5);
    expect(clampZoom(10, 6)).toBe(6);
    expect(clampZoom(Number.NaN, 6)).toBe(1);
    expect(clampZoom(1.23456, 6)).toBe(1.235);
  });
  it('keeps the anchored moment under the same pixel after zooming', () => {
    const duration = 60, x = 500;
    const seconds = secondsAt(x, 0, duration, 1400);
    const scroll = anchoredScroll(seconds, x, duration, 1400 * 4);
    expect(secondsAt(x, scroll, duration, 1400 * 4)).toBeCloseTo(seconds, 6);
    expect(anchoredScroll(0, TRACK_LABEL_PX, duration, 5600)).toBe(0);
  });
});

describe('edit point navigation', () => {
  const project = edit(edit(emptyProject('Nav'), { type: 'add', scenes: [scene('a', 60), scene('b', 90)] }), { type: 'beats', beatTicks: [45] });
  it('lists every clip boundary once, in order, without beats', () => {
    expect(editPoints(project)).toEqual([0, 60, 150]);
  });
  it('steps to the next or previous boundary and stays put at the ends', () => {
    const points = editPoints(project);
    expect(nextEditPoint(points, 0, 1)).toBe(60);
    expect(nextEditPoint(points, 30, 1)).toBe(60);
    expect(nextEditPoint(points, 60, 1)).toBe(150);
    expect(nextEditPoint(points, 150, 1)).toBe(150);
    expect(nextEditPoint(points, 61, -1)).toBe(60);
    expect(nextEditPoint(points, 60, -1)).toBe(0);
    expect(nextEditPoint(points, 0, -1)).toBe(0);
  });
});

describe('navigation shortcuts', () => {
  it('ship without conflicts on every platform', () => {
    for (const platform of ['macos', 'windows', 'linux'] as const) expect(findConflicts(defaultShortcutSettings(platform).bindings)).toEqual([]);
    const bindings = defaultShortcutSettings('macos').bindings;
    expect([bindings['timeline.prev_edit'], bindings['timeline.next_edit'], bindings['timeline.go_start'], bindings['timeline.go_end'], bindings['timeline.zoom_in'], bindings['timeline.zoom_out'], bindings['timeline.zoom_fit']]).toEqual(['ArrowUp', 'ArrowDown', 'Home', 'End', '=', '-', 'Shift+Z']);
  });
  it('do not wipe saved custom shortcuts that already use a new default key', () => {
    const saved = { schema_version: 1, preset: 'custom', bindings: { 'clip.split': 'Home' } };
    const loaded = parseShortcutSettings(saved, 'macos', false).settings;
    expect(loaded?.bindings['clip.split']).toBe('Home');
    expect(loaded?.bindings['timeline.go_start']).toBe('');
    expect(parseShortcutSettings(saved, 'macos', true).settings?.bindings['timeline.go_start']).toBe('');
    expect(parseShortcutSettings({ ...saved, bindings: { 'clip.split': 'Home', 'clip.delete': 'Home' } }, 'macos', true).error).toMatch(/assigned to both/);
  });
});
