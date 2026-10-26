import type { Project, Scene } from './model';

export type Preferences = {
  defaultAspect: Project['aspect'];
  defaultSceneSeconds: number;
  defaultFit: Scene['fit'];
  autosaveMs: number;
  snapping: boolean;
  compact: boolean;
  reduceMotion: boolean;
  showHints: boolean;
  automaticUpdates: boolean;
  theme: 'dark' | 'light';
};

const KEY = 'pixcut-preferences';

export const DEFAULT_PREFERENCES: Preferences = {
  defaultAspect: '16:9',
  defaultSceneSeconds: 4,
  defaultFit: 'cover',
  autosaveMs: 700,
  snapping: true,
  compact: false,
  reduceMotion: false,
  showHints: false,
  automaticUpdates: true,
  theme: 'dark',
};

export function loadPreferences(): Preferences {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Preferences>;
    const aspect = ['16:9', '9:16', '1:1', '4:5'].includes(stored.defaultAspect ?? '') ? stored.defaultAspect as Project['aspect'] : DEFAULT_PREFERENCES.defaultAspect;
    const fit = ['cover', 'contain', 'blur'].includes(stored.defaultFit ?? '') ? stored.defaultFit as Scene['fit'] : DEFAULT_PREFERENCES.defaultFit;
    const seconds = typeof stored.defaultSceneSeconds === 'number' && stored.defaultSceneSeconds >= 1 && stored.defaultSceneSeconds <= 10 ? stored.defaultSceneSeconds : DEFAULT_PREFERENCES.defaultSceneSeconds;
    const autosave = typeof stored.autosaveMs === 'number' && stored.autosaveMs >= 300 && stored.autosaveMs <= 5000 ? stored.autosaveMs : DEFAULT_PREFERENCES.autosaveMs;
    return {
      defaultAspect: aspect,
      defaultSceneSeconds: seconds,
      defaultFit: fit,
      autosaveMs: autosave,
      snapping: typeof stored.snapping === 'boolean' ? stored.snapping : DEFAULT_PREFERENCES.snapping,
      compact: typeof stored.compact === 'boolean' ? stored.compact : DEFAULT_PREFERENCES.compact,
      reduceMotion: typeof stored.reduceMotion === 'boolean' ? stored.reduceMotion : DEFAULT_PREFERENCES.reduceMotion,
      showHints: typeof stored.showHints === 'boolean' ? stored.showHints : DEFAULT_PREFERENCES.showHints,
      automaticUpdates: typeof stored.automaticUpdates === 'boolean' ? stored.automaticUpdates : true,
      theme: stored.theme === 'light' ? 'light' : 'dark',
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences: Preferences) {
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* preferences are optional */ }
}
