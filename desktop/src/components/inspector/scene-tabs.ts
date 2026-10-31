import type { Scene, ScenePatchKey } from '../../stores/model';

export type SceneTab = 'video' | 'transition' | 'color' | 'speed' | 'fade' | 'filters';

const COLOR_NUMBERS = { brightness: 1, contrast: 1, saturation: 1, exposure: 0, highlights: 0, shadows: 0, temperature: 0, tint: 0, hue: 0, vibrance: 0 } as const;

/** What each tab resets to. Speed is handled by the form because it also resizes the clip. */
export const TAB_DEFAULTS: Record<Exclude<SceneTab, 'speed'>, Partial<Scene>> = {
  video: { imageX: 0, imageY: 0, imageZoom: 1, framingBackground: '#000000', motion: 'none', motionAmount: undefined, framingKeyframes: undefined },
  transition: { transition: null },
  color: { ...COLOR_NUMBERS, shadowTintColor: '#000000', shadowTintAmount: 0, highlightTintColor: '#000000', highlightTintAmount: 0, curves: undefined },
  fade: { fadeIn: 0, fadeOut: 0 },
  filters: { filter: 'none', filterIntensity: 100 },
};

/**
 * Fields "Apply to all clips" copies. Framing shares the mode, zoom, background
 * and camera movement but not the position or keyframes, which belong to one photo.
 */
export const APPLY_ALL_KEYS: Partial<Record<SceneTab, ScenePatchKey[]>> = {
  video: ['fit', 'imageZoom', 'framingBackground', 'motion', 'motionAmount'],
  transition: ['transition'],
  color: [...Object.keys(COLOR_NUMBERS) as ScenePatchKey[], 'shadowTintColor', 'shadowTintAmount', 'highlightTintColor', 'highlightTintAmount', 'curves'],
  fade: ['fadeIn', 'fadeOut'],
  filters: ['filter', 'filterIntensity'],
};

export const TAB_RESET_KEYS = Object.fromEntries(Object.entries(TAB_DEFAULTS).map(([tab, defaults]) => [tab, Object.keys(defaults) as ScenePatchKey[]])) as Record<Exclude<SceneTab, 'speed'>, ScenePatchKey[]>;

/** True when the tab holds anything other than its defaults, for the dot on its icon. */
export function tabChanged(tab: SceneTab, scene: Scene): boolean {
  switch (tab) {
    case 'video': return (scene.imageZoom ?? 1) !== 1 || Boolean(scene.imageX) || Boolean(scene.imageY) || (scene.motion ?? 'none') !== 'none' || Boolean(scene.framingKeyframes?.length);
    case 'transition': return Boolean(scene.transition);
    case 'color': return Object.entries(COLOR_NUMBERS).some(([key, value]) => (scene[key as keyof typeof COLOR_NUMBERS] ?? value) !== value)
      || Boolean(scene.shadowTintAmount) || Boolean(scene.highlightTintAmount) || Boolean(scene.curves);
    case 'speed': return (scene.speed ?? 1) !== 1 || (scene.speedEnd !== undefined && scene.speedEnd !== (scene.speed ?? 1)) || Boolean(scene.reverse);
    case 'fade': return Boolean(scene.fadeIn) || Boolean(scene.fadeOut);
    case 'filters': return Boolean(scene.filter && scene.filter !== 'none');
  }
}

/**
 * The values "Apply to all clips" writes. Unset fields fall back to the tab's
 * defaults so clearing a value on this clip clears it on the others too.
 */
export function applyAllValues(tab: SceneTab, scene: Scene): Partial<Scene> {
  const keys = APPLY_ALL_KEYS[tab];
  if (!keys) return {};
  const defaults: Partial<Scene> = tab === 'speed' ? {} : TAB_DEFAULTS[tab];
  const source = scene as unknown as Record<string, unknown>, fallback = defaults as Record<string, unknown>;
  return Object.fromEntries(keys.map(key => [key, source[key] ?? fallback[key]])) as Partial<Scene>;
}
