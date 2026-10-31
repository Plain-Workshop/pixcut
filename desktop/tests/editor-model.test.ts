import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorModelProvider, useEditorModel, type EditorModel } from '../src/app/editor-model';
import { emptyProject } from '../src/stores/model';
import { DEFAULT_PREFERENCES } from '../src/stores/preferences';

const model = (patch: Partial<EditorModel> = {}): EditorModel => ({
  project: emptyProject('Model'), scenes: [], audio: [], canEdit: true, run: async () => true, duration: 0, projectTicks: 0, frameSeconds: 1 / 30,
  preferences: DEFAULT_PREFERENCES, activeSize: { width: 1920, height: 1080 }, setNotice: () => {}, setError: () => {}, ...patch,
});

const Probe = () => { const { project, canEdit, activeSize } = useEditorModel(); return createElement('p', null, `${project.name}:${canEdit}:${activeSize.width}x${activeSize.height}`); };

describe('editor model', () => {
  it('gives panels the project data without props', () => {
    expect(renderToStaticMarkup(createElement(EditorModelProvider, { value: model() }, createElement(Probe)))).toContain('Model:true:1920x1080');
    expect(renderToStaticMarkup(createElement(EditorModelProvider, { value: model({ canEdit: false }) }, createElement(Probe)))).toContain('Model:false');
  });
  it('explains itself when there is no provider', () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/EditorModelProvider/);
  });
});
