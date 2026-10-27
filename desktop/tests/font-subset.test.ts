import { describe, expect, it } from 'vitest';
import { subsetCharacters } from '../src/components/text/subset-chars';

describe('font subset characters', () => {
  it('covers Latin, Cyrillic, Greek and kana', () => {
    const text = subsetCharacters();
    for (const character of ['A', 'z', '0', '!', 'Ж', 'ї', 'Ω', 'あ', 'カ', 'ー']) {
      expect(text.includes(character), character).toBe(true);
    }
  });

  it('includes common CJK ideographs and project text', () => {
    const text = subsetCharacters('Rare 龍 glyph');
    for (const character of ['的', '是', '一', '龍', 'R', 'g']) {
      expect(text.includes(character), character).toBe(true);
    }
  });

  it('keeps punctuation and symbols that titles use', () => {
    const text = subsetCharacters();
    for (const character of ['—', '“', '”', '·', '…', '€', '→', '★']) {
      expect(text.includes(character), character).toBe(true);
    }
  });
});
