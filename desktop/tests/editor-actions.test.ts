import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorActionsProvider, useEditorActions, type EditorActions } from '../src/app/editor-actions';

describe('editor actions', () => {
  const Probe = () => { const { deleteSelected, shortcutText } = useEditorActions(); deleteSelected(); return createElement('p', null, shortcutText('clip.delete')); };

  it('lets a panel call an action without receiving it as a prop', () => {
    const deleteSelected = vi.fn();
    const actions = { deleteSelected, shortcutText: (id: string) => `key:${id}` } as unknown as EditorActions;
    expect(renderToStaticMarkup(createElement(EditorActionsProvider, { value: actions }, createElement(Probe)))).toContain('key:clip.delete');
    expect(deleteSelected).toHaveBeenCalledTimes(1);
  });

  it('explains itself when there is no provider', () => {
    expect(() => renderToStaticMarkup(createElement(Probe))).toThrow(/EditorActionsProvider/);
  });
});
