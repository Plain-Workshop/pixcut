import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_SELECTION, SelectionProvider, createSelectionStore, useSelection } from '../src/app/selection-store';

describe('selection store', () => {
  it('starts empty on the scene target', () => {
    const store = createSelectionStore();
    expect(store.get()).toEqual(INITIAL_SELECTION);
    expect(store.get().editTarget).toBe('scene');
  });

  it('takes a value or an updater, like useState', () => {
    const { get, setters } = createSelectionStore();
    setters.setSelectedIds(['a']);
    setters.setSelectedIds(ids => [...ids, 'b']);
    setters.setEditTarget('audio');
    setters.setSelectedAudioId(current => current ?? 'clip');
    expect(get()).toMatchObject({ selectedIds: ['a', 'b'], editTarget: 'audio', selectedAudioId: 'clip' });
  });

  it('keeps the same setter identities, so effects depending on them never re-run', () => {
    const store = createSelectionStore();
    const before = { ...store.setters };
    store.setters.setSelectedIds(['x']);
    expect(store.setters).toEqual(before);
    for (const key of Object.keys(before) as (keyof typeof before)[]) expect(store.setters[key]).toBe(before[key]);
  });

  it('does not notify when the value is unchanged and returns the same state object', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setters.setPrimarySelected(null);
    store.setters.setSelectedIds(ids => ids);
    expect(listener).not.toHaveBeenCalled();
    const state = store.get();
    store.setters.setPrimarySelected('a');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).not.toBe(state);
  });

  it('stops notifying after unsubscribe, and reset notifies and clears', () => {
    const store = createSelectionStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.setters.setSelectedPipId('p');
    off();
    store.setters.setSelectedPipId('q');
    expect(listener).toHaveBeenCalledTimes(1);
    const again = vi.fn();
    store.subscribe(again);
    store.reset();
    expect(again).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual(INITIAL_SELECTION);
  });

  it('two stores do not share state', () => {
    const one = createSelectionStore(), two = createSelectionStore();
    one.setters.setSelectedIds(['a']);
    expect(two.get().selectedIds).toEqual([]);
  });
});

describe('useSelection', () => {
  const Probe = () => { const { selectedIds, editTarget } = useSelection(); return createElement('p', null, `${editTarget}:${selectedIds.join(',')}`); };

  it('reads from the provider', () => {
    const store = createSelectionStore();
    store.setters.setSelectedIds(['one', 'two']);
    store.setters.setEditTarget('text');
    expect(renderToStaticMarkup(createElement(SelectionProvider, { store }, createElement(Probe)))).toContain('text:one,two');
  });

  it('explains itself when there is no provider', () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/SelectionProvider/);
  });
});
