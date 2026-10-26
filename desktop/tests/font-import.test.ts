import { describe, expect, it } from 'vitest';
import { allFonts, fontOption, registerCustomFonts } from '../src/components/text/fonts';
import { MAX_PROJECT_FONTS, edit, emptyProject } from '../src/stores/model';

const FONT_DATA = 'data:font/ttf;base64,AA==';
const imported = (id = 'custom-1', name = 'Brand Sans') => ({ id, name, data: FONT_DATA });

describe('project fonts', () => {
  it('stores imported fonts in the project', () => {
    const project = edit(emptyProject('Fonts'), { type: 'fonts', fonts: [imported()] });
    expect(project.fonts).toEqual([imported()]);
  });

  it('keeps the bundled font list when the document is unavailable', () => {
    expect(allFonts()).toHaveLength(8);
    registerCustomFonts([imported()]);
    expect(allFonts()).toHaveLength(8);
    expect(fontOption('missing').id).toBe('inter');
  });

  it('rejects bad data, duplicate ids, empty names and too many fonts', () => {
    const project = emptyProject('Fonts');
    expect(() => edit(project, { type: 'fonts', fonts: [{ ...imported(), data: 'data:application/octet-stream;base64,AA==' }] })).toThrow(/font/i);
    expect(() => edit(project, { type: 'fonts', fonts: [imported(), imported()] })).toThrow(/font/i);
    expect(() => edit(project, { type: 'fonts', fonts: [{ ...imported(), name: '   ' }] })).toThrow(/font/i);
    const tooMany = Array.from({ length: MAX_PROJECT_FONTS + 1 }, (_, index) => imported(`custom-${index}`));
    expect(() => edit(project, { type: 'fonts', fonts: tooMany })).toThrow(/fonts/i);
  });

  it('clears imported fonts when the list is emptied', () => {
    const withFont = edit(emptyProject('Fonts'), { type: 'fonts', fonts: [imported()] });
    expect(edit(withFont, { type: 'fonts', fonts: [] }).fonts).toBeUndefined();
  });
});
