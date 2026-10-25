import type { FormatQuality, FormatVariant, Scene } from './model';

export type FormatPreset = {
  id: string;
  name: string;
  platform: string;
  aspect: string;
  width: number;
  height: number;
  fps: number;
  quality: FormatQuality;
  description: string;
};

export const FORMAT_PRESETS: FormatPreset[] = [
  { id: 'youtube-video', name: 'YouTube Video', platform: 'YouTube', aspect: '16:9', width: 1920, height: 1080, fps: 30, quality: 'standard', description: '1920×1080 · 16:9' },
  { id: 'youtube-shorts', name: 'YouTube Shorts', platform: 'YouTube', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'instagram-post', name: 'Instagram Post', platform: 'Instagram', aspect: '4:5', width: 1080, height: 1350, fps: 30, quality: 'standard', description: '1080×1350 · 4:5' },
  { id: 'instagram-reels', name: 'Instagram Reels', platform: 'Instagram', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'instagram-story', name: 'Instagram Story', platform: 'Instagram', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'tiktok', name: 'TikTok', platform: 'TikTok', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'facebook-post', name: 'Facebook Post', platform: 'Facebook', aspect: '4:5', width: 1080, height: 1350, fps: 30, quality: 'standard', description: '1080×1350 · 4:5' },
  { id: 'facebook-reels', name: 'Facebook Reels', platform: 'Facebook', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: 'x-video', name: 'X / Twitter', platform: 'X', aspect: '16:9', width: 1920, height: 1080, fps: 30, quality: 'standard', description: '1920×1080 · 16:9' },
  { id: 'linkedin', name: 'LinkedIn', platform: 'LinkedIn', aspect: '1:1', width: 1080, height: 1080, fps: 30, quality: 'standard', description: '1080×1080 · 1:1' },
  { id: 'pinterest', name: 'Pinterest', platform: 'Pinterest', aspect: '2:3', width: 1000, height: 1500, fps: 30, quality: 'standard', description: '1000×1500 · 2:3' },
  { id: 'snapchat', name: 'Snapchat', platform: 'Snapchat', aspect: '9:16', width: 1080, height: 1920, fps: 30, quality: 'standard', description: '1080×1920 · 9:16' },
  { id: '4k-landscape', name: '4K Landscape', platform: '4K Master', aspect: '16:9', width: 3840, height: 2160, fps: 30, quality: 'high', description: '3840×2160 · 4K UHD' },
  { id: '4k-vertical', name: '4K Vertical', platform: '4K Master', aspect: '9:16', width: 2160, height: 3840, fps: 30, quality: 'high', description: '2160×3840 · 4K vertical' },
  { id: '4k-square', name: '4K Square', platform: '4K Master', aspect: '1:1', width: 2160, height: 2160, fps: 30, quality: 'high', description: '2160×2160 · 4K square' },
];

export const formatPreset = (id: string) => FORMAT_PRESETS.find(preset => preset.id === id);
export const formatSize = (format?: FormatVariant | null) => format ? { width: format.width, height: format.height } : { width: 1920, height: 1080 };

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
