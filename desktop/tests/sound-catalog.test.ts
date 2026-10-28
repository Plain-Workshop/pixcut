import { describe, expect, it } from 'vitest';
import { SOUND_CATALOG, SOUND_CATEGORIES, createSoundClip, groupedSounds, soundData, soundSpec } from '../src/components/elements/sound-catalog';
import { emptyProject, edit, validateProject, type Scene } from '../src/stores/model';

const scene: Scene = { id: 's', name: 'Scene', image: 'data:image/png;base64,AA==', startTicks: 0, sourceInTicks: 0, durationTicks: 120, title: '', subtitle: '', color: '#FFFFFF', fit: 'cover' };

function pcm(data: string) {
  const bytes = Uint8Array.from(atob(data.split(',')[1]), character => character.charCodeAt(0));
  return { bytes, view: new DataView(bytes.buffer), frames: (bytes.length - 44) / 2 };
}

/** One render per effect shared by both heavy tests; CI runners are slow. */
const rendered = new Map<string, { bytes: Uint8Array; view: DataView; frames: number; samples: Float32Array }>();
function renderedSound(id: string) {
  const cached = rendered.get(id);
  if (cached) return cached;
  const { bytes, view, frames } = pcm(soundData(id));
  const samples = new Float32Array(frames);
  for (let index = 0; index < frames; index++) samples[index] = view.getInt16(44 + index * 2, true) / 32768;
  const entry = { bytes, view, frames, samples };
  rendered.set(id, entry);
  return entry;
}

/** Coarse perceptual fingerprint: 16 log-spaced bands, 8 envelope steps, brightness and length. */
const RATE = 22050, WINDOW = 256, BANDS = 16;
const cos = new Float32Array(WINDOW * WINDOW / 2), sin = new Float32Array(WINDOW * WINDOW / 2);
for (let k = 0; k < WINDOW / 2; k++) for (let n = 0; n < WINDOW; n++) {
  cos[k * WINDOW + n] = Math.cos(2 * Math.PI * k * n / WINDOW);
  sin[k * WINDOW + n] = Math.sin(2 * Math.PI * k * n / WINDOW);
}
const edges = Array.from({ length: BANDS + 1 }, (_, index) => 60 * Math.pow(10000 / 60, index / BANDS));

function fingerprint(samples: Float32Array) {
  const bands = new Array(BANDS).fill(0);
  for (const position of [.18, .42, .68]) {
    if (samples.length < WINDOW) break;
    const start = Math.max(0, Math.min(samples.length - WINDOW, Math.floor(samples.length * position) - WINDOW / 2));
    const power = new Float32Array(BANDS);
    for (let k = 1; k < WINDOW / 2; k++) {
      let real = 0, imaginary = 0;
      for (let n = 0; n < WINDOW; n++) {
        const sample = samples[start + n] * (.5 - .5 * Math.cos(2 * Math.PI * n / (WINDOW - 1)));
        real += sample * cos[k * WINDOW + n];
        imaginary -= sample * sin[k * WINDOW + n];
      }
      const hz = k * RATE / WINDOW, magnitude = Math.hypot(real, imaginary);
      for (let band = 0; band < BANDS; band++) if (hz >= edges[band] && hz < edges[band + 1]) { power[band] += magnitude; break; }
    }
    const total = power.reduce((sum, value) => sum + value, 0);
    for (let band = 0; band < BANDS; band++) bands[band] += total > 0 ? power[band] / total : 0;
  }
  for (let band = 0; band < BANDS; band++) bands[band] /= 3;

  const envelope: number[] = [];
  for (let step = 0; step < 8; step++) {
    const from = Math.floor(samples.length * step / 8), to = Math.floor(samples.length * (step + 1) / 8);
    let sum = 0;
    for (let index = from; index < to; index++) sum += samples[index] * samples[index];
    envelope.push(Math.sqrt(sum / Math.max(1, to - from)));
  }
  const loudest = Math.max(...envelope, 1e-6);
  for (let step = 0; step < envelope.length; step++) envelope[step] /= loudest;

  let crossings = 0;
  for (let index = 1; index < samples.length; index++) if ((samples[index - 1] < 0) !== (samples[index] < 0)) crossings++;
  return { bands, envelope, brightness: crossings / Math.max(1, samples.length), seconds: samples.length / RATE };
}

