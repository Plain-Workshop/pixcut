export type WaveformPeaks = Float32Array;

const BUCKETS = 320;
const CACHE_LIMIT = 64;
const cache = new Map<string, WaveformPeaks>();
let queue: Promise<unknown> = Promise.resolve();

/**
 * Reduces decoded audio channels to a min/max peak per bucket. Pure so the
 * waveform maths can be tested without Web Audio. Channels are averaged.
 */
export function waveformPeaks(channels: Float32Array[], buckets = BUCKETS): WaveformPeaks {
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

function cacheKey(clipId: string, dataLength: number, buckets = BUCKETS) { return `${clipId}:${dataLength}:${buckets}`; }

export function cachedWaveform(clipId: string, dataLength: number) { return cache.get(cacheKey(clipId, dataLength)) ?? null; }

function remember(key: string, peaks: WaveformPeaks) {
  cache.set(key, peaks);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

/**
 * Decodes one audio clip at a low sample rate and caches its peaks. Decoding is
 * serialised so importing several tracks does not spike the main thread. Any
 * failure (unsupported codec, no Web Audio, malformed data) returns null; the
 * timeline then simply shows no waveform.
 */
export async function decodeWaveform(clipId: string, data: string, buckets = BUCKETS): Promise<WaveformPeaks | null> {
  const key = cacheKey(clipId, data.length, buckets);
  const hit = cache.get(key);
  if (hit) return hit;
  const Context = globalThis.OfflineAudioContext;
  if (!Context || typeof globalThis.fetch !== 'function' || !data.startsWith('data:audio/')) return null;
  const run = queue.then(async () => {
    const cached = cache.get(key);
    if (cached) return cached;
    try {
      const response = await fetch(data);
      const bytes = await response.arrayBuffer();
      const context = new Context(1, 1, 8000);
      const buffer = await context.decodeAudioData(bytes);
      const channels: Float32Array[] = [];
      for (let channel = 0; channel < Math.min(2, buffer.numberOfChannels); channel += 1) channels.push(buffer.getChannelData(channel));
      const peaks = waveformPeaks(channels, buckets);
      if (!peaks.length) return null;
      remember(key, peaks);
      return peaks;
    } catch {
      return null;
    }
  });
  queue = run.catch(() => null);
  return run;
}

export function drawWaveform(canvas: HTMLCanvasElement, peaks: WaveformPeaks, start = 0, end = Math.floor(peaks.length / 2)) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  const count = Math.max(1, end - start);
  const middle = height / 2;
  const amplitude = middle * 0.88;
  const bar = width / count;
  const gradient = context.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, 'rgba(232, 226, 255, .72)');
  gradient.addColorStop(.5, 'rgba(190, 174, 255, .52)');
  gradient.addColorStop(1, 'rgba(150, 132, 240, .4)');
  context.fillStyle = gradient;
  for (let index = 0; index < count; index += 1) {
    const bucket = Math.min(Math.floor(peaks.length / 2) - 1, start + index);
    const low = peaks[bucket * 2] ?? 0;
    const high = peaks[bucket * 2 + 1] ?? 0;
    const top = middle - high * amplitude;
    const bottom = middle - low * amplitude;
    context.fillRect(index * bar, top, Math.max(1, bar - .6), Math.max(1.4, bottom - top));
  }
}
