import { describe, expect, it } from 'vitest';
import { edit, emptyProject, type AudioClip, type ElementLayer } from '../src/stores/model';
import { missingAssets, replaceAssetRef } from '../src/stores/missing-assets';

const IMAGE_REF = `pixcut-asset:${'a'.repeat(64)}`;
const AUDIO_REF = `pixcut-asset:${'b'.repeat(64)}`;
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function element(source: string, kind: ElementLayer['kind']): ElementLayer {
  return {
    id: `${kind}-layer`, kind, label: `${kind} asset`, source, x: 0, y: 0, width: .4, height: .4,
    rotation: 0, color: '#FFFFFF', opacity: 1, startTicks: 0, durationTicks: 120, animation: 'none',
  };
}

function project() {
  const base = edit(emptyProject('Missing media'), {
    type: 'add',
    scenes: [{ id: 'scene-1', name: 'Beach clip', image: IMAGE_REF, startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#000000', fit: 'cover' }],
  });
  base.tracks[0].clips[0].elements = [element(IMAGE_REF, 'video')];
  base.overlays = [element(IMAGE_REF, 'image')];
  base.audio = [{
    id: 'audio-1', name: 'Lapel mic.wav', data: AUDIO_REF, lane: 0, startTicks: 0, durationTicks: 120,
    sourceInSeconds: 0, sourceDurationSeconds: 4, volume: 1, fadeIn: 0, fadeOut: 0,
  } satisfies AudioClip];
  return base;
}

describe('missing media', () => {
  it('lists each unresolved reference once with its kind and label', () => {
    expect(missingAssets(project())).toEqual([
      { ref: IMAGE_REF, kind: 'image', label: 'image asset' },
      { ref: AUDIO_REF, kind: 'audio', label: 'Lapel mic.wav' },
    ]);
  });

  it('reports nothing once every reference is media data', () => {
    const replaced = replaceAssetRef(project(), IMAGE_REF, PNG);
    expect(missingAssets(replaceAssetRef(replaced, AUDIO_REF, 'data:audio/wav;base64,AA=='))).toEqual([]);
  });

  it('replaces every occurrence without touching the original project', () => {
    const original = project();
    const replaced = replaceAssetRef(original, IMAGE_REF, PNG);
    expect(original.tracks[0].clips[0].image).toBe(IMAGE_REF);
    expect(original.overlays[0].source).toBe(IMAGE_REF);
    expect(replaced.tracks[0].clips[0].image).toBe(PNG);
    expect(replaced.tracks[0].clips[0].elements?.[0].source).toBe(PNG);
    expect(replaced.overlays[0].source).toBe(PNG);
    expect(replaced.audio[0].data).toBe(AUDIO_REF);
  });
});
