import { maxSceneTicks, minTicks, secondsToTicks, ticksToSeconds, type Scene, type Timebase } from '../../stores/model';

export type BeatAnalysis = {
  /** Beat times in seconds from the start of the audio file. */
  beats: number[];
  /** Estimated tempo, or 0 when the pulse is too irregular. */
  bpm: number;
  /** 0–1; a rough regularity score used only for display. */
  confidence: number;
};

const MIN_BEAT_GAP = .18;
const MAX_ANALYSIS_SECONDS = 900;

/**
 * Energy-novelty beat tracker. It is intentionally simple and deterministic:
 * frame RMS, positive energy change, a standard-deviation threshold, and a
 * minimum gap. Good enough to snap photo-story cuts without a model or network.
 */
export function detectBeatsFromSamples(samples: Float32Array, sampleRate: number): BeatAnalysis {
  if (!samples.length || !Number.isFinite(sampleRate) || sampleRate <= 0) return { beats: [], bpm: 0, confidence: 0 };
  const frame = Math.max(64, Math.round(sampleRate * .04));
  const hop = Math.max(32, Math.round(sampleRate * .02));
  const energy: number[] = [];
  for (let start = 0; start + frame <= samples.length; start += hop) {
    let sum = 0;
    for (let index = start; index < start + frame; index += 1) {
      const value = samples[index];
      sum += value * value;
    }
    energy.push(Math.sqrt(sum / frame));
  }
  if (energy.length < 3) return { beats: [], bpm: 0, confidence: 0 };
  const novelty = energy.map((value, index) => index === 0 ? 0 : Math.max(0, value - energy[index - 1]));
  const smooth = novelty.map((value, index) => (novelty[index - 1] ?? 0) * .25 + value * .5 + (novelty[index + 1] ?? 0) * .25);
  const mean = smooth.reduce((sum, value) => sum + value, 0) / smooth.length;
  const variance = smooth.reduce((sum, value) => sum + (value - mean) ** 2, 0) / smooth.length;
  const threshold = Math.max(1e-5, mean + Math.sqrt(variance) * 1.1);
  const beats: number[] = [];
  let last = Number.NEGATIVE_INFINITY;
  for (let index = 2; index < smooth.length - 1; index += 1) {
    const value = smooth[index];
    if (value < threshold || value < smooth[index - 1] || value < smooth[index + 1]) continue;
    const seconds = (index * hop + frame / 2) / sampleRate;
    if (seconds - last < MIN_BEAT_GAP) continue;
    beats.push(seconds);
    last = seconds;
  }
  const intervals = beats.slice(1).map((beat, index) => beat - beats[index]).filter(interval => interval >= .25 && interval <= 2);
  if (!intervals.length) return { beats, bpm: 0, confidence: 0 };
  intervals.sort((a, b) => a - b);
  const median = intervals[Math.floor(intervals.length / 2)];
  let bpm = 60 / median;
  while (bpm > 180) bpm /= 2;
  while (bpm < 60) bpm *= 2;
  return { beats, bpm: Math.round(bpm), confidence: Math.min(1, intervals.length / 8) };
}

/** Decodes a local audio data URL and finds its pulse. Never throws. */
export async function detectBeats(data: string): Promise<BeatAnalysis | null> {
  if (!data.startsWith('data:audio/') || typeof OfflineAudioContext === 'undefined' || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(data);
    const bytes = await response.arrayBuffer();
    const context = new OfflineAudioContext(1, 1, 8000);
    const buffer = await context.decodeAudioData(bytes);
    const length = Math.min(buffer.length, Math.floor(buffer.sampleRate * MAX_ANALYSIS_SECONDS));
    if (length < 1) return null;
    const mono = new Float32Array(length);
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const source = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) mono[index] += source[index] / buffer.numberOfChannels;
    }
    return detectBeatsFromSamples(mono, buffer.sampleRate);
  } catch {
    return null;
  }
}

/** Converts detected source beats to sorted project markers, bounded to the timeline. */
export function beatMarkerTicks(beats: number[], startTicks: number, timebase: Timebase, totalTicks: number, limit = 500): number[] {
  const markers: number[] = [];
  for (const beat of [...beats].sort((a, b) => a - b)) {
    if (!Number.isFinite(beat)) continue;
    const tick = Math.round(startTicks + secondsToTicks(beat, timebase));
    if (tick < 0 || tick > totalTicks) continue;
    if (markers.length && tick - markers[markers.length - 1] < 2) continue;
    markers.push(tick);
    if (markers.length >= limit) break;
  }
  return markers;
}

/**
 * Moves each cut between photo scenes to the nearest beat when it is close
 * enough. `beats` are seconds from the audio clip's source start; scene count,
 * order, text, effects and the final scene's end stay put; only the cut
 * boundaries move, and each moved boundary is one undoable edit.
 */
export function snapScenesToBeats(scenes: Scene[], beats: number[], startSeconds: number, timebase: Timebase, tolerance = .35): { scenes: Scene[]; moved: number } {
  const sorted = [...new Set(beats.filter(beat => Number.isFinite(beat) && beat >= 0))].sort((a, b) => a - b);
  const result = scenes.map(scene => ({ ...scene }));
  if (!sorted.length || result.length < 2) return { scenes: result, moved: 0 };
  const offsetSeconds = Math.max(0, Number.isFinite(startSeconds) ? startSeconds : 0);
  const minimum = minTicks(timebase);
  let offset = 0;
  let moved = 0;
  for (let index = 0; index < result.length - 1; index += 1) {
    const scene = result[index];
    const currentEnd = ticksToSeconds(offset + scene.durationTicks, timebase);
    let target: number | null = null;
    let closest = Number.POSITIVE_INFINITY;
    for (const beat of sorted) {
      const absolute = offsetSeconds + beat;
      const distance = Math.abs(absolute - currentEnd);
      if (distance < closest) { closest = distance; target = absolute; }
    }
    if (target !== null && closest <= tolerance) {
      const duration = secondsToTicks(target, timebase) - offset;
      if (duration >= minimum && duration <= maxSceneTicks(scene, timebase) && duration !== scene.durationTicks) {
        scene.durationTicks = duration;
        const seconds = ticksToSeconds(duration, timebase);
        scene.fadeIn = Math.min(scene.fadeIn ?? 0, seconds);
        scene.fadeOut = Math.min(scene.fadeOut ?? 0, seconds);
        moved += 1;
      }
    }
    offset += scene.durationTicks;
  }
  return { scenes: result, moved };
}
