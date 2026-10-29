import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_LAYOUT, STORED_ZOOM_LIMIT, createLayoutStore, normalizeLayout } from '../src/app/layout-store';

const memory = (initial?: string) => {
  const data = new Map<string, string>(initial === undefined ? [] : [['pixcut-layout', initial]]);
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, removeItem: (key: string) => { data.delete(key); }, data };
};

describe('normalizeLayout', () => {
  it('fills in defaults for anything missing or malformed', () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout('nonsense')).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout([1, 2])).toEqual(DEFAULT_LAYOUT);
    expect(normalizeLayout({ libraryWidth: 'wide', timelineZoom: 'big', collapsedLanes: 'text', lockedLanes: [1, 'pip', 'pip'] })).toEqual({ ...DEFAULT_LAYOUT, lockedLanes: ['pip'] });
  });
  it('keeps sizes and zoom inside their limits', () => {
    const layout = normalizeLayout({ libraryWidth: 9999, inspectorWidth: -5, timelineHeight: 10, timelineZoom: 1e9 });
    expect(layout).toMatchObject({ libraryWidth: 380, inspectorWidth: 220, timelineHeight: 230, timelineZoom: STORED_ZOOM_LIMIT });
    expect(normalizeLayout({ timelineZoom: 0.01 }).timelineZoom).toBe(0.5);
    expect(normalizeLayout({ timelineZoom: -3 }).timelineZoom).toBe(1);
  });
});

describe('layout store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads a saved layout and survives corrupt storage', () => {
    expect(createLayoutStore(memory(JSON.stringify({ timelineZoom: 4, lockedLanes: ['text'] }))).get()).toMatchObject({ timelineZoom: 4, lockedLanes: ['text'] });
    expect(createLayoutStore(memory('{not json')).get()).toEqual(DEFAULT_LAYOUT);
    expect(createLayoutStore(null).get()).toEqual(DEFAULT_LAYOUT);
  });

  it('saves every change, toggles lanes from current state, and notifies once per change', () => {
    const storage = memory(), store = createLayoutStore(storage), listener = vi.fn();
    store.subscribe(listener);
    store.toggleLane('text'); store.toggleLane('pip'); store.toggleLane('text');
    store.toggleLaneLock('visuals');
    store.setTimelineZoom(2.5);
    expect(store.get()).toMatchObject({ collapsedLanes: ['pip'], lockedLanes: ['visuals'], timelineZoom: 2.5 });
    expect(JSON.parse(storage.data.get('pixcut-layout')!)).toMatchObject({ collapsedLanes: ['pip'], timelineZoom: 2.5 });
    expect(listener).toHaveBeenCalledTimes(5);
    store.setTimelineZoom(2.5);
    store.setCollapsedLanes(['pip', 'pip']);
    expect(listener).toHaveBeenCalledTimes(5);
  });

  it('reset restores defaults, clears storage and notifies', () => {
    const storage = memory(JSON.stringify({ timelineZoom: 3 })), store = createLayoutStore(storage), listener = vi.fn();
    store.subscribe(listener);
    store.reset();
    expect(store.get()).toEqual(DEFAULT_LAYOUT);
    expect(storage.data.has('pixcut-layout')).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resizes while dragging, clamped, and only writes storage when the drag ends', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    const storage = memory(), store = createLayoutStore(storage);
    const move = (clientX: number, clientY: number) => target.dispatchEvent(Object.assign(new Event('pointermove'), { clientX, clientY }));
    store.beginResize('library', 280, 100);
    move(150, 0);
    expect(store.get().libraryWidth).toBe(330);
    expect(storage.data.has('pixcut-layout')).toBe(false);
    move(900, 0);
    expect(store.get().libraryWidth).toBe(380);
    target.dispatchEvent(new Event('pointerup'));
    expect(JSON.parse(storage.data.get('pixcut-layout')!).libraryWidth).toBe(380);
    move(0, 0);
    expect(store.get().libraryWidth).toBe(380);
    store.beginResize('timeline', 340, 500);
    move(0, 400);
    expect(store.get().timelineHeight).toBe(440);
    target.dispatchEvent(new Event('pointerup'));
    store.beginResize('inspector', 288, 700);
    move(650, 0);
    expect(store.get().inspectorWidth).toBe(338);
    target.dispatchEvent(new Event('pointerup'));
  });
});
