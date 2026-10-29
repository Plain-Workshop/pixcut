import { secondsToTicks, ticksToSeconds, totalTicks, type AudioClip, type Project } from './model';

/**
 * Recorded sound effects bundled in `public/sounds/`. Only licences that allow
 * commercial use *and* redistribution of the file itself are accepted, because
 * PixCut ships these files. CC0 needs no credit; CC BY needs the author credited
 * wherever the video is published. Anything else (NC, ND, “free to use but not
 * redistributable” site licences) is rejected by `scripts/import-sounds.mjs`
 * and by `tests/sound-library.test.ts`.
 */
export const SOUND_LICENSES = ['CC0 1.0', 'CC BY 4.0'] as const;
export type SoundLicense = typeof SOUND_LICENSES[number];

export type RecordedSound = {
  id: string; label: string; category: string; seconds: number; file: string;
  license: SoundLicense; author: string; source: string;
  /** Free-text search terms, e.g. "applause crowd clap". */
  tags?: string[];
};

export const RECORDED_SOUND_CATEGORIES = ['Crowd & voices', 'Comedy & memes', 'Cinematic', 'Foley', 'Ambience', 'Interface', 'Transitions'] as const;

/** Largest accepted clip. Longer beds belong in the music library. */
export const RECORDED_SOUND_MAX_SECONDS = 12;

/** Returns a problem description, or null when the entry is acceptable. */
export function soundEntryProblem(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return 'Entry is not an object.';
  const sound = entry as Partial<RecordedSound>;
  for (const key of ['id', 'label', 'category', 'file', 'author', 'source'] as const) {
    if (typeof sound[key] !== 'string' || !sound[key]!.trim()) return `“${key}” is required.`;
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sound.id!)) return `“${sound.id}” is not a kebab-case id.`;
  if (!SOUND_LICENSES.includes(sound.license as SoundLicense)) return `“${sound.id}” has licence “${String(sound.license)}”, which PixCut cannot redistribute.`;
  if (!(RECORDED_SOUND_CATEGORIES as readonly string[]).includes(sound.category!)) return `“${sound.id}” has unknown category “${sound.category}”.`;
  if (typeof sound.seconds !== 'number' || !(sound.seconds > 0) || sound.seconds > RECORDED_SOUND_MAX_SECONDS) return `“${sound.id}” must be between 0 and ${RECORDED_SOUND_MAX_SECONDS} seconds.`;
  if (!/^sounds\/[a-z0-9-]+\.m4a$/.test(sound.file!)) return `“${sound.id}” file must be sounds/<name>.m4a.`;
  if (!/^https:\/\//.test(sound.source!)) return `“${sound.id}” needs an https source URL.`;
  if (sound.tags !== undefined && (!Array.isArray(sound.tags) || sound.tags.some(tag => typeof tag !== 'string'))) return `“${sound.id}” tags must be strings.`;
  return null;
}

/** Keeps valid entries and drops the rest, so a bad manifest never breaks the editor. */
export function parseSoundManifest(value: unknown): RecordedSound[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((entry): entry is RecordedSound => {
    if (soundEntryProblem(entry) || seen.has((entry as RecordedSound).id)) return false;
    seen.add((entry as RecordedSound).id);
    return true;
  });
}

export const soundNeedsCredit = (sound: RecordedSound) => sound.license !== 'CC0 1.0';

export function recordedSoundCredit(sound: RecordedSound): string {
  return `“${sound.label}” by ${sound.author} – licensed under ${sound.license} (${sound.source})`;
}

/** CC0 clips keep their plain label; CC BY clips carry the author so credits can be found again. */
export const recordedSoundClipName = (sound: RecordedSound) => soundNeedsCredit(sound) ? `${sound.label} · ${sound.author}` : sound.label;

export function creditForRecordedClip(name: string, library: RecordedSound[]): string | null {
  const sound = library.find(item => soundNeedsCredit(item) && recordedSoundClipName(item) === name);
  return sound ? recordedSoundCredit(sound) : null;
}

export function searchRecordedSounds(library: RecordedSound[], query = ''): { category: string; sounds: RecordedSound[] }[] {
  const needle = query.trim().toLowerCase();
  return RECORDED_SOUND_CATEGORIES.map(category => ({
    category,
    sounds: library.filter(sound => sound.category === category && (!needle || sound.label.toLowerCase().includes(needle) || (sound.tags ?? []).some(tag => tag.toLowerCase().includes(needle)))),
  })).filter(group => group.sounds.length > 0);
}

export function createRecordedSoundClip(project: Project, sound: RecordedSound, data: string, startTicks: number): AudioClip | null {
  const total = totalTicks(project);
  if (!total) return null;
  const start = Math.round(Math.min(total - 1, Math.max(0, startTicks)));
  const durationTicks = Math.min(total - start, Math.max(1, secondsToTicks(sound.seconds, project.timebase)));
  const lane = Array.from({ length: 8 }, (_, i) => i).find(i => !project.audio.some(clip => (clip.lane ?? 0) === i && clip.startTicks < start + durationTicks && clip.startTicks + clip.durationTicks > start));
  return { id: crypto.randomUUID(), name: recordedSoundClipName(sound), data, lane: lane ?? 7, startTicks: start, durationTicks, sourceInSeconds: 0, sourceDurationSeconds: sound.seconds, volume: .7, fadeIn: 0, fadeOut: Math.min(.03, ticksToSeconds(durationTicks, project.timebase) / 4) };
}

const base = () => import.meta.env?.BASE_URL ?? '/';
let manifest: Promise<RecordedSound[]> | null = null;
/** Loads `sounds/manifest.json`. Missing or malformed manifests yield an empty library. */
export function loadRecordedSounds(): Promise<RecordedSound[]> {
  manifest ??= fetch(`${base()}sounds/manifest.json`).then(response => response.ok ? response.json() : []).then(parseSoundManifest).catch(() => []);
  return manifest;
}

const data = new Map<string, Promise<string>>();
export const recordedSoundUrl = (sound: RecordedSound) => `${base()}${sound.file}`;

/** A data URL for the clip, cached per sound. WebKit will not decode audio straight from `tauri://`, so a blob is read first. */
export function recordedSoundData(sound: RecordedSound): Promise<string> {
  const existing = data.get(sound.id);
  if (existing) return existing;
  const task = fetch(recordedSoundUrl(sound)).then(async response => {
    if (!response.ok) throw new Error('This bundled sound could not be opened. Reinstall PixCut or import another audio file.');
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:[^;,]*/, 'data:audio/mp4'));
      reader.onerror = () => reject(new Error('This bundled sound could not be read.'));
      reader.readAsDataURL(blob);
    });
  }).catch(error => { data.delete(sound.id); throw error; });
  data.set(sound.id, task);
  return task;
}
