import type { AudioClip, Project } from '../../stores/model';
import { SOUND_CATALOG, createSoundClip, soundData } from './sound-catalog';

/**
 * The short list offered inside the element inspector. The full grouped library
 * lives in `sound-catalog.ts` and powers the Sounds tab in the left sidebar.
 */
export type SoundEffectId = 'bell' | 'click' | 'pop' | 'whoosh' | 'success' | 'shutter';
const INSPECTOR_SOUNDS: SoundEffectId[] = ['bell', 'click', 'pop', 'whoosh', 'success', 'shutter'];
export const SOUND_EFFECTS: { id: SoundEffectId; label: string; seconds: number }[] = INSPECTOR_SOUNDS.map(id => {
  const spec = SOUND_CATALOG.find(sound => sound.id === id);
  if (!spec) throw new Error(`Missing bundled sound effect “${id}”.`);
  return { id, label: spec.label, seconds: spec.seconds };
});

/** Deterministic local PCM effects; the same WAV goes to preview and FFmpeg. */
export function soundEffectData(id: SoundEffectId): string {
  return soundData(id);
}

export function createSoundEffectClip(project: Project, id: SoundEffectId, startTicks: number): AudioClip | null {
  return createSoundClip(project, id, startTicks);
}
