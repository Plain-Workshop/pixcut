import { describe, expect, it } from 'vitest';
import { createTextLayer } from '../src/components/text/layers';
import { MAX_GLOBAL_TEXT, edit, emptyProject, totalTicks, type Scene } from '../src/stores/model';

const scene = (id: string, startTicks: number): Scene => ({
  id, startTicks, sourceInTicks: 0, durationTicks: 30, name: id,
  image: 'data:image/png;base64,AA==', title: '', subtitle: '', color: '#FFFFFF', fit: 'cover',
});

const base = () => edit(emptyProject('Project text'), { type: 'add', scenes: [scene('a', 0), scene('b', 30)] });

describe('project-level text', () => {
  it('stores text that spans scenes and clamps it to the project', () => {
    const project = base();
    expect(totalTicks(project)).toBe(60);
    const layer = createTextLayer(500, { startTicks: 0, title: 'Across the cut' });
    const next = edit(project, { type: 'globalText', layers: [layer] });
    expect(next.globalText?.[0].title).toBe('Across the cut');
    expect(next.globalText?.[0].durationTicks).toBe(60);
  });

  it('clamps a start beyond the project and keeps one tick', () => {
    const layer = createTextLayer(10, { startTicks: 500 });
    const next = edit(base(), { type: 'globalText', layers: [layer] });
    expect(next.globalText?.[0].startTicks).toBe(59);
    expect(next.globalText?.[0].durationTicks).toBe(1);
  });

  it('rejects duplicates, too many layers and bad text', () => {
    const project = base();
    const layer = createTextLayer(30, { title: 'One' });
    expect(() => edit(project, { type: 'globalText', layers: [layer, { ...layer }] })).toThrow(/duplicate/i);
    expect(() => edit(project, { type: 'globalText', layers: [{ ...layer, title: 'x'.repeat(121) }] })).toThrow(/long/i);
    const many = Array.from({ length: MAX_GLOBAL_TEXT + 1 }, (_, index) => createTextLayer(30, { title: `T${index}` }));
    expect(() => edit(project, { type: 'globalText', layers: many })).toThrow(/40/);
  });

  it('clears the field when the list is emptied', () => {
    const project = edit(base(), { type: 'globalText', layers: [createTextLayer(30, { title: 'One' })] });
    expect(edit(project, { type: 'globalText', layers: [] }).globalText).toBeUndefined();
  });
});
