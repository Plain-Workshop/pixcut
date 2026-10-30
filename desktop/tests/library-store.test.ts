import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ELEMENT_PAGE, INITIAL_LIBRARY, LibraryProvider, createLibraryStore, filterElements, useLibraryState } from '../src/app/library-store';
import { ELEMENT_CATALOG } from '../src/components/elements/catalog';

describe('library store', () => {
  it('starts with empty searches and the project audio tab', () => {
    const store = createLibraryStore();
    expect(store.get()).toEqual(INITIAL_LIBRARY);
    expect(store.get().audioLibraryTab).toBe('project');
    expect(store.get().elementLimit).toBe(ELEMENT_PAGE);
  });

  it('takes a value or an updater and keeps setter identities', () => {
    const store = createLibraryStore();
    const before = { ...store.setters };
    store.setters.setSoundQuery('rain');
    store.setters.setElementLimit(n => n + ELEMENT_PAGE);
    expect(store.get()).toMatchObject({ soundQuery: 'rain', elementLimit: ELEMENT_PAGE * 2 });
    for (const key of Object.keys(before) as (keyof typeof before)[]) expect(store.setters[key]).toBe(before[key]);
  });

  it('shortens the element grid when a filter changes, not when the limit does', () => {
    const { get, setters } = createLibraryStore();
    setters.setElementLimit(120);
    setters.setElementSearch('star');
    expect(get().elementLimit).toBe(ELEMENT_PAGE);
    setters.setElementLimit(80);
    setters.setElementCategory('Shapes');
    expect(get().elementLimit).toBe(ELEMENT_PAGE);
    setters.setElementLimit(80);
    setters.setHoveredElement('x');
    expect(get().elementLimit).toBe(80);
  });

  it('notifies only on real changes and stops after unsubscribe', () => {
    const store = createLibraryStore();
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.setters.setMusicMood('All');
    expect(listener).not.toHaveBeenCalled();
    store.setters.setMusicMood('Calm');
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    store.setters.setMusicMood('Epic');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('resets to the initial state', () => {
    const store = createLibraryStore();
    store.setters.setMediaQuery('beach');
    store.reset();
    expect(store.get()).toEqual(INITIAL_LIBRARY);
  });

  it('is readable through a provider, and throws without one', () => {
    const store = createLibraryStore();
    store.setters.setMediaQuery('beach');
    const Probe = () => createElement('i', null, useLibraryState().mediaQuery);
    expect(renderToStaticMarkup(createElement(LibraryProvider, { store }, createElement(Probe)))).toContain('beach');
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/LibraryProvider/);
  });
});

describe('filterElements', () => {
  const all = { elementCategory: 'All', elementCollection: 'All', elementSearch: '' };
  it('returns everything for the default filter', () => {
    expect(filterElements(ELEMENT_CATALOG, all)).toHaveLength(ELEMENT_CATALOG.length);
  });
  it('matches by category and collection', () => {
    const sample = ELEMENT_CATALOG[0];
    const byCategory = filterElements(ELEMENT_CATALOG, { ...all, elementCategory: sample.category });
    expect(byCategory.length).toBeGreaterThan(0);
    expect(byCategory.every(item => item.category === sample.category)).toBe(true);
    const byCollection = filterElements(ELEMENT_CATALOG, { ...all, elementCollection: sample.collection });
    expect(byCollection.every(item => item.collection === sample.collection)).toBe(true);
  });
  it('searches label text case-insensitively and ignores surrounding spaces', () => {
    const sample = ELEMENT_CATALOG[0];
    const result = filterElements(ELEMENT_CATALOG, { ...all, elementSearch: `  ${sample.label.toUpperCase()} ` });
    expect(result.map(item => item.id)).toContain(sample.id);
    expect(filterElements(ELEMENT_CATALOG, { ...all, elementSearch: 'zzzz-no-such-element' })).toEqual([]);
  });
});