function distance(a: ReturnType<typeof fingerprint>, b: ReturnType<typeof fingerprint>) {
  let sum = 0;
  for (let band = 0; band < BANDS; band++) sum += (a.bands[band] - b.bands[band]) ** 2;
  for (let step = 0; step < 8; step++) sum += .8 * (a.envelope[step] - b.envelope[step]) ** 2;
  sum += 1.5 * (a.brightness - b.brightness) ** 2;
  sum += .6 * (Math.log(a.seconds) - Math.log(b.seconds)) ** 2;
  return Math.sqrt(sum);
}

describe('grouped sound library', () => {
  it('ships 300 unique effects with every category evenly filled', () => {
    expect(SOUND_CATALOG).toHaveLength(300);
    expect(new Set(SOUND_CATALOG.map(effect => effect.id)).size).toBe(300);
    for (const effect of SOUND_CATALOG) {
      expect(effect.label.trim(), effect.id).not.toBe('');
      expect(effect.seconds, effect.id).toBeGreaterThanOrEqual(.05);
      expect(effect.seconds, effect.id).toBeLessThanOrEqual(30);
    }
    for (const category of SOUND_CATEGORIES) expect(SOUND_CATALOG.filter(effect => effect.category === category.id), category.id).toHaveLength(30);
  });

  it('renders distinct, audible, click-free WAV data for every effect', { timeout: 30_000 }, () => {
    const fingerprints = new Set<string>();
    for (const effect of SOUND_CATALOG) {
      const data = soundData(effect.id);
      expect(soundData(effect.id), effect.id).toBe(data);
      const { bytes, view, frames } = renderedSound(effect.id);
      expect(new TextDecoder().decode(bytes.slice(0, 4)), effect.id).toBe('RIFF');
      expect(view.getUint32(24, true), effect.id).toBe(22050);
      expect(frames / 22050, effect.id).toBeCloseTo(effect.seconds, 3);
      let peak = 0, active = 0, hash = 2166136261;
      for (let index = 44; index < bytes.length; index += 2) {
        const sample = view.getInt16(index, true), level = Math.abs(sample);
        peak = Math.max(peak, level);
        if (level > 100) active++;
        hash = Math.imul(hash ^ sample, 16777619);
      }
      expect(peak, effect.id).toBeGreaterThan(1000);
      expect(active, effect.id).toBeGreaterThan(200);
      expect(Math.abs(view.getInt16(bytes.length - 2, true)), effect.id).toBeLessThan(300);
      fingerprints.add(`${bytes.length}:${hash >>> 0}`);
    }
    expect(fingerprints.size).toBe(SOUND_CATALOG.length);
  });

  it('keeps every pair acoustically distinct — no near-duplicate effects', { timeout: 30_000 }, () => {
    const features = SOUND_CATALOG.map(effect => ({ id: effect.id, feature: fingerprint(renderedSound(effect.id).samples) }));
    let closest = { distance: Infinity, pair: '' };
    for (let first = 0; first < features.length; first++) for (let second = first + 1; second < features.length; second++) {
      const value = distance(features[first].feature, features[second].feature);
      if (value < closest.distance) closest = { distance: value, pair: `${features[first].id} ↔ ${features[second].id}` };
    }
    expect(closest.distance, `closest pair ${closest.pair}`).toBeGreaterThan(.12);
  });

  it('groups and searches without losing the catalog order', () => {
    const all = groupedSounds('');
    expect(all.map(group => group.id)).toEqual(SOUND_CATEGORIES.map(category => category.id));
    expect(all.reduce((total, group) => total + group.count, 0)).toBe(300);
    expect(all[0].sounds).toEqual(SOUND_CATALOG.filter(effect => effect.category === all[0].id));

    const bells = groupedSounds('BELL');
    expect(bells.length).toBeGreaterThan(0);
    expect(bells.every(group => group.sounds.length > 0)).toBe(true);
    expect(bells.flatMap(group => group.sounds).every(effect => effect.label.toLowerCase().includes('bell') || effect.id.includes('bell'))).toBe(true);
    expect(groupedSounds('no such sound at all')).toHaveLength(0);
  });

  it('adds a catalog sound to a project through the shared model', () => {
    let project = edit(emptyProject(), { type: 'add', scenes: [scene] });
    const clip = createSoundClip(project, 'thunder', 20)!;
    expect(clip.name).toBe(soundSpec('thunder')!.label);
    expect(clip.sourceDurationSeconds).toBe(soundSpec('thunder')!.seconds);
    project = edit(project, { type: 'audio', audio: [clip] });
    expect(validateProject(project).audio).toHaveLength(1);
    expect(createSoundClip(project, 'not-a-sound', 0)).toBeNull();
    expect(createSoundClip(emptyProject(), 'thunder', 0)).toBeNull();
  });
});
