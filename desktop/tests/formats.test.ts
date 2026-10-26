import { describe, expect, it } from 'vitest';
import { edit, emptyProject, MAX_PROJECT_FORMATS } from '../src/stores/model';
import {
  FORMAT_FILTERS,
  FORMAT_GROUPS,
  FORMAT_PRESETS,
  createCustomFormat,
  createFormat,
  filterFormatGroups,
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
      'YouTube', 'Instagram', 'TikTok', 'Facebook', 'X', 'LinkedIn', 'Pinterest', 'Snapchat', 'Sizes', '4K Master',
    ]);
    expect(FORMAT_GROUPS.find(group => group.platform === '4K Master')?.label).toBe('4K masters');
    expect(FORMAT_GROUPS.find(group => group.platform === 'Instagram')?.presets).toHaveLength(4);
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

describe('popular sizes and the format filters', () => {
  const sizes = FORMAT_GROUPS.find(group => group.platform === 'Sizes')!;

  it('offers the small and mid sizes people ask for', () => {
    expect(sizes.presets.map(preset => preset.id)).toEqual([
      'qhd-1440', 'hd-720', 'sd-480', 'compact-640', 'tiny-320',
      'vertical-720', 'vertical-480', 'square-640', 'portrait-864',
    ]);
    const byId = new Map(FORMAT_PRESETS.map(preset => [preset.id, preset]));
    expect(byId.get('tiny-320')).toMatchObject({ width: 320, height: 180, aspect: '16:9' });
    expect(byId.get('compact-640')).toMatchObject({ width: 640, height: 360, aspect: '16:9' });
    expect(byId.get('square-640')).toMatchObject({ width: 640, height: 640, aspect: '1:1' });
    expect(byId.get('vertical-720')).toMatchObject({ width: 720, height: 1280, aspect: '9:16' });
  });

  it('keeps every preset renderable: even, in range, 16–60 fps, unique ids and slugs', () => {
    for (const preset of FORMAT_PRESETS) {
      expect(preset.width % 2, preset.id).toBe(0);
      expect(preset.height % 2, preset.id).toBe(0);
      expect(preset.width).toBeGreaterThanOrEqual(160);
      expect(preset.height).toBeGreaterThanOrEqual(160);
      expect(preset.width).toBeLessThanOrEqual(3840);
      expect(preset.height).toBeLessThanOrEqual(3840);
      expect([24, 25, 30, 60]).toContain(preset.fps);
      expect(['draft', 'standard', 'high']).toContain(preset.quality);
      // The readable suffix may be an aspect or a 4K label; dimensions must stay accurate.
      const [dimensions, detail] = preset.description.split(' · ');
      expect(dimensions).toBe(`${preset.width}×${preset.height}`);
      expect(detail?.length).toBeGreaterThan(0);
      // A preset must pass the project's own format validation.
      const project = edit(emptyProject(), { type: 'formats', formats: [createFormat(preset.id, [])] });
      expect(project.formats[0]).toMatchObject({ width: preset.width, height: preset.height, aspect: preset.aspect });
    }
    expect(new Set(FORMAT_PRESETS.map(preset => preset.id)).size).toBe(FORMAT_PRESETS.length);
    expect(new Set(FORMAT_PRESETS.map(preset => preset.slug)).size).toBe(FORMAT_PRESETS.length);
  });

  it('filters by everything, social platforms, sizes, or one platform', () => {
    expect(filterFormatGroups('all')).toHaveLength(FORMAT_GROUPS.length);
    expect(filterFormatGroups('social').map(group => group.platform)).not.toContain('Sizes');
    expect(filterFormatGroups('sizes').map(group => group.platform)).toEqual(['Sizes']);
    expect(filterFormatGroups('TikTok').map(group => group.platform)).toEqual(['TikTok']);
    expect(filterFormatGroups('nope')).toEqual([]);
    // The chips cover every destination, and never repeat one.
    const ids = FORMAT_FILTERS.map(filter => filter.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('all');
    expect(ids).toContain('sizes');
    for (const group of FORMAT_GROUPS) {
      const reachable = group.platform === 'Sizes' ? ids.includes('sizes') : ids.includes(group.platform);
      expect(reachable, group.platform).toBe(true);
    }
  });

  it('gives the size group a filename code instead of a long name', () => {
    const groups = groupFormatsByOutput([createFormat('tiny-320', []), createFormat('square-640', [])]);
    expect(groups).toHaveLength(2);
    expect(groups.map(group => group.slug).sort()).toEqual(['size', 'size']);
    expect(groups[0].label).toBe('Size');
  });
});
