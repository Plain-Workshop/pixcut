import { resolveMediaSource } from '../preview/media-url';
export type WaveformPeaks = Float32Array;

/** Peaks per second of source audio; long files are capped so memory stays small. */
const BUCKETS_PER_SECOND = 100;
const MIN_BUCKETS = 64;
const MAX_BUCKETS = 40_000;
const CACHE_LIMIT = 48;
/** Heights use a decibel scale: this many dB below full scale is the centre line. */
export const WAVEFORM_FLOOR_DB = 48;
export type WaveformResult = { peaks: WaveformPeaks; duration: number };
const cache = new Map<string, WaveformResult | null>();
let queue: Promise<unknown> = Promise.resolve();

export function bucketsFor(durationSeconds: number) {
  if (!(durationSeconds > 0)) return MIN_BUCKETS;
  return Math.max(MIN_BUCKETS, Math.min(MAX_BUCKETS, Math.round(durationSeconds * BUCKETS_PER_SECOND)));
}
/**
 * Reduces decoded audio channels to a min/max peak per bucket. Pure so the
 * waveform maths can be tested without Web Audio. Channels are averaged.
 */
export function waveformPeaks(channels: Float32Array[], buckets = MIN_BUCKETS): WaveformPeaks {
  if (!channels.length || !Number.isInteger(buckets) || buckets <= 0) return new Float32Array(0);
  const length = Math.min(...channels.map(channel => channel.length));
  if (!Number.isFinite(length) || length <= 0) return new Float32Array(0);
  const output = new Float32Array(buckets * 2);
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor((bucket * length) / buckets);
    const end = Math.max(start + 1, Math.floor(((bucket + 1) * length) / buckets));
    let minimum = 0;
    let maximum = 0;
    for (let index = start; index < end && index < length; index += 1) {
      let value = 0;
      for (const channel of channels) value += channel[index] ?? 0;
      value /= channels.length;
      if (value < minimum) minimum = value;
      if (value > maximum) maximum = value;
    }
    output[bucket * 2] = minimum;
    output[bucket * 2 + 1] = maximum;
  }
  return output;
}

/** Maps a source window (seconds) onto a bucket range, clamped to the peaks. */
export function waveformRange(peaks: WaveformPeaks, sourceInSeconds: number, durationSeconds: number, sourceDurationSeconds: number) {
  const buckets = Math.floor(peaks.length / 2);
  if (buckets <= 0) return { start: 0, end: 0 };
  const total = Number.isFinite(sourceDurationSeconds) && sourceDurationSeconds > 0 ? sourceDurationSeconds : 0;
  const from = total ? Math.min(1, Math.max(0, sourceInSeconds / total)) : 0;
  const to = total ? Math.min(1, Math.max(from, (sourceInSeconds + durationSeconds) / total)) : 1;
  return { start: Math.floor(from * buckets), end: Math.min(buckets, Math.max(Math.floor(from * buckets) + 1, Math.ceil(to * buckets))) };
}

/** Clips that share a file (after a split, or the same import) share one decode. */
function sourceKey(data: string, buckets?: number) { return `${buckets ?? 'auto'}:${data.length}:${data.slice(0, 96)}:${data.slice(-48)}`; }

/** A finished decode, or undefined while it has not run yet. `null` means no audio could be read. */
export function cachedWaveform(data: string): WaveformResult | null | undefined { return cache.get(sourceKey(data)); }

function remember(key: string, result: WaveformResult | null) {
  cache.set(key, result);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/** Sources Web Audio can be asked to decode: embedded data, local assets, blobs and bundled files. */
export function decodableSource(data: string) {
  return data.startsWith('data:audio/') || data.startsWith('data:video/') || data.startsWith('pixcut-asset:') || data.startsWith('blob:') || data.startsWith('/') || /^https?:\/\/(localhost|127\.0\.0\.1|tauri\.localhost)[:/]/.test(data);
}

/**
 * Decodes one source at a low sample rate and caches its peaks. Decoding is
 * serialised so importing several tracks does not spike the main thread. Any
 * failure (no audio track, unsupported codec, no Web Audio, malformed data)
 * caches and returns null so the timeline can say "No sound" instead of
 * retrying on every render. A fixed `buckets` count is for callers whose
 * output must not change with the file length, such as exported reactive bars.
 */
export async function decodeWaveform(data: string, buckets?: number): Promise<WaveformResult | null> {
  const key = sourceKey(data, buckets);
  if (cache.has(key)) return cache.get(key) ?? null;
  const Context = globalThis.OfflineAudioContext;
  if (!Context || typeof globalThis.fetch !== 'function' || !decodableSource(data)) return null;
  const run = queue.then(async () => {
    if (cache.has(key)) return cache.get(key) ?? null;
    let result: WaveformResult | null = null;
    try {
      const source = await resolveMediaSource(data);
      if (source) {
        const response = await fetch(source);
        if (response.ok) {
          const buffer = await new Context(1, 1, 8000).decodeAudioData(await response.arrayBuffer());
          const channels: Float32Array[] = [];
          for (let channel = 0; channel < Math.min(2, buffer.numberOfChannels); channel += 1) channels.push(buffer.getChannelData(channel));
          const peaks = waveformPeaks(channels, buckets ?? bucketsFor(buffer.duration));
          if (peaks.length) result = { peaks, duration: buffer.duration };
        }
      }
    } catch { result = null; }
    remember(key, result);
    return result;
  });
  queue = run.catch(() => null);
  return run;
}

/** Sample value to a 0–1 height on the decibel scale; silence is 0, full scale is 1. */
export function waveformHeight(value: number, floorDb = WAVEFORM_FLOOR_DB) {
  const magnitude = Math.abs(value);
  if (!(magnitude > 0)) return 0;
  return Math.min(1, Math.max(0, (20 * Math.log10(magnitude) + floorDb) / floorDb));
}

/**
 * Draws the peaks between `start` and `end` (bucket indices) across the
 * canvas, one column per device pixel so nothing is stretched. The envelope
 * grows up from the bottom edge: louder is taller, and the lane reads like a
 * level meter over time rather than a mirrored wave.
 */
export function drawWaveform(canvas: HTMLCanvasElement, peaks: WaveformPeaks, start = 0, end = Math.floor(peaks.length / 2)) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  const buckets = Math.floor(peaks.length / 2);
  const count = Math.max(0, Math.min(buckets, end) - Math.max(0, start));
  if (!count || !width) return;
  const reach = height * .94;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(236, 230, 255, .95)');
  gradient.addColorStop(.6, 'rgba(190, 172, 255, .8)');
  gradient.addColorStop(1, 'rgba(140, 120, 236, .55)');
  context.fillStyle = gradient;
  for (let x = 0; x < width; x += 1) {
    context.fillRect(x, height - waveformColumnHeight(peaks, start, count, width, x) * reach, 1, height);
  }
}

/** 0–1 height of one pixel column: the loudest sample (either sign) in its share of the buckets. */
export function waveformColumnHeight(peaks: WaveformPeaks, start: number, count: number, width: number, x: number) {
  const buckets = Math.floor(peaks.length / 2);
  const from = start + Math.floor(x * count / width);
  const to = Math.max(from + 1, start + Math.floor((x + 1) * count / width));
  let loudest = 0;
  for (let bucket = from; bucket < to && bucket < buckets; bucket += 1) loudest = Math.max(loudest, Math.abs(peaks[bucket * 2] ?? 0), Math.abs(peaks[bucket * 2 + 1] ?? 0));
  return waveformHeight(loudest);
}
