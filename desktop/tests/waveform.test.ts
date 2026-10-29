import { describe, expect, it } from 'vitest';
import { bucketsFor, decodableSource, waveformColumnHeight, decodeWaveform, waveformHeight, waveformPeaks, waveformRange, WAVEFORM_FLOOR_DB } from '../src/components/timeline/waveform-data';

describe('audio waveform peaks', () => {
  it('reduces channels to min and max per bucket', () => {
    const left = new Float32Array([0, .5, -.5, 1, -1, .25, -.25, 0]);
    const right = new Float32Array([0, .5, -.5, 1, -1, .25, -.25, 0]);
    const peaks = waveformPeaks([left, right], 4);
    expect(Array.from(peaks)).toEqual([0, .5, -.5, 1, -1, .25, -.25, 0]);
  });

  it('averages stereo channels and ignores shorter channels', () => {
    const left = new Float32Array([1, -1, 1, -1]);
    const right = new Float32Array([1, -1]);
    const peaks = waveformPeaks([left, right], 2);
    expect(Array.from(peaks)).toEqual([0, 1, -1, 0]);
  });

  it('returns an empty result for missing or invalid input', () => {
    expect(waveformPeaks([], 8)).toHaveLength(0);
    expect(waveformPeaks([new Float32Array(0)], 8)).toHaveLength(0);
    expect(waveformPeaks([new Float32Array(8)], 0)).toHaveLength(0);
    expect(waveformPeaks([new Float32Array(8)], 1.5)).toHaveLength(0);
  });

  it('maps the trimmed source window onto bucket indices', () => {
    const peaks = new Float32Array(200);
    expect(waveformRange(peaks, 0, 4, 10)).toEqual({ start: 0, end: 40 });
    expect(waveformRange(peaks, 4, 4, 10)).toEqual({ start: 40, end: 80 });
    expect(waveformRange(peaks, 8, 4, 10)).toEqual({ start: 80, end: 100 });
    expect(waveformRange(peaks, 20, 4, 10)).toEqual({ start: 100, end: 100 });
    expect(waveformRange(new Float32Array(0), 0, 4, 10)).toEqual({ start: 0, end: 0 });
  });

  it('skips decoding when Web Audio or the data URL is unavailable', async () => {
    expect(await decodeWaveform('not audio')).toBeNull();
    expect(await decodeWaveform('data:audio/wav;base64,AA==')).toBeNull();
  });

  it('draws heights on a decibel scale so quiet tracks stay readable', () => {
    expect(waveformHeight(0)).toBe(0);
    expect(waveformHeight(1)).toBe(1);
    expect(waveformHeight(-1)).toBe(1);
    expect(waveformHeight(10 ** (-WAVEFORM_FLOOR_DB / 20) / 2)).toBe(0);
    // A track peaking at 0.12 (about -18 dB) fills well over half the lane, not a sliver.
    expect(waveformHeight(.12)).toBeGreaterThan(.55);
    expect(waveformHeight(.5)).toBeGreaterThan(waveformHeight(.12));
  });

  it('scales peak resolution with the length of the file', () => {
    expect(bucketsFor(0)).toBe(64);
    expect(bucketsFor(20)).toBe(2000);
    expect(bucketsFor(3600)).toBe(40_000);
  });

  it('accepts bundled, blob and local asset sources but not remote URLs', () => {
    for (const source of ['data:audio/wav;base64,AA==', 'pixcut-asset:abc', 'blob:http://127.0.0.1:1420/x', '/templates/media/night-drive.m4a', 'http://127.0.0.1:1420/a.m4a']) expect(decodableSource(source), source).toBe(true);
    for (const source of ['https://example.com/a.mp3', 'not audio', 'data:image/png;base64,AA==']) expect(decodableSource(source), source).toBe(false);
  });

  it('draws one-sided columns from the loudest sample of either sign', () => {
    // Buckets: silence, a negative spike, a small positive wobble.
    const peaks = new Float32Array([0, 0, -1, .05, -.01, .02]);
    expect(waveformColumnHeight(peaks, 0, 3, 3, 0)).toBe(0);
    expect(waveformColumnHeight(peaks, 0, 3, 3, 1)).toBe(1);
    expect(waveformColumnHeight(peaks, 0, 3, 3, 2)).toBeLessThan(.3);
    // Fewer pixels than buckets: a column takes the loudest bucket it covers.
    expect(waveformColumnHeight(peaks, 0, 3, 1, 0)).toBe(1);
  });
});
