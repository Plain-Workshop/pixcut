import type { FormatQuality, FormatVariant, Scene } from './model';

export type FormatPreset = {
  id: string;
  name: string;
  /** Short, filename-friendly label used when deliveries are combined. */
  slug: string;
  platform: string;
  aspect: string;
  width: number;
  height: number;
  fps: number;
  quality: FormatQuality;
  description: string;
};

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: 'youtube-video', name: 'YouTube Video', slug: 'yt-video', platform: 'YouTube', aspect: '16:9', width: 1920, height: 1080, fps: 30, quality: 'standard', description: '1920×1080 · 16:9' },
  { id: 'youtube-shorts', name: 'YouTube Shorts', slug: 'yt-shorts', platform: 'YouTube', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'instagram-post', name: 'Instagram Post', slug: 'insta-post', platform: 'Instagram', aspect: '4:5', width: 1080, height: 1350, fps: 30, quality: 'standard', description: '1080×1350 · 4:5' },
  { id: 'instagram-reels', name: 'Instagram Reels', slug: 'insta-reels', platform: 'Instagram', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'instagram-story', name: 'Instagram Story', slug: 'insta-story', platform: 'Instagram', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'instagram-square', name: 'Instagram Square', slug: 'insta-square', platform: 'Instagram', aspect: '1:1', width: 1080, height: 1080, fps: 30, quality: 'standard', description: '1080×1080 · 1:1' },
  { id: 'tiktok', name: 'TikTok', slug: 'tiktok', platform: 'TikTok', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'facebook-post', name: 'Facebook Post', slug: 'fb-post', platform: 'Facebook', aspect: '4:5', width: 1080, height: 1350, fps: 30, quality: 'standard', description: '1080×1350 · 4:5' },
  { id: 'facebook-reels', name: 'Facebook Reels', slug: 'fb-reels', platform: 'Facebook', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'facebook-feed', name: 'Facebook Feed', slug: 'fb-feed', platform: 'Facebook', aspect: '16:9', width: 1920, height: 1080, fps: 30, quality: 'standard', description: '1920×1080 · 16:9' },
  { id: 'x-video', name: 'X / Twitter', slug: 'x', platform: 'X', aspect: '16:9', width: 1920, height: 1080, fps: 30, quality: 'standard', description: '1920×1080 · 16:9' },
  { id: 'linkedin', name: 'LinkedIn', slug: 'linkedin', platform: 'LinkedIn', aspect: '1:1', width: 1080, height: 1080, fps: 30, quality: 'standard', description: '1080×1080 · 1:1' },
  { id: 'linkedin-video', name: 'LinkedIn Video', slug: 'li-video', platform: 'LinkedIn', aspect: '16:9', width: 1920, height: 1080, fps: 30, quality: 'standard', description: '1920×1080 · 16:9' },
  { id: 'pinterest', name: 'Pinterest', slug: 'pinterest', platform: 'Pinterest', aspect: '2:3', width: 1000, height: 1500, fps: 30, quality: 'standard', description: '1000×1500 · 2:3' },
  { id: 'snapchat', name: 'Snapchat', slug: 'snapchat', platform: 'Snapchat', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'qhd-1440', name: 'QHD 1440p', slug: '1440p', platform: 'Sizes', aspect: '16:9', width: 2560, height: 1440, fps: 30, quality: 'high', description: '2560×1440 · 16:9' },
  { id: 'hd-720', name: 'HD 720p', slug: '720p', platform: 'Sizes', aspect: '16:9', width: 1280, height: 720, fps: 30, quality: 'standard', description: '1280×720 · 16:9' },
  { id: 'sd-480', name: 'SD 480p', slug: '480p', platform: 'Sizes', aspect: '16:9', width: 854, height: 480, fps: 30, quality: 'standard', description: '854×480 · 16:9' },
  { id: 'compact-640', name: 'Compact 640', slug: '640', platform: 'Sizes', aspect: '16:9', width: 640, height: 360, fps: 30, quality: 'draft', description: '640×360 · 16:9' },
  { id: 'tiny-320', name: 'Tiny 320', slug: '320', platform: 'Sizes', aspect: '16:9', width: 320, height: 180, fps: 30, quality: 'draft', description: '320×180 · 16:9' },
  { id: 'vertical-720', name: 'Vertical 720p', slug: 'v-720p', platform: 'Sizes', aspect: '9:16', width: 720, height: 1280, fps: 30, quality: 'standard', description: '720×1280 · 9:16' },
  { id: 'vertical-480', name: 'Vertical 480p', slug: 'v-480p', platform: 'Sizes', aspect: '9:16', width: 480, height: 854, fps: 30, quality: 'draft', description: '480×854 · 9:16' },
  { id: 'square-640', name: 'Square 640', slug: 'sq-640', platform: 'Sizes', aspect: '1:1', width: 640, height: 640, fps: 30, quality: 'draft', description: '640×640 · 1:1' },
  { id: 'portrait-864', name: 'Portrait 864', slug: 'p-864', platform: 'Sizes', aspect: '4:5', width: 864, height: 1080, fps: 30, quality: 'standard', description: '864×1080 · 4:5' },
  { id: '4k-landscape', name: '4K Landscape', slug: '4k-landscape', platform: '4K Master', aspect: '16:9', width: 3840, height: 2160, fps: 30, quality: 'high', description: '3840×2160 · 4K UHD' },
  { id: '4k-vertical', name: '4K Vertical', slug: '4k-vertical', platform: '4K Master', aspect: '9:16', width: 2160, height: 3840, fps: 30, quality: 'high', description: '2160×3840 · 4K vertical' },
  { id: '4k-square', name: '4K Square', slug: '4k-square', platform: '4K Master', aspect: '1:1', width: 2160, height: 2160, fps: 30, quality: 'high', description: '2160×2160 · 4K square' },
];

