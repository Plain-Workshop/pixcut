import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { INITIAL_PLAYBACK, PlaybackProvider, createPlaybackStore, usePlayback } from '../src/app/playback-store';
import { INITIAL_UI, UiProvider, createUiStore, useUi } from '../src/app/ui-store';
import { createStoreKit } from '../src/app/keyed-store';

describe('playback store', () => {
  it('starts stopped at zero, forward, without looping', () => {
    expect(createPlaybackStore().get()).toEqual(INITIAL_PLAYBACK);
    expect(INITIAL_PLAYBACK).toEqual({ playing: false, position: 0, loop: false, playDirection: 1 });
  });

  it('moves the playhead with a value or an updater and keeps the other fields', () => {
    const store = createPlaybackStore();
    store.setters.setPosition(2);
    store.setters.setPosition(seconds => seconds + 0.5);
    store.setters.setPlaying(true);
    expect(store.get()).toMatchObject({ position: 2.5, playing: true, loop: false, playDirection: 1 });
  });
});

describe('ui store', () => {
  it('starts with no dialog, the media tab and the Home section', () => {
    expect(createUiStore().get()).toEqual(INITIAL_UI);
    expect(INITIAL_UI).toMatchObject({ modal: null, tab: 'media', homeSection: 'home', audioDisplay: 'spectrogram', contextMenu: null });
  });

  it('opens and closes a dialog and tracks a drag target', () => {
    const store = createUiStore();
    store.setters.setModal('export');
    store.setters.setDropTarget('media-grid');
    expect(store.get()).toMatchObject({ modal: 'export', dropTarget: 'media-grid' });
    store.setters.setModal(null);
    expect(store.get().modal).toBeNull();
  });

  it('does not share nested defaults between stores', () => {
    const first = createUiStore(), second = createUiStore();
    first.setters.setTextDraft({ title: 'Hello', subtitle: '' });
    expect(second.get().textDraft).toEqual({ title: '', subtitle: '' });
  });
});

describe('store kit', () => {
  it('reads through a provider and names the missing provider in the error', () => {
    const playback = createPlaybackStore();
    playback.setters.setPosition(4);
    const Show = () => createElement('i', null, usePlayback().position);
    expect(renderToStaticMarkup(createElement(PlaybackProvider, { store: playback }, createElement(Show)))).toContain('>4<');
    expect(() => renderToStaticMarkup(createElement(Show))).toThrow(/Playback/);
    const Ui = () => createElement('i', null, useUi().tab);
    expect(renderToStaticMarkup(createElement(UiProvider, { store: createUiStore() }, createElement(Ui)))).toContain('media');
  });

  it('builds independent stores from one set of initial values', () => {
    const kit = createStoreKit('Thing', { n: 0 });
    const a = kit.create(), b = kit.create();
    a.setters.setN(3);
    expect(b.get().n).toBe(0);
  });
});

describe('value context', () => {
  it('hands a value to deep components and refuses to run without a provider', async () => {
    const { createValueContext } = await import('../src/app/value-context');
    const { Provider, useValue } = createValueContext<{ name: string }>('Thing');
    const Show = () => createElement('i', null, useValue().name);
    expect(renderToStaticMarkup(createElement(Provider, { value: { name: 'ok' } }, createElement(Show)))).toContain('ok');
    expect(() => renderToStaticMarkup(createElement(Show))).toThrow(/ThingProvider/);
  });
});
