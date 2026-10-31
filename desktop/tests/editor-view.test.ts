import { describe, expect, it } from 'vitest';
import { deriveEditorView, buildProjectTextScene, type ViewInputs } from '../src/app/editor-view';
import { edit, emptyProject, type Scene, type TextLayer } from '../src/stores/model';

const scene = (id: string, durationTicks = 60): Scene => ({ id, name: id, image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' });
const project = edit(emptyProject('View'), { type: 'add', scenes: [scene('a'), scene('b'), scene('c')] });
const inputs = (patch: Partial<ViewInputs> = {}): ViewInputs => ({ project, position: 0, playing: false, selectedIds: [], primarySelected: null, selectedGlobalTextId: null, selectedPipId: null, selectedTextLayerId: null, previewScene: null, pipDraft: null, ...patch });
const layer = (id: string): TextLayer => ({ id, title: id, subtitle: '', color: '#FFFFFF' } as TextLayer);

describe('which clip is selected', () => {
  it('falls back to the clip under the playhead when nothing is selected', () => {
    const view = deriveEditorView(inputs({ position: 2.5 }));
    expect(view.active?.id).toBe('b');
    expect(view.selectedScene?.id).toBe('b');
    expect(view.selectedCount).toBe(1);
    expect(view.hasSceneSelection).toBe(false);
    expect(view.isSelected('b')).toBe(false);
  });
  it('uses the chosen clips, the primary one first, and ignores ids that no longer exist', () => {
    const view = deriveEditorView(inputs({ selectedIds: ['a', 'gone', 'c'], primarySelected: 'a' }));
    expect(view.selectedScenes.map(item => item.id)).toEqual(['a', 'c']);
    expect(view.selectedScene?.id).toBe('a');
    expect(view.selectedCount).toBe(2);
    expect(view.hasSceneSelection).toBe(true);
    expect(view.isSelected('c')).toBe(true);
    expect(view.isSelected('b')).toBe(false);
  });
  it('uses the last selected clip when the primary one is not in the selection', () => {
    expect(deriveEditorView(inputs({ selectedIds: ['a', 'b'], primarySelected: 'c' })).selectedScene?.id).toBe('b');
  });
});

describe('preview target', () => {
  const pinned = scene('b');
  it('follows playback while playing and the pinned clip otherwise', () => {
    expect(deriveEditorView(inputs({ playing: true, previewScene: pinned, position: 0 })).previewTarget?.id).toBe('a');
    expect(deriveEditorView(inputs({ playing: false, previewScene: pinned, position: 0 })).previewTarget?.id).toBe('b');
  });
});

describe('picture in picture', () => {
  it('swaps the dragged clip for its draft but keeps selection on the stored one', () => {
    const pip = { ...scene('p1'), durationTicks: 30, pip: { x: .8, y: .78, width: .32, height: .32, radius: .06, shadow: 60 } };
    const withPip = edit(project, { type: 'pip', scenes: [pip] });
    const draft = { ...pip, startTicks: 12 };
    const view = deriveEditorView(inputs({ project: withPip, selectedPipId: 'p1', pipDraft: draft }));
    expect(view.pipScenes[0].startTicks).toBe(0);
    expect(view.renderPipScenes[0].startTicks).toBe(12);
    expect(view.selectedPip?.startTicks).toBe(0);
    expect(view.activePip?.startTicks).toBe(12);
    expect(view.pipVideoScenes).toEqual([]);
    expect(deriveEditorView(inputs({ project: withPip })).selectedPip).toBeNull();
  });
});

describe('text selection', () => {
  it('edits project text through a scene-shaped stand-in', () => {
    const withText = edit(project, { type: 'globalText', layers: [layer('g1')] });
    const view = deriveEditorView(inputs({ project: withText, selectedGlobalTextId: 'g1' }));
    expect(view.selectedGlobalText?.id).toBe('g1');
    expect(view.selectedTextScene?.id).toBe(`${withText.id}-project-text`);
    expect(view.selectedTextLayer.id).toBe('g1');
    expect(buildProjectTextScene(project)).toBeNull();
    expect(buildProjectTextScene(withText)?.durationTicks).toBe(180);
  });
  it('follows a staged preview of the selected scene so text boxes stay put during a drag', () => {
    const staged = { ...scene('a'), title: 'dragging' };
    const view = deriveEditorView(inputs({ selectedIds: ['a'], previewScene: staged }));
    expect(view.selectedTextScene).toBe(staged);
    expect(deriveEditorView(inputs({ selectedIds: ['b'], previewScene: staged })).selectedTextScene?.id).toBe('b');
  });
  it('is deterministic: the same inputs give an equal view', () => {
    const a = deriveEditorView(inputs({ selectedIds: ['a', 'b'] })), b = deriveEditorView(inputs({ selectedIds: ['a', 'b'] }));
    expect(a.selectedScenes.map(item => item.id)).toEqual(b.selectedScenes.map(item => item.id));
    expect(a.selectedScene?.id).toBe(b.selectedScene?.id);
  });
});