const PLATFORM_ORDER = ['YouTube', 'Instagram', 'TikTok', 'Facebook', 'X', 'LinkedIn', 'Pinterest', 'Snapchat', 'Sizes', '4K Master'];
const GROUP_LABELS: Record<string, string> = { Sizes: 'Sizes & drafts', '4K Master': '4K masters' };

export type FormatGroup = { platform: string; label: string; presets: FormatPreset[] };

/** Presets grouped the way people publish: one section per social platform. */
export const FORMAT_GROUPS: FormatGroup[] = PLATFORM_ORDER
  .map(platform => ({
    platform,
    label: GROUP_LABELS[platform] ?? platform,
    presets: FORMAT_PRESETS.filter(preset => preset.platform === platform),
  }))
  .filter(group => group.presets.length > 0);

export type FormatFilter = { id: string; label: string };

/**
 * The picker's chips: everything, the social platforms, the plain size ladder
 * (320 → 4K), or one platform on its own.
 */
export const FORMAT_FILTERS: FormatFilter[] = [
  { id: 'all', label: 'All' },
  { id: 'social', label: 'Social' },
  { id: 'sizes', label: 'Sizes' },
  ...PLATFORM_ORDER
    .filter(platform => platform !== 'Sizes')
    .map(platform => ({ id: platform, label: platform === '4K Master' ? '4K' : platform })),
];

export function filterFormatGroups(filter: string): FormatGroup[] {
  if (filter === 'all') return FORMAT_GROUPS;
  if (filter === 'social') return FORMAT_GROUPS.filter(group => group.platform !== 'Sizes');
  if (filter === 'sizes') return FORMAT_GROUPS.filter(group => group.platform === 'Sizes');
  return FORMAT_GROUPS.filter(group => group.platform === filter);
}

export const formatPreset = (id: string) => FORMAT_PRESETS.find(preset => preset.id === id);
export const formatSize = (format?: FormatVariant | null) => format ? { width: format.width, height: format.height } : { width: 1920, height: 1080 };

/** A short, filesystem-safe label for a format, e.g. `insta-story`. */
export function formatSlug(format: { name: string; presetId?: string | null }): string {
  const base = (format.presetId ? formatPreset(format.presetId)?.slug : undefined) ?? format.name;
  const slug = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  return slug || 'format';
}

/** Two-letter platform codes keep combined file names short. */
const PLATFORM_CODES: Record<string, { code: string; label: string }> = {
  YouTube: { code: 'yt', label: 'YouTube' },
  Instagram: { code: 'ig', label: 'Instagram' },
  TikTok: { code: 'tt', label: 'TikTok' },
  Facebook: { code: 'fb', label: 'Facebook' },
  X: { code: 'x', label: 'X' },
  LinkedIn: { code: 'li', label: 'LinkedIn' },
  Pinterest: { code: 'pin', label: 'Pinterest' },
  Snapchat: { code: 'sc', label: 'Snapchat' },
  Sizes: { code: 'size', label: 'Size' },
  '4K Master': { code: '4k', label: '4K' },
};

export type DeliverableLike = Pick<FormatVariant, 'name' | 'width' | 'height' | 'fps' | 'quality'> & {
  presetId?: string | null;
  platform?: string;
  overrides?: FormatVariant['overrides'];
};

