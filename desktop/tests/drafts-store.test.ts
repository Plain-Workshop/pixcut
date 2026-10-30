import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DraftsProvider, INITIAL_DRAFTS, createDraftsStore, useDrafts } from '../src/app/drafts-store';
import type { Scene } from '../src/stores/model';

const scene = { id: 's1' } as Scene;

describe('drafts store', () => {
  it('starts with nothing staged', () => {
    expect(createDraftsStore().get()).toEqual(INITIAL_DRAFTS);
  });

  it('takes a value or an updater and keeps setter identities', () => {
    const store = createDraftsStore();
    const before = { ...store.setters };
    store.setters.setPreviewScene(scene);
    store.setters.setPipDraft(current => current ?? scene);
    expect(store.get()).toMatchObject({ previewScene: scene, pipDraft: scene, overlayDraft: null, audioDraft: null });
    for (const key of Object.keys(before) as (keyof typeof before)[]) expect(store.setters[key]).toBe(before[key]);
  });

  it('notifies once per real change, never for the same value', () => {
    const store = createDraftsStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setters.setPreviewScene(null);
    expect(listener).not.toHaveBeenCalled();
    store.setters.setPreviewScene(scene);
    store.setters.setPreviewScene(scene);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clears every draft in one notification, and not at all when already empty', () => {
    const store = createDraftsStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.clear();
    expect(listener).not.toHaveBeenCalled();
    store.setters.setPreviewScene(scene);
    store.setters.setPipDraft(scene);
    listener.mockClear();
    store.clear();
    expect(store.get()).toEqual(INITIAL_DRAFTS);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is readable through a provider, and throws without one', () => {
    const store = createDraftsStore();
    store.setters.setPreviewScene({ id: 'abc' } as Scene);
    const Probe = () => createElement('i', null, useDrafts().previewScene?.id);
    expect(renderToStaticMarkup(createElement(DraftsProvider, { store }, createElement(Probe)))).toContain('abc');
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/DraftsProvider/);
  });
});
