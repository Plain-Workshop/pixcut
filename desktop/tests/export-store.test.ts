import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createKeyedStore } from '../src/app/keyed-store';
import { ExportProvider, INITIAL_EXPORT, createExportStore, effectiveHardware, useExportSettings } from '../src/app/export-store';

describe('keyed store', () => {
  it('gives each key a useState-shaped setter that takes a value or an updater', () => {
    const store = createKeyedStore({ name: 'a', count: 1 });
    store.setters.setName('b');
    store.setters.setCount(n => n + 1);
    expect(store.get()).toEqual({ name: 'b', count: 2 });
  });

  it('keeps setter identities and the state object when nothing changes', () => {
    const store = createKeyedStore({ on: false });
    const before = store.get(), setter = store.setters.setOn;
    store.setters.setOn(false);
    expect(store.get()).toBe(before);
    store.setters.setOn(true);
    expect(store.setters.setOn).toBe(setter);
    expect(store.get()).not.toBe(before);
  });

  it('notifies once per real change, stops after unsubscribe, and resets', () => {
    const store = createKeyedStore({ n: 0 });
    const listener = vi.fn();
    const off = store.subscribe(listener);
    store.setters.setN(0);
    store.setters.setN(1);
    expect(listener).toHaveBeenCalledTimes(1);
    store.reset();
    expect(store.get()).toEqual({ n: 0 });
    expect(listener).toHaveBeenCalledTimes(2);
    store.reset();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    store.setters.setN(5);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('export settings store', () => {
  it('starts with standard H.264 MP4, audio and credits on, nothing selected', () => {
    expect(createExportStore().get()).toEqual(INITIAL_EXPORT);
    expect(INITIAL_EXPORT).toMatchObject({ quality: 'standard', codec: 'h264', container: 'mp4', audio: true, saveCredits: true, formatIds: [] });
  });

  it('uses hardware only for H.264 and HEVC on a machine that supports it', () => {
    expect(effectiveHardware({ hardware: true, codec: 'h264' }, true)).toBe(true);
    expect(effectiveHardware({ hardware: true, codec: 'hevc' }, true)).toBe(true);
    expect(effectiveHardware({ hardware: true, codec: 'h264' }, false)).toBe(false);
    expect(effectiveHardware({ hardware: false, codec: 'h264' }, true)).toBe(false);
    expect(effectiveHardware({ hardware: true, codec: 'vp9' as never }, true)).toBe(false);
  });

  it('is readable through a provider, and throws without one', () => {
    const store = createExportStore();
    store.setters.setQuality('high');
    const Probe = () => createElement('i', null, useExportSettings().quality);
    expect(renderToStaticMarkup(createElement(ExportProvider, { store }, createElement(Probe)))).toContain('high');
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/ExportProvider/);
  });
});
