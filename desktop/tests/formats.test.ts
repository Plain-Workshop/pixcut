import { describe, expect, it } from 'vitest';
import { edit, emptyProject, MAX_PROJECT_FORMATS } from '../src/stores/model';
import {
  FORMAT_GROUPS,
  FORMAT_PRESETS,
  createCustomFormat,
  createFormat,
  formatOutputKey,
  formatSlug,
  groupFormatsByOutput,
} from '../src/stores/formats';

const vertical = () => ['youtube-shorts', 'instagram-reels', 'instagram-story', 'tiktok', 'facebook-reels', 'snapchat']
  .map(id => createFormat(id, []));

describe('format catalog', () => {
  it('groups every preset by platform exactly once', () => {
    const grouped = FORMAT_GROUPS.flatMap(group => group.presets.map(preset => preset.id));
    expect(grouped.sort()).toEqual(FORMAT_PRESETS.map(preset => preset.id).sort());
    expect(FORMAT_GROUPS.map(group => group.platform)).toEqual([
      'YouTube', 'Instagram', 'TikTok', 'Facebook', 'X', 'LinkedIn', 'Pinterest', 'Snapchat', '4K Master',
    ]);
    expect(FORMAT_GROUPS.find(group => group.platform === '4K Master')?.label).toBe('4K masters');
    expect(FORMAT_GROUPS.find(group => group.platform === 'Instagram')?.presets).toHaveLength(3);
  });

  it('slugifies preset and custom names for file names', () => {
    expect(formatSlug({ name: 'Instagram Story', presetId: 'instagram-story' })).toBe('insta-story');
    expect(formatSlug({ name: 'Client 2:3' })).toBe('client-2-3');
    expect(formatSlug({ name: '  Édition spéciale  ' })).toBe('dition-sp-ciale');
    expect(formatSlug({ name: '!!' })).toBe('format');
    expect(formatSlug({ name: 'x'.repeat(80) })).toHaveLength(24);
  });
});

describe('formatOutputKey', () => {
  it('ignores the display name and platform for identical renders', () => {
    const [shorts, reels] = vertical();
    expect(formatOutputKey(shorts)).toBe(formatOutputKey(reels));
  });

  it('separates different sizes, frame rates, quality and framing', () => {
    const base = createFormat('instagram-reels', []);
    expect(formatOutputKey({ ...base, width: 1080, height: 1920 })).not.toBe(formatOutputKey({ ...base, width: 1920, height: 1080 }));
    expect(formatOutputKey({ ...base, fps: 60 })).not.toBe(formatOutputKey(base));
    expect(formatOutputKey({ ...base, quality: 'high' })).not.toBe(formatOutputKey(base));
    expect(formatOutputKey({ ...base, overrides: { a: { imageZoom: 2 } } })).not.toBe(formatOutputKey(base));
  });

  it('treats override key order as irrelevant', () => {
    const a = { ...createFormat('linkedin', []), overrides: { one: { imageX: .2 }, two: { fit: 'contain' as const } } };
    const b = { ...a, overrides: { two: { fit: 'contain' as const }, one: { imageX: .2 } } };
    expect(formatOutputKey(a)).toBe(formatOutputKey(b));
  });
});

describe('groupFormatsByOutput', () => {
  it('collapses six vertical social formats into one delivery', () => {
    const groups = groupFormatsByOutput(vertical());
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('YouTube, Instagram, TikTok, Facebook, Snapchat');
    expect(groups[0].slug).toBe('yt-ig-tt-fb-sc');
    expect(groups[0].width).toBe(1080);
    expect(groups[0].height).toBe(1920);
    expect(groups[0].formats).toHaveLength(6);
  });

  it('keeps different outputs separate and preserves selection order', () => {
    const groups = groupFormatsByOutput([
      createFormat('youtube-video', []),
      createFormat('instagram-story', []),
      createFormat('x-video', []),
      createFormat('linkedin', []),
      createFormat('pinterest', []),
    ]);
    expect(groups.map(group => `${group.width}x${group.height}`)).toEqual(['1920x1080', '1080x1920', '1080x1080', '1000x1500']);
    expect(groups[0].formats).toHaveLength(2);
  });

  it('lets a custom size join a social format that renders the same', () => {
    const custom = createCustomFormat('Client vertical', 1080, 1920, 30, 'standard', []);
    const groups = groupFormatsByOutput([createFormat('tiktok', []), custom]);
    expect(groups).toHaveLength(1);
    expect(groups[0].slug).toBe('tt-client-vertical');
    expect(groups[0].label).toBe('TikTok, Client vertical');
  });

  it('returns nothing for an empty selection', () => {
    expect(groupFormatsByOutput([])).toEqual([]);
  });
});

describe('project format cap', () => {
  it('accepts 24 deliverables and rejects the 25th', () => {
    const project = emptyProject('Deliverables');
    const formats = Array.from({ length: MAX_PROJECT_FORMATS }, () => createFormat('youtube-video', []));
    expect(() => edit(project, { type: 'formats', formats })).not.toThrow();
    expect(() => edit(project, { type: 'formats', formats: [...formats, createFormat('tiktok', [])] })).toThrow(/24 output formats/);
  });
});
