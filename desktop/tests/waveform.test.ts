import { describe, expect, it } from 'vitest';
import { decodeWaveform, waveformPeaks, waveformRange } from '../src/components/timeline/waveform-data';

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
    expect(await decodeWaveform('missing', 'not audio')).toBeNull();
    expect(await decodeWaveform('missing', 'data:audio/wav;base64,AA==')).toBeNull();
  });
});
