import { describe, expect, it } from 'vitest';
import { gapRemove, inRange, nudgeStart, pasteStart, rippleRemove, startingAtOrAfter, trimToPlayhead } from '../src/components/timeline/clip-edit';
import { defaultShortcutSettings, findConflicts } from '../src/shortcuts/registry';

const clip = (id: string, startTicks: number, durationTicks: number, lane = 0) => ({ id, startTicks, durationTicks, lane });

describe('delete versus ripple delete', () => {
  const clips = [clip('a', 0, 30), clip('b', 30, 30), clip('c', 70, 20), clip('d', 40, 30, 1)];
  it('plain delete leaves every other clip where it was', () => {
    expect(gapRemove(clips, 'b').map(item => [item.id, item.startTicks])).toEqual([['a', 0], ['c', 70], ['d', 40]]);
  });
  it('ripple delete moves later clips on the same lane earlier by the removed length', () => {
    const next = rippleRemove(clips, 'b', (item, removed) => item.lane === removed.lane);
    expect(next.map(item => [item.id, item.startTicks])).toEqual([['a', 0], ['c', 40], ['d', 40]]);
  });
  it('does not touch clips before the removed one or overlapping it', () => {
    const next = rippleRemove([clip('a', 0, 30), clip('b', 10, 40), clip('c', 50, 10)], 'b');
    expect(next.map(item => item.startTicks)).toEqual([0, 10]);
    expect(rippleRemove(clips, 'missing')).toBe(clips);
  });
  it('never moves a clip before zero', () => {
    expect(rippleRemove([clip('a', 5, 40), clip('b', 45, 5)], 'a').map(item => item.startTicks)).toEqual([5]);
  });
});

describe('trim to the playhead', () => {
  const c = { id: 'c', startTicks: 100, durationTicks: 120 };
  it('cuts the start and reports how far the source advances', () => {
    expect(trimToPlayhead(c, 'start', 150, 15)).toEqual({ startTicks: 150, durationTicks: 70, shiftTicks: 50 });
  });
  it('cuts the end and keeps the start', () => {
    expect(trimToPlayhead(c, 'end', 150, 15)).toEqual({ startTicks: 100, durationTicks: 50, shiftTicks: 0 });
  });
  it('refuses a playhead outside the clip or leaving a sliver', () => {
    expect(trimToPlayhead(c, 'start', 100, 15)).toBeNull();
    expect(trimToPlayhead(c, 'end', 220, 15)).toBeNull();
    expect(trimToPlayhead(c, 'end', 50, 15)).toBeNull();
    expect(trimToPlayhead(c, 'start', 210, 15)).toBeNull();
    expect(trimToPlayhead(c, 'end', 105, 15)).toBeNull();
    expect(trimToPlayhead(c, 'start', Number.NaN, 15)).toBeNull();
  });
});

describe('nudge and paste placement', () => {
  const c = { id: 'c', startTicks: 10, durationTicks: 30 };
  it('moves by frames and stays inside the story', () => {
    expect(nudgeStart(c, 1, 300)).toBe(11);
    expect(nudgeStart(c, -10, 300)).toBe(0);
    expect(nudgeStart(c, -50, 300)).toBe(0);
    expect(nudgeStart(c, 500, 300)).toBe(270);
  });
  it('pastes at the playhead, pulled back to fit, and refuses what cannot fit', () => {
    expect(pasteStart(30, 100, 300)).toBe(100);
    expect(pasteStart(30, 290, 300)).toBe(270);
    expect(pasteStart(30, -5, 300)).toBe(0);
    expect(pasteStart(400, 0, 300)).toBeNull();
    expect(pasteStart(30, 0, 0)).toBeNull();
  });
});

describe('selecting by time', () => {
  const scenes = [clip('a', 0, 60), clip('b', 60, 60), clip('c', 120, 60)];
  it('selects clips that start at or after the playhead', () => {
    expect(startingAtOrAfter(scenes, 60)).toEqual(['b', 'c']);
    expect(startingAtOrAfter(scenes, 61)).toEqual(['c']);
    expect(startingAtOrAfter(scenes, 500)).toEqual([]);
  });
  it('selects clips overlapping a marquee in either direction', () => {
    expect(inRange(scenes, 50, 70)).toEqual(['a', 'b']);
    expect(inRange(scenes, 70, 50)).toEqual(['a', 'b']);
    expect(inRange(scenes, 60, 60)).toEqual([]);
    expect(inRange(scenes, 10, 20)).toEqual(['a']);
  });
});

describe('editing shortcuts', () => {
  it('ship without conflicts on every platform', () => {
    for (const platform of ['macos', 'windows', 'linux'] as const) expect(findConflicts(defaultShortcutSettings(platform).bindings)).toEqual([]);
    const bindings = defaultShortcutSettings('windows').bindings;
    expect([bindings['clip.trim_start'], bindings['clip.trim_end'], bindings['clip.copy'], bindings['clip.paste'], bindings['clip.nudge_left'], bindings['clip.nudge_right_10'], bindings['edit.select_after']]).toEqual(['Q', 'W', 'Mod+C', 'Mod+V', 'Alt+ArrowLeft', 'Alt+Shift+ArrowRight', 'Mod+Shift+ArrowRight']);
  });
});
