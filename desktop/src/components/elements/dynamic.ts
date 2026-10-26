import { ticksToSeconds, type AudioClip, type ElementLayer, type Timebase } from '../../stores/model';
import { decodeWaveform } from '../timeline/waveform-data';

export const DYNAMIC_KINDS = ['keycaps', 'mouse', 'comparison', 'checklist', 'rating', 'countdown', 'waveform', 'message'];
export const CARD_KINDS = ['caption', 'chapter', 'callout', 'keycaps', 'mouse', 'device', 'comparison', 'checklist', 'rating', 'countdown', 'waveform', 'message', 'qr', 'end-screen'];
export const isDynamicElement = (kind: string) => DYNAMIC_KINDS.includes(kind);
export const isCardElement = (kind: string) => CARD_KINDS.includes(kind);
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
/** All behavior is a pure function of element-local time; seeking never replays events. */
export function behaviorTime(element: ElementLayer, seconds: number) {
  const at = element.behavior?.atSeconds ?? 1;
  const interval = element.behavior?.intervalSeconds ?? 1;
  const elapsed = seconds - at;
  return { elapsed, interval, phase: elapsed < 0 ? -1 : element.behavior?.repeat ? elapsed % interval : elapsed };
}
export function countdownValue(element: ElementLayer, seconds: number) {
  const { elapsed, interval } = behaviorTime(element, seconds);
  const from = Math.round(element.behavior?.countFrom ?? 5), to = Math.round(element.behavior?.countTo ?? 0);
  const steps = Math.abs(to - from);
  let step = Math.max(0, Math.floor((elapsed + 1e-8) / interval));
  if (element.behavior?.repeat) step %= steps + 1;
  return from + Math.sign(to - from) * Math.min(steps, step);
}
export function completedItems(element: ElementLayer, seconds: number, count: number) {
  const { elapsed, interval } = behaviorTime(element, seconds);
  if (elapsed < 0) return 0;
  const steps = Math.floor((elapsed + 1e-8) / interval) + 1;
  return element.behavior?.repeat ? steps % (count + 1) : Math.min(count, steps);
}
export function clickPulses(element: ElementLayer, seconds: number) {
  const { phase } = behaviorTime(element, seconds);
  return (element.behavior?.variant === 'double-click' ? [0, .22] : [0]).map(delay => phase - delay).filter(age => age >= 0 && age < .55);
}
export function audioGain(clip: AudioClip, seconds: number, timebase: Timebase) {
  const local = seconds - ticksToSeconds(clip.startTicks, timebase), duration = ticksToSeconds(clip.durationTicks, timebase);
  if (local < 0 || local >= duration) return 0;
  return clip.volume * Math.min(1, clip.fadeIn > 0 ? local / clip.fadeIn : 1, clip.fadeOut > 0 ? (duration - local) / clip.fadeOut : 1);
}
/** Baked audio envelopes give identical reactive bars in preview and exported frames. */
export async function waveformBars(element: ElementLayer, seconds: number, audio: AudioClip[], timebase: Timebase, count = 32) {
  const bars = new Array<number>(count).fill(0);
  for (const clip of audio) {
    if (element.behavior?.audioId && element.behavior.audioId !== clip.id) continue;
    const gain = audioGain(clip, seconds, timebase);
    if (gain <= 0) continue;
    const peaks = await decodeWaveform(clip.id, clip.data, 4096);
    if (!peaks) continue;
    const buckets = peaks.length / 2;
    const local = seconds - ticksToSeconds(clip.startTicks, timebase) + clip.sourceInSeconds;
    // A trailing 180 ms window: no reaction before the sound starts.
    for (let i = 0; i < count; i++) {
      const sourceTime = local - .18 + i / Math.max(1, count - 1) * .18;
      if (sourceTime < 0 || sourceTime >= clip.sourceDurationSeconds) continue;
      const bucket = Math.max(0, Math.min(buckets - 1, Math.floor(sourceTime / clip.sourceDurationSeconds * buckets)));
      bars[i] = clamp01(bars[i] + Math.max(Math.abs(peaks[bucket * 2]), Math.abs(peaks[bucket * 2 + 1])) * gain);
    }
  }
  return bars;
}
