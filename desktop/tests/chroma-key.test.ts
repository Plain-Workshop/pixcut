import { describe, expect, it } from 'vitest';
import { defaultChromaKey, edit, emptyProject, validateProject, type ElementLayer, type Scene } from '../src/stores/model';
import { chromaAlpha, chromaDistance } from '../src/components/preview/chroma-key';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const scene = (): Scene => ({ id: 'scene', name: 'Scene', image: PNG, startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#000000', fit: 'cover' });
const overlay = (patch: Partial<ElementLayer> = {}): ElementLayer => ({
  id: 'overlay', kind: 'image', source: PNG, x: .5, y: .5, width: .6, height: .6, rotation: 0,
  color: '#FFFFFF', opacity: 100, startTicks: 0, durationTicks: 120, animation: 'none', ...patch,
});
const project = (element: ElementLayer) => edit(edit(emptyProject('Chroma'), { type: 'add', scenes: [scene()] }), { type: 'overlays', overlays: [element] });

describe('chroma key', () => {
  it('measures distance from the selected colour', () => {
    expect(chromaDistance(0, 255, 0, '#00ff00')).toBe(0);
    expect(chromaDistance(255, 0, 0, '#00ff00')).toBeGreaterThan(.8);
    expect(chromaDistance(0, 0, 255, '#00ff00')).toBeGreaterThan(.8);
  });

  it('keys the centre colour, preserves distant colours and softens the edge', () => {
    expect(chromaAlpha(0, 35, 20)).toBe(0);
    expect(chromaAlpha(1, 35, 20)).toBe(255);
    const edge = chromaAlpha(.37, 35, 20);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(chromaAlpha(.5, 0, 0)).toBe(255);
  });

  it('round-trips chroma settings and rejects invalid or shape-layer keys', () => {
    const chroma = { ...defaultChromaKey(), color: '#12ab34', similarity: 42, softness: 12, spill: 75 };
    const restored = validateProject(JSON.parse(JSON.stringify(project(overlay({ chroma })))));
    expect(restored.overlays[0].chroma).toEqual(chroma);
    expect(() => project(overlay({ chroma: { ...chroma, similarity: -1 } }))).toThrow(/chroma/i);
    expect(() => project(overlay({ kind: 'star', source: undefined, chroma }))).toThrow(/chroma/i);
  });
});