export type FormatOutputGroup<T extends DeliverableLike = DeliverableLike> = {
  /** Encoding signature: two formats with the same key render identical pixels. */
  key: string;
  formats: T[];
  width: number;
  height: number;
  fps: number;
  quality: FormatQuality;
  /** Human summary, one entry per platform, e.g. `Instagram, TikTok`. */
  label: string;
  /** Compact filename summary, e.g. `ig-tt`. */
  slug: string;
};

/**
 * The pixels depend only on size, frame rate, quality and per-scene framing.
 * Grouping on that signature lets one encode serve several social formats and
 * keeps the filename honest about every platform it covers.
 */
export function formatOutputKey(format: DeliverableLike): string {
  const overrides = Object.keys(format.overrides ?? {}).sort().map(sceneId => {
    const override = format.overrides?.[sceneId] ?? {};
    return [sceneId, override.imageX ?? '', override.imageY ?? '', override.imageZoom ?? '', override.fit ?? '', override.framingBackground ?? ''].join('=');
  }).join('|');
  return [format.width, format.height, format.fps, format.quality, overrides].join('/');
}

/**
 * One token per platform, not per format: six vertical social formats collapse
 * to `yt_ig_tt_fb_sc`, which keeps the combined file name readable.
 */
function deliveryTokens(formats: DeliverableLike[]) {
  const codes: string[] = [];
  const labels: string[] = [];
  for (const format of formats) {
    const platform = format.platform ? PLATFORM_CODES[format.platform] : undefined;
    const code = platform?.code ?? formatSlug(format);
    if (codes.includes(code)) continue;
    codes.push(code);
    labels.push(platform?.label ?? format.name);
  }
  return { slug: codes.join('-'), label: labels.join(', ') };
}

export function groupFormatsByOutput<T extends DeliverableLike>(formats: T[]): FormatOutputGroup<T>[] {
  const groups = new Map<string, FormatOutputGroup<T>>();
  for (const format of formats) {
    const key = formatOutputKey(format);
    const existing = groups.get(key);
    if (existing) existing.formats.push(format);
    else groups.set(key, {
      key,
      formats: [format],
      width: format.width,
      height: format.height,
      fps: format.fps,
      quality: format.quality,
      label: format.name,
      slug: formatSlug(format),
    });
  }
  return [...groups.values()].map(group => ({ ...group, ...deliveryTokens(group.formats) }));
}

export function createFormat(id: string, existing: FormatVariant[]): FormatVariant {
  const preset = formatPreset(id) ?? FORMAT_PRESETS[0];
  const duplicate = existing.filter(format => format.presetId === preset.id).length;
  return {
    id: crypto.randomUUID(),
    name: duplicate ? `${preset.name} ${duplicate + 1}` : preset.name,
    platform: preset.platform,
    aspect: preset.aspect,
    width: preset.width,
    height: preset.height,
    fps: preset.fps,
    quality: preset.quality,
    presetId: preset.id,
    overrides: Object.fromEntries(existing.flatMap(format => Object.entries(format.overrides))),
  };
}

export function createCustomFormat(name: string, width: number, height: number, fps: number, quality: FormatQuality, existing: FormatVariant[]): FormatVariant {
  return {
    id: crypto.randomUUID(),
    name: name.trim() || 'Custom format',
    platform: 'Custom',
    aspect: ratioLabel(width, height),
    width,
    height,
    fps,
    quality,
    overrides: Object.fromEntries(existing.flatMap(format => Object.entries(format.overrides))),
  };
}

export function ratioLabel(width: number, height: number) {
  const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
  const divisor = gcd(width, height) || 1;
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

export function resolveSceneForFormat(scene: Scene, format: FormatVariant | undefined): Scene {
  const override = format?.overrides[scene.id];
  if (!override) return scene;
  return {
    ...scene,
    ...(override.imageX !== undefined ? { imageX: override.imageX } : {}),
    ...(override.imageY !== undefined ? { imageY: override.imageY } : {}),
    ...(override.imageZoom !== undefined ? { imageZoom: override.imageZoom } : {}),
    ...(override.fit !== undefined ? { fit: override.fit } : {}),
    ...(override.framingBackground !== undefined ? { framingBackground: override.framingBackground } : {}),
  };
}

export function resolveScenesForFormat(scenes: Scene[], format: FormatVariant | undefined): Scene[] {
  return scenes.map(scene => resolveSceneForFormat(scene, format));
}
