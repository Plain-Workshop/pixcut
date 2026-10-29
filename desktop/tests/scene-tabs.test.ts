import { describe, expect, it } from 'vitest';
import { APPLY_ALL_KEYS, applyAllValues, TAB_DEFAULTS, TAB_RESET_KEYS, tabChanged } from '../src/components/inspector/scene-tabs';
import type { Scene } from '../src/stores/model';

const scene = (patch: Partial<Scene> = {}): Scene => ({ id: 's', name: 'S', image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover', ...patch });

describe('inspector tab changes', () => {
  it('a fresh clip has no changed tabs', () => {
    for (const tab of ['video', 'transition', 'color', 'speed', 'fade', 'filters'] as const) expect(tabChanged(tab, scene()), tab).toBe(false);
  });
  it('flags each tab when its own settings differ from the defaults', () => {
    expect(tabChanged('video', scene({ imageZoom: 1.4 }))).toBe(true);
    expect(tabChanged('video', scene({ motion: 'zoom-in' as Scene['motion'] }))).toBe(true);
    expect(tabChanged('transition', scene({ transition: { type: 'fade', duration: .6 } as Scene['transition'] }))).toBe(true);
    expect(tabChanged('color', scene({ contrast: 1.2 }))).toBe(true);
    expect(tabChanged('color', scene({ brightness: 1, hue: 0 }))).toBe(false);
    expect(tabChanged('speed', scene({ speed: 2 }))).toBe(true);
    expect(tabChanged('speed', scene({ reverse: true }))).toBe(true);
    expect(tabChanged('fade', scene({ fadeOut: .5 }))).toBe(true);
    expect(tabChanged('filters', scene({ filter: 'none' as Scene['filter'] }))).toBe(false);
  });
  it('fit mode alone is not a change, because the default comes from preferences', () => {
    expect(tabChanged('video', scene({ fit: 'blur' }))).toBe(false);
  });
  it('resets exactly the fields its defaults name', () => {
    expect(TAB_RESET_KEYS.fade).toEqual(['fadeIn', 'fadeOut']);
    expect(TAB_DEFAULTS.transition).toEqual({ transition: null });
    expect(TAB_RESET_KEYS.color).toContain('curves');
  });
});

describe('apply to all clips', () => {
  it('copies framing mode, zoom and motion but not the photo-specific position', () => {
    const values = applyAllValues('video', scene({ fit: 'contain', imageZoom: 1.5, imageX: .3, imageY: -.2 }));
    expect(values).toMatchObject({ fit: 'contain', imageZoom: 1.5, motion: 'none' });
    expect(values).not.toHaveProperty('imageX');
    expect(values).not.toHaveProperty('imageY');
  });
  it('writes defaults for unset fields so clearing them spreads to the other clips', () => {
    expect(applyAllValues('transition', scene())).toEqual({ transition: null });
    expect(applyAllValues('filters', scene())).toEqual({ filter: 'none', filterIntensity: 100 });
    const color = applyAllValues('color', scene({ contrast: 1.3 }));
    expect(color).toMatchObject({ contrast: 1.3, brightness: 1, hue: 0 });
    expect('curves' in color).toBe(true);
  });
  it('leaves speed out because it changes each clip length differently', () => {
    expect(APPLY_ALL_KEYS.speed).toBeUndefined();
    expect(applyAllValues('speed', scene({ speed: 2 }))).toEqual({});
  });
});
